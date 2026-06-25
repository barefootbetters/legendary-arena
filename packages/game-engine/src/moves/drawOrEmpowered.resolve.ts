/**
 * resolveDrawOrEmpowered move — resolves a pending draw-or-empowered player
 * choice (WP-286 / D-24069).
 *
 * Called by the active player (or the deterministic bot) after a draw-or-empowered
 * hero ability parked a PendingDrawOrEmpowered on G.pendingDrawOrEmpowered (FIFO).
 * This realizes the printed One-Hit Wonder text: "Choose one: Draw a card, or you
 * get Empowered by [class]." The player picks 'draw' (reuses the existing draw
 * executor) or 'empowered' (reuses the existing empowered composition) — neither
 * branch re-implements its effect.
 *
 * The choice is heterogeneous (a card draw vs. an attack bonus), so it is an
 * interactive pending choice rather than an oracle-max (unlike the WP-283 two-
 * empowered choose-one form). The bot default (ai.legalMoves.ts) always picks
 * 'empowered' deterministically.
 *
 * Atomicity: the chosen effect fires, then the front entry is popped. A failed
 * validation (invalid choice, empty queue, wrong player) returns before any
 * mutation and leaves the queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';
import { interpretHeroPrimitiveEffect } from '../hero/effectPrimitive.interpret.js';
import { buildEmpoweredComposition } from '../rules/heroCompositions.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveDrawOrEmpowered move.
 *
 * The player must pick exactly one of the two printed options.
 */
export interface ResolveDrawOrEmpoweredArgs {
  /** Which half of the "Choose one" the player takes: draw a card, or be Empowered. */
  choice: 'draw' | 'empowered';
}

/**
 * Whether any draw-or-empowered choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingVictoryPileCardPick, D-24067).
 *
 * // why: pendingDrawOrEmpowered is lazy-init (D-24069); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending draw-or-empowered queue holds at least one entry.
 */
export function hasPendingDrawOrEmpowered(G: LegendaryGameState): boolean {
  return (G.pendingDrawOrEmpowered?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending draw-or-empowered choice.
 *
 * Atomic sequence (HARD — exact order, mirrors optionalKoReward.resolve.ts):
 *   1. Validate args — choice must be exactly 'draw' or 'empowered'; anything else
 *      is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Dispatch the chosen effect by REUSING the existing executor (no re-impl):
 *      - 'draw'      → executeSingleEffect(..., { type: 'draw', magnitude: 1 })
 *      - 'empowered' → interpretHeroPrimitiveEffect(..., buildEmpoweredComposition(class))
 *   4. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 3 ABORTS the effect (no draw, no attack grant, no shift).
 * Moves never throw.
 *
 * // why: block-all guard — no other move may fire while a draw-or-empowered choice is outstanding (D-24069)
 *
 * @param context - boardgame.io move context with G, playerID, and the rest
 *   (ctx, events, random, log) spread into `context` so the 'draw' branch's deck
 *   reshuffle has access to ctx.random.
 * @param args - the choice ('draw' or 'empowered').
 */
export function resolveDrawOrEmpowered(
  { G, playerID, ...context }: MoveContext,
  args: ResolveDrawOrEmpoweredArgs,
): void {
  // Step 1: Validate args — choice must be exactly 'draw' or 'empowered'.
  const choice = (args as { choice?: unknown }).choice;
  if (choice !== 'draw' && choice !== 'empowered') {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted).
  // why: pendingDrawOrEmpowered is lazy-init (D-24069); undefined and [] both mean no pending choice
  const queue = G.pendingDrawOrEmpowered;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3: Dispatch the chosen effect by REUSING the existing executor.
  if (choice === 'draw') {
    // why: reuse the existing draw executor (no re-implementation of card draw); the
    // empty cardId is ignored by the draw handler (it draws into the player's hand,
    // not from a specific card). `context` carries ctx.random for the deck reshuffle.
    executeSingleEffect(G, context, playerID, '' as CardExtId, { type: 'draw', magnitude: 1 });
  } else {
    // why: reuse the empowered composition (no re-implementation of the count); same amount the core path grants (D-24069)
    interpretHeroPrimitiveEffect(G, context, playerID, buildEmpoweredComposition(front.empoweredClass));
  }

  // Step 4: Front-pop LAST (front-pop = Array.shift), mirroring WP-248.
  queue.shift();
}
