#!/usr/bin/env node
/**
 * Browser-safe gauntlet-configs literal generator (WP-483 / EC-518 / D-24283).
 *
 * Bakes the hand-authored data/gauntlet-configs.json into the registry source
 * module packages/registry/src/gauntletConfigs.generated.ts as a TypeScript
 * literal, so gauntletConfigs.ts can validate it at module load WITHOUT reading
 * the file via node:fs.
 *
 * Why this exists: gauntletConfigs.ts previously `readFileSync`d the JSON at
 * module load, which pulls node:fs into the module-load path. That is fine for
 * the server (which imports the registry through the root barrel), but breaks
 * the Vite BROWSER build for apps/registry-viewer, whose cards builder needs the
 * per-scheme config for the qualification badge and pack prefill. Baking the
 * data into a literal removes the only Node dependency from the load path, so a
 * new ./gauntletConfigs subpath can be imported browser-safely. Mirrors the
 * scripts/generate-gauntlet-loadouts.mjs precedent exactly.
 *
 * What it does:
 *   1. Read + JSON.parse data/gauntlet-configs.json (the source of truth).
 *   2. Render it as a TS literal typed `unknown` — gauntletConfigs.ts re-runs
 *      validateGauntletConfigs on it at load, exactly as it did on the parsed
 *      file, so the validate-at-load throw semantics are preserved.
 *   3. Default mode writes the module; --check regenerates in memory and exits
 *      non-zero on drift (a convenience gate — like gauntlet:loadouts:check it
 *      is NOT wired into ci.yml; the enforcing gate is the in-test freshness
 *      assertion in gauntletConfigs.test.ts, run in CI via `pnpm -r … test`).
 *
 * Deterministic: JSON.parse preserves the source's string-key insertion order at
 * every Record level and JSON.stringify re-emits it, so identical input yields
 * byte-identical output. No wall-clock, no randomness, no key re-sorting. Run
 * from the repo root.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const SOURCE_PATH = join(REPO_ROOT, 'data', 'gauntlet-configs.json');
const OUTPUT_PATH = join(
  REPO_ROOT,
  'packages',
  'registry',
  'src',
  'gauntletConfigs.generated.ts',
);

/** Error type signalling a read/parse failure (exit code 2). */
class GenerationError extends Error {}

/**
 * Reads and parses the authored gauntlet-configs JSON.
 *
 * @returns {unknown} the parsed config object (source key order preserved).
 */
function readSourceConfigs() {
  let fileText;
  try {
    fileText = readFileSync(SOURCE_PATH, 'utf8');
  } catch (readError) {
    throw new GenerationError(
      `Could not read ${SOURCE_PATH}: ${readError.message}. Confirm the ` +
        `authored data/gauntlet-configs.json is present before regenerating.`,
    );
  }
  try {
    return JSON.parse(fileText);
  } catch (parseError) {
    throw new GenerationError(
      `data/gauntlet-configs.json is not valid JSON: ${parseError.message}. ` +
        `Fix the authored file before regenerating.`,
    );
  }
}

/**
 * Renders the generated TypeScript module for one parsed config object.
 *
 * @param {unknown} parsedConfigs the parsed data/gauntlet-configs.json.
 * @returns {string} the module source text.
 */
function renderModule(parsedConfigs) {
  // why: JSON.stringify with 2-space indent emits a valid TS object literal in
  // the source key order; typing it `unknown` mirrors the old `JSON.parse` →
  // `unknown` → validateGauntletConfigs flow (gauntletConfigs.ts re-validates it
  // at load), and keeps the generated .d.ts tiny.
  const literal = JSON.stringify(parsedConfigs, null, 2);
  const lines = [];
  lines.push('// GENERATED FILE — DO NOT EDIT BY HAND.');
  lines.push('// Regenerate with `pnpm gauntlet:configs`; verify with');
  lines.push('// `pnpm gauntlet:configs:check` (WP-483 / EC-518 / D-24283).');
  lines.push('//');
  lines.push('// The per-scheme gauntlet approved-loadout config, baked from');
  lines.push('// data/gauntlet-configs.json so packages/registry/src/gauntletConfigs.ts');
  lines.push('// can validate it at load WITHOUT node:fs (browser-safe via the');
  lines.push('// ./gauntletConfigs subpath). data/gauntlet-configs.json is the source of');
  lines.push('// truth; the in-test freshness assertion in gauntletConfigs.test.ts (and');
  lines.push('// `pnpm gauntlet:configs:check`) guard against drift.');
  lines.push('');
  lines.push(`export const GAUNTLET_CONFIGS_DATA: unknown = ${literal};`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Entry point.
 *
 * @returns {number} the process exit code.
 */
function main() {
  const mode = process.argv[2];
  const parsedConfigs = readSourceConfigs();
  const freshText = renderModule(parsedConfigs);

  if (mode === '--check') {
    let committedText = '';
    try {
      committedText = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      console.log(
        `FAIL: the gauntlet-configs literal is missing at ${OUTPUT_PATH}. ` +
          `Run \`pnpm gauntlet:configs\` and commit the result.`,
      );
      return 1;
    }
    // why: compare content, not the platform's newline style — a CRLF checkout
    // must not fail a gate that is about data drift (mirrors gauntlet:loadouts:check).
    if (committedText.replace(/\r\n/g, '\n') !== freshText) {
      console.log(
        `FAIL: the gauntlet-configs literal at ${OUTPUT_PATH} is stale. ` +
          `Run \`pnpm gauntlet:configs\` and commit the result.`,
      );
      return 1;
    }
    console.log('OK: the gauntlet-configs literal is current.');
    return 0;
  }

  writeFileSync(OUTPUT_PATH, freshText, 'utf8');
  console.log(`Wrote the gauntlet-configs literal to:`);
  console.log(`  ${OUTPUT_PATH}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (generationError) {
  if (generationError instanceof GenerationError) {
    console.error(`FAIL: ${generationError.message}`);
    process.exitCode = 2;
  } else {
    console.error(generationError);
    process.exitCode = 2;
  }
}
