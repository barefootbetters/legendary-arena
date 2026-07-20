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
import { PLAYER_COUNT_SETUP } from "./playerCountSetup.js";
import type { SupportedPlayerCount } from "./playerCountSetup.js";

const SUPPORTED_PLAYER_COUNTS: SupportedPlayerCount[] = [1, 2, 3, 4, 5];
const VARIANTS_PER_MASTERMIND = 3;

test("every mastermind menu offers exactly three variants", () => {
  assert.ok(
    GAUNTLET_LOADOUT_MENUS.length > 0,
    "the generated menu table must not be empty",
  );
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    assert.equal(
      menu.variants.length,
      VARIANTS_PER_MASTERMIND,
      `${menu.setAbbr}/${menu.mastermindSlug} must offer three configurations`,
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

test("a mastermind's three variants are distinct at every player count", () => {
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const renderedCompositions = new Set<string>();
      for (const variant of menu.variants) {
        const composition = variant.compositionsByPlayerCount[playerCount];
        renderedCompositions.add(
          `${buildVillainSegment(composition)}|${buildHenchmanKey(composition)}`,
        );
      }
      // why: solo takes a single villain group, so a mastermind whose printed
      // alwaysLeads pins that slot legitimately collapses to one configuration
      // there — the menu cannot manufacture choice the player count forbids.
      const isSoloAnchorCollapse = playerCount === 1;
      if (!isSoloAnchorCollapse) {
        assert.equal(
          renderedCompositions.size,
          VARIANTS_PER_MASTERMIND,
          `${menu.setAbbr}/${menu.mastermindSlug} variants collide at ${playerCount}p`,
        );
      }
    }
  }
});

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

test("buildVillainSegment strips set qualifiers and sorts; buildHenchmanKey does not strip", () => {
  const composition: GauntletLoadoutComposition = {
    villainGroupIds: ["zzzz/omega-flight", "core/brotherhood"],
    henchmanGroupIds: ["zzzz/omega-guard", "core/doombot-legion"],
  };
  assert.equal(buildVillainSegment(composition), "brotherhood+omega-flight");
  assert.equal(
    buildHenchmanKey(composition),
    "core/doombot-legion+zzzz/omega-guard",
  );
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
