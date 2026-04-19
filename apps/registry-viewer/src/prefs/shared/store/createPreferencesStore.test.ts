import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal in-memory localStorage implementation. Installed on `globalThis`
// BEFORE the store / persistence modules are imported so their top-level
// `localStorage.getItem(...)` calls see the stub.
class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    storage;
  return storage;
}

// Install a default stub so the `setActivePinia` / `createPinia` modules do
// not see `undefined` when they are first loaded by the dynamic imports
// below.
installStorage();

const { createPinia, setActivePinia } = await import("pinia");
const { registerSection, resetRegistryForTests } = await import(
  "../registry/sectionRegistry"
);
const { AppearancePrefsSchema } = await import("../schema/appearance.schema");
const { AccessibilityPrefsSchema } = await import(
  "../schema/accessibility.schema"
);
const { AdvancedBasePrefsSchema } = await import(
  "../schema/advancedBase.schema"
);
const { usePreferencesStore, STORAGE_KEY, BACKUP_KEY } = await import(
  "./createPreferencesStore"
);

function registerSharedThree(): void {
  resetRegistryForTests();
  registerSection("appearance", AppearancePrefsSchema, null);
  registerSection("accessibility", AccessibilityPrefsSchema, null);
  registerSection("advancedBase", AdvancedBasePrefsSchema, null);
}

type StoreState = {
  version: 2;
  appearance: {
    themeMode: string;
    accentColor: string;
    fontScale: number;
    fontFamily: string;
  };
  accessibility: {
    reduceMotion: string;
    smoothScroll: boolean;
    focusRingBold: boolean;
    glossaryShortcut: string;
    escapeClosesLightboxFirst: boolean;
    showFloatingGlossaryFab: string;
  };
  advancedBase: { verboseDevLog: boolean };
};

beforeEach(() => {
  installStorage();
  setActivePinia(createPinia());
  registerSharedThree();
});

test("fresh store with empty localStorage loads the plan §2.3 defaults field-for-field", () => {
  const store = usePreferencesStore();
  const state = store.state as unknown as StoreState;

  assert.equal(state.version, 2);
  assert.equal(state.appearance.themeMode, "dark");
  assert.equal(state.appearance.accentColor, "#7070e0");
  assert.equal(state.appearance.fontScale, 1.0);
  assert.equal(state.appearance.fontFamily, "system");
  assert.equal(state.accessibility.reduceMotion, "auto");
  assert.equal(state.accessibility.smoothScroll, true);
  assert.equal(state.accessibility.focusRingBold, false);
  assert.equal(state.accessibility.glossaryShortcut, "Mod+K");
  assert.equal(state.accessibility.escapeClosesLightboxFirst, true);
  assert.equal(state.accessibility.showFloatingGlossaryFab, "auto");
  assert.equal(state.advancedBase.verboseDevLog, false);
});

test("resetSection('appearance') restores appearance only; other sections untouched", () => {
  const store = usePreferencesStore();
  const mutable = store.mutable as unknown as StoreState;

  mutable.appearance.themeMode = "light";
  mutable.accessibility.smoothScroll = false;
  mutable.advancedBase.verboseDevLog = true;

  store.resetSection("appearance");

  const state = store.state as unknown as StoreState;
  assert.equal(state.appearance.themeMode, "dark");
  // Untouched:
  assert.equal(state.accessibility.smoothScroll, false);
  assert.equal(state.advancedBase.verboseDevLog, true);
});

test("resetAll() restores every section to defaults", () => {
  const store = usePreferencesStore();
  const mutable = store.mutable as unknown as StoreState;

  mutable.appearance.themeMode = "light";
  mutable.accessibility.smoothScroll = false;
  mutable.advancedBase.verboseDevLog = true;

  store.resetAll();

  const state = store.state as unknown as StoreState;
  assert.equal(state.appearance.themeMode, "dark");
  assert.equal(state.accessibility.smoothScroll, true);
  assert.equal(state.advancedBase.verboseDevLog, false);
});

test("importJson(exportJson()) is a no-op round-trip", () => {
  const store = usePreferencesStore();
  const mutable = store.mutable as unknown as StoreState;
  mutable.appearance.themeMode = "light";
  mutable.accessibility.focusRingBold = true;

  const exported = store.exportJson();
  const before = JSON.stringify(store.state);
  const ok = store.importJson(exported);
  const after = JSON.stringify(store.state);

  assert.equal(ok, true);
  assert.equal(before, after);
});

test("importJson(validJson) returns true and mutates state", () => {
  const store = usePreferencesStore();
  const desired = {
    version: 2,
    appearance: {
      themeMode: "light",
      accentColor: "#abcdef",
      fontScale: 1.25,
      fontFamily: "sans",
    },
    accessibility: {
      reduceMotion: "on",
      smoothScroll: false,
      focusRingBold: true,
      glossaryShortcut: "Mod+Shift+G",
      escapeClosesLightboxFirst: false,
      showFloatingGlossaryFab: "always",
    },
    advancedBase: { verboseDevLog: true },
  };
  const ok = store.importJson(JSON.stringify(desired));
  assert.equal(ok, true);
  const state = store.state as unknown as StoreState;
  assert.equal(state.appearance.themeMode, "light");
  assert.equal(state.accessibility.reduceMotion, "on");
  assert.equal(state.advancedBase.verboseDevLog, true);
});

test("importJson('not json') returns false and leaves state untouched", () => {
  const store = usePreferencesStore();
  const before = JSON.stringify(store.state);
  const ok = store.importJson("not json");
  const after = JSON.stringify(store.state);

  assert.equal(ok, false);
  assert.equal(before, after);
});

test("importJson(schema-invalid JSON) returns false and leaves state untouched", () => {
  const store = usePreferencesStore();
  const before = JSON.stringify(store.state);
  const ok = store.importJson(JSON.stringify({ version: 2, appearance: { themeMode: "plaid" } }));
  const after = JSON.stringify(store.state);

  assert.equal(ok, false);
  assert.equal(before, after);
});

test("corrupt localStorage blob loads defaults AND copies the bad value to the backup key", () => {
  const storage = installStorage();
  storage.setItem(STORAGE_KEY, "not json");
  setActivePinia(createPinia());
  registerSharedThree();

  const store = usePreferencesStore();
  const state = store.state as unknown as StoreState;
  assert.equal(state.appearance.themeMode, "dark");
  assert.equal(storage.getItem(BACKUP_KEY), "not json");
});
