import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import SkinSelector from './SkinSelector.vue';
import { usePlaymat } from '../../prefs/playmatStore';
import { skinManifest } from '../../prefs/skinManifest';

describe('WP-130 components/play/SkinSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    Array.from(document.querySelectorAll('[data-testid="play-hud-skin-selector-overlay"]')).forEach(
      (node) => node.remove(),
    );
  });

  test('renders the trigger button with the active skin displayLabel and chevron (WP-666)', () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    const button = wrapper.find('[data-testid="play-hud-skin-selector-button"]');
    assert.equal(button.exists(), true);
    // WP-666: the button shows the human-readable displayLabel ("Classic"), not the raw key.
    assert.match(button.text(), /Skin: Classic ▼/);
    wrapper.unmount();
  });

  test('overlay options render the manifest displayLabel, not the raw key (WP-666)', async () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    await wrapper.find('[data-testid="play-hud-skin-selector-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    const midtownOption = document.querySelector(
      '[data-testid="play-hud-skin-option-midtown"]',
    ) as HTMLElement;
    assert.ok(midtownOption !== null, 'the midtown named-mat option should render');
    assert.equal(midtownOption.textContent?.trim(), skinManifest.midtown.displayLabel);
    assert.equal(midtownOption.textContent?.trim(), 'Midtown Skyline');
    wrapper.unmount();
  });

  test('overlay is closed by default', () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    assert.equal(document.querySelector('[data-testid="play-hud-skin-selector-overlay"]'), null);
    wrapper.unmount();
  });

  test('clicking the trigger opens the overlay and lists every available skin', async () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    await wrapper.find('[data-testid="play-hud-skin-selector-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    const overlay = document.querySelector('[data-testid="play-hud-skin-selector-overlay"]');
    assert.ok(overlay !== null, 'overlay should be teleported into document.body when open');
    for (const name of Object.keys(skinManifest)) {
      assert.ok(
        document.querySelector(`[data-testid="play-hud-skin-option-${name}"]`) !== null,
        `option button for ${name} should render in the overlay`,
      );
    }
    wrapper.unmount();
  });

  test('clicking an option fires setActiveSkin and closes the overlay', async () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    await wrapper.find('[data-testid="play-hud-skin-selector-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    const comicOption = document.querySelector('[data-testid="play-hud-skin-option-comic"]') as HTMLElement;
    assert.ok(comicOption !== null);
    comicOption.click();
    await wrapper.vm.$nextTick();
    const playmat = usePlaymat();
    assert.equal(playmat.activeSkin, 'comic');
    assert.equal(document.querySelector('[data-testid="play-hud-skin-selector-overlay"]'), null);
    wrapper.unmount();
  });

  test('Escape key on the panel closes the overlay (D-6401 keyboard pattern)', async () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    await wrapper.find('[data-testid="play-hud-skin-selector-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    const panel = document.querySelector('[data-testid="play-hud-skin-selector-panel"]') as HTMLElement;
    assert.ok(panel !== null);
    const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    panel.dispatchEvent(escapeEvent);
    await wrapper.vm.$nextTick();
    assert.equal(document.querySelector('[data-testid="play-hud-skin-selector-overlay"]'), null);
    wrapper.unmount();
  });

  test('outside-click on the backdrop closes the overlay', async () => {
    const wrapper = mount(SkinSelector, { attachTo: document.body });
    await wrapper.find('[data-testid="play-hud-skin-selector-button"]').trigger('click');
    await wrapper.vm.$nextTick();
    const overlay = document.querySelector('[data-testid="play-hud-skin-selector-overlay"]') as HTMLElement;
    assert.ok(overlay !== null);
    const outsideClick = new window.MouseEvent('click', { bubbles: true });
    Object.defineProperty(outsideClick, 'target', { value: overlay });
    Object.defineProperty(outsideClick, 'currentTarget', { value: overlay });
    overlay.dispatchEvent(outsideClick);
    await wrapper.vm.$nextTick();
    assert.equal(document.querySelector('[data-testid="play-hud-skin-selector-overlay"]'), null);
    wrapper.unmount();
  });
});
