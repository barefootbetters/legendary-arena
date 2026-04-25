/**
 * Player Identity Types — Server Layer (WP-052)
 *
 * Durable contracts for authenticated player accounts and ephemeral
 * guest identities. These types form the trust surface that future
 * server WPs (WP-053 submission, WP-054 leaderboards, GDPR endpoints)
 * consume; field shapes, names, and order are locked by WP-052.
 *
 * This module belongs to the server layer only. It must not be
 * imported from `packages/game-engine/**`, `packages/registry/**`,
 * `packages/preplan/**`, `apps/arena-client/**`, `apps/replay-producer/**`,
 * or `apps/registry-viewer/**`. The engine `PlayerId`
 * (`packages/game-engine/src/types.ts:352`, plain `string`, per
 * D-8701) and the server `AccountId` defined here (branded `string`,
 * per D-5201) are deliberately distinct types in distinct layers and
 * must never be imported across the boundary.
 *
 * Authority: WP-052 §Scope A; D-5201 (AccountId rename); D-5202
 * (server identity directory classification); D-5203 (identity
 * persistence taxonomy); D-8701 (engine PlayerId is plain string).
 */

import type { Pool } from 'pg';

/**
 * Re-export of `pg.Pool` under the project's name so all five identity
 * source files can reference the same type without re-importing `pg`.
 * Production callers pass the live pool created at server startup;
 * tests construct a test-database `Pool` against `TEST_DATABASE_URL`.
 * For the transactional `deletePlayerData` path, the function calls
 * `pool.connect()` internally to obtain a `PoolClient`.
 */
export type DatabaseClient = Pool;

// why: branding prevents accidental interchange with other string
// identifiers at compile time. Renamed from a draft-time `PlayerId`
// to avoid collision with the engine `PlayerId` alias per D-8701
// (D-5201).
// why: UUID v4 avoids sequential ID enumeration attacks; sourced from
// node:crypto.randomUUID() per locked contract value.
/**
 * Stable cross-service identifier for an authenticated player
 * account. Generated as UUID v4 via `node:crypto.randomUUID()` and
 * brand-cast at exactly one site (the `createPlayerAccount` insert
 * path). Maps 1:1 to `legendary.players.ext_id` in PostgreSQL.
 */
export type AccountId = string & { readonly __brand: 'AccountId' };

// why: AuthProvider values are part of the identity trust surface;
// adding a provider requires a DECISIONS.md entry, not a config
// change. Drift detection is enforced by the AUTH_PROVIDERS canonical
// array test in identity.logic.test.ts.
/**
 * Authentication providers recognised by the identity layer. Each
 * value pairs with a provider-specific `authProviderId` carried by
 * `PlayerAccount`.
 */
export type AuthProvider = 'email' | 'google' | 'discord';

/**
 * Canonical readonly array mirroring the `AuthProvider` union.
 * Adding a value requires updating both the union and this array
 * in the same change (see code-style §Drift Detection). The
 * drift-detection test asserts forward and backward inclusion.
 */
export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  'email',
  'google',
  'discord',
] as const;

/**
 * Authenticated player account record. The TypeScript field names use
 * `camelCase`; the underlying PostgreSQL columns use `snake_case`. The
 * mapping is performed explicitly at every read site by the
 * `mapPlayerAccountRow` helper in `identity.logic.ts`.
 *
 * All fields are `readonly`. Mutation is forbidden at the type level.
 * `Object.keys(account).sort()` MUST equal
 * `['accountId','authProvider','authProviderId','createdAt','displayName','email','updatedAt']`
 * — drift-detection test in `identity.logic.test.ts` enforces this.
 */
export interface PlayerAccount {
  readonly accountId: AccountId;
  // why: email is stored in canonical form (trim + lowercase) at the
  // application layer. The DB constraint `email text UNIQUE` then
  // enforces case-folded uniqueness; callers never need to canonicalize
  // before querying.
  readonly email: string;
  readonly displayName: string;
  readonly authProvider: AuthProvider;
  readonly authProviderId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Ephemeral guest identity. Guests do not have rows in
 * `legendary.players` — `GuestIdentity` lives only in process memory
 * for the duration of a guest session. Replay ownership records can
 * never be assigned to a guest because `assignReplayOwnership`
 * requires an `AccountId` (see `replayOwnership.logic.ts`).
 *
 * `Object.keys(guest).sort()` MUST equal
 * `['createdAt','guestSessionId','isGuest']`.
 */
export interface GuestIdentity {
  readonly guestSessionId: string;
  readonly createdAt: string;
  readonly isGuest: true;
}

/**
 * Discriminated union over the two identity kinds. Use `isGuest()` to
 * narrow. The `isGuest: true` literal on `GuestIdentity` is the
 * discriminant; `PlayerAccount` deliberately omits the field rather
 * than declaring `isGuest: false`, which keeps the
 * `'accountId' in identity` type-narrowing path available without
 * polluting the account shape.
 */
export type PlayerIdentity = PlayerAccount | GuestIdentity;

/**
 * Pure type guard narrowing a `PlayerIdentity` to `GuestIdentity`. No
 * I/O, no DB access; safe to call from any layer that already holds
 * an identity reference.
 */
export function isGuest(identity: PlayerIdentity): identity is GuestIdentity {
  return (identity as GuestIdentity).isGuest === true;
}

/**
 * Discriminated-union result type for fallible identity operations.
 * The `ok: true` branch carries the success value; the `ok: false`
 * branch carries a full-sentence `reason` string (per code-style
 * Rule 11) and a programmatic `code` for caller-side dispatch
 * without prose parsing.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: IdentityErrorCode };

/**
 * Programmatic error codes for fallible identity operations. Adding
 * a code requires updating both this union and the corresponding
 * caller dispatch sites; codes are deliberately narrow so callers
 * cannot silently fall through to a generic error path.
 */
export type IdentityErrorCode =
  | 'duplicate_email'
  | 'invalid_email'
  | 'invalid_display_name'
  | 'unknown_account';
