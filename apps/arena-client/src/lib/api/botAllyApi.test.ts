import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchBotAllyStatus } from './botAllyApi';

/**
 * Tests for the bot-ally status HTTP wrapper (WP-415 / EC-450). A route
 * `globalThis.fetch` stub drives it. Unlike the never-throws matchLagnApi, this
 * wrapper THROWS a full-sentence error on any non-2xx / unparseable body — the
 * useBotAllyStatus caller owns the fail-soft policy.
 */

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('parses a 200 status body into the typed { driving, status, message } shape', async () => {
  globalThis.fetch = (async () =>
    ({ status: 200, json: async () => ({ driving: true, status: 'active', message: null }) }) as Response) as typeof globalThis.fetch;

  const result = await fetchBotAllyStatus('m1');

  assert.deepEqual(result, { driving: true, status: 'active', message: null });
});

test('carries a faulted message through unchanged', async () => {
  const message = 'The bot ally could not finish its turn, so the match was stopped.';
  globalThis.fetch = (async () =>
    ({ status: 200, json: async () => ({ driving: false, status: 'faulted', message }) }) as Response) as typeof globalThis.fetch;

  const result = await fetchBotAllyStatus('m1');

  assert.equal(result.status, 'faulted');
  assert.equal(result.message, message);
});

test('throws a full-sentence error on a non-200 response', async () => {
  globalThis.fetch = (async () =>
    ({ status: 500, json: async () => ({}) }) as Response) as typeof globalThis.fetch;

  await assert.rejects(() => fetchBotAllyStatus('m1'), /returned HTTP 500/);
});

test('throws a full-sentence error on a network failure', async () => {
  globalThis.fetch = (async () => {
    throw new Error('connection refused');
  }) as typeof globalThis.fetch;

  await assert.rejects(() => fetchBotAllyStatus('m1'), /could not reach the server/);
});

test('throws a full-sentence error on an unparseable 200 body', async () => {
  globalThis.fetch = (async () =>
    ({
      status: 200,
      json: async () => {
        throw new Error('unexpected end of JSON input');
      },
    }) as unknown as Response) as typeof globalThis.fetch;

  await assert.rejects(() => fetchBotAllyStatus('m1'), /was not valid JSON/);
});
