# WP-017 — KO, Wounds & Bystander Capture (Minimal MVP)

**Status:** Ready
**Primary Layer:** Game Engine / Zones + Effects
**Dependencies:** WP-016

---

## Session Context

WP-016 introduced `fightVillain` and `recruitHero` moves with the fight-first
ordering policy. WP-015 established City zones with deterministic push/escape
logic. This packet makes fighting meaningful beyond "remove a villain from the
City" by introducing three core Legendary mechanics: the KO pile (cards removed
from the game), wounds (negative cards gained into player discard), and bystander
capture (bystanders attached to villains and awarded on defeat). WP-018 will
add the attack/recruit point economy; this packet handles zone mechanics only.

---

## Goal

Introduce KO, wound, and bystander capture mechanics as deterministic zone
operations. After this session:

- `G.ko` exists as a `CardExtId[]` zone for cards removed from the game
- `G.attachedBystanders` exists as a `Record<CardExtId, CardExtId[]>` mapping
  villains/henchmen to their captured bystanders
- When a villain or henchman enters the City, one bystander is attached from
  `G.piles.bystanders` if available (simplified MVP capture)
- When `fightVillain` defeats a villain, attached bystanders move to the
  player's victory zone
- `gainWound` helper moves wounds from `G.piles.wounds` into a player's
  discard zone
- When a villain escapes (pushed past City space 4), the current player gains
  1 wound
- `koCard` helper moves any card into `G.ko`
- All operations are deterministic, JSON-serializable, and use pure helpers

---

## Assumes

- WP-016 complete. Specifically:
  - `packages/game-engine/src/moves/fightVillain.ts` exports `fightVillain`
    (WP-016)
  - `packages/game-engine/src/moves/recruitHero.ts` exports `recruitHero`
    (WP-016)
  - `packages/game-engine/src/board/city.types.ts` exports `CityZone` (WP-015)
  - `packages/game-engine/src/board/city.logic.ts` exports
    `pushVillainIntoCity` (WP-015)
  - `G.city`, `G.hq` exist in `LegendaryGameState` (WP-015)
  - `G.piles.bystanders` and `G.piles.wounds` exist as `CardExtId[]`
    (WP-006B — sized from `MatchSetupConfig` count fields)
  - `G.playerZones[*].victory` and `G.playerZones[*].discard` exist (WP-006A)
  - `packages/game-engine/src/endgame/endgame.types.ts` exports
    `ENDGAME_CONDITIONS` (WP-010)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `data/metadata/card-types.json` exists with slugs including: `bystander`,
  `bystander-heroic`, `bystander-special`, `wound`, `wound-enraging`,
  `wound-grievous`
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure".
  `G.piles.bystanders` and `G.piles.wounds` are already initialized from
  `MatchSetupConfig` count fields. This packet consumes them, not creates them.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Zone Mutation Rules". All zone
  operations use pure helpers. Helpers return new arrays. No `.reduce()`.
  `G.ko` and `G.attachedBystanders` follow the same pattern.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract".
  `fightVillain` is modified in this packet to award bystanders after defeat.
  The three-step contract is preserved.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — KO, wound,
  and bystander logic is game-engine layer only. No server, registry,
  persistence, or UI concerns.
- `packages/game-engine/src/moves/fightVillain.ts` — read it entirely. This
  packet modifies it to award attached bystanders after removing a villain
  from the City.
- `packages/game-engine/src/board/city.logic.ts` — read it entirely. The
  escape path is modified to trigger wound gain for the current player.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `bystanderCardId` not `bId`), Rule 6 (`// why:` on the MVP "1 bystander
  per villain" simplification and on escape-causes-wound), Rule 8 (no
  `.reduce()`), Rule 13 (ESM only).

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
- All new zone operations are **pure helpers** — no boardgame.io import in
  `ko.logic.ts`, `wounds.logic.ts`, `bystanders.logic.ts`
- `G.attachedBystanders` is `Record<CardExtId, CardExtId[]>` — plain object,
  JSON-serializable, no Map or Set
- Bystander attachment MVP: exactly 1 bystander per villain/henchman entering
  City (simplified from full Legendary rules). `// why:` comment required.
- Escape-causes-wound is an MVP rule: when a villain escapes, current player
  gains 1 wound. Decision must be recorded in DECISIONS.md.
- `G.piles.bystanders` and `G.piles.wounds` are the source supply piles —
  they were created by WP-006B from `MatchSetupConfig` count fields. Do not
  re-create them.
- `gainWound` does nothing if `G.piles.wounds` is empty — deterministic,
  no error
- `koCard` does nothing if the card is not found in any zone — deterministic,
  no error
- `MoveResult` / `MoveError` reused from WP-008A — no new error types
- WP-015 contract files (`city.types.ts`) must not be modified
- WP-016 contract approach preserved: `fightVillain` is extended, not replaced
- Tests use `makeMockCtx` — no `boardgame.io` imports in test files
- No `.reduce()` in any zone operation

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **GlobalPiles keys** (bystanders and wounds are existing piles):
  `bystanders` | `wounds` | `officers` | `sidekicks`

- **PlayerZones keys** (wounds go to discard, bystanders go to victory):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- **New LegendaryGameState fields** (this packet adds exactly these):
  `ko: CardExtId[]`
  `attachedBystanders: Record<CardExtId, CardExtId[]>`

---

## Scope (In)

### A) `src/board/ko.types.ts` — new

- No new types needed beyond `CardExtId[]` — `G.ko` is typed inline in
  `LegendaryGameState`
- If a dedicated type alias is useful for clarity:
  `type KoPile = CardExtId[]`

### B) `src/board/ko.logic.ts` — new

- `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]`
  — returns new array with `cardId` appended
  - Pure function, no boardgame.io import
  - Does not search or remove from source zone — caller handles removal
  - `// why:` comment: KO is a one-way destination; cards are never recovered
    in MVP

### C) `src/board/wounds.logic.ts` — new

- `gainWound(woundsPile: CardExtId[], playerDiscard: CardExtId[]): { woundsPile: CardExtId[]; playerDiscard: CardExtId[] }`
  — pops one wound from the supply pile and pushes into player discard
  - If `woundsPile` is empty: returns both unchanged (deterministic no-op)
  - Returns new arrays, never mutates inputs
  - Pure function, no boardgame.io import
  - `// why:` comment: empty pile = no wound to give; deterministic

### D) `src/board/bystanders.logic.ts` — new

- `attachBystanderToVillain(bystandersPile: CardExtId[], villainCardId: CardExtId, attachedBystanders: Record<CardExtId, CardExtId[]>): { bystandersPile: CardExtId[]; attachedBystanders: Record<CardExtId, CardExtId[]> }`
  — pops one bystander from supply and attaches to the villain
  - If `bystandersPile` is empty: returns unchanged (deterministic no-op)
  - Returns new objects, never mutates inputs
  - `// why:` comment: MVP attaches exactly 1 bystander per villain entering
    City (simplified from full Legendary rules)

- `awardAttachedBystanders(villainCardId: CardExtId, attachedBystanders: Record<CardExtId, CardExtId[]>, playerVictory: CardExtId[]): { attachedBystanders: Record<CardExtId, CardExtId[]>; playerVictory: CardExtId[] }`
  — moves all bystanders attached to the defeated villain into the player's
    victory zone and removes the mapping entry
  - If no entry exists: returns unchanged
  - Returns new objects, never mutates inputs

- Pure functions, no boardgame.io import

### E) `src/villainDeck/villainDeck.reveal.ts` — modified

- After placing a villain/henchman into the City (WP-015 routing):
  - Call `attachBystanderToVillain` to attach one bystander from
    `G.piles.bystanders`
  - Update `G.piles.bystanders` and `G.attachedBystanders` with results

### F) `src/moves/fightVillain.ts` — modified

- After removing villain from City and placing in victory (WP-016):
  - Call `awardAttachedBystanders` to move attached bystanders to player's
    victory zone
  - Update `G.attachedBystanders` with the cleaned mapping
  - Push message to `G.messages` noting bystanders rescued

### G) `src/board/city.logic.ts` — modified

- When a card escapes (pushed past space 4):
  - After incrementing `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
    (existing WP-015 behavior):
  - Call `gainWound` to give the current player 1 wound from
    `G.piles.wounds`
  - Push message to `G.messages` noting wound gained from escape
  - `// why:` comment: escape-causes-wound is an MVP rule linking escapes
    to player penalty

### H) `src/types.ts` — modified

- Add `ko: CardExtId[]` and `attachedBystanders: Record<CardExtId, CardExtId[]>`
  to `LegendaryGameState`

### I) `src/index.ts` — modified

- Export `koCard`, `gainWound`, `attachBystanderToVillain`,
  `awardAttachedBystanders` as named public exports

### J) Tests — `src/board/ko.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Three tests:
  1. `koCard` appends card to KO pile
  2. `koCard` returns a new array (input not mutated)
  3. `JSON.stringify` of result succeeds

### K) Tests — `src/board/wounds.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Four tests:
  1. `gainWound` moves one wound from pile to discard
  2. Empty wounds pile: both arrays returned unchanged
  3. Returns new arrays (inputs not mutated)
  4. `JSON.stringify` of results succeeds

### L) Tests — `src/board/bystanders.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Six tests:
  1. `attachBystanderToVillain` moves one bystander from pile to mapping
  2. Empty bystander pile: returns unchanged
  3. `awardAttachedBystanders` moves bystanders to victory zone
  4. `awardAttachedBystanders` removes the mapping entry
  5. No mapping entry: returns unchanged
  6. `JSON.stringify` of all results succeeds

### M) Tests — `src/board/escape-wound.integration.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Three tests:
  1. Villain escape triggers wound gain for current player
  2. Escape with empty wounds pile: no wound, no error
  3. `JSON.stringify(G)` succeeds after escape + wound

---

## Out of Scope

- **No full bystander rules** (multiple captures, special bystanders, heroic
  bystanders) — future packets
- **No "rescue" mechanics** — bystanders are awarded on defeat only
- **No wound effects** beyond being a card in discard — future packets
- **No wound healing or removal** — future packets
- **No advanced KO rules** (triggered KO, conditional KO) — `koCard` is a
  helper for future use
- **No VP scoring** — WP-020
- **No attack/recruit point economy** — WP-018
- **No card text effects** — WP-022
- **No persistence / database access**
- **No server or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/board/ko.logic.ts` — **new** — koCard helper
- `packages/game-engine/src/board/wounds.logic.ts` — **new** — gainWound helper
- `packages/game-engine/src/board/bystanders.logic.ts` — **new** — attach and
  award bystander helpers
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** —
  attach bystander on villain/henchman City entry
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — award
  attached bystanders on defeat
- `packages/game-engine/src/board/city.logic.ts` — **modified** — escape
  triggers wound gain
- `packages/game-engine/src/types.ts` — **modified** — add ko and
  attachedBystanders to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — export new helpers
- `packages/game-engine/src/board/ko.logic.test.ts` — **new** — KO tests
- `packages/game-engine/src/board/wounds.logic.test.ts` — **new** — wound tests
- `packages/game-engine/src/board/bystanders.logic.test.ts` — **new** —
  bystander tests
- `packages/game-engine/src/board/escape-wound.integration.test.ts` — **new** —
  escape-wound integration test

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### State Shape
- [ ] `G.ko` exists as `CardExtId[]`
- [ ] `G.attachedBystanders` exists as `Record<CardExtId, CardExtId[]>`
  — plain object, JSON-serializable
- [ ] `G.piles.bystanders` and `G.piles.wounds` are consumed consistently
  (not re-created)
- [ ] `JSON.stringify(G)` succeeds after all operations

### Bystander Capture
- [ ] Villain/henchman entering City attaches 1 bystander from
  `G.piles.bystanders` if available
- [ ] Empty bystander pile: no attachment, no error
- [ ] On defeat: attached bystanders move to player's victory zone
- [ ] Mapping entry removed after award
- [ ] `// why:` comment on 1-bystander-per-villain MVP simplification

### Wound Gain
- [ ] `gainWound` moves wound from `G.piles.wounds` to player discard
- [ ] Empty wounds pile: no wound, no error
- [ ] Escape triggers wound gain for current player
- [ ] `// why:` comment on escape-causes-wound MVP rule

### KO
- [ ] `koCard` appends card to `G.ko`
- [ ] `koCard` returns new array (input not mutated)

### Pure Helpers
- [ ] `ko.logic.ts`, `wounds.logic.ts`, `bystanders.logic.ts` have no
  boardgame.io import (confirmed with `Select-String`)
- [ ] No `.reduce()` in any new file (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Bystander tests cover: attach, empty pile, award, no-entry
- [ ] Wound tests cover: gain, empty pile
- [ ] Escape-wound integration test confirms wound after escape
- [ ] All test files use `.test.ts` extension
- [ ] All test files use `makeMockCtx` or plain mocks — no boardgame.io import

### Scope Enforcement
- [ ] WP-015 contract files (`city.types.ts`) not modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding KO, wounds, bystanders
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in pure helpers
Select-String -Path "packages\game-engine\src\board\ko.logic.ts","packages\game-engine\src\board\wounds.logic.ts","packages\game-engine\src\board\bystanders.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no .reduce() in new files
Select-String -Path "packages\game-engine\src\board\ko.logic.ts","packages\game-engine\src\board\wounds.logic.ts","packages\game-engine\src\board\bystanders.logic.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 5 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\board" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 6 — confirm city.types.ts not modified
git diff --name-only packages/game-engine/src/board/city.types.ts
# Expected: no output

# Step 7 — confirm no require() in generated files
Select-String -Path "packages\game-engine\src\board" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope were changed
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
- [ ] No boardgame.io import in pure helper files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in new files (confirmed with `Select-String`)
- [ ] No `Math.random` in new files (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-015 contract files not modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — KO, wounds, and bystander capture exist;
      fighting now awards bystanders; escapes cause wounds; WP-018 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why MVP attaches exactly 1
      bystander per villain (simplified); why escape causes wound (links escapes
      to player penalty); why `G.attachedBystanders` is a plain object not a Map
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.ko` and `G.attachedBystanders`
      to the Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-017 checked off with today's date
