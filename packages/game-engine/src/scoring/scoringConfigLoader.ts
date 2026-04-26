/**
 * ScenarioScoringConfig loader (WP-053a / D-5306a).
 *
 * Reads `ScenarioScoringConfig` instances from the canonical authoring
 * origin under `data/scoring-configs/<encoded-scenario-key>.json`. Exists
 * to feed the PAR aggregator at calibration time and the seed-artifact
 * authoring pipeline; the resulting config is then embedded verbatim into
 * every PAR artifact via `writeSimulationParArtifact` /
 * `writeSeedParArtifact`.
 *
 * // why: this loader does filesystem IO (`node:fs/promises`) and is
 * therefore NOT a "pure helper" in the engine-wide pure-helper sense. The
 * pure-helper rule (no IO inside moves / phases / hooks) applies to
 * gameplay-time code paths. This loader is called only at PAR aggregator
 * calibration time and at authoring time — never inside a move, never
 * inside a phase hook, never from `boardgame.io` lifecycle code. Its IO
 * profile mirrors the `par.storage.ts` writers (which also do startup-time
 * IO under D-5001's simulation IO carve-out).
 *
 * // why: async signatures match the existing `par.storage.ts` IO
 * conventions (`writeSimulationParArtifact`, `readSeedParArtifact`,
 * `buildParIndex`, `loadParIndex` — all return `Promise<…>`). The future
 * authoring pipeline composes these writers and the loader in the same
 * async layer; a synchronous loader would force `readFileSync` (forbidden
 * in production) or block the async chain.
 *
 * Engine layer only. No `boardgame.io` import. No `apps/server/**`
 * import. No engine-runtime gameplay imports. Filename encoding reuses
 * `scenarioKeyToFilename` from `par.storage.ts` byte-for-byte (PS-4) so
 * the on-disk layout matches the PAR artifact storage layer exactly.
 */

// why: namespace imports (rather than named imports) for `node:*` modules
// keep this file static-analysis-friendly under Vite's browser bundling.
// Arena-client (browser) re-exports through the engine barrel and Vite
// externalizes `node:*` to a stub module that exposes no named bindings;
// named imports like `{ readFile, readdir }` fail at bundle time, while
// namespace bindings resolve to the empty stub object and are dropped by
// tree-shaking unless actually called. The functions in this file are
// never called from browser code paths (server / authoring CLI / engine
// aggregator only), so the runtime-bound accesses below are dead code in
// the browser bundle and Rollup eliminates them.
import * as fsPromises from 'node:fs/promises';
import * as nodePath from 'node:path';

import type { ScenarioKey, ScenarioScoringConfig } from './parScoring.types.js';
import { validateScoringConfig } from './parScoring.logic.js';
import { scenarioKeyToFilename } from '../simulation/par.storage.js';

/**
 * Loads the `ScenarioScoringConfig` for a single scenario from the
 * canonical authoring origin (D-5306a).
 *
 * Resolves `<basePath>/<scenarioKeyToFilename(scenarioKey)>` via
 * `node:fs/promises` `readFile`, parses the JSON payload, and validates
 * the parsed object via `validateScoringConfig` (the sole structural
 * validator for `ScenarioScoringConfig`, locked at WP-048). Throws a
 * full-sentence `Error` on parse failure (JSON is malformed) or validation
 * failure (the validator's `errors` array is joined with `'; '` and
 * embedded in the thrown message).
 *
 * Throws — does not return a `Result<T>`. Authoring-time and startup-time
 * code paths fail loudly so a bad config blocks publication early; this
 * mirrors the `Game.setup()` precedent for setup-time failures (only
 * `Game.setup()` may throw inside the engine; this loader is never called
 * from a move, phase hook, or in-game code path).
 *
 * @param scenarioKey  The scenario identifier whose config should be
 *   loaded; encoded into a filename via `scenarioKeyToFilename`.
 * @param basePath     The directory containing the per-scenario JSON
 *   files; in production this is `data/scoring-configs/`.
 * @returns The parsed and validated `ScenarioScoringConfig`.
 */
export async function loadScoringConfigForScenario(
  scenarioKey: ScenarioKey,
  basePath: string,
): Promise<ScenarioScoringConfig> {
  // why: filename encoding reuses scenarioKeyToFilename from par.storage.ts
  // (`::` → `--`, `+` → `_`) per PS-4 / D-5306a so the on-disk filename
  // matches PAR artifact storage layout byte-for-byte. A second encoding
  // helper would create drift surface; the choke-point stays at one site.
  const filename = scenarioKeyToFilename(scenarioKey);
  const filePath = nodePath.join(basePath, filename);

  let raw: string;
  try {
    raw = await fsPromises.readFile(filePath, 'utf-8');
  } catch (readError) {
    const detail =
      readError instanceof Error ? readError.message : 'Unknown read failure.';
    throw new Error(
      `loadScoringConfigForScenario could not read scoring config at ${filePath} for scenario ${scenarioKey}: ${detail}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    const detail =
      parseError instanceof Error ? parseError.message : 'Unknown parse failure.';
    throw new Error(
      `loadScoringConfigForScenario could not parse scoring config at ${filePath} for scenario ${scenarioKey} as JSON: ${detail}`,
    );
  }

  // why: validateScoringConfig is the sole structural validator for
  // ScenarioScoringConfig (WP-048); re-implementing field-presence checks
  // here would create a parallel validator that could drift. The validator
  // returns `{ valid, errors[] }` per PS-1 (not `{ ok, reason }`); the
  // loader joins `errors` with '; ' for the thrown message. A try/catch
  // around the call captures runtime crashes from radically-malformed JSON
  // (e.g. a top-level number) and surfaces them as structured rejections.
  const candidate = parsed as ScenarioScoringConfig;
  let validation;
  try {
    validation = validateScoringConfig(candidate);
  } catch (validatorError) {
    const detail =
      validatorError instanceof Error ? validatorError.message : 'Unknown validator failure.';
    throw new Error(
      `loadScoringConfigForScenario rejected scoring config at ${filePath} for scenario ${scenarioKey}: validator threw before returning a structured result (${detail}). The file's top-level shape is incompatible with ScenarioScoringConfig.`,
    );
  }
  if (!validation.valid) {
    throw new Error(
      `loadScoringConfigForScenario rejected scoring config at ${filePath} for scenario ${scenarioKey}: ${validation.errors.join('; ')}`,
    );
  }

  return candidate;
}

/**
 * Loads every `ScenarioScoringConfig` under the supplied directory.
 *
 * Scans `basePath` via `node:fs/promises` `readdir`, filters to `.json`
 * files (skipping `README.md`, `.gitkeep`, and other non-config entries),
 * loads each file via `loadScoringConfigForScenario`, and returns a frozen
 * map keyed by `ScenarioKey`. Throws on the first parse / validation
 * failure — partial loads are not a supported mode, since the PAR
 * aggregator and authoring pipeline cannot reason about a partially-
 * populated config set.
 *
 * The map is frozen at the top level via `Object.freeze` so accidental
 * downstream mutation surfaces as a runtime error in strict mode rather
 * than silently corrupting the cache.
 *
 * @param basePath  The directory containing per-scenario JSON files; in
 *   production this is `data/scoring-configs/`.
 * @returns A frozen `Record<ScenarioKey, ScenarioScoringConfig>` covering
 *   every `.json` file in `basePath`.
 */
export async function loadAllScoringConfigs(
  basePath: string,
): Promise<Record<ScenarioKey, ScenarioScoringConfig>> {
  let entries: string[];
  try {
    entries = await fsPromises.readdir(basePath);
  } catch (readdirError) {
    const detail =
      readdirError instanceof Error ? readdirError.message : 'Unknown readdir failure.';
    throw new Error(
      `loadAllScoringConfigs could not enumerate scoring config directory at ${basePath}: ${detail}`,
    );
  }

  // why: deterministic ordering on the directory scan keeps the produced
  // map's insertion order stable across runs and machines. Filesystems do
  // not guarantee readdir ordering; sorting alphabetically matches the
  // ParIndex.scenarios determinism contract (D-5306a).
  const sortedJsonFiles = entries
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  const result: Record<ScenarioKey, ScenarioScoringConfig> = {};
  for (const filename of sortedJsonFiles) {
    const filePath = nodePath.join(basePath, filename);
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      const detail =
        parseError instanceof Error ? parseError.message : 'Unknown parse failure.';
      throw new Error(
        `loadAllScoringConfigs could not parse scoring config at ${filePath} as JSON: ${detail}`,
      );
    }
    const candidate = parsed as ScenarioScoringConfig;
    let validation;
    try {
      validation = validateScoringConfig(candidate);
    } catch (validatorError) {
      const detail =
        validatorError instanceof Error ? validatorError.message : 'Unknown validator failure.';
      throw new Error(
        `loadAllScoringConfigs rejected scoring config at ${filePath}: validator threw before returning a structured result (${detail}). The file's top-level shape is incompatible with ScenarioScoringConfig.`,
      );
    }
    if (!validation.valid) {
      throw new Error(
        `loadAllScoringConfigs rejected scoring config at ${filePath}: ${validation.errors.join('; ')}`,
      );
    }
    result[candidate.scenarioKey] = candidate;
  }

  return Object.freeze(result);
}
