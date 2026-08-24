import { computed, type ComputedRef } from 'vue';
import bundleData from '../data/par-fidelity.json';
import type {
  ParFidelityBundle,
  ParFidelityReport,
  ParFidelityRow,
  ParProfile,
} from '../types/parFidelity.js';

// why: a scenario counts as "too easy" when the competent AI wins at least 90% of
// games — the WP-597 sweep's most-too-easy legs sit at 100%, and the ranking is
// carried by win rate + first-winning-turn (the monotoneImproving flag fired 0/128
// under real scoring, D-24406). 0.9 is the diagnostic band, not a competitive line.
const TOO_EASY_WIN_RATE = 0.9;

/** Summary tiles for the PAR Fidelity panel header. */
export interface ParFidelitySummary {
  readonly scenariosSwept: number;
  readonly winnableCount: number;
  readonly winnablePercent: number;
  readonly tooEasyCount: number;
  readonly unwinnableCount: number;
  readonly sample: number;
}

/**
 * Computes the summary tiles from a report. `winnable` = any hero win observed;
 * `tooEasy` = win rate ≥ TOO_EASY_WIN_RATE; `unwinnable` = zero wins.
 */
export function summarizeReport(report: ParFidelityReport): ParFidelitySummary {
  let winnableCount = 0;
  let tooEasyCount = 0;
  let unwinnableCount = 0;
  for (const row of report.scenarios) {
    if (row.winRate > 0) {
      winnableCount += 1;
    } else {
      unwinnableCount += 1;
    }
    if (row.winRate >= TOO_EASY_WIN_RATE) {
      tooEasyCount += 1;
    }
  }
  const scenariosSwept = report.scenarios.length;
  const winnablePercent =
    scenariosSwept === 0 ? 0 : Math.round((winnableCount / scenariosSwept) * 1000) / 10;
  return {
    scenariosSwept,
    winnableCount,
    winnablePercent,
    tooEasyCount,
    unwinnableCount,
    sample: report.sample,
  };
}

interface UseParFidelityOptions {
  /** Injectable bundle. Defaults to the build-time bundled artifact. */
  bundle?: ParFidelityBundle;
}

interface UseParFidelityReturn {
  /** Ranked rows (most-too-easy first) — the report's `scenarios` array. */
  rows: ComputedRef<readonly ParFidelityRow[]>;
  summary: ComputedRef<ParFidelitySummary>;
  /** The per-scenario profile for the sweet-spot curve, or null when absent. */
  getProfile: (scenarioKey: string) => ParProfile | null;
  error: string | undefined;
}

/**
 * Provides the PAR Fidelity data for the /coverage panel: the ranked rows, the
 * summary tiles, and a per-scenario profile lookup for the click-to-expand curve.
 * The bundled data is static; tests inject a fixture bundle via `options.bundle`.
 */
export function useParFidelity(options?: UseParFidelityOptions): UseParFidelityReturn {
  const bundle = options?.bundle ?? (bundleData as unknown as ParFidelityBundle);
  return {
    rows: computed(() => bundle.report.scenarios),
    summary: computed(() => summarizeReport(bundle.report)),
    getProfile: (scenarioKey: string): ParProfile | null => bundle.profiles[scenarioKey] ?? null,
    error: bundle.error,
  };
}
