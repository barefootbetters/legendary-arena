/**
 * Friends API Client tests (WP-352 / EC-382).
 *
 * Exercises the six wrappers against a stubbed `globalThis.fetch`: the
 * success paths (method + Authorization + parsed value), the typed
 * error-code mapping read from `body.error`, the network-throw path, and
 * a drift test pinning the client-local `FRIEND_API_ERROR_CODES` mirror
 * to the WP-351 server union. Pure `node:test` + `node:assert`; no
 * network, no database, no boardgame.io.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchFriends,
  fetchFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  FRIEND_API_ERROR_CODES,
  type FriendSummary,
} from './friendsApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Install a `globalThis.fetch` stub that records every call and resolves
 * to a minimal Response-like object with the given status and JSON body.
 */
function installFetchStub(
  status: number,
  jsonBody: unknown,
): { calls: CapturedRequest[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { status, json: async () => jsonBody } as Response;
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Install a `globalThis.fetch` stub that throws, simulating a network
 * failure.
 */
function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the friends API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function sampleFriend(overrides: Partial<FriendSummary> = {}): FriendSummary {
  return {
    handle: 'nova',
    displayName: 'Nova',
    status: 'accepted',
    direction: 'outgoing',
    requestedAt: '2026-07-11T00:00:00.000Z',
    respondedAt: null,
    ...overrides,
  };
}

test('fetchFriends returns the friends array on 200 with a Bearer header', async () => {
  const stub = installFetchStub(200, { friends: [sampleFriend()] });
  try {
    const result = await fetchFriends('token-abc');
    assert.ok(result.ok === true);
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.handle, 'nova');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/friends'));
    assert.equal(call.init.method, 'GET');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('fetchFriendRequests returns both lists on 200', async () => {
  const stub = installFetchStub(200, {
    incoming: [sampleFriend({ handle: 'a', direction: 'incoming', status: 'pending' })],
    outgoing: [sampleFriend({ handle: 'b', direction: 'outgoing', status: 'pending' })],
  });
  try {
    const result = await fetchFriendRequests('t');
    assert.ok(result.ok === true);
    assert.equal(result.value.incoming[0]?.handle, 'a');
    assert.equal(result.value.outgoing[0]?.handle, 'b');
  } finally {
    stub.restore();
  }
});

test('sendFriendRequest posts {handle} and returns the FriendSummary on 201', async () => {
  const stub = installFetchStub(201, sampleFriend({ handle: 'bob', status: 'pending' }));
  try {
    const result = await sendFriendRequest('t', 'bob');
    assert.ok(result.ok === true);
    assert.equal(result.value.handle, 'bob');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/friends/requests'));
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(JSON.parse(String(call.init.body)), { handle: 'bob' });
  } finally {
    stub.restore();
  }
});

test('sendFriendRequest maps a 409 body.error to the typed code', async () => {
  const stub = installFetchStub(409, { error: 'already_pending' });
  try {
    const result = await sendFriendRequest('t', 'bob');
    assert.ok(result.ok === false);
    assert.equal(result.status, 409);
    assert.equal(result.code, 'already_pending');
  } finally {
    stub.restore();
  }
});

test('sendFriendRequest maps an unrecognized body.error to null code', async () => {
  const stub = installFetchStub(400, { error: 'totally_unknown' });
  try {
    const result = await sendFriendRequest('t', 'bob');
    assert.ok(result.ok === false);
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('acceptFriendRequest targets the :handle path and returns on 200', async () => {
  const stub = installFetchStub(200, sampleFriend({ handle: 'bob', status: 'accepted', direction: 'incoming' }));
  try {
    const result = await acceptFriendRequest('t', 'bob');
    assert.ok(result.ok === true);
    assert.equal(result.value.status, 'accepted');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/friends/requests/bob/accept'));
    assert.equal(call.init.method, 'POST');
  } finally {
    stub.restore();
  }
});

test('declineFriendRequest targets the :handle path and returns on 200', async () => {
  const stub = installFetchStub(200, sampleFriend({ handle: 'bob', status: 'declined', direction: 'incoming' }));
  try {
    const result = await declineFriendRequest('t', 'bob');
    assert.ok(result.ok === true);
    assert.equal(result.value.status, 'declined');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/friends/requests/bob/decline'));
  } finally {
    stub.restore();
  }
});

test('removeFriend returns { ok: true } on 204 via DELETE', async () => {
  const stub = installFetchStub(204, null);
  try {
    const result = await removeFriend('t', 'bob');
    assert.deepEqual(result, { ok: true });
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/friends/bob'));
    assert.equal(call.init.method, 'DELETE');
  } finally {
    stub.restore();
  }
});

test('removeFriend maps a 404 body.error to not_friends', async () => {
  const stub = installFetchStub(404, { error: 'not_friends' });
  try {
    const result = await removeFriend('t', 'bob');
    assert.ok(result.ok === false);
    assert.equal(result.status, 404);
    assert.equal(result.code, 'not_friends');
  } finally {
    stub.restore();
  }
});

test('a network throw yields { ok:false, status:0, code:null } on every wrapper', async () => {
  const stub = installThrowingFetchStub();
  try {
    assert.deepEqual(await fetchFriends('t'), { ok: false, status: 0, code: null });
    assert.deepEqual(await fetchFriendRequests('t'), { ok: false, status: 0, code: null });
    assert.deepEqual(await sendFriendRequest('t', 'x'), { ok: false, status: 0, code: null });
    assert.deepEqual(await acceptFriendRequest('t', 'x'), { ok: false, status: 0, code: null });
    assert.deepEqual(await declineFriendRequest('t', 'x'), { ok: false, status: 0, code: null });
    assert.deepEqual(await removeFriend('t', 'x'), { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('a null authToken sends no Authorization header', async () => {
  const stub = installFetchStub(200, { friends: [] });
  try {
    await fetchFriends(null);
    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal('Authorization' in headers, false);
  } finally {
    stub.restore();
  }
});

test('FRIEND_API_ERROR_CODES mirrors the WP-351 server union exactly (drift guard)', () => {
  // why: this list is a client-local mirror of the server's
  // FriendApiErrorCode union; a failure here means the mirror drifted from
  // the server contract and must be brought back into lockstep.
  const expectedServerUnion = [
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
  ];
  assert.equal(FRIEND_API_ERROR_CODES.length, expectedServerUnion.length);
  assert.equal(new Set(FRIEND_API_ERROR_CODES).size, expectedServerUnion.length);
  assert.deepEqual(
    [...FRIEND_API_ERROR_CODES].sort(),
    [...expectedServerUnion].sort(),
  );
});
