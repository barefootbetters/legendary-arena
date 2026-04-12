/**
 * Match setup validation for Legendary Arena.
 *
 * validateMatchSetup checks both the shape of the input and the existence of
 * all referenced ext_ids in the card registry. It never throws — it returns a
 * structured ValidateMatchSetupResult. The caller (Game.setup()) decides
 * whether to throw based on the result.
 */

import type {
  MatchSetupConfig,
  MatchSetupError,
  ValidateMatchSetupResult,
} from './matchSetup.types.js';

// why: The game-engine layer must not import from @legendary-arena/registry
// (architecture layer boundary). This minimal interface defines what the
// validator needs from a registry. The real CardRegistry satisfies it via
// structural typing, so the server can pass one in at setup time.

/**
 * Minimal registry interface for ext_id existence checks.
 *
 * The real CardRegistry from @legendary-arena/registry satisfies this
 * interface structurally. Defined locally to respect the layer boundary
 * that forbids game-engine from importing registry.
 */
export interface CardRegistryReader {
  /** Returns all cards. The validator uses the key field for ext_id lookup. */
  listCards(): Array<{ key: string }>;
}

/** The 9 field names that must appear in a valid MatchSetupConfig. */
const STRING_FIELDS = ['schemeId', 'mastermindId'] as const;
const ARRAY_FIELDS = ['villainGroupIds', 'henchmanGroupIds', 'heroDeckIds'] as const;
const COUNT_FIELDS = ['bystandersCount', 'woundsCount', 'officersCount', 'sidekicksCount'] as const;

/**
 * Checks whether a value is a non-null object (not an array).
 *
 * @param value - The value to check.
 * @returns True if the value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks whether a value is a non-empty array of strings.
 *
 * @param value - The value to check.
 * @returns True if the value is a non-empty string array.
 */
function isNonEmptyStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether a value is a non-negative integer.
 *
 * @param value - The value to check.
 * @returns True if the value is an integer >= 0.
 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Builds a set of known ext_id strings from the card registry.
 *
 * @param registry - The card registry to extract ext_ids from.
 * @returns A Set of all known card ext_id strings.
 */
function buildKnownExtIds(registry: CardRegistryReader): Set<string> {
  const cards = registry.listCards();
  const knownIds = new Set<string>();
  for (const card of cards) {
    knownIds.add(card.key);
  }
  return knownIds;
}

/**
 * Validates a match setup payload against the MatchSetupConfig contract and
 * the card registry.
 *
 * Checks are performed in order:
 * 1. All 9 fields present and of correct type
 * 2. Array fields are non-empty string arrays
 * 3. Count fields are non-negative integers
 * 4. Each ext_id exists in the registry
 *
 * Never throws. Returns a structured result.
 *
 * @param input - The unvalidated input to check (typically from a lobby request).
 * @param registry - The card registry for ext_id existence checks.
 * @returns A ValidateMatchSetupResult — either ok with the validated config,
 *          or not ok with an array of errors.
 */
export function validateMatchSetup(
  input: unknown,
  registry: CardRegistryReader,
): ValidateMatchSetupResult {
  const errors: MatchSetupError[] = [];

  if (!isPlainObject(input)) {
    errors.push({
      field: 'input',
      message: 'The match setup input must be a non-null object.',
    });
    return { ok: false, errors };
  }

  // --- Shape validation: string fields ---
  // why: Empty strings pass this type check intentionally. Registry ext_id
  // lookup in Stage 2 below will fail for empty strings since no card has
  // an empty ext_id. JSON Schema enforces minLength: 1 at the server layer.
  for (const fieldName of STRING_FIELDS) {
    if (typeof input[fieldName] !== 'string') {
      errors.push({
        field: fieldName,
        message: `The ${fieldName} field must be a string containing a valid ext_id.`,
      });
    }
  }

  // --- Shape validation: array fields ---
  for (const fieldName of ARRAY_FIELDS) {
    if (!isNonEmptyStringArray(input[fieldName])) {
      errors.push({
        field: fieldName,
        message: `The ${fieldName} field must be a non-empty array of ext_id strings.`,
      });
    }
  }

  // --- Shape validation: count fields ---
  for (const fieldName of COUNT_FIELDS) {
    if (!isNonNegativeInteger(input[fieldName])) {
      errors.push({
        field: fieldName,
        message: `The ${fieldName} field must be a non-negative integer.`,
      });
    }
  }

  // why: If shape validation already failed, ext_id checks would produce
  // misleading errors (e.g. trying to look up undefined in the registry).
  // Return early with the shape errors so the caller gets actionable feedback.
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // --- Registry ext_id existence checks ---
  const knownExtIds = buildKnownExtIds(registry);

  for (const fieldName of STRING_FIELDS) {
    const extId = input[fieldName] as string;
    if (!knownExtIds.has(extId)) {
      errors.push({
        field: fieldName,
        message: `The ${fieldName} value "${extId}" does not match any known card ext_id in the registry.`,
      });
    }
  }

  for (const fieldName of ARRAY_FIELDS) {
    const extIds = input[fieldName] as string[];
    for (const extId of extIds) {
      if (!knownExtIds.has(extId)) {
        errors.push({
          field: fieldName,
          message: `The ${fieldName} entry "${extId}" does not match any known card ext_id in the registry.`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // why: At this point all shape and registry checks have passed. The input
  // is safe to cast to MatchSetupConfig because we verified every field
  // individually above.
  const validConfig: MatchSetupConfig = {
    schemeId: input.schemeId as string,
    mastermindId: input.mastermindId as string,
    villainGroupIds: input.villainGroupIds as string[],
    henchmanGroupIds: input.henchmanGroupIds as string[],
    heroDeckIds: input.heroDeckIds as string[],
    bystandersCount: input.bystandersCount as number,
    woundsCount: input.woundsCount as number,
    officersCount: input.officersCount as number,
    sidekicksCount: input.sidekicksCount as number,
  };

  return { ok: true, value: validConfig };
}
