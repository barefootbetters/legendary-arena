/**
 * runtimeHealth util tests (WP-439 / EC-474) — status thresholds, one-core
 * ceiling, CPU formatting, and the clustering hint.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RuntimeHealthSnapshot } from '../types/index.js';
import {
  RUNTIME_HEALTH_STATUSES,
  EVENT_LOOP_WATCH_MS,
  EVENT_LOOP_SATURATED_MS,
  computeRuntimeHealthStatus,
  oneCoreCeilingPercent,
  formatCpuPercent,
  describeClusteringHint,
} from './runtimeHealth.js';

function snapshotWith(overrides: Partial<RuntimeHealthSnapshot>): RuntimeHealthSnapshot {
  return {
    capturedAt: '2026-07-27T00:00:00.000Z',
    uptimeSeconds: 3600,
    cpuCount: 2,
    cpuPercent: 20,
    eventLoopDelayMs: { mean: 2, p50: 2, p99: 10, max: 30 },
    memoryRssMb: 256,
    webConcurrency: 2,
    ...overrides,
  };
}

test('computeRuntimeHealthStatus classifies by event-loop p99 at the boundaries', () => {
  assert.equal(
    computeRuntimeHealthStatus(
      snapshotWith({ eventLoopDelayMs: { mean: 1, p50: 1, p99: 10, max: 20 } }),
    ),
    'healthy',
  );
  // exactly at the watch threshold → watch
  assert.equal(
    computeRuntimeHealthStatus(
      snapshotWith({ eventLoopDelayMs: { mean: 1, p50: 1, p99: EVENT_LOOP_WATCH_MS, max: 60 } }),
    ),
    'watch',
  );
  assert.equal(
    computeRuntimeHealthStatus(
      snapshotWith({
        eventLoopDelayMs: { mean: 1, p50: 1, p99: EVENT_LOOP_WATCH_MS - 1, max: 60 },
      }),
    ),
    'healthy',
  );
  // exactly at the saturated threshold → saturated
  assert.equal(
    computeRuntimeHealthStatus(
      snapshotWith({
        eventLoopDelayMs: { mean: 1, p50: 1, p99: EVENT_LOOP_SATURATED_MS, max: 400 },
      }),
    ),
    'saturated',
  );
});

test('every computed status is a member of the canonical set', () => {
  for (const p99 of [0, EVENT_LOOP_WATCH_MS, EVENT_LOOP_SATURATED_MS, 5000]) {
    const status = computeRuntimeHealthStatus(
      snapshotWith({ eventLoopDelayMs: { mean: 1, p50: 1, p99, max: p99 } }),
    );
    assert.ok(RUNTIME_HEALTH_STATUSES.includes(status), `${status} is canonical`);
  }
});

test('oneCoreCeilingPercent normalises to a single core, guarding cpuCount 0', () => {
  assert.equal(oneCoreCeilingPercent(2), 50);
  assert.equal(oneCoreCeilingPercent(4), 25);
  assert.equal(oneCoreCeilingPercent(1), 100);
  assert.equal(oneCoreCeilingPercent(0), 100);
});

test('formatCpuPercent renders "—" for a null baseline, else a percent', () => {
  assert.equal(formatCpuPercent(null), '—');
  assert.equal(formatCpuPercent(0), '0%');
  assert.equal(formatCpuPercent(37.5), '37.5%');
});

test('describeClusteringHint recommends clustering ONLY when saturated with idle cores', () => {
  const saturatedMulti = snapshotWith({
    cpuCount: 2,
    eventLoopDelayMs: { mean: 10, p50: 10, p99: 260, max: 500 },
  });
  assert.match(describeClusteringHint(saturatedMulti), /clustering could help/);

  const saturatedSingle = snapshotWith({
    cpuCount: 1,
    eventLoopDelayMs: { mean: 10, p50: 10, p99: 260, max: 500 },
  });
  assert.match(describeClusteringHint(saturatedSingle), /larger instance, not clustering/);

  const watch = snapshotWith({ eventLoopDelayMs: { mean: 5, p50: 5, p99: 80, max: 120 } });
  assert.match(describeClusteringHint(watch), /still keeping up/);

  const healthy = snapshotWith({ eventLoopDelayMs: { mean: 1, p50: 1, p99: 10, max: 20 } });
  assert.match(describeClusteringHint(healthy), /no need to cluster/);
});
