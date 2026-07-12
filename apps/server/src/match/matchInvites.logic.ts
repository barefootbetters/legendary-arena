/**
 * Match Invite Logic — Server Layer (WP-358)
 *
 * The friend-addressed match-invite state machine: a seated player invites an
 * accepted friend into their match; the invitee lists, accepts, or declines.
 * Accept marks the invite `accepted` — the client then joins via the existing
 * `POST /api/match/join`; this module performs NO boardgame.io join.
 *
 * Every function is keyed on `AccountId`; the table stores `player_id`
 * (resolved inline). Returned views carry the inviter's `handle` +
 * `displayName` ONLY — never an `accountId` (FR-2).
 *
 * Layer-boundary contract: imports `pg` types + same-layer helpers
 * (`readSeatAccounts`, `getFriendshipStatus`) only. Nothing from the game
 * engine, the registry, or `boardgame.io`.
 *
 * Authority: WP-358 §Scope (In) §C; EC-388 §Locked Values; D-24150;
 * D-24142 (friendship model reuse); WP-333 (`readSeatAccounts`).
 */

import type {
  AccountId,
  DatabaseClient,
  MatchInviteResult,
  MatchInviteView,
} from './matchInvites.types.js';
import { readSeatAccounts } from './seatAccount.logic.js';
import { getFriendshipStatus } from '../friendships/friendships.logic.js';

/**
 * Resolve an `AccountId` (`ext_id`) to the internal `player_id`, or `null`
 * when no `legendary.players` row matches.
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
  return result.rows[0].player_id as number;
}

/**
 * The inviter identity fields needed to build a `MatchInviteView`.
 */
interface InviterIdentity {
  readonly playerId: number;
  readonly handle: string;
  readonly displayName: string;
}

/**
 * Resolve an inviter's `player_id` + `handle` + `displayName` in one read.
 * `handle` falls back to `displayName` in the (friends-only-impossible) case
 * of an unclaimed handle, guaranteeing a non-null wire string.
 */
async function resolveInviterIdentity(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<InviterIdentity | null> {
  const result = await pool.query(
    'SELECT player_id, COALESCE(display_handle, display_name) AS handle, display_name ' +
      'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    playerId: row.player_id as number,
    handle: row.handle as string,
    displayName: row.display_name as string,
  };
}

/**
 * Map a joined `match_invites` + inviter row to the `MatchInviteView` wire
 * shape (no `accountId`).
 */
function mapInviteRow(row: {
  match_id: string;
  status: string;
  created_at: Date | string;
  inviter_handle: string;
  inviter_display_name: string;
}): MatchInviteView {
  const createdAtIso =
    row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    matchId: row.match_id,
    inviterHandle: row.inviter_handle,
    inviterDisplayName: row.inviter_display_name,
    status: row.status as MatchInviteView['status'],
    createdAt: createdAtIso,
  };
}

/**
 * Invite an accepted friend into a match. Guards, in order: self-invite;
 * unknown account; inviter must be seated in the match (`readSeatAccounts`);
 * invitee must be an accepted friend (`getFriendshipStatus === 'accepted'`) —
 * friends-only makes this anti-spam + block-respecting by construction. A
 * `declined` prior invite for the pair transitions `declined -> pending` via
 * UPDATE; a `pending`/`accepted` prior invite is rejected `already_invited`.
 * Returns the created/updated invite as a `MatchInviteView`.
 */
export async function createMatchInvite(
  pool: DatabaseClient,
  inviterAccountId: AccountId,
  inviteeAccountId: AccountId,
  matchId: string,
): Promise<MatchInviteResult<MatchInviteView>> {
  try {
    if (inviterAccountId === inviteeAccountId) {
      return {
        ok: false,
        reason: 'You cannot invite yourself to a match.',
        code: 'self_invite',
      };
    }
    const inviter = await resolveInviterIdentity(pool, inviterAccountId);
    const inviteePlayerId = await resolvePlayerId(pool, inviteeAccountId);
    if (inviter === null || inviteePlayerId === null) {
      return {
        ok: false,
        reason:
          'One or both accounts could not be found; check that both account identifiers are valid.',
        code: 'unknown_account',
      };
    }

    // why: you can only invite into a match you have joined — the inviter's
    // authenticated seat must be recorded for this match (WP-333). Bots and
    // guests have no seat row and so cannot invite.
    const seats = await readSeatAccounts(matchId, pool);
    const inviterSeated = seats.some(
      (seat) => seat.accountId === inviterAccountId,
    );
    if (!inviterSeated) {
      return {
        ok: false,
        reason:
          'You can only invite a friend to a match you have joined; no seat is recorded for you in this match.',
        code: 'not_in_match',
      };
    }

    // why: friends-only by design — the invitee must be an accepted friend of
    // the inviter. This makes match invites anti-spam by construction (only
    // friends can invite) and block-respecting (a block severs friendship, so
    // a blocked person is not a friend). Non-friends use the shareable link.
    const friendship = await getFriendshipStatus(
      pool,
      inviterAccountId,
      inviteeAccountId,
    );
    if (friendship.ok === false || friendship.value !== 'accepted') {
      return {
        ok: false,
        reason:
          'You can only invite an accepted friend to a match; send a friend request first.',
        code: 'not_friends',
      };
    }

    // why: one invite per (match, invitee). A prior pending/accepted invite is
    // already_invited; a prior declined invite is re-openable via UPDATE
    // (declined -> pending), resetting the inviter + timestamps.
    const existing = await pool.query(
      'SELECT status FROM legendary.match_invites ' +
        'WHERE match_id = $1 AND invitee_id = $2 LIMIT 1',
      [matchId, inviteePlayerId],
    );
    if (existing.rows.length > 0) {
      const currentStatus = existing.rows[0].status as string;
      if (currentStatus !== 'declined') {
        return {
          ok: false,
          reason:
            'That friend already has a pending or accepted invite to this match.',
          code: 'already_invited',
        };
      }
      await pool.query(
        'UPDATE legendary.match_invites ' +
          "SET inviter_id = $1, status = 'pending', created_at = now(), responded_at = NULL " +
          'WHERE match_id = $2 AND invitee_id = $3',
        [inviter.playerId, matchId, inviteePlayerId],
      );
    } else {
      await pool.query(
        'INSERT INTO legendary.match_invites (match_id, inviter_id, invitee_id) ' +
          'VALUES ($1, $2, $3)',
        [matchId, inviter.playerId, inviteePlayerId],
      );
    }

    // why: return the created/updated invite as the wire view. created_at is
    // read back so the response reflects the row's actual timestamp.
    const created = await pool.query(
      'SELECT match_id, status, created_at FROM legendary.match_invites ' +
        'WHERE match_id = $1 AND invitee_id = $2 LIMIT 1',
      [matchId, inviteePlayerId],
    );
    const row = created.rows[0];
    return {
      ok: true,
      value: mapInviteRow({
        match_id: row.match_id,
        status: row.status,
        created_at: row.created_at,
        inviter_handle: inviter.handle,
        inviter_display_name: inviter.displayName,
      }),
    };
  } catch (caughtError) {
    // why: infra backstop — an unexpected DB fault maps to the nearest in-set
    // code (unknown_account) rather than throwing; the route surfaces it.
    return {
      ok: false,
      reason: `The match invite could not be created because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * List the caller's pending incoming match invites, enriched with each
 * inviter's `handle` + `displayName` (one JOIN, no N+1). Newest first.
 */
export async function listIncomingMatchInvites(
  pool: DatabaseClient,
  accountId: AccountId,
): Promise<MatchInviteResult<MatchInviteView[]>> {
  try {
    const inviteePlayerId = await resolvePlayerId(pool, accountId);
    if (inviteePlayerId === null) {
      return {
        ok: false,
        reason:
          'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      'SELECT mi.match_id, mi.status, mi.created_at, ' +
        'COALESCE(p.display_handle, p.display_name) AS inviter_handle, ' +
        'p.display_name AS inviter_display_name ' +
        'FROM legendary.match_invites mi ' +
        'JOIN legendary.players p ON p.player_id = mi.inviter_id ' +
        "WHERE mi.invitee_id = $1 AND mi.status = 'pending' " +
        'ORDER BY mi.created_at DESC, mi.invite_id DESC',
      [inviteePlayerId],
    );
    const invites: MatchInviteView[] = [];
    for (const row of result.rows) {
      invites.push(mapInviteRow(row));
    }
    return { ok: true, value: invites };
  } catch (caughtError) {
    return {
      ok: false,
      reason: `The match invites could not be read because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}

/**
 * Accept the caller's pending invite to `matchId` — marks it `accepted`. The
 * caller then joins via the existing `POST /api/match/join` (this function
 * performs NO boardgame.io join). `invite_not_found` when the caller has no
 * pending invite to that match.
 */
export async function acceptMatchInvite(
  pool: DatabaseClient,
  accountId: AccountId,
  matchId: string,
): Promise<MatchInviteResult<void>> {
  return respondToMatchInvite(pool, accountId, matchId, 'accepted');
}

/**
 * Decline the caller's pending invite to `matchId` — marks it `declined`.
 * `invite_not_found` when the caller has no pending invite to that match.
 */
export async function declineMatchInvite(
  pool: DatabaseClient,
  accountId: AccountId,
  matchId: string,
): Promise<MatchInviteResult<void>> {
  return respondToMatchInvite(pool, accountId, matchId, 'declined');
}

/**
 * Shared accept/decline path: transition the caller's `pending` invite for
 * `matchId` to the given terminal status, stamping `responded_at`. Only a
 * `pending` invite for the calling invitee is affected.
 */
async function respondToMatchInvite(
  pool: DatabaseClient,
  accountId: AccountId,
  matchId: string,
  nextStatus: 'accepted' | 'declined',
): Promise<MatchInviteResult<void>> {
  try {
    const inviteePlayerId = await resolvePlayerId(pool, accountId);
    if (inviteePlayerId === null) {
      return {
        ok: false,
        reason:
          'The account could not be found; check that the account identifier is valid.',
        code: 'unknown_account',
      };
    }
    const result = await pool.query(
      'UPDATE legendary.match_invites ' +
        'SET status = $1, responded_at = now() ' +
        "WHERE match_id = $2 AND invitee_id = $3 AND status = 'pending' " +
        'RETURNING invite_id',
      [nextStatus, matchId, inviteePlayerId],
    );
    if (result.rows.length === 0) {
      return {
        ok: false,
        reason:
          'No pending invite to that match was found for your account.',
        code: 'invite_not_found',
      };
    }
    return { ok: true, value: undefined };
  } catch (caughtError) {
    return {
      ok: false,
      reason: `The match invite response could not be recorded because the database query failed: ${String(
        caughtError,
      )}.`,
      code: 'unknown_account',
    };
  }
}
