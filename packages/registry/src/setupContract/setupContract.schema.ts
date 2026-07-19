/**
 * setupContract.schema.ts — Strict zod schemas mirroring
 * docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json for the browser-safe
 * registry-side validator (WP-091).
 *
 * Every object is `.strict()` so unknown fields are rejected at parse time,
 * mirroring the JSON Schema's `additionalProperties: false` contract.
 */

import { z } from "zod";
import {
  SUPPORT_COUNT_MINIMUMS,
  SUPPORT_POOL_COUNT_FIELD,
  SUPPORT_POOL_KINDS,
} from "./setupContract.types.js";

// why: setupId and themeId are local document identifiers — bare lowercase
// slugs, no set qualifier.
const EXT_ID_PATTERN = /^[a-z0-9-]+$/;

// why: D-24018 — composition ext_ids are the set-qualified "{setAbbr}/{slug}"
// form the engine's match-setup validator requires (D-10014). Exactly one
// slash separates a bare set abbreviation from a bare slug; both segments use
// the same lowercase/digit/hyphen grammar as EXT_ID_PATTERN. This mirrors the
// engine's parseQualifiedId grammar so a document accepted here is accepted at
// match creation rather than throwing an HTTP 500. Bare slugs and flat-card
// keys (no slash, or multiple slashes) are rejected.
const QUALIFIED_EXT_ID_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;

const extIdString = z
  .string()
  .regex(
    QUALIFIED_EXT_ID_PATTERN,
    'Every composition ext_id must match the set-qualified pattern ^[a-z0-9-]+/[a-z0-9-]+$ (for example "core/black-widow") — a set abbreviation, a slash, then a slug. Bare slugs and flat-card keys are rejected.',
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

// why: WP-036 / D-24194 — support pools. Card ext_ids here use the same
// set-qualified grammar as the composition (D-10014), because they name real
// registry cards; `sets` entries are bare set abbreviations and so use the
// unqualified pattern.
const SupportPoolCardSchema = z
  .object({
    extId: extIdString,
    copies: z
      .number()
      .int("Every support pool card's copies value must be a positive integer.")
      .positive(
        "Every support pool card's copies value must be a positive integer — omit the card instead of listing zero copies.",
      ),
  })
  .strict();

export const SupportPoolSchema = z
  .object({
    mode: z.enum(["sets", "explicit"] as const),
    sets: z
      .array(
        z
          .string()
          .regex(
            EXT_ID_PATTERN,
            "Every support pool set abbreviation must match the pattern ^[a-z0-9-]+$.",
          ),
      )
      .min(1, "The sets array must contain at least one set abbreviation.")
      .optional(),
    cards: z
      .array(SupportPoolCardSchema)
      .min(1, "A support pool must list at least one card — omit the pool entirely to leave it unspecified."),
  })
  .strict()
  // why: `sets` records which sets the author drew from, so it is meaningless
  // in explicit mode and mandatory in sets mode. Enforcing both directions
  // keeps a round-tripped pool from claiming an origin it does not have.
  .superRefine((pool, ctx) => {
    if (pool.mode === "sets" && pool.sets === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sets"],
        message:
          'A support pool in "sets" mode must list the set abbreviations it was drawn from.',
      });
    }
    if (pool.mode === "explicit" && pool.sets !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sets"],
        message:
          'A support pool in "explicit" mode must not carry a sets array — the cards array is the whole definition.',
      });
    }
    const seen = new Set<string>();
    for (const card of pool.cards) {
      if (seen.has(card.extId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cards"],
          message: `The support pool lists ${card.extId} more than once — combine the duplicates into a single entry with the summed copies value.`,
        });
        break;
      }
      seen.add(card.extId);
    }
  });

export const SupportPoolsSchema = z
  .object({
    bystanders: SupportPoolSchema.optional(),
    wounds: SupportPoolSchema.optional(),
    officers: SupportPoolSchema.optional(),
    sidekicks: SupportPoolSchema.optional(),
  })
  .strict();

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
    supportPools: SupportPoolsSchema.optional(),
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
      .nonnegative("The bystandersCount must be a non-negative integer.")
      .min(
        SUPPORT_COUNT_MINIMUMS.bystandersCount,
        `The bystandersCount must be at least ${SUPPORT_COUNT_MINIMUMS.bystandersCount} so the supply pile does not run dry during play.`,
      ),
    woundsCount: z
      .number()
      .int("The woundsCount must be a non-negative integer.")
      .nonnegative("The woundsCount must be a non-negative integer.")
      .min(
        SUPPORT_COUNT_MINIMUMS.woundsCount,
        `The woundsCount must be at least ${SUPPORT_COUNT_MINIMUMS.woundsCount} so the supply pile does not run dry during play.`,
      ),
    officersCount: z
      .number()
      .int("The officersCount must be a non-negative integer.")
      .nonnegative("The officersCount must be a non-negative integer.")
      .min(
        SUPPORT_COUNT_MINIMUMS.officersCount,
        `The officersCount must be at least ${SUPPORT_COUNT_MINIMUMS.officersCount} so the supply pile does not run dry during play.`,
      ),
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
})
  .strict()
  // why: WP-036 / D-24194 — the pool lives on the envelope and the pile size on
  // the composition, so agreement between them is a cross-block invariant no
  // single object schema can express. Checking it here is what stops a preset
  // from silently describing a different pile than the one the engine builds.
  // Pools are optional; an absent pool constrains nothing.
  .superRefine((document, ctx) => {
    const pools = document.supportPools;
    if (pools === undefined) {
      return;
    }
    for (const kind of SUPPORT_POOL_KINDS) {
      const pool = pools[kind];
      if (pool === undefined) {
        continue;
      }
      const countField = SUPPORT_POOL_COUNT_FIELD[kind];
      const declared = document.composition[countField];
      const total = pool.cards.reduce((sum, card) => sum + card.copies, 0);
      if (total !== declared) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["supportPools", kind, "cards"],
          message: `The ${kind} pool lists ${total} ${total === 1 ? "copy" : "copies"} but composition.${countField} declares ${declared} — the pool's copies must sum to the declared count.`,
        });
      }
    }
  });
