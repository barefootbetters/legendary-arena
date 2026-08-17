import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { useAdaptiveMusic } from './useAdaptiveMusic';
import { menaceMusicManifest } from '../audio/menaceMusicManifest';
import type { MusicEngine } from '../audio/musicEngine';

interface EngineCalls {
  crossfades: string[];
  stops: number;
}

/** A recording stand-in for the music engine. */
function makeMockEngine(): { engine: MusicEngine; calls: EngineCalls } {
  const calls: EngineCalls = { crossfades: [], stops: 0 };
  let current: string | null = null;
  const engine: MusicEngine = {
    arm: () => {},
    isArmed: () => true,
    setMuted: () => {},
    setEnabled: () => {},
    setVolume: () => {},
    crossfadeTo: (url: string) => {
      calls.crossfades.push(url);
      current = url;
    },
    stop: () => {
      calls.stops = calls.stops + 1;
      current = null;
    },
    currentTrackUrl: () => current,
  };
  return { engine, calls };
}

/**
 * Builds a minimal UIState carrying just the fields this consumer reads.
 *
 * @param progress - Menace fields to project.
 * @param gameOver - Present ⇒ the match has ended.
 * @returns A UIState-shaped fixture.
 */
function makeSnapshot(
  progress: { menace?: number; menaceTier?: 'calm' | 'rising' | 'critical' },
  gameOver?: { outcome: string; reason: string },
): UIState {
  const state = {
    progress: { bystandersRescued: 0, escapedVillains: 0, ...progress },
  } as unknown as UIState;
  if (gameOver !== undefined) {
    (state as { gameOver?: unknown }).gameOver = gameOver;
  }
  return state;
}

describe('useAdaptiveMusic (WP-560) — tier-driven crossfade', () => {
  let mock: ReturnType<typeof makeMockEngine>;

  beforeEach(() => {
    mock = makeMockEngine();
  });

  test('starts the bed on the first frame carrying a tier', async () => {
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    snapshot.value = makeSnapshot({ menace: 0.1, menaceTier: 'calm' });

    await nextTick();

    assert.deepEqual(mock.calls.crossfades, [menaceMusicManifest.calm]);
  });

  test('AC-3: crossfades on a tier CHANGE', async () => {
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    // why: one `await nextTick()` per assignment. Vue's watcher coalesces
    // multiple writes within a single tick to the LAST value, so batching the
    // three writes would silently skip `rising` and test something other than
    // the escalation. In production each snapshot arrives on its own frame,
    // which is what this models.
    snapshot.value = makeSnapshot({ menace: 0.1, menaceTier: 'calm' });
    await nextTick();
    snapshot.value = makeSnapshot({ menace: 0.5, menaceTier: 'rising' });
    await nextTick();
    snapshot.value = makeSnapshot({ menace: 0.9, menaceTier: 'critical' });
    await nextTick();

    assert.deepEqual(mock.calls.crossfades, [
      menaceMusicManifest.calm,
      menaceMusicManifest.rising,
      menaceMusicManifest.critical,
    ]);
  });

  test('AC-3: an unchanged tier does NOT retrigger, even as menace moves', async () => {
    // why: the tier is a scalar re-projected every frame, not an event stream.
    // Without the last-seen guard the bed restarts constantly — immediately
    // audible as a stuttering loop that never settles.
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    snapshot.value = makeSnapshot({ menace: 0.35, menaceTier: 'rising' });
    await nextTick();
    snapshot.value = makeSnapshot({ menace: 0.45, menaceTier: 'rising' });
    await nextTick();
    snapshot.value = makeSnapshot({ menace: 0.6, menaceTier: 'rising' });
    await nextTick();

    assert.equal(mock.calls.crossfades.length, 1);
  });

  test('AC-4: the tier is consumed verbatim — never re-derived from menace', async () => {
    // why: a deliberately INCONSISTENT pair. A menace of 0.9 would be
    // `critical` under the engine's bands, but the projection says `calm`.
    // The channel must play the CALM track, proving it reads `menaceTier`
    // rather than re-banding the scalar. If it ever re-derives, this score and
    // the WP-558 Danger Meter can disagree about what "critical" means.
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    snapshot.value = makeSnapshot({ menace: 0.9, menaceTier: 'calm' });

    await nextTick();

    assert.deepEqual(mock.calls.crossfades, [menaceMusicManifest.calm]);
    assert.equal(
      mock.calls.crossfades.includes(menaceMusicManifest.critical),
      false,
    );
  });
});

describe('useAdaptiveMusic (WP-560) — absence and lifecycle', () => {
  let mock: ReturnType<typeof makeMockEngine>;

  beforeEach(() => {
    mock = makeMockEngine();
  });

  test('a null snapshot plays nothing and leaves the consumer un-seeded', async () => {
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    assert.equal(mock.calls.crossfades.length, 0);

    snapshot.value = makeSnapshot({ menace: 0.1, menaceTier: 'calm' });

    await nextTick();
    assert.equal(mock.calls.crossfades.length, 1);
  });

  test('an absent tier plays nothing — an old fixture or a recorded replay', async () => {
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    snapshot.value = makeSnapshot({});

    await nextTick();

    assert.equal(mock.calls.crossfades.length, 0);
  });

  test('AC-7: the bed stops at gameOver and does not resume', async () => {
    // why: D-24369 §5 — the win/loss/tie sting is a separate Surface-4 packet,
    // so the correct behaviour today is silence, not a loop that outlives the
    // match under the endgame panel.
    const snapshot = ref<UIState | null>(null);
    useAdaptiveMusic(snapshot, mock.engine);

    snapshot.value = makeSnapshot({ menace: 0.9, menaceTier: 'critical' });

    await nextTick();
    assert.equal(mock.calls.crossfades.length, 1);

    snapshot.value = makeSnapshot(
      { menace: 1, menaceTier: 'critical' },
      { outcome: 'scheme-wins', reason: 'The scheme has been completed.' },
    );

    await nextTick();

    assert.equal(mock.calls.stops, 1);
    assert.equal(mock.calls.crossfades.length, 1);
  });
});
