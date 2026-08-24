/**
 * Tests for the PAR turn-distribution profile (WP-596).
 *
 * Aggregation correctness (bins sorted, medians/quartiles, win rate, median
 * VP), scenario totals (win/loss/stuck counts, minWinningTurn), the
 * monotoneImproving fidelity flag (improving / peaked / vacuous), and
 * JSON round-trip. No boardgame.io imports; pure fixtures.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { PerGameSample } from './par.aggregator.js';
import {
  aggregateTurnDistributionProfile,
  PROFILE_MIN_BIN_SIZE,
} from './par.profile.js';

/** Builds a PerGameSample with sensible defaults, overridable per field. */
function makeSample(overrides: Partial<PerGameSample>): PerGameSample {
  return {
    turnCount: 10,
    rawScore: 0,
    victoryPoints: 30,
    bystandersRescued: 3,
    schemeTwistCount: 4,
    escapes: 0,
    outcome: 'heroes-win',
    ...overrides,
  };
}

/** Builds `count` samples on one turn with a fixed rawScore and outcome. */
function makeBin(
  turnCount: number,
  count: number,
  rawScore: number,
  outcome: PerGameSample['outcome'] = 'heroes-win',
): PerGameSample[] {
  const samples: PerGameSample[] = [];
  for (let index = 0; index < count; index++) {
    samples.push(makeSample({ turnCount, rawScore, outcome }));
  }
  return samples;
}

describe('PAR turn-distribution profile (WP-596)', () => {
  test('bins are sorted ascending by turnCount and exclude unresolved games', () => {
    const samples: PerGameSample[] = [
      ...makeBin(20, 5, -2000),
      ...makeBin(10, 5, 0),
      makeSample({ turnCount: 999, outcome: 'unresolved' }),
    ];
    const profile = aggregateTurnDistributionProfile(
      'scheme::mm::vg',
      samples,
      'CompetentHeuristic/v1',
      1,
    );
    const turns = profile.bins.map((bin) => bin.turnCount);
    assert.deepEqual(turns, [10, 20], 'bins sorted ascending; unresolved excluded');
    assert.equal(profile.stuckAtCapCount, 1);
    assert.equal(profile.sampleSize, 11);
  });

  test('median / p25 / p75 rawScore and median VP are nearest-rank correct', () => {
    // rawScores [-500,-400,-300,-200,-100] → median -300, p25 -400, p75 -200.
    const rawScores = [-100, -200, -300, -400, -500];
    const samples = rawScores.map((rawScore, index) =>
      makeSample({ turnCount: 15, rawScore, victoryPoints: 40 + index }),
    );
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    const bin = profile.bins[0]!;
    assert.equal(bin.gameCount, 5);
    assert.equal(bin.medianRawScore, -300);
    assert.equal(bin.p25RawScore, -400);
    assert.equal(bin.p75RawScore, -200);
    // victoryPoints [40,41,42,43,44] → median 42.
    assert.equal(bin.medianVictoryPoints, 42);
  });

  test('winRate is the hero-win fraction of the bin, rounded to 2 decimals', () => {
    const samples: PerGameSample[] = [
      ...makeBin(12, 3, -100, 'heroes-win'),
      ...makeBin(12, 1, 500, 'scheme-wins'),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    const bin = profile.bins[0]!;
    assert.equal(bin.gameCount, 4);
    assert.equal(bin.winRate, 0.75, '3 of 4 games are hero wins');
  });

  test('win / loss / stuck counts and minWinningTurn are correct', () => {
    const samples: PerGameSample[] = [
      ...makeBin(14, 5, -1000, 'heroes-win'),
      ...makeBin(9, 2, 200, 'heroes-win'),
      ...makeBin(30, 3, 6000, 'scheme-wins'),
      makeSample({ turnCount: 200, outcome: 'unresolved' }),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    assert.equal(profile.winCount, 7);
    assert.equal(profile.lossCount, 3);
    assert.equal(profile.stuckAtCapCount, 1);
    assert.equal(profile.minWinningTurn, 9, 'smallest hero-win turn');
  });

  test('minWinningTurn is null when there are no hero wins', () => {
    const samples: PerGameSample[] = [...makeBin(30, 5, 6000, 'scheme-wins')];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    assert.equal(profile.minWinningTurn, null);
    assert.equal(profile.winCount, 0);
  });

  test('monotoneImproving is true for a strictly-improving curve', () => {
    // Median rawScore falls (improves) as turns rise: 0 → -1000 → -2000.
    const samples: PerGameSample[] = [
      ...makeBin(10, PROFILE_MIN_BIN_SIZE, 0),
      ...makeBin(15, PROFILE_MIN_BIN_SIZE, -1000),
      ...makeBin(20, PROFILE_MIN_BIN_SIZE, -2000),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    assert.equal(profile.monotoneImproving, true);
  });

  test('monotoneImproving is false for a peaked curve', () => {
    // Median improves then worsens: -1000 → -2000 → -500 (rises at turn 20).
    const samples: PerGameSample[] = [
      ...makeBin(10, PROFILE_MIN_BIN_SIZE, -1000),
      ...makeBin(15, PROFILE_MIN_BIN_SIZE, -2000),
      ...makeBin(20, PROFILE_MIN_BIN_SIZE, -500),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    assert.equal(profile.monotoneImproving, false);
  });

  test('monotoneImproving is vacuously true with fewer than 2 qualifying bins', () => {
    // One qualifying bin (turn 12, 5 games) + a sub-threshold bin (turn 13,
    // 2 games) that does not count toward the monotone check.
    const samples: PerGameSample[] = [
      ...makeBin(12, PROFILE_MIN_BIN_SIZE, -1000),
      ...makeBin(13, 2, 5000),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 1);
    assert.equal(profile.monotoneImproving, true);
  });

  test('profile survives a JSON round-trip with structural equality', () => {
    const samples: PerGameSample[] = [
      ...makeBin(10, 5, 0),
      ...makeBin(20, 5, -2000),
      makeSample({ turnCount: 200, outcome: 'unresolved' }),
    ];
    const profile = aggregateTurnDistributionProfile('s::m::v', samples, 'p/v1', 2);
    const roundTripped = JSON.parse(JSON.stringify(profile));
    assert.deepEqual(roundTripped, profile);
    assert.equal(profile.scoringConfigVersion, 2);
    assert.equal(profile.simulationPolicyVersion, 'p/v1');
  });
});
