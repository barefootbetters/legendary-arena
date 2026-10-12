/**
 * Tests for the operator-match eligibility and board routes
 * (WP-802 / EC-839 / D-24689 §4).
 *
 * Pure unit tests: a fake router captures the handlers, a fake
 * `requireAdminSession` stands in for the WP-159 admin gate, and a fake
 * boardgame.io store returns a real engine state built through setup. No
 * network, no DB.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState } from '@legendary-arena/game-engine';

import { registerOperatorMatchRoutes, type OperatorMatchRouteContext } from './operatorMatch.routes.js';
import { recordOperatorBotDecision } from './operatorBotDecisions.js';
import type { AdminSessionResult } from '../auth/adminSession.js';

type Handler = (koaContext: FakeContext) => Promise<void>;

interface FakeContext {
  req: { headers: Record<string, string> };
  params: Record<string, string>;
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

const ELIGIBILITY_PATH = '/api/admin/operator-match/eligibility';
const BOARD_PATH = '/api/admin/operator-match/:matchId/board';

const ADMIN: AdminSessionResult = { ok: true, accountId: 'acct-admin' as never };
const NON_ADMIN: AdminSessionResult = {
  ok: false,
  code: 'forbidden',
  reason: 'Authenticated account does not have admin privileges.',
};
const SIGNED_OUT: AdminSessionResult = {
  ok: false,
  code: 'unauthorized',
  reason: 'Admin session validation failed: upstream session check rejected the request.',
};

/**
 * Builds a real two-seat engine state through setup, flagged as an operator
 * match when `isOperatorMatch` is true, wrapped as a fetched match state.
 */
function fetchedState(isOperatorMatch: boolean): unknown {
  const config = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
    ...(isOperatorMatch ? { isDebugMatch: true } : {}),
  };
  const registry = { listCards: () => [] };
  const setupContext = {
    ctx: { numPlayers: 2 },
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };
  const gameState = buildInitialGameState(config as never, registry as never, setupContext as never);
  return { G: gameState, ctx: { phase: 'play', turn: 2, currentPlayer: '1', numPlayers: 2 }, _stateID: 4 };
}

/**
 * Builds the route context with a fixed admin-check answer and a fake store
 * mapping match ids to fetched states; `fetchCalls` records every store read.
 */
function makeRouteContext(
  adminResult: AdminSessionResult,
  states: Record<string, unknown>,
  fetchError?: Error,
): { context: OperatorMatchRouteContext; fetchCalls: string[] } {
  const fetchCalls: string[] = [];
  const context = {
    db: {
      async fetch(matchId: string) {
        fetchCalls.push(matchId);
        if (fetchError !== undefined) {
          throw fetchError;
        }
        return { state: states[matchId] };
      },
    },
    requireAdminSession: async () => adminResult,
    database: {} as never,
  } as unknown as OperatorMatchRouteContext;
  return { context, fetchCalls };
}

/** Registers the routes and returns the handler for one path. */
function collectHandler(context: OperatorMatchRouteContext, path: string): Handler {
  const handlers = new Map<string, Handler>();
  const router = {
    get(routePath: string, handler: Handler): void {
      handlers.set(routePath, handler);
    },
  };
  registerOperatorMatchRoutes(router as never, context);
  const handler = handlers.get(path);
  if (handler === undefined) {
    throw new Error(`The route ${path} was not registered.`);
  }
  return handler;
}

/** Builds a fake Koa context for a request. */
function makeContext(params: Record<string, string> = {}): FakeContext {
  return {
    req: { headers: { authorization: 'Bearer test-token' } },
    params,
    status: 0,
    body: undefined,
    headers: {},
    set(field: string, value: string): void {
      this.headers[field] = value;
    },
  };
}

describe('operator-match routes — admin gate (WP-802 / D-24689)', () => {
  for (const path of [ELIGIBILITY_PATH, BOARD_PATH]) {
    test(`${path} returns 401 without a session and reads no match state`, async () => {
      const { context, fetchCalls } = makeRouteContext(SIGNED_OUT, { 'match-op': fetchedState(true) });
      const koaContext = makeContext({ matchId: 'match-op' });
      await collectHandler(context, path)(koaContext);
      assert.equal(koaContext.status, 401);
      assert.equal(koaContext.headers['Cache-Control'], 'no-store');
      assert.deepEqual(fetchCalls, [], 'the admin check runs before any db.fetch');
    });

    test(`${path} returns 403 for a non-admin session and reads no match state`, async () => {
      const { context, fetchCalls } = makeRouteContext(NON_ADMIN, { 'match-op': fetchedState(true) });
      const koaContext = makeContext({ matchId: 'match-op' });
      await collectHandler(context, path)(koaContext);
      assert.equal(koaContext.status, 403);
      assert.deepEqual(fetchCalls, []);
    });
  }

  test('a failed admin lookup returns 500 and reads no match state', async () => {
    const lookupFailed: AdminSessionResult = {
      ok: false,
      code: 'lookup_failed',
      reason: 'Failed to read admin authorization for the authenticated account.',
    };
    const { context, fetchCalls } = makeRouteContext(lookupFailed, {});
    const koaContext = makeContext({ matchId: 'match-op' });
    await collectHandler(context, BOARD_PATH)(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(fetchCalls, []);
  });
});

describe('GET /api/admin/operator-match/eligibility', () => {
  test('returns 200 { isOperator: true } for an admin', async () => {
    const { context } = makeRouteContext(ADMIN, {});
    const koaContext = makeContext();
    await collectHandler(context, ELIGIBILITY_PATH)(koaContext);
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { isOperator: true });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });
});

describe('GET /api/admin/operator-match/:matchId/board', () => {
  test('returns 404 for an unknown match', async () => {
    const { context } = makeRouteContext(ADMIN, {});
    const koaContext = makeContext({ matchId: 'match-missing' });
    await collectHandler(context, BOARD_PATH)(koaContext);
    assert.equal(koaContext.status, 404);
  });

  test('returns 409 for a normal (non-operator) match', async () => {
    const { context } = makeRouteContext(ADMIN, { 'match-normal': fetchedState(false) });
    const koaContext = makeContext({ matchId: 'match-normal' });
    await collectHandler(context, BOARD_PATH)(koaContext);
    assert.equal(koaContext.status, 409);
  });

  test('returns 500 with the locked message when db.fetch throws', async () => {
    const { context } = makeRouteContext(ADMIN, {}, new Error('connection reset'));
    const koaContext = makeContext({ matchId: 'match-op' });
    await collectHandler(context, BOARD_PATH)(koaContext);
    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, {
      error: 'The operator board could not be read from the match store; try again in a moment.',
    });
  });

  test('returns 200 with every seat and the recorded bot decisions for an operator match', async () => {
    const matchId = 'routes-test-operator-match';
    recordOperatorBotDecision(matchId, {
      turn: 2,
      seat: '1',
      isForced: true,
      move: { name: 'resolveKoHeroChoice', args: { zone: 'hand', cardId: 'x' } },
      decisionLog: [],
      legalMoveCount: 1,
    });
    const { context } = makeRouteContext(ADMIN, { [matchId]: fetchedState(true) });
    const koaContext = makeContext({ matchId });
    await collectHandler(context, BOARD_PATH)(koaContext);

    assert.equal(koaContext.status, 200);
    const body = koaContext.body as {
      matchId: string;
      operatorView: { seats: Array<{ playerId: string; hand: string[] }>; board: { isDebugMatch?: boolean } };
      botDecisions: Array<{ isForced: boolean; legalMoveCount: number }>;
    };
    assert.equal(body.matchId, matchId);
    assert.deepEqual(body.operatorView.seats.map((seat) => seat.playerId), ['0', '1']);
    assert.ok(body.operatorView.seats[1]!.hand.length > 0, 'the bot seat\'s hand is revealed to the operator');
    assert.equal(body.operatorView.board.isDebugMatch, true);
    assert.equal(body.botDecisions.length, 1);
    assert.equal(body.botDecisions[0]!.isForced, true);
    assert.equal(body.botDecisions[0]!.legalMoveCount, 1);
  });
});
