/**
 * Setup-time Dark Memories flags for villain cards (WP-902 / D-24859).
 *
 * Dark Memories on a Villain ("+1 Attack for each Hero Class among the cards in your discard
 * pile") is printed as a bare `[keyword:Dark Memories]` line. The villain parser reads only
 * `[effect:X]` tokens, so this builder scans the ability text once at setup — the D-24589 Blood
 * Frenzy pattern — and records every copy of a Dark Memories villain in the match.
 * resolveFightCost reads the result over the FIGHTER's discard pile.
 *
 * The scan matches a WHOLE-LINE bare keyword only (`/^\s*\[keyword:\s*dark memories\s*\]\s*\.?\s*$/i`)
 * on Villain cards of the match's villain groups. The Dark Dimension's "Villains here get
 * [keyword:Dark Memories]. …" line (a scheme, not a villain card) and The Hood / Epic Hood
 * Masterminds' lines are out of scope — neither is a villain card this builder scans, and the
 * whole-line anchor would reject a mid-sentence mention regardless.
 *
 * No boardgame.io import. No randomness. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
// why: the flag must key the copy-indexed villain INSTANCE ids that sit in the City (the same
// grammar as G.cardKeywords, D-18704); the shared emitter is imported, not re-implemented.
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// why: game-engine must not import @legendary-arena/registry; these interfaces are satisfied
// structurally by CardRegistry and narrow the fields read here.
interface DarkMemoriesVillainCardEntry {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

interface DarkMemoriesVillainGroupEntry {
  slug: string;
  cards: DarkMemoriesVillainCardEntry[];
}

interface DarkMemoriesSetData {
  villains: DarkMemoriesVillainGroupEntry[];
}

interface DarkMemoriesRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// why: WP-902 / D-24859 — the printed label is "Dark Memories"; matched case-insensitively and
// tolerant of spacing inside the brackets so a data-casing change can't silently drop the flag.
// The WHOLE-LINE anchor (and an optional trailing period) excludes The Dark Dimension's granted
// "Villains here get [keyword:Dark Memories]. …" and the Masterminds' lines; only a Villain card
// whose line IS the bare keyword is flagged.
const DARK_MEMORIES_LINE_PATTERN = /^\s*\[keyword:\s*dark memories\s*\]\s*\.?\s*$/i;

/**
 * Runtime type guard for the registry reader.
 *
 * @param registry - The setup registry, typed unknown to accept narrow mocks.
 * @returns true when the registry exposes getSet.
 */
function isDarkMemoriesRegistryReader(registry: unknown): registry is DarkMemoriesRegistryReader {
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
function isDarkMemoriesSetData(candidate: unknown): candidate is DarkMemoriesSetData {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  return Array.isArray((candidate as Record<string, unknown>).villains);
}

/**
 * Whether any ability line on a villain card is the whole-line bare Dark Memories keyword.
 *
 * @param abilities - The card's ability lines (may be missing on malformed data).
 * @returns true when a line is exactly `[keyword:Dark Memories]` (optional trailing period).
 */
function hasDarkMemoriesLine(abilities: unknown): boolean {
  if (!Array.isArray(abilities)) {
    return false;
  }
  for (const line of abilities) {
    if (typeof line === 'string' && DARK_MEMORIES_LINE_PATTERN.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the Dark Memories flag map for the villain groups selected for this match.
 *
 * // why: scoped to config.villainGroupIds, not every loaded set (the Blood Frenzy precedent).
 * Only selected groups can enter the Villain Deck, and scanning every set would make the map
 * non-empty in every match; the caller assigns it onto G only when non-empty, so a match without
 * Dark Memories villains keeps G (and every hash oracle) byte-identical.
 *
 * @param registry - Setup-time registry reader; unknown so narrow mocks work (a reader without
 *   getSet yields an empty map).
 * @param config - The match setup; its villainGroupIds are `<setAbbr>/<groupSlug>`.
 * @returns A map from each Dark Memories villain copy's instance ext_id to true.
 */
export function buildVillainDarkMemories(
  registry: unknown,
  config: MatchSetupConfig,
): Record<CardExtId, true> {
  const result: Record<CardExtId, true> = {};
  if (!isDarkMemoriesRegistryReader(registry)) {
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
    if (!isDarkMemoriesSetData(setData)) {
      continue;
    }
    for (const villainGroup of setData.villains) {
      if (villainGroup.slug !== groupSlug || !Array.isArray(villainGroup.cards)) {
        continue;
      }
      for (const villainCard of villainGroup.cards) {
        if (typeof villainCard.slug !== 'string' || !hasDarkMemoriesLine(villainCard.abilities)) {
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
