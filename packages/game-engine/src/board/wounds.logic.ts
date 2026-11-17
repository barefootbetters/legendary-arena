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
  offerWoundInterception(G, playerID, woundCardId);
  return woundCardId;
}

/**
 * Offers the reactive interceptions for a Wound that just landed in a player's discard pile:
 * Diving Block, else Flying Shield Block.
 *
 * // why: WP-769 / D-24602 — extracted (two callers, ahead of the third-copy rule) so every
 * Wound a player gains, from the supply or from a Mastermind, gets the same interceptions. The
 * WP-769 draft called checkDivingBlock alone and would have skipped Flying Shield Block.
 * // why: WP-682 / D-24499 — the reactive interception runs AFTER the Wound landed,
 * so a reveal undoes THIS Wound (return to supply + draw). Offered to the wound
 * recipient (may be a non-active seat) via the WP-684 seat-choice wave.
 * // why: WP-827 / D-24760 — Flying Shield Block (any seat may reveal) is offered only when the
 * recipient's own Diving Block was not; a declined Diving Block offers it then
 * (applyDivingBlockResolvedSeatChoice), so one Wound never has two open interceptions.
 *
 * @param G - The game state, mutated in place (the pending interception queues).
 * @param playerID - The player who just gained the Wound.
 * @param woundCardId - The Wound card now in the player's discard pile.
 */
function offerWoundInterception(
  G: LegendaryGameState,
  playerID: string,
  woundCardId: CardExtId,
): void {
  if (!checkDivingBlock(G, playerID, woundCardId)) {
    checkFlyingShieldBlock(G, playerID, woundCardId);
  }
}

/**
 * Gains a Wound the caller already took off a Mastermind (Killmonger's Wounds, WP-769 /
 * D-24602): lands it in the player's discard pile and offers the same interceptions as
 * gainWoundForPlayer. Mutates G in place; never throws.
 *
 * // why: the outcome mirrors gainWoundWithOutcome exactly (D-24673): only a pending Diving
 * Block reads 'diving-block-pending'. A reveal returns the Wound to the Wound Stack, not back
 * onto the Mastermind (named residual in D-24602).
 *
 * @param G - The game state, mutated in place (player discard; or the Wound Stack when the
 *   player has no zones, so the Wound is never dropped).
 * @param playerID - The player gaining the Wound (may be a non-active seat).
 * @param woundCardId - The Wound card already removed from its source.
 * @returns 'no-wound' when the player has no zones, else 'gained' or 'diving-block-pending'.
 */
export function gainHeldWoundWithOutcome(
  G: LegendaryGameState,
  playerID: string,
  woundCardId: CardExtId,
): WoundGainOutcome {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    // why: the caller already removed the Wound from the Mastermind; put it on the bottom of
    // the Wound Stack rather than lose it (rules v23 L2244-2246).
    G.piles.wounds = [...G.piles.wounds, woundCardId];
    return 'no-wound';
  }
  const pendingBefore = countPendingDivingBlockWounds(G, playerID);
  playerZones.discard = [...playerZones.discard, woundCardId];
  offerWoundInterception(G, playerID, woundCardId);
  if (countPendingDivingBlockWounds(G, playerID) > pendingBefore) {
    return 'diving-block-pending';
  }
  return 'gained';
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
