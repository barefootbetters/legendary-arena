import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseAbilityText, isEngineOnlyKeyword } from "./useRules";

// D-24496 — the ability tokenizer must drop engine-only appended keyword markers
// so the cards site never renders a raw "smash:2" / "draw:1" chip. Mirrors the
// arena-client abilityMarkers suppression (the two tokenizers are kept in sync).
describe("parseAbilityText — engine-only keyword suppression (D-24496)", () => {
  test("drops an appended [keyword:smash:N] engine token, keeps the display keyword", () => {
    const tokens = parseAbilityText("[keyword:Smash 2] [keyword:smash:2]");
    assert.deepEqual(
      tokens.map((token) => ({ type: token.type, value: token.value })),
      [{ type: "keyword", value: "Smash 2" }],
    );
  });

  test("drops an appended [keyword:draw:N] engine token, keeps the sentence", () => {
    const tokens = parseAbilityText("[keyword:Outwit]: Draw a card. [keyword:draw:1]");
    assert.deepEqual(
      tokens.map((token) => ({ type: token.type, value: token.value })),
      [
        { type: "keyword", value: "Outwit" },
        { type: "text", value: ": Draw a card." },
      ],
    );
  });

  test("drops hyphenated-slug engine tokens (recruit-threshold, optional-ko-hand-discard)", () => {
    const tokens = parseAbilityText(
      "you may KO a card from your hand or discard pile. [keyword:recruit-threshold:6] [keyword:optional-ko-hand-discard]",
    );
    assert.deepEqual(
      tokens.map((token) => ({ type: token.type, value: token.value })),
      [{ type: "text", value: "you may KO a card from your hand or discard pile." }],
    );
  });

  test("keeps lowercase display verbs (charges / feasts) — not engine tokens", () => {
    const tokens = parseAbilityText("This Villain [keyword:charges] and [keyword:feasts].");
    assert.deepEqual(
      tokens.map((token) => ({ type: token.type, value: token.value })),
      [
        { type: "text", value: "This Villain " },
        { type: "keyword", value: "charges" },
        { type: "text", value: " and " },
        { type: "keyword", value: "feasts" },
        { type: "text", value: "." },
      ],
    );
  });
});

describe("isEngineOnlyKeyword (D-24496)", () => {
  test("colon / hyphenated-slug / bare-reveal tokens are engine-only", () => {
    for (const value of ["smash:2", "draw:1", "recruit-threshold:6", "copy-powers", "optional-ko-hand-discard", "reveal"]) {
      assert.equal(isEngineOnlyKeyword(value), true, value);
    }
  });

  test("display keywords (Title-Case, and lowercase verbs) are kept", () => {
    for (const value of ["Smash 2", "Outwit", "Worthy", "Wall-Crawl", "charges", "feasts", "demolish"]) {
      assert.equal(isEngineOnlyKeyword(value), false, value);
    }
  });
});
