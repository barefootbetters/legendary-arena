/**
 * Runtime-health display helpers (WP-439 / EC-474).
 *
 * Pure mappers from a `RuntimeHealthSnapshot` to the tile's status chip, formatted
 * values, and a plain-English clustering hint. The event-loop p99 lag is the
 * primary saturation signal (a rising p99 while a core maxes = the JS thread can't
 * keep up); CPU % is secondary context. Kept out of the widget so it is unit
 * tested without mounting Vue.
 */

import type { RuntimeHealthSnapshot } from '../types/index.js';

/** Runtime-health status, worst-to-best-ordered for the status chip. */
export type RuntimeHealthStatus = 'healthy' | 'watch' | 'saturated';

/** Canonical status set — a drift test iterates this against the union. */
export const RUNTIME_HEALTH_STATUSES: readonly RuntimeHealthStatus[] = [
  'healthy',
  'watch',
  'saturated',
];

/**
 * Event-loop p99 (ms) at/above which the loop is "watch" — noticeable jank is
 * starting. Below this the process is comfortably keeping up.
 */
export const EVENT_LOOP_WATCH_MS = 50;
/**
 * Event-loop p99 (ms) at/above which the loop is "saturated" — the JS thread is
 * struggling; this is the threshold that makes clustering worth considering.
 */
export const EVENT_LOOP_SATURATED_MS = 200;

/**
 * Classifies a snapshot by its event-loop p99 lag.
 *
 * @param snapshot - the runtime-health snapshot.
 * @returns the runtime-health status.
 */
export function computeRuntimeHealthStatus(snapshot: RuntimeHealthSnapshot): RuntimeHealthStatus {
  const p99 = snapshot.eventLoopDelayMs.p99;
  if (p99 >= EVENT_LOOP_SATURATED_MS) {
    return 'saturated';
  }
  if (p99 >= EVENT_LOOP_WATCH_MS) {
    return 'watch';
  }
  return 'healthy';
}

/**
 * The CPU percent a single fully-busy core represents on this box (a pure-JS Node
 * process caps near here). `cpuPercent` approaching this while other cores idle is
 * the clustering signal.
 *
 * @param cpuCount - cores visible to the instance.
 * @returns the one-core ceiling as a machine-percent (0-100).
 */
export function oneCoreCeilingPercent(cpuCount: number): number {
  return cpuCount > 0 ? Math.round(100 / cpuCount) : 100;
}

/**
 * Formats a nullable CPU percent for display ("—" until the first baseline window).
 *
 * @param cpuPercent - the snapshot's cpuPercent.
 * @returns a display string.
 */
export function formatCpuPercent(cpuPercent: number | null): string {
  return cpuPercent === null ? '—' : `${cpuPercent}%`;
}

/**
 * A one-line, operator-facing read of whether clustering would help — the whole
 * point of the tile. Saturated on a multi-core box with idle headroom is the only
 * "yes"; everything else is "one process is keeping up".
 *
 * @param snapshot - the runtime-health snapshot.
 * @returns a short sentence for the tile.
 */
export function describeClusteringHint(snapshot: RuntimeHealthSnapshot): string {
  const status = computeRuntimeHealthStatus(snapshot);
  if (status === 'saturated' && snapshot.cpuCount > 1) {
    return `Event-loop lag is high while ${snapshot.cpuCount - 1} of ${snapshot.cpuCount} cores sit idle — clustering could help.`;
  }
  if (status === 'saturated') {
    return 'Event-loop lag is high on a single-core instance — a larger instance, not clustering, is the lever.';
  }
  if (status === 'watch') {
    return 'Event-loop lag is climbing but the process is still keeping up — watch it.';
  }
  return 'One process is comfortably keeping up; no need to cluster.';
}
