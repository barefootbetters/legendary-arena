/**
 * Player Blocks + Friend Abuse-Control Helpers — Server Layer (WP-355)
 *
 * Packet #6 of the Friends & Ranked Trust subsystem. Blocking is a
 * SEPARATE model from friendship (WP-350 / D-24142 — a block never lives
 * as a `legendary.friendships` status; it gets its own
 * `legendary.player_blocks` table because a block can exist with no prior
 * request). This module owns the block CRUD plus the three send-guard
 * primitives the friend-request route enforces before `sendFriendRequest`:
 * symmetric block detection, the trailing-24h outgoing-request count
 * (rate limit), and the most-recent-decline lookup (re-request cooldown).
 *
 * Every public function is keyed on `AccountId` (`ext_id`), resolves
 * `ext_id → player_id` inline, and returns a typed `BlockResult` (the CRUD
 * functions) or a bare value (the guard helpers). WP-350's
 * `friendships.{types,logic}.ts` are NOT modified — the block-time
 * friendship sever is a scoped normalized-pair delete inside this module.
 *
 * Layer-boundary contract: imports only `pg` types (via the identity
 * `DatabaseClient` alias) + Node built-ins. Nothing from the game engine,
 * the registry, or the boardgame framework.
 *
 * Authority: WP-355 §Scope (In) §B; EC-385 §Locked Values; D-24147;
 * D-24142 (blocking is orthogonal to friendship).
 */

import type { AccountId, DatabaseClient } from './friendships.types.js';

/**
 * A blocked account projected for the wire: `handle` + `displayName`
 * only — never `accountId` / `ext_id` / `player_id` (FR-2).
 */
export interface BlockView {
  readonly handle: string;
  readonly displayName: string;
}

/**
 * Programmatic error codes for the block CRUD operations. Closed union;
 * the route layer adds `unauthorized` / `invalid_request` /
 * `handle_not_found`. `unknown_account` is returned when a supplied
 * `AccountId` fails to resolve (no which-account enumeration).
 *
 * Adding a code requires updating both this union and
 * `BLOCK_ERROR_CODES`; the drift test asserts forward and backward
 * inclusion.
 */
export type BlockApiErrorCode =
  | 'unknown_account'
  | 'self_block'
  | 'already_blocked'
  | 'not_blocked';

/**
 * Canonical readonly array mirroring the `BlockApiErrorCode` union.
 * Adding a value requires updating both the union and this array in the
 * same change (see code-style §Drift Detection).
 */
export const BLOCK_ERROR_CODES: readonly BlockApiErrorCode[] = [
  'unknown_account',
  'self_block',
  'already_blocked',
  'not_blocked',
] as const;

/**
 * Discriminated-union result for the fallible block operations. Mirrors
 * WP-350's `FriendshipResult`.
 */
export type BlockResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: BlockApiErrorCode };

/**
 * Resolve an `AccountId` (`ext_id`) to the internal bigint `player_id`,
 * or `null` when no `legendary.players` row matches. Pure read.
 */
async function resolvePlayerId(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<number | null> {
  const result = await pool.query(
    'SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const raw = result.rows[0].player_id;
  return typeof raw === 'string' ? Number(raw) : raw;
}

/**
 * Block `blockedAccountId` on behalf of `blockerAccountId`: INSERT the
 * block row AND DELETE any existing friendship between the two, in one
 * transaction. Guards self-block (`self_block`), unknown account
 * (`unknown_account`), and an existing block (`already_blocked`).
 * Returns the blocked account's `{ handle, displayName }` on success.
 */
export async function blockPlayer(
  pool: DatabaseClient,
  blockerAccountId: AccountId,
  blockedAccountId: AccountId,
): Promise<BlockResult<BlockView>> {
  if (blockerAccountId === blockedAccountId) {
    return {
      ok: false,
      reason: 'You cannot block yourself; the blocker and blocked accounts are identical.',
      code: 'self_block',
    };
  }
  try {
    const blockerId = await resolvePlayerId(pool, blockerAccountId);
    const blockedRow = await pool.query(
      'SELECT player_id, display_handle, display_name FROM legendary.players WHERE ext_id = $1 LIMIT 1',
      [blockedAccountId],
    );
    // why: 'unknown_account' does not reveal WHICH account failed to
    // resolve — no account-existence enumeration (WP-102 posture).
    if (blockerId === null || blockedRow.rows.length === 0) {
      return {
        ok: false,
        reason: 'One or both accounts could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }
    const blockedId =
      typeof blockedRow.rows[0].player_id === 'string'
        ? Number(blockedRow.rows[0].player_id)
        : blockedRow.rows[0].player_id;

    const existing = await pool.query(
      'SELECT block_id FROM legendary.player_blocks WHERE blocker_id = $1 AND blocked_id = $2 LIMIT 1',
      [blockerId, blockedId],
    );
    if (existing.rows.length > 0) {
      return {
        ok: false,
        reason: 'You have already blocked this player.',
        code: 'already_blocked',
      };
    }

    // why: the block INSERT and the friendship sever must be atomic — a
    // block must never leave a live friendship, and a partial failure
    // must roll both back. The DELETE targets the normalized unordered
    // pair (LEAST/GREATEST) directly here rather than importing WP-350's
    // removeFriend, keeping that locked contract file byte-identical.
    const client = await pool.connect();
    let transactionError: unknown = null;
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO legendary.player_blocks (blocker_id, blocked_id) VALUES ($1, $2)',
        [blockerId, blockedId],
      );
      await client.query(
        'DELETE FROM legendary.friendships ' +
          'WHERE LEAST(requester_id, addressee_id) = LEAST($1::bigint, $2::bigint) ' +
          'AND GREATEST(requester_id, addressee_id) = GREATEST($1::bigint, $2::bigint)',
        [blockerId, blockedId],
      );
      await client.query('COMMIT');
    } catch (caughtError) {
      transactionError = caughtError;
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        void rollbackError;
      }
    }
    client.release();
    if (transactionError !== null) {
      // why: a UNIQUE-violation race (a concurrent block of the same pair)
      // is semantically 'already_blocked'; any other transaction fault
      // surfaces under the same in-set code with the driver text in
      // `reason` (the closed union has no infra member).
      return {
        ok: false,
        reason: `The block could not be saved because the database transaction failed: ${String(
          transactionError,
        )}.`,
        code: 'already_blocked',
      };
    }

    return {
      ok: true,
      value: {
        handle: blockedRow.rows[0].display_handle,
        displayName: blockedRow.rows[0].display_name,
      },
    };
  } catch (caughtError) {
    return {
      ok: false,
      reason: `The block could not be saved because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * Remove a block. Returns `not_blocked` when no block row exists for the
 * directed pair.
 */
export async function unblockPlayer(
  pool: DatabaseClient,
  blockerAccountId: AccountId,
  blockedAccountId: AccountId,
): Promise<BlockResult<void>> {
  try {
    const blockerId = await resolvePlayerId(pool, blockerAccountId);
    const blockedId = await resolvePlayerId(pool, blockedAccountId);
    if (blockerId === null || blockedId === null) {
      return {
        ok: false,
        reason: 'One or both accounts could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }
    const deleted = await pool.query(
      'DELETE FROM legendary.player_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId],
    );
    if (deleted.rowCount === 0) {
      return {
        ok: false,
        reason: 'You have not blocked this player, so there is nothing to unblock.',
        code: 'not_blocked',
      };
    }
    return { ok: true, value: undefined };
  } catch (caughtError) {
    return {
      ok: false,
      reason: `The block could not be removed because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'not_blocked',
    };
  }
}

/**
 * List the accounts a player has blocked, as `{ handle, displayName }`
 * (never `accountId`). Ordered by most-recently blocked first.
 */
export async function listBlocks(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<BlockResult<BlockView[]>> {
  try {
    const blockerId = await resolvePlayerId(pool, accountId);
    if (blockerId === null) {
      return {
        ok: false,
        reason: 'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      'SELECT blocked.display_handle, blocked.display_name ' +
        'FROM legendary.player_blocks pb ' +
        'JOIN legendary.players blocked ON blocked.player_id = pb.blocked_id ' +
        'WHERE pb.blocker_id = $1 ' +
        'ORDER BY pb.created_at DESC',
      [blockerId],
    );
    const views: BlockView[] = [];
    for (const row of result.rows) {
      // why: a blocked account without a claimed handle still lists — fall
      // back to the display name so `handle` is never null on the wire.
      views.push({
        handle: row.display_handle ?? row.display_name,
        displayName: row.display_name,
      });
    }
    return { ok: true, value: views };
  } catch (caughtError) {
    return {
      ok: false,
      reason: `The block list could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * Whether EITHER account has blocked the other. The send guard uses this
 * so a block is symmetric: a blocked pair cannot friend in either
 * direction. Returns `false` when either account fails to resolve (a
 * non-existent account cannot have blocked anyone).
 */
export async function isEitherBlocked(
  pool: DatabaseClient,
  accountIdA: AccountId,
  accountIdB: AccountId,
): Promise<boolean> {
  const playerIdA = await resolvePlayerId(pool, accountIdA);
  const playerIdB = await resolvePlayerId(pool, accountIdB);
  if (playerIdA === null || playerIdB === null) {
    return false;
  }
  // why: symmetric enforcement — a row in EITHER direction (A blocked B
  // OR B blocked A) blocks the send.
  const result = await pool.query(
    'SELECT 1 FROM legendary.player_blocks ' +
      'WHERE (blocker_id = $1 AND blocked_id = $2) ' +
      'OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
    [playerIdA, playerIdB],
  );
  return result.rows.length > 0;
}

/**
 * Count the account's OUTGOING `pending` friend requests created at or
 * after `sinceIso` — the trailing-window input to the daily rate limit.
 * Returns `0` when the account does not resolve.
 */
export async function countOutgoingPendingSince(
  pool: DatabaseClient,
  accountId: AccountId,
  sinceIso: string,
): Promise<number> {
  const playerId = await resolvePlayerId(pool, accountId);
  if (playerId === null) {
    return 0;
  }
  const result = await pool.query(
    "SELECT COUNT(*)::int AS outgoing_pending_count FROM legendary.friendships " +
      "WHERE requester_id = $1 AND status = 'pending' AND requested_at >= $2",
    [playerId, sinceIso],
  );
  return result.rows[0].outgoing_pending_count as number;
}

/**
 * The `responded_at` of the most recent request the addressee DECLINED
 * from this requester, or `null` when there is none — the cooldown
 * input. Returns `null` when either account fails to resolve.
 */
export async function mostRecentDeclineAgainst(
  pool: DatabaseClient,
  requesterAccountId: AccountId,
  addresseeAccountId: AccountId,
): Promise<string | null> {
  const requesterId = await resolvePlayerId(pool, requesterAccountId);
  const addresseeId = await resolvePlayerId(pool, addresseeAccountId);
  if (requesterId === null || addresseeId === null) {
    return null;
  }
  const result = await pool.query(
    'SELECT responded_at FROM legendary.friendships ' +
      "WHERE requester_id = $1 AND addressee_id = $2 AND status = 'declined' " +
      'ORDER BY responded_at DESC LIMIT 1',
    [requesterId, addresseeId],
  );
  if (result.rows.length === 0 || result.rows[0].responded_at === null) {
    return null;
  }
  const respondedAt = result.rows[0].responded_at;
  return respondedAt instanceof Date ? respondedAt.toISOString() : respondedAt;
}
