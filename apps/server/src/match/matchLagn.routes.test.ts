/**
 * Tests for the current-match LAGN HTTP route (WP-361 / EC-391).
 *
 * Fully pure — a fake Koa router captures the handler, a fake
 * `requireAuthenticatedSession` drives the acting identity, and a fake
 * `MatchLagnLogic` seam returns canned composition + seat data, so no real
 * database is touched. Asserts the auth-first gate, the fail-closed 404
 * (unknown/unprojectable indistinguishable), the participant 403, the 200
 * `{ lagn }` envelope, the 500 projection-failure path, and `Cache-Control:
 * no-store` on every path.
 *
 * Authority: WP-361 §Scope (In) §F + §Contract; EC-391; D-24153.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import {
  registerMatchLagnRoutes,
  type MatchLagnLogic,
  type MatchLagnRouteDependencies,
  type RequireAuthenticatedSessionResult,
} from './matchLagn.routes.js';
import type { MatchLagnComposition } from './matchLagn.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
  req: { headers: Record<string, string> };
  params: { [key: string]: string };
  status: number;
  body: unknown;
  headers: Record<string, string>;
  set(field: string, value: string): void;
}

class FakeRouter {
  readonly handlers = new Map<string, Handler>();
  get(path: string, handler: Handler): void {
    this.handlers.set(`GET ${path}`, handler);
  }
}

function makeContext(matchId: string): FakeContext {
  const headers: Record<string, string> = {};
  return {
    req: { headers: {} },
    params: { matchId },
    status: 0,
    body: undefined,
    headers,
    set(field: string, value: string): void {
      headers[field] = value;
    },
  };
}

const VALID_COMPOSITION: MatchLagnComposition = {
  schemeId: 'core/the-legacy-virus',
  mastermindId: 'core/loki-god-of-mischief',
  villainGroupIds: ['core/hydra'],
  henchmanGroupIds: ['core/doombot-legion'],
  heroDeckIds: ['core/spider-man'],
  bystandersCount: 12,
  woundsCount: 30,
  officersCount: 20,
  sidekicksCount: 0,
};

const CALLER: AccountId = 'account-caller' as AccountId;

/** A fake registry exposing only the `listCards()` the resolver uses. */
const EMPTY_REGISTRY = { listCards: () => [] } as unknown as CardRegistry;

/** Deps with a session that authenticates as `CALLER` unless overridden. */
function authedDeps(): MatchLagnRouteDependencies {
  const sessionResult: RequireAuthenticatedSessionResult = {
    ok: true,
    value: CALLER,
  };
  return {
    requireAuthenticatedSession: async () => sessionResult,
    registry: EMPTY_REGISTRY,
  };
}

/** A logic seam returning the supplied composition + seats. */
function logicSeam(options: {
  configuration:
    | { matchConfiguration: MatchLagnComposition; numPlayers: number }
    | null;
  seats: { playerId: string; accountId: AccountId }[];
}): MatchLagnLogic {
  return {
    readMatchConfigurationForLagn: async () => options.configuration,
    readSeatAccounts: async () => options.seats,
  };
}

const FAKE_DB = {} as unknown as DatabaseClient;

function handlerOf(router: FakeRouter): Handler {
  const handler = router.handlers.get('GET /api/match/:matchId/lagn');
  assert.ok(handler, 'route GET /api/match/:matchId/lagn is registered');
  return handler;
}

describe('registerMatchLagnRoutes', () => {
  test('registers the GET /api/match/:matchId/lagn route', () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, FAKE_DB, authedDeps());
    assert.ok(router.handlers.has('GET /api/match/:matchId/lagn'));
  });

  test('rejects an unauthenticated caller with 401 before touching the logic', async () => {
    const router = new FakeRouter();
    let logicCalled = false;
    const deps: MatchLagnRouteDependencies = {
      requireAuthenticatedSession: async () => ({
        ok: false,
        reason: 'No session token was supplied.',
        code: 'missing_token',
      }),
      registry: EMPTY_REGISTRY,
    };
    const seam: MatchLagnLogic = {
      readMatchConfigurationForLagn: async () => {
        logicCalled = true;
        return null;
      },
      readSeatAccounts: async () => {
        logicCalled = true;
        return [];
      },
    };
    registerMatchLagnRoutes(router, FAKE_DB, deps, seam);
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
    assert.equal(logicCalled, false);
  });

  test('returns 404 match_not_found for an unknown / unprojectable match', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      authedDeps(),
      logicSeam({ configuration: null, seats: [] }),
    );
    const context = makeContext('missing');
    await handlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('returns 403 not_a_participant when the caller is not a seat', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      authedDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 },
        seats: [{ playerId: '0', accountId: 'someone-else' as AccountId }],
      }),
    );
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 403);
    assert.deepEqual(context.body, { error: 'not_a_participant' });
  });

  test('returns 200 { lagn } (single key, valid Tier-1) for a participant', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      authedDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 },
        seats: [{ playerId: '0', accountId: CALLER }],
      }),
    );
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 200);
    assert.equal(context.headers['Cache-Control'], 'no-store');
    const body = context.body as Record<string, unknown>;
    assert.deepEqual(Object.keys(body), ['lagn']);
    assert.equal(validate(body.lagn).valid, true);
  });

  test('returns 500 lagn_projection_failed when the projected document is invalid', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      authedDeps(),
      logicSeam({
        // numPlayers 0 → player_count fails LAGN validation
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 0 },
        seats: [{ playerId: '0', accountId: CALLER }],
      }),
    );
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'lagn_projection_failed' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });
});
