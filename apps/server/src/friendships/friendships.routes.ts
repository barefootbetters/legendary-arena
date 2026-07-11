/**
 * Friend-Request HTTP Routes — Server Layer (WP-351)
 *
 * Registers the six `/api/me/friends*` endpoints on the game-server
 * framework's Koa router — packet #2 of the Friends & Ranked Trust
 * subsystem. This module
 * is the translation layer between the public `@handle` identifier and
 * WP-350's `AccountId`-keyed friendship logic:
 *
 *   * POST   /api/me/friends/requests                 — send a request
 *   * GET    /api/me/friends                          — list friends
 *   * GET    /api/me/friends/requests                 — list pending
 *   * POST   /api/me/friends/requests/:handle/accept  — accept
 *   * POST   /api/me/friends/requests/:handle/decline — decline
 *   * DELETE /api/me/friends/:handle                  — unfriend
 *
 * Mirrors the WP-301 `loadoutLibrary.routes.ts` structural shape: local
 * `KoaRouter` / `KoaContext` interfaces, `requireAuthenticatedSession`
 * as the first business step on every handler, a `try/catch` so any
 * uncaught throw becomes a typed 500, and status + body + `Cache-Control`
 * set on every response path.
 *
 * It resolves the target `@handle` -> `AccountId` inbound
 * (`findAccountByHandle`) and enriches WP-350's `AccountId`-keyed
 * `FriendshipView`s into a client-facing `FriendSummary` (the friend's
 * `handle` + `displayName`) outbound — NEVER leaking a friend's
 * `AccountId` on the wire (FR-2).
 *
 * Layer-boundary contract: this module imports nothing from the game
 * engine, the registry, or any UI / client package. It imports WP-350's
 * `friendships.{logic,types}.js` read-only and does not modify them. The
 * `pg` driver is reachable only through the supplied `DatabaseClient`.
 *
 * Authority: WP-351 §Scope (In); EC-381 §Locked Values; D-24143;
 * D-9905 (Auth closed set); D-11504 (Cache-Control first statement);
 * D-11804 (api-endpoints catalog).
 */

import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type {
  AccountId,
  DatabaseClient,
  FriendshipStatus,
  FriendshipView,
} from './friendships.types.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
} from './friendships.logic.js';
import { findAccountByHandle, getHandleForAccount } from '../identity/handle.logic.js';
import {
  notifyFriendRequestReceived,
  notifyFriendRequestAccepted,
  type FriendshipNotificationConfig,
} from './friendshipNotifications.logic.js';

/**
 * Closed-set re-statement of the auth orchestrator's `Result<AccountId>`
 * shape, declared locally so this route module does not import the
 * identity layer for a type already reachable via the auth-layer types.
 * Mirrors the WP-301 `RequireAuthenticatedSessionResult` precedent.
 */
type FriendshipSessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

export type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: FriendshipSessionValidationCode };

/**
 * Caller-injected dependency bundle for `registerFriendshipRoutes`.
 * Mirrors `LoadoutLibraryRouteDependencies`: `requireAuthenticatedSession`
 * is the WP-112 orchestrator (or a test fake); `verifier` and
 * `accountResolver` are the broker-specific implementations passed
 * through at request time. Production wiring binds these once at startup
 * in `server.mjs`.
 */
export interface FriendshipRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  // why: WP-353 — OPTIONAL fire-and-forget friend-request email config.
  // Optional so WP-351's friendships.routes.test.ts (outside this
  // packet's allowlist) compiles unchanged; `server.mjs` always injects a
  // config (whose fields may themselves be undefined when Brevo is
  // unconfigured, in which case the notify functions no-op).
  readonly notificationConfig?: FriendshipNotificationConfig;
}

/**
 * The client-facing projection of one friendship from the acting
 * account's perspective. A friend is identified on the wire by `handle`
 * + `displayName` ONLY.
 *
 * why: `accountId` / `ext_id` / `player_id` are deliberately absent
 * (FR-2, mirroring `PublicProfileView`) — the `AccountId` is a
 * server-internal cross-service key and never crosses the wire.
 */
export interface FriendSummary {
  readonly handle: string;
  readonly displayName: string;
  readonly status: FriendshipStatus;
  readonly direction: 'incoming' | 'outgoing';
  readonly requestedAt: string;
  readonly respondedAt: string | null;
}

/**
 * Programmatic error codes for the friend-request API. Closed union: the
 * WP-350 `FriendshipErrorCode` values that can surface over HTTP plus the
 * route-layer codes (`unauthorized` / `invalid_request` / `handle_required`
 * / `handle_not_found`). `internal_error` is the structural 500 sentinel
 * and is deliberately NOT a member (mirrors the loadout precedent).
 *
 * Adding a code requires updating both this union and
 * `FRIEND_API_ERROR_CODES`; the drift test asserts forward and backward
 * inclusion.
 */
export type FriendApiErrorCode =
  | 'self_friendship'
  | 'already_pending'
  | 'already_friends'
  | 'no_pending_request'
  | 'not_addressee'
  | 'not_friends'
  | 'unknown_account'
  | 'unauthorized'
  | 'invalid_request'
  | 'handle_required'
  | 'handle_not_found';

/**
 * Canonical readonly array mirroring the `FriendApiErrorCode` union.
 * Adding a value requires updating both the union and this array in the
 * same change (see code-style §Drift Detection).
 */
export const FRIEND_API_ERROR_CODES: readonly FriendApiErrorCode[] = [
  'self_friendship',
  'already_pending',
  'already_friends',
  'no_pending_request',
  'not_addressee',
  'not_friends',
  'unknown_account',
  'unauthorized',
  'invalid_request',
  'handle_required',
  'handle_not_found',
] as const;

/**
 * Minimal structural shape of the Koa context surface this module
 * touches. Mirrors the WP-301 `KoaLoadoutContext` precedent plus a
 * `params` bag for the `:handle` path parameter.
 */
interface KoaFriendshipContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
}

/**
 * Minimal structural shape of the Koa router surface this module
 * touches. Matches the `@koa/router` method signatures for the six
 * registration sites below.
 */
interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaFriendshipContext) => Promise<void> | void,
  ): unknown;
  post(
    path: string,
    handler: (koaContext: KoaFriendshipContext) => Promise<void> | void,
  ): unknown;
  delete(
    path: string,
    handler: (koaContext: KoaFriendshipContext) => Promise<void> | void,
  ): unknown;
}

/**
 * Map a `FriendApiErrorCode` to its locked HTTP status per the WP-351
 * status-mapping table.
 */
function statusForFriendApiErrorCode(code: FriendApiErrorCode): number {
  if (code === 'unauthorized') {
    return 401;
  }
  if (code === 'invalid_request') {
    return 400;
  }
  if (
    code === 'handle_not_found' ||
    code === 'no_pending_request' ||
    code === 'not_friends'
  ) {
    return 404;
  }
  if (code === 'not_addressee') {
    return 403;
  }
  // why: handle_required, self_friendship, already_pending, already_friends,
  // and unknown_account are all request-vs-current-state conflicts → 409.
  return 409;
}

/**
 * One-round-trip enrichment: resolve a set of `FriendshipView`s into
 * `FriendSummary`s by swapping each view's `otherAccountId` for the
 * other party's `display_handle` + `display_name`.
 *
 * why: a single `WHERE ext_id = ANY($1)` lookup for the whole set, never
 * one query per row (no N+1). The acting account and its friends always
 * have claimed handles (the send route requires the actor's handle and
 * routes by the target's handle), so `display_handle` is non-null for
 * every resolved friend; a view whose account fails to resolve is
 * dropped defensively rather than emitted with a null handle.
 */
async function enrichFriendshipViews(
  database: DatabaseClient,
  views: readonly FriendshipView[],
): Promise<FriendSummary[]> {
  if (views.length === 0) {
    return [];
  }
  const accountIds: string[] = [];
  for (const view of views) {
    accountIds.push(view.otherAccountId);
  }
  const result = await database.query(
    'SELECT ext_id, display_handle, display_name FROM legendary.players ' +
      'WHERE ext_id = ANY($1::text[])',
    [accountIds],
  );
  const byAccountId = new Map<string, { handle: string; displayName: string }>();
  for (const row of result.rows) {
    if (row.display_handle !== null) {
      byAccountId.set(row.ext_id, {
        handle: row.display_handle,
        displayName: row.display_name,
      });
    }
  }
  const summaries: FriendSummary[] = [];
  for (const view of views) {
    const resolved = byAccountId.get(view.otherAccountId);
    if (resolved === undefined) {
      continue;
    }
    summaries.push({
      handle: resolved.handle,
      displayName: resolved.displayName,
      status: view.status,
      direction: view.direction,
      requestedAt: view.requestedAt,
      respondedAt: view.respondedAt,
    });
  }
  return summaries;
}

/**
 * Register the six friend-request routes on the supplied Koa router. The
 * router is mutated in place; the function returns `void`. Production
 * callers in `server.mjs` pass the Koa router from the game-server
 * framework's `Server({...})` instance, the long-lived `pg.Pool`, and the
 * dependency bundle with the WP-112 `requireAuthenticatedSession`
 * orchestrator.
 */
export function registerFriendshipRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: FriendshipRouteDependencies,
): void {
  // why: requireAuthenticatedSession is the first business step on every
  // route before any DB query, mirroring the WP-104/WP-301 caller-injected
  // pattern so production wires the real orchestrator and tests inject
  // fakes. The acting identity is ALWAYS the session-resolved AccountId,
  // never a body-supplied value.
  async function authenticate(
    koaContext: KoaFriendshipContext,
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

  // why: every friend-mutating action routes by @handle, so the acting
  // account must itself have a claimed handle — otherwise the other party
  // could never address them back. A handle-less actor is rejected with
  // handle_required (409) before any friendship write. Returns false and
  // sets the response when the actor has no handle; true otherwise.
  async function requireActingHandle(
    koaContext: KoaFriendshipContext,
    accountId: AccountId,
  ): Promise<boolean> {
    const handle = await getHandleForAccount(accountId, database);
    if (handle === null) {
      koaContext.status = statusForFriendApiErrorCode('handle_required');
      koaContext.body = { error: 'handle_required' };
      return false;
    }
    return true;
  }

  router.post('/api/me/friends/requests', async (koaContext) => {
    // why: Cache-Control MUST be the first statement so a thrown exception
    // still leaves the header set on the eventual 500 (D-11504); friend
    // responses must never be cached by an intermediate proxy.
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      if ((await requireActingHandle(koaContext, accountId)) === false) {
        return;
      }
      const rawBody = koaContext.request.body;
      const body =
        rawBody !== null && typeof rawBody === 'object'
          ? (rawBody as Record<string, unknown>)
          : {};
      const handleValue = body.handle;
      if (typeof handleValue !== 'string' || handleValue.trim().length === 0) {
        koaContext.status = statusForFriendApiErrorCode('invalid_request');
        koaContext.body = { error: 'invalid_request' };
        return;
      }
      const targetAccount = await findAccountByHandle(handleValue, database);
      if (targetAccount === null) {
        koaContext.status = statusForFriendApiErrorCode('handle_not_found');
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await sendFriendRequest(
        database,
        accountId,
        targetAccount.accountId,
      );
      if (result.ok === true) {
        const summaries = await enrichFriendshipViews(database, [result.value]);
        koaContext.status = 201;
        koaContext.body = summaries[0];
        // why: WP-353 — fire-and-forget the "request received" email to
        // the addressee. `void` (not awaited) so the notification never
        // gates the 201 response; the notify boundary is fail-open, so a
        // Brevo outage cannot fail the request.
        if (deps.notificationConfig !== undefined) {
          void notifyFriendRequestReceived(database, deps.notificationConfig, {
            actorAccountId: accountId,
            recipientAccountId: targetAccount.accountId,
          });
        }
        return;
      }
      koaContext.status = statusForFriendApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      // why: never re-throw to a global Koa handler — the server has no
      // error middleware beyond the framework defaults, so an uncaught
      // throw would surface as a bodyless 500. The caught value is
      // discarded because the 500 envelope is locked at internal_error.
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/friends', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await listFriends(database, accountId);
      if (result.ok === true) {
        const friends = await enrichFriendshipViews(database, result.value);
        koaContext.status = 200;
        koaContext.body = { friends };
        return;
      }
      koaContext.status = statusForFriendApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/friends/requests', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const incomingResult = await listIncomingRequests(database, accountId);
      if (incomingResult.ok === false) {
        koaContext.status = statusForFriendApiErrorCode(incomingResult.code);
        koaContext.body = { error: incomingResult.code };
        return;
      }
      const outgoingResult = await listOutgoingRequests(database, accountId);
      if (outgoingResult.ok === false) {
        koaContext.status = statusForFriendApiErrorCode(outgoingResult.code);
        koaContext.body = { error: outgoingResult.code };
        return;
      }
      const incoming = await enrichFriendshipViews(
        database,
        incomingResult.value,
      );
      const outgoing = await enrichFriendshipViews(
        database,
        outgoingResult.value,
      );
      koaContext.status = 200;
      koaContext.body = { incoming, outgoing };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.post('/api/me/friends/requests/:handle/accept', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      if ((await requireActingHandle(koaContext, accountId)) === false) {
        return;
      }
      const requesterAccount = await findAccountByHandle(
        koaContext.params.handle,
        database,
      );
      if (requesterAccount === null) {
        koaContext.status = statusForFriendApiErrorCode('handle_not_found');
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await acceptFriendRequest(
        database,
        accountId,
        requesterAccount.accountId,
      );
      if (result.ok === true) {
        const summaries = await enrichFriendshipViews(database, [result.value]);
        koaContext.status = 200;
        koaContext.body = summaries[0];
        // why: WP-353 — fire-and-forget the "request accepted" email to
        // the ORIGINAL requester (the actor here is the accepting
        // addressee). `void` + fail-open so the 200 is never delayed or
        // failed by the notification.
        if (deps.notificationConfig !== undefined) {
          void notifyFriendRequestAccepted(database, deps.notificationConfig, {
            actorAccountId: accountId,
            recipientAccountId: requesterAccount.accountId,
          });
        }
        return;
      }
      koaContext.status = statusForFriendApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.post('/api/me/friends/requests/:handle/decline', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      if ((await requireActingHandle(koaContext, accountId)) === false) {
        return;
      }
      const requesterAccount = await findAccountByHandle(
        koaContext.params.handle,
        database,
      );
      if (requesterAccount === null) {
        koaContext.status = statusForFriendApiErrorCode('handle_not_found');
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await declineFriendRequest(
        database,
        accountId,
        requesterAccount.accountId,
      );
      if (result.ok === true) {
        const summaries = await enrichFriendshipViews(database, [result.value]);
        koaContext.status = 200;
        koaContext.body = summaries[0];
        return;
      }
      koaContext.status = statusForFriendApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.delete('/api/me/friends/:handle', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      if ((await requireActingHandle(koaContext, accountId)) === false) {
        return;
      }
      const friendAccount = await findAccountByHandle(
        koaContext.params.handle,
        database,
      );
      if (friendAccount === null) {
        koaContext.status = statusForFriendApiErrorCode('handle_not_found');
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await removeFriend(
        database,
        accountId,
        friendAccount.accountId,
      );
      if (result.ok === true) {
        // why: 204 No Content — a successful unfriend returns no body.
        koaContext.status = 204;
        koaContext.body = null;
        return;
      }
      koaContext.status = statusForFriendApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
