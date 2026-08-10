import type { ServiceResponse } from '../types/index.js';

// ============================================================================
// WP-517 / EC-552 — Mock payload for the DR Readiness ops tile.
//
// The dashboard has no server import, so the `DrReadiness` wire shape is
// mirrored here (source of truth: apps/server/src/dashboard/
// dashboardDrReadiness.types.ts). Mock-mode-first per D-20402: the widget reads
// this factory when VITE_USE_MOCKS='true', and the LIVE flip is a getter
// substitution at the widget's fetch boundary, not a change here.
//
// This file carries NO bare `Date.now()` call site — the caller supplies
// `nowMs`, matching the `opsHealthMocks.ts` / `analyticsMocks.ts` clock-
// injection discipline (D-19605) so the payload is deterministic per input.
// ============================================================================

/** Outcome of the most-recent drill (mirrors the server `DrillResult`). */
export type DrillResult = 'pass' | 'fail' | 'unknown';

/** The last drill's UTC date + result (mirrors the server `LastDrill`). */
export interface LastDrill {
  readonly date: string;
  readonly result: DrillResult;
}

/** The DR-readiness projection (mirrors the server `DrReadiness` wire shape). */
export interface DrReadiness {
  readonly lastDrill: LastDrill | null;
  readonly nextDue: string;
  readonly overdue: boolean;
  readonly source: 'github' | 'mock';
}

/** Format a UTC millisecond timestamp as the canonical `YYYY-MM-DD` string. */
function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The 1st of the month after `nowMs`, as a UTC `YYYY-MM-DD` string. Mirrors the
 * server's `computeNextDue`; `Date.UTC` rolls December over to the next January.
 */
function computeNextDue(nowMs: number): string {
  const now = new Date(nowMs);
  return toIsoDate(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Deterministic mock `DrReadiness` for the tile in mock mode. Presents a
 * healthy, plausible posture — a passing drill closed on the 1st of the current
 * month, not overdue, next due the 1st of next month — with `data.source:
 * 'mock'` so the operator can tell mock data from live. Wrapped in a
 * `ServiceResponse` with `source: 'MOCK'` (the composable's freshness axis).
 */
export function mockDrReadiness(nowMs: number): ServiceResponse<DrReadiness> {
  const now = new Date(nowMs);
  const currentMonthFirst = toIsoDate(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    data: {
      lastDrill: { date: currentMonthFirst, result: 'pass' },
      nextDue: computeNextDue(nowMs),
      overdue: false,
      source: 'mock',
    },
    updatedAt: nowMs,
    source: 'MOCK',
  };
}
