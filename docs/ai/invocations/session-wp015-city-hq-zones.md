# Session Execution Prompt — WP-015: City & HQ Zones (Villain Movement + Escapes)

**Pre-flight:** `docs/ai/invocations/preflight-wp015-city-hq-zones.md`
**Pre-flight verdict:** READY TO EXECUTE (2026-04-11)
**Execution checklist:** `docs/ai/execution-checklists/EC-015-city-zones.checklist.md`

---

## Instruction to Claude Code

You are executing **WP-015 — City & HQ Zones (Villain Movement + Escapes)**.

This session introduces the City (5 spaces) and HQ (5 hero slots) zones and
wires villain/henchman placement into the reveal pipeline. After this session:

- `G.city` exists as a 5-element tuple, each `CardExtId | null`
- `G.hq` exists as a 5-element tuple, each `CardExtId | null` (empty — WP-016 populates)
- Revealed villains and henchmen enter City space 0, pushing existing cards
  toward space 4
- Cards pushed past space 4 escape, incrementing
  `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
- Scheme-twists, mastermind-strikes, and bystanders do NOT enter City
- `pushVillainIntoCity` is a pure helper with no boardgame.io imports
- ~15 new tests prove deterministic push, escape counting, and correct routing

**You are implementing. You are not planning, researching, or exploring.**

---

## Authority Chain (Read Before Writing Code)

Read these documents **in this exact order** before writing any code.
If conflicts exist, higher-authority documents win.

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
   - Section 2: Zone & Pile Structure
   - Section 4: Zone Mutation Rules, RevealedCardType Conventions,
     Villain Deck Authority Boundary
3. `docs/ai/execution-checklists/EC-015-city-zones.checklist.md`
4. `docs/ai/work-packets/WP-015-city-hq-zones-villain-movement.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` (key rules: 4, 6, 8, 13)

---

## Read Before Implementing (Mandatory)

Read each of these files in full before writing any code:

- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — the reveal
  pipeline; discard routing at line 136 is the line you modify for City routing
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — existing
  reveal tests; tests 1-2 assert discard routing and will need structural
  updates for City routing
- `packages/game-engine/src/endgame/endgame.types.ts` — `ENDGAME_CONDITIONS`
  with `ESCAPED_VILLAINS` key
- `packages/game-engine/src/types.ts` — current `LegendaryGameState`; add
  `city` and `hq` fields
- `packages/game-engine/src/setup/buildInitialGameState.ts` — add City/HQ
  initialization
- `packages/game-engine/src/index.ts` — current exports
- `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveError` for
  `validateCityShape`
- `packages/game-engine/src/moves/zoneOps.ts` — existing zone helper pattern
  (pure functions, return new values, no boardgame.io)
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx`

---

## Locked Values (Do Not Re-Derive)

### City/HQ Types

```typescript
type CitySpace = CardExtId | null;
type CityZone = [CitySpace, CitySpace, CitySpace, CitySpace, CitySpace];
type HqSlot = CardExtId | null;
type HqZone = [HqSlot, HqSlot, HqSlot, HqSlot, HqSlot];
```

Fixed 5-tuples, not variable-length arrays.

### City Insertion Rule

New villains/henchmen always enter at City space 0. All existing cards shift
toward space 4. The card that escapes is always the card previously occupying
space 4, never the newly revealed card.

### City Size Invariant

`CityZone` must always remain length 5 at runtime.

### Escape Counter

`ENDGAME_CONDITIONS.ESCAPED_VILLAINS` = `'escapedVillains'`.
Always use the constant — never the string literal.

### City Routing Rules

| RevealedCardType | Routing |
|---|---|
| `'villain'` | Enter City (push logic) |
| `'henchman'` | Enter City (push logic) |
| `'scheme-twist'` | Trigger only (WP-014A existing) |
| `'mastermind-strike'` | Trigger only (WP-014A existing) |
| `'bystander'` | Discard + message (MVP; WP-017 adds capture) |

### Ordering Contract

City placement occurs BEFORE rule effects are applied. Rule hooks observe
the post-placement City state. This ensures rule hooks observe the physical
board state that players would see immediately after a reveal, matching
Legendary's tabletop semantics. This ordering is contractual and must not be
reversed without a DECISIONS.md entry. Violation of this ordering is a
breaking change to the rules engine.

### HQ Immutability

No move in WP-015 may mutate `G.hq` after initialization. HQ mutation
begins in WP-016.

---

## Non-Negotiable Constraints

### Engine-Wide (Always Apply)

- Never use `Math.random()` — all randomness via `shuffleDeck`
- Never throw inside move functions — return void on invalid input
- `G` must be JSON-serializable at all times
- ESM only, Node v22+ — `import`/`export` only, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension
- No database or network access
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

### Packet-Specific

- `pushVillainIntoCity` is a pure helper — no boardgame.io import in
  `city.logic.ts`
- Escape counter uses `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant — never
  the string literal `'escapedVillains'`
- No `.reduce()` in city push logic — use explicit assignment
- `villainDeck.types.ts` must NOT be modified (WP-014A contract, locked)
- Tests use `makeMockCtx` — do not modify shared test helpers
- Bystander MVP: discard + message. All bystander code must include
  `// why: bystander capture rules are WP-017`
- HQ initialized but immutable — no WP-015 move may mutate `G.hq`

### Absolute Exclusions

- No fight / attack / recruit mechanics (WP-016)
- No KO pile (WP-017)
- No bystander capture rules (WP-017)
- No HQ purchase logic (WP-016)
- No mastermind tactics resolution (WP-019)
- No `@legendary-arena/registry` imports
- No `makeMockCtx` modifications
- No refactors, cleanups, or "while I'm here" improvements

---

## Runtime Wiring Allowance

This WP adds `city: CityZone` and `hq: HqZone` to `LegendaryGameState`.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `src/setup/buildInitialGameState.ts` — initialize `G.city` and `G.hq`
  with `initializeCity()` and `initializeHq()`. This file is in the WP
  allowlist directly.
- `src/villainDeck/villainDeck.reveal.test.ts` — existing reveal tests that
  construct mock `G` states must add `city` and `hq` fields to satisfy the
  updated `LegendaryGameState` type. Tests that assert villain/henchman
  discard routing must be updated to assert City routing instead. These are
  structural assertion updates, not new test logic.
- `src/game.test.ts` — if it constructs `LegendaryGameState` objects that
  need the new fields for type completeness. Value-only updates.

No new behaviour may be introduced in these wiring-only changes.

---

## Scope Lock

### Allowed Files (Exhaustive)

| Action | File | Purpose |
|---|---|---|
| Create | `src/board/city.types.ts` | `CityZone`, `HqZone`, `CitySpace`, `HqSlot` |
| Create | `src/board/city.logic.ts` | `pushVillainIntoCity`, `initializeCity`, `initializeHq` |
| Create | `src/board/city.validate.ts` | `validateCityShape` |
| Create | `src/board/city.logic.test.ts` | 7+ city push unit tests |
| Create | `src/villainDeck/villainDeck.city.integration.test.ts` | 8 integration tests |
| Modify | `src/villainDeck/villainDeck.reveal.ts` | Route villain/henchman to City |
| Modify | `src/setup/buildInitialGameState.ts` | Initialize `G.city` and `G.hq` |
| Modify | `src/types.ts` | Add `city` and `hq` to `LegendaryGameState` |
| Modify | `src/index.ts` | Export new public API |
| Modify (01.5) | `src/villainDeck/villainDeck.reveal.test.ts` | Add city/hq to mock G; update routing assertions |
| Modify (01.5) | Other test files needing city/hq in mock G | Type-completeness only |
| Update | `docs/ai/STATUS.md` | City/HQ zones exist |
| Update | `docs/ai/DECISIONS.md` | Bystander MVP, 5-tuple, push direction |
| Update | `docs/ai/ARCHITECTURE.md` | G.city and G.hq in Field Classification |
| Update | `docs/ai/work-packets/WORK_INDEX.md` | Check off WP-015 |

All paths are relative to `packages/game-engine/` unless they start with `docs/`.

**Rule:** Any file not listed above is out of scope. Do not modify it.

---

## Implementation Order

Execute in this exact sequence. Do not skip ahead.

### Step 1: Types (`city.types.ts`)

Create `packages/game-engine/src/board/city.types.ts`:

```typescript
type CitySpace = CardExtId | null;
type CityZone = [CitySpace, CitySpace, CitySpace, CitySpace, CitySpace];
type HqSlot = CardExtId | null;
type HqZone = [HqSlot, HqSlot, HqSlot, HqSlot, HqSlot];
```

- Import `CardExtId` from `../state/zones.types.js`
- `// why:` comment: fixed 5-tuple enforces board layout at type level;
  variable-length arrays would allow invalid states
- No boardgame.io imports

### Step 2: City Logic (`city.logic.ts`)

Create `packages/game-engine/src/board/city.logic.ts`:

**Terminology:** "push" means insert at space 0 and shift toward space 4.
"Escape" refers only to the card shifted out of space 4.

**`pushVillainIntoCity(city, cardId)`** — pure function:
1. If space 4 is occupied, capture escaped card: `escapedCard = city[4]`
2. Shift cards rightward: space 3 -> 4, 2 -> 3, 1 -> 2, 0 -> 1
3. Place `cardId` at space 0
4. Return `{ city: newTuple, escapedCard }` (or `escapedCard: null`)

- Uses explicit assignment — no `.reduce()`, no array methods
- `// why:` comment on shift direction: rightward = toward escape
- Returns a new 5-tuple, never mutates the input
- No boardgame.io imports

**`initializeCity()`** — returns `[null, null, null, null, null]`

**`initializeHq()`** — returns `[null, null, null, null, null]`

### Step 3: City Validation (`city.validate.ts`)

Create `packages/game-engine/src/board/city.validate.ts`:

**`validateCityShape(city)`** — validates city is a 5-element array of
`string | null`. Returns `{ ok: true } | { ok: false; errors: MoveError[] }`.
Imports `MoveError` from `coreMoves.types.ts`. No boardgame.io imports.

### Step 4: Update LegendaryGameState (`types.ts`)

Add to `LegendaryGameState`:
```typescript
city: CityZone;
hq: HqZone;
```

Import and re-export `CityZone`, `HqZone`, `CitySpace`, `HqSlot` from
`./board/city.types.js`.

### Step 5: Wire `buildInitialGameState.ts`

Import `initializeCity` and `initializeHq` from `../board/city.logic.js`.

Add to the returned state:
```typescript
city: initializeCity(),
// why: HQ initialized empty; recruit slot population is WP-016 scope
hq: initializeHq(),
```

### Step 6: Modify `revealVillainCard` (Critical — Architecturally Sensitive)

Violation of the ordering contract in this step is a breaking change to the
rules engine and requires a new DECISIONS.md entry. Treat this step as
architecturally sensitive.

This is the key change. Modify `src/villainDeck/villainDeck.reveal.ts`:

**After** step 3 (type lookup + fail-closed check) and **before** step 5
(trigger emission), add City routing:

```
If cardType is 'villain' or 'henchman':
  - Call pushVillainIntoCity(G.city, cardId)
  - Assign G.city = result.city
  - If result.escapedCard is not null:
    - Increment G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]
    - Push escape message to G.messages
  - Do NOT place card in discard (it is now in the City)
```

**After** trigger emission and effect application (existing step 6 + 7):

```
If cardType is 'bystander':
  - Place in G.villainDeck.discard (existing behavior)
  - Push message to G.messages
  - // why: bystander capture rules are WP-017; MVP discards

If cardType is 'scheme-twist' or 'mastermind-strike':
  - Place in G.villainDeck.discard (existing behavior, unchanged)
```

**Important ordering:** City placement BEFORE trigger emission. The existing
discard routing line (line 136) must be replaced with conditional routing
based on card type. Villain/henchman -> City. Everything else -> discard.

Import `pushVillainIntoCity` from `../board/city.logic.js` and
`ENDGAME_CONDITIONS` from `../endgame/endgame.types.js`.

### Step 7: Exports (`index.ts`)

Export from `packages/game-engine/src/index.ts`:
- `CityZone`, `HqZone`, `CitySpace`, `HqSlot` (types)
- `pushVillainIntoCity`, `initializeCity`, `initializeHq` (functions)
- `validateCityShape` (function)

### Step 8: City Logic Tests (`city.logic.test.ts`)

Create `packages/game-engine/src/board/city.logic.test.ts`:

Uses `node:test` and `node:assert` only. No boardgame.io imports.

**7+ tests:**
1. Push places card at space 0 of empty city
2. Push shifts existing cards forward (space 0 -> 1, etc.)
3. Push with all 5 spaces full: space 4 card escapes
4. Escaped card returned as `escapedCard`; non-escape returns null
5. Escape identity: `escapedCard === oldCity[4]` (never the newly revealed card)
6. City remains 5-element tuple after push
7. JSON.stringify succeeds after push
8. `initializeCity()` returns all nulls

### Step 9: Integration Tests (`villainDeck.city.integration.test.ts`)

Create `packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts`:

Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. No boardgame.io.

Construct mock G states with pre-populated `villainDeck`, `villainDeckCardTypes`,
`city`, and `hq` fields. Use the same `createMockMoveContext` pattern from
`villainDeck.reveal.test.ts`.

**8 tests:**
1. Villain reveal places card in `G.city[0]`
2. Henchman reveal places card in `G.city[0]`
3. Scheme-twist reveal does NOT modify `G.city`
4. Mastermind-strike reveal does NOT modify `G.city`
5. Escape increments `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
6. JSON.stringify(G) succeeds after reveal + city placement
7. `G.hq` remains unchanged (all null) after villain reveals
8. Malformed `G.city` causes safe failure: no mutation to `G.city`, no
   counter increment, no throw (move returns early)

### Step 10: Update WP-014A Reveal Tests (01.5 Wiring)

Update `src/villainDeck/villainDeck.reveal.test.ts`:

- Add `city` and `hq` fields to the `createMockGameState` function
  (needed for type completeness)
- Update tests 1-2 that assert villain/henchman discard routing:
  - Test 1 ("draws the top card"): now card goes to City, not discard
  - Test 2 ("places revealed card in discard"): update to check City
    placement for villain cards, or split into type-specific tests
- These are structural assertion updates reflecting new routing. No new
  test logic.

Check other test files that construct `LegendaryGameState` — they may need
`city` and `hq` fields for type completeness. Add empty defaults
(`initializeCity()`, `initializeHq()`) where needed. Value-only changes.

### Step 11: Build & Test

```bash
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
```

All existing tests (updated as needed) plus ~15 new tests must pass.
No pre-existing test failures are permitted.

### Step 12: Verification Commands

On Windows/PowerShell, replace `grep` with `Select-String`.

```bash
# No registry import in city files
grep -r "@legendary-arena/registry" packages/game-engine/src/board/

# No boardgame.io in city.logic.ts
grep "boardgame.io" packages/game-engine/src/board/city.logic.ts

# No Math.random in new files
grep -r "Math.random" packages/game-engine/src/board/

# Escape uses ENDGAME_CONDITIONS constant
grep "ENDGAME_CONDITIONS" packages/game-engine/src/villainDeck/villainDeck.reveal.ts

# No .reduce() in city logic
grep "\.reduce(" packages/game-engine/src/board/city.logic.ts

# villainDeck.types.ts unchanged
git diff --name-only -- packages/game-engine/src/villainDeck/villainDeck.types.ts

# No require()
grep -r "require(" packages/game-engine/src/board/

# All changed files within scope
git diff --name-only

# Catch stray files
git status --porcelain
```

### Step 13: Governance Updates

- **`docs/ai/STATUS.md`** — City and HQ zones exist; villain movement and
  escapes work; WP-016 is unblocked
- **`docs/ai/DECISIONS.md`** — at minimum:
  - Why bystander MVP handling discards rather than captures (WP-017)
  - Why City uses 5-tuple rather than variable-length array
  - Why push inserts at space 0 (matching physical board left-to-right flow)
- **`docs/ai/ARCHITECTURE.md`** — add `G.city` and `G.hq` to the Field
  Classification Reference table in Section 3 (class: Runtime)
- **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-015 with today's
  date

---

## Required `// why:` Comments

These comments are mandatory per EC-015. Missing any is an execution failure.

- 5-tuple design: `// why: fixed size enforces board layout at type level`
- Push shift direction: `// why: rightward = toward escape`
- Bystander MVP: `// why: bystander capture rules are WP-017; MVP discards`
- HQ empty at init: `// why: recruit slot population is WP-016 scope`
- Escape counter: `// why:` on `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` usage
- City placement ordering: `// why: City placement before triggers so hooks
  observe post-placement state`

---

## Established Patterns (Do Not Deviate)

- Pure helpers return new values; moves assign into `G` under Immer
- `for...of` loops or explicit assignment — no `.reduce()`
- Zone helpers have no boardgame.io imports (same as `zoneOps.ts`)
- Escape counter uses `ENDGAME_CONDITIONS` constant, not string literal
- 5-tuple types for fixed-size zones
- Move signature: `{ G, ctx }: MoveContext` destructured, returns `void`
- `makeMockCtx` reverses arrays (proves shuffle ran) — no modifications
- City mutation in WP-015 occurs only during `revealVillainCard`. No other
  helper or test may mutate `G.city` directly.

---

## Stop Conditions

**STOP and ask the human if:**

- Any contract, field name, or reference is unclear
- The reveal pipeline modification is more complex than expected
- A file outside the allowlist needs modification beyond 01.5 wiring
- `villainDeck.types.ts` needs modification for any reason
- Build or tests fail and the cause is not immediately traceable to this WP
- The ordering of City placement vs trigger emission creates unexpected
  interactions

Never guess. Never invent field names, type shapes, or file paths.

---

## Execution Summary (Complete After Implementation)

After all implementation is done, provide an execution summary that includes:

1. Files created and modified (with line counts)
2. Test results (total pass/fail counts)
3. Any files modified under 01.5 runtime wiring allowance, with justification
4. Any WP-014A test assertion updates, documented
5. Any deviations from the locked scope, with justification
6. Verification command results
7. Confirmation that all EC-015 checklist items are satisfied
