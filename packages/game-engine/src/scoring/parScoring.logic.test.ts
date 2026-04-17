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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Reference component weights from docs/12-SCORING-REFERENCE.md and EC-048.
 * Integer centesimal units.
 */
const REFERENCE_WEIGHTS = {
  roundCost: 100,
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
      roundsPar: 12,
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

    // (10 × 100) + (2×200 + 1×500 + 1×400 + 1×100 + 0×100)
    //   - (5 × 300) - (20 × 50)
    // = 1000 + 1400 - 1500 - 1000
    // = -100
    const rawScore = computeRawScore(inputs, config);
    assert.strictEqual(rawScore, -100);
  });

  // Test 2 — monotonicity: extra round increases score (worse)
  it('computeRawScore monotonicity: one extra round increases Raw Score by roundCost', () => {
    const config = makeReferenceConfig();
    const baseline = makeInputs({ rounds: 10 });
    const extraRound = makeInputs({ rounds: 11 });

    const baselineScore = computeRawScore(baseline, config);
    const extraScore = computeRawScore(extraRound, config);

    assert.ok(extraScore > baselineScore);
    assert.strictEqual(extraScore - baselineScore, config.weights.roundCost);
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
      rounds: config.parBaseline.roundsPar,
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

    const zeroRoundCost: ScenarioScoringConfig = {
      ...baseConfig,
      weights: { ...baseConfig.weights, roundCost: 0 },
    };
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
      zeroRoundCost,
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
        roundCost: 100,
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
        roundCost: 100,
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
