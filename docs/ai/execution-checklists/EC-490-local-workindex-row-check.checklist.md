# EC-490 — Local WORK_INDEX Row-Pattern Check (Execution Checklist)

**Source:** docs/ai/work-packets/WP-455-local-workindex-row-check.md
**Layer:** Infrastructure / repo tooling (root `scripts/` + root `package.json`)

## Before Starting
- [ ] On `origin/main` @ `6b4ae29c` (drafting baseline), worktree clean.
- [ ] `apps/dashboard/scripts/build-governance-snapshot.mjs` declares
      `const WORK_INDEX_ROW_PATTERN = /.../;` on one line (the single source).
- [ ] `apps/dashboard/src/composables/workIndexRowPattern.test.ts` exists and
      text-extracts that literal via `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m`
      (the extractor + `LOOSE_WP_ROW_PATTERN` to mirror).
- [ ] Repo has NO hook framework (husky/simple-git-hooks) — confirm before
      considering any hook wiring (do NOT add one).
- [ ] `scripts/roadmap-counts.mjs` + `roadmap-counts.test.ts` +
      `roadmap:counts:check`/`:test` are the shape/precedent to follow.
- [ ] `pnpm workindex:rows:check` does NOT yet exist; `docs/ai/work-packets/WORK_INDEX.md`
      currently conforms (the new check must exit 0 on it).
- [ ] **Exact target CODE/product file set (any code file outside this list =
      FAIL, STOP):** the three files under `## Files to Produce`. The govern-close
      `SPEC:` commit additionally edits the standard governance docs (STATUS,
      DECISIONS, WORK_INDEX row-checkoff for WP-455 only, EC_INDEX,
      ROADMAP-MINDMAP) — those are expected, not a scope breach.

## Locked Values (do not re-derive)
- Single source = `WORK_INDEX_ROW_PATTERN` in
  `apps/dashboard/scripts/build-governance-snapshot.mjs`, extracted with
  `/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m`. **NO second copy of the
  canonical regex** in the new script.
- Loose detector (candidate filter, local by design, mirrors the test):
  `/^- \[(?:x| )\] WP-\d{3} — .*\*\*(?:Draft|Done|Ready|Blocked)/`.
- Target: `docs/ai/work-packets/WORK_INDEX.md`, resolved repo-relative from the
  script location (never an absolute path). Strip a leading BOM, then split lines
  on `/\r?\n/` (WORK_INDEX.md is CRLF — mirror `roadmap-counts.mjs`; no trailing
  `\r` in offender output).
- Wrap BOTH `readFileSync` calls (generator + WORK_INDEX) in full-sentence error
  messages naming the path and the fix (a moved generator / missing WORK_INDEX
  must not surface as a bare ENOENT stack).
- Script names: `workindex:rows:check` (`node scripts/check-workindex-rows.mjs`)
  + `workindex:rows:test`
  (`node --import tsx --test scripts/check-workindex-rows.test.ts`).
- Exit contract: 0 + full-sentence success line; non-zero + offending rows on drift.

## Guardrails
- **Reuse, never re-copy, the canonical pattern** — extract it from the
  generator source at runtime; hard-coding a second regex defeats the WP.
- **Guard `main()`** so importing the module (from the test) neither runs the
  check nor reads files (mirror the `import.meta.url` / direct-invocation guard
  convention; the dashboard test avoided importing the generator precisely
  because its `main()` runs at import).
- **No `apps/dashboard` change** — generator, CI test, and Dashboard Gates job
  untouched; the canonical pattern is not moved/exported/refactored.
- **No git hook, no hook framework, no CI-workflow edit** — a `pnpm` check only.
- **Pure helpers are data-injected** (`extractCanonicalPattern(source)`,
  `findUnparsedWpRows(content, pattern)`) so the test needs no file I/O and no
  live generator.
- **`.test.ts`, `node:test`, `.mjs` script, `node:` built-in imports** — never
  `.test.mjs`, never CommonJS.
- **Full-sentence errors/messages**; `extractCanonicalPattern` throws loudly on a
  renamed/absent declaration (never silently returns a non-matching regex).
- **Do NOT modify `WORK_INDEX.md`** except transiently for the mutation-proof AC,
  reverted immediately (never committed).

## Required `// why:` Comments
- Why the canonical pattern is extracted from the generator source rather than
  imported (the generator runs `main()` at import; text-extraction keeps a single
  source without side effects — same rationale as the dashboard test).
- Why `main()` is guarded against import-time execution (so the unit test can
  import the pure helpers without running the check or reading files).
- Why the loose detector is a local copy (it is a candidate filter, not the
  single-sourced canonical contract).

## Files to Produce
- `scripts/check-workindex-rows.mjs` — **new** — `extractCanonicalPattern` +
  `findUnparsedWpRows` + guarded `main()`.
- `scripts/check-workindex-rows.test.ts` — **new** — `node:test`: extraction
  finds the literal; extraction throws on a renamed constant; a conforming body
  → `[]`; the `**Drafted …; not yet executed**` row is an offender; a prose
  mention is not flagged.
- `package.json` (root) — **modified** — add `workindex:rows:check` +
  `workindex:rows:test`.

## After Completing
- [ ] `pnpm workindex:rows:test` exits 0 (helper unit tests pass).
- [ ] `pnpm workindex:rows:check` exits 0 on the real WORK_INDEX; the mutation
      proof (append a bad row) exits non-zero and lists it, then reverted.
- [ ] `pnpm -r build` exits 0; dashboard `workIndexRowPattern.test.ts` unchanged
      and green.
- [ ] `docs/ai/STATUS.md` updated (infra; "No user-observable change").
- [ ] `docs/ai/DECISIONS.md` **D-24275** flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-490 status → `Done`.
- [ ] No file outside the three-file list was modified.

## Common Failure Smells
- The check exits 0 no matter what → the offender collection or the non-zero exit
  wiring is broken; the mutation proof must fail. A false-green check is worse
  than none.
- The dashboard test breaks → the generator or its test was touched; they must
  stay byte-unchanged (this WP is additive, root-only).
- `vue-tsc` or a build breaks importing the `.mjs` → the test imported the script
  in a way that runs `main()`; guard `main()` and import only the pure helpers.
- A second literal copy of the canonical regex appears → extract from the
  generator instead; the single-source rule is the whole point.
- The check reads WORK_INDEX via an absolute path → resolve repo-relative from
  the script's own location (portable across worktrees/machines).
