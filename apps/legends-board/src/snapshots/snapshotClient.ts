/**
 * Snapshot client — fetches leaderboard data from R2 public-read URLs.
 *
 * Type definitions mirror apps/server/src/legends/legends.types.ts exactly.
 * DO NOT import from @legendary-arena/server (layer boundary violation).
 */

// ---------------------------------------------------------------------------
// Mirrored types from WP-142 legends.types.ts
// ---------------------------------------------------------------------------

/** A single row in a global-top snapshot board. */
export interface GlobalTopSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly scenarioKey: string;
  readonly score: number;
}

/** A single row in a per-scenario snapshot board. */
export interface ScenarioSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly score: number;
}

/** A single board snapshot written to R2 at `legends/v1/<board>.json`. */
export interface LegendsSnapshotBoard {
  readonly board: string;
  readonly entries: readonly (GlobalTopSnapshotEntry | ScenarioSnapshotEntry)[];
  readonly rowCount: number;
  readonly schemaVersion: 1;
}

/** Manifest written to `legends/v1/manifest.json`. */
export interface LegendsManifest {
  readonly boards: readonly string[];
  readonly generatedAt: string;
  readonly schemaVersion: 1;
  // why: additive WP-342 fields — present only when the publisher runs with
  // a gauntlet catalog; absent on a pre-WP-342 manifest. Mirrored from
  // apps/server/src/legends/legends.types.ts (never imported cross-package).
  readonly gauntletBoards?: readonly string[];
  readonly gauntletIndex?: string;
}

// ---------------------------------------------------------------------------
// Gauntlet snapshot types (WP-342 / WP-343 / D-24131)
// Mirrored from apps/server/src/legends/legends.types.ts — DO NOT import.
// ---------------------------------------------------------------------------

/** A single row in a gauntlet snapshot board. Scores are PAR-relative
 * (lower is better); `averageScoreCentis` is an integer ×100 average —
 * display layers divide by 100. */
export interface GauntletSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly totalScore: number;
  readonly legCount: number;
  readonly averageScoreCentis: number;
  // why: additive (WP-344 / D-24134 §4) and OPTIONAL on the client mirror —
  // the server source (apps/server/src/legends/legends.types.ts) declares
  // `players` required because the current publisher always writes it, but a
  // pre-WP-344 snapshot in R2 predates the field, so the client tolerates its
  // absence and the panel falls back to `handle`. Handle-ASC roster;
  // `handle` equals `players[0]`. Never imported cross-package.
  readonly players?: readonly string[];
  // why: additive (WP-385 / D-24187 §6) and OPTIONAL — the server publishes
  // fixed-division boards with a distinct GauntletFixedSnapshotEntry type
  // whose only extra field is `heroPool`; the client's single entry type
  // serves both divisions by carrying it optionally (open-board entries and
  // old snapshots simply lack it). Set-qualified hero ids, sorted ASC.
  readonly heroPool?: readonly string[];
}

/** A gauntlet board snapshot at `legends/v1/<board>.json` — written only
 * for gauntlets with at least one complete entry. */
export interface GauntletSnapshotBoard {
  readonly board: string;
  readonly entries: readonly GauntletSnapshotEntry[];
  readonly rowCount: number;
  readonly schemaVersion: 1;
}

/** One leg of a gauntlet as published on the index (WP-344 / D-24134 §5) —
 * the data the per-leg challenge links and leg display consume. `schemeName`
 * is the registry display name; `schemeSlug` combines with the gauntlet's
 * `setAbbr` into the set-qualified id the challenge URL carries.
 * Mirrored from apps/server/src/legends/legends.types.ts — DO NOT import. */
export interface GauntletIndexLeg {
  readonly schemeSlug: string;
  readonly schemeName: string;
  // why: WP-474 / D-24283 — mirrors WP-472's per-leg approved loadout (per
  // player count) so a mastermind's legs can field different adversaries
  // scheme-to-scheme. Consumers read THIS (leg-level) in preference to the
  // entry-level field below; optional so a pre-WP-472 snapshot (leg carries no
  // loadout) degrades to the entry-level per-mastermind fallback rather than
  // crashing. Mirrored from apps/server/src/legends/legends.types.ts — DO NOT import.
  readonly approvedLoadouts?: GauntletIndexApprovedLoadouts;
}

/** Complete-entry counts per player count for one gauntlet
 * (WP-344 / D-24134 §5). Keys are the stringified player counts 1-5.
 * Mirrored from apps/server/src/legends/legends.types.ts — DO NOT import. */
export type GauntletEntryCounts = Readonly<
  Record<"1" | "2" | "3" | "4" | "5", number>
>;

/** One row of the gauntlet index — every catalog gauntlet appears,
 * including `entryCount: 0` "unclaimed" boards (which have NO board file). */
export interface GauntletIndexEntry {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly legCount: number;
  // why: `entryCount` predates the player-count dimension and reports the
  // SOLO board's complete-entry count (WP-344 / D-24134 §5) — old WP-343
  // renderers keep using it; per-count detail lives in `entryCounts`.
  readonly entryCount: number;
  readonly board: string;
  // why: additive (WP-344 / D-24134 §5) and OPTIONAL on the client mirror —
  // required in the server source, but a pre-WP-344 index artifact in R2
  // lacks these, so the panels degrade to WP-343 behavior (solo-only tab, no
  // challenge links) rather than crash. Never imported cross-package.
  readonly entryCounts?: GauntletEntryCounts;
  // why: additive (WP-385 / D-24187 §6) and OPTIONAL — per-count claim
  // state for the fixed-hero-pool division; a pre-WP-384 index artifact
  // lacks it, which suppresses the division toggle and fixed chips
  // entirely (exact WP-345 rendering).
  readonly fixedEntryCounts?: GauntletEntryCounts;
  readonly legs?: readonly GauntletIndexLeg[];
  // why: WP-395 / D-24199, now DEPRECATED as the per-scheme fallback (WP-474 /
  // D-24283). The per-mastermind approved configurations, keyed by player count.
  // WP-472 dual-writes this alongside the per-leg `GauntletIndexLeg.approvedLoadouts`;
  // consumers now read the leg-level field and fall back to THIS only for a
  // pre-WP-472 snapshot (where legs carry no loadout). A pre-WP-395 artifact lacks
  // both, which suppresses the requirement panel and leaves links unpinned (exact
  // WP-387 rendering). Never imported cross-package.
  readonly approvedLoadouts?: GauntletIndexApprovedLoadouts;
}

/**
 * One approved configuration as the board renders it (WP-395 / D-24199):
 * the set-qualified group ids a player must configure for a run to count.
 */
export interface GauntletIndexApprovedLoadout {
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

/** Approved configurations keyed by player count (JSON keys are strings). */
export type GauntletIndexApprovedLoadouts = Readonly<
  Record<string, readonly GauntletIndexApprovedLoadout[]>
>;

/** A named group in a set's roster with no coverage flag (WP-461): a mastermind
 * or a scheme. Mirrored from apps/server/src/legends/legends.types.ts — DO NOT
 * import (the zero-API layer boundary). */
export interface SetNamedGroup {
  readonly slug: string;
  readonly name: string;
}

/** A villain or henchman group with its PER-SET gauntlet-coverage flag (WP-461):
 * `usedByGauntlets` is true iff THIS set's own gauntlets fight it. Mirrored from
 * apps/server/src/legends/legends.types.ts — DO NOT import. */
export interface SetAdversaryGroup {
  readonly slug: string;
  readonly name: string;
  readonly usedByGauntlets: boolean;
}

/** The full per-set roster the "Show set details" reveal renders (WP-461 /
 * D-24279): every mastermind/scheme/villain/henchman a set ships, villains and
 * henchmen carrying the per-set coverage flag. Mirrored from
 * apps/server/src/legends/legends.types.ts — DO NOT import. */
export interface SetDetails {
  readonly setAbbr: string;
  readonly setName: string;
  readonly masterminds: readonly SetNamedGroup[];
  readonly schemes: readonly SetNamedGroup[];
  readonly villains: readonly SetAdversaryGroup[];
  readonly henchmen: readonly SetAdversaryGroup[];
}

/** The gauntlet index artifact at `legends/v1/gauntlet-index.json`. */
export interface GauntletIndexSnapshot {
  readonly gauntlets: readonly GauntletIndexEntry[];
  // why: additive (WP-461 / D-24279) and OPTIONAL on the client mirror — the
  // per-set rosters + coverage flags for the "Show set details" reveal. A
  // pre-WP-461 index artifact in R2 lacks it, so the reveal simply does not
  // render (no crash). Never imported cross-package.
  readonly sets?: readonly SetDetails[];
  readonly generatedAt: string;
  readonly schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

/** Returns the R2 base URL from the build-time env var. */
function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_LEGENDS_R2_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "VITE_LEGENDS_R2_BASE_URL is not set. Configure this environment variable to point at the R2 public-read URL.",
    );
  }
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** Returns the manifest poll interval from the build-time env var. */
export function getPollIntervalMs(): number {
  const override = import.meta.env.VITE_LEGENDS_POLL_INTERVAL_MS;
  if (override) {
    const parsed = Number(override);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_POLL_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cachedManifest: LegendsManifest | null = null;
const boardCache = new Map<string, LegendsSnapshotBoard>();
let cachedGauntletIndex: GauntletIndexSnapshot | null = null;
const gauntletBoardCache = new Map<string, GauntletSnapshotBoard>();

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches JSON from an R2 URL with a timeout.
 *
 * @throws on network error, non-OK status, or timeout
 */
async function fetchJson<T>(url: string): Promise<T> {
  // why: 10-second timeout prevents a stalled R2 edge from blocking the UI indefinitely
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `Snapshot fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`,
      );
    }
    const data = (await response.json()) as T;
    console.log(`[legends] Fetched ${url} (${response.status})`);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the manifest from R2. Always hits the network (no-cache manifest). */
export async function fetchManifest(): Promise<LegendsManifest> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}legends/v1/manifest.json`;
  const manifest = await fetchJson<LegendsManifest>(url);
  cachedManifest = manifest;
  return manifest;
}

/**
 * Fetches a single board snapshot from R2.
 * Returns a cached copy if the manifest has not changed since the last fetch.
 */
export async function fetchBoard(
  boardName: string,
): Promise<LegendsSnapshotBoard> {
  const cached = boardCache.get(boardName);
  if (cached) {
    return cached;
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}legends/v1/${boardName}.json`;
  const board = await fetchJson<LegendsSnapshotBoard>(url);
  boardCache.set(boardName, board);
  console.log(
    `[legends] Board "${boardName}" cached (${board.rowCount} rows)`,
  );
  return board;
}

/**
 * Fetches all boards listed in the manifest.
 * Returns a Map of board name to snapshot data.
 * Individual board failures are caught and logged; other boards still load.
 */
export async function fetchAllBoards(
  manifest: LegendsManifest,
): Promise<Map<string, LegendsSnapshotBoard>> {
  const results = new Map<string, LegendsSnapshotBoard>();
  const fetchPromises = manifest.boards.map(async (boardName) => {
    try {
      const board = await fetchBoard(boardName);
      results.set(boardName, board);
    } catch (error) {
      console.error(
        `[legends] Failed to fetch board "${boardName}":`,
        error,
      );
    }
  });
  await Promise.all(fetchPromises);
  return results;
}

/**
 * Fetches the gauntlet index from R2, returning a cached copy until the
 * manifest changes. The index exists whenever the manifest carries the
 * `gauntletIndex` field (WP-342).
 */
export async function fetchGauntletIndex(): Promise<GauntletIndexSnapshot> {
  if (cachedGauntletIndex !== null) {
    return cachedGauntletIndex;
  }
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}legends/v1/gauntlet-index.json`;
  const index = await fetchJson<GauntletIndexSnapshot>(url);
  cachedGauntletIndex = index;
  console.log(
    `[legends] Gauntlet index cached (${index.gauntlets.length} gauntlets)`,
  );
  return index;
}

/**
 * Fetches a single gauntlet board snapshot from R2, returning a cached
 * copy until the manifest changes. Callers must only request boards the
 * index reports with `entryCount >= 1` — zero-entry gauntlets have no
 * board file by design (D-24131 §7).
 */
export async function fetchGauntletBoard(
  boardName: string,
): Promise<GauntletSnapshotBoard> {
  const cached = gauntletBoardCache.get(boardName);
  if (cached) {
    return cached;
  }
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}legends/v1/${boardName}.json`;
  const board = await fetchJson<GauntletSnapshotBoard>(url);
  gauntletBoardCache.set(boardName, board);
  console.log(
    `[legends] Gauntlet board "${boardName}" cached (${board.rowCount} rows)`,
  );
  return board;
}

/**
 * Invalidates all cached board data. Called when `manifest.generatedAt`
 * changes, indicating the publisher wrote fresh snapshots.
 */
export function invalidateBoardCache(): void {
  boardCache.clear();
  cachedGauntletIndex = null;
  gauntletBoardCache.clear();
  console.log("[legends] Board cache invalidated");
}

/** Returns the most recently fetched manifest, or null if none. */
export function getCachedManifest(): LegendsManifest | null {
  return cachedManifest;
}

/**
 * Checks whether the manifest has changed by comparing `generatedAt`.
 * If changed, invalidates the board cache so boards are re-fetched.
 * Returns the new manifest.
 */
export async function pollManifest(): Promise<LegendsManifest> {
  const previousGeneratedAt = cachedManifest?.generatedAt ?? null;
  const manifest = await fetchManifest();

  if (
    previousGeneratedAt !== null &&
    manifest.generatedAt !== previousGeneratedAt
  ) {
    invalidateBoardCache();
    console.log(
      `[legends] Manifest changed: ${previousGeneratedAt} -> ${manifest.generatedAt}`,
    );
  }

  return manifest;
}

/**
 * Derives a human-readable display name from a board slug.
 * Example: "by-scheme" -> "By Scheme", "overall" -> "Overall"
 */
export function boardDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
