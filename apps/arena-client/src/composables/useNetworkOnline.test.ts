import '../testing/jsdom-setup';

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

import { useNetworkOnline } from './useNetworkOnline';
import { resetBrowserOnline, setBrowserOnline } from '../testing/browserOnline';

const Probe = defineComponent({
  name: 'NetworkOnlineProbe',
  setup() {
    const isOnline = useNetworkOnline();
    return () => h('span', { 'data-testid': 'probe' }, isOnline.value ? 'online' : 'offline');
  },
});

describe('useNetworkOnline (D-24851 follow-up)', () => {
  afterEach(() => {
    resetBrowserOnline();
  });

  test('reads online by default', () => {
    const wrapper = mount(Probe);
    assert.equal(wrapper.text(), 'online');
    wrapper.unmount();
  });

  test('reads offline when the browser starts with no network', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    const wrapper = mount(Probe);
    assert.equal(wrapper.text(), 'offline');
    wrapper.unmount();
  });

  test('follows the offline and online events', async () => {
    const wrapper = mount(Probe);
    setBrowserOnline(false);
    await nextTick();
    assert.equal(wrapper.text(), 'offline');
    setBrowserOnline(true);
    await nextTick();
    assert.equal(wrapper.text(), 'online');
    wrapper.unmount();
  });

  test('stops listening after unmount', async () => {
    const wrapper = mount(Probe);
    const element = wrapper.element as HTMLElement;
    wrapper.unmount();
    setBrowserOnline(false);
    await nextTick();
    assert.equal(element.textContent, 'online', 'an unmounted probe is not updated');
  });
});
