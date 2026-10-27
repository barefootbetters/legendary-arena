/**
 * Tests for the live-match capture step (WP-335).
 *
 * Logic-pure tests always run (the D-24597 set-qualified key against the
 * committed seed PAR index). The end-to-end capture test
 * is DB-gated (non-silent skip without `TEST_DATABASE_URL`): it seeds a real
 * finished match (a `bgio.matches` row whose `initial_state`/`log` are produced by
 * the WP-334 manufacture pattern), two authenticated seats, then runs `captureMatch`
 * and asserts the durable artifact + the `replayHash → matchId` mapping + the
 * scenarioKey + ownership per seat + the `captured_at` stamp, and idempotency.
 *
 * Authority: WP-335 §F; EC-365.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import {
  buildScenarioKey,
  computeStateHash,
  ENDGAME_CONDITIONS,
  evaluateEndgame,
  LegendaryGame,
} from '@legendary-arena/game-engine';

import {
  captureMatch,
  deriveCaptureScenarioKey,
  fillMissingArtifactGameovers,
  serializeStoredGameover,
  ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE,
} from './matchCapture.logic.js';
// @ts-ignore — importing .mjs from .ts; tsx resolves this at runtime.
import { checkParPublished } from '../par/parGate.mjs';
// @ts-ignore — loadParIndex lives behind the Setup-Tooling Surface (WP-144 / D-14401).
import { loadParIndex } from '@legendary-arena/game-engine/setup';
import { reduceMatchToFinalState } from './matchReplay.logic.js';
import type { DatabaseClient } from '../identity/identity.types.js';

import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): {
    G: unknown;
  };
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; deltalog?: unknown[] };
};

const MOCK_SETUP_DATA = {
  schemeId: 'test/test-scheme-001',
  mastermindId: 'test/test-mastermind-001',
  villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
  henchmanGroupIds: ['test/test-henchman-group-001'],
  heroDeckIds: [
    'test/test-hero-deck-001',
    'test/test-hero-deck-002',
    'test/test-hero-deck-003',
  ],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

const MATCH_ID = 'wp335-test-match';
const EXT_ID_0 = 'wp335-test-account-0';
const EXT_ID_1 = 'wp335-test-account-1';

/** Manufacture a real match's { initialState, log } (lobby → play). */
function manufactureArtifact(): { initialState: unknown; log: unknown[] } {
  const initialState = InitializeGame({
    game: LegendaryGame,
    numPlayers: 2,
    setupData: MOCK_SETUP_DATA,
  });
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const log: unknown[] = [];
  const dispatch = (
    state: { deltalog?: unknown[] },
    moveName: string,
    args: unknown[],
    playerID: string,
  ) => {
    const next = reducer(state, {
      type: 'MAKE_MOVE',
      payload: { type: moveName, args, playerID },
    });
    if (Array.isArray(next.deltalog)) {
      log.push(...next.deltalog);
    }
    return next;
  };
  let state: { G: unknown; deltalog?: unknown[] } = initialState;
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '0');
  state = dispatch(state, 'setPlayerReady', [{ ready: true }], '1');
  state = dispatch(state, 'startMatchIfReady', [], '0');
  return { initialState, log };
}

// why: the committed PAR store, resolved from this file (the test runner's cwd is
// the package, not the repo root).
const PAR_BASE_PATH = fileURLToPath(new URL('../../../../data/par', import.meta.url));

const CORE_VILLAINS = [
  'core/masters-of-evil',
  'core/brotherhood',
  'core/enemies-of-asgard',
  'core/hydra',
];

describe('capture scenarioKey is set-qualified against published PAR (D-24597)', () => {
  test('a core scheme leg still resolves the published seed PAR', async () => {
    const seedIndex = await loadParIndex(PAR_BASE_PATH, 'v1', 'seed');
    assert.notEqual(seedIndex, null);
    const scenarioKey = deriveCaptureScenarioKey({
      schemeId: 'core/portals-to-the-dark-dimension',
      mastermindId: 'core/red-skull',
      villainGroupIds: CORE_VILLAINS,
    });
    assert.equal(
      scenarioKey,
      'portals-to-the-dark-dimension::red-skull::brotherhood+enemies-of-asgard+hydra+masters-of-evil',
    );
    assert.notEqual(checkParPublished(null, seedIndex, scenarioKey), null);
  });

  // why: every reprint scheme/mastermind whose bare slug equals a core one. Each is
  // otherwise the identical core leg, so a set-blind key lands on core's PAR row.
  const reprints: ReadonlyArray<{ label: string; schemeId: string; mastermindId: string }> = [
    { label: 'co2e Portals', schemeId: 'co2e/portals-to-the-dark-dimension', mastermindId: 'core/red-skull' },
    { label: 'co2e Civil War', schemeId: 'co2e/super-hero-civil-war', mastermindId: 'core/red-skull' },
    { label: 'co2e Cosmic Cube', schemeId: 'co2e/unleash-the-power-of-the-cosmic-cube', mastermindId: 'core/red-skull' },
    { label: 'co2e Secret Invasion', schemeId: 'co2e/secret-invasion-of-the-skrull-shapeshifters', mastermindId: 'core/red-skull' },
    { label: 'co2e Killbots', schemeId: 'co2e/replace-earths-leaders-with-killbots', mastermindId: 'core/red-skull' },
    { label: 'msp1 Civil War', schemeId: 'msp1/super-hero-civil-war', mastermindId: 'core/red-skull' },
    { label: 'msp1 Cosmic Cube', schemeId: 'msp1/unleash-the-power-of-the-cosmic-cube', mastermindId: 'core/red-skull' },
    { label: 'co2e Red Skull (core scheme)', schemeId: 'core/portals-to-the-dark-dimension', mastermindId: 'co2e/red-skull' },
  ];
  for (const reprint of reprints) {
    test(`${reprint.label} reports no PAR instead of core's`, async () => {
      const seedIndex = await loadParIndex(PAR_BASE_PATH, 'v1', 'seed');
      const scenarioKey = deriveCaptureScenarioKey({
        schemeId: reprint.schemeId,
        mastermindId: reprint.mastermindId,
        villainGroupIds: CORE_VILLAINS,
      });
      assert.equal(
        checkParPublished(null, seedIndex, scenarioKey),
        null,
        `${reprint.label} derived "${scenarioKey}", which resolves a published core PAR row.`,
      );
    });
  }
});

describe('captureMatch (WP-335)', () => {
  let pool: InstanceType<typeof Pool> | undefined;
  let artifact: { initialState: unknown; log: unknown[] };
  let expectedHash: string;
  let expectedScenarioKey: string;

  before(async () => {
    artifact = manufactureArtifact();
    const reduced = reduceMatchToFinalState(artifact);
    expectedHash = reduced.stateHash;
    // why: independent recompute of the expected scenarioKey from the mock setup —
    // the capture step must derive the same via buildScenarioKeyFromExtIds.
    // D-24597: the `test/` set is not core, so its ids stay set-qualified.
    expectedScenarioKey = buildScenarioKey(
      'test/test-scheme-001',
      'test/test-mastermind-001',
      ['test/test-villain-group-001', 'test/test-villain-group-002'],
    );
    void computeStateHash; // referenced for parity with the mechanism's hashing

    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    // Seed two authenticated accounts + seats, and the finished bgio match.
    for (const extId of [EXT_ID_0, EXT_ID_1]) {
      await pool.query(
        'INSERT INTO legendary.players (ext_id, email, display_name, auth_provider, auth_provider_id) ' +
          'VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ext_id) DO NOTHING',
        [extId, `${extId}@wp335.test`, `WP335 ${extId}`, 'email', `${extId}-sub`],
      );
    }
    await pool.query('DELETE FROM legendary.match_seat_accounts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.replay_ownership WHERE replay_hash = $1', [expectedHash]);
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    await pool.query(
      'INSERT INTO legendary.match_seat_accounts (match_id, player_id, account_id) VALUES ($1,$2,$3),($1,$4,$5)',
      [MATCH_ID, '0', EXT_ID_0, '1', EXT_ID_1],
    );
    await pool.query(
      "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
        "VALUES ($1, '{}'::jsonb, $2::jsonb, '{\"gameover\":{\"winner\":\"0\"}}'::jsonb, $3::jsonb)",
      [MATCH_ID, JSON.stringify(artifact.initialState), JSON.stringify(artifact.log)],
    );
  });

  after(async () => {
    if (pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM legendary.match_seat_accounts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.replay_ownership WHERE replay_hash = $1', [expectedHash]);
    await pool.query('DELETE FROM bgio.replay_artifacts WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    await pool.query('DELETE FROM legendary.players WHERE ext_id = ANY($1)', [[EXT_ID_0, EXT_ID_1]]);
    await pool.end();
  });

  test(
    'captures a finished match: artifact + mapping + scenarioKey + ownership + captured_at (idempotent)',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;

      const result = await captureMatch(MATCH_ID, database);
      assert.equal(result.skipped, null);
      assert.equal(result.replayHash, expectedHash);
      assert.equal(result.scenarioKey, expectedScenarioKey);
      assert.equal(result.seatsOwned, 2);

      // Durable artifact row: hash PK + match_id mapping + scenario_key + copy.
      const artifactRow = await pool!.query(
        'SELECT match_id, scenario_key FROM bgio.replay_artifacts WHERE replay_hash = $1',
        [expectedHash],
      );
      assert.equal(artifactRow.rows.length, 1);
      assert.equal(artifactRow.rows[0]!.match_id, MATCH_ID);
      assert.equal(artifactRow.rows[0]!.scenario_key, expectedScenarioKey);

      // D-24719: the live row's metadata.gameover is copied onto the artifact.
      const verdictRow = await pool!.query(
        'SELECT gameover FROM bgio.replay_artifacts WHERE replay_hash = $1',
        [expectedHash],
      );
      assert.deepEqual(verdictRow.rows[0]!.gameover, { winner: '0' });

      // Ownership per authenticated seat.
      const ownership = await pool!.query(
        'SELECT cs.replay_hash FROM legendary.replay_ownership cs ' +
          'JOIN legendary.players p ON cs.player_id = p.player_id ' +
          'WHERE cs.replay_hash = $1 AND p.ext_id = ANY($2)',
        [expectedHash, [EXT_ID_0, EXT_ID_1]],
      );
      assert.equal(ownership.rows.length, 2);

      // captured_at stamped.
      const stamp = await pool!.query(
        'SELECT captured_at FROM bgio.matches WHERE match_id = $1',
        [MATCH_ID],
      );
      assert.notEqual(stamp.rows[0]!.captured_at, null);

      // Idempotent re-run: no duplicate artifact / ownership.
      const rerun = await captureMatch(MATCH_ID, database);
      assert.equal(rerun.replayHash, expectedHash);
      const artifactCount = await pool!.query(
        'SELECT count(*)::int AS n FROM bgio.replay_artifacts WHERE match_id = $1',
        [MATCH_ID],
      );
      assert.equal(artifactCount.rows[0]!.n, 1);
    },
  );

  test(
    'skips a match with no persisted initial_state (not replayable)',
    { skip: hasTestDatabase ? false : 'requires test database' },
    async () => {
      const database = pool as unknown as DatabaseClient;
      await pool!.query(
        "INSERT INTO bgio.matches (match_id, state, initial_state, metadata, log) " +
          "VALUES ('wp335-null-init', '{}'::jsonb, NULL, '{\"gameover\":{}}'::jsonb, '[]'::jsonb) " +
          'ON CONFLICT (match_id) DO NOTHING',
      );
      const result = await captureMatch('wp335-null-init', database);
      assert.equal(result.skipped, 'not_replayable');
      assert.equal(result.replayHash, null);
      await pool!.query("DELETE FROM bgio.matches WHERE match_id = 'wp335-null-init'");
    },
  );
});

describe('serializeStoredGameover — the capture-time verdict copy (D-24719)', () => {
  test('serializes metadata.gameover as JSON', () => {
    assert.equal(
      serializeStoredGameover({ gameover: { outcome: 'heroes-win', reason: 'Mastermind defeated.' } }),
      '{"outcome":"heroes-win","reason":"Mastermind defeated."}',
    );
  });

  test('returns null when the metadata carries no verdict', () => {
    assert.equal(serializeStoredGameover({ players: {} }), null);
    assert.equal(serializeStoredGameover({ gameover: null }), null);
    assert.equal(serializeStoredGameover(null), null);
  });
});

describe('fillMissingArtifactGameovers — the legacy verdict sweep (D-24719)', () => {
  /** A stub pool: the sweep SELECT returns `rows`; every UPDATE is recorded. */
  function makeSweepPool(rows: unknown[], updateRowCount = 1) {
    const updates: unknown[][] = [];
    const updateTexts: string[] = [];
    const selects: { text: string; params: unknown[] }[] = [];
    const pool = {
      async query(text: string, params: unknown[]) {
        if (text.startsWith('SELECT')) {
          selects.push({ text, params });
          return { rows };
        }
        updateTexts.push(text);
        updates.push(params);
        return { rows: [], rowCount: updateRowCount };
      },
    };
    return { pool: pool as unknown as DatabaseClient, updates, updateTexts, selects };
  }

  /**
   * A manufactured artifact whose reduction ends DECISIVELY: the initial state's
   * scheme-loss counter is latched, so the top-level `endIf` (and
   * `evaluateEndgame` of the final `G`) is a scheme win, never `null`.
   */
  function decisiveArtifact() {
    const artifact = manufactureArtifact();
    const initialState = structuredClone(artifact.initialState) as {
      G: { counters: Record<string, number> };
    };
    initialState.G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
    const reduced = reduceMatchToFinalState({ initialState, log: artifact.log });
    return { initialState, log: artifact.log, reduced };
  }

  test('locked batch size', () => {
    assert.equal(ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE, 5);
  });

  test('selects only verdict-less artifacts, batch-limited', async () => {
    const sweep = makeSweepPool([]);
    assert.equal(await fillMissingArtifactGameovers(sweep.pool, 5), 0);
    assert.match(sweep.selects[0]!.text, /FROM bgio\.replay_artifacts/);
    assert.match(sweep.selects[0]!.text, /WHERE gameover IS NULL LIMIT \$1/);
    assert.deepEqual(sweep.selects[0]!.params, [5]);
    assert.equal(sweep.updates.length, 0);
  });

  test('stores the engine verdict of the reduced final state', async () => {
    const { initialState, log, reduced } = decisiveArtifact();
    const expected = evaluateEndgame(reduced.finalState);
    // why: precondition — a null verdict would make this test pass for a
    // mutant that always stores {}.
    assert.equal(expected?.outcome, 'scheme-wins');
    const sweep = makeSweepPool([
      { replay_hash: reduced.stateHash, initial_state: initialState, log },
    ]);
    assert.equal(await fillMissingArtifactGameovers(sweep.pool, 5), 1);
    assert.deepEqual(sweep.updates, [[reduced.stateHash, JSON.stringify(expected)]]);
    assert.match(
      sweep.updateTexts[0]!,
      /SET gameover = \$2 WHERE replay_hash = \$1 AND gameover IS NULL/,
    );
  });

  test('a re-execution that no longer reproduces the stored hash stores an unknown outcome', async () => {
    const { initialState, log } = decisiveArtifact();
    const sweep = makeSweepPool([
      { replay_hash: 'hash-from-an-older-engine', initial_state: initialState, log },
    ]);
    assert.equal(await fillMissingArtifactGameovers(sweep.pool, 5), 1);
    assert.deepEqual(sweep.updates, [['hash-from-an-older-engine', '{}']]);
  });

  test('counts only the rows the UPDATE actually filled', async () => {
    const { initialState, log, reduced } = decisiveArtifact();
    const sweep = makeSweepPool(
      [{ replay_hash: reduced.stateHash, initial_state: initialState, log }],
      0,
    );
    assert.equal(await fillMissingArtifactGameovers(sweep.pool, 5), 0);
  });

  test('an unreplayable artifact is stored as an unknown outcome, not retried', async () => {
    const artifact = manufactureArtifact();
    const sweep = makeSweepPool([
      { replay_hash: 'hash-bad', initial_state: artifact.initialState, log: [{ notAnAction: true }] },
    ]);
    assert.equal(await fillMissingArtifactGameovers(sweep.pool, 5), 1);
    assert.deepEqual(sweep.updates, [['hash-bad', '{}']]);
  });
});
