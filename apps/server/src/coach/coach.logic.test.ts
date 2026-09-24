/**
 * Tests for the endgame-coach orchestrator (WP-594 / EC-629).
 *
 * The DB-backed reads/writes are injected via the CoachLogic seam and the model
 * client via CoachDependencies, so every path is exercised with fakes: NO real
 * database, ZERO paid model calls. Covers the entitlement gate, ownership,
 * cache hit, fresh generation (model called once + cached), the not-found paths,
 * and the fail-soft model-failure path. WP-751 / D-24576 adds the casual
 * (unscored) path and the matchId entry `generateOrGetCoachReportForMatch`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ENDGAME_CONDITIONS } from '@legendary-arena/game-engine';

import {
  generateOrGetCoachReport,
  generateOrGetCoachReportForMatch,
  type CoachLogic,
} from './coach.logic.js';
import type { AccountId } from '../identity/identity.types.js';
import type {
  CoachDependencies,
  CoachMatchSummary,
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

// why: WP-751 — a casual match's summary is derived from the reduced state itself
// (evaluateEndgame + deriveScoringInputs), so it needs the fields those engine calls
// read: the endgame counters, the escaped pile, the villain-deck card types, the
// per-card VP table, and the mastermind's defeated tactics. `counters` selects the
// ending: a mastermind defeat (a normal heroes win) or an early end.
function makeEvaluableState(counters: Record<string, number>): LegendaryGameState {
  return {
    ...makeState(),
    counters,
    escapedPile: [],
    villainDeckCardTypes: {},
    cardVictoryPoints: {},
    mastermind: { baseCardId: 'm', tacticsDefeated: [] },
  } as unknown as LegendaryGameState;
}

// A casual (unscored) match: no score row, and a reduced state that evaluates as a
// normally finished heroes win.
function makeCasualLogic(over: Partial<CoachLogic> = {}): ReturnType<typeof makeLogic> {
  return makeLogic({
    findCompetitiveScore: async () => null,
    reduceReplayByHash: async () => ({
      finalState: makeEvaluableState({ [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1 }),
      stateHash: REPLAY,
      turnCount: 12,
    }),
    ...over,
  });
}

// A model client that records every summary it is handed.
function makeCapturingModel(): CoachModelClient & { summaries: CoachMatchSummary[] } {
  const summaries: CoachMatchSummary[] = [];
  return {
    model: 'stub-model',
    summaries,
    async generate(summary: CoachMatchSummary) {
      summaries.push(summary);
      return REPORT;
    },
  };
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
// and an empty cache; each field is overridable per test. Records writes and
// artifact reads. `readReplayArtifactByHash` returns null by default so the
// sequence teacher yields [] through its clean guarded path (WP-710).
function makeLogic(
  over: Partial<CoachLogic> = {},
): CoachLogic & { writes: number; artifactReads: number } {
  const base = {
    writes: 0,
    artifactReads: 0,
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
    readReplayArtifactByHash: async function (this: { artifactReads: number }) {
      base.artifactReads += 1;
      // why: WP-710 — a null artifact drives the sequence teacher's clean "no tips"
      // guard, so the fresh path merges sequenceTips: [] without a real replay fold.
      return null;
    },
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
    // why: WP-742 — a human-only match by default (no bot-ally seats).
    readBotSeatIdsForReplay: async () => [],
    // why: WP-751 — the matchId entry resolves to REPLAY by default.
    captureMatchForCoach: async () => REPLAY,
    ...over,
  };
  return base as unknown as CoachLogic & { writes: number; artifactReads: number };
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

  // why: WP-751 / D-24576 — INTENTIONAL behavior change. Before WP-751 a missing
  // score row alone meant not_found; an unscored match is now coached from its
  // replay, so the no-score half asserts the case that is still not_found: an
  // unscored match whose reduced state cannot be evaluated.
  test('not_found when an unscored match cannot be evaluated, or the match is not replayable', async (context) => {
    context.mock.method(console, 'warn', () => {});
    const model = makeModelClient();
    const unevaluable = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(model),
      // makeState() carries no endgame counters, so evaluateEndgame cannot read it.
      makeLogic({ findCompetitiveScore: async () => null }),
    );
    assert.deepEqual(unevaluable, { ok: false, reason: 'not_found' });
    assert.equal(model.calls, 0);

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

  // -------------------------------------------------------------------------
  // WP-710 / D-24533 — sequenceTips flow onto the served/persisted CoachReport
  // -------------------------------------------------------------------------

  test('fresh path: reads the replay artifact and merges sequenceTips onto the served report', async () => {
    const model = makeModelClient();
    const logic = makeLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok, true);
    // The teacher seam ran: the raw artifact was read once (to fold hero plays).
    assert.equal(logic.artifactReads, 1, 'the fresh path must read the replay artifact for the teacher');
    // sequenceTips is PRESENT on the served report (merged before persistence). The
    // null-artifact fake drives the clean "no tips" path, so it is the empty array —
    // the field flows regardless of content (real tip content is covered in the
    // teacher unit test + the D-24026 live-verify).
    assert.ok(
      result.ok === true && Array.isArray(result.report.report.sequenceTips),
      'the served report must carry a sequenceTips array',
    );
    assert.deepEqual(result.ok === true && result.report.report.sequenceTips, []);
  });

  test('cache path: serves the persisted sequenceTips and never reads the artifact', async () => {
    const model = makeModelClient();
    const logic = makeLogic({
      readCoachReport: async () => ({
        report: { ...REPORT, sequenceTips: ['Next time, play Iron Man before Repulsor Rays — you would have landed its tech synergy bonus.'] },
        model: 'cached-model',
        generatedAt: '2026-08-20T00:00:00.000Z',
      }),
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.wasCached, true);
    // The cache short-circuits BEFORE the teacher — the artifact is never read, the
    // model never called — and the persisted tips are served verbatim from the blob.
    assert.equal(logic.artifactReads, 0, 'the cache path must not read the artifact');
    assert.equal(model.calls, 0);
    assert.deepEqual(
      result.ok === true && result.report.report.sequenceTips,
      ['Next time, play Iron Man before Repulsor Rays — you would have landed its tech synergy bonus.'],
    );
  });

  // -------------------------------------------------------------------------
  // WP-717 / D-24540 — tableCooperation flows onto the served/persisted CoachReport
  // -------------------------------------------------------------------------

  test('fresh path: merges a Table Cooperation recognition onto the served report', async () => {
    const model = makeModelClient();
    const logic = makeLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok, true);
    // Computed deterministically from the summary (no replay read, no model). At minimum
    // the shared-outcome team line is present, framed cooperatively ("together").
    assert.ok(
      result.ok === true && Array.isArray(result.report.report.tableCooperation),
      'the served report must carry a tableCooperation array',
    );
    assert.ok(
      result.ok === true && (result.report.report.tableCooperation?.length ?? 0) >= 1,
      'the recognition carries at least the shared-outcome line',
    );
    assert.match(
      (result.ok === true && result.report.report.tableCooperation?.[0]) || '',
      /together/,
      'the outcome line frames the shared result as a team achievement',
    );
  });

  test('cache path: serves the persisted tableCooperation from the blob', async () => {
    const model = makeModelClient();
    const logic = makeLogic({
      readCoachReport: async () => ({
        report: { ...REPORT, tableCooperation: ['Your table stopped Magneto together — a shared victory.'] },
        model: 'cached-model',
        generatedAt: '2026-08-20T00:00:00.000Z',
      }),
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.wasCached, true);
    assert.equal(model.calls, 0);
    assert.deepEqual(
      result.ok === true && result.report.report.tableCooperation,
      ['Your table stopped Magneto together — a shared victory.'],
    );
  });

  // -------------------------------------------------------------------------
  // WP-742 / D-24564 — the summary sent to the model marks the bot-ally seat
  // -------------------------------------------------------------------------

  test('fresh path: the summary sent to the model marks the bot-ally seat', async () => {
    const twoSeatState = {
      ...makeState(),
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    } as unknown as LegendaryGameState;
    const capturedSummaries: CoachMatchSummary[] = [];
    const capturingModel: CoachModelClient = {
      model: 'stub-model',
      async generate(summary: CoachMatchSummary) {
        capturedSummaries.push(summary);
        return REPORT;
      },
    };
    const logic = makeLogic({
      reduceReplayByHash: async () => ({ finalState: twoSeatState, stateHash: REPLAY, turnCount: 12 }),
      readBotSeatIdsForReplay: async () => ['1'],
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(capturingModel), logic);

    assert.equal(result.ok, true);
    assert.equal(capturedSummaries.length, 1);
    const perPlayer = capturedSummaries[0]?.perPlayer ?? [];
    assert.deepEqual(
      perPlayer.map((line) => ({ label: line.label, isBotAlly: line.isBotAlly })),
      [
        { label: 'Player 1', isBotAlly: false },
        { label: 'Player 2', isBotAlly: true },
      ],
    );
  });

  test('fail-soft: a throwing bot-seat lookup still coaches, with no markers and one warning', async (context) => {
    const warnSpy = context.mock.method(console, 'warn', () => {});
    const capturedSummaries: CoachMatchSummary[] = [];
    const capturingModel: CoachModelClient = {
      model: 'stub-model',
      async generate(summary: CoachMatchSummary) {
        capturedSummaries.push(summary);
        return REPORT;
      },
    };
    const logic = makeLogic({
      readBotSeatIdsForReplay: async () => {
        throw new Error('simulated bot-seat read failure');
      },
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(capturingModel), logic);

    assert.equal(result.ok, true);
    assert.equal(logic.writes, 1);
    for (const line of capturedSummaries[0]?.perPlayer ?? []) {
      assert.equal(line.isBotAlly, false);
    }
    const coachWarnings = warnSpy.mock.calls.filter((call) =>
      String(call.arguments[0]).startsWith('[coach] Bot-seat lookup failed'),
    );
    assert.equal(coachWarnings.length, 1);
    assert.equal(warnSpy.mock.callCount(), 1, 'exactly one [coach] warning is logged');
  });

  test('cache path: a cache hit never calls the bot-seat lookup', async () => {
    let lookupCalls = 0;
    const model = makeModelClient();
    const logic = makeLogic({
      readCoachReport: async () => ({
        report: REPORT,
        model: 'cached-model',
        generatedAt: '2026-08-20T00:00:00.000Z',
      }),
      readBotSeatIdsForReplay: async () => {
        lookupCalls += 1;
        return ['1'];
      },
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok === true && result.wasCached, true);
    assert.equal(lookupCalls, 0);
  });
});

// ---------------------------------------------------------------------------
// WP-751 / D-24576 — casual (unscored) coaching + the matchId entry
// ---------------------------------------------------------------------------

describe('generateOrGetCoachReport — casual (unscored) match (WP-751)', () => {
  test('an unscored, normally finished match is coached with no score fields in the summary', async () => {
    const model = makeCapturingModel();
    const logic = makeCasualLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.wasCached, false);
    assert.equal(model.summaries.length, 1);
    const summary = model.summaries[0];
    assert.ok(summary);
    for (const field of ['rawScore', 'finalScore', 'grade', 'adversityExpected']) {
      assert.equal(field in summary, false, 'the casual summary must omit ' + field);
    }
    assert.equal(summary.outcome, 'heroes-win');
    assert.equal(summary.rounds, 12);
    assert.equal(summary.perPlayer.length, 1);
  });

  test('an early-ended unscored match is not_found and the model is never called', async () => {
    const model = makeModelClient();
    const logic = makeCasualLogic({
      reduceReplayByHash: async () => ({
        finalState: makeEvaluableState({ [ENDGAME_CONDITIONS.MATCH_ENDED_EARLY]: 1 }),
        stateHash: REPLAY,
        turnCount: 3,
      }),
    });
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(model), logic);

    assert.deepEqual(result, { ok: false, reason: 'not_found' });
    assert.equal(model.calls, 0);
    assert.equal(logic.writes, 0);
  });

  test('not_entitled and not_owner still refuse before the casual path runs', async () => {
    let reductions = 0;
    const countingReduce: CoachLogic['reduceReplayByHash'] = async () => {
      reductions += 1;
      return null;
    };
    const noPass = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(makeModelClient()),
      makeCasualLogic({
        getEntitlementsForAccount: async () => ({ ok: true, value: [] }),
        reduceReplayByHash: countingReduce,
      }),
    );
    assert.deepEqual(noPass, { ok: false, reason: 'not_entitled' });

    const notOwner = await generateOrGetCoachReport(
      ACCOUNT,
      REPLAY,
      makeDeps(makeModelClient()),
      makeCasualLogic({
        findReplayOwnershipForAccount: async () => null,
        reduceReplayByHash: countingReduce,
      }),
    );
    assert.deepEqual(notOwner, { ok: false, reason: 'not_owner' });
    assert.equal(reductions, 0, 'neither refusal may reduce the replay');
  });

  test('the casual path writes only through writeCoachReport', async () => {
    const logic = makeCasualLogic();
    const result = await generateOrGetCoachReport(ACCOUNT, REPLAY, makeDeps(makeModelClient()), logic);

    assert.equal(result.ok, true);
    // The seam's only write member ran exactly once; every other member is a read.
    assert.equal(logic.writes, 1);
  });
});

describe('generateOrGetCoachReportForMatch (WP-751)', () => {
  test('without the Pass it is not_entitled and never resolves or captures the match', async () => {
    let captureCalls = 0;
    const logic = makeCasualLogic({
      getEntitlementsForAccount: async () => ({ ok: true, value: [] }),
      captureMatchForCoach: async () => {
        captureCalls += 1;
        return REPLAY;
      },
    });
    const result = await generateOrGetCoachReportForMatch(
      ACCOUNT,
      'match-1',
      makeDeps(makeModelClient()),
      logic,
    );

    assert.deepEqual(result, { ok: false, reason: 'not_entitled' });
    assert.equal(captureCalls, 0);
  });

  test('an unresolvable match is not_found', async () => {
    const model = makeModelClient();
    const result = await generateOrGetCoachReportForMatch(
      ACCOUNT,
      'match-1',
      makeDeps(model),
      makeCasualLogic({ captureMatchForCoach: async () => null }),
    );

    assert.deepEqual(result, { ok: false, reason: 'not_found' });
    assert.equal(model.calls, 0);
  });

  test('a resolvable, owned, unscored match is coached through the replay pipeline', async () => {
    const resolvedMatchIds: string[] = [];
    const logic = makeCasualLogic({
      captureMatchForCoach: async (matchId: string) => {
        resolvedMatchIds.push(matchId);
        return REPLAY;
      },
    });
    const result = await generateOrGetCoachReportForMatch(
      ACCOUNT,
      'match-1',
      makeDeps(makeModelClient()),
      logic,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(resolvedMatchIds, ['match-1']);
    assert.equal(logic.writes, 1);
  });
});
