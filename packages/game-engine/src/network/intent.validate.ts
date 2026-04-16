/**
 * Intent validation for the Legendary Arena multiplayer layer.
 *
 * Validates client turn intents against the current engine state before
 * move execution. Pure function — never mutates gameState or context,
 * never throws.
 *
 * // why: this adds intent-level validation on top of boardgame.io's
 * built-in turn order checks. boardgame.io validates player turn order
 * at the framework level; this function validates the intent structure,
 * move name, and desync status before the move reaches the framework.
 */

import type { LegendaryGameState } from '../types.js';
import type {
  ClientTurnIntent,
  IntentValidationContext,
  IntentValidationResult,
} from './intent.types.js';
import { detectDesync } from './desync.detect.js';

/**
 * Validates a client turn intent against the current engine state.
 *
 * Validation order (short-circuits on first failure):
 *   1. Wrong player  -> WRONG_PLAYER
 *   2. Wrong turn    -> WRONG_TURN
 *   3. Invalid move  -> INVALID_MOVE
 *   4. Malformed args -> MALFORMED_ARGS
 *   5. Desync detected -> DESYNC_DETECTED
 *   6. All checks pass -> { valid: true }
 *
 * @param intent - The client's submitted turn intent.
 * @param gameState - The current authoritative game state. Not mutated.
 * @param context - Ctx subset (currentPlayer, turn). Not mutated.
 * @param validMoveNames - Caller-injected list of valid move names.
 * @returns Structured validation result — never throws.
 */
export function validateIntent(
  intent: ClientTurnIntent,
  gameState: LegendaryGameState,
  context: IntentValidationContext,
  validMoveNames: readonly string[],
): IntentValidationResult {
  // why: only the current player may submit intents (D-0401)
  if (intent.playerId !== context.currentPlayer) {
    return {
      valid: false,
      reason: `Intent submitted by player '${intent.playerId}' but the current player is '${context.currentPlayer}'.`,
      code: 'WRONG_PLAYER',
    };
  }

  // why: turn number mismatch indicates a stale or replayed intent
  if (intent.turnNumber !== context.turn) {
    return {
      valid: false,
      reason: `Intent specifies turn ${intent.turnNumber} but the engine is on turn ${context.turn}.`,
      code: 'WRONG_TURN',
    };
  }

  // why: validates against the caller-injected move list, not
  // CORE_MOVE_NAMES (which contains only 3 of 10 registered moves)
  if (!validMoveNames.includes(intent.move.name)) {
    return {
      valid: false,
      reason: `Move '${intent.move.name}' is not a registered move name.`,
      code: 'INVALID_MOVE',
    };
  }

  // why: MVP structural check — per-move schema validation is deferred
  // to move execution (coreMoves.validate.ts handles per-move args)
  if (typeof intent.move.args === 'function') {
    return {
      valid: false,
      reason: 'The move args contain a non-serializable value (function).',
      code: 'MALFORMED_ARGS',
    };
  }

  // why: if client and engine state diverge, the engine is
  // authoritative and the client must resync (D-0402)
  const desyncResult = detectDesync(intent.clientStateHash, gameState);
  if (desyncResult.desynced) {
    return {
      valid: false,
      reason: 'Client state hash does not match engine state hash — engine state is authoritative (D-0402).',
      code: 'DESYNC_DETECTED',
    };
  }

  return { valid: true };
}
