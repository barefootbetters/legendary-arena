/**
 * KO pile helper for the Legendary Arena game engine.
 *
 * koCard is a destination-only append helper. It adds a card to the KO pile
 * without searching or removing from any source zone — the caller is
 * responsible for removing the card from its source before calling.
 *
 * Pure function. No boardgame.io import. No side effects.
 */

import type { CardExtId } from '../state/zones.types.js';

/**
 * Appends a card to the KO pile.
 *
 * Destination-only: does not search source zones or verify card existence.
 * Caller must remove the card from its source zone before calling.
 *
 * @param koPile - The current KO pile.
 * @param cardId - The card to knock out.
 * @returns A new array with cardId appended.
 */
// why: KO is a one-way destination; cards never return in MVP
export function koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[] {
  return [...koPile, cardId];
}
