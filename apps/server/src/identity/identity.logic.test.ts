/**
 * Tests for the player identity logic (WP-052).
 *
 * Eight tests inside one describe block per WP-052 §F. Five pure
 * tests always run; three DB-dependent tests use node:test's
 * `{ skip: 'requires test database' }` non-silent skip when
 * `process.env.TEST_DATABASE_URL` is unset.
 *
 * DB-dependent tests connect a `pg.Pool` against the supplied test
 * database in a `before` hook, tear it down in `after`, and clean
 * out `legendary.replay_ownership` and `legendary.players` rows in
 * a `beforeEach` hook so each test is independent.
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AUTH_PROVIDERS, isGuest } from './identity.types.js';
import type {
  AuthProvider,
  GuestIdentity,
  PlayerAccount,
} from './identity.types.js';

import {
  createGuestIdentity,
  createPlayerAccount,
  findPlayerByEmail,
} from './identity.logic.js';

import { assignReplayOwnership } from './replayOwnership.logic.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

describe('identity logic (WP-052)', () => {
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
      await testPool.query('DELETE FROM legendary.replay_ownership');
      await testPool.query('DELETE FROM legendary.players');
    }
  });

  test('createGuestIdentity produces a valid GuestIdentity with isGuest:true (deterministic via injected idProvider)', () => {
    const guest = createGuestIdentity(
      () => '00000000-0000-4000-8000-000000000000',
    );
    assert.equal(guest.guestSessionId, '00000000-0000-4000-8000-000000000000');
    assert.equal(guest.isGuest, true);
    assert.ok(
      typeof guest.createdAt === 'string' && guest.createdAt.length > 0,
      'createdAt must be a non-empty ISO 8601 string.',
    );
    assert.doesNotThrow(() => new Date(guest.createdAt));
  });

  test('isGuest returns true for guest, false for account', () => {
    const guest: GuestIdentity = createGuestIdentity(
      () => '00000000-0000-4000-8000-000000000001',
    );
    assert.equal(isGuest(guest), true);

    const account: PlayerAccount = {
      accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as PlayerAccount['accountId'],
      email: 'foo@example.com',
      displayName: 'Foo',
      authProvider: 'email',
      authProviderId: 'foo@example.com',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    };
    assert.equal(isGuest(account), false);
  });

  test('AUTH_PROVIDERS array matches AuthProvider union (drift detection)', () => {
    const expected: ReadonlySet<AuthProvider> = new Set([
      'email',
      'google',
      'discord',
    ]);
    assert.equal(AUTH_PROVIDERS.length, expected.size);
    for (const provider of AUTH_PROVIDERS) {
      assert.ok(
        expected.has(provider),
        `provider ${provider} missing from union`,
      );
    }
    for (const value of expected) {
      assert.ok(
        AUTH_PROVIDERS.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test('Object.keys drift for PlayerAccount (7 fields) and GuestIdentity (3 fields)', () => {
    const account: PlayerAccount = {
      accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as PlayerAccount['accountId'],
      email: 'foo@example.com',
      displayName: 'Foo',
      authProvider: 'email',
      authProviderId: 'foo@example.com',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    };
    assert.deepEqual(Object.keys(account).sort(), [
      'accountId',
      'authProvider',
      'authProviderId',
      'createdAt',
      'displayName',
      'email',
      'updatedAt',
    ]);

    const guest: GuestIdentity = createGuestIdentity(
      () => '00000000-0000-4000-8000-000000000000',
    );
    assert.deepEqual(Object.keys(guest).sort(), [
      'createdAt',
      'guestSessionId',
      'isGuest',
    ]);
  });

  test(
    'createPlayerAccount returns duplicate_email on duplicate insert',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
      const first = await createPlayerAccount(
        {
          email: 'duplicate@example.com',
          displayName: 'Duplicate',
          authProvider: 'email',
          authProviderId: 'duplicate@example.com',
        },
        testPool,
        idProvider,
      );
      assert.equal(first.ok, true);

      const second = await createPlayerAccount(
        {
          email: 'duplicate@example.com',
          displayName: 'Duplicate Two',
          authProvider: 'email',
          authProviderId: 'duplicate@example.com',
        },
        testPool,
        idProvider,
      );
      assert.equal(second.ok, false);
      if (second.ok === false) {
        assert.equal(second.code, 'duplicate_email');
        assert.ok(second.reason.length > 20);
      }
    },
  );

  test(
    'createPlayerAccount canonicalizes email (Foo@Example.com matches foo@example.com)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const first = await createPlayerAccount(
        {
          email: '  Foo@Example.com  ',
          displayName: 'Foo',
          authProvider: 'email',
          authProviderId: 'foo@example.com',
        },
        testPool,
        idProvider,
      );
      assert.equal(first.ok, true);
      if (first.ok === true) {
        assert.equal(first.value.email, 'foo@example.com');
      }

      const lookup = await findPlayerByEmail('FOO@EXAMPLE.COM', testPool);
      assert.ok(lookup !== null, 'lookup must canonicalize too');
      assert.equal(lookup?.email, 'foo@example.com');

      const duplicate = await createPlayerAccount(
        {
          email: 'foo@example.com',
          displayName: 'Foo Two',
          authProvider: 'email',
          authProviderId: 'foo@example.com',
        },
        testPool,
        idProvider,
      );
      assert.equal(duplicate.ok, false);
      if (duplicate.ok === false) {
        assert.equal(duplicate.code, 'duplicate_email');
      }
    },
  );

  test('createPlayerAccount returns invalid_display_name for empty/too-long/control-character names', async () => {
    const stubPool = {
      query: async () => {
        throw new Error(
          'pool.query should not be called when displayName validation fails — the validation path must short-circuit before the DB.',
        );
      },
    } as unknown as pg.Pool;

    const cases: ReadonlyArray<string> = [
      '',
      '   ',
      'x'.repeat(65),
      'foo\nbar',
      'tab\there',
      'bellhere',
    ];

    for (const candidate of cases) {
      const result = await createPlayerAccount(
        {
          email: 'foo@example.com',
          displayName: candidate,
          authProvider: 'email',
          authProviderId: 'foo@example.com',
        },
        stubPool,
      );
      assert.equal(result.ok, false, `case ${JSON.stringify(candidate)} should fail`);
      if (result.ok === false) {
        assert.equal(result.code, 'invalid_display_name');
        assert.ok(
          result.reason.length > 20,
          'reason must be a full-sentence error message.',
        );
      }
    }
  });

  test(
    'assignReplayOwnership returns unknown_account for an unknown AccountId (FK invariant)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const unknownAccountId =
        'ffffffff-ffff-4fff-8fff-ffffffffffff' as PlayerAccount['accountId'];
      const result = await assignReplayOwnership(
        unknownAccountId,
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'scheme:placeholder/mastermind:placeholder',
        testPool,
      );
      assert.equal(result.ok, false);
      if (result.ok === false) {
        assert.equal(result.code, 'unknown_account');
        assert.ok(result.reason.length > 20);
      }
    },
  );
});
