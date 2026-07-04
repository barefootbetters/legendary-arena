/**
 * runMatch.test.ts — smoke run, determinism verify, seat derivation, and
 * invalid-scenario rejection for the engine-runner.
 *
 * The real-registry tests load card data from data/metadata + data/cards,
 * resolved from the repository root — the `test` script `cd`s to the repo
 * root before invoking node, mirroring `apps/server`. Fixture paths are
 * derived from `import.meta.url` so they resolve regardless of cwd.
 *
 * node:test via tsx. No boardgame.io import; the engine harness is consumed
 * only through the public `@legendary-arena/game-engine` surface.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import type { RunnerConfig } from "./cli.js";
import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";
import {
  runScenario,
  verifyDeterminism,
  buildSimulationConfig,
  canonicalizeResult,
  compareCanonicalResults,
  RunnerError,
} from "./runMatch.js";

const VALID_SCENARIO_PATH = fileURLToPath(
  new URL("./fixtures/scenario.valid.json", import.meta.url),
);
const INVALID_SCENARIO_PATH = fileURLToPath(
  new URL("./fixtures/scenario.invalid.json", import.meta.url),
);
const MISSING_SCENARIO_PATH = fileURLToPath(
  new URL("./fixtures/does-not-exist.json", import.meta.url),
);

/**
 * The seven SimulationResult fields in their locked native order.
 */
const RESULT_FIELDS = [
  "gamesPlayed",
  "winRate",
  "averageTurns",
  "averageScore",
  "escapedVillainsAverage",
  "woundsAverage",
  "seed",
] as const;

/**
 * Builds a runner config for a fixture path with sensible test defaults.
 *
 * @param mode - run or verify.
 * @param scenarioPath - fixture path.
 * @param overrides - optional games/seed overrides.
 * @returns a RunnerConfig.
 */
function makeConfig(
  mode: "run" | "verify",
  scenarioPath: string,
  overrides: { games?: number; seed?: string } = {},
): RunnerConfig {
  return {
    mode,
    scenarioPath,
    games: overrides.games ?? 1,
    seed: overrides.seed ?? "runner-test-seed",
  };
}

/**
 * A minimal three-seat document for the pure seat-derivation test. Only the
 * fields buildSimulationConfig reads (`playerCount`, `composition`) need real
 * values; the composition ext_ids are never resolved here because
 * buildSimulationConfig does no registry work.
 */
function makeThreePlayerDocument(): MatchSetupDocument {
  return {
    schemaVersion: "1.0",
    setupId: "seat-count",
    createdAt: "2026-07-03T00:00:00.000Z",
    createdBy: "simulation",
    seed: "envelope-seed",
    playerCount: 3,
    expansions: ["core"],
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: "core/midtown-bank-robbery",
      mastermindId: "core/magneto",
      villainGroupIds: ["core/skrulls"],
      henchmanGroupIds: ["core/hydra"],
      heroDeckIds: ["core/spider-man", "core/hulk", "core/wolverine", "core/black-widow"],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 12,
    },
  };
}

describe("runMatch (WP-304 / EC-334)", () => {
  test("run on a valid scenario emits a well-formed SimulationResult", async () => {
    const result = await runScenario(makeConfig("run", VALID_SCENARIO_PATH));

    assert.deepEqual(Object.keys(result), [...RESULT_FIELDS]);
    for (const field of RESULT_FIELDS) {
      if (field === "seed") {
        assert.equal(typeof result[field], "string");
      } else {
        assert.equal(typeof result[field], "number");
      }
    }
    assert.equal(result.gamesPlayed, 1);
    // why: the emitted seed is the --seed run seed, never the envelope seed.
    assert.equal(result.seed, "runner-test-seed");
  });

  test("buildSimulationConfig derives one policy per playerCount seat", () => {
    const document = makeThreePlayerDocument();
    const config = makeConfig("run", VALID_SCENARIO_PATH, { games: 4 });

    const simulationConfig = buildSimulationConfig(document, config);

    assert.equal(simulationConfig.policies.length, 3);
    assert.equal(simulationConfig.games, 4);
    assert.equal(simulationConfig.seed, "runner-test-seed");
    assert.equal(simulationConfig.setupConfig, document.composition);
  });

  test("verify returns identical: true for a repeated run", async () => {
    const verdict = await verifyDeterminism(
      makeConfig("verify", VALID_SCENARIO_PATH),
    );
    assert.equal(verdict.identical, true);
    assert.equal(verdict.firstJson, verdict.secondJson);
  });

  test("compareCanonicalResults compares strings, not object identity", () => {
    const identical = compareCanonicalResults('{"a":1}', '{"a":1}');
    assert.equal(identical.identical, true);

    // why: a forced mismatch is what maps to exit code 4 in the entrypoint.
    const mismatch = compareCanonicalResults('{"a":1}', '{"a":2}');
    assert.equal(mismatch.identical, false);
  });

  test("canonicalizeResult uses JSON.stringify native order", () => {
    const result = {
      gamesPlayed: 1,
      winRate: 0,
      averageTurns: 10,
      averageScore: 0,
      escapedVillainsAverage: 0,
      woundsAverage: 0,
      seed: "s",
    };
    assert.equal(canonicalizeResult(result), JSON.stringify(result));
  });

  test("an invalid scenario document is rejected with exit code 2", async () => {
    await assert.rejects(
      () => runScenario(makeConfig("run", INVALID_SCENARIO_PATH)),
      (error) => {
        assert.ok(error instanceof RunnerError);
        assert.equal(error.exitCode, 2);
        return true;
      },
    );
  });

  test("a missing scenario file is rejected with exit code 2", async () => {
    await assert.rejects(
      () => runScenario(makeConfig("run", MISSING_SCENARIO_PATH)),
      (error) => {
        assert.ok(error instanceof RunnerError);
        assert.equal(error.exitCode, 2);
        return true;
      },
    );
  });
});
