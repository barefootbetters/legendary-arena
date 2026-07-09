/**
 * Competitive Score Submission HTTP Route — Server Layer (WP-332)
 *
 * Registers two authenticated endpoints on the existing Koa router
 * returned by boardgame.io's `Server({...})` instance:
 *
 *   * `POST /api/competition/scores` — submit a competitive score for a
 *     finished match the caller played, identified by `matchId` (the
 *     server resolves + captures + verifies the replay; WP-338 / WP-5a).
 *   * `GET /api/me/scores` — the authenticated player's submitted
 *     competitive scores (the "my scores" read; WP-338 / WP-5a).
 *
 * This is the write-side mirror of WP-115 (`leaderboard.routes.ts`,
 * which wired the read library to GET routes). It wires WP-053's
 * `submitCompetitiveScore` library — shipped but route-less until now
 * — via `submitCompetitiveScoreForRequest`, which injects the real
 * bound PAR gate (the inert `submitCompetitiveScore` wrapper
 * fail-closes every submission and MUST NOT be called here).
 *
 * Mirrors the WP-104 `ownerProfile.routes.ts` authenticated-write
 * pattern: local structural `KoaRouter` / `KoaCompetitionContext`
 * interfaces (no direct `@koa/router` import — the router type reaches
 * us structurally), caller-injected `requireAuthenticatedSession` /
 * `verifier` / `accountResolver`, `Cache-Control: no-store` set as the
 * first statement of every response, a uniform `{ error: <code> }`
 * envelope, and a `try/catch` that turns any uncaught throw into a
 * typed 500.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`,
 * `@legendary-arena/vue-sfc-loader`, or any UI / client /
 * replay-producer package. The `pg` driver is reachable only through
 * the supplied `DatabaseClient` parameter.
 *
 * Authority: WP-332 §Scope + §Contract + §Locked contract values;
 * EC-362; WP-053 (submission library); WP-107 (`requireUnsuspendedAccount`);
 * WP-112 (`requireAuthenticatedSession`); WP-115 D-11504 (Cache-Control
 * first-statement lock); D-9905 (Auth closed set); reserves D-24118.
 */


import type {
  CompetitiveSubmissionProductionDependencies,
  ParGateHit,
} from './competition.logic.js';
import {
  submitCompetitiveScoreByMatchIdForRequest,
  listPlayerCompetitiveScores,
} from './competition.logic.js';

import { findPlayerByAccountId } from '../identity/identity.logic.js';

import { requireUnsuspendedAccount as requireUnsuspendedAccountDefault } from '../auth/requireUnsuspendedAccount.js';

import type { SubmissionRejectionReason } from './competition.types.js';
import type {
  AccountId,
  DatabaseClient,
  PlayerAccount,
} from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { RequireUnsuspendedAccountResult } from '../auth/requireUnsuspendedAccount.js';

/**
 * Closed-set re-statement of the WP-112 orchestrator's
 * `Result<AccountId, SessionValidationCode>` shape. Declared locally
 * (mirrors the WP-104 `ownerProfile.routes.ts` precedent) so this file
 * does not depend on the profile layer for a type the auth layer owns.
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
 * Caller-injected dependency bundle for `registerCompetitionRoutes`.
 * `requireAuthenticatedSession` is the WP-112 orchestrator (or a test
 * fake); `verifier` + `accountResolver` are the broker-specific
 * implementations passed through at request time (both `undefined`
 * fail-closes to a 500 per the WP-112 posture).
 * `requireUnsuspendedAccount` is the WP-107 guard.
 * `checkParPublished` is the bound PAR gate forwarded to
 * `submitCompetitiveScoreForRequest`. WP-336 dropped the `registry`
 * dependency — the faithful reducer needs no `CardRegistryReader`.
 */
export interface CompetitionRouteDependencies {
  readonly requireAuthenticatedSession: (
    req: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly requireUnsuspendedAccount: (
    database: DatabaseClient,
    accountId: AccountId,
  ) => Promise<RequireUnsuspendedAccountResult>;
  readonly checkParPublished: (scenarioKey: string) => ParGateHit | null;
}

/**
 * Test-only injection seam (mirrors WP-115's `LeaderboardLogic`).
 * Production callers omit the 4th parameter and the handler resolves
 * to the imported competition-logic functions; tests pass fakes whose
 * methods return canned results, so no real database is touched.
 */
export interface CompetitionLogic {
  readonly submitCompetitiveScoreByMatchIdForRequest: typeof submitCompetitiveScoreByMatchIdForRequest;
  readonly listPlayerCompetitiveScores: typeof listPlayerCompetitiveScores;
  readonly findPlayerByAccountId: typeof findPlayerByAccountId;
}

const PRODUCTION_COMPETITION_LOGIC: CompetitionLogic = {
  submitCompetitiveScoreByMatchIdForRequest,
  listPlayerCompetitiveScores,
  findPlayerByAccountId,
};

/**
 * Minimal structural shape of the Koa context surface this module
 * touches. Mirrors the WP-104 `KoaOwnerProfileContext` precedent;
 * `request.body` carries the parsed JSON body (koa-bodyparser reaches
 * us as a transitive of `boardgame.io/server`).
 */
interface KoaCompetitionContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface this module
 * touches — the single `POST` registration site below.
 */
interface KoaRouter {
  post(
    path: string,
    handler: (koaContext: KoaCompetitionContext) => Promise<void> | void,
  ): unknown;
  get(
    path: string,
    handler: (koaContext: KoaCompetitionContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `SessionValidationCode` to its locked HTTP status. Mirrors the
 * WP-104 mapping: operator-facing faults (`session_verifier_not_configured`,
 * `lookup_failed`) return 500; every other code returns 401.
 */
// why: 'unknown_account' returns 401 (NOT 403) per the
// account-existence-probe defense — a 403 would confirm the account
// exists, letting an attacker enumerate valid accounts.
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (
    code === 'session_verifier_not_configured' ||
    code === 'lookup_failed'
  ) {
    return 500;
  }
  return 401;
}

/**
 * Map a `SubmissionRejectionReason` to its locked HTTP status per the
 * WP-332 status-code table. `guest_not_eligible` is structurally
 * unreachable on this authenticated route (an authenticated session is
 * never a guest) but is mapped defensively to a 403 class.
 */
function statusForRejectionReason(reason: SubmissionRejectionReason): number {
  if (reason === 'replay_not_found') {
    return 404;
  }
  // why: match_not_finished → 409 Conflict — the request conflicts with the match's
  // current state (not finished), distinct from a malformed request (400) or an
  // eligibility/verification failure (403/422). WP-338.
  if (reason === 'match_not_finished') {
    return 409;
  }
  if (
    reason === 'not_owner' ||
    reason === 'visibility_not_eligible' ||
    reason === 'guest_not_eligible'
  ) {
    return 403;
  }
  // par_not_published | replay_verification_failed
  return 422;
}

/**
 * Extract a non-empty `matchId` string from a parsed request body.
 * Returns the non-empty id, or `null` when the body is not an object,
 * the field is absent, not a string, or empty.
 */
function extractMatchId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = (body as { matchId?: unknown }).matchId;
  if (typeof candidate !== 'string' || candidate === '') {
    return null;
  }
  return candidate;
}

/**
 * Register the competitive score submission route on the supplied Koa
 * router. The router is mutated in place; the function returns `void`.
 * Production callers in `apps/server/src/server.mjs` pass the Koa
 * router from `boardgame.io`'s `Server({...})` (`server.router`), the
 * long-lived `pg.Pool`, and the dependency bundle (WP-112 session
 * orchestrator + verifier/accountResolver, the WP-107 suspension
 * guard, the bound PAR gate, and the startup registry). The optional
 * `competitionLogic` 4th parameter is a test-only injection seam.
 */
export function registerCompetitionRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: CompetitionRouteDependencies,
  competitionLogic: CompetitionLogic = PRODUCTION_COMPETITION_LOGIC,
): void {
  router.post('/api/competition/scores', async (koaContext) => {
    // why: Cache-Control MUST be the first statement of the handler
    // (WP-115 D-11504) so the header is set on every response path,
    // including the 500 error path below where a throw could otherwise
    // bypass it. A submission receipt is never a cacheable resource.
    koaContext.set('Cache-Control', 'no-store');

    // Gate 1 — authenticated session → AccountId.
    const sessionResult = await deps.requireAuthenticatedSession(
      koaContext.req,
      {
        verifier: deps.verifier,
        accountResolver: deps.accountResolver,
        database,
      },
    );
    if (sessionResult.ok !== true) {
      koaContext.status = statusForSessionValidationCode(sessionResult.code);
      koaContext.body = { error: sessionResult.code };
      return;
    }
    const accountId = sessionResult.value;

    // Gate 2 — account is not suspended (WP-107). The helper is
    // envelope-agnostic; this handler owns the HTTP mapping:
    // 'suspended' → 403 forbidden, 'lookup_failed' → 500.
    const suspensionResult = await deps.requireUnsuspendedAccount(
      database,
      accountId,
    );
    if (suspensionResult.ok !== true) {
      if (suspensionResult.code === 'suspended') {
        koaContext.status = 403;
        koaContext.body = { error: 'forbidden' };
      } else {
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
      }
      return;
    }

    // Gate 3 — request body shape.
    const matchId = extractMatchId(koaContext.request.body);
    if (matchId === null) {
      koaContext.status = 400;
      koaContext.body = { error: 'invalid_request' };
      return;
    }

    try {
      // why: the submission library takes a PlayerIdentity, but the
      // session path yields only an AccountId, so load the full
      // PlayerAccount here. An authenticated, unsuspended session is
      // never a guest — the library's guest_not_eligible branch is
      // therefore structurally unreachable on this route. A null load
      // means the account row vanished between the suspension check
      // and this read (an internal inconsistency), so map it to 500.
      const account: PlayerAccount | null =
        await competitionLogic.findPlayerByAccountId(accountId, database);
      if (account === null) {
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
        return;
      }

      const result =
        await competitionLogic.submitCompetitiveScoreByMatchIdForRequest(
          account,
          matchId,
          database,
          {
            checkParPublished: deps.checkParPublished,
          } satisfies CompetitiveSubmissionProductionDependencies,
        );

      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = {
          record: result.record,
          wasExisting: result.wasExisting,
        };
        return;
      }

      koaContext.status = statusForRejectionReason(result.reason);
      koaContext.body = { error: result.reason };
    } catch (caughtError) {
      // why: never re-throw — the existing server has no error
      // middleware beyond boardgame.io defaults, and an uncaught throw
      // would surface as a bodyless 500. The caught value is discarded
      // because the 500 envelope is locked at { error: 'internal_error' }
      // (no stack trace, no SQL state, no exception text leaked).
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // why: GET /api/me/scores — the authenticated player's submitted competitive
  // scores (the "my scores" read WP-339 renders). Same auth chain as the POST
  // (WP-112 session → WP-107 unsuspended); read-only, so no body gate. The 200
  // envelope is `{ scores }`; listPlayerCompetitiveScores returns `[]` for an
  // account with no submissions (never null). Cache-Control: no-store first,
  // matching the POST (a personalized authenticated read is not cacheable).
  router.get('/api/me/scores', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

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

    const suspensionResult = await deps.requireUnsuspendedAccount(
      database,
      accountId,
    );
    if (suspensionResult.ok !== true) {
      if (suspensionResult.code === 'suspended') {
        koaContext.status = 403;
        koaContext.body = { error: 'forbidden' };
      } else {
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
      }
      return;
    }

    try {
      const scores = await competitionLogic.listPlayerCompetitiveScores(
        accountId,
        database,
      );
      koaContext.status = 200;
      koaContext.body = { scores };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
