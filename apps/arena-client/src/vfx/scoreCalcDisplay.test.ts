import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkedScoreCalc } from './scoreCalcDisplay';
import type { CompetitiveScoreBreakdown } from '../lib/api/competitionApi';

/** The real 2p Red Skull / Midtown game-2 breakdown (Raw 20, Final 320). */
function breakdown(over: Partial<CompetitiveScoreBreakdown> = {}): CompetitiveScoreBreakdown {
  return {
    inputs: {
      rounds: 29,
      victoryPoints: 103,
      bystandersRescued: 11,
      escapes: 0,
      penaltyEventCounts: {
        villainEscaped: 0,
        bystanderLost: 0,
        schemeTwistNegative: 6,
        mastermindTacticUntaken: 0,
        scenarioSpecificPenalty: 0,
      },
    },
    weightedPenaltyTotal: 1800,
    penaltyBreakdown: {
      villainEscaped: 0,
      bystanderLost: 0,
      schemeTwistNegative: 1800,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    },
    weightedBystanderReward: 2200,
    weightedVictoryPointReward: 1030,
    // why: WP-585 — no round-cost term: raw = 1800 − 2200 − 1030 = −1430.
    rawScore: -1430,
    parScore: -300,
    finalScore: -1130,
    scoringConfigVersion: 3,
    ...over,
  };
}

describe('buildWorkedScoreCalc (WP-584)', () => {
  test('formula-first with weights derived from the breakdown (not hardcoded)', () => {
    const calc = buildWorkedScoreCalc(breakdown());
    assert.equal(
      calc.formula,
      'Penalties − (Bystanders × 200) − (VP × 10)',
    );
    assert.equal(
      calc.substituted,
      '(6 × 300) − (11 × 200) − (103 × 10)',
    );
    assert.equal(calc.products, '1800 − 2200 − 1030');
    assert.equal(calc.rawScore, -1430);
    assert.equal(calc.finalSubstituted, '-1430 − (−300)');
    assert.equal(calc.finalScore, -1130);
  });

  test('givens list the six inputs verbatim', () => {
    const calc = buildWorkedScoreCalc(breakdown());
    const byLabel = Object.fromEntries(calc.givens.map((g) => [g.label, g.value]));
    assert.equal(byLabel['Rounds'], 29);
    assert.equal(byLabel['Bystanders rescued'], 11);
    assert.equal(byLabel['Victory points'], 103);
    assert.equal(byLabel['Scheme twists'], 6);
    assert.equal(byLabel['Villain escapes'], 0);
    assert.equal(byLabel['Bystanders lost'], 0);
  });

  test('multiple nonzero penalties expand in fixed order', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        inputs: {
          rounds: 10,
          victoryPoints: 20,
          bystandersRescued: 3,
          escapes: 2,
          penaltyEventCounts: {
            villainEscaped: 2,
            bystanderLost: 1,
            schemeTwistNegative: 4,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
        penaltyBreakdown: {
          villainEscaped: 200,
          bystanderLost: 400,
          schemeTwistNegative: 1200,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
      }),
    );
    // villainEscaped (2×100) + bystanderLost (1×400) + schemeTwistNegative (4×300)
    assert.ok(calc.substituted.includes('(2 × 100) + (1 × 400) + (4 × 300)'), calc.substituted);
  });

  test('no penalties substitutes to 0', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        weightedPenaltyTotal: 0,
        inputs: {
          rounds: 8,
          victoryPoints: 30,
          bystandersRescued: 4,
          escapes: 0,
          penaltyEventCounts: {
            villainEscaped: 0,
            bystanderLost: 0,
            schemeTwistNegative: 0,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
        penaltyBreakdown: {
          villainEscaped: 0,
          bystanderLost: 0,
          schemeTwistNegative: 0,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
      }),
    );
    // why: WP-585 — penalties are now the FIRST term (no round cost before them),
    // so a zero penalty total leads the substituted line.
    assert.ok(calc.substituted.startsWith('0 −'), calc.substituted);
  });

  test('a zero-count reward term shows its 0 product, no bogus weight', () => {
    // No bystanders rescued → the weight (200) is not derivable from the data.
    const calc = buildWorkedScoreCalc(
      breakdown({
        weightedBystanderReward: 0,
        inputs: {
          rounds: 12,
          victoryPoints: 40,
          bystandersRescued: 0,
          escapes: 0,
          penaltyEventCounts: {
            villainEscaped: 0,
            bystanderLost: 0,
            schemeTwistNegative: 2,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
        penaltyBreakdown: {
          villainEscaped: 0,
          bystanderLost: 0,
          schemeTwistNegative: 600,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
      }),
    );
    // Formula falls back to the bare label (no invented weight); substituted shows 0.
    assert.ok(calc.formula.includes('− Bystanders '), calc.formula);
    assert.ok(!calc.formula.includes('(Bystanders ×'), 'no bogus bystander weight');
    assert.ok(calc.substituted.includes('− 0 −'), calc.substituted);
  });

  test('a positive PAR is not parenthesized in the final line', () => {
    const calc = buildWorkedScoreCalc(breakdown({ parScore: 150, rawScore: 20, finalScore: -130 }));
    assert.equal(calc.finalSubstituted, '20 − 150');
    assert.equal(calc.finalScore, -130);
  });
});
