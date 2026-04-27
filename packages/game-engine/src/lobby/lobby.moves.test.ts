/**
 * Tests for lobby phase moves: setPlayerReady and startMatchIfReady.
 *
 * Uses inline mock contexts (not makeMockCtx) because lobby moves need
 * FnContext with events.setPhase and ctx.currentPlayer, which makeMockCtx
 * does not provide.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LobbyState } from './lobby.types.js';
import { setPlayerReady } from './lobby.moves.js';
import { startMatchIfReady } from './lobby.moves.js';

/**
 * Creates a fresh LobbyState for testing.
 *
 * @param requiredPlayers - Number of players required to start.
 * @returns A fresh LobbyState with no players ready.
 */
function createTestLobbyState(requiredPlayers: number): LobbyState {
  return {
    requiredPlayers,
    ready: {},
    started: false,
  };
}

/**
 * Creates a minimal G object containing only the lobby field.
 *
 * @param requiredPlayers - Number of players required to start.
 * @returns A partial game state with a lobby field.
 */
function createTestGameState(requiredPlayers: number): { lobby: LobbyState } {
  return { lobby: createTestLobbyState(requiredPlayers) };
}

describe('setPlayerReady', () => {
  it('sets G.lobby.ready[playerID] to true when called with { ready: true }', () => {
    const gameState = createTestGameState(2);
    // why: per D-10010, the move uses `playerID` from FnContext (the
    // authenticated dispatching player), not `ctx.currentPlayer` (the
    // turn-holder). Tests mock both for completeness; the assertion
    // checks the dispatching player's slot.
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      playerID: '0',
      events: { setPhase: () => {} },
    };

    setPlayerReady(mockContext as never, { ready: true });

    assert.equal(gameState.lobby.ready['0'], true);
  });

  it('sets G.lobby.ready[playerID] to false when called with { ready: false }', () => {
    const gameState = createTestGameState(2);
    gameState.lobby.ready['0'] = true;
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      playerID: '0',
      events: { setPhase: () => {} },
    };

    setPlayerReady(mockContext as never, { ready: false });

    assert.equal(gameState.lobby.ready['0'], false);
  });

  it('writes to the dispatching player\'s slot, not the turn-holder\'s slot (D-10010)', () => {
    // why: D-10010 regression guard. In multi-active-player phases (lobby
    // with `activePlayers: { all: 'lobbyReady' }`), player 1 dispatches
    // setPlayerReady but ctx.currentPlayer remains '0'. The move MUST
    // write to ready['1'], not ready['0'] (overwriting). Pre-D-10010
    // the move used ctx.currentPlayer and silently wrote to the wrong
    // slot, leaving validateCanStartMatch unable to count player 1+ as
    // ready and blocking the lobby → play transition forever.
    const gameState = createTestGameState(2);
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      playerID: '1',
      events: { setPhase: () => {} },
    };

    setPlayerReady(mockContext as never, { ready: true });

    assert.equal(
      gameState.lobby.ready['1'],
      true,
      'player 1 dispatching must write to ready["1"]',
    );
    assert.equal(
      gameState.lobby.ready['0'],
      undefined,
      'player 1 dispatching must NOT write to ready["0"] (the turn-holder)',
    );
  });

  it('does not mutate G when args contain a non-boolean ready value', () => {
    const gameState = createTestGameState(2);
    const originalLobby = JSON.stringify(gameState.lobby);
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      playerID: '0',
      events: { setPhase: () => {} },
    };

    setPlayerReady(mockContext as never, { ready: 'yes' } as never);

    assert.equal(
      JSON.stringify(gameState.lobby),
      originalLobby,
      'G.lobby must not be mutated when args are invalid',
    );
  });
});

describe('startMatchIfReady', () => {
  it('sets started to true and calls setPhase when all players are ready', () => {
    const gameState = createTestGameState(2);
    gameState.lobby.ready['0'] = true;
    gameState.lobby.ready['1'] = true;
    let setPhaseCalled = false;
    let setPhaseTarget = '';
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      events: {
        setPhase: (phase: string) => {
          setPhaseCalled = true;
          setPhaseTarget = phase;
        },
      },
    };

    startMatchIfReady(mockContext as never);

    assert.equal(gameState.lobby.started, true, 'G.lobby.started must be true');
    assert.equal(setPhaseCalled, true, 'ctx.events.setPhase must be called');
    assert.equal(setPhaseTarget, 'play', 'Phase target must be "play"');
  });

  it('does not mutate G when not all players are ready', () => {
    const gameState = createTestGameState(2);
    gameState.lobby.ready['0'] = true;
    const originalStarted = gameState.lobby.started;
    let setPhaseCalled = false;
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      events: {
        setPhase: () => { setPhaseCalled = true; },
      },
    };

    startMatchIfReady(mockContext as never);

    assert.equal(
      gameState.lobby.started,
      originalStarted,
      'G.lobby.started must not be mutated when not all players are ready',
    );
    assert.equal(setPhaseCalled, false, 'ctx.events.setPhase must not be called');
  });

  it('G.lobby remains JSON-serializable after all operations', () => {
    const gameState = createTestGameState(2);
    const mockContext = {
      G: gameState,
      ctx: { currentPlayer: '0' },
      events: { setPhase: () => {} },
    };

    // Set player ready
    setPlayerReady(mockContext as never, { ready: true });

    // Attempt invalid args
    setPlayerReady(mockContext as never, { ready: 'yes' } as never);

    // Set second player ready
    const mockContext1 = {
      G: gameState,
      ctx: { currentPlayer: '1' },
      events: { setPhase: () => {} },
    };
    setPlayerReady(mockContext1 as never, { ready: true });

    // Start match
    startMatchIfReady(mockContext as never);

    // Verify JSON-serializable
    const serialized = JSON.stringify(gameState.lobby);
    assert.ok(serialized, 'JSON.stringify(G.lobby) must produce a non-empty string');

    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(
      deserialized,
      gameState.lobby,
      'G.lobby must survive JSON round-trip without data loss',
    );
  });
});
