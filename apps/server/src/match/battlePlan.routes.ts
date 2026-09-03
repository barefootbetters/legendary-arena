/**
 * Battle Plan API — HTTP Routes (WP-635 / EC-670 / D-24449)
 *
 * Registers the two Battle Plan endpoints on the existing Koa router returned by
 * boardgame.io's `Server({...})` instance:
 *
 *   * `PUT /api/match/:matchId/battle-plan` (auth + participant) — upsert one
 *     phase's text and return the full current document.
 *   * `GET /api/match/:matchId/battle-plan` (auth + participant) — read the current
 *     three-phase document (or `{ battlePlan: null }` when none exists).
 *
 * Mirrors the WP-604 `feedback.routes.ts` authenticated-route pattern: local
 * structural `KoaRouter` / context interfaces (no `@koa/router` import),
 * caller-injected `requireAuthenticatedSession` / `verifier` / `accountResolver`,
 * `Cache-Control: no-store` as the first statement of every handler (D-11504), a
 * uniform `{ error: <code> }` envelope, and a `try/catch` that turns any uncaught
 * throw into a typed 500. The write route parses its body with its OWN `koaBody()` —
 * boardgame.io installs no global `/api` parser, so `request.body` is undefined in
 * production without it.
 *
 * Both routes are participant-gated: after `requireAuthenticatedSession` resolves the
 * caller's accountId, the route rejects (`403 not_a_participant`) unless that id is in
 * the match's seat roster (`readSeatAccounts`). The gate applies to BOTH routes — a
 * non-participant can neither read nor write.
 *
 * Layer-boundary contract: imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. The `pg` driver is reachable only through the injected DatabaseClient.
 *
 * Authority: WP-635 §Scope E + §F; EC-670; D-24449; D-11504 (Cache-Control first);
 * D-9905 (Auth closed set); D-24120 (bots/guests have no seat-account row).
 */

import koaBody from 'koa-body';

import {
  phaseColumnFor,
  validateUpdateBattlePlanInput,
} from './battlePlan.logic.js';
import { toBattlePlanView } from './battlePlan.logic.js';
import {
  readBattlePlan,
  upsertBattlePlanPhase,
} from './battlePlan.persistence.js';
import { readSeatAccounts } from './seatAccount.logic.js';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

/**
 * Closed-set re-statement of the WP-112 orchestrator's
 * `Result<AccountId, SessionValidationCode>` shape. Declared locally (mirrors the
 * feedback / coach / competition precedent) so this file does not depend on the
 * profile layer for a type the auth layer owns.
 */
type SessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: SessionValidationCode };

/**
 * Caller-injected dependency bundle for `registerBattlePlanRoutes`.
 * `requireAuthenticatedSession` is the WP-112 orchestrator (or a test fake);
 * `verifier` + `accountResolver` are the broker-specific implementations passed
 * through at request time. Same trio the other authenticated routes consume.
 */
export interface BattlePlanRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}

/**
 * Test-only injection seam (mirrors WP-604's `FeedbackRouteLogic`). Production
 * callers omit the 4th parameter and the handlers resolve to the imported
 * persistence + seat-roster functions; tests pass fakes returning canned results,
 * so no real database is touched.
 */
export interface BattlePlanRouteLogic {
  readonly upsertBattlePlanPhase: typeof upsertBattlePlanPhase;
  readonly readBattlePlan: typeof readBattlePlan;
  readonly readSeatAccounts: typeof readSeatAccounts;
}

const PRODUCTION_BATTLE_PLAN_ROUTE_LOGIC: BattlePlanRouteLogic = {
  upsertBattlePlanPhase,
  readBattlePlan,
  readSeatAccounts,
};

/** Minimal structural shape of the Koa context surface this module touches. */
interface KoaBattlePlanContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { matchId?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  put(
    path: string,
    handler: (koaContext: KoaBattlePlanContext) => Promise<void> | void,
  ): unknown;
  get(
    path: string,
    handler: (koaContext: KoaBattlePlanContext) => Promise<void> | void,
  ): unknown;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is no
// global body parser — so the PUT route must parse its own JSON body. Without it, in
// production koaContext.request.body is undefined and validateUpdateBattlePlanInput
// rejects EVERY write. The gap is latent: unit tests inject request.body directly, so
// they never exercise the missing parser (the shipped competition-route bug class).
const battlePlanRouteJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for the unit-test fake context (which injects
 * `request.body` directly and exposes no stream), so the same handler works in
 * production and under `node:test` — mirroring the feedback-route short-circuit.
 *
 * @param koaContext The Battle Plan request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaBattlePlanContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    battlePlanRouteJsonBodyParser as unknown as (
      koaContext: KoaBattlePlanContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Map a `SessionValidationCode` to its locked HTTP status (the feedback / coach /
 * competition mapping): operator-facing faults → 500; every other code → 401.
 */
// why: 'unknown_account' returns 401 (NOT 403) per the account-existence-probe
// defense — a 403 would confirm the account exists, letting an attacker enumerate
// valid accounts.
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Resolve the authenticated caller, then confirm the caller is a participant in the
 * match. Returns the caller's accountId on success, or a `{ status, body }` rejection
 * the handler returns verbatim: `401` / `500` for a failed session (the pass-through
 * session code), `400 invalid_request` for a missing matchId, `403 not_a_participant`
 * for an authenticated non-participant.
 *
 * why (participant gate): the Battle Plan is a seated-TEAM artifact — only an account
 * holding a seat in the match may read or write it. Bots and guests have no
 * legendary.match_seat_accounts row (D-24120), so they are never participants. The
 * same gate applies to BOTH routes (read and write are symmetric).
 *
 * @param koaContext The request context.
 * @param database The caller-injected `pg` pool.
 * @param deps The auth dependency bundle.
 * @param logic The injected logic seam (for `readSeatAccounts`).
 * @returns `{ ok: true, accountId, matchId }`, or `{ ok: false, status, body }`.
 */
async function resolveParticipant(
  koaContext: KoaBattlePlanContext,
  database: DatabaseClient,
  deps: BattlePlanRouteDependencies,
  logic: BattlePlanRouteLogic,
): Promise<
  | { ok: true; accountId: AccountId; matchId: string }
  | { ok: false; status: number; body: { error: string } }
> {
  const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database,
  });
  if (sessionResult.ok !== true) {
    return {
      ok: false,
      status: statusForSessionValidationCode(sessionResult.code),
      body: { error: sessionResult.code },
    };
  }

  const matchId = koaContext.params.matchId;
  if (matchId === undefined || matchId === '') {
    return { ok: false, status: 400, body: { error: 'invalid_request' } };
  }

  const roster = await logic.readSeatAccounts(matchId, database);
  const isParticipant = roster.some(
    (seat) => seat.accountId === sessionResult.value,
  );
  if (!isParticipant) {
    return { ok: false, status: 403, body: { error: 'not_a_participant' } };
  }

  return { ok: true, accountId: sessionResult.value, matchId };
}

/**
 * Register the two Battle Plan routes on the supplied Koa router. The router is
 * mutated in place; the function returns `void`. Production callers in
 * `apps/server/src/server.mjs` pass the Koa router from boardgame.io's
 * `Server({...})` (`server.router`), the long-lived `pg.Pool`, and the dependency
 * bundle. The optional `battlePlanLogic` 4th parameter is a test-only injection seam.
 */
export function registerBattlePlanRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: BattlePlanRouteDependencies,
  battlePlanLogic: BattlePlanRouteLogic = PRODUCTION_BATTLE_PLAN_ROUTE_LOGIC,
): void {
  // PUT /api/match/:matchId/battle-plan — upsert one phase (auth + participant).
  router.put('/api/match/:matchId/battle-plan', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (D-11504) so it is set on every
    // path, including the 500. A Battle Plan write receipt is never cacheable.
    koaContext.set('Cache-Control', 'no-store');

    const gate = await resolveParticipant(koaContext, database, deps, battlePlanLogic);
    if (gate.ok !== true) {
      koaContext.status = gate.status;
      koaContext.body = gate.body;
      return;
    }

    // why: parse the JSON body before reading it — boardgame.io's koa-body is scoped
    // to /games/*, so without this the production request.body is undefined and the
    // validator below rejects every write. No-op under node:test.
    await ensureJsonBodyParsed(koaContext);

    const validation = validateUpdateBattlePlanInput(koaContext.request.body);
    if (validation.ok !== true) {
      koaContext.status = 400;
      koaContext.body = { error: validation.code };
      return;
    }

    try {
      const column = phaseColumnFor(validation.value.phase);
      const record = await battlePlanLogic.upsertBattlePlanPhase(
        gate.matchId,
        column,
        validation.value.text,
        gate.accountId,
        database,
      );
      koaContext.status = 200;
      koaContext.body = { battlePlan: toBattlePlanView(record) };
    } catch (caughtError) {
      // why: never re-throw — an uncaught throw would surface as a bodyless 500. The
      // 500 envelope is locked (no leaked internals).
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // GET /api/match/:matchId/battle-plan — read the current document (auth +
  // participant). The read-side gate is symmetric to the write: a non-participant
  // gets 403 not_a_participant here too.
  router.get('/api/match/:matchId/battle-plan', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    const gate = await resolveParticipant(koaContext, database, deps, battlePlanLogic);
    if (gate.ok !== true) {
      koaContext.status = gate.status;
      koaContext.body = gate.body;
      return;
    }

    try {
      const record = await battlePlanLogic.readBattlePlan(gate.matchId, database);
      koaContext.status = 200;
      koaContext.body = {
        battlePlan: record === null ? null : toBattlePlanView(record),
      };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
