import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

import { useConnectionStore } from './connection';

// why: each test creates its own Pinia so cross-test state cannot leak (the
// store reactive refs are owned by the active Pinia instance). Matches the
// apps/arena-client/src/stores/uiState.test.ts / auth.test.ts precedent.

test('initial state — disconnected, no stateId, never connected, no frame stamp', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  assert.equal(store.isConnected, false);
  assert.equal(store.lastStateId, null);
  assert.equal(store.hasEverConnected, false);
  assert.equal(store.lastFrameAtMs, null);
});

test('setConnected records lastFrameAtMs from an explicit atMs, and defaults to a number', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  assert.equal(store.lastFrameAtMs, null);
  // explicit atMs (deterministic — the WP-428 transport block reads this stamp)
  store.setConnected(true, 5, 1717848000000);
  assert.equal(store.lastFrameAtMs, 1717848000000);
  // why: the two-argument call bgioClient.ts uses stamps Date.now() via the
  // defaulted parameter — assert only that a number lands, not its value.
  store.setConnected(false, 5);
  assert.equal(typeof store.lastFrameAtMs, 'number');
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
