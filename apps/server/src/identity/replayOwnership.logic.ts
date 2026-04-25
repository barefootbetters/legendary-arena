/**
 * Replay Ownership Logic — Server Layer (WP-052)
 *
 * Public functions for assigning, looking up, listing, updating, and
 * tearing down replay ownership records. All persistent operations
 * go through PostgreSQL via a caller-injected `DatabaseClient`
 * (`pg.Pool`); for the transactional `deletePlayerData` path, the
 * function calls `pool.connect()` internally to obtain a `PoolClient`.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`, registry, preplan,
 * or any UI / client / replay-producer package. Type imports come
 * exclusively from `./identity.types.js` and `./replayOwnership.types.js`.
 *
 * Authority: WP-052 §Scope D; PS-6 (locked ON CONFLICT DO UPDATE
 * RETURNING SQL pattern); PS-12 / D-5207-pending (audit-count-only
 * GDPR handoff); 13-REPLAYS-REFERENCE.md §Storage and Access
 * Architecture; §Privacy and Consent Controls.
 */

import type {
  AccountId,
  DatabaseClient,
  Result,
} from './identity.types.js';

import { DEFAULT_RETENTION_POLICY } from './replayOwnership.types.js';

import type {
  ReplayOwnershipRecord,
  ReplayRetentionPolicy,
  ReplayVisibility,
} from './replayOwnership.types.js';

/**
 * Internal shape returned by every ownership SELECT / RETURNING used
 * in this module. The TypeScript application layer maps this row
 * shape to `ReplayOwnershipRecord` via `mapOwnershipRow`.
 */
interface OwnershipRow {
  ownership_id: number | string;
  ext_id: string;
  replay_hash: string;
  scenario_key: string;
  visibility: string;
  created_at: Date | string;
  expires_at: Date | string | null;
}

/**
 * Map an ownership row (with `ext_id` joined from
 * `legendary.players`) to the locked `ReplayOwnershipRecord` shape.
 * `bigserial` columns may arrive from `pg` as either `number` or
 * `string` depending on driver configuration; both are coerced to
 * `number` here. Timestamps arrive as `Date` and are converted to
 * ISO 8601 strings to match the contract.
 */
function mapOwnershipRow(row: OwnershipRow): ReplayOwnershipRecord {
  return {
    ownershipId:
      typeof row.ownership_id === 'string'
        ? Number(row.ownership_id)
        : row.ownership_id,
    accountId: row.ext_id as AccountId,
    replayHash: row.replay_hash,
    scenarioKey: row.scenario_key,
    visibility: row.visibility as ReplayVisibility,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    expiresAt:
      row.expires_at === null
        ? null
        : row.expires_at instanceof Date
          ? row.expires_at.toISOString()
          : row.expires_at,
  };
}

// why: ownership records are immutable except for `visibility`;
// retention is enforced at read time by `listAccountReplays` and at
// write time by `computeExpiresAt`. Computing expiry in the
// application (rather than via a DB DEFAULT) keeps the policy in
// code so future per-account overrides (Supporter tier) can branch
// without a schema migration.
/**
 * Compute the ISO 8601 `expires_at` string for a newly assigned
 * ownership row. Returns `null` when `policy.extendedDays` is set
 * (Supporter tier — indefinite retention); otherwise returns the
 * `defaultDays` boundary from now. The MVP DEFAULT_RETENTION_POLICY
 * has `extendedDays: null`, so this returns a 90-day expiry.
 */
function computeExpiresAt(policy: ReplayRetentionPolicy): string | null {
  if (policy.extendedDays !== null) {
    return null;
  }
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + policy.defaultDays);
  return expiresAt.toISOString();
}

/**
 * Idempotently assign ownership of `replayHash` to `accountId` for
 * `scenarioKey`. The first call inserts a fresh record with
 * `visibility: 'private'`; subsequent calls with the same
 * `(accountId, replayHash)` pair return the same record unchanged
 * (the `DO UPDATE SET visibility = legendary.replay_ownership.visibility`
 * is a no-op self-assignment that forces `RETURNING` to emit the
 * existing row's columns on conflict — `DO NOTHING` would not).
 *
 * Returns `Result.ok=false` with code `'unknown_account'` when no
 * `legendary.players` row matches the supplied `accountId`.
 */
// why: idempotency — `INSERT … ON CONFLICT (player_id, replay_hash)
// DO UPDATE SET visibility = legendary.replay_ownership.visibility`
// is the locked pattern from WP-052 §Locked Values (PS-6). The
// no-op self-assignment forces `RETURNING` to emit the conflicting
// row's columns; `DO NOTHING` would emit zero rows on conflict and
// the caller could not distinguish "first insert" from "race-lost
// idempotent retry" without a second SELECT. Atomic + race-safe by
// virtue of the `UNIQUE (player_id, replay_hash)` constraint.
// why: the `WITH resolved_player` CTE resolves `ext_id → player_id`
// in the same statement so the unknown-account case is detected by
// `result.rows.length === 0` rather than by catching SQLSTATE 23503
// after a foreign-key violation. Both patterns produce the same
// `code: 'unknown_account'` Result; the CTE keeps account-existence
// detection inside the single round-trip.
export async function assignReplayOwnership(
  accountId: AccountId,
  replayHash: string,
  scenarioKey: string,
  database: DatabaseClient,
): Promise<Result<ReplayOwnershipRecord>> {
  const expiresAt = computeExpiresAt(DEFAULT_RETENTION_POLICY);
  const result = await database.query(
    'WITH resolved_player AS ( ' +
      'SELECT player_id, ext_id FROM legendary.players WHERE ext_id = $1 ' +
      '), ' +
      'inserted AS ( ' +
      'INSERT INTO legendary.replay_ownership ' +
      '(player_id, replay_hash, scenario_key, visibility, expires_at) ' +
      "SELECT player_id, $2, $3, 'private', $4 FROM resolved_player " +
      'ON CONFLICT (player_id, replay_hash) DO UPDATE SET visibility = legendary.replay_ownership.visibility ' +
      'RETURNING ownership_id, player_id, replay_hash, scenario_key, ' +
      'visibility, created_at, expires_at ' +
      ') ' +
      'SELECT i.ownership_id, rp.ext_id, i.replay_hash, i.scenario_key, ' +
      'i.visibility, i.created_at, i.expires_at ' +
      'FROM inserted i ' +
      'JOIN resolved_player rp ON i.player_id = rp.player_id',
    [accountId, replayHash, scenarioKey, expiresAt],
  );
  if (result.rows.length === 0) {
    return {
      ok: false,
      reason:
        'No player account exists for the supplied accountId; create the account before assigning replay ownership.',
      code: 'unknown_account',
    };
  }
  return { ok: true, value: mapOwnershipRow(result.rows[0]) };
}

/**
 * Update the `visibility` column on a single ownership row, keyed
 * by `ownershipId`. Returns the updated record on success or `null`
 * when no row matches. All other columns are unchanged — the
 * drift-detection test in `replayOwnership.logic.test.ts` asserts
 * field-by-field equality on every column except `visibility`.
 */
export async function updateReplayVisibility(
  ownershipId: number,
  visibility: ReplayVisibility,
  database: DatabaseClient,
): Promise<ReplayOwnershipRecord | null> {
  const result = await database.query(
    'UPDATE legendary.replay_ownership ro ' +
      'SET visibility = $2 ' +
      'FROM legendary.players p ' +
      'WHERE ro.ownership_id = $1 AND ro.player_id = p.player_id ' +
      'RETURNING ro.ownership_id, p.ext_id, ro.replay_hash, ' +
      'ro.scenario_key, ro.visibility, ro.created_at, ro.expires_at',
    [ownershipId, visibility],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapOwnershipRow(result.rows[0]);
}

/**
 * List every non-expired ownership record for an account, newest
 * first. Read-time expiration filtering excludes rows whose
 * `expires_at` is in the past, even before any background purge job
 * runs — this keeps deletion semantics observable from the query
 * layer and prevents a stale UI listing if purge is delayed.
 *
 * Returns an empty array when the account has no records (or when
 * the account doesn't exist — the function does not distinguish,
 * because there is no caller use case for "unknown account" here).
 */
// why: read-time expiration filter — `expires_at IS NULL` covers
// the indefinite-retention (Supporter tier) path; `expires_at >
// now()` covers the standard 90-day path. Combining them in WHERE
// keeps the listing consistent regardless of which retention class
// each individual record was assigned under, and means the listing
// is correct even if a background purge is delayed or disabled.
export async function listAccountReplays(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<ReplayOwnershipRecord[]> {
  const result = await database.query(
    'SELECT ro.ownership_id, p.ext_id, ro.replay_hash, ro.scenario_key, ' +
      'ro.visibility, ro.created_at, ro.expires_at ' +
      'FROM legendary.replay_ownership ro ' +
      'JOIN legendary.players p ON ro.player_id = p.player_id ' +
      'WHERE p.ext_id = $1 ' +
      'AND (ro.expires_at IS NULL OR ro.expires_at > now()) ' +
      'ORDER BY ro.created_at DESC',
    [accountId],
  );
  return result.rows.map((row: OwnershipRow) => mapOwnershipRow(row));
}

/**
 * Look up a single ownership record by `replayHash`. Returns the
 * mapped record if found, `null` otherwise. This is a metadata
 * lookup only — it does not enforce visibility. Visibility / access
 * decisions are the caller's responsibility; embedding a check here
 * would couple lookup to policy and risk leaks at other call sites.
 */
export async function findReplayOwnership(
  replayHash: string,
  database: DatabaseClient,
): Promise<ReplayOwnershipRecord | null> {
  const result = await database.query(
    'SELECT ro.ownership_id, p.ext_id, ro.replay_hash, ro.scenario_key, ' +
      'ro.visibility, ro.created_at, ro.expires_at ' +
      'FROM legendary.replay_ownership ro ' +
      'JOIN legendary.players p ON ro.player_id = p.player_id ' +
      'WHERE ro.replay_hash = $1 LIMIT 1',
    [replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapOwnershipRow(result.rows[0]);
}

/**
 * Delete every persistent record for an account, in a single
 * PostgreSQL transaction. Returns audit counts: how many ownership
 * rows were removed and whether the account row itself existed and
 * was deleted. The caller is responsible for any downstream blob
 * purge (replay artifacts in object storage, derived score archives,
 * etc.) — this function emits no queue, scheduler, or storage-API
 * call. The audit count is the only handoff.
 */
// why: GDPR Article 17 (right to erasure) — `deletePlayerData`
// removes every persistent identity record for an account in a
// single BEGIN/COMMIT transaction so partial-deletion cannot
// occur. Replay blob purge is asynchronous and out of scope for
// WP-052 (PS-12 / D-5207-pending); the `{ deletedReplays,
// accountDeleted }` audit counts are the contractual handoff to
// future blob-purge tooling. No queue is enqueued, no scheduler is
// invoked, no object-storage API is called from this function.
export async function deletePlayerData(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<{ deletedReplays: number; accountDeleted: boolean }> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const ownershipResult = await client.query(
      'DELETE FROM legendary.replay_ownership WHERE player_id = ' +
        '(SELECT player_id FROM legendary.players WHERE ext_id = $1)',
      [accountId],
    );
    const accountResult = await client.query(
      'DELETE FROM legendary.players WHERE ext_id = $1',
      [accountId],
    );
    await client.query('COMMIT');
    return {
      deletedReplays: ownershipResult.rowCount ?? 0,
      accountDeleted: (accountResult.rowCount ?? 0) > 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
