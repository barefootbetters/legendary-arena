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
import { checkDivingBlock, countPendingDivingBlockWounds } from '../moves/divingBlock.logic.js';
import { checkFlyingShieldBlock } from '../moves/flyingShieldBlock.logic.js';

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
  // why: WP-827 / D-24760 — Flying Shield Block (any seat may reveal) is offered only when the
  // recipient's own Diving Block was not; a declined Diving Block offers it then
  // (applyDivingBlockResolvedSeatChoice), so one Wound never has two open interceptions.
  if (!checkDivingBlock(G, playerID, woundCardId)) {
    checkFlyingShieldBlock(G, playerID, woundCardId);
  }
  return woundCardId;
}

/**
 * What one gainWoundForPlayer call did, for the caller's log line (D-24673).
 *
 * - `'no-wound'`: the supply was empty (or the player has no zones); nothing landed.
 * - `'gained'`: the Wound landed and nothing can undo it.
 * - `'diving-block-pending'`: the Wound landed but a Diving Block reveal is now
 *   pending for it, so the player only WOULD gain it until the reveal resolves.
 */
export type WoundGainOutcome = 'no-wound' | 'gained' | 'diving-block-pending';

/**
 * Gains one Wound through the gainWoundForPlayer chokepoint and reports whether
 * Diving Block can still prevent it.
 *
 * // why: D-24673 — the Wound lands first and the Diving Block reveal resolves
 * later (land-then-offer-undo), so a log line written now must not say "gained"
 * for a Wound a reveal may return. Callers that log the Wound use this outcome to
 * say "would gain … Diving Block can prevent it" instead. Match P9oVujYd2B9: Loki's
 * Master Strike logged "gained a Wound", then Diving Block prevented it.
 *
 * @param G - The game state, mutated in place (as gainWoundForPlayer).
 * @param playerID - The player gaining the Wound (may be a non-active seat).
 * @returns The outcome of this one Wound.
 */
export function gainWoundWithOutcome(
  G: LegendaryGameState,
  playerID: string,
): WoundGainOutcome {
  const pendingBefore = countPendingDivingBlockWounds(G, playerID);
  if (gainWoundForPlayer(G, playerID) === undefined) {
    return 'no-wound';
  }
  if (countPendingDivingBlockWounds(G, playerID) > pendingBefore) {
    return 'diving-block-pending';
  }
  return 'gained';
}
