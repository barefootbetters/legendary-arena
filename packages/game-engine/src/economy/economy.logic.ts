/**
 * Economy logic for the Legendary Arena game engine.
 *
 * Pure helpers for parsing card stat values, building the card stats
 * lookup at setup time, and managing per-turn attack/recruit economy.
 *
 * No boardgame.io imports. No .reduce(). No throws. Setup-time only
 * for buildCardStats; runtime-safe for economy helpers.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { TurnEconomy, CardStatEntry } from './economy.types.js';

// ---------------------------------------------------------------------------
// CardStatsRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum methods
// needed for card stat resolution at setup time.

/**
 * Minimal structural type for a flat card returned by listCards().
 * Matches a subset of FlatCard from the registry package.
 *
 * Hero cards carry attack, recruit, and cost fields.
 * Villain/henchman vAttack is NOT on FlatCard — it comes from getSet().
 */
export interface CardStatsFlatCard {
  /** Unique key in format {setAbbr}-{cardType}-{groupSlug}-{cardSlug}. */
  key: string;
  /** Coarse card type: "hero", "mastermind", "villain", or "scheme". */
  cardType: string;
  /** Card-level slug within its parent entity. */
  slug: string;
  /** Set abbreviation (e.g., "core", "2099"). */
  setAbbr: string;
  /** Hero printed attack value. Undefined for non-hero cards. */
  attack?: string | number | null | undefined;
  /** Hero printed recruit value. Undefined for non-hero cards. */
  recruit?: string | number | null | undefined;
  /** Hero recruit cost. Undefined for non-hero cards. */
  cost?: string | number | undefined;
}

/**
 * Minimal structural type for a villain card entry in SetData.
 * Only the vAttack field is needed for card stats resolution.
 */
interface VillainCardEntry {
  slug: string;
  vAttack: string | number | null;
}

/**
 * Minimal structural type for a villain group in SetData.
 */
interface VillainGroupEntry {
  slug: string;
  cards: VillainCardEntry[];
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the fields needed for villain/henchman vAttack resolution.
 */
interface CardStatsSetData {
  abbr: string;
  villains: VillainGroupEntry[];
  henchmen: unknown[];
}

/**
 * Minimal structural type for a henchman group entry in SetData.
 */
interface HenchmanGroupEntry {
  slug: string;
  vAttack?: string | number | null;
}

/**
 * Setup-time registry interface for card stat resolution.
 *
 * Satisfied structurally by the real CardRegistry from the registry
 * package. Defined locally to respect the layer boundary (same pattern
 * as VillainDeckRegistryReader in villainDeck.setup.ts).
 */
export interface CardStatsRegistryReader {
  /** All flat cards across all loaded sets. */
  listCards(): CardStatsFlatCard[];
  /** All loaded set index entries. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// parseCardStatValue — deterministic parser
// ---------------------------------------------------------------------------

// why: ARCHITECTURE.md "Card Field Data Quality" — hero card fields
// contain modifier strings like "2+" and "2*"; strip modifier, parse
// integer base only. Conditional bonus semantics are WP-022.
/**
 * Parses a card stat value into a non-negative integer.
 *
 * Handles the real-world variety in card data: integers, strings with
 * trailing modifiers ("2+", "2*"), null, and undefined. Returns 0 for
 * any input that cannot be parsed to a valid non-negative integer.
 *
 * @param value - Raw card stat value from the registry.
 * @returns Non-negative integer base value.
 */
export function parseCardStatValue(
  value: string | number | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    const floored = Math.floor(value);
    // why: negative card data values are treated as 0 — all economy
    // values must be integers >= 0
    if (floored < 0) {
      return 0;
    }
    return floored;
  }

  // String: strip trailing '+' or '*' modifier, parse integer base
  const trimmed = value.replace(/[+*]$/, '');
  const parsed = parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// buildCardStats — setup-time card stat resolution
// ---------------------------------------------------------------------------

// why: mirrors G.villainDeckCardTypes pattern — resolve registry data
// at setup so moves never query registry at runtime
/**
 * Builds a card stats lookup from registry data at setup time.
 *
 * Iterates hero, villain, and henchman cards reachable from the match
 * config and parses their stat values into CardStatEntry records.
 *
 * @param registry - Setup-time registry reader. Accepts unknown to support
 *   narrow test mocks (CardRegistryReader). If the registry does not satisfy
 *   CardStatsRegistryReader structurally (missing listSets/getSet/full
 *   listCards), returns an empty record gracefully.
 * @param matchConfig - Match setup configuration with selected entity IDs.
 * @returns Record keyed by CardExtId with parsed stat values.
 */
export function buildCardStats(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): Record<CardExtId, CardStatEntry> {
  // why: narrow test mocks (CardRegistryReader) only have listCards() returning
  // { key: string }[]. We check for the full CardStatsRegistryReader interface
  // at runtime. If the registry doesn't have the required methods, we return
  // an empty record — moves handle missing cardStats entries gracefully (0/0).
  if (!isCardStatsRegistryReader(registry)) {
    return {};
  }
  const stats: Record<CardExtId, CardStatEntry> = {};

  // --- 1. Hero cards (from listCards — FlatCard has attack/recruit/cost) ---
  const allFlatCards = registry.listCards();
  const heroFlatCards = filterCardsByType(allFlatCards, 'hero');

  for (const heroDeckId of matchConfig.heroDeckIds) {
    const deckCards = filterHeroCardsByDeckSlug(heroFlatCards, heroDeckId);

    for (const card of deckCards) {
      const extId = card.key as CardExtId;
      stats[extId] = {
        attack: parseCardStatValue(card.attack),
        recruit: parseCardStatValue(card.recruit),
        cost: parseCardStatValue(card.cost),
        // why: heroes are never fought; fightCost is for villains only
        fightCost: 0,
      };
    }
  }

  // --- 2. Villain cards (from getSet — vAttack is not on FlatCard) ---
  for (const villainGroupId of matchConfig.villainGroupIds) {
    const villainCards = findVillainGroupCards(registry, villainGroupId);

    for (const villainCard of villainCards) {
      // why: villain ext_id format matches FlatCard key convention
      // {setAbbr}-villain-{groupSlug}-{cardSlug}
      const matchingFlatCard = findFlatCardForVillain(
        allFlatCards,
        villainGroupId,
        villainCard.slug,
      );

      if (matchingFlatCard) {
        const extId = matchingFlatCard.key as CardExtId;
        stats[extId] = {
          // why: villains do not generate resources or have recruit costs
          attack: 0,
          recruit: 0,
          cost: 0,
          fightCost: parseCardStatValue(villainCard.vAttack),
        };
      }
    }
  }

  // --- 3. Henchman cards (from getSet — group-level vAttack) ---
  // why: henchmen are virtual copies (WP-014B). Their ext_id format is
  // henchman-{groupSlug}-{index}. vAttack comes from the group definition,
  // not individual cards, because henchmen are identical within a group.
  for (const henchmanGroupId of matchConfig.henchmanGroupIds) {
    const henchmanResult = findHenchmanGroupVAttack(registry, henchmanGroupId);

    if (henchmanResult !== null) {
      const parsedFightCost = parseCardStatValue(henchmanResult.vAttack);

      // why: henchman virtual copies use index 00-09 (10 per group, per
      // WP-014B HENCHMAN_COPIES_PER_GROUP). Build stats for all copies.
      for (let copyIndex = 0; copyIndex < 10; copyIndex++) {
        const paddedIndex = String(copyIndex).padStart(2, '0');
        const extId = `henchman-${henchmanResult.groupSlug}-${paddedIndex}` as CardExtId;
        stats[extId] = {
          // why: henchmen do not generate resources or have recruit costs
          attack: 0,
          recruit: 0,
          cost: 0,
          fightCost: parsedFightCost,
        };
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Economy helpers — pure functions, return new objects
// ---------------------------------------------------------------------------

/**
 * Returns available (unspent) attack points.
 *
 * @param economy - Current turn economy state.
 * @returns Available attack points (attack minus spentAttack).
 */
export function getAvailableAttack(economy: TurnEconomy): number {
  return economy.attack - economy.spentAttack;
}

/**
 * Returns available (unspent) recruit points.
 *
 * @param economy - Current turn economy state.
 * @returns Available recruit points (recruit minus spentRecruit).
 */
export function getAvailableRecruit(economy: TurnEconomy): number {
  return economy.recruit - economy.spentRecruit;
}

/**
 * Adds attack and recruit resources to the economy.
 *
 * @param economy - Current turn economy state.
 * @param attack - Attack points to add.
 * @param recruit - Recruit points to add.
 * @returns New TurnEconomy with updated totals.
 */
export function addResources(
  economy: TurnEconomy,
  attack: number,
  recruit: number,
): TurnEconomy {
  return {
    attack: economy.attack + attack,
    recruit: economy.recruit + recruit,
    spentAttack: economy.spentAttack,
    spentRecruit: economy.spentRecruit,
  };
}

/**
 * Records an attack point spend.
 *
 * @param economy - Current turn economy state.
 * @param amount - Attack points to spend.
 * @returns New TurnEconomy with incremented spentAttack.
 */
export function spendAttack(
  economy: TurnEconomy,
  amount: number,
): TurnEconomy {
  return {
    attack: economy.attack,
    recruit: economy.recruit,
    spentAttack: economy.spentAttack + amount,
    spentRecruit: economy.spentRecruit,
  };
}

/**
 * Records a recruit point spend.
 *
 * @param economy - Current turn economy state.
 * @param amount - Recruit points to spend.
 * @returns New TurnEconomy with incremented spentRecruit.
 */
export function spendRecruit(
  economy: TurnEconomy,
  amount: number,
): TurnEconomy {
  return {
    attack: economy.attack,
    recruit: economy.recruit,
    spentAttack: economy.spentAttack,
    spentRecruit: economy.spentRecruit + amount,
  };
}

/**
 * Returns a fresh TurnEconomy with all values at zero.
 *
 * Called at the start of each player turn and during initial setup.
 *
 * @returns TurnEconomy with all fields set to 0.
 */
export function resetTurnEconomy(): TurnEconomy {
  return { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 };
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for CardStatsRegistryReader.
 *
 * Returns true if the registry object has the required methods (listCards,
 * listSets, getSet). Narrow test mocks that only implement
 * CardRegistryReader will return false.
 */
function isCardStatsRegistryReader(
  registry: unknown,
): registry is CardStatsRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return (
    typeof candidate.listCards === 'function' &&
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Filters flat cards to only those with the given cardType.
 */
function filterCardsByType(
  cards: CardStatsFlatCard[],
  cardType: string,
): CardStatsFlatCard[] {
  const result: CardStatsFlatCard[] = [];
  for (const card of cards) {
    if (card.cardType === cardType) {
      result.push(card);
    }
  }
  return result;
}

/**
 * Filters hero flat cards by hero deck slug.
 *
 * Hero FlatCard key format: {setAbbr}-hero-{heroSlug}-{slot}
 * heroDeckId matches the heroSlug portion of the key.
 */
function filterHeroCardsByDeckSlug(
  heroCards: CardStatsFlatCard[],
  heroDeckSlug: string,
): CardStatsFlatCard[] {
  const result: CardStatsFlatCard[] = [];
  for (const card of heroCards) {
    const heroSlug = extractHeroSlug(card);
    if (heroSlug === heroDeckSlug) {
      result.push(card);
    }
  }
  return result;
}

/**
 * Extracts the hero slug from a hero FlatCard.
 *
 * Key format: {setAbbr}-hero-{heroSlug}-{slot}
 * The heroSlug is between "hero-" and the last "-{slot}" segment.
 */
function extractHeroSlug(card: CardStatsFlatCard): string {
  const prefix = `${card.setAbbr}-hero-`;
  if (!card.key.startsWith(prefix)) {
    return '';
  }

  // why: slot is always the last segment after the final "-"
  const afterPrefix = card.key.slice(prefix.length);
  const lastDashIndex = afterPrefix.lastIndexOf('-');
  if (lastDashIndex === -1) {
    return '';
  }

  return afterPrefix.slice(0, lastDashIndex);
}

/**
 * Finds villain cards for a group by searching all sets via getSet().
 *
 * villainGroupId matches SetData.villains[].slug.
 */
function findVillainGroupCards(
  registry: CardStatsRegistryReader,
  villainGroupId: string,
): VillainCardEntry[] {
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr) as CardStatsSetData | undefined;
    if (!setData || !Array.isArray(setData.villains)) continue;

    for (const group of setData.villains) {
      if (group.slug === villainGroupId && Array.isArray(group.cards)) {
        return group.cards;
      }
    }
  }
  return [];
}

/**
 * Finds a FlatCard matching a villain card by group slug and card slug.
 *
 * Villain FlatCard key format: {setAbbr}-villain-{groupSlug}-{cardSlug}
 */
function findFlatCardForVillain(
  allFlatCards: CardStatsFlatCard[],
  villainGroupSlug: string,
  cardSlug: string,
): CardStatsFlatCard | undefined {
  for (const card of allFlatCards) {
    if (card.cardType !== 'villain') continue;

    // Check if this card's key contains the group slug and card slug
    const prefix = `${card.setAbbr}-villain-`;
    if (!card.key.startsWith(prefix)) continue;

    const afterPrefix = card.key.slice(prefix.length);
    const expectedSuffix = `-${cardSlug}`;

    if (afterPrefix.endsWith(expectedSuffix)) {
      const extractedGroupSlug = afterPrefix.slice(
        0,
        afterPrefix.length - expectedSuffix.length,
      );
      if (extractedGroupSlug === villainGroupSlug) {
        return card;
      }
    }
  }
  return undefined;
}

/**
 * Finds henchman group vAttack by searching all sets via getSet().
 *
 * henchmanGroupId matches SetData.henchmen[].slug.
 * Returns the group slug and vAttack value, or null if not found.
 */
function findHenchmanGroupVAttack(
  registry: CardStatsRegistryReader,
  henchmanGroupId: string,
): { groupSlug: string; vAttack: string | number | null } | null {
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr);
    if (!setData || typeof setData !== 'object') continue;

    const castSetData = setData as { henchmen?: unknown[] };
    if (!Array.isArray(castSetData.henchmen)) continue;

    for (const entry of castSetData.henchmen) {
      if (!entry || typeof entry !== 'object') continue;

      const henchmanEntry = entry as HenchmanGroupEntry;
      if (henchmanEntry.slug === henchmanGroupId) {
        return {
          groupSlug: henchmanEntry.slug,
          vAttack: henchmanEntry.vAttack ?? null,
        };
      }
    }
  }
  return null;
}
