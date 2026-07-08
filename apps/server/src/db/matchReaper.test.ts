/**
 * Tests for the bgio match reaper (WP-327 / EC-357).
 *
 * All tests are pure — no database. `reapStaleMatches` is exercised against a
 * recording stub pool (asserts the DELETE shape, params, and returned count) and
 * a failing stub pool (asserts the wrapped full-sentence error). `startMatchReaper`
 * is exercised with `node:test` mock timers: an immediate reap, a second reap
 * after `intervalMs`, and no further reap after `stop()`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reapStaleMatches,
  startMatchReaper,
  MATCH_REAPER_INTERVAL_MS,
  GAMEOVER_GRACE_MS,
  ABANDONED_TTL_MS,
} from './matchReaper.js';

/**
 * A recording stub pool whose `query` captures each call and resolves to a fixed
 * `rowCount`, standing in for `pg.Pool` (the reaper only calls `query`).
 */
function makeRecordingPool(rowCount: number) {
  const calls: { text: string; params: unknown[] }[] = [];
  const pool = {
    calls,
    async query(text: string, params: unknown[]) {
      calls.push({ text, params });
      return { rowCount };
    },
  };
  return pool;
}

/**
 * Flushes the fire-and-forget reap promise chain after a mocked timer tick: a
 * real `setImmediate` macrotask drains the microtask queue (only `setInterval`
 * is mocked, so `setImmediate` still runs).
 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('matchReaper — reapStaleMatches (no database)', () => {
  test('locked constants match the WP-327 values', () => {
    assert.equal(MATCH_REAPER_INTERVAL_MS, 900_000);
    assert.equal(GAMEOVER_GRACE_MS, 3_600_000);
    assert.equal(ABANDONED_TTL_MS, 86_400_000);
  });

  test('issues one DELETE on bgio.matches with both interval params (seconds) and returns rowCount', async () => {
    const pool = makeRecordingPool(4);
    const deleted = await reapStaleMatches(pool as never, {
      gameoverGraceMs: GAMEOVER_GRACE_MS,
      abandonedTtlMs: ABANDONED_TTL_MS,
    });

    assert.equal(deleted, 4);
    assert.equal(pool.calls.length, 1);

    const { text, params } = pool.calls[0]!;
    assert.match(text, /DELETE FROM bgio\.matches/);
    assert.match(text, /jsonb_exists\(metadata, 'gameover'\)/);
    assert.match(text, /make_interval\(secs => \$1\)/);
    assert.match(text, /make_interval\(secs => \$2\)/);
    // why: the query takes seconds; 3_600_000ms -> 3600s, 86_400_000ms -> 86400s.
    assert.deepEqual(params, [3600, 86400]);
    // why: persistence-boundary guard (D-24095) — the reaper must never
    // reference a legendary.* domain table.
    assert.doesNotMatch(text, /legendary\./);
  });

  test('wraps a DB failure in a full-sentence, operation-named error', async () => {
    const failingPool = {
      async query() {
        throw new Error('connection refused');
      },
    };

    await assert.rejects(
      () =>
        reapStaleMatches(failingPool as never, {
          gameoverGraceMs: GAMEOVER_GRACE_MS,
          abandonedTtlMs: ABANDONED_TTL_MS,
        }),
      /matchReaper\.reapStaleMatches failed to delete stale matches from bgio\.matches.*connection refused/s,
    );
  });
});

describe('matchReaper — startMatchReaper (mock timers)', () => {
  test('runs an immediate reap, another after intervalMs, and none after stop()', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const pool = makeRecordingPool(0);

    const handle = startMatchReaper({
      database: pool as never,
      intervalMs: MATCH_REAPER_INTERVAL_MS,
      gameoverGraceMs: GAMEOVER_GRACE_MS,
      abandonedTtlMs: ABANDONED_TTL_MS,
    });

    // immediate startup reap
    await flushAsync();
    assert.equal(pool.calls.length, 1);

    // one interval later → a second reap
    t.mock.timers.tick(MATCH_REAPER_INTERVAL_MS);
    await flushAsync();
    assert.equal(pool.calls.length, 2);

    // after stop(), the next interval fires no further reap
    handle.stop();
    t.mock.timers.tick(MATCH_REAPER_INTERVAL_MS);
    await flushAsync();
    assert.equal(pool.calls.length, 2);
  });
});
