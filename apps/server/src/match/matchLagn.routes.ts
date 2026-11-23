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
 *     (WP-406), Hall-of-Legends material. When `lagn.result` is omitted, the
 *     envelope also carries `resultOmittedReason` (`'tie'`, `'ended-early'` or
 *     `'unknown'`) beside `lagn` (WP-812 / D-24720).
 *   * `GET /api/match/:matchId/replay-lagn` — a COMPLETED, non-operator match as
 *     a re-executable LAGN 1.7.0 document (WP-810): the result-LAGN content PLUS
 *     a `replay.execution` block the serving build re-executed from the seed and
 *     verified against a fresh faithful reduction before emit. Guest-readable,
 *     rate-limited 10/min per client (`429`) and bounded by a 4000 moves/min
 *     process budget (`503`). Refusals: `404 replay_not_found`, `422
 *     operator_match` / `not_reexecutable`. Unlike the two setup/result routes,
 *     this handler reaches boardgame.io's reducer and the engine's version
 *     exports — through the pure `replayLagn.logic.ts` helpers (`buildVerified
 *     ReplayExecution`), never directly — which is the SERVER-only replay edge
 *     the D-24716 carve-out authorizes.
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
  toResultOmittedReason,
  toBattlePlanBlock,
  toResultScore,
  DEFAULT_SCORING_PROFILE,
} from './matchLagn.logic.js';
import type { MatchLagnComposition } from './matchLagn.logic.js';
import { readBattlePlan } from './battlePlan.persistence.js';
import { readSeatAccounts } from './seatAccount.logic.js';
import { buildVerifiedReplayExecution } from './replayLagn.logic.js';
import { readArtifactSeed } from './replayLagn.logic.js';
import { createTokenBucketRateLimiter, resolveRateLimitKey } from './tokenBucketRateLimiter.mjs';

import { findCompetitiveScore } from '../competition/competition.logic.js';
import { readReplayHashByMatchId, readReplayArtifactByHash } from '../replay/matchReplay.logic.js';
import { getVersionInfo } from '../version.mjs';

import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * Caller-injected dependency bundle for `registerMatchLagnRoutes`. Since D-24446
 * both routes are PUBLIC reads (no session gate), so this bundle carries only the
 * startup `registry`, used to build the ext_id → display-name resolver once at
 * registration.
 */
export interface MatchLagnRouteDependencies {
  readonly registry: CardRegistry;
  /**
   * Optional injected clock for the replay-LAGN route's two route-local token
   * buckets (the per-client limiter and the move-weighted process budget).
   * Production omits it — the field defaults to `Date.now`, so `server.mjs` is
   * unchanged — and tests pass a constant to make the limits deterministic.
   */
  readonly now?: () => number;
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
  readonly readBattlePlan: typeof readBattlePlan;
  readonly readReplayHashByMatchId: typeof readReplayHashByMatchId;
  readonly readReplayArtifactByHash: typeof readReplayArtifactByHash;
  readonly buildVerifiedReplayExecution: typeof buildVerifiedReplayExecution;
  readonly findCompetitiveScore: typeof findCompetitiveScore;
  /** The serving build's short git sha (or `'unknown'`), for `engine_build`. */
  readonly getBuildId: () => string;
}

const PRODUCTION_MATCH_LAGN_LOGIC: MatchLagnLogic = {
  readMatchConfigurationForLagn,
  readSeatAccounts,
  readMatchGameover,
  readAccountPublicIdentities,
  readBattlePlan,
  readReplayHashByMatchId,
  readReplayArtifactByHash,
  buildVerifiedReplayExecution,
  findCompetitiveScore,
  // why: the VERIFYING (serving) build's sha — both sides of the hash check run
  // on this build, so the emitted block is faithful to it (D-24716 §3).
  getBuildId: () => getVersionInfo().gitSha,
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

  // why: the replay-LAGN route is guest and CPU-bound (two synchronous
  // reductions per request), so it carries two route-local token buckets with an
  // injected clock (`now` defaults to `Date.now`, so production needs no wiring).
  // Per-client 10/min caps one caller; the move-weighted process budget is the
  // HARD bound, because keys rotate under carrier NAT and are unverified
  // (D-24635 §3 + follow-up). The budget is spent in MOVES, not requests, so it
  // bounds CPU, not count (D-24716 §5).
  const now = deps.now ?? (() => Date.now());
  const rateLimiter = createTokenBucketRateLimiter({ capacity: 10, windowMs: 60_000, now });
  const exportBudget = createTokenBucketRateLimiter({ capacity: 4000, windowMs: 60_000, now });

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
      // Gate — the match is projectable (live row, or its replay artifact once
      // reaped — D-24719). Unknown match OR null initial_state both
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
  // (claimed handle only, never AccountId — D-24214), not by an auth gate. A
  // non-decisive match's body also names why `result` is omitted (WP-812).
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
      // Gate 1 — the match is projectable: its live row (non-null initial_state)
      // or, once reaped, its durable replay artifact (D-24719).
      const configuration = await matchLagnLogic.readMatchConfigurationForLagn(
        matchId,
        database,
      );
      if (configuration === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'not_found' };
        return;
      }

      // why: D-24717 — an operator match (WP-802 / D-24689) is an admin test
      // board, never a real result, so it must not reach the public Legends board
      // as one. Refused with the SAME 404 as an unknown match, so the response is
      // no oracle for which matches are operator matches. The flag is read from
      // `matchConfiguration` inside the D-24153 carve-out (the D-24658 finalBlow
      // precedent). The setup route above stays open: the in-match Battle Brief
      // and View loadout read it, and the setup carries no player identity.
      if (configuration.matchConfiguration.isDebugMatch === true) {
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
      const resultOmittedReason = toResultOmittedReason(gameover);

      // Battle Plan block — a DOMAIN-table read of `legendary.battle_plan`
      // (WP-635), NOT a bgio blob read, so no new persistence carve-out. Omitted
      // when the match has no plan row or all three phases are empty.
      const battlePlanRecord = await matchLagnLogic.readBattlePlan(matchId, database);
      const battlePlan = toBattlePlanBlock(battlePlanRecord);

      // Report card — the match-level score. The `replay_hash` mapping is the
      // blessed D-24187 `bgio.replay_artifacts` surface (no `state`/`log` read),
      // then `findCompetitiveScore` reads the `legendary.competitive_scores`
      // DOMAIN table (LIMIT 1 — the score is match-level, so ANY one row serves;
      // it is READ, never written). Omitted for an unscored/casual match, which
      // has no artifact and/or no score row (the honest-partial posture).
      const replayHash = await matchLagnLogic.readReplayHashByMatchId(
        matchId,
        database,
      );
      const scoreRecord =
        replayHash === null
          ? null
          : await matchLagnLogic.findCompetitiveScore(replayHash, database);
      const score = scoreRecord === null ? undefined : toResultScore(scoreRecord);

      // Build (construction-only) then validate EXACTLY once before the 200.
      const lagn = buildResultMatchLagn(
        matchId,
        configuration.matchConfiguration,
        configuration.numPlayers,
        resolveName,
        players,
        result,
        DEFAULT_SCORING_PROFILE,
        battlePlan,
        score,
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
      // why: `resultOmittedReason` rides beside `lagn`, never inside it, and only
      // when `result` is omitted (WP-812 / D-24720). LAGN has no tie outcome, so
      // the envelope is where the Hall of Legends learns a tie from an unknown
      // verdict; a decisive match's body stays exactly `{ lagn }`.
      if (resultOmittedReason === undefined) {
        koaContext.body = { lagn };
      } else {
        koaContext.body = { lagn, resultOmittedReason };
      }
    } catch (caughtError) {
      // why: never re-throw — mirror the setup route's fail-closed 500.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // why: the REPLAY-LAGN producer (WP-810 / D-24716). A completed, non-operator
  // match becomes a re-executable LAGN 1.7.0 document: the result-LAGN content
  // from the durable replay artifact PLUS a `replay.execution` block the serving
  // build re-executed from the seed and verified against a FRESH faithful
  // reduction (`reduceMatchToFinalState`) before emit. Guest-readable (a finished
  // match is public), rate-limited per client and bounded by the process budget.
  // why: durable source — the WP-327 reaper deletes the live row about an hour
  // after gameover, so the producer reads the artifact copy, which persists; an
  // artifact exists only for a finished match (D-24716, D-24719).
  router.get('/api/match/:matchId/replay-lagn', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (WP-115 D-11504) so it is
    // set on every response path, including the limiter 429 and the catch 500.
    koaContext.set('Cache-Control', 'no-store');

    // why: per-client limiter FIRST, before any read or the matchId check — the
    // limiter has no refund, so spending the process budget first would let an
    // over-limit client drain the global bound (D-24716 §5).
    const { key } = resolveRateLimitKey(koaContext);
    if (rateLimiter.consume(key, 1) === false) {
      koaContext.status = 429;
      koaContext.body = { error: 'rate_limited' };
      return;
    }

    const matchId = koaContext.params.matchId;
    if (typeof matchId !== 'string' || matchId === '') {
      // why: `@koa/router` always supplies a non-empty `:matchId`; defensive —
      // an absent id is an unknown match (fail closed).
      koaContext.status = 404;
      koaContext.body = { error: 'not_found' };
      return;
    }

    try {
      // Step 1 — resolve the durable artifact. A finished match has exactly one
      // artifact (keyed by replay hash); an unknown, unfinished, or not-yet
      // -captured match (the harvester runs about every 5 min) has none.
      const replayHash = await matchLagnLogic.readReplayHashByMatchId(matchId, database);
      if (replayHash === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'replay_not_found' };
        return;
      }
      const artifact = await matchLagnLogic.readReplayArtifactByHash(replayHash, database);
      if (artifact === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'replay_not_found' };
        return;
      }

      // why: spend the process budget AFTER the artifact read, so cheap 404s
      // never drain it; the cost is the move count (at least 1), since each move
      // is two reductions of synchronous CPU (D-24716 §5).
      const moveCount = countMakeMoveEntries(artifact.log);
      if (exportBudget.consume('process', moveCount) === false) {
        koaContext.status = 503;
        koaContext.body = { error: 'at_capacity' };
        return;
      }

      // Step 2 — shape-check the composition + seat count + seed BEFORE any
      // build, so a malformed artifact is a 422, never a 500 at `validate()` or a
      // TypeError. This runs before the verify seam, so a misshaped composition
      // never reaches re-execution.
      const projection = toReexecutableComposition(artifact.initialState);
      if (projection === null) {
        koaContext.status = 422;
        koaContext.body = { error: 'not_reexecutable' };
        return;
      }

      // Step 3 — the Tier-1 base. Its `.setup` is the setup that gets verified
      // (re-executed from) and emitted.
      const base = buildMatchLagn(
        matchId,
        projection.composition,
        projection.numPlayers,
        resolveName,
      );

      // Step 4 — verify-before-emit. The seam re-executes from the seed and the
      // emitted setup, and requires hash-equality with a fresh reduction; a
      // failure is a typed 422 (`operator_match` or `not_reexecutable`).
      const verified = matchLagnLogic.buildVerifiedReplayExecution(
        artifact,
        base.setup,
        projection.numPlayers,
        matchLagnLogic.getBuildId(),
      );
      if (verified.isVerified === false) {
        koaContext.status = 422;
        koaContext.body = { error: verified.reason };
        return;
      }

      // Step 5 — the same domain reads `/result-lagn` makes, reusing the step-1
      // replay hash (the artifact exists, so the score read is unconditional).
      const seats = await matchLagnLogic.readSeatAccounts(matchId, database);
      const identities = await matchLagnLogic.readAccountPublicIdentities(
        seats.map((seat) => seat.accountId),
        database,
      );
      const players = buildResultPlayers(seats, identities);
      const battlePlanRecord = await matchLagnLogic.readBattlePlan(matchId, database);
      const battlePlan = toBattlePlanBlock(battlePlanRecord);
      const scoreRecord = await matchLagnLogic.findCompetitiveScore(replayHash, database);
      const score = scoreRecord === null ? undefined : toResultScore(scoreRecord);

      // Step 6 — build the result document from the re-executed verdict, then
      // attach the verified execution block.
      const lagn = buildResultMatchLagn(
        matchId,
        projection.composition,
        projection.numPlayers,
        resolveName,
        players,
        toLagnResult((verified.gameover ?? null) as Parameters<typeof toLagnResult>[0]),
        DEFAULT_SCORING_PROFILE,
        battlePlan,
        score,
      );
      lagn.replay = { execution: verified.execution };

      // Step 7 — validate EXACTLY once before the 200.
      const validation = validate(lagn);
      if (validation.valid !== true) {
        // why: a verified, well-formed match should always project to a valid
        // 1.7.0 document; a failure here is a projection regression (the writer
        // flip missing would reject `replay.execution`), never a client error.
        koaContext.status = 500;
        koaContext.body = { error: 'lagn_projection_failed' };
        return;
      }

      koaContext.status = 200;
      koaContext.body = { lagn };
    } catch (caughtError) {
      // why: never re-throw — mirror the sibling routes' fail-closed 500.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}

/**
 * Count the player `MAKE_MOVE` entries in a persisted log — the move-weighted
 * cost the process export budget spends, floored at 1.
 *
 * why: the budget bounds CPU (two reductions per move), so a long match costs
 * more than a short one; the floor keeps a (degenerate) zero-move artifact from
 * being free. Non-`MAKE_MOVE` entries (framework events) are not re-executed.
 *
 * @param log The persisted ordered log entries (already-parsed jsonb).
 * @returns The `MAKE_MOVE` count, at least 1.
 */
function countMakeMoveEntries(log: readonly unknown[]): number {
  let count = 0;
  for (const entry of log) {
    if (entry === null || typeof entry !== 'object' || !('action' in entry)) {
      continue;
    }
    const action = (entry as { action?: unknown }).action;
    if (
      action !== null &&
      typeof action === 'object' &&
      (action as { type?: unknown }).type === 'MAKE_MOVE'
    ) {
      count += 1;
    }
  }
  return count < 1 ? 1 : count;
}

/** The composition + seat count a re-executable artifact must carry. */
interface ReexecutableComposition {
  readonly composition: MatchLagnComposition;
  readonly numPlayers: number;
}

/**
 * Shape-check a persisted initial state and project its composition + seat
 * count, or `null` when any field is malformed.
 *
 * why: runs before the verify seam so a malformed composition is a `422
 * not_reexecutable`, never a `500` from a later `validate()` or a TypeError on a
 * null composition. Checks all nine composition fields, the optional Final Blow
 * flag, the seat count range, and a non-empty seed.
 *
 * @param initialState The persisted initial state (already-parsed jsonb).
 * @returns The composition + seat count, or `null` when not re-executable.
 */
function toReexecutableComposition(initialState: unknown): ReexecutableComposition | null {
  if (initialState === null || typeof initialState !== 'object') {
    return null;
  }
  const blob = initialState as { G?: { matchConfiguration?: unknown }; ctx?: { numPlayers?: unknown } };
  const composition = blob.G?.matchConfiguration;
  if (composition === null || typeof composition !== 'object') {
    return null;
  }
  const config = composition as Record<string, unknown>;
  if (!isNonEmptyString(config.schemeId) || !isNonEmptyString(config.mastermindId)) {
    return null;
  }
  if (
    !isNonEmptyStringArray(config.villainGroupIds) ||
    !isNonEmptyStringArray(config.henchmanGroupIds) ||
    !isNonEmptyStringArray(config.heroDeckIds)
  ) {
    return null;
  }
  if (
    !isNonNegativeInteger(config.bystandersCount) ||
    !isNonNegativeInteger(config.woundsCount) ||
    !isNonNegativeInteger(config.officersCount) ||
    !isNonNegativeInteger(config.sidekicksCount)
  ) {
    return null;
  }
  if (config.finalBlow !== undefined && typeof config.finalBlow !== 'boolean') {
    return null;
  }
  const numPlayers = blob.ctx?.numPlayers;
  if (!Number.isInteger(numPlayers) || (numPlayers as number) < 1 || (numPlayers as number) > 5) {
    return null;
  }
  if (readArtifactSeed(initialState) === null) {
    return null;
  }
  return { composition: composition as MatchLagnComposition, numPlayers: numPlayers as number };
}

/**
 * Whether a value is a non-empty string.
 *
 * @param value The candidate value.
 * @returns True when the value is a string of length ≥ 1.
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value !== '';
}

/**
 * Whether a value is an array of non-empty strings with at least one entry.
 *
 * @param value The candidate value.
 * @returns True when every entry is a non-empty string and the array is non-empty.
 */
function isNonEmptyStringArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  for (const entry of value) {
    if (!isNonEmptyString(entry)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether a value is an integer ≥ 0.
 *
 * @param value The candidate value.
 * @returns True when the value is a non-negative integer.
 */
function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}
