import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { UIDecksState, UIState } from '@legendary-arena/game-engine';
import DeckProbabilityPanel from './DeckProbabilityPanel.vue';
import { useUiStateStore } from '../../stores/uiState';
import { loadUiStateFixture } from '../../fixtures/uiState/index';

/**
 * Builds a snapshot from the mid-turn fixture with the WP-606 fields under test
 * controlled explicitly: `decks` is rebuilt from its counts (dropping any
 * pre-existing villainDeckComposition), and the viewer's deckComposition is set
 * only when `ownDeck` is given. Spreads the fixture so the shared singleton is
 * never mutated.
 */
function snapshotWith(overrides: {
  villain?: string[];
  ownDeck?: string[];
}): UIState {
  const base = loadUiStateFixture('mid-turn');
  const decks: UIDecksState = {
    villainDeckCount: base.decks.villainDeckCount,
    heroDeckCount: base.decks.heroDeckCount,
  };
  if (overrides.villain !== undefined) {
    decks.villainDeckComposition = overrides.villain;
  }
  let players = base.players;
  if (overrides.ownDeck !== undefined) {
    const ownDeck = overrides.ownDeck;
    players = base.players.map((player) =>
      player.handCards !== undefined
        ? { ...player, deckComposition: ownDeck }
        : player,
    );
  }
  return { ...base, decks, players };
}

test('DeckProbabilityPanel shows the villain upcoming-risk rows when expanded', async () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(
    snapshotWith({
      villain: [
        'master-strike-00',
        'master-strike-01',
        'scheme-twist-x-00',
        'bystander-villain-deck-00',
        'core-villain-z-a-00',
      ],
    }),
  );
  const wrapper = mount(DeckProbabilityPanel);
  assert.equal(
    wrapper.find('[data-testid="deck-probability-panel"]').exists(),
    true,
  );
  // Collapsed by default → the rows are not rendered yet.
  assert.equal(wrapper.find('[data-testid="villain-row"]').exists(), false);

  await wrapper.find('[data-testid="deck-probability-toggle"]').trigger('click');

  const rows = wrapper.findAll('[data-testid="villain-row"]');
  // Four non-zero types: Master Strike, Scheme Twist, Bystander, Villain.
  assert.equal(rows.length, 4);
  // First row = Master Strike, count 2, 2/5 = 40%.
  assert.equal(
    rows[0]?.find('[data-testid="villain-row-label"]').text(),
    'Master Strike',
  );
  assert.equal(rows[0]?.find('[data-testid="villain-row-count"]').text(), '2');
  assert.equal(rows[0]?.find('[data-testid="villain-row-odds"]').text(), '40%');
});

test('DeckProbabilityPanel shows the own draw-pool total when deckComposition is present', async () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(snapshotWith({ ownDeck: ['a', 'b', 'c', 'd'] }));
  const wrapper = mount(DeckProbabilityPanel);
  await wrapper.find('[data-testid="deck-probability-toggle"]').trigger('click');
  assert.equal(wrapper.find('[data-testid="own-deck-total"]').text(), '4');
});

test('DeckProbabilityPanel renders nothing when neither field is present', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(snapshotWith({}));
  const wrapper = mount(DeckProbabilityPanel);
  assert.equal(
    wrapper.find('[data-testid="deck-probability-panel"]').exists(),
    false,
  );
});

test('DeckProbabilityPanel renders nothing when the snapshot is null', () => {
  setActivePinia(createPinia());
  const wrapper = mount(DeckProbabilityPanel);
  assert.equal(
    wrapper.find('[data-testid="deck-probability-panel"]').exists(),
    false,
  );
});
