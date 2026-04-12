# Session Execution Prompt — WP-017 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-017 — KO, Wounds & Bystander Capture (Minimal MVP)
**Mode:** Implementation (WP-017 not yet implemented)
**Pre-Flight:** Complete (2026-04-11) — build green (184 tests passing),
authority chain aligned
**EC:** `docs/ai/execution-checklists/EC-017-ko-wounds.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All acceptance criteria in WP-017 satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - Section 4: "Canonical Reveal -> Fight -> Side-Effect Ordering"
   - Section 4: "Zone Mutation Rules"
   - Section 4: "Move Validation Contract"
   - Section 3: "Field Classification Reference"
   - "Layer Boundary (Authoritative)"
3. `docs/ai/execution-checklists/EC-017-ko-wounds.checklist.md`
4. `docs/ai/work-packets/WP-017-ko-wounds-bystanders-minimal-mvp.md`
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)

**Then read these implementation anchors (patterns, not templates):**

7. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — understand
   escape branch (~line 109) and trigger emission (~line 128); WP-017 code
   inserts between them
8. `packages/game-engine/src/moves/fightVillain.ts` — understand the
   three-step contract; bystander award inserts after step 3, before message
9. `packages/game-engine/src/setup/buildInitialGameState.ts` — must add
   `ko` and `attachedBystanders` to the returned object (01.5 wiring)
10. `packages/game-engine/src/board/city.logic.ts` — confirm purity.
    **Do NOT modify this file.**

---

## Runtime Wiring Allowance (01.5)

WP-017 adds `ko: CardExtId[]` and
`attachedBystanders: Record<CardExtId, CardExtId[]>` to
`LegendaryGameState`. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to these files are permitted solely for type and assertion
correctness:

- `buildInitialGameState.ts` — add `ko: []` and `attachedBystanders: {}`
- `buildInitialGameState.shape.test.ts` — assert presence (value-only)

No other files qualify for 01.5 allowance. `types.ts` and `index.ts`
modifications are explicitly in WP scope (not wiring allowance).

---

## Execution Tasks

### A) `src/types.ts` — extend `LegendaryGameState`

Add:

```ts
/** Cards removed from the game (KO pile). Destination-only zone. */
ko: CardExtId[];

/** Bystanders attached to villains/henchmen currently in the City. */
attachedBystanders: Record<CardExtId, CardExtId[]>;
```

These fields are required — `buildInitialGameState` must initialize them.

---

### B) `src/board/ko.logic.ts` — new (pure helper)

```ts
koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]
```

**Rules:**
- Destination-only append; returns new array
- No source lookup, no validation — caller removes from source first

**Required comment:**
```ts
// why: KO is a one-way destination; cards never return in MVP
```

---

### C) `src/board/wounds.logic.ts` — new (pure helper)

```ts
gainWound(
  woundsPile: CardExtId[],
  playerDiscard: CardExtId[],
): { woundsPile: CardExtId[]; playerDiscard: CardExtId[] }
```

**Rules:**
- Consume `woundsPile[0]`, use `pile.slice(1)` (locked convention)
- Empty pile = deterministic no-op (return both unchanged)
- Returns new arrays, never mutates inputs

**Required comment:**
```ts
// why: empty pile means no wound to give; deterministic no-op
```

---

### D) `src/board/bystanders.logic.ts` — new (pure helpers)

#### D1) `attachBystanderToVillain` — attach on City entry

```ts
attachBystanderToVillain(
  bystandersPile: CardExtId[],
  villainCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
): { bystandersPile: CardExtId[]; attachedBystanders: Record<CardExtId, CardExtId[]> }
```

- Uses `bystandersPile[0]` + `pile.slice(1)` (locked convention)
- Empty pile = no-op
- Returns new objects

**Required comment:**
```ts
// why: MVP attaches exactly 1 bystander per villain entering City
```

#### D2) `awardAttachedBystanders` — award on defeat

```ts
awardAttachedBystanders(
  villainCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
  playerVictory: CardExtId[],
): { attachedBystanders: Record<CardExtId, CardExtId[]>; playerVictory: CardExtId[] }
```

- Moves all attached bystanders to victory, deletes mapping entry
- No entry = no-op
- Returns new objects

#### D3) `resolveEscapedBystanders` — resolve on escape

```ts
resolveEscapedBystanders(
  escapedCardId: CardExtId,
  attachedBystanders: Record<CardExtId, CardExtId[]>,
  bystandersPile: CardExtId[],
): { attachedBystanders: Record<CardExtId, CardExtId[]>; bystandersPile: CardExtId[] }
```

- Returns attached bystanders to **end** of supply pile, deletes mapping
- No entry = no-op
- Returns new objects

**Required comment:**
```ts
// why: escaped villains release bystanders to prevent leaks and supply depletion
```

---

### E) `villainDeck.reveal.ts` — modify (two insertion points)

Two insertion points in the existing villain/henchman routing block.

**Canonical ordering (must match ARCHITECTURE.md diagram):**
```
  City placement (WP-015)
  If escapedCard != null:
    increment ESCAPED_VILLAINS counter    (WP-015 — existing)
    gainWound for current player          (WP-017 — new)
    resolveEscapedBystanders              (WP-017 — new)
  attachBystanderToVillain                (WP-017 — new)
  Emit triggers / rule hooks              (WP-014A — existing)
  Apply effects                           (WP-014A — existing)
```

Do not alter trigger ordering.

#### E1) Escape branch (after counter increment, before triggers)

In the existing escape branch (`pushResult.escapedCard !== null`),
after the counter increment and escape message:

1. Call `gainWound` for `ctx.currentPlayer`
2. Update `G.piles.wounds` and `G.playerZones[ctx.currentPlayer].discard`
3. Push wound message
4. Call `resolveEscapedBystanders` for the escaped card
5. Update `G.attachedBystanders` and `G.piles.bystanders`
6. Push bystander return message (if any were returned)

**Required comments:**
```ts
// why: escape causes wound — MVP player penalty
// why: escaped villain releases bystanders back to supply
```

#### E2) Bystander attachment (after placement + escape, before triggers)

After the escape branch closes (both escape and non-escape paths),
before trigger emission (Step 5 in existing code):

1. Call `attachBystanderToVillain` for the newly placed `cardId`
2. Update `G.piles.bystanders` and `G.attachedBystanders`

**Required comment:**
```ts
// why: bystander appears with villain; rule hooks must observe post-attachment state
```

**Imports:**
- `gainWound` from `../board/wounds.logic.js`
- `attachBystanderToVillain` from `../board/bystanders.logic.js`
- `resolveEscapedBystanders` from `../board/bystanders.logic.js`

---

### F) `fightVillain.ts` — modify (award after step 3)

After the existing step 3 (City removal + victory placement), before
the message push:

1. Call `awardAttachedBystanders` with the defeated `cardId`,
   `G.attachedBystanders`, and `G.playerZones[ctx.currentPlayer].victory`
2. Update `G.attachedBystanders` and
   `G.playerZones[ctx.currentPlayer].victory`
3. Push rescue message (if bystanders were awarded)

**Import:**
- `awardAttachedBystanders` from `../board/bystanders.logic.js`

**Precondition:** WP-016 code already removed the villain from City and
placed in victory. WP-017 code does not re-verify the removal.

---

### G) `src/index.ts` — export new helpers

Export: `koCard`, `gainWound`, `attachBystanderToVillain`,
`awardAttachedBystanders`, `resolveEscapedBystanders`

---

### H) Wiring: `buildInitialGameState.ts` (01.5)

Add to the returned `LegendaryGameState` object:

```ts
// why: KO pile starts empty; cards enter via koCard helper (WP-017)
ko: [],
// why: no bystanders attached at game start; populated during reveals (WP-017)
attachedBystanders: {},
```

Value-only addition. No new logic.

---

### I) Wiring: `buildInitialGameState.shape.test.ts` (01.5)

If the existing "G has all required top-level keys" test fails, add
value-only assertions:

```ts
assert.ok(Array.isArray(gameState.ko), 'G must have ko array');
assert.ok(gameState.attachedBystanders !== undefined, 'G must have attachedBystanders');
```

No new test cases. No new logic.

---

## Tests (22 Total — 4 New Files)

All test files: `node:test`, `node:assert`, `.test.ts` extension.
No boardgame.io imports. No modifications to `makeMockCtx`.

### J) `src/board/ko.logic.test.ts` — 3 tests

1. `koCard` appends card to KO pile
2. `koCard` returns a new array (input not mutated)
3. `JSON.stringify` of result succeeds

### K) `src/board/wounds.logic.test.ts` — 4 tests

1. `gainWound` moves one wound from pile to discard (takes `pile[0]`)
2. Empty wounds pile: both arrays returned unchanged
3. Returns new arrays (inputs not mutated)
4. `JSON.stringify` of results succeeds

### L) `src/board/bystanders.logic.test.ts` — 8 tests

1. `attachBystanderToVillain` takes `pile[0]` (top-of-pile convention)
2. `attachBystanderToVillain` removes from pile and adds to mapping
3. Empty bystander pile: returns unchanged
4. `awardAttachedBystanders` moves bystanders to victory zone
5. `awardAttachedBystanders` removes the mapping entry
6. No mapping entry: returns unchanged
7. `resolveEscapedBystanders` returns bystanders to supply pile and
   removes mapping
8. `JSON.stringify` of all results succeeds

### M) `src/board/escape-wound.integration.test.ts` — 7 tests

Uses `makeMockCtx` for `ctx`.

1. Villain escape triggers wound gain for current player
2. Escape with empty wounds pile: no wound, no error
3. `JSON.stringify(G)` succeeds after escape + wound
4. On villain City entry: one bystander attached from
   `G.piles.bystanders`
5. On defeat (via `fightVillain`): attached bystanders move to player
   victory and mapping entry removed
6. Empty bystander pile on City entry: no attachment, no error
7. Escape with attached bystanders: bystanders returned to supply pile,
   mapping entry removed, no bystander leak

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass, 0 fail

# Step 3 — no boardgame.io import in pure helpers
grep -l "boardgame.io" packages/game-engine/src/board/ko.logic.ts packages/game-engine/src/board/wounds.logic.ts packages/game-engine/src/board/bystanders.logic.ts
# Expected: no output

# Step 4 — no .reduce() in new files
grep -rn "\.reduce(" packages/game-engine/src/board/ko.logic.ts packages/game-engine/src/board/wounds.logic.ts packages/game-engine/src/board/bystanders.logic.ts
# Expected: no output

# Step 5 — no Math.random in new files
grep -rn "Math.random" packages/game-engine/src/board/ko.logic.ts packages/game-engine/src/board/wounds.logic.ts packages/game-engine/src/board/bystanders.logic.ts packages/game-engine/src/board/escape-wound.integration.test.ts
# Expected: no output

# Step 6 — city.types.ts and city.logic.ts not modified
git diff --name-only packages/game-engine/src/board/city.types.ts packages/game-engine/src/board/city.logic.ts
# Expected: no output

# Step 7 — no require() in generated files
grep -rn "require(" packages/game-engine/src/board/ko.logic.ts packages/game-engine/src/board/wounds.logic.ts packages/game-engine/src/board/bystanders.logic.ts
# Expected: no output

# Step 8 — confirm no files outside scope were changed
git diff --name-only
# Expected: only WP-017 files + 01.5 wiring files
```

All grep checks must return empty. Build and tests must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-1701: MVP attaches exactly 1 bystander per villain entering City
     (simplified from full Legendary rules where count can vary)
   - D-1702: Escape causes wound — MVP rule linking escapes to player
     penalty (current player gains 1 wound when a villain escapes)
   - D-1703: `G.attachedBystanders` is a plain `Record<CardExtId,
     CardExtId[]>` (not a Map) — must remain JSON-serializable
   - D-1704: Escaped bystanders return to supply pile (not KO) — prevents
     bystander depletion and preserves total bystander count
   - D-1705: Supply pile `pile[0]` is top-of-pile convention — consistent
     with deck `deck[0]` = top card; remove via `pile.slice(1)`

2. **`docs/ai/STATUS.md`** — KO pile exists; wound gain on escape exists;
   bystander attachment/award/escape-resolution exists; fighting now awards
   bystanders; WP-018 is unblocked

3. **`docs/ai/ARCHITECTURE.md`** — confirm `G.ko` and
   `G.attachedBystanders` are in the Field Classification table (Section 3).
   If not, add them with class: Runtime.

4. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-017 with
   today's date

---

## Hard Stops (Non-Negotiable)

Any of the following is a **STOP — report failure, do not continue**:

- Modify `city.logic.ts` or `city.types.ts`
- Use `.reduce()`, `Math.random()`, `require()`, or `throw` in moves
- Import `@legendary-arena/registry` in any new or modified file
- Import `boardgame.io` in pure helper files (`ko.logic.ts`,
  `wounds.logic.ts`, `bystanders.logic.ts`)
- Modify `coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts`
- Modify `makeMockCtx` or other shared test helpers
- Use `.pop()` or `pile[pile.length - 1]` for supply pile consumption
- Place escape-wound logic in `city.logic.ts` instead of
  `villainDeck.reveal.ts`
- Expand scope beyond WP-017 (no attack/recruit economy, no VP scoring,
  no card text effects, no advanced bystander rules, no wound
  healing/effects, no KO recovery)
- 01.5 wiring beyond `buildInitialGameState.ts` and its shape test
