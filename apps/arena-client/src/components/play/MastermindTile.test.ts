import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import MastermindTile from './MastermindTile.vue';
import type {
  UIMastermindState,
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

const MASTERMIND_LIVE: UIMastermindState = {
  id: 'doctor-doom',
  tacticsRemaining: 4,
  tacticsDefeated: 0,
};

const MASTERMIND_DEFEATED: UIMastermindState = {
  id: 'doctor-doom',
  tacticsRemaining: 0,
  tacticsDefeated: 4,
};

const ECONOMY_ZERO: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
};

describe('MastermindTile (WP-100)', () => {

test('MastermindTile click emits fightMastermind with an empty-object payload', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(MastermindTile, {
    props: {
      mastermind: MASTERMIND_LIVE,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  void wrapper.find('[data-testid="play-mastermind-button"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'fightMastermind');
  assert.deepEqual(calls[0]!.args, {});
});

test('MastermindTile is disabled when currentStage is not main', () => {
  const { submitMove } = recorder();
  for (const stage of ['start', 'cleanup'] as const) {
    const wrapper = mount(MastermindTile, {
      props: {
        mastermind: MASTERMIND_LIVE,
        currentStage: stage,
        economy: ECONOMY_ZERO,
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-mastermind-button"]');
    assert.equal(
      button.attributes('disabled'),
      '',
      `mastermind button should be disabled in stage '${stage}'`,
    );
  }
});

test('MastermindTile is disabled when tacticsRemaining is zero', () => {
  const { submitMove } = recorder();
  const wrapper = mount(MastermindTile, {
    props: {
      mastermind: MASTERMIND_DEFEATED,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const button = wrapper.find('[data-testid="play-mastermind-button"]');
  assert.equal(button.attributes('disabled'), '');
});

test('MastermindTile renders the mastermind id and tactics-remaining status', () => {
  const { submitMove } = recorder();
  const wrapper = mount(MastermindTile, {
    props: {
      mastermind: MASTERMIND_LIVE,
      currentStage: 'main',
      economy: ECONOMY_ZERO,
      submitMove,
    },
  });

  const text = wrapper.find('[data-testid="play-mastermind-button"]').text();
  assert.equal(text.includes('doctor-doom'), true);
  assert.equal(text.includes('Tactics remaining: 4'), true);
});

});
