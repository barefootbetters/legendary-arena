/**
 * Contract enforcement tests for LegendaryGame.playerView (WP-089).
 *
 * These tests are contract enforcement tests. They are not examples, not
 * smoke tests, and not illustrative. If tests fail, the implementation is
 * incorrect by definition. Do NOT weaken assertions to make tests pass —
 * fix the implementation instead.
 *
 * Uses node:test and node:assert only. No boardgame.io/testing import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LegendaryGame } from './game.js';
import { buildUIState } from './ui/uiState.build.js';
import { filterUIStateForAudience } from './ui/uiState.filter.js';
import { buildInitialGameState } from './setup/buildInitialGameState.js';
import { makeMockCtx } from './test/mockCtx.js';
import type { MatchSetupConfig } from './matchSetup.types.js';
import type { CardRegistryReader } from './matchSetup.validate.js';

/**
 * Valid test MatchSetupConfig. Mirrors uiState.build.test.ts:27-38.
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
 * Minimal mock registry — UIState tests do not require card validation.
 */
function createMockRegistry(): CardRegistryReader {
  return { listCards: () => [] };
}

// why: ctxLike is a test-only inline literal matching the boardgame.io Ctx
// subset that buildPlayerView reads (phase, turn, currentPlayer). Cast
// `as any` is narrowed to the playerView! call sites only — production
// wiring uses the NonNullable<Game<LegendaryGameState>['playerView']>
// anchor at the field assignment, not here. makeMockCtx is used for the
// SetupContext needed by buildInitialGameState; the dual-context pattern
// mirrors uiState.build.test.ts:52-56 per RS-2.
const ctxLike = {
  phase: 'play' as const,
  turn: 1,
  currentPlayer: '0',
  numPlayers: 2,
};

describe('LegendaryGame.playerView (WP-089)', () => {
  it('returns a UIState deep-equal to filterUIStateForAudience(buildUIState(G, ctxLike), player("0")) when playerID is "0"', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const expected = filterUIStateForAudience(
      buildUIState(gameState, ctxLike),
      { kind: 'player', playerId: '0' },
    );
    const actual = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: '0',
    });
    assert.deepStrictEqual(actual, expected);
  });

  it('returns spectator projection when playerID is null', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const expected = filterUIStateForAudience(
      buildUIState(gameState, ctxLike),
      { kind: 'spectator' },
    );
    const actual = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: null,
    });
    assert.deepStrictEqual(actual, expected);
  });

  it('returns spectator projection when playerID is undefined (identical to null case)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const expected = filterUIStateForAudience(
      buildUIState(gameState, ctxLike),
      { kind: 'spectator' },
    );
    const nullProjection = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: null,
    });
    // why: the boardgame.io 0.50.2 type declares playerID as PlayerID | null,
    // but certain transport paths (REST / single-player) may dispatch undefined
    // at runtime. The typeof check in buildPlayerView defends against both.
    // Cast through unknown to exercise the runtime path the type system forbids.
    const undefinedProjection = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: undefined as unknown as null,
    });
    assert.deepStrictEqual(undefinedProjection, expected);
    assert.deepStrictEqual(undefinedProjection, nullProjection);
  });

  it('is deterministic: two calls with identical inputs produce deep-equal results', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const first = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: '0',
    });
    const second = LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: '0',
    });
    assert.deepStrictEqual(first, second);
  });

  it('does not mutate its gameState argument (JSON.stringify identical before/after)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const pre = JSON.stringify(gameState);
    LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: '0',
    });
    const post = JSON.stringify(gameState);
    assert.strictEqual(pre, post);
  });

  it('does not mutate its ctx argument (JSON.stringify identical before/after)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx({ numPlayers: 2 }));
    const pre = JSON.stringify(ctxLike);
    LegendaryGame.playerView!({
      G: gameState,
      ctx: ctxLike as any,
      playerID: '0',
    });
    const post = JSON.stringify(ctxLike);
    assert.strictEqual(pre, post);
  });
});
