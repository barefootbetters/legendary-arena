/**
 * resolveDiscardChoice move — resolves a pending discard-to-limit player choice
 * (WP-476 / D-24284).
 *
 * Called by the current player after Magneto's Master Strike ("Each player
 * reveals an [team:x-men] Hero or discards down to four cards") parked a
 * PendingDiscardChoice — the player holds no X-Men Hero to reveal and must
 * discard down to the hand-size limit. The player selects which cards to
 * discard; this move validates the selection against the front pending entry
 * and the current hand, moves the chosen cards hand→discard, and front-pops the
 * queue.
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
import { discardFromHand } from './discardFromHand.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveDiscardChoice move.
 *
 * cardIds — the hand ext_ids to discard. Must discard EXACTLY down to the front
 * pending entry's `limit` (i.e., `hand.length - cardIds.length === limit`) and
 * every id must be present in the hand (duplicate-aware; first matching
 * occurrence removed per id).
 */
export interface ResolveDiscardChoiceArgs {
  cardIds: CardExtId[];
}

/**
 * Whether any discard-to-limit choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and
 * the block-all action-move guards. `undefined` and `[]` both mean no pending
 * choice (mirrors hasPendingScryKoChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-discard queue holds at least one entry.
 */
export function hasPendingDiscardChoice(G: LegendaryGameState): boolean {
  return (G.pendingDiscardChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending discard-to-limit choice by discarding the chosen
 * cards from the player's hand.
 *
 * Validate args → validate the front pending entry → validate the selection
 * discards EXACTLY down to `limit` and every id is in hand (duplicate-aware) →
 * move hand→discard → front-pop on success. Silent no-ops: non-array / empty /
 * non-string cardIds; empty queue; front.playerID mismatch; front.choiceType
 * mismatch; wrong discard count (not exactly to `limit`); any id absent from the
 * hand (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardIds } to discard.
 */
export function resolveDiscardChoice({ G, playerID }: MoveContext, args: ResolveDiscardChoiceArgs): void {
  // Step 1: Validate args — cardIds must be a non-empty array of non-empty strings
  if (!Array.isArray(args.cardIds)) { return; }
  if (args.cardIds.length === 0) { return; }
  for (const cardId of args.cardIds) {
    if (typeof cardId !== 'string' || cardId.length === 0) { return; }
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index
  // in the payload, so a non-front entry can never be targeted)
  const queue = G.pendingDiscardChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'discard-to-limit') { return; }

  // Step 3: Resolve against CURRENT G — the selection must discard EXACTLY down
  // to `limit`. The block-all guard freezes the hand while pending, so the hand
  // the client saw is the hand we validate against.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  // why: exactly-to-limit — `hand - selected === limit`. Combined with the
  // in-hand check below (duplicate-aware removal), this rejects both over- and
  // under-discarding and any card not actually held.
  if (playerZones.hand.length - args.cardIds.length !== front.limit) { return; }

  // why: remove each chosen id from a WORKING copy of the hand; if any id is not
  // found the whole selection is invalid and we no-op with the real hand
  // untouched (queue intact — resubmit). Duplicate ext_ids are fungible tokens
  // (WP-382 / D-24183), so first-match removal per id is observationally
  // identical to index removal, and submitting the same id twice correctly
  // consumes two copies (or no-ops if only one is held).
  let workingHand = playerZones.hand;
  const removedCards: CardExtId[] = [];
  for (const cardId of args.cardIds) {
    const moveResult = moveCardFromZone(workingHand, [], cardId);
    if (!moveResult.found) { return; }
    workingHand = moveResult.from;
    removedCards.push(cardId);
  }

  // Step 4: Mutate — discard each chosen card through the single forced-discard
  // chokepoint (WP-498 / D-24301), which fires the return-on-discard reaction so
  // a Cyclops Unending Energy discarded to a discard-to-limit strike offers to
  // return. Step 3 already validated every id is present (exactly-to-limit), so
  // each discardFromHand finds its card; duplicate ext_ids are fungible, so
  // first-match removal per id consumes copies correctly.
  for (const cardId of removedCards) {
    discardFromHand(G, playerID, cardId);
  }

  // Step 5: Narrate the resolved discard so the player sees the count they
  // discarded. `G.messages` is hash-excluded (D-24081), so this adds no
  // determinism / sentinel impact.
  pushLog(
    G,
    `Player ${playerID} discarded ${removedCards.length} card(s) down to ${front.limit}.`,
  );

  // Step 6: Front-pop ONLY on success (front-pop = Array.shift)
  queue.shift();
}
