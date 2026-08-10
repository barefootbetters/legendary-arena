/**
 * dashboardDrReadiness tests (WP-517 / EC-552).
 *
 * Two surfaces, one file (the EC allowlist has a single test file):
 *
 *  1. The `/api/dash/dr-readiness` route against a fake router + injected
 *     `requireAdminSession` stub — the admin gate (200 / 401 / 403), the
 *     `no-store` first-statement, the `{ data }` envelope, and the mock-first
 *     `200` when no `DASH_GITHUB_TOKEN` is set (the route never hits the network
 *     in these tests).
 *  2. The pure `deriveDrReadiness(issues, referenceDate)` + `buildMockDrReadiness`
 *     against fixture issues and a FIXED reference date — no clock, no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerDashboardDrReadinessRoutes } from './dashboardDrReadiness.routes.js';
import {
  buildMockDrReadiness,
  computeNextDue,
  deriveDrReadiness,
} from './dashboardDrReadiness.logic.js';
import type {
  DashboardDrReadinessRouteDependencies,
  DatabaseClient,
  DrillIssue,
} from './dashboardDrReadiness.types.js';

// why: the route reads DASH_GITHUB_TOKEN; unset it so every route test exercises
// the mock-first path (no network) rather than depending on ambient env.
delete process.env.DASH_GITHUB_TOKEN;

interface RecordedContext {
  readonly headers: Record<string, string>;
  status: number;
  body: unknown;
}

function makeHarness(
  adminResult: Awaited<ReturnType<DashboardDrReadinessRouteDependencies['requireAdminSession']>>,
) {
  const handlers = new Map<string, (context: never) => Promise<void> | void>();
  const router = {
    get(path: string, handler: never) {
      handlers.set(path, handler as never);
    },
  };
  const database: DatabaseClient = { query: async () => ({ rows: [] }) };
  const deps: DashboardDrReadinessRouteDependencies = {
    requireAdminSession: async () => adminResult,
  };
  registerDashboardDrReadinessRoutes(router as never, database, deps);

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

test('registers the /api/dash/dr-readiness route', () => {
  const { registeredPaths } = makeHarness(ADMIN_OK);
  assert.deepEqual(registeredPaths, ['/api/dash/dr-readiness']);
});

test('an admin with no token gets 200 { data } (mock-first) with no-store', async () => {
  const { invoke } = makeHarness(ADMIN_OK);
  const result = await invoke('/api/dash/dr-readiness');
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  const body = result.body as { data?: Record<string, unknown> };
  assert.ok(body.data && typeof body.data === 'object', 'body carries a data payload');
  assert.equal(body.data.source, 'mock');
  assert.equal(body.data.overdue, false);
  assert.equal(body.data.lastDrill, null);
  assert.match(String(body.data.nextDue), /^\d{4}-\d{2}-01$/);
});

test('an unauthenticated caller gets 401, a non-admin gets 403 (still no-store)', async () => {
  const un = makeHarness({ ok: false, code: 'unauthorized', reason: 'no session' });
  const unauth = await un.invoke('/api/dash/dr-readiness');
  assert.equal(unauth.status, 401);
  assert.equal(unauth.headers['Cache-Control'], 'no-store');
  assert.equal((unauth.body as { code?: string }).code, 'unauthorized');

  const nf = makeHarness({ ok: false, code: 'forbidden', reason: 'not admin' });
  const forbidden = await nf.invoke('/api/dash/dr-readiness');
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers['Cache-Control'], 'no-store');
  assert.equal((forbidden.body as { code?: string }).code, 'forbidden');
});

// ---------------------------------------------------------------------------
// Pure derivation — fixture issues + a FIXED reference date (no clock/network).
// ---------------------------------------------------------------------------

const REFERENCE_DATE = new Date('2026-08-09T12:00:00Z');

function drillIssue(overrides: Partial<DrillIssue>): DrillIssue {
  return {
    title: 'DR drill due — August 2026',
    state: 'open',
    body: null,
    closedAt: null,
    isPullRequest: false,
    ...overrides,
  };
}

test('deriveDrReadiness: newest CLOSED drill sets lastDrill (date + checkbox result)', () => {
  const issues: DrillIssue[] = [
    drillIssue({
      title: 'DR drill due — June 2026',
      state: 'closed',
      closedAt: '2026-06-20T09:00:00Z',
      body: '## On completion\n- [ ] Drill passed\n- [ ] Close this issue.',
    }),
    drillIssue({
      title: 'DR drill due — July 2026',
      state: 'closed',
      closedAt: '2026-07-15T09:00:00Z',
      body: '## On completion\n- [x] Drill passed\n- [ ] Close this issue.',
    }),
  ];
  const result = deriveDrReadiness(issues, REFERENCE_DATE);
  // Newest by closedAt is July; its checkbox is checked → pass.
  assert.deepEqual(result.lastDrill, { date: '2026-07-15', result: 'pass' });
  assert.equal(result.overdue, false);
  assert.equal(result.nextDue, '2026-09-01');
  assert.equal(result.source, 'github');
});

test('deriveDrReadiness: present-unchecked → fail, absent checkbox → unknown', () => {
  const fail = deriveDrReadiness(
    [
      drillIssue({
        title: 'DR drill due — July 2026',
        state: 'closed',
        closedAt: '2026-07-15T09:00:00Z',
        body: '- [ ] Drill passed',
      }),
    ],
    REFERENCE_DATE,
  );
  assert.deepEqual(fail.lastDrill, { date: '2026-07-15', result: 'fail' });

  const unknown = deriveDrReadiness(
    [
      drillIssue({
        title: 'DR drill due — July 2026',
        state: 'closed',
        closedAt: '2026-07-15T09:00:00Z',
        body: '## On completion\n- [ ] Close this issue.',
      }),
    ],
    REFERENCE_DATE,
  );
  assert.deepEqual(unknown.lastDrill, { date: '2026-07-15', result: 'unknown' });
});

test('deriveDrReadiness: an OPEN drill from an earlier month is overdue', () => {
  const result = deriveDrReadiness(
    [drillIssue({ title: 'DR drill due — May 2026', state: 'open' })],
    REFERENCE_DATE,
  );
  assert.equal(result.overdue, true);
  assert.equal(result.lastDrill, null);
});

test('deriveDrReadiness: an OPEN drill for the current month is NOT overdue', () => {
  const result = deriveDrReadiness(
    [drillIssue({ title: 'DR drill due — August 2026', state: 'open' })],
    REFERENCE_DATE,
  );
  assert.equal(result.overdue, false);
});

test('deriveDrReadiness: pull requests and non-drill titles are excluded', () => {
  const issues: DrillIssue[] = [
    // A PR whose title looks like an overdue drill — must be ignored.
    drillIssue({ title: 'DR drill due — April 2026', state: 'open', isPullRequest: true }),
    // An unrelated issue — must be ignored.
    drillIssue({ title: 'Investigate flaky test', state: 'open' }),
    // The only real signal: a closed drill.
    drillIssue({
      title: 'DR drill due — July 2026',
      state: 'closed',
      closedAt: '2026-07-15T09:00:00Z',
      body: '- [x] Drill passed',
    }),
  ];
  const result = deriveDrReadiness(issues, REFERENCE_DATE);
  assert.equal(result.overdue, false, 'the overdue-looking PR is excluded');
  assert.deepEqual(result.lastDrill, { date: '2026-07-15', result: 'pass' });
});

test('computeNextDue rolls December over to the next January (UTC)', () => {
  assert.equal(computeNextDue(new Date('2026-12-31T23:59:59Z')), '2027-01-01');
  assert.equal(computeNextDue(new Date('2026-08-01T00:00:00Z')), '2026-09-01');
});

test('buildMockDrReadiness is the locked no-token shape', () => {
  const mock = buildMockDrReadiness(REFERENCE_DATE);
  assert.deepEqual(mock, {
    lastDrill: null,
    nextDue: '2026-09-01',
    overdue: false,
    source: 'mock',
  });
});
