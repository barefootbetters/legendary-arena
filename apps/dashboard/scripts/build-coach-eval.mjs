#!/usr/bin/env node
/**
 * Dashboard prebuild — coach eval summary for the Evaluator lane.
 *
 * Reads the committed operator report `docs/ai/evaluations/coach-eval-latest.json`
 * (written by `pnpm --filter @legendary-arena/server coach:eval --out ...`) and
 * writes a SLIM summary to the gitignored `src/data/coach-eval.json`:
 * model, run date, totals, and the failed scenarios with their failure sentences.
 * The model-written coaching reports are deliberately NOT copied — the dashboard
 * needs the verdict, not the prose.
 *
 * Never fails the build: a missing report becomes `{ status: 'missing' }` and a
 * malformed one `{ status: 'invalid', error }`, which the Evaluator lane renders
 * as a To Do item.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');

const REPORT_SOURCE_PATH = join(REPO_ROOT, 'docs/ai/evaluations/coach-eval-latest.json');
const SUMMARY_OUTPUT_PATH = join(DASHBOARD_DIR, 'src/data/coach-eval.json');

/**
 * Reduce a full coach-eval report to the slim summary the dashboard renders, or
 * throw a full-sentence error when a required field is missing.
 *
 * @param {unknown} report - The parsed operator report.
 * @returns {object} The slim summary with `status: 'ok'`.
 */
export function summarizeCoachEvalReport(report) {
  if (typeof report !== 'object' || report === null) {
    throw new Error('The coach eval report is not a JSON object.');
  }
  const { model, generatedAt, summary, results } = report;
  if (typeof model !== 'string' || model === '') {
    throw new Error('The coach eval report has no `model`.');
  }
  if (typeof summary !== 'object' || summary === null || typeof summary.totalCount !== 'number') {
    throw new Error('The coach eval report has no `summary` totals.');
  }
  if (!Array.isArray(results)) {
    throw new Error('The coach eval report has no `results` list.');
  }
  const failedScenarios = [];
  for (const result of results) {
    if (result && result.isPassing === false) {
      failedScenarios.push({
        scenarioId: String(result.scenarioId),
        failures: Array.isArray(result.failures) ? result.failures.map(String) : [],
      });
    }
  }
  return {
    status: 'ok',
    model,
    // why: reports written before the generatedAt field existed carry no date;
    // the lane shows "date unknown" rather than inventing one.
    generatedAt: typeof generatedAt === 'string' ? generatedAt : null,
    totalCount: summary.totalCount,
    passedCount: Number(summary.passedCount ?? 0),
    failedCount: Number(summary.failedCount ?? failedScenarios.length),
    failedScenarios,
  };
}

/**
 * Read the report, summarize it, and write the dashboard copy.
 */
async function main() {
  await mkdir(dirname(SUMMARY_OUTPUT_PATH), { recursive: true });
  let summary;
  let raw = null;
  try {
    raw = await readFile(REPORT_SOURCE_PATH, 'utf-8');
  } catch {
    // why: no committed run yet is a normal state (the eval is operator-run and
    // costs money), not a build failure — the lane prompts the operator instead.
    summary = { status: 'missing' };
  }
  if (raw !== null) {
    try {
      summary = summarizeCoachEvalReport(JSON.parse(raw));
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'unknown parse failure';
      summary = { status: 'invalid', error: String(detail).slice(0, 240) };
    }
  }
  await writeFile(SUMMARY_OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  console.log(`Coach eval summary: ${summary.status} → ${SUMMARY_OUTPUT_PATH}`);
}

// why: the helper is exported for reuse; running the file directly performs the
// prebuild. Import-safe guard mirrors the repo's root check scripts.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
