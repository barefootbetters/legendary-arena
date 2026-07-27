/**
 * Dashboard Runtime Health — Logic (WP-439 / EC-474 / D-24258)
 *
 * Samples THIS server process's runtime health: CPU % (over the window since the
 * previous read), event-loop delay percentiles (`perf_hooks.monitorEventLoopDelay`),
 * resident memory, uptime, CPU count, and WEB_CONCURRENCY. Backs the admin-gated
 * `GET /api/dash/system/runtime` feed. Reads NO database, NO registry, NO engine —
 * only `process` / `perf_hooks` / `os` (server layer; clock/CPU reads are allowed
 * here — the no-clock rule is an engine rule).
 *
 * The metric-math is a PURE `buildRuntimeHealthSnapshot(readings)` so it is unit
 * testable with fixed inputs; the thin `getRuntimeHealthSnapshot()` gathers the
 * live process readings (holding the CPU/event-loop baseline in module state) and
 * calls the pure builder.
 *
 * Authority: WP-439 §Scope; D-24258 (on-request sampled runtime signal).
 */

import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import { cpus } from 'node:os';

import type { RuntimeHealthSnapshot } from './dashboardRuntime.types.js';

/** Nanoseconds per millisecond, for the event-loop histogram (ns) → ms conversion. */
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
/** Bytes per megabyte, for the RSS (bytes) → MB conversion. */
const BYTES_PER_MEGABYTE = 1024 * 1024;
/** Nanoseconds per microsecond — `hrtime` is ns, `cpuUsage` is µs; align the span. */
const NANOSECONDS_PER_MICROSECOND = 1000;

/**
 * The process-lifetime event-loop delay histogram. Enabled ONCE at module load —
 * the module is imported when the runtime route registers at server startup, so
 * the histogram accumulates for the whole process. Each read (below) resets it, so
 * a reading reports the delay distribution over the window since the previous read.
 *
 * // why: `monitorEventLoopDelay` is the standard Node event-loop-lag signal; the
 * 20ms sampling resolution is Node's own default granularity — fine for a signal
 * an operator polls every ~30s, with negligible overhead.
 */
const eventLoopHistogram: IntervalHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

/**
 * Baseline for the CPU-percent delta. Seeded at module load (server startup) so the
 * FIRST request already has a window to measure against; updated on every read.
 *
 * // why: `process.cpuUsage()` is cumulative, so a percent needs a delta over a
 * known wall-clock span; `process.hrtime.bigint()` is the monotonic span clock
 * (immune to wall-clock adjustments). Both are server-layer reads, allowed here.
 */
let lastCpuUsage: NodeJS.CpuUsage = process.cpuUsage();
let lastCpuSampleAtNs: bigint = process.hrtime.bigint();

/**
 * The raw readings the pure builder needs. Gathered by {@link getRuntimeHealthSnapshot};
 * supplied directly by tests so the metric-math is exercised without real timing.
 */
export interface RuntimeHealthReadings {
  /** ISO-8601 capture time. */
  readonly capturedAt: string;
  /** `process.uptime()` seconds. */
  readonly uptimeSeconds: number;
  /** `os.cpus().length`. */
  readonly cpuCount: number;
  /** Sum of user+system CPU MICROSECONDS used over the window (delta of `process.cpuUsage()`). */
  readonly cpuMicrosUsed: number;
  /** Wall-clock MICROSECONDS elapsed over the same window. */
  readonly windowMicros: number;
  /** Event-loop delay percentiles in NANOSECONDS (raw histogram reads). */
  readonly eventLoopMeanNs: number;
  readonly eventLoopP50Ns: number;
  readonly eventLoopP99Ns: number;
  readonly eventLoopMaxNs: number;
  /** `process.memoryUsage().rss` in BYTES. */
  readonly rssBytes: number;
  /** Parsed `process.env.WEB_CONCURRENCY`, or `null` when unset/invalid. */
  readonly webConcurrency: number | null;
}

/**
 * Computes the process CPU percent (of TOTAL machine capacity) over a window.
 * Returns `null` when the window is non-positive (no baseline yet) so the caller
 * can render "—" rather than a divide-by-zero artefact.
 *
 * @param cpuMicrosUsed - user+system CPU microseconds used over the window.
 * @param windowMicros - wall-clock microseconds elapsed over the window.
 * @param cpuCount - cores visible to the instance (normalises to machine capacity).
 * @returns CPU percent in [0, 100], rounded to one decimal, or null.
 */
export function computeCpuPercent(
  cpuMicrosUsed: number,
  windowMicros: number,
  cpuCount: number,
): number | null {
  if (windowMicros <= 0 || cpuCount <= 0) {
    return null;
  }
  // why: divide by cpuCount so the percent is of TOTAL machine capacity (all
  // cores) — a pure-JS Node process caps near 100/cpuCount (one core), so a value
  // approaching that ceiling while the other cores idle is the clustering tell.
  const rawPercent = (cpuMicrosUsed / windowMicros / cpuCount) * 100;
  const clamped = Math.max(0, Math.min(100, rawPercent));
  return Math.round(clamped * 10) / 10;
}

/**
 * Rounds nanoseconds to milliseconds with one decimal (event-loop delay reads).
 *
 * @param nanoseconds - a raw histogram nanosecond value.
 * @returns the value in milliseconds, rounded to one decimal.
 */
function nanosecondsToMilliseconds(nanoseconds: number): number {
  if (!Number.isFinite(nanoseconds) || nanoseconds <= 0) {
    return 0;
  }
  return Math.round((nanoseconds / NANOSECONDS_PER_MILLISECOND) * 10) / 10;
}

/**
 * Pure metric-math: assembles a {@link RuntimeHealthSnapshot} from raw readings.
 * No I/O, no clock — every value comes from `readings`, so tests pin the CPU-% and
 * ns→ms math with fixed inputs.
 *
 * @param readings - the gathered process readings.
 * @returns the assembled snapshot.
 */
export function buildRuntimeHealthSnapshot(readings: RuntimeHealthReadings): RuntimeHealthSnapshot {
  return {
    capturedAt: readings.capturedAt,
    uptimeSeconds: Math.round(readings.uptimeSeconds),
    cpuCount: readings.cpuCount,
    cpuPercent: computeCpuPercent(readings.cpuMicrosUsed, readings.windowMicros, readings.cpuCount),
    eventLoopDelayMs: {
      mean: nanosecondsToMilliseconds(readings.eventLoopMeanNs),
      p50: nanosecondsToMilliseconds(readings.eventLoopP50Ns),
      p99: nanosecondsToMilliseconds(readings.eventLoopP99Ns),
      max: nanosecondsToMilliseconds(readings.eventLoopMaxNs),
    },
    memoryRssMb: Math.round((readings.rssBytes / BYTES_PER_MEGABYTE) * 10) / 10,
    webConcurrency: readings.webConcurrency,
  };
}

/**
 * Parses `process.env.WEB_CONCURRENCY` to a positive integer, or `null` when unset
 * or not a positive integer.
 *
 * @param raw - the raw env value.
 * @returns the parsed concurrency, or null.
 */
export function parseWebConcurrency(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Gathers the live process readings and returns a runtime-health snapshot. Reads
 * `process.cpuUsage`/`hrtime`, the event-loop histogram (then resets it), memory,
 * uptime, CPU count, and WEB_CONCURRENCY. The only impure function here — the math
 * lives in {@link buildRuntimeHealthSnapshot}.
 *
 * @returns the current runtime-health snapshot.
 */
export function getRuntimeHealthSnapshot(): RuntimeHealthSnapshot {
  const currentCpuUsage = process.cpuUsage();
  const currentSampleAtNs = process.hrtime.bigint();
  const cpuMicrosUsed =
    currentCpuUsage.user - lastCpuUsage.user + (currentCpuUsage.system - lastCpuUsage.system);
  // why: hrtime is nanoseconds; the CPU delta is microseconds — convert the span to
  // microseconds so the percent divides like units. bigint→Number is safe: the span
  // is tiny (inter-request seconds), nowhere near Number.MAX_SAFE_INTEGER micros.
  const windowMicros = Number(currentSampleAtNs - lastCpuSampleAtNs) / NANOSECONDS_PER_MICROSECOND;
  lastCpuUsage = currentCpuUsage;
  lastCpuSampleAtNs = currentSampleAtNs;

  const readings: RuntimeHealthReadings = {
    capturedAt: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    cpuCount: cpus().length,
    cpuMicrosUsed,
    windowMicros,
    eventLoopMeanNs: eventLoopHistogram.mean,
    eventLoopP50Ns: eventLoopHistogram.percentile(50),
    eventLoopP99Ns: eventLoopHistogram.percentile(99),
    eventLoopMaxNs: eventLoopHistogram.max,
    rssBytes: process.memoryUsage().rss,
    webConcurrency: parseWebConcurrency(process.env.WEB_CONCURRENCY),
  };
  // why: reset AFTER reading so the next reading covers the window since THIS read —
  // an operator polling every ~30s then sees the lag distribution for each interval,
  // not a lifetime average dominated by startup.
  eventLoopHistogram.reset();

  return buildRuntimeHealthSnapshot(readings);
}
