/**
 * Tests for the co-op win-rate + loss-cause harness (WP-452).
 *
 * Aggregation math, determinism (same seeds → identical report),
 * position-independence (swapping seed order yields an identical report — the
 * fresh-policy-per-seed proof), the byCategory-sums-to-games invariant, and the
 * empty-seeds zeroed-report guard.
 *
 * Uses makeMockCtx-friendly in-file fixtures (a minimal CardRegistryReader and
 * a valid 9-field MatchSetupConfig) exactly like simulation.test.ts — no
 * boardgame.io import, no @legendary-arena/registry import.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { runCoopWinRate } from './coopWinRate.js';
import type { CoopHarnessConfig, CoopWinRateReport } from './coopWinRate.js';
import { COOP_OUTCOME_CATEGORIES } from './coopOutcome.js';

/**
 * Builds a valid 9-field MatchSetupConfig fixture for harness tests.
 *
 * Mirrors createTestConfig in simulation.test.ts so fixture semantics stay
 * aligned with the canonical simulation-test pattern.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Minimal CardRegistryReader returning an empty card list.
 *
 * buildInitialGameState handles narrow mocks gracefully (see simulation.test.ts):
 * the internal builders produce empty records when the registry lacks
 * listSets/getSet, so games run deterministically to a terminal or the cap.
 */
function createMockRegistry(): CardRegistryReader {
  return {
    listCards: () => [],
  };
}

/**
 * Asserts the five byCategory counts sum to the report's game count.
 */
function assertByCategorySumsToGames(report: CoopWinRateReport): void {
  let total = 0;
  for (const category of COOP_OUTCOME_CATEGORIES) {
    total += report.byCategory[category];
  }
  assert.equal(
    total,
    report.games,
    'byCategory counts must sum to games (a branch fell through the classifier)',
  );
}

describe('runCoopWinRate (WP-452)', () => {
  test('reports games/wins/winRate/byCategory with byCategory summing to games', () => {
    const config: CoopHarnessConfig = {
      matchConfiguration: createTestConfig(),
      policyName: 'random',
      seeds: ['s1', 's2', 's3', 's4'],
    };
    const report = runCoopWinRate(config, createMockRegistry());

    assert.equal(report.games, 4, 'games must equal the seed count');
    assert.equal(report.winRate, report.wins / report.games, 'winRate must be wins/games');
    assert.ok(report.wins >= 0 && report.wins <= report.games, 'wins must be within [0, games]');
    assertByCategorySumsToGames(report);
  });

  test('identical (config, policyName, seeds) → byte-identical report (determinism)', () => {
    const config: CoopHarnessConfig = {
      matchConfiguration: createTestConfig(),
      policyName: 'competent',
      seeds: ['alpha', 'bravo', 'charlie'],
    };
    const first = runCoopWinRate(config, createMockRegistry());
    const second = runCoopWinRate(config, createMockRegistry());
    assert.deepEqual(first, second, 'two runs with identical inputs must be byte-identical');
  });

  test('swapping seed order yields an identical report (position-independence)', () => {
    // why: the fresh-policy-per-seed proof. If runCoopWinRate reused one policy
    // instance across seeds, its stateful PRNG would carry between games and the
    // per-game outcomes would depend on order — so a reversed seed list would
    // produce a different byCategory. An identical report under reversal proves
    // each game depends only on its own seed.
    const matchConfiguration = createTestConfig();
    const forward = runCoopWinRate(
      { matchConfiguration, policyName: 'random', seeds: ['one', 'two', 'three'] },
      createMockRegistry(),
    );
    const reversed = runCoopWinRate(
      { matchConfiguration, policyName: 'random', seeds: ['three', 'two', 'one'] },
      createMockRegistry(),
    );
    assert.deepEqual(reversed, forward, 'seed order must not change the aggregate report');
  });

  test('a run is the sum of its single-seed runs (per-game independence)', () => {
    const matchConfiguration = createTestConfig();
    const both = runCoopWinRate(
      { matchConfiguration, policyName: 'random', seeds: ['g1', 'g2'] },
      createMockRegistry(),
    );
    const first = runCoopWinRate(
      { matchConfiguration, policyName: 'random', seeds: ['g1'] },
      createMockRegistry(),
    );
    const second = runCoopWinRate(
      { matchConfiguration, policyName: 'random', seeds: ['g2'] },
      createMockRegistry(),
    );

    assert.equal(both.games, 2);
    assert.equal(both.wins, first.wins + second.wins, 'wins must add across single-seed runs');
    for (const category of COOP_OUTCOME_CATEGORIES) {
      assert.equal(
        both.byCategory[category],
        first.byCategory[category] + second.byCategory[category],
        `byCategory[${category}] must add across single-seed runs`,
      );
    }
  });

  test('empty seeds → zeroed report, never NaN', () => {
    const report = runCoopWinRate(
      { matchConfiguration: createTestConfig(), policyName: 'competent', seeds: [] },
      createMockRegistry(),
    );
    assert.equal(report.games, 0);
    assert.equal(report.wins, 0);
    assert.equal(report.winRate, 0);
    assert.equal(Number.isNaN(report.winRate), false, 'winRate must never be NaN');
    for (const category of COOP_OUTCOME_CATEGORIES) {
      assert.equal(report.byCategory[category], 0, `byCategory[${category}] must be 0 for an empty run`);
    }
  });

  test('report is JSON-serializable', () => {
    const report = runCoopWinRate(
      { matchConfiguration: createTestConfig(), policyName: 'random', seeds: ['j1', 'j2'] },
      createMockRegistry(),
    );
    const parsed = JSON.parse(JSON.stringify(report));
    assert.deepEqual(parsed, report, 'JSON round-trip must preserve every report field');
  });
});
