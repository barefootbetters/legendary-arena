/**
 * Tests for the public profile HTTP route (WP-102 / EC-117).
 *
 * All tests are pure (no live database, no HTTP listener): a fake Koa
 * router captures the registered handler and a scripted / throwing
 * `DatabaseClient` drives the logic paths. This route is intentionally
 * unauthenticated (public read), so there is no auth-gate to exercise
 * and no request body to parse — the harness asserts the exact
 * registered route, the `player_not_found` → 404 mapping, and the
 * unexpected-throw → 500 envelope (no body leak).
 *
 * Layer-boundary: imports nothing from the engine runtime, the
 * registry runtime, or any UI package.
 *
 * Authority: WP-102 §Scope (In) §C; EC-117 §Locked Values.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerProfileRoutes } from './profile.routes.js';
import type { DatabaseClient } from '../identity/identity.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  params: { handle: string };
  status: number;
  body: unknown;
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
}

function makeContext(handle: string): FakeContext {
  return { params: { handle }, status: 0, body: undefined };
}

/**
 * A DatabaseClient whose `query` throws — drives the unexpected-throw →
 * 500 path and proves the handler never re-throws to a global handler.
 */
const throwingDatabase = {
  query: async () => {
    throw new Error('simulated database fault during public profile read');
  },
} as unknown as DatabaseClient;

/**
 * A DatabaseClient whose first `query` returns no rows — drives the
 * `player_not_found` → 404 path in `getPublicProfileByHandle`.
 */
const emptyDatabase = {
  query: async () => ({ rows: [] as unknown[] }),
} as unknown as DatabaseClient;

function registerAndGet(database: DatabaseClient): Map<string, Handler> {
  const router = new FakeRouter();
  registerProfileRoutes(router, database);
  return router.handlers;
}

describe('public profile routes (WP-102)', () => {
  test('registers exactly the one locked route', () => {
    const handlers = registerAndGet(emptyDatabase);
    const keys = [...handlers.keys()];
    assert.deepEqual(keys, ['GET /api/players/:handle/profile']);
  });

  test('unknown handle → 404 { error: player_not_found } (no existence leak beyond the code)', async () => {
    const handlers = registerAndGet(emptyDatabase);
    const koaContext = makeContext('nobody');
    await handlers.get('GET /api/players/:handle/profile')!(koaContext);
    assert.equal(koaContext.status, 404);
    assert.deepEqual(koaContext.body, { error: 'player_not_found' });
  });

  test('an unexpected DB throw → 500 { error: internal_error } (no re-throw, locked envelope)', async () => {
    const handlers = registerAndGet(throwingDatabase);
    const koaContext = makeContext('anyone');
    await handlers.get('GET /api/players/:handle/profile')!(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, { error: 'internal_error' });
  });
});
