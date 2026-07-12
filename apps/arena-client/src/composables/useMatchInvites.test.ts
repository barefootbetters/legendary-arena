/**
 * useMatchInvites composable tests (WP-360 / EC-390).
 *
 * Drives the composable against a route-based `globalThis.fetch` stub.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { useMatchInvites } from './useMatchInvites';
import type { MatchInviteView } from '../lib/api/matchInvitesApi';

interface StubResponse {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
let routeHandler: (url: string, init: RequestInit) => StubResponse;

beforeEach(() => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const { status, body } = routeHandler(String(url), init ?? {});
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function invite(matchId: string): MatchInviteView {
  return {
    matchId,
    inviterHandle: 'nova',
    inviterDisplayName: 'Nova',
    status: 'pending',
    createdAt: '2026-07-11T00:00:00.000Z',
  };
}

test('load() populates invites from GET /api/me/match-invites', async () => {
  routeHandler = () => ({ status: 200, body: { invites: [invite('m1'), invite('m2')] } });
  const { invites, isLoading, load } = useMatchInvites(() => 'token');
  await load();
  assert.equal(isLoading.value, false);
  assert.equal(invites.value.length, 2);
});

test('accept() posts then refetches the authoritative list', async () => {
  let listCallCount = 0;
  routeHandler = (url, init) => {
    if (url.endsWith('/accept') && init.method === 'POST') {
      return { status: 200, body: { matchId: 'm1' } };
    }
    // the refetch after accept returns an empty list
    listCallCount += 1;
    return { status: 200, body: { invites: listCallCount >= 2 ? [] : [invite('m1')] } };
  };
  const { invites, accept, load } = useMatchInvites(() => 'token');
  await load();
  assert.equal(invites.value.length, 1);
  const ok = await accept('m1');
  assert.equal(ok, true);
  assert.equal(invites.value.length, 0, 'accept refetches; the accepted invite is gone');
});

test('decline() sets errorCode on failure and leaves the list intact', async () => {
  routeHandler = (url, init) => {
    if (url.endsWith('/decline') && init.method === 'POST') {
      return { status: 404, body: { error: 'invite_not_found' } };
    }
    return { status: 200, body: { invites: [invite('m1')] } };
  };
  const { invites, errorCode, decline, load } = useMatchInvites(() => 'token');
  await load();
  const ok = await decline('m1');
  assert.equal(ok, false);
  assert.equal(errorCode.value, 'invite_not_found');
  assert.equal(invites.value.length, 1);
});
