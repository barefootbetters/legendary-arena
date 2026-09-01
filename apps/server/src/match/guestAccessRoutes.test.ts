/**
 * Tests for the WP-630 guest-access routes (set-guest-access [host-gated],
 * join-as-guest [public, rate-limited], guest-access [public meta]).
 *
 * Pure unit tests mirroring the addGuestRoutes harness: a capturing fake router,
 * a fake `requireAuthenticatedSession`, a fake pg pool answering every SELECT /
 * upsert, a fake `db.fetch` for the bgio metadata, and a stubbed `globalThis.fetch`
 * for the secret-join. No boardgame.io import, no network, no live DB.
 *
 * The security-critical route properties pinned here:
 *   - no-password → 409 and wrong-password → 401 are DISTINCT (not collapsed);
 *   - the rate limit is consumed BEFORE any DB/hash read (a 429 does no DB work);
 *   - a correct password mints a ROWLESS seat (no match_seat_accounts INSERT);
 *   - set-guest-access is host-gated (401 unauth, 403 non-participant);
 *   - the plaintext password is never logged or returned.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { registerGuestAccessRoutes } from './guestAccessRoutes.mjs';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string>; on?: unknown };
  request: { body?: unknown; ip?: string };
  params: Record<string, string>;
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

const HOST_ACCOUNT = 'host-acct';
const serverUrl = 'http://localhost:8000';
const internalDelegationSecret = 'test-secret';

const authedSession = async () => ({ ok: true as const, value: HOST_ACCOUNT });
const unauthedSession = async () => ({
  ok: false as const,
  reason: 'no bearer token supplied',
  code: 'missing_token',
});

interface GuestRow {
  game_name: string | null;
  password_kdf: string | null;
}

/**
 * A combined fake pg pool: it holds the single-row guest-access store and
 * answers the match_seat_accounts / match_bot_ally SELECTs the mint path makes.
 * Every SQL string is logged so a test can assert what did (and did NOT) run.
 */
function makeDatabase(options: {
  accountRows?: { player_id: string; account_id: string }[];
  botRows?: { bot_seats: string[] }[];
}): { database: never; sqlLog: string[]; guestRows: Map<string, GuestRow> } {
  const accountRows = options.accountRows ?? [];
  const botRows = options.botRows ?? [];
  const guestRows = new Map<string, GuestRow>();
  const sqlLog: string[] = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      sqlLog.push(sql);
      if (sql.includes('legendary.match_guest_access')) {
        if (sql.startsWith('SELECT')) {
          const existing = guestRows.get(params[0] as string);
          return existing === undefined ? { rows: [], rowCount: 0 } : { rows: [existing], rowCount: 1 };
        }
        guestRows.set(params[0] as string, {
          game_name: params[1] as string | null,
          password_kdf: params[2] as string | null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('legendary.match_seat_accounts')) {
        return { rows: accountRows, rowCount: accountRows.length };
      }
      if (sql.includes('legendary.match_bot_ally')) {
        return { rows: botRows, rowCount: botRows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as never;
  return { database, sqlLog, guestRows };
}

/** A fake bgio store whose `fetch` returns the given match metadata. */
function makeDb(metadata: unknown): never {
  return { fetch: async () => ({ metadata }) } as unknown as never;
}

function makeContext(body: unknown, extra?: { ip?: string; params?: Record<string, string> }): FakeContext {
  return {
    req: { headers: { authorization: 'Bearer test-token' } },
    request: { body, ip: extra?.ip ?? '203.0.113.7' },
    params: extra?.params ?? {},
    status: 0,
    body: undefined,
    headers: {},
    set(field: string, value: string): void {
      this.headers[field] = value;
    },
  };
}

let originalFetch: typeof globalThis.fetch | undefined;
let fetchCalls: string[] = [];

function installFetchStub(status: number, responseBody: unknown): void {
  fetchCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
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

/** Registers all three routes and returns the captured handlers by path. */
function collectHandlers(context: Record<string, unknown>): {
  setGuestAccess: Handler;
  joinAsGuest: Handler;
  readGuestAccess: Handler;
} {
  const handlers: Record<string, Handler> = {};
  const router = {
    post(path: string, handler: Handler): void {
      handlers[path] = handler;
    },
    get(path: string, handler: Handler): void {
      handlers[path] = handler;
    },
  };
  registerGuestAccessRoutes(router as never, context as never);
  return {
    setGuestAccess: handlers['/api/match/set-guest-access'],
    joinAsGuest: handlers['/api/match/join-as-guest'],
    readGuestAccess: handlers['/api/match/:matchId/guest-access'],
  };
}

describe('guestAccessRoutes registration (WP-630)', () => {
  test('registers all three routes', () => {
    const paths: string[] = [];
    const router = {
      post: (path: string) => paths.push(path),
      get: (path: string) => paths.push(path),
    };
    registerGuestAccessRoutes(router as never, baseContext({ database: makeDatabase({}).database }) as never);
    assert.deepEqual(paths.sort(), [
      '/api/match/:matchId/guest-access',
      '/api/match/join-as-guest',
      '/api/match/set-guest-access',
    ]);
  });
});

describe('set-guest-access (host-gated) (WP-630)', () => {
  test('401 when the host is not authenticated', async () => {
    const { setGuestAccess } = collectHandlers(
      baseContext({ requireAuthenticatedSession: unauthedSession, database: makeDatabase({}).database }),
    );
    const koaContext = makeContext({ matchId: 'm1', password: 'pw' });
    await setGuestAccess(koaContext);
    assert.equal(koaContext.status, 401);
    assert.equal(koaContext.headers['Cache-Control'], 'no-store');
  });

  test('403 when the signed-in caller is not a participant', async () => {
    const { setGuestAccess } = collectHandlers(
      baseContext({ database: makeDatabase({ accountRows: [] }).database }),
    );
    const koaContext = makeContext({ matchId: 'm1', password: 'pw' });
    await setGuestAccess(koaContext);
    assert.equal(koaContext.status, 403);
  });

  test('200 sets the password for a participant and echoes only lobby-safe meta', async () => {
    const { database } = makeDatabase({ accountRows: [{ player_id: '0', account_id: HOST_ACCOUNT }] });
    const { setGuestAccess } = collectHandlers(baseContext({ database }));
    const koaContext = makeContext({ matchId: 'm1', gameName: 'Grandkids', password: 'apple' });
    await setGuestAccess(koaContext);
    assert.equal(koaContext.status, 200);
    const responseBody = koaContext.body as Record<string, unknown>;
    assert.equal(responseBody.hasGuestPassword, true);
    assert.equal(responseBody.gameName, 'Grandkids');
    assert.equal(JSON.stringify(responseBody).includes('apple'), false);
  });
});

describe('join-as-guest (public) (WP-630)', () => {
  afterEach(() => {
    restoreFetch();
  });

  test('400 when matchId or password is missing', async () => {
    const { joinAsGuest } = collectHandlers(baseContext({ database: makeDatabase({}).database, db: makeDb({ players: {} }) }));
    const koaContext = makeContext({ matchId: 'm1' });
    await joinAsGuest(koaContext);
    assert.equal(koaContext.status, 400);
  });

  test('409 when the match has no guest password set', async () => {
    const { database } = makeDatabase({});
    const { joinAsGuest } = collectHandlers(baseContext({ database, db: makeDb({ players: {} }) }));
    const koaContext = makeContext({ matchId: 'm1', password: 'guessing' });
    await joinAsGuest(koaContext);
    assert.equal(koaContext.status, 409);
  });

  test('401 (distinct from 409) when the password is wrong', async () => {
    const { database } = makeDatabase({ accountRows: [{ player_id: '0', account_id: HOST_ACCOUNT }] });
    // Seed a password via the set path so the row exists with a kdf.
    const { setGuestAccess, joinAsGuest } = collectHandlers(baseContext({ database, db: makeDb({ players: {} }) }));
    await setGuestAccess(makeContext({ matchId: 'm1', password: 'correct' }));
    const koaContext = makeContext({ matchId: 'm1', password: 'wrong' });
    await joinAsGuest(koaContext);
    assert.equal(koaContext.status, 401);
  });

  test('200 with the right password mints a ROWLESS seat and returns credentials', async () => {
    installFetchStub(200, { playerCredentials: 'guest-cred-xyz' });
    const { database, sqlLog } = makeDatabase({ accountRows: [{ player_id: '0', account_id: HOST_ACCOUNT }] });
    const metadata = { players: { '0': { credentials: 'host-cred' }, '1': null } };
    const { setGuestAccess, joinAsGuest } = collectHandlers(baseContext({ database, db: makeDb(metadata) }));
    await setGuestAccess(makeContext({ matchId: 'm1', password: 'correct' }));
    const koaContext = makeContext({ matchId: 'm1', password: 'correct' });
    await joinAsGuest(koaContext);
    assert.equal(koaContext.status, 200);
    const responseBody = koaContext.body as Record<string, unknown>;
    assert.equal(responseBody.seat, '1');
    assert.equal(responseBody.credentials, 'guest-cred-xyz');
    assert.equal(fetchCalls.length, 1);
    // Rowless: no INSERT into match_seat_accounts for the guest seat.
    const wroteSeatAccount = sqlLog.some((sql) => sql.includes('INSERT INTO legendary.match_seat_accounts'));
    assert.equal(wroteSeatAccount, false);
  });

  test('429 once the per-IP rate limit is exhausted, BEFORE any DB/hash read (ordering)', async () => {
    const { database, sqlLog } = makeDatabase({});
    // Capacity 0 → the very first attempt is over the limit.
    const { joinAsGuest } = collectHandlers(
      baseContext({ database, db: makeDb({ players: {} }), guestJoinRateLimitCapacity: 0, now: () => 1000 }),
    );
    const koaContext = makeContext({ matchId: 'm1', password: 'whatever' }, { ip: '198.51.100.4' });
    await joinAsGuest(koaContext);
    assert.equal(koaContext.status, 429);
    // The ordering guarantee: a rate-limited request did NO database work.
    assert.equal(sqlLog.length, 0);
  });

  test('does not log or return the plaintext password on any outcome', async () => {
    const logged: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (...parts: unknown[]) => logged.push(parts.join(' '));
    console.log = (...parts: unknown[]) => logged.push(parts.join(' '));
    try {
      const { database } = makeDatabase({ accountRows: [{ player_id: '0', account_id: HOST_ACCOUNT }] });
      const { setGuestAccess, joinAsGuest } = collectHandlers(baseContext({ database, db: makeDb({ players: {} }) }));
      await setGuestAccess(makeContext({ matchId: 'm1', password: 'topsecretpw' }));
      const mismatchContext = makeContext({ matchId: 'm1', password: 'topsecretpw' });
      await joinAsGuest(mismatchContext);
      const allLogs = logged.join('\n');
      assert.equal(allLogs.includes('topsecretpw'), false);
      assert.equal(JSON.stringify(mismatchContext.body).includes('topsecretpw'), false);
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
  });
});

describe('guest-access meta read (public) (WP-630)', () => {
  test('returns gameName + hasGuestPassword, never the kdf', async () => {
    const { database } = makeDatabase({ accountRows: [{ player_id: '0', account_id: HOST_ACCOUNT }] });
    const { setGuestAccess, readGuestAccess } = collectHandlers(baseContext({ database }));
    await setGuestAccess(makeContext({ matchId: 'm1', gameName: 'Table', password: 'hunter2' }));
    const koaContext = makeContext(undefined, { params: { matchId: 'm1' } });
    await readGuestAccess(koaContext);
    assert.equal(koaContext.status, 200);
    const responseBody = koaContext.body as Record<string, unknown>;
    assert.equal(responseBody.gameName, 'Table');
    assert.equal(responseBody.hasGuestPassword, true);
    assert.equal(JSON.stringify(responseBody).includes('hunter2'), false);
    assert.equal('password_kdf' in responseBody, false);
  });

  test('unknown match → empty meta, not an error', async () => {
    const { database } = makeDatabase({});
    const { readGuestAccess } = collectHandlers(baseContext({ database }));
    const koaContext = makeContext(undefined, { params: { matchId: 'ghost' } });
    await readGuestAccess(koaContext);
    assert.equal(koaContext.status, 200);
    assert.deepEqual(koaContext.body, { matchId: 'ghost', gameName: null, hasGuestPassword: false });
  });
});
