/**
 * Current-Match Loadout LAGN HTTP Route — Server Layer (WP-361)
 *
 * Registers two read-only, PUBLIC (guest-readable) endpoints on the Koa router
 * returned by the match-server framework's `Server({...})`:
 *
 *   * `GET /api/match/:matchId/lagn` — the current match's setup projected as a
 *     read-only Tier-1 LAGN (`@legendary-arena/lagn`), for the arena client's
 *     "View cards in Registry Viewer" link (WP-363) to hand to the viewer's
 *     `?lagn=` ingest (WP-362).
 *   * `GET /api/match/:matchId/result-lagn` — a COMPLETED match's result LAGN
 *     (WP-406), Hall-of-Legends material.
 *
 * Access: NO session gate and NO participant gate (D-24446). The setup LAGN is
 * non-secret game setup (scheme / mastermind / villains / heroes / supply) with
 * NO player identity, so it is readable by anyone who can address the match —
 * including a guest seat, which has no session bearer. This makes the in-match
 * "View cards" affordance work for every seat. Fail-closed: an unknown or
 * unprojectable match (`initial_state` null) both return `404
 * { error: 'match_not_found' }`, so the response never leaks match existence.
 *
 * Validation ownership: the pure mapper (`buildMatchLagn`) is construction-only;
 * this route calls `validate()` from `@legendary-arena/lagn` **exactly once**
 * before the `200` — a failure (a blob-shape regression, e.g. a corrupt
 * `numPlayers`) maps to `500 { error: 'lagn_projection_failed' }`.
 *
 * Shape mirrors the WP-406 result-lagn producer below (its guest-readable twin):
 * local structural `KoaRouter` / `KoaMatchLagnContext` interfaces,
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
 * D-24446 (public-read access change); WP-115 D-11504 (Cache-Control
 * first-statement lock); D-9905 (Auth closed set — this endpoint is `guest`).
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

import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * Caller-injected dependency bundle for `registerMatchLagnRoutes`. Since D-24446
 * both routes are PUBLIC reads (no session gate), so this bundle carries only the
 * startup `registry`, used to build the ext_id → display-name resolver once at
 * registration.
 */
export interface MatchLagnRouteDependencies {
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
  params: { matchId?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface — the two `GET`
 * registration sites below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaMatchLagnContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Register the two public current-match LAGN read routes on the supplied Koa
 * router. The router is mutated in place; the function returns `void`. Production
 * callers in `apps/server/src/server.mjs` pass the Koa router (`server.router`),
 * the long-lived `pg.Pool`, and the dependency bundle (the startup registry).
 * The optional 4th parameter is a test-only injection seam.
 *
 * @param router The framework Koa router (`server.router`).
 * @param database The long-lived `pg.Pool`.
 * @param deps The caller-injected registry bundle.
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
    // set on every response path, including the 500 below. Kept `no-store` to
    // match the result-lagn twin below; the loadout is public (D-24446) but a
    // live match's setup can still change (rare) so a stale cache is undesirable.
    koaContext.set('Cache-Control', 'no-store');

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
      // Gate — the match is projectable. Absent row OR null initial_state both
      // return the SAME 404 so the response never leaks whether the match exists.
      // No session or participant gate (D-24446): the setup LAGN is non-secret
      // game setup with no player identity, so any caller — including a guest
      // seat with no session bearer — may read it.
      const configuration = await matchLagnLogic.readMatchConfigurationForLagn(
        matchId,
        database,
      );
      if (configuration === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'match_not_found' };
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
