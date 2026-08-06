/**
 * Handle HTTP Route — Server Layer (WP-501)
 *
 * Registers `PATCH /api/me/handle` on the existing Koa router returned by
 * boardgame.io's `Server({...})`, letting a signed-in user change their
 * (unlocked) `@handle` via `changeHandle` (`handle.logic.ts`). Freely
 * changeable while unlocked per D-24303 / D-24305.
 *
 * Mirrors the WP-104 `ownerProfile.routes.ts` structural shape: local
 * `KoaRouter` / `KoaContext` interfaces (no direct `@koa/router` import —
 * the router type reaches us structurally), `requireAuthenticatedSession`
 * as the first business-logic step, `try/catch` around any DB call, and
 * `Cache-Control: no-store` as the first statement of every handler.
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`, the engine,
 * registry, preplan, vue-sfc-loader, or any UI / client package. The `pg`
 * driver is reachable only through the supplied `DatabaseClient`; the
 * `requireAuthenticatedSession` provider, `verifier`, and `accountResolver`
 * are caller-injected (same pattern as `registerOwnerProfileRoutes`).
 *
 * Authority: WP-501 §Scope (In); EC-536 §Locked Values; D-24305 (change-
 * handle contract); WP-104 §Non-Negotiable Constraints (route + status
 * mapping — `unknown_account` → 401, not 403); WP-115 D-11504 (Cache-Control
 * first-statement lock); D-11202 (bearer header).
 */

import koaBody from 'koa-body';

import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { AccountId, DatabaseClient } from './identity.types.js';
import { changeHandle } from './handle.logic.js';

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there
// is no global body parser (same note as matchGate/billing/analytics/…) — so
// this custom /api route must parse its own JSON body. Without it,
// `koaContext.request.body` is undefined and every PATCH resolves to
// `invalid_handle`. This gap is latent under unit test: the route tests inject
// `request.body` directly and never exercise the real Node request stream —
// the identical WP-307/matchGate trap (fixed there with the same helper).
const jsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for the unit-test fake context (which
 * injects `request.body` directly and exposes no stream), so the same handler
 * works in production and under `node:test` — mirrors matchGate's
 * `ensureJsonBodyParsed`.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaHandleContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    jsonBodyParser as unknown as (
      koaContext: KoaHandleContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Closed-set re-statement of the orchestrator's session-validation codes
 * (declared locally so this identity-layer module does not import a route
 * module's type). Dispatched against the locked WP-104 status table.
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
 * Caller-injected dependency bundle for `registerHandleRoutes`, identical
 * in shape to `OwnerProfileRouteDependencies`: the WP-112 orchestrator (or
 * a test fake) plus the broker-specific `verifier` / `accountResolver`
 * passed through at request time (both `undefined` until WP-126, which
 * makes every authenticated request fail closed per D-11204).
 */
export interface HandleRouteDependencies {
  readonly requireAuthenticatedSession: (
    req: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}

/** Minimal structural shape of the Koa context surface this module touches. */
interface KoaHandleContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  patch(
    path: string,
    handler: (koaContext: KoaHandleContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `SessionValidationErrorCode` to its locked HTTP status per WP-104.
 * `'unknown_account'` returns 401 (NOT 403) per the account-existence-probe
 * defense; the two operator-facing codes return 500; every other code 401.
 */
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Map a `changeHandle` failure code to its HTTP status. Accepts the broad
 * `IdentityErrorCode` (as `string`) that `Result.code` carries; only the
 * five handle codes can actually surface from `changeHandle`.
 */
function statusForHandleErrorCode(code: string): number {
  // why: format failures are client input errors (400); a handle taken by
  // another account or locked is a conflict with existing state (409);
  // `unknown_account` (the post-auth account-vanished case) → 401 per the
  // WP-104 convention. Any unexpected code falls through to 401.
  if (code === 'invalid_handle' || code === 'reserved_handle') {
    return 400;
  }
  if (code === 'handle_taken' || code === 'handle_already_locked') {
    return 409;
  }
  return 401;
}

/**
 * Register `PATCH /api/me/handle` on the supplied Koa router (mutated in
 * place; returns `void`). Production callers in `server.mjs` pass the
 * boardgame.io `server.router`, the long-lived `pg.Pool`, and the same
 * dependency bundle as `registerOwnerProfileRoutes`.
 */
export function registerHandleRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: HandleRouteDependencies,
): void {
  async function authenticate(
    koaContext: KoaHandleContext,
  ): Promise<AccountId | null> {
    const result = await deps.requireAuthenticatedSession(koaContext.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database,
    });
    if (result.ok === true) {
      return result.value;
    }
    koaContext.status = statusForSessionValidationCode(result.code);
    koaContext.body = { error: result.code };
    return null;
  }

  router.patch('/api/me/handle', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (WP-115 D-11504) so a
    // thrown exception still leaves the header set on the eventual 500 —
    // handle responses must never be cached by an intermediate proxy.
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      // why: parse the JSON body ourselves (no global parser — see the note on
      // jsonBodyParser above); without this `request.body` is undefined and
      // every change resolves to invalid_handle.
      await ensureJsonBodyParsed(koaContext);
      const body = koaContext.request.body;
      if (
        typeof body !== 'object' ||
        body === null ||
        typeof (body as { handle?: unknown }).handle !== 'string'
      ) {
        koaContext.status = 400;
        koaContext.body = { error: 'invalid_handle' };
        return;
      }
      const result = await changeHandle(
        accountId,
        (body as { handle: string }).handle,
        database,
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForHandleErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      // why: never re-throw to a global Koa handler — the server has no
      // error middleware beyond boardgame.io defaults; the 500 envelope is
      // locked to `{ error: 'internal_error' }`.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
