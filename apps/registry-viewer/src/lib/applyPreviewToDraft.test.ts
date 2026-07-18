/**
 * applyPreviewToDraft.test.ts — node:test coverage for the preview → shared
 * draft promotion (D-24190).
 *
 * The regression this locks: a scheme+mastermind-only challenge link (the
 * WP-114 / WP-345 partial seed) must promote. The previous implementation
 * round-tripped through `loadFromJson`, whose full-document validation rejects
 * empty villain / henchman / hero arrays, so the draft stayed blank and
 * "Edit this loadout" silently did nothing.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";

import {
  applyPreviewToDraft,
  type PreviewPromotionDraftApi,
} from "./applyPreviewToDraft.js";

/** A recording stub of the draft mutators the promotion calls. */
function makeDraftStub(initial?: {
  villainGroupIds?: string[];
  henchmanGroupIds?: string[];
  heroDeckIds?: string[];
}): {
  api: PreviewPromotionDraftApi;
  calls: string[];
  state: {
    schemeId: string;
    mastermindId: string;
    villainGroupIds: string[];
    henchmanGroupIds: string[];
    heroDeckIds: string[];
    counts: Record<string, number>;
    playerCount: number;
  };
} {
  const calls: string[] = [];
  const state = {
    schemeId: "",
    mastermindId: "",
    villainGroupIds: [...(initial?.villainGroupIds ?? [])],
    henchmanGroupIds: [...(initial?.henchmanGroupIds ?? [])],
    heroDeckIds: [...(initial?.heroDeckIds ?? [])],
    counts: {} as Record<string, number>,
    playerCount: 2,
  };
  const api: PreviewPromotionDraftApi = {
    draft: {
      value: {
        composition: {
          get villainGroupIds() {
            return state.villainGroupIds;
          },
          get henchmanGroupIds() {
            return state.henchmanGroupIds;
          },
          get heroDeckIds() {
            return state.heroDeckIds;
          },
        },
      } as unknown as MatchSetupDocument,
    },
    setScheme: (id) => {
      calls.push(`setScheme:${id}`);
      state.schemeId = id;
    },
    setMastermind: (id) => {
      calls.push(`setMastermind:${id}`);
      state.mastermindId = id;
    },
    addVillainGroup: (id) => {
      calls.push(`addVillainGroup:${id}`);
      state.villainGroupIds.push(id);
    },
    removeVillainGroup: (id) => {
      calls.push(`removeVillainGroup:${id}`);
      state.villainGroupIds = state.villainGroupIds.filter((g) => g !== id);
    },
    addHenchmanGroup: (id) => {
      calls.push(`addHenchmanGroup:${id}`);
      state.henchmanGroupIds.push(id);
    },
    removeHenchmanGroup: (id) => {
      calls.push(`removeHenchmanGroup:${id}`);
      state.henchmanGroupIds = state.henchmanGroupIds.filter((g) => g !== id);
    },
    addHeroGroup: (id) => {
      calls.push(`addHeroGroup:${id}`);
      state.heroDeckIds.push(id);
    },
    removeHeroGroup: (id) => {
      calls.push(`removeHeroGroup:${id}`);
      state.heroDeckIds = state.heroDeckIds.filter((h) => h !== id);
    },
    setCount: (field, value) => {
      calls.push(`setCount:${field}=${value}`);
      state.counts[field] = value;
    },
    setPlayerCount: (value) => {
      calls.push(`setPlayerCount:${value}`);
      state.playerCount = value;
    },
  };
  return { api, calls, state };
}

/** Builds a preview document with the given composition pieces. */
function makePreview(overrides: {
  schemeId: string;
  mastermindId: string;
  villainGroupIds?: string[];
  henchmanGroupIds?: string[];
  heroDeckIds?: string[];
  playerCount?: number;
}): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "url-preview",
    createdAt: "1970-01-01T00:00:00.000Z",
    createdBy: "system",
    seed: "0000000000000000",
    playerCount: overrides.playerCount ?? 2,
    expansions: [],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: overrides.schemeId,
      mastermindId: overrides.mastermindId,
      villainGroupIds: overrides.villainGroupIds ?? [],
      henchmanGroupIds: overrides.henchmanGroupIds ?? [],
      heroDeckIds: overrides.heroDeckIds ?? [],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
  } as unknown as MatchSetupDocument;
}

describe("applyPreviewToDraft (D-24190)", () => {
  it("promotes a scheme+mastermind-only preview (the partial challenge-link seed)", () => {
    // why: THE regression. This shape previously failed `loadFromJson`'s
    // full-document validation (empty arrays violate the >= 1 rule) and left
    // the draft blank — "Edit this loadout" did nothing.
    const { api, state } = makeDraftStub();
    applyPreviewToDraft(
      api,
      makePreview({
        schemeId: "co2e/bank-robbery-hostage-crisis",
        mastermindId: "co2e/red-skull",
      }),
    );

    assert.equal(state.schemeId, "co2e/bank-robbery-hostage-crisis");
    assert.equal(state.mastermindId, "co2e/red-skull");
    assert.deepEqual(state.villainGroupIds, []);
    assert.deepEqual(state.henchmanGroupIds, []);
    assert.deepEqual(state.heroDeckIds, []);
  });

  it("promotes a fully-specified preview including every group array", () => {
    const { api, state } = makeDraftStub();
    applyPreviewToDraft(
      api,
      makePreview({
        schemeId: "core/midtown-bank-robbery",
        mastermindId: "core/loki",
        villainGroupIds: ["core/hydra", "core/brotherhood"],
        henchmanGroupIds: ["core/sentinel"],
        heroDeckIds: ["core/spider-man", "core/wolverine"],
      }),
    );

    assert.deepEqual(state.villainGroupIds, ["core/hydra", "core/brotherhood"]);
    assert.deepEqual(state.henchmanGroupIds, ["core/sentinel"]);
    assert.deepEqual(state.heroDeckIds, ["core/spider-man", "core/wolverine"]);
  });

  it("REPLACES existing draft picks rather than merging into them", () => {
    const { api, state } = makeDraftStub({
      villainGroupIds: ["old/villain"],
      henchmanGroupIds: ["old/henchman"],
      heroDeckIds: ["old/hero-a", "old/hero-b"],
    });
    applyPreviewToDraft(
      api,
      makePreview({
        schemeId: "core/scheme",
        mastermindId: "core/mastermind",
        villainGroupIds: ["new/villain"],
      }),
    );

    assert.deepEqual(state.villainGroupIds, ["new/villain"]);
    assert.deepEqual(state.henchmanGroupIds, []);
    assert.deepEqual(state.heroDeckIds, []);
  });

  it("sets the mastermind BEFORE adding villain groups (Always-Leads survives)", () => {
    const { api, calls } = makeDraftStub();
    applyPreviewToDraft(
      api,
      makePreview({
        schemeId: "core/scheme",
        mastermindId: "core/magneto",
        villainGroupIds: ["core/hydra"],
      }),
    );

    const mastermindIndex = calls.indexOf("setMastermind:core/magneto");
    const villainIndex = calls.indexOf("addVillainGroup:core/hydra");
    assert.ok(mastermindIndex >= 0 && villainIndex >= 0);
    assert.ok(
      mastermindIndex < villainIndex,
      "setMastermind must run before the villain adds so Always-Leads groups survive.",
    );
  });

  it("carries the preview's counts and player count (the WP-387 URL count)", () => {
    const { api, state } = makeDraftStub();
    applyPreviewToDraft(
      api,
      makePreview({
        schemeId: "core/scheme",
        mastermindId: "core/mastermind",
        playerCount: 4,
      }),
    );

    assert.equal(state.playerCount, 4);
    assert.equal(state.counts.bystandersCount, 30);
    assert.equal(state.counts.woundsCount, 30);
    assert.equal(state.counts.officersCount, 30);
    assert.equal(state.counts.sidekicksCount, 0);
  });
});
