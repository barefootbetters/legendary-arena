/**
 * Match Invites API Client — Arena Client (WP-360)
 *
 * Typed `fetch` wrappers for the invitee-side match-invite endpoints:
 *
 *   * GET  /api/me/match-invites                  — list pending invites
 *   * POST /api/me/match-invites/:matchId/accept  — accept (returns { matchId })
 *   * POST /api/me/match-invites/:matchId/decline — decline
 *
 * Consumed by `useMatchInvites` / `MatchInvitesSection.vue`. The `MatchInviteView`
 * shape is mirrored inline by structural compatibility with the server
 * `apps/server/src/match/matchInvites.types.ts#MatchInviteView` — the
 * engine/server-isolation rule forbids importing server-layer types (mirrors
 * the WP-352 `friendsApi.ts` precedent). NO `accountId` on the wire (FR-2).
 *
 * The inviter-side invite trigger + the full seat-selecting join-from-invite
 * are a deferred follow-on (they need the in-match play-view context); this
 * module ships the invitee-side reads/actions only.
 *
 * Authority: WP-360 §Scope; D-24152; WP-161 (`buildApiUrl`); WP-160 (bearer).
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * One pending match invite from the invitee's perspective. Mirrors the
 * server `MatchInviteView` — the inviter is identified by `handle` +
 * `displayName` only (NO `accountId` — FR-2).
 */
export interface MatchInviteView {
  readonly matchId: string;
  readonly inviterHandle: string;
  readonly inviterDisplayName: string;
  readonly status: 'pending' | 'accepted' | 'declined';
  readonly createdAt: string;
}

// why: client-local mirror of the server's `MatchInviteApiErrorCode` union in
// apps/server/src/match/matchInvites.routes.ts. The engine/server-isolation
// rule forbids importing server-layer types, so the codes are mirrored here;
// the drift test in matchInvitesApi.test.ts asserts set-equality with the
// server union, failing loudly if it moves.
export const MATCH_INVITE_API_ERROR_CODES = [
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
 * Closed set of failure codes the match-invite endpoints may return in their
 * `{ error }` body. Client-local mirror of the server union.
 */
export type MatchInviteApiErrorCode = (typeof MATCH_INVITE_API_ERROR_CODES)[number];

/**
 * Result discriminator for the match-invite fetch wrappers. Mirrors
 * `FriendsApiResult`.
 */
export type MatchInvitesApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: MatchInviteApiErrorCode | null };

/**
 * Result discriminator for `declineMatchInvite`, whose 204 success carries no
 * body.
 */
export type MatchInvitesApiVoidResult =
  | { ok: true }
  | { ok: false; status: number; code: MatchInviteApiErrorCode | null };

/**
 * Narrow an unknown response-body `error` value to the closed error-code set.
 */
function narrowMatchInviteCode(raw: unknown): MatchInviteApiErrorCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  for (const knownCode of MATCH_INVITE_API_ERROR_CODES) {
    if (knownCode === raw) {
      return knownCode;
    }
  }
  return null;
}

/**
 * Parse a non-2xx match-invite response into the failure branch (reads
 * `body.error`).
 */
async function parseMatchInviteFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: MatchInviteApiErrorCode | null }> {
  let code: MatchInviteApiErrorCode | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    code = narrowMatchInviteCode(body.error);
  } catch {
    // why: a malformed/empty body is a transport failure; surface the status
    // alone and leave the code null so the UI shows a generic banner.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/** Build headers, attaching the bearer token only when non-null. */
function authHeaders(authToken: string | null): Record<string, string> {
  return authToken === null ? {} : { Authorization: `Bearer ${authToken}` };
}

/**
 * List the caller's pending incoming match invites (`GET /api/me/match-invites`).
 */
export async function fetchMatchInvites(
  authToken: string | null,
): Promise<MatchInvitesApiResult<MatchInviteView[]>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/match-invites'), {
      method: 'GET',
      headers: authHeaders(authToken),
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseMatchInviteFailure(response);
  }
  const body = (await response.json()) as { invites: MatchInviteView[] };
  return { ok: true, value: body.invites };
}

/**
 * Accept a pending invite (`POST /api/me/match-invites/:matchId/accept`).
 * Returns the `matchId` on 200 — the client then joins via the lobby.
 */
export async function acceptMatchInvite(
  authToken: string | null,
  matchId: string,
): Promise<MatchInvitesApiResult<{ matchId: string }>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/match-invites/${encodeURIComponent(matchId)}/accept`),
      { method: 'POST', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseMatchInviteFailure(response);
  }
  const value = (await response.json()) as { matchId: string };
  return { ok: true, value };
}

/**
 * Decline a pending invite (`POST /api/me/match-invites/:matchId/decline`).
 * 204 on success.
 */
export async function declineMatchInvite(
  authToken: string | null,
  matchId: string,
): Promise<MatchInvitesApiVoidResult> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/match-invites/${encodeURIComponent(matchId)}/decline`),
      { method: 'POST', headers: authHeaders(authToken) },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 204) {
    return await parseMatchInviteFailure(response);
  }
  return { ok: true };
}
