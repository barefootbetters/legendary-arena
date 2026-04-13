# WP-019 — Mastermind Fight & Tactics (Minimal MVP)

**Status:** Ready  
**Primary Layer:** Game Engine / Boss Fight  
**Dependencies:** WP-018

---

## Session Context

WP-018 introduced the attack/recruit point economy with `G.turnEconomy`,
`G.cardStats` (resolved at setup from registry), and the `parseCardStatValue`
parser. WP-010 established the endgame evaluator with
`ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`. This packet adds the mastermind
state, tactics deck, and a `fightMastermind` move that defeats one tactic per
successful fight and triggers the victory condition when all tactics are
defeated. WP-020 will add VP scoring; this packet handles combat resolution
only.

---

## Goal

Introduce a deterministic mastermind and tactics model with a minimal boss
fight action. After this session:

- `G.mastermind` exists with the selected mastermind's identity, tactics deck,
  and defeated tactics list
- Tactics deck is constructed and shuffled deterministically at setup from
  registry data (same pattern as `G.villainDeckCardTypes` and `G.cardStats`)
- `fightMastermind` move validates available attack points against the
  mastermind's fight requirement (`G.cardStats[baseCardId].fightCost`,
  derived from `vAttack` at setup), defeats the top tactic, and checks
  for victory
- When all tactics are defeated,
  `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]` is set to 1,
  triggering the endgame evaluator from WP-010
- `vAttack` parsing reuses `parseCardStatValue` from WP-018 — no new parser

---

## Assumes

- WP-018 complete. Specifically:
  - `packages/game-engine/src/economy/economy.logic.ts` exports
    `parseCardStatValue`, `getAvailableAttack`, `spendAttack` (WP-018)
  - `packages/game-engine/src/economy/economy.types.ts` exports `TurnEconomy`,
    `CardStatEntry` (WP-018)
  - `G.turnEconomy` and `G.cardStats` exist in `LegendaryGameState` (WP-018)
  - `G.cardStats` includes parsed stat values for heroes, villains, and
    henchmen resolved at setup (WP-018). **Mastermind cards are NOT yet in
    `G.cardStats`** — WP-019's `buildMastermindState` must add the mastermind
    base card entry during setup so that `fightMastermind` can read
    `G.cardStats[baseCardId].fightCost`
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `ENDGAME_CONDITIONS` with `MASTERMIND_DEFEATED` key (WP-010)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `packages/game-engine/src/moves/coreMoves.gating.ts` exports
    `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage` (WP-008A,
    updated by WP-016)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/setup/shuffle.ts` exports `shuffleDeck` (WP-005B)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Mastermind card data includes `cards` array with `tactic: boolean` flag and
  `vAttack: string | number` — per ARCHITECTURE.md "Card Field Data Quality"
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Field Data Quality".
  `vAttack` is `string | number` — parsed by `parseCardStatValue` (WP-018).
  Mastermind `vAttack` values like `"8+"` parse to base integer `8`.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Data Flow: Registry into
  Game Engine". Mastermind card data is resolved at setup time. The mastermind's
  `vAttack` is parsed by `parseCardStatValue` and stored in `G.cardStats` as
  `fightCost` by `buildMastermindState` (same pattern as `buildCardStats` for
  villains). Moves read `G.cardStats`, never the registry.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract".
  `fightMastermind` follows the exact three-step sequence: validate args, check
  stage gate, mutate G. Never throws.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "G.counters Key Conventions".
  Victory is triggered by incrementing
  `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]`. Use the constant, never
  the string literal `'mastermindDefeated'`.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — mastermind
  logic is game-engine layer only. No server, registry, persistence, or UI.
- `packages/game-engine/src/economy/economy.logic.ts` — read
  `parseCardStatValue`, `getAvailableAttack`, `spendAttack`. Reuse these for
  mastermind fight validation — do not create a separate `parseVAttack`.
- `packages/game-engine/src/endgame/endgame.types.ts` — read
  `ENDGAME_CONDITIONS`. The `MASTERMIND_DEFEATED` counter triggers victory.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `tacticsDefeated` not `tacDef`), Rule 6 (`// why:` on the single-tactic-
  per-fight MVP simplification), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
  (specifically `shuffleDeck` from WP-005B for tactics deck)
- Never throw inside boardgame.io move functions — return void on invalid input
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
- Registry boundary (hard rule): the game engine must NOT import
  `@legendary-arena/registry` at module scope. Registry data is provided to setup
  as a parameter (`matchData`) and is used only during setup-time helpers such as
  `buildMastermindState`. Moves must never query the registry.
- Mastermind `vAttack` requirement is read from
  `G.cardStats[G.mastermind.baseCardId].fightCost` — the mastermind base card
  entry is added to `G.cardStats` by `buildMastermindState` at setup time using
  WP-018's `parseCardStatValue`. The `fightCost` field (not `attack`) is used
  because `vAttack` is a fight requirement, per WP-018 D-1805. Do NOT create a
  separate parser or store `requiredAttack` in `G.mastermind`.
- Victory counter uses `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` constant —
  never the string literal `'mastermindDefeated'`
- `fightMastermind` follows the three-step validation contract exactly
- `fightMastermind` is gated to `main` stage only
- MVP: one tactic defeated per successful fight (no multi-tactic or conditional
  defeat). `// why:` comment required.
- MVP: no tactic text effects — tactic cards are defeated and moved to
  `tacticsDefeated`, nothing else happens. Tactic abilities are WP-024.
- Tactics deck is shuffled at setup using `shuffleDeck(tacticExtIds, ctx)` —
  never `Math.random()`
- Move functions return void (boardgame.io contract). Structured error results
  may be returned from validators, but the move itself never returns `MoveResult`.
- `MoveResult` / `MoveError` reused from WP-008A validators — no new error types
- WP-018 contract files (`economy.types.ts`, `economy.logic.ts`) must not be
  modified — only imported and used
- Tests use `makeMockCtx` — no `boardgame.io` imports in test files

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **ENDGAME_CONDITIONS keys** (victory trigger):
  `MASTERMIND_DEFEATED = 'mastermindDefeated'`

- **MatchSetupConfig field** (mastermind selection):
  `mastermindId`

- **Mastermind card data** (from registry, resolved at setup):
  `tactic: boolean` — `true` = tactic card, `false` = mastermind base/epic card
  `vAttack: string | number` — fight requirement, parsed via `parseCardStatValue`

- **New LegendaryGameState field:**
  `mastermind: MastermindState`

- **MastermindState shape:**
  ```
  {
    id: CardExtId           // mastermind ext_id from MatchSetupConfig
    baseCardId: CardExtId   // the mastermind's non-tactic card ext_id
    tacticsDeck: CardExtId[]     // shuffled at setup, drawn from top
    tacticsDefeated: CardExtId[] // append-only on successful fight
  }
  ```

---

## Scope (In)

### A) `src/mastermind/mastermind.types.ts` — new

- ```ts
  interface MastermindState {
    id: CardExtId
    baseCardId: CardExtId
    tacticsDeck: CardExtId[]
    tacticsDefeated: CardExtId[]
  }
  ```
- `// why:` comments:
  - `id` is the mastermind identity selected in `MatchSetupConfig` and is used
    for configuration and reference only.
  - `baseCardId` is the ONLY card ID used to look up stats in `G.cardStats`
    (e.g., fight requirement). All combat validation reads
    `G.cardStats[baseCardId].fightCost` (per WP-018 D-1805).
  - Tactic card IDs in `tacticsDeck` / `tacticsDefeated` NEVER participate in
    stat lookup and never carry combat values in MVP.
  - `tacticsDeck` is drawn from index 0; `tacticsDefeated` is append-only.
  - All fields are deterministic and JSON-serializable.

### B) `src/mastermind/mastermind.setup.ts` — new

- `buildMastermindState(mastermindId: CardExtId, registry: unknown, ctx: SetupContext, cardStats: Record<CardExtId, CardStatEntry>): MastermindState`
  — called during `Game.setup()`:
  1. Resolve mastermind from registry using `mastermindId` (via `getSet()`,
     same pattern as `buildVillainDeck` and `buildCardStats`)
  2. Identify exactly one base card (`tactic === false`). This base card's
     `ext_id` is stored as `baseCardId` and is the sole key used later for stat
     lookup via `G.cardStats[baseCardId].fightCost`. Tactic cards
     (`tactic === true`) are collected ONLY for `tacticsDeck` ordering and
     defeat tracking; they never participate in stat lookup.
  3. **Add mastermind base card to `cardStats`** — parse the base card's
     `vAttack` via `parseCardStatValue` and store as:
     `cardStats[baseCardId] = { attack: 0, recruit: 0, cost: 0, fightCost: parsedVAttack }`
     — same semantics as villains/henchmen in WP-018 (D-1805: `fightCost`
     is for fight requirements, not attack generation)
  4. Build `tacticsDeck` from tactic ext_ids, shuffle via `shuffleDeck(tacticExtIds, ctx)`
  5. Return `{ id: mastermindId, baseCardId, tacticsDeck: shuffled, tacticsDefeated: [] }`
  - Uses `for...of` to classify cards (no `.reduce()`)
  - `// why:` comment on shuffle call
  - `// why:` comment on cardStats addition: mastermind fight cost resolved at
    setup so fightMastermind can read G.cardStats[baseCardId].fightCost
    without registry access
  - Accepts `registry: unknown` with runtime type guard (same pattern as
    `buildVillainDeck` and `buildCardStats`)

### C) `src/mastermind/mastermind.logic.ts` — new

- `defeatTopTactic(mastermindState: MastermindState): MastermindState`
  — pure function:
  1. If `tacticsDeck` is empty: return unchanged (no tactic to defeat)
  2. Remove top card from `tacticsDeck` (index 0)
  3. Append to `tacticsDefeated`
  4. Return new `MastermindState` (never mutate input)

- `areAllTacticsDefeated(mastermindState: MastermindState): boolean`
  — returns `true` if `tacticsDeck.length === 0` and `tacticsDefeated.length > 0`

- Pure helpers, no boardgame.io import

### D) `src/moves/fightMastermind.ts` — new

- `fightMastermind(G, ctx): void`
  — move implementation following three-step contract:
  1. **Validate**: check `G.mastermind.tacticsDeck.length > 0` (tactics remain);
     look up mastermind fight cost via
     `G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0`
     — `// why:` `baseCardId` is the canonical stats key; `fightCost` is the
     fight requirement field per WP-018 D-1805; never use `G.mastermind.id`
     or any tactic card ID for stat lookup;
     check `getAvailableAttack(G.turnEconomy) >= requiredFightCost`
  2. **Stage gate**: `if (G.currentStage !== 'main') return;`
     — internal gating, same pattern as `fightVillain` and `recruitHero`
     (non-core moves gate internally per WP-014A precedent)
  3. **Mutate G**:
     - `G.mastermind = defeatTopTactic(G.mastermind)`
     - `G.turnEconomy = spendAttack(G.turnEconomy, requiredFightCost)`
     - Push message to `G.messages`
     - If `areAllTacticsDefeated(G.mastermind)`:
       `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1`
       — `// why:` comment: this triggers the endgame evaluator from WP-010
  - Returns void; never throws
  - `// why:` comment: MVP defeats exactly 1 tactic per fight; multi-tactic
    defeat and tactic text effects are WP-024

### E) `src/setup/buildInitialGameState.ts` — modified

- Call `buildMastermindState(config.mastermindId, registry, context, cardStats)`
  **after** `buildCardStats` (so the existing `cardStats` record is passed in
  and the mastermind base card entry is added to it)
- Store result as `G.mastermind`

### F) `src/game.ts` — modified

- Register `fightMastermind` in the `play` phase moves

### G) `src/types.ts` — modified

- Add `mastermind: MastermindState` to `LegendaryGameState`
- Re-export `MastermindState`

### H) `src/index.ts` — modified

- Export `MastermindState`, `buildMastermindState`, `defeatTopTactic`,
  `areAllTacticsDefeated`, `fightMastermind`

### I) Tests — `src/mastermind/mastermind.setup.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Five tests:
  1. `buildMastermindState` produces a non-empty `tacticsDeck`
  2. `baseCardId` corresponds to a card with `tactic === false`
  3. All cards in `tacticsDeck` are tactic cards
  4. `tacticsDeck` is shuffled (makeMockCtx reverses — order differs from input)
  5. `JSON.stringify(mastermindState)` succeeds

### J) Tests — `src/mastermind/mastermind.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Five tests:
  1. `defeatTopTactic` removes first card from `tacticsDeck` and appends to
     `tacticsDefeated`
  2. `defeatTopTactic` on empty `tacticsDeck`: returns unchanged
  3. `areAllTacticsDefeated` returns `true` when deck empty + defeated non-empty
  4. `areAllTacticsDefeated` returns `false` when deck has cards
  5. `defeatTopTactic` returns new object (input not mutated)

### K) Tests — `src/moves/fightMastermind.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Six tests:
  1. Successful fight defeats top tactic and spends attack
  2. Insufficient attack: no G mutation
  3. No tactics remaining: no G mutation
  4. Wrong stage (`cleanup`): no G mutation
  5. All tactics defeated: `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]`
     is set to 1
  6. `JSON.stringify(G)` succeeds after fight

---

## Out of Scope

- **No tactic text effects** — WP-024 executes tactic abilities
- **No VP scoring on tactic defeat** — WP-020
- **No scheme overrides or scheme-specific mastermind behavior** — WP-024/026
- **No keyword timing windows** — WP-025
- **No conditional bonuses** — WP-023
- **No epic mastermind handling** — future packet (MVP uses base mastermind only)
- **No difficulty or balance tuning** — values come from card data
- **No UI or animation behavior**
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.types.ts` — **new** —
  MastermindState type
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — **new** —
  buildMastermindState
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — **new** —
  defeatTopTactic, areAllTacticsDefeated
- `packages/game-engine/src/moves/fightMastermind.ts` — **new** —
  fightMastermind move (internal stage gating, same pattern as fightVillain)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  build mastermind state at setup
- `packages/game-engine/src/game.ts` — **modified** — register fightMastermind
  in play phase
- `packages/game-engine/src/types.ts` — **modified** — add mastermind to
  LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — export mastermind types
  and helpers
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` — **new** —
  setup tests
- `packages/game-engine/src/mastermind/mastermind.logic.test.ts` — **new** —
  pure logic tests
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **new** — move
  integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Mastermind State
- [ ] `G.mastermind` exists with `id`, `baseCardId`, `tacticsDeck`,
      `tacticsDefeated` — all `CardExtId` or `CardExtId[]`
- [ ] All fields are JSON-serializable (no Maps, Sets, functions)
- [ ] `tacticsDeck` is shuffled at setup (makeMockCtx reverses — test confirms)

### Tactics Resolution
- [ ] `defeatTopTactic` removes from `tacticsDeck[0]` and appends to
      `tacticsDefeated`
- [ ] `defeatTopTactic` returns new object (input not mutated)
- [ ] `areAllTacticsDefeated` returns `true` only when deck empty + defeated
      non-empty

### fightMastermind Move
- [ ] Follows three-step contract (validate, gate, mutate)
- [ ] Validates available attack against `G.cardStats[baseCardId].fightCost`
- [ ] Insufficient attack: returns void (no throw, no mutation)
- [ ] Gated to `main` stage only
- [ ] On success: defeats tactic, spends attack, pushes message
- [ ] All tactics defeated: sets
      `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1`
      — uses constant, not string literal (confirmed with `Select-String`)
- [ ] `// why:` comment on 1-tactic-per-fight MVP simplification

### Stage Gating
- [ ] `fightMastermind` uses internal stage gating:
      `if (G.currentStage !== 'main') return;` with `// why:` comment
      (same pattern as `fightVillain` and `recruitHero`)
- [ ] `coreMoves.gating.ts` NOT modified (non-core moves gate internally)
- [ ] No `CORE_MOVE_NAMES` update required for `fightMastermind`

### Pure Helpers
- [ ] `mastermind.logic.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in any new file (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Setup test confirms tactics are shuffled
- [ ] Logic test confirms defeat removes from deck and appends to defeated
- [ ] Move test confirms victory counter set when all tactics defeated
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] WP-018 contract files (`economy.types.ts`, `economy.logic.ts`) not
      modified (confirmed with `git diff --name-only`)
- [ ] No tactic text effects implemented
- [ ] No VP scoring implemented
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding mastermind
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm ENDGAME_CONDITIONS constant usage (not string literal)
Select-String -Path "packages\game-engine\src\moves\fightMastermind.ts" -Pattern "ENDGAME_CONDITIONS"
# Expected: at least one match

Select-String -Path "packages\game-engine\src\moves\fightMastermind.ts" -Pattern "'mastermindDefeated'"
# Expected: no output (string literal forbidden)

# Step 4 — confirm no boardgame.io import in pure helpers
Select-String -Path "packages\game-engine\src\mastermind\mastermind.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — confirm no .reduce() in new files
Select-String -Path "packages\game-engine\src\mastermind" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\mastermind" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 7 — confirm internal stage gating in fightMastermind
Select-String -Path "packages\game-engine\src\moves\fightMastermind.ts" -Pattern "currentStage.*main"
# Expected: at least one match

# Step 7b — confirm coreMoves.gating.ts NOT modified
git diff --name-only packages/game-engine/src/moves/coreMoves.gating.ts
# Expected: no output

# Step 8 — confirm WP-018 contracts not modified
git diff --name-only packages/game-engine/src/economy/economy.types.ts packages/game-engine/src/economy/economy.logic.ts
# Expected: no output

# Step 9 — confirm no files outside scope were changed
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
- [ ] `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` used (not string literal)
      (confirmed with `Select-String`)
- [ ] No boardgame.io import in pure helpers
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in new files (confirmed with `Select-String`)
- [ ] No `Math.random` in new files (confirmed with `Select-String`)
- [ ] WP-018 contracts not modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — mastermind fight exists; defeating all
      tactics triggers victory; the full MVP combat loop is now functional
      (play cards -> fight villains -> fight mastermind -> win)
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why MVP defeats 1 tactic
      per fight (simplification); why `vAttack` is read from `G.cardStats`
      (reuses WP-018 pattern); why no tactic text effects (WP-024)
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.mastermind` to the Field
      Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-019 checked off with today's date
