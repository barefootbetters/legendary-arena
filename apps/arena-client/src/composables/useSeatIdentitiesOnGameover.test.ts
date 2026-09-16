/**
 * useSeatIdentitiesOnGameover tests (INFRA: endgame seat names).
 *
 * Drives the composable against a stubbed `globalThis.fetch` and a real Pinia
 * (uiState store) + a matchId ref: the roster is fetched exactly once on the
 * gameover transition (no bearer — public read), a re-transition does NOT re-fire
 * (the fire-once guard), a matchId change re-arms it, and any failure leaves the
 * roster null (the recap keeps its "Player N" fallback).
 *
 * Mirrors useCompetitiveSubmitOnGameover.test.ts. Pure `node:test` — no
 * vue-sfc-loader needed (this is a .ts composable).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useSeatIdentitiesOnGameover } from './useSeatIdentitiesOnGameover';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
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

async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

const ROSTER = [
  { playerId: '0', isBot: false, handle: 'jeff' },
  { playerId: '1', isBot: true, handle: null },
];

test('fetches the roster once on gameover, with no Authorization header', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { seatIdentities: ROSTER });
  try {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { seatIdentities } = useSeatIdentitiesOnGameover(ref('match-1'));
    await flush();

    assert.deepEqual(seatIdentities.value, ROSTER);
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0]!.url, /\/api\/match\/match-1\/seat-identities$/);
    const headers = (stub.calls[0]!.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, undefined, 'public read sends no bearer');
  } finally {
    stub.restore();
  }
});

test('a failed fetch leaves the roster null (recap falls back to Player N)', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(404, { error: 'match_not_finished' });
  try {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { seatIdentities } = useSeatIdentitiesOnGameover(ref('match-1'));
    await flush();
    assert.equal(seatIdentities.value, null);
  } finally {
    stub.restore();
  }
});

test('does not re-fire across a gameover re-transition (fire-once guard)', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { seatIdentities: ROSTER });
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    useSeatIdentitiesOnGameover(ref('match-1'));
    await flush();
    assert.equal(stub.calls.length, 1);

    uiStateStore.setSnapshot(loadUiStateFixture('mid-turn'));
    await flush();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();
    assert.equal(stub.calls.length, 1, 'the fetch must fire at most once per match');
  } finally {
    stub.restore();
  }
});

test('re-arms and fetches again when the matchId changes', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { seatIdentities: ROSTER });
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    const matchId = ref('match-1');
    const { seatIdentities } = useSeatIdentitiesOnGameover(matchId);
    await flush();
    assert.equal(stub.calls.length, 1);

    uiStateStore.setSnapshot(loadUiStateFixture('mid-turn'));
    await flush();
    matchId.value = 'match-2';
    await flush();
    assert.equal(seatIdentities.value, null, 're-arm clears the previous roster');
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();

    assert.equal(stub.calls.length, 2);
    assert.match(stub.calls[1]!.url, /\/api\/match\/match-2\/seat-identities$/);
  } finally {
    stub.restore();
  }
});
