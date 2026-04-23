# WP-007A — Turn Structure & Phases Contracts

**Status:** Complete
**Primary Layer:** Game Engine / Contracts
**Dependencies:** WP-006B

---

## Session Context

WP-006B aligned player state initialization with the canonical zone types and
confirmed the full setup output passes both WP-006A validators. The game engine
now has a complete, validated initial `G`. This packet locks the turn and phase
structure contracts — `MatchPhase`, `TurnStage`, canonical arrays, transition
helpers, and drift-detection tests — that WP-007B will wire into boardgame.io.
No gameplay logic is implemented here.

---

## Goal

Define the canonical turn structure and phase contracts that all future move
implementation (WP-007B onward) must follow — without implementing any gameplay
logic.

After this session, `@legendary-arena/game-engine` exports:
- `MatchPhase` and `TurnStage` string union types with canonical ordered arrays
- Pure transition helpers (`getNextTurnStage`, `isValidTurnStageTransition`)
- `validateTurnStageTransition` — structured result, never throws
- Drift-detection tests that prevent phase/stage sets from changing silently

---

## Assumes

- WP-006B complete. Specifically:
  - `packages/game-engine/src/game.ts` exports `LegendaryGame` with 4 phases:
    `lobby`, `setup`, `play`, `end` (WP-002)
  - `packages/game-engine/src/state/zones.types.ts` exports `PlayerZones`,
    `PlayerState`, `GlobalPiles` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "Phase Sequence and Lifecycle
  Mapping" and "The Turn Stage Cycle". These document the canonical `MatchPhase`
  and `TurnStage` values, the lifecycle-to-phase mapping, and why `currentStage`
  lives in `G` not `ctx`. The types defined in this packet must match those
  documented values exactly.
- `packages/game-engine/src/game.ts` — the existing `LegendaryGame` from
  WP-002. Read it to confirm the 4 phase names already in place before creating
  the type that locks them.
- `packages/game-engine/src/types.ts` — the existing `LegendaryGameState`.
  Read it before modifying to avoid duplicate type definitions.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — the lifecycle concept
  `Lobby → Setup → In Progress → Completed` maps to boardgame.io phase names
  `lobby → setup → play → end`. This packet locks that mapping. Do not invent
  alternate phase names.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: all moves must be pure and deterministic; `G` must always be
  JSON-serializable; `ctx.random.*` is the only permitted randomness source
  (not used in this packet).
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments on the lifecycle-to-phase
  mapping), Rule 9 (`node:` prefix for built-ins), Rule 11 (full-sentence
  error messages in validators), Rule 13 (ESM only), Rule 14 (field names
  match data contract).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; all new types must satisfy this
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access of any kind
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Phase names must match the 00.2 §8.2 lifecycle mapping exactly:
  `lobby`, `setup`, `play`, `end` — do not invent alternate names
- `MATCH_PHASES` and `TURN_STAGES` are canonical `readonly` arrays — a
  drift-detection test is required for each; failure means a value was added
  to the type but not the array, or vice versa
- `turnPhases.logic.ts` must not import from `boardgame.io` — it is a pure
  helper that must be independently testable without a boardgame.io instance
- Validators return structured results — never throw; add a `// why:` comment
- `turnPhases.types.ts` must have a `// why:` comment mapping the 00.2 §8.2
  lifecycle concept to boardgame.io phase names

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **Phase names** (this packet defines `MatchPhase` with exactly these 4
  values — maps to the 00.2 §8.2 lifecycle `Lobby → Setup → In Progress →
  Completed`):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- **TurnStage values** (this packet defines `TurnStage` with exactly these 3
  values — canonical order is start → main → cleanup):
  `'start'` | `'main'` | `'cleanup'`

- **TurnPhaseError shape** (this packet's validator error type — defined here
  independently; `MoveError` from WP-008A has the same shape but is a separate
  type):
  `{ code: string; message: string; path: string }`

---

## Scope (In)

### A) `src/turn/turnPhases.types.ts` — new
- `type MatchPhase = 'lobby' | 'setup' | 'play' | 'end'`
- `type TurnStage = 'start' | 'main' | 'cleanup'`
- `const MATCH_PHASES: readonly MatchPhase[]` — all 4 values in canonical order
- `const TURN_STAGES: readonly TurnStage[]` — all 3 values in canonical order
- `type TurnPhaseError = { code: string; message: string; path: string }`
- `// why:` comment mapping the 00.2 §8.2 lifecycle concept
  (`Lobby → Setup → In Progress → Completed`) to boardgame.io phase names
  (`lobby → setup → play → end`)

### B) `src/turn/turnPhases.logic.ts` — new (pure helpers — no boardgame.io import)
- `getNextTurnStage(current: TurnStage): TurnStage | null` — returns the next
  stage; returns `null` when `cleanup` is reached (signals turn end)
- `isValidTurnStageTransition(from: TurnStage, to: TurnStage): boolean` — only
  `start→main` and `main→cleanup` are valid
- `isValidMatchPhase(phase: string): phase is MatchPhase`
- `isValidTurnStage(stage: string): stage is TurnStage`
- No `boardgame.io` import in this file

### C) `src/turn/turnPhases.validate.ts` — new
- `validateTurnStageTransition(from: unknown, to: unknown): { ok: true } | { ok: false; errors: TurnPhaseError[] }`
- Validates that `from` and `to` are valid `TurnStage` strings before checking
  the transition
- Returns structured results — never throws

### D) `src/types.ts` — modified
- Re-export `MatchPhase`, `TurnStage`, `TurnPhaseError` alongside existing
  game state types (avoid breaking existing imports)

### E) `src/index.ts` — modified
- Export all new public types and functions as named exports

### F) Tests — `src/turn/turnPhases.contracts.test.ts` — new
- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`
- Seven tests:
  1. `start→main` is a valid transition
  2. `main→cleanup` is a valid transition
  3. `getNextTurnStage('cleanup')` returns `null`
  4. `main→start` is not a valid transition
  5. `cleanup→main` is not a valid transition
  6. Drift: `TURN_STAGES` contains exactly `['start', 'main', 'cleanup']` —
     `// why:` comment: failure here means a stage name was added to the
     `TurnStage` union but not the canonical array, or vice versa
  7. Drift: `MATCH_PHASES` contains exactly `['lobby', 'setup', 'play', 'end']` —
     `// why:` comment: failure here means a phase name was added to the
     `MatchPhase` union but not the canonical array, or vice versa

---

## Out of Scope

- No gameplay moves (play card, recruit, fight, end turn)
- No boardgame.io wiring changes — that is WP-007B
- No win/loss logic
- No scheme or mastermind logic
- No persistence or PostgreSQL access
- No UI changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/turn/turnPhases.types.ts` — **new** — canonical
  phase/stage types and arrays
- `packages/game-engine/src/turn/turnPhases.logic.ts` — **new** — pure
  transition helpers
- `packages/game-engine/src/turn/turnPhases.validate.ts` — **new** — structured
  validator
- `packages/game-engine/src/types.ts` — **modified** — re-export new types
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/turn/turnPhases.contracts.test.ts` — **new** —
  `node:test` coverage including drift-detection for both arrays

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Canonical Phase/Stage Sets
- [ ] `src/turn/turnPhases.types.ts` exports `MatchPhase` as exactly:
      `'lobby' | 'setup' | 'play' | 'end'`
- [ ] `src/turn/turnPhases.types.ts` exports `TurnStage` as exactly:
      `'start' | 'main' | 'cleanup'`
- [ ] `MATCH_PHASES` is a `readonly` array containing all 4 phase values in
      order
- [ ] `TURN_STAGES` is a `readonly` array containing all 3 stage values in
      order
- [ ] `turnPhases.types.ts` has a `// why:` comment mapping the 00.2 §8.2
      lifecycle concept to boardgame.io phase names

### Transition Logic
- [ ] `getNextTurnStage('start')` returns `'main'`
- [ ] `getNextTurnStage('main')` returns `'cleanup'`
- [ ] `getNextTurnStage('cleanup')` returns `null`
- [ ] `isValidTurnStageTransition('start', 'main')` returns `true`
- [ ] `isValidTurnStageTransition('main', 'start')` returns `false`
- [ ] `src/turn/turnPhases.logic.ts` contains no import from `boardgame.io`
      (confirmed with `Select-String`)

### Validator
- [ ] `validateTurnStageTransition` exported from `turnPhases.validate.ts`
      with signature
      `(from: unknown, to: unknown): { ok: true } | { ok: false; errors: TurnPhaseError[] }`
- [ ] `validateTurnStageTransition` contains no `throw` statement
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Contract test has 7 tests: 3 valid transition cases, 2 invalid transition
      cases, 1 `TURN_STAGES` drift-detection test, 1 `MATCH_PHASES`
      drift-detection test
- [ ] Both drift tests have `// why:` comments explaining what a failure means
- [ ] Test file does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after new types are added
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests including new contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm turnPhases.logic.ts has no boardgame.io import
Select-String -Path "packages\game-engine\src\turn\turnPhases.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm validator does not throw
Select-String -Path "packages\game-engine\src\turn\turnPhases.validate.ts" -Pattern "throw "
# Expected: no output

# Step 5 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\turn" -Pattern "require(" -Recurse
# Expected: no output

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/turn/ plus
#           src/types.ts and src/index.ts
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `turnPhases.logic.ts` has no `boardgame.io` import
      (confirmed with `Select-String`)
- [ ] `turnPhases.validate.ts` has no `throw` statement
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what turn contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `TurnStage` is defined
      separately from boardgame.io's own stage concept; why `getNextTurnStage`
      returns `null` for `cleanup` rather than cycling back to `start`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-007A checked off with today's date
