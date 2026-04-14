/**
 * Board keyword helpers for the Legendary Arena game engine.
 *
 * Pure helpers for Patrol, Guard, and Ambush keyword evaluation.
 * No boardgame.io imports. No registry imports. No .reduce().
 * These helpers return values — they never mutate game state.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { CityZone } from './city.types.js';
import type { BoardKeyword } from './boardKeywords.types.js';

/**
 * Returns board keywords for a card, or empty array if none.
 *
 * @param cardId - The card's ext_id.
 * @param cardKeywords - The keyword lookup from G.cardKeywords.
 * @returns Array of keywords, or empty array if none assigned.
 */
export function getCardKeywords(
  cardId: CardExtId,
  cardKeywords: Record<CardExtId, BoardKeyword[]>,
): BoardKeyword[] {
  return cardKeywords[cardId] ?? [];
}

/**
 * Returns additional fight cost for a card with Patrol.
 *
 * // why: Patrol adds a fixed +1 attack requirement (MVP value). This is
 * additive on top of the card's base fightCost from G.cardStats.
 *
 * @param cardId - The card's ext_id.
 * @param cardKeywords - The keyword lookup from G.cardKeywords.
 * @returns 1 if the card has Patrol, 0 otherwise.
 */
export function getPatrolModifier(
  cardId: CardExtId,
  cardKeywords: Record<CardExtId, BoardKeyword[]>,
): number {
  const keywords = getCardKeywords(cardId, cardKeywords);

  for (const keyword of keywords) {
    if (keyword === 'patrol') {
      return 1;
    }
  }

  return 0;
}

/**
 * Returns true if a Guard card at a higher index blocks the target.
 *
 * // why: Guard blocking direction — Guard at a higher City index (closer
 * to the escape edge at space 4) blocks fighting cards at lower indices
 * (further from escape). The Guard card itself is NOT blocked (you can
 * fight the Guard to remove the blocker).
 *
 * @param city - The current City zone (5-tuple).
 * @param targetIndex - The index of the card the player wants to fight.
 * @param cardKeywords - The keyword lookup from G.cardKeywords.
 * @returns True if a Guard blocks the target, false otherwise.
 */
export function isGuardBlocking(
  city: CityZone,
  targetIndex: number,
  cardKeywords: Record<CardExtId, BoardKeyword[]>,
): boolean {
  for (let index = targetIndex + 1; index <= 4; index++) {
    const cardAtSpace = city[index];

    if (cardAtSpace === null || cardAtSpace === undefined) {
      continue;
    }

    const keywords = getCardKeywords(cardAtSpace, cardKeywords);

    for (const keyword of keywords) {
      if (keyword === 'guard') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if a card has the Ambush keyword.
 *
 * // why: Ambush wound gain is inline in the reveal pipeline (not via
 * RuleEffect) because no 'gainWound' RuleEffect type exists. This helper
 * identifies Ambush cards; the reveal pipeline calls gainWound directly
 * for each player (same pattern as escape wounds). Future WP may add
 * 'gainWound' to the RuleEffect union and migrate to pipeline (D-2403).
 *
 * @param cardId - The card's ext_id.
 * @param cardKeywords - The keyword lookup from G.cardKeywords.
 * @returns True if the card has Ambush, false otherwise.
 */
export function hasAmbush(
  cardId: CardExtId,
  cardKeywords: Record<CardExtId, BoardKeyword[]>,
): boolean {
  const keywords = getCardKeywords(cardId, cardKeywords);

  for (const keyword of keywords) {
    if (keyword === 'ambush') {
      return true;
    }
  }

  return false;
}
