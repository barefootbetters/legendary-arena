/**
 * Contract enforcement tests for UIGameOverState.par under the WP-067 D-6701
 * safe-skip.
 *
 * `buildParBreakdown` returns `undefined` unconditionally at MVP. The four
 * tests below pin this invariant from every angle that matters:
 *
 * - phase !== 'end': gameOver is absent entirely, so par is implicitly absent.
 * - phase === 'end' + no scoringConfig: gate would block the future payload;
 *   par stays absent today.
 * - phase === 'end' + scoringConfig present: even both runtime gates passing
 *   does not surface a payload (proves `buildParBreakdown` body is
 *   unconditionally `return undefined;`).
 * - determinism: two invocations on identical inputs produce structurally
 *   equal gameOver projections, with par absent in both.
 *
 * No numeric payload assertions — the payload is deferred until the follow-up
 * WP supplies a `ReplayResult`.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUIState } from './uiState.build.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { LegendaryGameState, ScenarioScoringConfig } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';

/**
 * Creates a valid test MatchSetupConfig.
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

function createMockRegistry(): CardRegistryReader {
  return { listCards: () => [] };
}

/**
 * Constructs a minimal but fully populated ScenarioScoringConfig so that
 * `G.activeScoringConfig` can be set on the test state. Field values are
 * non-load-bearing under D-6701 — the safe-skip body never reads them.
 */
function createTestScoringConfig(): ScenarioScoringConfig {
  return {
    scenarioKey: 'test-scenario-001',
    weights: {
      roundCost: 100,
      bystanderReward: 200,
      victoryPointReward: 50,
    },
    caps: {
      bystanderCap: null,
      victoryPointCap: null,
    },
    penaltyEventWeights: {
      villainEscaped: 100,
      bystanderLost: 300,
      schemeTwistNegative: 50,
      mastermindTacticUntaken: 25,
      scenarioSpecificPenalty: 10,
    },
    parBaseline: {
      roundsPar: 10,
      bystandersPar: 5,
      victoryPointsPar: 30,
      escapesPar: 1,
    },
    scoringConfigVersion: 1,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  };
}

/**
 * Builds a LegendaryGameState with no scoring config (default path).
 */
function createPlainGameState(): LegendaryGameState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  return buildInitialGameState(config, registry, setupContext);
}

/**
 * Builds a LegendaryGameState with `activeScoringConfig` populated via the
 * D-6703 fourth positional parameter on `buildInitialGameState`.
 */
function createPaRGameState(): LegendaryGameState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const scoringConfig = createTestScoringConfig();
  return buildInitialGameState(config, registry, setupContext, scoringConfig);
}

/**
 * Forces evaluateEndgame to return a non-null result by tripping the
 * mastermind-defeated condition. Used for tests that need `gameOver` itself
 * to exist so we can prove `par` is absent on it.
 */
function tripEndgame(gameState: LegendaryGameState): void {
  gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;
}

describe('UIState PAR breakdown (WP-067, D-6701 safe-skip)', () => {
  it('omits par when phase !== end and the game has not ended', () => {
    const gameState = createPlainGameState();
    const ctx = { phase: 'play' as string | null, turn: 1, currentPlayer: '0' };

    const result = buildUIState(gameState, ctx);

    // why: with no endgame trigger, gameOver itself is absent — and so par
    // is unreachable. Both checks must hold.
    assert.equal(result.gameOver, undefined);
    assert.equal(result.gameOver?.par, undefined);
  });

  it('omits par at phase === end when activeScoringConfig is undefined', () => {
    const gameState = createPlainGameState();
    tripEndgame(gameState);
    const ctx = { phase: 'end' as string | null, turn: 1, currentPlayer: '0' };

    // Sanity: confirm the test fixture really lacks the config.
    assert.equal(gameState.activeScoringConfig, undefined);

    const result = buildUIState(gameState, ctx);

    assert.notEqual(
      result.gameOver,
      undefined,
      'tripEndgame should have triggered evaluateEndgame',
    );
    assert.equal(result.gameOver?.par, undefined);
  });

  it('omits par even when phase === end AND activeScoringConfig is present (safe-skip invariant)', () => {
    const gameState = createPaRGameState();
    tripEndgame(gameState);
    const ctx = { phase: 'end' as string | null, turn: 1, currentPlayer: '0' };

    // Sanity: confirm both runtime gates pass; only the D-6701 body keeps par
    // absent.
    assert.notEqual(gameState.activeScoringConfig, undefined);

    const result = buildUIState(gameState, ctx);

    assert.notEqual(result.gameOver, undefined);
    // why: this is the load-bearing invariant — buildParBreakdown returns
    // `undefined` unconditionally per D-6701, regardless of the runtime gates.
    // The follow-up WP modifies only the helper body, not this projection.
    assert.equal(result.gameOver?.par, undefined);
    assert.ok(
      result.gameOver !== undefined && !('par' in result.gameOver),
      'par must be omitted entirely (not present as undefined) under D-6701',
    );
  });

  it('produces structurally equal gameOver projections on identical inputs (par absent in both)', () => {
    const gameState = createPaRGameState();
    tripEndgame(gameState);
    const ctx = { phase: 'end' as string | null, turn: 1, currentPlayer: '0' };

    const first = buildUIState(gameState, ctx);
    const second = buildUIState(gameState, ctx);

    assert.deepStrictEqual(first.gameOver, second.gameOver);
    assert.equal(first.gameOver?.par, undefined);
    assert.equal(second.gameOver?.par, undefined);
  });
});
