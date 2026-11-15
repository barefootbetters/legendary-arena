/**
 * Tests for the live-verify stale-row guard (WP-895 / EC-933 / D-24852).
 *
 * The pure helpers are data-injected — every case passes strings in, so the
 * test needs no file I/O and never runs the CLI (guarded behind
 * `isRunDirectly()`). Coverage:
 *   - POSITIVE (non-vacuous): a synthetic done row that says "live-verify
 *     operator-pending" while every live-verify.json entry for its WP is
 *     verified FAILS, and the report names the WP and the pending text.
 *   - NEGATIVE: the same pending row PASSES when the WP has no entry, or when
 *     any entry is `partial` / `pending`; an open `- [ ]` row, a reconciled
 *     "live-verify PASS" row, the template placeholder, and a row whose
 *     "pending" belongs to a different clause all PASS, as does a PASS row
 *     that names a "pending-choice" prompt.
 *   - POSITIVE: a "live-verify (D-24026) partial: …" row whose entries are
 *     all verified is flagged (the D-24852 follow-up that added `partial`).
 *   - POSITIVE (blind spot 2 closed): a dotted domain inside the clause, a `;`
 *     inside a `( … )` aside, "pending" 60–120 characters past the anchor, and
 *     an `operator-pending` past a `;` on a row with a live-verify anchor are
 *     all flagged. NEGATIVE: a sentence `.` and a top-level `;` still end the
 *     clause, and an `operator-pending` on a row with no anchor is not read.
 *   - The real pending and partial phrasings found on `main` are each recognised.
 *   - `wp` field parsing: free-text fields ("WP-674; #3150") name their WP;
 *     WP-67 is not WP-674; D-number-only and empty fields name no WP.
 *   - Unattributed entries (blind spot 3 closed): an empty, PR-only, bare
 *     `none`, or non-direct-fix D-number `wp` is reported; a WP, a direct-fix
 *     D-number, or `none (<reason>)` is not. Direct-fix headings are read from
 *     DECISIONS.md text.
 *   - Follow-up 3: a verified entry whose date its done row does not cite is
 *     reported (and a dateless one), whatever the row says; a cited date, a
 *     partial entry, and an open row are not. A pending row that cites a
 *     direct-fix D-number is stale once that D-number's entries are all
 *     verified, even with no entry of its own. "not yet seen live" reads as
 *     pending with no anchor.
 *   - Malformed JSON and an unknown schemaVersion fail loudly.
 *   - Live-verify row token (WP-896 / EC-934 / D-24853):
 *       R1: a done row with no token, a duplicated token, a token mid-row, or
 *       a malformed state fails, as does a lettered done row with no token and
 *       a token on an open row; the §Format template line and a backlog line
 *       are ignored; the R1 message names the token to append.
 *       R2: the token must equal the own entries' aggregate (all verified,
 *       all pending, any mix → partial); `n/a` with entries fails; cited
 *       direct-fix entries do not count; an entry naming `WP-207a` groups as
 *       `WP-207`, so the lettered row passes R2 in any state.
 *       R3: a `verified` / `n/a` token on pending prose fails; `pending` /
 *       `partial` on pending prose passes. The R2 and R3 messages name the
 *       add-a-`pending`-entry remedy.
 *       Stripping, one case per prose-rule consumer: the stale-row rule does
 *       not read a trailing `pending` token as prose; R3 does not let the
 *       token serve as the operator-pending arm's live-verify anchor; a
 *       malformed token is not stripped.
 *
 * Cheat-proof: fixtures are never mutated; each negative keeps a real pending
 * phrase on a real `- [x]` row, so a pass means the guard discriminated on the
 * live-verify record, not that the input was neutered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateLiveVerifyState,
  findPendingLiveVerifyText,
  findRowTokenProblems,
  findStaleLiveVerifyPendingRows,
  findUnattributedLiveVerifyEntries,
  findUncitedVerificationDates,
  groupDirectFixEntriesByDecision,
  groupLiveVerifyEntriesByWorkPacket,
  listDirectFixDecisions,
  stripLiveVerifyToken,
} from './check-workindex-liveverify-pending.mjs';

/**
 * Build live-verify.json text from `[wp, state]` pairs.
 *
 * @param {Array<[string, string]>} pairs the `wp` field and `state` of each entry.
 * @returns {string} the JSON text.
 */
function buildLiveVerifyText(pairs: Array<[string, string]>): string {
  const entries = pairs.map(([workPacketField, state], index) => ({
    key: `core/card-${index}|mechanic`,
    wp: workPacketField,
    state,
    date: '2026-11-01',
  }));
  return JSON.stringify({ schemaVersion: 1, entries });
}

const STALE_ROW =
  '- [x] WP-901 — **A shipped card ability** (Game Engine) — **Done 2026-11-01** (EC-940; engine 100 → 104 / 0; **D-24026 live-verify operator-pending** on deploy). See [WP-901](WP-901-x.md).';

const RECONCILED_ROW =
  '- [x] WP-901 — **A shipped card ability** (Game Engine) — **Done 2026-11-01** (EC-940; engine 100 → 104 / 0; D-24026 live-verify PASS 2026-11-02 per live-verify.json (match `abc123`)). See [WP-901](WP-901-x.md).';

test('POSITIVE: a done row saying pending, with every entry verified, is flagged', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(
    buildLiveVerifyText([['WP-901', 'verified'], ['WP-901', 'verified']]),
  );
  const violations = findStaleLiveVerifyPendingRows(STALE_ROW, entries);
  assert.equal(violations.length, 1, 'the stale row is reported');
  assert.equal(violations[0].workPacket, 'WP-901');
  assert.equal(violations[0].pendingText, 'D-24026 live-verify operator-pending');
  assert.equal(violations[0].entries.length, 2, 'both verified entries are cited');
});

test('POSITIVE: a partial row, with every entry verified, is flagged', () => {
  const partialRow =
    '- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (live-verify (D-24026) partial: X PASS 2026-11-02 (match `abc`), Y and Z operator-pending; D-24801 ✅).';
  const allVerified = groupLiveVerifyEntriesByWorkPacket(
    buildLiveVerifyText([['WP-901', 'verified'], ['WP-901', 'verified']]),
  );
  const violations = findStaleLiveVerifyPendingRows(partialRow, allVerified);
  assert.equal(violations.length, 1, 'the stale partial row is reported');
  assert.equal(violations[0].pendingText, 'live-verify (D-24026) partial');
  const stillPending = groupLiveVerifyEntriesByWorkPacket(
    buildLiveVerifyText([['WP-901', 'verified'], ['WP-901', 'partial']]),
  );
  assert.deepEqual(findStaleLiveVerifyPendingRows(partialRow, stillPending), [], 'a partial entry keeps it honest');
});

test('POSITIVE: pending phrases past a dot, an aside, 60 characters or a criterion are flagged', () => {
  const allVerified = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-901', 'verified']]));
  const rowsAndPendingText: Array<[string, string]> = [
    [
      '- [x] WP-901 — x — **Done 2026-11-01**; live-verify (D-24026) on `play.legendary-arena.com/?route=me` pending deploy.',
      'live-verify (D-24026) on `play.legendary-arena.com/?route=me` pending',
    ],
    [
      '- [x] WP-901 — x — **Done 2026-11-01**; live-verify browser + Android PASS 2026-11-14 (headless #3361; phone test #3365), iOS Safari pending (Jeff).',
      'live-verify browser + Android PASS 2026-11-14 (headless #3361; phone test #3365), iOS Safari pending',
    ],
    [
      '- [x] WP-901 — x — **Done 2026-11-01**; D-24026 server-side proof (authenticated `GET /api/me/matches/<id>/coach` → 200 on a casual match) pending deploy.',
      'D-24026 server-side proof (authenticated `GET /api/me/matches/<id>/coach` → 200 on a casual match) pending',
    ],
    [
      '- [x] WP-901 — x — **Done 2026-11-01** (D-24026 = Copy → clipboard, Expand → full-screen log; **operator-pending on deploy**).',
      'operator-pending',
    ],
  ];
  for (const [row, pendingText] of rowsAndPendingText) {
    const violations = findStaleLiveVerifyPendingRows(row, allVerified);
    assert.equal(violations.length, 1, `flagged: ${row.slice(40, 110)}`);
    assert.equal(violations[0].pendingText, pendingText);
  }
});

test('NEGATIVE: a sentence end, a top-level semicolon, and an unanchored operator-pending are not read', () => {
  const rows = [
    '- [x] WP-901 — x — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02. The WP-902 deploy is pending).',
    '- [x] WP-901 — x — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02 (match `abc`); the prod backfill is pending).',
    '- [x] WP-901 — x — **Done 2026-11-01** (migration 026 PROD apply operator-pending; green, pending commit).',
  ];
  for (const row of rows) {
    assert.equal(findPendingLiveVerifyText(row), null, row);
  }
});

test('NEGATIVE: a pending row with no live-verify.json entry stays legitimately pending', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-777', 'verified']]));
  assert.deepEqual(findStaleLiveVerifyPendingRows(STALE_ROW, entries), []);
});

test('NEGATIVE: one partial or pending entry keeps the row legitimately pending', () => {
  for (const unfinishedState of ['partial', 'pending']) {
    const entries = groupLiveVerifyEntriesByWorkPacket(
      buildLiveVerifyText([['WP-901', 'verified'], ['WP-901', unfinishedState]]),
    );
    assert.deepEqual(
      findStaleLiveVerifyPendingRows(STALE_ROW, entries),
      [],
      `a ${unfinishedState} entry means the WP is not fully verified`,
    );
  }
});

test('NEGATIVE: open rows, reconciled rows, the template and cross-clause "pending" all pass', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-901', 'verified']]));
  const openRow = STALE_ROW.replace('- [x] WP-901', '- [ ] WP-901');
  const templateRow = '- [x] WP-NNN — Short Title — **D-24026 live-verify operator-pending**';
  const crossClauseRow =
    '- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02; the prod backfill is pending).';
  for (const row of [openRow, RECONCILED_ROW, templateRow, crossClauseRow]) {
    assert.deepEqual(findStaleLiveVerifyPendingRows(row, entries), [], `passes: ${row.slice(0, 60)}`);
  }
});

test('the real pending phrasings on main are each recognised', () => {
  const phrasings = [
    '**D-24026 live-verify operator-pending**',
    '**D-24026 operator-pending**',
    '**D-24026 live-verify: operator-pending** (`User-Visible Surface = play`)',
    'Post-deploy **D-24026 live-verify** pending',
    '(D-24026) operator-pending',
    'D-24026 live-verify on the CF Pages deploy operator-pending',
    '**D-24026 live-verify ⏳ PENDING post-deploy**',
    'Live-verify (D-24026) pending',
    'live-on-surface operator-pending',
    'live-verify (D-24026) partial: Sporr and Pym Particles PASS 2026-11-06',
    'live-verify (D-24026) PARTIAL',
    'live-verify (D-24026) on `play.legendary-arena.com/?route=me` pending deploy',
    '(D-24026 = Copy → clipboard, Save → `game-log.txt`, Expand → full-screen scrollable chronological log that closes back to compact; **operator-pending on deploy**)',
    'D-24026 server-side proof (authenticated `GET /api/me/matches/<id>/coach` → 200 on a casual match) pending deploy',
    'live-verify browser + Android PASS 2026-11-14 (headless browser #3361; Android phone test: the installed /offline/ app plays with Wi-Fi off and airplane mode on, #3365; Battle Brief offline lineup fixed #3362), iOS Safari and a days-later cold start pending (Jeff)',
  ];
  for (const phrasing of phrasings) {
    assert.notEqual(findPendingLiveVerifyText(`- [x] WP-901 — x — ${phrasing}.`), null, phrasing);
  }
  assert.equal(findPendingLiveVerifyText(RECONCILED_ROW), null, 'a PASS row has no pending phrase');
});

test('the wp field is read as whole WP tokens', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(
    buildLiveVerifyText([
      ['WP-674; #3150', 'verified'],
      ['D-24801 (#3155)', 'verified'],
      ['', 'verified'],
    ]),
  );
  assert.deepEqual([...entries.keys()], ['WP-674'], 'only the WP token is grouped');
  const wp67Row = STALE_ROW.replaceAll('WP-901', 'WP-67');
  assert.deepEqual(findStaleLiveVerifyPendingRows(wp67Row, entries), [], 'WP-67 is not WP-674');
});

test('NEGATIVE: a PASS row that names a pending-choice prompt is not pending', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-901', 'verified']]));
  const pendingChoiceRows = [
    '- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02 (match `abc`, the KO pending-choice prompt fired)).',
    '- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02, the pending choice resolved).',
  ];
  for (const row of pendingChoiceRows) {
    assert.equal(findPendingLiveVerifyText(row), null, row);
    assert.deepEqual(findStaleLiveVerifyPendingRows(row, entries), []);
  }
});

test('direct-fix decisions are read from DECISIONS.md headings', () => {
  const decisionsText = [
    '### D-24801 — Size-Changing is a recruit discount (Active 2026-11-05 — direct fix, no WP)',
    '### D-24743 — A mixed seat-choice ride admits the active seat (bot-ally fault, direct fix, amends D-24648) (Active 2026-10-17)',
    '### D-24852 — CI fails a stale live-verify row (Active 2026-11-14)',
    'Body text that mentions a direct fix but is not a heading.',
  ].join('\r\n');
  assert.deepEqual([...listDirectFixDecisions(decisionsText)].sort(), ['D-24743', 'D-24801']);
});

test('an entry whose wp names nothing it verifies is reported', () => {
  const directFixDecisions = new Set(['D-24801']);
  const liveVerifyText = buildLiveVerifyText([
    ['WP-674; #3150', 'verified'],
    ['D-24801 (#3155)', 'verified'],
    ['none (Core record)', 'verified'],
    ['', 'verified'],
    ['#3151', 'partial'],
    ['none', 'verified'],
    ['D-24852', 'pending'],
  ]);
  const unattributed = findUnattributedLiveVerifyEntries(liveVerifyText, directFixDecisions);
  assert.deepEqual(
    unattributed.map((entry) => entry.wp),
    ['', '#3151', 'none', 'D-24852'],
    'empty, PR-only, bare none and a WP-owned D-number are unattributed',
  );
  assert.equal(unattributed[0].key, 'core/card-3|mechanic');
});

test('a verified entry whose date the done row does not cite is reported, whatever the row says', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(
    JSON.stringify({
      schemaVersion: 1,
      entries: [
        { key: 'core/a|m', wp: 'WP-901', state: 'verified', date: '2026-11-03' },
        { key: 'core/b|m', wp: 'WP-901', state: 'verified', date: '2026-11-02' },
        { key: 'core/c|m', wp: 'WP-901', state: 'partial', date: '2026-11-09' },
        { key: 'core/d|m', wp: 'WP-902', state: 'verified', date: '' },
        { key: 'core/e|m', wp: 'WP-903', state: 'verified', date: '2026-11-04' },
      ],
    }),
  );
  // why: the WP-901 row's "required" wording reads as nothing to the pending
  // pattern; the uncited 2026-11-03 date is what catches it.
  const workIndexText = [
    '- [x] WP-901 — x — **Done 2026-11-01** (D-24026 live-verify required; PASS 2026-11-02).',
    '- [x] WP-902 — x — **Done 2026-11-01**.',
    '- [ ] WP-903 — x — open row.',
  ].join('\r\n');
  const uncited = findUncitedVerificationDates(workIndexText, entries);
  assert.deepEqual(
    uncited.map((row) => [row.workPacket, row.entries.map((entry) => entry.key)]),
    [
      ['WP-901', ['core/a|m']],
      ['WP-902', ['core/d|m']],
    ],
    'the uncited verified date and the dateless entry are reported; the cited date, the partial entry and the open row are not',
  );
  const fixedRow = '- [x] WP-901 — x — **Done 2026-11-01** (D-24026 live-verify PASS 2026-11-02, 2026-11-03).';
  assert.deepEqual(findUncitedVerificationDates(fixedRow, entries), []);
});

test('a pending row is judged against the entries of the direct-fix D-numbers it cites', () => {
  const liveVerifyText = buildLiveVerifyText([
    ['D-24806', 'verified'],
    ['D-24806', 'verified'],
    ['WP-777; D-24807', 'pending'],
    ['D-24852', 'pending'],
  ]);
  const entriesByDecision = groupDirectFixEntriesByDecision(liveVerifyText, new Set(['D-24806', 'D-24807']));
  assert.deepEqual([...entriesByDecision.keys()], ['D-24806'], 'only WP-less entries of direct-fix D-numbers are grouped');
  const ownEntries = groupLiveVerifyEntriesByWorkPacket(liveVerifyText);
  const citingRow =
    '- [x] WP-901 — x — **Done 2026-11-01** (live-verify (D-24026) operator-pending; D-24806 ✅).';
  const violations = findStaleLiveVerifyPendingRows(citingRow, ownEntries, entriesByDecision);
  assert.equal(violations.length, 1, 'stale once the cited direct fix is verified, with no entry of its own');
  assert.equal(violations[0].entries.length, 2);
  const notCiting = citingRow.replace('; D-24806 ✅', '');
  assert.deepEqual(findStaleLiveVerifyPendingRows(notCiting, ownEntries, entriesByDecision), []);
  const stillPartial = groupDirectFixEntriesByDecision(
    buildLiveVerifyText([['D-24806', 'verified'], ['D-24806', 'partial']]),
    new Set(['D-24806']),
  );
  assert.deepEqual(findStaleLiveVerifyPendingRows(citingRow, ownEntries, stillPartial), []);
});

test('"not yet seen live" reads as pending without an anchor', () => {
  const row =
    '- [x] WP-865 — x — **Done 2026-11-08** (Sporr PASS 2026-11-06, the Wasp and Ant-Man Heist cards not yet seen live; WP-736 ✅).';
  assert.equal(findPendingLiveVerifyText(row), 'not yet seen live');
  assert.equal(findPendingLiveVerifyText('- [x] WP-901 — x — the card is seen live now.'), null);
});

test('malformed or unknown-schema live-verify.json fails with a full-sentence error', () => {
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('{not json'), /not valid JSON/);
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('{"schemaVersion":1}'), /no `entries` array/);
  assert.throws(
    () => groupLiveVerifyEntriesByWorkPacket('{"schemaVersion":2,"entries":[]}'),
    /schemaVersion 2, but this check reads schemaVersion 1/,
  );
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('[]'), /schemaVersion undefined/);
});

// ---------------------------------------------------------------------------
// Live-verify row token (WP-896 / EC-934 / D-24853)
// ---------------------------------------------------------------------------

const TOKENLESS_ROW = '- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (EC-940; engine 100 → 104 / 0).';

/**
 * A done row for WP-901 with the given prose and trailing text.
 *
 * @param {string} prose the row's status prose.
 * @param {string} ending the text appended after the prose (normally the token).
 * @returns {string} the row.
 */
function buildDoneRow(prose: string, ending: string): string {
  return `- [x] WP-901 — **A shipped card ability** — **Done 2026-11-01** (${prose}).${ending}`;
}

/**
 * The `workPacket:rule` of every problem the token rules report for one text.
 *
 * @param {string} workIndexText the WORK_INDEX text.
 * @param {Array<[string, string]>} pairs the live-verify.json `[wp, state]` pairs.
 * @returns {string[]} `workPacket:rule` per problem.
 */
function listTokenProblemRules(workIndexText: string, pairs: Array<[string, string]>): string[] {
  const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText(pairs));
  return findRowTokenProblems(workIndexText, entries).map((problem) => `${problem.workPacket}:${problem.rule}`);
}

test('R1: a done row needs exactly one well-formed token as its last text', () => {
  const failingRows = [
    TOKENLESS_ROW,
    buildDoneRow('EC-940', ' [live-verify: n/a] [live-verify: n/a]'),
    '- [x] WP-901 — x [live-verify: n/a] — **Done 2026-11-01** (EC-940).',
    buildDoneRow('EC-940', ' [live-verify: done]'),
    buildDoneRow('EC-940', ' [live-verify: n/a].'),
    buildDoneRow('EC-940', '[live-verify: n/a]'),
    buildDoneRow('EC-940; see the `[live-verify:` field', ' [live-verify: n/a]'),
  ];
  for (const row of failingRows) {
    assert.deepEqual(listTokenProblemRules(row, []), ['WP-901:R1'], row);
  }
  for (const state of ['verified', 'partial', 'pending', 'n/a']) {
    const row = buildDoneRow('EC-940', ` [live-verify: ${state}]`);
    assert.deepEqual(listTokenProblemRules(row, []), [], `a ${state} token passes with no entries`);
  }
});

test('R1: lettered done rows need a token; open rows must not carry one; the template and backlog lines are ignored', () => {
  const letteredRow = '- [x] WP-207a — **A lettered packet** — **Done 2026-05-01**.';
  assert.deepEqual(listTokenProblemRules(letteredRow, []), ['WP-207a:R1'], 'the wide selector reads lettered rows');
  assert.deepEqual(listTokenProblemRules(`${letteredRow} [live-verify: n/a]`, []), []);
  const openRow = '- [ ] WP-902 — **A drafted packet** — Draft 2026-11-01. [live-verify: pending]';
  assert.deepEqual(listTokenProblemRules(openRow, []), ['WP-902:R1'], 'an open row carries no token');
  assert.deepEqual(listTokenProblemRules('- [ ] WP-902 — **A drafted packet** — Draft 2026-11-01.', []), []);
  const ignoredLines = [
    '- [x] WP-NNN — Short Title — Completed YYYY-MM-DD',
    '- [ ] WP-NNN — Short Title — [pending | in-progress | blocked: reason]',
    '- **(backlog — effect authoring)** a follow-up to be drafted',
    '- [x] **(deferred — WP-901 follow-up)** a deferred idea',
  ];
  assert.deepEqual(listTokenProblemRules(ignoredLines.join('\n'), []), []);
});

test('R1: the message names the token to append', () => {
  const ownEntries = groupLiveVerifyEntriesByWorkPacket(
    buildLiveVerifyText([['WP-901', 'verified'], ['WP-901', 'pending']]),
  );
  const [withEntries] = findRowTokenProblems(TOKENLESS_ROW, ownEntries);
  assert.equal(withEntries.rule, 'R1');
  assert.match(withEntries.detail, /add up to `partial`, so append ` \[live-verify: partial\]`\./);
  const [withoutEntries] = findRowTokenProblems(TOKENLESS_ROW, new Map());
  assert.match(
    withoutEntries.detail,
    /append ` \[live-verify: n\/a\]` if the WP is `none — infrastructure`, else ` \[live-verify: pending\]`\./,
  );
});

test('R2: the token equals the aggregate of the WP\'s own entries', () => {
  const cases: Array<[Array<[string, string]>, string]> = [
    [[['WP-901', 'verified'], ['WP-901', 'verified']], 'verified'],
    [[['WP-901', 'pending'], ['WP-901', 'pending']], 'pending'],
    [[['WP-901', 'verified'], ['WP-901', 'pending']], 'partial'],
    [[['WP-901', 'partial']], 'partial'],
    [[['WP-901', 'pending'], ['WP-901', 'partial']], 'partial'],
  ];
  for (const [pairs, aggregate] of cases) {
    const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText(pairs)).get('WP-901') ?? [];
    assert.equal(aggregateLiveVerifyState(entries), aggregate);
    for (const state of ['verified', 'partial', 'pending', 'n/a']) {
      const row = buildDoneRow('EC-940', ` [live-verify: ${state}]`);
      let expected: string[] = ['WP-901:R2'];
      if (state === aggregate) {
        expected = [];
      }
      assert.deepEqual(listTokenProblemRules(row, pairs), expected, `${state} token vs ${aggregate} record`);
    }
  }
});

test('R2: n/a with own entries fails; cited direct-fix entries do not count', () => {
  const notApplicableRow = buildDoneRow('EC-940', ' [live-verify: n/a]');
  assert.deepEqual(listTokenProblemRules(notApplicableRow, [['WP-901', 'verified']]), ['WP-901:R2']);
  const citingRow = buildDoneRow('D-24026 live-verify PASS 2026-11-01; D-24806 ✅', ' [live-verify: verified]');
  assert.deepEqual(
    listTokenProblemRules(citingRow, [['WP-901', 'verified'], ['D-24806', 'pending']]),
    [],
    'a pending direct-fix entry the row cites is not the WP\'s own and does not change its token',
  );
});

test('R2: an entry naming a lettered WP groups as its number, so the lettered row passes R2 in any state', () => {
  const pairs: Array<[string, string]> = [['WP-207a', 'pending']];
  assert.deepEqual([...groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText(pairs)).keys()], ['WP-207']);
  for (const state of ['verified', 'partial', 'pending', 'n/a']) {
    const row = `- [x] WP-207a — **A lettered packet** — **Done 2026-05-01**. [live-verify: ${state}]`;
    assert.deepEqual(listTokenProblemRules(row, pairs), [], `${state} passes on the lettered row`);
  }
});

test('R3: a verified or n/a token on prose that still reads pending fails; pending and partial pass', () => {
  const pendingProse = 'EC-940; **D-24026 live-verify operator-pending** on deploy';
  for (const state of ['verified', 'n/a']) {
    const row = buildDoneRow(pendingProse, ` [live-verify: ${state}]`);
    assert.deepEqual(listTokenProblemRules(row, []), ['WP-901:R3'], state);
  }
  for (const state of ['pending', 'partial']) {
    const row = buildDoneRow(pendingProse, ` [live-verify: ${state}]`);
    assert.deepEqual(listTokenProblemRules(row, []), [], state);
  }
  const passProse = 'EC-940; D-24026 live-verify PASS 2026-11-02 per live-verify.json (match `abc`)';
  assert.deepEqual(listTokenProblemRules(buildDoneRow(passProse, ' [live-verify: verified]'), []), []);
});

test('R2 and R3: the messages name the token, the aggregate, the prose and the add-a-pending-entry remedy', () => {
  const honestPartialRow = buildDoneRow(
    'live-verify (D-24026) partial: X PASS 2026-11-01 (match `abc`), Y operator-pending',
    ' [live-verify: partial]',
  );
  const problems = findRowTokenProblems(
    honestPartialRow,
    groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-901', 'verified']])),
  );
  assert.deepEqual(problems.map((problem) => problem.rule), ['R2']);
  assert.match(problems[0].detail, /token is `\[live-verify: partial\]`/);
  assert.match(problems[0].detail, /add up to `verified`/);
  assert.match(problems[0].detail, /prose reads "live-verify \(D-24026\) partial"/);
  const remedy =
    /add a `pending` live-verify\.json entry for that mechanic \(the aggregate becomes `partial`\); never reword true prose to pass\./;
  assert.match(problems[0].detail, remedy);
  const [proseProblem] = findRowTokenProblems(
    buildDoneRow('**D-24026 operator-pending**', ' [live-verify: verified]'),
    new Map(),
  );
  assert.equal(proseProblem.rule, 'R3');
  assert.match(proseProblem.detail, /token is `\[live-verify: verified\]`, but its prose reads "D-24026 operator-pending"/);
  assert.match(proseProblem.detail, /the aggregate is `pending`/);
  assert.match(proseProblem.detail, remedy);
});

test('stripping: the stale-row rule does not read a trailing pending token as pending prose', () => {
  const entries = groupLiveVerifyEntriesByWorkPacket(buildLiveVerifyText([['WP-901', 'verified']]));
  const row = buildDoneRow('EC-940; D-24026 live-verify PASS 2026-11-01 (match `abc`)', ' [live-verify: pending]');
  assert.notEqual(findPendingLiveVerifyText(row), null, 'unstripped, the token itself reads as pending');
  assert.equal(findPendingLiveVerifyText(stripLiveVerifyToken(row)), null);
  assert.deepEqual(findStaleLiveVerifyPendingRows(row, entries), [], 'the stale-row rule reads the stripped row');
});

test('stripping: R3 does not let the token serve as the operator-pending arm\'s live-verify anchor', () => {
  const row = buildDoneRow('EC-940; migration 026 PROD apply operator-pending', ' [live-verify: n/a]');
  assert.notEqual(findPendingLiveVerifyText(row), null, 'unstripped, the token is a live-verify anchor');
  assert.deepEqual(listTokenProblemRules(row, []), [], 'R3 reads the stripped row');
});

test('stripping: only the end-anchored, well-formed token is removed', () => {
  assert.equal(stripLiveVerifyToken(buildDoneRow('EC-940', ' [live-verify: partial]')), buildDoneRow('EC-940', ''));
  const malformedRows = [
    buildDoneRow('EC-940', ' [live-verify: pending-ish]'),
    buildDoneRow('EC-940', ' [live-verify: pending].'),
    buildDoneRow('EC-940', '[live-verify: pending]'),
  ];
  for (const row of malformedRows) {
    assert.equal(stripLiveVerifyToken(row), row, row);
  }
});
