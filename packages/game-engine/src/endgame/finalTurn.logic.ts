/**
 * Deck-exhaustion "final turn" logic for Legendary Arena (WP-367 / D-24159).
 *
 * Once the Hero Deck or Villain Deck reaches zero cards, the current turn is
 * played out as a final chance to win or lose; if neither side has won or lost
 * by the end of that turn, the game ends in a tie between good and evil.
 *
 * This module owns the two side effects the play-phase turn hooks delegate to:
 *
 *  - latchFinalTurnIfDeckExhausted: called after every play move. Latches the
 *    final turn the FIRST time a shared deck reaches zero. The latch is sticky —
 *    a later card effect that refills the deck does NOT clear it.
 *  - resolveFinalTurnTieIfUnresolved: called at turn end. If the final turn is
 *    latched and no win/loss condition has fired, sets the tie counter so
 *    evaluateEndgame returns the 'tie' outcome.
 *
 * No boardgame.io imports. Deterministic. Side effects are limited to
 * G.counters and G.messages, so these helpers are independently unit-testable.
 */

import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from './endgame.types.js';
import { evaluateEndgame } from './endgame.evaluate.js';
import { pushLog } from '../log/logPush.js';

/**
 * Latches the deck-exhaustion final turn if either shared deck is now empty.
 *
 * Idempotent: once FINAL_TURN_TRIGGERED is set, subsequent calls return
 * immediately, so only the first zero-crossing writes the counter and logs.
 * The latch never ends the game on its own — evaluateEndgame ignores it. It only
 * marks that the current turn is the last one before a tie.
 *
 * @param gameState - The game state to inspect and (on first exhaustion) mutate.
 */
export function latchFinalTurnIfDeckExhausted(gameState: LegendaryGameState): void {
  const isAlreadyLatched =
    (gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] ?? 0) > 0;
  if (isAlreadyLatched) {
    return;
  }

  const isVillainDeckEmpty = gameState.villainDeck.deck.length === 0;
  const isHeroDeckEmpty = gameState.heroDeck.length === 0;
  if (!isVillainDeckEmpty && !isHeroDeckEmpty) {
    return;
  }

  gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] = 1;
  const emptiedDeckName = isVillainDeckEmpty ? 'villain' : 'hero';
  pushLog(
    gameState,
    `The ${emptiedDeckName} deck is empty — this is the final turn. Win or lose this turn, or the game ends in a tie.`,
  );
}

/**
 * Resolves the deck-exhaustion tie at the end of the final turn.
 *
 * If the final turn is latched AND no win/loss condition has fired
 * (evaluateEndgame still returns null), sets FINAL_TURN_TIE so evaluateEndgame
 * returns the 'tie' outcome. The evaluateEndgame === null guard is what
 * implements "you can finish the current turn as a final chance to win": a
 * mastermind defeated / scheme completed / 8th villain escaped during the final
 * turn wins or loses outright instead of tying.
 *
 * @param gameState - The game state to inspect and (on an unresolved tie) mutate.
 */
export function resolveFinalTurnTieIfUnresolved(gameState: LegendaryGameState): void {
  const isFinalTurnLatched =
    (gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] ?? 0) > 0;
  const isTieAlreadyResolved =
    (gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE] ?? 0) > 0;
  if (!isFinalTurnLatched || isTieAlreadyResolved) {
    return;
  }

  if (evaluateEndgame(gameState) !== null) {
    return;
  }

  gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE] = 1;
  pushLog(
    gameState,
    'The final turn ended with no winner — the game is a tie between good and evil.',
  );
}
