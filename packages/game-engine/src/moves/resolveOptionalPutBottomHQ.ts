/**
 * resolveOptionalPutBottomHQ move — resolves a pending optional-put-bottom-HQ
 * player choice.
 *
 * Called by the active player after a single-card put-bottom-HQ hero ability parked a
 * PendingOptionalPutBottomHQ on G.pendingOptionalPutBottomHQ (FIFO). Two forms share
 * this queue and move:
 *  - OPTIONAL (Ionic Energy, "You may put a card…"): the player either declines or
 *    selects a card; no reward.
 *  - MANDATORY + icon reward (Absorb Ambient Power, "Put a card… If that card had a
 *    recruit/attack icon, +N"): front.mandatory blocks Decline; front.iconRewardMagnitude
 *    grants +N recruit and/or +N attack based on the moved card's printed icons.
 * A selected card is moved to the bottom of the shared Hero Deck and the vacated HQ
 * slot is refilled from the top of the Hero Deck (exactly as recruitHero does).
 *
 * why: the printed ability is "put a card from the HQ on the bottom of the Hero
 * Deck" — the shared central supply (G.heroDeck), NOT the player's personal deck,
 * and the HQ must never be left with a permanent null gap.
 *
 * Atomicity is exact: the card move executes ONLY after it is confirmed present
 * in the HQ. Decline (optional form only) pops the queue with no change. A
 * stale/absent target is a silent no-op that leaves the queue intact so the player
 * can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { refillHqSlot } from '../board/city.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

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
 *   3. { decline } → front-pop ONLY, no zone change.
 *   4. { cardId } → the card must be present in the HQ NOW (recomputed fresh,
 *      no snapshot). Absent/stale → silent no-op, queue intact (resubmit).
 *   5. Push the card to the BOTTOM of G.heroDeck → refill the vacated HQ slot
 *      from the TOP of G.heroDeck (refillHqSlot), then front-pop LAST.
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

  // Step 3: Decline → front-pop only, no zone change. A MANDATORY choice
  // (front.mandatory — the printed "Put a card…" form, Absorb Ambient Power)
  // cannot be declined: the request is a silent no-op that leaves the queue intact
  // so the player must still pick a card.
  if (isDecline) {
    if (front.mandatory === true) {
      return;
    }
    queue.shift();
    pushLog(G, `Player ${playerID} declined to put a card from the HQ on the bottom of the Hero Deck.`);
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

  // Step 5: Move the chosen card to the BOTTOM of the shared Hero Deck, then
  // refill the vacated HQ slot from the TOP of the Hero Deck — exactly the
  // recruitHero refill path (refillHqSlot pops heroDeck[0]). heroDeck[0] is the
  // top (drawn first), so the bottom is the END of the array (push).
  // why: the card leaves the HQ for the shared central supply (G.heroDeck), NOT
  // the player's personal deck; the HQ is kept full (never a permanent null gap).
  G.heroDeck.push(targetCardId);
  const refillResult = refillHqSlot(G.hq, foundIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  pushLog(G,
    `Player ${playerID} put ${formatCardRef(G.cardDisplayData, targetCardId)} from the HQ on the bottom of the Hero Deck; HQ slot ${String(foundIndex)} refilled.`,
  );

  // Step 5b: Icon reward — when the parked choice carries iconRewardMagnitude
  // (Absorb Ambient Power), the player gets +N recruit if the moved card had a
  // recruit icon AND +N attack if it had an attack icon (both if both). The moved
  // card's printed icons are read from its cardStats entry (recruit/attack > 0).
  const rewardMagnitude = front.iconRewardMagnitude;
  if (rewardMagnitude !== undefined && rewardMagnitude > 0) {
    const movedStats = G.cardStats[targetCardId];
    const hasRecruitIcon = movedStats !== undefined && movedStats.recruit > 0;
    const hasAttackIcon = movedStats !== undefined && movedStats.attack > 0;
    const recruitGrant = hasRecruitIcon ? rewardMagnitude : 0;
    const attackGrant = hasAttackIcon ? rewardMagnitude : 0;
    if (recruitGrant > 0 || attackGrant > 0) {
      // why: addResources(economy, attack, recruit) — attack is the 2nd arg, recruit the 3rd.
      G.turnEconomy = addResources(G.turnEconomy, attackGrant, recruitGrant);
      const parts: string[] = [];
      if (recruitGrant > 0) { parts.push(`+${String(recruitGrant)} recruit`); }
      if (attackGrant > 0) { parts.push(`+${String(attackGrant)} attack`); }
      pushLog(G, `Player ${playerID} gained ${parts.join(' and ')} from the icon on the moved card.`);
    }
  }

  // Step 6: Front-pop LAST.
  queue.shift();
}
