/**
 * Tests for the profile-loadout-library logic (WP-301 / EC-332).
 *
 * Pure tests (drift assertion, name validation, validator-path
 * failures that return before any DB call, and the slug-mint /
 * collision path against a fake DatabaseClient) always run. DB-required
 * tests (create / list / update / delete happy paths, the per-account
 * cap, visibility→slug transitions, cross-account isolation, the guest
 * read, and the updated_at bump) use node:test's options-based
 * non-silent skip when `process.env.TEST_DATABASE_URL` is unset —
 * mirroring the WP-104 `ownerProfile.logic.test.ts` skip parity.
 *
 * Layer-boundary: this test imports nothing from the engine runtime,
 * the registry runtime, or any UI package; only the loadout-library
 * modules, the identity account helper, `@legendary-arena/lagn`, and
 * `pg` (for the DB-backed cases).
 *
 * Authority: WP-301 §Scope (In) §G; EC-332 §Required Test Matrix;
 * D-24086.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoadout,
  deleteLoadout,
  getPublicLoadoutBySlug,
  listLoadouts,
  mintUniqueShareSlug,
  updateLoadout,
  validateLoadoutName,
} from './loadoutLibrary.logic.js';
import {
  LOADOUT_LIBRARY_ERROR_CODES,
  MAX_SAVED_LOADOUTS_PER_ACCOUNT,
  SHARE_SLUG_BYTES,
  type LoadoutLibraryErrorCode,
} from './loadoutLibrary.types.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId } from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: a minimal LAGN v1.0 document that passes @legendary-arena/lagn
// `validate`. Kept inline (not read from disk) so the test has no
// filesystem dependency; matches the lagn-spec tier1 example shape.
const VALID_LAGN = {
  lagn_version: '1.0.0',
  game_id: 'test-loadout-001',
  variant: 'solo',
  player_count: 1,
  setup: {
    mastermind: { id: 'thanos', name: 'Thanos' },
    scheme: { id: 'infinity-gems', name: 'The Infinity Gems Scheme' },
    villain_groups: [{ id: 'black-order', name: 'The Black Order' }],
    henchmen_groups: [{ id: 'aliens', name: 'Alien Drones' }],
    heroes: [
      { id: 'iron-man', name: 'Iron Man' },
      { id: 'captain-america', name: 'Captain America' },
    ],
    bystanders_count: 10,
    wounds_count: 5,
    shield_officers_count: 2,
    sidekicks_count: 3,
  },
};

const SUITE_RUN_ID = `wp301-${Date.now()}`;
let testCounter = 0;
function uniqueLabel(suffix: string): string {
  testCounter += 1;
  return `${SUITE_RUN_ID}-${testCounter}-${suffix}`;
}

function makeIdProvider(): () => string {
  const counter = { value: 0 };
  return () => {
    counter.value += 1;
    return `00000000-0000-4000-8000-${String(Date.now() % 1_000_000_000_000)
      .padStart(9, '0')}${String(counter.value).padStart(3, '0')}`;
  };
}

async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<AccountId> {
  const email = `${uniqueLabel(labelSuffix)}@example.com`;
  const authProviderId = `${uniqueLabel(labelSuffix)}-sub`;
  const result = await createPlayerAccount(
    {
      email,
      displayName: `Owner${labelSuffix}`,
      authProvider: 'email',
      authProviderId,
    },
    testPool,
    makeIdProvider(),
  );
  assert.ok(result.ok === true, 'createPlayerAccount must succeed');
  return result.value.accountId;
}

/**
 * A DatabaseClient stand-in whose `query` throws — proves a code path
 * returned before touching the database (validator-path assertions).
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('this code path must return before any database query');
  },
  connect: async () => {
    throw new Error('this code path must return before any pool.connect()');
  },
} as unknown as pg.Pool;

describe('profile loadout library logic (WP-301)', () => {
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

  test('LOADOUT_LIBRARY_ERROR_CODES matches LoadoutLibraryErrorCode union (forward and backward inclusion, no duplicates)', () => {
    const expected: ReadonlySet<LoadoutLibraryErrorCode> = new Set([
      'unauthorized',
      'not_found',
      'invalid_lagn',
      'invalid_name',
      'loadout_limit_reached',
      'empty_update',
    ]);
    assert.equal(LOADOUT_LIBRARY_ERROR_CODES.length, expected.size);
    assert.equal(
      new Set(LOADOUT_LIBRARY_ERROR_CODES).size,
      LOADOUT_LIBRARY_ERROR_CODES.length,
      'LOADOUT_LIBRARY_ERROR_CODES must contain no duplicates',
    );
    for (const code of LOADOUT_LIBRARY_ERROR_CODES) {
      assert.ok(expected.has(code), `unexpected code ${code} in array`);
    }
    for (const value of expected) {
      assert.ok(
        LOADOUT_LIBRARY_ERROR_CODES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test('locked constants: cap = 50, share-slug bytes = 16', () => {
    assert.equal(MAX_SAVED_LOADOUTS_PER_ACCOUNT, 50);
    assert.equal(SHARE_SLUG_BYTES, 16);
  });

  test('validateLoadoutName trims, accepts 1–80 chars, rejects empty-after-trim / over-80 / non-string', () => {
    const trimmed = validateLoadoutName('  My Deck  ');
    assert.ok(trimmed.ok === true);
    assert.equal(trimmed.value, 'My Deck');

    const empty = validateLoadoutName('   ');
    assert.ok(empty.ok === false);
    assert.equal((empty as { code: string }).code, 'invalid_name');

    const over = validateLoadoutName('x'.repeat(81));
    assert.ok(over.ok === false);
    assert.equal((over as { code: string }).code, 'invalid_name');

    const exactly80 = validateLoadoutName('x'.repeat(80));
    assert.ok(exactly80.ok === true);

    const nonString = validateLoadoutName(42);
    assert.ok(nonString.ok === false);
    assert.equal((nonString as { code: string }).code, 'invalid_name');
  });

  test('createLoadout rejects malformed LAGN with invalid_lagn before any DB access', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await createLoadout(
      accountId,
      { name: 'Valid Name', lagn: { not: 'a lagn document' } },
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'invalid_lagn');
  });

  test('createLoadout rejects an empty name with invalid_name before validating LAGN or touching the DB', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await createLoadout(
      accountId,
      { name: '   ', lagn: VALID_LAGN },
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'invalid_name');
  });

  test('updateLoadout rejects a no-field PATCH with empty_update before any DB access', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await updateLoadout(
      accountId,
      '00000000-0000-4000-8000-000000000abc',
      {},
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'empty_update');
  });

  test('updateLoadout rejects a malformed :id with not_found (no DB, no existence leak)', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await updateLoadout(
      accountId,
      'not-a-uuid',
      { visibility: 'public' },
      throwingDatabase,
    );
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'not_found');
  });

  test('deleteLoadout rejects a malformed :id with not_found (no DB, no existence leak)', async () => {
    const accountId = '00000000-0000-4000-8000-000000000000' as AccountId;
    const result = await deleteLoadout(accountId, 'not-a-uuid', throwingDatabase);
    assert.ok(result.ok === false);
    assert.equal((result as { code: string }).code, 'not_found');
  });

  test('mintUniqueShareSlug default generator yields a 22-char base64url opaque slug', async () => {
    // why: a fake DB whose slug-collision probe always misses forces the
    // minter through exactly one default-generator call.
    const alwaysFreeDatabase = {
      query: async () => ({ rows: [] as unknown[] }),
    } as unknown as pg.Pool;
    const slug = await mintUniqueShareSlug(alwaysFreeDatabase);
    assert.equal(slug.length, 22);
    assert.match(
      slug,
      /^[A-Za-z0-9_-]+$/,
      'a base64url slug must contain only URL-safe characters (no +, /, or =)',
    );
  });

  test('mintUniqueShareSlug retries on collision and returns the first free candidate', async () => {
    const candidates = ['colliding-slug', 'unique-slug'];
    let callIndex = 0;
    const generator = () => {
      const value = candidates[callIndex] ?? 'exhausted';
      callIndex += 1;
      return value;
    };
    // why: the fake DB reports the first candidate as taken (one row) and
    // the second as free (no rows), exercising the collision-retry loop.
    const scriptedDatabase = {
      query: async (_sql: string, params: unknown[]) => {
        const probed = params[0];
        return probed === 'colliding-slug'
          ? { rows: [{ exists: 1 }] }
          : { rows: [] as unknown[] };
      },
    } as unknown as pg.Pool;
    const slug = await mintUniqueShareSlug(scriptedDatabase, generator);
    assert.equal(slug, 'unique-slug');
    assert.equal(callIndex, 2, 'the generator must have been called twice');
  });

  test(
    'createLoadout inserts a private row scoped to the caller; listLoadouts returns it (whitespace-padded name stored trimmed)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'create');
      const created = await createLoadout(
        accountId,
        { name: '  Trimmed Deck  ', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(created.ok === true);
      assert.equal(created.value.name, 'Trimmed Deck');
      assert.equal(created.value.visibility, 'private');
      assert.equal(created.value.shareSlug, null);
      assert.deepEqual(created.value.lagn, VALID_LAGN);

      const listed = await listLoadouts(accountId, testPool);
      assert.ok(listed.ok === true);
      assert.equal(listed.value.length, 1);
      assert.equal(listed.value[0].id, created.value.id);
      assert.equal(listed.value[0].name, 'Trimmed Deck');
    },
  );

  test(
    'listLoadouts returns only the caller rows ordered updated_at DESC',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'order');
      const first = await createLoadout(
        accountId,
        { name: 'First', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(first.ok === true);
      await new Promise((resolve) => setTimeout(resolve, 25));
      const second = await createLoadout(
        accountId,
        { name: 'Second', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(second.ok === true);

      const listed = await listLoadouts(accountId, testPool);
      assert.ok(listed.ok === true);
      assert.equal(listed.value.length, 2);
      // most-recently-created first (updated_at DESC)
      assert.equal(listed.value[0].name, 'Second');
      assert.equal(listed.value[1].name, 'First');
    },
  );

  test(
    'createLoadout rejects the 51st create with loadout_limit_reached',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'cap');
      const playerIdResult = await testPool.query(
        'SELECT player_id FROM legendary.players WHERE ext_id = $1',
        [accountId],
      );
      const playerId = playerIdResult.rows[0].player_id;
      // why: seed exactly 50 rows in one statement (this is our own new
      // table, not a WP-104-locked one) so the 51st create hits the cap
      // without 50 round-trips.
      await testPool.query(
        'INSERT INTO legendary.player_loadouts (player_id, name, lagn_json) ' +
          "SELECT $1, 'seed-' || generated, $2::jsonb " +
          'FROM generate_series(1, 50) AS generated',
        [playerId, JSON.stringify(VALID_LAGN)],
      );
      const overCap = await createLoadout(
        accountId,
        { name: 'One Too Many', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(overCap.ok === false);
      assert.equal((overCap as { code: string }).code, 'loadout_limit_reached');
    },
  );

  test(
    'updateLoadout: private→public mints a slug, public→public preserves it, →private clears it; updated_at advances',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'slug');
      const created = await createLoadout(
        accountId,
        { name: 'Shareable', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(created.ok === true);
      const loadoutId = created.value.id;
      const createdUpdatedAt = created.value.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 25));

      // private→public: mint a slug
      const madePublic = await updateLoadout(
        accountId,
        loadoutId,
        { visibility: 'public' },
        testPool,
      );
      assert.ok(madePublic.ok === true);
      assert.equal(madePublic.value.visibility, 'public');
      assert.notEqual(madePublic.value.shareSlug, null);
      assert.equal((madePublic.value.shareSlug as string).length, 22);
      assert.ok(
        Date.parse(madePublic.value.updatedAt) > Date.parse(createdUpdatedAt),
        'updated_at must advance on a real PATCH',
      );
      const firstSlug = madePublic.value.shareSlug;

      // public→public (rename only): preserve the same slug
      const renamed = await updateLoadout(
        accountId,
        loadoutId,
        { name: 'Renamed Still Public' },
        testPool,
      );
      assert.ok(renamed.ok === true);
      assert.equal(renamed.value.visibility, 'public');
      assert.equal(
        renamed.value.shareSlug,
        firstSlug,
        'a public→public PATCH must preserve the existing share slug',
      );

      // public→private: clear the slug
      const madePrivate = await updateLoadout(
        accountId,
        loadoutId,
        { visibility: 'private' },
        testPool,
      );
      assert.ok(madePrivate.ok === true);
      assert.equal(madePrivate.value.visibility, 'private');
      assert.equal(madePrivate.value.shareSlug, null);
    },
  );

  test(
    'getPublicLoadoutBySlug returns public-only projection; private/missing slug → not_found',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'guest');
      const created = await createLoadout(
        accountId,
        { name: 'Public Deck', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(created.ok === true);

      // while private, the (yet-unminted) slug read misses
      const missing = await getPublicLoadoutBySlug('no-such-slug', testPool);
      assert.ok(missing.ok === false);
      assert.equal((missing as { code: string }).code, 'not_found');

      const madePublic = await updateLoadout(
        accountId,
        created.value.id,
        { visibility: 'public' },
        testPool,
      );
      assert.ok(madePublic.ok === true);
      const slug = madePublic.value.shareSlug as string;

      const publicRead = await getPublicLoadoutBySlug(slug, testPool);
      assert.ok(publicRead.ok === true);
      assert.equal(publicRead.value.name, 'Public Deck');
      assert.deepEqual(publicRead.value.lagn, VALID_LAGN);
      // no handle claimed → displayHandle falls back to display_name
      assert.equal(publicRead.value.displayHandle, 'Ownerguest');
      // the public projection must not leak account identifiers
      assert.ok(!('accountId' in publicRead.value));
      assert.ok(!('displayName' in publicRead.value));

      // flip back to private → the slug read must now miss
      await updateLoadout(
        accountId,
        created.value.id,
        { visibility: 'private' },
        testPool,
      );
      const afterPrivate = await getPublicLoadoutBySlug(slug, testPool);
      assert.ok(afterPrivate.ok === false);
      assert.equal((afterPrivate as { code: string }).code, 'not_found');
    },
  );

  test(
    'cross-account isolation: account B cannot read/update/delete account A rows by id',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountA = await provisionAccount(testPool, 'isoA');
      const accountB = await provisionAccount(testPool, 'isoB');
      const created = await createLoadout(
        accountA,
        { name: 'A Deck', lagn: VALID_LAGN },
        testPool,
      );
      assert.ok(created.ok === true);
      const idOwnedByA = created.value.id;

      const bUpdate = await updateLoadout(
        accountB,
        idOwnedByA,
        { name: 'Hijacked' },
        testPool,
      );
      assert.ok(bUpdate.ok === false);
      assert.equal((bUpdate as { code: string }).code, 'not_found');

      const bDelete = await deleteLoadout(accountB, idOwnedByA, testPool);
      assert.ok(bDelete.ok === false);
      assert.equal((bDelete as { code: string }).code, 'not_found');

      // account A still owns the untouched row
      const aList = await listLoadouts(accountA, testPool);
      assert.ok(aList.ok === true);
      assert.equal(aList.value.length, 1);
      assert.equal(aList.value[0].name, 'A Deck');

      // account A can delete its own row
      const aDelete = await deleteLoadout(accountA, idOwnedByA, testPool);
      assert.ok(aDelete.ok === true);
    },
  );
});
