/**
 * PAR scenario scoring logic for the Legendary Arena game engine (WP-048).
 *
 * Six pure functions that implement the canonical PAR scoring pipeline:
 *   deriveScoringInputs -> builds ScoringInputs from replay output + final G
 *   computeRawScore     -> applies the locked formula to inputs + config
 *   computeParScore     -> applies the locked formula to the PAR baseline
 *   computeFinalScore   -> rawScore - parScore (lower is better)
 *   buildScoreBreakdown -> orchestrates the above into a ScoreBreakdown
 *   validateScoringConfig -> structured validation result (never throws)
 *
 * No boardgame.io import. No registry or server import. No filesystem,
 * network, or environment access. No randomness. Integer (centesimal)
 * arithmetic only — no floating-point coercion helpers are used.
 *
 * End-of-match only (D-4804). Derivation reads G state directly, not a
 * structured event log (D-4801). Team-aggregate MVP (D-4803). Does not
 * modify LegendaryGameState (D-4802).
 */

import type { LegendaryGameState } from '../types.js';
import type { ReplayResult } from '../replay/replay.types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { computeFinalScores } from './scoring.logic.js';
import type {
  PenaltyEventType,
  ScenarioScoringConfig,
  ScoreBreakdown,
  ScoringConfigValidationResult,
  ScoringInputs,
} from './parScoring.types.js';
import { PENALTY_EVENT_TYPES } from './parScoring.types.js';

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Derives ScoringInputs from a completed replay and its terminal game state.
 *
 * End-of-match only (D-4804) — callers must pass a finalState whose
 * ctx.phase is 'end'. Reads G state directly; there is no structured event
 * log dependency (D-4801). Penalty event counts that have no engine
 * producer today safe-skip to 0 with `// why:` comments identifying the
 * deferred follow-up.
 *
 * @param replayResult - The ReplayResult produced by WP-027's replayGame.
 * @param gameState - The final LegendaryGameState from replayResult.finalState.
 * @returns ScoringInputs populated from rounds, VP, BP, and escapes.
 */
export function deriveScoringInputs(
  replayResult: ReplayResult,
  gameState: LegendaryGameState,
): ScoringInputs {
  // why: MVP uses replayResult.moveCount as a round proxy. Per-turn
  // counting requires a new G.counters['turns'] (or similar) and is
  // deferred to a follow-up WP. D-4801.
  const rounds = replayResult.moveCount;

  // why: reuses WP-020's computeFinalScores so VP counting stays in
  // exactly one place. Summing across players is the D-4803 team-
  // aggregate rule — MVP PAR is a shared-team score.
  const finalScoreSummary = computeFinalScores(gameState);
  let victoryPoints = 0;
  for (const playerBreakdown of finalScoreSummary.players) {
    victoryPoints = victoryPoints + playerBreakdown.totalVP;
  }

  // why: the victory pile is the canonical rescue marker (EC-068, WP-067).
  // Bystanders in hand, deck, discard, or inPlay are not "rescued". This
  // mirrors the aggregation primitive used by buildUIState when WP-067
  // introduces countBystandersRescued.
  let bystandersRescued = 0;
  for (const zones of Object.values(gameState.playerZones)) {
    for (const cardExtId of zones.victory) {
      if (gameState.villainDeckCardTypes[cardExtId] === 'bystander') {
        bystandersRescued = bystandersRescued + 1;
      }
    }
  }

  // why: the ESCAPED_VILLAINS counter is lazily initialised — it does not
  // exist in G.counters until the first escape. Absence is semantically
  // zero. Same `?? 0` pattern used by EC-068 buildProgressCounters.
  const escapes = gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;

  // why: no engine producer today; follow-up WP will introduce bystander-
  // lost tracking (either via ENDGAME_CONDITIONS.BYSTANDERS_LOST counter
  // or via a structured event log). D-4801 safe-skip.
  const bystanderLostCount = 0;

  // why: no engine producer today; scheme-twist polarity is not
  // classified in G today. Follow-up WP will add a discriminated
  // scheme-twist outcome projection. D-4801 safe-skip.
  const schemeTwistNegativeCount = 0;

  // why: no engine producer today. Untaken mastermind tactics are
  // derivable at endgame from G.mastermind.tacticsRemaining.length but the
  // penalty is semantically "missed opportunity during play" which needs
  // per-turn history. Full derivation deferred to a follow-up WP. D-4801
  // safe-skip.
  const mastermindTacticUntakenCount = 0;

  // why: no engine producer today; scenario-unique failure events are
  // declared per scenario and have no generic producer. Deferred to the
  // scenario-definition authoring WP that introduces structured scenario
  // events. D-4801 safe-skip.
  const scenarioSpecificPenaltyCount = 0;

  const penaltyEventCounts: Record<PenaltyEventType, number> = {
    villainEscaped: escapes,
    bystanderLost: bystanderLostCount,
    schemeTwistNegative: schemeTwistNegativeCount,
    mastermindTacticUntaken: mastermindTacticUntakenCount,
    scenarioSpecificPenalty: scenarioSpecificPenaltyCount,
  };

  return {
    rounds,
    victoryPoints,
    bystandersRescued,
    escapes,
    penaltyEventCounts,
  };
}

// ---------------------------------------------------------------------------
// Raw Score
// ---------------------------------------------------------------------------

/**
 * Computes the Raw Score from scoring inputs and a scenario config.
 *
 * Formula:
 *   RawScore = (R × roundCost) + P - (BP × bystanderReward) - (VP × vpReward)
 *   P        = sum(eventCount[type] × penaltyWeight[type])
 *
 * Lower is better. Caps are applied before the subtractive terms when set.
 *
 * @param inputs - ScoringInputs derived from a completed match.
 * @param config - ScenarioScoringConfig providing weights, caps, penalty weights.
 * @returns Raw Score as an integer (centesimal units).
 */
// why: monotonicity invariant — higher R and penalty events always
// increase RawScore (worse outcome); higher BP and VP always decrease it
// (better outcome). Per-event penalty weights (no shared escape
// multiplier) are what encode the moral hierarchy: bystanderLost is the
// heaviest penalty, and bystanderReward always exceeds villainEscaped.
export function computeRawScore(
  inputs: ScoringInputs,
  config: ScenarioScoringConfig,
): number {
  const effectiveBystanders = applyCap(
    inputs.bystandersRescued,
    config.caps.bystanderCap,
  );
  const effectiveVictoryPoints = applyCap(
    inputs.victoryPoints,
    config.caps.victoryPointCap,
  );

  const weightedRoundCost = inputs.rounds * config.weights.roundCost;

  let weightedPenaltyTotal = 0;
  for (const penaltyType of PENALTY_EVENT_TYPES) {
    const count = inputs.penaltyEventCounts[penaltyType];
    const weight = config.penaltyEventWeights[penaltyType];
    weightedPenaltyTotal = weightedPenaltyTotal + count * weight;
  }

  const weightedBystanderReward =
    effectiveBystanders * config.weights.bystanderReward;
  const weightedVictoryPointReward =
    effectiveVictoryPoints * config.weights.victoryPointReward;

  return (
    weightedRoundCost +
    weightedPenaltyTotal -
    weightedBystanderReward -
    weightedVictoryPointReward
  );
}

// ---------------------------------------------------------------------------
// PAR Score
// ---------------------------------------------------------------------------

/**
 * Computes the PAR Score for a scenario by applying the same formula used
 * for Raw Score to the scenario's PAR baseline values. Uses the same
 * arithmetic path as computeRawScore so PAR is always consistent with Raw.
 *
 * @param config - ScenarioScoringConfig carrying weights and PAR baseline.
 * @returns PAR Score as an integer (centesimal units).
 */
export function computeParScore(config: ScenarioScoringConfig): number {
  const parInputs: ScoringInputs = {
    rounds: config.parBaseline.roundsPar,
    victoryPoints: config.parBaseline.victoryPointsPar,
    bystandersRescued: config.parBaseline.bystandersPar,
    escapes: config.parBaseline.escapesPar,
    penaltyEventCounts: {
      villainEscaped: config.parBaseline.escapesPar,
      bystanderLost: 0,
      schemeTwistNegative: 0,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    },
  };

  return computeRawScore(parInputs, config);
}

// ---------------------------------------------------------------------------
// Final Score
// ---------------------------------------------------------------------------

/**
 * Computes the Final Score as Raw minus PAR. Trivial but explicit for
 * contract clarity — every call site names the subtraction.
 *
 * @param rawScore - Value produced by computeRawScore.
 * @param parScore - Value produced by computeParScore.
 * @returns Final Score (lower is better; negative is under PAR).
 */
export function computeFinalScore(rawScore: number, parScore: number): number {
  return rawScore - parScore;
}

// ---------------------------------------------------------------------------
// Score Breakdown
// ---------------------------------------------------------------------------

/**
 * Builds a full ScoreBreakdown from inputs and a scenario config.
 *
 * The returned breakdown is fully decoupled from the caller: inputs and
 * penaltyEventCounts are spread-copied so mutating the caller's
 * ScoringInputs after the call cannot change the returned
 * ScoreBreakdown.inputs (D-2801 aliasing precedent). The result is
 * JSON-serializable (D-4806).
 *
 * @param inputs - ScoringInputs for the completed match.
 * @param config - ScenarioScoringConfig providing weights, caps, PAR.
 * @returns A complete, immutable ScoreBreakdown.
 */
// why: result must not alias caller-provided ScoringInputs. If we
// returned { inputs } directly, a caller mutating their own
// penaltyEventCounts later would mutate the returned breakdown as well.
// Spread-copying inputs and penaltyEventCounts here prevents that
// aliasing (D-2801 precedent from WP-028).
export function buildScoreBreakdown(
  inputs: ScoringInputs,
  config: ScenarioScoringConfig,
): ScoreBreakdown {
  const effectiveBystanders = applyCap(
    inputs.bystandersRescued,
    config.caps.bystanderCap,
  );
  const effectiveVictoryPoints = applyCap(
    inputs.victoryPoints,
    config.caps.victoryPointCap,
  );

  const weightedRoundCost = inputs.rounds * config.weights.roundCost;

  const penaltyBreakdown: Record<PenaltyEventType, number> = {
    villainEscaped: 0,
    bystanderLost: 0,
    schemeTwistNegative: 0,
    mastermindTacticUntaken: 0,
    scenarioSpecificPenalty: 0,
  };
  let weightedPenaltyTotal = 0;
  for (const penaltyType of PENALTY_EVENT_TYPES) {
    const count = inputs.penaltyEventCounts[penaltyType];
    const weight = config.penaltyEventWeights[penaltyType];
    const contribution = count * weight;
    penaltyBreakdown[penaltyType] = contribution;
    weightedPenaltyTotal = weightedPenaltyTotal + contribution;
  }

  const weightedBystanderReward =
    effectiveBystanders * config.weights.bystanderReward;
  const weightedVictoryPointReward =
    effectiveVictoryPoints * config.weights.victoryPointReward;

  const rawScore =
    weightedRoundCost +
    weightedPenaltyTotal -
    weightedBystanderReward -
    weightedVictoryPointReward;
  const parScore = computeParScore(config);
  const finalScore = rawScore - parScore;

  const copiedPenaltyEventCounts: Record<PenaltyEventType, number> = {
    villainEscaped: inputs.penaltyEventCounts.villainEscaped,
    bystanderLost: inputs.penaltyEventCounts.bystanderLost,
    schemeTwistNegative: inputs.penaltyEventCounts.schemeTwistNegative,
    mastermindTacticUntaken: inputs.penaltyEventCounts.mastermindTacticUntaken,
    scenarioSpecificPenalty: inputs.penaltyEventCounts.scenarioSpecificPenalty,
  };

  const copiedInputs: ScoringInputs = {
    rounds: inputs.rounds,
    victoryPoints: inputs.victoryPoints,
    bystandersRescued: inputs.bystandersRescued,
    escapes: inputs.escapes,
    penaltyEventCounts: copiedPenaltyEventCounts,
  };

  return {
    inputs: copiedInputs,
    weightedRoundCost,
    weightedPenaltyTotal,
    penaltyBreakdown,
    weightedBystanderReward,
    weightedVictoryPointReward,
    rawScore,
    parScore,
    finalScore,
    scoringConfigVersion: config.scoringConfigVersion,
  };
}

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

/**
 * Validates a ScenarioScoringConfig against every invariant enforced by
 * PAR scoring. Never throws — returns a structured result. `errors` is a
 * list of full sentences naming each invariant violated (code-style
 * Rule 11).
 *
 * Checks:
 *   - roundCost, bystanderReward, victoryPointReward all > 0
 *   - Every PenaltyEventType key exists in penaltyEventWeights (D-4805)
 *   - Every penalty weight > 0
 *   - Structural invariants:
 *       1. bystanderReward > villainEscapedWeight
 *       2. bystanderLostWeight > villainEscapedWeight
 *       3. bystanderLostWeight > bystanderReward
 *   - bystanderCap and victoryPointCap non-negative when set
 *   - roundsPar, bystandersPar, victoryPointsPar, escapesPar all >= 0
 *   - scoringConfigVersion > 0
 *
 * @param config - ScenarioScoringConfig to validate.
 * @returns ScoringConfigValidationResult with valid flag and error sentences.
 */
// why: error messages are full sentences naming the invariant violated
// and (where possible) the field that failed. Code-style Rule 11 requires
// this; callers render errors directly without translating codes.
export function validateScoringConfig(
  config: ScenarioScoringConfig,
): ScoringConfigValidationResult {
  const errors: string[] = [];

  if (!(config.weights.roundCost > 0)) {
    errors.push(
      `ScoringWeights.roundCost must be a positive integer; got ${config.weights.roundCost}.`,
    );
  }
  if (!(config.weights.bystanderReward > 0)) {
    errors.push(
      `ScoringWeights.bystanderReward must be a positive integer; got ${config.weights.bystanderReward}.`,
    );
  }
  if (!(config.weights.victoryPointReward > 0)) {
    errors.push(
      `ScoringWeights.victoryPointReward must be a positive integer; got ${config.weights.victoryPointReward}.`,
    );
  }

  for (const penaltyType of PENALTY_EVENT_TYPES) {
    const weight = config.penaltyEventWeights[penaltyType];
    if (weight === undefined) {
      errors.push(
        `ScenarioScoringConfig.penaltyEventWeights is missing a required entry for '${penaltyType}'; every PenaltyEventType must be present (D-4805 self-contained config).`,
      );
      continue;
    }
    if (!(weight > 0)) {
      errors.push(
        `ScenarioScoringConfig.penaltyEventWeights['${penaltyType}'] must be a positive integer; got ${weight}.`,
      );
    }
  }

  const villainEscapedWeight = config.penaltyEventWeights.villainEscaped;
  const bystanderLostWeight = config.penaltyEventWeights.bystanderLost;
  if (
    villainEscapedWeight !== undefined &&
    bystanderLostWeight !== undefined
  ) {
    if (!(config.weights.bystanderReward > villainEscapedWeight)) {
      errors.push(
        `Structural invariant violated: ScoringWeights.bystanderReward (${config.weights.bystanderReward}) must exceed penaltyEventWeights.villainEscaped (${villainEscapedWeight}) so rescuing a bystander is always worth more than losing tactical control over a villain.`,
      );
    }
    if (!(bystanderLostWeight > villainEscapedWeight)) {
      errors.push(
        `Structural invariant violated: penaltyEventWeights.bystanderLost (${bystanderLostWeight}) must exceed penaltyEventWeights.villainEscaped (${villainEscapedWeight}) so losing a civilian is always worse than letting a villain escape.`,
      );
    }
    if (!(bystanderLostWeight > config.weights.bystanderReward)) {
      errors.push(
        `Structural invariant violated: penaltyEventWeights.bystanderLost (${bystanderLostWeight}) must exceed ScoringWeights.bystanderReward (${config.weights.bystanderReward}) so the moral cost of a lost civilian always outweighs the credit for rescuing one.`,
      );
    }
  }

  if (config.caps.bystanderCap !== null && config.caps.bystanderCap < 0) {
    errors.push(
      `ScoringCaps.bystanderCap must be a non-negative integer or null; got ${config.caps.bystanderCap}.`,
    );
  }
  if (config.caps.victoryPointCap !== null && config.caps.victoryPointCap < 0) {
    errors.push(
      `ScoringCaps.victoryPointCap must be a non-negative integer or null; got ${config.caps.victoryPointCap}.`,
    );
  }

  if (config.parBaseline.roundsPar < 0) {
    errors.push(
      `ParBaseline.roundsPar must be a non-negative integer; got ${config.parBaseline.roundsPar}.`,
    );
  }
  if (config.parBaseline.bystandersPar < 0) {
    errors.push(
      `ParBaseline.bystandersPar must be a non-negative integer; got ${config.parBaseline.bystandersPar}.`,
    );
  }
  if (config.parBaseline.victoryPointsPar < 0) {
    errors.push(
      `ParBaseline.victoryPointsPar must be a non-negative integer; got ${config.parBaseline.victoryPointsPar}.`,
    );
  }
  if (config.parBaseline.escapesPar < 0) {
    errors.push(
      `ParBaseline.escapesPar must be a non-negative integer; got ${config.parBaseline.escapesPar}.`,
    );
  }

  if (!(config.scoringConfigVersion > 0)) {
    errors.push(
      `ScenarioScoringConfig.scoringConfigVersion must be a positive integer; got ${config.scoringConfigVersion}.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Applies an optional cap to a non-negative integer input.
 *
 * A `null` cap leaves the input unchanged. A numeric cap clamps the input
 * from above. Callers enforce non-negativity on both the input and the cap
 * elsewhere — applyCap itself is a simple min.
 */
function applyCap(value: number, cap: number | null): number {
  if (cap === null) {
    return value;
  }
  return value < cap ? value : cap;
}
