import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useTransformVfx, type TransformVfxEvent } from './useTransformVfx';
import type { NotableGameEvent } from './useStrikeBlockedVfx';

/** A recording renderer stand-in — captures each emitted transform event. */
function makeRecorder(): {
  render: (event: TransformVfxEvent) => void;
  events: TransformVfxEvent[];
} {
  const events: TransformVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** A minimal transformResolved notable event. */
function transformResolved(): NotableGameEvent {
  return {
    type: 'transformResolved',
    playerId: '0',
    narrative: '"Hurl Legal Objections" transformed into "Hurl Trucks".',
  } as unknown as NotableGameEvent;
}

/** A minimal non-transform notable event (a different variant). */
function otherEvent(): NotableGameEvent {
  return { type: 'healResolved', playerId: '0', narrative: 'healed' } as unknown as NotableGameEvent;
}

/** Fabricates a minimal UIState carrying only a notableEvents array. */
function uiStateWith(notableEvents: NotableGameEvent[]): UIState {
  return { notableEvents } as unknown as UIState;
}

describe('useTransformVfx (WP-672) — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('absent notableEvents never emits', async () => {
    const snapshot = ref<UIState | null>({} as unknown as UIState);
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useTransformVfx (WP-672) — catch-up (no pre-mount replay)', () => {
  test('does not emit for events present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([transformResolved()]));
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useTransformVfx (WP-672) — new events', () => {
  test('emits one event per new transformResolved', async () => {
    const list: NotableGameEvent[] = [];
    const snapshot = ref<UIState | null>(uiStateWith(list));
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick(); // catch up at length 0

    list.push(transformResolved());
    snapshot.value = uiStateWith([...list]);
    await nextTick();
    list.push(transformResolved());
    snapshot.value = uiStateWith([...list]);
    await nextTick();

    assert.equal(events.length, 2);
  });

  test('the seq id is monotonic so a repeat transform re-renders', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith([transformResolved()]);
    await nextTick();
    snapshot.value = uiStateWith([transformResolved(), transformResolved()]);
    await nextTick();

    assert.equal(events.length, 2);
    const [first, second] = events;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second.seq > first.seq, 'seq must be monotonic');
  });

  test('non-transform events emit nothing (but advance the cursor)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith([otherEvent()]);
    await nextTick();
    assert.equal(events.length, 0);

    snapshot.value = uiStateWith([otherEvent(), transformResolved()]);
    await nextTick();
    assert.equal(events.length, 1);
  });
});

describe('useTransformVfx (WP-672) — re-emission gate (D-20104)', () => {
  test('a reconnect / wholesale snapshot refresh replays nothing', async () => {
    const seeded = [transformResolved(), transformResolved()];
    const snapshot = ref<UIState | null>(uiStateWith(seeded));
    const { render, events } = makeRecorder();
    useTransformVfx(snapshot, render);
    await nextTick(); // catch up at length 2 — pre-mount history

    // A wholesale new snapshot object carrying the SAME two events (a reconnect
    // re-anchoring the same match) must replay NOTHING.
    snapshot.value = uiStateWith([...seeded]);
    await nextTick();
    assert.equal(events.length, 0);

    // Only a genuinely NEW appended event fires.
    snapshot.value = uiStateWith([...seeded, transformResolved()]);
    await nextTick();
    assert.equal(events.length, 1);
  });
});
