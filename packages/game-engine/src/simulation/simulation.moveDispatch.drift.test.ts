/**
 * Drift guard for the simulation move-dispatch maps (WP-289 / EC-321 / D-24073).
 *
 * The sim's getLegalMoves (ai.legalMoves.ts) can short-circuit to an interactive resolve move
 * when a pending choice is parked; the per-turn loops dispatch the chosen move through a static
 * MOVE_MAP (one in simulation.runner.ts, a duplicate in par.aggregator.ts per RS-10). If a move
 * getLegalMoves can emit has no MOVE_MAP entry, the runner skips it as "unknown" and the pending
 * choice never clears — an infinite within-turn loop (maxTurns bounds turns, not within-turn
 * move-steps; the WP-286 One-Hit-Wonder hang). This guard pins the invariant: every
 * SIMULATION_MOVE_NAMES move MUST be a key in BOTH MOVE_MAPs.
 *
 * Uses node:test + node:assert only. No engine state — pure key-set assertions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIMULATION_MOVE_NAMES } from './ai.legalMoves.js';
import { SIMULATION_RUNNER_MOVE_NAMES } from './simulation.runner.js';
import { PAR_AGGREGATOR_MOVE_NAMES } from './par.aggregator.js';

/** The three resolve moves WP-289 added (resolveDrawOrEmpowered was added by WP-286). */
const WP289_ADDED_MOVES = [
  'resolveKoHeroChoice',
  'resolveOptionalKoReward',
  'resolveVictoryPileCardPick',
] as const;

/** Returns the SIMULATION_MOVE_NAMES entries missing from the given dispatch key set. */
function missingFrom(dispatchKeys: readonly string[]): string[] {
  const keySet = new Set(dispatchKeys);
  const missing: string[] = [];
  for (const moveName of SIMULATION_MOVE_NAMES) {
    if (!keySet.has(moveName)) {
      missing.push(moveName);
    }
  }
  return missing;
}

describe('simulation move-dispatch drift guard (WP-289 / D-24073)', () => {
  it('simulation.runner MOVE_MAP dispatches every SIMULATION_MOVE_NAMES move (AC-1)', () => {
    assert.deepStrictEqual(
      missingFrom(SIMULATION_RUNNER_MOVE_NAMES),
      [],
      'a getLegalMoves-emittable move has no simulation.runner MOVE_MAP entry — it would hang the per-turn loop',
    );
  });

  it('par.aggregator MOVE_MAP dispatches every SIMULATION_MOVE_NAMES move (AC-2)', () => {
    assert.deepStrictEqual(
      missingFrom(PAR_AGGREGATOR_MOVE_NAMES),
      [],
      'a getLegalMoves-emittable move has no par.aggregator MOVE_MAP entry — it would hang the PAR loop',
    );
  });

  it('the three WP-289 resolve moves are dispatchable in BOTH maps (explicit membership)', () => {
    for (const moveName of WP289_ADDED_MOVES) {
      assert.ok(
        SIMULATION_RUNNER_MOVE_NAMES.includes(moveName),
        `${moveName} must be a simulation.runner MOVE_MAP key`,
      );
      assert.ok(
        PAR_AGGREGATOR_MOVE_NAMES.includes(moveName),
        `${moveName} must be a par.aggregator MOVE_MAP key`,
      );
    }
  });

  it('NEGATIVE: the guard would FAIL if an emittable move lacked a dispatch entry (non-vacuous)', () => {
    const phantom = '__not_a_move__';
    // The real maps do not contain the phantom...
    assert.ok(!SIMULATION_RUNNER_MOVE_NAMES.includes(phantom), 'phantom absent from the runner map');
    assert.ok(!PAR_AGGREGATOR_MOVE_NAMES.includes(phantom), 'phantom absent from the aggregator map');
    // ...so a name list that DID include the phantom would report it missing from the runner map —
    // proving the superset check actually detects a gap rather than passing vacuously.
    const augmentedNames: readonly string[] = [...SIMULATION_MOVE_NAMES, phantom];
    const runnerKeySet = new Set(SIMULATION_RUNNER_MOVE_NAMES);
    const missing: string[] = [];
    for (const moveName of augmentedNames) {
      if (!runnerKeySet.has(moveName)) {
        missing.push(moveName);
      }
    }
    assert.deepStrictEqual(missing, [phantom], 'the superset check detects a move with no dispatch entry');
  });

  it('the two MOVE_MAP key sets agree with each other (same dispatch surface in both loops)', () => {
    assert.deepStrictEqual(
      [...SIMULATION_RUNNER_MOVE_NAMES].sort(),
      [...PAR_AGGREGATOR_MOVE_NAMES].sort(),
      'simulation.runner and par.aggregator MOVE_MAPs must dispatch the same move set',
    );
  });
});
