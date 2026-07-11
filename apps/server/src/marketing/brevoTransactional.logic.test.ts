/**
 * Tests — Brevo Transactional Sender (WP-353 / EC-383)
 *
 * Covers the production factory (`createBrevoTransactionalSender`) with
 * an injected fake `fetch`: the 2xx success path (correct
 * `POST /v3/smtp/email` body), and the non-2xx path (full-sentence
 * throw). No network, no global stubbing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBrevoTransactionalSender } from './brevoTransactional.logic.js';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Build a minimal `Response`-shaped object for the injected fake fetch.
 */
function fakeResponse(isOk: boolean, status: number, body = ''): Response {
  return {
    ok: isOk,
    status,
    text: async () => body,
  } as unknown as Response;
}

/**
 * Build an injected fake `fetch` that records the call and resolves to
 * the given response.
 */
function makeFakeFetch(response: Response): {
  fetchImpl: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test('createBrevoTransactionalSender posts the template email to /v3/smtp/email on 2xx', async () => {
  const { fetchImpl, calls } = makeFakeFetch(fakeResponse(true, 201));
  const sender = createBrevoTransactionalSender('brevo-key-abc', fetchImpl);

  await sender.sendTemplateEmail({
    to: 'friend@example.com',
    templateId: 42,
    params: { actorHandle: 'nova', actorDisplayName: 'Nova' },
  });

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.ok(call);
  assert.equal(call.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(call.init.method, 'POST');
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  assert.equal(headers['api-key'], 'brevo-key-abc');
  const body = JSON.parse(String(call.init.body)) as {
    to: { email: string }[];
    templateId: number;
    params: Record<string, string>;
  };
  assert.deepEqual(body.to, [{ email: 'friend@example.com' }]);
  assert.equal(body.templateId, 42);
  assert.deepEqual(body.params, { actorHandle: 'nova', actorDisplayName: 'Nova' });
});

test('createBrevoTransactionalSender throws a full-sentence error on non-2xx', async () => {
  const { fetchImpl } = makeFakeFetch(fakeResponse(false, 400, 'bad template id'));
  const sender = createBrevoTransactionalSender('brevo-key-abc', fetchImpl);

  await assert.rejects(
    () =>
      sender.sendTemplateEmail({
        to: 'friend@example.com',
        templateId: 42,
        params: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      // Full-sentence, mentions the status + the config env vars.
      assert.match(error.message, /HTTP 400/);
      assert.match(error.message, /BREVO_API_KEY/);
      assert.match(error.message, /TEMPLATE_ID/);
      return true;
    },
  );
});
