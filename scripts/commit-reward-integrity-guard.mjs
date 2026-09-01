/**
 * Reward-integrity commit guard (per D-24444).
 *
 * Enforces the two prefix-keyed rules from the Reward Integrity section of
 * `.claude/CLAUDE.md`, for EC-### (code-execution) commits only:
 *
 *   Guard A — an EC commit may not change an enforcement or permission file
 *     (`.githooks/`, CI workflows, `.claude/` settings / rules / CLAUDE.md).
 *     Silencing a check to make a change pass is the "disable the reward-hacking
 *     monitor" failure mode; such edits must land as a reviewed INFRA: commit.
 *
 *   Guard B — an EC commit that MODIFIES an existing `*.test.ts` file without
 *     also staging a non-test source change requires a `Tests-changed:` trailer.
 *     Editing a test but no code is the fingerprint of weakening an assertion to
 *     match a bug; the trailer forces a conscious, auditable justification.
 *
 * INFRA: and SPEC: commits are exempt — enforcement, tooling, and governance
 * legitimately change there and go through their own review.
 *
 * The pure `evaluateCommitForRewardIntegrity()` below is the single source of
 * logic for BOTH enforcement sites — `.githooks/commit-msg` (local, staged
 * files) and the `reward-integrity` job in `.github/workflows/commit-hygiene.yml`
 * (CI, per-commit files) — so the two copies cannot drift. It is covered
 * directly by `scripts/commit-reward-integrity-guard.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// why: an EC subject is the only prefix these guards apply to; INFRA:/SPEC: are
// where enforcement, tooling, and governance are supposed to change. The
// [A-Za-z]? suffix mirrors .githooks/commit-msg (EC-053a / EC-007A forms).
const EC_SUBJECT_PATTERN = /^EC-[0-9]+[A-Za-z]?:/;
const TEST_FILE_PATTERN = /\.test\.ts$/;

// why: a git-trailer line stating why an existing test changed. Matched
// multi-line and case-insensitively on the leading token so "Tests-changed:"
// anywhere in the body counts.
const TESTS_CHANGED_TRAILER_PATTERN = /^tests-changed:/im;

/**
 * Reports whether a repo-relative path is an enforcement or permission file
 * that an EC-### (code-execution) commit must not change.
 *
 * @param {string} path - Repo-relative file path, forward-slashed.
 * @returns {boolean} True when the path is an enforcement/permission file.
 */
function isEnforcementPath(path) {
  if (path.startsWith('.githooks/')) {
    return true;
  }
  if (path.startsWith('.github/workflows/')) {
    return true;
  }
  if (path.startsWith('.claude/rules/')) {
    return true;
  }
  if (path === '.claude/CLAUDE.md') {
    return true;
  }
  if (path === '.claude/settings.json' || path === '.claude/settings.local.json') {
    return true;
  }
  return false;
}

/**
 * Reports whether a path is a production/source file (under `packages/` or
 * `apps/`) that is NOT itself a test file. Used to tell a test-only change
 * apart from a normal code-plus-test change.
 *
 * @param {string} path - Repo-relative file path, forward-slashed.
 * @returns {boolean} True when the path is non-test source under packages/ or apps/.
 */
function isNonTestSource(path) {
  const isUnderSource = path.startsWith('packages/') || path.startsWith('apps/');
  return isUnderSource && !TEST_FILE_PATTERN.test(path);
}

/**
 * Evaluates a single commit against the reward-integrity guards.
 *
 * @param {{ subject: string, message: string, files: Array<{status: string, path: string}> }} commit
 *   The commit subject, its full message (for trailer detection), and its
 *   changed files with single-letter git status codes (A/M/R/C/D).
 * @returns {{ ok: boolean, violations: string[] }} Whether the commit passes,
 *   and a full-sentence description of each violation.
 */
export function evaluateCommitForRewardIntegrity(commit) {
  const violations = [];

  // why: only EC-### code-execution commits are guarded (see EC_SUBJECT_PATTERN).
  if (!EC_SUBJECT_PATTERN.test(commit.subject)) {
    return { ok: true, violations };
  }

  // Guard A — enforcement/permission files touched by a code-execution commit.
  const touchedEnforcementFiles = [];
  for (const changedFile of commit.files) {
    if (isEnforcementPath(changedFile.path)) {
      touchedEnforcementFiles.push(changedFile.path);
    }
  }
  if (touchedEnforcementFiles.length > 0) {
    violations.push(
      'This EC-### (code-execution) commit changes enforcement or permission ' +
        `file(s): ${touchedEnforcementFiles.join(', ')}. A code commit must not ` +
        'edit the hooks, CI workflows, or .claude settings/rules that grade it — ' +
        'that is how a monitor gets silenced. Move these edits into a separate, ' +
        'reviewed INFRA: commit.',
    );
  }

  // Guard B — an existing test modified with no accompanying source change.
  const modifiedTestFiles = [];
  let hasNonTestSourceChange = false;
  for (const changedFile of commit.files) {
    if (changedFile.status === 'M' && TEST_FILE_PATTERN.test(changedFile.path)) {
      modifiedTestFiles.push(changedFile.path);
    }
    if (isNonTestSource(changedFile.path)) {
      hasNonTestSourceChange = true;
    }
  }
  const hasTestsChangedTrailer = TESTS_CHANGED_TRAILER_PATTERN.test(commit.message);
  if (modifiedTestFiles.length > 0 && !hasNonTestSourceChange && !hasTestsChangedTrailer) {
    violations.push(
      'This EC-### commit modifies existing test file(s) without changing any ' +
        `non-test source: ${modifiedTestFiles.join(', ')}. Editing a test but no ` +
        'code is how an assertion gets weakened to match a bug. If the change is ' +
        'legitimate (a genuinely wrong test, or a re-recorded fixture after an ' +
        'intentional engine change), add a "Tests-changed: <reason>" trailer to ' +
        'the commit message to record why.',
    );
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Parses `git ... --name-status` output into {status, path} records. Handles
 * rename/copy lines (`R100<TAB>old<TAB>new`) by taking the destination path.
 *
 * @param {string} nameStatusText - Raw name-status output.
 * @returns {Array<{status: string, path: string}>} Parsed change records.
 */
export function parseNameStatus(nameStatusText) {
  const records = [];
  for (const rawLine of nameStatusText.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }
    const fields = line.split('\t');
    // why: a rename/copy line is "R100<TAB>old<TAB>new"; the destination path is
    // the last field and the git status is the leading letter (R, C, M, A, D).
    const status = fields[0].charAt(0);
    const path = fields[fields.length - 1];
    records.push({ status, path });
  }
  return records;
}

/**
 * CLI entry: `node commit-reward-integrity-guard.mjs "<subject>" <messageFile>`
 * with `git ... --name-status` output piped on stdin. Exits 1 with a report
 * when the commit violates a guard, 0 otherwise.
 *
 * @returns {void}
 */
function runCli() {
  const subject = process.argv[2] ?? '';
  const messageFilePath = process.argv[3];

  let message = '';
  if (messageFilePath) {
    try {
      message = readFileSync(messageFilePath, 'utf8');
    } catch (readFailure) {
      // why: a missing/unreadable message file only disables the Tests-changed
      // trailer check; fail open on the message rather than crash the commit.
      message = '';
    }
  }

  // why: fd 0 is the piped `git --name-status` output; the callers always pipe.
  const stdinText = readFileSync(0, 'utf8');
  const files = parseNameStatus(stdinText);

  const result = evaluateCommitForRewardIntegrity({ subject, message, files });
  if (!result.ok) {
    process.stderr.write('\nCOMMIT BLOCKED — reward-integrity guard:\n');
    for (const violation of result.violations) {
      process.stderr.write(`  - ${violation}\n`);
    }
    process.stderr.write(
      '\nSee the Reward Integrity section of .claude/CLAUDE.md and ' +
        'wiki/reward-integrity.md. Emergency bypass: git commit --no-verify ' +
        '(itself discouraged by that same section).\n\n',
    );
    process.exit(1);
  }
  process.exit(0);
}

// why: run the CLI only when this file is invoked directly, so the test file can
// import the pure functions without triggering a blocking stdin read or exit.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
