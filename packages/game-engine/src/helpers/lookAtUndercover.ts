/**
 * Helper to reveal a face-down card's identity for testing (WP-282 / EC-313).
 *
 * Returns the real CardExtId of a face-down card without mutating G.
 * Used by tests to verify that card identity is stored correctly and
 * remains deterministic across replays.
 *
 * No boardgame.io imports. No G mutation. Test-only helper.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Returns the real CardExtId (template identity) of a face-down card.
 *
 * Searches the current player's faceDownCards for a card matching the
 * given instanceId and returns its cardId. Returns empty string if not found.
 * No G mutation — purely diagnostic.
 *
 * @param G - The game state.
 * @param playerID - The player whose face-down store to search.
 * @param instanceId - The instance identifier of the face-down card.
 * @returns The card's template identity (cardId), or empty string if not found.
 */
export function lookAtUndercover(
  G: LegendaryGameState,
  playerID: string,
  instanceId: string,
): CardExtId {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return '';
  }

  const faceDownCard = playerZones.faceDownCards.find((card) => card.instanceId === instanceId);
  return faceDownCard ? faceDownCard.cardId : '';
}
