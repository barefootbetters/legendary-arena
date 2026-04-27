import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LegendaryGame } from './game.js';
import type { MatchConfiguration } from './types.js';
import { makeMockCtx } from './test/mockCtx.js';

/**
 * Creates a valid mock MatchConfiguration for testing.
 *
 * All values are plausible ext_id strings and counts that satisfy the
 * MatchConfiguration interface. These are not real card ext_ids — they exist
 * only to exercise the setup contract.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001', 'test-villain-group-002'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

describe('LegendaryGame', () => {
  it('setup() returns a JSON-serializable game state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    // why: boardgame.io 0.50.x setup receives (context, setupData) where
    // context includes { ctx, random, events, log }. makeMockCtx provides
    // the minimal shape needed by buildInitialGameState.
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    // G must be JSON-serializable at all times — no functions, classes, Maps,
    // Sets, Dates, or Symbols. If this throws, the game state contract is broken.
    const serialized = JSON.stringify(gameState);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');

    // Round-trip: parse the serialized state and verify it matches the original.
    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized,
      gameState,
      'Game state must survive JSON round-trip without data loss',
    );
  });

  it('setup() includes all 9 MatchConfiguration fields in the returned state', () => {
    const mockConfiguration = createMockMatchConfiguration();

    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      mockConfiguration,
    );

    assert.equal(gameState.matchConfiguration.schemeId, 'test-scheme-001');
    assert.equal(gameState.matchConfiguration.mastermindId, 'test-mastermind-001');
    assert.deepStrictEqual(gameState.matchConfiguration.villainGroupIds, ['test-villain-group-001', 'test-villain-group-002']);
    assert.deepStrictEqual(gameState.matchConfiguration.henchmanGroupIds, ['test-henchman-group-001']);
    assert.deepStrictEqual(gameState.matchConfiguration.heroDeckIds, ['test-hero-deck-001', 'test-hero-deck-002', 'test-hero-deck-003']);
    assert.equal(gameState.matchConfiguration.bystandersCount, 30);
    assert.equal(gameState.matchConfiguration.woundsCount, 30);
    assert.equal(gameState.matchConfiguration.officersCount, 30);
    assert.equal(gameState.matchConfiguration.sidekicksCount, 0);
  });

  it('setup() throws when matchConfiguration is not provided', () => {
    const mockContext = makeMockCtx({ numPlayers: 2 });
    assert.throws(
      () => {
        LegendaryGame.setup!(
          mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
          undefined,
        );
      },
      {
        message: /requires a MatchConfiguration argument/,
      },
    );
  });

  it('defines exactly 4 phases: lobby, setup, play, end', () => {
    const phaseNames = Object.keys(LegendaryGame.phases ?? {});
    assert.deepStrictEqual(
      phaseNames.sort(),
      ['end', 'lobby', 'play', 'setup'],
      'LegendaryGame must define exactly 4 phases: lobby, setup, play, end',
    );
  });

  it('defines moves: advanceStage, drawCards, endTurn, fightMastermind, fightVillain, playCard, recruitHero, and revealVillainCard', () => {
    const moveNames = Object.keys(LegendaryGame.moves ?? {});
    assert.deepStrictEqual(
      moveNames.sort(),
      ['advanceStage', 'drawCards', 'endTurn', 'fightMastermind', 'fightVillain', 'playCard', 'recruitHero', 'revealVillainCard'],
      'LegendaryGame must define exactly 8 moves',
    );
  });

  it('configures lobby phase with activePlayers: { all: null } per D-10007', () => {
    // why: drift-detection lock for the WP-100 fix-forward (D-10007). Without
    // this config, boardgame.io rejects setPlayerReady / startMatchIfReady
    // from any player other than ctx.currentPlayer with "player not active",
    // making lobby ready-up impossible for player 1+. The literal
    // `{ all: null }` is the value of boardgame.io's ActivePlayers.ALL
    // (verified in turn-order-*.js where ALL: { all: Stage.NULL } and
    // Stage.NULL: null). Inlined as a literal because boardgame.io v0.50
    // proxy-directory subpaths don't resolve under Node's native ESM.
    const phases = LegendaryGame.phases as
      | Record<string, { turn?: { activePlayers?: unknown } }>
      | undefined;
    const lobbyPhase = phases?.lobby;
    assert.notEqual(
      lobbyPhase,
      undefined,
      'lobby phase must be configured on LegendaryGame',
    );
    assert.deepStrictEqual(
      lobbyPhase?.turn?.activePlayers,
      { all: null },
      'lobby phase turn.activePlayers must be { all: null } per D-10007 — without it, only the turn-holder can submit setPlayerReady/startMatchIfReady',
    );
  });
});
