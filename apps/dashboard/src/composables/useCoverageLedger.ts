import { computed, type ComputedRef } from 'vue';
import ledgerData from '../data/coverage-ledger.json';
import runtimeObservedData from '../data/runtime-observed-hollows.json';
import setNamesData from '../data/coverage-set-names.json';
import mechanicKeyFoldData from '../data/mechanic-key-fold.json';
import type {
  CoverageLedger,
  CoverageSetName,
  CoverageSetNames,
  LedgerRow,
  LedgerStatus,
  LedgerSummary,
  MechanicEntry,
  MechanicKeyFold,
  RuntimeObservedEntry,
  RuntimeObservedHollows,
  RuntimeObservedSummary,
  SetCoverageEntry,
} from '../types/coverage.js';

// why: the unmarked sentinel mirrors the generator (`scripts/hero-mechanic-ledger.mjs`)
// — an unmarked row is a per-card DATA todo, not a mechanic, so it is excluded
// from the by-mechanic dictionary (but still counted in the summary).
const UNMARKED_MECHANIC = '(unmarked)';

/**
 * Display label for a ledger status. The exhaustive switch anchors the
 * `LedgerStatus` union — adding a status without a case fails to compile.
 */
export function statusLabel(status: LedgerStatus): string {
  switch (status) {
    case 'executable':
      return 'Executable';
    case 'deferred':
      return 'Deferred';
    case 'condition':
      return 'Condition';
    case 'unsupported':
      return 'Unsupported';
    case 'unmarked':
      return 'Unmarked';
    case 'subsystem':
      return 'Subsystem';
    default:
      return assertNever(status);
  }
}

/** Compile-time exhaustiveness guard for `statusLabel` / `statusRank`. */
function assertNever(value: never): never {
  throw new Error(`Unhandled ledger status: ${String(value)}`);
}

/**
 * Sort rank for the worklist: done states first, Unmarked (data TODO) last. Lower
 * sorts earlier. Order: Executable > Subsystem > Deferred > Condition > Unsupported
 * > Unmarked. `subsystem` (done-elsewhere) ranks alongside Executable as a done
 * state; hero rows carry it since WP-559 / D-24368 (core/spider-man's reveal-count
 * and reveal-reorder, ca75/agent-x-13's gain-officer).
 */
function statusRank(status: LedgerStatus): number {
  switch (status) {
    case 'executable':
      return 0;
    case 'subsystem':
      return 1;
    case 'deferred':
      return 2;
    case 'condition':
      return 3;
    case 'unsupported':
      return 4;
    case 'unmarked':
      return 5;
    default:
      return assertNever(status);
  }
}

/**
 * Adds one row's status to a mechanic's per-status tally, keeping the tally in
 * `statusRank` order and the entry's headline `status` at the least-done status.
 */
function tallyStatus(entry: MechanicEntry, status: LedgerStatus): void {
  const existing = entry.statusCounts.find((statusCount) => statusCount.status === status);
  if (existing === undefined) {
    entry.statusCounts.push({ status, count: 1 });
    entry.statusCounts.sort((left, right) => statusRank(left.status) - statusRank(right.status));
  } else {
    existing.count += 1;
  }
  if (statusRank(status) > statusRank(entry.status)) {
    entry.status = status;
  }
}

/**
 * Builds the by-mechanic dictionary — one entry per distinct mechanic, the
 * implementation worklist (implementing one mechanic clears every card using
 * it). Excludes the `(unmarked)` sentinel. Sorted done-first (statusRank), then
 * by card count descending, then by name.
 *
 * why: status is decided per card, not per mechanic (by-hook keywords, the
 * per-pair subsystem allowlist), so one mechanic's cards can disagree —
 * `reveal-count` is Subsystem on Core Spider-Man and Unsupported on co2e
 * Spider-Man. The entry keeps every status in `statusCounts` and headlines the
 * least-done one, so a mechanic only reads as done when all of its cards are.
 * Attribution (wp/decision/handler) comes from the first row that has it.
 */
export function buildMechanicDictionary(rows: readonly LedgerRow[]): MechanicEntry[] {
  const byMechanic = new Map<string, MechanicEntry>();
  for (const row of rows) {
    if (row.mechanic === UNMARKED_MECHANIC) {
      continue;
    }
    let entry = byMechanic.get(row.mechanic);
    if (entry === undefined) {
      entry = {
        mechanic: row.mechanic,
        status: row.status,
        statusCounts: [],
        cardCount: 0,
        wp: '',
        decision: '',
        handler: '',
      };
      byMechanic.set(row.mechanic, entry);
    }
    entry.cardCount += 1;
    tallyStatus(entry, row.status);
    if (entry.wp === '') {
      entry.wp = row.wp;
    }
    if (entry.decision === '') {
      entry.decision = row.decision;
    }
    if (entry.handler === '') {
      entry.handler = row.handler;
    }
  }

  const entries = [...byMechanic.values()];
  entries.sort((left, right) => {
    const rankDiff = statusRank(left.status) - statusRank(right.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    if (left.cardCount !== right.cardCount) {
      return right.cardCount - left.cardCount;
    }
    if (left.mechanic < right.mechanic) {
      return -1;
    }
    if (left.mechanic > right.mechanic) {
      return 1;
    }
    return 0;
  });
  return entries;
}

/**
 * Rows the engine has built: Executable + Condition + Subsystem (D-24827).
 * why: Condition rows gate on an already-shipped condition (the ledger's
 * KNOWN_CONDITIONS lists only shipped ones) and Subsystem rows are implemented
 * outside the hero-effect pipeline (D-24357), so both are done work. Deferred,
 * Unsupported and Unmarked are the to-dos and stay out of the numerator.
 */
export function implementedRowCount(summary: LedgerSummary): number {
  return (
    summary.byStatus.executable + summary.byStatus.condition + (summary.byStatus.subsystem ?? 0)
  );
}

/**
 * Implemented share of all ledger rows as a 0–100 number rounded to one decimal.
 * Zero rows yields 0 (avoids divide-by-zero on the empty-stub ledger).
 */
export function implementedPercent(ledger: CoverageLedger): number {
  return summaryImplementedPercent(ledger.summary);
}

/** `implementedPercent` for a bare summary — the set-scoped headline and By-set table. */
export function summaryImplementedPercent(summary: LedgerSummary): number {
  if (summary.totalRows === 0) {
    return 0;
  }
  return Math.round((implementedRowCount(summary) / summary.totalRows) * 1000) / 10;
}

/**
 * Rolls a set of ledger rows up into a `LedgerSummary` — the same shape the
 * generator writes for the whole ledger, so a set-scoped page reuses the
 * headline + chips unchanged. `distinctMechanics` excludes the unmarked
 * sentinel, matching the generator.
 */
export function summarizeRows(rows: readonly LedgerRow[]): LedgerSummary {
  const byStatus = {
    executable: 0,
    deferred: 0,
    condition: 0,
    unsupported: 0,
    unmarked: 0,
    subsystem: 0,
  };
  const distinctMechanics = new Set<string>();
  for (const row of rows) {
    byStatus[row.status] += 1;
    if (row.mechanic !== UNMARKED_MECHANIC) {
      distinctMechanics.add(row.mechanic);
    }
  }
  return { totalRows: rows.length, byStatus, distinctMechanics: distinctMechanics.size };
}

/** The ledger rows belonging to one set abbr, or every row for the `'all'` sentinel. */
export function filterRowsBySet(rows: readonly LedgerRow[], set: string): LedgerRow[] {
  const result = [];
  for (const row of rows) {
    if (set === 'all' || row.set === set) {
      result.push(row);
    }
  }
  return result;
}

/**
 * The By-set table: one entry per set present in the ledger, rolled up by
 * status. Ordered by the set-name table (release order), then any ledger set the
 * table does not name, alphabetically, labelled by its abbr.
 */
export function buildSetBreakdown(
  rows: readonly LedgerRow[],
  setNames: readonly CoverageSetName[],
): SetCoverageEntry[] {
  const rowsBySet = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const bucket = rowsBySet.get(row.set);
    if (bucket === undefined) {
      rowsBySet.set(row.set, [row]);
    } else {
      bucket.push(row);
    }
  }

  const orderedSets: CoverageSetName[] = [];
  for (const setName of setNames) {
    if (rowsBySet.has(setName.abbr)) {
      orderedSets.push(setName);
    }
  }
  const unnamed = [...rowsBySet.keys()].filter(
    (abbr) => !setNames.some((setName) => setName.abbr === abbr),
  );
  unnamed.sort();
  for (const abbr of unnamed) {
    orderedSets.push({ abbr, name: abbr });
  }

  const entries: SetCoverageEntry[] = [];
  for (const setName of orderedSets) {
    const summary = summarizeRows(rowsBySet.get(setName.abbr) ?? []);
    entries.push({
      abbr: setName.abbr,
      name: setName.name,
      summary,
      percentImplemented: summaryImplementedPercent(summary),
    });
  }
  return entries;
}

// why: mirrors EXAMPLES_CAP in scripts/runtime-observed-hollows.mjs, so a merged
// family entry carries no more examples than any single artifact entry does.
const MERGED_EXAMPLES_CAP = 5;

/**
 * Re-keys the runtime-observed tally from the harness's raw mechanic keys to the
 * hero ledger's mechanic keys, merging every variant of a folded family into one
 * entry. A key absent from the fold map is its own ledger key and passes through.
 *
 * why: the runtime harness records the PRE-fold slug (`patrol-the-bridge`,
 * `patrol-the-sewers`) while the ledger keys one row per family (`patrol`), so a
 * worklist row joined on the raw keys read "not observed in play" for every folded
 * family. Merge rule: hit counts and per-reason counts sum (each observation is
 * one hollow, whichever variant printed it), `lastSeenTurn` takes the max, and
 * examples concatenate in raw-key order up to the artifact's own cap.
 *
 * @param byMechanic - the runtime-observed tally keyed by raw mechanic key.
 * @param ledgerKeyByMechanic - the build-time runtime-key → ledger-key fold.
 * @returns the tally keyed by ledger mechanic.
 */
export function foldRuntimeObservedByLedgerKey(
  byMechanic: Readonly<Record<string, RuntimeObservedEntry>>,
  ledgerKeyByMechanic: Readonly<Record<string, string>>,
): Record<string, RuntimeObservedEntry> {
  const merged: Record<string, RuntimeObservedEntry> = {};
  for (const rawKey of Object.keys(byMechanic).sort()) {
    const entry = byMechanic[rawKey];
    if (entry === undefined) {
      continue;
    }
    const ledgerKey = ledgerKeyByMechanic[rawKey] ?? rawKey;
    const existing = merged[ledgerKey];
    if (existing === undefined) {
      merged[ledgerKey] = entry;
      continue;
    }
    merged[ledgerKey] = {
      hitCount: existing.hitCount + entry.hitCount,
      lastSeenTurn: Math.max(existing.lastSeenTurn, entry.lastSeenTurn),
      byReason: {
        'no-handler': existing.byReason['no-handler'] + entry.byReason['no-handler'],
        'unsupported-keyword':
          existing.byReason['unsupported-keyword'] + entry.byReason['unsupported-keyword'],
        'parse-unrecognized':
          existing.byReason['parse-unrecognized'] + entry.byReason['parse-unrecognized'],
      },
      examples: [...existing.examples, ...entry.examples].slice(0, MERGED_EXAMPLES_CAP),
    };
  }
  return merged;
}

interface UseCoverageLedgerOptions {
  /** Injectable ledger. Defaults to the build-time bundled ledger. */
  ledger?: CoverageLedger;
  /** Injectable runtime-observed overlay. Defaults to the build-time bundled artifact. */
  runtimeObserved?: RuntimeObservedHollows;
  /** Injectable runtime-key → ledger-key fold. Defaults to the build-time bundled map. */
  mechanicKeyFold?: MechanicKeyFold;
  /** Injectable set-name table. Defaults to the build-time bundled table. */
  setNames?: CoverageSetNames;
}

interface UseCoverageLedgerReturn {
  summary: ComputedRef<LedgerSummary>;
  rows: ComputedRef<readonly LedgerRow[]>;
  mechanics: ComputedRef<MechanicEntry[]>;
  percentImplemented: ComputedRef<number>;
  error: string | undefined;
  /** Runtime-observed hollow tally keyed by the harness's RAW mechanic key (WP-259). */
  runtimeObservedByMechanic: ComputedRef<Record<string, RuntimeObservedEntry>>;
  /** The same tally re-keyed to ledger mechanics (folded families merged) — the worklist join. */
  runtimeObservedByLedgerMechanic: ComputedRef<Record<string, RuntimeObservedEntry>>;
  /** The build-time runtime-key → ledger-key fold (only keys the fold rewrites). */
  ledgerKeyByMechanic: Readonly<Record<string, string>>;
  /** Run-level runtime-observed summary (seed/games provenance + roll-up). */
  runtimeObservedSummary: ComputedRef<RuntimeObservedSummary>;
  /** Per-set roll-up for the By-set table, in release order. */
  setBreakdown: ComputedRef<SetCoverageEntry[]>;
  /** Display name for a set abbr ("core" → "Core Set"); the abbr when unnamed. */
  setDisplayName: (abbr: string) => string;
}

/**
 * Provides the coverage ledger for the Coverage page: the raw rows (by-card
 * view), the by-mechanic dictionary (worklist view), the status summary, and
 * the executable percentage. The bundled data is static, so everything is
 * computed once; tests inject a fixture ledger.
 */
export function useCoverageLedger(options?: UseCoverageLedgerOptions): UseCoverageLedgerReturn {
  const ledger = options?.ledger ?? (ledgerData as unknown as CoverageLedger);
  const runtimeObserved =
    options?.runtimeObserved ?? (runtimeObservedData as unknown as RuntimeObservedHollows);
  const setNames = (options?.setNames ?? (setNamesData as unknown as CoverageSetNames)).sets;
  const ledgerKeyByMechanic = (
    options?.mechanicKeyFold ?? (mechanicKeyFoldData as unknown as MechanicKeyFold)
  ).ledgerKeyByMechanic;

  /** Looks up a set's display name, falling back to the abbr itself. */
  function setDisplayName(abbr: string): string {
    const match = setNames.find((setName: CoverageSetName) => setName.abbr === abbr);
    return match === undefined ? abbr : match.name;
  }

  return {
    setBreakdown: computed(() => buildSetBreakdown(ledger.rows, setNames)),
    setDisplayName,
    summary: computed(() => ledger.summary),
    rows: computed(() => ledger.rows),
    mechanics: computed(() => buildMechanicDictionary(ledger.rows)),
    percentImplemented: computed(() => implementedPercent(ledger)),
    error: ledger.error,
    // why: the raw-keyed tally stays for consumers that name the printed variant
    // (the in-play gauge's per-key peaks, the Architect gap intake).
    runtimeObservedByMechanic: computed(() => runtimeObserved.byMechanic),
    // why (WP-259): the worklist overlay joins each ledger mechanic row onto this
    // lookup — a present key reads its runtime-observed entry, an absent key reads
    // as "not observed in play". Folded so a family row sees its variants' hits.
    runtimeObservedByLedgerMechanic: computed(() =>
      foldRuntimeObservedByLedgerKey(runtimeObserved.byMechanic, ledgerKeyByMechanic),
    ),
    ledgerKeyByMechanic,
    runtimeObservedSummary: computed(() => runtimeObserved.summary),
  };
}
