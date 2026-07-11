/**
 * Tests for the friendship logic (WP-350 / EC-380).
 *
 * Pure tests (the FriendshipStatus / FriendshipErrorCode drift
 * assertions and the `n ≤ 1` vacuous-clique short-circuit) always run;
 * DB-required tests use node:test's options-based non-silent skip when
 * `process.env.TEST_DATABASE_URL` is unset (the locked profile-suite
 * pattern; mirrors `ownerProfile.logic.test.ts`).
 *
 * Per-suite-run uniqueness: every provisioned account uses `email` /
 * `authProviderId` values prefixed by a per-suite-run identifier so
 * repeated runs never collide on `legendary.players`' UNIQUE
 * constraints without needing a beforeEach cleanup.
 *
 * Authority: WP-350 §Scope (In) §D; EC-380; D-24142; WP-104
 * `ownerProfile.logic.test.ts` skip-harness precedent.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  getFriendshipStatus,
  areAllMutualFriends,
} from './friendships.logic.js';
import {
  FRIENDSHIP_STATUSES,
  FRIENDSHIP_ERROR_CODES,
  type FriendshipStatus,
  type FriendshipErrorCode,
} from './friendships.types.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const SUITE_RUN_ID = `wp350-${Date.now()}`;
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
  // why: randomUUID gives each account a globally unique ext_id. A
  // Date.now()-derived id collides when two accounts are provisioned in
  // the same millisecond, tripping the ext_id UNIQUE constraint.
  const result = await createPlayerAccount(
    {
      email,
      displayName: `Friend${labelSuffix}`,
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
 * Send a request from `from` to `to` and accept it, leaving an accepted
 * friendship. Asserts each step succeeded.
 */
async function establishFriendship(
  testPool: pg.Pool,
  from: AccountId,
  to: AccountId,
): Promise<void> {
  const sent = await sendFriendRequest(testPool, from, to);
  assert.ok(sent.ok === true, 'sendFriendRequest must succeed');
  const accepted = await acceptFriendRequest(testPool, to, from);
  assert.ok(accepted.ok === true, 'acceptFriendRequest must succeed');
}

describe('friendship logic (WP-350)', () => {
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

  // --- Pure drift tests (always run) ---

  test('FRIENDSHIP_STATUSES matches FriendshipStatus union (drift detection)', () => {
    const expected: ReadonlySet<FriendshipStatus> = new Set([
      'pending',
      'accepted',
      'declined',
    ]);
    assert.equal(FRIENDSHIP_STATUSES.length, expected.size);
    for (const status of FRIENDSHIP_STATUSES) {
      assert.ok(expected.has(status), `status ${status} missing from union`);
    }
    for (const value of expected) {
      assert.ok(
        FRIENDSHIP_STATUSES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test('FRIENDSHIP_ERROR_CODES matches FriendshipErrorCode union (drift detection)', () => {
    const expected: ReadonlySet<FriendshipErrorCode> = new Set([
      'unknown_account',
      'self_friendship',
      'already_pending',
      'already_friends',
      'no_pending_request',
      'not_addressee',
      'not_friends',
    ]);
    assert.equal(FRIENDSHIP_ERROR_CODES.length, expected.size);
    for (const code of FRIENDSHIP_ERROR_CODES) {
      assert.ok(expected.has(code), `code ${code} missing from union`);
    }
    for (const value of expected) {
      assert.ok(
        FRIENDSHIP_ERROR_CODES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  test('areAllMutualFriends is vacuously true for n <= 1 without touching the pool', async () => {
    // why: the n <= 1 branch short-circuits before any query, so a null
    // pool is safe here and the case is testable without a database.
    const noPool = null as unknown as DatabaseClient;
    assert.equal(await areAllMutualFriends(noPool, []), true);
    assert.equal(
      await areAllMutualFriends(noPool, ['made-up-account' as AccountId]),
      true,
    );
  });

  // --- DB-backed state machine ---

  test(
    'sendFriendRequest inserts a pending outgoing view',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'send-a');
      const bob = await provisionAccount(testPool, 'send-b');
      const result = await sendFriendRequest(testPool, alice, bob);
      assert.ok(result.ok === true);
      assert.equal(result.value.otherAccountId, bob);
      assert.equal(result.value.status, 'pending');
      assert.equal(result.value.direction, 'outgoing');
      assert.equal(result.value.respondedAt, null);
      assert.ok(typeof result.value.requestedAt === 'string');
    },
  );

  test(
    'sendFriendRequest to self returns self_friendship',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'self-a');
      const result = await sendFriendRequest(testPool, alice, alice);
      assert.ok(result.ok === false);
      assert.equal(result.code, 'self_friendship');
    },
  );

  test(
    'sendFriendRequest to an unknown account returns unknown_account',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'unknown-a');
      const missing = 'ffffffff-ffff-4fff-8fff-ffffffffffff' as AccountId;
      const result = await sendFriendRequest(testPool, alice, missing);
      assert.ok(result.ok === false);
      assert.equal(result.code, 'unknown_account');
    },
  );

  test(
    'duplicate pending request in either direction returns already_pending',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'dup-a');
      const bob = await provisionAccount(testPool, 'dup-b');
      const first = await sendFriendRequest(testPool, alice, bob);
      assert.ok(first.ok === true);
      // Same direction.
      const again = await sendFriendRequest(testPool, alice, bob);
      assert.ok(again.ok === false);
      assert.equal(again.code, 'already_pending');
      // Reverse direction (B → A) must also collide on the normalized pair.
      const reverse = await sendFriendRequest(testPool, bob, alice);
      assert.ok(reverse.ok === false);
      assert.equal(reverse.code, 'already_pending');
    },
  );

  test(
    'sendFriendRequest to an already-accepted pair returns already_friends',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'af-a');
      const bob = await provisionAccount(testPool, 'af-b');
      await establishFriendship(testPool, alice, bob);
      const result = await sendFriendRequest(testPool, alice, bob);
      assert.ok(result.ok === false);
      assert.equal(result.code, 'already_friends');
    },
  );

  test(
    'sendFriendRequest re-opens a declined pair via UPDATE (no second row)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 're-a');
      const bob = await provisionAccount(testPool, 're-b');
      const sent = await sendFriendRequest(testPool, alice, bob);
      assert.ok(sent.ok === true);
      const declined = await declineFriendRequest(testPool, bob, alice);
      assert.ok(declined.ok === true);
      assert.equal(declined.value.status, 'declined');
      // Re-request (either party may now initiate); becomes pending again.
      const reopened = await sendFriendRequest(testPool, bob, alice);
      assert.ok(reopened.ok === true);
      assert.equal(reopened.value.status, 'pending');
      assert.equal(reopened.value.direction, 'outgoing');
      assert.equal(reopened.value.otherAccountId, alice);
      assert.equal(reopened.value.respondedAt, null);
      // Exactly one row: alice now sees exactly one incoming request.
      const incoming = await listIncomingRequests(testPool, alice);
      assert.ok(incoming.ok === true);
      assert.equal(incoming.value.length, 1);
    },
  );

  test(
    'acceptFriendRequest by a non-addressee returns not_addressee',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'na-a');
      const bob = await provisionAccount(testPool, 'na-b');
      const sent = await sendFriendRequest(testPool, alice, bob);
      assert.ok(sent.ok === true);
      // Alice (the requester) tries to accept her own outgoing request.
      const result = await acceptFriendRequest(testPool, alice, bob);
      assert.ok(result.ok === false);
      assert.equal(result.code, 'not_addressee');
    },
  );

  test(
    'accept / decline with no pending row returns no_pending_request',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'np-a');
      const bob = await provisionAccount(testPool, 'np-b');
      const acceptResult = await acceptFriendRequest(testPool, bob, alice);
      assert.ok(acceptResult.ok === false);
      assert.equal(acceptResult.code, 'no_pending_request');
      const declineResult = await declineFriendRequest(testPool, bob, alice);
      assert.ok(declineResult.ok === false);
      assert.equal(declineResult.code, 'no_pending_request');
    },
  );

  test(
    'acceptFriendRequest transitions to accepted and sets respondedAt',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'ac-a');
      const bob = await provisionAccount(testPool, 'ac-b');
      const sent = await sendFriendRequest(testPool, alice, bob);
      assert.ok(sent.ok === true);
      const accepted = await acceptFriendRequest(testPool, bob, alice);
      assert.ok(accepted.ok === true);
      assert.equal(accepted.value.status, 'accepted');
      assert.equal(accepted.value.direction, 'incoming');
      assert.equal(accepted.value.otherAccountId, alice);
      assert.ok(typeof accepted.value.respondedAt === 'string');
    },
  );

  test(
    'removeFriend deletes the accepted row and is symmetric',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'rm-a');
      const bob = await provisionAccount(testPool, 'rm-b');
      await establishFriendship(testPool, alice, bob);
      // Either party may remove; here the addressee (bob) removes.
      const removed = await removeFriend(testPool, bob, alice);
      assert.ok(removed.ok === true);
      const status = await getFriendshipStatus(testPool, alice, bob);
      assert.ok(status.ok === true);
      assert.equal(status.value, 'none');
    },
  );

  test(
    'removeFriend on a non-accepted pair returns not_friends',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'nf-a');
      const bob = await provisionAccount(testPool, 'nf-b');
      // No relationship at all.
      const none = await removeFriend(testPool, alice, bob);
      assert.ok(none.ok === false);
      assert.equal(none.code, 'not_friends');
      // Pending (not accepted) also cannot be removed.
      const sent = await sendFriendRequest(testPool, alice, bob);
      assert.ok(sent.ok === true);
      const pending = await removeFriend(testPool, alice, bob);
      assert.ok(pending.ok === false);
      assert.equal(pending.code, 'not_friends');
    },
  );

  // --- DB-backed list helpers ---

  test(
    'list helpers return correct rows and direction fields',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'ls-a');
      const bob = await provisionAccount(testPool, 'ls-b');
      const sent = await sendFriendRequest(testPool, alice, bob);
      assert.ok(sent.ok === true);

      const outgoing = await listOutgoingRequests(testPool, alice);
      assert.ok(outgoing.ok === true);
      assert.equal(outgoing.value.length, 1);
      assert.equal(outgoing.value[0].direction, 'outgoing');
      assert.equal(outgoing.value[0].otherAccountId, bob);

      const incoming = await listIncomingRequests(testPool, bob);
      assert.ok(incoming.ok === true);
      assert.equal(incoming.value.length, 1);
      assert.equal(incoming.value[0].direction, 'incoming');
      assert.equal(incoming.value[0].otherAccountId, alice);

      const accepted = await acceptFriendRequest(testPool, bob, alice);
      assert.ok(accepted.ok === true);

      const aliceFriends = await listFriends(testPool, alice);
      assert.ok(aliceFriends.ok === true);
      assert.equal(aliceFriends.value.length, 1);
      assert.equal(aliceFriends.value[0].direction, 'outgoing');
      assert.equal(aliceFriends.value[0].otherAccountId, bob);
      assert.equal(aliceFriends.value[0].status, 'accepted');

      const bobFriends = await listFriends(testPool, bob);
      assert.ok(bobFriends.ok === true);
      assert.equal(bobFriends.value.length, 1);
      assert.equal(bobFriends.value[0].direction, 'incoming');
      assert.equal(bobFriends.value[0].otherAccountId, alice);

      // Pending requests are cleared once accepted.
      const outgoingAfter = await listOutgoingRequests(testPool, alice);
      assert.ok(outgoingAfter.ok === true);
      assert.equal(outgoingAfter.value.length, 0);
    },
  );

  // --- DB-backed clique helper ---

  test(
    'areAllMutualFriends is true for a full triangle and false for a missing edge',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const a = await provisionAccount(testPool, 'cl-a');
      const b = await provisionAccount(testPool, 'cl-b');
      const c = await provisionAccount(testPool, 'cl-c');
      await establishFriendship(testPool, a, b);
      await establishFriendship(testPool, b, c);
      // Missing A–C edge → not a clique.
      assert.equal(await areAllMutualFriends(testPool, [a, b, c]), false);
      // Close the triangle → clique.
      await establishFriendship(testPool, a, c);
      assert.equal(await areAllMutualFriends(testPool, [a, b, c]), true);
    },
  );

  test(
    'areAllMutualFriends ignores non-accepted (pending) edges',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const a = await provisionAccount(testPool, 'cp-a');
      const b = await provisionAccount(testPool, 'cp-b');
      const c = await provisionAccount(testPool, 'cp-c');
      await establishFriendship(testPool, a, b);
      await establishFriendship(testPool, b, c);
      // A–C only pending, not accepted → not a clique.
      const pending = await sendFriendRequest(testPool, a, c);
      assert.ok(pending.ok === true);
      assert.equal(await areAllMutualFriends(testPool, [a, b, c]), false);
    },
  );

  test(
    'areAllMutualFriends is order- and duplicate-independent',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const a = await provisionAccount(testPool, 'co-a');
      const b = await provisionAccount(testPool, 'co-b');
      const c = await provisionAccount(testPool, 'co-c');
      await establishFriendship(testPool, a, b);
      await establishFriendship(testPool, b, c);
      await establishFriendship(testPool, c, a);
      assert.equal(await areAllMutualFriends(testPool, [a, b, c]), true);
      assert.equal(await areAllMutualFriends(testPool, [c, b, a]), true);
      assert.equal(await areAllMutualFriends(testPool, [a, a, b, c]), true);
    },
  );

  test(
    'areAllMutualFriends returns false when a supplied account does not resolve',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const a = await provisionAccount(testPool, 'cm-a');
      const b = await provisionAccount(testPool, 'cm-b');
      await establishFriendship(testPool, a, b);
      const missing = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' as AccountId;
      assert.equal(await areAllMutualFriends(testPool, [a, b, missing]), false);
    },
  );

  // --- DB-backed full lifecycle ---

  test(
    'full lifecycle: accept → removeFriend → re-request → accept again',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccount(testPool, 'lc-a');
      const bob = await provisionAccount(testPool, 'lc-b');
      await establishFriendship(testPool, alice, bob);
      const removed = await removeFriend(testPool, alice, bob);
      assert.ok(removed.ok === true);
      // A removed pair re-friends via a brand-new request (proves DELETE,
      // not a status flip).
      const reRequest = await sendFriendRequest(testPool, alice, bob);
      assert.ok(reRequest.ok === true);
      assert.equal(reRequest.value.status, 'pending');
      const reAccept = await acceptFriendRequest(testPool, bob, alice);
      assert.ok(reAccept.ok === true);
      assert.equal(reAccept.value.status, 'accepted');
      const status = await getFriendshipStatus(testPool, alice, bob);
      assert.ok(status.ok === true);
      assert.equal(status.value, 'accepted');
    },
  );
});
