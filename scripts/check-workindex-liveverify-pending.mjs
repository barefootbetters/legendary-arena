/**
 * Legendary Arena — Live-Verify Stale-Row Guard (WP-895 / EC-933 / D-24852)
 *
 * Fails when a done (`- [x]`) `WORK_INDEX.md` WP row still says its D-24026
 * live-verify is pending or partial ("live-verify operator-pending", "D-24026
 * operator-pending", …) even though `docs/ai/coverage/live-verify.json`
 * records that WP as live-verified: at least one entry's `wp` field names the
 * WP, and every entry that names it has `state: "verified"`.
 *
 *   node scripts/check-workindex-liveverify-pending.mjs   (or: pnpm workindex:liveverify:check)
 *
 * why: a live-verify result lands in live-verify.json or a `SPEC:` live-verify
 * PR, and neither one has to touch the WP's WORK_INDEX row — so the row kept
 * saying "operator-pending" after the check passed. The 2026-11-14
 * reconciliation (#3371 / #3373 / #3374) hand-fixed 91 such rows. This guard
 * stops the drift recurring, the way `check-workindex-executed-open.mjs`
 * (WP-671 / D-24485) stopped un-flipped `- [ ]` rows: parse the docs → exit 1
 * with a full-sentence report / exit 0 clean; `node:fs` only, no dependency.
 *
 * A row that says pending and has NO live-verify.json entry, or any entry that
 * is not `verified` (`partial`, `pending`), is legitimately pending and passes:
 * live-verify.json is the only oracle this guard trusts. "Partial" counts as
 * pending too: a row saying "live-verify (D-24026) partial: …" goes stale the
 * same way once every entry for its WP is verified.
 *
 * The guard also fails on a live-verify.json entry that names nothing it
 * verifies (D-24852 follow-up): an entry's `wp` must name a WP (`WP-NNN`), or
 * a direct-fix decision (a `D-NNNNN` whose DECISIONS.md heading says "direct
 * fix" or "no WP"), or say `none (<reason>)`. An empty or PR-only `wp` would
 * hide that entry from its WP's row, so a stale row would pass unseen.
 *
 * What it still cannot see (false negatives only): a pending phrase with no
 * live-verify anchor in the row, one worded without "pending" or "partial"
 * ("deferred", "not yet seen live"), and an entry attributed to a direct-fix
 * D-number when a WP row also owns that mechanic (WP-862's Little Guy line was
 * that case; which owner is right is a judgment call, not a pattern).
 *
 * DETECT-ONLY: this guard never edits WORK_INDEX or live-verify.json. If it
 * fires, rewrite the row's pending phrase to the recorded result (e.g.
 * "D-24026 live-verify PASS <date> per live-verify.json (match `…`)") — never
 * weaken the pattern to force exit 0.
 *
 * Exit 0 = consistent; exit 1 = at least one stale row, with a full-sentence
 * per-`WP-NNN` report naming the pending text and the verified entries.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// why: anchor the repo root to this script's own location (the script lives in
// `<repo>/scripts/`) so the check works from any working directory — mirrors
// scripts/check-workindex-executed-open.mjs.
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const WORK_INDEX_PATH = resolve(REPO_ROOT, 'docs/ai/work-packets/WORK_INDEX.md');
const LIVE_VERIFY_PATH = resolve(REPO_ROOT, 'docs/ai/coverage/live-verify.json');
const DECISIONS_PATH = resolve(REPO_ROOT, 'docs/ai/DECISIONS.md');

// why: only a DONE row can be stale in this sense — an open `- [ ]` row is
// expected to be pending. The real-digit WP token skips the template
// placeholder (`WP-NNN`) and the `**(backlog …)**` rows, as in WP-671.
const DONE_WORK_PACKET_ROW_PATTERN = /^- \[x\] (WP-\d+(?:\.\d+)?) /;

// why: the pending phrasing on real rows varies ("D-24026 live-verify
// operator-pending", "**D-24026 operator-pending**", "(D-24026)
// operator-pending", "live-verify: operator-pending", "D-24026 live-verify ⏳
// PENDING post-deploy", "Post-deploy **D-24026 live-verify** pending",
// "live-on-surface operator-pending", "live-verify (D-24026) partial: X PASS
// …, Y operator-pending"). Every form has a live-verify anchor (`D-24026`,
// `live-verify`/`live verify`, `live-on-surface`) followed, inside the same
// clause, by the word `pending` or `partial`. `partial` joined on
// 2026-11-14 (D-24852 follow-up) once WP-862's last partial mechanic named
// WP-862 in live-verify.json; before that, an honest WP-862 "partial" row had
// only verified entries and would have false-failed. The clause bound keeps a
// later, unrelated "pending" (a pending deploy of another WP, a pending
// backfill) from pairing with an earlier live-verify mention: at most 120
// units, where a unit is any character but `.` or `;`, a dot inside a token
// (`play.legendary-arena.com`, `v1.2`), or a whole `( … )` aside, so a `;`
// inside a list of PR citations does not end the clause. A sentence's `.` or
// a top-level `;` still does. The `(?![- ]choice)` lookahead keeps an honest
// PASS row that names a "pending-choice" prompt (a large WP family) from
// reading as pending. Case-insensitive so `PENDING` matches. `deferred` is not
// a pending word: the index uses it far more for other things (a "Deferred"
// ledger status, a deferred sibling WP) than for an owed check.
const PENDING_LIVE_VERIFY_PATTERN =
  /(?:D-24026|live[- ]verif\w*|live-on-surface)(?:[^.;]|\.(?=[^\s.])|\([^()]*\)){0,120}?\b(?:pending|partial)\b(?![- ]choice)/i;

// why: `operator-pending` is the index's word for a check the operator still
// owes. On rows that define the check first ("(D-24026 = <what to see>;
// operator-pending on deploy)") it sits past a `;` and a long criterion, so it
// counts anywhere in a row that has a live-verify anchor anywhere. A row with no
// anchor (a pending migration apply) is not about live-verify and is skipped.
const LIVE_VERIFY_ANCHOR_PATTERN = /D-24026|live[- ]verif\w*|live-on-surface/i;
const OPERATOR_PENDING_PATTERN = /\boperator[- ]pending\b/i;

// why: an entry whose `wp` names no WP must still say what it verifies, so a
// WP-owned entry is never left unattributed (D-24852 blind spot 3). `none` needs
// a reason in parentheses; a bare `none` says nothing.
const NONE_ATTRIBUTION_PATTERN = /^none \([^)]+\)$/;
const DECISION_TOKEN_PATTERN = /D-\d{5}/g;
const DECISION_HEADING_PATTERN = /^### (D-\d{5}) (.*)$/;
const DIRECT_FIX_HEADING_PATTERN = /direct fix|no WP/i;

// why: the guard reads `entries[].wp` and `entries[].state`; a schema bump
// that renames either would group nothing and pass forever, so an unknown
// version fails loudly instead.
const SUPPORTED_SCHEMA_VERSION = 1;

// why: live-verify.json's `wp` field is free text on some entries
// ("WP-674; #3150", "D-24801 (#3155)", ""), so the WP ids are extracted as
// whole tokens; comparing whole tokens keeps WP-67 from matching WP-674.
const WORK_PACKET_TOKEN_PATTERN = /WP-\d+(?:\.\d+)?/g;

const VERIFIED_STATE = 'verified';

/**
 * Read a UTF-8 text file, raising a full-sentence error (naming the path and the
 * likely fix) instead of a bare `ENOENT` stack when it cannot be read.
 *
 * @param {string} filePath absolute path to read.
 * @param {string} description what the file is.
 * @returns {string} the file's UTF-8 contents.
 */
function readTextFile(filePath, description) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (readError) {
    const cause = readError instanceof Error ? readError.message : String(readError);
    throw new Error(
      `Could not read ${description} at ${filePath}: ${cause}. If the file moved, update scripts/check-workindex-liveverify-pending.mjs.`,
    );
  }
}

/**
 * Strip a leading UTF-8 byte-order mark (U+FEFF) if present. Mirrors
 * scripts/check-workindex-executed-open.mjs.
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
 * Parse live-verify.json and return its `entries` array, failing loudly on
 * invalid JSON, an unknown schemaVersion, or a missing `entries` array.
 *
 * @param {string} liveVerifyText the live-verify.json text.
 * @returns {object[]} the raw entries.
 */
function parseLiveVerifyEntries(liveVerifyText) {
  let parsed;
  try {
    parsed = JSON.parse(stripLeadingBom(liveVerifyText));
  } catch (parseError) {
    const cause = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(
      `docs/ai/coverage/live-verify.json is not valid JSON (${cause}); fix the file before this check can run.`,
    );
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(
      'docs/ai/coverage/live-verify.json is not a JSON object; the check expects `{ schemaVersion, entries }`.',
    );
  }
  if (parsed.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `docs/ai/coverage/live-verify.json has schemaVersion ${String(parsed.schemaVersion)}, but this check reads schemaVersion ${SUPPORTED_SCHEMA_VERSION}; update scripts/check-workindex-liveverify-pending.mjs for the new shape (D-24852).`,
    );
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error(
      'docs/ai/coverage/live-verify.json has no `entries` array; the check reads `entries[].wp` and `entries[].state`, so restore that shape or update this script.',
    );
  }
  return parsed.entries;
}

/**
 * Group live-verify.json entries by every WP id their `wp` field names. An entry
 * whose `wp` field names no WP (a D-number, `none (…)`) is not grouped.
 *
 * @param {string} liveVerifyText the live-verify.json text.
 * @returns {Map<string, { key: string, state: string, date: string }[]>} WP id → its entries.
 */
export function groupLiveVerifyEntriesByWorkPacket(liveVerifyText) {
  const entriesByWorkPacket = new Map();
  for (const entry of parseLiveVerifyEntries(liveVerifyText)) {
    const workPacketField = typeof entry.wp === 'string' ? entry.wp : '';
    const namedWorkPackets = new Set(workPacketField.match(WORK_PACKET_TOKEN_PATTERN) ?? []);
    for (const workPacket of namedWorkPackets) {
      if (!entriesByWorkPacket.has(workPacket)) {
        entriesByWorkPacket.set(workPacket, []);
      }
      entriesByWorkPacket.get(workPacket).push({
        key: String(entry.key ?? ''),
        state: String(entry.state ?? ''),
        date: String(entry.date ?? ''),
      });
    }
  }
  return entriesByWorkPacket;
}

/**
 * The D-ids whose DECISIONS.md heading marks them a direct fix shipped without
 * a WP ("direct fix", "no WP").
 *
 * @param {string} decisionsText the DECISIONS.md text.
 * @returns {Set<string>} the direct-fix D-ids.
 */
export function listDirectFixDecisions(decisionsText) {
  const directFixDecisions = new Set();
  for (const line of stripLeadingBom(decisionsText).split(/\r?\n/)) {
    const headingMatch = line.match(DECISION_HEADING_PATTERN);
    if (headingMatch !== null && DIRECT_FIX_HEADING_PATTERN.test(headingMatch[2])) {
      directFixDecisions.add(headingMatch[1]);
    }
  }
  return directFixDecisions;
}

/**
 * Find every live-verify.json entry whose `wp` field names nothing it verifies:
 * no `WP-NNN`, no direct-fix `D-NNNNN`, and not `none (<reason>)`.
 *
 * @param {string} liveVerifyText the live-verify.json text.
 * @param {Set<string>} directFixDecisions from listDirectFixDecisions.
 * @returns {{ key: string, wp: string }[]} one per unattributed entry.
 */
export function findUnattributedLiveVerifyEntries(liveVerifyText, directFixDecisions) {
  const unattributed = [];
  for (const entry of parseLiveVerifyEntries(liveVerifyText)) {
    const workPacketField = typeof entry.wp === 'string' ? entry.wp.trim() : '';
    const isWorkPacketNamed = /WP-\d+/.test(workPacketField);
    const isNoneWithReason = NONE_ATTRIBUTION_PATTERN.test(workPacketField);
    const namedDecisions = workPacketField.match(DECISION_TOKEN_PATTERN) ?? [];
    const isDirectFixNamed = namedDecisions.some((decision) => directFixDecisions.has(decision));
    if (!isWorkPacketNamed && !isNoneWithReason && !isDirectFixNamed) {
      unattributed.push({ key: String(entry.key ?? ''), wp: workPacketField });
    }
  }
  return unattributed;
}

/**
 * The row's pending live-verify phrase, if it has one: a clause-bounded
 * anchor-to-pending/partial match, else an `operator-pending` on a row that
 * mentions live-verify anywhere.
 *
 * @param {string} row a WORK_INDEX row.
 * @returns {string | null} the matched text, or null.
 */
export function findPendingLiveVerifyText(row) {
  const clauseMatch = row.match(PENDING_LIVE_VERIFY_PATTERN);
  if (clauseMatch !== null) {
    return clauseMatch[0];
  }
  if (LIVE_VERIFY_ANCHOR_PATTERN.test(row)) {
    const operatorPendingMatch = row.match(OPERATOR_PENDING_PATTERN);
    if (operatorPendingMatch !== null) {
      return operatorPendingMatch[0];
    }
  }
  return null;
}

/**
 * Find every done WORK_INDEX row that still says its live-verify is pending
 * while live-verify.json records every entry for that WP as verified.
 *
 * @param {string} workIndexText the WORK_INDEX.md text.
 * @param {Map<string, { key: string, state: string, date: string }[]>} entriesByWorkPacket from groupLiveVerifyEntriesByWorkPacket.
 * @returns {{ workPacket: string, pendingText: string, entries: { key: string, state: string, date: string }[] }[]} one per stale row.
 */
export function findStaleLiveVerifyPendingRows(workIndexText, entriesByWorkPacket) {
  const lines = stripLeadingBom(workIndexText).split(/\r?\n/);
  const violations = [];
  for (const line of lines) {
    const rowMatch = line.match(DONE_WORK_PACKET_ROW_PATTERN);
    if (rowMatch === null) {
      continue;
    }
    const pendingText = findPendingLiveVerifyText(line);
    if (pendingText === null) {
      continue;
    }
    const workPacket = rowMatch[1];
    const entries = entriesByWorkPacket.get(workPacket) ?? [];
    // why: no entry, or any entry still `partial` / `pending`, means the WP is
    // not fully live-verified on record — the row's "pending" is true.
    if (entries.length === 0) {
      continue;
    }
    const isEveryEntryVerified = entries.every((entry) => entry.state === VERIFIED_STATE);
    if (isEveryEntryVerified) {
      violations.push({ workPacket, pendingText, entries });
    }
  }
  return violations;
}

/**
 * One full-sentence report line for a stale row.
 *
 * @param {{ workPacket: string, pendingText: string, entries: { key: string, state: string, date: string }[] }} violation
 * @returns {string} the report line.
 */
function describeViolation(violation) {
  const entryList = violation.entries
    .map((entry) => `${entry.key} (${entry.date || 'no date'})`)
    .join(', ');
  let recordSummary = `all ${violation.entries.length} live-verify.json entries naming it are verified`;
  if (violation.entries.length === 1) {
    recordSummary = 'the one live-verify.json entry naming it is verified';
  }
  return `  ${violation.workPacket} — the row says "${violation.pendingText}", but ${recordSummary}: ${entryList}.\n`;
}

/**
 * Run the check: read WORK_INDEX + live-verify.json, find stale rows, print the
 * result, and return a process exit code (0 = consistent, 1 = stale rows).
 *
 * @returns {number} the exit code.
 */
function runCheck() {
  const liveVerifyText = readTextFile(LIVE_VERIFY_PATH, 'live-verify.json');
  const entriesByWorkPacket = groupLiveVerifyEntriesByWorkPacket(liveVerifyText);
  const workIndexText = readTextFile(WORK_INDEX_PATH, 'WORK_INDEX.md');
  const violations = findStaleLiveVerifyPendingRows(workIndexText, entriesByWorkPacket);
  const directFixDecisions = listDirectFixDecisions(readTextFile(DECISIONS_PATH, 'DECISIONS.md'));
  const unattributed = findUnattributedLiveVerifyEntries(liveVerifyText, directFixDecisions);

  if (violations.length === 0 && unattributed.length === 0) {
    process.stdout.write(
      'WORK_INDEX live-verify consistency check passed: no done (`- [x]`) WP row says its live-verify is pending or partial while live-verify.json records it verified, and every live-verify.json entry names what it verifies.\n',
    );
    return 0;
  }
  if (violations.length > 0) {
    reportStaleRows(violations);
  }
  if (unattributed.length > 0) {
    reportUnattributedEntries(unattributed);
  }
  return 1;
}

/**
 * Print the unattributed-entry failure report.
 *
 * @param {{ key: string, wp: string }[]} unattributed from findUnattributedLiveVerifyEntries.
 */
function reportUnattributedEntries(unattributed) {
  process.stderr.write(
    `WORK_INDEX live-verify consistency check FAILED: ${unattributed.length} live-verify.json entr(ies) name nothing they verify, so a WP row that owns one cannot see it (D-24852). Set each entry's \`wp\` to the WP it verifies (\`WP-NNN\`), or to the direct-fix decision it shipped under (a \`D-NNNNN\` whose DECISIONS.md heading says "direct fix" or "no WP"), or to \`none (<reason>)\` when neither exists. Unattributed entr(ies):\n`,
  );
  for (const entry of unattributed) {
    process.stderr.write(`  ${entry.key} — wp is ${JSON.stringify(entry.wp)}.\n`);
  }
}

/**
 * Print the stale-row failure report.
 *
 * @param {{ workPacket: string, pendingText: string, entries: { key: string, state: string, date: string }[] }[]} violations
 */
function reportStaleRows(violations) {
  process.stderr.write(
    `WORK_INDEX live-verify consistency check FAILED: ${violations.length} done WP row(s) still say their D-24026 live-verify is pending or partial, but docs/ai/coverage/live-verify.json records every entry for that WP as verified. Rewrite each row's pending phrase to the recorded result (e.g. "D-24026 live-verify PASS <date> per live-verify.json (match \`…\`)"). If a row is honest because a mechanic it names as pending has no live-verify.json entry yet, add a \`pending\` entry for that mechanic instead of rewording the row. This guard is detect-only and never edits the index. Stale row(s):\n`,
  );
  for (const violation of violations) {
    process.stderr.write(describeViolation(violation));
  }
}

/**
 * Whether this module was run directly (as a script) rather than imported (by
 * its test). Mirrors scripts/check-workindex-executed-open.mjs.
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
// injected strings.
if (isRunDirectly()) {
  try {
    process.exitCode = runCheck();
  } catch (checkError) {
    const cause = checkError instanceof Error ? checkError.message : String(checkError);
    process.stderr.write(`check-workindex-liveverify-pending failed: ${cause}\n`);
    process.exitCode = 1;
  }
}
