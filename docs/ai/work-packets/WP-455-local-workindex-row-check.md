# WP-455 — Local WORK_INDEX Row-Pattern Check

**User-Visible Surface:** `none — infrastructure` (a governance-tooling check; no
product surface). **D-24026 is inverted** — STATUS records "No user-observable
change"; the payoff is that a WORK_INDEX row-format drift fails at **authoring
time** via a local `pnpm` command instead of only in the "Dashboard Gates" CI
job.

## Goal

After this session, a WORK_INDEX WP-row format drift is catchable **locally**,
before push, with `pnpm workindex:rows:check`. The canonical
`WORK_INDEX_ROW_PATTERN` already lives as a regex literal in
`apps/dashboard/scripts/build-governance-snapshot.mjs` and is enforced in CI only
by the dashboard test `workIndexRowPattern.test.ts` (inside the "Dashboard
Gates" job) — so a non-conforming row (e.g. a draft written
`**Drafted 2026-07-29; not yet executed**` instead of the canonical
`**Draft <date>**`) is only discovered after a full CI cycle, and reads
confusingly as a *coverage* failure. This WP adds a root
`scripts/check-workindex-rows.mjs` that reuses the **same single-source**
pattern (extracted from the generator, exactly as the dashboard test does — no
third regex copy) to validate `docs/ai/work-packets/WORK_INDEX.md` and exit
non-zero with the offending rows listed. It is a **local authoring-time mirror**
of the existing CI guard; it does not replace or modify the CI guard.

## Assumes

- **On `origin/main` @ `6b4ae29c`** (the drafting baseline; `git rev-parse
  origin/main` at draft time).
- **`apps/dashboard/scripts/build-governance-snapshot.mjs` declares the canonical
  pattern** as a single-line literal `const WORK_INDEX_ROW_PATTERN = /.../;`. This
  is the single source of truth. (Source: the file on `main`; the extraction
  regex `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m` in
  `apps/dashboard/src/composables/workIndexRowPattern.test.ts:48`.)
- **The dashboard test `workIndexRowPattern.test.ts` already text-extracts that
  literal** (rather than importing the generator, whose `main()` runs at import)
  and runs the drift assertion in CI's "Dashboard Gates" job. This WP mirrors
  that extraction approach; it does **not** change the test or the generator.
  (Source: the test file on `main`.)
- **The repo has NO git-hook framework** — no `husky`, no `simple-git-hooks`, no
  `.husky/`, no `prepare`/`postinstall` hook wiring in root `package.json`.
  Governance drift guards are exposed as root `pnpm` `*:check` scripts
  (`roadmap:counts:check`, `ledger:numbers:check`, `gauntlet:loadouts:check`,
  `check:node-pin`). This WP follows that convention, not a git hook. (Source:
  root `package.json` on `main`.)
- **The `scripts/roadmap-counts.mjs` + `scripts/roadmap-counts.test.ts` +
  `roadmap:counts:check` / `roadmap:counts:test` set is the near-exact
  precedent** for a root tooling check with a pure-helper unit test run via
  `node --import tsx --test`. (Source: root `package.json` `:56`, the files on
  `main`.)
- **`docs/ai/work-packets/WORK_INDEX.md` currently PASSES the drift guard** (all
  rows conform, verified 2026-07-29 after WP-454), so adding the local check
  newly-fails nothing on `main`.
- **Empirical Scaffold (`01.4`) is N/A** — this adds an **isolated** new code
  path (nothing pre-existing routes through `check-workindex-rows.mjs`; the new
  `.test.ts` uses injected strings only) and an **identical** guard (the
  dashboard `workIndexRowPattern.test.ts`) is already green on the same corpus,
  so no pre-existing valid-path fixture can be newly-rejected. AC folds the
  run-against-real-`WORK_INDEX` confirmation + the mutation proof into acceptance.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — root `scripts/`
  are repo tooling, orthogonal to the Registry → Engine → Server chain. Reading
  a package's source file **as text** for a governance check is not a runtime
  import and crosses no layer boundary. This check performs no runtime import of
  the dashboard.
- `.claude/rules/code-style.md` — ESM-only, `.mjs` for standalone scripts,
  `node:` prefix on built-ins, `.test.ts` (never `.test.mjs`), `node:test`,
  full English names, `// why:` on non-self-evident choices, full-sentence error
  messages, human-style code.
- `apps/dashboard/src/composables/workIndexRowPattern.test.ts` — the CI-side
  drift guard this WP mirrors locally: its `loadCanonicalPattern()`
  text-extraction, its `LOOSE_WP_ROW_PATTERN` candidate detector
  (`/^- \[(?:x| )\] WP-\d{3} — .*\*\*(?:Draft|Done|Ready|Blocked)/`), and its
  "every loose-detected row must parse under the canonical pattern" assertion.
- `apps/dashboard/scripts/build-governance-snapshot.mjs` — where
  `WORK_INDEX_ROW_PATTERN` is defined (the single source). This WP reads it as
  text; it does not import or modify it.
- `scripts/roadmap-counts.mjs` / `scripts/check-number-ledger.mjs` — the
  `--check`-style root-script shape (guarded `main()`, non-zero exit on failure,
  full-sentence messages) this WP follows.
- `docs/ai/DECISIONS.md` — this WP reserves **D-24275**.

**Why now.** During the WP-453→WP-454 arc a draft row written
`**Drafted 2026-07-29; not yet executed**` (not the canonical `**Draft <date>**`)
broke the dashboard drift guard, failed the whole "Dashboard Gates" CI job, and
was **twice mis-diagnosed as a coverage failure** before the real cause (the row
regex) surfaced from `gh run view --log-failed`. A local `pnpm` check turns that
whole CI round-trip + mis-diagnosis into a one-command authoring-time catch. The
guard logic already exists and is proven; this WP only re-exposes it locally.

**Why not a git hook.** The repo has no hook framework, and introducing one
(husky / simple-git-hooks + a `prepare` step) is a cross-cutting dependency
change disproportionate to this WP and out of scope. The established convention
here is a `pnpm` `*:check` script an author runs (and that a future CI/aggregate
step may call); a pre-push hook can be layered on later if desired. This WP ships
the check script; hook wiring is explicitly out of scope.

## Scope (In)

- **New** `scripts/check-workindex-rows.mjs` — a `--check`-style root tooling
  script exposing **pure, exported helpers** plus a guarded `main()`:
  - `extractCanonicalPattern(generatorSource: string): RegExp` — extracts the
    `WORK_INDEX_ROW_PATTERN` literal from the generator source via the same
    `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m` match the dashboard test
    uses; throws a full-sentence error if the declaration is absent (a rename
    fails loudly, never silently skips).
  - `findUnparsedWpRows(content: string, canonicalPattern: RegExp): string[]` —
    strips a leading BOM, splits on `/\r?\n/` (WORK_INDEX.md is CRLF — mirror the
    `roadmap-counts.mjs` / dashboard-test precedent so no trailing `\r` leaks into
    offender output), loose-detects WP rows with a local `LOOSE_WP_ROW_PATTERN`
    (mirroring the test's detector), and returns the (truncated) rows that the
    canonical pattern does NOT parse.
  - `main()` — reads the generator + `WORK_INDEX.md` from repo-relative paths,
    runs the two helpers, prints a full-sentence success or lists the offending
    rows, and sets a non-zero exit code on drift. Guarded so an import (from the
    test) does **not** execute it.
- **New** `scripts/check-workindex-rows.test.ts` — `node:test` covering the pure
  helpers with injected strings (no file I/O, no live generator): extraction
  finds the literal in a sample generator source; extraction throws on a renamed
  constant; a canonical-conforming row yields `[]` from `findUnparsedWpRows`; a
  `**Drafted 2026-07-29; not yet executed**` row is returned as an offender (the
  exact WP-453 regression); a prose line mentioning a WP is not flagged.
- **Modified** root `package.json` — add two scripts mirroring the
  `roadmap:counts:*` pair:
  - `"workindex:rows:check": "node scripts/check-workindex-rows.mjs"`
  - `"workindex:rows:test": "node --import tsx --test scripts/check-workindex-rows.test.ts"`

## Out of Scope

- **No git-hook framework** (`husky` / `simple-git-hooks` / `.husky/` / a
  `prepare` step) and **no pre-push hook** — a `pnpm` check only.
- **No change to `apps/dashboard`** — the generator
  (`build-governance-snapshot.mjs`), the CI-side test
  (`workIndexRowPattern.test.ts`), and the "Dashboard Gates" job are untouched.
  The canonical pattern is **not** moved, exported, or refactored (that larger
  single-module extraction is a possible follow-on, not this WP).
- **No CI-workflow change** — CI enforcement already exists via Dashboard Gates;
  this WP adds a **local** command, not a new CI job. (Wiring
  `workindex:rows:check` into a workflow is a separate, optional follow-on.)
- **No change to the WORK_INDEX row *format / contract*** — no change to the
  `LOOSE_WP_ROW_PATTERN` / canonical-pattern semantics, and no edit to any
  existing WP row. (Checking off WP-455's **own** row at govern-close, and the
  standard governance-closeout edits to `STATUS.md` / `DECISIONS.md` /
  `EC_INDEX.md` / `ROADMAP-MINDMAP.md`, are the expected `SPEC:` close, not a
  scope breach — the EC's three-file allowlist governs **code/product** files.)
- **No aggregate-`pnpm check` rewiring** — the existing root `check` script
  (connections) is unrelated and untouched.

## Files Expected to Change

- `scripts/check-workindex-rows.mjs` — **new** — `extractCanonicalPattern` +
  `findUnparsedWpRows` + guarded `main()`.
- `scripts/check-workindex-rows.test.ts` — **new** — `node:test` unit tests for
  the two pure helpers.
- `package.json` (root) — **modified** — add `workindex:rows:check` +
  `workindex:rows:test` scripts.

## Contract

> **Output contract for this session (execution):**
> - Full file contents for every new or modified file (no diffs).
> - ESM only, Node v22+, `.mjs` script + `.test.ts` test, `node:` prefix on
>   built-ins, human-style code per `00.6-code-style.md`.
> - The check **reuses the single-source `WORK_INDEX_ROW_PATTERN`** by extracting
>   it from `build-governance-snapshot.mjs` — it MUST NOT hard-code a second copy
>   of the canonical regex.
> - `main()` is guarded so importing the module for tests does not run it or
>   read files.
> - `extractCanonicalPattern` throws a full-sentence error on a missing/renamed
>   declaration; the check exits non-zero on drift and prints the offending rows.

**Locked values (do not re-derive):**

- **Single source:** the canonical pattern is `WORK_INDEX_ROW_PATTERN` in
  `apps/dashboard/scripts/build-governance-snapshot.mjs`; the check extracts it
  with `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m` (the dashboard test's
  extractor). No second copy of the canonical regex may be introduced.
- **Loose detector (candidate filter, local by design):**
  `/^- \[(?:x| )\] WP-\d{3} — .*\*\*(?:Draft|Done|Ready|Blocked)/` — a heuristic
  "is this a WP row" filter mirroring the test's own local `LOOSE_WP_ROW_PATTERN`
  (the loose detector is a filter, not the single-sourced contract; the canonical
  pattern is the authority).
- **Target file:** `docs/ai/work-packets/WORK_INDEX.md`, resolved repo-relative
  from the script location (not an absolute path). Split lines on `/\r?\n/`
  (CRLF-safe) after stripping a leading BOM.
- **Generator read is guarded:** wrap the `readFileSync` of the generator in a
  full-sentence error so a moved/absent generator yields "could not read the
  canonical-pattern generator at <path>; if the dashboard script moved, update
  scripts/check-workindex-rows.mjs" rather than a bare ENOENT stack (RS-2).
- **Script names:** `workindex:rows:check` (run the check) + `workindex:rows:test`
  (run the unit test), mirroring `roadmap:counts:check` / `roadmap:counts:test`.
- **Exit contract:** exit 0 + a full-sentence "all N rows conform" line on
  success; non-zero + the offending row(s) (truncated) on drift.

## Acceptance Criteria

- [ ] `scripts/check-workindex-rows.mjs` exists and exports
      `extractCanonicalPattern` and `findUnparsedWpRows`, with a `main()` guarded
      against import-time execution.
- [ ] `extractCanonicalPattern(sourceWithLiteral)` returns a live `RegExp` equal
      in source to the generator's `WORK_INDEX_ROW_PATTERN`; on a source missing
      the declaration it throws a full-sentence error.
- [ ] `findUnparsedWpRows(content, pattern)` returns `[]` for a WORK_INDEX body
      whose rows all conform, and returns the offending row for a body containing
      `- [ ] WP-453 — … — **Drafted 2026-07-29; not yet executed**` (the WP-453
      regression), and does not flag a prose line that merely mentions a WP.
- [ ] `node scripts/check-workindex-rows.mjs` (via `pnpm workindex:rows:check`)
      exits **0** against the current `docs/ai/work-packets/WORK_INDEX.md` and
      prints a full-sentence success line.
- [ ] Introducing a deliberately malformed WP row makes the check exit **non-zero**
      and print that row (mutation proof — see Verification Steps).
- [ ] The check reuses the extracted single-source pattern — no second copy of
      the canonical `WORK_INDEX_ROW_PATTERN` regex appears in the new script.
- [ ] `package.json` carries `workindex:rows:check` and `workindex:rows:test`.
- [ ] `pnpm workindex:rows:test` exits 0 (the helper unit tests pass); `pnpm -r
      build` exits 0; the dashboard `workIndexRowPattern.test.ts` is unchanged and
      still green.
- [ ] No file outside the three-file list is modified (no `apps/dashboard`
      change, no CI-workflow change).

## Verification Steps

```bash
pnpm workindex:rows:test
# Expected: helper unit tests pass (extraction, throw-on-rename, clean body → [],
# the Drafted-row offender is detected, prose is not flagged).

pnpm workindex:rows:check
# Expected: exit 0, a full-sentence "all N WORK_INDEX rows conform" line.

# Mutation proof (AC): temporarily append a malformed row, confirm the check
# fails, then discard the edit — do NOT commit it.
printf '\n- [ ] WP-999 — Bad Row — **Drafted 2026-07-29; not yet executed**\n' >> docs/ai/work-packets/WORK_INDEX.md
pnpm workindex:rows:check; echo "exit=$?"   # Expected: non-zero, WP-999 row listed
git checkout -- docs/ai/work-packets/WORK_INDEX.md

pnpm -r build
# Expected: whole-repo build green; dashboard workIndexRowPattern.test.ts unchanged.
```

## Vision Alignment

**Vision clauses touched:** none functional. This is governance tooling
(WORK_INDEX authoring hygiene), adjacent to the WP/EC process, not to any product
or Vision surface. No §20–26 (scoring/leaderboards), identity, RNG, determinism,
or persistence surface is touched.

**Conflict assertion:** *No conflict.* The WP adds a read-only local check over a
governance markdown file; it computes, scores, persists, and mutates nothing, and
reuses the existing single-source pattern so it can never diverge from the CI
guard.

**Non-Goal proximity check:** No proximity to NG-1..7 — no product, funding,
pay-to-win, or cosmetic surface.

## Definition of Done

This packet is complete when ALL of the following are true:
- [ ] All Acceptance Criteria pass.
- [ ] `pnpm workindex:rows:check` exits 0; the mutation proof fails non-zero; the
      unit tests pass; `pnpm -r build` exits 0; the dashboard drift-guard test is
      unchanged and green.
- [ ] `docs/ai/STATUS.md` updated (infrastructure; "No user-observable change" —
      names the new local `workindex:rows:check`).
- [ ] `docs/ai/DECISIONS.md` **D-24275** flipped from "Drafted" to "Active
      (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-490 status → `Done`.
- [ ] `User-Visible Surface = none — infrastructure` — **D-24026 inverted**;
      STATUS states "No user-observable change".
- [ ] No files outside the `Files Expected to Change` list were modified.

---

## Gate Verdicts (drafting session)

All three gates ran as independent subagents against the frozen WP-455/EC-490.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE**

- Authority chain read (CLAUDE.md → ARCHITECTURE §Layer Boundary → code-style →
  WP → EC). No conflict: root `scripts/` are orthogonal tooling; reading the
  dashboard generator **as text** is not a runtime import.
- Dependencies verified on `main` @ `6b4ae29c`: the canonical
  `WORK_INDEX_ROW_PATTERN` is a one-line literal in
  `apps/dashboard/scripts/build-governance-snapshot.mjs`; the dashboard test
  extracts it with `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m`; **no**
  hook framework exists; the `roadmap-counts.mjs`+`.test.ts`+`:check`/`:test`
  precedent matches. The extractor was run live against both sources: **262/262**
  loose-detected rows parse, 0 unparsed.
- Scope locked: exactly 3 files (2 new root scripts + root `package.json`), no
  `apps/dashboard` change, no CI-workflow change. Single infra surface.
- Empirical Scaffold N/A (isolated new code path; identical guard already green
  on the same corpus — recorded in Assumes).
- Self-reference confirmed: the WP-455 `WORK_INDEX` row parses under the very
  guard it adds (drift guard re-run: 4 pass / 0 fail).

### Copilot Check (`01.7`) — verdict: **RISK (concerns addressed inline; scope-neutral)**

Two scope-neutral fixes folded in before recording (no allowlist/contract change
→ no pre-flight re-run):
- **F1 (scope contradiction).** Out-of-Scope "no WORK_INDEX change" vs the DoD's
  own-row checkoff + governance-closeout edits. → Out-of-Scope reworded to "no
  change to the row *format/contract* or to *other* rows"; the EC three-file
  allowlist scoped to **code/product** files with the governance-closeout docs
  named as expected.
- **F2 (CRLF split).** `WORK_INDEX.md` is CRLF; the line split was unpinned. →
  Locked `split(/\r?\n/)` (after BOM strip) in the Contract + EC, mirroring
  `roadmap-counts.mjs`.
- Also folded RS-2: both `readFileSync` calls wrapped in full-sentence errors.
- Confirmed PASS on the load-bearing lenses: false-green guarded three ways
  (unit fail-path + throw-on-rename + integration mutation proof); `main()`
  guarded against import-time execution; single-source (no second regex copy);
  the `**Drafted …**` offender is correctly flagged; self-reference survives.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

All 21 sections PASS or justified-N/A on independent audit: §5 file list matches
the EC allowlist exactly (3 files); §12 test quality (node:test, `.test.ts`,
fail-path + throw-on-rename cases); §13 exact commands + mutation proof; §15.1
**D-24026 correctly inverted** (surface = none — infrastructure; STATUS states
"No user-observable change"); §17 valid N/A (governance tooling) with the section
carried anyway; §18/§20/§21 N/A justified. One noted deviation: the constraints
block is titled `## Contract` (not `## Non-Negotiable Constraints`) — **accepted
per the shipped WP-454 precedent** (same alias), not a substance gap.
