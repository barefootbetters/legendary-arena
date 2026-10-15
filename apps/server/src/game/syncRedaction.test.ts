/**
 * Outbound `sync` redaction (WP-809 / D-24715).
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';
import { installSyncRedaction, redactOutgoingSyncArgs } from './syncRedaction.mjs';
import { installClientActionGuard } from './clientActionGuard.mjs';
import { serverLegendaryGame } from './matchSeed.mjs';

const require = createRequire(import.meta.url);
const { ProcessGameConfig, InitializeGame } = require('boardgame.io/internal');
const { Server } = require('boardgame.io/server');
// why: socket.io-client is boardgame.io's own dependency (same bridge as
// clientActionGuard.test.ts).
const requireFromBoardgameIo = createRequire(require.resolve('boardgame.io/multiplayer'));
const { io: connectSocket } = requireFromBoardgameIo('socket.io-client');

const SEAT_ID = '0';
const SEAT_CREDENTIALS = 'seat-0-test-credentials';
const PROBE_SEED = 'sync-redaction-probe-seed';

// why: the empty-registry test ids clientActionGuard.test.ts uses.
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

const runningServers: Array<{ server: { kill: (handles: unknown) => void }; handles: unknown }> = [];
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
 * Starts a real boardgame.io Server() with one stored solo match.
 *
 * @param matchID - The match id.
 * @param isRedacted - Whether to install the sync redaction.
 * @returns The server port.
 */
async function startServer(matchID: string, isRedacted: boolean): Promise<number> {
  const server = Server({ games: [LegendaryGame] });
  if (isRedacted) {
    installSyncRedaction(server, [LegendaryGame]);
  }
  const game = ProcessGameConfig({ ...LegendaryGame, seed: PROBE_SEED });
  const initialState = structuredClone(InitializeGame({ game, numPlayers: 1, setupData: SETUP_DATA }));
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
  runningServers.push({ server, handles });
  return handles.appServer.address().port;
}

/**
 * Connects to the game namespace, sends `sync`, and returns the answer.
 *
 * @param port - The server port.
 * @param matchID - The match id.
 * @param playerID - The seat, or null for a spectator.
 * @param credentials - The seat credentials, if any.
 * @returns The `sync` event arguments the server sent.
 */
async function syncAs(port: number, matchID: string, playerID: string | null, credentials?: string) {
  const socket = connectSocket(`http://localhost:${port}/${LegendaryGame.name}`, { transports: ['websocket'] });
  openSockets.push(socket);
  const answer = new Promise<unknown[]>((resolve) => {
    socket.once('sync', (...args: unknown[]) => resolve(args));
  });
  socket.emit('sync', matchID, playerID, credentials, 1);
  return answer;
}

describe('redactOutgoingSyncArgs', () => {
  it('drops initialState from a sync frame and keeps everything else', () => {
    const syncInfo = { state: { G: {} }, log: [], filteredMetadata: [], initialState: { seed: 'x' } };
    const [matchID, redacted] = redactOutgoingSyncArgs('sync', ['match-1', syncInfo]) as [string, Record<string, unknown>];
    assert.equal(matchID, 'match-1');
    assert.equal('initialState' in redacted, false);
    assert.deepEqual(Object.keys(redacted).sort(), ['filteredMetadata', 'log', 'state']);
    assert.equal(redacted.log, syncInfo.log);
    assert.deepEqual(redacted.state, syncInfo.state);
    assert.ok('initialState' in syncInfo, 'the original object is not mutated');
  });

  it('passes every other event through unchanged', () => {
    const eventArgs = ['match-1', { initialState: { seed: 'x' } }];
    assert.equal(redactOutgoingSyncArgs('update', eventArgs), eventArgs);
  });
});

describe('the real socket sync answer', () => {
  // why: an exposure pin. It documents that boardgame.io 0.50.2's sync answer
  // passes the raw initialState past its player-view filter; if an upgrade
  // starts redacting it, this fails and says so (D-24715).
  it('exposure pin: unredacted, a spectator sync carries the seed and the initial G', async () => {
    const port = await startServer('sync-exposure', false);
    const [, syncInfo] = (await syncAs(port, 'sync-exposure', null)) as [string, { initialState?: { plugins: { random: { data: { seed: string } } } } }];
    assert.equal(syncInfo.initialState?.plugins.random.data.seed, PROBE_SEED);
  });

  it('redacted, a spectator sync carries no initialState and no seed', async () => {
    const port = await startServer('sync-spectator', true);
    const args = await syncAs(port, 'sync-spectator', null);
    const syncInfo = args[1] as Record<string, unknown>;
    assert.equal('initialState' in syncInfo, false);
    assert.ok(syncInfo.state, 'the filtered state is still delivered');
    assert.deepEqual(Object.keys(syncInfo).sort(), ['filteredMetadata', 'log', 'state'], 'only initialState is dropped');
    assert.ok(Array.isArray(syncInfo.log));
    assert.equal(JSON.stringify(args).includes(PROBE_SEED), false);
  });

  it('the production wiring (serverLegendaryGame, guard, redaction) still plays real moves', async () => {
    const server = Server({ games: [serverLegendaryGame] });
    installClientActionGuard(server, [serverLegendaryGame]);
    installSyncRedaction(server, [serverLegendaryGame]);
    const matchID = 'sync-production-wiring';
    const initialState = structuredClone(
      InitializeGame({ game: { ...serverLegendaryGame, seed: PROBE_SEED }, numPlayers: 1, setupData: SETUP_DATA }),
    );
    server.db.createMatch(matchID, {
      initialState,
      metadata: { gameName: LegendaryGame.name, players: { [SEAT_ID]: { id: 0, credentials: SEAT_CREDENTIALS } }, createdAt: 0, updatedAt: 0 },
    });
    const handles = await server.run({ port: 0 });
    runningServers.push({ server, handles });
    const port = handles.appServer.address().port;
    const socket = connectSocket(`http://localhost:${port}/${LegendaryGame.name}`, { transports: ['websocket'] });
    openSockets.push(socket);
    const syncAnswer = new Promise<unknown[]>((resolve) => socket.once('sync', (...args: unknown[]) => resolve(args)));
    socket.emit('sync', matchID, SEAT_ID, SEAT_CREDENTIALS, 1);
    assert.equal(JSON.stringify(await syncAnswer).includes(PROBE_SEED), false);

    const readState = () => server.db.fetch(matchID, { state: true }).state;
    for (const [moveName, moveArgs] of [['setPlayerReady', [{ ready: true }]], ['startMatchIfReady', []]] as const) {
      const stateIDBefore = readState()._stateID;
      const action = { type: 'MAKE_MOVE', payload: { type: moveName, args: moveArgs, playerID: SEAT_ID, credentials: SEAT_CREDENTIALS } };
      socket.emit('update', action, stateIDBefore, matchID, SEAT_ID);
      const deadline = Date.now() + 5000;
      while (readState()._stateID === stateIDBefore && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(readState()._stateID > stateIDBefore, `the ${moveName} move committed`);
    }
    assert.equal(readState().ctx.phase, 'play');
  });

  it('redacted, a seated sync carries no initialState and no seed', async () => {
    const port = await startServer('sync-seated', true);
    const args = await syncAs(port, 'sync-seated', SEAT_ID, SEAT_CREDENTIALS);
    const syncInfo = args[1] as Record<string, unknown>;
    assert.equal('initialState' in syncInfo, false);
    assert.ok(syncInfo.state, 'the filtered state is still delivered');
    assert.deepEqual(Object.keys(syncInfo).sort(), ['filteredMetadata', 'log', 'state'], 'only initialState is dropped');
    assert.ok(Array.isArray(syncInfo.log));
    assert.equal(JSON.stringify(args).includes(PROBE_SEED), false);
  });
});
