/**
 * Tests for the live-match capture harvester (WP-335 / EC-365).
 *
 * Pure — no database. `findUncapturedGameoverMatches` is exercised against a
 * recording stub pool (asserts the scan query shape + the dedupe filter +
 * returned ids). `startCaptureHarvester` is exercised with `node:test` mock timers
 * (immediate scan, a second scan after `intervalMs`, none after `stop()`) using a
 * stub pool whose scan returns no rows, so `captureMatch` is never reached and no
 * deep DB stubbing is needed. Mirrors the WP-327 `matchReaper.test.ts` pattern.
 */

import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  findUncapturedGameoverMatches,
  startCaptureHarvester,
  CAPTURE_HARVESTER_INTERVAL_MS,
} from './captureHarvester.js';

/** A recording stub pool whose `query` captures each call and returns fixed rows. */
function makeRecordingPool(rows: { match_id: string }[]) {
  const calls: { text: string; params: unknown[] }[] = [];
  const pool = {
    calls,
    async query(text: string, params: unknown[]) {
      calls.push({ text, params });
      return { rows };
    },
  };
  return pool;
}

/** Drains the fire-and-forget scan promise chain after a mocked timer tick. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('captureHarvester — findUncapturedGameoverMatches (no database)', () => {
  test('locked cadence constant', () => {
    assert.equal(CAPTURE_HARVESTER_INTERVAL_MS, 300_000);
  });

  test('scans bgio.matches for gameover rows not yet captured and returns their ids', async () => {
    const pool = makeRecordingPool([{ match_id: 'm1' }, { match_id: 'm2' }]);
    const ids = await findUncapturedGameoverMatches(pool as never);

    assert.deepEqual(ids, ['m1', 'm2']);
    assert.equal(pool.calls.length, 1);
    const { text } = pool.calls[0]!;
    assert.match(text, /SELECT match_id FROM bgio\.matches/);
    assert.match(text, /jsonb_exists\(metadata, 'gameover'\)/);
    // why: the dedupe filter — only rows not yet captured are work-list items.
    assert.match(text, /captured_at IS NULL/);
    // why: persistence-boundary guard (D-24095) — the harvester scan never
    // references a legendary.* domain table.
    assert.doesNotMatch(text, /legendary\./);
  });
});

describe('captureHarvester — startCaptureHarvester scheduler (mock timers)', () => {
  test('scans immediately, again after the interval, and not after stop()', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    try {
      // Scan returns no rows, so captureMatch is never invoked.
      const pool = makeRecordingPool([]);

      const handle = startCaptureHarvester({
        database: pool as never,
        intervalMs: CAPTURE_HARVESTER_INTERVAL_MS,
      });
      await flushAsync();
      // why: one immediate scan at startup.
      assert.equal(pool.calls.length, 1);

      mock.timers.tick(CAPTURE_HARVESTER_INTERVAL_MS);
      await flushAsync();
      // why: a second scan after one interval.
      assert.equal(pool.calls.length, 2);

      handle.stop();
      mock.timers.tick(CAPTURE_HARVESTER_INTERVAL_MS * 3);
      await flushAsync();
      // why: no further scans after stop() clears the interval.
      assert.equal(pool.calls.length, 2);
    } finally {
      mock.timers.reset();
    }
  });
});
