/**
 * Pinia store factory for the preferences subsystem.
 *
 * At instantiation time this reads the current section-registry snapshot,
 * composes a Zod envelope from it, loads any stored value from
 * localStorage, validates + migrates it, and exposes typed reset / import /
 * export actions. A post-flush watcher persists mutations back to
 * localStorage with a quota guard.
 *
 * Corruption safety: any failure in load / validate / migrate falls back
 * to defaults and copies the corrupt blob to a backup key. Any failure on
 * write is logged once and degraded to in-memory. No unhandled throw
 * escapes the store — see the §Debuggability contract in the WP-068
 * packet.
 */

import { defineStore } from "pinia";
import { reactive, readonly, watch } from "vue";
import {
  buildPreferencesSchema,
  migratePreferences,
  PREFERENCES_SCHEMA_VERSION,
  type Preferences,
} from "../schema/base.schema";
import { getRegisteredSections } from "../registry/sectionRegistry";
import {
  backupCorrupt,
  readEnvelope,
  writeEnvelope,
} from "./persistence";

export const STORAGE_KEY = "legendary-arena.preferences";
export const BACKUP_KEY = "legendary-arena.preferences.backup";

/**
 * Builds a fully-populated defaults object by parsing an empty envelope
 * through the composed schema. Every registered section's Zod defaults
 * fill in, producing a deterministic baseline used for `buildDefaults`,
 * `resetAll`, and `resetSection`.
 */
function buildDefaults(): Preferences {
  const schema = buildPreferencesSchema();
  const seed: Record<string, unknown> = {
    version: PREFERENCES_SCHEMA_VERSION,
  };
  for (const [sectionId] of getRegisteredSections()) {
    seed[sectionId] = {};
  }
  return schema.parse(seed) as Preferences;
}

/**
 * Loads preferences from localStorage, with corruption fallback to
 * defaults + backup. Never throws.
 */
function loadFromStorage(): Preferences {
  const schema = buildPreferencesSchema();
  const raw = readEnvelope(STORAGE_KEY);
  if (raw === null) {
    // why: readEnvelope returns null for both "no stored value" and "stored
    // value exists but is not valid JSON". The two cases differ only in
    // whether a backup is warranted — probe localStorage directly to
    // distinguish, and back up the corrupt blob if one was present.
    let storedRaw: string | null = null;
    try {
      storedRaw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      // why: private browsing or no-storage environment. There is nothing
      // to back up and nothing to distinguish; fall through to defaults.
      console.warn("[prefs] localStorage probe failed", error);
    }
    if (storedRaw !== null) {
      backupCorrupt(STORAGE_KEY, BACKUP_KEY);
    }
    return buildDefaults();
  }
  const migrated = migratePreferences(raw);
  const parsed = schema.safeParse(migrated);
  if (!parsed.success) {
    // why: Zod rejected the stored blob (schema drift, user tampering,
    // or a v1 value that migration didn't rescue). Copy the bad blob
    // to the backup key for support, then return defaults so the UI
    // keeps working.
    console.warn(
      "[prefs] stored preferences failed validation; resetting to defaults",
      parsed.error,
    );
    backupCorrupt(STORAGE_KEY, BACKUP_KEY);
    return buildDefaults();
  }
  return parsed.data as Preferences;
}

export const usePreferencesStore = defineStore("preferences", () => {
  const state = reactive<Preferences>(loadFromStorage());

  /** Persist on every mutation; quota failures degrade to in-memory. */
  watch(
    () => JSON.stringify(state),
    (serialized) => {
      const ok = writeEnvelope(STORAGE_KEY, JSON.parse(serialized));
      if (!ok) {
        // why: already logged inside writeEnvelope; surface one higher-level
        // line here so the category ("prefs.persist-failed") is searchable.
        console.warn("[prefs] persist failed; running in-memory this session");
      }
    },
    { flush: "post" },
  );

  function resetAll(): void {
    Object.assign(state, buildDefaults());
  }

  function resetSection<K extends keyof Preferences>(section: K): void {
    const defaults = buildDefaults();
    // why: TypeScript cannot narrow a generic indexed write across the
    // unioned section value types — each section has a distinct shape,
    // so `state[K] = defaults[K]` is not provably sound at the language
    // level. The runtime shapes are guaranteed to match because both
    // sides come from the same composed schema.
    (state as Record<string, unknown>)[section as string] = defaults[section];
  }

  function importJson(json: string): boolean {
    const schema = buildPreferencesSchema();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      // why: caller passed a non-JSON string (import-file picker with a
      // binary file, truncated clipboard paste, etc.). Return false so
      // the UI can show an error without the caller needing to wrap
      // `importJson` itself in try/catch.
      console.warn("[prefs] importJson JSON parse failed", error);
      return false;
    }
    const migrated = migratePreferences(parsed);
    const result = schema.safeParse(migrated);
    if (!result.success) {
      console.warn("[prefs] importJson schema validation failed", result.error);
      return false;
    }
    Object.assign(state, result.data);
    return true;
  }

  function exportJson(): string {
    return JSON.stringify(state, null, 2);
  }

  return {
    state: readonly(state),
    mutable: state,
    resetAll,
    resetSection,
    importJson,
    exportJson,
  };
});
