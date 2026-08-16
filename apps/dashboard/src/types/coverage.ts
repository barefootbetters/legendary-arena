/**
 * Types for the Coverage page — the hero mechanic ledger surfaced on the
 * dashboard. The runtime data is `src/data/coverage-ledger.json`, a build-time
 * copy of `docs/ai/coverage/hero-mechanic-ledger.json` (see
 * `scripts/build-coverage-ledger.mjs`). The canonical four-state status mirrors
 * the generator in `scripts/hero-mechanic-ledger.mjs`.
 */

/**
 * The six kinds of coverage state (drift-pinned by `types/coverage.drift.test.ts`).
 * `subsystem` (WP-548 / D-24357) marks a card implemented by a subsystem OTHER than
 * the `[effect:X]` pipeline (villain ledger only; no hero row carries it yet).
 */
export type LedgerStatus =
  | 'executable'
  | 'deferred'
  | 'condition'
  | 'unsupported'
  | 'unmarked'
  | 'subsystem';

export const LEDGER_STATUSES: readonly LedgerStatus[] = [
  'executable',
  'deferred',
  'condition',
  'unsupported',
  'unmarked',
  'subsystem',
];

/** One card design that prints a mechanic — the WP-491 attribution unit. */
export interface LedgerDesign {
  slug: string;
  name: string;
}

/** One ledger row: a (hero card × mechanic) pair with its status + provenance. */
export interface LedgerRow {
  extId: string;
  heroName: string;
  set: string;
  mechanic: string;
  status: LedgerStatus;
  /** Work Packet that implemented the mechanic (blank if not yet attributed). */
  wp: string;
  /** DECISIONS.md id (blank if not yet attributed). */
  decision: string;
  /** module#key for executable mechanics — the bug→code jump (blank otherwise). */
  handler: string;
  /**
   * The card design(s) whose printed ability carries this mechanic (WP-491). Empty
   * for an `(unmarked)` row (hero-level, no carrying design). Optional so an older
   * (schemaVersion 1) bundled ledger still type-checks.
   */
  designs?: readonly LedgerDesign[];
}

export interface LedgerByStatus {
  executable: number;
  deferred: number;
  condition: number;
  unsupported: number;
  unmarked: number;
}

export interface LedgerSummary {
  totalRows: number;
  byStatus: LedgerByStatus;
  distinctMechanics: number;
}

export interface CoverageLedger {
  schemaVersion: number;
  cardType: string;
  summary: LedgerSummary;
  rows: readonly LedgerRow[];
  /** Present only when the build-time copy failed (empty-stub path). */
  error?: string;
}

/**
 * A by-mechanic dictionary entry — the implementation worklist view. One per
 * distinct mechanic, since implementing one mechanic clears every card using it.
 */
export interface MechanicEntry {
  mechanic: string;
  status: LedgerStatus;
  cardCount: number;
  wp: string;
  decision: string;
  handler: string;
}

/**
 * The runtime-observed hollow-effect overlay (WP-259 / D-24035). Build-time
 * copy of `docs/ai/coverage/runtime-observed-hollows.json`, produced by the
 * `runtime-observed-hollows` harness (a fixed-seed deterministic sim sweep) and
 * copied into `src/data` by `scripts/build-coverage-ledger.mjs`. The static
 * ledger above answers "unsupported in theory?"; this answers "did it actually
 * bite a player in play?". The three `byReason` keys are the closed WP-257
 * hollow set (always present, even at 0).
 */
export interface RuntimeObservedByReason {
  'no-handler': number;
  'unsupported-keyword': number;
  'parse-unrecognized': number;
}

/** One example card that hit a mechanic's hollow handler during the sweep. */
export interface RuntimeObservedExample {
  cardId: string;
  cardType: string;
  timing: string;
  reason: string;
}

/** Per-mechanic runtime-observed tally — the value the overlay joins per row. */
export interface RuntimeObservedEntry {
  hitCount: number;
  lastSeenTurn: number;
  byReason: RuntimeObservedByReason;
  examples: readonly RuntimeObservedExample[];
}

export interface RuntimeObservedGeneratedFrom {
  runSeed: string | number;
  gamesPlayed: number;
  matrixDescription: string;
}

export interface RuntimeObservedSummary {
  distinctMechanics: number;
  totalObservations: number;
  hollowEffectsDropped: number;
  byReason: RuntimeObservedByReason;
}

export interface RuntimeObservedHollows {
  schemaVersion: number;
  generatedFrom: RuntimeObservedGeneratedFrom;
  summary: RuntimeObservedSummary;
  byMechanic: Record<string, RuntimeObservedEntry>;
  /** Present only when the build-time copy failed (empty-stub path). */
  error?: string;
}

/**
 * One entry in the committed in-play hollow baseline — the frozen high-water-mark
 * obs count for a mechanic ever observed hollow in play (WP-274 / D-24050).
 */
export interface InPlayHollowBaselineEntry {
  peakObs: number;
}

/**
 * The committed in-play hollow baseline (`src/data/in-play-hollow-baseline.json`,
 * COMMITTED — not a gitignored build-copy). It is the frozen obs denominator for
 * the "% in-play hollows resolved" metric: it preserves a fixed mechanic's obs
 * after the mechanic stops producing hollows and vanishes from the live sweep
 * artifact. Maintained deliberately by `scripts/build-in-play-baseline.mjs`
 * (monotonic `max` merge of the live artifact); `generatedAt` is a fixed
 * deterministic sentinel, never a wall-clock.
 */
export interface InPlayHollowBaseline {
  schemaVersion: number;
  generatedAt: string;
  byMechanic: Record<string, InPlayHollowBaselineEntry>;
}

/**
 * One unresolved mechanic in the in-play coverage worklist — the obs-weighted
 * priority is `peakObs` (the high-water-mark in-play hollow count).
 */
export interface RemainingMechanic {
  mechanic: string;
  peakObs: number;
}

/**
 * The computed in-play coverage metric (WP-274 / D-24050). Obs-weighted,
 * ledger-gated: each mechanic contributes `peakObs = max(baseline, live)` to
 * `totalObs`, and only mechanics whose hero-ledger status is exactly
 * `executable` contribute to `resolvedObs`. `percentResolved` is the rounded
 * share (0 when `totalObs` is 0). `remaining` is the unresolved worklist sorted
 * `peakObs` descending, then mechanic key ascending. The composable wraps each
 * field in a `ComputedRef`; this is the unwrapped value shape.
 */
export interface InPlayCoverageMetric {
  percentResolved: number;
  resolvedObs: number;
  totalObs: number;
  remaining: readonly RemainingMechanic[];
}
