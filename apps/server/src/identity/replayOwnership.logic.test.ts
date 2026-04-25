/**
 * Tests for the replay ownership logic (WP-052).
 *
 * Four tests inside one describe block per WP-052 §G. One pure test
 * always runs (drift detection on `DEFAULT_RETENTION_POLICY` and
 * `REPLAY_VISIBILITY_VALUES`); three DB-dependent tests use
 * node:test's `{ skip: 'requires test database' }` non-silent skip
 * when `process.env.TEST_DATABASE_URL` is unset.
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RETENTION_POLICY,
  REPLAY_VISIBILITY_VALUES,
} from './replayOwnership.types.js';
import type { ReplayVisibility } from './replayOwnership.types.js';

import { createPlayerAccount } from './identity.logic.js';
import {
  assignReplayOwnership,
  listAccountReplays,
  updateReplayVisibility,
} from './replayOwnership.logic.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

describe('replay ownership logic (WP-052)', () => {
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

  test('DEFAULT_RETENTION_POLICY.minimumDays === 30 and REPLAY_VISIBILITY_VALUES drift', () => {
    assert.equal(DEFAULT_RETENTION_POLICY.minimumDays, 30);
    assert.equal(DEFAULT_RETENTION_POLICY.defaultDays, 90);
    assert.equal(DEFAULT_RETENTION_POLICY.extendedDays, null);

    const expected: ReadonlySet<ReplayVisibility> = new Set([
      'private',
      'link',
      'public',
    ]);
    assert.equal(REPLAY_VISIBILITY_VALUES.length, expected.size);
    for (const visibility of REPLAY_VISIBILITY_VALUES) {
      assert.ok(
        expected.has(visibility),
        `visibility ${visibility} missing from union`,
      );
    }
    for (const value of expected) {
      assert.ok(
        REPLAY_VISIBILITY_VALUES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test(
    'assignReplayOwnership idempotency — second call returns same record unchanged',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountResult = await createPlayerAccount(
        {
          email: 'idempotent@example.com',
          displayName: 'Idempotent',
          authProvider: 'email',
          authProviderId: 'idempotent@example.com',
        },
        testPool,
        idProvider,
      );
      assert.equal(accountResult.ok, true);
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const replayHash =
        'sha256:1111111111111111111111111111111111111111111111111111111111111111';
      const scenarioKey = 'scheme:placeholder/mastermind:placeholder';

      const first = await assignReplayOwnership(
        accountId,
        replayHash,
        scenarioKey,
        testPool,
      );
      assert.equal(first.ok, true);
      assert.ok(first.ok === true);

      const second = await assignReplayOwnership(
        accountId,
        replayHash,
        scenarioKey,
        testPool,
      );
      assert.equal(second.ok, true);
      assert.ok(second.ok === true);

      assert.equal(second.value.ownershipId, first.value.ownershipId);
      assert.equal(second.value.accountId, first.value.accountId);
      assert.equal(second.value.replayHash, first.value.replayHash);
      assert.equal(second.value.scenarioKey, first.value.scenarioKey);
      assert.equal(second.value.visibility, first.value.visibility);
      assert.equal(second.value.createdAt, first.value.createdAt);
      assert.equal(second.value.expiresAt, first.value.expiresAt);
    },
  );

  test(
    'updateReplayVisibility changes only visibility — Object.keys + field-by-field equality',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountResult = await createPlayerAccount(
        {
          email: 'visibility@example.com',
          displayName: 'Visibility',
          authProvider: 'email',
          authProviderId: 'visibility@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const replayHash =
        'sha256:2222222222222222222222222222222222222222222222222222222222222222';
      const assignResult = await assignReplayOwnership(
        accountId,
        replayHash,
        'scheme:placeholder/mastermind:placeholder',
        testPool,
      );
      assert.ok(assignResult.ok === true);
      const original = assignResult.value;

      const updated = await updateReplayVisibility(
        original.ownershipId,
        'public',
        testPool,
      );
      assert.ok(updated !== null);
      assert.deepEqual(Object.keys(updated).sort(), [
        'accountId',
        'createdAt',
        'expiresAt',
        'ownershipId',
        'replayHash',
        'scenarioKey',
        'visibility',
      ]);
      assert.equal(updated.visibility, 'public');
      assert.equal(updated.ownershipId, original.ownershipId);
      assert.equal(updated.accountId, original.accountId);
      assert.equal(updated.replayHash, original.replayHash);
      assert.equal(updated.scenarioKey, original.scenarioKey);
      assert.equal(updated.createdAt, original.createdAt);
      assert.equal(updated.expiresAt, original.expiresAt);
    },
  );

  test(
    'listAccountReplays excludes expired records (expires_at < now())',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      let counter = 0;
      const idProvider = () =>
        `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;

      const accountResult = await createPlayerAccount(
        {
          email: 'expired@example.com',
          displayName: 'Expired',
          authProvider: 'email',
          authProviderId: 'expired@example.com',
        },
        testPool,
        idProvider,
      );
      assert.ok(accountResult.ok === true);
      const accountId = accountResult.value.accountId;

      const liveHash =
        'sha256:3333333333333333333333333333333333333333333333333333333333333333';
      const expiredHash =
        'sha256:4444444444444444444444444444444444444444444444444444444444444444';

      const liveAssign = await assignReplayOwnership(
        accountId,
        liveHash,
        'scheme:placeholder/mastermind:placeholder',
        testPool,
      );
      assert.ok(liveAssign.ok === true);

      await testPool.query(
        'INSERT INTO legendary.replay_ownership ' +
          '(player_id, replay_hash, scenario_key, visibility, expires_at) ' +
          "SELECT player_id, $2, 'scheme:placeholder/mastermind:placeholder', " +
          "'private', now() - interval '1 day' " +
          'FROM legendary.players WHERE ext_id = $1',
        [accountId, expiredHash],
      );

      const listed = await listAccountReplays(accountId, testPool);
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.replayHash, liveHash);
    },
  );
});
