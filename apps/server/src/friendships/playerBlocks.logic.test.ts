/**
 * Tests for the player-blocks logic + abuse-control helpers (WP-355 / EC-385).
 *
 * The drift test always runs; the DB-backed cases use the profile-suite
 * skip-when-no-DB harness. Every account is provisioned with a per-run
 * unique `ext_id` (randomUUID) so repeated runs never collide.
 *
 * Authority: WP-355 §Scope (In) §F; EC-385; D-24147.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  blockPlayer,
  unblockPlayer,
  listBlocks,
  isEitherBlocked,
  countOutgoingPendingSince,
  mostRecentDeclineAgainst,
  BLOCK_ERROR_CODES,
  type BlockApiErrorCode,
} from './playerBlocks.logic.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendshipStatus,
} from './friendships.logic.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import { claimHandle } from '../identity/handle.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const SUITE_RUN_ID = `wp355-${Date.now()}`;
let testCounter = 0;
function uniqueLabel(suffix: string): string {
  testCounter += 1;
  return `${SUITE_RUN_ID}-${testCounter}-${suffix}`;
}

let handleCounter = 0;
function uniqueHandle(): string {
  handleCounter += 1;
  return `b${(Date.now() % 1_000_000_000).toString(36)}${handleCounter}`;
}

async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
  withHandle = false,
): Promise<AccountId> {
  const email = `${uniqueLabel(labelSuffix)}@example.com`;
  const authProviderId = `${uniqueLabel(labelSuffix)}-sub`;
  const result = await createPlayerAccount(
    {
      email,
      displayName: `Blocker${labelSuffix}`,
      authProvider: 'email',
      authProviderId,
    },
    testPool,
    randomUUID,
  );
  assert.ok(result.ok === true, 'createPlayerAccount must succeed');
  if (withHandle) {
    const claim = await claimHandle(
      result.value.accountId,
      uniqueHandle(),
      testPool as unknown as DatabaseClient,
    );
    assert.ok(claim.ok === true, 'claimHandle must succeed');
  }
  return result.value.accountId;
}

describe('player blocks + abuse-control helpers (WP-355)', () => {
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

  test('BLOCK_ERROR_CODES matches BlockApiErrorCode union (drift detection)', () => {
    const expected: ReadonlySet<BlockApiErrorCode> = new Set([
      'unknown_account',
      'self_block',
      'already_blocked',
      'not_blocked',
    ]);
    assert.equal(BLOCK_ERROR_CODES.length, expected.size);
    for (const code of BLOCK_ERROR_CODES) {
      assert.ok(expected.has(code), `code ${code} missing from union`);
    }
    for (const value of expected) {
      assert.ok(BLOCK_ERROR_CODES.includes(value), `union value ${value} missing from array`);
    }
  });

  test(
    'blockPlayer inserts the block and severs an existing friendship in one transaction',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'sv-a');
      const bob = await provisionAccount(testPool, 'sv-b', true);
      // Establish an accepted friendship.
      const sent = await sendFriendRequest(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(sent.ok === true);
      const accepted = await acceptFriendRequest(testPool as unknown as DatabaseClient, bob, alice);
      assert.ok(accepted.ok === true);

      const blocked = await blockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(blocked.ok === true);
      // The friendship is severed.
      const status = await getFriendshipStatus(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(status.ok === true);
      assert.equal(status.value, 'none');
      // The block exists (symmetric).
      assert.equal(await isEitherBlocked(testPool as unknown as DatabaseClient, alice, bob), true);
      assert.equal(await isEitherBlocked(testPool as unknown as DatabaseClient, bob, alice), true);
    },
  );

  test(
    'blockPlayer rejects self, unknown account, and duplicate',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'rej-a');
      const bob = await provisionAccount(testPool, 'rej-b', true);
      const self = await blockPlayer(testPool as unknown as DatabaseClient, alice, alice);
      assert.ok(self.ok === false);
      assert.equal(self.code, 'self_block');
      const missing = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' as AccountId;
      const unknown = await blockPlayer(testPool as unknown as DatabaseClient, alice, missing);
      assert.ok(unknown.ok === false);
      assert.equal(unknown.code, 'unknown_account');
      const first = await blockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(first.ok === true);
      const dup = await blockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(dup.ok === false);
      assert.equal(dup.code, 'already_blocked');
    },
  );

  test(
    'unblockPlayer removes the block; a second unblock is not_blocked',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'un-a');
      const bob = await provisionAccount(testPool, 'un-b', true);
      const blocked = await blockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(blocked.ok === true);
      const removed = await unblockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(removed.ok === true);
      assert.equal(await isEitherBlocked(testPool as unknown as DatabaseClient, alice, bob), false);
      const again = await unblockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      assert.ok(again.ok === false);
      assert.equal(again.code, 'not_blocked');
    },
  );

  test(
    'listBlocks returns handle + displayName only (no accountId)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'ls-a');
      const bob = await provisionAccount(testPool, 'ls-b', true);
      const carol = await provisionAccount(testPool, 'ls-c', true);
      await blockPlayer(testPool as unknown as DatabaseClient, alice, bob);
      await blockPlayer(testPool as unknown as DatabaseClient, alice, carol);
      const list = await listBlocks(testPool as unknown as DatabaseClient, alice);
      assert.ok(list.ok === true);
      assert.equal(list.value.length, 2);
      for (const entry of list.value) {
        assert.deepEqual(Object.keys(entry).sort(), ['displayName', 'handle']);
        assert.equal('accountId' in entry, false);
        assert.ok(typeof entry.handle === 'string' && entry.handle.length > 0);
      }
    },
  );

  test(
    'countOutgoingPendingSince counts the actor pending requests in the window',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'ct-a');
      const bob = await provisionAccount(testPool, 'ct-b');
      const carol = await provisionAccount(testPool, 'ct-c');
      await sendFriendRequest(testPool as unknown as DatabaseClient, alice, bob);
      await sendFriendRequest(testPool as unknown as DatabaseClient, alice, carol);
      const epoch = '1970-01-01T00:00:00.000Z';
      assert.equal(
        await countOutgoingPendingSince(testPool as unknown as DatabaseClient, alice, epoch),
        2,
      );
      // A future window start excludes them.
      const future = new Date(Date.now() + 60_000).toISOString();
      assert.equal(
        await countOutgoingPendingSince(testPool as unknown as DatabaseClient, alice, future),
        0,
      );
    },
  );

  test(
    'mostRecentDeclineAgainst returns the decline timestamp, or null when none',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'dc-a');
      const bob = await provisionAccount(testPool, 'dc-b');
      const carol = await provisionAccount(testPool, 'dc-c');
      // No decline yet.
      assert.equal(
        await mostRecentDeclineAgainst(testPool as unknown as DatabaseClient, alice, bob),
        null,
      );
      // Alice → Bob, Bob declines.
      await sendFriendRequest(testPool as unknown as DatabaseClient, alice, bob);
      await declineFriendRequest(testPool as unknown as DatabaseClient, bob, alice);
      const declinedAt = await mostRecentDeclineAgainst(
        testPool as unknown as DatabaseClient,
        alice,
        bob,
      );
      assert.ok(typeof declinedAt === 'string');
      // Unrelated pair still null.
      assert.equal(
        await mostRecentDeclineAgainst(testPool as unknown as DatabaseClient, alice, carol),
        null,
      );
    },
  );
});
