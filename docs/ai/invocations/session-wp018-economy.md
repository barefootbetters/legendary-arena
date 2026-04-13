# Session Execution Prompt — WP-018 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-018 — Attack & Recruit Point Economy (Minimal MVP)
**Mode:** Implementation (WP-018 not yet implemented)
**Pre-Flight:** Complete (2026-04-12) — build green (206 tests passing),
authority chain aligned, EC-018 `fightCost` omission corrected
**EC:** `docs/ai/execution-checklists/EC-018-economy.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-018 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §2 "Card Field Data Quality" (hero field types, modifier strings)
   - §2 "Card Data Flow: Registry into Game Engine"
   - §3 "Field Classification Reference"
   - §4 "Canonical Reveal -> Fight -> Side-Effect Ordering"
   - §4 "Move Validation Contract"
   - "Layer Boundary (Authoritative)"
3. `docs/ai/execution-checklists/EC-018-economy.checklist.md`
4. `docs/ai/work-packets/WP-018-attack-recruit-economy-minimal-mvp.md`
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 11 (full-sentence errors),
   13 (ESM only)

**Implementation anchors (patterns, not templates):**

7. `packages/game-engine/src/moves/coreMoves.impl.ts` — `playCard`
   three-step contract; economy increment inserts after step 3
8. `packages/game-engine/src/moves/fightVillain.ts` — preserve WP-016/17
   structure; attack validation inserts in step 1, spend in step 3
9. `packages/game-engine/src/moves/recruitHero.ts` — preserve WP-016
   structure; recruit validation inserts in step 1, spend in step 3
10. `packages/game-engine/src/setup/buildInitialGameState.ts` — add
    `cardStats` and `turnEconomy` to returned object
11. `packages/game-engine/src/game.ts` — `play.turn.onBegin` (economy
    reset belongs here)
12. `packages/game-engine/src/types.ts` — add fields to
    `LegendaryGameState`
13. `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — read
    `VillainDeckRegistryReader` interface and `VillainDeckFlatCard` type
    (~lines 30-96); `CardStatsRegistryReader` follows this exact pattern
    (local structural interface, never imports concrete registry types)

---

## Runtime Wiring Allowance (01.5)

WP-018 adds:
- `turnEconomy: TurnEconomy`
- `cardStats: Record<CardExtId, CardStatEntry>`

Permitted 01.5 edits:
- `buildInitialGameState.ts` — value-only additions + explicit WP-scope
  call to `buildCardStats`
- `buildInitialGameState.shape.test.ts` — value-only assertions for
  presence of new fields

**No behavior** may be introduced under 01.5 beyond restoring shape
correctness. `types.ts`, `game.ts`, and `index.ts` modifications are
explicitly in WP scope (not wiring allowance).

---

## Hard Stops (Stop Immediately If Any Occur)

Any of the following is a **STOP ��� report failure, do not continue**:

- Any `.reduce()` in new economy files
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any `throw` inside move functions (`playCard`, `fightVillain`,
  `recruitHero`) — moves return void on failure, never throw
- Any `@legendary-arena/registry` import in game-engine economy or move
  files
- Any `boardgame.io` import in economy logic/types or in new test files
- Mutate `G.turnEconomy` during reveal-time operations
  (`revealVillainCard` must not touch economy)
- Any edits to:
  - `coreMoves.types.ts`, `coreMoves.validate.ts`, `coreMoves.gating.ts`
  - WP-015 contract files (`city.types.ts`, `city.logic.ts`)
  - WP-017 helpers (`ko.logic.ts`, `wounds.logic.ts`,
    `bystanders.logic.ts`) unless strictly required by compilation
  - `makeMockCtx` or other shared test helpers
- Implement conditional bonuses, keyword effects, team/color synergy
- Implement VP scoring, mastermind fight, HQ refill, cost reductions
- Add new moves to `LegendaryGame.moves`
- Add new phases, stages, triggers, or effects
- Expand scope beyond WP-018 (no "while I'm here" improvements)
- Modify files not listed in WP-018 "Files Expected to Change" (except
  under 01.5 wiring allowance for `buildInitialGameState.shape.test.ts`)

---

## Implementation Tasks (Authoritative)

### A) Create `src/economy/economy.types.ts` (new)

```ts
export interface TurnEconomy {
  attack: number;
  recruit: number;
  spentAttack: number;
  spentRecruit: number;
}

// why: stats resolved at setup time from registry so moves never query
// registry at runtime — same pattern as G.villainDeckCardTypes (WP-014).
// Read-only after setup; only economy helpers may produce new values.
export interface CardStatEntry {
  attack: number;     // hero printed base attack (playCard adds to economy)
  recruit: number;    // hero printed base recruit (playCard adds to economy)
  cost: number;       // hero recruit cost (recruitHero validates spend)
  fightCost: number;  // villain/henchman fight requirement (from vAttack;
                      // fightVillain validates spend). Hero cards: 0.
}
```

**Rule:** All `CardStatEntry` fields and all `TurnEconomy` fields are
integers >= 0. The parser enforces this at setup time.

---

### B) Create `src/economy/economy.logic.ts` (new, pure helpers)

**No boardgame.io imports. No `.reduce()`. No throws.**

#### B1) `parseCardStatValue(value: string | number | null | undefined): number`

Rules:
- `null | undefined` -> `0`
- `number` -> `Math.floor(value)`, then clamp at `>= 0`
  (negative card data values are treated as `0`)
- `string` -> strip trailing `+` or `*`, parse integer; unparseable -> `0`
- Never throws

**Required comment:**
```ts
// why: ARCHITECTURE.md "Card Field Data Quality" — hero card fields
// contain modifier strings like "2+" and "2*"; strip modifier, parse
// integer base only. Conditional bonus semantics are WP-022.
```

#### B2) `CardStatsRegistryReader` (local structural interface)

Define a **minimal structural interface** that allows `buildCardStats` to
iterate cards and read their stat fields. Pattern: same as
`VillainDeckRegistryReader` in `villainDeck.setup.ts` (~line 89).

The interface must expose enough for `buildCardStats` to:
- Iterate hero cards in the selected hero decks
- Iterate villain and henchman cards in the selected groups
- Read `attack`, `recruit`, `cost`, `vAttack` fields from each card

**Important:** Do **not** guess the final shape. Derive it from the
existing registry access patterns — specifically `VillainDeckRegistryReader`
and `VillainDeckFlatCard`. The interface should expose `listCards()`
returning objects with at least `{ key: string; cardType: string }` plus
optional stat fields (`attack`, `recruit`, `cost`, `vAttack`). Keep it
as narrow as possible. Determine exact optional field types from registry
data.

**Must NOT import `CardRegistry` from `@legendary-arena/registry`.**
The real `CardRegistry` satisfies it structurally.

#### B3) `buildCardStats(registry, matchConfig): Record<CardExtId, CardStatEntry>`

Rules:
- Iterate **only** cards reachable from `matchConfig`:
  - hero cards in selected `heroDeckIds`
  - villains from selected `villainGroupIds`
  - henchmen from selected `henchmanGroupIds`
- Parse **hero** stats:
  - `attack` from card `attack` field
  - `recruit` from card `recruit` field
  - `cost` from card `cost` field
  - `fightCost = 0` (heroes are never fought)
- Parse **villain/henchman** stats:
  - `fightCost` from card `vAttack` field
  - `attack = 0`, `recruit = 0`, `cost = 0` (villains do not generate
    resources or have recruit costs)
- Return flat `Record<CardExtId, CardStatEntry>`
- Uses `for...of` loops only (no `.reduce()`)

**Required comment:**
```ts
// why: mirrors G.villainDeckCardTypes pattern — resolve registry data
// at setup so moves never query registry at runtime
```

#### B4) Economy helpers (all pure, return new objects)

```ts
getAvailableAttack(economy: TurnEconomy): number
// returns economy.attack - economy.spentAttack

getAvailableRecruit(economy: TurnEconomy): number
// returns economy.recruit - economy.spentRecruit

addResources(economy: TurnEconomy, attack: number, recruit: number): TurnEconomy
// returns new object with added values

spendAttack(economy: TurnEconomy, amount: number): TurnEconomy
// returns new object with incremented spentAttack

spendRecruit(economy: TurnEconomy, amount: number): TurnEconomy
// returns new object with incremented spentRecruit

resetTurnEconomy(): TurnEconomy
// returns { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 }
```

**Rule:** Spending must never make available negative — move validation
prevents overspend before `spendAttack`/`spendRecruit` are called.

Export all functions and the `CardStatsRegistryReader` interface.

---

### C) Modify `src/moves/coreMoves.impl.ts` (`playCard`)

After existing step 3 (hand -> inPlay), add economy increment:

1. `const stats = G.cardStats[args.cardId]`
2. If missing: treat as `{ attack: 0, recruit: 0 }` (fail-closed for
   non-hero cards like sidekicks, wounds)
3. `G.turnEconomy = addResources(G.turnEconomy, stats.attack, stats.recruit)`

**Required comment:**
```ts
// why: MVP adds base values only; conditional bonuses are WP-022
```

**Imports:** `addResources` from `../economy/economy.logic.js`

**Hard rule:** `playCard` must not throw, must preserve existing
three-step structure.

---

### D) Modify `src/moves/fightVillain.ts`

#### D1) Step 1 validation: enforce available attack

After existing `cityIndex` and `cardId` null checks, before step 2:

1. `const requiredFightCost = G.cardStats[cardId]?.fightCost ?? 0`
2. `const availableAttack = getAvailableAttack(G.turnEconomy)`
3. If `availableAttack < requiredFightCost`: `return;` (no side effects)

**Required comment:**
```ts
// why: silent failure preserves deterministic move contract — insufficient
// attack points means the fight cannot proceed
```

#### D2) Step 3 spend: after successful fight

After City removal + victory placement + bystander award (WP-017),
before message push:

1. `G.turnEconomy = spendAttack(G.turnEconomy, requiredFightCost)`

**Imports:** `getAvailableAttack`, `spendAttack` from
`../economy/economy.logic.js`

**Hard rule:** Do not reorder bystander award logic from WP-017. Add
resource checking to step 1 and spend to step 3 — do not reorganize or
refactor existing code.

---

### E) Modify `src/moves/recruitHero.ts`

#### E1) Step 1 validation: enforce available recruit

After existing `hqIndex` and `cardId` null checks, before step 2:

1. `const requiredCost = G.cardStats[cardId]?.cost ?? 0`
2. `const availableRecruit = getAvailableRecruit(G.turnEconomy)`
3. If `availableRecruit < requiredCost`: `return;` (no side effects)

**Required comment:**
```ts
// why: silent failure preserves deterministic move contract — insufficient
// recruit points means the recruit cannot proceed
```

#### E2) Step 3 spend: after successful recruit

After HQ removal + discard placement, before message push:

1. `G.turnEconomy = spendRecruit(G.turnEconomy, requiredCost)`

**Imports:** `getAvailableRecruit`, `spendRecruit` from
`../economy/economy.logic.js`

**Hard rule:** Preserve existing three-step structure. Do not reorganize
or refactor existing code.

---

### F) Modify `src/setup/buildInitialGameState.ts`

1. Import `buildCardStats` and `resetTurnEconomy` from
   `../economy/economy.logic.js`
2. Ensure `registry` satisfies `CardStatsRegistryReader` structurally
   (adjust interface if needed — do not import concrete registry types)
3. Add to the returned `LegendaryGameState` object:

```ts
// why: card stats resolved at setup from registry so moves never query
// registry at runtime — same pattern as G.villainDeckCardTypes (WP-014).
// Read-only after setup.
cardStats: buildCardStats(registry, config),
// why: economy starts at zero; reset again at each turn start
turnEconomy: resetTurnEconomy(),
```

---

### G) Modify `src/game.ts` — reset on turn start

In `play.turn.onBegin`, add economy reset **before** any rule hook
execution:

```ts
// why: economy resets at start of each player turn — accumulated and
// spent values from previous turn are cleared
G.turnEconomy = resetTurnEconomy();
```

**Import:** `resetTurnEconomy` from `./economy/economy.logic.js`

**Hard rule:** Reveal operations must never touch economy. Economy reset
must precede rule hook execution to ensure hooks observe a clean economy.

---

### H) Modify `src/types.ts` — add fields to `LegendaryGameState`

Add:

```ts
// why: per-turn attack/recruit point accumulation and spend tracking.
// Reset at start of each player turn. Values are integers >= 0.
/** Per-turn economy tracking (attack/recruit points accumulated and spent). */
turnEconomy: TurnEconomy;

// why: card stat values resolved at setup time from registry so moves
// can look up attack, recruit, cost, and fightCost without registry
// access — same pattern as G.villainDeckCardTypes (WP-014).
// Read-only after setup.
/** Card stat lookup keyed by CardExtId. Built at setup, read-only at runtime. */
cardStats: Record<CardExtId, CardStatEntry>;
```

**Imports:** `TurnEconomy`, `CardStatEntry` from
`./economy/economy.types.js`

---

### I) Modify `src/index.ts` — export types + helpers

Export:
- `TurnEconomy`, `CardStatEntry` from `./economy/economy.types.js`
- `parseCardStatValue`, `buildCardStats`, `getAvailableAttack`,
  `getAvailableRecruit`, `addResources`, `spendAttack`, `spendRecruit`,
  `resetTurnEconomy`, `CardStatsRegistryReader` from
  `./economy/economy.logic.js`

---

## Tests (17 Total — 2 New Files)

All test files: `node:test`, `node:assert`, `.test.ts` extension.
No boardgame.io imports. No modifications to `makeMockCtx`.

### J) `src/economy/economy.logic.test.ts` — 8 tests

1. `parseCardStatValue("2+")` returns `2`
2. `parseCardStatValue("0+")` returns `0`
3. `parseCardStatValue(null)` returns `0`
4. `parseCardStatValue("2*")` returns `2`
5. `parseCardStatValue(3)` returns `3`
6. `parseCardStatValue("garbage")` returns `0`
7. `addResources` returns new object with correct totals
8. `resetTurnEconomy` returns all zeros

### K) `src/economy/economy.integration.test.ts` — 9 tests

Uses `makeMockCtx` for `ctx`. Tests exercise the full play -> fight/recruit
flow with economy checking.

1. Playing a hero card increases `G.turnEconomy.attack` and `.recruit`
2. Fight with sufficient attack succeeds and increments `spentAttack`
3. Fight with insufficient attack: **no G mutation** — snapshot
   `G.city`, `G.playerZones[p].victory`, and `G.turnEconomy` before the
   call; assert all three are unchanged after
4. Recruit with sufficient recruit succeeds and increments `spentRecruit`
5. Recruit with insufficient recruit: **no G mutation** — snapshot
   `G.hq`, `G.playerZones[p].discard`, and `G.turnEconomy` before the
   call; assert all three are unchanged after
6. Turn reset clears all economy values
7. `JSON.stringify(G)` succeeds after play + fight + recruit cycle
8. Reveal does not mutate economy: call `revealVillainCard` with non-zero
   economy values, assert `G.turnEconomy` unchanged
9. Playing a card not in `G.cardStats` contributes 0/0 (non-hero edge case)

**Test scaffolding notes:**
- Integration tests must construct a `G` with `turnEconomy` and `cardStats`
  pre-populated (not via full `buildInitialGameState` — construct minimal
  state directly)
- For tests 2-5: pre-set `G.turnEconomy` with known values, then call the
  move and assert economy changes (or absence of changes)
- For test 8: pre-set `G.turnEconomy` to non-zero, call
  `revealVillainCard`, assert economy unchanged
- `G.cardStats` test entries should have known attack/recruit/cost/fightCost
  values that make assertions obvious

---

## Wiring: `buildInitialGameState.shape.test.ts` (01.5)

If the existing "G has all required top-level keys" test fails after adding
`turnEconomy` and `cardStats` to `LegendaryGameState`, add value-only
assertions:

```ts
assert.ok(gameState.turnEconomy !== undefined, 'G must have turnEconomy');
assert.ok(gameState.cardStats !== undefined, 'G must have cardStats');
```

No new test cases. No new logic.

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass, 0 fail

# Step 3 — no boardgame.io import in economy helpers
grep -l "boardgame.io" packages/game-engine/src/economy/economy.logic.ts packages/game-engine/src/economy/economy.types.ts
# Expected: no output

# Step 4 — no registry import in move files
grep -l "@legendary-arena/registry" packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts packages/game-engine/src/moves/coreMoves.impl.ts
# Expected: no output

# Step 5 �� no .reduce() in economy logic
grep -rn "\.reduce(" packages/game-engine/src/economy/
# Expected: no output

# Step 6 — no Math.random in new files
grep -rn "Math.random" packages/game-engine/src/economy/
# Expected: no output

# Step 7 — no throw in move files
grep -n "throw " packages/game-engine/src/moves/fightVillain.ts packages/game-engine/src/moves/recruitHero.ts
# Expected: no output

# Step 8 — no require() in generated files
grep -rn "require(" packages/game-engine/src/economy/
# Expected: no output

# Step 9 — no boardgame.io import in test files
grep -l "boardgame.io" packages/game-engine/src/economy/economy.logic.test.ts packages/game-engine/src/economy/economy.integration.test.ts
# Expected: no output

# Step 10 — economy must not touch reveal pipeline
grep -n "turnEconomy" packages/game-engine/src/villainDeck/villainDeck.reveal.ts
# Expected: no output

# Step 11 — economy must not touch board helpers
grep -rn "turnEconomy" packages/game-engine/src/board/
# Expected: no output

# Step 12 — confirm no files outside scope were changed
git diff --name-only
# Expected: only WP-018 files + 01.5 wiring files
```

All grep checks must return empty. Build and tests must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-1801: `G.cardStats` stores card stat values resolved at setup time
     from registry — moves never query registry at runtime (registry
     boundary enforcement, same pattern as `G.villainDeckCardTypes`).
     `G.cardStats` is read-only after setup; no move or hook may write to it.
   - D-1802: `"2+"` parses to base `2` only — the `+` modifier is stripped
     but conditional bonus semantics are deferred to WP-022 (keyword-driven
     effects)
   - D-1803: HQ refill after recruit is not in this packet ��� it is a
     separate concern that may require its own WP or can be added to WP-019+
   - D-1804: `CardStatEntry.fightCost` is semantically distinct from
     `CardStatEntry.attack` — `attack` is hero attack generation (added to
     economy by `playCard`), `fightCost` is villain fight requirement
     (validated by `fightVillain`). Both derive from numeric card fields but
     serve different purposes.
   - D-1805: Starting cards (agents/troopers) are not in `G.cardStats` and
     contribute 0/0 when played — this is a **fail-closed MVP** choice.
     Agents (1 recruit) and troopers (1 attack) will need stat entries in a
     future WP for gameplay-correct economy. The 0/0 behavior is intentional
     for this packet to avoid hardcoding card data outside the registry.

2. **`docs/ai/STATUS.md`** — economy exists; fight and recruit are
   resource-gated; card stats resolved at setup time; starting cards
   contribute 0/0 in MVP

3. **`docs/ai/ARCHITECTURE.md`** — add `G.turnEconomy` and `G.cardStats`
   to the Field Classification Reference table in Section 3 (class: Runtime)

4. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-018 with
   today's date
