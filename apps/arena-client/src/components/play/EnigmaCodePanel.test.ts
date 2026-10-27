/**
 * Tests for the Enigma Code readout (WP-830 / D-24763): a card the viewer may see shows its name
 * and colors; any other shows "?"; who has looked is shown.
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIEnigmaCodeState } from '@legendary-arena/game-engine';

import EnigmaCodePanel from './EnigmaCodePanel.vue';

const CODE: UIEnigmaCodeState = {
  isRevealed: false,
  cards: [
    { peekedBy: ['0'], display: { extId: 'ca75/winter-soldier/x#1', name: 'Seen Card', imageUrl: '', cost: 3 }, colors: ['tech', 'covert'] },
    { peekedBy: ['1'] },
    { peekedBy: [] },
  ],
};

describe('EnigmaCodePanel (WP-830)', () => {
  test('renders one compact box per card: the seen card colored and named in its title', () => {
    const wrapper = mount(EnigmaCodePanel, { props: { enigmaCode: CODE } });
    assert.match(wrapper.find('[data-testid="play-enigma-code"]').text(), /Enigma Code \(3\)/);
    assert.equal(wrapper.find('[data-testid="play-enigma-card-0"] [data-testid="play-enigma-card-colors"]').text(), 'Tech / Covert');
    assert.equal(wrapper.find('[data-testid="play-enigma-card-0"]').attributes('title'), 'Seen Card (Tech / Covert). Seen by Player 0');
    assert.match(wrapper.find('[data-testid="play-enigma-card-2"]').text(), /\?/);
    assert.equal(wrapper.find('[data-testid="play-enigma-card-2"]').attributes('title'), 'Face down');
  });

  test('shows who has looked at an unseen card, never the card', () => {
    const wrapper = mount(EnigmaCodePanel, { props: { enigmaCode: CODE } });
    assert.equal(wrapper.find('[data-testid="play-enigma-card-1"] [data-testid="play-enigma-card-seen"]').text(), 'P1');
    assert.equal(wrapper.find('[data-testid="play-enigma-card-1"]').attributes('title'), 'Face down. Seen by Player 1');
  });

  test('says when the code is revealed', () => {
    const wrapper = mount(EnigmaCodePanel, { props: { enigmaCode: { ...CODE, isRevealed: true } } });
    assert.match(wrapper.find('[data-testid="play-enigma-code"]').text(), /revealed/);
  });
});
