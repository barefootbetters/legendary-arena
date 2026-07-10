/**
 * Tests for the mastermind set-gauntlet catalog + standings
 * (WP-342 / WP-344).
 *
 * Catalog tests are pure. Standings tests use a stub DatabaseClient
 * returning canned (replay × owner) rows — the SQL-side filters
 * (outcome, NOT-NULL player_count, slug match, replay dedupe) are
 * exercised by the DB-gated submission tests in
 * competition.logic.test.ts; these tests prove the application-side
 * aggregation: version filter, roster grouping, the all-seats and
 * all-visible gates, best-per-leg, complete-gauntlets-only, per-count
 * keying, ranking, and the centesimal average.
 *
 * Authority: WP-342; WP-344; EC-376 §Locked Values; D-24131; D-24134.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGauntletBoardName,
  buildGauntletBoardNameForPlayerCount,
  buildGauntletCatalog,
  getGauntletStandings,
} from './gauntlet.logic.js';
import type {
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
};

const SCHEMELESS_SUMMARY: GauntletSetSummary = {
  setAbbr: 'dims',
  setName: 'Dimensions',
  schemes: [],
  masterminds: [{ slug: 'mm-orphan', name: 'Orphan Mastermind' }],
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

/**
 * One (replay × owner) row as the WP-344 standings query returns them.
 */
interface StubRow {
  replay_hash: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
  player_count: number | null;
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
 * given leg, owned by one public account. Fields override via `extra`.
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
    player_id: playerId,
    display_name: displayName,
    visibility: 'public',
    ...extra,
  };
}

/**
 * The (replay × owner) rows for one 2-player winning replay: one row
 * per owner, identical replay-level facts.
 */
function duoRows(
  replayHash: string,
  schemeSlug: string,
  finalScore: number,
  owners: readonly { playerId: number; displayName: string; visibility?: string }[],
): StubRow[] {
  const rows: StubRow[] = [];
  for (const owner of owners) {
    rows.push({
      replay_hash: replayHash,
      scenario_key: scenarioKeyFor(schemeSlug, 'mm-one'),
      final_score: finalScore,
      scoring_config_version: 1,
      player_count: 2,
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

    assert.deepEqual(standings.get(1), [
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
      assert.deepEqual(standings.get(playerCount), []);
    }

    // The query received the gauntlet's mastermind slug + leg slugs.
    assert.deepEqual(receivedParams[0], ['mm-one', ['scheme-a', 'scheme-b']]);
  });

  test('a solo player missing a leg is excluded (complete gauntlets only)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1), []);
  });

  test('best-per-leg keeps the lowest score among multiple winning replays', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', 4, 1, 'Alice'),
      soloRow('r2', 'scheme-a', -6, 1, 'Alice'),
      soloRow('r3', 'scheme-b', 0, 1, 'Alice'),
    ]);
    assert.strictEqual(standings.get(1)?.[0]?.totalScore, -6);
  });

  test('replays at a stale scoringConfigVersion never qualify (VISION section 22)', async () => {
    const standings = await standingsFor([
      // why: the stub gate publishes version 1; this replay is version 2 —
      // it must be skipped, leaving the gauntlet incomplete.
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { scoring_config_version: 2 }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1), []);
  });

  test('replays for an unpublished scenario never qualify (fail closed)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', {
        scenario_key: 'scheme-a::mm-one::unpublished-villains',
      }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    assert.deepEqual(standings.get(1), []);
  });

  test('a NULL player_count replay never qualifies on any count (D-24134 section 1)', async () => {
    const standings = await standingsFor([
      soloRow('r1', 'scheme-a', -5, 1, 'Alice', { player_count: null }),
      soloRow('r2', 'scheme-b', -2, 1, 'Alice'),
    ]);
    for (const playerCount of [1, 2, 3, 4, 5]) {
      assert.deepEqual(standings.get(playerCount), []);
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
      standings.get(1)?.map((entry) => [entry.rank, entry.handle]),
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

    assert.deepEqual(standings.get(2), [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -6,
        legCount: 2,
        averageScoreCentis: -300,
        players: ['Alice', 'Zed'],
      },
    ]);
    assert.deepEqual(standings.get(1), []);
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
    assert.deepEqual(standings.get(2), []);
    assert.deepEqual(standings.get(1), []);
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
    assert.deepEqual(standings.get(2), []);
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
    assert.deepEqual(standings.get(2), []);
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
      standings.get(2)?.map((entry) => [entry.rank, entry.players.join('+')]),
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

    assert.strictEqual(standings.get(1)?.length, 1);
    assert.strictEqual(standings.get(2)?.length, 1);
    assert.deepEqual(standings.get(1)?.[0]?.players, ['Alice']);
    assert.deepEqual(standings.get(2)?.[0]?.players, ['Alice', 'Zed']);
  });
});
