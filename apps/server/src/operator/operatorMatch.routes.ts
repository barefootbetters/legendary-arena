/**
 * Operator-match HTTP routes — Server Layer (WP-802 / EC-839 / D-24689).
 *
 * Registers two `admin-session-required` routes:
 *
 *   * `GET /api/admin/operator-match/eligibility` — `200 { isOperator: true }`
 *     for an admin, so the planned client follow-on can show the operator option.
 *   * `GET /api/admin/operator-match/:matchId/board` — the whole-board read of an
 *     operator match: `200 { matchId, operatorView, botDecisions }`, 404 for an
 *     unknown match, 409 for a match that is not an operator match.
 *
 * The operator create route (`POST /api/admin/operator-match/create-with-bot`)
 * lives in `bot-ally/botAllyRoutes.mjs`, beside the public bot-ally create it
 * shares its steps with.
 *
 * Every handler sets `Cache-Control: no-store` first (D-11504) and runs the
 * D-15902 admin check (`requireAdminSession`) as its first business-logic step,
 * before any match read. Server wires, engine decides: the server reads only the
 * fetched `G` it hands to the engine; `buildOperatorView` decides whether the
 * match is an operator match and what the operator sees.
 *
 * Mirrors `billing/adminBilling.routes.ts` (caller-injected deps, local Koa
 * interfaces, no `@koa/router` import).
 */

import { buildOperatorView } from '@legendary-arena/game-engine';
import type { LegendaryGameState, OperatorBuildContext } from '@legendary-arena/game-engine';
import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  DatabaseClient,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import { readOperatorBotDecisions } from './operatorBotDecisions.js';

/** The fetched live state of a boardgame.io match, as far as this module reads it. */
interface FetchedMatchState {
  readonly G: LegendaryGameState;
  readonly ctx: { readonly phase: string | null; readonly turn: number; readonly currentPlayer: string };
}

/** The boardgame.io storage surface this module reads (`db.fetch` only). */
interface OperatorMatchStore {
  fetch(
    matchId: string,
    options: { state: true },
  ): Promise<{ state?: FetchedMatchState | null }>;
}

/** Caller-injected dependency bundle for {@link registerOperatorMatchRoutes}. */
export interface OperatorMatchRouteContext {
  readonly db: OperatorMatchStore;
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly database: DatabaseClient;
}

/** Minimal structural shape of the Koa context surface this module touches. */
interface KoaOperatorContext {
  readonly req: SessionTokenRequest;
  readonly params: Record<string, string>;
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  get(path: string, handler: (koaContext: KoaOperatorContext) => Promise<void>): unknown;
}

const BOARD_READ_FAILED_MESSAGE =
  'The operator board could not be read from the match store; try again in a moment.';

/**
 * Runs the D-15902 admin check and, on failure, writes the 401 / 403 / 500
 * response.
 *
 * @param koaContext - The request context.
 * @param context - The route dependencies.
 * @returns `true` when the caller is an admin and the handler may continue.
 */
async function passesAdminCheck(
  koaContext: KoaOperatorContext,
  context: OperatorMatchRouteContext,
): Promise<boolean> {
  const authResult = await context.requireAdminSession(koaContext.req, {
    verifier: context.verifier,
    accountResolver: context.accountResolver,
    database: context.database,
  });
  if (authResult.ok === true) {
    return true;
  }
  if (authResult.code === 'unauthorized') {
    koaContext.status = 401;
    koaContext.body = { code: 'unauthorized', reason: authResult.reason };
  } else if (authResult.code === 'forbidden') {
    koaContext.status = 403;
    koaContext.body = { code: 'forbidden', reason: authResult.reason };
  } else {
    koaContext.status = 500;
    koaContext.body = {
      error: 'The admin check for this operator route could not be completed; try again in a moment.',
    };
  }
  return false;
}

/**
 * Handles `GET /api/admin/operator-match/:matchId/board` after the admin check.
 *
 * @param koaContext - The request context.
 * @param context - The route dependencies.
 */
async function respondWithOperatorBoard(
  koaContext: KoaOperatorContext,
  context: OperatorMatchRouteContext,
): Promise<void> {
  const matchId = koaContext.params.matchId ?? '';
  let state: FetchedMatchState | null | undefined;
  try {
    // why: D-24689 §4 — the fifth framework-store carve-out. This admin-only
    // route reads a match's live state solely to hand G to the engine's
    // buildOperatorView, which returns a view only for an operator match. The
    // read is never written back, never persisted, never a save-game and never a
    // source of competitive or derived features; any other match gets 409.
    const fetched = await context.db.fetch(matchId, { state: true });
    state = fetched.state;
  } catch (fetchError) {
    console.error(
      `[operator-match] the board read for match ${matchId} failed: ${(fetchError as Error).message}`,
    );
    koaContext.status = 500;
    koaContext.body = { error: BOARD_READ_FAILED_MESSAGE };
    return;
  }
  if (state === null || state === undefined) {
    koaContext.status = 404;
    koaContext.body = { error: `No match with id ${matchId} exists; check the match id and try again.` };
    return;
  }
  const buildContext: OperatorBuildContext = {
    phase: state.ctx.phase,
    turn: state.ctx.turn,
    currentPlayer: state.ctx.currentPlayer,
  };
  const operatorView = buildOperatorView(state.G, buildContext);
  if (operatorView === null) {
    koaContext.status = 409;
    koaContext.body = {
      error: `Match ${matchId} is not an operator match, so its whole board can't be read; only an operator match created by an admin can be inspected.`,
    };
    return;
  }
  koaContext.status = 200;
  koaContext.body = { matchId, operatorView, botDecisions: readOperatorBotDecisions(matchId) };
}

/**
 * Registers the operator eligibility and board routes on the Koa router.
 *
 * @param router - The boardgame.io server's Koa router.
 * @param context - The injected match store and admin-check dependencies.
 */
export function registerOperatorMatchRoutes(
  router: KoaRouter,
  context: OperatorMatchRouteContext,
): void {
  router.get('/api/admin/operator-match/eligibility', async (koaContext) => {
    // why: D-11504 — no-store first, so a thrown fault still leaves it set.
    koaContext.set('Cache-Control', 'no-store');
    if (!(await passesAdminCheck(koaContext, context))) {
      return;
    }
    koaContext.status = 200;
    koaContext.body = { isOperator: true };
  });

  router.get('/api/admin/operator-match/:matchId/board', async (koaContext) => {
    // why: D-11504 — no-store first; the board reveals every hidden zone.
    koaContext.set('Cache-Control', 'no-store');
    if (!(await passesAdminCheck(koaContext, context))) {
      return;
    }
    await respondWithOperatorBoard(koaContext, context);
  });
}
