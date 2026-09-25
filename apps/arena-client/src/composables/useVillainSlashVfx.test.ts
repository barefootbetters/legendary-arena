import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useVillainSlashVfx, type VillainSlashVfxEvent } from './useVillainSlashVfx';
import type { NotableGameEvent } from './useStrikeBlockedVfx';

/** A recording renderer stand-in — captures each emitted villain-slash event. */
function makeRecorder(): {
  render: (event: VillainSlashVfxEvent) => void;
  events: VillainSlashVfxEvent[];
} {
  const events: VillainSlashVfxEvent[] = [];
  return { render: (event) => events.push(event), events };
}

/** A minimal fightResolved notable event. */
function fightResolved(cardId: string, citySpace: number, playerId = '0'): NotableGameEvent {
  return {
    type: 'fightResolved',
    playerId,
    cardId,
    citySpace,
    bystandersRescued: 0,
    appliedEffects: [],
    narrative: `Player ${playerId} defeats ${cardId}.`,
  } as unknown as NotableGameEvent;
}

/** A minimal non-fight notable event. */
function otherEvent(): NotableGameEvent {
  return { type: 'healResolved', playerId: '0', narrative: 'healed' } as unknown as NotableGameEvent;
}

/** A City space carrying one card's display. */
function citySpace(extId: string, imageUrl: string): unknown {
  return { extId, display: { extId, name: extId, imageUrl, cost: 3 } };
}

/** Fabricates a minimal UIState carrying notableEvents and (optionally) City spaces. */
function uiStateWith(notableEvents: NotableGameEvent[], spaces?: unknown[]): UIState {
  if (spaces === undefined) return { notableEvents } as unknown as UIState;
  return { notableEvents, city: { spaces, escapedPile: [] } } as unknown as UIState;
}

describe('useVillainSlashVfx (WP-755) — safe-skip', () => {
  test('a null snapshot never emits and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('absent notableEvents never emits', async () => {
    const snapshot = ref<UIState | null>({} as unknown as UIState);
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = {} as unknown as UIState;
    await nextTick();
    assert.deepEqual(events, []);
  });

  test('a missing city still emits, with imageUrl null', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = uiStateWith([fightResolved('villain-a', 2)]);
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.imageUrl, null);
    assert.equal(events[0]?.citySpace, 2);
  });

  test('a city without spaces still emits, with imageUrl null', async () => {
    const snapshot = ref<UIState | null>({ notableEvents: [], city: {} } as unknown as UIState);
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = { notableEvents: [fightResolved('villain-a', 1)], city: {} } as unknown as UIState;
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.imageUrl, null);
  });
});

describe('useVillainSlashVfx (WP-755) — catch-up (no pre-mount replay)', () => {
  test('does not emit for defeats present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([fightResolved('villain-a', 0)]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    assert.deepEqual(events, []);
  });
});

describe('useVillainSlashVfx (WP-755) — emitting', () => {
  test('a new defeat emits citySpace, playerId and the PRIOR frame imageUrl (prior = catch-up frame)', async () => {
    const snapshot = ref<UIState | null>(
      uiStateWith([], [null, citySpace('villain-a', 'https://images.example/a.webp'), null, null, null]),
    );
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    // why: the defeat frame has already removed the card from the City.
    snapshot.value = uiStateWith([fightResolved('villain-a', 1, '1')], [null, null, null, null, null]);
    await nextTick();
    assert.equal(events.length, 1);
    const event = events[0] as VillainSlashVfxEvent;
    assert.equal(event.citySpace, 1);
    assert.equal(event.playerId, '1');
    assert.equal(event.imageUrl, 'https://images.example/a.webp');
    assert.ok(event.seq > 0);
  });

  test('the cache follows each frame (a card entering later is found on its defeat)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([], [null, null, null, null, null]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = uiStateWith([], [citySpace('villain-b', 'b.webp'), null, null, null, null]);
    await nextTick();
    snapshot.value = uiStateWith([fightResolved('villain-b', 0)], [null, null, null, null, null]);
    await nextTick();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.imageUrl, 'b.webp');
  });

  test('a cache miss yields imageUrl null', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([], [citySpace('villain-a', 'a.webp')]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = uiStateWith([fightResolved('villain-z', 0)], [null]);
    await nextTick();
    assert.equal(events[0]?.imageUrl, null);
  });

  test('an empty-string display.imageUrl yields null', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([], [citySpace('villain-a', '')]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = uiStateWith([fightResolved('villain-a', 0)], [null]);
    await nextTick();
    assert.equal(events[0]?.imageUrl, null);
  });

  test('non-fight events are ignored, and each new defeat emits once', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { render, events } = makeRecorder();
    useVillainSlashVfx(snapshot, render);
    await nextTick();
    snapshot.value = uiStateWith([otherEvent()]);
    await nextTick();
    assert.equal(events.length, 0);
    snapshot.value = uiStateWith([otherEvent(), fightResolved('villain-a', 3)]);
    await nextTick();
    assert.equal(events.length, 1);
    // A re-sent identical frame does not re-emit (the append-only cursor).
    snapshot.value = uiStateWith([otherEvent(), fightResolved('villain-a', 3)]);
    await nextTick();
    assert.equal(events.length, 1);
    snapshot.value = uiStateWith([otherEvent(), fightResolved('villain-a', 3), fightResolved('villain-b', 4)]);
    await nextTick();
    assert.equal(events.length, 2);
    assert.equal(events[1]?.citySpace, 4);
    assert.ok((events[1]?.seq as number) > (events[0]?.seq as number));
  });
});
