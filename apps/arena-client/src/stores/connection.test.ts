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

test('initial state — all four recovery counters start at 0 (WP-429)', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  assert.equal(store.reconnectResyncCount, 0);
  assert.equal(store.moveAckResyncCount, 0);
  assert.equal(store.spectatorStaleResyncCount, 0);
  assert.equal(store.tabFocusResyncCount, 0);
});

test('each record* action increments only its own counter by one (WP-429)', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();

  store.recordReconnectResync();
  assert.equal(store.reconnectResyncCount, 1);
  assert.equal(store.moveAckResyncCount, 0);
  assert.equal(store.spectatorStaleResyncCount, 0);
  assert.equal(store.tabFocusResyncCount, 0);

  store.recordMoveAckResync();
  assert.equal(store.reconnectResyncCount, 1);
  assert.equal(store.moveAckResyncCount, 1);
  assert.equal(store.spectatorStaleResyncCount, 0);
  assert.equal(store.tabFocusResyncCount, 0);

  store.recordSpectatorStaleResync();
  assert.equal(store.reconnectResyncCount, 1);
  assert.equal(store.moveAckResyncCount, 1);
  assert.equal(store.spectatorStaleResyncCount, 1);
  assert.equal(store.tabFocusResyncCount, 0);

  store.recordTabFocusResync();
  assert.equal(store.reconnectResyncCount, 1);
  assert.equal(store.moveAckResyncCount, 1);
  assert.equal(store.spectatorStaleResyncCount, 1);
  assert.equal(store.tabFocusResyncCount, 1);
});

test('a record* action called twice increments its counter to 2 (WP-429)', () => {
  setActivePinia(createPinia());
  const store = useConnectionStore();
  store.recordReconnectResync();
  store.recordReconnectResync();
  assert.equal(store.reconnectResyncCount, 2);
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
