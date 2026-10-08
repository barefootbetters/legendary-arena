/**
 * Canonical gauntlet loadout menu tests (WP-395 / EC-435 / D-24199).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  GAUNTLET_LOADOUT_MENUS,
  getGauntletLoadoutMenu,
  buildVillainSegment,
  buildHenchmanKey,
} from "./gauntletLoadouts.js";
import type { GauntletLoadoutComposition } from "./gauntletLoadouts.js";
import {
  PLAYER_COUNT_SETUP,
  SCHEMES_WITH_EXTRA_HENCHMAN_GROUP,
  resolveEffectiveHenchmenCount,
} from "./playerCountSetup.js";
import type { SupportedPlayerCount } from "./playerCountSetup.js";

const SUPPORTED_PLAYER_COUNTS: SupportedPlayerCount[] = [1, 2, 3, 4, 5];
// why: D-24278 — one canonical configuration per mastermind (variant 0), not
// D-24199's menu of three; heroes are the only ranked variable.
const VARIANTS_PER_MASTERMIND = 1;

test("every mastermind menu offers exactly one variant", () => {
  assert.ok(
    GAUNTLET_LOADOUT_MENUS.length > 0,
    "the generated menu table must not be empty",
  );
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    assert.equal(
      menu.variants.length,
      VARIANTS_PER_MASTERMIND,
      `${menu.setAbbr}/${menu.mastermindSlug} must offer one configuration`,
    );
  }
});

test("every composition is sized exactly as PLAYER_COUNT_SETUP requires", () => {
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    for (const variant of menu.variants) {
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        const composition = variant.compositionsByPlayerCount[playerCount];
        const requiredCounts = PLAYER_COUNT_SETUP[playerCount];
        const label = `${menu.setAbbr}/${menu.mastermindSlug} variant ${variant.variantIndex} at ${playerCount}p`;
        assert.equal(
          composition.villainGroupIds.length,
          requiredCounts.villainGroupCount,
          `${label} must supply ${requiredCounts.villainGroupCount} villain groups`,
        );
        assert.equal(
          composition.henchmanGroupIds.length,
          requiredCounts.henchmenGroupCount,
          `${label} must supply ${requiredCounts.henchmenGroupCount} henchmen groups`,
        );
      }
    }
  }
});

test("every group id is set-qualified and every list is sorted and duplicate-free", () => {
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    for (const variant of menu.variants) {
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        const composition = variant.compositionsByPlayerCount[playerCount];
        const allGroupIds = [
          ...composition.villainGroupIds,
          ...composition.henchmanGroupIds,
        ];
        for (const groupId of allGroupIds) {
          assert.match(
            groupId,
            /^[a-z0-9]+\/[a-z0-9-]+$/,
            `${groupId} must be a set-qualified ext_id (D-10014)`,
          );
        }
        for (const groupIds of [
          composition.villainGroupIds,
          composition.henchmanGroupIds,
        ]) {
          const sorted = [...groupIds].sort();
          assert.deepEqual(
            [...groupIds],
            sorted,
            `${menu.setAbbr}/${menu.mastermindSlug} lists must be sorted ASC`,
          );
          assert.equal(
            new Set(groupIds).size,
            groupIds.length,
            `${menu.setAbbr}/${menu.mastermindSlug} must not repeat a group`,
          );
        }
      }
    }
  }
});

// why: D-24278 removed the "three variants are distinct at every player count"
// test — with one canonical variant per mastermind there is nothing to compare
// for distinctness (the property it guarded no longer exists).

test("getGauntletLoadoutMenu finds a known gauntlet and misses an unknown one", () => {
  const firstMenu = GAUNTLET_LOADOUT_MENUS[0];
  assert.ok(firstMenu, "the generated menu table must not be empty");
  const found = getGauntletLoadoutMenu(
    firstMenu.setAbbr,
    firstMenu.mastermindSlug,
  );
  assert.equal(found, firstMenu);
  assert.equal(
    getGauntletLoadoutMenu(firstMenu.setAbbr, "no-such-mastermind"),
    undefined,
  );
  assert.equal(
    getGauntletLoadoutMenu("nosuchset", firstMenu.mastermindSlug),
    undefined,
  );
});

// why: D-24597 — only the core qualifier is dropped; a non-core villain group keeps
// its set, matching the ScenarioKey segment capture writes.
test("buildVillainSegment strips only the core qualifier and sorts; buildHenchmanKey does not strip", () => {
  const composition: GauntletLoadoutComposition = {
    villainGroupIds: ["zzzz/omega-flight", "core/brotherhood"],
    henchmanGroupIds: ["zzzz/omega-guard", "core/doombot-legion"],
  };
  assert.equal(buildVillainSegment(composition), "brotherhood+zzzz/omega-flight");
  assert.equal(
    buildHenchmanKey(composition),
    "core/doombot-legion+zzzz/omega-guard",
  );
});

// why: D-24666 — the generator keeps its own copy of the extra-Henchman scheme
// list (it runs before any build). It also runs main() on import, so no test can
// import it; like REQUIRED_GROUP_COUNTS, the copy is pinned through its OUTPUT.
test("the emitted schemeOverrides keys equal SCHEMES_WITH_EXTRA_HENCHMAN_GROUP (drift pin)", () => {
  const emittedSchemeIds = new Set<string>();
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    for (const schemeSlug of Object.keys(menu.schemeOverrides ?? {})) {
      emittedSchemeIds.add(`${menu.setAbbr}/${schemeSlug}`);
    }
  }
  assert.deepEqual([...emittedSchemeIds].sort(), [...SCHEMES_WITH_EXTRA_HENCHMAN_GROUP].sort());
});

test("every scheme override is the base composition plus one distinct-slug henchmen group", () => {
  let checkedCompositions = 0;
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    const baseVariant = menu.variants[0];
    assert.ok(baseVariant !== undefined, `${menu.setAbbr}/${menu.mastermindSlug} must offer variant 0`);
    for (const [schemeSlug, compositionsByPlayerCount] of Object.entries(menu.schemeOverrides ?? {})) {
      for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
        const label = `${menu.setAbbr}/${menu.mastermindSlug} / ${schemeSlug} at ${playerCount}p`;
        const override = compositionsByPlayerCount[playerCount];
        const base: GauntletLoadoutComposition = baseVariant.compositionsByPlayerCount[playerCount];
        assert.equal(
          override.henchmanGroupIds.length,
          resolveEffectiveHenchmenCount(
            `${menu.setAbbr}/${schemeSlug}`,
            playerCount,
            PLAYER_COUNT_SETUP[playerCount].henchmenGroupCount,
          ),
          `${label} must supply the scheme-effective henchmen count`,
        );
        for (const baseHenchmanId of base.henchmanGroupIds) {
          assert.ok(override.henchmanGroupIds.includes(baseHenchmanId), `${label} must keep ${baseHenchmanId}`);
        }
        assert.deepEqual(override.villainGroupIds, base.villainGroupIds, `${label} must keep the base villains`);
        // why: Henchman card ids are built from the bare slug, so no two groups in
        // one composition may share a slug across sets.
        const slugs: string[] = [];
        for (const groupId of [...override.villainGroupIds, ...override.henchmanGroupIds]) {
          slugs.push(groupId.slice(groupId.indexOf("/") + 1));
        }
        assert.equal(new Set(slugs).size, slugs.length, `${label} must not repeat a slug`);
        checkedCompositions += 1;
      }
    }
  }
  assert.ok(checkedCompositions > 0, "the generated menus must carry scheme overrides");
});

test("menus for masterminds without an extra-Henchman scheme carry no schemeOverrides key", () => {
  const setsWithListedScheme = new Set<string>();
  for (const schemeId of SCHEMES_WITH_EXTRA_HENCHMAN_GROUP) {
    setsWithListedScheme.add(schemeId.slice(0, schemeId.indexOf("/")));
  }
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    assert.equal(
      "schemeOverrides" in menu,
      setsWithListedScheme.has(menu.setAbbr),
      `${menu.setAbbr}/${menu.mastermindSlug} schemeOverrides presence is wrong`,
    );
  }
});

// why: pnpm --filter sets CWD to packages/registry/; the card data lives at the
// monorepo root, two directory levels up.
const cardsDirectory = join(process.cwd(), "..", "..", "data", "cards");

/** The committed card data's group ids by type, plus each mastermind's Henchman leads. */
interface CommittedGroupIndex {
  villainGroupIds: Set<string>;
  henchmanGroupIds: Set<string>;
  henchmanLeadIdsByMastermind: Map<string, string[]>;
}

/**
 * Collects the string `slug` of each entry that carries one. Set JSON is read
 * untyped, so every entry is narrowed here rather than cast.
 *
 * @param entries a raw set-JSON array (or anything else).
 * @returns the slugs of the entries that carry a string slug.
 */
function collectSlugs(entries: unknown): string[] {
  const slugs: string[] = [];
  if (!Array.isArray(entries)) {
    return slugs;
  }
  for (const entry of entries) {
    if (typeof entry === "object" && entry !== null && "slug" in entry && typeof entry.slug === "string") {
      slugs.push(entry.slug);
    }
  }
  return slugs;
}

/**
 * Reads every committed data/cards set into a set-qualified group index.
 *
 * @returns villain / Henchman ext_ids and each mastermind's Henchman-lead ext_ids.
 */
function readCommittedGroupIndex(): CommittedGroupIndex {
  const index: CommittedGroupIndex = {
    villainGroupIds: new Set(),
    henchmanGroupIds: new Set(),
    henchmanLeadIdsByMastermind: new Map(),
  };
  for (const fileName of readdirSync(cardsDirectory).filter((name) => name.endsWith(".json"))) {
    const setAbbr = fileName.replace(".json", "");
    const setData: unknown = JSON.parse(readFileSync(join(cardsDirectory, fileName), "utf8"));
    if (typeof setData !== "object" || setData === null) {
      continue;
    }
    const villains = "villains" in setData ? setData.villains : [];
    const henchmen = "henchmen" in setData ? setData.henchmen : [];
    const masterminds = "masterminds" in setData ? setData.masterminds : [];
    for (const slug of collectSlugs(villains)) {
      index.villainGroupIds.add(`${setAbbr}/${slug}`);
    }
    for (const slug of collectSlugs(henchmen)) {
      index.henchmanGroupIds.add(`${setAbbr}/${slug}`);
    }
    for (const mastermind of Array.isArray(masterminds) ? masterminds : []) {
      if (typeof mastermind !== "object" || mastermind === null || !("slug" in mastermind)) {
        continue;
      }
      const leads = "alwaysLeadsHenchmen" in mastermind ? mastermind.alwaysLeadsHenchmen : [];
      const leadIds: string[] = [];
      for (const lead of Array.isArray(leads) ? leads : []) {
        if (typeof lead === "string") {
          leadIds.push(`${setAbbr}/${lead}`);
        }
      }
      index.henchmanLeadIdsByMastermind.set(`${setAbbr}/${String(mastermind.slug)}`, leadIds);
    }
  }
  return index;
}

/**
 * Lists every composition a menu carries — variant 0 and every scheme override —
 * at every player count, with a label for failure messages.
 *
 * @param menu one generated mastermind menu.
 * @returns [label, composition] pairs.
 */
function listMenuCompositions(
  menu: (typeof GAUNTLET_LOADOUT_MENUS)[number],
): [string, GauntletLoadoutComposition][] {
  const compositions: [string, GauntletLoadoutComposition][] = [];
  for (const variant of menu.variants) {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      compositions.push([
        `${menu.setAbbr}/${menu.mastermindSlug} variant ${variant.variantIndex} at ${playerCount}p`,
        variant.compositionsByPlayerCount[playerCount],
      ]);
    }
  }
  for (const [schemeSlug, compositionsByPlayerCount] of Object.entries(menu.schemeOverrides ?? {})) {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      compositions.push([
        `${menu.setAbbr}/${menu.mastermindSlug} / ${schemeSlug} at ${playerCount}p`,
        compositionsByPlayerCount[playerCount],
      ]);
    }
  }
  return compositions;
}

// why: D-24667 — a Henchman slug in co2e Doctor Doom's alwaysLeads once put
// co2e/doombot-legion in BOTH villainGroupIds and henchmanGroupIds.
test("every menu slot holds a group of its own type in the committed card data", () => {
  const index = readCommittedGroupIndex();
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    for (const [label, composition] of listMenuCompositions(menu)) {
      for (const villainGroupId of composition.villainGroupIds) {
        assert.ok(index.villainGroupIds.has(villainGroupId), `${label}: ${villainGroupId} is not a villain group`);
      }
      for (const henchmanGroupId of composition.henchmanGroupIds) {
        assert.ok(index.henchmanGroupIds.has(henchmanGroupId), `${label}: ${henchmanGroupId} is not a Henchman group`);
      }
    }
  }
});

test("a mastermind's printed Henchman lead is in every composition's Henchmen (D-24667)", () => {
  const index = readCommittedGroupIndex();
  let checkedMasterminds = 0;
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    const leadIds = index.henchmanLeadIdsByMastermind.get(`${menu.setAbbr}/${menu.mastermindSlug}`) ?? [];
    if (leadIds.length === 0) {
      continue;
    }
    checkedMasterminds += 1;
    for (const [label, composition] of listMenuCompositions(menu)) {
      for (const leadId of leadIds) {
        assert.ok(composition.henchmanGroupIds.includes(leadId), `${label} must field its Henchman lead ${leadId}`);
      }
    }
  }
  // why: dims J. Jonah Jameson hosts no gauntlet (no scheme), so 8 of the 9
  // Henchman-lead masterminds have a menu.
  assert.equal(checkedMasterminds, 8, "Expected 8 Henchman-lead masterminds with a menu.");
  assert.deepEqual(getGauntletLoadoutMenu("core", "dr-doom")?.variants[0]?.compositionsByPlayerCount[1], {
    villainGroupIds: ["core/brotherhood"],
    henchmanGroupIds: ["core/doombot-legion"],
  });
  assert.deepEqual(getGauntletLoadoutMenu("co2e", "doctor-doom")?.variants[0]?.compositionsByPlayerCount[1], {
    villainGroupIds: ["co2e/brotherhood-of-mutants"],
    henchmanGroupIds: ["co2e/doombot-legion"],
  });
});

test("the sizing assertion fails on a deliberately mis-sized composition", () => {
  // why: a negative case, so the sizing test above cannot pass vacuously if the
  // generated table ever emits empty variant lists.
  const misSized: GauntletLoadoutComposition = {
    villainGroupIds: ["core/brotherhood"],
    henchmanGroupIds: [],
  };
  assert.notEqual(
    misSized.villainGroupIds.length,
    PLAYER_COUNT_SETUP[5].villainGroupCount,
    "a one-group composition must not satisfy the five-player requirement",
  );
  assert.throws(() => {
    assert.equal(
      misSized.henchmanGroupIds.length,
      PLAYER_COUNT_SETUP[5].henchmenGroupCount,
    );
  });
});
