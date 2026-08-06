/**
 * Handle route tests (WP-501). Pure (no test database): the fake router
 * captures the `PATCH /api/me/handle` handler, a fake
 * `requireAuthenticatedSession` drives the acting identity, and canned /
 * throwing `DatabaseClient` fakes drive `changeHandle`'s result branches —
 * so the HTTP status mapping + `Cache-Control` + body shape are exercised
 * without spinning up boardgame.io or Postgres.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { registerHandleRoutes } from './handle.routes.js';
import type { HandleRouteDependencies } from './handle.routes.js';
import type { AccountId, DatabaseClient } from './identity.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  status: number;
  body: unknown;
  setHeaders: Record<string, string>;
  set(field: string, value: string): void;
}

class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  patch(path: string, handler: Handler): void {
    this.handlers.set(`PATCH ${path}`, handler);
  }
}

function makeContext(body?: unknown): FakeContext {
  const setHeaders: Record<string, string> = {};
  return {
    req: { headers: {} },
    request: { body },
    status: 0,
    body: undefined,
    setHeaders,
    set(field: string, value: string): void {
      setHeaders[field] = value;
    },
  };
}

function authedDeps(accountId: AccountId): HandleRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({ ok: true, value: accountId }),
  };
}

const unauthedDeps: HandleRouteDependencies = {
  requireAuthenticatedSession: async () => ({
    ok: false,
    reason: 'no token supplied',
    code: 'missing_token',
  }),
};

/** A database whose UPDATE returns the given rows. */
function cannedDatabase(rows: unknown[]): DatabaseClient {
  return { query: async () => ({ rows }) } as unknown as DatabaseClient;
}

/** A database whose UPDATE raises a 23505 unique violation. */
const uniqueViolationDatabase = {
  query: async () => {
    const error = new Error('duplicate key value') as Error & { code: string };
    error.code = '23505';
    throw error;
  },
} as unknown as DatabaseClient;

/** A database that must never be queried (handler returns before any query). */
const throwingDatabase = {
  query: async () => {
    throw new Error('handler must return before any database query');
  },
} as unknown as DatabaseClient;

const ACCOUNT = '00000000-0000-4000-8000-000000000001' as AccountId;

function patchHandler(
  deps: HandleRouteDependencies,
  database: DatabaseClient,
): Handler {
  const router = new FakeRouter();
  registerHandleRoutes(router, database, deps);
  const handler = router.handlers.get('PATCH /api/me/handle');
  assert.ok(handler);
  return handler;
}

describe('handle routes (WP-501)', () => {
  test('returns 401 when unauthenticated, without touching the database', async () => {
    const ctx = makeContext({ handle: 'newname' });
    await patchHandler(unauthedDeps, throwingDatabase)(ctx);
    assert.equal(ctx.status, 401);
    assert.deepEqual(ctx.body, { error: 'missing_token' });
    assert.equal(ctx.setHeaders['Cache-Control'], 'no-store');
  });

  test('returns 400 invalid_handle when the body carries no string handle', async () => {
    const ctx = makeContext({ notHandle: 1 });
    await patchHandler(authedDeps(ACCOUNT), throwingDatabase)(ctx);
    assert.equal(ctx.status, 400);
    assert.deepEqual(ctx.body, { error: 'invalid_handle' });
  });

  test('returns 200 with the new handle on success + Cache-Control no-store', async () => {
    const ctx = makeContext({ handle: 'ChosenName' });
    const database = cannedDatabase([
      { handle_canonical: 'chosenname', display_handle: 'ChosenName' },
    ]);
    await patchHandler(authedDeps(ACCOUNT), database)(ctx);
    assert.equal(ctx.status, 200);
    assert.deepEqual(ctx.body, {
      handleCanonical: 'chosenname',
      displayHandle: 'ChosenName',
    });
    assert.equal(ctx.setHeaders['Cache-Control'], 'no-store');
  });

  test('returns 409 handle_taken on a unique violation', async () => {
    const ctx = makeContext({ handle: 'chosenname' });
    await patchHandler(authedDeps(ACCOUNT), uniqueViolationDatabase)(ctx);
    assert.equal(ctx.status, 409);
    assert.deepEqual(ctx.body, { error: 'handle_taken' });
  });

  test('returns 400 invalid_handle for a badly formatted handle, without a query', async () => {
    // 'no' is too short — validateHandleFormat rejects before any DB query.
    const ctx = makeContext({ handle: 'no' });
    await patchHandler(authedDeps(ACCOUNT), throwingDatabase)(ctx);
    assert.equal(ctx.status, 400);
    assert.deepEqual(ctx.body, { error: 'invalid_handle' });
  });
});
