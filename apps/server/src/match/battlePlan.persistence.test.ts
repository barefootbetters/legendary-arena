/**
 * Tests for the Battle Plan persistence layer (WP-635 / EC-670).
 *
 * DB-gated: every test needs a real Postgres, so each is non-silently skipped when
 * `process.env.TEST_DATABASE_URL` is unset (the WP-052 §3.1 pattern; mirrors
 * `feedback.persistence.test.ts`). Run serialized (`--test-concurrency=1`) against a
 * shared local Postgres so this file does not race other DB-gated suites
 * (reference: db-gated-test-serialization).
 *
 * Each test provisions its own unique match_id (a per-run id namespace, no shared
 * fixtures), so the tests are order-independent and never collide across repeated
 * runs. `battle_plan.match_id` and `updated_by_ext_id` are plain text with no FK, so
 * synthetic ids are sufficient — no match/account provisioning required.
 *
 * Covers: first-write insert, the ON CONFLICT per-column upsert (writing one phase
 * preserves the other two), read round-trip, and the read-miss null.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  readBattlePlan,
  upsertBattlePlanPhase,
} from './battlePlan.persistence.js';
import type { DatabaseClient } from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: a per-run id namespace guarantees row uniqueness across repeated test runs
// without a beforeEach cleanup — the shared-local-Postgres pattern. Date.now() is a
// server test file (not engine code), so wall-clock use is permitted here.
const RUN_ID = `wp635-${Date.now()}`;
const EDITOR_A = `${RUN_ID}-editor-a`;
const EDITOR_B = `${RUN_ID}-editor-b`;

describe('battle plan persistence (WP-635)', () => {
  let testPool: pg.Pool | null = null;

  before(() => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
    }
  });

  test(
    'first write inserts a row with only the written phase populated',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const matchId = `${RUN_ID}-insert`;

      const record = await upsertBattlePlanPhase(
        matchId,
        'pre_battle',
        'read the mastermind',
        EDITOR_A,
        database,
      );
      assert.equal(record.matchId, matchId);
      assert.equal(record.preBattle, 'read the mastermind');
      assert.equal(record.battleAdjustments, null);
      assert.equal(record.postBattle, null);
      assert.equal(record.updatedByExtId, EDITOR_A);
    },
  );

  test(
    'a second write to a different phase preserves the other two (per-column upsert)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const matchId = `${RUN_ID}-preserve`;

      await upsertBattlePlanPhase(matchId, 'pre_battle', 'plan A', EDITOR_A, database);
      const afterSecond = await upsertBattlePlanPhase(
        matchId,
        'battle_adjustments',
        'adjust B',
        EDITOR_B,
        database,
      );

      // why: writing battle_adjustments must NOT clear pre_battle — the ON CONFLICT
      // branch sets only the one phase column (the whole point of the per-column
      // upsert). post_battle stays null (never written).
      assert.equal(afterSecond.preBattle, 'plan A');
      assert.equal(afterSecond.battleAdjustments, 'adjust B');
      assert.equal(afterSecond.postBattle, null);
      assert.equal(afterSecond.updatedByExtId, EDITOR_B);

      // A third write to the same phase overwrites just that phase.
      const afterThird = await upsertBattlePlanPhase(
        matchId,
        'battle_adjustments',
        'adjust B2',
        EDITOR_A,
        database,
      );
      assert.equal(afterThird.preBattle, 'plan A');
      assert.equal(afterThird.battleAdjustments, 'adjust B2');
    },
  );

  test(
    'an empty-string write clears a previously-set phase',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const matchId = `${RUN_ID}-clear`;

      await upsertBattlePlanPhase(matchId, 'post_battle', 'what worked', EDITOR_A, database);
      const cleared = await upsertBattlePlanPhase(
        matchId,
        'post_battle',
        '',
        EDITOR_A,
        database,
      );
      assert.equal(cleared.postBattle, '');
    },
  );

  test(
    'readBattlePlan round-trips the current document',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const matchId = `${RUN_ID}-read`;

      await upsertBattlePlanPhase(matchId, 'pre_battle', 'p', EDITOR_A, database);
      await upsertBattlePlanPhase(matchId, 'post_battle', 'q', EDITOR_B, database);

      const read = await readBattlePlan(matchId, database);
      assert.ok(read !== null);
      assert.equal(read?.matchId, matchId);
      assert.equal(read?.preBattle, 'p');
      assert.equal(read?.battleAdjustments, null);
      assert.equal(read?.postBattle, 'q');
    },
  );

  test(
    'readBattlePlan returns null for a match with no plan row',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const read = await readBattlePlan(`${RUN_ID}-absent`, database);
      assert.equal(read, null);
    },
  );
});
