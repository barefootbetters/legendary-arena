/**
 * "Heroes currently in the HQ cost N less / more this turn" (WP-868 / D-24811).
 *
 * Four villain lines change the recruit price of the Heroes in the HQ for the rest of the turn:
 * - chmp Tim Boo Ba (Fight) and asrd Jormungand (Fight): every Hero in the HQ costs 1 less.
 * - vnom Dr. Carlton Drake (Fight): each Instinct and Tech Hero in the HQ costs 1 less.
 * - msis The Mind Stone (Ambush): every Hero in the HQ costs 2 more.
 *
 * Each change is one entry on G.hqCostChanges, keyed by the copy-unique HQ instance. The
 * recruit price (resolveRecruitCost, sizeChanging.logic.ts) adds the summed amount only while the
 * card is in the HQ, floors at 0, and then applies Size-Changing. End-of-turn cleanup deletes the
 * whole overlay.
 *
 * No boardgame.io import, no registry, no .reduce(), never throws.
 */

import type { HqCostChange, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Appends one recruit-price change for an HQ Hero, creating the overlay on first use.
 *
 * // why: the overlay is lazy so a match that never fires one of these lines keeps a
 * byte-identical finalStateHash (the WP-862 hqSizeChangingGrants precedent).
 *
 * @param G - Game state, mutated in place.
 * @param change - The HQ instance and its signed price delta.
 */
export function addHqCostChange(G: LegendaryGameState, change: HqCostChange): void {
  if (G.hqCostChanges === undefined) {
    G.hqCostChanges = [];
  }
  G.hqCostChanges.push({ cardId: change.cardId, amount: change.amount });
}

/**
 * Returns the summed recruit-price change for a card while it sits in the HQ.
 *
 * // why: D-24811 — "currently in the HQ" snapshots the Heroes when the line fires; the change
 * belongs to the card only while it is still in the HQ. Once it is recruited (or otherwise
 * leaves) the entry is inert, so the price of that copy anywhere else is its printed cost.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The card to price.
 * @returns The signed sum of every change on the card, or 0 when none applies.
 */
export function getHqCostChange(G: LegendaryGameState, cardId: CardExtId): number {
  const changes = G.hqCostChanges;
  if (changes === undefined || !G.hq.includes(cardId)) {
    return 0;
  }
  let total = 0;
  for (const change of changes) {
    if (change.cardId === cardId) {
      total += change.amount;
    }
  }
  return total;
}

/**
 * Deletes every HQ recruit-price change at end-of-turn cleanup.
 *
 * // why: every printed change lasts "this turn", so the whole overlay goes; the key is deleted
 * rather than emptied so the game returns to the omit-when-absent shape.
 *
 * @param G - Game state, mutated in place.
 */
export function clearHqCostChanges(G: LegendaryGameState): void {
  if (G.hqCostChanges !== undefined) {
    delete G.hqCostChanges;
  }
}
