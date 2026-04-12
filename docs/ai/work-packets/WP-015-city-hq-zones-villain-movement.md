# WP-015 — City & HQ Zones (Villain Movement + Escapes)

**Status:** Ready
**Primary Layer:** Game Engine / Board Zones
**Dependencies:** WP-014A, WP-014B

---

## Session Context

WP-014 introduced the villain deck and reveal pipeline: `revealVillainCard`
draws the top card, classifies it via `G.villainDeckCardTypes`, emits triggers
through the rule pipeline, and places the card in discard. This packet modifies
that routing so that revealed villains and henchmen enter the City instead of
going directly to discard. This supersedes the temporary discard routing
established in WP-014A (step 11 of revealVillainCard) for villain and
henchman cards only; all other card types retain their WP-014A routing.
WP-016 will add fight and recruit mechanics; this packet handles placement
and movement only.

---

## Goal

Introduce the canonical City (5 spaces) and HQ (5 hero slots) zones and wire
villain/henchman placement into the gameplay loop. After this session:

- `G.city` exists as 5 ordered spaces, each holding `CardExtId | null`
- `G.hq` exists as 5 ordered hero slots, each holding `CardExtId | null`
- Revealed villains and henchmen are placed into the City via deterministic
  push logic (insert at space 0, shift existing cards forward)
- Cards pushed past space 4 escape, incrementing
  `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
- Revealed scheme-twists, mastermind-strikes, and bystanders do NOT enter the
  City (existing trigger behavior from WP-014 is preserved)
- All behavior is deterministic and JSON-serializable
- Tests prove deterministic push, escape counting, and correct routing by card type

---

## Assumes

- WP-014 complete. Specifically:
  - `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` exports
    `revealVillainCard` (WP-014)
  - `packages/game-engine/src/villainDeck/villainDeck.types.ts` exports
    `RevealedCardType`, `REVEALED_CARD_TYPES`, `VillainDeckState` (WP-014)
  - `G.villainDeckCardTypes` is populated at setup time (WP-014)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `ENDGAME_CONDITIONS` with `ESCAPED_VILLAINS` key (WP-010)
  - `packages/game-engine/src/rules/ruleRuntime.execute.ts` exports
    `executeRuleHooks` (WP-009B)
  - `packages/game-engine/src/rules/ruleRuntime.effects.ts` exports
    `applyRuleEffects` (WP-009B)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `data/metadata/card-types.json` exists with slugs: `villain`, `henchman`,
  `bystander`, `scheme-twist`, `mastermind-strike`
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure". City
  and HQ are new zones that follow the same principles: zones store `CardExtId`
  strings only, mutations go through pure helpers, no card objects in `G`.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Zone Mutation Rules". All zone
  operations go through `zoneOps.ts`-style pure helpers. Helpers return new
  arrays, never mutate inputs. No `.reduce()`.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "RevealedCardType Conventions".
  The 5 canonical types and the hyphens-not-underscores rule. City routing
  depends on correct type classification from `G.villainDeckCardTypes`.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — City and HQ
  logic is game-engine layer only. No server, registry, persistence, or UI
  concerns.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read it
  entirely. This packet modifies step 11 (card placement) to route villains
  and henchmen to the City instead of discard.
- `packages/game-engine/src/endgame/endgame.types.ts` — read
  `ENDGAME_CONDITIONS`. Escape increments must use the
  `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant, not the string literal
  `'escapedVillains'`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `citySpace` not `cs`), Rule 6 (`// why:` on the push-from-zero design and
  on bystander MVP handling), Rule 8 (no `.reduce()` in city push — use
  `for...of`), Rule 13 (ESM only).

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
- City push logic is a **pure helper** — no boardgame.io import in
  `city.logic.ts`
- Escape counter increments must use `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`
  constant — never the string literal `'escapedVillains'`
- City space indexing is 0-based: space 0 is the entry point, space 4 is the
  escape edge
- HQ is initialized but not yet used for buying — MVP only; WP-016 adds
  recruit logic
- Bystander handling is intentionally temporary in WP-015. Discard + message
  is a placeholder invariant until WP-017 introduces capture rules. Revealed
  bystanders go to `G.villainDeck.discard` (existing behavior from WP-014)
  and a message is logged to `G.messages`. All bystander handling code must
  include a `// why: bystander capture rules are WP-017` comment. If a
  different approach is chosen, log the decision in DECISIONS.md.
- WP-014 contract files (`villainDeck.types.ts`) must not be modified
- Tests use `makeMockCtx` from `src/test/mockCtx.ts` — do not import from
  `boardgame.io`
- No `.reduce()` in city push logic — use explicit `for` or `for...of` loops
- City mutation in WP-015 occurs only during `revealVillainCard`. No other
  helper, move, or test may mutate `G.city` directly.
- No module-scope import of `@legendary-arena/registry` in any new file —
  city routing uses `G.villainDeckCardTypes` (setup-time data), not live
  registry

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **ENDGAME_CONDITIONS keys** (escape increment uses this constant):
  `ESCAPED_VILLAINS = 'escapedVillains'`

- **RevealedCardType values** (routing uses these — hyphens not underscores):
  `'villain'` | `'henchman'` | `'bystander'` | `'scheme-twist'` | `'mastermind-strike'`

- **City insertion rule:** new villains/henchmen always enter at City space 0.
  All existing cards shift toward space 4.

- **City escape identity:** the card that escapes is always the card previously
  occupying City space 4, never the newly revealed card.

- **City size invariant:** CityZone must always remain length 5 at runtime.
  Any deviation is an invalid state.

- **City routing rules:**
  `'villain'` and `'henchman'` -> enter City (push logic)
  `'scheme-twist'` -> trigger only (WP-014 existing)
  `'mastermind-strike'` -> trigger only (WP-014 existing)
  `'bystander'` -> discard + message (MVP; no capture rules yet)

- **HQ immutability in WP-015:** no move in WP-015 may mutate `G.hq` after
  initialization. HQ mutation begins in WP-016.

---

## Scope (In)

### A) `src/board/city.types.ts` — new

- `type CitySpace = CardExtId | null` — a single city space
- `type CityZone = [CitySpace, CitySpace, CitySpace, CitySpace, CitySpace]`
  — fixed 5-tuple, not a variable-length array
- `type HqSlot = CardExtId | null`
- `type HqZone = [HqSlot, HqSlot, HqSlot, HqSlot, HqSlot]` — fixed 5-tuple
- `// why:` comment on the 5-tuple design: fixed size enforces the board layout
  at the type level; variable-length arrays would allow invalid states

### B) `src/board/city.logic.ts` — new

**Terminology:** "push" means insert at space 0 and shift toward space 4.
"Escape" refers only to the card shifted out of space 4.

- `pushVillainIntoCity(city: CityZone, cardId: CardExtId): { city: CityZone; escapedCard: CardExtId | null }`
  — pure function:
  1. If space 4 is occupied, that card escapes (`escapedCard = city[4]`)
  2. Shift cards forward: space 3 -> 4, 2 -> 3, 1 -> 2, 0 -> 1
  3. Place `cardId` in space 0
  4. Return new tuple and escaped card (or null)
  - Uses explicit assignment, not `.reduce()` or array methods
  - `// why:` comment on shift direction (rightward = toward escape)
- `initializeCity(): CityZone` — returns `[null, null, null, null, null]`
- `initializeHq(): HqZone` — returns `[null, null, null, null, null]`
- No boardgame.io import — pure helper

### C) `src/board/city.validate.ts` — new

- `validateCityShape(city: unknown): { ok: true } | { ok: false; errors: MoveError[] }`
  — confirms the city is a 5-element array of `string | null`
- Imports `MoveError` from `src/moves/coreMoves.types.ts` — no new error type
- No boardgame.io import — pure helper

### D) `src/setup/buildInitialGameState.ts` — modified

- Initialize `G.city = initializeCity()` (all null)
- Initialize `G.hq = initializeHq()` (all null — MVP; WP-016 populates)
- `// why:` comment on HQ being empty at init: recruit slot population is
  WP-016 scope

### E) `src/villainDeck/villainDeck.reveal.ts` — modified

- After step 4 (type lookup), before step 5 (trigger emission).
  **Ordering guarantee:** City placement occurs before rule effects are applied,
  so rule hooks observe the post-placement City state. This ensures rule hooks
  observe the physical board state that players would see immediately after a
  reveal, matching Legendary's tabletop semantics. This ordering is
  contractual and must not be reversed without a DECISIONS.md entry. Violation
  of this ordering is a breaking change to the rules engine.
  - If card type is `'villain'` or `'henchman'`:
    - Call `pushVillainIntoCity(G.city, cardId)`
    - Update `G.city` with the returned city
    - If `escapedCard` is not null:
      - Increment `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
      - Push escape message to `G.messages`
    - Do NOT place card in discard (it is now in the City)
  - If card type is `'bystander'`:
    - Place in `G.villainDeck.discard` (existing behavior)
    - Push message to `G.messages`
    - `// why:` comment: bystander capture rules are WP-017; MVP discards
  - If card type is `'scheme-twist'` or `'mastermind-strike'`:
    - Existing trigger behavior from WP-014 unchanged
    - Card goes to discard as before

### F) `src/types.ts` — modified

- Add `city: CityZone` and `hq: HqZone` to `LegendaryGameState`
- Re-export `CityZone`, `HqZone`, `CitySpace`, `HqSlot` from city.types.ts

### G) `src/index.ts` — modified

- Export `CityZone`, `HqZone`, `pushVillainIntoCity`, `initializeCity`,
  `initializeHq`, `validateCityShape` as named public exports

### H) Tests — `src/board/city.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; does not import from `boardgame.io`
- Seven tests:
  1. `pushVillainIntoCity` places card at space 0 of an empty city
  2. `pushVillainIntoCity` shifts existing cards forward
  3. `pushVillainIntoCity` with all 5 spaces full: space 4 card escapes
  4. Escaped card is returned as `escapedCard`; non-escape returns `null`
  5. Escaped card identity: `escapedCard === oldCity[4]` (never the newly
     revealed card)
  6. City remains a 5-element tuple after push (`assert.equal(city.length, 5)`)
  7. `JSON.stringify(city)` succeeds after push
  8. `initializeCity()` returns all nulls

### I) Tests — `src/villainDeck/villainDeck.city.integration.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Eight tests:
  1. Reveal of villain card places it in `G.city[0]`
  2. Reveal of henchman card places it in `G.city[0]`
  3. Reveal of scheme-twist does NOT modify `G.city`
  4. Reveal of mastermind-strike does NOT modify `G.city`
  5. Escape increments `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
  6. `JSON.stringify(G)` succeeds after reveal + city placement
  7. `G.hq` remains unchanged (all null) after villain reveals
  8. If `G.city` is malformed at move time, the move fails safely: no
     mutation to `G.city`, no counter increment, no throw (move returns early)

---

## Out of Scope

- No fighting / attack / recruit — that is WP-016
- No KO pile — that is WP-017
- No bystander capture rules — that is WP-017
- No HQ purchase logic — that is WP-016
- No mastermind tactics resolution — that is WP-019
- No city "fight" interactions — that is WP-016
- No persistence / database access
- No server or UI changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/board/city.types.ts` — **new** — CityZone, HqZone,
  CitySpace, HqSlot types
- `packages/game-engine/src/board/city.logic.ts` — **new** — pushVillainIntoCity,
  initializeCity, initializeHq
- `packages/game-engine/src/board/city.validate.ts` — **new** — validateCityShape
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  initialize G.city and G.hq
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** —
  route villains/henchmen to City
- `packages/game-engine/src/types.ts` — **modified** — add city/hq to
  LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/board/city.logic.test.ts` — **new** — city push
  unit tests
- `packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts`
  — **new** — reveal-to-city integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### City/HQ Types
- [ ] `G.city` is a 5-element tuple, each `CardExtId | null`
- [ ] `G.hq` is a 5-element tuple, each `CardExtId | null`
- [ ] Both types are JSON-serializable (no class instances, Maps, Sets)
- [ ] `// why:` comment on 5-tuple design exists in `city.types.ts`

### City Push Logic
- [ ] `pushVillainIntoCity` is a pure function — no boardgame.io import
      (confirmed with `Select-String`)
- [ ] Push inserts at space 0 and shifts existing cards toward space 4
- [ ] Card at space 4 is returned as `escapedCard` when pushed out
- [ ] Escaped card is always the card previously at space 4, never the newly
      revealed card (asserted in tests)
- [ ] City remains length 5 after every push (asserted in tests)
- [ ] No `.reduce()` in city logic (confirmed with `Select-String`)

### Escape Counter
- [ ] Escape increments use `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant
      — not the string `'escapedVillains'`
      (confirmed with `Select-String`)
- [ ] Escape adds a message to `G.messages`

### Reveal Routing
- [ ] Villain and henchman revealed cards enter `G.city[0]`
- [ ] Scheme-twist and mastermind-strike do NOT enter City
- [ ] Bystander goes to discard with message (temporary MVP handling)
- [ ] `// why:` comment on bystander MVP decision references WP-017
- [ ] City placement occurs before rule effects are applied, so rule hooks
      observe the post-placement City state

### No Registry Import
- [ ] `src/board/city.logic.ts` contains no import from `@legendary-arena/registry`
      (confirmed with `Select-String`)
- [ ] `src/board/city.types.ts` contains no import from `@legendary-arena/registry`
      (confirmed with `Select-String`)

### HQ Immutability
- [ ] No move in WP-015 mutates `G.hq` after initialization
- [ ] Integration test asserts `G.hq` remains all null after villain reveals

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] City push test confirms escape returns the displaced card
- [ ] City push test asserts `escapedCard === oldCity[4]` (escape identity)
- [ ] Integration test confirms villain enters city, scheme-twist does not
- [ ] Integration test asserts malformed `G.city` causes safe failure (no mutation)
- [ ] Both test files use `makeMockCtx` and do not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Both test files use `node:test` and `node:assert` only

### Scope Enforcement
- [ ] `villainDeck.types.ts` was not modified (WP-014 contract)
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding city zones
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no registry import in city files
Select-String -Path "packages\game-engine\src\board\city.logic.ts","packages\game-engine\src\board\city.types.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 4 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\board" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 5 — confirm escape uses ENDGAME_CONDITIONS constant
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts" -Pattern "ENDGAME_CONDITIONS"
# Expected: at least one match

# Step 6 — confirm no .reduce() in city logic
Select-String -Path "packages\game-engine\src\board\city.logic.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 7 — confirm no boardgame.io import in city logic
Select-String -Path "packages\game-engine\src\board\city.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 8 — confirm villainDeck.types.ts was not modified
git diff --name-only packages/game-engine/src/villainDeck/villainDeck.types.ts
# Expected: no output

# Step 9 — confirm no require() in generated files
Select-String -Path "packages\game-engine\src\board" -Pattern "require(" -Recurse
# Expected: no output

# Step 10 — confirm no files outside scope were changed
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
- [ ] No registry import in city files (confirmed with `Select-String`)
- [ ] No `Math.random` in `src/board/` (confirmed with `Select-String`)
- [ ] No `.reduce()` in city logic (confirmed with `Select-String`)
- [ ] Escape uses `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` constant
      (confirmed with `Select-String`)
- [ ] `villainDeck.types.ts` was not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — City and HQ zones exist; villain movement
      and escapes work; WP-016 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why bystander MVP handling
      discards rather than captures; why City uses 5-tuple rather than
      variable-length array; why push inserts at space 0 (matching physical
      board left-to-right flow)
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.city` and `G.hq` to the
      Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-015 checked off with today's date
