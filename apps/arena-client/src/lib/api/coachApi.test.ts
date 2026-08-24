/**
 * Coach API Client tests (WP-595 / EC-630).
 *
 * Exercises `fetchCoachReport` against a stubbed `globalThis.fetch`: the 200
 * path (report + wasCached), the typed non-200 error mapping, and the
 * network-failure path (`status: 0`). Asserts the URL encodes the replay hash and
 * that `Authorization: Bearer` is attached only for an authenticated caller.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchCoachReport, type StoredCoachReport } from './coachApi';

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

const STORED: StoredCoachReport = {
  report: { headline: 'h', heroFit: 'f', purchases: 'p', suggestions: ['a', 'b'] },
  model: 'claude-sonnet-5',
  generatedAt: '2026-08-23T00:00:00.000Z',
};

test('fetchCoachReport returns the report + wasCached on 200 with Authorization', async () => {
  const stub = installFetchStub(200, { report: STORED, wasCached: false });
  try {
    const result = await fetchCoachReport('token-abc', 'replay-xyz');
    assert.equal(result.status, 200);
    assert.deepEqual(result.report, STORED);
    assert.equal(result.wasCached, false);
    assert.equal(result.error, null);
    const call = stub.calls[0]!;
    assert.ok(call.url.endsWith('/api/me/scores/replay-xyz/coach'), call.url);
    assert.equal(
      (call.init.headers as Record<string, string>).Authorization,
      'Bearer token-abc',
    );
  } finally {
    stub.restore();
  }
});

test('fetchCoachReport maps a non-200 to a typed error code', async () => {
  const stub = installFetchStub(503, { error: 'coach_unavailable' });
  try {
    const result = await fetchCoachReport('token-abc', 'replay-xyz');
    assert.equal(result.status, 503);
    assert.equal(result.report, null);
    assert.equal(result.error, 'coach_unavailable');
  } finally {
    stub.restore();
  }
});

test('fetchCoachReport omits Authorization for a null token', async () => {
  const stub = installFetchStub(200, { report: STORED, wasCached: true });
  try {
    await fetchCoachReport(null, 'replay-xyz');
    const call = stub.calls[0]!;
    assert.equal((call.init.headers as Record<string, string>).Authorization, undefined);
  } finally {
    stub.restore();
  }
});

test('fetchCoachReport returns status 0 on a network failure (never throws)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof globalThis.fetch;
  try {
    const result = await fetchCoachReport('token-abc', 'replay-xyz');
    assert.equal(result.status, 0);
    assert.equal(result.report, null);
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
