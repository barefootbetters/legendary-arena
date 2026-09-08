/**
 * Tests for the govern-close consistency guard (WP-671 / EC-708 / D-24485).
 *
 * The pure helpers are data-injected — every case passes strings in, so the
 * test needs no file I/O and never runs the check's `main()` (guarded behind
 * `isRunDirectly()`). Coverage:
 *   - POSITIVE (non-vacuous): a synthetic executed-but-open row per EACH signal
 *     FAILS (owned decision Active; own-clause executed-text). If the guard
 *     logic were reverted these assertions would not hold.
 *   - NEGATIVE: a clean `- [x]` row (any decision state), a legitimately-drafted
 *     `- [ ]`+Drafted row, a cross-WP-reference row, the template placeholder,
 *     and a backlog row all PASS.
 *   - OWNED-DECISION keying: a `- [ ]` row that merely CITES an Active decision
 *     (`per D-4201`, not `reserves`) does NOT trip.
 *   - WP-671's OWN row is an explicit negative fixture (AC-6): its prose carries
 *     all three executed-text tokens while its status clause says "drafted".
 *
 * Cheat-proof: the asserted-over fixtures are never mutated, and each negative
 * keeps the elements under test intact (a real `[ ]`, a real Active-decision
 * set) so a pass means the guard discriminated, not that the input was neutered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractActiveDecisionNumbers,
  extractOwnedDecisionNumber,
  extractOwnStatusClause,
  findExecutedButOpenRows,
} from './check-workindex-executed-open.mjs';

// A DECISIONS sample exercising both Active forms and the Drafted form.
const DECISIONS_SAMPLE = [
  '### D-24484 — Scheme Transform first slice (Active 2026-09-08 — WP-670 / EC-707)',
  '',
  '**Context.** Nine double-sided Schemes …',
  '',
  '### D-24485 — Govern-close consistency guard (WP-671 / EC-708)',
  '',
  '**Status:** Drafted 2026-09-08; not yet landed (flips to Active at execution).',
  '',
  '### D-9001 — Some decision with a Status line (WP-900 / EC-900)',
  '',
  '**Status:** Active 2026-08-01',
  '',
  '### D-4201 — An old, long-Active decision (Active 2026-01-01 — WP-042 / EC-050)',
  '',
  '**Context.** Deferred seeding sections …',
].join('\n');

test('extractActiveDecisionNumbers reads both the heading suffix and the **Status:** line', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  assert.ok(active.has('D-24484'), 'heading-suffix Active entry is Active');
  assert.ok(active.has('D-9001'), '**Status:** Active line makes an entry Active');
  assert.ok(active.has('D-4201'), 'the old Active decision is Active');
  assert.ok(!active.has('D-24485'), 'a **Status:** Drafted entry is NOT Active');
});

test('extractOwnedDecisionNumber keys on `reserves`, not a bare citation', () => {
  assert.equal(
    extractOwnedDecisionNumber('… — **Draft** (EC-708; reserves **D-24485**; drafted off …'),
    'D-24485',
    'a reserves-keyed decision is owned',
  );
  assert.equal(
    extractOwnedDecisionNumber('… Reserves **EC-672 + D-24450**. See …'),
    'D-24450',
    'a reserves phrase with EC + D returns the D-number',
  );
  assert.equal(
    extractOwnedDecisionNumber('… deferred by WP-042 per D-4201: §B.3/B.4 …'),
    null,
    'a bare "per D-4201" citation is a hard-dep, not ownership',
  );
});

test('extractOwnStatusClause captures the marker + immediate parenthetical, not the prose', () => {
  const wp671Row =
    '- [ ] WP-671 — Govern-Close Consistency Guard — **Draft 2026-09-08** (EC-708; reserves **D-24485**; drafted off `origin/main`). Adds a CI guard for the executed-but-row-open drift; signal … the git-`EC-###`-commit ground truth.';
  const clause = extractOwnStatusClause(wp671Row);
  assert.ok(clause.includes('draft'), 'the status marker is captured');
  assert.ok(clause.includes('drafted off'), 'the immediate parenthetical is captured');
  assert.ok(!clause.includes('executed-but-row-open'), 'the descriptive prose is excluded');

  const blockedRow =
    '- [ ] WP-042.1 — Deployment Checklists. **Blocked** on Foundation Prompt 03 revival (seed runner + migrations).';
  const blockedClause = extractOwnStatusClause(blockedRow);
  assert.equal(blockedClause, 'blocked', 'prose after the marker is not part of the clause');
});

test('POSITIVE (owned-D-Active): a `- [ ]` row whose reserved decision is Active FAILS', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  const driftRow =
    '- [ ] WP-670 — Scheme Transform runtime — **Draft 2026-09-08** (EC-707; reserves **D-24484**; off `origin/main`).';
  const violations = findExecutedButOpenRows(['# WORK_INDEX', driftRow].join('\r\n'), active);
  assert.equal(violations.length, 1, 'the owned-D-Active drift row is flagged');
  assert.equal(violations[0]?.workPacket, 'WP-670');
  assert.ok(
    violations[0]?.trippedSignals.some((signal) => signal.includes('D-24484 is Active')),
    'the report names the Active owned decision',
  );
});

test('POSITIVE (own-clause executed-text): a `- [ ]` row marked executed FAILS', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  // The exact WP-669/670 real drift phrasing, with a decision the sample does
  // NOT mark Active — so ONLY the executed-text signal can catch it.
  const driftRow =
    '- [ ] WP-669 — Mastermind Transform runtime — **Executed 2026-09-08, pending PR** (EC-706; reserves **D-7777**).';
  const violations = findExecutedButOpenRows(['# WORK_INDEX', driftRow].join('\r\n'), active);
  assert.equal(violations.length, 1, 'the executed-text drift row is flagged');
  assert.equal(violations[0]?.workPacket, 'WP-669');
  assert.ok(
    violations[0]?.trippedSignals.some((signal) => signal.includes('executed')),
    'the report names the executed-text signal',
  );
  assert.ok(
    !active.has('D-7777'),
    'guard: the row is caught by executed-text alone, not by an Active decision',
  );
});

test('NEGATIVE: a clean `- [x]` row passes even with an Active owned decision and executed-text', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  const checkedRow =
    '- [x] WP-670 — Scheme Transform runtime — **Shipped 2026-09-08** (EC-707; **D-24484**; executed off `origin/main`).';
  assert.deepEqual(
    findExecutedButOpenRows(['# WORK_INDEX', checkedRow].join('\r\n'), active),
    [],
    'a checked row is the correct closed state and never trips',
  );
});

test('NEGATIVE: a legitimately-drafted `- [ ]`+Drafted row passes', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  const draftRow =
    '- [ ] WP-671 — Govern-Close Consistency Guard — **Draft 2026-09-08** (EC-708; reserves **D-24485**; drafted off `origin/main`).';
  assert.deepEqual(
    findExecutedButOpenRows(['# WORK_INDEX', draftRow].join('\r\n'), active),
    [],
    'Drafted owned decision + non-executed status clause = legitimately open',
  );
});

test('NEGATIVE (AC-3): a `- [ ]` row citing ANOTHER WP as shipped does not trip', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  const crossReferenceRow =
    '- [ ] WP-900 — Some Draft WP — **Draft 2026-09-08** (EC-901; reserves **D-24485**). Builds on WP-670 shipped 2026-09-08 and the WP-669 executed arc.';
  assert.deepEqual(
    findExecutedButOpenRows(['# WORK_INDEX', crossReferenceRow].join('\r\n'), active),
    [],
    'executed-text in a cross-WP reference (prose) is outside the own status clause',
  );
});

test('NEGATIVE (AC-5): a `- [ ]` row that merely CITES an Active decision does not trip', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  // WP-042.1's real shape: "per D-4201" (a bare citation, and D-4201 is Active),
  // status marker Blocked, no executed-text.
  const blockedRow =
    '- [ ] WP-042.1 — Deployment Checklists: Deferred PostgreSQL Seeding Sections. **Blocked** on Foundation Prompt 03 revival (seed runner + migrations). Authors four checklist sections deferred by WP-042 per D-4201.';
  assert.ok(active.has('D-4201'), 'guard: D-4201 really is Active in the sample');
  assert.deepEqual(
    findExecutedButOpenRows(['# WORK_INDEX', blockedRow].join('\r\n'), active),
    [],
    'a cited-but-not-reserved Active decision is not ownership',
  );
});

test('NEGATIVE (AC-6): non-WP rows — template placeholder and backlog — are skipped', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  const content = [
    '- [ ] WP-NNN — Short Title — [pending | in-progress | blocked: reason]',
    '- [x] WP-NNN — Short Title — Completed YYYY-MM-DD',
    '- [ ] **(backlog — to be drafted)** Something executed and shipped in prose per D-24484.',
    '- WP-999 — a NUMBER-LEDGER-style reservation line (no checkbox) reserves **D-24484**.',
  ].join('\r\n');
  assert.deepEqual(
    findExecutedButOpenRows(content, active),
    [],
    'template (literal WP-NNN), backlog (leading bold), and no-checkbox lines are not WP rows',
  );
});

test('NEGATIVE (AC-6 sharpest): WP-671 own row — executed-text in prose but drafted status clause — passes', () => {
  const active = extractActiveDecisionNumbers(DECISIONS_SAMPLE);
  // The real WP-671 row: descriptive prose carries `executed`, `shipped` and
  // `pending-PR`, but the status marker is Draft and the owned D-24485 is Drafted.
  const ownRow =
    '- [ ] WP-671 — Govern-Close Consistency Guard: fail CI on a WORK_INDEX `[ ]` row whose WP has executed (Shared Tooling / CI) — **Draft 2026-09-08** (EC-708; reserves **D-24485**; drafted off `origin/main` @ `12990598`). Adds a CI guard for the recurring executed-but-row-open drift (WP-391; WP-657..665; WP-669/670): fails when a WORK_INDEX `[ ]` row has demonstrably executed or shipped — signal scaffold-decided among owned-D-Active, own-clause executed-text (`pending commit/PR`), and the git commit.';
  assert.deepEqual(
    findExecutedButOpenRows(['# WORK_INDEX', ownRow].join('\r\n'), active),
    [],
    "WP-671's own row must not self-trip — the own-clause scan sees only the drafted marker",
  );
});
