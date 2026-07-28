/**
 * Row-shape types for the gauntlet run workspace (WP-443 / EC-478 / D-24262)
 * plus the run-import + run-CRUD API contract (WP-445 / EC-480 / D-24264).
 *
 * The WP-443 half describes the shape of a `legendary.player_gauntlet_runs`
 * row: a plain row-shape declaration only — no functions, no `pg` query, no
 * repository. Every derived read (run state, hero pool, headroom, standing,
 * last-played) lives in WP-446, computed from `legPicks` +
 * `legendary.competitive_scores` — never stored (D-24262).
 *
 * The WP-445 half adds the API contract types the four `/api/me/gauntlet-runs`
 * endpoints exchange: the camelCase `GauntletRunView` wire shape, the closed
 * `GauntletRunErrorCode` union + its canonical array, the `GauntletRunResult`
 * discriminated result, the request-body inputs, the caller-injected route
 * dependency bundle, and the injected gauntlet-existence resolver. These are
 * additive; the row-shape types below are reused unchanged.
 *
 * This module belongs to the server layer only. It must not be imported by any
 * package under `packages/` or by any UI / client / replay-producer app.
 *
 * Authority: WP-443 §Contract; EC-478 §Locked Values; WP-445 §Contract;
 * EC-480 §Locked Values; D-24262 (derived-progression lock); D-24264
 * (import-idempotency + run-API-shape lock).
 */

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
import type { RequireUnsuspendedAccountResult } from '../auth/requireUnsuspendedAccount.js';

// why: re-exported so the routes + logic modules (and tests) can reference the
// identity-layer + auth-layer aliases through `./gauntletRun.types.js` without
// re-importing from those modules directly, preserving a single import
// boundary. Mirrors the WP-301 `loadoutLibrary.types.ts` re-export precedent.
export type {
  AccountId,
  AccountResolver,
  DatabaseClient,
  RequireAuthenticatedSessionOptions,
  RequireUnsuspendedAccountResult,
  SessionTokenRequest,
  SessionVerifier,
};

/**
 * The gauntlet division a run belongs to, mirroring the identity-only pack's
 * `division` values (D-24260): `'fixed'` (the fixed hero-pool division) or
 * `'open'`. Matches the migration's `CHECK (division IN ('fixed', 'open'))`.
 */
export type GauntletRunDivision = 'fixed' | 'open';

/**
 * The single authoritative hero state for a run: a map from a leg's scheme slug
 * to the hero deck ids chosen for that leg. Mirrors the `leg_picks jsonb`
 * column. There is no child hero table and no `player_loadouts` entry — the
 * run's picks live only here.
 */
export type GauntletRunLegPicks = Record<string, readonly string[]>;

/**
 * One `legendary.player_gauntlet_runs` row.
 *
 * `playerId` is the `bigint` FK to `legendary.players(player_id)`; `pg` surfaces
 * a `bigint` as a string, so it is typed as `string` here. `firstCompletedAt` is
 * the nullable, write-once audit + archive-boundary stamp — never competitive
 * truth. The DB→row mapping (snake_case columns → these camelCase fields) is
 * WP-5.
 */
export interface GauntletRunRow {
  id: string;
  playerId: string;
  setAbbr: string;
  mastermindSlug: string;
  division: GauntletRunDivision;
  playerCount: number;
  legPicks: GauntletRunLegPicks;
  createdAt: string;
  updatedAt: string;
  firstCompletedAt: string | null;
}

// ---------------------------------------------------------------------------
// API contract types (WP-445 / EC-480 / D-24264) — additive
// ---------------------------------------------------------------------------

/**
 * The owner's view of one gauntlet run on the wire (camelCase). Returned as
 * the JSON body of `POST /api/me/gauntlet-runs` (`201` new / `200` idempotent
 * attach) and each `PATCH /api/me/gauntlet-runs/:id` (`200`), and as each
 * element of the `GET /api/me/gauntlet-runs` list.
 *
 * This is the RAW stored run: identity + `legPicks` + timestamps + the
 * write-once `firstCompletedAt` stamp. It carries NO derived progression value
 * — no `status`, `pool`, `headroom`, per-leg `cleared`, or `lastPlayed` (that
 * derived read is WP-446, D-24262). `playerId` and the owner's account id are
 * server-internal and deliberately absent from the wire.
 */
export interface GauntletRunView {
  readonly id: string;
  readonly setAbbr: string;
  readonly mastermindSlug: string;
  readonly division: GauntletRunDivision;
  readonly playerCount: number;
  readonly legPicks: GauntletRunLegPicks;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly firstCompletedAt: string | null;
}

/**
 * Programmatic error codes for fallible gauntlet-run operations. Closed union:
 * callers dispatch on `code` without parsing prose `reason` strings.
 *
 * Adding a code requires updating both this union and
 * `GAUNTLET_RUN_ERROR_CODES` in the same change; the drift-detection test in
 * `gauntletRun.logic.test.ts` asserts forward and backward inclusion (mirrors
 * `LOADOUT_LIBRARY_ERROR_CODES`).
 */
export type GauntletRunErrorCode =
  | 'unauthorized'
  | 'account_suspended'
  | 'invalid_pack'
  | 'unknown_gauntlet'
  | 'invalid_leg_picks'
  | 'not_found';

/**
 * Canonical readonly array mirroring the `GauntletRunErrorCode` union. Adding a
 * value requires updating both the union and this array in the same change (see
 * code-style §Drift Detection).
 */
export const GAUNTLET_RUN_ERROR_CODES: readonly GauntletRunErrorCode[] = [
  'unauthorized',
  'account_suspended',
  'invalid_pack',
  'unknown_gauntlet',
  'invalid_leg_picks',
  'not_found',
] as const;

/**
 * Discriminated-union result type for fallible gauntlet-run operations. The
 * `ok: true` branch carries the success value; the `ok: false` branch carries a
 * full-sentence `reason` string (per code-style Rule 11) and a programmatic
 * `code` for caller-side dispatch without prose parsing. Mirrors
 * `LoadoutLibraryResult<T>`.
 */
export type GauntletRunResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: GauntletRunErrorCode };

/**
 * Request body for `POST /api/me/gauntlet-runs`. The entire request body is an
 * untrusted WP-440 gauntlet identity pack; `pack` is `unknown` at the boundary
 * because the logic layer validates it against
 * `@legendary-arena/registry`'s `validateGauntletPack` before any write and
 * rejects a bad shape with `invalid_pack`.
 */
export interface ImportGauntletRunInput {
  readonly pack: unknown;
}

/**
 * Request body for `PATCH /api/me/gauntlet-runs/:id`. `legPicks` is `unknown`
 * at the boundary; the logic layer validates only its STRUCTURAL shape (an
 * object of `schemeSlug → heroDeckIds[]`) and rejects a malformed value with
 * `invalid_leg_picks`. No gameplay / registry validity check on hero ids is
 * performed here (that is launch-time, a later WP).
 */
export interface UpdateGauntletRunPatch {
  readonly legPicks: unknown;
}

/**
 * Closed-set re-statement of the WP-112 auth orchestrator's
 * `Result<AccountId, SessionValidationCode>` shape (declared locally so this
 * contract file does not import from the identity layer for a type already
 * reachable via the auth-layer re-exports). Mirrors the WP-301
 * `loadoutLibrary.types.ts` precedent.
 */
export type GauntletRunSessionValidationCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_account'
  | 'session_verifier_not_configured'
  | 'lookup_failed';

export type RequireAuthenticatedSessionResult =
  | { ok: true; value: AccountId }
  | { ok: false; reason: string; code: GauntletRunSessionValidationCode };

/**
 * The identity a gauntlet-existence check resolves against: the WP-440 pack's
 * four identity fields. The injected resolver answers whether the live registry
 * hosts this gauntlet with an approved loadout menu for the given
 * `(division, playerCount)`.
 */
export interface GauntletExistenceQuery {
  readonly setAbbr: string;
  readonly mastermindSlug: string;
  readonly division: GauntletRunDivision;
  readonly playerCount: number;
}

/**
 * The injected gauntlet-existence resolver. Built once at startup in
 * `server.mjs` from the already-built `gauntletCatalog`, so the logic layer
 * never imports the registry or builds the catalog itself (keeping it
 * DB-test-friendly and registry-catalog-free). Returns `true` when the query
 * names a real gauntlet offered for that division + player count, `false`
 * otherwise (→ `422 unknown_gauntlet`).
 */
export type GauntletExistenceResolver = (
  query: GauntletExistenceQuery,
) => boolean;

/**
 * Caller-injected dependency bundle for `registerGauntletRunRoutes`. Mirrors
 * the WP-332 `CompetitionRouteDependencies`: `requireAuthenticatedSession` is
 * the WP-112 orchestrator (or a test fake); `verifier` and `accountResolver`
 * are the broker-specific implementations passed through at request time;
 * `requireUnsuspendedAccount` is the WP-107 guard; `resolveGauntletExistence`
 * is the injected registry-existence resolver. Production wiring binds these
 * once at startup in `server.mjs`.
 */
export interface GauntletRunRouteDependencies {
  readonly requireAuthenticatedSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<RequireAuthenticatedSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
  readonly requireUnsuspendedAccount: (
    database: DatabaseClient,
    accountId: AccountId,
  ) => Promise<RequireUnsuspendedAccountResult>;
  readonly resolveGauntletExistence: GauntletExistenceResolver;
}
