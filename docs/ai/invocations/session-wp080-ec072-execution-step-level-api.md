# SESSION INVOCATION — EXECUTION
## WP-080 / EC-072 — Replay Harness Step-Level API (applyReplayStep)

**Mode:** EC-mode (lint gate + execution checklist discipline)
**Stage:** Execution (code + tests + governance updates)
**Packet:** WP-080 — Replay Harness Step-Level API for Downstream Snapshot / Replay Tools
**Checklist:** EC-072 — Replay Harness Step-Level API
**Upstream status:** WP-079 / EC-073 Done (commit `1e6de0b`; JSDoc narrowing already landed)
**Downstream:** WP-063 / EC-071 unblocked by this export
**Pre-flight:** READY TO EXECUTE (2026-04-19); Copilot check: HOLD resolved in-prompt via Findings 11, 17, 30 FIXes

---

## 0) NON-NEGOTIABLES (SCOPE LOCK IS BINARY)

### Allowed edits (ONLY)
1. `packages/game-engine/src/replay/replay.execute.ts`
2. `packages/game-engine/src/index.ts`
3. `packages/game-engine/src/replay/replay.execute.test.ts`
4. `docs/ai/STATUS.md`
5. `docs/ai/work-packets/WORK_INDEX.md`
6. `docs/ai/execution-checklists/EC_INDEX.md`

**Anything not explicitly allowed is forbidden.**

### Explicitly forbidden
- Exporting `MOVE_MAP`, `buildMoveContext`, `ReplayMoveContext`, `MoveFn`, or `replayAdvanceStage`
- Any new export besides `applyReplayStep`
- Modifying `replay.types.*`, `replay.hash.*`, `replay.verify.*`, `replay.verify.test.*`, `types.*`
- Any file outside `packages/game-engine/src/replay/` except the **single** barrel line in `packages/game-engine/src/index.ts`
- `.reduce()` in the refactored loop (must stay `for...of`)
- Any `boardgame.io` import under `packages/game-engine/src/replay/`
- `Math.random`, `Date.now`, `performance.now`, `console.*`, or `node:fs*` **inside `applyReplayStep`** (printing is permitted in tests only)
- Cloning `gameState` inside `applyReplayStep` (Q2 = Option A = mutate-and-return-same-reference)
- Rewording WP-079's JSDoc narrowing text (must remain verbatim-preserved)
- Backfilling EC-069 `<pending>` placeholder
- Popping `stash@{0}` or `stash@{1}`
- Using commit prefixes `WP-080:` or `EC-080:` — use **`EC-072:`** for code commits and **`SPEC:`** for governance-only commits

---

## 1) AUTHORITY CHAIN (READ IN ORDER)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, checklist discipline
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary, Persistence Boundary, Move Validation Contract
3. `docs/03.1-DATA-SOURCES.md` — replay input provenance
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — D-2706 `src/replay/` classification
5. `docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md`
6. `docs/ai/work-packets/WP-080-replay-harness-step-level-api.md`
7. `docs/ai/DECISIONS.md` — D-6304 (DECISIONS.md:4600), D-0201, D-0205, D-2702, D-2705, D-2706
8. `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`
9. `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`
10. `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` — formal 10-section structure + Precedent Log (WP-028 aliasing)
11. `packages/game-engine/src/replay/replay.execute.ts` — actual code (line numbers in WP/EC are post-WP-079 stale; verify by content)
12. `packages/game-engine/src/replay/replay.verify.ts` — narrowing already landed
13. `packages/game-engine/src/index.ts` — existing WP-027 barrel block at lines 206–211

---

## 2) BRANCH STRATEGY (LOCKED)

**Option B (locked):** Cut WP-080 execution branch off the WP-079 branch.

- Start from: `wp-079-replay-harness-determinism-label` (HEAD `1e2312b`)
- Create: `wp-080-replay-harness-step-level-api`

Rationale: WP-080 inherits WP-079's JSDoc narrowing verbatim. Option A (cut off main) would require re-applying the narrowing; Option C (continue on WP-079 branch) would entangle WP-079 and WP-080 commit history.

---

## 3) DIRTY-TREE DISCIPLINE (LOCK BEFORE ANY WORK)

Run:
```pwsh
git status --short
git stash list
```

Paste both outputs here and treat them as locks:

> ### LOCK: UNSTAGED ITEMS THAT MUST REMAIN UNSTAGED
> (paste `git status --short` output here)
>
> ### LOCK: STASHES THAT MUST REMAIN UNPOPPED
> (paste `git stash list` output here — expect `stash@{0}` WP-068/MOVE_LOG + `stash@{1}` pre-WP-062)

Rules:
- No `git add -A`
- No `git add .`
- Only `git add <explicit allowlist file path>`
- Re-run `git status --short` before each commit and confirm only expected files are staged

---

## 4) 01.5 WIRING ALLOWANCE — NOT INVOKED (LOCKED)

01.5 is **NOT INVOKED**. WP-080 does NOT:
1. Add or change any `LegendaryGameState` field
2. Change `buildInitialGameState` shape
3. Add to `LegendaryGame.moves`
4. Add or modify a phase hook / lifecycle wiring

If any of these become true mid-execution, **STOP** — that is scope violation, not a wiring-allowance event.

---

## 5) IMPLEMENTATION ORDER — HASH CAPTURE FIRST (HOLD Finding 11)

> Prevents the regression test from silently becoming a no-op by accidentally capturing the post-refactor hash.

### Step 5.1 — Create test file in CAPTURE MODE (before touching `replayGame`)

Create `packages/game-engine/src/replay/replay.execute.test.ts` with:

- `node:test` + `node:assert/strict` imports
- Exactly **one** `describe("applyReplayStep", ...)` block (locks suite delta at +1 → 102 suites)
- A top-level constant:
  ```ts
  // why: one-shot capture helper. Filled in by running the regression test
  // ONCE against pre-refactor replayGame, then replaced with the literal
  // hash. Not a permanent pattern — future WPs should not propagate it.
  const PRE_WP080_HASH = "__CAPTURE_ME__";
  ```

Regression test body (**calls `replayGame`, not `applyReplayStep`, during capture**):
- Construct the same `ReplayInput` fixture that `replay.verify.test.ts` uses (identical `setupConfig`, `seed`, `playerOrder`, `moves[]`).
- Construct the same `CardRegistryReader` fixture that `replay.verify.test.ts` uses.
- Call `replayGame(input, registry)` to obtain `result.stateHash`.
- If `PRE_WP080_HASH === "__CAPTURE_ME__"`: print the computed hash with a clear marker (e.g., `console.log('WP-080 CAPTURE:', result.stateHash)`) and `assert.fail('Paste the printed hash into PRE_WP080_HASH, then re-run this test before refactoring replayGame.')`.
- Otherwise: `assert.strictEqual(result.stateHash, PRE_WP080_HASH)`.

Run the test. Capture the printed hash. Substitute it into `PRE_WP080_HASH`. Re-run — the test must pass against pre-refactor `replayGame` **before** Step 5.2.

### Step 5.2 — Only after `PRE_WP080_HASH` is locked, proceed to code changes (§6)

Do NOT refactor `replayGame` until the regression test is green against the pre-refactor code path.

---

## 6) CODE CHANGES (Q1–Q5 LOCKED)

### Step 6.1 — Add `applyReplayStep` named export

In `packages/game-engine/src/replay/replay.execute.ts`, add a named export **immediately above** `replayGame`:

```ts
/**
 * Applies a single ReplayMove to the given LegendaryGameState and returns
 * the same reference.
 *
 * Mutate-and-return-same-reference contract (D-6304): consumers wanting
 * historical snapshots must project via buildUIState after each step — they
 * must not retain G copies. applyReplayStep never clones.
 *
 * Unblocks WP-063's buildSnapshotSequence and future replay inspectors by
 * exposing the step-level dispatch primitive while keeping MOVE_MAP as the
 * single source of truth (D-6304). Inherits replayGame's determinism-only
 * semantics (D-0205).
 *
 * @param gameState - The current mutable game state; mutated in place.
 * @param move - The ReplayMove to apply (name + playerId + optional args).
 * @param numPlayers - Total number of players in the match.
 * @returns The same gameState reference that was passed in.
 */
export function applyReplayStep(
  gameState: LegendaryGameState,
  move: ReplayMove,
  numPlayers: number,
): LegendaryGameState {
  const moveFn = MOVE_MAP[move.moveName];
  if (!moveFn) {
    gameState.messages.push(
      `Replay warning: unknown move name "${move.moveName}" — skipped.`,
    );
    return gameState;
  }
  const moveContext = buildMoveContext(gameState, move.playerId, numPlayers);
  moveFn(moveContext, move.args);
  return gameState;
}
```

Locked semantics:
- Mutate-and-return-same-reference (Q2 = Option A)
- Uses existing file-local `MOVE_MAP` for dispatch (single source of truth)
- `MOVE_MAP`, `buildMoveContext`, `ReplayMoveContext` remain file-local (Q4)
- Unknown move name: warning-and-skip with canonical text `Replay warning: unknown move name "${move.moveName}" — skipped.`
- No throw; no new imports; no cloning

### Step 6.2 — Refactor `replayGame`'s loop to delegate

Replace the loop body (currently at approx lines 183–195) with a single call. Add a `// why:` comment directly above the `for...of`:

```ts
// why: the loop delegates to applyReplayStep so MOVE_MAP + buildMoveContext
// remain the single source of truth for dispatch (D-6304). Reassignment is
// stylistic — applyReplayStep returns the same reference per Q2 = A, so the
// variable binding is always identical. Determinism regression is covered by
// the PRE_WP080_HASH guard in replay.execute.test.ts via computeStateHash.
for (const move of input.moves) {
  gameState = applyReplayStep(gameState, move, numPlayers);
}
```

Constraints: stay `for...of` (no `.reduce()`); `replayGame`'s signature, return type, and JSDoc are unchanged; WP-079's module-header and `replayGame` JSDoc narrowing text is preserved verbatim.

### Step 6.3 — Barrel: exactly one new line under WP-027 block

In `packages/game-engine/src/index.ts`, insert a single line under the existing WP-027 block (after line 211):

```ts
export { applyReplayStep } from './replay/replay.execute.js';
```

No reformatting of surrounding lines. No reordering of existing exports.

---

## 7) TESTS (LOCKED: 3 CASES inside one `describe`)

All tests live in `replay.execute.test.ts` under `describe("applyReplayStep", ...)`.

### Case 1 — Deep-clone identity + same-reference contract (WP-080 §C.1 verbatim)

- Build an initial `LegendaryGameState` via `buildInitialGameState` with the fixture setup + `makeMockCtx` setup context.
- Deep-clone it: `const clone = structuredClone(original);`
- Call `applyReplayStep(original, move, numPlayers)` and `applyReplayStep(clone, move, numPlayers)` with identical inputs.
- Assert `computeStateHash(original) === computeStateHash(clone)` (determinism of a single step).
- Assert `applyReplayStep(original, move, numPlayers) === original` (same-reference contract — the returned object IS the input).

### Case 2 — `replayGame` regression guard (byte-identical hash)

- Uses the same fixture as §5.1 capture.
- Computes `replayGame(input, registry).stateHash`.
- Asserts `stateHash === PRE_WP080_HASH` (no placeholder; strictly equal).
- Include a `// why:` comment anchoring: this constant proves byte-identity through the refactor and must never be updated casually.

### Case 3 — Unknown move warning-and-skip

- Call `applyReplayStep(gameState, { moveName: "nonexistentMove", playerId: "0", args: undefined }, numPlayers)`.
- Assert:
  - Returned reference is `===` input `gameState`
  - `gameState.messages` gained exactly one new entry with text `Replay warning: unknown move name "nonexistentMove" — skipped.`
  - No throw

### Suite-count lock

Exactly one `describe()` block in this file. Expected delta: game-engine 409 → 412 tests; 101 → 102 suites.

---

## 8) VERIFICATION GATES

1. `git diff --name-only <branch-cut-HEAD>..HEAD` shows ONLY the 6 allowlist files
2. `pnpm --filter @legendary-arena/game-engine build` exits 0
3. `pnpm --filter @legendary-arena/game-engine test` exits 0; count = 412 passing (was 409)
4. `pnpm -r test` exits 0; count = 467 passing (was 464); 0 failures; 0 skipped
5. Content-based greps (line-number-independent; use both `Select-String` case-insensitive and `grep -c` case-sensitive — normalize case if they disagree):
   - `^export function applyReplayStep\(` in `replay.execute.ts` → exactly 1
   - `^const MOVE_MAP:` in `replay.execute.ts` → exactly 1
   - `^export const MOVE_MAP` in `replay.execute.ts` → 0
   - `^function buildMoveContext\(` in `replay.execute.ts` → exactly 1
   - `^export function buildMoveContext` in `replay.execute.ts` → 0
   - `applyReplayStep` in `index.ts` → ≥ 1
   - `console\.|Date\.now|Math\.random|performance\.now|from 'node:fs` in `replay.execute.ts` → 0 (tests file exempted; grep the source file only)
   - `from ['"]boardgame\.io` in `replay.execute.ts` → 0 (use escaped dot; bare `.` matches comments)
6. WP-079 narrowing preserved (content-based):
   - `"determinism-only"` in `replay.execute.ts` → ≥ 2
   - `"determinism-only"` in `replay.verify.ts` → ≥ 1
   - `D-0205` xref present in both files
   - `MOVE_LOG_FORMAT.md` Gap #4 xref present in `replay.execute.ts`
   - Forbidden phrases absent in both files: `replays live matches`, `replays a specific match`, `reproduces live-match outcomes`
7. Preserved `// why:` comments still present verbatim: reverse-shuffle block, events no-op block (verify by content regardless of line drift)
8. `git stash list` unchanged from §3 lock

---

## 9) PRE-COMMIT REVIEW (HOLD Finding 30)

### Gatekeeper choice (locked)

**Separate gatekeeper session** (recommended for WP-080 given new long-lived abstraction + regression-guarded refactor). Run `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` in a fresh Claude Code session after Verification Gates §8 pass and before Commit A lands.

If the user explicitly opts for inline self-review via `AskUserQuestion`, disclose the deviation in the Commit A body per P6-42.

### Commit hygiene (01.3)

Load `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` before composing any commit subject.

**Forbidden subject words** (rejected by `commit-msg` hook): `WIP`, `wip`, `fix stuff`, `misc`, `tmp`, `updates`, `changes`, `debug`, `quick fix`, `hotfix`, `cleanup`, `refactor`.

**Subject constraints:** ≥ 12 chars after prefix; prefix literal `EC-072:` or `SPEC:` (never `WP-080:` / `EC-080:`).

**Dry-run (optional):** if `scripts/git/ec-commit.ps1` exists, `pwsh scripts/git/ec-commit.ps1 -Check -Message "<subject>"` validates without committing. Verify script existence before relying on it; not a hard dependency.

No `--no-verify`. No `--amend` (two-commit split §10 obviates it).

---

## 10) COMMITS (TWO-COMMIT SPLIT)

> Two-commit split is deliberate: keeps EC-072 flip out of the `EC-072:` code commit, avoiding the `commit-msg` hook's non-blocking "EC governance files staged with EC-### commit" advisory. Also matches WP-079 / EC-073 pattern (`1e6de0b` + `2131116`) that landed cleanly without `--amend`.

### Commit A — Code + tests (prefix `EC-072:`)

Stage ONLY:
- `packages/game-engine/src/replay/replay.execute.ts`
- `packages/game-engine/src/replay/replay.execute.test.ts`
- `packages/game-engine/src/index.ts`

`git status --short` before staging: confirm only these three files are in the staged set. Commit under `EC-072:` prefix. **Capture Commit A hash:** `git rev-parse HEAD` → record as `<A-HASH>`.

### Commit B — Governance only (prefix `SPEC:`)

Before staging Commit B, substitute `<A-HASH>` verbatim into the governance file entries:

- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-072 row from `Draft` to `Done`; append `Executed YYYY-MM-DD at commit <A-HASH>`
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-080 row checkbox from `[ ]` to `[x]` with today's date; update "Reviewed" cell if required by the row format
- `docs/ai/STATUS.md` — one-line today-dated entry citing `<A-HASH>` and noting WP-063 is now unblocked at Pre-Session Gate #4

Stage ONLY these three files. Commit under `SPEC:` prefix. Commit body references `<A-HASH>`.

This avoids `--amend` entirely (matches the WP-079 / EC-073 pattern that worked).

---

## 11) 01.6 POST-MORTEM (MANDATORY — NEW LONG-LIVED ABSTRACTION)

Formal 10-section post-mortem required per P6-35 trigger: `applyReplayStep` becomes the canonical step-level dispatch surface for every future replay consumer. Run in the same session, **before** Commit A.

### §5 Aliasing audit — FIRST PRIORITY (HOLD Finding 17)

Explicitly cite the WP-028 `cardKeywords` precedent from 01.6 §Precedent Log, and distinguish:

- WP-028 precedent: `cardKeywords` aliasing was **unintentional** — a returned array shared a reference to a mutable `G.cardKeywords[space]`, letting consumers mutate `G` through a projection. Fixed with spread copy.
- WP-080 contract: aliasing is **intentional** — `applyReplayStep` returns the same reference it received (Q2 = A), documented in JSDoc, enforced in Test Case 1 (`===` assertion).

The audit must verify:
1. `applyReplayStep` returns `gameState` (the input parameter) — never a `structuredClone`, never a spread, never a new object literal
2. No helper introduced or touched by the refactor returns an aliased reference to a mutable `G` sub-field (no accidental WP-028-style leak)
3. `replayGame`'s reassignment `gameState = applyReplayStep(...)` is binding-preserving only — not creating a new object

§5 must produce a PASS verdict before Commit A may stage.

### All 10 sections required

No skipping. Match the structure in `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` §Formal 10-section output.

---

## 12) STOP CONDITIONS

Stop immediately if any of the following occurs:

- Any forbidden file is modified
- Any forbidden export is added (MOVE_MAP, buildMoveContext, ReplayMoveContext, MoveFn, replayAdvanceStage)
- Regression test (Case 2) fails: computed `stateHash` diverges from `PRE_WP080_HASH`
- Any 01.5 wiring criterion (§4) becomes true
- Any WP-079 narrowing text is altered
- `applyReplayStep` throws under any input (including unknown move)
- `git stash list` changes from §3 lock
- EC-069 `<pending>` placeholder is modified

Escalate via `AskUserQuestion` with named options. Never `--no-verify`, `--amend`, or silent bypass.

END.
