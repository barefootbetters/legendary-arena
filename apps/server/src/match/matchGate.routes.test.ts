/**
 * Tests for the WP-307 multiplayer-play authentication gate.
 *
 * Pure unit tests: a fake router captures the registered handlers, a fake
 * `requireAuthenticatedSession` stands in for the WP-112 orchestrator, and
 * `globalThis.fetch` is stubbed so the native-lobby delegation is observed
 * without a running server. No boardgame.io import, no network, no DB.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { registerMatchGateRoutes } from './matchGate.routes.js';
import type { MatchGateDependencies } from './matchGate.routes.js';

// why: the auth fake never reads the database, but the WP-333 join path calls
// recordSeatAccount(database), so tests inject a fake pg pool. `noopDatabase`
// satisfies the tests that do not inspect the seat-recording write; the
// per-test spy / failing fakes below exercise the WP-333 assertions.
const noopDatabase = {
  query: async () => ({ rows: [], rowCount: 1 }),
} as unknown as never;

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

/** A fake pg pool whose `query` records every call (for asserting the UPSERT). */
function makeSpyDatabase(): { database: never; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
  } as unknown as never;
  return { database, queries };
}

/** A fake pg pool whose `query` throws — exercises the best-effort record path. */
function makeFailingDatabase(): never {
  return {
    query: async () => {
      throw new Error('Simulated database failure recording the seat account.');
    },
  } as unknown as never;
}

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

interface StubbedFetchCall {
  url: string;
  init: RequestInit | undefined;
}

const serverUrl = 'http://localhost:8000';

const authenticatedDeps: MatchGateDependencies = {
  requireAuthenticatedSession: async () => ({ ok: true, value: 'acct-1' }),
  serverUrl,
};

const unauthenticatedDeps: MatchGateDependencies = {
  requireAuthenticatedSession: async () => ({
    ok: false,
    reason: 'no bearer token supplied',
    code: 'missing_token',
  }),
  serverUrl,
};

/**
 * Registers the routes with a capturing fake router and returns the
 * handler map keyed by path.
 */
function collectRoutes(
  deps: MatchGateDependencies,
  database: never = noopDatabase,
): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const router = {
    post(path: string, handler: Handler): void {
      handlers.set(path, handler);
    },
    get(path: string, handler: Handler): void {
      handlers.set(path, handler);
    },
  };
  registerMatchGateRoutes(router as never, database, deps);
  return handlers;
}

/**
 * Builds a fake Koa context carrying the given request body.
 */
function makeContext(body: unknown): FakeContext {
  return {
    req: { headers: { authorization: 'Bearer test-token' } },
    request: { body },
    status: 0,
    body: undefined,
    headers: {},
    set(field: string, value: string): void {
      this.headers[field] = value;
    },
  };
}

let originalFetch: typeof globalThis.fetch | undefined;
let fetchCalls: StubbedFetchCall[] = [];

function installFetchStub(status: number, responseBody: unknown): void {
  fetchCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
}

function restoreFetch(): void {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
  }
}

describe('matchGate.routes (WP-307)', () => {
  afterEach(() => {
    restoreFetch();
  });

  test('registers the two guarded endpoints plus the unguarded setup-requirements read — autoplay/spectator paths are untouched', () => {
    const handlers = collectRoutes(authenticatedDeps);
    assert.deepEqual(
      [...handlers.keys()].sort(),
      ['/api/match/create', '/api/match/join', '/api/match/setup-requirements'],
    );
  });

  test('GET /api/match/setup-requirements returns the full player-count table without auth (WP-371)', async () => {
    // why: guest endpoint — no session is required to read the game's setup
    // rules. The lobby uses it for the pre-submit warn; the engine remains the
    // authoritative block.
    const handlers = collectRoutes(unauthenticatedDeps);
    const koaContext = makeContext(undefined);

    await handlers.get('/api/match/setup-requirements')!(koaContext);

    assert.equal(koaContext.status, 200);
    const body = koaContext.body as {
      requirements: Record<string, { villainGroupCount: number; henchmenGroupCount: number; villainDeckBystanderCount: number; heroCount: number }>;
    };
    assert.deepEqual(Object.keys(body.requirements).sort(), ['1', '2', '3', '4', '5']);
    assert.deepEqual(body.requirements[3], {
      villainGroupCount: 3,
      henchmenGroupCount: 1,
      villainDeckBystanderCount: 8,
      heroCount: 5,
    });
    assert.equal(body.requirements[5]?.heroCount, 6);
    assert.equal(koaContext.headers['Cache-Control'], 'public, max-age=3600');
  });

  test('POST /api/match/create without a valid session returns 401 and never delegates', async () => {
    installFetchStub(200, { matchID: 'should-not-be-created' });
    const handlers = collectRoutes(unauthenticatedDeps);
    const koaContext = makeContext({ numPlayers: 2, setupData: {} });

    await handlers.get('/api/match/create')!(koaContext);

    assert.equal(koaContext.status, 401);
    assert.match(
      (koaContext.body as { error: string }).error,
      /signed-in account is required/,
    );
    // why: the gate rejects before the native lobby is ever contacted.
    assert.equal(fetchCalls.length, 0);
  });

  test('POST /api/match/create with a valid session delegates to the native lobby and returns matchID', async () => {
    installFetchStub(200, { matchID: 'match-99' });
    const handlers = collectRoutes(authenticatedDeps);
    const koaContext = makeContext({
      numPlayers: 3,
      setupData: { schemeId: 'core/midtown-bank-robbery' },
    });

    await handlers.get('/api/match/create')!(koaContext);

    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { matchID: 'match-99' });
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0]!.url,
      'http://localhost:8000/games/legendary-arena/create',
    );
    const sentBody = JSON.parse(String(fetchCalls[0]!.init?.body)) as {
      numPlayers: number;
      setupData: { schemeId: string };
    };
    assert.equal(sentBody.numPlayers, 3);
    assert.deepEqual(sentBody.setupData, {
      schemeId: 'core/midtown-bank-robbery',
    });
  });

  test('POST /api/match/join without a valid session returns 401 and never delegates', async () => {
    installFetchStub(200, { playerCredentials: 'should-not-issue' });
    const handlers = collectRoutes(unauthenticatedDeps);
    const koaContext = makeContext({
      matchID: 'match-99',
      playerID: '0',
      playerName: 'Alice',
    });

    await handlers.get('/api/match/join')!(koaContext);

    assert.equal(koaContext.status, 401);
    assert.equal(fetchCalls.length, 0);
  });

  test('POST /api/match/join with a valid session delegates (matchID in body) and returns playerCredentials', async () => {
    installFetchStub(200, { playerCredentials: 'secret-1' });
    const handlers = collectRoutes(authenticatedDeps);
    const koaContext = makeContext({
      matchID: 'match-99',
      playerID: '0',
      playerName: 'Alice',
    });

    await handlers.get('/api/match/join')!(koaContext);

    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { playerCredentials: 'secret-1' });
    assert.equal(
      fetchCalls[0]!.url,
      'http://localhost:8000/games/legendary-arena/match-99/join',
    );
    const sentBody = JSON.parse(String(fetchCalls[0]!.init?.body)) as {
      playerID: string;
      playerName: string;
    };
    assert.equal(sentBody.playerID, '0');
    assert.equal(sentBody.playerName, 'Alice');
  });

  test('POST /api/match/join records the seat→account mapping with the SESSION accountId', async () => {
    installFetchStub(200, { playerCredentials: 'secret-1' });
    const { database, queries } = makeSpyDatabase();
    const handlers = collectRoutes(authenticatedDeps, database);
    const koaContext = makeContext({
      matchID: 'match-99',
      playerID: '0',
      playerName: 'Alice',
    });

    await handlers.get('/api/match/join')!(koaContext);

    assert.equal(koaContext.status, 200);
    // why: exactly one DB write — the seat UPSERT — with the session accountId
    // ('acct-1' from authenticatedDeps), the body playerID, and the matchID.
    assert.equal(queries.length, 1);
    assert.match(queries[0]!.sql, /INSERT INTO legendary\.match_seat_accounts/);
    assert.deepEqual(queries[0]!.params, ['match-99', '0', 'acct-1']);
  });

  test('POST /api/match/join uses the session accountId, ignoring any client-supplied accountId (anti-spoof)', async () => {
    installFetchStub(200, { playerCredentials: 'secret-1' });
    const { database, queries } = makeSpyDatabase();
    const handlers = collectRoutes(authenticatedDeps, database);
    const koaContext = makeContext({
      matchID: 'match-99',
      playerID: '0',
      playerName: 'Alice',
      // A malicious client attempts to attribute the seat to another account.
      accountId: 'attacker-account',
    });

    await handlers.get('/api/match/join')!(koaContext);

    assert.equal(koaContext.status, 200);
    assert.equal(queries.length, 1);
    // The recorded account is the server-verified session value, not the body.
    assert.equal(queries[0]!.params[2], 'acct-1');
  });

  test('POST /api/match/join still returns 200 when recording the seat fails (best-effort)', async () => {
    installFetchStub(200, { playerCredentials: 'secret-1' });
    const handlers = collectRoutes(authenticatedDeps, makeFailingDatabase());
    const koaContext = makeContext({
      matchID: 'match-99',
      playerID: '0',
      playerName: 'Alice',
    });

    await handlers.get('/api/match/join')!(koaContext);

    // why: the player is already seated on the native side; a seat-record
    // failure is logged and swallowed, never converted into a join error.
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { playerCredentials: 'secret-1' });
  });

  test('POST /api/match/join with a valid session but no matchID returns 400 and never delegates', async () => {
    installFetchStub(200, { playerCredentials: 'should-not-issue' });
    const handlers = collectRoutes(authenticatedDeps);
    const koaContext = makeContext({ playerID: '0', playerName: 'Alice' });

    await handlers.get('/api/match/join')!(koaContext);

    assert.equal(koaContext.status, 400);
    assert.match((koaContext.body as { error: string }).error, /"matchID"/);
    assert.equal(fetchCalls.length, 0);
  });
});
