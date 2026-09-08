import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import PlaymatBackground from './PlaymatBackground.vue';

/**
 * WP-666 — PlaymatBackground is a purely presentational fixed layer. jsdom does
 * not compute layout from scoped CSS (position/z-index/pointer-events are not
 * reflected in computed style), so these tests assert the DOM + accessibility
 * contract the component guarantees; the actual painting is verified live on
 * play.legendary-arena.com per the D-24026 gate.
 */
describe('WP-666 components/play/PlaymatBackground', () => {
  test('renders the background layer element', () => {
    const wrapper = mount(PlaymatBackground);
    const layer = wrapper.find('[data-testid="playmat-background"]');
    assert.equal(layer.exists(), true);
    assert.equal(layer.element.classList.contains('playmat-background'), true);
    wrapper.unmount();
  });

  test('always renders the mandatory legibility scrim child', () => {
    const wrapper = mount(PlaymatBackground);
    const scrim = wrapper.find('[data-testid="playmat-background-scrim"]');
    assert.equal(scrim.exists(), true, 'the scrim is mandatory — a mat with no scrim is a FAIL');
    wrapper.unmount();
  });

  test('is inert to assistive tech (aria-hidden) so it is skipped by screen readers', () => {
    const wrapper = mount(PlaymatBackground);
    const layer = wrapper.find('[data-testid="playmat-background"]');
    assert.equal(layer.attributes('aria-hidden'), 'true');
    wrapper.unmount();
  });

  test('renders without any skin variable set (no broken-image / no crash)', () => {
    // With no --skin-board-image inherited, the layer still mounts and paints
    // its palette-ground + scrim fallback rather than a broken-image box.
    const wrapper = mount(PlaymatBackground);
    assert.equal(wrapper.find('[data-testid="playmat-background"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="playmat-background-scrim"]').exists(), true);
    wrapper.unmount();
  });
});
