/**
 * dashboardRuntime.logic tests (WP-439 / EC-474).
 *
 * Pins the pure metric-math (CPU %, ns→ms, WEB_CONCURRENCY parse, snapshot
 * assembly) with fixed inputs — no real timing — plus a smoke test that the live
 * `getRuntimeHealthSnapshot` returns a well-formed snapshot.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRuntimeHealthSnapshot,
  computeCpuPercent,
  getRuntimeHealthSnapshot,
  parseWebConcurrency,
  type RuntimeHealthReadings,
} from './dashboardRuntime.logic.js';

test('computeCpuPercent normalises to total machine capacity and rounds', () => {
  // one full core busy for the whole 1s window on a 2-CPU box → 50% of the machine.
  assert.equal(computeCpuPercent(1_000_000, 1_000_000, 2), 50);
  // that same one-core load on a 1-CPU box is 100%.
  assert.equal(computeCpuPercent(1_000_000, 1_000_000, 1), 100);
  // idle.
  assert.equal(computeCpuPercent(0, 1_000_000, 4), 0);
});

test('computeCpuPercent clamps to [0,100] and guards a non-positive window', () => {
  // a burst that would compute >100 (all-cores busy) clamps to 100.
  assert.equal(computeCpuPercent(4_000_000, 1_000_000, 2), 100);
  // no baseline window yet → null (render "—", never divide-by-zero).
  assert.equal(computeCpuPercent(5, 0, 2), null);
  assert.equal(computeCpuPercent(5, 1_000_000, 0), null);
});

test('parseWebConcurrency accepts a positive integer, else null', () => {
  assert.equal(parseWebConcurrency('2'), 2);
  assert.equal(parseWebConcurrency(undefined), null);
  assert.equal(parseWebConcurrency('0'), null);
  assert.equal(parseWebConcurrency('-3'), null);
  assert.equal(parseWebConcurrency('not-a-number'), null);
});

test('buildRuntimeHealthSnapshot converts ns→ms, rounds, and assembles', () => {
  const readings: RuntimeHealthReadings = {
    capturedAt: '2026-07-27T00:00:00.000Z',
    uptimeSeconds: 123.7,
    cpuCount: 2,
    cpuMicrosUsed: 500_000,
    windowMicros: 1_000_000,
    eventLoopMeanNs: 1_500_000, // 1.5ms
    eventLoopP50Ns: 1_000_000, // 1.0ms
    eventLoopP99Ns: 42_000_000, // 42ms
    eventLoopMaxNs: 90_000_000, // 90ms
    rssBytes: 268_435_456, // 256 MB
    webConcurrency: 2,
  };

  const snapshot = buildRuntimeHealthSnapshot(readings);

  assert.equal(snapshot.capturedAt, '2026-07-27T00:00:00.000Z');
  assert.equal(snapshot.uptimeSeconds, 124, 'uptime rounded to whole seconds');
  assert.equal(snapshot.cpuCount, 2);
  assert.equal(snapshot.cpuPercent, 25, '0.5 core of 2 = 25% of the machine');
  assert.deepEqual(snapshot.eventLoopDelayMs, { mean: 1.5, p50: 1, p99: 42, max: 90 });
  assert.equal(snapshot.memoryRssMb, 256);
  assert.equal(snapshot.webConcurrency, 2);
});

test('buildRuntimeHealthSnapshot floors negative/zero event-loop reads to 0', () => {
  // a fresh histogram reports Infinity/negatives for min-style reads before samples;
  // the ns→ms helper floors those to 0 so the tile never shows NaN/Infinity.
  const snapshot = buildRuntimeHealthSnapshot({
    capturedAt: '2026-07-27T00:00:00.000Z',
    uptimeSeconds: 1,
    cpuCount: 1,
    cpuMicrosUsed: 0,
    windowMicros: 1_000_000,
    eventLoopMeanNs: 0,
    eventLoopP50Ns: -1,
    eventLoopP99Ns: Number.POSITIVE_INFINITY,
    eventLoopMaxNs: Number.NaN,
    rssBytes: 0,
    webConcurrency: null,
  });
  assert.deepEqual(snapshot.eventLoopDelayMs, { mean: 0, p50: 0, p99: 0, max: 0 });
  assert.equal(snapshot.webConcurrency, null);
});

test('getRuntimeHealthSnapshot returns a well-formed live snapshot', () => {
  const snapshot = getRuntimeHealthSnapshot();
  assert.equal(typeof snapshot.capturedAt, 'string');
  assert.ok(snapshot.uptimeSeconds >= 0);
  assert.ok(snapshot.cpuCount >= 1);
  assert.ok(snapshot.cpuPercent === null || snapshot.cpuPercent >= 0);
  for (const key of ['mean', 'p50', 'p99', 'max'] as const) {
    assert.ok(snapshot.eventLoopDelayMs[key] >= 0, `${key} is a non-negative ms value`);
  }
  assert.ok(snapshot.memoryRssMb > 0, 'a running process has a positive RSS');
});
