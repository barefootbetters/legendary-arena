/**
 * Tests for the replay storage logic (WP-103).
 *
 * Five tests inside one describe block per WP-103 §G / EC-111 §Test
 * Plan. One logic-pure test always runs (DB-stubbed null-on-miss);
 * four DB-dependent tests use node:test's non-silent skip option
 * when `process.env.TEST_DATABASE_URL` is unset (the locked WP-052
 * §3.1 inline-conditional reconciliation pattern).
 *
 * All ReplayInput fixtures are inline literals — no imports from
 * apps/replay-producer/samples/ or any other cross-app source (F-3
 * lock from WP-103 pre-flight; cross-app fixture coupling is a
 * layer-boundary smell).
 *
 * Authority: WP-103 §G; EC-111 §Test Plan; WP-052 §3.1 post-mortem
 * (skip-pattern reconciliation locked verbatim).
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { storeReplay, loadReplay } from './replay.logic.js';
import type { ReplayInput, DatabaseClient } from './replay.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: inline literal fixture covering all four ReplayInput fields
// (seed, setupConfig with the 9-field MatchSetupConfig lock,
// playerOrder, moves). The exact card ext_ids are well-formed at the
// type level but are not validated for runtime existence —
// legendary.replay_blobs does not validate ReplayInput content; that
// is WP-053's caller-side responsibility per WP-103 §Out of Scope.
// F-3 lock: no import from apps/replay-producer/samples/.
const SAMPLE_REPLAY_INPUT: ReplayInput = {
  seed: 'wp-103-test-seed-deterministic',
  setupConfig: {
    schemeId: 'core-midnights-children',
    mastermindId: 'core-loki',
    villainGroupIds: ['core-brotherhood'],
    henchmanGroupIds: ['core-savage-land-mutates'],
    heroDeckIds: [
      'core-spider-man',
      'core-cyclops',
      'core-storm',
      'core-wolverine',
      'core-hulk',
    ],
    bystandersCount: 1,
    woundsCount: 30,
    officersCount: 5,
    sidekicksCount: 12,
  },
  playerOrder: ['p1', 'p2'],
  moves: [
    { playerId: 'p1', moveName: 'drawCards', args: { count: 6 } },
    { playerId: 'p1', moveName: 'endTurn', args: {} },
  ],
};

const SAMPLE_REPLAY_HASH =
  'sha256:wp-103-test-deterministic-hash-value';

describe('replay storage logic (WP-103)', () => {
  let testPool: pg.Pool | null = null;

  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
      });
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
    }
  });

  beforeEach(async () => {
    if (testPool !== null) {
      await testPool.query('DELETE FROM legendary.replay_blobs');
    }
  });

  test('loadReplay returns null for an unknown replayHash', async () => {
    // why: stub DatabaseClient — exercises loadReplay's null-on-miss
    // decision logic without performing real I/O. No pg.Pool needed,
    // so this test always runs regardless of TEST_DATABASE_URL.
    const stubDatabase = {
      query: async () => ({ rows: [] }),
    } as unknown as DatabaseClient;

    const result = await loadReplay('nonexistent-hash', stubDatabase);
    assert.strictEqual(result, null);
  });

  test(
    'storeReplay → loadReplay round-trip preserves ReplayInput shape',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);

      await storeReplay(
        SAMPLE_REPLAY_HASH,
        SAMPLE_REPLAY_INPUT,
        testPool,
      );
      const loaded = await loadReplay(SAMPLE_REPLAY_HASH, testPool);

      assert.deepEqual(loaded, SAMPLE_REPLAY_INPUT);
    },
  );

  test(
    'storeReplay is idempotent — second call with same args is a no-op',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);

      await storeReplay(
        SAMPLE_REPLAY_HASH,
        SAMPLE_REPLAY_INPUT,
        testPool,
      );
      await storeReplay(
        SAMPLE_REPLAY_HASH,
        SAMPLE_REPLAY_INPUT,
        testPool,
      );

      const countResult = await testPool.query(
        'SELECT count(*) AS row_count FROM legendary.replay_blobs ' +
          'WHERE replay_hash = $1',
        [SAMPLE_REPLAY_HASH],
      );
      const rowCount = Number(countResult.rows[0].row_count);
      assert.strictEqual(rowCount, 1);
    },
  );

  test(
    'loadReplay for unknown replayHash returns null against real DB',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);

      const result = await loadReplay(
        'sha256:wp-103-test-row-was-never-inserted',
        testPool,
      );
      assert.strictEqual(result, null);
    },
  );

  test(
    'storeReplay accepts the locked ReplayInput shape with all four fields populated',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);

      await storeReplay(
        SAMPLE_REPLAY_HASH,
        SAMPLE_REPLAY_INPUT,
        testPool,
      );
      const loaded = await loadReplay(SAMPLE_REPLAY_HASH, testPool);
      assert.ok(loaded !== null);

      assert.strictEqual(loaded.seed, SAMPLE_REPLAY_INPUT.seed);
      assert.deepEqual(loaded.setupConfig, SAMPLE_REPLAY_INPUT.setupConfig);
      assert.deepEqual(loaded.playerOrder, SAMPLE_REPLAY_INPUT.playerOrder);
      assert.deepEqual(loaded.moves, SAMPLE_REPLAY_INPUT.moves);
    },
  );
});
