/**
 * resolveReorderChoice move — resolves a pending reveal-remainder reorder player
 * choice (WP-479 / D-24286).
 *
 * Called by the current player after a reveal marked `reorderRemainder` (The
 * Amazing Spider-Man's "Put the rest back in any order") parked a
 * PendingReorderChoice — ≥2 revealed cards were not drawn and sit on top of the
 * deck. The player picks the order to put those cards back on top; this move
 * validates the submission is a permutation of the parked remainder and rewrites
 * the top-N of the deck to that order, front-popping the queue.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid order — the
 * block-all guard guarantees the deck top (and thus the parked cards) still
 * exists while pending. The reorder is a PURE permutation: no ctx.random, no
 * cards added or removed, no zone other than the deck touched.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveReorderChoice move.
 *
 * orderedCardIds — the remainder ext_ids in the player's chosen top-of-deck
 * order. Must be a permutation of the front pending entry's `cardIds` (same
 * multiset AND same length); the first `orderedCardIds.length` cards of the deck
 * are rewritten to this order and everything below is untouched.
 */
export interface ResolveReorderChoiceArgs {
  orderedCardIds: CardExtId[];
}

/**
 * Whether any reveal-remainder reorder choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and
 * the block-all action-move guards. `undefined` and `[]` both mean no pending
 * choice (mirrors hasPendingDiscardChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-reorder queue holds at least one entry.
 */
export function hasPendingReorderChoice(G: LegendaryGameState): boolean {
  return (G.pendingReorderChoices?.length ?? 0) > 0;
}

/**
 * Returns whether `candidate` is a permutation of `reference` — same length and
 * same multiset of ext_ids (duplicate-aware). Deterministic; sorts copies.
 *
 * @param candidate - The submitted order.
 * @param reference - The parked remainder.
 * @returns true when `candidate` reorders exactly `reference` (no add/drop/dupe).
 */
function isPermutationOf(candidate: CardExtId[], reference: CardExtId[]): boolean {
  if (candidate.length !== reference.length) { return false; }
  // why: multiset equality via sorted copies — ext_ids are fungible tokens
  // (WP-382 / D-24183), so a value-count match is exactly "same cards, any order".
  // Copies are sorted (inputs never mutated); no .reduce().
  const sortedCandidate = [...candidate].sort();
  const sortedReference = [...reference].sort();
  for (let index = 0; index < sortedCandidate.length; index++) {
    if (sortedCandidate[index] !== sortedReference[index]) { return false; }
  }
  return true;
}

/**
 * Resolves the FRONT pending reorder choice by rewriting the top-N of the
 * player's deck to the submitted order.
 *
 * Validate args → validate the front pending entry → validate the submission is a
 * permutation of the parked `cardIds` → rewrite the top-N of the deck → front-pop
 * on success. Silent no-ops: non-array / empty / non-string orderedCardIds; empty
 * queue; front.playerID mismatch; front.choiceType mismatch; not a permutation of
 * the parked remainder (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the chosen { orderedCardIds } for the top of the deck.
 */
export function resolveReorderChoice({ G, playerID }: MoveContext, args: ResolveReorderChoiceArgs): void {
  // Step 1: Validate args — orderedCardIds must be a non-empty array of non-empty strings
  if (!Array.isArray(args.orderedCardIds)) { return; }
  if (args.orderedCardIds.length === 0) { return; }
  for (const cardId of args.orderedCardIds) {
    if (typeof cardId !== 'string' || cardId.length === 0) { return; }
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted)
  const queue = G.pendingReorderChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'reorder-deck-top') { return; }

  // Step 3: The submission must be a permutation of the parked remainder — same
  // cards, any order. The block-all guard froze the deck top since park time, so
  // `front.cardIds` is still the top-N of the deck; rewriting the top-N to a
  // permutation preserves the whole-deck multiset (no card added or dropped).
  if (!isPermutationOf(args.orderedCardIds, front.cardIds)) { return; }

  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  const remainderCount = front.cardIds.length;
  // why: defense-in-depth (copilot #2) — verify the deck top still matches the
  // parked remainder before rewriting; if a future block-all regression let it
  // drift, no-op rather than scramble the deck. Belt-and-suspenders over the
  // block-all guarantee, not a substitute for it.
  if (playerZones.deck.length < remainderCount) { return; }
  if (!isPermutationOf(playerZones.deck.slice(0, remainderCount), front.cardIds)) { return; }

  // Step 4: Mutate — rewrite the top-N to the chosen order, leave the rest of the
  // deck untouched. New array (never mutate the input in place).
  playerZones.deck = [...args.orderedCardIds, ...playerZones.deck.slice(remainderCount)];

  // Step 5: Front-pop ONLY on success (front-pop = Array.shift). No log line — a
  // deck-top reorder is private and produces no observable public event.
  queue.shift();
}
