/**
 * previewSetupRequirement.test.ts — WP-526 / D-24337.
 *
 * The URL-preview setup requirement is scheme-aware: Secret Invasion requires
 * 6 heroes, every other scheme uses the base per-player-count count.
 * node:test + node:assert only.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";
import { resolveSetupRequirement } from "./previewSetupRequirement.js";

const SECRET_INVASION = "core/secret-invasion-of-the-skrull-shapeshifters";

/** Builds a minimal preview document for a scheme + player count. */
function makePreviewDocument(schemeId: string, playerCount: number): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "url-preview",
    createdAt: "1970-01-01T00:00:00.000Z",
    createdBy: "system",
    seed: "0000000000000000",
    playerCount,
    expansions: [],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId,
      mastermindId: "core/dr-doom",
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
  } as MatchSetupDocument;
}

describe("resolveSetupRequirement", () => {
  it("requires 6 heroes for Secret Invasion at every player count", () => {
    for (const playerCount of [1, 2, 3, 4, 5]) {
      const requirement = resolveSetupRequirement(makePreviewDocument(SECRET_INVASION, playerCount));
      assert.ok(requirement, `expected a requirement for ${playerCount} players`);
      assert.equal(requirement.row.heroCount, 6, `Secret Invasion @${playerCount}p must require 6 heroes`);
      assert.equal(requirement.playerCount, playerCount);
    }
  });

  it("uses the base hero count for a non-Secret-Invasion scheme", () => {
    // 2-player base is 5 heroes; 5-player base is 6.
    assert.equal(resolveSetupRequirement(makePreviewDocument("core/super-hero-civil-war", 2))?.row.heroCount, 5);
    assert.equal(resolveSetupRequirement(makePreviewDocument("core/midtown-bank-robbery", 5))?.row.heroCount, 6);
  });

  it("leaves the non-hero required counts as the base table values", () => {
    // why: only heroCount is scheme-conditioned; villain/henchmen/bystander
    // counts come straight from PLAYER_COUNT_SETUP.
    const requirement = resolveSetupRequirement(makePreviewDocument(SECRET_INVASION, 2));
    assert.ok(requirement);
    assert.equal(requirement.row.villainGroupCount, 2);
    assert.equal(requirement.row.henchmenGroupCount, 1);
    assert.equal(requirement.row.villainDeckBystanderCount, 2);
  });

  it("returns null when there is no preview document", () => {
    assert.equal(resolveSetupRequirement(null), null);
  });

  it("returns null when the player count is outside the supported 1–5 range", () => {
    assert.equal(resolveSetupRequirement(makePreviewDocument(SECRET_INVASION, 9)), null);
    assert.equal(resolveSetupRequirement(makePreviewDocument("core/super-hero-civil-war", 0)), null);
  });
});
