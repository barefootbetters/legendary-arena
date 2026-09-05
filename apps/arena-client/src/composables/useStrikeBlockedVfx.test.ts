import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import {
  useStrikeBlockedVfx,
  type StrikeBlockedVfxEvent,
  type NotableGameEvent,
} from './useStrikeBlockedVfx';

/** A recording renderer stand-in — captures each emitted shield-block event. */
function makeRecorder(): {
  render: (event: StrikeBlockedVfxEvent) => void;
  events: StrikeBlockedVfxEvent[];
} {
  const events: StrikeBlockedVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** A minimal strikeBlocked notable event carrying the given threat kind. */
function strikeBlocked(threatKind: string): NotableGameEvent {
  return {
    type: 'strikeBlocked',
    playerId: '0',
    threatKind,
    narrative: 'blocked',
  } as unknown as NotableGameEvent;
}

/** A minimal non-strikeBlocked notable event (a different variant). */
function otherEvent(): NotableGameEvent {
  return { type: 'healResolved', playerId: '0', narrative: 'healed' } as unknown as NotableGameEvent;
}

/** Fabricates a minimal UIState carrying only a notableEvents array. */
function uiStateWith(notableEvents: NotableGameEvent[]): UIState {
  return { notableEvents } as unknown as UIState;
}

describe('useStrikeBlockedVfx (WP-647) — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('absent notableEvents never emits', async () => {
    const snapshot = ref<UIState | null>({} as unknown as UIState);
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useStrikeBlockedVfx (WP-647) — catch-up (no pre-mount replay)', () => {
  test('does not emit for events present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([strikeBlocked('masterStrike')]));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useStrikeBlockedVfx (WP-647) — new events', () => {
  test('emits one event per new strikeBlocked, carrying the threatKind', async () => {
    const list: NotableGameEvent[] = [];
    const snapshot = ref<UIState | null>(uiStateWith(list));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick(); // catch up at length 0

    list.push(strikeBlocked('masterStrike'));
    snapshot.value = uiStateWith([...list]);
    await nextTick();
    list.push(strikeBlocked('schemeTwist'));
    snapshot.value = uiStateWith([...list]);
    await nextTick();
    list.push(strikeBlocked('ambush'));
    snapshot.value = uiStateWith([...list]);
    await nextTick();

    assert.deepEqual(
      events.map((event) => event.threatKind),
      ['masterStrike', 'schemeTwist', 'ambush'],
    );
  });

  test('the seq id is monotonic so equal-threat repeats re-render', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();

    snapshot.value = uiStateWith([strikeBlocked('ambush')]);
    await nextTick();
    snapshot.value = uiStateWith([strikeBlocked('ambush'), strikeBlocked('ambush')]);
    await nextTick();

    assert.equal(events.length, 2);
    const [first, second] = events;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second.seq > first.seq, 'seq must be monotonic');
  });

  test('non-strikeBlocked events emit nothing (but advance the cursor)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();

    // A frame with only a non-strikeBlocked event: no beat, cursor advances past it.
    snapshot.value = uiStateWith([otherEvent()]);
    await nextTick();
    // why: assert on the count (not deepEqual(events, [])) — the strict
    // deepStrictEqual `asserts actual is never[]` would narrow `events` and break
    // the later `.map(event => event.threatKind)`.
    assert.equal(events.length, 0);

    // A later strikeBlocked appended after it fires exactly once.
    snapshot.value = uiStateWith([otherEvent(), strikeBlocked('masterStrike')]);
    await nextTick();
    assert.deepEqual(
      events.map((event) => event.threatKind),
      ['masterStrike'],
    );
  });

  test('two strikeBlocked appended in one frame emit two events in order', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick();

    // Both appended before the next flush — the composable emits BOTH (the
    // one-visible-beat coalescing happens later, at the single overlay signal).
    snapshot.value = uiStateWith([strikeBlocked('masterStrike'), strikeBlocked('ambush')]);
    await nextTick();
    assert.deepEqual(
      events.map((event) => event.threatKind),
      ['masterStrike', 'ambush'],
    );
  });
});

describe('useStrikeBlockedVfx (WP-647) — re-emission gate (D-20104)', () => {
  test('a reconnect / wholesale snapshot refresh replays nothing', async () => {
    const seeded = [strikeBlocked('masterStrike'), strikeBlocked('schemeTwist')];
    const snapshot = ref<UIState | null>(uiStateWith(seeded));
    const { render, events } = makeRecorder();
    useStrikeBlockedVfx(snapshot, render);
    await nextTick(); // catch up at length 2 — these are pre-mount history

    // A wholesale new snapshot object carrying the SAME two events (a reconnect
    // re-anchoring the same match) must replay NOTHING.
    snapshot.value = uiStateWith([...seeded]);
    await nextTick();
    // why: count assertion, not deepEqual(events, []) — see the narrowing note above.
    assert.equal(events.length, 0);

    // Only a genuinely NEW appended event fires.
    snapshot.value = uiStateWith([...seeded, strikeBlocked('ambush')]);
    await nextTick();
    assert.deepEqual(
      events.map((event) => event.threatKind),
      ['ambush'],
    );
  });
});
