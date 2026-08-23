import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIGameOverState } from '@legendary-arena/game-engine';
import type { MyCompetitiveScore, CompetitiveScoreBreakdown, CompetitiveSeatIdentity } from '../../lib/api/competitionApi';
import EndgameSummary from './EndgameSummary.vue';

/** A minimal natural gameover (no par/scores — the runtime shape under D-6701). */
function gameOver(over: Partial<UIGameOverState> = {}): UIGameOverState {
  return { outcome: 'heroes-win', reason: 'All tactics defeated', ...over };
}

/** A server competitive-score record. */
function score(over: Partial<MyCompetitiveScore> = {}): MyCompetitiveScore {
  return {
    submissionId: 1,
    replayHash: 'hash-1',
    scenarioKey: 'scenario-1',
    rawScore: 100,
    finalScore: -42,
    parVersion: 'par-v1',
    scoringConfigVersion: 1,
    stateHash: 'state-1',
    createdAt: '2026-08-21T00:00:00.000Z',
    ...over,
  };
}

describe('EndgameSummary (WP-578 competitive score)', () => {
  // why: WP-578 — the endgame panel shows the server-computed competitive score
  // (finalScore headline + rawScore) when the prop is present.
  test('renders the competitive final and raw score when competitiveScore is present', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -17, rawScore: 88 }) },
    });
    const panel = wrapper.find('[data-testid="arena-hud-competitive-score"]');
    assert.ok(panel.exists(), 'the competitive score panel renders');
    assert.equal(wrapper.find('[aria-label="competitiveFinalScore"]').text(), '-17');
    assert.equal(wrapper.find('[aria-label="competitiveRawScore"]').text(), '88');
  });

  test('omits the competitive score panel when competitiveScore is null (guest / pending)', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: null },
    });
    assert.ok(
      !wrapper.find('[data-testid="arena-hud-competitive-score"]').exists(),
      'no score panel without a submitted score',
    );
    // why: the existing outcome summary is unchanged when there is no score.
    assert.equal(wrapper.find('[aria-label="outcome"]').text(), 'Outcome: heroes-win');
  });

  test('omits the competitive score panel when the prop is absent (default null)', () => {
    const wrapper = mount(EndgameSummary, { props: { gameOver: gameOver() } });
    assert.ok(!wrapper.find('[data-testid="arena-hud-competitive-score"]').exists());
  });
});

/**
 * A full component breakdown, mirroring the server's ScoreBreakdown — the real
 * 2p Red Skull / Midtown game-2 figures (Raw 20, Final 320). penaltyBreakdown
 * holds per-type PRODUCTS (count × weight), as the engine produces.
 */
function breakdown(over: Partial<CompetitiveScoreBreakdown> = {}): CompetitiveScoreBreakdown {
  const counts = {
    villainEscaped: 0,
    bystanderLost: 0,
    schemeTwistNegative: 6,
    mastermindTacticUntaken: 0,
    scenarioSpecificPenalty: 0,
  };
  const products = {
    villainEscaped: 0,
    bystanderLost: 0,
    schemeTwistNegative: 1800,
    mastermindTacticUntaken: 0,
    scenarioSpecificPenalty: 0,
  };
  return {
    inputs: {
      rounds: 29,
      victoryPoints: 103,
      bystandersRescued: 11,
      escapes: 0,
      penaltyEventCounts: counts,
    },
    weightedPenaltyTotal: 1800,
    penaltyBreakdown: products,
    weightedBystanderReward: 2200,
    weightedVictoryPointReward: 1030,
    // why: WP-585 — no round-cost term: raw = 1800 − 2200 − 1030 = −1430; final = raw − par.
    rawScore: -1430,
    parScore: -300,
    finalScore: -1130,
    scoringConfigVersion: 3,
    ...over,
  };
}

describe('EndgameSummary (WP-584 worked calculation)', () => {
  test('renders the formula-first worked calculation with derived weights', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -1130, scoreBreakdown: breakdown() }) },
    });
    assert.ok(wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists(), 'worked calc renders');

    // Symbolic formula line — weights DERIVED (200/10), not hardcoded. No round term
    // (WP-585: the rulebook has no round penalty; twists carry length via Penalties).
    const formula = wrapper.find('[aria-label="rawFormula"]').text();
    assert.ok(!formula.includes('Rounds'), 'no round term in the formula');
    assert.ok(formula.includes('Penalties'), 'penalties named symbolically');
    assert.ok(formula.includes('(Bystanders × 200)'), 'bystander weight derived to 200');
    assert.ok(formula.includes('(VP × 10)'), 'VP weight derived to 10');

    // Substituted line — penalties expanded to nonzero types, then rewards.
    const substituted = wrapper.find('[aria-label="rawSubstituted"]').text();
    assert.ok(!substituted.includes('× 50'), 'no round substitution');
    assert.ok(substituted.includes('(6 scheme twists × 300)'), 'scheme twists named + expanded (WP-587)');
    assert.ok(substituted.includes('(11 × 200)'), 'bystanders substituted');
    assert.ok(substituted.includes('(103 × 10)'), 'VP substituted');

    // Products, raw result, final.
    assert.ok(wrapper.find('[aria-label="rawProducts"]').text().includes('1800 − 2200 − 1030'));
    assert.ok(wrapper.find('[aria-label="rawResult"]').text().includes('-1430'), 'raw = -1430');
    assert.ok(wrapper.find('[aria-label="finalSubstituted"]').text().includes('-1430 − (−300)'), 'final = raw − par');
    assert.ok(wrapper.find('[aria-label="finalResult"]').text().includes('-1130'), 'final = -1130');

    // "Rounds" still appears as an informational given (just not scored).
    assert.ok(wrapper.find('[aria-label="score inputs"]').text().includes('Rounds'), 'Rounds shown as a given');
  });

  test('shows the grade badge matching gradeForFinalScore for representative bands', () => {
    // WP-591 bands: 3000 → d (loss); -2500 → legendary; -1 → b.
    for (const [finalScore, label] of [[3000, 'D'], [-2500, 'Legendary'], [-1, 'B']] as const) {
      const wrapper = mount(EndgameSummary, {
        props: { gameOver: gameOver(), competitiveScore: score({ finalScore, scoreBreakdown: breakdown({ finalScore }) }) },
      });
      const badge = wrapper.find('[data-testid="arena-hud-grade-badge"]');
      assert.ok(badge.exists(), `grade badge renders for finalScore ${finalScore}`);
      assert.equal(badge.text(), label, `finalScore ${finalScore} → grade ${label}`);
      // why: the badge is legible without colour — the aria-label names the grade.
      assert.ok(badge.attributes('aria-label')?.includes(label), 'aria-label names the grade');
    }
  });

  test('grade badge shows but breakdown is omitted when a record carries no scoreBreakdown', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -2500 }) },
    });
    // The grade needs only finalScore, so the badge still shows.
    assert.equal(wrapper.find('[data-testid="arena-hud-grade-badge"]').text(), 'Legendary');
    // The breakdown table requires scoreBreakdown, which is absent here.
    assert.ok(
      !wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists(),
      'no breakdown table without scoreBreakdown',
    );
  });

  test('no grade badge or breakdown when competitiveScore is null (guest)', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: null },
    });
    assert.ok(!wrapper.find('[data-testid="arena-hud-grade-badge"]').exists());
    assert.ok(!wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists());
  });
});

describe('EndgameSummary (WP-587 PAR derivation + grade scale)', () => {
  test('renders PAR derivation when the breakdown carries a parBaseline', () => {
    const wrapper = mount(EndgameSummary, {
      props: {
        gameOver: gameOver(),
        competitiveScore: score({
          finalScore: -1130,
          scoreBreakdown: breakdown({
            parScore: -1150,
            parBaseline: { bystandersPar: 5, victoryPointsPar: 25, escapesPar: 1 },
          }),
        }),
      },
    });
    const par = wrapper.find('[data-testid="arena-hud-par-derivation"]');
    assert.ok(par.exists(), 'PAR derivation block renders');
    // The reward weights are derived (200/10); the escape term is symbolic here
    // (the match had 0 escapes) — never a fabricated number.
    assert.ok(wrapper.find('[aria-label="parFormula"]').text().includes('(Bystanders × 200)'));
    const parSub = wrapper.find('[aria-label="parSubstituted"]').text();
    assert.ok(parSub.includes('(5 × 200) − (25 × 10)'), parSub);
    assert.ok(parSub.includes('escape penalty'), 'escape weight symbolic when not derivable');
    // The PAR value is shown verbatim.
    assert.ok(wrapper.find('[aria-label="parResult"]').text().includes('-1150'), 'PAR value verbatim');
  });

  test('omits PAR derivation when the breakdown has no parBaseline (older record)', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -1130, scoreBreakdown: breakdown() }) },
    });
    // The worked calc still renders; only the PAR-derivation block is absent.
    assert.ok(wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists());
    assert.ok(!wrapper.find('[data-testid="arena-hud-par-derivation"]').exists());
  });

  test('renders the full grade scale with the earned grade marked', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -2500, scoreBreakdown: breakdown({ finalScore: -2500 }) }) },
    });
    const scale = wrapper.find('[data-testid="arena-hud-grade-scale"]');
    assert.ok(scale.exists(), 'grade scale renders');
    // WP-588 — a horizontal colour-coded strip of cells (wider, not a tall list).
    const cells = scale.findAll('.grade-scale-cell');
    assert.equal(cells.length, 6, 'one cell per grade band');
    // Each cell carries its grade colour class (colour = reinforcement).
    assert.ok(scale.find('.grade-scale-cell--legendary').exists(), 'legendary cell is colour-coded');
    assert.ok(scale.find('.grade-scale-cell--f').exists(), 'F cell is colour-coded');
    // finalScore -2500 → legendary; exactly that cell is current + names it (text, not colour alone).
    const current = scale.findAll('.grade-scale-cell--current');
    assert.equal(current.length, 1, 'exactly one current cell');
    assert.ok(current[0]?.text().includes('Legendary'), 'the Legendary cell is marked current');
    assert.ok(current[0]?.text().includes('your score'), 'current cell carries the text marker');
    assert.equal(current[0]?.attributes('aria-current'), 'true');
  });

  test('grade scale shows even without a breakdown (needs only finalScore)', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -2500 }) },
    });
    assert.ok(wrapper.find('[data-testid="arena-hud-grade-scale"]').exists());
    // No breakdown → no worked calc, but the scale (finalScore-only) still renders.
    assert.ok(!wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists());
  });
});

describe('EndgameSummary (WP-588 per-player split + PAR basis)', () => {
  test('renders the per-player VP + bystander split when the breakdown carries perPlayer', () => {
    const wrapper = mount(EndgameSummary, {
      props: {
        gameOver: gameOver(),
        competitiveScore: score({
          finalScore: -1660,
          scoreBreakdown: breakdown({
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
        }),
      },
    });
    const perPlayer = wrapper.find('[data-testid="arena-hud-per-player"]');
    assert.ok(perPlayer.exists(), 'per-player block renders');
    const text = perPlayer.text();
    // 0-based playerId renders as 1-based "Player N".
    assert.ok(text.includes('Player 1'), 'player 0 renders as Player 1');
    assert.ok(text.includes('Player 2'), 'player 1 renders as Player 2');
    assert.ok(text.includes('34') && text.includes('11 bystanders'), 'player 1 stats');
    assert.ok(text.includes('27') && text.includes('9 bystanders'), 'player 2 stats');
  });

  test('omits the per-player block when the breakdown has no perPlayer (older record)', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -1130, scoreBreakdown: breakdown() }) },
    });
    assert.ok(wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists());
    assert.ok(!wrapper.find('[data-testid="arena-hud-per-player"]').exists());
  });

  test('shows the PAR basis copy (scheme, mastermind, villain groups) under the PAR derivation', () => {
    const wrapper = mount(EndgameSummary, {
      props: {
        gameOver: gameOver(),
        competitiveScore: score({
          finalScore: -1130,
          scoreBreakdown: breakdown({
            parScore: -1150,
            parBaseline: { bystandersPar: 5, victoryPointsPar: 25, escapesPar: 1 },
          }),
        }),
      },
    });
    const basis = wrapper.find('[aria-label="parBasis"]');
    assert.ok(basis.exists(), 'PAR basis copy renders');
    assert.ok(
      basis.text().includes('scheme, mastermind, and villain groups'),
      'names the scenario inputs (not henchmen)',
    );
  });
});

describe('EndgameSummary (WP-593 report-card v2)', () => {
  function withPerPlayer(over = {}) {
    return breakdown({
      inputs: {
        rounds: 29, victoryPoints: 103, bystandersRescued: 11, escapes: 0,
        penaltyEventCounts: { villainEscaped: 0, bystanderLost: 0, schemeTwistNegative: 6, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 },
        perPlayer: [
          { playerId: '0', victoryPoints: 60, bystandersRescued: 7 },
          { playerId: '1', victoryPoints: 43, bystandersRescued: 4 },
        ],
      },
      ...over,
    });
  }

  test('renders the raw-score ledger (penalties + earned) netting to raw', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ rawScore: -1430, scoreBreakdown: breakdown() }) },
    });
    const ledger = wrapper.find('[data-testid="arena-hud-raw-ledger"]');
    assert.ok(ledger.exists(), 'raw ledger renders');
    assert.ok(ledger.text().includes('6 scheme twists'), 'penalty line named');
    assert.equal(wrapper.find('[aria-label="competitiveRawScore"]').text(), '-1430');
  });

  test('names players with (Bot) and (@handle) from seat identities', () => {
    const seatIdentities: CompetitiveSeatIdentity[] = [
      { playerId: '0', isBot: false, handle: 'jeff' },
      { playerId: '1', isBot: true, handle: null },
    ];
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ scoreBreakdown: withPerPlayer(), seatIdentities }) },
    });
    const perPlayer = wrapper.find('[data-testid="arena-hud-per-player"]');
    assert.ok(perPlayer.exists(), 'per-player block renders');
    assert.ok(perPlayer.text().includes('Player 1 (@jeff)'), perPlayer.text());
    assert.ok(perPlayer.text().includes('Player 2 (Bot)'), perPlayer.text());
  });

  test('renders the luck-of-the-draw read from the adversity baseline', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ scoreBreakdown: breakdown({
        inputs: { rounds: 20, victoryPoints: 40, bystandersRescued: 5, escapes: 2, penaltyEventCounts: { villainEscaped: 2, bystanderLost: 6, schemeTwistNegative: 8, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 } },
        parBaseline: { bystandersPar: 6, victoryPointsPar: 40, escapesPar: 1, schemeTwistsPar: 2, bystandersLostPar: 3 },
      }) }) },
    });
    const luck = wrapper.find('[data-testid="arena-hud-luck-read"]');
    assert.ok(luck.exists(), 'luck read renders');
    assert.equal(wrapper.find('[aria-label="luckHeadline"]').text(), 'Difficult shuffle');
  });

  test('omits the luck read for a record with no WP-591 adversity baseline', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ scoreBreakdown: breakdown() }) },
    });
    assert.ok(!wrapper.find('[data-testid="arena-hud-luck-read"]').exists());
  });
});
