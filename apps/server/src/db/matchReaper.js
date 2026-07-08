/**
 * Match Reaper — Server Layer (WP-327 / EC-357)
 *
 * A periodic maintenance task that deletes stale rows from `bgio.matches` so the
 * WP-309 durable match store does not grow without bound. Two exports plus the
 * locked cadence/TTL constants:
 *
 *   - `reapStaleMatches(database, options)` — one atomic `DELETE FROM
 *     bgio.matches` removing finished matches past a short grace and abandoned
 *     matches past a long TTL. Returns the deleted row count.
 *   - `startMatchReaper(options)` — runs `reapStaleMatches` immediately and then
 *     on a `setInterval`, mirroring the legends-publisher scheduler; returns a
 *     `{ stop() }` handle. A failed run is logged and swallowed; the timer is
 *     `unref()`'d.
 *
 * why: SCHEMA BOUNDARY (D-24095) — the reaper deletes ONLY from the dedicated
 * `bgio` framework schema, NEVER from the `legendary.*` domain schema. It is a
 * Server-layer operational artifact: it maintains storage, it decides no
 * gameplay. It never reads or interprets the match blob, imports no engine /
 * registry / preplan / boardgame.io code, and takes its `pg.Pool` by injection
 * (the single long-lived WP-115 pool) — it constructs no pool of its own.
 *
 * why: NO APPLICATION WALL-CLOCK — the age decision runs entirely server-side as
 * `updated_at < now() - make_interval(...)`. The JS side passes only the two TTL
 * magnitudes; it reads no `Date.now()` / `new Date()`. (`setInterval` scheduling
 * is Server-layer wiring — the legends-publisher precedent; determinism rules
 * govern the engine, not server ops.)
 *
 * Authority: WP-327 §Scope (In); EC-357 §Locked Values + §Guardrails;
 * DECISIONS.md D-24113 (reap TTL policy + in-process interval);
 * D-24095 (bgio framework-store exemption + `bgio` schema boundary).
 */

// why: reap cadence — run the sweep every 15 minutes. Frequent enough that a
// match clears well within an hour of crossing its TTL, infrequent enough that
// the cost is negligible (one DELETE over an indexed primary-key table per run).
export const MATCH_REAPER_INTERVAL_MS = 900_000;

// why: a finished match (its metadata carries `gameover`) is wiped 1 hour after
// its last write — a short grace so a just-ended match is still fetchable for a
// post-game screen or a brief reconnect, then removed.
export const GAMEOVER_GRACE_MS = 3_600_000;

// why: a match that never reached `gameover` is treated as abandoned after 24
// hours with no writes — long enough that a genuinely paused game (e.g.
// overnight) is not reaped mid-play, short enough that dead single-seat / solo
// creates do not accumulate.
export const ABANDONED_TTL_MS = 86_400_000;

/**
 * Deletes stale rows from `bgio.matches` in one atomic query and returns the
 * number of rows removed. A finished match (metadata carries `gameover`) is
 * removed once it is older than `gameoverGraceMs`; a non-`gameover` match is
 * removed once it is older than `abandonedTtlMs`. Age is measured server-side
 * against `now()` using each row's `updated_at` column (stamped on every store
 * write), so no application wall-clock enters the decision.
 *
 * @param {import('pg').Pool} database - The injected long-lived WP-115 `pg.Pool`.
 * @param {{ gameoverGraceMs: number, abandonedTtlMs: number }} options - TTLs in ms.
 * @returns {Promise<number>} The count of deleted match rows.
 */
export async function reapStaleMatches(database, options) {
  // why: the query takes the TTLs in seconds via `make_interval(secs => …)`;
  // convert the millisecond magnitudes here so the call sites read in ms.
  const gameoverGraceSeconds = options.gameoverGraceMs / 1000;
  const abandonedTtlSeconds = options.abandonedTtlMs / 1000;
  try {
    // why: one atomic DELETE covering both age classes. A `gameover`-bearing row
    // is removed past the short grace; a non-`gameover` row past the long
    // abandoned TTL. `jsonb_exists(metadata, 'gameover')` is the precise
    // key-existence check matching the WP-309 store's `metadata.gameover !==
    // undefined`; the function form (not the `?` operator) avoids any
    // placeholder-parsing ambiguity in node-pg. The cutoff is `now() -
    // make_interval(...)` — evaluated by PostgreSQL, never in application code.
    // why: WP-335 / D-24122 capture guard — a gameover row is reaped only once
    // `captured_at IS NOT NULL` (the capture harvester has durably stored its
    // replay artifact + ownership). Without this, a capture outage lasting past
    // the 1-hour grace would let the reaper delete a finished competitive match
    // before it was captured, silently losing it. The abandoned branch is
    // unchanged (an abandoned, never-gameover match is never captured, so guarding
    // it would leak abandoned rows forever).
    const result = await database.query(
      `DELETE FROM bgio.matches
        WHERE (metadata IS NOT NULL AND jsonb_exists(metadata, 'gameover')
               AND captured_at IS NOT NULL
               AND updated_at < now() - make_interval(secs => $1))
           OR ((metadata IS NULL OR NOT jsonb_exists(metadata, 'gameover'))
               AND updated_at < now() - make_interval(secs => $2))`,
      [gameoverGraceSeconds, abandonedTtlSeconds],
    );
    return result.rowCount ?? 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `matchReaper.reapStaleMatches failed to delete stale matches from bgio.matches. ` +
        `Check that the bgio schema migration has been applied and the database is reachable. ` +
        `Error: ${errorMessage}`,
    );
  }
}

/**
 * Starts the periodic match reaper. Runs one reap immediately (so a fresh deploy
 * clears already-stale rows without waiting a full interval) and then every
 * `intervalMs`. Returns a `{ stop() }` handle whose `stop()` clears the interval.
 *
 * A reap run that rejects is logged and swallowed — a transient DB error must
 * never crash the process or leave an unhandled rejection; the next interval
 * retries. The interval timer is `unref()`'d so it never keeps the process alive
 * on its own; the HTTP server owns process liveness and SIGTERM calls `stop()`.
 *
 * @param {{ database: import('pg').Pool, intervalMs: number, gameoverGraceMs: number, abandonedTtlMs: number }} options
 * @returns {{ stop: () => void }} A handle whose `stop()` halts further reaps.
 */
export function startMatchReaper(options) {
  const database = options.database;
  const intervalMs = options.intervalMs;
  const gameoverGraceMs = options.gameoverGraceMs;
  const abandonedTtlMs = options.abandonedTtlMs;

  /**
   * Runs a single reap, logging the deleted count when non-zero and swallowing
   * any failure so the timer never sees a rejection.
   *
   * @returns {Promise<void>}
   */
  async function runReapOnce() {
    try {
      const deletedCount = await reapStaleMatches(database, {
        gameoverGraceMs,
        abandonedTtlMs,
      });
      if (deletedCount > 0) {
        console.log(
          `[match-reaper] Reaped ${deletedCount} stale match row(s) from bgio.matches ` +
            `(gameover grace ${gameoverGraceMs}ms, abandoned TTL ${abandonedTtlMs}ms).`,
        );
      }
    } catch (error) {
      // why: a failed reap run is logged and swallowed — a transient DB error
      // must never crash the process or surface an unhandled rejection; the next
      // interval retries.
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[match-reaper] Reap run failed (will retry next interval): ${errorMessage}`,
      );
    }
  }

  const intervalHandle = setInterval(() => {
    // why: fire-and-forget — runReapOnce() catches its own errors, so the timer
    // callback never sees a rejection.
    void runReapOnce();
  }, intervalMs);

  // why: unref the timer so it never keeps the process alive on its own — the
  // HTTP server owns process liveness and SIGTERM calls stop() explicitly. The
  // typeof guard tolerates a mocked timer handle that lacks unref (tests).
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  // why: run once immediately at startup so a fresh deploy clears already-stale
  // rows without waiting a full interval.
  void runReapOnce();

  console.log(`[match-reaper] Started with ${intervalMs}ms cadence.`);

  return {
    stop() {
      clearInterval(intervalHandle);
      console.log('[match-reaper] Stopped.');
    },
  };
}
