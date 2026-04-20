/**
 * Version axis types and the VersionedArtifact wrapper for persisted
 * artifacts (Class 2 Configuration + Class 3 Snapshot per
 * `docs/ai/ARCHITECTURE.md` §Section 3 — The Three Data Classes).
 *
 * Class 1 Runtime state (`G`) is never persisted and therefore never
 * carries a version stamp. Only artifacts that round-trip through
 * storage need versioning.
 *
 * Pure type definitions only. No I/O, no runtime, no game framework
 * import, no registry import, no server import. Engine-category
 * invariants apply per D-3401.
 */

// why: per D-0801, the three version axes evolve on independent
// cadences. EngineVersion bumps when the engine reducer's behavior
// changes (replay determinism, rule semantics, scoring math).
// DataVersion bumps when the wire format of any persisted artifact
// changes (a new required field, a renamed field, a removed field).
// ContentVersion bumps when the content schema changes (a new card
// keyword, a new ability hook type, a renamed scenario field).
// Coupling them would force unnecessary bumps cascading across
// unrelated concerns.

/**
 * Engine semantic version. Mirrors `packages/game-engine/package.json`
 * `version` field. The constant in `versioning.check.ts` is the
 * single source of truth at runtime; package.json is the
 * human-readable copy. A future bump updates both atomically.
 */
export interface EngineVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * Persisted-artifact data-format version. Integer only. Increments
 * monotonically when the wire shape of any persisted artifact
 * (replay file, match snapshot, campaign state) changes — including
 * a new required field, a renamed field, or a removed field.
 */
export interface DataVersion {
  readonly version: number;
}

/**
 * Content schema version. Integer only. Increments monotonically when
 * the content authoring schema (card definitions, scenario
 * definitions, scheme setup instructions) changes shape. Optional on
 * `VersionedArtifact` because some persisted artifacts (e.g., a raw
 * replay log of moves) have no content payload.
 */
export interface ContentVersion {
  readonly version: number;
}

// why: per D-0801, version stamps are embedded at save time —
// `stampArtifact` is the canonical embed site. `checkCompatibility`
// reads stamps but never reconstructs them. The engine never guesses
// what an unstamped artifact means; per D-0802 the only legal
// response to a missing or unparseable stamp is "incompatible" with a
// full-sentence explanation.
// why: `savedAt` is an ISO 8601 string (not a `Date` object) so the
// type stays JSON-serializable per D-1232. The `Date` constructor is
// only invoked at stamp time inside `versioning.stamp.ts` (the
// documented load-boundary exception per D-3401).

/**
 * Generic wrapper that embeds the three independent version axes
 * plus a save-time timestamp around any persisted payload `T`.
 *
 * @typeParam T - The payload type (e.g., `ReplayInput`, `CampaignState`,
 *                `MatchSnapshot`, `ScenarioDefinition`).
 */
export interface VersionedArtifact<T> {
  readonly engineVersion: EngineVersion;
  readonly dataVersion: DataVersion;
  readonly contentVersion?: ContentVersion;
  readonly payload: T;
  /** ISO 8601 UTC timestamp, e.g., `"2026-04-19T12:34:56.000Z"`. */
  readonly savedAt: string;
}

/**
 * Locked compatibility-status union returned by `checkCompatibility`.
 *
 * - `'compatible'`: artifact loads as-is, no migration needed.
 * - `'migratable'`: artifact loads after applying the listed
 *   migration sequence in order.
 * - `'incompatible'`: artifact cannot be loaded; consumer must
 *   surface the message and refuse the load.
 */
export type CompatibilityStatus = 'compatible' | 'migratable' | 'incompatible';

/**
 * Structured result returned by `checkCompatibility`. `message` is a
 * full-sentence string per code-style Rule 11. `migrations` is
 * present only when `status === 'migratable'`; it lists the
 * registered migration keys to apply, in order.
 */
export interface CompatibilityResult {
  readonly status: CompatibilityStatus;
  readonly message: string;
  readonly migrations?: readonly string[];
}
