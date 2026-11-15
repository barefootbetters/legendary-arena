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
 * Two more rules close the wording gaps (D-24852 follow-up 3):
 *
 *   - Every verified entry's `date` must appear in its WP's done row. Recording
 *     a verification therefore forces an edit of the row, whatever words the
 *     row used for "not checked yet" — the edit is where stale prose dies. This
 *     is wording-independent; the pending pattern is the second line of defence.
 *   - A pending row is also judged against the entries of every direct-fix
 *     D-number it cites (entries that name no WP). A follow-up direct fix
 *     (D-24806 after WP-862) can carry the very mechanic a WP row calls pending;
 *     once those entries are all verified the row is stale. If the row is
 *     honest because its own mechanic has no entry, add a `pending` entry for it.
 *
 * Those rules still could not see a second entry verified on a date the row
 * already cites, on a row whose pending wording the pattern does not read. The
 * live-verify row token closes that (WP-896 / EC-934 / D-24853): every done row
 * ends with exactly one structured token, ` [live-verify: <state>]`, the row's
 * live-verify status of record, and three more rules check it:
 *
 *   - R1 presence: every done row (`WP-NNN`, `WP-NNNa`) ends with exactly one
 *     well-formed token and carries no other `[live-verify:` text; no open row
 *     carries any.
 *   - R2 record agreement: when live-verify.json has entries naming the WP, the
 *     token equals what they add up to (all verified → verified, all pending →
 *     pending, any mix → partial; `n/a` with entries always fails).
 *   - R3 prose agreement: a `verified` or `n/a` token fails when the row's own
 *     prose (token stripped) still reads as pending.
 *
 * The token is a closed vocabulary compared exactly against the record, so it
 * has no wording problem: any change in the record's aggregate fails CI until a
 * person edits the token, and that edit is where the prose gets fixed.
 *
 * DETECT-ONLY: this guard never edits WORK_INDEX or live-verify.json, and it has
 * no `--write` mode. If it fires, rewrite the row's pending phrase to the
 * recorded result (e.g. "D-24026 live-verify PASS <date> per live-verify.json
 * (match `…`)") and set its token by hand — never weaken the pattern to force
 * exit 0.
 *
 * Exit 0 = consistent; exit 1 = at least one violation, with a full-sentence
 * per-`WP-NNN` report naming the row, the rule and what to change.
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

// why: "the Wasp and Ant-Man Heist cards not yet seen live" (WP-865) is a
// pending check with no "pending" in it; the phrase names live checking itself,
// so it needs no anchor.
const NOT_YET_LIVE_PATTERN = /\bnot yet (?:seen|verified|checked|confirmed) live\b/i;

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
const PENDING_STATE = 'pending';
const PARTIAL_STATE = 'partial';
const NOT_APPLICABLE_STATE = 'n/a';

// why: R1–R3 read a WIDER done selector than the D-24852 rules above: the 16
// lettered rows (WP-005A, WP-207a, …) are done rows too, so each must carry a
// token. The D-24852 rules keep their numeric selector unchanged (D-24853). A
// lettered row is keyed by its full id (`WP-207a`), but the entry grouping
// reads an entry naming `WP-207a` as `WP-207`, so a lettered row has no own
// entries by construction and R2 never fires for it; widening the grouping is
// out of WP-896's scope.
const TOKEN_DONE_WORK_PACKET_ROW_PATTERN = /^- \[x\] (WP-\d+[A-Za-z]?(?:\.\d+)?) /;
const OPEN_WORK_PACKET_ROW_PATTERN = /^- \[ \] (WP-\d+[A-Za-z]?(?:\.\d+)?)/;

// why: the token sits at the END of the row. 229 numeric done rows have an
// irregular status block (`**Done**`, `**Done (code) …`, long parentheticals),
// so the row's end is the only position every row shares. The leading space is
// part of the token; anything after it (a trailing space, a period) makes the
// token misplaced, which R1 reports.
const LIVE_VERIFY_TOKEN_PATTERN = / \[live-verify: (verified|partial|pending|n\/a)\]$/;
const LIVE_VERIFY_TOKEN_MARKER = '[live-verify:';

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
 * Group the entries that name no WP by every direct-fix D-id their `wp` field
 * names. A pending row that cites one of those D-ids is judged against them too.
 *
 * @param {string} liveVerifyText the live-verify.json text.
 * @param {Set<string>} directFixDecisions from listDirectFixDecisions.
 * @returns {Map<string, { key: string, state: string, date: string }[]>} D-id → its entries.
 */
export function groupDirectFixEntriesByDecision(liveVerifyText, directFixDecisions) {
  const entriesByDecision = new Map();
  for (const entry of parseLiveVerifyEntries(liveVerifyText)) {
    const workPacketField = typeof entry.wp === 'string' ? entry.wp : '';
    if (/WP-\d+/.test(workPacketField)) {
      continue;
    }
    const namedDecisions = new Set(workPacketField.match(DECISION_TOKEN_PATTERN) ?? []);
    for (const decision of namedDecisions) {
      if (!directFixDecisions.has(decision)) {
        continue;
      }
      if (!entriesByDecision.has(decision)) {
        entriesByDecision.set(decision, []);
      }
      entriesByDecision.get(decision).push({
        key: String(entry.key ?? ''),
        state: String(entry.state ?? ''),
        date: String(entry.date ?? ''),
      });
    }
  }
  return entriesByDecision;
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
 * anchor-to-pending/partial match, else "not yet seen live" anywhere, else an
 * `operator-pending` on a row that mentions live-verify anywhere.
 *
 * @param {string} row a WORK_INDEX row.
 * @returns {string | null} the matched text, or null.
 */
export function findPendingLiveVerifyText(row) {
  const clauseMatch = row.match(PENDING_LIVE_VERIFY_PATTERN);
  if (clauseMatch !== null) {
    return clauseMatch[0];
  }
  const notYetLiveMatch = row.match(NOT_YET_LIVE_PATTERN);
  if (notYetLiveMatch !== null) {
    return notYetLiveMatch[0];
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
 * Remove the row's end-anchored, well-formed live-verify token. A malformed or
 * misplaced token is left in place, so R1 still sees and reports it.
 *
 * why: every rule that reads the row's pending WORDING reads it without the
 * token. The token's own text "live-verify: pending" matches the pending
 * pattern, and its "live-verify" would serve the operator-pending arm as an
 * anchor, so an unstripped token would make a structured field read as prose.
 *
 * @param {string} row a WORK_INDEX row.
 * @returns {string} the row without its trailing token.
 */
export function stripLiveVerifyToken(row) {
  return row.replace(LIVE_VERIFY_TOKEN_PATTERN, '');
}

/**
 * Find every done WORK_INDEX row that still says its live-verify is pending
 * while live-verify.json records every relevant entry as verified. The relevant
 * entries are those naming the WP plus those of every direct-fix D-id the row
 * cites.
 *
 * @param {string} workIndexText the WORK_INDEX.md text.
 * @param {Map<string, { key: string, state: string, date: string }[]>} entriesByWorkPacket from groupLiveVerifyEntriesByWorkPacket.
 * @param {Map<string, { key: string, state: string, date: string }[]>} [entriesByDirectFixDecision] from groupDirectFixEntriesByDecision.
 * @returns {{ workPacket: string, pendingText: string, entries: { key: string, state: string, date: string }[] }[]} one per stale row.
 */
export function findStaleLiveVerifyPendingRows(workIndexText, entriesByWorkPacket, entriesByDirectFixDecision = new Map()) {
  const lines = stripLeadingBom(workIndexText).split(/\r?\n/);
  const violations = [];
  for (const line of lines) {
    const rowMatch = line.match(DONE_WORK_PACKET_ROW_PATTERN);
    if (rowMatch === null) {
      continue;
    }
    const pendingText = findPendingLiveVerifyText(stripLiveVerifyToken(line));
    if (pendingText === null) {
      continue;
    }
    const workPacket = rowMatch[1];
    const entries = [...(entriesByWorkPacket.get(workPacket) ?? [])];
    for (const citedDecision of new Set(line.match(DECISION_TOKEN_PATTERN) ?? [])) {
      entries.push(...(entriesByDirectFixDecision.get(citedDecision) ?? []));
    }
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
 * Find every verified entry whose date its WP's done row does not cite. An
 * entry naming an open (`- [ ]`) or absent WP is skipped.
 *
 * @param {string} workIndexText the WORK_INDEX.md text.
 * @param {Map<string, { key: string, state: string, date: string }[]>} entriesByWorkPacket from groupLiveVerifyEntriesByWorkPacket.
 * @returns {{ workPacket: string, entries: { key: string, state: string, date: string }[] }[]} one per row with uncited dates.
 */
export function findUncitedVerificationDates(workIndexText, entriesByWorkPacket) {
  const uncited = [];
  for (const line of stripLeadingBom(workIndexText).split(/\r?\n/)) {
    const rowMatch = line.match(DONE_WORK_PACKET_ROW_PATTERN);
    if (rowMatch === null) {
      continue;
    }
    const workPacket = rowMatch[1];
    // why: this rule looks for a date, not for pending wording, and the token
    // holds no date, so it reads the whole row; stripping could not change it.
    const uncitedEntries = (entriesByWorkPacket.get(workPacket) ?? []).filter(
      // why: an empty date cannot be cited, and `includes('')` is always true,
      // so a dateless verified entry is reported rather than silently passing.
      (entry) => entry.state === VERIFIED_STATE && (entry.date === '' || !line.includes(entry.date)),
    );
    if (uncitedEntries.length > 0) {
      uncited.push({ workPacket, entries: uncitedEntries });
    }
  }
  return uncited;
}

/**
 * The live-verify state a WP's own entries add up to.
 *
 * why: `partial` means "some of it is confirmed", so any mix of states
 * (verified + pending, or any `partial` entry) is `partial`; only a record that
 * is uniformly verified or uniformly pending says more than that.
 *
 * @param {{ state: string }[]} entries the WP's own entries (at least one).
 * @returns {string} `verified`, `pending` or `partial`.
 */
export function aggregateLiveVerifyState(entries) {
  if (entries.every((entry) => entry.state === VERIFIED_STATE)) {
    return VERIFIED_STATE;
  }
  if (entries.every((entry) => entry.state === PENDING_STATE)) {
    return PENDING_STATE;
  }
  return PARTIAL_STATE;
}

/**
 * How many times the row contains the token marker `[live-verify:`.
 *
 * @param {string} row a WORK_INDEX row.
 * @returns {number} the marker count.
 */
function countTokenMarkers(row) {
  return row.split(LIVE_VERIFY_TOKEN_MARKER).length - 1;
}

/**
 * The R1 sentence telling the closer which token to append.
 *
 * why: the guard reads no WP files, so without own entries it cannot know
 * whether the WP is `none — infrastructure`; it states the rule as a condition.
 *
 * @param {string | null} aggregate the own entries' aggregate, or null if none.
 * @returns {string} the remedy sentence.
 */
function describeTokenToAppend(aggregate) {
  if (aggregate !== null) {
    return `Its own live-verify.json entries add up to \`${aggregate}\`, so append \` [live-verify: ${aggregate}]\`.`;
  }
  return 'It has no live-verify.json entry of its own, so append ` [live-verify: n/a]` if the WP is `none — infrastructure`, else ` [live-verify: pending]`.';
}

/**
 * The remedy sentence shared by R2 and R3.
 *
 * why: the honest-partial case — one mechanic recorded verified while others
 * are owed with no entry — makes R2 force `verified` and R3 then fail the true
 * "partial" prose. The fix is a `pending` entry per owed mechanic (the aggregate
 * becomes `partial`), never new wording. The same remedy covers a cited direct
 * fix that is not verified while the WP's own entries are: add the WP to that
 * entry's `wp` if the mechanic is the WP's, or rewrite the prose if it is not.
 *
 * @param {string} aggregateText the aggregate, already formatted for the report.
 * @returns {string} the remedy sentence.
 */
function describeAgreementRemedy(aggregateText) {
  return `Set the token to the aggregate, ${aggregateText}. If the row honestly says some mechanic is still owed, add a \`pending\` live-verify.json entry for that mechanic (the aggregate becomes \`partial\`); never reword true prose to pass.`;
}

/**
 * The aggregate named in an R3 report: the own entries' aggregate if there are
 * any; with none, a closer records `pending` (or `partial` when some of it is
 * confirmed), as 01.0b Step 10 says.
 *
 * @param {string | null} aggregate the own entries' aggregate, or null if none.
 * @returns {string} the aggregate, formatted for the report.
 */
function describeProseAggregate(aggregate) {
  if (aggregate !== null) {
    return `\`${aggregate}\``;
  }
  return `\`${PENDING_STATE}\` (or \`${PARTIAL_STATE}\` if some of it is confirmed), since the WP has no live-verify.json entries of its own`;
}

/**
 * Check one done row against R1–R3 and return its problems.
 *
 * why: R2 reads the WP's OWN entries only. The stale-prose rule also reads the
 * entries of cited direct-fix D-numbers, but a cited fix is often not the WP's
 * own work (WP-863 cites D-24802 without owning it), so it cannot set the WP's
 * token.
 *
 * @param {string} row the done row.
 * @param {string} workPacket the row's WP id.
 * @param {{ state: string }[]} ownEntries the entries naming the WP.
 * @returns {{ workPacket: string, rule: string, detail: string }[]} its problems.
 */
function checkDoneRowToken(row, workPacket, ownEntries) {
  let aggregate = null;
  if (ownEntries.length > 0) {
    aggregate = aggregateLiveVerifyState(ownEntries);
  }
  const tokenMatch = row.match(LIVE_VERIFY_TOKEN_PATTERN);
  if (tokenMatch === null || countTokenMarkers(row) !== 1) {
    const detail = `The done row does not end with exactly one well-formed live-verify token and no other \`[live-verify:\` text. ${describeTokenToAppend(aggregate)}`;
    return [{ workPacket, rule: 'R1', detail }];
  }
  const token = tokenMatch[1];
  const pendingText = findPendingLiveVerifyText(stripLiveVerifyToken(row));
  let proseSummary = 'its prose has no pending wording';
  if (pendingText !== null) {
    proseSummary = `its prose reads "${pendingText}"`;
  }
  const problems = [];
  if (aggregate !== null && token !== aggregate) {
    const detail = `The row's token is \`[live-verify: ${token}]\`, but its ${ownEntries.length} own live-verify.json entr(ies) add up to \`${aggregate}\`, and ${proseSummary}. ${describeAgreementRemedy(`\`${aggregate}\``)}`;
    problems.push({ workPacket, rule: 'R2', detail });
  }
  const isClaimingNothingOwed = token === VERIFIED_STATE || token === NOT_APPLICABLE_STATE;
  if (isClaimingNothingOwed && pendingText !== null) {
    const aggregateText = describeProseAggregate(aggregate);
    const detail = `The row's token is \`[live-verify: ${token}]\`, but ${proseSummary}, so it is not ${token}; the aggregate is ${aggregateText}. ${describeAgreementRemedy(aggregateText)}`;
    problems.push({ workPacket, rule: 'R3', detail });
  }
  return problems;
}

/**
 * Find every WORK_INDEX row that breaks the live-verify token rules (D-24853):
 * R1 presence on done rows and absence on open rows, R2 agreement with the WP's
 * own live-verify.json entries, R3 agreement with the row's own prose.
 *
 * why: nothing in the repo writes the token — no `--write`, no writer script,
 * no CI step. The forced hand edit is the point: whoever flips a token after a
 * new live-verify result is in the row and rereads its prose; a writer would
 * flip the token and leave stale prose behind it.
 *
 * @param {string} workIndexText the WORK_INDEX.md text.
 * @param {Map<string, { state: string }[]>} entriesByWorkPacket from groupLiveVerifyEntriesByWorkPacket.
 * @returns {{ workPacket: string, rule: string, detail: string }[]} one per violation.
 */
export function findRowTokenProblems(workIndexText, entriesByWorkPacket) {
  const problems = [];
  for (const line of stripLeadingBom(workIndexText).split(/\r?\n/)) {
    const openMatch = line.match(OPEN_WORK_PACKET_ROW_PATTERN);
    if (openMatch !== null) {
      if (line.includes(LIVE_VERIFY_TOKEN_MARKER)) {
        const detail = 'The open (`- [ ]`) row carries `[live-verify:` text, but a WP that is not done has no live-verify state; remove it and append the token when the row is flipped to `[x]`.';
        problems.push({ workPacket: openMatch[1], rule: 'R1', detail });
      }
      continue;
    }
    const doneMatch = line.match(TOKEN_DONE_WORK_PACKET_ROW_PATTERN);
    if (doneMatch === null) {
      continue;
    }
    const workPacket = doneMatch[1];
    problems.push(...checkDoneRowToken(line, workPacket, entriesByWorkPacket.get(workPacket) ?? []));
  }
  return problems;
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
  const workIndexText = readTextFile(WORK_INDEX_PATH, 'WORK_INDEX.md');
  const directFixDecisions = listDirectFixDecisions(readTextFile(DECISIONS_PATH, 'DECISIONS.md'));
  const entriesByWorkPacket = groupLiveVerifyEntriesByWorkPacket(liveVerifyText);
  const entriesByDirectFixDecision = groupDirectFixEntriesByDecision(liveVerifyText, directFixDecisions);
  const violations = findStaleLiveVerifyPendingRows(workIndexText, entriesByWorkPacket, entriesByDirectFixDecision);
  const unattributed = findUnattributedLiveVerifyEntries(liveVerifyText, directFixDecisions);
  const uncited = findUncitedVerificationDates(workIndexText, entriesByWorkPacket);
  const tokenProblems = findRowTokenProblems(workIndexText, entriesByWorkPacket);

  const problemCount = violations.length + unattributed.length + uncited.length + tokenProblems.length;
  if (problemCount === 0) {
    process.stdout.write(
      'WORK_INDEX live-verify consistency check passed: no done (`- [x]`) WP row says its live-verify is pending or partial while live-verify.json records it verified, every verified entry\'s date is cited in its WP row, every live-verify.json entry names what it verifies, and every done row ends with one live-verify token that agrees with its own entries and its prose.\n',
    );
    return 0;
  }
  if (tokenProblems.length > 0) {
    reportRowTokenProblems(tokenProblems);
  }
  if (violations.length > 0) {
    reportStaleRows(violations);
  }
  if (uncited.length > 0) {
    reportUncitedDates(uncited);
  }
  if (unattributed.length > 0) {
    reportUnattributedEntries(unattributed);
  }
  return 1;
}

/**
 * Print the live-verify token failure report (D-24853).
 *
 * @param {{ workPacket: string, rule: string, detail: string }[]} tokenProblems from findRowTokenProblems.
 */
function reportRowTokenProblems(tokenProblems) {
  process.stderr.write(
    `WORK_INDEX live-verify consistency check FAILED: ${tokenProblems.length} WP row(s) break the live-verify token rule (D-24853). Every done (\`- [x]\`) row ends with exactly one token, \` [live-verify: verified|partial|pending|n/a]\`, that is its live-verify status of record (R1); where live-verify.json has entries naming the WP, the token equals what they add up to (R2); and a \`verified\` or \`n/a\` token never sits on a row whose prose still reads pending (R3). No tool writes the token: edit each row by hand, and reread its prose while you are there. Row(s):\n`,
  );
  for (const problem of tokenProblems) {
    process.stderr.write(`  ${problem.workPacket} [${problem.rule}] — ${problem.detail}\n`);
  }
}

/**
 * Print the uncited-date failure report.
 *
 * @param {{ workPacket: string, entries: { key: string, state: string, date: string }[] }[]} uncited from findUncitedVerificationDates.
 */
function reportUncitedDates(uncited) {
  process.stderr.write(
    `WORK_INDEX live-verify consistency check FAILED: ${uncited.length} done WP row(s) do not cite the date of a live-verify.json entry that records the WP verified (D-24852). Add the result to each row (e.g. "D-24026 live-verify PASS <date> per live-verify.json (match \`…\`)"), and while you are in the row, rewrite any wording that still says that check is owed. Row(s) and uncited entr(ies):\n`,
  );
  for (const row of uncited) {
    const entryList = row.entries.map((entry) => `${entry.key} (${entry.date || 'no date'})`).join(', ');
    process.stderr.write(`  ${row.workPacket} — ${entryList}.\n`);
  }
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
