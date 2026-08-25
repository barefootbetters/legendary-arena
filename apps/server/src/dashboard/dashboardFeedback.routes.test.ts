/**
 * Tests for the feedback triage HTTP routes (WP-605 / EC-640).
 *
 * Logic-pure: fake FeedbackTriageRouteDependencies + a fake FeedbackTriageRouteLogic
 * are injected, so no real pg.Pool, no HTTP listener, no admin DB lookup. A mock
 * router captures the two handlers; the mock context records header/status/body
 * ordering for the Cache-Control-first assertion. The pure validator + shaper run
 * for real (they touch no I/O). The unit-test context injects request.body directly
 * (no Node stream), so ensureJsonBodyParsed short-circuits.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerDashboardFeedbackRoutes } from './dashboardFeedback.routes.js';
import type {
  FeedbackTriageRouteDependencies,
  FeedbackTriageRouteLogic,
} from './dashboardFeedback.routes.js';
import type { AccountId } from '../identity/identity.types.js';
import type { SessionTokenRequest } from '../auth/sessionToken.types.js';
import type { FeedbackItemRecord } from '../feedback/feedback.types.js';

type RegisteredHandler = (koaContext: MockKoaContext) => Promise<void> | void;

interface MockKoaContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { id?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly callOrder: string[];
}

interface MockRoutes {
  get: Map<string, RegisteredHandler>;
  patch: Map<string, RegisteredHandler>;
}

function makeMockRouter(): {
  router: {
    get: (path: string, handler: RegisteredHandler) => void;
    patch: (path: string, handler: RegisteredHandler) => void;
  };
  routes: MockRoutes;
} {
  const routes: MockRoutes = { get: new Map(), patch: new Map() };
  return {
    router: {
      get(path: string, handler: RegisteredHandler): void {
        routes.get.set(path, handler);
      },
      patch(path: string, handler: RegisteredHandler): void {
        routes.patch.set(path, handler);
      },
    },
    routes,
  };
}

function makeMockContext(over: { body?: unknown; id?: string } = {}): MockKoaContext {
  const callOrder: string[] = [];
  let statusValue = 0;
  let bodyValue: unknown = undefined;
  return {
    req: {} as SessionTokenRequest,
    request: { body: over.body },
    params: over.id === undefined ? {} : { id: over.id },
    get status(): number {
      return statusValue;
    },
    set status(value: number) {
      statusValue = value;
      callOrder.push('status');
    },
    get body(): unknown {
      return bodyValue;
    },
    set body(value: unknown) {
      bodyValue = value;
      callOrder.push('body');
    },
    set(field: string): void {
      callOrder.push(`set:${field}`);
    },
    callOrder,
  };
}

const RECORD: FeedbackItemRecord = {
  id: 7,
  feedbackType: 'enhancement',
  title: 'Add a dark mode',
  description: 'A dark theme would help.',
  authorExtId: 'acct-jeff',
  status: 'planned',
  resolutionReason: null,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T03:00:00.000Z',
};

function makeDeps(
  over: Partial<FeedbackTriageRouteDependencies> = {},
): FeedbackTriageRouteDependencies {
  return {
    requireAdminSession: async () => ({
      ok: true,
      accountId: 'admin-1' as AccountId,
    }),
    ...over,
  };
}

function makeLogic(over: Partial<FeedbackTriageRouteLogic> = {}): FeedbackTriageRouteLogic {
  return {
    listAllFeedbackItems: async () => [],
    updateFeedbackItemStatus: async () => RECORD,
    countVotesForItem: async () => 3,
    ...over,
  };
}

function register(
  deps: FeedbackTriageRouteDependencies,
  logic: FeedbackTriageRouteLogic,
): MockRoutes {
  const { router, routes } = makeMockRouter();
  registerDashboardFeedbackRoutes(router as never, {} as never, deps, logic);
  return routes;
}

describe('registerDashboardFeedbackRoutes — registration (WP-605)', () => {
  test('registers the GET list + PATCH status routes', () => {
    const routes = register(makeDeps(), makeLogic());
    assert.ok(routes.get.has('/api/dash/feedback'));
    assert.ok(routes.patch.has('/api/dash/feedback/:id/status'));
  });
});

describe('GET /api/dash/feedback (WP-605)', () => {
  test('200 { data: { items } } for an admin, Cache-Control set first', async () => {
    const items = [
      { id: 1, feedbackType: 'bug', title: 't', description: 'd', authorExtId: 'a', status: 'under_review', resolutionReason: null, voteCount: 0, createdAt: 'c', updatedAt: 'u' },
    ];
    const routes = register(makeDeps(), makeLogic({ listAllFeedbackItems: async () => items as never }));
    const context = makeMockContext();
    await routes.get.get('/api/dash/feedback')!(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { data: { items } });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('401 unauthorized when the admin gate rejects the session', async () => {
    const routes = register(
      makeDeps({
        requireAdminSession: async () => ({
          ok: false,
          code: 'unauthorized',
          reason: 'no token',
        }),
      }),
      makeLogic(),
    );
    const context = makeMockContext();
    await routes.get.get('/api/dash/feedback')!(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { code: 'unauthorized', reason: 'no token' });
  });

  test('403 forbidden for a non-admin account', async () => {
    const routes = register(
      makeDeps({
        requireAdminSession: async () => ({
          ok: false,
          code: 'forbidden',
          reason: 'not admin',
        }),
      }),
      makeLogic(),
    );
    const context = makeMockContext();
    await routes.get.get('/api/dash/feedback')!(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { code: 'forbidden', reason: 'not admin' });
  });

  test('500 with a locked envelope when the list logic throws', async () => {
    const routes = register(
      makeDeps(),
      makeLogic({
        listAllFeedbackItems: async () => {
          throw new Error('boom');
        },
      }),
    );
    const context = makeMockContext();
    await routes.get.get('/api/dash/feedback')!(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { code: 'internal_error' });
  });
});

describe('PATCH /api/dash/feedback/:id/status (WP-605)', () => {
  test('200 { data: { item } } on a valid status write', async () => {
    const routes = register(makeDeps(), makeLogic({ countVotesForItem: async () => 5 }));
    const context = makeMockContext({ id: '7', body: { status: 'planned' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, {
      data: {
        item: {
          id: 7,
          feedbackType: 'enhancement',
          title: 'Add a dark mode',
          description: 'A dark theme would help.',
          authorExtId: 'acct-jeff',
          status: 'planned',
          resolutionReason: null,
          voteCount: 5,
          createdAt: '2026-08-25T00:00:00.000Z',
          updatedAt: '2026-08-25T03:00:00.000Z',
        },
      },
    });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('401 unauthorized before any write when the gate rejects', async () => {
    let called = false;
    const routes = register(
      makeDeps({
        requireAdminSession: async () => ({ ok: false, code: 'unauthorized', reason: 'x' }),
      }),
      makeLogic({
        updateFeedbackItemStatus: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const context = makeMockContext({ id: '7', body: { status: 'planned' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 401);
    assert.equal(called, false);
  });

  test('400 invalid_request on a malformed id', async () => {
    const routes = register(makeDeps(), makeLogic());
    const context = makeMockContext({ id: 'abc', body: { status: 'planned' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { code: 'invalid_request' });
  });

  test('400 invalid_status on an out-of-set status', async () => {
    const routes = register(makeDeps(), makeLogic());
    const context = makeMockContext({ id: '7', body: { status: 'archived' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { code: 'invalid_status' });
  });

  test('400 resolution_reason_required when declining without a reason', async () => {
    const routes = register(makeDeps(), makeLogic());
    const context = makeMockContext({ id: '7', body: { status: 'declined' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { code: 'resolution_reason_required' });
  });

  test('404 not_found when the item does not exist', async () => {
    const routes = register(
      makeDeps(),
      makeLogic({ updateFeedbackItemStatus: async () => null }),
    );
    const context = makeMockContext({ id: '999', body: { status: 'planned' } });
    await routes.patch.get('/api/dash/feedback/:id/status')!(context);
    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { code: 'not_found' });
  });
});
