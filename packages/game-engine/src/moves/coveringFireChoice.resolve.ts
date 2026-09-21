/**
 * resolveCoveringFireChoice move — resolves a pending Covering Fire choose-one player
 * choice (WP-719 / D-24541 — Hawkeye's "Covering Fire").
 *
 * Called by the ACTIVE player (or the deterministic bot) after a covering-fire hero ability
 * parked a PendingCoveringFireChoice on G.pendingCoveringFireChoices (FIFO). This realizes the
 * printed "[hc:tech]: Choose one: each other player draws a card or each other player discards
 * a card." The active player picks 'draw' or 'discard'; BOTH branches act on EACH OTHER seat
 * (Object.keys(G.playerZones).sort(), skipping the chooser).
 *
 * The two branches are heterogeneous (a table-wide draw vs. a table-wide discard) and neither
 * is strictly dominant in the cooperative ruleset — teammates gaining cards vs. cycling a
 * clogged hand — so it is an interactive pending choice, not an oracle-max. The bot default
 * (ai.legalMoves.ts) always picks 'draw' deterministically.
 *
 * Freeze-safe scoping (D-24284): only the ACTIVE player holds the pending choice. Non-active
 * seats never choose — the discard branch auto-picks each other player's card deterministically
 * (selectDefaultSmashDiscardTarget: lowest cost, CardExtId asc tie-break), because a non-active
 * seat cannot submit a move under the play phase's activePlayers config.
 *
 * Atomicity: the chosen branch fires for every other seat, then the front entry is popped. A
 * failed validation (invalid choice, empty queue, wrong player) returns before any mutation and
 * leaves the queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
import { discardFromHand } from './discardFromHand.js';
import { selectDefaultSmashDiscardTarget } from '../hero/heroEffects.execute.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveCoveringFireChoice move.
 *
 * The active player must pick exactly one of the two printed options.
 */
export interface ResolveCoveringFireChoiceArgs {
  /** Which half of the "Choose one" the active player takes: each other player draws, or discards. */
  choice: 'draw' | 'discard';
}

/** How many cards each other player draws / discards on Covering Fire (the printed magnitude). */
const COVERING_FIRE_MAGNITUDE = 1;

/**
 * Whether any Covering Fire choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingDrawOrEmpowered, D-24069).
 *
 * // why: pendingCoveringFireChoices is lazy-init (D-24541); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Covering Fire queue holds at least one entry.
 */
export function hasPendingCoveringFireChoice(G: LegendaryGameState): boolean {
  return (G.pendingCoveringFireChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending Covering Fire choice.
 *
 * Atomic sequence (HARD — exact order, mirrors drawOrEmpowered.resolve.ts):
 *   1. Validate args — choice must be exactly 'draw' or 'discard'; anything else is a silent
 *      no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Apply the chosen branch to EACH OTHER seat in sorted seat order:
 *      - 'draw'    → each other player draws 1 (drawCardsIntoHand; reshuffle-on-empty via
 *        context.random).
 *      - 'discard' → each other player discards 1 hand card via discardFromHand, auto-picking
 *        the deterministic default target (selectDefaultSmashDiscardTarget) since a non-active
 *        seat cannot choose (D-24284). A seat with an empty hand discards nothing.
 *   4. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 3 ABORTS the effect (no draw, no discard, no shift). Moves never throw.
 *
 * // why: block-all guard — no other move may fire while a Covering Fire choice is outstanding (D-24541)
 *
 * @param context - boardgame.io move context with G, playerID, and the rest (ctx, events,
 *   random, log) spread into `context` so the 'draw' branch's deck reshuffle has access to
 *   context.random.
 * @param args - the choice ('draw' or 'discard').
 */
export function resolveCoveringFireChoice(
  { G, playerID, ...context }: MoveContext,
  args: ResolveCoveringFireChoiceArgs,
): void {
  // Step 1: Validate args — choice must be exactly 'draw' or 'discard'.
  const choice = (args as { choice?: unknown }).choice;
  if (choice !== 'draw' && choice !== 'discard') {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the payload,
  // so a non-front entry can never be targeted).
  // why: pendingCoveringFireChoices is lazy-init (D-24541); undefined and [] both mean no pending choice
  const queue = G.pendingCoveringFireChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Apply the chosen branch to each OTHER seat in sorted seat order.
  // why: D-18902 sorted seat order (Object.keys(G.playerZones).sort()) so the table-wide
  // distribution replays identically; skip the chooser — "each OTHER player".
  for (const otherPlayerID of Object.keys(G.playerZones).sort()) {
    if (otherPlayerID === playerID) {
      continue;
    }
    const otherZones = G.playerZones[otherPlayerID];
    if (!otherZones) {
      continue;
    }
    if (choice === 'draw') {
      // why: reuse the canonical deck-to-hand helper (no re-implementation of draw); `context`
      // carries context.random for the reshuffle-on-empty (D-24285). A player with no cards
      // anywhere draws fewer than the magnitude (a legitimate partial).
      drawCardsIntoHand(otherZones, COVERING_FIRE_MAGNITUDE, context);
      pushLog(
        G,
        `Player ${otherPlayerID} drew a card from ${formatCardRef(G.cardDisplayData, front.sourceCardId)}.`,
        'applied',
        front.sourceCardId,
      );
    } else {
      // why: D-24284 — a non-active seat cannot submit an interactive pick, so auto-discard the
      // deterministic default (lowest cost, CardExtId asc tie-break) through the discardFromHand
      // chokepoint (which also fires the WP-498 return-on-discard reaction). An empty hand
      // discards nothing.
      const discardTarget = selectDefaultSmashDiscardTarget(G, otherPlayerID);
      if (discardTarget === null) {
        pushLog(
          G,
          `Player ${otherPlayerID} had no card to discard for ${formatCardRef(G.cardDisplayData, front.sourceCardId)}.`,
          'blocked',
          front.sourceCardId,
        );
        continue;
      }
      discardFromHand(G, otherPlayerID, discardTarget);
      pushLog(
        G,
        `Player ${otherPlayerID} discarded ${formatCardRef(G.cardDisplayData, discardTarget)} for ${formatCardRef(G.cardDisplayData, front.sourceCardId)}.`,
        'applied',
        front.sourceCardId,
      );
    }
  }

  // Step 4: Front-pop LAST (front-pop = Array.shift), mirroring WP-248.
  queue.shift();
}
