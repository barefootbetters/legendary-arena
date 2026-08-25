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
 * ratio; WP-599 / D-24409 rescaled it to true VP-units `bystanderLost 40 /
 * schemeTwistNegative 30 / villainEscaped 10`, with no separate bystander reward).
 * Matches the committed reference config so all seed scenarios share one
 * `scoringConfigVersion` and stay comparable. Satisfies every
 * `validateScoringConfig` structural invariant.
 */
// why: WP-585 / D-24394 — no roundCost. The rulebook's scoring has no round/turn
// penalty; Scheme Twists are its length proxy (schemeTwistNegative), so a separate
// per-round cost double-counted length and was removed.
// why: WP-599 / D-24409 (supersedes D-24408) — full rulebook fidelity. No
// bystanderReward: a rescued bystander scores only as its 1 VP (folded into VP). The
// penalty weights are the true rulebook VP-unit values on the ×10 scale (1 VP = 10):
// villainEscaped 10, schemeTwistNegative 30, bystanderLost 40 — the rulebook 4:3:1 and
// the community Total Score `VP − 4·lost − 3·twists − 1·escapes`. The LA-only penalties
// (mastermindTacticUntaken, scenarioSpecificPenalty) are inert today (no producer) and
// carry a minor in-scale value.
const DEFAULT_WEIGHTS = { victoryPointReward: 10 };
const DEFAULT_CAPS = { bystanderCap: null, victoryPointCap: null };
const DEFAULT_PENALTY_EVENT_WEIGHTS = {
  villainEscaped: 10,
  bystanderLost: 40,
  schemeTwistNegative: 30,
  mastermindTacticUntaken: 10,
  scenarioSpecificPenalty: 10,
};
// why: WP-585 / D-24394 — bumped on the roundCost removal. scoringConfigVersion
// 2->3 per the docs/12 calibration invariant (any weight/config change bumps it);
// rawScoreSemanticsVersion 1->2 because removing a whole term is a formula-SHAPE
// change (lets leaderboard entries be filtered to a semantically compatible set,
// so pre-WP-585 rows stay valid and are never retroactively invalidated).
// why: WP-591 / D-24400 — scoringConfigVersion 3->4 (any PAR/weight/baseline change
// bumps it) and rawScoreSemanticsVersion 2->3 (a formula-SHAPE change: PAR now models
// the twist + bystander-lost penalties, and RawScore gains the loss penalty). Existing
// competitive_scores rows keep their pinned versions — no retroactive invalidation.
// why: WP-599 / D-24409 — scoringConfigVersion 4->5 (weight change) and
// rawScoreSemanticsVersion 3->4 (a formula-SHAPE change: the bystander-reward term is
// removed and the penalty weights are rescaled). Existing rows keep their pinned
// versions — no retroactive invalidation.
const SCORING_CONFIG_VERSION = 5;
const RAW_SCORE_SEMANTICS_VERSION = 4;

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

export { composeScenarioDifficulty, baselineForScenario, enumerateScenarios, generate };

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
// why: WP-591 / D-24400 — bystander rescues are a SCHEME property, not a difficulty
// one (validated from 13 real-game diagnostics: Midtown 24-37 vs Cosmic Cube 3-4).
// The old flat difficulty->baseline template was scheme-BLIND, so it made Midtown
// trivially Legendary AND Cosmic Cube wins grade F. These per-scheme profiles are
// the observed competent-WIN medians at 1 and 2 players (structural estimates for the
// schemes with no game yet: Killbots = flood like Midtown; Portals/Legacy/NegZone =
// light). Twists are the scheme's own villain-deck twist count. INTERIM: simulation
// calibration (VISION §26 Phase-2) supersedes this once the competent AI is strong.
const SCHEME_PROFILES = {
  'midtown-bank-robbery':                        { 1: { bys: 14, vp: 46, esc: 1, tw: 6, bLost: 2 }, 2: { bys: 22, vp: 74, esc: 1, tw: 6, bLost: 2 } },
  'replace-earths-leaders-with-killbots':        { 1: { bys: 15, vp: 45, esc: 1, tw: 5, bLost: 2 }, 2: { bys: 24, vp: 72, esc: 1, tw: 5, bLost: 2 } },
  'secret-invasion-of-the-skrull-shapeshifters': { 1: { bys: 9,  vp: 40, esc: 3, tw: 5, bLost: 0 }, 2: { bys: 15, vp: 62, esc: 5, tw: 5, bLost: 0 } },
  'portals-to-the-dark-dimension':               { 1: { bys: 5,  vp: 34, esc: 1, tw: 7, bLost: 0 }, 2: { bys: 8,  vp: 55, esc: 2, tw: 7, bLost: 0 } },
  'super-hero-civil-war':                        { 1: { bys: 4,  vp: 35, esc: 0, tw: 3, bLost: 0 }, 2: { bys: 6,  vp: 39, esc: 1, tw: 4, bLost: 0 } },
  'unleash-the-power-of-the-cosmic-cube':        { 1: { bys: 4,  vp: 41, esc: 0, tw: 5, bLost: 0 }, 2: { bys: 7,  vp: 50, esc: 0, tw: 7, bLost: 0 } },
  'legacy-virus-the':                            { 1: { bys: 4,  vp: 33, esc: 1, tw: 5, bLost: 0 }, 2: { bys: 6,  vp: 52, esc: 2, tw: 5, bLost: 0 } },
  'negative-zone-prison-breakout':               { 1: { bys: 4,  vp: 33, esc: 2, tw: 5, bLost: 0 }, 2: { bys: 6,  vp: 52, esc: 3, tw: 5, bLost: 0 } },
};
// why: a light default for any scheme not yet profiled (keeps the generator total).
const DEFAULT_SCHEME_PROFILE = { 1: { bys: 5, vp: 35, esc: 1, tw: 5, bLost: 0 }, 2: { bys: 8, vp: 52, esc: 2, tw: 5, bLost: 0 } };
// why: 3p/4p/5p have no observed games; extrapolate reward totals from the 2p anchor.
const HIGH_PLAYER_FACTOR = { 3: 1.28, 4: 1.5, 5: 1.7 };

/**
 * Scheme-aware, physical ParBaseline for a scenario (WP-591 / D-24400).
 *
 * The scheme sets the bystander + twist expectations; player count scales the
 * reward totals; difficulty mildly modulates VP + escapes (a harder scenario earns
 * a slightly more lenient PAR so it stays fairly gradable). All fields are
 * non-negative integers.
 *
 * @param schemeSlug the scheme's slug (e.g. 'midtown-bank-robbery').
 * @param scenarioDifficulty the composed 1-10 scenario difficulty.
 * @param playerCount the representative player count (1-5).
 * @returns the physical ParBaseline (bystanders / VP / escapes / twists / bystandersLost).
 */
function baselineForScenario(schemeSlug, scenarioDifficulty, playerCount) {
  const profile = SCHEME_PROFILES[schemeSlug] ?? DEFAULT_SCHEME_PROFILE;
  const anchor = profile[playerCount] ?? profile[2];
  const factor = playerCount >= 3 ? (HIGH_PLAYER_FACTOR[playerCount] ?? 1.5) : 1;
  // why: mild difficulty modulation centered at difficulty 5 (the anchor games'
  // rough level) so harder scenarios expect slightly fewer rewards + more escapes —
  // keeping a hard scenario fairly gradable rather than punishing its difficulty.
  const difficultyDelta = scenarioDifficulty - 5;
  const rewardDifficultyScale = Math.max(0.7, 1 - difficultyDelta * 0.03);
  return {
    bystandersPar: Math.max(0, Math.round(anchor.bys * factor * rewardDifficultyScale)),
    victoryPointsPar: Math.max(0, Math.round(anchor.vp * factor * rewardDifficultyScale)),
    escapesPar: Math.max(0, Math.round(anchor.esc * factor) + Math.max(0, difficultyDelta > 0 ? Math.floor(difficultyDelta / 3) : 0) + Math.max(0, playerCount - 3)),
    schemeTwistsPar: anchor.tw,
    bystandersLostPar: Math.max(0, Math.round(anchor.bLost * (playerCount >= 2 ? 1 : 0.5))),
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
  // why: WP-591 — the scheme slug (e.g. 'midtown-bank-robbery') keys the per-scheme
  // profile; scenario.schemeExtId is set-qualified ('core/midtown-bank-robbery').
  const schemeSlug = stripSetAbbreviation(scenario.schemeExtId);
  const parBaseline = baselineForScenario(schemeSlug, scenarioDifficulty, scenario.playerCount);
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
