/**
 * Legendary Arena — Live-Verify Stale-Row Guard (WP-895 / EC-933 / D-24852)
 *
 * Fails when a done (`- [x]`) `WORK_INDEX.md` WP row still says its D-24026
 * live-verify is pending ("live-verify operator-pending", "D-24026
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
 * live-verify.json is the only oracle this guard trusts. (181 done rows match
 * the pattern on `main` @ 02a0bf623; two have entries, both pending.)
 * Known blind spots, all false negatives (D-24852): the `partial:` row format
 * (WP-864 / WP-865), a dot inside a domain ending the clause, and "pending"
 * more than 60 characters past the anchor.
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

// why: only a DONE row can be stale in this sense — an open `- [ ]` row is
// expected to be pending. The real-digit WP token skips the template
// placeholder (`WP-NNN`) and the `**(backlog …)**` rows, as in WP-671.
const DONE_WORK_PACKET_ROW_PATTERN = /^- \[x\] (WP-\d+(?:\.\d+)?) /;

// why: the pending phrasing on real rows varies ("D-24026 live-verify
// operator-pending", "**D-24026 operator-pending**", "(D-24026)
// operator-pending", "live-verify: operator-pending", "D-24026 live-verify ⏳
// PENDING post-deploy", "Post-deploy **D-24026 live-verify** pending",
// "live-on-surface operator-pending"). Every form has a live-verify anchor
// (`D-24026`, `live-verify`/`live verify`, `live-on-surface`) followed, inside
// the same clause, by the word `pending`. The clause bound — no `.` or `;` and
// at most 60 characters in between — keeps a later, unrelated "pending" (a
// pending deploy of another WP, a pending backfill) from pairing with an
// earlier live-verify mention. The `(?![- ]choice)` lookahead keeps an honest
// PASS row that names a "pending-choice" prompt (a large WP family) from
// reading as pending. Case-insensitive so `PENDING` matches.
const PENDING_LIVE_VERIFY_PATTERN =
  /(?:D-24026|live[- ]verif\w*|live-on-surface)[^.;]{0,60}?\bpending\b(?![- ]choice)/i;

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
 * Group live-verify.json entries by every WP id their `wp` field names. An entry
 * whose `wp` field names no WP (empty, or a D-number / PR only) is not grouped.
 *
 * @param {string} liveVerifyText the live-verify.json text.
 * @returns {Map<string, { key: string, state: string, date: string }[]>} WP id → its entries.
 */
export function groupLiveVerifyEntriesByWorkPacket(liveVerifyText) {
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
  const entriesByWorkPacket = new Map();
  for (const entry of parsed.entries) {
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
 * The row's pending live-verify phrase, if it has one.
 *
 * @param {string} row a WORK_INDEX row.
 * @returns {string | null} the matched text (anchor through "pending"), or null.
 */
export function findPendingLiveVerifyText(row) {
  const pendingMatch = row.match(PENDING_LIVE_VERIFY_PATTERN);
  return pendingMatch === null ? null : pendingMatch[0];
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

  if (violations.length === 0) {
    process.stdout.write(
      'WORK_INDEX live-verify consistency check passed: no done (`- [x]`) WP row says its live-verify is pending while live-verify.json records it verified.\n',
    );
    return 0;
  }

  process.stderr.write(
    `WORK_INDEX live-verify consistency check FAILED: ${violations.length} done WP row(s) still say their D-24026 live-verify is pending, but docs/ai/coverage/live-verify.json records every entry for that WP as verified. Rewrite each row's pending phrase to the recorded result (e.g. "D-24026 live-verify PASS <date> per live-verify.json (match \`…\`)"). If a row is honest because a mechanic it names as pending has no live-verify.json entry yet, add a \`pending\` entry for that mechanic instead of rewording the row. This guard is detect-only and never edits the index. Stale row(s):\n`,
  );
  for (const violation of violations) {
    process.stderr.write(describeViolation(violation));
  }
  return 1;
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
