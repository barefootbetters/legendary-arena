/**
 * generate-seed-par.mjs — the WP-422 / EC-457 / D-24242 Phase-1 Seed PAR
 * generator (Shared Tooling; authoring-time only).
 *
 * Turns the competitive surface on. Reads the authored difficulty ratings
 * (`data/difficulty-ratings/<entityDifficultyVersion>.json`) and the gauntlet
 * season configs (`data/gauntlet-configs.json`), enumerates every competitive
 * scenario key the active season produces, composes a per-scenario difficulty,
 * maps it to a `ParBaseline`, computes the `parValue` via the engine's
 * `computeParScore`, and writes a write-once seed PAR artifact + its scoring
 * config per scenario, then builds the `data/par/seed/<version>/index.json` the
 * server gate reads. Committed to the repo (the `loadParIndex` / `loadRegistry`
 * local-fs delivery model, D-5001) — no runtime engine/server code change.
 *
 * why committed-to-repo delivery: the server reads `data/par/seed/v1/index.json`
 * from disk via `loadParIndex`, exactly like `loadRegistry('data/cards')`.
 * Delivering the index is a committed-data problem, not new infra.
 *
 * why write-once + new-version-to-republish: PAR artifacts are immutable
 * precedent, not state (docs/12.1). `writeSeedParArtifact` refuses to overwrite;
 * re-publishing a revised seed targets a new `--version` directory. A ratings
 * revision is a new `entityDifficultyVersion` (seed-difficulty-v2), never an
 * in-place edit.
 *
 * why a raw-score-scale PAR (D-24242): the seed `parValue` is
 * `computeParScore(baseline)` on the real Raw Score scale — the same scale
 * simulation (Phase 2) produces and live `finalScore = rawScore - PAR` uses. The
 * `docs/12 §Phase 1` scalar (`12000 + M*1200 + ...`) is a legacy difficulty
 * INDEX on a different scale (its own calibration example shows a `26800` seed
 * resolving to a `-1200` simulated PAR) and is NOT the literal parValue; the
 * difficulty -> baseline template below is the operative mapping.
 *
 * Layer: Shared Tooling. Imports the engine (Runtime-Safe surface + the
 * Setup-Tooling `/setup` surface, per D-14401) and the registry at authoring
 * time; never on the runtime path. Run: `node scripts/generate-seed-par.mjs
 * [--version v1]`.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

import { computeParScore, buildScenarioKey } from "@legendary-arena/game-engine";
import {
  writeSeedParArtifact,
  buildParIndex,
  scenarioKeyToFilename,
} from "@legendary-arena/game-engine/setup";
import { validateDifficultyRatings } from "@legendary-arena/registry/difficultyRatings.schema";
import { validateGauntletConfigs } from "@legendary-arena/registry/gauntletConfigs";

// ---------------------------------------------------------------------------
// Locked values (D-24242) — do not re-derive
// ---------------------------------------------------------------------------

/**
 * The one global default scoring config (v1) applied to every seed scenario —
 * the adopted reference weights (D-24342 / WP-531: the rulebook 4:3:1 penalty
 * ratio, `bystanderLost 400 / schemeTwistNegative 300 / villainEscaped 100`).
 * Matches the committed reference config so all seed scenarios share one
 * `scoringConfigVersion` and stay comparable. Satisfies every
 * `validateScoringConfig` structural invariant.
 */
// why: WP-585 / D-24394 — no roundCost. The rulebook's scoring has no round/turn
// penalty; Scheme Twists are its length proxy (schemeTwistNegative 300), so a
// separate per-round cost double-counted length and was removed.
const DEFAULT_WEIGHTS = { bystanderReward: 200, victoryPointReward: 10 };
const DEFAULT_CAPS = { bystanderCap: null, victoryPointCap: null };
const DEFAULT_PENALTY_EVENT_WEIGHTS = {
  villainEscaped: 100,
  bystanderLost: 400,
  schemeTwistNegative: 300,
  mastermindTacticUntaken: 25,
  scenarioSpecificPenalty: 40,
};
// why: WP-585 / D-24394 — bumped on the roundCost removal. scoringConfigVersion
// 2->3 per the docs/12 calibration invariant (any weight/config change bumps it);
// rawScoreSemanticsVersion 1->2 because removing a whole term is a formula-SHAPE
// change (lets leaderboard entries be filtered to a semantically compatible set,
// so pre-WP-585 rows stay valid and are never retroactively invalidated).
const SCORING_CONFIG_VERSION = 3;
const RAW_SCORE_SEMANTICS_VERSION = 2;

// why: class-2 metadata timestamps must be FIXED, never Date.now(), so the
// generator is deterministic — re-running produces byte-identical artifacts
// (they are part of the hashed artifact body). Stamped as the authoring date.
const FIXED_TIMESTAMP = "2026-08-19T00:00:00.000Z";
const AUTHORED_BY = "wp-422-seed-par-generator";

/**
 * Villain-group count -> representative player count. The `ScenarioKey` carries
 * no player count, and the villain-slice count is its proxy (1p=1, 2p=2, 3p/4p=3,
 * 5p=4 villains per the gauntlet slicing). 3-villain keys serve both 3p and 4p —
 * the key format cannot distinguish them — so the lower count (3p) is the
 * representative; a documented seed approximation.
 */
const VILLAIN_COUNT_TO_PLAYER_COUNT = { 1: 1, 2: 2, 3: 3, 4: 5 };

const PAR_BASE_PATH = "data/par";
const SCORING_CONFIG_DIR = "data/scoring-configs";
const RATINGS_DIR = "data/difficulty-ratings";
const GAUNTLET_CONFIGS_PATH = "data/gauntlet-configs.json";

// ---------------------------------------------------------------------------
// Pure helpers (documented mapping — the primary design task, D-24242)
// ---------------------------------------------------------------------------

/**
 * Clamps a value to the inclusive `[low, high]` range.
 */
function clampRange(low, high, value) {
  return Math.max(low, Math.min(high, value));
}

/**
 * Strips a set-abbreviation prefix (`setAbbr/slug`) to the bare slug the
 * `ScenarioKey` uses. A bare slug (no `/`) passes through unchanged.
 */
function stripSetAbbreviation(id) {
  return id.slice(id.indexOf("/") + 1);
}

export { composeScenarioDifficulty, baselineFromDifficulty, enumerateScenarios, generate };

/**
 * Composes a scenario difficulty (1-10) from its entity ratings:
 * `clamp(1, 10, round(0.40*mastermind + 0.40*scheme + 0.20*avg(villains)))`.
 * `synergyAdjustment` is 0 for the v1 seed (no authored per-scenario synergy
 * overrides yet — an entity rating is never a scenario rating).
 *
 * @param mastermindRating the mastermind's 1-10 difficulty.
 * @param schemeRating the scheme's 1-10 difficulty.
 * @param villainGroupRatings the sliced villain groups' 1-10 difficulties.
 * @returns the composed scenario difficulty (integer 1-10).
 */
function composeScenarioDifficulty(mastermindRating, schemeRating, villainGroupRatings) {
  let villainSum = 0;
  for (const rating of villainGroupRatings) {
    villainSum = villainSum + rating;
  }
  const villainAverage = villainSum / villainGroupRatings.length;
  const base = 0.4 * mastermindRating + 0.4 * schemeRating + 0.2 * villainAverage;
  return clampRange(1, 10, Math.round(base));
}

/**
 * Maps a scenario difficulty + representative player count to a `ParBaseline`
 * (the documented difficulty -> baseline template, D-24242). Monotonic in
 * difficulty — a harder scenario expects more rounds, more escapes, fewer
 * rescues, and less VP surplus, so its `computeParScore` (the expected competent
 * Raw Score) is higher. All four fields are non-negative integers.
 *
 * @param scenarioDifficulty the composed 1-10 scenario difficulty.
 * @param playerCount the representative player count (1-5).
 * @returns the `ParBaseline` (bystandersPar / victoryPointsPar / escapesPar).
 */
function baselineFromDifficulty(scenarioDifficulty, playerCount) {
  // why: WP-585 / D-24394 — no roundsPar. RawScore has no round-cost term, so PAR
  // needs no expected-rounds baseline.
  return {
    escapesPar: Math.floor(scenarioDifficulty / 4) + Math.max(0, playerCount - 3),
    bystandersPar: clampRange(2, 8, 8 - Math.ceil(scenarioDifficulty / 2)),
    victoryPointsPar: clampRange(8, 50, 30 - scenarioDifficulty + (playerCount - 2) * 3),
  };
}

/**
 * Serializes a value as canonical JSON: recursively sorted object keys, no
 * whitespace. Matches the on-disk scoring-config format so a re-run is
 * byte-identical (determinism contract).
 */
function canonicalJsonStringify(value) {
  return JSON.stringify(sortKeysRecursive(value));
}

/**
 * Returns a copy of a value with every nested object's keys sorted.
 */
function sortKeysRecursive(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursive);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysRecursive(value[key]);
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Enumeration + generation
// ---------------------------------------------------------------------------

/**
 * Looks up a required entity rating by set-qualified ext_id, throwing a
 * full-sentence error naming the missing entity so an unrated competitive item
 * is a loud failure, never a silent default.
 *
 * @param ratingMap the ratings map (masterminds / schemes / villainGroups).
 * @param extId the set-qualified ext_id key.
 * @param entityKind a human label for the error ("mastermind" / "scheme" / "villain group").
 * @returns the entity's 1-10 difficulty rating.
 */
function requireRating(ratingMap, extId, entityKind) {
  const entry = ratingMap[extId];
  if (entry === undefined) {
    throw new Error(
      `Seed PAR generation cannot proceed: no difficulty rating for ${entityKind} "${extId}". ` +
        `Add it to data/difficulty-ratings/<version>.json (every competitive item in the season ` +
        `must carry an authored rating).`,
    );
  }
  return entry.difficultyRating;
}

/**
 * Enumerates every distinct competitive scenario the active gauntlet season
 * produces: for each (set, mastermind, scheme) leg, the villain-slice for each
 * supported player count yields a `ScenarioKey`. Player counts whose slice size
 * collapses (3p and 4p both slice 3 villains) produce one key; the representative
 * player count is taken from the villain count.
 *
 * @param gauntletConfigs the validated gauntlet-configs file.
 * @returns an array of `{ scenarioKey, mastermindExtId, schemeExtId, villainExtIds, playerCount }`.
 */
function enumerateScenarios(gauntletConfigs) {
  const slicing = gauntletConfigs.slicing.villainGroupCountByPlayerCount;
  const yearBlock = gauntletConfigs.years[gauntletConfigs.activeYear];
  const scenarios = [];
  const seenKeys = new Set();
  for (const [setAbbr, setConfig] of Object.entries(yearBlock.sets)) {
    for (const [mastermindSlug, mastermindConfig] of Object.entries(setConfig.masterminds)) {
      for (const [schemeSlug, leg] of Object.entries(mastermindConfig.schemes)) {
        for (const playerCountKey of Object.keys(slicing)) {
          const villainCount = slicing[playerCountKey];
          const villainExtIds = leg.villainPool.slice(0, villainCount);
          const scenarioKey = buildScenarioKey(
            schemeSlug,
            mastermindSlug,
            villainExtIds.map(stripSetAbbreviation),
          );
          if (seenKeys.has(scenarioKey)) {
            continue;
          }
          seenKeys.add(scenarioKey);
          scenarios.push({
            scenarioKey,
            mastermindExtId: `${setAbbr}/${mastermindSlug}`,
            schemeExtId: `${setAbbr}/${schemeSlug}`,
            villainExtIds,
            playerCount: VILLAIN_COUNT_TO_PLAYER_COUNT[villainCount],
          });
        }
      }
    }
  }
  scenarios.sort((left, right) => (left.scenarioKey < right.scenarioKey ? -1 : 1));
  return scenarios;
}

/**
 * Builds the full `ScenarioScoringConfig` for one scenario: the global default
 * weights/caps/penalties plus the difficulty-mapped `ParBaseline`.
 */
function buildScoringConfig(scenario, ratings) {
  const mastermindRating = requireRating(ratings.masterminds, scenario.mastermindExtId, "mastermind");
  const schemeRating = requireRating(ratings.schemes, scenario.schemeExtId, "scheme");
  const villainRatings = scenario.villainExtIds.map((extId) =>
    requireRating(ratings.villainGroups, extId, "villain group"),
  );
  const scenarioDifficulty = composeScenarioDifficulty(mastermindRating, schemeRating, villainRatings);
  const parBaseline = baselineFromDifficulty(scenarioDifficulty, scenario.playerCount);
  return {
    scenarioKey: scenario.scenarioKey,
    weights: DEFAULT_WEIGHTS,
    caps: DEFAULT_CAPS,
    penaltyEventWeights: DEFAULT_PENALTY_EVENT_WEIGHTS,
    parBaseline,
    scoringConfigVersion: SCORING_CONFIG_VERSION,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

/**
 * Generates every seed PAR artifact + scoring config for the active season and
 * builds the seed index. Returns the scenario count.
 *
 * @param parVersion the artifact version directory (for example "v1").
 * @param options optional output-path overrides (for deterministic tests into a
 *   temp dir); defaults to the committed `data/par` + `data/scoring-configs`.
 * @returns the number of scenarios published.
 */
async function generate(parVersion, options = {}) {
  const parBasePath = options.parBasePath ?? PAR_BASE_PATH;
  const scoringConfigDir = options.scoringConfigDir ?? SCORING_CONFIG_DIR;
  const ratings = validateDifficultyRatings(
    JSON.parse(await readFile(posix.join(RATINGS_DIR, "seed-difficulty-v1.json"), "utf8")),
  );
  const gauntletConfigs = validateGauntletConfigs(
    JSON.parse(await readFile(GAUNTLET_CONFIGS_PATH, "utf8")),
  );
  const scenarios = enumerateScenarios(gauntletConfigs);

  await mkdir(scoringConfigDir, { recursive: true });

  for (const scenario of scenarios) {
    const scoringConfig = buildScoringConfig(scenario, ratings);
    const parValue = computeParScore(scoringConfig);
    const artifact = {
      scenarioKey: scenario.scenarioKey,
      source: "seed",
      calibrationStatus: "uncalibrated",
      difficultyRatingVersion: ratings.entityDifficultyVersion,
      parBaseline: scoringConfig.parBaseline,
      parValue,
      scoring: {
        scoringConfigVersion: SCORING_CONFIG_VERSION,
        rawScoreSemanticsVersion: RAW_SCORE_SEMANTICS_VERSION,
      },
      authoredAt: FIXED_TIMESTAMP,
      authoredBy: AUTHORED_BY,
      rationale:
        `Phase-1 content seed (${ratings.entityDifficultyVersion}); PAR = computeParScore of a ` +
        `difficulty-mapped baseline on the Raw Score scale. Superseded by simulation when calibrated.`,
      // why: writeSeedParArtifact always recomputes the hash; this placeholder is ignored.
      artifactHash: "",
    };
    // why: writeSeedParArtifact enforces parValue === computeParScore(config-with-baseline),
    // refuses to overwrite (write-once), and recomputes the SHA-256 artifactHash itself.
    await writeSeedParArtifact(artifact, scoringConfig, parBasePath, parVersion);

    const configFilename = scenarioKeyToFilename(scenario.scenarioKey);
    await writeFile(
      posix.join(scoringConfigDir, configFilename),
      canonicalJsonStringify(scoringConfig),
      "utf8",
    );
  }

  const index = await buildParIndex(parBasePath, "seed", parVersion);

  // why: buildParIndex stamps generatedAt with new Date() (the index is not an
  // immutable artifact, so the engine leaves it live). For a COMMITTED seed index
  // that must diff clean on re-run, pin generatedAt to the fixed authoring
  // timestamp and rewrite with the same sorted-key canonical form the engine
  // uses — the only non-deterministic field, and metadata the runtime gate never
  // reads. Keeps the engine untouched (WP-422: no runtime engine change).
  const indexPath = posix.join(parBasePath, "seed", parVersion, "index.json");
  const pinnedIndex = { ...index, generatedAt: FIXED_TIMESTAMP };
  await writeFile(indexPath, canonicalJsonStringify(pinnedIndex), "utf8");

  return index.scenarioCount;
}

/**
 * Parses `--version <v>` from argv, defaulting to "v1".
 */
function parseVersionArg(argv) {
  const flagIndex = argv.indexOf("--version");
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) {
    return argv[flagIndex + 1];
  }
  return "v1";
}

async function main() {
  const parVersion = parseVersionArg(process.argv.slice(2));
  try {
    const scenarioCount = await generate(parVersion);
    console.log(
      `Seed PAR generated: ${scenarioCount} scenarios written to ${PAR_BASE_PATH}/seed/${parVersion} ` +
        `(+ scoring configs in ${SCORING_CONFIG_DIR}). Re-run is byte-identical.`,
    );
  } catch (error) {
    console.error(`Seed PAR generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

// why: run only when executed directly (node scripts/generate-seed-par.mjs), not
// when imported by the determinism test — importing must not trigger a real write.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
