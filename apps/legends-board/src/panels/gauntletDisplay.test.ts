import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAttractBoardList,
  buildChallengeUrl,
  buildPlayerCountTabs,
  formatAverageScore,
  formatRoster,
  groupGauntletsBySet,
  resolveBoardIndexEntry,
  rosterForEntry,
} from "./gauntletDisplay.ts";
import type {
  GauntletEntryCounts,
  GauntletIndexEntry,
} from "../snapshots/snapshotClient.ts";

/**
 * Pure display-helper tests (WP-343 AC-3 / AC-7 and the grouping half
 * of AC-4). Component rendering is covered by vue-tsc + the dev-server
 * smoke per the EC-373 test-posture reconciliation.
 */

describe("formatAverageScore", () => {
  it("zero renders as E (even with PAR, the golf convention)", () => {
    assert.equal(formatAverageScore(0), "E");
  });

  it("negative centis render signed one-decimal (under PAR)", () => {
    assert.equal(formatAverageScore(-350), "-3.5");
  });

  it("positive centis gain an explicit plus sign (over PAR)", () => {
    assert.equal(formatAverageScore(125), "+1.3");
  });

  it("sub-decimal magnitudes round to one decimal", () => {
    assert.equal(formatAverageScore(-6), "-0.1");
    assert.equal(formatAverageScore(4), "+0.0");
  });
});

function indexEntry(
  setAbbr: string,
  mastermindSlug: string,
  entryCount: number,
): GauntletIndexEntry {
  return {
    setAbbr,
    setName: `${setAbbr.toUpperCase()} Set`,
    mastermindSlug,
    mastermindName: mastermindSlug,
    legCount: 4,
    entryCount,
    board: `gauntlet-${setAbbr}-${mastermindSlug}`,
  };
}

describe("groupGauntletsBySet", () => {
  it("groups consecutive entries by set, preserving artifact order", () => {
    const groups = groupGauntletsBySet([
      indexEntry("core", "dr-doom", 1),
      indexEntry("core", "loki", 0),
      indexEntry("dkpr", "high-evolutionary", 0),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.setAbbr, "core");
    assert.equal(groups[0]?.gauntlets.length, 2);
    assert.equal(groups[1]?.setAbbr, "dkpr");
    assert.equal(groups[1]?.gauntlets.length, 1);
  });

  it("an empty index yields no groups", () => {
    assert.deepEqual(groupGauntletsBySet([]), []);
  });
});

describe("buildAttractBoardList", () => {
  it("without a gauntlet index the cycle list is unchanged", () => {
    assert.deepEqual(buildAttractBoardList(["global-top"], false), [
      "global-top",
    ]);
  });

  it("with a gauntlet index the cycle gains exactly one extra slide", () => {
    assert.deepEqual(buildAttractBoardList(["global-top"], true), [
      "global-top",
      "gauntlet-index",
    ]);
  });

  it("never adds per-gauntlet boards to the cycle", () => {
    const cycle = buildAttractBoardList(["global-top"], true);
    const gauntletBoardSlides = cycle.filter(
      (name) => name.startsWith("gauntlet-") && name !== "gauntlet-index",
    );
    assert.deepEqual(gauntletBoardSlides, []);
  });
});

/**
 * Fresh-shape index entry (WP-344 fields present) for the player-count
 * helpers. `entryCounts` and `legs` default to a solo-only claimed shape.
 */
function freshIndexEntry(
  overrides: Partial<GauntletIndexEntry> = {},
): GauntletIndexEntry {
  return {
    setAbbr: "core",
    setName: "Core Set",
    mastermindSlug: "dr-doom",
    mastermindName: "Dr. Doom",
    legCount: 4,
    entryCount: 3,
    board: "gauntlet-core-dr-doom",
    entryCounts: { "1": 3, "2": 0, "3": 0, "4": 0, "5": 0 },
    legs: [{ schemeSlug: "midtown-bank-robbery", schemeName: "Midtown Bank Robbery" }],
    ...overrides,
  };
}

describe("buildPlayerCountTabs (WP AC-1)", () => {
  it("links the claimed counts and leaves the empty counts unlinked", () => {
    const entryCounts: GauntletEntryCounts = {
      "1": 3,
      "2": 1,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    const tabs = buildPlayerCountTabs(freshIndexEntry({ entryCounts }));

    assert.equal(tabs.length, 5);
    // Solo — linked, bare board name.
    assert.equal(tabs[0]?.playerCount, 1);
    assert.equal(tabs[0]?.boardName, "gauntlet-core-dr-doom");
    assert.equal(tabs[0]?.isClaimed, true);
    // p2 — linked, `-p2` board name.
    assert.equal(tabs[1]?.playerCount, 2);
    assert.equal(tabs[1]?.boardName, "gauntlet-core-dr-doom-p2");
    assert.equal(tabs[1]?.isClaimed, true);
    // p3-p5 — unclaimed, still carry the `-p<N>` board name for the tab label.
    for (const tab of tabs.slice(2)) {
      assert.equal(tab.isClaimed, false);
      assert.equal(tab.boardName, `gauntlet-core-dr-doom-p${tab.playerCount}`);
    }
  });

  it("degrades to a solo-only tab when `entryCounts` is absent", () => {
    const oldShape: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "loki",
      mastermindName: "Loki",
      legCount: 4,
      entryCount: 2,
      board: "gauntlet-core-loki",
    };
    const tabs = buildPlayerCountTabs(oldShape);
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0]?.playerCount, 1);
    assert.equal(tabs[0]?.boardName, "gauntlet-core-loki");
    assert.equal(tabs[0]?.isClaimed, true);
  });
});

describe("formatRoster / rosterForEntry (WP AC-2)", () => {
  it("joins a multi-player roster with ' + '", () => {
    assert.equal(formatRoster(["alice", "bob"]), "alice + bob");
  });

  it("renders a solo roster as the single handle", () => {
    assert.equal(formatRoster(["solo"]), "solo");
  });

  it("shapes an entry's roster from its `players` field", () => {
    assert.equal(
      rosterForEntry({ handle: "alice", players: ["alice", "bob"] }),
      "alice + bob",
    );
  });

  it("falls back to `handle` when `players` is absent (old snapshot)", () => {
    assert.equal(rosterForEntry({ handle: "carol" }), "carol");
  });
});

describe("buildChallengeUrl (WP AC-3)", () => {
  it("pins the two-key URL with `/` encoded as %2F", () => {
    assert.equal(
      buildChallengeUrl("core", "midtown-bank-robbery", "dr-doom"),
      "https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom",
    );
  });
});

describe("resolveBoardIndexEntry (WP AC-4)", () => {
  const gauntlets: readonly GauntletIndexEntry[] = [
    freshIndexEntry(),
    freshIndexEntry({
      mastermindSlug: "loki",
      mastermindName: "Loki",
      board: "gauntlet-core-loki",
    }),
  ];

  it("strips a `-p<N>` suffix to the parent gauntlet entry", () => {
    const resolved = resolveBoardIndexEntry(
      "gauntlet-core-dr-doom-p2",
      gauntlets,
    );
    assert.equal(resolved?.board, "gauntlet-core-dr-doom");
  });

  it("resolves a bare board name directly", () => {
    const resolved = resolveBoardIndexEntry("gauntlet-core-loki", gauntlets);
    assert.equal(resolved?.board, "gauntlet-core-loki");
  });

  it("returns null for an unknown board", () => {
    assert.equal(resolveBoardIndexEntry("gauntlet-core-thanos", gauntlets), null);
    assert.equal(
      resolveBoardIndexEntry("gauntlet-core-thanos-p3", gauntlets),
      null,
    );
  });
});
