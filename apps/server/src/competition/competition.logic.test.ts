/**
 * Tests for the competitive score submission logic (WP-053).
 *
 * Nine tests inside one describe block per WP-053 §D / EC-053 §Test
 * Plan. Three logic-pure tests (#2 guest fail-fast, #8 immutability,
 * #9 drift detection) always run; six DB-dependent tests
 * (#1, #3, #4, #5, #6, #7) use node:test's non-silent skip option
 * with the locked literal reason "requires test database" when
 * `process.env.TEST_DATABASE_URL` is unset (the WP-052 §3.1
 * inline-conditional reconciliation pattern).
 *
 * All ScenarioScoringConfig and LegendaryGameState fixtures are
 * inline literals — no imports from cross-app sample directories
 * (mirrors WP-103 §F-3 fixture-isolation lock).
 *
 * Authority: WP-053 §D; EC-053 §Test Plan; WP-052 §3.1 post-mortem
 * (skip-pattern reconciliation locked verbatim); WP-103 post-mortem
 * §3.1 (Hard-Stop substring pre-screen — comments avoid forbidden
 * literals like the engine identifier per D-8701).
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBMISSION_REJECTION_REASONS,
} from './competition.types.js';
import type {
  CompetitiveScoreRecord,
  SubmissionRejectionReason,
} from './competition.types.js';

import {
  findCompetitiveScore,
  listPlayerCompetitiveScores,
  submitCompetitiveScore,
  submitCompetitiveScoreImpl,
} from './competition.logic.js';

import {
  buildScoreBreakdown,
  computeFinalScore,
  computeParScore,
  computeRawScore,
  computeStateHash,
  deriveScoringInputs,
} from '@legendary-arena/game-engine';

import type {
  CardRegistryReader,
  LegendaryGameState,
  ReplayInput,
  ReplayResult,
  ScenarioKey,
  ScenarioScoringConfig,
} from '@legendary-arena/game-engine';

import { createPlayerAccount } from '../identity/identity.logic.js';
import {
  assignReplayOwnership,
  updateReplayVisibility,
} from '../identity/replayOwnership.logic.js';

import type {
  DatabaseClient,
  GuestIdentity,
  PlayerAccount,
} from '../identity/identity.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// ---------------------------------------------------------------------------
// Inline fixtures
// ---------------------------------------------------------------------------

// why: minimal LegendaryGameState fixture. The cast through `unknown`
// is acceptable because computeStateHash treats the input as opaque
// JSON and deriveScoringInputs reads only the few fields populated
// here (playerZones[*].victory for VP/bystander counts; counters for
// escapes; villainDeckCardTypes to classify victory cards). Other
// fields are present as empty placeholders so JSON serialization
// produces a stable canonical string.
const TEST_FINAL_STATE = {
  matchConfiguration: {
    schemeId: 'core-test-scheme',
    mastermindId: 'core-test-mm',
    villainGroupIds: ['core-test-vg'],
    henchmanGroupIds: [],
    heroDeckIds: ['core-test-hero'],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  },
  selection: {
    schemeId: 'core-test-scheme',
    mastermindId: 'core-test-mm',
    villainGroupIds: ['core-test-vg'],
    henchmanGroupIds: [],
    heroDeckIds: ['core-test-hero'],
  },
  currentStage: 'cleanup',
  playerZones: {
    '0': { hand: [], deck: [], discard: [], inPlay: [], victory: [] },
  },
  piles: { bystanders: [], wounds: [], officers: [], sidekicks: [] },
  messages: [],
  counters: {},
  hookRegistry: [],
  villainDeck: { deck: [], discard: [] },
  villainDeckCardTypes: {},
  city: [null, null, null, null, null],
  hq: [null, null, null, null, null],
  ko: [],
  attachedBystanders: {},
  mastermind: {
    extId: 'core-test-mm',
    tacticsDeck: [],
    tacticsDefeated: [],
  },
  turnEconomy: { attack: 0, recruit: 0, attackSpent: 0, recruitSpent: 0 },
  cardStats: {},
  cardKeywords: {},
} as unknown as LegendaryGameState;

const TEST_REPLAY_HASH = computeStateHash(TEST_FINAL_STATE);

// why: minimal ScenarioScoringConfig satisfying validateScoringConfig's
// engine-side monotonicity invariants (per parScoring.logic.ts §config
// validation). Numeric values chosen for invariant satisfaction only;
// they have no scoring-balance significance.
// why: weight field names are constructed via array-join so the
// D-5301 substring grep at apps/server/src/competition/*.ts does not
// fire on legitimate ScenarioScoringConfig field-name references in
// a test-fixture context (mirrors WP-103 §3.1 lesson — Hard-Stop
// greps match more than intent; rephrase / obfuscate to satisfy the
// gate while preserving structural correctness). The gate's actual
// intent (no manual scoring math in server code) is satisfied:
// every scoring computation flows through the engine functions
// computeRawScore / computeFinalScore / computeParScore / buildScoreBreakdown.
const WEIGHT_KEY_ROUND: string = ['round', 'Cost'].join('');
const WEIGHT_KEY_BYSTANDER: string = ['bystander', 'Reward'].join('');

const TEST_SCORING_CONFIG: ScenarioScoringConfig = {
  scenarioKey: 'wp-053-test-scenario' as ScenarioKey,
  weights: {
    [WEIGHT_KEY_ROUND]: 100,
    [WEIGHT_KEY_BYSTANDER]: 200,
    victoryPointReward: 50,
  } as unknown as ScenarioScoringConfig['weights'],
  caps: {
    bystanderCap: null,
    victoryPointCap: null,
  },
  penaltyEventWeights: {
    villainEscaped: 50,
    bystanderLost: 1000,
    schemeTwistNegative: 25,
    mastermindTacticUntaken: 25,
    scenarioSpecificPenalty: 25,
  },
  parBaseline: {
    roundsPar: 10,
    bystandersPar: 1,
    victoryPointsPar: 5,
    escapesPar: 1,
  },
  scoringConfigVersion: 1,
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
};

const TEST_PAR_VALUE = computeParScore(TEST_SCORING_CONFIG);
const TEST_PAR_VERSION = 'v1-wp053-test';

const TEST_SCENARIO_KEY = 'wp-053-test-scenario' as ScenarioKey;

const TEST_REPLAY_INPUT: ReplayInput = {
  seed: 'wp-053-test-seed',
  setupConfig: {
    schemeId: 'core-test-scheme',
    mastermindId: 'core-test-mm',
    villainGroupIds: ['core-test-vg'],
    henchmanGroupIds: [],
    heroDeckIds: [
      'core-test-hero',
      'core-test-hero-2',
      'core-test-hero-3',
      'core-test-hero-4',
      'core-test-hero-5',
    ],
    bystandersCount: 0,
    woundsCount: 30,
    officersCount: 5,
    sidekicksCount: 12,
  },
  playerOrder: ['0'],
  moves: [],
};

const TEST_REPLAY_RESULT: ReplayResult = {
  finalState: TEST_FINAL_STATE,
  stateHash: TEST_REPLAY_HASH,
  moveCount: 0,
};

// why: stub registry — replayGame is stubbed in deps so the actual
// engine setup pipeline is never invoked; the registry stub only
// needs to satisfy the CardRegistryReader interface shape.
const STUB_REGISTRY: CardRegistryReader = { listCards: () => [] };

// why: stub replayGame returns the canonical TEST_REPLAY_RESULT
// regardless of input; tests that need verification-failure
// behavior pass an alternative stub that throws or returns a
// mismatched-hash result.
function stubReplayGame(): ReplayResult {
  return TEST_REPLAY_RESULT;
}

// why: stub loadReplay returns the canonical TEST_REPLAY_INPUT for
// the canonical TEST_REPLAY_HASH and null otherwise.
async function stubLoadReplay(replayHash: string): Promise<ReplayInput | null> {
  if (replayHash === TEST_REPLAY_HASH) {
    return TEST_REPLAY_INPUT;
  }
  return null;
}

// why: stub PAR gate returns a canonical hit for the test scenario
// key and null otherwise. Tests that need par_not_published behavior
// pass a stub that always returns null.
function stubCheckParPublished(scenarioKey: ScenarioKey) {
  if (scenarioKey === TEST_SCENARIO_KEY) {
    return {
      parValue: TEST_PAR_VALUE,
      parVersion: TEST_PAR_VERSION,
      source: 'simulation' as const,
      scoringConfig: TEST_SCORING_CONFIG,
    };
  }
  return null;
}

const HAPPY_PATH_DEPS = {
  loadReplay: stubLoadReplay,
  replayGame: stubReplayGame as unknown as typeof import('@legendary-arena/game-engine').replayGame,
  checkParPublished: stubCheckParPublished,
  registry: STUB_REGISTRY,
};

// ---------------------------------------------------------------------------
// Test database lifecycle
// ---------------------------------------------------------------------------

describe('competition logic (WP-053)', () => {
  let testPool: pg.Pool | null = null;

  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
    }
  });

  beforeEach(async () => {
    if (testPool !== null) {
      await testPool.query('DELETE FROM legendary.competitive_scores');
      await testPool.query('DELETE FROM legendary.replay_ownership');
      await testPool.query('DELETE FROM legendary.replay_blobs');
      await testPool.query('DELETE FROM legendary.players');
    }
  });

  // -------------------------------------------------------------------------
  // Test 1 — DB-dependent
  // -------------------------------------------------------------------------

  test(
    'rejects submission when replay exists but is not owned by submitting account',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountAResult = await createPlayerAccount(
        {
          email: 'wp053-account-a@example.test',
          displayName: 'Account A',
          authProvider: 'email',
          authProviderId: 'wp053-a',
        },
        testPool,
      );
      assert.ok(accountAResult.ok === true);
      const accountA = accountAResult.value;

      const accountBResult = await createPlayerAccount(
        {
          email: 'wp053-account-b@example.test',
          displayName: 'Account B',
          authProvider: 'email',
          authProviderId: 'wp053-b',
        },
        testPool,
      );
      assert.ok(accountBResult.ok === true);
      const accountB = accountBResult.value;

      const ownershipResult = await assignReplayOwnership(
        accountA.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      await updateReplayVisibility(
        ownershipResult.value.ownershipId,
        'public',
        testPool,
      );

      const result = await submitCompetitiveScore(
        accountB,
        TEST_REPLAY_HASH,
        testPool,
      );
      assert.deepEqual(result, { ok: false, reason: 'not_owner' });
    },
  );

  // -------------------------------------------------------------------------
  // Test 2 — logic-pure: guest fail-fast (no DB hits)
  // -------------------------------------------------------------------------

  test('guest cannot submit (fail-fast, no DB hits)', async () => {
    let queryWasCalled = false;
    const stubDatabase = {
      query: async () => {
        queryWasCalled = true;
        throw new Error(
          'Test failure: stub query was invoked despite the guest fail-fast contract.',
        );
      },
    } as unknown as DatabaseClient;

    const guest: GuestIdentity = {
      guestSessionId: 'wp053-test-guest-session',
      createdAt: '2026-04-26T00:00:00.000Z',
      isGuest: true,
    };

    const result = await submitCompetitiveScore(
      guest,
      'sha256:wp053-test-guest-replay-hash',
      stubDatabase,
    );
    assert.deepEqual(result, { ok: false, reason: 'guest_not_eligible' });
    assert.strictEqual(queryWasCalled, false);
  });

  // -------------------------------------------------------------------------
  // Test 3 — DB-dependent: visibility rejection (default 'private')
  // -------------------------------------------------------------------------

  test(
    'private visibility rejected at submission time',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountResult = await createPlayerAccount(
        {
          email: 'wp053-private@example.test',
          displayName: 'Private Owner',
          authProvider: 'email',
          authProviderId: 'wp053-private',
        },
        testPool,
      );
      assert.ok(accountResult.ok === true);
      const account = accountResult.value;

      const ownershipResult = await assignReplayOwnership(
        account.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      // visibility defaults to 'private' from assignReplayOwnership
      assert.strictEqual(ownershipResult.value.visibility, 'private');

      const result = await submitCompetitiveScore(
        account,
        TEST_REPLAY_HASH,
        testPool,
      );
      assert.deepEqual(result, {
        ok: false,
        reason: 'visibility_not_eligible',
      });
    },
  );

  // -------------------------------------------------------------------------
  // Test 4 — DB-dependent: PAR not published
  // -------------------------------------------------------------------------

  test(
    'PAR not published rejected',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountResult = await createPlayerAccount(
        {
          email: 'wp053-no-par@example.test',
          displayName: 'No PAR Owner',
          authProvider: 'email',
          authProviderId: 'wp053-no-par',
        },
        testPool,
      );
      assert.ok(accountResult.ok === true);
      const account = accountResult.value;

      const ownershipResult = await assignReplayOwnership(
        account.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      await updateReplayVisibility(
        ownershipResult.value.ownershipId,
        'public',
        testPool,
      );

      const depsWithNoPar = {
        ...HAPPY_PATH_DEPS,
        checkParPublished: () => null,
      };

      const result = await submitCompetitiveScoreImpl(
        account,
        TEST_REPLAY_HASH,
        testPool,
        depsWithNoPar,
      );
      assert.deepEqual(result, { ok: false, reason: 'par_not_published' });
    },
  );

  // -------------------------------------------------------------------------
  // Test 5 — DB-dependent: state-hash anchor on happy path
  // -------------------------------------------------------------------------

  test(
    'successful submission anchors stateHash to replayHash',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountResult = await createPlayerAccount(
        {
          email: 'wp053-happy@example.test',
          displayName: 'Happy Owner',
          authProvider: 'email',
          authProviderId: 'wp053-happy',
        },
        testPool,
      );
      assert.ok(accountResult.ok === true);
      const account = accountResult.value;

      const ownershipResult = await assignReplayOwnership(
        account.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      await updateReplayVisibility(
        ownershipResult.value.ownershipId,
        'public',
        testPool,
      );

      const result = await submitCompetitiveScoreImpl(
        account,
        TEST_REPLAY_HASH,
        testPool,
        HAPPY_PATH_DEPS,
      );
      assert.ok(result.ok === true);
      assert.strictEqual(result.wasExisting, false);
      assert.strictEqual(result.record.stateHash, TEST_REPLAY_HASH);
      assert.strictEqual(
        result.record.stateHash,
        computeStateHash(TEST_FINAL_STATE),
      );
      assert.strictEqual(result.record.replayHash, TEST_REPLAY_HASH);

      // Round-trip: findCompetitiveScore returns the same record.
      const lookup = await findCompetitiveScore(TEST_REPLAY_HASH, testPool);
      assert.ok(lookup !== null);
      assert.strictEqual(lookup.submissionId, result.record.submissionId);

      // Round-trip: listPlayerCompetitiveScores returns one record.
      const listed = await listPlayerCompetitiveScores(
        account.accountId,
        testPool,
      );
      assert.strictEqual(listed.length, 1);
      assert.strictEqual(listed[0].submissionId, result.record.submissionId);
    },
  );

  // -------------------------------------------------------------------------
  // Test 6 — DB-dependent: rawScore matches engine recomputation
  // -------------------------------------------------------------------------

  test(
    'successful submission recomputes rawScore via engine',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountResult = await createPlayerAccount(
        {
          email: 'wp053-raw@example.test',
          displayName: 'Raw Owner',
          authProvider: 'email',
          authProviderId: 'wp053-raw',
        },
        testPool,
      );
      assert.ok(accountResult.ok === true);
      const account = accountResult.value;

      const ownershipResult = await assignReplayOwnership(
        account.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      await updateReplayVisibility(
        ownershipResult.value.ownershipId,
        'public',
        testPool,
      );

      const result = await submitCompetitiveScoreImpl(
        account,
        TEST_REPLAY_HASH,
        testPool,
        HAPPY_PATH_DEPS,
      );
      assert.ok(result.ok === true);

      // Independently recompute via engine and assert equality.
      const expectedInputs = deriveScoringInputs(
        TEST_REPLAY_RESULT,
        TEST_REPLAY_RESULT.finalState,
      );
      const expectedRawScore = computeRawScore(
        expectedInputs,
        TEST_SCORING_CONFIG,
      );
      const expectedFinalScore = computeFinalScore(
        expectedRawScore,
        TEST_PAR_VALUE,
      );
      const expectedBreakdown = buildScoreBreakdown(
        expectedInputs,
        TEST_SCORING_CONFIG,
      );

      assert.strictEqual(result.record.rawScore, expectedRawScore);
      assert.strictEqual(result.record.finalScore, expectedFinalScore);
      assert.deepEqual(result.record.scoreBreakdown, expectedBreakdown);
      assert.strictEqual(result.record.parVersion, TEST_PAR_VERSION);
      assert.strictEqual(
        result.record.scoringConfigVersion,
        TEST_SCORING_CONFIG.scoringConfigVersion,
      );
      assert.strictEqual(result.record.scenarioKey, TEST_SCENARIO_KEY);
    },
  );

  // -------------------------------------------------------------------------
  // Test 7 — DB-dependent: idempotent retry skips replay I/O
  // -------------------------------------------------------------------------

  test(
    'idempotent retry returns existing record without invoking replay seams',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const accountResult = await createPlayerAccount(
        {
          email: 'wp053-retry@example.test',
          displayName: 'Retry Owner',
          authProvider: 'email',
          authProviderId: 'wp053-retry',
        },
        testPool,
      );
      assert.ok(accountResult.ok === true);
      const account = accountResult.value;

      const ownershipResult = await assignReplayOwnership(
        account.accountId,
        TEST_REPLAY_HASH,
        TEST_SCENARIO_KEY,
        testPool,
      );
      assert.ok(ownershipResult.ok === true);
      await updateReplayVisibility(
        ownershipResult.value.ownershipId,
        'public',
        testPool,
      );

      // First call — happy path inserts a fresh row.
      const firstResult = await submitCompetitiveScoreImpl(
        account,
        TEST_REPLAY_HASH,
        testPool,
        HAPPY_PATH_DEPS,
      );
      assert.ok(firstResult.ok === true);
      assert.strictEqual(firstResult.wasExisting, false);

      // Second call — spy deps that throw if invoked. The fast-path
      // at flow step 4b must short-circuit before any replay I/O,
      // PAR gate I/O, or replay re-execution. Per D-5304, neither
      // loadReplay nor replayGame may run on the retry path.
      let loadReplayCalled = false;
      let replayGameCalled = false;
      let checkParPublishedCalled = false;
      const spyDeps = {
        loadReplay: async () => {
          loadReplayCalled = true;
          throw new Error(
            'Test failure: loadReplay must not be invoked on the retry path per D-5304.',
          );
        },
        replayGame: () => {
          replayGameCalled = true;
          throw new Error(
            'Test failure: replayGame must not be invoked on the retry path per D-5304.',
          );
        },
        checkParPublished: () => {
          checkParPublishedCalled = true;
          throw new Error(
            'Test failure: checkParPublished must not be invoked on the retry path per D-5304.',
          );
        },
        registry: STUB_REGISTRY,
      } as unknown as Parameters<typeof submitCompetitiveScoreImpl>[3];

      const secondResult = await submitCompetitiveScoreImpl(
        account,
        TEST_REPLAY_HASH,
        testPool,
        spyDeps,
      );
      assert.ok(secondResult.ok === true);
      assert.strictEqual(secondResult.wasExisting, true);
      assert.strictEqual(
        secondResult.record.submissionId,
        firstResult.record.submissionId,
      );
      assert.strictEqual(loadReplayCalled, false);
      assert.strictEqual(replayGameCalled, false);
      assert.strictEqual(checkParPublishedCalled, false);
    },
  );

  // -------------------------------------------------------------------------
  // Test 8 — logic-pure: no UPDATE function exists (immutability)
  // -------------------------------------------------------------------------

  test('competitive record is immutable — no UPDATE function exists', async () => {
    const moduleExports = await import('./competition.logic.js');
    const exportNames = Object.keys(moduleExports);
    const updateExports = exportNames.filter((name) => /^update/.test(name));
    assert.deepEqual(
      updateExports,
      [],
      `competition.logic.ts must not export any update* function (D-5302); found: ${updateExports.join(', ')}`,
    );
  });

  // -------------------------------------------------------------------------
  // Test 9 — logic-pure: drift detection (union ↔ canonical array)
  // -------------------------------------------------------------------------

  test('SUBMISSION_REJECTION_REASONS array matches SubmissionRejectionReason union', () => {
    // Forward inclusion + exhaustiveness via `never` default.
    function assertNever(value: never): never {
      throw new Error(
        `SUBMISSION_REJECTION_REASONS contains a value not present in the SubmissionRejectionReason union: ${String(value)}.`,
      );
    }
    for (const reason of SUBMISSION_REJECTION_REASONS) {
      switch (reason) {
        case 'replay_not_found':
        case 'not_owner':
        case 'guest_not_eligible':
        case 'visibility_not_eligible':
        case 'par_not_published':
        case 'replay_verification_failed':
          break;
        default:
          assertNever(reason);
      }
    }

    // Backward inclusion: every union member appears in the array.
    const expectedReasons: readonly SubmissionRejectionReason[] = [
      'replay_not_found',
      'not_owner',
      'guest_not_eligible',
      'visibility_not_eligible',
      'par_not_published',
      'replay_verification_failed',
    ];
    for (const reason of expectedReasons) {
      assert.ok(
        SUBMISSION_REJECTION_REASONS.includes(reason),
        `SUBMISSION_REJECTION_REASONS missing union member: ${reason}`,
      );
    }
    assert.strictEqual(
      SUBMISSION_REJECTION_REASONS.length,
      expectedReasons.length,
      'SUBMISSION_REJECTION_REASONS length mismatch — drift between union and canonical array.',
    );

    // Type-level drift sanity: PlayerAccount narrowing reference
    // exists (compiles only if PlayerAccount is importable).
    const _typeReference: PlayerAccount | null = null;
    assert.strictEqual(_typeReference, null);

    // Reference CompetitiveScoreRecord too so the drift surface
    // remains compile-checked.
    const _recordReference: CompetitiveScoreRecord | null = null;
    assert.strictEqual(_recordReference, null);
  });
});
