import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import TurnPhaseBanner from './TurnPhaseBanner.vue';

test('TurnPhaseBanner renders phase, turn, stage, and active-player labels from props', () => {
  const wrapper = mount(TurnPhaseBanner, {
    props: {
      game: {
        phase: 'play',
        turn: 3,
        activePlayerId: '0',
        currentStage: 'main',
      },
    },
  });

  assert.match(wrapper.text(), /Phase: play/);
  assert.match(wrapper.text(), /Turn 3/);
  assert.match(wrapper.text(), /Stage: main/);
  assert.match(wrapper.text(), /Active player: 0/);
});

test('TurnPhaseBanner carries aria-live="polite" on the banner region', () => {
  const wrapper = mount(TurnPhaseBanner, {
    props: {
      game: {
        phase: 'setup',
        turn: 1,
        activePlayerId: '1',
        currentStage: 'start',
      },
    },
  });

  const banner = wrapper.find('[data-testid="arena-hud-banner"]');
  assert.equal(banner.exists(), true);
  assert.equal(banner.attributes('aria-live'), 'polite');
});

test('TurnPhaseBanner exposes literal leaf-name aria-labels for every field', () => {
  const wrapper = mount(TurnPhaseBanner, {
    props: {
      game: {
        phase: 'lobby',
        turn: 0,
        activePlayerId: '',
        currentStage: 'start',
      },
    },
  });

  assert.equal(wrapper.find('[aria-label="phase"]').exists(), true);
  assert.equal(wrapper.find('[aria-label="turn"]').exists(), true);
  assert.equal(wrapper.find('[aria-label="currentStage"]').exists(), true);
  assert.equal(wrapper.find('[aria-label="activePlayerId"]').exists(), true);
});
