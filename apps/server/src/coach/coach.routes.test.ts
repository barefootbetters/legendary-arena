/**
 * Tests for the endgame-coach HTTP route (WP-594 / EC-629).
 *
 * Logic-pure: fake CoachRouteDependencies + a fake CoachRouteLogic are injected,
 * so no real pg.Pool, no HTTP listener, no model call. A mock router captures the
 * registered GET handler; the mock context records header/status/body ordering
 * for the Cache-Control-first assertion.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerCoachRoutes } from './coach.routes.js';
import type {
  CoachRouteDependencies,
  CoachRouteLogic,
} from './coach.routes.js';
import type { CardRegistry } from '@legendary-arena/registry';
import type { AccountId } from '../identity/identity.types.js';
import type { SessionTokenRequest } from '../auth/sessionToken.types.js';
import type { CoachResult, CoachModelClient, StoredCoachReport } from './coach.types.js';

type RegisteredHandler = (koaContext: MockKoaContext) => Promise<void> | void;

interface MockKoaContext {
  readonly req: SessionTokenRequest;
  params: { replayHash?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly callOrder: string[];
}

function makeMockRouter(): {
  router: { get: (path: string, handler: RegisteredHandler) => void };
  routes: { path: string; handler: RegisteredHandler }[];
} {
  const routes: { path: string; handler: RegisteredHandler }[] = [];
  return {
    router: {
      get(path: string, handler: RegisteredHandler): void {
        routes.push({ path, handler });
      },
    },
    routes,
  };
}

function makeMockContext(replayHash: string | undefined = 'replay-abc'): MockKoaContext {
  const callOrder: string[] = [];
  let statusValue = 0;
  let bodyValue: unknown = undefined;
  return {
    req: {} as SessionTokenRequest,
    params: { replayHash },
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

const STORED: StoredCoachReport = {
  report: {
    headline: 'h',
    heroFit: 'f',
    purchases: 'p',
    suggestions: ['a', 'b'],
  },
  model: 'stub-model',
  generatedAt: '2026-08-23T00:00:00.000Z',
};

const MODEL_CLIENT: CoachModelClient = {
  model: 'stub-model',
  async generate() {
    return STORED.report;
  },
};

// A stub registry: buildNameResolver iterates listSets() at registration, so an
// empty-sets stub is sufficient (the fake logic ignores the resolver anyway).
const STUB_REGISTRY = {
  listSets: () => [],
  getSet: () => undefined,
} as unknown as CardRegistry;

function makeDeps(
  over: Partial<CoachRouteDependencies> = {},
): CoachRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({
      ok: true,
      value: 'acct-jeff' as AccountId,
    }),
    requireUnsuspendedAccount: async () => ({ ok: true }) as never,
    registry: STUB_REGISTRY,
    modelClient: MODEL_CLIENT,
    ...over,
  };
}

function makeLogic(result: CoachResult): CoachRouteLogic {
  return {
    generateOrGetCoachReport: async () => result,
  };
}

function registerAndGetHandler(
  deps: CoachRouteDependencies,
  logic: CoachRouteLogic,
): RegisteredHandler {
  const { router, routes } = makeMockRouter();
  registerCoachRoutes(router as never, {} as never, deps, logic);
  const route = routes.find((entry) => entry.path === '/api/me/scores/:replayHash/coach');
  assert.ok(route, 'the coach route is registered');
  return route.handler;
}

describe('registerCoachRoutes (WP-594)', () => {
  test('registers GET /api/me/scores/:replayHash/coach', () => {
    const { router, routes } = makeMockRouter();
    registerCoachRoutes(router as never, {} as never, makeDeps(), makeLogic({ ok: false, reason: 'not_found' }));
    assert.equal(routes.length, 1);
    assert.equal(routes[0]?.path, '/api/me/scores/:replayHash/coach');
  });

  test('200 with { report, wasCached } and Cache-Control set first', async () => {
    const handler = registerAndGetHandler(
      makeDeps(),
      makeLogic({ ok: true, report: STORED, wasCached: false }),
    );
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { report: STORED, wasCached: false });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('401 on a failed session; the coach logic is never called', async () => {
    let called = false;
    const logic: CoachRouteLogic = {
      generateOrGetCoachReport: async () => {
        called = true;
        return { ok: false, reason: 'not_found' };
      },
    };
    const handler = registerAndGetHandler(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      logic,
    );
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
    assert.equal(called, false);
  });

  test('403 forbidden on a suspended account', async () => {
    const handler = registerAndGetHandler(
      makeDeps({
        requireUnsuspendedAccount: async () =>
          ({ ok: false, code: 'suspended' }) as never,
      }),
      makeLogic({ ok: true, report: STORED, wasCached: true }),
    );
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'forbidden' });
  });

  test('400 on a missing replayHash path param', async () => {
    const handler = registerAndGetHandler(
      makeDeps(),
      makeLogic({ ok: true, report: STORED, wasCached: false }),
    );
    const context = makeMockContext();
    // why: force an absent path param (passing undefined to the helper would hit
    // its default value, not simulate a missing param).
    context.params = {};
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'invalid_request' });
  });

  test('each refusal reason maps to its locked status', async () => {
    const expectations: { reason: 'not_entitled' | 'not_owner' | 'not_found' | 'coach_unavailable'; status: number }[] = [
      { reason: 'not_entitled', status: 403 },
      { reason: 'not_owner', status: 403 },
      { reason: 'not_found', status: 404 },
      { reason: 'coach_unavailable', status: 503 },
    ];
    for (const expectation of expectations) {
      const handler = registerAndGetHandler(
        makeDeps(),
        makeLogic({ ok: false, reason: expectation.reason }),
      );
      const context = makeMockContext();
      await handler(context);
      assert.equal(context.status, expectation.status, expectation.reason);
      assert.deepEqual(context.body, { error: expectation.reason });
    }
  });

  test('500 with a locked envelope when the coach logic throws', async () => {
    const handler = registerAndGetHandler(makeDeps(), {
      generateOrGetCoachReport: async () => {
        throw new Error('boom');
      },
    });
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });
});
