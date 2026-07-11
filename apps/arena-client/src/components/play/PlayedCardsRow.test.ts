import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import PlayedCardsRow from './PlayedCardsRow.vue';
import type { UICardDisplay } from '@legendary-arena/game-engine';

function display(extId: string, name: string, cost: number | null = null): UICardDisplay {
  return {
    extId,
    name,
    imageUrl: `https://images.barefootbetters.com/${extId}.png`,
    cost,
  };
}

describe('PlayedCardsRow', () => {
  test('renders the visible zone heading with the played-card count', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: ['cap-rogers', 'iron-man-stark'] },
    });
    const heading = wrapper.find('[data-testid="play-played-heading"]');
    assert.equal(heading.exists(), true);
    assert.match(heading.text(), /Played This Turn/);
    assert.match(heading.text(), /2/);
  });

  test('renders one tile per CardExtId in play', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: ['cap-rogers', 'iron-man-stark', 'spider-man-parker'] },
    });
    const cards = wrapper.findAll('[data-testid="play-played-card"]');
    assert.equal(cards.length, 3);
    assert.equal(cards[0]!.attributes('data-card-id'), 'cap-rogers');
  });

  test('uses inPlayDisplay names when provided (WP-128 parallel array)', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: {
        inPlayCards: ['cap-rogers', 'iron-man-stark'],
        inPlayDisplay: [
          display('cap-rogers', 'Captain America'),
          display('iron-man-stark', 'Iron Man'),
        ],
      },
    });
    const tiles = wrapper.findAll('[data-testid="card-tile"]');
    assert.equal(tiles.length, 2);
    assert.equal(tiles[0]!.attributes('title'), 'Captain America');
    assert.equal(tiles[1]!.attributes('title'), 'Iron Man');
  });

  test('falls back to humanized cardId when inPlayDisplay is missing', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: ['starting-shield-agent'] },
    });
    assert.equal(
      wrapper.find('[data-testid="play-played-card"]').text(),
      'starting shield agent',
    );
  });

  test('renders no play buttons — played cards are not clickable', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: ['cap-rogers'] },
    });
    assert.equal(wrapper.findAll('button').length, 0);
  });

  test('renders empty placeholder when no cards have been played', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: [] },
    });
    assert.equal(wrapper.find('[data-testid="play-played-empty"]').exists(), true);
    assert.equal(wrapper.findAll('[data-testid="play-played-card"]').length, 0);
  });
});
