/**
 * audioEngine.ts
 *
 * A thin howler.js wrapper — the arena-client's SFX playback engine (WP-412).
 * It preloads every manifest clip as a `Howl`, exposes `play(clipUrl)`, and
 * applies three gates on every play: an autoplay-unlock arm gate (browser
 * autoplay policy), a master mute gate, and a master volume level.
 *
 * The engine is pure client presentation: it lives module-local to the
 * arena-client, is NEVER stored in `G`, reads no engine state, and adds zero
 * determinism / replay footprint (per ARCHITECTURE.md engine-owns-truth).
 *
 * The real `Howl` is only constructed in the browser via the default factory;
 * unit tests call `createAudioEngine()` with a mock `HowlFactory`, so no Web
 * Audio context is created and no real audio plays (asset-independent tests).
 *
 * @see WP-412 §B "Audio engine"
 * @see DECISIONS.md D-24224 (audio-layer foundation; howler.js wrapper)
 */

import { Howl } from 'howler';
import { sfxManifest } from './sfxManifest';

// why: a conservative moderate default so the first sound a player hears is
// audible but not startling; unmuted by default. Persisted overrides arrive
// via useAudioSettings (localStorage).
export const DEFAULT_SFX_VOLUME = 0.6;

/**
 * The narrow slice of howler's `Howl` this engine drives. Declaring it as a
 * structural interface lets the unit tests inject a mock constructor with no
 * real Web Audio and no real audio playback.
 */
export interface HowlLike {
  /** Starts playback; returns howler's sound id. */
  play(): number;
  /** Sets this clip's playback volume (0..1). */
  volume(level: number): void;
}

/** Builds one preloaded clip. Defaults to a real `Howl`; tests inject a mock. */
export type HowlFactory = (config: { src: string[]; preload: boolean }) => HowlLike;

/**
 * The public audio-engine surface, mounted once per client. Module-local — an
 * `AudioEngine` instance is never placed in `G` or serialized.
 */
export interface AudioEngine {
  /** Arms the audio context on the first user gesture (browser autoplay policy). */
  arm(): void;
  /** Reports whether the context has been armed by a user gesture yet. */
  isArmed(): boolean;
  /** Sets the master mute gate; muted ⇒ `play` is a silent no-op. */
  setMuted(muted: boolean): void;
  /** Sets the master volume, clamped to 0..1, applied on every subsequent play. */
  setVolume(level: number): void;
  /** Plays the preloaded clip for a URL, honoring the arm / mute / volume gates. */
  play(clipUrl: string): void;
}

/**
 * Clamps a requested volume into the valid 0..1 range. Out-of-range inputs
 * (a corrupt persisted value, a future slider bug) collapse to the nearest
 * bound rather than passing an invalid gain to howler.
 */
function clampVolume(level: number): number {
  if (level < 0) return 0;
  if (level > 1) return 1;
  return level;
}

/**
 * Constructs a real howler `Howl` for one clip URL. Reached only in the
 * browser; tests always inject a mock factory instead.
 */
function defaultHowlFactory(config: { src: string[]; preload: boolean }): HowlLike {
  return new Howl({ src: config.src, preload: config.preload });
}

/**
 * Builds a fresh audio engine that preloads every manifest clip up front.
 * Production reaches this through the module singleton (`getAudioEngine`);
 * unit tests call it directly with a mock `HowlFactory`.
 *
 * @param howlFactory - Clip constructor; defaults to the real `Howl`.
 * @returns The gated `AudioEngine` surface.
 */
export function createAudioEngine(howlFactory: HowlFactory = defaultHowlFactory): AudioEngine {
  const clipsByUrl = new Map<string, HowlLike>();
  for (const clipUrl of Object.values(sfxManifest)) {
    if (!clipsByUrl.has(clipUrl)) {
      clipsByUrl.set(clipUrl, howlFactory({ src: [clipUrl], preload: true }));
    }
  }

  let isArmedState = false;
  let isMutedState = false;
  let masterVolume = DEFAULT_SFX_VOLUME;

  function arm(): void {
    isArmedState = true;
  }

  function isArmed(): boolean {
    return isArmedState;
  }

  function setMuted(muted: boolean): void {
    isMutedState = muted;
  }

  function setVolume(level: number): void {
    masterVolume = clampVolume(level);
  }

  function play(clipUrl: string): void {
    // why: unlock gate — no audio before the first user gesture arms the audio
    // context (browser autoplay policy). A pre-arm event is a silent no-op; it
    // is NEVER queued to blast a backlog on unlock.
    if (!isArmedState) return;
    // why: mute / volume gate — muted is a silent no-op; otherwise the master
    // volume is applied to the clip immediately before each play. Neither gate
    // ever throws.
    if (isMutedState) return;
    // why: EC-448 amendment (WP-413) — lazily construct + cache a Howl for any
    // URL the manifest preload did not cover (e.g. a combo-cue clip whose URL
    // is not in sfxManifest), so the engine can play ANY known-good URL, not
    // only the sfxManifest set preloaded at construction. Preloading stays an
    // optimization for the common notable-event clips; the first play of a
    // lazily-added clip loads on demand (howler queues play-until-loaded).
    let clip = clipsByUrl.get(clipUrl);
    if (clip === undefined) {
      clip = howlFactory({ src: [clipUrl], preload: true });
      clipsByUrl.set(clipUrl, clip);
    }
    clip.volume(masterVolume);
    clip.play();
  }

  return { arm, isArmed, setMuted, setVolume, play };
}

let sharedEngine: AudioEngine | null = null;

/**
 * Returns the module-local singleton engine, lazily creating the real
 * howler-backed one on first use. The single shared instance is what
 * `useSoundEffects`, `useAudioSettings`, and `AudioControls` all drive.
 */
export function getAudioEngine(): AudioEngine {
  if (sharedEngine === null) {
    sharedEngine = createAudioEngine();
  }
  return sharedEngine;
}

/**
 * Test-only: seed the singleton with a mock-backed engine so component tests
 * that reach `getAudioEngine()` never construct a real `Howl`. Mirrors the
 * `__resetSkinApplierForTests` precedent.
 */
export function __setAudioEngineForTests(engine: AudioEngine): void {
  sharedEngine = engine;
}

/** Test-only: clear the singleton so the next `getAudioEngine()` rebuilds it. */
export function __resetAudioEngineForTests(): void {
  sharedEngine = null;
}
