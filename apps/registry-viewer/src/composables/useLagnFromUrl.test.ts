/**
 * Tests for the `?lagn=` apply composable (WP-362 / EC-392).
 *
 * Stubs `globalThis.window` (the composable reads `window.location.search` once,
 * mirroring `useSetupFromUrl`) and injects a recording fake `UseLoadoutDraftApi`.
 * Asserts the atomic apply (resetDraft + setters ONLY on a valid LAGN), the
 * error passthrough (invalid LAGN / decode error touch no setter), absence, and
 * the never-throws contract.
 *
 * Authority: WP-362 §Scope (In) §D; EC-392; D-24154.
 */

import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { useLagnFromUrl } from "./useLagnFromUrl.js";
import type { UseLoadoutDraftApi } from "./useLoadoutDraft.js";

// why: the composable reads `window.location.search` once at call time; stub
// globalThis.window per test (matches useSetupFromUrl.test.ts) and restore after.
const originalWindow = (globalThis as { window?: unknown }).window;

function setSearch(search: string): void {
  (globalThis as { window?: unknown }).window = { location: { search } };
}

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

/** Encode UTF-8 text to a base64url `?lagn=` value. */
function encodeLagn(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

/** A valid Tier-1 LAGN document (accepted by parseLagnLoadout / the validator). */
const VALID_LAGN = {
  lagn_version: "1.0.0",
  game_id: "match-1",
  variant: "cooperative",
  player_count: 2,
  setup: {
    mastermind: { id: "core/loki-god-of-mischief", name: "Loki" },
    scheme: { id: "core/the-legacy-virus", name: "Legacy Virus" },
    villain_groups: [{ id: "core/hydra", name: "Hydra" }],
    henchmen_groups: [{ id: "core/doombot-legion", name: "Doombots" }],
    heroes: [{ id: "core/spider-man", name: "Spider-Man" }],
    bystanders_count: 12,
    wounds_count: 30,
    shield_officers_count: 20,
    sidekicks_count: 0,
  },
};

type Call = [method: string, ...args: unknown[]];

/** A recording fake draft API — captures the ordered setter calls. */
function makeRecordingDraft(): { api: UseLoadoutDraftApi; calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): void => {
      calls.push([method, ...args]);
    };
  const api = {
    resetDraft: record("resetDraft"),
    setScheme: record("setScheme"),
    setMastermind: record("setMastermind"),
    addVillainGroup: record("addVillainGroup"),
    addHenchmanGroup: record("addHenchmanGroup"),
    addHeroGroup: record("addHeroGroup"),
    setCount: record("setCount"),
    setPlayerCount: record("setPlayerCount"),
  } as unknown as UseLoadoutDraftApi;
  return { api, calls };
}

describe("useLagnFromUrl", () => {
  test("absent ?lagn= → hasLagnParam:false and no setter calls", () => {
    setSearch("?schemeId=core/x");
    const { api, calls } = makeRecordingDraft();
    const result = useLagnFromUrl(api);
    assert.deepEqual(result, { hasLagnParam: false, lagnUrlErrors: [] });
    assert.equal(calls.length, 0);
  });

  test("valid ?lagn= → resetDraft then the WP-291 setters, no errors", () => {
    setSearch(`?lagn=${encodeLagn(JSON.stringify(VALID_LAGN))}`);
    const { api, calls } = makeRecordingDraft();
    const result = useLagnFromUrl(api);

    assert.deepEqual(result, { hasLagnParam: true, lagnUrlErrors: [] });
    // resetDraft is first (atomic apply)
    assert.deepEqual(calls[0], ["resetDraft"]);
    // composition applied through the public setters
    assert.deepEqual(
      calls.find((call) => call[0] === "setScheme"),
      ["setScheme", "core/the-legacy-virus"],
    );
    assert.deepEqual(
      calls.find((call) => call[0] === "setMastermind"),
      ["setMastermind", "core/loki-god-of-mischief"],
    );
    assert.deepEqual(
      calls.find((call) => call[0] === "addVillainGroup"),
      ["addVillainGroup", "core/hydra"],
    );
    assert.deepEqual(
      calls.find((call) => call[0] === "addHenchmanGroup"),
      ["addHenchmanGroup", "core/doombot-legion"],
    );
    assert.deepEqual(
      calls.find((call) => call[0] === "addHeroGroup"),
      ["addHeroGroup", "core/spider-man"],
    );
    // the officersCount rename survives (shield_officers_count → officersCount 20)
    assert.deepEqual(
      calls.find((call) => call[0] === "setCount" && call[1] === "officersCount"),
      ["setCount", "officersCount", 20],
    );
    assert.deepEqual(
      calls.find((call) => call[0] === "setPlayerCount"),
      ["setPlayerCount", 2],
    );
  });

  test("invalid LAGN (valid base64, wrong shape) → errors, no setter or resetDraft call", () => {
    setSearch(`?lagn=${encodeLagn('{"foo":1}')}`);
    const { api, calls } = makeRecordingDraft();
    const result = useLagnFromUrl(api);

    assert.equal(result.hasLagnParam, true);
    assert.ok(result.lagnUrlErrors.length > 0);
    assert.equal(calls.length, 0); // atomic — the draft is untouched
  });

  test("decode error (?lagn=!!!) → error, no setter call", () => {
    setSearch("?lagn=!!!");
    const { api, calls } = makeRecordingDraft();
    const result = useLagnFromUrl(api);

    assert.equal(result.hasLagnParam, true);
    assert.ok(result.lagnUrlErrors.length > 0);
    assert.equal(calls.length, 0);
  });

  test("never throws", () => {
    for (const search of ["", "?lagn=", "?lagn=!!!", `?lagn=${encodeLagn("{}")}`]) {
      setSearch(search);
      const { api } = makeRecordingDraft();
      assert.doesNotThrow(() => useLagnFromUrl(api));
    }
  });
});
