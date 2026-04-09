# Prompt 11 — Game Testing Strategy

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. `node:test` and `node:assert` only — no Jest, Vitest, Mocha.
> No network access. No database connections. Tests must run in under 5 seconds.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

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

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Test names are full sentences** — they describe what the system does, not what
  the test checks:
  ```js
  // BAD
  test('villain groups', () => { ... });

  // GOOD
  test('selectVillainGroups always includes every group listed in the mastermind alwaysLeads array', () => { ... });
  ```
- **Each `assert` has a descriptive message** — the third argument to `assert.strictEqual`
  and `assert.ok` must explain what the assertion is checking:
  ```js
  // BAD
  assert.strictEqual(heroDeck.length, 70);

  // GOOD
  assert.strictEqual(heroDeck.length, 70, 'Hero deck must contain exactly 70 slugs (5 hero sets × 14 cards each)');
  ```
- **Test setup is explicit** — do not use `beforeEach` for shared state that
  changes between tests. Build the state you need inside each test with
  `makeMockCtx()` and `makeMockRules()`.
- **Helper functions are named and flat** — `makeMockCtx`, `makeMockRules`,
  and `makeGameState` are plain function declarations, not returned from a class
  or factory.
- **No `describe()` nesting deeper than one level** — group by feature, not by
  sub-feature.
- **`// why:` comments on the golden test** — explain why the test exists and
  what it means when it fails.

---

## Deliverables

### 1. Test utilities (`src/game/__tests__/helpers.mjs`)

Provide plain named function declarations (not a class, not a returned object):

**`function makeMockCtx(overrides)`**
- Returns a minimal boardgame.io `ctx` object
- `ctx.random.Shuffle(array)` returns the array reversed (deterministic, not identity)
- `ctx.events.endTurn()`, `ctx.events.endPhase()`, `ctx.events.endGame()` are no-ops
  — written as explicit named properties, not looped over a list of event names
- `ctx.currentPlayer` defaults to `'0'`
- `overrides` is merged with `Object.assign()` — not spread syntax

**`function makeMockRules(overrides)`**
- Returns a minimal rules cache with explicitly listed fields:
  - One mastermind object with: `slug: 'galactus'`, `strikeCount: 4`,
    `alwaysLeads: ['cosmic-threats']`
  - One scheme object with: `twistCount: 8`, `epicCount: 0`
  - Two villain group objects: `{ slug: 'cosmic-threats', cards: [...] }`,
    `{ slug: 'hydra', cards: [...] }`
  - Five hero set objects, each with 14 explicit slug strings
- Fields listed explicitly — not generated in a loop
- `overrides` merged with `Object.assign()` at the top level

**`function makeGameState(overrides)`**
- Builds initial `G` using `buildGame()` with `makeMockCtx()` and `makeMockRules()`
- Applies `overrides` with `Object.assign()` after construction
- Has a JSDoc comment explaining that `overrides` mutates `G` after construction,
  and is intended for injecting specific cards into a player's hand for move tests

### 2. Deck builder tests (`src/game/__tests__/deckBuilder.test.mjs`)

Each test is a full-sentence description. Each `assert` has a message argument:

- `'selectVillainGroups always includes every group listed in the mastermind alwaysLeads array'`
- `'buildHeroDeck returns exactly 70 slugs when given 5 hero sets of 14 cards each'`
- `'buildHeroDeck contains no duplicate slugs'`
- `'dealPlayerHands gives each player exactly 8 cards for player counts 1 through 5'`
  (use an explicit `for` loop over `[1, 2, 3, 4, 5]`, not `.forEach`)
- `'villain deck length matches the expected formula for a 2-player game'`
  (document the formula in a comment above the assertion)

### 3. Move validation tests (`src/game/__tests__/moves.test.mjs`)

**`INVALID_MOVE` conditions** (each is a separate named test):
- `'playCard returns INVALID_MOVE when the card slug is not in the current player hand'`
- `'fightVillain returns INVALID_MOVE when the targeted city slot is empty'`
- `'fightVillain returns INVALID_MOVE when the player has fewer fight points than required'`
- `'fightMastermind returns INVALID_MOVE when the player has fewer fight points than required'`

**Success conditions:**
- `'playCard removes the card from the player hand and adds it to the play area'`
- `'endTurn resets recruitPoints and fightPoints to zero for the active player'`
- `'endTurn draws 6 cards from the deck when the deck has 6 or more cards remaining'`

Each test builds its own state using `makeGameState(overrides)` — no shared state.

### 4. End condition tests (`src/game/__tests__/endConditions.test.mjs`)

Each test is a separate named test with a full-sentence description:
- `'endIf returns winner heroes when mastermindsDefeated equals the mastermind strikeCount'`
- `'endIf returns winner mastermind when escaped villains reach the threshold'`
- `'endIf returns undefined when mastermindsDefeated is one less than strikeCount'`
  (explicit off-by-one check — include a `// why:` comment explaining the boundary)
- `'endIf returns undefined when neither win nor loss condition is met'`

### 5. Golden deterministic test (in `deckBuilder.test.mjs`)

One test using fixed `makeMockCtx()` that asserts stability across code changes.
Assert these identifiers exactly (snapshot the values as string literals in the test):
- Selected mastermind slug
- Selected scheme slug
- Villain group slugs (ordered)
- Hero set slugs (ordered)

Include this exact comment block above the test:
```js
// GOLDEN TEST — do not change the expected values without reading this comment.
// why: This test verifies that the deck construction algorithm is deterministic.
// If this test fails after a code change, the setup output has changed.
// That means any game that was saved or replayed before the change will now
// produce different results — which is a bug. Update these expected values only
// if you have intentionally changed the algorithm and understand the impact.
```

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
- **Test names are full sentences** — no abbreviations or terse descriptions
- **Every `assert` has a descriptive message** as the last argument
- **Test setup is inside each test** — no shared mutable state between tests
- **Helper functions are named flat function declarations** — not class methods
  or factory returns
- **No `describe()` nesting deeper than one level**
- **`ctx.events` stubs are listed explicitly** — not generated in a loop
- **Golden test has the exact comment block** specified above
- **`// why:` comments** on the golden test, off-by-one checks, and any
  non-obvious game rule being tested
