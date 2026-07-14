/**
 * dashboardGameplay.logic tests (WP-374 / EC-403).
 *
 * Unit-tests the match projection, player aggregation, and KPI composition against
 * a fake database + an injected name resolver + a fixed `nowMs`. The SQL itself is
 * covered by the DB-gated integration suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getKpiSnapshots,
  getMatchRecords,
  getPlayerRecords,
} from './dashboardGameplay.logic.js';
import type { DatabaseClient } from './dashboardGameplay.types.js';

/** A fake DB whose `query` returns a caller-supplied handler's rows. */
function fakeDb(
  handler: (sql: string, params: readonly unknown[]) => ReadonlyArray<Record<string, unknown>>,
): DatabaseClient {
  return {
    query: async (text: string, params?: readonly unknown[]) => ({
      rows: handler(text, params ?? []),
    }),
  };
}

const RESOLVE = (extId: string): string =>
  extId === 'core/scheme-x' ? 'Scheme X' : extId === 'core/mm-y' ? 'Doctor Doom' : extId;

const FIXED_NOW = Date.parse('2026-07-13T12:00:00.000Z');

test('getMatchRecords projects the blob: finished/in-progress outcomes, name resolution, null-initial_state skip', async () => {
  const database = fakeDb(() => [
    {
      match_id: 'm-finished',
      initial_state: {
        G: { matchConfiguration: { schemeId: 'core/scheme-x', mastermindId: 'core/mm-y' } },
        ctx: { numPlayers: 2 },
      },
      metadata: { createdAt: FIXED_NOW - 600_000, updatedAt: FIXED_NOW, gameover: { outcome: 'heroes-win' } },
    },
    {
      match_id: 'm-live',
      initial_state: {
        G: { matchConfiguration: { schemeId: 'core/scheme-x', mastermindId: 'core/mm-y' } },
        ctx: { numPlayers: 3 },
      },
      metadata: { createdAt: FIXED_NOW - 60_000, updatedAt: FIXED_NOW },
    },
    { match_id: 'm-villain', initial_state: {
        G: { matchConfiguration: { schemeId: 'core/scheme-x', mastermindId: 'core/mm-y' } },
        ctx: { numPlayers: 2 } },
      metadata: { createdAt: FIXED_NOW - 100_000, updatedAt: FIXED_NOW, gameover: { outcome: 'scheme-wins' } } },
    { match_id: 'm-broken', initial_state: null, metadata: {} }, // skipped
  ]);
  const records = await getMatchRecords(database, RESOLVE);
  assert.equal(records.length, 3, 'the null-initial_state row is skipped');
  const finished = records.find((record) => record.id === 'm-finished');
  assert.ok(finished);
  assert.equal(finished.scheme, 'Scheme X');
  assert.equal(finished.mastermind, 'Doctor Doom');
  assert.equal(finished.playerCount, 2);
  assert.equal(finished.outcome, 'hero_wins');
  assert.equal(finished.duration, 600); // 600_000 ms → 600 s
  assert.equal(records.find((record) => record.id === 'm-live')?.outcome, 'in_progress');
  assert.equal(records.find((record) => record.id === 'm-villain')?.outcome, 'villain_wins');
});

test('getPlayerRecords aggregates matchesPlayed/winRate + status, with a 0-score player as 0/0', async () => {
  const database = fakeDb(() => [
    {
      ext_id: 'acct-active',
      display_name: 'Nova',
      email: 'nova@example.com',
      is_suspended: false,
      created_at: '2026-01-01T00:00:00.000Z',
      matches_played: '4',
      wins: '3',
      last_score_at: new Date(FIXED_NOW - 2 * 86_400_000).toISOString(),
    },
    {
      ext_id: 'acct-fresh',
      display_name: 'Rookie',
      email: 'rookie@example.com',
      is_suspended: false,
      created_at: new Date(FIXED_NOW - 90 * 86_400_000).toISOString(),
      matches_played: '0',
      wins: '0',
      last_score_at: null,
    },
    {
      ext_id: 'acct-banned',
      display_name: 'Cheater',
      email: 'x@example.com',
      is_suspended: true,
      created_at: '2026-01-01T00:00:00.000Z',
      matches_played: '2',
      wins: '0',
      last_score_at: new Date(FIXED_NOW - 1 * 86_400_000).toISOString(),
    },
  ]);
  const records = await getPlayerRecords(database, 100, FIXED_NOW);
  const active = records.find((record) => record.id === 'acct-active');
  assert.ok(active);
  assert.equal(active.matchesPlayed, 4);
  assert.equal(active.winRate, 0.75);
  assert.equal(active.status, 'active'); // scored 2 days ago
  const fresh = records.find((record) => record.id === 'acct-fresh');
  assert.ok(fresh);
  assert.equal(fresh.matchesPlayed, 0);
  assert.equal(fresh.winRate, 0); // not null
  assert.equal(fresh.status, 'inactive'); // no score, registered 90d ago
  assert.equal(fresh.lastActive, new Date(FIXED_NOW - 90 * 86_400_000).toISOString()); // fallback to created_at
  assert.equal(records.find((record) => record.id === 'acct-banned')?.status, 'banned');
});

test('getKpiSnapshots returns the 5 derivable KPIs (DAU omitted) with trends, no target chip', async () => {
  // every query returns a uniform row; enough columns for each aggregate helper.
  const database = fakeDb(() => [
    { c: '100', total: '40', as_of: '25', scored: '8', wins: '5' },
  ]);
  const kpis = await getKpiSnapshots(database, FIXED_NOW);
  const ids = kpis.map((kpi) => kpi.id).sort();
  assert.deepEqual(ids, [
    'hero_win_rate_30d',
    'new_players_30d',
    'revenue_30d',
    'total_matches',
    'total_players',
  ]);
  // DAU is not present
  assert.ok(!ids.includes('dau'));
  // total_matches: total 40 vs as_of 25 → trend up
  const matches = kpis.find((kpi) => kpi.id === 'total_matches');
  assert.ok(matches);
  assert.equal(matches.value, 40);
  assert.equal(matches.previousValue, 25);
  assert.equal(matches.trend, 'up');
  // no threshold chip fields
  assert.ok(kpis.every((kpi) => kpi.target === undefined && kpi.direction === undefined));
  assert.equal(kpis.find((kpi) => kpi.id === 'revenue_30d')?.unit, 'USD');
  assert.equal(kpis.find((kpi) => kpi.id === 'hero_win_rate_30d')?.unit, '%');
});
