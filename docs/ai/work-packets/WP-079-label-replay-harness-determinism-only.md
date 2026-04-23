# WP-079 — Label Engine Replay Harness as Determinism-Only

**Status:** Complete
**Primary Layer:** Game Engine / Documentation (doc-only, no behavior change)
**Dependencies:** WP-027 (replay harness), D-0205 (resolved 2026-04-18)

---

## Session Context

WP-027 established the engine's replay harness (`replayGame`,
`verifyDeterminism`, `computeStateHash`) under D-0201 (*Replay is
first-class*). The forensics report `docs/ai/MOVE_LOG_FORMAT.md`
(2026-04-18, commit `1d709e5`) discovered that `replay.execute.ts`
hardcodes a reverse-shuffle RNG and ignores the stored
`ReplayInput.seed` — so the harness proves determinism of the reducer
but does **not** reproduce live-match RNG. D-0205 resolved this by
scoping the harness explicitly as *determinism-only / debug-only*.
This packet carries out the single follow-up action that decision
names: add JSDoc warnings so the narrowed claim is visible at the
export surface. No runtime behavior changes, no API changes.

---

## Goal

After this session, every consumer of the engine's replay harness —
reading source, reading JSDoc via IDE hover, or reading generated
`.d.ts` types — can see on the first line of the function's
documentation that the harness is determinism-only tooling and does
**not** replay live matches. Specifically:

- `replayGame()` in `packages/game-engine/src/replay/replay.execute.ts`
  opens its JSDoc with an explicit *determinism-only* warning block.
- `verifyDeterminism()` in
  `packages/game-engine/src/replay/replay.verify.ts` opens its JSDoc
  with the same warning.
- Both file headers carry a short module-level notice pointing at
  D-0205.
- No signature changes. No return-type changes. No new exports. No
  changes to `replay.types.ts`, `replay.hash.ts`, or `index.ts`
  exports. No changes to any test.

---

## Assumes

- WP-027 complete. Specifically:
  - `packages/game-engine/src/replay/replay.execute.ts` exports
    `replayGame(input, registry): ReplayResult` (WP-027)
  - `packages/game-engine/src/replay/replay.verify.ts` exports
    `verifyDeterminism(input, registry): DeterminismResult` (WP-027)
  - `packages/game-engine/src/replay/replay.hash.ts` exports
    `computeStateHash(gameState): string` (WP-027)
  - `packages/game-engine/src/replay/replay.types.ts` exports
    `ReplayInput`, `ReplayMove`, `ReplayResult` (WP-027)
- `docs/ai/DECISIONS.md` contains D-0205 with `Status: Active` and
  `Resolved: 2026-04-18`
- `docs/ai/MOVE_LOG_FORMAT.md` exists and documents Gap #4 (the
  reverse-shuffle behavior this WP warns about)
- `pnpm --filter @legendary-arena/game-engine build` exits 0 at the
  starting commit
- `pnpm --filter @legendary-arena/game-engine test` exits 0 at the
  starting commit

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirms
  the engine layer owns replay; this packet modifies only files under
  `packages/game-engine/src/replay/` and introduces no new imports.
- `docs/ai/DECISIONS.md §D-0205 — RNG Truth Source for Replay` — read
  the `Decision:`, `Decision rationale:`, and `Follow-up actions
  required by this decision:` blocks in full. The wording of the JSDoc
  warnings in this packet must be consistent with that rationale.
- `docs/ai/MOVE_LOG_FORMAT.md §Known Gaps / Risks Gap #4` — the
  evidence trail that surfaced the issue. The JSDoc warnings must
  reference this file and the specific line range
  `replay.execute.ts:119-123`.
- `packages/game-engine/src/replay/replay.execute.ts` — read entirely
  before modifying. Existing JSDoc on `replayGame` at lines 127-141
  will be replaced wholesale, not appended to.
- `packages/game-engine/src/replay/replay.verify.ts` — read entirely
  before modifying. Existing JSDoc on `verifyDeterminism` at lines
  16-38 will be replaced wholesale, not appended to.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 6
  (`// why:` comments), Rule 11 (full-sentence error messages — the
  JSDoc warnings must be full sentences), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on
  invalid input
- Never persist `G`, `ctx`, or any runtime state — see
  ARCHITECTURE.md §Persistence Boundaries
- `G` must be JSON-serializable at all times — no class instances,
  Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Doc-only.** No runtime behavior change. The reverse-shuffle at
  `replay.execute.ts:121-123` is NOT replaced in this WP — replacing
  it belongs to a future WP gated on D-0203.
- **No signature changes.** `replayGame`, `verifyDeterminism`, their
  parameter types, and their return types are unchanged.
- **No export changes.** `packages/game-engine/src/index.ts` is not
  modified.
- **No test changes.** `replay.verify.test.ts` is not modified. Test
  count must remain identical before and after.
- **No new files.** This WP creates no new source files.
- **JSDoc wording must be full sentences** (Rule 11) and must cite
  D-0205 + `MOVE_LOG_FORMAT.md` Gap #4 so readers can trace the
  rationale.
- **No "TODO" or "FIXME" comments** — the decision has been made;
  the warning is permanent under the current architecture.

**Session protocol:**
- If the existing JSDoc on either function contains language that
  already correctly narrows the claim (e.g., already says
  "determinism verification only"), preserve that language rather
  than rewording it — the goal is to *strengthen* the narrowing, not
  to rewrite.
- If at any point a runtime change seems necessary to make the
  warning truthful, **stop and flag it** — a runtime change is
  out of scope for this WP.

**Locked contract values:**
- D-0205 resolution: harness is *determinism-only / debug-only*
- Forbidden phrases in the JSDoc warnings:
  - "replays live matches"
  - "replays a specific match"
  - "reproduces live-match outcomes"
  (These would re-create the false claim D-0205 exists to prevent.)
- Required phrases (one or more, at discretion of the author):
  - "determinism-only"
  - "does not replay live-match RNG"
  - a cross-reference to `D-0205`
  - a cross-reference to `MOVE_LOG_FORMAT.md` Gap #4

---

## Scope (In)

### A) `packages/game-engine/src/replay/replay.execute.ts` — modified

Two edits:

1. **Module-level header comment** (top of file, above imports):
   add a short notice immediately after the existing file-level
   JSDoc stating:
   - This module is determinism-only tooling per D-0205
   - It does not replay live-match RNG (ignores `ReplayInput.seed`,
     uses a fixed reverse-shuffle at the `random.Shuffle` call below)
   - See `docs/ai/MOVE_LOG_FORMAT.md` Gap #4 and `DECISIONS.md §D-0205`

2. **`replayGame()` JSDoc block** (currently at lines 127-141):
   replace the opening sentence so it leads with the narrowed claim.
   The revised JSDoc must:
   - Open with a `@remarks` or bold "Determinism-only" block
   - State explicitly that this function does **not** reproduce live
     boardgame.io `ctx.random.*` RNG
   - Retain the existing parameter, return, and purity documentation
   - Cite D-0205 and `MOVE_LOG_FORMAT.md` Gap #4

The existing `// why:` comment at lines 119-120 explaining the
reverse-shuffle is preserved — this WP strengthens it with a
pointer to D-0205 but does not replace it.

### B) `packages/game-engine/src/replay/replay.verify.ts` — modified

One edit:

1. **`verifyDeterminism()` JSDoc block** (currently at lines 16-38):
   replace the opening sentences so they lead with the narrowed
   claim. The revised JSDoc must:
   - State explicitly that this function verifies the reducer is
     deterministic **given a fixed mock RNG**, not that the engine
     reproduces live-match outcomes
   - Cross-reference D-0205
   - Retain the existing `@param` / `@returns` documentation

The existing module-level JSDoc at the top of the file (lines 1-10)
is updated in parallel: add one sentence pointing at D-0205.

---

## Out of Scope

- **No runtime change to the reverse-shuffle** at
  `replay.execute.ts:121-123`. Replacing it with a seeded PRNG or
  with boardgame.io's `ctx.random.Shuffle` is exactly what a future
  WP gated on D-0203 must decide; this WP does not pre-commit that
  decision.
- **No change to `ReplayInput.seed` semantics** — the field remains
  stored but ignored. Any change to how `seed` is used requires
  D-0203 to resolve first.
- **No change to `replay.types.ts`** — type surface is unchanged.
- **No change to `replay.hash.ts`** — `computeStateHash` is correct
  as-is for a determinism harness; its djb2 + sorted-key contract
  is unrelated to D-0205.
- **No change to `replay.verify.test.ts`** — tests verify the
  existing behavior, which is not changing.
- **No change to `packages/game-engine/src/index.ts`** — the
  re-exports are names only; JSDoc lives on the source and flows
  through to consumers automatically.
- **No change to any consumer of the replay harness** — there are
  none in `apps/**` today (verified in `MOVE_LOG_FORMAT.md` Evidence
  Map).
- **No update to `MOVE_LOG_FORMAT.md`** — Gap #4 remains accurate;
  editing it to say "resolved by D-0205" would muddle the forensics
  audit trail. DECISIONS.md is the resolution record, not the
  forensics report.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope**.

---

## Files Expected to Change

- `packages/game-engine/src/replay/replay.execute.ts` — **modified** —
  module header notice + `replayGame()` JSDoc revision
- `packages/game-engine/src/replay/replay.verify.ts` — **modified** —
  module header notice + `verifyDeterminism()` JSDoc revision

Plus the mandatory Definition-of-Done updates:
- `docs/ai/STATUS.md` — WP-079 line added
- `docs/ai/work-packets/WORK_INDEX.md` — WP-079 checked off with date
- `docs/ai/DECISIONS.md §D-0205` — `Follow-up actions required`
  block: mark the JSDoc action as completed with the commit hash

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### JSDoc content
- [ ] `replay.execute.ts` module header comment cites `D-0205` and
      `MOVE_LOG_FORMAT.md` Gap #4
- [ ] `replayGame()` JSDoc opens with a determinism-only warning
      (word "determinism-only" present in the first 150 characters of
      the JSDoc block)
- [ ] `replayGame()` JSDoc contains the phrase "does not replay
      live-match RNG" (exact) or an equivalent disclaimer referencing
      `ReplayInput.seed` being ignored
- [ ] `replay.verify.ts` module header cites `D-0205`
- [ ] `verifyDeterminism()` JSDoc states the function proves
      determinism of the reducer under a fixed mock RNG, not
      live-match reproduction
- [ ] Neither file contains any of the forbidden phrases ("replays
      live matches", "replays a specific match", "reproduces
      live-match outcomes")

### Behavior preservation
- [ ] `replayGame()` signature unchanged (parameters + return type
      identical to starting commit)
- [ ] `verifyDeterminism()` signature unchanged
- [ ] No change to `replay.types.ts`, `replay.hash.ts`, or
      `packages/game-engine/src/index.ts` export surface — no new or
      removed exports anywhere

### Tests and build
- [ ] `pnpm --filter @legendary-arena/game-engine build` and
      `pnpm --filter @legendary-arena/game-engine test` both exit 0
- [ ] Test count is identical to the starting commit (no tests added,
      removed, or skipped)

### Scope enforcement
- [ ] `git diff --name-only` shows only the files listed in
      `## Files Expected to Change` (plus STATUS.md, WORK_INDEX.md,
      DECISIONS.md per DoD)

---

## Verification Steps

```pwsh
# Step 1 — confirm determinism-only label present in replay.execute.ts
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" -Pattern "determinism-only").Count
# Expected: >= 2 (module header + replayGame JSDoc)

# Step 2 — confirm D-0205 cross-reference present in both files
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" -Pattern "D-0205").Count
# Expected: >= 1
(Select-String -Path "packages\game-engine\src\replay\replay.verify.ts" -Pattern "D-0205").Count
# Expected: >= 1

# Step 3 — confirm MOVE_LOG_FORMAT.md Gap #4 cross-reference present
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" -Pattern "MOVE_LOG_FORMAT").Count
# Expected: >= 1

# Step 4 — confirm forbidden phrases absent from either file
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts","packages\game-engine\src\replay\replay.verify.ts" -Pattern "replays live matches"
# Expected: no output
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts","packages\game-engine\src\replay\replay.verify.ts" -Pattern "replays a specific match"
# Expected: no output
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts","packages\game-engine\src\replay\replay.verify.ts" -Pattern "reproduces live-match outcomes"
# Expected: no output

# Step 5 — confirm export signatures unchanged (compare against prior commit)
git diff packages/game-engine/src/replay/replay.execute.ts `
  | Select-String -Pattern "^(-|\+)export function replayGame"
# Expected: no matches (signature line neither removed nor added —
# JSDoc-only change)
git diff packages/game-engine/src/replay/replay.verify.ts `
  | Select-String -Pattern "^(-|\+)export function verifyDeterminism"
# Expected: no matches

# Step 6 — build + test
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0, test count identical to starting commit

# Step 7 — confirm scope
git diff --name-only
# Expected: exactly
#   packages/game-engine/src/replay/replay.execute.ts
#   packages/game-engine/src/replay/replay.verify.ts
#   docs/ai/STATUS.md
#   docs/ai/work-packets/WORK_INDEX.md
#   docs/ai/DECISIONS.md
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading the
> code is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `grep` confirms `D-0205` + `MOVE_LOG_FORMAT` references in both
      modified files
- [ ] `grep` confirms zero occurrences of all forbidden phrases
- [ ] Build + test pass with identical test count to the starting
      commit
- [ ] No files outside the expected set were modified (confirmed with
      `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — one-line entry: *"WP-079 labeled
      engine replay harness as determinism-only (JSDoc only, no
      behavior change) — closes the D-0205 follow-up action."*
- [ ] `docs/ai/DECISIONS.md §D-0205 Follow-up actions required by
      this decision:` updated — the JSDoc action is marked completed
      with the commit hash
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-079 checked off
      with today's date and dependency chain (WP-027, D-0205) noted
