# EC-073 — Label Replay Harness as Determinism-Only (Execution Checklist)

**Source:** docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md
**Layer:** Game Engine / Documentation (doc-only, JSDoc + module header text)

> **Slot note:** EC-062–EC-064 unused; EC-065–EC-072 historically
> bound. Following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069,
> EC-063 → EC-071, and EC-080 → EC-072 retargeting precedent, WP-079
> uses EC-073 — the next truly free slot. Commit prefix at execution
> is `EC-073:` (NEVER `WP-079:` per P6-36; the `.githooks/commit-msg`
> hook rejects `WP-###:` prefixes — this overrides the WP-079 body's
> trailing note that predates P6-36).

## Before Starting
- [ ] WP-027 complete (replay harness exists; `replayGame` +
      `verifyDeterminism` + `computeStateHash` exported)
- [ ] D-0205 present in `DECISIONS.md` with Status Active, Resolved
      2026-04-18
- [ ] `docs/ai/MOVE_LOG_FORMAT.md` Gap #4 exists unedited
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `stash@{0}` retained — MUST NOT pop
- [ ] `stash@{1}` retained — MUST NOT pop
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in
      `EC_INDEX.md` MUST NOT be backfilled in the `EC-073:` commit

## Locked Values (do not re-derive)
- Commit prefix: `EC-073:` on every commit; never `WP-079:` (P6-36)
- Scope: JSDoc + module-header text only on two files
- Forbidden phrases (must appear **zero** times across both files):
  - `"replays live matches"`
  - `"replays a specific match"`
  - `"reproduces live-match outcomes"`
- Required phrases:
  - `"determinism-only"` — appears **≥ 2 times** in `replay.execute.ts`
    (module header + `replayGame()` JSDoc)
  - D-0205 cross-reference in both files
  - `MOVE_LOG_FORMAT.md` Gap #4 cross-reference in `replay.execute.ts`
- `replayGame()` JSDoc target: `replay.execute.ts` ~lines 127–137
  (wholesale replacement, not append)
- `verifyDeterminism()` JSDoc target: `replay.verify.ts` ~lines 25–38
  (wholesale replacement, not append)
- Existing `// why:` comments preserved: reverse-shuffle callout
  (`replay.execute.ts:118–124`); events no-op (`:110–117`);
  two-run rationale inside `verifyDeterminism` body (`:43–45`)
- Test count identical to starting commit (no tests added / removed
  / skipped)

## Guardrails
- **No signature changes.** `replayGame`, `verifyDeterminism`, their
  params, and return types unchanged
- **No export changes.** `packages/game-engine/src/index.ts` untouched
- **No type changes.** `replay.types.ts` untouched
- **No test changes.** `replay.verify.test.ts` untouched
- **No runtime change.** Reverse-shuffle at `replay.execute.ts:121–123`
  not touched (future WP gated on D-0203)
- **No new files.** Zero new source or test files
- **No `MOVE_LOG_FORMAT.md` edits.** Gap #4 remains the forensics
  record; `DECISIONS.md §D-0205` is the resolution record
- **No "TODO" / "FIXME" comments** — the decision is made, the
  warning is permanent under the current architecture
- **Layer Boundary:** no cross-layer imports introduced

## Required `// why:` Comments
- Preserve existing `// why:` at `replay.execute.ts:118–124`
  (reverse-shuffle rationale); strengthen with D-0205 pointer
- Preserve existing `// why:` at `replay.execute.ts:110–117`
  (events no-op during replay) verbatim
- Preserve existing `// why:` at `replay.verify.ts:43–45`
  (two-run comparison rationale) verbatim
- JSDoc warnings themselves are full-sentence narrative, not
  `// why:` comments — do not confuse the two

## Files to Produce
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** —
  module header notice (after existing header JSDoc, above imports)
  + `replayGame()` JSDoc wholesale rewrite
- `packages/game-engine/src/replay/replay.verify.ts` — **modified** —
  module header sentence appended + `verifyDeterminism()` JSDoc
  wholesale rewrite
- `docs/ai/STATUS.md` — **modified** — one-line WP-079 completion entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip WP-079
  `[ ]` → `[x]` with completion date
- `docs/ai/DECISIONS.md §D-0205` — **modified** — mark the JSDoc
  follow-up action completed with commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip
  EC-073 Draft → Done with `Executed YYYY-MM-DD at commit <hash>`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r test` exits 0; repo-wide test count IDENTICAL to
      starting commit (no tests added / removed / skipped)
- [ ] All three forbidden phrases grep to zero hits across both files
- [ ] `"determinism-only"` grep returns ≥ 2 hits in
      `replay.execute.ts`; ≥ 1 hit in `replay.verify.ts`
- [ ] D-0205 cross-reference present in both files
- [ ] `MOVE_LOG_FORMAT` cross-reference present in `replay.execute.ts`
- [ ] `replayGame` and `verifyDeterminism` signature lines byte-
      identical pre- and post-commit (`git diff` shows no `(-|+)export
      function` matches)
- [ ] `git diff --name-only` shows exactly the 6 files listed in
      Files to Produce; no others
- [ ] `stash@{0}` and `stash@{1}` retained (not popped)
- [ ] EC-069 `<pending>` placeholder not backfilled
- [ ] Commit uses `EC-073:` prefix
- [ ] NO 01.6 post-mortem required (doc-only; no new long-lived
      abstraction; no new code category)

## Common Failure Smells
- Signature diff shows `(-|+)export function replayGame` or
  `verifyDeterminism` → accidental reformat / rewrap; revert the
  signature line
- Test count changes → a test was accidentally renamed, moved, or
  skipped; restore it
- Any forbidden phrase present → revert that JSDoc sentence; the
  D-0205 resolution exists specifically to prevent that claim
- New import appears → scope violation (doc-only); revert
- `replay.types.ts`, `replay.hash.ts`, or `index.ts` shows in the
  diff → out of scope; revert
- Commit message starts with `WP-079:` → P6-36 hook rejects; fix
  the message and re-commit (do NOT `--no-verify`)
