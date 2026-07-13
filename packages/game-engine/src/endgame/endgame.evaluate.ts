/**
 * Pure endgame evaluation function for Legendary Arena.
 *
 * Reads G.counters to determine whether the game has ended and, if so,
 * which side won. Returns null if the game should continue.
 *
 * This function is the sole authority on endgame evaluation. boardgame.io's
 * endIf delegates entirely to this function.
 */

import type { LegendaryGameState } from '../types.js';
import type { EndgameResult } from './endgame.types.js';
import { ENDGAME_CONDITIONS, ESCAPE_LIMIT } from './endgame.types.js';

/**
 * Evaluates whether the game has ended based on G.counters.
 *
 * Checks three MVP conditions in a fixed priority order. Loss conditions
 * are always evaluated before victory so that a simultaneous trigger
 * resolves as a loss.
 *
 * @param gameState - The current game state (only counters are read).
 * @returns An EndgameResult if the game has ended, or null if it continues.
 */
export function evaluateEndgame(gameState: LegendaryGameState): EndgameResult | null {
  const escapedVillainCount = gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
  const schemeLossCount = gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0;
  const mastermindDefeatedCount = gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] ?? 0;
  const finalTurnTieCount = gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE] ?? 0;

  // why: Loss conditions checked before victory so a simultaneous trigger
  // resolves as a loss -- matches Legendary rulebook precedence. The
  // deck-exhaustion tie is checked LAST: it is only ever resolved (its counter
  // set by turn.onEnd) when no win or loss fired during the final turn, so it
  // can never contend with a win/loss here. See WP-367 / D-24159.
  if (escapedVillainCount >= ESCAPE_LIMIT) {
    return { outcome: 'scheme-wins', reason: 'Too many villains escaped.' };
  } else if (schemeLossCount >= 1) {
    return { outcome: 'scheme-wins', reason: 'The scheme has been completed.' };
  } else if (mastermindDefeatedCount >= 1) {
    return { outcome: 'heroes-win', reason: 'The mastermind has been defeated.' };
  } else if (finalTurnTieCount >= 1) {
    return {
      outcome: 'tie',
      reason:
        'A deck ran out and the final turn ended with no winner — the game is a tie between good and evil.',
    };
  }

  return null;
}
