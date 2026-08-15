/**
 * loadoutImportFormat.test.ts — node:test coverage for the import format sniff
 * (WP-551 / EC-586 / D-24360).
 *
 * Every assertion lands on the PURE helper. `apps/registry-viewer` has no SFC
 * test harness — its test script is `node --import tsx --test "src/**\/*.test.ts"`
 * with no `@vue/test-utils`, `jsdom`, or `vue-sfc-loader` — so box-level
 * behaviour (the redirect replacing the validator dump, and the draft staying
 * untouched) is gated by the D-24026 live-verify instead. That is the same trade
 * shipped WP-549 made for its own `.vue` wiring; do not build a harness here.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  sniffLoadoutImportFormat,
  redirectSentenceFor,
  type LoadoutImportBox,
  type LoadoutImportFormat,
} from "./loadoutImportFormat.js";

/** A minimal document carrying only the pair under test. */
function documentWith(entries: Record<string, unknown>): string {
  return JSON.stringify(entries);
}

const MATCH_SETUP_TEXT = documentWith({ schemaVersion: "1.0", composition: {} });
const LAGN_TEXT = documentWith({ lagn_version: "1.4.0", setup: {} });
const PACK_TEXT = documentWith({ pack_version: 1, gauntlet: {} });

describe("sniffLoadoutImportFormat — positive detection", () => {
  it("identifies each format from its discriminator pair", () => {
    assert.equal(sniffLoadoutImportFormat(MATCH_SETUP_TEXT), "match-setup");
    assert.equal(sniffLoadoutImportFormat(LAGN_TEXT), "lagn");
    assert.equal(sniffLoadoutImportFormat(PACK_TEXT), "gauntlet-pack");
  });

  it("ignores extra keys around a valid pair", () => {
    const text = documentWith({ lagn_version: "1.4.0", setup: {}, game_id: "x", variant: "solo" });
    assert.equal(sniffLoadoutImportFormat(text), "lagn");
  });
});

describe("sniffLoadoutImportFormat — unknown (AC-4)", () => {
  it("returns unknown for malformed and non-JSON text", () => {
    assert.equal(sniffLoadoutImportFormat("this is not json {"), "unknown");
    assert.equal(sniffLoadoutImportFormat(""), "unknown");
  });

  it("returns unknown for JSON that is not an object", () => {
    assert.equal(sniffLoadoutImportFormat("[]"), "unknown");
    assert.equal(sniffLoadoutImportFormat("null"), "unknown");
    assert.equal(sniffLoadoutImportFormat('"a string"'), "unknown");
    assert.equal(sniffLoadoutImportFormat("42"), "unknown");
  });

  it("returns unknown for an empty object", () => {
    assert.equal(sniffLoadoutImportFormat("{}"), "unknown");
  });

  it("returns unknown on a PARTIAL pair — both keys are required", () => {
    // why: positive-only detection. A truncated or hand-edited file deserves the
    // real validator errors, not a confidently wrong redirect.
    assert.equal(sniffLoadoutImportFormat(documentWith({ lagn_version: "1.4.0" })), "unknown");
    assert.equal(sniffLoadoutImportFormat(documentWith({ setup: {} })), "unknown");
    assert.equal(sniffLoadoutImportFormat(documentWith({ schemaVersion: "1.0" })), "unknown");
    assert.equal(sniffLoadoutImportFormat(documentWith({ composition: {} })), "unknown");
    assert.equal(sniffLoadoutImportFormat(documentWith({ pack_version: 1 })), "unknown");
    assert.equal(sniffLoadoutImportFormat(documentWith({ gauntlet: {} })), "unknown");
  });

  it("returns unknown when a document satisfies TWO pairs", () => {
    // why: LAGN is `additionalProperties: true`, so a third-party file could
    // legally carry a second format's pair. A file that looks like two formats
    // is one we cannot confidently redirect — no precedence, no coin-flip.
    const twoPairs = documentWith({
      lagn_version: "1.4.0",
      setup: {},
      schemaVersion: "1.0",
      composition: {},
    });
    assert.equal(sniffLoadoutImportFormat(twoPairs), "unknown");
  });

  it("does not treat a gauntlet CONFIG's schemaVersion as a MATCH-SETUP", () => {
    // why: `schemaVersion` is also used by packages/registry gauntletConfigs for
    // a different artifact. Single-key detection would misfire; the pair rule
    // means it falls through to the real validator errors.
    assert.equal(sniffLoadoutImportFormat(documentWith({ schemaVersion: 1, legs: [] })), "unknown");
  });
});

describe("redirectSentenceFor — all six wrong-box pairings (AC-1, AC-2)", () => {
  const EXPECTED: ReadonlyArray<[LoadoutImportBox, LoadoutImportFormat, string]> = [
    [
      "match-setup",
      "lagn",
      'This looks like a LAGN file (it has a "lagn_version" field). Use the "Load LAGN" box below instead.',
    ],
    [
      "match-setup",
      "gauntlet-pack",
      'This looks like a Gauntlet Pack (it has a "pack_version" field). Use the "Load Gauntlet Pack" box below instead.',
    ],
    [
      "lagn",
      "match-setup",
      'This looks like a MATCH-SETUP document (it has a "schemaVersion" field). Use the "Load JSON" box above instead.',
    ],
    [
      "lagn",
      "gauntlet-pack",
      'This looks like a Gauntlet Pack (it has a "pack_version" field). Use the "Load Gauntlet Pack" box below instead.',
    ],
    [
      "gauntlet-pack",
      "match-setup",
      'This looks like a MATCH-SETUP document (it has a "schemaVersion" field). Use the "Load JSON" box above instead.',
    ],
    [
      "gauntlet-pack",
      "lagn",
      'This looks like a LAGN file (it has a "lagn_version" field). Use the "Load LAGN" box above instead.',
    ],
  ];

  for (const [box, detected, sentence] of EXPECTED) {
    it(`${box} box receiving ${detected} names the right box`, () => {
      assert.equal(redirectSentenceFor(box, detected), sentence);
    });
  }

  it("AC-1 regression: the pairing observed live reads exactly as locked", () => {
    assert.equal(
      redirectSentenceFor("match-setup", sniffLoadoutImportFormat(LAGN_TEXT)),
      'This looks like a LAGN file (it has a "lagn_version" field). Use the "Load LAGN" box below instead.',
    );
  });
});

describe("redirectSentenceFor — no redirect (AC-3)", () => {
  it("returns null when the box receives its OWN format", () => {
    assert.equal(redirectSentenceFor("match-setup", "match-setup"), null);
    assert.equal(redirectSentenceFor("lagn", "lagn"), null);
    assert.equal(redirectSentenceFor("gauntlet-pack", "gauntlet-pack"), null);
  });

  it("returns null for unknown, so the real validator errors still surface", () => {
    assert.equal(redirectSentenceFor("match-setup", "unknown"), null);
    assert.equal(redirectSentenceFor("lagn", "unknown"), null);
    assert.equal(redirectSentenceFor("gauntlet-pack", "unknown"), null);
  });
});
