/**
 * PAR scoring logic unit tests (WP-048).
 *
 * Sixteen tests in one describe() block. Covers the canonical formula,
 * monotonicity invariants, caps, heroic-beats-conservative moral hierarchy,
 * config validation (positive weights, structural invariants,
 * self-contained config per D-4805), drift detection between
 * PENALTY_EVENT_TYPES and the PenaltyEventType union, determinism +
 * aliasing protection (D-2801), and JSON-roundtrip (D-4806).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScoreBreakdown,
  computeFinalScore,
  computeParScore,
  computeRawScore,
  deriveScoringInputs,
  validateScoringConfig,
} from './parScoring.logic.js';
import {
  PENALTY_EVENT_TYPES,
  type LeaderboardEntry,
  type PenaltyEventType,
  type PenaltyEventWeights,
  type ScenarioScoringConfig,
  type ScoreBreakdown,
  type ScoringInputs,
} from './parScoring.types.js';
import type { LegendaryGameState } from '../types.js';
import type { ReplayResult } from '../replay/replay.types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Reference component weights from docs/12-SCORING-REFERENCE.md and EC-048.
 * Integer centesimal units.
 */
const REFERENCE_WEIGHTS = {
  bystanderReward: 300,
  victoryPointReward: 50,
} as const;

/**
 * Reference per-event penalty weights from EC-048.
 */
const REFERENCE_PENALTY_WEIGHTS: PenaltyEventWeights = {
  villainEscaped: 200,
  bystanderLost: 500,
  schemeTwistNegative: 400,
  mastermindTacticUntaken: 100,
  scenarioSpecificPenalty: 100,
};

/**
 * Canonical valid ScenarioScoringConfig used as the starting point for most
 * tests. Individual tests may shallow-copy and override fields.
 */
function makeReferenceConfig(): ScenarioScoringConfig {
  return {
    scenarioKey: 'midtown-bank-robbery::red-skull::hydra+masters-of-evil',
    weights: { ...REFERENCE_WEIGHTS },
    caps: { bystanderCap: null, victoryPointCap: null },
    penaltyEventWeights: { ...REFERENCE_PENALTY_WEIGHTS },
    parBaseline: {
      bystandersPar: 3,
      victoryPointsPar: 15,
      escapesPar: 2,
    },
    scoringConfigVersion: 1,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  };
}

/**
 * Builds a ScoringInputs object from a partial override. The default has
 * zero penalty events, zero rescues, zero escapes, and trivial R/VP.
 */
function makeInputs(overrides: Partial<{
  rounds: number;
  victoryPoints: number;
  bystandersRescued: number;
  escapes: number;
  penaltyEventCounts: Partial<Record<PenaltyEventType, number>>;
}> = {}): ScoringInputs {
  const basePenalties: Record<PenaltyEventType, number> = {
    villainEscaped: 0,
    bystanderLost: 0,
    schemeTwistNegative: 0,
    mastermindTacticUntaken: 0,
    scenarioSpecificPenalty: 0,
  };

  const mergedPenalties: Record<PenaltyEventType, number> = {
    ...basePenalties,
    ...(overrides.penaltyEventCounts ?? {}),
  };

  return {
    rounds: overrides.rounds ?? 10,
    victoryPoints: overrides.victoryPoints ?? 10,
    bystandersRescued: overrides.bystandersRescued ?? 0,
    escapes: overrides.escapes ?? 0,
    penaltyEventCounts: mergedPenalties,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parScoring logic (WP-048)', () => {
  // Test 1 — hand-calculated reference value
  it('computeRawScore with reference weights matches hand-calculated value', () => {
    const config = makeReferenceConfig();
    const inputs = makeInputs({
      rounds: 10,
      victoryPoints: 20,
      bystandersRescued: 5,
      escapes: 2,
      penaltyEventCounts: {
        villainEscaped: 2,
        bystanderLost: 1,
        schemeTwistNegative: 1,
        mastermindTacticUntaken: 1,
        scenarioSpecificPenalty: 0,
      },
    });

    // why: WP-585 / D-24394 — no round-cost term. Penalties − rewards:
    // (2×200 + 1×500 + 1×400 + 1×100 + 0×100) - (5 × 300) - (20 × 50)
    // = 1400 - 1500 - 1000
    // = -1100
    const rawScore = computeRawScore(inputs, config);
    assert.strictEqual(rawScore, -1100);
  });

  // why: WP-585 / D-24394 — the round-cost monotonicity test was DELETED and replaced
  // by this rounds-INVARIANCE assertion: rounds no longer affect RawScore (the rulebook
  // has no round penalty; Scheme Twists are the length proxy). The remaining monotonicity
  // tests (escape / bystander-lost / rescue) still hold and are the meaningful invariants.
  it('computeRawScore is INVARIANT to rounds (WP-585: no round-cost term)', () => {
    const config = makeReferenceConfig();
    const fewRounds = makeInputs({ rounds: 5 });
    const manyRounds = makeInputs({ rounds: 500 });
    assert.strictEqual(
      computeRawScore(fewRounds, config),
      computeRawScore(manyRounds, config),
    );
  });

  // Test 3 — monotonicity: extra villain escape increases score
  it('computeRawScore monotonicity: one extra villain escape increases Raw Score by villainEscaped weight', () => {
    const config = makeReferenceConfig();
    const baseline = makeInputs({
      penaltyEventCounts: { villainEscaped: 1 },
    });
    const extra = makeInputs({
      penaltyEventCounts: { villainEscaped: 2 },
    });

    const baselineScore = computeRawScore(baseline, config);
    const extraScore = computeRawScore(extra, config);

    assert.ok(extraScore > baselineScore);
    assert.strictEqual(
      extraScore - baselineScore,
      config.penaltyEventWeights.villainEscaped,
    );
  });

  // Test 4 — bystander lost penalty is heavier than villain escape
  it('computeRawScore monotonicity: bystander lost penalty is heavier than villain escape', () => {
    const config = makeReferenceConfig();
    const baseline = makeInputs();
    const plusOneEscape = makeInputs({
      penaltyEventCounts: { villainEscaped: 1 },
    });
    const plusOneBystanderLost = makeInputs({
      penaltyEventCounts: { bystanderLost: 1 },
    });

    const baselineScore = computeRawScore(baseline, config);
    const escapeScore = computeRawScore(plusOneEscape, config);
    const bystanderLostScore = computeRawScore(plusOneBystanderLost, config);

    const escapeDelta = escapeScore - baselineScore;
    const bystanderDelta = bystanderLostScore - baselineScore;

    assert.ok(bystanderDelta > escapeDelta);
    assert.strictEqual(
      bystanderDelta,
      config.penaltyEventWeights.bystanderLost,
    );
    assert.strictEqual(
      escapeDelta,
      config.penaltyEventWeights.villainEscaped,
    );
  });

  // Test 5 — monotonicity: extra bystander rescue decreases score (better)
  it('computeRawScore monotonicity: one extra bystander rescue decreases Raw Score by bystanderReward', () => {
    const config = makeReferenceConfig();
    const baseline = makeInputs({ bystandersRescued: 2 });
    const extra = makeInputs({ bystandersRescued: 3 });

    const baselineScore = computeRawScore(baseline, config);
    const extraScore = computeRawScore(extra, config);

    assert.ok(extraScore < baselineScore);
    assert.strictEqual(
      baselineScore - extraScore,
      config.weights.bystanderReward,
    );
  });

  // Test 6 — monotonicity: extra VP decreases score
  it('computeRawScore monotonicity: one extra victory point decreases Raw Score by victoryPointReward', () => {
    const config = makeReferenceConfig();
    const baseline = makeInputs({ victoryPoints: 10 });
    const extra = makeInputs({ victoryPoints: 11 });

    const baselineScore = computeRawScore(baseline, config);
    const extraScore = computeRawScore(extra, config);

    assert.ok(extraScore < baselineScore);
    assert.strictEqual(
      baselineScore - extraScore,
      config.weights.victoryPointReward,
    );
  });

  // Test 7 — bystander cap is respected
  it('computeRawScore respects bystander cap — rescues beyond the cap are ignored', () => {
    const cappedConfig: ScenarioScoringConfig = {
      ...makeReferenceConfig(),
      caps: { bystanderCap: 3, victoryPointCap: null },
    };

    const atCap = makeInputs({ bystandersRescued: 3 });
    const overCap = makeInputs({ bystandersRescued: 7 });

    const atCapScore = computeRawScore(atCap, cappedConfig);
    const overCapScore = computeRawScore(overCap, cappedConfig);

    // Both should reward exactly 3 rescues — the extra 4 above the cap
    // do not reduce the Raw Score further.
    assert.strictEqual(atCapScore, overCapScore);
  });

  // Test 8 — heroic play beats conservative play (moral hierarchy)
  it('computeRawScore: heroic play beats conservative play under reference weights', () => {
    const config = makeReferenceConfig();

    // Heroic: 10 rounds, 15 VP, 5 bystanders rescued, no losses, no escapes.
    const heroicInputs = makeInputs({
      rounds: 10,
      victoryPoints: 15,
      bystandersRescued: 5,
      escapes: 0,
    });

    // Conservative: 8 rounds (efficient), 8 VP, 0 rescues, 1 villain
    // escaped, 1 bystander lost. Plays "safe" but fails civilians.
    const conservativeInputs = makeInputs({
      rounds: 8,
      victoryPoints: 8,
      bystandersRescued: 0,
      escapes: 1,
      penaltyEventCounts: {
        villainEscaped: 1,
        bystanderLost: 1,
      },
    });

    const heroicScore = computeRawScore(heroicInputs, config);
    const conservativeScore = computeRawScore(conservativeInputs, config);

    // Lower is better — heroic must strictly beat conservative.
    assert.ok(
      heroicScore < conservativeScore,
      `Heroic (${heroicScore}) must beat Conservative (${conservativeScore}).`,
    );
  });

  // Test 9 — computeFinalScore is Raw minus PAR
  it('computeFinalScore produces a correct PAR-relative result', () => {
    const config = makeReferenceConfig();
    const inputs = makeInputs({
      rounds: 12,
      victoryPoints: 15,
      bystandersRescued: 3,
      escapes: 2,
      penaltyEventCounts: { villainEscaped: 2 },
    });

    const rawScore = computeRawScore(inputs, config);
    const parScore = computeParScore(config);
    const finalScore = computeFinalScore(rawScore, parScore);

    assert.strictEqual(finalScore, rawScore - parScore);
    // With inputs equal to PAR baseline (and villainEscaped = escapesPar),
    // Final should be zero. Confirm with a matched-PAR scenario:
    const matchedPar = makeInputs({
      // why: WP-585 — rounds no longer affects the score; computeParScore uses 0.
      rounds: 0,
      victoryPoints: config.parBaseline.victoryPointsPar,
      bystandersRescued: config.parBaseline.bystandersPar,
      escapes: config.parBaseline.escapesPar,
      penaltyEventCounts: { villainEscaped: config.parBaseline.escapesPar },
    });
    const matchedRaw = computeRawScore(matchedPar, config);
    const matchedFinal = computeFinalScore(matchedRaw, parScore);
    assert.strictEqual(matchedFinal, 0);
  });

  // Test 10 — reject zero or negative weights
  it('validateScoringConfig rejects configs with zero or negative component weights', () => {
    const baseConfig = makeReferenceConfig();

    const negativeBystanderReward: ScenarioScoringConfig = {
      ...baseConfig,
      weights: { ...baseConfig.weights, bystanderReward: -1 },
    };
    const zeroVictoryPointReward: ScenarioScoringConfig = {
      ...baseConfig,
      weights: { ...baseConfig.weights, victoryPointReward: 0 },
    };
    const zeroPenaltyWeight: ScenarioScoringConfig = {
      ...baseConfig,
      penaltyEventWeights: {
        ...baseConfig.penaltyEventWeights,
        villainEscaped: 0,
      },
    };

    for (const badConfig of [
      negativeBystanderReward,
      zeroVictoryPointReward,
      zeroPenaltyWeight,
    ]) {
      const result = validateScoringConfig(badConfig);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    }
  });

  // Test 11 — reject violation of structural invariant 1
  it('validateScoringConfig rejects configs violating invariant 1 (bystanderReward > villainEscaped)', () => {
    const config: ScenarioScoringConfig = {
      ...makeReferenceConfig(),
      // bystanderReward (150) no longer exceeds villainEscaped (200).
      weights: {
        bystanderReward: 150,
        victoryPointReward: 50,
      },
    };

    const result = validateScoringConfig(config);

    assert.strictEqual(result.valid, false);
    const mentionsInvariant1 = result.errors.some((message) =>
      message.includes('bystanderReward') && message.includes('villainEscaped'),
    );
    assert.ok(
      mentionsInvariant1,
      'Error list must name the bystanderReward > villainEscaped invariant.',
    );
  });

  // Test 12 — reject violation of structural invariant 3
  it('validateScoringConfig rejects configs violating invariant 3 (bystanderLost > bystanderReward)', () => {
    const config: ScenarioScoringConfig = {
      ...makeReferenceConfig(),
      // bystanderReward (600) now exceeds bystanderLost (500) — invariant 3
      // violated. Invariants 1 and 2 remain satisfied.
      weights: {
        bystanderReward: 600,
        victoryPointReward: 50,
      },
    };

    const result = validateScoringConfig(config);

    assert.strictEqual(result.valid, false);
    const mentionsInvariant3 = result.errors.some((message) =>
      message.includes('bystanderLost') && message.includes('bystanderReward'),
    );
    assert.ok(
      mentionsInvariant3,
      'Error list must name the bystanderLost > bystanderReward invariant.',
    );
  });

  // Test 13 — drift detection between array and union
  it('PENALTY_EVENT_TYPES array matches the PenaltyEventType union exactly', () => {
    const expectedTypes: PenaltyEventType[] = [
      'villainEscaped',
      'bystanderLost',
      'schemeTwistNegative',
      'mastermindTacticUntaken',
      'scenarioSpecificPenalty',
    ];

    assert.strictEqual(PENALTY_EVENT_TYPES.length, expectedTypes.length);
    const sortedArray = [...PENALTY_EVENT_TYPES].sort();
    const sortedExpected = [...expectedTypes].sort();
    assert.deepStrictEqual(sortedArray, sortedExpected);

    // Type-level assertion: every element of the array is assignable to
    // PenaltyEventType, and every expected member is present in the
    // array. Failure to compile here signals a drift.
    for (const penaltyType of PENALTY_EVENT_TYPES) {
      const narrowed: PenaltyEventType = penaltyType;
      assert.ok(expectedTypes.includes(narrowed));
    }
  });

  // Test 14 — determinism AND aliasing protection
  it('buildScoreBreakdown is deterministic and does not alias caller-provided inputs', () => {
    const config = makeReferenceConfig();

    // Construct mutable penaltyEventCounts so we can mutate them later.
    const mutablePenaltyCounts: Record<PenaltyEventType, number> = {
      villainEscaped: 2,
      bystanderLost: 0,
      schemeTwistNegative: 0,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    };
    const inputs: ScoringInputs = {
      rounds: 10,
      victoryPoints: 12,
      bystandersRescued: 4,
      escapes: 2,
      penaltyEventCounts: mutablePenaltyCounts,
    };

    // Determinism: two calls with identical inputs produce identical
    // breakdowns.
    const breakdownA = buildScoreBreakdown(inputs, config);
    const breakdownB = buildScoreBreakdown(inputs, config);
    assert.deepStrictEqual(breakdownA, breakdownB);

    // Aliasing protection (D-2801): mutating the caller's
    // penaltyEventCounts after the call must not mutate the returned
    // breakdown's inputs.penaltyEventCounts.
    mutablePenaltyCounts.villainEscaped = 999;
    assert.strictEqual(
      breakdownA.inputs.penaltyEventCounts.villainEscaped,
      2,
      'Returned ScoreBreakdown must not alias caller-provided ScoringInputs.',
    );
  });

  // Test 15 — self-contained config rejection (D-4805)
  it('validateScoringConfig rejects a config missing any PenaltyEventType entry in penaltyEventWeights', () => {
    const baseConfig = makeReferenceConfig();

    for (const penaltyType of PENALTY_EVENT_TYPES) {
      // Build a mutable copy and delete exactly one key.
      const partialWeights: Record<string, number> = {
        ...baseConfig.penaltyEventWeights,
      };
      delete partialWeights[penaltyType];

      const badConfig: ScenarioScoringConfig = {
        ...baseConfig,
        penaltyEventWeights: partialWeights as PenaltyEventWeights,
      };

      const result = validateScoringConfig(badConfig);

      assert.strictEqual(
        result.valid,
        false,
        `Config missing '${penaltyType}' must be rejected.`,
      );
      const mentionsMissingKey = result.errors.some((message) =>
        message.includes(`'${penaltyType}'`),
      );
      assert.ok(
        mentionsMissingKey,
        `Error list for missing '${penaltyType}' must mention the key by name.`,
      );
    }
  });

  // Test 16 — JSON-roundtrip for ScoreBreakdown and LeaderboardEntry
  it('ScoreBreakdown and LeaderboardEntry survive JSON roundtrip with structural equality', () => {
    const config = makeReferenceConfig();
    const inputs = makeInputs({
      rounds: 11,
      victoryPoints: 14,
      bystandersRescued: 4,
      escapes: 1,
      penaltyEventCounts: { villainEscaped: 1 },
    });

    const breakdown: ScoreBreakdown = buildScoreBreakdown(inputs, config);
    const breakdownRoundtrip: ScoreBreakdown = JSON.parse(
      JSON.stringify(breakdown),
    );
    assert.deepStrictEqual(breakdownRoundtrip, breakdown);

    const entry: LeaderboardEntry = {
      scenarioKey: config.scenarioKey,
      teamKey: 'captain-america+iron-man',
      playerIdentifiers: ['player-0', 'player-1'],
      scoreBreakdown: breakdown,
      replayHash: '0'.repeat(64),
      createdAt: '2026-04-17T00:00:00.000Z',
      scoringConfigVersion: config.scoringConfigVersion,
    };

    const entryRoundtrip: LeaderboardEntry = JSON.parse(JSON.stringify(entry));
    assert.deepStrictEqual(entryRoundtrip, entry);
  });
});

// ---------------------------------------------------------------------------
// WP-529 / D-24340 — schemeTwistNegative penalty producer (counter read)
// ---------------------------------------------------------------------------

/**
 * Builds the smallest terminal LegendaryGameState that deriveScoringInputs and
 * computeFinalScores accept: no players (so VP and rescues are 0), a mastermind
 * stub (computeFinalScores reads baseCardId + tacticsDefeated), empty card-type /
 * victory-point maps, and only the counters under test. Cast narrowly per the
 * ai.legalMoves.test.ts precedent — the derivation reads a small, explicit slice
 * of G, so a full game setup would only add noise.
 */
function makeTerminalStateWithTwists(
  overrides: { schemeTwistCount?: number } = {},
): LegendaryGameState {
  const counters: Record<string, number> = {};
  if (overrides.schemeTwistCount !== undefined) {
    counters.schemeTwistCount = overrides.schemeTwistCount;
  }
  return {
    playerZones: {},
    mastermind: { baseCardId: 'test-mastermind', tacticsDefeated: [] },
    villainDeckCardTypes: {},
    cardVictoryPoints: {},
    escapedPile: [],
    counters,
  } as unknown as LegendaryGameState;
}

/** Minimal ReplayResult — deriveScoringInputs reads only `.turnCount`. */
function makeReplayResult(turnCount: number): ReplayResult {
  return { turnCount } as unknown as ReplayResult;
}

describe('deriveScoringInputs schemeTwistNegative producer (WP-529 / D-24340)', () => {
  it('AC-1: maps G.counters.schemeTwistCount to penaltyEventCounts.schemeTwistNegative', () => {
    const state = makeTerminalStateWithTwists({ schemeTwistCount: 7 });
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.schemeTwistNegative, 7);
    // why: also the control-revert (AC-4) — reverting the derivation to `= 0`
    // makes this assertion fail, so the producer is non-vacuously tested.
    assert.notEqual(inputs.penaltyEventCounts.schemeTwistNegative, 0);
  });

  it('AC-2: an absent schemeTwistCount counter yields schemeTwistNegative 0 (the ?? 0 lazy path)', () => {
    const state = makeTerminalStateWithTwists();
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.schemeTwistNegative, 0);
  });

  it('AC-3: the derived count flows through buildScoreBreakdown into the weighted penalty total', () => {
    // why: REFERENCE_PENALTY_WEIGHTS.schemeTwistNegative === 400; the bare terminal
    // state carries no other penalty, reward, round, or VP, so the whole weighted
    // penalty total is the 3-twist contribution (3 x 400 = 1200).
    const config = makeReferenceConfig();
    const state = makeTerminalStateWithTwists({ schemeTwistCount: 3 });
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    const breakdown = buildScoreBreakdown(inputs, config);
    assert.equal(breakdown.penaltyBreakdown.schemeTwistNegative, 3 * 400);
    assert.equal(breakdown.weightedPenaltyTotal, 1200);
  });
});

// ---------------------------------------------------------------------------
// WP-528 / D-24339 — bystanderLost penalty producer (escaped-pile derivation)
// ---------------------------------------------------------------------------

/**
 * Builds the smallest terminal LegendaryGameState for the bystanderLost
 * derivation: no players (VP / rescues 0), a mastermind stub, empty counters,
 * and the escaped pile + card-type map under test. Cast narrowly per the
 * ai.legalMoves.test.ts precedent.
 */
function makeTerminalStateWithEscapedPile(
  escapedPile: string[],
  villainDeckCardTypes: Record<string, string>,
): LegendaryGameState {
  return {
    playerZones: {},
    mastermind: { baseCardId: 'test-mastermind', tacticsDefeated: [] },
    villainDeckCardTypes,
    cardVictoryPoints: {},
    escapedPile,
    counters: {},
  } as unknown as LegendaryGameState;
}

describe('deriveScoringInputs bystanderLost producer (WP-528 / D-24339)', () => {
  it('AC-1: counts the bystander-typed entries of G.escapedPile', () => {
    const state = makeTerminalStateWithEscapedPile(
      ['bys-1', 'bys-2', 'bys-3'],
      { 'bys-1': 'bystander', 'bys-2': 'bystander', 'bys-3': 'bystander' },
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.bystanderLost, 3);
    // why: also the control-revert (AC-5) — reverting the derivation to `= 0`
    // makes this assertion fail, so the producer is non-vacuously tested.
    assert.notEqual(inputs.penaltyEventCounts.bystanderLost, 0);
  });

  it('AC-2: an empty escapedPile yields bystanderLost 0 (no throw)', () => {
    const state = makeTerminalStateWithEscapedPile([], {});
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.bystanderLost, 0);
  });

  it('AC-3: an escapedPile mixing villains and bystanders counts only the bystanders (villains are the villainEscaped count)', () => {
    const state = makeTerminalStateWithEscapedPile(
      ['vil-1', 'bys-1', 'vil-2', 'bys-2'],
      { 'vil-1': 'villain', 'bys-1': 'bystander', 'vil-2': 'villain', 'bys-2': 'bystander' },
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.bystanderLost, 2);
  });

  it('AC-4: the derived count flows through buildScoreBreakdown into the weighted penalty total', () => {
    // why: REFERENCE_PENALTY_WEIGHTS.bystanderLost === 500; the bare terminal state
    // carries no other penalty, reward, round, or VP, so the whole weighted penalty
    // total is the 2-bystander contribution (2 x 500 = 1000).
    const config = makeReferenceConfig();
    const state = makeTerminalStateWithEscapedPile(
      ['bys-1', 'bys-2'],
      { 'bys-1': 'bystander', 'bys-2': 'bystander' },
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    const breakdown = buildScoreBreakdown(inputs, config);
    assert.equal(breakdown.penaltyBreakdown.bystanderLost, 2 * 500);
    assert.equal(breakdown.weightedPenaltyTotal, 1000);
  });
});

/**
 * Builds a terminal state with one player's victory pile populated. All other
 * zones are empty arrays so computeFinalScores (called inside deriveScoringInputs
 * to sum VP) can spread every zone without throwing.
 */
function makeTerminalStateWithVictoryPile(
  victory: string[],
  villainDeckCardTypes: Record<string, string>,
): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory },
    },
    mastermind: { baseCardId: 'test-mastermind', tacticsDefeated: [] },
    villainDeckCardTypes,
    cardVictoryPoints: {},
    escapedPile: [],
    counters: {},
  } as unknown as LegendaryGameState;
}

describe('deriveScoringInputs bystander count counts BOTH sources (WP-586 / D-24395)', () => {
  it('AC-1: bystandersRescued counts supply-pile bystanders (BYSTANDER_EXT_ID) alongside villain-deck bystanders', () => {
    // why: THE REGRESSION. A victory pile holds one villain-deck bystander
    // ('bys-1') and two rescued supply-pile bystanders (BYSTANDER_EXT_ID). The
    // pre-WP-586 test (villainDeckCardTypes only) saw just 1 — undercounting the
    // reward and inflating the competitive score. The fix must see all 3.
    const state = makeTerminalStateWithVictoryPile(
      ['bys-1', BYSTANDER_EXT_ID, BYSTANDER_EXT_ID],
      { 'bys-1': 'bystander' },
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.bystandersRescued, 3);
    // why: control-revert — narrowing isBystanderCard back to villainDeckCardTypes
    // only makes this fail (it would read 1), so the fix is non-vacuously tested.
    assert.notEqual(inputs.bystandersRescued, 1);
  });

  it('AC-2: a victory pile of only supply-pile bystanders is fully counted', () => {
    const state = makeTerminalStateWithVictoryPile(
      [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID],
      {},
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.bystandersRescued, 4);
  });

  it('AC-3: bystanderLost counts supply-pile bystanders carried into G.escapedPile', () => {
    // why: the escaped-pile mirror of the same bug — a Villain can carry a
    // supply-pile bystander (BYSTANDER_EXT_ID) into escapedPile; the pre-fix
    // narrow test missed it, undercounting the bystanderLost penalty.
    const state = makeTerminalStateWithEscapedPile(
      [BYSTANDER_EXT_ID, 'bys-1', 'vil-1'],
      { 'bys-1': 'bystander', 'vil-1': 'villain' },
    );
    const inputs = deriveScoringInputs(makeReplayResult(10), state);
    assert.equal(inputs.penaltyEventCounts.bystanderLost, 2);
    assert.notEqual(inputs.penaltyEventCounts.bystanderLost, 1);
  });
});
