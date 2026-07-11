/**
 * Friendship Types — Server Layer (WP-350)
 *
 * Durable contracts for the peer-to-peer friendship graph — packet #1
 * of the Friends & Ranked Trust subsystem
 * (`wiki/profile-login.md §Friends & Ranked Trust Layer`). These types
 * form the wire shape and result contract consumed by the friend-request
 * API (packet #2, `/api/me/friends*`) and, transitively, the profile
 * Friends-tab UI (packet #3) and the ranked-eligibility gate (packet #5,
 * via the clique helper). Field shapes, names, and order are locked
 * under D-24142.
 *
 * This module belongs to the server layer only. It must not be imported
 * from `packages/game-engine/**`, `packages/registry/**`,
 * `packages/preplan/**`, `packages/vue-sfc-loader/**`, or any UI /
 * client / replay-producer package. It adds no new cross-layer import:
 * `AccountId` and `DatabaseClient` are re-imported from
 * `../identity/identity.types.js` (same layer, WP-052 D-5201 contract),
 * never redeclared.
 *
 * `FriendshipResult<T>` is declared locally — WP-052's `Result<T>` is
 * keyed on `IdentityErrorCode` which cannot carry the friendship codes;
 * this mirrors the WP-104 `OwnerProfileResult<T>` PS-5 precedent
 * verbatim (same `ok` discriminant, same `value` / `reason` / `code`
 * fields, friendship-specific error union).
 *
 * Identity anchor (FR-2 / FR-3): every relationship, request, and lookup
 * is keyed on `AccountId` (`ext_id`). The table stores the internal
 * `player_id`; `display_name` and `handle_canonical` are NEVER
 * friendship keys, and no friendship type carries `player_id`,
 * `friendship_id`, or `display_name` on the wire.
 *
 * Authority: WP-350 §Scope (In) §B; EC-380 §Locked Values; D-24142.
 */

import type {
  AccountId,
  DatabaseClient,
} from '../identity/identity.types.js';

// why: re-exported so `friendships.logic.ts` and the tests can reference
// the identity-layer aliases through `./friendships.types.js` without
// re-importing from the identity module directly, preserving the single
// import boundary documented above. Mirrors the WP-104
// `ownerProfile.types.ts` re-export precedent.
export type { AccountId, DatabaseClient };

/**
 * The lifecycle state of a friendship row. Closed set per D-24142:
 * `'pending'` (request sent, awaiting the addressee), `'accepted'`
 * (a symmetric friendship), `'declined'` (the addressee refused; a
 * later `sendFriendRequest` transitions it back to `'pending'` via
 * UPDATE, never a second row).
 *
 * `'blocked'` is deliberately NOT a member: blocking is orthogonal to
 * friendship and gets its own persistence model in a later packet.
 * Adding a value requires updating both this union and
 * `FRIENDSHIP_STATUSES` in the same change plus a DECISIONS.md entry;
 * the drift test asserts forward and backward inclusion.
 */
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

/**
 * Canonical readonly array mirroring the `FriendshipStatus` union.
 * Adding a value requires updating both the union and this array in the
 * same change (see code-style §Drift Detection). The drift-detection
 * test asserts forward and backward inclusion, and the DB CHECK in
 * migration 028 mirrors the same closed set.
 */
export const FRIENDSHIP_STATUSES: readonly FriendshipStatus[] = [
  'pending',
  'accepted',
  'declined',
] as const;

/**
 * A single friendship row projected from a given viewer's perspective.
 * Composed by the list / send / accept / decline helpers from a
 * `legendary.friendships` row plus the viewer's own `player_id`.
 *
 * `otherAccountId` is the OTHER party's `AccountId` (`ext_id`) — the
 * account that is not the viewer. `direction` records whether the
 * viewer received (`'incoming'`) or sent (`'outgoing'`) the underlying
 * request, derived from whether the viewer is the row's `addressee_id`
 * or `requester_id`.
 *
 * The wire shape EXCLUDES `player_id`, `friendship_id`, and
 * `display_name` — all three are server-internal or belong to a
 * different surface. Adding any of them requires a new decision.
 */
export interface FriendshipView {
  readonly otherAccountId: AccountId;
  readonly status: FriendshipStatus;
  readonly direction: 'incoming' | 'outgoing';
  readonly requestedAt: string;
  readonly respondedAt: string | null;
}

/**
 * Programmatic error codes for fallible friendship operations. Closed
 * union: callers dispatch on `code` without parsing prose `reason`
 * strings.
 *
 * `'unknown_account'` is returned when one OR MORE supplied `AccountId`s
 * fail to resolve to a `player_id`; it deliberately does not reveal
 * WHICH account failed (no account-existence enumeration — consistent
 * with the WP-102 `player_not_found` single-code posture).
 *
 * Adding a code requires updating both this union and
 * `FRIENDSHIP_ERROR_CODES` in the same change; the drift-detection test
 * asserts forward and backward inclusion.
 */
export type FriendshipErrorCode =
  | 'unknown_account'
  | 'self_friendship'
  | 'already_pending'
  | 'already_friends'
  | 'no_pending_request'
  | 'not_addressee'
  | 'not_friends';

/**
 * Canonical readonly array mirroring the `FriendshipErrorCode` union.
 * Adding a value requires updating both the union and this array in the
 * same change (see code-style §Drift Detection).
 */
export const FRIENDSHIP_ERROR_CODES: readonly FriendshipErrorCode[] = [
  'unknown_account',
  'self_friendship',
  'already_pending',
  'already_friends',
  'no_pending_request',
  'not_addressee',
  'not_friends',
] as const;

/**
 * Discriminated-union result type for fallible friendship operations.
 * The `ok: true` branch carries the success value; the `ok: false`
 * branch carries a full-sentence `reason` string (per code-style
 * Rule 11) and a programmatic `code` for caller-side dispatch without
 * prose parsing.
 *
 * Declared locally rather than re-imported from
 * `../identity/identity.types.js`: WP-052's `Result<T>` is keyed on
 * `IdentityErrorCode` and cannot carry the friendship codes. The shape
 * mirrors it exactly per the WP-104 `OwnerProfileResult<T>` precedent.
 */
export type FriendshipResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: FriendshipErrorCode };
