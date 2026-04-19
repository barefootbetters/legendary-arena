# Session Prompt — WP-079 Label Replay Harness as Determinism-Only

**Work Packet:** [docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md](../work-packets/WP-079-label-replay-harness-determinism-only.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md](../execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md)
**Commit prefix:** `EC-073:` (NEVER `WP-079:` — `.githooks/commit-msg` rejects `WP-###:` per P6-36). The three valid prefixes under 01.3 are `EC-###:`, `SPEC:`, `INFRA:`.
**Session class:** Code-changing execution session (modifies two `.ts` files; doc-only content change; zero runtime behavior change)
**Primary layer:** Game Engine (documentation-only edit under `packages/game-engine/src/replay/`)

---

## Why This Session Exists

`docs/ai/MOVE_LOG_FORMAT.md` Gap #4 (forensics report, 2026-04-18,
commit `1d709e5`) discovered that
`packages/game-engine/src/replay/replay.execute.ts` hardcodes a
reverse-shuffle at lines 121–123 and ignores the stored
`ReplayInput.seed`. The harness proves the reducer is deterministic
under a fixed mock RNG but does **not** reproduce live-match
boardgame.io `ctx.random.*` RNG.

D-0205 (RNG Truth Source for Replay, Active 2026-04-18) resolved
this by **scoping the harness explicitly as determinism-only /
debug-only** rather than by adding a new RNG pipeline (option B
permanently rejected per D-0002; option A deferred pending D-0203).
WP-079 carries out the single follow-up action D-0205 names: add
JSDoc + module-header warnings so the narrowed claim is visible at
every export surface.

This is pure documentation. Zero runtime behavior change. Zero
signature change. Zero export change. Zero test change.

---

## Pre-Session Gates (Resolve Before Writing Any File)

Each gate is binary. If unresolved, STOP.

1. **Commit-prefix literal (P6-36).** Every commit uses `EC-073:`.
   `WP-079:` is **forbidden** — the hook rejects it. If the WP-079
   body trailing note says "use `WP-079:` prefix", that predates
   P6-36 and is overridden by this session prompt and by EC-073's
   Locked Values.

2. **Governance base commit present.** Run:
   ```pwsh
   git log --oneline -5
   git status --short
   git stash list
   ```
   The log must show `41d28d1` (SPEC: WP-080 + EC-072 + D-6304
   drafts) or later — the SPEC commit that drafted EC-073 itself.
   If `41d28d1` or the EC-073 drafting commit is not present, STOP
   — the governance bundle is unlanded.

3. **Repo baseline green.** `pnpm -r test` must exit 0 with the
   starting-commit test count recorded (expected **464** or
   whatever the HEAD baseline is). WP-079 MUST NOT change this
   count — the count is identical before and after execution
   per EC-073 Locked Values.

4. **Upstream dependencies verified.**
   - WP-027 complete — `replayGame` + `verifyDeterminism` +
     `computeStateHash` exported and tests pass.
   - D-0205 Active in `DECISIONS.md` with Resolved 2026-04-18.
   - `docs/ai/MOVE_LOG_FORMAT.md` Gap #4 exists unedited.

5. **Stash + placeholder discipline (P6-41).**
   - `stash@{0}` (WP-068 / MOVE_LOG_FORMAT) retained — MUST NOT pop.
   - `stash@{1}` (WP-068 pre-wp-062-branch-cut) retained — MUST NOT
     pop.
   - EC-069 `<pending — gatekeeper session>` placeholder in
     `EC_INDEX.md` MUST NOT be backfilled in any `EC-073:` commit.
     Cross-WP contamination is a scope violation.

6. **Target JSDoc blocks located.**
   - `replayGame()` JSDoc — `replay.execute.ts` ~lines 127–137.
     Replace wholesale, not append.
   - `verifyDeterminism()` JSDoc — `replay.verify.ts` ~lines 25–38.
     Replace wholesale, not append.
   - Module-level JSDoc — `replay.execute.ts` ~lines 1–9 (append
     new paragraph); `replay.verify.ts` ~lines 1–10 (append one
     sentence).

If any gate is unresolved, STOP.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, SPEC vs EC commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (engine owns replay; doc-only WP introduces no cross-layer imports)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — Rule 11 (JSDoc full sentences), Rule 6 (preserve existing `// why:` comments), Rule 13 (ESM only)
4. [docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md](../execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Files to Produce + After Completing)
5. [docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md](../work-packets/WP-079-label-replay-harness-determinism-only.md) — authoritative WP specification (Locked contract values verbatim)
6. [docs/ai/session-context/session-context-wp079.md](../session-context/session-context-wp079.md) — WP-079 exit state + forbidden/required phrases + baseline preservation
7. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — three-prefix list (`EC-###:`, `SPEC:`, `INFRA:`); no fourth prefix
8. [docs/ai/DECISIONS.md](../DECISIONS.md) — §D-0002 (Determinism Non-Negotiable, rejects option B); §D-0201 (Replay as First-Class); §D-0205 (RNG Truth Source — the decision WP-079 carries out); §D-0203 / §D-0204 (Open — NOT touched by WP-079)
9. [docs/ai/MOVE_LOG_FORMAT.md](../MOVE_LOG_FORMAT.md) — §Known Gaps / Risks Gap #4 (the forensics trail cited in both JSDoc rewrites)
10. [packages/game-engine/src/replay/replay.execute.ts](../../../packages/game-engine/src/replay/replay.execute.ts) — read completely; lines 1–9 (module JSDoc), 110–124 (preserved `// why:` blocks), 127–137 (replace), 138 (signature untouched)
11. [packages/game-engine/src/replay/replay.verify.ts](../../../packages/game-engine/src/replay/replay.verify.ts) — read completely; lines 1–10 (module JSDoc), 25–38 (replace), 39 (signature untouched), 43–45 (preserved `// why:`)

If any of these conflict, higher-authority documents win.
`docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md` beat any
session-prompt or WP wording.

---

## Goal (Binary)

After this session:

1. `packages/game-engine/src/replay/replay.execute.ts` carries a
   module-header notice (after the existing JSDoc block, above
   imports) stating the module is determinism-only tooling per
   D-0205, that it does not replay live-match RNG (ignores
   `ReplayInput.seed`, uses a fixed reverse-shuffle), and
   cross-referencing `MOVE_LOG_FORMAT.md` Gap #4.
2. The `replayGame()` JSDoc block (previously at ~127–137) is
   **replaced wholesale** with one that leads with the narrowed
   determinism-only claim, states explicitly the function does not
   reproduce live boardgame.io `ctx.random.*` RNG, cites D-0205 and
   `MOVE_LOG_FORMAT.md` Gap #4, and retains `@param` / `@returns`
   documentation.
3. `packages/game-engine/src/replay/replay.verify.ts` module JSDoc
   (lines 1–10) gains one sentence pointing at D-0205.
4. The `verifyDeterminism()` JSDoc block (previously at ~25–38) is
   **replaced wholesale** stating the function verifies the reducer
   is deterministic under a fixed mock RNG, NOT that the engine
   reproduces live-match outcomes, with a D-0205 cross-reference
   and retained `@param` / `@returns`.
5. All three forbidden phrases grep to zero hits across both files.
6. All required phrases grep to their required hit counts.
7. `replayGame` and `verifyDeterminism` signature lines are byte-
   identical to the starting commit (`git diff` shows no matches
   for `^(-|\+)export function (replayGame|verifyDeterminism)`).
8. `pnpm --filter @legendary-arena/game-engine build` and
   `pnpm --filter @legendary-arena/game-engine test` both exit 0.
   `pnpm -r test` exits 0 with test count **identical** to
   starting commit.
9. Governance updates: `STATUS.md` + `WORK_INDEX.md` +
   `DECISIONS.md §D-0205 Follow-up` + `EC_INDEX.md` (flip EC-073
   Draft → Done with commit hash).
10. `stash@{0}` and `stash@{1}` retained. EC-069 `<pending>`
    placeholder not backfilled.
11. Commits use `EC-073:` prefix exclusively.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a minor
deviation. STOP and escalate via `AskUserQuestion`.

### Modified — source (doc-only content edit)
- `packages/game-engine/src/replay/replay.execute.ts` — module header
  notice + `replayGame()` JSDoc wholesale rewrite; reverse-shuffle
  and events `// why:` comments preserved verbatim
- `packages/game-engine/src/replay/replay.verify.ts` — module header
  sentence appended + `verifyDeterminism()` JSDoc wholesale rewrite;
  two-run `// why:` preserved verbatim

### Modified — governance (per DoD)
- `docs/ai/STATUS.md` — one-line WP-079 completion entry
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-079 row `[ ]` →
  `[x]` with completion date
- `docs/ai/DECISIONS.md` — §D-0205 "Follow-up actions required"
  block updated: JSDoc action marked completed with commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-073 flipped from
  Draft to Done with `Executed YYYY-MM-DD at commit <hash>`. If
  dirty at commit time, apply P6-41 stash + re-apply + leave-stash
  pattern

### Must remain UNTOUCHED
- `packages/game-engine/src/replay/replay.types.ts`
- `packages/game-engine/src/replay/replay.hash.ts`
- `packages/game-engine/src/replay/replay.verify.test.ts`
- `packages/game-engine/src/index.ts`
- Every other file under `packages/game-engine/src/`
- `packages/registry/**`, `packages/preplan/**`,
  `packages/vue-sfc-loader/**`
- `apps/arena-client/**`, `apps/registry-viewer/**`,
  `apps/server/**`
- `docs/ai/MOVE_LOG_FORMAT.md` — the forensics record stays
  unedited (Gap #4 is still the condition D-0205 resolves; editing
  it would muddle the audit trail)
- `docs/ai/work-packets/WP-080-*.md`,
  `docs/ai/execution-checklists/EC-072-*.checklist.md` —
  WP-080 / EC-072 governance is untouched here
- `stash@{0}` and `stash@{1}` — NOT popped
- EC-069 `<pending>` placeholder in `EC_INDEX.md` — NOT backfilled

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never use `Math.random()` — all randomness uses `ctx.random.*`
- Never throw inside moves; `Game.setup()` is the only throw site
- Never persist `G` or `ctx`
- ESM only; Node v22+; `node:` prefix on Node built-ins
- Test files use `.test.ts` extension (irrelevant — no new tests)
- Full file contents for every modified file; no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Doc-only.** The reverse-shuffle at `replay.execute.ts:121–123`
  is NOT replaced — that belongs to a future WP gated on D-0203.
- **No signature changes.** `replayGame`, `verifyDeterminism`,
  their parameter types, and their return types are frozen.
- **No export changes.** `packages/game-engine/src/index.ts`
  untouched.
- **No test changes.** `replay.verify.test.ts` untouched. Test
  count identical before/after.
- **No new files.**
- **JSDoc wording must be full sentences** (00.6 Rule 11) and
  cite D-0205 + `MOVE_LOG_FORMAT.md` Gap #4.
- **No "TODO" or "FIXME" comments** — the decision has been
  made; the warning is permanent under the current architecture.

**Session protocol:**
- If the existing JSDoc already contains language that correctly
  narrows the claim, **strengthen** it rather than reword the
  correct parts.
- If a runtime change seems necessary to make the warning
  truthful, **STOP and escalate** — runtime changes are out of
  scope.
- If a file beyond the allowlist must be modified, STOP and
  escalate via `AskUserQuestion`.

**Locked contract values:**
- Forbidden phrases (zero hits across both files):
  - `"replays live matches"`
  - `"replays a specific match"`
  - `"reproduces live-match outcomes"`
- Required phrases:
  - `"determinism-only"` ≥ 2 hits in `replay.execute.ts`
  - `"determinism-only"` ≥ 1 hit in `replay.verify.ts`
  - `D-0205` cross-reference in both files
  - `MOVE_LOG_FORMAT` cross-reference in `replay.execute.ts`
- Preserved `// why:` comments (unchanged except for optional
  D-0205 pointer on the reverse-shuffle block):
  - `replay.execute.ts:110–117` (events no-op during replay)
  - `replay.execute.ts:118–124` (reverse-shuffle rationale)
  - `replay.verify.ts:43–45` (two-run rationale)

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — engine build & test at baseline
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: both exit 0 at starting commit

# Step 2 — confirm determinism-only label present
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "determinism-only").Count
# Expected: >= 2
(Select-String -Path "packages\game-engine\src\replay\replay.verify.ts" `
  -Pattern "determinism-only").Count
# Expected: >= 1

# Step 3 — confirm D-0205 cross-reference in both files
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "D-0205").Count
# Expected: >= 1
(Select-String -Path "packages\game-engine\src\replay\replay.verify.ts" `
  -Pattern "D-0205").Count
# Expected: >= 1

# Step 4 — confirm MOVE_LOG_FORMAT cross-reference
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "MOVE_LOG_FORMAT").Count
# Expected: >= 1

# Step 5 — confirm all three forbidden phrases absent
Select-String `
  -Path "packages\game-engine\src\replay\replay.execute.ts", `
         "packages\game-engine\src\replay\replay.verify.ts" `
  -Pattern "replays live matches"
# Expected: no output
Select-String `
  -Path "packages\game-engine\src\replay\replay.execute.ts", `
         "packages\game-engine\src\replay\replay.verify.ts" `
  -Pattern "replays a specific match"
# Expected: no output
Select-String `
  -Path "packages\game-engine\src\replay\replay.execute.ts", `
         "packages\game-engine\src\replay\replay.verify.ts" `
  -Pattern "reproduces live-match outcomes"
# Expected: no output

# Step 6 — confirm signature lines byte-identical
git diff packages/game-engine/src/replay/replay.execute.ts `
  | Select-String -Pattern "^(-|\+)export function replayGame"
# Expected: no matches
git diff packages/game-engine/src/replay/replay.verify.ts `
  | Select-String -Pattern "^(-|\+)export function verifyDeterminism"
# Expected: no matches

# Step 7 — final build + test
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; test count identical to starting commit

# Step 8 — repo-wide test count identical
pnpm -r test
# Expected: exit 0; count identical to starting commit; 0 failures

# Step 9 — confirm scope
git diff --name-only
# Expected exactly:
#   packages/game-engine/src/replay/replay.execute.ts
#   packages/game-engine/src/replay/replay.verify.ts
#   docs/ai/STATUS.md
#   docs/ai/work-packets/WORK_INDEX.md
#   docs/ai/DECISIONS.md
#   docs/ai/execution-checklists/EC_INDEX.md

# Step 10 — confirm stashes retained
git stash list
# Expected: stash@{0} + stash@{1} both present, unchanged
```

---

## Definition of Done

- [ ] All Pre-Session Gates resolved
- [ ] All Acceptance Criteria in WP-079 §Acceptance Criteria pass
- [ ] All After-Completing items in EC-073 satisfied
- [ ] All Verification Steps 1–10 pass
- [ ] `STATUS.md`, `WORK_INDEX.md`, `DECISIONS.md §D-0205`,
      `EC_INDEX.md` updated per §Files Expected to Change
- [ ] No files outside §Files Expected to Change modified
- [ ] `stash@{0}` and `stash@{1}` retained (not popped)
- [ ] EC-069 `<pending>` placeholder not backfilled
- [ ] **No 01.6 post-mortem required** — WP-079 is doc-only,
      introduces no new long-lived abstraction, no new code
      category; the two P6-35 triggers are both absent
- [ ] Commit uses `EC-073:` prefix (NEVER `WP-079:` per P6-36)

---

## Out of Scope (Explicit)

- No runtime change anywhere in `packages/game-engine/`
- No replacement of the reverse-shuffle at `replay.execute.ts:121–123`
  (future WP gated on D-0203)
- No change to `ReplayInput.seed` semantics (field remains stored
  but ignored; any change requires D-0203 to resolve first)
- No change to `replay.types.ts`, `replay.hash.ts`, or
  `packages/game-engine/src/index.ts`
- No change to `replay.verify.test.ts` or any other test file
- No new source files anywhere
- No edit to `docs/ai/MOVE_LOG_FORMAT.md` (forensics trail
  preserved)
- No WP-080 / EC-072 governance edits (separate session chain)
- No backfill of the EC-069 `<pending>` placeholder
- No stash pops
- No 01.6 post-mortem (doc-only; P6-35 triggers absent)

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no
"while I'm here" improvements. If any required modification cannot
be classified as within the WP-079 allowlist, STOP and escalate
via `AskUserQuestion` rather than force-fitting. P6-27 is active.

When finished: run Verification Steps 1–10, commit under `EC-073:`,
and hand off. The next session in the chain is WP-080 execution
under `EC-072:` (see
`docs/ai/invocations/session-wp080-replay-harness-step-level-api.md`
for drafting context; WP-080 execution prompt is a separate
artifact that can be drafted as needed, or EC-072 alone is
sufficient as the execution contract).
