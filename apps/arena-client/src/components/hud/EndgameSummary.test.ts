import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIGameOverState } from '@legendary-arena/game-engine';
import type { MyCompetitiveScore } from '../../lib/api/competitionApi';
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
