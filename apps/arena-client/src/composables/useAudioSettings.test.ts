import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import {
  useAudioSettings,
  AUDIO_MUTED_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
  MUSIC_VOLUME_KEY,
} from './useAudioSettings';
import { DEFAULT_SFX_VOLUME, type AudioEngine } from '../audio/audioEngine';
import { DEFAULT_MUSIC_VOLUME, type MusicEngine } from '../audio/musicEngine';

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

/** A recording music-engine stub capturing the gates pushed to it. */
function makeRecordingMusicEngine(): {
  engine: MusicEngine;
  muted: boolean[];
  enabled: boolean[];
  volumes: number[];
} {
  const muted: boolean[] = [];
  const enabled: boolean[] = [];
  const volumes: number[] = [];
  const engine: MusicEngine = {
    arm() {},
    isArmed() {
      return true;
    },
    setMuted(next: boolean) {
      muted.push(next);
    },
    setEnabled(next: boolean) {
      enabled.push(next);
    },
    setVolume(level: number) {
      volumes.push(level);
    },
    crossfadeTo() {},
    stop() {},
    currentTrackUrl() {
      return null;
    },
  };
  return { engine, muted, enabled, volumes };
}

describe('useAudioSettings — music channel (WP-560)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('music defaults ON with a volume below the SFX default', () => {
    // why: D-24369 §4 — music defaults on because a silent feature ships as no
    // feature, and below SFX level because a bed at cue volume drowns the very
    // stings it frames.
    const sfx = makeRecordingEngine();
    const music = makeRecordingMusicEngine();

    const { isMusicEnabled, musicVolume } = useAudioSettings(sfx.engine, music.engine);

    assert.equal(isMusicEnabled.value, true);
    assert.equal(musicVolume.value < DEFAULT_SFX_VOLUME, true);
    assert.equal(music.enabled.at(-1), true);
  });

  test('AC-6: the MASTER mute silences music as well as SFX', () => {
    // why: a player who mutes expects silence from the whole client, not just
    // the cues.
    const sfx = makeRecordingEngine();
    const music = makeRecordingMusicEngine();
    const { isMuted } = useAudioSettings(sfx.engine, music.engine);

    isMuted.value = true;

    return nextTick().then(() => {
      assert.equal(sfx.muted.at(-1), true);
      assert.equal(music.muted.at(-1), true);
    });
  });

  test('AC-6: the music toggle silences music WITHOUT silencing SFX', () => {
    const sfx = makeRecordingEngine();
    const music = makeRecordingMusicEngine();
    const { isMusicEnabled } = useAudioSettings(sfx.engine, music.engine);
    const sfxMutesBefore = sfx.muted.length;

    isMusicEnabled.value = false;

    return nextTick().then(() => {
      assert.equal(music.enabled.at(-1), false);
      assert.equal(
        sfx.muted.length,
        sfxMutesBefore,
        'toggling music must not touch the SFX mute gate',
      );
    });
  });

  test('the music toggle and volume persist across a reload', () => {
    const first = makeRecordingMusicEngine();
    const settings = useAudioSettings(makeRecordingEngine().engine, first.engine);
    settings.isMusicEnabled.value = false;
    settings.musicVolume.value = 0.1;

    return nextTick().then(() => {
      const second = makeRecordingMusicEngine();
      const rehydrated = useAudioSettings(makeRecordingEngine().engine, second.engine);
      assert.equal(rehydrated.isMusicEnabled.value, false);
      assert.equal(rehydrated.musicVolume.value, 0.1);
    });
  });

  test('a corrupt persisted music volume falls back to the default', () => {
    localStorage.setItem(MUSIC_VOLUME_KEY, 'not-a-number');
    const music = makeRecordingMusicEngine();

    const { musicVolume } = useAudioSettings(makeRecordingEngine().engine, music.engine);

    assert.equal(musicVolume.value, DEFAULT_MUSIC_VOLUME);
  });
});
