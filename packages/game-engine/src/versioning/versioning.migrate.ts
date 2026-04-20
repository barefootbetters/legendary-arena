/**
 * Forward-only migration of `VersionedArtifact<T>` instances across
 * engine versions. The migration registry is the locked seam for
 * future migrations to extend; MVP ships with an empty registry.
 *
 * Engine-category invariants (D-3401) apply: no game framework import,
 * no registry import, no server import; no non-engine RNG, no
 * wall-clock reads, no high-resolution timing reads; no I/O.
 */

import type { EngineVersion, VersionedArtifact } from './versioning.types.js';
import { formatEngineVersion } from './versioning.check.js';

/** Migration registry key format: `"<fromMajor.fromMinor.fromPatch>-><toMajor.toMinor.toPatch>"`. */
export type MigrationKey = string;

/**
 * Pure transformation function from one payload version to the next.
 * Same input -> same output. No I/O, no RNG, no wall clock.
 */
export type MigrationFn = (payload: unknown) => unknown;

// why: per the WP-034 Locked Values block, MVP ships with an empty
// frozen registry. Future migrations append entries by extending this
// constant; the registry shape (`Record<MigrationKey, MigrationFn>`) is
// the long-lived seam. `Object.freeze` prevents accidental
// in-process mutation; `Readonly<...>` keeps the type contract honest.
export const migrationRegistry: Readonly<Record<MigrationKey, MigrationFn>> =
  Object.freeze({});

// why: `migrateArtifact` MAY throw — this is the load-boundary
// exception. The rationale is identical to `Game.setup()`'s throw:
// the engine cannot proceed without a valid artifact, and the
// failure is a structural-load error (D-0802 fail-loud), not a
// gameplay condition. The throw uses `Error` (base class).
// why: returns a NEW `VersionedArtifact<T>` with spread-copied fields
// so callers cannot mutate stored artifacts via the migrated
// reference. Aliasing prevention extends D-2802 from G-projections
// to load-boundary wrappers — the same bug class, different surface.

/**
 * Applies the registered migration sequence forward from
 * `artifact.engineVersion` to `targetVersion`. Returns a new
 * `VersionedArtifact<T>` with `engineVersion` updated and `payload`
 * transformed by the chained migration functions.
 *
 * Throws `Error` when no migration path exists. The error message
 * names both versions and the artifact's `savedAt` timestamp so
 * operators can locate the offending artifact.
 *
 * Forward-only: this function refuses to migrate when
 * `targetVersion` precedes `artifact.engineVersion` (any axis lower
 * than the corresponding source axis). Downgrade support is a
 * separate WP gated on a `D-34NN` decision.
 *
 * @typeParam T - The payload type (preserved across migrations).
 * @param artifact - The source `VersionedArtifact<T>` to migrate.
 * @param targetVersion - The desired engine version to migrate to.
 * @returns A new `VersionedArtifact<T>` at `targetVersion`.
 * @throws Error - When no migration path is registered or when
 *                 `targetVersion` precedes the source version.
 */
export function migrateArtifact<T>(
  artifact: VersionedArtifact<T>,
  targetVersion: EngineVersion,
): VersionedArtifact<T> {
  const sourceVersion = artifact.engineVersion;

  if (engineVersionsEqual(sourceVersion, targetVersion)) {
    return spreadCopyArtifact(artifact);
  }

  if (isDowngrade(sourceVersion, targetVersion)) {
    throw new Error(
      `Cannot migrate engine version ${formatEngineVersion(sourceVersion)} backward to engine version ${formatEngineVersion(targetVersion)}; downgrade migrations are not supported (artifact savedAt ${artifact.savedAt}).`,
    );
  }

  const migrationKey = buildMigrationKey(sourceVersion, targetVersion);
  const migrationFn = migrationRegistry[migrationKey];
  if (migrationFn === undefined) {
    throw new Error(
      `No migration path from engine version ${formatEngineVersion(sourceVersion)} to engine version ${formatEngineVersion(targetVersion)}; cannot migrate artifact saved at ${artifact.savedAt}.`,
    );
  }

  const migratedPayload = migrationFn(artifact.payload) as T;
  return {
    engineVersion: { ...targetVersion },
    dataVersion: { ...artifact.dataVersion },
    ...(artifact.contentVersion !== undefined
      ? { contentVersion: { ...artifact.contentVersion } }
      : {}),
    payload: migratedPayload,
    savedAt: artifact.savedAt,
  };
}

function buildMigrationKey(
  fromVersion: EngineVersion,
  toVersion: EngineVersion,
): MigrationKey {
  return `${formatEngineVersion(fromVersion)}->${formatEngineVersion(toVersion)}`;
}

function engineVersionsEqual(a: EngineVersion, b: EngineVersion): boolean {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

function isDowngrade(source: EngineVersion, target: EngineVersion): boolean {
  if (target.major < source.major) {
    return true;
  }
  if (target.major > source.major) {
    return false;
  }
  if (target.minor < source.minor) {
    return true;
  }
  if (target.minor > source.minor) {
    return false;
  }
  return target.patch < source.patch;
}

function spreadCopyArtifact<T>(
  artifact: VersionedArtifact<T>,
): VersionedArtifact<T> {
  return {
    engineVersion: { ...artifact.engineVersion },
    dataVersion: { ...artifact.dataVersion },
    ...(artifact.contentVersion !== undefined
      ? { contentVersion: { ...artifact.contentVersion } }
      : {}),
    payload: artifact.payload,
    savedAt: artifact.savedAt,
  };
}
