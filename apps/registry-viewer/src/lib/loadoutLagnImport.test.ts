/**
 * loadoutLagnImport.test.ts — node:test coverage for the Loadout-tab LAGN
 * importer (WP-291 / EC-323 / D-24075).
 *
 * Covers the EC-323 §Required Test Matrix:
 *  - parseLagnLoadout rejects non-JSON text with a full-sentence error.
 *  - parseLagnLoadout rejects a non-LAGN object (e.g. a MATCH-SETUP document
 *    pasted into the LAGN box) via the published validator.
 *  - a valid LAGN file maps to the five composition fields + four counts +
 *    player count, with the shield_officers_count -> officersCount rename and
 *    the group[] -> ids[] expansion proven.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { parseLagnLoadout } from "./loadoutLagnImport.js";

/** A complete, valid LAGN Tier-1 object (mirrors WP-245's export shape). */
function makeValidLagnText(): string {
  return JSON.stringify({
    lagn_version: "1.0.0",
    $schema: "https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json",
    game_id: "11111111-2222-4333-8444-555555555555",
    variant: "cooperative",
    player_count: 3,
    setup: {
      mastermind: { id: "dkcy/apocalypse", name: "" },
      scheme: { id: "xmen/nuclear-armageddon", name: "" },
      villain_groups: [
        { id: "dkcy/four-horsemen", name: "" },
        { id: "dkcy/marauders", name: "" },
      ],
      henchmen_groups: [{ id: "dkcy/phalanx", name: "" }],
      heroes: [
        { id: "core/wolverine", name: "" },
        { id: "core/storm", name: "" },
        { id: "core/gambit", name: "" },
      ],
      bystanders_count: 30,
      wounds_count: 30,
      shield_officers_count: 30,
      sidekicks_count: 0,
    },
    result: { outcome: "victory" },
  });
}

describe("parseLagnLoadout — rejection paths", () => {
  it("rejects non-JSON text with a full-sentence error", () => {
    const result = parseLagnLoadout("this is not json {");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errors.length >= 1, true);
      assert.match(result.errors[0] ?? "", /could not be parsed as JSON/);
    }
  });

  it("rejects a MATCH-SETUP document pasted into the LAGN box", () => {
    // why: a MATCH-SETUP doc has schemaVersion/composition, not lagn_version/setup,
    // so the published LAGN validator rejects it — the user gets real errors
    // instead of an empty composition.
    const matchSetup = JSON.stringify({
      schemaVersion: "1.0",
      setupId: "setup-x",
      composition: { schemeId: "core/x", mastermindId: "core/y" },
    });
    const result = parseLagnLoadout(matchSetup);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errors.length >= 1, true);
    }
  });
});

describe("parseLagnLoadout — valid LAGN extraction", () => {
  it("maps a valid LAGN file to the composition fields, counts, and player count", () => {
    const result = parseLagnLoadout(makeValidLagnText());
    assert.equal(result.ok, true);
    if (result.ok) {
      const c = result.composition;
      assert.equal(c.schemeId, "xmen/nuclear-armageddon");
      assert.equal(c.mastermindId, "dkcy/apocalypse");
      assert.equal(c.playerCount, 3);
      assert.equal(c.bystandersCount, 30);
      assert.equal(c.woundsCount, 30);
      // why: the only renamed field — LAGN shield_officers_count -> officersCount.
      assert.equal(c.officersCount, 30);
      assert.equal(c.sidekicksCount, 0);
    }
  });

  it("expands each group[] into its id[] (the membership the loadout stores)", () => {
    const result = parseLagnLoadout(makeValidLagnText());
    assert.equal(result.ok, true);
    if (result.ok) {
      const c = result.composition;
      assert.deepEqual(c.villainGroupIds, ["dkcy/four-horsemen", "dkcy/marauders"]);
      assert.deepEqual(c.henchmanGroupIds, ["dkcy/phalanx"]);
      assert.deepEqual(c.heroDeckIds, ["core/wolverine", "core/storm", "core/gambit"]);
    }
  });
});
