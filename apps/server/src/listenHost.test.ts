/**
 * Tests for the LISTEN_HOST seam (listenHost.mjs).
 *
 * The bind test listens for real: a 127.0.0.1-bound listener must report
 * 127.0.0.1 as its address, and an unset host must keep the all-interfaces
 * default. The fake app mirrors koa-socket-2's `app.listen` wrapper, which
 * forwards every argument to `http.Server.listen`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AddressInfo, Server } from 'node:net';

import { resolveListenHost, buildLoopbackOrigin, bindListenToHost } from './listenHost.mjs';

/**
 * Builds a Koa-like app whose `listen` forwards its arguments to an
 * `http.Server`, as the boardgame.io SocketIO transport arranges.
 */
function makeForwardingApp(): { listen: (...listenArguments: unknown[]) => Server } {
  const httpServer = createServer();
  const app = {
    listen(...listenArguments: unknown[]): Server {
      httpServer.listen(...(listenArguments as Parameters<Server['listen']>));
      return httpServer;
    },
  };
  return app;
}

/**
 * Calls `app.listen(0, resolve)` the way boardgame.io's `server.run()` does
 * and returns the bound address.
 */
async function listenLikeBoardgameIo(
  app: { listen: (...listenArguments: unknown[]) => Server },
): Promise<{ server: Server; address: AddressInfo }> {
  let server: Server | undefined;
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  if (server === undefined) {
    throw new Error('The fake app did not return an http.Server from listen().');
  }
  return { server, address: server.address() as AddressInfo };
}

describe('resolveListenHost', () => {
  it('returns undefined when LISTEN_HOST is unset or blank', () => {
    assert.equal(resolveListenHost({}), undefined);
    assert.equal(resolveListenHost({ LISTEN_HOST: '' }), undefined);
    assert.equal(resolveListenHost({ LISTEN_HOST: '   ' }), undefined);
  });

  it('returns the trimmed value when LISTEN_HOST is set', () => {
    assert.equal(resolveListenHost({ LISTEN_HOST: ' 127.0.0.1 ' }), '127.0.0.1');
  });

  it('ignores a generic HOST variable', () => {
    assert.equal(resolveListenHost({ HOST: 'la-rehearsal-01' }), undefined);
  });
});

describe('buildLoopbackOrigin', () => {
  it('uses localhost when no host is set (today\'s behavior)', () => {
    assert.equal(buildLoopbackOrigin(undefined, '8000'), 'http://localhost:8000');
  });

  it('uses localhost for wildcard hosts, which cannot be connected to', () => {
    assert.equal(buildLoopbackOrigin('0.0.0.0', '3000'), 'http://localhost:3000');
    assert.equal(buildLoopbackOrigin('::', '3000'), 'http://localhost:3000');
  });

  it('targets the bound address when one is set', () => {
    assert.equal(buildLoopbackOrigin('127.0.0.1', '3000'), 'http://127.0.0.1:3000');
  });

  it('brackets a bare IPv6 address', () => {
    assert.equal(buildLoopbackOrigin('::1', '3000'), 'http://[::1]:3000');
  });
});

describe('bindListenToHost', () => {
  it('binds the listener to 127.0.0.1 when a host is given', async () => {
    const app = makeForwardingApp();
    bindListenToHost(app, '127.0.0.1');
    const { server, address } = await listenLikeBoardgameIo(app);
    try {
      assert.equal(address.address, '127.0.0.1');
      assert.ok(address.port > 0);
    } finally {
      server.close();
    }
  });

  it('leaves listen untouched when no host is given', async () => {
    const app = makeForwardingApp();
    const originalListen = app.listen;
    bindListenToHost(app, undefined);
    assert.equal(app.listen, originalListen);
    const { server, address } = await listenLikeBoardgameIo(app);
    try {
      assert.notEqual(address.address, '127.0.0.1');
    } finally {
      server.close();
    }
  });
});

describe('server.mjs wiring', () => {
  it('binds the listen host before server.run() and derives the loopback origin from it', async () => {
    const serverSourcePath = fileURLToPath(new URL('./server.mjs', import.meta.url));
    const serverSource = await readFile(serverSourcePath, 'utf8');
    const bindIndex = serverSource.indexOf('bindListenToHost(server.app, listenHost);');
    const runIndex = serverSource.indexOf('await server.run(');
    assert.ok(bindIndex !== -1, 'server.mjs no longer calls bindListenToHost(server.app, listenHost).');
    assert.ok(runIndex !== -1, 'server.mjs no longer calls server.run().');
    assert.ok(bindIndex < runIndex, 'bindListenToHost must run before server.run() opens the listener.');
    assert.match(
      serverSource,
      /const autoplayServerUrl = buildLoopbackOrigin\(\s*resolveListenHost\(process\.env\),/,
      "The loopback origin must follow LISTEN_HOST, or a 127.0.0.1-only listener refuses the server's own lobby calls.",
    );
  });
});
