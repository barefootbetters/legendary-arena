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

/**
 * Counts the work-list scans a recording pool has seen. Each scan also runs the
 * D-24719 verdict sweep (a `bgio.replay_artifacts` query), so the scheduler
 * assertions count scans by their `bgio.matches` query, not every pool call.
 */
function countScans(pool: { calls: { text: string }[] }): number {
  return pool.calls.filter((call) => /FROM bgio\.matches/.test(call.text)).length;
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
      assert.equal(countScans(pool), 1);

      mock.timers.tick(CAPTURE_HARVESTER_INTERVAL_MS);
      await flushAsync();
      // why: a second scan after one interval.
      assert.equal(countScans(pool), 2);

      handle.stop();
      mock.timers.tick(CAPTURE_HARVESTER_INTERVAL_MS * 3);
      await flushAsync();
      // why: no further scans after stop() clears the interval.
      assert.equal(countScans(pool), 2);
    } finally {
      mock.timers.reset();
    }
  });
});

describe('captureHarvester — verdict sweep (D-24719)', () => {
  test('each scan runs the artifact verdict sweep after the capture loop', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    try {
      // why: a one-id work-list. The recording pool answers the capture's own
      // read with a row that has no `initial_state`, so captureMatch skips it as
      // not replayable after one query; the sweep must come after that read.
      const pool = makeRecordingPool([{ match_id: 'm1' }]);
      const handle = startCaptureHarvester({
        database: pool as never,
        intervalMs: CAPTURE_HARVESTER_INTERVAL_MS,
      });
      await flushAsync();
      await flushAsync();
      handle.stop();
      const texts = pool.calls.map((call) => call.text);
      const captureReadIndex = texts.findIndex((text) =>
        /SELECT initial_state, log, metadata FROM bgio\.matches/.test(text),
      );
      const sweepIndex = texts.findIndex((text) => /FROM bgio\.replay_artifacts/.test(text));
      assert.ok(captureReadIndex > 0, 'the capture loop read the work-list match');
      assert.ok(sweepIndex > captureReadIndex, 'the sweep runs after the capture loop');
      const sweep = pool.calls[sweepIndex]!;
      assert.match(sweep.text, /gameover IS NULL/);
      assert.deepEqual(sweep.params, [5]);
    } finally {
      mock.timers.reset();
    }
  });

  test('a failing sweep is swallowed and the next scan still runs', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    try {
      const calls: string[] = [];
      const pool = {
        async query(text: string) {
          calls.push(text);
          if (/replay_artifacts/.test(text)) {
            throw new Error('simulated sweep failure');
          }
          return { rows: [] };
        },
      };
      const handle = startCaptureHarvester({
        database: pool as never,
        intervalMs: CAPTURE_HARVESTER_INTERVAL_MS,
      });
      await flushAsync();
      mock.timers.tick(CAPTURE_HARVESTER_INTERVAL_MS);
      await flushAsync();
      handle.stop();
      assert.equal(calls.filter((text) => /FROM bgio\.matches/.test(text)).length, 2);
    } finally {
      mock.timers.reset();
    }
  });
});
