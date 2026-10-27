import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  statusLabel,
  buildMechanicDictionary,
  executablePercent,
  summaryExecutablePercent,
  summarizeRows,
  filterRowsBySet,
  buildSetBreakdown,
  useCoverageLedger,
} from './useCoverageLedger.js';
import type {
  CoverageLedger,
  LedgerRow,
  LedgerStatus,
  RuntimeObservedEntry,
  RuntimeObservedHollows,
} from '../types/coverage.js';

function makeRow(overrides: Partial<LedgerRow>): LedgerRow {
  return {
    extId: 'set/card',
    heroName: 'A Hero',
    set: 'set',
    mechanic: 'draw',
    status: 'executable',
    wp: '',
    decision: '',
    handler: '',
    ...overrides,
  };
}

function makeLedger(rows: LedgerRow[]): CoverageLedger {
  const byStatus = {
    executable: 0,
    deferred: 0,
    condition: 0,
    unsupported: 0,
    unmarked: 0,
    subsystem: 0,
  };
  const distinct = new Set<string>();
  for (const row of rows) {
    byStatus[row.status] += 1;
    if (row.mechanic !== '(unmarked)') {
      distinct.add(row.mechanic);
    }
  }
  return {
    schemaVersion: 1,
    cardType: 'hero',
    summary: { totalRows: rows.length, byStatus, distinctMechanics: distinct.size },
    rows,
  };
}

test('statusLabel covers every status and throws on an unknown one', () => {
  assert.equal(statusLabel('executable'), 'Executable');
  assert.equal(statusLabel('deferred'), 'Deferred');
  assert.equal(statusLabel('condition'), 'Condition');
  assert.equal(statusLabel('unsupported'), 'Unsupported');
  assert.equal(statusLabel('unmarked'), 'Unmarked');
  assert.throws(() => statusLabel('mystery' as unknown as LedgerStatus));
});

test('buildMechanicDictionary groups by mechanic, counts cards, and excludes unmarked', () => {
  const rows: LedgerRow[] = [
    makeRow({ extId: 'a', mechanic: 'berserk', status: 'executable', wp: 'WP-256' }),
    makeRow({ extId: 'b', mechanic: 'berserk', status: 'executable', wp: 'WP-256' }),
    makeRow({ extId: 'c', mechanic: 'undercover', status: 'unsupported' }),
    makeRow({ extId: 'd', mechanic: '(unmarked)', status: 'unmarked' }),
  ];
  const dict = buildMechanicDictionary(rows);

  // unmarked excluded → two distinct mechanics
  assert.equal(dict.length, 2);
  // worklist sort: executable before unsupported
  assert.equal(dict[0]?.mechanic, 'berserk');
  assert.equal(dict[0]?.status, 'executable');
  const undercover = dict.find((entry) => entry.mechanic === 'undercover');
  assert.equal(undercover?.status, 'unsupported');
  assert.equal(dict.find((entry) => entry.mechanic === 'berserk')?.cardCount, 2);
  assert.equal(dict.find((entry) => entry.mechanic === 'berserk')?.wp, 'WP-256');
});

test('buildMechanicDictionary sorts same-status entries by card count then name', () => {
  const rows: LedgerRow[] = [
    makeRow({ extId: 'a', mechanic: 'small', status: 'unsupported' }),
    makeRow({ extId: 'b', mechanic: 'big', status: 'unsupported' }),
    makeRow({ extId: 'c', mechanic: 'big', status: 'unsupported' }),
  ];
  const dict = buildMechanicDictionary(rows);
  assert.equal(dict[0]?.mechanic, 'big'); // higher count first
  assert.equal(dict[1]?.mechanic, 'small');
});

test('executablePercent computes a rounded share and handles an empty ledger', () => {
  const ledger = makeLedger([
    makeRow({ extId: 'a', status: 'executable' }),
    makeRow({ extId: 'b', status: 'unsupported', mechanic: 'x' }),
    makeRow({ extId: 'c', status: 'unsupported', mechanic: 'y' }),
    makeRow({ extId: 'd', status: 'unsupported', mechanic: 'z' }),
  ]);
  assert.equal(executablePercent(ledger), 25); // 1/4
  assert.equal(executablePercent(makeLedger([])), 0);
});

test('useCoverageLedger exposes the injected ledger summary + mechanic dictionary', () => {
  const ledger = makeLedger([
    makeRow({ extId: 'a', mechanic: 'berserk', status: 'executable' }),
    makeRow({ extId: 'b', mechanic: 'undercover', status: 'unsupported' }),
  ]);
  const view = useCoverageLedger({ ledger });
  assert.equal(view.summary.value.totalRows, 2);
  assert.equal(view.percentExecutable.value, 50);
  assert.equal(view.mechanics.value.length, 2);
  assert.equal(view.rows.value.length, 2);
});

test('useCoverageLedger falls back to the bundled ledger when none is injected', () => {
  const view = useCoverageLedger();
  // The bundled ledger is the real hero ledger — non-empty, hero card type.
  assert.ok(view.summary.value.totalRows > 0);
  assert.ok(view.mechanics.value.length > 0);
});

function makeRuntimeObserved(
  byMechanic: Record<string, RuntimeObservedEntry>,
): RuntimeObservedHollows {
  return {
    schemaVersion: 1,
    generatedFrom: { runSeed: 'test-seed', gamesPlayed: 1, matrixDescription: 'test matrix' },
    summary: {
      distinctMechanics: Object.keys(byMechanic).length,
      totalObservations: 0,
      hollowEffectsDropped: 0,
      byReason: { 'no-handler': 0, 'unsupported-keyword': 0, 'parse-unrecognized': 0 },
    },
    byMechanic,
  };
}

test('useCoverageLedger joins the runtime-observed overlay by mechanic key (present / absent)', () => {
  const ledger = makeLedger([
    makeRow({ extId: 'a', mechanic: 'phase', status: 'unsupported' }),
    makeRow({ extId: 'b', mechanic: 'berserk', status: 'executable' }),
  ]);
  const runtimeObserved = makeRuntimeObserved({
    phase: {
      hitCount: 3,
      lastSeenTurn: 7,
      byReason: { 'no-handler': 3, 'unsupported-keyword': 0, 'parse-unrecognized': 0 },
      examples: [{ cardId: 'wwhk/korg', cardType: 'hero', timing: 'onPlay', reason: 'no-handler' }],
    },
  });
  const view = useCoverageLedger({ ledger, runtimeObserved });

  // present: a mechanic in the artifact reads its runtime-observed entry by key
  const observed = view.runtimeObservedByMechanic.value['phase'];
  assert.equal(observed?.hitCount, 3);
  assert.equal(observed?.lastSeenTurn, 7);
  assert.equal(observed?.byReason['no-handler'], 3);
  // absent: a mechanic NOT in the artifact reads as none ("not observed in play")
  assert.equal(view.runtimeObservedByMechanic.value['berserk'], undefined);
  // the run-level summary is exposed for the page header
  assert.equal(view.runtimeObservedSummary.value.distinctMechanics, 1);
});

test('useCoverageLedger falls back to the bundled runtime-observed artifact when none is injected', () => {
  const view = useCoverageLedger();
  // The bundled artifact is the real one — byMechanic is a record (possibly empty
  // when the committed sweep observed no runtime hollows), summary is present.
  assert.equal(typeof view.runtimeObservedByMechanic.value, 'object');
  assert.ok(view.runtimeObservedSummary.value.distinctMechanics >= 0);
});

test('summarizeRows matches the generator summary shape and excludes unmarked from distinct mechanics', () => {
  const rows = [
    makeRow({ extId: 'a', mechanic: 'draw', status: 'executable' }),
    makeRow({ extId: 'b', mechanic: 'draw', status: 'executable' }),
    makeRow({ extId: 'c', mechanic: 'focus', status: 'unsupported' }),
    makeRow({ extId: 'd', mechanic: '(unmarked)', status: 'unmarked' }),
  ];
  assert.deepEqual(summarizeRows(rows), makeLedger(rows).summary);
  assert.equal(summarizeRows(rows).distinctMechanics, 2);
  assert.equal(summaryExecutablePercent(summarizeRows(rows)), 50);
  assert.equal(summaryExecutablePercent(summarizeRows([])), 0);
});

test('filterRowsBySet keeps one set, and every row for the all sentinel', () => {
  const rows = [
    makeRow({ extId: 'core/a', set: 'core' }),
    makeRow({ extId: 'dkcy/b', set: 'dkcy' }),
    makeRow({ extId: 'core/c', set: 'core' }),
  ];
  assert.deepEqual(
    filterRowsBySet(rows, 'core').map((row) => row.extId),
    ['core/a', 'core/c'],
  );
  assert.equal(filterRowsBySet(rows, 'all').length, 3);
  assert.equal(filterRowsBySet(rows, 'nope').length, 0);
});

test('buildSetBreakdown rolls up per set in name-table order, unnamed sets last by abbr', () => {
  const rows = [
    makeRow({ extId: 'zzz/a', set: 'zzz', status: 'unsupported' }),
    makeRow({ extId: 'dkcy/a', set: 'dkcy', status: 'unsupported' }),
    makeRow({ extId: 'core/a', set: 'core', status: 'executable' }),
    makeRow({ extId: 'core/b', set: 'core', status: 'unsupported', mechanic: 'focus' }),
    makeRow({ extId: 'aaa/a', set: 'aaa', status: 'executable' }),
  ];
  const setNames = [
    { abbr: 'core', name: 'Core Set' },
    { abbr: 'gone', name: 'A set with no ledger rows' },
    { abbr: 'dkcy', name: 'Dark City' },
  ];
  const breakdown = buildSetBreakdown(rows, setNames);
  assert.deepEqual(
    breakdown.map((entry) => `${entry.abbr}:${entry.name}`),
    ['core:Core Set', 'dkcy:Dark City', 'aaa:aaa', 'zzz:zzz'],
  );
  const [core, darkCity] = breakdown;
  assert.ok(core !== undefined && darkCity !== undefined);
  assert.equal(core.summary.totalRows, 2);
  assert.equal(core.summary.byStatus.executable, 1);
  assert.equal(core.percentExecutable, 50);
  assert.equal(darkCity.percentExecutable, 0);
});

test('useCoverageLedger exposes the set breakdown and set display names', () => {
  const ledger = makeLedger([
    makeRow({ extId: 'core/a', set: 'core' }),
    makeRow({ extId: 'dkcy/a', set: 'dkcy', status: 'unsupported' }),
  ]);
  const view = useCoverageLedger({
    ledger,
    setNames: { sets: [{ abbr: 'core', name: 'Core Set' }] },
  });
  assert.deepEqual(
    view.setBreakdown.value.map((entry) => entry.abbr),
    ['core', 'dkcy'],
  );
  assert.equal(view.setDisplayName('core'), 'Core Set');
  assert.equal(view.setDisplayName('dkcy'), 'dkcy');
});

test('the bundled ledger rolls up to one breakdown entry per set, summing to the whole ledger', () => {
  const view = useCoverageLedger();
  let totalRows = 0;
  for (const entry of view.setBreakdown.value) {
    totalRows += entry.summary.totalRows;
  }
  assert.equal(totalRows, view.summary.value.totalRows);
  assert.deepEqual(summarizeRows(view.rows.value), view.summary.value);
});

test('buildMechanicDictionary keeps every status of a mixed mechanic and headlines the least-done', () => {
  const rows: LedgerRow[] = [
    makeRow({ extId: 'co2e/a', mechanic: 'reveal-count', status: 'unsupported' }),
    makeRow({
      extId: 'core/a',
      mechanic: 'reveal-count',
      status: 'subsystem',
      wp: 'WP-478',
      decision: 'D-24514',
      handler: 'setup:reveal-count-modifier',
    }),
    makeRow({ extId: 'x/a', mechanic: 'transform', status: 'executable' }),
    makeRow({ extId: 'x/b', mechanic: 'transform', status: 'unsupported' }),
    makeRow({ extId: 'x/c', mechanic: 'transform', status: 'unsupported' }),
    makeRow({ extId: 'x/d', mechanic: 'draw', status: 'executable' }),
  ];
  const dict = buildMechanicDictionary(rows);

  const revealCount = dict.find((entry) => entry.mechanic === 'reveal-count');
  assert.equal(revealCount?.status, 'unsupported');
  assert.deepEqual(revealCount?.statusCounts, [
    { status: 'subsystem', count: 1 },
    { status: 'unsupported', count: 1 },
  ]);
  // attribution comes from the first row that has it, not the first row seen
  assert.equal(revealCount?.wp, 'WP-478');
  assert.equal(revealCount?.decision, 'D-24514');
  assert.equal(revealCount?.handler, 'setup:reveal-count-modifier');

  const transform = dict.find((entry) => entry.mechanic === 'transform');
  assert.equal(transform?.status, 'unsupported');
  assert.deepEqual(transform?.statusCounts, [
    { status: 'executable', count: 1 },
    { status: 'unsupported', count: 2 },
  ]);

  const draw = dict.find((entry) => entry.mechanic === 'draw');
  assert.deepEqual(draw?.statusCounts, [{ status: 'executable', count: 1 }]);
  // a mixed mechanic sorts with its least-done status, after the fully done one
  assert.equal(dict[0]?.mechanic, 'draw');
});
