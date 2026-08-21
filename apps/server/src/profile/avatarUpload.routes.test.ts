/**
 * Tests for the avatar-upload HTTP route (WP-106 / D-10602).
 *
 * All tests are pure (no live database, no HTTP listener, no R2): a
 * fake Koa router captures the registered handler and a fake
 * `requireAuthenticatedSession` drives the auth branch. This route
 * parses a MULTIPART body via `@koa/multer` (not the shared JSON
 * `ensureJsonBodyParsed` helper), so the #1546 JSON-stream regression
 * guard does not apply here — the multipart success path needs a real
 * multipart stream plus R2 mocking and is intentionally out of scope.
 * The harness asserts the exact registered route and the auth-first
 * ordering (401 before any multipart parse / DB / R2 access).
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-106 §Scope (In); D-10602 (endpoint contract); D-11202
 * (bearer header); D-11504 (Cache-Control first-statement).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerAvatarUploadRoutes } from './avatarUpload.routes.js';
import type {
  AvatarUploadRouteDependencies,
  DatabaseClient,
} from './avatarUpload.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  status: number;
  body: unknown;
  file?: { buffer: Buffer; mimetype: string; size: number };
  set(field: string, value: string): void;
  headers: Record<string, string>;
}

/**
 * Fake Koa router that records handlers by `METHOD path` so a test can
 * invoke them directly without an HTTP listener. `post` is variadic to
 * match the `@koa/router` `post(path, ...handlers)` signature; the
 * avatar route registers a single handler, captured here.
 */
class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  post(path: string, ...handlers: Handler[]): void {
    this.handlers.set(`POST ${path}`, handlers[handlers.length - 1]);
  }
}

function makeContext(): FakeContext {
  const headers: Record<string, string> = {};
  return {
    req: { headers: {} },
    request: { body: undefined },
    status: 0,
    body: undefined,
    set(field: string, value: string): void {
      headers[field] = value;
    },
    headers,
  };
}

/**
 * Build an `AvatarUploadRouteDependencies` bundle whose
 * `requireAuthenticatedSession` returns the supplied result. `r2Client` /
 * `r2BucketName` are sentinels — an unauthenticated request returns before
 * any R2 access, so they are never dereferenced.
 */
function makeDeps(
  sessionResult:
    | { ok: true; value: string }
    | { ok: false; reason: string; code: string },
): AvatarUploadRouteDependencies {
  return {
    requireAuthenticatedSession: async () => sessionResult,
    r2Client: {},
    r2BucketName: 'test-bucket',
  } as unknown as AvatarUploadRouteDependencies;
}

/**
 * A DatabaseClient whose `query` throws — proves an unauthenticated
 * request returned before any DB access.
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

function registerAndGet(
  deps: AvatarUploadRouteDependencies,
  database: DatabaseClient,
): Map<string, Handler> {
  const router = new FakeRouter();
  registerAvatarUploadRoutes(router, database, deps);
  return router.handlers;
}

describe('avatar upload routes (WP-106)', () => {
  test('registers exactly the one locked route', () => {
    const handlers = registerAndGet(
      makeDeps({ ok: true, value: '00000000-0000-4000-8000-000000000001' }),
      throwingDatabase,
    );
    const keys = [...handlers.keys()];
    assert.deepEqual(keys, ['POST /api/me/avatar']);
  });

  test('unauthenticated upload → 401 unauthorized, Cache-Control set, DB untouched (before multipart/R2)', async () => {
    const handlers = registerAndGet(
      makeDeps({ ok: false, reason: 'no token', code: 'missing_token' }),
      throwingDatabase,
    );
    const koaContext = makeContext();
    await handlers.get('POST /api/me/avatar')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.equal((koaContext.body as { code: string }).code, 'unauthorized');
    assert.equal(
      typeof (koaContext.body as { message: string }).message,
      'string',
    );
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });
});
