import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useSoundEffects } from './useSoundEffects';
import { sfxManifest } from '../audio/sfxManifest';
import type { AudioEngine } from '../audio/audioEngine';
import type { NotableGameEvent } from './useNotableEventStream';

/**
 * A recording stand-in for the audio engine: it captures each played clip URL
 * (honoring its own mute gate) so the consumer's cursor behaviour is asserted
 * without a real Howl.
 */
function makeRecordingEngine(): { engine: AudioEngine; played: string[] } {
  const played: string[] = [];
  let armed = true;
  let muted = false;
  const engine: AudioEngine = {
    arm() {
      armed = true;
    },
    isArmed() {
      return armed;
    },
    setMuted(next: boolean) {
      muted = next;
    },
    setVolume() {
      /* volume is exercised in audioEngine.test.ts; irrelevant to the cursor */
    },
    play(clipUrl: string) {
      if (!armed || muted) return;
      played.push(clipUrl);
    },
  };
  return { engine, played };
}

/** Fabricates a minimal UIState carrying only the supplied notableEvents. */
function uiStateWith(notableEvents: NotableGameEvent[]): UIState {
  return { notableEvents } as unknown as UIState;
}

function fightEvent(cardId: string): NotableGameEvent {
  return {
    type: 'fightResolved',
    playerId: '0',
    cardId,
    citySpace: 0,
    bystandersRescued: 0,
    appliedEffects: [],
    narrative: `Fought "${cardId}".`,
  };
}

function ambushEvent(revealedCardId: string): NotableGameEvent {
  return {
    type: 'ambushResolved',
    revealedCardId,
    citySpace: 1,
    appliedEffects: [],
    narrative: `"${revealedCardId}" ambushed.`,
  };
}

function healEvent(woundsHealed: number): NotableGameEvent {
  return {
    type: 'healResolved',
    playerId: '0',
    woundsHealed,
    narrative: `Healed ${woundsHealed} Wound(s).`,
  };
}

describe('useSoundEffects (WP-412 §D) — safe-skip', () => {
  test('null snapshot never plays and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('undefined notableEvents never plays and never throws', async () => {
    const snapshot = ref<UIState | null>(
      { notableEvents: undefined } as unknown as UIState,
    );
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });
});

describe('useSoundEffects (WP-412 §D) — catch-up cursor (no history replay)', () => {
  test('does not play for events present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([fightEvent('pre-mount')]));
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('a remount against an already-populated snapshot replays nothing', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([fightEvent('a'), ambushEvent('b')]));
    const first = makeRecordingEngine();
    useSoundEffects(snapshot, first.engine);
    await nextTick();
    // A fresh consumer instance (simulated remount) against the same snapshot.
    const second = makeRecordingEngine();
    useSoundEffects(snapshot, second.engine);
    await nextTick();
    assert.deepEqual(second.played, []);
  });
});

describe('useSoundEffects (WP-412 §D) — per newly-appended event', () => {
  test('plays exactly one clip for a single new event', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith([fightEvent('thug')]);
    await nextTick();
    assert.deepEqual(played, [sfxManifest.fightResolved]);
  });

  test('plays one clip per new event, in notableEvents array order', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith([
      fightEvent('alpha'),
      ambushEvent('beta'),
      healEvent(1),
    ]);
    await nextTick();
    assert.deepEqual(played, [
      sfxManifest.fightResolved,
      sfxManifest.ambushResolved,
      sfxManifest.healResolved,
    ]);
  });

  test('enqueues every unseen event across a skipped frame (snapshot gap)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { engine, played } = makeRecordingEngine();
    useSoundEffects(snapshot, engine);
    await nextTick();

    // The intermediate length-1 frame is never observed; length jumps to 2.
    snapshot.value = uiStateWith([fightEvent('frame-2'), ambushEvent('frame-3')]);
    await nextTick();
    assert.deepEqual(played, [sfxManifest.fightResolved, sfxManifest.ambushResolved]);
  });
});

describe('useSoundEffects (WP-412 §D) — respects mute', () => {
  test('a muted engine plays nothing for a newly-appended event', async () => {
    const snapshot = ref<UIState | null>(uiStateWith([]));
    const { engine, played } = makeRecordingEngine();
    engine.setMuted(true);
    useSoundEffects(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith([fightEvent('silent')]);
    await nextTick();
    assert.deepEqual(played, []);
  });
});
