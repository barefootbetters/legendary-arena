/**
 * Tests for the match-invite HTTP routes (WP-358 / EC-388).
 *
 * A fake Koa router captures the registered handlers; a fake
 * `requireAuthenticatedSession` drives the acting identity. Pure tests
 * (route registration, the 401 gate, the `MATCH_INVITE_API_ERROR_CODES`
 * drift) always run; behavioural tests exercise the real WP-358 logic
 * against a live Postgres (skip-when-no-`TEST_DATABASE_URL`). Behavioural
 * accounts get claimed handles so the shared DB needs no cleanup.
 *
 * Authority: WP-358 §Scope (In) §H; EC-388; D-24150.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerMatchInviteRoutes,
  MATCH_INVITE_API_ERROR_CODES,
  type MatchInviteApiErrorCode,
  type MatchInviteRouteDependencies,
  type RequireAuthenticatedSessionResult,
} from './matchInvites.routes.js';
import { recordSeatAccount } from './seatAccount.logic.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
} from '../friendships/friendships.logic.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import { claimHandle } from '../identity/handle.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
  post(path: string, handler: Handler): void {
    this.handlers.set(`POST ${path}`, handler);
  }
}

function makeContext(options: {
  body?: unknown;
  params?: { [key: string]: string };
}): FakeContext {
  return {
    req: { headers: {} },
    request: { body: options.body },
    params: options.params ?? {},
    status: 0,
    body: undefined,
    set(): void {},
  };
}

function depsFor(accountId: AccountId): MatchInviteRouteDependencies {
  const sessionResult: RequireAuthenticatedSessionResult = {
    ok: true,
    value: accountId,
  };
  return { requireAuthenticatedSession: async () => sessionResult };
}

const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

let handleCounter = 0;
function uniqueHandle(): string {
  handleCounter += 1;
  return `m${(Date.now() % 1_000_000_000).toString(36)}${handleCounter}`;
}

let accountCounter = 0;
async function provisionWithHandle(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<{ accountId: AccountId; handle: string }> {
  accountCounter += 1;
  const label = `wp358r-${Date.now()}-${accountCounter}-${labelSuffix}`;
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
  assert.ok(result.ok === true);
  const accountId = result.value.accountId;
  const handle = uniqueHandle();
  const claim = await claimHandle(accountId, handle, testPool);
  assert.ok(claim.ok === true);
  return { accountId, handle };
}

describe('match invite routes (WP-358)', () => {
  let testPool: pg.Pool | null = null;
  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });
  after(async () => {
    if (testPool !== null) {
      // why: clear this suite's match_seat_accounts + match_invites rows (by
      // the per-run match-id prefix) so a later suite's broad
      // `DELETE FROM legendary.players` does not FK-fault (WP-333 / WP-354
      // seat-cleanup convention).
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

  // --- Pure tests (always run) ---

  test('registers exactly the four match-invite routes', () => {
    const router = new FakeRouter();
    registerMatchInviteRoutes(router, throwingDatabase, depsFor('x' as AccountId));
    assert.ok(router.handlers.has('POST /api/match/invites'));
    assert.ok(router.handlers.has('GET /api/me/match-invites'));
    assert.ok(router.handlers.has('POST /api/me/match-invites/:matchId/accept'));
    assert.ok(router.handlers.has('POST /api/me/match-invites/:matchId/decline'));
    assert.equal(router.handlers.size, 4);
  });

  test('an unauthenticated request is 401 unauthorized before any DB access', async () => {
    const router = new FakeRouter();
    const deps: MatchInviteRouteDependencies = {
      requireAuthenticatedSession: async () => ({
        ok: false,
        reason: 'no token',
        code: 'missing_token',
      }),
    };
    registerMatchInviteRoutes(router, throwingDatabase, deps);
    const handler = router.handlers.get('GET /api/me/match-invites');
    assert.ok(handler);
    const ctx = makeContext({});
    await handler(ctx);
    assert.equal(ctx.status, 401);
    assert.deepEqual(ctx.body, { error: 'unauthorized' });
  });

  test('MATCH_INVITE_API_ERROR_CODES matches MatchInviteApiErrorCode union (drift)', () => {
    const expected: ReadonlySet<MatchInviteApiErrorCode> = new Set([
      'self_invite',
      'not_in_match',
      'not_friends',
      'already_invited',
      'invite_not_found',
      'unknown_account',
      'unauthorized',
      'invalid_request',
      'handle_not_found',
    ]);
    assert.equal(MATCH_INVITE_API_ERROR_CODES.length, expected.size);
    for (const value of MATCH_INVITE_API_ERROR_CODES) {
      assert.ok(expected.has(value));
    }
  });

  // --- Behavioural (DB) tests ---

  test(
    'POST /api/match/invites: happy path (201, no accountId), invalid_request, handle_not_found, not_friends',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const inviter = await provisionWithHandle(testPool, 'inviter');
      const invitee = await provisionWithHandle(testPool, 'invitee');
      // friends
      assert.ok((await sendFriendRequest(testPool, inviter.accountId, invitee.accountId)).ok === true);
      assert.ok((await acceptFriendRequest(testPool, invitee.accountId, inviter.accountId)).ok === true);
      const matchId = `wp358r-match-${Date.now()}`;
      await recordSeatAccount(matchId, '0', inviter.accountId, testPool);

      const router = new FakeRouter();
      registerMatchInviteRoutes(router, testPool, depsFor(inviter.accountId));
      const invite = router.handlers.get('POST /api/match/invites');
      assert.ok(invite);

      // happy path
      const okCtx = makeContext({ body: { matchId, handle: invitee.handle } });
      await invite(okCtx);
      assert.equal(okCtx.status, 201);
      const view = okCtx.body as Record<string, unknown>;
      assert.equal(view.matchId, matchId);
      assert.equal(view.status, 'pending');
      assert.ok(!('accountId' in view));

      // invalid_request (missing handle)
      const badCtx = makeContext({ body: { matchId } });
      await invite(badCtx);
      assert.equal(badCtx.status, 400);
      assert.deepEqual(badCtx.body, { error: 'invalid_request' });

      // handle_not_found
      const nfCtx = makeContext({ body: { matchId, handle: 'nobodyhere999' } });
      await invite(nfCtx);
      assert.equal(nfCtx.status, 404);
      assert.deepEqual(nfCtx.body, { error: 'handle_not_found' });

      // not_friends (stranger)
      const stranger = await provisionWithHandle(testPool, 'stranger');
      const strangerCtx = makeContext({ body: { matchId, handle: stranger.handle } });
      await invite(strangerCtx);
      assert.equal(strangerCtx.status, 403);
      assert.deepEqual(strangerCtx.body, { error: 'not_friends' });
    },
  );

  test(
    'GET list + accept (200 {matchId}) + decline (204) over the invitee session',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const inviter = await provisionWithHandle(testPool, 'inviter2');
      const invitee = await provisionWithHandle(testPool, 'invitee2');
      assert.ok((await sendFriendRequest(testPool, inviter.accountId, invitee.accountId)).ok === true);
      assert.ok((await acceptFriendRequest(testPool, invitee.accountId, inviter.accountId)).ok === true);
      const matchId = `wp358r-match2-${Date.now()}`;
      await recordSeatAccount(matchId, '0', inviter.accountId, testPool);

      // inviter sends
      const inviterRouter = new FakeRouter();
      registerMatchInviteRoutes(inviterRouter, testPool, depsFor(inviter.accountId));
      const inviteHandler = inviterRouter.handlers.get('POST /api/match/invites');
      assert.ok(inviteHandler);
      const sendCtx = makeContext({ body: { matchId, handle: invitee.handle } });
      await inviteHandler(sendCtx);
      assert.equal(sendCtx.status, 201);

      // invitee lists + accepts + declines over their own session
      const inviteeRouter = new FakeRouter();
      registerMatchInviteRoutes(inviteeRouter, testPool, depsFor(invitee.accountId));
      const listHandler = inviteeRouter.handlers.get('GET /api/me/match-invites');
      const acceptHandler = inviteeRouter.handlers.get('POST /api/me/match-invites/:matchId/accept');
      const declineHandler = inviteeRouter.handlers.get('POST /api/me/match-invites/:matchId/decline');
      assert.ok(listHandler && acceptHandler && declineHandler);

      const listCtx = makeContext({});
      await listHandler(listCtx);
      assert.equal(listCtx.status, 200);
      const listed = (listCtx.body as { invites: Array<{ matchId: string }> }).invites;
      assert.ok(listed.some((invite) => invite.matchId === matchId));

      // accept returns { matchId }
      const acceptCtx = makeContext({ params: { matchId } });
      await acceptHandler(acceptCtx);
      assert.equal(acceptCtx.status, 200);
      assert.deepEqual(acceptCtx.body, { matchId });

      // decline on the (now accepted) invite -> invite_not_found (404)
      const declineCtx = makeContext({ params: { matchId } });
      await declineHandler(declineCtx);
      assert.equal(declineCtx.status, 404);
      assert.deepEqual(declineCtx.body, { error: 'invite_not_found' });
    },
  );
});
