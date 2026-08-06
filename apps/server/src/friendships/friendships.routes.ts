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
  FriendshipStatus,
  FriendshipView,
} from './friendships.types.js';
import type { PlayerAccount } from '../identity/identity.types.js';
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
// why: WP-504 — the add-friend route now also accepts a target by AccountId.
// `isWellFormedAccountId` screens malformed UUIDs before a DB round-trip and
// `findPlayerByAccountId` resolves the AccountId to a PlayerAccount (the twin
// of `findAccountByHandle` for the handle path). Same server layer; no new
// cross-layer import.
import {
  findPlayerByAccountId,
  isWellFormedAccountId,
} from '../identity/identity.logic.js';
import {
  notifyFriendRequestReceived,
  notifyFriendRequestAccepted,
  type FriendshipNotificationConfig,
} from './friendshipNotifications.logic.js';
// why: WP-355 — the block model + the three send-guard primitives (block,
// re-request cooldown, daily rate limit) enforced before sendFriendRequest,
// plus the three block endpoints mounted below. Same-layer server module;
// no new cross-layer import.
import {
  blockPlayer,
  unblockPlayer,
  listBlocks,
  isEitherBlocked,
  countOutgoingPendingSince,
  mostRecentDeclineAgainst,
  type BlockApiErrorCode,
} from './playerBlocks.logic.js';

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
  | 'handle_not_found'
  // why: WP-504 (D-24308) — a well-formed but unknown AccountId on the
  // add-by-AccountId path is a not-found, distinct from invalid_request
  // (malformed) and handle_not_found (the handle path). Maps to 404.
  | 'account_not_found'
  // why: WP-355 (D-24147) — the three abuse-control send-guard codes,
  // added additively to WP-351's union (the six existing endpoint shapes
  // are otherwise byte-identical).
  | 'blocked'
  | 'rate_limited'
  | 'request_cooldown';

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
  'account_not_found',
  'blocked',
  'rate_limited',
  'request_cooldown',
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
    code === 'account_not_found' ||
    code === 'no_pending_request' ||
    code === 'not_friends'
  ) {
    return 404;
  }
  // why: WP-355 — a blocked pair is a forbidden action (403); the rate
  // limit and the re-request cooldown are both "too many requests" (429).
  if (code === 'blocked' || code === 'not_addressee') {
    return 403;
  }
  if (code === 'rate_limited' || code === 'request_cooldown') {
    return 429;
  }
  // why: handle_required, self_friendship, already_pending, already_friends,
  // and unknown_account are all request-vs-current-state conflicts → 409.
  return 409;
}

// why: WP-355 (D-24147) — the daily outgoing-request cap. A sender at or
// over this many `pending` requests in the trailing 24h is rate_limited.
const MAX_OUTGOING_PENDING_PER_DAY = 20;

// why: WP-355 (D-24147) — re-request cooldown. Re-sending to a player who
// declined you within this many hours is refused (request_cooldown).
const REREQUEST_COOLDOWN_HOURS = 24;

/**
 * Map a `BlockApiErrorCode` (block CRUD) to its HTTP status. The route
 * also handles the structural codes `unauthorized` (401) /
 * `invalid_request` (400) / `handle_not_found` (404) inline.
 */
function statusForBlockApiErrorCode(code: BlockApiErrorCode): number {
  if (code === 'not_blocked') {
    return 404;
  }
  // why: self_block, already_blocked, and unknown_account are all
  // request-vs-current-state conflicts → 409.
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
// why: boardgame.io installs koa-body ONLY on its own /games/* routes — there
// is no global body parser (same note as matchGate/billing/analytics/…) — so
// these custom /api routes must parse their own JSON body. Without it,
// `koaContext.request.body` is undefined and add-friend-by-@handle / block
// silently fail. Latent: the handlers were only tested with an injected
// `request.body`, never the real Node request stream (the WP-307/matchGate trap).
const jsonBodyParser = koaBody();

/**
 * Parse the JSON request body into `koaContext.request.body` when a real Node
 * request stream is present. A no-op for a fake test context — mirrors
 * matchGate's `ensureJsonBodyParsed`.
 */
async function ensureJsonBodyParsed(
  koaContext: KoaFriendshipContext,
): Promise<void> {
  const nodeRequest = koaContext.req as { on?: unknown };
  if (typeof nodeRequest.on !== 'function') {
    return;
  }
  await (
    jsonBodyParser as unknown as (
      koaContext: KoaFriendshipContext,
      next: () => Promise<void>,
    ) => Promise<void>
  )(koaContext, async () => {});
}

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
      await ensureJsonBodyParsed(koaContext);
      const rawBody = koaContext.request.body;
      const body =
        rawBody !== null && typeof rawBody === 'object'
          ? (rawBody as Record<string, unknown>)
          : {};
      const handleValue = body.handle;
      const accountIdValue = body.accountId;
      const hasHandle =
        typeof handleValue === 'string' && handleValue.trim().length > 0;
      const hasAccountId =
        typeof accountIdValue === 'string' &&
        accountIdValue.trim().length > 0;
      // why: exactly one identifier is accepted — supplying both is
      // ambiguous and supplying neither is empty; either case is a 400
      // invalid_request before any target resolution.
      if (hasHandle === hasAccountId) {
        koaContext.status = statusForFriendApiErrorCode('invalid_request');
        koaContext.body = { error: 'invalid_request' };
        return;
      }

      // Resolve the target by whichever identifier was supplied. Both
      // resolvers return a PlayerAccount; from here the two paths are
      // identical — the resolved targetAccount funnels into the unchanged
      // WP-355 block/cooldown/rate-limit chain and sendFriendRequest.
      let targetAccount: PlayerAccount;
      if (hasHandle === true) {
        const resolvedByHandle = await findAccountByHandle(
          handleValue as string,
          database,
        );
        if (resolvedByHandle === null) {
          koaContext.status = statusForFriendApiErrorCode('handle_not_found');
          koaContext.body = { error: 'handle_not_found' };
          return;
        }
        targetAccount = resolvedByHandle;
      } else {
        // why: reject a malformed AccountId as invalid_request without a DB
        // round-trip — findPlayerByAccountId is the authority on existence,
        // not this shape guard.
        if (isWellFormedAccountId(accountIdValue as string) === false) {
          koaContext.status = statusForFriendApiErrorCode('invalid_request');
          koaContext.body = { error: 'invalid_request' };
          return;
        }
        const resolvedByAccountId = await findPlayerByAccountId(
          accountIdValue as AccountId,
          database,
        );
        // why: a well-formed but unknown AccountId is a not-found the client
        // renders as inline copy — distinct from invalid_request (malformed).
        if (resolvedByAccountId === null) {
          koaContext.status = statusForFriendApiErrorCode('account_not_found');
          koaContext.body = { error: 'account_not_found' };
          return;
        }
        targetAccount = resolvedByAccountId;
      }

      // why: WP-355 (D-24147) — the three abuse-control guards, in the
      // locked order block → cooldown → rate limit, ALL before
      // sendFriendRequest. A blocked pair (either direction) is forbidden;
      // a re-send within the cooldown of a decline is refused; a sender
      // over the daily cap is rate-limited.
      if (await isEitherBlocked(database, accountId, targetAccount.accountId)) {
        koaContext.status = statusForFriendApiErrorCode('blocked');
        koaContext.body = { error: 'blocked' };
        return;
      }
      const lastDeclineIso = await mostRecentDeclineAgainst(
        database,
        accountId,
        targetAccount.accountId,
      );
      if (lastDeclineIso !== null) {
        // why: server-layer clock read (NOT engine — determinism is an
        // engine-only invariant). A decline whose age is under the cooldown
        // window blocks a re-send.
        const cooldownMs = REREQUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
        const declineAgeMs = Date.now() - new Date(lastDeclineIso).getTime();
        if (declineAgeMs < cooldownMs) {
          koaContext.status = statusForFriendApiErrorCode('request_cooldown');
          koaContext.body = { error: 'request_cooldown' };
          return;
        }
      }
      // why: server-layer clock read — the trailing 24h window start.
      const windowStartIso = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const outgoingPending = await countOutgoingPendingSince(
        database,
        accountId,
        windowStartIso,
      );
      if (outgoingPending >= MAX_OUTGOING_PENDING_PER_DAY) {
        koaContext.status = statusForFriendApiErrorCode('rate_limited');
        koaContext.body = { error: 'rate_limited' };
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

  // --- WP-355 block endpoints (D-24147) ---

  router.post('/api/me/blocks', async (koaContext) => {
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
      const handleValue = body.handle;
      if (typeof handleValue !== 'string' || handleValue.trim().length === 0) {
        koaContext.status = 400;
        koaContext.body = { error: 'invalid_request' };
        return;
      }
      const targetAccount = await findAccountByHandle(handleValue, database);
      if (targetAccount === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await blockPlayer(
        database,
        accountId,
        targetAccount.accountId,
      );
      if (result.ok === true) {
        koaContext.status = 201;
        koaContext.body = result.value;
        return;
      }
      koaContext.status = statusForBlockApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.delete('/api/me/blocks/:handle', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const targetAccount = await findAccountByHandle(
        koaContext.params.handle,
        database,
      );
      if (targetAccount === null) {
        koaContext.status = 404;
        koaContext.body = { error: 'handle_not_found' };
        return;
      }
      const result = await unblockPlayer(
        database,
        accountId,
        targetAccount.accountId,
      );
      if (result.ok === true) {
        // why: 204 No Content — a successful unblock returns no body.
        koaContext.status = 204;
        koaContext.body = null;
        return;
      }
      koaContext.status = statusForBlockApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });

  router.get('/api/me/blocks', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      const accountId = await authenticate(koaContext);
      if (accountId === null) {
        return;
      }
      const result = await listBlocks(database, accountId);
      if (result.ok === true) {
        koaContext.status = 200;
        koaContext.body = { blocked: result.value };
        return;
      }
      koaContext.status = statusForBlockApiErrorCode(result.code);
      koaContext.body = { error: result.code };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { error: 'internal_error' };
    }
  });
}
