/**
 * Shared Cooperative Badge Issuance — Server Layer (WP-614)
 *
 * `issueSharedMatchBadges` awards the first shared / table badge —
 * `gameplay.shared.united-front` — to EVERY player of a co-op match when the
 * whole table qualifies. It groups the per-player `legendary.competitive_scores`
 * rows by `replay_hash`: every player of one match derives the SAME `replay_hash`
 * (submission is by `matchId`, WP-338 — the server resolves the hash from the
 * shared replay artifact), so a `replay_hash` group is exactly that match's
 * players. The badge is a projection over the immutable competitive rows
 * (D-5302 / D-1004) — it never re-executes a replay or recomputes a score.
 *
 * Layer-boundary contract: no imports from `boardgame.io`,
 * `@legendary-arena/game-engine` (runtime), `@legendary-arena/registry`,
 * `@legendary-arena/preplan`, or any UI package. The `pg` driver is reachable
 * only through `DatabaseClient`.
 *
 * Authority: WP-614 §Scope (In) §B; EC-649 §Locked Values + §Guardrails;
 * D-24425; D-1004 (append-only, anti-volume, no-PvP); D-5302 (immutable rows).
 */

import type { DatabaseClient } from '../identity/identity.types.js';

// why: a shared / table badge is only meaningful for an actual TABLE — two or
// more players. A solo (or NULL-count) match can never earn it, which is the
// point: it cannot be farmed alone.
const MINIMUM_TABLE_SIZE = 2;

/** The badge key awarded when a whole co-op table finishes sub-PAR. */
const UNITED_FRONT_KEY = 'gameplay.shared.united-front';

/**
 * Evaluate and (if the whole table qualifies) issue the shared cooperative
 * badge for a completed co-op match, grouping by `replayHash`.
 *
 * Awards `gameplay.shared.united-front` to EVERY player in the group when all of:
 * - `playerCount >= 2` (a real table — a solo / NULL-count match never qualifies);
 * - the group is COMPLETE: the number of submitted rows equals `playerCount`
 *   (every player at the table has recorded their competitive score); and
 * - EVERY player finished sub-PAR (`final_score < 0`).
 *
 * Runs on every submission. Earlier submissions see an incomplete group and
 * award nothing; only the submission that completes the group awards everyone
 * (last-submitter-awards-all). The multi-row INSERT reuses `ON CONFLICT DO
 * NOTHING`, so a repeated full-group evaluation across the table's submitters is
 * idempotent. `source_kind = 'competitive_history'` with `source_ref = NULL`
 * (the badge is evaluated over a group, not a single score row) — reusing the
 * existing migration-013 CHECK, so no migration is required.
 *
 * MUST execute within the caller's transaction context. MUST NOT open its own
 * BEGIN/COMMIT.
 */
export async function issueSharedMatchBadges(
  replayHash: string,
  playerCount: number | null,
  configVersion: number,
  database: DatabaseClient,
): Promise<void> {
  // why: NULL player_count is unknown and a sub-2 count is not a table — neither
  // can earn a shared badge, so short-circuit before the group query.
  if (playerCount === null || playerCount < MINIMUM_TABLE_SIZE) {
    return;
  }

  const result = await database.query(
    'SELECT player_id, final_score ' +
      'FROM legendary.competitive_scores ' +
      'WHERE replay_hash = $1',
    [replayHash],
  );
  const rows = result.rows;

  // why: the completeness gate — award only once every player at the table has
  // recorded their score. An incomplete group (an earlier submitter's hook) is a
  // no-op; the completing submission is the one that awards the whole table.
  if (rows.length !== playerCount) {
    return;
  }

  // why: shared + ungameable — the badge requires EVERY player to have finished
  // sub-PAR, so no single player's strong run can earn it for the table.
  let everyPlayerSubPar = true;
  for (const row of rows) {
    if (Number(row.final_score) >= 0) {
      everyPlayerSubPar = false;
      break;
    }
  }
  if (!everyPlayerSubPar) {
    return;
  }

  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // why: award the badge to EVERY player in the group in one multi-row INSERT.
  // ON CONFLICT DO NOTHING (constraint inference) suppresses duplicates so the
  // repeated full-group evaluation from each of the table's submitters is a
  // no-op after the first complete pass.
  for (const row of rows) {
    const playerId =
      typeof row.player_id === 'string' ? Number(row.player_id) : row.player_id;
    valueClauses.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
    );
    params.push(playerId, UNITED_FRONT_KEY, 1, 'competitive_history', null, configVersion);
    paramIndex += 6;
  }

  const sql =
    'INSERT INTO legendary.player_badges ' +
    '(player_id, badge_key, tier, source_kind, source_ref, awarded_under_config_version) ' +
    'VALUES ' +
    valueClauses.join(', ') +
    ' ON CONFLICT DO NOTHING';

  await database.query(sql, params);
}
