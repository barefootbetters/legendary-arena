/**
 * runMatch.ts — registry load, scenario validation, and simulation driving
 * for the engine-runner CLI.
 *
 * This is the ONLY file in the app that imports the engine or the registry.
 * It consumes the public Runtime-Safe Engine Surface (`runSimulation`,
 * `createCompetentHeuristicPolicy` via the `.` subpath of
 * `@legendary-arena/game-engine`) and the registry's local-file loader plus
 * the browser-safe setup contract — never a deep import into any package
 * dist tree, never `boardgame.io` / `pg` / `game-engine/setup`.
 *
 * Layer: application host (`apps/engine-runner`), a peer of `apps/server`.
 */

import { readFile } from "node:fs/promises";

import {
  runSimulation,
  createCompetentHeuristicPolicy,
} from "@legendary-arena/game-engine";
import type {
  AIPolicy,
  SimulationConfig,
  SimulationResult,
} from "@legendary-arena/game-engine";
import { createRegistryFromLocalFiles } from "@legendary-arena/registry";
import type { CardRegistry } from "@legendary-arena/registry";
import { validateMatchSetupDocument } from "@legendary-arena/registry/setupContract";
import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";

import type { RunnerConfig } from "./cli.js";

/**
 * An expected, operator-facing failure carrying the locked exit code the
 * entrypoint should exit with. `exitCode` 2 = scenario validation failure
 * (missing / unparseable file, or the setup contract rejects the document);
 * `exitCode` 3 = runtime execution failure (for example the registry cannot
 * be loaded). CLI/argument errors (exit 1) are handled in `cli.ts` and never
 * reach this class; determinism mismatch (exit 4) is decided in the
 * entrypoint from the verify verdict.
 */
export class RunnerError extends Error {
  readonly exitCode: number;

  /**
   * @param message - a full-sentence description of what failed and what to check.
   * @param exitCode - the locked process exit code for this failure class.
   */
  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "RunnerError";
    this.exitCode = exitCode;
  }
}

/**
 * The verdict of a determinism self-check: whether the two canonical
 * SimulationResult JSON strings from two identical runs are byte-equal, plus
 * the two strings themselves for a mismatch diagnostic.
 */
export interface DeterminismVerdict {
  readonly identical: boolean;
  readonly firstJson: string;
  readonly secondJson: string;
}

/**
 * Loads the card registry from local JSON files, resolved from the
 * repository root exactly as `apps/server` resolves them (the `start` /
 * `test` scripts `cd` to the repo root first). A load failure is a runtime
 * execution failure (exit code 3), not a scenario error.
 *
 * @returns the immutable card registry.
 */
export async function loadRunnerRegistry(): Promise<CardRegistry> {
  try {
    return await createRegistryFromLocalFiles({
      metadataDir: "data/metadata",
      cardsDir: "data/cards",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RunnerError(
      `The card registry could not be loaded from data/metadata and data/cards. Run this command from the repository root so the local card data resolves. Error: ${detail}`,
      3,
    );
  }
}

/**
 * Reads and validates the scenario file at `scenarioPath` against the
 * registry's setup contract, returning the validated MatchSetupDocument.
 *
 * // why: the scenario is validated UP FRONT with `validateMatchSetupDocument`
 * because the simulation path (`buildInitialGameState` inside `runSimulation`)
 * does NOT run `Game.setup`'s `validateMatchSetup` gate — an unvalidated,
 * malformed composition would otherwise fault mid-run with a raw stack trace
 * instead of a clean, actionable exit-2 error.
 *
 * @param scenarioPath - filesystem path to a single MatchSetupDocument JSON file.
 * @param registry - the loaded card registry, used for ext_id existence checks.
 * @returns the validated document (envelope + nine-field composition).
 */
export async function loadScenarioDocument(
  scenarioPath: string,
  registry: CardRegistry,
): Promise<MatchSetupDocument> {
  let rawText: string;
  try {
    rawText = await readFile(scenarioPath, "utf8");
  } catch {
    throw new RunnerError(
      `The scenario file could not be read at "${scenarioPath}". Check that the path exists and is readable.`,
      2,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RunnerError(
      `The scenario file at "${scenarioPath}" is not valid JSON. Fix the JSON syntax and retry. Error: ${detail}`,
      2,
    );
  }

  const result = validateMatchSetupDocument(parsed, registry);
  if (result.ok === false) {
    const firstError = result.errors[0];
    const location = firstError === undefined ? "document" : firstError.field;
    const reason =
      firstError === undefined
        ? "the document did not match the match-setup schema"
        : firstError.message;
    throw new RunnerError(
      `The scenario document at "${scenarioPath}" failed match-setup validation (${location}): ${reason} Fix the scenario and retry.`,
      2,
    );
  }
  return result.value;
}

/**
 * Builds the `SimulationConfig` from a validated document and the runner
 * config. Seats are derived from the document's `playerCount` (never a CLI
 * flag): one competent policy is constructed per seat, and the nine-field
 * composition becomes `setupConfig`. The `--seed` run seed drives the
 * simulation; the document's envelope `seed` is validation-only metadata.
 *
 * @param document - the validated MatchSetupDocument.
 * @param config - the parsed runner config (supplies `games` and the run seed).
 * @returns the fully-populated simulation config.
 */
export function buildSimulationConfig(
  document: MatchSetupDocument,
  config: RunnerConfig,
): SimulationConfig {
  const policies: AIPolicy[] = [];
  for (let seat = 0; seat < document.playerCount; seat += 1) {
    // why: one T2 competent-heuristic policy per seat — T2 is the
    // calibration-grade tier, the only tier wired here. The per-seat seed is
    // derived deterministically from the run seed and the seat index so each
    // seat's decision PRNG is distinct yet fully reproducible; `verify`'s two
    // runs reseed identically, which is what makes byte-identical output a
    // meaningful determinism assertion.
    policies.push(createCompetentHeuristicPolicy(`${config.seed}:seat-${seat}`));
  }
  return {
    games: config.games,
    seed: config.seed,
    setupConfig: document.composition,
    policies,
  };
}

/**
 * Serializes a SimulationResult to its canonical JSON form: `JSON.stringify`
 * in the result's native field order. This is the exact byte string emitted
 * to stdout / `--out` and the string compared by the determinism self-check.
 *
 * @param result - the aggregate simulation result.
 * @returns the canonical JSON string.
 */
export function canonicalizeResult(result: SimulationResult): string {
  // why: canonical form is JSON.stringify in the object's native field order
  // (the order runSimulation constructs it in) — no key sorting, no
  // indentation — so two runs producing the same object produce byte-identical
  // strings.
  return JSON.stringify(result);
}

/**
 * Compares two canonical SimulationResult JSON strings for byte equality.
 * This pure comparator is the sole decider of the `verify` exit code (a false
 * verdict maps to exit 4 in the entrypoint).
 *
 * @param firstJson - canonical JSON of the first run.
 * @param secondJson - canonical JSON of the second run.
 * @returns the determinism verdict.
 */
export function compareCanonicalResults(
  firstJson: string,
  secondJson: string,
): DeterminismVerdict {
  // why: determinism is decided by comparing the canonical JSON STRINGS, never
  // object reference equality or incidental runtime key order — two identical
  // runs must be byte-for-byte equal.
  return { identical: firstJson === secondJson, firstJson, secondJson };
}

/**
 * Runs the scenario once and returns the aggregate SimulationResult (the
 * `run` mode). Loads the registry, validates the scenario, builds the
 * simulation config, and drives the engine's public harness.
 *
 * @param config - the parsed runner config.
 * @returns the aggregate simulation result.
 */
export async function runScenario(
  config: RunnerConfig,
): Promise<SimulationResult> {
  const registry = await loadRunnerRegistry();
  const document = await loadScenarioDocument(config.scenarioPath, registry);
  const simulationConfig = buildSimulationConfig(document, config);
  // why: runSimulation is consumed from the public Runtime-Safe Engine Surface
  // (the `@legendary-arena/game-engine` `.` subpath) — NOT a
  // packages/game-engine/dist/simulation deep import; the layer rule forbids an
  // app reaching past the barrel even though repo scripts historically did.
  return runSimulation(simulationConfig, registry);
}

/**
 * Runs the identical scenario twice and compares the canonical results (the
 * `verify` mode). Loads the registry and validates the scenario once, then
 * executes `runSimulation` twice against the same immutable inputs.
 *
 * @param config - the parsed runner config.
 * @returns the determinism verdict.
 */
export async function verifyDeterminism(
  config: RunnerConfig,
): Promise<DeterminismVerdict> {
  const registry = await loadRunnerRegistry();
  const document = await loadScenarioDocument(config.scenarioPath, registry);
  const simulationConfig = buildSimulationConfig(document, config);
  // why: the determinism self-check runs the SAME simulation twice; because
  // runSimulation is documented as pure — identical (config, registry) yields
  // byte-identical SimulationResult — any mismatch localizes a leaked
  // wall-clock or Math.random into THIS app, not the engine.
  const firstJson = canonicalizeResult(runSimulation(simulationConfig, registry));
  const secondJson = canonicalizeResult(
    runSimulation(simulationConfig, registry),
  );
  return compareCanonicalResults(firstJson, secondJson);
}
