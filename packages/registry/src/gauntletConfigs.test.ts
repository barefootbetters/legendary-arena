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
import { GAUNTLET_LOADOUT_MENUS, getGauntletLoadoutMenu } from "./gauntletLoadouts.js";
import type { GauntletLoadoutComposition } from "./gauntletLoadouts.js";
import {
  PLAYER_COUNT_SETUP,
  SCHEMES_WITH_EXTRA_HENCHMAN_GROUP,
  resolveEffectiveHenchmenCount,
} from "./playerCountSetup.js";
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
          // why: D-24666 — an "Add an extra Henchman group" scheme takes base + 1
          // henchmen, so its leg deliberately no longer equals the base menu's
          // henchmen; it must instead be the authored pool's prefix at the
          // scheme-effective count.
          if (SCHEMES_WITH_EXTRA_HENCHMAN_GROUP.includes(`core/${schemeSlug}`)) {
            const effectiveCount = resolveEffectiveHenchmenCount(
              `core/${schemeSlug}`,
              playerCount,
              PLAYER_COUNT_SETUP[playerCount].henchmenGroupCount,
            );
            assert.deepEqual(
              config!.henchmanGroupIds,
              leg.henchmanPool.slice(0, effectiveCount),
              `Henchmen groups for core/${mastermindSlug}/${schemeSlug} at ${playerCount} players are not the pool prefix at the effective count.`,
            );
          } else {
            assert.deepEqual(
              sortedIds(config!.henchmanGroupIds),
              sortedIds(expected.henchmanGroupIds),
              `Henchmen groups drifted for core/${mastermindSlug}/${schemeSlug} at ${playerCount} players.`,
            );
          }
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

describe("getGauntletConfig — extra Henchman group (D-24666)", () => {
  /** The expected Henchman pool of each Core Negative Zone Prison Breakout leg. */
  const NZPB_POOLS: Record<string, string[]> = {
    "dr-doom": ["core/doombot-legion", "core/hand-ninjas", "core/sentinel"],
    "red-skull": ["core/doombot-legion", "core/hand-ninjas", "core/sentinel"],
    magneto: ["core/savage-land-mutates", "core/hand-ninjas", "core/sentinel"],
    loki: ["core/savage-land-mutates", "core/hand-ninjas", "core/sentinel"],
  };

  /** The menu-fallback legs whose scheme adds a Henchman group, as [set, mastermind, scheme]. */
  const MENU_OVERRIDE_LEGS: [string, string, string][] = [
    ["msp1", "iron-monger", "asgard-under-siege"],
    ["msp1", "loki", "asgard-under-siege"],
    ["msp1", "red-skull", "asgard-under-siege"],
    ["vnom", "hybrid", "invasion-of-the-venom-symbiotes"],
    ["vnom", "poison-thanos", "invasion-of-the-venom-symbiotes"],
  ];

  it("gives each Core NZPB leg 2 Henchman groups at 1–3p and 3 at 4–5p, as a pool prefix", () => {
    const expectedCounts: Record<SupportedPlayerCount, number> = { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3 };
    for (const [mastermindSlug, pool] of Object.entries(NZPB_POOLS)) {
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        const config = getGauntletConfig("core", mastermindSlug, "negative-zone-prison-breakout", playerCount);
        assert.deepEqual(
          config?.henchmanGroupIds,
          pool.slice(0, expectedCounts[playerCount]),
          `core/${mastermindSlug} NZPB henchmen are wrong at ${playerCount} players.`,
        );
      }
    }
  });

  it("returns the menu's scheme override for each msp1 / vnom extra-Henchman leg", () => {
    for (const [setAbbr, mastermindSlug, schemeSlug] of MENU_OVERRIDE_LEGS) {
      const menu = getGauntletLoadoutMenu(setAbbr, mastermindSlug);
      assert.ok(menu !== undefined, `No menu found for ${setAbbr}/${mastermindSlug}.`);
      const baseVariant = menu.variants[0];
      assert.ok(baseVariant !== undefined, `No variant 0 found for ${setAbbr}/${mastermindSlug}.`);
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        const label = `${setAbbr}/${mastermindSlug}/${schemeSlug} at ${playerCount} players`;
        const config = getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount);
        const baseComposition: GauntletLoadoutComposition = baseVariant.compositionsByPlayerCount[playerCount];
        assert.ok(config !== undefined, `Expected a scheme-aware composition for ${label}.`);
        assert.deepEqual(config.villainGroupIds, baseComposition.villainGroupIds, `Villains changed for ${label}.`);
        assert.equal(
          config.henchmanGroupIds.length,
          baseComposition.henchmanGroupIds.length + 1,
          `Expected one more Henchman group for ${label}.`,
        );
        for (const baseHenchmanId of baseComposition.henchmanGroupIds) {
          assert.ok(config.henchmanGroupIds.includes(baseHenchmanId), `${label} dropped ${baseHenchmanId}.`);
        }
      }
    }
  });

  it("names the generated msp1 Asgard Under Siege henchmen at 1p and 4p", () => {
    assert.deepEqual(getGauntletConfig("msp1", "loki", "asgard-under-siege", 1)?.henchmanGroupIds, [
      "msp1/hammer-drone-army",
      "msp1/hydra-pilots",
    ]);
    assert.deepEqual(getGauntletConfig("msp1", "loki", "asgard-under-siege", 4)?.henchmanGroupIds, [
      "msp1/hammer-drone-army",
      "msp1/hydra-pilots",
      "msp1/hydra-spies",
    ]);
  });

  it("leaves every unlisted leg as before: authored legs slice by the base count, others are undefined", () => {
    let checkedLegs = 0;
    const yearBlock = committedConfigs.years[committedConfigs.activeYear];
    for (const menu of GAUNTLET_LOADOUT_MENUS) {
      for (const scheme of readSet(menu.setAbbr).schemes ?? []) {
        if (SCHEMES_WITH_EXTRA_HENCHMAN_GROUP.includes(`${menu.setAbbr}/${scheme.slug}`)) {
          continue;
        }
        const leg = yearBlock?.sets[menu.setAbbr]?.masterminds[menu.mastermindSlug]?.schemes[scheme.slug];
        for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
          const config = getGauntletConfig(menu.setAbbr, menu.mastermindSlug, scheme.slug, playerCount);
          const label = `${menu.setAbbr}/${menu.mastermindSlug}/${scheme.slug} at ${playerCount} players`;
          if (leg === undefined) {
            assert.equal(config, undefined, `Expected no per-scheme config for ${label}.`);
          } else {
            assert.deepEqual(
              config?.henchmanGroupIds,
              leg.henchmanPool.slice(0, PLAYER_COUNT_SETUP[playerCount].henchmenGroupCount),
              `Henchmen changed for ${label}.`,
            );
          }
          checkedLegs += 1;
        }
      }
    }
    assert.ok(checkedLegs > 0, "Expected at least one unlisted leg to check.");
  });

  it("rejects a leg whose henchman pool is shorter than the scheme's 5-player effective count", () => {
    const configs = JSON.parse(readFileSync(configsPath, "utf8"));
    configs.years["2026"].sets.core.masterminds.magneto.schemes["negative-zone-prison-breakout"].henchmanPool = [
      "core/savage-land-mutates",
      "core/hand-ninjas",
    ];
    assert.throws(
      () => validateGauntletConfigs(configs),
      /set "core", mastermind "magneto", scheme "negative-zone-prison-breakout".*requires 3 Henchman groups at 5 players/,
    );
  });

  it("rejects an unlisted leg whose henchman pool is shorter than the base 5-player count", () => {
    const configs = JSON.parse(readFileSync(configsPath, "utf8"));
    configs.years["2026"].sets.core.masterminds["dr-doom"].schemes["midtown-bank-robbery"].henchmanPool = [
      "core/doombot-legion",
    ];
    assert.throws(
      () => validateGauntletConfigs(configs),
      /scheme "midtown-bank-robbery".*requires 2 Henchman groups at 5 players/,
    );
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
