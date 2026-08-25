/**
 * Player Feedback & Voting — HTTP Routes (WP-604 / EC-639 / D-24414)
 *
 * Registers the four feedback endpoints on the existing Koa router returned by
 * boardgame.io's `Server({...})` instance:
 *
 *   * `POST   /api/feedback`          (auth)  — submit a bug/enhancement/review.
 *   * `GET    /api/feedback`          (guest) — the public enhancement roadmap with
 *     a projected `voteCount` (+ `viewerHasVoted` when a session token is present).
 *   * `POST   /api/feedback/:id/vote` (auth)  — cast an upvote (idempotent).
 *   * `DELETE /api/feedback/:id/vote` (auth)  — retract an upvote (no-op if absent).
 *
 * Mirrors the WP-594 `coach.routes.ts` + WP-332 `competition.routes.ts`
 * authenticated-route pattern: local structural `KoaRouter` / context interfaces
 * (no `@koa/router` import), caller-injected `requireAuthenticatedSession` /
 * `verifier` / `accountResolver`, `Cache-Control: no-store` as the first statement
 * of every handler (D-11504), a uniform `{ error: <code> }` envelope, and a
 * `try/catch` that turns any uncaught throw into a typed 500. The write route that
 * carries a body parses it with its OWN `koaBody()` — boardgame.io installs no
 * global `/api` parser, so `request.body` is undefined in production without it.
 *
 * Layer-boundary contract: imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. The `pg` driver is reachable only through the injected DatabaseClient.
 *
 * Authority: WP-604 §Scope E + §F; EC-639; D-24414; D-11504 (Cache-Control first);
 * D-9905 (Auth closed set).
 */

import koaBody from 'koa-body';

import { validateSubmitFeedbackInput } from './feedback.logic.js';
import {
  addVote,
  countVotesForItem,
  insertFeedbackItem,
  listPublicEnhancements,
  removeVote,
} from './feedback.persistence.js';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

/**
 * Closed-set re-statement of the WP-112 orchestrator's
 * `Result<AccountId, SessionValidationCode>` shape. Declared locally (mirrors the
 * coach / competition precedent) so this file does not depend on the profile layer
 * for a type the auth layer owns.
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
 * Caller-injected dependency bundle for `registerFeedbackRoutes`.
 * `requireAuthenticatedSession` is the WP-112 orchestrator (or a test fake);
 * `verifier` + `accountResolver` are the broker-specific implementations passed
 * through at request time. No suspension guard is threaded — feedback submission
 * and voting are identity-gated only (WP-604 §F).
 */
export interface FeedbackRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}

/**
 * Test-only injection seam (mirrors WP-594's `CoachRouteLogic`). Production callers
 * omit the 4th parameter and the handlers resolve to the imported persistence
 * functions; tests pass fakes returning canned results, so no real database is
 * touched.
 */
export interface FeedbackRouteLogic {
  readonly insertFeedbackItem: typeof insertFeedbackItem;
  readonly listPublicEnhancements: typeof listPublicEnhancements;
  readonly addVote: typeof addVote;
  readonly removeVote: typeof removeVote;
  readonly countVotesForItem: typeof countVotesForItem;
}

const PRODUCTION_FEEDBACK_ROUTE_LOGIC: FeedbackRouteLogic = {
  insertFeedbackItem,
  listPublicEnhancements,
  addVote,
  removeVote,
  countVotesForItem,
};

/** Minimal structural shape of the Koa context surface this module touches. */
interface KoaFeedbackContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { id?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/** Minimal structural shape of the Koa router surface this module touches. */
interface KoaRouter {
  post(
    path: string,
    handler: (koaContext: KoaFeedbackContext) => Promise<void> | void,
  ): unknown;
  get(
    path: string,
    handler: (koaContext: KoaFeedbackContext) => Promise<void> | void,
  ): unknown;
  delete(
    path: string,
    handler: (koaContext: KoaFeedbackContext) => Promise<void> | void,
  ): unknown;
}

// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there is no
// global body parser (same note as competition/billing/sweep) — so the submit route
// must parse its own JSON body. Without it, in production koaContext.request.body is
// undefined and validateSubmitFeedbackInput rejects EVERY submission as
// invalid_request. The gap is latent: unit tests inject request.body directly, so
// they never exercise the missing parser (the shipped competition-route bug class).
const feedbackRouteJsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for the unit-test fake context (which injects
 * `request.body` directly and exposes no stream), so the same handler works in
 * production and under `node:test` — mirroring competition's test-friendly
 * short-circuit.
 *
 * @param koaContext The feedback-route request context.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaFeedbackContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    feedbackRouteJsonBodyParser as unknown as (
      koaContext: KoaFeedbackContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

/**
 * Map a `SessionValidationCode` to its locked HTTP status (the coach / competition
 * mapping): operator-facing faults → 500; every other code → 401.
 */
// why: 'unknown_account' returns 401 (NOT 403) per the account-existence-probe
// defense — a 403 would confirm the account exists, letting an attacker enumerate
// valid accounts.
function statusForSessionValidationCode(code: SessionValidationCode): number {
  if (code === 'session_verifier_not_configured' || code === 'lookup_failed') {
    return 500;
  }
  return 401;
}

/**
 * Parse a feedback item id from a path param. Returns the positive integer id, or
 * null when the param is absent, non-numeric, non-positive, or beyond the safe
 * integer range.
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
 * Register the four feedback routes on the supplied Koa router. The router is
 * mutated in place; the function returns `void`. Production callers in
 * `apps/server/src/server.mjs` pass the Koa router from boardgame.io's
 * `Server({...})` (`server.router`), the long-lived `pg.Pool`, and the dependency
 * bundle. The optional `feedbackLogic` 4th parameter is a test-only injection seam.
 */
export function registerFeedbackRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: FeedbackRouteDependencies,
  feedbackLogic: FeedbackRouteLogic = PRODUCTION_FEEDBACK_ROUTE_LOGIC,
): void {
  // POST /api/feedback — submit a bug / enhancement / review (authenticated).
  router.post('/api/feedback', async (koaContext) => {
    // why: Cache-Control MUST be the first statement (D-11504) so it is set on every
    // path, including the 500. A submission receipt is never a cacheable resource.
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
    const authorExtId = sessionResult.value;

    // why: parse the JSON body before reading it — boardgame.io's koa-body is scoped
    // to /games/*, so without this the production request.body is undefined and the
    // validator below rejects every submission. No-op under node:test.
    await ensureJsonBodyParsed(koaContext);

    const validation = validateSubmitFeedbackInput(koaContext.request.body);
    if (validation.ok !== true) {
      koaContext.status = 400;
      koaContext.body = { error: validation.code };
      return;
    }

    try {
      const record = await feedbackLogic.insertFeedbackItem(
        database,
        validation.value,
        authorExtId,
      );
      koaContext.status = 201;
      koaContext.body = { id: record.id };
    } catch (caughtError) {
      // why: never re-throw — an uncaught throw would surface as a bodyless 500. The
      // 500 envelope is locked (no leaked internals).
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // GET /api/feedback — the public enhancement roadmap (guest). A session token is
  // resolved opportunistically: when present it fills viewerHasVoted; when absent or
  // invalid the caller is treated as a guest (no error). The status set is always the
  // public roadmap default — this endpoint deliberately exposes no statusFilter param,
  // so raw 'under_review' intake can never be requested over HTTP.
  router.get('/api/feedback', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');

    let viewerExtId: AccountId | undefined;
    const sessionResult = await deps.requireAuthenticatedSession(koaContext.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database,
    });
    if (sessionResult.ok === true) {
      viewerExtId = sessionResult.value;
    }

    try {
      // why: build the options object conditionally so exactOptionalPropertyTypes is
      // satisfied (an explicit `viewerExtId: undefined` is not assignable to the
      // optional field).
      const options =
        viewerExtId === undefined ? {} : { viewerExtId };
      const items = await feedbackLogic.listPublicEnhancements(database, options);
      koaContext.status = 200;
      koaContext.body = { items };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // POST /api/feedback/:id/vote — cast an upvote (authenticated, idempotent).
  router.post('/api/feedback/:id/vote', async (koaContext) => {
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
    const accountExtId = sessionResult.value;

    // why: this write route owns its parser too (the no-global-/api-parser rule): the
    // vote payload is the path :id + the session account, so no body field is read
    // today, but mounting the parser keeps request.body defined and the route robust
    // to a future body field — mirroring competition's per-write-route posture.
    await ensureJsonBodyParsed(koaContext);

    const itemId = parseFeedbackItemId(koaContext.params.id);
    if (itemId === null) {
      koaContext.status = 400;
      koaContext.body = { error: 'invalid_request' };
      return;
    }

    try {
      const outcome = await feedbackLogic.addVote(database, itemId, accountExtId);
      if (outcome === 'no_such_item') {
        koaContext.status = 404;
        koaContext.body = { error: 'not_found' };
        return;
      }
      const voteCount = await feedbackLogic.countVotesForItem(database, itemId);
      koaContext.status = 200;
      koaContext.body = { voted: true, voteCount };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  // DELETE /api/feedback/:id/vote — retract an upvote (authenticated, no-op if the
  // caller had not voted). No body is involved, so no parser is mounted.
  router.delete('/api/feedback/:id/vote', async (koaContext) => {
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
    const accountExtId = sessionResult.value;

    const itemId = parseFeedbackItemId(koaContext.params.id);
    if (itemId === null) {
      koaContext.status = 400;
      koaContext.body = { error: 'invalid_request' };
      return;
    }

    try {
      // why: removeVote is a no-op when the account had not voted ('not_voted'); the
      // response is the same 200 { voted: false, voteCount } either way — a retract is
      // idempotent, so a double-DELETE is not an error.
      await feedbackLogic.removeVote(database, itemId, accountExtId);
      const voteCount = await feedbackLogic.countVotesForItem(database, itemId);
      koaContext.status = 200;
      koaContext.body = { voted: false, voteCount };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
