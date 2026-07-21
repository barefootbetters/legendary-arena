/**
 * migrate.ts — forward-only LAGN version migration (WP-036 / D-24195).
 *
 * why: before this, `lagn_version` was a `z.literal('1.0.0')` hard gate with
 * no upgrade path — any bump would have orphaned every stored record. This
 * mirrors the seam already established at
 * packages/game-engine/src/versioning/versioning.migrate.ts: a frozen,
 * forward-only registry keyed `"<from>-><to>"`, with pure migration functions
 * (no I/O, no RNG, no wall clock) so a migration is replayable and testable.
 *
 * Future versions append to the registry; they never rewrite an existing key.
 */

import {
  LAGN_SUPPORTED_VERSIONS,
  LAGN_VERSION,
  LAGN_VERSION_1_0_0,
  LAGN_VERSION_1_1_0,
  LAGN_VERSION_1_2_0,
  LAGN_VERSION_1_3_0,
  type LagnVersion
} from './validator.js'

/** A pure transform from one LAGN version's shape to the next. */
export type LagnMigrationFn = (payload: Record<string, unknown>) => Record<string, unknown>

export type LagnMigrationKey = `${string}->${string}`

export function buildLagnMigrationKey(from: string, to: string): LagnMigrationKey {
  return `${from}->${to}`
}

/**
 * 1.0.0 -> 1.1.0 is a pure restamp.
 *
 * why: 1.1.0 adds exactly one optional field (`setup.support_pools`), so every
 * 1.0.0 document is already a structurally valid 1.1.0 document. The migration
 * asserts nothing and adds nothing — it only advances the version marker. It
 * deliberately does NOT synthesize pools from the counts: the counts say how
 * many, and no card identity can be recovered from them. A fabricated pool
 * would be worse than an absent one.
 */
const migrate_1_0_0_to_1_1_0: LagnMigrationFn = (payload) => ({
  ...payload,
  lagn_version: LAGN_VERSION_1_1_0
})

/**
 * 1.1.0 -> 1.2.0 is a pure restamp.
 *
 * why: 1.2.0 adds only optional provenance blocks, so every 1.1.0 document is
 * already a structurally valid 1.2.0 document. Like its predecessor it
 * synthesizes nothing — provenance records what a producer actually read, and
 * a migration has no registry to read. Inventing a catalog_ref would fabricate
 * exactly the audit trail the block exists to make trustworthy.
 *
 * why: REGISTERED BUT NOT REACHABLE in this packet. migrateToCurrent() targets
 * LAGN_VERSION, which stays 1.1.0 here, so no caller can reach this step. The
 * producer-wiring packet flips LAGN_VERSION and thereby activates it — the
 * step lands now so that flip is a one-line change rather than a new migration.
 */
const migrate_1_1_0_to_1_2_0: LagnMigrationFn = (payload) => ({
  ...payload,
  lagn_version: LAGN_VERSION_1_2_0
})

/**
 * 1.2.0 -> 1.3.0 is a pure restamp.
 *
 * why: 1.3.0 adds only the optional `setup.hero_alternates` bench, so every
 * 1.2.0 document is already a structurally valid 1.3.0 document. It synthesizes
 * nothing — and in particular it NEVER invents a bench from `setup.heroes`.
 * Migration is forward-only and may not fabricate information that was never in
 * the source; a saved loadout with no reserves has no reserves after migration.
 *
 * why: REGISTERED BUT NOT REACHABLE in this packet. migrateToCurrent() targets
 * LAGN_VERSION, which stays 1.1.0 here, so no caller can reach this step. The
 * producer-wiring packet (WP-404) flips LAGN_VERSION and thereby activates it —
 * the step lands now so that flip is a one-line change, not a new migration.
 */
const migrate_1_2_0_to_1_3_0: LagnMigrationFn = (payload) => ({
  ...payload,
  lagn_version: LAGN_VERSION_1_3_0
})

const migrationRegistry: Readonly<Record<LagnMigrationKey, LagnMigrationFn>> = Object.freeze({
  [buildLagnMigrationKey(LAGN_VERSION_1_0_0, LAGN_VERSION_1_1_0)]: migrate_1_0_0_to_1_1_0,
  [buildLagnMigrationKey(LAGN_VERSION_1_1_0, LAGN_VERSION_1_2_0)]: migrate_1_1_0_to_1_2_0,
  [buildLagnMigrationKey(LAGN_VERSION_1_2_0, LAGN_VERSION_1_3_0)]: migrate_1_2_0_to_1_3_0
})

export interface LagnMigrationResult {
  /** The migrated payload, or the input unchanged when already current. */
  payload: Record<string, unknown>
  /** Versions traversed, in order. Empty when no migration was needed. */
  applied: LagnMigrationKey[]
  /** Set when the payload could not be brought to the current version. */
  error?: string
}

/**
 * Steps a payload forward to LAGN_VERSION, one registered hop at a time.
 *
 * Fails loud rather than guessing: an unreadable version, or a gap in the
 * registry, returns an `error` instead of a partially-migrated payload. That
 * mirrors D-0802's fail-loud-at-the-load-boundary posture.
 */
export function migrateToCurrent(input: unknown): LagnMigrationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { payload: {}, applied: [], error: 'LAGN payload must be a JSON object' }
  }
  let payload = { ...(input as Record<string, unknown>) }
  const applied: LagnMigrationKey[] = []

  const declared = payload['lagn_version']
  if (typeof declared !== 'string') {
    return { payload, applied, error: 'LAGN payload is missing a string lagn_version' }
  }
  if (!(LAGN_SUPPORTED_VERSIONS as readonly string[]).includes(declared)) {
    return {
      payload,
      applied,
      error: `Unsupported lagn_version "${declared}" — this build reads ${LAGN_SUPPORTED_VERSIONS.join(', ')}`
    }
  }

  let current = declared as LagnVersion
  const targetIndex = LAGN_SUPPORTED_VERSIONS.indexOf(LAGN_VERSION)
  // why: migrate FORWARD only while the document sits BEHIND the writer version,
  // compared ORDINALLY by position — never `current !== LAGN_VERSION`, which was
  // an equality gate that read correctly only while LAGN_VERSION was the newest
  // supported version. Once a step is registered PAST the writer (the 1.2.0 ->
  // 1.3.0 hop, WP-402), an equality loop would walk a newer document forward and
  // stamp it — the same equality-vs-ordinal defect D-24211 fixes on the validator
  // side. Readers run ahead of the writer, so a document already at or newer than
  // LAGN_VERSION is valid and must be left untouched, never stamped backward. This
  // is what keeps the 1.2.0 -> 1.3.0 step registered but UNREACHABLE until WP-404
  // advances the writer. Bounded by the supported-version count, so a malformed
  // registry can never spin here.
  while (LAGN_SUPPORTED_VERSIONS.indexOf(current) < targetIndex) {
    const nextIndex = LAGN_SUPPORTED_VERSIONS.indexOf(current) + 1
    const next = LAGN_SUPPORTED_VERSIONS[nextIndex]
    if (next === undefined) {
      return { payload, applied, error: `No migration path from "${current}" to "${LAGN_VERSION}"` }
    }
    const key = buildLagnMigrationKey(current, next)
    const migration = migrationRegistry[key]
    if (migration === undefined) {
      return { payload, applied, error: `No registered LAGN migration for "${key}"` }
    }
    payload = migration(payload)
    applied.push(key)
    current = next
  }

  return { payload, applied }
}
