/**
 * dashboardBilling.routes tests (WP-373 / EC-402).
 *
 * Exercises the four `/api/dash/*` handlers against a fake Koa router + a fake
 * database + an injectable `requireAdminSession` stub: the admin gate (200 / 401 /
 * 403), the `no-store` first-statement, `range` validation, and the `{ data }`
 * envelope.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerDashboardBillingRoutes } from './dashboardBilling.routes.js';
import type {
  DashboardBillingRouteDependencies,
  DatabaseClient,
} from './dashboardBilling.types.js';

interface RecordedContext {
  readonly headers: Record<string, string>;
  status: number;
  body: unknown;
}

/** A fake router that records handlers by path so a test can invoke one. */
function makeHarness(
  adminResult: Awaited<ReturnType<DashboardBillingRouteDependencies['requireAdminSession']>>,
) {
  const handlers = new Map<
    string,
    (context: {
      req: unknown;
      request: { query: Record<string, unknown> };
      set(field: string, value: string): void;
      status: number;
      body: unknown;
    }) => Promise<void> | void
  >();
  const router = {
    get(path: string, handler: never) {
      handlers.set(path, handler);
    },
  };
  // why: the logic runs against this — empty rows exercise the zero-fill paths and
  // keep the handler focused on gate/range/shape rather than data content.
  const database: DatabaseClient = {
    query: async () => ({ rows: [] }),
  };
  const deps: DashboardBillingRouteDependencies = {
    requireAdminSession: async () => adminResult,
  };
  registerDashboardBillingRoutes(router as never, database, deps);

  async function invoke(path: string, query: Record<string, unknown> = {}): Promise<RecordedContext> {
    const handler = handlers.get(path);
    assert.ok(handler, `no handler registered for ${path}`);
    const recorded: RecordedContext = { headers: {}, status: 0, body: undefined };
    await handler({
      req: {},
      request: { query },
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

test('registers the four /api/dash/* billing+revenue routes', () => {
  const { registeredPaths } = makeHarness(ADMIN_OK);
  assert.deepEqual(registeredPaths.sort(), [
    '/api/dash/metrics/billing/health',
    '/api/dash/metrics/billing/health/sparklines',
    '/api/dash/metrics/revenue',
    '/api/dash/revenue',
  ]);
});

test('billing-health returns 200 { data } for an admin with a valid range, no-store set', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  const result = await invoke('/api/dash/metrics/billing/health', { range: '30d' });
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.ok(result.body && typeof result.body === 'object' && 'data' in result.body);
});

test('a missing/invalid range yields 400 invalid_request', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  const result = await invoke('/api/dash/metrics/billing/health', {});
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { code: 'invalid_request' });
});

test('an unauthenticated caller yields 401 unauthorized, still no-store', async () => {
  const { invoke } = makeHarness({ ok: false, code: 'unauthorized', reason: 'no session' });
  const result = await invoke('/api/dash/metrics/billing/health', { range: '7d' });
  assert.equal(result.status, 401);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal((result.body as { code?: string }).code, 'unauthorized');
});

test('a non-admin caller yields 403 forbidden', async () => {
  const { invoke } = makeHarness({ ok: false, code: 'forbidden', reason: 'not admin' });
  const result = await invoke('/api/dash/revenue');
  assert.equal(result.status, 403);
  assert.equal((result.body as { code?: string }).code, 'forbidden');
});

test('/api/dash/revenue needs no range and returns 200 { data: [] }', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  const result = await invoke('/api/dash/revenue');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { data: [] });
});
