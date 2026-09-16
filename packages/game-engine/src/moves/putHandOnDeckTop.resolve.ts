/**
 * resolvePutHandOnDeckTop move — resolves a pending "put a card from your hand on
 * top of your deck" choice (WP-700 / D-24519).
 *
 * Called by the active player after a `put-hand-on-deck-top` hero ability (Gambit's
 * Stack the Deck, Brainstorm's Time Loop Experiments, and the dstr/wpnx/wtif
 * siblings) drew the printed number of cards and parked a PendingPutHandOnDeckTop on
 * G.pendingPutHandOnDeckTop (FIFO). Per the printed text the placement is MANDATORY —
 * the player must put exactly one card from their (now enlarged) hand on TOP of their
 * own deck — so there is NO decline arm. The player chooses WHICH card; this move
 * validates the choice against the front pending entry and the current hand, moves the
 * chosen card hand→deck-top (deck[0], drawn first next), and front-pops the queue.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit — the block-all guard
 * guarantees a non-empty hand (and thus a valid choice) still exists while pending.
 *
 * The move is server-only (registered `client: false` in game.ts): the client submits
 * intent ({ cardId }); the ENGINE mutates the deck — the client never computes the
 * outcome.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolvePutHandOnDeckTop move.
 *
 * cardId — the hand ext_id to put on top of the deck (ends up at deck[0], drawn
 * first). Must be present in the active player's hand. There is no decline arm: the
 * placement is mandatory.
 */
export interface ResolvePutHandOnDeckTopArgs {
  cardId: CardExtId;
}

/**
 * Lists the cards eligible to put on top of the deck for a pending choice — the
 * chooser's entire current hand, in hand order.
 *
 * // why: D-24519 — "put A card from your hand on top of your deck" places any one hand
 * card (no type/cost filter), so every card in the current hand is eligible. This is the
 * round-trip predicate the UIState projection and the resolve move share, mirroring
 * getEligibleSmashDiscardCards / getEligibleDiscardToPlayCards.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose hand is listed.
 * @returns The eligible card ids, preserving hand order.
 */
export function getEligiblePutHandOnDeckTopCards(
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
 * Whether any put-a-hand-card-on-deck-top choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingSmashDiscard, D-24492).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending put-on-deck-top queue holds at least one entry.
 */
export function hasPendingPutHandOnDeckTop(G: LegendaryGameState): boolean {
  return (G.pendingPutHandOnDeckTop?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending put-a-hand-card-on-deck-top choice by moving the chosen
 * card from the player's hand onto the top of their deck.
 *
 * Validate args → validate the front pending entry → confirm the card is in the hand
 * now → move hand→deck-top → front-pop on success. Silent no-ops: non-string / empty
 * cardId; empty queue; front.playerID mismatch; the card absent from the hand (queue
 * intact — resubmit).
 *
 * // why: D-24519 — there is NO decline arm: the printed placement is mandatory ("put a
 * card…", not "you may"). The only degenerate — an empty hand — is handled at park time
 * (the handler parks nothing), so a parked choice always has an eligible card.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardId } to put on top of the deck.
 */
export function resolvePutHandOnDeckTop(
  { G, playerID }: MoveContext,
  args: ResolvePutHandOnDeckTopArgs,
): void {
  // Step 1: Validate args — cardId must be a non-empty string.
  const cardId = (args as { cardId?: unknown }).cardId;
  if (typeof cardId !== 'string' || cardId.length === 0) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the
  // payload, so a non-front entry can never be targeted).
  const queue = G.pendingPutHandOnDeckTop;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }

  // Step 3: Resolve against CURRENT G. The block-all guard freezes the hand while
  // pending, so the hand the client saw is the hand we validate against.
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }

  // why: remove the chosen id from a WORKING copy of the hand; if it is not found the
  // choice is invalid and we no-op with the real hand untouched (queue intact —
  // resubmit). Mirrors the putCardsOnDeckChoice.resolve validate-then-commit idiom.
  const moveResult = moveCardFromZone(playerZones.hand, [], cardId as CardExtId);
  if (!moveResult.found) { return; }

  // Step 4: Mutate — commit the validated hand and prepend the chosen card to the deck
  // top. // why: deck[0] IS the top of the deck (drawn first), so `[cardId, ...deck]`
  // puts the chosen card on top exactly as the printed text requires (the
  // putCardsOnDeckChoice.resolve top-placement idiom).
  playerZones.hand = moveResult.from;
  playerZones.deck = [cardId as CardExtId, ...playerZones.deck];

  // Step 5: Narrate the resolved placement. `G.messages` is hash-excluded (D-24081),
  // so this adds no determinism / sentinel impact.
  pushLog(
    G,
    `Player ${playerID} put ${formatCardRef(G.cardDisplayData, cardId as CardExtId)} from their hand on top of their deck.`,
    'applied',
  );

  // Step 6: Front-pop ONLY on success (front-pop = Array.shift).
  queue.shift();
}
