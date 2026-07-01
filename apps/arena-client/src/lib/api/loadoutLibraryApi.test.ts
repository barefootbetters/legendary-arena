/**
 * Loadout Library API Client — tests (WP-302 / EC-333).
 *
 * Exercises the five loadout wrappers against a stubbed
 * `globalThis.fetch`: the Bearer header is attached on the four
 * `/api/me/loadouts*` calls and absent on the guest `fetchSharedLoadout`
 * read; the success paths return `{ ok: true, value }` (or `{ ok: true }`
 * for delete's 204); a `{ error: code }` body surfaces the code
 * verbatim; a network throw maps to `{ ok: false, status: 0, code: null }`;
 * and the guest 404 maps to `{ ok: false, status: 404, code: 'not_found' }`.
 * Pure `node:test` + `node:assert`; no boardgame.io, no network, no DB.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoadout,
  deleteLoadout,
  fetchSharedLoadout,
  listLoadouts,
  updateLoadout,
} from './loadoutLibraryApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Install a `globalThis.fetch` stub that records every call and resolves
 * to a minimal Response-like object with the given status and JSON body.
 * Returns the recorded calls plus a `restore` to put the original back.
 */
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

/**
 * Install a `globalThis.fetch` stub that throws, simulating a network
 * failure. Returns a `restore` to put the original back.
 */
function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the loadout API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/** Read the `Authorization` header off a captured request's init. */
function authorizationHeader(call: CapturedRequest): string | undefined {
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

const SAVED_VIEW = {
  id: 'ld-1',
  name: 'My Deck',
  visibility: 'private',
  shareSlug: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  lagn: { lagn_version: 1, setup: {} },
};

test('listLoadouts returns ok on 200 and attaches the Bearer header', async () => {
  const stub = installFetchStub(200, { loadouts: [SAVED_VIEW] });
  try {
    const result = await listLoadouts('token-abc');
    assert.deepEqual(result, { ok: true, value: { loadouts: [SAVED_VIEW] } });

    assert.equal(stub.calls.length, 1);
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/loadouts'));
    assert.equal(call.init.method, 'GET');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('listLoadouts omits the Authorization header when the token is null', async () => {
  const stub = installFetchStub(200, { loadouts: [] });
  try {
    await listLoadouts(null);
    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal('Authorization' in headers, false);
  } finally {
    stub.restore();
  }
});

test('createLoadout returns ok on 201 and POSTs { name, lagn } with the Bearer header', async () => {
  const stub = installFetchStub(201, SAVED_VIEW);
  const lagn = { lagn_version: 1, setup: { mastermind: { id: 'm1' } } };
  try {
    const result = await createLoadout('token-abc', { name: 'My Deck', lagn });
    assert.deepEqual(result, { ok: true, value: SAVED_VIEW });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/loadouts'));
    assert.equal(call.init.method, 'POST');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');

    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      name: 'My Deck',
      lagn,
    });
  } finally {
    stub.restore();
  }
});

test('createLoadout surfaces a typed error code from the { error } body', async () => {
  const stub = installFetchStub(409, { error: 'loadout_limit_reached' });
  try {
    const result = await createLoadout('token-abc', {
      name: 'Overflow',
      lagn: {},
    });
    assert.deepEqual(result, {
      ok: false,
      status: 409,
      code: 'loadout_limit_reached',
    });
  } finally {
    stub.restore();
  }
});

test('createLoadout maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await createLoadout('token-abc', { name: 'X', lagn: {} });
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('updateLoadout returns the updated view on 200 and PATCHes the patch body', async () => {
  const madePublic = { ...SAVED_VIEW, visibility: 'public', shareSlug: 'abc123' };
  const stub = installFetchStub(200, madePublic);
  try {
    const result = await updateLoadout('token-abc', 'ld-1', {
      visibility: 'public',
    });
    assert.deepEqual(result, { ok: true, value: madePublic });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/loadouts/ld-1'));
    assert.equal(call.init.method, 'PATCH');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      visibility: 'public',
    });
  } finally {
    stub.restore();
  }
});

test('deleteLoadout returns ok on 204 with no value', async () => {
  const stub = installFetchStub(204, null);
  try {
    const result = await deleteLoadout('token-abc', 'ld-1');
    assert.deepEqual(result, { ok: true });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/loadouts/ld-1'));
    assert.equal(call.init.method, 'DELETE');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('deleteLoadout surfaces a typed not_found on 404', async () => {
  const stub = installFetchStub(404, { error: 'not_found' });
  try {
    const result = await deleteLoadout('token-abc', 'missing');
    assert.deepEqual(result, { ok: false, status: 404, code: 'not_found' });
  } finally {
    stub.restore();
  }
});

test('fetchSharedLoadout returns ok on 200 and attaches NO Authorization header', async () => {
  const publicView = {
    name: 'My Deck',
    lagn: { lagn_version: 1, setup: {} },
    displayHandle: 'ScarletFox',
  };
  const stub = installFetchStub(200, publicView);
  try {
    const result = await fetchSharedLoadout('abc123');
    assert.deepEqual(result, { ok: true, value: publicView });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/loadouts/abc123'));
    assert.equal(call.init.method, 'GET');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    // why: the guest read must never carry a Bearer — it returns public-only
    // data and this assertion guards against copying the auth attach here.
    assert.equal('Authorization' in headers, false);
  } finally {
    stub.restore();
  }
});

test('fetchSharedLoadout maps a private/unknown slug 404 to not_found', async () => {
  const stub = installFetchStub(404, { error: 'not_found' });
  try {
    const result = await fetchSharedLoadout('private-or-unknown');
    assert.deepEqual(result, { ok: false, status: 404, code: 'not_found' });
  } finally {
    stub.restore();
  }
});

test('fetchSharedLoadout maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await fetchSharedLoadout('abc123');
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});
