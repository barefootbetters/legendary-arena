/**
 * Mastermind Set-Gauntlet Boards — Catalog + Standings (WP-342 / WP-344 /
 * WP-384)
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
 * WP-384 / D-24187 adds the fixed-hero-pool prestige DIVISION beside the
 * open one: a fixed entry exists only when some assignment of one
 * qualifying win per leg keeps the union of hero ids (the row's `team_key`)
 * within the board's pool budget (`heroCount + 2`). Open-division semantics
 * are unchanged; the fixed division is computed from the same single query.
 *
 * Layer-boundary contract: no engine, registry, preplan, or UI imports.
 * The catalog — and, per D-24187, the per-count hero-pool budgets — arrive
 * as plain data built by the server wiring layer (`server.mjs`) from the
 * startup registry, mirroring the WP-150 `getScenarioKeysForTheme`
 * injection precedent.
 *
 * WP-395 / D-24199 adds the canonical loadout requirement: a leg qualifies
 * only when its villain and henchmen groups match one of three approved
 * configurations for its player count, which is what makes PAR calibration
 * arithmetically possible. Casual play is unaffected.
 *
 * Authority: WP-342; WP-344; WP-384; WP-395; EC-376 / EC-413 / EC-435
 * §Locked Values; D-24131; D-24134; D-24187; D-24199.
 */

import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';
import type {
  GauntletFixedSnapshotEntry,
  GauntletSnapshotEntry,
} from './legends.types.js';
// why: WP-442 — the leg-clear predicate and the fixed-division pool search
// were extracted into a shared pure helper so the leaderboard and WP-5's run
// tracker consume the SAME truth logic. The runtime edge is one-directional
// (gauntlet.logic → gauntletTruth); the accumulator + facts types come back
// type-only, so there is no import cycle.
import {
  findBestPoolAssignment,
  qualifiesAsLegClear,
} from './gauntletTruth.logic.js';
import type {
  LegClearReplayFacts,
  RosterLegAccumulator,
} from './gauntletTruth.logic.js';

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
 * The fixed-division pool budget per player count (WP-384 / D-24187 §4):
 * `heroCount + 2` from the registry's PLAYER_COUNT_SETUP table. Keys are
 * the numeric player counts 1-5. Built by the wiring layer (`server.mjs`)
 * — never re-typed as literals here and never imported from the registry
 * (this module's layer lock).
 */
export type GauntletHeroPoolBudgets = Readonly<Record<number, number>>;

/**
 * One approved loadout as the qualification predicate consumes it (WP-395 /
 * D-24199): the two comparison keys a qualifying replay must match at one
 * player count.
 *
 * `villainSegment` is the ScenarioKey's third segment — bare group slugs,
 * sorted ASC, joined `+`. `henchmanKey` is the row's `henchman_key` column —
 * set-qualified henchman ids, sorted ASC, joined `+`.
 */
export interface GauntletApprovedLoadout {
  readonly villainSegment: string;
  readonly henchmanKey: string;
  // why: WP-395 — the predicate matches on the two derived keys above, but the
  // publisher needs the ids themselves to put the requirement on the board and
  // in the challenge link. An enforced-but-invisible rule reads as a broken
  // feature (the D-24186 / D-24190 failure class), so both travel together.
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

/**
 * The approved loadouts for one gauntlet, keyed by player count (WP-395 /
 * D-24199). Each count maps to the three configurations D-24199 settled on.
 * Built by the wiring layer (`server.mjs`) from the registry's generated
 * menu and stamped onto every definition, so this module stays registry-free.
 */
export type GauntletApprovedLoadouts = Readonly<
  Record<number, readonly GauntletApprovedLoadout[]>
>;

/**
 * One gauntlet: a mastermind and the scheme legs of its home set.
 * `heroPoolBudgets` rides the definition (WP-384) so the standings
 * computation needs no registry access; when absent (pre-WP-384 callers,
 * budget-less tests) the fixed division computes empty.
 */
export interface GauntletDefinition {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly legs: readonly GauntletLeg[];
  readonly heroPoolBudgets?: GauntletHeroPoolBudgets;
  // why: WP-395 / D-24199 — the approved villain + henchmen configurations
  // this gauntlet's legs must be played with. Optional so pre-WP-395 callers
  // and loadout-less tests keep their semantics; when absent the requirement
  // is not enforced and every villain/henchmen combination qualifies as before.
  readonly approvedLoadouts?: GauntletApprovedLoadouts;
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
 * @param heroPoolBudgets Optional per-count fixed-division pool budgets
 *   (WP-384 / D-24187 §4), stamped onto every definition. The wiring layer
 *   derives them from PLAYER_COUNT_SETUP; absent budgets disable the fixed
 *   division (it computes empty).
 * @param approvedLoadoutsByGauntlet Optional approved-loadout lookup keyed
 *   `setAbbr/mastermindSlug` (WP-395 / D-24199), built by the wiring layer
 *   from the registry's generated menu. A gauntlet with no entry carries no
 *   requirement and qualifies exactly as it did before this WP.
 * @returns The ordered gauntlet definitions.
 */
export function buildGauntletCatalog(
  setSummaries: readonly GauntletSetSummary[],
  heroPoolBudgets?: GauntletHeroPoolBudgets,
  approvedLoadoutsByGauntlet?: ReadonlyMap<string, GauntletApprovedLoadouts>,
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
        // why: WP-384 — the budgets ride every definition so the standings
        // computation stays registry-free; `undefined` flows through as an
        // absent optional field for pre-WP-384 callers.
        heroPoolBudgets,
        // why: WP-395 — same injection shape as the budgets; the requirement
        // is plain data so the predicate never imports the registry.
        approvedLoadouts: approvedLoadoutsByGauntlet?.get(
          `${setSummary.setAbbr}/${mastermind.slug}`,
        ),
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

/**
 * The snapshot board name for a gauntlet definition's FIXED-hero-pool
 * board at a player count (WP-384 / D-24187 §3): the `-fixed` segment
 * precedes the `-p<N>` count suffix, e.g. `gauntlet-core-dr-doom-fixed`
 * (solo) and `gauntlet-core-dr-doom-fixed-p3`.
 */
export function buildFixedGauntletBoardNameForPlayerCount(
  definition: GauntletDefinition,
  playerCount: number,
): string {
  const fixedBaseName = `${buildGauntletBoardName(definition)}-fixed`;
  if (playerCount === 1) {
    return fixedBaseName;
  }
  return `${fixedBaseName}-p${playerCount}`;
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
  team_key: string | null;
  henchman_key: string | null;
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
  teamKey: string | null;
  henchmanKey: string | null;
  owners: { playerId: string; displayName: string; visibility: string }[];
}

/**
 * The two divisions of one gauntlet board at one player count
 * (WP-384 / D-24187 §3): `open` is the D-24131/D-24134 standings,
 * unchanged; `fixed` is the pool-constrained prestige division.
 */
export interface GauntletStandingsForCount {
  readonly open: GauntletSnapshotEntry[];
  readonly fixed: GauntletFixedSnapshotEntry[];
}

/**
 * Computes the ranked standings for one gauntlet, keyed by player count.
 * Each count carries both divisions (WP-384 / D-24187 §3): `open` — the
 * D-24131/D-24134 standings, semantics unchanged — and `fixed`, the
 * pool-constrained prestige division.
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
 * without that member's consent, and (g) match one of the gauntlet's approved
 * villain + henchmen loadouts for its player count (WP-395 / D-24199) — the
 * requirement that makes PAR calibration tractable. Clause (g) is skipped
 * entirely when a definition carries no `approvedLoadouts`.
 *
 * The competitor is the exact roster (sorted owner ids). A roster enters a
 * count's standings only with a qualifying best on EVERY leg (complete
 * gauntlets only). `totalScore` is the integer sum of best-per-leg final
 * scores; ranking is `totalScore ASC`, then the handle-ASC roster joined
 * ASC (which reduces to `handle ASC` on solo boards, the WP-342 order).
 *
 * The FIXED division additionally requires a non-NULL `team_key` on every
 * win in the entry's assignment and the union of hero ids across the
 * assignment fitting the board's pool budget (`heroPoolBudgets` on the
 * definition; an absent budget disables the division for that count).
 *
 * @param definition The gauntlet to compute.
 * @param database The pg pool (queries are read-only).
 * @param leaderboardDeps The injected PAR gate bundle — reused for both
 *   PAR-eligibility and the version filter.
 * @returns Both divisions per player count 1-5 (a count with no complete
 *   roster maps to empty arrays).
 */
export async function getGauntletStandings(
  definition: GauntletDefinition,
  database: DatabaseClient,
  leaderboardDeps: LeaderboardDependencies,
): Promise<ReadonlyMap<number, GauntletStandingsForCount>> {
  const legSchemeSlugs: string[] = [];
  for (const leg of definition.legs) {
    legSchemeSlugs.push(leg.schemeSlug);
  }
  // why: WP-442 — the fixed-division pool search no longer takes the
  // definition; it takes the precomputed board name so the extracted helper
  // never imports the board-name builder. Computed once here and passed into
  // every findBestPoolAssignment call; the cap-warning string is byte-identical.
  const boardName = buildGauntletBoardName(definition);

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
      'cs.scoring_config_version, cs.player_count, cs.team_key, ' +
      'cs.henchman_key, ro.player_id, p.display_name, ro.visibility ' +
      'FROM ( ' +
      'SELECT DISTINCT ON (replay_hash) replay_hash, scenario_key, ' +
      'final_score, scoring_config_version, player_count, team_key, ' +
      'henchman_key ' +
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
        // why: WP-384 — a pre-migration stub row may omit the column
        // entirely; coalescing undefined to null keeps such replays
        // open-division-only rather than crashing the fixed fold.
        teamKey: row.team_key ?? null,
        // why: WP-395 — same defensive coalesce as teamKey; a row predating
        // migration 035 carries no column and must not crash the fold.
        henchmanKey: row.henchman_key ?? null,
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
    // why: WP-442 — the leg-clear qualification (the PAR-published version
    // gate, the version compare, the player-count guard, the roster-size
    // check, the approved-loadout match, and the visibility gate) now lives
    // in the shared `qualifiesAsLegClear` predicate so the leaderboard and
    // WP-5's run tracker share one definition of "cleared a leg." The
    // published version is resolved here from the injected checkParPublished
    // (an unpublished scenario returns null → the predicate fails closed);
    // the owner-visibility list is built with an explicit `for...of`, not
    // `.reduce()`, per the layer rule.
    const parGateHit = leaderboardDeps.checkParPublished(replay.scenarioKey);
    const publishedScoringConfigVersion =
      parGateHit === null
        ? null
        : parGateHit.scoringConfig.scoringConfigVersion;
    const ownerVisibilities: string[] = [];
    for (const owner of replay.owners) {
      ownerVisibilities.push(owner.visibility);
    }
    const legClearFacts: LegClearReplayFacts = {
      scenarioKey: replay.scenarioKey,
      scoringConfigVersion: replay.scoringConfigVersion,
      playerCount: replay.playerCount,
      ownerVisibilities,
      henchmanKey: replay.henchmanKey,
    };
    if (
      !qualifiesAsLegClear(
        legClearFacts,
        definition.approvedLoadouts,
        publishedScoringConfigVersion,
      )
    ) {
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
        bestScoreBySchemeAndTeamKey: new Map<string, Map<string, number>>(),
      };
      rostersForCount.set(rosterKey, rosterAccumulator);
    }

    const schemeSlug = replay.scenarioKey.split('::')[0] ?? '';
    const currentBest = rosterAccumulator.bestScoreBySchemeSlug.get(schemeSlug);
    if (currentBest === undefined || replay.finalScore < currentBest) {
      rosterAccumulator.bestScoreBySchemeSlug.set(schemeSlug, replay.finalScore);
    }

    // why: WP-384 / D-24187 §1 — only wins carrying a team identity feed the
    // fixed division; a NULL team_key replay stays open-division-only.
    if (replay.teamKey !== null) {
      let legTeams =
        rosterAccumulator.bestScoreBySchemeAndTeamKey.get(schemeSlug);
      if (legTeams === undefined) {
        legTeams = new Map<string, number>();
        rosterAccumulator.bestScoreBySchemeAndTeamKey.set(schemeSlug, legTeams);
      }
      const currentTeamBest = legTeams.get(replay.teamKey);
      if (currentTeamBest === undefined || replay.finalScore < currentTeamBest) {
        legTeams.set(replay.teamKey, replay.finalScore);
      }
    }
  }

  // --- Complete gauntlets only, ranked, per player count, per division ---
  const legCount = definition.legs.length;
  const standingsByPlayerCount = new Map<number, GauntletStandingsForCount>();

  for (const playerCount of GAUNTLET_PLAYER_COUNTS) {
    const rostersForCount = accumulatorsByPlayerCount.get(playerCount);
    const unranked: { players: readonly string[]; totalScore: number }[] = [];
    const unrankedFixed: {
      players: readonly string[];
      totalScore: number;
      heroPool: readonly string[];
    }[] = [];
    const poolBudget = definition.heroPoolBudgets?.[playerCount];

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

        // why: WP-384 / D-24187 §4 — the fixed division computes only when
        // the wiring layer injected a budget for this count; an absent
        // budget (pre-WP-384 caller, budget-less test) yields an empty
        // division, never a crash.
        if (poolBudget !== undefined) {
          const assignment = findBestPoolAssignment(
            rosterAccumulator,
            legSchemeSlugs,
            poolBudget,
            boardName,
            playerCount,
          );
          if (assignment !== null) {
            unrankedFixed.push({
              players: rosterAccumulator.players,
              totalScore: assignment.totalScore,
              heroPool: assignment.heroPool,
            });
          }
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
    // why: the fixed division ranks by the same rule as the open one
    // (D-24187 §4 — "tiebreak as the open division").
    unrankedFixed.sort((firstEntry, secondEntry) => {
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

    const fixedEntries: GauntletFixedSnapshotEntry[] = [];
    let fixedRank = 0;
    for (const candidate of unrankedFixed) {
      fixedRank = fixedRank + 1;
      fixedEntries.push({
        handle: candidate.players[0] ?? '',
        rank: fixedRank,
        totalScore: candidate.totalScore,
        legCount,
        averageScoreCentis: Math.round((candidate.totalScore * 100) / legCount),
        players: candidate.players,
        heroPool: candidate.heroPool,
      });
    }

    standingsByPlayerCount.set(playerCount, {
      open: entries,
      fixed: fixedEntries,
    });
  }

  return standingsByPlayerCount;
}
