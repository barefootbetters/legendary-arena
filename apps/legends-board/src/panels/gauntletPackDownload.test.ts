import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildGauntletPackDocument,
  buildGauntletPackFilename,
  serializeGauntletPack,
} from "./gauntletPackDownload.ts";

/**
 * Pure-logic tests for the client-side gauntlet-pack download (WP-441 /
 * EC-476). The Blob/anchor trigger is DOM-bound and covered by the dev-server
 * smoke; these pin the identity-only shape, the default solo/fixed selection,
 * the locked filename convention, and the serialize round-trip.
 */

describe("buildGauntletPackDocument", () => {
  it("builds the identity-only pack for the default solo/fixed selection", () => {
    const pack = buildGauntletPackDocument({
      setAbbr: "core",
      mastermindSlug: "magneto",
      division: "fixed",
      playerCount: 1,
    });
    assert.deepEqual(pack, {
      pack_version: 1,
      gauntlet: {
        setAbbr: "core",
        mastermindSlug: "magneto",
        division: "fixed",
        playerCount: 1,
      },
    });
  });

  it("carries ONLY pack_version + gauntlet, and never any run/composition data", () => {
    const pack = buildGauntletPackDocument({
      setAbbr: "core",
      mastermindSlug: "magneto",
      division: "open",
      playerCount: 5,
    });
    assert.deepEqual(Object.keys(pack).sort(), ["gauntlet", "pack_version"]);
    assert.deepEqual(Object.keys(pack.gauntlet).sort(), [
      "division",
      "mastermindSlug",
      "playerCount",
      "setAbbr",
    ]);
    // why: an identity pack must never carry run data (D-24260 identity-only) —
    // assert the composition keys a leaked builder could smuggle are absent.
    const forbiddenKeys = [
      "legs",
      "heroDeckIds",
      "heroes",
      "villainGroupIds",
      "henchmanGroupIds",
    ];
    for (const forbiddenKey of forbiddenKeys) {
      assert.equal(forbiddenKey in pack, false);
      assert.equal(forbiddenKey in pack.gauntlet, false);
    }
  });
});

describe("buildGauntletPackFilename", () => {
  it("uses the locked gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json convention", () => {
    assert.equal(
      buildGauntletPackFilename({
        setAbbr: "core",
        mastermindSlug: "magneto",
        division: "fixed",
        playerCount: 1,
      }),
      "gauntlet-core-magneto-fixed-p1.gauntlet.json",
    );
    assert.equal(
      buildGauntletPackFilename({
        setAbbr: "core",
        mastermindSlug: "magneto",
        division: "open",
        playerCount: 5,
      }),
      "gauntlet-core-magneto-open-p5.gauntlet.json",
    );
  });
});

describe("serializeGauntletPack", () => {
  it("pretty-prints and round-trips through JSON", () => {
    const pack = buildGauntletPackDocument({
      setAbbr: "dkpr",
      mastermindSlug: "loki",
      division: "open",
      playerCount: 3,
    });
    assert.equal(serializeGauntletPack(pack), JSON.stringify(pack, null, 2));
    assert.deepEqual(JSON.parse(serializeGauntletPack(pack)), pack);
  });
});
