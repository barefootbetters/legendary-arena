/**
 * Pure validators for core move arguments and stage gating.
 *
 * All validators:
 * - Inspect inputs only
 * - Perform no mutation
 * - Perform no normalization
 * - Perform no defaulting or coercion
 * - Return structured MoveResult values only
 * - Never throw
 *
 * No boardgame.io imports. No .reduce(). No side effects.
 */

import { isValidTurnStage } from '../turn/turnPhases.logic.js';
import type { CoreMoveName } from './coreMoves.types.js';
import { CORE_MOVE_NAMES } from './coreMoves.types.js';
import type { MoveResult } from './coreMoves.types.js';
import { isMoveAllowedInStage } from './coreMoves.gating.js';

/**
 * Validates arguments for the drawCards move.
 *
 * count must be a finite integer >= 0.
 *
 * @param args - The raw arguments to validate.
 * @returns MoveResult indicating success or structured errors.
 */
export function validateDrawCardsArgs(args: unknown): MoveResult {
  if (args === null || args === undefined || typeof args !== 'object') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_ARGS',
        message: 'DrawCardsArgs must be a non-null object.',
        path: 'args',
      }],
    };
  }

  const record = args as Record<string, unknown>;

  if (typeof record.count !== 'number') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_COUNT_TYPE',
        message: 'DrawCardsArgs.count must be a number.',
        path: 'count',
      }],
    };
  }

  if (!Number.isFinite(record.count)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_COUNT_FINITE',
        message: 'DrawCardsArgs.count must be a finite number.',
        path: 'count',
      }],
    };
  }

  if (!Number.isInteger(record.count)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_COUNT_INTEGER',
        message: 'DrawCardsArgs.count must be an integer.',
        path: 'count',
      }],
    };
  }

  if (record.count < 0) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_COUNT_NEGATIVE',
        message: 'DrawCardsArgs.count must be greater than or equal to zero.',
        path: 'count',
      }],
    };
  }

  return { ok: true };
}

/**
 * Validates arguments for the playCard move.
 *
 * cardId must be a non-empty string.
 *
 * @param args - The raw arguments to validate.
 * @returns MoveResult indicating success or structured errors.
 */
export function validatePlayCardArgs(args: unknown): MoveResult {
  if (args === null || args === undefined || typeof args !== 'object') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_ARGS',
        message: 'PlayCardArgs must be a non-null object.',
        path: 'args',
      }],
    };
  }

  const record = args as Record<string, unknown>;

  if (typeof record.cardId !== 'string') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CARD_ID_TYPE',
        message: 'PlayCardArgs.cardId must be a string.',
        path: 'cardId',
      }],
    };
  }

  if (record.cardId.length === 0) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CARD_ID_EMPTY',
        message: 'PlayCardArgs.cardId must not be an empty string.',
        path: 'cardId',
      }],
    };
  }

  return { ok: true };
}

/**
 * Validates arguments for the endTurn move.
 *
 * EndTurn takes no payload. Extra keys on the passed object are ignored.
 * Always returns { ok: true }.
 *
 * @param _args - The raw arguments (ignored).
 * @returns MoveResult — always { ok: true }.
 */
export function validateEndTurnArgs(_args: unknown): MoveResult {
  return { ok: true };
}

/**
 * Validates that a move is allowed in the given stage.
 *
 * First confirms that move is a valid CoreMoveName and stage is a valid
 * TurnStage, then checks the MOVE_ALLOWED_STAGES map.
 *
 * @param move - The move name to validate (unknown — must be a CoreMoveName).
 * @param stage - The stage to validate (unknown — must be a TurnStage).
 * @returns MoveResult indicating whether the move is allowed.
 */
export function validateMoveAllowedInStage(move: unknown, stage: unknown): MoveResult {
  if (typeof move !== 'string' || !CORE_MOVE_NAMES.includes(move as CoreMoveName)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_MOVE_NAME',
        message: 'The move name is not a recognized CoreMoveName.',
        path: 'move',
      }],
    };
  }

  if (typeof stage !== 'string' || !isValidTurnStage(stage)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_STAGE',
        message: 'The stage is not a recognized TurnStage.',
        path: 'stage',
      }],
    };
  }

  const isAllowed = isMoveAllowedInStage(move as CoreMoveName, stage);

  if (!isAllowed) {
    return {
      ok: false,
      errors: [{
        code: 'MOVE_NOT_ALLOWED_IN_STAGE',
        message: `The move "${move}" is not allowed in stage "${stage}".`,
        path: 'stage',
      }],
    };
  }

  return { ok: true };
}
