# WP-006B — Player State Initialization (Align to Zone Contracts)

**Status:** Ready
**Primary Layer:** Game Engine / Setup
**Dependencies:** WP-006A

---

## Session Context

WP-006A locked the canonical zone types (`PlayerZones`, `PlayerState`,
`GlobalPiles`) and added runtime validators. WP-005B's `buildInitialGameState`
produces the right shape but is not yet typed against those canonical types and
mixes setup concerns inline. This packet aligns the two: it extracts player
and pile initialization into dedicated helpers, types them against the WP-006A
contracts, and confirms the full setup output passes both validators.

---

## Goal

Align `buildInitialGameState` to produce a `G` that is fully typed against the
canonical zone contracts from WP-006A and passes both validators without errors.

After this session:
- `buildPlayerState(playerId, startingDeck, ctx)` — isolated helper; returns
  a typed `PlayerState` with shuffled `deck` and 4 empty zones
- `buildGlobalPiles(config, ctx)` — isolated helper; returns a typed
  `GlobalPiles` with pile sizes from config count fields
- `buildInitialGameState` delegates to these helpers; its body is significantly
  shorter
- `validateGameStateShape(G)` returns `{ ok: true }` on a full setup run
- `validatePlayerStateShape(player)` returns `{ ok: true }` for every player

---

## Assumes

- WP-006A complete. Specifically:
  - `packages/game-engine/src/state/zones.types.ts` exports `PlayerZones`,
    `PlayerState`, `GlobalPiles`, `CardExtId` (WP-006A)
  - `packages/game-engine/src/state/zones.validate.ts` exports
    `validateGameStateShape` and `validatePlayerStateShape` (WP-006A)
- WP-005B complete. Specifically:
  - `packages/game-engine/src/setup/buildInitialGameState.ts` exists (WP-005B)
  - `packages/game-engine/src/setup/shuffle.ts` exports `shuffleDeck` (WP-005B)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure". The
  initialization rule is authoritative: `deck` is the shuffled starting deck;
  all other zones (`hand`, `discard`, `inPlay`, `victory`) start as `[]`.
  Cards enter non-deck zones through game moves, not setup. Also read the
  `GlobalPiles` table — pile sizes come from `MatchSetupConfig` count fields.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — read it entirely
  before modifying. This is the primary target. Understand its current output
  shape and what the helpers will extract from it.
- `packages/game-engine/src/state/zones.types.ts` — the canonical types from
  WP-006A. All new helper return types must use these exactly.
- `packages/game-engine/src/state/zones.validate.ts` — the validators from
  WP-006A. The integration test must call these after a setup run and assert
  `ok: true`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — the 9 locked
  `MatchSetupConfig` field names used to size the global piles:
  `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7.1` — deck references use
  `ext_id` strings. Player starting decks are `string[]` of `CardExtId` values
  sourced from the registry — not full card objects.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 5 (30-line function limit — this is why setup is
  extracted into helpers), Rule 6 (`// why:` comments), Rule 8 (no `.reduce()`
  in deck construction — use `for...of`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in helpers
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `buildPlayerState` must start all zones other than `deck` as `[]` — add a
  `// why:` comment explaining that cards enter non-deck zones through game
  moves, never through setup initialization
- `buildPlayerState` calls `shuffleDeck` — never `Math.random()`
- No `.reduce()` in deck or pile construction — use `for...of` loops
- `G` stores `CardExtId` strings only — no full card objects in any zone or pile
- WP-006A outputs (`zones.types.ts`, `zones.validate.ts`) must not be modified
  in this packet
- Tests use `makeMockCtx` from `src/test/mockCtx.ts` — do not import from
  `boardgame.io`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MatchSetupConfig count fields → GlobalPiles mapping** (pile sizes come
  from these exact config field names — do not rename or re-derive):
  `bystandersCount` → `bystanders` | `woundsCount` → `wounds` |
  `officersCount` → `officers` | `sidekicksCount` → `sidekicks`

- **PlayerZones keys** (`buildPlayerState` must return a `PlayerState` with
  exactly these 5 zone keys; all except `deck` must be initialized to `[]`):
  `deck` (shuffled starting deck) | `hand: []` | `discard: []` |
  `inPlay: []` | `victory: []`

- **GlobalPiles keys** (`buildGlobalPiles` must return a `GlobalPiles` with
  exactly these 4 keys):
  `bystanders` | `wounds` | `officers` | `sidekicks`

---

## Scope (In)

### A) `src/setup/playerInit.ts` — new
- `buildPlayerState(playerId: string, startingDeck: CardExtId[], ctx: Ctx): PlayerState`
- Shuffles `startingDeck` using `shuffleDeck` from `shuffle.ts`
- Returns a `PlayerState` where `zones.deck` is the shuffled starting deck;
  `zones.hand`, `zones.discard`, `zones.inPlay`, `zones.victory` are all `[]`
- `// why:` comment on the empty-zone initialization: cards enter non-deck
  zones through game moves; pre-populating them would bypass the move
  validation contract and break replay determinism

### B) `src/setup/pilesInit.ts` — new
- `buildGlobalPiles(config: MatchSetupConfig, ctx: Ctx): GlobalPiles`
- Builds each pile as a `CardExtId[]` sized from the config count fields:
  `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`
- Shuffles each pile using `shuffleDeck`
- `// why:` comment on the token ID convention used when game tokens are
  generic rather than distinct card ext_ids

### C) `src/setup/buildInitialGameState.ts` — modified
- Import and call `buildPlayerState` for each player
- Import and call `buildGlobalPiles` for the global piles
- Return a `G` typed as `LegendaryGameState` using the canonical types
- Function body shrinks significantly — helpers carry the per-player and
  pile logic

### D) Tests

**`src/setup/playerInit.shape.test.ts`** — new:
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Test 1: `buildPlayerState` returns a `PlayerState` with all 5 zones present
- Test 2: `zones.deck` is the reversed input (makeMockCtx reverses — proves
  shuffle ran, not identity)
- Test 3: `validatePlayerStateShape` returns `{ ok: false }` on a manually
  broken player object missing a zone

**`src/setup/validators.integration.test.ts`** — new:
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Calls `buildInitialGameState` with mock config and `makeMockCtx`
- Asserts `validateGameStateShape(G)` returns `{ ok: true }`
- Asserts `validatePlayerStateShape(player)` returns `{ ok: true }` for every
  player in `G`
- Asserts `JSON.stringify(G)` does not throw

---

## Out of Scope

- No gameplay moves (play card, recruit, fight, end turn)
- No win/loss conditions
- No city or HQ logic
- No scheme twist or master strike logic
- No persistence or PostgreSQL access
- No server or UI changes
- `src/state/zones.types.ts` and `src/state/zones.validate.ts` must not be
  modified — those are locked WP-006A outputs
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/setup/playerInit.ts` — **new** — player
  initialization helper
- `packages/game-engine/src/setup/pilesInit.ts` — **new** — global piles
  initialization helper
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  delegates to new helpers; typed against canonical zone types
- `packages/game-engine/src/setup/playerInit.shape.test.ts` — **new** — shape
  tests for `buildPlayerState`
- `packages/game-engine/src/setup/validators.integration.test.ts` — **new** —
  end-to-end validator integration test

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Player Initialization
- [ ] `src/setup/playerInit.ts` exports `buildPlayerState` with signature
      `(playerId: string, startingDeck: CardExtId[], ctx: Ctx): PlayerState`
- [ ] `buildPlayerState` returns `PlayerState` where `zones.deck` is the
      shuffled `startingDeck` and `zones.hand`, `zones.discard`, `zones.inPlay`,
      `zones.victory` are all `[]`
- [ ] `buildPlayerState` has a `// why:` comment on the empty-zone
      initialization
- [ ] `buildPlayerState` calls `shuffleDeck` — not `Math.random`
      (confirmed with `Select-String`)

### Global Piles Initialization
- [ ] `src/setup/pilesInit.ts` exports `buildGlobalPiles` with signature
      `(config: MatchSetupConfig, ctx: Ctx): GlobalPiles`
- [ ] `buildGlobalPiles` returns a `GlobalPiles` with all 4 pile keys:
      `bystanders`, `wounds`, `officers`, `sidekicks`
- [ ] `G.bystanders.length` equals `config.bystandersCount` after a setup run
- [ ] `G.wounds.length` equals `config.woundsCount` after a setup run

### Validator Integration
- [ ] `validateGameStateShape(G)` returns `{ ok: true }` on the output of
      `buildInitialGameState` with mock config and `makeMockCtx`
- [ ] `validatePlayerStateShape(player)` returns `{ ok: true }` for every
      player in the produced `G`
- [ ] `JSON.stringify(G)` does not throw — confirmed by integration test

### Determinism
- [ ] No `Math.random` in any new or modified file
      (confirmed with `Select-String`)
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 including
      the WP-005B determinism test — it must still pass

### Tests
- [ ] `playerInit.shape.test.ts` passes 3 tests (2 shape assertions, 1
      broken-player validator assertion)
- [ ] `validators.integration.test.ts` passes all assertions
- [ ] Neither test file imports from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Both test files use `makeMockCtx` from `src/test/mockCtx.ts`

### WP-006A Contract Protection
- [ ] `src/state/zones.types.ts` was not modified
      (confirmed with `git diff --name-only`)
- [ ] `src/state/zones.validate.ts` was not modified
      (confirmed with `git diff --name-only`)

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after modifications
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests (includes WP-005B determinism test and WP-006A
#           shape tests — all must continue to pass)
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm Math.random is not used in new files
Select-String -Path "packages\game-engine\src\setup\playerInit.ts","packages\game-engine\src\setup\pilesInit.ts" -Pattern "Math.random"
# Expected: no output

# Step 4 — confirm neither test file imports boardgame.io
Select-String -Path "packages\game-engine\src\setup\playerInit.shape.test.ts","packages\game-engine\src\setup\validators.integration.test.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — confirm WP-006A contract files were not modified
git diff --name-only packages/game-engine/src/state/zones.types.ts packages/game-engine/src/state/zones.validate.ts
# Expected: no output (these files must be untouched)

# Step 6 — confirm no files outside scope were changed
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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-005B determinism test)
- [ ] `validateGameStateShape(G)` returns `{ ok: true }` on setup output
- [ ] `validatePlayerStateShape(player)` returns `{ ok: true }` for all players
- [ ] No `Math.random` in any modified file (confirmed with `Select-String`)
- [ ] `src/state/zones.types.ts` and `src/state/zones.validate.ts` were not
      modified (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what is now fully initialized and
      validator-confirmed
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why pile initialization uses
      token IDs rather than registry ext_ids for generic game tokens; why
      `buildPlayerState` and `buildGlobalPiles` were extracted from
      `buildInitialGameState` rather than kept inline
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-006B checked off with today's date
