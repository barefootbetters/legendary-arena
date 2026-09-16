/**
 * Tests for the finished-match seat-identities HTTP route
 * (INFRA: endgame seat names).
 *
 * Fully pure — a fake Koa router captures the handler and a fake
 * `SeatIdentitiesLogic` seam returns canned configuration / gameover / roster
 * data, so no real database is touched. The route is a PUBLIC read (no session or
 * participant gate), gated to FINISHED matches, so the tests assert: the
 * fail-closed 404 for an unknown/unprojectable match, the 404 `match_not_finished`
 * before gameover, the 200 `{ seatIdentities }` roster for a finished match, the
 * fail-closed 500 on an uncaught throw, and `Cache-Control: no-store` on every
 * path.
 *
 * Authority: WP-593 / D-24402 (the `seatIdentities` projection); WP-361 /
 * matchLagn.routes.test.ts (harness precedent); D-24169 (finished-match gate);
 * D-24446 (public read); WP-115 / D-11504 (Cache-Control first-statement lock).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  registerSeatIdentitiesRoute,
  type SeatIdentitiesLogic,
} from './seatIdentities.routes.js';
import type { MatchLagnComposition, StoredGameover } from './matchLagn.logic.js';
import type { MatchSeatIdentity } from './seatAccount.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

type Handler = (koaContext: FakeContext) => Promise<void> | void;

interface FakeContext {
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

const FINISHED: StoredGameover = { outcome: 'scheme-wins' } as unknown as StoredGameover;

const FAKE_DB = {} as unknown as DatabaseClient;

/**
 * A logic seam returning the supplied configuration / gameover / roster. Defaults
 * cover the common finished-match case; a test overrides any field it varies.
 */
function logicSeam(options: {
  configuration?:
    | { matchConfiguration: MatchLagnComposition; numPlayers: number }
    | null;
  gameover?: StoredGameover | null;
  seatIdentities?: MatchSeatIdentity[];
  throwOn?: 'configuration' | 'gameover' | 'identities';
}): SeatIdentitiesLogic {
  return {
    readMatchConfigurationForLagn: async () => {
      if (options.throwOn === 'configuration') {
        throw new Error('Simulated initial_state read failure.');
      }
      return options.configuration === undefined
        ? { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 }
        : options.configuration;
    },
    readMatchGameover: async () => {
      if (options.throwOn === 'gameover') {
        throw new Error('Simulated gameover read failure.');
      }
      return options.gameover === undefined ? FINISHED : options.gameover;
    },
    readSeatIdentities: async () => {
      if (options.throwOn === 'identities') {
        throw new Error('Simulated seat-identities read failure.');
      }
      return (
        options.seatIdentities ?? [
          { playerId: '0', isBot: false, handle: 'jeff' },
          { playerId: '1', isBot: true, handle: null },
        ]
      );
    },
  };
}

function handlerOf(router: FakeRouter): Handler {
  const handler = router.handlers.get('GET /api/match/:matchId/seat-identities');
  assert.ok(handler, 'the seat-identities GET route must be registered');
  return handler;
}

function routerFor(logic: SeatIdentitiesLogic): FakeRouter {
  const router = new FakeRouter();
  registerSeatIdentitiesRoute(router, FAKE_DB, logic);
  return router;
}

describe('GET /api/match/:matchId/seat-identities (INFRA: endgame seat names)', () => {
  test('registers exactly the one GET route', () => {
    const router = routerFor(logicSeam({}));
    assert.deepEqual([...router.handlers.keys()], [
      'GET /api/match/:matchId/seat-identities',
    ]);
  });

  test('a finished match returns 200 with the full per-seat roster', async () => {
    const router = routerFor(logicSeam({}));
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 200);
    assert.deepEqual(context.body, {
      seatIdentities: [
        { playerId: '0', isBot: false, handle: 'jeff' },
        { playerId: '1', isBot: true, handle: null },
      ],
    });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('an unknown / unprojectable match returns 404 match_not_found', async () => {
    const router = routerFor(logicSeam({ configuration: null }));
    const context = makeContext('ghost');
    await handlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('a still-in-progress match returns 404 match_not_finished', async () => {
    const router = routerFor(logicSeam({ gameover: null }));
    const context = makeContext('live');
    await handlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_finished' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('an empty matchId fails closed as 404 match_not_found', async () => {
    const router = routerFor(logicSeam({}));
    const context = makeContext('');
    await handlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('an uncaught read failure surfaces as a typed 500 with no internals', async () => {
    const router = routerFor(logicSeam({ throwOn: 'identities' }));
    const context = makeContext('match-1');
    await handlerOf(router)(context);

    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });
});
