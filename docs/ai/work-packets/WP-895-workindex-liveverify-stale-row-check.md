# WP-895 — Live-Verify Stale-Row Guard: fail CI on a done WORK_INDEX row that still says its live-verify is pending after live-verify.json records it verified (Shared Tooling / CI)

**Status:** Draft — pending execution (Lightweight Lane, D-24028)
**Primary Layer:** Shared Tooling (governance scripts + CI)
**User-Visible Surface:** none — infrastructure
**Risk Tier:** LOW — a detect-only doc linter in CI; no runtime, engine, server, persistence or player surface. Lightweight Lane (D-24028).
**Lane note:** Lightweight Lane — draft, scaffold, execution and close ship on one branch in one PR (`SPEC:` draft → `EC-933:` → `INFRA:` → `SPEC:` close).

---

## Goal

Add a CI guard that fails when a done (`- [x]`) `WORK_INDEX.md` WP row still
says its D-24026 live-verify is pending ("live-verify operator-pending",
"D-24026 operator-pending", …) while every `docs/ai/coverage/live-verify.json`
entry whose `wp` field names that WP has `state: "verified"`. Today the drift is
caught only by a manual reconciliation pass; this makes it a red check on the PR
that records the verification without fixing the row.

## User-Visible Impact

`none — infrastructure`. Operator-facing only: a red **Coverage & Ledger Gates**
check on any PR that leaves a live-verified WP's row saying "pending". STATUS.md
records this as infrastructure with no player-observable change.

## Assumes

- **Baseline:** `origin/main` @ `02a0bf623` (drafted 2026-11-14; includes the #3376 reserve and #3372).
- **The drift is real and file-detectable.** Live-verify results land in
  `docs/ai/coverage/live-verify.json` or a `SPEC:` live-verify PR, and neither has
  to touch the WP's WORK_INDEX row. The 2026-11-14 reconciliation fixed 91 stale
  rows across #3371 (WP-870/872/875), #3373 (13 rows, WP-862..893) and #3374 (75
  older rows). ✅ verified: those three PRs are on `main`.
- **live-verify.json shape:** `{ schemaVersion: 1, about, entries: [...] }`; each
  entry has a free-text `wp` field (mostly `WP-NNN`, sometimes `WP-674; #3150`,
  `D-24801 (#3155)` or empty) and `state` ∈ `verified | partial | pending`.
  At baseline: 214 entries (195 verified, 6 partial, 13 pending), naming 106 WPs. ✅.
- **`scripts/check-workindex-executed-open.mjs`** (WP-671 / D-24485) is the idiom
  to mirror: parse docs → exit 1 with a full-sentence per-WP report / exit 0
  clean; `node:fs` only; pure helpers exported for a `node:test` file; CLI
  guarded by `isRunDirectly()`. ✅.
- **CI:** the `hero-effect-coverage` job (display name "Coverage & Ledger
  Gates") in `.github/workflows/ci.yml` runs `pnpm install` then the governance
  steps `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`.
  The new step joins them. ✅.
- Hard dependencies: none (WP-671 ✅ is the pattern, not a dependency).

## Context (Read First)

- `scripts/check-workindex-executed-open.mjs` + its `.test.ts` — **AUTHORITATIVE
  for** the governance-check idiom.
- `.github/workflows/ci.yml` (Coverage & Ledger Gates job, the `workindex:*`
  steps) and `package.json` (`workindex:*` entries) — **AUTHORITATIVE for** the
  wiring convention.
- `docs/ai/coverage/live-verify.json` `about` field — the record's own contract
  (D-24026).
- `docs/ai/DECISIONS.md` D-24026 (live-verify) and D-24485 (the sibling guard).
- Supersession check (01.0a Step 2): `git log --all --grep="liveverify"`, `ls
  docs/ai/work-packets/*liveverify*`, `gh pr list --search "live-verify stale"`
  — no prior work; the reconciliation PRs are the motivating event, not overlap.

## Design Rationale (scaffold-decided, D-24852)

**Pending-text pattern.** Real done rows on `main` phrase it many ways:
`**D-24026 live-verify operator-pending**`, `**D-24026 operator-pending**`,
`(D-24026) operator-pending`, `live-verify: operator-pending`,
`Post-deploy **D-24026 live-verify** pending`, `D-24026 live-verify ⏳ PENDING
post-deploy`, `D-24026 live-verify on the CF Pages deploy operator-pending`,
`live-on-surface operator-pending`. All have a live-verify anchor (`D-24026`,
`live-verify`/`live verify`, `live-on-surface`) followed in the same clause by
the word `pending`. Locked pattern (case-insensitive):
`(?:D-24026|live[- ]verif\w*|live-on-surface)[^.;]{0,60}?\bpending\b(?![- ]choice)`.
The `(?![- ]choice)` lookahead keeps an honest PASS row that mentions a
"pending-choice" prompt (a large WP family) from reading as pending. The
clause bound (no `.`/`;`, ≤60 chars) stops a later unrelated "pending" (a
backfill, another WP's deploy) pairing with an earlier PASS. Scaffold: 181 done
rows match on `main` (273 on `62ac480e7^`), with or without the lookahead; a
reverse-order variant (`pending … live-verify`) matched one more row (WP-330, no
entry) and no additional stale row, so it is not added.

**Oracle = live-verify.json only.** A row is stale only when ≥1 entry names the
WP and every such entry is `verified`. No entry → legitimately pending (≈180 rows
on `main`; their result, if any, lives in a PR the guard cannot read). Any
`partial`/`pending` entry → legitimately pending (WP-863, WP-889 on `main`). WP
ids are read from `wp` as whole tokens (`/WP-\d+(?:\.\d+)?/g`) so `WP-674; #3150`
names WP-674 and WP-67 never matches WP-674. Only `- [x]` rows are checked; an
open row is expected to be pending.

**The oracle trusts entries, not mechanics.** "Every entry verified" means
every *recorded* mechanic; a mechanic with no entry is invisible. A row worded
"X PASS, Y operator-pending" where only X has an entry is flagged although it is
honest. The fix is to add a `pending` entry for Y to live-verify.json, not to
reword the row; the failure message says so.

**Known blind spots (accepted, recorded in D-24852).** Each misses only a
stale row (a false negative).
1. **The `partial:` row format.** WP-864 (`["verified","pending","pending",
   "pending"]`) and WP-865 (`["pending","pending"]`) read `live-verify (D-24026)
   partial: … PASS …, … operator-pending` / `… not yet seen live`: "pending" is
   beyond the clause bound or absent. When their pending entries flip to
   verified the rows go stale unseen. Adding `partial` to the pattern was
   scaffolded and rejected: it false-trips WP-862 today (row says "partial",
   both entries verified, the third mechanic has no entry), and fixing that needs
   a live-verify.json edit outside this WP.
2. **"pending" outside the anchor's clause:** a `.` (e.g. inside a domain,
   WP-303) or `;` between anchor and "pending" (e.g. `(D-24026 = <description>;
   operator-pending on deploy)`), "pending" more than 60 characters past the
   anchor, or an operator-pending with no live-verify anchor in its clause
   (e.g. WP-308, WP-342, WP-746). About 20 done rows; all have no entry today.
3. **Entries whose `wp` names no WP** (`D-24732`, `D-24733`, `D-24801 (#3155)`,
   `D-24802 (#3159)`, `#3151`, `""`) are never grouped.

**Scaffold result (observed, 2026-11-14).** On `main` @ `02a0bf623`: exit 0. Four
done rows have entries that are not all verified: WP-863 and WP-889 match the
pattern and correctly pass; WP-864 and WP-865 are blind spot 1. A sweep of the
121 done rows that contain "pending" without matching found no missed stale row
(the ~40 with all-verified entries use "pending" as code text, e.g.
`G.pendingX`). On the docs as they stood before #3371 (`62ac480e7^`; live-verify.json
unchanged across the three PRs): exit 1, **58 rows flagged**. All 91 reconciled
rows match the pattern; the other 33 split 31 with no entry and 2 (WP-864,
WP-865) with pending entries, which #3373 rewrote to the `partial:` form. Unit
test 8/8; three revert proofs (disable the all-verified decision → the POSITIVE
test fails; drop the clause bound → the cross-clause NEGATIVE fails; drop the
`pending-choice` lookahead → the pending-choice NEGATIVE fails). Gates, each an
independent subagent: 01.4 pre-flight READY TO EXECUTE (PS-1 = blind spot 1,
resolved by recording it); 01.7 copilot RISK (findings 1–7 applied in place:
NUMBER-LEDGER allowlist, `pending-choice` lookahead, reverse-order count,
blind-spot classes, this WP's own row title, reconcile-in-a-separate-PR,
`schemaVersion` fail-loud); 00.3 lint (three FAILs fixed).

## Scope (In)

- **`scripts/check-workindex-liveverify-pending.mjs`** (new) — the detect-only
  guard per §Design Rationale; exports `groupLiveVerifyEntriesByWorkPacket`,
  `findPendingLiveVerifyText`, `findStaleLiveVerifyPendingRows`; full-sentence
  per-WP report naming the matched pending text and the verified entries
  (key + date); full-sentence errors for an unreadable file, invalid JSON, a
  `schemaVersion` other than 1, or a missing `entries` array.
- **`scripts/check-workindex-liveverify-pending.test.ts`** (new) — `node:test`:
  POSITIVE (synthetic stale row FAILS, report fields asserted); NEGATIVEs (no
  entry; a `partial` / `pending` entry; open `- [ ]` row; reconciled PASS row;
  template placeholder; cross-clause "pending"; a PASS row naming a
  "pending-choice" prompt); every real phrasing above
  recognised; `wp` token parsing; malformed-JSON and unknown-schema errors.
- **`package.json`** — `workindex:liveverify:check` + `workindex:liveverify:test`.
- **`.github/workflows/ci.yml`** — one step in Coverage & Ledger Gates after
  `workindex:executed:check`, running the test then the check. Lands in its own
  `INFRA:` commit: an `EC-###:` commit may not touch `.github/workflows/**`
  (D-24444 Guard A). Branch topology: `SPEC:` draft → `EC-933:` → `INFRA:` →
  `SPEC:` close, one PR.

## Out of Scope

- Editing any WORK_INDEX row or live-verify.json (detect-only). If the check
  fires on real drift before this PR merges, the reconciliation lands as its own
  `SPEC:` PR first (the #3373 pattern), never in this one.
- Reading `SPEC:` live-verify PRs or git history as an oracle (needs network /
  `fetch-depth: 0`; rows reconciled from PRs are fine as they are).
- Flagging `- [ ]` rows, or a done row with no live-verify phrase at all.
- The `partial:` row format (WP-864, WP-865) and the other blind spots in
  §Design Rationale; widening the pattern for them needs live-verify.json
  entries for unrecorded mechanics first (a follow-up, not this WP).
- `check-workindex-executed-open.mjs`, `check-workindex-rows.mjs`, any engine /
  registry / server / app code.

## Files Expected to Change

- `scripts/check-workindex-liveverify-pending.mjs` — **new** — the detect-only guard (three exported pure helpers + CLI).
- `scripts/check-workindex-liveverify-pending.test.ts` — **new** — 8 `node:test` cases (POSITIVE, NEGATIVEs, phrasings, `wp` tokens, malformed JSON).
- `package.json` — **modified** — two script entries.
- `.github/workflows/ci.yml` — **modified** — one step.
- Governance (excluded from the lane's file budget): this WP, EC-933,
  `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/DECISIONS.md` (D-24852), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`
  (`LANDED` stamp on the WP-895 / EC-933 / D-24852 lines).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets. ESM only, Node v22+, `node:` prefixes. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full words, no nested ternaries, `// why:` on non-obvious constants).
- Detect-only. No new npm dependency. Node built-ins only: `node:fs`, `node:path`, `node:url`, `node:process` (script); `node:test`, `node:assert` (test).
- MUST exit 0 on `main` at execution; if it fires on real drift, reconcile the row in a separate `SPEC:` PR first (§Out of Scope) — never weaken the pattern or oracle to pass.
- The test is non-vacuous (revert proofs recorded) and never mutates fixtures.
- **Session protocol:** if any Assumes item is false or the pattern / oracle is unclear, STOP and reconcile before coding. One WP per session.
- **Locked contract values:** §Contract (pending pattern, done-row pattern, WP-token regex, pnpm entries, CI step name), copied verbatim into EC-933.

## Contract

- **Fail:** a `- [x] WP-<digits>[.<digits>]` row whose text matches the locked pending
  pattern AND whose WP is named by ≥1 live-verify.json entry AND every such entry
  is `state: "verified"`.
- **Pass:** everything else — open rows; done rows without a pending phrase; done
  pending rows with no entry or any non-`verified` entry; template/backlog rows;
  live-verify.json must carry `schemaVersion: 1` and an `entries` array, or the
  check fails loudly (a schema change must not silently group nothing).
- **Exit codes:** 0 consistent; 1 ≥1 stale row (or an unreadable / malformed
  input, with a full-sentence error).
- **Locked values:**
  - Pending pattern (case-insensitive): `(?:D-24026|live[- ]verif\w*|live-on-surface)[^.;]{0,60}?\bpending\b(?![- ]choice)`
  - Done-row pattern: `^- \[x\] (WP-\d+(?:\.\d+)?) `
  - WP token in the `wp` field: `/WP-\d+(?:\.\d+)?/g`, compared as whole tokens.
  - `workindex:liveverify:check` → `node scripts/check-workindex-liveverify-pending.mjs`; `workindex:liveverify:test` → `node --import tsx --test scripts/check-workindex-liveverify-pending.test.ts`.
  - CI step name: `WORK_INDEX live-verify consistency check` (runs the test, then the check).

## Vision Alignment

- **Vision clauses touched:** none — §17 N/A: a CI doc linter over two repo files; touches no §17.1 surface (no scoring, replay, identity, card data, monetization or player surface).
- **Conflict assertion:** No conflict — keeps the WP ledger honest; no player,
  monetization or persuasion surface.
- **Non-Goal proximity:** N/A — NG-1..7 not approached.
- **Determinism preservation:** N/A — a doc linter; no `G`, RNG, replay, scoring
  or hash surface.

## Funding Surface Gate

§20 N/A — governance tooling; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** `pnpm workindex:liveverify:check` exits 0 on `main` at execution.
- **AC-2** Run against the pre-reconciliation docs (`62ac480e7^`), the check exits
  1 and flags WP rows (observed 58 at draft) — the guard catches the real drift.
- **AC-3** A synthetic stale row FAILS and the report names the WP and the
  pending text (unit test, non-vacuous by revert proof).
- **AC-4** A pending row with no entry, or with any `partial`/`pending` entry,
  passes; open rows, reconciled PASS rows, the template row and a cross-clause
  "pending" pass.
- **AC-5** Every real pending phrasing listed in §Design Rationale is recognised.
- **AC-6** CI runs `pnpm workindex:liveverify:test` then
  `pnpm workindex:liveverify:check` in Coverage & Ledger Gates; no new dependency.

## Verification Steps

1. `pnpm workindex:liveverify:check` → exit 0.
2. `pnpm workindex:liveverify:test` → 8/8 pass.
3. Control run on the pre-reconciliation docs (the script anchors its repo root to
   its own directory):
   ```pwsh
   git worktree add --detach C:\claude-worktrees\lv-control 62ac480e7^
   Copy-Item scripts\check-workindex-liveverify-pending.mjs C:\claude-worktrees\lv-control\scripts\
   node C:\claude-worktrees\lv-control\scripts\check-workindex-liveverify-pending.mjs   # exit 1, 58 "  WP-" lines
   git worktree remove --force C:\claude-worktrees\lv-control
   ```
4. Revert proofs, each followed by `pnpm workindex:liveverify:test` and then a
   restore: (a) in `findStaleLiveVerifyPendingRows` change
   `if (isEveryEntryVerified)` to `if (false)` → the POSITIVE test fails;
   (b) in `PENDING_LIVE_VERIFY_PATTERN` replace `[^.;]{0,60}?` with `.*?` →
   the cross-clause NEGATIVE fails; (c) drop the `(?![- ]choice)` lookahead →
   the pending-choice NEGATIVE fails; restored → 8/8.
5. `pnpm workindex:executed:check`, `pnpm workindex:rows:check`,
   `pnpm ledger:numbers:check`, `pnpm roadmap:counts:check` → exit 0.
6. `git diff --name-only origin/main` equals the EC allowlist.

## Definition of Done

- [ ] AC-1..AC-6 hold; Verification Steps 1–6 observed.
- [ ] No file outside the EC allowlist changed.
- [ ] `DECISIONS.md` D-24852 Active; `STATUS.md` close-out says "No
      user-observable change — infrastructure only".
- [ ] `WORK_INDEX.md` row `[x]`, `EC_INDEX.md` Done, mindmap `📝`→`✅`, counts
      regenerated, NUMBER-LEDGER lines stamped `LANDED`; this WP's own close passes all four WORK_INDEX/ledger guards.
- [ ] Lightweight-lane empirical criteria (7–9) confirmed at close: additive,
      no determinism surface, file budget held.

## Reserved Decision (lands at execution)

**D-24852 — A done WORK_INDEX row that says its live-verify is pending, while
live-verify.json records every entry for that WP verified, is stale; CI fails
it.** Records the pending-text pattern and why it is clause-bounded; that
live-verify.json is the only oracle (no entry or any non-verified entry =
legitimately pending); `wp` whole-token parsing; done rows only; detect-only
(reconcile by rewriting the row to the recorded result); the scaffold numbers.

## Lint Gate Self-Review (00.3)

Run as an independent subagent 2026-11-14; its three FAILs (§2, §13, §15.2) and
the mislabelled self-review lines were fixed in place. §1 (all 10 sections; Out
of Scope has 4 exclusions) PASS; §2 (constraints: full files / no diffs, ESM /
Node 22, `00.6-code-style.md`, session protocol, locked values) PASS; §3
(Assumes: baseline, sources, idiom script, CI job) PASS; §4 (specific Context
refs) PASS; §5 (4 code/test files, each with a description) PASS; §6 (names /
paths match the code) PASS; §7 (no new dependency; built-ins only) PASS; §8
(Shared Tooling only, detect-only, no runtime edge) PASS; §9 (pnpm / node only;
Windows-safe) PASS; §10 (env vars) N/A — none used; §11 (auth) N/A — no auth
surface; §12 (tests: `node:test` / `node:assert`, synthetic fixtures, no
network / DB) PASS; §13 (exact commands with expected exit / count, incl. the
control run) PASS; §14 (6 binary ACs) PASS; §15 (DoD incl. STATUS / DECISIONS /
WORK_INDEX + scope boundary) PASS; §15.1 (`none — infrastructure`, STATUS
phrase) PASS; §15.2 (`**Risk Tier:** LOW`, EC verbatim) PASS; §16 (00.6 style)
PASS; §17 N/A — no §17.1 trigger surface; §18 N/A — no grep Verification Step;
§19 applied at commit (baseline re-checked against HEAD); §20 N/A — governance
tooling, no funding affordance or copy; §21 N/A per D-11804 — no HTTP endpoint
or server-reachable library function.

**Lightweight Lane (D-24028), provisional:** (1) single layer, Shared Tooling;
(2) 4 code/test files, no wiring file; (3) no `01.6` trigger — a second instance
of the existing governance-check category; (4) no contract file; (5) one scoped
rationale D-entry; (6) surface = doc validation in CI, none of the excluded
surfaces. Scaffold run before eligibility: see §Design Rationale.
