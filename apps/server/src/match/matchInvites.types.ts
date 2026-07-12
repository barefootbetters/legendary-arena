/**
 * Match Invite Types — Server Layer (WP-358)
 *
 * Durable contracts for the match friend-invite subsystem (the lobby-invite
 * half of the Friends & Ranked Trust packet #5). A seated player invites an
 * accepted friend into their match; the friend gets a persistent pending
 * invite (+ a fail-open email) and, on accept, the `matchId` to join through
 * the existing `POST /api/match/join`.
 *
 * This module belongs to the server layer only. It must not be imported from
 * `packages/game-engine/**`, `packages/registry/**`, `apps/arena-client/**`,
 * or any client package. `AccountId` / `DatabaseClient` are re-imported from
 * `../identity/identity.types.js` per D-5201 — never redeclared.
 *
 * Authority: WP-358 §Scope (In) §B; EC-388 §Locked Values; D-24150.
 */

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

export type { AccountId, DatabaseClient };

/**
 * Closed status set for a match invite. Mirrored by `MATCH_INVITE_STATUSES`;
 * adding a value requires updating both (drift-tested).
 */
export type MatchInviteStatus = 'pending' | 'accepted' | 'declined';

/**
 * Canonical readonly array mirroring the `MatchInviteStatus` union.
 */
export const MATCH_INVITE_STATUSES: readonly MatchInviteStatus[] = [
  'pending',
  'accepted',
  'declined',
] as const;

/**
 * Client-facing projection of one match invite from the invitee's
 * perspective. The inviter is identified by `handle` + `displayName` ONLY —
 * `accountId` / `ext_id` / `player_id` are deliberately absent (FR-2).
 */
export interface MatchInviteView {
  readonly matchId: string;
  readonly inviterHandle: string;
  readonly inviterDisplayName: string;
  readonly status: MatchInviteStatus;
  readonly createdAt: string;
}

/**
 * Programmatic domain error codes for the match-invite logic layer. The
 * route layer adds the transport codes (`unauthorized` / `invalid_request` /
 * `handle_not_found`) in `MatchInviteApiErrorCode`. Adding a code requires
 * updating both this union and `MATCH_INVITE_ERROR_CODES` (drift-tested).
 */
export type MatchInviteErrorCode =
  | 'self_invite'
  | 'not_in_match'
  | 'not_friends'
  | 'already_invited'
  | 'invite_not_found'
  | 'unknown_account';

/**
 * Canonical readonly array mirroring the `MatchInviteErrorCode` union.
 */
export const MATCH_INVITE_ERROR_CODES: readonly MatchInviteErrorCode[] = [
  'self_invite',
  'not_in_match',
  'not_friends',
  'already_invited',
  'invite_not_found',
  'unknown_account',
] as const;

/**
 * Discriminated-union result for fallible match-invite operations. Mirrors
 * WP-350's `Result<T>` shape with the match-invite error union.
 */
export type MatchInviteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: MatchInviteErrorCode };
