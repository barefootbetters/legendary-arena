/**
 * dashboardGameplay.routes tests (WP-374 / EC-403).
 *
 * Exercises the three `/api/dash/{matches,players,kpis}` handlers against a fake
 * router + fake database + injected `requireAdminSession` stub + a fake registry:
 * the admin gate (200 / 401 / 403), the `no-store` first-statement, and the
 * `{ data }` envelope.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerDashboardGameplayRoutes } from './dashboardGameplay.routes.js';
import type {
  DashboardGameplayRouteDependencies,
  DatabaseClient,
} from './dashboardGameplay.types.js';
import type { CardRegistry } from '@legendary-arena/registry';

interface RecordedContext {
  readonly headers: Record<string, string>;
  status: number;
  body: unknown;
}

const FAKE_REGISTRY = { listCards: () => [] } as unknown as CardRegistry;

function makeHarness(
  adminResult: Awaited<ReturnType<DashboardGameplayRouteDependencies['requireAdminSession']>>,
) {
  const handlers = new Map<string, (context: never) => Promise<void> | void>();
  const router = {
    get(path: string, handler: never) {
      handlers.set(path, handler as never);
    },
  };
  // empty rows exercise the zero paths; the handler focus is gate + shape.
  const database: DatabaseClient = { query: async () => ({ rows: [] }) };
  const deps: DashboardGameplayRouteDependencies = {
    requireAdminSession: async () => adminResult,
    registry: FAKE_REGISTRY,
  };
  registerDashboardGameplayRoutes(router as never, database, deps);

  async function invoke(path: string): Promise<RecordedContext> {
    const handler = handlers.get(path) as unknown as (context: {
      req: unknown;
      set(field: string, value: string): void;
      status: number;
      body: unknown;
    }) => Promise<void>;
    assert.ok(handler, `no handler for ${path}`);
    const recorded: RecordedContext = { headers: {}, status: 0, body: undefined };
    await handler({
      req: {},
      set: (field, value) => {
        recorded.headers[field] = value;
      },
      get status() {
        return recorded.status;
      },
      set status(value: number) {
        recorded.status = value;
      },
      get body() {
        return recorded.body;
      },
      set body(value: unknown) {
        recorded.body = value;
      },
    });
    return recorded;
  }

  return { invoke, registeredPaths: [...handlers.keys()] };
}

const ADMIN_OK = { ok: true, accountId: 'acct-1' } as const;

test('registers the three /api/dash gameplay+kpi routes', () => {
  const { registeredPaths } = makeHarness(ADMIN_OK);
  assert.deepEqual(registeredPaths.sort(), [
    '/api/dash/kpis',
    '/api/dash/matches',
    '/api/dash/players',
  ]);
});

test('an admin gets 200 { data } from every route, no-store set', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  for (const path of ['/api/dash/matches', '/api/dash/players', '/api/dash/kpis']) {
    const result = await invoke(path);
    assert.equal(result.status, 200, `${path} → 200`);
    assert.equal(result.headers['Cache-Control'], 'no-store', `${path} no-store`);
    assert.ok(result.body && typeof result.body === 'object' && 'data' in result.body);
  }
});

test('an unauthenticated caller gets 401, a non-admin gets 403 (still no-store)', async () => {
  const un = makeHarness({ ok: false, code: 'unauthorized', reason: 'no session' });
  const unauth = await un.invoke('/api/dash/matches');
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers['Cache-Control'], 'no-store');
  assert.equal((unauth.body as { code?: string }).code, 'unauthorized');

  const nf = makeHarness({ ok: false, code: 'forbidden', reason: 'not admin' });
  const forbidden = await nf.invoke('/api/dash/players');
  assert.equal(forbidden.status, 403);
  assert.equal((forbidden.body as { code?: string }).code, 'forbidden');
});
