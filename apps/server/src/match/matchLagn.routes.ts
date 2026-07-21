/**
 * Current-Match Loadout LAGN HTTP Route — Server Layer (WP-361)
 *
 * Registers one authenticated, participant-gated read endpoint on the Koa
 * router returned by the match-server framework's `Server({...})`:
 *
 *   * `GET /api/match/:matchId/lagn` — the current match's setup projected as a
 *     read-only Tier-1 LAGN (`@legendary-arena/lagn`), for the arena client's
 *     "View loadout in Registry Viewer" link (WP-363) to hand to the viewer's
 *     `?lagn=` ingest (WP-362).
 *
 * Access chain: `requireAuthenticatedSession` (WP-112) → a participant gate
 * (the session `AccountId` must appear in `readSeatAccounts(matchId)`, WP-333).
 * Fail-closed: an unknown/unprojectable match and a non-participant caller both
 * reveal nothing about the loadout. The endpoint intentionally does NOT
 * distinguish a missing match row from an unprojectable one (`initial_state`
 * null) — both return `404 { error: 'match_not_found' }` so the response never
 * leaks match existence.
 *
 * Validation ownership: the pure mapper (`buildMatchLagn`) is construction-only;
 * this route calls `validate()` from `@legendary-arena/lagn` **exactly once**
 * before the `200` — a failure (a blob-shape regression, e.g. a corrupt
 * `numPlayers`) maps to `500 { error: 'lagn_projection_failed' }`.
 *
 * Mirrors the WP-332 `competition.routes.ts` authenticated-read pattern: local
 * structural `KoaRouter` / `KoaMatchLagnContext` interfaces, caller-injected
 * `requireAuthenticatedSession` / `verifier` / `accountResolver`,
 * `Cache-Control: no-store` as the first statement of every response, a uniform
 * `{ error: <code> }` envelope, and a `try/catch` that turns any uncaught throw
 * into a typed `500`. The startup `registry` is injected for name resolution.
 *
 * Layer-boundary contract: imports the pure `@legendary-arena/lagn` validator,
 * the `@legendary-arena/registry` `CardRegistry` type, and server-layer logic
 * only. No engine, game-framework, pre-planning, or UI / client package (the
 * server layer-boundary set — see `.claude/rules/architecture.md`). The `pg` driver is
 * reachable only through the supplied `DatabaseClient`.
 *
 * Authority: WP-361 §Scope + §Contract; EC-391; D-24153 (endpoint + carve-out);
 * WP-112 (`requireAuthenticatedSession`); WP-333 (`readSeatAccounts`); WP-115
 * D-11504 (Cache-Control first-statement lock); D-9905 (Auth closed set).
 */

import { validate } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import {
  readMatchConfigurationForLagn,
  readMatchGameover,
  readAccountPublicIdentities,
  buildMatchLagn,
  buildResultMatchLagn,
  buildResultPlayers,
  buildNameResolver,
  toLagnResult,
  DEFAULT_SCORING_PROFILE,
} from './matchLagn.logic.js';
import { readSeatAccounts } from './seatAccount.logic.js';

import type {
  AccountId,
  DatabaseClient,
} from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

/**
 * Closed-set re-statement of the WP-112 orchestrator's
 * `Result<AccountId, SessionValidationCode>` shape. Declared locally (mirrors
 * the WP-332 `competition.routes.ts` precedent) so this file does not depend on
 * another feature layer for a type the auth layer owns.
 */
export type SessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

export type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: SessionValidationCode };

/**
 * Caller-injected dependency bundle for `registerMatchLagnRoutes`.
 * `requireAuthenticatedSession` is the WP-112 orchestrator (or a test fake);
 * `verifier` + `accountResolver` are the broker-specific implementations passed
 * at request time (both `undefined` fail-closes to a 500 per WP-112). `registry`
 * is the startup CardRegistry, used to build the ext_id → display-name resolver
 * once at registration.
 */
export interface MatchLagnRouteDependencies {
  readonly requireAuthenticatedSession: (
    req: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly registry: CardRegistry;
}

/**
 * Test-only injection seam (mirrors WP-332's `CompetitionLogic`). Production
 * callers omit the 4th parameter and the handler resolves to the imported logic;
 * tests pass fakes returning canned results so no real database is touched.
 */
export interface MatchLagnLogic {
  readonly readMatchConfigurationForLagn: typeof readMatchConfigurationForLagn;
  readonly readSeatAccounts: typeof readSeatAccounts;
  readonly readMatchGameover: typeof readMatchGameover;
  readonly readAccountPublicIdentities: typeof readAccountPublicIdentities;
}

const PRODUCTION_MATCH_LAGN_LOGIC: MatchLagnLogic = {
  readMatchConfigurationForLagn,
  readSeatAccounts,
  readMatchGameover,
  readAccountPublicIdentities,
};

/**
 * Minimal structural shape of the Koa context surface this module touches.
 * Mirrors the WP-115 `leaderboard.routes.ts` precedent; `params.matchId` is the
 * `:matchId` path parameter set by `@koa/router`.
 */
interface KoaMatchLagnContext {
  readonly req: SessionTokenRequest;
  params: { matchId?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface — the single `GET`
 * registration site below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaMatchLagnContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `SessionValidationCode` to its locked HTTP status. Mirrors the WP-332
 * mapping: operator-facing faults (`session_verifier_not_configured`,
 * `lookup_failed`) return 500; every other code returns 401.
 *
 * @param code The WP-112 orchestrator's failure code.
 * @returns The HTTP status for that code.
 */
function statusForSessionValidationCode(code: SessionValidationCode): number {
  // why: 'unknown_account' returns 401 (NOT 403) per the account-existence-probe
  // defense — a 403 would confirm the account exists (mirrors WP-332).
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Register the current-match LAGN read route on the supplied Koa router. The
 * router is mutated in place; the function returns `void`. Production callers in
 * `apps/server/src/server.mjs` pass the Koa router (`server.router`), the
 * long-lived `pg.Pool`, and the dependency bundle (WP-112 session orchestrator +
 * verifier/accountResolver + the startup registry). The optional 4th parameter
 * is a test-only injection seam.
 *
 * @param router The framework Koa router (`server.router`).
 * @param database The long-lived `pg.Pool`.
 * @param deps The caller-injected auth + registry bundle.
 * @param matchLagnLogic Test-only logic seam (production omits it).
 */
export function registerMatchLagnRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: MatchLagnRouteDependencies,
  matchLagnLogic: MatchLagnLogic = PRODUCTION_MATCH_LAGN_LOGIC,
): void {
  // why: build the ext_id → display-name resolver ONCE at registration (the
  // registry is frozen for the process lifetime), not per request.
  const resolveName = buildNameResolver(deps.registry);

  router.get('/api/match/:matchId/lagn', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (WP-115 D-11504) so it is
    // set on every response path, including the 500 below. A per-match loadout
    // read is authenticated + personalized and never cacheable.
    koaContext.set('Cache-Control', 'no-store');

    // Gate 1 — authenticated session → AccountId.
    const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database,
    });
    if (sessionResult.ok !== true) {
      koaContext.status = statusForSessionValidationCode(sessionResult.code);
      koaContext.body = { error: sessionResult.code };
      return;
    }
    const accountId = sessionResult.value;

    const matchId = koaContext.params.matchId;
    if (typeof matchId !== 'string' || matchId === '') {
      // why: `@koa/router` always supplies a non-empty `:matchId` for this route,
      // so this is defensive — treat an absent id as an unknown match (fail
      // closed) rather than throwing.
      koaContext.status = 404;
      koaContext.body = { error: 'match_not_found' };
      return;
    }

    try {
      // Gate 2 — the match is projectable. Absent row OR null initial_state both
      // return the SAME 404 so the response never leaks whether the match exists.
      const configuration = await matchLagnLogic.readMatchConfigurationForLagn(
        matchId,
        database,
      );
      if (configuration === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'match_not_found' };
        return;
      }

      // Gate 3 — the caller is a participant (an authenticated seat of the match).
      const seats = await matchLagnLogic.readSeatAccounts(matchId, database);
      const isParticipant = seats.some((seat) => seat.accountId === accountId);
      if (!isParticipant) {
        koaContext.status = 403;
        koaContext.body = { error: 'not_a_participant' };
        return;
      }

      // Build (construction-only) then validate EXACTLY once before the 200.
      const lagn = buildMatchLagn(
        matchId,
        configuration.matchConfiguration,
        configuration.numPlayers,
        resolveName,
      );
      const validation = validate(lagn);
      if (validation.valid !== true) {
        // why: the stored composition should always project to a valid Tier-1
        // LAGN; a failure here is a blob-shape regression (e.g. a corrupt
        // numPlayers), never a client error.
        koaContext.status = 500;
        koaContext.body = { error: 'lagn_projection_failed' };
        return;
      }

      koaContext.status = 200;
      koaContext.body = { lagn };
    } catch (caughtError) {
      // why: never re-throw — the server has no error middleware beyond
      // the framework defaults, so an uncaught throw surfaces as a bodyless 500.
      // The caught value is discarded; the 500 envelope leaks no internals.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // why: the RESULT-LAGN producer (WP-406 / D-24216). A completed match's result
  // is public (Hall-of-Legends material), so this endpoint is GUEST-READABLE — no
  // session gate and no participant gate, unlike the private setup emitter above.
  // The privacy surface is which handles appear, decided in `buildResultPlayers`
  // (claimed handle only, never AccountId — D-24214), not by an auth gate.
  router.get('/api/match/:matchId/result-lagn', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (WP-115 D-11504) so it is set
    // on every response path, including the 500 below.
    koaContext.set('Cache-Control', 'no-store');

    const matchId = koaContext.params.matchId;
    if (typeof matchId !== 'string' || matchId === '') {
      // why: `@koa/router` always supplies a non-empty `:matchId`; this is
      // defensive — an absent id is an unknown match (fail closed).
      koaContext.status = 404;
      koaContext.body = { error: 'not_found' };
      return;
    }

    try {
      // Gate 1 — the match is projectable (row present + non-null initial_state).
      const configuration = await matchLagnLogic.readMatchConfigurationForLagn(
        matchId,
        database,
      );
      if (configuration === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'not_found' };
        return;
      }

      // Gate 2 — the completed-match gate (D-24169). A projectable match with no
      // `metadata.gameover` is still in progress; a result LAGN describes a
      // FINISHED match, so reject until gameover.
      const gameover = await matchLagnLogic.readMatchGameover(matchId, database);
      if (gameover === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'match_not_finished' };
        return;
      }

      // Roster projection — a domain-table read of the recorded seats, then a
      // batched public-identity resolve. Bots/guests have no seat row, so they
      // never appear (players.length <= player_count by construction).
      const seats = await matchLagnLogic.readSeatAccounts(matchId, database);
      const identities = await matchLagnLogic.readAccountPublicIdentities(
        seats.map((seat) => seat.accountId),
        database,
      );
      const players = buildResultPlayers(seats, identities);
      const result = toLagnResult(gameover);

      // Build (construction-only) then validate EXACTLY once before the 200.
      const lagn = buildResultMatchLagn(
        matchId,
        configuration.matchConfiguration,
        configuration.numPlayers,
        resolveName,
        players,
        result,
        DEFAULT_SCORING_PROFILE,
      );
      const validation = validate(lagn);
      if (validation.valid !== true) {
        // why: a completed match's stored composition + roster should always
        // project to a valid result LAGN; a failure here is a blob/roster-shape
        // regression, never a client error.
        koaContext.status = 500;
        koaContext.body = { error: 'lagn_projection_failed' };
        return;
      }

      koaContext.status = 200;
      koaContext.body = { lagn };
    } catch (caughtError) {
      // why: never re-throw — mirror the setup route's fail-closed 500.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
