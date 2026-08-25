/**
 * Feedback Triage — Operator Routes (WP-605 / EC-640 / D-24416)
 *
 * Registers the two `admin-session-required` `/api/dash/*` endpoints that back the
 * dashboard's Feedback triage panel — the operator status-authoring half of the
 * D-24414 *Surfaces and authority* split:
 *
 *   * GET   /api/dash/feedback            → { data: { items } } — the whole queue
 *     (every type + status + projected voteCount, operator-only).
 *   * PATCH /api/dash/feedback/:id/status → { data: { item } }  — author a status.
 *
 * The dashboard is the SOLE writer of `feedback_item.status` / `resolution_reason`
 * (D-24416); this route delegates the write to `updateFeedbackItemStatus` (the only
 * status writer). Mirrors the `dashboardBilling.routes.ts` admin-read idiom:
 * `Cache-Control: no-store` first (D-11504), `requireAdminSession` (WP-159) via
 * `passesAdminGate`, a bare `{ data: T }` success envelope (D-20503), `{ code }`
 * errors, and a `try/catch` → typed 500. The PATCH parses its own JSON body with
 * the stream-guarded `ensureJsonBodyParsed` wrapper (copied from
 * `feedback.routes.ts`) — boardgame.io installs no global `/api` parser.
 *
 * Layer-boundary contract: imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. The `pg` driver is reachable only through the injected DatabaseClient.
 * The admin-authorization flag is read only inside `adminSession.ts` (via
 * `requireAdminSession`) — this route never inspects it directly.
 *
 * Authority: WP-605 §Scope D; EC-640; D-24416; D-11504; D-20503; D-9905/D-15901.
 */

import koaBody from 'koa-body';

import {
  toOperatorFeedbackItem,
  validateUpdateFeedbackStatusInput,
} from '../feedback/feedback.logic.js';
import {
  countVotesForItem,
  listAllFeedbackItems,
  updateFeedbackItemStatus,
} from '../feedback/feedback.persistence.js';

import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * Caller-injected dependency bundle for `registerDashboardFeedbackRoutes` — the
 * same `{ requireAdminSession, verifier, accountResolver }` trio `server.mjs`
 * threads into every dashboard registrar.
 */
export interface FeedbackTriageRouteDependencies {
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}

/**
 * Test-only injection seam (mirrors `feedback.routes.ts`'s `FeedbackRouteLogic`).
 * Production callers omit the 4th parameter and the handlers resolve to the
 * imported persistence functions; tests pass fakes returning canned results, so no
 * real database is touched. The pure validator + shaper are called directly (no
 * injection needed).
 */
export interface FeedbackTriageRouteLogic {
  readonly listAllFeedbackItems: typeof listAllFeedbackItems;
  readonly updateFeedbackItemStatus: typeof updateFeedbackItemStatus;
  readonly countVotesForItem: typeof countVotesForItem;
}

const PRODUCTION_FEEDBACK_TRIAGE_ROUTE_LOGIC: FeedbackTriageRouteLogic = {
  listAllFeedbackItems,
  updateFeedbackItemStatus,
  countVotesForItem,
};

/** Minimal structural shape of the Koa context surface this module touches. */
interface KoaFeedbackTriageContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { id?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaFeedbackTriageContext) => Promise<void> | void,
  ): unknown;
  patch(
    path: string,
    handler: (koaContext: KoaFeedbackTriageContext) => Promise<void> | void,
  ): unknown;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is no
// global /api parser — so the PATCH must parse its own JSON body. Without it, in
// production koaContext.request.body is undefined and the validator rejects every
// status write. The gap is latent: unit tests inject request.body directly (the
// shipped competition/feedback-route bug class), so they never exercise the parser.
const feedbackTriageJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for the unit-test fake context (which injects
 * `request.body` directly and exposes no stream), so the same handler works in
 * production and under `node:test` — mirroring `feedback.routes.ts`.
 *
 * @param koaContext The feedback-triage request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaFeedbackTriageContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    feedbackTriageJsonBodyParser as unknown as (
      koaContext: KoaFeedbackTriageContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Parse a feedback item id from the `:id` path param. Returns the positive integer
 * id, or null when the param is absent, non-numeric, non-positive, or beyond the
 * safe integer range.
 *
 * @param rawId The `:id` path param value.
 * @returns The parsed item id, or null when malformed.
 */
function parseFeedbackItemId(rawId: string | undefined): number | null {
  if (rawId === undefined || !/^[0-9]+$/.test(rawId)) {
    return null;
  }
  const itemId = Number(rawId);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return null;
  }
  return itemId;
}

/**
 * Run the shared admin gate. Returns `true` when the caller is an authenticated
 * admin; otherwise writes the mapped error response and returns `false`. Mirrors
 * `dashboardBilling.routes.ts`: `unauthorized` → 401, `forbidden` → 403,
 * `lookup_failed` → 500 (no reason leaked).
 */
async function passesAdminGate(
  koaContext: KoaFeedbackTriageContext,
  database: DatabaseClient,
  deps: FeedbackTriageRouteDependencies,
): Promise<boolean> {
  const authResult = await deps.requireAdminSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database,
  });
  if (authResult.ok === true) {
    return true;
  }
  if (authResult.code === 'unauthorized') {
    koaContext.status = 401;
    koaContext.body = { code: 'unauthorized', reason: authResult.reason };
    return false;
  }
  if (authResult.code === 'forbidden') {
    koaContext.status = 403;
    koaContext.body = { code: 'forbidden', reason: authResult.reason };
    return false;
  }
  // why: 'lookup_failed' — an admin-flag lookup error is a server fault, not a
  // client one; collapse to a bare 500 (no reason leaked).
  koaContext.status = 500;
  koaContext.body = { code: 'internal_error' };
  return false;
}

/**
 * Register the two feedback triage routes on the supplied Koa router. The router is
 * mutated in place; the function returns `void`. Production callers in
 * `apps/server/src/server.mjs` pass the Koa router, the long-lived `pg.Pool`, and
 * the dependency bundle. The optional `triageLogic` 4th parameter is a test-only
 * injection seam.
 */
export function registerDashboardFeedbackRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: FeedbackTriageRouteDependencies,
  triageLogic: FeedbackTriageRouteLogic = PRODUCTION_FEEDBACK_TRIAGE_ROUTE_LOGIC,
): void {
  // GET /api/dash/feedback — the whole triage queue (operator-only).
  router.get('/api/dash/feedback', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (D-11504) so it is set on
    // every path, including the 500. A triage read is never cacheable.
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      const items = await triageLogic.listAllFeedbackItems(database);
      koaContext.status = 200;
      koaContext.body = { data: { items } };
    } catch (caughtError) {
      // why: never re-throw — an uncaught throw would surface as a bodyless 500.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });

  // PATCH /api/dash/feedback/:id/status — author an item's status (operator-only).
  router.patch('/api/dash/feedback/:id/status', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }

      const itemId = parseFeedbackItemId(koaContext.params.id);
      if (itemId === null) {
        koaContext.status = 400;
        koaContext.body = { code: 'invalid_request' };
        return;
      }

      // why: parse the JSON body before reading it — boardgame.io's koa-body is
      // scoped to /games/*, so without this the production request.body is
      // undefined and the validator rejects every write. No-op under node:test.
      await ensureJsonBodyParsed(koaContext);

      const validation = validateUpdateFeedbackStatusInput(koaContext.request.body);
      if (validation.ok !== true) {
        koaContext.status = 400;
        koaContext.body = { code: validation.code };
        return;
      }

      const record = await triageLogic.updateFeedbackItemStatus(
        database,
        itemId,
        validation.value.status,
        validation.value.resolutionReason,
      );
      if (record === null) {
        koaContext.status = 404;
        koaContext.body = { code: 'not_found' };
        return;
      }

      const voteCount = await triageLogic.countVotesForItem(database, itemId);
      koaContext.status = 200;
      koaContext.body = { data: { item: toOperatorFeedbackItem(record, voteCount) } };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });
}
