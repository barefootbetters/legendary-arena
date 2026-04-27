import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import HQRow from './HQRow.vue';
import type {
  UIHQState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
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

const FULL_HQ: UIHQState = {
  slots: [
    'cap-rogers',
    null,
    'iron-man-stark',
    'spider-man-parker',
    null,
  ],
};

const ECONOMY_ZERO: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
};

describe('HQRow (WP-100)', () => {

test('HQRow renders one slot per hq.slots position (occupied + empty preserved)', () => {
  const { submitMove } = recorder();
  const wrapper = mount(HQRow, {
    props: {
      hq: FULL_HQ,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
  const empties = wrapper.findAll('[data-testid="play-hq-empty"]');
  assert.equal(heroes.length, 3);
  assert.equal(empties.length, 2);

  const indices = heroes.map((button) => button.attributes('data-hq-index'));
  assert.deepEqual(indices, ['0', '2', '3']);
  const emptyIndices = empties.map((slot) => slot.attributes('data-hq-index'));
  assert.deepEqual(emptyIndices, ['1', '4']);
});

test('HQRow click emits recruitHero with the positional hqIndex', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(HQRow, {
    props: {
      hq: FULL_HQ,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
  void heroes[2]!.trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'recruitHero');
  assert.deepEqual(calls[0]!.args, { hqIndex: 3 });
});

test('HQRow disables occupied buttons when currentStage is not main', () => {
  const { submitMove } = recorder();
  for (const stage of ['start', 'cleanup'] as const) {
    const wrapper = mount(HQRow, {
      props: {
        hq: FULL_HQ,
        currentStage: stage,
        economy: ECONOMY_ZERO,
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    for (const button of heroes) {
      assert.equal(
        button.attributes('disabled'),
        '',
        `button should be disabled in stage '${stage}'`,
      );
    }
  }
});

test('HQRow renders empty slots as non-interactive placeholders', () => {
  const { submitMove } = recorder();
  const wrapper = mount(HQRow, {
    props: {
      hq: FULL_HQ,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const empties = wrapper.findAll('[data-testid="play-hq-empty"]');
  for (const slot of empties) {
    assert.equal(slot.element.tagName, 'DIV');
    assert.equal(slot.text(), 'Empty slot');
  }
});

});
