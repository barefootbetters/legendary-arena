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
  guestEditorId,
  phaseColumnFor,
  validateUpdateBattlePlanInput,
  verifyGuestSeatCredential,
} from './battlePlan.logic.js';
import { toBattlePlanView } from './battlePlan.logic.js';
import {
  readBattlePlan,
  upsertBattlePlanPhase,
} from './battlePlan.persistence.js';
import { readSeatAccounts } from './seatAccount.logic.js';

import type { GuestSeatProof } from './battlePlan.types.js';
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
  /**
   * WP-638 / D-24451 — the guest-seat authorizer. Returns the match's seat-id →
   * boardgame.io-credential map (from the bgio match metadata), or `null` when the
   * match / metadata is absent. Injected in `server.mjs` as a closure over
   * `server.db.fetch(matchId, { metadata: true })` (the bot-ally
   * `readBotSeatCredentials` framework metadata-surface read — no persistence
   * carve-out). Optional: when absent, the guest branch cannot authorize and the
   * gate falls back to the session error (fail-closed), so the account path is
   * unaffected. This dep lands on the route interface (not `battlePlan.types.ts`) —
   * it is a normal route-file wiring seam, not a durable data contract.
   */
  readonly fetchMatchSeatCredentials?: (
    matchId: string,
  ) => Promise<Record<string, string> | null>;
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
 * The resolved gate result the handlers act on: on success, the match id plus the
 * `editorId` to stamp into `updated_by_ext_id` (the account `ext_id` on the account
 * path, or `guest:<playerId>` on the guest path); on failure, the `{ status, body }`
 * the handler returns verbatim.
 */
type ResolveParticipantResult =
  | { ok: true; matchId: string; editorId: string }
  | { ok: false; status: number; body: { error: string } };

/**
 * Collapse a Node header value (`string | string[] | undefined`) to a single
 * non-empty string, or `null`. Node lowercases header names, so callers read the
 * lowercase key. A repeated header (array) uses its first value.
 *
 * @param rawHeaderValue The raw header value off `request.headers[...]`.
 * @returns The single non-empty string value, or null when absent/blank.
 */
function singleHeaderValue(
  rawHeaderValue: string | readonly string[] | undefined,
): string | null {
  let value: unknown = rawHeaderValue;
  if (Array.isArray(rawHeaderValue)) {
    value = rawHeaderValue[0];
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}

/**
 * Parse the guest seat proof from the request HEADERS (`X-Guest-Player-Id` +
 * `X-Guest-Credentials`), or null when either is absent/blank (i.e. not a guest
 * request). Reads headers only — never the URL/query (the credential is sensitive).
 *
 * @param request The request whose headers carry the guest proof.
 * @returns The `GuestSeatProof`, or null when the guest headers are not both present.
 */
function readGuestSeatProof(request: SessionTokenRequest): GuestSeatProof | null {
  const playerId = singleHeaderValue(request.headers['x-guest-player-id']);
  const credentials = singleHeaderValue(request.headers['x-guest-credentials']);
  if (playerId === null || credentials === null) {
    return null;
  }
  return { playerId, credentials };
}

/**
 * Guest FALLBACK authorization — WP-638 / D-24451. Reached ONLY after a session has
 * been ruled out (no valid session). Reads the `X-Guest-*` headers, fetches the
 * match's seat credentials via the injected `fetchMatchSeatCredentials`, and verifies
 * the supplied credential in constant time. Returns the authorized gate on success, a
 * `403 not_a_participant` rejection when a guest proof is present but does not verify,
 * or `null` when the guest path does not apply (no guest headers, or no credential
 * fetcher wired) so the caller falls back to the session error.
 *
 * why (no seat-existence oracle): an absent seat-credential map (unknown match) and a
 * non-matching credential BOTH return the same `403 not_a_participant` — the response
 * never reveals whether the seat exists.
 *
 * @param koaContext The request context.
 * @param deps The auth dependency bundle (supplies `fetchMatchSeatCredentials`).
 * @returns The authorized gate, a 403 rejection, or null (guest path inapplicable).
 */
async function resolveGuestSeat(
  koaContext: KoaBattlePlanContext,
  deps: BattlePlanRouteDependencies,
): Promise<ResolveParticipantResult | null> {
  const proof = readGuestSeatProof(koaContext.req);
  if (proof === null) {
    return null;
  }

  const matchId = koaContext.params.matchId;
  if (matchId === undefined || matchId === '') {
    return { ok: false, status: 400, body: { error: 'invalid_request' } };
  }

  if (deps.fetchMatchSeatCredentials === undefined) {
    // why: the guest authorizer is not wired — fail CLOSED by falling back to the
    // session error rather than authorizing. Production always injects it.
    return null;
  }

  const seatCredentials = await deps.fetchMatchSeatCredentials(matchId);
  if (
    seatCredentials === null ||
    !verifyGuestSeatCredential(seatCredentials, proof.playerId, proof.credentials)
  ) {
    // why: unknown match/metadata and a wrong credential are the SAME 403 — no
    // seat-existence oracle. Identical code to an account non-participant.
    return { ok: false, status: 403, body: { error: 'not_a_participant' } };
  }

  return { ok: true, matchId, editorId: guestEditorId(proof.playerId) };
}

/**
 * Resolve the caller to a seat, by EITHER of two paths, and return the `editorId` to
 * stamp: (1) an authenticated account holding a seat in the match (the WP-635 path,
 * unchanged), OR (2) a guest who proves their seat with a valid boardgame.io
 * credential (WP-638 / D-24451). On failure, returns the `{ status, body }` the
 * handler returns verbatim: `401` / `500` for a failed session with no verifiable
 * guest proof (the pass-through session code), `400 invalid_request` for a missing
 * matchId, `403 not_a_participant` for an authenticated non-participant OR an
 * unverifiable guest.
 *
 * why (guest is a FALLBACK; a valid session always wins): `requireAuthenticatedSession`
 * runs first. A VALID session takes the account path and its result is returned
 * without ever reading the guest headers — even when the account is NOT a participant
 * (it gets the account-path 403). This is the anti-spoof guarantee: an account holder
 * cannot attach `X-Guest-*` headers to author a guest seat, because a valid session
 * never consults them. Only when the session is absent/invalid does the gate consult
 * the guest proof.
 *
 * why (participant gate): the Battle Plan is a seated-TEAM artifact. An account holds
 * a seat via `legendary.match_seat_accounts` (D-24120); a guest is rowless there and
 * proves the same seat via its bgio credential instead — WP-638 opens this one
 * non-gameplay surface to verified guests without granting them a seat row (they stay
 * Casual). The same gate applies to BOTH routes (read and write are symmetric).
 *
 * @param koaContext The request context.
 * @param database The caller-injected `pg` pool.
 * @param deps The auth dependency bundle.
 * @param logic The injected logic seam (for `readSeatAccounts`).
 * @returns `{ ok: true, matchId, editorId }`, or `{ ok: false, status, body }`.
 */
async function resolveParticipant(
  koaContext: KoaBattlePlanContext,
  database: DatabaseClient,
  deps: BattlePlanRouteDependencies,
  logic: BattlePlanRouteLogic,
): Promise<ResolveParticipantResult> {
  const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database,
  });

  if (sessionResult.ok === true) {
    // why: a VALID session ALWAYS takes the account path and never reads the guest
    // headers — the anti-spoof guarantee (an account holder cannot spoof a guest
    // seat). A non-participant account falls through to the account-path 403 below.
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

    return { ok: true, matchId, editorId: sessionResult.value };
  }

  const guestGate = await resolveGuestSeat(koaContext, deps);
  if (guestGate !== null) {
    return guestGate;
  }

  // why: no valid session AND no verifiable guest proof → the pass-through session
  // code (401 / 500), exactly the WP-635 behaviour for a non-guest caller.
  return {
    ok: false,
    status: statusForSessionValidationCode(sessionResult.code),
    body: { error: sessionResult.code },
  };
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
        gate.editorId,
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
