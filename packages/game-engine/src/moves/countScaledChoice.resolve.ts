/**
 * resolveCountScaledChoice move — resolves a pending count-scaled choose-one
 * player choice (WP-675 / D-24490).
 *
 * Called by the active player (or the deterministic bot) after a count-scaled-choose
 * hero ability parked a PendingCountScaledChoice on G.pendingCountScaledChoice (FIFO).
 * This realizes vnom's Symbiotic Adaptation: "Choose one: +1 recruit for each other
 * card you played this turn with a recruit icon / Or +1 attack for each other card
 * with an attack icon." The player picks an option index; the chosen option's grant
 * reuses the shipped attack-per-count / recruit-per-count executor (no re-implementation
 * of the count-scaled grant).
 *
 * The two options differ in BOTH resource and count, so the choice is a genuine
 * interactive pending choice (the draw-or-empowered pattern), not an oracle-max.
 *
 * Atomicity: the chosen effect fires, then the front entry is popped. A failed
 * validation (out-of-range index, empty queue, wrong player) returns before any
 * mutation and leaves the queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveCountScaledChoice move.
 *
 * The player must pick exactly one of the parked options by its index.
 */
export interface ResolveCountScaledChoiceArgs {
  /** Which parked option the player takes (0-based index into the pending options). */
  optionIndex: number;
}

/**
 * Whether any count-scaled choose-one choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingDrawOrEmpowered, D-24069).
 *
 * // why: pendingCountScaledChoice is lazy-init (D-24490); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending count-scaled-choice queue holds at least one entry.
 */
export function hasPendingCountScaledChoice(G: LegendaryGameState): boolean {
  return (G.pendingCountScaledChoice?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending count-scaled choose-one choice.
 *
 * Atomic sequence (HARD — exact order, mirrors drawOrEmpowered.resolve.ts):
 *   1. Validate args — optionIndex must be an integer in range of the front entry's
 *      options; anything else is a silent no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Dispatch the chosen option by REUSING the existing per-count executor (no re-impl):
 *      an 'attack' option → executeSingleEffect(..., { type: 'attack-per-count', … }),
 *      a 'recruit' option → executeSingleEffect(..., { type: 'recruit-per-count', … }).
 *      The triggering card id (front.cardId) is threaded so the icon count source
 *      excludes the played vnom card from its own count.
 *   4. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 3 ABORTS the grant (no shift). Moves never throw.
 *
 * // why: block-all guard — no other move may fire while a count-scaled choice is outstanding (D-24490)
 *
 * @param context - boardgame.io move context; the rest (ctx, events, random, log) is
 *   spread into `context` and forwarded to the per-count executor.
 * @param args - the chosen option index.
 */
export function resolveCountScaledChoice(
  { G, playerID, ...context }: MoveContext,
  args: ResolveCountScaledChoiceArgs,
): void {
  // Step 1a: Validate the front pending entry FIRST (so the range check can read its options).
  // why: pendingCountScaledChoice is lazy-init (D-24490); undefined and [] both mean no pending choice
  const queue = G.pendingCountScaledChoice;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 1b: Validate args — optionIndex must be an integer index into front.options.
  const optionIndex = (args as { optionIndex?: unknown }).optionIndex;
  if (
    typeof optionIndex !== 'number'
    || !Number.isInteger(optionIndex)
    || optionIndex < 0
    || optionIndex >= front.options.length
  ) {
    return;
  }
  const chosen = front.options[optionIndex]!;

  // Step 3: Dispatch the chosen option by REUSING the existing per-count executor.
  // why: WP-675 / D-24490 — the chosen resource maps to the shipped count-scaled effect
  // type; front.cardId is threaded as the effect's card so the "each OTHER card" icon
  // source excludes the played vnom card. No re-implementation of the count-scaled grant.
  const effectType = chosen.resource === 'attack' ? 'attack-per-count' : 'recruit-per-count';
  executeSingleEffect(G, context, playerID, front.cardId as CardExtId, {
    type: effectType,
    magnitude: chosen.magnitude,
    countSource: chosen.countSource,
  });

  // Step 4: Front-pop LAST (front-pop = Array.shift), mirroring WP-286.
  queue.shift();
}
