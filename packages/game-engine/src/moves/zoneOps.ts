/**
 * Pure zone mutation helpers for the Legendary Arena game engine.
 *
 * All helpers return new arrays and never mutate their inputs. No
 * boardgame.io imports. No Math.random(). No .reduce().
 *
 * // why: Extracting zone operations into a standalone module makes them
 * // independently testable and keeps each move function under 30 lines.
 */

import type { CardExtId } from '../state/zones.types.js';

/**
 * Result of moving a single card between zones.
 *
 * from — the source zone with the card removed (new array)
 * to   — the destination zone with the card appended (new array)
 * found — whether the card was present in the source zone
 */
export interface MoveCardResult {
  /** Source zone after removal (new array). */
  from: CardExtId[];
  /** Destination zone after append (new array). */
  to: CardExtId[];
  /** Whether the card was found in the source zone. */
  found: boolean;
}

/**
 * Result of moving all cards between zones.
 *
 * from — always an empty array (all cards moved out)
 * to   — the destination zone with all source cards appended (new array)
 */
export interface MoveAllResult {
  /** Source zone after move (always empty). */
  from: CardExtId[];
  /** Destination zone with source cards appended (new array). */
  to: CardExtId[];
}

/**
 * Removes the first occurrence of cardId from fromZone and appends it to
 * toZone. Returns new arrays — inputs are never mutated.
 *
 * If cardId is not found in fromZone, both arrays are returned as copies
 * and found is false.
 *
 * @param fromZone - The source zone to remove the card from.
 * @param toZone - The destination zone to append the card to.
 * @param cardId - The ext_id of the card to move.
 * @returns New arrays and a flag indicating whether the card was found.
 */
export function moveCardFromZone(
  fromZone: CardExtId[],
  toZone: CardExtId[],
  cardId: CardExtId,
): MoveCardResult {
  const cardIndex = fromZone.indexOf(cardId);

  if (cardIndex === -1) {
    return {
      from: [...fromZone],
      to: [...toZone],
      found: false,
    };
  }

  const newFrom: CardExtId[] = [];
  let skipped = false;

  for (const card of fromZone) {
    if (!skipped && card === cardId) {
      skipped = true;
      continue;
    }
    newFrom.push(card);
  }

  return {
    from: newFrom,
    to: [...toZone, cardId],
    found: true,
  };
}

/**
 * Moves all cards from fromZone to the end of toZone. Returns new arrays —
 * inputs are never mutated.
 *
 * @param fromZone - The source zone to move all cards from.
 * @param toZone - The destination zone to append all cards to.
 * @returns New arrays with all cards moved.
 */
export function moveAllCards(
  fromZone: CardExtId[],
  toZone: CardExtId[],
): MoveAllResult {
  return {
    from: [],
    to: [...toZone, ...fromZone],
  };
}
