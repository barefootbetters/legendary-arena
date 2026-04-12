/**
 * Bystander capture helpers for the Legendary Arena game engine.
 *
 * Three pure functions for the bystander lifecycle:
 * - attachBystanderToVillain: attach one bystander on City entry
 * - awardAttachedBystanders: award bystanders to player on villain defeat
 * - resolveEscapedBystanders: return bystanders to supply on villain escape
 *
 * All functions return new objects and never mutate inputs.
 * No boardgame.io import. No side effects.
 */

import type { CardExtId } from '../state/zones.types.js';

/** Result of an attachBystanderToVillain operation. */
export interface AttachBystanderResult {
  /** Updated bystanders supply pile (top card removed if available). */
  bystandersPile: CardExtId[];
  /** Updated attached bystanders mapping. */
  attachedBystanders: Record<CardExtId, CardExtId[]>;
}

/** Result of an awardAttachedBystanders operation. */
export interface AwardBystandersResult {
  /** Updated attached bystanders mapping (entry removed). */
  attachedBystanders: Record<CardExtId, CardExtId[]>;
  /** Updated player victory zone (bystanders appended). */
  playerVictory: CardExtId[];
}

/** Result of a resolveEscapedBystanders operation. */
export interface ResolveEscapedBystandersResult {
  /** Updated attached bystanders mapping (entry removed). */
  attachedBystanders: Record<CardExtId, CardExtId[]>;
  /** Updated bystanders supply pile (escaped bystanders returned). */
  bystandersPile: CardExtId[];
}

/**
 * Attaches one bystander from the supply pile to a villain entering the City.
 *
 * Takes the top bystander (bystandersPile[0]) and creates a mapping entry
 * for the villain. If the supply pile is empty, returns all inputs unchanged
 * (deterministic no-op).
 *
 * @param bystandersPile - The shared bystanders supply pile.
 * @param villainCardId - The villain or henchman entering the City.
 * @param attachedBystanders - The current attached bystanders mapping.
 * @returns New objects for both the pile and mapping.
 */
// why: MVP attaches exactly 1 bystander per villain entering City
// (simplified from full Legendary rules where bystander count can vary
// based on card text and game effects)
export function attachBystanderToVillain(
  bystandersPile: CardExtId[],
  villainCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
): AttachBystanderResult {
  if (bystandersPile.length === 0) {
    return {
      bystandersPile: [...bystandersPile],
      attachedBystanders: { ...attachedBystanders },
    };
  }

  const bystanderCardId = bystandersPile[0]!;
  const existingBystanders = attachedBystanders[villainCardId] ?? [];

  return {
    bystandersPile: bystandersPile.slice(1),
    attachedBystanders: {
      ...attachedBystanders,
      [villainCardId]: [...existingBystanders, bystanderCardId],
    },
  };
}

/**
 * Awards all bystanders attached to a defeated villain to the player's
 * victory zone.
 *
 * Moves every bystander in the mapping entry for villainCardId into
 * playerVictory and removes the mapping entry. If no entry exists,
 * returns all inputs unchanged.
 *
 * @param villainCardId - The defeated villain or henchman.
 * @param attachedBystanders - The current attached bystanders mapping.
 * @param playerVictory - The player's victory zone.
 * @returns New objects for both the mapping and victory zone.
 */
export function awardAttachedBystanders(
  villainCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
  playerVictory: CardExtId[],
): AwardBystandersResult {
  const bystanders = attachedBystanders[villainCardId];

  if (!bystanders || bystanders.length === 0) {
    return {
      attachedBystanders: { ...attachedBystanders },
      playerVictory: [...playerVictory],
    };
  }

  const updatedMapping = { ...attachedBystanders };
  delete updatedMapping[villainCardId];

  return {
    attachedBystanders: updatedMapping,
    playerVictory: [...playerVictory, ...bystanders],
  };
}

/**
 * Resolves bystanders attached to an escaped villain by returning them
 * to the supply pile.
 *
 * Returns any bystanders in the mapping entry for escapedCardId to the
 * end of bystandersPile and removes the mapping entry. If no entry exists,
 * returns all inputs unchanged.
 *
 * @param escapedCardId - The escaped villain or henchman.
 * @param attachedBystanders - The current attached bystanders mapping.
 * @param bystandersPile - The shared bystanders supply pile.
 * @returns New objects for both the mapping and supply pile.
 */
// why: escaped villains release bystanders to prevent memory leaks and
// supply depletion. Returned to end of pile to maintain deterministic
// ordering.
export function resolveEscapedBystanders(
  escapedCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
  bystandersPile: CardExtId[],
): ResolveEscapedBystandersResult {
  const bystanders = attachedBystanders[escapedCardId];

  if (!bystanders || bystanders.length === 0) {
    return {
      attachedBystanders: { ...attachedBystanders },
      bystandersPile: [...bystandersPile],
    };
  }

  const updatedMapping = { ...attachedBystanders };
  delete updatedMapping[escapedCardId];

  return {
    attachedBystanders: updatedMapping,
    bystandersPile: [...bystandersPile, ...bystanders],
  };
}
