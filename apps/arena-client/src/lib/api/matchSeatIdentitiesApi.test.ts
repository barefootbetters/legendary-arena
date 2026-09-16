/**
 * Tests for the finished-match seat-identities fetch wrapper
 * (INFRA: endgame seat names).
 *
 * Stubs `globalThis.fetch` (mirrors matchLagnApi.test.ts) to exercise the
 * never-throws contract: 200 → the roster array; any non-200 (incl. the 404
 * before gameover) → `null`; a thrown fetch or a malformed / non-array 200 body →
 * `null`; and asserts NO `Authorization` header (public read) plus the GET path.
 *
 * Authority: INFRA (endgame seat names); WP-593 / D-24402 (projection);
 * matchLagnApi.test.ts (harness precedent).
 */

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchMatchSeatIdentities } from './matchSeatIdentitiesApi';

const originalFetch: typeof globalThis.fetch | undefined = globalThis.fetch;

interface StubbedCall {
  url: string;
  init: RequestInit | undefined;
}

let calls: StubbedCall[] = [];

function stubFetch(makeResponse: () => Response | Promise<Response>): void {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    return makeResponse();
  }) as typeof globalThis.fetch;
}

function stubFetchThrows(): void {
  calls = [];
  globalThis.fetch = (async () => {
    throw new TypeError('network down');
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ROSTER = [
  { playerId: '0', isBot: false, handle: 'jeff' },
  { playerId: '1', isBot: true, handle: null },
];

describe('fetchMatchSeatIdentities', () => {
  test('200 → the roster array, via GET /api/match/:matchId/seat-identities with no auth header', async () => {
    stubFetch(() => jsonResponse({ seatIdentities: ROSTER }));
    const result = await fetchMatchSeatIdentities('m1');
    assert.deepEqual(result, ROSTER);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/api\/match\/m1\/seat-identities$/);
    const headers = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
  });

  test('non-200 (incl. 404 match_not_finished) → null', async () => {
    for (const status of [404, 500]) {
      stubFetch(() => jsonResponse({ error: 'x' }, status));
      const result = await fetchMatchSeatIdentities('m1');
      assert.equal(result, null);
    }
  });

  test('a 200 whose body has no seatIdentities array → null', async () => {
    stubFetch(() => jsonResponse({ seatIdentities: 'nope' }));
    assert.equal(await fetchMatchSeatIdentities('m1'), null);

    stubFetch(() => jsonResponse({}));
    assert.equal(await fetchMatchSeatIdentities('m1'), null);
  });

  test('a thrown fetch → null (never throws)', async () => {
    stubFetchThrows();
    assert.equal(await fetchMatchSeatIdentities('m1'), null);
  });

  test('a 200 with an unparseable body → null (never throws)', async () => {
    stubFetch(
      () =>
        new Response('not json{{{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    assert.equal(await fetchMatchSeatIdentities('m1'), null);
  });
});
