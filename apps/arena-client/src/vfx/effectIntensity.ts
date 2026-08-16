/**
 * effectIntensity.ts
 *
 * The persisted, app-wide **Effect Intensity** preference for the WP-556 VFX
 * layer, plus the OS `prefers-reduced-motion` read and the `shouldRender`
 * accessibility gate every VFX consumer consults. Module-level singleton state
 * (mirrors the audio settings shape) so the control (`AudioControls`), the
 * overlay (`VfxOverlay`), and any future consumer share ONE reactive value.
 *
 * why: this is the day-one accessibility gate the VFX Trigger Contract makes
 * mandatory — the arena client had NEITHER a `prefers-reduced-motion` path NOR
 * an intensity control before this WP. The UNIFIED control governs both the
 * visual intensity/off AND (via the caller in `AudioControls`) the audio
 * mute/volume, so a single "off" silences the whole feel layer. A disabled or
 * reduced state degrades to no effects with full gameplay parity — the VFX
 * layer is pure presentation and never gates play.
 *
 * @see WP-556 §C "Effect-Intensity preference"
 * @see apps/arena-client/src/composables/useAudioSettings.ts (the persistence precedent)
 * @see DECISIONS.md D-24365 (the unified control + the VFX determinism exemption)
 */

import { ref, type Ref } from 'vue';

/** Effect-Intensity levels: fully off, a reduced set, or the full treatment. */
export type EffectIntensity = 'off' | 'low' | 'full';

/** The visual-effect classes the gate discriminates. A LOCKED narrow union — never raw `string`. */
export type VfxKind = 'shake' | 'particles' | 'word';

// why: arenaClient-prefixed camelCase localStorage key, matching the
// prefs/persistence.ts / useAudioSettings.ts convention — the prefix avoids
// collisions with any registry-viewer key sharing the dev origin.
const INTENSITY_STORAGE_KEY = 'arenaClientEffectIntensity';
const VALID_INTENSITIES: readonly EffectIntensity[] = ['off', 'low', 'full'];
const DEFAULT_INTENSITY: EffectIntensity = 'full';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reads the persisted intensity; defaults to `full` when the key is absent or
 * holds anything other than a valid level (corruption-safe).
 */
function loadIntensity(): EffectIntensity {
  if (typeof localStorage === 'undefined') return DEFAULT_INTENSITY;
  const raw = localStorage.getItem(INTENSITY_STORAGE_KEY);
  return VALID_INTENSITIES.includes(raw as EffectIntensity)
    ? (raw as EffectIntensity)
    : DEFAULT_INTENSITY;
}

/**
 * Writes the intensity synchronously, swallowing any `setItem` failure with a
 * Rule-11 comment (the reactive ref is already updated, so only cross-reload
 * persistence is lost — mirrors useAudioSettings.saveMuted).
 */
function saveIntensity(intensity: EffectIntensity): void {
  try {
    localStorage.setItem(INTENSITY_STORAGE_KEY, intensity);
  } catch {
    // why: localStorage.setItem may throw in iOS Safari private mode, on quota
    // exhaustion, or under enterprise storage restrictions. The reactive ref
    // has already updated in the same tick, so the session stays fully
    // functional; only cross-reload persistence is lost.
  }
}

/**
 * Reads the OS reduced-motion preference. Guarded for jsdom / SSR where
 * `matchMedia` may be absent — defaults to `false` (no reduction) so a missing
 * API never suppresses the whole feel layer.
 */
function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// why: module-level singletons — ONE shared reactive intensity + reduced-motion
// value across the control, the overlay, and every consumer (like the audio
// settings singleton). Initialised at import time from localStorage + the OS
// query.
const intensity: Ref<EffectIntensity> = ref(loadIntensity());
const prefersReducedMotion: Ref<boolean> = ref(readReducedMotion());

// why: track live OS reduced-motion changes so a mid-session toggle (a user
// enabling reduced-motion in their OS while playing) takes effect without a
// reload. Guarded for jsdom / SSR. Registered once at module load.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  // why: addEventListener('change', …) is the modern API; the deprecated
  // addListener is not needed for the browsers arena-client targets.
  query.addEventListener('change', (event) => {
    prefersReducedMotion.value = event.matches;
  });
}

/** Sets the intensity and persists it. */
function setIntensity(next: EffectIntensity): void {
  intensity.value = next;
  saveIntensity(next);
}

/**
 * The accessibility gate every VFX consumer consults before rendering an effect
 * of the given kind. The rules:
 *
 * - `off` intensity ⇒ nothing renders (the master kill-switch).
 * - the call-out **word** renders whenever intensity is not `off` — it survives
 *   reduced-motion (as a plain fade) so the reward stays legible.
 * - **particles** render at `low`/`full` intensity, but NOT under
 *   `prefers-reduced-motion`.
 * - **shake** — the heaviest effect — renders only at `full` intensity and NOT
 *   under reduced-motion.
 *
 * @param kind - the visual-effect class (a locked narrow union).
 * @returns whether an effect of that kind may render right now.
 */
function shouldRender(kind: VfxKind): boolean {
  if (intensity.value === 'off') return false;
  if (kind === 'word') return true;
  if (prefersReducedMotion.value) return false;
  if (kind === 'particles') return true;
  // kind === 'shake' — the heaviest, reserved for full intensity only.
  return intensity.value === 'full';
}

/**
 * Returns the shared reactive Effect-Intensity state + gate. All callers get
 * the SAME singleton refs, so the control and the overlay stay in sync.
 */
export function useEffectIntensity(): {
  intensity: Ref<EffectIntensity>;
  prefersReducedMotion: Ref<boolean>;
  setIntensity: (next: EffectIntensity) => void;
  shouldRender: (kind: VfxKind) => boolean;
} {
  return { intensity, prefersReducedMotion, setIntensity, shouldRender };
}

/** Exported for tests so they can pin the storage key without duplicating the literal. */
export const EFFECT_INTENSITY_STORAGE_KEY = INTENSITY_STORAGE_KEY;

/**
 * Test-only reset of the singleton state to defaults (localStorage-derived
 * intensity + a fresh reduced-motion read), so each test starts clean without
 * a module reload.
 */
export function __resetEffectIntensityForTests(): void {
  intensity.value = loadIntensity();
  prefersReducedMotion.value = readReducedMotion();
}
