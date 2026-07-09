/**
 * Competition API Client tests (WP-339 / EC-369).
 *
 * Exercises `submitCompetitiveScore` + `fetchMyScores` against a stubbed
 * `globalThis.fetch`: the 200 fresh / 200 wasExisting paths, the typed non-200
 * error mapping, and the network-failure path (`status: 0`). Asserts the submit
 * body is `{ matchId }` (never a `replayHash`) and that `Authorization: Bearer`
 * is attached only for an authenticated caller. Pure `node:test`; no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  submitCompetitiveScore,
  fetchMyScores,
  type MyCompetitiveScore,
} from './competitionApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
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
    throw new Error('Simulated network failure for the competition API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

const SAMPLE_SCORE: MyCompetitiveScore = {
  submissionId: 1,
  replayHash: 'sha256:abc',
  scenarioKey: 'scheme::mm::vg',
  rawScore: 120,
  finalScore: -5,
  parVersion: 'v1',
  scoringConfigVersion: 1,
  stateHash: 'sha256:abc',
  createdAt: '2026-07-08T00:00:00.000Z',
};

test('submitCompetitiveScore posts { matchId } with Authorization and maps a 200 fresh insert', async () => {
  const stub = installFetchStub(200, { record: SAMPLE_SCORE, wasExisting: false });
  try {
    const result = await submitCompetitiveScore('token-abc', 'match-1');
    assert.equal(result.status, 200);
    assert.equal(result.wasExisting, false);
    assert.deepEqual(result.record, SAMPLE_SCORE);
    assert.equal(result.error, null);

    assert.equal(stub.calls.length, 1);
    const call = stub.calls[0];
    assert.ok(call !== undefined);
    assert.ok(call.url.endsWith('/api/competition/scores'));
    assert.equal(call.init.method, 'POST');
    // Body is { matchId } — never a replayHash (the client cannot compute it).
    assert.deepEqual(JSON.parse(String(call.init.body)), { matchId: 'match-1' });
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer token-abc');
    assert.equal(headers['Content-Type'], 'application/json');
  } finally {
    stub.restore();
  }
});

test('submitCompetitiveScore maps a 200 idempotent retry (wasExisting: true)', async () => {
  const stub = installFetchStub(200, { record: SAMPLE_SCORE, wasExisting: true });
  try {
    const result = await submitCompetitiveScore('token-abc', 'match-1');
    assert.equal(result.status, 200);
    assert.equal(result.wasExisting, true);
    assert.deepEqual(result.record, SAMPLE_SCORE);
  } finally {
    stub.restore();
  }
});

test('submitCompetitiveScore omits Authorization for a null token', async () => {
  const stub = installFetchStub(401, { error: 'missing_token' });
  try {
    const result = await submitCompetitiveScore(null, 'match-1');
    assert.equal(result.status, 401);
    assert.equal(result.error, 'missing_token');
    assert.equal(result.record, null);
    const headers = (stub.calls[0]?.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers['Authorization'], undefined);
  } finally {
    stub.restore();
  }
});

test('submitCompetitiveScore maps a 409 match_not_finished to a typed error', async () => {
  const stub = installFetchStub(409, { error: 'match_not_finished' });
  try {
    const result = await submitCompetitiveScore('token-abc', 'match-1');
    assert.equal(result.status, 409);
    assert.equal(result.error, 'match_not_finished');
    assert.equal(result.record, null);
    assert.equal(result.wasExisting, null);
  } finally {
    stub.restore();
  }
});

test('submitCompetitiveScore returns status 0 on a network failure (never throws)', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await submitCompetitiveScore('token-abc', 'match-1');
    assert.equal(result.status, 0);
    assert.equal(result.record, null);
    assert.equal(result.error, null);
  } finally {
    stub.restore();
  }
});

test('fetchMyScores returns the scores array on 200 with Authorization', async () => {
  const stub = installFetchStub(200, { scores: [SAMPLE_SCORE] });
  try {
    const result = await fetchMyScores('token-abc');
    assert.equal(result.status, 200);
    assert.deepEqual(result.scores, [SAMPLE_SCORE]);
    assert.equal(result.error, null);
    const call = stub.calls[0];
    assert.ok(call !== undefined);
    assert.ok(call.url.endsWith('/api/me/scores'));
    assert.equal(call.init.method, 'GET');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('fetchMyScores returns status 0 on a network failure (never throws)', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await fetchMyScores('token-abc');
    assert.equal(result.status, 0);
    assert.equal(result.scores, null);
  } finally {
    stub.restore();
  }
});
