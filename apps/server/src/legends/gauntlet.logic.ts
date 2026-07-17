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
 * Authority: WP-342; WP-344; WP-384; EC-376 / EC-413 §Locked Values;
 * D-24131; D-24134; D-24187.
 */

import type {
  DatabaseClient,
  LeaderboardDependencies,
} from '../leaderboards/leaderboard.types.js';
import type {
  GauntletFixedSnapshotEntry,
  GauntletSnapshotEntry,
} from './legends.types.js';

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
}

/**
 * The player counts a gauntlet board exists for (D-24134 §2). Count 1 is
 * the solo board (the pre-WP-344 file name); counts 2-5 publish as
 * additive `-p<N>` files.
 */
export const GAUNTLET_PLAYER_COUNTS = [1, 2, 3, 4, 5] as const;

// why: EC-413 §Locked Values (D-24187 §5) — the fixed-division search
// enumerates subsets of a competitor's distinct team keys; more than this
// many distinct teams per (roster × count × gauntlet) are truncated to the
// best-scoring cap-many (lowest best-single-leg score, team key ASC
// tiebreak) with a logged warning — bounded work, never a silent cap.
const FIXED_POOL_TEAM_CAP = 12;

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
 * @returns The ordered gauntlet definitions.
 */
export function buildGauntletCatalog(
  setSummaries: readonly GauntletSetSummary[],
  heroPoolBudgets?: GauntletHeroPoolBudgets,
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
  owners: { playerId: string; displayName: string; visibility: string }[];
}

/**
 * Internal per-roster accumulation while folding qualifying replays into
 * best-per-leg slots for one player count. The open division reads
 * `bestScoreBySchemeSlug`; the fixed division reads the per-team map
 * (populated only from replays carrying a non-NULL team key).
 */
interface RosterLegAccumulator {
  players: readonly string[];
  bestScoreBySchemeSlug: Map<string, number>;
  bestScoreBySchemeAndTeamKey: Map<string, Map<string, number>>;
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
 * Collects a roster's distinct team keys across all legs, mapped to each
 * team's best (lowest) single-leg score — the deterministic ordering fact
 * the cap truncation sorts by.
 */
function collectDistinctTeams(
  rosterAccumulator: RosterLegAccumulator,
): Map<string, number> {
  const bestAnyLegByTeamKey = new Map<string, number>();
  for (const legMap of rosterAccumulator.bestScoreBySchemeAndTeamKey.values()) {
    for (const [teamKey, score] of legMap) {
      const currentBest = bestAnyLegByTeamKey.get(teamKey);
      if (currentBest === undefined || score < currentBest) {
        bestAnyLegByTeamKey.set(teamKey, score);
      }
    }
  }
  return bestAnyLegByTeamKey;
}

/**
 * Applies the FIXED_POOL_TEAM_CAP: returns at most cap-many team keys,
 * preferring the lowest best-single-leg score (team key ASC on ties), and
 * logs a warning when truncation occurs — the D-24187 §5 no-silent-caps
 * requirement.
 */
function selectBoundedTeams(
  bestAnyLegByTeamKey: Map<string, number>,
  definition: GauntletDefinition,
  playerCount: number,
  rosterPlayers: readonly string[],
): string[] {
  const rankedTeams = [...bestAnyLegByTeamKey.entries()].sort(
    (firstTeam, secondTeam) => {
      if (firstTeam[1] !== secondTeam[1]) {
        return firstTeam[1] - secondTeam[1];
      }
      return firstTeam[0] < secondTeam[0] ? -1 : 1;
    },
  );
  if (rankedTeams.length > FIXED_POOL_TEAM_CAP) {
    console.warn(
      `[gauntlet] fixed-division team cap: roster "${rosterPlayers.join(',')}" ` +
        `has ${rankedTeams.length} distinct teams on ` +
        `${buildGauntletBoardName(definition)} at ${playerCount} players; ` +
        `searching the best ${FIXED_POOL_TEAM_CAP} only (D-24187 §5).`,
    );
  }
  const boundedTeams: string[] = [];
  for (const rankedTeam of rankedTeams.slice(0, FIXED_POOL_TEAM_CAP)) {
    boundedTeams.push(rankedTeam[0]);
  }
  return boundedTeams;
}

/**
 * Evaluates one candidate hero pool (the union of a subset of teams):
 * picks, per leg, the lowest-scoring win among the bounded teams whose
 * heroes all fit inside the pool. Returns the assignment's total and the
 * chosen teams, or `null` when some leg has no pool-compatible win.
 */
function evaluatePoolUnion(
  poolUnion: ReadonlySet<string>,
  boundedTeams: readonly string[],
  heroesByTeamKey: ReadonlyMap<string, readonly string[]>,
  rosterAccumulator: RosterLegAccumulator,
  legSchemeSlugs: readonly string[],
): { totalScore: number; chosenTeamKeys: string[] } | null {
  let totalScore = 0;
  const chosenTeamKeys: string[] = [];
  for (const legSchemeSlug of legSchemeSlugs) {
    const legMap =
      rosterAccumulator.bestScoreBySchemeAndTeamKey.get(legSchemeSlug);
    if (legMap === undefined) {
      return null;
    }
    const legPick = pickBestTeamForLeg(
      legMap,
      poolUnion,
      boundedTeams,
      heroesByTeamKey,
    );
    if (legPick === null) {
      return null;
    }
    totalScore = totalScore + legPick.score;
    chosenTeamKeys.push(legPick.teamKey);
  }
  return { totalScore, chosenTeamKeys };
}

/**
 * Picks the lowest-scoring (team key ASC on ties) pool-compatible team
 * for one leg, or `null` when no bounded team both cleared the leg and
 * fits inside the candidate pool.
 */
function pickBestTeamForLeg(
  legMap: ReadonlyMap<string, number>,
  poolUnion: ReadonlySet<string>,
  boundedTeams: readonly string[],
  heroesByTeamKey: ReadonlyMap<string, readonly string[]>,
): { teamKey: string; score: number } | null {
  let bestScore: number | undefined;
  let bestTeamKey: string | undefined;
  for (const teamKey of boundedTeams) {
    const score = legMap.get(teamKey);
    if (score === undefined) {
      continue;
    }
    const teamHeroes = heroesByTeamKey.get(teamKey) ?? [];
    let isInsidePool = true;
    for (const hero of teamHeroes) {
      if (!poolUnion.has(hero)) {
        isInsidePool = false;
        break;
      }
    }
    if (!isInsidePool) {
      continue;
    }
    const isBetter =
      bestScore === undefined ||
      score < bestScore ||
      (score === bestScore && bestTeamKey !== undefined && teamKey < bestTeamKey);
    if (isBetter) {
      bestScore = score;
      bestTeamKey = teamKey;
    }
  }
  if (bestScore === undefined || bestTeamKey === undefined) {
    return null;
  }
  return { teamKey: bestTeamKey, score: bestScore };
}

/**
 * Finds a roster's best pool-satisfying assignment for one board
 * (WP-384 / D-24187 §4-§5): enumerates every non-empty subset of the
 * roster's (bounded) distinct teams, keeps subsets whose hero union fits
 * the budget, and evaluates each — an exact optimum over the bounded
 * search universe. Ties on total score break to the lexicographically
 * smallest joined hero pool. Returns `null` when no assignment qualifies.
 */
function findBestPoolAssignment(
  rosterAccumulator: RosterLegAccumulator,
  legSchemeSlugs: readonly string[],
  poolBudget: number,
  definition: GauntletDefinition,
  playerCount: number,
): { totalScore: number; heroPool: string[] } | null {
  const bestAnyLegByTeamKey = collectDistinctTeams(rosterAccumulator);
  if (bestAnyLegByTeamKey.size === 0) {
    return null;
  }
  const boundedTeams = selectBoundedTeams(
    bestAnyLegByTeamKey,
    definition,
    playerCount,
    rosterAccumulator.players,
  );
  const heroesByTeamKey = new Map<string, readonly string[]>();
  for (const teamKey of boundedTeams) {
    heroesByTeamKey.set(teamKey, teamKey.split('+'));
  }

  let best: { totalScore: number; heroPool: string[] } | null = null;
  const subsetCount = 2 ** boundedTeams.length;
  for (let subsetMask = 1; subsetMask < subsetCount; subsetMask += 1) {
    const poolUnion = new Set<string>();
    for (let teamIndex = 0; teamIndex < boundedTeams.length; teamIndex += 1) {
      if ((subsetMask & (1 << teamIndex)) !== 0) {
        for (const hero of heroesByTeamKey.get(boundedTeams[teamIndex]) ?? []) {
          poolUnion.add(hero);
        }
      }
    }
    if (poolUnion.size > poolBudget) {
      continue;
    }
    const evaluated = evaluatePoolUnion(
      poolUnion,
      boundedTeams,
      heroesByTeamKey,
      rosterAccumulator,
      legSchemeSlugs,
    );
    if (evaluated === null) {
      continue;
    }
    // why: D-24187 §6 — the published hero pool is the union of the CHOSEN
    // teams' heroes (the heroes actually used), not the candidate subset's
    // union, so the pool never over-reports.
    const chosenUnion = new Set<string>();
    for (const chosenTeamKey of evaluated.chosenTeamKeys) {
      for (const hero of heroesByTeamKey.get(chosenTeamKey) ?? []) {
        chosenUnion.add(hero);
      }
    }
    const heroPool = [...chosenUnion].sort();
    const isBetter =
      best === null ||
      evaluated.totalScore < best.totalScore ||
      (evaluated.totalScore === best.totalScore &&
        heroPool.join('+') < best.heroPool.join('+'));
    if (isBetter) {
      best = { totalScore: evaluated.totalScore, heroPool };
    }
  }
  return best;
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
 * without that member's consent. Any villain groups qualify.
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
      'ro.player_id, p.display_name, ro.visibility ' +
      'FROM ( ' +
      'SELECT DISTINCT ON (replay_hash) replay_hash, scenario_key, ' +
      'final_score, scoring_config_version, player_count, team_key ' +
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
            definition,
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
