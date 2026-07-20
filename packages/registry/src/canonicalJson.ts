/**
 * canonicalJson.ts — RFC 8785 (JSON Canonicalization Scheme) serialization and
 * the content-hash helpers built on it.
 *
 * WP-393 / D-24197. Consumed by both registry loaders so an identical set of
 * cards produces an identical hash regardless of how it was loaded.
 */

import { createHash } from "node:crypto";

/**
 * Serializes a value to its RFC 8785 canonical JSON form.
 *
 * why: RFC 8785 rather than `JSON.stringify` with sorted keys. Sorted-key
 * stringify leaves number formatting, Unicode escaping, and string
 * normalization unspecified, so two conforming implementations can disagree
 * byte-for-byte on the same input. A provenance hash that two tools compute
 * differently is worse than no hash at all — it fails closed on valid data,
 * and the disagreement surfaces as a phantom drift nobody can reproduce.
 * JCS pins every one of those choices, so an independent implementation of
 * the same spec agrees by construction.
 *
 * @param value - Any JSON-representable value.
 * @returns The canonical JSON string, with no insignificant whitespace.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Cannot canonicalize the non-finite number ${String(value)}. ` +
          `RFC 8785 permits only finite numbers; check the source data for ` +
          `NaN or Infinity before hashing it.`
      );
    }
    // why: ECMAScript Number-to-String is exactly the numeric form RFC 8785
    // mandates, and JSON.stringify applies it. It also normalizes -0 to "0",
    // which the RFC requires.
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    // why: JSON.stringify already emits the RFC 8785 escaping rules — the
    // short escapes where they exist, \u00xx for the remaining control
    // characters, and literal (unescaped) non-ASCII.
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const serializedElements: string[] = [];
    for (const element of value) {
      serializedElements.push(canonicalizeJson(element));
    }
    return `[${serializedElements.join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // why: RFC 8785 orders members by their UTF-16 code units, which is
    // exactly what Array.prototype.sort() does for strings by default.
    const sortedKeys = Object.keys(record).sort();

    const serializedMembers: string[] = [];
    for (const key of sortedKeys) {
      const memberValue = record[key];
      // why: an undefined member has no JSON representation at all, so it is
      // omitted rather than serialized — matching JSON.stringify, and keeping
      // `{ a: undefined }` and `{}` from hashing differently.
      if (memberValue === undefined) {
        continue;
      }
      serializedMembers.push(
        `${JSON.stringify(key)}:${canonicalizeJson(memberValue)}`
      );
    }
    return `{${serializedMembers.join(",")}}`;
  }

  throw new Error(
    `Cannot canonicalize a value of type "${typeof value}". RFC 8785 covers ` +
      `only null, booleans, numbers, strings, arrays, and plain objects.`
  );
}

/**
 * Hashes a value by canonicalizing it first.
 *
 * @param value - Any JSON-representable value.
 * @returns The digest as `sha256:<lowercase hex>`.
 */
export function hashCanonicalJson(value: unknown): string {
  const canonicalForm = canonicalizeJson(value);
  const digest = createHash("sha256").update(canonicalForm, "utf8").digest("hex");
  return `sha256:${digest}`;
}

/**
 * Derives the registry version from the per-set content hashes.
 *
 * why: sorted by abbreviation so the value does not depend on the order sets
 * happened to finish loading — the HTTP loader populates its map in network
 * completion order, which varies run to run. The result is deliberately
 * dependent on the load *scope* (which sets were loaded), because a consumer
 * needs to know what the producer actually saw, not what existed somewhere.
 *
 * @param setContentHashes - Map of set abbreviation to `sha256:<hex>` digest.
 * @returns The digest as `sha256:<hex>`, or undefined when no sets loaded.
 */
export function deriveRegistryVersion(
  setContentHashes: Record<string, string>
): string | undefined {
  const sortedSetAbbrs = Object.keys(setContentHashes).sort();

  // why: an empty load scope emits nothing rather than a digest over the empty
  // string. That digest looks like a real version, satisfies a `sha256:`
  // prefix check, and would let a downstream audit bundle claim provenance
  // over no data at all. Absent is the honest answer.
  if (sortedSetAbbrs.length === 0) {
    return undefined;
  }

  const lines: string[] = [];
  for (const setAbbr of sortedSetAbbrs) {
    lines.push(`${setAbbr}:${setContentHashes[setAbbr]}`);
  }

  const digest = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
  return `sha256:${digest}`;
}
