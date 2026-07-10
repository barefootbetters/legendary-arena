/**
 * Mastermind Set-Gauntlet Boards — Catalog + Standings (WP-342 / WP-344)
 *
 * The D-24131 set-gauntlet: one board per (set × mastermind) for every set
 * packaging at least one scheme. A competitor enters a board by posting a
 * replay-verified WINNING score (`outcome = 'heroes-win'`) against that
 * mastermind under EVERY scheme in the gauntlet's set; the entry is the
 * average of the best winning score per scheme (lower is better, matching
 * the PAR golf scale). Standings are a derived aggregation over existing
 * `legendary.competitive_scores` rows — nothing here writes anything.
 *
 * WP-344 / D-24134 adds the player-count dimension: boards are keyed per
 * player count (1-5) and the competitor is the exact ROSTER — the team of
 * authenticated accounts owning the qualifying replay. The same roster must
 * clear every leg; entries carry every member's display name.
 *
 * Layer-boundary contract: no engine, registry, preplan, or UI imports.
 * The catalog arrives as plain data built by the server wiring layer
 * (`server.mjs`) from the startup registry, mirroring the WP-150
 * `getScenarioKeysForTheme` injection precedent.
 *
 * Authority: WP-342; WP-344; EC-376 §Locked Values; D-24131; D-24134.
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
 * One scheme of a set as the catalog consumes it — the canonical registry
 * `slug` plus the display `name` the index's `legs` publication needs
 * (WP-344 / D-24134 §5).
 */
export interface GauntletSchemeSummary {
  readonly slug: string;
  readonly name: string;
}

/**
 * The per-set slice of registry data the catalog builder consumes. The
 * wiring layer constructs these from `registry.listSets()` +
 * `registry.getSet(abbr)`; slugs are the registry's canonical `slug`
 * fields verbatim (never re-derived from names, per D-10014 discipline).
 */
export interface GauntletSetSummary {
  readonly setAbbr: string;
  readonly setName: string;
  readonly schemes: readonly GauntletSchemeSummary[];
  readonly masterminds: readonly {
    readonly slug: string;
    readonly name: string;
  }[];
}

/**
 * One leg of a gauntlet: a scheme of the gauntlet's home set.
 */
export interface GauntletLeg {
  readonly schemeSlug: string;
  readonly schemeName: string;
}

/**
 * One gauntlet: a mastermind and the scheme legs of its home set.
 */
export interface GauntletDefinition {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly legs: readonly GauntletLeg[];
}

/**
 * The player counts a gauntlet board exists for (D-24134 §2). Count 1 is
 * the solo board (the pre-WP-344 file name); counts 2-5 publish as
 * additive `-p<N>` files.
 */
export const GAUNTLET_PLAYER_COUNTS = [1, 2, 3, 4, 5] as const;

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
 * `slug` ASC order within a set, legs sorted by scheme slug ASC.
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
    if (setSummary.schemes.length === 0) {
      continue;
    }
    const sortedLegs: GauntletLeg[] = [];
    const sortedSchemes = [...setSummary.schemes].sort(
      (firstScheme, secondScheme) =>
        firstScheme.slug < secondScheme.slug ? -1 : 1,
    );
    for (const scheme of sortedSchemes) {
      sortedLegs.push({ schemeSlug: scheme.slug, schemeName: scheme.name });
    }
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
        legs: sortedLegs,
      });
    }
  }

  return catalog;
}

/**
 * The snapshot board name for a gauntlet definition's SOLO board, e.g.
 * `gauntlet-core-dr-doom`. Doubles as the R2 file stem
 * (`legends/v1/<name>.json`).
 */
export function buildGauntletBoardName(definition: GauntletDefinition): string {
  return `gauntlet-${definition.setAbbr}-${definition.mastermindSlug}`;
}

/**
 * The snapshot board name for a gauntlet definition at a player count
 * (D-24134 §2): the solo board keeps the bare name; counts 2-5 append
 * `-p<N>`.
 */
export function buildGauntletBoardNameForPlayerCount(
  definition: GauntletDefinition,
  playerCount: number,
): string {
  const baseName = buildGauntletBoardName(definition);
  if (playerCount === 1) {
    return baseName;
  }
  return `${baseName}-p${playerCount}`;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/**
 * Internal row shape returned by the qualifying-rows query — one row per
 * (replay, owner) pair after the replay-level dedupe subquery.
 */
interface GauntletRow {
  replay_hash: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
  player_count: number | string | null;
  player_id: number | string;
  display_name: string;
  visibility: string;
}

/**
 * Internal per-replay accumulation: the score facts plus every owner.
 */
interface ReplayAccumulator {
  scenarioKey: string;
  finalScore: number;
  scoringConfigVersion: number;
  playerCount: number;
  owners: { playerId: string; displayName: string; visibility: string }[];
}

/**
 * Internal per-roster accumulation while folding qualifying replays into
 * best-per-leg slots for one player count.
 */
interface RosterLegAccumulator {
  players: readonly string[];
  bestScoreBySchemeSlug: Map<string, number>;
}

/**
 * Computes the ranked standings for one gauntlet, keyed by player count.
 *
 * A qualifying replay must: (a) carry `outcome = 'heroes-win'` (D-24131
 * §3 — a NULL legacy outcome never qualifies), (b) carry a `player_count`
 * (a NULL legacy count never qualifies on any board — D-24134 §1),
 * (c) parse to this gauntlet's mastermind and one of its leg schemes
 * (both-sides-same-set rule, D-24131 §2), (d) carry the currently-published
 * `scoringConfigVersion` for its scenario, (e) have an ownership roster
 * whose size EQUALS its `player_count` — every seat authenticated; a guest
 * at the table voids team eligibility (D-24134 §3) — and (f) have every
 * owner's visibility `link`/`public`, so no display name is ever published
 * without that member's consent. Any villain groups qualify.
 *
 * The competitor is the exact roster (sorted owner ids). A roster enters a
 * count's standings only with a qualifying best on EVERY leg (complete
 * gauntlets only). `totalScore` is the integer sum of best-per-leg final
 * scores; ranking is `totalScore ASC`, then the handle-ASC roster joined
 * ASC (which reduces to `handle ASC` on solo boards, the WP-342 order).
 *
 * @param definition The gauntlet to compute.
 * @param database The pg pool (queries are read-only).
 * @param leaderboardDeps The injected PAR gate bundle — reused for both
 *   PAR-eligibility and the version filter.
 * @returns Entries per player count 1-5 (a count with no complete roster
 *   maps to an empty array).
 */
export async function getGauntletStandings(
  definition: GauntletDefinition,
  database: DatabaseClient,
  leaderboardDeps: LeaderboardDependencies,
): Promise<ReadonlyMap<number, GauntletSnapshotEntry[]>> {
  const legSchemeSlugs: string[] = [];
  for (const leg of definition.legs) {
    legSchemeSlugs.push(leg.schemeSlug);
  }

  // why: co-owner submissions produce one score row PER owning account
  // sharing a replay_hash, with identical score columns by construction
  // (D-5301 server recomputation) — DISTINCT ON (replay_hash) collapses the
  // duplicates so a replay is one candidate regardless of how many
  // co-owners submitted. The ownership JOIN then fans each replay back out
  // to one row per owner, which the fold regroups into rosters.
  // split_part positions: scenario_key =
  // "{schemeSlug}::{mastermindSlug}::{villains}" (WP-334 capture).
  const result = await database.query(
    'SELECT cs.replay_hash, cs.scenario_key, cs.final_score, ' +
      'cs.scoring_config_version, cs.player_count, ' +
      'ro.player_id, p.display_name, ro.visibility ' +
      'FROM ( ' +
      'SELECT DISTINCT ON (replay_hash) replay_hash, scenario_key, ' +
      'final_score, scoring_config_version, player_count ' +
      'FROM legendary.competitive_scores ' +
      "WHERE outcome = 'heroes-win' " +
      '  AND player_count IS NOT NULL ' +
      "  AND split_part(scenario_key, '::', 2) = $1 " +
      "  AND split_part(scenario_key, '::', 1) = ANY($2) " +
      'ORDER BY replay_hash ' +
      ') cs ' +
      'INNER JOIN legendary.replay_ownership ro ' +
      '  ON ro.replay_hash = cs.replay_hash ' +
      'INNER JOIN legendary.players p ON ro.player_id = p.player_id',
    [definition.mastermindSlug, legSchemeSlugs],
  );

  // --- Group rows by replay: score facts + full owner roster ---
  const replaysByHash = new Map<string, ReplayAccumulator>();
  for (const row of result.rows as GauntletRow[]) {
    const rowPlayerCount = Number(row.player_count);
    let replayAccumulator = replaysByHash.get(row.replay_hash);
    if (replayAccumulator === undefined) {
      replayAccumulator = {
        scenarioKey: row.scenario_key,
        finalScore: row.final_score,
        scoringConfigVersion: row.scoring_config_version,
        playerCount: rowPlayerCount,
        owners: [],
      };
      replaysByHash.set(row.replay_hash, replayAccumulator);
    }
    replayAccumulator.owners.push({
      playerId: String(row.player_id),
      displayName: row.display_name,
      visibility: row.visibility,
    });
  }

  // --- Filter to qualifying replays and accumulate per (count, roster) ---
  const accumulatorsByPlayerCount = new Map<
    number,
    Map<string, RosterLegAccumulator>
  >();

  for (const replay of replaysByHash.values()) {
    // why: VISION §22 / D-24131 §5 — a replay qualifies only at the
    // currently-published scoringConfigVersion for its scenario. The
    // injected checkParPublished already carries the published config per
    // scenario, so no separate PAR-store lookup is needed; an unpublished
    // scenario returns null and its replays never qualify (fail closed).
    const parGateHit = leaderboardDeps.checkParPublished(replay.scenarioKey);
    if (parGateHit === null) {
      continue;
    }
    if (
      replay.scoringConfigVersion !==
      parGateHit.scoringConfig.scoringConfigVersion
    ) {
      continue;
    }

    // why: D-24134 §1/§3 — the board's player count is the row's recorded
    // count (guarded 1..5 here because the stub-database test path bypasses
    // the SQL-side filters), and the roster must have exactly that many
    // members: ownership rows exist only for AUTHENTICATED seats (WP-333),
    // so a smaller roster means a guest sat at the table and the replay is
    // team-ineligible on every board.
    if (
      !Number.isInteger(replay.playerCount) ||
      replay.playerCount < 1 ||
      replay.playerCount > 5
    ) {
      continue;
    }
    if (replay.owners.length !== replay.playerCount) {
      continue;
    }

    // why: D-24134 §3 — every roster member's ownership must be link/public
    // before ANY member's display name reaches a snapshot; a single private
    // owner excludes the whole replay (consent-to-publish is per member).
    let hasHiddenOwner = false;
    for (const owner of replay.owners) {
      if (owner.visibility !== 'link' && owner.visibility !== 'public') {
        hasHiddenOwner = true;
        break;
      }
    }
    if (hasHiddenOwner) {
      continue;
    }

    const sortedOwnerIds: string[] = [];
    const sortedDisplayNames: string[] = [];
    for (const owner of replay.owners) {
      sortedOwnerIds.push(owner.playerId);
      sortedDisplayNames.push(owner.displayName);
    }
    sortedOwnerIds.sort();
    sortedDisplayNames.sort();
    const rosterKey = sortedOwnerIds.join(',');

    let rostersForCount = accumulatorsByPlayerCount.get(replay.playerCount);
    if (rostersForCount === undefined) {
      rostersForCount = new Map<string, RosterLegAccumulator>();
      accumulatorsByPlayerCount.set(replay.playerCount, rostersForCount);
    }

    let rosterAccumulator = rostersForCount.get(rosterKey);
    if (rosterAccumulator === undefined) {
      rosterAccumulator = {
        players: sortedDisplayNames,
        bestScoreBySchemeSlug: new Map<string, number>(),
      };
      rostersForCount.set(rosterKey, rosterAccumulator);
    }

    const schemeSlug = replay.scenarioKey.split('::')[0] ?? '';
    const currentBest = rosterAccumulator.bestScoreBySchemeSlug.get(schemeSlug);
    if (currentBest === undefined || replay.finalScore < currentBest) {
      rosterAccumulator.bestScoreBySchemeSlug.set(schemeSlug, replay.finalScore);
    }
  }

  // --- Complete gauntlets only, ranked, per player count ---
  const legCount = definition.legs.length;
  const standingsByPlayerCount = new Map<number, GauntletSnapshotEntry[]>();

  for (const playerCount of GAUNTLET_PLAYER_COUNTS) {
    const rostersForCount = accumulatorsByPlayerCount.get(playerCount);
    const unranked: { players: readonly string[]; totalScore: number }[] = [];

    if (rostersForCount !== undefined) {
      for (const rosterAccumulator of rostersForCount.values()) {
        let hasEveryLeg = true;
        let totalScore = 0;
        for (const legSchemeSlug of legSchemeSlugs) {
          const bestScore =
            rosterAccumulator.bestScoreBySchemeSlug.get(legSchemeSlug);
          if (bestScore === undefined) {
            hasEveryLeg = false;
            break;
          }
          totalScore = totalScore + bestScore;
        }
        if (hasEveryLeg) {
          unranked.push({ players: rosterAccumulator.players, totalScore });
        }
      }
    }

    // why: totalScore ASC (lower is better on the PAR scale), then the
    // joined handle-ASC roster by code-unit comparison — locale-independent
    // so snapshot ordering is deterministic across hosts; on solo boards
    // this reduces to the WP-342 `handle ASC` order (EC-376 §Locked Values).
    unranked.sort((firstEntry, secondEntry) => {
      if (firstEntry.totalScore !== secondEntry.totalScore) {
        return firstEntry.totalScore - secondEntry.totalScore;
      }
      const firstRoster = firstEntry.players.join(',');
      const secondRoster = secondEntry.players.join(',');
      return firstRoster < secondRoster ? -1 : 1;
    });

    const entries: GauntletSnapshotEntry[] = [];
    let rank = 0;
    for (const candidate of unranked) {
      rank = rank + 1;
      entries.push({
        handle: candidate.players[0] ?? '',
        rank,
        totalScore: candidate.totalScore,
        legCount,
        // why: integer centesimal average (×100) per the scoring-weights
        // precedent — avoids fractional JSON values while keeping
        // one-decimal display precision for the client (D-24131 §4).
        averageScoreCentis: Math.round((candidate.totalScore * 100) / legCount),
        players: candidate.players,
      });
    }

    standingsByPlayerCount.set(playerCount, entries);
  }

  return standingsByPlayerCount;
}
