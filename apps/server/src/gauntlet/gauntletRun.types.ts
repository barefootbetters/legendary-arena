/**
 * Row-shape types for the gauntlet run workspace (WP-443 / EC-478 / D-24262).
 *
 * These describe the shape of a `legendary.player_gauntlet_runs` row for the
 * WP-5 import + run API to consume. This module is intentionally minimal: it is
 * a plain row-shape declaration only — no functions, no `pg` query, no
 * repository, no error-code union, no quota constants. The DB→row mapping layer
 * and every derived read (run state, hero pool, headroom, standing,
 * last-played) live in WP-5, computed from `legPicks` +
 * `legendary.competitive_scores` — never stored (D-24262).
 *
 * Authority: WP-443 §Contract; EC-478 §Locked Values; D-24262
 * (derived-progression lock).
 */

/**
 * The gauntlet division a run belongs to, mirroring the identity-only pack's
 * `division` values (D-24260): `'fixed'` (the fixed hero-pool division) or
 * `'open'`. Matches the migration's `CHECK (division IN ('fixed', 'open'))`.
 */
export type GauntletRunDivision = 'fixed' | 'open';

/**
 * The single authoritative hero state for a run: a map from a leg's scheme slug
 * to the hero deck ids chosen for that leg. Mirrors the `leg_picks jsonb`
 * column. There is no child hero table and no `player_loadouts` entry — the
 * run's picks live only here.
 */
export type GauntletRunLegPicks = Record<string, readonly string[]>;

/**
 * One `legendary.player_gauntlet_runs` row.
 *
 * `playerId` is the `bigint` FK to `legendary.players(player_id)`; `pg` surfaces
 * a `bigint` as a string, so it is typed as `string` here. `firstCompletedAt` is
 * the nullable, write-once audit + archive-boundary stamp — never competitive
 * truth. The DB→row mapping (snake_case columns → these camelCase fields) is
 * WP-5.
 */
export interface GauntletRunRow {
  id: string;
  playerId: string;
  setAbbr: string;
  mastermindSlug: string;
  division: GauntletRunDivision;
  playerCount: number;
  legPicks: GauntletRunLegPicks;
  createdAt: string;
  updatedAt: string;
  firstCompletedAt: string | null;
}
