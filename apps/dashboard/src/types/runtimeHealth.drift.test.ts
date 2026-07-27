import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RuntimeHealthSnapshot, EventLoopDelayMs } from './index.js';

// ============================================================================
// WP-439 / EC-474 — Cross-App Runtime-Health Type Drift Test (Dashboard ↔ Server).
//
// The dashboard `RuntimeHealthSnapshot` / `EventLoopDelayMs` (this file's
// `../types/index.ts`) are hand-maintained mirrors of the authoritative server
// types (`apps/server/src/dashboard/dashboardRuntime.types.ts`, WP-439). The
// dashboard CANNOT import the server package (layer boundary), so the shapes are
// kept in lock-step by convention only. This test is the missing guard: it
// compares the dashboard types' runtime field sets against committed,
// server-derived field-set constants and fails loudly if either side adds,
// removes, or renames a field. Mirrors `sweep.drift.test.ts`.
// ============================================================================

// why: the committed, server-derived field sets, hand-derived from
// `RuntimeHealthSnapshot` / `EventLoopDelayMs` in
// `apps/server/src/dashboard/dashboardRuntime.types.ts` (baseline: WP-439), NOT
// imported (the layer boundary forbids the dashboard importing the server
// package). When the server types change, re-derive these constants by hand in
// the same commit.
const SERVER_DERIVED_SNAPSHOT_FIELDS: readonly string[] = [
  'capturedAt',
  'uptimeSeconds',
  'cpuCount',
  'cpuPercent',
  'eventLoopDelayMs',
  'memoryRssMb',
  'webConcurrency',
];

const SERVER_DERIVED_EVENT_LOOP_FIELDS: readonly string[] = ['mean', 'p50', 'p99', 'max'];

// The dashboard field sets, captured via fully-typed literals — the compile-time
// half of the guard (a missing OR excess field fails `vue-tsc` under strict +
// exactOptionalPropertyTypes before this test runs). The runtime key set is
// derived from `Object.keys`, never a second hand-written list.
const eventLoopSample: EventLoopDelayMs = { mean: 0, p50: 0, p99: 0, max: 0 };
const snapshotSample: RuntimeHealthSnapshot = {
  capturedAt: '1970-01-01T00:00:00.000Z',
  uptimeSeconds: 0,
  cpuCount: 1,
  cpuPercent: null,
  eventLoopDelayMs: eventLoopSample,
  memoryRssMb: 0,
  webConcurrency: null,
};

test('dashboard RuntimeHealthSnapshot field set matches the server-derived set', () => {
  assert.deepEqual(
    Object.keys(snapshotSample).sort(),
    [...SERVER_DERIVED_SNAPSHOT_FIELDS].sort(),
    'apps/dashboard RuntimeHealthSnapshot drifted from apps/server dashboardRuntime.types.ts — re-derive both in the same commit.',
  );
});

test('dashboard EventLoopDelayMs field set matches the server-derived set', () => {
  assert.deepEqual(
    Object.keys(eventLoopSample).sort(),
    [...SERVER_DERIVED_EVENT_LOOP_FIELDS].sort(),
    'apps/dashboard EventLoopDelayMs drifted from apps/server dashboardRuntime.types.ts — re-derive both in the same commit.',
  );
});
