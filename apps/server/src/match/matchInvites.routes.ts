/**
 * Match Invite HTTP Routes — Server Layer (WP-358)
 *
 * Registers the four `authenticated-session-required` match-invite endpoints
 * — the lobby-invite half of the Friends & Ranked Trust packet #5:
 *
 *   * POST /api/match/invites                      — invite a friend {matchId, handle}
 *   * GET  /api/me/match-invites                   — list pending incoming invites
 *   * POST /api/me/match-invites/:matchId/accept   — accept (returns { matchId })
 *   * POST /api/me/match-invites/:matchId/decline  — decline
 *
 * Mirrors the WP-351 `friendships.routes.ts` shape: local `KoaRouter` /
 * `KoaContext` interfaces, `requireAuthenticatedSession` first on every
 * handler, `Cache-Control: no-store` as the first statement, a `try/catch`
 * that turns any uncaught throw into a typed 500. It resolves the target
 * `@handle` -> `AccountId` inbound (`findAccountByHandle`), delegates to
 * `matchInvites.logic.ts`, and fires a fail-open invite email fire-and-forget.
 *
 * Accept returns `{ matchId }` — the client joins via the existing
 * `POST /api/match/join`; this module performs NO boardgame.io join.
 *
 * Layer-boundary contract: imports nothing from the game engine, the
 * registry, or `boardgame.io`. `pg` is reachable only through the supplied
 * `DatabaseClient`.
 *
 * Authority: WP-358 §Scope (In) §E; EC-388; D-24150; D-9905 (Auth closed
 * set); D-11504 (Cache-Control first); D-11804 (catalog).
 */

import koaBody from 'koa-body';

import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type {
  AccountId,
  DatabaseClient,
  MatchInviteErrorCode,
} from './matchInvites.types.js';
import {
  createMatchInvite,
  listIncomingMatchInvites,
  acceptMatchInvite,
  declineMatchInvite,
} from './matchInvites.logic.js';
import {
  notifyMatchInvite,
  type MatchInviteNotificationConfig,
} from './matchInviteNotifications.logic.js';
import { findAccountByHandle } from '../identity/handle.logic.js';

/**
 * Closed-set re-statement of the auth orchestrator's `Result<AccountId>`
 * shape, declared locally (mirrors the WP-351 precedent).
 */
type MatchInviteSessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

export type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: MatchInviteSessionValidationCode };

/**
 * Caller-injected dependency bundle for `registerMatchInviteRoutes`.
 * `requireAuthenticatedSession` is the WP-112 orchestrator (or a test fake);
 * `notificationConfig` carries the fail-open Brevo sender + template id.
 */
export interface MatchInviteRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly notificationConfig?: MatchInviteNotificationConfig;
}

/**
 * Route-layer error union: the surfacing `MatchInviteErrorCode` domain codes
 * plus the transport codes. `internal_error` is the structural 500 sentinel
 * and is deliberately NOT a member. Drift-tested against
 * `MATCH_INVITE_API_ERROR_CODES`.
 */
export type MatchInviteApiErrorCode =
  | MatchInviteErrorCode
  | 'unauthorized'
  | 'invalid_request'
  | 'handle_not_found';

/**
 * Canonical readonly array mirroring `MatchInviteApiErrorCode`.
 */
export const MATCH_INVITE_API_ERROR_CODES: readonly MatchInviteApiErrorCode[] = [
  'self_invite',
  'not_in_match',
  'not_friends',
  'already_invited',
  'invite_not_found',
  'unknown_account',
  'unauthorized',
  'invalid_request',
  'handle_not_found',
] as const;

/**
 * Minimal Koa context shape this module touches (mirrors the WP-351
 * precedent) plus a `params` bag for `:matchId`.
 */
interface KoaMatchInviteContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaMatchInviteContext) => Promise<void> | void,
  ): unknown;
  post(
    path: string,
    handler: (koaContext: KoaMatchInviteContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `MatchInviteApiErrorCode` to its HTTP status.
 */
function statusForMatchInviteApiErrorCode(code: MatchInviteApiErrorCode): number {
  if (code === 'unauthorized') {
    return 401;
  }
  if (code === 'invalid_request') {
    return 400;
  }
  if (code === 'handle_not_found' || code === 'invite_not_found') {
    return 404;
  }
  // why: not_in_match and not_friends are forbidden actions (403) — the caller
  // is authenticated but not permitted to invite here.
  if (code === 'not_in_match' || code === 'not_friends') {
    return 403;
  }
  // why: self_invite, already_invited, and unknown_account are
  // request-vs-current-state conflicts -> 409.
  return 409;
}

/**
 * Register the four match-invite routes on the supplied Koa router (mutated
 * in place). Production callers pass the game-server framework's router, the
 * long-lived `pg.Pool`, and the dependency bundle.
 */
// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there
// is no global body parser (same note as matchGate/billing/analytics/…) — so
// this custom /api route must parse its own JSON body. Without it,
// `koaContext.request.body` is undefined and invite-by-@handle silently fails.
// Latent: the handler was only tested with an injected `request.body`, never
// the real Node request stream (the WP-307/matchGate trap).
const jsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for a fake test context — mirrors
 * matchGate's `ensureJsonBodyParsed`.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaMatchInviteContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    jsonBodyParser as unknown as (
      koaContext: KoaMatchInviteContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

export function registerMatchInviteRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: MatchInviteRouteDependencies,
): void {
  // why: requireAuthenticatedSession is the first business step on every
  // route; the acting identity is ALWAYS the session-resolved AccountId,
  // never a body-supplied value.
  async function authenticate(
    koaContext: KoaMatchInviteContext,
  ): Promise<AccountId | null> {
    const result = await deps.requireAuthenticatedSession(koaContext.req, {
      verifier: deps.verifier,
      accountResolver: deps.accountResolver,
      database,
    });
    if (result.ok === true) {
      return result.value;
    }
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

  router.post('/api/match/invites', async (koaContext) => {
    // why: Cache-Control first so a thrown exception still leaves the header
    // set on the eventual 500 (D-11504).
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
      const matchIdValue = body.matchId;
      const handleValue = body.handle;
      if (
        typeof matchIdValue !== 'string' ||
        matchIdValue.trim().length === 0 ||
        typeof handleValue !== 'string' ||
        handleValue.trim().length === 0
      ) {
        koaContext.status = statusForMatchInviteApiErrorCode('invalid_request');
        koaContext.body = { error: 'invalid_request' };
        return;
      }
      const targetAccount = await findAccountByHandle(handleValue, database);
      if (targetAccount === null) {
        koaContext.status = statusForMatchInviteApiErrorCode('handle_not_found');
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await createMatchInvite(
        database,
        accountId,
        targetAccount.accountId,
        matchIdValue,
      );
      if (result.ok === true) {
        koaContext.status = 201;
        koaContext.body = result.value;
        // why: fire-and-forget the invite email to the invitee. `void` (not
        // awaited) so the notification never gates the 201; the notify
        // boundary is fail-open, so a Brevo outage cannot fail the invite.
        if (deps.notificationConfig !== undefined) {
          void notifyMatchInvite(database, deps.notificationConfig, {
            inviterAccountId: accountId,
            inviteeAccountId: targetAccount.accountId,
            matchId: matchIdValue,
          });
        }
        return;
      }
      koaContext.status = statusForMatchInviteApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/match-invites', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await listIncomingMatchInvites(database, accountId);
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = { invites: result.value };
        return;
      }
      koaContext.status = statusForMatchInviteApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.post('/api/me/match-invites/:matchId/accept', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const matchId = koaContext.params.matchId ?? '';
      const result = await acceptMatchInvite(database, accountId, matchId);
      if (result.ok === true) {
        // why: accept returns the matchId; the client joins via the existing
        // POST /api/match/join. No server-side bgio join / credential mint.
        koaContext.status = 200;
        koaContext.body = { matchId };
        return;
      }
      koaContext.status = statusForMatchInviteApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.post('/api/me/match-invites/:matchId/decline', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const matchId = koaContext.params.matchId ?? '';
      const result = await declineMatchInvite(database, accountId, matchId);
      if (result.ok === true) {
        koaContext.status = 204;
        koaContext.body = undefined;
        return;
      }
      koaContext.status = statusForMatchInviteApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
