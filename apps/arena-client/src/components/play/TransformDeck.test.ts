import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import TransformDeck from './TransformDeck.vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';

/**
 * Component tests for the WP-664 / D-24475 Transform side-deck leaf.
 * The pile is display-only + hidden when empty.
 */

function makeEntry(name: string, extId: string): UIDisplayEntry {
  return {
    extId,
    display: {
      extId,
      name,
      imageUrl: `https://images.legendary-arena.com/${extId.split('/').join('-')}.webp`,
      cost: 6,
    },
  };
}

describe('TransformDeck (WP-664 / D-24475)', () => {
  test('collapses duplicate second-forms to one tile per unique card with a copy count', () => {
    // why: EC-703 (Jeff feedback) — the pile holds every copy of each second-form
    // (here 2× Hurl Trucks + 1× Like Totally Smart Hulk). The view shows ONE tile
    // per unique card with a ×N count; the header still reports the total pile size.
    const transformDeck: UIDisplayEntry[] = [
      makeEntry('Hurl Trucks', 'wwhk/she-hulk/hurl-trucks#0'),
      makeEntry('Like Totally Smart Hulk', 'wwhk/amadeus-cho/like-totally-smart-hulk#0'),
      makeEntry('Hurl Trucks', 'wwhk/she-hulk/hurl-trucks#1'),
    ];
    const wrapper = mount(TransformDeck, { props: { transformDeck } });

    const section = wrapper.find('[data-testid="play-transform-deck"]');
    assert.equal(section.exists(), true, 'the transform-deck section renders when populated');
    // header = total pile size (all copies), not the unique-card count.
    assert.match(wrapper.find('.transform-deck__header').text(), /Transform Deck \[3\]/);

    const tiles = wrapper.findAll('[data-testid="card-tile"]');
    assert.equal(tiles.length, 2, 'one CardTile per UNIQUE second-form (duplicates collapsed)');
    // first-seen order preserved; the first copy of each group supplies the tile.
    assert.equal(tiles[0]!.attributes('data-card-ext-id'), 'wwhk/she-hulk/hurl-trucks#0');
    assert.equal(tiles[0]!.attributes('title'), 'Hurl Trucks');
    assert.equal(tiles[1]!.attributes('data-card-ext-id'), 'wwhk/amadeus-cho/like-totally-smart-hulk#0');
    assert.equal(tiles[1]!.attributes('title'), 'Like Totally Smart Hulk');

    const counts = wrapper.findAll('.transform-deck__count').map((node) => node.text());
    assert.deepEqual(counts, ['×2', '×1'], 'each unique card shows its copy count');
  });

  test('renders the tiles as non-interactive (display-only pile)', () => {
    const wrapper = mount(TransformDeck, {
      props: { transformDeck: [makeEntry('Hurl Trucks', 'wwhk/she-hulk/hurl-trucks#0')] },
    });
    // why: the transform cards are not recruitable from this pile — they enter play
    // only via the engine swap, so no CardTile carries the interactive modifier.
    assert.equal(
      wrapper.find('.card-tile--interactive').exists(),
      false,
      'transform-deck tiles must not be interactive',
    );
  });

  test('is hidden entirely when the deck is empty', () => {
    const wrapper = mount(TransformDeck, { props: { transformDeck: [] } });
    assert.equal(
      wrapper.find('[data-testid="play-transform-deck"]').exists(),
      false,
      'the pile is hidden for a non-transform game (empty deck)',
    );
  });

  test('is hidden when the prop is omitted (default [])', () => {
    // why: transformDeck is optional in UIState; an older snapshot may omit it, so
    // the leaf defaults to [] and hides rather than crashing on a missing prop.
    const wrapper = mount(TransformDeck, { props: {} });
    assert.equal(wrapper.find('[data-testid="play-transform-deck"]').exists(), false);
  });
});
