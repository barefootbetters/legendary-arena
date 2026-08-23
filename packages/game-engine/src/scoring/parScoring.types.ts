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
 * Integer (centesimal) weights for the core Raw Score reward components.
 *
 * Display layers divide by 100 to render decimal point values. The engine
 * never sees fractional weights.
 */
// why: integer weights avoid floating-point determinism issues; display
// divides by 100 to render decimal point values.
// why: WP-585 / D-24394 — there is no roundCost. The Marvel Legendary rulebook's
// scoring has no round/turn penalty; Scheme Twists are its length proxy, so game
// length is already penalized via the schemeTwistNegative penalty weight. A
// separate per-round cost double-counted length and was removed.
export interface ScoringWeights {
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
  // why: WP-585 / D-24394 — there is no roundsPar. The rulebook's scoring has no
  // round/turn penalty (Scheme Twists are its length proxy), so RawScore carries
  // no round-cost term and PAR needs no expected-rounds baseline.
  /** Expected bystander rescues for a par-performing team. */
  readonly bystandersPar: number;
  /** Expected victory points for a par-performing team. */
  readonly victoryPointsPar: number;
  /** Expected escape count for a par-performing team. */
  readonly escapesPar: number;
  /**
   * Expected scheme twists for a par-performing team (WP-591 / D-24400).
   *
   * why: `computeParScore` now subtracts the scheme-twist penalty too, so PAR
   * models the same penalties as the raw score. Without this, PAR omitted the
   * −300/twist penalty the raw score carries (schemes throw 4-8 twists), so a
   * physical baseline mapped to a PAR ~2000 too negative. Twist count is a
   * scheme property (each scheme has a fixed villain-deck twist count).
   */
  readonly schemeTwistsPar: number;
  /**
   * Expected bystanders lost (carried away by escaping Villains) for a
   * par-performing team (WP-591 / D-24400). Small for most schemes; included so
   * PAR and the raw score share the full penalty footing (physical baselines).
   */
  readonly bystandersLostPar: number;
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
  /** Core reward weights (bystanderReward, victoryPointReward). */
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
/**
 * One player's contribution to the team-aggregate reward inputs (WP-588).
 *
 * The competitive score is a shared-team score (D-4803: VP and bystanders are
 * summed across players), but the endgame report card breaks the raw-score
 * reward terms down per player so each seat can see what they contributed. A
 * derived, display-only split of the same totals — it never changes the score.
 */
export interface PlayerScoringContribution {
  /** The player's boardgame.io id (e.g. "0", "1"). */
  readonly playerId: string;
  /** This player's victory points (their `PlayerScoreBreakdown.totalVP`). */
  readonly victoryPoints: number;
  /** Bystanders rescued into this player's own victory pile. */
  readonly bystandersRescued: number;
}

export interface ScoringInputs {
  /** Completed play-turn count (`replayResult.turnCount`; D-24123, resolves D-4801). */
  readonly rounds: number;
  /** Team-aggregate victory points (D-4803: sum across players). */
  readonly victoryPoints: number;
  /** Bystanders rescued into any player's victory pile. */
  readonly bystandersRescued: number;
  /** Villains that escaped the City (feeds villainEscaped penalty count). */
  readonly escapes: number;
  /** Count of each penalty event type observed in the match. */
  readonly penaltyEventCounts: Readonly<Record<PenaltyEventType, number>>;
  /**
   * Per-player split of `victoryPoints` and `bystandersRescued`, sorted by
   * playerId (WP-588). Optional: the synthetic inputs `computeParScore` builds
   * for the PAR baseline have no players, and records persisted before WP-588
   * carry none — the endgame then shows only the team totals.
   */
  readonly perPlayer?: readonly PlayerScoringContribution[];
  /**
   * Whether the match was LOST (the mastermind was not defeated — the scheme won)
   * (WP-591 / D-24400). Optional; absent/false means a win. When true, `computeRawScore`
   * adds a flat loss penalty so a bystander-heavy loss can never out-grade a competent
   * win. The synthetic inputs `computeParScore` builds are always a par WIN (no penalty).
   */
  readonly matchLost?: boolean;
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
  /** Sum of `penaltyEventCounts[type] * penaltyEventWeights[type]` across all types. */
  readonly weightedPenaltyTotal: number;
  /** Per-type contribution to weightedPenaltyTotal. */
  readonly penaltyBreakdown: Readonly<Record<PenaltyEventType, number>>;
  /** `effectiveBystanders * bystanderReward` (effective = min(BP, cap)). */
  readonly weightedBystanderReward: number;
  /** `effectiveVictoryPoints * victoryPointReward` (effective = min(VP, cap)). */
  readonly weightedVictoryPointReward: number;
  /**
   * The flat loss penalty added to `rawScore` when the match was lost (WP-591 /
   * D-24400); 0 for a win. Exposed so the endgame worked calculation can show the
   * "+ loss penalty" term.
   */
  readonly weightedLossPenalty: number;
  /** `weightedPenaltyTotal - weightedBystanderReward - weightedVictoryPointReward + weightedLossPenalty`. */
  readonly rawScore: number;
  /** PAR value under the same formula applied to the scenario baseline. */
  readonly parScore: number;
  /**
   * The scenario baseline `parScore` was computed from (spread-copied per D-2801).
   *
   * why (WP-587 / D-24396): the endgame screen shows PAR's DERIVATION — the same
   * formula applied to these baseline counts — so the player can see where the PAR
   * number came from, not just the final value. A derived, display-only projection
   * of the config's `parBaseline`; it never re-enters scoring.
   */
  readonly parBaseline: ParBaseline;
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
