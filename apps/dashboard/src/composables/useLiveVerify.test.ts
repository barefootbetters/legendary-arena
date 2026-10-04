import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  liveVerifyLabel,
  ledgerRowKey,
  entryMechanic,
  buildLiveVerifyIndex,
  summarizeLiveVerify,
  sortLiveVerifyEntries,
  useLiveVerify,
} from './useLiveVerify.js';
import type { LiveVerifyEntry, LiveVerifyRecord, LiveVerifyState } from '../types/coverage.js';

function makeEntry(overrides: Partial<LiveVerifyEntry>): LiveVerifyEntry {
  return {
    key: 'core/a-hero|draw',
    kind: 'hero',
    card: 'A Hero',
    ability: 'Draw',
    wp: 'WP-001',
    state: 'pending',
    date: '',
    evidence: '',
    note: '',
    ...overrides,
  };
}

function makeRecord(entries: LiveVerifyEntry[]): LiveVerifyRecord {
  return { schemaVersion: 1, about: 'fixture', entries };
}

test('liveVerifyLabel covers every state and throws on an unknown one', () => {
  assert.equal(liveVerifyLabel('verified'), 'Verified');
  assert.equal(liveVerifyLabel('partial'), 'Partial');
  assert.equal(liveVerifyLabel('pending'), 'Not yet');
  assert.throws(() => liveVerifyLabel('bogus' as LiveVerifyState), /Unhandled live-verify state/);
});

test('ledgerRowKey joins extId and mechanic with a pipe', () => {
  assert.equal(
    ledgerRowKey({ extId: 'core/cyclops', mechanic: 'return-on-discard' }),
    'core/cyclops|return-on-discard',
  );
});

test('entryMechanic returns the part after the last pipe, or blank without one', () => {
  assert.equal(entryMechanic({ key: 'core/black-widow|rescue' }), 'rescue');
  assert.equal(
    entryMechanic({ key: 'core-villain-hydra-supreme-hydra|scoring:dynamic-vp' }),
    'scoring:dynamic-vp',
  );
  assert.equal(entryMechanic({ key: 'no-separator' }), '');
});

test('buildLiveVerifyIndex keys entries and keeps the first of a duplicate key', () => {
  const first = makeEntry({ key: 'k', state: 'verified' });
  const second = makeEntry({ key: 'k', state: 'pending' });
  const index = buildLiveVerifyIndex([first, second, makeEntry({ key: 'other' })]);
  assert.equal(index.k, first);
  assert.equal(Object.keys(index).length, 2);
});

test('summarizeLiveVerify counts each state and the total', () => {
  const summary = summarizeLiveVerify([
    makeEntry({ state: 'verified' }),
    makeEntry({ state: 'verified' }),
    makeEntry({ state: 'partial' }),
    makeEntry({ state: 'pending' }),
  ]);
  assert.deepEqual(summary, { verified: 2, partial: 1, pending: 1, total: 4 });
});

test('summarizeLiveVerify on an empty record is all zeros', () => {
  assert.deepEqual(summarizeLiveVerify([]), { verified: 0, partial: 0, pending: 0, total: 0 });
});

test('sortLiveVerifyEntries orders by board kind, then card, then ability; unknown kinds last', () => {
  const sorted = sortLiveVerifyEntries([
    makeEntry({ kind: 'scheme', card: 'Midtown', ability: 'x' }),
    makeEntry({ kind: 'mystery', card: 'Aaa', ability: 'x' }),
    makeEntry({ kind: 'hero', card: 'Storm', ability: 'b' }),
    makeEntry({ kind: 'hero', card: 'Storm', ability: 'a' }),
    makeEntry({ kind: 'villain', card: 'Blob', ability: 'x' }),
    makeEntry({ kind: 'hero', card: 'Cyclops', ability: 'z' }),
  ]);
  assert.deepEqual(
    sorted.map((entry) => `${entry.kind}:${entry.card}:${entry.ability}`),
    [
      'hero:Cyclops:z',
      'hero:Storm:a',
      'hero:Storm:b',
      'villain:Blob:x',
      'scheme:Midtown:x',
      'mystery:Aaa:x',
    ],
  );
});

test('useLiveVerify joins a ledger row to its entry and leaves untracked rows undefined', () => {
  const tracked = makeEntry({ key: 'core/cyclops|return-on-discard', state: 'verified' });
  const live = useLiveVerify({ record: makeRecord([tracked]) });
  assert.equal(live.entryForRow({ extId: 'core/cyclops', mechanic: 'return-on-discard' }), tracked);
  assert.equal(live.entryForRow({ extId: 'xmen/cyclops', mechanic: 'draw' }), undefined);
  assert.deepEqual(live.summary.value, { verified: 1, partial: 0, pending: 0, total: 1 });
  assert.equal(live.entries.value.length, 1);
  assert.equal(live.error, undefined);
});

test('useLiveVerify surfaces the empty-stub error', () => {
  const live = useLiveVerify({ record: { ...makeRecord([]), error: 'missing file' } });
  assert.equal(live.error, 'missing file');
  assert.equal(live.entries.value.length, 0);
});

test('useLiveVerify reads the bundled record by default', () => {
  const live = useLiveVerify();
  assert.ok(Array.isArray(live.entries.value));
  assert.equal(live.summary.value.total, live.entries.value.length);
});
