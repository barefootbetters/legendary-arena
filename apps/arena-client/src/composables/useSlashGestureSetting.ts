/**
 * useSlashGestureSetting.ts
 *
 * The persisted "Slash to fight" preference for the WP-756 slash gesture. A
 * module-level singleton (mirrors `vfx/effectIntensity.ts`) so the toggle in
 * `AudioControls` and every `CityRow` share ONE reactive value.
 *
 * why: the gesture defaults ON — a completed stroke spends attack exactly as the
 * same clicks would, and the full-crossing rule makes an accidental stroke
 * unlikely. The toggle lets any player switch it off. Flipping the product
 * default is a one-line change to `DEFAULT_IS_ENABLED` below (D-24585).
 *
 * @see WP-756 §C "useSlashGestureSetting.ts"
 * @see DECISIONS.md D-24585 (the slash gesture)
 */

import { ref, type Ref } from 'vue';

// why: arenaClient-prefixed camelCase localStorage key, matching the
// effectIntensity.ts / useAudioSettings.ts convention.
const SLASH_GESTURE_STORAGE_KEY = 'arenaClientSlashGesture';
const DEFAULT_IS_ENABLED = true;

/**
 * Reads the persisted setting. Corruption-safe: only the exact value `'off'`
 * turns the gesture off; an absent key or any other value reads as the default.
 */
function loadIsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return DEFAULT_IS_ENABLED;
  const raw = localStorage.getItem(SLASH_GESTURE_STORAGE_KEY);
  if (raw === 'off') return false;
  if (raw === 'on') return true;
  return DEFAULT_IS_ENABLED;
}

/** Writes the setting synchronously, swallowing any `setItem` failure. */
function saveIsEnabled(isEnabled: boolean): void {
  try {
    localStorage.setItem(SLASH_GESTURE_STORAGE_KEY, isEnabled ? 'on' : 'off');
  } catch {
    // why: localStorage.setItem may throw in iOS Safari private mode, on quota
    // exhaustion, or under enterprise storage restrictions. The reactive ref
    // has already updated in the same tick, so the session keeps working; only
    // cross-reload persistence is lost.
  }
}

// why: module-level singleton — one shared reactive value across the toggle and
// every City row, initialised at import time from localStorage.
const isEnabled: Ref<boolean> = ref(loadIsEnabled());

/** Sets the setting and persists it. */
function setEnabled(next: boolean): void {
  isEnabled.value = next;
  saveIsEnabled(next);
}

/**
 * Returns the shared "Slash to fight" setting. Every caller gets the SAME ref.
 */
export function useSlashGestureSetting(): {
  isEnabled: Ref<boolean>;
  setEnabled: (next: boolean) => void;
} {
  return { isEnabled, setEnabled };
}

/** Exported for tests so they can pin the storage key without duplicating the literal. */
export const SLASH_GESTURE_SETTING_STORAGE_KEY = SLASH_GESTURE_STORAGE_KEY;

/** Test-only reset: re-reads the singleton from localStorage. */
export function __resetSlashGestureSettingForTests(): void {
  isEnabled.value = loadIsEnabled();
}
