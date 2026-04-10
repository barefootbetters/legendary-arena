/**
 * Pure transition helpers for the turn stage cycle.
 *
 * These functions define how turn stages advance within the play phase.
 * All ordering derives from the TURN_STAGES canonical array — no hardcoded
 * string literals outside of turnPhases.types.ts.
 *
 * No boardgame.io imports. No .reduce(). No side effects.
 */

import type { MatchPhase, TurnStage } from './turnPhases.types.js';
import { MATCH_PHASES, TURN_STAGES } from './turnPhases.types.js';

/**
 * Returns the next turn stage in the canonical sequence, or null if the
 * current stage is the last one (cleanup).
 *
 * Returning null signals that the turn should end — the caller is
 * responsible for invoking ctx.events.endTurn(). This function never
 * cycles back to 'start' because turn restart is a distinct event
 * managed by the play phase onBegin hook.
 *
 * @param current - The current turn stage.
 * @returns The next TurnStage, or null if the turn should end.
 */
export function getNextTurnStage(current: TurnStage): TurnStage | null {
  const currentIndex = TURN_STAGES.indexOf(current);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= TURN_STAGES.length) {
    return null;
  }

  return TURN_STAGES[nextIndex] as TurnStage;
}

/**
 * Checks whether a transition from one turn stage to another is valid.
 *
 * Only forward-adjacent transitions are valid:
 *   start -> main
 *   main -> cleanup
 *
 * All other transitions (backward, skip, self) are invalid.
 *
 * @param from - The stage being transitioned from.
 * @param to - The stage being transitioned to.
 * @returns true if the transition is valid.
 */
export function isValidTurnStageTransition(from: TurnStage, to: TurnStage): boolean {
  const nextStage = getNextTurnStage(from);
  return nextStage === to;
}

/**
 * Type guard that checks whether a string is a valid MatchPhase.
 *
 * @param phase - The string to check.
 * @returns true if the string is a member of MATCH_PHASES.
 */
export function isValidMatchPhase(phase: string): phase is MatchPhase {
  return MATCH_PHASES.includes(phase as MatchPhase);
}

/**
 * Type guard that checks whether a string is a valid TurnStage.
 *
 * @param stage - The string to check.
 * @returns true if the string is a member of TURN_STAGES.
 */
export function isValidTurnStage(stage: string): stage is TurnStage {
  return TURN_STAGES.includes(stage as TurnStage);
}
