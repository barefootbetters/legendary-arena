/**
 * useTheme.ts
 *
 * Day/night theme toggle for the arena-client. The brand tokens
 * (`brand-tokens.local.css`, loaded in `index.html`) already ship a full dark
 * palette under `html[data-theme="dark"]`; this composable is the missing
 * toggle — it flips that attribute, persists the choice, and exposes the state
 * to a `<ThemeToggle>` button.
 *
 * Load-time application is done by an inline script in `index.html` (before the
 * stylesheets paint, to avoid a flash of the wrong theme). That script reads the
 * same `localStorage` key this composable writes, so the two stay in sync: the
 * script decides the initial theme (saved choice, else the OS
 * `prefers-color-scheme`), and this composable reads the applied attribute back
 * as its initial reactive value.
 *
 * Single module-scope ref shared across all callers (the WP-121 / WP-124
 * single-key preferences pattern), so the header toggle and any other consumer
 * observe the same theme.
 */

import { ref, type Ref } from 'vue';

/** localStorage key — MUST match the inline init script in `index.html`. */
const THEME_STORAGE_KEY = 'arenaClientTheme';

export type ThemeName = 'light' | 'dark';

/**
 * Reads the theme the `index.html` init script already applied to `<html>`, so
 * the reactive state matches what the user actually sees on first paint. Absent
 * the `data-theme` attribute, the app is in its light default.
 */
function readAppliedTheme(): ThemeName {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') {
    return 'dark';
  }
  return 'light';
}

// why: module-scope ref so every `useTheme()` caller shares one reactive theme
// (the single-key preferences precedent). Initialized from the already-applied
// attribute rather than re-reading localStorage, so it can never disagree with
// the paint the init script produced.
const activeTheme: Ref<ThemeName> = ref(readAppliedTheme());

/**
 * Applies the theme to `<html>`: `dark` sets `data-theme="dark"` (activating the
 * brand-token dark palette), `light` removes the attribute (the `:root` default).
 */
function applyThemeToDocument(theme: ThemeName): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Persists the theme choice. `localStorage` can throw (private mode, disabled
 * site data); the in-memory state + applied attribute still hold for the
 * session, so a failed write is swallowed with a full-sentence reason.
 */
function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // why: a failed persist is non-fatal — the theme is already applied to the
    // document and held in the shared ref for this session; only the
    // across-reload memory is lost, which is acceptable and must not break the UI.
    console.warn(
      `[theme] Could not persist the '${theme}' theme preference to localStorage; it will apply for this session only. Underlying cause: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

/**
 * Returns the shared theme ref plus setters. Consumers read `activeTheme`
 * (reactive) and call `toggleTheme()` (day ⇄ night) or `setTheme(name)`.
 */
export function useTheme(): {
  activeTheme: Ref<ThemeName>;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
} {
  function setTheme(theme: ThemeName): void {
    activeTheme.value = theme;
    applyThemeToDocument(theme);
    persistTheme(theme);
  }

  function toggleTheme(): void {
    setTheme(activeTheme.value === 'dark' ? 'light' : 'dark');
  }

  return { activeTheme, setTheme, toggleTheme };
}

/** Test-only reset of the shared module-scope theme ref. */
export function __resetThemeForTests(next: ThemeName = 'light'): void {
  activeTheme.value = next;
}
