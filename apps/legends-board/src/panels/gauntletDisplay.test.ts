import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildAttractBoardList,
  formatAverageScore,
  groupGauntletsBySet,
} from "./gauntletDisplay.ts";
import type { GauntletIndexEntry } from "../snapshots/snapshotClient.ts";

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
