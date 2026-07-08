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
