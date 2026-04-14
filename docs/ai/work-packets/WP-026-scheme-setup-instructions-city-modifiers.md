# WP-026 — Scheme Setup Instructions & City Modifiers

**Status:** Ready  
**Primary Layer:** Game Engine / Setup & Board Configuration (Runtime Wiring)  
**Dependencies:** WP-025

---

## Session Context

WP-024 connected scheme twist handlers to the rule execution pipeline so that
`onSchemeTwistRevealed` produces real gameplay effects. WP-025 added board
keywords (Patrol, Ambush, Guard) that modify City behavior. This packet adds
a layer **before the first turn**: scheme-specific setup instructions that
configure the board before play begins and persistent modifiers that affect
gameplay continuously. Schemes become first-class configuration entities that
shape the game's structure, not just reactive event text. This is the final
packet in Phase 5 (Card Mechanics & Abilities).

**Terminology note:**
All references to "Representation Before Execution" (RBE) refer to the
DECISIONS.md entry (D-2601) that formalizes the pattern:
- data-only representation first
- deterministic execution via pure helpers
- no execution logic embedded in registry data

---

## Goal

Implement scheme-specific setup instructions and persistent City modifiers.
After this session:

- `SchemeSetupInstruction` is a declarative, data-only contract describing
  what a scheme changes about the game at setup time
- Scheme setup instructions execute during the `setup` phase, before the first
  turn
- Persistent modifiers (e.g., modified City size, added counters, keyword
  overlays) are stored in `G` and respected by existing gameplay logic
- No scheme logic is hard-coded — all behavior derives from declarative
  instruction data resolved from the registry at setup time
- The instruction system follows the **Representation Before Execution** pattern
  (D-2601) — instructions are data-only contracts, applied by a deterministic
  executor

---

## Assumes

- WP-025 complete. Specifically:
  - `packages/game-engine/src/board/city.types.ts` exports `CityZone` (WP-015)
  - `packages/game-engine/src/board/boardKeywords.types.ts` exports
    `BoardKeyword`, `BOARD_KEYWORDS` (WP-025)
  - `G.cardKeywords` exists (WP-025) — keyword metadata resolved at setup
  - `packages/game-engine/src/rules/schemeHandlers.ts` exports
    `schemeTwistHandler` (WP-024)
  - `G.hookRegistry` contains scheme `HookDefinition` entries (WP-024)
  - `packages/game-engine/src/economy/economy.types.ts` exports `TurnEconomy`
    (WP-018)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Scheme card data does NOT yet include structured setup instruction metadata.
  For MVP:
  - `buildSchemeSetupInstructions()` MUST return an empty array (`[]`).
  - All instruction execution, typing, and ordering logic MUST be implemented
    and tested using synthetic instructions only.
  - No hard-coded scheme mappings are permitted.
  - A future WP will add structured registry metadata or an explicit mapping
    layer.
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" section
- A "Representation Before Execution" decision (D-2601) exists in
  `docs/ai/DECISIONS.md`

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Data
  Representation Before Execution". Scheme setup instructions follow
  this pattern: declarative data contracts first, deterministic execution
  applied by a setup-time executor.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Registry &
  Runtime Boundary". Scheme instruction data is resolved from the registry
  during `Game.setup()`. The instructions themselves are stored in `G` as
  data-only records. No registry access after setup.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Phase Sequence and Lifecycle
  Mapping". Setup instructions execute during the `setup` phase before
  transitioning to `play`. The `setup` phase is deterministic deck construction
  — scheme instructions extend this with board configuration.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — scheme setup
  is game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/board/city.types.ts` — read `CityZone`. Scheme
  instructions may modify City size — this must be handled carefully since
  `CityZone` is currently a fixed 5-tuple. Document the approach in DECISIONS.md.
- `packages/game-engine/src/board/boardKeywords.types.ts` — read `BoardKeyword`.
  Some schemes may add keywords to City cards or modify keyword behavior.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on scheme setup timing and on persistent modifier storage),
  Rule 8 (no `.reduce()`), Rule 13 (ESM only).

**Critical design note — scheme setup vs scheme twist:**
- Scheme **setup** instructions run once before the first turn (this packet)
- Scheme **twist** effects run each time a scheme twist is revealed (WP-024)
- These are separate mechanisms. Setup instructions configure the board;
  twist effects react to events during play.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — scheme setup is deterministic
- Never throw inside boardgame.io move functions — this packet adds no moves
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Registry boundary (hard rule): scheme instruction data resolved at setup
  time from registry via `registry: unknown` with local structural interface.
  No registry queries after setup. No import of `@legendary-arena/registry`.
- `SchemeSetupInstruction` is **data-only** — no functions, no closures.
  Fully JSON-serializable, per the "Representation Before Execution" decision.
- Scheme setup instructions execute **once** during the `setup` phase — never
  re-executed during moves
- Persistent modifiers are stored in `G` as plain data structures and read
  by existing gameplay logic (fights, reveals, movement)
- No hard-coded scheme logic — all behavior derives from declarative
  instruction data. If a scheme needs a new instruction type, add it to the
  union and document in DECISIONS.md.
- `SchemeSetupInstruction.type` is a **closed union** — adding a new type
  requires a `DECISIONS.md` entry
- MVP rule: while `CityZone` is a fixed tuple, `modifyCitySize` MUST log a
  warning to `G.messages`, perform NO mutation, and return `G` unchanged
- No `.reduce()` in instruction execution — use `for...of`
- WP-025 contract files (`boardKeywords.types.ts`) must not be modified
- WP-015 contract files (`city.types.ts`) modification may be required if
  City size changes — document the approach in DECISIONS.md
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **SchemeSetupInstruction type union (MVP):**
  `'modifyCitySize'` | `'addCityKeyword'` | `'addSchemeCounter'` | `'initialCityState'`

- **Timing:** Setup instructions execute during `setup` phase, after deck
  construction, before first turn

---

## Scope (In)

### A) `src/scheme/schemeSetup.types.ts` — new

- `interface SchemeSetupInstruction { type: SchemeSetupType; value: unknown }`
  — data-only, JSON-serializable
- `type SchemeSetupType = 'modifyCitySize' | 'addCityKeyword' | 'addSchemeCounter' | 'initialCityState'`
- `// why:` comment: scheme instructions follow the "Representation Before
  Execution" decision (D-2601) — data-only contracts applied by a deterministic
  executor at setup time

### B) `src/scheme/schemeSetup.execute.ts` — new

- `executeSchemeSetup(G: LegendaryGameState, instructions: SchemeSetupInstruction[]): LegendaryGameState`
  — deterministic executor:
  1. Iterate instructions with `for...of`
  2. For each instruction type:
     - `modifyCitySize`: **MVP: log warning and return `G` unchanged** while
       `CityZone` is a fixed tuple. Document approach in DECISIONS.md.
     - `addCityKeyword`: add a keyword to `G.cardKeywords` for specified cards
     - `addSchemeCounter`: initialize a new counter in `G.counters`
     - `initialCityState`: pre-populate City spaces with specified cards
  3. Unknown instruction types: log warning to `G.messages`, skip (never throw)
  - `// why:` comment on each instruction type handler
  - Returns updated `G` — pure function

### C) `src/setup/buildSchemeSetupInstructions.ts` — new

- `buildSchemeSetupInstructions(schemeId: CardExtId, registry: unknown): SchemeSetupInstruction[]`
  — called during `Game.setup()`:
  - Uses a **local structural interface** (e.g., `SchemeRegistryReader`) declared
    in the same file — must NOT import `@legendary-arena/registry` or
    `CardRegistry`
  - Must STOP and return `[]` if required registry fields are absent
  - **MVP behavior:** returns `[]` (empty array) for all schemes — structured
    metadata does not yet exist in the registry
  - Returns a list of declarative instructions
  - Uses `for...of` (no `.reduce()`)
  - `// why:` comment: same setup-time resolution pattern

### D) `src/setup/buildInitialGameState.ts` — modified

- After building villain deck, mastermind, card stats, etc.:
  - Call `buildSchemeSetupInstructions(config.schemeId, registry)`
  - Call `executeSchemeSetup(G, instructions)`
  - Store instructions as `G.schemeSetupInstructions` (for observability/replay)
  - `// why:` comment: scheme setup runs after base construction, before
    first turn

### E) `src/types.ts` — modified

- Add `schemeSetupInstructions: SchemeSetupInstruction[]` to
  `LegendaryGameState` (stores the instruction list — empty at MVP until
  structured metadata exists — for replay observability)
- Re-export `SchemeSetupInstruction`, `SchemeSetupType`

### F) `src/index.ts` — modified

- Export scheme setup types, builder, and executor

### G) Tests — `src/scheme/schemeSetup.execute.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Eight tests:
  1. `addSchemeCounter` initializes a new counter in `G.counters`
  2. `addCityKeyword` adds keyword to `G.cardKeywords`
  3. `initialCityState` pre-populates City spaces
  4. `modifyCitySize` logs warning and leaves City unchanged (MVP tuple constraint)
  5. Unknown instruction type: warning logged, no crash
  6. Empty instructions list: `G` returned unchanged
  7. Instructions execute in order (deterministic)
  8. `JSON.stringify(G)` succeeds after all instructions

---

## Out of Scope

- **No scheme twist execution** — WP-024 handles that
- **No scheme-specific scoring** — future packets
- **No scheme-specific endgame conditions** beyond what `G.counters` and
  `evaluateEndgame` already support
- **No dynamic scheme instructions** (instructions that change mid-game) —
  instructions execute once at setup
- **No hard-coded scheme logic** — all behavior is data-driven
- **No UI for scheme setup display**
- **No persistence / database access**
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/scheme/schemeSetup.types.ts` — **new** —
  SchemeSetupInstruction, SchemeSetupType
- `packages/game-engine/src/scheme/schemeSetup.execute.ts` — **new** —
  executeSchemeSetup
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts` — **new** —
  buildSchemeSetupInstructions
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  wire scheme setup into game setup
- `packages/game-engine/src/types.ts` — **modified** — add
  schemeSetupInstructions to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports
- `packages/game-engine/src/scheme/schemeSetup.execute.test.ts` — **new** —
  tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Setup Instruction Contract
- [ ] `SchemeSetupInstruction` is data-only, JSON-serializable
- [ ] `SchemeSetupType` union matches locked contract values
- [ ] `// why:` comment references the "Representation Before Execution"
      decision (D-2601)

### Instruction Execution
- [ ] `executeSchemeSetup` handles all 4 instruction types
- [ ] Unknown types log warning and skip (never throw)
- [ ] Execution is deterministic for identical inputs
- [ ] Instructions execute once during setup (not during moves)

### Setup Integration
- [ ] Scheme instructions built from registry at setup time
- [ ] No registry access after setup
      (confirmed with `Select-String`)
- [ ] `G.schemeSetupInstructions` stores the instruction list

### Pure Helpers
- [ ] `schemeSetup.execute.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in instruction execution
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover all 4 instruction types + unknown type
- [ ] Tests confirm deterministic ordering
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-025 contracts (`boardKeywords.types.ts`) not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding scheme setup
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in scheme setup
Select-String -Path "packages\game-engine\src\scheme\schemeSetup.execute.ts","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in execution file
Select-String -Path "packages\game-engine\src\scheme\schemeSetup.execute.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\scheme","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm WP-025 contracts not modified
git diff --name-only packages/game-engine/src/board/boardKeywords.types.ts
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\scheme","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "require(" -Recurse
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
- [ ] No boardgame.io import in scheme setup files
      (confirmed with `Select-String`)
- [ ] No registry import in execution file (confirmed with `Select-String`)
- [ ] No `.reduce()` in scheme files (confirmed with `Select-String`)
- [ ] WP-025 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — scheme setup instructions work; City can
      be modified by schemes before first turn; Phase 5 is complete
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why scheme setup is
      separate from scheme twist (setup = board config, twist = event
      reaction); how City size modification is handled (tuple vs dynamic);
      what MVP simplifications were made for instruction types
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.schemeSetupInstructions` to
      the Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-026 checked off with today's date
