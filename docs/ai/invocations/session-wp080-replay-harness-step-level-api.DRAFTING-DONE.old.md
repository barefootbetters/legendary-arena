> **⚠️ RETIRED — DO NOT RUN ⚠️**
>
> This file was the SPEC-only drafting session invocation for WP-080 / EC-072.
> The drafting session ran to completion on 2026-04-18 (merged to main via
> SPEC bundle `1264133` → `3307b12`). Its deliverables (WP-080 body, EC-072
> checklist, D-6304 decision, WORK_INDEX / EC_INDEX / STATUS rows) are all on
> disk.
>
> **For WP-080 execution, use:**
> `docs/ai/invocations/session-wp080-ec072-execution-step-level-api.md`
>
> This file is retained as a historical audit artifact only. Renamed with
> the `.DRAFTING-DONE.old.md` suffix on 2026-04-19 to prevent accidental
> re-invocation in a new Claude Code session.

---

# Session Prompt — WP-080 / EC-072 Drafting: Replay Harness Step-Level API

**Session class:** SPEC-only drafting session (no source code changes).
**Deliverables:** draft `WP-080`, draft `EC-072`, new decision `D-6304`, governance-index updates, amendment lines for `WP-063 §Preflight / Pre-Session Gates #4`.
**Commit prefix:** `SPEC:` on every commit. **Never** `EC-###:` (this session edits no source code). **Never** `WP-###:` (hook rejects per P6-36).
**Upstream blocker resolved by this session:** unblocks `WP-063 Pre-Session Gate #4` so a future session can resume `EC-071:` execution.

---

## Why This Session Exists

A prior session attempted to execute `WP-063 / EC-071` (Replay Snapshot Producer). At **Pre-Session Gate #4 — "WP-027 step-level API"** the session found that `packages/game-engine/src/replay/replay.execute.ts` exposes only `replayGame(input, registry): ReplayResult` — an **end-to-end** harness that loops all moves internally and returns only the final state plus a hash. The per-move dispatch primitives (`MOVE_MAP` at `replay.execute.ts:77`, `buildMoveContext` at `replay.execute.ts:98`) are **module-local**. No step function, no iterator, no intermediate `G` observable from outside the file.

Per the EC-071 session prompt §Session protocol and §Pre-Session Gates #4 verbatim:

> "If WP-027's harness does not expose a step function or equivalent per-input stepping, STOP and ask — do not patch WP-027 locked contract files from this packet."
> "If the harness is end-to-end only, WP-063 is **BLOCKED** — STOP and ask; do not patch WP-027 locked contract files from this session."

The user selected the **"Stop and amend (pre-flight)"** option. This session produces the amendment governance artifacts so the missing primitive can be added in a follow-up `EC-072:` execution session, after which `WP-063` resumes under its existing `EC-071:` prompt.

This session is pure documentation. No `.ts` file is read in order to modify it; reads are for understanding only.

---

## Authority Chain (Read in Order)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, SPEC vs EC commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary invariants (harness lives in Game Engine; additive exports do not cross layers)
3. [.claude/rules/work-packets.md](../../../.claude/rules/work-packets.md) — Foundation Prompts rule, status-update discipline, WORK_INDEX authority
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — Drift Detection, Pure Helpers list, `.test.ts` extension
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (Authoritative); §Persistence Boundary
6. [docs/ai/REFERENCE/00.3-prompt-lint-checklist.md](../REFERENCE/00.3-prompt-lint-checklist.md) — **run the lint gate on the drafted WP-080 before committing**
7. [docs/ai/execution-checklists/EC-TEMPLATE.md](../execution-checklists/EC-TEMPLATE.md) — canonical EC structure for EC-072
8. [docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md](../REFERENCE/01.1-how-to-use-ecs-while-coding.md) — EC authority model
9. [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) — the three valid prefixes (`EC-###:`, `SPEC:`, `INFRA:`); this session uses `SPEC:` exclusively
10. [docs/ai/REFERENCE/01.4-precedent-log.md](../REFERENCE/01.4-precedent-log.md) (if present) — cross-reference P6-34 (governance-before-execution), P6-35 (post-mortem mandatoriness), P6-36 (commit-prefix literal), P6-37 (test-infra explicit allowlist), P6-41 (stash + re-apply pattern), P6-42 (same-session deviation disclosure)
11. [docs/ai/DECISIONS.md](../DECISIONS.md) — read §D-0201 (Replay is first-class) and §D-0205 (harness scoped as determinism-only) before writing D-6304
12. [docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md](../work-packets/WP-027-determinism-replay-verification-harness.md) — the WP this session's deliverable amends; read in full
13. [docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md](../work-packets/WP-079-label-replay-harness-determinism-only.md) — **coordination dependency**: both WP-079 and WP-080 touch `replay.execute.ts`; §Order of Execution below resolves the collision
14. [docs/ai/work-packets/WP-063-replay-snapshot-producer.md](../work-packets/WP-063-replay-snapshot-producer.md) — the consumer whose Pre-Session Gate #4 is currently BLOCKED
15. [docs/ai/invocations/session-wp063-replay-snapshot-producer.md](./session-wp063-replay-snapshot-producer.md) — the prompt whose §Pre-Session Gates #4 this session amends
16. [packages/game-engine/src/replay/replay.execute.ts](../../../packages/game-engine/src/replay/replay.execute.ts) — **read only**. Understand what `MOVE_MAP`, `buildMoveContext`, and the step body (lines 156–168) look like today so the drafted WP-080 can specify their exported shape without guessing
17. [packages/game-engine/src/replay/replay.verify.ts](../../../packages/game-engine/src/replay/replay.verify.ts) — **read only**. Confirms the existing consumer of `replayGame` so the WP-080 refactor proposal does not accidentally break `verifyDeterminism`
18. [packages/game-engine/src/replay/replay.verify.test.ts](../../../packages/game-engine/src/replay/replay.verify.test.ts) — **read only**. Establishes the behavior envelope the WP-080 refactor must preserve
19. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — read the WP-027 block (approx lines 206–211) to confirm the barrel pattern the new exports will follow

If any of these conflict, higher-authority documents win. `ARCHITECTURE.md` and `.claude/rules/*.md` beat any session-prompt or WP wording.

---

## Pre-Session Gates (Resolve Before Writing Any File)

Each gate is binary. If unresolved, STOP.

1. **Commit-prefix literal (P6-36).** Every commit in this session uses the `SPEC:` prefix. `WP-080:` is forbidden by `.githooks/commit-msg`; `EC-072:` is forbidden because this session edits no source code (EC prefix is reserved for execution sessions that satisfy the corresponding checklist's DoD). If a `.ts` / `.json` / `.cjs` source file modification is proposed mid-session, **STOP** — escalate via `AskUserQuestion` with three options (recommended / split-session / unsafe-bypass).

2. **Governance base commit present.** Run:
   ```pwsh
   git log --oneline -5
   git status --short
   ```
   `eb19264` (SPEC: EC-071 draft + D-6301/D-6302/D-6303) must appear in the log. Governance-index files (`DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `02-CODE-CATEGORIES.md`, `STATUS.md`) must be clean in `git status --short`. Unrelated dirty files (`content/themes/*.json`, `.claude/settings.local.json`, untracked `docs/ai/invocations/session-*.md`, untracked `docs/ai/session-context/*.md`, root-level survey files) are expected and must not be staged into any SPEC commit.

3. **Stash discipline (P6-41).** Run:
   ```pwsh
   git stash list
   ```
   Two stashes are expected and **MUST NOT** be popped:
   - `stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT governance edits` — owned by the WP-068 / MOVE_LOG_FORMAT resolver session
   - `stash@{1}: On wp-068-preferences-foundation: dirty tree before wp-062 branch cut` — same resolver

4. **EC-069 `<pending — gatekeeper session>` placeholder retained.** Do not backfill the placeholder in `EC_INDEX.md` in any SPEC commit produced by this session. A separate `SPEC:` commit (or the WP-068 stash-pop resolution commit) owns that backfill.

5. **WP-063 BLOCKED evidence understood.** Before drafting WP-080, read:
   - `session-wp063-replay-snapshot-producer.md` §Pre-Session Gates #4
   - `replay.execute.ts` lines 77, 98, 138–178
   - Confirm independently that `MOVE_MAP` and `buildMoveContext` are not exported (no `export` keyword on their declarations) and that `replayGame` has no per-step callback parameter.

6. **WP-079 coordination understood.** WP-079 (Ready, not executed) modifies `replay.execute.ts` JSDoc. WP-080 modifies exports + refactors `replayGame` to route through the new step function. Both touch the same file. The drafted `WP-080 §Dependencies` must list **WP-079 as a hard upstream** — WP-079 lands first (doc-only, minimal merge surface), then WP-080 rebases against it. Do not attempt to parallelize.

7. **Lint gate on the drafted WP-080.** After drafting but **before** committing, run the prompt lint checklist (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`) against WP-080. Every item must pass or be explicitly listed with justification in the commit body. This is mandatory per `.claude/CLAUDE.md §Lint Gate`.

If any gate is unresolved, STOP.

---

## Goal (Binary)

After this session, the repository contains:

1. **`docs/ai/work-packets/WP-080-replay-harness-step-level-api.md`** — new, canonical WP specifying:
   - A new named export `applyReplayStep(gameState, move, numPlayers): LegendaryGameState` (or equivalent step surface — see §Design Questions) from `packages/game-engine/src/replay/replay.execute.ts`
   - Refactor of existing `replayGame` internals to call the new step function in its loop, so there is **one source of truth** for the move dispatch (`MOVE_MAP` + `buildMoveContext`)
   - Addition to the package barrel at `packages/game-engine/src/index.ts` under the WP-027 block
   - One or more `node:test` unit tests asserting: (a) identical inputs → identical output state; (b) `replayGame` final state remains byte-identical to its behavior at the parent commit (regression guard via `computeStateHash`); (c) unknown move names route through the same warning-and-skip path
   - **Status: Ready** once this SPEC commit lands
   - **Dependencies:** WP-027 (harness exists), WP-079 (doc-only JSDoc narrowing; must land first)
   - **Primary Layer:** Game Engine (`packages/game-engine/src/replay/`)
2. **`docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md`** — new, matching the EC-TEMPLATE; status **Draft**. Contains Locked Values (export names, signature shape, refactor preservation rule), Guardrails (purity, no `boardgame.io` import in the step function, no `Date.now`, no `Math.random`), Required `// why:` Comments, and Common Failure Smells.
3. **`docs/ai/DECISIONS.md §D-6304`** — new decision: *"WP-027 replay harness exposes a step-level API; downstream snapshot/replay tools do not duplicate dispatch."* Includes rationale, alternatives considered (duplicate `MOVE_MAP` in consumers — rejected), and references to WP-080 / EC-072 / WP-063.
4. **`docs/ai/work-packets/WORK_INDEX.md`** — updated with one new row for WP-080 in the appropriate section; WP-063 row's dependency list amended to add WP-080.
5. **`docs/ai/execution-checklists/EC_INDEX.md`** — updated with one new row for EC-072 (status Draft).
6. **`docs/ai/invocations/session-wp063-replay-snapshot-producer.md §Pre-Session Gates #4 + §Authority Chain + Preflight references`** — amended to cite WP-080 / EC-072 as the newly-added upstream. The existing "harness exposes a step-level API" language is retained but now points to the exports WP-080 introduces instead of a hypothetical future amendment.
7. **`docs/ai/STATUS.md`** — one-line entry documenting that WP-063 / EC-071 was blocked at Pre-Session Gate #4 on today's date, WP-080 / EC-072 drafted to unblock, and execution will resume in a future session.

No `.ts`, `.tsx`, `.js`, `.mjs`, `.json` (non-docs), `.yaml`, `.cjs` file is modified in this session.

---

## Design Questions (WP-080 Must Resolve Before Draft Is Considered Complete)

The drafting session must take an explicit position on each of these and record the rationale in the WP body. None are load-bearing for governance, but all three are load-bearing for the downstream `EC-072:` execution session.

### Q1. Shape of the exported step surface

Choose one option and justify in WP-080 §Design Decisions:

- **Option A — single named function:**
  ```ts
  export function applyReplayStep(
    gameState: LegendaryGameState,
    move: ReplayMove,
    numPlayers: number,
  ): LegendaryGameState
  ```
  - *Pros:* minimum surface area; matches WP-063's exact need; "one function, one job"
  - *Cons:* passing `numPlayers` as a separate argument is slightly awkward when the consumer has a full `ReplayInput` on hand

- **Option B — context-constructing pair:**
  ```ts
  export function buildReplayMoveContext(
    gameState: LegendaryGameState,
    playerId: string,
    numPlayers: number,
  ): ReplayMoveContext

  export function dispatchReplayMove(
    context: ReplayMoveContext,
    move: ReplayMove,
  ): void
  ```
  - *Pros:* maps cleanly onto the current internal structure; lets advanced consumers compose their own loops
  - *Cons:* doubles the surface; exposes `ReplayMoveContext` which is currently a local structural interface (would need to be exported from `replay.types.ts` or a new `replay.execute.types.ts`)

- **Option C — exposed MOVE_MAP + lightweight helpers:**
  ```ts
  export const REPLAY_MOVE_MAP: Readonly<Record<string, MoveFn>>
  export function buildReplayMoveContext(...): ReplayMoveContext
  ```
  - *Pros:* maximum flexibility; consumers can inspect the dispatch table
  - *Cons:* exposes the most internals; `MoveFn` type leaks; invites ad-hoc extension by third parties

**Recommended default:** Option A. It is the minimum surface that satisfies WP-063's actual need. If Q2 / Q3 surface a reason to prefer B or C, document it.

### Q2. State ownership — in-place mutation vs. clone-return

The current `replayGame` mutates `gameState` in place via boardgame.io Immer draft semantics (except: this execution runs *outside* boardgame.io, so mutations are on a plain JS object, not an Immer draft). The returned `gameState` is the same reference as the input.

Options:
- **Option A — preserve current semantics:** `applyReplayStep` mutates and returns the same reference
- **Option B — clone-return:** `applyReplayStep` deep-clones `gameState`, applies the move to the clone, returns the clone

**Recommended default:** Option A (preserve current semantics). Cloning on every step is expensive and duplicates behavior that WP-063's `buildSnapshotSequence` already handles by calling `buildUIState` (a projection, not a `G` copy) at each step. If a consumer wants clones, they can call a structured-clone themselves.

**Required in WP-080 §Locked Values:** "step function mutates and returns the same `gameState` reference; consumers that need historical snapshots must project via `buildUIState` after each step, not retain `G` references."

### Q3. Refactor scope for `replayGame`

Must WP-080's execution session refactor `replayGame` to call `applyReplayStep` internally?

- **Option A — refactor (recommended):** `replayGame`'s loop becomes `for (const move of input.moves) { gameState = applyReplayStep(gameState, move, numPlayers); }`. Single source of truth for dispatch. Behavior must be byte-identical (regression guard via `computeStateHash` on the committed three-turn sample).
- **Option B — no refactor:** `applyReplayStep` is a pure new export; `replayGame` keeps its private loop. Two copies of dispatch; drift risk.

**Recommended default:** Option A. WP-080 §Acceptance Criteria must include: *"`verifyDeterminism` passes with the identical result hash at the pre-WP-080 commit and the post-WP-080 commit for the existing `replay.verify.test.ts` fixture(s)."* This is the regression guard.

### Q4. Does `ReplayMoveContext` need to be exported?

Only if Q1 = Option B or C. If Q1 = Option A, `ReplayMoveContext` remains a file-local structural interface and is not exported.

### Q5. `ReplayInputsFile` relationship (WP-063 concern, out of scope here)

`WP-063` anticipated reusing a `ReplayInputsFile` shape from WP-027 if one existed. WP-027 defines `ReplayInput` (seed + setupConfig + playerOrder + moves[]), not `ReplayInputsFile`. The drafted WP-080 does **not** introduce `ReplayInputsFile` — that is WP-063's scope. WP-080 §Out of Scope must say so explicitly.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a "minor additive deviation." STOP and re-scope.

### New — drafting deliverables
- `docs/ai/work-packets/WP-080-replay-harness-step-level-api.md` — **new**; full WP per §WP-080 Required Sections below
- `docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md` — **new**; follows `EC-TEMPLATE.md` exactly

### Modified — governance
- `docs/ai/DECISIONS.md` — **modified**; one new `### D-6304` section; update DECISIONS_INDEX if the repo has one (check before writing)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**; add WP-080 row in the appropriate phase (likely "Replay & Observability" or wherever WP-027 / WP-063 / WP-079 live); amend WP-063 dependency cell to add `WP-080`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**; add EC-072 row with status Draft
- `docs/ai/STATUS.md` — **modified**; one-line today-dated entry about the WP-063 block → WP-080 draft
- `docs/ai/invocations/session-wp063-replay-snapshot-producer.md` — **modified**; amend Pre-Session Gates #4 + Authority Chain to cite WP-080 / EC-072 as the newly-added upstream. **Keep existing language intact** — append, do not replace. Add a dated "Amendment 2026-04-18:" block at the top of §Pre-Session Gates #4 referencing WP-080.

### Must remain UNTOUCHED
- Every `.ts` / `.tsx` / `.js` / `.mjs` / `.cjs` file under `packages/**` and `apps/**`
- Every `.json` file under `packages/**`, `apps/**`, `content/**`
- `.claude/settings.local.json`, `.claude/rules/*.md`, `.claude/CLAUDE.md`
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json`, `tsconfig*.json`
- `docs/ai/ARCHITECTURE.md` (read-only in this session)
- `docs/ai/REFERENCE/*.md` (read-only)
- `docs/ai/MOVE_LOG_FORMAT.md` (untracked, left alone)
- `docs/ai/work-packets/WP-063-*.md` — **untouched**; amendments live in the session prompt, not the WP body (WP amendments require their own SPEC commit with a clear trail)
- `docs/ai/work-packets/WP-079-*.md` — **untouched**; coordination is expressed in WP-080 §Dependencies, not by editing WP-079
- `docs/ai/execution-checklists/EC-071-*.checklist.md` — **untouched**; EC-071 remains Draft until WP-063 actually executes
- Every stash (`stash@{0}`, `stash@{1}`) — **not popped**
- EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` — **not backfilled**

---

## WP-080 Required Sections (Author Must Fill Each)

Model on `WP-079-label-replay-harness-determinism-only.md` structure. The drafted WP must contain:

1. **Header block** — title, Status, Primary Layer, Dependencies (WP-027, WP-079, D-6304)
2. **Session Context** — two to four paragraphs explaining why the step-level API is needed (cite WP-063 Pre-Session Gate #4 block); explicit D-0201 and D-0205 cross-references; note that this WP does NOT change live-match RNG semantics (D-0205 remains in force)
3. **Goal** — binary list of outputs after execution
4. **Assumes** — WP-027 complete, WP-079 complete (JSDoc narrowing lands first), repo baseline green, tests passing
5. **Context (Read First)** — file list similar to WP-079's, including WP-063 session prompt, D-0205, ARCHITECTURE §Layer Boundary
6. **Non-Negotiable Constraints** — engine-wide (same as WP-079) plus packet-specific:
   - *Additive exports only* — no change to existing signatures of `replayGame` / `verifyDeterminism` / `computeStateHash`
   - *Regression guard* — `verifyDeterminism` and the existing replay tests must still pass byte-identically
   - *Step function purity* — no `console.*`, no `Date.now`, no `Math.random`, no `performance.now`, no I/O
   - *No `boardgame.io` import inside the new step function* (the existing file already avoids this per WP-027's contract; preserve it)
   - *Barrel pattern discipline* — new exports appear exactly under the WP-027 block in `index.ts`, no reformatting of surrounding lines
7. **Design Decisions** — the author's resolution of Q1–Q5 above, each with a one-paragraph rationale
8. **Scope (In)** — enumerate every file modification, by section (e.g., "A) `replay.execute.ts` — add `applyReplayStep` export, refactor `replayGame` loop to call it"; "B) `index.ts` — add three new export lines under WP-027 block"; "C) `replay.execute.test.ts` — new tests")
9. **Out of Scope** — explicit enumeration; must include `ReplayInputsFile` shape (WP-063's concern), RNG changes (D-0205 gate), consumer-side changes in `apps/**`, any boardgame.io version bump
10. **Files Expected to Change** — exact paths, marked new / modified / untouched
11. **Acceptance Criteria** — binary pass/fail; must include:
    - [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
    - [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
    - [ ] Test count is strictly greater than baseline (new tests added)
    - [ ] `computeStateHash` on the existing determinism test fixture is byte-identical pre- and post-execution (regression guard)
    - [ ] New exports present in `packages/game-engine/src/index.ts` under the WP-027 block
    - [ ] `packages/game-engine/src/replay/replay.execute.ts` contains exactly one definition of `MOVE_MAP` (either file-local or exported, not duplicated)
    - [ ] `replayGame` internal loop calls the new step function (if Q3 = Option A)
    - [ ] `git diff --name-only packages/game-engine/src/replay/` shows only `replay.execute.ts` and any new test file; no other files under the replay directory changed
    - [ ] No file touched outside §Files Expected to Change
12. **Verification Steps** — `pwsh` commands similar to WP-079's, including:
    - `Select-String` to confirm the new exports exist
    - `Select-String` to confirm `MOVE_MAP` is declared exactly once
    - `git diff` to confirm `replayGame`'s signature line is unchanged
    - `pnpm --filter @legendary-arena/game-engine test` to confirm regression
13. **Definition of Done** — mirror Acceptance Criteria plus governance-index updates + post-mortem requirement
14. **Post-Mortem trigger** — per 01.6 §When Post-Mortem Is Required: WP-080 is a refactor with a public API addition; likely triggers "new long-lived abstraction" (the step-level API becomes the canonical dispatch surface for downstream consumers). **Mandatory per P6-35**, formal 10-section output, before commit.

---

## EC-072 Required Sections (Use EC-TEMPLATE Verbatim)

Follow `docs/ai/execution-checklists/EC-TEMPLATE.md` structure without deviation. Required content:

### Before Starting
- [ ] WP-027 complete (harness exists and `replayGame` exports unchanged)
- [ ] WP-079 complete (JSDoc narrowing already landed; preserves forbidden-phrase constraints per D-0205)
- [ ] Repo baseline green: `pnpm -r test` exits 0
- [ ] `stash@{0}` retained — MUST NOT pop
- [ ] EC-069 `<pending>` placeholder in EC_INDEX.md MUST NOT be backfilled in the EC-072 commit
- [ ] Design Q1–Q3 resolutions locked in WP-080 body (no re-litigation at execution time)

### Locked Values
- EC / commit prefix: `EC-072:` on every code-changing commit; `SPEC:` on governance-only commits; `WP-080:` forbidden (P6-36)
- Step function export name and signature: verbatim from WP-080 §Design Decisions (Q1)
- State-ownership contract: mutate-and-return-same-reference (Q2)
- `replayGame` refactor discipline: loop body becomes a single call to the new step function (Q3 = A); behavior byte-identical under `computeStateHash` regression (Q3 Acceptance Criterion)
- Barrel pattern: new exports appear under the existing WP-027 block (approx `packages/game-engine/src/index.ts:206–211`), one line per export, no reformatting of surrounding lines
- Test file: `packages/game-engine/src/replay/replay.execute.test.ts` (new) OR extend existing `replay.verify.test.ts` with new cases; author decides in WP-080 §Scope (In)

### Guardrails
- No change to `replayGame` signature or return type
- No change to `verifyDeterminism`, `computeStateHash`, `ReplayInput`, `ReplayMove`, or `ReplayResult` — all WP-027 contract surfaces are frozen
- No `.reduce()` in the refactored loop
- No `boardgame.io` import added to any file under `packages/game-engine/src/replay/`
- No `Math.random` / `Date.now` / `performance.now` / `console.*` / `fs` / `node:fs*` in the step function
- No modification to `packages/game-engine/src/index.ts` outside adding lines under the WP-027 block
- Scope lock is binary (P6-27)

### Required `// why:` Comments
- On the step function's JSDoc: cite D-6304 and the motivation (unblock WP-063 snapshot producer; single dispatch source of truth)
- On the `replayGame` loop (if Q3 = A): one-line `// why:` noting the loop now delegates to `applyReplayStep`; determinism regression covered by the existing `verifyDeterminism` test
- Any `// why:` already present on the reverse-shuffle lines (118–124 today) is preserved; WP-079's D-0205 cross-reference (if landed) is preserved verbatim

### Files to Produce
- `packages/game-engine/src/replay/replay.execute.ts` — **modified**
- `packages/game-engine/src/index.ts` — **modified** (one to three new export lines under WP-027 block)
- `packages/game-engine/src/replay/replay.execute.test.ts` — **new** (or extend existing test file)
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — governance updates per DoD

### After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r test` exits 0; repo-wide count strictly greater than the pre-EC-072 baseline
- [ ] Regression guard: `computeStateHash` on the existing determinism fixture is byte-identical
- [ ] `git diff --name-only` shows only files listed in §Files to Produce plus governance files
- [ ] EC-072 flipped from Draft to Done in EC_INDEX.md with `Executed YYYY-MM-DD at commit <hash>`
- [ ] 01.6 post-mortem complete (formal 10-section output, in-session, before commit) — triggered by "new long-lived abstraction"

### Common Failure Smells
- `verifyDeterminism` starts failing with a different hash → refactor changed observable behavior; revert and re-check the mutation / cloning contract
- `pnpm -r test` test count decreases → a test was accidentally removed or moved; restore it
- Two `MOVE_MAP` constants show up in `replay.execute.ts` → the refactor left the old copy in place; collapse to one
- `replay.execute.ts` now imports `boardgame.io` → purity violation; the current file does not import it and must not start
- `index.ts` shows spurious reformatting in `git diff` → editor auto-formatted on save; undo all changes outside the WP-027 block

---

## D-6304 Body (Author Must Write)

Format mirrors existing D-entries in `DECISIONS.md` (e.g., D-6301, D-6302, D-6303). Required content:

- **ID + Title:** `### D-6304 — WP-027 Replay Harness Exposes a Step-Level API for Downstream Snapshot / Replay Tools`
- **Status:** Active
- **Date:** (today, 2026-04-18 or session date)
- **Decision:** a single imperative paragraph: *"The engine's replay harness (`packages/game-engine/src/replay/replay.execute.ts`) exposes a named step-level API — `applyReplayStep` (or equivalent per WP-080 §Design Decisions) — that downstream consumers (`buildSnapshotSequence`, future replay inspectors, debug tools) call to apply one `ReplayMove` at a time. The harness's internal move dispatch (`MOVE_MAP`) remains the single source of truth; `replayGame` is refactored to call the step function in its loop."*
- **Rationale:** two to four sentences. Cite WP-063 Pre-Session Gate #4 block evidence; name the alternative considered (duplicate `MOVE_MAP` in each consumer) and why it was rejected (drift risk; tests pass locally but new moves silently diverge).
- **Alternatives Considered:**
  - *Option A — status quo (rejected):* consumers duplicate `MOVE_MAP` + `buildMoveContext`. Drift risk.
  - *Option B — expose MOVE_MAP directly (rejected):* leaks internal `MoveFn` type; invites ad-hoc extension. Rejected per Q1 analysis.
  - *Option C — named step function (accepted):* minimum surface area; matches WP-063's need exactly; one function one job.
- **Scope:**
  - Does not change live-match RNG semantics (D-0205 still in force — the step function inherits the reverse-shuffle determinism-only semantics)
  - Does not add a new decision about `ReplayInputsFile` (WP-063 concern)
  - Does not bump `boardgame.io`
- **Follow-up actions required by this decision:**
  - Execute WP-080 / EC-072 to add the step-level export
  - Resume WP-063 / EC-071 execution (existing session prompt) once WP-080 lands
- **References:** WP-027, WP-063, WP-079, WP-080, EC-071, EC-072, session-wp063 Pre-Session Gate #4, D-0201, D-0205

---

## WORK_INDEX.md Update Format

Add a new row for WP-080 in the same phase as WP-027 / WP-063 / WP-079 (likely "Replay & Observability" or "Engine Quality"). Row format mirrors existing rows:

| WP | Title | Dependencies | Status | Reviewed |
|----|-------|-------------|--------|----------|
| WP-080 | Replay harness step-level API for downstream snapshot / replay tools | WP-027, WP-079, D-6304 | [ ] Ready | ✅ Reviewed *(on SPEC commit land)* |

Also amend the WP-063 row: change the "Dependencies" cell to add `WP-080`.

**Do not** mark WP-080 as `BLOCKED`; it has no blocker once drafted. Do not change WP-063's status — it remains whatever it was (likely `[ ] Ready` modulo the pre-session gate that WP-080 will satisfy).

---

## EC_INDEX.md Update Format

Add a new row for EC-072 (status Draft). Row format mirrors the existing EC-071 row (see `EC_INDEX.md` for the pattern). Reference the new checklist file and cross-reference WP-080 and D-6304.

---

## WP-063 Session Prompt Amendment

Edit `docs/ai/invocations/session-wp063-replay-snapshot-producer.md` in place. Rules:

- **Do not delete any existing text.** All amendments are additive.
- **Amendment location 1 — §Pre-Session Gates #4.** Above the existing gate body, insert a dated amendment block:
  ```
  > **Amendment 2026-04-18 (SPEC):** WP-080 / EC-072 drafted to add
  > `applyReplayStep` (or equivalent) to `replay.execute.ts`. Gate #4
  > is satisfied when WP-080 has been executed and its exports are
  > visible in `packages/game-engine/src/index.ts`. Until WP-080
  > executes, this gate remains BLOCKED. See:
  > - docs/ai/work-packets/WP-080-replay-harness-step-level-api.md
  > - docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md
  > - docs/ai/DECISIONS.md §D-6304
  ```
- **Amendment location 2 — §Authority Chain.** Add entries for WP-080, EC-072, and D-6304 in reading order.
- **Amendment location 3 — §Pre-Session Gates header.** Add a sentence: *"Gate #4 was amended on 2026-04-18 to reference WP-080 / EC-072."*

Preserve the rest of the document verbatim. Do not re-order existing list items.

---

## STATUS.md Update Format

One-line entry, today-dated, in the same style as existing STATUS.md entries:

```
- 2026-04-18 — WP-063 / EC-071 blocked at Pre-Session Gate #4 (WP-027
  harness is end-to-end only). Drafted WP-080 / EC-072 / D-6304 to add
  a step-level API (`applyReplayStep`). WP-063 execution resumes after
  WP-080 lands.
```

---

## Order of Execution (Read Carefully)

1. **This session (now)** — drafts WP-080, EC-072, D-6304, governance index updates, WP-063 preflight amendment. Commits under `SPEC:`.
2. **WP-079 execution session (if not yet done)** — doc-only JSDoc change to `replay.execute.ts` and `replay.verify.ts`. Commits under whatever EC prefix WP-079's checklist names (check `EC_INDEX.md` after this session lands to see if WP-079 has an EC yet; if not, WP-079 may need its own EC drafted first).
3. **WP-080 execution session** — implements the step-level API per EC-072. Commits under `EC-072:`. Runs post-mortem before commit (new long-lived abstraction trigger).
4. **WP-063 execution session (resume)** — re-opens `session-wp063-replay-snapshot-producer.md`. Pre-Session Gate #4 now passes. Proceeds with EC-071 execution as originally spec'd.

If WP-079 has not yet been drafted as an EC, the drafting session for that EC is prerequisite to step 2. Check `EC_INDEX.md` in this session and note the ordering clearly in WP-080 §Dependencies.

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — confirm governance base commit present
git log --oneline -10 | Select-String "eb19264"
# Expected: one match

# Step 2 — confirm stashes retained
git stash list
# Expected: stash@{0} (WP-068/MOVE_LOG) + stash@{1} both present

# Step 3 — confirm WP-063 preflight gate #4 is still unsatisfied at the source file
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" -Pattern "^export (function|const) (applyReplayStep|REPLAY_MOVE_MAP|buildReplayMoveContext|dispatchReplayMove)"
# Expected: no output (these exports do NOT exist yet; this session does not create them)

# Step 4 — confirm new docs exist
Test-Path "docs\ai\work-packets\WP-080-replay-harness-step-level-api.md"
Test-Path "docs\ai\execution-checklists\EC-072-replay-harness-step-level-api.checklist.md"
# Expected: True, True

# Step 5 — confirm D-6304 exists in DECISIONS.md
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "^### D-6304"
# Expected: one match

# Step 6 — confirm WORK_INDEX.md has WP-080 row and WP-063 dependency updated
Select-String -Path "docs\ai\work-packets\WORK_INDEX.md" -Pattern "WP-080"
Select-String -Path "docs\ai\work-packets\WORK_INDEX.md" -Pattern "\|\s*WP-063.*WP-080"
# Expected: >= 1 match each

# Step 7 — confirm EC_INDEX.md has EC-072 row
Select-String -Path "docs\ai\execution-checklists\EC_INDEX.md" -Pattern "EC-072"
# Expected: >= 1 match

# Step 8 — confirm WP-063 session prompt amendment present
Select-String -Path "docs\ai\invocations\session-wp063-replay-snapshot-producer.md" -Pattern "Amendment 2026-04-18"
Select-String -Path "docs\ai\invocations\session-wp063-replay-snapshot-producer.md" -Pattern "WP-080"
# Expected: >= 1 match each

# Step 9 — confirm STATUS.md entry present
Select-String -Path "docs\ai\STATUS.md" -Pattern "WP-080"
# Expected: >= 1 match

# Step 10 — confirm NO source code changes
git diff --name-only | Select-String -Pattern "\.(ts|tsx|js|mjs|cjs|yaml|yml)$"
git diff --name-only | Select-String -Pattern "^packages/"
git diff --name-only | Select-String -Pattern "^apps/"
# Expected: NO output for all three (this session changes only .md files under docs/)

# Step 11 — confirm diff scope is exactly the expected files
git diff --name-only
# Expected (exactly, no others):
#   docs/ai/DECISIONS.md
#   docs/ai/STATUS.md
#   docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md  (new)
#   docs/ai/execution-checklists/EC_INDEX.md
#   docs/ai/invocations/session-wp063-replay-snapshot-producer.md
#   docs/ai/invocations/session-wp080-replay-harness-step-level-api.md              (new — this file, untracked then committed)
#   docs/ai/work-packets/WORK_INDEX.md
#   docs/ai/work-packets/WP-080-replay-harness-step-level-api.md                    (new)

# Step 12 — confirm lint gate passes on the drafted WP-080
# (manual: open docs/ai/REFERENCE/00.3-prompt-lint-checklist.md and tick every applicable item against WP-080.
#  Any unmet item must be explicitly listed + justified in the commit body.)

# Step 13 — confirm stashes untouched
git stash list
# Expected: same as Step 2 — two stashes present, unchanged
```

---

## Definition of Done

- [ ] All Pre-Session Gates resolved before drafting began
- [ ] `docs/ai/work-packets/WP-080-replay-harness-step-level-api.md` created and contains every section listed in §WP-080 Required Sections
- [ ] `docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md` created and matches `EC-TEMPLATE.md` structure
- [ ] `docs/ai/DECISIONS.md` contains a new `### D-6304` section per §D-6304 Body
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated: new WP-080 row; WP-063 dependency cell amended
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` updated: new EC-072 row with status Draft
- [ ] `docs/ai/STATUS.md` updated: one-line today-dated entry
- [ ] `docs/ai/invocations/session-wp063-replay-snapshot-producer.md` amended at Pre-Session Gates #4 and Authority Chain (additive only, no deletions)
- [ ] Prompt lint gate (00.3) run against WP-080; results reflected in the commit body
- [ ] Verification Steps 1–13 all pass
- [ ] No `.ts` / `.tsx` / `.js` / `.mjs` / `.cjs` / `.json` (non-docs) / `.yaml` / `.cjs` file modified
- [ ] `stash@{0}` and `stash@{1}` retained (not popped)
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in EC_INDEX.md **not** backfilled in this session's commits
- [ ] No 01.6 post-mortem required for this session itself (SPEC drafting does not trigger 01.6; the downstream WP-080 execution session will trigger it)
- [ ] Commits use `SPEC:` prefix exclusively (1–3 commits total; suggested breakdown below)

---

## Suggested Commit Breakdown

Each commit uses `SPEC:` prefix. If the commit-msg hook rejects anything, do not `--no-verify` — fix the message and re-commit.

**Option A — one commit (default):**
```
SPEC: WP-080 + EC-072 + D-6304 drafts to unblock WP-063 replay snapshot producer

- Adds WP-080 (Replay harness step-level API) as a new Game Engine WP
  dependent on WP-027 + WP-079.
- Adds EC-072 draft (Draft status) specifying the additive export
  refactor: applyReplayStep named export + replayGame loop refactor
  to route through it; regression guard via computeStateHash.
- Adds D-6304 capturing the "single source of truth for dispatch"
  decision and the rejected alternative (duplicate MOVE_MAP in every
  consumer).
- Amends WP-063 session prompt Pre-Session Gates #4 to cite WP-080 /
  EC-072 as the upstream amendment.
- Updates WORK_INDEX.md (WP-080 row; WP-063 dependency cell),
  EC_INDEX.md (EC-072 row), STATUS.md (today-dated block entry).

No source code changes. All stashes retained. EC-069 placeholder
untouched. Lint gate (00.3) passes on WP-080 — see items 1–14 in the
commit body trailer.
```

**Option B — three commits (acceptable if the user prefers granular trail):**
1. `SPEC: draft WP-080 replay harness step-level API + EC-072 checklist`
2. `SPEC: add D-6304 (single source of truth for replay dispatch) + governance index updates`
3. `SPEC: amend WP-063 session prompt Pre-Session Gates #4 to cite WP-080`

Default to Option A unless the user asks for granularity up front.

---

## Out of Scope (Explicit)

- No modification to `packages/game-engine/src/replay/*.ts` — those are WP-080 / EC-072 execution scope
- No modification to `packages/game-engine/src/index.ts` — same
- No new source files anywhere under `packages/` or `apps/`
- No execution of WP-079 — if WP-079 is not yet drafted as an EC, that drafting is a **separate** SPEC session (note this in WP-080 §Dependencies with a `BLOCKED-PENDING-WP-079-EC` marker if true)
- No execution of WP-080 — this session drafts only
- No execution of WP-063 / EC-071 — still BLOCKED at Pre-Session Gate #4 until WP-080 lands
- No changes to `boardgame.io` version
- No RNG / live-match seed semantics — D-0205 remains in force unchanged
- No post-mortem for this session (SPEC drafting does not trigger 01.6; WP-080 execution will)
- No backfill of EC-069 `<pending — gatekeeper session>` placeholder
- No stash pops

---

## Final Instruction

Execute exactly this scope. No source code changes. No scope expansion. If any task below cannot be completed cleanly:

- **Design questions Q1–Q5 unresolvable from the reading list alone** → use `AskUserQuestion` with named options; do not guess.
- **Lint gate fails on the drafted WP-080** → fix the WP or list the unmet items in the commit body with explicit justification.
- **Any `.ts` edit proposed mid-session** → STOP, escalate via `AskUserQuestion`. The SPEC commit scope is docs-only.

When finished: run Verification Steps 1–13 in order, commit under `SPEC:`, and hand off. The next session in the chain is WP-080's EC-072 execution (different prompt, different session).
