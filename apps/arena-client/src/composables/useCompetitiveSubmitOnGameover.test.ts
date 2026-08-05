/**
 * useCompetitiveSubmitOnGameover tests (WP-339 / EC-369).
 *
 * Drives the composable against a stubbed `globalThis.fetch` and a real Pinia
 * (uiState + auth stores) + a matchId ref: a guest is never submitted
 * (`'guest'`); an authenticated player submits exactly once on the gameover
 * transition (`'submitted'` / `'already'` / `'failed'`); a re-transition does
 * NOT re-fire (the fire-once guard); and a matchId change re-arms the composable.
 *
 * Pure `node:test` (+ vue-sfc-loader is not needed — this is a .ts composable).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useCompetitiveSubmitOnGameover } from './useCompetitiveSubmitOnGameover';
import { useUiStateStore } from '../stores/uiState';
import { useAuthStore } from '../stores/auth';
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

/** Flush Vue's watcher scheduler + a pending fetch microtask/macrotask. */
async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

test('a guest at gameover is never submitted; status becomes guest', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, {});
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    // Auth store left unauthenticated (token === null).

    const matchId = ref('match-1');
    const { submissionStatus } = useCompetitiveSubmitOnGameover(matchId);
    await flush();

    assert.equal(submissionStatus.value, 'guest');
    assert.equal(stub.calls.length, 0, 'a guest must never POST');
  } finally {
    stub.restore();
  }
});

test('an authenticated player submits once on gameover → submitted', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { record: {}, wasExisting: false });
  try {
    useAuthStore().setSession('token-abc', null);
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));

    const matchId = ref('match-1');
    const { submissionStatus } = useCompetitiveSubmitOnGameover(matchId);
    await flush();

    assert.equal(submissionStatus.value, 'submitted');
    assert.equal(stub.calls.length, 1);
    assert.deepEqual(JSON.parse(String(stub.calls[0]?.init.body)), {
      matchId: 'match-1',
    });
  } finally {
    stub.restore();
  }
});

// why: WP-502 / D-24306 — a match the players ended early (the endedEarly gameover
// marker) is never a ranked result, so an authenticated player is NOT submitted:
// the POST is skipped entirely and the status is the permanent, non-error
// 'ineligible' (the same disposition as par_not_published), never 'failed'.
test('an early-ended match is never submitted; status becomes ineligible', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { record: {}, wasExisting: false });
  try {
    useAuthStore().setSession('token-abc', null);
    const uiStateStore = useUiStateStore();
    // why: clone before mutating — loadUiStateFixture returns a shared reference,
    // so flagging endedEarly on the raw object would leak into other tests.
    const snapshot = structuredClone(loadUiStateFixture('endgame-win'));
    // why: flag the fixture's gameover as an early end — the marker the client reads.
    snapshot.gameOver = { ...snapshot.gameOver!, endedEarly: true };
    uiStateStore.setSnapshot(snapshot);

    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();

    assert.equal(submissionStatus.value, 'ineligible');
    assert.equal(stub.calls.length, 0, 'an early-ended match must never POST');
  } finally {
    stub.restore();
  }
});

test('a 200 wasExisting maps to already; a non-200 maps to failed', async () => {
  setActivePinia(createPinia());
  const existingStub = installFetchStub(200, { record: {}, wasExisting: true });
  try {
    useAuthStore().setSession('token-abc', null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'already');
  } finally {
    existingStub.restore();
  }

  setActivePinia(createPinia());
  const failStub = installFetchStub(409, { error: 'match_not_finished' });
  try {
    useAuthStore().setSession('token-abc', null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'failed');
  } finally {
    failStub.restore();
  }
});

// why: WP-465 — a `par_not_published` rejection (the match is not a ranked-gauntlet
// loadout) is PERMANENT ineligibility, not a transient failure, so it maps to the
// distinct `'ineligible'` status; every other non-200 reason still maps to `'failed'`.
test('a par_not_published rejection maps to ineligible; another reason maps to failed', async () => {
  setActivePinia(createPinia());
  const ineligibleStub = installFetchStub(422, { error: 'par_not_published' });
  try {
    useAuthStore().setSession('token-abc', null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'ineligible');
  } finally {
    ineligibleStub.restore();
  }

  setActivePinia(createPinia());
  const otherFailStub = installFetchStub(500, { error: 'internal_error' });
  try {
    useAuthStore().setSession('token-abc', null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'failed');
  } finally {
    otherFailStub.restore();
  }
});

test('does not re-fire the submit across a gameover re-transition (fire-once guard)', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { record: {}, wasExisting: false });
  try {
    useAuthStore().setSession('token-abc', null);
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'submitted');
    assert.equal(stub.calls.length, 1);

    // Toggle back to an in-progress snapshot, then to gameover again — the
    // hasSubmitted guard must prevent a second POST for the same match.
    uiStateStore.setSnapshot(loadUiStateFixture('mid-turn'));
    await flush();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();
    assert.equal(stub.calls.length, 1, 'the submit must fire at most once per match');
  } finally {
    stub.restore();
  }
});

test('re-arms and submits again when the matchId changes', async () => {
  setActivePinia(createPinia());
  const stub = installFetchStub(200, { record: {}, wasExisting: false });
  try {
    useAuthStore().setSession('token-abc', null);
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    const matchId = ref('match-1');
    const { submissionStatus } = useCompetitiveSubmitOnGameover(matchId);
    await flush();
    assert.equal(stub.calls.length, 1);

    // A new match on the same viewport: change matchId (re-arm → idle), then
    // re-transition through gameover.
    uiStateStore.setSnapshot(loadUiStateFixture('mid-turn'));
    await flush();
    matchId.value = 'match-2';
    await flush();
    assert.equal(submissionStatus.value, 'idle');
    uiStateStore.setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();

    assert.equal(stub.calls.length, 2);
    assert.deepEqual(JSON.parse(String(stub.calls[1]?.init.body)), {
      matchId: 'match-2',
    });
  } finally {
    stub.restore();
  }
});
