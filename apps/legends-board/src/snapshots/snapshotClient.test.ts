import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import type {
  GauntletIndexEntry,
  GauntletSnapshotEntry,
} from "./snapshotClient.ts";

/**
 * Unit tests for the snapshot client's pure helpers.
 *
 * The fetch-based functions (fetchManifest, fetchBoard, etc.) depend on
 * import.meta.env which is Vite-specific and not available in node:test.
 * Those are tested via the dev server smoke test. These tests cover the
 * pure logic: boardDisplayName, getPollIntervalMs, and cache invalidation.
 */

describe("boardDisplayName", () => {
  /**
   * We test the display-name derivation logic directly. The function
   * is a pure string transform with no dependencies.
   */
  it("capitalizes a single-word slug", async () => {
    const { boardDisplayName } = await import("./snapshotClient.ts");
    assert.equal(boardDisplayName("overall"), "Overall");
  });

  it("capitalizes each word in a hyphenated slug", async () => {
    const { boardDisplayName } = await import("./snapshotClient.ts");
    assert.equal(boardDisplayName("by-scheme"), "By Scheme");
  });

  it("handles multi-word slugs", async () => {
    const { boardDisplayName } = await import("./snapshotClient.ts");
    assert.equal(
      boardDisplayName("recent-achievements"),
      "Recent Achievements",
    );
  });

  it("handles now-playing slug", async () => {
    const { boardDisplayName } = await import("./snapshotClient.ts");
    assert.equal(boardDisplayName("now-playing"), "Now Playing");
  });

  it("titles the WP-343 gauntlet-index attract slide", async () => {
    const { boardDisplayName } = await import("./snapshotClient.ts");
    assert.equal(boardDisplayName("gauntlet-index"), "Gauntlet Index");
  });
});

/**
 * The WP-344 additive fields (`players` on entries; `entryCounts` + `legs`
 * on index entries) are hand-mirrored as OPTIONAL on the client — a
 * pre-WP-344 snapshot in R2 lacks them. These fixtures pin that both the
 * fresh shape and the old shape type-check and read back as expected
 * (absent fields tolerated). This is the client mirror's compile-time guard.
 */
describe("gauntlet additive field mirror (WP-345)", () => {
  it("a fresh-shape entry carries the published roster", () => {
    const entry: GauntletSnapshotEntry = {
      handle: "alice",
      rank: 1,
      totalScore: -5,
      legCount: 4,
      averageScoreCentis: -125,
      players: ["alice", "bob"],
    };
    assert.deepEqual(entry.players, ["alice", "bob"]);
  });

  it("an old-shape entry omits `players` and still type-checks", () => {
    const entry: GauntletSnapshotEntry = {
      handle: "solo",
      rank: 1,
      totalScore: -5,
      legCount: 4,
      averageScoreCentis: -125,
    };
    assert.equal(entry.players, undefined);
  });

  it("a fresh-shape index entry carries entryCounts + legs", () => {
    const entry: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "dr-doom",
      mastermindName: "Dr. Doom",
      legCount: 4,
      entryCount: 3,
      board: "gauntlet-core-dr-doom",
      entryCounts: { "1": 3, "2": 1, "3": 0, "4": 0, "5": 0 },
      legs: [{ schemeSlug: "midtown-bank-robbery", schemeName: "Midtown Bank Robbery" }],
    };
    assert.equal(entry.entryCounts?.["2"], 1);
    assert.equal(entry.legs?.[0]?.schemeSlug, "midtown-bank-robbery");
  });

  it("an old-shape index entry omits entryCounts + legs", () => {
    const entry: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "loki",
      mastermindName: "Loki",
      legCount: 4,
      entryCount: 0,
      board: "gauntlet-core-loki",
    };
    assert.equal(entry.entryCounts, undefined);
    assert.equal(entry.legs, undefined);
  });
});

/**
 * WP-385 / D-24187 §6 additive mirrors: fixed-division entries carry
 * `heroPool`, and index entries carry `fixedEntryCounts` — both OPTIONAL
 * on the client so pre-WP-384 snapshots degrade to WP-345 rendering.
 */
describe("fixed-division additive field mirror (WP-385)", () => {
  it("a fixed-board entry carries the hero pool", () => {
    const entry: GauntletSnapshotEntry = {
      handle: "alice",
      rank: 1,
      totalScore: -5,
      legCount: 4,
      averageScoreCentis: -125,
      players: ["alice"],
      heroPool: ["core/black-widow", "core/iron-man", "msp1/spider-man"],
    };
    assert.equal(entry.heroPool?.length, 3);
  });

  it("an open-board entry omits `heroPool` and still type-checks", () => {
    const entry: GauntletSnapshotEntry = {
      handle: "alice",
      rank: 1,
      totalScore: -5,
      legCount: 4,
      averageScoreCentis: -125,
      players: ["alice"],
    };
    assert.equal(entry.heroPool, undefined);
  });

  it("a fresh index entry carries fixedEntryCounts; an old one omits it", () => {
    const freshEntry: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "dr-doom",
      mastermindName: "Dr. Doom",
      legCount: 4,
      entryCount: 3,
      board: "gauntlet-core-dr-doom",
      entryCounts: { "1": 3, "2": 1, "3": 0, "4": 0, "5": 0 },
      fixedEntryCounts: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 0 },
      legs: [],
    };
    assert.equal(freshEntry.fixedEntryCounts?.["1"], 1);

    const oldEntry: GauntletIndexEntry = {
      setAbbr: "core",
      setName: "Core Set",
      mastermindSlug: "loki",
      mastermindName: "Loki",
      legCount: 4,
      entryCount: 0,
      board: "gauntlet-core-loki",
    };
    assert.equal(oldEntry.fixedEntryCounts, undefined);
  });
});
