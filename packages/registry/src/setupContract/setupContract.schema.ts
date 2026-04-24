/**
 * setupContract.schema.ts — Strict zod schemas mirroring
 * docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json for the browser-safe
 * registry-side validator (WP-091).
 *
 * Every object is `.strict()` so unknown fields are rejected at parse time,
 * mirroring the JSON Schema's `additionalProperties: false` contract.
 */

import { z } from "zod";

const EXT_ID_PATTERN = /^[a-z0-9-]+$/;

const extIdString = z
  .string()
  .regex(
    EXT_ID_PATTERN,
    "Every ext_id must match the pattern ^[a-z0-9-]+$ (lowercase letters, digits, and hyphens only).",
  );

// why: Refine for uniqueness so duplicate ext_ids in a composition array
// surface as a single full-sentence error rather than slipping through the
// registry lookup stage silently. MATCH-SETUP-JSON-SCHEMA.json requires
// `uniqueItems: true` on these arrays.
function uniqueExtIdArray(fieldName: string) {
  return z
    .array(extIdString)
    .min(
      1,
      `The ${fieldName} array must contain at least one ext_id entry.`,
    )
    .refine((values) => new Set(values).size === values.length, {
      message: `The ${fieldName} array must not contain duplicate ext_id entries.`,
    });
}

// why: v1 enum has exactly one member per WP-093 D-9301. "HERO_DRAFT" is
// reserved in the DECISIONS entry's prose but NOT present in the zod enum;
// zod-level parsing rejects any other string with its default
// `invalid_enum_value` message, which setupContract.validate.ts then
// upgrades to the WP-093 byte-for-byte template. Adding "HERO_DRAFT" to
// this enum requires amending WP-093 first per the naming-governance
// policy (D-9301 policy item 3).
export const HeroSelectionModeSchema = z
  .enum(["GROUP_STANDARD"] as const)
  .optional();

// why: .strict() mirrors JSON Schema `additionalProperties: false` —
// unknown envelope fields fail fast so the UI surfaces a structural error
// rather than silently ignoring extra keys.
export const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    setupId: z
      .string()
      .regex(
        EXT_ID_PATTERN,
        "The setupId must match the pattern ^[a-z0-9-]+$ (lowercase letters, digits, and hyphens only).",
      ),
    createdAt: z
      .string()
      .datetime({
        message:
          "The createdAt field must be an ISO-8601 UTC timestamp (e.g., 2026-04-24T12:34:56.000Z).",
      }),
    createdBy: z.enum(["player", "system", "simulation"] as const),
    seed: z
      .string()
      .min(1, "The seed must be a non-empty string."),
    playerCount: z
      .number()
      .int("The playerCount must be an integer between 1 and 5 inclusive.")
      .min(1, "The playerCount must be at least 1.")
      .max(5, "The playerCount must be at most 5."),
    themeId: z
      .string()
      .regex(
        EXT_ID_PATTERN,
        "The themeId must match the pattern ^[a-z0-9-]+$ (lowercase letters, digits, and hyphens only).",
      )
      .optional(),
    expansions: z
      .array(
        z
          .string()
          .regex(
            EXT_ID_PATTERN,
            "Every expansion identifier must match the pattern ^[a-z0-9-]+$.",
          ),
      )
      .min(1, "The expansions array must contain at least one entry."),
    heroSelectionMode: HeroSelectionModeSchema,
  })
  .strict();

// why: .strict() mirrors JSON Schema `additionalProperties: false` on the
// composition block — the nine-field composition lock (00.2 §7 Match
// Configuration) is enforced at parse time so any drift drops a
// full-sentence "unknown field" error rather than silently persisting.
export const CompositionSchema = z
  .object({
    schemeId: extIdString,
    mastermindId: extIdString,
    villainGroupIds: uniqueExtIdArray("villainGroupIds"),
    henchmanGroupIds: uniqueExtIdArray("henchmanGroupIds"),
    heroDeckIds: uniqueExtIdArray("heroDeckIds"),
    bystandersCount: z
      .number()
      .int("The bystandersCount must be a non-negative integer.")
      .nonnegative("The bystandersCount must be a non-negative integer."),
    woundsCount: z
      .number()
      .int("The woundsCount must be a non-negative integer.")
      .nonnegative("The woundsCount must be a non-negative integer."),
    officersCount: z
      .number()
      .int("The officersCount must be a non-negative integer.")
      .nonnegative("The officersCount must be a non-negative integer."),
    sidekicksCount: z
      .number()
      .int("The sidekicksCount must be a non-negative integer.")
      .nonnegative("The sidekicksCount must be a non-negative integer."),
  })
  .strict();

// why: .strict() at the document root rejects unknown top-level fields so
// a drifted envelope key (e.g., `heroSelectionNode` typo) fails validation
// instead of being silently preserved alongside the correct fields.
export const MatchSetupDocumentSchema = EnvelopeSchema.extend({
  composition: CompositionSchema,
}).strict();
