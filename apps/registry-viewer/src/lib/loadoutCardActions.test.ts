/**
 * loadoutCardActions.test.ts — node:test coverage for the Cards-tab
 * add-to-loadout helpers (WP-279 / EC-310 / D-24054).
 *
 * Covers the EC-310 §Required Test Matrix: resolveLoadoutSlot routing for all
 * five composition types + the non-composition → null case; isCardInLoadout
 * single-slot equality + group membership; toggleCardInLoadout add / remove /
 * single-slot overwrite-then-clear / Always-Leads-locked no-op /
 * non-composition no-op.
 *
 * toggleCardInLoadout is exercised against a REAL useLoadoutDraft instance
 * (built with a minimal mock registry) so the test proves the helper drives
 * the actual UseLoadoutDraftApi methods — including the Always-Leads
 * requiredVillainGroupIds computed — not a hand-rolled stub.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { SetupCompositionInput } from "@legendary-arena/registry/setupContract";

import { useLoadoutDraft } from "../composables/useLoadoutDraft.js";
import {
  resolveLoadoutSlot,
  isCardInLoadout,
  toggleCardInLoadout,
  type LoadoutActionCard,
} from "./loadoutCardActions.js";

// why: a minimal registry whose listCards() supplies the ext_id + cardType +
// alwaysLeads universe the draft needs. Magneto Always Leads the Brotherhood,
// so selecting it auto-includes (and requires) core/brotherhood — the fixture
// the Always-Leads no-op test relies on.
const MOCK_CARDS: Array<{ extId: string; cardType: string; alwaysLeads?: readonly string[] }> = [
  { extId: "core/midtown-bank-robbery", cardType: "scheme" },
  { extId: "core/secret-invasion", cardType: "scheme" },
  { extId: "core/magneto", cardType: "mastermind", alwaysLeads: ["brotherhood"] },
  { extId: "core/loki", cardType: "mastermind" },
  { extId: "core/brotherhood", cardType: "villain" },
  { extId: "core/hydra", cardType: "villain" },
  { extId: "core/sentinel", cardType: "henchman" },
  { extId: "core/wolverine", cardType: "hero" },
  { extId: "core/spider-man", cardType: "hero" },
];

function makeMockRegistry() {
  return {
    listCards() {
      return MOCK_CARDS;
    },
  };
}

/** A fresh draft API per test, so toggles never bleed across cases. */
function makeApi() {
  return useLoadoutDraft(makeMockRegistry());
}

function card(extId: string, cardType: string): LoadoutActionCard {
  return { extId, cardType };
}

/** A composition with everything empty, for the read-only isCardInLoadout checks. */
function emptyComposition(): SetupCompositionInput {
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
  };
}

describe("resolveLoadoutSlot (WP-279)", () => {
  it("maps each of the five composition types to its slot", () => {
    assert.equal(resolveLoadoutSlot("scheme"), "scheme");
    assert.equal(resolveLoadoutSlot("mastermind"), "mastermind");
    assert.equal(resolveLoadoutSlot("villain"), "villain");
    assert.equal(resolveLoadoutSlot("henchman"), "henchman");
    assert.equal(resolveLoadoutSlot("hero"), "hero");
  });

  it("returns null for non-composition card types", () => {
    assert.equal(resolveLoadoutSlot("bystander"), null);
    assert.equal(resolveLoadoutSlot("wound"), null);
    assert.equal(resolveLoadoutSlot("other"), null);
    assert.equal(resolveLoadoutSlot(""), null);
  });
});

describe("isCardInLoadout (WP-279)", () => {
  it("single-slot equality: scheme present vs absent", () => {
    const composition = emptyComposition();
    assert.equal(isCardInLoadout(composition, card("core/midtown-bank-robbery", "scheme")), false);
    composition.schemeId = "core/midtown-bank-robbery";
    assert.equal(isCardInLoadout(composition, card("core/midtown-bank-robbery", "scheme")), true);
    assert.equal(isCardInLoadout(composition, card("core/secret-invasion", "scheme")), false);
  });

  it("single-slot equality: mastermind present vs absent", () => {
    const composition = emptyComposition();
    assert.equal(isCardInLoadout(composition, card("core/magneto", "mastermind")), false);
    composition.mastermindId = "core/magneto";
    assert.equal(isCardInLoadout(composition, card("core/magneto", "mastermind")), true);
  });

  it("group membership: hero / villain / henchman in vs not-in the array", () => {
    const composition = emptyComposition();
    composition.heroDeckIds = ["core/wolverine"];
    composition.villainGroupIds = ["core/hydra"];
    composition.henchmanGroupIds = ["core/sentinel"];
    assert.equal(isCardInLoadout(composition, card("core/wolverine", "hero")), true);
    assert.equal(isCardInLoadout(composition, card("core/spider-man", "hero")), false);
    assert.equal(isCardInLoadout(composition, card("core/hydra", "villain")), true);
    assert.equal(isCardInLoadout(composition, card("core/brotherhood", "villain")), false);
    assert.equal(isCardInLoadout(composition, card("core/sentinel", "henchman")), true);
  });

  it("non-composition card type is never in the loadout", () => {
    const composition = emptyComposition();
    composition.schemeId = "core/midtown-bank-robbery";
    assert.equal(isCardInLoadout(composition, card("core/whatever", "bystander")), false);
  });
});

describe("toggleCardInLoadout (WP-279)", () => {
  it("hero: add (absent → present) then remove (present → absent)", () => {
    const api = makeApi();
    const wolverine = card("core/wolverine", "hero");
    toggleCardInLoadout(api, wolverine);
    assert.deepEqual(api.draft.value.composition.heroDeckIds, ["core/wolverine"]);
    assert.equal(isCardInLoadout(api.draft.value.composition, wolverine), true);
    toggleCardInLoadout(api, wolverine);
    assert.deepEqual(api.draft.value.composition.heroDeckIds, []);
    assert.equal(isCardInLoadout(api.draft.value.composition, wolverine), false);
  });

  it("villain (non-required): add then remove", () => {
    const api = makeApi();
    const hydra = card("core/hydra", "villain");
    toggleCardInLoadout(api, hydra);
    assert.deepEqual(api.draft.value.composition.villainGroupIds, ["core/hydra"]);
    toggleCardInLoadout(api, hydra);
    assert.deepEqual(api.draft.value.composition.villainGroupIds, []);
  });

  it("henchman: add then remove", () => {
    const api = makeApi();
    const sentinel = card("core/sentinel", "henchman");
    toggleCardInLoadout(api, sentinel);
    assert.deepEqual(api.draft.value.composition.henchmanGroupIds, ["core/sentinel"]);
    toggleCardInLoadout(api, sentinel);
    assert.deepEqual(api.draft.value.composition.henchmanGroupIds, []);
  });

  it("scheme: overwrite-then-clear single slot", () => {
    const api = makeApi();
    const scheme = card("core/midtown-bank-robbery", "scheme");
    toggleCardInLoadout(api, scheme);
    assert.equal(api.draft.value.composition.schemeId, "core/midtown-bank-robbery");
    toggleCardInLoadout(api, scheme);
    assert.equal(api.draft.value.composition.schemeId, "");
  });

  it("mastermind: overwrite-then-clear single slot", () => {
    const api = makeApi();
    const loki = card("core/loki", "mastermind");
    toggleCardInLoadout(api, loki);
    assert.equal(api.draft.value.composition.mastermindId, "core/loki");
    toggleCardInLoadout(api, loki);
    assert.equal(api.draft.value.composition.mastermindId, "");
  });

  it("Always-Leads villain group is NOT removable via the button (no-op stays present)", () => {
    const api = makeApi();
    // Selecting Magneto auto-includes (and requires) core/brotherhood.
    api.setMastermind("core/magneto");
    assert.ok(api.draft.value.composition.villainGroupIds.includes("core/brotherhood"));
    assert.ok(api.requiredVillainGroupIds.value.includes("core/brotherhood"));
    const brotherhood = card("core/brotherhood", "villain");
    // The brotherhood card is present, so a toggle attempts removal — but it is
    // a required group, so the helper must leave it in place.
    toggleCardInLoadout(api, brotherhood);
    assert.ok(
      api.draft.value.composition.villainGroupIds.includes("core/brotherhood"),
      "Always-Leads villain group must remain after a remove attempt",
    );
  });

  it("non-composition card type is a no-op (no throw, no mutation)", () => {
    const api = makeApi();
    const before = JSON.stringify(api.draft.value.composition);
    assert.doesNotThrow(() => toggleCardInLoadout(api, card("core/anything", "bystander")));
    assert.equal(JSON.stringify(api.draft.value.composition), before);
  });
});
