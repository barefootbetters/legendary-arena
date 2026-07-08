/**
 * Tests for the match seat → account identity writer (WP-333).
 *
 * One logic-pure test always runs (a stub `query` captures the UPSERT shape +
 * params). Two DB-dependent tests use `node:test`'s non-silent skip with the
 * locked literal reason "requires test database" when `TEST_DATABASE_URL` is
 * unset (the WP-052 / WP-053 skip precedent). They prove idempotency and the
 * re-stamp behaviour against real Postgres.
 *
 * Authority: WP-333 §D; EC-363.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { recordSeatAccount } from './seatAccount.logic.js';
import type {
  AccountId,
  DatabaseClient,
} from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: unique-per-suite identifiers so a re-run against a persistent test
// database does not collide with rows left by a prior run; cleaned up in after().
const TEST_MATCH_ID = 'wp333-test-match';
const TEST_PLAYER_ID = '0';
const TEST_EXT_ID_A = 'wp333-test-account-a';
const TEST_EXT_ID_B = 'wp333-test-account-b';

describe('recordSeatAccount (WP-333)', () => {
  // -------------------------------------------------------------------------
  // Logic-pure: the writer issues one parameterized UPSERT with the seat key.
  // -------------------------------------------------------------------------
  test('issues a single ON CONFLICT UPSERT with (matchId, playerId, accountId) params', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const stubDatabase = {
      query: async (sql: string, params: unknown[]) => {
        captured.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
    } as unknown as DatabaseClient;

    await recordSeatAccount(
      'match-abc',
      '1',
      'acct-xyz' as AccountId,
      stubDatabase,
    );

    assert.equal(captured.length, 1);
    assert.match(captured[0]!.sql, /INSERT INTO legendary\.match_seat_accounts/);
    assert.match(captured[0]!.sql, /ON CONFLICT \(match_id, player_id\)/);
    assert.match(captured[0]!.sql, /DO UPDATE SET account_id = EXCLUDED\.account_id/);
    assert.deepEqual(captured[0]!.params, ['match-abc', '1', 'acct-xyz']);
  });

  // -------------------------------------------------------------------------
  // DB-dependent: idempotent re-join re-stamps account_id (no duplicate row).
  // -------------------------------------------------------------------------
  let pool: InstanceType<typeof Pool> | undefined;

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    // why: seed two accounts so the re-stamp assertion can prove the second
    // join's account replaces the first. ON CONFLICT DO NOTHING keeps the seed
    // idempotent across re-runs. Minimal NOT NULL columns per migration 004.
    for (const extId of [TEST_EXT_ID_A, TEST_EXT_ID_B]) {
      await pool.query(
        'INSERT INTO legendary.players (ext_id, email, display_name, auth_provider, auth_provider_id) ' +
          'VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ext_id) DO NOTHING',
        [
          extId,
          `${extId}@wp333.test`,
          `WP333 ${extId}`,
          'email',
          `${extId}-provider-sub`,
        ],
      );
    }
    await pool.query(
      'DELETE FROM legendary.match_seat_accounts WHERE match_id = $1',
      [TEST_MATCH_ID],
    );
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query(
      'DELETE FROM legendary.match_seat_accounts WHERE match_id = $1',
      [TEST_MATCH_ID],
    );
    await pool.query('DELETE FROM legendary.players WHERE ext_id = ANY($1)', [
      [TEST_EXT_ID_A, TEST_EXT_ID_B],
    ]);
    await pool.end();
  });

  test(
    'a re-join of the same seat re-stamps account_id without duplicating the row',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      await recordSeatAccount(
        TEST_MATCH_ID,
        TEST_PLAYER_ID,
        TEST_EXT_ID_A as AccountId,
        database,
      );
      await recordSeatAccount(
        TEST_MATCH_ID,
        TEST_PLAYER_ID,
        TEST_EXT_ID_B as AccountId,
        database,
      );

      const result = await pool!.query(
        'SELECT account_id FROM legendary.match_seat_accounts ' +
          'WHERE match_id = $1 AND player_id = $2',
        [TEST_MATCH_ID, TEST_PLAYER_ID],
      );
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0]!.account_id, TEST_EXT_ID_B);
    },
  );

  test(
    'the foreign key rejects an unknown account',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;
      await assert.rejects(
        recordSeatAccount(
          TEST_MATCH_ID,
          '9',
          'wp333-nonexistent-account' as AccountId,
          database,
        ),
      );
    },
  );
});
