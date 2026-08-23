/**
 * Match Seat → Account Identity Writer — Server Layer (WP-333)
 *
 * Records the server-verified AccountId behind each authenticated seat that
 * joins a multiplayer match, in `legendary.match_seat_accounts`. This is WP-1
 * of the D-24119 faithful-replay arc: it makes the seat→account mapping durable
 * so a later capture step can call `assignReplayOwnership` per authenticated
 * seat.
 *
 * The recorded accountId is ALWAYS the server-validated session value (resolved
 * by the WP-112 orchestrator in the match gate), never a client-supplied field.
 * The mapping is stored server-side only — never in boardgame.io's
 * client-exposed `player.data` / `setupData` (D-24120).
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine`, `@legendary-arena/registry`,
 * `@legendary-arena/preplan`, or any UI / client package. The `pg` driver is
 * reachable only through the supplied `DatabaseClient`.
 *
 * Authority: WP-333 / EC-363; D-24119 (arc); D-24120 (server-only mapping +
 * best-effort write posture); D-5201 (AccountId = `legendary.players.ext_id`).
 */

import type {
  AccountId,
  DatabaseClient,
} from '../identity/identity.types.js';

/**
 * Record (or re-stamp) the account that owns a seat in a match. Idempotent: a
 * re-join of the same `(matchId, playerId)` updates `account_id` + `joined_at`
 * rather than inserting a duplicate. Throws only on an infrastructure fault
 * (connection lost, foreign-key violation for an unknown account); the caller
 * decides how to handle that — the WP-333 join handler treats it as
 * best-effort (logs and continues, because the player is already seated).
 *
 * @param matchId The boardgame.io match id.
 * @param playerId The boardgame.io seat id (e.g. `"0"`).
 * @param accountId The server-verified AccountId (= `legendary.players.ext_id`).
 * @param database The caller-injected `pg` pool.
 */
export async function recordSeatAccount(
  matchId: string,
  playerId: string,
  accountId: AccountId,
  database: DatabaseClient,
): Promise<void> {
  // why: ON CONFLICT (match_id, player_id) DO UPDATE re-stamps the account +
  // timestamp on an idempotent re-join instead of raising a duplicate-key
  // error — the seat's current occupant is authoritative. Parameterized to
  // prevent injection; the FK to legendary.players(ext_id) enforces that the
  // account exists (the session already validated it at join time).
  await database.query(
    'INSERT INTO legendary.match_seat_accounts (match_id, player_id, account_id) ' +
      'VALUES ($1, $2, $3) ' +
      'ON CONFLICT (match_id, player_id) ' +
      'DO UPDATE SET account_id = EXCLUDED.account_id, joined_at = now()',
    [matchId, playerId, accountId],
  );
}

/**
 * Read the authenticated seats recorded for a match — the `(playerId, accountId)`
 * pairs written by `recordSeatAccount` at join time. Used by the WP-335 capture
 * step to `assignReplayOwnership` per authenticated seat (bots/guests have no row,
 * D-24120, so they are simply absent from the result).
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns The recorded seats (empty when the match has no authenticated seats).
 */
export async function readSeatAccounts(
  matchId: string,
  database: DatabaseClient,
): Promise<{ playerId: string; accountId: AccountId }[]> {
  const result = await database.query(
    'SELECT player_id, account_id FROM legendary.match_seat_accounts ' +
      'WHERE match_id = $1',
    [matchId],
  );
  return result.rows.map(
    (row: { player_id: string; account_id: string }) => ({
      playerId: row.player_id,
      accountId: row.account_id as AccountId,
    }),
  );
}

/**
 * Read the bot-ally seat ids tagged for a match, from the `legendary.match_bot_ally`
 * side-table (WP-375 / D-24170). A match created with a bot ally carries a row
 * whose `bot_seats` lists the server-driven seats; every other match has no row.
 *
 * Used by the ranked-eligibility guard (WP-377 / D-24172): a non-empty result is
 * the most authoritative signal that a match had a non-account seat and must be
 * Casual, never ranked (DESIGN §5b/§5c) — defence-in-depth alongside the
 * seat-count-vs-roster backstop.
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns The bot seat ids (e.g. `['1']`), or an empty array when the match has
 *   no bot-ally row.
 */
export async function readMatchBotSeats(
  matchId: string,
  database: DatabaseClient,
): Promise<string[]> {
  const result = await database.query(
    'SELECT bot_seats FROM legendary.match_bot_ally WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return [];
  }
  // why: bot_seats is a NOT NULL text[] column, but a defensive ?? [] keeps a
  // malformed/NULL value from throwing out of the fail-safe ranked read.
  return (result.rows[0].bot_seats as string[] | null) ?? [];
}

/**
 * One seat's display identity for the endgame report card (WP-593 / D-24402):
 * which boardgame.io seat it is, whether the server drove it as a bot ally, and
 * the human's chosen handle when the seat maps to an authenticated account.
 *
 * `handle` is `null` for a bot seat, a guest seat (no account row), and an
 * account with no display handle set — every case the client renders as a plain
 * "Player N". This is DERIVED match metadata, never persisted onto the score row.
 */
export interface MatchSeatIdentity {
  readonly playerId: string;
  readonly isBot: boolean;
  readonly handle: string | null;
}

/**
 * Resolve the display handles for a set of accounts in one query, returned as an
 * `accountId → handle` map. An account with no `display_handle` (or an empty one)
 * is simply absent from the map, so the caller reads `null` for it.
 *
 * @param accountIds The accounts to resolve (may be empty).
 * @param database The caller-injected `pg` pool.
 * @returns A map from AccountId to the non-empty display handle.
 */
async function readHandlesByAccountIds(
  accountIds: readonly AccountId[],
  database: DatabaseClient,
): Promise<Map<AccountId, string>> {
  const handleByAccount = new Map<AccountId, string>();
  if (accountIds.length === 0) {
    return handleByAccount;
  }
  // why: ANY($1) resolves every seat's handle in a single round trip rather than
  // one query per seat; display_handle is the player's chosen public name
  // (legendary.players), the same column the friendships surfaces read.
  const result = await database.query(
    'SELECT ext_id, display_handle FROM legendary.players ' +
      'WHERE ext_id = ANY($1)',
    [accountIds],
  );
  for (const row of result.rows as {
    ext_id: string;
    display_handle: string | null;
  }[]) {
    if (typeof row.display_handle === 'string' && row.display_handle !== '') {
      handleByAccount.set(row.ext_id as AccountId, row.display_handle);
    }
  }
  return handleByAccount;
}

/**
 * Build the per-seat display identities for a finished match (WP-593 / D-24402):
 * for each of the `seatCount` seats, whether it was a bot ally and the human
 * handle behind it when the seat maps to an authenticated account. Combines the
 * WP-333 seat→account mapping, the WP-375 bot-ally tag, and the handle lookup.
 *
 * The result is a full 0..seatCount-1 roster (never sparse): a seat with neither
 * an account row nor a bot tag (a guest) comes back `{ isBot: false, handle: null }`,
 * which the client renders as a plain "Player N". This is derived, read-time
 * match metadata for the endgame report card — never written to the score row.
 *
 * @param matchId The boardgame.io match id.
 * @param seatCount The number of seats the match was played with (1-5).
 * @param database The caller-injected `pg` pool.
 * @returns One identity per seat, ordered by seat index ("0", "1", ...).
 */
export async function readSeatIdentities(
  matchId: string,
  seatCount: number,
  database: DatabaseClient,
): Promise<MatchSeatIdentity[]> {
  const roster = await readSeatAccounts(matchId, database);
  const botSeats = await readMatchBotSeats(matchId, database);
  const accountByPlayer = new Map<string, AccountId>();
  for (const seat of roster) {
    accountByPlayer.set(seat.playerId, seat.accountId);
  }
  const botSeatSet = new Set(botSeats);
  const handleByAccount = await readHandlesByAccountIds(
    roster.map((seat) => seat.accountId),
    database,
  );

  const identities: MatchSeatIdentity[] = [];
  // why: enumerate every seat 0..seatCount-1 so the client can label all players,
  // including a guest seat that has neither an account row (readSeatAccounts) nor a
  // bot tag (readMatchBotSeats) — it comes back as a plain, unnamed "Player N".
  for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
    const playerId = String(seatIndex);
    const accountId = accountByPlayer.get(playerId) ?? null;
    const handle =
      accountId === null ? null : handleByAccount.get(accountId) ?? null;
    identities.push({
      playerId,
      isBot: botSeatSet.has(playerId),
      handle,
    });
  }
  return identities;
}
