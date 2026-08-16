import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useComboVfx, type ComboVfxEvent } from './useComboVfx';

/** A recording renderer stand-in — captures each emitted combo-flash event. */
function makeRecorder(): { render: (event: ComboVfxEvent) => void; events: ComboVfxEvent[] } {
  const events: ComboVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** Fabricates a minimal UIState carrying only `game.lastPlayEffectsFired`. */
function uiStateWith(lastPlayEffectsFired: number): UIState {
  return { game: { lastPlayEffectsFired } } as unknown as UIState;
}

describe('useComboVfx (WP-556) — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('absent game.lastPlayEffectsFired never emits', async () => {
    const snapshot = ref<UIState | null>({ game: {} } as unknown as UIState);
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useComboVfx (WP-556) — catch-up (no pre-mount flash)', () => {
  test('does not emit for the value present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(3));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useComboVfx (WP-556) — audible value-change', () => {
  test('emits the matching tier + word once per audible change', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith(1);
    await nextTick();
    snapshot.value = uiStateWith(2);
    await nextTick();
    snapshot.value = uiStateWith(5);
    await nextTick();

    assert.deepEqual(
      events.map((event) => ({ tier: event.tier, word: event.word })),
      [
        { tier: 'small', word: null },
        { tier: 'medium', word: 'Team-Up!' },
        { tier: 'legendary', word: 'LEGENDARY!' },
      ],
    );
  });

  test('the seq id is monotonic so equal-tier repeats re-render', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith(2);
    await nextTick();
    snapshot.value = uiStateWith(0);
    await nextTick();
    snapshot.value = uiStateWith(2);
    await nextTick();

    assert.equal(events.length, 2);
    const [first, second] = events;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second.seq > first.seq, 'seq must be monotonic');
  });

  test('no flash on a change into the silent none tier (per-turn reset to 0)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(2));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick(); // catch up at 2 (no flash)

    snapshot.value = uiStateWith(0);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('coalesces two consecutive equal non-zero counts in one turn (documented v1 limitation)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith(2);
    await nextTick();
    snapshot.value = uiStateWith(2);
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.tier, 'medium');
  });

  test('re-arms an equal value across a per-turn reset (3 -> 0 -> 3 fires twice)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { render, events } = makeRecorder();
    useComboVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith(3);
    await nextTick();
    snapshot.value = uiStateWith(0);
    await nextTick();
    snapshot.value = uiStateWith(3);
    await nextTick();

    assert.deepEqual(
      events.map((event) => event.tier),
      ['big', 'big'],
    );
  });
});
