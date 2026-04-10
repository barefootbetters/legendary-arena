/**
 * Match setup contract types for Legendary Arena.
 *
 * These types define the canonical shape of a match setup payload, its
 * validation errors, and the structured result returned by validateMatchSetup.
 * Field names are locked by 00.2 section 8.1 — do not rename, abbreviate,
 * or reorder.
 *
 * This file is a contract file. Changes require architecture review and a
 * DECISIONS.md entry.
 */

// why: ext_id string references (not numeric database IDs) are stable across
// database re-seeds. Numeric IDs change whenever the seeder drops and
// re-creates rows, silently breaking saved match configurations or replay
// references. ext_id strings are human-readable, deterministic, and usable
// without a database connection. Per 00.2 section 4.4 and DECISIONS.md
// D-1201/D-1202.

/**
 * The canonical 9-field match setup configuration.
 *
 * All card references use ext_id strings from the card registry. Count fields
 * represent the number of cards of each type to include in the game.
 *
 * This type is the authoritative shape for match creation requests. All future
 * setup and gameplay packets depend on it.
 */
export interface MatchSetupConfig {
  /** Scheme ext_id. */
  readonly schemeId: string;

  /** Mastermind ext_id. */
  readonly mastermindId: string;

  /** Villain group ext_ids. Must be a non-empty array. */
  readonly villainGroupIds: readonly string[];

  /** Henchman group ext_ids. Must be a non-empty array. */
  readonly henchmanGroupIds: readonly string[];

  /** Hero deck ext_ids. Must be a non-empty array. */
  readonly heroDeckIds: readonly string[];

  /** Number of bystander cards in the game. Must be a non-negative integer. */
  readonly bystandersCount: number;

  /** Number of wound cards in the game. Must be a non-negative integer. */
  readonly woundsCount: number;

  /** Number of S.H.I.E.L.D. Officer cards in the game. Must be a non-negative integer. */
  readonly officersCount: number;

  /** Number of Sidekick cards in the game. Must be a non-negative integer. */
  readonly sidekicksCount: number;
}

/**
 * A single validation error from match setup validation.
 *
 * This is NOT MoveError (which uses { code, message, path } and is defined
 * in WP-008A). MatchSetupError is specific to setup validation and uses a
 * simpler shape.
 */
export interface MatchSetupError {
  /** The field name that failed validation. */
  readonly field: string;

  /** A full sentence describing what failed and what to check. */
  readonly message: string;
}

/**
 * Discriminated union result from validateMatchSetup.
 *
 * On success, contains the validated MatchSetupConfig. On failure, contains
 * an array of MatchSetupError describing each validation failure.
 */
export type ValidateMatchSetupResult =
  | { readonly ok: true; readonly value: MatchSetupConfig }
  | { readonly ok: false; readonly errors: MatchSetupError[] };
