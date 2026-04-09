# WP-008B — Core Moves Implementation (Draw, Play, End Turn)

**Status:** Ready
**Primary Layer:** Game Engine / Moves
**Dependencies:** WP-008A

---

## Session Context

WP-008A locked the move contracts — `MoveResult`, `MoveError`, `MOVE_ALLOWED_STAGES`,
and the four validators. This packet implements the three move behaviors against
those contracts. `zoneOps.ts` is introduced as a pure helper with no boardgame.io
dependency; all zone mutations go through it. The three-step ordering (validate
args → check stage gate → mutate `G`) is non-negotiable and must not be
abbreviated.

---

## Goal

Implement the three core move behaviors defined in WP-008A so that a running
match can execute deterministic state transitions on `G`:

- `drawCards` — move N cards from `deck` → `hand`; reshuffle `discard` → `deck`
  if the deck is exhausted, using `ctx.random` exclusively
- `playCard` — move one card from `hand` → `inPlay`
- `endTurn` — move all cards from `inPlay` + `hand` → `discard`, then call
  `ctx.events.endTurn()` to advance to the next player

All zone operations move `CardExtId` strings between arrays. No card objects
ever enter `G`. No move throws — invalid input returns a structured error record.

---

## Assumes

- WP-008A complete. Specifically:
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `CoreMoveName`,
    `DrawCardsArgs`, `PlayCardArgs`, `MoveResult`, `MoveError` (WP-008A)
  - `packages/game-engine/src/moves/coreMoves.validate.ts` exports
    `validateDrawCardsArgs`, `validatePlayCardArgs`, `validateEndTurnArgs`,
    `validateMoveAllowedInStage` (WP-008A)
  - `packages/game-engine/src/moves/coreMoves.gating.ts` exports
    `isMoveAllowedInStage`, `MOVE_ALLOWED_STAGES` (WP-008A)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `packages/game-engine/src/state/zones.types.ts` exports `CardExtId`,
  `PlayerZones`, `PlayerState` (WP-006A)
- `packages/game-engine/src/turn/turnPhases.types.ts` exports `TurnStage`
  (WP-007A)
- `packages/game-engine/src/game.ts` has the `play` phase with `advanceStage`
  wired in and `G.currentStage` tracked in `G` (WP-007B)
- `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
- `packages/game-engine/src/setup/shuffle.ts` exports `shuffleDeck` (WP-005B)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract"
  and "Zone Mutation Rules". These document the three-step ordering that every
  move must follow (validate args → check stage gate → mutate `G`), the exact
  shapes of `moveCardFromZone` and `moveAllCards`, and why helpers return new
  arrays rather than mutating their inputs.
- `packages/game-engine/src/moves/coreMoves.types.ts` — the payload and result
  types from WP-008A. Read before writing any move signature — implementations
  must match these contracts exactly.
- `packages/game-engine/src/moves/coreMoves.validate.ts` — the four validators
  from WP-008A. Every move calls its validator before touching `G`. Do not
  duplicate validation logic.
- `packages/game-engine/src/moves/coreMoves.gating.ts` — `isMoveAllowedInStage`
  from WP-008A. Every move calls this after arg validation, before mutation.
- `packages/game-engine/src/setup/shuffle.ts` — `shuffleDeck` from WP-005B.
  The reshuffle path in `drawCards` must use this — never a new shuffle
  implementation, never `Math.random()`.
- `packages/game-engine/src/game.ts` — read it entirely before modifying.
  Understand where `moves` is currently defined and how `G.currentStage` is
  tracked before wiring the new implementations.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: all moves must be pure and deterministic; no DB queries inside
  move functions; `ctx.random.*` is the only permitted randomness source;
  `ctx.events.endTurn()` is the boardgame.io mechanism for ending a turn —
  manual player index rotation is forbidden.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7.1` — zone arrays contain
  only `CardExtId` strings; never full card objects, never slugs as a primary
  key.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 5 (30-line function
  limit — zone operations extracted into `zoneOps.ts`), Rule 6 (`// why:`
  on `ctx.events.endTurn()` and the reshuffle path), Rule 8 (no `.reduce()` in
  zone operations — use `for...of`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only; reshuffle
  uses `shuffleDeck` from `shuffle.ts`
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions; zones contain only `CardExtId` strings
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in move functions or helpers
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Every move must follow the exact three-step ordering: validate args →
  check stage gate → mutate `G`; no other ordering is permitted
- `zoneOps.ts` helpers return new arrays — they must never mutate their inputs
- `zoneOps.ts` must not import from `boardgame.io`
- No `.reduce()` in zone operations — use `for...of` loops
- `ctx.events.endTurn()` in `endTurn` must have a `// why:` comment: boardgame.io
  manages player rotation; manual player index rotation is forbidden
- WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts`) must not be modified in this packet
- Integration test uses `makeMockCtx` from `src/test/mockCtx.ts` — never
  imports `boardgame.io` or `boardgame.io/testing`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MoveError shape** (imported from WP-008A — implementations must use this
  exact shape when logging errors; never redefine):
  `{ code: string; message: string; path: string }`

- **PlayerZones keys** (all three move implementations access player zones by
  name — use these exact keys; never invent alternate names):
  `deck` | `hand` | `discard` | `inPlay` | `victory`
  Move-to-zone mapping: `drawCards`: `deck → hand` |
  `playCard`: `hand → inPlay` | `endTurn`: `inPlay + hand → discard`

- **TurnStage values** (stage gating checks must use `TurnStage` constants —
  never hardcode these strings in move implementations):
  `'start'` | `'main'` | `'cleanup'`
  Stage gate per move: `drawCards` allowed in `['start', 'main']` |
  `playCard` allowed in `['main']` | `endTurn` allowed in `['cleanup']`

---

## Scope (In)

### A) `src/moves/zoneOps.ts` — new (pure helpers — no boardgame.io import)
- `moveCardFromZone(fromZone: CardExtId[], toZone: CardExtId[], cardId: CardExtId): { from: CardExtId[]; to: CardExtId[]; found: boolean }`
  — removes `cardId` from `fromZone`, appends to `toZone`; returns new arrays
  and whether the card was found; does not mutate the inputs
- `moveAllCards(fromZone: CardExtId[], toZone: CardExtId[]): { from: CardExtId[]; to: CardExtId[] }`
  — moves all cards from one zone to another; returns new arrays
- `// why:` comment: extracting zone ops makes them independently testable and
  keeps each move function under 30 lines
- No `boardgame.io` import; no `Math.random`

### B) `src/moves/coreMoves.impl.ts` — new

**`drawCards(G, ctx, args)`:**
1. `validateDrawCardsArgs(args)` — if `ok: false`, log error record and return
2. `validateMoveAllowedInStage('drawCards', G.currentStage)` — if blocked, return
3. Draw `args.count` cards from `player.zones.deck` → `player.zones.hand`
   using `moveCardFromZone` in a `for` loop
4. If deck is empty mid-draw and discard has cards:
   - Move all discard → deck using `moveAllCards`
   - Shuffle deck using `shuffleDeck(deck, ctx)` from `shuffle.ts`
   - `// why:` comment: reshuffling discard into deck is the standard Legendary
     rule when the draw pile is exhausted; `ctx.random` ensures determinism
   - Continue drawing from the newly shuffled deck

**`playCard(G, ctx, args)`:**
1. `validatePlayCardArgs(args)` — if `ok: false`, return
2. `validateMoveAllowedInStage('playCard', G.currentStage)` — if blocked, return
3. `moveCardFromZone(player.zones.hand, player.zones.inPlay, args.cardId)` —
   if `found: false`, log structured error and return without mutation

**`endTurn(G, ctx)`:**
1. `validateMoveAllowedInStage('endTurn', G.currentStage)` — if blocked, return
2. `moveAllCards(player.zones.inPlay, player.zones.discard)` — move inPlay to
   discard
3. `moveAllCards(player.zones.hand, player.zones.discard)` — move remaining
   hand to discard
4. Clear `player.zones.inPlay` and `player.zones.hand` to `[]`
5. `ctx.events.endTurn()` with `// why:` comment: boardgame.io manages player
   rotation; manual player index rotation is not permitted

### C) `src/game.ts` — modified
- Replace the existing `drawCards`, `playCard`, `endTurn` stubs in the `play`
  phase `moves` object with imports from `coreMoves.impl.ts`
- Keep `advanceStage` wired as it was in WP-007B
- No other changes to phase configuration

### D) `src/index.ts` — modified
- Export `moveCardFromZone`, `moveAllCards` if needed by tests or consumers

### E) Tests — `src/moves/coreMoves.integration.test.ts` — new
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io` or `boardgame.io/testing`
- Build a minimal `G` per test: one player with known zone contents
  (e.g., `deck: ['card-a', 'card-b', 'card-c']`, `hand: []`, `discard: []`,
  `inPlay: []`)
- Nine tests:
  1. `drawCards` with `count: 2` → `hand` has `['card-a', 'card-b']`,
     `deck` has `['card-c']`
  2. `drawCards` with `count: 5` when deck has 2 cards → reshuffle from
     discard occurs; all 5 cards end up in hand
  3. `drawCards` blocked in `cleanup` stage — `G` unchanged
  4. `playCard` with a valid `cardId` → card moves from `hand` to `inPlay`
  5. `playCard` with `cardId` not in hand → `G` unchanged, no throw
  6. `playCard` blocked in `start` stage — `G` unchanged
  7. `endTurn` → `hand` is `[]`, `inPlay` is `[]`, discard contains
     all previously played and hand cards
  8. `endTurn` → `makeMockCtx().events.endTurn` called exactly once
  9. `JSON.stringify(G)` succeeds after each move (serialize after each step)

---

## Out of Scope

- No card effects (attack, recruit, keywords, costs)
- No HQ, city, or KO zone logic
- No buying or fighting mechanics
- No win/loss conditions
- No database, network, or filesystem access in move functions
- No server or UI changes
- WP-008A contract files (`coreMoves.types.ts`, `coreMoves.validate.ts`,
  `coreMoves.gating.ts`) must not be modified
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/moves/zoneOps.ts` — **new** — pure zone operation
  helpers
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **new** — three move
  implementations
- `packages/game-engine/src/game.ts` — **modified** — wire implementations
  into `play` phase moves
- `packages/game-engine/src/index.ts` — **modified** — export helpers if needed
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **new** —
  integration tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Zone Operation Helpers
- [ ] `src/moves/zoneOps.ts` exports `moveCardFromZone` and `moveAllCards`
- [ ] `moveCardFromZone` returns `{ from, to, found }` without mutating inputs
- [ ] `moveAllCards` returns `{ from: [], to: <combined> }` without mutating
      inputs
- [ ] `zoneOps.ts` contains no import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] `zoneOps.ts` contains no `Math.random`
      (confirmed with `Select-String`)

### `drawCards`
- [ ] Calls `validateDrawCardsArgs` before any `G` mutation
- [ ] Calls `validateMoveAllowedInStage('drawCards', G.currentStage)` before
      mutation
- [ ] With `count: 2` and `deck: ['a','b','c']`: `hand` becomes `['a','b']`,
      `deck` becomes `['c']`
- [ ] When deck is exhausted mid-draw, discard is reshuffled into deck using
      `shuffleDeck` — confirmed by the reshuffle integration test
- [ ] With `currentStage = 'cleanup'`, `G` is unchanged after the call

### `playCard`
- [ ] Calls `validatePlayCardArgs` before any `G` mutation
- [ ] Calls `validateMoveAllowedInStage('playCard', G.currentStage)` before
      mutation
- [ ] With `cardId` in hand, card moves from `hand` to `inPlay`
- [ ] With `cardId` not in hand, `G` is unchanged and no exception is thrown
- [ ] With `currentStage = 'start'`, `G` is unchanged after the call

### `endTurn`
- [ ] Calls `validateMoveAllowedInStage('endTurn', G.currentStage)` before
      mutation
- [ ] After `endTurn`: `player.zones.hand` is `[]`
- [ ] After `endTurn`: `player.zones.inPlay` is `[]`
- [ ] After `endTurn`: `player.zones.discard` contains all previously played
      and hand cards
- [ ] `ctx.events.endTurn()` call has a `// why:` comment
- [ ] `makeMockCtx().events.endTurn` is called exactly once during `endTurn`

### WP-008A Contract Protection
- [ ] `src/moves/coreMoves.types.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/moves/coreMoves.validate.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/moves/coreMoves.gating.ts` was not modified
      (confirmed with `git diff --name-only`)

### Determinism and Purity
- [ ] No `Math.random` in any new or modified file
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in `zoneOps.ts`
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-008A contract tests)
- [ ] Integration test has all 9 test cases specified in Scope (In)
- [ ] `JSON.stringify(G)` succeeds after each move
- [ ] Test file does not import `boardgame.io` or `boardgame.io/testing`
      (confirmed with `Select-String`)
- [ ] Test uses `makeMockCtx` from `src/test/mockCtx.ts`
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after wiring implementations
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\moves\zoneOps.ts","packages\game-engine\src\moves\coreMoves.impl.ts" -Pattern "Math.random"
# Expected: no output

# Step 4 — confirm zoneOps.ts has no boardgame.io import
Select-String -Path "packages\game-engine\src\moves\zoneOps.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — confirm WP-008A contract files were not modified
git diff --name-only packages/game-engine/src/moves/coreMoves.types.ts packages/game-engine/src/moves/coreMoves.validate.ts packages/game-engine/src/moves/coreMoves.gating.ts
# Expected: no output (all three files untouched)

# Step 6 — confirm no require() in new files
Select-String -Path "packages\game-engine\src\moves\zoneOps.ts","packages\game-engine\src\moves\coreMoves.impl.ts","packages\game-engine\src\moves\coreMoves.integration.test.ts" -Pattern "require("
# Expected: no output

# Step 7 — confirm no files outside scope were changed
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files,
      including WP-008A contract tests)
- [ ] No `Math.random` in new or modified files (confirmed with `Select-String`)
- [ ] `zoneOps.ts` has no `boardgame.io` import (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-008A contract files were not modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what moves are now functional; what a
      match can do at the end of this packet (draw, play, end turn in rotation)
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `zoneOps.ts` helpers
      return new arrays rather than mutating `G` directly; why moves return
      void on validation failure rather than throwing
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-008B checked off with today's date
