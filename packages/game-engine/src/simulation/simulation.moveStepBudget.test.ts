/**
 * simulation.moveStepBudget.test.ts — the within-turn move-step budget
 * (WP-554 / EC-589 / D-24363).
 *
 * `MAX_TURNS_PER_GAME` (and the `maxTurns` parameter) bound whole TURNS, and
 * `turnsElapsed` advances ONLY when an endTurn actually fires. A policy that
 * keeps choosing a move the reducer refuses therefore spins inside a single
 * turn forever — no turn cap can out-wait it. Ten prior packets (WP-286,
 * WP-289, WP-427, WP-470, WP-476, WP-479, WP-486, WP-498, WP-532, WP-538) each
 * fixed one instance of that shape by naming one more move; this budget bounds
 * the class.
 *
 * These tests drive the REAL runner with a stub policy that always returns the
 * same refused move — a legitimate INPUT to the loop. They deliberately do NOT
 * reproduce via a seeded board: that repro depends on a specific
 * (scheme, mastermind, seed, turn-depth) cell, is slow, and would silently stop
 * exercising the budget the moment card data or the shuffle changed.
 *
 * why the assertion is "it returns at all": before the budget, this call never
 * terminates. A hanging test is the failure mode.
 *
 * Runner: node:test (native Node.js). No boardgame.io imports. No
 * @legendary-arena/registry imports — the game-engine layer must not import the
 * registry, so the mock reader below mirrors `simulation.captureMoves.test.ts`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';
import type { AIPolicy, LegalMove } from './ai.types.js';

import { simulateOneGameAndCaptureMoves } from './simulation.runner.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';

/** The maximum decisions one wedged turn may consume, per the runner's constant. */
const EXPECTED_BUDGET = 100;

/**
 * Builds a valid 9-field MatchSetupConfig fixture.
 *
 * Mirrors `createTestConfig` in `simulation.captureMoves.test.ts` so the
 * fixture semantics stay aligned with the canonical simulation test pattern.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Minimal CardRegistryReader returning an empty card list. Same stub as
 * `simulation.captureMoves.test.ts` and `simulation.test.ts`.
 */
function createMockRegistry(): CardRegistryReader {
  return { ...makeCardRegistryReader(),
    listCards: () => [],
  };
}

/**
 * A policy that ALWAYS returns the same non-endTurn move, whether or not it is
 * legal — the divergence under test in its purest form. The loop dispatches,
 * the move guard refuses, nothing mutates, and the next step enumerates an
 * identical list.
 *
 * @param decisionCounter - Mutable counter incremented on every decideTurn call.
 * @returns An AIPolicy suitable for simulateOneGameAndCaptureMoves.
 */
function createAlwaysRefusedPolicy(decisionCounter: { calls: number }): AIPolicy {
  return {
    name: 'always-refused-stub',
    decideTurn(_view: UIState, _legalMoves: LegalMove[]): ClientTurnIntent {
      decisionCounter.calls += 1;
      // why: city slot 99 can never be occupied, so the fightVillain guard refuses
      // on every step — a guaranteed no-progress dispatch that never ends the turn.
      return { move: { name: 'fightVillain', args: { cityIndex: 99 } } } as ClientTurnIntent;
    },
  } as unknown as AIPolicy;
}

describe('simulation within-turn move-step budget (WP-554 / D-24363)', () => {
  test('a policy that always returns a refused move TERMINATES instead of spinning', () => {
    const decisionCounter = { calls: 0 };

    const captured = simulateOneGameAndCaptureMoves(
      createTestConfig(),
      createMockRegistry(),
      [createAlwaysRefusedPolicy(decisionCounter)],
      'wp554-budget',
      0,
      50,
    );

    assert.ok(captured !== undefined, 'the simulation returned rather than hanging');
    assert.ok(decisionCounter.calls > 0, 'the stub policy was actually consulted');
  });

  test('bounds the spin near one turn of budget, NOT maxTurns x budget', () => {
    const decisionCounter = { calls: 0 };

    simulateOneGameAndCaptureMoves(
      createTestConfig(),
      createMockRegistry(),
      [createAlwaysRefusedPolicy(decisionCounter)],
      'wp554-budget',
      0,
      50,
    );

    // why: the stuck-break sets turnsElapsed = maxTurns and breaks, so the loop
    // exits during the FIRST wedged turn. This is the assertion that separates a
    // real per-turn bound from a per-game one: 50 turns x 100 steps would be 5000.
    assert.ok(
      decisionCounter.calls <= EXPECTED_BUDGET + 1,
      `expected the spin bounded near ${EXPECTED_BUDGET} decisions, saw ${decisionCounter.calls}`,
    );
  });

  test('records the wedged game as stuck, with a bounded capture', () => {
    const decisionCounter = { calls: 0 };

    const captured = simulateOneGameAndCaptureMoves(
      createTestConfig(),
      createMockRegistry(),
      [createAlwaysRefusedPolicy(decisionCounter)],
      'wp554-budget',
      0,
      50,
    );

    assert.equal(captured.endgameReached, false, 'a stuck game did not reach an endgame');

    // why: the recorder excludes dispatches with an UNKNOWN moveFn, but a REFUSED
    // move is not one of those — `fightVillain` is a real entry in the MOVE_MAP and
    // the reducer's silent void return is indistinguishable from success at this
    // layer. That indistinguishability is the entire reason this budget exists
    // rather than a "detect the no-op" check. So the capture is non-empty; what
    // matters is that it is BOUNDED.
    assert.ok(
      (captured.moves ?? []).length <= EXPECTED_BUDGET,
      `a wedged turn must not capture more than the budget, saw ${(captured.moves ?? []).length}`,
    );
  });
});
