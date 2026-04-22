/**
 * Legendary Arena — Vision Alignment Audit: Orchestrator
 *
 * Combines the four domain grep scripts (determinism, monetization,
 * registry, engine-boundary) under `scripts/audit/vision/` into a single
 * PASS/FAIL verdict, writes a combined audit report to
 * `docs/audits/vision-alignment-{YYYY-MM-DD}.md`, and exits 0 on PASS
 * or 1 on FAIL.
 *
 * WP-085 Scope (In) §A locks the behavior:
 * - Read-only against `packages/` and `apps/` — the orchestrator reads
 *   the six DET-001 allowlist files to verify doc-comment form but
 *   imports no engine, registry, server, or UI module.
 * - Captures the audited commit hash via `git rev-parse HEAD` once at
 *   start; subsequent per-rule greps observe that same tree.
 * - Refuses to overwrite an existing same-day report (audit-history
 *   immutability — see `refuseOnSameDayCollision`).
 * - Baseline contract values (6 / 4 / 0 / 0 / 0) appear as named
 *   constants; no magic numbers in comparison code.
 *
 * Two-channel DET-001 model:
 * - Script channel: `determinism.greps.mjs` applies a comment-aware
 *   filter and must report 0 executable findings on `main`.
 * - Orchestrator channel: this file reads each of the six allowlist
 *   file:line pairs and verifies the line is a doc-comment. Exactly
 *   six matches = baseline; anything else is FAIL.
 *
 * DET-007 is single-channel by design; doc-comment hits carry equal
 * audit meaning and must remain visible.
 *
 * Run via: node scripts/audit/vision/run-all.mjs
 *
 * Authority: WP-085 + EC-085 + D-8501. Vision trailer locked as
 * `Vision: §3, §13, §14, §22, §24` per AC-10.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, constants as fsConstants, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  RULES as DETERMINISM_RULES,
  runRules as runDeterminismRules,
  isDocCommentLine,
} from './determinism.greps.mjs';
import {
  RULES as MONETIZATION_RULES,
  runRules as runMonetizationRules,
} from './monetization.greps.mjs';
import {
  RULES as REGISTRY_RULES,
  runRules as runRegistryRules,
} from './registry.greps.mjs';
import {
  RULES as ENGINE_BOUNDARY_RULES,
  runRules as runEngineBoundaryRules,
} from './engine-boundary.greps.mjs';

const execFileAsync = promisify(execFile);

/**
 * Calibrated baseline captured on `main` at INFRA `24996a9`.
 * Source of truth: WP-085 Scope (In) §D and EC-085 Locked Values.
 * Any change to these constants requires a new SPEC decision and a
 * superseding corrective WP per WP-085 AC-6.
 */
const EXPECTED_DET_001 = 6;
const EXPECTED_DET_007 = 4;
const EXPECTED_MONETIZATION = 0;
const EXPECTED_REGISTRY = 0;
const EXPECTED_ENGINE_BOUNDARY = 0;

/**
 * Exact file:line pairs where DET-001 doc-comment baseline exceptions
 * are permitted. Each must be a JSDoc or single-line comment warning
 * against runtime `Math.random` use. Any deviation is a FAIL per AC-3.
 */
const DET_001_ALLOWLIST = [
  'packages/game-engine/src/moves/coreMoves.impl.ts:10',
  'packages/game-engine/src/moves/zoneOps.ts:5',
  'packages/game-engine/src/setup/shuffle.ts:5',
  'packages/game-engine/src/simulation/ai.legalMoves.ts:9',
  'packages/game-engine/src/simulation/ai.random.ts:9',
  'packages/game-engine/src/simulation/simulation.runner.ts:10',
];

/**
 * Exact file:line pairs where DET-007 warnings (wall-clock reads) are
 * permitted. Each must be snapshot or version metadata — never
 * gameplay logic. Any deviation is a FAIL per AC-4.
 */
const DET_007_ALLOWLIST = [
  'packages/game-engine/src/persistence/persistence.types.ts:75',
  'packages/game-engine/src/persistence/snapshot.create.ts:86',
  'packages/game-engine/src/persistence/snapshot.create.ts:90',
  'packages/game-engine/src/versioning/versioning.stamp.ts:59',
];

const VISION_TRAILER = 'Vision: §3, §13, §14, §22, §24';
const REPORT_DIRECTORY = 'docs/audits';

/**
 * Captures the current HEAD commit hash once at the start of the run.
 * Subsequent per-rule greps observe the same tree.
 *
 * @returns {Promise<string>} Full 40-character SHA of HEAD.
 */
async function captureHead() {
  const result = await execFileAsync('git', ['rev-parse', 'HEAD']);
  return result.stdout.trim();
}

/**
 * Returns today's local date as a `YYYY-MM-DD` string.
 *
 * @returns {string} Local-date stamp used for the report filename.
 */
function localDateString() {
  // why: local date reflects when the operator ran the audit on this
  // host. Using toISOString() would yield UTC, which can classify the
  // same operator run as "tomorrow" or "yesterday" depending on zone.
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tests whether the given path exists. Used to refuse same-day report
 * overwrites without racing.
 *
 * @param {string} candidatePath - Filesystem path to test.
 * @returns {Promise<boolean>} True if the path exists, false otherwise.
 */
async function pathExists(candidatePath) {
  try {
    await access(candidatePath, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Refuses to continue if a same-day audit report already exists.
 * Exits the process with code 1 and a full-sentence error message.
 *
 * @param {string} reportPath - Target report path for today.
 * @returns {Promise<void>}
 */
async function refuseOnSameDayCollision(reportPath) {
  if (!(await pathExists(reportPath))) {
    return;
  }
  // why: audit reports are point-in-time witnesses. Permitting an
  // overwrite would let a later run erase or amend an earlier verdict,
  // destroying the report's role as an immutable record. Corrective
  // action for a bad report is a new corrective WP per WP-085 AC-6,
  // not an in-place overwrite on the same date.
  console.error(
    `Vision alignment audit refuses to overwrite the existing same-day report at ${reportPath}. ` +
      'Audit-history immutability requires that each calendar date carries exactly one verdict. ' +
      'If the existing report is wrong, ship a corrective WP per WP-085 AC-6 instead of rerunning.',
  );
  process.exit(1);
}

/**
 * Shells out to `git grep -n -P` for a single rule and returns the
 * matching lines. Exit code 1 with empty stdout (git grep's "no
 * matches" state) is translated to an empty result array.
 *
 * @param {object} rule - Rule object with `pattern`, `paths`, `excludePaths`.
 * @returns {Promise<string[]>} Raw output lines in `path:lineno:content` form.
 */
async function runRuleGrep(rule) {
  const args = ['grep', '-n', '-P', '-e', rule.pattern, '--'];
  for (const targetPath of rule.paths) {
    args.push(targetPath);
  }
  for (const excludePattern of rule.excludePaths) {
    args.push(`:(exclude,glob)${excludePattern}`);
  }
  let stdout = '';
  try {
    const result = await execFileAsync('git', args, { maxBuffer: 8 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (error) {
    // why: git grep exits 1 when no matches are found — treat that as
    // zero findings, not an execution failure.
    if (error.code === 1 && (!error.stdout || error.stdout.length === 0)) {
      return [];
    }
    throw error;
  }
  return stdout.split('\n').filter((line) => line.length > 0);
}

/**
 * Scans every rule in a domain and aggregates structured counts.
 * Applies the DET-001 comment-aware filter when `applyDet001Filter`
 * is true (determinism domain only).
 *
 * @param {string} domainLabel - Human-readable domain name for the report.
 * @param {ReadonlyArray<object>} rules - Rule array imported from a domain script.
 * @param {boolean} applyDet001Filter - Apply comment-aware filter for DET-001.
 * @returns {Promise<object>} Aggregated per-rule + domain-level counts.
 */
async function scanDomain(domainLabel, rules, applyDet001Filter) {
  const perRule = [];
  let critical = 0;
  let warning = 0;
  for (const rule of rules) {
    let lines = await runRuleGrep(rule);
    if (applyDet001Filter && rule.id === 'DET-001') {
      lines = lines.filter((rawLine) => !isDocCommentLine(rawLine));
    }
    const ruleCritical = rule.severity === 'critical' ? lines.length : 0;
    const ruleWarning = rule.severity === 'warning' ? lines.length : 0;
    perRule.push({
      id: rule.id,
      severity: rule.severity,
      count: lines.length,
      lines,
    });
    critical += ruleCritical;
    warning += ruleWarning;
  }
  return { domainLabel, perRule, critical, warning };
}

/**
 * Reads each DET-001 allowlist file and confirms the referenced line
 * exists and is a doc-comment (JSDoc, block comment, or line comment).
 *
 * @returns {Promise<object[]>} Per-entry verification results.
 */
async function verifyDet001Allowlist() {
  const results = [];
  for (const allowlistEntry of DET_001_ALLOWLIST) {
    const separatorIndex = allowlistEntry.indexOf(':');
    const filePath = allowlistEntry.slice(0, separatorIndex);
    const lineNumber = Number(allowlistEntry.slice(separatorIndex + 1));
    let exists = false;
    let isComment = false;
    let content = '';
    let errorMessage = '';
    try {
      const fileContents = await readFile(filePath, 'utf8');
      const fileLines = fileContents.split('\n');
      if (lineNumber >= 1 && lineNumber <= fileLines.length) {
        exists = true;
        content = fileLines[lineNumber - 1];
        const trimmed = content.replace(/^\s+/, '');
        isComment =
          trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
      } else {
        errorMessage = `Line ${lineNumber} is outside the file's ${fileLines.length}-line range.`;
      }
    } catch (error) {
      errorMessage = `Failed to read ${filePath} for DET-001 allowlist verification: ${error.message}. Check that the file still exists at the calibrated line reference (INFRA 24996a9).`;
    }
    results.push({
      entry: allowlistEntry,
      filePath,
      lineNumber,
      exists,
      isComment,
      content,
      errorMessage,
    });
  }
  return results;
}

/**
 * Compares DET-007 grep output against the fixed allowlist. Produces
 * separate lists of missing and unexpected pairs so the report can
 * enumerate each failure precisely.
 *
 * @param {string[]} lines - Raw `path:lineno:content` lines from DET-007 grep.
 * @returns {{ missing: string[], extra: string[] }}
 */
function verifyDet007AllowlistAgainstLines(lines) {
  const observed = new Set();
  for (const line of lines) {
    const firstColon = line.indexOf(':');
    if (firstColon < 0) {
      continue;
    }
    const secondColon = line.indexOf(':', firstColon + 1);
    if (secondColon < 0) {
      continue;
    }
    observed.add(line.slice(0, secondColon));
  }
  const expected = new Set(DET_007_ALLOWLIST);
  const missing = [];
  const extra = [];
  for (const allowlistEntry of expected) {
    if (!observed.has(allowlistEntry)) {
      missing.push(allowlistEntry);
    }
  }
  for (const observedEntry of observed) {
    if (!expected.has(observedEntry)) {
      extra.push(observedEntry);
    }
  }
  return { missing, extra };
}

/**
 * Formats a per-scan section of the combined audit report.
 *
 * @param {string} domainLabel - Section heading text.
 * @param {object} scan - scanDomain() result.
 * @returns {string} Markdown-formatted section including rule breakdown.
 */
function formatPerScanSection(domainLabel, scan) {
  const lines = [];
  lines.push(`## ${domainLabel}`);
  lines.push('');
  lines.push(`- Critical findings: ${scan.critical}`);
  lines.push(`- Warning findings: ${scan.warning}`);
  lines.push('');
  lines.push('Per-rule counts:');
  lines.push('');
  for (const rule of scan.perRule) {
    lines.push(`- ${rule.id} (${rule.severity}): ${rule.count}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Builds the full combined audit report as a Markdown string.
 *
 * @param {object} context - Aggregated data from the full run.
 * @returns {string} Report contents ready to write.
 */
function buildReport(context) {
  const lines = [];
  lines.push(`# Vision Alignment Audit — ${context.date}`);
  lines.push('');
  lines.push(`**Audited commit:** \`${context.commitHash}\``);
  lines.push('');
  lines.push(
    '**Calibrated baseline (locked contract):** 6 DET-001 / 4 DET-007 / 0 Monetization / 0 Registry / 0 Engine boundary. ' +
      'Source: INFRA `24996a9` on `main`. Any deviation is a FAIL per WP-085 AC-2. ' +
      'Re-calibration requires a new SPEC decision and a superseding WP per AC-6 — never an in-place edit.',
  );
  lines.push('');
  lines.push(`**Report authority:** WP-085 + EC-085 + D-8501.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push(formatPerScanSection('Determinism', context.determinism));

  lines.push('## DET-001 Two-Channel Decomposition');
  lines.push('');
  lines.push(
    `- DET-001 composite count: ${context.det001Composite} (expected ${EXPECTED_DET_001}).`,
  );
  lines.push(
    `- DET-001 executable findings (script channel, post comment-aware filter): ${context.det001ScriptChannelExecutable}.`,
  );
  lines.push(
    `- DET-001 baseline exceptions (orchestrator channel, doc-comment allowlist): ${context.det001AllowlistMatchCount}.`,
  );
  lines.push('');
  lines.push(
    'Any executable DET-001 hit reported by the script channel is an automatic FAIL, ' +
      'even if its file:line would match an allowlist entry — executable use is never permitted (WP-085 AC-3).',
  );
  lines.push('');

  lines.push('## DET-001 Baseline Exceptions (Allowlist — WP-085 AC-3)');
  lines.push('');
  lines.push('The six file:line pairs below are the locked baseline exceptions. Each must be a JSDoc or single-line comment warning against runtime `Math.random` use. Any deviation is a FAIL.');
  lines.push('');
  for (const entry of context.det001Allowlist) {
    const status = entry.exists && entry.isComment ? 'OK' : 'FAIL';
    const note = entry.exists && entry.isComment
      ? 'doc-comment verified'
      : entry.errorMessage || 'content is not a comment';
    lines.push(`- [${status}] \`${entry.entry}\` — ${note}`);
  }
  lines.push('');

  lines.push(formatPerScanSection('Monetization', context.monetization));
  lines.push(formatPerScanSection('Registry', context.registry));
  lines.push(formatPerScanSection('Engine boundary', context.engineBoundary));

  lines.push('## DET-007 Allowlist (Single Channel — WP-085 AC-4)');
  lines.push('');
  lines.push('The four file:line pairs below are the locked wall-clock metadata sites. DET-007 does not apply comment-aware filtering — doc-comment occurrences carry equal audit meaning to executable occurrences. Any deviation is a FAIL.');
  lines.push('');
  for (const allowlistEntry of DET_007_ALLOWLIST) {
    lines.push(`- \`${allowlistEntry}\``);
  }
  lines.push('');
  if (context.det007AllowlistDiff.missing.length > 0) {
    lines.push(`**Missing allowlisted pairs (FAIL):** ${context.det007AllowlistDiff.missing.join(', ')}`);
    lines.push('');
  }
  if (context.det007AllowlistDiff.extra.length > 0) {
    lines.push(`**Unexpected pairs outside the allowlist (FAIL):** ${context.det007AllowlistDiff.extra.join(', ')}`);
    lines.push('');
  }

  lines.push('## Verdict');
  lines.push('');
  if (context.failures.length === 0) {
    lines.push(
      'All baseline values matched exactly. No regressions against the INFRA `24996a9` calibration.',
    );
  } else {
    lines.push('The following deviations were observed:');
    lines.push('');
    for (const failure of context.failures) {
      lines.push(`- ${failure}`);
    }
  }
  lines.push('');
  lines.push(`VERDICT: ${context.verdict}`);
  lines.push('');
  lines.push(VISION_TRAILER);
  lines.push('');
  return lines.join('\n');
}

/**
 * Main orchestration entrypoint. Runs each domain's own `runRules` for
 * human-readable stdout output, performs a structured scan for report
 * data, verifies allowlists, writes the combined report, and exits.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const reportDate = localDateString();
  const reportPath = join(REPORT_DIRECTORY, `vision-alignment-${reportDate}.md`);

  await refuseOnSameDayCollision(reportPath);

  const commitHash = await captureHead();

  console.log('=== Vision Alignment Audit ===');
  console.log(`Audited commit: ${commitHash}`);
  console.log(`Report path:    ${reportPath}`);
  console.log('');

  console.log('--- determinism.greps.mjs ---');
  await runDeterminismRules();
  console.log('');
  console.log('--- monetization.greps.mjs ---');
  await runMonetizationRules();
  console.log('');
  console.log('--- registry.greps.mjs ---');
  await runRegistryRules();
  console.log('');
  console.log('--- engine-boundary.greps.mjs ---');
  await runEngineBoundaryRules();
  console.log('');

  const determinism = await scanDomain('Determinism', DETERMINISM_RULES, true);
  const monetization = await scanDomain('Monetization', MONETIZATION_RULES, false);
  const registry = await scanDomain('Registry', REGISTRY_RULES, false);
  const engineBoundary = await scanDomain('Engine boundary', ENGINE_BOUNDARY_RULES, false);

  const det001Rule = determinism.perRule.find((rule) => rule.id === 'DET-001');
  const det001ScriptChannelExecutable = det001Rule.count;

  const det001Allowlist = await verifyDet001Allowlist();
  const det001AllowlistMatchCount = det001Allowlist.filter(
    (entry) => entry.exists && entry.isComment,
  ).length;
  const det001Composite = det001ScriptChannelExecutable + det001AllowlistMatchCount;

  const det007Rule = determinism.perRule.find((rule) => rule.id === 'DET-007');
  const det007AllowlistDiff = verifyDet007AllowlistAgainstLines(det007Rule.lines);

  const monetizationTotal = monetization.critical + monetization.warning;
  const registryTotal = registry.critical + registry.warning;
  const engineBoundaryTotal = engineBoundary.critical + engineBoundary.warning;

  const failures = [];
  if (det001ScriptChannelExecutable !== 0) {
    failures.push(
      `DET-001 script channel reported ${det001ScriptChannelExecutable} executable finding(s); expected 0 after comment-aware filter.`,
    );
  }
  if (det001AllowlistMatchCount !== EXPECTED_DET_001) {
    failures.push(
      `DET-001 allowlist verification matched ${det001AllowlistMatchCount} of ${EXPECTED_DET_001} expected doc-comment pairs. Check AC-3 allowlist entries for drift.`,
    );
  }
  if (det001Composite !== EXPECTED_DET_001) {
    failures.push(
      `DET-001 composite count ${det001Composite} does not equal the calibrated baseline ${EXPECTED_DET_001}.`,
    );
  }
  if (det007Rule.count !== EXPECTED_DET_007) {
    failures.push(
      `DET-007 produced ${det007Rule.count} finding(s); expected ${EXPECTED_DET_007}.`,
    );
  }
  if (det007AllowlistDiff.missing.length > 0 || det007AllowlistDiff.extra.length > 0) {
    failures.push(
      `DET-007 findings do not match the AC-4 allowlist exactly. Missing: [${det007AllowlistDiff.missing.join(', ')}]; extra: [${det007AllowlistDiff.extra.join(', ')}].`,
    );
  }
  if (monetizationTotal !== EXPECTED_MONETIZATION) {
    failures.push(
      `Monetization produced ${monetizationTotal} finding(s) (critical + warning); expected ${EXPECTED_MONETIZATION}. Any finding is a FAIL per AC-5.`,
    );
  }
  if (registryTotal !== EXPECTED_REGISTRY) {
    failures.push(
      `Registry produced ${registryTotal} finding(s) (critical + warning); expected ${EXPECTED_REGISTRY}. Any finding is a FAIL per AC-5.`,
    );
  }
  if (engineBoundaryTotal !== EXPECTED_ENGINE_BOUNDARY) {
    failures.push(
      `Engine boundary produced ${engineBoundaryTotal} finding(s) (critical + warning); expected ${EXPECTED_ENGINE_BOUNDARY}. Any finding is a FAIL per AC-5.`,
    );
  }

  const verdict = failures.length === 0 ? 'PASS' : 'FAIL';

  const reportBody = buildReport({
    commitHash,
    date: reportDate,
    determinism,
    monetization,
    registry,
    engineBoundary,
    det001Allowlist,
    det001ScriptChannelExecutable,
    det001AllowlistMatchCount,
    det001Composite,
    det007AllowlistDiff,
    verdict,
    failures,
  });

  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(reportPath, reportBody, 'utf8');

  console.log('---');
  console.log(`VERDICT: ${verdict}`);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(` - ${failure}`);
    }
  }
  console.log(`Report written to: ${reportPath}`);

  process.exit(failures.length === 0 ? 0 : 1);
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(
      `Vision alignment orchestrator failed with an unexpected error: ${error.message}. ` +
        'Investigate before re-running; do not fabricate a PASS verdict from a failed run.',
    );
    process.exit(1);
  });
}
