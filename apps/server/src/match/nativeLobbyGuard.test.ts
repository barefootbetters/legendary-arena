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

const acceptingSessionDeps: NativeLobbyGuardDependencies = {
  internalSecret: SECRET,
  requireAuthenticatedSession: async () => ({ ok: true, value: 'acct-1' }),
  database: fakeDatabase,
};

const rejectingSessionDeps: NativeLobbyGuardDependencies = {
  internalSecret: SECRET,
  requireAuthenticatedSession: async () => ({
    ok: false,
    reason: 'no bearer token supplied',
    code: 'missing_token',
  }),
  database: fakeDatabase,
};

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

  test('POST create with a valid session (no secret) passes through', async () => {
    const ctx = makeContext('POST', '/games/legendary-arena/create', {
      authorization: 'Bearer real-token',
    });
    const { nextCalls } = await runGuard(acceptingSessionDeps, ctx);

    assert.equal(nextCalls, 1);
    assert.equal(ctx.status, 0);
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
