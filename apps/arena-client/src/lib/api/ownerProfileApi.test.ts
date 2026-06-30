/**
 * Owner Profile API Client — avatar upload coverage (WP-298 / EC-329).
 *
 * Exercises `uploadOwnerAvatar` against a stubbed `globalThis.fetch`: the
 * success path (POST + Authorization + no Content-Type), the typed
 * error-code mapping read from `body.code`, the network-failure path, and a
 * drift test pinning the client-local `AVATAR_UPLOAD_ERROR_CODES` mirror to
 * the server union. Pure `node:test` + `node:assert`; no boardgame.io, no
 * network, no database.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  uploadOwnerAvatar,
  AVATAR_UPLOAD_ERROR_CODES,
} from './ownerProfileApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Install a `globalThis.fetch` stub that records every call and resolves to
 * a minimal Response-like object with the given status and JSON body.
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
    throw new Error('Simulated network failure for the avatar upload test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Build a small in-memory image file for the upload tests.
 */
function makeImageFile(): File {
  return new File(['fake-image-bytes'], 'avatar.png', { type: 'image/png' });
}

test('uploadOwnerAvatar returns ok with avatarUrl on 200 and sends POST + Authorization + no Content-Type', async () => {
  const expectedUrl = 'https://images.legendary-arena.com/avatars/acc-123.webp';
  const stub = installFetchStub(200, { avatarUrl: expectedUrl });
  try {
    const result = await uploadOwnerAvatar('token-abc', makeImageFile());
    assert.deepEqual(result, { ok: true, avatarUrl: expectedUrl });

    assert.equal(stub.calls.length, 1);
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/avatar'));
    assert.equal(call.init.method, 'POST');

    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-abc');
    // why: the upload must NOT carry a Content-Type header — the browser sets
    // the multipart boundary; this assertion guards that regression.
    assert.equal('Content-Type' in headers, false);

    assert.ok(call.init.body instanceof FormData);
    assert.ok((call.init.body as FormData).has('avatar'));
  } finally {
    stub.restore();
  }
});

for (const errorCode of ['invalid_mime_type', 'file_too_large'] as const) {
  test(`uploadOwnerAvatar maps a 400 ${errorCode} body to ok:false with the code preserved`, async () => {
    // why: reading the code proves the failure is parsed from body.code (not
    // body.error); a parseFailure-style body.error read would yield code null.
    const stub = installFetchStub(400, { code: errorCode, message: 'rejected' });
    try {
      const result = await uploadOwnerAvatar('token-abc', makeImageFile());
      assert.deepEqual(result, { ok: false, status: 400, code: errorCode });
    } finally {
      stub.restore();
    }
  });
}

test('uploadOwnerAvatar maps a 401 unauthorized body and omits Authorization when the token is null', async () => {
  const stub = installFetchStub(401, { code: 'unauthorized', message: 'no session' });
  try {
    const result = await uploadOwnerAvatar(null, makeImageFile());
    assert.deepEqual(result, { ok: false, status: 401, code: 'unauthorized' });

    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal('Authorization' in headers, false);
  } finally {
    stub.restore();
  }
});

test('uploadOwnerAvatar returns status 0 with a null code when fetch throws', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await uploadOwnerAvatar('token-abc', makeImageFile());
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('AVATAR_UPLOAD_ERROR_CODES mirrors the server union exactly (drift guard)', () => {
  // why: this list is a client-local mirror of the server's
  // AvatarUploadErrorCode union; a failure here means the mirror drifted from
  // the server contract and must be brought back into lockstep.
  const expectedServerUnion = [
    'invalid_mime_type',
    'file_too_large',
    'rate_limited',
    'upload_failed',
    'unauthorized',
  ];
  assert.equal(AVATAR_UPLOAD_ERROR_CODES.length, 5);
  assert.equal(new Set(AVATAR_UPLOAD_ERROR_CODES).size, 5);
  assert.deepEqual(
    [...AVATAR_UPLOAD_ERROR_CODES].sort(),
    [...expectedServerUnion].sort(),
  );
});
