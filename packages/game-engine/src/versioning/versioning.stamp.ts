/**
 * Save-time stamping for `VersionedArtifact<T>` instances.
 *
 * Pure helper. The single permitted wall-clock read in the
 * `src/versioning/` subtree happens here in the `Date` constructor
 * call for the `savedAt` metadata field — the documented load-boundary
 * exception per D-3401. Save-time stamping is at the persistence
 * boundary (load/save metadata), not in gameplay code paths, and the
 * `savedAt` field never affects determinism of any in-game decision.
 *
 * Engine-category invariants (D-3401) otherwise apply: no game
 * framework import, no registry import, no server import; no
 * non-engine RNG, no high-resolution timing reads; no I/O.
 */

import type {
  ContentVersion,
  VersionedArtifact,
} from './versioning.types.js';
import {
  CURRENT_DATA_VERSION,
  getCurrentEngineVersion,
} from './versioning.check.js';

// why: per D-3401 sub-rule, the `Date` constructor call below is the
// sole permitted wall-clock read in `src/versioning/`. The
// forbidden-call grep gate scans for non-engine RNG and the static
// wall-clock helper, neither of which is invoked here — the
// constructor + instance-method idiom is structurally distinct.
// Choosing the constructor idiom over a two-step millisecond
// conversion is deliberate: it avoids an intermediate numeric
// representation and uses the default-now semantics directly.
// Save-time stamping is structurally distinct from gameplay-affecting
// clock reads — see D-3401 for the four-point rationale.

/**
 * Wraps a payload in a `VersionedArtifact<T>` stamped with the current
 * engine version, the current data version, the optional content
 * version, and an ISO 8601 UTC `savedAt` timestamp.
 *
 * Stamps are embedded at save time — never reconstructed at load
 * time. `checkCompatibility` reads these stamps but does not
 * synthesize them.
 *
 * @typeParam T - The payload type to wrap.
 * @param payload - The payload to stamp. Stored by reference; the
 *                  caller is responsible for ensuring the payload
 *                  is JSON-serializable per D-1232 (no `Date`, no
 *                  `Map` / `Set`, no functions, no class instances).
 * @param contentVersion - Optional content schema version. Omit when
 *                         the payload has no content axis (e.g., a
 *                         raw replay log of moves).
 * @returns A `VersionedArtifact<T>` ready for serialization.
 */
export function stampArtifact<T>(
  payload: T,
  contentVersion?: ContentVersion,
): VersionedArtifact<T> {
  const savedAt = new Date().toISOString();
  if (contentVersion === undefined) {
    return {
      engineVersion: getCurrentEngineVersion(),
      dataVersion: { ...CURRENT_DATA_VERSION },
      payload,
      savedAt,
    };
  }
  return {
    engineVersion: getCurrentEngineVersion(),
    dataVersion: { ...CURRENT_DATA_VERSION },
    contentVersion: { ...contentVersion },
    payload,
    savedAt,
  };
}
