/**
 * Variable-Attack villain passives (WP-841 / D-24774).
 *
 * A Villain whose card prints "<Villain> gets +N Attack …" as a passive gets that
 * bonus at fight time. Three sources cover the co2e cards:
 *
 * - `flat`: +N, gated to named City spaces (Hydro-Man: +2 in the Sewers and Bridge).
 * - `per-other-hydra-villain`: +N for each other HYDRA Villain in the City and/or
 *   the Escape Pile (Baron Strucker, Supreme Hydra).
 * - `per-hq-hero-class`: +N for each Hero Class among the Heroes in the HQ (Paibok
 *   the Power Skrull, Super-Skrull).
 *
 * The entries are built once at setup into G.villainVariableAttack from the curated
 * `[variable-attack:<source>:<N>[@<space>[+<space>…]]]` marker
 * (setup/villainDefeatRequirement.setup.ts). resolveFightCost adds the term;
 * nothing else reads the table.
 *
 * Pure: reads G, never mutates it, never throws. No boardgame.io imports.
 * No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CitySpaceName } from '../board/citySpaceNames.js';
import { citySpaceNameForIndex } from '../board/citySpaceNames.js';
import { offPlayCardTraits } from '../hero/splitCard.logic.js';
// why: D-3303 — HERO_CLASSES is the engine's canonical list of the five Hero Classes;
// this is its first runtime consumer outside author-facing content validation.
import { HERO_CLASSES } from '../content/content.schemas.js';

/** What a variable-Attack passive counts. */
export type VillainVariableAttackSource = 'flat' | 'per-other-hydra-villain' | 'per-hq-hero-class';

/** The three variable-Attack sources, in canonical order (drift-pinned against the union). */
export const VILLAIN_VARIABLE_ATTACK_SOURCES: readonly VillainVariableAttackSource[] = [
  'flat',
  'per-other-hydra-villain',
  'per-hq-hero-class',
];

/** One villain copy's variable-Attack passive. Built at setup, read-only. */
export interface VillainVariableAttack {
  source: VillainVariableAttackSource;
  attackPerUnit: number;
  /** When present, the bonus applies only while the Villain is on one of these City spaces. */
  requireCitySpaces?: CitySpaceName[];
}

/**
 * Checks whether a card is a HYDRA Villain: a Villain or Henchman whose card name
 * or Villain Group name contains "HYDRA".
 *
 * @param G - Game state (read-only).
 * @param cardId - A card instance ext_id (a City or Escape Pile entry).
 * @returns True when the card is a HYDRA Villain.
 */
export function isHydraVillainCard(G: LegendaryGameState, cardId: CardExtId): boolean {
  // why: rules v23 L1146-1148 — a card converted into a Villain (a Killbot Bystander,
  // a Skrull Hero, a Brainwashed Officer) has no Villain Group, so it is never HYDRA.
  if (G.convertedVillainOrigins?.[cardId] !== undefined) {
    return false;
  }
  // why: rules v23 L2923 — Henchmen are Villains. villainDeckCardTypes types every
  // Villain-Deck card for the whole match, so an escaped Villain keeps its type; an
  // untyped id (a carried Bystander or captured Hero in the Escape Pile) is not one.
  const cardType = G.villainDeckCardTypes?.[cardId];
  if (cardType !== 'villain' && cardType !== 'henchman') {
    return false;
  }
  // why: Operator fork F1 — HYDRA by card name or Villain Group name, the reading the
  // engine uses for S.H.I.E.L.D. / HYDRA Levels (D-24493). The id carries both the
  // group slug and the card slug, each derived from the printed name, so one
  // substring test covers both. "hydro" (Hydro-Man) does not match.
  return cardId.toLowerCase().includes('hydra');
}

/**
 * Counts the other HYDRA Villains in the City and the Escape Pile.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The fought villain's instance ext_id (excluded from the count).
 * @returns The number of other HYDRA Villains.
 */
export function countOtherHydraVillains(G: LegendaryGameState, villainCardId: CardExtId): number {
  // why: "other" excludes only the fought copy itself; the second copy of the same
  // card is another HYDRA Villain and counts. Each id is counted once, even if a
  // malformed state listed it in both zones.
  const countedIds: CardExtId[] = [];
  const candidateIds: CardExtId[] = [];
  for (const cityCardId of G.city ?? []) {
    if (cityCardId !== null && cityCardId !== undefined) {
      candidateIds.push(cityCardId);
    }
  }
  for (const escapedCardId of G.escapedPile ?? []) {
    candidateIds.push(escapedCardId);
  }
  for (const candidateId of candidateIds) {
    if (candidateId === villainCardId || !isHydraVillainCard(G, candidateId)) {
      continue;
    }
    let isAlreadyCounted = false;
    for (const countedId of countedIds) {
      if (countedId === candidateId) {
        isAlreadyCounted = true;
      }
    }
    if (!isAlreadyCounted) {
      countedIds.push(candidateId);
    }
  }
  return countedIds.length;
}

/**
 * Checks whether a string is one of the five Hero Classes.
 *
 * @param value - The candidate class slug.
 * @returns True when value is a member of HERO_CLASSES.
 */
function isHeroClass(value: string): boolean {
  for (const heroClass of HERO_CLASSES) {
    if (heroClass === value) {
      return true;
    }
  }
  return false;
}

/**
 * Counts the distinct Hero Classes among the Heroes in the HQ.
 *
 * @param G - Game state (read-only).
 * @returns The number of distinct Hero Classes (0 to 5).
 */
export function countHqHeroClasses(G: LegendaryGameState): number {
  // why: rules v23 L2742-2752 — grey cards (Officers, Sidekicks, …) have no Class, so
  // only HERO_CLASSES members count. A dual-class card and, off play, a Divided card
  // (L2774-2777, via offPlayCardTraits) count both of their classes.
  const seenClasses: string[] = [];
  for (const heroId of G.hq ?? []) {
    if (heroId === null || heroId === undefined) {
      continue;
    }
    const traits = offPlayCardTraits(G, heroId);
    if (traits === undefined) {
      continue;
    }
    const cardClasses = [traits.heroClass, traits.heroClass2];
    for (const heroClass of cardClasses) {
      if (typeof heroClass !== 'string' || !isHeroClass(heroClass)) {
        continue;
      }
      let isAlreadySeen = false;
      for (const seenClass of seenClasses) {
        if (seenClass === heroClass) {
          isAlreadySeen = true;
        }
      }
      if (!isAlreadySeen) {
        seenClasses.push(heroClass);
      }
    }
  }
  return seenClasses.length;
}

/**
 * Checks whether a City space name is one of a gate's listed spaces.
 *
 * @param spaceName - The villain's current City space name.
 * @param requireCitySpaces - The gate's listed spaces.
 * @returns True when spaceName is listed.
 */
function isListedCitySpace(spaceName: CitySpaceName, requireCitySpaces: CitySpaceName[]): boolean {
  for (const listedSpace of requireCitySpaces) {
    if (listedSpace === spaceName) {
      return true;
    }
  }
  return false;
}

/**
 * The variable-Attack bonus for a Villain, read at fight time.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns The bonus attack, or 0 when the villain has no entry or is off its gate.
 */
export function villainVariableAttackBonus(G: LegendaryGameState, villainCardId: CardExtId): number {
  const entry = G.villainVariableAttack?.[villainCardId];
  if (entry === undefined) {
    return 0;
  }
  if (entry.requireCitySpaces !== undefined) {
    // why: D-24764 — the gate fails closed outside the City and on a sixth City space,
    // which has no name; citySpaceNameForIndex returns undefined for both.
    const cityIndex = G.city?.indexOf(villainCardId) ?? -1;
    const spaceName = citySpaceNameForIndex(cityIndex);
    if (spaceName === undefined || !isListedCitySpace(spaceName, entry.requireCitySpaces)) {
      return 0;
    }
  }
  if (entry.source === 'flat') {
    return entry.attackPerUnit;
  }
  if (entry.source === 'per-other-hydra-villain') {
    return entry.attackPerUnit * countOtherHydraVillains(G, villainCardId);
  }
  return entry.attackPerUnit * countHqHeroClasses(G);
}
