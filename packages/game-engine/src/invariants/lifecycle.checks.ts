/**
 * Lifecycle invariant checks for the Legendary Arena game engine.
 *
 * Pure check functions that read framework lifecycle context fields
 * (phase, stage, turn) and assert lifecycle invariants via
 * assertInvariant. None of these functions mutate G, perform I/O,
 * or import the game framework. Per Amendment A-031-03, parameter types
 * are widened to `string | undefined` / `number | undefined` so
 * that mock contexts in tests (which do not set phase/turn) flow
 * through gracefully.
 */

import type { TurnStage } from '../turn/turnPhases.types.js';
import { MATCH_PHASES, TURN_STAGES } from '../turn/turnPhases.types.js';
import { assertInvariant } from './assertInvariant.js';

/**
 * Asserts that a phase string is one of the canonical MATCH_PHASES.
 *
 * Accepts `string | undefined` because at some lifecycle points
 * (notably setup time inside tests that cast makeMockCtx) the
 * framework context's `phase` field is absent at runtime even
 * though the game framework's Ctx types it as a non-null string. When
 * phase is undefined, the function short-circuits silently —
 * lifecycle validity cannot be asserted on an absent field.
 */
// why: prevents lifecycle corruption — a phase string outside the
// canonical 4 (`lobby`, `setup`, `play`, `end`) means a
// ctx.events.setPhase call somewhere passed an invalid argument.
// The check is the runtime guard for the type system's compile-
// time `MatchPhase` union.
export function checkValidPhase(phase: string | undefined): void {
  // why: at setup time inside tests that cast makeMockCtx, phase may
  // be runtime-undefined even though the game framework Ctx types it as
  // string. Silent-skip when undefined — lifecycle validity cannot
  // be asserted on an absent field.
  if (phase === undefined) return;

  const canonicalPhases = MATCH_PHASES as readonly string[];
  assertInvariant(
    canonicalPhases.includes(phase),
    'lifecycle',
    `Match phase '${phase}' is not one of the canonical MATCH_PHASES (${canonicalPhases.join(', ')}). Inspect game.ts phase transitions for a setPhase call with an invalid argument.`,
  );
}

/**
 * Asserts that a stage value is one of the canonical TURN_STAGES.
 *
 * Reads G.currentStage (typed as TurnStage), but the check still
 * runs to guard against type-bypass corruption that assigned an
 * invalid string via `(G.currentStage as any) = 'invalid'`.
 */
// why: prevents stage corruption — a stage string outside the
// canonical 3 (`start`, `main`, `cleanup`) would break
// advanceTurnStage and getNextTurnStage. The check is the runtime
// guard for the compile-time TurnStage union.
export function checkValidStage(stage: TurnStage): void {
  const canonicalStages = TURN_STAGES as readonly string[];
  assertInvariant(
    canonicalStages.includes(stage),
    'lifecycle',
    `Turn stage '${String(stage)}' is not one of the canonical TURN_STAGES (${canonicalStages.join(', ')}). Inspect any assignment to G.currentStage for an invalid value — this is a type-bypass invariant guard.`,
  );
}

/**
 * Asserts that the turn counter is monotonic — `currentTurn` must
 * be greater than or equal to `previousTurn`.
 *
 * Both parameters accept `number | undefined`. When either is
 * undefined, the function short-circuits silently — monotonicity
 * cannot be asserted without two reference points.
 *
 * NOTE: This function is exported for use by a future per-turn
 * wiring follow-up WP. WP-031's runAllInvariantChecks does NOT
 * call it because there is no "previous turn" reference at setup
 * time (D-3102 Option B locks setup-only wiring).
 */
// why: prevents lifecycle regression — a turn counter that
// decreased would break replay determinism (replays index moves
// by turn) and any UI that displays turn number. The check is a
// pure helper exported for future wiring, not currently called by
// the orchestrator.
export function checkTurnCounterMonotonic(
  currentTurn: number | undefined,
  previousTurn: number | undefined,
): void {
  // why: at lifecycle points without a previous-turn reference
  // (notably setup time), monotonicity cannot be asserted.
  // Silent-skip when either field is absent.
  if (currentTurn === undefined || previousTurn === undefined) return;

  assertInvariant(
    currentTurn >= previousTurn,
    'lifecycle',
    `Turn counter must be monotonic — current turn (${currentTurn}) decreased from previous turn (${previousTurn}). Turn counter may never decrease. Inspect any code that assigns to ctx.turn or bypasses ctx.events.endTurn.`,
  );
}
