/**
 * resolveOptionalPutBottomHQ move — resolves a pending optional-put-bottom-HQ
 * player choice.
 *
 * Called by the active player after an optional-put-bottom-hq hero ability parked a
 * PendingOptionalPutBottomHQ on G.pendingOptionalPutBottomHQ (FIFO). The player
 * either declines (no change to zones) or selects a card from the HQ (if present),
 * in which case it is moved to the bottom of their deck.
 *
 * Atomicity is exact: the card move executes ONLY after it is confirmed present
 * in the HQ. Decline pops the queue with no change. A stale/absent target is a
 * silent no-op that leaves the queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveOptionalPutBottomHQ move.
 *
 * Exactly one shape is valid per call:
 * - { decline: true } — decline the choice (no zone change).
 * - { cardId } — select an HQ card to move to the bottom of the deck.
 */
export type ResolveOptionalPutBottomHQArgs =
  | { decline: true }
  | { cardId: CardExtId };

/**
 * Whether any optional-put-bottom-hq choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending optional-put-bottom-hq queue holds at least one entry.
 */
export function hasPendingOptionalPutBottomHQ(G: LegendaryGameState): boolean {
  return (G.pendingOptionalPutBottomHQ?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending optional-put-bottom-hq choice.
 *
 * Atomic sequence:
 *   1. Validate args — exactly { decline: true } XOR { cardId };
 *      invalid shape is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. { decline } → front-pop ONLY, no zone change (silent).
 *   4. { cardId } → the card must be present in the HQ NOW (recomputed fresh,
 *      no snapshot). Absent/stale → silent no-op, queue intact (resubmit).
 *   5. Remove the card from HQ → add it to the bottom of the player's deck.
 *   6. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 5 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G, playerID, etc.
 * @param args - the decline flag or the { cardId } to move.
 */
export function resolveOptionalPutBottomHQ(
  { G, playerID }: MoveContext,
  args: ResolveOptionalPutBottomHQArgs,
): void {
  // Step 1: Validate args — exactly one of { decline: true } / { cardId }.
  const isDecline = (args as { decline?: unknown }).decline === true;
  const cardId = (args as { cardId?: unknown }).cardId;
  const isMoveRequest = typeof cardId === 'string' && cardId.length > 0;
  // why: exactly-one-shape — both present or neither present is malformed
  if (isDecline === isMoveRequest) {
    return;
  }

  // Step 2: Validate the front pending entry.
  const queue = G.pendingOptionalPutBottomHQ;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Decline → front-pop only, no zone change (silent).
  if (isDecline) {
    queue.shift();
    return;
  }

  // Step 4: Move request — the chosen card must be present in the HQ right now.
  const hqZone = G.hq;
  const targetCardId = cardId as CardExtId;
  let foundIndex = -1;
  for (let i = 0; i < hqZone.length; i++) {
    if (hqZone[i] === targetCardId) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    // why: invalid/stale target is a no-op that leaves the queue intact so
    // the player resubmits.
    return;
  }

  // Step 5: Mutate — clear the HQ slot and add card to bottom of player's deck.
  const newHq: (CardExtId | null)[] = [];
  for (let i = 0; i < hqZone.length; i++) {
    const slotValue = hqZone[i]!;  // HqZone tuple always has all slots defined
    newHq.push(i === foundIndex ? null : slotValue);
  }
  G.hq = newHq as any; // HqZone tuple type
  const playerZones = G.playerZones[playerID];
  if (playerZones) {
    playerZones.deck.push(targetCardId);
  }

  // Step 6: Front-pop LAST.
  queue.shift();
}
