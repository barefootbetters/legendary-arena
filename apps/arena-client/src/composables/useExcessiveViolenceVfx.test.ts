import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useExcessiveViolenceVfx, type ExcessiveViolenceVfxEvent } from './useExcessiveViolenceVfx';
import type { NotableGameEvent } from './useStrikeBlockedVfx';

/** A recording renderer stand-in — captures each emitted Excessive Violence event. */
function makeRecorder(): {
  render: (event: ExcessiveViolenceVfxEvent) => void;
  events: ExcessiveViolenceVfxEvent[];
} {
  const events: ExcessiveViolenceVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** A minimal excessiveViolenceFired notable event. */
function excessiveViolenceFired(): NotableGameEvent {
  return {
    type: 'excessiveViolenceFired',
    playerId: '0',
    narrative: 'Player 0 unleashes Excessive Violence, firing 2 abilities.',
  } as unknown as NotableGameEvent;
}

/** A minimal non-EV notable event (a different variant). */
function otherEvent(): NotableGameEvent {
  return { type: 'healResolved', playerId: '0', narrative: 'healed' } as unknown as NotableGameEvent;
}

/** Fabricates a minimal UIState carrying only a notableEvents array. */
function uiStateWith(notableEvents: NotableGameEvent[]): UIState {
  return { notableEvents } as unknown as UIState;
}

describe('useExcessiveViolenceVfx (WP-746) — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('absent notableEvents never emits', async () => {
    const snapshot = ref<UIState | null>({} as unknown as UIState);
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useExcessiveViolenceVfx (WP-746) — catch-up (no pre-mount replay)', () => {
  test('does not emit for events present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([excessiveViolenceFired()]));
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useExcessiveViolenceVfx (WP-746) — new events', () => {
  test('emits one event per new excessiveViolenceFired', async () => {
    const list: NotableGameEvent[] = [];
    const snapshot = ref<UIState | null>(uiStateWith(list));
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick(); // catch up at length 0

    list.push(excessiveViolenceFired());
    snapshot.value = uiStateWith([...list]);
    await nextTick();
    list.push(excessiveViolenceFired());
    snapshot.value = uiStateWith([...list]);
    await nextTick();

    assert.equal(events.length, 2);
  });

  test('the seq id is monotonic so a repeat fire re-renders', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith([excessiveViolenceFired()]);
    await nextTick();
    snapshot.value = uiStateWith([excessiveViolenceFired(), excessiveViolenceFired()]);
    await nextTick();

    assert.equal(events.length, 2);
    const [first, second] = events;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second.seq > first.seq, 'seq must be monotonic');
  });

  test('non-EV events emit nothing (but advance the cursor)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith([otherEvent()]);
    await nextTick();
    assert.equal(events.length, 0);

    snapshot.value = uiStateWith([otherEvent(), excessiveViolenceFired()]);
    await nextTick();
    assert.equal(events.length, 1);
  });
});

describe('useExcessiveViolenceVfx (WP-746) — re-emission gate (D-20104)', () => {
  test('a reconnect / wholesale snapshot refresh replays nothing', async () => {
    const seeded = [excessiveViolenceFired(), excessiveViolenceFired()];
    const snapshot = ref<UIState | null>(uiStateWith(seeded));
    const { render, events } = makeRecorder();
    useExcessiveViolenceVfx(snapshot, render);
    await nextTick(); // catch up at length 2 — pre-mount history

    // A wholesale new snapshot object carrying the SAME two events (a reconnect
    // re-anchoring the same match) must replay NOTHING.
    snapshot.value = uiStateWith([...seeded]);
    await nextTick();
    assert.equal(events.length, 0);

    // Only a genuinely NEW appended event fires.
    snapshot.value = uiStateWith([...seeded, excessiveViolenceFired()]);
    await nextTick();
    assert.equal(events.length, 1);
  });
});
