/**
 * Tests for the Battle Plan HTTP routes (WP-635 / EC-670).
 *
 * Logic-pure: a fake BattlePlanRouteDependencies + a fake BattlePlanRouteLogic are
 * injected, so no real pg.Pool, no HTTP listener. A mock router captures the two
 * registered handlers; the mock context records header/status/body ordering for the
 * Cache-Control-first assertion. The unit-test context injects request.body directly
 * (no Node stream), so ensureJsonBodyParsed short-circuits.
 *
 * Covers: registration, auth reject (pass-through session code), the participant
 * gate on BOTH PUT and GET (403 not_a_participant for an authenticated
 * non-participant), the per-phase upsert (correct closed-set column passed through +
 * full document returned), the validation error envelopes, and the GET null-document
 * case.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerBattlePlanRoutes } from './battlePlan.routes.js';
import type {
  BattlePlanRouteDependencies,
  BattlePlanRouteLogic,
} from './battlePlan.routes.js';
import type { AccountId } from '../identity/identity.types.js';
import type { SessionTokenRequest } from '../auth/sessionToken.types.js';
import type { BattlePlanColumn, BattlePlanRecord } from './battlePlan.types.js';

type RegisteredHandler = (koaContext: MockKoaContext) => Promise<void> | void;

interface MockKoaContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { matchId?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly callOrder: string[];
}

interface MockRoutes {
  put: Map<string, RegisteredHandler>;
  get: Map<string, RegisteredHandler>;
}

function makeMockRouter(): {
  router: {
    put: (path: string, handler: RegisteredHandler) => void;
    get: (path: string, handler: RegisteredHandler) => void;
  };
  routes: MockRoutes;
} {
  const routes: MockRoutes = { put: new Map(), get: new Map() };
  return {
    router: {
      put(path: string, handler: RegisteredHandler): void {
        routes.put.set(path, handler);
      },
      get(path: string, handler: RegisteredHandler): void {
        routes.get.set(path, handler);
      },
    },
    routes,
  };
}

function makeMockContext(
  over: {
    body?: unknown;
    matchId?: string;
    headers?: Record<string, string | readonly string[] | undefined>;
  } = {},
): MockKoaContext {
  const callOrder: string[] = [];
  let statusValue = 0;
  let bodyValue: unknown = undefined;
  return {
    // why: the guest branch reads X-Guest-* off req.headers (Node lowercases header
    // names); the account-path tests pass no headers so the map is empty.
    req: { headers: over.headers ?? {} } as SessionTokenRequest,
    request: { body: over.body },
    params: over.matchId === undefined ? {} : { matchId: over.matchId },
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

const PARTICIPANT = 'acct-jeff' as AccountId;
const MATCH_ID = 'match-abc';

const RECORD: BattlePlanRecord = {
  matchId: MATCH_ID,
  preBattle: 'read the mastermind',
  battleAdjustments: null,
  postBattle: null,
  updatedByExtId: 'acct-jeff',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T01:00:00.000Z',
};

const VIEW = {
  matchId: MATCH_ID,
  preBattle: 'read the mastermind',
  battleAdjustments: null,
  postBattle: null,
  updatedAt: '2026-09-02T01:00:00.000Z',
};

function makeDeps(
  over: Partial<BattlePlanRouteDependencies> = {},
): BattlePlanRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({ ok: true, value: PARTICIPANT }),
    ...over,
  };
}

function makeLogic(over: Partial<BattlePlanRouteLogic> = {}): BattlePlanRouteLogic {
  return {
    upsertBattlePlanPhase: async () => RECORD,
    readBattlePlan: async () => RECORD,
    // why: the default roster seats the participant, so the gate passes; the
    // non-participant tests override this to an empty (or foreign) roster.
    readSeatAccounts: async () => [{ playerId: '0', accountId: PARTICIPANT }],
    ...over,
  };
}

function register(
  deps: BattlePlanRouteDependencies,
  logic: BattlePlanRouteLogic,
): MockRoutes {
  const { router, routes } = makeMockRouter();
  registerBattlePlanRoutes(router as never, {} as never, deps, logic);
  return routes;
}

const PUT_PATH = '/api/match/:matchId/battle-plan';
const GET_PATH = '/api/match/:matchId/battle-plan';

describe('registerBattlePlanRoutes — registration (WP-635)', () => {
  test('registers both Battle Plan routes', () => {
    const routes = register(makeDeps(), makeLogic());
    assert.ok(routes.put.has(PUT_PATH));
    assert.ok(routes.get.has(GET_PATH));
  });
});

describe('PUT /api/match/:matchId/battle-plan (WP-635)', () => {
  test('200 { battlePlan } on success with Cache-Control set first', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'read the mastermind' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { battlePlan: VIEW });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('passes the closed-set column resolved from the phase to the upsert', async () => {
    let capturedColumn: BattlePlanColumn | 'unset' = 'unset';
    const routes = register(
      makeDeps(),
      makeLogic({
        upsertBattlePlanPhase: async (_matchId, column) => {
          capturedColumn = column;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    await handler(
      makeMockContext({
        matchId: MATCH_ID,
        body: { phase: 'battle_adjustments', text: 'shift to KO focus' },
      }),
    );
    // why: the route must map phase → column via phaseColumnFor before the write, so
    // a single-phase upsert only ever touches that one column (per-column, never a
    // whole-row replace).
    assert.equal(capturedColumn, 'battle_adjustments');
  });

  test('401 with the pass-through session code on a failed session; the upsert is never called', async () => {
    let called = false;
    const routes = register(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      makeLogic({
        upsertBattlePlanPhase: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'x' },
    });
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
    assert.equal(called, false);
  });

  test('403 not_a_participant for an authenticated non-participant; the upsert is never called', async () => {
    let called = false;
    const routes = register(
      makeDeps(),
      makeLogic({
        // why: the caller authenticates but holds no seat in this match's roster.
        readSeatAccounts: async () => [
          { playerId: '0', accountId: 'someone-else' as AccountId },
        ],
        upsertBattlePlanPhase: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'x' },
    });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
    assert.equal(called, false);
  });

  test('400 invalid_request when the matchId path param is missing', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({ body: { phase: 'pre_battle', text: 'x' } });
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'invalid_request' });
  });

  test('400 unknown_phase on a phase outside the closed set', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'debrief', text: 'x' },
    });
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'unknown_phase' });
  });

  test('400 text_too_long when text exceeds the length cap', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'x'.repeat(4001) },
    });
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'text_too_long' });
  });

  test('200 with an empty text (clears the phase — allowed)', async () => {
    let capturedText: unknown = 'unset';
    const routes = register(
      makeDeps(),
      makeLogic({
        upsertBattlePlanPhase: async (_matchId, _column, text) => {
          capturedText = text;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: '' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    assert.equal(capturedText, '');
  });

  test('500 with a locked envelope when the upsert throws', async () => {
    const routes = register(
      makeDeps(),
      makeLogic({
        upsertBattlePlanPhase: async () => {
          throw new Error('boom');
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'x' },
    });
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });
});

describe('GET /api/match/:matchId/battle-plan (WP-635)', () => {
  test('200 { battlePlan } for a participant with Cache-Control first', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { battlePlan: VIEW });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('200 { battlePlan: null } when no plan row exists', async () => {
    const routes = register(makeDeps(), makeLogic({ readBattlePlan: async () => null }));
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { battlePlan: null });
  });

  test('401 with the pass-through session code on a failed session', async () => {
    const routes = register(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      makeLogic(),
    );
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID });
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
  });

  test('403 not_a_participant for an authenticated non-participant; the read is never called', async () => {
    let called = false;
    const routes = register(
      makeDeps(),
      makeLogic({
        readSeatAccounts: async () => [],
        readBattlePlan: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
    assert.equal(called, false);
  });
});

// WP-638 / D-24451 — the guest-seat authorization branch. A caller with no valid
// session may still be authorized by proving a match seat with the boardgame.io
// credential carried in the X-Guest-Player-Id + X-Guest-Credentials headers.
const GUEST_SEAT_CREDENTIALS: Record<string, string> = {
  '0': 'host-cred-0000',
  '1': 'guest-cred-1111',
};

const GUEST_HEADERS: Record<string, string> = {
  'x-guest-player-id': '1',
  'x-guest-credentials': 'guest-cred-1111',
};

/** Deps with NO valid session + a seat-credential map (the guest happy path). */
function makeGuestDeps(
  over: Partial<BattlePlanRouteDependencies> = {},
): BattlePlanRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({
      ok: false,
      reason: 'no token',
      code: 'missing_token',
    }),
    fetchMatchSeatCredentials: async () => GUEST_SEAT_CREDENTIALS,
    ...over,
  };
}

describe('Battle Plan guest-seat authorization (WP-638)', () => {
  test('a guest with a valid credential PUTs, stamped with the guest:<playerId> editor id', async () => {
    let capturedEditor: unknown = 'unset';
    const routes = register(
      makeGuestDeps(),
      makeLogic({
        upsertBattlePlanPhase: async (_matchId, _column, _text, editorExtId) => {
          capturedEditor = editorExtId;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: GUEST_HEADERS,
      body: { phase: 'pre_battle', text: 'guest plan' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { battlePlan: VIEW });
    // why: a guest write is audited as guest:<playerId>, never a real account ext_id.
    assert.equal(capturedEditor, 'guest:1');
  });

  test('a guest with a valid credential GETs the document', async () => {
    const routes = register(makeGuestDeps(), makeLogic());
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID, headers: GUEST_HEADERS });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { battlePlan: VIEW });
  });

  test('a guest with a WRONG credential gets 403 not_a_participant; the upsert is never called', async () => {
    let called = false;
    const routes = register(
      makeGuestDeps(),
      makeLogic({
        upsertBattlePlanPhase: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: {
        'x-guest-player-id': '1',
        'x-guest-credentials': 'guest-cred-WRONG',
      },
      body: { phase: 'pre_battle', text: 'x' },
    });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
    assert.equal(called, false);
  });

  test('a guest for a seat ABSENT from the metadata gets 403 (indistinguishable from a wrong credential)', async () => {
    const routes = register(makeGuestDeps(), makeLogic());
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: {
        'x-guest-player-id': '9',
        'x-guest-credentials': 'anything',
      },
    });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
  });

  test('a guest whose match has no metadata (fetch → null) gets 403 (no seat-existence oracle)', async () => {
    const routes = register(
      makeGuestDeps({ fetchMatchSeatCredentials: async () => null }),
      makeLogic(),
    );
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID, headers: GUEST_HEADERS });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
  });

  test('a VALID session IGNORES guest headers — the account path wins and the fetch is never called', async () => {
    let fetchCalled = false;
    let capturedEditor: unknown = 'unset';
    const routes = register(
      // why: default deps = a VALID session for PARTICIPANT. Guest headers are also
      // present, but a valid session must take the account path and never consult them.
      makeDeps({
        fetchMatchSeatCredentials: async () => {
          fetchCalled = true;
          return GUEST_SEAT_CREDENTIALS;
        },
      }),
      makeLogic({
        upsertBattlePlanPhase: async (_matchId, _column, _text, editorExtId) => {
          capturedEditor = editorExtId;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: GUEST_HEADERS,
      body: { phase: 'pre_battle', text: 'account plan' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    // why: audited as the ACCOUNT ext_id, not guest:1 — the guest headers were ignored.
    assert.equal(capturedEditor, PARTICIPANT);
    assert.equal(fetchCalled, false);
  });

  test('SPOOF VECTOR: a valid NON-participant session + valid guest headers still gets the account-path 403 (never guest authorization)', async () => {
    let fetchCalled = false;
    let upsertCalled = false;
    const routes = register(
      // why: a VALID session whose account is NOT in the roster, PLUS valid guest
      // headers. The account holder must NOT be able to fall through to the guest path
      // to author a seat they do not own — the account-path 403 is final.
      makeDeps({
        fetchMatchSeatCredentials: async () => {
          fetchCalled = true;
          return GUEST_SEAT_CREDENTIALS;
        },
      }),
      makeLogic({
        readSeatAccounts: async () => [
          { playerId: '0', accountId: 'someone-else' as AccountId },
        ],
        upsertBattlePlanPhase: async () => {
          upsertCalled = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: GUEST_HEADERS,
      body: { phase: 'pre_battle', text: 'spoof attempt' },
    });
    await handler(context);
    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
    assert.equal(upsertCalled, false);
    // why: the guest credential fetch must never run once a valid session is present.
    assert.equal(fetchCalled, false);
  });

  test('no session AND no guest headers → the pass-through 401 (the WP-635 behaviour)', async () => {
    const routes = register(makeGuestDeps(), makeLogic());
    const handler = routes.get.get(GET_PATH)!;
    const context = makeMockContext({ matchId: MATCH_ID });
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
  });

  test('a guest write touches NO seat roster — the seat table stays empty (guests stay rowless)', async () => {
    let rosterRead = false;
    let capturedEditor: unknown = 'unset';
    const routes = register(
      makeGuestDeps(),
      makeLogic({
        // why: the guest branch never reads the account seat roster and the routes
        // have no seat-account WRITE surface at all, so a guest write can add no
        // match_seat_accounts row — the logic-pure proxy for "guests stay rowless".
        readSeatAccounts: async () => {
          rosterRead = true;
          return [];
        },
        upsertBattlePlanPhase: async (_matchId, _column, _text, editorExtId) => {
          capturedEditor = editorExtId;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      headers: GUEST_HEADERS,
      body: { phase: 'pre_battle', text: 'guest plan' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    assert.equal(capturedEditor, 'guest:1');
    assert.equal(rosterRead, false);
  });

  test('the account path is unchanged — a seated account write is stamped with its own ext_id', async () => {
    let capturedEditor: unknown = 'unset';
    const routes = register(
      makeDeps(),
      makeLogic({
        upsertBattlePlanPhase: async (_matchId, _column, _text, editorExtId) => {
          capturedEditor = editorExtId;
          return RECORD;
        },
      }),
    );
    const handler = routes.put.get(PUT_PATH)!;
    const context = makeMockContext({
      matchId: MATCH_ID,
      body: { phase: 'pre_battle', text: 'account plan' },
    });
    await handler(context);
    assert.equal(context.status, 200);
    assert.equal(capturedEditor, PARTICIPANT);
  });
});
