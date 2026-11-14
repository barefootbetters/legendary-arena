/**
 * offlineLineup.ts — the Battle Brief lineup for an offline match (WP-894
 * follow-up, D-24851).
 *
 * why: an online match's brief reads its lineup from the server's public match
 * LAGN (D-24446). An offline match has no server and no match id, so the brief
 * showed "The lineup could not be loaded." This helper builds the same
 * {@link LoadoutSummary} from the setup bundle the device already holds: the
 * match configuration's set-qualified ids (`core/brotherhood`) are resolved to
 * display names through the bundle's own `setData`. It reads no network and no
 * `G`; the Board-Visible Field Rule is untouched.
 *
 * Defensive like `loadoutSummary.ts`: an id that cannot be resolved falls back
 * to its slug rather than throwing.
 */
import type { LocalSpikeSetupBundle } from '../client/setupBundleReader';
import type { LoadoutSummary } from '../lib/loadoutSummary';

/** The `setData` list each kind of entity is looked up in. */
type SetDataListKey = 'heroes' | 'villains' | 'henchmen' | 'masterminds' | 'schemes';

/** Type guard for non-null, non-array plain objects. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves one set-qualified id (`{setAbbr}/{slug}`) to its display name.
 *
 * @param setData - The bundle's per-set data, keyed by set abbreviation.
 * @param listKey - Which entity list of the set to search.
 * @param qualifiedId - The set-qualified id from the match configuration.
 * @returns The entity's name, or the slug (or the whole id) when it cannot be resolved.
 */
function resolveEntityName(
  setData: Readonly<Record<string, unknown>>,
  listKey: SetDataListKey,
  qualifiedId: string,
): string {
  const separatorIndex = qualifiedId.indexOf('/');
  if (separatorIndex <= 0) {
    return qualifiedId;
  }
  const setAbbr = qualifiedId.slice(0, separatorIndex);
  const slug = qualifiedId.slice(separatorIndex + 1);
  const set = setData[setAbbr];
  if (!isPlainObject(set)) {
    return slug;
  }
  const entities = set[listKey];
  if (!Array.isArray(entities)) {
    return slug;
  }
  for (const entity of entities) {
    if (isPlainObject(entity) && entity['slug'] === slug && typeof entity['name'] === 'string' && entity['name'].length > 0) {
      return entity['name'];
    }
  }
  return slug;
}

/**
 * Resolves a list of set-qualified ids to display names, in order.
 *
 * @param setData - The bundle's per-set data.
 * @param listKey - Which entity list of each set to search.
 * @param qualifiedIds - The ids to resolve.
 * @returns The names.
 */
function resolveEntityNames(
  setData: Readonly<Record<string, unknown>>,
  listKey: SetDataListKey,
  qualifiedIds: readonly string[],
): string[] {
  const names: string[] = [];
  for (const qualifiedId of qualifiedIds) {
    names.push(resolveEntityName(setData, listKey, qualifiedId));
  }
  return names;
}

/**
 * Builds the Battle Brief lineup from an offline setup bundle.
 *
 * @param bundle - The parsed setup bundle the offline match runs on.
 * @returns The name-level lineup summary.
 */
export function summarizeOfflineLineup(bundle: LocalSpikeSetupBundle): LoadoutSummary {
  const configuration = bundle.matchConfiguration;
  const setData = bundle.setData;
  return {
    mastermind: resolveEntityName(setData, 'masterminds', configuration.mastermindId),
    scheme: resolveEntityName(setData, 'schemes', configuration.schemeId),
    heroes: resolveEntityNames(setData, 'heroes', configuration.heroDeckIds),
    heroAlternates: [],
    villainGroups: resolveEntityNames(setData, 'villains', configuration.villainGroupIds),
    henchmanGroups: resolveEntityNames(setData, 'henchmen', configuration.henchmanGroupIds),
    playerCount: bundle.numPlayers,
    bystandersCount: configuration.bystandersCount,
    woundsCount: configuration.woundsCount,
    officersCount: configuration.officersCount,
    sidekicksCount: configuration.sidekicksCount,
    // why: D-24658 — only a literal `true` turns the rule on; absence means off.
    finalBlow: configuration.finalBlow === true,
  };
}
