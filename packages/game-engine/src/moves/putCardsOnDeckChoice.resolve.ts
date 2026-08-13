/**
 * resolvePutCardsOnDeckChoice move — resolves a pending put-cards-on-deck player
 * choice (WP-538 / D-24347).
 *
 * Called by the current player after core Dr. Doom's Master Strike ("Each player
 * with exactly 6 cards in hand reveals a [hc:tech] Hero or puts 2 cards from
 * their hand on top of their deck") parked a PendingPutCardsOnDeckChoice — the
 * player holds no Tech Hero to reveal and must put `count` (2) cards on top of
 * their deck. The player selects which cards, in the order they go on top; this
 * move validates the selection against the front pending entry and the current
 * hand, moves the chosen cards hand→deck-top (selection order = top order,
 * cardIds[0] ends up on top / drawn first), and front-pops the queue.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid selection —
 * the block-all guard guarantees the hand (and thus a valid selection) still
 * exists while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolvePutCardsOnDeckChoice move.
 *
 * cardIds — the hand ext_ids to put on top of the deck, in top-down order
 * (cardIds[0] ends up on top, drawn first). Must be EXACTLY the front pending
 * entry's `count` ids, and every id must be present in the hand (duplicate-aware;
 * first matching occurrence removed per id).
 */
export interface ResolvePutCardsOnDeckChoiceArgs {
  cardIds: CardExtId[];
}

/**
 * Whether any put-cards-on-deck choice is currently pending.
 *
 * Single predicate imported by the turn-end guards and the block-all action-move
 * guards. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingDiscardChoice, D-24284).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-put-on-deck queue holds at least one entry.
 */
export function hasPendingPutCardsOnDeckChoice(G: LegendaryGameState): boolean {
  return (G.pendingPutCardsOnDeckChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending put-cards-on-deck choice by moving the chosen cards
 * from the player's hand onto the top of their deck.
 *
 * Validate args → validate the front pending entry → validate the selection is
 * EXACTLY `count` ids all present in the hand (duplicate-aware) → move
 * hand→deck-top in selection order → front-pop on success. Silent no-ops:
 * non-array / empty / non-string cardIds; empty queue; front.playerID mismatch;
 * front.choiceType mismatch; wrong count; any id absent from the hand (queue
 * intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardIds } to put on top of the deck.
 */
export function resolvePutCardsOnDeckChoice(
  { G, playerID }: MoveContext,
  args: ResolvePutCardsOnDeckChoiceArgs,
): void {
  // Step 1: Validate args — cardIds must be a non-empty array of non-empty strings
  if (!Array.isArray(args.cardIds)) { return; }
  if (args.cardIds.length === 0) { return; }
  for (const cardId of args.cardIds) {
    if (typeof cardId !== 'string' || cardId.length === 0) { return; }
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted)
  const queue = G.pendingPutCardsOnDeckChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'put-cards-on-deck') { return; }

  // Step 3: Resolve against CURRENT G — the selection must be EXACTLY `count` ids.
  // The block-all guard freezes the hand while pending, so the hand the client saw
  // is the hand we validate against.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  // why: exactly-`count` — the printed strike puts a fixed number of cards on top.
  // Combined with the in-hand check below (duplicate-aware removal), this rejects
  // any wrong-sized selection and any card not actually held.
  if (args.cardIds.length !== front.count) { return; }

  // why: remove each chosen id from a WORKING copy of the hand; if any id is not
  // found the whole selection is invalid and we no-op with the real hand untouched
  // (queue intact — resubmit). Duplicate ext_ids are fungible tokens (WP-382 /
  // D-24183), so first-match removal per id is observationally identical to index
  // removal, and submitting the same id twice correctly consumes two copies (or
  // no-ops if only one is held).
  let workingHand = playerZones.hand;
  const chosenCards: CardExtId[] = [];
  for (const cardId of args.cardIds) {
    const moveResult = moveCardFromZone(workingHand, [], cardId);
    if (!moveResult.found) { return; }
    workingHand = moveResult.from;
    chosenCards.push(cardId);
  }

  // Step 4: Mutate — commit the validated hand and prepend the chosen cards to the
  // deck top in selection order (chosenCards[0] ends up at deck[0], drawn first).
  playerZones.hand = workingHand;
  playerZones.deck = [...chosenCards, ...playerZones.deck];

  // Step 5: Narrate the resolved placement. `G.messages` is hash-excluded
  // (D-24081), so this adds no determinism / sentinel impact.
  pushLog(
    G,
    `Player ${playerID} put ${chosenCards.length} card(s) on top of their deck.`,
  );

  // Step 6: Front-pop ONLY on success (front-pop = Array.shift)
  queue.shift();
}
