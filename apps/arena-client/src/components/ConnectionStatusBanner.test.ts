import '../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, enableAutoUnmount } from '@vue/test-utils';

import ConnectionStatusBanner from './ConnectionStatusBanner.vue';
import { useConnectionStore } from '../stores/connection';

enableAutoUnmount(afterEach);

const BANNER = '[data-testid="connection-status-banner"]';
const BUTTON = '[data-testid="connection-reconnect-button"]';

describe('ConnectionStatusBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('is hidden before the client has ever connected (fresh page)', () => {
    // initial store state: isConnected false, hasEverConnected false
    const wrapper = mount(ConnectionStatusBanner, {
      props: { resync: () => {} },
    });
    assert.equal(wrapper.find(BANNER).exists(), false);
  });

  test('is hidden while connected', () => {
    useConnectionStore().setConnected(true, 5);
    const wrapper = mount(ConnectionStatusBanner, {
      props: { resync: () => {} },
    });
    assert.equal(wrapper.find(BANNER).exists(), false);
  });

  test('is shown after a drop (hasEverConnected && !isConnected)', () => {
    const store = useConnectionStore();
    store.setConnected(true, 5); // connect
    store.setConnected(false, 5); // then drop
    const wrapper = mount(ConnectionStatusBanner, {
      props: { resync: () => {} },
    });
    assert.equal(wrapper.find(BANNER).exists(), true);
    assert.match(wrapper.text(), /reconnecting/i);
  });

  test('the "Reconnect now" button invokes the passed resync callback', async () => {
    const store = useConnectionStore();
    store.setConnected(true, 5);
    store.setConnected(false, 5);
    const resync = mock.fn();
    const wrapper = mount(ConnectionStatusBanner, {
      props: { resync },
    });
    await wrapper.find(BUTTON).trigger('click');
    assert.equal(resync.mock.callCount(), 1);
  });
});
