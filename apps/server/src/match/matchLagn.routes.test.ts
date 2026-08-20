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
import type {
  MatchLagnComposition,
  StoredGameover,
  ResultPlayerIdentity,
} from './matchLagn.logic.js';
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
// why: buildNameResolver reads the group-level `listSets()` + `getSet()` surface;
// these route tests assert on ids (names resolve to the ext_id fallback), so an
// empty set index is sufficient.
const EMPTY_REGISTRY = {
  listSets: () => [],
  getSet: () => undefined,
  listCards: () => [],
} as unknown as CardRegistry;

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

/**
 * A logic seam returning the supplied composition + seats (+ optional gameover /
 * identities for the result-lagn route). `gameover` and `identities` default to
 * the "no result data" case, so the setup-route tests below need not supply them.
 */
function logicSeam(options: {
  configuration:
    | { matchConfiguration: MatchLagnComposition; numPlayers: number }
    | null;
  seats: { playerId: string; accountId: AccountId }[];
  gameover?: StoredGameover | null;
  identities?: Map<AccountId, ResultPlayerIdentity>;
}): MatchLagnLogic {
  return {
    readMatchConfigurationForLagn: async () => options.configuration,
    readSeatAccounts: async () => options.seats,
    readMatchGameover: async () => options.gameover ?? null,
    readAccountPublicIdentities: async () => options.identities ?? new Map(),
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
      readMatchGameover: async () => {
        logicCalled = true;
        return null;
      },
      readAccountPublicIdentities: async () => {
        logicCalled = true;
        return new Map();
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

// ============================================================================
// Result-LAGN producer route (WP-406 / D-24216)
// ============================================================================

/** Deps with NO session gate — the result route is guest-readable. */
function guestDeps(): MatchLagnRouteDependencies {
  return {
    // why: the result route never calls this — a throwing stub proves the route
    // does not gate on a session (a guest read).
    requireAuthenticatedSession: async () => {
      throw new Error('result-lagn must not require a session');
    },
    registry: EMPTY_REGISTRY,
  };
}

function resultHandlerOf(router: FakeRouter): Handler {
  const handler = router.handlers.get('GET /api/match/:matchId/result-lagn');
  assert.ok(handler, 'route GET /api/match/:matchId/result-lagn is registered');
  return handler;
}

/** identities map from `{ accountId: [handle, name] }` tuples. */
function identitiesOf(
  entries: Record<string, [string | null, string | null]>,
): Map<AccountId, ResultPlayerIdentity> {
  const map = new Map<AccountId, ResultPlayerIdentity>();
  for (const [accountId, [displayHandle, displayName]] of Object.entries(entries)) {
    map.set(accountId as AccountId, { displayHandle, displayName });
  }
  return map;
}

describe('registerMatchLagnRoutes — result-lagn producer', () => {
  test('registers the GET /api/match/:matchId/result-lagn route', () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, FAKE_DB, guestDeps());
    assert.ok(router.handlers.has('GET /api/match/:matchId/result-lagn'));
  });

  test('AC-5: 404 not_found for an unknown / unprojectable match', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({ configuration: null, seats: [] }),
    );
    const context = makeContext('missing');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('AC-5: 404 match_not_finished for an in-progress match (no gameover)', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 },
        seats: [{ playerId: '0', accountId: CALLER }],
        gameover: null,
      }),
    );
    const context = makeContext('in-progress');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_finished' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('AC-1/AC-2: 200 { lagn } — valid 1.4.0 with result + players[], handle as player_id, never AccountId', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 },
        seats: [
          { playerId: '0', accountId: 'account-ana' as AccountId },
          { playerId: '1', accountId: 'account-devon' as AccountId },
        ],
        gameover: { outcome: 'heroes-win' },
        identities: identitiesOf({
          'account-ana': ['ana-handle', 'Ana'],
          'account-devon': ['devon-handle', null],
        }),
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    assert.equal(context.headers['Cache-Control'], 'no-store');
    const body = context.body as { lagn: Record<string, unknown> };
    assert.deepEqual(Object.keys(body), ['lagn']);
    assert.equal(validate(body.lagn).valid, true);
    assert.equal(body.lagn.lagn_version, '1.4.0');
    assert.deepEqual(body.lagn.result, { outcome: 'victory' });
    assert.equal(body.lagn.scoring_profile, 'classic');

    const players = body.lagn.players as {
      seat: number;
      player_id: string;
      display_name?: string;
    }[];
    assert.equal(players.length, 2);
    // player_id is the claimed handle, never the AccountId (AC-2 / D-24214)
    assert.deepEqual(
      players.map((entry) => entry.player_id),
      ['ana-handle', 'devon-handle'],
    );
    const serialized = JSON.stringify(body.lagn);
    assert.equal(serialized.includes('account-ana'), false);
    assert.equal(serialized.includes('account-devon'), false);
    // display_name present when claimed, absent otherwise
    assert.equal(players[0].display_name, 'Ana');
    assert.equal(players[1].display_name, undefined);
  });

  test('AC-3/AC-4: a handleless seat is omitted; a bot seat never appears', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 3 },
        // seat 2 is a bot → no match_seat_accounts row → absent from `seats`
        seats: [
          { playerId: '0', accountId: 'account-ana' as AccountId },
          { playerId: '1', accountId: 'account-noh' as AccountId },
        ],
        gameover: { outcome: 'scheme-wins' },
        identities: identitiesOf({
          'account-ana': ['ana-handle', 'Ana'],
          'account-noh': [null, 'Unclaimed'], // no claimed handle → omitted
        }),
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    assert.deepEqual(body.lagn.result, { outcome: 'defeat' });
    const players = body.lagn.players as { seat: number }[];
    // only the claimed seat (0) survives; the handleless seat 1 and bot seat 2 omitted
    assert.equal(players.length, 1);
    assert.equal(players[0].seat, 0);
  });

  test('AC-3: players[] is omitted ENTIRELY (not []) when no seat has a claimed handle', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: 'account-noh' as AccountId }],
        gameover: { outcome: 'heroes-win' },
        identities: identitiesOf({ 'account-noh': [null, 'Unclaimed'] }),
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    // the key is absent, not an empty array
    assert.equal('players' in body.lagn, false);
    assert.deepEqual(body.lagn.result, { outcome: 'victory' });
  });

  test('a deck-exhaustion tie omits the result block but still returns a valid document', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: CALLER }],
        gameover: { outcome: 'tie' },
        identities: identitiesOf({ 'account-caller': ['caller-handle', 'Caller'] }),
      }),
    );
    const context = makeContext('tie-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal('result' in body.lagn, false);
  });

  test('500 lagn_projection_failed when the projected document is invalid', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      guestDeps(),
      logicSeam({
        // numPlayers 0 → player_count fails LAGN validation
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 0 },
        seats: [],
        gameover: { outcome: 'heroes-win' },
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'lagn_projection_failed' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });
});
