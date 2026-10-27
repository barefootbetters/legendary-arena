import type { UICityState } from '@legendary-arena/game-engine';

/**
 * Fight discard eligibility for the viewer's hand (WP-817 / D-24750).
 *
 * A City villain with `fightDiscardCosts` (Primus) is fought by also discarding
 * a hand card of one of those costs. CityRow already gates Fight on this and
 * shows a "Discard 2/3/5/7" cue on the villain; this helper lets HandRow mark
 * the hand cards that would pay it, so a player can see which ones to hold back.
 */

/**
 * Lists the viewer's hand cards that could pay a fight discard cost of any
 * villain now in the City.
 *
 * @param city - The projected City (`UIState.city`).
 * @param handCards - The viewer's hand ext_ids (`UIPlayerState.handCards`), or
 *   `undefined` when redacted or absent.
 * @param handCosts - The engine cost per hand card, index-aligned with
 *   `handCards` (`UIPlayerState.handCosts`), or `undefined` when absent.
 * @param isViewerTurn - Whether it is the viewer's turn.
 * @returns The eligible card ext_ids, each once, in hand order. Empty off-turn,
 *   with no discard-cost villain in the City, or with no hand costs.
 */
export function fightDiscardEligibleCardIds(
  city: UICityState | undefined,
  handCards: readonly string[] | undefined,
  handCosts: readonly (number | null)[] | undefined,
  isViewerTurn: boolean,
): string[] {
  // why: the mark tells the active player what to hold back for a fight this
  // turn; on another player's turn they cannot fight, so the hand stays plain.
  if (!isViewerTurn || city === undefined || handCards === undefined || handCosts === undefined) {
    return [];
  }
  const discardCosts: number[] = [];
  for (const space of city.spaces) {
    if (space === null || space.fightDiscardCosts === undefined) {
      continue;
    }
    for (const cost of space.fightDiscardCosts) {
      if (!discardCosts.includes(cost)) {
        discardCosts.push(cost);
      }
    }
  }
  if (discardCosts.length === 0) {
    return [];
  }
  const eligibleCardIds: string[] = [];
  for (let handIndex = 0; handIndex < handCards.length; handIndex++) {
    // why: handCosts is the engine cost (what the fightVillain guard reads), never
    // display.cost, which is null for Officers and Sidekicks.
    const cost = handCosts[handIndex];
    const cardId = handCards[handIndex]!;
    if (typeof cost === 'number' && discardCosts.includes(cost) && !eligibleCardIds.includes(cardId)) {
      eligibleCardIds.push(cardId);
    }
  }
  return eligibleCardIds;
}
