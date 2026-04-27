import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import CityRow from './CityRow.vue';
import type {
  UICityState,
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

const FULL_CITY: UICityState = {
  spaces: [
    { extId: 'doom-bot', type: 'villain', keywords: [] },
    null,
    { extId: 'electro', type: 'villain', keywords: ['guard'] },
    null,
    { extId: 'thug', type: 'henchman', keywords: [] },
  ],
};

const ECONOMY_ZERO: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
};

describe('CityRow (WP-100)', () => {

test('CityRow renders one slot per city.spaces position (occupied + empty preserved)', () => {
  const { submitMove } = recorder();
  const wrapper = mount(CityRow, {
    props: {
      city: FULL_CITY,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const villains = wrapper.findAll('[data-testid="play-city-villain"]');
  const empties = wrapper.findAll('[data-testid="play-city-empty"]');
  assert.equal(villains.length, 3);
  assert.equal(empties.length, 2);

  const indices = villains.map((button) => button.attributes('data-city-index'));
  assert.deepEqual(indices, ['0', '2', '4']);
  const emptyIndices = empties.map((slot) => slot.attributes('data-city-index'));
  assert.deepEqual(emptyIndices, ['1', '3']);
});

test('CityRow click emits fightVillain with the positional cityIndex', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(CityRow, {
    props: {
      city: FULL_CITY,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const villains = wrapper.findAll('[data-testid="play-city-villain"]');
  void villains[1]!.trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'fightVillain');
  assert.deepEqual(calls[0]!.args, { cityIndex: 2 });
});

test('CityRow disables occupied buttons when currentStage is not main', () => {
  const { submitMove } = recorder();
  for (const stage of ['start', 'cleanup'] as const) {
    const wrapper = mount(CityRow, {
      props: {
        city: FULL_CITY,
        currentStage: stage,
        economy: ECONOMY_ZERO,
        submitMove,
      },
    });
    const villains = wrapper.findAll('[data-testid="play-city-villain"]');
    for (const button of villains) {
      assert.equal(
        button.attributes('disabled'),
        '',
        `button should be disabled in stage '${stage}'`,
      );
    }
  }
});

test('CityRow renders empty slots as non-interactive placeholders', () => {
  const { submitMove } = recorder();
  const wrapper = mount(CityRow, {
    props: {
      city: FULL_CITY,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const empties = wrapper.findAll('[data-testid="play-city-empty"]');
  for (const slot of empties) {
    assert.equal(slot.element.tagName, 'DIV');
    assert.equal(slot.text(), 'Empty slot');
  }
});

});
