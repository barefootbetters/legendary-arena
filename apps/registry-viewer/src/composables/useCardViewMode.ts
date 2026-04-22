/**
 * useCardViewMode.ts
 * Shared state for the card image-vs-data view toggle.
 *
 * Components call toggleViewMode() to flip between rendering a card's
 * image (default) and its structured FlatCard data. The selection is
 * persisted to localStorage under the key 'cardViewMode' so it survives
 * page reloads. The ref is module-scoped so all consumers of the
 * composable share a single source of truth across the app.
 *
 * Public API (exactly two names):
 *   - viewMode: Ref<'image' | 'data'>
 *   - toggleViewMode: () => void
 *
 * A setViewMode setter is intentionally NOT exposed: no known caller
 * needs to set an absolute mode, and exposing dead API surface is
 * prohibited by .claude/rules/architecture.md §"Prohibited AI Failure
 * Patterns" (no API without callers).
 */

import { ref, type Ref } from "vue";

// why: the localStorage key is a flat, camelCase, non-abbreviated string
// matching the existing viewer convention (see useResizable.ts using
// "cardDetailWidth"). No product-wide namespace prefix is used because
// the viewer is a single-origin SPA with no key collisions.
const STORAGE_KEY = "cardViewMode";

type ViewMode = "image" | "data";

// why: localStorage.getItem returns string | null; explicit narrowing
// rejects stale or tampered values that would poison the discriminated
// union and break downstream v-if / switch branches. Anything that is
// not exactly the literal 'data' defaults to 'image' (including null,
// empty string, legacy values, and future unknown modes).
const storedRaw = readStoredRawSafely();
const initialMode: ViewMode = storedRaw === "data" ? "data" : "image";

// why: self-heal malformed or absent localStorage values by writing the
// narrowed initial value back on first load, ensuring the 'image' | 'data'
// invariant holds on every subsequent read from any tab or reload.
persistSafely(initialMode);

const viewMode: Ref<ViewMode> = ref<ViewMode>(initialMode);

/**
 * Returns the shared view-mode state and the toggle function. Both names
 * are module-scoped singletons, so all components see the same value.
 */
export function useCardViewMode(): {
  viewMode: Ref<ViewMode>;
  toggleViewMode: () => void;
} {
  return {
    viewMode,
    toggleViewMode,
  };
}

/**
 * Flips the view mode between 'image' and 'data' and persists the new
 * value to localStorage. The in-memory ref updates before persistence so
 * that a setItem failure leaves the UI in the correct state for the rest
 * of the session.
 */
function toggleViewMode(): void {
  const nextMode: ViewMode = viewMode.value === "image" ? "data" : "image";
  viewMode.value = nextMode;
  persistSafely(nextMode);
}

/**
 * Reads the raw localStorage value for the view-mode key. Returns null
 * if the key is absent. getItem does not throw in modern browsers even
 * when storage is fully inaccessible, so no try/catch is required here.
 */
function readStoredRawSafely(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Writes the view mode to localStorage, swallowing any failure. Called
 * both at mount-time (self-heal) and from toggleViewMode().
 */
function persistSafely(mode: ViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // why: localStorage.setItem may throw in iOS Safari private browsing
    // mode or when the storage quota is exceeded (enterprise group-policy
    // restrictions also surface as throws on some platforms). The
    // in-memory viewMode ref has already been updated by the caller, so
    // the UI remains fully functional for the rest of the session — only
    // cross-reload persistence is lost. Silent swallow preserves UX per
    // 00.6 Rule 11 (full-sentence swallow documentation required).
  }
}
