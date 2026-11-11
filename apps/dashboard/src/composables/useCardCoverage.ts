import { computed, type ComputedRef } from 'vue';
import setNamesData from '../data/coverage-set-names.json';
import {
  EFFECT_INDEX_ENTRY_SCOPES,
  type EffectImplementationEntry,
  type EffectImplementationIndex,
  type EffectIndexEntryScope,
} from '@legendary-arena/registry/schema';
import { implementedRowCount, summaryImplementedPercent } from './useCoverageLedger.js';
import { filterEntries, useEffectIndex } from './useEffectIndex.js';
import type {
  AllTypesSetCoverageEntry,
  CardTypeCoverage,
  CoverageSetName,
  CoverageSetNames,
  LedgerSummary,
} from '../types/coverage.js';

// why: the unmarked sentinel the hero ledger generator writes for a card with ability
// text but no mechanic tag. `summarizeRows` excludes it from `distinctMechanics`; the
// hero-scope parity test (useCardCoverage.test.ts) fails if this copy and that one
// ever disagree.
const UNMARKED_MECHANIC = '(unmarked)';

/** Compile-time exhaustiveness guard for `cardTypeLabel`. */
function assertNever(value: never): never {
  throw new Error(`Unhandled effect-index scope: ${String(value)}`);
}

/**
 * Plural display label for a card type on `/coverage`. The exhaustive switch
 * anchors the `EffectIndexEntryScope` union — a new scope without a case fails
 * to compile.
 */
export function cardTypeLabel(scope: EffectIndexEntryScope): string {
  switch (scope) {
    case 'hero':
      return 'Heroes';
    // why: the index's `villain` scope holds villains AND henchmen (it has no
    // card-type split), so the two read as one type rather than pretend to a split.
    case 'villain':
      return 'Villains & Henchmen';
    case 'mastermind':
      return 'Masterminds';
    case 'scheme':
      return 'Schemes';
    default:
      return assertNever(scope);
  }
}

/**
 * Rolls effect-index entries up into a `LedgerSummary` — the same shape
 * `summarizeRows` builds for hero ledger rows, so the headline, chips and
 * `summaryImplementedPercent` (D-24827) apply unchanged. `distinctMechanics`
 * excludes the `(unmarked)` sentinel, as `summarizeRows` does.
 */
export function summarizeEntries(entries: readonly EffectImplementationEntry[]): LedgerSummary {
  const byStatus = {
    executable: 0,
    deferred: 0,
    condition: 0,
    unsupported: 0,
    unmarked: 0,
    subsystem: 0,
  };
  const distinctMechanics = new Set<string>();
  for (const entry of entries) {
    byStatus[entry.status] += 1;
    if (entry.mechanic !== UNMARKED_MECHANIC) {
      distinctMechanics.add(entry.mechanic);
    }
  }
  return { totalRows: entries.length, byStatus, distinctMechanics: distinctMechanics.size };
}

/** The entries belonging to one set abbr, or every entry for the `'all'` sentinel. */
export function filterEntriesBySet(
  entries: readonly EffectImplementationEntry[],
  set: string,
): EffectImplementationEntry[] {
  return filterEntries(entries, {
    search: '',
    scope: 'all',
    status: 'all',
    handlerOnly: false,
    set,
  });
}

/**
 * The per-type line under the headline: one `{ scope, label, implemented, total }`
 * per card type present in the selection, in `EFFECT_INDEX_ENTRY_SCOPES` order. A
 * type with no entries is omitted (a set without Schemes shows no Schemes figure).
 *
 * why: `implemented` reuses D-24827's `implementedRowCount`, so one formula governs
 * every card type; there is no per-type copy of it.
 */
export function buildCardTypeBreakdown(
  entries: readonly EffectImplementationEntry[],
): CardTypeCoverage[] {
  const breakdown: CardTypeCoverage[] = [];
  for (const scope of EFFECT_INDEX_ENTRY_SCOPES) {
    const scopeEntries = entries.filter((entry) => entry.scope === scope);
    if (scopeEntries.length === 0) {
      continue;
    }
    breakdown.push({
      scope,
      label: cardTypeLabel(scope),
      implemented: implementedRowCount(summarizeEntries(scopeEntries)),
      total: scopeEntries.length,
    });
  }
  return breakdown;
}

/** The per-type line as text: `Heroes 25/25 · Schemes 14/14`. */
export function formatCardTypeLine(breakdown: readonly CardTypeCoverage[]): string {
  return breakdown
    .map(
      (typeCoverage) => `${typeCoverage.label} ${typeCoverage.implemented}/${typeCoverage.total}`,
    )
    .join(' · ');
}

/**
 * Orders the sets present in the index: the set-name table's release order first,
 * then any set the table does not name, alphabetically, labelled by its abbr —
 * the same order `buildSetBreakdown` uses for the hero ledger.
 */
function orderSets(
  presentAbbrs: ReadonlySet<string>,
  setNames: readonly CoverageSetName[],
): CoverageSetName[] {
  const orderedSets: CoverageSetName[] = [];
  for (const setName of setNames) {
    if (presentAbbrs.has(setName.abbr)) {
      orderedSets.push(setName);
    }
  }
  const unnamed = [...presentAbbrs].filter(
    (abbr) => !setNames.some((setName) => setName.abbr === abbr),
  );
  unnamed.sort();
  for (const abbr of unnamed) {
    orderedSets.push({ abbr, name: abbr });
  }
  return orderedSets;
}

/**
 * The all-types By-set table: one entry per set present in the index, rolled up
 * across every card type, with the per-type breakdown. Release order.
 */
export function buildAllTypesSetBreakdown(
  entries: readonly EffectImplementationEntry[],
  setNames: readonly CoverageSetName[],
): AllTypesSetCoverageEntry[] {
  const entriesBySet = new Map<string, EffectImplementationEntry[]>();
  for (const entry of entries) {
    const bucket = entriesBySet.get(entry.set);
    if (bucket === undefined) {
      entriesBySet.set(entry.set, [entry]);
    } else {
      bucket.push(entry);
    }
  }

  const result: AllTypesSetCoverageEntry[] = [];
  for (const setName of orderSets(new Set(entriesBySet.keys()), setNames)) {
    const setEntries = entriesBySet.get(setName.abbr) ?? [];
    const summary = summarizeEntries(setEntries);
    result.push({
      abbr: setName.abbr,
      name: setName.name,
      summary,
      percentImplemented: summaryImplementedPercent(summary),
      byType: buildCardTypeBreakdown(setEntries),
    });
  }
  return result;
}

/**
 * The `/vision` product-content coverage line, or `undefined` when the index
 * failed to load — the line is dropped rather than read as a silent 0%.
 */
export function cardCoverageLine(
  summary: LedgerSummary,
  error: string | undefined,
): string | undefined {
  if (error !== undefined) {
    return undefined;
  }
  const percent = summaryImplementedPercent(summary);
  return `${percent}% card abilities implemented · ${summary.byStatus.unsupported} unsupported`;
}

/** Options for `useCardCoverage`. */
export interface UseCardCoverageOptions {
  /** Injectable index (defaults to the build-time bundle). Tests inject fixtures. */
  index?: EffectImplementationIndex;
  /** Injectable set-name table. Defaults to the build-time bundled table. */
  setNames?: CoverageSetNames;
}

/** The read-only all-types coverage view `useCardCoverage` returns. */
export interface UseCardCoverageReturn {
  /** Every index entry, all card types (empty when the index failed to load). */
  entries: ComputedRef<readonly EffectImplementationEntry[]>;
  /** The all-sets, all-types summary. */
  summary: ComputedRef<LedgerSummary>;
  /** The all-sets, all-types implemented percent (D-24827). */
  percentImplemented: ComputedRef<number>;
  /** Per-set all-types roll-up for the By-set table, in release order. */
  setBreakdown: ComputedRef<AllTypesSetCoverageEntry[]>;
  /** Display name for a set abbr ("core" → "Core Set"); the abbr when unnamed. */
  setDisplayName: (abbr: string) => string;
  /** The index load-error message, when the bundle failed to validate. */
  error: string | undefined;
}

/**
 * Provides `/coverage`'s all-card-types figures (WP-880 / D-24829) over the
 * bundled effect-implementation index: every Hero, Villain & Henchman, Mastermind
 * and Scheme entry, counted with D-24827's formula. The data is static, so every
 * figure is computed once; tests inject a fixture index.
 */
export function useCardCoverage(options?: UseCardCoverageOptions): UseCardCoverageReturn {
  const effectIndex = useEffectIndex(
    options?.index === undefined ? undefined : { index: options.index },
  );
  const setNames = (options?.setNames ?? (setNamesData as unknown as CoverageSetNames)).sets;
  const summary = computed(() => summarizeEntries(effectIndex.entries.value));

  /** Looks up a set's display name, falling back to the abbr itself. */
  function setDisplayName(abbr: string): string {
    const match = setNames.find((setName: CoverageSetName) => setName.abbr === abbr);
    return match === undefined ? abbr : match.name;
  }

  return {
    entries: effectIndex.entries,
    summary,
    percentImplemented: computed(() => summaryImplementedPercent(summary.value)),
    setBreakdown: computed(() => buildAllTypesSetBreakdown(effectIndex.entries.value, setNames)),
    setDisplayName,
    error: effectIndex.error,
  };
}
