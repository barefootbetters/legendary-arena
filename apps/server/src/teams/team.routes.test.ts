/**
 * Tests for the team-affiliation HTTP routes (WP-109 / EC-115).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handlers, a fake
 * `requireAuthenticatedSession` drives the auth branch, and a
 * `throwingDatabase` proves a handler returned before any DB access.
 * They assert the exact registered route set, the auth-first ordering
 * (401 unauthenticated / 500 unconfigured verifier), the structural
 * body-shape rejects (non-object body → 400 invalid_request), the
 * invalid `:teamId` param reject, and — the whole point of this file —
 * that every body-reading handler parses its own JSON off a real
 * request stream (the missing-per-route-parser defect fixed in PR
 * #1546; see the `reference_no_global_body_parser` memory).
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-109 §Files Expected to Change; EC-115 §Locked Values;
 * D-11504 (Cache-Control); D-11202 (bearer header); the PR #1546
 * per-route body-parser fix.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import { registerTeamRoutes } from './team.routes.js';
import type { TeamRouteDependencies } from './team.routes.js';
import type { DatabaseClient } from './team.types.js';

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
 * @param params The `:teamId` (and other) path params the handler reads.
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

/**
 * Build a `TeamRouteDependencies` bundle whose `requireAuthenticatedSession`
 * returns the supplied result. `verifier` / `accountResolver` are left
 * undefined — the fake session provider never dereferences them.
 */
function makeDeps(
  sessionResult:
    | { ok: true; value: string }
    | { ok: false; reason: string; code: string },
): TeamRouteDependencies {
  return {
    requireAuthenticatedSession: async () => sessionResult,
  } as unknown as TeamRouteDependencies;
}

const authorizedSession = {
  ok: true as const,
  value: '00000000-0000-4000-8000-000000000001',
};

// why: a valid UUID v4 `:teamId` — passes `toTeamId`'s shape check so a
// body-reading handler reaches its body parse instead of short-circuiting
// on an invalid_request param reject.
const VALID_TEAM_ID = '00000000-0000-4000-8000-000000000abc';

/**
 * A DatabaseClient whose `query` throws — proves a handler returned
 * before any DB access (auth failure / structural reject / body-parse
 * path). Any test that reaches the DB fails loudly instead of silently
 * exercising a real query.
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

function registerAndGet(
  deps: TeamRouteDependencies,
  database: DatabaseClient,
): Map<string, Handler> {
  const router = new FakeRouter();
  registerTeamRoutes(router, database, deps);
  return router.handlers;
}

describe('team affiliation routes (WP-109)', () => {
  test('registers exactly the eight locked routes', () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const keys = [...handlers.keys()].sort();
    assert.deepEqual(keys, [
      'DELETE /api/teams/:teamId/members/:playerId',
      'GET /api/teams/:teamId',
      'PATCH /api/teams/:teamId',
      'PATCH /api/teams/:teamId/captain',
      'PATCH /api/teams/:teamId/members/:playerId',
      'POST /api/teams',
      'POST /api/teams/:teamId/members',
      'POST /api/teams/:teamId/status',
    ]);
  });

  test('unauthenticated create → 401 { error: missing_token }, Cache-Control set, DB untouched', async () => {
    const handlers = registerAndGet(
      makeDeps({ ok: false, reason: 'no token', code: 'missing_token' }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { name: 'x' } });
    await handlers.get('POST /api/teams')!(koaContext);
    assert.equal(koaContext.status, 401);
    assert.deepEqual(koaContext.body, { error: 'missing_token' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('unconfigured verifier → 500 { error: session_verifier_not_configured }', async () => {
    const handlers = registerAndGet(
      makeDeps({
        ok: false,
        reason: 'not configured',
        code: 'session_verifier_not_configured',
      }),
      throwingDatabase,
    );
    const koaContext = makeContext({ body: { name: 'x' } });
    await handlers.get('POST /api/teams')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, {
      error: 'session_verifier_not_configured',
    });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('PATCH with a malformed :teamId → 400 invalid_request (before DB)', async () => {
    const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
    const koaContext = makeContext({
      body: { name: 'Rename' },
      params: { teamId: 'not-a-uuid' },
    });
    await handlers.get('PATCH /api/teams/:teamId')!(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, { error: 'invalid_request' });
  });

  // -------------------------------------------------------------------------
  // Structural body-shape rejects — every body-reading handler rejects a
  // non-object body with 400 invalid_request before touching the DB.
  // -------------------------------------------------------------------------

  const bodyRejectCases: Array<{ key: string; params: { [k: string]: string } }> = [
    { key: 'POST /api/teams', params: {} },
    { key: 'PATCH /api/teams/:teamId', params: { teamId: VALID_TEAM_ID } },
    { key: 'POST /api/teams/:teamId/members', params: { teamId: VALID_TEAM_ID } },
    { key: 'PATCH /api/teams/:teamId/captain', params: { teamId: VALID_TEAM_ID } },
    { key: 'POST /api/teams/:teamId/status', params: { teamId: VALID_TEAM_ID } },
  ];

  for (const { key, params } of bodyRejectCases) {
    test(`${key} with a non-object body → 400 invalid_request (before DB)`, async () => {
      const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
      const koaContext = makeContext({ body: 'not-an-object', params });
      await handlers.get(key)!(koaContext);
      assert.equal(koaContext.status, 400);
      assert.deepEqual(koaContext.body, { error: 'invalid_request' });
    });
  }

  // -------------------------------------------------------------------------
  // Production-path body parsing — the whole point of this harness.
  //
  // why: reproduces the production condition PR #1546 fixed — boardgame.io
  // installs koa-body only on /games/*, so each /api route must parse its own
  // body. Before the fix, request.body was undefined in prod and every
  // body-carrying team handler rejected the request. Here `req` is a real Node
  // stream and request.body starts undefined; the handler must parse the stream
  // into request.body. Asserted independently of the downstream logic outcome;
  // against a handler missing its ensureJsonBodyParsed call, request.body stays
  // undefined and each assertion below fails — so this guards the regression.
  // -------------------------------------------------------------------------

  const streamBodyCases: Array<{
    key: string;
    payload: Record<string, unknown>;
    params: { [k: string]: string };
  }> = [
    {
      key: 'POST /api/teams',
      payload: { name: 'Streamed Team', teamSize: 3 },
      params: {},
    },
    {
      key: 'PATCH /api/teams/:teamId',
      payload: { name: 'Renamed' },
      params: { teamId: VALID_TEAM_ID },
    },
    {
      key: 'POST /api/teams/:teamId/members',
      payload: { playerId: 'p-42', role: 'member' },
      params: { teamId: VALID_TEAM_ID },
    },
    {
      key: 'PATCH /api/teams/:teamId/captain',
      payload: { newCaptainPlayerId: 'p-42' },
      params: { teamId: VALID_TEAM_ID },
    },
    {
      key: 'POST /api/teams/:teamId/status',
      payload: { status: 'completed' },
      params: { teamId: VALID_TEAM_ID },
    },
  ];

  for (const { key, payload, params } of streamBodyCases) {
    test(`${key} parses the JSON body off the request stream (production path)`, async () => {
      const handlers = registerAndGet(makeDeps(authorizedSession), throwingDatabase);
      const handler = handlers.get(key);
      assert.ok(handler !== undefined);
      const context = makeStreamContext(JSON.stringify(payload), params);

      await handler(context);

      assert.deepEqual(context.request.body, payload);
    });
  }
});
