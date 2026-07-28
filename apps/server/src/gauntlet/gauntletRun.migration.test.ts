/**
 * DB-gated migration test for the gauntlet run workspace
 * (WP-443 / EC-478 / D-24262): `legendary.player_gauntlet_runs`.
 *
 * These tests require a migrated `TEST_DATABASE_URL`. When it is unset they
 * skip LOUDLY via node:test's options-based skip (`{ skip: '<reason>' }`) —
 * never a bare early return that would report a silent green. The local
 * harness applies migrations via `psql` before the run (mirrors
 * `project_db_backed_server_tests_local`); CI without a test DB skips them and
 * the migration auto-applies at deploy.
 *
 * Coverage: the table + its ten columns + both indexes exist; a second ACTIVE
 * run of the same identity is blocked by the partial-unique index but ALLOWED
 * once the first run's `first_completed_at` is stamped; the `division` and
 * `player_count` CHECKs reject bad values; deleting the `legendary.players` row
 * CASCADEs to remove the player's runs.
 *
 * Per-suite-run uniqueness: every provisioned account uses `email` /
 * `authProviderId` values prefixed by a per-suite-run identifier so repeated
 * runs never collide on `legendary.players`' UNIQUE constraints; provisioned
 * players are removed in an `after` hook.
 *
 * Authority: WP-443 §Scope (In); EC-478 §Files to Produce; the friendships /
 * loadout DB-gated harness precedent.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId } from '../identity/identity.types.js';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const SUITE_RUN_ID = `wp443-${Date.now()}`;
let testCounter = 0;
function uniqueLabel(suffix: string): string {
  testCounter += 1;
  return `${SUITE_RUN_ID}-${testCounter}-${suffix}`;
}

/**
 * Provision a fresh player account and return its `AccountId` (the `ext_id`).
 * Each account uses globally unique `email` / `authProviderId` / `ext_id`
 * values so repeated suite runs never collide on the UNIQUE constraints.
 */
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
 * Resolve the internal `bigint` `player_id` for a provisioned account. The
 * migration test operates at the SQL level, so it needs the FK target rather
 * than the `ext_id` / `AccountId` the application layer uses. `pg` returns the
 * `bigint` as a string.
 */
async function resolvePlayerId(
  testPool: pg.Pool,
  accountId: AccountId,
): Promise<string> {
  const result = await testPool.query<{ player_id: string }>(
    'SELECT player_id FROM legendary.players WHERE ext_id = $1',
    [accountId],
  );
  assert.equal(result.rows.length, 1, 'provisioned player must resolve');
  return result.rows[0].player_id;
}

/**
 * Insert one active gauntlet run for a player with the given identity and
 * return the new row id. `first_completed_at` is left NULL (an active run).
 */
async function insertActiveRun(
  testPool: pg.Pool,
  playerId: string,
  identity: {
    setAbbr: string;
    mastermindSlug: string;
    division: string;
    playerCount: number;
  },
): Promise<string> {
  const result = await testPool.query<{ id: string }>(
    `INSERT INTO legendary.player_gauntlet_runs
       (player_id, set_abbr, mastermind_slug, division, player_count)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      playerId,
      identity.setAbbr,
      identity.mastermindSlug,
      identity.division,
      identity.playerCount,
    ],
  );
  assert.equal(result.rows.length, 1, 'active run insert must return an id');
  return result.rows[0].id;
}

describe('gauntlet run persistence migration (WP-443)', () => {
  let testPool: pg.Pool | null = null;
  const provisionedPlayerIds: string[] = [];

  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      // why: deleting the player CASCADEs to its gauntlet runs, so cleaning up
      // provisioned players is sufficient to leave the test DB pristine.
      for (const playerId of provisionedPlayerIds) {
        await testPool.query(
          'DELETE FROM legendary.players WHERE player_id = $1',
          [playerId],
        );
      }
      await testPool.end();
      testPool = null;
    }
  });

  test(
    'table exists with all ten columns and the expected nullability',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const result = await testPool.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'legendary'
            AND table_name = 'player_gauntlet_runs'`,
      );
      const byName = new Map<string, { dataType: string; isNullable: string }>();
      for (const row of result.rows) {
        byName.set(row.column_name, {
          dataType: row.data_type,
          isNullable: row.is_nullable,
        });
      }

      const expected: ReadonlyArray<{
        name: string;
        dataType: string;
        isNullable: string;
      }> = [
        { name: 'id', dataType: 'uuid', isNullable: 'NO' },
        { name: 'player_id', dataType: 'bigint', isNullable: 'NO' },
        { name: 'set_abbr', dataType: 'text', isNullable: 'NO' },
        { name: 'mastermind_slug', dataType: 'text', isNullable: 'NO' },
        { name: 'division', dataType: 'text', isNullable: 'NO' },
        { name: 'player_count', dataType: 'smallint', isNullable: 'NO' },
        { name: 'leg_picks', dataType: 'jsonb', isNullable: 'NO' },
        {
          name: 'created_at',
          dataType: 'timestamp with time zone',
          isNullable: 'NO',
        },
        {
          name: 'updated_at',
          dataType: 'timestamp with time zone',
          isNullable: 'NO',
        },
        {
          name: 'first_completed_at',
          dataType: 'timestamp with time zone',
          isNullable: 'YES',
        },
      ];

      assert.equal(
        byName.size,
        expected.length,
        'table must have exactly ten columns',
      );
      for (const column of expected) {
        const actual = byName.get(column.name);
        assert.ok(actual !== undefined, `column ${column.name} must exist`);
        assert.equal(
          actual.dataType,
          column.dataType,
          `column ${column.name} must be ${column.dataType}`,
        );
        assert.equal(
          actual.isNullable,
          column.isNullable,
          `column ${column.name} nullability must be ${column.isNullable}`,
        );
      }
    },
  );

  test(
    'both indexes exist, including the partial-unique active-run predicate',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const result = await testPool.query<{
        indexname: string;
        indexdef: string;
      }>(
        `SELECT indexname, indexdef
           FROM pg_indexes
          WHERE schemaname = 'legendary'
            AND tablename = 'player_gauntlet_runs'`,
      );
      const byName = new Map<string, string>();
      for (const row of result.rows) {
        byName.set(row.indexname, row.indexdef);
      }

      const activeIndex = byName.get('player_gauntlet_runs_active_identity_uidx');
      assert.ok(activeIndex !== undefined, 'partial-unique index must exist');
      assert.ok(
        activeIndex.includes('UNIQUE'),
        'active-run index must be UNIQUE',
      );
      assert.ok(
        activeIndex.includes('first_completed_at IS NULL'),
        'active-run index must carry the first_completed_at IS NULL predicate',
      );

      const listingIndex = byName.get('player_gauntlet_runs_player_idx');
      assert.ok(listingIndex !== undefined, 'listing index must exist');
    },
  );

  test(
    'a second active run of the same identity is blocked by the partial-unique index',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'block');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);
      const identity = {
        setAbbr: 'dxm',
        mastermindSlug: 'magneto',
        division: 'fixed',
        playerCount: 1,
      };

      await insertActiveRun(testPool, playerId, identity);

      // why: a second active run of the identical identity while
      // first_completed_at IS NULL must violate the partial-unique index.
      await assert.rejects(
        insertActiveRun(testPool, playerId, identity),
        /player_gauntlet_runs_active_identity_uidx|duplicate key/,
        'a second active run of the same identity must be rejected',
      );
    },
  );

  test(
    'a new active run of the same identity succeeds once the first is completed',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'complete');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);
      const identity = {
        setAbbr: 'dxm',
        mastermindSlug: 'apocalypse',
        division: 'open',
        playerCount: 3,
      };

      const firstRunId = await insertActiveRun(testPool, playerId, identity);

      // why: stamping first_completed_at drops the first row out of the
      // partial-unique index, freeing the active slot for the same identity.
      await testPool.query(
        `UPDATE legendary.player_gauntlet_runs
            SET first_completed_at = now()
          WHERE id = $1`,
        [firstRunId],
      );

      const secondRunId = await insertActiveRun(testPool, playerId, identity);
      assert.notEqual(
        secondRunId,
        firstRunId,
        'a fresh active run must be a distinct row after completion',
      );
    },
  );

  test(
    'the division CHECK rejects a value outside the fixed/open set',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'division');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);

      await assert.rejects(
        insertActiveRun(testPool, playerId, {
          setAbbr: 'dxm',
          mastermindSlug: 'mystique',
          division: 'ranked',
          playerCount: 2,
        }),
        /division/,
        'an unknown division value must violate the CHECK',
      );
    },
  );

  test(
    'the player_count CHECK rejects values below 1 and above 5',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'count');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);

      await assert.rejects(
        insertActiveRun(testPool, playerId, {
          setAbbr: 'dxm',
          mastermindSlug: 'stryfe',
          division: 'fixed',
          playerCount: 0,
        }),
        /player_count/,
        'player_count 0 must violate the CHECK',
      );

      await assert.rejects(
        insertActiveRun(testPool, playerId, {
          setAbbr: 'dxm',
          mastermindSlug: 'stryfe',
          division: 'fixed',
          playerCount: 6,
        }),
        /player_count/,
        'player_count 6 must violate the CHECK',
      );
    },
  );

  test(
    'deleting the player cascades and removes the player runs',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'cascade');
      const playerId = await resolvePlayerId(testPool, accountId);
      // why: this player is deleted inside the test to prove the CASCADE, so it
      // is intentionally NOT pushed onto provisionedPlayerIds (the after-hook
      // would double-delete an already-removed row otherwise — harmless, but
      // this keeps the cleanup set honest).
      await insertActiveRun(testPool, playerId, {
        setAbbr: 'dxm',
        mastermindSlug: 'juggernaut',
        division: 'fixed',
        playerCount: 4,
      });

      const before = await testPool.query(
        'SELECT id FROM legendary.player_gauntlet_runs WHERE player_id = $1',
        [playerId],
      );
      assert.equal(before.rows.length, 1, 'the run must exist before delete');

      await testPool.query(
        'DELETE FROM legendary.players WHERE player_id = $1',
        [playerId],
      );

      const remaining = await testPool.query(
        'SELECT id FROM legendary.player_gauntlet_runs WHERE player_id = $1',
        [playerId],
      );
      assert.equal(
        remaining.rows.length,
        0,
        'deleting the player must cascade to the player runs',
      );
    },
  );
});
