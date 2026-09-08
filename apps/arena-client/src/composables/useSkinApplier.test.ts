import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useSkinApplier, applySkinToElement, __resetSkinApplierForTests } from './useSkinApplier';
import { usePlaymat } from '../prefs/playmatStore';
import { skinManifest } from '../prefs/skinManifest';

const HostComponent = defineComponent({
  name: 'SkinApplierTestHost',
  setup() {
    const root = ref<HTMLElement | null>(null);
    useSkinApplier(root);
    return { root };
  },
  render() {
    return h('div', { ref: 'root', class: 'skin-applier-host', 'data-testid': 'skin-applier-host' });
  },
});

describe('WP-130 composables/useSkinApplier', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    __resetSkinApplierForTests();
    Array.from(document.head.querySelectorAll('link[data-skin-theme]')).forEach((node) => node.remove());
  });

  test('applies the active skin CSS class to the supplied root on initial mount', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    const host = wrapper.find('[data-testid="skin-applier-host"]').element as HTMLElement;
    assert.equal(host.classList.contains(skinManifest.classic.cssClassName), true);
  });

  test('swaps to the new CSS class within one tick when activeSkin changes', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    const host = wrapper.find('[data-testid="skin-applier-host"]').element as HTMLElement;
    const playmat = usePlaymat();
    playmat.setActiveSkin('comic');
    await wrapper.vm.$nextTick();
    assert.equal(host.classList.contains(skinManifest.comic.cssClassName), true);
    assert.equal(host.classList.contains(skinManifest.classic.cssClassName), false);
  });

  test('injects a <link rel="stylesheet"> for the active skin theme into document.head', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    const matchingLink = links.find((node) => node.dataset.skinTheme === skinManifest.classic.themeCssUrl);
    assert.ok(matchingLink !== undefined, 'expected a <link> element pointing at the classic skin theme');
    wrapper.unmount();
  });

  test('applySkinToElement falls back to classic + console.warn on a missing manifest entry', () => {
    const host = document.createElement('div');
    const originalWarn = console.warn;
    let warnCount = 0;
    console.warn = () => {
      warnCount += 1;
    };
    try {
      applySkinToElement(host, 'not-a-real-skin' as never);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(host.classList.contains(skinManifest.classic.cssClassName), true);
    assert.ok(warnCount >= 1, 'expected at least one console.warn for the unknown skin name');
  });

  test('sets --skin-board-image to none for the image-less default skin (WP-666)', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    const host = wrapper.find('[data-testid="skin-applier-host"]').element as HTMLElement;
    // classic has boardBackgroundUrl === null, so the variable is the keyword `none`.
    assert.equal(host.style.getPropertyValue('--skin-board-image'), 'none');
    wrapper.unmount();
  });

  test('sets --skin-board-image to a url(...) when the active skin carries an image (WP-666)', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    const host = wrapper.find('[data-testid="skin-applier-host"]').element as HTMLElement;
    const playmat = usePlaymat();
    playmat.setActiveSkin('comic');
    await wrapper.vm.$nextTick();
    const value = host.style.getPropertyValue('--skin-board-image');
    assert.ok(value.startsWith('url('), `expected a url(...) value, got: ${value}`);
    assert.ok(value.includes(skinManifest.comic.boardBackgroundUrl ?? ''), 'url should reference the comic mat asset');
    wrapper.unmount();
  });

  test('applySkinToElement sets --skin-board-image to the fallback default on a missing entry (WP-666)', () => {
    const host = document.createElement('div');
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      applySkinToElement(host, 'not-a-real-skin' as never);
    } finally {
      console.warn = originalWarn;
    }
    // Fallback is classic (boardBackgroundUrl null) → the image variable is `none`.
    assert.equal(host.style.getPropertyValue('--skin-board-image'), 'none');
  });

  test('applies skin class exclusively to the supplied root, never to document.body', async () => {
    const wrapper = mount(HostComponent);
    await wrapper.vm.$nextTick();
    for (const entry of Object.values(skinManifest)) {
      assert.equal(
        document.body.classList.contains(entry.cssClassName),
        false,
        `<body> must not carry skin class ${entry.cssClassName}`,
      );
    }
  });
});
