import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PREFERENCES_SCHEMA_VERSION,
  buildPreferencesSchema,
  migratePreferences,
} from "./base.schema";
import { AppearancePrefsSchema } from "./appearance.schema";
import { AccessibilityPrefsSchema } from "./accessibility.schema";
import { AdvancedBasePrefsSchema } from "./advancedBase.schema";
import {
  registerSection,
  resetRegistryForTests,
} from "../registry/sectionRegistry";

function registerSharedThree(): void {
  resetRegistryForTests();
  registerSection("appearance", AppearancePrefsSchema, null);
  registerSection("accessibility", AccessibilityPrefsSchema, null);
  registerSection("advancedBase", AdvancedBasePrefsSchema, null);
}

test("PREFERENCES_SCHEMA_VERSION is the literal integer 2", () => {
  assert.equal(PREFERENCES_SCHEMA_VERSION, 2);
});

test("PreferencesSchema.parse({ empties }) returns defaults from plan §2.3 field-by-field", () => {
  registerSharedThree();
  const schema = buildPreferencesSchema();
  const parsed = schema.parse({
    version: 2,
    appearance: {},
    accessibility: {},
    advancedBase: {},
  }) as {
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

  assert.equal(parsed.version, 2);

  assert.equal(parsed.appearance.themeMode, "dark");
  assert.equal(parsed.appearance.accentColor, "#7070e0");
  assert.equal(parsed.appearance.fontScale, 1.0);
  assert.equal(parsed.appearance.fontFamily, "system");

  assert.equal(parsed.accessibility.reduceMotion, "auto");
  assert.equal(parsed.accessibility.smoothScroll, true);
  assert.equal(parsed.accessibility.focusRingBold, false);
  assert.equal(parsed.accessibility.glossaryShortcut, "Mod+K");
  assert.equal(parsed.accessibility.escapeClosesLightboxFirst, true);
  assert.equal(parsed.accessibility.showFloatingGlossaryFab, "auto");

  assert.equal(parsed.advancedBase.verboseDevLog, false);
});

test("migratePreferences is a pass-through for v2 payloads", () => {
  const input = {
    version: 2,
    appearance: { themeMode: "light" },
    accessibility: {},
    advancedBase: {},
  };
  const output = migratePreferences(input);
  assert.equal(output, input);
});

test("buildPreferencesSchema composes the exact three shared sections when they are registered", () => {
  registerSharedThree();
  const schema = buildPreferencesSchema();
  const shape = Object.keys(schema.shape).sort();
  assert.deepEqual(shape, [
    "accessibility",
    "advancedBase",
    "appearance",
    "version",
  ]);
});
