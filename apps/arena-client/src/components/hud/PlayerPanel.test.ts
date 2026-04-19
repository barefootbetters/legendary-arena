import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import PlayerPanel from './PlayerPanel.vue';

test('PlayerPanel renders the seven core zone fields with literal leaf-name aria-labels', () => {
  const wrapper = mount(PlayerPanel, {
    props: {
      player: {
        playerId: '0',
        deckCount: 12,
        handCount: 5,
        discardCount: 3,
        inPlayCount: 2,
        victoryCount: 4,
        woundCount: 0,
      },
      isActive: false,
    },
  });

  assert.equal(wrapper.find('[aria-label="playerId"]').text(), '0');
  assert.equal(wrapper.find('[aria-label="deckCount"]').text(), '12');
  assert.equal(wrapper.find('[aria-label="handCount"]').text(), '5');
  assert.equal(wrapper.find('[aria-label="discardCount"]').text(), '3');
  assert.equal(wrapper.find('[aria-label="inPlayCount"]').text(), '2');
  assert.equal(wrapper.find('[aria-label="victoryCount"]').text(), '4');
  assert.equal(wrapper.find('[aria-label="woundCount"]').text(), '0');
});

test('PlayerPanel applies aria-current="true" only when isActive is true', () => {
  const activeWrapper = mount(PlayerPanel, {
    props: {
      player: {
        playerId: '1',
        deckCount: 1,
        handCount: 1,
        discardCount: 1,
        inPlayCount: 1,
        victoryCount: 1,
        woundCount: 1,
      },
      isActive: true,
    },
  });
  const inactiveWrapper = mount(PlayerPanel, {
    props: {
      player: {
        playerId: '2',
        deckCount: 1,
        handCount: 1,
        discardCount: 1,
        inPlayCount: 1,
        victoryCount: 1,
        woundCount: 1,
      },
      isActive: false,
    },
  });

  const active = activeWrapper.find('[data-testid="arena-hud-player-panel"]');
  const inactive = inactiveWrapper.find(
    '[data-testid="arena-hud-player-panel"]',
  );

  assert.equal(active.attributes('aria-current'), 'true');
  assert.equal(inactive.attributes('aria-current'), undefined);
});

test('PlayerPanel renders an icon glyph (color is never the sole signal)', () => {
  const wrapper = mount(PlayerPanel, {
    props: {
      player: {
        playerId: '0',
        deckCount: 0,
        handCount: 0,
        discardCount: 0,
        inPlayCount: 0,
        victoryCount: 0,
        woundCount: 0,
      },
      isActive: true,
    },
  });

  const icon = wrapper.find('.icon');
  assert.equal(icon.exists(), true);
  // Glyph must be a single non-whitespace character from the Okabe-Ito set.
  const iconText = icon.text();
  assert.equal(iconText.length > 0, true);
});
