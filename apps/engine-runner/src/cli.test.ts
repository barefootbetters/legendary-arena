/**
 * cli.test.ts — argument-parse matrix for the engine-runner CLI parser.
 *
 * Covers the happy paths (valid `run` / `verify` argv → correct RunnerConfig)
 * and every rejection the Contract locks (missing --scenario, missing /
 * zero / non-integer --games, empty --seed, unknown mode, unknown flag,
 * dangling flag). Each rejection must be `{ ok: false }` — the entrypoint
 * maps that to exit code 1 with no simulation run.
 *
 * node:test via tsx. No boardgame.io, no engine, no registry, no IO.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { parseRunnerConfig } from "./cli.js";

describe("parseRunnerConfig (WP-304 / EC-334)", () => {
  test("valid run argv parses into the correct RunnerConfig", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "5",
      "--seed",
      "demo",
      "--out",
      "result.json",
    ]);

    assert.equal(result.ok, true);
    if (result.ok === true) {
      assert.deepEqual(result.config, {
        mode: "run",
        scenarioPath: "setup.json",
        games: 5,
        seed: "demo",
        outPath: "result.json",
      });
    }
  });

  test("valid verify argv parses into the correct RunnerConfig (no --out)", () => {
    const result = parseRunnerConfig([
      "verify",
      "--scenario",
      "setup.json",
      "--games",
      "3",
      "--seed",
      "abc",
    ]);

    assert.equal(result.ok, true);
    if (result.ok === true) {
      assert.equal(result.config.mode, "verify");
      assert.equal(result.config.scenarioPath, "setup.json");
      assert.equal(result.config.games, 3);
      assert.equal(result.config.seed, "abc");
      assert.equal(result.config.outPath, undefined);
    }
  });

  test("missing --scenario is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--games",
      "5",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("--games 0 is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "0",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("non-integer --games is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "5.5",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("non-numeric --games is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "abc",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("empty --seed is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "5",
      "--seed",
      "",
    ]);
    assert.equal(result.ok, false);
  });

  test("missing --games is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("unknown mode is rejected", () => {
    const result = parseRunnerConfig([
      "simulate",
      "--scenario",
      "setup.json",
      "--games",
      "5",
      "--seed",
      "demo",
    ]);
    assert.equal(result.ok, false);
  });

  test("no arguments at all is rejected", () => {
    const result = parseRunnerConfig([]);
    assert.equal(result.ok, false);
  });

  test("an unknown flag is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "5",
      "--seed",
      "demo",
      "--players",
      "3",
    ]);
    assert.equal(result.ok, false);
  });

  test("a dangling flag with no value is rejected", () => {
    const result = parseRunnerConfig([
      "run",
      "--scenario",
      "setup.json",
      "--games",
      "5",
      "--seed",
    ]);
    assert.equal(result.ok, false);
  });
});
