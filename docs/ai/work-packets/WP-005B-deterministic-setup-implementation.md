# WP-005B — Deterministic Setup Implementation

**Status:** Ready
**Primary Layer:** Game Engine / Setup
**Dependencies:** WP-005A

---

## Session Context

WP-005A locked the canonical `MatchSetupConfig` type, `validateMatchSetup`,
and their result types. This packet implements the actual setup: it wires
`Game.setup()` to call `validateMatchSetup` first then throw on failure, builds
the fully-populated initial `G`, and establishes `makeMockCtx` — the shared
test helper used by every subsequent game-logic packet.

---

## Goal

Implement deterministic match setup so that `Game.setup()` transforms a
validated `MatchSetupConfig` into a fully populated initial `G` using
`ctx.random.*` exclusively for all shuffling.

After this session, `@legendary-arena/game-engine`:
- Has `shuffleDeck(cards, ctx)` — deterministic, `ctx.random.Shuffle` only,
  never mutates input
- Has `makeMockCtx` — the shared test helper; `Shuffle` reverses arrays (not
  identity)
- Has `buildInitialGameState(config, registry, ctx)` — produces a fully
  populated `G` with global piles, per-player zones, and selection metadata
- Has `Game.setup()` that calls `validateMatchSetup` first, throws on failure,
  then calls `buildInitialGameState`
- Passes a determinism test: two calls with the same `makeMockCtx` produce
  identical `G`

---

## Assumes

- WP-005A complete. Specifically:
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`,
    `MatchSetupError`, and `ValidateMatchSetupResult` (WP-005A)
  - `packages/game-engine/src/matchSetup.validate.ts` exports
    `validateMatchSetup` (WP-005A)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `packages/game-engine/src/types.ts` exports `LegendaryGameState` (WP-002)
- `packages/game-engine/src/game.ts` exports `LegendaryGame` with a `setup()`
  stub (WP-002)
- `@legendary-arena/registry` exports `CardRegistry` and
  `createRegistryFromLocalFiles` (WP-003)
- `data/metadata/` and `data/cards/` contain real card data
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Match Lifecycle" step 3 for
  the full `buildInitialGameState` flow, and "Zone & Pile Structure" for the
  canonical zone layout (5 zones per player, 4 global piles). Also read "Card
  Field Data Quality" — hero card `cost`, `attack`, and `recruit` are
  `string | number | undefined`, not clean integers.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "The Move Validation Contract"
  and specifically the `Game.setup()` throwing table. `Game.setup()` is the
  ONLY place in the engine where throwing is correct. Moves must never throw.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — the exact 9 fields of
  `MatchSetupConfig`. Setup consumes these fields; do not rename or re-derive
  them.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — match runtime state
  boundaries: `G` and `ctx` are managed by boardgame.io in memory. `G` must
  never be written to PostgreSQL. `G` must always be JSON-serializable.
- `docs/ai/REFERENCE/00.2-data-requirements.md §1.2` — hero deck shape: heroes
  are organised as decks, not flat card lists. Setup builds player starting
  decks by flattening the hero deck's cards into `ext_id` strings.
- `packages/game-engine/src/types.ts` — the `LegendaryGameState` type. Read it
  entirely before adding new fields — avoid duplicates or conflicts.
- `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig` and
  `ValidateMatchSetupResult` from WP-005A. This file must not be modified.
- `packages/registry/src/types/index.ts` — `CardRegistry` interface and the
  `Hero`, `Mastermind`, `VillainGroup`, `Scheme` types. Setup resolves `ext_id`
  strings into these objects to build deck contents.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 6 (`// why:`
  comments on `ctx.random` usage and non-obvious shuffle logic), Rule 8 (no
  `Array.reduce()` in deck construction — use `for...of`), Rule 13 (ESM only),
  Rule 14 (no renamed fields).

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
- No database or network access in helpers
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `shuffleDeck` uses `ctx.random.Shuffle` only — never `Math.random()`; add a
  `// why:` comment explaining determinism for replay
- `shuffleDeck` returns a new array — never mutates its input
- `makeMockCtx` reverses arrays for its `Shuffle` implementation — not identity;
  add a `// why:` comment explaining that identity would not prove the shuffle
  ran
- `makeMockCtx` must not import from `boardgame.io`
- `Game.setup()` calls `validateMatchSetup` first, then throws `Error` with the
  first error's `message` if `ok: false` — this is the ONLY place in the engine
  where throwing is correct; moves must never throw
- No `.reduce()` in deck construction — use `for...of` loops
- `G` stores `ext_id` strings only — no full card objects in any zone or pile
- WP-005A outputs (`matchSetup.types.ts`, `matchSetup.validate.ts`) must not
  be modified in this packet

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **MatchSetupConfig fields** (setup reads all 9 to build `G` — these are the
  exact names consumed by `buildInitialGameState`):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **PlayerZones keys** (each player's zone object must have exactly these 5
  keys — all arrays of `CardExtId` strings; only `deck` is non-empty after
  setup):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- **GlobalPiles keys** (the global pile object must have exactly these 4 keys;
  sizes come from the matching `MatchSetupConfig` count fields):
  `bystanders` (← `bystandersCount`) | `wounds` (← `woundsCount`) |
  `officers` (← `officersCount`) | `sidekicks` (← `sidekicksCount`)

---

## Scope (In)

### A) `src/setup/shuffle.ts` — new
- `shuffleDeck(cards: string[], ctx: Ctx): string[]` — returns a new shuffled
  array using `ctx.random.Shuffle`; never mutates the input array
- `// why:` comment: explains why `ctx.random.Shuffle` is used instead of
  `Math.random()` — determinism is required for replay

### B) `src/test/mockCtx.ts` — new (shared test helper for all future packets)
- `makeMockCtx(overrides?)` — returns a minimal `Ctx`-like object:
  - `ctx.random.Shuffle(arr)` — reverses the array (proves shuffle ran; identity
    would not)
  - `ctx.events.endTurn()`, `ctx.events.endPhase()`, `ctx.events.endGame()` —
    no-ops
- No import from `boardgame.io`
- `// why:` comment: explains why reverse-not-identity is used

### C) `src/setup/buildInitialGameState.ts` — new
- `buildInitialGameState(config: MatchSetupConfig, registry: CardRegistry, ctx: Ctx): LegendaryGameState`
- Resolves all IDs from config against the registry
- Builds global piles (`bystanders`, `wounds`, `officers`, `sidekicks`) as
  shuffled `string[]` of `ext_id` values — lengths match the config count
  fields
- Builds per-player starting decks as 8 S.H.I.E.L.D. cards per player,
  shuffled using `shuffleDeck`
- Populates `G.playerZones` keyed by player index — each player zone has:
  `deck: string[]`, `hand: string[]`, `discard: string[]`,
  `inPlay: string[]`, `victory: string[]`
- Populates `G.selection` with resolved scheme, mastermind, villain groups,
  and hero deck IDs
- Uses `for...of` loops for deck construction — no `.reduce()`

### D) `src/game.ts` — modified
- Wire `LegendaryGame.setup(ctx, matchData)` to:
  1. Call `validateMatchSetup(matchData, registry)` — if `ok: false`, throw
     `new Error(result.errors[0].message)`
  2. Call `buildInitialGameState(matchData, registry, ctx)` and return the
     result
- Add `// why:` comments: why validation runs before `G` is built; why throwing
  here is correct (the only place in the engine)

### E) `src/types.ts` — modified
- Expand `LegendaryGameState` to include the new `G` fields added in this
  packet: `selection`, `playerZones`, `bystanders`, `wounds`, `officers`,
  `sidekicks`

### F) Tests

**`src/setup/buildInitialGameState.shape.test.ts`** — new:
- Given a valid config and mock registry, `G` has all required top-level keys
- `G.playerZones` has one entry per player, each with all 5 zone arrays
- `G.bystanders.length` equals `config.bystandersCount`
- `G.wounds.length` equals `config.woundsCount`
- `JSON.stringify(G)` does not throw
- Uses `makeMockCtx` from `src/test/mockCtx.ts`
- Does not import from `boardgame.io`

**`src/setup/buildInitialGameState.determinism.test.ts`** — new:
- Calling `buildInitialGameState` twice with the same `makeMockCtx()` instance
  produces identical `G` (same card order, same zone contents)
- `// why:` comment warning that a failure here indicates a replay-breaking change
- Uses `makeMockCtx` from `src/test/mockCtx.ts`
- Does not import from `boardgame.io`

---

## Out of Scope

- No gameplay moves (play card, recruit, fight, end turn) — those are WP-008A/B
- No win/loss conditions — that is WP-010
- No scheme twist or master strike logic
- No city or villain deck construction — those are WP-014 and WP-015
- No PostgreSQL access
- No server or UI changes
- WP-005A outputs (`matchSetup.types.ts`, `matchSetup.validate.ts`) must not
  be modified
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/setup/buildInitialGameState.ts` — **new** — setup
  builder
- `packages/game-engine/src/setup/shuffle.ts` — **new** — `ctx.random`-only
  shuffle helper
- `packages/game-engine/src/test/mockCtx.ts` — **new** — shared test helper
- `packages/game-engine/src/game.ts` — **modified** — wire validate +
  buildInitialGameState
- `packages/game-engine/src/types.ts` — **modified** — expand
  `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — export new public types
  if needed
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **new**
- `packages/game-engine/src/setup/buildInitialGameState.determinism.test.ts`
  — **new**

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### shuffleDeck
- [ ] `src/setup/shuffle.ts` exports `shuffleDeck` with signature
      `(cards: string[], ctx: Ctx): string[]`
- [ ] `shuffleDeck` calls `ctx.random.Shuffle` — not `Math.random`
      (confirmed with `Select-String`)
- [ ] `shuffleDeck` returns a new array — does not mutate its input
- [ ] `shuffleDeck` has a `// why:` comment on `ctx.random.Shuffle` usage

### makeMockCtx
- [ ] `src/test/mockCtx.ts` exports `makeMockCtx`
- [ ] `makeMockCtx().random.Shuffle([1, 2, 3])` returns `[3, 2, 1]` (reverses —
      not identity)
- [ ] `src/test/mockCtx.ts` contains no import from `boardgame.io`
      (confirmed with `Select-String`)

### buildInitialGameState and Game.setup()
- [ ] `src/setup/buildInitialGameState.ts` exports `buildInitialGameState`
      with signature `(config: MatchSetupConfig, registry: CardRegistry, ctx: Ctx): LegendaryGameState`
- [ ] `G` returned by `buildInitialGameState` has all required top-level keys:
      `selection`, `playerZones`, `bystanders`, `wounds`, `officers`, `sidekicks`
- [ ] `G.playerZones` has one entry per player, each with keys:
      `deck`, `hand`, `discard`, `inPlay`, `victory` — all `string[]`
- [ ] `G.bystanders.length` equals `config.bystandersCount`
- [ ] `G` stores `ext_id` strings only — no full card objects in any zone or pile
- [ ] `Game.setup()` in `src/game.ts` calls `validateMatchSetup` before any
      deck construction begins
- [ ] `Game.setup()` with an invalid config throws an `Error` whose message is
      a full sentence naming the failing field
- [ ] No `Math.random` in any new or modified file
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files, including WP-005A tests)
- [ ] `JSON.stringify(G)` succeeds — confirmed by the shape test
- [ ] Determinism test passes: two calls with the same `makeMockCtx` instance
      produce identical `G`
- [ ] Neither test file imports from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Both test files use `makeMockCtx` from `src/test/mockCtx.ts`

### WP-005A contract protection
- [ ] `src/matchSetup.types.ts` was not modified
- [ ] `src/matchSetup.validate.ts` was not modified
      (confirmed with `git diff --name-only`)

### Scope Enforcement
- [ ] No `Math.random` in any file under `packages/game-engine/src`
      (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests (WP-005A tests + new tests)
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm Math.random is not used anywhere in the package
Select-String -Path "packages\game-engine\src" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 4 — confirm shuffleDeck uses ctx.random.Shuffle
Select-String -Path "packages\game-engine\src\setup\shuffle.ts" -Pattern "ctx.random.Shuffle"
# Expected: at least one match

# Step 5 — confirm mockCtx does not import boardgame.io
Select-String -Path "packages\game-engine\src\test\mockCtx.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 6 — confirm neither test file imports boardgame.io
Select-String -Path "packages\game-engine\src\setup\buildInitialGameState.shape.test.ts","packages\game-engine\src\setup\buildInitialGameState.determinism.test.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 7 — confirm WP-005A contract files were not modified
git diff --name-only packages/game-engine/src/matchSetup.types.ts packages/game-engine/src/matchSetup.validate.ts
# Expected: no output (these files must be untouched)

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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test
      files)
- [ ] No `Math.random` anywhere in `packages/game-engine/src`
      (confirmed with `Select-String`)
- [ ] `makeMockCtx` exists and reverses arrays — not identity
- [ ] `JSON.stringify(G)` succeeds on a setup result with mock data
- [ ] Determinism test passes
- [ ] `src/matchSetup.types.ts` and `src/matchSetup.validate.ts` were not
      modified (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what is now working end-to-end
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why player starting decks
      use `ext_id` strings rather than full card objects in `G`; why
      `makeMockCtx` reverses arrays rather than using identity shuffle
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-005B checked off with today's date
