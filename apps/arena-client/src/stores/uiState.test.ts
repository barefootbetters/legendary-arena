import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useUiStateStore } from './uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';

test('snapshot defaults to null on a freshly created store', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  assert.equal(store.snapshot, null);
});

test('setSnapshot(fixture) replaces the snapshot with the provided UIState', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  const fixture = loadUiStateFixture('mid-turn');
  store.setSnapshot(fixture);
  assert.notEqual(store.snapshot, null);
  assert.equal(store.snapshot?.game.phase, 'play');
  assert.equal(store.snapshot?.game.currentStage, 'main');
});

test('setSnapshot(null) clears a previously populated snapshot', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  store.setSnapshot(loadUiStateFixture('endgame-win'));
  assert.notEqual(store.snapshot, null);
  store.setSnapshot(null);
  assert.equal(store.snapshot, null);
});
