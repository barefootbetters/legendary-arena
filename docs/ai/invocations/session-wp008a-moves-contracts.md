# Work Packet Invocation — WP-008A (Core Moves Contracts)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-008A`
**Work Packet Title:** Core Moves Contracts (Draw, Play, End Turn)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-10
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-008A** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-008A defines *what moves exist and when they are allowed* —
not *what they do*. All behavioral effects of moves (mutation,
card resolution, costs, effects) are strictly out of scope
for this packet.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section: The Move Validation Contract
   - Section: Zone Mutation Rules
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - Move Validation Contract
   - G serialization invariants
   - Pure helper rules (no boardgame.io imports)

4. `.claude/rules/code-style.md`
   - `// why:` comment requirements (Rule 6)
   - No `.reduce()` (Rule 8)
   - No abbreviations (Rule 4)
   - Full-sentence error messages (Rule 11)
   - ESM only (Rule 13)

5. `docs/ai/execution-checklists/EC-008A-moves-contracts.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-008A-core-moves-contracts.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/state/zones.types.ts` — `CardExtId` type; import
   this for `PlayCardArgs.cardId`; do NOT modify
8. `packages/game-engine/src/turn/turnPhases.types.ts` — `TurnStage` and
   `TURN_STAGES`; use for stage gating; do NOT modify
9. `packages/game-engine/src/turn/turnPhases.logic.ts` — `isValidTurnStage`;
   use in `validateMoveAllowedInStage`; do NOT modify
10. `packages/game-engine/src/types.ts` — will be modified (re-export move contracts)
11. `packages/game-engine/src/index.ts` — will be modified (export new public API)
12. `docs/ai/REFERENCE/00.2-data-requirements.md` section 8.2 — runtime state
    boundaries: move payloads reference stable `ext_id` strings
13. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-10)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-005B complete (2026-04-10) — `makeMockCtx` confirmed in `src/test/mockCtx.ts`
- WP-006A complete (2026-04-10) — `CardExtId`, `PlayerZones` confirmed in `zones.types.ts`
- WP-007A complete (2026-04-10) — `TurnStage`, `TURN_STAGES` confirmed in `turnPhases.types.ts`
- WP-007B complete (2026-04-10) — `advanceStage` wired in `play` phase in `game.ts`
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 67/67 passing, 0 failing

### Risks Identified and Mitigations

1. **`src/moves/` directory does not exist** — Must be created. Straightforward;
   no risk.

2. **`validateMoveAllowedInStage` needs `isValidTurnStage`** — The WP specifies
   using this helper from `turnPhases.logic.ts` to confirm the stage argument is
   a known stage before checking the gating map. Confirmed it exists and is
   exported.

3. **No boardgame.io imports in new files** — All three new source files
   (`coreMoves.types.ts`, `coreMoves.gating.ts`, `coreMoves.validate.ts`) are
   pure helpers. They must NOT import `boardgame.io`. The EC explicitly checks
   this for `coreMoves.gating.ts`.

---

## Critical Context (Post-WP-007B Reality)

- WP-007B is complete. The following are present in `@legendary-arena/game-engine`:
  - `LegendaryGameState.currentStage: TurnStage` — exists in `G`
  - `advanceTurnStage` — exported, functional, tested
  - `play` phase wired with `turn.onBegin` and `advanceStage` move
- `TurnStage = 'start' | 'main' | 'cleanup'` — from `turnPhases.types.ts`
- `TURN_STAGES = ['start', 'main', 'cleanup'] as const` — from `turnPhases.types.ts`
- `CardExtId = string` (branded type alias) — from `zones.types.ts`
- `isValidTurnStage(stage: unknown): stage is TurnStage` — from `turnPhases.logic.ts`
- No `src/moves/` directory exists yet — this packet creates it
- `MoveResult` and `MoveError` do not exist yet — this packet defines them as the
  engine-wide contract; no future packet may redefine or shadow these types

---

## Scope Contract (Read Carefully)

### WP-008A DOES:

- Create `src/moves/coreMoves.types.ts` — `CoreMoveName`, `CORE_MOVE_NAMES`,
  `DrawCardsArgs`, `PlayCardArgs`, `EndTurnArgs`, `MoveError`, `MoveResult`
- Create `src/moves/coreMoves.gating.ts` — `MOVE_ALLOWED_STAGES`,
  `isMoveAllowedInStage`
- Create `src/moves/coreMoves.validate.ts` — four pure validators:
  `validateDrawCardsArgs`, `validatePlayCardArgs`, `validateEndTurnArgs`,
  `validateMoveAllowedInStage`

Validators in this WP:
- Inspect inputs only
- Perform no mutation
- Perform no normalization
- Perform no defaulting or coercion
- Return structured MoveResult values only
- Create `src/moves/coreMoves.contracts.test.ts` — 9 tests including drift-detection
- Modify `src/types.ts` — re-export `MoveResult`, `MoveError`, `CoreMoveName`
- Modify `src/index.ts` — export all new public types and functions
- Add required `// why:` comments on `MoveResult`/`MoveError` (engine-wide
  contract), each `MOVE_ALLOWED_STAGES` assignment, and drift test

### WP-008A DOES NOT:

- No move implementations that mutate `G` — WP-008B
- No shuffling or randomness
- No card rules (costs, attack, recruit, keywords)
- No database or network access
- No UI or server changes
- No modification of WP-007A/B contract files
- No modification of WP-006A/B files
- No `throw` in any validator
- No `boardgame.io` imports in any new file
- No `.reduce()` in validation or gating logic
- No hardcoded stage strings outside `MOVE_ALLOWED_STAGES` definition
- No speculative helpers, convenience abstractions, or "while I'm here" improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/moves/coreMoves.types.ts          — new
    packages/game-engine/src/moves/coreMoves.gating.ts         — new
    packages/game-engine/src/moves/coreMoves.validate.ts       — new
    packages/game-engine/src/moves/coreMoves.contracts.test.ts — new
    packages/game-engine/src/types.ts                           — modified
    packages/game-engine/src/index.ts                           — modified

Any modification outside this list must satisfy the Runtime Wiring Allowance
below, or it is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/turn/turnPhases.types.ts          — WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts          — WP-007A contract
    packages/game-engine/src/turn/turnPhases.validate.ts       — WP-007A contract
    packages/game-engine/src/turn/turnPhases.contracts.test.ts — WP-007A tests
    packages/game-engine/src/turn/turnLoop.ts                  — WP-007B
    packages/game-engine/src/turn/turnLoop.integration.test.ts — WP-007B tests
    packages/game-engine/src/test/mockCtx.ts                   — shared test helper
    packages/game-engine/src/state/zones.types.ts              — WP-006A contract
    packages/game-engine/src/state/zones.validate.ts           — WP-006A contract
    packages/game-engine/src/setup/playerInit.ts               — WP-006B
    packages/game-engine/src/setup/pilesInit.ts                — WP-006B
    packages/game-engine/src/game.ts                           — WP-007B (no changes needed)

These are dependencies, not execution targets.

---

## Runtime Wiring Allowance

This WP adds `MoveResult`, `MoveError`, and `CoreMoveName` to `src/types.ts`
re-exports. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal
edits to `buildInitialGameState.ts` and affected structural tests are permitted
solely to restore type and assertion correctness. No new behavior may be
introduced.

If and only if adding re-exports to `types.ts` or `index.ts` causes existing
structural test assertions to fail (e.g., export-count checks), those assertions
may be updated to reflect the new count. No other changes are permitted under
this allowance.

Any file modified under this clause must be documented in the execution summary.

---

## Locked Values (Do Not Re-Derive)

### MoveError shape (engine-wide contract)

`{ code: string; message: string; path: string }`

### MoveResult shape

`{ ok: true } | { ok: false; errors: MoveError[] }`

### CoreMoveName values (exactly 3, in this order)

`'drawCards'` | `'playCard'` | `'endTurn'`

### MOVE_ALLOWED_STAGES assignments

- `drawCards`: `['start', 'main']` — allowed during draw phase and main action
- `playCard`: `['main']` — only during main action phase
- `endTurn`: `['cleanup']` — only during cleanup phase

`MOVE_ALLOWED_STAGES` is the sole source of truth for stage gating.
No additional per-move logic may override or supplement this map.

### PlayCardArgs.cardId

Typed as `CardExtId` (imported from `state/zones.types.ts`) — not plain `string`.

### EndTurnArgs

`Record<string, never>` — no payload.

### TurnStage values (use constants, never hardcode in gating logic)

`'start'` | `'main'` | `'cleanup'`

### Required // why: comments

- `MoveResult`/`MoveError`: engine-wide contract — every future packet imports
  these; no parallel error types permitted
- Each `MOVE_ALLOWED_STAGES` entry: why that move is allowed in those stages
- Drift test: failure means a move name added to union type but not canonical array
- A drift-detection test must also assert that every `CoreMoveName` has a
  corresponding entry in `MOVE_ALLOWED_STAGES` — adding a move name without
  gating must fail tests

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-008A`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `PlayCardArgs.cardId` must import `CardExtId` from `zones.types.ts`
- Stage gating must reference `TurnStage` from `turnPhases.types.ts`
- `isValidTurnStage` from `turnPhases.logic.ts` must be used in
  `validateMoveAllowedInStage` to confirm stage validity
- `CORE_MOVE_NAMES` must be a `readonly` array containing all `CoreMoveName` values
- All four validators return `MoveResult`, never throw
- `MoveError.message` must be a full sentence (code-style Rule 11)
- No `.reduce()` in validation or gating
- No `boardgame.io` import in any new source file
- ESM only, `node:` prefix on all Node built-in imports
- Test file uses `.test.ts` extension
- Test uses `node:test` and `node:assert` only — no `boardgame.io/testing`
- `G` must remain JSON-serializable — all new types must satisfy this

---

## EC-Mode Execution Rules

- All code changes must map to **EC-008A**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-008A execution:

- All EC-008A checklist items must pass
- All tests must pass (67 existing + 9 new = 76 minimum)
- No forbidden files modified
- `CoreMoveName`, `CORE_MOVE_NAMES` exported and correct
- `MoveResult`, `MoveError` exported as engine-wide contract
- `PlayCardArgs.cardId` typed as `CardExtId`
- `MOVE_ALLOWED_STAGES` assignments match locked values
- `isMoveAllowedInStage` functional and tested
- All four validators return structured results, never throw
- Drift-detection test prevents silent move name additions
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after new types are added
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests including new contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no throw in validators
grep -r "throw " packages/game-engine/src/moves/coreMoves.validate.ts
# Expected: no output

# Step 4 — confirm coreMoves.gating.ts has no boardgame.io import
grep "boardgame.io" packages/game-engine/src/moves/coreMoves.gating.ts
# Expected: no output

# Step 5 — confirm PlayCardArgs imports CardExtId (not plain string)
grep "CardExtId" packages/game-engine/src/moves/coreMoves.types.ts
# Expected: at least one match

# Step 6 — confirm no require() in any generated file
grep -r "require(" packages/game-engine/src/moves/
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/moves/ plus
#           src/types.ts and src/index.ts

# Step 8 — confirm test file has no boardgame.io import
grep "boardgame.io" packages/game-engine/src/moves/coreMoves.contracts.test.ts
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — what move contracts are now exported
  - `docs/ai/DECISIONS.md` — stage assignment decisions for each move (why
    `endTurn` is `cleanup`-only; why `drawCards` allowed in `start` and `main`)
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-008A complete with date
- Document any files modified under the Runtime Wiring Allowance
- Commit using EC-mode hygiene rules (`EC-008A:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-008A:

**DO NOT IMPLEMENT IT.**
