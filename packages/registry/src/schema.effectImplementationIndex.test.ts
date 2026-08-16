/**
 * schema.effectImplementationIndex.test.ts — WP-484 / D-24289 effect implementation index
 *
 * Proves EffectImplementationIndexSchema (a) accepts the committed, generated index
 * at data/metadata/effect-implementation-index.json and (b) rejects each malformed
 * payload the published contract forbids: missing/wrong version, a non-"all"
 * top-level scope, an entry scope/status outside the closed unions, a summary count
 * mismatch (totalEntries, byScope, byStatus), both directions of the entry/card
 * join, and a card/entry scope disagreement. This is the producer-side guarantee
 * that the future /debug/effects viewer can trust the index it reads.
 *
 * Runner:  node:test (native Node.js test runner)
 * Invoke:  pnpm --filter @legendary-arena/registry test
 *
 * Assumptions:
 *   - CWD is packages/registry/ (pnpm --filter sets CWD to the package root)
 *   - data/metadata/effect-implementation-index.json exists at the monorepo root,
 *     two levels up
 *   - No network access, no database, no mocks — local files only
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EffectImplementationIndexSchema } from "./schema.js";

// why: pnpm --filter sets CWD to packages/registry/; the generated index lives at
// the monorepo root under data/metadata/, two directory levels up.
const indexPath = join(process.cwd(), "..", "..", "data", "metadata", "effect-implementation-index.json");

/**
 * Returns a fresh, minimally-valid effect-implementation index. Each reject case
 * mutates its own copy so the cases stay independent.
 */
function validIndex() {
  return {
    version: 1,
    scope: "all",
    generatedAt: "1970-01-01T00:00:00.000Z",
    summary: {
      totalEntries: 3,
      // why: WP-507 — the fixture carries one hero + one villain + one mastermind
      // entry so the byScope.mastermind tally (and the mastermind entry/card join)
      // is exercised, not just declared.
      byScope: { hero: 1, villain: 1, mastermind: 1 },
      byStatus: { executable: 2, deferred: 0, condition: 0, unsupported: 0, unmarked: 1, subsystem: 0 },
    },
    entries: [
      {
        extId: "core/hulk",
        name: "Hulk",
        set: "core",
        scope: "hero",
        mechanic: "draw",
        status: "executable",
        handler: "packages/game-engine/src/hero/heroEffects.execute.ts#draw",
        wp: "",
        decision: "",
      },
      {
        extId: "core-villain-hydra-viper",
        name: "Viper",
        set: "core",
        scope: "villain",
        mechanic: "(unmarked)",
        status: "unmarked",
        handler: "",
        wp: "",
        decision: "",
      },
      {
        extId: "core-mastermind-magneto-crushing-shockwave",
        name: "Crushing Shockwave",
        set: "core",
        scope: "mastermind",
        mechanic: "crushing-shockwave",
        status: "executable",
        handler: "packages/game-engine/src/rules/tacticHandlers.ts#resolveCrushingShockwave",
        wp: "WP-506",
        decision: "D-24312",
      },
    ],
    cards: {
      "core/hulk": { scope: "hero", mechanics: ["draw"] },
      "core-villain-hydra-viper": { scope: "villain", mechanics: ["(unmarked)"] },
      "core-mastermind-magneto-crushing-shockwave": { scope: "mastermind", mechanics: ["crushing-shockwave"] },
    },
  };
}

describe("EffectImplementationIndexSchema — accepts valid indexes (WP-484 / D-24289)", () => {
  it("accepts the minimal hand-built valid index", () => {
    const result = EffectImplementationIndexSchema.safeParse(validIndex());
    assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error.issues[0]));
  });

  it("accepts the committed, generated effect-implementation index", () => {
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const result = EffectImplementationIndexSchema.safeParse(index);
    assert.equal(
      result.success,
      true,
      result.success
        ? ""
        : `data/metadata/effect-implementation-index.json must validate: ${JSON.stringify(result.error.issues[0])}`,
    );
  });
});

describe("EffectImplementationIndexSchema — rejects malformed indexes (WP-484 / D-24289)", () => {
  it("rejects a missing version", () => {
    const index = validIndex();
    delete index.version;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a version other than 1", () => {
    const index = validIndex();
    index.version = 2;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a top-level scope other than all", () => {
    const index = validIndex();
    index.scope = "hero";
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects an entry scope outside the closed union", () => {
    const index = validIndex();
    index.entries[0].scope = "sidekick";
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects an entry status outside the closed union", () => {
    const index = validIndex();
    index.entries[0].status = "made-up";
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("accepts the subsystem status in the closed union (WP-548 / D-24357)", () => {
    // why: WP-548 — `subsystem` (a card covered by a non-[effect:X] subsystem) is a
    // valid closed-union status; flip the villain (unmarked) row to it and rebalance
    // byStatus so the whole index still validates.
    const index = validIndex();
    index.entries[1].status = "subsystem";
    index.summary.byStatus.unmarked = 0;
    index.summary.byStatus.subsystem = 1;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, true);
  });

  it("rejects a summary.totalEntries that does not equal entries.length", () => {
    const index = validIndex();
    index.summary.totalEntries = 99;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a byScope count that disagrees with the entry tally", () => {
    const index = validIndex();
    index.summary.byScope.hero = 99;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a byScope.mastermind count that disagrees with the entry tally", () => {
    // why: WP-507 — the mastermind scope is tallied by the same superRefine loop;
    // a wrong mastermind count must fail exactly like a wrong hero count.
    const index = validIndex();
    index.summary.byScope.mastermind = 99;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a byStatus count that disagrees with the entry tally", () => {
    const index = validIndex();
    index.summary.byStatus.executable = 99;
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects an entry->card join miss (an entry mechanic absent from cards{})", () => {
    const index = validIndex();
    index.entries[0].mechanic = "flight";
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a card->entry join miss (a card mechanic with no matching entry)", () => {
    const index = validIndex();
    index.cards["core/hulk"].mechanics = ["draw", "flight"];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a card scope that disagrees with its entries", () => {
    const index = validIndex();
    index.cards["core/hulk"].scope = "villain";
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });
});

describe("EffectImplementationEntrySchema — the optional designs field (WP-491 / D-24297)", () => {
  it("accepts a hero entry carrying a valid non-empty designs list", () => {
    const index = validIndex();
    index.entries[0].designs = [{ slug: "mission-accomplished", name: "Mission Accomplished" }];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, true);
  });

  it("accepts an entry with no designs field (villain + unmarked-hero rows omit it)", () => {
    // validIndex()'s entries carry no designs at all; the base index must still validate.
    assert.equal(EffectImplementationIndexSchema.safeParse(validIndex()).success, true);
  });

  it("rejects an empty designs list (present ⇒ non-empty; the transform omits instead)", () => {
    const index = validIndex();
    index.entries[0].designs = [];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a designs element missing its slug", () => {
    const index = validIndex();
    index.entries[0].designs = [{ name: "Mission Accomplished" }];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a designs element missing its name", () => {
    const index = validIndex();
    index.entries[0].designs = [{ slug: "mission-accomplished" }];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });

  it("rejects a designs element with an unknown extra key (the object is strict)", () => {
    const index = validIndex();
    index.entries[0].designs = [{ slug: "mission-accomplished", name: "Mission Accomplished", extra: 1 }];
    assert.equal(EffectImplementationIndexSchema.safeParse(index).success, false);
  });
});
