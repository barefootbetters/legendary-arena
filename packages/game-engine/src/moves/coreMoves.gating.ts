/**
 * Stage gating for core moves.
 *
 * Defines which turn stages each core move is allowed to execute in.
 * MOVE_ALLOWED_STAGES is the sole source of truth for stage gating.
 * No additional per-move logic may override or supplement this map.
 *
 * No boardgame.io imports. No .reduce(). Pure data and a single lookup helper.
 */

import type { TurnStage } from '../turn/turnPhases.types.js';
import type { CoreMoveName } from './coreMoves.types.js';

/**
 * Canonical stage assignments for each core move.
 *
 * This map is the sole source of truth for move stage gating.
 * isMoveAllowedInStage derives its answer entirely from this map.
 */
export const MOVE_ALLOWED_STAGES: Readonly<Record<CoreMoveName, readonly TurnStage[]>> = {
  // why: drawCards is allowed in 'start' and 'main' because the player draws
  // cards at the beginning of their turn (start phase) and may also draw
  // additional cards during their main action phase via card effects.
  drawCards: ['start', 'main'],

  // why: playCard is allowed only in 'main' because playing cards is the
  // primary action a player takes during their turn. Cards cannot be played
  // during the draw phase (start) or after actions are complete (cleanup).
  playCard: ['main'],

  // why: endTurn is allowed only in 'cleanup' because a player must complete
  // all actions and resolve all effects before ending their turn. Allowing
  // endTurn earlier would skip mandatory cleanup steps (discard, draw new hand).
  endTurn: ['cleanup'],
} as const;

/**
 * Checks whether a move is allowed in the given turn stage.
 *
 * Looks up the move in MOVE_ALLOWED_STAGES and returns true if the
 * stage is in the allowed list.
 *
 * @param move - The core move name to check.
 * @param stage - The current turn stage.
 * @returns true if the move is allowed in the given stage.
 */
export function isMoveAllowedInStage(move: CoreMoveName, stage: TurnStage): boolean {
  const allowedStages = MOVE_ALLOWED_STAGES[move];
  return allowedStages.includes(stage);
}
