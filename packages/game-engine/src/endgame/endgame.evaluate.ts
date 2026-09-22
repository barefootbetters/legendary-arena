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
import { ENDGAME_CONDITIONS } from './endgame.types.js';

/**
 * Evaluates whether the game has ended based on G.counters.
 *
 * Fixed priority order: MATCH_ENDED_EARLY (a player-ended match, highest) →
 * MASTERMIND_DEFEATED (terminal heroes-win) → MASTERMIND_DEFEATED_PENDING (the
 * WP-732 victory-assured latch — returns null and suppresses the loss/tie
 * branches for the rest of the winning turn) → SCHEME_LOSS (scheme-wins) →
 * FINAL_TURN_TIE (tie). Loss is evaluated before victory in the general case
 * (a simultaneous trigger resolves as a loss), except during the assured-win
 * window, when the win takes priority per the rulebook (see the branches below).
 *
 * @param gameState - The current game state (only counters are read).
 * @returns An EndgameResult if the game has ended, or null if it continues.
 */
export function evaluateEndgame(gameState: LegendaryGameState): EndgameResult | null {
  const matchEndedEarlyCount = gameState.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY] ?? 0;
  const schemeLossCount = gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0;
  const mastermindDefeatedCount = gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] ?? 0;
  const mastermindDefeatedPendingCount =
    gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING] ?? 0;
  const finalTurnTieCount = gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE] ?? 0;

  // why: WP-502 / D-24306 — the player-initiated "End Game" latch is checked
  // FIRST (highest priority): when the players close out an in-progress match it
  // supersedes every natural win/loss/tie condition. The result carries the
  // endedEarly marker so the competitive submission path can refuse to score an
  // abandoned match, while the outcome stays 'tie' (no EndgameOutcome-union
  // change). This is a pure counter read like every branch below — no mutation,
  // no I/O.
  if (matchEndedEarlyCount >= 1) {
    return {
      outcome: 'tie',
      reason: 'The players ended the match early.',
      endedEarly: true,
    };
  }

  // why: WP-732 / D-24553 — the terminal Mastermind win is checked BEFORE
  // SCHEME_LOSS, inverting the usual loss-before-win order. This is safe (and
  // required) because the terminal MASTERMIND_DEFEATED counter is now set at
  // exactly one site: promoteMastermindVictoryIfPending at turn.onEnd, which only
  // fires when the win was already ASSURED (the last Tactic / Final Blow fell
  // during a prior move this turn). Per Universal Rules v23 §"Players Win", once
  // the Mastermind has no Tactics left "victory is assured, and players will win
  // the game even if the final Tactic's Fight ability would achieve the Scheme's
  // Evil Wins condition" — so a SCHEME_LOSS that also latched during the finished
  // winning turn must lose to the assured win, not override it.
  if (mastermindDefeatedCount >= 1) {
    return { outcome: 'heroes-win', reason: 'The mastermind has been defeated.' };
  }

  // why: WP-732 / D-24553 — the victory-assured window. While the Mastermind is
  // pending-defeated (last Tactic / Final Blow down, but the winning player has
  // not yet finished their turn) the game CONTINUES (return null) and every
  // loss/tie branch below is SUPPRESSED: a scheme-loss or a deck-out during the
  // rest of that turn does not take the assured win away. MATCH_ENDED_EARLY above
  // still supersedes it — a player-ended match closes out even an assured win.
  // The latch is promoted to the terminal MASTERMIND_DEFEATED at turn.onEnd.
  if (mastermindDefeatedPendingCount >= 1) {
    return null;
  }

  // why: Loss conditions checked before victory so a simultaneous trigger
  // resolves as a loss -- matches Legendary rulebook precedence (with the
  // WP-732 assured-win exception handled above). The deck-exhaustion tie is
  // checked LAST: it is only ever resolved (its counter set by turn.onEnd) when
  // no win or loss fired during the final turn, so it can never contend with a
  // win/loss here. See WP-367 / D-24159.
  // why: D-24317 — the generic `escapedVillains >= ESCAPE_LIMIT` loss was
  // retired. Villain-escape losses are now per-scheme: a scheme declaring an
  // 'escaped-pile-count' resourceLossCondition (e.g. Negative Zone, 12 villains)
  // latches SCHEME_LOSS from the escape path, so it is covered by the
  // schemeLoss branch below. The ESCAPED_VILLAINS counter is still incremented
  // (stats + the coopOutcome loss-cause heuristic) but no longer ends the game.
  if (schemeLossCount >= 1) {
    return { outcome: 'scheme-wins', reason: 'The scheme has been completed.' };
  } else if (finalTurnTieCount >= 1) {
    return {
      outcome: 'tie',
      reason:
        'A deck ran out and the final turn ended with no winner — the game is a tie between good and evil.',
    };
  }

  return null;
}
