/**
 * Tests for the PAR profile sweep's pure helpers (WP-597 / EC-632).
 *
 * Pure helpers only — no live registry, no full sweep, no
 * generateScenarioParSamples call. Covers the ParSimulationConfig assembler, the
 * locked too-easy comparator + ranking, the report-row winRate, and canonical
 * JSON stability.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  splitExtId,
  sliceHeroDeck,
  assembleParSimulationConfig,
  compareTooEasy,
  rankRows,
  buildReportRow,
  renderReportMarkdown,
  canonicalJsonStringify,
} from "./generate-par-profiles.mjs";

describe("PAR profile sweep pure helpers (WP-597)", () => {
  test("splitExtId splits a set-qualified ext_id and passes through a bare slug", () => {
    assert.deepEqual(splitExtId("core/magneto"), { setAbbr: "core", slug: "magneto" });
    assert.deepEqual(splitExtId("cosmic-cube"), { setAbbr: "", slug: "cosmic-cube" });
  });

  test("sliceHeroDeck slices to the count and throws when it exceeds the pool", () => {
    assert.equal(sliceHeroDeck(3).length, 3);
    assert.equal(sliceHeroDeck(6).length, 6);
    assert.throws(() => sliceHeroDeck(7), /only 6/);
  });

  test("assembleParSimulationConfig builds a full 10-field wrapper with a 9-field setupConfig", () => {
    const scenario = {
      scenarioKey: "midtown-bank-robbery::magneto::brotherhood",
      schemeExtId: "core/midtown-bank-robbery",
      mastermindExtId: "core/magneto",
      villainExtIds: ["core/brotherhood"],
      playerCount: 1,
    };
    const scoringConfig = { scoringConfigVersion: 4 };
    const config = assembleParSimulationConfig({
      scenario,
      henchmanGroupIds: ["core/doombot-legion"],
      heroDeckIds: ["core/spider-man", "core/hulk", "core/wolverine"],
      scoringConfig,
      sample: 200,
    });
    // The 9 required ParSimulationConfig fields (generatedAtOverride is optional
    // and deliberately omitted — samples carry no timestamp).
    assert.deepEqual(Object.keys(config).sort(), [
      "baseSeed",
      "percentile",
      "playerCount",
      "scenarioKey",
      "scoringConfig",
      "scoringConfigVersion",
      "setupConfig",
      "simulationCount",
      "simulationPolicyVersion",
    ]);
    // setupConfig has exactly the 9 locked fields.
    assert.deepEqual(Object.keys(config.setupConfig).sort(), [
      "bystandersCount",
      "henchmanGroupIds",
      "heroDeckIds",
      "mastermindId",
      "officersCount",
      "schemeId",
      "sidekicksCount",
      "villainGroupIds",
      "woundsCount",
    ]);
    assert.equal(config.setupConfig.schemeId, "core/midtown-bank-robbery");
    assert.equal(config.setupConfig.mastermindId, "core/magneto");
    assert.deepEqual(config.setupConfig.villainGroupIds, ["core/brotherhood"]);
    assert.equal(config.simulationCount, 200);
    assert.equal(config.scoringConfigVersion, 4);
    assert.equal(config.scoringConfig, scoringConfig);
    assert.equal(config.baseSeed, "par-profile-midtown-bank-robbery::magneto::brotherhood");
    assert.equal(typeof config.percentile, "number");
    assert.equal(config.simulationPolicyVersion, "CompetentHeuristic/v1");
  });

  test("compareTooEasy / rankRows order most-too-easy first with the locked keys", () => {
    const rows = [
      { scenarioKey: "b-nonmono", monotoneImproving: false, winRate: 1.0, minWinningTurn: 5 },
      { scenarioKey: "a-mono-lowwin", monotoneImproving: true, winRate: 0.6, minWinningTurn: 20 },
      { scenarioKey: "c-mono-highwin-late", monotoneImproving: true, winRate: 0.99, minWinningTurn: 18 },
      { scenarioKey: "d-mono-highwin-early", monotoneImproving: true, winRate: 0.99, minWinningTurn: 9 },
      { scenarioKey: "e-mono-nowin", monotoneImproving: true, winRate: 0.0, minWinningTurn: null },
    ];
    const ranked = rankRows(rows);
    const order = ranked.map((row) => row.scenarioKey);
    // monotone before non-monotone; within monotone, higher winRate first; ties by
    // lower minWinningTurn; null minWinningTurn (no win) sorts last.
    assert.deepEqual(order, [
      "d-mono-highwin-early",
      "c-mono-highwin-late",
      "a-mono-lowwin",
      "e-mono-nowin",
      "b-nonmono",
    ]);
    assert.equal(ranked[0].tooEasyRank, 1);
    assert.equal(ranked[4].tooEasyRank, 5);
  });

  test("compareTooEasy tie-breaks equal rows by scenarioKey ascending", () => {
    const left = { scenarioKey: "aaa", monotoneImproving: true, winRate: 1, minWinningTurn: 10 };
    const right = { scenarioKey: "bbb", monotoneImproving: true, winRate: 1, minWinningTurn: 10 };
    assert.ok(compareTooEasy(left, right) < 0);
    assert.ok(compareTooEasy(right, left) > 0);
  });

  test("buildReportRow computes winRate over resolved games only", () => {
    const profile = {
      scenarioKey: "s::m::v",
      sampleSize: 100,
      winCount: 75,
      lossCount: 25,
      minWinningTurn: 11,
      monotoneImproving: true,
      stuckAtCapCount: 0,
      bins: [{ turnCount: 11 }, { turnCount: 12 }],
    };
    const row = buildReportRow(profile);
    assert.equal(row.winRate, 0.75);
    assert.equal(row.lossRate, 0.25);
    assert.equal(row.binCount, 2);
    assert.equal(row.minWinningTurn, 11);
  });

  test("buildReportRow winRate is 0 when no game resolved (all stuck)", () => {
    const profile = {
      scenarioKey: "s::m::v",
      sampleSize: 10,
      winCount: 0,
      lossCount: 0,
      minWinningTurn: null,
      monotoneImproving: true,
      stuckAtCapCount: 10,
      bins: [],
    };
    const row = buildReportRow(profile);
    assert.equal(row.winRate, 0);
    assert.equal(row.minWinningTurn, null);
  });

  test("canonicalJsonStringify sorts keys and round-trips", () => {
    const value = { b: 2, a: { d: 4, c: 3 } };
    const json = canonicalJsonStringify(value);
    assert.equal(json.indexOf('"a"') < json.indexOf('"b"'), true);
    assert.deepEqual(JSON.parse(json), value);
  });

  test("renderReportMarkdown produces a ranked table and a skipped section", () => {
    const report = {
      generatedAt: "2026-08-23T00:00:00.000Z",
      sample: 200,
      version: "v1",
      scenarios: [
        {
          scenarioKey: "s::m::v",
          winRate: 0.97,
          monotoneImproving: true,
          minWinningTurn: 9,
          stuckAtCapCount: 1,
          binCount: 20,
          tooEasyRank: 1,
        },
      ],
      skipped: [{ scenarioKey: "x::y::z", reason: "no gauntlet leg" }],
    };
    const markdown = renderReportMarkdown(report);
    assert.match(markdown, /too-easy scenario ranking/);
    assert.match(markdown, /\| Rank \| Scenario \|/);
    assert.match(markdown, /`s::m::v`/);
    assert.match(markdown, /## Skipped \(1\)/);
    assert.match(markdown, /no gauntlet leg/);
  });
});
