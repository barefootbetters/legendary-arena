/**
 * Abomination fight-cost terms (WP-815 / D-24747).
 *
 * Abomination: a Villain gets +Attack equal to the printed Attack of the Hero
 * in the HQ space under its City space. Double Abomination doubles that.
 * Ultimate Abomination: the Mastermind gets +Attack equal to the total printed
 * Attack of all the Heroes in the HQ. Double Highest Abomination: the
 * Mastermind gets +Attack equal to twice the highest printed Attack among the
 * Heroes in the HQ.
 *
 * The kinds are flagged once at setup into G.cardAbomination
 * (setup/buildCardAbomination.ts). resolveFightCost adds the villain term and
 * resolveMastermindFightCost adds the mastermind term; nothing else reads them.
 *
 * Pure: reads G, never mutates it, never throws. No boardgame.io imports.
 * No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { hqSlotIndexUnderCitySpace } from '../board/citySpaceNames.js';
import { offPlayCardStats } from '../hero/splitCard.logic.js';

/** One of the four Abomination forms a Villain or Mastermind can print. */
export type AbominationKind =
  | 'abomination'
  | 'double-abomination'
  | 'ultimate-abomination'
  | 'double-highest-abomination';

/** The four Abomination kinds, in canonical order (drift-pinned against AbominationKind). */
export const ABOMINATION_KINDS: readonly AbominationKind[] = [
  'abomination',
  'double-abomination',
  'ultimate-abomination',
  'double-highest-abomination',
];

/**
 * Returns the printed Attack of a Hero card outside play.
 *
 * @param G - Game state (read-only).
 * @param heroId - The Hero card instance ext_id (an HQ slot).
 * @returns The printed Attack, or 0 when the card has no stats.
 */
function printedHeroAttack(G: LegendaryGameState, heroId: CardExtId): number {
  // why: "printed" Attack drops the trailing `+`, and a Divided card adds both
  // halves (rules v23 Divided Cards); offPlayCardStats is the off-play view that
  // does both. Granted or temporary Attack never counts.
  return offPlayCardStats(G, heroId)?.attack ?? 0;
}

/**
 * The Abomination / Double Abomination attack bonus for a Villain.
 *
 * Reads the Villain's current City space and the HQ slot under it, so the cost
 * moves as the Villain moves and as the HQ refills. A Villain not in the City,
 * an empty HQ slot, or a Villain with no villain-family Abomination kind gets 0.
 *
 * @param G - Game state (read-only).
 * @param villainCardId - The villain zone-instance ext_id.
 * @returns The bonus attack, or 0.
 */
export function villainAbominationBonus(G: LegendaryGameState, villainCardId: CardExtId): number {
  const kind = G.cardAbomination?.[villainCardId];
  if (kind !== 'abomination' && kind !== 'double-abomination') {
    return 0;
  }
  // why: rules v23 L880-926 — the cost "can go up and down as the Villain moves
  // through the city", so the City index and the HQ slot are read at fight time on
  // every call and never cached in G. The `?.` / `?? -1` mirror the partial-G
  // tolerance of the other resolver terms.
  const cityIndex = G.city?.indexOf(villainCardId) ?? -1;
  if (cityIndex < 0) {
    return 0;
  }
  const hqIndex = hqSlotIndexUnderCitySpace(cityIndex);
  if (hqIndex === undefined) {
    return 0;
  }
  const heroId = G.hq?.[hqIndex];
  if (heroId === null || heroId === undefined) {
    return 0;
  }
  const printed = printedHeroAttack(G, heroId);
  if (kind === 'double-abomination') {
    return 2 * printed;
  }
  return printed;
}

/**
 * The Ultimate Abomination / Double Highest Abomination attack bonus for the Mastermind.
 *
 * Ultimate Abomination adds the total printed Attack of every Hero in the HQ;
 * Double Highest Abomination adds twice the highest. Empty HQ slots are skipped.
 * A Mastermind with no mastermind-family Abomination kind gets 0.
 *
 * @param G - Game state (read-only).
 * @returns The bonus attack, or 0.
 */
export function mastermindAbominationBonus(G: LegendaryGameState): number {
  const baseCardId = G.mastermind?.baseCardId;
  if (baseCardId === undefined) {
    return 0;
  }
  const kind = G.cardAbomination?.[baseCardId];
  if (kind !== 'ultimate-abomination' && kind !== 'double-highest-abomination') {
    return 0;
  }
  const hqSlots = G.hq ?? [];
  let totalPrinted = 0;
  let highestPrinted = 0;
  for (const heroId of hqSlots) {
    if (heroId === null || heroId === undefined) {
      continue;
    }
    const printed = printedHeroAttack(G, heroId);
    totalPrinted += printed;
    if (printed > highestPrinted) {
      highestPrinted = printed;
    }
  }
  if (kind === 'ultimate-abomination') {
    return totalPrinted;
  }
  return 2 * highestPrinted;
}
