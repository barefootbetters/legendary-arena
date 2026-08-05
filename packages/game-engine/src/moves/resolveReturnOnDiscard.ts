/**
 * resolveReturnOnDiscard move — resolves a pending OPTIONAL return-on-discard
 * choice (WP-498 / D-24301).
 *
 * Parked by the discardFromHand chokepoint (checkReturnOnDiscard) when a card
 * effect discards a `return-on-discard` hero card (Cyclops Unending Energy) from
 * a player's hand. The printed text is "you MAY return this card to your hand",
 * so this is a decline-shaped choice (mirrors resolveOptionalPutBottomHQ, NOT the
 * mandatory resolveDiscardToPlay / resolveReturnZeroCostDiscard):
 *  - { decline: true } → front-pop only; the card stays in the discard pile.
 *  - { cardId } → move the just-discarded card from discard back to hand.
 *
 * Atomicity is exact: the card must be the front entry's card AND present in the
 * chooser's discard pile NOW (the block-all guards freeze the board between park
 * and resolve). A stale/absent/mismatched target is a silent no-op that leaves
 * the queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveReturnOnDiscard move.
 *
 * Exactly one shape is valid per call:
 * - { decline: true } — decline; the card stays in the discard pile.
 * - { cardId } — return the just-discarded card from discard to hand.
 */
export type ResolveReturnOnDiscardArgs =
  | { decline: true }
  | { cardId: CardExtId };

/**
 * Whether any return-on-discard choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. Undefined and [] both mean no pending choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending return-on-discard queue holds at least one entry.
 */
export function hasPendingReturnOnDiscard(G: LegendaryGameState): boolean {
  return (G.pendingReturnOnDiscard?.length ?? 0) > 0;
}

/**
 * The card(s) the given player may return for the FRONT pending choice — the
 * front entry's card when it belongs to the player AND is still in their discard
 * pile, else [].
 *
 * // why: the round-trip predicate shared by the UIState projection and the bot
 * default, so the client can only submit a card the resolve move accepts. The
 * choice is single-card, so this returns at most one id.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose front pending choice is inspected.
 * @returns The returnable card id(s), preserving the single-card shape.
 */
export function getEligibleReturnOnDiscardCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const queue = G.pendingReturnOnDiscard;
  if (queue === undefined || queue.length === 0) {
    return [];
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return [];
  }
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !playerZones.discard.includes(front.cardId)) {
    return [];
  }
  return [front.cardId];
}

/**
 * Resolves the FRONT pending return-on-discard choice.
 *
 * Atomic sequence:
 *   1. Validate args — exactly { decline: true } XOR { cardId }; an invalid
 *      shape is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. { decline } → front-pop ONLY; the card stays in discard (silent).
 *   4. { cardId } → the card must equal front.cardId AND be present in the
 *      chooser's discard pile NOW. Absent/stale/mismatched → silent no-op,
 *      queue intact (resubmit).
 *   5. Move the card from discard to hand, log, then front-pop LAST.
 *
 * Any failure before step 5 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G, playerID, etc.
 * @param args - the decline flag or the { cardId } to return to hand.
 */
export function resolveReturnOnDiscard(
  { G, playerID }: MoveContext,
  args: ResolveReturnOnDiscardArgs,
): void {
  // Step 1: Validate args — exactly one of { decline: true } / { cardId }.
  const isDecline = (args as { decline?: unknown }).decline === true;
  const cardId = (args as { cardId?: unknown }).cardId;
  const isReturnRequest = typeof cardId === 'string' && cardId.length > 0;
  // why: exactly-one-shape — both present or neither present is malformed.
  if (isDecline === isReturnRequest) {
    return;
  }

  // Step 2: Validate the front pending entry.
  const queue = G.pendingReturnOnDiscard;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Decline → front-pop only; the card stays in discard.
  if (isDecline) {
    queue.shift();
    pushLog(G,
      `Player ${playerID} declined to return ${formatCardRef(G.cardDisplayData, front.cardId)} to their hand.`,
    );
    return;
  }

  // Step 4: Return request — the chosen card must be the front entry's card and
  // present in the chooser's discard pile right now.
  const targetCardId = cardId as CardExtId;
  if (targetCardId !== front.cardId) {
    // why: the client may only confirm the specific card this choice parked; a
    // mismatch is a no-op that leaves the queue intact so it can resubmit.
    return;
  }
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  const moveResult = moveCardFromZone(playerZones.discard, playerZones.hand, targetCardId);
  if (!moveResult.found) {
    // why: stale target (card no longer in discard) is a no-op with the queue
    // intact so the player resubmits.
    return;
  }

  // Step 5: Move the card discard → hand, log, then front-pop LAST.
  playerZones.discard = moveResult.from;
  playerZones.hand = moveResult.to;
  pushLog(G,
    `Player ${playerID} returned ${formatCardRef(G.cardDisplayData, targetCardId)} from their discard pile to their hand.`,
  );
  queue.shift();
}
