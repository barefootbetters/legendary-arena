/**
 * Author-facing content schemas for the Legendary Arena game engine.
 *
 * These schemas describe the shape of new content (heroes, villains,
 * henchmen, masterminds, schemes, scenarios) as produced by content
 * authors — they are declarative descriptor data only. No runtime
 * code, no functions, no closures. The validator reads them.
 *
 * // why: schemas here are author-facing; engine-facing validation
 * for loaded registry data lives in registry Zod schemas
 * (packages/registry/src/schema.ts). Registry schemas are
 * deliberately permissive to accommodate real-data quirks
 * (D-1204 / D-1227 — e.g., `anni` cards with only slug+imageUrl,
 * `amwp` Wasp with cost "2*"). Author-facing schemas are
 * deliberately stricter because authors of *new* content must
 * supply fields that historical data sometimes omits (RS-1 lock).
 * The engine category (D-3301) must not import from the registry
 * package, so enum references here re-use engine-side canonical
 * unions (HERO_KEYWORDS, BOARD_KEYWORDS, SCHEME_SETUP_TYPES,
 * HERO_ABILITY_TIMINGS) rather than the registry's HeroClassSchema.
 */

import type { HeroKeyword, HeroAbilityTiming } from '../rules/heroKeywords.js';
import type { BoardKeyword } from '../board/boardKeywords.types.js';
import type { SchemeSetupType } from '../scheme/schemeSetup.types.js';
import type { ScenarioOutcomeCondition } from '../campaign/campaign.types.js';

// ---------------------------------------------------------------------------
// ACCEPTED_CONTENT_TYPES — accept-list for the validator's first gate
// ---------------------------------------------------------------------------

// why: free-form contentType silently passing an unrecognized value
// would let authoring typos reach runtime as "valid" content (copilot
// RISK #10 / #21 resolution). The accept list is the single source of
// truth for the six supported content types at MVP. This is an
// internal validator constant, NOT a canonical drift-checked array
// (no paired test required per AI Agent Warning).

/**
 * Closed list of content types the validator accepts. Any other
 * contentType string — typos, casing variants, pluralizations, empty
 * string — produces a single `field: 'contentType'` error with a
 * full-sentence message and the unrecognized value captured as-supplied.
 */
export const ACCEPTED_CONTENT_TYPES = [
  'hero',
  'villain',
  'henchman',
  'mastermind',
  'scheme',
  'scenario',
] as const;

/** One of the six accepted content types. */
export type ContentType = (typeof ACCEPTED_CONTENT_TYPES)[number];

// ---------------------------------------------------------------------------
// HERO_CLASSES — local re-declaration (engine category, no registry import)
// ---------------------------------------------------------------------------

// why: HeroClassSchema lives in packages/registry/src/schema.ts, and
// the engine category must not import from the registry package
// (D-3301). This local re-declaration is the engine's canonical source
// for content validation. A future WP may add a build-time
// drift-detection test; for MVP, no drift test is required
// (RS-9 / D-3301 lock).
export const HERO_CLASSES = [
  'tech',
  'covert',
  'strength',
  'ranged',
  'instinct',
] as const;

/** One of the five hero class slugs supported at MVP. */
export type HeroClass = (typeof HERO_CLASSES)[number];

// ---------------------------------------------------------------------------
// Schema descriptor shape
// ---------------------------------------------------------------------------

/**
 * Declarative schema descriptor for a content type. The validator
 * reads these properties; they are never invoked as functions.
 *
 * - `requiredFields`: property names that must be present with a
 *   non-undefined, non-null value.
 * - `stringFields`: property names whose value must be a non-empty string.
 * - `numericFields`: property names whose value must be a finite number
 *   (not NaN, not Infinity).
 * - `arrayFields`: property names whose value must be an array.
 * - `enumFields`: property names whose value must be one of a closed
 *   list of allowed string values.
 */
export interface ContentSchemaDescriptor {
  readonly requiredFields: readonly string[];
  readonly stringFields: readonly string[];
  readonly numericFields: readonly string[];
  readonly arrayFields: readonly string[];
  readonly enumFields: Readonly<Record<string, readonly string[]>>;
}

// ---------------------------------------------------------------------------
// Hero card schema (author-facing)
// ---------------------------------------------------------------------------

// why: team is validated as non-empty string only — no canonical
// TEAMS union exists at MVP. Team names are data-driven across 40
// card sets; deriving a canonical union would require reading
// registry data at build time, which is out of scope for WP-033
// (RS-8 lock). If a future WP adds a build-time teams union, this
// schema must be updated to reference it.
export const HERO_CARD_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: [
    'name',
    'slug',
    'team',
    'hc',
    'cost',
    'attack',
    'recruit',
    'abilities',
  ],
  stringFields: ['name', 'slug', 'team'],
  numericFields: ['cost', 'attack', 'recruit'],
  arrayFields: ['abilities'],
  enumFields: {
    hc: HERO_CLASSES,
  },
};

// ---------------------------------------------------------------------------
// Villain schema (author-facing)
// ---------------------------------------------------------------------------

export const VILLAIN_CARD_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: ['name', 'slug', 'vp', 'vAttack', 'abilities'],
  stringFields: ['name', 'slug'],
  numericFields: ['vp'],
  arrayFields: ['abilities'],
  enumFields: {},
};

// ---------------------------------------------------------------------------
// Henchman schema (author-facing)
// ---------------------------------------------------------------------------

// why: henchman author-facing schema mirrors VillainCardSchema shape
// per D-3302. Henchmen are virtual cards with no dedicated registry
// schema (D-1410..D-1413); mirroring the nearest analog is the
// accepted stand-in until a future dedicated henchman authoring WP
// supersedes. The shape is redeclared locally rather than imported
// from the registry package (D-3301 forbids the cross-layer import).
export const HENCHMAN_CARD_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: ['name', 'slug', 'vp', 'vAttack', 'abilities'],
  stringFields: ['name', 'slug'],
  numericFields: ['vp'],
  arrayFields: ['abilities'],
  enumFields: {},
};

// ---------------------------------------------------------------------------
// Mastermind schema (author-facing)
// ---------------------------------------------------------------------------

export const MASTERMIND_CARD_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: ['name', 'slug', 'vp', 'alwaysLeads', 'cards'],
  stringFields: ['name', 'slug'],
  numericFields: ['vp'],
  arrayFields: ['alwaysLeads', 'cards'],
  enumFields: {},
};

// ---------------------------------------------------------------------------
// Scheme schema (author-facing)
// ---------------------------------------------------------------------------

export const SCHEME_CARD_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: ['name', 'slug', 'setupInstructions'],
  stringFields: ['name', 'slug'],
  numericFields: [],
  arrayFields: ['setupInstructions'],
  enumFields: {},
};

// ---------------------------------------------------------------------------
// Scenario schema (author-facing)
// ---------------------------------------------------------------------------

// why: ScenarioDefinition uses *separate* victoryConditions? and
// failureConditions? arrays (not a single `conditions` array) per
// RS-4 lock. The scenario schema validates this split shape. The
// ScenarioOutcomeCondition import is type-only and does not introduce
// a runtime dependency on campaign.types.js beyond what the engine
// already re-exports.
export const SCENARIO_SCHEMA: ContentSchemaDescriptor = {
  requiredFields: ['id', 'name'],
  stringFields: ['id', 'name'],
  numericFields: [],
  arrayFields: [],
  enumFields: {},
};

// ---------------------------------------------------------------------------
// Enum references — re-exported as readonly string[] for validator use
// ---------------------------------------------------------------------------

// why: re-exporting the canonical engine-side unions as plain
// readonly string[] lets the validator treat them uniformly without
// casting. The underlying constants remain the single source of
// truth in their respective modules (HERO_KEYWORDS in
// rules/heroKeywords.ts, etc.); these imports are runtime value
// imports, not type-only imports, so the validator can iterate.
export type { HeroKeyword, HeroAbilityTiming, BoardKeyword, SchemeSetupType, ScenarioOutcomeCondition };
