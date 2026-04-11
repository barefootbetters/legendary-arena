/**
 * Validators for lobby phase moves.
 *
 * All validators return MoveResult — they never throw.
 * No boardgame.io imports.
 */

import type { MoveResult } from '../moves/coreMoves.types.js';
import type { LobbyState } from './lobby.types.js';

/**
 * Validates the arguments for the setPlayerReady move.
 *
 * The args.ready field must be a boolean. If args is not an object or
 * args.ready is not a boolean, returns { ok: false } with a descriptive error.
 *
 * @param args - The raw arguments passed to setPlayerReady.
 * @returns MoveResult indicating whether the arguments are valid.
 */
export function validateSetPlayerReadyArgs(args: unknown): MoveResult {
  if (args === null || typeof args !== 'object') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_ARGS',
        message: 'setPlayerReady requires an object argument with a boolean "ready" field.',
        path: 'args',
      }],
    };
  }

  const argsRecord = args as Record<string, unknown>;

  if (typeof argsRecord.ready !== 'boolean') {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_READY_TYPE',
        message: 'The "ready" field must be a boolean (true or false).',
        path: 'ready',
      }],
    };
  }

  return { ok: true };
}

/**
 * Validates whether the match can start based on the current lobby state.
 *
 * All player IDs in lobby.ready must map to true, and the count of ready
 * players must equal lobby.requiredPlayers.
 *
 * @param lobby - The current LobbyState from G.lobby.
 * @returns MoveResult indicating whether the match can start.
 */
export function validateCanStartMatch(lobby: LobbyState): MoveResult {
  const readyPlayerIds = Object.keys(lobby.ready);
  const readyCount = readyPlayerIds.filter(
    (playerId) => lobby.ready[playerId] === true,
  ).length;

  if (readyCount < lobby.requiredPlayers) {
    return {
      ok: false,
      errors: [{
        code: 'NOT_ALL_READY',
        message: `Cannot start match: ${readyCount} of ${lobby.requiredPlayers} required players are ready.`,
        path: 'lobby.ready',
      }],
    };
  }

  return { ok: true };
}
