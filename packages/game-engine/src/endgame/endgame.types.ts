/**
 * Endgame types and constants for Legendary Arena.
 *
 * Defines the canonical counter key names, escape limit, and result types
 * used by evaluateEndgame to determine victory or loss conditions.
 *
 * All exports are JSON-serializable plain data -- no functions in this file.
 */

/**
 * The outcome of a concluded match.
 *
 * Three outcomes exist: heroes win, the scheme wins, or the match ends in a
 * tie. The tie is the deck-exhaustion final-turn outcome (WP-367 / D-24159):
 * once the Hero Deck or Villain Deck reaches zero, the current turn is played
 * out as a last chance to win or lose; if neither side has won or lost by the
 * end of that turn, the game ends in a tie between good and evil.
 */
export type EndgameOutcome = 'heroes-win' | 'scheme-wins' | 'tie';

/**
 * The result returned by evaluateEndgame when the game has ended.
 *
 * Contains the outcome (who won) and a human-readable reason string
 * describing which condition triggered the endgame.
 */
export interface EndgameResult {
  /** Which side won the match. */
  outcome: EndgameOutcome;
  /** Human-readable description of the triggering condition. */
  reason: string;
  // why: WP-502 / D-24306 — additive optional marker set ONLY when the players
  // ended the match early (the MATCH_ENDED_EARLY condition below). Kept off the
  // EndgameOutcome union deliberately: an early end reuses the 'tie' outcome so
  // the union's large blast radius (competition/dashboard/coop/campaign/simulation
  // switches + the competitive_scores.outcome column) is untouched. Consumers that
  // must NOT score an abandoned match (the competitive submission path) key on
  // this flag; every genuine win/loss/tie leaves it absent.
  /** True when the match was ended early by the players; never scored. */
  endedEarly?: boolean;
}

/**
 * Canonical counter key names for endgame conditions.
 *
 * Every packet that increments an endgame counter must import and use
 * these constants -- never use the string values directly.
 */
export const ENDGAME_CONDITIONS = {
  ESCAPED_VILLAINS: 'escapedVillains',
  SCHEME_LOSS: 'schemeLoss',
  MASTERMIND_DEFEATED: 'mastermindDefeated',
  // why: WP-367 / D-24159 — the deck-exhaustion "final turn" latch. Set to 1 the
  // moment the Hero Deck or Villain Deck first reaches zero cards, and never
  // cleared thereafter (even if a card effect later refills the deck). This
  // counter is NOT a game-ending condition on its own — it only marks that the
  // current turn is the final turn. evaluateEndgame does NOT end the game on it.
  FINAL_TURN_TRIGGERED: 'finalTurnTriggered',
  // why: WP-367 / D-24159 — the resolved deck-exhaustion tie. Set to 1 by the
  // turn.onEnd hook when FINAL_TURN_TRIGGERED is latched AND no win/loss fired
  // during the final turn. evaluateEndgame reads this to return the 'tie'
  // outcome. Separate from the latch so the game only ends at end of turn, not
  // the instant a deck empties.
  FINAL_TURN_TIE: 'finalTurnTie',
  // why: WP-502 / D-24306 — the player-initiated "End Game" latch. Set to 1 by
  // the endMatchEarly move when the players choose to close out an in-progress
  // match (e.g. they ran out of time). evaluateEndgame reads it FIRST (highest
  // priority) and returns a 'tie' outcome flagged endedEarly, so the top-level
  // endIf sets ctx.gameover for all seats and buildUIState projects the endgame
  // panel to every connected client. Never set at setup — a runtime-only write,
  // so initial G is unchanged (no finalStateHash re-pin).
  MATCH_ENDED_EARLY: 'matchEndedEarly',
} as const;

// why: 8 is the standard Legendary escape limit for MVP; becomes part of
// MatchSetupConfig in a later packet when scheme-specific limits are
// implemented.
/** The number of escaped villains that triggers a scheme-wins loss. */
export const ESCAPE_LIMIT: number = 8;
