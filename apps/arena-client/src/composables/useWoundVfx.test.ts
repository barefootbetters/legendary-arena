import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useWoundVfx, type WoundVfxEvent } from './useWoundVfx';

/** A recording renderer stand-in — captures each emitted wound event. */
function makeRecorder(): { render: (event: WoundVfxEvent) => void; events: WoundVfxEvent[] } {
  const events: WoundVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/**
 * Fabricates a UIState whose LOCAL seat (the one with `handCards`) has the given
 * wound count. An `opponentWoundCount` seats an extra player WITHOUT a hand — the
 * consumer must ignore its wound count (it is not the viewer's own seat).
 */
function ownFrame(woundCount: number, opponentWoundCount?: number): UIState {
  const players: unknown[] = [];
  if (opponentWoundCount !== undefined) {
    players.push({ woundCount: opponentWoundCount }); // opponent: no handCards
  }
  players.push({ handCards: [], woundCount }); // own seat: handCards populated
  return { players } as unknown as UIState;
}

describe('useWoundVfx (WP-650) — safe-skip', () => {
  test('null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('a frame with no own seat (spectator — no handCards) never emits', async () => {
    const snapshot = ref<UIState | null>({ players: [{ woundCount: 3 }] } as unknown as UIState);
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick();
    snapshot.value = { players: [{ woundCount: 4 }] } as unknown as UIState;
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('an own seat with no woundCount projection never emits', async () => {
    const snapshot = ref<UIState | null>({ players: [{ handCards: [] }] } as unknown as UIState);
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useWoundVfx (WP-650) — catch-up (no pre-mount flash)', () => {
  test('does not emit for the wound total present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(ownFrame(2));
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useWoundVfx (WP-650) — fires on increase only', () => {
  test('emits once per wound-count increase, with a monotonic seq', async () => {
    const snapshot = ref<UIState | null>(ownFrame(0));
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick();

    snapshot.value = ownFrame(1);
    await nextTick();
    snapshot.value = ownFrame(3); // +2 at once still fires exactly one vignette
    await nextTick();

    assert.equal(events.length, 2);
    const [first, second] = events;
    assert.ok(first !== undefined && second !== undefined);
    assert.ok(second.seq > first.seq, 'seq must be monotonic');
  });

  test('a heal (wound count DECREASES) does not emit', async () => {
    const snapshot = ref<UIState | null>(ownFrame(2));
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick(); // seed at 2

    snapshot.value = ownFrame(0); // healed both wounds
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('re-arms after a heal (2 -> 0 -> 1 fires only on the final increase)', async () => {
    const snapshot = ref<UIState | null>(ownFrame(2));
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick(); // seed at 2

    snapshot.value = ownFrame(0); // heal — no flash
    await nextTick();
    snapshot.value = ownFrame(1); // re-wound — one flash
    await nextTick();
    assert.equal(events.length, 1);
  });

  test('ignores an OPPONENT gaining a wound — only the local seat flashes', async () => {
    const snapshot = ref<UIState | null>(ownFrame(0, 0));
    const { render, events } = makeRecorder();
    useWoundVfx(snapshot, render);
    await nextTick(); // seed: own = 0

    // Opponent takes a wound (own unchanged) — no flash for me.
    snapshot.value = ownFrame(0, 5);
    await nextTick();
    assert.deepEqual(events, []);

    // I take a wound — flash.
    snapshot.value = ownFrame(1, 5);
    await nextTick();
    assert.equal(events.length, 1);
  });
});
