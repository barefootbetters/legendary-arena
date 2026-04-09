# Prompt 04 — Game Rules Engine (boardgame.io Game Definition)

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. boardgame.io Game() must be deterministic.
> No Math.random(). No database access in moves. G must be JSON-serializable.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

## Assumes

- Prompts 01–03 complete: server runs, PostgreSQL has rules data
- `src/rules/loader.mjs` exists (from Prompt 01) and exports `loadRules()` / `getRules()`
- boardgame.io v0.50.x is installed

---

## Role

You are a senior game engineer implementing the Legendary board game rules as a
boardgame.io `Game()` definition. You understand the difference between game
state that must be deterministic and rules data loaded at startup. You write
moves that are pure functions — same inputs always produce same outputs.

---

## Game Rules Reference (Marvel Legendary)

Legendary is a cooperative deck-building game. Key mechanics:

**Setup:**
- One mastermind chosen (has a strike count and always-leads villain groups)
- One scheme chosen (has twist count, epic count, setup notes)
- Villain groups matching the mastermind's `alwaysLeads` are always included
- Remaining villain group slots filled randomly from the active expansion pool
- Hero deck built from 5 hero sets (14 cards each = 70 cards)
- Villain deck: Mastermind Tactic cards, Strike cards, Twist cards, Bystanders,
  Master Strike cards

**Turn structure (per player):**
1. Reveal top villain deck card → place in city
2. Move all villains in city one space right
3. Villain at rightmost city space escapes → add to escape pile
4. Play cards from hand
5. Recruit heroes using recruit points
6. Fight villains or mastermind using fight points
7. Discard hand, draw 6 new cards

**Win/loss conditions:**
- Win: mastermind defeated N times (N = mastermind's `strike_count`)
- Lose: mastermind escapes 5 times OR scheme twist threshold reached

---

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Moves are explicit `if/else` blocks** — validate preconditions step by step.
  Do not chain guard clauses into a single compound expression.
  ```js
  // BAD — too much logic compressed into one line
  if (!hand.includes(cardSlug) || !isCurrentPlayer) return INVALID_MOVE;

  // GOOD — each check on its own with its own comment
  if (!currentPlayerHand.includes(cardSlug)) {
    // why: the card the player tried to play is not in their hand
    return INVALID_MOVE;
  }
  ```
- **`G` field access is always explicit** — write `G.players[playerID].hand`,
  not a helper like `getPlayerHand(G, playerID)` (one-time use abstraction).
- **Readable names in moves** — `currentPlayerHand`, `citySlotContents`,
  `mastermindsStrikeCount`, not `hand`, `slot`, `strikes`.
- **Comments explain the game rule** — every move function and `endIf` check
  must have a comment referencing the Legendary rulebook concept it enforces.
- **No higher-order functions** — do not wrap moves in a factory.
  Declare each move as a plain named function and reference it in the `moves` map.

---

## Deliverables

### 1. Game state shape (`src/game/state.mjs`)

Export a JSDoc typedef for the complete `G` object. Every field must have a
comment explaining what it represents and whether it comes from rules data
or from player actions.

Required fields at minimum:
- `players` — map of playerID → `{ hand[], deck[], discard[], recruitPoints, fightPoints }`
- `city` — array of 5 villain card slots (null = empty)
- `villainDeck` — shuffled array of villain card slugs
- `heroDeck` — shuffled array of hero card slugs
- `hq` — array of 6 hero card slugs (face-up recruit pool)
- `escapedVillains` — array of escaped villain slugs
- `mastermindsDefeated` — number (counts toward win condition)
- `schemeProgress` — `{ twists: number, epics: number }`
- `activePlayerID` — string

### 2. Game definition (`src/game/legendary.mjs`)

Implement boardgame.io `Game()` with:

**Phases:**
- `setup` — runs once via `onBegin`, not a player turn
- `villainPhase` — automated reveal + movement (no player input)
- `playerTurn` — main interactive phase

**Moves (in `playerTurn` phase):**
- `playCard(cardSlug)` — move card from hand to play area, apply recruit/fight value
- `recruitHero(cardSlug)` — spend recruit points to acquire hero from HQ
- `fightVillain(citySlot)` — spend fight points to defeat villain in city slot
- `fightMastermind()` — spend fight points to strike the mastermind
- `endTurn()` — discard hand, draw 6, trigger villain phase for next player

Each move must be declared as a named function (`function playCard(G, ctx, cardSlug)`)
and referenced by name in the `moves` map — not written as an anonymous arrow function
inline in the object literal.

**endIf:**
- Win: `mastermindsDefeated >= rules.mastermind.strikeCount`
- Lose: escaped villain count ≥ threshold OR scheme twists ≥ `scheme.twist_count`
- Return `{ winner: 'heroes' }` or `{ winner: 'mastermind' }`

**setup() function:**
- Accepts `ctx` and `setupData` (`{ mastermindsSlug, schemeSlug }`)
- Calls `getRules()` to load mastermind and scheme rules
- Calls deck builder (imported from `src/game/deckBuilder.mjs` — stubbed for now)
- Returns initial `G`

### 3. Move validation

Each move validates preconditions step by step with one check per `if` block.
Each `if` block that returns `INVALID_MOVE` must have a `// why:` comment
explaining which game rule the check enforces:
- `playCard`: card must be in current player's hand
- `fightVillain`: city slot must be occupied AND fight points must be sufficient
- `fightMastermind`: fight points must be sufficient
- Any move: must be current player's turn (boardgame.io enforces this, but
  show the pattern for custom validation)

### 4. Comment block at top of `legendary.mjs`

Explain:
- Why `G` contains slugs, not full card objects (keeps `G` small and serializable;
  display data is in R2; rules data is in `rulesCache`)
- Why moves must be pure functions (boardgame.io replays moves for reconnecting clients)
- What `INVALID_MOVE` does in an authoritative server context (the move is rejected
  server-side; the client state is not updated)

---

## Hard Constraints

- ESM only
- boardgame.io v0.50.x: `Game()`, `INVALID_MOVE` from `boardgame.io/core`
- `G` must be JSON-serializable at all times (no class instances, no functions)
- No database queries inside moves — rules pre-loaded in `rulesCache`
- No randomness outside `ctx.random.*` (required for deterministic replay)
- Deck builder logic goes in `src/game/deckBuilder.mjs` — stub here, implement in Prompt 05
- **Each move is a named function declaration**, not an anonymous arrow function
- **Each validation check is its own `if` block** with a `// why:` comment
- **No abbreviated variable names** — `currentPlayerHand`, not `hand`; `citySlotContents`, not `slot`
- **No higher-order functions** wrapping moves
- **No `Array.reduce()`** — use explicit `for...of` loops
- **No nested ternaries** in move logic
- **All error messages and log lines are full sentences**
- **Every non-obvious block has a `// why:` comment**
