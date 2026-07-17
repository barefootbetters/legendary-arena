/**
 * setupUrlParams.test.ts — node:test coverage for the URL parser/serializer
 * (WP-114).
 *
 * Covers the EC-116 §Files to Produce contract points: type-correct
 * round-trip, canonical-order assertion (literal substring), empty input,
 * single-key parse, comma-separated list parse, forward-slash round-trip,
 * unknown-key drop, empty-array semantics, empty-singular semantics.
 *
 * Runner: node:test (native Node.js)
 * Invoke: pnpm --filter registry-viewer test
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { SetupCompositionInput } from "@legendary-arena/registry/setupContract";

import {
  parsePlayerCountFromUrl,
  parseSetupUrl,
  serializeSetupToUrl,
} from "./setupUrlParams.js";

describe("setupUrlParams (WP-114)", () => {
  it("type-correct round-trip: parse-after-serialize yields the five URL-bound keys", () => {
    const composition: SetupCompositionInput = {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/loki-god-of-mischief",
      villainGroupIds: ["core/hydra", "smwp/enemy-of-my-enemy"],
      henchmanGroupIds: ["core/sentinel"],
      heroDeckIds: ["core/spider-man", "core/wolverine"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const baseUrl = "https://cards.legendary-arena.com/";

    const serialized = serializeSetupToUrl(composition, baseUrl);
    const queryString = new URL(serialized).search;
    const parsed = parseSetupUrl(queryString);

    assert.deepEqual(parsed, {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/loki-god-of-mischief",
      villainGroupIds: ["core/hydra", "smwp/enemy-of-my-enemy"],
      henchmanGroupIds: ["core/sentinel"],
      heroDeckIds: ["core/spider-man", "core/wolverine"],
    });
  });

  it("canonical key emit order: schemeId, mastermindId, villainGroupIds, henchmanGroupIds, heroDeckIds", () => {
    const composition: SetupCompositionInput = {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/loki-god-of-mischief",
      villainGroupIds: ["core/hydra"],
      henchmanGroupIds: ["core/sentinel"],
      heroDeckIds: ["core/spider-man"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const serialized = serializeSetupToUrl(composition, "https://cards.legendary-arena.com/");
    const queryString = serialized.split("?", 2)[1] ?? "";

    const schemePos = queryString.indexOf("schemeId=");
    const mastermindPos = queryString.indexOf("mastermindId=");
    const villainPos = queryString.indexOf("villainGroupIds=");
    const henchmanPos = queryString.indexOf("henchmanGroupIds=");
    const heroPos = queryString.indexOf("heroDeckIds=");

    assert.ok(schemePos >= 0, "Expected schemeId substring in query string.");
    assert.ok(schemePos < mastermindPos, "Expected schemeId before mastermindId.");
    assert.ok(mastermindPos < villainPos, "Expected mastermindId before villainGroupIds.");
    assert.ok(villainPos < henchmanPos, "Expected villainGroupIds before henchmanGroupIds.");
    assert.ok(henchmanPos < heroPos, "Expected henchmanGroupIds before heroDeckIds.");
  });

  it("empty input returns an empty object", () => {
    assert.deepEqual(parseSetupUrl(""), {});
  });

  it("single-key parse: just schemeId is returned", () => {
    assert.deepEqual(parseSetupUrl("?schemeId=core/foo"), { schemeId: "core/foo" });
  });

  it("comma-separated list parse: villainGroupIds splits on ','", () => {
    assert.deepEqual(
      parseSetupUrl("?villainGroupIds=core/hydra,smwp/enemy-of-my-enemy"),
      { villainGroupIds: ["core/hydra", "smwp/enemy-of-my-enemy"] },
    );
  });

  it("forward slashes in <setAbbr>/<slug> round-trip cleanly", () => {
    const composition: SetupCompositionInput = {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/loki-god-of-mischief",
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const serialized = serializeSetupToUrl(composition, "https://cards.legendary-arena.com/");
    const parsed = parseSetupUrl(new URL(serialized).search);
    assert.equal(parsed.schemeId, "core/midtown-bank-robbery");
    assert.equal(parsed.mastermindId, "core/loki-god-of-mischief");
  });

  it("unknown query keys are silently dropped", () => {
    const parsed = parseSetupUrl("?foo=bar&schemeId=core/foo&baz=qux");
    assert.deepEqual(parsed, { schemeId: "core/foo" });
  });

  it("empty-array semantics: ?villainGroupIds= produces []", () => {
    const parsed = parseSetupUrl("?villainGroupIds=");
    assert.deepEqual(parsed, { villainGroupIds: [] });
  });

  it("empty-singular semantics: ?schemeId= preserves the empty string", () => {
    const parsed = parseSetupUrl("?schemeId=");
    assert.deepEqual(parsed, { schemeId: "" });
  });

  // WP-387: playerCount is an envelope field the composition parser ignores.
  it("parseSetupUrl ignores playerCount (envelope, not composition)", () => {
    assert.deepEqual(parseSetupUrl("?schemeId=core/foo&playerCount=4"), {
      schemeId: "core/foo",
    });
  });
});

describe("parsePlayerCountFromUrl (WP-387)", () => {
  it("returns the integer for each supported count 1..5", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      assert.equal(parsePlayerCountFromUrl(`?playerCount=${count}`), count);
    }
  });

  it("returns null when the param is absent", () => {
    assert.equal(parsePlayerCountFromUrl(""), null);
    assert.equal(parsePlayerCountFromUrl("?schemeId=core/foo"), null);
  });

  it("returns null for an empty value (?playerCount=)", () => {
    assert.equal(parsePlayerCountFromUrl("?playerCount="), null);
  });

  it("returns null for out-of-range values (0 and 6)", () => {
    assert.equal(parsePlayerCountFromUrl("?playerCount=0"), null);
    assert.equal(parsePlayerCountFromUrl("?playerCount=6"), null);
  });

  it("returns null for non-integer / malformed values", () => {
    assert.equal(parsePlayerCountFromUrl("?playerCount=abc"), null);
    assert.equal(parsePlayerCountFromUrl("?playerCount=3.5"), null);
    assert.equal(parsePlayerCountFromUrl("?playerCount=4x"), null);
    assert.equal(parsePlayerCountFromUrl("?playerCount=-1"), null);
  });

  it("reads playerCount alongside the composition keys", () => {
    assert.equal(
      parsePlayerCountFromUrl(
        "?schemeId=core/foo&mastermindId=core/bar&playerCount=4",
      ),
      4,
    );
  });
});
