/**
 * matchInvitesApi tests (WP-360 / EC-390).
 *
 * Exercises the three invitee-side wrappers against a stubbed
 * `globalThis.fetch`, plus a drift test pinning the client-local
 * `MATCH_INVITE_API_ERROR_CODES` mirror to the WP-358 server union.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchMatchInvites,
  acceptMatchInvite,
  declineMatchInvite,
  MATCH_INVITE_API_ERROR_CODES,
  type MatchInviteView,
} from './matchInvitesApi';

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

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

function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the match-invites API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function sampleInvite(overrides: Partial<MatchInviteView> = {}): MatchInviteView {
  return {
    matchId: 'match-1',
    inviterHandle: 'nova',
    inviterDisplayName: 'Nova',
    status: 'pending',
    createdAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

test('fetchMatchInvites returns the invites array on 200 with a Bearer header', async () => {
  const stub = installFetchStub(200, { invites: [sampleInvite()] });
  try {
    const result = await fetchMatchInvites('token-abc');
    assert.ok(result.ok === true);
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.matchId, 'match-1');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/match-invites'));
    assert.equal(call.init.method, 'GET');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('acceptMatchInvite returns { matchId } on 200', async () => {
  const stub = installFetchStub(200, { matchId: 'match-1' });
  try {
    const result = await acceptMatchInvite('token', 'match-1');
    assert.ok(result.ok === true);
    assert.equal(result.value.matchId, 'match-1');
    assert.ok(stub.calls[0]?.url.endsWith('/api/me/match-invites/match-1/accept'));
    assert.equal(stub.calls[0]?.init.method, 'POST');
  } finally {
    stub.restore();
  }
});

test('declineMatchInvite returns ok on 204', async () => {
  const stub = installFetchStub(204, {});
  try {
    const result = await declineMatchInvite('token', 'match-1');
    assert.ok(result.ok === true);
    assert.ok(stub.calls[0]?.url.endsWith('/api/me/match-invites/match-1/decline'));
  } finally {
    stub.restore();
  }
});

test('a 404 invite_not_found is parsed into the failure branch', async () => {
  const stub = installFetchStub(404, { error: 'invite_not_found' });
  try {
    const result = await acceptMatchInvite('token', 'gone');
    assert.ok(result.ok === false);
    assert.equal(result.status, 404);
    assert.equal(result.code, 'invite_not_found');
  } finally {
    stub.restore();
  }
});

test('a network throw yields { ok:false, status:0, code:null }', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await fetchMatchInvites('token');
    assert.ok(result.ok === false);
    assert.equal(result.status, 0);
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('MATCH_INVITE_API_ERROR_CODES mirrors the WP-358 server union exactly (drift guard)', () => {
  const expectedServerUnion = [
    'self_invite',
    'not_in_match',
    'not_friends',
    'already_invited',
    'invite_not_found',
    'unknown_account',
    'unauthorized',
    'invalid_request',
    'handle_not_found',
  ];
  assert.equal(MATCH_INVITE_API_ERROR_CODES.length, expectedServerUnion.length);
  assert.equal(
    new Set(MATCH_INVITE_API_ERROR_CODES).size,
    expectedServerUnion.length,
  );
  assert.deepEqual(
    [...MATCH_INVITE_API_ERROR_CODES].sort(),
    [...expectedServerUnion].sort(),
  );
});
