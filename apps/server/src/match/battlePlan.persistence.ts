/**
 * Battle Plan API — Persistence (WP-635 / EC-670 / D-24449)
 *
 * The only `pg`-touching file in the Battle Plan module. Reads and writes the one
 * domain table — legendary.battle_plan — for the two endpoints: upsert one phase's
 * text, and read the current three-phase document.
 *
 * Invariants encoded here:
 *   * one shared row per match — the write is a per-COLUMN upsert
 *     (INSERT ... ON CONFLICT (match_id) DO UPDATE SET <phase-column> = ...), so
 *     writing one phase never clears the other two. It is NEVER a whole-row REPLACE.
 *   * the phase column is a closed-set BattlePlanColumn value (resolved by the pure
 *     `phaseColumnFor`), never raw request input — so splicing it into the SQL text
 *     is injection-safe.
 *   * `updated_by_ext_id` and `updated_at` are re-stamped on every write; the phase
 *     text and the editor are the only application-supplied values (parameterized).
 *
 * Layer-boundary contract: imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. The `pg` driver is reachable only through the injected DatabaseClient.
 *
 * Authority: WP-635 §Scope D; EC-670 §Locked Values; D-24449.
 */

import type { DatabaseClient } from '../identity/identity.types.js';
import type {
  BattlePlanColumn,
  BattlePlanRecord,
} from './battlePlan.types.js';

/** The raw legendary.battle_plan row shape as node-pg returns it (snake_case). */
interface BattlePlanRow {
  match_id: string;
  pre_battle: string | null;
  battle_adjustments: string | null;
  post_battle: string | null;
  updated_by_ext_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Convert a timestamptz value (a Date from node-pg, or a string) to an ISO string.
 *
 * @param value The raw timestamp value from a row.
 * @returns The ISO-8601 string form.
 */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Map a raw legendary.battle_plan row to the camelCase BattlePlanRecord.
 *
 * @param row The raw snake_case row.
 * @returns The mapped record.
 */
function mapBattlePlanRow(row: BattlePlanRow): BattlePlanRecord {
  return {
    matchId: row.match_id,
    preBattle: row.pre_battle,
    battleAdjustments: row.battle_adjustments,
    postBattle: row.post_battle,
    updatedByExtId: row.updated_by_ext_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/**
 * Upsert one phase's text for a match's Battle Plan and return the full current
 * document. On a first write the row is inserted (the other two phases stay null);
 * on a later write the ON CONFLICT (match_id) branch updates ONLY the named phase
 * column, so the other two phases are preserved — this is never a whole-row replace.
 *
 * @param matchId The boardgame.io match id.
 * @param column The storage column to write (a closed-set BattlePlanColumn from
 *   `phaseColumnFor`, never raw request input).
 * @param text The phase text (possibly empty — an empty string clears the phase).
 * @param editorExtId The writing account's ext_id (= legendary.players.ext_id).
 * @param database The caller-injected `pg` pool.
 * @returns The persisted Battle Plan record after the write.
 */
export async function upsertBattlePlanPhase(
  matchId: string,
  column: BattlePlanColumn,
  text: string,
  editorExtId: string,
  database: DatabaseClient,
): Promise<BattlePlanRecord> {
  // why: `column` is a closed-set BattlePlanColumn (one of three literal column
  // names resolved by the pure phaseColumnFor from the validated phase), NEVER raw
  // request input, so splicing it into the SQL text cannot be an injection vector.
  // The application-supplied values (text, editorExtId, matchId) are all
  // parameterized. ON CONFLICT (match_id) DO UPDATE sets ONLY this one phase column
  // (plus the audit stamp), so writing one phase never clears the other two — this
  // is a per-column upsert, not a whole-row replace.
  const result = await database.query(
    'INSERT INTO legendary.battle_plan ' +
      `(match_id, ${column}, updated_by_ext_id) ` +
      'VALUES ($1, $2, $3) ' +
      'ON CONFLICT (match_id) DO UPDATE SET ' +
      `${column} = $2, updated_by_ext_id = $3, updated_at = now() ` +
      'RETURNING match_id, pre_battle, battle_adjustments, post_battle, ' +
      'updated_by_ext_id, created_at, updated_at',
    [matchId, text, editorExtId],
  );
  return mapBattlePlanRow(result.rows[0] as BattlePlanRow);
}

/**
 * Read the current Battle Plan document for a match, or null when no plan row
 * exists yet.
 *
 * @param matchId The boardgame.io match id.
 * @param database The caller-injected `pg` pool.
 * @returns The persisted record, or null when the match has no Battle Plan row.
 */
export async function readBattlePlan(
  matchId: string,
  database: DatabaseClient,
): Promise<BattlePlanRecord | null> {
  const result = await database.query(
    'SELECT match_id, pre_battle, battle_adjustments, post_battle, ' +
      'updated_by_ext_id, created_at, updated_at ' +
      'FROM legendary.battle_plan WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapBattlePlanRow(result.rows[0] as BattlePlanRow);
}
