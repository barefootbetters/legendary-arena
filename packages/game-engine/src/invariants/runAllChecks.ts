/**
 * Runtime invariant orchestrator for the Legendary Arena game engine.
 *
 * runAllInvariantChecks runs every implemented check function in a
 * fixed category order. The first violation throws via assertInvariant
 * and skips the remaining checks (fail-fast). Per D-3102 Option B,
 * the orchestrator is wired into game.ts at exactly one point — the
 * Game.setup() return path — and nowhere else.
 */

import type { LegendaryGameState } from '../types.js';
import type { InvariantCheckContext } from './invariants.types.js';
import {
  checkCitySize,
  checkZoneArrayTypes,
  checkCountersAreFinite,
  checkGIsSerializable,
} from './structural.checks.js';
import {
  checkNoCardInMultipleZones,
  checkZoneCountsNonNegative,
  checkCountersUseConstants,
} from './gameRules.checks.js';
import {
  checkNoFunctionsInG,
  checkSerializationRoundtrip,
} from './determinism.checks.js';
import {
  checkValidPhase,
  checkValidStage,
} from './lifecycle.checks.js';

/**
 * Runs all implemented invariant checks against G in category order.
 *
 * @param G - The game state to check.
 * @param invariantContext - Local structural framework context subset
 *   for lifecycle checks. Fields may be undefined if unavailable at
 *   the call site (notably mock contexts in tests); lifecycle checks
 *   handle this gracefully via short-circuit returns.
 * @throws {InvariantViolationError} on first invariant violation.
 */
// why: the fixed category order prevents "which violation fired first?"
// ambiguity. Structural checks run first because structural corruption
// invalidates every other check — asserting gameRules on a non-array
// zone would produce a confusing secondary failure. Fail-fast: the
// first assertInvariant throw aborts the runner and remaining checks
// are skipped.
//
// why: security / visibility checks are deferred per WP-031 §Out of
// Scope. The InvariantCategory 'security' slot exists in the union
// and INVARIANT_CATEGORIES array for future extension, but no check
// functions are implemented yet. A follow-up WP fills the slot
// without refactoring this orchestrator.
//
// why: checkTurnCounterMonotonic is NOT called here — it requires a
// previous-turn reference that does not exist at setup time. It is
// a pure helper exported from lifecycle.checks.ts for future
// per-turn wiring under a follow-up of D-3102.
export function runAllInvariantChecks(
  G: LegendaryGameState,
  invariantContext: InvariantCheckContext,
): void {
  // Structural
  checkCitySize(G);
  checkZoneArrayTypes(G);
  checkCountersAreFinite(G);
  checkGIsSerializable(G);

  // Game Rules
  checkNoCardInMultipleZones(G);
  checkZoneCountsNonNegative(G);
  checkCountersUseConstants(G);

  // Determinism
  checkNoFunctionsInG(G);
  checkSerializationRoundtrip(G);

  // Security (deferred — no checks at MVP per WP-031 §Out of Scope)

  // Lifecycle
  checkValidPhase(invariantContext.phase);
  checkValidStage(G.currentStage);
}
