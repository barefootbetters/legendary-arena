/**
 * playerCountRequirements.ts — the lobby's pre-submit player-count check
 * (WP-371 / D-24167).
 *
 * The number of players fixes how many villain groups / henchmen groups /
 * heroes a loadout must contain. The engine BLOCKS a mismatch authoritatively
 * at match creation (WP-370, surfaced as an HTTP 400 through the native lobby).
 * This module lets the lobby warn the user + disable Create BEFORE they submit,
 * using the required counts fetched from the server's read-only
 * `/api/match/setup-requirements` endpoint.
 *
 * arena-client may not import `@legendary-arena/registry` at runtime (layer
 * boundary), so the required counts arrive as data from the server; this module
 * is a pure comparison over that data.
 */

/** The required setup counts for one player count (server projection of the registry table). */
export interface SetupRequirementRow {
  readonly villainGroupCount: number;
  readonly henchmenGroupCount: number;
  readonly villainDeckBystanderCount: number;
  readonly heroCount: number;
}

/** The requirements table keyed by player count, as returned by the server. */
export type SetupRequirements = Readonly<Record<number, SetupRequirementRow>>;

/** The composition array lengths a lobby form currently holds. */
export interface CompositionCounts {
  readonly villainGroups: number;
  readonly henchmanGroups: number;
  readonly heroes: number;
}

/** One composition-count mismatch against the required counts for a player count. */
export interface RequirementMismatch {
  /** A human label for the field (e.g. "villain groups"). */
  readonly label: string;
  /** The count the rules require for this player count. */
  readonly required: number;
  /** The count the loadout currently has. */
  readonly actual: number;
}

/**
 * Returns the list of composition-count mismatches for a player count — empty
 * when the composition matches (or when the requirements are unavailable or the
 * player count is out of range, so the check stays silent and defers to the
 * authoritative engine block).
 */
export function computePlayerCountMismatches(
  requirements: SetupRequirements | null,
  playerCount: number,
  counts: CompositionCounts,
): RequirementMismatch[] {
  if (requirements === null) {
    return [];
  }
  const row = requirements[playerCount];
  if (row === undefined) {
    return [];
  }
  const mismatches: RequirementMismatch[] = [];
  if (counts.villainGroups !== row.villainGroupCount) {
    mismatches.push({ label: 'villain groups', required: row.villainGroupCount, actual: counts.villainGroups });
  }
  if (counts.henchmanGroups !== row.henchmenGroupCount) {
    mismatches.push({ label: 'henchmen groups', required: row.henchmenGroupCount, actual: counts.henchmanGroups });
  }
  if (counts.heroes !== row.heroCount) {
    mismatches.push({ label: 'heroes', required: row.heroCount, actual: counts.heroes });
  }
  return mismatches;
}

/**
 * Builds a full-sentence warning for one mismatch, e.g.
 * "A 4-player match needs 3 villain groups — this loadout has 1."
 */
export function formatMismatchWarning(
  playerCount: number,
  mismatch: RequirementMismatch,
): string {
  return (
    `A ${playerCount}-player match needs ${mismatch.required} ${mismatch.label} — ` +
    `this loadout has ${mismatch.actual}.`
  );
}
