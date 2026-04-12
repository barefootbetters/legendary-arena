/**
 * Recruit hero move tests for WP-016.
 *
 * Verifies recruitHero follows the three-step validation contract,
 * gates to main stage, removes heroes from HQ to discard pile,
 * and handles invalid inputs gracefully.
 *
 * Uses node:test and node:assert only. Uses makeMockCtx. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recruitHero } from './recruitHero.js';
import type { LegendaryGameState } from '../types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { TURN_STAGES } from '../turn/turnPhases.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for recruit tests.
 * HQ has a hero at the specified index. Player 0 has empty zones.
 */
function createMockGameState(options?: {
  hq?: LegendaryGameState['hq'];
  currentStage?: LegendaryGameState['currentStage'];
}): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
    piles: {
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    city: initializeCity(),
    hq: options?.hq ?? initializeHq(),
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
  };
}

/**
 * Creates a mock MoveContext for recruitHero.
 */
function createMockMoveContext(gameState: LegendaryGameState) {
  const mockCtx = makeMockCtx({ numPlayers: 1 });
  return {
    G: gameState,
    ctx: {
      ...mockCtx.ctx,
      currentPlayer: '0',
      phase: 'play',
      turn: 1,
      numMoves: 0,
      playOrder: ['0'],
      playOrderPos: 0,
      activePlayers: null,
    },
    random: mockCtx.random,
    events: { endTurn: () => {}, setPhase: () => {}, endGame: () => {} },
    playerID: '0' as string,
    log: { setMetadata: () => {} },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recruitHero', () => {
  it('removes card from G.hq[hqIndex]', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, 'hero-c', null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.hq[0],
      null,
      'HQ slot 0 must be null after recruit',
    );
  });

  it('removed card appears in player discard zone', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.ok(
      moveContext.G.playerZones['0']!.discard.includes('hero-a'),
      'hero-a must be in player 0 discard zone',
    );
  });

  it('invalid hqIndex (out of range): no mutation', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const hqBefore = [...moveContext.G.hq];

    recruitHero(moveContext, { hqIndex: 5 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for index 5');

    recruitHero(moveContext, { hqIndex: -1 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for index -1');

    recruitHero(moveContext, { hqIndex: 2.5 });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for non-integer');

    recruitHero(moveContext, { hqIndex: NaN });
    assert.deepStrictEqual(moveContext.G.hq, hqBefore, 'HQ unchanged for NaN');
  });

  it('empty HQ slot (null): no mutation', () => {
    const gameState = createMockGameState({
      hq: [null, null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    const discardBefore = moveContext.G.playerZones['0']!.discard.length;

    recruitHero(moveContext, { hqIndex: 2 });

    assert.equal(
      moveContext.G.playerZones['0']!.discard.length,
      discardBefore,
      'Discard zone must not change when recruiting from empty slot',
    );
  });

  it('wrong stage (cleanup): no mutation', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
      currentStage: 'cleanup',
    });

    const moveContext = createMockMoveContext(gameState);
    const hqBefore = [...moveContext.G.hq];
    const messagesBefore = moveContext.G.messages.length;

    recruitHero(moveContext, { hqIndex: 0 });

    assert.deepStrictEqual(
      moveContext.G.hq,
      hqBefore,
      'HQ must not change when stage is not main',
    );
    assert.equal(
      moveContext.G.messages.length,
      messagesBefore,
      'No messages when stage gate blocks',
    );
  });

  it('JSON.stringify(G) succeeds after recruit', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', 'hero-b', null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 1 });

    const serialized = JSON.stringify(moveContext.G);
    assert.ok(serialized, 'JSON.stringify(G) must produce a non-empty string');
  });

  it('idempotence: second call on same index is no-op', () => {
    const gameState = createMockGameState({
      hq: ['hero-a', null, null, null, null],
    });

    const moveContext = createMockMoveContext(gameState);
    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(moveContext.G.playerZones['0']!.discard.length, 1, 'One card in discard after first recruit');

    recruitHero(moveContext, { hqIndex: 0 });

    assert.equal(
      moveContext.G.playerZones['0']!.discard.length,
      1,
      'Discard unchanged after second recruit on same (now null) slot',
    );
  });
});
