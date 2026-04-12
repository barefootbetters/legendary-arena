/**
 * Wound gain helper for the Legendary Arena game engine.
 *
 * gainWound moves the top wound from the shared wounds pile into a player's
 * discard zone. Uses the locked supply pile convention: pile[0] is the top
 * card, removed via pile.slice(1).
 *
 * Pure function. No boardgame.io import. No side effects.
 */

import type { CardExtId } from '../state/zones.types.js';

/** Result of a gainWound operation. */
export interface GainWoundResult {
  /** Updated wounds supply pile (top card removed if available). */
  woundsPile: CardExtId[];
  /** Updated player discard zone (wound appended if available). */
  playerDiscard: CardExtId[];
}

/**
 * Moves the top wound from the supply pile into the player's discard zone.
 *
 * If the wounds pile is empty, both arrays are returned unchanged
 * (deterministic no-op).
 *
 * @param woundsPile - The shared wounds supply pile.
 * @param playerDiscard - The player's discard zone.
 * @returns New arrays for both the pile and discard.
 */
export function gainWound(
  woundsPile: CardExtId[],
  playerDiscard: CardExtId[],
): GainWoundResult {
  // why: empty pile means no wound to give; deterministic no-op
  if (woundsPile.length === 0) {
    return { woundsPile: [...woundsPile], playerDiscard: [...playerDiscard] };
  }

  const woundCardId = woundsPile[0]!;
  return {
    woundsPile: woundsPile.slice(1),
    playerDiscard: [...playerDiscard, woundCardId],
  };
}
