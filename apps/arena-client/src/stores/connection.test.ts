import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

import { useConnectionStore } from './connection';

// why: each test creates its own Pinia so cross-test state cannot leak (the
// store reactive refs are owned by the active Pinia instance). Matches the
// apps/arena-client/src/stores/uiState.test.ts / auth.test.ts precedent.

test('initial state — disconnected, no stateId, never connected', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  assert.equal(store.isConnected, false);
  assert.equal(store.lastStateId, null);
  assert.equal(store.hasEverConnected, false);
});

test('setConnected(true, id) latches hasEverConnected and records the stateId', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  store.setConnected(true, 12);
  assert.equal(store.isConnected, true);
  assert.equal(store.lastStateId, 12);
  assert.equal(store.hasEverConnected, true);
});

test('hasEverConnected stays latched after a drop; isConnected flips to false', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  store.setConnected(true, 3);
  store.setConnected(false, 3);
  assert.equal(store.isConnected, false);
  assert.equal(store.lastStateId, 3);
  // why: the latch is what lets the banner distinguish "was connected, then
  // dropped" (show it) from "never connected yet" (show nothing).
  assert.equal(store.hasEverConnected, true);
});

test('a disconnected frame before any connect does NOT latch hasEverConnected', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  store.setConnected(false, null);
  assert.equal(store.isConnected, false);
  assert.equal(store.hasEverConnected, false);
});
