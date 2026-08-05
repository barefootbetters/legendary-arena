/**
 * resolveDiscardToPlay move — resolves a pending discard-to-play cost choice
 * (WP-383 / D-24184).
 *
 * Called by the active player after playing a card printed "To play this card,
 * you must discard a card from your hand" (Cyclops Determination/Optic Blast +
 * siblings). The `discard-to-play` keyword parked a PendingDiscardToPlay on
 * G.pendingDiscardToPlay (FIFO). The choice is MANDATORY — the printed text has
 * no "you may", so there is no decline shape; the player must pick a hand card
 * to discard. Payability is pre-guaranteed by the D-24185 pre-commit
 * precondition in playCard, so the base power never leaks on an unpayable play.
 *
 * A selected card is moved from the chooser's hand to their discard pile. When
 * `remaining` reaches 0 the entry is front-popped; otherwise it stays for the
 * next discard (multi-discard cards, n > 1).
 *
 * Atomicity: the card move executes ONLY after it is confirmed present in the
 * chooser's hand NOW. A stale/absent target is a silent no-op that leaves the
 * queue intact so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { discardFromHand } from './discardFromHand.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveDiscardToPlay move.
 *
 * The choice is mandatory (no decline shape): the only valid payload is the
 * hand card to discard.
 */
export interface ResolveDiscardToPlayArgs {
  cardId: CardExtId;
}

/**
 * The discard-to-play cost of a card: how many cards must be discarded to play
 * it (0 if the card carries no discard-to-play keyword).
 *
 * // why: single cost source shared by the playCard pre-commit precondition
 * (D-24185) and the park handler — both must agree on the count. Reads the
 * card's onPlay hooks (the same G.heroAbilityHooks the executor reads) and sums
 * the magnitude of every `discard-to-play` effect descriptor (defaulting a
 * marker with no magnitude to 1). No .reduce() (Rule Execution Pipeline).
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card being played.
 * @returns The number of cards that must be discarded to play the card.
 */
export function getDiscardToPlayCost(
  G: LegendaryGameState,
  cardId: CardExtId,
): number {
  // why: G.heroAbilityHooks is always built by Game.setup, but minimal test
  // states (and any future loosely-built G) may omit it; guard against undefined
  // so this helper — called from the playCard precondition — never throws (moves
  // never throw), mirroring executeHeroEffects' own hooks guard.
  let cost = 0;
  for (const hook of getHooksForCard(G.heroAbilityHooks ?? [], cardId)) {
    if (!hook.keywords.includes('discard-to-play')) {
      continue;
    }
    for (const effect of hook.effects ?? []) {
      if (effect.type === 'discard-to-play') {
        cost += effect.magnitude ?? 1;
      }
    }
  }
  return cost;
}

/**
 * Lists the cards eligible to discard for a pending discard-to-play cost — the
 * chooser's entire current hand, in hand order.
 *
 * // why: the discard cost may be paid with ANY hand card (unlike
 * return-zero-cost-discard's 0-cost filter). At park time the played card is
 * already in inPlay, so the hand holds only the other cards. This is the
 * round-trip predicate the UIState projection and the resolve move share.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose hand is listed.
 * @returns The eligible card ids, preserving hand order.
 */
export function getEligibleDiscardToPlayCards(
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
 * Whether any discard-to-play cost choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending discard-to-play queue holds at least one entry.
 */
export function hasPendingDiscardToPlay(G: LegendaryGameState): boolean {
  return (G.pendingDiscardToPlay?.length ?? 0) > 0;
}

/**
 * Resolves one discard of the FRONT pending discard-to-play cost.
 *
 * Atomic sequence:
 *   1. Validate args — { cardId } with a non-empty string; invalid shape is a
 *      silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. The card must be present in the chooser's hand NOW (recomputed fresh, no
 *      snapshot). Absent/stale → silent no-op, queue intact (resubmit).
 *   4. Move the card from hand to discard (first occurrence), log, decrement
 *      `remaining`; front-pop LAST when `remaining` reaches 0.
 *
 * Any failure before step 4 ABORTS the move (no zone change). Moves never throw.
 *
 * @param context - boardgame.io move context with G, playerID, etc.
 * @param args - the { cardId } to discard from hand.
 */
export function resolveDiscardToPlay(
  { G, playerID }: MoveContext,
  args: ResolveDiscardToPlayArgs,
): void {
  // Step 1: Validate args.
  const cardId = (args as { cardId?: unknown }).cardId;
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return;
  }

  // Step 2: Validate the front pending entry.
  const queue = G.pendingDiscardToPlay;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: The chosen card must be in the chooser's hand right now.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  const targetCardId = cardId as CardExtId;
  let foundIndex = -1;
  for (let handIndex = 0; handIndex < playerZones.hand.length; handIndex++) {
    if (playerZones.hand[handIndex] === targetCardId) {
      foundIndex = handIndex;
      break;
    }
  }
  if (foundIndex === -1) {
    // why: invalid/stale target is a no-op that leaves the queue intact so the
    // player resubmits an in-hand card.
    return;
  }

  // Step 4: Move the card from hand to discard through the single forced-discard
  // chokepoint (WP-498 / D-24301) — this fires the return-on-discard reaction so
  // discarding Cyclops Unending Energy to pay this cost offers to return it. The
  // card is guaranteed present (foundIndex !== -1 above), so the move always
  // succeeds. Then log, decrement remaining, and front-pop when it hits 0.
  discardFromHand(G, playerID, targetCardId);
  pushLog(G,
    `Player ${playerID} discarded ${formatCardRef(G.cardDisplayData, targetCardId)} from their hand to pay the cost of ${formatCardRef(G.cardDisplayData, front.sourceCardId)}.`,
  );
  front.remaining -= 1;
  if (front.remaining <= 0) {
    queue.shift();
  }
}
