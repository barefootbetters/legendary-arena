import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useMastermindHitVfx, type MastermindHitVfxEvent } from './useMastermindHitVfx';

/** A recording renderer stand-in — captures each emitted mastermind-hit event. */
function makeRecorder(): {
  render: (event: MastermindHitVfxEvent) => void;
  events: MastermindHitVfxEvent[];
} {
  const events: MastermindHitVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** Fabricates a UIState whose mastermind projects the given defeated-tactic count. */
function frame(tacticsDefeated: number): UIState {
  return { mastermind: { tacticsDefeated } } as unknown as UIState;
}

describe('useMastermindHitVfx — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('a frame with no mastermind projection never emits', async () => {
    const snapshot = ref<UIState | null>({} as unknown as UIState);
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick();
    snapshot.value = { mastermind: { tacticsDefeated: 1 } } as unknown as UIState;
    await nextTick();
    // why: the first non-null frame with a projection only SEEDS (no pre-mount
    // flash) — so a single increase after a projection-less frame is the seed, not
    // a hit. The next increase would fire.
    assert.deepEqual(events, []);
  });

  test('a mastermind with no tacticsDefeated projection never emits', async () => {
    const snapshot = ref<UIState | null>({ mastermind: {} } as unknown as UIState);
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useMastermindHitVfx — catch-up (no pre-mount flash)', () => {
  test('does not emit for the defeated-tactic total present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(frame(2));
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useMastermindHitVfx — fires on increase', () => {
  test('emits once per Tactic defeat, carrying the new count and a monotonic seq', async () => {
    const snapshot = ref<UIState | null>(frame(0));
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick(); // seed at 0

    snapshot.value = frame(1);
    await nextTick();
    snapshot.value = frame(2);
    await nextTick();
    snapshot.value = frame(3);
    await nextTick();
    snapshot.value = frame(4);
    await nextTick();

    assert.equal(events.length, 4);
    assert.deepEqual(
      events.map((event) => event.tacticsDefeated),
      [1, 2, 3, 4],
    );
    // why: seq must be strictly monotonic so the overlay re-renders each repeat.
    for (let index = 1; index < events.length; index += 1) {
      assert.ok(events[index]!.seq > events[index - 1]!.seq, 'seq must be monotonic');
    }
  });

  test('a multi-step jump still fires exactly once, with the landed count', async () => {
    const snapshot = ref<UIState | null>(frame(1));
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick(); // seed at 1

    snapshot.value = frame(3); // +2 at once (defensive) fires one beat at the new count
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.tacticsDefeated, 3);
  });

  test('no change and a decrease (defensive) do not emit', async () => {
    const snapshot = ref<UIState | null>(frame(2));
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick(); // seed at 2

    snapshot.value = frame(2); // unchanged
    await nextTick();
    snapshot.value = frame(1); // a lower-count reconnect frame must not flash
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('re-arms after a decrease (2 -> 1 -> 3 fires only on the increase to 3)', async () => {
    const snapshot = ref<UIState | null>(frame(2));
    const { render, events } = makeRecorder();
    useMastermindHitVfx(snapshot, render);
    await nextTick(); // seed at 2

    snapshot.value = frame(1); // no flash
    await nextTick();
    snapshot.value = frame(3); // increase from the advanced lastSeen — one flash
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.tacticsDefeated, 3);
  });
});
