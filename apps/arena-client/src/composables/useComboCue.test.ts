import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useComboCue } from './useComboCue';
import { comboCueManifest } from '../audio/comboCueManifest';
import { createAudioEngine, type AudioEngine, type HowlFactory } from '../audio/audioEngine';

/**
 * A recording stand-in for the WP-412 audio engine: it captures each played
 * clip URL (honoring its own mute gate) so the consumer's value-change
 * behaviour is asserted without a real Howl.
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
    setVolume() {
      /* volume is exercised in audioEngine.test.ts; irrelevant to the cue logic */
    },
    play(clipUrl: string) {
      if (muted) return;
      played.push(clipUrl);
    },
  };
  return { engine, played };
}

/** Fabricates a minimal UIState carrying only `game.lastPlayEffectsFired`. */
function uiStateWith(lastPlayEffectsFired: number): UIState {
  return { game: { lastPlayEffectsFired } } as unknown as UIState;
}

describe('useComboCue (WP-413) — safe-skip', () => {
  test('null snapshot never plays and never throws', async () => {
    const snapshot = ref<UIState | null>(null);
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('absent game.lastPlayEffectsFired never plays and never throws', async () => {
    const snapshot = ref<UIState | null>({ game: {} } as unknown as UIState);
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });
});

describe('useComboCue (WP-413) — catch-up (no pre-mount cue)', () => {
  test('does not play for the value present on the first valid frame', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(3));
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();
    assert.deepEqual(played, []);
  });
});

describe('useComboCue (WP-413) — audible value-change', () => {
  test('plays the matching tier clip on each audible value-change', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith(1);
    await nextTick();
    assert.deepEqual(played, [comboCueManifest.small]);

    snapshot.value = uiStateWith(2);
    await nextTick();
    assert.deepEqual(played, [comboCueManifest.small, comboCueManifest.medium]);

    snapshot.value = uiStateWith(5);
    await nextTick();
    assert.deepEqual(played, [
      comboCueManifest.small,
      comboCueManifest.medium,
      comboCueManifest.big,
    ]);
  });

  test('no cue on a change into the silent none tier (e.g. the per-turn reset to 0)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(2));
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick(); // catch up at 2 (no cue)

    snapshot.value = uiStateWith(0);
    await nextTick();
    assert.deepEqual(played, []);
  });

  test('coalesces two consecutive equal non-zero counts in one turn (documented v1 limitation)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith(2);
    await nextTick();
    // A second play with the same count pushes a NEW snapshot object (the watch
    // fires) but the scalar value is unchanged — so it coalesces to one cue.
    snapshot.value = uiStateWith(2);
    await nextTick();
    assert.deepEqual(played, [comboCueManifest.medium]);
  });

  test('re-arms an equal value across a per-turn reset (3 -> 0 -> 3 fires twice)', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { engine, played } = makeRecordingEngine();
    useComboCue(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith(3);
    await nextTick();
    snapshot.value = uiStateWith(0); // play-phase onBegin reset (silent)
    await nextTick();
    snapshot.value = uiStateWith(3); // first play of the new turn, same count
    await nextTick();
    assert.deepEqual(played, [comboCueManifest.big, comboCueManifest.big]);
  });
});

describe('useComboCue (WP-413) — integration with the real WP-412 engine', () => {
  // why: the recording-engine tests above prove useComboCue's value-change
  // logic, but a recording mock's play() always records — it would hide the
  // real engine only playing PRELOADED (sfxManifest) URLs. This drives the
  // actual createAudioEngine so the EC-448 lazy-load amendment is exercised
  // end-to-end: an audible change must construct + play the combo clip through
  // the real play() path.
  test('an audible change lazily loads + plays the combo clip through createAudioEngine', async () => {
    const created = new Map<string, { plays: number }>();
    const factory: HowlFactory = ({ src }) => {
      const source = src[0] ?? '';
      const clip = {
        plays: 0,
        play() {
          this.plays += 1;
          return this.plays;
        },
        volume() {},
      };
      created.set(source, clip);
      return clip;
    };
    const engine = createAudioEngine(factory);
    engine.arm();

    const snapshot = ref<UIState | null>(uiStateWith(0));
    useComboCue(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith(2);
    await nextTick();
    assert.equal(created.get(comboCueManifest.medium)?.plays, 1);
  });
});

describe('useComboCue (WP-413) — respects mute', () => {
  test('a muted engine plays nothing on an audible value-change', async () => {
    const snapshot = ref<UIState | null>(uiStateWith(0));
    const { engine, played } = makeRecordingEngine();
    engine.setMuted(true);
    useComboCue(snapshot, engine);
    await nextTick();

    snapshot.value = uiStateWith(3);
    await nextTick();
    assert.deepEqual(played, []);
  });
});
