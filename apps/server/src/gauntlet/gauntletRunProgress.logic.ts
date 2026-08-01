/**
 * Gauntlet Run Derived-Progression Read — Server Layer (WP-446 / EC-481)
 *
 * The DERIVED read WP-445 deferred: it turns a run's raw `leg_picks` +
 * `legendary.competitive_scores` into a progression view (a 5-state `status`,
 * the derived hero `pool`, `budgetHeadroom`, per-leg `cleared` + `lastPlayedAt`,
 * and an `isChampion` flag) computed at READ TIME, storing NOTHING (D-24262).
 * The seventh WP of the Mastermind Gauntlets: download → import → build → track
 * epic.
 *
 * The per-leg-clear and champion derivations REUSE the WP-442
 * `gauntletTruth.logic.ts` helpers (`qualifiesAsLegClear` +
 * `findBestPoolAssignment`) VERBATIM — the SAME functions and the SAME injected
 * inputs the leaderboard's `getGauntletStandings` uses — so the tracker and the
 * leaderboard can never disagree on "cleared a leg" or "champion." Neither
 * predicate is re-implemented here (drift = FAIL, D-24265 §1).
 *
 * Public functions:
 *   * `deriveGauntletRunStatus` — the pure 5-state map (unit-testable, no DB).
 *   * `deriveGauntletRunProgress` — the pure per-run derivation over injected
 *     inputs + already-fetched caller-scoped score rows.
 *   * `listGauntletRunProgress` — the DB entrypoint: reuse `listGauntletRuns`,
 *     run one caller-scoped `competitive_scores` read per run, and derive.
 *
 * Layer-boundary contract (D-24265 §5): this module imports ONLY the WP-442
 * helpers + types from `../legends/gauntletTruth.logic.js`, the `GauntletLeg`
 * type from `../legends/gauntlet.logic.js`, `listGauntletRuns` +
 * `loadPlayerIdByAccountId` from `./gauntletRun.logic.js`, the additive
 * derived-progression types from `./gauntletRun.types.js`, the
 * `LeaderboardDependencies` type from `../leaderboards/leaderboard.types.js`,
 * and Node built-ins. It reaches NO engine, speculative-planning,
 * match-framework, registry, or client-app package — the derivation inputs
 * arrive via the INJECTED resolver, never a registry-catalog build in this
 * layer. It is READ-ONLY: the module issues only SELECT queries, has no write
 * path, and never stamps a run's first-completed marker.
 *
 * Authority: WP-446 §Scope (In) + §Contract; EC-481 §Locked Values +
 * §Guardrails; D-24262 (derived-progression lock); D-24265 (single-run
 * derived-progression-semantics lock); D-24187 (fixed-pool budget);
 * D-24199 (approved-loadout requirement).
 */

import {
  findBestPoolAssignment,
  qualifiesAsLegClear,
} from '../legends/gauntletTruth.logic.js';
import type {
  LegClearReplayFacts,
  RosterLegAccumulator,
} from '../legends/gauntletTruth.logic.js';
import type {
  GauntletApprovedLoadouts,
  GauntletLeg,
} from '../legends/gauntlet.logic.js';
import type { LeaderboardDependencies } from '../leaderboards/leaderboard.types.js';
import {
  listGauntletRuns,
  loadPlayerIdByAccountId,
} from './gauntletRun.logic.js';
import type {
  AccountId,
  DatabaseClient,
  GauntletRunLaunch,
  GauntletRunLegProgress,
  GauntletRunProgressInputs,
  GauntletRunProgressResolver,
  GauntletRunProgressView,
  GauntletRunResult,
  GauntletRunStatus,
  GauntletRunView,
} from './gauntletRun.types.js';

/**
 * One (replay × owner) row returned by the caller-scoped qualifying-rows query.
 * Mirrors the `getGauntletStandings` row shape plus `created_at` (needed for the
 * per-leg `lastPlayedAt`). `pg` may hand a `timestamptz` back as a `Date` or an
 * ISO string; `bigint` columns come back as strings.
 */
interface CallerGauntletScoreRow {
  replay_hash: string;
  scenario_key: string;
  final_score: number;
  scoring_config_version: number;
  player_count: number | string | null;
  team_key: string | null;
  henchman_key: string | null;
  created_at: Date | string;
  player_id: number | string;
  display_name: string;
  visibility: string;
}

/**
 * Per-replay accumulation while grouping the query's (replay × owner) rows: the
 * score facts plus the created-at stamp plus every owner. Mirrors the
 * `getGauntletStandings` `ReplayAccumulator`.
 */
interface CallerReplayAccumulator {
  scenarioKey: string;
  finalScore: number;
  scoringConfigVersion: number;
  playerCount: number;
  teamKey: string | null;
  henchmanKey: string | null;
  createdAt: string;
  owners: { playerId: string; displayName: string; visibility: string }[];
}

/**
 * Convert a `timestamptz` column value (which `pg` may hand back as a `Date` or
 * an ISO string depending on driver configuration) to an ISO-8601 string.
 * Mirrors the private helper in `gauntletRun.logic.ts`; duplicated rather than
 * exported to keep that WP-445 contract file byte-unchanged.
 */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Map a run's per-leg progression + champion flag to the 5-state
 * `GauntletRunStatus` (WP-446 / D-24265 §2). Pure — no DB, no I/O — so the full
 * 5-state truth table is unit-testable without a database.
 *
 * @param legs the run's per-leg progression (carries `cleared` + `hasFullPicks`).
 * @param isChampion whether the run has a budget-valid fixed-pool assignment
 *   over the caller's winning teams (every leg cleared AND
 *   `findBestPoolAssignment` non-null).
 * @returns the derived status.
 */
export function deriveGauntletRunStatus(
  legs: readonly GauntletRunLegProgress[],
  isChampion: boolean,
): GauntletRunStatus {
  let clearedCount = 0;
  let hasAnyFullPicks = false;
  for (const leg of legs) {
    if (leg.cleared) {
      clearedCount = clearedCount + 1;
    }
    if (leg.hasFullPicks) {
      hasAnyFullPicks = true;
    }
  }
  const everyLegCleared = legs.length > 0 && clearedCount === legs.length;
  // why: the ladder order (champion → all-legs-cleared → playing → ready →
  // needs-heroes) is load-bearing, not cosmetic (D-24265 §2). champion and
  // all-legs-cleared BOTH satisfy "every leg cleared", so champion (a
  // budget-valid pool exists) MUST be tested first or it would be masked by
  // all-legs-cleared — collapsing the two distinct states the epic exists to
  // keep legible. playing (≥1 cleared) MUST come after the every-leg cases or
  // it would swallow them; ready (full picks, nothing cleared) sits above
  // needs-heroes so a launch-ready run is never reported as needing heroes.
  // Reordering any pair changes the reported state.
  if (everyLegCleared && isChampion) {
    return 'champion';
  }
  if (everyLegCleared) {
    return 'all-legs-cleared';
  }
  if (clearedCount > 0) {
    return 'playing';
  }
  if (hasAnyFullPicks) {
    return 'ready';
  }
  return 'needs-heroes';
}

/**
 * Group the query's (replay × owner) rows into per-replay accumulators. Mirrors
 * the `getGauntletStandings` grouping: one accumulator per `replay_hash`, the
 * score facts taken from the first row, and every owner's (id, name,
 * visibility) fanned in so the roster-size + visibility clauses in
 * `qualifiesAsLegClear` see the FULL roster.
 */
function groupRowsByReplay(
  qualifyingRows: readonly CallerGauntletScoreRow[],
): Map<string, CallerReplayAccumulator> {
  const replaysByHash = new Map<string, CallerReplayAccumulator>();
  for (const row of qualifyingRows) {
    let replay = replaysByHash.get(row.replay_hash);
    if (replay === undefined) {
      replay = {
        scenarioKey: row.scenario_key,
        finalScore: row.final_score,
        scoringConfigVersion: row.scoring_config_version,
        playerCount: Number(row.player_count),
        // why: a pre-migration stub row may omit team_key / henchman_key
        // entirely; coalescing undefined to null keeps such a replay
        // open-only rather than crashing the fixed fold (mirrors
        // getGauntletStandings' defensive coalesce).
        teamKey: row.team_key ?? null,
        henchmanKey: row.henchman_key ?? null,
        createdAt: toIsoString(row.created_at),
        owners: [],
      };
      replaysByHash.set(row.replay_hash, replay);
    }
    replay.owners.push({
      playerId: String(row.player_id),
      displayName: row.display_name,
      visibility: row.visibility,
    });
  }
  return replaysByHash;
}

/**
 * Assemble the additive per-run `launch` block from the injected inputs
 * (WP-449 / D-24269), plus the per-leg (per-scheme) `legLaunch` overlay
 * (WP-473 / D-24283). Returns the full `GauntletRunLaunch` when the approved
 * menu is configured for the run's `(division, playerCount)`
 * (`inputs.launchComposition !== null`), or `null` otherwise. Pure — no DB, no
 * I/O — so both branches are unit-testable.
 *
 * why the per-leg overlay reads `inputs.legs[].approvedLoadouts`: WP-472 stamps
 * each leg's EFFECTIVE approved loadout (the per-scheme override where authored,
 * else the mastermind's menu) onto the leg, and the wiring already injects
 * `definition.legs` as `inputs.legs`, so the per-leg composition is already in
 * hand — no registry import and no new injected field. Each leg's launch
 * composition is its approved variant 0 at the run's player count
 * (`approvedLoadouts[playerCount][0]`), mirroring the per-run variant-0 read.
 *
 * @param run the caller's raw stored run view (for the player count the per-leg
 *   composition is sliced at).
 * @param inputs the injected per-run derivation inputs (carries `legs`,
 *   `launchComposition`, `launchSupply`, and the set-qualified `mastermindId`).
 * @returns the launch block, or `null` when the approved menu is unconfigured.
 */
function deriveGauntletRunLaunch(
  run: GauntletRunView,
  inputs: GauntletRunProgressInputs,
): GauntletRunLaunch | null {
  // why: an unconfigured approved menu yields `launch === null`, NOT an empty
  // composition — a run with no resolvable variant-0 adversary must disable its
  // "Play this leg" buttons (the client gates on `launch !== null`) rather than
  // launch a match with empty villain / henchman piles. The four supply counts
  // are always present (fixed constants) but are meaningless without a
  // composition, so the whole block collapses to null together.
  if (inputs.launchComposition === null) {
    return null;
  }
  // why: WP-473 / D-24283 — build the per-leg overlay from each leg's effective
  // approved loadout (variant 0 at the run's player count). A leg with no
  // effective loadout adds no entry; when NO leg carries one (a pre-WP-472 /
  // unconfigured definition — e.g. the bare-leg test fixtures) the whole
  // `legLaunch` field is omitted so the block stays byte-identical to the per-run
  // launch the WP-449 client reads.
  const legLaunch: Record<
    string,
    { villainGroupIds: readonly string[]; henchmanGroupIds: readonly string[] }
  > = {};
  for (const leg of inputs.legs) {
    const legVariantZero = leg.approvedLoadouts?.[run.playerCount]?.[0];
    if (legVariantZero === undefined) {
      continue;
    }
    legLaunch[leg.schemeSlug] = {
      villainGroupIds: legVariantZero.villainGroupIds,
      henchmanGroupIds: legVariantZero.henchmanGroupIds,
    };
  }
  return {
    mastermindId: inputs.mastermindId,
    villainGroupIds: inputs.launchComposition.villainGroupIds,
    henchmanGroupIds: inputs.launchComposition.henchmanGroupIds,
    bystandersCount: inputs.launchSupply.bystandersCount,
    woundsCount: inputs.launchSupply.woundsCount,
    officersCount: inputs.launchSupply.officersCount,
    sidekicksCount: inputs.launchSupply.sidekicksCount,
    // why: omit the field entirely when empty (exactOptionalPropertyTypes +
    // byte-identity with the pre-WP-473 per-run launch block).
    ...(Object.keys(legLaunch).length > 0 ? { legLaunch } : {}),
  };
}

/**
 * Derive one run's full progression view from its injected inputs + the
 * already-fetched caller-scoped qualifying rows (WP-446 / D-24265 §3). Pure —
 * no DB, no I/O — so it is fully unit-testable with synthetic rows. Reuses
 * `qualifiesAsLegClear` (per-replay leg-clear) and `findBestPoolAssignment`
 * (champion pool search) from WP-442 verbatim.
 *
 * @param run the caller's raw stored run view.
 * @param inputs the injected per-run derivation inputs (legs, approvedLoadouts,
 *   poolBudget, heroCount, boardName).
 * @param qualifyingRows the caller-scoped `competitive_scores` rows already
 *   fetched for this run's mastermind + legs + player_count.
 * @param checkParPublished the leaderboard dependency that resolves a scenario's
 *   currently-published scoring-config version (null → unpublished → fail closed).
 * @returns the derived `GauntletRunProgressView`.
 */
export function deriveGauntletRunProgress(
  run: GauntletRunView,
  inputs: GauntletRunProgressInputs,
  qualifyingRows: readonly CallerGauntletScoreRow[],
  checkParPublished: LeaderboardDependencies['checkParPublished'],
): GauntletRunProgressView {
  const legSchemeSlugs: string[] = [];
  for (const leg of inputs.legs) {
    legSchemeSlugs.push(leg.schemeSlug);
  }
  // why: WP-473 / D-24283 — the per-scheme approved-loadout map the leg-clear
  // predicate selects by, built from each leg's effective loadout (WP-472 stamps
  // the per-scheme override where authored, else the mastermind's menu, onto the
  // injected `inputs.legs`). Passing it to `qualifiesAsLegClear` makes a leg
  // clear only against ITS OWN config — so a win carrying a different scheme's
  // villains of the same mastermind no longer clears the requiring leg. A leg
  // with no effective loadout adds no entry and the predicate falls back to the
  // per-mastermind `inputs.approvedLoadouts` (the WP-472 additive behaviour), so
  // non-Core clears exactly as before. This is the SAME map-from-legs the
  // leaderboard's `getGauntletStandings` builds — tracker and leaderboard cannot
  // disagree on "cleared a leg."
  const approvedLoadoutsByScheme = new Map<string, GauntletApprovedLoadouts>();
  for (const leg of inputs.legs) {
    if (leg.approvedLoadouts !== undefined) {
      approvedLoadoutsByScheme.set(leg.schemeSlug, leg.approvedLoadouts);
    }
  }

  const replaysByHash = groupRowsByReplay(qualifyingRows);

  const callerDisplayNames = new Set<string>();
  for (const row of qualifyingRows) {
    callerDisplayNames.add(row.display_name);
  }

  // why: caller-centric aggregation (D-24265 §4) — the run read folds ALL the
  // caller's qualifying replays at this player_count into ONE
  // RosterLegAccumulator keyed by team_key per leg, so findBestPoolAssignment's
  // champion search runs over "the caller's winning teams." This is
  // intentionally distinct from getGauntletStandings' per-roster grouping
  // (a separate accumulator per sorted-owner-id roster); for a solo run the
  // caller IS the roster and the two coincide, which the cross-check test pins.
  // `players` is used only by the cap-warning log, so the caller's own display
  // names suffice.
  const rosterAccumulator: RosterLegAccumulator = {
    players: [...callerDisplayNames].sort(),
    bestScoreBySchemeSlug: new Map<string, number>(),
    bestScoreBySchemeAndTeamKey: new Map<string, Map<string, number>>(),
  };
  const clearedSchemeSlugs = new Set<string>();
  const lastPlayedBySchemeSlug = new Map<string, string>();

  for (const replay of replaysByHash.values()) {
    // why: resolve the published scoring-config version from the injected
    // checkParPublished EXACTLY as getGauntletStandings does — an unpublished
    // scenario returns null and qualifiesAsLegClear fails closed on it, so the
    // tracker and the leaderboard agree that an unpublished leg is never
    // cleared (D-24265 §1). The owner-visibility list is built with an explicit
    // for...of, never .reduce(), per the layer rule.
    const parGateHit = checkParPublished(replay.scenarioKey);
    const publishedScoringConfigVersion =
      parGateHit === null ? null : parGateHit.scoringConfig.scoringConfigVersion;
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
        inputs.approvedLoadouts,
        publishedScoringConfigVersion,
        // why: WP-473 / D-24283 — select the leg's per-scheme config; absent a
        // scheme entry it falls back to the per-mastermind menu.
        approvedLoadoutsByScheme,
      )
    ) {
      continue;
    }

    const schemeSlug = replay.scenarioKey.split('::')[0] ?? '';
    clearedSchemeSlugs.add(schemeSlug);

    const currentLastPlayed = lastPlayedBySchemeSlug.get(schemeSlug);
    if (
      currentLastPlayed === undefined ||
      Date.parse(replay.createdAt) > Date.parse(currentLastPlayed)
    ) {
      lastPlayedBySchemeSlug.set(schemeSlug, replay.createdAt);
    }

    const currentBest = rosterAccumulator.bestScoreBySchemeSlug.get(schemeSlug);
    if (currentBest === undefined || replay.finalScore < currentBest) {
      rosterAccumulator.bestScoreBySchemeSlug.set(schemeSlug, replay.finalScore);
    }

    // why: D-24187 §1 — only wins carrying a team identity feed the fixed
    // (champion) division; a NULL team_key replay stays open-only.
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

  const legs: GauntletRunLegProgress[] = [];
  let everyLegCleared = inputs.legs.length > 0;
  for (const leg of inputs.legs) {
    const isCleared = clearedSchemeSlugs.has(leg.schemeSlug);
    if (!isCleared) {
      everyLegCleared = false;
    }
    const picksForLeg = run.legPicks[leg.schemeSlug];
    const pickCount = Array.isArray(picksForLeg) ? picksForLeg.length : 0;
    legs.push({
      schemeId: leg.schemeSlug,
      schemeName: leg.schemeName,
      cleared: isCleared,
      hasFullPicks: pickCount === inputs.heroCount,
      lastPlayedAt: lastPlayedBySchemeSlug.get(leg.schemeSlug) ?? null,
    });
  }

  const poolSet = new Set<string>();
  for (const heroDeckIds of Object.values(run.legPicks)) {
    if (Array.isArray(heroDeckIds)) {
      for (const heroDeckId of heroDeckIds) {
        poolSet.add(heroDeckId);
      }
    }
  }
  const pool = [...poolSet].sort();

  // why: budget is the injected poolBudget (heroPoolBudgets[playerCount] =
  // heroCount + 2, D-24187 §4). Reusing the SAME value findBestPoolAssignment
  // receives — rather than re-deriving heroCount + 2 here — guarantees the
  // view's budget and the champion search can never diverge.
  const budget = inputs.poolBudget;
  const budgetHeadroom = budget - pool.length;

  let isChampion = false;
  if (everyLegCleared) {
    const assignment = findBestPoolAssignment(
      rosterAccumulator,
      legSchemeSlugs,
      inputs.poolBudget,
      inputs.boardName,
      run.playerCount,
    );
    isChampion = assignment !== null;
  }

  const status = deriveGauntletRunStatus(legs, isChampion);

  return {
    ...run,
    status,
    pool,
    budgetHeadroom,
    heroCount: inputs.heroCount,
    budget,
    isChampion,
    legs,
    launch: deriveGauntletRunLaunch(run, inputs),
  };
}

/**
 * Fetch the caller-scoped qualifying `competitive_scores` rows for one run: the
 * winning replays at the run's mastermind, its set's leg schemes, and its
 * player count that the CALLER owns — fanned out to every owner of those
 * replays. Mirrors the `getGauntletStandings` query shape (the DISTINCT ON
 * replay-dedupe + owner fan-out) plus `created_at` and the caller-ownership
 * restriction.
 *
 * @param database the pg pool.
 * @param mastermindSlug the run's mastermind slug (scenario-key segment 2).
 * @param legs the gauntlet's leg schemes (scenario-key segment 1 ∈ these).
 * @param playerCount the run's player count.
 * @param callerPlayerId the caller's internal bigint player id.
 * @returns the (replay × owner) rows.
 */
async function queryCallerLegScores(
  database: DatabaseClient,
  mastermindSlug: string,
  legs: readonly GauntletLeg[],
  playerCount: number,
  callerPlayerId: number,
): Promise<CallerGauntletScoreRow[]> {
  const legSchemeSlugs: string[] = [];
  for (const leg of legs) {
    legSchemeSlugs.push(leg.schemeSlug);
  }
  // why: the candidate replays are narrowed to ones the CALLER owns at this
  // run's player_count (the `replay_hash IN (…caller ownership…)` clause +
  // `player_count = $3`), because a run's progression is private to its owner
  // (Vision §11) — account B's replays must never affect account A's view. But
  // the outer join then fans each candidate back out to ALL of its owners, not
  // just the caller: qualifiesAsLegClear's roster-size clause (owners ===
  // player_count) and its all-owners-visible clause can only be evaluated over
  // the FULL roster, so a co-op replay must carry every seat's ownership row
  // here or it would be wrongly disqualified. split_part positions: scenario_key
  // = "{schemeSlug}::{mastermindSlug}::{villains}" (WP-334 capture).
  const result = await database.query(
    'SELECT cs.replay_hash, cs.scenario_key, cs.final_score, ' +
      'cs.scoring_config_version, cs.player_count, cs.team_key, ' +
      'cs.henchman_key, cs.created_at, ro.player_id, p.display_name, ' +
      'ro.visibility ' +
      'FROM ( ' +
      'SELECT DISTINCT ON (replay_hash) replay_hash, scenario_key, ' +
      'final_score, scoring_config_version, player_count, team_key, ' +
      'henchman_key, created_at ' +
      'FROM legendary.competitive_scores ' +
      "WHERE outcome = 'heroes-win' " +
      '  AND player_count = $3 ' +
      "  AND split_part(scenario_key, '::', 2) = $1 " +
      "  AND split_part(scenario_key, '::', 1) = ANY($2) " +
      '  AND replay_hash IN ( ' +
      '    SELECT replay_hash FROM legendary.replay_ownership ' +
      '    WHERE player_id = $4 ' +
      '  ) ' +
      'ORDER BY replay_hash ' +
      ') cs ' +
      'INNER JOIN legendary.replay_ownership ro ' +
      '  ON ro.replay_hash = cs.replay_hash ' +
      'INNER JOIN legendary.players p ON ro.player_id = p.player_id',
    [mastermindSlug, legSchemeSlugs, playerCount, callerPlayerId],
  );
  return result.rows as CallerGauntletScoreRow[];
}

/**
 * List the caller's gauntlet runs, each with its DERIVED progression (WP-446).
 * Reuses `listGauntletRuns` for the caller's raw runs, resolves each run's
 * derivation inputs via the injected resolver, runs ONE caller-scoped
 * `competitive_scores` read per run, and derives. READ-ONLY — no write path.
 *
 * @param accountId the authenticated caller's account id.
 * @param database the pg pool.
 * @param resolveGauntletRunProgressInputs the injected per-run inputs resolver.
 * @param leaderboardDependencies the injected leaderboard dependency (its
 *   `checkParPublished` resolves the published scoring-config version).
 * @returns the caller's runs as derived progression views, or a rejected
 *   promise on a player-row race / catalog drift (mapped to 500 by the route).
 */
export async function listGauntletRunProgress(
  accountId: AccountId,
  database: DatabaseClient,
  resolveGauntletRunProgressInputs: GauntletRunProgressResolver,
  leaderboardDependencies: LeaderboardDependencies,
): Promise<GauntletRunResult<GauntletRunProgressView[]>> {
  const runsResult = await listGauntletRuns(accountId, database);
  if (runsResult.ok === false) {
    return runsResult;
  }

  const callerPlayerId = await loadPlayerIdByAccountId(accountId, database);
  if (callerPlayerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this progression read.',
      ),
    );
  }

  const views: GauntletRunProgressView[] = [];
  for (const run of runsResult.value) {
    const inputs = resolveGauntletRunProgressInputs(run);
    if (inputs === null) {
      // why: a stored run always named a real catalog gauntlet at import time
      // (WP-445's resolveGauntletExistence gated it) and the registry is static
      // at runtime, so a null here is run/catalog drift — an internal
      // inconsistency, not a client fault. Fail loud (→ 500) rather than emit a
      // silently mis-derived view.
      return Promise.reject(
        new Error(
          `No gauntlet catalog entry matches the stored run for set "${run.setAbbr}", mastermind "${run.mastermindSlug}", player count ${run.playerCount}; the run may reference a gauntlet the registry no longer offers.`,
        ),
      );
    }
    const qualifyingRows = await queryCallerLegScores(
      database,
      run.mastermindSlug,
      inputs.legs,
      run.playerCount,
      callerPlayerId,
    );
    views.push(
      deriveGauntletRunProgress(
        run,
        inputs,
        qualifyingRows,
        leaderboardDependencies.checkParPublished,
      ),
    );
  }
  return { ok: true, value: views };
}
