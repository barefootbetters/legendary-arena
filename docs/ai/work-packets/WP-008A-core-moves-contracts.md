# WP-008A — Core Moves Contracts (Draw, Play, End Turn)

**Status:** Ready
**Primary Layer:** Game Engine / Contracts
**Dependencies:** WP-007B

---

## Session Context

WP-007B wired the turn loop into the boardgame.io `play` phase — `G.currentStage`
advances from `start → main → cleanup` and `ctx.events.endTurn()` is called at
`cleanup`. This packet locks the move contracts that WP-008B will implement:
payload types, `MoveResult`/`MoveError` as the engine-wide result contract,
stage gating, and four pure validators. `MoveResult` and `MoveError` are the
canonical error types for every move validator in every future packet — they
must never be redefined elsewhere.

---

## Goal

Define the canonical contracts for the first three gameplay moves so that
WP-008B has a locked, testable specification to implement against.

After this session, `@legendary-arena/game-engine` exports:
- `CoreMoveName`, `DrawCardsArgs`, `PlayCardArgs`, `EndTurnArgs` — payload types
- `MoveResult`, `MoveError` — the engine-wide structured result contract
- `MOVE_ALLOWED_STAGES` and `isMoveAllowedInStage` — stage gating
- Four pure validators that return structured results, never throw
- Drift-detection tests that prevent move names and stage assignments from
  changing silently

No move implementations that mutate `G` are written in this packet.

---

## Assumes

- WP-007B complete. Specifically:
  - `packages/game-engine/src/turn/turnPhases.types.ts` exports `TurnStage`,
    `TURN_STAGES` (WP-007A)
  - `packages/game-engine/src/turn/turnPhases.logic.ts` exports
    `isValidTurnStage` (WP-007A)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId`,
    `PlayerZones`, `PlayerState` (WP-006A)
  - `packages/game-engine/src/game.ts` has `advanceStage` move wired into
    the `play` phase and `G.currentStage` tracked in `G` (WP-007B)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract"
  and "Zone Mutation Rules". `MoveResult` and `MoveError` are the engine-wide
  result contract — every move validator in every future packet must use these
  types, not define new parallel types. The three-step ordering (validate args
  → check stage gate → mutate `G`) is also documented here.
- `packages/game-engine/src/state/zones.types.ts` — `CardExtId` type and zone
  definitions. `PlayCardArgs.cardId` must be typed as `CardExtId` (an `ext_id`
  string), not a plain `string`.
- `packages/game-engine/src/turn/turnPhases.types.ts` — `TurnStage` and
  `TURN_STAGES`. Stage gating uses these exact values — do not hardcode
  `'start'`, `'main'`, `'cleanup'` as string literals in gating logic.
- `packages/game-engine/src/turn/turnPhases.logic.ts` — `isValidTurnStage`.
  Use this in `validateMoveAllowedInStage` to confirm the stage argument is
  a known stage before checking the gating map.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — runtime state
  boundaries: move payloads that reference cards must use stable `ext_id`
  strings, not display names, slugs, or database IDs.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: no DB queries inside move functions; all moves must be pure and
  deterministic; `ctx.random.*` is the only permitted randomness source (not
  used in this packet — contracts only).
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments on gating decisions), Rule 9
  (`node:` prefix), Rule 11 (full-sentence error messages in
  `MoveError.message`), Rule 13 (ESM only), Rule 14 (field names match data
  contract — `cardId` not `card_id`).

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
- `PlayCardArgs.cardId` must be typed as `CardExtId` (imported from
  `zones.types.ts`) — not a plain `string`
- Stage gating must reference `TurnStage` values from `turnPhases.types.ts` —
  no hardcoded stage string literals outside the `MOVE_ALLOWED_STAGES`
  definition itself
- `MoveResult` and `MoveError` are the engine-wide result contract — no future
  packet may redefine or shadow these types; add a `// why:` comment making
  this clear
- All four validators return structured results — never throw
- `CORE_MOVE_NAMES` drift-detection test is required — failure means a move
  name was added to the union type but not the canonical array

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MoveError shape** (this packet defines `MoveError` as the engine-wide
  contract — every future packet imports and reuses this exact shape; no
  parallel error types are permitted):
  `{ code: string; message: string; path: string }`

- **CoreMoveName values** (this packet defines `CoreMoveName` as exactly these
  3 strings — `CORE_MOVE_NAMES` array must contain all 3 in this order):
  `'drawCards'` | `'playCard'` | `'endTurn'`

- **MOVE_ALLOWED_STAGES assignments** (these are the locked default stage
  assignments — any deviation must be logged in `docs/ai/DECISIONS.md`):
  `drawCards`: `['start', 'main']` — allowed during draw phase and main action
  `playCard`: `['main']` — only during main action phase
  `endTurn`: `['cleanup']` — only during cleanup phase

- **TurnStage values** (stage gating uses these — never hardcode string
  literals in gating logic; use `TurnStage` constants from `turnPhases.types.ts`):
  `'start'` | `'main'` | `'cleanup'`

---

## Scope (In)

### A) `src/moves/coreMoves.types.ts` — new
- `type CoreMoveName = 'drawCards' | 'playCard' | 'endTurn'`
- `const CORE_MOVE_NAMES: readonly CoreMoveName[]` — all 3 values in canonical
  order (enables drift-detection test)
- `interface DrawCardsArgs { count: number }`
- `interface PlayCardArgs { cardId: CardExtId }` — imports `CardExtId` from
  `state/zones.types.ts`, not a plain `string`
- `type EndTurnArgs = Record<string, never>` — no payload
- `interface MoveError { code: string; message: string; path: string }`
- `type MoveResult = { ok: true } | { ok: false; errors: MoveError[] }`
- `// why:` comment on `MoveResult`/`MoveError`: these are the engine-wide
  result contract — every move validator in every future packet imports and
  reuses them; no parallel error types are permitted

### B) `src/moves/coreMoves.gating.ts` — new
- `const MOVE_ALLOWED_STAGES: Readonly<Record<CoreMoveName, readonly TurnStage[]>>`
  with these assignments:
  - `drawCards`: `['start', 'main']`
  - `playCard`: `['main']`
  - `endTurn`: `['cleanup']`
- `isMoveAllowedInStage(move: CoreMoveName, stage: TurnStage): boolean`
- `// why:` comment on each stage assignment explaining the design decision
  (e.g., why `drawCards` is allowed in `start` but not `cleanup`; why
  `endTurn` is `cleanup`-only)
- Any assignment that differs from the defaults above must be logged in
  `docs/ai/DECISIONS.md`

### C) `src/moves/coreMoves.validate.ts` — new (all validators return `MoveResult`, never throw)
- `validateDrawCardsArgs(args: unknown): MoveResult`
  — `count` must be a finite integer ≥ 0
- `validatePlayCardArgs(args: unknown): MoveResult`
  — `cardId` must be a non-empty string
- `validateEndTurnArgs(args: unknown): MoveResult`
  — always `{ ok: true }`; extra keys on the passed object are ignored
- `validateMoveAllowedInStage(move: unknown, stage: unknown): MoveResult`
  — validates `move` is a `CoreMoveName`, `stage` is a `TurnStage`, then
  checks `MOVE_ALLOWED_STAGES`

### D) `src/types.ts` — modified
- Re-export `MoveResult`, `MoveError`, `CoreMoveName` alongside existing game
  state types (avoid breaking existing imports)

### E) `src/index.ts` — modified
- Export all new public types and functions as named exports

### F) Tests — `src/moves/coreMoves.contracts.test.ts` — new
- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`
- Nine tests:
  1. `validateDrawCardsArgs({ count: 5 })` → `{ ok: true }`
  2. `validatePlayCardArgs({ cardId: 'some-ext-id' })` → `{ ok: true }`
  3. `validateDrawCardsArgs({ count: -1 })` → `{ ok: false }`
  4. `validateDrawCardsArgs({ count: 1.5 })` → `{ ok: false }`
  5. `validatePlayCardArgs({ cardId: '' })` → `{ ok: false }`
  6. `isMoveAllowedInStage('playCard', 'start')` → `false`
  7. `isMoveAllowedInStage('drawCards', 'main')` → `true`
  8. `isMoveAllowedInStage('endTurn', 'cleanup')` → `true`
  9. Drift: `CORE_MOVE_NAMES` contains exactly
     `['drawCards', 'playCard', 'endTurn']` — `// why:` comment: failure here
     means a move name was added to the union type but not the canonical array

---

## Out of Scope

- No move implementations that mutate `G`
- No shuffling or randomness
- No card rules (costs, attack, recruit, keywords)
- No database or network access
- No UI or server changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/moves/coreMoves.types.ts` — **new** — move names,
  payloads, engine-wide result contract
- `packages/game-engine/src/moves/coreMoves.gating.ts` — **new** — stage
  gating map and helper
- `packages/game-engine/src/moves/coreMoves.validate.ts` — **new** — four
  pure validators
- `packages/game-engine/src/types.ts` — **modified** — re-export move contracts
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/moves/coreMoves.contracts.test.ts` — **new** —
  `node:test` coverage including drift-detection

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Canonical Move Names and Payloads
- [ ] `src/moves/coreMoves.types.ts` exports `CoreMoveName` as exactly:
      `'drawCards' | 'playCard' | 'endTurn'`
- [ ] `CORE_MOVE_NAMES` is a `readonly` array containing all 3 move names
- [ ] `PlayCardArgs.cardId` is typed as `CardExtId` — not a plain `string`
      (confirmed by checking the import from `state/zones.types.ts`)
- [ ] `MoveError` has exactly 3 fields: `code: string`, `message: string`,
      `path: string`
- [ ] `coreMoves.types.ts` has a `// why:` comment on `MoveResult`/`MoveError`
      as the engine-wide contract

### Stage Gating
- [ ] `MOVE_ALLOWED_STAGES` assigns `drawCards` to `['start', 'main']`
- [ ] `MOVE_ALLOWED_STAGES` assigns `playCard` to `['main']`
- [ ] `MOVE_ALLOWED_STAGES` assigns `endTurn` to `['cleanup']`
- [ ] Each stage assignment in `coreMoves.gating.ts` has a `// why:` comment
- [ ] `isMoveAllowedInStage('playCard', 'start')` returns `false`
- [ ] `isMoveAllowedInStage('endTurn', 'cleanup')` returns `true`
- [ ] `coreMoves.gating.ts` has no import from `boardgame.io`
      (confirmed with `Select-String`)

### Validators
- [ ] All four validators exported from `coreMoves.validate.ts`
- [ ] No validator contains a `throw` statement
      (confirmed with `Select-String`)
- [ ] `validateDrawCardsArgs({ count: -1 })` returns `{ ok: false }`
- [ ] `validateDrawCardsArgs({ count: 1.5 })` returns `{ ok: false }`
- [ ] `validatePlayCardArgs({ cardId: '' })` returns `{ ok: false }`

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Contract test has all 9 test cases specified in Scope (In)
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

# Step 3 — confirm no throw in validators
Select-String -Path "packages\game-engine\src\moves\coreMoves.validate.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm coreMoves.gating.ts has no boardgame.io import
Select-String -Path "packages\game-engine\src\moves\coreMoves.gating.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — confirm PlayCardArgs imports CardExtId (not plain string)
Select-String -Path "packages\game-engine\src\moves\coreMoves.types.ts" -Pattern "CardExtId"
# Expected: at least one match

# Step 6 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\moves" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/moves/ plus
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
- [ ] No `throw` in any validator (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in `coreMoves.gating.ts`
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what move contracts are now exported
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: the stage assignment
      decisions for each move (why `endTurn` is `cleanup`-only; why `drawCards`
      is allowed in `start`)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-008A checked off with today's date
