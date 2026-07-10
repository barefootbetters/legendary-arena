/**
 * resolveReturnZeroCostDiscard move — resolves a pending return-zero-cost-discard
 * player choice (D-24139).
 *
 * Called by the active player after a "Return a 0-cost card from your discard
 * pile to your hand" hero ability (Black Knight's Defend the Weak) parked a
 * PendingReturnZeroCostDiscard on G.pendingReturnZeroCostDiscard (FIFO). The
 * choice is MANDATORY — the printed text has no "you may", so there is no
 * decline shape; the player must pick one eligible card.
 *
 * A selected card is moved from the chooser's discard pile to their hand.
 * Eligibility is 0-cost: the engine-wide cost convention `cardStats[id]?.cost
 * ?? 0` — S.H.I.E.L.D. Agents/Troopers and Wounds are 0-cost per the tabletop
 * rulebook and carry cost 0 (or no stats entry) here.
 *
 * Atomicity is exact: the card move executes ONLY after it is confirmed
 * present in the discard pile AND 0-cost. A stale/absent/ineligible target is
 * a silent no-op that leaves the queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveReturnZeroCostDiscard move.
 *
 * The choice is mandatory (no decline shape): the only valid payload is the
 * discard-pile card to return to hand.
 */
export interface ResolveReturnZeroCostDiscardArgs {
  cardId: CardExtId;
}

/**
 * Whether a given card is 0-cost for return-eligibility purposes.
 *
 * // why: single eligibility predicate shared by the park handler, this
 * resolve move, the UIState projection, and the bot default — the round-trip
 * rule (a projection filtered by a different predicate would let the client
 * submit a card the resolve rejects). Missing-entry fallback to 0 is the
 * engine-wide cost convention (recruitHero, heroCapture, optional-KO default
 * targeting): S.H.I.E.L.D. starting cards carry explicit cost-0 entries and
 * Wounds have no entry — both are 0-cost cards per the tabletop rulebook.
 *
 * @param cardStats - The G.cardStats lookup (not mutated).
 * @param cardId - The card to classify.
 * @returns true when the card's cost resolves to 0.
 */
export function isZeroCostCard(
  cardStats: Record<CardExtId, CardStatEntry>,
  cardId: CardExtId,
): boolean {
  return (cardStats[cardId]?.cost ?? 0) === 0;
}

/**
 * Lists the 0-cost cards in a player's discard pile, in discard order.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose discard pile is scanned.
 * @returns The eligible card ids, preserving discard array order.
 */
export function getEligibleZeroCostDiscardCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return [];
  }
  const eligible: CardExtId[] = [];
  for (const cardId of playerZones.discard) {
    if (isZeroCostCard(G.cardStats, cardId)) {
      eligible.push(cardId);
    }
  }
  return eligible;
}

/**
 * Whether any return-zero-cost-discard choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending return-zero-cost-discard queue holds at least one entry.
 */
export function hasPendingReturnZeroCostDiscard(G: LegendaryGameState): boolean {
  return (G.pendingReturnZeroCostDiscard?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending return-zero-cost-discard choice.
 *
 * Atomic sequence:
 *   1. Validate args — { cardId } with a non-empty string; invalid shape is a
 *      silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. The card must be present in the chooser's discard pile NOW (recomputed
 *      fresh, no snapshot) AND 0-cost. Absent/stale/ineligible → silent no-op,
 *      queue intact (resubmit).
 *   4. Move the card from discard to hand (first occurrence), log, then
 *      front-pop LAST.
 *
 * Any failure before step 4 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G, playerID, etc.
 * @param args - the { cardId } to return from discard to hand.
 */
export function resolveReturnZeroCostDiscard(
  { G, playerID }: MoveContext,
  args: ResolveReturnZeroCostDiscardArgs,
): void {
  // Step 1: Validate args.
  const cardId = (args as { cardId?: unknown }).cardId;
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return;
  }

  // Step 2: Validate the front pending entry.
  const queue = G.pendingReturnZeroCostDiscard;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: The chosen card must be in the chooser's discard pile right now
  // and must be 0-cost (the shared eligibility predicate).
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  const targetCardId = cardId as CardExtId;
  let foundIndex = -1;
  for (let discardIndex = 0; discardIndex < playerZones.discard.length; discardIndex++) {
    if (playerZones.discard[discardIndex] === targetCardId) {
      foundIndex = discardIndex;
      break;
    }
  }
  if (foundIndex === -1) {
    // why: invalid/stale target is a no-op that leaves the queue intact so
    // the player resubmits.
    return;
  }
  if (!isZeroCostCard(G.cardStats, targetCardId)) {
    // why: a non-0-cost card is never a legal target for this ability; no-op
    // with the queue intact so the player picks an eligible card.
    return;
  }

  // Step 4: Move the card from discard to hand (remove exactly the found
  // occurrence), log, then front-pop LAST.
  playerZones.discard = [
    ...playerZones.discard.slice(0, foundIndex),
    ...playerZones.discard.slice(foundIndex + 1),
  ];
  playerZones.hand = [...playerZones.hand, targetCardId];
  pushLog(G,
    `Player ${playerID} returned ${formatCardRef(G.cardDisplayData, targetCardId)} from their discard pile to their hand.`,
  );
  queue.shift();
}
