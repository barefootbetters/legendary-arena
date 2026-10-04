import { computed, type ComputedRef } from 'vue';
import liveVerifyData from '../data/live-verify.json';
import type {
  LedgerRow,
  LiveVerifyEntry,
  LiveVerifyRecord,
  LiveVerifyState,
  LiveVerifySummary,
} from '../types/coverage.js';

// why: the Core playtest table groups entries in board-reading order (your heroes,
// then what you fight, then the scheme). A kind not in this list sorts last.
const KIND_ORDER: readonly string[] = ['hero', 'villain', 'henchman', 'mastermind', 'scheme'];

/**
 * Display label for a live-verify state. The exhaustive switch anchors the
 * `LiveVerifyState` union — adding a state without a case fails to compile.
 */
export function liveVerifyLabel(state: LiveVerifyState): string {
  switch (state) {
    case 'verified':
      return 'Verified';
    case 'partial':
      return 'Partial';
    case 'pending':
      return 'Not yet';
    default:
      return assertNever(state);
  }
}

/** Compile-time exhaustiveness guard for `liveVerifyLabel`. */
function assertNever(value: never): never {
  throw new Error(`Unhandled live-verify state: ${String(value)}`);
}

/** The record key a hero ledger row joins on: `<extId>|<mechanic>`. */
export function ledgerRowKey(row: Pick<LedgerRow, 'extId' | 'mechanic'>): string {
  return `${row.extId}|${row.mechanic}`;
}

/**
 * The mechanic part of an entry key (after the last `|`), or '' for a key without
 * one. Disambiguates a hero design that carries two mechanics (draw + rescue).
 */
export function entryMechanic(entry: Pick<LiveVerifyEntry, 'key'>): string {
  const separator = entry.key.lastIndexOf('|');
  if (separator === -1) {
    return '';
  }
  return entry.key.slice(separator + 1);
}

/** Indexes entries by key for the by-card join. A duplicate key keeps the first entry. */
export function buildLiveVerifyIndex(
  entries: readonly LiveVerifyEntry[],
): Record<string, LiveVerifyEntry> {
  const index: Record<string, LiveVerifyEntry> = {};
  for (const entry of entries) {
    if (index[entry.key] === undefined) {
      index[entry.key] = entry;
    }
  }
  return index;
}

/** Per-state counts over the whole record. */
export function summarizeLiveVerify(entries: readonly LiveVerifyEntry[]): LiveVerifySummary {
  const summary: LiveVerifySummary = { verified: 0, partial: 0, pending: 0, total: 0 };
  for (const entry of entries) {
    summary[entry.state] += 1;
    summary.total += 1;
  }
  return summary;
}

/** Sort rank for a kind — known kinds in board order, unknown kinds last. */
function kindRank(kind: string): number {
  const position = KIND_ORDER.indexOf(kind);
  if (position === -1) {
    return KIND_ORDER.length;
  }
  return position;
}

/** Entries in table order: kind (board order), then card, then ability. */
export function sortLiveVerifyEntries(entries: readonly LiveVerifyEntry[]): LiveVerifyEntry[] {
  const sorted = [...entries];
  sorted.sort((left, right) => {
    const kindDiff = kindRank(left.kind) - kindRank(right.kind);
    if (kindDiff !== 0) {
      return kindDiff;
    }
    const cardDiff = left.card.localeCompare(right.card);
    if (cardDiff !== 0) {
      return cardDiff;
    }
    return left.ability.localeCompare(right.ability);
  });
  return sorted;
}

interface UseLiveVerifyOptions {
  /** Injectable record. Defaults to the build-time bundled record. */
  record?: LiveVerifyRecord;
}

interface UseLiveVerifyReturn {
  entries: ComputedRef<LiveVerifyEntry[]>;
  summary: ComputedRef<LiveVerifySummary>;
  /** The entry for a hero ledger row, or undefined when the row is not tracked. */
  entryForRow: (row: Pick<LedgerRow, 'extId' | 'mechanic'>) => LiveVerifyEntry | undefined;
  error: string | undefined;
}

/**
 * Provides the hand-curated live-verify record for the Coverage page: the sorted
 * entries (Core playtest table), the per-state summary, and the by-card join used
 * by the Verified column. The bundled data is static; tests inject a fixture.
 */
export function useLiveVerify(options?: UseLiveVerifyOptions): UseLiveVerifyReturn {
  const record = options?.record ?? (liveVerifyData as unknown as LiveVerifyRecord);
  const index = buildLiveVerifyIndex(record.entries);
  return {
    entries: computed(() => sortLiveVerifyEntries(record.entries)),
    summary: computed(() => summarizeLiveVerify(record.entries)),
    entryForRow: (row) => index[ledgerRowKey(row)],
    error: record.error,
  };
}
