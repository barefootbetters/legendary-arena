/**
 * Tests for the friend-request HTTP routes (WP-351 / EC-381).
 *
 * A fake Koa router captures the registered handlers and a fake
 * `requireAuthenticatedSession` drives the acting identity. The pure
 * tests (route registration, the unauthenticated 401 gate, and the
 * `FRIEND_API_ERROR_CODES` drift assertion) always run; the behavioural
 * tests exercise the real WP-350 logic against a live Postgres and use
 * the profile-suite skip-when-no-DB harness (`TEST_DATABASE_URL`).
 *
 * Every behavioural test provisions its own accounts (with claimed
 * handles) so the shared test database needs no cleanup between runs.
 *
 * Layer-boundary: imports nothing from the engine runtime, the registry
 * runtime, or any UI package.
 *
 * Authority: WP-351 §Scope (In) §F; EC-381; D-24143; the WP-301
 * `loadoutLibrary.routes.test.ts` fake-router precedent.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerFriendshipRoutes,
  FRIEND_API_ERROR_CODES,
  type FriendApiErrorCode,
  type FriendshipRouteDependencies,
  type RequireAuthenticatedSessionResult,
} from './friendships.routes.js';
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
  headers: Record<string, string>;
}

class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
  post(path: string, handler: Handler): void {
    this.handlers.set(`POST ${path}`, handler);
  }
  delete(path: string, handler: Handler): void {
    this.handlers.set(`DELETE ${path}`, handler);
  }
}

function makeContext(options: {
  body?: unknown;
  params?: { [key: string]: string };
}): FakeContext {
  const headers: Record<string, string> = {};
  return {
    req: { headers: {} },
    request: { body: options.body },
    params: options.params ?? {},
    status: 0,
    body: undefined,
    set(field: string, value: string): void {
      headers[field] = value;
    },
    headers,
  };
}

function makeDeps(
  sessionResult: RequireAuthenticatedSessionResult,
): FriendshipRouteDependencies {
  return {
    requireAuthenticatedSession: async () => sessionResult,
  };
}

/**
 * A DatabaseClient whose `query` throws — proves a handler returned
 * before any DB access (the auth-failure path).
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

let handleCounter = 0;
function uniqueHandle(): string {
  handleCounter += 1;
  // why: starts with a lowercase letter then base36 (0-9a-z) so it
  // matches HANDLE_REGEX; the per-run millisecond + counter keep it
  // unique across repeated runs on the shared test database.
  return `f${(Date.now() % 1_000_000_000).toString(36)}${handleCounter}`;
}

let accountCounter = 0;
async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<AccountId> {
  accountCounter += 1;
  const email = `wp351-${Date.now()}-${accountCounter}-${labelSuffix}@example.com`;
  const authProviderId = `wp351-${Date.now()}-${accountCounter}-${labelSuffix}-sub`;
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

interface ProvisionedFriend {
  accountId: AccountId;
  handle: string;
  displayName: string;
}

async function provisionAccountWithHandle(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<ProvisionedFriend> {
  const accountId = await provisionAccount(testPool, labelSuffix);
  const handle = uniqueHandle();
  const claim = await claimHandle(accountId, handle, testPool);
  assert.ok(claim.ok === true, 'claimHandle must succeed');
  return { accountId, handle, displayName: `Friend${labelSuffix}` };
}

const FRIEND_SUMMARY_KEYS = [
  'direction',
  'displayName',
  'handle',
  'requestedAt',
  'respondedAt',
  'status',
];

/**
 * Assert a wire object is a valid `FriendSummary`: exactly the allowed
 * keys, and NO account-identifier field of any kind (FR-2).
 */
function assertIsFriendSummary(value: unknown): void {
  assert.ok(value !== null && typeof value === 'object');
  const keys = Object.keys(value as object).sort();
  assert.deepEqual(keys, FRIEND_SUMMARY_KEYS);
  assert.equal('accountId' in (value as object), false);
  assert.equal('ext_id' in (value as object), false);
  assert.equal('player_id' in (value as object), false);
}

describe('friend-request routes (WP-351)', () => {
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

  function handlersForActor(actingAccountId: AccountId): Map<string, Handler> {
    assert.ok(testPool !== null);
    const router = new FakeRouter();
    registerFriendshipRoutes(
      router,
      testPool,
      makeDeps({ ok: true, value: actingAccountId }),
    );
    return router.handlers;
  }

  // --- Pure tests (always run) ---

  test('registers exactly the nine locked routes (6 friend + 3 block)', () => {
    const router = new FakeRouter();
    registerFriendshipRoutes(
      router,
      throwingDatabase,
      makeDeps({ ok: true, value: '00000000-0000-4000-8000-000000000001' }),
    );
    const keys = [...router.handlers.keys()].sort();
    assert.deepEqual(keys, [
      'DELETE /api/me/blocks/:handle',
      'DELETE /api/me/friends/:handle',
      'GET /api/me/blocks',
      'GET /api/me/friends',
      'GET /api/me/friends/requests',
      'POST /api/me/blocks',
      'POST /api/me/friends/requests',
      'POST /api/me/friends/requests/:handle/accept',
      'POST /api/me/friends/requests/:handle/decline',
    ]);
  });

  test('every route returns 401 unauthorized on a failed session, DB untouched', async () => {
    const router = new FakeRouter();
    registerFriendshipRoutes(
      router,
      throwingDatabase,
      makeDeps({ ok: false, reason: 'no token', code: 'missing_token' }),
    );
    for (const [key, handler] of router.handlers) {
      const koaContext = makeContext({ body: { handle: 'x' }, params: { handle: 'x' } });
      await handler(koaContext);
      assert.equal(koaContext.status, 401, `${key} must 401`);
      assert.deepEqual(koaContext.body, { error: 'unauthorized' }, `${key} body`);
      assert.equal(koaContext.headers['Cache-Control'], 'no-store', `${key} cache`);
    }
  });

  test('FRIEND_API_ERROR_CODES matches FriendApiErrorCode union (drift detection)', () => {
    const expected: ReadonlySet<FriendApiErrorCode> = new Set([
      'self_friendship',
      'already_pending',
      'already_friends',
      'no_pending_request',
      'not_addressee',
      'not_friends',
      'unknown_account',
      'unauthorized',
      'invalid_request',
      'handle_required',
      'handle_not_found',
      'account_not_found',
      'blocked',
      'rate_limited',
      'request_cooldown',
    ]);
    assert.equal(FRIEND_API_ERROR_CODES.length, expected.size);
    for (const code of FRIEND_API_ERROR_CODES) {
      assert.ok(expected.has(code), `code ${code} missing from union`);
    }
    for (const value of expected) {
      assert.ok(
        FRIEND_API_ERROR_CODES.includes(value),
        `union value ${value} missing from array`,
      );
    }
  });

  // --- DB-backed: send ---

  test(
    'POST send: happy path 201 FriendSummary (no accountId on the wire)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'send-a');
      const bob = await provisionAccountWithHandle(testPool, 'send-b');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { handle: bob.handle } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 201);
      assertIsFriendSummary(koaContext.body);
      const summary = koaContext.body as Record<string, unknown>;
      assert.equal(summary.handle, bob.handle);
      assert.equal(summary.displayName, bob.displayName);
      assert.equal(summary.status, 'pending');
      assert.equal(summary.direction, 'outgoing');
      assert.equal(summary.respondedAt, null);
      assert.equal(koaContext.headers['Cache-Control'], 'no-store');
    },
  );

  test(
    'POST send: handle-less actor → 409 handle_required',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const handlelessActor = await provisionAccount(testPool, 'hr-a');
      const bob = await provisionAccountWithHandle(testPool, 'hr-b');
      const handlers = handlersForActor(handlelessActor);
      const koaContext = makeContext({ body: { handle: bob.handle } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 409);
      assert.deepEqual(koaContext.body, { error: 'handle_required' });
    },
  );

  test(
    'POST send: unknown target handle → 404 handle_not_found',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'hnf-a');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { handle: 'zzzznobodyhere' } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 404);
      assert.deepEqual(koaContext.body, { error: 'handle_not_found' });
    },
  );

  test(
    'POST send: malformed body → 400 invalid_request',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'ir-a');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: {} });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 400);
      assert.deepEqual(koaContext.body, { error: 'invalid_request' });
    },
  );

  test(
    'POST send: own handle → 409 self_friendship',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'self-a');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { handle: alice.handle } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 409);
      assert.deepEqual(koaContext.body, { error: 'self_friendship' });
    },
  );

  test(
    'POST send: duplicate → 409 already_pending; already friends → 409 already_friends',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'dup-a');
      const bob = await provisionAccountWithHandle(testPool, 'dup-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const first = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(first);
      assert.equal(first.status, 201);
      const dup = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(dup);
      assert.equal(dup.status, 409);
      assert.deepEqual(dup.body, { error: 'already_pending' });
      // Accept, then a further send → already_friends.
      const bobHandlers = handlersForActor(bob.accountId);
      const accept = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/accept')!(accept);
      assert.equal(accept.status, 200);
      const afterFriends = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(afterFriends);
      assert.equal(afterFriends.status, 409);
      assert.deepEqual(afterFriends.body, { error: 'already_friends' });
    },
  );

  // --- DB-backed: send by AccountId (WP-504) ---

  test(
    'POST send by accountId: happy path 201 resolves the target (no accountId on the wire)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'aid-a');
      const bob = await provisionAccountWithHandle(testPool, 'aid-b');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { accountId: bob.accountId } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 201);
      assertIsFriendSummary(koaContext.body);
      const summary = koaContext.body as Record<string, unknown>;
      // The AccountId resolved to Bob — the enriched summary carries his
      // handle + displayName and NO accountId (FR-2 preserved).
      assert.equal(summary.handle, bob.handle);
      assert.equal(summary.displayName, bob.displayName);
      assert.equal(summary.status, 'pending');
      assert.equal(summary.direction, 'outgoing');
    },
  );

  test(
    'POST send by accountId: malformed accountId → 400 invalid_request',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'aid-mal');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { accountId: 'not-a-uuid' } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 400);
      assert.deepEqual(koaContext.body, { error: 'invalid_request' });
    },
  );

  test(
    'POST send by accountId: well-formed but unknown → 404 account_not_found',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'aid-unk');
      const handlers = handlersForActor(alice.accountId);
      // A syntactically valid UUID that was never provisioned.
      const koaContext = makeContext({ body: { accountId: randomUUID() } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 404);
      assert.deepEqual(koaContext.body, { error: 'account_not_found' });
    },
  );

  test(
    'POST send: both handle and accountId present → 400 invalid_request',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'both-a');
      const bob = await provisionAccountWithHandle(testPool, 'both-b');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({
        body: { handle: bob.handle, accountId: bob.accountId },
      });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 400);
      assert.deepEqual(koaContext.body, { error: 'invalid_request' });
    },
  );

  test(
    'POST send by accountId: own accountId → 409 self_friendship',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'aid-self');
      const handlers = handlersForActor(alice.accountId);
      const koaContext = makeContext({ body: { accountId: alice.accountId } });
      await handlers.get('POST /api/me/friends/requests')!(koaContext);
      assert.equal(koaContext.status, 409);
      assert.deepEqual(koaContext.body, { error: 'self_friendship' });
    },
  );

  // --- DB-backed: accept / decline / remove ---

  test(
    'accept: by addressee 200 incoming FriendSummary; by non-addressee → 403 not_addressee',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'ac-a');
      const bob = await provisionAccountWithHandle(testPool, 'ac-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const send = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(send);
      assert.equal(send.status, 201);
      // Requester (alice) tries to accept her own outgoing request.
      const wrong = makeContext({ params: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests/:handle/accept')!(wrong);
      assert.equal(wrong.status, 403);
      assert.deepEqual(wrong.body, { error: 'not_addressee' });
      // Addressee (bob) accepts.
      const bobHandlers = handlersForActor(bob.accountId);
      const accept = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/accept')!(accept);
      assert.equal(accept.status, 200);
      assertIsFriendSummary(accept.body);
      const summary = accept.body as Record<string, unknown>;
      assert.equal(summary.handle, alice.handle);
      assert.equal(summary.status, 'accepted');
      assert.equal(summary.direction, 'incoming');
    },
  );

  test(
    'accept: no pending row → 404 no_pending_request',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'np-a');
      const bob = await provisionAccountWithHandle(testPool, 'np-b');
      const bobHandlers = handlersForActor(bob.accountId);
      const accept = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/accept')!(accept);
      assert.equal(accept.status, 404);
      assert.deepEqual(accept.body, { error: 'no_pending_request' });
    },
  );

  test(
    'decline: by addressee 200 declined FriendSummary',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'dc-a');
      const bob = await provisionAccountWithHandle(testPool, 'dc-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const send = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(send);
      assert.equal(send.status, 201);
      const bobHandlers = handlersForActor(bob.accountId);
      const decline = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/decline')!(decline);
      assert.equal(decline.status, 200);
      assertIsFriendSummary(decline.body);
      assert.equal((decline.body as Record<string, unknown>).status, 'declined');
    },
  );

  test(
    'DELETE: 204 on an accepted friendship; not-friends → 404 not_friends',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'rm-a');
      const bob = await provisionAccountWithHandle(testPool, 'rm-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      // No relationship yet → not_friends.
      const early = makeContext({ params: { handle: bob.handle } });
      await aliceHandlers.get('DELETE /api/me/friends/:handle')!(early);
      assert.equal(early.status, 404);
      assert.deepEqual(early.body, { error: 'not_friends' });
      // Establish and remove.
      const send = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(send);
      const bobHandlers = handlersForActor(bob.accountId);
      const accept = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/accept')!(accept);
      const remove = makeContext({ params: { handle: bob.handle } });
      await aliceHandlers.get('DELETE /api/me/friends/:handle')!(remove);
      assert.equal(remove.status, 204);
      assert.equal(remove.body, null);
    },
  );

  // --- DB-backed: list enrichment ---

  test(
    'GET friends + GET requests: correct direction + enrichment, no accountId, empty shapes',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'ls-a');
      const bob = await provisionAccountWithHandle(testPool, 'ls-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const bobHandlers = handlersForActor(bob.accountId);

      // Empty state.
      const emptyFriends = makeContext({});
      await aliceHandlers.get('GET /api/me/friends')!(emptyFriends);
      assert.equal(emptyFriends.status, 200);
      assert.deepEqual(emptyFriends.body, { friends: [] });
      const emptyReq = makeContext({});
      await aliceHandlers.get('GET /api/me/friends/requests')!(emptyReq);
      assert.deepEqual(emptyReq.body, { incoming: [], outgoing: [] });

      // Pending: alice → bob.
      const send = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(send);

      const aliceReq = makeContext({});
      await aliceHandlers.get('GET /api/me/friends/requests')!(aliceReq);
      const aliceReqBody = aliceReq.body as {
        incoming: unknown[];
        outgoing: Record<string, unknown>[];
      };
      assert.equal(aliceReqBody.incoming.length, 0);
      assert.equal(aliceReqBody.outgoing.length, 1);
      assertIsFriendSummary(aliceReqBody.outgoing[0]);
      assert.equal(aliceReqBody.outgoing[0].handle, bob.handle);
      assert.equal(aliceReqBody.outgoing[0].direction, 'outgoing');

      const bobReq = makeContext({});
      await bobHandlers.get('GET /api/me/friends/requests')!(bobReq);
      const bobReqBody = bobReq.body as {
        incoming: Record<string, unknown>[];
        outgoing: unknown[];
      };
      assert.equal(bobReqBody.incoming.length, 1);
      assert.equal(bobReqBody.incoming[0].handle, alice.handle);
      assert.equal(bobReqBody.incoming[0].direction, 'incoming');

      // Accept, then list friends from both sides.
      const accept = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/accept')!(accept);

      const aliceFriends = makeContext({});
      await aliceHandlers.get('GET /api/me/friends')!(aliceFriends);
      const aliceFriendsBody = aliceFriends.body as {
        friends: Record<string, unknown>[];
      };
      assert.equal(aliceFriendsBody.friends.length, 1);
      assertIsFriendSummary(aliceFriendsBody.friends[0]);
      assert.equal(aliceFriendsBody.friends[0].handle, bob.handle);
      assert.equal(aliceFriendsBody.friends[0].displayName, bob.displayName);
      assert.equal(aliceFriendsBody.friends[0].direction, 'outgoing');
      assert.equal(aliceFriendsBody.friends[0].status, 'accepted');

      const bobFriends = makeContext({});
      await bobHandlers.get('GET /api/me/friends')!(bobFriends);
      const bobFriendsBody = bobFriends.body as {
        friends: Record<string, unknown>[];
      };
      assert.equal(bobFriendsBody.friends.length, 1);
      assert.equal(bobFriendsBody.friends[0].handle, alice.handle);
      assert.equal(bobFriendsBody.friends[0].direction, 'incoming');
    },
  );

  // --- WP-355 abuse controls: block endpoints + send guards ---

  test(
    'block endpoints: create (201, no accountId) / list / delete; self → self_block; unblock-none → not_blocked',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'blk-a');
      const bob = await provisionAccountWithHandle(testPool, 'blk-b');
      const aliceHandlers = handlersForActor(alice.accountId);

      // Create.
      const create = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/blocks')!(create);
      assert.equal(create.status, 201);
      const created = create.body as Record<string, unknown>;
      assert.deepEqual(Object.keys(created).sort(), ['displayName', 'handle']);
      assert.equal(created.handle, bob.handle);
      assert.equal('accountId' in created, false);

      // List.
      const list = makeContext({});
      await aliceHandlers.get('GET /api/me/blocks')!(list);
      assert.equal(list.status, 200);
      const listBody = list.body as { blocked: Record<string, unknown>[] };
      assert.equal(listBody.blocked.length, 1);
      assert.equal(listBody.blocked[0].handle, bob.handle);
      assert.equal('accountId' in listBody.blocked[0], false);

      // Self-block.
      const self = makeContext({ body: { handle: alice.handle } });
      await aliceHandlers.get('POST /api/me/blocks')!(self);
      assert.equal(self.status, 409);
      assert.deepEqual(self.body, { error: 'self_block' });

      // Delete.
      const remove = makeContext({ params: { handle: bob.handle } });
      await aliceHandlers.get('DELETE /api/me/blocks/:handle')!(remove);
      assert.equal(remove.status, 204);

      // Delete again → not_blocked.
      const removeAgain = makeContext({ params: { handle: bob.handle } });
      await aliceHandlers.get('DELETE /api/me/blocks/:handle')!(removeAgain);
      assert.equal(removeAgain.status, 404);
      assert.deepEqual(removeAgain.body, { error: 'not_blocked' });
    },
  );

  test(
    'send to a blocked pair → 403 blocked (symmetric)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'sb-a');
      const bob = await provisionAccountWithHandle(testPool, 'sb-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const bobHandlers = handlersForActor(bob.accountId);

      // Alice blocks Bob.
      const block = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/blocks')!(block);
      assert.equal(block.status, 201);

      // Alice cannot send to Bob.
      const aliceSend = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(aliceSend);
      assert.equal(aliceSend.status, 403);
      assert.deepEqual(aliceSend.body, { error: 'blocked' });

      // Symmetric: Bob cannot send to Alice either.
      const bobSend = makeContext({ body: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests')!(bobSend);
      assert.equal(bobSend.status, 403);
      assert.deepEqual(bobSend.body, { error: 'blocked' });
    },
  );

  test(
    'send within the re-request cooldown of a decline → 429 request_cooldown',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'cd-a');
      const bob = await provisionAccountWithHandle(testPool, 'cd-b');
      const aliceHandlers = handlersForActor(alice.accountId);
      const bobHandlers = handlersForActor(bob.accountId);

      const send = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(send);
      assert.equal(send.status, 201);
      // Bob declines.
      const decline = makeContext({ params: { handle: alice.handle } });
      await bobHandlers.get('POST /api/me/friends/requests/:handle/decline')!(decline);
      assert.equal(decline.status, 200);
      // Alice re-sends immediately → within cooldown.
      const resend = makeContext({ body: { handle: bob.handle } });
      await aliceHandlers.get('POST /api/me/friends/requests')!(resend);
      assert.equal(resend.status, 429);
      assert.deepEqual(resend.body, { error: 'request_cooldown' });
    },
  );

  test(
    'send over the daily outgoing cap → 429 rate_limited',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const alice = await provisionAccountWithHandle(testPool, 'rl-a');
      const target = await provisionAccountWithHandle(testPool, 'rl-t');
      // why: seed exactly MAX_OUTGOING_PENDING_PER_DAY (20) pending outgoing
      // rows for Alice via SQL (fast bulk), so the next real send hits the
      // cap. requested_at defaults to now(), inside the trailing-24h window.
      const aliceRow = await testPool.query(
        'SELECT player_id FROM legendary.players WHERE ext_id = $1',
        [alice.accountId],
      );
      const alicePlayerId = aliceRow.rows[0].player_id;
      for (let i = 0; i < 20; i = i + 1) {
        const dummyExt = randomUUID();
        const dummy = await testPool.query(
          'INSERT INTO legendary.players (ext_id, email, display_name, auth_provider, auth_provider_id) ' +
            'VALUES ($1, $2, $3, $4, $5) RETURNING player_id',
          [dummyExt, `${dummyExt}@example.com`, `RL Dummy ${i}`, 'email', `${dummyExt}-sub`],
        );
        await testPool.query(
          "INSERT INTO legendary.friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')",
          [alicePlayerId, dummy.rows[0].player_id],
        );
      }

      const send = makeContext({ body: { handle: target.handle } });
      await handlersForActor(alice.accountId).get('POST /api/me/friends/requests')!(send);
      assert.equal(send.status, 429);
      assert.deepEqual(send.body, { error: 'rate_limited' });
    },
  );
});
