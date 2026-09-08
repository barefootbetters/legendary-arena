/**
 * Legendary Arena — Govern-Close Consistency Guard (WP-671 / EC-708 / D-24485)
 *
 * Fails when a `WORK_INDEX.md` WP row is still unchecked (`- [ ]`) even though
 * the WP has demonstrably EXECUTED. This is the recurring govern-close drift: a
 * burst of execution sessions lands the `EC-###:` implementation commit (and
 * often flips the reserved DECISIONS entry to `Active` and writes the STATUS
 * close-out) but leaves the index rows stale — WORK_INDEX `- [ ]`, mindmap
 * `📝`/`🚧`, EC_INDEX `Ready`. Observed at WP-391, WP-657..665, and WP-669/670.
 *
 *   node scripts/check-workindex-executed-open.mjs   (or: pnpm workindex:executed:check)
 *
 * why: `roadmap:counts:check` cannot catch this because WORK_INDEX and the
 * mindmap go stale TOGETHER — they agree, so the derived open-work count is
 * self-consistent but overstates real open work. The drift needs an INDEPENDENT
 * oracle. This guard is that oracle, mirroring the WP-455 row-grammar guard
 * `check-workindex-rows.mjs` (parse the doc → exit 1 with a full-sentence report
 * / exit 0 clean; `node:fs` only, no new dependency).
 *
 * Two file-only detection signals, scaffold-chosen against real `main` at
 * execution (D-24485) — both pass the acceptance test (exit 0 on clean `main`,
 * catch a synthetic drift, never trip a drafted-open / reserve / template /
 * backlog / WP-042.1 row):
 *
 *   1. A `- [ ]` row whose OWNED DECISIONS entry is `Active`. Owned is keyed on
 *      the literal `reserves **D-NNNNN**` phrase — NOT a bare `**D-NNNNN**`
 *      citation (WP-042.1's "per D-4201" is a hard-dep, not ownership, and must
 *      not false-positive).
 *   2. A `- [ ]` row whose OWN status clause contains executed-text. The clause
 *      is the row's first bold status marker plus its immediately-following
 *      parenthetical — NOT the descriptive prose, so a cross-WP `WP-NNN shipped …`
 *      reference elsewhere in the row does not trip. Tokens are derived from the
 *      REAL drift phrasing (`**Executed 2026-09-08, pending PR**`, WP-669/670).
 *
 * The convention-independent third candidate — a merged `EC-### / WP-NNN:`
 * execution commit — was scaffolded and rejected here only because it needs
 * `fetch-depth: 0` on the CI job and the two file signals already meet the
 * acceptance test; it stays the documented fallback primary (D-24485) if a
 * future drafted-open WP ever carries a premature `Active` owned decision.
 *
 * DETECT-ONLY: this guard never edits WORK_INDEX or DECISIONS. If it fires on
 * `main`, that is real out-of-band drift — reconcile it with a manual `INFRA:`
 * row-flip; never suppress the signal to force exit 0.
 *
 * Exit 0 = consistent; exit 1 = at least one executed-but-open row, with a
 * full-sentence per-`WP-NNN` report naming the tripped signal.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// why: anchor the repo root to this script's own location (the script lives in
// `<repo>/scripts/`) so the check works regardless of the caller's working
// directory — mirrors scripts/check-workindex-rows.mjs.
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const WORK_INDEX_PATH = resolve(REPO_ROOT, 'docs/ai/work-packets/WORK_INDEX.md');
const DECISIONS_PATH = resolve(REPO_ROOT, 'docs/ai/DECISIONS.md');

// why: a WP is allocated by a WORK_INDEX checkbox row that begins `- [ ] WP-NNN`
// or `- [x] WP-NNN` with a real digit. This deliberately does NOT match the
// template placeholder (`- [ ] WP-NNN — Short Title`, literal "NNN") or the
// `- [ ] **(backlog — to be drafted)**` rows (which begin with a bold span, not
// a WP token) — those are non-WP rows and are skipped, per the parsing contract.
const WORK_PACKET_ROW_PATTERN = /^- \[( |x)\] (WP-\d+(?:\.\d+)?) /;

// why: the executed-text token set is derived from the REAL drift phrasing, not
// a hardcoded guess. WP-669/670 drifted as `**Executed 2026-09-08, pending PR**`
// on a `- [ ]` row; `Done`/`Shipped` are the terminal status markers a checked
// row carries, so either appearing on an UNCHECKED row is the same drift. Each
// is matched word-bounded (so e.g. "abandoned" never matches "done") within the
// row's own status clause only.
const EXECUTED_TEXT_PATTERNS = [
  { label: 'executed', pattern: /\bexecuted\b/ },
  { label: 'shipped', pattern: /\bshipped\b/ },
  { label: 'done', pattern: /\bdone\b/ },
  { label: 'pending PR', pattern: /\bpending pr\b/ },
  { label: 'pending commit', pattern: /\bpending commit\b/ },
];

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
      `Could not read ${description} at ${filePath}: ${cause}. If the file moved, update scripts/check-workindex-executed-open.mjs.`,
    );
  }
}

/**
 * Strip a leading UTF-8 byte-order mark (U+FEFF) if present. A char-code check
 * (rather than a literal BOM in a regex) keeps this source free of irregular
 * whitespace. Mirrors scripts/check-workindex-rows.mjs.
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
 * Build the set of DECISIONS entries that are `Active`. An entry is Active when
 * its `### D-NNNNN — … (Active <date> — …)` heading says so, OR a `**Status:**
 * Active` line appears in its body before the next `### ` heading. DECISIONS
 * uses BOTH forms on `main`, so both are read.
 *
 * @param {string} decisionsText the DECISIONS.md text.
 * @returns {Set<string>} the D-numbers (e.g. "D-24484") whose entry is Active.
 */
export function extractActiveDecisionNumbers(decisionsText) {
  const lines = stripLeadingBom(decisionsText).split(/\r?\n/);
  const activeDecisionNumbers = new Set();
  let currentDecisionNumber = null;
  for (const line of lines) {
    const headingMatch = line.match(/^### (D-\d+) — (.*)$/);
    if (headingMatch !== null) {
      currentDecisionNumber = headingMatch[1];
      // why: the heading suffix `(Active <date> — WP/EC)` is the primary Active
      // marker; a Drafted entry omits it and carries a `**Status:** Drafted` line.
      if (/\(Active\b/.test(headingMatch[2])) {
        activeDecisionNumbers.add(currentDecisionNumber);
      }
      continue;
    }
    if (
      currentDecisionNumber !== null &&
      /^\*\*Status:\*\*\s*Active\b/.test(line)
    ) {
      activeDecisionNumbers.add(currentDecisionNumber);
    }
  }
  return activeDecisionNumbers;
}

/**
 * The D-number a WP row OWNS, keyed on the literal `reserves **…D-NNNNN…**`
 * phrase (case-insensitive on "reserves"). A bare `**D-NNNNN**` citation or a
 * "per D-NNNNN" back-reference is NOT ownership — WP-042.1 cites "per D-4201"
 * (a hard-dep) and must not be read as owning an Active decision.
 *
 * @param {string} row a WORK_INDEX WP row.
 * @returns {string | null} the owned D-number, or null if the row reserves none.
 */
export function extractOwnedDecisionNumber(row) {
  const reservesMatch = row.match(/[Rr]eserves \*\*([^*]*)\*\*/);
  if (reservesMatch === null) {
    return null;
  }
  const decisionMatch = reservesMatch[1].match(/D-\d+/);
  return decisionMatch === null ? null : decisionMatch[0];
}

/**
 * The row's OWN status clause, lowercased: its first bold status marker
 * (`**Draft 2026-09-08**`, `**Blocked**`, `**Executed …, pending PR**`) plus an
 * immediately-following parenthetical, if any. Deliberately excludes the
 * descriptive prose, so a cross-WP `WP-NNN shipped …` reference later in the row
 * cannot trip the executed-text signal.
 *
 * @param {string} row a WORK_INDEX WP row.
 * @returns {string} the lowercased status clause (empty if the row has no bold marker).
 */
export function extractOwnStatusClause(row) {
  const boldStart = row.indexOf('**');
  if (boldStart === -1) {
    return '';
  }
  const boldEnd = row.indexOf('**', boldStart + 2);
  if (boldEnd === -1) {
    return '';
  }
  let clause = row.slice(boldStart + 2, boldEnd);
  const afterMarker = row.slice(boldEnd + 2);
  // why: attach the parenthetical only when it IMMEDIATELY follows the marker
  // (allowing whitespace) — WP-042.1's `**Blocked** on Foundation Prompt 03
  // revival (seed runner …)` has prose between the marker and the parenthetical,
  // so that parenthetical is NOT part of the status clause and is not scanned.
  const parentheticalMatch = afterMarker.match(/^\s*\(([^)]*)\)/);
  if (parentheticalMatch !== null) {
    clause = `${clause} ${parentheticalMatch[1]}`;
  }
  return clause.toLowerCase();
}

/**
 * Find every WORK_INDEX `- [ ]` WP row that has demonstrably executed, using the
 * two scaffold-chosen file signals. A `- [x]` row (any decision state) and a
 * legitimately-open `- [ ]` row (Drafted/absent owned decision, no executed-text)
 * both pass. Non-WP rows (template placeholder, backlog) are skipped by the row
 * pattern.
 *
 * @param {string} workIndexText the WORK_INDEX.md text.
 * @param {Set<string>} activeDecisionNumbers the set of Active D-numbers.
 * @returns {{ workPacket: string, trippedSignals: string[] }[]} one entry per violation.
 */
export function findExecutedButOpenRows(workIndexText, activeDecisionNumbers) {
  const lines = stripLeadingBom(workIndexText).split(/\r?\n/);
  const violations = [];
  for (const line of lines) {
    const rowMatch = line.match(WORK_PACKET_ROW_PATTERN);
    if (rowMatch === null) {
      continue;
    }
    const checkboxMark = rowMatch[1];
    const workPacket = rowMatch[2];
    // why: a checked row is the correct closed state — the guard only fires on
    // the UNCHECKED-but-executed inconsistency, never on `- [x]`.
    if (checkboxMark !== ' ') {
      continue;
    }
    const trippedSignals = [];

    const ownedDecisionNumber = extractOwnedDecisionNumber(line);
    if (ownedDecisionNumber !== null && activeDecisionNumbers.has(ownedDecisionNumber)) {
      trippedSignals.push(
        `its owned decision ${ownedDecisionNumber} is Active`,
      );
    }

    const statusClause = extractOwnStatusClause(line);
    const matchedTokens = [];
    for (const executedTextPattern of EXECUTED_TEXT_PATTERNS) {
      if (executedTextPattern.pattern.test(statusClause)) {
        matchedTokens.push(executedTextPattern.label);
      }
    }
    if (matchedTokens.length > 0) {
      trippedSignals.push(
        `its own status clause reads as executed (matched: ${matchedTokens.join(', ')})`,
      );
    }

    if (trippedSignals.length > 0) {
      violations.push({ workPacket, trippedSignals });
    }
  }
  return violations;
}

/**
 * Run the check: read WORK_INDEX + DECISIONS, find executed-but-open rows, print
 * the result, and return a process exit code (0 = consistent, 1 = at least one
 * executed WP left unchecked).
 *
 * @returns {number} the exit code.
 */
function runCheck() {
  const decisionsText = readTextFile(DECISIONS_PATH, 'DECISIONS.md');
  const activeDecisionNumbers = extractActiveDecisionNumbers(decisionsText);
  const workIndexText = readTextFile(WORK_INDEX_PATH, 'WORK_INDEX.md');
  const violations = findExecutedButOpenRows(workIndexText, activeDecisionNumbers);

  if (violations.length === 0) {
    process.stdout.write(
      'WORK_INDEX govern-close consistency check passed: no unchecked (`- [ ]`) WP row is marked executed.\n',
    );
    return 0;
  }

  process.stderr.write(
    `WORK_INDEX govern-close consistency check FAILED: ${violations.length} WP row(s) are still unchecked (\`- [ ]\`) but have demonstrably executed. Flip each row to \`- [x]\` in a govern-close (or reconcile the stale rows with a manual INFRA: catch-up) — this guard is detect-only and never edits the index. Offending row(s):\n`,
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.workPacket} — ${violation.trippedSignals.join('; ')}.\n`,
    );
  }
  return 1;
}

/**
 * Whether this module was run directly (as a script) rather than imported (by
 * its test). Mirrors scripts/check-workindex-rows.mjs.
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
// injected strings, mirroring scripts/check-workindex-rows.mjs.
if (isRunDirectly()) {
  try {
    process.exitCode = runCheck();
  } catch (checkError) {
    const cause = checkError instanceof Error ? checkError.message : String(checkError);
    process.stderr.write(`check-workindex-executed-open failed: ${cause}\n`);
    process.exitCode = 1;
  }
}
