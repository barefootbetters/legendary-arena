/**
 * Gauntlet Run Import + Run-CRUD HTTP Routes — Server Layer (WP-445 / EC-480)
 *
 * Registers four authenticated endpoints on the existing Koa router returned by
 * the game-server framework's `Server({...})` instance:
 *
 *   * `POST   /api/me/gauntlet-runs`      — import a WP-440 pack (idempotent)
 *   * `GET    /api/me/gauntlet-runs`      — list runs with DERIVED progression
 *   * `PATCH  /api/me/gauntlet-runs/:id`  — edit a run's per-leg hero picks
 *   * `DELETE /api/me/gauntlet-runs/:id`  — delete a run
 *
 * WP-446 enhances the `GET` handler alone: it now delegates to
 * `listGauntletRunProgress` and returns `{ runs: GauntletRunProgressView[] }` —
 * each run's raw fields plus its derived progression (status / pool / headroom /
 * per-leg cleared / last-played), computed at read time and stored NOWHERE
 * (D-24262). The other three handlers are byte-unchanged.
 *
 * Mirrors the WP-301 `loadoutLibrary.routes.ts` + WP-332 `competition.routes.ts`
 * structural shape: local `KoaRouter` / `KoaGauntletRunContext` interfaces (no
 * direct router import — the router type reaches us structurally), the
 * `requireAuthenticatedSession` → `requireUnsuspendedAccount` gate as the first
 * business steps on every handler, a `try/catch` around all logic so any
 * uncaught throw becomes a typed 500, and status + body + `Cache-Control` set
 * on every response path.
 *
 * This module contains no SQL and no validation logic — it parses the request
 * structure, authenticates, delegates to `gauntletRun.logic.ts`, and maps the
 * typed `GauntletRunErrorCode` to its HTTP status.
 *
 * Layer-boundary contract: this module imports nothing from the engine runtime,
 * the registry runtime, or any UI / client package. The `pg` driver is
 * reachable only through the supplied `DatabaseClient` parameter; the
 * `requireAuthenticatedSession` provider, `verifier`, `accountResolver`,
 * `requireUnsuspendedAccount`, and `resolveGauntletExistence` are all
 * caller-injected per the WP-332 pattern.
 *
 * Authority: WP-445 §Scope (In); EC-480 §Guardrails; D-9905 (Auth closed set);
 * D-11504 (Cache-Control first-statement); D-24264 (import-idempotency +
 * run-API-shape lock).
 */

import type {
  AccountId,
  DatabaseClient,
  GauntletRunErrorCode,
  GauntletRunRouteDependencies,
  ImportGauntletRunInput,
  SessionTokenRequest,
  UpdateGauntletRunPatch,
} from './gauntletRun.types.js';
import {
  deleteGauntletRun,
  importGauntletRun,
  updateGauntletRunLegPicks,
} from './gauntletRun.logic.js';
// why: WP-446 — the GET handler now returns each run's DERIVED progression
// (status / pool / headroom / per-leg cleared / last-played) computed at read
// time via the derived-progression module, instead of the raw stored run
// `listGauntletRuns` returned. POST/PATCH/DELETE are unchanged.
import { listGauntletRunProgress } from './gauntletRunProgress.logic.js';
import koaBody from 'koa-body';

/**
 * Minimal structural shape of the Koa context surface this module touches.
 * Mirrors the WP-301 `KoaLoadoutContext` precedent plus a `params` bag for the
 * `:id` path parameter.
 */
interface KoaGauntletRunContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface this module touches.
 * Matches the `@koa/router` method signatures for the four registration sites
 * below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaGauntletRunContext) => Promise<void> | void,
  ): unknown;
  post(
    path: string,
    handler: (koaContext: KoaGauntletRunContext) => Promise<void> | void,
  ): unknown;
  patch(
    path: string,
    handler: (koaContext: KoaGauntletRunContext) => Promise<void> | void,
  ): unknown;
  delete(
    path: string,
    handler: (koaContext: KoaGauntletRunContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `GauntletRunErrorCode` to its locked HTTP status (EC-480 §Locked
 * Values): `unauthorized`→401, `account_suspended`→403, `invalid_pack`→400,
 * `unknown_gauntlet`→422, `invalid_leg_picks`→400, `not_found`→404.
 */
export function statusForGauntletRunErrorCode(
  code: GauntletRunErrorCode,
): number {
  if (code === 'unauthorized') {
    return 401;
  }
  if (code === 'account_suspended') {
    return 403;
  }
  if (code === 'unknown_gauntlet') {
    return 422;
  }
  if (code === 'not_found') {
    return 404;
  }
  // why: invalid_pack and invalid_leg_picks are both client-request faults → 400
  // Bad Request.
  return 400;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is
// no global body parser — so these guarded /api routes must parse their own JSON
// body. Without it, in production koaContext.request.body is undefined and the
// import/update handlers below act on an undefined body — a shipped 100% failure
// for importing/updating gauntlet runs. The gap stayed latent because these route
// handlers have no unit coverage exercising a real request stream. Mirrors
// matchGate/competition's test-friendly short-circuit.
const gauntletRunRouteJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op when no stream is exposed (a unit-test fake
 * context injects `request.body` directly), so the same handler works in
 * production and under `node:test`.
 *
 * @param koaContext The gauntlet-run-route request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaGauntletRunContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    gauntletRunRouteJsonBodyParser as unknown as (
      koaContext: KoaGauntletRunContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Register the four gauntlet-run routes on the supplied Koa router. The router
 * is mutated in place; the function returns `void`. Production callers in
 * `server.mjs` pass the Koa router obtained from the game-server framework's
 * `Server({...})` instance, the long-lived `pg.Pool`, and the dependency bundle
 * including the WP-112 `requireAuthenticatedSession` orchestrator, the WP-107
 * `requireUnsuspendedAccount` guard, and the injected `resolveGauntletExistence`
 * resolver built from the startup gauntlet catalog.
 */
export function registerGauntletRunRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: GauntletRunRouteDependencies,
): void {
  // why: the two auth gates (WP-112 session → WP-107 unsuspended account) are
  // the first business steps on every handler before any DB query, mirroring
  // the WP-332 competition-routes pattern so production wires the real
  // orchestrator + guard and tests inject fakes. On failure the shared helper
  // sets the mapped status + typed { error } body from the gauntlet-run closed
  // set ('unauthorized' / 'account_suspended') or the route-structural
  // 'internal_error' sentinel, and returns null so the handler stops.
  async function resolveCaller(
    koaContext: KoaGauntletRunContext,
  ): Promise<AccountId | null> {
    const sessionResult = await deps.requireAuthenticatedSession(
      koaContext.req,
      {
        verifier: deps.verifier,
        accountResolver: deps.accountResolver,
        database,
      },
    );
    if (sessionResult.ok !== true) {
      // why: an unconfigured verifier or a failed account lookup is an
      // operator-facing 500; every other session-validation failure is a 401
      // with the closed-set 'unauthorized' code (the internal session-validation
      // code is never leaked to the client).
      if (
        sessionResult.code === 'session_verifier_not_configured' ||
        sessionResult.code === 'lookup_failed'
      ) {
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
        return null;
      }
      koaContext.status = 401;
      koaContext.body = { error: 'unauthorized' };
      return null;
    }
    const accountId = sessionResult.value;

    const suspensionResult = await deps.requireUnsuspendedAccount(
      database,
      accountId,
    );
    if (suspensionResult.ok !== true) {
      // why: a suspended account is a 403 with the closed-set 'account_suspended'
      // code; a 'lookup_failed' (the account row vanished, or the read threw) is
      // an operator-facing 500.
      if (suspensionResult.code === 'suspended') {
        koaContext.status = 403;
        koaContext.body = { error: 'account_suspended' };
      } else {
        koaContext.status = 500;
        koaContext.body = { error: 'internal_error' };
      }
      return null;
    }
    return accountId;
  }

  router.post('/api/me/gauntlet-runs', async (koaContext) => {
    // why: Cache-Control MUST be the first statement in every handler body per
    // D-11504 so a thrown exception still leaves the header set on the eventual
    // 500 response — a run import receipt must never be cached by an
    // intermediate proxy.
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await resolveCaller(koaContext);
      if (accountId === null) {
        return;
      }
      // why: the entire request body IS the untrusted WP-440 pack; the logic
      // layer validates its shape with validateGauntletPack.
      await ensureJsonBodyParsed(koaContext);
      const input: ImportGauntletRunInput = { pack: koaContext.request.body };
      const result = await importGauntletRun(
        accountId,
        input,
        database,
        deps.resolveGauntletExistence,
      );
      if (result.ok === true) {
        // why: D-24264 — a brand-new insert returns 201; an idempotent attach to
        // an existing active run returns 200 with the same run.
        koaContext.status = result.value.wasCreated ? 201 : 200;
        koaContext.body = result.value.view;
        return;
      }
      koaContext.status = statusForGauntletRunErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      // why: never re-throw to a global Koa handler — the server has no error
      // middleware beyond the framework defaults, so an uncaught throw would
      // surface as a 500 without a body. The caught value is discarded because
      // the 500 envelope is locked at internal_error.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/gauntlet-runs', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await resolveCaller(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await listGauntletRunProgress(
        accountId,
        database,
        deps.resolveGauntletRunProgressInputs,
        deps.leaderboardDependencies,
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = { runs: result.value };
        return;
      }
      koaContext.status = statusForGauntletRunErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.patch('/api/me/gauntlet-runs/:id', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await resolveCaller(koaContext);
      if (accountId === null) {
        return;
      }
      await ensureJsonBodyParsed(koaContext);
      const rawBody = koaContext.request.body;
      const body =
        rawBody !== null && typeof rawBody === 'object'
          ? (rawBody as Record<string, unknown>)
          : {};
      // why: the logic layer structurally validates legPicks; an absent field
      // arrives as undefined and is rejected invalid_leg_picks there.
      const patch: UpdateGauntletRunPatch = { legPicks: body.legPicks };
      const result = await updateGauntletRunLegPicks(
        accountId,
        koaContext.params.id,
        patch,
        database,
      );
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForGauntletRunErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.delete('/api/me/gauntlet-runs/:id', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await resolveCaller(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await deleteGauntletRun(
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
      koaContext.status = statusForGauntletRunErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
