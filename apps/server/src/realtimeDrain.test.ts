/**
 * Tests for the shutdown drain seam (realtimeDrain.mjs).
 *
 * Runs a real boardgame.io Server with one websocket client connected, the
 * state a deploy's SIGTERM meets whenever a player is online. The client is
 * Node's built-in WebSocket speaking engine.io's websocket transport, so the
 * test needs no socket.io-client dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';

import { closeRealtimeConnections } from './realtimeDrain.mjs';

// why: boardgame.io v0.50 ships only a CJS server bundle; server.mjs loads it
// the same way.
const require = createRequire(import.meta.url);
const { Server } = require('boardgame.io/server');

// why: long enough that a close() blocked on an open websocket is unmistakable,
// short enough to keep the suite fast. The drained close finishes in a few ms.
const CLOSE_WAIT_MS = 1500;

/**
 * Starts a boardgame.io server on an ephemeral port with one websocket client
 * attached, and returns both.
 */
async function startServerWithConnectedClient(): Promise<{
  appServer: HttpServer;
  socketServer: { engine: { close: () => void } };
  client: WebSocket;
}> {
  const game = { name: 'drain-test', setup: () => ({}) };
  const server = Server({ games: [game] });
  const { appServer } = await server.run({ port: 0 });
  const port = (appServer.address() as AddressInfo).port;
  const client = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
  await new Promise<void>((resolve, reject) => {
    client.addEventListener('open', () => resolve());
    client.addEventListener('error', () => reject(new Error('The test websocket could not connect to the boardgame.io server.')));
  });
  // why: boardgame.io attaches socket.io to the Koa app as `_io` and reads it
  // back from there itself; index.mjs reaches it the same way.
  const socketServer = (server.app as unknown as { _io: { engine: { close: () => void } } })._io;
  return { appServer, socketServer, client };
}

/**
 * Calls `appServer.close()` and resolves true if its callback fires within
 * `waitMs`, false otherwise.
 */
function closeFinishesWithin(appServer: HttpServer, waitMs: number, beforeWait: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), waitMs);
    appServer.close(() => {
      clearTimeout(timer);
      resolve(true);
    });
    beforeWait();
  });
}

describe('closeRealtimeConnections', () => {
  it('without it, an open websocket keeps http.Server.close() from finishing', async () => {
    const { appServer, socketServer, client } = await startServerWithConnectedClient();
    try {
      const finished = await closeFinishesWithin(appServer, CLOSE_WAIT_MS, () => {
        // why: closeAllConnections() is Node's own answer; it does not reach an
        // upgraded websocket, which is why the seam exists.
        appServer.closeAllConnections();
      });
      assert.equal(finished, false, 'close() should still be waiting on the websocket');
    } finally {
      closeRealtimeConnections(socketServer);
      client.close();
    }
  });

  it('closes the websocket so http.Server.close() finishes and the client socket closes', async () => {
    const { appServer, socketServer, client } = await startServerWithConnectedClient();
    const clientClosed = new Promise<void>((resolve) => client.addEventListener('close', () => resolve()));
    const finished = await closeFinishesWithin(appServer, CLOSE_WAIT_MS, () => {
      closeRealtimeConnections(socketServer);
    });
    assert.equal(finished, true, 'close() should finish once the websocket is closed');
    await clientClosed;
  });

  it('is a no-op without a socket server', () => {
    assert.doesNotThrow(() => closeRealtimeConnections(undefined));
    assert.doesNotThrow(() => closeRealtimeConnections({}));
  });
});
