import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardTypeLabel,
  summarizeEntries,
  filterEntriesBySet,
  buildCardTypeBreakdown,
  formatCardTypeLine,
  buildAllTypesSetBreakdown,
  cardCoverageLine,
  useCardCoverage,
} from './useCardCoverage.js';
import {
  implementedRowCount,
  summarizeRows,
  summaryImplementedPercent,
} from './useCoverageLedger.js';
import {
  EFFECT_INDEX_ENTRY_SCOPES,
  type EffectImplementationEntry,
  type EffectImplementationIndex,
  type EffectIndexEntryScope,
} from '@legendary-arena/registry/schema';
import type { CoverageSetNames, LedgerRow } from '../types/coverage.js';

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
  const byScope = { hero: 0, villain: 0, mastermind: 0, scheme: 0 };
  const byStatus = {
    executable: 0,
    deferred: 0,
    condition: 0,
    unsupported: 0,
    unmarked: 0,
    subsystem: 0,
  };
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

// The shared hero fixture: every status, a mechanic on two cards, and an `(unmarked)`
// row (counted in totals, excluded from distinct mechanics).
const HERO_LEDGER_ROWS: LedgerRow[] = [
  {
    extId: 'core/a',
    heroName: 'Hero A',
    set: 'core',
    mechanic: 'draw',
    status: 'executable',
    wp: 'WP-1',
    decision: 'D-1',
    handler: 'h#1',
  },
  {
    extId: 'core/b',
    heroName: 'Hero B',
    set: 'core',
    mechanic: 'draw',
    status: 'executable',
    wp: '',
    decision: '',
    handler: '',
  },
  {
    extId: 'core/b',
    heroName: 'Hero B',
    set: 'core',
    mechanic: 'rescue',
    status: 'condition',
    wp: '',
    decision: '',
    handler: '',
  },
  {
    extId: 'dkcy/c',
    heroName: 'Hero C',
    set: 'dkcy',
    mechanic: 'reveal-count',
    status: 'subsystem',
    wp: '',
    decision: '',
    handler: '',
  },
  {
    extId: 'dkcy/c',
    heroName: 'Hero C',
    set: 'dkcy',
    mechanic: 'teleport',
    status: 'deferred',
    wp: '',
    decision: '',
    handler: '',
  },
  {
    extId: 'dkcy/d',
    heroName: 'Hero D',
    set: 'dkcy',
    mechanic: 'berserk',
    status: 'unsupported',
    wp: '',
    decision: '',
    handler: '',
  },
  {
    extId: 'dkcy/e',
    heroName: 'Hero E',
    set: 'dkcy',
    mechanic: '(unmarked)',
    status: 'unmarked',
    wp: '',
    decision: '',
    handler: '',
  },
];

/** The index's hero-scope transform of a ledger row (WP-484: the rows one for one). */
function heroEntryFromRow(row: LedgerRow): EffectImplementationEntry {
  return makeEntry({
    extId: row.extId,
    name: row.heroName,
    set: row.set,
    scope: 'hero',
    mechanic: row.mechanic,
    status: row.status,
    handler: row.handler,
    wp: row.wp,
    decision: row.decision,
  });
}

const HERO_ENTRIES = HERO_LEDGER_ROWS.map(heroEntryFromRow);

const NON_HERO_ENTRIES: EffectImplementationEntry[] = [
  makeEntry({
    extId: 'core/villain-a',
    set: 'core',
    scope: 'villain',
    mechanic: 'ambush',
    status: 'executable',
  }),
  makeEntry({
    extId: 'core/henchman-a',
    set: 'core',
    scope: 'villain',
    mechanic: 'fight',
    status: 'subsystem',
  }),
  makeEntry({
    extId: 'core/mm-a',
    set: 'core',
    scope: 'mastermind',
    mechanic: 'master-strike',
    status: 'executable',
  }),
  makeEntry({
    extId: 'core/scheme-a',
    set: 'core',
    scope: 'scheme',
    mechanic: 'twist',
    status: 'executable',
  }),
  makeEntry({
    extId: 'core/scheme-a',
    set: 'core',
    scope: 'scheme',
    mechanic: 'special-rules',
    status: 'deferred',
  }),
  makeEntry({
    extId: 'dkcy/scheme-b',
    set: 'dkcy',
    scope: 'scheme',
    mechanic: 'twist',
    status: 'unmarked',
  }),
  makeEntry({
    extId: 'dkcy/scheme-b',
    set: 'dkcy',
    scope: 'scheme',
    mechanic: 'evil-wins',
    status: 'unmarked',
  }),
];

const ALL_ENTRIES = [...HERO_ENTRIES, ...NON_HERO_ENTRIES];

const SET_NAMES: CoverageSetNames = {
  sets: [
    { abbr: 'core', name: 'Core Set' },
    { abbr: 'dkcy', name: 'Dark City' },
  ],
};

test('hero-scope parity: summarizeEntries over hero entries deep-equals summarizeRows over the ledger rows', () => {
  const heroScope = ALL_ENTRIES.filter((entry) => entry.scope === 'hero');
  assert.deepEqual(summarizeEntries(heroScope), summarizeRows(HERO_LEDGER_ROWS));
  for (const set of ['core', 'dkcy']) {
    const setEntries = filterEntriesBySet(heroScope, set);
    const setRows = HERO_LEDGER_ROWS.filter((row) => row.set === set);
    assert.deepEqual(summarizeEntries(setEntries), summarizeRows(setRows));
    assert.equal(
      summaryImplementedPercent(summarizeEntries(setEntries)),
      summaryImplementedPercent(summarizeRows(setRows)),
    );
  }
});

test('summarizeEntries counts every status and excludes the unmarked sentinel from distinct abilities', () => {
  const summary = summarizeEntries(ALL_ENTRIES);
  assert.equal(summary.totalRows, ALL_ENTRIES.length);
  const distinct = new Set(
    ALL_ENTRIES.filter((entry) => entry.mechanic !== '(unmarked)').map((entry) => entry.mechanic),
  );
  assert.equal(summary.distinctMechanics, distinct.size);
  let statusTotal = 0;
  for (const count of Object.values(summary.byStatus)) {
    statusTotal += count;
  }
  assert.equal(statusTotal, summary.totalRows);
  assert.deepEqual(summarizeEntries([]), summarizeRows([]));
});

test('every percent goes through D-24827: unmarked, deferred and unsupported Schemes are to-dos', () => {
  const schemes = ALL_ENTRIES.filter((entry) => entry.scope === 'scheme');
  const summary = summarizeEntries(schemes);
  const done = schemes.filter(
    (entry) =>
      entry.status === 'executable' || entry.status === 'condition' || entry.status === 'subsystem',
  ).length;
  assert.equal(implementedRowCount(summary), done);
  assert.ok(done < schemes.length, 'the fixture carries undone Scheme rows');
  assert.ok(summaryImplementedPercent(summary) < 100);
});

test('cardTypeLabel returns the plural labels and throws on an unknown scope', () => {
  assert.equal(cardTypeLabel('hero'), 'Heroes');
  assert.equal(cardTypeLabel('villain'), 'Villains & Henchmen');
  assert.equal(cardTypeLabel('mastermind'), 'Masterminds');
  assert.equal(cardTypeLabel('scheme'), 'Schemes');
  for (const scope of EFFECT_INDEX_ENTRY_SCOPES) {
    assert.notEqual(cardTypeLabel(scope), '');
  }
  assert.throws(() => cardTypeLabel('bogus' as unknown as EffectIndexEntryScope));
});

test('buildCardTypeBreakdown follows EFFECT_INDEX_ENTRY_SCOPES order and omits empty types', () => {
  const coreBreakdown = buildCardTypeBreakdown(filterEntriesBySet(ALL_ENTRIES, 'core'));
  const expectedOrder = EFFECT_INDEX_ENTRY_SCOPES.filter((scope) =>
    ALL_ENTRIES.some((entry) => entry.set === 'core' && entry.scope === scope),
  );
  assert.deepEqual(
    coreBreakdown.map((typeCoverage) => typeCoverage.scope),
    expectedOrder,
  );
  for (const typeCoverage of coreBreakdown) {
    const scopeEntries = ALL_ENTRIES.filter(
      (entry) => entry.set === 'core' && entry.scope === typeCoverage.scope,
    );
    assert.equal(typeCoverage.total, scopeEntries.length);
    assert.equal(typeCoverage.implemented, implementedRowCount(summarizeEntries(scopeEntries)));
    assert.equal(typeCoverage.label, cardTypeLabel(typeCoverage.scope));
  }

  // dkcy has no villain or mastermind entries, so neither appears.
  const dkcyScopes = buildCardTypeBreakdown(filterEntriesBySet(ALL_ENTRIES, 'dkcy')).map(
    (typeCoverage) => typeCoverage.scope,
  );
  assert.deepEqual(dkcyScopes, ['hero', 'scheme']);
  assert.deepEqual(buildCardTypeBreakdown([]), []);
});

test('formatCardTypeLine renders label implemented/total joined by a middle dot', () => {
  const line = formatCardTypeLine([
    { scope: 'hero', label: 'Heroes', implemented: 2, total: 3 },
    { scope: 'scheme', label: 'Schemes', implemented: 0, total: 4 },
  ]);
  assert.equal(line, 'Heroes 2/3 · Schemes 0/4');
  assert.equal(formatCardTypeLine([]), '');
});

test('buildAllTypesSetBreakdown rolls up every type per set in release order, unnamed sets last', () => {
  const entries = [
    makeEntry({ extId: 'zzzz/x', set: 'zzzz', scope: 'scheme', status: 'unmarked' }),
    ...ALL_ENTRIES,
  ];
  const breakdown = buildAllTypesSetBreakdown(entries, SET_NAMES.sets);
  assert.deepEqual(
    breakdown.map((setEntry) => [setEntry.abbr, setEntry.name]),
    [
      ['core', 'Core Set'],
      ['dkcy', 'Dark City'],
      ['zzzz', 'zzzz'],
    ],
  );
  for (const setEntry of breakdown) {
    const setEntries = filterEntriesBySet(entries, setEntry.abbr);
    assert.deepEqual(setEntry.summary, summarizeEntries(setEntries));
    assert.equal(setEntry.percentImplemented, summaryImplementedPercent(setEntry.summary));
    assert.deepEqual(setEntry.byType, buildCardTypeBreakdown(setEntries));
  }
});

test('the all-types percent of a set with unaudited Schemes is below its hero-only percent', () => {
  const dkcyAll = summarizeEntries(filterEntriesBySet(ALL_ENTRIES, 'dkcy'));
  const dkcyHero = summarizeRows(HERO_LEDGER_ROWS.filter((row) => row.set === 'dkcy'));
  assert.ok(summaryImplementedPercent(dkcyAll) < summaryImplementedPercent(dkcyHero));
});

test('cardCoverageLine reads the locked /vision text, and is dropped when the index errors', () => {
  const summary = summarizeEntries(ALL_ENTRIES);
  assert.equal(
    cardCoverageLine(summary, undefined),
    `${summaryImplementedPercent(summary)}% card abilities implemented · ${summary.byStatus.unsupported} unsupported`,
  );
  assert.equal(cardCoverageLine(summary, 'Effect index failed.'), undefined);
});

test('useCardCoverage exposes the injected index across every card type', () => {
  const view = useCardCoverage({ index: makeIndex(ALL_ENTRIES), setNames: SET_NAMES });
  assert.equal(view.error, undefined);
  assert.equal(view.entries.value.length, ALL_ENTRIES.length);
  assert.deepEqual(view.summary.value, summarizeEntries(ALL_ENTRIES));
  assert.equal(view.percentImplemented.value, summaryImplementedPercent(view.summary.value));
  assert.deepEqual(view.setBreakdown.value, buildAllTypesSetBreakdown(ALL_ENTRIES, SET_NAMES.sets));
  assert.equal(view.setDisplayName('core'), 'Core Set');
  assert.equal(view.setDisplayName('zzzz'), 'zzzz');
});

test('a failing index surfaces its error and no figures, never a silent 0%', () => {
  const broken = {
    ...makeIndex(ALL_ENTRIES),
    error: 'The effect index copy failed: source file missing.',
  } as unknown as EffectImplementationIndex;
  const view = useCardCoverage({ index: broken, setNames: SET_NAMES });
  assert.equal(view.error, 'The effect index copy failed: source file missing.');
  assert.equal(view.entries.value.length, 0);
  assert.deepEqual(view.setBreakdown.value, []);
  assert.equal(cardCoverageLine(view.summary.value, view.error), undefined);
});

test('useCardCoverage defaults to the bundled index and set names', () => {
  const view = useCardCoverage();
  assert.equal(view.error, undefined);
  assert.equal(view.entries.value.length, view.summary.value.totalRows);
  const setTotal = view.setBreakdown.value.reduce(
    (total, setEntry) => total + setEntry.summary.totalRows,
    0,
  );
  assert.equal(setTotal, view.summary.value.totalRows);
});
