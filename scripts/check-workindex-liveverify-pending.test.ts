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
 *   - Malformed JSON and an unknown schemaVersion fail loudly.
 *
 * Cheat-proof: fixtures are never mutated; each negative keeps a real pending
 * phrase on a real `- [x]` row, so a pass means the guard discriminated on the
 * live-verify record, not that the input was neutered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  findPendingLiveVerifyText,
  findStaleLiveVerifyPendingRows,
  findUnattributedLiveVerifyEntries,
  groupLiveVerifyEntriesByWorkPacket,
  listDirectFixDecisions,
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

test('malformed or unknown-schema live-verify.json fails with a full-sentence error', () => {
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('{not json'), /not valid JSON/);
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('{"schemaVersion":1}'), /no `entries` array/);
  assert.throws(
    () => groupLiveVerifyEntriesByWorkPacket('{"schemaVersion":2,"entries":[]}'),
    /schemaVersion 2, but this check reads schemaVersion 1/,
  );
  assert.throws(() => groupLiveVerifyEntriesByWorkPacket('[]'), /schemaVersion undefined/);
});
