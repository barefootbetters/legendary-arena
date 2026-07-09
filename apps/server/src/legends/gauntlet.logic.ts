/**
 * Mastermind Set-Gauntlet Boards — Catalog + Standings (WP-342)
 *
 * The D-24131 set-gauntlet: one board per (set × mastermind) for every set
 * packaging at least one scheme. A player enters a board by posting a
 * replay-verified WINNING score (`outcome = 'heroes-win'`) against that
 * mastermind under EVERY scheme in the gauntlet's set; the entry is the
 * average of the best winning score per scheme (lower is better, matching
 * the PAR golf scale). Standings are a derived aggregation over existing
 * `legendary.competitive_scores` rows — nothing here writes anything.
 *
 * Layer-boundary contract: no engine, registry, preplan, or UI imports.
 * The catalog arrives as plain data built by the server wiring layer
 * (`server.mjs`) from the startup registry, mirroring the WP-150
 * `getScenarioKeysForTheme` injection precedent.
 *
 * Authority: WP-342; EC-372 §Locked Values; D-24131.
 */

import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';
import type { GauntletSnapshotEntry } from './legends.types.js';

// ---------------------------------------------------------------------------
// Catalog types — plain data handed in by the server wiring layer
// ---------------------------------------------------------------------------

/**
 * The per-set slice of registry data the catalog builder consumes. The
 * wiring layer constructs these from `registry.listSets()` +
 * `registry.getSet(abbr)`; slugs are the registry's canonical `slug`
 * fields verbatim (never re-derived from names, per D-10014 discipline).
 */
export interface GauntletSetSummary {
  readonly setAbbr: string;
  readonly setName: string;
  readonly schemeSlugs: readonly string[];
  readonly masterminds: readonly {
    readonly slug: string;
    readonly name: string;
  }[];
}

/**
 * One gauntlet: a mastermind and the scheme legs of its home set.
 */
export interface GauntletDefinition {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly legSchemeSlugs: readonly string[];
}

// ---------------------------------------------------------------------------
// Catalog builder
// ---------------------------------------------------------------------------

/**
 * Builds the gauntlet catalog: one `GauntletDefinition` per
 * (set × mastermind) for every set with at least one scheme. A set with
 * zero schemes contributes no gauntlets (D-24131 §1 — at current data
 * that excludes `dims` masterminds and the empty `3dtc` set).
 *
 * Ordering is deterministic: sets in `setAbbr` ASC order, masterminds in
 * `slug` ASC order within a set, leg slugs sorted ASC.
 *
 * @param setSummaries Plain per-set registry slices from the wiring layer.
 * @returns The ordered gauntlet definitions.
 */
export function buildGauntletCatalog(
  setSummaries: readonly GauntletSetSummary[],
): GauntletDefinition[] {
  const catalog: GauntletDefinition[] = [];

  const sortedSets = [...setSummaries].sort((firstSet, secondSet) =>
    firstSet.setAbbr < secondSet.setAbbr ? -1 : 1,
  );

  for (const setSummary of sortedSets) {
    if (setSummary.schemeSlugs.length === 0) {
      continue;
    }
    const sortedLegSlugs = [...setSummary.schemeSlugs].sort();
    const sortedMasterminds = [...setSummary.masterminds].sort(
      (firstMastermind, secondMastermind) =>
        firstMastermind.slug < secondMastermind.slug ? -1 : 1,
    );
    for (const mastermind of sortedMasterminds) {
      catalog.push({
        setAbbr: setSummary.setAbbr,
        setName: setSummary.setName,
        mastermindSlug: mastermind.slug,
        mastermindName: mastermind.name,
        legSchemeSlugs: sortedLegSlugs,
      });
    }
  }

  return catalog;
}

/**
 * The snapshot board name for a gauntlet definition, e.g.
 * `gauntlet-core-dr-doom`. Doubles as the R2 file stem
 * (`legends/v1/<name>.json`).
 */
export function buildGauntletBoardName(definition: GauntletDefinition): string {
  return `gauntlet-${definition.setAbbr}-${definition.mastermindSlug}`;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/**
 * Internal row shape returned by the qualifying-rows query.
 */
interface GauntletRow {
  player_id: number | string;
  display_name: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
}

/**
 * Internal per-player accumulation while folding qualifying rows into
 * best-per-leg slots.
 */
interface PlayerLegAccumulator {
  handle: string;
  bestScoreBySchemeSlug: Map<string, number>;
}

/**
 * Computes the ranked standings for one gauntlet.
 *
 * A qualifying row must: (a) carry `outcome = 'heroes-win'` (D-24131 §3 —
 * "defeat the mastermind"; a NULL legacy outcome never qualifies), (b) be
 * visible under the same `replay_ownership` discipline as every public
 * leaderboard read, (c) parse to this gauntlet's mastermind and one of its
 * leg schemes (both-sides-same-set rule, D-24131 §2), and (d) carry the
 * currently-published `scoringConfigVersion` for its scenario. Any villain
 * groups qualify.
 *
 * A player enters the standings only with a winning best on EVERY leg
 * (complete gauntlets only). `totalScore` is the integer sum of
 * best-per-leg final scores; ranking is `totalScore ASC, handle ASC`.
 *
 * @param definition The gauntlet to compute.
 * @param database The pg pool (queries are read-only).
 * @param leaderboardDeps The injected PAR gate bundle — reused for both
 *   PAR-eligibility and the version filter.
 * @returns Ranked snapshot entries (empty when no complete gauntlet exists).
 */
export async function getGauntletStandings(
  definition: GauntletDefinition,
  database: DatabaseClient,
  leaderboardDeps: LeaderboardDependencies,
): Promise<GauntletSnapshotEntry[]> {
  // why: same INNER JOIN + visibility discipline as getGlobalTopLeaderboard —
  // only link/public rows ever reach a public snapshot. split_part positions:
  // scenario_key = "{schemeSlug}::{mastermindSlug}::{villains}" (WP-334 capture).
  const result = await database.query(
    'SELECT cs.player_id, p.display_name, cs.scenario_key, ' +
      'cs.final_score, cs.scoring_config_version ' +
      'FROM legendary.competitive_scores cs ' +
      'INNER JOIN legendary.players p ON cs.player_id = p.player_id ' +
      'INNER JOIN legendary.replay_ownership ro ' +
      '  ON ro.player_id = cs.player_id AND ro.replay_hash = cs.replay_hash ' +
      "WHERE cs.outcome = 'heroes-win' " +
      "  AND ro.visibility IN ('link', 'public') " +
      "  AND split_part(cs.scenario_key, '::', 2) = $1 " +
      "  AND split_part(cs.scenario_key, '::', 1) = ANY($2)",
    [definition.mastermindSlug, definition.legSchemeSlugs],
  );

  const accumulatorByPlayerId = new Map<string, PlayerLegAccumulator>();

  for (const row of result.rows as GauntletRow[]) {
    // why: VISION §22 / D-24131 §5 — a row qualifies only at the
    // currently-published scoringConfigVersion for its scenario. The injected
    // checkParPublished already carries the published config per scenario, so
    // no separate PAR-store lookup is needed; an unpublished scenario returns
    // null and its rows never qualify (fail closed).
    const parGateHit = leaderboardDeps.checkParPublished(row.scenario_key);
    if (parGateHit === null) {
      continue;
    }
    if (
      row.scoring_config_version !==
      parGateHit.scoringConfig.scoringConfigVersion
    ) {
      continue;
    }

    const schemeSlug = row.scenario_key.split('::')[0] ?? '';
    const playerKey = String(row.player_id);

    let accumulator = accumulatorByPlayerId.get(playerKey);
    if (accumulator === undefined) {
      accumulator = {
        handle: row.display_name,
        bestScoreBySchemeSlug: new Map<string, number>(),
      };
      accumulatorByPlayerId.set(playerKey, accumulator);
    }

    const currentBest = accumulator.bestScoreBySchemeSlug.get(schemeSlug);
    if (currentBest === undefined || row.final_score < currentBest) {
      accumulator.bestScoreBySchemeSlug.set(schemeSlug, row.final_score);
    }
  }

  // --- Complete gauntlets only: a winning best on EVERY leg ---
  const unranked: { handle: string; totalScore: number }[] = [];
  for (const accumulator of accumulatorByPlayerId.values()) {
    let hasEveryLeg = true;
    let totalScore = 0;
    for (const legSchemeSlug of definition.legSchemeSlugs) {
      const bestScore = accumulator.bestScoreBySchemeSlug.get(legSchemeSlug);
      if (bestScore === undefined) {
        hasEveryLeg = false;
        break;
      }
      totalScore = totalScore + bestScore;
    }
    if (hasEveryLeg) {
      unranked.push({ handle: accumulator.handle, totalScore });
    }
  }

  // why: totalScore ASC (lower is better on the PAR scale), then handle ASC by
  // code-unit comparison — locale-independent so snapshot ordering is
  // deterministic across hosts (EC-372 §Locked Values).
  unranked.sort((firstEntry, secondEntry) => {
    if (firstEntry.totalScore !== secondEntry.totalScore) {
      return firstEntry.totalScore - secondEntry.totalScore;
    }
    return firstEntry.handle < secondEntry.handle ? -1 : 1;
  });

  const legCount = definition.legSchemeSlugs.length;
  const entries: GauntletSnapshotEntry[] = [];
  let rank = 0;
  for (const candidate of unranked) {
    rank = rank + 1;
    entries.push({
      handle: candidate.handle,
      rank,
      totalScore: candidate.totalScore,
      legCount,
      // why: integer centesimal average (×100) per the scoring-weights
      // precedent — avoids fractional JSON values while keeping one-decimal
      // display precision for the client (D-24131 §4).
      averageScoreCentis: Math.round((candidate.totalScore * 100) / legCount),
    });
  }

  return entries;
}
