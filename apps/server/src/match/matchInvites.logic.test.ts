/**
 * Tests for the match-invite logic (WP-358 / EC-388).
 *
 * Pure drift tests (MATCH_INVITE_STATUSES / MATCH_INVITE_ERROR_CODES) always
 * run; DB-required tests use node:test's options-based skip when
 * `TEST_DATABASE_URL` is unset (the locked profile/friendship suite pattern).
 * Per-run uniqueness on emails / auth ids / match ids avoids UNIQUE
 * collisions without a cleanup step.
 *
 * Authority: WP-358 §Scope (In) §H; EC-388; D-24150.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  createMatchInvite,
  listIncomingMatchInvites,
  acceptMatchInvite,
  declineMatchInvite,
} from './matchInvites.logic.js';
import {
  MATCH_INVITE_STATUSES,
  MATCH_INVITE_ERROR_CODES,
  type MatchInviteStatus,
  type MatchInviteErrorCode,
} from './matchInvites.types.js';
import { recordSeatAccount } from './seatAccount.logic.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
} from '../friendships/friendships.logic.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId } from '../identity/identity.types.js';

import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const SUITE_RUN_ID = `wp358-${Date.now()}`;
let testCounter = 0;
function uniqueLabel(suffix: string): string {
  testCounter += 1;
  return `${SUITE_RUN_ID}-${testCounter}-${suffix}`;
}

async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<AccountId> {
  const label = uniqueLabel(labelSuffix);
  const result = await createPlayerAccount(
    {
      email: `${label}@example.com`,
      displayName: `Invite${labelSuffix}`,
      authProvider: 'email',
      authProviderId: `${label}-sub`,
    },
    testPool,
    randomUUID,
  );
  assert.ok(result.ok === true, 'createPlayerAccount must succeed');
  return result.value.accountId;
}

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

/** Provision inviter + invitee, make them friends, seat the inviter in a fresh match. */
async function seededMatchWithFriends(testPool: pg.Pool): Promise<{
  inviter: AccountId;
  invitee: AccountId;
  matchId: string;
}> {
  const inviter = await provisionAccount(testPool, 'inviter');
  const invitee = await provisionAccount(testPool, 'invitee');
  await establishFriendship(testPool, inviter, invitee);
  const matchId = uniqueLabel('match');
  // why: WP-333 — the inviter's authenticated seat is recorded for the match.
  await recordSeatAccount(matchId, '0', inviter, testPool);
  return { inviter, invitee, matchId };
}

describe('match invite logic (WP-358)', () => {
  let testPool: pg.Pool | null = null;

  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });
  after(async () => {
    if (testPool !== null) {
      // why: this suite records match_seat_accounts (recordSeatAccount) and
      // creates match_invites. Other suites reset via a broad
      // `DELETE FROM legendary.players`, which FK-faults on a lingering
      // match_seat_accounts row (its ext_id FK is not ON DELETE CASCADE), so
      // clear this suite's rows by the per-run match-id prefix before
      // releasing the pool (the WP-333 / WP-354 seat-cleanup convention).
      await testPool.query(
        'DELETE FROM legendary.match_invites WHERE match_id LIKE $1',
        ['wp358%'],
      );
      await testPool.query(
        'DELETE FROM legendary.match_seat_accounts WHERE match_id LIKE $1',
        ['wp358%'],
      );
      await testPool.end();
      testPool = null;
    }
  });

  // --- Pure drift tests (always run) ---

  test('MATCH_INVITE_STATUSES matches MatchInviteStatus union (drift)', () => {
    const expected: ReadonlySet<MatchInviteStatus> = new Set([
      'pending',
      'accepted',
      'declined',
    ]);
    assert.equal(MATCH_INVITE_STATUSES.length, expected.size);
    for (const value of MATCH_INVITE_STATUSES) {
      assert.ok(expected.has(value));
    }
  });

  test('MATCH_INVITE_ERROR_CODES matches MatchInviteErrorCode union (drift)', () => {
    const expected: ReadonlySet<MatchInviteErrorCode> = new Set([
      'self_invite',
      'not_in_match',
      'not_friends',
      'already_invited',
      'invite_not_found',
      'unknown_account',
    ]);
    assert.equal(MATCH_INVITE_ERROR_CODES.length, expected.size);
    for (const value of MATCH_INVITE_ERROR_CODES) {
      assert.ok(expected.has(value));
    }
  });

  // --- DB-backed tests ---

  test(
    'createMatchInvite happy path returns a MatchInviteView with the inviter handle and NO accountId',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const { inviter, invitee, matchId } = await seededMatchWithFriends(testPool);
      const result = await createMatchInvite(testPool, inviter, invitee, matchId);
      assert.ok(result.ok === true);
      assert.equal(result.value.matchId, matchId);
      assert.equal(result.value.status, 'pending');
      assert.ok(typeof result.value.inviterHandle === 'string');
      assert.ok(result.value.inviterHandle.length > 0);
      assert.ok(typeof result.value.inviterDisplayName === 'string');
      // FR-2: no accountId / ext_id / player_id on the wire object.
      assert.ok(!('accountId' in result.value));
      assert.ok(!('inviterAccountId' in result.value));
    },
  );

  test(
    'createMatchInvite rejects self-invite, non-seated inviter, and non-friend invitee',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const { inviter, invitee, matchId } = await seededMatchWithFriends(testPool);

      // self-invite
      const selfResult = await createMatchInvite(testPool, inviter, inviter, matchId);
      assert.ok(selfResult.ok === false);
      assert.equal((selfResult as { code: string }).code, 'self_invite');

      // inviter not seated in a different match
      const otherMatch = uniqueLabel('other-match');
      const notSeated = await createMatchInvite(testPool, inviter, invitee, otherMatch);
      assert.ok(notSeated.ok === false);
      assert.equal((notSeated as { code: string }).code, 'not_in_match');

      // non-friend invitee (a stranger, seated inviter)
      const stranger = await provisionAccount(testPool, 'stranger');
      const notFriends = await createMatchInvite(testPool, inviter, stranger, matchId);
      assert.ok(notFriends.ok === false);
      assert.equal((notFriends as { code: string }).code, 'not_friends');
    },
  );

  test(
    'createMatchInvite rejects a duplicate but re-opens a declined invite (declined -> pending UPDATE)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const { inviter, invitee, matchId } = await seededMatchWithFriends(testPool);
      const first = await createMatchInvite(testPool, inviter, invitee, matchId);
      assert.ok(first.ok === true);

      // duplicate while pending -> already_invited
      const dup = await createMatchInvite(testPool, inviter, invitee, matchId);
      assert.ok(dup.ok === false);
      assert.equal((dup as { code: string }).code, 'already_invited');

      // decline, then re-invite -> pending again (UPDATE, no second row)
      const declined = await declineMatchInvite(testPool, invitee, matchId);
      assert.ok(declined.ok === true);
      const reInvite = await createMatchInvite(testPool, inviter, invitee, matchId);
      assert.ok(reInvite.ok === true);
      assert.equal(reInvite.value.status, 'pending');
      const rowCount = await testPool.query(
        'SELECT count(*)::int AS n FROM legendary.match_invites WHERE match_id = $1',
        [matchId],
      );
      assert.equal(rowCount.rows[0].n, 1, 'declined -> pending must UPDATE, not insert a second row');
    },
  );

  test(
    'listIncomingMatchInvites returns the invitee pending invites (enriched, no accountId); accept + decline transition',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const { inviter, invitee, matchId } = await seededMatchWithFriends(testPool);
      await createMatchInvite(testPool, inviter, invitee, matchId);

      const listed = await listIncomingMatchInvites(testPool, invitee);
      assert.ok(listed.ok === true);
      const forMatch = listed.value.find((invite) => invite.matchId === matchId);
      assert.ok(forMatch !== undefined);
      assert.equal(forMatch.status, 'pending');
      assert.ok(forMatch.inviterHandle.length > 0);
      assert.ok(!('accountId' in forMatch));

      // accept returns ok (void) and marks accepted; a second accept -> invite_not_found
      const accepted = await acceptMatchInvite(testPool, invitee, matchId);
      assert.ok(accepted.ok === true);
      const acceptAgain = await acceptMatchInvite(testPool, invitee, matchId);
      assert.ok(acceptAgain.ok === false);
      assert.equal((acceptAgain as { code: string }).code, 'invite_not_found');

      // after accept, the pending list no longer shows it
      const afterAccept = await listIncomingMatchInvites(testPool, invitee);
      assert.ok(afterAccept.ok === true);
      assert.ok(afterAccept.value.every((invite) => invite.matchId !== matchId));
    },
  );

  test(
    'declineMatchInvite on no pending invite returns invite_not_found',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const invitee = await provisionAccount(testPool, 'lonely-invitee');
      const result = await declineMatchInvite(testPool, invitee, uniqueLabel('nomatch'));
      assert.ok(result.ok === false);
      assert.equal((result as { code: string }).code, 'invite_not_found');
    },
  );
});
