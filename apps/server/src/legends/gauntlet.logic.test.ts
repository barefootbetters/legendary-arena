/**
 * Tests for the mastermind set-gauntlet catalog + standings
 * (WP-342 / WP-344 / WP-384).
 *
 * Catalog tests are pure. Standings tests use a stub DatabaseClient
 * returning canned (replay × owner) rows — the SQL-side filters
 * (outcome, NOT-NULL player_count, slug match, replay dedupe) are
 * exercised by the DB-gated submission tests in
 * competition.logic.test.ts; these tests prove the application-side
 * aggregation: version filter, roster grouping, the all-seats and
 * all-visible gates, best-per-leg, complete-gauntlets-only, per-count
 * keying, ranking, the centesimal average, and (WP-384) the
 * fixed-hero-pool division's pool-constrained assignment search.
 *
 * Authority: WP-342; WP-344; WP-384; EC-376 / EC-413 §Locked Values;
 * D-24131; D-24134; D-24187.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFixedGauntletBoardNameForPlayerCount,
  buildGauntletBoardName,
  buildGauntletBoardNameForPlayerCount,
  buildGauntletCatalog,
  buildSetDetailsCatalog,
  getGauntletStandings,
} from './gauntlet.logic.js';
import type {
  GauntletApprovedLoadouts,
  GauntletDefinition,
  GauntletSetSummary,
} from './gauntlet.logic.js';
import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CORE_SUMMARY: GauntletSetSummary = {
  setAbbr: 'core',
  setName: 'Core Set',
  schemes: [
    { slug: 'scheme-b', name: 'Scheme B' },
    { slug: 'scheme-a', name: 'Scheme A' },
  ],
  masterminds: [
    { slug: 'mm-two', name: 'Mastermind Two' },
    { slug: 'mm-one', name: 'Mastermind One' },
  ],
  villains: [{ slug: 'brotherhood', name: 'The Brotherhood' }],
  henchmen: [{ slug: 'doombot-legion', name: 'Doombot Legion' }],
};

const SCHEMELESS_SUMMARY: GauntletSetSummary = {
  setAbbr: 'dims',
  setName: 'Dimensions',
  schemes: [],
  masterminds: [{ slug: 'mm-orphan', name: 'Orphan Mastermind' }],
  villains: [{ slug: 'v-orphan', name: 'Orphan Villains' }],
  henchmen: [{ slug: 'h-orphan', name: 'Orphan Henchmen' }],
};

const TEST_DEFINITION: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'mm-one',
  mastermindName: 'Mastermind One',
  legs: [
    { schemeSlug: 'scheme-a', schemeName: 'Scheme A' },
    { schemeSlug: 'scheme-b', schemeName: 'Scheme B' },
  ],
};

// why: WP-384 — the same gauntlet with the D-24187 §4 wiring-injected pool
// budgets (heroCount + 2 per D-24165: solo 5, 2-4p 7, 5p 8). Fixed-division
// tests use this; the budget-less TEST_DEFINITION proves the degrade path.
const BUDGETED_DEFINITION: GauntletDefinition = {
  ...TEST_DEFINITION,
  heroPoolBudgets: { 1: 5, 2: 7, 3: 7, 4: 7, 5: 8 },
};

/**
 * One (replay × owner) row as the WP-344/WP-384 standings query returns
 * them.
 */
interface StubRow {
  replay_hash: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
  player_count: number | null;
  team_key: string | null;
  // why: WP-395 — optional so every pre-existing row builder still compiles
  // and keeps its semantics; an absent column coalesces to NULL exactly as a
  // pre-migration-035 row does.
  henchman_key?: string | null;
  player_id: number;
  display_name: string;
  visibility: string;
}

/**
 * Stub database whose single SELECT returns the provided rows and
 * records the parameters it was called with.
 */
function createStubDatabase(rows: StubRow[]): {
  database: DatabaseClient;
  receivedParams: unknown[][];
} {
  const receivedParams: unknown[][] = [];
  const database = {
    async query(_text: string, params?: unknown[]) {
      receivedParams.push(params ?? []);
      return { rows, rowCount: rows.length };
    },
  } as DatabaseClient;
  return { database, receivedParams };
}

/**
 * Stub deps: every scenario key is published at scoringConfigVersion 1,
 * except keys containing "unpublished" which return null (fail-closed).
 */
function createStubDeps(): LeaderboardDependencies {
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

/** Builds a canonical test scenario key for a (scheme, mastermind) pair. */
function scenarioKeyFor(schemeSlug: string, mastermindSlug: string): string {
  return `${schemeSlug}::${mastermindSlug}::villains-x`;
}

/**
 * A qualifying solo (replay × owner) row: one winning replay on the
 * given leg, owned by one public account. Fields override via `extra`
 * (WP-384: including `team_key`, which defaults to NULL — the
 * pre-migration shape — so pre-WP-384 tests exercise the open division
 * exactly as before).
 */
function soloRow(
  replayHash: string,
  schemeSlug: string,
  finalScore: number,
  playerId: number,
  displayName: string,
  extra?: Partial<StubRow>,
): StubRow {
  return {
    replay_hash: replayHash,
    scenario_key: scenarioKeyFor(schemeSlug, 'mm-one'),
    final_score: finalScore,
    scoring_config_version: 1,
    player_count: 1,
    team_key: null,
    player_id: playerId,
    display_name: displayName,
    visibility: 'public',
    ...extra,
  };
}

/**
 * The (replay × owner) rows for one 2-player winning replay: one row
 * per owner, identical replay-level facts. `teamKey` defaults to NULL
 * (open-division-only) unless a fixed-division test supplies one.
 */
function duoRows(
  replayHash: string,
  schemeSlug: string,
  finalScore: number,
  owners: readonly { playerId: number; displayName: string; visibility?: string }[],
  teamKey: string | null = null,
): StubRow[] {
  const rows: StubRow[] = [];
  for (const owner of owners) {
    rows.push({
      replay_hash: replayHash,
      scenario_key: scenarioKeyFor(schemeSlug, 'mm-one'),
      final_score: finalScore,
      scoring_config_version: 1,
      player_count: 2,
      team_key: teamKey,
      player_id: owner.playerId,
      display_name: owner.displayName,
      visibility: owner.visibility ?? 'public',
    });
  }
  return rows;
}

/** Convenience: run standings against rows and return the per-count map. */
async function standingsFor(rows: StubRow[]) {
  const { database } = createStubDatabase(rows);
  return getGauntletStandings(TEST_DEFINITION, database, createStubDeps());
}

/** Convenience: standings for the budget-carrying definition (WP-384). */
async function budgetedStandingsFor(rows: StubRow[]) {
  const { database } = createStubDatabase(rows);
  return getGauntletStandings(BUDGETED_DEFINITION, database, createStubDeps());
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

describe('gauntlet catalog (WP-342 / WP-344)', () => {
  test('one gauntlet per mastermind for sets with schemes; schemeless sets contribute none', () => {
    const catalog = buildGauntletCatalog([SCHEMELESS_SUMMARY, CORE_SUMMARY]);
    assert.strictEqual(catalog.length, 2);
    for (const definition of catalog) {
      assert.strictEqual(definition.setAbbr, 'core');
      assert.deepEqual(definition.legs, [
        { schemeSlug: 'scheme-a', schemeName: 'Scheme A' },
        { schemeSlug: 'scheme-b', schemeName: 'Scheme B' },
      ]);
    }
  });

  test('catalog ordering is deterministic: setAbbr ASC, mastermind slug ASC, legs sorted', () => {
    const catalog = buildGauntletCatalog([CORE_SUMMARY]);
    assert.deepEqual(
      catalog.map((definition) => definition.mastermindSlug),
      ['mm-one', 'mm-two'],
    );
    assert.deepEqual(
      catalog[0]?.legs.map((leg) => leg.schemeSlug),
      ['scheme-a', 'scheme-b'],
    );
  });

  test('board names: bare stem for solo, -p<N> suffix for multiplayer counts', () => {
    assert.strictEqual(
      buildGauntletBoardName(TEST_DEFINITION),
      'gauntlet-core-mm-one',
    );
    assert.strictEqual(
      buildGauntletBoardNameForPlayerCount(TEST_DEFINITION, 1),
      'gauntlet-core-mm-one',
    );
    assert.strictEqual(
      buildGauntletBoardNameForPlayerCount(TEST_DEFINITION, 3),
      'gauntlet-core-mm-one-p3',
    );
  });

  test('fixed board names: -fixed precedes -p<N> (WP-384 / D-24187 §3)', () => {
    assert.strictEqual(
      buildFixedGauntletBoardNameForPlayerCount(TEST_DEFINITION, 1),
      'gauntlet-core-mm-one-fixed',
    );
    assert.strictEqual(
      buildFixedGauntletBoardNameForPlayerCount(TEST_DEFINITION, 3),
      'gauntlet-core-mm-one-fixed-p3',
    );
  });

  test('hero-pool budgets ride every catalog definition when supplied (WP-384)', () => {
    const budgets = { 1: 5, 2: 7, 3: 7, 4: 7, 5: 8 };
    const catalog = buildGauntletCatalog([CORE_SUMMARY], budgets);
    for (const definition of catalog) {
      assert.deepEqual(definition.heroPoolBudgets, budgets);
    }
    const budgetlessCatalog = buildGauntletCatalog([CORE_SUMMARY]);
    assert.strictEqual(budgetlessCatalog[0]?.heroPoolBudgets, undefined);
  });
});

// ---------------------------------------------------------------------------
// Standings — solo (the WP-342 semantics restricted to player_count = 1)
// ---------------------------------------------------------------------------

describe('gauntlet standings, solo (WP-342 semantics at count 1)', () => {
  test('a solo player with a winning best on every leg enters with sum, centesimal average, rank, and a one-element roster', async () => {
    const { database, receivedParams } = createStubDatabase([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice'),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);

    const standings = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );

    assert.deepEqual(standings.get(1)?.open, [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -7,
        legCount: 2,
        averageScoreCentis: -350,
        players: ['Alice'],
      },
    ]);
    for (const playerCount of [2, 3, 4, 5]) {
      assert.deepEqual(standings.get(playerCount)?.open, []);
    }

    // The query received the gauntlet's mastermind slug + leg slugs.
    assert.deepEqual(receivedParams[0], ['mm-one', ['scheme-a', 'scheme-b']]);
  });

  test('a solo player missing a leg is excluded (complete gauntlets only)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1)?.open, []);
  });

  test('best-per-leg keeps the lowest score among multiple winning replays', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', 4, 1, 'Alice'),
      soloRow('r2', 'scheme-a', -6, 1, 'Alice'),
      soloRow('r3', 'scheme-b', 0, 1, 'Alice'),
    ]);
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -6);
  });

  test('replays at a stale scoringConfigVersion never qualify (VISION section 22)', async () => {
    const standings = await standingsFor([
      // why: the stub gate publishes version 1; this replay is version 2 —
      // it must be skipped, leaving the gauntlet incomplete.
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { scoring_config_version: 2 }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1)?.open, []);
  });

  test('replays for an unpublished scenario never qualify (fail closed)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', {
        scenario_key: 'scheme-a::mm-one::unpublished-villains',
      }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1)?.open, []);
  });

  test('a NULL player_count replay never qualifies on any count (D-24134 section 1)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { player_count: null }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    for (const playerCount of [1, 2, 3, 4, 5]) {
      assert.deepEqual(standings.get(playerCount)?.open, []);
    }
  });

  test('ranking is totalScore ASC, then roster ASC (handle ASC on solo boards)', async () => {
    const rowsFor = (
      playerId: number,
      handle: string,
      scoreA: number,
      scoreB: number,
    ): StubRow[] => [
      soloRow(`r-${playerId}-a`, 'scheme-a', scoreA, playerId, handle),
      soloRow(`r-${playerId}-b`, 'scheme-b', scoreB, playerId, handle),
    ];

    const standings = await standingsFor([
      ...rowsFor(1, 'Zed', -1, -1),
      ...rowsFor(2, 'Alice', -1, -1),
      ...rowsFor(3, 'Mallory', -10, -1),
    ]);
    assert.deepEqual(
      standings.get(1)?.open.map((entry) => [entry.rank, entry.handle]),
      [
        [1, 'Mallory'],
        [2, 'Alice'],
        [3, 'Zed'],
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// Standings — rosters (WP-344 / D-24134)
// ---------------------------------------------------------------------------

describe('gauntlet standings, rosters (WP-344 / D-24134)', () => {
  test('a duo clearing every leg enters the 2-player board with both handles, handle ASC, handle = players[0]', async () => {
    const standings = await standingsFor([
      ...duoRows('r1', 'scheme-a', -4, [
        { playerId: 2, displayName: 'Zed' },
        { playerId: 1, displayName: 'Alice' },
      ]),
      ...duoRows('r2', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
    ]);

    assert.deepEqual(standings.get(2)?.open, [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -6,
        legCount: 2,
        averageScoreCentis: -300,
        players: ['Alice', 'Zed'],
      },
    ]);
    assert.deepEqual(standings.get(1)?.open, []);
  });

  test('a 2-player replay with one ownership row never qualifies (guest seat voids team eligibility)', async () => {
    const standings = await standingsFor([
      // why: player_count says 2 seats but only one authenticated owner
      // exists — the D-24134 §3 all-seats-authenticated gate must exclude
      // the replay from EVERY board (not demote it to solo).
      soloRow('r1', 'scheme-a', -4, 1, 'Alice', { player_count: 2 }),
      ...duoRows('r2', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
    ]);
    assert.deepEqual(standings.get(2)?.open, []);
    assert.deepEqual(standings.get(1)?.open, []);
  });

  test('a private roster member excludes the whole replay (consent-to-publish per member)', async () => {
    const standings = await standingsFor([
      ...duoRows('r1', 'scheme-a', -4, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed', visibility: 'private' },
      ]),
      ...duoRows('r2', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
    ]);
    assert.deepEqual(standings.get(2)?.open, []);
  });

  test('the SAME roster must clear every leg — different partners never combine', async () => {
    const standings = await standingsFor([
      ...duoRows('r1', 'scheme-a', -4, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
      ...duoRows('r2', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 3, displayName: 'Mallory' },
      ]),
    ]);
    assert.deepEqual(standings.get(2)?.open, []);
  });

  test('two rosters sharing a member are independent entries, tiebroken by joined roster ASC', async () => {
    const standings = await standingsFor([
      ...duoRows('r1', 'scheme-a', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
      ...duoRows('r2', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
      ...duoRows('r3', 'scheme-a', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 3, displayName: 'Mallory' },
      ]),
      ...duoRows('r4', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 3, displayName: 'Mallory' },
      ]),
    ]);

    assert.deepEqual(
      standings.get(2)?.open.map((entry) => [entry.rank, entry.players.join('+')]),
      [
        [1, 'Alice+Mallory'],
        [2, 'Alice+Zed'],
      ],
    );
  });

  test('solo and duo standings for the same account coexist on their own boards', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice'),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
      ...duoRows('r3', 'scheme-a', -4, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
      ...duoRows('r4', 'scheme-b', -2, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Zed' },
      ]),
    ]);

    assert.strictEqual(standings.get(1)?.open.length, 1);
    assert.strictEqual(standings.get(2)?.open.length, 1);
    assert.deepEqual(standings.get(1)?.open[0]?.players, ['Alice']);
    assert.deepEqual(standings.get(2)?.open[0]?.players, ['Alice', 'Zed']);
  });
});

// ---------------------------------------------------------------------------
// Standings — fixed-hero-pool division (WP-384 / D-24187)
// ---------------------------------------------------------------------------

// why: solo hero decks are 3 heroes (D-24165), so a solo team key carries
// three set-qualified ids; the solo pool budget is 5.
const TEAM_ABC = 'core/hero-a+core/hero-b+core/hero-c';
const TEAM_DEF = 'core/hero-d+core/hero-e+core/hero-f';
const TEAM_ABD = 'core/hero-a+core/hero-b+core/hero-d';

describe('gauntlet standings, fixed-hero-pool division (WP-384 / D-24187)', () => {
  test('one team clearing every leg earns a fixed entry with that team as the hero pool', async () => {
    const standings = await budgetedStandingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { team_key: TEAM_ABC }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice', { team_key: TEAM_ABC }),
    ]);
    assert.deepEqual(standings.get(1)?.fixed, [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -7,
        legCount: 2,
        averageScoreCentis: -350,
        players: ['Alice'],
        heroPool: ['core/hero-a', 'core/hero-b', 'core/hero-c'],
      },
    ]);
    // The open division carries the same totals (both divisions computed).
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -7);
  });

  test('two disjoint solo teams blow the solo budget of 5 — open qualifies, fixed does not', async () => {
    const standings = await budgetedStandingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { team_key: TEAM_ABC }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice', { team_key: TEAM_DEF }),
    ]);
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -7);
    assert.deepEqual(standings.get(1)?.fixed, []);
  });

  test('two overlapping solo teams within the budget qualify with the union as the pool', async () => {
    // why: TEAM_ABC ∪ TEAM_ABD = {a, b, c, d} — 4 heroes ≤ the solo budget
    // of 5, so mixing the two teams across legs is a legal pool.
    const standings = await budgetedStandingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { team_key: TEAM_ABC }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice', { team_key: TEAM_ABD }),
    ]);
    assert.deepEqual(standings.get(1)?.fixed[0]?.heroPool, [
      'core/hero-a',
      'core/hero-b',
      'core/hero-c',
      'core/hero-d',
    ]);
    assert.strictEqual(standings.get(1)?.fixed[0]?.totalScore, -7);
  });

  test('the search prefers a pool-satisfying assignment over the unconstrained best (pinned totals)', async () => {
    // why: the unconstrained best is -10 + -10 = -20 but uses disjoint
    // teams (pool 6 > budget 5); the best POOL-SATISFYING assignment plays
    // TEAM_ABC on both legs for -10 + -4 = -14. Open reports -20, fixed
    // reports -14 — the divisions genuinely diverge.
    const standings = await budgetedStandingsFor([
      soloRow('r1', 'scheme-a', -10, 1, 'Alice', { team_key: TEAM_ABC }),
      soloRow('r2', 'scheme-b', -10, 1, 'Alice', { team_key: TEAM_DEF }),
      soloRow('r3', 'scheme-b', -4, 1, 'Alice', { team_key: TEAM_ABC }),
    ]);
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -20);
    assert.strictEqual(standings.get(1)?.fixed[0]?.totalScore, -14);
    assert.deepEqual(standings.get(1)?.fixed[0]?.heroPool, [
      'core/hero-a',
      'core/hero-b',
      'core/hero-c',
    ]);
  });

  test('a NULL team_key win feeds the open division only', async () => {
    const standings = await budgetedStandingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice'),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice', { team_key: TEAM_ABC }),
    ]);
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -7);
    assert.deepEqual(standings.get(1)?.fixed, []);
  });

  test('the 2-player budget of 7 admits a 3-hero-overlap team pair and rejects a 2-hero-overlap pair', async () => {
    const teamFive = 'core/h1+core/h2+core/h3+core/h4+core/h5';
    const teamShareThree = 'core/h1+core/h2+core/h3+core/h6+core/h7';
    const teamShareTwo = 'core/h1+core/h2+core/h6+core/h7+core/h8';
    const duo = [
      { playerId: 1, displayName: 'Alice' },
      { playerId: 2, displayName: 'Zed' },
    ];

    // Union of 7 (≤ budget 7) — qualifies.
    const withinBudget = await budgetedStandingsFor([
      ...duoRows('r1', 'scheme-a', -4, duo, teamFive),
      ...duoRows('r2', 'scheme-b', -2, duo, teamShareThree),
    ]);
    assert.strictEqual(withinBudget.get(2)?.fixed.length, 1);
    assert.strictEqual(withinBudget.get(2)?.fixed[0]?.heroPool.length, 7);
    assert.deepEqual(withinBudget.get(2)?.fixed[0]?.players, ['Alice', 'Zed']);

    // Union of 8 (> budget 7) — open qualifies, fixed does not.
    const overBudget = await budgetedStandingsFor([
      ...duoRows('r3', 'scheme-a', -4, duo, teamFive),
      ...duoRows('r4', 'scheme-b', -2, duo, teamShareTwo),
    ]);
    assert.strictEqual(overBudget.get(2)?.open.length, 1);
    assert.deepEqual(overBudget.get(2)?.fixed, []);
  });

  test('the D-24134 roster rules still gate fixed entries — a guest seat voids both divisions', async () => {
    const standings = await budgetedStandingsFor([
      // why: player_count 2 with a single ownership row — team-ineligible
      // on every board in BOTH divisions, exactly as the open division.
      soloRow('r1', 'scheme-a', -4, 1, 'Alice', {
        player_count: 2,
        team_key: TEAM_ABC,
      }),
      ...duoRows(
        'r2',
        'scheme-b',
        -2,
        [
          { playerId: 1, displayName: 'Alice' },
          { playerId: 2, displayName: 'Zed' },
        ],
        TEAM_ABC,
      ),
    ]);
    assert.deepEqual(standings.get(2)?.open, []);
    assert.deepEqual(standings.get(2)?.fixed, []);
  });

  test('a budget-less definition computes an empty fixed division (degrade, never crash)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { team_key: TEAM_ABC }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice', { team_key: TEAM_ABC }),
    ]);
    assert.strictEqual(standings.get(1)?.open.length, 1);
    assert.deepEqual(standings.get(1)?.fixed, []);
  });

  test('more distinct teams than the cap are truncated with a logged warning, never silently', async () => {
    // why: 13 distinct teams exceeds the locked cap of 12 (EC-413 /
    // D-24187 §5). The kept 12 are the lowest-scoring; the best team
    // (score -13, also holding leg B) must survive truncation, so the
    // entry still computes. The warning is asserted — a silent cap is a
    // FAIL by design.
    const rows: StubRow[] = [];
    for (let teamIndex = 1; teamIndex <= 13; teamIndex += 1) {
      const teamKey =
        `core/x${teamIndex}a+core/x${teamIndex}b+core/x${teamIndex}c`;
      rows.push(
        soloRow(`r-a-${teamIndex}`, 'scheme-a', -14 + teamIndex, 1, 'Alice', {
          team_key: teamKey,
        }),
      );
    }
    rows.push(
      soloRow('r-b-1', 'scheme-b', -5, 1, 'Alice', {
        team_key: 'core/x1a+core/x1b+core/x1c',
      }),
    );

    const capturedWarnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...warnArgs: unknown[]) => {
      capturedWarnings.push(String(warnArgs[0]));
    };
    try {
      const standings = await budgetedStandingsFor(rows);
      // Team x1 (leg A score -13) + leg B (-5) = -18, pool = its 3 heroes.
      assert.strictEqual(standings.get(1)?.fixed[0]?.totalScore, -18);
      assert.deepEqual(standings.get(1)?.fixed[0]?.heroPool, [
        'core/x1a',
        'core/x1b',
        'core/x1c',
      ]);
    } finally {
      console.warn = originalWarn;
    }
    assert.strictEqual(capturedWarnings.length, 1);
    assert.ok(
      capturedWarnings[0].includes('13 distinct teams'),
      'The truncation warning must name the distinct-team count.',
    );
  });
});

// ---------------------------------------------------------------------------
// Canonical loadout requirement (WP-395 / D-24199)
// ---------------------------------------------------------------------------

const APPROVED_HENCHMEN = 'core/doombot-legion';
const OTHER_HENCHMEN = 'core/hand-ninjas';

// why: the same gauntlet carrying the D-24199 approved menu. Solo boards
// approve two configurations here so the tests can prove that membership —
// not merely non-emptiness — is what qualifies a replay.
const LOADOUT_DEFINITION: GauntletDefinition = {
  ...TEST_DEFINITION,
  approvedLoadouts: {
    1: [
      { villainSegment: 'villains-x', henchmanKey: APPROVED_HENCHMEN },
      { villainSegment: 'villains-y', henchmanKey: OTHER_HENCHMEN },
    ],
  },
};

/** Convenience: standings for the loadout-carrying definition (WP-395). */
async function loadoutStandingsFor(rows: StubRow[]) {
  const { database } = createStubDatabase(rows);
  return getGauntletStandings(LOADOUT_DEFINITION, database, createStubDeps());
}

/** A complete solo gauntlet (both legs) with the given henchmen key. */
function completeSoloRuns(henchmanKey: string | null): StubRow[] {
  return [
    soloRow('hash-a', 'scheme-a', -10, 1, 'Alice', {
      henchman_key: henchmanKey,
    }),
    soloRow('hash-b', 'scheme-b', -6, 1, 'Alice', {
      henchman_key: henchmanKey,
    }),
  ];
}

describe('canonical loadout requirement (WP-395 / D-24199)', () => {
  test('a replay matching an approved configuration qualifies', async () => {
    const standings = await loadoutStandingsFor(
      completeSoloRuns(APPROVED_HENCHMEN),
    );
    assert.strictEqual(standings.get(1)?.open.length, 1);
    assert.strictEqual(standings.get(1)?.open[0]?.totalScore, -16);
  });

  test('a replay with unapproved henchmen does not qualify', async () => {
    // why: the NEGATIVE case that keeps the test above from passing
    // vacuously — the villain segment still matches an approved row, so only
    // the henchmen half can be doing the rejecting.
    const standings = await loadoutStandingsFor(
      completeSoloRuns('core/savage-land-mutates'),
    );
    assert.strictEqual(standings.get(1)?.open.length, 0);
  });

  test('a replay with unapproved villain groups does not qualify', async () => {
    const rows = [
      soloRow('hash-a', 'scheme-a', -10, 1, 'Alice', {
        scenario_key: 'scheme-a::mm-one::villains-unapproved',
        henchman_key: APPROVED_HENCHMEN,
      }),
      soloRow('hash-b', 'scheme-b', -6, 1, 'Alice', {
        henchman_key: APPROVED_HENCHMEN,
      }),
    ];
    const standings = await loadoutStandingsFor(rows);
    assert.strictEqual(standings.get(1)?.open.length, 0);
  });

  test('an approved pairing must match on BOTH halves, not either', async () => {
    // why: villains-x is approved only WITH doombot-legion, and villains-y
    // only WITH hand-ninjas. Crossing the pairs must fail, or the predicate
    // is checking two independent allowlists rather than a configuration.
    const rows = [
      soloRow('hash-a', 'scheme-a', -10, 1, 'Alice', {
        henchman_key: OTHER_HENCHMEN,
      }),
      soloRow('hash-b', 'scheme-b', -6, 1, 'Alice', {
        henchman_key: OTHER_HENCHMEN,
      }),
    ];
    const standings = await loadoutStandingsFor(rows);
    assert.strictEqual(standings.get(1)?.open.length, 0);
  });

  test('a NULL henchman_key never qualifies once a menu is configured', async () => {
    const standings = await loadoutStandingsFor(completeSoloRuns(null));
    assert.strictEqual(standings.get(1)?.open.length, 0);
  });

  test('a player count with no approved configuration qualifies nobody', async () => {
    // why: fail closed. LOADOUT_DEFINITION approves solo only, so the
    // two-player board must publish empty rather than unconstrained.
    const rows = duoRows('hash-duo-a', 'scheme-a', -10, [
      { playerId: 1, displayName: 'Alice' },
      { playerId: 2, displayName: 'Bob' },
    ]).concat(
      duoRows('hash-duo-b', 'scheme-b', -6, [
        { playerId: 1, displayName: 'Alice' },
        { playerId: 2, displayName: 'Bob' },
      ]),
    );
    const standings = await loadoutStandingsFor(rows);
    assert.strictEqual(standings.get(2)?.open.length, 0);
  });

  test('a definition carrying no menu is unconstrained (pre-WP-395 semantics)', async () => {
    // why: proves the requirement is opt-in and that the fixtures above are
    // rejected BY the menu, not by some unrelated guard in the chain.
    const standings = await standingsFor(completeSoloRuns(null));
    assert.strictEqual(standings.get(1)?.open.length, 1);
  });

  test('buildGauntletCatalog stamps approved loadouts onto the matching gauntlet only', () => {
    const approvedByGauntlet = new Map([
      [
        'core/mm-one',
        { 1: [{ villainSegment: 'villains-x', henchmanKey: APPROVED_HENCHMEN }] },
      ],
    ]);
    const catalog = buildGauntletCatalog(
      [CORE_SUMMARY],
      undefined,
      approvedByGauntlet,
    );
    const first = catalog.find((entry) => entry.mastermindSlug === 'mm-one');
    const second = catalog.find((entry) => entry.mastermindSlug === 'mm-two');
    assert.deepEqual(first?.approvedLoadouts, {
      1: [{ villainSegment: 'villains-x', henchmanKey: APPROVED_HENCHMEN }],
    });
    assert.strictEqual(second?.approvedLoadouts, undefined);
  });
});

// ---------------------------------------------------------------------------
// buildSetDetailsCatalog (WP-461 / D-24279)
// ---------------------------------------------------------------------------

describe('buildSetDetailsCatalog (WP-461 / D-24279)', () => {
  // why: a `core` set whose single gauntlet (core/magneto) approves brotherhood +
  // doombot-legion — so radiation and sentinel are in the roster but fought by no
  // gauntlet (the coverage gap the reveal surfaces).
  const SD_CORE: GauntletSetSummary = {
    setAbbr: 'core',
    setName: 'Core Set',
    schemes: [{ slug: 'scheme-a', name: 'Scheme A' }],
    masterminds: [{ slug: 'magneto', name: 'Magneto' }],
    villains: [
      { slug: 'radiation', name: 'Radiation' },
      { slug: 'brotherhood', name: 'The Brotherhood' },
    ],
    henchmen: [
      { slug: 'sentinel', name: 'Sentinel' },
      { slug: 'doombot-legion', name: 'Doombot Legion' },
    ],
  };
  // why: a `co2e` set whose own gauntlet uses masters-of-evil, NOT
  // enemies-of-asgard — enemies-of-asgard is fought only by the 2099 gauntlet
  // below (cross-set fallback), so it must read false on co2e's own panel.
  const SD_CO2E: GauntletSetSummary = {
    setAbbr: 'co2e',
    setName: 'Core 2E',
    schemes: [{ slug: 'scheme-x', name: 'Scheme X' }],
    masterminds: [{ slug: 'doom', name: 'Doctor Doom' }],
    villains: [
      { slug: 'enemies-of-asgard', name: 'Enemies of Asgard' },
      { slug: 'masters-of-evil', name: 'Masters of Evil' },
    ],
    henchmen: [{ slug: 'hand-ninjas', name: 'Hand Ninjas' }],
  };
  // why: a `2099` set with an EMPTY own henchman roster whose gauntlet fights its
  // own future-foes plus co2e fallbacks — exercises empty-roster + own-flag-true.
  const SD_2099: GauntletSetSummary = {
    setAbbr: '2099',
    setName: '2099',
    schemes: [{ slug: 'scheme-y', name: 'Scheme Y' }],
    masterminds: [{ slug: 'spider-2099', name: 'Spider-Man 2099' }],
    villains: [{ slug: 'future-foes', name: 'Future Foes' }],
    henchmen: [],
  };
  const SD_SCHEMELESS: GauntletSetSummary = {
    setAbbr: 'aaa',
    setName: 'Schemeless',
    schemes: [],
    masterminds: [{ slug: 'mm', name: 'MM' }],
    villains: [{ slug: 'v', name: 'V' }],
    henchmen: [{ slug: 'h', name: 'H' }],
  };

  const SD_APPROVED: ReadonlyMap<string, GauntletApprovedLoadouts> = new Map([
    [
      'core/magneto',
      {
        1: [
          {
            villainSegment: '',
            henchmanKey: '',
            villainGroupIds: ['core/brotherhood'],
            henchmanGroupIds: ['core/doombot-legion'],
          },
        ],
      },
    ],
    [
      'co2e/doom',
      {
        1: [
          {
            villainSegment: '',
            henchmanKey: '',
            villainGroupIds: ['co2e/masters-of-evil'],
            henchmanGroupIds: ['co2e/hand-ninjas'],
          },
        ],
      },
    ],
    [
      '2099/spider-2099',
      {
        1: [
          {
            villainSegment: '',
            henchmanKey: '',
            // why: OWN future-foes + a co2e FALLBACK villain/henchman.
            villainGroupIds: ['2099/future-foes', 'co2e/enemies-of-asgard'],
            henchmanGroupIds: ['co2e/hand-ninjas'],
          },
        ],
      },
    ],
  ]);

  test('flags coverage per group and carries authoritative names', () => {
    const catalog = buildSetDetailsCatalog([SD_CORE], SD_APPROVED);
    assert.strictEqual(catalog.length, 1);
    const core = catalog[0];
    assert.strictEqual(core?.setName, 'Core Set');
    // authoritative registry names, not re-derived slugs
    assert.deepStrictEqual(
      core?.masterminds,
      [{ slug: 'magneto', name: 'Magneto' }],
    );
    assert.deepStrictEqual(core?.schemes, [{ slug: 'scheme-a', name: 'Scheme A' }]);
    assert.deepStrictEqual(core?.villains, [
      { slug: 'brotherhood', name: 'The Brotherhood', usedByGauntlets: true },
      { slug: 'radiation', name: 'Radiation', usedByGauntlets: false },
    ]);
    assert.deepStrictEqual(core?.henchmen, [
      { slug: 'doombot-legion', name: 'Doombot Legion', usedByGauntlets: true },
      { slug: 'sentinel', name: 'Sentinel', usedByGauntlets: false },
    ]);
  });

  test('orders sets setAbbr ASC and rosters slug ASC', () => {
    const catalog = buildSetDetailsCatalog(
      [SD_2099, SD_CORE, SD_CO2E],
      SD_APPROVED,
    );
    assert.deepStrictEqual(
      catalog.map((set) => set.setAbbr),
      ['2099', 'co2e', 'core'],
    );
    const core = catalog.find((set) => set.setAbbr === 'core');
    assert.deepStrictEqual(
      core?.villains.map((villain) => villain.slug),
      ['brotherhood', 'radiation'],
    );
  });

  test('excludes a set with zero schemes', () => {
    const catalog = buildSetDetailsCatalog(
      [SD_SCHEMELESS, SD_CORE],
      SD_APPROVED,
    );
    assert.deepStrictEqual(
      catalog.map((set) => set.setAbbr),
      ['core'],
    );
  });

  test('absent approvedLoadouts flags every group false, no throw', () => {
    const catalog = buildSetDetailsCatalog([SD_CORE]);
    const core = catalog[0];
    assert.ok(core);
    assert.ok(core.villains.every((villain) => villain.usedByGauntlets === false));
    assert.ok(core.henchmen.every((henchman) => henchman.usedByGauntlets === false));
  });

  test('cross-set fallback does not flip the foreign set flags', () => {
    const catalog = buildSetDetailsCatalog([SD_CO2E, SD_2099], SD_APPROVED);
    const co2e = catalog.find((set) => set.setAbbr === 'co2e');
    // co2e's OWN gauntlet fights masters-of-evil, never enemies-of-asgard — only
    // the 2099 gauntlet pulls co2e/enemies-of-asgard as a fallback, which must NOT
    // flip co2e's own flag (a global scan would wrongly mark it true).
    const enemiesOfAsgard = co2e?.villains.find(
      (villain) => villain.slug === 'enemies-of-asgard',
    );
    const mastersOfEvil = co2e?.villains.find(
      (villain) => villain.slug === 'masters-of-evil',
    );
    assert.strictEqual(enemiesOfAsgard?.usedByGauntlets, false);
    assert.strictEqual(mastersOfEvil?.usedByGauntlets, true);
  });

  test('empty own roster yields an empty array; own group flags correctly', () => {
    const catalog = buildSetDetailsCatalog([SD_2099], SD_APPROVED);
    const set2099 = catalog[0];
    assert.deepStrictEqual(set2099?.henchmen, []);
    assert.deepStrictEqual(set2099?.villains, [
      { slug: 'future-foes', name: 'Future Foes', usedByGauntlets: true },
    ]);
  });
});
