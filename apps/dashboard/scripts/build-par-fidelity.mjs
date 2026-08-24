#!/usr/bin/env node
/**
 * build-par-fidelity.mjs — Build-time copy of the committed WP-597 PAR profile
 * artifacts into the dashboard bundle (WP-598 / EC-633 / D-24407).
 *
 * The dashboard cannot statically import a file outside its package root, so the
 * committed `data/par/profile/v1/` artifacts are merged, at build time, into ONE
 * combined JSON keyed by scenarioKey and written to gitignored `src/data`, then
 * imported by `useParFidelity`:
 *   - data/par/profile/v1/fidelity-report.json  (the ranked report)
 *   - data/par/profile/v1/<scenarioKey :: → --, + → _>.json  (128 per-scenario profiles)
 *   → src/data/par-fidelity.json  = { report, profiles: { [scenarioKey]: profile } }
 *
 * On any read/parse failure this writes an empty stub (with an `error` field) and
 * continues — aborting the build is strictly worse for the operator than an
 * empty-state PAR Fidelity panel (mirrors build-coverage-ledger.mjs). DIAGNOSTIC
 * data only — never competitive PAR.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');

const PROFILE_DIR = join(REPO_ROOT, 'data/par/profile/v1');
const REPORT_SOURCE_PATH = join(PROFILE_DIR, 'fidelity-report.json');
const OUTPUT_PATH = join(DASHBOARD_DIR, 'src/data/par-fidelity.json');

const EMPTY_REPORT = {
  generatedAt: '',
  sample: 0,
  scenarioCount: 0,
  skippedCount: 0,
  version: '',
  scenarios: [],
  skipped: [],
};

/**
 * The scenarioKey → profile filename transform (matches par.storage.ts
 * scenarioKeyToFilename): `::` → `--`, `+` → `_`, then `.json`.
 */
function scenarioKeyToFilename(scenarioKey) {
  return `${scenarioKey.replaceAll('::', '--').replaceAll('+', '_')}.json`;
}

/**
 * Reads the report + every per-scenario profile it names and writes the combined
 * bundle. Never throws — on failure writes `{ report: EMPTY_REPORT, profiles: {},
 * error }` so the panel renders its empty state rather than failing the build.
 */
async function buildBundle() {
  try {
    const reportRaw = await readFile(REPORT_SOURCE_PATH, 'utf-8');
    const report = JSON.parse(reportRaw);
    const profiles = {};
    for (const scenario of report.scenarios ?? []) {
      const profilePath = join(PROFILE_DIR, scenarioKeyToFilename(scenario.scenarioKey));
      // why: a single missing/broken profile must not lose the whole bundle — skip
      // it (the panel simply cannot expand that one scenario's curve).
      try {
        const profileRaw = await readFile(profilePath, 'utf-8');
        profiles[scenario.scenarioKey] = JSON.parse(profileRaw);
      } catch (profileError) {
        const detail = profileError instanceof Error ? profileError.message : 'unknown';
        process.stderr.write(
          `par-fidelity: skipped profile for ${scenario.scenarioKey} (detail: ${detail}).\n`,
        );
      }
    }
    const bundle = { report, profiles };
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`, 'utf-8');
    process.stdout.write(
      `par-fidelity: bundled ${report.scenarios?.length ?? 0} scenarios + ` +
        `${Object.keys(profiles).length} profiles → ${OUTPUT_PATH}\n`,
    );
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : 'unknown read failure';
    process.stderr.write(
      `par-fidelity copy warning: could not read/parse ${REPORT_SOURCE_PATH} (detail: ${detail}); ` +
        'writing an empty stub so the PAR Fidelity panel renders its empty state rather than failing the build.\n',
    );
    try {
      await mkdir(dirname(OUTPUT_PATH), { recursive: true });
      const stub = { report: EMPTY_REPORT, profiles: {}, error: String(detail).slice(0, 240) };
      await writeFile(OUTPUT_PATH, `${JSON.stringify(stub, null, 2)}\n`, 'utf-8');
    } catch {
      // why: best-effort write — even if persistence fails we continue so the build
      // runner stays alive; the panel renders its load-error state.
    }
  }
}

await buildBundle();
