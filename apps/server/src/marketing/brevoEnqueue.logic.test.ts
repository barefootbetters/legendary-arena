/**
 * Tests — Brevo Marketing Enqueue (WP-293 / EC-325)
 *
 * Covers the fail-open wrapper (`enqueuePlayerToMarketingList`) with a
 * fake `BrevoClient` and the production factory (`createBrevoClient`)
 * with an injected fake `fetch`. No network, no global stubbing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  enqueuePlayerToMarketingList,
  createBrevoClient,
} from './brevoEnqueue.logic.js';
import type { BrevoClient } from './brevoClient.types.js';
import type { ProvisionedAccount } from '../auth/accountProvisioning.logic.js';

const fixtureAccount: ProvisionedAccount = {
  accountId: 'acc-uuid-1' as ProvisionedAccount['accountId'],
  email: 'newplayer@example.com',
  displayName: 'newplayer',
  authProvider: 'discord',
  authProviderId: 'discord-sub-123',
};

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

describe('enqueuePlayerToMarketingList (WP-293 fail-open wrapper)', () => {
  test('adds the account email to the given list on success', async () => {
    let receivedParams: { email: string; listId: number } | null = null;
    const fakeClient: BrevoClient = {
      async addContactToList(params) {
        receivedParams = params;
      },
    };

    await enqueuePlayerToMarketingList(fixtureAccount, fakeClient, 7);

    assert.deepEqual(receivedParams, {
      email: 'newplayer@example.com',
      listId: 7,
    });
  });

  test('is fail-open — a throwing client never rejects, and warns', async () => {
    const throwingClient: BrevoClient = {
      async addContactToList() {
        throw new Error('Brevo is down');
      },
    };

    const originalWarn = console.warn;
    let warnCount = 0;
    console.warn = () => {
      warnCount += 1;
    };
    try {
      // Must resolve (not reject) despite the client throwing.
      await enqueuePlayerToMarketingList(fixtureAccount, throwingClient, 7);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnCount, 1);
  });

  test('is a no-op when the client is undefined (marketing unconfigured)', async () => {
    // Should resolve without throwing and without any call.
    await enqueuePlayerToMarketingList(fixtureAccount, undefined, 7);
    assert.ok(true);
  });
});

describe('createBrevoClient (WP-293 production factory)', () => {
  test('posts to /v3/contacts with the locked body + api-key header', async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return fakeResponse(true, 201);
    }) as unknown as typeof fetch;

    const client = createBrevoClient('test-api-key', fakeFetch);
    await client.addContactToList({ email: 'a@b.com', listId: 42 });

    assert.equal(capturedUrl, 'https://api.brevo.com/v3/contacts');
    assert.equal(capturedInit?.method, 'POST');
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers['api-key'], 'test-api-key');
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      email: 'a@b.com',
      listIds: [42],
      updateEnabled: true,
    });
  });

  test('throws a full-sentence error on a non-2xx response', async () => {
    const fakeFetch = (async () =>
      fakeResponse(false, 400, 'bad request')) as unknown as typeof fetch;
    const client = createBrevoClient('test-api-key', fakeFetch);

    await assert.rejects(
      () => client.addContactToList({ email: 'a@b.com', listId: 42 }),
      /Brevo contact creation returned HTTP 400/,
    );
  });
});
