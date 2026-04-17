// why: jsdom globals must be installed before `@vue/test-utils` is imported,
// because `mount()` triggers Vue 3.5.x's `resolveRootNamespace` which probes
// globals at module-evaluation time. The first-import position is load-bearing.
import '../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BootstrapProbe from './BootstrapProbe.vue';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';

test('renders the empty-state message when no snapshot is loaded', () => {
  setActivePinia(createPinia());
  const wrapper = mount(BootstrapProbe);
  assert.match(wrapper.text(), /No UIState loaded/);
  const empty = wrapper.find('[aria-label="no snapshot loaded"]');
  assert.equal(empty.exists(), true);
});

test('renders the phase value when a fixture snapshot is loaded', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  store.setSnapshot(loadUiStateFixture('mid-turn'));
  const wrapper = mount(BootstrapProbe);
  assert.match(wrapper.text(), /Phase: play/);
  const phase = wrapper.find('[aria-label="current game phase"]');
  assert.equal(phase.exists(), true);
});

test('re-renders the empty-state message after the store is cleared', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  store.setSnapshot(loadUiStateFixture('endgame-loss'));
  const wrapper = mount(BootstrapProbe);
  assert.match(wrapper.text(), /Phase: end/);
  store.setSnapshot(null);
  // @vue/test-utils auto-flushes reactivity between synchronous assertions,
  // but an explicit vm.$nextTick() is cheap insurance for any reactive batch.
  return wrapper.vm.$nextTick().then(() => {
    assert.match(wrapper.text(), /No UIState loaded/);
  });
});
