/**
 * PAR scenario scoring types for the Legendary Arena game engine (WP-048).
 *
 * Defines the full PAR type family: scenario and team identity keys, scoring
 * weights, caps, penalty event taxonomy, baseline, full config, derived
 * scoring inputs, the score breakdown, the leaderboard entry contract, and
 * the structured config validation result.
 *
 * Pure data types only. No functions. No boardgame.io imports. No registry
 * or server imports. Every member of the exported types must survive
 * JSON.parse(JSON.stringify(...)) with structural equality (D-4806).
 */

// ---------------------------------------------------------------------------
// Identity keys
// ---------------------------------------------------------------------------

/**
 * Canonical scenario identity string.
 *
 * Format: `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`
 * Computed by buildScenarioKey — never constructed by hand.
 */
export type ScenarioKey = string;

/**
 * Canonical team identity string.
 *
 * Format: `{sorted-heroSlugs-joined-by-+}`
 * Computed by buildTeamKey — never constructed by hand.
 */
export type TeamKey = string;

// ---------------------------------------------------------------------------
// Scoring weights and caps
// ---------------------------------------------------------------------------

/**
 * Integer (centesimal) weights for the three core Raw Score components.
 *
 * Display layers divide by 100 to render decimal point values. The engine
 * never sees fractional weights.
 */
// why: integer weights avoid floating-point determinism issues; display
// divides by 100 to render decimal point values.
export interface ScoringWeights {
  /** Weight per round played (higher R = worse). */
  readonly roundCost: number;
  /** Weight per bystander rescued (higher BP = better). */
  readonly bystanderReward: number;
  /** Weight per victory point earned (higher VP = better). */
  readonly victoryPointReward: number;
}

/**
 * Anti-exploit caps applied before the Raw Score formula consumes inputs.
 *
 * A `null` cap means "no cap". Caps that are set must be non-negative
 * integers. WP-029 D-2901 precedent pattern — `null` sentinel, not
 * `undefined`, because exactOptionalPropertyTypes is enabled.
 */
export interface ScoringCaps {
  /** Maximum bystandersRescued counted toward Raw Score, or null for no cap. */
  readonly bystanderCap: number | null;
  /** Maximum victoryPoints counted toward Raw Score, or null for no cap. */
  readonly victoryPointCap: number | null;
}

// ---------------------------------------------------------------------------
// Penalty event taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical penalty event type union.
 *
 * Each type has its own integer weight in PenaltyEventWeights. There is no
 * shared escape multiplier — every event contributes directly to Raw Score
 * via its per-type weight.
 */
export type PenaltyEventType =
  | 'villainEscaped'
  | 'bystanderLost'
  | 'schemeTwistNegative'
  | 'mastermindTacticUntaken'
  | 'scenarioSpecificPenalty';

/**
 * Canonical readonly array of all PenaltyEventType members.
 *
 * Kept in one-to-one correspondence with the PenaltyEventType union via a
 * drift-detection test. Any change to the union must update this array and
 * vice versa.
 */
export const PENALTY_EVENT_TYPES: readonly PenaltyEventType[] = [
  'villainEscaped',
  'bystanderLost',
  'schemeTwistNegative',
  'mastermindTacticUntaken',
  'scenarioSpecificPenalty',
] as const;

/**
 * Integer (centesimal) weight per penalty event type.
 *
 * Contributes to Raw Score via `P = sum(eventCount[type] × penaltyWeight[type])`.
 */
// why: per-event weights encode the moral hierarchy — bystander loss is
// always more severe than a villain escape, and bystander loss is always
// more severe than the rescue bonus. See docs/12-SCORING-REFERENCE.md for
// the rationale.
export type PenaltyEventWeights = Readonly<Record<PenaltyEventType, number>>;

// ---------------------------------------------------------------------------
// PAR baseline and scenario config
// ---------------------------------------------------------------------------

/**
 * Scenario-specific PAR baseline values. PAR = what a "par" team would
 * produce on this scenario. RawScore - PAR yields the normalized FinalScore.
 *
 * All fields are non-negative integers. Derivation of baselines from
 * difficulty ratings is a future WP — this packet consumes PAR as input.
 */
export interface ParBaseline {
  /** Expected rounds for a par-performing team. */
  readonly roundsPar: number;
  /** Expected bystander rescues for a par-performing team. */
  readonly bystandersPar: number;
  /** Expected victory points for a par-performing team. */
  readonly victoryPointsPar: number;
  /** Expected escape count for a par-performing team. */
  readonly escapesPar: number;
}

/**
 * Self-contained scenario scoring configuration (D-4805).
 *
 * Every scenario carries a full set of weights, caps, penalty weights, PAR
 * baseline, and version — there is no runtime merge with defaults. The
 * reference defaults in docs/12-SCORING-REFERENCE.md are authoring guidance,
 * not runtime merge targets. validateScoringConfig rejects any configuration
 * missing any required field (including any PenaltyEventType key in
 * penaltyEventWeights).
 */
export interface ScenarioScoringConfig {
  /** Canonical scenario identity. */
  readonly scenarioKey: ScenarioKey;
  /** Core component weights (roundCost, bystanderReward, victoryPointReward). */
  readonly weights: ScoringWeights;
  /** Anti-exploit caps on BP and VP (null for no cap). */
  readonly caps: ScoringCaps;
  /** Per-event penalty weights. Must cover every PenaltyEventType. */
  readonly penaltyEventWeights: PenaltyEventWeights;
  /** PAR baseline values for this scenario. */
  readonly parBaseline: ParBaseline;
  // why: scoringConfigVersion is an integer that increments on any weight,
  // cap, or PAR change — leaderboard entries pin to this specific config
  // so historical results remain comparable only to peers under the same
  // weights.
  /** Integer version pin. Increments on any weight/cap/PAR change. */
  readonly scoringConfigVersion: number;
  /** ISO-8601 creation timestamp string (class-2 metadata, not used in scoring). */
  readonly createdAt: string;
  /** ISO-8601 last-update timestamp string (class-2 metadata, not used in scoring). */
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Derived scoring inputs and breakdown
// ---------------------------------------------------------------------------

/**
 * Scoring inputs derived from a completed match.
 *
 * Produced by deriveScoringInputs from a ReplayResult and the final
 * LegendaryGameState (D-4801). All fields are non-negative integers.
 * End-of-match only (D-4804) — callers must not invoke the derivation
 * mid-match.
 */
export interface ScoringInputs {
  /** Rounds played (MVP: replayResult.moveCount). */
  readonly rounds: number;
  /** Team-aggregate victory points (D-4803: sum across players). */
  readonly victoryPoints: number;
  /** Bystanders rescued into any player's victory pile. */
  readonly bystandersRescued: number;
  /** Villains that escaped the City (feeds villainEscaped penalty count). */
  readonly escapes: number;
  /** Count of each penalty event type observed in the match. */
  readonly penaltyEventCounts: Readonly<Record<PenaltyEventType, number>>;
}

/**
 * Full score breakdown for a completed match.
 *
 * Transparent, JSON-serializable (D-4806), and immutable once returned by
 * buildScoreBreakdown. Consumers may read every intermediate component so
 * leaderboard UIs and post-match summaries never have to recompute.
 */
export interface ScoreBreakdown {
  /** Inputs used to compute this breakdown (spread-copied from caller per D-2801). */
  readonly inputs: ScoringInputs;
  /** `rounds * roundCost`. */
  readonly weightedRoundCost: number;
  /** Sum of `penaltyEventCounts[type] * penaltyEventWeights[type]` across all types. */
  readonly weightedPenaltyTotal: number;
  /** Per-type contribution to weightedPenaltyTotal. */
  readonly penaltyBreakdown: Readonly<Record<PenaltyEventType, number>>;
  /** `effectiveBystanders * bystanderReward` (effective = min(BP, cap)). */
  readonly weightedBystanderReward: number;
  /** `effectiveVictoryPoints * victoryPointReward` (effective = min(VP, cap)). */
  readonly weightedVictoryPointReward: number;
  /** `weightedRoundCost + weightedPenaltyTotal - weightedBystanderReward - weightedVictoryPointReward`. */
  readonly rawScore: number;
  /** PAR value under the same formula applied to the scenario baseline. */
  readonly parScore: number;
  /** `rawScore - parScore`. Lower is better; negative is under PAR. */
  readonly finalScore: number;
  /** Config version that produced this breakdown. */
  readonly scoringConfigVersion: number;
}

// ---------------------------------------------------------------------------
// Leaderboard entry (engine-defined contract; server stores instances)
// ---------------------------------------------------------------------------

/**
 * Replay-verified leaderboard entry contract.
 *
 * The engine defines the shape; instantiation and persistence happen in the
 * server layer. Must survive JSON.parse(JSON.stringify(...)) with structural
 * equality — no functions, Maps, Sets, Dates, or class instances (D-4806).
 */
export interface LeaderboardEntry {
  /** Canonical scenario identity. */
  readonly scenarioKey: ScenarioKey;
  /** Canonical team identity. */
  readonly teamKey: TeamKey;
  /** Opaque player identifiers (emails, user ids, handles — server decides). */
  readonly playerIdentifiers: readonly string[];
  /** Full score breakdown produced by buildScoreBreakdown. */
  readonly scoreBreakdown: ScoreBreakdown;
  /** Replay hash (WP-027 `computeStateHash` output) that proves this result is reproducible. */
  readonly replayHash: string;
  /** ISO-8601 submission timestamp string. */
  readonly createdAt: string;
  /** Config version pin. Matches scoreBreakdown.scoringConfigVersion. */
  readonly scoringConfigVersion: number;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/**
 * Structured result returned by validateScoringConfig.
 *
 * When valid is true, errors is an empty array. When valid is false, errors
 * contains one full-sentence description per invariant violated.
 */
// why: full-sentence error messages match code-style Rule 11 and make
// config-authoring failures self-describing. Callers render errors
// directly without having to translate codes into prose.
export interface ScoringConfigValidationResult {
  /** True when the config satisfies every invariant. */
  readonly valid: boolean;
  /** One full-sentence description per invariant violated. Empty when valid. */
  readonly errors: readonly string[];
}
