/**
 * check-card-data-regen.mjs
 *
 * Card-data regen reproducibility gate (WP-633 / D-24443). Seeds a throwaway
 * scratch directory from the committed data/cards corpus, runs all five pipeline
 * stages into it via the shared CARD_OUTPUT_DIR (driven by CARD_DATA_OUT_DIR),
 * and semantic-diffs the regenerated corpus against committed. A clean regen must
 * be SEMANTICALLY identical to committed for every pipeline-generated set.
 *
 * Semantic equality = deep-equal after JSON parse with object keys reordered but
 * arrays compared order-sensitively (entry order is meaningful); whitespace,
 * indentation, and line endings are ignored. Byte equality is NOT required —
 * committed formatting is intentionally not normalized.
 *
 * The gate is NON-DESTRUCTIVE: it never writes to the committed data/cards, and
 * FAIL-FAST: it refuses to run if the scratch directory would resolve to the real
 * corpus, so a wiring bug can never clobber committed files.
 *
 * co2e is hand-authored (no converter source) and is excluded from the compared
 * set — no stage regenerates it.
 *
 * Modes:
 *   (default)  — regenerate + report; exit 0 even on divergence (informational).
 *   --check    — regenerate + report; exit 1 on any semantic divergence (CI gate).
 *
 * Usage:
 *   node scripts/check-card-data-regen.mjs
 *   node scripts/check-card-data-regen.mjs --check
 */

import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(scriptDir, '..');
const COMMITTED_DIR = join(REPO_ROOT, 'data', 'cards');
const CONVERT_DIR = join(scriptDir, 'convert-cards');

// why: co2e is hand-authored 2nd-edition data with no upstream converter source;
// no pipeline stage writes it, so a seeded copy would only ever be "compared to
// itself". Excluded from the generated set entirely (D-24443).
const EXCLUDED_SETS = new Set(['co2e']);

// why: the five stages in their fixed pipeline order — convert seeds the 36
// source-backed sets, then the four apply-* passes overlay markers/counts in the
// same directory. Each reads AND writes the corpus via the shared CARD_OUTPUT_DIR.
const PIPELINE_STAGES = [
  'convert-cards-v15.mjs',
  'apply-card-counts.mjs',
  'apply-hero-ability-markers.mjs',
  'apply-effect-markers.mjs',
  'apply-defeat-requirement-markers.mjs',
];

/**
 * Collects every leaf of a parsed JSON value into a flat map of path → value.
 * Object keys are visited in sorted order (so key ordering does not matter), and
 * array element paths carry their index plus a synthetic length leaf (so arrays
 * are compared order-sensitively and length changes are caught).
 *
 * @param {*} value - The parsed JSON value.
 * @param {string} path - The accumulated leaf path.
 * @param {Map<string, string>} out - The accumulator (path → JSON-encoded value).
 */
function collectLeaves(value, path, out) {
  if (Array.isArray(value)) {
    out.set(`${path}#length`, String(value.length));
    for (let index = 0; index < value.length; index++) {
      collectLeaves(value[index], `${path}[${index}]`, out);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      collectLeaves(value[key], path ? `${path}.${key}` : key, out);
    }
  } else {
    out.set(path, JSON.stringify(value));
  }
}

/**
 * Semantic-diffs two parsed set objects, returning a sorted list of leaf paths
 * whose values differ (committed vs regenerated).
 *
 * @param {object} committed - The committed set object.
 * @param {object} regenerated - The regenerated set object.
 * @returns {{ path: string, committed: string, regenerated: string }[]} The diffs.
 */
function diffSet(committed, regenerated) {
  const committedLeaves = new Map();
  const regeneratedLeaves = new Map();
  collectLeaves(committed, '', committedLeaves);
  collectLeaves(regenerated, '', regeneratedLeaves);

  const allPaths = new Set([...committedLeaves.keys(), ...regeneratedLeaves.keys()]);
  const diffs = [];
  for (const path of allPaths) {
    const committedValue = committedLeaves.get(path);
    const regeneratedValue = regeneratedLeaves.get(path);
    if (committedValue !== regeneratedValue) {
      diffs.push({
        path,
        committed: committedValue ?? '(absent)',
        regenerated: regeneratedValue ?? '(absent)',
      });
    }
  }
  diffs.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return diffs;
}

/**
 * Seeds the scratch directory with a copy of every committed set file. The four
 * outlier bases (2099/amwp/wpnx/wtif) and co2e must pre-exist for the pipeline to
 * run — convert emits only the 36 source-backed sets and apply-card-counts throws
 * on a missing outlier base.
 *
 * @param {string} scratchDir - The scratch directory to seed into.
 * @returns {string[]} The committed set file names (e.g. "core.json").
 */
function seedScratchDir(scratchDir) {
  const fileNames = readdirSync(COMMITTED_DIR).filter((name) => name.endsWith('.json'));
  for (const fileName of fileNames) {
    copyFileSync(join(COMMITTED_DIR, fileName), join(scratchDir, fileName));
  }
  return fileNames;
}

/**
 * Runs a single pipeline stage against the scratch directory, loud-failing with
 * the captured stage output if the stage exits non-zero.
 *
 * @param {string} stageFile - The stage script file name under convert-cards/.
 * @param {string} scratchDir - The scratch directory (passed via CARD_DATA_OUT_DIR).
 */
function runStage(stageFile, scratchDir) {
  try {
    execFileSync('node', [join(CONVERT_DIR, stageFile)], {
      env: { ...process.env, CARD_DATA_OUT_DIR: scratchDir },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error) {
    const stderrText = error.stderr ? error.stderr.toString() : '';
    throw new Error(
      `Pipeline stage "${stageFile}" failed while regenerating into the scratch directory ` +
        `${scratchDir}. Stage stderr:\n${stderrText}`,
    );
  }
}

/**
 * Entry point: seed → regenerate → semantic-diff → report. Fail-fast if the
 * scratch directory would be the committed corpus; non-destructive otherwise.
 */
function main() {
  const isCheck = process.argv.includes('--check');

  const scratchDir = mkdtempSync(join(tmpdir(), 'legendary-cards-regen-'));

  // why: fail-fast — the scratch directory the stages write to must NEVER be the
  // real committed corpus, or a regen would clobber the canonical files. mkdtemp
  // always yields a fresh OS temp dir, but this guard makes the invariant explicit
  // and refuses to proceed if anything ever resolves it to data/cards (D-24443).
  if (!scratchDir || resolve(scratchDir) === resolve(COMMITTED_DIR)) {
    throw new Error(
      `Refusing to run: the regen scratch directory resolved to the committed corpus ` +
        `(${COMMITTED_DIR}). The gate must regenerate into a throwaway directory so it can ` +
        `never overwrite the canonical data/cards.`,
    );
  }

  try {
    const seededFiles = seedScratchDir(scratchDir);
    for (const stageFile of PIPELINE_STAGES) {
      runStage(stageFile, scratchDir);
    }

    const comparedSets = seededFiles
      .map((name) => name.replace(/\.json$/, ''))
      .filter((abbr) => !EXCLUDED_SETS.has(abbr))
      .sort();

    let divergentSets = 0;
    let totalLeaves = 0;
    for (const abbr of comparedSets) {
      const committed = JSON.parse(readFileSync(join(COMMITTED_DIR, `${abbr}.json`), 'utf8'));
      const regenerated = JSON.parse(readFileSync(join(scratchDir, `${abbr}.json`), 'utf8'));
      const diffs = diffSet(committed, regenerated);
      if (diffs.length === 0) continue;

      divergentSets++;
      totalLeaves += diffs.length;
      console.error(`\n✗ ${abbr}: ${diffs.length} semantic leaf divergence(s)`);
      for (const diff of diffs) {
        console.error(`    ${diff.path}`);
        console.error(`      committed:    ${diff.committed}`);
        console.error(`      regenerated:  ${diff.regenerated}`);
      }
    }

    console.log(
      `\nCard-data regen reproducibility: compared ${comparedSets.length} pipeline set(s) ` +
        `(co2e excluded).`,
    );
    if (divergentSets === 0) {
      console.log('✓ A clean regen is semantically identical to the committed data/cards.');
      return;
    }

    console.error(
      `\n✗ ${divergentSets} set(s) / ${totalLeaves} leaf/leaves diverge from committed. The ` +
        `pipeline no longer reproduces the committed corpus — fix the scripts/inputs (never the ` +
        `committed data) so a regen matches, then re-run.`,
    );
    if (isCheck) {
      process.exit(1);
    }
  } finally {
    // why: always remove the scratch dir so the gate leaves nothing behind and the
    // committed data/cards stays byte-unchanged (non-destructive).
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

main();
