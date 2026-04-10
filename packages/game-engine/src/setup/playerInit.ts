/**
 * Player state initialization for Legendary Arena setup.
 *
 * Constructs a typed PlayerState from a player ID and starting deck.
 * This is a setup-time helper only — no gameplay logic, no validation.
 *
 * No boardgame.io imports allowed — this is a pure helper module.
 */

import type { CardExtId, PlayerState, PlayerZones } from '../state/zones.types.js';
import type { ShuffleProvider } from './shuffle.js';
import { shuffleDeck } from './shuffle.js';

/**
 * Builds the initial PlayerState for one player.
 *
 * Shuffles the starting deck using the deterministic RNG and initializes
 * all other zones as empty arrays.
 *
 * @param playerId - The player's unique identifier ("0", "1", etc.).
 * @param startingDeck - Unshuffled array of CardExtId strings for this player.
 * @param context - Shuffle provider with deterministic RNG.
 * @returns A fully initialized PlayerState with shuffled deck and empty zones.
 */
export function buildPlayerState(
  playerId: string,
  startingDeck: CardExtId[],
  context: ShuffleProvider,
): PlayerState {
  const shuffledDeck = shuffleDeck(startingDeck, context);

  // why: Cards enter non-deck zones (hand, discard, inPlay, victory) exclusively
  // through game moves — never through setup initialization. Pre-populating them
  // would bypass the move validation contract and break replay determinism.
  const zones: PlayerZones = {
    deck: shuffledDeck,
    hand: [],
    discard: [],
    inPlay: [],
    victory: [],
  };

  return {
    playerId,
    zones,
  };
}
