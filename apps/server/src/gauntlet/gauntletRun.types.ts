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
// why: WP-446 / D-24265 — the derived-progression inputs carry the gauntlet's
// legs and approved loadouts as plain data (type-only import; both are
// server-layer types built by the wiring layer), and the route bundle carries
// the leaderboard dependency so the derived read resolves the published
// scoring-config version exactly as `getGauntletStandings` does.
import type {
  GauntletApprovedLoadouts,
  GauntletLeg,
} from '../legends/gauntlet.logic.js';
import type { LeaderboardDependencies } from '../leaderboards/leaderboard.types.js';

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

// ---------------------------------------------------------------------------
// Derived-progression contract types (WP-446 / EC-481 / D-24265) — additive
// ---------------------------------------------------------------------------

/**
 * One leg of a run's derived progression (WP-446 / D-24265 §3). `schemeId` is
 * the registry scheme `slug`; `schemeName` is its display name; `cleared` is
 * `true` when at least one of the caller's `competitive_scores` rows for this
 * leg qualifies via `qualifiesAsLegClear`; `hasFullPicks` is
 * `leg_picks[schemeId].length === heroCount`; `lastPlayedAt` is the ISO
 * `max(created_at)` over the caller's qualifying rows for the leg, or `null`
 * when the leg has no qualifying row. Nothing here is stored — every field is
 * derived on each read (D-24262).
 */
export interface GauntletRunLegProgress {
  readonly schemeId: string;
  readonly schemeName: string;
  readonly cleared: boolean;
  readonly hasFullPicks: boolean;
  readonly lastPlayedAt: string | null;
}

/**
 * The server-resolved launch composition for one run (WP-449 / D-24269): the
 * six `MatchSetupConfig` fields the client cannot derive without the registry
 * (the approved variant-0 villains + henchmen and the four supply-STACK
 * counts), plus the set-qualified `mastermindId`. The client assembles a full
 * nine-field `MatchSetupConfig` for "Play this leg" from this block plus the
 * three fields it CAN derive (`schemeId` per leg, `heroDeckIds` from
 * `legPicks`). Present only when the gauntlet's approved menu is configured for
 * the run's `(division, playerCount)`; `null` otherwise (see
 * `GauntletRunProgressView.launch`).
 *
 * `villainGroupIds` / `henchmanGroupIds` are approved variant 0
 * (`approvedLoadouts[playerCount][0]`, the D-24199 baseline). The four supply
 * counts are the canonical `GAUNTLET_LEG_STANDARD_SUPPLY` launch defaults
 * (v1 original edition), supply-STACK counts for a valid config — NOT
 * villain-deck cards and NOT scoring; they do not gate leg-clear (D-24187), so
 * they can never affect the WP-442 / WP-446 clear or champion derivation.
 * `mastermindId` is `${setAbbr}/${mastermindSlug}` (D-10014).
 */
/**
 * One leg's approved adversary composition for "Play this leg" (WP-473 /
 * D-24283): the per-scheme villains + henchmen the leg must be played with. Only
 * the two group-id lists vary per leg; the mastermind, supply counts, and the
 * per-leg `schemeId` / `heroDeckIds` the client already has do not, so they are
 * not repeated per entry.
 */
export interface GauntletRunLaunchComposition {
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

export interface GauntletRunLaunch {
  readonly mastermindId: string;
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
  readonly bystandersCount: number;
  readonly woundsCount: number;
  readonly officersCount: number;
  readonly sidekicksCount: number;
  // why: WP-473 / D-24283 — the ADDITIVE per-leg (per-scheme) launch overlay,
  // keyed by scheme slug: each leg's own approved adversaries so "Play this leg"
  // fields the LEG's villains/henchmen, not one per-mastermind composition for
  // every leg. The per-run `villainGroupIds`/`henchmanGroupIds` above are
  // PRESERVED + still populated (the mastermind default) so the pre-WP-475
  // arena-client consumer stays green until WP-475 reads this map. Omitted when
  // no leg carries an effective composition (a pre-WP-472/unconfigured gauntlet),
  // so an old snapshot degrades to the per-run block.
  readonly legLaunch?: Readonly<Record<string, GauntletRunLaunchComposition>>;
}

/**
 * The five derived states of a run (WP-446 / D-24265 §2), evaluated in the
 * order `champion → all-legs-cleared → playing → ready → needs-heroes`.
 * `all-legs-cleared` and `champion` are DISTINCT: a player may clear every leg
 * with teams whose hero union exceeds the fixed pool budget and legitimately
 * not be champion. A closed union backed by the drift-asserted
 * `GAUNTLET_RUN_STATUSES` canonical array.
 */
export type GauntletRunStatus =
  | 'needs-heroes'
  | 'ready'
  | 'playing'
  | 'all-legs-cleared'
  | 'champion';

/**
 * Canonical readonly array mirroring the `GauntletRunStatus` union. Adding a
 * value requires updating both the union and this array in the same change (see
 * code-style §Drift Detection); the drift-detection test asserts forward and
 * backward inclusion with a synthetic phantom status.
 */
export const GAUNTLET_RUN_STATUSES: readonly GauntletRunStatus[] = [
  'needs-heroes',
  'ready',
  'playing',
  'all-legs-cleared',
  'champion',
] as const;

/**
 * The owner's DERIVED view of one gauntlet run on the wire (WP-446 / D-24265
 * §3): the raw `GauntletRunView` fields PLUS the progression block computed at
 * read time from `legPicks` + `legendary.competitive_scores`. `pool` is the
 * sorted union of all `leg_picks` hero ids; `budget` is `heroCount + 2` (the
 * fixed-pool budget, D-24187 §4); `budgetHeadroom` is `budget − pool.length`
 * (negative allowed when picks exceed budget); `isChampion` is `true` only when
 * every leg is cleared AND a budget-valid pool assignment exists. Nothing here
 * is stored (D-24262).
 */
export interface GauntletRunProgressView extends GauntletRunView {
  readonly status: GauntletRunStatus;
  readonly pool: readonly string[];
  readonly budgetHeadroom: number;
  readonly heroCount: number;
  readonly budget: number;
  readonly isChampion: boolean;
  readonly legs: readonly GauntletRunLegProgress[];
  // why: WP-449 / D-24269 — the additive per-run launch composition the client
  // needs for "Play this leg" (it cannot import the registry). `null` when the
  // gauntlet's approved menu is unconfigured for the run's (division,
  // playerCount) — the same condition under which the WP-446 leg-clear loadout
  // clause is skipped — so a run with no resolvable adversary composition
  // disables its launch buttons rather than launching an incomplete config.
  readonly launch: GauntletRunLaunch | null;
}

/**
 * The injected per-run derivation inputs (WP-446 / D-24265 §5), built once in
 * `server.mjs` from the startup `gauntletCatalog` + `PLAYER_COUNT_SETUP` so the
 * logic layer never imports the registry. `legs` are the gauntlet's home-set
 * scheme legs; `approvedLoadouts` is the gauntlet's approved menu (undefined
 * when the requirement is not configured — the loadout clause is then skipped);
 * `poolBudget` is `heroPoolBudgets[playerCount]` (`= heroCount + 2`) — the SAME
 * value `findBestPoolAssignment` receives and the view's `budget`; `heroCount`
 * is the run's per-`playerCount` hero-group count; `boardName` is
 * `buildGauntletBoardName(definition)` for the cap-warning log.
 */
export interface GauntletRunProgressInputs {
  readonly legs: readonly GauntletLeg[];
  readonly approvedLoadouts: GauntletApprovedLoadouts | undefined;
  readonly poolBudget: number;
  readonly heroCount: number;
  readonly boardName: string;
  // why: WP-449 / D-24269 — the additive launch-block inputs, injected by the
  // same `server.mjs` wiring layer that builds the rest of these inputs, so the
  // logic layer stays registry-free. `launchComposition` is the approved
  // variant-0 (`approvedLoadouts[playerCount][0]`) villains + henchmen, or
  // `null` when the approved menu is unconfigured for this run's (division,
  // playerCount). `launchSupply` is the canonical `GAUNTLET_LEG_STANDARD_SUPPLY`
  // launch table (fixed constants that do not gate leg-clear, D-24187).
  // `mastermindId` is the set-qualified `${setAbbr}/${mastermindSlug}` ext_id
  // (D-10014). These feed ONLY the derived `launch` block — never leg-clear or
  // champion derivation.
  readonly launchComposition: {
    readonly villainGroupIds: readonly string[];
    readonly henchmanGroupIds: readonly string[];
  } | null;
  readonly launchSupply: {
    readonly bystandersCount: number;
    readonly woundsCount: number;
    readonly officersCount: number;
    readonly sidekicksCount: number;
  };
  readonly mastermindId: string;
}

/**
 * The injected resolver that maps one of the caller's raw runs to its
 * derivation inputs (WP-446 / D-24265 §5). Built in `server.mjs` from the
 * already-built `gauntletCatalog`, so the logic layer never builds the registry
 * catalog. Returns `null` when no catalog gauntlet matches the run's identity
 * (a run/catalog drift the DB entrypoint surfaces as an internal error rather
 * than silently mis-deriving).
 */
export type GauntletRunProgressResolver = (
  run: GauntletRunView,
) => GauntletRunProgressInputs | null;

/**
 * Caller-injected dependency bundle for `registerGauntletRunRoutes`. Mirrors
 * the WP-332 `CompetitionRouteDependencies`: `requireAuthenticatedSession` is
 * the WP-112 orchestrator (or a test fake); `verifier` and `accountResolver`
 * are the broker-specific implementations passed through at request time;
 * `requireUnsuspendedAccount` is the WP-107 guard; `resolveGauntletExistence`
 * is the injected registry-existence resolver. `resolveGauntletRunProgressInputs`
 * and `leaderboardDependencies` (WP-446 / D-24265) feed the derived GET read:
 * the injected per-run inputs and the leaderboard dependency the derivation
 * resolves the published scoring-config version from. Production wiring binds
 * these once at startup in `server.mjs`.
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
  readonly resolveGauntletRunProgressInputs: GauntletRunProgressResolver;
  readonly leaderboardDependencies: LeaderboardDependencies;
}
