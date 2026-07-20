/**
 * canonicalJson.test.ts — RFC 8785 conformance (WP-393 / D-24197).
 *
 * Choosing JCS over sorted-key JSON.stringify only pays off if we implemented
 * the spec rather than something spec-shaped, so the vectors below come from
 * the RFC 8785 §3.2.3 worked example: its number column verbatim, and its
 * string column built from explicit code points.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeJson,
  hashCanonicalJson,
  deriveRegistryVersion,
} from "./canonicalJson.js";

/**
 * The string column of the RFC 8785 §3.2.3 example.
 *
 * why: assembled from String.fromCharCode rather than written as a literal.
 * The value contains U+000F and a newline, and embedding raw control
 * characters in a source file is both unreadable and fragile — an editor or
 * a copy-paste silently rewrites them and the vector stops being the RFC's.
 * Code points: EURO SIGN, dollar, U+000F, LINE FEED, A, apostrophe, B,
 * quotation mark, reverse solidus, reverse solidus, quotation mark, solidus.
 */
const RFC_EXAMPLE_STRING = String.fromCharCode(
  0x20ac, 0x24, 0x0f, 0x0a, 0x41, 0x27, 0x42, 0x22, 0x5c, 0x5c, 0x22, 0x2f
);

describe("canonicalizeJson — RFC 8785 conformance", () => {
  test("the RFC 8785 number column, verbatim", () => {
    // why: each value exercises a distinct normalization rule — precision
    // truncation, exponent form, trailing-zero removal, small-value expansion,
    // and small-value exponent form.
    assert.equal(
      canonicalizeJson([333333333.33333329, 1e30, 4.5, 2e-3, 1e-27]),
      "[333333333.3333333,1e+30,4.5,0.002,1e-27]"
    );
  });

  test("the RFC 8785 string column escapes per JSON, non-ASCII stays literal", () => {
    const canonical = canonicalizeJson(RFC_EXAMPLE_STRING);

    assert.equal(canonical.charCodeAt(0), 0x22, "must open with a quote");
    assert.ok(canonical.includes("\\u000f"), "U+000F must escape as \\u000f");
    assert.ok(canonical.includes("\\n"), "newline must use the short escape");
    assert.ok(
      canonical.includes(String.fromCharCode(0x20ac)),
      "non-ASCII must stay literal, not \\u-escaped"
    );
    // why: no raw control character may survive into the canonical form —
    // that is the difference between a hashable byte string and one that
    // varies with how a tool happens to write it.
    for (const character of canonical) {
      assert.ok(
        character.charCodeAt(0) > 0x1f,
        `raw control character U+${character.charCodeAt(0).toString(16)} leaked through`
      );
    }
  });

  test("members are ordered by UTF-16 code units, not insertion order", () => {
    assert.equal(canonicalizeJson({ b: 1, a: 2, C: 3 }), '{"C":3,"a":2,"b":1}');
  });

  test("key order does not change the output", () => {
    assert.equal(
      canonicalizeJson({ alpha: 1, beta: 2 }),
      canonicalizeJson({ beta: 2, alpha: 1 })
    );
  });

  test("array order IS significant", () => {
    assert.notEqual(canonicalizeJson([1, 2]), canonicalizeJson([2, 1]));
  });

  test("no insignificant whitespace survives", () => {
    const canonical = canonicalizeJson({ a: [1, 2], b: { c: 3 } });
    assert.equal(canonical, '{"a":[1,2],"b":{"c":3}}');
    assert.ok(!/\s/.test(canonical), "canonical form contains whitespace");
  });

  test("negative zero serializes as 0", () => {
    assert.equal(canonicalizeJson(-0), "0");
  });

  test("undefined members are omitted, not serialized", () => {
    assert.equal(canonicalizeJson({ a: 1, b: undefined }), '{"a":1}');
  });

  test("nested objects sort at every level", () => {
    assert.equal(
      canonicalizeJson({ outer: { z: 1, a: 2 } }),
      '{"outer":{"a":2,"z":1}}'
    );
  });

  test("non-finite numbers fail loudly rather than hashing silently", () => {
    assert.throws(() => canonicalizeJson(Number.NaN), /non-finite/);
    assert.throws(() => canonicalizeJson(Number.POSITIVE_INFINITY), /non-finite/);
  });
});

describe("hashCanonicalJson", () => {
  test("carries the sha256: prefix and a 64-character lowercase digest", () => {
    assert.match(hashCanonicalJson({ a: 1 }), /^sha256:[0-9a-f]{64}$/);
  });

  test("key order does not change the hash", () => {
    assert.equal(hashCanonicalJson({ a: 1, b: 2 }), hashCanonicalJson({ b: 2, a: 1 }));
  });

  test("a changed value changes the hash", () => {
    assert.notEqual(hashCanonicalJson({ a: 1 }), hashCanonicalJson({ a: 2 }));
  });
});

describe("deriveRegistryVersion", () => {
  test("is independent of the insertion order of the hash map", () => {
    assert.equal(
      deriveRegistryVersion({ core: "sha256:aa", xmen: "sha256:bb" }),
      deriveRegistryVersion({ xmen: "sha256:bb", core: "sha256:aa" })
    );
  });

  test("differs when the load SCOPE differs", () => {
    assert.notEqual(
      deriveRegistryVersion({ core: "sha256:aa", xmen: "sha256:bb" }),
      deriveRegistryVersion({ core: "sha256:aa" })
    );
  });

  test("differs when a set's content hash changes", () => {
    assert.notEqual(
      deriveRegistryVersion({ core: "sha256:aa" }),
      deriveRegistryVersion({ core: "sha256:cc" })
    );
  });

  test("an empty load scope yields undefined, never a digest over nothing", () => {
    assert.equal(deriveRegistryVersion({}), undefined);
  });
});
