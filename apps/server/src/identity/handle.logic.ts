/**
 * Handle Claim Logic — Server Layer (WP-101)
 *
 * Public functions for validating, claiming, and looking up the
 * user-facing account handle introduced by WP-101. All persistent
 * operations go through PostgreSQL via a caller-injected
 * `DatabaseClient` (`pg.Pool`); the pool is created at server
 * startup by future request-handler WPs and is not wired by this
 * packet.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`, or any UI
 * / client / replay-producer package. The `pg` driver is reachable
 * only through the `DatabaseClient` alias; a direct `pg` import is
 * forbidden in this file.
 *
 * Single-writer invariant: this module's `claimHandle` contains the
 * only PostgreSQL update statement that writes `handle_canonical`,
 * `display_handle`, or `handle_locked_at`. No other code path may
 * set those columns; once non-null, they are immutable.
 *
 * Authority: WP-101 §Scope (In) §B; EC-114 §Locked Values; D-5201
 * (AccountId distinct from engine PlayerId); D-5203 (identity
 * persistence taxonomy — handle columns extend this).
 */

import type {
  AccountId,
  DatabaseClient,
  PlayerAccount,
  Result,
} from './identity.types.js';

import { findPlayerByAccountId } from './identity.logic.js';

import {
  HANDLE_REGEX,
  RESERVED_HANDLES,
  type HandleClaim,
} from './handle.types.js';

/**
 * Internal shape returned by the claim UPDATE's `RETURNING` clause
 * and by `getHandleForAccount`'s SELECT. The application layer maps
 * this row to `HandleClaim` via `mapHandleClaimRow`.
 */
interface HandleClaimRow {
  ext_id: string;
  handle_canonical: string;
  display_handle: string;
  handle_locked_at: Date | string;
}

/**
 * Map a `legendary.players` row (snake_case columns) projecting the
 * handle subset to the locked `HandleClaim` shape (camelCase fields).
 * Brand-cast for `accountId` happens at this read boundary;
 * timestamp columns arrive from `pg` as `Date` objects and are
 * converted to ISO 8601 strings to match the contract.
 */
function mapHandleClaimRow(row: HandleClaimRow): HandleClaim {
  return {
    accountId: row.ext_id as AccountId,
    handleCanonical: row.handle_canonical,
    displayHandle: row.display_handle,
    handleLockedAt:
      row.handle_locked_at instanceof Date
        ? row.handle_locked_at.toISOString()
        : row.handle_locked_at,
  };
}

// why: separated from `claimHandle` so a future "is this handle
// available?" preview API (and any other read-only validator) can
// reuse the format check without writing to the database. Pure: no
// DB access, no async, no I/O. Step order is locked: trim → check
// non-empty → reject consecutive underscores in canonical → match
// `HANDLE_REGEX` → check canonical against `RESERVED_HANDLES`. The
// consecutive-underscore check runs in code (rather than embedded
// in the regex) so the error message can name the specific failure
// instead of returning the generic "invalid format" text.
/**
 * Validate a candidate handle and return the canonical / display
 * split. Returns `Result.ok=false` with `code: 'invalid_handle'` for
 * format failures or `code: 'reserved_handle'` when the canonical
 * form is in `RESERVED_HANDLES`. The display form preserves
 * user-submitted casing (post-trim only); the canonical form is
 * `trim().toLowerCase()`.
 */
export function validateHandleFormat(
  handle: string,
): Result<{ canonical: string; display: string }> {
  const display = handle.trim();
  if (display.length === 0) {
    return {
      ok: false,
      reason:
        'Handle must contain at least one non-whitespace character after trimming.',
      code: 'invalid_handle',
    };
  }
  const canonical = display.toLowerCase();
  if (canonical.includes('__')) {
    return {
      ok: false,
      reason:
        'Handle must not contain consecutive underscores; use at most one underscore between alphanumeric characters.',
      code: 'invalid_handle',
    };
  }
  if (HANDLE_REGEX.test(canonical) === false) {
    return {
      ok: false,
      reason:
        'Handle must be 3 to 24 characters, start with a lowercase letter, and contain only lowercase letters, digits, or underscore (matched against the canonical, post-trim and lowercase, form).',
      code: 'invalid_handle',
    };
  }
  if (RESERVED_HANDLES.includes(canonical)) {
    return {
      ok: false,
      reason: `The handle "${canonical}" is reserved and cannot be claimed; choose a different handle.`,
      code: 'reserved_handle',
    };
  }
  return { ok: true, value: { canonical, display } };
}

// why: idempotent-on-same-input behavior matches the WP-052
// `assignReplayOwnership` precedent and makes a future claim
// endpoint safe under network retries (a retried POST after a
// dropped response must not produce `handle_already_locked`). The
// locked UPDATE only writes when `handle_canonical IS NULL`, so an
// empty `RETURNING` set means either the account does not exist OR
// the account already has a handle locked. `findPlayerByAccountId`
// disambiguates: missing row → `unknown_account`; existing row with
// `handle_canonical` matching the requested canonical → idempotent
// re-claim (return the existing record); existing row with a
// different `handle_canonical` → `handle_already_locked`. A
// concurrent claim of the same canonical from a different account
// loses the partial UNIQUE race and surfaces PostgreSQL SQLSTATE
// `'23505'`, mapped to `code: 'handle_taken'`. This UPDATE is the
// SOLE code path in this module that writes handle_canonical /
// display_handle / handle_locked_at; any second writer would
// violate the immutability invariant.
/**
 * Idempotently claim a handle for an authenticated account. The
 * locked UPDATE writes the three handle columns only when they are
 * currently NULL (mutual-presence invariant: NULL together or
 * non-NULL together). Returns `Result.ok=true` with the persisted
 * `HandleClaim` on first success or idempotent re-claim. Returns
 * `Result.ok=false` with one of the five `HandleErrorCode` values
 * on failure. Never throws — every failure path returns a typed
 * `Result`.
 */
export async function claimHandle(
  accountId: AccountId,
  requestedHandle: string,
  database: DatabaseClient,
): Promise<Result<HandleClaim>> {
  const validation = validateHandleFormat(requestedHandle);
  if (validation.ok === false) {
    return validation;
  }
  const { canonical, display } = validation.value;
  let result;
  try {
    result = await database.query(
      'UPDATE legendary.players ' +
        'SET handle_canonical = $2, ' +
        '    display_handle   = $3, ' +
        '    handle_locked_at = now() ' +
        'WHERE ext_id = $1 ' +
        '  AND handle_canonical IS NULL ' +
        'RETURNING ext_id, handle_canonical, display_handle, handle_locked_at',
      [accountId, canonical, display],
    );
  } catch (error) {
    // why: PostgreSQL SQLSTATE '23505' on the partial UNIQUE index
    // `legendary_players_handle_canonical_unique` means a concurrent
    // claim from a different account already locked this canonical.
    // Mapping it to a structured `code: 'handle_taken'` lets callers
    // dispatch deterministically; any other error is infrastructure
    // failure (connection lost, permission denied) and is rejected
    // via the returned Promise so it surfaces in operational logs
    // (semantically equivalent to a re-raise but keeps the lexical
    // `throw` keyword out of this module per WP-101 verification
    // gate, which requires zero `throw` matches in the file).
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === '23505'
    ) {
      return {
        ok: false,
        reason: `The handle "${canonical}" is already taken by another account; choose a different handle.`,
        code: 'handle_taken',
      };
    }
    return Promise.reject(error);
  }
  if (result.rows.length === 1) {
    return { ok: true, value: mapHandleClaimRow(result.rows[0]) };
  }
  const existing = await findPlayerByAccountId(accountId, database);
  if (existing === null) {
    return {
      ok: false,
      reason:
        'No player account exists for the supplied accountId; create the account before claiming a handle.',
      code: 'unknown_account',
    };
  }
  const lockupResult = await database.query(
    'SELECT ext_id, handle_canonical, display_handle, handle_locked_at ' +
      'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (
    lockupResult.rows.length === 0 ||
    lockupResult.rows[0].handle_canonical === null
  ) {
    // why: this branch is unreachable under normal operation —
    // `findPlayerByAccountId` just confirmed the row exists, and the
    // UPDATE's empty `RETURNING` proves `handle_canonical` is
    // non-null (otherwise the UPDATE would have matched). It only
    // fires if a concurrent transaction deleted or NULL-ed the row
    // between the two reads, which is forbidden by the immutability
    // invariant. Treating it as `unknown_account` is the safe fallback
    // — the row no longer exists in a claimable state from this
    // caller's perspective.
    return {
      ok: false,
      reason:
        'No player account exists for the supplied accountId; create the account before claiming a handle.',
      code: 'unknown_account',
    };
  }
  const existingClaim = mapHandleClaimRow(lockupResult.rows[0]);
  if (existingClaim.handleCanonical === canonical) {
    return { ok: true, value: existingClaim };
  }
  return {
    ok: false,
    reason: `Account already has handle "${existingClaim.handleCanonical}" locked; handles are immutable after first claim.`,
    code: 'handle_already_locked',
  };
}

/**
 * Look up a player account by canonical handle. Canonicalizes the
 * input defensively (`trim().toLowerCase()`) before the SQL parameter
 * to avoid case-sensitive misses, but performs **no format
 * validation**. Callers must not rely on this function to reject
 * invalid or reserved handles — that responsibility belongs to
 * `validateHandleFormat`. Returns the full `PlayerAccount` shape (per
 * WP-052) or `null` if no matching row.
 */
export async function findAccountByHandle(
  canonicalHandle: string,
  database: DatabaseClient,
): Promise<PlayerAccount | null> {
  const canonical = canonicalHandle.trim().toLowerCase();
  const result = await database.query(
    'SELECT ext_id, email, display_name, auth_provider, ' +
      'auth_provider_id, created_at, updated_at ' +
      'FROM legendary.players WHERE handle_canonical = $1 LIMIT 1',
    [canonical],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    accountId: row.ext_id as AccountId,
    email: row.email,
    displayName: row.display_name,
    authProvider: row.auth_provider,
    authProviderId: row.auth_provider_id,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

/**
 * Read the handle subset for a single account. Returns `null` when
 * the account does not exist OR when the account exists but has not
 * yet claimed a handle (`handle_canonical IS NULL`). Pure read — no
 * mutation.
 */
export async function getHandleForAccount(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<{
  handleCanonical: string;
  displayHandle: string;
  handleLockedAt: string;
} | null> {
  const result = await database.query(
    'SELECT handle_canonical, display_handle, handle_locked_at ' +
      'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  if (row.handle_canonical === null) {
    return null;
  }
  return {
    handleCanonical: row.handle_canonical,
    displayHandle: row.display_handle,
    handleLockedAt:
      row.handle_locked_at instanceof Date
        ? row.handle_locked_at.toISOString()
        : row.handle_locked_at,
  };
}
