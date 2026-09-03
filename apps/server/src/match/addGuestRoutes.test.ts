/**
 * Tests for the WP-627 host-initiated add-guest seat endpoint.
 *
 * Pure unit tests: a fake router captures the handler, a fake
 * `requireAuthenticatedSession` stands in for the WP-112 orchestrator, a fake
 * `db.fetch` returns the bgio match metadata, a fake pg pool answers the
 * `readSeatAccounts` / `readMatchBotSeats` SELECTs, and `globalThis.fetch` is
 * stubbed so the native-lobby secret-join is observed without a running server.
 * No boardgame.io import, no network, no live DB.
 *
 * The rowless property (AC3/AC4/AC7): the happy-path test asserts the handler
 * writes NO `match_seat_accounts` row for the guest seat. That absence is exactly
 * what makes `computeRankedEligibility` rule 2 (`roster.length !== seatCount`,
 * competition.logic.ts) demote the match to Casual — the rule-2 behaviour for a
 * rowless seat is pinned by competition.logic.test.ts, so this suite proves the
 * input to it (a rowless guest seat), not the rule again.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerAddGuestRoutes,
  releaseUnclaimedGuestSeats,
  MAX_GUEST_SEATS_PER_MATCH,
} from './addGuestRoutes.mjs';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  request: { body?: unknown };
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

const HOST_ACCOUNT = 'host-acct';
const serverUrl = 'http://localhost:8000';
const internalDelegationSecret = 'test-secret';

/** A signed-in host session. */
const authedSession = async () => ({ ok: true as const, value: HOST_ACCOUNT });

/** An unauthenticated session (missing bearer token). */
const unauthedSession = async () => ({
  ok: false as const,
  reason: 'no bearer token supplied',
  code: 'missing_token',
});

/**
 * A fake pg pool that answers the two SELECTs the handler makes and records
 * every query, so a test can assert what was (and was not) written.
 */
function makeDatabase(
  accountRows: { player_id: string; account_id: string }[],
  botRows: { bot_seats: string[] }[],
): { database: never; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('legendary.match_seat_accounts')) {
        return { rows: accountRows, rowCount: accountRows.length };
      }
      if (sql.includes('legendary.match_bot_ally')) {
        return { rows: botRows, rowCount: botRows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as never;
  return { database, queries };
}

/** A fake bgio store whose `fetch` returns the given match metadata. */
function makeDb(metadata: unknown): never {
  return {
    fetch: async () => ({ metadata }),
  } as unknown as never;
}

/**
 * Registers the route with a capturing fake router and returns the handler.
 */
function collectHandler(context: Record<string, unknown>): Handler {
  let captured: Handler | undefined;
  const router = {
    post(path: string, handler: Handler): void {
      if (path === '/api/match/add-guest') {
        captured = handler;
      }
    },
  };
  registerAddGuestRoutes(router as never, context as never);
  if (captured === undefined) {
    throw new Error('The add-guest route was not registered.');
  }
  return captured;
}

/** Builds a fake Koa context carrying the given request body. */
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

interface StubbedFetchCall {
  url: string;
  init: RequestInit | undefined;
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

/** A base context bundle; individual tests override db / database / session. */
function baseContext(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    serverUrl,
    internalDelegationSecret,
    requireAuthenticatedSession: authedSession,
    verifier: undefined,
    accountResolver: undefined,
    ...overrides,
  };
}

describe('addGuestRoutes (WP-627)', () => {
  afterEach(() => {
    restoreFetch();
  });

  test('registers POST /api/match/add-guest', () => {
    const paths: string[] = [];
    const router = { post: (path: string) => paths.push(path) };
    registerAddGuestRoutes(
      router as never,
      baseContext({ db: makeDb({ players: {} }), database: makeDatabase([], []).database }) as never,
    );
    assert.deepEqual(paths, ['/api/match/add-guest']);
  });

  test('returns 401 when the host is not authenticated', async () => {
    const handler = collectHandler(
      baseContext({
        requireAuthenticatedSession: unauthedSession,
        db: makeDb({ players: {} }),
        database: makeDatabase([], []).database,
      }),
    );
    const koaContext = makeContext({ matchId: 'm1' });
    await handler(koaContext);
    assert.equal(koaContext.status, 401);
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('returns 400 when matchId is missing', async () => {
    const handler = collectHandler(
      baseContext({ db: makeDb({ players: {} }), database: makeDatabase([], []).database }),
    );
    const koaContext = makeContext({});
    await handler(koaContext);
    assert.equal(koaContext.status, 400);
  });

  test('returns 404 when the match is not found', async () => {
    const handler = collectHandler(
      baseContext({ db: makeDb(null), database: makeDatabase([], []).database }),
    );
    const koaContext = makeContext({ matchId: 'missing' });
    await handler(koaContext);
    assert.equal(koaContext.status, 404);
  });

  test('returns 403 when the host is not a participant in the match', async () => {
    // why: only a player already seated in the match may add a guest — a
    // signed-in stranger (no seat-account row) is rejected.
    const metadata = { players: { '0': { id: 0, credentials: 'c0' }, '1': { id: 1 } } };
    const { database } = makeDatabase([{ player_id: '0', account_id: 'someone-else' }], []);
    const handler = collectHandler(baseContext({ db: makeDb(metadata), database }));
    const koaContext = makeContext({ matchId: 'm1' });
    await handler(koaContext);
    assert.equal(koaContext.status, 403);
  });

  test('returns 409 when the per-match guest cap is already reached', async () => {
    // 5-seat match: seat 0 is the host account; seats 1-4 are occupied guests
    // (credentials, but no account row and no bot tag) = MAX_GUEST_SEATS_PER_MATCH.
    const players: Record<string, unknown> = { '0': { id: 0, credentials: 'c0' } };
    for (let seat = 1; seat <= MAX_GUEST_SEATS_PER_MATCH; seat += 1) {
      players[String(seat)] = { id: seat, credentials: `c${seat}` };
    }
    const { database } = makeDatabase([{ player_id: '0', account_id: HOST_ACCOUNT }], []);
    const handler = collectHandler(baseContext({ db: makeDb({ players }), database }));
    const koaContext = makeContext({ matchId: 'm1' });
    await handler(koaContext);
    assert.equal(koaContext.status, 409);
    assert.match(String((koaContext.body as { error: string }).error), /maximum/);
  });

  test('returns 409 when the match is full (no free seat, under the guest cap)', async () => {
    // Two account seats, both occupied; guest count is 0 but there is no free seat.
    const metadata = {
      players: { '0': { id: 0, credentials: 'c0' }, '1': { id: 1, credentials: 'c1' } },
    };
    const { database } = makeDatabase(
      [
        { player_id: '0', account_id: HOST_ACCOUNT },
        { player_id: '1', account_id: 'other-acct' },
      ],
      [],
    );
    const handler = collectHandler(baseContext({ db: makeDb(metadata), database }));
    const koaContext = makeContext({ matchId: 'm1' });
    await handler(koaContext);
    assert.equal(koaContext.status, 409);
    assert.match(String((koaContext.body as { error: string }).error), /full/);
  });

  test('happy path: secret-joins the free seat, returns the credential, and writes NO match_seat_accounts row', async () => {
    // Seat 0 = host account (occupied); seat 1 = free.
    const metadata = { players: { '0': { id: 0, credentials: 'c0' }, '1': { id: 1 } } };
    const { database, queries } = makeDatabase(
      [{ player_id: '0', account_id: HOST_ACCOUNT }],
      [],
    );
    installFetchStub(200, { playerCredentials: 'guest-cred' });
    const handler = collectHandler(baseContext({ db: makeDb(metadata), database }));
    const koaContext = makeContext({ matchId: 'm1' });

    await handler(koaContext);

    // 200 with the minted seat + credential
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, {
      matchId: 'm1',
      seat: '1',
      credentials: 'guest-cred',
    });

    // exactly one secret-join, to the free seat, with the Guest name + the
    // internal-delegation header (the create-with-bot mechanism)
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!.url, /\/games\/legendary-arena\/m1\/join$/);
    const sentBody = JSON.parse(String(fetchCalls[0]!.init!.body));
    assert.equal(sentBody.playerID, '1');
    assert.equal(sentBody.playerName, 'Guest');
    const sentHeaders = fetchCalls[0]!.init!.headers as Record<string, string>;
    assert.ok(
      Object.values(sentHeaders).includes(internalDelegationSecret),
      'the WP-308 internal-delegation secret must be sent on the secret-join',
    );

    // AC3/AC4/AC7: the guest seat is rowless — the handler NEVER inserts into
    // match_seat_accounts, so the roster stays shorter than the seat count and
    // rule 2 demotes the match to Casual.
    const wroteSeatAccount = queries.some((q) => q.sql.includes('INSERT INTO legendary.match_seat_accounts'));
    assert.equal(wroteSeatAccount, false);
  });
});

describe('releaseUnclaimedGuestSeats (D-24448)', () => {
  afterEach(() => {
    restoreFetch();
  });

  test('releases an UNCONNECTED guest seat via bgio leave with its own credentials', async () => {
    // seat 0 = the host account seat; seat 1 = a minted guest placeholder that no
    // one has connected to (no isConnected).
    const metadata = {
      players: {
        '0': { id: 0, name: 'host', credentials: 'host-cred', isConnected: true },
        '1': { id: 1, name: 'Guest', credentials: 'guest-cred' },
      },
    };
    const { database } = makeDatabase([{ player_id: '0', account_id: HOST_ACCOUNT }], []);
    installFetchStub(200, {});
    const released = await releaseUnclaimedGuestSeats(
      baseContext({ db: makeDb(metadata), database }),
      'm1',
    );
    assert.deepEqual(released, ['1']);
    // exactly one leave call, to seat 1, carrying that seat's credentials
    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0]!.url.endsWith('/games/legendary-arena/m1/leave'));
    const sentBody = JSON.parse(String(fetchCalls[0]!.init?.body));
    assert.equal(sentBody.playerID, '1');
    assert.equal(sentBody.credentials, 'guest-cred');
  });

  test('leaves a CONNECTED guest seat untouched (a real person on the link)', async () => {
    const metadata = {
      players: {
        '0': { id: 0, name: 'host', credentials: 'host-cred', isConnected: true },
        '1': { id: 1, name: 'Guest', credentials: 'guest-cred', isConnected: true },
      },
    };
    const { database } = makeDatabase([{ player_id: '0', account_id: HOST_ACCOUNT }], []);
    installFetchStub(200, {});
    const released = await releaseUnclaimedGuestSeats(
      baseContext({ db: makeDb(metadata), database }),
      'm1',
    );
    assert.deepEqual(released, []);
    assert.equal(fetchCalls.length, 0);
  });

  test('never releases an account seat or a bot seat', async () => {
    const metadata = {
      players: {
        '0': { id: 0, name: 'host', credentials: 'host-cred' }, // account seat
        '1': { id: 1, name: 'Bot', credentials: 'bot-cred' }, // bot seat
      },
    };
    const { database } = makeDatabase(
      [{ player_id: '0', account_id: HOST_ACCOUNT }],
      [{ bot_seats: ['1'] }],
    );
    installFetchStub(200, {});
    const released = await releaseUnclaimedGuestSeats(
      baseContext({ db: makeDb(metadata), database }),
      'm1',
    );
    assert.deepEqual(released, []);
    assert.equal(fetchCalls.length, 0);
  });

  test('best-effort: a failed leave is skipped and never throws', async () => {
    const metadata = {
      players: {
        '0': { id: 0, name: 'host', credentials: 'host-cred', isConnected: true },
        '1': { id: 1, name: 'Guest', credentials: 'guest-cred' },
      },
    };
    const { database } = makeDatabase([{ player_id: '0', account_id: HOST_ACCOUNT }], []);
    installFetchStub(500, { error: 'boom' });
    const released = await releaseUnclaimedGuestSeats(
      baseContext({ db: makeDb(metadata), database }),
      'm1',
    );
    // the leave was attempted but failed, so nothing is reported released
    assert.deepEqual(released, []);
    assert.equal(fetchCalls.length, 1);
  });

  test('a match with no metadata / no players returns [] without a leave call', async () => {
    const { database } = makeDatabase([], []);
    installFetchStub(200, {});
    const released = await releaseUnclaimedGuestSeats(
      baseContext({ db: makeDb(null), database }),
      'missing',
    );
    assert.deepEqual(released, []);
    assert.equal(fetchCalls.length, 0);
  });
});
