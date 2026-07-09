/**
 * Tests for the competitive score submission HTTP route (WP-332).
 *
 * All tests are logic-pure: fake `CompetitionRouteDependencies` and a
 * fake `CompetitionLogic` are injected, so no real `pg.Pool`, no HTTP
 * listener, and no `boardgame.io` import. The mock router captures the
 * single registered POST handler; the mock `koaContext` mirrors the
 * locally-declared `KoaCompetitionContext` shape plus test-only
 * `headerCalls` / `callOrder` arrays for the Cache-Control-first
 * discipline assertion.
 *
 * Authority: WP-332 §Acceptance Criteria; EC-362 §After Completing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerCompetitionRoutes } from './competition.routes.js';
import type {
  CompetitionLogic,
  CompetitionRouteDependencies,
} from './competition.routes.js';
import type {
  CompetitiveScoreRecord,
  SubmissionResult,
} from './competition.types.js';
import type {
  AccountId,
  PlayerAccount,
} from '../identity/identity.types.js';
import type { SessionTokenRequest } from '../auth/sessionToken.types.js';

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

type RegisteredHandler = (koaContext: MockKoaContext) => Promise<void> | void;

interface RegisteredRoute {
  readonly path: string;
  readonly handler: RegisteredHandler;
}

interface MockKoaContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly headerCalls: { field: string; value: string }[];
  readonly callOrder: string[];
}

/** Minimal mock Koa router capturing `(path, handler)` POST pairs. */
function makeMockRouter(): {
  router: { post: (path: string, handler: RegisteredHandler) => void };
  routes: RegisteredRoute[];
} {
  const routes: RegisteredRoute[] = [];
  const router = {
    post(path: string, handler: RegisteredHandler): void {
      routes.push({ path, handler });
    },
  };
  return { router, routes };
}

/** Builds a fresh mock context; records `set()`/status/body ordering. */
function makeMockContext(body: unknown = { replayHash: 'hash-abc' }): MockKoaContext {
  const headerCalls: { field: string; value: string }[] = [];
  const callOrder: string[] = [];
  let statusValue = 0;
  let bodyValue: unknown = undefined;
  const proxied: MockKoaContext = {
    // why: the handler only reads `koaContext.req` (forwarded to the
    // fake session resolver) and `koaContext.request.body` — the
    // sentinel `req` is never dereferenced by the fakes.
    req: {} as SessionTokenRequest,
    request: { body },
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
    set(field: string, value: string): void {
      headerCalls.push({ field, value });
      callOrder.push(`set:${field}`);
    },
    headerCalls,
    callOrder,
  };
  return proxied;
}

const SENTINEL_ACCOUNT_ID = 'account-123' as AccountId;
// why: the fakes never touch the database, so a sentinel typed to the
// registration signature's 2nd parameter is sufficient.
const SENTINEL_DATABASE = {} as Parameters<typeof registerCompetitionRoutes>[1];

const SAMPLE_RECORD: CompetitiveScoreRecord = {
  submissionId: 1,
  accountId: SENTINEL_ACCOUNT_ID,
  replayHash: 'hash-abc',
  scenarioKey: 'scheme::mm::vg',
  rawScore: 100,
  finalScore: -5,
  scoreBreakdown: {} as CompetitiveScoreRecord['scoreBreakdown'],
  parVersion: 'v1',
  scoringConfigVersion: 1,
  stateHash: 'hash-abc',
  createdAt: '2026-07-08T00:00:00.000Z',
};

const SAMPLE_ACCOUNT: PlayerAccount = {
  accountId: SENTINEL_ACCOUNT_ID,
  email: 'player@example.com',
  displayName: 'Player One',
  authProvider: 'email',
  authProviderId: 'auth-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Deps with all gates passing by default; override per test. */
function makeDeps(
  overrides: Partial<CompetitionRouteDependencies> = {},
): CompetitionRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({
      ok: true,
      value: SENTINEL_ACCOUNT_ID,
    }),
    requireUnsuspendedAccount: async () => ({ ok: true }),
    checkParPublished: () => null,
    ...overrides,
  };
}

/** Logic seam returning a fresh accepted submission by default. */
function makeLogic(overrides: Partial<CompetitionLogic> = {}): {
  logic: CompetitionLogic;
  calls: { submit: number; findAccount: number };
} {
  const calls = { submit: 0, findAccount: 0 };
  const logic: CompetitionLogic = {
    findPlayerByAccountId: async () => {
      calls.findAccount += 1;
      return SAMPLE_ACCOUNT;
    },
    submitCompetitiveScoreForRequest: async (): Promise<SubmissionResult> => {
      calls.submit += 1;
      return { ok: true, record: SAMPLE_RECORD, wasExisting: false };
    },
    ...overrides,
  };
  return { logic, calls };
}

/** Register the single route and return its handler for invocation. */
function buildHandler(
  deps: CompetitionRouteDependencies,
  logic: CompetitionLogic,
): RegisteredHandler {
  const { router, routes } = makeMockRouter();
  registerCompetitionRoutes(router, SENTINEL_DATABASE, deps, logic);
  assert.equal(routes.length, 1);
  return routes[0].handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('competition routes (WP-332)', () => {
  test('1 — registers exactly one POST handler at the locked path', () => {
    const { router, routes } = makeMockRouter();
    const { logic } = makeLogic();
    registerCompetitionRoutes(router, SENTINEL_DATABASE, makeDeps(), logic);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].path, '/api/competition/scores');
  });

  test('2 — Cache-Control: no-store is set before any status/body write', async () => {
    const { logic } = makeLogic();
    const handler = buildHandler(makeDeps(), logic);
    const context = makeMockContext();
    await handler(context);
    assert.deepEqual(context.headerCalls, [
      { field: 'Cache-Control', value: 'no-store' },
    ]);
    // why: the Cache-Control set() must precede the first status/body
    // write so the header survives every response path (incl. 500).
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('3 — 401 on a failed session; submission is never attempted', async () => {
    const { logic, calls } = makeLogic();
    const deps = makeDeps({
      requireAuthenticatedSession: async () => ({
        ok: false,
        reason: 'No bearer token was supplied.',
        code: 'missing_token',
      }),
    });
    const handler = buildHandler(deps, logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
    assert.equal(calls.findAccount, 0);
    assert.equal(calls.submit, 0);
  });

  test('4 — 500 on session_verifier_not_configured (operator fault)', async () => {
    const { logic } = makeLogic();
    const deps = makeDeps({
      requireAuthenticatedSession: async () => ({
        ok: false,
        reason: 'No session verifier is configured.',
        code: 'session_verifier_not_configured',
      }),
    });
    const handler = buildHandler(deps, logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'session_verifier_not_configured' });
  });

  test('5 — 403 forbidden on a suspended account; submission never attempted', async () => {
    const { logic, calls } = makeLogic();
    const deps = makeDeps({
      requireUnsuspendedAccount: async () => ({
        ok: false,
        code: 'suspended',
        reason: 'Account is suspended.',
      }),
    });
    const handler = buildHandler(deps, logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'forbidden' });
    assert.equal(calls.submit, 0);
  });

  test('6 — 500 on a suspension lookup_failed', async () => {
    const { logic } = makeLogic();
    const deps = makeDeps({
      requireUnsuspendedAccount: async () => ({
        ok: false,
        code: 'lookup_failed',
        reason: 'Failed to read suspension state for the supplied accountId.',
      }),
    });
    const handler = buildHandler(deps, logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });

  test('7 — 400 on a missing or empty replayHash', async () => {
    const { logic, calls } = makeLogic();
    const handler = buildHandler(makeDeps(), logic);
    for (const badBody of [{}, { replayHash: '' }, { replayHash: 42 }, null, 'x']) {
      const context = makeMockContext(badBody);
      await handler(context);
      assert.equal(context.status, 400);
      assert.deepEqual(context.body, { error: 'invalid_request' });
    }
    assert.equal(calls.submit, 0);
  });

  test('8 — 200 with the record and wasExisting:false on a fresh insert', async () => {
    const { logic } = makeLogic();
    const handler = buildHandler(makeDeps(), logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, {
      record: SAMPLE_RECORD,
      wasExisting: false,
    });
  });

  test('9 — 200 with wasExisting:true on an idempotent retry', async () => {
    const { logic } = makeLogic({
      submitCompetitiveScoreForRequest: async () => ({
        ok: true,
        record: SAMPLE_RECORD,
        wasExisting: true,
      }),
    });
    const handler = buildHandler(makeDeps(), logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { record: SAMPLE_RECORD, wasExisting: true });
  });

  test('10 — each rejection reason maps to its locked status', async () => {
    const expected: Array<[SubmissionResult, number]> = [
      [{ ok: false, reason: 'replay_not_found' }, 404],
      [{ ok: false, reason: 'not_owner' }, 403],
      [{ ok: false, reason: 'visibility_not_eligible' }, 403],
      [{ ok: false, reason: 'par_not_published' }, 422],
      [{ ok: false, reason: 'replay_verification_failed' }, 422],
    ];
    for (const [rejection, status] of expected) {
      const { logic } = makeLogic({
        submitCompetitiveScoreForRequest: async () => rejection,
      });
      const handler = buildHandler(makeDeps(), logic);
      const context = makeMockContext();
      await handler(context);
      assert.equal(context.status, status);
      assert.deepEqual(context.body, {
        error: (rejection as { reason: string }).reason,
      });
    }
  });

  test('11 — 500 when the account row cannot be loaded', async () => {
    const { logic } = makeLogic({
      findPlayerByAccountId: async () => null,
    });
    const handler = buildHandler(makeDeps(), logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });

  test('12 — 500 when the submission throws (no re-throw, locked envelope)', async () => {
    const { logic } = makeLogic({
      submitCompetitiveScoreForRequest: async () => {
        throw new Error('Simulated infrastructure failure during submission.');
      },
    });
    const handler = buildHandler(makeDeps(), logic);
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
    // Cache-Control still set on the thrown-error path.
    assert.deepEqual(context.headerCalls, [
      { field: 'Cache-Control', value: 'no-store' },
    ]);
  });
});
