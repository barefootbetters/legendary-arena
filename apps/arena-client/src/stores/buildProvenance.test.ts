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
