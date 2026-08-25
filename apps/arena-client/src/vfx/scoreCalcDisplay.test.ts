import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkedScoreCalc, buildLuckRead, buildScoringKey } from './scoreCalcDisplay';
import type {
  CompetitiveScoreBreakdown,
  CompetitiveSeatIdentity,
} from '../lib/api/competitionApi';

/**
 * The real 2p Red Skull / Midtown game-2 breakdown, on the WP-599 / D-24409
 * rulebook-fidelity scale: no bystander reward, penalties in true VP-units (twist =
 * 30). 6 twists → penalties 180; 103 VP → reward 1030; raw = 180 − 1030 = −850.
 */
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
    weightedPenaltyTotal: 180,
    penaltyBreakdown: {
      villainEscaped: 0,
      bystanderLost: 0,
      schemeTwistNegative: 180,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    },
    weightedVictoryPointReward: 1030,
    // why: WP-599 / D-24409 — no bystander-reward term: raw = 180 − 1030 = −850.
    rawScore: -850,
    parScore: -300,
    finalScore: -550,
    scoringConfigVersion: 5,
    ...over,
  };
}

describe('buildWorkedScoreCalc (WP-584)', () => {
  test('formula-first with weights derived from the breakdown (not hardcoded)', () => {
    const calc = buildWorkedScoreCalc(breakdown());
    assert.equal(
      calc.formula,
      'Penalties − (VP × 10)',
    );
    assert.equal(
      calc.substituted,
      '(6 scheme twists × 30) − (103 × 10)',
    );
    assert.equal(calc.products, '180 − 1030');
    assert.equal(calc.rawScore, -850);
    assert.equal(calc.finalSubstituted, '-850 − (−300)');
    assert.equal(calc.finalScore, -550);
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

  test('the worked formula carries no bystander term (WP-599: bystanders score via VP)', () => {
    // why: WP-599 / D-24409 removed the dedicated bystander reward. VP is the sole
    // reward term, and it already counts rescued bystanders (1 VP each). The worked
    // formula must show only Penalties and VP — never a Bystanders term or a ×200.
    const calc = buildWorkedScoreCalc(breakdown());
    assert.ok(!calc.formula.includes('Bystander'), calc.formula);
    assert.ok(!calc.substituted.includes('× 200'), calc.substituted);
    assert.ok(!calc.products.includes('2200'), calc.products);
    assert.equal(calc.formula, 'Penalties − (VP × 10)');
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
      '(Escapes × 100) − (VP × 10)',
    );
    assert.equal(
      calc.parDerivation?.substituted,
      '(1 × 100) − (25 × 10)',
    );
    // twists + bystandersLost are 0 here (this fixture's baseline predates WP-591's
    // schemeTwistsPar/bystandersLostPar), so neither term appears in the formula above.
    assert.deepEqual(calc.parDerivation?.baseline, {
      escapes: 1,
      twists: 0,
      bystandersLost: 0,
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
    // WP-599 / D-24409 — the VP reward term still shows its derived weight; there is no
    // longer a bystander-reward term in the PAR derivation.
    assert.ok(calc.parDerivation?.substituted.includes('(25 × 10)'), calc.parDerivation?.substituted);
    assert.ok(!calc.parDerivation?.substituted.includes('× 200'), calc.parDerivation?.substituted);
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

  test('PAR derivation shows the bystander-lost term and reconciles to the printed PAR (WP-601)', () => {
    // Mirrors a real 2p Midtown / Red Skull match: printed PAR −470 must equal the shown
    // expansion (1×10)+(6×30)+(2×40)−(74×10). Before WP-601 the derivation omitted the
    // "+ (2 × 40)" bystander-lost term, so the expansion read −550 while the line printed −470.
    const calc = buildWorkedScoreCalc(
      breakdown({
        parScore: -470,
        parBaseline: { bystandersPar: 22, victoryPointsPar: 74, escapesPar: 1, schemeTwistsPar: 6, bystandersLostPar: 2 },
        inputs: {
          rounds: 26, victoryPoints: 59, bystandersRescued: 13, escapes: 1,
          penaltyEventCounts: { villainEscaped: 1, bystanderLost: 1, schemeTwistNegative: 4, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
        },
        penaltyBreakdown: { villainEscaped: 10, bystanderLost: 40, schemeTwistNegative: 120, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
        weightedVictoryPointReward: 590,
      }),
    );
    assert.equal(calc.parDerivation?.formula, '(Escapes × 10) + (Twists × 30) + (Bystanders lost × 40) − (VP × 10)');
    assert.equal(calc.parDerivation?.substituted, '(1 × 10) + (6 × 30) + (2 × 40) − (74 × 10)');
    assert.equal(calc.parDerivation?.baseline.bystandersLost, 2);
    // The shown expansion now reconciles to the printed PAR: 10 + 180 + 80 − 740 = −470.
    assert.equal(10 + 180 + 80 - 740, calc.parScore);
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

describe('raw-score ledger (WP-593)', () => {
  test('splits penalties (positive) from earned rewards (subtracted), netting to rawScore', () => {
    const ledger = buildWorkedScoreCalc(breakdown()).rawLedger;
    // one penalty line (6 scheme twists = 180), no others
    assert.equal(ledger.penalties.length, 1);
    assert.equal(ledger.penalties[0]?.label, '6 scheme twists');
    assert.equal(ledger.penalties[0]?.amount, 180);
    assert.equal(ledger.penaltyTotal, 180);
    // WP-599 / D-24409 — one earned line: VP (1030). Rescued bystanders score inside VP
    // now, not as a separate line.
    assert.equal(ledger.earned.length, 1);
    assert.equal(ledger.earnedTotal, 1030);
    assert.equal(ledger.total, -850);
  });

  test('a lost match adds a match-lost penalty line', () => {
    const ledger = buildWorkedScoreCalc(breakdown({ weightedLossPenalty: 800, rawScore: -50 })).rawLedger;
    const lossLine = ledger.penalties.find((line) => line.label === 'match lost');
    assert.ok(lossLine, 'match-lost penalty line present');
    assert.equal(lossLine?.amount, 800);
    // WP-599 / D-24409 — LOSS_PENALTY is 800 now; base twists 180 + 800 = 980.
    assert.equal(ledger.penaltyTotal, 980);
  });

  test('no penalties yields an empty penalties list (client renders "None")', () => {
    const clean = breakdown({
      weightedPenaltyTotal: 0,
      penaltyBreakdown: { villainEscaped: 0, bystanderLost: 0, schemeTwistNegative: 0, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
      inputs: { rounds: 5, victoryPoints: 40, bystandersRescued: 4, escapes: 0, penaltyEventCounts: { villainEscaped: 0, bystanderLost: 0, schemeTwistNegative: 0, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 } },
    });
    const ledger = buildWorkedScoreCalc(clean).rawLedger;
    assert.equal(ledger.penalties.length, 0);
    assert.equal(ledger.penaltyTotal, 0);
  });
});

describe('named players (WP-593 seat identities)', () => {
  const withPerPlayer = breakdown({
    inputs: {
      rounds: 29, victoryPoints: 103, bystandersRescued: 11, escapes: 0,
      penaltyEventCounts: { villainEscaped: 0, bystanderLost: 0, schemeTwistNegative: 6, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
      perPlayer: [
        { playerId: '0', victoryPoints: 60, bystandersRescued: 7 },
        { playerId: '1', victoryPoints: 43, bystandersRescued: 4 },
      ],
    },
  });

  test('suffixes (Bot) and (@handle) from seat identities', () => {
    const seats: CompetitiveSeatIdentity[] = [
      { playerId: '0', isBot: false, handle: 'jeff' },
      { playerId: '1', isBot: true, handle: null },
    ];
    const rows = buildWorkedScoreCalc(withPerPlayer, seats).perPlayer;
    assert.equal(rows?.[0]?.label, 'Player 1 (@jeff)');
    assert.equal(rows?.[1]?.label, 'Player 2 (Bot)');
  });

  test('does not double the @ when the stored handle already carries one', () => {
    const seats: CompetitiveSeatIdentity[] = [{ playerId: '0', isBot: false, handle: '@jeff' }];
    const rows = buildWorkedScoreCalc(withPerPlayer, seats).perPlayer;
    assert.equal(rows?.[0]?.label, 'Player 1 (@jeff)');
  });

  test('falls back to plain "Player N" when seat identities are absent', () => {
    const rows = buildWorkedScoreCalc(withPerPlayer).perPlayer;
    assert.equal(rows?.[0]?.label, 'Player 1');
    assert.equal(rows?.[1]?.label, 'Player 2');
  });

  test('a guest seat (no bot, no handle) stays a plain "Player N"', () => {
    const seats: CompetitiveSeatIdentity[] = [
      { playerId: '0', isBot: false, handle: null },
      { playerId: '1', isBot: false, handle: 'rival' },
    ];
    const rows = buildWorkedScoreCalc(withPerPlayer, seats).perPlayer;
    assert.equal(rows?.[0]?.label, 'Player 1');
    assert.equal(rows?.[1]?.label, 'Player 2 (@rival)');
  });
});

describe('luck of the draw (WP-593)', () => {
  function withBaseline(
    schemeTwistsPar: number,
    escapesPar: number,
    bystandersLostPar: number,
    counts: { schemeTwistNegative: number; villainEscaped: number; bystanderLost: number },
  ): CompetitiveScoreBreakdown {
    return breakdown({
      inputs: {
        rounds: 20, victoryPoints: 40, bystandersRescued: 5, escapes: counts.villainEscaped,
        penaltyEventCounts: { mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0, ...counts },
      },
      parBaseline: { bystandersPar: 6, victoryPointsPar: 40, escapesPar, schemeTwistsPar, bystandersLostPar },
    });
  }

  test('undefined for a record with no WP-591 adversity baseline', () => {
    assert.equal(buildLuckRead(breakdown()), undefined);
    // a 3-field baseline (pre-WP-591) is also insufficient
    const threeField = breakdown({ parBaseline: { bystandersPar: 6, victoryPointsPar: 40, escapesPar: 1 } });
    assert.equal(buildLuckRead(threeField), undefined);
  });

  test('far more adversity than expected reads difficult', () => {
    // expected 2+1+3 = 6; actual 8+2+6 = 16 -> ratio 2.67
    const luck = buildLuckRead(withBaseline(2, 1, 3, { schemeTwistNegative: 8, villainEscaped: 2, bystanderLost: 6 }));
    assert.equal(luck?.verdict, 'difficult');
    assert.equal(luck?.headline, 'Difficult shuffle');
    assert.equal(luck?.deltas.length, 3);
  });

  test('far less adversity than expected reads favorable', () => {
    // expected 6+3+4 = 13; actual 1+0+1 = 2 -> ratio 0.15
    const luck = buildLuckRead(withBaseline(6, 3, 4, { schemeTwistNegative: 1, villainEscaped: 0, bystanderLost: 1 }));
    assert.equal(luck?.verdict, 'favorable');
  });

  test('about-as-expected reads average', () => {
    // expected 5+1+2 = 8; actual 5+1+2 = 8 -> ratio 1.0
    const luck = buildLuckRead(withBaseline(5, 1, 2, { schemeTwistNegative: 5, villainEscaped: 1, bystanderLost: 2 }));
    assert.equal(luck?.verdict, 'average');
  });

  test('a zero-adversity baseline with any adversity reads difficult', () => {
    const luck = buildLuckRead(withBaseline(0, 0, 0, { schemeTwistNegative: 3, villainEscaped: 0, bystanderLost: 0 }));
    assert.equal(luck?.verdict, 'difficult');
  });
});

describe('scoring key (WP-600)', () => {
  test('awards is VP only (rescued bystanders fold into VP, no separate award)', () => {
    const key = buildScoringKey();
    assert.equal(key.awards.length, 1);
    assert.equal(key.awards[0]?.label, 'Victory Point');
    assert.equal(key.awards[0]?.points, '−10');
    // The whole point of WP-599: no dedicated bystander-rescue award line.
    assert.ok(!key.awards.some((line) => line.label.toLowerCase().includes('bystander')));
    // …but the VP note names rescued bystanders as a VP source.
    assert.ok(key.awards[0]?.note.includes('rescued bystander'), key.awards[0]?.note);
  });

  test('penalties are the rulebook 4:3:1 on the true VP-unit scale', () => {
    const key = buildScoringKey();
    const byLabel = Object.fromEntries(key.penalties.map((line) => [line.label, line.points]));
    assert.equal(byLabel['Villain escaped'], '+10');
    assert.equal(byLabel['Scheme twist'], '+30');
    assert.equal(byLabel['Bystander lost'], '+40');
    assert.equal(key.penalties.length, 3);
  });
});
