/**
 * Dashboard Runtime Health Endpoint — Types (WP-439 / EC-474)
 *
 * Server-side response shape for the `/api/dash/system/runtime` feed — a live snapshot
 * of THIS server process's runtime health (CPU %, event-loop lag, memory,
 * uptime, CPU count, WEB_CONCURRENCY). It **byte-matches** the dashboard's own
 * contract type (`RuntimeHealthSnapshot`) so the dashboard's client consumes it
 * unchanged. The dashboard has no server import and vice-versa, so the shapes are
 * mirrored here.
 *
 * Unlike the WP-374 gameplay feeds, this reads NO database and NO registry — it
 * samples `process`/`perf_hooks`/`os`. The decision it supports: "is a single
 * Node process CPU-saturated (event-loop lagging while one core maxes and the
 * others idle) — i.e. is clustering worth its cost yet?" (D-24258).
 *
 * **Drift source of truth:** `apps/dashboard/src/types/index.ts`.
 *
 * Authority: WP-439 §Contract; D-24258; D-20503 (bare `{ data: T }` envelope).
 */

import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { DatabaseClient } from './dashboardBilling.types.js';

export type { DatabaseClient };

/**
 * Event-loop delay percentiles (milliseconds) over the window since the previous
 * read. A rising `p99` while CPU is high is the single clearest sign the JS
 * thread is saturated — the signal that decides whether clustering is warranted.
 */
export interface EventLoopDelayMs {
  readonly mean: number;
  readonly p50: number;
  readonly p99: number;
  readonly max: number;
}

/** A live snapshot of the server process's runtime health. */
export interface RuntimeHealthSnapshot {
  /** ISO-8601 capture time. */
  readonly capturedAt: string;
  /** `process.uptime()` in whole seconds. */
  readonly uptimeSeconds: number;
  /** `os.cpus().length` — cores visible to this instance. */
  readonly cpuCount: number;
  /**
   * This process's CPU use over the window since the previous read, as a percent
   * of TOTAL machine capacity (all cores). A pure-JS Node process caps near
   * `100 / cpuCount` (one core); approaching that ceiling while the other cores
   * idle is the clustering signal. `null` on the very first read (no baseline
   * window yet).
   */
  readonly cpuPercent: number | null;
  /** Event-loop delay percentiles (ms) over the window since the previous read. */
  readonly eventLoopDelayMs: EventLoopDelayMs;
  /** Resident set size in megabytes (`process.memoryUsage().rss`). */
  readonly memoryRssMb: number;
  /**
   * `process.env.WEB_CONCURRENCY` parsed to an integer, or `null` when unset.
   * Surfaced because Render sets it from the CPU count; it is inert today (the
   * server runs one process), so `cpuCount > 1` with the JS thread saturated is
   * the "clustering would help" tell.
   */
  readonly webConcurrency: number | null;
}

/**
 * Caller-injected dependencies for the dashboard runtime route. The admin gate
 * still needs the session bundle (verifier/accountResolver/database) even though
 * the metric itself reads no database.
 */
export interface DashboardRuntimeRouteDependencies {
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}
