import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIGameOverState } from '@legendary-arena/game-engine';
import type { MyCompetitiveScore, CompetitiveScoreBreakdown } from '../../lib/api/competitionApi';
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

/** A full component breakdown, mirroring the server's ScoreBreakdown. */
function breakdown(over: Partial<CompetitiveScoreBreakdown> = {}): CompetitiveScoreBreakdown {
  const penalties = {
    villainEscaped: 1,
    bystanderLost: 0,
    schemeTwistNegative: 7,
    mastermindTacticUntaken: 0,
    scenarioSpecificPenalty: 0,
  };
  return {
    inputs: {
      rounds: 32,
      victoryPoints: 103,
      bystandersRescued: 30,
      escapes: 1,
      penaltyEventCounts: penalties,
    },
    weightedRoundCost: 1600,
    weightedPenaltyTotal: 2200,
    penaltyBreakdown: penalties,
    weightedBystanderReward: 6000,
    weightedVictoryPointReward: 1030,
    rawScore: 920,
    parScore: -300,
    finalScore: 1220,
    scoringConfigVersion: 1,
    ...over,
  };
}

describe('EndgameSummary (WP-583 breakdown + grade)', () => {
  test('renders the component breakdown verbatim from scoreBreakdown', () => {
    const wrapper = mount(EndgameSummary, {
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: 1220, scoreBreakdown: breakdown() }) },
    });
    assert.ok(wrapper.find('[data-testid="arena-hud-score-breakdown"]').exists(), 'breakdown renders');
    assert.equal(wrapper.find('[aria-label="breakdownRounds"]').text(), '32');
    assert.equal(wrapper.find('[aria-label="breakdownBystandersRescued"]').text(), '30');
    assert.equal(wrapper.find('[aria-label="breakdownVictoryPoints"]').text(), '103');
    assert.equal(wrapper.find('[aria-label="breakdownSchemeTwists"]').text(), '7');
    assert.equal(wrapper.find('[aria-label="breakdownVillainEscapes"]').text(), '1');
    assert.equal(wrapper.find('[aria-label="breakdownParScore"]').text(), '-300');
  });

  test('shows the grade badge matching gradeForFinalScore for representative bands', () => {
    // 1220 → d (the live example); -1500 → legendary; -1 → b.
    for (const [finalScore, label] of [[1220, 'D'], [-1500, 'Legendary'], [-1, 'B']] as const) {
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
      props: { gameOver: gameOver(), competitiveScore: score({ finalScore: -1500 }) },
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
