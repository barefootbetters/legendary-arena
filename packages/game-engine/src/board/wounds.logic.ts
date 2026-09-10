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
import type { LegendaryGameState } from '../types.js';
import { checkDivingBlock } from '../moves/divingBlock.logic.js';

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

/**
 * The SINGLE mutating chokepoint through which a player gains a Wound to their
 * discard pile, and the reactive `diving-block` interception site (WP-682 /
 * D-24499).
 *
 * Routing every wound source — Master Strikes, Scheme Twists, villain effects,
 * hero self-wounds — through this one helper guarantees Captain America's Diving
 * Block reaction fires uniformly no matter which effect caused the Wound (the
 * wound-side analog of the discardFromHand chokepoint). The Wound lands FIRST
 * (moved from the shared supply into the player's discard), then checkDivingBlock
 * parks an OPTIONAL reveal/decline interception when the player holds Diving Block
 * — the land-then-offer-undo shape (a reveal later returns this Wound to the supply
 * and draws instead). Deterministic; mutates G in place; never throws.
 *
 * A deterministic no-op (returns undefined, no interception) when the wounds supply
 * is empty or the player has no zones.
 *
 * @param G - The game state, mutated in place (wounds supply + player discard).
 * @param playerID - The player gaining the Wound (may be a non-active seat).
 * @returns The gained Wound card id, or undefined when no Wound was available.
 */
export function gainWoundForPlayer(
  G: LegendaryGameState,
  playerID: string,
): CardExtId | undefined {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return undefined;
  }
  const result = gainWound(G.piles.wounds, playerZones.discard);
  // why: empty supply is a deterministic no-op — gainWound returns the discard
  // unchanged, so nothing landed and no interception is offered.
  if (result.playerDiscard.length === playerZones.discard.length) {
    G.piles.wounds = result.woundsPile;
    return undefined;
  }
  const woundCardId = result.playerDiscard[result.playerDiscard.length - 1]!;
  G.piles.wounds = result.woundsPile;
  playerZones.discard = result.playerDiscard;
  // why: WP-682 / D-24499 — the reactive interception runs AFTER the Wound landed,
  // so a reveal undoes THIS Wound (return to supply + draw). Offered to the wound
  // recipient (may be a non-active seat) via the WP-684 seat-choice wave.
  checkDivingBlock(G, playerID, woundCardId);
  return woundCardId;
}
