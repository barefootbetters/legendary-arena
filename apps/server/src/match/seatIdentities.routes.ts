/**
 * Finished-Match Seat Identities HTTP Route — Server Layer (INFRA: endgame seat names)
 *
 * Registers one read-only, PUBLIC (guest-readable) endpoint on the Koa router
 * returned by the match-server framework's `Server({...})`:
 *
 *   * `GET /api/match/:matchId/seat-identities` — a COMPLETED match's per-seat
 *     display roster (`{ playerId, isBot, handle }` per seat), for the endgame
 *     report card's co-op VP recap to label seats as "Player N", "Player N (Bot)",
 *     or "Player N (@handle)" instead of a bare "Player N".
 *
 * Why this exists: the engine deliberately never knows account identity (a layer
 * boundary), so `gameOver.scores.players` carries only a `playerId`. The
 * competitive report card already shows named seats via the `seatIdentities`
 * projection the WP-593 submit response attaches — but that ride-along is present
 * ONLY for a scored match. An unscored / guest / local match falls through to the
 * co-op recap, which had no identity source and printed "Player 1 / Player 2".
 * This endpoint gives that recap the same server-derived roster.
 *
 * Access: NO session gate and NO participant gate. The roster exposed here —
 * display handles and the bot/guest flag for a FINISHED match — is the same
 * privacy surface the `GET /api/match/:matchId/result-lagn` twin already publishes
 * publicly (D-24169 finished-match gate, D-24214 claimed-handle-only, D-24446
 * public-read); live-match seat display names are likewise already public via the
 * lobby list. So this adds no new exposure. `handle` is `null` for a bot, a guest,
 * and an account with no display handle — every case the client renders as a plain
 * "Player N".
 *
 * Completed-match gate (D-24169): a projectable match with no `metadata.gameover`
 * is still in progress; this is an endgame-only surface, so it 404s until the match
 * finishes. Fail-closed: an unknown or unprojectable match (`initial_state` null)
 * returns `404 { error: 'match_not_found' }`, so the response never leaks match
 * existence.
 *
 * Blob reads: `readMatchConfigurationForLagn` reads `initial_state` for the seat
 * count (`numPlayers`, the D-24153 carve-out read) and `readMatchGameover` reads
 * `metadata.gameover` (the D-24169 carve-out read). `readSeatIdentities` then reads
 * the `legendary.*` DOMAIN tables (seat→account map, bot-ally tags, display
 * handles) — never `state`/`log`, never written back.
 *
 * Layer-boundary contract: imports server-layer logic only. No engine,
 * game-framework, pre-planning, or UI / client package (the server layer-boundary
 * set — see `.claude/rules/architecture.md`). The `pg` driver is reachable only
 * through the supplied `DatabaseClient`. Mirrors `matchLagn.routes.ts`:
 * `Cache-Control: no-store` as the first statement of every response, a uniform
 * `{ error: <code> }` envelope, a `try/catch` that turns any uncaught throw into a
 * typed `500`, and a test-only logic injection seam.
 *
 * Authority: WP-593 / D-24402 (the `seatIdentities` projection this reuses);
 * WP-361 / matchLagn.routes.ts (route shape precedent); D-24153 (numPlayers read);
 * D-24169 (finished-match gameover read + gate); D-24446 (public-read access);
 * WP-115 / D-11504 (Cache-Control first-statement lock); D-9905 (Auth closed set —
 * this endpoint is `guest`).
 */

import {
  readMatchConfigurationForLagn,
  readMatchGameover,
} from './matchLagn.logic.js';
import { readSeatIdentities } from './seatAccount.logic.js';

import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * Test-only injection seam (mirrors `matchLagn.routes.ts`'s `MatchLagnLogic`).
 * Production callers omit the 3rd parameter and the handler resolves to the
 * imported logic; tests pass fakes returning canned results so no real database
 * is touched.
 */
export interface SeatIdentitiesLogic {
  readonly readMatchConfigurationForLagn: typeof readMatchConfigurationForLagn;
  readonly readMatchGameover: typeof readMatchGameover;
  readonly readSeatIdentities: typeof readSeatIdentities;
}

const PRODUCTION_SEAT_IDENTITIES_LOGIC: SeatIdentitiesLogic = {
  readMatchConfigurationForLagn,
  readMatchGameover,
  readSeatIdentities,
};

/**
 * Minimal structural shape of the Koa context surface this module touches.
 * Mirrors `matchLagn.routes.ts`'s `KoaMatchLagnContext`; `params.matchId` is the
 * `:matchId` path parameter set by `@koa/router`.
 */
interface KoaSeatIdentitiesContext {
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
    handler: (koaContext: KoaSeatIdentitiesContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Register the public finished-match seat-identities read route on the supplied
 * Koa router. The router is mutated in place; the function returns `void`.
 * Production callers in `apps/server/src/server.mjs` pass the Koa router
 * (`server.router`) and the long-lived `pg.Pool`. The optional 3rd parameter is a
 * test-only injection seam.
 *
 * @param router The framework Koa router (`server.router`).
 * @param database The long-lived `pg.Pool`.
 * @param seatIdentitiesLogic Test-only logic seam (production omits it).
 */
export function registerSeatIdentitiesRoute(
  router: KoaRouter,
  database: DatabaseClient,
  seatIdentitiesLogic: SeatIdentitiesLogic = PRODUCTION_SEAT_IDENTITIES_LOGIC,
): void {
  router.get('/api/match/:matchId/seat-identities', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (WP-115 / D-11504) so it is
    // set on every response path, including the 500 below. `no-store` matches the
    // matchLagn twins — a finished match's roster is stable, but the surface is a
    // tiny endgame read and never worth caching.
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
      // Gate 1 — the match is projectable (row present + non-null initial_state).
      // We need its `numPlayers` (the seat count) to build a full 0..N-1 roster,
      // and an absent row OR null initial_state both return the SAME 404 so the
      // response never leaks whether the match exists.
      const configuration =
        await seatIdentitiesLogic.readMatchConfigurationForLagn(
          matchId,
          database,
        );
      if (configuration === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'match_not_found' };
        return;
      }

      // Gate 2 — the completed-match gate (D-24169). Seat identities are an
      // endgame report-card surface; a projectable match with no
      // `metadata.gameover` is still in progress, so reject until it finishes
      // (mirrors the result-lagn twin's finished-match privacy posture).
      const gameover = await seatIdentitiesLogic.readMatchGameover(
        matchId,
        database,
      );
      if (gameover === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'match_not_finished' };
        return;
      }

      const seatIdentities = await seatIdentitiesLogic.readSeatIdentities(
        matchId,
        configuration.numPlayers,
        database,
      );

      koaContext.status = 200;
      koaContext.body = { seatIdentities };
    } catch (caughtError) {
      // why: never re-throw — the server has no error middleware beyond the
      // framework defaults, so an uncaught throw surfaces as a bodyless 500. The
      // caught value is discarded; the 500 envelope leaks no internals.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
