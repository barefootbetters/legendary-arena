import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import YourVictoryPile from './YourVictoryPile.vue';

function entry(extId: string): UIDisplayEntry {
  return {
    extId,
    display: {
      extId,
      name: extId,
      imageUrl: `https://images.legendary-arena.com/${extId}.png`,
      cost: null,
    },
  };
}

describe('YourVictoryPile (WP-129)', () => {
  test('renders count + VP from props', () => {
    const wrapper = mount(YourVictoryPile, {
      props: {
        victoryCards: [entry('doom'), entry('mystique')],
        victoryVp: 14,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-your-victory-count"]').text(), '2 cards');
    assert.equal(wrapper.find('[data-testid="play-your-victory-vp"]').text(), '14 VP');
  });

  test('renders empty placeholder (no browse button) when victoryCards is empty', () => {
    const wrapper = mount(YourVictoryPile, {
      props: { victoryCards: [], victoryVp: 0 },
    });
    assert.equal(wrapper.find('[data-testid="play-your-victory-empty"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-your-victory-browse"]').exists(), false);
  });

  test('renders a "View all (N)" browse button instead of an inline list when non-empty', () => {
    // why: the pile is collapsed behind PileBrowseModal so it does not grow
    // the mat vertically as victory cards accumulate — the full list must NOT
    // render inline.
    const wrapper = mount(YourVictoryPile, {
      props: { victoryCards: [entry('doom'), entry('mystique')], victoryVp: 14 },
    });
    const browse = wrapper.find('[data-testid="play-your-victory-browse"]');
    assert.equal(browse.exists(), true);
    assert.match(browse.text(), /View all \(2\)/);
    assert.equal(wrapper.find('[data-testid="play-your-victory-list"]').exists(), false);
  });

  test('clicking browse emits open with the Your Victory Pile label and card entries', () => {
    const cards = [entry('doom'), entry('mystique')];
    const wrapper = mount(YourVictoryPile, {
      props: { victoryCards: cards, victoryVp: 14 },
    });
    void wrapper.find('[data-testid="play-your-victory-browse"]').trigger('click');
    const emitted = wrapper.emitted('open');
    assert.ok(emitted, 'expected an open event');
    assert.equal(emitted!.length, 1);
    const payload = emitted![0]![0] as { pileLabel: string; cards: unknown[] };
    assert.equal(payload.pileLabel, 'Your Victory Pile');
    assert.equal(payload.cards.length, 2);
  });

  test('composition counters bin entries via prefix heuristic', () => {
    const wrapper = mount(YourVictoryPile, {
      props: {
        victoryCards: [
          entry('bystander-civilian-1'),
          entry('bystander-civilian-2'),
          entry('henchman-doombot-1'),
          entry('mastermind-doom-tactic-1'),
          entry('doom-himself'),
          entry('wound'),
        ],
        victoryVp: 18,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-victory-bystanders"]').text(), '2');
    assert.equal(wrapper.find('[data-testid="play-victory-henchmen"]').text(), '1');
    assert.equal(wrapper.find('[data-testid="play-victory-mastermind"]').text(), '1');
    assert.equal(wrapper.find('[data-testid="play-victory-villains"]').text(), '1');
    assert.equal(wrapper.find('[data-testid="play-victory-wounds"]').text(), '1');
  });

  test('all-zero counters render when victoryCards default to empty array', () => {
    const wrapper = mount(YourVictoryPile, {
      props: {},
    });
    assert.equal(wrapper.find('[data-testid="play-victory-bystanders"]').text(), '0');
    assert.equal(wrapper.find('[data-testid="play-victory-villains"]').text(), '0');
  });
});

describe('YourVictoryPile — Effects triggered line (WP-848 / D-24784)', () => {
  test('renders 3 / 5 (60%) for played 5 / assembled 3', () => {
    const wrapper = mount(YourVictoryPile, {
      props: { conditionalClausesPlayed: 5, conditionalClausesAssembled: 3 },
    });
    assert.equal(wrapper.find('[data-testid="play-your-victory-effects"]').text(), 'Effects triggered: 3 / 5 (60%)');
  });

  test('rounds the percentage: 2 / 3 renders 67%', () => {
    const wrapper = mount(YourVictoryPile, {
      props: { conditionalClausesPlayed: 3, conditionalClausesAssembled: 2 },
    });
    assert.equal(wrapper.find('[data-testid="play-your-victory-effects"]').text(), 'Effects triggered: 2 / 3 (67%)');
  });

  test('renders 0 / 0 with no percentage when nothing has been played', () => {
    const wrapper = mount(YourVictoryPile, { props: {} });
    const text = wrapper.find('[data-testid="play-your-victory-effects"]').text();
    assert.equal(text, 'Effects triggered: 0 / 0');
    assert.equal(text.includes('%'), false, 'no percentage at played 0');
  });

  test('the line never uses the internal-vocabulary words', () => {
    // why: DESIGN-SYNERGY-REALIZATION two-vocabulary rule — player copy never says these.
    const forbiddenWords = ['whiff', 'failed', 'missed', 'wasted', 'error'];
    for (const [played, assembled] of [[0, 0], [5, 0], [5, 3], [4, 4]] as const) {
      const wrapper = mount(YourVictoryPile, {
        props: { conditionalClausesPlayed: played, conditionalClausesAssembled: assembled },
      });
      const text = wrapper.find('[data-testid="play-your-victory-effects"]').text().toLowerCase();
      for (const word of forbiddenWords) {
        assert.equal(text.includes(word), false, `"${text}" must not contain "${word}"`);
      }
    }
  });
});
