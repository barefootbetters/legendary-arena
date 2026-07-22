import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import {
  useAudioSettings,
  AUDIO_MUTED_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
} from './useAudioSettings';
import { DEFAULT_SFX_VOLUME, type AudioEngine } from '../audio/audioEngine';

/** A recording engine stub that captures the last mute / volume pushed to it. */
function makeRecordingEngine(): { engine: AudioEngine; muted: boolean[]; volumes: number[] } {
  const muted: boolean[] = [];
  const volumes: number[] = [];
  const engine: AudioEngine = {
    arm() {},
    isArmed() {
      return true;
    },
    setMuted(next: boolean) {
      muted.push(next);
    },
    setVolume(level: number) {
      volumes.push(level);
    },
    play() {},
  };
  return { engine, muted, volumes };
}

describe('useAudioSettings (WP-412 §E) — defaults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to unmuted + moderate volume when nothing is stored', () => {
    const { engine } = makeRecordingEngine();
    const { isMuted, volume } = useAudioSettings(engine);
    assert.equal(isMuted.value, false);
    assert.equal(volume.value, DEFAULT_SFX_VOLUME);
  });

  test('applies the rehydrated settings to the engine on setup', () => {
    const { engine, muted, volumes } = makeRecordingEngine();
    useAudioSettings(engine);
    assert.deepEqual(muted, [false]);
    assert.deepEqual(volumes, [DEFAULT_SFX_VOLUME]);
  });
});

describe('useAudioSettings (WP-412 §E) — persistence round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('muting persists to localStorage and rehydrates', async () => {
    const first = makeRecordingEngine();
    const { isMuted } = useAudioSettings(first.engine);
    isMuted.value = true;
    await nextTick();
    assert.equal(localStorage.getItem(AUDIO_MUTED_STORAGE_KEY), 'true');

    const second = makeRecordingEngine();
    const rehydrated = useAudioSettings(second.engine);
    assert.equal(rehydrated.isMuted.value, true);
  });

  test('changing volume persists to localStorage and rehydrates', async () => {
    const first = makeRecordingEngine();
    const { volume } = useAudioSettings(first.engine);
    volume.value = 0.3;
    await nextTick();
    assert.equal(localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY), '0.3');

    const second = makeRecordingEngine();
    const rehydrated = useAudioSettings(second.engine);
    assert.equal(rehydrated.volume.value, 0.3);
  });

  test('a settings change is pushed to the engine', async () => {
    const { engine, muted, volumes } = makeRecordingEngine();
    const { isMuted, volume } = useAudioSettings(engine);
    isMuted.value = true;
    volume.value = 0.25;
    await nextTick();
    // The setup-time apply is index 0; the reactive changes follow.
    assert.deepEqual(muted, [false, true]);
    assert.deepEqual(volumes, [DEFAULT_SFX_VOLUME, 0.25]);
  });
});

describe('useAudioSettings (WP-412 §E) — corruption-safe load', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('a non-numeric stored volume falls back to the default', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, 'not-a-number');
    const { engine } = makeRecordingEngine();
    const { volume } = useAudioSettings(engine);
    assert.equal(volume.value, DEFAULT_SFX_VOLUME);
  });

  test('an out-of-range stored volume falls back to the default', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, '9');
    const { engine } = makeRecordingEngine();
    const { volume } = useAudioSettings(engine);
    assert.equal(volume.value, DEFAULT_SFX_VOLUME);
  });

  test('any non-"true" stored mute value reads as unmuted', () => {
    localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, 'garbage');
    const { engine } = makeRecordingEngine();
    const { isMuted } = useAudioSettings(engine);
    assert.equal(isMuted.value, false);
  });

  test('storage keys match the WP-412 locked contract values', () => {
    assert.equal(AUDIO_MUTED_STORAGE_KEY, 'arenaClientAudioMuted');
    assert.equal(AUDIO_VOLUME_STORAGE_KEY, 'arenaClientAudioVolume');
  });
});
