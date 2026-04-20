/**
 * Operational metadata types for release, deployment, and incident-response
 * observability.
 *
 * why: Counters are for passive monitoring; the engine does not auto-heal.
 * Downstream observability tooling (server layer, future ops dashboard) is
 * responsible for construction, incrementing, and persistence of
 * `OpsCounters` instances. The engine never reads or writes a counter at
 * runtime (RS-1 option (a); D-3501).
 *
 * Pure type definitions only. No I/O, no runtime, no game framework import,
 * no registry import, no server import. No wall-clock read, no random
 * source. Engine-category invariants apply per D-3501.
 *
 * See `docs/ops/RELEASE_CHECKLIST.md`, `docs/ops/DEPLOYMENT_FLOW.md`, and
 * `docs/ops/INCIDENT_RESPONSE.md` for the procedures these types support.
 */

// why: All four fields are `readonly number`. Field order is locked —
// `invariantViolations`, `rejectedTurns`, `replayFailures`,
// `migrationFailures` — to match the operational-hierarchy ordering used
// in `docs/ops/INCIDENT_RESPONSE.md` (fail-loud before fail-soft). D-1232
// applies: plain-object shape, JSON-serializable, no collection primitives
// or temporal objects, no function-valued fields. The `readonly` prefix
// mirrors the D-2802 aliasing-prevention discipline extended to ops
// observability surfaces — consumers reconstruct a new snapshot object
// rather than mutating a shared instance in place.

/**
 * Operational monitoring counters captured at a single observation point.
 *
 * Passive metadata surfaced by observability tooling; the engine neither
 * constructs nor mutates instances of this type. All four fields are
 * cumulative non-negative integers maintained by the server layer or a
 * future ops dashboard.
 *
 * Field order is locked — matches the fail-loud-before-fail-soft hierarchy
 * in `docs/ops/INCIDENT_RESPONSE.md`.
 */
export interface OpsCounters {
  /** Total invariant-check failures surfaced by `runAllInvariantChecks`. */
  readonly invariantViolations: number;
  /** Total turn intents rejected by `validateIntent`. */
  readonly rejectedTurns: number;
  /** Total replay-verification failures surfaced by `verifyDeterminism`. */
  readonly replayFailures: number;
  /** Total migration failures surfaced by `migrateArtifact`. */
  readonly migrationFailures: number;
}

// why: Four environments in sequential promotion order (dev → test →
// staging → prod). This order is the one enforced by
// `docs/ops/DEPLOYMENT_FLOW.md` and must not be re-derived. Adding a fifth
// environment requires a new D-entry and a coordinated documentation
// update — no silent expansion.

/**
 * Closed union of the four supported deployment environments.
 *
 * Ordered to match the sequential promotion path documented in
 * `docs/ops/DEPLOYMENT_FLOW.md`: `dev` → `test` → `staging` → `prod`.
 * Environment skipping is forbidden by the deployment-flow doc; the type
 * system does not enforce the ordering, but the ordering is canonical.
 */
export type DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod';

// why: Four levels in descending urgency (P0 → P1 → P2 → P3). The
// severity-to-action mapping is locked in `docs/ops/INCIDENT_RESPONSE.md`.
// P0 inherits D-0802 fail-loud semantics (immediate rollback on corrupted
// state); P3 inherits D-1234 graceful-degradation semantics (content lint
// warnings backlog). Adding a P4 requires a new D-entry — this is a
// governance change, not a code change.

/**
 * Closed union of the four supported incident severity levels.
 *
 * Ordered by descending urgency. The required action for each level is
 * locked in `docs/ops/INCIDENT_RESPONSE.md`:
 *   - `P0`: immediate rollback (corrupted game state).
 *   - `P1`: freeze deployments (replay desync).
 *   - `P2`: investigate (invalid turn spikes).
 *   - `P3`: backlog (content lint warnings).
 */
export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
