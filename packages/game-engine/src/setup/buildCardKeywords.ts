/**
 * Setup-time board keyword resolution for the Legendary Arena game engine.
 *
 * Resolves board keywords (Patrol, Ambush, Guard) from villain and henchman
 * card data at setup time. Follows the same setup-time resolution pattern
 * as buildCardStats (WP-018) and G.villainDeckCardTypes (WP-014B).
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { BoardKeyword } from '../board/boardKeywords.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// CardKeywordsRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum methods
// needed for keyword resolution at setup time.

/**
 * Minimal structural type for a villain card entry in SetData.
 * Only the abilities field is needed for keyword extraction.
 */
interface KeywordVillainCardEntry {
  slug: string;
  abilities: string[];
}

/**
 * Minimal structural type for a villain group in SetData.
 */
interface KeywordVillainGroupEntry {
  slug: string;
  cards: KeywordVillainCardEntry[];
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the fields needed for keyword extraction from villain/henchman data.
 */
interface KeywordSetData {
  abbr: string;
  villains: KeywordVillainGroupEntry[];
  henchmen: unknown[];
}

/**
 * Minimal structural type for a flat card entry from listCards().
 */
interface KeywordFlatCard {
  key: string;
  cardType: string;
  slug: string;
  setAbbr: string;
}

/**
 * Setup-time registry interface for keyword resolution.
 *
 * Satisfied structurally by the real CardRegistry from the registry
 * package. Defined locally to respect the layer boundary (same pattern
 * as CardStatsRegistryReader in economy.logic.ts).
 */
interface CardKeywordsRegistryReader {
  /** All flat cards across all loaded sets. */
  listCards(): KeywordFlatCard[];
  /** All loaded set index entries. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for CardKeywordsRegistryReader.
 *
 * Returns true if the registry object has the required methods (listCards,
 * listSets, getSet). Narrow test mocks that only implement
 * CardRegistryReader will return false.
 */
// why: narrow test mocks (CardRegistryReader) may lack the required
// methods. We check at runtime. If the registry doesn't satisfy the
// interface, we return an empty record — moves handle missing
// cardKeywords entries gracefully (no keywords = no effects).
function isCardKeywordsRegistryReader(
  registry: unknown,
): registry is CardKeywordsRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;

  return (
    typeof candidate.listCards === 'function' &&
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

// ---------------------------------------------------------------------------
// buildCardKeywords — setup-time keyword resolution
// ---------------------------------------------------------------------------

/**
 * Resolves board keywords for all villain/henchman cards at setup time.
 *
 * // why: same setup-time resolution pattern as G.cardStats (WP-018) and
 * G.villainDeckCardTypes (WP-014B). Moves never query registry at runtime.
 *
 * MVP keyword extraction:
 * - Ambush: detected by "Ambush" prefix in ability text strings
 * - Patrol: no data source in current card data (safe-skip, D-2302)
 * - Guard: no data source in current card data (safe-skip, D-2302)
 *
 * @param registry - Setup-time registry reader. Accepts unknown to support
 *   narrow test mocks. If the registry does not satisfy
 *   CardKeywordsRegistryReader structurally, returns empty record.
 * @param _matchConfig - Match setup configuration (unused in MVP — all
 *   villain/henchman cards in the deck are scanned, not filtered by config).
 * @returns Record keyed by CardExtId with detected board keywords.
 */
export function buildCardKeywords(
  registry: unknown,
  _matchConfig: MatchSetupConfig,
): Record<CardExtId, BoardKeyword[]> {
  if (!isCardKeywordsRegistryReader(registry)) {
    return {};
  }

  const result: Record<CardExtId, BoardKeyword[]> = {};
  const allFlatCards = registry.listCards();

  // --- Villain cards: check ability text for keyword patterns ---
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr) as KeywordSetData | undefined;

    if (!setData || !Array.isArray(setData.villains)) {
      continue;
    }

    for (const villainGroup of setData.villains) {
      if (!Array.isArray(villainGroup.cards)) {
        continue;
      }

      for (const villainCard of villainGroup.cards) {
        const keywords = extractKeywordsFromAbilities(villainCard.abilities);

        if (keywords.length === 0) {
          continue;
        }

        // Find the matching FlatCard key (ext_id) for this villain card
        const flatCard = findFlatCardForVillainCard(
          allFlatCards,
          setEntry.abbr,
          villainGroup.slug,
          villainCard.slug,
        );

        if (flatCard) {
          result[flatCard.key as CardExtId] = keywords;
        }
      }
    }
  }

  // why: henchmen have no individual ability text in the registry data.
  // All henchman copies within a group share the same card text, which
  // is stored at the group level (not on individual entries). Henchman
  // keyword extraction would require a different data path — deferred
  // to a future WP that adds structured keyword classification.

  return result;
}

// ---------------------------------------------------------------------------
// Keyword extraction from ability text
// ---------------------------------------------------------------------------

/**
 * Extracts board keywords from a card's ability text strings.
 *
 * MVP: only detects Ambush via "Ambush" prefix. Patrol and Guard have no
 * data source in current card data (safe-skip per D-2302).
 *
 * @param abilities - Array of ability text strings from card data.
 * @returns Array of detected BoardKeyword values.
 */
function extractKeywordsFromAbilities(
  abilities: string[] | undefined,
): BoardKeyword[] {
  if (!abilities || !Array.isArray(abilities)) {
    return [];
  }

  const keywords: BoardKeyword[] = [];

  for (const ability of abilities) {
    if (typeof ability !== 'string') {
      continue;
    }

    // why: Ambush abilities consistently start with "Ambush" (capital A)
    // across all 304 occurrences in the card data. Case-sensitive match
    // avoids false positives from ability text mentioning ambush in
    // other contexts.
    if (ability.startsWith('Ambush')) {
      keywords.push('ambush');
      break; // why: MVP treats keywords as present/absent only — no stacking
    }
  }

  // why: Patrol and Guard keywords have no data source in current card data.
  // Patrol in the data is a different mechanic (Secret Wars Vol 2 location
  // patrols). Guard has zero occurrences. Both mechanics are implemented
  // and tested with synthetic data but dormant with real cards until a
  // future WP adds structured keyword classification (safe-skip, D-2302).

  return keywords;
}

// ---------------------------------------------------------------------------
// Flat card lookup helper
// ---------------------------------------------------------------------------

/**
 * Finds a FlatCard matching a villain card by set, group slug, and card slug.
 *
 * Villain FlatCard key format: {setAbbr}-villain-{groupSlug}-{cardSlug}
 */
function findFlatCardForVillainCard(
  allFlatCards: KeywordFlatCard[],
  setAbbr: string,
  groupSlug: string,
  cardSlug: string,
): KeywordFlatCard | undefined {
  for (const card of allFlatCards) {
    if (card.cardType !== 'villain') {
      continue;
    }

    if (card.setAbbr !== setAbbr) {
      continue;
    }

    const prefix = `${setAbbr}-villain-`;
    if (!card.key.startsWith(prefix)) {
      continue;
    }

    const afterPrefix = card.key.slice(prefix.length);
    const expectedSuffix = `-${cardSlug}`;

    if (afterPrefix.endsWith(expectedSuffix)) {
      const extractedGroupSlug = afterPrefix.slice(
        0,
        afterPrefix.length - expectedSuffix.length,
      );

      if (extractedGroupSlug === groupSlug) {
        return card;
      }
    }
  }

  return undefined;
}
