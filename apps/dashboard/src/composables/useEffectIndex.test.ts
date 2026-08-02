import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scopeLabel,
  statusLabel,
  filterEntries,
  useEffectIndex,
  type EffectIndexFilter,
} from './useEffectIndex.js';
import type {
  EffectImplementationEntry,
  EffectImplementationIndex,
  EffectIndexEntryScope,
  EffectIndexStatus,
} from '@legendary-arena/registry/schema';

function makeEntry(overrides: Partial<EffectImplementationEntry>): EffectImplementationEntry {
  return {
    extId: 'set/card',
    name: 'A Card',
    set: 'set',
    scope: 'hero',
    mechanic: 'draw',
    status: 'executable',
    handler: '',
    wp: '',
    decision: '',
    ...overrides,
  };
}

/**
 * Builds an internally-consistent index from entries (summary tallies + the
 * per-card join are derived), so the fixture passes EffectImplementationIndexSchema.
 */
function makeIndex(entries: EffectImplementationEntry[]): EffectImplementationIndex {
  const byScope = { hero: 0, villain: 0 };
  const byStatus = { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 };
  const cards: EffectImplementationIndex['cards'] = {};
  for (const entry of entries) {
    byScope[entry.scope] += 1;
    byStatus[entry.status] += 1;
    const existing = cards[entry.extId];
    if (existing === undefined) {
      cards[entry.extId] = { scope: entry.scope, mechanics: [entry.mechanic] };
    } else if (!existing.mechanics.includes(entry.mechanic)) {
      existing.mechanics = [...existing.mechanics, entry.mechanic].sort();
    }
  }
  return {
    version: 1,
    scope: 'all',
    generatedAt: '1970-01-01T00:00:00.000Z',
    summary: { totalEntries: entries.length, byScope, byStatus },
    entries,
    cards,
  };
}

const NO_FILTER: EffectIndexFilter = {
  search: '',
  scope: 'all',
  status: 'all',
  handlerOnly: false,
};

test('scopeLabel covers every scope and throws on an unknown one', () => {
  assert.equal(scopeLabel('hero'), 'Hero');
  assert.equal(scopeLabel('villain'), 'Villain');
  assert.throws(() => scopeLabel('sidekick' as unknown as EffectIndexEntryScope));
});

test('statusLabel covers every status and throws on an unknown one', () => {
  assert.equal(statusLabel('executable'), 'Executable');
  assert.equal(statusLabel('deferred'), 'Deferred');
  assert.equal(statusLabel('condition'), 'Condition');
  assert.equal(statusLabel('unsupported'), 'Unsupported');
  assert.equal(statusLabel('unmarked'), 'Unmarked');
  assert.throws(() => statusLabel('mystery' as unknown as EffectIndexStatus));
});

test('filterEntries narrows by scope', () => {
  const entries = [
    makeEntry({ extId: 'a', scope: 'hero' }),
    makeEntry({ extId: 'b', scope: 'villain' }),
  ];
  const result = filterEntries(entries, { ...NO_FILTER, scope: 'villain' });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.extId, 'b');
});

test('filterEntries narrows by status', () => {
  const entries = [
    makeEntry({ extId: 'a', status: 'executable' }),
    makeEntry({ extId: 'b', status: 'unmarked' }),
  ];
  const result = filterEntries(entries, { ...NO_FILTER, status: 'unmarked' });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.status, 'unmarked');
});

test('filterEntries handlerOnly keeps only entries with a non-empty handler', () => {
  const entries = [
    makeEntry({ extId: 'a', handler: 'file.ts#prim' }),
    makeEntry({ extId: 'b', handler: '' }),
  ];
  const result = filterEntries(entries, { ...NO_FILTER, handlerOnly: true });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.extId, 'a');
});

test('filterEntries matches search over extId and name, case-insensitively', () => {
  const entries = [
    makeEntry({ extId: 'core/mystique', name: 'Mystique' }),
    makeEntry({ extId: 'core/hulk', name: 'Hulk' }),
  ];
  assert.equal(filterEntries(entries, { ...NO_FILTER, search: 'MYST' }).length, 1);
  assert.equal(filterEntries(entries, { ...NO_FILTER, search: 'hulk' })[0]?.name, 'Hulk');
  assert.equal(filterEntries(entries, { ...NO_FILTER, search: 'nomatch' }).length, 0);
  assert.equal(filterEntries(entries, NO_FILTER).length, 2);
});

test('useEffectIndex exposes the injected index summary, entries, and cards', () => {
  const index = makeIndex([
    makeEntry({ extId: 'core/hulk', scope: 'hero', mechanic: 'draw', status: 'executable' }),
    makeEntry({
      extId: 'core-villain-viper',
      scope: 'villain',
      mechanic: '(unmarked)',
      status: 'unmarked',
    }),
  ]);
  const view = useEffectIndex({ index });
  assert.equal(view.error, undefined);
  assert.equal(view.summary.value.totalEntries, 2);
  assert.equal(view.summary.value.byScope.hero, 1);
  assert.equal(view.summary.value.byScope.villain, 1);
  assert.equal(view.entries.value.length, 2);
  assert.equal(view.cards.value['core/hulk']?.scope, 'hero');
});

test('useEffectIndex degrades to an empty index + generic error when the index fails validation', () => {
  // A safeParse-failing object with NO `error` key (a corrupt real bundle) — the
  // injection seam feeds it through the same safeParse path, hitting the error branch.
  const bad = { version: 2 } as unknown as EffectImplementationIndex;
  const view = useEffectIndex({ index: bad });
  assert.equal(view.summary.value.totalEntries, 0);
  assert.equal(view.entries.value.length, 0);
  assert.ok(view.error && view.error.includes('could not be validated'));
});

test('useEffectIndex surfaces the raw stub error message when present', () => {
  // The build-effect-index empty stub carries a top-level `error` string that the
  // strict schema rejects; the composable reads it from the raw import.
  const stub = {
    version: 1,
    scope: 'all',
    generatedAt: '1970-01-01T00:00:00.000Z',
    summary: {
      totalEntries: 0,
      byScope: { hero: 0, villain: 0 },
      byStatus: { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 },
    },
    entries: [],
    cards: {},
    error: 'source index missing',
  } as unknown as EffectImplementationIndex;
  const view = useEffectIndex({ index: stub });
  assert.equal(view.error, 'source index missing');
  assert.equal(view.summary.value.totalEntries, 0);
});

test('useEffectIndex falls back to the bundled index when none is injected', () => {
  const view = useEffectIndex();
  // The bundled index is the real committed artifact — non-empty, both scopes present.
  assert.equal(view.error, undefined);
  assert.ok(view.summary.value.totalEntries > 0);
  assert.ok(view.summary.value.byScope.hero > 0);
  assert.ok(view.summary.value.byScope.villain > 0);
});
