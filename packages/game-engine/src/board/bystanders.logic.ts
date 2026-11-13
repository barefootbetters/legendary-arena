/**
 * Bystander capture helpers for the Legendary Arena game engine.
 *
 * Three pure functions for the bystander lifecycle:
 * - attachBystanderToVillain: attach one bystander on City entry
 * - awardAttachedBystanders: award bystanders to player on villain defeat
 * - carryEscapedBystandersToPile: carry bystanders into the escaped pile on villain escape
 *
 * Plus the villain-side Savior helpers (WP-816 / D-24749):
 * - SAVIOR_BYSTANDER_THRESHOLD: the Savior threshold (3 Bystanders)
 * - countVictoryPileBystanders: count the Bystanders in a Victory Pile
 * - findFirstVictoryPileBystander: the first Bystander in Victory Pile order
 *
 * Plus the from-play KO recorder (WP-887 / D-24839):
 * - recordBystanderKoedFromPlay: count one Bystander KO'd from play in G.counters
 *
 * Every function except recordBystanderKoedFromPlay returns new objects (or plain
 * values) and never mutates inputs; the recorder is the module's one function that
 * mutates G (one G.counters key, nothing else).
 * Imports the CardExtId and LegendaryGameState types, the BYSTANDER_EXT_ID constant
 * and the BYSTANDERS_KOED_FROM_PLAY counter key.
 * No boardgame.io import.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { BYSTANDERS_KOED_FROM_PLAY } from '../types.js';

// why: rules v23 L1844-1853 — Savior "means 'Use this ability if you have at least 3
// Bystanders in your Victory Pile.'" The same threshold the hero gate builds from
// `[keyword:Savior]` (`bystandersInVictoryAtLeast:3`, D-24464).
/** The number of Victory-Pile Bystanders that makes a player a Savior. */
export const SAVIOR_BYSTANDER_THRESHOLD = 3;

/**
 * Whether a Victory-Pile card id is a Bystander for Savior purposes.
 *
 * @param cardId - A card ext_id from a player's Victory Pile.
 * @returns True for a supply Bystander, a rescued villain-deck Bystander, or a
 *   defeated Killbot (a converted villain-deck Bystander keeps its id).
 */
function isSaviorBystanderId(cardId: CardExtId): boolean {
  return cardId === BYSTANDER_EXT_ID || cardId.startsWith('bystander-villain-deck-');
}

/**
 * Counts the Bystanders in a Victory Pile.
 *
 * Savior / Bystander id predicate. It agrees with the scoring predicate
 * (`scoring/scoring.logic.ts` `isVictoryPileBystander`) on every Victory-Pile card,
 * defeated Killbots included.
 *
 * @param victory - A player's Victory Pile (not mutated).
 * @returns How many of its cards are Bystanders.
 */
// why: the hero gate's predicate verbatim (`hero/heroConditions.evaluate.ts`
// `bystandersInVictoryAtLeast`) so hero and villain Savior never disagree in one
// match; the T11 parity test pins the two together. A defeated Killbot counts as a
// Bystander (rules v23 L2337-2341) because it keeps its `bystander-villain-deck-NN`
// id; the T12 test pins that for both gates, Executioner's KO and scoring.
export function countVictoryPileBystanders(victory: readonly CardExtId[]): number {
  let count = 0;
  for (const cardId of victory) {
    if (isSaviorBystanderId(cardId)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Finds the first Bystander in a Victory Pile, in array order.
 *
 * Savior / Bystander id predicate. It agrees with the scoring predicate
 * (`scoring/scoring.logic.ts` `isVictoryPileBystander`) on every Victory-Pile card,
 * defeated Killbots included.
 *
 * @param victory - A player's Victory Pile (not mutated).
 * @returns The first Bystander's ext_id, or undefined when there is none.
 */
export function findFirstVictoryPileBystander(
  victory: readonly CardExtId[],
): CardExtId | undefined {
  for (const cardId of victory) {
    if (isSaviorBystanderId(cardId)) {
      return cardId;
    }
  }
  return undefined;
}

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

/** Result of a carryEscapedBystandersToPile operation. */
export interface CarryEscapedBystandersResult {
  /** Updated attached bystanders mapping (entry removed). */
  attachedBystanders: Record<CardExtId, CardExtId[]>;
  /** Updated Escaped Villains pile (carried-away bystanders appended). */
  escapedPile: CardExtId[];
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
 * Carries the bystanders attached to an escaped villain into the Escaped
 * Villains pile.
 *
 * Appends any bystanders in the mapping entry for escapedCardId to the end of
 * escapedPile and removes the mapping entry. If no entry exists, returns all
 * inputs unchanged (deterministic no-op).
 *
 * @param escapedCardId - The escaped villain or henchman.
 * @param attachedBystanders - The current attached bystanders mapping.
 * @param escapedPile - The Escaped Villains pile (G.escapedPile).
 * @returns New objects for both the mapping and the escaped pile.
 */
// why: D-24314 / Universal Rules v23 escape handling — an escaping villain
// CARRIES AWAY its captured bystanders into the Escaped Villains pile; they are
// "carried away," not released back to the shared supply. Routing them here (not
// to G.piles.bystanders) is what makes them countable for resource-loss schemes
// such as Midtown Bank Robbery ("8 Bystanders carried away by escaping
// Villains"). Appended to the end for deterministic ordering; the mapping entry
// is still deleted so no bystander leaks.
export function carryEscapedBystandersToPile(
  escapedCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
  escapedPile: CardExtId[],
): CarryEscapedBystandersResult {
  const bystanders = attachedBystanders[escapedCardId];

  if (!bystanders || bystanders.length === 0) {
    return {
      attachedBystanders: { ...attachedBystanders },
      escapedPile: [...escapedPile],
    };
  }

  const updatedMapping = { ...attachedBystanders };
  delete updatedMapping[escapedCardId];

  return {
    attachedBystanders: updatedMapping,
    escapedPile: [...escapedPile, ...bystanders],
  };
}

/**
 * Records one Bystander KO'd from play: a Bystander moved to the KO pile from a City Villain's
 * captives, the Mastermind's captives, the Escape Pile, or an HQ slot (D-24839).
 *
 * Obligation (D-24839): every from-play Bystander KO site MUST call this once per Bystander,
 * immediately after its `koCard`. Today that is the two Hunt for Victims KO sites in
 * `moves/huntForVictims.logic.ts`; Lilith's and Ritual Sacrifice to Summon Chthon's Hunt for
 * Victims, HQ KOs and "KO all Bystanders held by Villains" twists must call it too. Never call
 * it for a KO from the Bystander supply or a Victory Pile, for a rescue, a capture or a decline,
 * or from an operator setter.
 *
 * Writes `G.counters[BYSTANDERS_KOED_FROM_PLAY]` lazily (the module's one function that mutates
 * `G`); no other effect. Never throws.
 *
 * @param gameState - The game state, mutated in place.
 */
// why: WP-887 / D-24839 — a civilian KO'd from play counts as lost in PAR's bystanderLost.
// A counter, not an end-state derivation: every KO'd card lands in G.ko, so end state cannot
// tell a from-play KO from a supply or Victory-Pile KO (and a captured Bystander may be a
// supply or a Villain-Deck one). Written only here, never seeded, so a match without such a
// KO keeps its hash.
export function recordBystanderKoedFromPlay(gameState: LegendaryGameState): void {
  gameState.counters[BYSTANDERS_KOED_FROM_PLAY] = (gameState.counters[BYSTANDERS_KOED_FROM_PLAY] ?? 0) + 1;
}
