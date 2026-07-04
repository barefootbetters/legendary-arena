/**
 * index.mjs — engine-runner process entrypoint (01.5 runtime-wiring).
 *
 * Process concerns only: read argv, dispatch to `run` / `verify`, and map
 * every outcome to stdout / stderr and a locked exit code. It contains no
 * simulation logic — `cli.ts` owns argument parsing and `runMatch.ts` owns
 * registry loading, scenario validation, and driving the engine harness.
 *
 * Exit codes (locked): 0 success · 1 CLI/argument error · 2 scenario
 * validation error · 3 runtime execution failure · 4 determinism mismatch.
 * Every non-zero exit writes a full-sentence message to stderr.
 */

import process from "node:process";
import { writeFile } from "node:fs/promises";

import { parseRunnerConfig } from "./cli.js";
import {
  runScenario,
  verifyDeterminism,
  canonicalizeResult,
  RunnerError,
} from "./runMatch.js";

/**
 * Parses argv, runs the selected mode, and exits with the locked code.
 */
async function main() {
  const parseResult = parseRunnerConfig(process.argv.slice(2));
  if (parseResult.ok === false) {
    process.stderr.write(`${parseResult.message}\n`);
    process.exit(1);
    return;
  }

  const config = parseResult.config;
  try {
    if (config.mode === "run") {
      const result = await runScenario(config);
      const json = canonicalizeResult(result);
      if (config.outPath === undefined) {
        process.stdout.write(`${json}\n`);
      } else {
        await writeFile(config.outPath, `${json}\n`, "utf8");
      }
      process.exit(0);
      return;
    }

    const verdict = await verifyDeterminism(config);
    if (verdict.identical) {
      process.stdout.write(`${JSON.stringify({ identical: true })}\n`);
      process.exit(0);
      return;
    }
    process.stderr.write(
      `Determinism verification failed: two identical runs produced different canonical SimulationResult JSON. ` +
        `First run: ${verdict.firstJson} Second run: ${verdict.secondJson}\n`,
    );
    process.exit(4);
    return;
  } catch (error) {
    if (error instanceof RunnerError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
      return;
    }
    // why: any non-RunnerError escaping run/verify is an unexpected runtime
    // execution failure (exit 3) — surface a full sentence, never a raw stack
    // trace as the primary UX, and never a zeroed result presented as success.
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `The engine-runner failed unexpectedly while executing the simulation. Error: ${detail}\n`,
    );
    process.exit(3);
  }
}

main();
