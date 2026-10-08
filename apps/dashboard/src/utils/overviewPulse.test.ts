/**
 * overviewPulse util tests (WP-791 / EC-828) — the money row's card states and
 * precedence, the engagement window / exclusions / caps, and one case per
 * branch of the Server and DR drill card builders.
 *
 * Money figures here are synthetic test values, not operator data.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { MatchRecord, PlayerRecord, RuntimeHealthSnapshot } from '../types/index.js';
import type { DrReadiness } from '../services/drReadinessMocks.js';
import {
  computeBusinessPulse,
  computeEngagement,
  describeDrDrillCard,
  describeServerCard,
  type OperatingInputs,
} from './overviewPulse.js';
import { EVENT_LOOP_SATURATED_MS, EVENT_LOOP_WATCH_MS } from './runtimeHealth.js';

const EMPTY_INPUTS: OperatingInputs = {
  version: 1,
  cashBalanceCents: null,
  otherFixedMonthlyCents: null,
  royaltyRateBasisPoints: null,
  updatedAt: '',
};

/** Builds an inputs record from the empty one plus overrides. */
function inputsWith(overrides: Partial<OperatingInputs>): OperatingInputs {
  return { ...EMPTY_INPUTS, ...overrides };
}

// ---------------------------------------------------------------------------
// computeBusinessPulse
// ---------------------------------------------------------------------------

test('no inputs: revenue and infra-only costs show, the rest read not-entered', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 0,
    infraMonthlyCents: 14635,
    inputs: EMPTY_INPUTS,
  });
  assert.deepEqual(pulse.revenue, { state: 'value', valueCents: 0 });
  assert.deepEqual(pulse.costs, { state: 'value', valueCents: 14635, isInfraOnly: true });
  assert.deepEqual(pulse.royalties, { state: 'not-entered' });
  assert.deepEqual(pulse.net, { state: 'not-entered' });
  assert.deepEqual(pulse.runway, { state: 'not-entered' });
});

test('the WP §8 scenario: zero revenue burns infra + other costs; runway 5.1 months', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 0,
    infraMonthlyCents: 14635,
    inputs: inputsWith({
      cashBalanceCents: 100_000,
      otherFixedMonthlyCents: 5_000,
      royaltyRateBasisPoints: 1_000,
    }),
  });
  assert.deepEqual(pulse.royalties, { state: 'value', valueCents: 0 });
  assert.deepEqual(pulse.costs, { state: 'value', valueCents: 19635, isInfraOnly: false });
  assert.deepEqual(pulse.net, { state: 'value', valueCents: -19635 });
  assert.deepEqual(pulse.runway, { state: 'value', months: 5.1 });
});

test('royalties round to the nearest cent', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 333,
    infraMonthlyCents: 0,
    inputs: inputsWith({ royaltyRateBasisPoints: 1_500 }),
  });
  // 333 × 0.15 = 49.95 → 50
  assert.deepEqual(pulse.royalties, { state: 'value', valueCents: 50 });
  assert.deepEqual(pulse.net, { state: 'value', valueCents: 283 });
});

test('net = revenue − royalties − costs', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 50_000,
    infraMonthlyCents: 10_000,
    inputs: inputsWith({ royaltyRateBasisPoints: 2_000, otherFixedMonthlyCents: 3_000 }),
  });
  assert.deepEqual(pulse.royalties, { state: 'value', valueCents: 10_000 });
  assert.deepEqual(pulse.net, { state: 'value', valueCents: 27_000 });
});

test('runway is profitable at net ≥ 0, including exactly zero', () => {
  const positive = computeBusinessPulse({
    revenue30dCents: 50_000,
    infraMonthlyCents: 10_000,
    inputs: inputsWith({ royaltyRateBasisPoints: 0, cashBalanceCents: 1_000 }),
  });
  assert.deepEqual(positive.runway, { state: 'profitable' });

  const breakEven = computeBusinessPulse({
    revenue30dCents: 10_000,
    infraMonthlyCents: 10_000,
    inputs: inputsWith({ royaltyRateBasisPoints: 0, cashBalanceCents: 1_000 }),
  });
  assert.deepEqual(breakEven.net, { state: 'value', valueCents: 0 });
  assert.deepEqual(breakEven.runway, { state: 'profitable' });
});

test('runway months use one decimal', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 0,
    infraMonthlyCents: 3_000,
    inputs: inputsWith({ royaltyRateBasisPoints: 0, cashBalanceCents: 10_000 }),
  });
  // 10000 / 3000 = 3.333… → 3.3
  assert.deepEqual(pulse.runway, { state: 'value', months: 3.3 });
});

test('runway is not-entered without cash even when net is known', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 0,
    infraMonthlyCents: 3_000,
    inputs: inputsWith({ royaltyRateBasisPoints: 0 }),
  });
  assert.deepEqual(pulse.net, { state: 'value', valueCents: -3_000 });
  assert.deepEqual(pulse.runway, { state: 'not-entered' });
});

test('precedence: not-entered beats profitable (no cash, net ≥ 0)', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 50_000,
    infraMonthlyCents: 0,
    inputs: inputsWith({ royaltyRateBasisPoints: 0 }),
  });
  assert.deepEqual(pulse.runway, { state: 'not-entered' });
});

test('precedence: unavailable revenue beats every not-entered input', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: null,
    infraMonthlyCents: 14635,
    inputs: EMPTY_INPUTS,
  });
  assert.deepEqual(pulse.revenue, { state: 'unavailable' });
  assert.deepEqual(pulse.royalties, { state: 'unavailable' });
  assert.deepEqual(pulse.net, { state: 'unavailable' });
  assert.deepEqual(pulse.runway, { state: 'unavailable' });
  assert.deepEqual(pulse.costs, { state: 'value', valueCents: 14635, isInfraOnly: true });
});

test('precedence: unavailable revenue beats fully entered inputs', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: null,
    infraMonthlyCents: 100,
    inputs: inputsWith({
      cashBalanceCents: 1_000,
      otherFixedMonthlyCents: 200,
      royaltyRateBasisPoints: 500,
    }),
  });
  assert.deepEqual(pulse.royalties, { state: 'unavailable' });
  assert.deepEqual(pulse.runway, { state: 'unavailable' });
  assert.deepEqual(pulse.costs, { state: 'value', valueCents: 300, isInfraOnly: false });
});

test('net and runway inherit not-entered from a missing royalty rate even with cash', () => {
  const pulse = computeBusinessPulse({
    revenue30dCents: 0,
    infraMonthlyCents: 100,
    inputs: inputsWith({ cashBalanceCents: 1_000, otherFixedMonthlyCents: 200 }),
  });
  assert.deepEqual(pulse.royalties, { state: 'not-entered' });
  assert.deepEqual(pulse.net, { state: 'not-entered' });
  assert.deepEqual(pulse.runway, { state: 'not-entered' });
});

// ---------------------------------------------------------------------------
// computeEngagement
// ---------------------------------------------------------------------------

const NOW_MS = Date.parse('2026-10-02T12:00:00.000Z');
const WINDOW_START_MS = NOW_MS - 7 * 86_400_000;

/** A match record with only the fields the engagement count reads varied. */
function matchAt(startedAt: string, outcome: MatchRecord['outcome']): MatchRecord {
  return {
    id: `match-${startedAt}-${outcome}`,
    startedAt,
    duration: 0,
    playerCount: 1,
    scheme: 'scheme',
    mastermind: 'mastermind',
    outcome,
  };
}

/** A player record with only `lastActive` varied. */
function playerAt(lastActive: string): PlayerRecord {
  return {
    id: `player-${lastActive}`,
    name: 'player',
    email: '',
    matchesPlayed: 0,
    winRate: 0,
    lastActive,
    status: 'active',
  };
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

test('the 7-day window is inclusive at both edges and excludes outside timestamps', () => {
  const engagement = computeEngagement({
    matches: [
      matchAt(isoAt(WINDOW_START_MS), 'hero_wins'),
      matchAt(isoAt(NOW_MS), 'villain_wins'),
      matchAt(isoAt(WINDOW_START_MS - 1), 'hero_wins'),
      matchAt(isoAt(NOW_MS + 1), 'hero_wins'),
    ],
    players: [
      playerAt(isoAt(WINDOW_START_MS)),
      playerAt(isoAt(NOW_MS)),
      playerAt(isoAt(WINDOW_START_MS - 1)),
      playerAt(isoAt(NOW_MS + 1)),
    ],
    nowMs: NOW_MS,
  });
  assert.equal(engagement.matchesStarted?.count, 2);
  assert.equal(engagement.matchesFinished?.count, 2);
  assert.equal(engagement.activePlayers?.count, 2);
});

test('empty and unparseable timestamps are excluded', () => {
  const engagement = computeEngagement({
    matches: [
      matchAt('', 'hero_wins'),
      matchAt('not-a-date', 'hero_wins'),
      matchAt(isoAt(NOW_MS), 'hero_wins'),
    ],
    players: [playerAt(''), playerAt('garbage'), playerAt(isoAt(NOW_MS))],
    nowMs: NOW_MS,
  });
  assert.equal(engagement.matchesStarted?.count, 1);
  assert.equal(engagement.activePlayers?.count, 1);
});

test('in-progress matches (and ties, projected as in_progress) count as unfinished', () => {
  const engagement = computeEngagement({
    matches: [
      matchAt(isoAt(NOW_MS), 'in_progress'),
      matchAt(isoAt(NOW_MS), 'hero_wins'),
      matchAt(isoAt(NOW_MS), 'villain_wins'),
      matchAt(isoAt(WINDOW_START_MS - 1), 'hero_wins'),
    ],
    players: [],
    nowMs: NOW_MS,
  });
  assert.equal(engagement.matchesStarted?.count, 3);
  assert.equal(engagement.matchesFinished?.count, 2);
  assert.equal(engagement.matchesStarted?.displayValue, '3');
  assert.equal(engagement.activePlayers?.displayValue, '0');
});

test('a full match feed (50) marks both match cards "+", even with few in-window rows', () => {
  const matches: MatchRecord[] = [];
  for (let index = 0; index < 50; index += 1) {
    const startedAt = index < 3 ? isoAt(NOW_MS) : isoAt(WINDOW_START_MS - 1);
    matches.push(matchAt(startedAt, 'hero_wins'));
  }
  const engagement = computeEngagement({ matches, players: [], nowMs: NOW_MS });
  assert.equal(engagement.matchesStarted?.displayValue, '3+');
  assert.equal(engagement.matchesFinished?.displayValue, '3+');
  assert.equal(engagement.matchesStarted?.isCapped, true);
  assert.equal(engagement.activePlayers?.isCapped, false);

  const shortFeed = computeEngagement({
    matches: matches.slice(0, 49),
    players: [],
    nowMs: NOW_MS,
  });
  assert.equal(shortFeed.matchesStarted?.displayValue, '3');
});

test('a full player feed (100) marks the players card "+"', () => {
  const players: PlayerRecord[] = [];
  for (let index = 0; index < 100; index += 1) {
    players.push(playerAt(isoAt(NOW_MS - index * 86_400_000)));
  }
  const engagement = computeEngagement({ matches: [], players, nowMs: NOW_MS });
  assert.equal(engagement.activePlayers?.displayValue, '8+');
  assert.equal(engagement.matchesStarted?.isCapped, false);

  const shortFeed = computeEngagement({
    matches: [],
    players: players.slice(0, 99),
    nowMs: NOW_MS,
  });
  assert.equal(shortFeed.activePlayers?.displayValue, '8');
});

test('a feed that has not loaded yields null cards, never zero', () => {
  const engagement = computeEngagement({ matches: null, players: null, nowMs: NOW_MS });
  assert.equal(engagement.matchesStarted, null);
  assert.equal(engagement.matchesFinished, null);
  assert.equal(engagement.activePlayers, null);
});

// ---------------------------------------------------------------------------
// describeServerCard
// ---------------------------------------------------------------------------

function runtimeWithP99(p99: number): RuntimeHealthSnapshot {
  return {
    capturedAt: '2026-10-02T12:00:00.000Z',
    uptimeSeconds: 2 * 86_400 + 5 * 3_600,
    cpuCount: 2,
    cpuPercent: 10,
    eventLoopDelayMs: { mean: 1, p50: 1, p99, max: p99 },
    memoryRssMb: 200,
    webConcurrency: null,
  };
}

test('server success grades the chip with computeRuntimeHealthStatus', () => {
  const healthy = describeServerCard({ data: runtimeWithP99(1), error: null, source: 'LIVE' });
  assert.deepEqual(healthy, { valueLabel: 'Up · 2d 5h', status: 'on-track' });

  const watch = describeServerCard({
    data: runtimeWithP99(EVENT_LOOP_WATCH_MS),
    error: null,
    source: 'LIVE',
  });
  assert.equal(watch.status, 'needs-attention');

  const saturated = describeServerCard({
    data: runtimeWithP99(EVENT_LOOP_SATURATED_MS),
    error: null,
    source: 'LIVE',
  });
  assert.equal(saturated.status, 'off-track');
});

test('server auth errors (unauthorized / forbidden / 401 / 403) read "—" with no chip', () => {
  for (const code of ['unauthorized', 'forbidden', '401', '403']) {
    const card = describeServerCard({
      data: null,
      error: { message: 'denied', code, retryable: false },
      source: null,
    });
    assert.deepEqual(card, { valueLabel: '—', status: null }, `code ${code}`);
  }
});

test('server retryable errors (5xx / network / timeout) read Unreachable + Off track', () => {
  const card = describeServerCard({
    data: runtimeWithP99(1),
    error: { message: 'down', code: '502', retryable: true },
    source: 'LIVE',
  });
  assert.deepEqual(card, { valueLabel: 'Unreachable', status: 'off-track' });
});

test('server unknown errors read "—" with no chip', () => {
  const card = describeServerCard({
    data: null,
    error: { message: 'odd', code: '404', retryable: false },
    source: null,
  });
  assert.deepEqual(card, { valueLabel: '—', status: null });

  const noCode = describeServerCard({ data: null, error: { message: 'odd' }, source: null });
  assert.deepEqual(noCode, { valueLabel: '—', status: null });
});

test('server mock data shows the value with no chip', () => {
  const card = describeServerCard({
    data: runtimeWithP99(EVENT_LOOP_SATURATED_MS),
    error: null,
    source: 'MOCK',
  });
  assert.deepEqual(card, { valueLabel: 'Up · 2d 5h', status: null });
});

test('server card before the first response reads "—"', () => {
  assert.deepEqual(describeServerCard({ data: null, error: null, source: null }), {
    valueLabel: '—',
    status: null,
  });
});

// ---------------------------------------------------------------------------
// describeDrDrillCard
// ---------------------------------------------------------------------------

function readiness(overrides: Partial<DrReadiness>): DrReadiness {
  return {
    lastDrill: { date: '2026-09-01', result: 'pass' },
    nextDue: '2026-11-01',
    overdue: false,
    backupMirrorAlert: null,
    source: 'github',
    ...overrides,
  };
}

test('DR placeholder payload (server source "mock") reads Not connected, no chip', () => {
  const card = describeDrDrillCard({
    data: readiness({ source: 'mock', lastDrill: null, overdue: false }),
    error: null,
    source: 'LIVE',
  });
  assert.deepEqual(card, { valueLabel: 'Not connected', status: null });
});

test('DR github feed with no drill reads None recorded, no chip', () => {
  const card = describeDrDrillCard({
    data: readiness({ lastDrill: null }),
    error: null,
    source: 'LIVE',
  });
  assert.deepEqual(card, { valueLabel: 'None recorded', status: null });
});

test('DR overdue reads the drill with Off track; current reads On track', () => {
  const overdue = describeDrDrillCard({
    data: readiness({ lastDrill: { date: '2026-06-01', result: 'fail' }, overdue: true }),
    error: null,
    source: 'LIVE',
  });
  assert.deepEqual(overdue, { valueLabel: '2026-06-01 · FAIL', status: 'off-track' });

  const current = describeDrDrillCard({ data: readiness({}), error: null, source: 'LIVE' });
  assert.deepEqual(current, { valueLabel: '2026-09-01 · PASS', status: 'on-track' });

  const unknownResult = describeDrDrillCard({
    data: readiness({ lastDrill: { date: '2026-09-01', result: 'unknown' } }),
    error: null,
    source: 'LIVE',
  });
  assert.equal(unknownResult.valueLabel, '2026-09-01 · Unknown');
});

test('DR fetch errors of every kind read "—" with no chip', () => {
  const errors = [
    { message: 'denied', code: '401', retryable: false },
    { message: 'down', code: 'network_error', retryable: true },
    { message: 'odd', code: '404', retryable: false },
  ];
  for (const error of errors) {
    const card = describeDrDrillCard({ data: readiness({}), error, source: 'LIVE' });
    assert.deepEqual(card, { valueLabel: '—', status: null }, `code ${error.code}`);
  }
});

test('DR mock mode (envelope MOCK) shows the mock value with no chip', () => {
  const card = describeDrDrillCard({
    data: readiness({ source: 'mock', overdue: true }),
    error: null,
    source: 'MOCK',
  });
  assert.deepEqual(card, { valueLabel: '2026-09-01 · PASS', status: null });

  const noDrill = describeDrDrillCard({
    data: readiness({ source: 'mock', lastDrill: null }),
    error: null,
    source: 'MOCK',
  });
  assert.deepEqual(noDrill, { valueLabel: 'None recorded', status: null });
});

test('DR card before the first response reads "—"', () => {
  assert.deepEqual(describeDrDrillCard({ data: null, error: null, source: null }), {
    valueLabel: '—',
    status: null,
  });
});
