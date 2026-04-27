import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import HandRow from './HandRow.vue';
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

describe('HandRow (WP-100)', () => {

test('HandRow renders one button per CardExtId in the hand', () => {
  const { submitMove } = recorder();
  const wrapper = mount(HandRow, {
    props: {
      handCards: ['cap-rogers', 'iron-man-stark', 'spider-man-parker'],
      currentStage: 'main',
      submitMove,
    },
  });

  const buttons = wrapper.findAll('[data-testid="play-hand-card"]');
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0]!.attributes('data-card-id'), 'cap-rogers');
  assert.equal(buttons[1]!.attributes('data-card-id'), 'iron-man-stark');
  assert.equal(buttons[2]!.attributes('data-card-id'), 'spider-man-parker');
});

test('HandRow click emits playCard with the card id', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(HandRow, {
    props: {
      handCards: ['cap-rogers', 'iron-man-stark'],
      currentStage: 'main',
      submitMove,
    },
  });

  const buttons = wrapper.findAll('[data-testid="play-hand-card"]');
  void buttons[1]!.trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'playCard');
  assert.deepEqual(calls[0]!.args, { cardId: 'iron-man-stark' });
});

test('HandRow disables every button when currentStage is not main', () => {
  const { submitMove } = recorder();
  for (const stage of ['start', 'cleanup'] as const) {
    const wrapper = mount(HandRow, {
      props: {
        handCards: ['a', 'b'],
        currentStage: stage,
        submitMove,
      },
    });
    const buttons = wrapper.findAll('[data-testid="play-hand-card"]');
    for (const button of buttons) {
      assert.equal(
        button.attributes('disabled'),
        '',
        `button should be disabled in stage '${stage}'`,
      );
    }
  }
});

test('HandRow renders the "Hand is empty" placeholder when handCards is empty', () => {
  const { submitMove } = recorder();
  const wrapper = mount(HandRow, {
    props: {
      handCards: [],
      currentStage: 'main',
      submitMove,
    },
  });

  const empty = wrapper.find('[data-testid="play-hand-empty"]');
  assert.equal(empty.exists(), true);
  assert.equal(empty.text(), 'Hand is empty.');
  assert.equal(wrapper.findAll('[data-testid="play-hand-card"]').length, 0);
});

});
