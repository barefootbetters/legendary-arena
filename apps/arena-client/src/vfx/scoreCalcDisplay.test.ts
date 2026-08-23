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
      '(6 scheme twists × 300) − (11 × 200) − (103 × 10)',
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
    // villainEscaped (2×100) + bystanderLost (1×400) + schemeTwistNegative (4×300),
    // each named per WP-587 (singular/plural correct).
    assert.ok(
      calc.substituted.includes(
        '(2 villains escaped × 100) + (1 bystander lost × 400) + (4 scheme twists × 300)',
      ),
      calc.substituted,
    );
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

  test('single-count penalty uses the singular label', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        inputs: {
          rounds: 10,
          victoryPoints: 20,
          bystandersRescued: 3,
          escapes: 1,
          penaltyEventCounts: {
            villainEscaped: 1,
            bystanderLost: 0,
            schemeTwistNegative: 1,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
        penaltyBreakdown: {
          villainEscaped: 100,
          bystanderLost: 0,
          schemeTwistNegative: 300,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
      }),
    );
    assert.ok(calc.substituted.includes('(1 villain escaped × 100)'), calc.substituted);
    assert.ok(calc.substituted.includes('(1 scheme twist × 300)'), calc.substituted);
  });
});

describe('PAR derivation (WP-587)', () => {
  test('undefined when the breakdown carries no parBaseline (records predating WP-587)', () => {
    const calc = buildWorkedScoreCalc(breakdown());
    assert.equal(calc.parDerivation, undefined);
    // The PAR value itself is still available for the "= PAR" line.
    assert.equal(calc.parScore, -300);
  });

  test('derives PAR from the baseline, reusing the match weights (escape weight derivable)', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        parScore: -1150,
        parBaseline: { bystandersPar: 5, victoryPointsPar: 25, escapesPar: 1 },
        inputs: {
          rounds: 20,
          victoryPoints: 60,
          bystandersRescued: 18,
          escapes: 1,
          penaltyEventCounts: {
            villainEscaped: 1,
            bystanderLost: 0,
            schemeTwistNegative: 7,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
        penaltyBreakdown: {
          villainEscaped: 100,
          bystanderLost: 0,
          schemeTwistNegative: 2100,
          mastermindTacticUntaken: 0,
          scenarioSpecificPenalty: 0,
        },
        weightedBystanderReward: 3600,
        weightedVictoryPointReward: 600,
      }),
    );
    assert.ok(calc.parDerivation);
    assert.equal(
      calc.parDerivation?.formula,
      '(Escapes × 100) − (Bystanders × 200) − (VP × 10)',
    );
    assert.equal(
      calc.parDerivation?.substituted,
      '(1 × 100) − (5 × 200) − (25 × 10)',
    );
    // twists is 0 here (this fixture's baseline predates WP-591's schemeTwistsPar),
    // so no twist term appears in the formula/substituted above.
    assert.deepEqual(calc.parDerivation?.baseline, {
      escapes: 1,
      twists: 0,
      bystanders: 5,
      victoryPoints: 25,
    });
    // The PAR value shown is verbatim, never recomputed from the substituted line.
    assert.equal(calc.parScore, -1150);
  });

  test('escape weight shows symbolically when the match had no escape (not fabricated)', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        parScore: -1150,
        parBaseline: { bystandersPar: 5, victoryPointsPar: 25, escapesPar: 1 },
        // default fixture has escapes: 0 → villainEscaped weight not derivable.
        weightedBystanderReward: 3600,
        weightedVictoryPointReward: 600,
        inputs: {
          rounds: 20,
          victoryPoints: 60,
          bystandersRescued: 18,
          escapes: 0,
          penaltyEventCounts: {
            villainEscaped: 0,
            bystanderLost: 0,
            schemeTwistNegative: 7,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
        },
      }),
    );
    // Never invents a number: the escape term names the weight symbolically.
    assert.ok(calc.parDerivation?.substituted.includes('(1 × escape penalty)'), calc.parDerivation?.substituted);
    assert.ok(calc.parDerivation?.formula.includes('Escapes −') || calc.parDerivation?.formula.startsWith('Escapes'), calc.parDerivation?.formula);
    // The reward terms still show their derived weights.
    assert.ok(calc.parDerivation?.substituted.includes('(5 × 200) − (25 × 10)'), calc.parDerivation?.substituted);
  });
});

describe('per-player split (WP-588)', () => {
  test('undefined when the breakdown carries no perPlayer (records predating WP-588)', () => {
    const calc = buildWorkedScoreCalc(breakdown());
    assert.equal(calc.perPlayer, undefined);
  });

  test('labels 0-based player ids as "Player N" (1-based) and carries each split', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        inputs: {
          rounds: 22,
          victoryPoints: 61,
          bystandersRescued: 20,
          escapes: 0,
          penaltyEventCounts: {
            villainEscaped: 0,
            bystanderLost: 0,
            schemeTwistNegative: 6,
            mastermindTacticUntaken: 0,
            scenarioSpecificPenalty: 0,
          },
          perPlayer: [
            { playerId: '0', victoryPoints: 34, bystandersRescued: 11 },
            { playerId: '1', victoryPoints: 27, bystandersRescued: 9 },
          ],
        },
      }),
    );
    assert.ok(calc.perPlayer);
    assert.equal(calc.perPlayer?.length, 2);
    assert.deepEqual(calc.perPlayer?.[0], { label: 'Player 1', victoryPoints: 34, bystandersRescued: 11 });
    assert.deepEqual(calc.perPlayer?.[1], { label: 'Player 2', victoryPoints: 27, bystandersRescued: 9 });
    // The per-player VP + bystanders reconcile with the team totals shown in the raw calc.
    const summedVp = (calc.perPlayer ?? []).reduce((total, row) => total + row.victoryPoints, 0);
    const summedBystanders = (calc.perPlayer ?? []).reduce((total, row) => total + row.bystandersRescued, 0);
    assert.equal(summedVp, 61);
    assert.equal(summedBystanders, 20);
  });
});

describe('WP-591 — twist-aware PAR derivation + loss penalty display', () => {
  test('PAR derivation shows the twist term when the baseline expects twists', () => {
    const calc = buildWorkedScoreCalc(
      breakdown({
        parScore: -2440,
        parBaseline: { bystandersPar: 22, victoryPointsPar: 74, escapesPar: 1, schemeTwistsPar: 6, bystandersLostPar: 2 },
        // the match had escapes + twists so both weights are derivable.
        inputs: {
          rounds: 20, victoryPoints: 74, bystandersRescued: 22, escapes: 1,
          penaltyEventCounts: { villainEscaped: 1, bystanderLost: 0, schemeTwistNegative: 6, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
        },
        penaltyBreakdown: { villainEscaped: 100, bystanderLost: 0, schemeTwistNegative: 1800, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
        weightedBystanderReward: 4400,
        weightedVictoryPointReward: 740,
      }),
    );
    assert.ok(calc.parDerivation?.formula.includes('+ (Twists × 300)'), calc.parDerivation?.formula);
    assert.ok(calc.parDerivation?.substituted.includes('+ (6 × 300)'), calc.parDerivation?.substituted);
    assert.equal(calc.parDerivation?.baseline.twists, 6);
  });

  test('raw calc shows the loss-penalty term only when the match was lost', () => {
    const lost = buildWorkedScoreCalc(breakdown({ weightedLossPenalty: 6000 }));
    assert.ok(lost.formula.includes('+ loss penalty'), lost.formula);
    assert.ok(lost.products.includes('+ 6000'), lost.products);
    const won = buildWorkedScoreCalc(breakdown());
    assert.ok(!won.formula.includes('loss penalty'), won.formula);
    assert.ok(!won.products.includes('+ 6000'), won.products);
  });
});
