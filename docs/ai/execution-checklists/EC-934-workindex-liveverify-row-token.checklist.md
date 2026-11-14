# EC-934 — Live-Verify Row Token (Execution Checklist)

**Source:** docs/ai/work-packets/WP-896-workindex-liveverify-row-token.md
**Layer:** Shared Tooling (governance script + governance docs)
**Risk Tier:** LOW — a doc linter plus a one-time mechanical migration of `WORK_INDEX.md`; no runtime, engine, server, persistence or player surface. Standard two-session lane because D-24853 locks a cross-cutting row-format invariant (D-24028 criterion 5).

## Before Starting
- [ ] `origin/main` includes #3386 (reserve) and the WP-896 / EC-934 draft SPEC; WP-895 ✅ and its follow-ups #3382 / #3384 / #3385 are on `main`.
- [ ] `scripts/check-workindex-liveverify-pending.mjs` exports the seven helpers named in WP §Assumes and runs in CI step `WORK_INDEX live-verify consistency check`. If not, STOP.
- [ ] `pnpm workindex:liveverify:check` exits 0 and `pnpm workindex:liveverify:test` passes on the baseline (record the count).
- [ ] Re-run the WP §Design Rationale classification on the current `main`; classify done rows added since the draft by the same rules and record the counts.
- [ ] Scope lock: exactly §Files to Produce; any other edit = FAIL — surface it first.

## Locked Values (do not re-derive)
- Done selector (R1–R3): `^- \[x\] (WP-\d+[A-Za-z]?(?:\.\d+)?) ` (865 at draft, incl. 16 lettered). Open selector: `^- \[ \] WP-\d`. The existing D-24852 rules keep their numeric selector.
- Token: ` [live-verify: <state>]`, last text on a done row, exactly once, no other `[live-verify:` text on the row; regex ` \[live-verify: (verified|partial|pending|n\/a)\]$`. No `[live-verify:` on an open row.
- States: `verified` all confirmed; `partial` some; `pending` owed, none; `n/a` = `none — infrastructure`, or no `User-Visible Surface` header and no live-verify claim. A user-facing WP verified under another WP is `verified` (that result covers it) or `pending`, never `n/a`; a `none — infrastructure` WP stays `n/a`.
- `stripLiveVerifyToken(row) = row.replace(/ \[live-verify: (verified|partial|pending|n\/a)\]$/, '')`; every prose rule (existing and R3) reads the stripped row; a malformed token is not stripped.
- R2 over the WP's own entries only: all `verified` → `verified`; all `pending` → `pending`; else `partial`; `n/a` with own entries fails; no own entries → any state. Lettered rows have no own entries (grouping reads `WP-207a` as `WP-207`).
- R3: token ∈ {`verified`, `n/a`} ∧ `findPendingLiveVerifyText(stripLiveVerifyToken(row)) !== null` → fail.
- Failure text: R1 names the own entries' aggregate when there are any, else states "append ` [live-verify: n/a]` if the WP is `none — infrastructure`, else ` [live-verify: pending]`" (the guard reads no WP files). R2/R3 name row, token, aggregate, prose, and say: set the token to the aggregate; if a mechanic is honestly still owed, add a `pending` live-verify.json entry for it; never reword true prose to pass.
- 01.0b Step 10 bullet text: "append the live-verify token: `n/a` for `none — infrastructure`; otherwise the aggregate of the WP's live-verify.json entries, or `pending` if it has none".
- Format rule: prose never enumerates the token vocabulary after a live-verify anchor and never quotes `[live-verify:`; honest "live-verify pending" phrases stay allowed.
- New exports: `findRowTokenProblems(workIndexText, entriesByWorkPacket)` → `{ workPacket, rule, detail }[]`; `stripLiveVerifyToken(row)`.
- Migration order: own entries → aggregate; pending/partial prose (no PASS) → that; PASS/verified/CONFIRMED (no pending) → `verified`; prose N/A → `n/a`; no mention → WP file `User-Visible Surface` (strip leading `**`/backticks; `none` as first word or no header → `n/a`, else by hand); rest by hand. 87 hand rows at draft (WP §Design Rationale). Counts are recorded, not asserted.
- Exit 0 = consistent; 1 = any violation.

## Guardrails
- Detect-only. No `--write`, no writer script, no CI edit; the token is hand-maintained by design.
- Never weaken a rule or an existing assertion to pass; a fixture row gains a token only where a rule now requires one.
- Each hand row is read; none stays provisionally `pending` unread. Where the token is `verified`/`n/a` and the prose still reads pending, rewrite the prose to the result.
- No new npm dependency; Node built-ins only. `WORK_INDEX_ROW_PATTERN`, every other WORK_INDEX reader and `ci.yml` stay untouched (its why-comment refresh is a D-24853 follow-up).
- The migration script is scratch; it is not committed.
- Merge by hand after the open-PR scan, a fresh rebase and a re-run (no auto-merge; `main` protection is `strict: false`); run the check on `main` after the merge.

## Required `// why:` Comments
- The token sits at the row's end (irregular status blocks make any other position unstable).
- The wide done selector (lettered rows are done rows too) vs the existing numeric one, and that lettered rows have no own entries.
- Token stripping before prose rules (the token's own "live-verify: pending" text matches the prose pattern).
- No writer exists: the hand edit forces a person to reread the row.
- The R2 aggregate (`partial` for any mix), why it reads own entries only, the cited-direct-fix remedy, and the honest-partial remedy.

## Files to Produce
- `scripts/check-workindex-liveverify-pending.mjs` — **modified** — R1–R3, `stripLiveVerifyToken`, `findRowTokenProblems`, report, header comment.
- `scripts/check-workindex-liveverify-pending.test.ts` — **modified** — R1, R2, R3, message, lettered and per-consumer stripping cases (WP §Scope In).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — migration, `## Format`, `## Adding a New Work Packet` step 4, own row.
- `docs/ai/REFERENCE/01.0b-wp-execution-phase.md` — **modified** — Step 10 bullet, Step 11 D-24026 note.
- `docs/ai/execution-checklists/EC-TEMPLATE.md` — **modified** — D-24026 bullet.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md`, `01.0a-wp-drafting-phase.md`, `01.6-post-mortem-checklist.md` — **modified** — check-off example, Lightweight Lane D-24026 bullet, check-off line.
- Governance: WP-896, this EC, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md` (D-24853), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`.
- Commit topology: `EC-934:` script + test + migration + docs → `SPEC:` governance close; one PR.

## After Completing
- [ ] `pnpm workindex:liveverify:test` all pass (count recorded); `pnpm workindex:liveverify:check` 0; control on unmigrated `main` exits 1 with one R1 line per done row (count recorded).
- [ ] Mutation proofs red: R1 off, R2 "always verified", R3 off, stripping removed at each place it is applied separately; then restored.
- [ ] `workindex:rows:check`, `workindex:executed:check`, `ledger:numbers:check`, `roadmap:counts:check` 0; dashboard tests 0 fail; governance snapshot built on a detached `origin/main` worktree with only `WORK_INDEX.md` swapped differs from main's only in WP-896's own row (`generatedAt` ignored; WP Verification Step 6).
- [ ] PR body lists each hand decision and each open PR touching `WORK_INDEX.md` / live-verify.json (auto-merge off or token requirement commented).
- [ ] `git diff --name-only origin/main` = §Files to Produce.
- [ ] Own row ends ` [live-verify: n/a]`, enumerates no token vocabulary after a live-verify anchor, quotes no `[live-verify:`.
- [ ] D-24853 Active (incl. the `ci.yml` why-comment follow-up); STATUS says "No user-observable change — infrastructure only"; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; NUMBER-LEDGER `; LANDED <date>`. Live-verify (D-24026): N/A.
- [ ] Rebased on fresh `origin/main` and re-checked right before a hand merge; `pnpm workindex:liveverify:check` 0 on `main` after it.

## Common Failure Smells
- Hundreds of R3 failures after migration → token stripping missing (the token reads as prose).
- The 16 lettered rows pass without a token → R1 uses the numeric selector.
- WP-862 or WP-864 tokened `verified` → R2 aggregate wrong (both have non-verified own entries).
- A closer rewords true "partial" prose to clear R3 → the remedy is a `pending` entry, not new prose.
- `main` red right after the merge → a racing close landed a token-less row; token it in a `SPEC:` follow-up.
