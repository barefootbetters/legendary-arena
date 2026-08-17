/**
 * useAudioSettings.ts
 *
 * Persistent, player-controlled SFX settings for the WP-412 audio layer: a
 * mute toggle and a master volume (0..1), both persisted to `localStorage` and
 * rehydrated on reload. Mirrors the WP-130 `prefs/persistence.ts` shape — a
 * `STORAGE_KEY` constant, a corruption-safe read, and a sync write that
 * swallows failure with a Rule-11 comment.
 *
 * The composable wires the reactive settings straight into the audio engine's
 * mute / volume gate: the rehydrated values are applied on setup, and every
 * subsequent change is pushed to the engine and persisted.
 *
 * @see WP-412 §E "Persistent settings"
 * @see apps/arena-client/src/prefs/persistence.ts (the localStorage precedent)
 * @see DECISIONS.md D-24224 (persistent mute + master volume)
 */

import { ref, watch, type Ref } from 'vue';
import { getAudioEngine, DEFAULT_SFX_VOLUME, type AudioEngine } from '../audio/audioEngine';
import {
  getMusicEngine,
  DEFAULT_MUSIC_VOLUME,
  type MusicEngine,
} from '../audio/musicEngine';

// why: flat camelCase, arenaClient-prefixed localStorage keys matching the
// prefs/persistence.ts convention (`arenaClientPlaymatSkin`) — the prefix
// avoids collisions with any future registry-viewer key sharing the dev origin.
const MUTED_STORAGE_KEY = 'arenaClientAudioMuted';
const VOLUME_STORAGE_KEY = 'arenaClientAudioVolume';
// why: WP-560 — the music channel carries its OWN toggle and level, separate
// from the master mute/volume. D-24369 §4: music is decoration, so it may be
// silenced independently; the master mute still silences BOTH channels.
const MUSIC_ENABLED_STORAGE_KEY = 'arenaClientMusicEnabled';
const MUSIC_VOLUME_STORAGE_KEY = 'arenaClientMusicVolume';

/** Reactive audio settings, both persisted to localStorage. */
export interface AudioSettings {
  /** True ⇒ the engine is muted (no play). Persisted. */
  isMuted: Ref<boolean>;
  /** Master volume, 0..1. Persisted. */
  volume: Ref<number>;
  /** True ⇒ the background music channel plays. Defaults ON. Persisted. */
  isMusicEnabled: Ref<boolean>;
  /** Music volume, 0..1. Defaults below the SFX level. Persisted. */
  musicVolume: Ref<number>;
}

/**
 * Reads the persisted mute flag; defaults to unmuted (`false`) when the key is
 * absent or holds anything other than the literal `'true'`.
 */
function loadMuted(): boolean {
  const raw = readStoredRawSafely(MUTED_STORAGE_KEY);
  return raw === 'true';
}

/**
 * Reads the persisted volume; defaults to `DEFAULT_SFX_VOLUME` when the key is
 * absent, non-numeric, or outside the valid 0..1 range (corruption-safe).
 */
function loadVolume(): number {
  const raw = readStoredRawSafely(VOLUME_STORAGE_KEY);
  if (raw === null) return DEFAULT_SFX_VOLUME;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return DEFAULT_SFX_VOLUME;
  return parsed;
}

/**
 * Writes the mute flag synchronously, swallowing any `setItem` failure with a
 * Rule-11 full-sentence comment (the reactive ref is already updated, so only
 * cross-reload persistence is lost).
 */
function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // why: localStorage.setItem may throw in iOS Safari private mode, on quota
    // exhaustion, or under enterprise storage restrictions. The reactive ref
    // has already updated in the same tick, so the session stays fully
    // functional; only cross-reload persistence is lost (mirrors
    // prefs/persistence.ts:saveActiveSkin).
  }
}

/**
 * Writes the volume synchronously, swallowing any `setItem` failure with the
 * same Rule-11 posture as `saveMuted`.
 */
function saveVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  } catch {
    // why: same localStorage-write failure posture as saveMuted — the reactive
    // ref already reflects the new value, so only cross-reload persistence is
    // lost. Silent swallow per 00.6 Rule 11.
  }
}

/**
 * Reads a raw localStorage value, returning `null` when the key is absent or
 * `localStorage` is wholly unavailable (SSR, sandboxed iframe). `getItem` does
 * not throw in modern browsers, so no try/catch is required around the read.
 */
function readStoredRawSafely(key: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}


/**
 * Reads the persisted music toggle; defaults to ENABLED when the key is absent.
 *
 * why: D-24369 §4 — music defaults ON. A silent feature ships as no feature,
 * and unlike the Danger Meter a soundtrack carries no game state a player
 * loses by turning it off, so an opt-out default is the right trade.
 */
function loadMusicEnabled(): boolean {
  const raw = readStoredRawSafely(MUSIC_ENABLED_STORAGE_KEY);
  if (raw === null) return true;
  return raw !== 'false';
}

/**
 * Reads the persisted music volume; defaults to `DEFAULT_MUSIC_VOLUME` when
 * absent, non-numeric, or out of range (corruption-safe).
 */
function loadMusicVolume(): number {
  const raw = readStoredRawSafely(MUSIC_VOLUME_STORAGE_KEY);
  if (raw === null) return DEFAULT_MUSIC_VOLUME;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return DEFAULT_MUSIC_VOLUME;
  return parsed;
}

/**
 * Writes the music toggle synchronously, same Rule-11 posture as `saveMuted`.
 */
function saveMusicEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // why: same localStorage-write failure posture as saveMuted — the reactive
    // ref already reflects the new value, so only cross-reload persistence is
    // lost. Silent swallow per 00.6 Rule 11.
  }
}

/**
 * Writes the music volume synchronously, same Rule-11 posture as `saveVolume`.
 */
function saveMusicVolume(volume: number): void {
  try {
    localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(volume));
  } catch {
    // why: same localStorage-write failure posture as saveVolume — only
    // cross-reload persistence is lost. Silent swallow per 00.6 Rule 11.
  }
}

/**
 * Clamps a volume into 0..1 so a corrupt input never reaches the engine gate.
 */
function clampVolume(level: number): number {
  if (level < 0) return 0;
  if (level > 1) return 1;
  return level;
}

/**
 * Returns reactive `isMuted` + `volume` refs, rehydrated from localStorage and
 * wired into the audio engine. Changing either ref pushes the new value to the
 * engine and persists it.
 *
 * @param engine - The audio engine to drive; defaults to the module singleton.
 *   The parameter is an injectable seam for unit tests (a mock engine).
 * @returns The reactive `AudioSettings`.
 */
export function useAudioSettings(
  engine: AudioEngine = getAudioEngine(),
  musicEngine: MusicEngine = getMusicEngine(),
): AudioSettings {
  const isMuted = ref<boolean>(loadMuted());
  const volume = ref<number>(loadVolume());
  const isMusicEnabled = ref<boolean>(loadMusicEnabled());
  const musicVolume = ref<number>(loadMusicVolume());

  // Apply the rehydrated settings to both engines immediately on setup.
  engine.setMuted(isMuted.value);
  engine.setVolume(volume.value);
  musicEngine.setMuted(isMuted.value);
  musicEngine.setEnabled(isMusicEnabled.value);
  musicEngine.setVolume(musicVolume.value);

  watch(isMuted, (nextMuted) => {
    engine.setMuted(nextMuted);
    // why: D-24369 §4 — the MASTER mute silences BOTH channels. A player who
    // mutes expects silence from the whole client, not just the cues.
    musicEngine.setMuted(nextMuted);
    saveMuted(nextMuted);
  });

  watch(volume, (nextVolume) => {
    const clamped = clampVolume(nextVolume);
    engine.setVolume(clamped);
    saveVolume(clamped);
  });

  watch(isMusicEnabled, (nextEnabled) => {
    musicEngine.setEnabled(nextEnabled);
    saveMusicEnabled(nextEnabled);
  });

  watch(musicVolume, (nextVolume) => {
    const clamped = clampVolume(nextVolume);
    musicEngine.setVolume(clamped);
    saveMusicVolume(clamped);
  });

  return { isMuted, volume, isMusicEnabled, musicVolume };
}

/**
 * Exported for tests so they can pin the storage keys without duplicating the
 * literal strings. Production callers do not need these directly.
 */
export const AUDIO_MUTED_STORAGE_KEY = MUTED_STORAGE_KEY;
export const AUDIO_VOLUME_STORAGE_KEY = VOLUME_STORAGE_KEY;
export const MUSIC_ENABLED_KEY = MUSIC_ENABLED_STORAGE_KEY;
export const MUSIC_VOLUME_KEY = MUSIC_VOLUME_STORAGE_KEY;
