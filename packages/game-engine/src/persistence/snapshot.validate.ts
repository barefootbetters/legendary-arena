/**
 * Snapshot shape validation for Legendary Arena.
 *
 * validateSnapshotShape confirms that an unknown input has the correct
 * MatchSnapshot shape and field types. It returns structured results
 * (never throws) using the engine-wide MoveError contract.
 *
 * No boardgame.io imports. No game logic. Pure helper only.
 */

import type { MoveError } from '../moves/coreMoves.types.js';

/** Expected top-level keys on a valid MatchSnapshot (outcome is optional). */
const REQUIRED_SNAPSHOT_KEYS: readonly string[] = [
  'matchId',
  'snapshotAt',
  'turn',
  'phase',
  'activePlayer',
  'players',
  'counters',
  'messages',
];

/** Expected zone count fields on each player entry. */
const REQUIRED_PLAYER_COUNT_FIELDS: readonly string[] = [
  'playerId',
  'deckCount',
  'handCount',
  'discardCount',
  'inPlayCount',
  'victoryCount',
];

/**
 * Validate that an unknown input has the correct MatchSnapshot shape.
 *
 * Checks that all required fields exist and have the correct types. Does
 * NOT check that matchId exists in any store — shape validation only.
 *
 * @param input - The unknown value to validate.
 * @returns `{ ok: true }` if valid, or `{ ok: false, errors: MoveError[] }`
 *          describing each validation failure.
 */
export function validateSnapshotShape(
  input: unknown,
): { ok: true } | { ok: false; errors: MoveError[] } {
  const errors: MoveError[] = [];

  if (input === null || typeof input !== 'object') {
    errors.push({
      code: 'INVALID_SNAPSHOT',
      message: 'Snapshot must be a non-null object.',
      path: 'snapshot',
    });
    return { ok: false, errors };
  }

  const snapshot = input as Record<string, unknown>;

  for (const key of REQUIRED_SNAPSHOT_KEYS) {
    if (!(key in snapshot)) {
      errors.push({
        code: 'MISSING_FIELD',
        message: `Snapshot is missing required field "${key}".`,
        path: key,
      });
    }
  }

  if ('matchId' in snapshot && typeof snapshot.matchId !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "matchId" must be a string.',
      path: 'matchId',
    });
  }

  if ('snapshotAt' in snapshot && typeof snapshot.snapshotAt !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "snapshotAt" must be a string.',
      path: 'snapshotAt',
    });
  }

  if ('turn' in snapshot && typeof snapshot.turn !== 'number') {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "turn" must be a number.',
      path: 'turn',
    });
  }

  if ('phase' in snapshot && typeof snapshot.phase !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "phase" must be a string.',
      path: 'phase',
    });
  }

  if ('activePlayer' in snapshot && typeof snapshot.activePlayer !== 'string') {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "activePlayer" must be a string.',
      path: 'activePlayer',
    });
  }

  if ('players' in snapshot) {
    if (!Array.isArray(snapshot.players)) {
      errors.push({
        code: 'INVALID_TYPE',
        message: 'Snapshot field "players" must be an array.',
        path: 'players',
      });
    } else {
      for (let i = 0; i < snapshot.players.length; i++) {
        const player = snapshot.players[i] as Record<string, unknown>;
        if (player === null || typeof player !== 'object') {
          errors.push({
            code: 'INVALID_TYPE',
            message: `Snapshot players[${i}] must be a non-null object.`,
            path: `players[${i}]`,
          });
          continue;
        }
        for (const field of REQUIRED_PLAYER_COUNT_FIELDS) {
          if (!(field in player)) {
            errors.push({
              code: 'MISSING_FIELD',
              message: `Snapshot players[${i}] is missing required field "${field}".`,
              path: `players[${i}].${field}`,
            });
          }
        }
      }
    }
  }

  if ('counters' in snapshot && (typeof snapshot.counters !== 'object' || snapshot.counters === null)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "counters" must be a non-null object.',
      path: 'counters',
    });
  }

  if ('messages' in snapshot && !Array.isArray(snapshot.messages)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'Snapshot field "messages" must be an array.',
      path: 'messages',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
