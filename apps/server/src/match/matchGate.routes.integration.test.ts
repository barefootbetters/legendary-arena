/**
 * Integration test for the WP-307 guarded match-gate routes (with the WP-308
 * internal-delegation secret).
 *
 * UNLIKE `matchGate.routes.test.ts` — which injects `request.body` into a fake
 * context and therefore never exercises body parsing — this test stands up a
 * REAL boardgame.io `Server` on an ephemeral port and sends a REAL HTTP request
 * with a JSON body, so the route's `koaBody()` wiring is genuinely exercised.
 *
 * It is the regression guard for the class of bug where `request.body` is
 * `undefined` because no body parser is attached: boardgame.io installs
 * koa-body only on its own `/games/*` routes, so the guarded `/api/match/*`
 * routes must attach their own. When that was missing, the client's `setupData`
 * was forwarded to the native lobby as `undefined` and `Game.setup` rejected
 * the create with "Missing setupData" — the 400 that shipped and was fixed in
 * PR #551. The delegating `fetch` to the native lobby is stubbed and captured,
 * so the test asserts that BOTH the client's `setupData` and the WP-308
 * internal-delegation secret reach the delegated request.
 *
 * A live server is used deliberately (contra the unit-test norm): the defect
 * lives in the Koa middleware wiring, which a hand-built fake context cannot
 * faithfully reproduce — koa-body reads several real Koa context accessors
 * (`ctx.method`, the raw request stream, `ctx.request`) that only a genuine
 * server provides. Scoped to an ephemeral port (no collisions) and torn down in
 * `after`, so it stays self-contained and needs no live external service.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { Server as HttpServer } from 'node:http';

import { registerMatchGateRoutes } from './matchGate.routes.js';
import type { MatchGateDependencies } from './matchGate.routes.js';
import { INTERNAL_DELEGATION_HEADER } from './nativeLobbyGuard.js';

// why: boardgame.io v0.50 ships a CJS-only server bundle; createRequire bridges
// ESM → CJS exactly as `server.mjs` and `autoplay.mjs` do.
const require = createRequire(import.meta.url);
const { Server } = require('boardgame.io/server') as {
  Server: (options: unknown) => {
    router: { post(path: string, handler: unknown): unknown };
    run(config: { port: number }): Promise<{ appServer: HttpServer }>;
  };
};

const INTERNAL_SECRET = 'integration-test-secret';

// why: an always-accepting session provider — this test is about body parsing
// and delegation, not the auth branch (that is covered by the unit test).
const acceptingDeps: MatchGateDependencies = {
  requireAuthenticatedSession: async () => ({ ok: true, value: 'acct-1' }),
  serverUrl: 'http://internal.invalid',
  internalDelegationSecret: INTERNAL_SECRET,
};

interface CapturedDelegation {
  url: string;
  body: { numPlayers?: unknown; setupData?: unknown; playerID?: unknown } | null;
  internalHeader: string | undefined;
}

let appServer: HttpServer;
let port: number;
let originalFetch: typeof globalThis.fetch;
let capturedDelegation: CapturedDelegation | null;

/**
 * Installs a fetch stub that captures the server's loopback delegation to the
 * native lobby (`/games/legendary-arena/*`) and returns a canned success, while
 * letting the test's own client request to `/api/match/*` pass through to the
 * real running server.
 */
function installDelegationCapturingFetch(): void {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const requestUrl = String(input);
    if (requestUrl.includes('/games/legendary-arena/')) {
      const headers = new Headers(init?.headers);
      capturedDelegation = {
        url: requestUrl,
        body:
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as CapturedDelegation['body'])
            : null,
        internalHeader: headers.get(INTERNAL_DELEGATION_HEADER) ?? undefined,
      };
      return new Response(
        JSON.stringify({ matchID: 'match-int-1', playerCredentials: 'cred-1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;
}

/**
 * Sends a real HTTP POST with a JSON body to the running server.
 */
async function postJson(path: string, body: unknown): Promise<Response> {
  return originalFetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('matchGate.routes integration (real request stream)', () => {
  before(async () => {
    // why: a trivial game named "legendary-arena" is enough — the delegation is
    // stubbed, so the game's setup is never actually reached; the game only
    // makes Server() valid so its koa app + router exist.
    const trivialGame = {
      name: 'legendary-arena',
      setup: () => ({}),
      moves: { noop: () => {} },
    };
    const server = Server({
      games: [trivialGame],
      origins: ['http://localhost:1'],
    });
    installDelegationCapturingFetch();
    registerMatchGateRoutes(
      server.router as never,
      {} as never,
      acceptingDeps,
    );
    const running = await server.run({ port: 0 });
    appServer = running.appServer;
    const address = appServer.address();
    // why: address() is an AddressInfo object for a listening TCP server; the
    // ephemeral port lands here.
    port = typeof address === 'object' && address !== null ? address.port : 0;
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => appServer.close(() => resolve()));
  });

  beforeEach(() => {
    capturedDelegation = null;
  });

  test('POST /api/match/create parses the JSON body and forwards setupData to the native delegation', async () => {
    const setupData = {
      schemeId: 'core/midtown-bank-robbery',
      mastermindId: 'core/loki',
      villainGroupIds: ['core/hydra'],
    };

    const response = await postJson('/api/match/create', {
      numPlayers: 3,
      setupData,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { matchID: 'match-int-1' });

    // why: the whole point — the delegated request must carry the exact
    // setupData the client sent, NOT undefined. A missing body parser (the
    // PR #551 bug) makes this deepEqual fail with setupData === undefined.
    assert.notEqual(capturedDelegation, null);
    assert.deepEqual(capturedDelegation!.body!.setupData, setupData);
    assert.equal(capturedDelegation!.body!.numPlayers, 3);
    assert.ok(
      capturedDelegation!.url.endsWith('/games/legendary-arena/create'),
    );
    // why: the WP-308 internal-delegation secret must ride along so the native
    // hard gate admits the loopback call.
    assert.equal(capturedDelegation!.internalHeader, INTERNAL_SECRET);
  });

  test('POST /api/match/join parses the JSON body and forwards the matchID + secret to the native delegation', async () => {
    const response = await postJson('/api/match/join', {
      matchID: 'match-int-1',
      playerID: '0',
      playerName: 'Alice',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { playerCredentials: 'cred-1' });

    assert.notEqual(capturedDelegation, null);
    // why: matchID travels in the request body to the guarded route and in the
    // URL path to the native route — proves the body was parsed (else matchID
    // would be empty and the handler would 400 before delegating).
    assert.ok(
      capturedDelegation!.url.endsWith('/games/legendary-arena/match-int-1/join'),
    );
    assert.equal(capturedDelegation!.body!.playerID, '0');
    assert.equal(capturedDelegation!.internalHeader, INTERNAL_SECRET);
  });

  test('POST /api/match/join with a body but no matchID returns 400 and never delegates', async () => {
    const response = await postJson('/api/match/join', {
      playerID: '0',
      playerName: 'Alice',
    });

    assert.equal(response.status, 400);
    // why: reaching the 400 (rather than an undefined-body crash) proves the
    // body was parsed and the missing-matchID guard ran.
    assert.equal(capturedDelegation, null);
  });
});
