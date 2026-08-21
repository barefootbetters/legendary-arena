/**
 * Tests for the gauntlet-run import + run-CRUD HTTP routes (WP-445 / EC-480).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handlers, fake auth deps drive the
 * session → unsuspended-account gate, and a `throwingDatabase` proves a
 * handler returned before any DB access. They assert the exact
 * registered route set, the auth-first ordering (401 unauthenticated /
 * 500 unconfigured verifier / 403 suspended), and — the whole point of
 * this file — that every body-reading handler parses its own JSON off a
 * real request stream (the missing-per-route-parser defect fixed in PR
 * #1546; see the `reference_no_global_body_parser` memory).
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-445 §Scope (In); EC-480 §Locked Values; D-9905 (Auth
 * closed set); D-11504 (Cache-Control); the PR #1546 per-route
 * body-parser fix.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { registerGauntletRunRoutes } from './gauntletRun.routes.js';
import type {
  DatabaseClient,
  GauntletRunRouteDependencies,
} from './gauntletRun.types.js';

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

/**
 * Build a context whose `req` is a REAL Node request stream carrying `payload`,
 * with `request.body` starting undefined — the production shape the
 * `request.body`-injecting `makeContext` cannot reproduce. Adds the minimal koa
 * surface koa-body@5 reads (`method` + `is`). Used to prove the route parses its
 * own body (the missing-parser defect fixed in PR #1546).
 *
 * @param payload The JSON string the fake stream carries.
 * @param params The `:id` (and other) path params the handler reads.
 */
function makeStreamContext(
  payload: string,
  params: { [key: string]: string } = {},
): FakeContext {
  const stream = Readable.from([Buffer.from(payload)]) as Readable & {
    headers: Record<string, string>;
  };
  stream.headers = {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(payload)),
  };
  const base = makeContext({ params });
  return Object.assign(base, {
    req: stream,
    method: 'POST',
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

const authorizedAccountId = '00000000-0000-4000-8000-000000000001';

/**
 * Build a full `GauntletRunRouteDependencies` bundle with every gate passing
 * by default; override per test. `verifier` / `accountResolver` are left
 * undefined — the fake session provider never dereferences them. The
 * progression / leaderboard deps are sentinels: no test that uses them as a
 * fake reaches the GET progression read.
 */
function makeDeps(
  overrides: Partial<GauntletRunRouteDependencies> = {},
): GauntletRunRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({
      ok: true,
      value: authorizedAccountId,
    }),
    requireUnsuspendedAccount: async () => ({ ok: true }),
    resolveGauntletExistence: () => true,
    resolveGauntletRunProgressInputs: () => null,
    leaderboardDependencies: {},
    ...overrides,
  } as unknown as GauntletRunRouteDependencies;
}

/**
 * A DatabaseClient whose `query` throws — proves a handler returned
 * before any DB access (auth failure path). Any test that reaches the DB
 * fails loudly instead of silently exercising a real query.
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

function registerAndGet(
  deps: GauntletRunRouteDependencies,
  database: DatabaseClient,
): Map<string, Handler> {
  const router = new FakeRouter();
  registerGauntletRunRoutes(router, database, deps);
  return router.handlers;
}

describe('gauntlet run routes (WP-445)', () => {
  test('registers exactly the four locked routes', () => {
    const handlers = registerAndGet(makeDeps(), throwingDatabase);
    const keys = [...handlers.keys()].sort();
    assert.deepEqual(keys, [
      'DELETE /api/me/gauntlet-runs/:id',
      'GET /api/me/gauntlet-runs',
      'PATCH /api/me/gauntlet-runs/:id',
      'POST /api/me/gauntlet-runs',
    ]);
  });

  test('unauthenticated import → 401 { error: unauthorized }, Cache-Control set, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { pack: {} } });
    await handlers.get('POST /api/me/gauntlet-runs')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.deepEqual(koaContext.body, { error: 'unauthorized' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('unconfigured verifier → 500 { error: internal_error }', async () => {
    const handlers = registerAndGet(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'not configured',
          code: 'session_verifier_not_configured',
        }),
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { pack: {} } });
    await handlers.get('POST /api/me/gauntlet-runs')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, { error: 'internal_error' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('suspended account → 403 { error: account_suspended }, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({
        requireUnsuspendedAccount: async () => ({
          ok: false,
          code: 'suspended',
          reason: 'Account is suspended.',
        }),
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { pack: {} } });
    await handlers.get('POST /api/me/gauntlet-runs')!(koaContext);
    assert.equal(koaContext.status, 403);
    assert.deepEqual(koaContext.body, { error: 'account_suspended' });
  });

  test('unauthenticated PATCH → 401 { error: unauthorized }, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({
      body: { legPicks: {} },
      params: { id: 'run-1' },
    });
    await handlers.get('PATCH /api/me/gauntlet-runs/:id')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.deepEqual(koaContext.body, { error: 'unauthorized' });
  });

  // -------------------------------------------------------------------------
  // Production-path body parsing — the whole point of this harness.
  //
  // why: reproduces the production condition PR #1546 fixed — boardgame.io
  // installs koa-body only on /games/*, so each /api route must parse its own
  // body. Before the fix, request.body was undefined in prod and the import /
  // update handlers acted on an undefined body. Here `req` is a real Node stream
  // and request.body starts undefined; the handler must parse the stream into
  // request.body. Asserted independently of the downstream logic outcome;
  // against a handler missing its ensureJsonBodyParsed call, request.body stays
  // undefined and the assertion fails — so this guards the regression.
  // -------------------------------------------------------------------------

  const streamBodyCases: Array<{
    key: string;
    payload: Record<string, unknown>;
    params: { [k: string]: string };
  }> = [
    {
      key: 'POST /api/me/gauntlet-runs',
      payload: {
        setAbbr: 'core',
        mastermindSlug: 'loki',
        division: 'open',
        playerCount: 2,
      },
      params: {},
    },
    {
      key: 'PATCH /api/me/gauntlet-runs/:id',
      payload: { legPicks: { 'core/scheme': ['core/hero'] } },
      params: { id: 'run-1' },
    },
  ];

  for (const { key, payload, params } of streamBodyCases) {
    test(`${key} parses the JSON body off the request stream (production path)`, async () => {
      const handlers = registerAndGet(makeDeps(), throwingDatabase);
      const handler = handlers.get(key);
      assert.ok(handler !== undefined);
      const context = makeStreamContext(JSON.stringify(payload), params);

      await handler(context);

      assert.deepEqual(context.request.body, payload);
    });
  }
});
