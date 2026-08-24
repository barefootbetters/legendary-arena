/**
 * PAR turn-distribution profile (WP-596) — the empirical "sweet-spot" curve.
 *
 * Aggregates the per-game PerGameSample rows produced by
 * generateScenarioParSamples (par.aggregator.ts) into a per-turn profile:
 * for each turn-count at which games ended, the game count, the median /
 * p25 / p75 Raw Score, the win rate, and the median victory points — plus
 * scenario-level totals and a monotone-improving fidelity flag.
 *
 * This is a DERIVED, NON-AUTHORITATIVE diagnostic (D-24405). It is never the
 * PAR baseline, never a competitive input, and never read back into gameplay;
 * it is persisted separately from the immutable hashed PAR artifact
 * (par.storage.ts writeParProfileArtifact).
 *
 * Pure TypeScript: no boardgame.io import, no IO, no randomness, no
 * .reduce() with branching. Deterministic — identical samples produce an
 * identical profile.
 */

import type { PerGameSample } from './par.aggregator.js';
import type { ScenarioKey } from '../scoring/parScoring.types.js';

// why: minimum games in a turn-bin before its median counts toward the
// monotone-improving check — below this the per-turn median is too noisy to
// trust as a trend point. 5 matches the smallest bin the 2026-08-23
// prototype treated as stable.
export const PROFILE_MIN_BIN_SIZE = 5;

/** One turn-count's aggregated outcomes across the sampled games. */
export interface ParTurnBin {
  /** The turn on which these games ended. */
  readonly turnCount: number;
  /** How many sampled games ended on this turn. */
  readonly gameCount: number;
  /** Median Raw Score of those games (lower is better). */
  readonly medianRawScore: number;
  /** 25th-percentile Raw Score (nearest-rank). */
  readonly p25RawScore: number;
  /** 75th-percentile Raw Score (nearest-rank). */
  readonly p75RawScore: number;
  /** Fraction of those games that were hero wins, 0..1 (2 decimals). */
  readonly winRate: number;
  /** Median team victory points among those games. */
  readonly medianVictoryPoints: number;
}

/** The per-scenario empirical turns-vs-score profile. */
export interface ParTurnDistributionProfile {
  readonly scenarioKey: ScenarioKey;
  readonly sampleSize: number;
  readonly winCount: number;
  readonly lossCount: number;
  /** Games that hit the turn/move safety cap (outcome 'unresolved'). */
  readonly stuckAtCapCount: number;
  /** Smallest turn on which a hero win occurred, or null if none. */
  readonly minWinningTurn: number | null;
  /**
   * True when the median Raw Score is non-increasing (lower = better) across
   * bins with gameCount >= PROFILE_MIN_BIN_SIZE — the difficulty-fidelity
   * signal (a scenario the engine currently makes too easy has a curve that
   * only improves with length, never a peak). NOT a strategy guide.
   */
  readonly monotoneImproving: boolean;
  /** Per-turn bins, excluding 'unresolved' games, sorted ascending by turn. */
  readonly bins: readonly ParTurnBin[];
  readonly simulationPolicyVersion: string;
  readonly scoringConfigVersion: number;
}

/**
 * Nearest-rank percentile of a numeric array. Sorts a copy ascending and
 * returns the value at ceil((percentile / 100) * n) - 1, clamped to
 * [0, n - 1]. Returns 0 for an empty array (callers never pass one).
 */
function nearestRankPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sortedAscending = [...values].sort((left, right) => left - right);
  const rawIndex = Math.ceil((percentile / 100) * sortedAscending.length) - 1;
  let index = rawIndex;
  if (index < 0) {
    index = 0;
  }
  if (index > sortedAscending.length - 1) {
    index = sortedAscending.length - 1;
  }
  return sortedAscending[index]!;
}

/**
 * Aggregates per-game samples into a ParTurnDistributionProfile.
 *
 * @param scenarioKey - The scenario the samples belong to.
 * @param samples - Per-game rows from generateScenarioParSamples.
 * @param simulationPolicyVersion - Provenance pin, copied verbatim.
 * @param scoringConfigVersion - Provenance pin, copied verbatim.
 * @returns The derived, non-authoritative turn-distribution profile.
 */
export function aggregateTurnDistributionProfile(
  scenarioKey: ScenarioKey,
  samples: readonly PerGameSample[],
  simulationPolicyVersion: string,
  scoringConfigVersion: number,
): ParTurnDistributionProfile {
  let winCount = 0;
  let lossCount = 0;
  let stuckAtCapCount = 0;
  let minWinningTurn: number | null = null;

  // why: group the resolved games by turnCount. 'unresolved' games (safety-cap
  // hits) never enter a bin — they would distort the per-turn curve — but are
  // counted in stuckAtCapCount so the sample is fully accounted for.
  const rawScoresByTurn = new Map<number, number[]>();
  const victoryPointsByTurn = new Map<number, number[]>();
  const winsByTurn = new Map<number, number>();

  for (const sample of samples) {
    if (sample.outcome === 'heroes-win') {
      winCount = winCount + 1;
      if (minWinningTurn === null || sample.turnCount < minWinningTurn) {
        minWinningTurn = sample.turnCount;
      }
    } else if (sample.outcome === 'scheme-wins') {
      lossCount = lossCount + 1;
    } else if (sample.outcome === 'unresolved') {
      stuckAtCapCount = stuckAtCapCount + 1;
      continue;
    }

    const existingRawScores = rawScoresByTurn.get(sample.turnCount);
    if (existingRawScores === undefined) {
      rawScoresByTurn.set(sample.turnCount, [sample.rawScore]);
      victoryPointsByTurn.set(sample.turnCount, [sample.victoryPoints]);
      winsByTurn.set(sample.turnCount, sample.outcome === 'heroes-win' ? 1 : 0);
    } else {
      existingRawScores.push(sample.rawScore);
      victoryPointsByTurn.get(sample.turnCount)!.push(sample.victoryPoints);
      if (sample.outcome === 'heroes-win') {
        winsByTurn.set(sample.turnCount, winsByTurn.get(sample.turnCount)! + 1);
      }
    }
  }

  const sortedTurns = [...rawScoresByTurn.keys()].sort((left, right) => left - right);
  const bins: ParTurnBin[] = [];
  for (const turnCount of sortedTurns) {
    const rawScores = rawScoresByTurn.get(turnCount)!;
    const victoryPoints = victoryPointsByTurn.get(turnCount)!;
    const wins = winsByTurn.get(turnCount)!;
    bins.push({
      turnCount,
      gameCount: rawScores.length,
      medianRawScore: nearestRankPercentile(rawScores, 50),
      p25RawScore: nearestRankPercentile(rawScores, 25),
      p75RawScore: nearestRankPercentile(rawScores, 75),
      // why: rounded to 2 decimals so the serialized profile has no float
      // artifacts (0.1 + 0.2 style) in the win-rate readout.
      winRate: Math.round((wins / rawScores.length) * 100) / 100,
      medianVictoryPoints: nearestRankPercentile(victoryPoints, 50),
    });
  }

  return {
    scenarioKey,
    sampleSize: samples.length,
    winCount,
    lossCount,
    stuckAtCapCount,
    minWinningTurn,
    monotoneImproving: computeMonotoneImproving(bins),
    bins,
    simulationPolicyVersion,
    scoringConfigVersion,
  };
}

/**
 * Returns true when the median Raw Score is non-increasing (lower = better)
 * across the bins that carry at least PROFILE_MIN_BIN_SIZE games. Fewer than
 * two qualifying bins is vacuously true — there is no trend to contradict.
 */
function computeMonotoneImproving(bins: readonly ParTurnBin[]): boolean {
  const qualifyingBins: ParTurnBin[] = [];
  for (const bin of bins) {
    if (bin.gameCount >= PROFILE_MIN_BIN_SIZE) {
      qualifyingBins.push(bin);
    }
  }
  if (qualifyingBins.length < 2) {
    return true;
  }
  let previousMedian = qualifyingBins[0]!.medianRawScore;
  for (let index = 1; index < qualifyingBins.length; index++) {
    const currentMedian = qualifyingBins[index]!.medianRawScore;
    if (currentMedian > previousMedian) {
      return false;
    }
    previousMedian = currentMedian;
  }
  return true;
}
