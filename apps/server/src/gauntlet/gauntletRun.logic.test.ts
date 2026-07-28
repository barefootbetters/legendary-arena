/**
 * Tests for the gauntlet run import + run-CRUD logic (WP-445 / EC-480).
 *
 * Pure tests (the error-code drift assertion, the pack / existence / legPicks
 * validation paths that return before any DB call, and the malformed-id guard)
 * always run. DB-required tests (import-creates-one, re-import-attaches, PATCH
 * updates + updated_at advances, DELETE removes, cross-account isolation) use
 * node:test's options-based non-silent skip when `process.env.TEST_DATABASE_URL`
 * is unset — mirroring the WP-301 `loadoutLibrary.logic.test.ts` skip parity so
 * an unrun contract is a VISIBLE skip, never a silent pass.
 *
 * Layer-boundary: this test imports nothing from the engine runtime, preplan,
 * boardgame.io, or any UI package; only the gauntlet-run modules, the identity
 * account helper, and `pg` (for the DB-backed cases). Gauntlet existence is
 * supplied as an injected fake resolver, never a real registry catalog.
 *
 * Authority: WP-445 §Acceptance Criteria; EC-480 §Files to Produce; D-24264.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  deleteGauntletRun,
  importGauntletRun,
  listGauntletRuns,
  updateGauntletRunLegPicks,
  validateLegPicksShape,
} from './gauntletRun.logic.js';
import {
  GAUNTLET_RUN_ERROR_CODES,
  type GauntletExistenceResolver,
  type GauntletRunErrorCode,
} from './gauntletRun.types.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId } from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: a resolver that reports every gauntlet as existing — the happy-path
// import injection. The logic layer never consults the registry itself, so a
// fake resolver fully substitutes for the startup catalog in these tests.
const gauntletAlwaysExists: GauntletExistenceResolver = () => true;

// why: a resolver that reports no gauntlet as existing — exercises the
// unknown_gauntlet (422) branch.
const gauntletNeverExists: GauntletExistenceResolver = () => false;

/**
 * A minimal valid WP-440 gauntlet identity pack (passes `validateGauntletPack`).
 * Kept inline so the test has no filesystem dependency.
 */
function validGauntletPack(): unknown {
  return {
    pack_version: 1,
    gauntlet: {
      setAbbr: 'core',
      mastermindSlug: 'magneto',
      division: 'fixed',
      playerCount: 1,
    },
  };
}

const SUITE_RUN_ID = `wp445-${Date.now()}`;
let testCounter = 0;
function uniqueLabel(suffix: string): string {
  testCounter += 1;
  return `${SUITE_RUN_ID}-${testCounter}-${suffix}`;
}

async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<AccountId> {
  const email = `${uniqueLabel(labelSuffix)}@example.com`;
  const authProviderId = `${uniqueLabel(labelSuffix)}-sub`;
  // why: randomUUID gives each account a globally unique ext_id; a
  // Date.now()-derived id collides when two accounts are provisioned in the
  // same millisecond, tripping the ext_id UNIQUE constraint.
  const result = await createPlayerAccount(
    {
      email,
      displayName: `Runner${labelSuffix}`,
      authProvider: 'email',
      authProviderId,
    },
    testPool,
    randomUUID,
  );
  assert.ok(result.ok === true, 'createPlayerAccount must succeed');
  return result.value.accountId;
}

/**
 * A DatabaseClient stand-in whose `query` throws — proves a code path returned
 * before touching the database (validation-path assertions).
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('this code path must return before any database query');
  },
  connect: async () => {
    throw new Error('this code path must return before any pool.connect()');
  },
} as unknown as pg.Pool;

describe('gauntlet run import + run-CRUD logic (WP-445)', () => {
  let testPool: pg.Pool | null = null;

  before(async () => {
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

  test('GAUNTLET_RUN_ERROR_CODES matches GauntletRunErrorCode union (forward and backward inclusion, no duplicates)', () => {
    const expected: ReadonlySet<GauntletRunErrorCode> = new Set([
      'unauthorized',
      'account_suspended',
      'invalid_pack',
      'unknown_gauntlet',
      'invalid_leg_picks',
      'not_found',
    ]);
    assert.equal(GAUNTLET_RUN_ERROR_CODES.length, expected.size);
    assert.equal(
      new Set(GAUNTLET_RUN_ERROR_CODES).size,
      GAUNTLET_RUN_ERROR_CODES.length,
      'GAUNTLET_RUN_ERROR_CODES must contain no duplicates',
    );
    for (const code of GAUNTLET_RUN_ERROR_CODES) {
      assert.ok(expected.has(code), `unexpected code ${code} in array`);
    }
    for (const value of expected) {
      assert.ok(
        GAUNTLET_RUN_ERROR_CODES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test('validateLegPicksShape accepts an object of string→string[]; rejects null / array / non-string values', () => {
    const empty = validateLegPicksShape({});
    assert.ok(empty.ok === true);
    assert.deepEqual(empty.value, {});

    const valid = validateLegPicksShape({
      'the-mutant-uprising': ['core/spider-man', 'core/cyclops'],
    });
    assert.ok(valid.ok === true);

    const nullValue = validateLegPicksShape(null);
    assert.ok(nullValue.ok === false);
    assert.equal((nullValue as { code: string }).code, 'invalid_leg_picks');

    const arrayValue = validateLegPicksShape(['not', 'an', 'object']);
    assert.ok(arrayValue.ok === false);
    assert.equal((arrayValue as { code: string }).code, 'invalid_leg_picks');

    const nonArrayEntry = validateLegPicksShape({ scheme: 'not-an-array' });
    assert.ok(nonArrayEntry.ok === false);
    assert.equal((nonArrayEntry as { code: string }).code, 'invalid_leg_picks');

    const nonStringElement = validateLegPicksShape({ scheme: [42] });
    assert.ok(nonStringElement.ok === false);
    assert.equal(
      (nonStringElement as { code: string }).code,
      'invalid_leg_picks',
    );
  });

  test('importGauntletRun rejects a malformed pack with invalid_pack before any DB access', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await importGauntletRun(
      accountId,
      { pack: { not: 'a gauntlet pack' } },
      throwingDatabase,
      gauntletAlwaysExists,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'invalid_pack');
  });

  test('importGauntletRun rejects an unknown gauntlet with unknown_gauntlet before any DB access', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await importGauntletRun(
      accountId,
      { pack: validGauntletPack() },
      throwingDatabase,
      gauntletNeverExists,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'unknown_gauntlet');
  });

  test('updateGauntletRunLegPicks rejects malformed legPicks with invalid_leg_picks before any DB access', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await updateGauntletRunLegPicks(
      accountId,
      '00000000-0000-4000-8000-000000000abc',
      { legPicks: 'not-an-object' },
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'invalid_leg_picks');
  });

  test('updateGauntletRunLegPicks rejects a malformed :id with not_found (no DB, no existence leak)', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await updateGauntletRunLegPicks(
      accountId,
      'not-a-uuid',
      { legPicks: {} },
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'not_found');
  });

  test('deleteGauntletRun rejects a malformed :id with not_found (no DB, no existence leak)', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await deleteGauntletRun(
      accountId,
      'not-a-uuid',
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'not_found');
  });

  test(
    'importGauntletRun creates one active run with empty leg_picks; listGauntletRuns returns it',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'create');
      const imported = await importGauntletRun(
        accountId,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(imported.ok === true);
      assert.equal(imported.value.wasCreated, true);
      assert.equal(imported.value.view.setAbbr, 'core');
      assert.equal(imported.value.view.mastermindSlug, 'magneto');
      assert.equal(imported.value.view.division, 'fixed');
      assert.equal(imported.value.view.playerCount, 1);
      assert.deepEqual(imported.value.view.legPicks, {});
      assert.equal(imported.value.view.firstCompletedAt, null);

      const listed = await listGauntletRuns(accountId, testPool);
      assert.ok(listed.ok === true);
      assert.equal(listed.value.length, 1);
      assert.equal(listed.value[0].id, imported.value.view.id);
      // the raw GET carries no derived-projection keys (D-24262)
      assert.ok(!('status' in listed.value[0]));
      assert.ok(!('pool' in listed.value[0]));
      assert.ok(!('headroom' in listed.value[0]));
    },
  );

  test(
    're-importing the same identity attaches to the existing active run (200, one row)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'reimport');
      const first = await importGauntletRun(
        accountId,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(first.ok === true);
      assert.equal(first.value.wasCreated, true);

      const second = await importGauntletRun(
        accountId,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(second.ok === true);
      // why: D-24264 — the partial-unique conflict is caught and resolved to the
      // existing active run (wasCreated false → the route returns 200), never a
      // 409/500.
      assert.equal(second.value.wasCreated, false);
      assert.equal(second.value.view.id, first.value.view.id);

      const listed = await listGauntletRuns(accountId, testPool);
      assert.ok(listed.ok === true);
      assert.equal(listed.value.length, 1);
    },
  );

  test(
    'updateGauntletRunLegPicks updates leg_picks and advances updated_at',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'patch');
      const imported = await importGauntletRun(
        accountId,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(imported.ok === true);
      const runId = imported.value.view.id;
      const createdUpdatedAt = imported.value.view.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 25));

      const picks = {
        'the-mutant-uprising': ['core/spider-man', 'core/cyclops'],
      };
      const updated = await updateGauntletRunLegPicks(
        accountId,
        runId,
        { legPicks: picks },
        testPool,
      );
      assert.ok(updated.ok === true);
      assert.deepEqual(updated.value.legPicks, picks);
      assert.ok(
        Date.parse(updated.value.updatedAt) > Date.parse(createdUpdatedAt),
        'updated_at must advance on a real PATCH',
      );
    },
  );

  test(
    'deleteGauntletRun removes the caller row',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'delete');
      const imported = await importGauntletRun(
        accountId,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(imported.ok === true);

      const deleted = await deleteGauntletRun(
        accountId,
        imported.value.view.id,
        testPool,
      );
      assert.ok(deleted.ok === true);

      const listed = await listGauntletRuns(accountId, testPool);
      assert.ok(listed.ok === true);
      assert.equal(listed.value.length, 0);
    },
  );

  test(
    'cross-account isolation: account B cannot PATCH or DELETE account A runs by id',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountA = await provisionAccount(testPool, 'isoA');
      const accountB = await provisionAccount(testPool, 'isoB');
      const imported = await importGauntletRun(
        accountA,
        { pack: validGauntletPack() },
        testPool,
        gauntletAlwaysExists,
      );
      assert.ok(imported.ok === true);
      const idOwnedByA = imported.value.view.id;

      const bPatch = await updateGauntletRunLegPicks(
        accountB,
        idOwnedByA,
        { legPicks: { scheme: ['core/hijacked'] } },
        testPool,
      );
      assert.ok(bPatch.ok === false);
      assert.equal((bPatch as { code: string }).code, 'not_found');

      const bDelete = await deleteGauntletRun(accountB, idOwnedByA, testPool);
      assert.ok(bDelete.ok === false);
      assert.equal((bDelete as { code: string }).code, 'not_found');

      // account A still owns the untouched run
      const aList = await listGauntletRuns(accountA, testPool);
      assert.ok(aList.ok === true);
      assert.equal(aList.value.length, 1);

      // account A can delete its own run
      const aDelete = await deleteGauntletRun(accountA, idOwnedByA, testPool);
      assert.ok(aDelete.ok === true);
    },
  );
});
