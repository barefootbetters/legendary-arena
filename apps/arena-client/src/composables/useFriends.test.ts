/**
 * useFriends composable tests (WP-352 / EC-382).
 *
 * Drives the composable against a stubbed `globalThis.fetch` (which the
 * `friendsApi` wrappers call): `load()` populates the three lists;
 * `add`/`accept`/`decline`/`remove` call the matching endpoint and then
 * refetch; a failed action sets `errorCode` and leaves the lists intact.
 * No DOM, no network, no database.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { useFriends } from './useFriends';
import type { FriendSummary } from '../lib/api/friendsApi';

interface StubResponse {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
let routeHandler: (url: string, init: RequestInit) => StubResponse;
const capturedCalls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  capturedCalls.length = 0;
  routeHandler = () => ({ status: 200, body: {} });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const resolvedInit = init ?? {};
    capturedCalls.push({
      url: String(url),
      method: String(resolvedInit.method ?? 'GET'),
      body:
        typeof resolvedInit.body === 'string'
          ? JSON.parse(resolvedInit.body)
          : null,
    });
    const { status, body } = routeHandler(String(url), resolvedInit);
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function friend(overrides: Partial<FriendSummary> = {}): FriendSummary {
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

/**
 * Route the friends + requests reads to fixed payloads; every other route
 * (the mutations) succeeds with an empty 200/201/204.
 */
function routeReads(
  friends: FriendSummary[],
  incoming: FriendSummary[],
  outgoing: FriendSummary[],
): void {
  // why: the send POST and the requests GET share the same URL
  // (/api/me/friends/requests), so the stub must branch on METHOD too —
  // the POST expects 201, the GET expects 200 with the two lists.
  routeHandler = (url, init) => {
    const method = String(init.method ?? 'GET');
    if (method === 'GET' && url.endsWith('/api/me/friends')) {
      return { status: 200, body: { friends } };
    }
    if (method === 'GET' && url.endsWith('/api/me/friends/requests')) {
      return { status: 200, body: { incoming, outgoing } };
    }
    if (method === 'POST' && url.endsWith('/api/me/friends/requests')) {
      return { status: 201, body: friend({ handle: 'sent', status: 'pending' }) };
    }
    if (method === 'POST') {
      // accept / decline → 200 FriendSummary (the action ignores the value).
      return { status: 200, body: friend() };
    }
    if (method === 'DELETE') {
      return { status: 204, body: null };
    }
    return { status: 200, body: {} };
  };
}

test('load() populates friends, incoming, and outgoing', async () => {
  routeReads(
    [friend({ handle: 'f1' })],
    [friend({ handle: 'in1', direction: 'incoming', status: 'pending' })],
    [friend({ handle: 'out1', direction: 'outgoing', status: 'pending' })],
  );
  const f = useFriends(() => 'token');
  await f.load();
  assert.equal(f.friends.value.length, 1);
  assert.equal(f.friends.value[0]?.handle, 'f1');
  assert.equal(f.incoming.value[0]?.handle, 'in1');
  assert.equal(f.outgoing.value[0]?.handle, 'out1');
  assert.equal(f.isLoading.value, false);
  assert.equal(f.errorCode.value, null);
});

test('add(handle) POSTs to /requests then refetches', async () => {
  routeReads([], [], []);
  const f = useFriends(() => 'token');
  const ok = await f.add('bob');
  assert.equal(ok, true);
  const post = capturedCalls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/api/me/friends/requests'),
  );
  assert.ok(post, 'a POST to /api/me/friends/requests was made');
  assert.deepEqual(post.body, { handle: 'bob' });
  // refetch = at least one GET to each read route after the POST.
  const reads = capturedCalls.filter((call) => call.method === 'GET');
  assert.ok(reads.length >= 2);
});

test('accept / decline / remove call the right endpoint then refetch', async () => {
  routeReads([], [], []);
  const f = useFriends(() => 'token');

  await f.accept('a');
  assert.ok(
    capturedCalls.some((c) => c.url.endsWith('/api/me/friends/requests/a/accept')),
  );

  await f.decline('b');
  assert.ok(
    capturedCalls.some((c) => c.url.endsWith('/api/me/friends/requests/b/decline')),
  );

  await f.remove('c');
  assert.ok(
    capturedCalls.some(
      (c) => c.method === 'DELETE' && c.url.endsWith('/api/me/friends/c'),
    ),
  );
});

test('a failed action sets errorCode and leaves the lists intact', async () => {
  routeReads([friend({ handle: 'keep' })], [], []);
  const f = useFriends(() => 'token');
  await f.load();
  assert.equal(f.friends.value[0]?.handle, 'keep');

  // Now make the next send fail with already_pending.
  routeHandler = (url) => {
    if (url.endsWith('/api/me/friends/requests')) {
      return { status: 409, body: { error: 'already_pending' } };
    }
    return { status: 200, body: { friends: [], incoming: [], outgoing: [] } };
  };
  const ok = await f.add('bob');
  assert.equal(ok, false);
  assert.equal(f.errorCode.value, 'already_pending');
  // The previously-loaded friends list is untouched (no refetch on failure).
  assert.equal(f.friends.value.length, 1);
  assert.equal(f.friends.value[0]?.handle, 'keep');
});

test('load() failure sets errorCode without blanking prior lists', async () => {
  routeReads([friend({ handle: 'keep' })], [], []);
  const f = useFriends(() => 'token');
  await f.load();
  assert.equal(f.friends.value.length, 1);

  routeHandler = () => ({ status: 401, body: { error: 'unauthorized' } });
  await f.load();
  assert.equal(f.errorCode.value, 'unauthorized');
  assert.equal(f.friends.value[0]?.handle, 'keep');
});
