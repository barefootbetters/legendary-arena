/**
 * Canonical phase and turn stage types for the Legendary Arena game engine.
 *
 * These types define the match lifecycle phases and the per-turn stage cycle.
 * All logic, type guards, helpers, and tests must derive behavior from the
 * canonical arrays (MATCH_PHASES, TURN_STAGES) — no hardcoded string literals.
 */

// why: 00.2 section 8.2 defines four lifecycle concepts for a match:
//   Lobby       -> boardgame.io phase 'lobby'
//   Setup       -> boardgame.io phase 'setup'
//   In Progress -> boardgame.io phase 'play'
//   Completed   -> boardgame.io phase 'end'
// These names are locked by the architecture and must not be renamed.

/** The four match lifecycle phases in canonical order. */
export type MatchPhase = 'lobby' | 'setup' | 'play' | 'end';

/** All match phases in canonical order. Single source of truth. */
export const MATCH_PHASES: readonly MatchPhase[] = [
  'lobby',
  'setup',
  'play',
  'end',
] as const;

/** The three turn stages within the play phase, in canonical order. */
export type TurnStage = 'start' | 'main' | 'cleanup';

/** All turn stages in canonical order. Single source of truth. */
export const TURN_STAGES: readonly TurnStage[] = [
  'start',
  'main',
  'cleanup',
] as const;

/**
 * Structured error returned by turn phase validators.
 *
 * Intentionally distinct from ZoneValidationError ({ field, message }) —
 * these are different domains with different validation needs.
 */
export interface TurnPhaseError {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** The field or parameter that caused the error (e.g., "from", "to"). */
  path: string;
}
