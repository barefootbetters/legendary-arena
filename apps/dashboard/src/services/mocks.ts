import type {
  KpiSnapshot,
  PlayerRecord,
  MatchRecord,
  RevenueRecord,
  DailyMetric,
  AlertItem,
  ServerNode,
  RuntimeHealthSnapshot,
  ServiceResponse,
} from '../types/index.js';
import type { FeedbackTriageItem } from '../types/feedbackTriage.js';

export { mockBillingHealth, mockBillingHealthSparklines } from './billingHealthMocks.js';
export type { BillingHealthSparklines, BillingHealthSparklinePoint } from './billingHealthMocks.js';

// why: INFRA — `export { X } from './mod'` is a pure re-export and does NOT
// introduce a local binding for X, so the `liveMode ? … : mockX` ternaries
// below referenced unbound identifiers. Native-ESM dev (Vite/esbuild) throws
// `ReferenceError: mockTrafficSources is not defined` at module eval, breaking
// every dashboard page; the rollup production build hoists the re-export into
// module scope so `pnpm -r build` / CI stayed green (dev-mode-only, latent on
// main). Split into import + separate re-export so the local bindings exist
// while keeping the `mockX` re-export contract intact.
import {
  mockTrafficSources,
  mockActivationFunnel,
  mockRetentionCohorts,
} from './analyticsMocks.js';
export { mockTrafficSources, mockActivationFunnel, mockRetentionCohorts };

import {
  fetchTrafficSourcesLive,
  fetchActivationFunnelLive,
  fetchRetentionCohortsLive,
  isLiveModeEnabled,
} from './analyticsLiveFetchers.js';

// why: D-20601 LIVE-flip seam — `isLiveModeEnabled()` is the SHARED
// single-source-of-truth predicate (also re-validated inside each LIVE
// fetcher at fetch time). `mocks.ts` does NOT re-derive the env-var
// gate from import.meta env directly — two independent gates would
// drift silently over the long tail of future edits, surfacing only
// when production diverged from local-dev. The verification grep
// (close-out) requires zero env-var-name matches in this file.
const liveMode = isLiveModeEnabled();

// why: WP-203 §Composable Source Contract + D-20302 widget byte-identity
// + D-20601 LIVE-flip seam — widgets import these `fetch*`-aliased
// bindings; the alias identifier stays unchanged pre/post LIVE flip so
// widget files contain zero literal `mockX` tokens (verified by the
// WP-203 close-out grep, re-asserted by this WP's close-out gate). The
// signature stays `(rangeOrCohortCount, nowMs) => ServiceResponse<readonly T[]>`
// in both arms (LIVE accepts `_nowMs` and ignores it; MOCK consumes it).
// When `liveMode` is false (default + local-dev + tests), the MOCK
// factories run; when true (CF Pages deploy env flips the use-mocks
// flag off and supplies a non-empty API base URL), the LIVE fetchers
// run.
export const fetchTrafficSources = liveMode ? fetchTrafficSourcesLive : mockTrafficSources;
export const fetchActivationFunnel = liveMode ? fetchActivationFunnelLive : mockActivationFunnel;
export const fetchRetentionCohorts = liveMode ? fetchRetentionCohortsLive : mockRetentionCohorts;

// why: WP-204 / EC-232 / D-20402 — ops-health mock factories. Same
// dual-export pattern as the WP-203 analytics block above: `mockX` for
// tests (so tests can assert factory-direct output) and `fetchX` for
// widgets (so widget files contain zero literal `mockX` tokens — the
// MOCK → LIVE flip seam is the paired server WP's concern, not a
// widget-side change).
export {
  mockUptimeProbes,
  mockErrorRateSnapshots,
  mockInfraCostEntries,
} from './opsHealthMocks.js';
export {
  mockUptimeProbes as fetchUptimeProbes,
  mockErrorRateSnapshots as fetchErrorRateSnapshots,
  mockInfraCostEntries as fetchInfraCostEntries,
} from './opsHealthMocks.js';

// why: WP-238 / EC-269 / D-23802 — sweep-health LIVE flip. Import + separate
// re-export so `mockSweepHealth` is a LOCAL binding the ternary below can
// reference; a bare `export { x } from './mod'` re-export creates no local
// binding (see the analytics-block note at the top of this file). The
// `mockSweepHealth` re-export is retained for factory-direct tests.
import { mockSweepHealth } from './sweepHealthMocks.js';
export { mockSweepHealth };
import { fetchSweepHealthLive } from './sweepLiveFetchers.js';

// why (D-23802): the `fetchSweepHealth` alias is gated through the EXISTING
// shared `liveMode` constant — this file adds NO second env gate (no env-var
// literal here; the gate is the single `isLiveModeEnabled()` import above).
// When `liveMode` is false (default + local-dev + tests) the MOCK factory runs;
// when true (deploy env flips use-mocks off + supplies a non-empty API base
// URL) the LIVE fetcher runs. `SweepHealthWidget.vue` / `PipelinePage.vue` stay
// byte-identical — the `fetchSweepHealth` alias identifier is the only seam.
export const fetchSweepHealth = liveMode ? fetchSweepHealthLive : mockSweepHealth;

// why: WP-239 / EC-270 / D-23903 — triage LIVE flip. Import + separate
// re-export so `mockInspectionTriage` / `mockHandoffChain` are LOCAL bindings
// the ternaries below can reference; a bare `export { x } from './mod'`
// re-export creates no local binding (see the analytics-block note at the top
// of this file). The mock re-exports are retained for factory-direct tests.
import { mockInspectionTriage, mockHandoffChain } from './triageMocks.js';
export { mockInspectionTriage, mockHandoffChain };
import { fetchInspectionTriageLive, fetchHandoffChainLive } from './triageLiveFetchers.js';

// why (D-23903): both triage fetchers are gated through the EXISTING shared
// `liveMode` constant — this file adds NO second env gate (no env-var literal
// here; the gate is the single `isLiveModeEnabled()` import above). When
// `liveMode` is false (default + local-dev + tests) the MOCK factories run;
// when true (deploy env flips use-mocks off + supplies a non-empty API base
// URL) the LIVE fetchers run. `PipelinePage.vue` stays byte-identical — the
// `fetchInspectionTriage` / `fetchHandoffChain` aliases are the only seam.
export const fetchInspectionTriage = liveMode ? fetchInspectionTriageLive : mockInspectionTriage;
export const fetchHandoffChain = liveMode ? fetchHandoffChainLive : mockHandoffChain;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wrapMock<T>(data: T): ServiceResponse<T> {
  return {
    data,
    updatedAt: Date.now(),
    source: 'MOCK',
  };
}

// why: the mock mirrors the LIVE server contract from GET /api/dash/kpis
// (getKpiSnapshots in apps/server/src/dashboard/dashboardGameplay.logic.ts)
// exactly — same five ids, labels, and units — so mock mode and live mode
// render identically and a client/server id drift like the retired
// active-players/matches-running/revenue-today/server-health placeholder set
// (which had no server source) cannot hide behind mock mode again. The server
// sets no target/tolerance/direction on these KPIs (no operator threshold is
// defined yet), so no status chip renders here either — faithful to live.
export function mockKpiSnapshots(): ServiceResponse<KpiSnapshot[]> {
  return wrapMock([
    {
      id: 'total_players',
      label: 'Total players',
      value: randomBetween(400, 900),
      previousValue: 500,
      unit: '',
      trend: 'up',
    },
    {
      id: 'new_players_30d',
      label: 'New players (30d)',
      value: randomBetween(30, 120),
      previousValue: 80,
      unit: '',
      trend: 'up',
    },
    {
      id: 'total_matches',
      label: 'Total matches',
      value: randomBetween(1500, 4000),
      previousValue: 3000,
      unit: '',
      trend: 'up',
    },
    {
      id: 'revenue_30d',
      label: 'Revenue (30d)',
      value: randomBetween(2000, 9000),
      previousValue: 6000,
      unit: 'USD',
      trend: 'up',
    },
    {
      // why: win rate as a whole percentage (0-100), matching the server's
      // `Math.round(rate * 100)` and unit '%' in getKpiSnapshots.
      id: 'hero_win_rate_30d',
      label: 'Hero win rate (30d)',
      value: randomBetween(38, 62),
      previousValue: 50,
      unit: '%',
      trend: 'flat',
    },
  ]);
}

export function mockPlayerRecords(): ServiceResponse<PlayerRecord[]> {
  const names = [
    'Alice Chen',
    'Bob Martinez',
    'Carol Johnson',
    'David Kim',
    'Eve Williams',
    'Frank Brown',
    'Grace Lee',
    'Henry Wilson',
    'Irene Davis',
    'Jack Thompson',
    'Karen White',
    'Leo Harris',
    'Maria Clark',
    'Nathan Lewis',
    'Olivia Robinson',
    'Paul Walker',
    'Quinn Hall',
    'Rachel Allen',
    'Sam Young',
    'Tina King',
  ];
  const players: PlayerRecord[] = names.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    matchesPlayed: randomBetween(5, 500),
    winRate: randomBetween(20, 85) / 100,
    lastActive: new Date(Date.now() - randomBetween(0, 7 * 86400000)).toISOString(),
    status:
      (['active', 'active', 'active', 'inactive', 'banned'] as const)[randomBetween(0, 4)] ??
      'active',
  }));
  return wrapMock(players);
}

export function mockMatchRecords(): ServiceResponse<MatchRecord[]> {
  const schemes = ['Legacy Virus', 'Secret Invasion', 'Midtown Bank Robbery', 'Negative Zone'];
  const masterminds = ['Red Skull', 'Loki', 'Magneto', 'Dr. Doom', 'Apocalypse'];
  const matches: MatchRecord[] = [];
  for (let i = 0; i < 25; i++) {
    matches.push({
      id: `match-${i + 1}`,
      startedAt: new Date(Date.now() - randomBetween(0, 3 * 86400000)).toISOString(),
      duration: randomBetween(600, 3600),
      playerCount: randomBetween(1, 5),
      scheme: schemes[randomBetween(0, schemes.length - 1)] ?? 'Legacy Virus',
      mastermind: masterminds[randomBetween(0, masterminds.length - 1)] ?? 'Red Skull',
      outcome:
        (['villain_wins', 'hero_wins', 'in_progress'] as const)[randomBetween(0, 2)] ??
        'in_progress',
    });
  }
  return wrapMock(matches);
}

// why: WP-605 — the operator feedback triage queue for offline/mock dev. Covers
// every type and a spread of statuses (incl. a Declined item carrying a reason) so
// the panel's filters + status editor + reason field all render without a server.
export function mockFeedbackItems(): ServiceResponse<FeedbackTriageItem[]> {
  const items: FeedbackTriageItem[] = [
    {
      id: 1,
      feedbackType: 'enhancement',
      title: 'Add a dark mode',
      description: 'A dark theme would be easier on the eyes at night.',
      authorExtId: 'mock-account-a',
      status: 'under_review',
      resolutionReason: null,
      voteCount: 12,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 2,
      feedbackType: 'enhancement',
      title: 'Spectator mode for ranked matches',
      description: 'Let friends watch a live ranked match.',
      authorExtId: 'mock-account-b',
      status: 'planned',
      resolutionReason: null,
      voteCount: 34,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: 3,
      feedbackType: 'bug',
      title: 'Client froze on reconnect',
      description: 'The board went blank after a dropped connection mid-match.',
      authorExtId: 'mock-account-c',
      status: 'in_progress',
      resolutionReason: null,
      voteCount: 0,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 4,
      feedbackType: 'review',
      title: 'Best deck-builder on the web',
      description: 'Five stars — the endgame report card is a great touch.',
      authorExtId: 'mock-account-d',
      status: 'shipped',
      resolutionReason: null,
      voteCount: 0,
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
    {
      id: 5,
      feedbackType: 'enhancement',
      title: 'Trade cards between accounts',
      description: 'Allow players to trade their collected cards.',
      authorExtId: 'mock-account-e',
      status: 'declined',
      resolutionReason: 'Out of scope — trading conflicts with the fairness bright lines.',
      voteCount: 7,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  ];
  return wrapMock(items);
}

export function mockRevenueRecords(): ServiceResponse<RevenueRecord[]> {
  const sources = ['subscription', 'card_pack', 'cosmetic', 'battle_pass'];
  const records: RevenueRecord[] = [];
  for (let i = 0; i < 30; i++) {
    records.push({
      id: `rev-${i + 1}`,
      date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0] ?? '',
      amount: randomBetween(50, 800),
      source: sources[randomBetween(0, sources.length - 1)] ?? 'subscription',
      currency: 'USD',
    });
  }
  return wrapMock(records);
}

export function mockDauHistory(days: number): ServiceResponse<DailyMetric[]> {
  const history: DailyMetric[] = [];
  for (let i = days - 1; i >= 0; i--) {
    history.push({
      date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0] ?? '',
      value: randomBetween(800, 4000),
    });
  }
  return wrapMock(history);
}

export function mockRevenueHistory(days: number): ServiceResponse<DailyMetric[]> {
  const history: DailyMetric[] = [];
  for (let i = days - 1; i >= 0; i--) {
    history.push({
      date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0] ?? '',
      value: randomBetween(500, 5000),
    });
  }
  return wrapMock(history);
}

export function mockAlerts(): ServiceResponse<AlertItem[]> {
  return wrapMock([
    {
      id: 'alert-1',
      severity: 'critical',
      message: 'Database connection pool exhaustion detected on primary node.',
      timestamp: Date.now() - 120000,
      acknowledged: false,
    },
    {
      id: 'alert-2',
      severity: 'warning',
      message: 'Match queue latency exceeding 5-second threshold.',
      timestamp: Date.now() - 300000,
      acknowledged: false,
    },
    {
      id: 'alert-3',
      severity: 'info',
      message: 'Scheduled maintenance window begins in 2 hours.',
      timestamp: Date.now() - 600000,
      acknowledged: true,
    },
    {
      id: 'alert-4',
      severity: 'error',
      message: 'Payment processor webhook returning intermittent 503 responses.',
      timestamp: Date.now() - 900000,
      acknowledged: false,
    },
  ]);
}

export function mockServerNodes(): ServiceResponse<ServerNode[]> {
  return wrapMock([
    {
      id: 'node-1',
      name: 'us-east-primary',
      region: 'US East',
      status: 'healthy',
      cpuPercent: randomBetween(20, 65),
      memoryPercent: randomBetween(40, 75),
      activeConnections: randomBetween(100, 800),
      uptime: randomBetween(86400, 2592000),
    },
    {
      id: 'node-2',
      name: 'us-west-secondary',
      region: 'US West',
      status: 'healthy',
      cpuPercent: randomBetween(15, 50),
      memoryPercent: randomBetween(30, 60),
      activeConnections: randomBetween(50, 400),
      uptime: randomBetween(86400, 2592000),
    },
    {
      id: 'node-3',
      name: 'eu-central',
      region: 'EU Central',
      status: 'degraded',
      cpuPercent: randomBetween(70, 95),
      memoryPercent: randomBetween(80, 95),
      activeConnections: randomBetween(200, 600),
      uptime: randomBetween(3600, 86400),
    },
  ]);
}

/**
 * Mock the game server's runtime-health snapshot (WP-439). A healthy 2-CPU box:
 * modest CPU, low event-loop lag, `WEB_CONCURRENCY=2` (set-but-inert today).
 *
 * @returns a mocked runtime-health `ServiceResponse`.
 */
export function mockRuntimeHealth(): ServiceResponse<RuntimeHealthSnapshot> {
  const p50 = randomBetween(1, 6);
  return wrapMock<RuntimeHealthSnapshot>({
    capturedAt: new Date().toISOString(),
    uptimeSeconds: randomBetween(3600, 2592000),
    cpuCount: 2,
    cpuPercent: randomBetween(8, 40),
    eventLoopDelayMs: {
      mean: p50,
      p50,
      p99: p50 + randomBetween(4, 30),
      max: p50 + randomBetween(30, 120),
    },
    memoryRssMb: randomBetween(180, 420),
    webConcurrency: 2,
  });
}
