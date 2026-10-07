/**
 * Canonical gauntlet loadout menu tests (WP-395 / EC-435 / D-24199).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

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
