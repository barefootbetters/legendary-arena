import '../../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { captureAnalyticsEvent, getAnalyticsSessionId } from './analyticsEmitter';
import { apiBaseUrl } from './apiBaseUrl';

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

const originalFetch = globalThis.fetch;

/** Stub globalThis.fetch to record calls; resolves ok unless `reject` is set. */
function installFetchStub(reject = false): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (reject) {
      throw new Error('network down');
    }
    return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } } as Response;
  }) as typeof globalThis.fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
});

test('captureAnalyticsEvent POSTs the payload to /api/analytics/events with keepalive', () => {
  const calls = installFetchStub();

  captureAnalyticsEvent('signup-complete', 'acct-123', { referrer_host: 'example.test' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, `${apiBaseUrl}/api/analytics/events`);
  assert.equal(calls[0]!.init?.method, 'POST');
  assert.equal((calls[0]!.init as RequestInit & { keepalive?: boolean }).keepalive, true);
  assert.equal((calls[0]!.init?.headers as Record<string, string>)['Content-Type'], 'application/json');

  const body = JSON.parse(String(calls[0]!.init?.body)) as {
    event_type: string;
    user_id: string | null;
    session_id: string;
    timestamp: number;
    properties?: Record<string, unknown>;
  };
  assert.equal(body.event_type, 'signup-complete');
  assert.equal(body.user_id, 'acct-123', 'user_id sent RAW (never hashed)');
  assert.equal(typeof body.session_id, 'string');
  assert.ok(body.session_id.length > 0);
  assert.equal(typeof body.timestamp, 'number');
  assert.deepEqual(body.properties, { referrer_host: 'example.test' });
});

test('an anonymous event sends user_id: null and omits properties when none given', () => {
  const calls = installFetchStub();

  captureAnalyticsEvent('direct', null);

  const body = JSON.parse(String(calls[0]!.init?.body)) as { user_id: string | null; properties?: unknown };
  assert.equal(body.user_id, null);
  assert.equal('properties' in body, false, 'no properties key when none supplied');
});

test('the client never hashes user_id — the raw id appears verbatim in the body', () => {
  const calls = installFetchStub();
  captureAnalyticsEvent('retention-return', 'ext-abc-XYZ');
  const body = JSON.parse(String(calls[0]!.init?.body)) as { user_id: string | null };
  // a hash would be a 64-hex digest; the raw id passes through unchanged
  assert.equal(body.user_id, 'ext-abc-XYZ');
});

test('a rejected fetch is swallowed — captureAnalyticsEvent never throws', async () => {
  installFetchStub(true);
  assert.doesNotThrow(() => captureAnalyticsEvent('paid', null));
  // let the rejected promise settle so no unhandled rejection escapes
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test('the session id is stable within a session (create-or-read)', () => {
  const first = getAnalyticsSessionId();
  const second = getAnalyticsSessionId();
  assert.equal(first, second, 'same session id on repeated reads');

  const calls = installFetchStub();
  captureAnalyticsEvent('first-match-started', 'acct-1');
  captureAnalyticsEvent('first-match-completed', 'acct-1');
  const sessionA = (JSON.parse(String(calls[0]!.init?.body)) as { session_id: string }).session_id;
  const sessionB = (JSON.parse(String(calls[1]!.init?.body)) as { session_id: string }).session_id;
  assert.equal(sessionA, sessionB);
  assert.equal(sessionA, first, 'the emitted session id matches getAnalyticsSessionId()');
});
