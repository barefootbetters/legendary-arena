/**
 * Live-Match Capture Harvester — Server Layer (WP-335 / EC-365)
 *
 * A periodic maintenance task that captures finished matches: it scans
 * `bgio.matches` for gameover rows not yet captured and runs `captureMatch` on
 * each (reconstruct -> store durable artifact + mapping + scenarioKey -> assign
 * ownership per authenticated seat -> stamp captured_at). Mirrors the WP-327
 * `startMatchReaper` scheduler; returns a `{ stop() }` handle. A failed run is
 * logged and swallowed; the timer is `unref()`'d.
 *
 * why: RUNS BEFORE THE REAPER CAN DELETE. The reaper (WP-327) deletes gameover
 * rows past a 1-hour grace, but only once `captured_at` is set (the WP-335 reaper
 * guard). The harvester's 5-minute cadence is well under that grace, so a match is
 * captured long before it is eligible for reaping. Should capture keep failing, the
 * reaper guard keeps the row alive (captured_at stays NULL) rather than losing a
 * competitive match.
 *
 * why: SCAN, NOT A setState INTERCEPTOR. Gameover is written via the store's
 * `setMetadata`, not `setState` (which fires per move); and the bgio storage adapter
 * must stay engine/registry/legendary-free (D-24095). A scan keeps capture in the
 * server layer, reusing the proven reaper pattern.
 *
 * Authority: WP-335 §Scope (In) §D; EC-365 §Guardrails; D-24119 (arc); D-24122
 * (capture pipeline); D-24113 (the sibling reaper scheduler pattern).
 */

import { captureMatch } from './matchCapture.logic.js';

// why: capture cadence — scan every 5 minutes. Well under the reaper's 1-hour
// gameover grace (GAMEOVER_GRACE_MS), so a finished match is captured long before
// it is eligible for reaping; frequent enough that a just-ended match is
// submittable within minutes.
export const CAPTURE_HARVESTER_INTERVAL_MS = 300_000;

/**
 * Fetch the ids of finished matches not yet captured: gameover rows whose
 * `captured_at` is still NULL. This is the harvester's work-list and the dedupe
 * filter in one indexed predicate.
 *
 * @param {import('pg').Pool} database - The injected long-lived WP-115 `pg.Pool`.
 * @returns {Promise<string[]>} The match ids awaiting capture.
 */
export async function findUncapturedGameoverMatches(database) {
  const result = await database.query(
    `SELECT match_id FROM bgio.matches
      WHERE metadata IS NOT NULL
        AND jsonb_exists(metadata, 'gameover')
        AND captured_at IS NULL`,
  );
  return result.rows.map((row) => row.match_id);
}

/**
 * Starts the periodic capture harvester. Runs one scan immediately (so a fresh
 * deploy captures already-finished matches without waiting a full interval) and
 * then every `intervalMs`. Returns a `{ stop() }` handle whose `stop()` clears the
 * interval.
 *
 * A scan or per-match capture that rejects is logged and swallowed — a transient
 * error must never crash the process or leave an unhandled rejection; the next
 * interval retries (and the reaper guard keeps un-captured rows alive meanwhile).
 * The interval timer is `unref()`'d.
 *
 * @param {{ database: import('pg').Pool, intervalMs: number }} options
 * @returns {{ stop: () => void }} A handle whose `stop()` halts further scans.
 */
export function startCaptureHarvester(options) {
  const database = options.database;
  const intervalMs = options.intervalMs;

  /**
   * Runs a single scan: capture each uncaptured gameover match, logging per-match
   * failures without aborting the rest of the batch.
   *
   * @returns {Promise<void>}
   */
  async function runScanOnce() {
    let matchIds;
    try {
      matchIds = await findUncapturedGameoverMatches(database);
    } catch (error) {
      // why: a failed scan is logged and swallowed; the next interval retries.
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[capture-harvester] Scan failed (will retry next interval): ${errorMessage}`,
      );
      return;
    }
    for (const matchId of matchIds) {
      try {
        const result = await captureMatch(matchId, database);
        if (result.skipped === null) {
          console.log(
            `[capture-harvester] Captured match ${matchId} ` +
              `(replayHash ${result.replayHash}, ${result.seatsOwned} seat(s) owned).`,
          );
        }
      } catch (error) {
        // why: one match's capture failure must not abort the batch — log and
        // continue. The match's captured_at stays NULL, so the reaper guard keeps
        // it alive for the next scan to retry.
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[capture-harvester] Failed to capture match ${matchId} (will retry ` +
            `next interval): ${errorMessage}`,
        );
      }
    }
  }

  const intervalHandle = setInterval(() => {
    // why: fire-and-forget — runScanOnce() catches its own errors, so the timer
    // callback never sees a rejection.
    void runScanOnce();
  }, intervalMs);

  // why: unref the timer so it never keeps the process alive on its own — the HTTP
  // server owns process liveness and SIGTERM calls stop() explicitly. The typeof
  // guard tolerates a mocked timer handle that lacks unref (tests).
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  // why: run once immediately at startup so a fresh deploy captures already-finished
  // matches without waiting a full interval.
  void runScanOnce();

  console.log(`[capture-harvester] Started with ${intervalMs}ms cadence.`);

  return {
    stop() {
      clearInterval(intervalHandle);
      console.log('[capture-harvester] Stopped.');
    },
  };
}
