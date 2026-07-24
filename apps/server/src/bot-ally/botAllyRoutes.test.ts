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
  readRevivableBotAllyMatches,
  rehydrateBotAllyDrivers,
  MAX_REVIVALS,
} from './botAllyRoutes.mjs';
import { botAllyDrivers, BOT_FAULTED_MESSAGE } from './botAllyDriver.mjs';

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
    // why: registerBotAllyRoutes also registers the WP-414 GET status route; this
    // POST-focused collector ignores it but must expose `.get` so registration
    // does not throw.
    get(): void {},
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

// ---------------------------------------------------------------------------
// WP-414 — status surface + bounded restart revival (server)
// ---------------------------------------------------------------------------

/** A fake pg pool whose `query` returns rows from a responder + records calls. */
function makeProgrammableDatabase(
  responder: (sql: string, params: unknown[]) => unknown[] | undefined,
): { database: never; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      const rows = responder(sql, params) ?? [];
      return { rows, rowCount: rows.length };
    },
  } as unknown as never;
  return { database, queries };
}

/** A minimal status-route koa context carrying only `params.matchId`. */
function makeStatusContext(matchId: string): FakeContext & { params: { matchId: string } } {
  return {
    params: { matchId },
    req: { headers: {} },
    request: {},
    status: 0,
    body: undefined,
    headers: {},
    set(field: string, value: string): void {
      this.headers[field] = value;
    },
  };
}

/** Registers the bot-ally routes and returns the captured GET/POST handlers. */
function collectRouteHandlers(context: Record<string, unknown>): {
  get: Record<string, Handler>;
  post: Record<string, Handler>;
} {
  const handlers: { get: Record<string, Handler>; post: Record<string, Handler> } = { get: {}, post: {} };
  const router = {
    post(path: string, handler: Handler): void {
      handlers.post[path] = handler;
    },
    get(path: string, handler: Handler): void {
      handlers.get[path] = handler;
    },
  };
  registerBotAllyRoutes(router as never, context as never);
  return handlers;
}

/** A bgio db whose fetch returns a fixed state for `{state:true}` and metadata for `{metadata:true}`. */
function makeRevivalBgioDb(state: unknown, metadata: unknown): unknown {
  return {
    async fetch(_matchId: string, options: unknown) {
      if (options !== null && typeof options === 'object' && (options as { metadata?: boolean }).metadata) {
        return { metadata };
      }
      return { state };
    },
  };
}

describe('GET /api/match/:matchId/bot-ally-status', () => {
  function statusHandlerWith(
    responder: (sql: string, params: unknown[]) => unknown[] | undefined,
  ): { handler: Handler; queries: RecordedQuery[] } {
    const { database, queries } = makeProgrammableDatabase(responder);
    const handlers = collectRouteHandlers({ database, createSubmit: () => async () => {} });
    const handler = handlers.get['/api/match/:matchId/bot-ally-status'];
    if (handler === undefined) {
      throw new Error('The bot-ally-status route was not registered.');
    }
    return { handler, queries };
  }

  test('reports an active match WITH a live driver as driving:true (WP-419)', async () => {
    // why: WP-419 — `driving:true` now requires a live in-process driver, not just
    // the `active` flag. Register one so the healthy case reports driving:true.
    botAllyDrivers.set('m-active', { stop() {} } as never);
    const { handler } = statusHandlerWith(() => [{ status: 'active', fault_message: null }]);
    const koaContext = makeStatusContext('m-active');

    await handler(koaContext);

    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { driving: true, status: 'active', message: null });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('reports an active match with NO live driver as driving:false (WP-419 — a dead driver is not healthy)', async () => {
    // why: WP-419 / D-24239 — botAllyDrivers is empty (the in-process driver was
    // destroyed by a redeploy) while the row is still at its CREATION status
    // `active`. Deriving `driving` from the flag alone reported this frozen match
    // as healthy so the WP-415 banner never surfaced. Liveness makes it honest.
    const { handler } = statusHandlerWith(() => [{ status: 'active', fault_message: null }]);
    const koaContext = makeStatusContext('m-dead');

    await handler(koaContext);

    assert.deepEqual(
      koaContext.body,
      { driving: false, status: 'active', message: null },
      'a driverless active match reports driving:false so the stall banner surfaces',
    );
  });

  test('reports a faulted match with the verbatim public-safe message', async () => {
    const faultMessage =
      'The bot ally could not finish its turn, so the match was stopped. ' +
      'You can start a new match with a bot ally.';
    const { handler } = statusHandlerWith(() => [{ status: 'faulted', fault_message: faultMessage }]);
    const koaContext = makeStatusContext('m-faulted');

    await handler(koaContext);

    assert.deepEqual(koaContext.body, { driving: false, status: 'faulted', message: faultMessage });
  });

  test('reports absent (200) and reads ONLY the side-table for a rowless match', async () => {
    const { handler, queries } = statusHandlerWith(() => []);
    const koaContext = makeStatusContext('m-none');

    await handler(koaContext);

    assert.equal(koaContext.status, 200, 'a rowless match is a 200 absent, never a 404');
    assert.deepEqual(koaContext.body, { driving: false, status: 'absent', message: null });
    assert.equal(queries.length, 1, 'exactly one read — no bgio blob fetch');
    assert.match(queries[0]!.sql, /match_bot_ally/, 'the only read is against the side-table');
  });

  test('never carries a message for a non-faulted terminal status', async () => {
    const { handler } = statusHandlerWith(() => [{ status: 'exhausted', fault_message: 'should not surface' }]);
    const koaContext = makeStatusContext('m-exhausted');

    await handler(koaContext);

    assert.deepEqual(
      koaContext.body,
      { driving: false, status: 'exhausted', message: null },
      'message is null unless the status is faulted',
    );
  });

  test('returns the project-owned 500 envelope (no-store) on a DB fault', async () => {
    const { handler } = statusHandlerWith(() => {
      throw new Error('database unavailable');
    });
    const koaContext = makeStatusContext('m-err');

    await handler(koaContext);

    assert.equal(koaContext.status, 500);
    assert.deepEqual(koaContext.body, { error: 'internal_error' });
    assert.equal(koaContext.headers['Cache-Control'], 'no-store', 'no-store is set on the error path too');
  });
});

describe('readRevivableBotAllyMatches', () => {
  test('selects under-cap active/faulted/exhausted bounded by MAX_REVIVALS, and maps status + reviveCount', async () => {
    const rows = [
      { match_id: 'a', bot_seats: ['1'], decision_seed: 'a', policy: 'competent', status: 'active', revive_count: 0 },
      { match_id: 'f', bot_seats: ['1'], decision_seed: 'f', policy: 'random', status: 'faulted', revive_count: 2 },
    ];
    const { database, queries } = makeProgrammableDatabase(() => rows);

    const result = await readRevivableBotAllyMatches(database);

    assert.equal(queries.length, 1);
    assert.match(queries[0]!.sql, /revive_count < \$1/, 'the query is bounded by the revival cap');
    assert.match(
      queries[0]!.sql,
      /status IN \('active', 'faulted', 'exhausted'\)/,
      'the cap covers active too (2026-07-23 hotfix) so a stuck active match cannot resurrect forever',
    );
    assert.deepEqual(queries[0]!.params, [MAX_REVIVALS], 'the cap value is passed as the bound');
    assert.deepEqual(result, [
      { matchId: 'a', botSeats: ['1'], decisionSeed: 'a', policy: 'competent', status: 'active', reviveCount: 0 },
      { matchId: 'f', botSeats: ['1'], decisionSeed: 'f', policy: 'random', status: 'faulted', reviveCount: 2 },
    ]);
  });
});

describe('rehydrateBotAllyDrivers — bounded restart revival', () => {
  const revivableSelect = (rows: unknown[]) => (sql: string) =>
    sql.includes('SELECT match_id') ? rows : [];

  test('revives a still-live faulted match, flipping active and incrementing revive_count', async () => {
    const { database, queries } = makeProgrammableDatabase(
      revivableSelect([
        { match_id: 'live-faulted', bot_seats: ['1'], decision_seed: 's', policy: 'competent', status: 'faulted', revive_count: 1 },
      ]),
    );
    const liveState = { _stateID: 3, ctx: { currentPlayer: '1', phase: 'play', turn: 2, numPlayers: 2 } };
    const metadata = { players: { '0': {}, '1': { credentials: 'cred-1' } } };
    const context = { db: makeRevivalBgioDb(liveState, metadata), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('live-faulted'), true, 'a driver was revived for the still-live faulted match');
    const incrementWrite = queries.find((query) => query.sql.includes('revive_count = revive_count + 1'));
    assert.ok(incrementWrite, 'the revival incremented revive_count and flipped status active');
    assert.deepEqual(incrementWrite!.params, ['live-faulted']);
    const completedWrite = queries.find(
      (query) => query.sql.includes('SET status = $2') && (query.params as unknown[])[1] === 'completed',
    );
    assert.equal(completedWrite, undefined, 'a live faulted match is revived, not marked completed');
  });

  test('marks a faulted match whose game already ended completed, never reviving it', async () => {
    const { database, queries } = makeProgrammableDatabase(
      revivableSelect([
        { match_id: 'done-faulted', bot_seats: ['1'], decision_seed: 's', policy: 'competent', status: 'faulted', revive_count: 0 },
      ]),
    );
    const endedState = { _stateID: 9, ctx: { currentPlayer: '1', phase: 'play', turn: 5, numPlayers: 2, gameover: { winner: 'heroes' } } };
    const context = { db: makeRevivalBgioDb(endedState, {}), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('done-faulted'), false, 'a finished match is never revived');
    const completedWrite = queries.find(
      (query) => query.sql.includes('SET status = $2') && (query.params as unknown[])[1] === 'completed',
    );
    assert.ok(completedWrite, 'the finished match was marked completed');
    const incrementWrite = queries.find((query) => query.sql.includes('revive_count = revive_count + 1'));
    assert.equal(incrementWrite, undefined, 'a completed match never increments revive_count');
  });

  test('re-registers an already-active row AND consumes a revival (2026-07-23 hotfix — active is now capped)', async () => {
    // why: an active row that never reaches a terminal status must be capped too,
    // or a stuck `active` match resurrects forever and drives a restart loop. So
    // every re-registration — active included — now increments revive_count.
    const { database, queries } = makeProgrammableDatabase(
      revivableSelect([
        { match_id: 'active-lost', bot_seats: ['1'], decision_seed: 's', policy: 'competent', status: 'active', revive_count: 0 },
      ]),
    );
    const liveState = { _stateID: 2, ctx: { currentPlayer: '1', phase: 'play', turn: 1, numPlayers: 2 } };
    const metadata = { players: { '0': {}, '1': { credentials: 'cred-1' } } };
    const context = { db: makeRevivalBgioDb(liveState, metadata), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('active-lost'), true, 'the lost active driver was re-registered');
    const incrementWrite = queries.find((query) => query.sql.includes('revive_count = revive_count + 1'));
    assert.ok(incrementWrite, 'an active re-registration now consumes a revival so a stuck match is eventually excluded');
    assert.deepEqual(incrementWrite!.params, ['active-lost']);
  });

  test('skips a still-live match whose bot-seat credentials are missing', async () => {
    const { database, queries } = makeProgrammableDatabase(
      revivableSelect([
        { match_id: 'no-creds', bot_seats: ['1'], decision_seed: 's', policy: 'competent', status: 'faulted', revive_count: 0 },
      ]),
    );
    const liveState = { _stateID: 4, ctx: { currentPlayer: '1', phase: 'play', turn: 2, numPlayers: 2 } };
    const metadataMissingCred = { players: { '0': {}, '1': {} } };
    const context = { db: makeRevivalBgioDb(liveState, metadataMissingCred), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('no-creds'), false, 'no driver is registered when credentials are missing');
    const incrementWrite = queries.find((query) => query.sql.includes('revive_count = revive_count + 1'));
    assert.equal(incrementWrite, undefined, 'a skipped match does not consume a revival');
  });
});

describe('rehydrateBotAllyDrivers — strand→faulted (WP-419 / D-24239)', () => {
  /**
   * A responder that returns `strandedRows` for the stranded read
   * (`revive_count >= $1`), `revivableRows` for the revivable read (the other
   * `SELECT match_id`), and nothing else.
   */
  function strandResponder(strandedRows: unknown[], revivableRows: unknown[]) {
    return (sql: string) => {
      if (sql.includes('revive_count >= $1')) {
        return strandedRows;
      }
      if (sql.includes('SELECT match_id')) {
        return revivableRows;
      }
      return [];
    };
  }

  test('settles a cap-stranded active match (still in play) to faulted so the banner surfaces', async () => {
    const { database, queries } = makeProgrammableDatabase(
      strandResponder([{ match_id: 'stranded', bot_seats: ['1'] }], []),
    );
    const liveState = { _stateID: 6, ctx: { currentPlayer: '1', phase: 'play', turn: 1, numPlayers: 2 } };
    const context = { db: makeRevivalBgioDb(liveState, {}), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('stranded'), false, 'a stranded match is NOT revived');
    const faultWrite = queries.find(
      (query) => query.sql.includes('SET status = $2') && (query.params as unknown[])[1] === 'faulted',
    );
    assert.ok(faultWrite, 'the stranded active row was flipped to faulted');
    assert.equal((faultWrite!.params as unknown[])[0], 'stranded', 'the correct match was faulted');
    assert.equal(
      (faultWrite!.params as unknown[])[2],
      BOT_FAULTED_MESSAGE,
      'the surfaced fault carries the public-safe co-op message',
    );
  });

  test('settles a cap-stranded active match whose game already ended to completed, not faulted', async () => {
    const { database, queries } = makeProgrammableDatabase(
      strandResponder([{ match_id: 'stranded-done', bot_seats: ['1'] }], []),
    );
    const endedState = {
      _stateID: 9,
      ctx: { currentPlayer: '1', phase: 'play', turn: 3, numPlayers: 2, gameover: { winner: 'heroes' } },
    };
    const context = { db: makeRevivalBgioDb(endedState, {}), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    const completedWrite = queries.find(
      (query) =>
        query.sql.includes('SET status = $2') &&
        (query.params as unknown[])[0] === 'stranded-done' &&
        (query.params as unknown[])[1] === 'completed',
    );
    assert.ok(completedWrite, 'a stranded match whose game ended is completed, not faulted');
    const faultWrite = queries.find(
      (query) =>
        query.sql.includes('SET status = $2') &&
        (query.params as unknown[])[0] === 'stranded-done' &&
        (query.params as unknown[])[1] === 'faulted',
    );
    assert.equal(faultWrite, undefined, 'an ended match is never faulted');
  });

  test('does NOT fault a match this boot just revived, even if it also appears in the stranded read', async () => {
    // why: a row revived this boot has a live driver (botAllyDrivers.has === true),
    // so the strand pass must skip it — it is not actually stranded.
    const { database, queries } = makeProgrammableDatabase(
      strandResponder(
        [{ match_id: 'revived-at-cap', bot_seats: ['1'] }],
        [{ match_id: 'revived-at-cap', bot_seats: ['1'], decision_seed: 's', policy: 'competent', status: 'active', revive_count: 2 }],
      ),
    );
    const liveState = { _stateID: 2, ctx: { currentPlayer: '1', phase: 'play', turn: 1, numPlayers: 2 } };
    const metadata = { players: { '0': {}, '1': { credentials: 'cred-1' } } };
    const context = { db: makeRevivalBgioDb(liveState, metadata), database, createSubmit: () => async () => {} };

    await rehydrateBotAllyDrivers(context as never);

    assert.equal(botAllyDrivers.has('revived-at-cap'), true, 'the match was revived (it had a live driver)');
    const faultWrite = queries.find(
      (query) =>
        query.sql.includes('SET status = $2') &&
        (query.params as unknown[])[0] === 'revived-at-cap' &&
        (query.params as unknown[])[1] === 'faulted',
    );
    assert.equal(faultWrite, undefined, 'a revived match with a live driver is never faulted by the strand pass');
  });
});
