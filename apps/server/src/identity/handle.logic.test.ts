/**
 * Tests for the handle claim flow (WP-101 / EC-114).
 *
 * Twelve tests inside one describe block per WP-101 §Scope (In) §D.
 * Tests 1-3 are drift assertions on HANDLE_ERROR_CODES /
 * RESERVED_HANDLES / HANDLE_REGEX.source. Tests 4-9 are pure
 * validation against validateHandleFormat (always run; no DB).
 * Tests 10-12 exercise claimHandle against a real PostgreSQL test
 * database; each uses node:test's options-based non-silent skip when
 * `process.env.TEST_DATABASE_URL` is unset (locked WP-052 §3.1
 * post-mortem pattern — see the inline conditional on each
 * DB-dependent test below for the exact form).
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateHandleFormat,
  claimHandle,
  findAccountByHandle,
  getHandleForAccount,
} from './handle.logic.js';
import {
  HANDLE_ERROR_CODES,
  RESERVED_HANDLES,
  HANDLE_REGEX,
  type HandleErrorCode,
} from './handle.types.js';

import { createPlayerAccount } from './identity.logic.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

describe('handle logic (WP-101)', () => {
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
      // why: legendary.competitive_scores and legendary.replay_ownership
      // both FK to legendary.players(player_id); delete dependents
      // first to avoid FK violations during cleanup. legendary.replay_blobs
      // has no FK but is cleared for hygiene.
      await testPool.query('DELETE FROM legendary.competitive_scores');
      await testPool.query('DELETE FROM legendary.replay_ownership');
      await testPool.query('DELETE FROM legendary.replay_blobs');
      await testPool.query('DELETE FROM legendary.players');
    }
  });

  test('HANDLE_ERROR_CODES matches HandleErrorCode union (forward and backward inclusion)', () => {
    const expected: ReadonlySet<HandleErrorCode> = new Set([
      'invalid_handle',
      'reserved_handle',
      'handle_taken',
      'handle_already_locked',
      'unknown_account',
    ]);
    assert.equal(HANDLE_ERROR_CODES.length, expected.size);
    for (const code of HANDLE_ERROR_CODES) {
      assert.ok(
        expected.has(code),
        `HANDLE_ERROR_CODES contains ${code} which is missing from HandleErrorCode union`,
      );
    }
    for (const value of expected) {
      assert.ok(
        HANDLE_ERROR_CODES.includes(value),
        `HandleErrorCode union value ${value} missing from HANDLE_ERROR_CODES array`,
      );
    }
  });

  test('RESERVED_HANDLES matches the locked 15-entry alphabetical list verbatim', () => {
    assert.deepEqual(
      [...RESERVED_HANDLES],
      [
        'admin',
        'administrator',
        'anonymous',
        'api',
        'arena',
        'guest',
        'legendary',
        'mod',
        'moderator',
        'null',
        'root',
        'staff',
        'support',
        'system',
        'undefined',
      ],
    );
    assert.equal(RESERVED_HANDLES.length, 15);
  });

  test('HANDLE_REGEX.source byte-equal to ^[a-z][a-z0-9_]{2,23}$', () => {
    assert.equal(HANDLE_REGEX.source, '^[a-z][a-z0-9_]{2,23}$');
  });

  test('validateHandleFormat splits Alice into canonical alice and display Alice', () => {
    const result = validateHandleFormat('Alice');
    assert.ok(result.ok === true);
    assert.equal(result.value.canonical, 'alice');
    assert.equal(result.value.display, 'Alice');
  });

  test('validateHandleFormat trims surrounding whitespace before canonicalizing', () => {
    const result = validateHandleFormat('  Alice  ');
    assert.ok(result.ok === true);
    assert.equal(result.value.canonical, 'alice');
    assert.equal(result.value.display, 'Alice');
  });

  test('validateHandleFormat rejects ad as invalid_handle (too short, 2 chars)', () => {
    const result = validateHandleFormat('ad');
    assert.ok(result.ok === false);
    assert.equal(result.code, 'invalid_handle');
  });

  test('validateHandleFormat rejects 1abc as invalid_handle (leading digit)', () => {
    const result = validateHandleFormat('1abc');
    assert.ok(result.ok === false);
    assert.equal(result.code, 'invalid_handle');
  });

  test('validateHandleFormat rejects a__b as invalid_handle (consecutive underscores)', () => {
    const result = validateHandleFormat('a__b');
    assert.ok(result.ok === false);
    assert.equal(result.code, 'invalid_handle');
  });

  test('validateHandleFormat rejects Admin as reserved_handle (canonicalizes to admin)', () => {
    const result = validateHandleFormat('Admin');
    assert.ok(result.ok === false);
    assert.equal(result.code, 'reserved_handle');
  });

  test(
    'claimHandle succeeds against a fresh account and writes three columns',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountResult = await createPlayerAccount(
        {
          email: 'alice@example.com',
          displayName: 'Alice',
          authProvider: 'email',
          authProviderId: 'alice@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const claim = await claimHandle(accountId, 'Alice', testPool);
      assert.ok(claim.ok === true);
      assert.equal(claim.value.accountId, accountId);
      assert.equal(claim.value.handleCanonical, 'alice');
      assert.equal(claim.value.displayHandle, 'Alice');
      assert.equal(typeof claim.value.handleLockedAt, 'string');
      assert.ok(claim.value.handleLockedAt.length > 0);

      const inspection = await testPool.query(
        'SELECT handle_canonical, display_handle, handle_locked_at ' +
          'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
        [accountId],
      );
      assert.equal(inspection.rows.length, 1);
      assert.equal(inspection.rows[0].handle_canonical, 'alice');
      assert.equal(inspection.rows[0].display_handle, 'Alice');
      assert.notEqual(inspection.rows[0].handle_locked_at, null);

      const fetched = await getHandleForAccount(accountId, testPool);
      assert.ok(fetched !== null);
      assert.equal(fetched.handleCanonical, 'alice');
      assert.equal(fetched.displayHandle, 'Alice');

      const lookup = await findAccountByHandle('alice', testPool);
      assert.ok(lookup !== null);
      assert.equal(lookup.accountId, accountId);
    },
  );

  test(
    'claimHandle is idempotent for (accountId, canonical) and does not bump handle_locked_at',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountResult = await createPlayerAccount(
        {
          email: 'idempotent@example.com',
          displayName: 'Idem',
          authProvider: 'email',
          authProviderId: 'idempotent@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const first = await claimHandle(accountId, 'Bob', testPool);
      assert.ok(first.ok === true);

      const second = await claimHandle(accountId, 'bob', testPool);
      assert.ok(second.ok === true);

      assert.equal(second.value.accountId, first.value.accountId);
      assert.equal(second.value.handleCanonical, first.value.handleCanonical);
      assert.equal(second.value.displayHandle, first.value.displayHandle);
      assert.equal(second.value.handleLockedAt, first.value.handleLockedAt);
    },
  );

  test(
    'claimHandle returns code: handle_taken when a different account submits a canonical-equivalent handle',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountA = await createPlayerAccount(
        {
          email: 'a@example.com',
          displayName: 'A',
          authProvider: 'email',
          authProviderId: 'a@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountA.ok === true);

      const accountB = await createPlayerAccount(
        {
          email: 'b@example.com',
          displayName: 'B',
          authProvider: 'email',
          authProviderId: 'b@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountB.ok === true);

      const claimA = await claimHandle(
        accountA.value.accountId,
        'Alice',
        testPool,
      );
      assert.ok(claimA.ok === true);
      assert.equal(claimA.value.handleCanonical, 'alice');

      const claimB = await claimHandle(
        accountB.value.accountId,
        'alice',
        testPool,
      );
      assert.ok(claimB.ok === false);
      assert.equal(claimB.code, 'handle_taken');
    },
  );
});
