import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildParSweetSpotOption } from './parSweetSpotOption.js';
import type { ParProfile } from '../../types/parFidelity.js';

const COLORS = { line: '#111', band: '#222', axis: '#333' };

function makeProfile(): ParProfile {
  return {
    scenarioKey: 'x::mm::v',
    bins: [
      {
        turnCount: 10,
        gameCount: 5,
        medianRawScore: 200,
        p25RawScore: -100,
        p75RawScore: 500,
        winRate: 1,
        medianVictoryPoints: 30,
      },
      {
        turnCount: 20,
        gameCount: 8,
        medianRawScore: -1980,
        p25RawScore: -3000,
        p75RawScore: -1000,
        winRate: 1,
        medianVictoryPoints: 55,
      },
    ],
    winCount: 13,
    lossCount: 0,
    sampleSize: 13,
    minWinningTurn: 10,
    stuckAtCapCount: 0,
    monotoneImproving: false,
  };
}

describe('buildParSweetSpotOption (WP-598)', () => {
  it('builds a median series plus a p25/p75 band (3 line series)', () => {
    const option = buildParSweetSpotOption(makeProfile(), COLORS);
    const series = option.series as Array<{ name?: string; type?: string; data: unknown[] }>;
    assert.equal(series.length, 3);
    const names = series.map((s) => s.name);
    assert.deepEqual(names, ['p25', 'p25–p75 band', 'Median score']);
    for (const s of series) {
      assert.equal(s.type, 'line');
    }
  });

  it('the band diff series carries (p75 - p25) stacked on the p25 base', () => {
    const option = buildParSweetSpotOption(makeProfile(), COLORS);
    const series = option.series as Array<{ name?: string; data: number[] }>;
    const lower = series[0]!.data;
    const bandDiff = series[1]!.data;
    assert.deepEqual(lower, [-100, -3000]); // p25 base
    assert.deepEqual(bandDiff, [600, 2000]); // p75 - p25
  });

  it('the median series carries median values with gameCount for the tooltip', () => {
    const option = buildParSweetSpotOption(makeProfile(), COLORS);
    const series = option.series as Array<{
      name?: string;
      data: Array<{ value: number; gameCount: number }>;
    }>;
    const median = series[2]!.data;
    assert.deepEqual(median[0]!, { value: 200, gameCount: 5 });
    assert.deepEqual(median[1]!, { value: -1980, gameCount: 8 });
  });

  it('the y-axis admits negative values (no min: 0)', () => {
    const option = buildParSweetSpotOption(makeProfile(), COLORS);
    const yAxis = option.yAxis as { type?: string; min?: unknown };
    assert.equal(yAxis.type, 'value');
    // why (D-24406): golf scores go negative — a min:0 would clip the curve.
    assert.equal(yAxis.min, undefined);
  });

  it('the x-axis is the turn labels in order', () => {
    const option = buildParSweetSpotOption(makeProfile(), COLORS);
    const xAxis = option.xAxis as { type?: string; data?: string[] };
    assert.equal(xAxis.type, 'category');
    assert.deepEqual(xAxis.data, ['10', '20']);
  });
});
