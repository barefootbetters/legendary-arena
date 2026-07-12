/**
 * Tests for the pure `?lagn=` decoder (WP-362 / EC-392).
 *
 * Pure — `parseLagnUrlParam` takes the query string directly, so no `window`
 * stub is needed. Covers absent / valid / present-but-empty / over-length /
 * corrupt inputs, a UTF-8 round-trip, and the never-throws contract.
 *
 * Authority: WP-362 §Scope (In) §D; EC-392; D-24154.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { parseLagnUrlParam } from "./lagnUrlParam.js";

/** Encode UTF-8 text to a base64url `?lagn=` value (Node Buffer supports it). */
function encodeLagn(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

describe("parseLagnUrlParam", () => {
  test("returns { present: false } when the lagn key is absent", () => {
    assert.deepEqual(parseLagnUrlParam("?schemeId=core/x"), { present: false });
    assert.deepEqual(parseLagnUrlParam(""), { present: false });
  });

  test("decodes a valid base64url payload to its original JSON text", () => {
    const json = '{"lagn_version":"1.0.0","player_count":2}';
    const result = parseLagnUrlParam(`?lagn=${encodeLagn(json)}`);
    assert.deepEqual(result, { present: true, ok: true, text: json });
  });

  test("round-trips a multi-byte UTF-8 card name", () => {
    const json = '{"name":"Pokémon 日本 — Kräven"}';
    const result = parseLagnUrlParam(`?lagn=${encodeLagn(json)}`);
    assert.equal(result.present, true);
    assert.equal(result.ok, true);
    assert.equal(result.ok === true ? result.text : "", json);
    // decoded text re-parses to the same object
    assert.deepEqual(
      JSON.parse(result.ok === true ? result.text : "{}"),
      JSON.parse(json),
    );
  });

  test("returns a decode error (full sentence) for a present-but-empty value", () => {
    const result = parseLagnUrlParam("?lagn=");
    assert.equal(result.present, true);
    assert.equal(result.ok, false);
    assert.match(
      result.ok === false ? result.error : "",
      /could not be read.*fresh link/i,
    );
  });

  test("returns a decode error for an over-length value without decoding it", () => {
    const huge = "A".repeat(9000);
    const result = parseLagnUrlParam(`?lagn=${huge}`);
    assert.equal(result.present, true);
    assert.equal(result.ok, false);
  });

  test("returns a decode error for a corrupt / non-base64url value", () => {
    for (const bad of ["!!!", "%%%not-base64%%%", "a"]) {
      const result = parseLagnUrlParam(`?lagn=${encodeURIComponent(bad)}`);
      assert.equal(result.present, true, `"${bad}" should be present`);
      assert.equal(result.ok, false, `"${bad}" should be a decode error`);
    }
  });

  test("returns a decode error for valid base64url of invalid UTF-8", () => {
    // 0xFF 0xFE is not valid UTF-8; base64url-encode the raw bytes
    const invalidUtf8 = Buffer.from([0xff, 0xfe]).toString("base64url");
    const result = parseLagnUrlParam(`?lagn=${invalidUtf8}`);
    assert.equal(result.present, true);
    assert.equal(result.ok, false);
  });

  test("never throws on any input", () => {
    for (const search of ["", "?lagn=", "?lagn=!!!", "?lagn=" + "A".repeat(9000), "?x=y"]) {
      assert.doesNotThrow(() => parseLagnUrlParam(search));
    }
  });
});
