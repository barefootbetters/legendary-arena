/**
 * Tests for the endgame-coach HTTP route (WP-594 / EC-629).
 *
 * Logic-pure: fake CoachRouteDependencies + a fake CoachRouteLogic are injected,
 * so no real pg.Pool, no HTTP listener, no model call. A mock router captures the
 * registered GET handlers; the mock context records header/status/body ordering
 * for the Cache-Control-first assertion. WP-751 adds the matchId route.
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
  params: { replayHash?: string; matchId?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly callOrder: string[];
}

const REPLAY_ROUTE = '/api/me/scores/:replayHash/coach';
const MATCH_ROUTE = '/api/me/matches/:matchId/coach';

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
    generateOrGetCoachReportForMatch: async () => result,
  };
}

function registerAndGetHandler(
  deps: CoachRouteDependencies,
  logic: CoachRouteLogic,
  path: string = REPLAY_ROUTE,
): RegisteredHandler {
  const { router, routes } = makeMockRouter();
  registerCoachRoutes(router as never, {} as never, deps, logic);
  const route = routes.find((entry) => entry.path === path);
  assert.ok(route, 'the coach route is registered: ' + path);
  return route.handler;
}

// A match-route context: the matchId param set, no replayHash.
function makeMatchContext(matchId: string | undefined): MockKoaContext {
  const context = makeMockContext();
  context.params = matchId === undefined ? {} : { matchId };
  return context;
}

describe('registerCoachRoutes (WP-594)', () => {
  // why: WP-751 — the registered-route set grew from one to two (the new matchId
  // route); the replayHash route is unchanged.
  test('registers GET /api/me/scores/:replayHash/coach and GET /api/me/matches/:matchId/coach', () => {
    const { router, routes } = makeMockRouter();
    registerCoachRoutes(router as never, {} as never, makeDeps(), makeLogic({ ok: false, reason: 'not_found' }));
    assert.deepEqual(
      routes.map((route) => route.path),
      [REPLAY_ROUTE, MATCH_ROUTE],
    );
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
      generateOrGetCoachReportForMatch: async () => {
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
      generateOrGetCoachReportForMatch: async () => {
        throw new Error('boom');
      },
    });
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });
});

// ---------------------------------------------------------------------------
// WP-751 / D-24576 — GET /api/me/matches/:matchId/coach
// ---------------------------------------------------------------------------

describe('GET /api/me/matches/:matchId/coach (WP-751)', () => {
  test('200 with { report, wasCached }, Cache-Control first, and the matchId passed through', async () => {
    const receivedMatchIds: string[] = [];
    const handler = registerAndGetHandler(
      makeDeps(),
      {
        generateOrGetCoachReport: async () => ({ ok: false, reason: 'not_found' }),
        generateOrGetCoachReportForMatch: async (_accountId, matchId) => {
          receivedMatchIds.push(matchId);
          return { ok: true, report: STORED, wasCached: false };
        },
      },
      MATCH_ROUTE,
    );
    const context = makeMatchContext('match-1');
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { report: STORED, wasCached: false });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
    assert.deepEqual(receivedMatchIds, ['match-1']);
  });

  test('400 on a missing or empty matchId', async () => {
    for (const matchId of [undefined, '']) {
      const handler = registerAndGetHandler(
        makeDeps(),
        makeLogic({ ok: true, report: STORED, wasCached: false }),
        MATCH_ROUTE,
      );
      const context = makeMatchContext(matchId);
      await handler(context);
      assert.equal(context.status, 400, String(matchId));
      assert.deepEqual(context.body, { error: 'invalid_request' });
    }
  });

  test('401 on a failed session and 403 on a suspended account; the logic is never called', async () => {
    let called = false;
    const logic: CoachRouteLogic = {
      generateOrGetCoachReport: async () => ({ ok: false, reason: 'not_found' }),
      generateOrGetCoachReportForMatch: async () => {
        called = true;
        return { ok: true, report: STORED, wasCached: false };
      },
    };

    const unauthenticated = registerAndGetHandler(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      logic,
      MATCH_ROUTE,
    );
    const unauthenticatedContext = makeMatchContext('match-1');
    await unauthenticated(unauthenticatedContext);
    assert.equal(unauthenticatedContext.status, 401);
    assert.deepEqual(unauthenticatedContext.body, { error: 'missing_token' });

    const suspended = registerAndGetHandler(
      makeDeps({
        requireUnsuspendedAccount: async () =>
          ({ ok: false, code: 'suspended' }) as never,
      }),
      logic,
      MATCH_ROUTE,
    );
    const suspendedContext = makeMatchContext('match-1');
    await suspended(suspendedContext);
    assert.equal(suspendedContext.status, 403);
    assert.deepEqual(suspendedContext.body, { error: 'forbidden' });

    assert.equal(called, false);
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
        MATCH_ROUTE,
      );
      const context = makeMatchContext('match-1');
      await handler(context);
      assert.equal(context.status, expectation.status, expectation.reason);
      assert.deepEqual(context.body, { error: expectation.reason });
    }
  });

  test('500 with a locked envelope when the coach logic throws', async () => {
    const handler = registerAndGetHandler(
      makeDeps(),
      {
        generateOrGetCoachReport: async () => ({ ok: false, reason: 'not_found' }),
        generateOrGetCoachReportForMatch: async () => {
          throw new Error('boom');
        },
      },
      MATCH_ROUTE,
    );
    const context = makeMatchContext('match-1');
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });
});
