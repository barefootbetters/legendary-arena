import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

import { useBuildProvenanceStore } from './buildProvenance';
import type { FetchLike } from '../diagnostics/buildProvenance';

// why: each test creates its own Pinia so cross-test state cannot leak (the
// stores/connection.test.ts precedent).

const CLIENT = { gitSha: 'c1c1c1c', buildTimestamp: '2026-10-07T03:31:43.208Z' };

/**
 * A fake fetch that answers every request with a server version and a match
 * createdAt, counting the calls.
 */
function countingFetch(): { fetchImpl: FetchLike; calls: () => number } {
  let callCount = 0;
  const fetchImpl: FetchLike = async (url) => {
    callCount += 1;
    if (url.endsWith('/api/version')) {
      return { ok: true, json: async () => ({ gitSha: '5d1561f', buildTimestamp: '2026-10-07T03:32:35.578Z' }) };
    }
    return { ok: true, json: async () => ({ createdAt: Date.parse('2026-10-07T03:22:25.531Z') }) };
  };
  return { fetchImpl, calls: () => callCount };
}

test('starts empty', () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  assert.equal(store.provenance, null);
});

test('loads once per match id', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl, calls } = countingFetch();
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  assert.equal(store.provenance?.matchId, 'match-a');
  assert.equal(store.provenance?.isMatchOlderThanServer, true);
  assert.equal(calls(), 2);
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  assert.equal(calls(), 2, 'a repeat load for the same match does not refetch');
});

test('ignores an empty match id', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl, calls } = countingFetch();
  await store.load('https://server.test', '', CLIENT, fetchImpl);
  assert.equal(store.provenance, null);
  assert.equal(calls(), 0);
});

test('a newer match id replaces the record, and a stale in-flight load does not overwrite it', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl } = countingFetch();
  const first = store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  const second = store.load('https://server.test', 'match-b', CLIENT, fetchImpl);
  await Promise.all([first, second]);
  assert.equal(store.provenance?.matchId, 'match-b');
});

/**
 * A fake fetch whose server version can be switched between calls, as a deploy
 * would switch it. The match was created at 03:22:25.
 */
function switchableFetch(): { fetchImpl: FetchLike; setServer: (gitSha: string, bootedAtIso: string) => void } {
  let server = { gitSha: 'old0001', buildTimestamp: '2026-10-07T03:00:00.000Z' };
  const fetchImpl: FetchLike = async (url) => {
    if (url.endsWith('/api/version')) {
      const answer = { ...server };
      return { ok: true, json: async () => answer };
    }
    return { ok: true, json: async () => ({ createdAt: Date.parse('2026-10-07T03:22:25.531Z') }) };
  };
  return {
    fetchImpl,
    setServer: (gitSha, bootedAtIso) => {
      server = { gitSha, buildTimestamp: bootedAtIso };
    },
  };
}

test('refresh re-collects the loaded match, so a server deploy after the match was created is reported', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl, setServer } = switchableFetch();
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  assert.equal(store.provenance?.serverGitSha, 'old0001');
  assert.equal(store.provenance?.isMatchOlderThanServer, false, 'the match was created on the running server');

  setServer('new0002', '2026-10-07T03:25:00.000Z');
  await store.refresh('https://server.test', 'match-a', CLIENT, fetchImpl);
  assert.equal(store.provenance?.serverGitSha, 'new0002');
  assert.equal(store.provenance?.serverBootedAtIso, '2026-10-07T03:25:00.000Z');
  assert.equal(store.provenance?.isMatchOlderThanServer, true, 'the match now predates the running server');
});

test('refresh for an empty or different match id does nothing', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl, calls } = countingFetch();
  await store.refresh('https://server.test', 'match-a', CLIENT, fetchImpl);
  // why: assert on a copy; asserting `store.provenance` itself is null would narrow
  // it to null for the reads below.
  const beforeLoad = store.provenance;
  assert.equal(beforeLoad, null, 'nothing was loaded, so there is nothing to refresh');
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  await store.refresh('https://server.test', 'match-b', CLIENT, fetchImpl);
  await store.refresh('https://server.test', '', CLIENT, fetchImpl);
  assert.equal(calls(), 2, 'only the load fetched');
  assert.equal(store.provenance?.matchId, 'match-a');
});

test('a failed version probe on refresh reports the server build as unknown', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl } = switchableFetch();
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  const failingFetch: FetchLike = async () => ({ ok: false, json: async () => ({}) });
  await store.refresh('https://server.test', 'match-a', CLIENT, failingFetch);
  assert.equal(store.provenance?.serverGitSha, null);
  assert.equal(store.provenance?.isMatchOlderThanServer, null);
});

test('an older in-flight refresh does not overwrite a newer one', async () => {
  setActivePinia(createPinia());
  const store = useBuildProvenanceStore();
  const { fetchImpl } = switchableFetch();
  await store.load('https://server.test', 'match-a', CLIENT, fetchImpl);
  let releaseSlow: () => void = () => undefined;
  const slowFetch: FetchLike = async (url) => {
    if (url.endsWith('/api/version')) {
      await new Promise<void>((resolve) => {
        releaseSlow = resolve;
      });
      return { ok: true, json: async () => ({ gitSha: 'slow003', buildTimestamp: '2026-10-07T03:24:00.000Z' }) };
    }
    return { ok: true, json: async () => ({ createdAt: Date.parse('2026-10-07T03:22:25.531Z') }) };
  };
  const slow = store.refresh('https://server.test', 'match-a', CLIENT, slowFetch);
  const fastFetch: FetchLike = async (url) => {
    if (url.endsWith('/api/version')) {
      return { ok: true, json: async () => ({ gitSha: 'fast004', buildTimestamp: '2026-10-07T03:26:00.000Z' }) };
    }
    return { ok: true, json: async () => ({ createdAt: Date.parse('2026-10-07T03:22:25.531Z') }) };
  };
  await store.refresh('https://server.test', 'match-a', CLIENT, fastFetch);
  releaseSlow();
  await slow;
  assert.equal(store.provenance?.serverGitSha, 'fast004');
});
