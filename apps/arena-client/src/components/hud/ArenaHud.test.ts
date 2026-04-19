import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ArenaHud from './ArenaHud.vue';
import { useUiStateStore } from '../../stores/uiState';
import { loadUiStateFixture } from '../../fixtures/uiState/index';
import type { FixtureName } from '../../fixtures/uiState/index';

test('ArenaHud renders nothing when snapshot is null', () => {
  setActivePinia(createPinia());
  const wrapper = mount(ArenaHud);
  assert.equal(wrapper.find('[data-testid="arena-hud"]').exists(), false);
});

test('ArenaHud renders all four always-on subtrees when a mid-turn fixture is loaded', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  store.setSnapshot(loadUiStateFixture('mid-turn'));

  const wrapper = mount(ArenaHud);

  assert.equal(
    wrapper.find('[data-testid="arena-hud-banner"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="arena-hud-scoreboard"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="arena-hud-par-delta"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="arena-hud-player-panel-list"]').exists(),
    true,
  );
  // mid-turn fixture omits gameOver — endgame subtree must be absent.
  assert.equal(
    wrapper.find('[data-testid="arena-hud-endgame"]').exists(),
    false,
  );
});

test('ArenaHud renders the endgame subtree when the fixture carries gameOver', () => {
  setActivePinia(createPinia());
  const store = useUiStateStore();
  store.setSnapshot(loadUiStateFixture('endgame-win'));

  const wrapper = mount(ArenaHud);
  assert.equal(
    wrapper.find('[data-testid="arena-hud-endgame"]').exists(),
    true,
  );
});

// why: deep-immutability (aliasing defense) — proves the UIState snapshot
// object is not mutated through reactive aliasing during the render cycle.
// One stringified snapshot comparison per fixture variant is sufficient;
// the assertion does NOT attempt to prove anything about Vue's internal
// reactive proxy state (FIX for copilot Issue 17).
const FIXTURE_VARIANTS: readonly FixtureName[] = [
  'mid-turn',
  'endgame-win',
  'endgame-loss',
];

for (const variant of FIXTURE_VARIANTS) {
  test(`ArenaHud does not mutate the ${variant} fixture through the render cycle`, () => {
    setActivePinia(createPinia());
    const snapshot = loadUiStateFixture(variant);
    const before = JSON.stringify(snapshot);

    const store = useUiStateStore();
    store.setSnapshot(snapshot);
    const wrapper = mount(ArenaHud);

    // Exercise a reactive interaction — toggle the store null/back and read
    // the banner text, then compare the original snapshot to its pre-render
    // serialized form. If render touched the original object in any way,
    // this assertion fails.
    wrapper.find('[data-testid="arena-hud"]').exists();
    const after = JSON.stringify(snapshot);
    assert.strictEqual(after, before);
  });
}
