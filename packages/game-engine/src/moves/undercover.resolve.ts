/**
 * resolveUndercoverChoice move — resolves a pending Undercover target pick
 * (WP-678 / D-24494, supersedes D-24060).
 *
 * Called by the active player (or the deterministic bot) after an
 * `undercover-hand-shield-hero` effect parked a PendingUndercoverChoice on
 * G.pendingUndercoverChoice (FIFO) because TWO OR MORE eligible [team:shield] Heroes
 * were in hand. (0 eligible = no-op, 1 = auto-send — neither parks.) The chosen Hero
 * is sent Undercover (into the Victory Pile, worth 1 VP) via the shared
 * sendCardUndercover helper — no re-implementation of the send.
 *
 * Atomicity: the chosen send fires, then the front entry is popped. A failed
 * validation (bad target, empty queue, wrong player, target not eligible) returns
 * before any mutation and leaves the queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { sendCardUndercover } from '../hero/heroEffects.execute.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveUndercoverChoice move.
 *
 * The player picks which eligible hand Hero to send Undercover.
 */
export interface ResolveUndercoverChoiceArgs {
  /** The ext_id of the eligible hand Hero to send Undercover. */
  targetExtId: CardExtId;
}

/**
 * Whether any Undercover target pick is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingDrawOrEmpowered / hasPendingCountScaledChoice).
 *
 * // why: pendingUndercoverChoice is lazy-init (D-24494); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Undercover queue holds at least one entry.
 */
export function hasPendingUndercoverChoice(G: LegendaryGameState): boolean {
  return (G.pendingUndercoverChoice?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending Undercover target pick.
 *
 * Atomic sequence (HARD — exact order, mirrors drawOrEmpowered.resolve.ts):
 *   1. Validate args — targetExtId must be a non-empty string.
 *   2. Validate the front pending entry — non-empty queue, front.playerID match,
 *      and targetExtId must be one of front.eligibleTargets.
 *   3. Send the chosen Hero Undercover by REUSING sendCardUndercover (hand → Victory
 *      Pile + tracker). No re-implementation.
 *   4. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 3 ABORTS the send (no move, no shift). Moves never throw.
 *
 * // why: block-all guard — no other move may fire while an Undercover pick is outstanding (D-24494)
 *
 * @param context - boardgame.io move context with G, playerID.
 * @param args - the chosen target ext_id.
 */
export function resolveUndercoverChoice(
  { G, playerID }: MoveContext,
  args: ResolveUndercoverChoiceArgs,
): void {
  // Step 1: Validate args — targetExtId must be a non-empty string.
  const targetExtId = (args as { targetExtId?: unknown }).targetExtId;
  if (typeof targetExtId !== 'string' || targetExtId.length === 0) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  // why: pendingUndercoverChoice is lazy-init (D-24494); undefined and [] both mean no pending choice
  const queue = G.pendingUndercoverChoice;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }
  // why: the target must be one of the eligible Heroes snapshotted at park time — a
  // client cannot send an arbitrary (or ineligible) card Undercover.
  if (!front.eligibleTargets.includes(targetExtId as CardExtId)) {
    return;
  }

  // Step 3: Send the chosen Hero Undercover by REUSING the shared helper.
  const zones = G.playerZones[playerID];
  if (!zones) {
    return;
  }
  zones.hand = sendCardUndercover(G, playerID, targetExtId as CardExtId, zones.hand);

  // Step 4: Front-pop LAST (Array.shift), mirroring the shipped resolve moves.
  queue.shift();
}
