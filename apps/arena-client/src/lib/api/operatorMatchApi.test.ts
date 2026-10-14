/**
 * operatorMatchApi tests (WP-804 / EC-841).
 *
 * Drives the three operator-match wrappers against a stubbed
 * `globalThis.fetch`: eligibility is true only for 200 `{ isOperator: true }`
 * and never throws; create posts the locked body to the operator path with the
 * bearer header and throws on a non-2xx; the board read encodes the match id
 * and maps every outcome without throwing.
 */

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MatchConfiguration } from '@legendary-arena/game-engine';

import {
  createOperatorMatchWithBot,
  fetchOperatorBoard,
  fetchOperatorEligibility,
} from './operatorMatchApi';

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Stub fetch with one fixed answer and record every call.
 *
 * @param status The HTTP status to answer.
 * @param readJson What `response.json()` does.
 * @returns The recorded calls.
 */
function stubFetch(status: number, readJson: () => Promise<unknown>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: readJson,
      text: async () => 'server detail',
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return calls;
}

/** Stub fetch so every call rejects, as a network failure does. */
function stubThrowingFetch(): void {
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof globalThis.fetch;
}

const CONFIG = {
  schemeId: 'scheme-a',
  mastermindId: 'mastermind-a',
  villainGroupIds: ['villains-a'],
  henchmanGroupIds: ['henchmen-a'],
  heroDeckIds: ['hero-a', 'hero-b', 'hero-c'],
  bystandersCount: 1,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
} as MatchConfiguration;

describe('fetchOperatorEligibility (WP-804)', () => {
  test('is true for 200 { isOperator: true } and sends the bearer token', async () => {
    const calls = stubFetch(200, async () => ({ isOperator: true }));
    assert.equal(await fetchOperatorEligibility('admin-token'), true);
    assert.match(calls[0]!.url, /\/api\/admin\/operator-match\/eligibility$/);
    assert.equal(
      (calls[0]!.init?.headers as Record<string, string>).Authorization,
      'Bearer admin-token',
    );
  });

  test('is false for 403, 401 and 500', async () => {
    for (const status of [403, 401, 500]) {
      stubFetch(status, async () => ({ isOperator: true }));
      assert.equal(await fetchOperatorEligibility('token'), false, `HTTP ${status}`);
    }
  });

  test('is false for a 200 without isOperator === true', async () => {
    stubFetch(200, async () => ({ matches: [] }));
    assert.equal(await fetchOperatorEligibility('token'), false);
  });

  test('is false, without throwing, for a thrown fetch and for bad JSON', async () => {
    stubThrowingFetch();
    assert.equal(await fetchOperatorEligibility('token'), false);
    stubFetch(200, async () => {
      throw new SyntaxError('Unexpected token');
    });
    assert.equal(await fetchOperatorEligibility('token'), false);
  });
});

describe('createOperatorMatchWithBot (WP-804)', () => {
  test('posts the create-with-bot body to the operator path with the bearer header', async () => {
    const calls = stubFetch(200, async () => ({ matchId: 'op-match-1' }));
    const created = await createOperatorMatchWithBot(CONFIG, 2, 1, 'competent', 'admin-token');
    assert.deepEqual(created, { matchId: 'op-match-1' });
    assert.match(calls[0]!.url, /\/api\/admin\/operator-match\/create-with-bot$/);
    assert.equal(calls[0]!.init?.method, 'POST');
    assert.equal(
      (calls[0]!.init?.headers as Record<string, string>).Authorization,
      'Bearer admin-token',
    );
    assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), {
      numPlayers: 2,
      botCount: 1,
      policy: 'competent',
      setupData: CONFIG,
    });
  });

  test('throws a full-sentence error on a 400', async () => {
    stubFetch(400, async () => ({}));
    await assert.rejects(
      createOperatorMatchWithBot(CONFIG, 2, 1, 'random', 'admin-token'),
      /Failed to create an operator match at .*HTTP 400\. server detail/,
    );
  });
});

describe('fetchOperatorBoard (WP-804)', () => {
  test('encodes the match id into the board path', async () => {
    const calls = stubFetch(200, async () => ({ matchId: 'a/b c', operatorView: {}, botDecisions: [] }));
    await fetchOperatorBoard('a/b c', 'admin-token');
    assert.match(calls[0]!.url, /\/api\/admin\/operator-match\/a%2Fb%20c\/board$/);
    assert.equal(
      (calls[0]!.init?.headers as Record<string, string>).Authorization,
      'Bearer admin-token',
    );
  });

  test('returns ok with the body on 200', async () => {
    const body = { matchId: 'm1', operatorView: { seats: [] }, botDecisions: [] };
    stubFetch(200, async () => body);
    const result = await fetchOperatorBoard('m1', 'admin-token');
    assert.deepEqual(result, { ok: true, value: body });
  });

  test('returns the status and the server error on 409, 404 and 500', async () => {
    for (const status of [409, 404, 500]) {
      stubFetch(status, async () => ({ error: `error ${status}` }));
      const result = await fetchOperatorBoard('m1', 'admin-token');
      assert.deepEqual(result, { ok: false, status, error: `error ${status}` });
    }
  });

  test('reads reason on a 403 and falls back to a full sentence without a body', async () => {
    stubFetch(403, async () => ({ code: 'forbidden', reason: 'Admin access is required.' }));
    assert.deepEqual(await fetchOperatorBoard('m1', 't'), {
      ok: false,
      status: 403,
      error: 'Admin access is required.',
    });
    stubFetch(502, async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    });
    assert.deepEqual(await fetchOperatorBoard('m1', 't'), {
      ok: false,
      status: 502,
      error: 'The operator board could not be loaded (HTTP 502).',
    });
  });

  test('returns status 0 for a thrown fetch, without throwing', async () => {
    stubThrowingFetch();
    const result = await fetchOperatorBoard('m1', 'admin-token');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false ? result.status : -1, 0);
  });
});
