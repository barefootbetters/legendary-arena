/**
 * sfxManifest.ts
 *
 * Maps each of the six notable game event types to the CC0 sound-effect clip
 * played when that event resolves (WP-412 Surface 1 coverage). The keys are
 * the `NotableGameEventType` discriminators the center-screen overlay already
 * keys on (`NotableEventOverlay.vue`); the values are absolute clip URLs.
 *
 * Audio bytes are NOT committed to git — the clips are hosted on R2 and served
 * via `images.legendary-arena.com` under the `audio/sound-effects/` prefix (the
 * ewiki Sound Effects hosting rule). This module carries URLs only.
 *
 * @see WP-412 §C "Clip manifest"
 * @see DECISIONS.md D-24224 (audio-layer foundation; CC0-first, R2-hosted)
 */

import type { NotableGameEvent } from '../composables/useNotableEventStream';

/**
 * The six notable-event discriminators, derived type-only from the engine
 * union (via the `NotableGameEvent` alias) so this module never names the
 * engine union directly — the same runtime-safe-surface discipline
 * `useNotableEventStream` follows.
 */
export type SfxEventKey = NotableGameEvent['type'];

// why: audio bytes live on R2, served via images.legendary-arena.com under the
// audio/sound-effects/ prefix (the ewiki hosting rule) — never in git. Clip
// filenames use hyphens, not underscores (the repo image-URL convention).
const SFX_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';

/**
 * Exhaustive map of every `NotableGameEventType` variant to its CC0 clip URL.
 * The `Record<SfxEventKey, string>` type is the load-bearing drift pin: adding a
 * seventh engine event variant fails `vue-tsc` here until it is mapped, and the
 * `sfxManifest.test.ts` drift test fails if any of the six is unmapped or empty.
 */
export const sfxManifest: Record<SfxEventKey, string> = {
  fightResolved: `${SFX_BASE_URL}villain-defeated.mp3`,
  ambushResolved: `${SFX_BASE_URL}ambush.mp3`,
  schemeTwistResolved: `${SFX_BASE_URL}scheme-twist.mp3`,
  mastermindStrikeResolved: `${SFX_BASE_URL}master-strike.mp3`,
  // why: the Mastermind defeat is the match's peak reward, so it fires the full
  // victory-theme fanfare (`mastermind-defeated-win.mp3`) rather than the short
  // `mastermind-defeated.mp3` sting. This clip is larger (~1.3 MB vs ~20 KB), so
  // it adds weight to the up-front preload (audioEngine preloads every manifest
  // clip) — accepted so the fanfare plays instantly on the defeat, with no
  // load-latency at the victory moment.
  mastermindDefeated: `${SFX_BASE_URL}mastermind-defeated-win.mp3`,
  healResolved: `${SFX_BASE_URL}heal.mp3`,
};
