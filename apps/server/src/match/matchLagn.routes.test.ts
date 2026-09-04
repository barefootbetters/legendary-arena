/**
 * Tests for the current-match LAGN HTTP route (WP-361 / EC-391).
 *
 * Fully pure — a fake Koa router captures the handler and a fake `MatchLagnLogic`
 * seam returns canned composition + seat data, so no real database is touched.
 * The setup route is a PUBLIC read (D-24446): no session or participant gate, so
 * the tests assert the fail-closed 404 (unknown/unprojectable indistinguishable),
 * the 200 `{ lagn }` envelope for ANY caller (including a guest with no seat), the
 * 500 projection-failure path, and `Cache-Control: no-store` on every path.
 *
 * Authority: WP-361 §Scope (In) §F + §Contract; EC-391; D-24153; D-24446
 * (public-read access change).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import {
  registerMatchLagnRoutes,
  type MatchLagnLogic,
  type MatchLagnRouteDependencies,
} from './matchLagn.routes.js';
import type {
  MatchLagnComposition,
  StoredGameover,
  ResultPlayerIdentity,
} from './matchLagn.logic.js';
import type { BattlePlanRecord } from './battlePlan.types.js';
import type { CompetitiveScoreRecord } from '../competition/competition.types.js';
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

/** The route deps — since D-24446 both routes are public reads, only the
 * registry is needed (no session gate). */
function deps(): MatchLagnRouteDependencies {
  return { registry: EMPTY_REGISTRY };
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
  battlePlan?: BattlePlanRecord | null;
  replayHash?: string | null;
  score?: CompetitiveScoreRecord | null;
}): MatchLagnLogic {
  return {
    readMatchConfigurationForLagn: async () => options.configuration,
    readSeatAccounts: async () => options.seats,
    readMatchGameover: async () => options.gameover ?? null,
    readAccountPublicIdentities: async () => options.identities ?? new Map(),
    // why: the WP-641 Battle-Plan / report-card reads default to the "no block"
    // case (null), so every existing result-lagn case still emits no `battle_plan`
    // / `result.score`; a case that wants them supplies the record + hash.
    readBattlePlan: async () => options.battlePlan ?? null,
    readReplayHashByMatchId: async () => options.replayHash ?? null,
    findCompetitiveScore: async () => options.score ?? null,
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
    registerMatchLagnRoutes(router, FAKE_DB, deps());
    assert.ok(router.handlers.has('GET /api/match/:matchId/lagn'));
  });

  test('returns 404 match_not_found for an unknown / unprojectable match', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({ configuration: null, seats: [] }),
    );
    const context = makeContext('missing');
    await handlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'match_not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('D-24446: returns 200 { lagn } for ANY caller — no session, no seat (a guest)', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      // why: empty seats models a guest / non-participant caller — the public
      // read serves the loadout regardless of who asks.
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 2 },
        seats: [],
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
      deps(),
      logicSeam({
        // numPlayers 0 → player_count fails LAGN validation
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 0 },
        seats: [],
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
    registerMatchLagnRoutes(router, FAKE_DB, deps());
    assert.ok(router.handlers.has('GET /api/match/:matchId/result-lagn'));
  });

  test('AC-5: 404 not_found for an unknown / unprojectable match', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
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
      deps(),
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

  test('AC-1/AC-2: 200 { lagn } — valid 1.5.0 with result + players[], handle as player_id, never AccountId', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
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
    assert.equal(body.lagn.lagn_version, '1.5.0');
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
      deps(),
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
      deps(),
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
      deps(),
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

  test('WP-641: a scored match with a plan wires battle_plan + result.score into the document', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: CALLER }],
        gameover: { outcome: 'heroes-win' },
        identities: identitiesOf({ 'account-caller': ['caller-handle', 'Caller'] }),
        battlePlan: {
          matchId: 'finished-match',
          preBattle: 'Recruit Covert early.',
          battleAdjustments: null,
          postBattle: 'Clutch fight on turn 9.',
          updatedByExtId: 'account-caller',
          createdAt: '2026-09-04T00:00:00.000Z',
          updatedAt: '2026-09-04T00:00:00.000Z',
        } as BattlePlanRecord,
        replayHash: 'sha256:deadbeef',
        score: {
          submissionId: 1,
          accountId: CALLER,
          replayHash: 'sha256:deadbeef',
          scenarioKey: 'core/loki-god-of-mischief|core/the-legacy-virus|1',
          rawScore: 3900,
          finalScore: 100,
          scoreBreakdown: { parScore: 3800 },
          parVersion: 'par-v3',
          scoringConfigVersion: 7,
          stateHash: 'sha256:cafef00d',
          createdAt: '2026-09-04T00:00:00.000Z',
          outcome: 'heroes-win',
          playerCount: 1,
          isRankedEligible: true,
          teamKey: null,
          henchmanKey: null,
        } as unknown as CompetitiveScoreRecord,
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal(body.lagn.lagn_version, '1.5.0');
    // battle_plan rides — the two present phases, the null one omitted
    assert.deepEqual(body.lagn.battle_plan, {
      pre_battle: 'Recruit Covert early.',
      post_battle: 'Clutch fight on turn 9.',
    });
    // result.score rides nested under result (outcome present)
    assert.deepEqual(body.lagn.result, {
      outcome: 'victory',
      score: {
        raw_score: 3900,
        par_score: 3800,
        final_score: 100,
        grade: 'b',
        scoring_config_version: 7,
        par_version: 'par-v3',
      },
    });
  });

  test('WP-641: an unscored match (score row null) omits result.score; battle_plan omitted with no plan row', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: CALLER }],
        gameover: { outcome: 'heroes-win' },
        identities: identitiesOf({ 'account-caller': ['caller-handle', 'Caller'] }),
        // replay artifact exists but no competitive_scores row → score omitted
        replayHash: 'sha256:deadbeef',
        score: null,
        battlePlan: null,
      }),
    );
    const context = makeContext('finished-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal('battle_plan' in body.lagn, false);
    assert.deepEqual(body.lagn.result, { outcome: 'victory' });
    assert.equal('score' in (body.lagn.result as Record<string, unknown>), false);
  });

  test('500 lagn_projection_failed when the projected document is invalid', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
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
