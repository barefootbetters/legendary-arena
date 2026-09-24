/**
 * useEndgameCoach tests (WP-595 / EC-630).
 *
 * Store-free composable: dependencies (token getter + API wrappers) are injected,
 * so these tests use fakes — no Pinia, no network. Covers Pass-status resolution
 * (guest / none / has) and the requestCoaching state machine (ready / unavailable
 * / error / not-entitled fallback / no-op without the Pass). WP-752 moves the first
 * argument to a `CoachTarget` ref and adds match-target routing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, type Ref } from 'vue';

import {
  useEndgameCoach,
  type CoachTarget,
  type EndgameCoachDependencies,
} from './useEndgameCoach';
import type { EntitlementDisplay, BillingApiResult } from '../lib/api/billingApi';
import type { FetchCoachResult, StoredCoachReport } from '../lib/api/coachApi';

const PASS: EntitlementDisplay = {
  entitlementKey: 'legendary_pass_2026',
  source: 'stripe',
  grantedAt: '2026-08-01T00:00:00.000Z',
};

const STORED: StoredCoachReport = {
  report: { headline: 'h', heroFit: 'f', purchases: 'p', suggestions: ['a'] },
  model: 'claude-sonnet-5',
  generatedAt: '2026-08-23T00:00:00.000Z',
};

// A replay target ref for the scored-match path (the WP-595 call sites).
function replayTarget(replayHash: string): Ref<CoachTarget | null> {
  return ref<CoachTarget | null>({ kind: 'replay', replayHash });
}

function makeDeps(over: Partial<EndgameCoachDependencies> = {}): EndgameCoachDependencies {
  return {
    getToken: () => 'token-abc',
    fetchEntitlements: async (): Promise<BillingApiResult<EntitlementDisplay[]>> => ({
      ok: true,
      value: [PASS],
    }),
    fetchCoachReport: async (): Promise<FetchCoachResult> => ({
      status: 200,
      report: STORED,
      wasCached: false,
      error: null,
    }),
    fetchCoachReportForMatch: async (): Promise<FetchCoachResult> => ({
      status: 200,
      report: STORED,
      wasCached: false,
      error: null,
    }),
    ...over,
  };
}

describe('useEndgameCoach — Pass status (WP-595)', () => {
  test('guest when there is no auth token', async () => {
    const controller = useEndgameCoach(replayTarget('replay-1'), makeDeps({ getToken: () => null }));
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'guest');
  });

  test('has when the account carries legendary_pass_2026', async () => {
    const controller = useEndgameCoach(replayTarget('replay-1'), makeDeps());
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'has');
  });

  test('none when signed in without the Pass', async () => {
    const controller = useEndgameCoach(
      replayTarget('replay-1'),
      makeDeps({ fetchEntitlements: async () => ({ ok: true, value: [] }) }),
    );
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'none');
  });

  test('none (fail closed) when the entitlements read fails', async () => {
    const controller = useEndgameCoach(
      replayTarget('replay-1'),
      makeDeps({ fetchEntitlements: async () => ({ ok: false, status: 500, code: null }) }),
    );
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'none');
  });
});

describe('useEndgameCoach — requestCoaching (WP-595)', () => {
  async function armedController(over: Partial<EndgameCoachDependencies> = {}) {
    const controller = useEndgameCoach(replayTarget('replay-1'), makeDeps(over));
    await controller.initialize(); // → 'has'
    return controller;
  }

  test('200 → ready with the report', async () => {
    const controller = await armedController();
    await controller.requestCoaching();
    assert.equal(controller.coachStatus.value, 'ready');
    assert.deepEqual(controller.report.value, STORED);
  });

  test('503 → unavailable (retriable)', async () => {
    const controller = await armedController({
      fetchCoachReport: async () => ({ status: 503, report: null, wasCached: null, error: 'coach_unavailable' }),
    });
    await controller.requestCoaching();
    assert.equal(controller.coachStatus.value, 'unavailable');
  });

  test('a non-200/503 error → error', async () => {
    const controller = await armedController({
      fetchCoachReport: async () => ({ status: 404, report: null, wasCached: null, error: 'not_found' }),
    });
    await controller.requestCoaching();
    assert.equal(controller.coachStatus.value, 'error');
  });

  test('not_entitled drops back to the locked state', async () => {
    const controller = await armedController({
      fetchCoachReport: async () => ({ status: 403, report: null, wasCached: null, error: 'not_entitled' }),
    });
    await controller.requestCoaching();
    assert.equal(controller.passStatus.value, 'none');
    assert.equal(controller.coachStatus.value, 'idle');
  });

  test('no-op without the Pass (never calls the coach endpoint)', async () => {
    let called = false;
    const controller = useEndgameCoach(
      replayTarget('replay-1'),
      makeDeps({
        fetchEntitlements: async () => ({ ok: true, value: [] }),
        fetchCoachReport: async () => {
          called = true;
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
      }),
    );
    await controller.initialize(); // → 'none'
    await controller.requestCoaching();
    assert.equal(called, false);
    assert.equal(controller.coachStatus.value, 'idle');
  });

  test('no-op when there is no target', async () => {
    let called = false;
    const controller = useEndgameCoach(
      ref<CoachTarget | null>(null),
      makeDeps({
        fetchCoachReport: async () => {
          called = true;
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
      }),
    );
    await controller.initialize(); // → 'has'
    await controller.requestCoaching();
    assert.equal(called, false);
  });
});

describe('useEndgameCoach — target routing (WP-752)', () => {
  test('a match target fetches through fetchCoachReportForMatch with its match id', async () => {
    const replayCalls: string[] = [];
    const matchCalls: string[] = [];
    const controller = useEndgameCoach(
      ref<CoachTarget | null>({ kind: 'match', matchId: 'match-1' }),
      makeDeps({
        fetchCoachReport: async (_token, replayHash) => {
          replayCalls.push(replayHash);
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
        fetchCoachReportForMatch: async (_token, matchId) => {
          matchCalls.push(matchId);
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
      }),
    );
    await controller.initialize();
    await controller.requestCoaching();
    assert.deepEqual(matchCalls, ['match-1']);
    assert.deepEqual(replayCalls, []);
    assert.equal(controller.coachStatus.value, 'ready');
    assert.deepEqual(controller.report.value, STORED);
  });

  test('a replay target still fetches through fetchCoachReport', async () => {
    const replayCalls: string[] = [];
    const matchCalls: string[] = [];
    const controller = useEndgameCoach(
      replayTarget('replay-1'),
      makeDeps({
        fetchCoachReport: async (_token, replayHash) => {
          replayCalls.push(replayHash);
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
        fetchCoachReportForMatch: async (_token, matchId) => {
          matchCalls.push(matchId);
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
      }),
    );
    await controller.initialize();
    await controller.requestCoaching();
    assert.deepEqual(replayCalls, ['replay-1']);
    assert.deepEqual(matchCalls, []);
  });

  test('a match target maps 503 / not_entitled / other errors like the replay target', async () => {
    const unavailable = useEndgameCoach(
      ref<CoachTarget | null>({ kind: 'match', matchId: 'match-1' }),
      makeDeps({
        fetchCoachReportForMatch: async () => ({ status: 503, report: null, wasCached: null, error: 'coach_unavailable' }),
      }),
    );
    await unavailable.initialize();
    await unavailable.requestCoaching();
    assert.equal(unavailable.coachStatus.value, 'unavailable');

    const notEntitled = useEndgameCoach(
      ref<CoachTarget | null>({ kind: 'match', matchId: 'match-1' }),
      makeDeps({
        fetchCoachReportForMatch: async () => ({ status: 403, report: null, wasCached: null, error: 'not_entitled' }),
      }),
    );
    await notEntitled.initialize();
    await notEntitled.requestCoaching();
    assert.equal(notEntitled.passStatus.value, 'none');
    assert.equal(notEntitled.coachStatus.value, 'idle');

    const notFound = useEndgameCoach(
      ref<CoachTarget | null>({ kind: 'match', matchId: 'match-1' }),
      makeDeps({
        fetchCoachReportForMatch: async () => ({ status: 404, report: null, wasCached: null, error: 'not_found' }),
      }),
    );
    await notFound.initialize();
    await notFound.requestCoaching();
    assert.equal(notFound.coachStatus.value, 'error');
  });

  test('an empty match id is a no-op', async () => {
    let called = false;
    const controller = useEndgameCoach(
      ref<CoachTarget | null>({ kind: 'match', matchId: '' }),
      makeDeps({
        fetchCoachReportForMatch: async () => {
          called = true;
          return { status: 200, report: STORED, wasCached: false, error: null };
        },
      }),
    );
    await controller.initialize();
    await controller.requestCoaching();
    assert.equal(called, false);
    assert.equal(controller.coachStatus.value, 'idle');
  });
});
