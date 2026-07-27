/**
 * Bot-Ally Cross-Instance Ownership Lease (WP-437 / EC-472 / D-24256).
 *
 * Closes the deploy-overlap "two-writer" freeze WP-424 (D-24244) deferred: on a
 * rolling Render deploy the NEW instance revives a match's BotAllyDriver and
 * starts submitting the bot's moves BEFORE the OLD instance finishes draining, so
 * for the termination-grace window TWO instances drive the same bot seat and race
 * on boardgame.io's `_stateID` — the bot's move never lands and the co-op match
 * freezes with `driving:true`. This module is the durable guard: a per-match
 * ownership LEASE in the `legendary.match_bot_ally` side-table (columns
 * `driver_owner` + `heartbeat_at`, migration 038) that lets only ONE instance
 * drive a given bot seat at a time.
 *
 * Design (D-24256 — Option B over a pg advisory lock): the single shared
 * `pg.Pool` (`max: 10`) is used by every server surface, so a session-scoped
 * `pg_try_advisory_lock` — which must be held on a pinned client for the driver's
 * lifetime — would starve the pool with only a handful of concurrent bot-ally
 * matches. This lease uses ordinary POOLED queries, composes with the existing
 * side-table + SIGTERM machinery, and is directly queryable/observable. The
 * driver arbitrates COOPERATIVELY at each poll tick: it runs
 * {@link acquireOrRenewBotAllyLease} and drives only when it holds the lease,
 * otherwise it yields the tick — so the existing 250ms poll loop IS the retry
 * mechanism and no new interval is needed.
 *
 * Ownership state is side-table-only (D-24095 store-only discipline; the same
 * data class as `revive_count` / `shutdown_interrupted`) — NEVER `G`/`ctx`, NEVER
 * the bgio blob. The server layer may use `now()`/wall-clock (the no-clock rule
 * is an engine rule).
 */

import { randomUUID } from 'node:crypto';

/**
 * This process's ownership id — one per server instance, stable for the process
 * lifetime, distinct across instances (two containers in a rolling deploy each
 * get their own). Written to `driver_owner` when this instance holds a match's
 * lease; compared against `driver_owner` to tell "my lease" from "a peer's".
 *
 * // why: a per-process unique id is the whole basis for distinguishing the two
 * overlapping instances. `crypto.randomUUID()` at module load is evaluated exactly
 * once per process (server layer — a module-load clock/RNG read is allowed here,
 * unlike engine code). Neither pid nor hostname is reliably unique across Render
 * containers; a UUID is.
 */
export const SERVER_INSTANCE_ID = randomUUID();

/**
 * How long (milliseconds) a lease stays valid after its last heartbeat before a
 * surviving instance may claim it from a crashed owner.
 *
 * // why: 15s balances two failure modes. It must NEVER false-expire a LIVE owner:
 * the owner renews the lease at the top of every poll tick, so its heartbeat is at
 * most one tick+turn old (~sub-second when the DB is healthy) — far inside 15s. And
 * it must free a CRASHED owner (OOM/kill — no clean SIGTERM to release the lease)
 * within a bounded window so the match is never stuck forever; ~15s is that bound.
 * The COMMON clean-deploy path never waits the TTL: SIGTERM releases the lease
 * explicitly (see {@link releaseBotAllyLeasesForOwner}) so the survivor claims on
 * its very next tick. TTL therefore governs only ungraceful-crash recovery latency.
 * A single turn that itself exceeds 15s under a sustained DB outage is a documented
 * residual (D-24256) — the driver's own fault/retry machinery and boardgame.io's
 * stale-`_stateID` reject still bound it.
 */
export const BOT_ALLY_LEASE_TTL_MS = 15000;

/**
 * Atomically claims or renews this match's ownership lease for `ownerId`. Returns
 * whether `ownerId` holds the lease AFTER the call — the driver's per-tick
 * drive-or-yield gate.
 *
 * The lease is claimable when it is unowned (`driver_owner IS NULL`), already
 * owned by `ownerId` (a renewal), never heartbeated (a legacy row), or its
 * heartbeat is older than `ttlMs` (a crashed owner). A fresh PEER lease (a
 * different owner that heartbeated within `ttlMs`) is NOT claimable, so a second
 * instance yields while the first is live. The single atomic UPDATE means two
 * instances can never both come away believing they own it.
 *
 * @param {object} database - The shared pg pool.
 * @param {string} matchId - The match whose lease to claim/renew.
 * @param {string} ownerId - This instance's ownership id ({@link SERVER_INSTANCE_ID}).
 * @param {number} ttlMs - The staleness window ({@link BOT_ALLY_LEASE_TTL_MS}).
 * @returns {Promise<boolean>} true when `ownerId` holds the lease after the call.
 */
export async function acquireOrRenewBotAllyLease(database, matchId, ownerId, ttlMs) {
  // why: one atomic claim-or-renew. The WHERE admits exactly the claimable cases
  // (unowned / mine / never-heartbeated / stale-past-TTL) and rejects a fresh
  // peer lease; RETURNING lets rowCount report ownership. `heartbeat_at < now() -
  // (ttlMs ms)` uses a server-side clock (allowed at the server layer).
  const result = await database.query(
    'UPDATE legendary.match_bot_ally ' +
      'SET driver_owner = $2, heartbeat_at = now(), updated_at = now() ' +
      'WHERE match_id = $1 ' +
      'AND (driver_owner IS NULL ' +
      'OR driver_owner = $2 ' +
      'OR heartbeat_at IS NULL ' +
      "OR heartbeat_at < now() - ($3 * interval '1 millisecond')) " +
      'RETURNING match_id',
    [matchId, ownerId, ttlMs],
  );
  return result.rowCount > 0;
}

/**
 * Releases every lease held by `ownerId` (clears `driver_owner`), so a surviving
 * instance can claim those matches on its next poll tick instead of waiting out
 * the TTL. Called from the SIGTERM handler on a graceful shutdown.
 *
 * // why: a clean deploy is the common overlap case; releasing here gives a
 * near-instant handoff (~250ms) rather than a ~15s TTL wait. `heartbeat_at` is
 * left as-is — `driver_owner IS NULL` alone makes the lease claimable. Keyed by
 * owner (not a match-id list) so it is independent of the in-memory driver map.
 * Best-effort: the caller guards it so a failed release never blocks shutdown (the
 * survivor still recovers via the TTL).
 *
 * @param {object} database - The shared pg pool.
 * @param {string} ownerId - This instance's ownership id ({@link SERVER_INSTANCE_ID}).
 * @returns {Promise<void>}
 */
export async function releaseBotAllyLeasesForOwner(database, ownerId) {
  await database.query(
    'UPDATE legendary.match_bot_ally ' +
      'SET driver_owner = NULL, updated_at = now() ' +
      'WHERE driver_owner = $1',
    [ownerId],
  );
}
