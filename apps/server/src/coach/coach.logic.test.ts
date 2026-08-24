/**
 * Tests for the endgame-coach orchestrator (WP-594 / EC-629).
 *
 * The DB-backed reads/writes are injected via the CoachLogic seam and the model
 * client via CoachDependencies, so every path is exercised with fakes: NO real
 * database, ZERO paid model calls. Covers the entitlement gate, ownership,
 * cache hit, fresh generation (model called once + cached), the not-found paths,
 * and the fail-soft model-failure path.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { generateOrGetCoachReport, type CoachLogic } from './coach.logic.js';
import type { AccountId } from '../identity/identity.types.js';
import type {
  CoachDependencies,
  CoachModelClient,
  CoachReport,
  StoredCoachReport,
} from './coach.types.js';
import type { LegendaryGameState, ScoreBreakdown } from '@legendary-arena/game-engine';

const ACCOUNT = 'acct-jeff' as AccountId;
const REPLAY = 'replay-abc';

const REPORT: CoachReport = {
  headline: 'Solid win, sharper buys next time.',
  heroFit: 'Spider-Man fit the tempo scheme well.',
  purchases: 'Too many low-cost cards late.',
  suggestions: ['Buy a 6+ cost hero by round 3', 'Prioritize KO over recruit vs Red Skull'],
};

function makeBreakdown(): ScoreBreakdown {
  return {
    inputs: {
      rounds: 12,
      victoryPoints: 40,
      bystandersRescued: 5,
      escapes: 1,
      penaltyEventCounts: {
        villainEscaped: 1,
        bystanderLost: 2,
        schemeTwistNegative: 6,
        mastermindTacticUntaken: 0,
        scenarioSpecificPenalty: 0,
      },
      perPlayer: [{ playerId: '0', victoryPoints: 40, bystandersRescued: 5 }],
      matchLost: false,
    },
    weightedPenaltyTotal: 1800,
    penaltyBreakdown: {
      villainEscaped: 100,
      bystanderLost: 400,
      schemeTwistNegative: 1800,
      mastermindTacticUntaken: 0,
      scenarioSpecificPenalty: 0,
    },
    weightedBystanderReward: 1000,
    weightedVictoryPointReward: 400,
    rawScore: 400,
    parScore: -300,
    finalScore: 700,
    scoringConfigVersion: 4,
  } as ScoreBreakdown;
}

function makeState(): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 's',
      mastermindId: 'm',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['h1'],
      bystandersCount: 12,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    },
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] } },
  } as unknown as LegendaryGameState;
}

// A model client spy: records call count, returns REPORT (or throws when armed).
function makeModelClient(over: { throws?: boolean } = {}): CoachModelClient & { calls: number } {
  return {
    model: 'stub-model',
    calls: 0,
    async generate() {
      this.calls += 1;
      if (over.throws === true) {
        throw new Error('simulated model failure');
      }
      return REPORT;
    },
  };
}

function makeDeps(modelClient: CoachModelClient): CoachDependencies {
  return {
    database: {} as CoachDependencies['database'],
    modelClient,
    resolveCardName: (extId: string) => extId,
  };
}

// A CoachLogic fake that grants the Pass, owns the replay, has a score + replay,
// and an empty cache; each field is overridable per test. Records writes.
function makeLogic(over: Partial<CoachLogic> = {}): CoachLogic & { writes: number } {
  const base = {
    writes: 0,
    getEntitlementsForAccount: async () => ({
      ok: true as const,
      value: [
        {
          entitlementKey: 'legendary_pass_2026' as const,
          source: 'stripe' as const,
          sourceRef: null,
          grantedAt: '2026-08-01T00:00:00.000Z',
          revokedAt: null,
        },
      ],
    }),
    findReplayOwnershipForAccount: async () => ({ ownershipId: 1, visibility: 'public' }),
    findCompetitiveScore: async () => ({ scoreBreakdown: makeBreakdown() }),
    reduceReplayByHash: async () => ({ finalState: makeState(), stateHash: REPLAY, turnCount: 12 }),
    readCoachReport: async (): Promise<StoredCoachReport | null> => null,
    writeCoachReport: async function (
      this: { writes: number },
      _hash: string,
      _acct: string,
      model: string,
      report: CoachReport,
    ): Promise<StoredCoachReport> {
      base.writes += 1;
      return { report, model, generatedAt: '2026-08-23T00:00:00.000Z' };
    },
    ...over,
  };
  return base as unknown as CoachLogic & { writes: number };
}

describe('generateOrGetCoachReport (WP-594)', () => {
  test('refuses without the Legendary Pass (not_entitled), never calls the model', async () => {
    const model = makeModelClient();
    const result = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(model),
      makeLogic({ getEntitlementsForAccount: async () => ({ ok: true, value: [] }) }),
    );
    assert.deepEqual(result, { ok: false, reason: 'not_entitled' });
    assert.equal(model.calls, 0);
  });

  test('refuses when the entitlement read fails (not_entitled)', async () => {
    const result = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(makeModelClient()),
      makeLogic({
        getEntitlementsForAccount: async () => ({
          ok: false,
          reason: 'db down',
          code: 'lookup_failed',
        }),
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'not_entitled');
  });

  test('refuses when the caller does not own the replay (not_owner)', async () => {
    const model = makeModelClient();
    const result = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(model),
      makeLogic({ findReplayOwnershipForAccount: async () => null }),
    );
    assert.deepEqual(result, { ok: false, reason: 'not_owner' });
    assert.equal(model.calls, 0);
  });

  test('returns the cached report without calling the model', async () => {
    const model = makeModelClient();
    const logic = makeLogic({
      readCoachReport: async () => ({
        report: REPORT,
        model: 'cached-model',
        generatedAt: '2026-08-20T00:00:00.000Z',
      }),
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);
    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.wasCached, true);
    assert.equal(model.calls, 0);
    assert.equal(logic.writes, 0);
  });

  test('generates fresh on a cache miss: model called once, report cached', async () => {
    const model = makeModelClient();
    const logic = makeLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);
    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.wasCached, false);
    assert.equal(result.ok === true && result.report.model, 'stub-model');
    assert.equal(model.calls, 1);
    assert.equal(logic.writes, 1);
  });

  test('not_found when the match is not scored or not replayable', async () => {
    const noScore = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(makeModelClient()),
      makeLogic({ findCompetitiveScore: async () => null }),
    );
    assert.deepEqual(noScore, { ok: false, reason: 'not_found' });

    const noReplay = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(makeModelClient()),
      makeLogic({ reduceReplayByHash: async () => null }),
    );
    assert.deepEqual(noReplay, { ok: false, reason: 'not_found' });
  });

  test('fail-soft: a model failure returns coach_unavailable and caches nothing', async () => {
    const model = makeModelClient({ throws: true });
    const logic = makeLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);
    assert.deepEqual(result, { ok: false, reason: 'coach_unavailable' });
    assert.equal(model.calls, 1);
    assert.equal(logic.writes, 0);
  });
});
