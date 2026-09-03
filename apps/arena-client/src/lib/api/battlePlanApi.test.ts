/**
 * battlePlanApi tests (WP-637 / EC-672).
 *
 * Exercises the GET/PUT wrappers against a stubbed `globalThis.fetch`, plus a
 * drift test pinning the client-local `BATTLE_PLAN_API_ERROR_CODES` mirror to the
 * WP-635 server `BattlePlanErrorCode` union.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchBattlePlan,
  updateBattlePlanPhase,
  BATTLE_PLAN_API_ERROR_CODES,
  type BattlePlanView,
} from './battlePlanApi';

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function installFetchStub(
  status: number,
  jsonBody: unknown,
): { calls: CapturedRequest[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { status, json: async () => jsonBody } as Response;
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the battle-plan API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function samplePlan(overrides: Partial<BattlePlanView> = {}): BattlePlanView {
  return {
    matchId: 'match-1',
    preBattle: 'Focus the mastermind.',
    battleAdjustments: null,
    postBattle: null,
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

test('fetchBattlePlan returns the plan on 200 with a Bearer header', async () => {
  const stub = installFetchStub(200, { battlePlan: samplePlan() });
  try {
    const result = await fetchBattlePlan('match-1', { kind: 'session', token: 'token-abc' });
    assert.ok(result.ok === true);
    assert.equal(result.value.battlePlan?.matchId, 'match-1');
    assert.equal(result.value.battlePlan?.preBattle, 'Focus the mastermind.');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/match/match-1/battle-plan'));
    assert.equal(call.init.method, 'GET');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('fetchBattlePlan returns battlePlan:null when no plan exists yet', async () => {
  const stub = installFetchStub(200, { battlePlan: null });
  try {
    const result = await fetchBattlePlan('match-1', { kind: 'session', token: 'token' });
    assert.ok(result.ok === true);
    assert.equal(result.value.battlePlan, null);
  } finally {
    stub.restore();
  }
});

test('updateBattlePlanPhase PUTs { phase, text } and returns the document on 200', async () => {
  const written = samplePlan({ battleAdjustments: 'Shift to the villains.' });
  const stub = installFetchStub(200, { battlePlan: written });
  try {
    const result = await updateBattlePlanPhase(
      'match-1',
      'battle_adjustments',
      'Shift to the villains.',
      { kind: 'session', token: 'token-xyz' },
    );
    assert.ok(result.ok === true);
    assert.equal(result.value.battlePlan.battleAdjustments, 'Shift to the villains.');
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/match/match-1/battle-plan'));
    assert.equal(call.init.method, 'PUT');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer token-xyz');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      phase: 'battle_adjustments',
      text: 'Shift to the villains.',
    });
  } finally {
    stub.restore();
  }
});

test('a 403 not_a_participant is parsed into the failure branch', async () => {
  const stub = installFetchStub(403, { error: 'not_a_participant' });
  try {
    const result = await fetchBattlePlan('match-1', { kind: 'session', token: 'token' });
    assert.ok(result.ok === false);
    assert.equal(result.status, 403);
    assert.equal(result.code, 'not_a_participant');
  } finally {
    stub.restore();
  }
});

test('a 400 text_too_long is parsed into the failure branch', async () => {
  const stub = installFetchStub(400, { error: 'text_too_long' });
  try {
    const result = await updateBattlePlanPhase('match-1', 'pre_battle', 'x', {
      kind: 'session',
      token: 'token',
    });
    assert.ok(result.ok === false);
    assert.equal(result.status, 400);
    assert.equal(result.code, 'text_too_long');
  } finally {
    stub.restore();
  }
});

test('a 401 session code (outside the closed set) narrows to a null code', async () => {
  const stub = installFetchStub(401, { error: 'missing_token' });
  try {
    const result = await fetchBattlePlan('match-1', null);
    assert.ok(result.ok === false);
    assert.equal(result.status, 401);
    // why: `missing_token` is an auth-layer session code, not one of the five
    // Battle Plan codes, so it narrows to null → the UI shows a generic banner.
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('a 500 internal_error is parsed into the failure branch', async () => {
  const stub = installFetchStub(500, { error: 'internal_error' });
  try {
    const result = await updateBattlePlanPhase('match-1', 'post_battle', 'gg', {
      kind: 'session',
      token: 'token',
    });
    assert.ok(result.ok === false);
    assert.equal(result.status, 500);
    assert.equal(result.code, 'internal_error');
  } finally {
    stub.restore();
  }
});

test('a network throw yields { ok:false, status:0, code:null }', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await fetchBattlePlan('match-1', { kind: 'session', token: 'token' });
    assert.ok(result.ok === false);
    assert.equal(result.status, 0);
    assert.equal(result.code, null);
  } finally {
    stub.restore();
  }
});

test('fetchBattlePlan sends the X-Guest-* seat proof for a guest descriptor (no Authorization)', async () => {
  const stub = installFetchStub(200, { battlePlan: samplePlan() });
  try {
    const result = await fetchBattlePlan('match-1', {
      kind: 'guest',
      playerId: '1',
      credentials: 'seat-cred-abc',
    });
    assert.ok(result.ok === true);
    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    // why: the guest branch must emit the WP-638 header names verbatim and must
    // NOT emit a bearer — a guest has no session token.
    assert.equal(headers['X-Guest-Player-Id'], '1');
    assert.equal(headers['X-Guest-Credentials'], 'seat-cred-abc');
    assert.equal(headers.Authorization, undefined);
  } finally {
    stub.restore();
  }
});

test('updateBattlePlanPhase sends the X-Guest-* headers alongside Content-Type for a guest', async () => {
  const written = samplePlan({ battleAdjustments: 'Guard the HQ.' });
  const stub = installFetchStub(200, { battlePlan: written });
  try {
    const result = await updateBattlePlanPhase('match-1', 'battle_adjustments', 'Guard the HQ.', {
      kind: 'guest',
      playerId: '2',
      credentials: 'seat-cred-xyz',
    });
    assert.ok(result.ok === true);
    const [call] = stub.calls;
    assert.ok(call);
    assert.equal(call.init.method, 'PUT');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers['X-Guest-Player-Id'], '2');
    assert.equal(headers['X-Guest-Credentials'], 'seat-cred-xyz');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers.Authorization, undefined);
  } finally {
    stub.restore();
  }
});

test('a null auth descriptor sends neither Authorization nor X-Guest-* headers', async () => {
  const stub = installFetchStub(200, { battlePlan: samplePlan() });
  try {
    const result = await fetchBattlePlan('match-1', null);
    assert.ok(result.ok === true);
    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers['X-Guest-Player-Id'], undefined);
    assert.equal(headers['X-Guest-Credentials'], undefined);
  } finally {
    stub.restore();
  }
});

test('BATTLE_PLAN_API_ERROR_CODES mirrors the WP-635 server union exactly (drift guard)', () => {
  // why: the exact five-code server union from
  // apps/server/src/match/battlePlan.types.ts#BattlePlanErrorCode. Mirrored by
  // hand here because the engine/server-isolation rule forbids importing a
  // server-layer type; this assertion fails loudly if the server union moves.
  const expectedServerUnion = [
    'invalid_request',
    'unknown_phase',
    'text_too_long',
    'not_a_participant',
    'internal_error',
  ];
  assert.equal(BATTLE_PLAN_API_ERROR_CODES.length, expectedServerUnion.length);
  assert.equal(
    new Set(BATTLE_PLAN_API_ERROR_CODES).size,
    expectedServerUnion.length,
  );
  assert.deepEqual(
    [...BATTLE_PLAN_API_ERROR_CODES].sort(),
    [...expectedServerUnion].sort(),
  );
});
