/**
 * Friendship Logic — Server Layer (WP-350)
 *
 * The friendship state machine + list helpers + mutual-clique helper —
 * packet #1 of the Friends & Ranked Trust subsystem
 * (`wiki/profile-login.md §Friends & Ranked Trust Layer`). Every public
 * function is keyed on `AccountId` (`ext_id`), resolves `ext_id →
 * player_id` inline against `legendary.players`, and wraps DB work in
 * `try/catch → typed FriendshipResult` (mirroring the WP-104
 * `ownerProfile.logic.ts` posture). The sole exception is
 * `areAllMutualFriends`, a pure predicate returning a bare `boolean`
 * (packet #5's ranked gate consumes it; a real DB fault may reject).
 *
 * Layer-boundary contract: this module imports nothing from the game
 * engine, the registry, the pre-planning package, the boardgame
 * framework, or any UI / client / replay-producer package (the
 * verification grep in the EC enforces the absence of those imports).
 * The `pg` driver is reachable only through the `DatabaseClient` alias
 * re-imported from the identity layer.
 *
 * Symmetry (FR-4): an accepted friendship is stored ONCE per unordered
 * pair (the normalized `LEAST/GREATEST` unique index in migration 028);
 * `requester_id` / `addressee_id` record only who initiated the request.
 * A friendship survives renames because it is identified solely by the
 * two `AccountId`s (FR-2 / FR-3).
 *
 * Authority: WP-350 §Scope (In) §C; EC-380 §Locked Values; D-24142.
 */

import type {
  AccountId,
  DatabaseClient,
  FriendshipResult,
  FriendshipStatus,
  FriendshipView,
} from './friendships.types.js';

/**
 * Internal row shape for a `legendary.friendships` read that also joins
 * the two parties' `ext_id`s. `player_id` and `ext_id` values arrive as
 * `string` (bigint) or `number` from `pg`; timestamps as `Date` or
 * `string`. Mapped to the wire `FriendshipView` by
 * `composeFriendshipView`.
 */
interface FriendshipRow {
  requester_id: string | number;
  addressee_id: string | number;
  requester_ext_id: string;
  addressee_ext_id: string;
  status: string;
  requested_at: Date | string;
  responded_at: Date | string | null;
}

/**
 * Coerce a `pg` timestamptz value (`Date` or already-ISO `string`) to an
 * ISO-8601 string. `requested_at` is `NOT NULL` so this never receives
 * `null`; `responded_at` uses `coerceNullableTimestamp` instead.
 */
function coerceTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Coerce a nullable `pg` timestamptz value to an ISO-8601 string or
 * `null`. Used for `responded_at`, which is `null` while a request is
 * pending.
 */
function coerceNullableTimestamp(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Coerce a `pg` bigint value (`string` or `number`) to a plain `number`.
 * Player-id values are well within the safe-integer range for the
 * foreseeable player population.
 */
function coercePlayerId(value: string | number): number {
  return typeof value === 'string' ? Number(value) : value;
}

/**
 * Resolve an `AccountId` (`ext_id`) to the internal bigint `player_id`,
 * or `null` when no `legendary.players` row matches. Pure read — no
 * mutation. Mirrors the WP-104 `loadPlayerIdByAccountId` resolution SQL.
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
  return coercePlayerId(result.rows[0].player_id);
}

/**
 * Project a joined `FriendshipRow` to a `FriendshipView` from the
 * perspective of `viewerPlayerId`. The "other" party is whichever
 * endpoint is not the viewer; `direction` is `'incoming'` when the
 * viewer is the row's addressee (they received the request) and
 * `'outgoing'` when the viewer is the requester (they sent it).
 */
function composeFriendshipView(
  row: FriendshipRow,
  viewerPlayerId: number,
): FriendshipView {
  const requesterId = coercePlayerId(row.requester_id);
  const viewerIsRequester = requesterId === viewerPlayerId;
  const otherAccountId = (
    viewerIsRequester ? row.addressee_ext_id : row.requester_ext_id
  ) as AccountId;
  return {
    otherAccountId,
    status: row.status as FriendshipStatus,
    direction: viewerIsRequester ? 'outgoing' : 'incoming',
    requestedAt: coerceTimestamp(row.requested_at),
    respondedAt: coerceNullableTimestamp(row.responded_at),
  };
}

/**
 * The SELECT column list shared by every read path that returns a
 * `FriendshipView`. Joins both parties' `ext_id` so the caller can
 * project the "other" account without a second round-trip.
 */
const FRIENDSHIP_SELECT =
  'SELECT f.requester_id, f.addressee_id, ' +
  'requester.ext_id AS requester_ext_id, addressee.ext_id AS addressee_ext_id, ' +
  'f.status, f.requested_at, f.responded_at ' +
  'FROM legendary.friendships f ' +
  'JOIN legendary.players requester ON requester.player_id = f.requester_id ' +
  'JOIN legendary.players addressee ON addressee.player_id = f.addressee_id ';

/**
 * Send a friend request from one account to another, or re-open a
 * previously declined pair. Guards self-request, unknown accounts, an
 * existing pending pair (either direction), and an already-accepted
 * pair. On a `declined` pair it transitions `declined → pending` via
 * UPDATE (never a second row). Returns the resulting pending
 * `FriendshipView` from the sender's perspective (`direction:
 * 'outgoing'`).
 */
export async function sendFriendRequest(
  pool: DatabaseClient,
  fromAccountId: AccountId,
  toAccountId: AccountId,
): Promise<FriendshipResult<FriendshipView>> {
  if (fromAccountId === toAccountId) {
    return {
      ok: false,
      reason:
        'A friend request cannot be sent to yourself; the sender and recipient accounts are identical.',
      code: 'self_friendship',
    };
  }
  try {
    const fromPlayerId = await resolvePlayerId(pool, fromAccountId);
    const toPlayerId = await resolvePlayerId(pool, toAccountId);
    // why: 'unknown_account' does not reveal WHICH of the two accounts
    // failed to resolve — no account-existence enumeration (consistent
    // with the WP-102 player_not_found single-code posture).
    if (fromPlayerId === null || toPlayerId === null) {
      return {
        ok: false,
        reason:
          'One or both accounts in the friend request could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }

    const existing = await pool.query(
      'SELECT friendship_id, status FROM legendary.friendships ' +
        'WHERE LEAST(requester_id, addressee_id) = LEAST($1::bigint, $2::bigint) ' +
        'AND GREATEST(requester_id, addressee_id) = GREATEST($1::bigint, $2::bigint) LIMIT 1',
      [fromPlayerId, toPlayerId],
    );

    if (existing.rows.length > 0) {
      const existingStatus = existing.rows[0].status as FriendshipStatus;
      if (existingStatus === 'accepted') {
        return {
          ok: false,
          reason:
            'These accounts are already friends; no new friend request is needed.',
          code: 'already_friends',
        };
      }
      if (existingStatus === 'pending') {
        return {
          ok: false,
          reason:
            'A friend request between these accounts is already pending; wait for it to be accepted or declined.',
          code: 'already_pending',
        };
      }
      // why: a declined pair is re-opened by UPDATE, never a second row —
      // the sender may differ from the original requester, so
      // requester_id / addressee_id are rewritten and requested_at is
      // reset to now() with responded_at cleared back to null.
      const reopened = await pool.query(
        'UPDATE legendary.friendships ' +
          "SET requester_id = $1, addressee_id = $2, status = 'pending', " +
          'requested_at = now(), responded_at = null ' +
          'WHERE friendship_id = $3 ' +
          'RETURNING status, requested_at, responded_at',
        [fromPlayerId, toPlayerId, existing.rows[0].friendship_id],
      );
      const reopenedRow = reopened.rows[0];
      return {
        ok: true,
        value: {
          otherAccountId: toAccountId,
          status: reopenedRow.status as FriendshipStatus,
          direction: 'outgoing',
          requestedAt: coerceTimestamp(reopenedRow.requested_at),
          respondedAt: coerceNullableTimestamp(reopenedRow.responded_at),
        },
      };
    }

    const inserted = await pool.query(
      'INSERT INTO legendary.friendships (requester_id, addressee_id, status) ' +
        "VALUES ($1, $2, 'pending') " +
        'RETURNING status, requested_at, responded_at',
      [fromPlayerId, toPlayerId],
    );
    const insertedRow = inserted.rows[0];
    return {
      ok: true,
      value: {
        otherAccountId: toAccountId,
        status: insertedRow.status as FriendshipStatus,
        direction: 'outgoing',
        requestedAt: coerceTimestamp(insertedRow.requested_at),
        respondedAt: coerceNullableTimestamp(insertedRow.responded_at),
      },
    };
  } catch (caughtError) {
    // why: infra backstop — the closed FriendshipErrorCode union has no
    // generic infra-failure code, so an unexpected DB fault surfaces
    // under the nearest in-domain code with the driver error text kept
    // in `reason` for diagnosis (AC-6: no function throws uncaught). The
    // explicit guards above cover every expected failure, so this only
    // fires on a genuine driver/connection fault.
    return {
      ok: false,
      reason: `The friend request could not be saved because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * Shared responder for `acceptFriendRequest` / `declineFriendRequest`.
 * Only the original addressee of a `pending` row may respond. Resolves
 * both accounts, finds the pending row for the unordered pair, verifies
 * the responder is that row's addressee, and transitions the row to
 * `nextStatus` with `responded_at = now()`. Returns the resulting
 * `FriendshipView` from the addressee's perspective (`direction:
 * 'incoming'`).
 */
async function respondToPendingRequest(
  pool: DatabaseClient,
  addresseeAccountId: AccountId,
  requesterAccountId: AccountId,
  nextStatus: 'accepted' | 'declined',
): Promise<FriendshipResult<FriendshipView>> {
  try {
    const addresseePlayerId = await resolvePlayerId(pool, addresseeAccountId);
    const requesterPlayerId = await resolvePlayerId(pool, requesterAccountId);
    if (addresseePlayerId === null || requesterPlayerId === null) {
      return {
        ok: false,
        reason:
          'One or both accounts in the friend request could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }

    const pending = await pool.query(
      'SELECT friendship_id, requester_id, addressee_id FROM legendary.friendships ' +
        'WHERE LEAST(requester_id, addressee_id) = LEAST($1::bigint, $2::bigint) ' +
        'AND GREATEST(requester_id, addressee_id) = GREATEST($1::bigint, $2::bigint) ' +
        "AND status = 'pending' LIMIT 1",
      [addresseePlayerId, requesterPlayerId],
    );
    if (pending.rows.length === 0) {
      return {
        ok: false,
        reason:
          'There is no pending friend request between these accounts to respond to.',
        code: 'no_pending_request',
      };
    }

    // why: only the row's original addressee may accept or decline. If
    // the responder is actually the requester of the pending row (the
    // direction is reversed), reject with 'not_addressee' rather than
    // letting a requester accept their own outgoing request.
    const pendingAddresseeId = coercePlayerId(pending.rows[0].addressee_id);
    if (pendingAddresseeId !== addresseePlayerId) {
      return {
        ok: false,
        reason:
          'Only the account that received the friend request may accept or decline it.',
        code: 'not_addressee',
      };
    }

    // why: responded_at records when the addressee acted; set to now()
    // on both accept and decline.
    const updated = await pool.query(
      'UPDATE legendary.friendships SET status = $1, responded_at = now() ' +
        'WHERE friendship_id = $2 ' +
        'RETURNING status, requested_at, responded_at',
      [nextStatus, pending.rows[0].friendship_id],
    );
    const updatedRow = updated.rows[0];
    return {
      ok: true,
      value: {
        otherAccountId: requesterAccountId,
        status: updatedRow.status as FriendshipStatus,
        direction: 'incoming',
        requestedAt: coerceTimestamp(updatedRow.requested_at),
        respondedAt: coerceNullableTimestamp(updatedRow.responded_at),
      },
    };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault; the guards above cover every expected
    // failure.
    return {
      ok: false,
      reason: `The friend request response could not be saved because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'no_pending_request',
    };
  }
}

/**
 * Accept a pending friend request. Only the original addressee may
 * accept; transitions the pending row to `accepted` and sets
 * `responded_at`.
 */
export async function acceptFriendRequest(
  pool: DatabaseClient,
  addresseeAccountId: AccountId,
  requesterAccountId: AccountId,
): Promise<FriendshipResult<FriendshipView>> {
  return respondToPendingRequest(
    pool,
    addresseeAccountId,
    requesterAccountId,
    'accepted',
  );
}

/**
 * Decline a pending friend request. Only the original addressee may
 * decline; transitions the pending row to `declined` and sets
 * `responded_at`. A later `sendFriendRequest` re-opens the pair.
 */
export async function declineFriendRequest(
  pool: DatabaseClient,
  addresseeAccountId: AccountId,
  requesterAccountId: AccountId,
): Promise<FriendshipResult<FriendshipView>> {
  return respondToPendingRequest(
    pool,
    addresseeAccountId,
    requesterAccountId,
    'declined',
  );
}

/**
 * Remove an accepted friendship. Either party may remove it; the row is
 * DELETEd (symmetric), so re-friending later is a fresh request rather
 * than a status flip. Returns `not_friends` when no accepted row exists
 * for the pair.
 */
export async function removeFriend(
  pool: DatabaseClient,
  accountId: AccountId,
  otherAccountId: AccountId,
): Promise<FriendshipResult<void>> {
  try {
    const playerId = await resolvePlayerId(pool, accountId);
    const otherPlayerId = await resolvePlayerId(pool, otherAccountId);
    if (playerId === null || otherPlayerId === null) {
      return {
        ok: false,
        reason:
          'One or both accounts could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }

    // why: removeFriend DELETEs the accepted row (symmetric) rather than
    // flipping a status — re-friending later is a brand-new request.
    const deleted = await pool.query(
      'DELETE FROM legendary.friendships ' +
        'WHERE LEAST(requester_id, addressee_id) = LEAST($1::bigint, $2::bigint) ' +
        'AND GREATEST(requester_id, addressee_id) = GREATEST($1::bigint, $2::bigint) ' +
        "AND status = 'accepted'",
      [playerId, otherPlayerId],
    );
    if (deleted.rowCount === 0) {
      return {
        ok: false,
        reason:
          'These accounts are not friends, so there is no accepted friendship to remove.',
        code: 'not_friends',
      };
    }
    return { ok: true, value: undefined };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault; the guards above cover every expected
    // failure.
    return {
      ok: false,
      reason: `The friendship could not be removed because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'not_friends',
    };
  }
}

/**
 * List an account's accepted friendships as `FriendshipView[]`. Returns
 * an empty array when the account has no friends (or does not resolve).
 */
export async function listFriends(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<FriendshipResult<FriendshipView[]>> {
  try {
    const playerId = await resolvePlayerId(pool, accountId);
    if (playerId === null) {
      return {
        ok: false,
        reason:
          'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      FRIENDSHIP_SELECT +
        "WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted' " +
        'ORDER BY f.requested_at ASC',
      [playerId],
    );
    const views: FriendshipView[] = [];
    for (const row of result.rows as FriendshipRow[]) {
      views.push(composeFriendshipView(row, playerId));
    }
    return { ok: true, value: views };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault on this read path.
    return {
      ok: false,
      reason: `The friends list could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * List the pending friend requests an account has RECEIVED (it is the
 * addressee). Every returned `FriendshipView` has `direction:
 * 'incoming'`.
 */
export async function listIncomingRequests(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<FriendshipResult<FriendshipView[]>> {
  try {
    const playerId = await resolvePlayerId(pool, accountId);
    if (playerId === null) {
      return {
        ok: false,
        reason:
          'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      FRIENDSHIP_SELECT +
        "WHERE f.addressee_id = $1 AND f.status = 'pending' " +
        'ORDER BY f.requested_at ASC',
      [playerId],
    );
    const views: FriendshipView[] = [];
    for (const row of result.rows as FriendshipRow[]) {
      views.push(composeFriendshipView(row, playerId));
    }
    return { ok: true, value: views };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault on this read path.
    return {
      ok: false,
      reason: `The incoming friend requests could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * List the pending friend requests an account has SENT (it is the
 * requester). Every returned `FriendshipView` has `direction:
 * 'outgoing'`.
 */
export async function listOutgoingRequests(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<FriendshipResult<FriendshipView[]>> {
  try {
    const playerId = await resolvePlayerId(pool, accountId);
    if (playerId === null) {
      return {
        ok: false,
        reason:
          'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      FRIENDSHIP_SELECT +
        "WHERE f.requester_id = $1 AND f.status = 'pending' " +
        'ORDER BY f.requested_at ASC',
      [playerId],
    );
    const views: FriendshipView[] = [];
    for (const row of result.rows as FriendshipRow[]) {
      views.push(composeFriendshipView(row, playerId));
    }
    return { ok: true, value: views };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault on this read path.
    return {
      ok: false,
      reason: `The outgoing friend requests could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * Report the stored status of the friendship between two accounts, or
 * `'none'` when no row exists for the pair. Returns `unknown_account`
 * when either account fails to resolve.
 */
export async function getFriendshipStatus(
  pool: DatabaseClient,
  accountIdA: AccountId,
  accountIdB: AccountId,
): Promise<FriendshipResult<FriendshipStatus | 'none'>> {
  try {
    const playerIdA = await resolvePlayerId(pool, accountIdA);
    const playerIdB = await resolvePlayerId(pool, accountIdB);
    if (playerIdA === null || playerIdB === null) {
      return {
        ok: false,
        reason:
          'One or both accounts could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      'SELECT status FROM legendary.friendships ' +
        'WHERE LEAST(requester_id, addressee_id) = LEAST($1::bigint, $2::bigint) ' +
        'AND GREATEST(requester_id, addressee_id) = GREATEST($1::bigint, $2::bigint) LIMIT 1',
      [playerIdA, playerIdB],
    );
    if (result.rows.length === 0) {
      return { ok: true, value: 'none' };
    }
    return { ok: true, value: result.rows[0].status as FriendshipStatus };
  } catch (caughtError) {
    // why: infra backstop (see sendFriendRequest) — nearest in-set code
    // for an unexpected DB fault on this read path.
    return {
      ok: false,
      reason: `The friendship status could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * The mutual-clique helper (FR-6) — a pure predicate over the accepted-
 * friendship relation. Reports whether every distinct pair among the
 * supplied accounts is an accepted friendship. It decides NOTHING about
 * leaderboard eligibility, anti-cheat, or matchmaking; those policies
 * stay owned by their consuming subsystems (the ranked gate is packet
 * #5).
 *
 * Algorithm (locked, D-24142): de-duplicate the `n` `AccountId`s and
 * resolve them to `n` `player_id`s; the set is a clique iff the count of
 * `accepted` rows with BOTH endpoints in the set equals `n*(n-1)/2`. The
 * normalized-pair unique index guarantees at most one row per pair, so
 * the count equals the number of connected pairs. `n ≤ 1` is vacuously
 * `true`. An account that fails to resolve cannot be in any clique →
 * `false`.
 *
 * Not wrapped in `FriendshipResult`: a bare `boolean` per the FR-6 pure-
 * predicate contract. A real DB fault rejects the returned promise.
 */
export async function areAllMutualFriends(
  pool: DatabaseClient,
  accountIds: readonly AccountId[],
): Promise<boolean> {
  // why: repeated AccountIds are removed before evaluation so [A,B,C],
  // [A,A,B,C], and [B,C,A,A] are equivalent and return the same result
  // (order- and duplicate-independent).
  const uniqueAccountIds = [...new Set(accountIds)];
  const n = uniqueAccountIds.length;
  // why: a set of zero or one account is vacuously a clique — there are
  // no distinct pairs that could fail the all-friends test.
  if (n <= 1) {
    return true;
  }

  const resolved = await pool.query(
    'SELECT player_id FROM legendary.players WHERE ext_id = ANY($1::text[])',
    [uniqueAccountIds],
  );
  // why: if any supplied account did not resolve to a player_id, the set
  // includes a non-existent account and cannot be a clique.
  if (resolved.rows.length !== n) {
    return false;
  }
  const playerIds: number[] = [];
  for (const row of resolved.rows) {
    playerIds.push(coercePlayerId(row.player_id));
  }

  const counted = await pool.query(
    'SELECT COUNT(*)::int AS accepted_pair_count FROM legendary.friendships ' +
      "WHERE status = 'accepted' " +
      'AND requester_id = ANY($1::bigint[]) AND addressee_id = ANY($1::bigint[])',
    [playerIds],
  );
  const acceptedPairCount = counted.rows[0].accepted_pair_count as number;
  // why: C(n,2) = n*(n-1)/2 is the number of distinct pairs; the set is a
  // clique iff every one of them has an accepted row.
  const requiredPairCount = (n * (n - 1)) / 2;
  return acceptedPairCount === requiredPairCount;
}
