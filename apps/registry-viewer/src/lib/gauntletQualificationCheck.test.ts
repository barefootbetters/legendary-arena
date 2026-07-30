/**
 * Tests for checkGauntletQualification (WP-454 / EC-489).
 *
 * Pure + data-injected: every case constructs its own GauntletLoadoutMenu, so no
 * live registry is needed. Covers the four statuses plus order-insensitivity
 * (a reordered id list still qualifies — would catch a naive array-equality bug)
 * and input non-mutation (the comparison sorts spread copies, never the input).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkGauntletQualification,
  type GauntletQualificationInput,
} from "./gauntletQualificationCheck";
import type {
  GauntletLoadoutMenu,
  GauntletLoadoutComposition,
} from "@legendary-arena/registry/gauntletLoadouts";
import type { SupportedPlayerCount } from "@legendary-arena/registry/playerCountSetup";

/** Builds a full 1..5 composition record from a single composition. */
function everyCount(
  composition: GauntletLoadoutComposition,
): Record<SupportedPlayerCount, GauntletLoadoutComposition> {
  return {
    1: composition,
    2: composition,
    3: composition,
    4: composition,
    5: composition,
  };
}

/** A two-variant menu for core/magneto used across the qualifying cases. */
const MENU: GauntletLoadoutMenu = {
  setAbbr: "core",
  mastermindSlug: "magneto",
  variants: [
    {
      variantIndex: 0,
      compositionsByPlayerCount: everyCount({
        villainGroupIds: ["core/brotherhood", "core/hydra"],
        henchmanGroupIds: ["core/sentinel"],
      }),
    },
    {
      variantIndex: 1,
      compositionsByPlayerCount: everyCount({
        villainGroupIds: ["core/enemies-of-asgard"],
        henchmanGroupIds: ["core/doombot", "core/hand-ninja"],
      }),
    },
  ],
};

test("menu undefined yields not-a-gauntlet", () => {
  const input: GauntletQualificationInput = {
    villainGroupIds: ["core/brotherhood"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 2,
    menu: undefined,
  };
  assert.deepEqual(checkGauntletQualification(input), {
    status: "not-a-gauntlet",
  });
});

test("a variant-0 match qualifies with variantIndex 0", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/brotherhood", "core/hydra"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 2,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "qualifies", variantIndex: 0 });
});

test("a reordered id list still qualifies (order-insensitive)", () => {
  // why: the villain ids are supplied in the opposite order from the menu's
  // sorted composition; a naive array-equality check would wrongly reject this.
  const result = checkGauntletQualification({
    villainGroupIds: ["core/hydra", "core/brotherhood"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 4,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "qualifies", variantIndex: 0 });
});

test("a match against a non-zero variant reports that variantIndex", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/enemies-of-asgard"],
    henchmanGroupIds: ["core/hand-ninja", "core/doombot"],
    playerCount: 3,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "qualifies", variantIndex: 1 });
});

test("a wrong villain group does not qualify", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/brotherhood", "core/spider-foes"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 2,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "not-qualifying", approvedVariantCount: 2 });
});

test("an extra henchmen group does not qualify", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/brotherhood", "core/hydra"],
    henchmanGroupIds: ["core/sentinel", "core/doombot"],
    playerCount: 2,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "not-qualifying", approvedVariantCount: 2 });
});

test("a missing villain group does not qualify", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/brotherhood"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 2,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "not-qualifying", approvedVariantCount: 2 });
});

test("a player count outside 1..5 yields unoffered-count", () => {
  const result = checkGauntletQualification({
    villainGroupIds: ["core/brotherhood", "core/hydra"],
    henchmanGroupIds: ["core/sentinel"],
    playerCount: 7,
    menu: MENU,
  });
  assert.deepEqual(result, { status: "unoffered-count" });
});

test("the input group arrays are not mutated by a call", () => {
  // why: the comparison must sort spread copies, not the live input arrays —
  // an in-place sort would reorder the caller's reactive draft chips.
  const villainGroupIds = ["core/hydra", "core/brotherhood"];
  const henchmanGroupIds = ["core/sentinel"];
  const villainSnapshot = [...villainGroupIds];
  const henchmanSnapshot = [...henchmanGroupIds];
  checkGauntletQualification({
    villainGroupIds,
    henchmanGroupIds,
    playerCount: 2,
    menu: MENU,
  });
  assert.deepEqual(villainGroupIds, villainSnapshot);
  assert.deepEqual(henchmanGroupIds, henchmanSnapshot);
});
