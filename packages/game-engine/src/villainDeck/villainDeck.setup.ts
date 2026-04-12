/**
 * Villain deck construction for the Legendary Arena game engine.
 *
 * buildVillainDeck resolves cards from the registry at setup time and
 * produces a shuffled villain deck with type classifications. This is
 * the only point where registry data enters the villain deck subsystem —
 * moves operate solely on G.villainDeck and G.villainDeckCardTypes.
 *
 * No @legendary-arena/registry imports. No .reduce(). Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType, VillainDeckState } from './villainDeck.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { SetupContext } from '../types.js';
import { shuffleDeck } from '../setup/shuffle.js';

// ---------------------------------------------------------------------------
// VillainDeckRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum methods
// needed for villain deck construction.

/**
 * Minimal structural type for a flat card returned by listCards().
 * Matches a subset of FlatCard from the registry package.
 */
export interface VillainDeckFlatCard {
  /** Unique key in format {setAbbr}-{cardType}-{groupSlug}-{cardSlug}. */
  key: string;
  /** Coarse card type: "hero", "mastermind", "villain", or "scheme". */
  cardType: string;
  /** Card-level slug within its parent entity. */
  slug: string;
  /** Set abbreviation (e.g., "core", "2099"). */
  setAbbr: string;
}

/**
 * Minimal structural type for a henchman group entry in SetData.
 * SetData.henchmen is z.array(z.unknown()); we validate structurally.
 */
interface HenchmanGroupEntry {
  slug: string;
}

/**
 * Minimal structural type for a mastermind card entry in SetData.
 */
interface MastermindCardEntry {
  slug: string;
  tactic?: boolean;
}

/**
 * Minimal structural type for a mastermind entry in SetData.
 */
interface MastermindEntry {
  slug: string;
  cards: MastermindCardEntry[];
}

/**
 * Minimal structural type for a scheme entry in SetData.
 */
interface SchemeEntry {
  slug: string;
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the fields needed for villain deck construction are included.
 */
interface SetDataSubset {
  abbr: string;
  henchmen: unknown[];
  masterminds: MastermindEntry[];
  schemes: SchemeEntry[];
}

/**
 * Setup-time registry interface for villain deck construction.
 *
 * Satisfied structurally by the real CardRegistry from the registry
 * package. Defined locally to respect the layer boundary.
 */
export interface VillainDeckRegistryReader {
  /** All flat cards across all loaded sets. */
  listCards(): VillainDeckFlatCard[];
  /** All loaded set index entries. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Count constants (MVP base rules)
// ---------------------------------------------------------------------------

// why: standard Legendary base rule (MVP); see D-1412.
// These are rule invariants, not tuning knobs.

/** Number of identical copies per henchman group in the villain deck. */
const HENCHMAN_COPIES_PER_GROUP = 10;

/** Number of scheme twist cards added to the villain deck. */
const SCHEME_TWIST_COUNT = 8;

// Bystander count = context.ctx.numPlayers (derived, not a constant)

// ---------------------------------------------------------------------------
// buildVillainDeck
// ---------------------------------------------------------------------------

/**
 * Result of building the villain deck at setup time.
 */
export interface BuildVillainDeckResult {
  /** The villain deck state (shuffled deck + empty discard). */
  state: VillainDeckState;
  /** Card type classification for every card in the deck. */
  cardTypes: Record<CardExtId, RevealedCardType>;
}

/**
 * Builds the villain deck from registry data at setup time.
 *
 * Resolves villain cards, generates virtual henchman/scheme-twist/bystander
 * instances, filters mastermind strike cards, shuffles the combined deck,
 * and returns the deck state with type classifications.
 *
 * @param config - The match setup config providing entity IDs.
 * @param registry - Setup-time registry reader. Accepts unknown to support
 *   narrow test mocks (CardRegistryReader). If the registry does not satisfy
 *   VillainDeckRegistryReader structurally (missing listSets/getSet/full
 *   listCards), returns an empty deck gracefully.
 * @param context - Setup context providing numPlayers and random.Shuffle.
 * @returns The villain deck state and card type classifications.
 * @throws {Error} If required registry data is missing or malformed when the
 *   registry DOES satisfy VillainDeckRegistryReader.
 */
export function buildVillainDeck(
  config: MatchSetupConfig,
  registry: unknown,
  context: SetupContext,
): BuildVillainDeckResult {
  // why: narrow test mocks (CardRegistryReader) only have listCards() returning
  // { key: string }[]. We check for the full VillainDeckRegistryReader interface
  // at runtime. If the registry doesn't have the required methods, we return
  // an empty deck — the reveal pipeline handles this gracefully (WP-014A).
  if (!isVillainDeckRegistryReader(registry)) {
    return { state: { deck: [], discard: [] }, cardTypes: {} };
  }
  const deck: CardExtId[] = [];
  const cardTypes: Record<CardExtId, RevealedCardType> = {};

  // --- 1. Villain cards (from listCards — FlatCard.key is the canonical ext_id) ---
  // why: config.villainGroupIds values match SetData.villains[].slug. FlatCard
  // keys encode this as {setAbbr}-villain-{groupSlug}-{cardSlug}. We use
  // listCards() because FlatCard.key is already the canonical ext_id format.
  const allFlatCards = registry.listCards();
  const villainFlatCards = filterFlatCardsByType(allFlatCards, 'villain');

  for (const groupSlug of config.villainGroupIds) {
    const groupCards = filterVillainCardsByGroupSlug(villainFlatCards, groupSlug);

    if (groupCards.length === 0) {
      throw new Error(
        `Villain group "${groupSlug}" not found in registry flat cards. ` +
        'Verify that the group slug in config.villainGroupIds matches a ' +
        'villain group in the loaded card sets.',
      );
    }

    for (const card of groupCards) {
      const extId = card.key as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'villain';
    }
  }

  // --- 2. Henchman virtual cards (from getSet — not in FlatCard) ---
  // why: config.henchmanGroupIds values match SetData.henchmen[].slug.
  // Henchmen are group-level only in the registry (z.unknown[]). We generate
  // HENCHMAN_COPIES_PER_GROUP virtual instances per group.
  for (const henchmanGroupId of config.henchmanGroupIds) {
    const groupSlug = findHenchmanGroupSlug(registry, henchmanGroupId);

    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      const extId = `henchman-${groupSlug}-${paddedIndex}` as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'henchman';
    }
  }

  // --- 3. Scheme twist virtual cards ---
  // why: config.schemeId matches SetData.schemes[].slug. Scheme twists are
  // generic in behaviour but scheme-scoped in identity for replay auditability.
  const schemeSlug = findSchemeSlug(registry, config.schemeId);

  for (let twistIndex = 0; twistIndex < SCHEME_TWIST_COUNT; twistIndex++) {
    const paddedIndex = String(twistIndex).padStart(2, '0');
    const extId = `scheme-twist-${schemeSlug}-${paddedIndex}` as CardExtId;
    deck.push(extId);
    cardTypes[extId] = 'scheme-twist';
  }

  // --- 4. Bystander virtual cards ---
  // why: bystander-villain-deck-{index} format chosen for consistency with
  // henchman and scheme twist patterns. Enables replay targeting of individual
  // bystander reveal events. Count = 1 per player (D-1412). This is separate
  // from config.bystandersCount which sizes the bystander pile (supply).
  const bystanderCount = context.ctx.numPlayers;

  for (let bystanderIndex = 0; bystanderIndex < bystanderCount; bystanderIndex++) {
    const paddedIndex = String(bystanderIndex).padStart(2, '0');
    const extId = `bystander-villain-deck-${paddedIndex}` as CardExtId;
    deck.push(extId);
    cardTypes[extId] = 'bystander';
  }

  // --- 5. Mastermind strike cards (from getSet — need tactic field) ---
  // why: config.mastermindId matches SetData.masterminds[].slug. tactic !== true
  // identifies strikes; this is a registry schema contract (D-1413), not a
  // heuristic. FlatCard.cardType is "mastermind" for all mastermind cards — the
  // strike vs tactic distinction comes from the tactic boolean field on
  // MastermindCard in the per-set data.
  const mastermindResult = findMastermindStrikes(registry, config.mastermindId);

  for (const strike of mastermindResult.strikes) {
    const extId = `${mastermindResult.setAbbr}-mastermind-${mastermindResult.mastermindSlug}-${strike.cardSlug}` as CardExtId;
    deck.push(extId);
    cardTypes[extId] = 'mastermind-strike';
  }

  // --- 6. Sort lexically for deterministic pre-shuffle ordering ---
  // why: registry list ordering may vary depending on load order. Stable
  // pre-shuffle ordering ensures the same inputs always generate the same
  // pre-shuffle sequence, making shuffleDeck fully deterministic.
  const sortedDeck = [...deck].sort();

  // --- 7. Shuffle ---
  // why: ctx.random.Shuffle provides deterministic shuffling seeded by
  // boardgame.io's PRNG, ensuring replay reproducibility.
  const shuffledDeck = shuffleDeck(sortedDeck, context);

  return {
    state: { deck: shuffledDeck, discard: [] },
    cardTypes,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for VillainDeckRegistryReader.
 *
 * Returns true if the registry object has the required methods (listCards
 * with full FlatCard shape, listSets, getSet). Narrow test mocks that only
 * implement CardRegistryReader will return false.
 */
function isVillainDeckRegistryReader(
  registry: unknown,
): registry is VillainDeckRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return (
    typeof candidate.listCards === 'function' &&
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

/**
 * Filters flat cards to only those with the given cardType.
 */
function filterFlatCardsByType(
  cards: VillainDeckFlatCard[],
  cardType: string,
): VillainDeckFlatCard[] {
  const result: VillainDeckFlatCard[] = [];
  for (const card of cards) {
    if (card.cardType === cardType) {
      result.push(card);
    }
  }
  return result;
}

/**
 * Filters villain flat cards by group slug extracted from the FlatCard key.
 *
 * FlatCard.key format: {setAbbr}-villain-{groupSlug}-{cardSlug}
 * We extract the groupSlug by removing the setAbbr prefix, "villain-" prefix,
 * and the cardSlug suffix.
 */
function filterVillainCardsByGroupSlug(
  villainCards: VillainDeckFlatCard[],
  targetGroupSlug: string,
): VillainDeckFlatCard[] {
  const result: VillainDeckFlatCard[] = [];

  for (const card of villainCards) {
    const groupSlug = extractVillainGroupSlug(card);
    if (groupSlug === targetGroupSlug) {
      result.push(card);
    }
  }

  return result;
}

/**
 * Extracts the villain group slug from a villain FlatCard.
 *
 * Key format: {setAbbr}-villain-{groupSlug}-{cardSlug}
 * We know setAbbr and cardSlug (card.slug), so groupSlug is the middle part.
 */
function extractVillainGroupSlug(card: VillainDeckFlatCard): string {
  const prefix = `${card.setAbbr}-villain-`;
  const suffix = `-${card.slug}`;

  if (!card.key.startsWith(prefix) || !card.key.endsWith(suffix)) {
    return '';
  }

  return card.key.slice(prefix.length, card.key.length - suffix.length);
}

/**
 * Finds a henchman group slug by searching all loaded sets.
 */
function findHenchmanGroupSlug(
  registry: VillainDeckRegistryReader,
  henchmanGroupId: string,
): string {
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr) as SetDataSubset | undefined;
    if (!setData) continue;

    if (!Array.isArray(setData.henchmen)) continue;

    for (const entry of setData.henchmen) {
      const henchman = entry as HenchmanGroupEntry;
      if (typeof henchman.slug !== 'string') continue;

      if (henchman.slug === henchmanGroupId) {
        return henchman.slug;
      }
    }
  }

  throw new Error(
    `Henchman group "${henchmanGroupId}" not found in any loaded set. ` +
    'Verify that the group slug in config.henchmanGroupIds matches a ' +
    'henchman entry in the loaded card sets.',
  );
}

/**
 * Finds a scheme slug by searching all loaded sets.
 */
function findSchemeSlug(
  registry: VillainDeckRegistryReader,
  schemeId: string,
): string {
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr) as SetDataSubset | undefined;
    if (!setData) continue;

    if (!Array.isArray(setData.schemes)) continue;

    for (const scheme of setData.schemes) {
      if (typeof scheme.slug !== 'string') continue;

      if (scheme.slug === schemeId) {
        return scheme.slug;
      }
    }
  }

  throw new Error(
    `Scheme "${schemeId}" not found in any loaded set. ` +
    'Verify that config.schemeId matches a scheme slug in the loaded card sets.',
  );
}

/**
 * Finds mastermind strike cards (tactic !== true) by searching all loaded sets.
 */
function findMastermindStrikes(
  registry: VillainDeckRegistryReader,
  mastermindId: string,
): { setAbbr: string; mastermindSlug: string; strikes: Array<{ cardSlug: string }> } {
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr) as SetDataSubset | undefined;
    if (!setData) continue;

    if (!Array.isArray(setData.masterminds)) continue;

    for (const mastermind of setData.masterminds) {
      if (typeof mastermind.slug !== 'string') continue;

      if (mastermind.slug !== mastermindId) continue;

      if (!Array.isArray(mastermind.cards)) {
        throw new Error(
          `Mastermind "${mastermindId}" has no cards array in set "${setEntry.abbr}".`,
        );
      }

      const strikes: Array<{ cardSlug: string }> = [];

      for (const card of mastermind.cards) {
        // why: tactic !== true identifies strikes; this is a registry schema
        // contract (D-1413), not a heuristic.
        if (card.tactic !== true) {
          if (typeof card.slug !== 'string') {
            throw new Error(
              `Mastermind card missing slug for mastermind "${mastermindId}" in set "${setEntry.abbr}".`,
            );
          }
          strikes.push({ cardSlug: card.slug });
        }
      }

      return {
        setAbbr: setEntry.abbr,
        mastermindSlug: mastermind.slug,
        strikes,
      };
    }
  }

  throw new Error(
    `Mastermind "${mastermindId}" not found in any loaded set. ` +
    'Verify that config.mastermindId matches a mastermind slug in the loaded card sets.',
  );
}
