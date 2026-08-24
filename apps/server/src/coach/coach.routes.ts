/**
 * Endgame AI Coach — HTTP Route (WP-594 / EC-629 / D-24403)
 *
 * Registers one authenticated, Legendary-Pass-gated read endpoint:
 *
 *   * `GET /api/me/scores/:replayHash/coach` — the endgame AI coaching for a
 *     scored match the caller owns. Lazy + cached: the paid model runs at most
 *     once per match; every later view is a cache hit.
 *
 * Mirrors the WP-332 `competition.routes.ts` authenticated-read pattern: local
 * structural `KoaRouter` / context interfaces (no `@koa/router` import),
 * caller-injected `requireAuthenticatedSession` / `verifier` / `accountResolver`
 * / `requireUnsuspendedAccount`, `Cache-Control: no-store` as the first
 * statement, a uniform `{ error: <code> }` envelope, and a `try/catch` that turns
 * any uncaught throw into a typed 500. The startup `registry` is injected for
 * card-name resolution and the model client for generation (both process-lived).
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine` (runtime), `@legendary-arena/preplan`, or any
 * UI package. `pg` is reachable only through the injected `DatabaseClient`.
 *
 * Authority: WP-594 §Contract; EC-629; D-24403; D-11504 (Cache-Control first);
 * D-9905 (Auth closed set).
 */

import type { CardRegistry } from '@legendary-arena/registry';

import { generateOrGetCoachReport } from './coach.logic.js';
import { buildNameResolver } from '../match/matchLagn.logic.js';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { RequireUnsuspendedAccountResult } from '../auth/requireUnsuspendedAccount.js';
import type {
  CoachModelClient,
  CoachRefusalReason,
  CoachResult,
} from './coach.types.js';

/**
 * Closed-set re-statement of the WP-112 orchestrator result shape (mirrors the
 * WP-104 / WP-332 precedent) so this file does not depend on the profile layer.
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
 * Caller-injected dependency bundle for `registerCoachRoutes`. Same auth deps as
 * the competition routes, plus the startup `registry` (for card-name resolution)
 * and the `modelClient` (the Anthropic-backed client, or a disabled client that
 * fails soft when `ANTHROPIC_API_KEY` is unset).
 */
export interface CoachRouteDependencies {
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
  readonly registry: CardRegistry;
  readonly modelClient: CoachModelClient;
}

/**
 * Test-only injection seam (mirrors WP-332's `CompetitionLogic`). Production
 * callers omit the 4th parameter; tests pass a fake `generateOrGetCoachReport`
 * returning a canned `CoachResult`, so no database and no model call are touched.
 */
export interface CoachRouteLogic {
  readonly generateOrGetCoachReport: typeof generateOrGetCoachReport;
}

const PRODUCTION_COACH_ROUTE_LOGIC: CoachRouteLogic = {
  generateOrGetCoachReport,
};

/** Minimal structural shape of the Koa context this module touches. */
interface KoaCoachContext {
  readonly req: SessionTokenRequest;
  params: { replayHash?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaCoachContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `SessionValidationCode` to its locked HTTP status (WP-104 mapping):
 * operator faults → 500; every other code → 401.
 */
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Map a `CoachRefusalReason` to its HTTP status: `not_entitled` / `not_owner` →
 * 403; `not_found` → 404; `coach_unavailable` → 503 (a fail-soft, retriable
 * signal — the endgame card is never blocked).
 */
function statusForRefusalReason(reason: CoachRefusalReason): number {
  if (reason === 'not_found') {
    return 404;
  }
  if (reason === 'coach_unavailable') {
    return 503;
  }
  // not_entitled | not_owner
  return 403;
}

/**
 * Register the endgame-coach read route on the supplied Koa router. The router is
 * mutated in place; the function returns `void`. Production callers in
 * `server.mjs` pass the Koa router, the long-lived `pg.Pool`, and the dependency
 * bundle. The optional `coachLogic` 4th parameter is a test-only injection seam.
 */
export function registerCoachRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: CoachRouteDependencies,
  coachLogic: CoachRouteLogic = PRODUCTION_COACH_ROUTE_LOGIC,
): void {
  // why: resolve the name resolver once (the registry is frozen for the process
  // lifetime), not per request — mirrors matchLagn.routes.
  const resolveCardName = buildNameResolver(deps.registry);

  router.get('/api/me/scores/:replayHash/coach', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (D-11504) so it is set on
    // every path, including the 500. A personalized authenticated read is not
    // cacheable.
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

    const suspensionResult = await deps.requireUnsuspendedAccount(database, accountId);
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

    const replayHash = koaContext.params.replayHash;
    if (replayHash === undefined || replayHash === '') {
      koaContext.status = 400;
      koaContext.body = { error: 'invalid_request' };
      return;
    }

    try {
      const result: CoachResult = await coachLogic.generateOrGetCoachReport(
        accountId,
        replayHash,
        {
          database,
          modelClient: deps.modelClient,
          resolveCardName,
        },
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = { report: result.report, wasCached: result.wasCached };
        return;
      }
      koaContext.status = statusForRefusalReason(result.reason);
      koaContext.body = { error: result.reason };
    } catch (caughtError) {
      // why: never re-throw — an uncaught throw would surface as a bodyless 500.
      // The 500 envelope is locked (no leaked internals).
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
