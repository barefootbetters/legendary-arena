/**
 * resolveSmashDiscard move — resolves a pending Smash discard-for-attack choice
 * (WP-676 / D-24492).
 *
 * Called by the active player after a `smash` hero ability parked a
 * PendingSmashDiscard on G.pendingSmashDiscards (FIFO). Per universal-rules-v23
 * §Smash the choice is "you may discard another card from your hand; if you do,
 * you get +N attack" — so the player either declines (no discard, no Attack) or
 * discards exactly one hand card, in which case the front entry's `magnitude` is
 * added to G.turnEconomy.attack.
 *
 * Atomicity: the +Attack grant fires ONLY after the discard actually removes a
 * card from the chooser's hand. Decline pops the queue with no discard and no
 * grant. A stale/absent target is a silent no-op that leaves the queue intact so
 * the player can resubmit (the block-all guard guarantees a valid target still
 * exists while the choice is pending — the park requires a non-empty hand).
 *
 * The move is server-only (registered `client: false` in game.ts): the client
 * submits intent ({ cardId } or { decline: true }), and the ENGINE computes the
 * Attack grant — the client never computes an outcome.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { discardFromHand } from './discardFromHand.js';
import { addResources } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveSmashDiscard move.
 *
 * Exactly one shape is valid per call:
 * - { decline: true } — decline the Smash (no discard, no Attack).
 * - { cardId } — discard the named hand card, then gain the front entry's +N Attack.
 */
export type ResolveSmashDiscardArgs =
  | { decline: true }
  | { cardId: CardExtId };

/**
 * Lists the cards eligible to discard for a pending Smash choice — the chooser's
 * entire current hand, in hand order.
 *
 * // why: D-24492 — the rule is "discard ANOTHER card from your hand"; the played
 * Smash card is already in inPlay at park time, so the hand holds only the other
 * cards and every one is eligible (no type/cost filter). This is the round-trip
 * predicate the UIState projection and the resolve move share, mirroring
 * getEligibleDiscardToPlayCards.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose hand is listed.
 * @returns The eligible card ids, preserving hand order.
 */
export function getEligibleSmashDiscardCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return [];
  }
  return [...playerZones.hand];
}

/**
 * Whether any Smash discard-for-attack choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingOptionalKoReward, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Smash-discard queue holds at least one entry.
 */
export function hasPendingSmashDiscard(G: LegendaryGameState): boolean {
  return (G.pendingSmashDiscards?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending Smash discard-for-attack choice.
 *
 * Atomic sequence (HARD — exact order, mirrors optionalKoReward.resolve.ts):
 *   1. Validate args — exactly { decline: true } XOR { cardId }; an invalid shape
 *      is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. { decline } → log the no-op, then front-pop. No discard, no Attack.
 *   4. { cardId } → discard the card through the single forced-discard chokepoint
 *      (discardFromHand); its `found` return doubles as the fresh in-hand check
 *      (no snapshot). Absent/stale → silent no-op, queue intact (resubmit).
 *   5. THEN add `magnitude` Attack, log.
 *   6. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 5 ABORTS the grant (no discard ⇒ no Attack). Moves never
 * throw.
 *
 * // why: D-24492 — the decline arm grants 0 because the rule reads "you MAY
 * discard" — declining is a legal, no-cost choice, not a forced discard.
 *
 * @param context - boardgame.io move context with G, playerID, etc.
 * @param args - the decline flag or the { cardId } to discard from hand.
 */
export function resolveSmashDiscard(
  { G, playerID }: MoveContext,
  args: ResolveSmashDiscardArgs,
): void {
  // Step 1: Validate args — exactly one of { decline: true } / { cardId }.
  const isDecline = (args as { decline?: unknown }).decline === true;
  const cardId = (args as { cardId?: unknown }).cardId;
  const isDiscardRequest = typeof cardId === 'string' && cardId.length > 0;
  // why: exactly-one-shape — both present ({ decline } AND { cardId }) or neither
  // present is a malformed payload and a silent no-op.
  if (isDecline === isDiscardRequest) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted).
  const queue = G.pendingSmashDiscards;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }

  // Step 3: Decline → log the no-op, then front-pop. No discard, no Attack.
  // why: a VOLUNTARY decline (the player has cards but chooses not to discard) must
  // be logged for parity with the empty-hand forced no-op ("could not Smash …");
  // without it a decline is invisible in the game log and looks like the effect was
  // silently dropped (Jeff, red-skull Midtown match). The pending entry carries no
  // source-card id, so the line names no specific card — same neutral, untagged
  // outcome the forced no-op uses.
  if (isDecline) {
    pushLog(G,
      `Player ${playerID} declined Smash — chose not to discard a card, so no Attack was granted.`,
    );
    queue.shift();
    return;
  }

  // Step 4: Discard the chosen card through the single forced-discard chokepoint
  // (WP-498 / D-24301) — this fires the return-on-discard reaction (so discarding
  // a Cyclops Unending Energy to Smash offers to return it) and keeps the enforced
  // hand→discard invariant (a raw zoneOps move is disallowed, discardFromHand.test.ts).
  // discardFromHand's `found` return doubles as the fresh in-hand check: false ⇒ the
  // card is not in the chooser's hand now (stale/absent target), a silent no-op that
  // leaves the queue intact so the player resubmits; the block-all guard guarantees a
  // valid target exists while the choice is pending.
  const targetCardId = cardId as CardExtId;
  if (!discardFromHand(G, playerID, targetCardId)) {
    return;
  }

  // Step 5: THEN grant the Attack (the discard is the paid cost; the Attack is the
  // payoff). The +N Attack rides the front entry's magnitude.
  G.turnEconomy = addResources(G.turnEconomy, front.magnitude, 0);
  pushLog(G,
    `Player ${playerID} discarded ${formatCardRef(G.cardDisplayData, targetCardId)} from their hand and gained +${front.magnitude} attack from Smash.`,
    'applied',
  );

  // Step 6: Front-pop LAST (front-pop = Array.shift), mirroring WP-248.
  queue.shift();
}
