/**
 * Tests for the gauntlet run derived-progression read (WP-446 / EC-481 /
 * D-24265).
 *
 * Two tiers:
 *
 *   1. PURE (always run, no DB): the `deriveGauntletRunStatus` 5-state truth
 *      table; the `GAUNTLET_RUN_STATUSES` drift assertion (with a synthetic
 *      phantom status); and `deriveGauntletRunProgress` over synthetic
 *      caller-scoped rows covering all 5 states, budget headroom, per-leg
 *      cleared + last-played, and the champion-vs-all-legs-cleared distinction —
 *      plus a stub-database cross-check that `deriveGauntletRunProgress` and
 *      `getGauntletStandings` agree on the champion verdict for a shared solo
 *      fixture.
 *   2. DB-GATED (LOUD-skip without `TEST_DATABASE_URL`): `listGauntletRunProgress`
 *      end-to-end against a migrated database — the champion path, the
 *      all-legs-cleared-but-not-champion path, caller-scoping isolation (account
 *      B's scores never leak into account A's view), last-played, and the
 *      agrees-with-`getGauntletStandings` solo cross-check on the SAME real DB.
 *
 * The DB cases skip LOUDLY via node:test's options-based skip
 * (`{ skip: '<reason>' }`) — never a bare early return that would report a
 * silent green (mirrors `gauntletRun.migration.test.ts`). Migrations are applied
 * by the local harness before the run (`project_db_backed_server_tests_local`).
 *
 * Authority: WP-446 §Acceptance Criteria + §Verification Steps; EC-481 §Files to
 * Produce; the gauntlet migration + friendships / loadout DB-gated harness
 * precedent.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

import {
  deriveGauntletRunProgress,
  deriveGauntletRunStatus,
  listGauntletRunProgress,
} from './gauntletRunProgress.logic.js';
import {
  GAUNTLET_RUN_STATUSES,
  type GauntletRunLegProgress,
  type GauntletRunProgressInputs,
  type GauntletRunStatus,
  type GauntletRunView,
} from './gauntletRun.types.js';
import {
  getGauntletStandings,
  type GauntletDefinition,
} from '../legends/gauntlet.logic.js';
import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';
import { createPlayerAccount } from '../identity/identity.logic.js';
import type { AccountId } from '../identity/identity.types.js';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Shared synthetic-fixture helpers (pure tier)
// ---------------------------------------------------------------------------

const TEST_MASTERMIND = 'mm-one';
const TEST_SET = 'tst';

/** A synthetic caller-scoped (replay × owner) row as the query returns them. */
interface FixtureRow {
  replay_hash: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
  player_count: number | string | null;
  team_key: string | null;
  henchman_key: string | null;
  created_at: Date | string;
  player_id: number | string;
  display_name: string;
  visibility: string;
}

/** Canonical test scenario key for a (scheme, mastermind) pair. */
function scenarioKeyFor(schemeSlug: string): string {
  return `${schemeSlug}::${TEST_MASTERMIND}::villains-x`;
}

/**
 * A qualifying solo (player_count 1) row: one public account owning one winning
 * replay on the given leg. `teamKey` feeds the champion (fixed) division; a null
 * key stays open-only.
 */
function soloRow(
  replayHash: string,
  schemeSlug: string,
  finalScore: number,
  teamKey: string | null,
  createdAt: string,
): FixtureRow {
  return {
    replay_hash: replayHash,
    scenario_key: scenarioKeyFor(schemeSlug),
    final_score: finalScore,
    scoring_config_version: 1,
    player_count: 1,
    team_key: teamKey,
    henchman_key: null,
    created_at: createdAt,
    player_id: 100,
    display_name: 'Alice',
    visibility: 'public',
  };
}

/** Leaderboard deps stub: every scenario is published at version 1. */
function stubLeaderboardDeps(): LeaderboardDependencies {
  return {
    checkParPublished: (scenarioKey: string) => {
      if (scenarioKey.includes('unpublished')) {
        return null;
      }
      return {
        parValue: 0,
        parVersion: 'v1',
        source: 'simulation' as const,
        scoringConfig: { scoringConfigVersion: 1 } as never,
      };
    },
  };
}

/** The two leg schemes every fixture uses. */
const FIXTURE_LEGS = [
  { schemeSlug: 'scheme-a', schemeName: 'Scheme A' },
  { schemeSlug: 'scheme-b', schemeName: 'Scheme B' },
] as const;

/**
 * Build injected derivation inputs for the fixture gauntlet. `heroCount` 3 and
 * `poolBudget` 5 mirror the solo `PLAYER_COUNT_SETUP` row (heroCount 3, budget
 * heroCount + 2 = 5).
 */
function fixtureInputs(
  overrides?: Partial<GauntletRunProgressInputs>,
): GauntletRunProgressInputs {
  return {
    legs: [...FIXTURE_LEGS],
    approvedLoadouts: undefined,
    poolBudget: 5,
    heroCount: 3,
    boardName: `gauntlet-${TEST_SET}-${TEST_MASTERMIND}`,
    ...overrides,
  };
}

/** A raw stored run view for the fixture gauntlet. */
function fixtureRun(
  legPicks: Record<string, readonly string[]>,
): GauntletRunView {
  return {
    id: 'run-1',
    setAbbr: TEST_SET,
    mastermindSlug: TEST_MASTERMIND,
    division: 'fixed',
    playerCount: 1,
    legPicks,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    firstCompletedAt: null,
  };
}

/** The GauntletDefinition equivalent for the getGauntletStandings cross-check. */
function fixtureDefinition(): GauntletDefinition {
  return {
    setAbbr: TEST_SET,
    setName: 'Test Set',
    mastermindSlug: TEST_MASTERMIND,
    mastermindName: 'Mastermind One',
    legs: [...FIXTURE_LEGS],
    heroPoolBudgets: { 1: 5 },
    approvedLoadouts: undefined,
  };
}

/** Stub database returning fixed rows for any query (getGauntletStandings). */
function stubDatabaseReturning(rows: FixtureRow[]): DatabaseClient {
  return {
    async query(_text: string, _params?: unknown[]) {
      return { rows, rowCount: rows.length };
    },
  } as DatabaseClient;
}

// ---------------------------------------------------------------------------
// Pure: deriveGauntletRunStatus + drift
// ---------------------------------------------------------------------------

/** Build a synthetic per-leg progression list from cleared / full-picks flags. */
function legs(
  specs: readonly { cleared: boolean; hasFullPicks: boolean }[],
): GauntletRunLegProgress[] {
  const built: GauntletRunLegProgress[] = [];
  let index = 0;
  for (const spec of specs) {
    index = index + 1;
    built.push({
      schemeId: `scheme-${index}`,
      schemeName: `Scheme ${index}`,
      cleared: spec.cleared,
      hasFullPicks: spec.hasFullPicks,
      lastPlayedAt: null,
    });
  }
  return built;
}

describe('deriveGauntletRunStatus (pure 5-state map)', () => {
  test('needs-heroes — no leg has full picks and none cleared', () => {
    const status = deriveGauntletRunStatus(
      legs([
        { cleared: false, hasFullPicks: false },
        { cleared: false, hasFullPicks: false },
      ]),
      false,
    );
    assert.equal(status, 'needs-heroes');
  });

  test('ready — ≥1 leg has full picks, 0 legs cleared', () => {
    const status = deriveGauntletRunStatus(
      legs([
        { cleared: false, hasFullPicks: true },
        { cleared: false, hasFullPicks: false },
      ]),
      false,
    );
    assert.equal(status, 'ready');
  });

  test('playing — ≥1 leg cleared, not all', () => {
    const status = deriveGauntletRunStatus(
      legs([
        { cleared: true, hasFullPicks: true },
        { cleared: false, hasFullPicks: true },
      ]),
      false,
    );
    assert.equal(status, 'playing');
  });

  test('all-legs-cleared — every leg cleared but no budget-valid pool', () => {
    const status = deriveGauntletRunStatus(
      legs([
        { cleared: true, hasFullPicks: true },
        { cleared: true, hasFullPicks: true },
      ]),
      false,
    );
    assert.equal(status, 'all-legs-cleared');
  });

  test('champion — every leg cleared AND a budget-valid pool exists', () => {
    const status = deriveGauntletRunStatus(
      legs([
        { cleared: true, hasFullPicks: true },
        { cleared: true, hasFullPicks: true },
      ]),
      true,
    );
    assert.equal(status, 'champion');
  });

  test('a zero-leg run is needs-heroes, never all-legs-cleared', () => {
    assert.equal(deriveGauntletRunStatus([], false), 'needs-heroes');
    // why: an empty leg list must not read as "every leg cleared" — the
    // every-leg guard requires at least one leg (D-24265 §2 edge).
    assert.equal(deriveGauntletRunStatus([], true), 'needs-heroes');
  });
});

describe('GAUNTLET_RUN_STATUSES drift', () => {
  test('matches the GauntletRunStatus union (forward + backward, no duplicates); a phantom fails', () => {
    const expected: ReadonlySet<GauntletRunStatus> = new Set([
      'needs-heroes',
      'ready',
      'playing',
      'all-legs-cleared',
      'champion',
    ]);
    assert.equal(GAUNTLET_RUN_STATUSES.length, expected.size);
    assert.equal(
      new Set(GAUNTLET_RUN_STATUSES).size,
      GAUNTLET_RUN_STATUSES.length,
      'GAUNTLET_RUN_STATUSES must contain no duplicates',
    );
    for (const status of GAUNTLET_RUN_STATUSES) {
      assert.ok(expected.has(status), `unexpected status ${status} in array`);
    }
    for (const value of expected) {
      assert.ok(
        GAUNTLET_RUN_STATUSES.includes(value),
        `union value ${value} missing from array`,
      );
    }
    // why: a synthetic phantom status must NOT be a member — proves the guard
    // would catch a union/array divergence rather than silently accepting one.
    const phantom = 'grandmaster' as GauntletRunStatus;
    assert.ok(
      !GAUNTLET_RUN_STATUSES.includes(phantom),
      'a phantom status must not appear in GAUNTLET_RUN_STATUSES',
    );
  });
});

// ---------------------------------------------------------------------------
// Pure: deriveGauntletRunProgress
// ---------------------------------------------------------------------------

describe('deriveGauntletRunProgress (pure, synthetic rows)', () => {
  const deps = stubLeaderboardDeps();

  test('needs-heroes — empty picks, no scores: every leg uncleared, pool empty, headroom = budget', () => {
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      [],
      deps.checkParPublished,
    );
    assert.equal(view.status, 'needs-heroes');
    assert.deepEqual(view.pool, []);
    assert.equal(view.budget, 5);
    assert.equal(view.budgetHeadroom, 5);
    assert.equal(view.heroCount, 3);
    assert.equal(view.isChampion, false);
    assert.equal(view.legs.length, 2);
    for (const leg of view.legs) {
      assert.equal(leg.cleared, false);
      assert.equal(leg.hasFullPicks, false);
      assert.equal(leg.lastPlayedAt, null);
    }
  });

  test('ready — one leg fully picked (heroCount ids), no legs cleared', () => {
    const view = deriveGauntletRunProgress(
      fixtureRun({ 'scheme-a': ['h1', 'h2', 'h3'] }),
      fixtureInputs(),
      [],
      deps.checkParPublished,
    );
    assert.equal(view.status, 'ready');
    const legA = view.legs.find((leg) => leg.schemeId === 'scheme-a');
    assert.ok(legA !== undefined);
    assert.equal(legA.hasFullPicks, true);
  });

  test('pool is the sorted union of leg_picks; budgetHeadroom = budget − pool.length', () => {
    const view = deriveGauntletRunProgress(
      fixtureRun({ 'scheme-a': ['x', 'y', 'z'], 'scheme-b': ['x', 'w'] }),
      fixtureInputs(),
      [],
      deps.checkParPublished,
    );
    assert.deepEqual(view.pool, ['w', 'x', 'y', 'z']);
    assert.equal(view.budgetHeadroom, 5 - 4);
  });

  test('playing — one leg cleared, one not; cleared leg carries lastPlayedAt = max(created_at)', () => {
    const rows: FixtureRow[] = [
      soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
      soloRow('r2', 'scheme-a', -3, 'h1+h2+h3', '2026-07-05T10:00:00.000Z'),
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    assert.equal(view.status, 'playing');
    const legA = view.legs.find((leg) => leg.schemeId === 'scheme-a');
    const legB = view.legs.find((leg) => leg.schemeId === 'scheme-b');
    assert.ok(legA !== undefined && legB !== undefined);
    assert.equal(legA.cleared, true);
    assert.equal(legA.lastPlayedAt, '2026-07-05T10:00:00.000Z');
    assert.equal(legB.cleared, false);
    assert.equal(legB.lastPlayedAt, null);
  });

  test('champion — every leg cleared with a budget-valid team (pool ≤ budget)', () => {
    const rows: FixtureRow[] = [
      soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
      soloRow('r2', 'scheme-b', -4, 'h1+h2+h3', '2026-07-03T10:00:00.000Z'),
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    assert.equal(view.isChampion, true);
    assert.equal(view.status, 'champion');
  });

  test('all-legs-cleared — every leg cleared but disjoint teams exceed budget (distinct from champion)', () => {
    const rows: FixtureRow[] = [
      soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
      soloRow('r2', 'scheme-b', -4, 'h4+h5+h6', '2026-07-03T10:00:00.000Z'),
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    // why: both legs cleared, but the two winning teams need 6 distinct heroes
    // and the budget is 5 — no budget-valid pool → all-legs-cleared, NOT
    // champion (the distinct-states invariant, D-24265 §2).
    assert.equal(view.isChampion, false);
    assert.equal(view.status, 'all-legs-cleared');
  });

  test('an unpublished scenario never clears a leg (fail-closed via checkParPublished)', () => {
    const rows: FixtureRow[] = [
      {
        ...soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
        scenario_key: 'scheme-a::mm-one::unpublished-villains',
      },
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    const legA = view.legs.find((leg) => leg.schemeId === 'scheme-a');
    assert.ok(legA !== undefined);
    assert.equal(legA.cleared, false);
    assert.equal(view.status, 'needs-heroes');
  });
});

describe('deriveGauntletRunProgress agrees with getGauntletStandings (pure stub-DB solo cross-check)', () => {
  const deps = stubLeaderboardDeps();

  test('a budget-valid solo fixture: champion here ⇔ Alice present in the fixed division', async () => {
    const rows: FixtureRow[] = [
      soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
      soloRow('r2', 'scheme-b', -4, 'h1+h2+h3', '2026-07-03T10:00:00.000Z'),
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    const standings = await getGauntletStandings(
      fixtureDefinition(),
      stubDatabaseReturning(rows),
      deps,
    );
    const soloFixed = standings.get(1)?.fixed ?? [];
    const aliceInFixed = soloFixed.some((entry) => entry.handle === 'Alice');
    assert.equal(
      view.isChampion,
      aliceInFixed,
      'the run read and the leaderboard must agree on the champion verdict',
    );
    assert.equal(view.isChampion, true);
    assert.equal(aliceInFixed, true);
  });

  test('a budget-exceeding solo fixture: not champion here ⇔ Alice absent from the fixed division', async () => {
    const rows: FixtureRow[] = [
      soloRow('r1', 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z'),
      soloRow('r2', 'scheme-b', -4, 'h4+h5+h6', '2026-07-03T10:00:00.000Z'),
    ];
    const view = deriveGauntletRunProgress(
      fixtureRun({}),
      fixtureInputs(),
      rows,
      deps.checkParPublished,
    );
    const standings = await getGauntletStandings(
      fixtureDefinition(),
      stubDatabaseReturning(rows),
      deps,
    );
    const soloFixed = standings.get(1)?.fixed ?? [];
    const aliceInFixed = soloFixed.some((entry) => entry.handle === 'Alice');
    assert.equal(view.isChampion, aliceInFixed);
    assert.equal(view.isChampion, false);
    assert.equal(aliceInFixed, false);
  });
});

// ---------------------------------------------------------------------------
// DB-gated: listGauntletRunProgress end-to-end + real-DB cross-check
// ---------------------------------------------------------------------------

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;
const SUITE_RUN_ID = `wp446-${Date.now()}`;
let dbCounter = 0;

/** A per-suite-run-unique label so repeated runs never collide on UNIQUEs. */
function uniqueLabel(suffix: string): string {
  dbCounter = dbCounter + 1;
  return `${SUITE_RUN_ID}-${dbCounter}-${suffix}`;
}

/** Provision a fresh player account; returns its AccountId (ext_id). */
async function provisionAccount(
  testPool: pg.Pool,
  labelSuffix: string,
): Promise<AccountId> {
  const email = `${uniqueLabel(labelSuffix)}@example.com`;
  const authProviderId = `${uniqueLabel(labelSuffix)}-sub`;
  const result = await createPlayerAccount(
    {
      email,
      displayName: `Runner${labelSuffix}`,
      authProvider: 'email',
      authProviderId,
    },
    testPool,
    randomUUID,
  );
  assert.ok(result.ok === true, 'createPlayerAccount must succeed');
  return result.value.accountId;
}

/** Resolve the internal bigint player_id (as a string) for an account. */
async function resolvePlayerId(
  testPool: pg.Pool,
  accountId: AccountId,
): Promise<string> {
  const result = await testPool.query<{ player_id: string }>(
    'SELECT player_id FROM legendary.players WHERE ext_id = $1',
    [accountId],
  );
  assert.equal(result.rows.length, 1, 'provisioned player must resolve');
  return result.rows[0].player_id;
}

/** Insert one active fixed-division solo run and return its id. */
async function insertActiveRun(
  testPool: pg.Pool,
  playerId: string,
): Promise<string> {
  const result = await testPool.query<{ id: string }>(
    `INSERT INTO legendary.player_gauntlet_runs
       (player_id, set_abbr, mastermind_slug, division, player_count)
     VALUES ($1, $2, $3, 'fixed', 1)
     RETURNING id`,
    [playerId, TEST_SET, TEST_MASTERMIND],
  );
  return result.rows[0].id;
}

/**
 * Seed one qualifying solo winning replay: a `competitive_scores` row + the
 * owner's `replay_ownership` row (public). `replayHash` is unique per call so
 * the per-account UNIQUE (player_id, replay_hash) never collides.
 */
async function seedSoloWin(
  testPool: pg.Pool,
  playerId: string,
  replayHash: string,
  schemeSlug: string,
  finalScore: number,
  teamKey: string,
  createdAt: string,
): Promise<void> {
  await testPool.query(
    `INSERT INTO legendary.competitive_scores
       (player_id, replay_hash, scenario_key, raw_score, final_score,
        score_breakdown, par_version, scoring_config_version, state_hash,
        outcome, player_count, team_key, henchman_key, created_at)
     VALUES ($1, $2, $3, $4, $4, '{}'::jsonb, 'v1', 1, $2,
             'heroes-win', 1, $5, 'core/hydra', $6)`,
    [playerId, replayHash, scenarioKeyFor(schemeSlug), finalScore, teamKey, createdAt],
  );
  await testPool.query(
    `INSERT INTO legendary.replay_ownership
       (player_id, replay_hash, scenario_key, visibility)
     VALUES ($1, $2, $3, 'public')`,
    [playerId, replayHash, scenarioKeyFor(schemeSlug)],
  );
}

/** The injected inputs resolver for the DB tests' fixture gauntlet. */
function dbInputsResolver(
  overrides?: Partial<GauntletRunProgressInputs>,
) {
  return (_run: GauntletRunView): GauntletRunProgressInputs =>
    fixtureInputs(overrides);
}

describe('listGauntletRunProgress (DB-gated end-to-end)', () => {
  let testPool: pg.Pool | null = null;
  const provisionedPlayerIds: string[] = [];
  const deps = stubLeaderboardDeps();

  before(() => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      for (const playerId of provisionedPlayerIds) {
        // why: replay_ownership + competitive_scores + gauntlet runs all FK to
        // legendary.players; delete their rows first, then the player, so the
        // test DB is left pristine (competitive_scores has no ON DELETE CASCADE).
        await testPool.query(
          'DELETE FROM legendary.competitive_scores WHERE player_id = $1',
          [playerId],
        );
        await testPool.query(
          'DELETE FROM legendary.replay_ownership WHERE player_id = $1',
          [playerId],
        );
        await testPool.query(
          'DELETE FROM legendary.players WHERE player_id = $1',
          [playerId],
        );
      }
      await testPool.end();
      testPool = null;
    }
  });

  test(
    'champion path — both legs cleared with a budget-valid team → status champion, last-played set',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'champ');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);
      await insertActiveRun(testPool, playerId);
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z');
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-a', -3, 'h1+h2+h3', '2026-07-06T10:00:00.000Z');
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-b', -4, 'h1+h2+h3', '2026-07-03T10:00:00.000Z');

      const result = await listGauntletRunProgress(
        accountId,
        testPool,
        dbInputsResolver(),
        deps,
      );
      assert.ok(result.ok === true);
      assert.equal(result.value.length, 1);
      const view = result.value[0];
      assert.equal(view.status, 'champion');
      assert.equal(view.isChampion, true);
      const legA = view.legs.find((leg) => leg.schemeId === 'scheme-a');
      assert.ok(legA !== undefined);
      assert.equal(legA.cleared, true);
      // why: the later of the two scheme-a wins is the derived where-you-left-off.
      assert.equal(legA.lastPlayedAt, '2026-07-06T10:00:00.000Z');
    },
  );

  test(
    'all-legs-cleared path — disjoint teams exceed budget → not champion',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'allcleared');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);
      await insertActiveRun(testPool, playerId);
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z');
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-b', -4, 'h4+h5+h6', '2026-07-03T10:00:00.000Z');

      const result = await listGauntletRunProgress(
        accountId,
        testPool,
        dbInputsResolver(),
        deps,
      );
      assert.ok(result.ok === true);
      const view = result.value[0];
      assert.equal(view.status, 'all-legs-cleared');
      assert.equal(view.isChampion, false);
    },
  );

  test(
    'caller-scoping — account B\'s qualifying scores never clear account A\'s legs',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountA = await provisionAccount(testPool, 'isoA');
      const playerA = await resolvePlayerId(testPool, accountA);
      provisionedPlayerIds.push(playerA);
      const accountB = await provisionAccount(testPool, 'isoB');
      const playerB = await resolvePlayerId(testPool, accountB);
      provisionedPlayerIds.push(playerB);

      // A has an active run but owns NO qualifying replay; B owns both legs.
      await insertActiveRun(testPool, playerA);
      await seedSoloWin(testPool, playerB, uniqueLabel('h'), 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z');
      await seedSoloWin(testPool, playerB, uniqueLabel('h'), 'scheme-b', -4, 'h1+h2+h3', '2026-07-03T10:00:00.000Z');

      const result = await listGauntletRunProgress(
        accountA,
        testPool,
        dbInputsResolver(),
        deps,
      );
      assert.ok(result.ok === true);
      assert.equal(result.value.length, 1, 'A sees only its own run');
      const view = result.value[0];
      // why: B's wins must be invisible to A — the query is caller-scoped to
      // replays A owns, so A's legs stay uncleared and the status is
      // needs-heroes (no leak across accounts).
      assert.equal(view.status, 'needs-heroes');
      for (const leg of view.legs) {
        assert.equal(leg.cleared, false);
      }
    },
  );

  test(
    'agrees-with-getGauntletStandings solo cross-check (same real DB)',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountId = await provisionAccount(testPool, 'xcheck');
      const playerId = await resolvePlayerId(testPool, accountId);
      provisionedPlayerIds.push(playerId);
      await insertActiveRun(testPool, playerId);
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-a', -5, 'h1+h2+h3', '2026-07-02T10:00:00.000Z');
      await seedSoloWin(testPool, playerId, uniqueLabel('h'), 'scheme-b', -4, 'h1+h2+h3', '2026-07-03T10:00:00.000Z');

      const runResult = await listGauntletRunProgress(
        accountId,
        testPool,
        dbInputsResolver(),
        deps,
      );
      assert.ok(runResult.ok === true);
      const runIsChampion = runResult.value[0].isChampion;

      const standings = await getGauntletStandings(
        fixtureDefinition(),
        testPool,
        deps,
      );
      const soloFixed = standings.get(1)?.fixed ?? [];
      const handle = `Runnerxcheck`;
      const presentInFixed = soloFixed.some((entry) =>
        entry.players.includes(handle),
      );
      // why: for a solo run the caller IS the roster, so the run read's champion
      // verdict must equal the caller's presence in the leaderboard's fixed
      // division — the single-source-of-truth guarantee (D-24265 §1, §4).
      assert.equal(runIsChampion, presentInFixed);
      assert.equal(runIsChampion, true);
    },
  );
});
