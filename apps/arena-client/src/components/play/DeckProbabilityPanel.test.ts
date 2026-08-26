import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type {
  UIDecksState,
  UIDeckCardStat,
  UIState,
} from '@legendary-arena/game-engine';
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
  ownDiscard?: string[];
  ownStats?: Record<string, UIDeckCardStat>;
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
  const touchesViewer =
    overrides.ownDeck !== undefined ||
    overrides.ownDiscard !== undefined ||
    overrides.ownStats !== undefined;
  if (touchesViewer) {
    players = base.players.map((player) => {
      if (player.handCards === undefined) {
        return player;
      }
      const next = { ...player };
      if (overrides.ownDeck !== undefined) {
        next.deckComposition = overrides.ownDeck;
      }
      if (overrides.ownDiscard !== undefined) {
        next.discardCards = overrides.ownDiscard;
      }
      if (overrides.ownStats !== undefined) {
        next.deckCardStats = overrides.ownStats;
      }
      return next;
    });
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

test('DeckProbabilityPanel shows the two-stage Next-hand projection', async () => {
  setActivePinia(createPinia());
  // Short deck: two 10-attack cards are CERTAIN this hand (drawn before the
  // discard reshuffles in) → expected attack 20, not the ~17.1 a single-pool
  // draw of six from seven would give. The all-certain deck makes the sampled
  // range degenerate (20–20), so the assertion is stable, not flaky.
  useUiStateStore().setSnapshot(
    snapshotWith({
      ownDeck: ['strong', 'strong'],
      ownDiscard: ['blank', 'blank', 'blank', 'blank', 'blank'],
      ownStats: {
        strong: { recruit: 0, attack: 10, cost: 0 },
        blank: { recruit: 0, attack: 0, cost: 0 },
      },
    }),
  );
  const wrapper = mount(DeckProbabilityPanel);
  // Collapsed by default → the section is not rendered yet.
  assert.equal(
    wrapper.find('[data-testid="hand-projection-section"]').exists(),
    false,
  );

  await wrapper.find('[data-testid="deck-probability-toggle"]').trigger('click');

  assert.equal(
    wrapper.find('[data-testid="hand-projection-section"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="hand-projection-attack-ev"]').text(),
    '~20.0',
  );
  assert.equal(
    wrapper.find('[data-testid="hand-projection-recruit-ev"]').text(),
    '~0.0',
  );
  // Both tens always drawn, discard contributes 0 → a degenerate 20–20 band.
  assert.equal(
    wrapper.find('[data-testid="hand-projection-attack-range"]').text(),
    '20–20',
  );
});

test('DeckProbabilityPanel hides Next hand when deckCardStats is absent', async () => {
  setActivePinia(createPinia());
  // deckComposition present but no stats map → the projection cannot be built,
  // so the section self-hides (while the own-deck total still renders).
  useUiStateStore().setSnapshot(snapshotWith({ ownDeck: ['a', 'b', 'c'] }));
  const wrapper = mount(DeckProbabilityPanel);
  await wrapper.find('[data-testid="deck-probability-toggle"]').trigger('click');
  assert.equal(wrapper.find('[data-testid="own-deck-total"]').text(), '3');
  assert.equal(
    wrapper.find('[data-testid="hand-projection-section"]').exists(),
    false,
  );
});
