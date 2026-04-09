# WP-018 — Attack & Recruit Point Economy (Minimal MVP)

**Status:** Ready
**Primary Layer:** Game Engine / Economy
**Dependencies:** WP-017

---

## Session Context

WP-016 introduced `fightVillain` and `recruitHero` moves that always succeed
(no resource checking). WP-017 added KO, wounds, and bystander capture. This
packet gates fight and recruit behind deterministic resource requirements:
playing hero cards produces attack and recruit points, fighting costs attack
points, and recruiting costs recruit points. WP-019 will add mastermind
fight mechanics; WP-022 will add keyword-driven conditional effects. This
packet handles base numeric values only.

---

## Goal

Introduce a deterministic per-turn attack/recruit point economy. After this
session:

- `G.turnEconomy` tracks accumulated and spent attack/recruit points per turn
- Playing a hero card adds its parsed `attack` and `recruit` values to the
  economy (base integer values only — no conditional bonuses)
- `fightVillain` requires sufficient unspent attack points and records the spend
- `recruitHero` requires sufficient unspent recruit points and records the spend
- A deterministic parser converts string stat values (`"2+"`, `"0+"`, `null`)
  to integer base values
- Card stat values are resolved at setup time and stored in a lookup in `G` —
  moves never query the registry
- Economy resets to zero at the start of each player turn
- All calculations are deterministic, order-defined, and free of I/O

---

## Assumes

- WP-017 complete. Specifically:
  - `packages/game-engine/src/moves/fightVillain.ts` exports `fightVillain`
    (WP-016, modified by WP-017)
  - `packages/game-engine/src/moves/recruitHero.ts` exports `recruitHero`
    (WP-016)
  - `G.city` and `G.hq` exist (WP-015)
  - `G.villainDeckCardTypes` exists (WP-014) — pattern for setup-time card
    data storage
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- Card data includes `attack: string | number | null`, `recruit: string | number | null`,
  `cost: string | number | undefined` per ARCHITECTURE.md "Card Field Data
  Quality" and WP-003
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Field Data Quality". Hero
  card numeric fields (`cost`, `attack`, `recruit`) are `string | number | undefined`.
  The parser in this packet must handle `"2+"`, `"2*"`, integers, and null.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Data Flow: Registry into
  Game Engine". The registry is available at setup time only. Card stat values
  must be resolved during `Game.setup()` and stored in `G` so moves can look
  them up without registry access. This follows the same pattern as
  `G.villainDeckCardTypes` from WP-014.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract".
  Fight and recruit validation now includes resource checking as part of
  step 1 (validate args). Insufficient resources = return void (never throw).
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — economy logic
  is game-engine layer only. No server, registry, persistence, or UI concerns.
  The registry is NOT available at move time.
- `packages/game-engine/src/moves/fightVillain.ts` — read it entirely. This
  packet adds attack point validation before the existing fight logic.
- `packages/game-engine/src/moves/recruitHero.ts` — read it entirely. This
  packet adds recruit point validation before the existing recruit logic.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `parsedAttackValue` not `atk`), Rule 6 (`// why:` on the string parser
  and on the setup-time card stat storage), Rule 8 (no `.reduce()`), Rule 11
  (full-sentence error messages for insufficient resources), Rule 13 (ESM only).

**Critical design note — registry boundary:**
Moves receive only `(G, ctx, args)`. The registry is loaded at server startup
and passed into `Game.setup()`. To make card stats available at move time,
this packet builds a `G.cardStats: Record<CardExtId, { attack: number; recruit: number; cost: number }>` lookup during setup — the same pattern as
`G.villainDeckCardTypes`. Moves read from `G.cardStats`, never from the registry.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
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
- **Registry boundary**: moves must NOT access the registry. Card stats are
  resolved at setup time and stored in `G.cardStats`. This is the same pattern
  as `G.villainDeckCardTypes` (WP-014).
- Economy parser is a **pure helper** — no boardgame.io import in
  `economy.logic.ts`
- Parser never throws: unexpected input returns `0` and emits a deterministic
  warning to `G.messages`
- `G.turnEconomy` values are integers >= 0
- Economy resets at start of each player turn (wired into `play` phase
  `onBegin` or turn start lifecycle)
- `MoveResult` / `MoveError` reused from WP-008A — no new error types
- Insufficient resources = move returns void silently (not a thrown error)
- No `.reduce()` in economy calculations — use explicit loops
- No conditional bonuses, no keyword effects, no `"+"` modifier logic beyond
  stripping the `+` character — base integer only
- `vAttack` parsing for villain fight requirements uses the same parser; villain
  `vAttack` values are resolved at setup time into `G.cardStats`
- WP-016 and WP-017 contract files (`fightVillain.ts`, `recruitHero.ts`) are
  modified, not replaced — the three-step validation contract is preserved with
  resource checking added to step 1
- Tests use `makeMockCtx` — no `boardgame.io` imports in test files

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **Card field types** (from WP-003, ARCHITECTURE.md):
  `cost`: `string | number | undefined`
  `attack`: `string | number | null`
  `recruit`: `string | number | null`
  `vAttack`: `string | number`

- **Parsing rule** (ARCHITECTURE.md "Card Field Data Quality"):
  Strip trailing `+` or `*`, parse integer base. Unexpected input returns `0`.

- **New LegendaryGameState fields:**
  `turnEconomy: { attack: number; recruit: number; spentAttack: number; spentRecruit: number }`
  `cardStats: Record<CardExtId, { attack: number; recruit: number; cost: number }>`

---

## Scope (In)

### A) `src/economy/economy.types.ts` — new

- `interface TurnEconomy { attack: number; recruit: number; spentAttack: number; spentRecruit: number }`
- `interface CardStatEntry { attack: number; recruit: number; cost: number }`
- `// why:` comment on `CardStatEntry`: resolved at setup time from registry
  so moves can read card stats without registry access

### B) `src/economy/economy.logic.ts` — new

- `parseCardStatValue(value: string | number | null | undefined): number`
  — deterministic parser:
  - `null` or `undefined` -> `0`
  - `number` -> return as-is (floor to integer)
  - `string` -> strip trailing `+` or `*`, parse integer. If unparseable,
    return `0`
  - Never throws
  - `// why:` comment referencing ARCHITECTURE.md "Card Field Data Quality"

- `buildCardStats(registry: CardRegistry, matchConfig: MatchSetupConfig): Record<CardExtId, CardStatEntry>`
  — called during `Game.setup()`:
  - Iterates all hero cards in selected hero decks
  - Iterates all villain/henchman cards in selected groups
  - Parses `attack`, `recruit`, `cost`, `vAttack` using `parseCardStatValue`
  - Returns a flat lookup keyed by `CardExtId`
  - Uses `for...of` loops (no `.reduce()`)
  - `// why:` comment: same pattern as `G.villainDeckCardTypes` — registry
    data resolved at setup so moves never query registry

- `getAvailableAttack(economy: TurnEconomy): number`
  — returns `economy.attack - economy.spentAttack`

- `getAvailableRecruit(economy: TurnEconomy): number`
  — returns `economy.recruit - economy.spentRecruit`

- `addResources(economy: TurnEconomy, attack: number, recruit: number): TurnEconomy`
  — returns new object with added values

- `spendAttack(economy: TurnEconomy, amount: number): TurnEconomy`
  — returns new object with incremented `spentAttack`

- `spendRecruit(economy: TurnEconomy, amount: number): TurnEconomy`
  — returns new object with incremented `spentRecruit`

- `resetTurnEconomy(): TurnEconomy`
  — returns `{ attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 }`

- Pure helpers, no boardgame.io import

### C) `src/moves/playCard` path — modified

- After existing playCard logic places the card in `inPlay`:
  - Look up card stats via `G.cardStats[cardId]`
  - Call `addResources(G.turnEconomy, stats.attack, stats.recruit)`
  - Update `G.turnEconomy`
  - `// why:` comment: MVP adds base values only; conditional bonuses are WP-022

### D) `src/moves/fightVillain.ts` — modified

- In step 1 (validate args), after existing checks:
  - Look up villain's required attack via `G.cardStats[villainCardId]?.attack`
    (default to 0 if not found)
  - Check `getAvailableAttack(G.turnEconomy) >= requiredAttack`
  - If insufficient: return void (never throw)
  - `// why:` comment on structured error message for insufficient attack
- In step 3 (mutate G), after existing fight logic:
  - Call `spendAttack(G.turnEconomy, requiredAttack)`
  - Update `G.turnEconomy`

### E) `src/moves/recruitHero.ts` — modified

- In step 1 (validate args), after existing checks:
  - Look up hero's cost via `G.cardStats[heroCardId]?.cost` (default to 0)
  - Check `getAvailableRecruit(G.turnEconomy) >= requiredCost`
  - If insufficient: return void (never throw)
  - `// why:` comment on structured error message for insufficient recruit
- In step 3 (mutate G), after existing recruit logic:
  - Call `spendRecruit(G.turnEconomy, requiredCost)`
  - Update `G.turnEconomy`

### F) `src/setup/buildInitialGameState.ts` — modified

- Call `buildCardStats(registry, matchConfig)` and store as `G.cardStats`
- Initialize `G.turnEconomy = resetTurnEconomy()`

### G) `src/game.ts` — modified

- Wire `resetTurnEconomy()` into `play` phase turn start (`turn.onBegin`):
  `G.turnEconomy = resetTurnEconomy()`

### H) `src/types.ts` — modified

- Add `turnEconomy: TurnEconomy` and `cardStats: Record<CardExtId, CardStatEntry>`
  to `LegendaryGameState`

### I) `src/index.ts` — modified

- Export economy types and helpers

### J) Tests — `src/economy/economy.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Eight tests:
  1. `parseCardStatValue("2+")` returns `2`
  2. `parseCardStatValue("0+")` returns `0`
  3. `parseCardStatValue(null)` returns `0`
  4. `parseCardStatValue("2*")` returns `2`
  5. `parseCardStatValue(3)` returns `3`
  6. `parseCardStatValue("garbage")` returns `0`
  7. `addResources` returns new object with correct totals
  8. `resetTurnEconomy` returns all zeros

### K) Tests — `src/economy/economy.integration.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Seven tests:
  1. Playing a hero card increases `G.turnEconomy.attack` and `.recruit`
  2. Fight with sufficient attack succeeds and increments `spentAttack`
  3. Fight with insufficient attack: no G mutation
  4. Recruit with sufficient recruit succeeds and increments `spentRecruit`
  5. Recruit with insufficient recruit: no G mutation
  6. Turn reset clears all economy values
  7. `JSON.stringify(G)` succeeds after play + fight + recruit cycle

---

## Out of Scope

- **No conditional bonuses** (`"2+"` modifier means base 2, not "2 plus
  something") — WP-022 adds keyword-driven conditional effects
- **No team/color synergy bonuses** — WP-023
- **No cost reductions** — future packets
- **No tokens, modifiers, or carry-over effects** — future packets
- **No VP scoring on fight** — WP-020
- **No mastermind fight** — WP-019 (uses the same economy but different
  resolution)
- **No HQ refill after recruit** — separate concern; document in DECISIONS.md
  if a decision is needed
- **No balance tuning** — values come from card data as-is
- **No UI display of economy values** — UI layer, not engine
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/economy/economy.types.ts` — **new** — TurnEconomy,
  CardStatEntry types
- `packages/game-engine/src/economy/economy.logic.ts` — **new** — parser,
  buildCardStats, resource helpers, reset
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — add attack
  point validation and spend
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** — add recruit
  point validation and spend
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — playCard
  adds resources to economy
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  build cardStats and initialize turnEconomy
- `packages/game-engine/src/game.ts` — **modified** — wire economy reset into
  turn start
- `packages/game-engine/src/types.ts` — **modified** — add turnEconomy and
  cardStats to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — export economy types
  and helpers
- `packages/game-engine/src/economy/economy.logic.test.ts` — **new** — parser
  and helper unit tests
- `packages/game-engine/src/economy/economy.integration.test.ts` — **new** —
  play-fight-recruit integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Economy State
- [ ] `G.turnEconomy` exists with `attack`, `recruit`, `spentAttack`,
      `spentRecruit` (all integers >= 0)
- [ ] Economy resets at start of each player turn
- [ ] `JSON.stringify(G)` succeeds after economy operations

### Card Stats Lookup
- [ ] `G.cardStats` exists as `Record<CardExtId, CardStatEntry>`
- [ ] Built at setup time from registry — moves never query registry
- [ ] `// why:` comment on setup-time resolution pattern

### Parser
- [ ] `"2+"` parses to `2`; `"0+"` to `0`; `null` to `0`; `"2*"` to `2`
- [ ] Unexpected strings return `0` without throwing
- [ ] Parser is a pure function — no boardgame.io import
      (confirmed with `Select-String`)

### Resource Gating
- [ ] `fightVillain` fails silently (return void) when attack insufficient
- [ ] `fightVillain` succeeds and increments `spentAttack` when sufficient
- [ ] `recruitHero` fails silently (return void) when recruit insufficient
- [ ] `recruitHero` succeeds and increments `spentRecruit` when sufficient
- [ ] Playing a hero card increases `turnEconomy.attack` and `.recruit`

### Pure Helpers
- [ ] `economy.logic.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in economy calculations
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Parser tests cover: `"2+"`, `"0+"`, `null`, `"2*"`, integer, garbage
- [ ] Integration tests cover: play->fight success, play->fight failure,
      play->recruit success, play->recruit failure, turn reset
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] No conditional bonuses or keyword effects implemented
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding economy
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in economy helpers
Select-String -Path "packages\game-engine\src\economy\economy.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in move files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() in economy logic
Select-String -Path "packages\game-engine\src\economy" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\economy" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 7 — confirm no throw in move files
Select-String -Path "packages\game-engine\src\moves\fightVillain.ts","packages\game-engine\src\moves\recruitHero.ts" -Pattern "throw "
# Expected: no output

# Step 8 — confirm no require() in generated files
Select-String -Path "packages\game-engine\src\economy" -Pattern "require(" -Recurse
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
- [ ] No boardgame.io import in `economy.logic.ts`
      (confirmed with `Select-String`)
- [ ] No registry import in move files (confirmed with `Select-String`)
- [ ] No `.reduce()` in economy files (confirmed with `Select-String`)
- [ ] No `Math.random` in new files (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — economy exists; fight and recruit are
      resource-gated; card stats resolved at setup time
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why card stats are stored
      in `G.cardStats` at setup time (registry boundary); why `"2+"` parses to
      base 2 only (conditional bonus is WP-022); why HQ refill is not in this
      packet
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.turnEconomy` and `G.cardStats`
      to the Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-018 checked off with today's date
