import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import EndGameControl from './EndGameControl.vue';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

// Jeff feedback (WP-502 / D-24306 behaviour) — the "End Game for everyone" escape
// hatch moved out of TurnActionBar into the top ribbon. Two-click confirm →
// endMatchEarly; shown only on the viewer's turn.
describe('EndGameControl (End Game escape hatch — two-click confirm → endMatchEarly)', () => {
  test('requires a confirm: the first click emits nothing, only reveals the prompt', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(EndGameControl, {
      props: { isViewerTurn: true, submitMove },
    });
    await wrapper.find('[data-testid="play-action-end-game"]').trigger('click');
    assert.equal(calls.length, 0, 'the first click must not end the match');
    assert.equal(
      wrapper.find('[data-testid="play-action-end-game-confirm"]').exists(),
      true,
      'the confirm button must appear after the first click',
    );
  });

  test('confirm emits endMatchEarly with an empty payload', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(EndGameControl, {
      props: { isViewerTurn: true, submitMove },
    });
    await wrapper.find('[data-testid="play-action-end-game"]').trigger('click');
    await wrapper.find('[data-testid="play-action-end-game-confirm"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'endMatchEarly');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('cancel dismisses the prompt without emitting', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(EndGameControl, {
      props: { isViewerTurn: true, submitMove },
    });
    await wrapper.find('[data-testid="play-action-end-game"]').trigger('click');
    await wrapper.find('[data-testid="play-action-end-game-cancel"]').trigger('click');
    assert.equal(calls.length, 0, 'cancel must not end the match');
    assert.equal(
      wrapper.find('[data-testid="play-action-end-game-confirm"]').exists(),
      false,
      'the confirm prompt must be dismissed',
    );
    assert.equal(
      wrapper.find('[data-testid="play-action-end-game"]').exists(),
      true,
      'the End Game button returns after cancel',
    );
  });

  test('confirm re-arms to the safe state when the turn passes and returns', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(EndGameControl, {
      props: { isViewerTurn: true, submitMove },
    });
    await wrapper.find('[data-testid="play-action-end-game"]').trigger('click');
    assert.equal(
      wrapper.find('[data-testid="play-action-end-game-confirm"]').exists(),
      true,
      'precondition: the confirm is armed on the viewer’s turn',
    );
    // the turn passes to another player, then returns to the viewer
    await wrapper.setProps({ isViewerTurn: false });
    await wrapper.setProps({ isViewerTurn: true });
    assert.equal(
      wrapper.find('[data-testid="play-action-end-game-confirm"]').exists(),
      false,
      'the armed confirm must NOT survive to the next turn (no pre-armed single-click end)',
    );
    assert.equal(wrapper.find('[data-testid="play-action-end-game"]').exists(), true);
    assert.equal(calls.length, 0);
  });

  test('is hidden when it is not the viewer’s turn', () => {
    const { submitMove } = recorder();
    const wrapper = mount(EndGameControl, {
      props: { isViewerTurn: false, submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-end-game"]').exists(),
      false,
      'only the active player may end the match (boardgame.io gates the move)',
    );
  });
});
