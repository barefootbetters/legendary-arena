import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInPlayCoverage, useInPlayCoverage } from './useInPlayCoverage.js';
import baselineSeed from '../data/in-play-hollow-baseline.json';
import type {
  CoverageLedger,
  InPlayHollowBaseline,
  InPlayHollowBaselineEntry,
  LedgerRow,
  LedgerStatus,
  RuntimeObservedEntry,
  RuntimeObservedHollows,
} from '../types/coverage.js';

/** Builds a baseline `byMechanic` map from a plain `{ mechanic: peakObs }` shape. */
function makeBaseline(peaks: Record<string, number>): Record<string, InPlayHollowBaselineEntry> {
  const byMechanic: Record<string, InPlayHollowBaselineEntry> = {};
  for (const [mechanic, peakObs] of Object.entries(peaks)) {
    byMechanic[mechanic] = { peakObs };
  }
  return byMechanic;
}

/** Builds a live `byMechanic` map from a plain `{ mechanic: hitCount }` shape. */
function makeLive(hits: Record<string, number>): Record<string, RuntimeObservedEntry> {
  const byMechanic: Record<string, RuntimeObservedEntry> = {};
  for (const [mechanic, hitCount] of Object.entries(hits)) {
    byMechanic[mechanic] = {
      hitCount,
      lastSeenTurn: 0,
      byReason: { 'no-handler': 0, 'unsupported-keyword': 0, 'parse-unrecognized': hitCount },
      examples: [],
    };
  }
  return byMechanic;
}

/** Builds a by-mechanic status lookup from a plain `{ mechanic: status }` shape. */
function makeStatuses(statuses: Record<string, LedgerStatus>): Map<string, LedgerStatus> {
  return new Map(Object.entries(statuses));
}

test('computeInPlayCoverage reads 0% when no mechanic is executable', () => {
  const metric = computeInPlayCoverage(
    makeBaseline({ alpha: 3, beta: 7 }),
    makeLive({}),
    makeStatuses({ alpha: 'unsupported', beta: 'unsupported' }),
  );
  assert.equal(metric.percentResolved, 0);
  assert.equal(metric.resolvedObs, 0);
  assert.equal(metric.totalObs, 10);
  // worklist: highest obs first
  assert.deepEqual(
    metric.remaining.map((entry) => entry.mechanic),
    ['beta', 'alpha'],
  );
});

test('computeInPlayCoverage takes peakObs = max(baseline, live) per mechanic', () => {
  const metric = computeInPlayCoverage(
    // live higher than baseline for "rising", baseline higher than live for "falling"
    makeBaseline({ rising: 4, falling: 10 }),
    makeLive({ rising: 12, falling: 3 }),
    makeStatuses({ rising: 'unsupported', falling: 'unsupported' }),
  );
  // 12 (max of 4,12) + 10 (max of 10,3) = 22
  assert.equal(metric.totalObs, 22);
});

test('computeInPlayCoverage credits only exactly-executable ledger statuses', () => {
  const metric = computeInPlayCoverage(
    makeBaseline({ done: 5, def: 5, uns: 5, unm: 5, absent: 5 }),
    makeLive({}),
    makeStatuses({ done: 'executable', def: 'deferred', uns: 'unsupported', unm: 'unmarked' }),
  );
  // only `done` (executable) resolves; deferred/unsupported/unmarked/ledger-absent do not
  assert.equal(metric.resolvedObs, 5);
  assert.equal(metric.totalObs, 25);
  assert.equal(metric.percentResolved, 20);
});

test('computeInPlayCoverage keeps a ledger-absent observed mechanic counted, not dropped', () => {
  const metric = computeInPlayCoverage(
    makeBaseline({ known: 6 }),
    makeLive({ ghost: 4 }),
    makeStatuses({ known: 'unsupported' }), // `ghost` has no ledger entry
  );
  // ghost stays in the denominator as unresolved (never dropped)
  assert.equal(metric.totalObs, 10);
  assert.equal(metric.resolvedObs, 0);
  assert.ok(metric.remaining.some((entry) => entry.mechanic === 'ghost' && entry.peakObs === 4));
});

test('computeInPlayCoverage adds a new live-only mechanic to the denominator as unresolved', () => {
  const metric = computeInPlayCoverage(
    makeBaseline({}),
    makeLive({ fresh: 8 }),
    makeStatuses({ fresh: 'unsupported' }),
  );
  assert.equal(metric.totalObs, 8);
  assert.equal(metric.percentResolved, 0);
  assert.deepEqual(metric.remaining, [{ mechanic: 'fresh', peakObs: 8 }]);
});

test('computeInPlayCoverage returns 0% and empty remaining when totalObs == 0', () => {
  const metric = computeInPlayCoverage(makeBaseline({}), makeLive({}), makeStatuses({}));
  assert.equal(metric.percentResolved, 0);
  assert.equal(metric.resolvedObs, 0);
  assert.equal(metric.totalObs, 0);
  assert.deepEqual(metric.remaining, []);
});

test('computeInPlayCoverage sorts remaining by peakObs desc, then mechanic key asc', () => {
  const metric = computeInPlayCoverage(
    // real ties from the seed: shatter/sunlight at 10, ambush/artifact at 1
    makeBaseline({ sunlight: 10, shatter: 10, artifact: 1, ambush: 1, dodge: 37 }),
    makeLive({}),
    makeStatuses({}), // all unresolved
  );
  assert.deepEqual(
    metric.remaining.map((entry) => entry.mechanic),
    ['dodge', 'shatter', 'sunlight', 'ambush', 'artifact'],
  );
});

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
  const byStatus = { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 };
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

test('useInPlayCoverage credits a fixed mechanic from the committed seed (dodge 37 → 26.4%)', () => {
  // The committed seed is the 14-mechanic / 140-obs denominator. With dodge flipped
  // executable in the injected ledger (and absent from live — a "fixed" mechanic that
  // vanished from the sweep), its baseline peak of 37 is credited: 37 / 140 = 26.4%.
  const baseline = baselineSeed as unknown as InPlayHollowBaseline;
  const view = useInPlayCoverage({
    baseline,
    ledger: makeLedger([makeRow({ mechanic: 'dodge', status: 'executable' })]),
    runtimeObserved: makeRuntimeObserved({}),
  });
  assert.equal(view.totalObs.value, 140);
  assert.equal(view.resolvedObs.value, 37);
  assert.equal(view.percentResolved.value, 26.4);
});

test('useInPlayCoverage reads the real committed seed + ledger and computes the in-play coverage snapshot', () => {
  // No injection: the real committed runtime-observed seed + the real hero ledger.
  // The seed is a FIXED-SEED deterministic sim sweep, so it is sensitive to engine
  // changes that alter game outcomes — D-24178 corrected scheme twist-loss timing
  // (schemes no longer resolve a twist early), which shifted the deterministic games
  // and therefore the observed-mechanic mix (the previously-credited
  // dodge/undercover/size-changing runs no longer appear in the shifted sweep).
  // This test pins the composable's output against the current committed seed:
  // totalObs (the summed hit counts) and percentResolved are the deterministic
  // snapshot, and the worklist stays non-empty (unsupported mechanics remain).
  const view = useInPlayCoverage();
  assert.equal(view.totalObs.value, 179);
  assert.equal(view.percentResolved.value, 33);
  assert.ok(view.remaining.value.length > 0);
});
