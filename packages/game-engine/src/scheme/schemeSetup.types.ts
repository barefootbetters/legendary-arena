/**
 * Scheme setup instruction types for the Legendary Arena game engine.
 *
 * Scheme setup instructions are declarative, data-only contracts that describe
 * what a scheme changes about the game at setup time. They follow the
 * "Representation Before Execution" decision (D-2601): data-only
 * representation first, deterministic execution via pure helpers.
 */

// why: scheme instructions follow the "Representation Before Execution"
// decision (D-2601) — data-only contracts applied by a deterministic executor
// at setup time. Instructions are JSON-serializable and stored in G for replay
// observability. No functions, closures, or class instances.

/**
 * The set of scheme setup instruction types supported at MVP.
 *
 * This is a closed union — adding a new type requires a DECISIONS.md entry.
 */
export type SchemeSetupType =
  | 'modifyCitySize'
  | 'addCityKeyword'
  | 'addSchemeCounter'
  | 'initialCityState';

/**
 * A single scheme setup instruction — data-only, JSON-serializable.
 *
 * Instructions execute once during the setup phase, after deck construction,
 * before the first turn. They are never re-executed during moves.
 */
export interface SchemeSetupInstruction {
  readonly type: SchemeSetupType;
  readonly value: unknown;
}

/**
 * Canonical array of all scheme setup instruction types. Single source of truth.
 *
 * Used for drift-detection testing — if a type is added to the SchemeSetupType
 * union, it must also appear in this array (and vice versa).
 */
export const SCHEME_SETUP_TYPES: readonly SchemeSetupType[] = [
  'modifyCitySize',
  'addCityKeyword',
  'addSchemeCounter',
  'initialCityState',
] as const;
