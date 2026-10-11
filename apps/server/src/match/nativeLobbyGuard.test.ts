/**
 * Tests for the WP-308 native-lobby hard gate.
 *
 * Pure unit tests: a fake Koa context and a `next` spy stand in for the
 * middleware pipeline, and a fake `requireAuthenticatedSession` stands in for
 * the WP-112 orchestrator. No boardgame.io import, no network, no DB — the
 * guard is exercised as the plain `(ctx, next)` function it is.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createNativeLobbyGuard,
  generateInternalDelegationSecret,
  INTERNAL_DELEGATION_HEADER,
  type NativeLobbyGuardDependencies,
} from './nativeLobbyGuard.js';

// why: the injected auth fake never reads the database, so a placeholder
// satisfies the field without a real pg pool.
const fakeDatabase = {} as never;

const SECRET = generateInternalDelegationSecret();

interface FakeContext {
  method: string;
  path: string;
  req: { headers: Record<string, string> };
  status: number;
  body: unknown;
  get(field: string): string;
}

interface GuardRun {
  ctx: FakeContext;
  nextCalls: number;
}

/**
 * Builds a fake Koa context for the given method/path, carrying the given
 * request headers (used for both the internal-delegation header and the
 * Authorization bearer header the session orchestrator reads).
 */
function makeContext(
  method: string,
  path: string,
  headers: Record<string, string>,
): FakeContext {
  return {
    method,
    path,
    req: { headers },
    status: 0,
    body: undefined,
    get(field: string): string {
      return headers[field.toLowerCase()] ?? '';
    },
  };
}

/**
 * Runs the guard against one fake context and reports how many times `next`
 * (the pass-through continuation) was invoked.
 */
async function runGuard(
  deps: NativeLobbyGuardDependencies,
  ctx: FakeContext,
): Promise<GuardRun> {
  let nextCalls = 0;
  const guard = createNativeLobbyGuard(deps);
  await guard(ctx as never, async () => {
    nextCalls = nextCalls + 1;
  });
  return { ctx, nextCalls };
}

// why: WP-802 / D-24689 §2 — models a valid NON-admin session: the session check
// passes, the D-15902 admin check answers `forbidden`.
const acceptingSessionDeps: NativeLobbyGuardDependencies = {
  internalSecret: SECRET,
  requireAuthenticatedSession: async () => ({ ok: true, value: 'acct-1' }),
  requireAdminSession: async () => ({
    ok: false,
    code: 'forbidden',
    reason: 'Authenticated account does not have admin privileges.',
  }),
  database: fakeDatabase,
};

const rejectingSessionDeps: NativeLobbyGuardDependencies = {
  internalSecret: SECRET,
  requireAuthenticatedSession: async () => ({
    ok: false,
    reason: 'no bearer token supplied',
    code: 'missing_token',
  }),
  requireAdminSession: async () => ({
    ok: false,
    code: 'unauthorized',
    reason: 'Admin session validation failed: upstream session check rejected the request.',
  }),
  database: fakeDatabase,
};

// why: WP-802 — an admin session: both the session and the D-15902 admin check pass.
const adminSessionDeps: NativeLobbyGuardDependencies = {
  internalSecret: SECRET,
  requireAuthenticatedSession: async () => ({ ok: true, value: 'acct-admin' }),
  requireAdminSession: async () => ({ ok: true, accountId: 'acct-admin' as never }),
  database: fakeDatabase,
};

// why: restated literally (not imported) so the assertion proves the guard's
// output, mirroring the adminSession.ts reason-string test posture.
const NON_ADMIN_NATIVE_CREATE_MESSAGE =
  'Matches are created through the /api/match routes; this native create route ' +
  'accepts only a server-internal delegation or an admin session.';

describe('nativeLobbyGuard (WP-308)', () => {
  test('POST create with no secret and no session returns 401 and does not pass through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/create', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(ctx.status, 401);
    assert.match(
      (ctx.body as { error: string }).error,
      /signed-in account is required/,
    );
    // why: rejection must NOT reach the downstream lobby router.
    assert.equal(nextCalls, 0);
  });

  test('POST join with no secret and no session returns 401 and does not pass through', async () => {
    const ctx = makeContext(
      'POST',
      '/games/legendary-arena/match-42/join',
      {},
    );
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(ctx.status, 401);
    assert.equal(nextCalls, 0);
  });

  test('POST create with a present-but-wrong secret value returns 401 (value-exact, not presence-only)', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      [INTERNAL_DELEGATION_HEADER]: `${SECRET}-tampered`,
    });
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(ctx.status, 401);
    assert.equal(nextCalls, 0);
  });

  test('POST create carrying the valid internal secret passes through (no session needed)', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      [INTERNAL_DELEGATION_HEADER]: SECRET,
    });
    // why: even with a session-rejecting orchestrator, the secret alone admits
    // the loopback delegation.
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
    assert.equal(ctx.body, undefined);
  });

  test('POST join carrying the valid internal secret passes through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-7/join', {
      [INTERNAL_DELEGATION_HEADER]: SECRET,
    });
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('POST create with a valid non-admin session (no secret) returns 403 and does not pass through', async () => {
    // why: WP-802 / D-24689 §2 — native create admits only the internal
    // delegation or an admin session; a signed-in non-admin is refused.
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

    assert.equal(ctx.status, 403);
    assert.equal(
      (ctx.body as { error: string }).error,
      NON_ADMIN_NATIVE_CREATE_MESSAGE,
    );
    assert.equal(nextCalls, 0);
  });

  test('GET match list is untouched — passes through without an auth check', async () => {
    const ctx = makeContext('GET', '/games/legendary-arena', {});
    // why: a session-rejecting orchestrator would 401 if the guard consulted it;
    // the GET list must never reach the auth branch at all.
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('an unrelated /api/* path is untouched — passes through', async () => {
    const ctx = makeContext('POST', '/api/match/autoplay', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('a POST to the native game root (not create/join) is untouched', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });
});

// why: boardgame.io 0.50.2's lobby router (@koa/router 10.1.1, defaults
// `strict: false`, `sensitive: false`) matches the raw `ctx.path` with an
// optional trailing slash and no case sensitivity, and decodes `:name`
// before looking up the game. Every spelling below reaches the native
// create/join handler, so every one must be gated (D-24691). `ctx.path` is
// the raw, undecoded path — the `%2D` cases are exactly what the guard sees.
const CREATE_PATH_VARIANTS = [
  '/games/legendary-arena/create/',
  '/games/legendary-arena/CREATE',
  '/games/legendary-arena/Create/',
  '/GAMES/legendary-arena/create',
  '/games/legendary%2Darena/create',
  '/games/legendary%2darena/create/',
];

const JOIN_PATH_VARIANTS = [
  '/games/legendary-arena/match-42/join/',
  '/games/legendary-arena/match-42/JOIN',
  '/games/legendary-arena/match-42/Join/',
  '/GAMES/legendary-arena/match-42/join',
  '/games/legendary%2Darena/match-42/join',
  '/games/legendary%2darena/match-42/join/',
];

describe('nativeLobbyGuard router-variant paths (D-24691)', () => {
  for (const variantPath of [...CREATE_PATH_VARIANTS, ...JOIN_PATH_VARIANTS]) {
    test(`POST ${variantPath} with no secret and no session returns 401 and does not pass through`, async () => {
      const ctx = makeContext('POST', variantPath, {});
      const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

      assert.equal(ctx.status, 401);
      assert.match(
        (ctx.body as { error: string }).error,
        /signed-in account is required/,
      );
      assert.equal(nextCalls, 0);
    });
  }

  test('a variant create path carrying the valid internal secret still passes through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/CREATE/', {
      [INTERNAL_DELEGATION_HEADER]: SECRET,
    });
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('a variant join path with a valid session still passes through', async () => {
    const ctx = makeContext('POST', '/games/legendary%2Darena/m-7/join/', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('a GET on a variant create path is untouched (POST-only gate)', async () => {
    const ctx = makeContext('GET', '/games/legendary-arena/CREATE/', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('a POST with extra segments after join is untouched (no router match downstream)', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-7/join/extra', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });
});

// why: WP-802 / D-24689 §2 — native create and boardgame.io's playAgain create a
// match from caller setupData the guard can't read, so they admit only the
// internal delegation or an admin session. Join keeps its secret-or-session rule.
// (The no-session 401 on create/join path variants is pinned above, D-24691.)
describe('nativeLobbyGuard admin-only native create and playAgain (WP-802 / D-24689)', () => {
  test('an admin session admits a native create', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      authorization: 'Bearer admin-token',
    });
    const { nextCalls } = await runGuard(adminSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('an admin session admits a native playAgain', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-1/playAgain', {
      authorization: 'Bearer admin-token',
    });
    const { nextCalls } = await runGuard(adminSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  test('a non-admin session gets 403 on playAgain with the locked message and no pass-through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-1/playAgain', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

    assert.equal(ctx.status, 403);
    assert.equal((ctx.body as { error: string }).error, NON_ADMIN_NATIVE_CREATE_MESSAGE);
    assert.equal(nextCalls, 0);
  });

  test('a playAgain with no session gets 401 and does not pass through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-1/playAgain', {});
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(ctx.status, 401);
    assert.match((ctx.body as { error: string }).error, /signed-in account is required/);
    assert.equal(nextCalls, 0);
  });

  test('a playAgain carrying the valid internal secret passes through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-1/playAgain', {
      [INTERNAL_DELEGATION_HEADER]: SECRET,
    });
    const { nextCalls } = await runGuard(rejectingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });

  for (const variantPath of [
    '/games/legendary-arena/create/',
    '/games/legendary-arena/CREATE',
    '/games/legendary%2Darena/create',
    '/games/legendary-arena/m-1/playagain',
    '/games/legendary-arena/m-1/PLAYAGAIN/',
  ]) {
    test(`a non-admin session gets 403 on ${variantPath} and does not pass through`, async () => {
      // why: the path is passed raw — Koa's ctx.path is undecoded, which is what
      // the case-insensitive, trailing-slash-tolerant patterns are built for.
      const ctx = makeContext('POST', variantPath, { authorization: 'Bearer real-token' });
      const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

      assert.equal(ctx.status, 403);
      assert.equal(nextCalls, 0);
    });
  }

  test('an admin lookup failure on native create returns 500 and does not pass through', async () => {
    const lookupFailedDeps: NativeLobbyGuardDependencies = {
      ...acceptingSessionDeps,
      requireAdminSession: async () => ({
        ok: false,
        code: 'lookup_failed',
        reason: 'Failed to read admin authorization for the authenticated account.',
      }),
    };
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(lookupFailedDeps, ctx);

    assert.equal(ctx.status, 500);
    assert.equal(
      (ctx.body as { error: string }).error,
      'The admin check for this native create could not be completed; try again in a moment.',
    );
    assert.equal(nextCalls, 0);
  });

  test('a non-admin session still admits a native join', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/m-1/join', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
  });
});
