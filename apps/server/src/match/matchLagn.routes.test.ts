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

import { validate, LAGN_VERSION } from '@legendary-arena/lagn';
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
/** The seam `buildVerifiedReplayExecution` return — a verified block or refusal. */
type VerifiedSeam =
  | { isVerified: true; execution: Record<string, unknown>; gameover: unknown }
  | { isVerified: false; reason: 'operator_match' | 'not_reexecutable' };

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
  // why: the WP-810 replay-lagn seam. The artifact + verify defaults keep every
  // existing setup/result-lagn case unchanged (they never reach the new handler).
  replayArtifact?: { initialState: unknown; log: readonly unknown[] } | null;
  verified?: VerifiedSeam;
  buildId?: string;
  onVerify?: () => void;
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
    readReplayArtifactByHash: async () => options.replayArtifact ?? null,
    buildVerifiedReplayExecution: (() => {
      options.onVerify?.();
      return (options.verified ?? { isVerified: false, reason: 'not_reexecutable' });
    }) as unknown as MatchLagnLogic['buildVerifiedReplayExecution'],
    getBuildId: () => options.buildId ?? 'build-sha',
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
    assert.equal(body.lagn.lagn_version, LAGN_VERSION);
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
    const body = context.body as { lagn: Record<string, unknown>; resultOmittedReason?: string };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal('result' in body.lagn, false);
    // WP-812 / D-24720: the envelope names the tie beside `lagn`, never inside it.
    assert.deepEqual(Object.keys(body), ['lagn', 'resultOmittedReason']);
    assert.equal(body.resultOmittedReason, 'tie');
  });

  test('WP-812: a match the players ended early is reported ended-early, not tie', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: CALLER }],
        // why: the engine's stored verdict for "End Game" (D-24306) — a 'tie'
        // that the route must pass to the mapping with its endedEarly flag.
        gameover: { outcome: 'tie', reason: 'The players ended the match early.', endedEarly: true },
        identities: identitiesOf({ 'account-caller': ['caller-handle', 'Caller'] }),
      }),
    );
    const context = makeContext('ended-early-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown>; resultOmittedReason?: string };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal('result' in body.lagn, false);
    assert.equal(body.resultOmittedReason, 'ended-early');
  });

  test('WP-812: an unknown verdict omits result and the envelope says unknown, not tie', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: { matchConfiguration: VALID_COMPOSITION, numPlayers: 1 },
        seats: [{ playerId: '0', accountId: CALLER }],
        // why: `{}` is what WP-811 serves for an unswept legacy artifact and
        // stores for a hash mismatch: finished, outcome unknown.
        gameover: {},
        identities: identitiesOf({ 'account-caller': ['caller-handle', 'Caller'] }),
      }),
    );
    const context = makeContext('unknown-verdict-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown>; resultOmittedReason?: string };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal('result' in body.lagn, false);
    assert.equal('resultOmittedReason' in body.lagn, false);
    assert.equal(body.resultOmittedReason, 'unknown');
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
    assert.equal(body.lagn.lagn_version, LAGN_VERSION);
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

// ============================================================================
// Reaped-match fallback through the PRODUCTION logic (WP-811 / D-24719)
// ============================================================================

/**
 * A fake pool for the production logic module: the live `bgio.matches` row is
 * gone (reaped), the `bgio.replay_artifacts` copy answers the composition and
 * verdict reads, and every domain read (seats, identities, battle plan, replay
 * hash) is empty. No seam is injected, so this exercises the real readers.
 */
function reapedMatchDatabase(artifact: { initialState: unknown; gameover: unknown } | null) {
  return {
    query: async (text: string) => {
      if (artifact !== null && /SELECT initial_state FROM bgio\.replay_artifacts/.test(text)) {
        return { rows: [{ initial_state: artifact.initialState }] };
      }
      if (artifact !== null && /SELECT gameover FROM bgio\.replay_artifacts/.test(text)) {
        return { rows: [{ gameover: artifact.gameover }] };
      }
      return { rows: [] };
    },
  } as unknown as DatabaseClient;
}

const REAPED_ARTIFACT = {
  initialState: { G: { matchConfiguration: VALID_COMPOSITION }, ctx: { numPlayers: 1 } },
  gameover: { outcome: 'heroes-win', reason: 'The Mastermind was defeated.' },
};

describe('WP-811: a reaped match stays readable through the production logic', () => {
  test('GET /lagn serves the setup from the durable artifact', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, reapedMatchDatabase(REAPED_ARTIFACT), deps());
    const context = makeContext('reaped-match');
    await handlerOf(router)(context);

    assert.equal(context.status, 200);
    const lagn = (context.body as { lagn: Record<string, unknown> }).lagn;
    assert.equal(validate(lagn).valid, true);
    assert.equal(lagn.game_id, 'reaped-match');
    assert.equal(lagn.player_count, 1);
  });

  test('GET /result-lagn serves the result, outcome included, from the artifact', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, reapedMatchDatabase(REAPED_ARTIFACT), deps());
    const handler = router.handlers.get('GET /api/match/:matchId/result-lagn');
    assert.ok(handler);
    const context = makeContext('reaped-match');
    await handler(context);

    assert.equal(context.status, 200);
    const lagn = (context.body as { lagn: Record<string, unknown> }).lagn;
    assert.equal(validate(lagn).valid, true);
    assert.deepEqual(lagn.result, { outcome: 'victory' });
  });

  test('GET /result-lagn on a pre-046 artifact omits the result block but still serves', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      reapedMatchDatabase({ initialState: REAPED_ARTIFACT.initialState, gameover: null }),
      deps(),
    );
    const handler = router.handlers.get('GET /api/match/:matchId/result-lagn')!;
    const context = makeContext('legacy-match');
    await handler(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown>; resultOmittedReason?: string };
    const lagn = body.lagn;
    assert.equal(validate(lagn).valid, true);
    assert.equal(lagn.result, undefined);
    // WP-812 / D-24720: the real VERDICT_NOT_RECORDED path reads as unknown,
    // never as a tie, so the Hall of Legends says "Outcome not recorded".
    assert.equal(body.resultOmittedReason, 'unknown');
  });

  test('a match in neither store is still the fail-closed 404 on both routes', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, reapedMatchDatabase(null), deps());
    const setupContext = makeContext('unknown-match');
    await handlerOf(router)(setupContext);
    assert.equal(setupContext.status, 404);
    assert.deepEqual(setupContext.body, { error: 'match_not_found' });

    const resultContext = makeContext('unknown-match');
    await router.handlers.get('GET /api/match/:matchId/result-lagn')!(resultContext);
    assert.equal(resultContext.status, 404);
    assert.deepEqual(resultContext.body, { error: 'not_found' });
  });
});

// ============================================================================
// Operator matches (D-24717)
// ============================================================================

const OPERATOR_COMPOSITION: MatchLagnComposition = {
  ...VALID_COMPOSITION,
  isDebugMatch: true,
};

describe('registerMatchLagnRoutes — operator matches (D-24717)', () => {
  test('result-lagn refuses a finished operator match with the unknown-match 404, before any further read', async () => {
    const router = new FakeRouter();
    const readsAfterGate: string[] = [];
    const seam = logicSeam({
      configuration: { matchConfiguration: OPERATOR_COMPOSITION, numPlayers: 1 },
      seats: [{ playerId: '0', accountId: CALLER }],
      gameover: { outcome: 'heroes-win' },
      identities: identitiesOf({ 'account-caller': ['caller-handle', null] }),
    });
    registerMatchLagnRoutes(router, FAKE_DB, deps(), {
      ...seam,
      readMatchGameover: async (...args) => {
        readsAfterGate.push('readMatchGameover');
        return seam.readMatchGameover(...args);
      },
      readSeatAccounts: async (...args) => {
        readsAfterGate.push('readSeatAccounts');
        return seam.readSeatAccounts(...args);
      },
    });
    const context = makeContext('operator-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
    assert.deepEqual(readsAfterGate, []);
  });

  test('result-lagn still serves a finished match whose isDebugMatch is not a strict true', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: {
          matchConfiguration: { ...VALID_COMPOSITION, isDebugMatch: false },
          numPlayers: 1,
        },
        seats: [],
        gameover: { outcome: 'heroes-win' },
      }),
    );
    const context = makeContext('normal-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
  });

  test('the setup route still serves an operator match, without the flag in the document', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: { matchConfiguration: OPERATOR_COMPOSITION, numPlayers: 1 },
        seats: [],
      }),
    );
    const context = makeContext('operator-match');
    await handlerOf(router)(context);

    assert.equal(context.status, 200);
    const body = context.body as { lagn: Record<string, unknown> };
    assert.equal(validate(body.lagn).valid, true);
    assert.equal(JSON.stringify(body.lagn).includes('isDebugMatch'), false);
  });

  test('a REAPED operator match is still refused by result-lagn, through the production artifact read (D-24719)', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      reapedMatchDatabase({
        initialState: { G: { matchConfiguration: OPERATOR_COMPOSITION }, ctx: { numPlayers: 1 } },
        gameover: { outcome: 'heroes-win' },
      }),
      deps(),
    );
    const context = makeContext('reaped-operator-match');
    await resultHandlerOf(router)(context);

    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'not_found' });
  });
});

// ============================================================================
// Replay-LAGN producer route (WP-810 / EC-847 / D-24716)
// ============================================================================

function replayHandlerOf(router: FakeRouter): Handler {
  const handler = router.handlers.get('GET /api/match/:matchId/replay-lagn');
  assert.ok(handler, 'route GET /api/match/:matchId/replay-lagn is registered');
  return handler;
}

/** A context with a chosen `cf-connecting-ip`, so distinct keys hit distinct per-client buckets. */
function makeContextWithIp(matchId: string, ip: string): FakeContext {
  const context = makeContext(matchId);
  context.req.headers['cf-connecting-ip'] = ip;
  return context;
}

/** deps with an injected constant clock, so the token buckets are deterministic. */
function depsWithClock(now: () => number): MatchLagnRouteDependencies {
  return { registry: EMPTY_REGISTRY, now };
}

/** A well-formed initial state the shape check accepts: valid composition + seat count + seed. */
const VALID_INITIAL_STATE = {
  G: { matchConfiguration: VALID_COMPOSITION },
  ctx: { numPlayers: 2 },
  plugins: { random: { data: { seed: 'seed-xyz' } } },
};

/** A minimal valid `replay.execution` block (so the final `validate()` passes). */
const STUB_EXECUTION = {
  engine: 'legendary-arena',
  engine_version: '1.0.0',
  data_version: 2,
  seed: 'seed-xyz',
  moves: [{ seq: 0, seat: 0, move_name: 'setPlayerReady', args: [] }],
  final_state_hash: 'abc123',
};

/** An artifact log with `moveCount` MAKE_MOVE entries, for the budget test. */
function stubLog(moveCount: number): unknown[] {
  return Array.from({ length: moveCount }, (_unused, index) => ({
    action: { type: 'MAKE_MOVE', payload: { type: 'advanceStage', args: [], playerID: '0' } },
    _stateID: index,
    turn: 2,
    phase: 'play',
  }));
}

const CONSTANT_NOW = (): number => 1_000_000;

describe('registerMatchLagnRoutes — replay-lagn producer', () => {
  test('registers the GET /api/match/:matchId/replay-lagn route', () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, FAKE_DB, deps());
    assert.ok(router.handlers.has('GET /api/match/:matchId/replay-lagn'));
  });

  test('AC-6: 200 { lagn } with a replay.execution block and result.outcome from the verdict', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [{ playerId: '0', accountId: 'account-ana' as AccountId }],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: VALID_INITIAL_STATE, log: stubLog(3) },
        verified: { isVerified: true, execution: STUB_EXECUTION, gameover: { outcome: 'heroes-win' } },
        identities: identitiesOf({ 'account-ana': ['ana-handle', 'Ana'] }),
      }),
    );
    const context = makeContext('finished-match');
    await replayHandlerOf(router)(context);

    assert.equal(context.status, 200);
    assert.equal(context.headers['Cache-Control'], 'no-store');
    const body = context.body as { lagn: Record<string, unknown> };
    assert.deepEqual(Object.keys(body), ['lagn']);
    assert.equal(validate(body.lagn).valid, true);
    assert.equal(body.lagn.lagn_version, LAGN_VERSION);
    assert.deepEqual((body.lagn.replay as Record<string, unknown>).execution, STUB_EXECUTION);
    assert.deepEqual(body.lagn.result, { outcome: 'victory' });
  });

  test('AC-6: 404 not_found for an empty matchId', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, FAKE_DB, deps(), logicSeam({ configuration: null, seats: [] }));
    const context = makeContext('');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'not_found' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('AC-6: 404 replay_not_found when no artifact exists (null hash)', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(router, FAKE_DB, deps(), logicSeam({ configuration: null, seats: [], replayHash: null }));
    const context = makeContext('uncaptured-match');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'replay_not_found' });
  });

  test('AC-6: 404 replay_not_found when the hash resolves but the artifact is gone', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({ configuration: null, seats: [], replayHash: 'sha256:deadbeef', replayArtifact: null }),
    );
    const context = makeContext('hash-without-artifact');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'replay_not_found' });
  });

  test('AC-6: 422 operator_match from the verify seam', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: VALID_INITIAL_STATE, log: stubLog(3) },
        verified: { isVerified: false, reason: 'operator_match' },
      }),
    );
    const context = makeContext('operator-match');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 422);
    assert.deepEqual(context.body, { error: 'operator_match' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });

  test('AC-6: 422 not_reexecutable from the verify seam', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: VALID_INITIAL_STATE, log: stubLog(3) },
        verified: { isVerified: false, reason: 'not_reexecutable' },
      }),
    );
    const context = makeContext('divergent-match');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 422);
    assert.deepEqual(context.body, { error: 'not_reexecutable' });
  });

  test('AC-6: a misshaped composition is 422 not_reexecutable BEFORE the verify seam (0 verify calls)', async () => {
    let verifyCalls = 0;
    // heroDeckIds missing → shape check fails
    const missingHeroes = { G: { matchConfiguration: { ...VALID_COMPOSITION, heroDeckIds: undefined } }, ctx: { numPlayers: 2 }, plugins: { random: { data: { seed: 'seed-xyz' } } } };
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: missingHeroes, log: stubLog(3) },
        verified: { isVerified: true, execution: STUB_EXECUTION, gameover: null },
        onVerify: () => { verifyCalls += 1; },
      }),
    );
    const context = makeContext('misshaped-match');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 422);
    assert.deepEqual(context.body, { error: 'not_reexecutable' });
    assert.equal(verifyCalls, 0);
  });

  test('AC-6: a null matchConfiguration is 422 not_reexecutable BEFORE the verify seam (0 verify calls)', async () => {
    let verifyCalls = 0;
    const nullConfig = { G: { matchConfiguration: null }, ctx: { numPlayers: 2 }, plugins: { random: { data: { seed: 'seed-xyz' } } } };
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: nullConfig, log: stubLog(3) },
        verified: { isVerified: true, execution: STUB_EXECUTION, gameover: null },
        onVerify: () => { verifyCalls += 1; },
      }),
    );
    const context = makeContext('null-config-match');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 422);
    assert.deepEqual(context.body, { error: 'not_reexecutable' });
    assert.equal(verifyCalls, 0);
  });

  test('AC-6: 429 rate_limited on the 11th request in one window for one key', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      depsWithClock(CONSTANT_NOW),
      // replayHash null → the first 10 are 404 replay_not_found, isolating the limiter
      logicSeam({ configuration: null, seats: [], replayHash: null }),
    );
    for (let request = 0; request < 10; request += 1) {
      const context = makeContextWithIp('m', '203.0.113.7');
      await replayHandlerOf(router)(context);
      assert.equal(context.status, 404, `request ${request} should be 404`);
    }
    const eleventh = makeContextWithIp('m', '203.0.113.7');
    await replayHandlerOf(router)(eleventh);
    assert.equal(eleventh.status, 429);
    assert.deepEqual(eleventh.body, { error: 'rate_limited' });
    assert.equal(eleventh.headers['Cache-Control'], 'no-store');
  });

  test('AC-6: 503 at_capacity once the move-weighted process budget is spent', async () => {
    const router = new FakeRouter();
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      depsWithClock(CONSTANT_NOW),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        // 2000 moves per request; budget 4000 → requests 1-2 succeed, the 3rd is 503
        replayArtifact: { initialState: VALID_INITIAL_STATE, log: stubLog(2000) },
        verified: { isVerified: true, execution: STUB_EXECUTION, gameover: { outcome: 'heroes-win' } },
      }),
    );
    // three distinct cf-connecting-ip keys so the per-client 10/min limiter never trips
    const first = makeContextWithIp('m', '203.0.113.1');
    await replayHandlerOf(router)(first);
    assert.equal(first.status, 200);
    const second = makeContextWithIp('m', '203.0.113.2');
    await replayHandlerOf(router)(second);
    assert.equal(second.status, 200);
    const third = makeContextWithIp('m', '203.0.113.3');
    await replayHandlerOf(router)(third);
    assert.equal(third.status, 503);
    assert.deepEqual(third.body, { error: 'at_capacity' });
    assert.equal(third.headers['Cache-Control'], 'no-store');
  });

  test('AC-6: 500 lagn_projection_failed when the built document is invalid', async () => {
    const router = new FakeRouter();
    // why: the shape check passes (valid composition + seat count + seed) and the
    // verify seam succeeds, but the emitted execution block is malformed
    // (non-hex final_state_hash), so the step-7 validate() rejects the document.
    const badExecution = { ...STUB_EXECUTION, final_state_hash: 'NOT-HEX!!' };
    registerMatchLagnRoutes(
      router,
      FAKE_DB,
      deps(),
      logicSeam({
        configuration: null,
        seats: [],
        replayHash: 'sha256:deadbeef',
        replayArtifact: { initialState: VALID_INITIAL_STATE, log: stubLog(3) },
        verified: { isVerified: true, execution: badExecution, gameover: null },
      }),
    );
    const context = makeContext('bad-projection');
    await replayHandlerOf(router)(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'lagn_projection_failed' });
    assert.equal(context.headers['Cache-Control'], 'no-store');
  });
});
