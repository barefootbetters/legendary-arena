import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useWoundCue } from './useWoundCue';
import { WOUND_GAINED_CLIP } from '../audio/woundCueManifest';
import { type AudioEngine } from '../audio/audioEngine';

/**
 * A recording stand-in for the WP-412 audio engine: it captures each played clip
 * URL (honoring its own mute gate) so the consumer's value-change behaviour is
 * asserted without a real Howl.
 */
function makeRecordingEngine(): { engine: AudioEngine; played: string[] } {
  const played: string[] = [];
  let muted = false;
  const engine: AudioEngine = {
    arm() {},
    isArmed() {
      return true;
    },
    setMuted(next: boolean) {
      muted = next;
    },
    setVolume() {},
    play(clipUrl: string) {
      if (muted) return;
      played.push(clipUrl);
    },
  };
  return { engine, played };
}

/** Fabricates a UIState whose LOCAL seat (the one with `handCards`) has `woundCount`. */
function ownFrame(woundCount: number): UIState {
  return { players: [{ handCards: [], woundCount }] } as unknown as UIState;
}

describe('useWoundCue (WP-650) — safe-skip', () => {
  test('null snapshot never plays and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { engine, played } = makeRecordingEngine();
    useWoundCue(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('a frame with no own seat never plays', async () => {
    const snapshot = ref<UIState | null>({ players: [{ woundCount: 2 }] } as unknown as UIState);
    const { engine, played } = makeRecordingEngine();
    useWoundCue(snapshot, engine);
    await nextTick();
    snapshot.value = { players: [{ woundCount: 3 }] } as unknown as UIState;
    await nextTick();
    assert.deepEqual(played, []);
  });
});

describe('useWoundCue (WP-650) — catch-up (no pre-mount cue)', () => {
  test('does not play for the wound total present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(ownFrame(3));
    const { engine, played } = makeRecordingEngine();
    useWoundCue(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });
});

describe('useWoundCue (WP-650) — fires on increase only', () => {
  test('plays the wound thud on each wound-count increase', async () => {
    const snapshot = ref<UIState | null>(ownFrame(0));
    const { engine, played } = makeRecordingEngine();
    useWoundCue(snapshot, engine);
    await nextTick();

    snapshot.value = ownFrame(1);
    await nextTick();
    assert.deepEqual(played, [WOUND_GAINED_CLIP]);

    snapshot.value = ownFrame(2);
    await nextTick();
    assert.deepEqual(played, [WOUND_GAINED_CLIP, WOUND_GAINED_CLIP]);
  });

  test('a heal (wound count decreases) plays nothing', async () => {
    const snapshot = ref<UIState | null>(ownFrame(2));
    const { engine, played } = makeRecordingEngine();
    useWoundCue(snapshot, engine);
    await nextTick(); // seed at 2

    snapshot.value = ownFrame(0);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('respects mute — a muted engine plays nothing on a new wound', async () => {
    const snapshot = ref<UIState | null>(ownFrame(0));
    const { engine, played } = makeRecordingEngine();
    engine.setMuted(true);
    useWoundCue(snapshot, engine);
    await nextTick();

    snapshot.value = ownFrame(1);
    await nextTick();
    assert.deepEqual(played, []);
  });
});
