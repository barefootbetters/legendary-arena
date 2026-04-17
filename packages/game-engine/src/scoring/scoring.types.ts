/**
 * Scoring types and VP constants for the Legendary Arena game engine.
 *
 * Defines the MVP VP table as named constants and the return types
 * for computeFinalScores. Scoring is a derived view — results are
 * never stored in G during MVP.
 */

// ---------------------------------------------------------------------------
// MVP VP Table (named constants — never inline numbers)
// ---------------------------------------------------------------------------

// why: MVP VP values locked as named constants. Card-text-specific VP
// modifiers (some cards grant extra VP) are future packets. Values
// chosen for MVP simplicity, not balance.

/** VP awarded per villain in a player's victory pile. */
export const VP_VILLAIN = 1;

/** VP awarded per henchman in a player's victory pile. */
export const VP_HENCHMAN = 1;

/** VP awarded per bystander in a player's victory pile. */
export const VP_BYSTANDER = 1;

/** VP awarded per defeated mastermind tactic (awarded to all players). */
export const VP_TACTIC = 5;

/** VP penalty per wound in a player's zones (negative value). */
export const VP_WOUND = -1;

// ---------------------------------------------------------------------------
// Score result types
// ---------------------------------------------------------------------------

/**
 * Per-player VP breakdown with individual category scores.
 */
export interface PlayerScoreBreakdown {
  /** Player ID ("0", "1", etc.). */
  playerId: string;
  /** VP from defeated villains in victory pile. */
  villainVP: number;
  /** VP from defeated henchmen in victory pile. */
  henchmanVP: number;
  /** VP from rescued/captured bystanders in victory pile. */
  bystanderVP: number;
  /** VP from defeated mastermind tactics (shared across all players). */
  tacticVP: number;
  /** VP penalty from wounds (negative). */
  woundVP: number;
  /** Sum of all VP categories. */
  totalVP: number;
}

/**
 * Final score summary for the entire match.
 *
 * Returned by computeFinalScores. Never stored in G during MVP.
 */
export interface FinalScoreSummary {
  /** Per-player VP breakdowns, in deterministic order (sorted by playerId). */
  players: PlayerScoreBreakdown[];
  /** Player with highest total VP, or null if tied. */
  winner: string | null;
}

// ---------------------------------------------------------------------------
// PAR scoring re-exports (WP-048)
// ---------------------------------------------------------------------------

// why: PAR scoring types live canonically in parScoring.types.ts. Re-exported
// here so consumers importing from './scoring.types.js' have access to the
// full scoring API (VP + PAR) without having to import from two paths. No
// structural changes to VP scoring types above this line — WP-020 contract
// is read-only per EC-048.
export type {
  ScenarioKey,
  TeamKey,
  ScoringWeights,
  ScoringCaps,
  PenaltyEventType,
  PenaltyEventWeights,
  ParBaseline,
  ScenarioScoringConfig,
  ScoringInputs,
  ScoreBreakdown,
  LeaderboardEntry,
  ScoringConfigValidationResult,
} from './parScoring.types.js';
export { PENALTY_EVENT_TYPES } from './parScoring.types.js';
