import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import FinalTurnBanner from './FinalTurnBanner.vue';

test('FinalTurnBanner renders the reason and both deck-remaining counts when finalTurn is provided', () => {
  const wrapper = mount(FinalTurnBanner, {
    props: {
      finalTurn: {
        reason: 'The villain deck is empty.',
        heroDeckRemaining: 4,
        villainDeckRemaining: 0,
      },
    },
  });

  const banner = wrapper.find('[data-testid="arena-hud-final-turn"]');
  assert.equal(banner.exists(), true);
  assert.match(wrapper.text(), /Final turn/i);
  assert.match(wrapper.text(), /The villain deck is empty\./);
  assert.match(wrapper.text(), /Hero deck: 4/);
  assert.match(wrapper.text(), /Villain deck: 0/);
});

test('FinalTurnBanner renders nothing when finalTurn is undefined', () => {
  const wrapper = mount(FinalTurnBanner, {
    props: {
      finalTurn: undefined,
    },
  });

  assert.equal(wrapper.find('[data-testid="arena-hud-final-turn"]').exists(), false);
  // The v-if is on the root element, so the component emits no markup at all.
  assert.equal(wrapper.text(), '');
});

test('FinalTurnBanner carries role="alert" and aria-live="assertive" on the banner region', () => {
  const wrapper = mount(FinalTurnBanner, {
    props: {
      finalTurn: {
        reason: 'The hero deck is empty.',
        heroDeckRemaining: 0,
        villainDeckRemaining: 7,
      },
    },
  });

  const banner = wrapper.find('[data-testid="arena-hud-final-turn"]');
  assert.equal(banner.exists(), true);
  assert.equal(banner.attributes('role'), 'alert');
  assert.equal(banner.attributes('aria-live'), 'assertive');
});
