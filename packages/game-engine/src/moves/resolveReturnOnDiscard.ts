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
 * A NON-ACTIVE seat's front entry (a discard forced on another player's turn —
 * Monarch's Decree, an escape's Bystander discard) cannot be answered through this
 * move, because boardgame.io admits only the current player. The play-phase turn.onMove
 * opener `openNonActiveReturnOnDiscardSeatChoiceIfNeeded` converts it into a single-seat
 * WP-684 seat choice ('return-on-discard') for that seat instead (WP-793 / D-24656).
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
// why: WP-793 / D-24656 — the park entry point for the non-active seat's choice.
// seatChoice.resolve imports this module's seat-choice apply, so the two form a
// runtime-safe import cycle (each references the other ONLY inside function bodies, never
// at module top level), so ESM resolves both bindings by call time (the
// divingBlock.logic.ts precedent).
import { parkSeatChoice } from './seatChoice.resolve.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** The seat-choice kind a non-active seat answers its return-on-discard through (WP-793). */
export const RETURN_ON_DISCARD_SEAT_CHOICE_KIND = 'return-on-discard';

// why: WP-793 / D-24656 — option 0 returns the card (the bot's existing
// return-when-eligible default), option 1 leaves it in the discard pile.
const RETURN_ON_DISCARD_RETURN_OPTION_INDEX = 0;

/**
 * Minimal boardgame.io events surface the opener needs (setActivePlayers via
 * parkSeatChoice). Optional so a unit / sim / replay context is a guarded no-op.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

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
  // why: WP-793 / D-24656 — while the front entry is being answered through its
  // 'return-on-discard' seat choice, the ridden seat's empty stage still accepts global
  // moves, so a stale client or crafted legacy submission would pop the entry out from
  // under the choice. No-op (defense in depth; the projection gate keeps a well-formed
  // client from offering this prompt). Unreachable before WP-793, so every previously
  // reachable state behaves byte-identically.
  if (G.pendingSeatChoice?.kind === RETURN_ON_DISCARD_SEAT_CHOICE_KIND) {
    return;
  }

  // Step 1: Validate args — exactly one of { decline: true } / { cardId }.
  // why: a client may submit the move with no payload (undefined) or null; reading a field off
  // either throws a TypeError, and moves never throw — reject before any field read.
  if (args === null || typeof args !== 'object') {
    return;
  }
  const isDecline = (args as { decline?: unknown }).decline === true;
  const cardId = (args as { cardId?: unknown }).cardId;
  const isReturnRequest = typeof cardId === 'string' && cardId.length > 0;
  // why: exactly-one-shape — both present or neither present is malformed.
  if (isDecline === isReturnRequest) {
    return;
  }

  // Step 1b: Priority guard (D-24527) — a return-on-discard is OPTIONAL and lower
  // priority than a MANDATORY discard-to-play cost still being paid (the block-all
  // guard list orders discard-to-play before return-on-discard, game.ts). While a
  // discard-to-play cost is unresolved, this move is a silent no-op that leaves BOTH
  // queues intact. Without this, a multi-discard cost (Ruby Summers "Extinction Blast"
  // — discard three) could be paid with ONE return-on-discard card (Cyclops "Unending
  // Energy"): return it between discards and re-discard the same card N times. Deferring
  // the return until the full cost is paid forces N distinct cards, then lets the card
  // come back — the faithful tabletop timing (pay the whole cost, THEN the "you may
  // return" trigger resolves).
  if (hasPendingDiscardToPlay(G)) {
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

/**
 * Converts a NON-ACTIVE seat's front return-on-discard entry into a single-seat seat
 * choice for that seat ("Return X to your hand" / "Leave X in your discard pile").
 * Called from the play-phase turn.onMove (and its sim / fixture mirrors) after every move.
 *
 * Returns at once while any seat choice is open, when the front entry belongs to the
 * active player (who keeps answering through resolveReturnOnDiscard, unchanged), when the
 * active player is unknown, or once the match is decided.
 *
 * // why: WP-793 / D-24656 — boardgame.io admits only the current player's moves, so a
 * non-active seat's entry (Monarch's Decree, an escape's Bystander discard) froze the turn:
 * the block-all guard waited on a reaction nobody could submit. The seat choice stage-rides
 * that seat so it answers its own reaction.
 *
 * @param G - The game state, mutated in place (G.pendingSeatChoice set).
 * @param events - The move context's boardgame.io events (for the stage ride), or undefined.
 * @param currentPlayer - The active player id (ctx.currentPlayer, or the sim loop's seat).
 */
export function openNonActiveReturnOnDiscardSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  if (G.pendingSeatChoice !== undefined) {
    return;
  }
  const front = G.pendingReturnOnDiscard?.[0];
  // why: an unknown active player (a unit test that invokes onMove with only { G }) cannot
  // tell an active entry from a non-active one; leave the queue to the legacy move.
  if (front === undefined || currentPlayer === undefined || front.playerID === currentPlayer) {
    return;
  }
  if (evaluateEndgame(G) !== null) {
    return;
  }
  const cardName = resolveCardName(G.cardDisplayData, front.cardId);
  const choice: PendingSeatChoice = {
    kind: RETURN_ON_DISCARD_SEAT_CHOICE_KIND,
    addressedSeats: [front.playerID],
    seatPrompts: {
      [front.playerID]: {
        options: [
          { label: `Return ${cardName} to your hand`, cardId: front.cardId },
          { label: `Leave ${cardName} in your discard pile`, cardId: front.cardId },
        ],
      },
    },
    submissions: {},
    defaultOptionIndex: RETURN_ON_DISCARD_RETURN_OPTION_INDEX,
  };
  parkSeatChoice(G, events, choice, currentPlayer);
}

/**
 * Applies a fully-submitted 'return-on-discard' seat choice: option 0 returns the card
 * from the seat's discard pile to its hand, option 1 leaves it; the front entry is
 * front-popped either way. Proceeds only while the queue's front entry still matches the
 * addressed seat and the option's card, else a logged no-op.
 *
 * // why: WP-793 / D-24656 — duplicates resolveReturnOnDiscard steps 3–5 (00.6: duplicate
 * first, abstract only at a third copy); the legacy move body is untouched. Unlike the
 * legacy move, a card no longer in the discard pile still front-pops (logged), because a
 * seat choice clears on apply and re-opening it would ask the same seat again forever.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'return-on-discard').
 */
export function applyReturnOnDiscardSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const seat = choice.addressedSeats[0];
  const submission = seat === undefined ? undefined : choice.submissions[seat];
  const option = seat === undefined || submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex];
  const queue = G.pendingReturnOnDiscard;
  const front = queue?.[0];
  if (
    seat === undefined || submission === undefined || option === undefined ||
    queue === undefined || front === undefined ||
    front.playerID !== seat || front.cardId !== option.cardId
  ) {
    pushLog(G, 'The return-on-discard choice no longer matches a pending return — nothing changed.');
    return;
  }
  const cardRef = formatCardRef(G.cardDisplayData, front.cardId);
  if (submission.optionIndex !== RETURN_ON_DISCARD_RETURN_OPTION_INDEX) {
    queue.shift();
    pushLog(G, `Player ${seat} declined to return ${cardRef} to their hand.`);
    return;
  }
  const playerZones = G.playerZones[seat];
  const moveResult = playerZones === undefined
    ? undefined
    : moveCardFromZone(playerZones.discard, playerZones.hand, front.cardId);
  if (playerZones === undefined || moveResult === undefined || !moveResult.found) {
    queue.shift();
    pushLog(G, `Player ${seat} could not return ${cardRef} — it is no longer in their discard pile.`);
    return;
  }
  playerZones.discard = moveResult.from;
  playerZones.hand = moveResult.to;
  pushLog(G, `Player ${seat} returned ${cardRef} from their discard pile to their hand.`);
  queue.shift();
}
