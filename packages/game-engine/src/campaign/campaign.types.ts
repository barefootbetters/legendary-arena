/**
 * Campaign and scenario contract types for Legendary Arena.
 *
 * These types define data-only, JSON-serializable contracts for the
 * meta-orchestration layer that sequences individual games into
 * campaigns. The engine does not know about campaigns — it receives a
 * normal MatchSetupConfig and plays a normal deterministic game.
 *
 * All types here are pure data: no functions, no closures, no classes,
 * no Maps, Sets, Dates, or Symbols. Every value is JSON-serializable.
 *
 * // why: campaign/engine separation per D-0501 (Campaigns Are
 * Meta-Orchestration Only). Scenario overrides produce a valid
 * MatchSetupConfig before Game.setup() runs; campaign progression is
 * computed after the game ends from EndgameResult and FinalScoreSummary.
 * The engine is never aware of campaigns.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';

/**
 * Named union for scenario outcomes.
 *
 * Used by both evaluateScenarioOutcome (return type) and
 * advanceCampaignState (outcome parameter) so callers cannot pass
 * arbitrary strings like 'Victory' or 'win'. This prevents outcome-
 * string drift between the two functions and gives compile-time safety.
 */
export type ScenarioOutcome = 'victory' | 'defeat' | 'incomplete';

/**
 * Declarative outcome condition evaluated after a game ends.
 *
 * MVP vocabulary:
 * - `heroesWin`: satisfied when the game's EndgameResult.outcome is
 *   'heroes-win'.
 * - `counterReached`: satisfied when a named score key meets or exceeds
 *   a threshold. At MVP only `key === 'heroesTotalVP'` is interpreted;
 *   all other keys safe-skip (return false).
 */
export type ScenarioOutcomeCondition =
  | { type: 'heroesWin' }
  | { type: 'counterReached'; key: string; threshold: number };

/**
 * Declarative reward descriptor applied after scenario completion.
 *
 * MVP vocabulary:
 * - `unlockScenario`: marks a future scenario ID as available to the
 *   campaign player. Interpreted by the application layer — the engine
 *   never reads reward descriptors.
 */
export type ScenarioReward =
  | { type: 'unlockScenario'; scenarioId: string };

/**
 * A single scenario within a campaign.
 *
 * Data-only wrapper around one game with setup overrides and outcome
 * conditions. When a scenario is about to be played, the application
 * layer passes `setupOverrides` through `applyScenarioOverrides` to
 * produce a valid MatchSetupConfig. After the game ends, the application
 * layer calls `evaluateScenarioOutcome` with the game's EndgameResult
 * and the scenario's victoryConditions / failureConditions.
 */
export interface ScenarioDefinition {
  id: string;
  name: string;
  description?: string;
  setupOverrides?: Partial<MatchSetupConfig>;
  victoryConditions?: ScenarioOutcomeCondition[];
  failureConditions?: ScenarioOutcomeCondition[];
  rewards?: ScenarioReward[];
}

/**
 * Declarative unlock rule that gates a scenario behind completion of
 * other scenarios. Interpreted by the application layer.
 */
export interface CampaignUnlockRule {
  scenarioId: string;
  requires: string[];
}

/**
 * Ordered campaign definition with scenarios and unlock rules.
 *
 * A campaign is a data-only sequence of scenarios. Campaign replay is
 * simply the concatenation of each scenario's ReplayInput — there is no
 * campaign-level replay format.
 */
export interface CampaignDefinition {
  id: string;
  name: string;
  scenarios: ScenarioDefinition[];
  unlockRules?: CampaignUnlockRule[];
}

/**
 * Mutable campaign progression state. External to the engine.
 *
 * Tracks which scenarios the player has completed, which scenario is
 * currently active, and which rewards have been collected. Updated by
 * `advanceCampaignState` after each scenario finishes.
 *
 * // why: CampaignState is Class 2 (Configuration) data, external to
 * the engine (D-0502). This type must NEVER appear as a field of
 * LegendaryGameState. Individual game G remains Class 1 (Runtime) and
 * is never persisted; CampaignState is persisted by the application
 * layer and survives across individual game sessions.
 */
export interface CampaignState {
  campaignId: string;
  completedScenarios: string[];
  currentScenarioId: string | null;
  rewards: ScenarioReward[];
}
