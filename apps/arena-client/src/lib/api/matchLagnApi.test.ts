/**
 * Tests for the current-match LAGN fetch wrapper (WP-363 / EC-393).
 *
 * Stubs `globalThis.fetch` (mirrors AutoplayControls.test.ts) to exercise every
 * branch of the never-throws contract: 200 → `{ ok, lagn }`; 401/403/404 →
 * `{ ok:false, status }`; a thrown fetch or a malformed 200 body →
 * `{ ok:false, status:0 }`; and the `Authorization: Bearer` header present /
 * absent by token.
 *
 * Authority: WP-363 §Scope (In) §E; EC-393; D-24155.
 */

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchMatchLagn } from './matchLagnApi';

const originalFetch: typeof globalThis.fetch | undefined = globalThis.fetch;

interface StubbedCall {
  url: string;
  init: RequestInit | undefined;
}

let calls: StubbedCall[] = [];

/** Install a fetch stub returning the supplied Response for every call. */
function stubFetch(makeResponse: () => Response | Promise<Response>): void {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    return makeResponse();
  }) as typeof globalThis.fetch;
}

/** Install a fetch stub that rejects (a network failure). */
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

describe('fetchMatchLagn', () => {
  test('200 → { ok:true, lagn } and GETs /api/match/:matchId/lagn', async () => {
    stubFetch(() => jsonResponse({ lagn: { lagn_version: '1.0.0' } }));
    const result = await fetchMatchLagn('m1', 'tok');
    assert.deepEqual(result, { ok: true, lagn: { lagn_version: '1.0.0' } });
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/api\/match\/m1\/lagn$/);
  });

  test('sends Authorization: Bearer when a token is supplied, omits it when null', async () => {
    stubFetch(() => jsonResponse({ lagn: {} }));
    await fetchMatchLagn('m1', 'secret-token');
    const withToken = calls[0]!.init?.headers as Record<string, string> | undefined;
    assert.equal(withToken?.Authorization, 'Bearer secret-token');

    stubFetch(() => jsonResponse({ lagn: {} }));
    await fetchMatchLagn('m1', null);
    const withoutToken = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
    assert.equal(withoutToken.Authorization, undefined);
  });

  test('non-200 (401/403/404) → { ok:false, status }', async () => {
    for (const status of [401, 403, 404]) {
      stubFetch(() => jsonResponse({ error: 'x' }, status));
      const result = await fetchMatchLagn('m1', 'tok');
      assert.deepEqual(result, { ok: false, status });
    }
  });

  test('a thrown fetch → { ok:false, status:0 } (never throws)', async () => {
    stubFetchThrows();
    const result = await fetchMatchLagn('m1', 'tok');
    assert.deepEqual(result, { ok: false, status: 0 });
  });

  test('a 200 with an unparseable body → { ok:false, status:0 } (never throws)', async () => {
    stubFetch(
      () =>
        new Response('not json{{{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const result = await fetchMatchLagn('m1', 'tok');
    assert.deepEqual(result, { ok: false, status: 0 });
  });
});
