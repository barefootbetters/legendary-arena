/**
 * Tests for the owner-profile HTTP routes (WP-104 / EC-128).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handlers, a fake
 * `requireAuthenticatedSession` drives the auth branch, and a
 * `throwingDatabase` proves a handler returned before any DB access.
 * They assert the exact registered route set, the auth-first ordering
 * (401 unauthenticated / 500 unconfigured verifier), the structural
 * body-shape rejects (non-object body / non-array links → 400
 * invalid_request), and — the whole point of this file — that every
 * body-reading handler parses its own JSON off a real request stream
 * (the missing-per-route-parser defect fixed in PR #1546; see the
 * `reference_no_global_body_parser` memory).
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-104 §Scope (In); EC-128 §Locked Values; D-11504
 * (Cache-Control); D-10406 (PATCH); D-10407 (PUT); the PR #1546
 * per-route body-parser fix.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { registerOwnerProfileRoutes } from './ownerProfile.routes.js';
import type { OwnerProfileRouteDependencies } from './ownerProfile.routes.js';
import type { DatabaseClient } from './ownerProfile.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  headers: Record<string, string>;
}

/**
 * Fake Koa router that records handlers by `METHOD path` so a test can
 * invoke them directly without an HTTP listener.
 */
class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
  patch(path: string, handler: Handler): void {
    this.handlers.set(`PATCH ${path}`, handler);
  }
  put(path: string, handler: Handler): void {
    this.handlers.set(`PUT ${path}`, handler);
  }
}

function makeContext(options: { body?: unknown }): FakeContext {
  const headers: Record<string, string> = {};
  return {
    req: { headers: {} },
    request: { body: options.body },
    status: 0,
    body: undefined,
    set(field: string, value: string): void {
      headers[field] = value;
    },
    headers,
  };
}

/**
 * Build a context whose `req` is a REAL Node request stream carrying `payload`,
 * with `request.body` starting undefined — the production shape the
 * `request.body`-injecting `makeContext` cannot reproduce. Adds the minimal koa
 * surface koa-body@5 reads (`method` + `is`). Used to prove the route parses its
 * own body (the missing-parser defect fixed in PR #1546).
 */
function makeStreamContext(payload: string): FakeContext {
  const stream = Readable.from([Buffer.from(payload)]) as Readable & {
    headers: Record<string, string>;
  };
  stream.headers = {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(payload)),
  };
  const base = makeContext({});
  return Object.assign(base, {
    req: stream,
    method: 'PATCH',
    is(type: string | string[]): string | false {
      const types = Array.isArray(type) ? type : [type];
      // why: this route only ever receives JSON; report a json match so
      // koa-body@5 routes the stream through its JSON parser.
      return types.some((candidate) => candidate.includes('json'))
        ? 'application/json'
        : false;
    },
  }) as unknown as FakeContext;
}

/**
 * Build an `OwnerProfileRouteDependencies` bundle whose
 * `requireAuthenticatedSession` returns the supplied result. `verifier` /
 * `accountResolver` are left undefined — the fake never dereferences them.
 */
function makeDeps(
  sessionResult:
    | { ok: true; value: string }
    | { ok: false; reason: string; code: string },
): OwnerProfileRouteDependencies {
  return {
    requireAuthenticatedSession: async () => sessionResult,
  } as unknown as OwnerProfileRouteDependencies;
}

const authorizedSession = {
  ok: true as const,
  value: '00000000-0000-4000-8000-000000000001',
};

/**
 * A DatabaseClient whose `query` throws — proves a handler returned
 * before any DB access (auth failure / structural reject / body-parse
 * path).
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

function registerAndGet(
  deps: OwnerProfileRouteDependencies,
  database: DatabaseClient,
): Map<string, Handler> {
  const router = new FakeRouter();
  registerOwnerProfileRoutes(router, database, deps);
  return router.handlers;
}

describe('owner profile routes (WP-104)', () => {
  test('registers exactly the three locked routes', () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const keys = [...handlers.keys()].sort();
    assert.deepEqual(keys, [
      'GET /api/me/profile',
      'PATCH /api/me/profile',
      'PUT /api/me/links',
    ]);
  });

  test('unauthenticated PATCH → 401 { error: missing_token }, Cache-Control set, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({ ok: false, reason: 'no token', code: 'missing_token' }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { displayName: 'x' } });
    await handlers.get('PATCH /api/me/profile')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.deepEqual(koaContext.body, { error: 'missing_token' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('unconfigured verifier PATCH → 500 { error: session_verifier_not_configured }', async () => {
    const handlers = registerAndGet(
      makeDeps({
        ok: false,
        reason: 'not configured',
        code: 'session_verifier_not_configured',
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { displayName: 'x' } });
    await handlers.get('PATCH /api/me/profile')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, {
      error: 'session_verifier_not_configured',
    });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('PATCH with a non-object body → 400 invalid_request (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({ body: 'not-an-object' });
    await handlers.get('PATCH /api/me/profile')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_request' });
  });

  test('PUT with a non-object body → 400 invalid_request (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({ body: 'not-an-object' });
    await handlers.get('PUT /api/me/links')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_request' });
  });

  test('PUT with a non-array links field → 400 invalid_request (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({ body: { links: 'not-an-array' } });
    await handlers.get('PUT /api/me/links')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_request' });
  });

  // -------------------------------------------------------------------------
  // Production-path body parsing — the whole point of this harness.
  //
  // why: reproduces the production condition PR #1546 fixed — boardgame.io
  // installs koa-body only on /games/*, so each /api route must parse its own
  // body. Before the fix, request.body was undefined in prod and every PATCH /
  // PUT here silently failed. Here `req` is a real Node stream and request.body
  // starts undefined; the handler must parse the stream into request.body.
  // Asserted independently of the downstream logic outcome; against a handler
  // missing its ensureJsonBodyParsed call, request.body stays undefined and the
  // assertion fails — so this guards the regression.
  // -------------------------------------------------------------------------

  const streamBodyCases: Array<{ key: string; payload: Record<string, unknown> }> = [
    { key: 'PATCH /api/me/profile', payload: { displayName: 'Streamed Name' } },
    { key: 'PUT /api/me/links', payload: { links: [] } },
  ];

  for (const { key, payload } of streamBodyCases) {
    test(`${key} parses the JSON body off the request stream (production path)`, async () => {
      const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
      const handler = handlers.get(key);
      assert.ok(handler !== undefined);
      const context = makeStreamContext(JSON.stringify(payload));

      await handler(context);

      assert.deepEqual(context.request.body, payload);
    });
  }
});
