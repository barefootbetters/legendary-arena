/**
 * PAR Fidelity types (WP-598) — the consumed subset of the committed WP-597
 * `data/par/profile/v1/` artifacts, bundled into `src/data/par-fidelity.json`.
 *
 * The bundle is read via an `as unknown as ParFidelityBundle` cast (the
 * `useCoverageLedger` pattern), so these interfaces declare only the fields the
 * panel consumes — the source carries extra top-level/profile fields
 * (`skippedCount`, `version`, `authoritative`, `derived`, `scoringConfigVersion`,
 * `simulationPolicyVersion`) that the cast tolerates and we intentionally omit.
 */

/** One ranked scenario row from the fidelity report (`report.scenarios[]`). */
export interface ParFidelityRow {
  readonly scenarioKey: string;
  readonly winRate: number;
  readonly lossRate: number;
  /** Smallest turn on which a hero win occurred, or null when never won. */
  readonly minWinningTurn: number | null;
  readonly monotoneImproving: boolean;
  readonly stuckAtCapCount: number;
  readonly binCount: number;
  readonly sampleSize: number;
  /** 1-based rank, 1 = most too-easy. */
  readonly tooEasyRank: number;
}

/** One skipped scenario from the sweep (empty in the shipped run). */
export interface ParFidelitySkip {
  readonly scenarioKey: string;
  readonly reason: string;
}

/** The ranked fidelity report (the top-level `report` of the bundle). */
export interface ParFidelityReport {
  readonly generatedAt: string;
  readonly sample: number;
  readonly scenarioCount: number;
  readonly scenarios: readonly ParFidelityRow[];
  readonly skipped: readonly ParFidelitySkip[];
}

/** One per-turn bin of a scenario's profile — the sweet-spot curve datum. */
export interface ParTurnBin {
  readonly turnCount: number;
  readonly gameCount: number;
  readonly medianRawScore: number;
  readonly p25RawScore: number;
  readonly p75RawScore: number;
  readonly winRate: number;
  readonly medianVictoryPoints: number;
}

/** A per-scenario profile — the curve data behind a click-to-expand row. */
export interface ParProfile {
  readonly scenarioKey: string;
  readonly bins: readonly ParTurnBin[];
  readonly winCount: number;
  readonly lossCount: number;
  readonly sampleSize: number;
  readonly minWinningTurn: number | null;
  readonly stuckAtCapCount: number;
  readonly monotoneImproving: boolean;
}

/** The combined build-time bundle (`src/data/par-fidelity.json`). */
export interface ParFidelityBundle {
  readonly report: ParFidelityReport;
  readonly profiles: Readonly<Record<string, ParProfile>>;
  /** Present only when the build fell back to the empty stub. */
  readonly error?: string;
}
