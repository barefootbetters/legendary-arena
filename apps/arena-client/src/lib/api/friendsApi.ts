/**
 * Friends API Client — Arena Client (WP-352)
 *
 * Typed `fetch` wrappers for WP-351's six `/api/me/friends*` endpoints.
 * Consumed by the `useFriends` composable and, through it, by
 * `apps/arena-client/src/components/FriendsSection.vue` on `?route=me`.
 *
 * Layer-boundary contract: this module imports nothing from the game
 * engine, the registry, the pre-planning package, the boardgame
 * framework, or any server package (the verification grep in the EC
 * enforces the absence of those imports). The `FriendSummary` shape is
 * declared inline here by structural compatibility with its server-side
 * counterpart in the friendships routes module — the engine/server
 * isolation rule prohibits the client from importing server-layer types
 * directly. Mirrors the WP-104 `ownerProfileApi.ts` precedent verbatim.
 *
 * Authority: WP-352 §Scope (In) §A; EC-382 §Locked Values; D-24144;
 * WP-161 (`buildApiUrl`); WP-160 (bearer token).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * One friendship from the acting owner's perspective. Mirrors the
 * server-side `FriendSummary` (in the friendships routes module) by
 * structural compatibility — the server is authoritative on the shape;
 * this declaration is the type-level contract on the client.
 *
 * why: there is deliberately NO `accountId` field — the friend API never
 * sends one (FR-2). A friend is identified on the wire and on screen by
 * `handle` + `displayName` only.
 */
export interface FriendSummary {
  readonly handle: string;
  readonly displayName: string;
  readonly status: 'pending' | 'accepted' | 'declined';
  readonly direction: 'incoming' | 'outgoing';
  readonly requestedAt: string;
  readonly respondedAt: string | null;
}

// why: client-local mirror of the server's `FriendApiErrorCode` union
// (declared in the friendships routes module). The engine/server
// isolation rule forbids importing server-layer types directly, so the
// codes are mirrored here by hand; the drift test in friendsApi.test.ts
// asserts the two stay in sync (set-equality), failing loudly if the
// server union moves.
export const FRIEND_API_ERROR_CODES = [
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
 * Closed set of failure codes any friend endpoint may return in its
 * `{ error }` body. Client-local mirror of the server union (see
 * `FRIEND_API_ERROR_CODES`).
 */
export type FriendApiErrorCode = (typeof FRIEND_API_ERROR_CODES)[number];

/**
 * Result discriminator for the friend fetch wrappers. The success branch
 * carries the parsed value; the failure branch carries the HTTP status
 * plus a closed-set error code (or `null` for a network failure or an
 * unrecognized code). Mirrors `OwnerProfileApiResult`.
 */
export type FriendsApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: FriendApiErrorCode | null };

/**
 * Result discriminator for `removeFriend`, whose 204 success carries no
 * body. Same failure branch as `FriendsApiResult`.
 */
export type FriendsApiVoidResult =
  | { ok: true }
  | { ok: false; status: number; code: FriendApiErrorCode | null };

/**
 * The two pending-request lists returned by `GET /api/me/friends/requests`.
 */
export interface FriendRequestLists {
  readonly incoming: FriendSummary[];
  readonly outgoing: FriendSummary[];
}

/**
 * Narrow an unknown response-body `error` value to the closed friend
 * error-code set. Returns `null` when the value is absent, not a string,
 * or not one of the known codes.
 */
function narrowFriendApiCode(raw: unknown): FriendApiErrorCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  for (const knownCode of FRIEND_API_ERROR_CODES) {
    if (knownCode === raw) {
      return knownCode;
    }
  }
  return null;
}

/**
 * Parse a non-2xx friend response into the failure branch. Reads the
 * failure code from `body.error` (the shape every friend route uses).
 */
async function parseFriendFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: FriendApiErrorCode | null }> {
  let code: FriendApiErrorCode | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = narrowFriendApiCode(body.error);
  } catch {
    // why: a malformed or empty JSON body is a transport-level failure;
    // surface the status alone and leave the code null so the UI can
    // render a generic banner without crashing the promise chain.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/**
 * Build the request headers, attaching the bearer token only when it is
 * non-null. The JSON body routes add `Content-Type` separately.
 */
function authHeaders(authToken: string | null): Record<string, string> {
  return authToken === null ? {} : { Authorization: `Bearer ${authToken}` };
}

/**
 * List the caller's accepted friendships (`GET /api/me/friends`).
 */
export async function fetchFriends(
  authToken: string | null,
): Promise<FriendsApiResult<FriendSummary[]>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/friends'), {
      method: 'GET',
      headers: authHeaders(authToken),
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFriendFailure(response);
  }
  const body = (await response.json()) as { friends: FriendSummary[] };
  return { ok: true, value: body.friends };
}

/**
 * List the caller's pending incoming + outgoing requests
 * (`GET /api/me/friends/requests`).
 */
export async function fetchFriendRequests(
  authToken: string | null,
): Promise<FriendsApiResult<FriendRequestLists>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/friends/requests'), {
      method: 'GET',
      headers: authHeaders(authToken),
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFriendFailure(response);
  }
  const body = (await response.json()) as FriendRequestLists;
  return { ok: true, value: { incoming: body.incoming, outgoing: body.outgoing } };
}

/**
 * Send a friend request by `@handle` (`POST /api/me/friends/requests`).
 * Returns the new pending `FriendSummary` on 201.
 */
export async function sendFriendRequest(
  authToken: string | null,
  handle: string,
): Promise<FriendsApiResult<FriendSummary>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/friends/requests'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
      body: JSON.stringify({ handle }),
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 201) {
    return await parseFriendFailure(response);
  }
  const value = (await response.json()) as FriendSummary;
  return { ok: true, value };
}

/**
 * Accept a pending incoming request from a `@handle`
 * (`POST /api/me/friends/requests/:handle/accept`). Returns the accepted
 * `FriendSummary` on 200.
 */
export async function acceptFriendRequest(
  authToken: string | null,
  handle: string,
): Promise<FriendsApiResult<FriendSummary>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/friends/requests/${encodeURIComponent(handle)}/accept`),
      { method: 'POST', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFriendFailure(response);
  }
  const value = (await response.json()) as FriendSummary;
  return { ok: true, value };
}

/**
 * Decline a pending incoming request from a `@handle`
 * (`POST /api/me/friends/requests/:handle/decline`). Returns the declined
 * `FriendSummary` on 200.
 */
export async function declineFriendRequest(
  authToken: string | null,
  handle: string,
): Promise<FriendsApiResult<FriendSummary>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/friends/requests/${encodeURIComponent(handle)}/decline`),
      { method: 'POST', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFriendFailure(response);
  }
  const value = (await response.json()) as FriendSummary;
  return { ok: true, value };
}

/**
 * Remove an accepted friendship by `@handle` (`DELETE /api/me/friends/:handle`).
 * Returns `{ ok: true }` on 204 (no body).
 */
export async function removeFriend(
  authToken: string | null,
  handle: string,
): Promise<FriendsApiVoidResult> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/friends/${encodeURIComponent(handle)}`),
      { method: 'DELETE', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 204) {
    return await parseFriendFailure(response);
  }
  return { ok: true };
}
