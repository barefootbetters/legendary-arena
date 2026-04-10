# Work Packet Invocation — WP-007B (Turn Loop Implementation)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-007B`
**Work Packet Title:** Turn Loop Implementation
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-10
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-007B** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section: The Turn Stage Cycle (line ~575)
   - Section: Phase Sequence and Lifecycle Mapping
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - Turn Stage Cycle rules
   - Move Validation Contract
   - G serialization invariants

4. `.claude/rules/code-style.md`
   - `// why:` comment requirements (Rule 6)
   - No `.reduce()` (Rule 8)
   - ESM only (Rule 13)

5. `docs/ai/execution-checklists/EC-007B-turn-loop.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-007B-turn-loop-implementation.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/game.ts` — primary modification target; read entirely
   before modifying
8. `packages/game-engine/src/types.ts` — will be modified (add `currentStage`)
9. `packages/game-engine/src/index.ts` — will be modified (export `advanceTurnStage`)
10. `packages/game-engine/src/turn/turnPhases.logic.ts` — WP-007A helpers; use
    `getNextTurnStage` and `isValidTurnStageTransition`; do NOT modify
11. `packages/game-engine/src/turn/turnPhases.types.ts` — `TurnStage` and
    `TURN_STAGES`; use these constants; do NOT modify
12. `packages/game-engine/src/test/mockCtx.ts` — test helper; do NOT modify
13. `docs/ai/REFERENCE/00.2-data-requirements.md` section 8.2 — lifecycle mapping

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-10)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-007A complete (2026-04-10) — all exports present and tested
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 63/63 passing, 0 failing (includes WP-007A drift-detection tests)
- All required types/contracts exist at expected paths

### Risks Identified and Mitigations

1. **`makeMockCtx` shape mismatch** — The current `makeMockCtx` returns a
   `SetupContext` with `{ ctx: { numPlayers }, random: { Shuffle } }`. The
   integration test for `advanceTurnStage` needs a mock with
   `events: { endTurn: <spy> }`. **Mitigation:** Build a minimal inline mock
   in the test file that satisfies the `advanceTurnStage` function signature.
   Do NOT modify `makeMockCtx` (it is a locked file). The WP says "uses
   `makeMockCtx`" — interpret this as "uses the mock-context pattern from
   `mockCtx.ts`" since the existing helper cannot provide `events`.

2. **`onBegin` hook signature (boardgame.io 0.50.x)** — Phase and turn hooks
   in 0.50.x receive `({ G, ctx, events })` and mutate `G` directly via Immer.
   They do NOT return a new `G` object. The `play` phase `turn.onBegin` hook
   must mutate `G.currentStage` in place, not return a replacement state.

3. **No hardcoded `'start'` in `onBegin`** — The EC guardrail forbids hardcoded
   stage strings. When resetting `G.currentStage` in `onBegin`, use
   `TURN_STAGES[0]` (imported from `turnPhases.types.ts`) rather than the
   literal `'start'`.

4. **`advanceStage` move vs existing `endTurn` stub** — WP-007B adds a new
   `advanceStage` move. The existing `endTurn` and `playCard` stub moves must
   remain unchanged. Do not conflate `advanceStage` with the `endTurn` stub.

---

## Critical Context (Post-WP-007A Reality)

- WP-007A is complete. The following are exported from `@legendary-arena/game-engine`:
  - Types: `MatchPhase`, `TurnStage`, `TurnPhaseError`
  - Arrays: `MATCH_PHASES`, `TURN_STAGES`
  - Functions: `getNextTurnStage`, `isValidTurnStageTransition`,
    `isValidMatchPhase`, `isValidTurnStage`, `validateTurnStageTransition`
- `LegendaryGameState` does NOT yet have `currentStage` — this packet adds it.
- `game.ts` has 4 phases scaffolded (`lobby`, `setup`, `play`, `end`) with
  `next` fields but no `onBegin` hooks and no `advanceStage` move.
- `makeMockCtx` in `src/test/mockCtx.ts` provides a `SetupContext` with
  deterministic `Shuffle` (reverses arrays). The integration test for WP-007B
  needs a different mock shape — see Pre-Flight Findings risk #1 above.
- `game.ts` already imports `boardgame.io` types — this is expected and correct
  for the Game object file. New files (`turnLoop.ts`, test file) must NOT import
  boardgame.io.
- `advanceTurnStage` in `turnLoop.ts` must define a minimal context interface
  locally (e.g., `TurnContext`) to avoid importing `boardgame.io` — this follows
  the same pattern as `SetupContext` in `types.ts`.

---

## Scope Contract (Read Carefully)

### WP-007B DOES:

- Add `currentStage: TurnStage` to `LegendaryGameState` in `src/types.ts`
- Create `src/turn/turnLoop.ts` with `advanceTurnStage(G, ctx)` function
- Wire the `play` phase in `game.ts`:
  - Add `turn.onBegin` hook that resets `G.currentStage` to the first stage
  - Add `advanceStage` move that calls `advanceTurnStage`
- Export `advanceTurnStage` from `src/index.ts`
- Create `src/turn/turnLoop.integration.test.ts` with 4 assertions
- Add required `// why:` comments on `ctx.events.endTurn()`, `G.currentStage`
  storage location, and `play` phase `onBegin` reset

### WP-007B DOES NOT:

- No gameplay moves (playCard, recruit, fight) — WP-008A/B
- No stage gating logic — WP-008A
- No win/loss conditions or endgame — WP-010
- No scheme twist or mastermind strike logic — WP-009A/B
- No city, HQ, or villain deck logic — WP-014/015
- No persistence, PostgreSQL, or server changes
- No UI changes
- No modification of WP-007A contract files
- No modification of WP-006A/B files
- No boardgame.io imports in `turnLoop.ts` or the test file
- No hardcoded stage string literals in `turnLoop.ts` or `game.ts`
- No `.reduce()` in stage logic
- No speculative helpers or convenience abstractions

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/turn/turnLoop.ts              — new
    packages/game-engine/src/turn/turnLoop.integration.test.ts — new
    packages/game-engine/src/types.ts                       — modified
    packages/game-engine/src/game.ts                        — modified
    packages/game-engine/src/index.ts                       — modified

Any modification outside this list is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/turn/turnPhases.types.ts       — WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts       — WP-007A contract
    packages/game-engine/src/turn/turnPhases.validate.ts    — WP-007A contract
    packages/game-engine/src/turn/turnPhases.contracts.test.ts — WP-007A tests
    packages/game-engine/src/test/mockCtx.ts                — shared test helper
    packages/game-engine/src/state/zones.types.ts           — WP-006A contract
    packages/game-engine/src/state/zones.validate.ts        — WP-006A contract
    packages/game-engine/src/setup/playerInit.ts            — WP-006B
    packages/game-engine/src/setup/pilesInit.ts             — WP-006B

These are dependencies, not execution targets.

---

## Locked Values (Do Not Re-Derive)

### TurnStage values (use constants, never hardcode)

`'start'` | `'main'` | `'cleanup'`

Valid transitions: `start -> main`, `main -> cleanup`.
`getNextTurnStage('cleanup')` returns `null` -> call `ctx.events.endTurn()`.

### Phase names

`'lobby'` | `'setup'` | `'play'` | `'end'`

### play phase onBegin

Resets `G.currentStage` to first stage on each new turn.

### Required // why: comments

- `advanceTurnStage`: why `ctx.events.endTurn()` is correct — boardgame.io
  manages player rotation; manual index rotation is forbidden
- `advanceTurnStage`: why `currentStage` is stored in `G` not `ctx` — `ctx`
  does not expose inner stage in a form moves can read; `G` makes it observable
  for stage gating and JSON-serializable for replay
- `game.ts` play phase `onBegin`: resetting stage to first value each turn

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-007B`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `advanceTurnStage` must call `getNextTurnStage` from WP-007A — no duplicated
  stage ordering anywhere
- `G.currentStage` stored in `G`, never in `ctx`
- `ctx.events.endTurn()` for player rotation — manual index rotation forbidden
- All stage references in `turnLoop.ts` and `game.ts` use constants from
  `turnPhases.types.ts` — no bare string literals for stage names
- Validators and helpers must not throw — return structured results or void
- `G` must remain JSON-serializable after adding `currentStage`
- ESM only, `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension

---

## EC-Mode Execution Rules

- All code changes must map to **EC-007B**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-007B execution:

- All EC-007B checklist items must pass
- All tests must pass (including WP-007A contract tests)
- No forbidden files modified
- `advanceTurnStage` exported and functional
- `G.currentStage` present in `LegendaryGameState`
- `play` phase wired with `onBegin` and `advanceStage` move
- Integration test confirms all three stage transitions
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, 0 failing

# Step 3 — no hardcoded stage strings in turnLoop.ts
grep -E "'start'|'main'|'cleanup'" packages/game-engine/src/turn/turnLoop.ts
# Expected: no output

# Step 4 — no hardcoded stage strings in game.ts
grep -E "'start'|'main'|'cleanup'" packages/game-engine/src/game.ts
# Expected: no output

# Step 5 — no boardgame.io import in integration test
grep "boardgame.io" packages/game-engine/src/turn/turnLoop.integration.test.ts
# Expected: no output

# Step 6 — no boardgame.io import in turnLoop.ts
grep "boardgame.io" packages/game-engine/src/turn/turnLoop.ts
# Expected: no output

# Step 7 — WP-007A contract files unchanged
git diff --name-only packages/game-engine/src/turn/turnPhases.types.ts packages/game-engine/src/turn/turnPhases.logic.ts packages/game-engine/src/turn/turnPhases.validate.ts
# Expected: no output

# Step 8 — only expected files changed
git diff --name-only
# Expected: only files listed in Files Allowed to Change
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — the turn loop is now wired; what a running match can do
  - `docs/ai/DECISIONS.md` — why `currentStage` in `G` not `ctx`; why direct
    function calls not `boardgame.io/testing`
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-007B complete with date
- Commit using EC-mode hygiene rules (`EC-007B:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-007B:

**DO NOT IMPLEMENT IT.**
