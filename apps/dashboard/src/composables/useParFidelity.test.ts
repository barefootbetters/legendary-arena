import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { useParFidelity, summarizeReport } from './useParFidelity.js';
import type { ParFidelityBundle } from '../types/parFidelity.js';

/** A fixture bundle: 3 winnable (one too-easy, one mid, one loss-only) + a profile. */
function makeBundle(overrides?: Partial<ParFidelityBundle>): ParFidelityBundle {
  return {
    report: {
      generatedAt: '2026-08-23T00:00:00.000Z',
      sample: 200,
      scenarioCount: 3,
      scenarios: [
        {
          scenarioKey: 'a::mm::v',
          winRate: 1.0,
          lossRate: 0,
          minWinningTurn: 7,
          monotoneImproving: false,
          stuckAtCapCount: 0,
          binCount: 12,
          sampleSize: 200,
          tooEasyRank: 1,
        },
        {
          scenarioKey: 'b::mm::v',
          winRate: 0.5,
          lossRate: 0.5,
          minWinningTurn: 15,
          monotoneImproving: false,
          stuckAtCapCount: 3,
          binCount: 20,
          sampleSize: 200,
          tooEasyRank: 2,
        },
        {
          scenarioKey: 'c::mm::v',
          winRate: 0,
          lossRate: 1,
          minWinningTurn: null,
          monotoneImproving: false,
          stuckAtCapCount: 1,
          binCount: 8,
          sampleSize: 200,
          tooEasyRank: 3,
        },
      ],
      skipped: [],
    },
    profiles: {
      'a::mm::v': {
        scenarioKey: 'a::mm::v',
        bins: [
          {
            turnCount: 7,
            gameCount: 5,
            medianRawScore: 100,
            p25RawScore: -50,
            p75RawScore: 300,
            winRate: 1,
            medianVictoryPoints: 27,
          },
        ],
        winCount: 200,
        lossCount: 0,
        sampleSize: 200,
        minWinningTurn: 7,
        stuckAtCapCount: 0,
        monotoneImproving: false,
      },
    },
    ...overrides,
  };
}

describe('useParFidelity (WP-598)', () => {
  it('summarizeReport counts winnable / too-easy / unwinnable over resolved rows', () => {
    const summary = summarizeReport(makeBundle().report);
    assert.equal(summary.scenariosSwept, 3);
    assert.equal(summary.winnableCount, 2); // winRate > 0
    assert.equal(summary.unwinnableCount, 1); // winRate === 0
    assert.equal(summary.tooEasyCount, 1); // winRate >= 0.9
    assert.equal(summary.winnablePercent, 66.7); // 2/3 rounded to 1 dp
    assert.equal(summary.sample, 200);
  });

  it('exposes the report scenarios as ranked rows', () => {
    const { rows } = useParFidelity({ bundle: makeBundle() });
    assert.equal(rows.value.length, 3);
    assert.equal(rows.value[0]!.scenarioKey, 'a::mm::v');
    assert.equal(rows.value[0]!.tooEasyRank, 1);
  });

  it('getProfile returns a hit and null on a miss', () => {
    const { getProfile } = useParFidelity({ bundle: makeBundle() });
    const hit = getProfile('a::mm::v');
    assert.notEqual(hit, null);
    assert.equal(hit!.bins.length, 1);
    assert.equal(getProfile('nonexistent::x::y'), null);
  });

  it('surfaces the stub error and an empty summary when the build fell back', () => {
    const stub: ParFidelityBundle = {
      report: {
        generatedAt: '',
        sample: 0,
        scenarioCount: 0,
        scenarios: [],
        skipped: [],
      },
      profiles: {},
      error: 'source missing',
    };
    const { rows, summary, error } = useParFidelity({ bundle: stub });
    assert.equal(error, 'source missing');
    assert.equal(rows.value.length, 0);
    assert.equal(summary.value.scenariosSwept, 0);
    assert.equal(summary.value.winnablePercent, 0);
  });
});
