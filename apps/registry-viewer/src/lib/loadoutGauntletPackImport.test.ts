/**
 * loadoutGauntletPackImport.test.ts — node:test coverage for the Loadout-tab
 * Gauntlet-Pack importer (WP-444 / EC-479 / D-24263).
 *
 * Covers the EC-479 §Required Test Matrix:
 *  - parseGauntletPack accepts a valid core/magneto pack and keeps it
 *    identity-only (no legs / heroes / compositions leak in).
 *  - parseGauntletPack rejects a MATCH-SETUP document, a LAGN file, and a
 *    future-version pack, each with a full-sentence message (never throws).
 *  - resolveGauntletLegLoadout at variant 0 produces the expected set-qualified
 *    villains/henchmen + mastermindId + playerCount, and carries NO heroDeckIds.
 *  - resolveGauntletLegLoadout returns unknown-gauntlet (menu undefined) and
 *    unoffered-count (player count absent from the composition record).
 *  - listGauntletLegSchemeIds yields the "{setAbbr}/{schemeSlug}" leg ids.
 *
 * The menu + scheme list are injected (no live registry), so these tests run
 * without any HTTP fetch or bundled registry.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { GauntletLoadoutMenu } from "@legendary-arena/registry/gauntletLoadouts";

import {
  parseGauntletPack,
  resolveGauntletLegLoadout,
  listGauntletLegSchemeIds,
} from "./loadoutGauntletPackImport.js";

/** The exact identity-only pack Jeff downloaded from the legends site. */
function makeValidPackText(): string {
  return JSON.stringify({
    pack_version: 1,
    gauntlet: {
      setAbbr: "core",
      mastermindSlug: "magneto",
      division: "fixed",
      playerCount: 1,
    },
  });
}

/**
 * A minimal injected menu for the core/magneto gauntlet, carrying variant 0 for
 * player counts 1 and 2 only (so an unoffered count is exercisable without a
 * cast to a partial total record).
 */
function makeCoreMagnetoMenu(): GauntletLoadoutMenu {
  return {
    setAbbr: "core",
    mastermindSlug: "magneto",
    variants: [
      {
        variantIndex: 0,
        // why: the type is a total Record over SupportedPlayerCount, but a real
        // generated menu need not carry every count; casting a partial object
        // lets the test exercise the unoffered-count path (count 5 absent).
        compositionsByPlayerCount: {
          1: {
            villainGroupIds: ["core/brotherhood"],
            henchmanGroupIds: ["core/doombot-legion"],
          },
          2: {
            villainGroupIds: ["core/brotherhood", "core/enemies-of-asgard"],
            henchmanGroupIds: ["core/doombot-legion"],
          },
        } as unknown as GauntletLoadoutMenu["variants"][number]["compositionsByPlayerCount"],
      },
    ],
  };
}

describe("parseGauntletPack — valid, identity-only pack", () => {
  it("parses a valid core/magneto pack and keeps it identity-only", () => {
    const result = parseGauntletPack(makeValidPackText());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.pack.pack_version, 1);
      assert.equal(result.pack.gauntlet.setAbbr, "core");
      assert.equal(result.pack.gauntlet.mastermindSlug, "magneto");
      assert.equal(result.pack.gauntlet.division, "fixed");
      assert.equal(result.pack.gauntlet.playerCount, 1);
      // why: the pack is identity-only — the four gauntlet fields and nothing
      // else. A leaked composition/heroes key would mean the strict validator
      // let run data smuggle into the token.
      assert.deepEqual(Object.keys(result.pack).sort(), [
        "gauntlet",
        "pack_version",
      ]);
      const gauntlet = result.pack.gauntlet as unknown as Record<string, unknown>;
      assert.equal(gauntlet["legs"], undefined);
      assert.equal(gauntlet["heroDeckIds"], undefined);
      assert.equal(gauntlet["villainGroupIds"], undefined);
      assert.equal(gauntlet["henchmanGroupIds"], undefined);
    }
  });
});

describe("parseGauntletPack — rejection paths", () => {
  it("rejects non-JSON text with a full-sentence error", () => {
    const result = parseGauntletPack("this is not json {");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /could not be parsed as JSON/);
    }
  });

  it("rejects a MATCH-SETUP document pasted into the gauntlet box", () => {
    const matchSetup = JSON.stringify({
      schemaVersion: "1.0",
      setupId: "setup-x",
      composition: { schemeId: "core/x", mastermindId: "core/magneto" },
    });
    const result = parseGauntletPack(matchSetup);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.length > 0, true);
    }
  });

  it("rejects a LAGN document pasted into the gauntlet box", () => {
    const lagn = JSON.stringify({
      lagn_version: "1.0.0",
      game_id: "11111111-2222-4333-8444-555555555555",
      variant: "cooperative",
      player_count: 3,
      setup: { mastermind: { id: "core/magneto", name: "" } },
      result: { outcome: "victory" },
    });
    const result = parseGauntletPack(lagn);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.length > 0, true);
    }
  });

  it("rejects a future-major-version pack with a version message", () => {
    const futurePack = JSON.stringify({
      pack_version: 2,
      gauntlet: {
        setAbbr: "core",
        mastermindSlug: "magneto",
        division: "fixed",
        playerCount: 1,
      },
    });
    const result = parseGauntletPack(futurePack);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /pack_version 2/);
    }
  });
});

describe("resolveGauntletLegLoadout — variant-0 resolve", () => {
  it("resolves a core/magneto leg at variant 0 with no heroDeckIds", () => {
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/negative-zone-prison-breakout",
      menu: makeCoreMagnetoMenu(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const prefill = result.prefill;
      assert.equal(prefill.schemeId, "core/negative-zone-prison-breakout");
      assert.equal(prefill.mastermindId, "core/magneto");
      assert.deepEqual(prefill.villainGroupIds, ["core/brotherhood"]);
      assert.deepEqual(prefill.henchmanGroupIds, ["core/doombot-legion"]);
      assert.equal(prefill.playerCount, 1);
      // why: heroes are left empty by design (bring your own) — the prefill
      // carries no heroDeckIds key at all.
      assert.equal(
        Object.prototype.hasOwnProperty.call(prefill, "heroDeckIds"),
        false,
      );
    }
  });

  it("defaults to variant 0 when no variantIndex is supplied", () => {
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const withDefault = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/scheme",
      menu: makeCoreMagnetoMenu(),
    });
    const withExplicitZero = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/scheme",
      menu: makeCoreMagnetoMenu(),
      variantIndex: 0,
    });
    assert.deepEqual(withDefault, withExplicitZero);
  });
});

describe("resolveGauntletLegLoadout — graceful failures", () => {
  it("returns unknown-gauntlet when the menu is undefined", () => {
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/scheme",
      menu: undefined,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unknown-gauntlet");
      assert.match(result.message, /not in this build's registry/);
    }
  });

  it("returns unoffered-count when the player count has no composition", () => {
    // A 5-player pack against a menu that only carries counts 1 and 2.
    const pack = JSON.parse(makeValidPackText()) as Record<string, unknown>;
    (pack["gauntlet"] as Record<string, unknown>)["playerCount"] = 5;
    const parsed = parseGauntletPack(JSON.stringify(pack));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/scheme",
      menu: makeCoreMagnetoMenu(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unoffered-count");
      assert.match(result.message, /5-player composition/);
    }
  });

  it("returns unknown-variant when the variant index is not offered", () => {
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/scheme",
      menu: makeCoreMagnetoMenu(),
      variantIndex: 7,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unknown-variant");
      assert.match(result.message, /Variant 7 is not offered/);
    }
  });
});

describe("resolveGauntletLegLoadout — per-scheme composition (WP-483)", () => {
  it("prefills the leg's per-scheme config when approvedComposition is injected", () => {
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    // why: the caller resolved the Secret-Invasion leg via getGauntletConfig; the
    // prefill must use THOSE adversaries (Skrulls), not the menu's Brotherhood.
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/secret-invasion-of-the-skrull-shapeshifters",
      menu: makeCoreMagnetoMenu(),
      approvedComposition: {
        villainGroupIds: ["core/masters-of-evil", "core/skrulls"],
        henchmanGroupIds: ["core/doombot-legion"],
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        result.prefill.schemeId,
        "core/secret-invasion-of-the-skrull-shapeshifters",
      );
      assert.deepEqual(result.prefill.villainGroupIds, [
        "core/masters-of-evil",
        "core/skrulls",
      ]);
      assert.deepEqual(result.prefill.henchmanGroupIds, ["core/doombot-legion"]);
      assert.equal(result.prefill.playerCount, 1);
    }
  });

  it("falls back to the scheme-blind menu variant when approvedComposition is absent", () => {
    // why: a non-Core / unswapped leg has no per-scheme override → the caller
    // injects no approvedComposition → the menu variant fills, exactly as before.
    const parsed = parseGauntletPack(makeValidPackText());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = resolveGauntletLegLoadout({
      pack: parsed.pack,
      schemeId: "core/negative-zone-prison-breakout",
      menu: makeCoreMagnetoMenu(),
      approvedComposition: undefined,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      // the menu's variant-0 count-1 composition (Brotherhood), not a per-scheme swap.
      assert.deepEqual(result.prefill.villainGroupIds, ["core/brotherhood"]);
    }
  });
});

describe("listGauntletLegSchemeIds — leg scheme ids", () => {
  it("maps a set's scheme cards to their set-qualified ext_ids", () => {
    const schemes = [
      { extId: "core/negative-zone-prison-breakout" },
      { extId: "core/legacy-virus" },
      { extId: "core/midtown-bank-robbery" },
    ];
    const legIds = listGauntletLegSchemeIds("core", schemes);
    assert.deepEqual(legIds, [
      "core/negative-zone-prison-breakout",
      "core/legacy-virus",
      "core/midtown-bank-robbery",
    ]);
  });

  it("skips schemes from other sets and de-duplicates", () => {
    const schemes = [
      { extId: "core/legacy-virus" },
      { extId: "dkcy/apocalypse-scheme" },
      { extId: "core/legacy-virus" },
    ];
    const legIds = listGauntletLegSchemeIds("core", schemes);
    assert.deepEqual(legIds, ["core/legacy-virus"]);
  });
});
