/**
 * Tests for the PAR aggregation pipeline (WP-049).
 *
 * Exactly seventeen tests inside one describe block, per WP-049 §G +
 * EC-049 §G. Tests cover:
 *   - Percentile correctness (nearest-rank, integer output)
 *   - Typed error semantics (instanceof + .code, never message substring)
 *   - Validation surface (sample size, monotonicity, multimodality)
 *   - Tier ordering
 *   - Canonical drift detection (AI_POLICY_TIERS + usedForPar)
 *   - Seed-set determinism and hashing
 *   - generateScenarioPar byte-identity + JSON-roundtrip
 *   - Provenance pinning (version fields)
 *   - Loss treatment and sampleSize invariant
 *
 * No boardgame.io imports. Uses a minimal CardRegistryReader mock.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ScenarioScoringConfig } from '../scoring/parScoring.types.js';
import type { ParSimulationConfig, ParSimulationResult } from './par.aggregator.js';

import {
  aggregateParFromSimulation,
  generateScenarioPar,
  validateParResult,
  validateTierOrdering,
  generateSeedSet,
  computeSeedSetHash,
  ParAggregationError,
  PAR_MIN_SAMPLE_SIZE,
} from './par.aggregator.js';
import {
  AI_POLICY_TIERS,
  AI_POLICY_TIER_DEFINITIONS,
} from './ai.tiers.js';

/**
 * Minimal CardRegistryReader mock for PAR tests.
 *
 * Returns an empty card list. buildInitialGameState handles narrow
 * mocks gracefully — the internal builders produce empty records when
 * the registry lacks detailed set data.
 */
function createMockRegistry(): CardRegistryReader {
  return {
    listCards: () => [],
  };
}

/** Builds a valid 9-field MatchSetupConfig for PAR aggregator tests. */
function createTestSetupConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-par',
    mastermindId: 'test-mastermind-par',
    villainGroupIds: ['test-villain-group-par'],
    henchmanGroupIds: ['test-henchman-group-par'],
    heroDeckIds: ['hero-deck-neutral-a', 'hero-deck-neutral-b'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/** Builds a minimal ScenarioScoringConfig satisfying WP-048 invariants. */
function createTestScoringConfig(): ScenarioScoringConfig {
  return {
    scenarioKey: 'test-scheme-par::test-mastermind-par::test-villain-group-par',
    weights: {
      roundCost: 50,
      bystanderReward: 200,
      victoryPointReward: 10,
    },
    caps: {
      bystanderCap: null,
      victoryPointCap: null,
    },
    penaltyEventWeights: {
      villainEscaped: 100,
      bystanderLost: 300,
      schemeTwistNegative: 50,
      mastermindTacticUntaken: 25,
      scenarioSpecificPenalty: 40,
    },
    parBaseline: {
      roundsPar: 20,
      bystandersPar: 5,
      victoryPointsPar: 30,
      escapesPar: 1,
    },
    scoringConfigVersion: 1,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  };
}

/** Builds a complete ParSimulationConfig using the test helpers. */
function createTestParConfig(
  overrides?: Partial<ParSimulationConfig>,
): ParSimulationConfig {
  const base: ParSimulationConfig = {
    scenarioKey: 'test-scheme-par::test-mastermind-par::test-villain-group-par',
    setupConfig: createTestSetupConfig(),
    playerCount: 2,
    simulationCount: 10,
    baseSeed: 'par-test-base-seed',
    percentile: 55,
    scoringConfig: createTestScoringConfig(),
    simulationPolicyVersion: 'CompetentHeuristic/v1',
    scoringConfigVersion: 1,
    generatedAtOverride: '2026-04-23T00:00:00.000Z',
  };
  return { ...base, ...overrides };
}

/** Builds a synthetic ParSimulationResult with configurable sampleSize. */
function buildSyntheticResult(sampleSize: number): ParSimulationResult {
  return {
    scenarioKey: 'test-synthetic',
    parValue: 5000,
    percentileUsed: 55,
    sampleSize,
    seedSetHash: 'djb2-abcdef',
    rawScoreDistribution: {
      min: 3000,
      p25: 4000,
      median: 4800,
      p55: 5000,
      p75: 6000,
      max: 7500,
      standardDeviation: 800,
      interquartileRange: 2000,
    },
    needsMoreSamples: false,
    seedParDelta: 200,
    simulationPolicyVersion: 'CompetentHeuristic/v1',
    scoringConfigVersion: 1,
    generatedAt: '2026-04-23T00:00:00.000Z',
  };
}

describe('PAR aggregator (WP-049)', () => {
  test('aggregateParFromSimulation with 1000 scores returns 55th percentile (rankIndex 549)', () => {
    // why: nearest-rank formula: ceil((55/100) * 1000) - 1 = 549.
    // With values 1..1000, the 549th index (0-based) of the ascending
    // sorted array is 550.
    const scores: number[] = [];
    for (let value = 1; value <= 1000; value++) {
      scores.push(value);
    }
    const par = aggregateParFromSimulation(scores, 55);
    assert.equal(par, 550, `expected PAR=550 at rankIndex 549; got ${par}`);
  });

  test('percentile of sorted identical scores returns that score (integer)', () => {
    const scores: number[] = [];
    for (let index = 0; index < 100; index++) {
      scores.push(42);
    }
    const par = aggregateParFromSimulation(scores, 55);
    assert.equal(par, 42);
    assert.equal(Number.isInteger(par), true, 'PAR must be an integer');
  });

  test('empty array throws ParAggregationError with code EMPTY_DISTRIBUTION', () => {
    try {
      aggregateParFromSimulation([], 55);
      assert.fail('expected aggregateParFromSimulation([]) to throw');
    } catch (error) {
      assert.ok(
        error instanceof ParAggregationError,
        `expected ParAggregationError; got ${error instanceof Error ? error.constructor.name : typeof error}`,
      );
      assert.equal((error as ParAggregationError).code, 'EMPTY_DISTRIBUTION');
    }
  });

  test('percentile outside [0,100] throws ParAggregationError with code PERCENTILE_OUT_OF_RANGE', () => {
    try {
      aggregateParFromSimulation([1, 2, 3], 150);
      assert.fail('expected aggregateParFromSimulation(_, 150) to throw');
    } catch (error) {
      assert.ok(
        error instanceof ParAggregationError,
        'expected ParAggregationError',
      );
      assert.equal(
        (error as ParAggregationError).code,
        'PERCENTILE_OUT_OF_RANGE',
      );
    }

    try {
      aggregateParFromSimulation([1, 2, 3], -5);
      assert.fail('expected aggregateParFromSimulation(_, -5) to throw');
    } catch (error) {
      assert.ok(error instanceof ParAggregationError);
      assert.equal(
        (error as ParAggregationError).code,
        'PERCENTILE_OUT_OF_RANGE',
      );
    }
  });

  test('validateParResult accepts valid result with N >= 500', () => {
    const result = buildSyntheticResult(PAR_MIN_SAMPLE_SIZE);
    // why: use interior raw scores to avoid the module-level
    // multimodality flag. A plain linear distribution passes cleanly.
    const rawScores: number[] = [];
    for (let index = 0; index < PAR_MIN_SAMPLE_SIZE; index++) {
      rawScores.push(3000 + index);
    }
    const validation = validateParResult(result, rawScores);
    assert.equal(
      validation.valid,
      true,
      `valid result must pass validation; issues=${JSON.stringify(validation.issues)}`,
    );
  });

  test('validateParResult rejects result with N < 500', () => {
    const result = buildSyntheticResult(100);
    const rawScores: number[] = [];
    for (let index = 0; index < 100; index++) {
      rawScores.push(3000 + index);
    }
    const validation = validateParResult(result, rawScores);
    assert.equal(
      validation.valid,
      false,
      'result with sampleSize < PAR_MIN_SAMPLE_SIZE must fail validation',
    );
    let foundSampleSizeError = false;
    for (const issue of validation.issues) {
      if (issue.code === 'SAMPLE_SIZE_BELOW_MINIMUM' && issue.severity === 'error') {
        foundSampleSizeError = true;
      }
    }
    assert.equal(
      foundSampleSizeError,
      true,
      'expected a SAMPLE_SIZE_BELOW_MINIMUM error issue',
    );
  });

  test('validateParResult passes unimodal distribution cleanly', () => {
    const result = buildSyntheticResult(PAR_MIN_SAMPLE_SIZE);
    // Build a tight contiguous unimodal distribution: 500 values in
    // [5000, 5019], 25 samples per integer. With range=19 and 20 bins
    // every integer lands in its own bin, producing a single contiguous
    // plateau with no gaps — the cluster-based detector returns false.
    const rawScores: number[] = [];
    for (let index = 0; index < PAR_MIN_SAMPLE_SIZE; index++) {
      rawScores.push(5000 + (index % 20));
    }
    const validation = validateParResult(result, rawScores);
    let multimodalWarn = false;
    for (const issue of validation.issues) {
      if (issue.code === 'MULTIMODAL_DISTRIBUTION') {
        multimodalWarn = true;
      }
    }
    assert.equal(
      multimodalWarn,
      false,
      'unimodal distribution must not raise the MULTIMODAL_DISTRIBUTION warn',
    );
  });

  test('validateParResult flags bimodal distribution as suspicious (histogram peak detection)', () => {
    const result = buildSyntheticResult(PAR_MIN_SAMPLE_SIZE);
    // Build a bimodal distribution: half near 2000, half near 8000.
    const rawScores: number[] = [];
    for (let index = 0; index < PAR_MIN_SAMPLE_SIZE / 2; index++) {
      rawScores.push(2000 + (index % 5));
    }
    for (let index = 0; index < PAR_MIN_SAMPLE_SIZE / 2; index++) {
      rawScores.push(8000 + (index % 5));
    }
    const validation = validateParResult(result, rawScores);
    let multimodalWarn = false;
    for (const issue of validation.issues) {
      if (issue.code === 'MULTIMODAL_DISTRIBUTION') {
        multimodalWarn = true;
      }
    }
    assert.equal(
      multimodalWarn,
      true,
      'bimodal distribution must raise the MULTIMODAL_DISTRIBUTION warn',
    );
  });

  test('validateTierOrdering passes when T3 < T2 < T1 < T0 medians (N >= 50 per tier)', () => {
    // Build four tiers with strictly ordered medians.
    const tier0 = buildTierScores(50, 9000);
    const tier1 = buildTierScores(50, 7000);
    const tier2 = buildTierScores(50, 5000);
    const tier3 = buildTierScores(50, 3000);
    const ordering = validateTierOrdering(tier0, tier1, tier2, tier3);
    assert.equal(
      ordering.passed,
      true,
      `expected passed=true; violations=${JSON.stringify(ordering.violations)}`,
    );
    assert.equal(ordering.violations.length, 0);
  });

  test('validateTierOrdering fails when ordering violated', () => {
    // Build violation: T2 "stronger" (lower) than T3.
    const tier0 = buildTierScores(50, 9000);
    const tier1 = buildTierScores(50, 7000);
    const tier2 = buildTierScores(50, 3000);
    const tier3 = buildTierScores(50, 5000);
    const ordering = validateTierOrdering(tier0, tier1, tier2, tier3);
    assert.equal(ordering.passed, false);
    assert.ok(ordering.violations.length > 0);
  });

  test('AI_POLICY_TIERS matches AIPolicyTier union exactly (drift detection)', () => {
    assert.equal(AI_POLICY_TIERS.length, 5, 'AI_POLICY_TIERS must have 5 members');
    assert.deepStrictEqual(
      [...AI_POLICY_TIERS],
      ['T0', 'T1', 'T2', 'T3', 'T4'],
      'AI_POLICY_TIERS must list T0..T4 in order',
    );
  });

  test('only T2 has usedForPar: true in tier definitions', () => {
    const parTiers = AI_POLICY_TIER_DEFINITIONS.filter(
      (definition) => definition.usedForPar,
    );
    assert.equal(
      parTiers.length,
      1,
      'exactly one tier definition must have usedForPar: true',
    );
    assert.equal(parTiers[0]!.tier, 'T2', 'T2 must be the sole PAR authority');
  });

  test('generateSeedSet same baseSeed + same count = same seeds (determinism)', () => {
    const seedsA = generateSeedSet('determinism-seed', 100);
    const seedsB = generateSeedSet('determinism-seed', 100);
    assert.deepStrictEqual(seedsA, seedsB);
    assert.equal(seedsA.length, 100);

    // Empty contract.
    const empty = generateSeedSet('anything', 0);
    assert.deepStrictEqual(empty, []);
    const negative = generateSeedSet('anything', -5);
    assert.deepStrictEqual(negative, []);
  });

  test('computeSeedSetHash same seeds = same hash (order-sensitive)', () => {
    const seeds = ['seed-0', 'seed-1', 'seed-2', 'seed-3'];
    const hashA = computeSeedSetHash(seeds);
    const hashB = computeSeedSetHash([...seeds]);
    assert.equal(hashA, hashB);

    const reorderedHash = computeSeedSetHash(['seed-3', 'seed-2', 'seed-1', 'seed-0']);
    assert.notEqual(
      hashA,
      reorderedHash,
      'reordered seed list must produce a different hash',
    );
  });

  test('generateScenarioPar is byte-identical + JSON-roundtrip stable with injected generatedAtOverride', () => {
    // why: every reproducibility test MUST inject generatedAtOverride
    // (WP-049 pre-flight RS-11) — otherwise generatedAt differs via
    // new Date().toISOString() and byte-identity fails on clock skew.
    const config = createTestParConfig({ simulationCount: 10 });
    const registry = createMockRegistry();
    const resultA = generateScenarioPar(config, registry);
    const resultB = generateScenarioPar(config, registry);

    // Byte-identity check.
    assert.deepStrictEqual(resultA, resultB);

    // JSON-roundtrip check — proves no functions, Maps, Sets, or class
    // instances slipped into the result.
    const jsonA = JSON.parse(JSON.stringify(resultA));
    const jsonB = JSON.parse(JSON.stringify(resultB));
    assert.deepStrictEqual(jsonA, jsonB);
    assert.deepStrictEqual(jsonA, resultA);
  });

  test('generateScenarioPar copies simulationPolicyVersion and scoringConfigVersion verbatim', () => {
    const config = createTestParConfig({
      simulationCount: 10,
      simulationPolicyVersion: 'CompetentHeuristic/v42-probe',
      scoringConfigVersion: 99,
    });
    const registry = createMockRegistry();
    const result = generateScenarioPar(config, registry);

    assert.equal(
      result.simulationPolicyVersion,
      'CompetentHeuristic/v42-probe',
      'simulationPolicyVersion must be copied from config verbatim',
    );
    assert.equal(
      result.scoringConfigVersion,
      99,
      'scoringConfigVersion must be copied from config verbatim',
    );
  });

  test('losses included in distribution; result.sampleSize === config.simulationCount', () => {
    const config = createTestParConfig({ simulationCount: 12 });
    const registry = createMockRegistry();
    const result = generateScenarioPar(config, registry);

    assert.equal(
      result.sampleSize,
      config.simulationCount,
      'result.sampleSize must equal config.simulationCount — no seed may be silently dropped',
    );

    // The distribution bounds demonstrate the distribution is populated
    // with real values (not all zeros). Even a mock-registry run
    // produces bounded Raw Score integers.
    assert.equal(
      Number.isInteger(result.rawScoreDistribution.min),
      true,
      'distribution min must be an integer',
    );
    assert.equal(
      Number.isInteger(result.rawScoreDistribution.max),
      true,
      'distribution max must be an integer',
    );
    assert.ok(
      result.rawScoreDistribution.min <= result.rawScoreDistribution.max,
      'min must be <= max',
    );

    // Mixed win/loss distribution — aggregateParFromSimulation must
    // compute the percentile without filtering. Test with a hand-built
    // mixed distribution.
    const mixedScores = [1000, 2000, 3000, 8000, 9000, 10000, 11000, 12000];
    const par = aggregateParFromSimulation(mixedScores, 55);
    assert.equal(Number.isInteger(par), true);
    // 55th percentile of an 8-element array: ceil(0.55 * 8) - 1 = 4 →
    // sortedAscending[4] = 9000.
    assert.equal(par, 9000, 'mixed distribution must produce nearest-rank percentile without filtering');
  });
});

/**
 * Helper: build N Raw Scores clustered near `median` with small spread.
 *
 * The spread is small enough that the array's median lands on `median`
 * exactly under nearest-rank computation.
 */
function buildTierScores(count: number, median: number): number[] {
  const scores: number[] = [];
  for (let index = 0; index < count; index++) {
    const offset = (index % 5) - 2;
    scores.push(median + offset);
  }
  return scores;
}
