# WP-017 — KO, Wounds & Bystander Capture (Minimal MVP)

**Status:** Complete
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

- `docs/ai/ARCHITECTURE.md §Section 4` — read "Canonical Reveal → Fight →
  Side-Effect Ordering". This diagram is the authoritative ordering contract
  for how WP-017 side-effects (bystander attachment, escape penalty, bystander
  award) integrate with WP-015 reveal and WP-016 fight logic.
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
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the
  escape branch (step 4b). WP-017 adds wound gain and escape-bystander
  resolution here — NOT in city.logic.ts, which must remain a pure helper.
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
- `koCard` is a destination-only append helper — it does not search source
  zones. Callers must ensure the card exists before calling. Deterministic.
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

- **Supply pile top-of-pile convention:** `pile[0]` is the card drawn/consumed
  (remove by slicing: `pile.slice(1)`). This is consistent with the deck
  top-of-deck convention (`deck[0]` = top card). All helpers that consume
  from supply piles (`gainWound`, `attachBystanderToVillain`) must use this
  convention. Never use `pile[pile.length - 1]` or `.pop()`.

- **Escape + attached bystanders resolution:** When a villain/henchman escapes
  (pushed past City space 4), any bystanders attached to the escaped card are
  returned to `G.piles.bystanders` (appended to the end of the pile). The
  mapping entry is deleted from `G.attachedBystanders`. This preserves total
  bystander count and prevents depletion artifacts. Decision recorded in
  DECISIONS.md.

- **`attachedBystanders` cleanup invariant:** `G.attachedBystanders` entries are
  cleared in exactly two cases: (1) villain defeated via `fightVillain` (award
  path), and (2) villain escaped via `revealVillainCard` (escape path). No
  other code path may create or remove entries. If an entry exists for a card
  no longer in the City, the state is corrupt.

- **Canonical reveal ordering (authoritative):**
  ```
  revealVillainCard (villain/henchman path):
    1. City placement (push logic)              ← WP-015
    2. Escape resolution (if space 4 occupied): ← WP-015 + WP-017
       a. Increment escapedVillains counter     ← WP-015
       b. Gain wound for current player         ← WP-017
       c. Resolve attached bystanders on escape ← WP-017
    3. Attach bystander (if available)          ← WP-017
    4. Emit triggers (onCardRevealed, etc.)     ← WP-014A
    5. Apply rule effects                       ← WP-014A
  ```
  This ordering is contractual. Rule hooks observe post-placement,
  post-attachment state.

- **Canonical fight ordering (authoritative):**
  ```
  fightVillain (WP-016 → WP-017 extension):
    1. Validate args + stage gate               ← WP-016
    2. Remove villain from City                 ← WP-016
    3. Place villain card into player victory   ← WP-016
    4. Award attached bystanders to victory     ← WP-017
    5. Clean attachedBystanders mapping         ← WP-017
    6. Push informational message               ← WP-016
  ```
  `awardAttachedBystanders` is invoked only after `fightVillain` has removed
  the villain from the City. WP-016 does not inspect attach state; WP-017
  consumes and clears it.

- **Cross-packet data ownership (hard boundaries):**
  - WP-016 never reads `G.attachedBystanders`
  - WP-017 never decides when a fight happens
  - Escape penalties (wounds, bystander resolution) are reveal-time only —
    never applied during fight

---

## Scope (In)

### A) `src/board/ko.types.ts` — new

- No new types needed beyond `CardExtId[]` — `G.ko` is typed inline in
  `LegendaryGameState`
- If a dedicated type alias is useful for clarity:
  `type KoPile = CardExtId[]`

### B) `src/board/ko.logic.ts` — new

- `koCard(koPile: CardExtId[], cardId: CardExtId): CardExtId[]`
  — destination-only append helper: returns new array with `cardId` appended
  - Pure function, no boardgame.io import
  - Does NOT search source zones or verify card existence — caller is
    responsible for removing the card from its source zone before calling
    `koCard`. Callers must only call this when the card exists.
  - `// why:` comment: KO is a one-way destination; cards are never recovered
    in MVP

### C) `src/board/wounds.logic.ts` — new

- `gainWound(woundsPile: CardExtId[], playerDiscard: CardExtId[]): { woundsPile: CardExtId[]; playerDiscard: CardExtId[] }`
  — takes the top wound (`woundsPile[0]`) and appends it to player discard
  - Uses `pile[0]` + `pile.slice(1)` (locked supply pile convention)
  - If `woundsPile` is empty: returns both unchanged (deterministic no-op)
  - Returns new arrays, never mutates inputs
  - Pure function, no boardgame.io import
  - `// why:` comment: empty pile = no wound to give; deterministic

### D) `src/board/bystanders.logic.ts` — new

- `attachBystanderToVillain(bystandersPile: CardExtId[], villainCardId: CardExtId, attachedBystanders: Record<CardExtId, CardExtId[]>): { bystandersPile: CardExtId[]; attachedBystanders: Record<CardExtId, CardExtId[]> }`
  — takes the top bystander (`bystandersPile[0]`) and attaches to the villain
  - Uses `pile[0]` + `pile.slice(1)` (locked supply pile convention)
  - If `bystandersPile` is empty: returns unchanged (deterministic no-op)
  - Returns new objects, never mutates inputs
  - `// why:` comment: MVP attaches exactly 1 bystander per villain entering
    City (simplified from full Legendary rules)

- `awardAttachedBystanders(villainCardId: CardExtId, attachedBystanders: Record<CardExtId, CardExtId[]>, playerVictory: CardExtId[]): { attachedBystanders: Record<CardExtId, CardExtId[]>; playerVictory: CardExtId[] }`
  — moves all bystanders attached to the defeated villain into the player's
    victory zone and removes the mapping entry
  - If no entry exists: returns unchanged
  - Returns new objects, never mutates inputs

- `resolveEscapedBystanders(escapedCardId: CardExtId, attachedBystanders: Record<CardExtId, CardExtId[]>, bystandersPile: CardExtId[]): { attachedBystanders: Record<CardExtId, CardExtId[]>; bystandersPile: CardExtId[] }`
  — returns any bystanders attached to the escaped card back to the supply pile
    and removes the mapping entry
  - If no entry exists for `escapedCardId`: returns unchanged
  - Returned bystanders are appended to the end of `bystandersPile`
  - Returns new objects, never mutates inputs
  - `// why:` comment: escaped villain releases bystanders to supply to prevent
    memory leaks and bystander depletion

- Pure functions, no boardgame.io import

### E) `src/villainDeck/villainDeck.reveal.ts` — modified

- After placing a villain/henchman into the City (WP-015 routing) and
  **before** trigger emission (step 5):
  - Call `attachBystanderToVillain` to attach one bystander from
    `G.piles.bystanders`
  - Update `G.piles.bystanders` and `G.attachedBystanders` with results

**Ordering contract:** Bystander attachment occurs immediately after City
placement and before trigger emission. This matches Legendary tabletop
semantics where the bystander appears with the villain, and ensures rule
hooks observe the post-attachment state. `// why:` comment required on
the ordering.

### F) `src/moves/fightVillain.ts` — modified

- After removing villain from City and placing in victory (WP-016 steps 2-3):
  - Call `awardAttachedBystanders` to move attached bystanders to player's
    victory zone
  - Update `G.attachedBystanders` with the cleaned mapping
  - Push message to `G.messages` noting bystanders rescued

**Precondition:** `awardAttachedBystanders` assumes the villain has already
been removed from the City and placed in victory by WP-016 code. WP-017
code does not perform or re-verify the removal — it only handles the
bystander side effect.

### G) `src/villainDeck/villainDeck.reveal.ts` — modified (escape branch)

- In the existing escape branch (step 4b, where `pushResult.escapedCard !== null`),
  after incrementing `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
  (existing WP-015 behavior):
  - Call `gainWound` to give the current player 1 wound from
    `G.piles.wounds` into `G.playerZones[ctx.currentPlayer].discard`
  - Push message to `G.messages` noting wound gained from escape
  - `// why:` comment: escape-causes-wound is an MVP rule linking escapes
    to player penalty
  - Call `resolveEscapedBystanders` (or inline) to handle attached bystanders
    on the escaped card: remove the mapping entry from `G.attachedBystanders`
    and return the bystander cards to `G.piles.bystanders`
  - Push message to `G.messages` if bystanders were returned
  - `// why:` comment: escaped villain releases bystanders back to supply;
    MVP rule to prevent memory leaks and bystander depletion

**Important:** `city.logic.ts` must NOT be modified. It is a pure helper that
does not know about G, counters, messages, or current player. The escape
detection already lives in `villainDeck.reveal.ts` (WP-015), which is the
correct location for escape side effects.

### H) `src/types.ts` — modified

- Add `ko: CardExtId[]` and `attachedBystanders: Record<CardExtId, CardExtId[]>`
  to `LegendaryGameState`

### I) `src/index.ts` — modified

- Export `koCard`, `gainWound`, `attachBystanderToVillain`,
  `awardAttachedBystanders`, `resolveEscapedBystanders` as named public exports

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
- Eight tests:
  1. `attachBystanderToVillain` takes `pile[0]` bystander (top-of-pile convention)
  2. `attachBystanderToVillain` removes from pile and adds to mapping
  3. Empty bystander pile: returns unchanged
  4. `awardAttachedBystanders` moves bystanders to victory zone
  5. `awardAttachedBystanders` removes the mapping entry
  6. No mapping entry: returns unchanged
  7. `resolveEscapedBystanders` returns bystanders to supply pile and removes mapping
  8. `JSON.stringify` of all results succeeds

### M) Tests — `src/board/escape-wound.integration.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Seven tests:
  1. Villain escape triggers wound gain for current player
  2. Escape with empty wounds pile: no wound, no error
  3. `JSON.stringify(G)` succeeds after escape + wound
  4. On villain City entry: one bystander attached from `G.piles.bystanders`
  5. On defeat (via fightVillain): attached bystanders move to player victory
     and mapping entry removed
  6. Empty bystander pile on City entry: no attachment, no error
  7. Escape with attached bystanders: bystanders returned to supply pile,
     mapping entry removed, no bystander leak

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
  attach bystander on villain/henchman City entry; escape branch gains wound
  for current player and resolves attached bystanders on escaped card
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — award
  attached bystanders on defeat
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
  `G.piles.bystanders` if available (takes `pile[0]` per convention)
- [ ] Attachment occurs after City placement and before trigger emission
- [ ] Empty bystander pile: no attachment, no error
- [ ] On defeat: attached bystanders move to player's victory zone
- [ ] Mapping entry removed after award
- [ ] On escape: attached bystanders returned to `G.piles.bystanders`,
  mapping entry removed (no memory leak)
- [ ] `// why:` comment on 1-bystander-per-villain MVP simplification
- [ ] `// why:` comment on attachment ordering (before triggers)

### Wound Gain
- [ ] `gainWound` moves wound from `G.piles.wounds` to player discard
- [ ] Empty wounds pile: no wound, no error
- [ ] Escape triggers wound gain for current player
- [ ] `// why:` comment on escape-causes-wound MVP rule

### KO
- [ ] `koCard` appends card to `G.ko` (destination-only, caller removes from source)
- [ ] `koCard` returns new array (input not mutated)

### Supply Pile Convention
- [ ] `gainWound` takes `woundsPile[0]` (top-of-pile convention)
- [ ] `attachBystanderToVillain` takes `bystandersPile[0]` (same convention)
- [ ] Neither helper uses `.pop()` or `pile[pile.length - 1]`

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
      to player penalty); why `G.attachedBystanders` is a plain object not a Map;
      why escaped bystanders return to supply (not KO); supply pile `pile[0]`
      top-of-pile convention
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.ko` and `G.attachedBystanders`
      to the Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-017 checked off with today's date
