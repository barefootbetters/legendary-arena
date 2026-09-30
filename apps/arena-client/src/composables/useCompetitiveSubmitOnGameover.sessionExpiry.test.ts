/**
 * useCompetitiveSubmitOnGameover — expired session vs true guest (D-24630).
 *
 * A signed-in player whose broker session expired mid-match reaches gameover with
 * no bearer token, exactly like a guest. The seat is still owned by the account
 * bound at join (D-24119), so the composable must report `'session-expired'`
 * (not `'guest'`), stash a pending-submit marker for the `?route=login` round
 * trip, and submit as soon as a token reappears. A true guest keeps `'guest'`.
 *
 * jsdom supplies a real `sessionStorage` for the pending-submit marker.
 */

import '../testing/jsdom-setup';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useCompetitiveSubmitOnGameover } from './useCompetitiveSubmitOnGameover';
import { useUiStateStore } from '../stores/uiState';
import { useAuthStore } from '../stores/auth';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import {
  readPendingScoreSubmit,
  stashPendingScoreSubmit,
} from '../lib/pendingScoreSubmit';
import type { CompetitiveSeatIdentity } from '../lib/api/competitionApi';

const LIVE_SEARCH = '?match=match-1&player=0&credentials=cred-xyz';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Stub `globalThis.fetch` with a queue of `{ status, body }` responses (the last
 * one repeats).
 */
function installFetchQueue(
  responses: readonly { status: number; body: unknown }[],
): { calls: CapturedRequest[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return { status: next?.status ?? 500, json: async () => next?.body } as Response;
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

beforeEach(() => {
  sessionStorage.clear();
  setActivePinia(createPinia());
});

test('a session that expired mid-match is session-expired, not guest, and stashes the return marker', async () => {
  const stub = installFetchQueue([{ status: 200, body: { record: {}, wasExisting: false } }]);
  try {
    const auth = useAuthStore();
    auth.setSession('token-abc', null);
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      readCurrentSearch: () => LIVE_SEARCH,
    });
    // The broker reports expiry mid-match (App.vue onSessionExpired → clearSession).
    auth.clearSession();
    await flush();
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();

    assert.equal(submissionStatus.value, 'session-expired');
    assert.equal(stub.calls.length, 0, 'no POST without a token');
    assert.deepEqual(readPendingScoreSubmit(), {
      matchId: 'match-1',
      playerId: '0',
      credentials: 'cred-xyz',
    });
  } finally {
    stub.restore();
  }
});

test('signing back in fires the deferred submit and clears the marker', async () => {
  const stub = installFetchQueue([{ status: 200, body: { record: { finalScore: 5 }, wasExisting: false } }]);
  try {
    const auth = useAuthStore();
    auth.setSession('token-abc', null);
    const { submissionStatus, submittedScore } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      readCurrentSearch: () => LIVE_SEARCH,
    });
    auth.clearSession();
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    await flush();
    assert.equal(submissionStatus.value, 'session-expired');

    auth.setSession('token-new', null);
    await flush();

    assert.equal(submissionStatus.value, 'submitted');
    assert.equal(submittedScore.value?.finalScore, 5);
    assert.equal(stub.calls.length, 1);
    assert.equal(
      (stub.calls[0]?.init.headers as Record<string, string>).Authorization,
      'Bearer token-new',
      'the deferred submit uses the fresh token',
    );
    assert.deepEqual(JSON.parse(String(stub.calls[0]?.init.body)), { matchId: 'match-1' });
    assert.equal(readPendingScoreSubmit(), null, 'the marker is cleared once the submit settles');
  } finally {
    stub.restore();
  }
});

test('returning from sign-in (marker present, token hydrating late) shows session-expired, then submits', async () => {
  const stub = installFetchQueue([{ status: 200, body: { record: {}, wasExisting: true } }]);
  try {
    stashPendingScoreSubmit('match-1', LIVE_SEARCH);
    // A fresh page load: gameover snapshot arrives before the broker hydrates.
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      readCurrentSearch: () => LIVE_SEARCH,
    });
    await flush();
    assert.equal(submissionStatus.value, 'session-expired', 'never flashes the guest copy');

    useAuthStore().bootstrapFromCachedToken('token-hydrated');
    await flush();

    assert.equal(submissionStatus.value, 'already');
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test('a true guest seat stays guest: no token ever, no marker, no account-bound roster', async () => {
  const stub = installFetchQueue([{ status: 200, body: {} }]);
  try {
    const roster = ref<readonly CompetitiveSeatIdentity[] | null>(null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      seatIdentities: roster,
      playerId: ref('0'),
      readCurrentSearch: () => LIVE_SEARCH,
    });
    await flush();
    roster.value = [{ playerId: '0', isBot: false, handle: null }];
    await flush();

    assert.equal(submissionStatus.value, 'guest');
    assert.equal(stub.calls.length, 0);
    assert.equal(readPendingScoreSubmit(), null, 'a guest never stashes a return marker');
  } finally {
    stub.restore();
  }
});

test('a roster binding this seat to an account upgrades a guest latch to session-expired', async () => {
  const stub = installFetchQueue([{ status: 200, body: {} }]);
  try {
    const roster = ref<readonly CompetitiveSeatIdentity[] | null>(null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      seatIdentities: roster,
      playerId: ref('0'),
      readCurrentSearch: () => LIVE_SEARCH,
    });
    await flush();
    assert.equal(submissionStatus.value, 'guest');

    // The public roster lands after gameover: seat 0 is @jefferyjjensen.
    roster.value = [
      { playerId: '0', isBot: false, handle: 'jefferyjjensen' },
      { playerId: '1', isBot: true, handle: null },
    ];
    await flush();

    assert.equal(submissionStatus.value, 'session-expired');
    assert.equal(readPendingScoreSubmit()?.matchId, 'match-1');
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test('a 401 on a still-held (stale) token maps to session-expired, not failed', async () => {
  const stub = installFetchQueue([{ status: 401, body: { error: 'invalid_session' } }]);
  try {
    useAuthStore().setSession('token-stale', null);
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'), {
      readCurrentSearch: () => LIVE_SEARCH,
    });
    await flush();

    assert.equal(submissionStatus.value, 'session-expired');
    assert.equal(readPendingScoreSubmit()?.matchId, 'match-1');
  } finally {
    stub.restore();
  }
});

test('a late-hydrating token for an account that owns no seat keeps the guest copy', async () => {
  const stub = installFetchQueue([{ status: 403, body: { error: 'not_owner' } }]);
  try {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const { submissionStatus } = useCompetitiveSubmitOnGameover(ref('match-1'));
    await flush();
    assert.equal(submissionStatus.value, 'guest');

    useAuthStore().bootstrapFromCachedToken('token-other-account');
    await flush();

    assert.equal(stub.calls.length, 1, 'the late token is tried once');
    assert.equal(submissionStatus.value, 'guest', 'not_owner from a guest latch stays guest');
  } finally {
    stub.restore();
  }
});
