/**
 * Legendary Arena — Local WORK_INDEX Row-Pattern Check (WP-455 / EC-490 / D-24275)
 *
 * A LOCAL, authoring-time mirror of the CI-only WORK_INDEX row-format drift
 * guard. The canonical `WORK_INDEX_ROW_PATTERN` is enforced in CI by the
 * dashboard test `apps/dashboard/src/composables/workIndexRowPattern.test.ts`
 * (inside the "Dashboard Gates" job). That is the only place a drifted row is
 * caught today — so a non-canonical row (e.g. a draft written
 * `**Drafted <date>; not yet executed**` instead of the canonical
 * `**Draft <date>**`) is only discovered after a full CI cycle, and reads
 * confusingly as a coverage failure. This script lets an author catch it in one
 * command before pushing:
 *
 *   node scripts/check-workindex-rows.mjs      (or: pnpm workindex:rows:check)
 *
 * Single source of truth: the canonical pattern is NOT re-typed here. It is
 * extracted at runtime from the same generator the dashboard test reads
 * (`apps/dashboard/scripts/build-governance-snapshot.mjs`), so this check can
 * never drift from the CI guard. This is a mirror, not a replacement — CI
 * remains the enforcing gate.
 *
 * Exit 0 + a full-sentence success line when every WP row conforms; non-zero +
 * the offending rows listed when one has drifted.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// why: anchor the repo root to this script's own location (the script lives in
// `<repo>/scripts/`) so the check works regardless of the caller's working
// directory — mirrors scripts/roadmap-counts.mjs.
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const GENERATOR_PATH = resolve(
  REPO_ROOT,
  'apps/dashboard/scripts/build-governance-snapshot.mjs',
);
const WORK_INDEX_PATH = resolve(REPO_ROOT, 'docs/ai/work-packets/WORK_INDEX.md');

// why: a deliberately loose "is this a WORK_INDEX WP status row" detector —
// checkbox + `WP-NNN` prefix + a bold status token anywhere after it, without
// caring how the connector or date are formatted. It is a candidate FILTER, not
// the canonical contract, so keeping a local copy here (mirroring the dashboard
// test's own `LOOSE_WP_ROW_PATTERN`) introduces no second copy of the
// single-sourced canonical regex. Every line this matches MUST also parse under
// the canonical pattern — that equality is the drift being guarded.
const LOOSE_WP_ROW_PATTERN =
  /^- \[(?:x| )\] WP-\d{3} — .*\*\*(?:Draft|Done|Ready|Blocked)/;

/**
 * Read a UTF-8 text file, raising a full-sentence error (naming the path and the
 * likely fix) instead of a bare `ENOENT` stack when it cannot be read.
 *
 * @param {string} filePath absolute path to read.
 * @param {string} description what the file is, and how to fix a missing one.
 * @returns {string} the file's UTF-8 contents.
 */
function readTextFile(filePath, description) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (readError) {
    const cause = readError instanceof Error ? readError.message : String(readError);
    throw new Error(
      `Could not read ${description} at ${filePath}: ${cause}. If the file moved, update scripts/check-workindex-rows.mjs.`,
    );
  }
}

/**
 * Strip a leading UTF-8 byte-order mark (U+FEFF) if present, mirroring the
 * generator's own BOM handling. A char-code check (rather than a literal BOM in
 * a regex) keeps this source free of irregular whitespace.
 *
 * @param {string} text the raw file text.
 * @returns {string} the text without a leading BOM.
 */
function stripLeadingBom(text) {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Extract the canonical `WORK_INDEX_ROW_PATTERN` from the generator source and
 * rebuild it as a live RegExp — the SAME text-extraction the dashboard test
 * uses.
 *
 * why: the generator (`build-governance-snapshot.mjs`) runs its `main()` at
 * import time, so importing it here would execute the whole snapshot build as a
 * side effect. Reading the source as text and pulling out the single-line regex
 * literal keeps one canonical pattern without that side effect. A rename or
 * reformat of the declaration fails loudly here rather than silently returning a
 * non-matching regex.
 *
 * @param {string} generatorSource the generator file's text.
 * @returns {RegExp} the canonical pattern as a live RegExp.
 */
export function extractCanonicalPattern(generatorSource) {
  const declarationMatch = generatorSource.match(
    /^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m,
  );
  if (declarationMatch === null || declarationMatch[1] === undefined) {
    throw new Error(
      `Could not find the WORK_INDEX_ROW_PATTERN declaration in ${GENERATOR_PATH}; if the constant was renamed or reformatted (e.g. split across lines), update scripts/check-workindex-rows.mjs to match.`,
    );
  }
  return new RegExp(declarationMatch[1]);
}

/**
 * Find every WORK_INDEX WP row that the loose detector recognizes but the
 * canonical pattern does NOT parse — i.e. rows whose format has drifted.
 *
 * @param {string} content the WORK_INDEX.md text.
 * @param {RegExp} canonicalPattern the extracted canonical pattern.
 * @returns {string[]} the offending rows, each truncated to 100 chars.
 */
export function findUnparsedWpRows(content, canonicalPattern) {
  // why: WORK_INDEX.md is a CRLF file; split on `/\r?\n/` (mirroring
  // roadmap-counts.mjs) so a trailing `\r` never leaks into offender output.
  const lines = stripLeadingBom(content).split(/\r?\n/);
  const unparsedRows = [];
  for (const line of lines) {
    if (!LOOSE_WP_ROW_PATTERN.test(line)) {
      continue;
    }
    if (canonicalPattern.exec(line) === null) {
      unparsedRows.push(line.slice(0, 100));
    }
  }
  return unparsedRows;
}

/**
 * Run the check: extract the canonical pattern, validate every WORK_INDEX WP
 * row against it, print the result, and return a process exit code (0 = all
 * rows conform, 1 = at least one drifted).
 *
 * @returns {number} the exit code.
 */
function runCheck() {
  const generatorSource = readTextFile(
    GENERATOR_PATH,
    'the canonical-pattern generator',
  );
  const canonicalPattern = extractCanonicalPattern(generatorSource);
  const workIndexContent = readTextFile(WORK_INDEX_PATH, 'WORK_INDEX.md');
  const unparsedRows = findUnparsedWpRows(workIndexContent, canonicalPattern);

  if (unparsedRows.length === 0) {
    process.stdout.write(
      'WORK_INDEX row check passed: every WP status row parses under the canonical WORK_INDEX_ROW_PATTERN.\n',
    );
    return 0;
  }

  process.stderr.write(
    `WORK_INDEX row check FAILED: ${unparsedRows.length} WP status row(s) do not parse under the canonical WORK_INDEX_ROW_PATTERN — the row format has drifted. Use the canonical bold status form (e.g. **Draft 2026-07-29** or **Done 2026-07-29**). Offending row(s):\n`,
  );
  for (const unparsedRow of unparsedRows) {
    process.stderr.write(`  ${unparsedRow}\n`);
  }
  return 1;
}

/**
 * Whether this module was run directly (as a script) rather than imported (by
 * its test). Mirrors scripts/roadmap-counts.mjs.
 *
 * @returns {boolean}
 */
function isRunDirectly() {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }
  return resolve(invokedPath) === fileURLToPath(import.meta.url);
}

// why: guard the CLI so importing this module (from the unit test) neither runs
// the check nor reads any file — the test exercises the pure helpers with
// injected strings. This is exactly why the dashboard test avoids importing the
// generator: its unguarded top-level main() runs at import.
if (isRunDirectly()) {
  try {
    process.exitCode = runCheck();
  } catch (checkError) {
    const cause = checkError instanceof Error ? checkError.message : String(checkError);
    process.stderr.write(`check-workindex-rows failed: ${cause}\n`);
    process.exitCode = 1;
  }
}
