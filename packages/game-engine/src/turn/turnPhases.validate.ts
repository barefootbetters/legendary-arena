/**
 * Structured, non-throwing validator for turn stage transitions.
 *
 * Validates that both the 'from' and 'to' values are valid TurnStage strings,
 * then checks whether the transition between them is legal.
 *
 * Returns structured results — never throws.
 */

import type { TurnPhaseError, TurnStage } from './turnPhases.types.js';
import { isValidTurnStage, isValidTurnStageTransition } from './turnPhases.logic.js';

/**
 * Validates a proposed turn stage transition.
 *
 * Checks that both from and to are valid TurnStage values before checking
 * transition legality. May return multiple errors if both fields are invalid.
 *
 * @param from - The stage being transitioned from (unknown for safety).
 * @param to - The stage being transitioned to (unknown for safety).
 * @returns An ok result, or a list of structured errors.
 */
export function validateTurnStageTransition(
  from: unknown,
  to: unknown,
): { ok: true } | { ok: false; errors: TurnPhaseError[] } {
  const errors: TurnPhaseError[] = [];

  const isFromString = typeof from === 'string';
  const isToString = typeof to === 'string';

  if (!isFromString || !isValidTurnStage(from)) {
    errors.push({
      code: 'INVALID_FROM_STAGE',
      message: `The "from" stage "${String(from)}" is not a valid TurnStage. Expected one of: start, main, cleanup.`,
      path: 'from',
    });
  }

  if (!isToString || !isValidTurnStage(to)) {
    errors.push({
      code: 'INVALID_TO_STAGE',
      message: `The "to" stage "${String(to)}" is not a valid TurnStage. Expected one of: start, main, cleanup.`,
      path: 'to',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // why: At this point both from and to are confirmed valid TurnStage values
  // via the type guards above, so the casts are safe.
  if (!isValidTurnStageTransition(from as TurnStage, to as TurnStage)) {
    errors.push({
      code: 'INVALID_TRANSITION',
      message: `Transition from "${String(from)}" to "${String(to)}" is not valid. Only forward-adjacent transitions are allowed.`,
      path: 'from',
    });
    return { ok: false, errors };
  }

  return { ok: true };
}
