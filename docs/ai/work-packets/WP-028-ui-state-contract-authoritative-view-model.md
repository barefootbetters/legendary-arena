# WP-028 — UI State Contract (Authoritative View Model)

**Status:** Ready  
**Primary Layer:** Engine / UI Boundary (Read-Only Projection)  
**Dependencies:** WP-027

---

## Session Context

WP-027 introduced the replay verification harness, proving that games are
deterministically reproducible. All prior packets (WP-002 through WP-026)
built the engine's internal state model — `G`, `ctx`, zones, counters, hooks.
This packet defines the **only** state the UI may consume: a derived, read-only,
fully serializable projection that hides all engine internals. The UI never
reads `G` directly — it receives `UIState`, a projection built from `G` and
`ctx` by an engine-side function. This implements D-0301 (UI Consumes
Projections Only).

---

## Goal

Define a single authoritative UI state contract. After this session:

- `UIState` is a fully serializable interface containing everything the UI
  needs: game phase, player states, city, HQ, mastermind, scheme, economy,
  log, and game-over summary
- `buildUIState(gameState, ctx)` is a pure function that derives `UIState`
  from engine state — it never mutates `G` or `ctx`, has no caching or
  memoization, and is NOT part of the boardgame.io lifecycle (never called
  from `game.ts`, moves, or phase hooks)
- `UIState` contains **no engine concepts** — no `HookDefinition`, no
  `ImplementationMap`, no `hookRegistry`, no `cardStats`, no
  `heroAbilityHooks`, no `schemeSetupInstructions`, no `CardExtId[]` zone
  arrays (zones are projected as counts or display-safe representations)
- The contract supports replay, spectators, and future networking
- Tests prove `UIState` is JSON-serializable, deterministic, and derived
  without mutation

---

## Assumes

- WP-027 complete. Specifically:
  - All MVP gameplay mechanics are in place (WP-002 through WP-026)
  - `LegendaryGameState` is stable with all fields
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/scoring/scoring.types.ts` exports
    `FinalScoreSummary` (WP-020)
  - `packages/game-engine/src/economy/economy.types.ts` exports `TurnEconomy`
    (WP-018)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0301 (UI Consumes Projections Only)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Zones, State
  & Serialization". All runtime state is JSON-serializable. `UIState` is a
  derived projection — it must also be JSON-serializable.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "What G Is". `G` is managed by
  boardgame.io via Immer. The UI must never receive `G` directly — only the
  projection.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the UI
  boundary is explicit: "UI consumes read-only projections of engine state,
  never `G` or `ctx` directly."
- `docs/ai/DECISIONS.md` — read D-0301 (UI Consumes Projections Only) and
  D-0302 (Single UIState, Multiple Audiences). This packet implements D-0301.
  WP-029 will implement D-0302 (spectator views).
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `playerState` not `ps`), Rule 6 (`// why:` on why UIState hides engine
  internals), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — UI state derivation involves no randomness
- Never throw inside `buildUIState` — return a safe default or structured error
- `UIState` must be JSON-serializable — no class instances, Maps, Sets, or
  functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `buildUIState` is a **pure function** — no I/O, no mutation of `G` or `ctx`,
  no side effects, no caching, no memoization, no closures over G
- `buildUIState` is NOT part of the boardgame.io lifecycle — it MUST NOT be
  called from `game.ts`, any move, or any phase hook
- `UIState` contains **no engine internals**: no `hookRegistry`, no
  `ImplementationMap`, no `villainDeckCardTypes`, no `cardStats`, no
  `heroAbilityHooks`, no `schemeSetupInstructions`
- Zone contents in `UIState` are **display-safe projections** — counts, visible
  card identifiers, or display-ready data. The exact projection strategy
  (counts vs card lists vs display objects) must be documented in DECISIONS.md.
- `UIState` is the **only** state the UI consumes — no direct `G` access
- `UIState` is **deterministic**: same `G` + `ctx` always produces the same
  `UIState`
- No `.reduce()` in projection logic — use `for...of`
- No registry import in `buildUIState` — card display data resolution is a
  separate UI concern (the UI calls the registry independently for display
  names, images, etc.)
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **UIState top-level shape:**
  ```ts
  interface UIState {
    game: {
      phase: string
      turn: number
      activePlayerId: string
      currentStage: string
    }
    players: UIPlayerState[]
    city: UICityState
    hq: UIHQState
    mastermind: UIMastermindState
    scheme: UISchemeState
    economy: UITurnEconomyState
    log: string[]
    gameOver?: UIGameOverState
  }
  ```

---

## Scope (In)

### A) `src/ui/uiState.types.ts` — new

- `interface UIState` — top-level shape as specified in locked contract values
- `interface UIPlayerState` — per-player projection:
  - `playerId: string`
  - `deckCount: number` (not the actual cards)
  - `handCount: number`
  - `discardCount: number`
  - `inPlayCount: number`
  - `victoryCount: number`
  - `woundCount: number`
- `interface UICityState` — city projection:
  - `spaces: (UICityCard | null)[]` where `UICityCard` contains display-safe
    card info (ext_id, type, keywords)
- `interface UIHQState` — HQ projection:
  - `slots: (string | null)[]` (ext_ids for display lookup)
- `interface UIMastermindState` — mastermind projection:
  - `id: string`, `tacticsRemaining: number`, `tacticsDefeated: number`
- `interface UISchemeState` — scheme projection:
  - `id: string`, `twistCount: number`
- `interface UITurnEconomyState` — economy projection:
  - `attack: number`, `recruit: number`, `availableAttack: number`,
    `availableRecruit: number`
- `interface UIGameOverState` — endgame projection:
  - `outcome: string`, `reason: string`, `scores?: FinalScoreSummary`
- All types are JSON-serializable — no engine concepts exposed
- `// why:` comment: UIState is the only data the UI sees; engine internals
  are hidden to prevent logic leakage and maintain the Layer Boundary

### B) `src/ui/uiState.build.ts` — new

- `buildUIState(gameState: LegendaryGameState, ctx: UIBuildContext): UIState`
  — pure function (UIBuildContext is a local structural interface
  `{ readonly phase: string | null, readonly turn: number, readonly currentPlayer: string }`,
  not boardgame.io `Ctx`):
  1. Project game phase, turn, active player from `ctx`
  2. Project player states: zone counts from `G.playerZones`, wound counts
  3. Project City: card ext_ids + type classification from
     `G.villainDeckCardTypes` + keywords from `G.cardKeywords`
  4. Project HQ: slot ext_ids
  5. Project mastermind: id + tactics counts
  6. Project scheme: id + twist count from `G.counters`
  7. Project economy: attack/recruit totals and available amounts
  8. Project log: `G.messages`
  9. Project game over: from endgame result if present
  - Never mutates `G` or `ctx`
  - Uses `for...of` for all iteration (no `.reduce()`)
  - `// why:` comment on each projection explaining what is hidden and why

### C) `src/types.ts` — modified

- Re-export all UI state types

### D) `src/index.ts` — modified

- Export `buildUIState`, `UIState`, and all sub-types

### E) Tests — `src/ui/uiState.build.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Nine tests:
  1. `buildUIState` returns a valid `UIState` for a standard game state
  2. `UIState` is JSON-serializable (`JSON.stringify` roundtrip)
  3. `UIState` does NOT contain `hookRegistry` (key absent)
  4. `UIState` does NOT contain `villainDeckCardTypes` (key absent)
  5. `UIState` does NOT contain `cardStats` (key absent)
  6. Player zones are projected as counts (not card arrays)
  7. `buildUIState` does not mutate input `G` (deep equality check)
  8. Same `G` + `ctx` produces identical `UIState` (deterministic)
  9. Game-over state is projected when endgame result exists

---

## Out of Scope

- **No spectator or permission-filtered views** — WP-029
- **No UI rendering or components** — this is a data contract only
- **No card display name resolution** — the UI calls the registry independently
  for display data (names, images, ability text)
- **No real-time updates or subscriptions** — `buildUIState` is called on
  demand
- **No UIState persistence** — derived on each render cycle
- **No server or network changes**
- **No database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **new** — UIState and all
  sub-types
- `packages/game-engine/src/ui/uiState.build.ts` — **new** — buildUIState
  pure function
- `packages/game-engine/src/types.ts` — **modified** — re-export UI types
- `packages/game-engine/src/index.ts` — **modified** — export UI API
- `packages/game-engine/src/ui/uiState.build.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### UIState Contract
- [ ] `UIState` contains all top-level fields from locked contract shape
- [ ] `UIState` is JSON-serializable (roundtrip test)
- [ ] `UIState` does NOT contain: `hookRegistry`, `villainDeckCardTypes`,
      `cardStats`, `heroAbilityHooks`, `schemeSetupInstructions`,
      `ImplementationMap`

### Projection Quality
- [ ] Player zones projected as counts (not `CardExtId[]` arrays)
- [ ] City projected with display-safe card info
- [ ] Economy projected with available amounts
- [ ] Mastermind projected with tactics counts
- [ ] Game-over projected when endgame result exists

### Pure Function
- [ ] `buildUIState` does not mutate `G` or `ctx` (deep equality test)
- [ ] `buildUIState` is deterministic (same inputs → same output)
- [ ] No I/O, no side effects

### No Engine Leakage
- [ ] No boardgame.io import in UI state files
      (confirmed with `Select-String`)
- [ ] No registry import in `buildUIState`
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in projection logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests confirm engine internals are absent from UIState
- [ ] Tests confirm G is not mutated
- [ ] Tests confirm JSON-serialization roundtrip
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding UI state contract
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in UI state files
Select-String -Path "packages\game-engine\src\ui" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no registry import in buildUIState
Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() in projection
Select-String -Path "packages\game-engine\src\ui" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm engine internals excluded from UIState type
Select-String -Path "packages\game-engine\src\ui\uiState.types.ts" -Pattern "hookRegistry|ImplementationMap|villainDeckCardTypes|cardStats|heroAbilityHooks"
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\ui" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in UI state files
      (confirmed with `Select-String`)
- [ ] No registry import in `buildUIState` (confirmed with `Select-String`)
- [ ] No `.reduce()` in projection logic (confirmed with `Select-String`)
- [ ] Engine internals excluded from UIState type
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — UIState contract exists; UI never reads G
      directly; D-0301 is implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: zone projection strategy
      (counts vs card lists); why UIState hides engine internals; why card
      display resolution is a separate UI concern (not in buildUIState)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-028 checked off with today's date
