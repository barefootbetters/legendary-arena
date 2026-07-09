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

// ---------------------------------------------------------------------------
// Per-player progress (WP-344 / D-24131 §8b)
// ---------------------------------------------------------------------------

/** One leg's progress: the player's best winning score, or null if the
 * leg is not yet won. */
export interface GauntletLegProgress {
  readonly schemeSlug: string;
  readonly bestFinalScore: number | null;
}

/** One gauntlet's progress for one player ("5/8 schemes defeated"). */
export interface GauntletProgress {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly board: string;
  readonly legCount: number;
  readonly completedLegCount: number;
  readonly isComplete: boolean;
  readonly legs: readonly GauntletLegProgress[];
}

/**
 * Internal row shape returned by the player-progress query.
 */
interface PlayerWinningRow {
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
}

/**
 * Computes one player's progress across the supplied gauntlets.
 *
 * why: the qualification predicate is the WP-342 BOARD predicate verbatim
 * (`outcome = 'heroes-win'`, link/public visibility, currently-published
 * `scoringConfigVersion`) — personal progress numbers must never disagree
 * with the public board (D-24131 §3/§5).
 *
 * Returns only gauntlets where the player has at least one winning leg —
 * a full catalog of zero-progress rows is noise; the consumer renders its
 * own no-progress state.
 *
 * @param accountId The caller's server AccountId (resolved to `player_id`
 *   via the `ext_id` join — ranking identity never keys on handle, per
 *   DESIGN-RANKING).
 * @param catalog The gauntlets to evaluate (the full startup catalog, or
 *   a filtered slice for badge-issuance checks).
 * @param database The pg pool (read-only queries).
 * @param leaderboardDeps The injected PAR gate bundle (version filter).
 * @returns Progress entries in catalog order.
 */
export async function getPlayerGauntletProgress(
  accountId: string,
  catalog: readonly GauntletDefinition[],
  database: DatabaseClient,
  leaderboardDeps: LeaderboardDependencies,
): Promise<GauntletProgress[]> {
  if (catalog.length === 0) {
    return [];
  }

  const result = await database.query(
    'SELECT cs.scenario_key, cs.final_score, cs.scoring_config_version ' +
      'FROM legendary.competitive_scores cs ' +
      'INNER JOIN legendary.players p ON cs.player_id = p.player_id ' +
      'INNER JOIN legendary.replay_ownership ro ' +
      '  ON ro.player_id = cs.player_id AND ro.replay_hash = cs.replay_hash ' +
      "WHERE p.ext_id = $1 AND cs.outcome = 'heroes-win' " +
      "  AND ro.visibility IN ('link', 'public')",
    [accountId],
  );

  // Fold qualifying rows into best-per-(scheme, mastermind) slots.
  const bestByLegKey = new Map<string, number>();
  for (const row of result.rows as PlayerWinningRow[]) {
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
    const keyParts = row.scenario_key.split('::');
    const legKey = `${keyParts[0]}::${keyParts[1]}`;
    const currentBest = bestByLegKey.get(legKey);
    if (currentBest === undefined || row.final_score < currentBest) {
      bestByLegKey.set(legKey, row.final_score);
    }
  }

  const progressEntries: GauntletProgress[] = [];
  for (const definition of catalog) {
    const legs: GauntletLegProgress[] = [];
    let completedLegCount = 0;
    for (const schemeSlug of definition.legSchemeSlugs) {
      const bestFinalScore =
        bestByLegKey.get(`${schemeSlug}::${definition.mastermindSlug}`) ?? null;
      if (bestFinalScore !== null) {
        completedLegCount = completedLegCount + 1;
      }
      legs.push({ schemeSlug, bestFinalScore });
    }
    // why: zero-progress gauntlets are omitted — the endpoint contract
    // (EC-374 §Locked Values) leaves the no-progress state to the client.
    if (completedLegCount === 0) {
      continue;
    }
    progressEntries.push({
      setAbbr: definition.setAbbr,
      setName: definition.setName,
      mastermindSlug: definition.mastermindSlug,
      mastermindName: definition.mastermindName,
      board: buildGauntletBoardName(definition),
      legCount: definition.legSchemeSlugs.length,
      completedLegCount,
      isComplete: completedLegCount === definition.legSchemeSlugs.length,
      legs,
    });
  }

  return progressEntries;
}
