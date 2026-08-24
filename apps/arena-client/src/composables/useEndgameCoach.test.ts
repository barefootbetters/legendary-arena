/**
 * useEndgameCoach tests (WP-595 / EC-630).
 *
 * Store-free composable: dependencies (token getter + API wrappers) are injected,
 * so these tests use fakes — no Pinia, no network. Covers Pass-status resolution
 * (guest / none / has) and the requestCoaching state machine (ready / unavailable
 * / error / not-entitled fallback / no-op without the Pass).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';

import { useEndgameCoach, type EndgameCoachDependencies } from './useEndgameCoach';
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
    ...over,
  };
}

describe('useEndgameCoach — Pass status (WP-595)', () => {
  test('guest when there is no auth token', async () => {
    const controller = useEndgameCoach(ref('replay-1'), makeDeps({ getToken: () => null }));
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'guest');
  });

  test('has when the account carries legendary_pass_2026', async () => {
    const controller = useEndgameCoach(ref('replay-1'), makeDeps());
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'has');
  });

  test('none when signed in without the Pass', async () => {
    const controller = useEndgameCoach(
      ref('replay-1'),
      makeDeps({ fetchEntitlements: async () => ({ ok: true, value: [] }) }),
    );
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'none');
  });

  test('none (fail closed) when the entitlements read fails', async () => {
    const controller = useEndgameCoach(
      ref('replay-1'),
      makeDeps({ fetchEntitlements: async () => ({ ok: false, status: 500, code: null }) }),
    );
    await controller.initialize();
    assert.equal(controller.passStatus.value, 'none');
  });
});

describe('useEndgameCoach — requestCoaching (WP-595)', () => {
  async function armedController(over: Partial<EndgameCoachDependencies> = {}) {
    const controller = useEndgameCoach(ref('replay-1'), makeDeps(over));
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
      ref('replay-1'),
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

  test('no-op when the replay hash is absent', async () => {
    let called = false;
    const controller = useEndgameCoach(
      ref(null),
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
