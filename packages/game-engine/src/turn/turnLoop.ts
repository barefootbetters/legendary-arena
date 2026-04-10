/**
 * Turn loop advancement helper for the play phase.
 *
 * Advances G.currentStage through the canonical turn stage cycle
 * (start -> main -> cleanup -> turn ends). All ordering derives from
 * getNextTurnStage in turnPhases.logic.ts — no hardcoded stage strings.
 *
 * No boardgame.io imports. No .reduce(). No side effects beyond G mutation
 * and ctx.events.endTurn().
 */

import type { TurnStage } from './turnPhases.types.js';
import { getNextTurnStage } from './turnPhases.logic.js';

/**
 * Minimal context interface for turn loop operations.
 *
 * Captures what advanceTurnStage needs from the boardgame.io move context.
 * Defined locally to avoid importing boardgame.io in this pure helper.
 */
export interface TurnLoopContext {
  events: {
    endTurn: () => void;
  };
}

/**
 * Minimal game state interface for turn loop operations.
 *
 * Captures the slice of LegendaryGameState that advanceTurnStage reads
 * and writes. Using a narrow interface keeps this file decoupled from
 * the full LegendaryGameState type.
 */
export interface TurnLoopState {
  currentStage: TurnStage;
}

/**
 * Advances the turn stage to the next stage in the canonical sequence.
 *
 * If the current stage has a successor (start -> main, main -> cleanup),
 * sets G.currentStage to the next stage. If the current stage is the last
 * one (cleanup), calls ctx.events.endTurn() to end the turn and let
 * boardgame.io advance to the next player.
 *
 * // why: currentStage is stored in G (not ctx) because boardgame.io's ctx
 * // does not expose the inner turn stage in a form that move functions can
 * // read. Storing it in G makes it observable to moves (for stage gating)
 * // and JSON-serializable (for replay and snapshots).
 *
 * @param gameState - The current game state (must have currentStage).
 * @param context - The boardgame.io move context (must have events.endTurn).
 */
export function advanceTurnStage(gameState: TurnLoopState, context: TurnLoopContext): void {
  const nextStage = getNextTurnStage(gameState.currentStage);

  if (nextStage !== null) {
    gameState.currentStage = nextStage;
    return;
  }

  // why: boardgame.io manages player rotation internally. Calling
  // ctx.events.endTurn() is the correct pattern for stage-based turn flow.
  // Manual player index rotation is forbidden — boardgame.io advances to
  // the next player and fires onTurnEnd triggers automatically.
  context.events.endTurn();
}
