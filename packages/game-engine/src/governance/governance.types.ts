/**
 * Governance metadata types for change classification and per-release budgeting.
 *
 * Pure type definitions only. No I/O, no runtime, no game framework import,
 * no registry-package import, no server-layer import. No wall-clock read, no
 * non-engine RNG. Engine-category invariants apply per D-4001.
 *
 * Consumers of these types are external to the engine: governance-authoring
 * workflows, release-planning tooling, and a future audit-tooling work packet
 * scoped separately. The engine never constructs or mutates instances of
 * these types — they are out-of-band metadata, never members of
 * `LegendaryGameState`, never persisted, never transmitted in replay logs,
 * never used to branch runtime gameplay behavior.
 *
 * See `docs/governance/CHANGE_GOVERNANCE.md` for the reader-facing prose
 * describing the five change categories, the five immutable surfaces, and
 * the per-release change-budget template. See D-1001 / D-1002 / D-1003 for
 * the foundational governance decisions these types encode.
 */

// why: D-3901 reuse verification (pre-flight v2, 2026-04-23): ChangeCategory,
// ChangeBudget, ChangeClassification, and the ChangeClassification.immutableSurface
// literal union are genuinely novel — no collision with IncidentSeverity,
// OpsCounters, DeploymentEnvironment, or any other landed ops/versioning type.

// why: Five categories in layer-partition order (ENGINE → RULES → CONTENT →
// UI → OPS). The ordering matches the one-to-one mapping to
// `ARCHITECTURE.md §Layer Boundary` restated in
// `docs/governance/CHANGE_GOVERNANCE.md §Change Classification`. Adding a
// sixth category requires a new D-entry and a fresh D-3901
// reuse-verification run — no silent expansion.

/**
 * Closed union of the five supported change categories.
 *
 * Each proposed change is classified into exactly one category — no hybrids,
 * no "miscellaneous", no split ownership. The category determines the
 * required review surface and the target version axis per the mapping
 * tables in `docs/governance/CHANGE_GOVERNANCE.md §Change Classification`.
 */
export type ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS';

// why: change budgets prevent entropy during growth (D-1001)

/**
 * Per-release change budget declaring the allowed count of classified
 * changes per category.
 *
 * Budget is declared before release development begins and expires at ship.
 * Overruns require explicit approval and a new DECISIONS.md entry per
 * `docs/governance/CHANGE_GOVERNANCE.md §Change Budget Template`. All fields
 * are `readonly` per the D-2802 / D-3501 aliasing-prevention discipline —
 * consumers reconstruct a new budget object rather than mutating a shared
 * instance in place.
 */
export interface ChangeBudget {
  /** Release identifier the budget applies to. */
  readonly release: string;
  /** Allowed count of ENGINE-category changes for the release. */
  readonly engine: number;
  /** Allowed count of RULES-category changes for the release. */
  readonly rules: number;
  /** Allowed count of CONTENT-category changes for the release. */
  readonly content: number;
  /** Allowed count of UI-category changes for the release. */
  readonly ui: number;
  /** Allowed count of OPS-category changes for the release. */
  readonly ops: number;
}

/**
 * Classification metadata for a single proposed change.
 *
 * `versionImpact` maps to the target version axis per the mapping table in
 * `docs/governance/CHANGE_GOVERNANCE.md §Change Classification`.
 * `immutableSurface` is set only when the change touches one of the five
 * surfaces enumerated in `docs/governance/CHANGE_GOVERNANCE.md §Immutable
 * Surfaces`. When the change does not touch an immutable surface, the field
 * must be OMITTED entirely — do not set it to `undefined`. The repo-wide
 * `exactOptionalPropertyTypes: true` setting rejects the `T | undefined`
 * shape for optional properties (WP-029 precedent). All fields are
 * `readonly`.
 */
export interface ChangeClassification {
  /** Unique identifier for the change (ticket id, PR number, or D-entry). */
  readonly id: string;
  /** Which of the five categories the change belongs to. */
  readonly category: ChangeCategory;
  /** Short human-readable description of the change. */
  readonly description: string;
  /** Resulting version bump on the target axis; `'none'` when no axis bumps. */
  readonly versionImpact: 'major' | 'minor' | 'patch' | 'none';
  /** The immutable surface touched, if any; omit field when no surface is touched. */
  readonly immutableSurface?: 'replay' | 'rng' | 'scoring' | 'invariants' | 'endgame';
}
