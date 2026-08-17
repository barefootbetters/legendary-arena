/**
 * musicEngine.ts
 *
 * The arena-client's adaptive **music** channel (WP-560) — a loop-capable
 * howler.js wrapper, kept deliberately separate from `audioEngine.ts`.
 *
 * why (D-24369 §1): `audioEngine.ts` is strictly FIRE-AND-FORGET. Its
 * `HowlLike` interface exposes exactly `play()` and `volume()`, and nothing in
 * `src/audio/` loops, stops, or fades — every cue shipped to date (WP-412
 * events, WP-413 / WP-425 combo stings, WP-421 move SFX) is a one-shot. A
 * music channel needs looping, crossfading and stopping. Those three methods
 * are added HERE rather than to `HowlLike`, because widening the SFX contract
 * would make every one-shot call site carry a lifecycle it never uses. Do NOT
 * "consolidate" the two engines: the split is the decision, not an accident.
 *
 * Pure client presentation — module-local, never stored in `G`, reads no
 * engine state, zero determinism / replay footprint. The real `Howl` is only
 * constructed in the browser via the default factory; unit tests inject a mock
 * `MusicHowlFactory`, so no Web Audio context is created and the suite is
 * asset-independent.
 *
 * @see WP-560 §Contract
 * @see DECISIONS.md D-24369 (separate music engine; music is decoration)
 */

import { Howl } from 'howler';

// why: the music bed sits UNDER the cues by default (D-24369 §4). A loop at
// SFX level drowns the very stings it is meant to frame, so the default is
// deliberately below `DEFAULT_SFX_VOLUME` (0.6). Persisted overrides arrive via
// useAudioSettings.
export const DEFAULT_MUSIC_VOLUME = 0.25;

// why: the crossfade length between tiers. Long enough that a tier change reads
// as a mood shift rather than a cut, short enough that the new bed lands while
// the moment that caused it is still on screen.
export const MUSIC_CROSSFADE_MS = 1500;

/**
 * The narrow slice of howler's `Howl` the MUSIC engine drives. Wider than the
 * SFX `HowlLike` by exactly the three lifecycle methods a bed needs.
 */
export interface MusicHowlLike {
  /** Starts playback; returns howler's sound id. */
  play(): number;
  /** Stops playback and rewinds. */
  stop(): void;
  /** Sets this track's volume (0..1). */
  volume(level: number): void;
  /** Fades this track from one volume to another over a duration in ms. */
  fade(from: number, to: number, durationMs: number): void;
}

/** Builds one looping track. Defaults to a real `Howl`; tests inject a mock. */
export type MusicHowlFactory = (config: {
  src: string[];
  loop: boolean;
  preload: boolean;
}) => MusicHowlLike;

/**
 * The public music-engine surface, mounted once per client.
 */
export interface MusicEngine {
  /** Arms the audio context on the first user gesture (browser autoplay policy). */
  arm(): void;
  /** Reports whether the context has been armed by a user gesture yet. */
  isArmed(): boolean;
  /** Master mute gate; muted ⇒ the bed is stopped and no track starts. */
  setMuted(muted: boolean): void;
  /** Enables/disables the music channel independently of the master mute. */
  setEnabled(enabled: boolean): void;
  /** Sets the music volume, clamped 0..1. */
  setVolume(level: number): void;
  /** Crossfades to `trackUrl`, or starts it if nothing is playing. */
  crossfadeTo(trackUrl: string): void;
  /** Stops the bed entirely (end of match). */
  stop(): void;
  /** The currently playing track URL, or null. Exposed for tests + diagnostics. */
  currentTrackUrl(): string | null;
}

/**
 * Clamps a requested volume into 0..1 so a corrupt persisted value never
 * reaches howler as an invalid gain.
 */
function clampVolume(level: number): number {
  if (level < 0) return 0;
  if (level > 1) return 1;
  return level;
}

/**
 * Constructs a real looping howler `Howl`. Reached only in the browser.
 */
function defaultMusicHowlFactory(config: {
  src: string[];
  loop: boolean;
  preload: boolean;
}): MusicHowlLike {
  return new Howl({ src: config.src, loop: config.loop, preload: config.preload });
}

/**
 * Builds a music engine.
 *
 * @param musicHowlFactory - Track constructor; defaults to the real `Howl`.
 * @returns The gated `MusicEngine` surface.
 */
export function createMusicEngine(
  musicHowlFactory: MusicHowlFactory = defaultMusicHowlFactory,
): MusicEngine {
  const tracksByUrl = new Map<string, MusicHowlLike>();

  let isArmedState = false;
  let isMutedState = false;
  let isEnabledState = true;
  let musicVolume = DEFAULT_MUSIC_VOLUME;
  let playingUrl: string | null = null;

  /**
   * Lazily constructs and caches the looping track for a URL.
   *
   * @param trackUrl - The R2 track URL.
   * @returns The cached or newly built track.
   */
  function trackFor(trackUrl: string): MusicHowlLike {
    let track = tracksByUrl.get(trackUrl);
    if (track === undefined) {
      track = musicHowlFactory({ src: [trackUrl], loop: true, preload: true });
      tracksByUrl.set(trackUrl, track);
    }
    return track;
  }

  /**
   * Reports whether the channel may currently produce sound.
   *
   * @returns True when armed, unmuted, and music is enabled.
   */
  function canPlay(): boolean {
    return isArmedState && !isMutedState && isEnabledState;
  }

  function arm(): void {
    isArmedState = true;
  }

  function isArmed(): boolean {
    return isArmedState;
  }

  function stop(): void {
    if (playingUrl !== null) {
      trackFor(playingUrl).stop();
      playingUrl = null;
    }
  }

  function setMuted(muted: boolean): void {
    isMutedState = muted;
    // why: unlike a one-shot, a bed is already sounding when the gate flips —
    // muting must silence what is playing, not merely refuse the next start.
    if (muted) stop();
  }

  function setEnabled(enabled: boolean): void {
    isEnabledState = enabled;
    if (!enabled) stop();
  }

  function setVolume(level: number): void {
    musicVolume = clampVolume(level);
    if (playingUrl !== null) {
      trackFor(playingUrl).volume(musicVolume);
    }
  }

  function crossfadeTo(trackUrl: string): void {
    // why: every gate is checked here rather than at the call site, so a
    // consumer can fire freely and the engine stays the single authority on
    // whether sound is allowed. A blocked crossfade is a silent no-op and is
    // NEVER queued to blast on unlock.
    if (!canPlay()) return;
    if (playingUrl === trackUrl) return;

    const nextTrack = trackFor(trackUrl);

    if (playingUrl === null) {
      // why: nothing is playing, so fade IN from silence rather than cutting in
      // at full volume — the first bed of a match should arrive, not appear.
      nextTrack.volume(0);
      nextTrack.play();
      nextTrack.fade(0, musicVolume, MUSIC_CROSSFADE_MS);
      playingUrl = trackUrl;
      return;
    }

    const previousTrack = trackFor(playingUrl);
    previousTrack.fade(musicVolume, 0, MUSIC_CROSSFADE_MS);
    nextTrack.volume(0);
    nextTrack.play();
    nextTrack.fade(0, musicVolume, MUSIC_CROSSFADE_MS);
    playingUrl = trackUrl;
  }

  function currentTrackUrl(): string | null {
    return playingUrl;
  }

  return {
    arm,
    isArmed,
    setMuted,
    setEnabled,
    setVolume,
    crossfadeTo,
    stop,
    currentTrackUrl,
  };
}

let sharedMusicEngine: MusicEngine | null = null;

/**
 * Returns the module-local singleton music engine, lazily creating the real
 * howler-backed one on first use.
 *
 * @returns The shared music engine.
 */
export function getMusicEngine(): MusicEngine {
  if (sharedMusicEngine === null) {
    sharedMusicEngine = createMusicEngine();
  }
  return sharedMusicEngine;
}

/**
 * Test seam — installs a specific engine as the singleton.
 *
 * @param engine - The engine to install.
 */
export function __setMusicEngineForTests(engine: MusicEngine): void {
  sharedMusicEngine = engine;
}

/** Test seam — clears the singleton so the next `getMusicEngine` rebuilds. */
export function __resetMusicEngineForTests(): void {
  sharedMusicEngine = null;
}
