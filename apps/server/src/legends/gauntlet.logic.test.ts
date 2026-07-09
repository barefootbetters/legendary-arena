/**
 * Tests for the mastermind set-gauntlet catalog + standings (WP-342).
 *
 * Catalog tests are pure. Standings tests use a stub DatabaseClient
 * returning canned qualifying rows — the SQL-side filters (outcome,
 * visibility, slug match) are exercised by the DB-gated submission
 * tests in competition.logic.test.ts; these tests prove the
 * application-side aggregation: version filter, best-per-leg,
 * complete-gauntlets-only, ranking, and the centesimal average.
 *
 * Authority: WP-342; EC-372 §Locked Values; D-24131.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGauntletBoardName,
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
  schemeSlugs: ['scheme-b', 'scheme-a'],
  masterminds: [
    { slug: 'mm-two', name: 'Mastermind Two' },
    { slug: 'mm-one', name: 'Mastermind One' },
  ],
};

const SCHEMELESS_SUMMARY: GauntletSetSummary = {
  setAbbr: 'dims',
  setName: 'Dimensions',
  schemeSlugs: [],
  masterminds: [{ slug: 'mm-orphan', name: 'Orphan Mastermind' }],
};

const TEST_DEFINITION: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'mm-one',
  mastermindName: 'Mastermind One',
  legSchemeSlugs: ['scheme-a', 'scheme-b'],
};

interface StubRow {
  player_id: number;
  display_name: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
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

/** Builds a canonical test scenario key for a (scheme, villains) pair. */
function scenarioKeyFor(schemeSlug: string, mastermindSlug: string): string {
  return `${schemeSlug}::${mastermindSlug}::villains-x`;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

describe('gauntlet catalog (WP-342)', () => {
  test('one gauntlet per mastermind for sets with schemes; schemeless sets contribute none', () => {
    const catalog = buildGauntletCatalog([SCHEMELESS_SUMMARY, CORE_SUMMARY]);
    assert.strictEqual(catalog.length, 2);
    for (const definition of catalog) {
      assert.strictEqual(definition.setAbbr, 'core');
      assert.deepEqual(definition.legSchemeSlugs, ['scheme-a', 'scheme-b']);
    }
  });

  test('catalog ordering is deterministic: setAbbr ASC, mastermind slug ASC, legs sorted', () => {
    const catalog = buildGauntletCatalog([CORE_SUMMARY]);
    assert.deepEqual(
      catalog.map((definition) => definition.mastermindSlug),
      ['mm-one', 'mm-two'],
    );
    assert.deepEqual(catalog[0]?.legSchemeSlugs, ['scheme-a', 'scheme-b']);
  });

  test('board name is gauntlet-<setAbbr>-<mastermindSlug>', () => {
    assert.strictEqual(
      buildGauntletBoardName(TEST_DEFINITION),
      'gauntlet-core-mm-one',
    );
  });
});

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

describe('gauntlet standings (WP-342)', () => {
  test('a player with a winning best on every leg enters with sum, centesimal average, and rank', async () => {
    const { database, receivedParams } = createStubDatabase([
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -5,
        scoring_config_version: 1,
      },
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: -2,
        scoring_config_version: 1,
      },
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );

    assert.strictEqual(entries.length, 1);
    assert.deepEqual(entries[0], {
      handle: 'Alice',
      rank: 1,
      totalScore: -7,
      legCount: 2,
      averageScoreCentis: -350,
    });

    // The query received the gauntlet's mastermind slug + leg slugs.
    assert.deepEqual(receivedParams[0], [
      'mm-one',
      ['scheme-a', 'scheme-b'],
    ]);
  });

  test('a player missing a leg is excluded (complete gauntlets only)', async () => {
    const { database } = createStubDatabase([
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -5,
        scoring_config_version: 1,
      },
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );
    assert.deepEqual(entries, []);
  });

  test('best-per-leg keeps the lowest score among multiple winning rows', async () => {
    const { database } = createStubDatabase([
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: 4,
        scoring_config_version: 1,
      },
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -6,
        scoring_config_version: 1,
      },
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: 0,
        scoring_config_version: 1,
      },
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0]?.totalScore, -6);
  });

  test('rows at a stale scoringConfigVersion never qualify (VISION section 22)', async () => {
    const { database } = createStubDatabase([
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -5,
        // why: the stub gate publishes version 1; this row is version 2 —
        // it must be skipped, leaving the gauntlet incomplete.
        scoring_config_version: 2,
      },
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: -2,
        scoring_config_version: 1,
      },
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );
    assert.deepEqual(entries, []);
  });

  test('rows for an unpublished scenario never qualify (fail closed)', async () => {
    const { database } = createStubDatabase([
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: 'scheme-a::mm-one::unpublished-villains',
        final_score: -5,
        scoring_config_version: 1,
      },
      {
        player_id: 1,
        display_name: 'Alice',
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: -2,
        scoring_config_version: 1,
      },
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );
    assert.deepEqual(entries, []);
  });

  test('ranking is totalScore ASC, then handle ASC', async () => {
    const rowsFor = (
      playerId: number,
      handle: string,
      scoreA: number,
      scoreB: number,
    ): StubRow[] => [
      {
        player_id: playerId,
        display_name: handle,
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: scoreA,
        scoring_config_version: 1,
      },
      {
        player_id: playerId,
        display_name: handle,
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: scoreB,
        scoring_config_version: 1,
      },
    ];

    const { database } = createStubDatabase([
      ...rowsFor(1, 'Zed', -1, -1),
      ...rowsFor(2, 'Alice', -1, -1),
      ...rowsFor(3, 'Mallory', -10, -1),
    ]);

    const entries = await getGauntletStandings(
      TEST_DEFINITION,
      database,
      createStubDeps(),
    );
    assert.deepEqual(
      entries.map((entry) => [entry.rank, entry.handle]),
      [
        [1, 'Mallory'],
        [2, 'Alice'],
        [3, 'Zed'],
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// Per-player progress (WP-344)
// ---------------------------------------------------------------------------

import { getPlayerGauntletProgress } from './gauntlet.logic.js';

interface ProgressStubRow {
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
}

function createProgressStubDatabase(rows: ProgressStubRow[]): {
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

describe('gauntlet player progress (WP-344)', () => {
  test('winning legs fold to best-per-leg with completion counts; zero-progress gauntlets are omitted', async () => {
    const otherDefinition: GauntletDefinition = {
      setAbbr: 'dkpr',
      setName: 'Dark City',
      mastermindSlug: 'mm-elsewhere',
      mastermindName: 'Elsewhere',
      legSchemeSlugs: ['scheme-z'],
    };
    const { database, receivedParams } = createProgressStubDatabase([
      {
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: 4,
        scoring_config_version: 1,
      },
      {
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -6,
        scoring_config_version: 1,
      },
    ]);

    const progress = await getPlayerGauntletProgress(
      'account-1',
      [TEST_DEFINITION, otherDefinition],
      database,
      createStubDeps(),
    );

    assert.equal(progress.length, 1);
    assert.deepEqual(progress[0], {
      setAbbr: 'core',
      setName: 'Core Set',
      mastermindSlug: 'mm-one',
      mastermindName: 'Mastermind One',
      board: 'gauntlet-core-mm-one',
      legCount: 2,
      completedLegCount: 1,
      isComplete: false,
      legs: [
        { schemeSlug: 'scheme-a', bestFinalScore: -6 },
        { schemeSlug: 'scheme-b', bestFinalScore: null },
      ],
    });
    assert.deepEqual(receivedParams[0], ['account-1']);
  });

  test('a winning best on every leg marks the gauntlet complete', async () => {
    const { database } = createProgressStubDatabase([
      {
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -1,
        scoring_config_version: 1,
      },
      {
        scenario_key: scenarioKeyFor('scheme-b', 'mm-one'),
        final_score: 2,
        scoring_config_version: 1,
      },
    ]);

    const progress = await getPlayerGauntletProgress(
      'account-1',
      [TEST_DEFINITION],
      database,
      createStubDeps(),
    );
    assert.equal(progress.length, 1);
    assert.equal(progress[0]?.isComplete, true);
    assert.equal(progress[0]?.completedLegCount, 2);
  });

  test('stale-version and unpublished-scenario rows never count (VISION section 22)', async () => {
    const { database } = createProgressStubDatabase([
      {
        scenario_key: scenarioKeyFor('scheme-a', 'mm-one'),
        final_score: -5,
        scoring_config_version: 2,
      },
      {
        scenario_key: 'scheme-b::mm-one::unpublished-villains',
        final_score: -2,
        scoring_config_version: 1,
      },
    ]);

    const progress = await getPlayerGauntletProgress(
      'account-1',
      [TEST_DEFINITION],
      database,
      createStubDeps(),
    );
    assert.deepEqual(progress, []);
  });

  test('an empty catalog short-circuits without touching the database', async () => {
    const { database, receivedParams } = createProgressStubDatabase([]);
    const progress = await getPlayerGauntletProgress(
      'account-1',
      [],
      database,
      createStubDeps(),
    );
    assert.deepEqual(progress, []);
    assert.equal(receivedParams.length, 0);
  });
});
