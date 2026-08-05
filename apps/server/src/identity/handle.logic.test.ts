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
  deriveHandle,
  assignAutoHandle,
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

  // --- WP-500 / EC-535: deriveHandle (pure, always run) ---

  test('deriveHandle returns the pinned slugs for representative names', () => {
    assert.equal(deriveHandle('Jeff'), 'jeff');
    assert.equal(deriveHandle('Spider-Man'), 'spider_man');
    assert.equal(deriveHandle('88Legend'), 'u88legend'); // leading non-letter → prefix u
    assert.equal(deriveHandle('Jo'), 'jo0'); // pad to 3 with 0
  });

  test('deriveHandle falls back to "player" for empty, emoji-only, and reserved names', () => {
    assert.equal(deriveHandle(''), 'player');
    assert.equal(deriveHandle('   '), 'player');
    assert.equal(deriveHandle('🎮🎮'), 'player');
    assert.equal(deriveHandle('Admin'), 'player'); // canonicalizes to a reserved handle
    assert.equal(deriveHandle('api'), 'player');
  });

  test('deriveHandle truncates to the 24-char ceiling and stays HANDLE_REGEX-valid', () => {
    const long = deriveHandle('Abcdefghijklmnopqrstuvwxyz Extra Words Here');
    assert.ok(long.length <= 24, `expected <=24 chars, got ${long.length}`);
    assert.ok(HANDLE_REGEX.test(long));
  });

  test('deriveHandle always returns a HANDLE_REGEX-valid handle across varied inputs', () => {
    const samples = [
      'Jeff', 'Spider-Man', '88Legend', 'Jo', 'J', '💥', 'Dr. Strange!!!',
      'multiple   spaces', '___weird___', 'Über Held', '42', 'a', 'ADMIN',
      'a-very-long-display-name-that-exceeds-twenty-four-characters', 'null', '  ',
    ];
    for (const sample of samples) {
      const handle = deriveHandle(sample);
      assert.ok(
        HANDLE_REGEX.test(handle),
        `deriveHandle(${JSON.stringify(sample)}) = ${JSON.stringify(handle)} is not HANDLE_REGEX-valid`,
      );
      assert.ok(RESERVED_HANDLES.includes(handle) === false || handle === 'player');
    }
  });

  // --- WP-500 / EC-535: assignAutoHandle (DB-gated) ---

  test(
    'assignAutoHandle assigns a derived handle and leaves handle_locked_at NULL (changeable)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
      const accountResult = await createPlayerAccount(
        {
          email: 'auto@example.com',
          displayName: 'Auto User',
          authProvider: 'email',
          authProviderId: 'auto@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const handle = await assignAutoHandle(accountId, 'Auto User', testPool);
      assert.equal(handle, 'auto_user');

      const inspection = await testPool.query(
        'SELECT handle_canonical, display_handle, handle_locked_at ' +
          'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
        [accountId],
      );
      assert.equal(inspection.rows[0].handle_canonical, 'auto_user');
      assert.equal(inspection.rows[0].display_handle, 'auto_user');
      // the whole point: auto-assigned handles are NOT locked (changeable)
      assert.equal(inspection.rows[0].handle_locked_at, null);

      // reachable by the friend/invite lookup now
      const lookup = await findAccountByHandle('auto_user', testPool);
      assert.ok(lookup !== null);
      assert.equal(lookup.accountId, accountId);
    },
  );

  test(
    'assignAutoHandle is idempotent — a second call is a no-op returning null',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
      const accountResult = await createPlayerAccount(
        {
          email: 'idem-auto@example.com',
          displayName: 'Idem Auto',
          authProvider: 'email',
          authProviderId: 'idem-auto@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const first = await assignAutoHandle(accountId, 'Idem Auto', testPool);
      assert.equal(first, 'idem_auto');
      const second = await assignAutoHandle(accountId, 'Different Name', testPool);
      assert.equal(second, null); // already has a handle → no-op, not overwritten

      const inspection = await testPool.query(
        'SELECT handle_canonical FROM legendary.players WHERE ext_id = $1 LIMIT 1',
        [accountId],
      );
      assert.equal(inspection.rows[0].handle_canonical, 'idem_auto');
    },
  );

  test(
    'assignAutoHandle appends a numeric suffix on a slug collision',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
      const first = await createPlayerAccount(
        { email: 'a1@example.com', displayName: 'Twin', authProvider: 'email', authProviderId: 'a1@example.com' },
        testPool,
        idProvider,
      );
      const second = await createPlayerAccount(
        { email: 'a2@example.com', displayName: 'Twin', authProvider: 'email', authProviderId: 'a2@example.com' },
        testPool,
        idProvider,
      );
      assert.ok(first.ok === true && second.ok === true);

      const h1 = await assignAutoHandle(first.value.accountId, 'Twin', testPool);
      const h2 = await assignAutoHandle(second.value.accountId, 'Twin', testPool);
      assert.equal(h1, 'twin');
      assert.equal(h2, 'twin2'); // collision → next suffix
      assert.ok(HANDLE_REGEX.test(h2));
    },
  );

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
