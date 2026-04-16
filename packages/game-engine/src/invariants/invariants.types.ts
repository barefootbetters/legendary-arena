/**
 * Runtime invariant contracts for the Legendary Arena game engine.
 *
 * Invariants are checked at runtime against G at strategic lifecycle
 * points (currently: after Game.setup() returns, per D-3102 Option B).
 * Violations throw InvariantViolationError and abort match creation
 * immediately.
 *
 * This file is pure data-only: types and one canonical array. No
 * runtime code, no the game framework import, no registry import. See
 * D-3101 for the directory classification rationale.
 */

// why: five non-overlapping categories prevent classification ambiguity.
// Each check belongs to exactly one category. Adding a new category
// requires updating both the union below and INVARIANT_CATEGORIES. See
// D-0102 for the fail-fast / gameplay-condition distinction this union
// is built on top of.

/** The five non-overlapping invariant categories. */
export type InvariantCategory =
  | 'structural'
  | 'gameRules'
  | 'determinism'
  | 'security'
  | 'lifecycle';

// why: drift-detection between the runtime array and the InvariantCategory
// union. Test 1 asserts this array matches the union exactly. Adding a new
// category requires updating BOTH — this is the same pattern used by
// MATCH_PHASES, TURN_STAGES, REVEALED_CARD_TYPES, BOARD_KEYWORDS,
// SCHEME_SETUP_TYPES, PERSISTENCE_CLASSES, RULE_TRIGGER_NAMES, and
// RULE_EFFECT_TYPES.

/** The five invariant categories in canonical order. */
export const INVARIANT_CATEGORIES: readonly InvariantCategory[] = [
  'structural',
  'gameRules',
  'determinism',
  'security',
  'lifecycle',
] as const;

/**
 * Structured violation descriptor used by assertInvariant error
 * construction and post-mortem inspection.
 *
 * `context` is an optional diagnostic bag — currently unused at
 * construction time but reserved so future WPs can attach
 * debugging metadata without widening the constructor signature.
 */
export interface InvariantViolation {
  category: InvariantCategory;
  message: string;
  context?: Record<string, unknown>;
}

// why: local subset of framework context fields read by lifecycle
// invariant checks. Defined here to avoid importing the game framework into
// any file under src/invariants/ — the engine boundary rule
// (.claude/rules/architecture.md) forbids the game framework imports in pure
// helper directories. Follows the WP-028 UIBuildContext precedent
// (D-2801). Populated from the real Ctx at the wiring site in game.ts,
// which is already a framework-boundary file.
//
// Fields are optional because at some lifecycle points (e.g., setup
// time with mock contexts in tests) they may be unavailable. The
// lifecycle check functions short-circuit on undefined fields per
// Amendment A-031-03.

/**
 * Local structural interface for the framework context fields read
 * by lifecycle invariant checks.
 */
export interface InvariantCheckContext {
  readonly phase?: string;
  readonly turn?: number;
}
