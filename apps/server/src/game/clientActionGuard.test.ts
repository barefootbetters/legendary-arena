/**
 * Client action allowlist for the boardgame.io socket transport (D-24701).
 *
 * Three layers, all on the real LegendaryGame:
 *
 * 1. Exposure pins. boardgame.io's real Master applies a raw client
 *    GAME_EVENT (setPhase, endGame) and a whole-state UPDATE for an active
 *    seat. These pin the framework behaviour the guard exists for; if a
 *    boardgame.io upgrade starts refusing them, these fail and say so.
 * 2. The pure allowlist: only MAKE_MOVE passes.
 * 3. The real socket path: a boardgame.io Server() on an ephemeral port, the
 *    real Socket.IO client sending crafted `update` packets. Without the guard
 *    a raw setPhase('play') takes the lobby straight to play; with it the
 *    crafted packets are dropped, while setPlayerReady → startMatchIfReady →
 *    revealVillainCard → advanceStage ×2 → endTurn, sent the same way, still
 *    play a turn.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';
import {
  filterClientUpdatePacket,
  installClientActionGuard,
  isClientUpdateActionAllowed,
} from './clientActionGuard.mjs';

// why: boardgame.io v0.50 ships /master, /internal and /server as CJS only
// (same bridge autoplay.mjs and server.mjs use).
const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master');
const { ProcessGameConfig, InitializeGame, Async } = require('boardgame.io/internal');
const { Server } = require('boardgame.io/server');
// why: socket.io-client is boardgame.io's own dependency, not the server's, so
// it is resolved from boardgame.io's install (pnpm keeps it off apps/server).
const requireFromBoardgameIo = createRequire(require.resolve('boardgame.io/multiplayer'));
const { io: connectSocket } = requireFromBoardgameIo('socket.io-client');

const SEAT_ID = '0';
const SEAT_CREDENTIALS = 'seat-0-test-credentials';

// why: the same test ids and empty-registry setup handPlayRefusal.test.ts uses;
// InitializeGame runs the real Game.setup().
const SETUP_DATA = {
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

interface MatchState {
  G: Record<string, unknown>;
  ctx: { phase: string; turn: number; gameover?: unknown; currentPlayer: string };
  _stateID: number;
}

/**
 * Builds a fresh solo match state in the lobby phase via the real setup path.
 *
 * @param seed - The match seed.
 * @returns The initial match state.
 */
function buildLobbyState(seed: string): MatchState {
  const processedGame = ProcessGameConfig({ ...LegendaryGame, seed });
  return InitializeGame({ game: processedGame, numPlayers: 1, setupData: SETUP_DATA });
}

/**
 * Builds a real Master over a one-match in-memory store.
 *
 * @param seed - The match seed.
 * @returns The Master and a handle on the stored state.
 */
function buildMasterMatch(seed: string) {
  const processedGame = ProcessGameConfig({ ...LegendaryGame, seed });
  const stored: { state: MatchState } = { state: buildLobbyState(seed) };
  const store = {
    type: () => Async.prototype.type(),
    fetch: async (_matchId: string, options: { state?: boolean; metadata?: boolean }) => ({
      state: options.state ? stored.state : undefined,
      metadata: options.metadata ? { players: {} } : undefined,
    }),
    setState: async (_matchId: string, state: MatchState) => {
      stored.state = structuredClone(state);
    },
    setMetadata: async () => {},
  };
  const master = new Master(processedGame, store, { send() {}, sendAll() {} }, undefined);
  return { master, stored };
}

describe('boardgame.io Master applies raw client actions (the exposure D-24701 closes)', () => {
  it('a GAME_EVENT setPhase("play") from the seat leaves the lobby without startMatchIfReady', async () => {
    const { master, stored } = buildMasterMatch('exposure-setphase');
    assert.equal(stored.state.ctx.phase, 'lobby');
    await master.onUpdate(
      { type: 'GAME_EVENT', payload: { type: 'setPhase', args: ['play'], playerID: SEAT_ID } },
      stored.state._stateID,
      'exposure-setphase',
      SEAT_ID,
    );
    assert.equal(stored.state.ctx.phase, 'play', 'the raw event moved the match to play');
    const lobby = stored.state.G.lobby as { started: boolean; ready: Record<string, boolean> };
    assert.equal(lobby.started, false, 'startMatchIfReady never ran');
    assert.notEqual(lobby.ready[SEAT_ID], true, 'the seat never readied');
  });

  it('a GAME_EVENT endGame from the seat ends the match', async () => {
    const { master, stored } = buildMasterMatch('exposure-endgame');
    await master.onUpdate(
      { type: 'GAME_EVENT', payload: { type: 'endGame', args: [{ winner: SEAT_ID }], playerID: SEAT_ID } },
      stored.state._stateID,
      'exposure-endgame',
      SEAT_ID,
    );
    assert.deepEqual(stored.state.ctx.gameover, { winner: SEAT_ID });
  });

  it('an UPDATE from the seat replaces the stored state wholesale', async () => {
    const { master, stored } = buildMasterMatch('exposure-update');
    const forgedState = structuredClone(stored.state);
    forgedState.G = { ...forgedState.G, forgedByClient: true };
    await master.onUpdate(
      { type: 'UPDATE', state: forgedState, payload: {} },
      stored.state._stateID,
      'exposure-update',
      SEAT_ID,
    );
    assert.equal(stored.state.G.forgedByClient, true, 'the client-supplied G was stored');
  });
});

describe('isClientUpdateActionAllowed (D-24701)', () => {
  it('admits a MAKE_MOVE action', () => {
    assert.equal(
      isClientUpdateActionAllowed({ type: 'MAKE_MOVE', payload: { type: 'playCard', args: [], playerID: '0' } }),
      true,
    );
  });

  it('rejects every other boardgame.io action type', () => {
    for (const type of ['GAME_EVENT', 'UNDO', 'REDO', 'UPDATE', 'SYNC', 'RESET', 'PATCH', 'PLUGIN', 'STRIP_TRANSIENTS']) {
      assert.equal(isClientUpdateActionAllowed({ type, payload: {} }), false, `${type} must be rejected`);
    }
  });

  it('rejects non-object and type-less actions', () => {
    for (const action of [null, undefined, 'MAKE_MOVE', 7, {}, { type: ['MAKE_MOVE'] }]) {
      assert.equal(isClientUpdateActionAllowed(action), false, `${JSON.stringify(action)} must be rejected`);
    }
  });

  it('passes non-update packets and MAKE_MOVE updates, drops other updates', () => {
    const passed: string[] = [];
    const record = (label: string) => () => passed.push(label);
    filterClientUpdatePacket(['sync', 'match', '0', 'creds'], record('sync'));
    filterClientUpdatePacket(['update', { type: 'MAKE_MOVE', payload: {} }, 1, 'match', '0'], record('move'));
    filterClientUpdatePacket(['update', { type: 'GAME_EVENT', payload: {} }, 1, 'match', '0'], record('event'));
    filterClientUpdatePacket(['update', { type: 'UPDATE', state: {}, payload: {} }, 1, 'match', '0'], record('update'));
    assert.deepEqual(passed, ['sync', 'move']);
  });

  it('throws a full-sentence error when handed something that is not a boardgame.io server', () => {
    assert.throws(() => installClientActionGuard({ app: {} }, [LegendaryGame]), /no Socket\.IO server/);
  });
});

// ---------------------------------------------------------------------------
// Real socket path
// ---------------------------------------------------------------------------

interface RunningServer {
  server: { db: { fetch: (id: string, opts: { state: boolean }) => { state: MatchState } }; kill: (handles: unknown) => void };
  handles: { appServer: { address: () => { port: number } } };
  port: number;
}

const runningServers: RunningServer[] = [];
const openSockets: Array<{ disconnect: () => void }> = [];

after(() => {
  for (const socket of openSockets) {
    socket.disconnect();
  }
  for (const running of runningServers) {
    running.server.kill(running.handles);
  }
});

/**
 * Starts a real boardgame.io Server() on an ephemeral port with one solo
 * lobby match whose seat 0 holds known credentials.
 *
 * @param matchID - The match id to create.
 * @param isGuarded - Whether to install the client action guard.
 * @returns The running server.
 */
async function startGameServer(matchID: string, isGuarded: boolean): Promise<RunningServer> {
  const server = Server({ games: [LegendaryGame] });
  if (isGuarded) {
    installClientActionGuard(server, [LegendaryGame]);
  }
  // why: cloned because InitializeGame returns an Immer-frozen state.
  const initialState = structuredClone(buildLobbyState(matchID));
  // why: the empty test registry deals an empty hero deck, which makes turn 1
  // the deck-exhaustion final turn (D-24159), so endTurn would end the game
  // instead of starting turn 2. A stocked hero deck lets the test see a real
  // turn advance.
  initialState.G.heroDeck = Array.from({ length: 10 }, (_, index) => `test-hero-deck-001/stock-hero#${index}`);
  server.db.createMatch(matchID, {
    initialState,
    metadata: {
      gameName: LegendaryGame.name,
      players: { [SEAT_ID]: { id: 0, credentials: SEAT_CREDENTIALS } },
      createdAt: 0,
      updatedAt: 0,
    },
  });
  const handles = await server.run({ port: 0 });
  const running = { server, handles, port: handles.appServer.address().port };
  runningServers.push(running);
  return running;
}

/**
 * Opens a raw Socket.IO connection to the game namespace, the way a crafted
 * client would.
 *
 * @param port - The server port.
 * @returns The connected socket.
 */
async function connectToGame(port: number) {
  const socket = connectSocket(`http://localhost:${port}/${LegendaryGame.name}`, { transports: ['websocket'] });
  openSockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error: Error) => reject(error));
  });
  return socket;
}

/**
 * Reads the stored match state.
 *
 * @param running - The running server.
 * @param matchID - The match id.
 * @returns The stored state.
 */
function readState(running: RunningServer, matchID: string): MatchState {
  return running.server.db.fetch(matchID, { state: true }).state;
}

/**
 * Polls the stored state until the predicate holds, failing after a timeout.
 *
 * @param running - The running server.
 * @param matchID - The match id.
 * @param predicate - The condition to wait for.
 * @param description - What is being waited for, for the failure message.
 * @returns The state that satisfied the predicate.
 */
async function waitForState(
  running: RunningServer,
  matchID: string,
  predicate: (state: MatchState) => boolean,
  description: string,
): Promise<MatchState> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = readState(running, matchID);
    if (predicate(state)) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out after 5 s waiting for ${description} in match ${matchID}.`);
}

/**
 * Sends one client `update` packet carrying the given action, stamped with
 * the match's current state id.
 *
 * @param socket - The connected socket.
 * @param running - The running server.
 * @param matchID - The match id.
 * @param action - The action to send (credentials are added to its payload).
 */
function sendUpdate(
  socket: { emit: (...args: unknown[]) => void },
  running: RunningServer,
  matchID: string,
  action: { type: string; payload: Record<string, unknown>; state?: unknown },
): void {
  const stateID = readState(running, matchID)._stateID;
  const credentialedAction = { ...action, payload: { ...action.payload, playerID: SEAT_ID, credentials: SEAT_CREDENTIALS } };
  socket.emit('update', credentialedAction, stateID, matchID, SEAT_ID);
}

/**
 * Sends a MAKE_MOVE and waits for the state id to advance past it.
 *
 * @param socket - The connected socket.
 * @param running - The running server.
 * @param matchID - The match id.
 * @param moveName - The move to make.
 * @param args - The move's arguments.
 * @returns The state after the move committed.
 */
async function makeMove(
  socket: { emit: (...args: unknown[]) => void },
  running: RunningServer,
  matchID: string,
  moveName: string,
  args: unknown[],
): Promise<MatchState> {
  const stateIDBefore = readState(running, matchID)._stateID;
  sendUpdate(socket, running, matchID, { type: 'MAKE_MOVE', payload: { type: moveName, args } });
  return waitForState(running, matchID, (state) => state._stateID > stateIDBefore, `the ${moveName} move to commit`);
}

describe('client action guard on the real socket transport (D-24701)', () => {
  it('without the guard, a raw setPhase("play") over the socket skips the lobby (control)', async () => {
    const matchID = 'socket-unguarded';
    const running = await startGameServer(matchID, false);
    const socket = await connectToGame(running.port);
    sendUpdate(socket, running, matchID, { type: 'GAME_EVENT', payload: { type: 'setPhase', args: ['play'] } });
    const state = await waitForState(running, matchID, (current) => current.ctx.phase === 'play', 'the raw setPhase to land');
    assert.equal((state.G.lobby as { started: boolean }).started, false, 'the match reached play without startMatchIfReady');
  });

  it('with the guard, crafted packets are dropped and the real moves still play a turn', async () => {
    const matchID = 'socket-guarded';
    const running = await startGameServer(matchID, true);
    const socket = await connectToGame(running.port);
    const lobbyStateID = readState(running, matchID)._stateID;

    // Crafted lobby packets: each would change the match without the guard.
    sendUpdate(socket, running, matchID, { type: 'GAME_EVENT', payload: { type: 'setPhase', args: ['play'] } });
    sendUpdate(socket, running, matchID, { type: 'GAME_EVENT', payload: { type: 'endGame', args: [{ winner: SEAT_ID }] } });
    sendUpdate(socket, running, matchID, { type: 'UPDATE', state: { forged: true }, payload: {} });

    // why: Socket.IO delivers one socket's packets in order, so once this
    // later move commits, the three crafted packets have already been seen.
    const readyState = await makeMove(socket, running, matchID, 'setPlayerReady', [{ ready: true }]);
    assert.equal(readyState._stateID, lobbyStateID + 1, 'only the real move advanced the state');
    assert.equal(readyState.ctx.phase, 'lobby', 'the raw setPhase was dropped');
    assert.equal(readyState.ctx.gameover, undefined, 'the raw endGame was dropped');

    const playState = await makeMove(socket, running, matchID, 'startMatchIfReady', []);
    assert.equal(playState.ctx.phase, 'play', 'startMatchIfReady still takes the lobby to play');
    assert.equal((playState.G.lobby as { started: boolean }).started, true);
    const firstTurn = playState.ctx.turn;
    assert.equal(playState.G.currentStage, 'start');

    // A raw endTurn event would skip the endTurn move's cleanup-only stage gate.
    sendUpdate(socket, running, matchID, { type: 'GAME_EVENT', payload: { type: 'endTurn', args: [] } });
    const revealedState = await makeMove(socket, running, matchID, 'revealVillainCard', []);
    assert.equal(revealedState.ctx.turn, firstTurn, 'the raw endTurn was dropped');
    assert.equal(revealedState.G.villainRevealedThisTurn, true);
    const mainState = await makeMove(socket, running, matchID, 'advanceStage', []);
    assert.equal(mainState.G.currentStage, 'main');

    const cleanupState = await makeMove(socket, running, matchID, 'advanceStage', []);
    assert.equal(cleanupState.G.currentStage, 'cleanup');
    const nextTurnState = await makeMove(socket, running, matchID, 'endTurn', []);
    assert.equal(nextTurnState.ctx.turn, firstTurn + 1, 'the endTurn move still ends the turn');
    assert.equal(nextTurnState.G.currentStage, 'start');
  });
});
