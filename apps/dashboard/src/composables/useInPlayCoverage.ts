import { computed, type ComputedRef } from 'vue';
import baselineData from '../data/in-play-hollow-baseline.json';
import { useCoverageLedger } from './useCoverageLedger.js';
import type {
  CoverageLedger,
  InPlayCoverageMetric,
  InPlayHollowBaseline,
  InPlayHollowBaselineEntry,
  LedgerStatus,
  RemainingMechanic,
  RuntimeObservedEntry,
  RuntimeObservedHollows,
} from '../types/coverage.js';

/**
 * Computes the obs-weighted, ledger-gated in-play coverage metric (WP-274 /
 * D-24050) from three joined-on-the-raw-mechanic-key sources: the committed
 * baseline peaks, the live runtime-observed tallies, and the hero ledger's
 * by-mechanic statuses. Pure and independently testable — the composable wires
 * the bundled/injected data into it.
 *
 * @param baselineByMechanic - the committed frozen peak per mechanic.
 * @param liveByMechanic - the live sweep tally per mechanic (`hitCount`).
 * @param statusByMechanic - the hero ledger's by-mechanic status lookup.
 * @returns the computed metric (percentResolved, resolvedObs, totalObs, remaining).
 */
export function computeInPlayCoverage(
  baselineByMechanic: Readonly<Record<string, InPlayHollowBaselineEntry>>,
  liveByMechanic: Readonly<Record<string, RuntimeObservedEntry>>,
  statusByMechanic: ReadonlyMap<string, LedgerStatus>,
): InPlayCoverageMetric {
  // why (D-24050): the metric is OBS-WEIGHTED — it weights each mechanic by its
  // runtime-observed in-play hollow count (player impact), not by mechanic count
  // like the `%-executable` headline. Join on the raw mechanic key across all
  // three sources (no lowercasing/slugifying — re-casing would break the join).
  const mechanics = new Set<string>([
    ...Object.keys(baselineByMechanic),
    ...Object.keys(liveByMechanic),
  ]);

  let totalObs = 0;
  let resolvedObs = 0;
  const remaining: RemainingMechanic[] = [];

  for (const mechanic of mechanics) {
    const baselineObs = baselineByMechanic[mechanic]?.peakObs ?? 0;
    const liveObs = liveByMechanic[mechanic]?.hitCount ?? 0;
    // why (D-24050): peakObs = max(baseline, live) — the committed baseline
    // preserves a fixed mechanic's obs after it vanishes from the live artifact;
    // the max with live auto-adds any newly-observed mechanic to the denominator.
    const peakObs = Math.max(baselineObs, liveObs);
    totalObs += peakObs;

    // why (D-24050): ledger-gated resolution — a mechanic's obs count as resolved
    // iff its hero-ledger status is exactly `executable`, NOT iff its live obs
    // dropped (the sweep is a sample; a 0-obs run is not a fix). `deferred` /
    // `unsupported` / `unmarked` / ledger-absent are all unresolved.
    const isResolved = statusByMechanic.get(mechanic) === 'executable';
    if (isResolved) {
      resolvedObs += peakObs;
    } else {
      // why (D-24050): a baseline/live mechanic absent from the ledger has no
      // status, so it is unresolved — but it STAYS counted in totalObs (pushed to
      // the worklist), never dropped (dropping shrinks the denominator and
      // inflates the %, the exact fraud this metric exists to block).
      remaining.push({ mechanic, peakObs });
    }
  }

  // Deterministic worklist order: highest obs first, then mechanic key ascending
  // as a stable tie-break (the data has real ties, e.g. shatter/sunlight at 10).
  remaining.sort((left, right) => {
    if (left.peakObs !== right.peakObs) {
      return right.peakObs - left.peakObs;
    }
    if (left.mechanic < right.mechanic) {
      return -1;
    }
    if (left.mechanic > right.mechanic) {
      return 1;
    }
    return 0;
  });

  let percentResolved = 0;
  if (totalObs > 0) {
    percentResolved = Math.round((resolvedObs / totalObs) * 1000) / 10;
  }

  return { percentResolved, resolvedObs, totalObs, remaining };
}

interface UseInPlayCoverageOptions {
  /** Injectable committed baseline. Defaults to the build-time bundled seed. */
  baseline?: InPlayHollowBaseline;
  /** Injectable ledger (forwarded to `useCoverageLedger`). Defaults to bundled. */
  ledger?: CoverageLedger;
  /** Injectable runtime-observed overlay (forwarded). Defaults to bundled. */
  runtimeObserved?: RuntimeObservedHollows;
}

interface UseInPlayCoverageReturn {
  percentResolved: ComputedRef<number>;
  resolvedObs: ComputedRef<number>;
  totalObs: ComputedRef<number>;
  remaining: ComputedRef<readonly RemainingMechanic[]>;
}

/**
 * Provides the in-play coverage metric for the Coverage page: the second
 * headline beside `%-executable`. Obs-weighted (each unsupported mechanic
 * contributes its observed in-play hollow count) and ledger-gated (a mechanic
 * resolves only when its hero-ledger status is `executable`). Reads the
 * committed baseline seed plus the existing ledger + runtime-observed join from
 * `useCoverageLedger`; the bundled data is static, so it computes once. Tests
 * inject fixtures.
 */
export function useInPlayCoverage(options?: UseInPlayCoverageOptions): UseInPlayCoverageReturn {
  const baseline = options?.baseline ?? (baselineData as unknown as InPlayHollowBaseline);
  // why: build the forwarded options without undefined keys — the dashboard
  // tsconfig uses exactOptionalPropertyTypes, so an explicit `undefined` is not
  // assignable to `useCoverageLedger`'s optional `ledger` / `runtimeObserved`.
  const ledgerOptions: { ledger?: CoverageLedger; runtimeObserved?: RuntimeObservedHollows } = {};
  if (options?.ledger !== undefined) {
    ledgerOptions.ledger = options.ledger;
  }
  if (options?.runtimeObserved !== undefined) {
    ledgerOptions.runtimeObserved = options.runtimeObserved;
  }
  const { mechanics, runtimeObservedByMechanic } = useCoverageLedger(ledgerOptions);

  const metric = computed(() => {
    // The hero ledger's by-mechanic status lookup — the resolution source of
    // truth. `mechanics` is `useCoverageLedger`'s by-mechanic dictionary (the
    // same one the worklist table reads), keyed by the raw mechanic string.
    const statusByMechanic = new Map<string, LedgerStatus>();
    for (const entry of mechanics.value) {
      statusByMechanic.set(entry.mechanic, entry.status);
    }
    return computeInPlayCoverage(
      baseline.byMechanic,
      runtimeObservedByMechanic.value,
      statusByMechanic,
    );
  });

  return {
    percentResolved: computed(() => metric.value.percentResolved),
    resolvedObs: computed(() => metric.value.resolvedObs),
    totalObs: computed(() => metric.value.totalObs),
    remaining: computed(() => metric.value.remaining),
  };
}
