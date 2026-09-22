#!/usr/bin/env node

/**
 * Operator-run endgame coach model eval (WP-737 / EC-774 / D-24559).
 *
 * Usage (from the repo root, with the key exported in this shell):
 *   pnpm --filter @legendary-arena/server coach:eval --model <id> [--scenario <id>]... [--out <path>]
 *
 * Sends each fixture scenario in `src/coach/coachEval.fixtures.ts` through the
 * production coach client for the candidate model and scores every report with
 * the deterministic rubric in `src/coach/coachEval.logic.ts`. Prints a pass/fail
 * table and totals; exits 0 only when every scenario passes. Run it before
 * changing `COACH_MODEL` in Render.
 *
 * COST: every run makes ONE PAID Anthropic API call per selected scenario. This
 * script is operator-run only — never wired into `test`, CI, or any workflow.
 *
 * Reads `ANTHROPIC_API_KEY` from the shell (no `--env-file`). Every refusal —
 * missing `--model`, an unregistered model, an unknown `--scenario`, a missing
 * key — exits 1 before any network call.
 *
 * Run with `node --import tsx` so the `../src/coach/*.js` specifiers resolve to
 * the TypeScript sources. ESM module.
 */

import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { lookupCoachModelQuirks } from '../src/coach/coachModelConfig.js';
import { createAnthropicCoachClient } from '../src/coach/coachClient.js';
import { COACH_EVAL_SCENARIOS } from '../src/coach/coachEval.fixtures.js';
import { scoreCoachReport, summarizeCoachEvalRun } from '../src/coach/coachEval.logic.js';

/**
 * Print a refusal and exit 1. Used for every pre-network refusal.
 *
 * @param {string} message - The full-sentence refusal.
 * @returns {never}
 */
function refuse(message) {
  console.error(message);
  process.exit(1);
}

/**
 * Parse the CLI arguments.
 *
 * @param {string[]} args - The raw arguments.
 * @returns {{ model: string | undefined, scenarioIds: string[], outPath: string | undefined }}
 */
function parseCoachEvalArguments(args) {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        model: { type: 'string' },
        scenario: { type: 'string', multiple: true },
        out: { type: 'string' },
      },
      args,
    });
  } catch (error) {
    refuse(`The coach eval arguments could not be parsed: ${error.message}`);
  }
  return {
    model: parsed.values.model,
    scenarioIds: parsed.values.scenario ?? [],
    outPath: parsed.values.out,
  };
}

/**
 * Select the scenarios to run: all of them, or only the requested ids. Refuses an
 * unknown id before any network call.
 *
 * @param {string[]} scenarioIds - The requested ids, or empty for all.
 * @returns {Array<import('../src/coach/coachEval.types.js').CoachEvalScenario>}
 */
function selectScenarios(scenarioIds) {
  if (scenarioIds.length === 0) {
    return [...COACH_EVAL_SCENARIOS];
  }
  const selected = [];
  for (const scenarioId of scenarioIds) {
    const scenario = COACH_EVAL_SCENARIOS.find((candidate) => candidate.id === scenarioId);
    if (scenario === undefined) {
      const knownIds = COACH_EVAL_SCENARIOS.map((candidate) => candidate.id).join(', ');
      refuse(`The scenario ${scenarioId} is not in the coach eval pack; choose one of: ${knownIds}.`);
    }
    selected.push(scenario);
  }
  return selected;
}

/**
 * Run one scenario through the live client and score it. A thrown `generate`
 * (empty response, missing JSON, wrong shape, HTTP error) fails the scenario and
 * keeps the error message — the EC-629 regression signal.
 *
 * @param {{ generate: Function }} client - The live coach client.
 * @param {import('../src/coach/coachEval.types.js').CoachEvalScenario} scenario - The scenario.
 * @returns {Promise<{ result: import('../src/coach/coachEval.types.js').CoachEvalResult, report: unknown }>}
 */
async function runScenario(client, scenario) {
  try {
    const report = await client.generate(scenario.summary);
    return { result: scoreCoachReport(scenario, report), report };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      result: {
        scenarioId: scenario.id,
        isPassing: false,
        failures: [`The coach client threw before a report could be scored: ${reason}`],
      },
      report: null,
    };
  }
}

/**
 * Print the per-scenario table and the run totals.
 *
 * @param {string} model - The evaluated model id.
 * @param {Array<import('../src/coach/coachEval.types.js').CoachEvalResult>} results - Every result.
 * @param {import('../src/coach/coachEval.types.js').CoachEvalRunSummary} summary - The totals.
 */
function printResults(model, results, summary) {
  console.log(`\nCoach eval for ${model}:\n`);
  for (const result of results) {
    const verdict = result.isPassing ? 'PASS' : 'FAIL';
    console.log(`  ${verdict}  ${result.scenarioId}`);
    for (const failure of result.failures) {
      console.log(`          - ${failure}`);
    }
  }
  console.log(
    `\nTotals: ${summary.totalCount} scenarios, ${summary.passedCount} passed, ${summary.failedCount} failed.`,
  );
}

/**
 * Run the eval end to end. Refusals come first, in the locked order, all before
 * any network call; scenarios then run one at a time.
 */
async function main() {
  const { model, scenarioIds, outPath } = parseCoachEvalArguments(process.argv.slice(2));

  if (model === undefined || model === '') {
    refuse('The coach eval needs a model to evaluate; pass --model <id>, for example --model claude-sonnet-5.');
  }

  // why: production is forgiving (an unregistered COACH_MODEL falls back to the
  // default model), but the eval is strict. Evaluating the fallback under the
  // candidate's name would report a green run for a model that was never called.
  const quirks = lookupCoachModelQuirks(model);
  if (quirks === undefined) {
    refuse(
      `The model ${model} has no quirk row; add one to COACH_MODEL_QUIRKS_BY_MODEL in coachModelConfig.ts before evaluating it.`,
    );
  }

  const scenarios = selectScenarios(scenarioIds);

  // why: an empty key is treated as unset, mirroring the coach wiring in server.mjs.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    refuse('ANTHROPIC_API_KEY is not set; export it in this shell to run the paid coach eval.');
  }

  console.log(`Running ${scenarios.length} coach eval scenario(s) against ${model}; each is one paid API call.`);
  const client = createAnthropicCoachClient(apiKey, { model, quirks });
  const results = [];
  const reports = [];
  // why: sequential on purpose — one paid call at a time keeps the run inside
  // rate limits and makes a failure's position in the output unambiguous.
  for (const scenario of scenarios) {
    const { result, report } = await runScenario(client, scenario);
    console.log(`  ${result.isPassing ? 'pass' : 'fail'}  ${scenario.id}`);
    results.push(result);
    reports.push({ scenarioId: scenario.id, report });
  }

  const summary = summarizeCoachEvalRun(results);
  printResults(model, results, summary);

  if (outPath !== undefined) {
    // why: pnpm --filter runs this script from apps/server; INIT_CWD is the shell
    // directory the operator ran pnpm from, so a relative --out lands where expected.
    const resolvedOutPath = resolve(process.env.INIT_CWD ?? process.cwd(), outPath);
    try {
      await writeFile(
        resolvedOutPath,
        `${JSON.stringify({ model, summary, results, reports }, null, 2)}\n`,
        'utf8',
      );
      console.log(`Wrote the eval results to ${resolvedOutPath}.`);
    } catch (error) {
      console.error(`The eval results could not be written to ${resolvedOutPath}: ${error.message}`);
      process.exit(1);
    }
  }

  process.exit(summary.failedCount === 0 ? 0 : 1);
}

await main();
