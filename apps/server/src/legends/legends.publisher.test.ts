/**
 * Tests for the legends snapshot publisher (WP-142).
 *
 * Uses a stub R2 client; verifies error paths do not throw, manifest
 * is not written on board failure, and publisher-layer byte-identity.
 * No real R2 SDK imported.
 *
 * Authority: WP-142 §G; EC-157 §Test Plan.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { publishAllBoards, resetArchiveTracking } from './legends.publisher.js';
import type { GauntletDefinition } from './gauntlet.logic.js';
import type { LegendsR2Client, SetDetails } from './legends.types.js';
import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

interface PutCall {
  readonly body: string;
  readonly bucket: string;
  readonly key: string;
}

function createStubR2Client(options?: {
  failOnKey?: string;
}): { client: LegendsR2Client; putCalls: PutCall[] } {
  const putCalls: PutCall[] = [];
  const client: LegendsR2Client = {
    async putObject(params) {
      if (options?.failOnKey !== undefined && params.key.includes(options.failOnKey)) {
        throw new Error(`Simulated R2 failure on key: ${params.key}`);
      }
      putCalls.push({
        body: params.body,
        bucket: params.bucket,
        key: params.key,
      });
    },
  };
  return { client, putCalls };
}

/**
 * Stub database that returns canned results for the leaderboard queries.
 */
function createStubDatabase(options?: {
  scenarioKeys?: string[];
  failOnQuery?: string;
}): DatabaseClient {
  const scenarioKeys = options?.scenarioKeys ?? ['test-scenario'];

  return {
    async query(text: string, params?: unknown[]) {
      if (options?.failOnQuery !== undefined && text.includes(options.failOnQuery)) {
        throw new Error(`Simulated DB failure on: ${options.failOnQuery}`);
      }

      // BEGIN / SET TRANSACTION READ ONLY / COMMIT / ROLLBACK
      if (
        text === 'BEGIN' ||
        text === 'SET TRANSACTION READ ONLY' ||
        text === 'COMMIT' ||
        text === 'ROLLBACK'
      ) {
        return { rows: [], rowCount: 0 };
      }

      // listScenarioKeys
      if (text.includes('DISTINCT cs.scenario_key')) {
        const rows = scenarioKeys.map((scenarioKey) => ({ scenario_key: scenarioKey }));
        return { rows, rowCount: rows.length };
      }

      // COUNT(*)
      if (text.includes('COUNT(*)')) {
        return { rows: [{ total: '2' }], rowCount: 1 };
      }

      // getScenarioLeaderboard / getGlobalTopLeaderboard
      if (text.includes('FROM legendary.competitive_scores')) {
        const rows = [
          {
            replay_hash: 'hash-1',
            player_display_name: 'Alice',
            scenario_key: (params && params[0] !== undefined)
              ? (Array.isArray(params[0]) ? params[0][0] : params[0])
              : 'test-scenario',
            final_score: 42,
            raw_score: 40,
            par_version: 'v1',
            scoring_config_version: 1,
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            replay_hash: 'hash-2',
            player_display_name: 'Bob',
            scenario_key: (params && params[0] !== undefined)
              ? (Array.isArray(params[0]) ? params[0][0] : params[0])
              : 'test-scenario',
            final_score: 50,
            raw_score: 48,
            par_version: 'v1',
            scoring_config_version: 1,
            created_at: '2026-01-02T00:00:00.000Z',
          },
        ];
        return { rows, rowCount: rows.length };
      }

      return { rows: [], rowCount: 0 };
    },
  } as DatabaseClient;
}

function createStubDeps(): LeaderboardDependencies {
  return {
    checkParPublished: () => ({
      parValue: 45,
      parVersion: 'v1',
      source: 'simulation' as const,
      scoringConfig: { baseMultiplier: 1 } as never,
    }),
    getScenarioKeysForTheme: () => null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('legends publisher (WP-142)', () => {
  beforeEach(() => {
    resetArchiveTracking();
  });

  test('publishAllBoards writes boards and manifest to R2 on success', async () => {
    const database = createStubDatabase({ scenarioKeys: ['alpha-scenario'] });
    const { client, putCalls } = createStubR2Client();
    const deps = createStubDeps();

    const result = await publishAllBoards(database, client, 'test-bucket', deps);

    assert.equal(result.manifestWritten, true);
    assert.equal(result.boards.length, 2);

    for (const board of result.boards) {
      assert.equal(board.success, true);
    }

    const putKeys = putCalls.map((call) => call.key);
    assert.ok(putKeys.some((key) => key.includes('global-top.json')));
    assert.ok(putKeys.some((key) => key.includes('scenario-alpha-scenario.json')));
    assert.ok(putKeys.some((key) => key.includes('manifest.json')));
  });

  test('manifest is NOT written when a board PUT fails', async () => {
    const database = createStubDatabase({ scenarioKeys: ['fail-scenario'] });
    const { client, putCalls } = createStubR2Client({
      failOnKey: 'global-top',
    });
    const deps = createStubDeps();

    const result = await publishAllBoards(database, client, 'test-bucket', deps);

    assert.equal(result.manifestWritten, false);

    const hasManifest = putCalls.some((call) => call.key.includes('manifest.json'));
    assert.equal(hasManifest, false, 'Manifest must not be written when a board fails.');
  });

  test('R2 errors are returned in PublishResult — never thrown', async () => {
    const database = createStubDatabase({ scenarioKeys: ['err-scenario'] });
    const { client } = createStubR2Client({ failOnKey: 'scenario-err-scenario' });
    const deps = createStubDeps();

    const result = await publishAllBoards(database, client, 'test-bucket', deps);

    assert.ok(result.runId.length > 0);
    assert.equal(typeof result.manifestWritten, 'boolean');

    const failedBoard = result.boards.find(
      (board) => board.board === 'scenario-err-scenario',
    );
    assert.ok(failedBoard !== undefined);
    assert.equal(failedBoard.success, false);
    assert.ok(
      failedBoard.errorMessage !== undefined && failedBoard.errorMessage.length > 0,
    );
  });

  test('two consecutive publishes with same DB state produce byte-identical board files', async () => {
    const database = createStubDatabase({ scenarioKeys: ['stable-scenario'] });
    const deps = createStubDeps();

    const { client: client1, putCalls: puts1 } = createStubR2Client();
    await publishAllBoards(database, client1, 'test-bucket', deps);

    resetArchiveTracking();

    const { client: client2, putCalls: puts2 } = createStubR2Client();
    await publishAllBoards(database, client2, 'test-bucket', deps);

    const boardPuts1 = puts1.filter(
      (put) => !put.key.includes('manifest') && !put.key.includes('archive'),
    );
    const boardPuts2 = puts2.filter(
      (put) => !put.key.includes('manifest') && !put.key.includes('archive'),
    );

    assert.equal(boardPuts1.length, boardPuts2.length);

    for (let index = 0; index < boardPuts1.length; index = index + 1) {
      assert.equal(boardPuts1[index].key, boardPuts2[index].key);
      assert.equal(
        boardPuts1[index].body,
        boardPuts2[index].body,
        `Board file at ${boardPuts1[index].key} must be byte-identical across runs.`,
      );
    }
  });

  test('publishAllBoards handles DB query failure gracefully', async () => {
    const database = createStubDatabase({ failOnQuery: 'DISTINCT' });
    const { client } = createStubR2Client();
    const deps = createStubDeps();

    const result = await publishAllBoards(database, client, 'test-bucket', deps);

    assert.equal(result.boards.length, 0);
    assert.equal(result.manifestWritten, false);
  });

  test('runId format matches <ISO-timestamp>-<4-char-hex>', () => {
    const runIdPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[0-9a-f]{4}$/;

    const database = createStubDatabase();
    const { client } = createStubR2Client();
    const deps = createStubDeps();

    return publishAllBoards(database, client, 'test-bucket', deps).then(
      (result) => {
        assert.ok(
          runIdPattern.test(result.runId),
          `runId "${result.runId}" must match <ISO-timestamp>-<4-char-hex> format.`,
        );
      },
    );
  });

  test('all R2 puts target the correct bucket', async () => {
    const database = createStubDatabase({ scenarioKeys: ['bucket-test'] });
    const { client, putCalls } = createStubR2Client();
    const deps = createStubDeps();

    await publishAllBoards(database, client, 'my-legends-bucket', deps);

    for (const put of putCalls) {
      assert.equal(put.bucket, 'my-legends-bucket');
    }
  });
});

// ---------------------------------------------------------------------------
// WP-342 — gauntlet boards + index + additive manifest
// ---------------------------------------------------------------------------


const GAUNTLET_WITH_ENTRIES: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'mm-full',
  mastermindName: 'Full Mastermind',
  legs: [{ schemeSlug: 'scheme-a', schemeName: 'Scheme A' }],
};

const GAUNTLET_EMPTY: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'mm-empty',
  mastermindName: 'Empty Mastermind',
  legs: [{ schemeSlug: 'scheme-a', schemeName: 'Scheme A' }],
};

const TEST_GAUNTLET_CATALOG: readonly GauntletDefinition[] = [
  GAUNTLET_WITH_ENTRIES,
  GAUNTLET_EMPTY,
];

/**
 * Stub database extending the WP-142 pattern with a gauntlet branch:
 * the standings query (identified by its outcome predicate) returns one
 * complete-player row for `mm-full` and nothing for `mm-empty`.
 */
function createGauntletStubDatabase(): DatabaseClient {
  return {
    async query(text: string, params?: unknown[]) {
      if (
        text === 'BEGIN' ||
        text === 'SET TRANSACTION READ ONLY' ||
        text === 'COMMIT' ||
        text === 'ROLLBACK'
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (text.includes('DISTINCT cs.scenario_key')) {
        return { rows: [], rowCount: 0 };
      }

      // Gauntlet standings query — keyed on its outcome predicate. Rows are
      // the WP-344 (replay × owner) shape: a solo winning replay owned by
      // one link/public account.
      if (text.includes("outcome = 'heroes-win'")) {
        if (params !== undefined && params[0] === 'mm-full') {
          const rows = [
            {
              replay_hash: 'replay-alice-a',
              scenario_key: 'scheme-a::mm-full::villains-x',
              final_score: -3,
              scoring_config_version: 1,
              player_count: 1,
              player_id: 7,
              display_name: 'Alice',
              visibility: 'public',
            },
          ];
          return { rows, rowCount: rows.length };
        }
        return { rows: [], rowCount: 0 };
      }

      if (text.includes('COUNT(*)')) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  } as DatabaseClient;
}

/**
 * Deps whose published scoringConfigVersion matches the stub rows (1),
 * so gauntlet rows qualify under the VISION §22 version filter.
 */
function createGauntletStubDeps(): LeaderboardDependencies {
  return {
    checkParPublished: () => ({
      parValue: 0,
      parVersion: 'v1',
      source: 'simulation' as const,
      scoringConfig: { scoringConfigVersion: 1 } as never,
    }),
    getScenarioKeysForTheme: () => null,
  };
}

describe('legends publisher gauntlet boards (WP-342)', () => {
  beforeEach(() => {
    resetArchiveTracking();
  });

  test('no catalog: no gauntlet files and a byte-compatible WP-142 manifest', async () => {
    const database = createGauntletStubDatabase();
    const { client, putCalls } = createStubR2Client();

    const result = await publishAllBoards(
      database, client, 'test-bucket', createGauntletStubDeps(),
    );

    assert.equal(result.manifestWritten, true);
    const gauntletPuts = putCalls.filter((put) => put.key.includes('gauntlet'));
    assert.deepEqual(gauntletPuts, []);

    const manifestPut = putCalls.find((put) => put.key.includes('manifest.json'));
    assert.ok(manifestPut !== undefined);
    const manifest = JSON.parse(manifestPut.body);
    assert.equal('gauntletBoards' in manifest, false);
    assert.equal('gauntletIndex' in manifest, false);
  });

  test('with catalog: board file only for populated gauntlets, index always, additive manifest, manifest last', async () => {
    const database = createGauntletStubDatabase();
    const { client, putCalls } = createStubR2Client();

    const result = await publishAllBoards(
      database, client, 'test-bucket', createGauntletStubDeps(),
      TEST_GAUNTLET_CATALOG,
    );

    assert.equal(result.manifestWritten, true);

    const putKeys = putCalls.map((put) => put.key);
    assert.ok(putKeys.includes('legends/v1/gauntlet-core-mm-full.json'));
    assert.equal(
      putKeys.includes('legends/v1/gauntlet-core-mm-empty.json'),
      false,
      'A zero-entry gauntlet must not get a board file (D-24131 §7).',
    );
    assert.ok(putKeys.includes('legends/v1/gauntlet-index.json'));

    // Manifest is written LAST (D-14204) with the additive fields.
    const lastPut = putCalls[putCalls.length - 1];
    assert.ok(lastPut !== undefined);
    assert.equal(lastPut.key, 'legends/v1/manifest.json');
    const manifest = JSON.parse(lastPut.body);
    assert.deepEqual(manifest.gauntletBoards, ['gauntlet-core-mm-full']);
    assert.equal(manifest.gauntletIndex, 'gauntlet-index');
    assert.equal(manifest.schemaVersion, 1);
    assert.ok(Array.isArray(manifest.boards));

    // The index lists EVERY catalog gauntlet with its entryCount.
    const indexPut = putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(indexPut !== undefined);
    const index = JSON.parse(indexPut.body);
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.gauntlets.length, 2);
    const fullEntry = index.gauntlets.find(
      (entry: { board: string }) => entry.board === 'gauntlet-core-mm-full',
    );
    const emptyEntry = index.gauntlets.find(
      (entry: { board: string }) => entry.board === 'gauntlet-core-mm-empty',
    );
    assert.equal(fullEntry.entryCount, 1);
    assert.equal(fullEntry.legCount, 1);
    assert.equal(emptyEntry.entryCount, 0);

    // WP-344 / D-24134 §5 — additive per-count counts + the leg list.
    assert.deepEqual(fullEntry.entryCounts, {
      '1': 1,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });
    assert.deepEqual(fullEntry.legs, [
      { schemeSlug: 'scheme-a', schemeName: 'Scheme A' },
    ]);
    assert.deepEqual(emptyEntry.entryCounts, {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });

    // The board file carries the ranked standings entry.
    const boardPut = putCalls.find((put) =>
      put.key.includes('gauntlet-core-mm-full.json'),
    );
    assert.ok(boardPut !== undefined);
    const board = JSON.parse(boardPut.body);
    assert.equal(board.board, 'gauntlet-core-mm-full');
    assert.equal(board.rowCount, 1);
    assert.deepEqual(board.entries, [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -3,
        legCount: 1,
        averageScoreCentis: -300,
        players: ['Alice'],
      },
    ]);
  });

  test('a gauntlet board PUT failure blocks the manifest (stale-consistent snapshot)', async () => {
    const database = createGauntletStubDatabase();
    const { client, putCalls } = createStubR2Client({
      failOnKey: 'gauntlet-core-mm-full',
    });

    const result = await publishAllBoards(
      database, client, 'test-bucket', createGauntletStubDeps(),
      TEST_GAUNTLET_CATALOG,
    );

    assert.equal(result.manifestWritten, false);
    const hasManifest = putCalls.some((put) => put.key.includes('manifest.json'));
    assert.equal(hasManifest, false);
  });

  test('WP-461: emits `sets` when a setDetailsCatalog is supplied, omits it otherwise', async () => {
    const setDetailsCatalog: SetDetails[] = [
      {
        setAbbr: 'core',
        setName: 'Core Set',
        masterminds: [{ slug: 'mm-full', name: 'MM Full' }],
        schemes: [{ slug: 'scheme-a', name: 'Scheme A' }],
        villains: [
          { slug: 'brotherhood', name: 'The Brotherhood', usedByGauntlets: true },
          { slug: 'radiation', name: 'Radiation', usedByGauntlets: false },
        ],
        henchmen: [
          { slug: 'doombot-legion', name: 'Doombot Legion', usedByGauntlets: true },
        ],
      },
    ];

    // With the catalog: the index carries `sets` verbatim.
    const withR2 = createStubR2Client();
    await publishAllBoards(
      createGauntletStubDatabase(), withR2.client, 'test-bucket',
      createGauntletStubDeps(), TEST_GAUNTLET_CATALOG, setDetailsCatalog,
    );
    const withIndexPut = withR2.putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(withIndexPut !== undefined);
    assert.deepEqual(JSON.parse(withIndexPut.body).sets, setDetailsCatalog);

    // Without the catalog: the index omits `sets` entirely (pre-WP-461 shape).
    const withoutR2 = createStubR2Client();
    await publishAllBoards(
      createGauntletStubDatabase(), withoutR2.client, 'test-bucket',
      createGauntletStubDeps(), TEST_GAUNTLET_CATALOG,
    );
    const withoutIndexPut = withoutR2.putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(withoutIndexPut !== undefined);
    assert.equal('sets' in JSON.parse(withoutIndexPut.body), false);
  });
});

// ---------------------------------------------------------------------------
// WP-384 — fixed-hero-pool division emission (D-24187)
// ---------------------------------------------------------------------------

// why: the WP-342/WP-344 fixtures above deliberately carry NO team_key and
// NO heroPoolBudgets, so every prior assertion (board files, gauntletBoards,
// index entryCounts) holds byte-identically — the fixed division only
// engages on this budgeted catalog whose stub rows carry a team identity.
const BUDGETED_GAUNTLET_CATALOG: readonly GauntletDefinition[] = [
  {
    ...GAUNTLET_WITH_ENTRIES,
    heroPoolBudgets: { 1: 5, 2: 7, 3: 7, 4: 7, 5: 8 },
  },
  {
    ...GAUNTLET_EMPTY,
    heroPoolBudgets: { 1: 5, 2: 7, 3: 7, 4: 7, 5: 8 },
  },
];

/**
 * Stub database mirroring createGauntletStubDatabase but with a team_key
 * on the qualifying row, so the fixed division computes one entry.
 */
function createTeamedGauntletStubDatabase(): DatabaseClient {
  return {
    async query(text: string, params?: unknown[]) {
      if (
        text === 'BEGIN' ||
        text === 'SET TRANSACTION READ ONLY' ||
        text === 'COMMIT' ||
        text === 'ROLLBACK'
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (text.includes('DISTINCT cs.scenario_key')) {
        return { rows: [], rowCount: 0 };
      }

      if (text.includes("outcome = 'heroes-win'")) {
        if (params !== undefined && params[0] === 'mm-full') {
          const rows = [
            {
              replay_hash: 'replay-alice-a',
              scenario_key: 'scheme-a::mm-full::villains-x',
              final_score: -3,
              scoring_config_version: 1,
              player_count: 1,
              team_key: 'core/hero-a+core/hero-b+core/hero-c',
              player_id: 7,
              display_name: 'Alice',
              visibility: 'public',
            },
          ];
          return { rows, rowCount: rows.length };
        }
        return { rows: [], rowCount: 0 };
      }

      if (text.includes('COUNT(*)')) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  } as DatabaseClient;
}

describe('legends publisher fixed-hero-pool boards (WP-384)', () => {
  beforeEach(() => {
    resetArchiveTracking();
  });

  test('a budgeted catalog with teamed wins emits the -fixed board, fixedEntryCounts, and a sorted manifest list', async () => {
    const database = createTeamedGauntletStubDatabase();
    const { client, putCalls } = createStubR2Client();

    const result = await publishAllBoards(
      database, client, 'test-bucket', createGauntletStubDeps(),
      BUDGETED_GAUNTLET_CATALOG,
    );

    assert.equal(result.manifestWritten, true);

    const putKeys = putCalls.map((put) => put.key);
    assert.ok(putKeys.includes('legends/v1/gauntlet-core-mm-full.json'));
    assert.ok(putKeys.includes('legends/v1/gauntlet-core-mm-full-fixed.json'));
    assert.equal(
      putKeys.includes('legends/v1/gauntlet-core-mm-empty-fixed.json'),
      false,
      'A zero-entry fixed board must not get a file (the D-24131 §7 lazy rule).',
    );

    // The manifest lists BOTH divisions' files, sorted ASC, manifest last.
    const lastPut = putCalls[putCalls.length - 1];
    assert.ok(lastPut !== undefined);
    assert.equal(lastPut.key, 'legends/v1/manifest.json');
    const manifest = JSON.parse(lastPut.body);
    assert.deepEqual(manifest.gauntletBoards, [
      'gauntlet-core-mm-full',
      'gauntlet-core-mm-full-fixed',
    ]);

    // The index carries per-count fixed claim state for EVERY gauntlet.
    const indexPut = putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(indexPut !== undefined);
    const index = JSON.parse(indexPut.body);
    const fullEntry = index.gauntlets.find(
      (entry: { board: string }) => entry.board === 'gauntlet-core-mm-full',
    );
    const emptyEntry = index.gauntlets.find(
      (entry: { board: string }) => entry.board === 'gauntlet-core-mm-empty',
    );
    assert.deepEqual(fullEntry.fixedEntryCounts, {
      '1': 1,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });
    assert.deepEqual(emptyEntry.fixedEntryCounts, {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });
    // The open-division counts are unchanged by the fixed emission.
    assert.deepEqual(fullEntry.entryCounts, {
      '1': 1,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });

    // The fixed board file carries the heroPool-bearing entry shape.
    const fixedBoardPut = putCalls.find((put) =>
      put.key.includes('gauntlet-core-mm-full-fixed.json'),
    );
    assert.ok(fixedBoardPut !== undefined);
    const fixedBoard = JSON.parse(fixedBoardPut.body);
    assert.equal(fixedBoard.board, 'gauntlet-core-mm-full-fixed');
    assert.equal(fixedBoard.rowCount, 1);
    assert.deepEqual(fixedBoard.entries, [
      {
        handle: 'Alice',
        rank: 1,
        totalScore: -3,
        legCount: 1,
        averageScoreCentis: -300,
        players: ['Alice'],
        heroPool: ['core/hero-a', 'core/hero-b', 'core/hero-c'],
      },
    ]);
  });

  test('teamless rows on a budgeted catalog emit no fixed board (NULL team_key never qualifies)', async () => {
    const database = createGauntletStubDatabase();
    const { client, putCalls } = createStubR2Client();

    const result = await publishAllBoards(
      database, client, 'test-bucket', createGauntletStubDeps(),
      BUDGETED_GAUNTLET_CATALOG,
    );

    assert.equal(result.manifestWritten, true);
    const putKeys = putCalls.map((put) => put.key);
    assert.ok(putKeys.includes('legends/v1/gauntlet-core-mm-full.json'));
    assert.equal(
      putKeys.some((key) => key.includes('-fixed')),
      false,
      'Without team identities no fixed file may be written.',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-472 — per-scheme approved loadouts on the index legs (D-24283)
// ---------------------------------------------------------------------------

// why: a gauntlet whose scheme-a leg carries a per-scheme override and whose
// definition still carries the per-mastermind menu (the dual-write source).
const PER_LEG_GAUNTLET: GauntletDefinition = {
  setAbbr: 'core',
  setName: 'Core Set',
  mastermindSlug: 'mm-full',
  mastermindName: 'Full Mastermind',
  legs: [
    {
      schemeSlug: 'scheme-a',
      schemeName: 'Scheme A',
      approvedLoadouts: {
        1: [
          {
            villainSegment: 'skrulls',
            henchmanKey: 'core/hand-ninjas',
            villainGroupIds: ['core/skrulls'],
            henchmanGroupIds: ['core/hand-ninjas'],
          },
        ],
      },
    },
  ],
  approvedLoadouts: {
    1: [
      {
        villainSegment: 'brotherhood',
        henchmanKey: 'core/doombot-legion',
        villainGroupIds: ['core/brotherhood'],
        henchmanGroupIds: ['core/doombot-legion'],
      },
    ],
  },
};

describe('legends publisher per-scheme approved loadouts (WP-472 / D-24283)', () => {
  beforeEach(() => {
    resetArchiveTracking();
  });

  test('index legs carry the per-scheme loadout (ids only) and the entry-level field is dual-written per mastermind', async () => {
    const { client, putCalls } = createStubR2Client();
    await publishAllBoards(
      createGauntletStubDatabase(), client, 'test-bucket',
      createGauntletStubDeps(), [PER_LEG_GAUNTLET],
    );

    const indexPut = putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(indexPut !== undefined);
    const index = JSON.parse(indexPut.body);
    const entry = index.gauntlets.find(
      (gauntlet: { board: string }) => gauntlet.board === 'gauntlet-core-mm-full',
    );
    assert.ok(entry !== undefined);

    // Per-leg (per-scheme) loadout — only the ids travel, keyed by count string.
    assert.deepEqual(entry.legs, [
      {
        schemeSlug: 'scheme-a',
        schemeName: 'Scheme A',
        approvedLoadouts: {
          '1': [
            {
              villainGroupIds: ['core/skrulls'],
              henchmanGroupIds: ['core/hand-ninjas'],
            },
          ],
        },
      },
    ]);

    // Entry-level dual-write (RS-1) — the per-mastermind menu, unchanged.
    assert.deepEqual(entry.approvedLoadouts, {
      '1': [
        {
          villainGroupIds: ['core/brotherhood'],
          henchmanGroupIds: ['core/doombot-legion'],
        },
      ],
    });
  });

  test('a leg with no per-scheme loadout publishes byte-identically (pre-WP-472 leg shape)', async () => {
    const { client, putCalls } = createStubR2Client();
    // GAUNTLET_WITH_ENTRIES carries neither a per-leg nor an entry-level loadout.
    await publishAllBoards(
      createGauntletStubDatabase(), client, 'test-bucket',
      createGauntletStubDeps(), [GAUNTLET_WITH_ENTRIES],
    );

    const indexPut = putCalls.find((put) =>
      put.key.includes('gauntlet-index.json'),
    );
    assert.ok(indexPut !== undefined);
    const index = JSON.parse(indexPut.body);
    const entry = index.gauntlets.find(
      (gauntlet: { board: string }) => gauntlet.board === 'gauntlet-core-mm-full',
    );
    assert.deepEqual(entry.legs, [
      { schemeSlug: 'scheme-a', schemeName: 'Scheme A' },
    ]);
    // No requirement anywhere → the field is omitted (undefined survives no JSON).
    assert.equal('approvedLoadouts' in entry, false);
  });
});
