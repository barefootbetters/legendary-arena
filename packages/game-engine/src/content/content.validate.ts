/**
 * Content validation for author-facing content (heroes, villains,
 * henchmen, masterminds, schemes, scenarios).
 *
 * Pure functions — never throw, never mutate inputs, no boardgame.io
 * import, no registry import, no use of array reduce. Returns a
 * structured ContentValidationResult; all error messages are full sentences
 * (Rule 11). This module is a **pre-engine gate**: it runs before
 * Game.setup() ever sees the data. Per WP-033 it must NEVER be
 * wired into moves, phase hooks, or any boardgame.io lifecycle
 * callback.
 *
 * Implementation pattern mirrors WP-032's validateIntent and its
 * caller-injected `validMoveNames: readonly string[]` (P6-20 / D-2801)
 * — both delegate cross-reference data to the caller rather than
 * reaching into another package.
 */

import { HERO_KEYWORDS, HERO_ABILITY_TIMINGS } from '../rules/heroKeywords.js';
import { BOARD_KEYWORDS } from '../board/boardKeywords.types.js';
import { SCHEME_SETUP_TYPES } from '../scheme/schemeSetup.types.js';
import {
  ACCEPTED_CONTENT_TYPES,
  HERO_CARD_SCHEMA,
  VILLAIN_CARD_SCHEMA,
  HENCHMAN_CARD_SCHEMA,
  MASTERMIND_CARD_SCHEMA,
  SCHEME_CARD_SCHEMA,
  SCENARIO_SCHEMA,
} from './content.schemas.js';
import type { ContentSchemaDescriptor } from './content.schemas.js';

// ---------------------------------------------------------------------------
// Result and error types
// ---------------------------------------------------------------------------

/**
 * One validation error entry. Every field is a plain string so the
 * whole object is JSON-serializable. `contentId` is `''` when the
 * validator cannot derive an id (e.g. an unknown contentType, or a
 * content object missing `slug`/`id`).
 */
export interface ContentValidationError {
  contentType: string;
  contentId: string;
  field: string;
  message: string;
}

/**
 * Structured validation result. `valid: true` has no errors; `valid:
 * false` always has at least one error in `errors`.
 */
export type ContentValidationResult =
  | { valid: true }
  | { valid: false; errors: ContentValidationError[] };

// ---------------------------------------------------------------------------
// ContentValidationContext — caller-injected cross-reference data
// ---------------------------------------------------------------------------

/**
 * Caller-injected cross-reference data. All fields optional; when a
 * field is absent, the corresponding cross-reference check is
 * silently skipped (absence is not an error — the caller chose not
 * to supply that reference set).
 *
 * // why: cross-reference checks need a caller-supplied set of valid
 * slugs. The engine category must not import the registry to populate
 * this (D-3301). Pattern mirrors WP-032's validMoveNames injection
 * (P6-20 / D-2801 local structural interface precedent).
 *
 * // why: ContentValidationContext uses ReadonlySet<string> for O(1)
 * membership checks. It is a **runtime call-site parameter only**.
 * It MUST NOT be stored in G, persisted to any database or snapshot,
 * serialized over the wire, or embedded in any type that crosses a
 * persistence boundary. Set is forbidden in G per D-1232 (WP-009A/009B
 * precedent). If a future caller needs to transport this data across
 * a serialization boundary, convert to readonly string[] at the boundary.
 */
export interface ContentValidationContext {
  readonly validVillainGroupSlugs?: ReadonlySet<string>;
  readonly validMastermindSlugs?: ReadonlySet<string>;
  readonly validSchemeSlugs?: ReadonlySet<string>;
  readonly validHeroSlugs?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Narrows `unknown` to a plain object shape we can index by string
 * keys without TypeScript complaints. Arrays and null are rejected.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the content's slug if it is a non-empty string; otherwise
 * `''`. Used to populate `contentId` in error entries.
 */
function getContentId(content: Record<string, unknown>): string {
  const slug = content['slug'];
  if (typeof slug === 'string' && slug.length > 0) {
    return slug;
  }
  const id = content['id'];
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  return '';
}

/**
 * Capitalizes the first character of a content type label for use
 * inside an error message ("The hero card..." rather than "The hero
 * card..."). Kept tiny to avoid importing a utility library.
 */
function humanLabel(contentType: string): string {
  switch (contentType) {
    case 'hero':
      return 'hero card';
    case 'villain':
      return 'villain';
    case 'henchman':
      return 'henchman';
    case 'mastermind':
      return 'mastermind';
    case 'scheme':
      return 'scheme';
    case 'scenario':
      return 'scenario';
    default:
      return contentType;
  }
}

/**
 * Selects the descriptor for a known contentType. Callers must have
 * already validated `contentType` against ACCEPTED_CONTENT_TYPES.
 */
function getSchemaDescriptor(contentType: string): ContentSchemaDescriptor {
  switch (contentType) {
    case 'hero':
      return HERO_CARD_SCHEMA;
    case 'villain':
      return VILLAIN_CARD_SCHEMA;
    case 'henchman':
      return HENCHMAN_CARD_SCHEMA;
    case 'mastermind':
      return MASTERMIND_CARD_SCHEMA;
    case 'scheme':
      return SCHEME_CARD_SCHEMA;
    case 'scenario':
      return SCENARIO_SCHEMA;
    default:
      // Should never reach here — caller already gated on the accept list.
      return {
        requiredFields: [],
        stringFields: [],
        numericFields: [],
        arrayFields: [],
        enumFields: {},
      };
  }
}

/**
 * Pushes a structured error onto `errors`. Keeping this here avoids
 * inlining the same shape at every call site.
 */
function pushError(
  errors: ContentValidationError[],
  contentType: string,
  contentId: string,
  field: string,
  message: string,
): void {
  errors.push({ contentType, contentId, field, message });
}

// ---------------------------------------------------------------------------
// Stage 1 — structural checks
// ---------------------------------------------------------------------------

// why: structural checks catch missing required fields and wrong
// types at the most basic level — the content object itself, the
// required-field list, the string/numeric/array-field type
// constraints, and the enum-field membership checks. If this stage
// fails, later stages (cross-references, hook consistency) cannot
// run meaningfully because the shape isn't even right.
function runStructuralChecks(
  content: Record<string, unknown>,
  contentType: string,
  contentId: string,
  descriptor: ContentSchemaDescriptor,
  errors: ContentValidationError[],
): void {
  for (const field of descriptor.requiredFields) {
    const value = content[field];
    if (value === undefined || value === null) {
      pushError(
        errors,
        contentType,
        contentId,
        field,
        `The ${humanLabel(contentType)} with slug "${contentId}" is missing required field "${field}".`,
      );
    }
  }

  for (const field of descriptor.stringFields) {
    const value = content[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'string' || value.length === 0) {
      pushError(
        errors,
        contentType,
        contentId,
        field,
        `The ${humanLabel(contentType)} with slug "${contentId}" has field "${field}" that must be a non-empty string.`,
      );
    }
  }

  for (const field of descriptor.numericFields) {
    const value = content[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      pushError(
        errors,
        contentType,
        contentId,
        field,
        `The ${humanLabel(contentType)} with slug "${contentId}" has field "${field}" that must be a finite number.`,
      );
    }
  }

  for (const field of descriptor.arrayFields) {
    const value = content[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (!Array.isArray(value)) {
      pushError(
        errors,
        contentType,
        contentId,
        field,
        `The ${humanLabel(contentType)} with slug "${contentId}" has field "${field}" that must be an array.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — enum checks
// ---------------------------------------------------------------------------

// why: enum checks catch keywords, classes, or other enumerated
// values that fall outside the canonical unions (HERO_KEYWORDS,
// BOARD_KEYWORDS, HERO_ABILITY_TIMINGS, SCHEME_SETUP_TYPES, plus the
// local HERO_CLASSES). These are single-source-of-truth arrays and
// drift here causes silent runtime bugs — so invalid enum values
// must fail loudly at authoring time.
function runEnumChecks(
  content: Record<string, unknown>,
  contentType: string,
  contentId: string,
  descriptor: ContentSchemaDescriptor,
  errors: ContentValidationError[],
): void {
  for (const field of Object.keys(descriptor.enumFields)) {
    const allowed = descriptor.enumFields[field];
    if (allowed === undefined) {
      continue;
    }
    const value = content[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'string') {
      // Type error already reported by structural stage if the field
      // is declared in stringFields; skip to avoid double-reporting.
      continue;
    }
    let matched = false;
    for (const option of allowed) {
      if (option === value) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      pushError(
        errors,
        contentType,
        contentId,
        field,
        `The ${humanLabel(contentType)} with slug "${contentId}" has field "${field}" value "${value}" which is not one of the allowed values: ${allowed.join(', ')}.`,
      );
    }
  }

  // Hero keyword / board keyword checks — heroes may carry a
  // `keywords` array referencing HERO_KEYWORDS; villains, henchmen,
  // and masterminds may carry a `boardKeywords` array referencing
  // BOARD_KEYWORDS. Absent arrays are fine — this only runs when
  // the author supplied the field.
  if (contentType === 'hero') {
    const keywords = content['keywords'];
    if (Array.isArray(keywords)) {
      for (const keyword of keywords) {
        if (typeof keyword !== 'string') {
          pushError(
            errors,
            contentType,
            contentId,
            'keywords',
            `The hero card with slug "${contentId}" has a non-string entry in field "keywords".`,
          );
          continue;
        }
        let matched = false;
        for (const option of HERO_KEYWORDS) {
          if (option === keyword) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          pushError(
            errors,
            contentType,
            contentId,
            'keywords',
            `The hero card with slug "${contentId}" references keyword "${keyword}" which is not a valid HERO_KEYWORDS value.`,
          );
        }
      }
    }
  }

  if (contentType === 'villain' || contentType === 'henchman' || contentType === 'mastermind') {
    const boardKeywords = content['boardKeywords'];
    if (Array.isArray(boardKeywords)) {
      for (const keyword of boardKeywords) {
        if (typeof keyword !== 'string') {
          pushError(
            errors,
            contentType,
            contentId,
            'boardKeywords',
            `The ${humanLabel(contentType)} with slug "${contentId}" has a non-string entry in field "boardKeywords".`,
          );
          continue;
        }
        let matched = false;
        for (const option of BOARD_KEYWORDS) {
          if (option === keyword) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          pushError(
            errors,
            contentType,
            contentId,
            'boardKeywords',
            `The ${humanLabel(contentType)} with slug "${contentId}" references board keyword "${keyword}" which is not a valid BOARD_KEYWORDS value.`,
          );
        }
      }
    }
  }

  // Scheme setup instruction types must be in SCHEME_SETUP_TYPES.
  if (contentType === 'scheme') {
    const instructions = content['setupInstructions'];
    if (Array.isArray(instructions)) {
      for (const instruction of instructions) {
        if (!isPlainRecord(instruction)) {
          pushError(
            errors,
            contentType,
            contentId,
            'setupInstructions',
            `The scheme "${contentId}" has a setup instruction that is not a plain object.`,
          );
          continue;
        }
        const type = instruction['type'];
        if (typeof type !== 'string') {
          pushError(
            errors,
            contentType,
            contentId,
            'setupInstructions',
            `The scheme "${contentId}" has a setup instruction with a non-string "type" field.`,
          );
          continue;
        }
        let matched = false;
        for (const option of SCHEME_SETUP_TYPES) {
          if (option === type) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          pushError(
            errors,
            contentType,
            contentId,
            'setupInstructions',
            `The scheme "${contentId}" has setup instruction type "${type}" which is not a valid SCHEME_SETUP_TYPES value.`,
          );
        }
      }
    }
  }

  // Mastermind tactic-presence check — cards must be a non-empty
  // array with at least one entry where `tactic === true`.
  if (contentType === 'mastermind') {
    const cards = content['cards'];
    if (Array.isArray(cards)) {
      let hasTactic = false;
      for (const card of cards) {
        if (isPlainRecord(card) && card['tactic'] === true) {
          hasTactic = true;
          break;
        }
      }
      if (!hasTactic) {
        pushError(
          errors,
          contentType,
          contentId,
          'cards',
          `The mastermind "${contentId}" must have at least one card with "tactic": true.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — cross-reference checks (require context)
// ---------------------------------------------------------------------------

// why: cross-reference checks catch broken references between content
// items — e.g., a mastermind whose alwaysLeads slug does not correspond
// to any known villain group. These checks REQUIRE caller-supplied
// reference sets (context). When the corresponding set is absent, the
// check is silently skipped (absence is an opt-out, not a failure).
// The engine category cannot import the registry to populate context
// itself (D-3301) — that's the caller's responsibility.
function runCrossReferenceChecks(
  content: Record<string, unknown>,
  contentType: string,
  contentId: string,
  context: ContentValidationContext | undefined,
  errors: ContentValidationError[],
): void {
  if (context === undefined) {
    return;
  }

  if (contentType === 'mastermind') {
    const alwaysLeads = content['alwaysLeads'];
    const validGroups = context.validVillainGroupSlugs;
    if (Array.isArray(alwaysLeads) && validGroups !== undefined) {
      for (const slug of alwaysLeads) {
        if (typeof slug !== 'string') {
          continue;
        }
        if (!validGroups.has(slug)) {
          pushError(
            errors,
            contentType,
            contentId,
            'alwaysLeads',
            `The mastermind "${contentId}" references alwaysLeads slug "${slug}" which is not in the supplied valid-villain-groups set.`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 4 — hook consistency checks
// ---------------------------------------------------------------------------

// why: hook consistency checks catch hero-ability hooks whose
// `timing` or `keywords` drift from the WP-021 canonical unions
// (HERO_ABILITY_TIMINGS, HERO_KEYWORDS). Drift here causes silent
// at-runtime mismatches — the hook never fires because nothing
// matches its string — so the validator must catch it at authoring
// time.
function runHookConsistencyChecks(
  content: Record<string, unknown>,
  contentType: string,
  contentId: string,
  errors: ContentValidationError[],
): void {
  if (contentType !== 'hero') {
    return;
  }
  const hooks = content['abilityHooks'];
  if (!Array.isArray(hooks)) {
    return;
  }
  for (const hook of hooks) {
    if (!isPlainRecord(hook)) {
      pushError(
        errors,
        contentType,
        contentId,
        'abilityHooks',
        `The hero card with slug "${contentId}" has an abilityHooks entry that is not a plain object.`,
      );
      continue;
    }
    const timing = hook['timing'];
    if (typeof timing === 'string') {
      let matched = false;
      for (const option of HERO_ABILITY_TIMINGS) {
        if (option === timing) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        pushError(
          errors,
          contentType,
          contentId,
          'abilityHooks.timing',
          `The hero card with slug "${contentId}" has an ability hook with timing "${timing}" which is not a valid HERO_ABILITY_TIMINGS value.`,
        );
      }
    }
    const keywords = hook['keywords'];
    if (Array.isArray(keywords)) {
      for (const keyword of keywords) {
        if (typeof keyword !== 'string') {
          continue;
        }
        let matched = false;
        for (const option of HERO_KEYWORDS) {
          if (option === keyword) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          pushError(
            errors,
            contentType,
            contentId,
            'abilityHooks.keywords',
            `The hero card with slug "${contentId}" has an ability hook referencing keyword "${keyword}" which is not a valid HERO_KEYWORDS value.`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public entrypoints
// ---------------------------------------------------------------------------

/**
 * Validates a single content object against the author-facing schema
 * for its content type, returning a structured result. Never throws.
 *
 * Validation stages run in order:
 *   0. Accept-list check — unrecognized contentType ⇒ single error,
 *      subsequent stages skipped for this item.
 *   1. Structural checks.
 *   2. Enum checks.
 *   3. Cross-reference checks (skipped silently if context absent).
 *   4. Hook consistency checks.
 *
 * @param content - The content object to validate. Accepted as
 *   `unknown`; the validator narrows internally.
 * @param contentType - One of the six accepted content type strings
 *   (`'hero' | 'villain' | 'henchman' | 'mastermind' | 'scheme' |
 *   'scenario'`). Any other value produces a single error identifying
 *   the unrecognized type.
 * @param context - Optional caller-injected cross-reference data. When
 *   absent, cross-reference checks are silently skipped.
 * @returns `{ valid: true }` if no errors; otherwise
 *   `{ valid: false, errors }` with every error as a full sentence.
 */
export function validateContent(
  content: unknown,
  contentType: string,
  context?: ContentValidationContext,
): ContentValidationResult {
  const errors: ContentValidationError[] = [];

  // Stage 0 — accept-list check.
  let accepted = false;
  for (const known of ACCEPTED_CONTENT_TYPES) {
    if (known === contentType) {
      accepted = true;
      break;
    }
  }
  if (!accepted) {
    return {
      valid: false,
      errors: [
        {
          contentType: contentType,
          contentId: '',
          field: 'contentType',
          message: `The contentType "${contentType}" is not a recognized content type. Accepted values are: hero, villain, henchman, mastermind, scheme, scenario.`,
        },
      ],
    };
  }

  if (!isPlainRecord(content)) {
    return {
      valid: false,
      errors: [
        {
          contentType: contentType,
          contentId: '',
          field: 'content',
          message: `The ${humanLabel(contentType)} content must be a plain object, not an array, null, or primitive value.`,
        },
      ],
    };
  }

  const contentId = getContentId(content);
  const descriptor = getSchemaDescriptor(contentType);

  runStructuralChecks(content, contentType, contentId, descriptor, errors);
  runEnumChecks(content, contentType, contentId, descriptor, errors);
  runCrossReferenceChecks(content, contentType, contentId, context, errors);
  runHookConsistencyChecks(content, contentType, contentId, errors);

  if (errors.length === 0) {
    return { valid: true };
  }
  return { valid: false, errors };
}

/**
 * Validates multiple content items and aggregates all errors. Single
 * invalid item does NOT short-circuit the batch; every item is
 * validated and its errors concatenated. An unknown `contentType`
 * in any item produces one error for that item; other items continue
 * to validate normally.
 *
 * @param items - Array of `{ content, contentType }` pairs.
 * @param context - Optional caller-injected cross-reference data,
 *   forwarded unchanged to every per-item validateContent call.
 */
export function validateContentBatch(
  items: { content: unknown; contentType: string }[],
  context?: ContentValidationContext,
): ContentValidationResult {
  const allErrors: ContentValidationError[] = [];
  for (const item of items) {
    const result = validateContent(item.content, item.contentType, context);
    if (!result.valid) {
      for (const error of result.errors) {
        allErrors.push(error);
      }
    }
  }
  if (allErrors.length === 0) {
    return { valid: true };
  }
  return { valid: false, errors: allErrors };
}
