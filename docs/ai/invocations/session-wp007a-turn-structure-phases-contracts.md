# Session Prompt — Execute WP-007A (Turn Structure & Phases Contracts)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute **WP-007A** to lock the canonical phase and turn stage contracts for
the Legendary Arena game engine. This defines the lifecycle-to-phase mapping,
the three-stage turn cycle, transition validation, and drift-detection tests.

This Work Packet is strictly about **contract definition and pure helpers**.
It must not introduce gameplay logic, move implementations, or boardgame.io
runtime wiring.

---

## Scope & Intent (Read Carefully)

WP-007A **does**:

- Define `MatchPhase` and `TurnStage` union types with canonical arrays
- Implement pure transition helpers (`getNextTurnStage`, `isValidTurnStageTransition`)
- Add a structured transition validator (`validateTurnStageTransition`)
- Add drift-detection tests pinning arrays to their union types
- Export new types and functions from `types.ts` and `index.ts`

WP-007A **does NOT**:

- Add turn advancement logic (that is WP-007B)
- Add moves, stage gating, or `G.currentStage` (that is WP-007B / WP-008A)
- Modify `game.ts` or phase definitions in the boardgame.io `Game` object
- Add `boardgame.io` imports to any new file
- Add rule hooks, effects, or counters
- Modify any WP-006A or WP-006B files

If a change feels like **runtime behavior, move logic, or game state mutation**,
it does **not** belong here.

---

## Authority Chain (Read in This Order)

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules
2. `docs/ai/ARCHITECTURE.md`
   - Section: Phase Sequence and Lifecycle Mapping
   - Section: The Turn Stage Cycle
   - Section: The Move Validation Contract (reference only — not implemented here)
3. `.claude/rules/game-engine.md`
4. `.claude/rules/code-style.md`
5. `docs/ai/work-packets/WP-007A-turn-structure-phases-contracts.md`
6. `docs/ai/execution-checklists/EC-007A-turn-phases-contracts.checklist.md`

Then reference (read-only unless explicitly stated):

7. `packages/game-engine/src/game.ts` — already has 4 phases scaffolded (do not modify)
8. `packages/game-engine/src/types.ts` — will be modified (re-export new types)
9. `packages/game-engine/src/index.ts` — will be modified (export new public API)
10. `docs/ai/REFERENCE/00.2-data-requirements.md` §8.2 — lifecycle-to-phase mapping

---

## Critical Context (Post-WP-006B Reality)

- `game.ts` already scaffolds 4 phases: `lobby`, `setup`, `play`, `end` — these
  names are locked. WP-007A formalizes them as the `MatchPhase` type but does NOT
  modify `game.ts`.
- `LegendaryGameState` does NOT yet have `currentStage` — that field is added by
  WP-007B. WP-007A only defines the `TurnStage` type and transition helpers.
- `ZoneValidationError` uses `{ field, message }`.
  `TurnPhaseError` uses `{ code, message, path }`.
  These are intentionally different shapes for different domains. **Do not unify them.**
- No `src/turn/` directory exists yet. This packet creates it.

---

## Canonical Source-of-Truth Rule (Important)

The canonical arrays defined in this packet are the **single source of truth**:

- `MATCH_PHASES`
- `TURN_STAGES`

All logic, type guards, helpers, and tests **must derive behavior from these arrays**.
No hardcoded string literals may be used outside these definitions.

---

## What WP-007A Must Do

### 1. Turn Phase Types

Create `src/turn/turnPhases.types.ts`:

```ts
type MatchPhase = 'lobby' | 'setup' | 'play' | 'end'
type TurnStage = 'start' | 'main' | 'cleanup'

const MATCH_PHASES: readonly MatchPhase[]   // all 4 in canonical order
const TURN_STAGES: readonly TurnStage[]     // all 3 in canonical order

type TurnPhaseError = { code: string; message: string; path: string }
```

Requirements:

- Include a `// why:` comment mapping 00.2 section 8.2 lifecycle concepts
  (`Lobby`, `Setup`, `In Progress`, `Completed`) to boardgame.io phase names
  (`lobby`, `setup`, `play`, `end`)
- No boardgame.io imports

---

### 2. Transition Logic (Pure Helpers)

Create `src/turn/turnPhases.logic.ts` (**pure helpers only**):

- `getNextTurnStage(current: TurnStage): TurnStage | null`
  - Returns the next stage
  - Returns `null` when `cleanup` is reached (signals turn end; never cycles back)
- `isValidTurnStageTransition(from: TurnStage, to: TurnStage): boolean`
  - Only `start -> main` and `main -> cleanup` are valid
- `isValidMatchPhase(phase: string): phase is MatchPhase` — type guard
- `isValidTurnStage(stage: string): stage is TurnStage` — type guard

Type-guard requirements:

- Guards must be implemented via canonical array membership checks
- No casts, heuristics, or inferred coercion

Additional constraints:

- No boardgame.io import in this file
- No `.reduce()` in this file

---

### 3. Transition Validator (Structured, Non-Throwing)

Create `src/turn/turnPhases.validate.ts`:

```ts
validateTurnStageTransition(
  from: unknown,
  to: unknown
): { ok: true } | { ok: false; errors: TurnPhaseError[] }
```

Rules:

- Validates `from` and `to` are valid `TurnStage` strings **before** checking
  transition legality
- May return **multiple errors** if both fields are invalid
- `path` must clearly identify `"from"` or `"to"`
- Never throws — always returns structured results

---

### 4. Re-exports (Public API)

Modify `src/types.ts`:

- Re-export from `src/turn/turnPhases.types.js`:
  - `MatchPhase`
  - `TurnStage`
  - `TurnPhaseError`

Modify `src/index.ts`:

Export all new public API as named exports:

**Types**

- `MatchPhase`
- `TurnStage`
- `TurnPhaseError`

**Values**

- `MATCH_PHASES`
- `TURN_STAGES`

**Functions**

- `getNextTurnStage`
- `isValidTurnStageTransition`
- `isValidMatchPhase`
- `isValidTurnStage`
- `validateTurnStageTransition`

---

### 5. Tests (Exactly 7, No More, No Less)

Create `src/turn/turnPhases.contracts.test.ts`.

**Each item below MUST be its own `test()` block. No combined or parameterized tests.**

1. `start -> main` is a valid transition
2. `main -> cleanup` is a valid transition
3. `getNextTurnStage('cleanup')` returns `null`
4. `main -> start` is NOT a valid transition
5. `cleanup -> main` is NOT a valid transition
6. **Drift:** `TURN_STAGES` is exactly `['start', 'main', 'cleanup']`
   - Includes a `// why:` comment explaining what a failure means
7. **Drift:** `MATCH_PHASES` is exactly `['lobby', 'setup', 'play', 'end']`
   - Includes a `// why:` comment explaining what a failure means

Test constraints:

- Use `node:test` and `node:assert` only
- Do NOT import from `boardgame.io`
- Do NOT use `require()`
- `makeMockCtx` is not expected to be needed for this packet

---

## Regression Guarantee

Ensure **all existing tests still pass**, including:

- WP-005B determinism tests
- WP-006A zone shape tests
- WP-006B player init and validator integration tests

---

## Execution Rules (Strict)

1. One Work Packet only — **WP-007A**
2. No gameplay logic, no move implementations
3. No `boardgame.io` imports in any new file
4. No `G.currentStage` (WP-007B only)
5. No modification of `game.ts`
6. No `.reduce()` in transition logic
7. No `throw` in validators — return structured results only
8. Do NOT modify WP-006A files (`zones.types.ts`, `zones.validate.ts`)
9. Do NOT modify WP-006B files (`playerInit.ts`, `pilesInit.ts`)
10. `TurnPhaseError` shape is `{ code, message, path }` — do NOT unify with `ZoneValidationError`
11. Phase and stage strings must come from canonical arrays only
12. **Do NOT introduce any helpers, utilities, or exports beyond those explicitly listed**
13. All drift-detection tests must include a `// why:` comment explaining failure meaning

---

## Locked Values (Do Not Change)

### MatchPhase (Canonical Order)

`'lobby'` | `'setup'` | `'play'` | `'end'`

### Lifecycle-to-Phase Mapping (00.2 section 8.2)

| Lifecycle concept | boardgame.io phase |
|---|---|
| Lobby | `lobby` |
| Setup | `setup` |
| In Progress | `play` |
| Completed | `end` |

### TurnStage (Canonical Order)

`'start'` | `'main'` | `'cleanup'`

### Valid Transitions (Exhaustive)

- `start -> main`
- `main -> cleanup`
- `cleanup -> null` (turn ends)

All other transitions are invalid.

---

## TurnPhaseError Shape (Locked)

```ts
{ code: string; message: string; path: string }
```

---

## Files Expected to Change

- `packages/game-engine/src/turn/turnPhases.types.ts` — **new**
- `packages/game-engine/src/turn/turnPhases.logic.ts` — **new**
- `packages/game-engine/src/turn/turnPhases.validate.ts` — **new**
- `packages/game-engine/src/turn/turnPhases.contracts.test.ts` — **new**
- `packages/game-engine/src/types.ts` — **modified** (re-exports)
- `packages/game-engine/src/index.ts` — **modified** (public API)

No other files may be modified.

---

## Verification After Execution

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — all tests (includes WP-005B, WP-006A, WP-006B tests)
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, 0 failing

# Step 3 — no boardgame.io imports in new files
Select-String `
  -Path packages\game-engine\src\turn\turnPhases.types.ts,
        packages\game-engine\src\turn\turnPhases.logic.ts,
        packages\game-engine\src\turn\turnPhases.validate.ts `
  -Pattern "boardgame.io"
# Expected: no output

# Step 4 — no throw in validator
Select-String `
  -Path packages\game-engine\src\turn\turnPhases.validate.ts `
  -Pattern "throw "
# Expected: no output

# Step 5 — no require() in new files
Select-String `
  -Path packages\game-engine\src\turn\turnPhases.types.ts,
        packages\game-engine\src\turn\turnPhases.logic.ts,
        packages\game-engine\src\turn\turnPhases.validate.ts,
        packages\game-engine\src\turn\turnPhases.contracts.test.ts `
  -Pattern "require\("
# Expected: no output

# Step 6 — WP-006A/B contract files unchanged
git diff --name-only packages/game-engine/src/state/zones.types.ts packages/game-engine/src/state/zones.validate.ts packages/game-engine/src/setup/playerInit.ts packages/game-engine/src/setup/pilesInit.ts
# Expected: no output

# Step 7 — only expected files changed
git diff --name-only
# Expected: only files listed in "Files Expected to Change"
```

Expected: **no errors, no unexpected file changes**.

---

## Mandatory Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-007A section summarizing exported turn contracts
- [ ] `docs/ai/DECISIONS.md`
  1. Why `TurnStage` is defined separately from boardgame.io's stage concept
  2. Why `getNextTurnStage` returns `null` after `cleanup` instead of cycling
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-007A complete with today's date

---

### Intent Summary (For Claude)

WP-007A defines **what phases and stages are** and **how transitions are validated**.

Types — yes
Canonical arrays — yes
Pure helpers — yes
Structured validation — yes
Drift detection — yes

Runtime behavior — no
Game state mutation — no
Move logic — no
Turn advancement — no
boardgame.io wiring — no

If you hesitate whether something belongs here, it almost certainly doesn't.
