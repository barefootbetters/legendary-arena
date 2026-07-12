import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import SchemeTile from './SchemeTile.vue';
import type { UISchemeState } from '@legendary-arena/game-engine';

function scheme(over: Partial<UISchemeState> = {}): UISchemeState {
  return {
    id: 'core/capture-five-bystanders',
    twistCount: 2,
    twistPile: [],
    gameText: [
      'Twist: the Mastermind captures a Bystander.',
      'Evil wins if five Bystanders are captured.',
    ],
    ...over,
  };
}

describe('SchemeTile', () => {
  test('renders the twist progress fraction', () => {
    const wrapper = mount(SchemeTile, {
      props: { scheme: scheme(), twistThreshold: 8 },
    });
    assert.match(
      wrapper.find('[data-testid="play-scheme-twist-progress"]').text(),
      /Twists: 2\/8/,
    );
  });

  test('does NOT render scheme rules text inline (moved to the reader modal)', () => {
    const wrapper = mount(SchemeTile, {
      props: { scheme: scheme(), twistThreshold: 8 },
    });
    assert.equal(wrapper.find('[data-testid="play-scheme-game-text"]').exists(), false);
  });

  test('Read card button emits read with the scheme display and gameText', () => {
    const wrapper = mount(SchemeTile, {
      props: { scheme: scheme(), twistThreshold: 8 },
    });
    void wrapper.find('[data-testid="play-scheme-read"]').trigger('click');
    const emitted = wrapper.emitted('read');
    assert.ok(emitted, 'expected a read event');
    assert.equal(emitted!.length, 1);
    const payload = emitted![0]![0] as {
      title: string;
      gameText: readonly string[];
    };
    assert.equal(payload.gameText.length, 2);
    assert.match(payload.gameText[1]!, /Evil wins/);
  });

  test('emits read with empty gameText when the scheme has no rules text', () => {
    const wrapper = mount(SchemeTile, {
      props: { scheme: scheme({ gameText: [] }), twistThreshold: 8 },
    });
    void wrapper.find('[data-testid="play-scheme-read"]').trigger('click');
    const payload = wrapper.emitted('read')![0]![0] as { gameText: readonly string[] };
    assert.equal(payload.gameText.length, 0);
  });
});
