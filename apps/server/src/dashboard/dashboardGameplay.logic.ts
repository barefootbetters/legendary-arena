/**
 * Dashboard Matches + Players + KPIs — Query Logic (WP-374 / EC-403)
 *
 * Read-only aggregations for the `/api/dash/{matches,players,kpis}` feeds:
 *   * matches — a read-only match-summary projection of the `bgio.matches` blob
 *     (`initial_state.G.matchConfiguration` + `ctx.numPlayers` + `metadata`
 *     timing/gameover). Authorized by the D-24169 carve-out; NEVER reads
 *     `state`/`log`, never writes, never gameplay state.
 *   * players — `legendary.players` LEFT JOIN aggregated `competitive_scores`.
 *   * kpis — the derivable subset (players / matches / revenue / hero-win-rate)
 *     with prior-window trends. DAU/activity KPIs are OMITTED (no signal exists).
 *
 * Aggregation/trend math is pure and takes an injectable `nowMs` so it unit-tests
 * without a database; the SQL is covered by the DB-gated integration suite.
 *
 * Authority: WP-374; D-24169; D-20501 (SQL discipline).
 */

import { getRevenueDaily } from './dashboardBilling.logic.js';
import type { ResolveName } from '../match/matchLagn.logic.js';
import type {
  DatabaseClient,
  KpiSnapshot,
  MatchRecord,
  PlayerRecord,
} from './dashboardGameplay.types.js';

const MS_PER_DAY = 86_400_000;
// why: a player is "active" if they have scored a competitive match in the last
// 30 days; otherwise "inactive". 30d matches the KPI window and the mock cadence.
const ACTIVE_WINDOW_DAYS = 30;
const KPI_WINDOW_DAYS = 30;
const MATCH_LIST_LIMIT = 50;
const PLAYER_LIST_LIMIT = 100;

/** Read a jsonb number cell (pg may hand back a number or a numeric string). */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return Number(value);
  }
  return null;
}

/** A rate in `[0, 1]`; a zero denominator yields `0` (never `NaN`). */
function rate(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

/** up / down / flat from a current value vs its prior-window value. */
function trendOf(value: number, previousValue: number): 'up' | 'down' | 'flat' {
  if (value > previousValue) {
    return 'up';
  }
  if (value < previousValue) {
    return 'down';
  }
  return 'flat';
}

/**
 * Project the most recent matches from the `bgio.matches` blob (D-24169
 * match-summary carve-out — `initial_state` + `metadata` only). A row whose
 * `initial_state` (or its `G.matchConfiguration`) is absent is skipped.
 */
export async function getMatchRecords(
  database: DatabaseClient,
  resolveName: ResolveName,
  limit: number = MATCH_LIST_LIMIT,
): Promise<MatchRecord[]> {
  // why: read-only SELECT of initial_state + metadata ONLY — never state/log —
  // the carve-out projection surface. Newest by updated_at.
  const result = await database.query(
    `SELECT match_id, initial_state, metadata
       FROM bgio.matches
      ORDER BY updated_at DESC
      LIMIT $1::int`,
    [limit],
  );

  const records: MatchRecord[] = [];
  for (const row of result.rows) {
    const initialState = row.initial_state;
    if (initialState === null || typeof initialState !== 'object') {
      continue;
    }
    const gameState = (initialState as { G?: unknown }).G;
    const context = (initialState as { ctx?: unknown }).ctx;
    const configuration =
      gameState !== null && typeof gameState === 'object'
        ? (gameState as { matchConfiguration?: unknown }).matchConfiguration
        : undefined;
    if (configuration === null || typeof configuration !== 'object') {
      continue;
    }
    const schemeId = (configuration as { schemeId?: unknown }).schemeId;
    const mastermindId = (configuration as { mastermindId?: unknown }).mastermindId;
    if (typeof schemeId !== 'string' || typeof mastermindId !== 'string') {
      continue;
    }
    const numPlayers =
      context !== null && typeof context === 'object'
        ? toNumber((context as { numPlayers?: unknown }).numPlayers)
        : null;

    const metadata =
      row.metadata !== null && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const createdAtMs = toNumber(metadata.createdAt);
    const updatedAtMs = toNumber(metadata.updatedAt);
    const gameover = metadata.gameover;

    let outcome: MatchRecord['outcome'] = 'in_progress';
    if (gameover !== null && gameover !== undefined && typeof gameover === 'object') {
      const gameoverOutcome = (gameover as { outcome?: unknown }).outcome;
      if (gameoverOutcome === 'heroes-win') {
        outcome = 'hero_wins';
      } else if (gameoverOutcome === 'scheme-wins') {
        outcome = 'villain_wins';
      }
    }

    records.push({
      id: String(row.match_id ?? ''),
      startedAt: createdAtMs === null ? '' : new Date(createdAtMs).toISOString(),
      duration:
        createdAtMs === null || updatedAtMs === null
          ? 0
          : Math.max(0, Math.round((updatedAtMs - createdAtMs) / 1000)),
      playerCount: numPlayers ?? 0,
      scheme: resolveName(schemeId),
      mastermind: resolveName(mastermindId),
      outcome,
    });
  }
  return records;
}

/**
 * The most recently-registered players with aggregated competitive stats. A
 * player with no scores is `matchesPlayed: 0` / `winRate: 0` (not null-coerced);
 * `lastActive` is the most recent score time, falling back to registration time.
 */
export async function getPlayerRecords(
  database: DatabaseClient,
  limit: number = PLAYER_LIST_LIMIT,
  nowMs: number = Date.now(),
): Promise<PlayerRecord[]> {
  const result = await database.query(
    `SELECT p.ext_id,
            p.display_name,
            p.email,
            p.is_suspended,
            p.created_at,
            count(cs.submission_id) AS matches_played,
            count(*) FILTER (WHERE cs.outcome = 'heroes-win') AS wins,
            max(cs.created_at) AS last_score_at
       FROM legendary.players p
       LEFT JOIN legendary.competitive_scores cs ON cs.player_id = p.player_id
      GROUP BY p.player_id, p.ext_id, p.display_name, p.email, p.is_suspended, p.created_at
      ORDER BY p.created_at DESC
      LIMIT $1::int`,
    [limit],
  );

  const activeCutoffMs = nowMs - ACTIVE_WINDOW_DAYS * MS_PER_DAY;
  const records: PlayerRecord[] = [];
  for (const row of result.rows) {
    const matchesPlayed = toNumber(row.matches_played) ?? 0;
    const wins = toNumber(row.wins) ?? 0;
    const lastScoreAt = row.last_score_at;
    const createdAt = row.created_at;
    const lastActiveDate = toDate(lastScoreAt) ?? toDate(createdAt);
    const isSuspended = row.is_suspended === true;
    let status: PlayerRecord['status'];
    if (isSuspended) {
      status = 'banned';
    } else if (lastActiveDate !== null && lastActiveDate.getTime() >= activeCutoffMs) {
      status = 'active';
    } else {
      status = 'inactive';
    }

    records.push({
      id: String(row.ext_id ?? ''),
      name: String(row.display_name ?? ''),
      email: String(row.email ?? ''),
      matchesPlayed,
      winRate: rate(wins, matchesPlayed),
      lastActive: lastActiveDate === null ? '' : lastActiveDate.toISOString(),
      status,
    });
  }
  return records;
}

/** Coerce a pg timestamp cell (Date or ISO string) to a Date, or null. */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** count(*) of players registered at or before `asOfMs`. */
async function countPlayersAsOf(database: DatabaseClient, asOfMs: number): Promise<number> {
  const result = await database.query(
    `SELECT count(*) AS c FROM legendary.players WHERE created_at <= $1::timestamptz`,
    [new Date(asOfMs).toISOString()],
  );
  return toNumber(result.rows[0]?.c) ?? 0;
}

/** count(*) of players registered within `[startMs, endMs)`. */
async function countPlayersInWindow(
  database: DatabaseClient,
  startMs: number,
  endMs: number,
): Promise<number> {
  const result = await database.query(
    `SELECT count(*) AS c FROM legendary.players
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    [new Date(startMs).toISOString(), new Date(endMs).toISOString()],
  );
  return toNumber(result.rows[0]?.c) ?? 0;
}

/** count(*) of all matches, plus those created at or before `asOfMs` (via metadata.createdAt). */
async function countMatches(
  database: DatabaseClient,
  asOfMs: number,
): Promise<{ total: number; asOf: number }> {
  const result = await database.query(
    `SELECT count(*) AS total,
            count(*) FILTER (
              WHERE (metadata->>'createdAt') ~ '^[0-9]+$'
                AND (metadata->>'createdAt')::bigint <= $1
            ) AS as_of
       FROM bgio.matches`,
    [asOfMs],
  );
  return {
    total: toNumber(result.rows[0]?.total) ?? 0,
    asOf: toNumber(result.rows[0]?.as_of) ?? 0,
  };
}

/** Hero-win rate over the competitive scores in `[startMs, endMs)`. */
async function heroWinRateInWindow(
  database: DatabaseClient,
  startMs: number,
  endMs: number,
): Promise<number> {
  const result = await database.query(
    `SELECT count(*) FILTER (WHERE outcome IS NOT NULL) AS scored,
            count(*) FILTER (WHERE outcome = 'heroes-win') AS wins
       FROM legendary.competitive_scores
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    [new Date(startMs).toISOString(), new Date(endMs).toISOString()],
  );
  const scored = toNumber(result.rows[0]?.scored) ?? 0;
  const wins = toNumber(result.rows[0]?.wins) ?? 0;
  return rate(wins, scored);
}

/** Sum of daily revenue (dollars) over a trailing 30-day window ending at `endMs`. */
async function revenue30d(database: DatabaseClient, endMs: number): Promise<number> {
  const daily = await getRevenueDaily(database, KPI_WINDOW_DAYS, endMs);
  let total = 0;
  for (const metric of daily) {
    total += metric.value;
  }
  return total;
}

/**
 * The derivable dashboard KPIs, each with a current + prior-equal-window value and
 * trend. DAU and any activity-derived KPI are **omitted** — no activity signal
 * exists and a fabricated number would mislead the operator.
 */
export async function getKpiSnapshots(
  database: DatabaseClient,
  nowMs: number = Date.now(),
): Promise<KpiSnapshot[]> {
  const windowMs = KPI_WINDOW_DAYS * MS_PER_DAY;
  const priorEdgeMs = nowMs - windowMs;
  const twoWindowsMs = nowMs - 2 * windowMs;

  const totalPlayers = await countPlayersAsOf(database, nowMs);
  const totalPlayersPrior = await countPlayersAsOf(database, priorEdgeMs);
  const newPlayers = await countPlayersInWindow(database, priorEdgeMs, nowMs);
  const newPlayersPrior = await countPlayersInWindow(database, twoWindowsMs, priorEdgeMs);
  const matches = await countMatches(database, priorEdgeMs);
  const revenueCurrent = await revenue30d(database, nowMs);
  const revenuePrior = await revenue30d(database, priorEdgeMs);
  const heroWinCurrent = await heroWinRateInWindow(database, priorEdgeMs, nowMs);
  const heroWinPrior = await heroWinRateInWindow(database, twoWindowsMs, priorEdgeMs);

  const snapshots: KpiSnapshot[] = [
    kpi('total_players', 'Total players', totalPlayers, totalPlayersPrior, ''),
    kpi('new_players_30d', 'New players (30d)', newPlayers, newPlayersPrior, ''),
    kpi('total_matches', 'Total matches', matches.total, matches.asOf, ''),
    kpi('revenue_30d', 'Revenue (30d)', revenueCurrent, revenuePrior, 'USD'),
    // why: win rate as a whole percentage (0-100) for display; unit '%'.
    kpi(
      'hero_win_rate_30d',
      'Hero win rate (30d)',
      Math.round(heroWinCurrent * 100),
      Math.round(heroWinPrior * 100),
      '%',
    ),
  ];
  return snapshots;
}

/** Assemble one KPI snapshot (no target/tolerance/direction — no threshold defined). */
function kpi(
  id: string,
  label: string,
  value: number,
  previousValue: number,
  unit: string,
): KpiSnapshot {
  return { id, label, value, previousValue, unit, trend: trendOf(value, previousValue) };
}
