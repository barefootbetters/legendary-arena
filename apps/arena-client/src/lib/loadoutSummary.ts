/**
 * loadoutSummary.ts — a pure, defensive LAGN → display-summary helper
 * (WP-302 / EC-333).
 *
 * Reads a saved loadout's opaque `lagn` document (`unknown`) and
 * produces a name-level composition summary — mastermind name, scheme
 * name, hero names, villain-group names, henchman-group names, and the
 * numeric supply counts — for the profile "Saved Loadouts" list and the
 * public shared-loadout page.
 *
 * why: the client treats `lagn` as opaque JSON and never imports
 * `@legendary-arena/lagn` — the server is the sole LAGN-validation
 * authority (D-24086 / D-24087). This helper therefore reads the
 * document's `setup` display fields defensively (the `lagnLoadout.ts`
 * precedent): every field is probed for shape and falls back to a safe
 * placeholder rather than throwing, so a misshaped or partial document
 * still renders a readable summary instead of white-screening the page.
 *
 * The LAGN field names mirror the published schema read in
 * `apps/arena-client/src/lobby/lagnLoadout.ts` (snake_case keys,
 * `{ id, name }` entity objects, a top-level `player_count`, and the
 * `setup.*_count` supply fields).
 */

/** Placeholder shown when a single named entity is missing or misshaped. */
const UNKNOWN_ENTITY = 'Unknown';

/**
 * Name-level composition summary derived from a loadout's `lagn`
 * document. Single-entity names fall back to {@link UNKNOWN_ENTITY};
 * entity lists fall back to an empty array; numeric counts fall back to
 * `null` when absent or misshaped.
 */
export interface LoadoutSummary {
  readonly mastermind: string;
  readonly scheme: string;
  readonly heroes: string[];
  readonly villainGroups: string[];
  readonly henchmanGroups: string[];
  readonly playerCount: number | null;
  readonly bystandersCount: number | null;
  readonly woundsCount: number | null;
  readonly officersCount: number | null;
  readonly sidekicksCount: number | null;
}

/** Type guard for non-null, non-array plain objects. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read a LAGN entity `{ id, name }` object into its display name. Falls
 * back to the trimmed `id` when `name` is absent or empty (Registry
 * Viewer exports can carry ids only), and to {@link UNKNOWN_ENTITY}
 * when the whole entity is missing or misshaped.
 */
function readEntityName(value: unknown): string {
  if (!isPlainObject(value)) {
    return UNKNOWN_ENTITY;
  }
  const rawName = value['name'];
  if (typeof rawName === 'string' && rawName.length > 0) {
    return rawName;
  }
  const id = value['id'];
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  return UNKNOWN_ENTITY;
}

/**
 * Read a LAGN array of entity objects into a list of display names.
 * Returns an empty array when the value is not an array; skips any
 * entry that is not a plain object, keeping the good entries.
 */
function readEntityNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const names: string[] = [];
  for (const entry of value) {
    if (isPlainObject(entry)) {
      names.push(readEntityName(entry));
    }
  }
  return names;
}

/**
 * Read a non-negative integer count, or `null` when the value is
 * absent, not a number, not an integer, or negative.
 */
function readCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Build a {@link LoadoutSummary} from an opaque loadout `lagn` document.
 * Never throws: a `null` / non-object document or a missing `setup`
 * block yields a summary of all safe fallbacks so callers can render a
 * consistent shape regardless of input quality.
 *
 * @param lagn The loadout document as opaque JSON (`unknown`).
 * @returns The name-level composition summary.
 */
export function summarizeLoadout(lagn: unknown): LoadoutSummary {
  const document = isPlainObject(lagn) ? lagn : {};
  const setup = isPlainObject(document['setup']) ? document['setup'] : {};

  return {
    mastermind: readEntityName(setup['mastermind']),
    scheme: readEntityName(setup['scheme']),
    heroes: readEntityNames(setup['heroes']),
    villainGroups: readEntityNames(setup['villain_groups']),
    henchmanGroups: readEntityNames(setup['henchmen_groups']),
    playerCount: readCount(document['player_count']),
    bystandersCount: readCount(setup['bystanders_count']),
    woundsCount: readCount(setup['wounds_count']),
    officersCount: readCount(setup['shield_officers_count']),
    sidekicksCount: readCount(setup['sidekicks_count']),
  };
}
