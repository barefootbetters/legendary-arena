/**
 * Gauntlet Run API Client — Arena Client (WP-449 / EC-484)
 *
 * Typed, never-throw `fetch` wrappers for the four authenticated
 * `/api/me/gauntlet-runs` endpoints (WP-445 import + run-CRUD, WP-446 derived
 * read): import a WP-440 pack (`POST`), list the caller's runs with derived
 * progression (`GET`), edit a run's per-leg hero picks (`PATCH`), and delete a
 * run (`DELETE`). Consumed by
 * `apps/arena-client/src/pages/MyProfilePage.vue`'s Gauntlet Runs section.
 *
 * Layer-boundary contract: this module imports NOTHING from
 * `@legendary-arena/registry`, `@legendary-arena/game-engine`, `apps/server`,
 * `pg`, or `boardgame.io` — only `./apiBaseUrl`. The wire shapes
 * (`GauntletRunProgressView`, `GauntletRunLegProgress`, `GauntletRunLaunch`,
 * `GauntletRunStatus`, `GauntletRunView`) are declared INLINE here by
 * structural compatibility with their server-side counterparts in
 * `apps/server/src/gauntlet/gauntletRun.types.ts` — the engine/server-isolation
 * rule prohibits the client from importing server-layer types directly. The
 * imported pack is opaque JSON (`unknown`): sent verbatim on import; the server
 * is the sole `validateGauntletPack` authority (D-24264). Mirrors the WP-302
 * `loadoutLibraryApi.ts` client pattern.
 *
 * Authority: WP-449 §Scope (In) §A + §Contract; EC-484 §Locked Values +
 * §Files to Produce; D-24269.
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * The gauntlet division a run belongs to. Mirrors the server's
 * `GauntletRunDivision` (`'fixed' | 'open'`) by structural compatibility.
 */
export type GauntletRunDivision = 'fixed' | 'open';

/**
 * The map from a leg's scheme slug to the hero deck ids chosen for that leg.
 * Mirrors the server's `GauntletRunLegPicks` by structural compatibility.
 */
export type GauntletRunLegPicks = Record<string, readonly string[]>;

/**
 * The five derived states of a run, evaluated server-side in the order
 * `champion → all-legs-cleared → playing → ready → needs-heroes`. Mirrors the
 * server's `GauntletRunStatus` union verbatim; `all-legs-cleared` is DISTINCT
 * from `champion` (a run may clear every leg with teams whose hero union
 * exceeds the fixed-pool budget and legitimately not be champion).
 */
export type GauntletRunStatus =
  | 'needs-heroes'
  | 'ready'
  | 'playing'
  | 'all-legs-cleared'
  | 'champion';

/**
 * One leg of a run's derived progression. Mirrors the server's
 * `GauntletRunLegProgress`. `schemeId` is the bare registry scheme slug (keyed
 * the same way in `legPicks`); `cleared` / `hasFullPicks` / `lastPlayedAt` are
 * derived per read (nothing is stored, D-24262).
 */
export interface GauntletRunLegProgress {
  readonly schemeId: string;
  readonly schemeName: string;
  readonly cleared: boolean;
  readonly hasFullPicks: boolean;
  readonly lastPlayedAt: string | null;
}

/**
 * The server-resolved launch composition for one run (WP-449 / D-24269).
 * Mirrors the server's `GauntletRunLaunch`: the six `MatchSetupConfig` fields
 * the client cannot derive without the registry (approved variant-0 villains +
 * henchmen and the four supply-STACK counts) plus the set-qualified
 * `mastermindId`. `null` on the view when the gauntlet's approved menu is
 * unconfigured for the run's `(division, playerCount)`.
 */
export interface GauntletRunLaunch {
  readonly mastermindId: string;
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
  readonly bystandersCount: number;
  readonly woundsCount: number;
  readonly officersCount: number;
  readonly sidekicksCount: number;
}

/**
 * The RAW stored run on the wire, returned by `POST` (201 new / 200 idempotent
 * attach) and `PATCH` (200). Mirrors the server's `GauntletRunView` — identity
 * + `legPicks` + timestamps + the write-once `firstCompletedAt` stamp. It
 * carries NO derived progression (that is the `GET` read's
 * `GauntletRunProgressView`).
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
 * The DERIVED view of one run, each element of the `GET /api/me/gauntlet-runs`
 * list. Mirrors the server's `GauntletRunProgressView`: the raw
 * `GauntletRunView` fields PLUS the progression block computed at read time
 * (D-24262) AND the additive `launch` block (WP-449). The client renders these
 * derived fields verbatim — it never recomputes `status` / `isChampion` /
 * `pool` / `budgetHeadroom` (D-24262).
 */
export interface GauntletRunProgressView extends GauntletRunView {
  readonly status: GauntletRunStatus;
  readonly pool: readonly string[];
  readonly budgetHeadroom: number;
  readonly heroCount: number;
  readonly budget: number;
  readonly isChampion: boolean;
  readonly legs: readonly GauntletRunLegProgress[];
  readonly launch: GauntletRunLaunch | null;
}

/**
 * The list body returned by `GET /api/me/gauntlet-runs` (200): the caller's
 * runs with derived progression, active runs first (ordering owned server-side).
 */
export interface GauntletRunListView {
  readonly runs: GauntletRunProgressView[];
}

/**
 * Result discriminator for the value-returning gauntlet-run wrappers. The
 * success branch carries the parsed value; the failure branch carries the HTTP
 * status plus the closed-set error code the server emitted in its
 * `{ error: code }` body (or `null` for a network/parse failure or an
 * unrecognized code). Mirrors `LoadoutApiResult`.
 */
export type GauntletRunApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string | null };

/**
 * Result discriminator for `deleteGauntletRun` — a successful DELETE returns
 * 204 with no body, so the success branch carries no value.
 */
export type GauntletRunDeleteResult =
  | { ok: true }
  | { ok: false; status: number; code: string | null };

/**
 * Parse a non-2xx gauntlet-run response into the failure branch. Reads the
 * failure code from the server's `{ error: code }` body (the shape the run
 * routes emit); returns `null` for the code when the body is absent, malformed,
 * or carries no string `error`.
 */
async function parseGauntletRunFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: string | null }> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') {
      code = body.error;
    }
  } catch {
    // why: a malformed or empty JSON body is a transport-level failure; we
    // surface the status alone and leave the code null so the page can render a
    // generic error line without crashing the promise chain.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/**
 * Import a downloaded WP-440 gauntlet pack as an account-local run. POSTs the
 * opaque `pack` verbatim; returns the created (201) or idempotently-attached
 * (200) RAW `GauntletRunView` on success. The server validates the pack and
 * rejects a bad shape / unknown gauntlet with a typed code (`invalid_pack` /
 * `unknown_gauntlet` / `unauthorized` / `account_suspended`). Never throws.
 *
 * The raw view carries no derived progression or `launch` block, so the caller
 * refetches the derived list (`listGauntletRuns`) after a successful import
 * rather than rendering this value directly.
 */
export async function importGauntletRun(
  authToken: string | null,
  pack: unknown,
): Promise<GauntletRunApiResult<GauntletRunView>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/gauntlet-runs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken === null
          ? {}
          : { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify(pack),
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  // why: D-24264 — a brand-new import returns 201; an idempotent attach to an
  // existing active run of the same identity returns 200. Both carry the run
  // view, so both are success here.
  if (response.status !== 201 && response.status !== 200) {
    return await parseGauntletRunFailure(response);
  }
  const value = (await response.json()) as GauntletRunView;
  return { ok: true, value };
}

/**
 * Fetch the authenticated caller's gauntlet runs, each with its derived
 * progression + `launch` block. Returns `{ ok: true, value: { runs } }` on HTTP
 * 200; `{ ok: false, status, code }` on every other status; and
 * `{ ok: false, status: 0, code: null }` when `fetch` throws. Never throws.
 */
export async function listGauntletRuns(
  authToken: string | null,
): Promise<GauntletRunApiResult<GauntletRunListView>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/gauntlet-runs'), {
      method: 'GET',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseGauntletRunFailure(response);
  }
  const value = (await response.json()) as GauntletRunListView;
  return { ok: true, value };
}

/**
 * Edit one of the caller's runs' per-leg hero picks. PATCHes `{ legPicks }` (a
 * `Record<schemeSlug, heroDeckIds[]>`); returns the updated RAW `GauntletRunView`
 * on HTTP 200. The server validates only the structural shape and rejects a
 * malformed value with `invalid_leg_picks` (or `not_found` for a
 * missing / cross-account id). Never throws.
 */
export async function updateLegPicks(
  authToken: string | null,
  id: string,
  legPicks: GauntletRunLegPicks,
): Promise<GauntletRunApiResult<GauntletRunView>> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/gauntlet-runs/${encodeURIComponent(id)}`),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken === null
            ? {}
            : { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ legPicks }),
      },
    );
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseGauntletRunFailure(response);
  }
  const value = (await response.json()) as GauntletRunView;
  return { ok: true, value };
}

/**
 * Delete one of the caller's runs by id. Returns `{ ok: true }` on HTTP 204 (no
 * body); `{ ok: false, status, code }` on every other status (e.g. a
 * missing / cross-account id → 404 `not_found`). Never throws.
 */
export async function deleteGauntletRun(
  authToken: string | null,
  id: string,
): Promise<GauntletRunDeleteResult> {
  let response: Response;
  try {
    response = await fetch(
      buildApiUrl(`/api/me/gauntlet-runs/${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers:
          authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
      },
    );
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP status;
    // the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 204) {
    return await parseGauntletRunFailure(response);
  }
  return { ok: true };
}
