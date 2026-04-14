/**
 * Tests for the campaign / scenario framework (WP-030).
 *
 * Eight contract-enforcement tests covering the three pure helpers:
 * applyScenarioOverrides, evaluateScenarioOutcome, and
 * advanceCampaignState.
 *
 * These tests construct synthetic MatchSetupConfig, EndgameResult,
 * FinalScoreSummary, and CampaignState fixtures inline. No registry
 * data, no mock G, no buildInitialGameState call, and no boardgame.io
 * import. Tests verify pure functional behavior only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenarioOverrides,
  evaluateScenarioOutcome,
  advanceCampaignState,
} from './campaign.logic.js';
import type {
  CampaignDefinition,
  CampaignState,
  ScenarioDefinition,
  ScenarioOutcomeCondition,
  ScenarioReward,
} from './campaign.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { EndgameResult } from '../endgame/endgame.types.js';
import type { FinalScoreSummary } from '../scoring/scoring.types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG: MatchSetupConfig = {
  schemeId: 'scheme-base',
  mastermindId: 'mastermind-base',
  villainGroupIds: ['villain-base-a', 'villain-base-b'],
  henchmanGroupIds: ['henchman-base'],
  heroDeckIds: ['hero-deck-base-1', 'hero-deck-base-2'],
  bystandersCount: 10,
  woundsCount: 15,
  officersCount: 20,
  sidekicksCount: 5,
};

const BASE_STATE: CampaignState = {
  campaignId: 'campaign-test',
  completedScenarios: [],
  currentScenarioId: 'scenario-1',
  rewards: [],
};

const BASE_ENDGAME_HEROES: EndgameResult = {
  outcome: 'heroes-win',
  reason: 'Mastermind defeated',
};

const BASE_SCORES: FinalScoreSummary = {
  players: [
    {
      playerId: '0',
      villainVP: 3,
      henchmanVP: 2,
      bystanderVP: 1,
      tacticVP: 5,
      woundVP: 0,
      totalVP: 11,
    },
  ],
  winner: '0',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyScenarioOverrides', () => {
  it('produces a valid MatchSetupConfig with overrides applied (replace semantics)', () => {
    const scenario: ScenarioDefinition = {
      id: 'scenario-1',
      name: 'Override Scenario',
      setupOverrides: {
        schemeId: 'scheme-override',
        villainGroupIds: ['villain-override-only'],
      },
    };

    const result = applyScenarioOverrides(BASE_CONFIG, scenario);

    // All 9 required MatchSetupConfig fields must be present.
    assert.ok('schemeId' in result);
    assert.ok('mastermindId' in result);
    assert.ok('villainGroupIds' in result);
    assert.ok('henchmanGroupIds' in result);
    assert.ok('heroDeckIds' in result);
    assert.ok('bystandersCount' in result);
    assert.ok('woundsCount' in result);
    assert.ok('officersCount' in result);
    assert.ok('sidekicksCount' in result);

    // Override fields replaced (not appended).
    assert.equal(result.schemeId, 'scheme-override');
    assert.equal(result.villainGroupIds.length, 1);
    assert.equal(result.villainGroupIds[0], 'villain-override-only');

    // Non-overridden fields unchanged.
    assert.equal(result.mastermindId, 'mastermind-base');
    assert.equal(result.bystandersCount, 10);
    assert.equal(result.henchmanGroupIds.length, 1);
    assert.equal(result.henchmanGroupIds[0], 'henchman-base');
  });

  it('with no overrides returns a fresh copy of the base config', () => {
    const scenario: ScenarioDefinition = {
      id: 'scenario-no-overrides',
      name: 'No Overrides',
    };

    const result = applyScenarioOverrides(BASE_CONFIG, scenario);

    // Structural equality with base config.
    assert.deepStrictEqual(result, BASE_CONFIG);

    // Reference inequality — new object.
    assert.notStrictEqual(result, BASE_CONFIG);

    // Array fields are also fresh copies, proving no aliasing with
    // the base config's arrays.
    assert.notStrictEqual(result.villainGroupIds, BASE_CONFIG.villainGroupIds);
    assert.notStrictEqual(result.henchmanGroupIds, BASE_CONFIG.henchmanGroupIds);
    assert.notStrictEqual(result.heroDeckIds, BASE_CONFIG.heroDeckIds);
  });
});

describe('evaluateScenarioOutcome', () => {
  it('returns victory when a victory condition is met', () => {
    const victoryConditions: ScenarioOutcomeCondition[] = [{ type: 'heroesWin' }];

    const result = evaluateScenarioOutcome(
      BASE_ENDGAME_HEROES,
      BASE_SCORES,
      victoryConditions,
      undefined,
    );

    assert.equal(result, 'victory');
  });

  it('returns defeat when a failure condition is met (loss before victory)', () => {
    // Both victory and failure conditions reference the same trigger
    // to exercise the loss-before-victory evaluation order.
    const victoryConditions: ScenarioOutcomeCondition[] = [{ type: 'heroesWin' }];
    const failureConditions: ScenarioOutcomeCondition[] = [{ type: 'heroesWin' }];

    const result = evaluateScenarioOutcome(
      BASE_ENDGAME_HEROES,
      BASE_SCORES,
      victoryConditions,
      failureConditions,
    );

    assert.equal(result, 'defeat');
  });
});

describe('advanceCampaignState', () => {
  it('appends the completed scenario', () => {
    const result = advanceCampaignState(BASE_STATE, 'scenario-1', 'victory', []);

    assert.equal(result.completedScenarios.length, 1);
    assert.equal(result.completedScenarios[0], 'scenario-1');
    assert.equal(result.currentScenarioId, null);
    assert.equal(result.campaignId, 'campaign-test');
  });

  it('returns a new object without mutating the input state', () => {
    const rewards: ScenarioReward[] = [
      { type: 'unlockScenario', scenarioId: 'scenario-2' },
    ];

    const before = JSON.stringify(BASE_STATE);
    const result = advanceCampaignState(BASE_STATE, 'scenario-1', 'victory', rewards);
    const after = JSON.stringify(BASE_STATE);

    // Input state's JSON form is unchanged.
    assert.equal(before, after);

    // New object and new arrays — no aliasing with input state.
    assert.notStrictEqual(result, BASE_STATE);
    assert.notStrictEqual(result.completedScenarios, BASE_STATE.completedScenarios);
    assert.notStrictEqual(result.rewards, BASE_STATE.rewards);

    // Reward was appended to the new rewards array.
    assert.equal(result.rewards.length, 1);
    assert.deepStrictEqual(result.rewards[0], rewards[0]);
  });
});

describe('campaign type contracts', () => {
  it('all types are JSON-serializable (stringify roundtrip)', () => {
    const scenario: ScenarioDefinition = {
      id: 'scenario-json',
      name: 'JSON Roundtrip Scenario',
      description: 'Used to prove serializability.',
      setupOverrides: { schemeId: 'scheme-json' },
      victoryConditions: [{ type: 'heroesWin' }],
      failureConditions: [
        { type: 'counterReached', key: 'heroesTotalVP', threshold: 42 },
      ],
      rewards: [{ type: 'unlockScenario', scenarioId: 'scenario-next' }],
    };

    const campaign: CampaignDefinition = {
      id: 'campaign-json',
      name: 'JSON Roundtrip Campaign',
      scenarios: [scenario],
      unlockRules: [{ scenarioId: 'scenario-next', requires: ['scenario-json'] }],
    };

    const state: CampaignState = {
      campaignId: 'campaign-json',
      completedScenarios: ['scenario-json'],
      currentScenarioId: 'scenario-next',
      rewards: [{ type: 'unlockScenario', scenarioId: 'scenario-next' }],
    };

    const condition: ScenarioOutcomeCondition = {
      type: 'counterReached',
      key: 'heroesTotalVP',
      threshold: 10,
    };

    const reward: ScenarioReward = {
      type: 'unlockScenario',
      scenarioId: 'scenario-bonus',
    };

    // Use deepStrictEqual on JSON.parse(JSON.stringify(x)) for a true
    // round-trip check — stringify alone does not prove serializability.
    assert.deepStrictEqual(JSON.parse(JSON.stringify(scenario)), scenario);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(campaign)), campaign);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), state);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(condition)), condition);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(reward)), reward);
  });

  it('CampaignState does not contain G or engine internals', () => {
    const campaignState: CampaignState = {
      campaignId: 'campaign-keys',
      completedScenarios: ['scenario-a'],
      currentScenarioId: 'scenario-b',
      rewards: [{ type: 'unlockScenario', scenarioId: 'scenario-c' }],
    };

    // Exact key set — no accidental leakage of engine-internal fields
    // like piles, messages, counters, playerZones, etc.
    assert.deepStrictEqual(
      Object.keys(campaignState).sort(),
      ['campaignId', 'completedScenarios', 'currentScenarioId', 'rewards'],
    );
  });
});
