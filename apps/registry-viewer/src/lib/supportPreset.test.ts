/**
 * supportPreset.test.ts — node:test coverage for Support Preset serialization
 * (WP-391 / EC-428 / D-24200).
 *
 * The load path is the risky one: a preset file is user-supplied, may be
 * hand-edited, and outlives the tab that made it. Every rejection case below
 * corresponds to a way a bad file could otherwise become a draft that fails at
 * match creation.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";
import {
  SUPPORT_PRESET_VERSION,
  buildSupportPreset,
  parseSupportPreset,
  serializeSupportPreset,
  slugifyPresetName,
  supportPresetFilename,
} from "./supportPreset.js";

function buildDraft(overrides: Partial<MatchSetupDocument> = {}): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "setup-test",
    createdAt: "2026-07-19T00:00:00.000Z",
    createdBy: "player",
    seed: "a1b2c3d4e5f6a7b8",
    playerCount: 2,
    expansions: ["base"],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/magneto",
      villainGroupIds: ["core/brotherhood"],
      henchmanGroupIds: ["core/savage-land-mutates"],
      heroDeckIds: ["core/black-widow"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
    ...overrides,
  };
}

const ROUND_TRIP_OPTIONS = {
  name: "Gauntlet harness v1",
  locked: true,
  createdAt: "2026-07-19T00:00:00.000Z",
};

describe("slugifyPresetName", () => {
  it("lowercases, hyphenates, and trims punctuation", () => {
    assert.equal(slugifyPresetName("  Gauntlet Harness v1! "), "gauntlet-harness-v1");
  });

  it("falls back rather than producing an empty id", () => {
    assert.equal(slugifyPresetName("!!!"), "support-preset");
  });
});

describe("buildSupportPreset", () => {
  it("captures all four counts even when no pools are set", () => {
    const preset = buildSupportPreset(buildDraft(), ROUND_TRIP_OPTIONS);
    // why: a kind with no pool is still part of the frozen board. Recording
    // only pools would let bystandersCount drift between two runs of the
    // "same" preset, defeating the comparison it exists to enable.
    assert.deepEqual(preset.counts, {
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    });
    assert.equal(preset.supportPools, undefined);
    assert.equal(preset.locked, true);
  });

  it("deep-copies pools so later draft edits cannot reach the preset", () => {
    const draft = buildDraft({
      supportPools: {
        sidekicks: { mode: "explicit", cards: [{ extId: "cvwr/zabu", copies: 1 }] },
      },
      composition: { ...buildDraft().composition, sidekicksCount: 1 },
    });
    const preset = buildSupportPreset(draft, ROUND_TRIP_OPTIONS);
    draft.supportPools!.sidekicks!.cards[0]!.copies = 99;
    assert.equal(preset.supportPools?.sidekicks?.cards[0]?.copies, 1);
  });

  it("derives a filename from the slugified name", () => {
    const preset = buildSupportPreset(buildDraft(), ROUND_TRIP_OPTIONS);
    assert.equal(supportPresetFilename(preset), "support-preset-gauntlet-harness-v1.json");
  });
});

describe("Support Preset round trip", () => {
  it("survives serialize → parse with pools intact", () => {
    const draft = buildDraft({
      supportPools: {
        wounds: {
          mode: "sets",
          sets: ["core", "wpnx"],
          cards: [
            { extId: "core/wound", copies: 20 },
            { extId: "wpnx/broken-bones", copies: 10 },
          ],
        },
      },
    });
    const preset = buildSupportPreset(draft, ROUND_TRIP_OPTIONS);
    const result = parseSupportPreset(serializeSupportPreset(preset));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // why: serializeSupportPreset uses a replacer ARRAY, which is a WHITELIST —
    // any key missing from it vanishes from the file. This assertion is what
    // keeps that trap closed for nested pool keys.
    assert.deepEqual(result.preset.supportPools, preset.supportPools);
    assert.deepEqual(result.preset.counts, preset.counts);
    assert.equal(result.preset.locked, true);
    assert.equal(result.preset.name, "Gauntlet harness v1");
  });
});

describe("parseSupportPreset rejections", () => {
  const validPreset = () =>
    JSON.parse(serializeSupportPreset(buildSupportPreset(buildDraft(), ROUND_TRIP_OPTIONS))) as Record<
      string,
      unknown
    >;

  it("rejects non-JSON", () => {
    const result = parseSupportPreset("{not json");
    assert.equal(result.ok, false);
  });

  it("rejects an unknown presetVersion", () => {
    const raw = validPreset();
    raw["presetVersion"] = "9.9";
    const result = parseSupportPreset(JSON.stringify(raw));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.error.includes(SUPPORT_PRESET_VERSION));
  });

  it("rejects a count below the engine supply floor", () => {
    // why: catching this at load is the difference between an inline error and
    // an HTTP 400 at match creation (D-24032).
    const raw = validPreset();
    (raw["counts"] as Record<string, number>)["woundsCount"] = 22;
    const result = parseSupportPreset(JSON.stringify(raw));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(/woundsCount/.test(result.error) && /30/.test(result.error));
  });

  it("rejects a pool whose copies disagree with its count", () => {
    const raw = validPreset();
    raw["supportPools"] = {
      wounds: { mode: "explicit", cards: [{ extId: "core/wound", copies: 29 }] },
    };
    const result = parseSupportPreset(JSON.stringify(raw));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(/29/.test(result.error) && /30/.test(result.error));
  });

  it("rejects sets mode without sets, and explicit mode with them", () => {
    const withoutSets = validPreset();
    withoutSets["supportPools"] = {
      wounds: { mode: "sets", cards: [{ extId: "core/wound", copies: 30 }] },
    };
    assert.equal(parseSupportPreset(JSON.stringify(withoutSets)).ok, false);

    const explicitWithSets = validPreset();
    explicitWithSets["supportPools"] = {
      wounds: { mode: "explicit", sets: ["core"], cards: [{ extId: "core/wound", copies: 30 }] },
    };
    assert.equal(parseSupportPreset(JSON.stringify(explicitWithSets)).ok, false);
  });

  it("rejects a zero or negative copies value", () => {
    const raw = validPreset();
    raw["supportPools"] = {
      wounds: { mode: "explicit", cards: [{ extId: "core/wound", copies: 0 }] },
    };
    assert.equal(parseSupportPreset(JSON.stringify(raw)).ok, false);
  });

  it("rejects a malformed presetId", () => {
    const raw = validPreset();
    raw["presetId"] = "Not A Slug";
    assert.equal(parseSupportPreset(JSON.stringify(raw)).ok, false);
  });

  it("rejects a non-boolean locked field", () => {
    const raw = validPreset();
    raw["locked"] = "yes";
    assert.equal(parseSupportPreset(JSON.stringify(raw)).ok, false);
  });
});
