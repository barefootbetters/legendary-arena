# Session Execution Prompt — WP-019 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-019 — Mastermind Fight & Tactics (Minimal MVP)
**Mode:** Implementation (WP-019 not yet implemented)
**Pre-Flight:** Complete (2026-04-12) — build green (223 tests passing),
authority chain aligned, three earlier blocking issues corrected (cardStats
population, fightCost field, internal stage gating)
**EC:** `docs/ai/execution-checklists/EC-019-mastermind-tactics.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-019 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §2 "Card Field Data Quality" (vAttack field types, modifier strings)
   - §2 "Card Data Flow: Registry into Game Engine"
   - §3 "Field Classification Reference"
   - §4 "The Move Validation Contract"
   - §4 "G.counters Key Conventions" (ENDGAME_CONDITIONS constants)
   - "Layer Boundary (Authoritative)"
3. `docs/ai/execution-checklists/EC-019-mastermind-tactics.checklist.md`
4. `docs/ai/work-packets/WP-019-mastermind-tactics-boss-fight-minimal-mvp.md`
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)

**Implementation anchors (patterns, not templates):**

7. `packages/game-engine/src/economy/economy.logic.ts` — read
   `parseCardStatValue`, `getAvailableAttack`, `spendAttack`,
   `isCardStatsRegistryReader` (runtime type guard pattern),
   `buildCardStats` (setup-time resolution pattern).
   Reuse these — do NOT create parallel helpers.
8. `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — read
   `findMastermindStrikes` (~line 397) for the mastermind resolution
   pattern via `getSet()`. The ext_id format for mastermind cards is
   `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`. The `tactic`
   field distinguishes strikes (`tactic !== true`) from tactics
   (`tactic === true`). Also read `isVillainDeckRegistryReader`
   (~line 267) for the runtime type guard pattern.
9. `packages/game-engine/src/moves/fightVillain.ts` — understand the
   three-step contract with internal stage gating
   (`if (G.currentStage !== 'main') return;`). `fightMastermind`
   follows this exact pattern.
10. `packages/game-engine/src/endgame/endgame.types.ts` — read
    `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`. Use the constant, never
    the string `'mastermindDefeated'`.
11. `packages/game-engine/src/setup/buildInitialGameState.ts` — must add
    `G.mastermind` to the returned object and call
    `buildMastermindState` **after** `buildCardStats`
12. `packages/game-engine/src/game.ts` — register `fightMastermind` in
    `play` phase moves
13. `packages/game-engine/src/types.ts` — add
    `mastermind: MastermindState` to `LegendaryGameState`

---

## Runtime Wiring Allowance (01.5)

WP-019 adds `mastermind: MastermindState` to `LegendaryGameState` and
registers `fightMastermind` in the moves map. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `buildInitialGameState.ts` — value-only addition + explicit WP-scope
  call to `buildMastermindState`
- `buildInitialGameState.shape.test.ts` — value-only assertion for
  presence of `mastermind` field
- `game.test.ts` — update move list assertion (move count increases
  from 7 to 8 with `fightMastermind`)
- Existing test mock G factories — add `mastermind` field to mock
  state objects (value-only):
  - `src/moves/fightVillain.test.ts`
  - `src/moves/recruitHero.test.ts`
  - `src/moves/coreMoves.integration.test.ts`
  - `src/board/escape-wound.integration.test.ts`
  - `src/economy/economy.integration.test.ts`

**No behavior** may be introduced under 01.5 beyond restoring shape
correctness. `types.ts`, `game.ts`, and `index.ts` modifications are
explicitly in WP scope (not wiring allowance).

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `.reduce()` in new files
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any `throw` inside `fightMastermind` — returns void on failure
- Any `@legendary-arena/registry` import in game-engine mastermind or
  move files
- Any `boardgame.io` import in `mastermind.logic.ts`,
  `mastermind.types.ts`, or in new test files
- Any modification to `coreMoves.gating.ts` — non-core moves use
  internal stage gating (fightVillain/recruitHero precedent)
- Any modification to `CORE_MOVE_NAMES` or `CoreMoveName` type
- Any modification to WP-018 contract files (`economy.types.ts`,
  `economy.logic.ts`)
- Any use of string literal `'mastermindDefeated'` instead of
  `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`
- Any stat lookup using `.attack` instead of `.fightCost` for the
  mastermind fight requirement (D-1805)
- Any stat lookup using `G.mastermind.id` or tactic card IDs instead
  of `G.mastermind.baseCardId`
- Calling `buildMastermindState` BEFORE `buildCardStats` (ordering
  invariant — cardStats must exist first)
- Implement tactic text effects, VP scoring, conditional bonuses
- Add new phases, stages, triggers, or effects
- Expand scope beyond WP-019 (no "while I'm here" improvements)
- Modify files not listed in WP-019 "Files Expected to Change" (except
  under 01.5 wiring allowance)

---

## Implementation Tasks (Authoritative)

### A) Create `src/mastermind/mastermind.types.ts` (new)

```ts
export interface MastermindState {
  // why: id is the mastermind identity from MatchSetupConfig — used for
  // configuration and reference only, never for stat lookup
  /** Mastermind ext_id from MatchSetupConfig. */
  id: CardExtId;

  // why: baseCardId is the ONLY card ID used for stat lookup in
  // G.cardStats. All combat validation reads
  // G.cardStats[baseCardId].fightCost (per D-1805). Tactic IDs never
  // participate in stat lookup.
  /** The mastermind's non-tactic card ext_id — sole key for G.cardStats. */
  baseCardId: CardExtId;

  // why: tacticsDeck is drawn from index 0 (top-of-deck convention);
  // tacticsDefeated is append-only on successful fight
  /** Shuffled tactics deck — drawn from index 0. */
  tacticsDeck: CardExtId[];
  /** Defeated tactics — append-only. */
  tacticsDefeated: CardExtId[];
}
```

Import `CardExtId` from `../state/zones.types.js`. Export the interface.

---

### B) Create `src/mastermind/mastermind.setup.ts` (new)

```ts
buildMastermindState(
  mastermindId: CardExtId,
  registry: unknown,
  context: SetupContext,
  cardStats: Record<CardExtId, CardStatEntry>,
): MastermindState
```

**Rules:**

- Accepts `registry: unknown` with runtime type guard (same pattern as
  `buildVillainDeck` and `buildCardStats`). Check for `listSets` and
  `getSet` methods. If registry doesn't satisfy the interface, return a
  minimal empty state: `{ id: mastermindId, baseCardId: mastermindId,
  tacticsDeck: [], tacticsDefeated: [] }` (graceful degradation for
  narrow test mocks).
- Resolve mastermind from registry using `mastermindId` via `getSet()`:
  iterate `setData.masterminds`, match by `slug === mastermindId`.
- Classify cards using `tactic` boolean:
  - `tactic !== true` -> base card (exactly one expected). Store as
    `baseCardId` using ext_id format:
    `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`
  - `tactic === true` -> tactic card. Collect ext_ids for `tacticsDeck`
    using the same ext_id format.
- **Add mastermind base card to `cardStats`** parameter:
  ```ts
  cardStats[baseCardId] = {
    attack: 0,
    recruit: 0,
    cost: 0,
    fightCost: parseCardStatValue(baseCard.vAttack),
  };
  ```
  Same semantics as villains/henchmen (D-1805: `fightCost` for fight
  requirements, `attack`/`recruit`/`cost` zeroed for non-heroes).
- Shuffle `tacticsDeck` via `shuffleDeck(tacticExtIds, context)`.
- Return `{ id: mastermindId, baseCardId, tacticsDeck: shuffled,
  tacticsDefeated: [] }`.
- Uses `for...of` to classify cards (no `.reduce()`).

**Required comments:**
```ts
// why: ctx.random.Shuffle provides deterministic shuffling seeded by
// boardgame.io's PRNG, ensuring replay reproducibility
```
```ts
// why: mastermind fight cost resolved at setup so fightMastermind can
// read G.cardStats[baseCardId].fightCost without registry access —
// same pattern as villain fightCost in buildCardStats (WP-018)
```

**Imports:** `parseCardStatValue` from `../economy/economy.logic.js`,
`CardStatEntry` type from `../economy/economy.types.js`,
`shuffleDeck` from `../setup/shuffle.js`,
`CardExtId` from `../state/zones.types.js`,
`SetupContext` from `../types.js`

---

### C) Create `src/mastermind/mastermind.logic.ts` (new, pure helpers)

**No boardgame.io imports. No `.reduce()`. No throws.**

```ts
defeatTopTactic(mastermindState: MastermindState): MastermindState
```
- If `tacticsDeck` is empty: return unchanged
- Remove `tacticsDeck[0]`, append to `tacticsDefeated`
- Return new `MastermindState` (never mutate input)

```ts
areAllTacticsDefeated(mastermindState: MastermindState): boolean
```
- Returns `true` if `tacticsDeck.length === 0` AND
  `tacticsDefeated.length > 0`

Export both functions.

---

### D) Create `src/moves/fightMastermind.ts` (new)

Move implementation following three-step contract:

**Step 1 — Validate:**
1. Check `G.mastermind.tacticsDeck.length > 0` (tactics remain).
   If empty: `return;`
2. `const requiredFightCost = G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0`
3. `const availableAttack = getAvailableAttack(G.turnEconomy)`
4. If `availableAttack < requiredFightCost`: `return;`

**Required comment:**
```ts
// why: baseCardId is the canonical stats key; fightCost is the fight
// requirement field per WP-018 D-1805; never use G.mastermind.id or
// any tactic card ID for stat lookup
```
```ts
// why: silent failure preserves deterministic move contract —
// insufficient attack points means the mastermind fight cannot proceed
```

**Step 2 — Stage gate (internal):**
```ts
// why: boss fight during action window; non-core moves gate internally
// per WP-014A precedent (same pattern as fightVillain/recruitHero)
if (G.currentStage !== 'main') return;
```

**Step 3 — Mutate G:**
1. `G.mastermind = defeatTopTactic(G.mastermind)`
2. `G.turnEconomy = spendAttack(G.turnEconomy, requiredFightCost)`
3. Push message to `G.messages`
4. Check `areAllTacticsDefeated(G.mastermind)`:
   - If true: `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1`

**Required comments:**
```ts
// why: MVP defeats exactly 1 tactic per fight; multi-tactic defeat
// and tactic text effects are WP-024
```
```ts
// why: setting MASTERMIND_DEFEATED counter to 1 triggers the endgame
// evaluator from WP-010 — use constant, never string literal
```

**Imports:** `getAvailableAttack`, `spendAttack` from
`../economy/economy.logic.js`; `defeatTopTactic`,
`areAllTacticsDefeated` from `../mastermind/mastermind.logic.js`;
`ENDGAME_CONDITIONS` from `../endgame/endgame.types.js`

---

### E) Modify `src/setup/buildInitialGameState.ts`

1. Import `buildMastermindState` from
   `../mastermind/mastermind.setup.js`
2. **After** the `buildCardStats` call (so `cardStats` already exists),
   call:
   ```ts
   const cardStats = buildCardStats(registry as unknown, config);
   const mastermindState = buildMastermindState(
     config.mastermindId as CardExtId,
     registry as unknown,
     context,
     cardStats,
   );
   ```
   Note: `buildMastermindState` mutates the `cardStats` record by
   adding the mastermind base card entry. This is correct because it
   is still setup time. The `cardStats` variable is then used in the
   returned object as before.
3. Add to the returned `LegendaryGameState` object:
   ```ts
   // why: mastermind state built at setup from registry; tactics deck
   // shuffled deterministically; base card fightCost in G.cardStats
   mastermind: mastermindState,
   ```

**Critical ordering:** `buildMastermindState` MUST be called AFTER
`buildCardStats`. If `cardStats` is currently inlined in the return
object (e.g., `cardStats: buildCardStats(...)`), extract it to a
local variable first so it can be passed to `buildMastermindState`.

---

### F) Modify `src/game.ts`

Register `fightMastermind` in the `play` phase moves:

```ts
import { fightMastermind } from './moves/fightMastermind.js';
```

Add `fightMastermind` to the `moves` map alongside the existing moves.

---

### G) Modify `src/types.ts`

Add to `LegendaryGameState`:
```ts
// why: mastermind state with identity, tactics deck, and defeated list.
// Built at setup from registry data. tacticsDeck drawn from index 0;
// tacticsDefeated append-only. All fields are CardExtId or CardExtId[].
/** Mastermind state for boss fight resolution. */
mastermind: MastermindState;
```

Import and re-export `MastermindState` from
`./mastermind/mastermind.types.js`.

---

### H) Modify `src/index.ts`

Export:
- `MastermindState` type from `./mastermind/mastermind.types.js`
- `buildMastermindState` from `./mastermind/mastermind.setup.js`
- `defeatTopTactic`, `areAllTacticsDefeated` from
  `./mastermind/mastermind.logic.js`
- `fightMastermind` from `./moves/fightMastermind.js`

---

## Tests (16 Total — 3 New Files)

All test files: `node:test`, `node:assert`, `.test.ts` extension.
No boardgame.io imports. No modifications to `makeMockCtx`.

### I) `src/mastermind/mastermind.setup.test.ts` — 5 tests

Build a minimal mock registry (same pattern as
`villainDeck.setup.test.ts`) with a mastermind that has 1 base card
and 3-4 tactic cards. Each card needs `slug`, `tactic`, `vAttack`.

1. `buildMastermindState` produces a non-empty `tacticsDeck`
2. `baseCardId` corresponds to a card with `tactic === false` (uses
   `{setAbbr}-mastermind-{slug}-{cardSlug}` ext_id format)
3. All cards in `tacticsDeck` are tactic cards (not the base card)
4. `tacticsDeck` is shuffled (makeMockCtx reverses — order differs
   from sorted input)
5. `JSON.stringify(mastermindState)` succeeds

### J) `src/mastermind/mastermind.logic.test.ts` — 5 tests

1. `defeatTopTactic` removes first card from `tacticsDeck` and appends
   to `tacticsDefeated`
2. `defeatTopTactic` on empty `tacticsDeck`: returns unchanged
3. `areAllTacticsDefeated` returns `true` when deck empty + defeated
   non-empty
4. `areAllTacticsDefeated` returns `false` when deck has cards
5. `defeatTopTactic` returns new object (input not mutated)

### K) `src/moves/fightMastermind.test.ts` — 6 tests

Uses `makeMockCtx`. Construct mock G with `mastermind` state,
`turnEconomy`, and `cardStats` pre-populated with known values.

1. Successful fight defeats top tactic and spends attack
2. Insufficient attack: **no G mutation** — snapshot `G.mastermind`,
   `G.turnEconomy` before; assert unchanged after
3. No tactics remaining (empty `tacticsDeck`): no G mutation
4. Wrong stage (`cleanup`): no G mutation
5. All tactics defeated:
   `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]` is set to 1
6. `JSON.stringify(G)` succeeds after fight

---

## Wiring: Existing Test Mock Factories (01.5)

Existing test files with mock G factories will need a `mastermind`
field added (value-only). Use a minimal default:

```ts
mastermind: {
  id: 'test-mastermind' as CardExtId,
  baseCardId: 'test-mastermind-base' as CardExtId,
  tacticsDeck: [],
  tacticsDefeated: [],
},
```

Affected files (value-only, no new tests, no new logic):
- `src/moves/fightVillain.test.ts`
- `src/moves/recruitHero.test.ts`
- `src/moves/coreMoves.integration.test.ts`
- `src/board/escape-wound.integration.test.ts`
- `src/economy/economy.integration.test.ts`

## Wiring: `game.test.ts` move list assertion (01.5)

The existing "defines moves: advanceStage, drawCards, endTurn,
fightVillain, playCard, recruitHero, and revealVillainCard" test
must be updated to include `fightMastermind` (move count 7 -> 8).
Value-only assertion change. No new logic.

## Wiring: `buildInitialGameState.shape.test.ts` (01.5)

If the existing "G has all required top-level keys" test fails, add
a value-only assertion:
```ts
assert.ok(gameState.mastermind !== undefined, 'G must have mastermind');
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

# Step 3 — ENDGAME_CONDITIONS constant used (not string literal)
grep -n "ENDGAME_CONDITIONS" packages/game-engine/src/moves/fightMastermind.ts
# Expected: at least one match
grep -n "'mastermindDefeated'" packages/game-engine/src/moves/fightMastermind.ts
# Expected: no output

# Step 4 — no boardgame.io import in pure helpers
grep -l "boardgame.io" packages/game-engine/src/mastermind/mastermind.logic.ts packages/game-engine/src/mastermind/mastermind.types.ts
# Expected: no output (or comment-only matches)

# Step 5 — no .reduce() in new files
grep -rn "\.reduce(" packages/game-engine/src/mastermind/
# Expected: no output

# Step 6 — no Math.random in new files
grep -rn "Math.random" packages/game-engine/src/mastermind/
# Expected: no output

# Step 7 — internal stage gating confirmed
grep -n "currentStage.*main" packages/game-engine/src/moves/fightMastermind.ts
# Expected: at least one match

# Step 7b — coreMoves.gating.ts NOT modified
git diff --name-only packages/game-engine/src/moves/coreMoves.gating.ts
# Expected: no output

# Step 8 — WP-018 contracts not modified
git diff --name-only packages/game-engine/src/economy/economy.types.ts packages/game-engine/src/economy/economy.logic.ts
# Expected: no output

# Step 9 — fightCost used, not .attack for mastermind stats
grep -n "\.fightCost" packages/game-engine/src/moves/fightMastermind.ts
# Expected: at least one match
grep -n "\.attack" packages/game-engine/src/moves/fightMastermind.ts
# Expected: no output (attack is hero-only field)

# Step 10 — no boardgame.io import in test files
grep -l "boardgame.io" packages/game-engine/src/mastermind/mastermind.setup.test.ts packages/game-engine/src/mastermind/mastermind.logic.test.ts packages/game-engine/src/moves/fightMastermind.test.ts
# Expected: no output (or comment-only matches)

# Step 11 — no require() in generated files
grep -rn "require(" packages/game-engine/src/mastermind/
# Expected: no output

# Step 12 — confirm no files outside scope were changed
git diff --name-only
# Expected: only WP-019 files + 01.5 wiring files
```

All grep checks must return empty (or comment-only). Build and tests
must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-1901: MVP defeats exactly 1 tactic per successful fight —
     multi-tactic defeat and tactic text effects deferred to WP-024
   - D-1902: Mastermind `vAttack` stored as `fightCost` in
     `G.cardStats` via `buildMastermindState` — reuses WP-018 pattern
     and D-1805 semantics (fightCost for fight requirements, attack for
     hero generation). `buildMastermindState` is the sole place the
     mastermind base card enters `G.cardStats`.
   - D-1903: No tactic text effects in MVP — tactic cards are defeated
     and moved to `tacticsDefeated`, nothing else happens. Tactic
     abilities are WP-024.
   - D-1904: `buildMastermindState` adds mastermind base card to
     `cardStats` because WP-018's `buildCardStats` only processes
     heroes, villains, and henchmen — masterminds must be added
     separately at setup. Ordering: after `buildCardStats`.

2. **`docs/ai/STATUS.md`** — mastermind fight exists; defeating all
   tactics triggers victory via `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED`;
   full MVP combat loop functional (play cards -> fight villains ->
   fight mastermind -> win)

3. **`docs/ai/ARCHITECTURE.md`** — confirm `G.mastermind` is in the
   Field Classification Reference table (class: Runtime). It should
   already be present; if not, add it.

4. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-019 with
   today's date
