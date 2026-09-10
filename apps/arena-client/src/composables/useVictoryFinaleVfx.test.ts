import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useVictoryFinaleVfx, type VictoryFinaleVfxEvent } from './useVictoryFinaleVfx';

/** A recording renderer stand-in — captures each emitted victory-finale event. */
function makeRecorder(): {
  render: (event: VictoryFinaleVfxEvent) => void;
  events: VictoryFinaleVfxEvent[];
} {
  const events: VictoryFinaleVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** An in-progress frame — no gameOver projection yet. */
function playing(): UIState {
  return {} as unknown as UIState;
}

/** A settled-outcome frame with the given outcome (+ optional early-end flag). */
function ended(outcome: string, endedEarly?: boolean): UIState {
  const gameOver: Record<string, unknown> = { outcome, reason: 'test' };
  if (endedEarly !== undefined) gameOver.endedEarly = endedEarly;
  return { gameOver } as unknown as UIState;
}

describe('useVictoryFinaleVfx — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('an in-progress match (no gameOver) never emits', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();
    snapshot.value = playing();
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useVictoryFinaleVfx — only a genuine heroes-win fires', () => {
  test('fires once on the live transition into heroes-win', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick(); // seed: in progress

    snapshot.value = ended('heroes-win');
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.seq, 1);
  });

  test('does not re-fire on subsequent identical heroes-win frames', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();

    snapshot.value = ended('heroes-win');
    await nextTick();
    snapshot.value = ended('heroes-win'); // a fresh snapshot object, same outcome
    await nextTick();
    assert.equal(events.length, 1);
  });

  test('a scheme-wins loss never emits', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();

    snapshot.value = ended('scheme-wins');
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('a tie never emits', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();

    snapshot.value = ended('tie');
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('an early-ended match never emits (an abandoned match is not a victory)', async () => {
    const snapshot = ref<UIState | null>(playing());
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();

    // why: endedEarly reuses the tie outcome bucket; belt-and-braces, even a
    // heroes-win labelled endedEarly must not celebrate.
    snapshot.value = ended('tie', true);
    await nextTick();
    snapshot.value = ended('heroes-win', true);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useVictoryFinaleVfx — no replay on reconnect', () => {
  test('a mount INTO an already-won match replays nothing', async () => {
    // why: the seed-on-first-frame discipline — reconnecting into a finished, won
    // match must not fire the finale for the pre-mount win.
    const snapshot = ref<UIState | null>(ended('heroes-win'));
    const { render, events } = makeRecorder();
    useVictoryFinaleVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);

    // a further identical frame still fires nothing (already latched)
    snapshot.value = ended('heroes-win');
    await nextTick();
    assert.deepEqual(events, []);
  });
});
