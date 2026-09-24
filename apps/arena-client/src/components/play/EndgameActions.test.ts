import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import EndgameActions from './EndgameActions.vue';

/** Records handler invocations so click wiring can be asserted. */
function noopRecorder(): { calls: number; handler: () => void } {
  const state = { calls: 0, handler: () => {} };
  state.handler = () => {
    state.calls += 1;
  };
  return state;
}

const baseProps = {
  visible: true,
  endedEarly: false,
  canPlayAgain: true,
  isRelaunching: false,
  errorMessage: '',
  onPlayAgain: () => {},
  onReturnToLobby: () => {},
};

describe('EndgameActions (WP-502 / D-24306)', () => {
  test('renders nothing until the match is over', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, visible: false },
    });
    assert.equal(wrapper.find('[data-testid="play-endgame-actions"]').exists(), false);
  });

  test('labels a natural finish "Match over" and an early end "Match ended early"', () => {
    const over = mount(EndgameActions, { props: { ...baseProps } });
    assert.match(over.find('.endgame-actions__title').text(), /Match over/);

    const early = mount(EndgameActions, { props: { ...baseProps, endedEarly: true } });
    assert.match(early.find('.endgame-actions__title').text(), /Match ended early/);
  });

  test('Play Again shows only when eligible and invokes the handler', async () => {
    const playAgain = noopRecorder();
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, canPlayAgain: true, onPlayAgain: playAgain.handler },
    });
    const button = wrapper.find('[data-testid="play-action-play-again"]');
    assert.equal(button.exists(), true);
    await button.trigger('click');
    assert.equal(playAgain.calls, 1);
  });

  test('Play Again is hidden when the viewer cannot relaunch (guest / no stashed loadout)', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, canPlayAgain: false },
    });
    assert.equal(wrapper.find('[data-testid="play-action-play-again"]').exists(), false);
    // Back to Lobby is still offered.
    assert.equal(wrapper.find('[data-testid="play-action-return-lobby"]').exists(), true);
  });

  test('Play Again is disabled while a relaunch is in flight', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, isRelaunching: true },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-play-again"]').attributes('disabled'),
      '',
    );
  });

  test('Back to Lobby invokes its handler', async () => {
    const lobby = noopRecorder();
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, onReturnToLobby: lobby.handler },
    });
    await wrapper.find('[data-testid="play-action-return-lobby"]').trigger('click');
    assert.equal(lobby.calls, 1);
  });

  test('a launch error message is surfaced', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, errorMessage: 'Failed to create and join the match.' },
    });
    assert.match(
      wrapper.find('[data-testid="play-endgame-actions-error"]').text(),
      /Failed to create and join/,
    );
  });

  // why: INFRA (endgame banner overlap) — the score-submission status renders inside
  // this panel, not as a separate fixed toast that collided with the audio controls.
  test('renders the score-submission status line inside the panel with its variant', () => {
    const wrapper = mount(EndgameActions, {
      props: {
        ...baseProps,
        endedEarly: true,
        statusMessage: 'This match ended early, so it isn’t scored to the leaderboard.',
        statusVariant: 'ended-early',
      },
    });
    const panel = wrapper.find('[data-testid="play-endgame-actions"]');
    const status = panel.find('[data-testid="score-submission-status"]');
    assert.ok(status.exists(), 'the status line renders inside the panel');
    assert.equal(status.attributes('role'), 'status');
    assert.ok(status.classes().includes('endgame-actions__status--ended-early'));
    assert.match(status.text(), /ended early/);
  });

  test('renders no status line when the message is empty (idle / guest)', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, statusMessage: '', statusVariant: 'guest' },
    });
    assert.equal(wrapper.find('[data-testid="score-submission-status"]').exists(), false);
  });

  test('the status line hides with the panel before the match is over', () => {
    const wrapper = mount(EndgameActions, {
      props: { ...baseProps, visible: false, statusMessage: 'Submitting your score…', statusVariant: 'submitting' },
    });
    assert.equal(wrapper.find('[data-testid="score-submission-status"]').exists(), false);
  });
});
