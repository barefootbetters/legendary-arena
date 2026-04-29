/**
 * shared.test.ts — Phase 1 ribbon zero-card invariants for WP-086.
 *
 * Asserts that filtering by Phase-2-only cardType slugs (sidekick,
 * shield-agent) returns zero cards because flattenSet() in shared.ts
 * assigns one of 8 hardcoded literals (hero / mastermind / villain /
 * henchman / scheme / bystander / wound / other) and never sidekick or
 * shield-*. Phase 2 (separate WP) regenerates per-card cardType emission
 * upstream via modern-master-strike.
 *
 * Also asserts the existing `hero` regression baseline + no-crash
 * behavior on unknown slugs.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { applyQuery } from "./shared.js";
import type { FlatCard, FlatCardType, CardQueryExtended } from "./browser.js";

const fixtureCards: FlatCard[] = [
  {
    key:       "core-hero-spider-man-web-of-confusion",
    cardType:  "hero",
    setAbbr:   "core",
    setName:   "Core Set",
    name:      "Web of Confusion",
    slug:      "web-of-confusion",
    imageUrl:  "https://images.barefootbetters.com/core/example.webp",
    abilities: [],
  },
  {
    key:       "core-mastermind-dr-doom-main",
    cardType:  "mastermind",
    setAbbr:   "core",
    setName:   "Core Set",
    name:      "Dr. Doom",
    slug:      "dr-doom",
    imageUrl:  "https://images.barefootbetters.com/core/example.webp",
    abilities: [],
  },
];

describe("Phase 1 ribbon zero-card invariants (WP-086)", () => {
  it("sidekick filter returns zero cards (Phase 2 emission upstream)", () => {
    // why: cast to FlatCardType[] because "sidekick" is not in the 9-value
    // FlatCardType union at registry/types/types-index.ts. The cast mirrors
    // App.vue's applyFilters cast at the registry.query call site — both
    // reflect that selectedTypes can hold Phase-2-only slugs without widening
    // the narrow registry type.
    const q: CardQueryExtended = { cardTypes: ["sidekick"] as unknown as FlatCardType[] };
    const result = applyQuery(fixtureCards, q);
    assert.equal(result.length, 0);
  });

  it("shield-agent filter returns zero cards (Phase 2 emission upstream)", () => {
    const q: CardQueryExtended = { cardTypes: ["shield-agent"] as unknown as FlatCardType[] };
    const result = applyQuery(fixtureCards, q);
    assert.equal(result.length, 0);
  });

  it("hero filter returns hero cards (regression baseline)", () => {
    const q: CardQueryExtended = { cardTypes: ["hero"] };
    const result = applyQuery(fixtureCards, q);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.cardType, "hero");
  });

  it("unknown slug returns zero cards without crashing", () => {
    const q: CardQueryExtended = { cardTypes: ["totally-fake-slug"] as unknown as FlatCardType[] };
    const result = applyQuery(fixtureCards, q);
    assert.equal(result.length, 0);
  });
});
