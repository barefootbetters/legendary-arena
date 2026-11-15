# WP-896 — Live-Verify Row Token: every checked-off WORK_INDEX row carries one structured live-verify state token, checked against live-verify.json (Shared Tooling / governance docs)

**Status:** Done 2026-11-14 (EC-934; D-24853 Active; standard two-session lane; drafted 2026-11-14 with D-24853 reserved (#3386))
**Primary Layer:** Shared Tooling (governance script + governance docs)
**User-Visible Surface:** none — infrastructure
**Risk Tier:** LOW — a doc linter plus a one-time mechanical migration of `WORK_INDEX.md`; no runtime, engine, server, persistence or player surface. Standard two-session lane because D-24853 locks a cross-cutting row-format invariant (D-24028 criterion 5).

---

## Goal

Every done (`- [x]`) `WORK_INDEX.md` row ends with exactly one machine-readable
token, `[live-verify: verified|partial|pending|n/a]`, that is the row's
live-verify status of record. Where the WP has `docs/ai/coverage/live-verify.json`
entries, CI fails unless the token equals the state those entries add up to.
CI never writes the token, so every change of record forces a person to edit the
row by hand. That closes the last false negative D-24852 left open: a second
entry verified on a date the row already cites, under wording the prose pattern
cannot read.

## User-Visible Impact

`none — infrastructure`. Operator-facing only: a red **Coverage & Ledger Gates**
check when a done row has no token, a malformed or duplicate token, or a token
that disagrees with live-verify.json or with the row's own prose. STATUS.md
records "No user-observable change — infrastructure only".

## Assumes

- **Baseline:** `origin/main` @ `80c5e0ca8` (drafted 2026-11-14; counts re-checked there; includes the
  reserve PR #3386 for WP-896 / EC-934 / D-24853).
- **WP-895 / EC-933 ✅ and its three follow-ups ✅** (#3380, #3382, #3384,
  #3385): `scripts/check-workindex-liveverify-pending.mjs` already runs in the
  Coverage & Ledger Gates step `WORK_INDEX live-verify consistency check` (test,
  then check; `ci.yml` lines ~370–371). It exports
  `groupLiveVerifyEntriesByWorkPacket`, `groupDirectFixEntriesByDecision`,
  `listDirectFixDecisions`, `findPendingLiveVerifyText`,
  `findStaleLiveVerifyPendingRows`, `findUncitedVerificationDates`,
  `findUnattributedLiveVerifyEntries`. This WP extends that script and its test;
  the CI step is unchanged. ✅ on `main`.
- **live-verify.json:** `schemaVersion: 1`; `entries[].wp` names a WP, a
  direct-fix D-number or `none (<reason>)` (D-24852 follow-up 2); `state` ∈
  `verified | partial | pending` (no other value occurs). ✅.
- **Rows:** 865 done rows match the locked done selector (§Contract): 849
  numeric (`WP-NNN`) plus 16 lettered (WP-005A/B, WP-006A/B, WP-007A/B,
  WP-008A/B, WP-009A/B, WP-014A/B, WP-015A, WP-053a, WP-207a, WP-207b). 24 open
  rows. A row starts `- [x] WP-… — <title> … **Done …`; the rest is free text,
  and 229 numeric done rows have an irregular status block (`**Done**`,
  `**Done (code) …`, long parentheticals), so the row's **end** is the only
  stable token position. ✅ observed.
- **Other WORK_INDEX readers** parse only the row prefix or links:
  `check-workindex-rows.mjs` (`WORK_INDEX_ROW_PATTERN`),
  `check-workindex-executed-open.mjs`, `check-number-ledger.mjs`,
  `roadmap-counts.mjs`, `apps/dashboard/scripts/build-governance-snapshot.mjs`
  (same row pattern; title captured lazily up to `**Done`),
  `docs/ai/audits/sync-wp-status.mjs` (row prefix only) and
  `apps/wiki-viewer/scripts/project-wiki.mjs` (rewrites `.md` links only). ✅.
- Hard dependencies: WP-895 ✅. No other.

## Context (Read First)

- `scripts/check-workindex-liveverify-pending.mjs` + `.test.ts` — **AUTHORITATIVE
  for** the existing rules this WP must keep (prose pattern, cited direct-fix
  judging, date citation, attribution).
- `docs/ai/DECISIONS.md` D-24852 and its three dated amendments — the third
  names the residual this WP closes ("Closing that needs a structured
  live-verify field on the row, not more pattern").
- `docs/ai/DECISIONS.md` D-24026 — what live-verify is and when it is N/A.
- `docs/ai/work-packets/WORK_INDEX.md §Format` — the row-format rules this WP
  extends.
- `docs/ai/REFERENCE/01.0b-wp-execution-phase.md` Step 10 (govern-close files)
  and Step 11's D-24026 note; `docs/ai/execution-checklists/EC-TEMPLATE.md` D-24026
  bullet — where closers learn the token.
- Supersession check (01.0a Step 2, 2026-11-14): `git log --all --grep` for
  "live-verify token" / "liveverify-token" / "live-verify field", `ls
  docs/ai/work-packets/*token*`, `gh pr list --state all --search "live-verify
  token"` — no prior work (the only `*token*` WP is WP-112, session tokens).

## Design Rationale (scaffold-decided, D-24853)

**Why a token, not more pattern.** D-24852's three follow-ups closed every gap a
pattern can close. The residue is structural: free-text prose can say "still
owed" in words no pattern reads, and the date rule only forces a row edit when a
*new* date appears. A single field with a closed vocabulary, compared exactly
against the record, has no wording problem: any change in the aggregate state
fails CI until a person changes the field.

**Never auto-written.** The guard gets no `--write` mode and the WP ships no
writer. A writer would flip the token without anyone reading the row, which
re-opens the gap (token right, prose stale). The forced hand edit is the point:
the person flipping `partial` → `verified` is in the row and fixes the prose.

**Format and selectors.** ` [live-verify: <state>]` (leading space) is the
**last** text on a done row, exactly once. `<state>` ∈ `verified` | `partial` |
`pending` | `n/a`. Done rows are those matching
`^- \[x\] (WP-\d+[A-Za-z]?(?:\.\d+)?) ` (865 today; the §Format template line
`- [x] WP-NNN — …` and every `**(deferred …)**` / backlog line never match).
Open rows are those matching `^- \[ \] WP-\d`; they carry no `[live-verify:`
text (a drafted WP has no live-verify state; the closer adds the token when
flipping the row to `[x]`). The existing D-24852 rules keep their own numeric
done selector; only R1–R3 use the wider one.

**Meaning.** `n/a` — the WP's `User-Visible Surface` is `none — infrastructure`,
or the WP predates D-24026 (no `User-Visible Surface` header) and never made a
live-verify claim. `pending` — live-verify is owed and nothing is confirmed.
`partial` — some of it is confirmed. `verified` — all of it is confirmed. A
user-facing WP closes with the aggregate of its live-verify.json entries, or
`pending` if it has none; its live-verify `SPEC:` PR updates the token.

**Token stripping.** `stripLiveVerifyToken(row)` removes only the end-anchored,
well-formed token: `row.replace(/ \[live-verify: (verified|partial|pending|n\/a)\]$/, '')`.
A malformed or misplaced token is left in place (R1 reports it). Every prose
rule, existing and new, reads the stripped row; the scaffold showed why: the
token's own text "live-verify: pending" matches the prose pattern.

**Rules.**
- **R1 presence.** Every done row (wide selector) ends with exactly one
  well-formed token and contains no other `[live-verify:` text. No open row
  contains `[live-verify:`.
- **R2 record agreement.** If ≥1 live-verify.json entry names the WP (existing
  whole-token grouping, the WP's **own** entries), the token equals their
  aggregate: every entry `verified` → `verified`; every entry `pending` →
  `pending`; anything else → `partial`. `n/a` with entries always fails. A WP
  with no own entries: any state passes R2.
- **R3 prose agreement.** A token of `verified` or `n/a` fails if
  `findPendingLiveVerifyText(stripLiveVerifyToken(row))` is not null.
- **Why R2 reads own entries only.** The stale-prose rule also reads the
  entries of cited direct-fix D-numbers, but a cited fix is often not the WP's
  own work (WP-863 cites D-24802 without owning it), so R2 does not. The one
  combination this cannot satisfy — own entries all `verified`, a cited
  direct-fix entry not verified, prose honestly saying partial (R2 forces
  `verified`, R3 then fails) — does not occur today; its remedy is to add the WP
  to that entry's `wp` if the mechanic is the WP's, or rewrite the prose if it is
  not. Recorded in a `// why:` and in D-24853.
- **The honest-partial case and its remedy.** A WP records one mechanic
  `verified` while others are still owed and have no entry: R2 forces
  `verified` and R3 then fails the honest "partial" prose. The fix is never to
  reword true prose; it is to add a `pending` live-verify.json entry for each
  owed mechanic, which makes the aggregate `partial`. The R2 and R3 failure
  messages say exactly that (§Contract).
- **Lettered rows.** R1–R3 key rows by the full id (`WP-207a`), but the
  existing entry grouping (`/WP-\d+(?:\.\d+)?/g`) reads an entry naming
  `WP-207a` as `WP-207`. No entry names a lettered WP (all 214 checked), so
  lettered rows have no own entries by construction and R2 never fires for
  them; widening the grouping is out of scope. A `// why:` and a test pin it.

**Migration classification (in order; counts are recorded, not asserted — the
guard's R1–R3 are the only binary check).**
1. The WP has own entries → their aggregate.
2. The prose pattern reads pending or partial, and no PASS reading → that state.
3. A PASS / verified / CONFIRMED reading after a live-verify anchor, and no
   pending reading → `verified`.
4. Prose N/A (`live-verify N/A`, `User-Visible Surface = none`,
   `none — infrastructure`) → `n/a`.
5. No live-verify mention: read the WP file's `**User-Visible Surface:**` header.
   Strip leading `**` and backticks from the value; if `none` is then its first
   word, or there is no header → `n/a`; anything else → read by hand (WP-379's
   `**none — infrastructure**` is `n/a`).
6. Everything else → read by hand.

**Scaffold result (observed 2026-11-14 on `main` @ `3b1d04345`, re-counted on
`d5a2be112`).** A throwaway prototype of R1–R3 plus a one-shot migration, run
then discarded:
- Before migration: every done row fails R1.
- Classification of the 865 done rows: **from the record** 106 (101
  `verified`, 3 `pending`, 2 `partial`); **from prose** 416 (130 `verified`,
  192 `pending`, 1 `partial`, 93 `n/a`); **no live-verify mention** 288 — 256
  `n/a` (9 `none` headers, 247 no header) and 32 user-facing headers read by
  hand; **read by hand** 55 more (12 rows reading both pending and PASS, 43
  rows that mention live-verify with no readable state, e.g. "CONFIRMED
  2026-10-14", "live-verify via WP-807", "DEFERRED"). 87 hand rows in all.
- After migration (hand rows provisionally `pending`): R1–R3 report **0
  problems**; `workindex:rows:check`, `workindex:executed:check`,
  `workindex:liveverify:check`, `ledger:numbers:check`, `roadmap:counts:check`
  exit 0; `apps/dashboard` `workIndexRowPattern.test.ts` 4/4; the dashboard
  `governance-snapshot.json` built from the migrated index equals the one built
  from `main` (timestamps aside).

**The 87 hand rows** (each is read and decided; none may stay provisionally
`pending` unread). Pending + PASS: WP-894, WP-852, WP-746, WP-731, WP-595,
WP-300, WP-308, WP-318, WP-325, WP-349, WP-387, WP-489. Live-verify mentioned,
no readable state: WP-806, WP-724, WP-722, WP-718, WP-690, WP-688, WP-687,
WP-679, WP-678, WP-676, WP-642, WP-639, WP-637, WP-632, WP-605, WP-170, WP-255,
WP-260, WP-268, WP-290, WP-295, WP-319, WP-321, WP-341, WP-339, WP-287, WP-280,
WP-343, WP-369, WP-373, WP-374, WP-391, WP-390, WP-395, WP-396, WP-408, WP-410,
WP-420, WP-425, WP-432, WP-435, WP-487, WP-552. User-facing, no live-verify
mention: WP-877, WP-739, WP-689, WP-685, WP-664, WP-665, WP-667, WP-636,
WP-634, WP-631, WP-629, WP-628, WP-627, WP-623, WP-622, WP-621, WP-620, WP-619,
WP-618, WP-617, WP-615, WP-614, WP-613, WP-612, WP-611, WP-610, WP-609, WP-607,
WP-597, WP-328, WP-284, WP-283. Rule of thumb: some confirmed and some owed →
`partial`; "CONFIRMED"/"PASS" for all of it → `verified`; verified under
another WP ("via WP-807") → `verified` if that WP's recorded result covers this
WP's change, else `pending` — for a user-facing WP; a `none — infrastructure`
WP stays `n/a` (`n/a` keeps its two locked meanings);
a user-facing WP with no recorded result →
`pending`; owed or deferred → `pending`. Where the token is `verified`/`n/a` but
the prose still reads pending (R3), rewrite the prose to the result.

## Scope (In)

- **`scripts/check-workindex-liveverify-pending.mjs`** (modified) — R1–R3 per
  §Design Rationale: exported `findRowTokenProblems(workIndexText,
  entriesByWorkPacket)` returning one `{ workPacket, rule, detail }` per
  violation and exported `stripLiveVerifyToken(row)`, applied by every prose
  rule; a full-sentence report section; header-comment updates. No `--write`.
- **`scripts/check-workindex-liveverify-pending.test.ts`** (modified) — new
  cases: R1 (missing; duplicated; misplaced mid-row; malformed state; a lettered
  done row without a token fails; a token on an open row fails; the §Format
  template line and a backlog line are ignored; the R1 message names the token
  to append); R2 (all verified, all pending, mixed → partial; `n/a` with
  entries fails; correct token passes; cited direct-fix entries do not count;
  an entry naming `WP-207a` is grouped as `WP-207`, so a lettered row passes R2
  in any state); R3 (`verified`/`n/a` + pending prose fails;
  `pending`/`partial` + pending prose passes); the R2 and R3 messages name the
  add-a-`pending`-entry remedy; stripping, one test per prose-rule consumer:
  `findStaleLiveVerifyPendingRows` on a row ending ` [live-verify: pending]`
  whose entries are all verified and whose prose has no pending phrase returns
  nothing, the operator-pending arm does not treat the token as its
  live-verify anchor (a row whose only anchor is the token plus an
  "operator-pending" migration note, tokened `n/a`, passes R3), and a malformed
  token is not stripped.
  Existing tests keep passing; existing fixture rows gain a token only where a
  rule now requires one, never by weakening an assertion.
- **`docs/ai/work-packets/WORK_INDEX.md`** (modified) — the one-time migration
  per §Design Rationale, and the `## Format` section: the token, its four states
  and meanings, end-of-row placement, done rows only, hand-maintained, and the
  rule that a row's prose never enumerates the token vocabulary (e.g.
  `verified / partial / pending / n/a`) after a live-verify anchor and never
  quotes `[live-verify:` (honest phrases such as "D-24026 live-verify pending"
  stay allowed). Also `## Adding a New Work Packet` step 4: on completion,
  flip to `[x]` with the date and append the token.
- **`docs/ai/REFERENCE/01.0b-wp-execution-phase.md`** (modified) — Step 10
  govern-close bullet, locked text: "append the live-verify token: `n/a` for
  `none — infrastructure`; otherwise the aggregate of the WP's live-verify.json
  entries, or `pending` if it has none"; Step 11's D-24026 note: the
  live-verify `SPEC:` PR (or STATUS-flip commit) updates the token in the same
  commit as the live-verify.json entry.
- **`docs/ai/execution-checklists/EC-TEMPLATE.md`** (modified) — the D-24026
  bullet names the token in the After Completing live-verify item.
- **`docs/ai/REFERENCE/00.1-master-coordination-prompt.md`** (modified) — the
  WORK_INDEX check-off example gains the token.
- **`docs/ai/REFERENCE/01.0a-wp-drafting-phase.md`** (modified) — the
  Lightweight Lane D-24026 bullet: the STATUS-flip commit updates the row's
  token together with any live-verify.json entry, so a direct-to-`main` flip
  never reddens `main`.
- **`docs/ai/REFERENCE/01.6-post-mortem-checklist.md`** (modified) — the
  "WORK_INDEX.md — WP checked off" line adds "with its live-verify token".

## Out of Scope

- A writer, `--write` flag, or any CI step that edits WORK_INDEX.
- A committed migration script (the migration is a one-time scratch transform;
  the guard is its check).
- Changing `WORK_INDEX_ROW_PATTERN`, `check-workindex-rows.mjs`,
  `check-workindex-executed-open.mjs`, `roadmap-counts.mjs`,
  `build-governance-snapshot.mjs`, `sync-wp-status.mjs`, `project-wiki.mjs`, or
  `.github/workflows/ci.yml` (the existing step already runs this script). The
  `ci.yml` why-comment above that step (lines ~358–366) still describes only
  the stale-row rule; refreshing it is a named follow-up in D-24853 (an
  `INFRA:` commit, since an `EC-###:` commit may not touch workflows, D-24444).
- The existing D-24852 rules' own selectors and logic (only token stripping is
  added to them).
- Surfacing token counts on the dashboard or in STATUS (a possible follow-up).
- live-verify.json, its schema, or other ledgers / the marketing repo.

## Files Expected to Change

- `scripts/check-workindex-liveverify-pending.mjs` — **modified** — R1–R3, `stripLiveVerifyToken`, `findRowTokenProblems`, report.
- `scripts/check-workindex-liveverify-pending.test.ts` — **modified** — the new cases in §Scope (In).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — 865-row migration, `## Format` section, this WP's own row.
- `docs/ai/REFERENCE/01.0b-wp-execution-phase.md` — **modified** — Step 10 bullet, Step 11 note.
- `docs/ai/execution-checklists/EC-TEMPLATE.md` — **modified** — D-24026 bullet.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — **modified** — check-off example.
- `docs/ai/REFERENCE/01.0a-wp-drafting-phase.md` — **modified** — Lightweight Lane D-24026 bullet.
- `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` — **modified** — WORK_INDEX check-off line.
- Governance: this WP, EC-934, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/DECISIONS.md` (D-24853), `docs/ai/STATUS.md`,
  `docs/ai/NUMBER-LEDGER.md` (`LANDED` stamps).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets. ESM only, Node v22+, `node:` prefixes. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full words, no nested ternaries, `// why:` on non-obvious constants).
- No new npm dependency. Node built-ins only (`node:fs`, `node:path`, `node:url`, `node:process`; test `node:test`, `node:assert`).
- The guard stays detect-only and never writes a file; no writer is added anywhere.
- MUST exit 0 on the branch at the close and on `main` after the merge; never weaken a rule to pass.
- **Merge discipline.** `main` branch protection is `strict: false`, so a closing PR branched before this one can merge a token-less row and turn `main` red. Immediately before merging: scan open PRs touching `WORK_INDEX.md` or live-verify.json (Verification Step 8), rebase on the current `origin/main`, token any new done rows by the same classification, re-run the check; merge by hand (no auto-merge). After the merge, run `pnpm workindex:liveverify:check` on `main`; if a racing close lands a token-less row, fix it in a `SPEC:` follow-up at once.
- The migration is mechanical except the 87 listed rows, which are read and decided one by one; the PR lists each hand decision.
- **Session protocol:** if any Assumes item is false or a classification rule is unclear for a row, STOP and ask. One WP per session.
- **Locked contract values:** §Contract, carried into EC-934 §Locked Values (condensed; no value differs); the WP wins on any difference.

## Contract

- **Done selector (R1–R3):** `^- \[x\] (WP-\d+[A-Za-z]?(?:\.\d+)?) `. **Open selector:** `^- \[ \] WP-\d`.
- **Token:** ` [live-verify: <state>]`, the last text on a done row, exactly once,
  and no other `[live-verify:` text on the row; regex
  ` \[live-verify: (verified|partial|pending|n\/a)\]$`; no `[live-verify:` on an
  open row.
- **Strip:** `stripLiveVerifyToken(row) = row.replace(/ \[live-verify: (verified|partial|pending|n\/a)\]$/, '')`; every prose rule reads the stripped row.
- **Aggregate (R2):** over the WP's own entries (whole-token `wp`): all
  `verified` → `verified`; all `pending` → `pending`; otherwise `partial`.
  No own entries: any state passes R2. `n/a` with own entries fails.
- **Prose agreement (R3):** token ∈ {`verified`, `n/a`} ∧
  `findPendingLiveVerifyText(stripLiveVerifyToken(row)) !== null` → fail.
- **Lettered rows:** keyed by the full id; they have no own entries (the
  grouping reads `WP-207a` as `WP-207`), so R2 passes them in any state.
- **Failure text (locked substance, full sentences):** R1 names the row; when
  the WP has own entries it names their aggregate as the token to append,
  otherwise it states the rule as a condition: "append ` [live-verify: n/a]` if
  the WP is `none — infrastructure`, else ` [live-verify: pending]`". The guard
  reads no WP files. R2 and R3 name the row, the token,
  the aggregate and the matched prose, and say: set the token to the aggregate;
  if the row honestly says some mechanic is still owed, add a `pending`
  live-verify.json entry for that mechanic (the aggregate becomes `partial`);
  never reword true prose to pass.
- **Exit codes:** 0 consistent; 1 any violation of R1–R3 or an existing rule.
- **Never written by tooling:** no `--write`, no writer script, no CI edit.

## Vision Alignment

- **Vision clauses touched:** none — §17 N/A: a CI doc linter and a governance-doc migration; touches no §17.1 surface.
- **Conflict assertion:** No conflict — keeps the WP ledger honest; no player, monetization or persuasion surface.
- **Non-Goal proximity:** N/A — NG-1..7 not approached.
- **Determinism preservation:** N/A — no `G`, RNG, replay, scoring or hash surface.

## Funding Surface Gate

§20 N/A — governance tooling; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** After the migration, `pnpm workindex:liveverify:check` exits 0 on the branch; on unmigrated `main` it exits 1 with one R1 line per done row (865 at draft; the count at execution is recorded).
- **AC-2** Every row matching the done selector ends with exactly one well-formed token and has no other `[live-verify:` text; no row matching the open selector contains `[live-verify:`.
- **AC-3** For every WP with own live-verify.json entries the token equals their aggregate (R2), shown by a unit test per aggregate and by the clean run.
- **AC-4** A `verified`/`n/a` token on a row whose stripped prose reads pending fails (R3); a `pending` token alone never reads as pending prose.
- **AC-5** `workindex:rows:check`, `workindex:executed:check`, `ledger:numbers:check`, `roadmap:counts:check` exit 0; `apps/dashboard` tests pass; the governance snapshot built on `main` with only `WORK_INDEX.md` swapped for the branch's differs from main's own snapshot only in WP-896's own row (Draft → Done) in `throughput` / `governanceKpis` (`generatedAt` ignored).
- **AC-6** `WORK_INDEX.md §Format` and `§Adding a New Work Packet`, 01.0b Steps 10–11, EC-TEMPLATE's D-24026 bullet, the 00.1 check-off example, the 01.0a Lightweight Lane D-24026 bullet and the 01.6 check-off line describe the token; no tooling writes it.
- **AC-7** The R1 message names the token to append, and the R2 and R3 messages name the add-a-`pending`-entry remedy (unit tests assert both).

## Verification Steps

1. `pnpm workindex:liveverify:test` → all pass (count recorded in the close).
2. `pnpm workindex:liveverify:check` → exit 0.
3. Control on unmigrated `main` (no stash), in PowerShell:
   ```pwsh
   Copy-Item docs/ai/work-packets/WORK_INDEX.md $env:TEMP\wi-migrated.md
   git restore --source=origin/main --worktree -- docs/ai/work-packets/WORK_INDEX.md   # byte-exact; no console re-encoding
   pnpm workindex:liveverify:check   # exit 1, one R1 line per done row (record the count)
   Copy-Item $env:TEMP\wi-migrated.md docs/ai/work-packets/WORK_INDEX.md
   ```
4. Mutation proofs, each followed by the test and a restore: R1 off, R2 replaced by "always verified", R3 off, and stripping removed **at each place it is applied, separately** (at least R3 and `findStaleLiveVerifyPendingRows`, plus the operator-pending anchor test if it strips on its own) — each mutation turns a test red.
5. `pnpm workindex:rows:check`, `workindex:executed:check`, `ledger:numbers:check`, `roadmap:counts:check` → 0; `pnpm --filter @legendary-arena/dashboard test` → 0 fail.
6. Governance snapshot (index swap only): `git worktree add --detach $env:TEMP\wt-main origin/main`; in it run `node apps/dashboard/scripts/build-governance-snapshot.mjs` and copy `apps/dashboard/src/data/governance-snapshot.json` aside; copy the branch's `docs/ai/work-packets/WORK_INDEX.md` over the worktree's, rebuild, and compare the two with `generatedAt` removed (`node -e "const f=(p)=>{const o=JSON.parse(require('fs').readFileSync(p,'utf8'));delete o.generatedAt;return o};console.log(require('util').isDeepStrictEqual(f(process.argv[1]),f(process.argv[2])))" <main.json> <swapped.json>` prints `false`; then diff the two files to see the delta) → the only difference is WP-896's own row (Draft → Done) in `throughput` / `governanceKpis`; then `git worktree remove --force $env:TEMP\wt-main`.
7. `git diff --name-only origin/main` equals the EC allowlist.
8. Immediately before merging, list the open PRs that touch the two files:
   ```pwsh
   gh pr list --state open --limit 200 --json number,title,files --jq '.[] | select(any(.files[]; .path == "docs/ai/work-packets/WORK_INDEX.md" or .path == "docs/ai/coverage/live-verify.json")) | "\(.number) \(.title)"'
   ```
   For each: turn off auto-merge on it or comment the token requirement on it, and list those PRs in this PR's body. Then rebase on current `origin/main`, token any new done rows, re-run steps 1–2, and merge by hand. After the merge: `pnpm workindex:liveverify:check` on `main` → 0.

## Definition of Done

- [ ] AC-1..AC-7 hold; Verification Steps 1–8 observed and recorded in the close.
- [ ] No file outside the EC allowlist changed.
- [ ] Each of the 87 hand-classified rows is listed with its decision in the PR body.
- [ ] This WP's own row ends with ` [live-verify: n/a]`, does not enumerate the token vocabulary after a live-verify anchor, does not quote `[live-verify:`, and passes the check.
- [ ] `DECISIONS.md` D-24853 Active; `STATUS.md` close-out says "No user-observable change — infrastructure only".
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`; NUMBER-LEDGER lines stamped `LANDED`.

## Reserved Decision (lands at execution)

**D-24853 — Every done WORK_INDEX row ends with exactly one
`[live-verify: verified|partial|pending|n/a]` token, the row's live-verify status
of record; CI checks it against the WP's own live-verify.json entries and the
row's prose, and never writes it.** Records the selectors, format and
placement, the four states and their meanings, token stripping, R1–R3, why R2
reads own entries only and the remedy for the cited-direct-fix conflict, the
honest-partial remedy (add a `pending` entry, never reword true prose), that a
**user-facing** WP verified under another WP is `verified` or `pending` (never
`n/a`) while a `none — infrastructure` WP stays `n/a`, the
lettered-row grouping note, why no writer exists (the hand edit is the forcing
touch), the migration classification and counts, the merge discipline, the
named follow-up (refresh the `ci.yml` why-comment in an `INFRA:` commit), and
that it closes D-24852's last residual.

## Lint Gate Self-Review (00.3)

Run as an independent subagent 2026-11-14; its two FAILs (§13 Steps 3/6/8,
§14 AC-5 snapshot equality) and one §2 note were fixed in place, then
re-confirmed. §1–§9, §12–§16 (incl. §15.1 `none — infrastructure`, §15.2
`LOW`, EC verbatim) PASS; §10 N/A — no env vars; §11 N/A — no auth; §17 N/A —
no §17.1 surface; §18 N/A — no grep Verification Step; §19 applied at commit
(rebased on current `origin/main`, counts re-checked); §20 N/A — governance
tooling, no funding affordance or copy; §21 N/A per D-11804 — no HTTP endpoint
or server-reachable library function.

**Gate history (01.0a Step 5, each an independent subagent).** 01.4 pre-flight:
NOT READY (PS-1 the done selector missed the 16 lettered rows; PS-2 no-mention
rows include 32 user-facing WPs that cannot default to `n/a`; RS-1..RS-9
clarifications) → fixed in place → READY TO EXECUTE, re-confirmed after every
later edit. 01.7 copilot: RISK/HOLD (8 findings: locked failure text and the
honest-partial remedy, `n/a` meaning for WPs verified elsewhere, the
vocabulary rule, three closer docs added to the allowlist and the `ci.yml`
comment named as a follow-up, per-consumer stripping proofs, the Step 10 text,
lettered-row grouping, the open-PR scan) → fixed → two wording fixes → PASS.
