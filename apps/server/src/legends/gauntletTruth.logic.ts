/**
 * Gauntlet-Truth Helper — the shared leg-clear predicate + fixed-division
 * pool-assignment search (WP-442).
 *
 * This module owns the reusable gauntlet-progression truth logic that used
 * to live inline in `gauntlet.logic.ts`'s `getGauntletStandings` fold: the
 * leg-clear qualification predicate (`qualifiesAsLegClear`), the approved-
 * loadout match (`matchesApprovedLoadout`), and the fixed-hero-pool
 * assignment search (`findBestPoolAssignment` plus its four private helpers
 * and the `FIXED_POOL_TEAM_CAP` constant). It was extracted so the
 * leaderboard standings and the future per-run tracker (WP-5) consume the
 * SAME functions and cannot drift on what "cleared a leg" or "champion"
 * means.
 *
 * The extraction is behavior-preserving: every function moved byte-for-byte
 * except the two decoupling signature changes (`selectBoundedTeams` /
 * `findBestPoolAssignment` take a precomputed `boardName: string` rather
 * than a `GauntletDefinition`, so this pure module never needs to import the
 * board-name builder). The authoritative proof is that
 * `gauntlet.logic.test.ts` passes unchanged.
 *
 * Layer lock (inherited from `gauntlet.logic.ts`, D-24187 / D-24199): pure,
 * data-injected, deterministic. No `registry`, `game-engine`, `preplan`,
 * `pg`, `boardgame.io`, or any `apps/*` import — only Node built-ins and a
 * TYPE-ONLY import of the approved-loadout shape from the sibling
 * `gauntlet.logic.ts`. The predicate receives already-fetched facts and a
 * plain `number | null` published version; it performs no DB query or I/O.
 *
 * Authority: WP-442; EC-477 §Locked Values; WP-384; WP-395; D-24187;
 * D-24199.
 */

import type { GauntletApprovedLoadouts } from './gauntlet.logic.js';

// why: EC-413 §Locked Values (D-24187 §5) — the fixed-division search
// enumerates subsets of a competitor's distinct team keys; more than this
// many distinct teams per (roster × count × gauntlet) are truncated to the
// best-scoring cap-many (lowest best-single-leg score, team key ASC
// tiebreak) with a logged warning — bounded work, never a silent cap.
// Moved verbatim from gauntlet.logic.ts (not re-derived).
export const FIXED_POOL_TEAM_CAP = 12;

/**
 * Internal per-roster accumulation while folding qualifying replays into
 * best-per-leg slots for one player count. The open division reads
 * `bestScoreBySchemeSlug`; the fixed division reads the per-team map
 * (populated only from replays carrying a non-NULL team key). Exported so
 * the pool search's caller (`gauntlet.logic.ts`) can type-only import it
 * back — the reverse edge stays type-only, so there is no import cycle.
 */
export interface RosterLegAccumulator {
  players: readonly string[];
  bestScoreBySchemeSlug: Map<string, number>;
  bestScoreBySchemeAndTeamKey: Map<string, Map<string, number>>;
}

/**
 * The already-fetched facts about one candidate replay that
 * `qualifiesAsLegClear` decides on. The caller builds this from the replay
 * accumulator (owner visibilities via a `for...of`, not `.reduce()`); the
 * predicate never touches the database.
 */
export interface LegClearReplayFacts {
  scenarioKey: string;
  scoringConfigVersion: number;
  playerCount: number;
  ownerVisibilities: readonly string[];
  henchmanKey: string | null;
}

/**
 * Whether a replay was played with one of the approved loadouts for its
 * gauntlet and player count (WP-395 / D-24199).
 *
 * why: PAR is calibrated per ScenarioKey and rejects a sample size under 500.
 * With villain groups unconstrained the ranked surface spans billions of
 * scenarios, which is not calibratable by any amount of compute — so a leg
 * qualifies only when its villain and henchmen groups match an approved
 * configuration. Casual match setup is untouched by this check.
 *
 * The comparison is asymmetric by necessity: villain groups are read from the
 * ScenarioKey's third segment, which carries bare slugs (the key format is
 * pinned — changing it would re-key every future PAR table), while henchmen
 * are read from the `henchman_key` column, which is ours and carries
 * set-qualified ids.
 *
 * @param approvedLoadouts the gauntlet's approved configurations, or undefined
 *   when the requirement is not configured (then everything qualifies).
 * @param playerCount the replay's player count.
 * @param scenarioKey the replay's scenario key.
 * @param henchmanKey the replay's henchmen key, or null on a pre-column row.
 * @returns true when the replay may count as a leg.
 */
export function matchesApprovedLoadout(
  approvedLoadouts: GauntletApprovedLoadouts | undefined,
  playerCount: number,
  scenarioKey: string,
  henchmanKey: string | null,
): boolean {
  if (approvedLoadouts === undefined) {
    return true;
  }
  const approvedForCount = approvedLoadouts[playerCount];
  if (approvedForCount === undefined || approvedForCount.length === 0) {
    // why: a gauntlet with no approved configuration at this count cannot be
    // qualified for. Fail closed, matching the PAR gate's posture — publishing
    // an unconstrained board is the failure this WP exists to prevent.
    return false;
  }
  // why: a NULL henchman_key predates migration 035. No backfill exists (the
  // table was empty when the column landed), so such a row can never prove
  // which henchmen it used and never satisfies the requirement.
  if (henchmanKey === null) {
    return false;
  }
  const villainSegment = scenarioKey.split('::')[2] ?? '';
  for (const approvedLoadout of approvedForCount) {
    if (
      approvedLoadout.villainSegment === villainSegment &&
      approvedLoadout.henchmanKey === henchmanKey
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a candidate replay clears its leg — the per-replay qualification
 * check that `getGauntletStandings` folds over (clauses d–g plus the
 * PAR-published version gate; SQL-side clauses a–c stay in the query). The
 * caller resolves `publishedScoringConfigVersion` from
 * `leaderboardDeps.checkParPublished(scenarioKey)` (null when the scenario
 * is unpublished — fail closed) and hands it in as a plain value so this
 * predicate stays free of the leaderboard-deps type and reusable by WP-5.
 *
 * why: the clause order below mirrors the source `getGauntletStandings` fold
 * EXACTLY (published-version present → version match → player-count guard →
 * roster-size-equals-count → approved loadout → all-owners-visible). The
 * refactor is behavior-preserving; reordering these would change the
 * qualifying set, so the order is load-bearing, not incidental.
 *
 * @param facts the already-fetched replay facts to decide on.
 * @param approvedLoadouts the gauntlet's approved configurations, or
 *   undefined when the requirement is not configured (loadout clause skipped).
 * @param publishedScoringConfigVersion the currently-published scoring config
 *   version for the replay's scenario, or null when unpublished.
 * @returns true when the replay qualifies as a cleared leg.
 */
export function qualifiesAsLegClear(
  facts: LegClearReplayFacts,
  approvedLoadouts: GauntletApprovedLoadouts | undefined,
  publishedScoringConfigVersion: number | null,
): boolean {
  // (1) VISION §22 / D-24131 §5 — an unpublished scenario returns null and
  // its replays never qualify (fail closed).
  if (publishedScoringConfigVersion === null) {
    return false;
  }
  // (2) a replay qualifies only at the currently-published version.
  if (facts.scoringConfigVersion !== publishedScoringConfigVersion) {
    return false;
  }
  // (3) D-24134 §1 — the board's player count is guarded 1..5 here because
  // the stub-database test path bypasses the SQL-side filters.
  if (
    !Number.isInteger(facts.playerCount) ||
    facts.playerCount < 1 ||
    facts.playerCount > 5
  ) {
    return false;
  }
  // (4) D-24134 §3 — the roster must have exactly `player_count` members;
  // ownership rows exist only for AUTHENTICATED seats (WP-333), so a smaller
  // roster means a guest sat at the table and the replay is team-ineligible.
  if (facts.ownerVisibilities.length !== facts.playerCount) {
    return false;
  }
  // (5) WP-395 / D-24199 clause (g) — a replay played with villain or
  // henchmen groups outside the approved menu simply does not qualify.
  if (
    !matchesApprovedLoadout(
      approvedLoadouts,
      facts.playerCount,
      facts.scenarioKey,
      facts.henchmanKey,
    )
  ) {
    return false;
  }
  // (6) D-24134 §3 — every roster member's ownership must be link/public
  // before ANY member's display name reaches a snapshot; a single private
  // owner excludes the whole replay (consent-to-publish is per member).
  for (const visibility of facts.ownerVisibilities) {
    if (visibility !== 'link' && visibility !== 'public') {
      return false;
    }
  }
  // (7) every clause passed.
  return true;
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
 *
 * why: `boardName` is passed in as a precomputed string (the caller's
 * `buildGauntletBoardName(definition)`) rather than a `GauntletDefinition`,
 * so this pure helper never imports the board-name builder or the definition
 * type — avoiding a runtime edge back into `gauntlet.logic.ts`. The emitted
 * warning string stays byte-identical to the pre-extraction source.
 */
function selectBoundedTeams(
  bestAnyLegByTeamKey: Map<string, number>,
  boardName: string,
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
        `${boardName} at ${playerCount} players; ` +
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
 *
 * `boardName` is the precomputed `buildGauntletBoardName(definition)` string
 * (see `selectBoundedTeams`), keeping this helper free of the definition
 * type and the board-name builder.
 */
export function findBestPoolAssignment(
  rosterAccumulator: RosterLegAccumulator,
  legSchemeSlugs: readonly string[],
  poolBudget: number,
  boardName: string,
  playerCount: number,
): { totalScore: number; heroPool: string[] } | null {
  const bestAnyLegByTeamKey = collectDistinctTeams(rosterAccumulator);
  if (bestAnyLegByTeamKey.size === 0) {
    return null;
  }
  const boundedTeams = selectBoundedTeams(
    bestAnyLegByTeamKey,
    boardName,
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
