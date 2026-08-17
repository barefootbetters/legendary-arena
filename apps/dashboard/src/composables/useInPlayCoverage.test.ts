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

test('useInPlayCoverage credits a fixed mechanic from the committed seed', () => {
  // why (WP-561 / D-24370): with dodge flipped executable in the injected ledger (and
  // absent from live — a "fixed" mechanic that vanished from the sweep), its baseline
  // peak of 37 is credited. The TITLE no longer embeds the figures: they move whenever
  // the committed seed is rebuilt, and a title carrying stale numbers is a maintenance
  // trap (it read "dodge 37 -> 26.4%" against the pre-WP-453 14-mechanic / 140-obs seed).
  // 2026-08-16 (WP-561): the seed was rebuilt against the post-WP-453 sweep — 35
  // mechanics / 2285 obs — so the denominator is now the honest one. resolvedObs is
  // UNCHANGED at 37; percentResolved fell 26.4 -> 1.6 purely because the denominator
  // grew. Nothing became less covered. D-24050 defines the metric; D-24370 adds the
  // rebuild trigger that this staleness violated.
  const baseline = baselineSeed as unknown as InPlayHollowBaseline;
  const view = useInPlayCoverage({
    baseline,
    ledger: makeLedger([makeRow({ mechanic: 'dodge', status: 'executable' })]),
    runtimeObserved: makeRuntimeObserved({}),
  });
  assert.equal(view.totalObs.value, 2285);
  assert.equal(view.resolvedObs.value, 37);
  assert.equal(view.percentResolved.value, 1.6);
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
  // 2026-07-28: the bot-heuristic tuning (never play Wounds) shifted the fixed-seed
  // sweep — the bot now visits slightly different card instances — dropping one
  // observation (totalObs 179 -> 178, percentResolved 33.0 -> 33.1). resolvedObs is
  // unchanged (59). The committed in-play-hollow-baseline.json peak is NOT rebuilt
  // (it is a deliberate high-water reference, held at 140).
  // 2026-08-08 (WP-511): the runtime-observed coverage backdrop scheme was switched
  // from Legacy Virus to Cosmic Cube — Legacy Virus now loses on real wound-stack
  // depletion (D-24320/D-24321), which is deck-dependent and no longer terminates
  // the solo coverage sweep deterministically, so it timed out. Cosmic Cube is a
  // true twist-loss backdrop (deterministic ~twist 8). Its "wound all" twist plays
  // fewer hero abilities, so the sweep observes fewer mechanics: totalObs 178 -> 163,
  // percentResolved 33.1 -> 36.2 (resolvedObs unchanged at 59 over a smaller total).
  // 2026-08-09 (WP-512 / D-24323): the backdrop was switched again, Cosmic Cube ->
  // Portals to the Dark Dimension — a faithful true-twist-loss scheme ("Twist 7:
  // Evil Wins!", loses via the MVP fallback, no engine change) whose Dark-Portal
  // twists buff the board rather than polluting hero decks. More hero abilities fire:
  // the sweep observes 12 distinct mechanics (up from 10), so totalObs 163 -> 188
  // (above even the pre-WP-511 178), percentResolved 36.2 -> 31.4 (resolvedObs
  // unchanged at 59 over a LARGER, more honest denominator). The 140 high-water
  // baseline is still NOT rebuilt.
  // 2026-08-15 (WP-453 / D-24273, re-pin): the setup shuffle became a real seeded
  // Fisher-Yates instead of the unit-test reverse mock. buildVillainDeck sorts
  // lexically before shuffling and virtual `scheme-twist-…` ids sort LAST, so
  // reversing had stacked every twist on TOP of the villain deck and the backdrop
  // lost at or near turn 0 — the sweep was measuring games that barely played. With
  // a real shuffle the 312 games run to completion: 12 -> 31 distinct mechanics and
  // totalObs 188 -> 2285. resolvedObs is unchanged, so percentResolved falls
  // 31.4 -> 2.6 purely because the denominator is now honest. NOT a coverage
  // regression: nothing became unimplemented. The prior figure was an artifact of
  // the reverse-mock bug, and every earlier re-pin in this comment block (WP-511,
  // WP-512) was measured under it. The 140 high-water baseline is still NOT rebuilt.
  // Reaching this depth also required WP-554/D-24363 and WP-555/D-24364, which fixed
  // the two getLegalMoves<->move-guard divergences the shallow sweep had hidden.
  const view = useInPlayCoverage();
  assert.equal(view.totalObs.value, 2285);
  assert.equal(view.percentResolved.value, 2.6);
  assert.ok(view.remaining.value.length > 0);
});

test('a mechanic flipped to executable MOVES its obs into resolvedObs, denominator held', () => {
  // why (WP-561 / D-24370): THE invariant the baseline rebuild exists for, asserted
  // directly rather than inferred from a pinned snapshot constant — so the re-pinned
  // figures above cannot silently stop testing anything.
  //
  // A mechanic that gets implemented stops producing hollows and vanishes from the LIVE
  // sweep. Without a baseline entry it would drop out of BOTH sides: the denominator
  // shrinks and the work is credited nothing, so the metric would reward a fix by
  // erasing its evidence. With a baseline entry, peakObs = max(baseline, live) holds the
  // denominator steady and the obs move from unresolved into resolvedObs.
  const baseline = makeBaseline({ alpha: 100, beta: 50 });

  // Before: alpha is unsupported and still firing in the live sweep.
  const before = computeInPlayCoverage(
    baseline,
    {
      alpha: { hitCount: 100 } as RuntimeObservedEntry,
      beta: { hitCount: 50 } as RuntimeObservedEntry,
    },
    new Map<string, LedgerStatus>([
      ['alpha', 'unsupported'],
      ['beta', 'unsupported'],
    ]),
  );
  assert.equal(before.totalObs, 150, 'denominator is the summed peaks');
  assert.equal(before.resolvedObs, 0, 'nothing executable yet');

  // After: alpha ships. Status flips to executable AND its live obs disappear.
  const after = computeInPlayCoverage(
    baseline,
    { beta: { hitCount: 50 } as RuntimeObservedEntry },
    new Map<string, LedgerStatus>([
      ['alpha', 'executable'],
      ['beta', 'unsupported'],
    ]),
  );
  assert.equal(after.totalObs, 150, 'the denominator MUST hold — alpha keeps its baseline peak');
  assert.equal(after.resolvedObs, 100, "alpha's 100 obs MOVED into the numerator");
  assert.ok(after.percentResolved > before.percentResolved, 'shipping work raises the metric');
});

test('without a baseline entry a fixed mechanic is ERASED instead of credited', () => {
  // why (WP-561 / D-24370): the failure mode the rebuild prevents, pinned so a future
  // change cannot quietly reintroduce it. Same scenario as above, but alpha has no
  // baseline peak — exactly the pre-rebuild state for teleport / outwit (live 178 / 157,
  // baseline 0). The denominator shrinks by alpha's obs and the numerator gains nothing.
  const baselineWithoutAlpha = makeBaseline({ beta: 50 });

  const after = computeInPlayCoverage(
    baselineWithoutAlpha,
    { beta: { hitCount: 50 } as RuntimeObservedEntry },
    new Map<string, LedgerStatus>([
      ['alpha', 'executable'],
      ['beta', 'unsupported'],
    ]),
  );
  assert.equal(after.totalObs, 50, 'alpha vanished from the denominator');
  assert.equal(after.resolvedObs, 0, 'and was credited NOTHING — evidence erased, not rewarded');
});
