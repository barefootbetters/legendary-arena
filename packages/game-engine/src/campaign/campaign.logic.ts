/**
 * Campaign and scenario pure helper functions for Legendary Arena.
 *
 * Three pure functions orchestrate the meta-layer:
 *
 * 1. applyScenarioOverrides — produces a valid MatchSetupConfig for the
 *    engine from a base config and a scenario's setupOverrides.
 * 2. evaluateScenarioOutcome — computes the scenario outcome after the
 *    game ends, given the game's EndgameResult and final scores.
 * 3. advanceCampaignState — returns a new CampaignState with the
 *    completed scenario appended and any rewards applied.
 *
 * None of these functions mutate inputs, access G, read the registry,
 * or import boardgame.io. They operate entirely on the campaign contract
 * types and on engine type-only imports.
 *
 * // why: campaign/engine separation per D-0501. The engine receives a
 * normal MatchSetupConfig and runs a normal deterministic game. It never
 * knows it is part of a campaign. Scenario overrides are applied before
 * Game.setup() runs; campaign progression is computed after the game
 * ends. The engine is never aware of campaigns.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { EndgameResult } from '../endgame/endgame.types.js';
import type { FinalScoreSummary } from '../scoring/scoring.types.js';
import type {
  ScenarioDefinition,
  ScenarioOutcome,
  ScenarioOutcomeCondition,
  ScenarioReward,
  CampaignState,
} from './campaign.types.js';

/**
 * Merges scenario setup overrides into a base MatchSetupConfig.
 *
 * Semantics (locked):
 * 1. Replace-on-override. Any field present in scenario.setupOverrides
 *    replaces the corresponding base field wholesale. No deep merge.
 * 2. No aliasing. Every array field in the result is a spread copy of
 *    its source, so downstream mutation of the returned object cannot
 *    mutate the original baseConfig or scenario.setupOverrides.
 * 3. Undefined or empty overrides produce a fresh copy of baseConfig.
 *
 * // why: the engine receives a normal MatchSetupConfig — it never knows
 * about campaigns (D-0501). This function is called by the application
 * layer before Game.setup() runs; the engine sees only the produced
 * config.
 *
 * @param baseConfig - The base match setup. Not mutated.
 * @param scenario - The scenario whose setupOverrides are applied.
 * @returns A new MatchSetupConfig with overrides applied.
 */
export function applyScenarioOverrides(
  baseConfig: MatchSetupConfig,
  scenario: ScenarioDefinition,
): MatchSetupConfig {
  const overrides = scenario.setupOverrides;

  if (overrides === undefined) {
    // No overrides: return a fresh copy of the base config with
    // spread-copied array fields so callers cannot alias baseConfig.
    return {
      schemeId: baseConfig.schemeId,
      mastermindId: baseConfig.mastermindId,
      villainGroupIds: [...baseConfig.villainGroupIds],
      henchmanGroupIds: [...baseConfig.henchmanGroupIds],
      heroDeckIds: [...baseConfig.heroDeckIds],
      bystandersCount: baseConfig.bystandersCount,
      woundsCount: baseConfig.woundsCount,
      officersCount: baseConfig.officersCount,
      sidekicksCount: baseConfig.sidekicksCount,
    };
  }

  // Replace-on-override for scalar fields.
  const schemeId = overrides.schemeId ?? baseConfig.schemeId;
  const mastermindId = overrides.mastermindId ?? baseConfig.mastermindId;
  const bystandersCount =
    overrides.bystandersCount ?? baseConfig.bystandersCount;
  const woundsCount = overrides.woundsCount ?? baseConfig.woundsCount;
  const officersCount = overrides.officersCount ?? baseConfig.officersCount;
  const sidekicksCount =
    overrides.sidekicksCount ?? baseConfig.sidekicksCount;

  // Replace-on-override for array fields, with spread copies on both
  // branches so returned arrays alias neither baseConfig nor overrides.
  const villainGroupIds = overrides.villainGroupIds
    ? [...overrides.villainGroupIds]
    : [...baseConfig.villainGroupIds];
  const henchmanGroupIds = overrides.henchmanGroupIds
    ? [...overrides.henchmanGroupIds]
    : [...baseConfig.henchmanGroupIds];
  const heroDeckIds = overrides.heroDeckIds
    ? [...overrides.heroDeckIds]
    : [...baseConfig.heroDeckIds];

  return {
    schemeId,
    mastermindId,
    villainGroupIds,
    henchmanGroupIds,
    heroDeckIds,
    bystandersCount,
    woundsCount,
    officersCount,
    sidekicksCount,
  };
}

/**
 * Internal helper: evaluates whether a single condition is satisfied
 * against the completed game's results.
 *
 * Exhaustive switch on condition.type with a never branch for future
 * extensibility. A new ScenarioOutcomeCondition variant must add a case
 * here or the TypeScript compiler will flag the never assignment.
 *
 * MVP vocabulary:
 * - `heroesWin`: satisfied when result.outcome === 'heroes-win'.
 * - `counterReached`: at MVP, only `key === 'heroesTotalVP'` is
 *   interpreted. The condition is satisfied when the sum of
 *   scores.players[*].totalVP meets or exceeds threshold. Any other
 *   key safe-skips (returns false) — a future WP can extend the
 *   vocabulary without refactoring the call sites.
 */
function isConditionSatisfied(
  condition: ScenarioOutcomeCondition,
  result: EndgameResult,
  scores: FinalScoreSummary,
): boolean {
  switch (condition.type) {
    case 'heroesWin':
      return result.outcome === 'heroes-win';
    case 'counterReached': {
      if (condition.key !== 'heroesTotalVP') {
        // Safe-skip: unknown counter keys are not interpreted at MVP.
        // Future WPs extend this vocabulary without touching call sites.
        return false;
      }
      let heroesTotalVP = 0;
      for (const player of scores.players) {
        heroesTotalVP += player.totalVP;
      }
      return heroesTotalVP >= condition.threshold;
    }
    default: {
      // Exhaustiveness check — if a new variant is added to
      // ScenarioOutcomeCondition without adding a case here, this
      // never assignment will produce a TypeScript error.
      const exhaustiveCheck: never = condition;
      return exhaustiveCheck;
    }
  }
}

/**
 * Evaluates scenario outcome conditions against a completed game's
 * results. Pure function — reads inputs only, never touches G.
 *
 * Evaluation order (locked):
 *   1. If any failureCondition is satisfied -> 'defeat'
 *   2. Else if any victoryCondition is satisfied -> 'victory'
 *   3. Else -> 'incomplete'
 *
 * // why: evaluated after game ends, not during. The engine never calls
 * this — it is called by the application layer after endgame is reached.
 * The game's G has already been finalized.
 *
 * // why: loss-before-victory evaluation order resolves simultaneous
 * condition ambiguity deterministically. This matches the engine's own
 * endgame convention (D-1235 precedent) where loss conditions are
 * checked before victory conditions when both are satisfied on the same
 * state.
 *
 * Undefined victory or failure condition arrays are treated as empty
 * (no conditions of that kind) and do not produce errors.
 *
 * @param result - The completed game's endgame result.
 * @param scores - The completed game's final score summary.
 * @param victoryConditions - Conditions that, when any is satisfied,
 *                            produce 'victory'.
 * @param failureConditions - Conditions that, when any is satisfied,
 *                            produce 'defeat'.
 * @returns The scenario outcome: 'victory', 'defeat', or 'incomplete'.
 */
export function evaluateScenarioOutcome(
  result: EndgameResult,
  scores: FinalScoreSummary,
  victoryConditions: ScenarioOutcomeCondition[] | undefined,
  failureConditions: ScenarioOutcomeCondition[] | undefined,
): ScenarioOutcome {
  // Failure is evaluated first — loss-before-victory order.
  if (failureConditions !== undefined) {
    for (const condition of failureConditions) {
      if (isConditionSatisfied(condition, result, scores)) {
        return 'defeat';
      }
    }
  }

  if (victoryConditions !== undefined) {
    for (const condition of victoryConditions) {
      if (isConditionSatisfied(condition, result, scores)) {
        return 'victory';
      }
    }
  }

  return 'incomplete';
}

/**
 * Returns an updated CampaignState after a scenario completes.
 * Pure function — does not mutate the input state.
 *
 * Appends the completed scenario ID to completedScenarios, appends any
 * new rewards to rewards, and advances currentScenarioId to null (MVP
 * — no branching logic; future WPs may compute the next scenario from
 * unlock rules).
 *
 * // why: CampaignState is Class 2 (Configuration) data, external to
 * the engine (D-0502). Campaign progression is computed after the game
 * ends from the EndgameResult and FinalScoreSummary — the engine is
 * never involved.
 *
 * The `outcome` parameter is accepted for API completeness; at MVP it
 * is not used to alter the returned state. A future WP may use it to
 * branch (e.g., advancing to different scenarios depending on whether
 * the player won or lost) without changing the call sites.
 *
 * @param state - The current campaign state. Not mutated.
 * @param scenarioId - The ID of the scenario that just completed.
 * @param outcome - The outcome returned by evaluateScenarioOutcome.
 *                  Reserved for future branching logic.
 * @param rewards - Rewards granted by this scenario.
 * @returns A new CampaignState with the scenario appended.
 */
export function advanceCampaignState(
  state: CampaignState,
  scenarioId: string,
  outcome: ScenarioOutcome,
  rewards: ScenarioReward[],
): CampaignState {
  // why: outcome is reserved for future branching logic. At MVP it is
  // accepted to lock the API shape but does not alter the returned
  // state. Referenced in a no-op void expression so the parameter is
  // not flagged as unused without widening the signature later.
  void outcome;

  return {
    campaignId: state.campaignId,
    completedScenarios: [...state.completedScenarios, scenarioId],
    currentScenarioId: null,
    rewards: [...state.rewards, ...rewards],
  };
}
