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
    imageUrl: `https://images.legendary-arena.com/${extId}.png`,
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

  test('WP-685: a long turn renders EVERY played card (the in-play well scrolls in-zone; never sliced)', () => {
    // why: a long turn (8-10 played cards) must not crush the City / HQ; the well
    // binds the full inPlayCards array and scrolls, so all cards render.
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const wrapper = mount(PlayedCardsRow, { props: { inPlayCards: eight } });
    assert.equal(wrapper.findAll('[data-testid="play-played-card"]').length, 8);
  });

  test('WP-685: an empty in-play well shows a "play here" target, enabled on the viewer main step', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: [], currentStage: 'main', isViewerTurn: true },
    });
    const target = wrapper.find('[data-testid="play-played-empty"]');
    assert.equal(target.exists(), true);
    assert.equal(target.attributes('data-can-play'), 'true');
  });

  test('WP-685: the empty in-play target is disabled off the main step', () => {
    // why: D-24502 lock 5 — the landing affordance is disabled off-turn / off-main.
    const wrapper = mount(PlayedCardsRow, {
      props: { inPlayCards: [], currentStage: 'start', isViewerTurn: true },
    });
    const target = wrapper.find('[data-testid="play-played-empty"]');
    assert.equal(target.attributes('data-can-play'), 'false');
    assert.equal(target.attributes('aria-disabled'), 'true');
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

describe('PlayedCardsRow — Out of Time group (WP-803 / D-24692)', () => {
  const PATRIOT = 'ca75/captain-america-1941/devoted-patriot#0';

  test('renders a labelled Out of Time group before the played cards, one tile per set-aside card', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: {
        inPlayCards: ['cap-rogers'],
        outOfTimeCards: [{ extId: PATRIOT, display: display(PATRIOT, 'Devoted Patriot', 3) }],
      },
    });
    const groups = wrapper.findAll('[data-testid="play-out-of-time"]');
    assert.equal(groups.length, 1);
    assert.match(groups[0]!.text(), /Out of Time — returns next turn/);
    const tiles = wrapper.findAll('[data-testid="play-out-of-time-card"]');
    assert.equal(tiles.length, 1);
    assert.equal(tiles[0]!.attributes('data-card-id'), PATRIOT);
    // why: the group sits inside the same well, before the played cards.
    const wellItems = wrapper.find('.played-row__cards').element.children;
    assert.equal(wellItems[0]!.getAttribute('data-testid'), 'play-out-of-time');
    assert.equal(wellItems[1]!.getAttribute('data-testid'), 'play-played-card');
  });

  test('"Played This Turn — N" counts only the cards still in play', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: {
        inPlayCards: ['cap-rogers'],
        outOfTimeCards: [{ extId: PATRIOT, display: display(PATRIOT, 'Devoted Patriot', 3) }],
      },
    });
    assert.match(wrapper.find('[data-testid="play-played-heading"]').text(), /Played This Turn — 1/);
  });

  test('shows the group (and no "play here" target) when the only card left play Out of Time', () => {
    const wrapper = mount(PlayedCardsRow, {
      props: {
        inPlayCards: [],
        outOfTimeCards: [{ extId: PATRIOT, display: display(PATRIOT, 'Devoted Patriot', 3) }],
      },
    });
    assert.equal(wrapper.find('[data-testid="play-out-of-time"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-played-empty"]').exists(), false);
  });

  test('renders no Out of Time group when nothing is set aside', () => {
    const wrapper = mount(PlayedCardsRow, { props: { inPlayCards: ['cap-rogers'] } });
    assert.equal(wrapper.find('[data-testid="play-out-of-time"]').exists(), false);
    const empty = mount(PlayedCardsRow, { props: { inPlayCards: [], outOfTimeCards: [] } });
    assert.equal(empty.find('[data-testid="play-out-of-time"]').exists(), false);
    assert.equal(empty.find('[data-testid="play-played-empty"]').exists(), true);
  });
});
