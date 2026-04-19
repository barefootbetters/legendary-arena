import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import ParDeltaReadout from './ParDeltaReadout.vue';

test('ParDeltaReadout renders finalScore=-3 with the under-par arrow when par is present', () => {
  const wrapper = mount(ParDeltaReadout, {
    props: {
      phase: 'end',
      gameOver: {
        outcome: 'win',
        reason: 'Mastermind defeated.',
        par: {
          rawScore: 20,
          parScore: 23,
          finalScore: -3,
          scoringConfigVersion: 1,
        },
      },
    },
  });

  const value = wrapper.find('[aria-label="finalScore"]');
  assert.equal(value.exists(), true);
  assert.equal(value.text(), '-3');
  assert.match(wrapper.text(), /\u25BC/);
});

test('ParDeltaReadout renders em-dash when par key is absent from gameOver (D-6701 dominant case)', () => {
  const gameOver = {
    outcome: 'win',
    reason: 'Mastermind defeated.',
  };
  // Assert the test fixture actually demonstrates the absent form rather
  // than present-as-undefined — this is the D-6701 semantic distinction.
  assert.equal('par' in gameOver, false);

  const wrapper = mount(ParDeltaReadout, {
    props: {
      phase: 'end',
      gameOver,
    },
  });

  const value = wrapper.find('[aria-label="finalScore"]');
  assert.equal(value.exists(), true);
  assert.equal(value.text(), '\u2014');
  assert.equal(wrapper.text().includes('\u25BC'), false);
  assert.equal(wrapper.text().includes('\u25B2'), false);
});

test('ParDeltaReadout renders em-dash when gameOver is undefined (phase=play)', () => {
  const wrapper = mount(ParDeltaReadout, {
    props: {
      phase: 'play',
      gameOver: undefined,
    },
  });

  const value = wrapper.find('[aria-label="finalScore"]');
  assert.equal(value.exists(), true);
  assert.equal(value.text(), '\u2014');
});

test('ParDeltaReadout renders 0 (not em-dash) when par.finalScore === 0', () => {
  const wrapper = mount(ParDeltaReadout, {
    props: {
      phase: 'end',
      gameOver: {
        outcome: 'win',
        reason: 'Mastermind defeated exactly at par.',
        par: {
          rawScore: 20,
          parScore: 20,
          finalScore: 0,
          scoringConfigVersion: 1,
        },
      },
    },
  });

  const value = wrapper.find('[aria-label="finalScore"]');
  assert.equal(value.exists(), true);
  assert.equal(value.text(), '0');
  // Zero is neutral — no arrow icon.
  assert.equal(wrapper.text().includes('\u25BC'), false);
  assert.equal(wrapper.text().includes('\u25B2'), false);
});
