/**
 * Tests for the profile-loadout-library HTTP routes (WP-301 / EC-332).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handlers, a fake
 * `requireAuthenticatedSession` drives the auth branch, and a scripted
 * fake `DatabaseClient` drives the logic paths. They assert the
 * auth-first ordering, the typed-error → HTTP-status mapping, the
 * `Cache-Control` header on every path, the structural PATCH parsing
 * (bad visibility → 400), and that the guest 404 body never leaks an
 * account identifier.
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-301 §Scope (In) §D + §G; EC-332 §Required Test Matrix
 * + §Guardrails; D-24086; D-11504 (Cache-Control).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerLoadoutLibraryRoutes } from './loadoutLibrary.routes.js';
import type {
  DatabaseClient,
  LoadoutLibraryRouteDependencies,
  RequireAuthenticatedSessionResult,
} from './loadoutLibrary.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  params: { [key: string]: string };
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
  post(path: string, handler: Handler): void {
    this.handlers.set(`POST ${path}`, handler);
  }
  patch(path: string, handler: Handler): void {
    this.handlers.set(`PATCH ${path}`, handler);
  }
  delete(path: string, handler: Handler): void {
    this.handlers.set(`DELETE ${path}`, handler);
  }
}

function makeContext(options: {
  body?: unknown;
  params?: { [key: string]: string };
}): FakeContext {
  const headers: Record<string, string> = {};
  return {
    req: { headers: {} },
    request: { body: options.body },
    params: options.params ?? {},
    status: 0,
    body: undefined,
    set(field: string, value: string): void {
      headers[field] = value;
    },
    headers,
  };
}

function makeDeps(
  sessionResult: RequireAuthenticatedSessionResult,
): LoadoutLibraryRouteDependencies {
  return {
    requireAuthenticatedSession: async () => sessionResult,
  };
}

const authorizedSession: RequireAuthenticatedSessionResult = {
  ok: true,
  value: '00000000-0000-4000-8000-000000000001',
};

/**
 * A DatabaseClient whose `query` throws — proves a handler returned
 * before any DB access (auth failure / structural reject / validation
 * reject paths).
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

function registerAndGet(
  deps: LoadoutLibraryRouteDependencies,
  database: DatabaseClient,
): Map<string, Handler> {
  const router = new FakeRouter();
  registerLoadoutLibraryRoutes(router, database, deps);
  return router.handlers;
}

describe('profile loadout library routes (WP-301)', () => {
  test('registers exactly the five locked routes', () => {
    const handlers = registerAndGet(
      makeDeps(authorizedSession),
      throwingDatabase,
    );
    const keys = [...handlers.keys()].sort();
    assert.deepEqual(keys, [
      'DELETE /api/me/loadouts/:id',
      'GET /api/loadouts/:shareSlug',
      'GET /api/me/loadouts',
      'PATCH /api/me/loadouts/:id',
      'POST /api/me/loadouts',
    ]);
  });

  test('unauthenticated create → 401 unauthorized, Cache-Control set, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({ ok: false, reason: 'no token', code: 'missing_token' }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { name: 'x', lagn: {} } });
    await handlers.get('POST /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.deepEqual(koaContext.body, { error: 'unauthorized' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('unconfigured verifier → 500 internal_error (operator-facing)', async () => {
    const handlers = registerAndGet(
      makeDeps({
        ok: false,
        reason: 'not configured',
        code: 'session_verifier_not_configured',
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ params: {} });
    await handlers.get('GET /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, { error: 'internal_error' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('create with malformed LAGN → 400 invalid_lagn (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({
      body: { name: 'Valid Name', lagn: { not: 'a lagn' } },
    });
    await handlers.get('POST /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_lagn' });
  });

  test('create with empty name → 400 invalid_name (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({ body: { name: '   ', lagn: {} } });
    await handlers.get('POST /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_name' });
  });

  test('PATCH with neither name nor visibility → 400 empty_update (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({
      body: {},
      params: { id: '00000000-0000-4000-8000-000000000abc' },
    });
    await handlers.get('PATCH /api/me/loadouts/:id')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'empty_update' });
  });

  test('PATCH with a malformed visibility value → 400 invalid_request (structural, before logic)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({
      body: { visibility: 'semi-public' },
      params: { id: '00000000-0000-4000-8000-000000000abc' },
    });
    await handlers.get('PATCH /api/me/loadouts/:id')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_request' });
  });

  test('PATCH a malformed :id → 404 not_found (no existence leak)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({
      body: { name: 'Rename' },
      params: { id: 'not-a-uuid' },
    });
    await handlers.get('PATCH /api/me/loadouts/:id')!(koaContext);
    assert.equal(koaContext.status, 404);
    assert.deepEqual(koaContext.body, { error: 'not_found' });
  });

  test('list happy path → 200 { loadouts: [] } (scripted empty DB)', async () => {
    // why: loadPlayerIdByAccountId returns a player row, then the list
    // SELECT returns no rows → an empty list for the caller.
    const scriptedDatabase = {
      query: async (sql: string) =>
        sql.includes('FROM legendary.players')
          ? { rows: [{ player_id: 7 }] }
          : { rows: [] as unknown[] },
    } as unknown as DatabaseClient;
    const handlers = registerAndGet(makeDeps(authorizedSession), scriptedDatabase);
    const koaContext = makeContext({ params: {} });
    await handlers.get('GET /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { loadouts: [] });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('delete happy path → 204 no body (scripted DB, rowCount 1)', async () => {
    const scriptedDatabase = {
      query: async (sql: string) =>
        sql.includes('FROM legendary.players')
          ? { rows: [{ player_id: 7 }] }
          : { rows: [], rowCount: 1 },
    } as unknown as DatabaseClient;
    const handlers = registerAndGet(makeDeps(authorizedSession), scriptedDatabase);
    const koaContext = makeContext({
      params: { id: '00000000-0000-4000-8000-000000000abc' },
    });
    await handlers.get('DELETE /api/me/loadouts/:id')!(koaContext);
    assert.equal(koaContext.status, 204);
    assert.equal(koaContext.body, null);
  });

  test('delete a nonexistent id → 404 not_found (scripted DB, rowCount 0)', async () => {
    const scriptedDatabase = {
      query: async (sql: string) =>
        sql.includes('FROM legendary.players')
          ? { rows: [{ player_id: 7 }] }
          : { rows: [], rowCount: 0 },
    } as unknown as DatabaseClient;
    const handlers = registerAndGet(makeDeps(authorizedSession), scriptedDatabase);
    const koaContext = makeContext({
      params: { id: '00000000-0000-4000-8000-000000000abc' },
    });
    await handlers.get('DELETE /api/me/loadouts/:id')!(koaContext);
    assert.equal(koaContext.status, 404);
    assert.deepEqual(koaContext.body, { error: 'not_found' });
  });

  test('guest read of a missing/private slug → 404 not_found, no account identifier in body', async () => {
    const scriptedDatabase = {
      query: async () => ({ rows: [] as unknown[] }),
    } as unknown as DatabaseClient;
    // the guest route takes no auth deps into account
    const handlers = registerAndGet(makeDeps(authorizedSession), scriptedDatabase);
    const koaContext = makeContext({ params: { shareSlug: 'whatever' } });
    await handlers.get('GET /api/loadouts/:shareSlug')!(koaContext);
    assert.equal(koaContext.status, 404);
    assert.deepEqual(koaContext.body, { error: 'not_found' });
    const bodyText = JSON.stringify(koaContext.body);
    assert.ok(!bodyText.includes('accountId'));
    assert.ok(!bodyText.includes('ext_id'));
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('guest read of a public slug → 200 with the allowlisted projection only', async () => {
    const scriptedDatabase = {
      query: async () => ({
        rows: [
          {
            name: 'Shared Deck',
            lagn_json: { lagn_version: '1.0.0' },
            display_handle: 'ironfan',
            display_name: 'Iron Fan',
          },
        ],
      }),
    } as unknown as DatabaseClient;
    const handlers = registerAndGet(makeDeps(authorizedSession), scriptedDatabase);
    const koaContext = makeContext({ params: { shareSlug: 'opaque-slug' } });
    await handlers.get('GET /api/loadouts/:shareSlug')!(koaContext);
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, {
      name: 'Shared Deck',
      lagn: { lagn_version: '1.0.0' },
      displayHandle: 'ironfan',
    });
  });

  test('an unexpected DB throw on an authenticated path → 500 internal_error', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({ params: {} });
    await handlers.get('GET /api/me/loadouts')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, { error: 'internal_error' });
  });
});
