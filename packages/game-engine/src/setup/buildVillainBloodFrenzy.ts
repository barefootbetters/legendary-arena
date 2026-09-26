/**
 * Setup-time Blood Frenzy flags for villain cards (WP-760 / D-24589).
 *
 * Blood Frenzy ("+1 Attack for each different Victory Point value among the
 * cards in your Victory Pile") is printed as a bare `[keyword:Blood Frenzy]`
 * line on a villain. The villain parser reads only `[effect:X]` tokens, so this
 * builder scans the ability text once at setup and records every copy of a
 * Blood Frenzy villain in the match. resolveFightCost reads the result.
 *
 * No boardgame.io import. No randomness. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
// why: the flag must key the copy-indexed villain INSTANCE ids that sit in the
// City (the same grammar as G.cardKeywords, D-18704); the shared emitter is
// imported, not re-implemented.
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// why: game-engine must not import @legendary-arena/registry; these interfaces
// are satisfied structurally by CardRegistry and narrow the fields read here.
interface BloodFrenzyVillainCardEntry {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

interface BloodFrenzyVillainGroupEntry {
  slug: string;
  cards: BloodFrenzyVillainCardEntry[];
}

interface BloodFrenzySetData {
  villains: BloodFrenzyVillainGroupEntry[];
}

interface BloodFrenzyRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// why: the printed label is "Blood Frenzy"; matched case-insensitively and
// tolerant of spacing inside the brackets so a data-casing change can't silently
// drop the flag. Only the bare keyword token is matched — hero Blood Frenzy lines
// carry their own [keyword:blood-frenzy] effect marker and never reach this scan,
// which reads villain cards only.
const BLOOD_FRENZY_KEYWORD_PATTERN = /\[keyword:\s*blood frenzy\s*\]/i;

/**
 * Runtime type guard for the registry reader.
 *
 * @param registry - The setup registry, typed unknown to accept narrow mocks.
 * @returns true when the registry exposes getSet.
 */
function isBloodFrenzyRegistryReader(registry: unknown): registry is BloodFrenzyRegistryReader {
  if (!registry || typeof registry !== 'object') {
    return false;
  }
  return typeof (registry as Record<string, unknown>).getSet === 'function';
}

/**
 * Runtime type guard for set data returned by getSet.
 *
 * @param candidate - The value returned by getSet.
 * @returns true when it exposes a villains array.
 */
function isBloodFrenzySetData(candidate: unknown): candidate is BloodFrenzySetData {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  return Array.isArray((candidate as Record<string, unknown>).villains);
}

/**
 * Whether any ability line on a villain card carries the Blood Frenzy keyword.
 *
 * @param abilities - The card's ability lines (may be missing on malformed data).
 * @returns true when a line contains `[keyword:Blood Frenzy]`.
 */
function hasBloodFrenzyKeyword(abilities: unknown): boolean {
  if (!Array.isArray(abilities)) {
    return false;
  }
  for (const line of abilities) {
    if (typeof line === 'string' && BLOOD_FRENZY_KEYWORD_PATTERN.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the Blood Frenzy flag map for the villain groups selected for this match.
 *
 * // why: scoped to config.villainGroupIds, not every loaded set. Only selected
 * groups can enter the Villain Deck, and scanning every set would make the map
 * non-empty in every match (mdns is always loaded) — the caller assigns it onto G
 * only when non-empty, so a match without Blood Frenzy villains keeps G (and every
 * hash oracle) byte-identical.
 *
 * @param registry - Setup-time registry reader; unknown so narrow mocks work
 *   (a reader without getSet yields an empty map).
 * @param config - The match setup; its villainGroupIds are `<setAbbr>/<groupSlug>`.
 * @returns A map from each Blood Frenzy villain copy's instance ext_id to true.
 */
export function buildVillainBloodFrenzy(
  registry: unknown,
  config: MatchSetupConfig,
): Record<CardExtId, true> {
  const result: Record<CardExtId, true> = {};
  if (!isBloodFrenzyRegistryReader(registry)) {
    return result;
  }

  for (const villainGroupId of config.villainGroupIds) {
    const separatorIndex = villainGroupId.indexOf('/');
    if (separatorIndex <= 0) {
      continue;
    }
    const setAbbr = villainGroupId.slice(0, separatorIndex);
    const groupSlug = villainGroupId.slice(separatorIndex + 1);

    const setData = registry.getSet(setAbbr);
    if (!isBloodFrenzySetData(setData)) {
      continue;
    }
    for (const villainGroup of setData.villains) {
      if (villainGroup.slug !== groupSlug || !Array.isArray(villainGroup.cards)) {
        continue;
      }
      for (const villainCard of villainGroup.cards) {
        if (typeof villainCard.slug !== 'string' || !hasBloodFrenzyKeyword(villainCard.abilities)) {
          continue;
        }
        const instanceExtIds = villainCardInstanceExtIds(setAbbr, groupSlug, villainCard.slug, villainCard);
        for (const instanceExtId of instanceExtIds) {
          result[instanceExtId] = true;
        }
      }
    }
  }

  return result;
}
