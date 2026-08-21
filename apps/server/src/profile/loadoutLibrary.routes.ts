/**
 * Profile Loadout Library HTTP Routes — Server Layer (WP-301 / EC-332)
 *
 * Registers five endpoints on the existing Koa router returned by the
 * game-server framework's `Server({...})` instance:
 *
 *   * `POST   /api/me/loadouts`            — create (authenticated)
 *   * `GET    /api/me/loadouts`            — list   (authenticated)
 *   * `PATCH  /api/me/loadouts/:id`        — rename + visibility (auth)
 *   * `DELETE /api/me/loadouts/:id`        — delete (authenticated)
 *   * `GET    /api/loadouts/:shareSlug`    — guest public read
 *
 * Mirrors the WP-104 `ownerProfile.routes.ts` structural shape: local
 * `KoaRouter` / `KoaContext` interfaces (no direct router import — the
 * router type reaches us structurally), `requireAuthenticatedSession`
 * as the first business step on every `/api/me/*` handler, a
 * `try/catch` around all logic so any uncaught throw becomes a typed
 * 500, and status + body + `Cache-Control` set on every response path.
 *
 * This module contains no SQL and no validation logic — it parses the
 * request structure, authenticates, delegates to
 * `loadoutLibrary.logic.ts`, and maps the typed
 * `LoadoutLibraryErrorCode` to its HTTP status.
 *
 * Layer-boundary contract: this module imports nothing from the engine
 * runtime, the registry runtime, or any UI / client package. The `pg`
 * driver is reachable only through the supplied `DatabaseClient`
 * parameter; the `requireAuthenticatedSession` provider, `verifier`,
 * and `accountResolver` are caller-injected per the WP-104 pattern.
 *
 * Authority: WP-301 §Scope (In) §D; EC-332 §Guardrails; D-24086;
 * D-9905 (Auth closed set); D-11504 (Cache-Control first-statement).
 */

import type {
  AccountId,
  CreateLoadoutInput,
  DatabaseClient,
  LoadoutLibraryErrorCode,
  LoadoutLibraryRouteDependencies,
  SessionTokenRequest,
  UpdateLoadoutPatch,
} from './loadoutLibrary.types.js';
import koaBody from 'koa-body';
import {
  createLoadout,
  deleteLoadout,
  getPublicLoadoutBySlug,
  listLoadouts,
  updateLoadout,
} from './loadoutLibrary.logic.js';

/**
 * Minimal structural shape of the Koa context surface this module
 * touches. Mirrors the WP-104 `KoaOwnerProfileContext` precedent plus
 * a `params` bag for the `:id` / `:shareSlug` path parameters.
 */
interface KoaLoadoutContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface this module
 * touches. Matches the `@koa/router` method signatures for the five
 * registration sites below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaLoadoutContext) => Promise<void> | void,
  ): unknown;
  post(
    path: string,
    handler: (koaContext: KoaLoadoutContext) => Promise<void> | void,
  ): unknown;
  patch(
    path: string,
    handler: (koaContext: KoaLoadoutContext) => Promise<void> | void,
  ): unknown;
  delete(
    path: string,
    handler: (koaContext: KoaLoadoutContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `LoadoutLibraryErrorCode` to its locked HTTP status. All
 * validation / intent failures are 4xx; the cap is a 409 conflict
 * (the request conflicts with the account's current at-cap state).
 */
function statusForLoadoutErrorCode(code: LoadoutLibraryErrorCode): number {
  if (code === 'unauthorized') {
    return 401;
  }
  if (code === 'not_found') {
    return 404;
  }
  if (code === 'loadout_limit_reached') {
    return 409;
  }
  // why: invalid_lagn / invalid_name / empty_update are all
  // client-request faults → 400 Bad Request.
  return 400;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is
// no global body parser — so these guarded /api routes must parse their own JSON
// body. Without it, in production koaContext.request.body is undefined and the
// create/update handlers below act on an empty body — a shipped 100% failure for
// saving/updating loadouts. The gap stayed latent because the route tests inject
// request.body directly. Mirrors matchGate/competition's test-friendly short-circuit.
const loadoutRouteJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op when no stream is exposed (a unit-test fake
 * context injects `request.body` directly), so the same handler works in
 * production and under `node:test`.
 *
 * @param koaContext The loadout-route request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaLoadoutContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    loadoutRouteJsonBodyParser as unknown as (
      koaContext: KoaLoadoutContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Register the five loadout-library routes on the supplied Koa router.
 * The router is mutated in place; the function returns `void`.
 * Production callers in `server.mjs` pass the Koa router obtained from
 * the game-server framework's `Server({...})` instance, the long-lived `pg.Pool`,
 * and the dependency bundle including the WP-112
 * `requireAuthenticatedSession` orchestrator.
 */
export function registerLoadoutLibraryRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: LoadoutLibraryRouteDependencies,
): void {
  // why: requireAuthenticatedSession is the first business-logic step on
  // every /api/me/* handler before any DB query, mirroring the WP-104
  // caller-injected pattern so production wires the real orchestrator and
  // tests inject fakes. On failure the handler returns the mapped status
  // with a typed { error } body drawn from the loadout-library closed set
  // ('unauthorized') or the route-structural 'internal_error' sentinel.
  async function authenticate(
    koaContext: KoaLoadoutContext,
  ): Promise<AccountId | null> {
    const result = await deps.requireAuthenticatedSession(koaContext.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database,
    });
    if (result.ok === true) {
      return result.value;
    }
    // why: an unconfigured verifier or a failed account lookup is an
    // operator-facing 500; every other session-validation failure is a
    // 401 with the closed-set 'unauthorized' code (the internal
    // session-validation code is never leaked to the client).
    if (
      result.code === 'session_verifier_not_configured' ||
      result.code === 'lookup_failed'
    ) {
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
      return null;
    }
    koaContext.status = 401;
    koaContext.body = { error: 'unauthorized' };
    return null;
  }

  router.post('/api/me/loadouts', async (koaContext) => {
    // why: Cache-Control MUST be the first statement in every handler
    // body per D-11504 so a thrown exception still leaves the header set
    // on the eventual 500 response — loadout responses must never be
    // cached by an intermediate proxy.
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      await ensureJsonBodyParsed(koaContext);
      const rawBody = koaContext.request.body;
      const body =
        rawBody !== null && typeof rawBody === 'object'
          ? (rawBody as Record<string, unknown>)
          : {};
      const input: CreateLoadoutInput = { name: body.name, lagn: body.lagn };
      const result = await createLoadout(accountId, input, database);
      if (result.ok === true) {
        koaContext.status = 201;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForLoadoutErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      // why: never re-throw to a global Koa handler — the server has no
      // error middleware beyond the framework defaults, so an uncaught
      // throw would surface as a 500 without a body. The caught value is
      // discarded because the 500 envelope is locked at internal_error.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/loadouts', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await listLoadouts(accountId, database);
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = { loadouts: result.value };
        return;
      }
      koaContext.status = statusForLoadoutErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.patch('/api/me/loadouts/:id', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      await ensureJsonBodyParsed(koaContext);
      const rawBody = koaContext.request.body;
      const body =
        rawBody !== null && typeof rawBody === 'object'
          ? (rawBody as Record<string, unknown>)
          : {};
      // why: build the patch from only the keys the client actually sent
      // (Object.hasOwn) so the logic layer can distinguish "field absent"
      // from "field set" and reject a no-field PATCH with empty_update.
      const patch: { name?: unknown; visibility?: unknown } = {};
      if (Object.hasOwn(body, 'name')) {
        patch.name = body.name;
      }
      if (Object.hasOwn(body, 'visibility')) {
        const visibilityValue = body.visibility;
        if (visibilityValue !== 'private' && visibilityValue !== 'public') {
          koaContext.status = 400;
          koaContext.body = { error: 'invalid_request' };
          return;
        }
        patch.visibility = visibilityValue;
      }
      const result = await updateLoadout(
        accountId,
        koaContext.params.id,
        patch as UpdateLoadoutPatch,
        database,
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForLoadoutErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.delete('/api/me/loadouts/:id', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await deleteLoadout(
        accountId,
        koaContext.params.id,
        database,
      );
      if (result.ok === true) {
        // why: 204 No Content — a successful delete returns no body.
        koaContext.status = 204;
        koaContext.body = null;
        return;
      }
      koaContext.status = statusForLoadoutErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/loadouts/:shareSlug', async (koaContext) => {
    // why: no-store even on the guest read — a public loadout can be
    // flipped back to private, so a cached copy must never keep serving a
    // now-private loadout from an intermediate proxy.
    koaContext.set('Cache-Control', 'no-store');
    try {
      const result = await getPublicLoadoutBySlug(
        koaContext.params.shareSlug,
        database,
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForLoadoutErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
