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

// ── Support pools round trip (EC-429) ───────────────────────────────────────

describe("parseLagnLoadout support pools", () => {
  it("maps support_pools back, renaming shield_officers to officers", () => {
    const raw = JSON.parse(makeValidLagnText()) as Record<string, unknown>;
    const setup = raw["setup"] as Record<string, unknown>;
    setup["shield_officers_count"] = 20;
    setup["sidekicks_count"] = 2;
    setup["support_pools"] = {
      shield_officers: {
        mode: "explicit",
        cards: [{ ext_id: "shld/melinda-may", copies: 20 }],
      },
      sidekicks: {
        mode: "sets",
        sets: ["cvwr"],
        cards: [{ ext_id: "cvwr/zabu", copies: 2 }],
      },
    };
    raw["lagn_version"] = "1.1.0";

    const result = parseLagnLoadout(JSON.stringify(raw));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // why: LAGN names the officer pool shield_officers to match
    // shield_officers_count (D-24195); the MATCH-SETUP envelope uses officers
    // to match officersCount (D-24194). Asserting the rename is what proves
    // the reverse mapping rather than a passthrough.
    assert.deepEqual(result.composition.supportPools?.officers, {
      mode: "explicit",
      cards: [{ extId: "shld/melinda-may", copies: 20 }],
    });
    assert.deepEqual(result.composition.supportPools?.sidekicks, {
      mode: "sets",
      sets: ["cvwr"],
      cards: [{ extId: "cvwr/zabu", copies: 2 }],
    });
    // why: ext_id -> extId is the other half of the rename; a passthrough would
    // leave snake_case keys the draft cannot read.
    assert.equal(
      (result.composition.supportPools?.officers?.cards[0] as unknown as Record<string, unknown>)[
        "ext_id"
      ],
      undefined,
    );
  });

  it("leaves supportPools undefined for a 1.0.0 record with no pools", () => {
    const result = parseLagnLoadout(makeValidLagnText());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.composition.supportPools, undefined);
  });
});

describe("parseLagnLoadout — result round-trip (WP-549 / D-24358)", () => {
  it("surfaces the imported outcome instead of dropping it", () => {
    // why: the importer used to map only setup + player_count (+ supportPools), so a
    // shared match record's verdict was silently discarded and the re-export
    // fabricated one from a dropdown defaulting to "victory".
    const result = parseLagnLoadout(makeValidLagnText());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.composition.result, { outcome: "victory" });
  });

  it("round-trips a defeat with its loss_condition", () => {
    const lagn = JSON.parse(makeValidLagnText());
    lagn.result = { outcome: "defeat", loss_condition: "city_overrun" };
    const result = parseLagnLoadout(JSON.stringify(lagn));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.composition.result, {
      outcome: "defeat",
      lossCondition: "city_overrun",
    });
  });

  it("leaves result undefined when the record carries no result block", () => {
    const lagn = JSON.parse(makeValidLagnText());
    delete lagn.result;
    const result = parseLagnLoadout(JSON.stringify(lagn));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.composition.result, undefined);
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.composition, "result"),
      false,
      "the key is omitted, never set to undefined",
    );
  });

  it("copies KNOWN keys only — unknown keys never round-trip", () => {
    // why: parseLagnLoadout returns the RAW parsed object (zod's strip never runs)
    // and the schema sets additionalProperties: true, so a spread would carry
    // arbitrary keys out of an untrusted file back into a re-export.
    const lagn = JSON.parse(makeValidLagnText());
    lagn.result = { outcome: "victory", victory_points: 42, junk: "should not survive" };
    const result = parseLagnLoadout(JSON.stringify(lagn));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.composition.result, { outcome: "victory" });
  });
});
