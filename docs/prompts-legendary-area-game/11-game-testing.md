# Prompt 11 — Game Testing Strategy

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. `node:test` and `node:assert` only — no Jest, Vitest, Mocha.
> No network access. No database connections. Tests must run in under 5 seconds.

## Assumes
- Prompts 04–05 complete: game rules engine and deck builder are implemented
- Node.js v22+ built-in test runner available (`node:test`)
- No testing framework installed yet

---

## Role
Write fast, deterministic unit tests for core game logic. No network, no DB,
no server. Tests must catch regressions when game rules change and be
maintainable by someone new to testing game logic.

---

## What to Test (and What Not To)

**Test:**
- Deck construction validity and correct sizes
- Move validation returns `INVALID_MOVE` for illegal actions
- Win and loss conditions trigger at the right thresholds
- Mastermind-specific setup (alwaysLeads villain group enforcement)
- Turn resets (recruit/fight points reset to 0 after endTurn)

**Do not test:**
- boardgame.io internals (trust the library)
- UI components
- Database queries
- WebSocket connectivity

---

## Deliverables

### 1. Test utilities (`src/game/__tests__/helpers.mjs`)

Provide:

**`makeMockCtx(overrides)`**
- Returns a minimal boardgame.io `ctx` object
- `ctx.random.Shuffle(arr)` returns the array reversed (deterministic, not identity)
- `ctx.events` stubs: `endTurn()`, `endPhase()`, `endGame()` as no-ops so game
  logic can call them safely without boardgame.io present
- `ctx.currentPlayer` defaults to `'0'`

**`makeMockRules(overrides)`**
- Returns a minimal rules cache with:
  - One mastermind (Galactus, strikeCount: 4, alwaysLeads: ['cosmic-threats'])
  - One scheme (twistCount: 8, epicCount: 0)
  - Two villain groups ('cosmic-threats', 'hydra')
  - Five hero sets (14 slugs each)
- Accepts `overrides` to customize individual fields for specific tests

**`makeGameState(overrides)`**
- Builds initial `G` using `buildGame()` with mock ctx and mock rules
- Accepts `overrides` to mutate `G` after construction (e.g. inject specific
  cards into a player's hand)

### 2. Deck builder tests (`src/game/__tests__/deckBuilder.test.mjs`)

- `alwaysLeads groups always included` — mastermind's required groups appear
  regardless of random selection
- `hero deck is exactly 70 slugs`
- `no duplicate slugs in hero deck`
- `starting hand is 8 cards per player for 1, 2, 3, 4, and 5 players`
- `villain deck length formula` — document the expected formula above the assertion,
  then verify it for a 2-player game

### 3. Move validation tests (`src/game/__tests__/moves.test.mjs`)

**`INVALID_MOVE` conditions:**
- `playCard` with slug not in player's hand
- `fightVillain` with empty city slot
- `fightVillain` with insufficient fight points
- `fightMastermind` with insufficient fight points
- Any move when it is not that player's turn

**Success conditions:**
- `playCard` adds card to play area, removes from hand
- `endTurn` resets recruitPoints and fightPoints to 0
- `endTurn` draws 6 cards (or remaining deck if < 6)

### 4. End condition tests (`src/game/__tests__/endConditions.test.mjs`)

- Returns `{ winner: 'heroes' }` when `mastermindsDefeated === strikeCount`
- Returns `{ winner: 'mastermind' }` when escaped villains reach threshold
- Does NOT end when counts are one below threshold (off-by-one check)
- Does NOT end when neither condition is met

### 5. Golden deterministic test (in `deckBuilder.test.mjs`)

Add one test using fixed `makeMockCtx()` that asserts the following are
stable across code changes (snapshot these identifiers, not full objects):
- Selected mastermind slug
- Selected scheme slug
- Villain group slugs (ordered)
- Hero set slugs (ordered)

Document: "If this test fails after a code change, the deck construction
algorithm has changed — this may break replays for existing active games."

### 6. `package.json` script

```json
{ "test": "node --test src/game/__tests__/**/*.test.mjs" }
```

Show the expected passing terminal output.

---

## Hard Constraints

- `node:test` and `node:assert` only — no external test frameworks
- Each test file must be independently runnable
- Test helpers must NOT import from boardgame.io
- No network access, no database connections in any test
- Total suite must run in under 5 seconds
