/**
 * Profile Loadout Library Types — Server Layer (WP-301 / EC-332)
 *
 * Durable contracts for the account-scoped saved-loadout surface
 * (Vision §19b). These types form the wire shape for the four
 * authenticated `/api/me/loadouts` endpoints plus the one guest
 * `GET /api/loadouts/:shareSlug` read. Saved loadouts are decorative,
 * user-authored content per §19b / §19a — never a competitive-
 * submission path (no leaderboard / competitive-score relationship).
 *
 * This module belongs to the server layer only. It must not be
 * imported by any package under `packages/` or by any UI / client /
 * replay-producer app. The one authorized cross-layer import in this
 * feature is `@legendary-arena/lagn` (a pure zod validator, no upward
 * or sideways runtime edge — authorized by D-24086), used in
 * `loadoutLibrary.logic.ts`.
 *
 * `AccountId`, `DatabaseClient` are re-imported from
 * `../identity/identity.types.js` per the WP-052 D-5201 contract —
 * never redeclared. `RequireAuthenticatedSessionOptions`,
 * `SessionTokenRequest`, `SessionVerifier`, `AccountResolver` are
 * re-imported from `../auth/sessionToken.types.js` for the route
 * handler signatures. This mirrors the WP-104 `ownerProfile.types.ts`
 * precedent verbatim.
 *
 * `LoadoutLibraryResult<T>` is declared locally — the identity-layer
 * `Result<T>` is keyed on `IdentityErrorCode` and cannot carry the
 * loadout-library codes; this mirrors the WP-102 `ProfileResult<T>`
 * / WP-104 `OwnerProfileResult<T>` declared-locally precedent.
 *
 * Authority: WP-301 §Contract + §Locked Values; EC-332 §Locked
 * Values; D-24086 (data model, MAX_SAVED_LOADOUTS_PER_ACCOUNT = 50,
 * share_slug opacity, decorative-not-merit lock).
 */

import type { LAGN } from '@legendary-arena/lagn';
import type {
  AccountId,
  DatabaseClient,
} from '../identity/identity.types.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';

// why: re-exported so other modules in this layer (and tests) can
// reference the identity-layer + auth-layer aliases through
// `./loadoutLibrary.types.js` without re-importing from those modules
// directly, preserving the single import boundary documented above.
// Mirrors the WP-104 `ownerProfile.types.ts` re-export precedent.
export type {
  AccountId,
  AccountResolver,
  DatabaseClient,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
};

/**
 * Locked per-account quota for saved loadouts (D-24086). A create
 * that would exceed this cap is rejected with a typed
 * `loadout_limit_reached` error before any row is inserted.
 *
 * why: this is the free-tier quota; a "premium unlimited" tier is a
 * future monetization hook, explicitly NOT built in this packet. The
 * cap is a convenience/quota limit, not a gameplay-power gate (a saved
 * deck file confers no in-game advantage per Vision NG-1).
 */
export const MAX_SAVED_LOADOUTS_PER_ACCOUNT = 50;

/**
 * Locked entropy budget for a minted `share_slug`:
 * `crypto.randomBytes(16)` → ≥128 bits → a 22-character `base64url`
 * opaque string (D-24086).
 *
 * why: the slug must be random and URL-safe, never derived from
 * `id` / `name` / `player_id` — a derived slug would leak the row's
 * identity or let a caller enumerate other loadouts. 128 bits makes
 * the slug unguessable; the partial-unique index is the collision
 * backstop for the mint-and-retry loop in `loadoutLibrary.logic.ts`.
 */
export const SHARE_SLUG_BYTES = 16;

/**
 * The owner's view of one saved loadout. Returned as the JSON body of
 * `POST /api/me/loadouts` (201) and each `PATCH /api/me/loadouts/:id`
 * (200), and as each element of the `GET /api/me/loadouts` list.
 *
 * The full `lagn` document is included on every element (no lighter
 * list-summary projection) so the client can render "view as cards"
 * without a second fetch. At the 50-loadout cap this payload is
 * bounded and acceptable per WP-301 §Out of Scope.
 *
 * `shareSlug` is `null` while the loadout is private and a non-null
 * opaque string while it is public. `player_id` and the owner's
 * `ext_id` are deliberately absent — they are server-internal and
 * never appear on the wire.
 */
export interface SavedLoadoutView {
  readonly id: string;
  readonly name: string;
  readonly visibility: 'private' | 'public';
  readonly shareSlug: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lagn: LAGN;
}

/**
 * The guest view of one public saved loadout, returned by
 * `GET /api/loadouts/:shareSlug` (200). Carries ONLY the loadout's
 * `name`, its `lagn` document, and the owner's public `displayHandle`.
 *
 * why: this is the public-only allowlist projection. It never carries
 * `accountId` / `ext_id`, never the internal `player_id`, never the
 * `share_slug` itself, and is only ever composed for a `public` row —
 * a private or missing slug returns 404 with no body, so a share link
 * can never expose a private loadout or the owner's account id.
 */
export interface PublicLoadoutView {
  readonly name: string;
  readonly lagn: LAGN;
  readonly displayHandle: string;
}

/**
 * Request body for `POST /api/me/loadouts`. The `lagn` field is
 * `unknown` at the boundary because it is untrusted client input; the
 * logic layer validates it against `@legendary-arena/lagn` before any
 * write and rejects it with `invalid_lagn` on failure.
 */
export interface CreateLoadoutInput {
  readonly name: unknown;
  readonly lagn: unknown;
}

/**
 * Request body for `PATCH /api/me/loadouts/:id`. Both fields are
 * optional; a PATCH with neither `name` nor `visibility` present is
 * rejected `empty_update` (400) and writes nothing. `name` is trimmed
 * before validation and persisted trimmed.
 */
export interface UpdateLoadoutPatch {
  readonly name?: unknown;
  readonly visibility?: unknown;
}

/**
 * Programmatic error codes for fallible loadout-library operations.
 * Closed union: callers dispatch on `code` without parsing prose
 * `reason` strings.
 *
 * Adding a code requires updating both this union and
 * `LOADOUT_LIBRARY_ERROR_CODES` in the same change; the drift-
 * detection test in `loadoutLibrary.logic.test.ts` asserts forward
 * and backward inclusion (mirrors `OWNER_PROFILE_ERROR_CODES`).
 */
export type LoadoutLibraryErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_lagn'
  | 'invalid_name'
  | 'loadout_limit_reached'
  | 'empty_update';

/**
 * Canonical readonly array mirroring the `LoadoutLibraryErrorCode`
 * union. Adding a value requires updating both the union and this
 * array in the same change (see code-style §Drift Detection).
 */
export const LOADOUT_LIBRARY_ERROR_CODES: readonly LoadoutLibraryErrorCode[] = [
  'unauthorized',
  'not_found',
  'invalid_lagn',
  'invalid_name',
  'loadout_limit_reached',
  'empty_update',
] as const;

/**
 * Discriminated-union result type for fallible loadout-library
 * operations. The `ok: true` branch carries the success value; the
 * `ok: false` branch carries a full-sentence `reason` string (per
 * code-style Rule 11) and a programmatic `code` for caller-side
 * dispatch without prose parsing. Mirrors `OwnerProfileResult<T>`.
 */
export type LoadoutLibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: LoadoutLibraryErrorCode };

/**
 * Closed-set re-statement of the auth orchestrator's
 * `Result<AccountId, SessionValidationErrorCode>` shape (declared
 * locally so this contract file does not import from the identity
 * layer for a type already reachable via the auth-layer re-exports).
 * Mirrors the WP-104 `RequireAuthenticatedSessionResult` precedent.
 */
export type LoadoutSessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

export type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: LoadoutSessionValidationCode };

/**
 * Caller-injected dependency bundle for
 * `registerLoadoutLibraryRoutes`. Mirrors
 * `OwnerProfileRouteDependencies`: `requireAuthenticatedSession` is
 * the WP-112 orchestrator (or a test fake); `verifier` and
 * `accountResolver` are the broker-specific implementations passed
 * through to the orchestrator at request time. Production wiring binds
 * these once at startup in `server.mjs`.
 */
export interface LoadoutLibraryRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}
