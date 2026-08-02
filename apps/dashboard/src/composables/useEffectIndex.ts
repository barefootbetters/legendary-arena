import { computed, type ComputedRef } from 'vue';
// why: the bundled index is a build-time static import (the `/coverage` precedent,
// build-effect-index.mjs copies it into gitignored src/data) — the dashboard cannot
// statically import a file outside its own package root, so it is copied in.
import indexData from '../data/effect-implementation-index.json';
// why: the schema + inferred types come from the browser-safe `@legendary-arena/registry/schema`
// subpath, NEVER the registry barrel (which pulls Node built-ins and breaks the Vite
// build) and NEVER the game engine. The dashboard renders the index verbatim; it reuses
// WP-484's contract rather than re-deriving one (no second parser).
import {
  EffectImplementationIndexSchema,
  type EffectImplementationIndex,
  type EffectImplementationEntry,
  type EffectImplementationSummary,
  type EffectIndexEntryScope,
  type EffectIndexStatus,
} from '@legendary-arena/registry/schema';

/** The scope filter value: a concrete scope or the "all" sentinel. */
export type ScopeFilter = EffectIndexEntryScope | 'all';
/** The status filter value: a concrete status or the "all" sentinel. */
export type StatusFilter = EffectIndexStatus | 'all';

/** The empty-index fallback rendered when the bundle fails to validate. */
const EMPTY_INDEX: EffectImplementationIndex = {
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
};

const GENERIC_LOAD_ERROR =
  'The effect-implementation index bundle could not be validated; showing an empty index. ' +
  'Regenerate it with "pnpm --filter @legendary-arena/dashboard prebuild:effect-index".';

/** Compile-time exhaustiveness guard for the label switches. */
function assertNever(value: never): never {
  throw new Error(`Unhandled effect-index value: ${String(value)}`);
}

/**
 * Display label for an entry scope. The exhaustive switch anchors the
 * `EffectIndexEntryScope` union — adding a scope without a case fails to compile.
 */
export function scopeLabel(scope: EffectIndexEntryScope): string {
  switch (scope) {
    case 'hero':
      return 'Hero';
    case 'villain':
      return 'Villain';
    default:
      return assertNever(scope);
  }
}

/**
 * Display label for an entry status. The exhaustive switch anchors the
 * `EffectIndexStatus` union — adding a status without a case fails to compile.
 */
export function statusLabel(status: EffectIndexStatus): string {
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
    default:
      return assertNever(status);
  }
}

/** The filter criteria the page drives; all four narrow the entry list. */
export interface EffectIndexFilter {
  /** Free-text match over `extId` + `name` (case-insensitive; blank matches all). */
  search: string;
  /** Restrict to one scope, or "all". */
  scope: ScopeFilter;
  /** Restrict to one status, or "all". */
  status: StatusFilter;
  /** When true, keep only entries whose `handler` is non-empty (a handler ran). */
  handlerOnly: boolean;
}

/**
 * Filters the entries by the four criteria. Pure and side-effect-free — it reads
 * the index verbatim and computes no new provenance, so it is testable in
 * isolation and drives the page's search/filter without a second data source.
 *
 * @param entries - the index entries (rendered verbatim).
 * @param filter - the active filter criteria.
 * @returns the entries matching every active criterion, in input order.
 */
export function filterEntries(
  entries: readonly EffectImplementationEntry[],
  filter: EffectIndexFilter,
): EffectImplementationEntry[] {
  const needle = filter.search.trim().toLowerCase();
  const result: EffectImplementationEntry[] = [];
  for (const entry of entries) {
    if (filter.scope !== 'all' && entry.scope !== filter.scope) {
      continue;
    }
    if (filter.status !== 'all' && entry.status !== filter.status) {
      continue;
    }
    if (filter.handlerOnly && entry.handler === '') {
      continue;
    }
    if (needle !== '') {
      const haystack = `${entry.extId} ${entry.name}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
    }
    result.push(entry);
  }
  return result;
}

/** Options for `useEffectIndex`. */
export interface UseEffectIndexOptions {
  /** Injectable index (defaults to the build-time bundle). Tests inject fixtures. */
  index?: EffectImplementationIndex;
}

/** The read-only view `useEffectIndex` returns. */
export interface UseEffectIndexReturn {
  summary: ComputedRef<EffectImplementationSummary>;
  entries: ComputedRef<readonly EffectImplementationEntry[]>;
  cards: ComputedRef<EffectImplementationIndex['cards']>;
  /** A human-readable load-error message when the bundle failed to validate. */
  error: string | undefined;
}

/**
 * Validates a candidate index (the injected one or the bundled import) against
 * `EffectImplementationIndexSchema` and returns the parsed index, or the empty
 * index plus a load-error message on failure. Never throws — a bad bundle
 * degrades to an empty state the page renders, exactly like the `/coverage` page.
 *
 * @param candidate - the injected or bundled value, treated as untrusted.
 * @returns the validated index and an optional load-error message.
 */
function validateIndex(candidate: unknown): {
  index: EffectImplementationIndex;
  error: string | undefined;
} {
  const parsed = EffectImplementationIndexSchema.safeParse(candidate);
  if (parsed.success) {
    return { index: parsed.data, error: undefined };
  }
  // why: the copy script's empty-stub carries a top-level `error` string that the
  // `.strict()` schema rejects, so `safeParse` fails by design — read that message
  // from a loose `{ error?: string }` view of the RAW import (the strict inferred
  // type omits `error`). When a genuinely corrupt bundle fails with no `error`
  // key, fall back to a generic full-sentence message so the banner is never blank.
  const rawError = (candidate as { error?: unknown } | null | undefined)?.error;
  const message =
    typeof rawError === 'string' && rawError.length > 0 ? rawError : GENERIC_LOAD_ERROR;
  return { index: EMPTY_INDEX, error: message };
}

/**
 * Provides the Effect Implementation Index for the `/debug/effects` page: the
 * summary, the entries (rendered verbatim), and the per-card join. The bundled
 * data is static, so everything is computed once; tests inject a fixture index
 * (a `safeParse`-failing fixture exercises the empty/error branch without mocking).
 *
 * @param options - optional injected index (defaults to the bundle).
 * @returns the read-only index view plus any load-error message.
 */
export function useEffectIndex(options?: UseEffectIndexOptions): UseEffectIndexReturn {
  const source: unknown = options?.index ?? indexData;
  const { index, error } = validateIndex(source);
  return {
    summary: computed(() => index.summary),
    entries: computed(() => index.entries),
    cards: computed(() => index.cards),
    error,
  };
}
