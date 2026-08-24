/**
 * Endgame AI Coach — Report Cache Persistence (WP-594 / EC-629 / D-24403)
 *
 * Read/write the `legendary.coach_reports` cache (one row per scored match,
 * keyed by `replay_hash`). The paid model runs at most ONCE per match; a second
 * request reads the cached report here. This is ordinary server-layer domain
 * storage of a DERIVED advisory artifact — never runtime `G`/`ctx`, never hashed,
 * never a save-game (D-24403).
 *
 * Layer-boundary contract: imports nothing from `boardgame.io`,
 * `@legendary-arena/game-engine` (runtime), `@legendary-arena/registry`,
 * `@legendary-arena/preplan`, or any UI package. The `pg` driver is reachable
 * only through the injected `DatabaseClient`.
 *
 * Authority: WP-594 §Scope; EC-629; D-24403.
 */

import type { DatabaseClient } from '../identity/identity.types.js';
import type { CoachReport, StoredCoachReport } from './coach.types.js';

/**
 * Read the cached coach report for a scored match, or `null` on a cache miss.
 *
 * @param replayHash The match's replay hash (the cache key).
 * @param database The caller-injected `pg` pool.
 * @returns The stored report, or `null` when none is cached.
 */
export async function readCoachReport(
  replayHash: string,
  database: DatabaseClient,
): Promise<StoredCoachReport | null> {
  const result = await database.query(
    'SELECT report, model, generated_at FROM legendary.coach_reports ' +
      'WHERE replay_hash = $1',
    [replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0] as {
    report: CoachReport;
    model: string;
    generated_at: Date | string;
  };
  return {
    // why: jsonb arrives already parsed from node-pg; the report is rendered
    // verbatim by the client and never re-parsed for gameplay.
    report: row.report,
    model: row.model,
    generatedAt:
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : String(row.generated_at),
  };
}

/**
 * Write (or replace) the cached coach report for a scored match. Idempotent: an
 * `ON CONFLICT (replay_hash)` upsert re-stamps the report/model/timestamp, so a
 * forced regeneration under a new model overwrites cleanly rather than raising a
 * duplicate-key error.
 *
 * @param replayHash The match's replay hash (the cache key).
 * @param accountId The account the report was generated for (forensics/cleanup).
 * @param model The model id that produced the report.
 * @param report The coaching report to cache.
 * @param database The caller-injected `pg` pool.
 * @returns The stored report (with the server-assigned timestamp).
 */
export async function writeCoachReport(
  replayHash: string,
  accountId: string,
  model: string,
  report: CoachReport,
  database: DatabaseClient,
): Promise<StoredCoachReport> {
  // why: ON CONFLICT DO UPDATE re-stamps on a re-generation (e.g. a model change)
  // instead of raising duplicate-key; the report is a property of the match, so
  // replay_hash is the conflict target. RETURNING gives the server timestamp back.
  const result = await database.query(
    'INSERT INTO legendary.coach_reports (replay_hash, account_id, model, report) ' +
      'VALUES ($1, $2, $3, $4) ' +
      'ON CONFLICT (replay_hash) DO UPDATE SET ' +
      'account_id = EXCLUDED.account_id, model = EXCLUDED.model, ' +
      'report = EXCLUDED.report, generated_at = now() ' +
      'RETURNING generated_at',
    [replayHash, accountId, model, JSON.stringify(report)],
  );
  const generatedAtRaw = result.rows[0]?.generated_at as Date | string | undefined;
  return {
    report,
    model,
    generatedAt:
      generatedAtRaw instanceof Date
        ? generatedAtRaw.toISOString()
        : String(generatedAtRaw),
  };
}
