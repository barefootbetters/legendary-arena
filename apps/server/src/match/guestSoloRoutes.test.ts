/**
 * Tests for the WP-787 guest solo route (`POST /api/match/create-guest-solo`).
 *
 * Pure unit tests mirroring the guestAccessRoutes harness: a capturing fake
 * router, a fake Koa context, a spy pg pool and a spy bgio store (both must stay
 * untouched), and a stubbed `globalThis.fetch` standing in for the native-lobby
 * loopback. No boardgame.io import, no network, no live DB.
 *
 * The route properties pinned here:
 *   - one native create (secret, 1 player, the featured table, unlisted) and one
 *     native join (seat '0' as Guest), and the locked 200 shape;
 *   - a client body never reaches the native calls;
 *   - the rate limit (429) and the capacity cap (503) run before any fetch;
 *   - a native or network failure records no capacity entry;
 *   - the key-source log fires once and never names the IP;
 *   - the featured table is legal at 1 player and honors Magneto's Always Leads.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { checkPlayerCountComposition } from '@legendary-arena/registry/playerCountSetup';

import { registerGuestSoloRoutes, GUEST_SOLO_FEATURED_TABLE } from './guestSoloRoutes.mjs';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown; ip?: string };
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

interface FetchCall {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
}

const serverUrl = 'http://localhost:8000';
const internalDelegationSecret = 'test-secret';
const CLIENT_IP = '198.51.100.4';

let originalFetch: typeof globalThis.fetch | undefined;
let fetchCalls: FetchCall[] = [];

/**
 * Replaces `globalThis.fetch` with a responder. The responder sees each URL and
 * returns a Response, or throws to simulate an unreachable game server.
 */
function installFetchStub(responder: (url: string) => Response): void {
  fetchCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      payload: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return responder(url);
  }) as typeof globalThis.fetch;
}

/** A native lobby that creates `match-1` and grants `cred-1` for seat 0. */
function succeedingLobby(url: string): Response {
  if (url.endsWith('/create')) {
    return Response.json({ matchID: 'match-1' });
  }
  return Response.json({ playerID: '0', playerCredentials: 'cred-1' });
}

afterEach(() => {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
});

/** A spy that records every method call made on it, whatever the method name. */
function makeSpy(): { spy: never; calls: string[] } {
  const calls: string[] = [];
  const spy = new Proxy(
    {},
    {
      get: (_target, property) => (...callArguments: unknown[]) => {
        calls.push(`${String(property)}(${callArguments.length})`);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
    },
  ) as never;
  return { spy, calls };
}

function makeContext(options?: { body?: unknown; connectingIp?: string }): FakeContext {
  const headers: Record<string, string> = {};
  if (options?.connectingIp !== undefined) {
    headers['cf-connecting-ip'] = options.connectingIp;
  }
  return {
    req: { headers },
    request: { body: options?.body, ip: '10.0.0.1' },
    status: 0,
    body: undefined,
    headers: {},
    set(field: string, value: string): void {
      this.headers[field] = value;
    },
  };
}

/**
 * Registers the route against a capturing router and returns its handler plus the
 * spy pool / spy store call logs.
 */
function registerRoute(overrides?: Record<string, unknown>): {
  routes: { method: string; path: string }[];
  handler: Handler;
  poolCalls: string[];
  storeCalls: string[];
} {
  const routes: { method: string; path: string; handler: Handler }[] = [];
  const router = {
    post(path: string, handler: Handler) {
      routes.push({ method: 'POST', path, handler });
    },
    get(path: string, handler: Handler) {
      routes.push({ method: 'GET', path, handler });
    },
  };
  const pool = makeSpy();
  const store = makeSpy();
  registerGuestSoloRoutes(router as never, {
    serverUrl,
    internalDelegationSecret,
    database: pool.spy,
    db: store.spy,
    ...overrides,
  });
  return { routes, handler: routes[0].handler, poolCalls: pool.calls, storeCalls: store.calls };
}

/** Runs `body` with console.log / console.error captured and silenced. */
async function withCapturedConsole(body: (lines: string[]) => Promise<void>): Promise<void> {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...parts: unknown[]) => lines.push(parts.join(' '));
  console.error = (...parts: unknown[]) => lines.push(parts.join(' '));
  try {
    await body(lines);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe('guest solo route (WP-787)', () => {
  test('registers POST /api/match/create-guest-solo', () => {
    const { routes } = registerRoute();
    assert.equal(routes.length, 1);
    assert.equal(routes[0].method, 'POST');
    assert.equal(routes[0].path, '/api/match/create-guest-solo');
  });

  test('a success creates one featured 1-player unlisted match, joins seat 0 as Guest, returns the locked shape', async () => {
    installFetchStub(succeedingLobby);
    const { handler } = registerRoute();
    const koaContext = makeContext({ connectingIp: CLIENT_IP });
    await withCapturedConsole(async () => handler(koaContext));

    assert.equal(fetchCalls.length, 2);
    const [createCall, joinCall] = fetchCalls;
    assert.equal(createCall.url, `${serverUrl}/games/legendary-arena/create`);
    assert.equal(createCall.headers['x-legendary-internal-delegation'], internalDelegationSecret);
    assert.deepEqual(createCall.payload, {
      numPlayers: 1,
      setupData: JSON.parse(JSON.stringify(GUEST_SOLO_FEATURED_TABLE)),
      unlisted: true,
    });
    assert.equal(joinCall.url, `${serverUrl}/games/legendary-arena/match-1/join`);
    assert.equal(joinCall.headers['x-legendary-internal-delegation'], internalDelegationSecret);
    assert.deepEqual(joinCall.payload, { playerID: '0', playerName: 'Guest' });

    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { matchId: 'match-1', seat: '0', credentials: 'cred-1' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('a client body with setupData, numPlayers, and playerName is ignored', async () => {
    installFetchStub(succeedingLobby);
    const { handler } = registerRoute();
    const koaContext = makeContext({
      connectingIp: CLIENT_IP,
      body: {
        setupData: { schemeId: 'core/secret-invasion-of-the-skrull-shapeshifters' },
        numPlayers: 5,
        playerName: 'Admin',
      },
    });
    await withCapturedConsole(async () => handler(koaContext));

    assert.equal(koaContext.status, 200);
    assert.equal(fetchCalls[0].payload.numPlayers, 1);
    assert.deepEqual(fetchCalls[0].payload.setupData, JSON.parse(JSON.stringify(GUEST_SOLO_FEATURED_TABLE)));
    assert.equal(fetchCalls[1].payload.playerName, 'Guest');
  });

  test('neither the pg pool nor the bgio store is touched on success or failure', async () => {
    installFetchStub(succeedingLobby);
    const { handler, poolCalls, storeCalls } = registerRoute({ guestSoloRateLimitCapacity: 1 });
    await withCapturedConsole(async () => {
      await handler(makeContext({ connectingIp: CLIENT_IP }));
      await handler(makeContext({ connectingIp: CLIENT_IP }));
    });
    assert.deepEqual(poolCalls, []);
    assert.deepEqual(storeCalls, []);
  });

  test('over the rate limit → 429 with no fetch; the key-source log fires once and never names the IP', async () => {
    installFetchStub(succeedingLobby);
    const { handler } = registerRoute({ guestSoloRateLimitCapacity: 1 });
    const firstContext = makeContext({ connectingIp: CLIENT_IP });
    const secondContext = makeContext({ connectingIp: CLIENT_IP });
    let logLines: string[] = [];
    await withCapturedConsole(async (lines) => {
      await handler(firstContext);
      await handler(secondContext);
      logLines = lines;
    });

    assert.equal(firstContext.status, 200);
    assert.equal(fetchCalls.length, 2, 'the 429 request sent no fetch');
    assert.equal(secondContext.status, 429);
    assert.deepEqual(secondContext.body, {
      error: 'Too many guest matches were started from this connection. Please wait a minute and try again.',
    });
    assert.equal(secondContext.headers['Cache-Control'], 'no-store');

    const sourceLines = logLines.filter((line) => line.startsWith('[guest-solo] rate-limit key source:'));
    assert.deepEqual(sourceLines, ['[guest-solo] rate-limit key source: cf-connecting-ip']);
    for (const line of logLines) {
      assert.equal(line.includes(CLIENT_IP), false, 'no log line names the client IP');
    }
  });

  test('at capacity → 503 with no fetch', async () => {
    installFetchStub(succeedingLobby);
    const { handler } = registerRoute({ maxActiveGuestSoloMatches: 1 });
    const firstContext = makeContext({ connectingIp: CLIENT_IP });
    const secondContext = makeContext({ connectingIp: '203.0.113.9' });
    await withCapturedConsole(async () => {
      await handler(firstContext);
      await handler(secondContext);
    });

    assert.equal(firstContext.status, 200);
    assert.equal(fetchCalls.length, 2, 'the 503 request sent no fetch');
    assert.equal(secondContext.status, 503);
    assert.deepEqual(secondContext.body, {
      error: 'Guest play is at capacity right now. Please sign in to play, or try again in a few minutes.',
    });
  });

  test('a capacity entry older than the active window is pruned and a create succeeds', async () => {
    installFetchStub(succeedingLobby);
    let currentTime = 1_000_000;
    const { handler } = registerRoute({ maxActiveGuestSoloMatches: 1, now: () => currentTime });
    const contexts = [makeContext({ connectingIp: CLIENT_IP }), makeContext({ connectingIp: CLIENT_IP }), makeContext({ connectingIp: CLIENT_IP })];
    await withCapturedConsole(async () => {
      await handler(contexts[0]);
      currentTime += 7_199_999;
      await handler(contexts[1]);
      currentTime += 1;
      await handler(contexts[2]);
    });

    assert.equal(contexts[0].status, 200);
    assert.equal(contexts[1].status, 503, 'still inside the two-hour window');
    assert.equal(contexts[2].status, 200, 'the entry aged out at the window boundary');
  });

  test('a native 400 on create passes the status with the locked prefix, skips the join, and records no capacity entry', async () => {
    let shouldFailCreate = true;
    installFetchStub((url) => {
      if (url.endsWith('/create') && shouldFailCreate) {
        return new Response('Setup requires 1 villain groups.', { status: 400 });
      }
      return succeedingLobby(url);
    });
    const { handler } = registerRoute({ maxActiveGuestSoloMatches: 1 });
    const failedContext = makeContext({ connectingIp: CLIENT_IP });
    const followUpContext = makeContext({ connectingIp: CLIENT_IP });
    await withCapturedConsole(async () => {
      await handler(failedContext);
      assert.equal(fetchCalls.length, 1, 'no join after a failed create');
      shouldFailCreate = false;
      await handler(followUpContext);
    });

    assert.equal(failedContext.status, 400);
    assert.deepEqual(failedContext.body, {
      error: 'The guest match could not be created. Setup requires 1 villain groups.',
    });
    assert.equal(followUpContext.status, 200, 'the failed create used no capacity');
  });

  test('a thrown fetch → 502 and records no capacity entry', async () => {
    let isGameServerDown = true;
    installFetchStub((url) => {
      if (isGameServerDown) {
        throw new TypeError('fetch failed');
      }
      return succeedingLobby(url);
    });
    const { handler } = registerRoute({ maxActiveGuestSoloMatches: 1 });
    const failedContext = makeContext({ connectingIp: CLIENT_IP });
    const followUpContext = makeContext({ connectingIp: CLIENT_IP });
    await withCapturedConsole(async () => {
      await handler(failedContext);
      isGameServerDown = false;
      await handler(followUpContext);
    });

    assert.equal(failedContext.status, 502);
    assert.deepEqual(failedContext.body, {
      error:
        'The guest match could not be created because the game server did not respond. Please retry in a moment.',
    });
    assert.equal(followUpContext.status, 200, 'the failed request used no capacity');
  });

  test('the featured table is legal at 1 player and honors Magneto\'s Always Leads', async () => {
    const mismatches = checkPlayerCountComposition({ ...GUEST_SOLO_FEATURED_TABLE, playerCount: 1 } as never);
    assert.deepEqual(mismatches, []);

    const coreSetPath = new URL('../../../../data/cards/core.json', import.meta.url);
    const coreSet = JSON.parse(await readFile(coreSetPath, 'utf8')) as {
      masterminds: { slug: string; alwaysLeads: string[] }[];
    };
    const magneto = coreSet.masterminds.find((mastermind) => mastermind.slug === 'magneto');
    assert.ok(magneto, 'Magneto is in the core set');
    const tableVillainSlugs = GUEST_SOLO_FEATURED_TABLE.villainGroupIds.map((villainGroupId: string) =>
      villainGroupId.replace('core/', ''),
    );
    for (const alwaysLeadsSlug of magneto.alwaysLeads) {
      assert.ok(tableVillainSlugs.includes(alwaysLeadsSlug), `Always Leads group ${alwaysLeadsSlug} is on the table`);
    }
    assert.equal(GUEST_SOLO_FEATURED_TABLE.mastermindId, 'core/magneto');
  });
});
