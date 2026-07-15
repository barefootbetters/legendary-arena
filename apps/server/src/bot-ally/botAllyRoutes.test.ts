/**
 * Tests for the create-with-bot endpoint + bot-ally route wiring
 * (WP-375 / EC-404).
 *
 * Pure unit tests: a fake router captures the handler, a fake
 * `requireAuthenticatedSession` stands in for the WP-112 orchestrator,
 * `globalThis.fetch` is stubbed so the native-lobby create/join delegations are
 * observed without a running server, and a fake pg pool captures the side-table
 * writes. The bot driver's poll is not started (autoStart is irrelevant here —
 * the driver is registered from the real path, so the test stops it in cleanup).
 * No boardgame.io network, no real DB.
 *
 * Covers: body validation (400), auth (401), joins ONLY bot seats via the
 * secret (never seat 0), no seat-account row for a bot seat, the match is NOT
 * started, bot seats are auto-readied, the botSeats tag + seed are persisted,
 * and `matchId` is returned. The credential-metadata reader used by boot
 * re-registration is unit-tested too.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerBotAllyRoutes,
  validateCreateWithBotBody,
  readBotSeatCredentials,
} from './botAllyRoutes.mjs';
import { botAllyDrivers } from './botAllyDriver.mjs';

// why: the create handler registers a real BotAllyDriver (which starts a poll);
// stop + clear every registered driver after each test so no timer leaks into
// the next test or keeps the process alive.
afterEach(() => {
  for (const driver of botAllyDrivers.values()) {
    driver.stop();
  }
  botAllyDrivers.clear();
});

// ---------------------------------------------------------------------------
// validateCreateWithBotBody — pure body validation
// ---------------------------------------------------------------------------

describe('validateCreateWithBotBody', () => {
  const validSetup = { schemeId: 's', mastermindId: 'm' };

  test('accepts a valid body', () => {
    const result = validateCreateWithBotBody({ numPlayers: 2, botCount: 1, policy: 'competent', setupData: validSetup });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { numPlayers: 2, botCount: 1, policy: 'competent', setupData: validSetup });
  });

  test('rejects numPlayers below 2 (a solo match has no bot seat)', () => {
    const result = validateCreateWithBotBody({ numPlayers: 1, botCount: 1, policy: 'competent', setupData: validSetup });
    assert.equal(result.ok, false);
  });

  test('rejects numPlayers above 5', () => {
    assert.equal(validateCreateWithBotBody({ numPlayers: 6, botCount: 1, policy: 'competent', setupData: validSetup }).ok, false);
  });

  test('rejects botCount >= numPlayers (no seat left for the human)', () => {
    assert.equal(validateCreateWithBotBody({ numPlayers: 2, botCount: 2, policy: 'competent', setupData: validSetup }).ok, false);
    assert.equal(validateCreateWithBotBody({ numPlayers: 3, botCount: 3, policy: 'competent', setupData: validSetup }).ok, false);
  });

  test('rejects botCount below 1', () => {
    assert.equal(validateCreateWithBotBody({ numPlayers: 3, botCount: 0, policy: 'competent', setupData: validSetup }).ok, false);
  });

  test('rejects an unknown policy', () => {
    assert.equal(validateCreateWithBotBody({ numPlayers: 2, botCount: 1, policy: 'genius', setupData: validSetup }).ok, false);
  });

  test('rejects a missing setupData', () => {
    assert.equal(validateCreateWithBotBody({ numPlayers: 2, botCount: 1, policy: 'random' }).ok, false);
  });

  test('accepts botCount up to numPlayers - 1 (multi-bot)', () => {
    const result = validateCreateWithBotBody({ numPlayers: 4, botCount: 3, policy: 'random', setupData: validSetup });
    assert.equal(result.ok, true);
    assert.equal(result.value.botCount, 3);
  });
});

// ---------------------------------------------------------------------------
// readBotSeatCredentials — boot re-registration credential reader
// ---------------------------------------------------------------------------

describe('readBotSeatCredentials', () => {
  test('reads each bot seat credential from match metadata', () => {
    const metadata = { players: { '0': {}, '1': { credentials: 'cred-1' }, '2': { credentials: 'cred-2' } } };
    assert.deepEqual(readBotSeatCredentials(metadata, ['1', '2']), { '1': 'cred-1', '2': 'cred-2' });
  });

  test('returns null when a bot seat credential is missing', () => {
    const metadata = { players: { '0': {}, '1': {} } };
    assert.equal(readBotSeatCredentials(metadata, ['1']), null);
  });

  test('returns null when metadata is absent', () => {
    assert.equal(readBotSeatCredentials(null, ['1']), null);
    assert.equal(readBotSeatCredentials(undefined, ['1']), null);
  });
});

// ---------------------------------------------------------------------------
// POST /api/match/create-with-bot — handler
// ---------------------------------------------------------------------------

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

/** A fake pg pool whose `query` records every call. */
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

/** A fake boardgame.io db whose fetch returns a lobby-phase state. */
function makeBgioDb(): unknown {
  return {
    async fetch(_matchId: string, _options: unknown) {
      return { state: { _stateID: 0, ctx: { currentPlayer: '0', phase: 'lobby', turn: 0, numPlayers: 2 } } };
    },
  };
}

/** A fake transport with a no-op pubSub. */
function makeTransport(): unknown {
  return { pubSub: { publish() {} } };
}

/** A fake auth. */
function makeAuth(): unknown {
  return { authenticateCredentials: () => true };
}

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string>; on?: unknown };
  request: { body?: unknown };
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

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

const serverUrl = 'http://localhost:8000';

/**
 * Builds the route context with the given session result + spy database, and an
 * injected `createSubmit` seam that records every dispatched move (bot readies +
 * driver moves) without a live boardgame.io Master.
 */
function makeRouteContext(
  sessionOk: boolean,
  database: never,
  sessionCode = 'missing_token',
): { context: Record<string, unknown>; submitCalls: Array<{ seat: string; moveName: string; moveArgs: unknown }> } {
  const submitCalls: Array<{ seat: string; moveName: string; moveArgs: unknown }> = [];
  const context: Record<string, unknown> = {
    db: makeBgioDb(),
    transport: makeTransport(),
    auth: makeAuth(),
    serverUrl,
    internalDelegationSecret: 'test-secret',
    database,
    requireAuthenticatedSession: async () =>
      sessionOk ? { ok: true, value: 'acct-1' } : { ok: false, reason: 'no token', code: sessionCode },
    verifier: {},
    accountResolver: {},
    // why: observe move dispatches without a real Master / bgio store.
    createSubmit: (_matchId: string, _credentials: Record<string, string>) =>
      async (move: { seat: string; moveName: string; moveArgs: unknown }) => {
        submitCalls.push(move);
      },
  };
  return { context, submitCalls };
}

/** Registers the route and returns the create-with-bot handler. */
function collectHandler(context: Record<string, unknown>): Handler {
  let captured: Handler | undefined;
  const router = {
    post(path: string, handler: Handler): void {
      if (path === '/api/match/create-with-bot') {
        captured = handler;
      }
    },
  };
  registerBotAllyRoutes(router as never, context as never);
  if (captured === undefined) {
    throw new Error('The create-with-bot route was not registered.');
  }
  return captured;
}

let originalFetch: typeof globalThis.fetch | undefined;
let fetchCalls: Array<{ url: string; init: RequestInit | undefined }> = [];

/**
 * Stubs globalThis.fetch: the native create returns a fixed match id; each
 * native join returns a per-seat credential; setPlayerReady / other Master
 * calls never go through fetch (they go through the injected db/transport/auth),
 * so only create + join are observed here.
 */
function stubFetch(): void {
  originalFetch = globalThis.fetch;
  fetchCalls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url).endsWith('/create')) {
      return { ok: true, status: 200, async json() { return { matchID: 'match-xyz' }; }, async text() { return ''; } } as never;
    }
    if (String(url).endsWith('/join')) {
      const seat = JSON.parse(String(init?.body ?? '{}')).playerID;
      return { ok: true, status: 200, async json() { return { playerCredentials: `cred-${seat}` }; }, async text() { return ''; } } as never;
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as never;
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
  }
});

describe('POST /api/match/create-with-bot', () => {
  test('returns 401 on an unauthenticated request and touches no native lobby', async () => {
    const { database } = makeSpyDatabase();
    const handler = collectHandler(makeRouteContext(false, database).context);
    const koaContext = makeContext({ numPlayers: 2, botCount: 1, policy: 'competent', setupData: { schemeId: 's' } });

    await handler(koaContext);

    assert.equal(koaContext.status, 401);
    assert.equal(fetchCalls.length, 0, 'an unauthenticated request never reaches the native lobby');
  });

  test('returns 400 on an invalid body (botCount >= numPlayers)', async () => {
    const { database } = makeSpyDatabase();
    const handler = collectHandler(makeRouteContext(true, database).context);
    const koaContext = makeContext({ numPlayers: 2, botCount: 2, policy: 'competent', setupData: { schemeId: 's' } });

    await handler(koaContext);

    assert.equal(koaContext.status, 400);
    assert.equal(fetchCalls.length, 0, 'an invalid body never reaches the native lobby');
  });

  test('creates the match, joins ONLY the bot seat, and returns matchId', async () => {
    const { database } = makeSpyDatabase();
    const handler = collectHandler(makeRouteContext(true, database).context);
    const koaContext = makeContext({ numPlayers: 2, botCount: 1, policy: 'competent', setupData: { schemeId: 's' } });

    await handler(koaContext);

    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { matchId: 'match-xyz' });

    // Exactly one create + one join (seat "1" only — never seat "0").
    const createCalls = fetchCalls.filter((call) => call.url.endsWith('/create'));
    const joinCalls = fetchCalls.filter((call) => call.url.endsWith('/join'));
    assert.equal(createCalls.length, 1);
    assert.equal(joinCalls.length, 1, 'exactly one bot seat was joined');
    const joinedSeats = joinCalls.map((call) => JSON.parse(String(call.init?.body ?? '{}')).playerID);
    assert.deepEqual(joinedSeats, ['1'], 'only the bot seat "1" was joined — seat "0" is left for the human');
  });

  test('joins the bot seat with the internal-delegation secret and writes no seat-account row', async () => {
    const { database, queries } = makeSpyDatabase();
    const handler = collectHandler(makeRouteContext(true, database).context);
    await handler(makeContext({ numPlayers: 2, botCount: 1, policy: 'competent', setupData: { schemeId: 's' } }));

    const joinCall = fetchCalls.find((call) => call.url.endsWith('/join'));
    const joinHeaders = (joinCall?.init?.headers ?? {}) as Record<string, string>;
    assert.equal(
      joinHeaders['x-legendary-internal-delegation'],
      'test-secret',
      'the bot join carries the internal-delegation secret',
    );
    // The only DB writes are the bot-ally metadata upsert — never a seat-account
    // insert (D-24120: bots have no match_seat_accounts row).
    const seatAccountWrites = queries.filter((query) => query.sql.includes('match_seat_accounts'));
    assert.equal(seatAccountWrites.length, 0, 'no match_seat_accounts row is written for a bot seat');
  });

  test('persists the botSeats tag + decision seed, auto-readies bots, and does not start the match', async () => {
    const { database, queries } = makeSpyDatabase();
    const { context, submitCalls } = makeRouteContext(true, database);
    const handler = collectHandler(context);
    await handler(makeContext({ numPlayers: 3, botCount: 2, policy: 'random', setupData: { schemeId: 's' } }));

    const tagWrite = queries.find((query) => query.sql.includes('match_bot_ally'));
    assert.ok(tagWrite, 'the bot-ally metadata row was written');
    // params: [matchId, botSeats, decisionSeed, policy, status]
    assert.equal(tagWrite!.params[0], 'match-xyz');
    assert.deepEqual(tagWrite!.params[1], ['1', '2'], 'both bot seats are tagged (1 human + 2 bots)');
    assert.equal(tagWrite!.params[2], 'match-xyz', 'the decision seed is the match id (deterministic, clock-free)');
    assert.equal(tagWrite!.params[3], 'random');

    // Both bot seats are auto-readied; the human seat 0 is NEVER readied here,
    // and startMatchIfReady is NEVER dispatched.
    const readyCalls = submitCalls.filter((call) => call.moveName === 'setPlayerReady');
    assert.deepEqual(readyCalls.map((call) => call.seat), ['1', '2'], 'both bot seats were auto-readied');
    assert.equal(readyCalls.every((call) => (call.moveArgs as { ready: boolean }).ready === true), true);
    assert.equal(submitCalls.some((call) => call.seat === '0'), false, 'seat 0 (the human) is never readied by the server');
    assert.equal(submitCalls.some((call) => call.moveName === 'startMatchIfReady'), false, 'the endpoint never starts the match');
    assert.equal(botAllyDrivers.has('match-xyz'), true, 'a driver was registered for the match');
  });

  test('returns 500 when the native create fails', async () => {
    const { database } = makeSpyDatabase();
    const handler = collectHandler(makeRouteContext(true, database).context);
    // Override fetch so create fails.
    globalThis.fetch = (async (url: string) => {
      if (String(url).endsWith('/create')) {
        return { ok: false, status: 400, async text() { return 'bad setup'; }, async json() { return {}; } } as never;
      }
      throw new Error('unexpected');
    }) as never;
    const koaContext = makeContext({ numPlayers: 2, botCount: 1, policy: 'competent', setupData: { schemeId: 's' } });

    await handler(koaContext);

    assert.equal(koaContext.status, 400, 'the native create status is propagated');
    assert.equal(botAllyDrivers.has('match-xyz'), false, 'no driver is registered when creation fails');
  });
});
