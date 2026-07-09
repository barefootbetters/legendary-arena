import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseHashRoute } from "./hashRoute.ts";

/**
 * Route-parser table tests (WP-343 AC-1). The reactive ref half of the
 * router needs a window and is covered by the dev-server smoke; the
 * parser is the pure surface that decides every navigation outcome.
 */

describe("parseHashRoute", () => {
  it("empty hash resolves to the attract view", () => {
    assert.deepEqual(parseHashRoute(""), { view: "attract" });
  });

  it("'#/' resolves to the attract view", () => {
    assert.deepEqual(parseHashRoute("#/"), { view: "attract" });
  });

  it("bare '#' resolves to the attract view", () => {
    assert.deepEqual(parseHashRoute("#"), { view: "attract" });
  });

  it("a well-formed gauntlet hash resolves to the gauntlet view", () => {
    assert.deepEqual(parseHashRoute("#/gauntlet/gauntlet-core-dr-doom"), {
      view: "gauntlet",
      boardName: "gauntlet-core-dr-doom",
    });
  });

  it("a gauntlet hash missing the board name falls back to attract", () => {
    assert.deepEqual(parseHashRoute("#/gauntlet/"), { view: "attract" });
  });

  it("an unknown path falls back to attract", () => {
    assert.deepEqual(parseHashRoute("#/x"), { view: "attract" });
  });

  it("a board name outside the publisher grammar falls back to attract", () => {
    assert.deepEqual(parseHashRoute("#/gauntlet/UPPER!"), { view: "attract" });
    assert.deepEqual(parseHashRoute("#/gauntlet/not-a-gauntlet"), {
      view: "attract",
    });
    assert.deepEqual(parseHashRoute("#/gauntlet/gauntlet-core/extra"), {
      view: "attract",
    });
  });
});
