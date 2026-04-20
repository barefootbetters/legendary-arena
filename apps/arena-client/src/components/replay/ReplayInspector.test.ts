import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ReplayInspector from './ReplayInspector.vue';
import { useUiStateStore } from '../../stores/uiState';
import { loadReplayFixture } from '../../fixtures/replay/index';

function freshPinia(): void {
  setActivePinia(createPinia());
}

// why: Pinia wraps the stored snapshot in a reactive proxy, so strict
// reference equality (`store.snapshot === sequence.snapshots[i]`) is
// always false — the proxy is a different object than the underlying
// raw snapshot. JSON-string equality compares the projected values and
// is the same pattern WP-062's <ArenaHud /> tests use to assert "the
// right snapshot is loaded" (apps/arena-client/src/components/hud/
// ArenaHud.test.ts deep-immutability suite).
function snapshotsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function loadedIndex(
  store: { snapshot: unknown },
  sequence: { snapshots: readonly unknown[] },
): number {
  const target = JSON.stringify(store.snapshot);
  for (let i = 0; i < sequence.snapshots.length; i++) {
    if (JSON.stringify(sequence.snapshots[i]) === target) {
      return i;
    }
  }
  return -1;
}

test('ReplayInspector mount sets the store snapshot to snapshots[initialIndex ?? 0]', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  const store = useUiStateStore();

  assert.ok(snapshotsEqual(store.snapshot, sequence.snapshots[0]));
  assert.equal(
    wrapper.find('[data-testid="replay-position"]').text(),
    `1 / ${sequence.snapshots.length}`,
  );
});

test('ReplayInspector mount honors a custom initialIndex prop', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex: 3 },
  });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 3);
  assert.equal(
    wrapper.find('[data-testid="replay-position"]').text(),
    `4 / ${sequence.snapshots.length}`,
  );
});

test('ReplayInspector next button advances the store snapshot by one index', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  await wrapper.find('[data-testid="replay-step-next"]').trigger('click');
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 1);
});

test('ReplayInspector prev button steps backward and clamps at index 0', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex: 1 },
  });
  await wrapper.find('[data-testid="replay-step-prev"]').trigger('click');
  let store = useUiStateStore();
  assert.equal(loadedIndex(store, sequence), 0);

  // Stepping past 0 must clamp, not wrap or throw.
  await wrapper.find('[data-testid="replay-step-prev"]').trigger('click');
  store = useUiStateStore();
  assert.equal(loadedIndex(store, sequence), 0);
});

test('ReplayInspector jump-last sets the store snapshot to the final snapshot', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');
  const lastIndex = sequence.snapshots.length - 1;

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  await wrapper.find('[data-testid="replay-jump-last"]').trigger('click');
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), lastIndex);
});

test('ReplayInspector jump-first returns to snapshot 0 from the last snapshot', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex: sequence.snapshots.length - 1 },
  });
  await wrapper.find('[data-testid="replay-jump-first"]').trigger('click');
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 0);
});

test('ReplayInspector range scrub updates the store snapshot to the scrubbed index', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  const range = wrapper.find('[data-testid="replay-scrub"]');
  await range.setValue('4');
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 4);
});

test('ReplayInspector ArrowRight key advances the store snapshot by one index', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  await wrapper
    .find('[data-testid="replay-inspector"]')
    .trigger('keydown', { key: 'ArrowRight' });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 1);
});

test('ReplayInspector ArrowLeft key clamps at index 0 (does not wrap)', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  await wrapper
    .find('[data-testid="replay-inspector"]')
    .trigger('keydown', { key: 'ArrowLeft' });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 0);
});

test('ReplayInspector End key jumps to the last snapshot', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');
  const lastIndex = sequence.snapshots.length - 1;

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  await wrapper
    .find('[data-testid="replay-inspector"]')
    .trigger('keydown', { key: 'End' });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), lastIndex);
});

test('ReplayInspector Home key jumps to the first snapshot', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex: sequence.snapshots.length - 1 },
  });
  await wrapper
    .find('[data-testid="replay-inspector"]')
    .trigger('keydown', { key: 'Home' });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 0);
});

test('ReplayInspector ArrowRight at the last index clamps and does not wrap', async () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');
  const lastIndex = sequence.snapshots.length - 1;

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex: lastIndex },
  });
  await wrapper
    .find('[data-testid="replay-inspector"]')
    .trigger('keydown', { key: 'ArrowRight' });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), lastIndex);
});

test('ReplayInspector root element is keyboard-focusable (tabindex=0)', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });
  const root = wrapper.find('[data-testid="replay-inspector"]');

  assert.equal(root.attributes('tabindex'), '0');
});

test('ReplayInspector exposes aria-label on every interactive control', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, { props: { sequence } });

  const expected: Record<string, string> = {
    'replay-jump-first': 'Jump to first snapshot',
    'replay-step-prev': 'Step to previous snapshot',
    'replay-scrub': 'Scrub replay position',
    'replay-step-next': 'Step to next snapshot',
    'replay-jump-last': 'Jump to last snapshot',
    'replay-position': 'Replay position',
  };
  for (const testid of Object.keys(expected)) {
    const node = wrapper.find(`[data-testid="${testid}"]`);
    assert.equal(node.exists(), true, `${testid} not found`);
    assert.equal(node.attributes('aria-label'), expected[testid]);
  }
});

test('ReplayInspector renders the embedded GameLogPanel populated with the current snapshot.log', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');
  // Snapshot index 5 has 3 log entries from unknown-move warnings.
  const initialIndex = 5;
  const expectedEntries = sequence.snapshots[initialIndex]?.log ?? [];

  const wrapper = mount(ReplayInspector, {
    props: { sequence, initialIndex },
  });

  const lines = wrapper.findAll('[data-testid="game-log-line"]');
  assert.equal(lines.length, expectedEntries.length);
  for (let i = 0; i < expectedEntries.length; i++) {
    assert.equal(lines[i]?.text(), expectedEntries[i]);
  }
});

test('ReplayInspector accepts the enableAutoPlay prop without changing behavior', () => {
  freshPinia();
  const sequence = loadReplayFixture('three-turn-sample');

  const wrapper = mount(ReplayInspector, {
    props: { sequence, enableAutoPlay: true },
  });
  const store = useUiStateStore();

  assert.equal(loadedIndex(store, sequence), 0);
  assert.equal(wrapper.find('[data-testid="replay-inspector"]').exists(), true);
});
