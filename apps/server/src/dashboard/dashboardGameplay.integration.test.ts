/**
 * dashboardGameplay integration tests (WP-374 / EC-403).
 *
 * DB-gated (runs only with `TEST_DATABASE_URL`). Seeds a `bgio.matches` row
 * (initial_state + metadata incl. gameover), a player, and a competitive score,
 * then runs the three logic queries against real Postgres (verifying the blob
 * projection, the player aggregation join, and the KPI composition). Cleans up in
 * `after()`.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import pg from 'pg';

import { createPlayerAccount } from '../identity/identity.logic.js';
import {
  getKpiSnapshots,
  getMatchRecords,
  getPlayerRecords,
} from './dashboardGameplay.logic.js';
import type { DatabaseClient } from './dashboardGameplay.types.js';

const { Pool } = pg;
const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

const MATCH_ID = 'wp374_m1';
const REPLAY_HASH = 'wp374_h1';
const IDENTITY_RESOLVER = (extId: string): string => extId;

describe('dashboardGameplay integration (DB-gated)', { skip: !hasTestDatabase }, () => {
  let pool: InstanceType<typeof Pool>;
  let database: DatabaseClient;
  let playerExtId: string;
  let playerId: number;

  before(async () => {
    if (!hasTestDatabase) {
      return;
    }
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    database = pool as unknown as DatabaseClient;

    const account = await createPlayerAccount(
      {
        email: `wp374-${randomUUID()}@example.com`,
        displayName: 'WP374 Dashboard Gameplay',
        authProvider: 'email',
        authProviderId: `wp374-${randomUUID()}`,
      },
      pool as never,
    );
    assert.ok(account.ok === true, 'seed player created');
    playerExtId = account.value.accountId;
    const idResult = await pool.query(
      'SELECT player_id FROM legendary.players WHERE ext_id = $1',
      [playerExtId],
    );
    playerId = Number(idResult.rows[0].player_id);

    const nowMs = Date.parse('2026-07-13T12:00:00.000Z');
    await pool.query(
      `INSERT INTO bgio.matches (match_id, state, initial_state, metadata)
       VALUES ($1, '{}'::jsonb, $2::jsonb, $3::jsonb)`,
      [
        MATCH_ID,
        JSON.stringify({
          G: { matchConfiguration: { schemeId: 'core/legacy-virus', mastermindId: 'core/loki' } },
          ctx: { numPlayers: 2 },
        }),
        JSON.stringify({ createdAt: nowMs - 600_000, updatedAt: nowMs, gameover: { outcome: 'heroes-win' } }),
      ],
    );

    await pool.query(
      `INSERT INTO legendary.competitive_scores
         (player_id, replay_hash, scenario_key, raw_score, final_score, score_breakdown,
          par_version, scoring_config_version, state_hash, outcome, player_count)
       VALUES ($1, $2, 'wp374', 10, 10, '{}'::jsonb, 'v1', 1, 'wp374state', 'heroes-win', 2)`,
      [playerId, REPLAY_HASH],
    );
  });

  after(async () => {
    if (!hasTestDatabase || pool === undefined) {
      return;
    }
    await pool.query('DELETE FROM legendary.competitive_scores WHERE replay_hash = $1', [REPLAY_HASH]);
    await pool.query('DELETE FROM bgio.matches WHERE match_id = $1', [MATCH_ID]);
    if (playerExtId !== undefined) {
      await pool.query('DELETE FROM legendary.players WHERE ext_id = $1', [playerExtId]);
    }
    await pool.end();
  });

  test('getMatchRecords projects the seeded bgio match (scheme/mastermind/playerCount/outcome)', async () => {
    const records = await getMatchRecords(database, IDENTITY_RESOLVER, 200);
    const seeded = records.find((record) => record.id === MATCH_ID);
    assert.ok(seeded, 'the seeded match is projected');
    assert.equal(seeded.scheme, 'core/legacy-virus');
    assert.equal(seeded.mastermind, 'core/loki');
    assert.equal(seeded.playerCount, 2);
    assert.equal(seeded.outcome, 'hero_wins');
    assert.equal(seeded.duration, 600);
  });

  test('getPlayerRecords aggregates the seeded player (1 match, 100% win, active)', async () => {
    const records = await getPlayerRecords(database, 500);
    const seeded = records.find((record) => record.id === playerExtId);
    assert.ok(seeded, 'the seeded player is present');
    assert.equal(seeded.matchesPlayed, 1);
    assert.equal(seeded.winRate, 1);
    assert.equal(seeded.status, 'active');
  });

  test('getKpiSnapshots returns the 5 derivable KPIs reflecting the seed', async () => {
    const kpis = await getKpiSnapshots(database);
    assert.equal(kpis.length, 5);
    const totalMatches = kpis.find((kpi) => kpi.id === 'total_matches');
    assert.ok(totalMatches && totalMatches.value >= 1);
    const totalPlayers = kpis.find((kpi) => kpi.id === 'total_players');
    assert.ok(totalPlayers && totalPlayers.value >= 1);
    const winRate = kpis.find((kpi) => kpi.id === 'hero_win_rate_30d');
    assert.ok(winRate && winRate.value >= 0 && winRate.value <= 100);
  });
});
