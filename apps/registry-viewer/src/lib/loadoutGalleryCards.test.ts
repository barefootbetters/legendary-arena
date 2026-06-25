/**
 * loadoutGalleryCards.test.ts — node:test coverage for the Cards-tab
 * "View loadout as cards" gallery helpers (WP-288 / EC-320 / D-24072).
 *
 * Covers the EC-320 §Required Test Matrix:
 *  - compositionExtIdSet collects all 5 composition fields into one set,
 *    dedups a repeated id, skips empty scheme/mastermind single slots, and
 *    returns an empty set for an empty composition.
 *  - isCardInLoadoutComposition is true for a card whose extId is in the set
 *    and false otherwise.
 *  - group→member expansion: two cards sharing one group extId both match the
 *    set built from that single group id (proves a hero group renders all its
 *    member cards).
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { SetupCompositionInput } from "@legendary-arena/registry/setupContract";

import {
  compositionExtIdSet,
  isCardInLoadoutComposition,
} from "./loadoutGalleryCards.js";

// why: a full composition object (the 5 id fields + the 4 counts the type
// requires). Tests override only the id fields; the counts are inert here —
// the helper reads none of them.
function makeComposition(overrides: Partial<SetupCompositionInput>): SetupCompositionInput {
  return {
    schemeId: "",
    mastermindId: "",
    villainGroupIds: [],
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
    ...overrides,
  };
}

describe("compositionExtIdSet", () => {
  it("collects all five composition fields into one set", () => {
    const composition = makeComposition({
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/magneto",
      villainGroupIds: ["core/brotherhood", "core/hydra"],
      henchmanGroupIds: ["core/sentinel"],
      heroDeckIds: ["core/wolverine", "core/spider-man"],
    });

    const extIdSet = compositionExtIdSet(composition);

    assert.equal(extIdSet.size, 7);
    assert.ok(extIdSet.has("core/midtown-bank-robbery"));
    assert.ok(extIdSet.has("core/magneto"));
    assert.ok(extIdSet.has("core/brotherhood"));
    assert.ok(extIdSet.has("core/hydra"));
    assert.ok(extIdSet.has("core/sentinel"));
    assert.ok(extIdSet.has("core/wolverine"));
    assert.ok(extIdSet.has("core/spider-man"));
  });

  it("dedups a repeated id across fields", () => {
    // why: the same group id appearing twice (e.g. a villain group also picked
    // as a henchman group, or duplicated within an array) collapses to ONE
    // entry — Set.add is idempotent.
    const composition = makeComposition({
      villainGroupIds: ["core/brotherhood", "core/brotherhood"],
      henchmanGroupIds: ["core/brotherhood"],
    });

    const extIdSet = compositionExtIdSet(composition);

    assert.equal(extIdSet.size, 1);
    assert.ok(extIdSet.has("core/brotherhood"));
  });

  it("skips an empty scheme / mastermind single slot", () => {
    // why: "" is "no pick", not an ext_id — it must never enter the set, or a
    // card with an empty extId would spuriously match.
    const composition = makeComposition({
      schemeId: "",
      mastermindId: "",
      heroDeckIds: ["core/wolverine"],
    });

    const extIdSet = compositionExtIdSet(composition);

    assert.equal(extIdSet.size, 1);
    assert.ok(!extIdSet.has(""));
    assert.ok(extIdSet.has("core/wolverine"));
  });

  it("returns an empty set for an empty composition", () => {
    const extIdSet = compositionExtIdSet(makeComposition({}));
    assert.equal(extIdSet.size, 0);
  });
});

describe("isCardInLoadoutComposition", () => {
  it("is true for a card whose extId is in the set", () => {
    const extIdSet = compositionExtIdSet(
      makeComposition({ heroDeckIds: ["core/wolverine"] }),
    );
    assert.equal(isCardInLoadoutComposition({ extId: "core/wolverine" }, extIdSet), true);
  });

  it("is false for a card whose extId is not in the set", () => {
    const extIdSet = compositionExtIdSet(
      makeComposition({ heroDeckIds: ["core/wolverine"] }),
    );
    assert.equal(isCardInLoadoutComposition({ extId: "core/spider-man" }, extIdSet), false);
  });
});

describe("group → member-card expansion", () => {
  it("matches every member card sharing one group extId", () => {
    // why: a hero group's member cards all carry the SAME set-qualified group
    // extId (D-24018). Building the set from the single group id and testing two
    // distinct member cards proves the gallery renders ALL of a group's cards,
    // not just one. Member cards differ by FlatCard.key (display id) but share
    // extId — keying membership on extId is what makes the expansion work.
    const extIdSet = compositionExtIdSet(
      makeComposition({ heroDeckIds: ["core/wolverine"] }),
    );

    const memberCardOne = { extId: "core/wolverine" };
    const memberCardTwo = { extId: "core/wolverine" };

    assert.equal(isCardInLoadoutComposition(memberCardOne, extIdSet), true);
    assert.equal(isCardInLoadoutComposition(memberCardTwo, extIdSet), true);
    assert.equal(
      isCardInLoadoutComposition({ extId: "core/not-in-this-group" }, extIdSet),
      false,
    );
  });
});
