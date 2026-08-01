/**
 * gauntletConfigs.test.ts — WP-471 / EC-506 per-scheme gauntlet config loader.
 *
 * Proves the year-keyed loader over the hand-authored data/gauntlet-configs.json
 * (authored #1116; this packet adds only the loader):
 *   - Core per-scheme swaps are present and vary the fight per scheme;
 *   - a non-swapped Core leg reproduces today's GAUNTLET_LOADOUT_MENUS (proving the
 *     authored base pools match the generated menu);
 *   - pools scale by PLAYER_COUNT_SETUP and are returned as full ext_ids;
 *   - an absent leg (non-Core, or an unknown mastermind/scheme) returns undefined,
 *     so the consumer falls back to the per-mastermind menu (WP-472 model);
 *   - malformed input throws a full-sentence error;
 *   - the file's slicing table matches PLAYER_COUNT_SETUP (drift guard);
 *   - every scheme key in the committed file is a real scheme of its set (the
 *     fail-loud guard against an authoring typo, e.g. `the-legacy-virus`).
 *
 * Runner:  node:test (native Node.js test runner)
 * Invoke:  pnpm --filter @legendary-arena/registry test
 *
 * Assumptions:
 *   - CWD is packages/registry/ (pnpm --filter sets CWD to the package root)
 *   - data/cards/*.json and data/gauntlet-configs.json exist at the monorepo
 *     root, two levels up
 *   - No network access, no database, no mocks — local files only
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getGauntletConfig, getActiveYear, validateGauntletConfigs } from "./gauntletConfigs.js";
import { GAUNTLET_CONFIGS_DATA } from "./gauntletConfigs.generated.js";
import { GAUNTLET_LOADOUT_MENUS } from "./gauntletLoadouts.js";
import { PLAYER_COUNT_SETUP } from "./playerCountSetup.js";
import type { SupportedPlayerCount } from "./playerCountSetup.js";

// why: pnpm --filter sets CWD to packages/registry/; the card data and the
// gauntlet configs live at the monorepo root, two directory levels up.
const cardsDirectory = join(process.cwd(), "..", "..", "data", "cards");
const configsPath = join(process.cwd(), "..", "..", "data", "gauntlet-configs.json");

const SUPPORTED_PLAYER_COUNTS: SupportedPlayerCount[] = [1, 2, 3, 4, 5];

/** The committed, validated config file (parsed once for the data-shape tests). */
const committedConfigs = validateGauntletConfigs(JSON.parse(readFileSync(configsPath, "utf8")));

/** Sorts a copy of an id list so two compositions can be compared as sets. */
function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

/**
 * Reads one set's card data.
 *
 * @param setAbbr the set abbreviation (file base name).
 * @returns the parsed set data.
 */
function readSet(setAbbr: string): { schemes?: { slug: string }[] } {
  return JSON.parse(readFileSync(join(cardsDirectory, `${setAbbr}.json`), "utf8"));
}

describe("getActiveYear", () => {
  it("returns the file's active championship year", () => {
    assert.equal(getActiveYear(), "2026");
  });
});

describe("getGauntletConfig — Core per-scheme swaps", () => {
  it("applies the Dr. Doom skrulls swap only on the swapped schemes", () => {
    const swapped = getGauntletConfig(
      "core",
      "dr-doom",
      "secret-invasion-of-the-skrull-shapeshifters",
      2,
    );
    assert.deepEqual(swapped?.villainGroupIds, ["core/masters-of-evil", "core/skrulls"]);
    const unswapped = getGauntletConfig("core", "dr-doom", "midtown-bank-robbery", 2);
    assert.deepEqual(unswapped?.villainGroupIds, ["core/masters-of-evil", "core/brotherhood"]);
  });

  it("varies the Red Skull 2-player fight by reordering the same 4-set", () => {
    // why: the Red Skull villain swap is a reorder — identical 4-group set, but
    // the 2-player prefix differs (brotherhood → masters-of-evil at slot 2).
    const swapped = getGauntletConfig("core", "red-skull", "midtown-bank-robbery", 2);
    const unswapped = getGauntletConfig("core", "red-skull", "secret-invasion-of-the-skrull-shapeshifters", 2);
    assert.deepEqual(swapped?.villainGroupIds, ["core/hydra", "core/masters-of-evil"]);
    assert.deepEqual(unswapped?.villainGroupIds, ["core/hydra", "core/brotherhood"]);
  });

  it("applies the Magneto henchmen swap on the swapped scheme", () => {
    const swapped = getGauntletConfig("core", "magneto", "portals-to-the-dark-dimension", 4);
    assert.deepEqual(swapped?.henchmanGroupIds, ["core/sentinel", "core/hand-ninjas"]);
    const unswapped = getGauntletConfig("core", "magneto", "midtown-bank-robbery", 4);
    assert.deepEqual(unswapped?.henchmanGroupIds, ["core/doombot-legion", "core/hand-ninjas"]);
  });

  it("omits the Always-Leads group on the Loki radiation swap (deliberate)", () => {
    // why: WP-471 §Contract — the radiation swap replaces enemies-of-asgard as
    // pool[0]; the leg intentionally no longer carries Loki's printed Always-Leads.
    const config = getGauntletConfig("core", "loki", "portals-to-the-dark-dimension", 1);
    assert.deepEqual(config?.villainGroupIds, ["core/radiation"]);
    assert.ok(
      !config.villainGroupIds.includes("core/enemies-of-asgard"),
      "The Loki radiation swap must omit enemies-of-asgard.",
    );
  });
});

describe("getGauntletConfig — non-swapped Core legs reproduce GAUNTLET_LOADOUT_MENUS", () => {
  it("matches the generated per-mastermind menu on every unswapped Core leg", () => {
    const coreYear = committedConfigs.years[committedConfigs.activeYear];
    const coreSets = coreYear.sets.core;
    assert.ok(coreSets !== undefined, "Expected a Core block in the active year.");
    let checkedLegs = 0;
    for (const [mastermindSlug, mastermindConfig] of Object.entries(coreSets.masterminds)) {
      const menu = GAUNTLET_LOADOUT_MENUS.find(
        (candidate) => candidate.setAbbr === "core" && candidate.mastermindSlug === mastermindSlug,
      );
      assert.ok(menu !== undefined, `No menu found for core/${mastermindSlug}.`);
      const menuComposition = menu.variants[0].compositionsByPlayerCount;
      for (const [schemeSlug, leg] of Object.entries(mastermindConfig.schemes)) {
        if (leg.variety !== null) {
          continue; // why: swapped legs deliberately deviate from the base menu.
        }
        for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
          const config = getGauntletConfig("core", mastermindSlug, schemeSlug, playerCount);
          const expected = menuComposition[playerCount];
          assert.deepEqual(
            sortedIds(config!.villainGroupIds),
            sortedIds(expected.villainGroupIds),
            `Villain groups drifted for core/${mastermindSlug}/${schemeSlug} at ${playerCount} players.`,
          );
          assert.deepEqual(
            sortedIds(config!.henchmanGroupIds),
            sortedIds(expected.henchmanGroupIds),
            `Henchmen groups drifted for core/${mastermindSlug}/${schemeSlug} at ${playerCount} players.`,
          );
          checkedLegs += 1;
        }
      }
    }
    assert.ok(checkedLegs > 0, "Expected at least one unswapped Core leg to compare against the menu.");
  });
});

describe("getGauntletConfig — pool scaling and absent-leg fallback", () => {
  it("scales each pool by PLAYER_COUNT_SETUP", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const config = getGauntletConfig("core", "dr-doom", "midtown-bank-robbery", playerCount);
      const setupRow = PLAYER_COUNT_SETUP[playerCount];
      assert.equal(
        config?.villainGroupIds.length,
        setupRow.villainGroupCount,
        `Wrong villain-group count at ${playerCount} players.`,
      );
      assert.equal(
        config?.henchmanGroupIds.length,
        setupRow.henchmenGroupCount,
        `Wrong henchmen-group count at ${playerCount} players.`,
      );
    }
  });

  it("returns undefined for an absent leg so the consumer falls back to the menu", () => {
    // why: the file authors only curated legs (Core today); every other leg has no
    // override and resolves to undefined → the WP-472 absent-scheme → menu fallback.
    assert.equal(getGauntletConfig("nope", "dr-doom", "midtown-bank-robbery", 2), undefined);
    assert.equal(getGauntletConfig("core", "not-a-mastermind", "midtown-bank-robbery", 2), undefined);
    assert.equal(getGauntletConfig("core", "dr-doom", "no-such-scheme", 2), undefined);
  });

  it("returns undefined for a non-Core set with no authored config", () => {
    // why: set 2099 hosts gauntlets but carries no per-scheme override; the loader
    // returns undefined and the consumer uses GAUNTLET_LOADOUT_MENUS.
    assert.equal(getGauntletConfig("2099", "sinister-six-2099", "pull-reality-into-cyberspace", 5), undefined);
  });
});

describe("validateGauntletConfigs", () => {
  it("accepts the committed file", () => {
    assert.equal(committedConfigs.activeYear, "2026");
  });

  it("throws a full-sentence error on a missing field", () => {
    assert.throws(
      () => validateGauntletConfigs({ schemaVersion: 1, activeYear: "2026", years: {} }),
      /not a valid gauntlet-configs file/,
    );
  });

  it("throws when activeYear points at a missing year block", () => {
    const bad = {
      schemaVersion: 1,
      description: "x",
      activeYear: "1999",
      slicing: {
        note: "x",
        villainGroupCountByPlayerCount: { "1": 1 },
        henchmanGroupCountByPlayerCount: { "1": 1 },
      },
      years: { "2026": { label: "2026", sets: {} } },
    };
    assert.throws(() => validateGauntletConfigs(bad), /no years\["1999"\] block/);
  });

  it("throws on an unknown key inside a leg (strict)", () => {
    const configs = JSON.parse(readFileSync(configsPath, "utf8"));
    configs.years["2026"].sets.core.masterminds["dr-doom"].schemes["midtown-bank-robbery"].smuggled = true;
    assert.throws(() => validateGauntletConfigs(configs), /not a valid gauntlet-configs file/);
  });
});

describe("committed-file guards", () => {
  it("has a slicing table that matches PLAYER_COUNT_SETUP (drift guard)", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const key = String(playerCount);
      assert.equal(
        committedConfigs.slicing.villainGroupCountByPlayerCount[key],
        PLAYER_COUNT_SETUP[playerCount].villainGroupCount,
        `slicing villain count for ${playerCount} players disagrees with PLAYER_COUNT_SETUP.`,
      );
      assert.equal(
        committedConfigs.slicing.henchmanGroupCountByPlayerCount[key],
        PLAYER_COUNT_SETUP[playerCount].henchmenGroupCount,
        `slicing henchmen count for ${playerCount} players disagrees with PLAYER_COUNT_SETUP.`,
      );
    }
  });

  it("names only real scheme slugs (fail-loud against data/cards)", () => {
    const realSchemesBySet = new Map<string, Set<string>>();
    for (const fileName of readdirSync(cardsDirectory).filter((name) => name.endsWith(".json"))) {
      const setAbbr = fileName.replace(".json", "");
      realSchemesBySet.set(setAbbr, new Set((readSet(setAbbr).schemes ?? []).map((scheme) => scheme.slug)));
    }
    const yearBlock = committedConfigs.years[committedConfigs.activeYear];
    for (const [setAbbr, setConfig] of Object.entries(yearBlock.sets)) {
      const realSchemes = realSchemesBySet.get(setAbbr);
      assert.ok(realSchemes !== undefined, `Config names set "${setAbbr}", which has no data/cards file.`);
      for (const mastermindConfig of Object.values(setConfig.masterminds)) {
        for (const schemeSlug of Object.keys(mastermindConfig.schemes)) {
          assert.ok(
            realSchemes.has(schemeSlug),
            `Config for set "${setAbbr}" names scheme "${schemeSlug}", which is not a real scheme of that set (authoring typo?).`,
          );
        }
      }
    }
  });
});

describe("generated literal freshness (WP-483 — enforcing drift gate)", () => {
  it("gauntletConfigs.generated.ts deep-equals data/gauntlet-configs.json", () => {
    // why: WP-483 — the browser-safe loader validates the baked literal
    // (gauntletConfigs.generated.ts), not the file at runtime. This deep-equal is
    // the ENFORCING drift gate: it runs in CI via `pnpm -r … test`, so a stale or
    // hand-edited generated module (or a data/gauntlet-configs.json edit without a
    // regenerate) fails here. The standalone `pnpm gauntlet:configs:check` is a
    // convenience mirror, not CI-wired (matching gauntlet:loadouts:check).
    const sourceJson = JSON.parse(readFileSync(configsPath, "utf8"));
    assert.deepEqual(GAUNTLET_CONFIGS_DATA, sourceJson);
  });
});
