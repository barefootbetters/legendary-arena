/**
 * Handle Claim Types — Server Layer (WP-101)
 *
 * Durable contracts for the user-facing account handle introduced by
 * WP-101. A handle is an immutable, globally unique, URL-safe alias
 * that locks at first successful claim. Handles are presentation /
 * routing aliases — `AccountId` (per WP-052 / D-5201) remains the
 * stable identity key for ranking, authorization, and cross-service
 * lookups.
 *
 * This module belongs to the server layer only. It must not be
 * imported from `packages/game-engine/**`, `packages/registry/**`,
 * `packages/preplan/**`, `apps/arena-client/**`,
 * `apps/replay-producer/**`, or `apps/registry-viewer/**`. The engine
 * `PlayerId` (`packages/game-engine/src/types.ts:352`, plain `string`,
 * per D-8701) is unrelated to the server `AccountId` re-imported here.
 *
 * `Result<T>` is re-imported from `./identity.types.js` rather than
 * redeclared. A second declaration would create a structurally
 * compatible but nominally distinct type and split the WP-052 caller
 * surface — see WP-101 §Non-Negotiable Constraints + EC-114 §Locked
 * Values.
 *
 * Authority: WP-101 §Scope (In) §A; EC-114 §Locked Values; D-5201
 * (AccountId rename); D-5202 (server identity directory
 * classification); D-5203 (identity persistence taxonomy — handle
 * columns extend this).
 */

import type { AccountId, Result } from './identity.types.js';

// why: the four-field shape is locked. Adding, renaming, reordering,
// or relaxing any field requires a `DECISIONS.md` entry + a follow-up
// WP. `handleLockedAt` is an ISO-8601 string (not a `Date`) so the
// claim record is JSON-serializable for client handoff without an
// extra mapping step.
/**
 * Authoritative claim record for a single account's handle. Returned
 * by `claimHandle` on success and reconstructed by the idempotent
 * re-claim path; consumed by future surfaces (WP-102 public profile,
 * WP-112 session validation) that need the canonical / display split
 * alongside the lock timestamp.
 */
export interface HandleClaim {
  readonly accountId: AccountId;
  readonly handleCanonical: string;
  readonly displayHandle: string;
  readonly handleLockedAt: string;
}

/**
 * Programmatic error codes for fallible handle operations. The five
 * values are locked; adding a code requires updating both this union
 * and `HANDLE_ERROR_CODES` in the same change. Codes are deliberately
 * narrow so callers cannot silently fall through to a generic error
 * path.
 */
export type HandleErrorCode =
  | 'invalid_handle'
  | 'reserved_handle'
  | 'handle_taken'
  | 'handle_already_locked'
  | 'unknown_account';

/**
 * Canonical readonly array mirroring the `HandleErrorCode` union.
 * Adding a value requires updating both the union and this array in
 * the same change (see code-style §Drift Detection). The
 * drift-detection test asserts forward and backward inclusion.
 */
export const HANDLE_ERROR_CODES: readonly HandleErrorCode[] = [
  'invalid_handle',
  'reserved_handle',
  'handle_taken',
  'handle_already_locked',
  'unknown_account',
] as const;

// why: exporting the array (rather than embedding the reserved set in
// a regex alternation) lets the drift-detection test assert exact
// content and lets future WPs read the locked set without
// duplicating it. Membership is checked against the canonical
// (post-`trim().toLowerCase()`) form.
/**
 * Reserved canonical handles — alphabetical, 15 entries. These are
 * never claimable regardless of database state; the reserved-set
 * check runs against the canonical form before the uniqueness check.
 *
 * Membership rationale per WP-101 §Non-Negotiable Constraints:
 * (a) lowercase canonical forms of system roles
 * (`admin`, `administrator`, `mod`, `moderator`, `root`, `staff`,
 * `support`, `system`); (b) the project namespace itself
 * (`arena`, `legendary`); (c) generic identity placeholders
 * (`anonymous`, `guest`); (d) the routing prefix used by the future
 * HTTP layer (`api`); (e) JS literals confusable with null-equivalent
 * canonical strings (`null`, `undefined`).
 */
export const RESERVED_HANDLES: readonly string[] = [
  'admin',
  'administrator',
  'anonymous',
  'api',
  'arena',
  'guest',
  'legendary',
  'mod',
  'moderator',
  'null',
  'root',
  'staff',
  'support',
  'system',
  'undefined',
] as const;

// why: the regex pattern is exposed as a named export so the
// drift-detection test can assert `HANDLE_REGEX.source ===
// '^[a-z][a-z0-9_]{2,23}$'` byte-for-byte. The pattern matches
// against the canonical (post-`trim().toLowerCase()`) form: 3-24
// characters total, first character is a lowercase letter (no
// leading digit, no leading underscore), subsequent characters are
// lowercase letters, digits, or underscore. The consecutive-
// underscore rejection is enforced separately in `validateHandleFormat`
// rather than embedded here so the error message can name the
// specific failure ("contains consecutive underscores") instead of
// the generic "invalid format".
/**
 * Locked format regex for canonical handles. See the
 * `// why:` comment above for shape rationale.
 */
export const HANDLE_REGEX: RegExp = /^[a-z][a-z0-9_]{2,23}$/;

/**
 * Re-export the WP-052 `Result<T>` and `AccountId` symbols at the
 * `handle.types.ts` boundary so downstream consumers (WP-102,
 * WP-112, future request-handler WPs) can resolve every handle
 * symbol from a single module. The original declarations live in
 * `./identity.types.js`; re-exporting here is a convenience and is
 * not a redeclaration — a structural-clone declaration is forbidden
 * (see module header).
 */
export type { AccountId, Result } from './identity.types.js';
