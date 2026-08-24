/**
 * generate-par-profiles.mjs — WP-597 / EC-632 / D-24406 PAR profile sweep
 * (Shared Tooling; authoring-time only).
 *
 * Runs the WP-596 turn-distribution profile pipeline across every active-season
 * gauntlet scenario, persists each profile under data/par/profile/<version>/, and
 * emits a committed ranked FIDELITY REPORT (fidelity-report.json + .md) sorting
 * scenarios by a "too-easy" signal (monotoneImproving + high winRate + low
 * minWinningTurn) — the prioritization list for the ability-coverage work.
 *
 * DIAGNOSTIC ONLY. The engine is under-built (see the PAR calibration wiki), so
 * these profiles measure "a different, easier game" than the printed rules. They
 * are derived, non-authoritative records — never published as competitive PAR,
 * never read by the server gate.
 *
 * Layer: Shared Tooling. Imports the engine (`.` + `/setup`) and the registry at
 * authoring time; never on the runtime path. Determinism: fixed timestamp +
 * canonical sorted-key JSON, and the games are seeded via the WP-049 baseSeed, so
 * a re-run is byte-identical. No Math.random().
 *
 * Run: node scripts/generate-par-profiles.mjs [--version v1] [--sample 200] [--limit N]
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

import { createRegistryFromLocalFiles } from "@legendary-arena/registry";
import {
  validateGauntletConfigs,
  getGauntletConfig,
} from "@legendary-arena/registry/gauntletConfigs";
import {
  resolveEffectiveHeroCount,
  getPlayerCountSetup,
} from "@legendary-arena/registry/playerCountSetup";
import {
  generateScenarioParSamples,
  aggregateTurnDistributionProfile,
  PAR_PERCENTILE_DEFAULT,
} from "@legendary-arena/game-engine";
import {
  writeParProfileArtifact,
  loadScoringConfigForScenario,
} from "@legendary-arena/game-engine/setup";

import { enumerateScenarios } from "./generate-seed-par.mjs";

// ---------------------------------------------------------------------------
// Locked values (D-24406) — do not re-derive
// ---------------------------------------------------------------------------

// why: a FIXED, documented diagnostic hero loadout so the profile isolates the
// mastermind/scheme/villain difficulty from the hero choice. Six core heroes —
// enough for the Secret Invasion 6-hero override; a scheme needing more is
// recorded as a skip, not a crash.
const HERO_POOL = [
  "core/spider-man",
  "core/hulk",
  "core/wolverine",
  "core/black-widow",
  "core/cyclops",
  "core/iron-man",
];

const SIMULATION_POLICY_VERSION = "CompetentHeuristic/v1";
const BASE_SEED_PREFIX = "par-profile";
const SUPPLY_COUNTS = {
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
};

// why: class-2 metadata timestamp must be FIXED, never Date.now(), so the report
// is deterministic — a re-run produces a byte-identical file.
const FIXED_TIMESTAMP = "2026-08-23T00:00:00.000Z";

const PROFILE_BASE_PATH = "data/par";
const PROFILE_REPORT_DIR = "data/par/profile";
const GAUNTLET_CONFIGS_PATH = "data/gauntlet-configs.json";
const SCORING_CONFIG_DIR = "data/scoring-configs";
const METADATA_DIR = "data/metadata";
const CARDS_DIR = "data/cards";

// ---------------------------------------------------------------------------
// Pure helpers (exported for the unit test)
// ---------------------------------------------------------------------------

export {
  splitExtId,
  sliceHeroDeck,
  assembleParSimulationConfig,
  compareTooEasy,
  rankRows,
  buildReportRow,
  renderReportMarkdown,
  canonicalJsonStringify,
};

/**
 * Splits a set-qualified ext_id (`core/magneto`) into its set abbreviation and
 * bare slug (`{ setAbbr: "core", slug: "magneto" }`). A bare id (no slash) yields
 * an empty setAbbr and the whole string as the slug.
 */
function splitExtId(extId) {
  const slashIndex = extId.indexOf("/");
  if (slashIndex === -1) {
    return { setAbbr: "", slug: extId };
  }
  return { setAbbr: extId.slice(0, slashIndex), slug: extId.slice(slashIndex + 1) };
}

/**
 * Slices the fixed hero pool to the effective hero count. Throws when the count
 * exceeds the pool — the caller catches it and records the scenario as skipped.
 */
function sliceHeroDeck(heroCount) {
  if (heroCount > HERO_POOL.length) {
    throw new Error(
      `Scenario needs ${heroCount} heroes but the fixed diagnostic pool has only ${HERO_POOL.length}; ` +
        `widen HERO_POOL before sweeping schemes with a larger hero requirement.`,
    );
  }
  return HERO_POOL.slice(0, heroCount);
}

/**
 * Assembles the full 10-field ParSimulationConfig from already-resolved inputs.
 * Pure — the caller resolves henchmen (getGauntletConfig) and heroDeckIds
 * (resolveEffectiveHeroCount + sliceHeroDeck) before calling this.
 */
function assembleParSimulationConfig(inputs) {
  const { scenario, henchmanGroupIds, heroDeckIds, scoringConfig, sample } = inputs;
  return {
    scenarioKey: scenario.scenarioKey,
    setupConfig: {
      schemeId: scenario.schemeExtId,
      mastermindId: scenario.mastermindExtId,
      villainGroupIds: scenario.villainExtIds,
      henchmanGroupIds,
      heroDeckIds,
      bystandersCount: SUPPLY_COUNTS.bystandersCount,
      woundsCount: SUPPLY_COUNTS.woundsCount,
      officersCount: SUPPLY_COUNTS.officersCount,
      sidekicksCount: SUPPLY_COUNTS.sidekicksCount,
    },
    playerCount: scenario.playerCount,
    simulationCount: sample,
    baseSeed: `${BASE_SEED_PREFIX}-${scenario.scenarioKey}`,
    percentile: PAR_PERCENTILE_DEFAULT,
    scoringConfig,
    simulationPolicyVersion: SIMULATION_POLICY_VERSION,
    scoringConfigVersion: scoringConfig.scoringConfigVersion,
  };
}

/**
 * Builds a fidelity-report row from a scenario's profile. Overall winRate is
 * resolved games only (wins / (wins + losses)); 0 when no game resolved.
 */
function buildReportRow(profile) {
  const resolved = profile.winCount + profile.lossCount;
  const winRate = resolved === 0 ? 0 : Math.round((profile.winCount / resolved) * 100) / 100;
  const lossRate = resolved === 0 ? 0 : Math.round((profile.lossCount / resolved) * 100) / 100;
  return {
    scenarioKey: profile.scenarioKey,
    sampleSize: profile.sampleSize,
    winRate,
    lossRate,
    minWinningTurn: profile.minWinningTurn,
    monotoneImproving: profile.monotoneImproving,
    stuckAtCapCount: profile.stuckAtCapCount,
    binCount: profile.bins.length,
  };
}

/**
 * The locked too-easy comparator (most-too-easy first): monotoneImproving true
 * before false; then higher winRate; then lower minWinningTurn (null sorts last);
 * then scenarioKey ascending (stable tie-break).
 */
function compareTooEasy(left, right) {
  if (left.monotoneImproving !== right.monotoneImproving) {
    return left.monotoneImproving ? -1 : 1;
  }
  if (left.winRate !== right.winRate) {
    return right.winRate - left.winRate;
  }
  const leftTurn = left.minWinningTurn === null ? Number.POSITIVE_INFINITY : left.minWinningTurn;
  const rightTurn = right.minWinningTurn === null ? Number.POSITIVE_INFINITY : right.minWinningTurn;
  if (leftTurn !== rightTurn) {
    return leftTurn - rightTurn;
  }
  return left.scenarioKey < right.scenarioKey ? -1 : 1;
}

/**
 * Sorts report rows most-too-easy first and assigns a 1-based tooEasyRank
 * (rank 1 = most too-easy). Returns a new array; the input is not mutated.
 */
function rankRows(rows) {
  const sorted = [...rows].sort(compareTooEasy);
  const ranked = [];
  for (let index = 0; index < sorted.length; index++) {
    ranked.push({ ...sorted[index], tooEasyRank: index + 1 });
  }
  return ranked;
}

/**
 * Recursively sorts object keys for canonical JSON (byte-identical re-runs).
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

/**
 * Serializes a value as canonical JSON: recursively sorted keys, 2-space indent
 * for human-readable committed diffs.
 */
function canonicalJsonStringify(value) {
  return JSON.stringify(sortKeysRecursive(value), null, 2);
}

/**
 * Renders the fidelity report as a human-readable markdown table (most-too-easy
 * first), plus the skipped list.
 */
function renderReportMarkdown(report) {
  const lines = [];
  lines.push("# PAR Fidelity Report — too-easy scenario ranking");
  lines.push("");
  lines.push(
    `Generated by \`scripts/generate-par-profiles.mjs\` (WP-597). Sample = ${report.sample} games/scenario. ` +
      `DIAGNOSTIC ONLY — a fidelity signal for which scenarios the current (under-built) engine makes too easy, ` +
      `NOT a competitive PAR baseline.`,
  );
  lines.push("");
  lines.push("A scenario ranks *more too-easy* when its score improves monotonically with turns (`monotone`), " +
    "its win rate is near 100%, and wins are available early (low `minWin`). Rank 1 = most too-easy.");
  lines.push("");
  lines.push("| Rank | Scenario | Win% | Monotone | Min win turn | Stuck | Bins |");
  lines.push("|---:|---|---:|:---:|---:|---:|---:|");
  for (const row of report.scenarios) {
    const winPct = Math.round(row.winRate * 100);
    const minWin = row.minWinningTurn === null ? "—" : String(row.minWinningTurn);
    const monotone = row.monotoneImproving ? "yes" : "no";
    lines.push(
      `| ${row.tooEasyRank} | \`${row.scenarioKey}\` | ${winPct}% | ${monotone} | ${minWin} | ${row.stuckAtCapCount} | ${row.binCount} |`,
    );
  }
  lines.push("");
  if (report.skipped.length > 0) {
    lines.push(`## Skipped (${report.skipped.length})`);
    lines.push("");
    for (const skip of report.skipped) {
      lines.push(`- \`${skip.scenarioKey}\` — ${skip.reason}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sweep (impure — registry + engine + IO)
// ---------------------------------------------------------------------------

/**
 * Resolves the henchman groups and hero deck for a scenario via the real
 * registry APIs. Throws (caught by the caller as a skip) when the gauntlet leg is
 * missing or the scheme needs more heroes than the fixed pool holds.
 */
function resolveComposition(scenario) {
  const mastermind = splitExtId(scenario.mastermindExtId);
  const scheme = splitExtId(scenario.schemeExtId);
  const composition = getGauntletConfig(
    mastermind.setAbbr,
    mastermind.slug,
    scheme.slug,
    scenario.playerCount,
  );
  if (composition === undefined) {
    throw new Error(
      `getGauntletConfig returned undefined for ${scenario.mastermindExtId} / ${scenario.schemeExtId} ` +
        `at ${scenario.playerCount}p — no matching gauntlet leg or player-count setup row.`,
    );
  }
  const setupRow = getPlayerCountSetup(scenario.playerCount);
  if (setupRow === undefined) {
    throw new Error(`getPlayerCountSetup returned undefined for ${scenario.playerCount}p.`);
  }
  const heroCount = resolveEffectiveHeroCount(
    scenario.schemeExtId,
    scenario.playerCount,
    setupRow.heroCount,
  );
  return {
    henchmanGroupIds: composition.henchmanGroupIds,
    heroDeckIds: sliceHeroDeck(heroCount),
  };
}

/**
 * Runs one scenario end to end: load its scoring config, resolve composition,
 * assemble the ParSimulationConfig, run the WP-596 sample pipeline, aggregate the
 * profile, and persist it. Returns the profile.
 */
async function runScenario(scenario, registry, sample, version) {
  const scoringConfig = await loadScoringConfigForScenario(scenario.scenarioKey, SCORING_CONFIG_DIR);
  const { henchmanGroupIds, heroDeckIds } = resolveComposition(scenario);
  const config = assembleParSimulationConfig({
    scenario,
    henchmanGroupIds,
    heroDeckIds,
    scoringConfig,
    sample,
  });
  const samples = generateScenarioParSamples(config, registry);
  const profile = aggregateTurnDistributionProfile(
    scenario.scenarioKey,
    samples,
    SIMULATION_POLICY_VERSION,
    scoringConfig.scoringConfigVersion,
  );
  await writeParProfileArtifact(profile, PROFILE_BASE_PATH, version);
  return profile;
}

/**
 * Parses a numeric CLI flag, returning the fallback when absent.
 */
function parseNumberArg(argv, flag, fallback) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) {
    return Number(argv[flagIndex + 1]);
  }
  return fallback;
}

/**
 * Parses a string CLI flag, returning the fallback when absent.
 */
function parseStringArg(argv, flag, fallback) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) {
    return argv[flagIndex + 1];
  }
  return fallback;
}

/**
 * Runs the full sweep: enumerate → per-scenario profile → ranked report.
 */
async function main() {
  const argv = process.argv.slice(2);
  const version = parseStringArg(argv, "--version", "v1");
  const sample = parseNumberArg(argv, "--sample", 200);
  const limit = parseNumberArg(argv, "--limit", Number.POSITIVE_INFINITY);

  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIR,
    cardsDir: CARDS_DIR,
  });
  const gauntletConfigs = validateGauntletConfigs(
    JSON.parse(await readFile(GAUNTLET_CONFIGS_PATH, "utf8")),
  );
  const scenarios = enumerateScenarios(gauntletConfigs);
  const selected = scenarios.slice(0, Math.min(limit, scenarios.length));

  console.log(
    `PAR profile sweep: ${selected.length} scenario(s), ${sample} games each (version ${version}).`,
  );

  const rows = [];
  const skipped = [];
  for (let index = 0; index < selected.length; index++) {
    const scenario = selected[index];
    try {
      const profile = await runScenario(scenario, registry, sample, version);
      rows.push(buildReportRow(profile));
      console.log(
        `  [${index + 1}/${selected.length}] ${scenario.scenarioKey}: ` +
          `win ${profile.winCount}/${profile.sampleSize}, loss ${profile.lossCount}, ` +
          `stuck ${profile.stuckAtCapCount}, minWin ${profile.minWinningTurn ?? "—"}, ` +
          `monotone ${profile.monotoneImproving}`,
      );
    } catch (scenarioError) {
      const reason = scenarioError instanceof Error ? scenarioError.message : String(scenarioError);
      skipped.push({ scenarioKey: scenario.scenarioKey, reason });
      console.warn(`  [${index + 1}/${selected.length}] SKIP ${scenario.scenarioKey}: ${reason}`);
    }
  }

  const report = {
    generatedAt: FIXED_TIMESTAMP,
    sample,
    version,
    scenarioCount: rows.length,
    skippedCount: skipped.length,
    scenarios: rankRows(rows),
    skipped,
  };

  const reportDir = posix.join(PROFILE_REPORT_DIR, version);
  await mkdir(reportDir, { recursive: true });
  await writeFile(posix.join(reportDir, "fidelity-report.json"), canonicalJsonStringify(report), "utf8");
  await writeFile(posix.join(reportDir, "fidelity-report.md"), renderReportMarkdown(report), "utf8");

  console.log(
    `Wrote ${rows.length} profile(s) + fidelity-report.{json,md} to ${reportDir} ` +
      `(${skipped.length} skipped).`,
  );
}

// why: run only when executed directly, not when imported by the unit test.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`PAR profile sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
