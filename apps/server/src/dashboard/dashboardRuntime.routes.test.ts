/**
 * dashboardRuntime.routes tests (WP-439 / EC-474).
 *
 * Exercises the `/api/dash/system/runtime` handler against a fake router + injected
 * `requireAdminSession` stub: the admin gate (200 / 401 / 403), the `no-store`
 * first-statement, and the `{ data }` envelope carrying a runtime snapshot. The
 * database is a no-op fake — the metric is sampled from `process`, so the pool is
 * only present for the gate.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerDashboardRuntimeRoutes } from './dashboardRuntime.routes.js';
import type {
  DashboardRuntimeRouteDependencies,
  DatabaseClient,
} from './dashboardRuntime.types.js';

interface RecordedContext {
  readonly headers: Record<string, string>;
  status: number;
  body: unknown;
}

function makeHarness(
  adminResult: Awaited<ReturnType<DashboardRuntimeRouteDependencies['requireAdminSession']>>,
) {
  const handlers = new Map<string, (context: never) => Promise<void> | void>();
  const router = {
    get(path: string, handler: never) {
      handlers.set(path, handler as never);
    },
  };
  const database: DatabaseClient = { query: async () => ({ rows: [] }) };
  const deps: DashboardRuntimeRouteDependencies = {
    requireAdminSession: async () => adminResult,
  };
  registerDashboardRuntimeRoutes(router as never, database, deps);

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

test('registers the /api/dash/system/runtime route', () => {
  const { registeredPaths } = makeHarness(ADMIN_OK);
  assert.deepEqual(registeredPaths, ['/api/dash/system/runtime']);
});

test('an admin gets 200 { data: snapshot } with no-store', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  const result = await invoke('/api/dash/system/runtime');
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  const body = result.body as { data?: Record<string, unknown> };
  assert.ok(body.data && typeof body.data === 'object', 'body carries a data snapshot');
  assert.ok('eventLoopDelayMs' in body.data && 'cpuPercent' in body.data && 'cpuCount' in body.data);
});

test('an unauthenticated caller gets 401, a non-admin gets 403 (still no-store)', async () => {
  const un = makeHarness({ ok: false, code: 'unauthorized', reason: 'no session' });
  const unauth = await un.invoke('/api/dash/system/runtime');
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers['Cache-Control'], 'no-store');
  assert.equal((unauth.body as { code?: string }).code, 'unauthorized');

  const nf = makeHarness({ ok: false, code: 'forbidden', reason: 'not admin' });
  const forbidden = await nf.invoke('/api/dash/system/runtime');
  assert.equal(forbidden.status, 403);
  assert.equal((forbidden.body as { code?: string }).code, 'forbidden');
});
