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
 * Exactly two outcomes exist in the MVP: heroes win or the scheme wins.
 */
export type EndgameOutcome = 'heroes-win' | 'scheme-wins';

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
} as const;

// why: 8 is the standard Legendary escape limit for MVP; becomes part of
// MatchSetupConfig in a later packet when scheme-specific limits are
// implemented.
/** The number of escaped villains that triggers a scheme-wins loss. */
export const ESCAPE_LIMIT: number = 8;
