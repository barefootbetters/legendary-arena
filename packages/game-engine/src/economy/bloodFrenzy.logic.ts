/**
 * Blood Frenzy — the distinct Victory Point values in a player's Victory Pile
 * (WP-765 / D-24598).
 *
 * "You get +1 Attack for each different Victory Point value among the cards in
 * your Victory Pile." Only the number of DIFFERENT values matters, not how many
 * cards carry each.
 *
 * // why: this is the SHARED Blood Frenzy authority. Hero Blood Frenzy (WP-765)
 * and the villain fight-cost Blood Frenzy (WP-760) both consume it; neither
 * re-implements it. `victoryPointValueForCard` mirrors `computeFinalScores`'
 * per-card branch order exactly (duplicate first — scoring is NOT refactored),
 * and a parity test pins the mirror against the scoring breakdown.
 *
 * Pure: reads G, never mutates it, never throws. No boardgame.io imports.
 * No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  VP_VILLAIN,
  VP_HENCHMAN,
  VP_BYSTANDER,
  VP_TACTIC,
  VP_UNDERCOVER,
} from '../scoring/scoring.types.js';
import { isBystanderCard } from '../scoring/scoring.logic.js';
import { computeDynamicVillainVictoryPoints } from '../scoring/dynamicVictoryPoints.js';

/**
 * Returns the Victory Point value a card in a player's Victory Pile scores, or
 * null when the card carries no VP value.
 *
 * // why: mirrors computeFinalScores (scoring/scoring.logic.ts) branch for branch:
 * 1. villain — the dynamic-VP resolver, then printed `cardVictoryPoints`, then VP_VILLAIN;
 * 2. henchman — printed, then VP_HENCHMAN;
 * 3. bystander (either source, via isBystanderCard) — VP_BYSTANDER;
 * 4. a Mastermind tactic THIS player defeated — the mastermind's printed VP, then VP_TACTIC;
 * 5. a card this player sent Undercover — VP_UNDERCOVER (scoring counts these from
 *    `zones.undercover`; they sit in the Victory Pile and fall through the villain /
 *    henchman / bystander / tactic branches, so they are checked last).
 * Anything else (scheme twists, strikes, Heroes, starting cards) is null.
 *
 * @param G - Current game state (read-only).
 * @param playerId - The player whose Victory Pile the card is in.
 * @param cardId - The card in that Victory Pile.
 * @returns The card's VP value, or null for a card that scores no VP value.
 */
export function victoryPointValueForCard(
  G: LegendaryGameState,
  playerId: string,
  cardId: CardExtId,
): number | null {
  const zones = G.playerZones[playerId];
  if (!zones) {
    return null;
  }
  const cardType = G.villainDeckCardTypes[cardId];

  if (cardType === 'villain') {
    const allPlayerCardIds = [
      ...zones.deck,
      ...zones.hand,
      ...zones.discard,
      ...zones.inPlay,
      ...zones.victory,
    ];
    const dynamicVp = computeDynamicVillainVictoryPoints(
      cardId,
      zones.victory,
      allPlayerCardIds,
      G.cardTraits,
    );
    if (dynamicVp !== null) {
      return dynamicVp;
    }
    return G.cardVictoryPoints?.[cardId] ?? VP_VILLAIN;
  }
  if (cardType === 'henchman') {
    return G.cardVictoryPoints?.[cardId] ?? VP_HENCHMAN;
  }
  if (isBystanderCard(G, cardId)) {
    return VP_BYSTANDER;
  }
  if (G.mastermind.tacticsDefeated.includes(cardId)) {
    return G.cardVictoryPoints?.[G.mastermind.baseCardId] ?? VP_TACTIC;
  }
  // why: `?? []` guards a reconstructed pre-WP-678 state with no undercover tracker
  // (the same guard scoring uses); a live match always has it.
  const undercover = zones.undercover ?? [];
  if (undercover.includes(cardId)) {
    return VP_UNDERCOVER;
  }
  return null;
}

/**
 * Counts the distinct Victory Point values among the cards in a player's
 * Victory Pile — the Blood Frenzy count.
 *
 * Zero and negative printed values count as values; a card with no VP value
 * (null) does not. Two cards with the same value count once.
 *
 * @param G - Current game state (read-only).
 * @param playerId - The player whose Victory Pile is counted.
 * @returns The number of distinct non-null VP values (0 for an empty or absent pile).
 */
export function countDistinctVictoryPointValues(
  G: LegendaryGameState,
  playerId: string,
): number {
  const zones = G.playerZones[playerId];
  if (!zones) {
    return 0;
  }
  const distinctValues = new Set<number>();
  for (const cardId of zones.victory) {
    const value = victoryPointValueForCard(G, playerId, cardId);
    if (value !== null) {
      distinctValues.add(value);
    }
  }
  return distinctValues.size;
}
