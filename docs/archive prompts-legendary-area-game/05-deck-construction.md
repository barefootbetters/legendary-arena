# Prompt 05 — Deck Construction

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. No Math.random() — ctx.random only.
> No database queries — all data from the rules parameter. G must be JSON-serializable.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

## Assumes

- Prompts 01–04 complete
- `src/game/legendary.mjs` exists with a stubbed `deckBuilder` import
- `src/game/state.mjs` defines the `G` typedef (from Prompt 04)
- `getRules()` returns the full rules cache including villain groups and hero sets
- R2 JSON slugs are the card identity system

---

## Role

You are implementing the setup phase of Legendary: selecting game components,
shuffling decks, and building the initial game state. This is pure game logic —
no UI, no networking. Every randomization must use boardgame.io's `ctx.random`
so the setup is reproducible for reconnecting clients.

---

## Legendary Setup Rules

**Mastermind selection:** One mastermind from the active pool.
Mastermind's `alwaysLeads` villain groups are required inclusions.

**Villain group selection:**
- Required groups (from `alwaysLeads`) fill first slots
- Remaining slots filled randomly from available villain groups
- Total villain groups = player count + 1 (1 player = 2, 2 players = 3, max 5)

**Scheme selection:** One scheme from the active pool (random unless specified).

**Hero selection:** 5 hero sets selected randomly from available heroes.
Each hero set contributes 14 cards to the hero deck. Hero deck is shuffled.

**Villain deck composition (per villain group):**
- 3 common villain cards + 1 rare villain card (if exists)
Shuffle all villain cards together, then add on top:
- Scheme Twist cards (count from `scheme.twist_count`)
- Master Strike cards (one per player)
- Bystander cards (1 per villain group + any scheme extras)

**HQ:** 6 hero cards dealt face-up as the recruit pool.

**Starting player hands:** Each player receives 8 cards:
- 6 S.H.I.E.L.D. Agent cards
- 2 S.H.I.E.L.D. Trooper cards

---

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Sub-functions are named operations, not utilities** — each sub-function
  (`selectMastermind`, `buildVillainDeck`, etc.) does one clearly named step
  of the setup process. None of them are shared helpers; they are sequential steps.
- **Explicit loops everywhere** — building decks is done with `for...of` loops,
  not `.map()`, `.flatMap()`, or `.reduce()`.
  ```js
  // BAD
  const villainSlugs = villainGroups.flatMap(group => group.cards.map(card => card.slug));

  // GOOD
  const villainSlugs = [];
  for (const villainGroup of villainGroups) {
    for (const card of villainGroup.cards) {
      villainSlugs.push(card.slug);
    }
  }
  ```
- **Readable names** — `selectedVillainGroups`, `requiredVillainGroups`,
  `remainingVillainGroupSlots`, not `groups`, `required`, `remaining`.
- **Validation is explicit `if` blocks** — each post-construction check is its own
  `if` block with a full-sentence error message explaining which rule was violated.
- **Constants are named** — `SHIELD_AGENT_SLUG`, `SHIELD_TROOPER_SLUG`,
  `STARTING_HAND_SIZE`, `HQ_SIZE` declared at the top of the file.

---

## Deliverables

### 1. Deck builder module (`src/game/deckBuilder.mjs`)

Export one function: `buildGame(ctx, setupData, rules)`

Parameters:
- `ctx` — boardgame.io context (use `ctx.random.Shuffle()` for all randomization)
- `setupData` — `{ mastermindsSlug?: string|null, schemeSlug?: string|null, playerCount: number }`
  (null values = random selection)
- `rules` — the full rules cache from `getRules()`

Returns the complete initial `G` object matching the typedef from Prompt 04.

Break into clearly named sub-functions, each declared with `function` keyword
(not arrow functions) and a JSDoc comment:
- `selectMastermind(ctx, setupData, rules)` → mastermind object
- `selectScheme(ctx, setupData, rules)` → scheme object
- `selectVillainGroups(ctx, mastermind, rules, playerCount)` → array of villain group objects
- `buildVillainDeck(ctx, villainGroups, scheme, playerCount)` → shuffled slug array
- `selectHeroes(ctx, rules)` → 5 hero set objects
- `buildHeroDeck(ctx, heroSets)` → shuffled slug array
- `dealPlayerHands(heroDeck, playerCount)` → `{ players map, remainingDeck }`
- `dealHQ(heroDeck)` → `{ hq: string[6], remainingDeck }`

Each sub-function must fit on one screen (30 lines max). If it is longer,
break it into additional named steps.

### 2. Setup validation

After deck construction, validate before returning. Each check is its own `if`
block with a full-sentence error message that tells a junior developer exactly
what went wrong and what the expected value was:

```js
// Example of the required style
if (villainDeck.length !== expectedVillainDeckLength) {
  throw new Error(
    `Villain deck has ${villainDeck.length} cards but expected ${expectedVillainDeckLength}. ` +
    'Check the villain group count, scheme twist count, and player count inputs.'
  );
}
```

Document the villain deck length formula in a `// formula:` comment above the check.

### 3. `setupData` API documentation

JSDoc block documenting the `setupData` object the lobby (Prompt 06) will pass
when creating a game. Include all optional fields and their defaults.

### 4. Unit test scaffolding (`src/game/__tests__/deckBuilder.test.mjs`)

Tests using Node.js built-in `test` module (no Jest):
- `selectVillainGroups` always includes the mastermind's `alwaysLeads` groups
- `buildHeroDeck` always returns exactly 70 slugs
- `buildGame` with a fixed `ctx.random` mock returns a deterministic result
- Starting hand is exactly 8 cards per player for 1–5 players

Test names must be full sentences describing the expected behavior, not
abbreviations: `'selectVillainGroups includes all alwaysLeads groups from the mastermind'`

---

## Hard Constraints

- ESM only
- No randomness outside `ctx.random.*` — never `Math.random()`
- No database queries — all data comes from the `rules` parameter
- The function must be pure: same `ctx` + same `setupData` + same `rules` = same output
- Card slugs are the only identifier in deck arrays (no full card objects)
- S.H.I.E.L.D. Agent and Trooper slugs are named constants at the top of the file
- **All sub-functions declared with `function` keyword** — no anonymous arrow functions
- **No `Array.flatMap()`, `.map()`, or `.reduce()`** for building deck arrays —
  use explicit `for...of` loops with `push()`
- **No abbreviated variable names** — full English words throughout
- **Each validation check is its own `if` block** with a full-sentence error message
- **No nested ternaries**
- **No function longer than 30 lines**
- **Named constants for all magic numbers**: hand size, HQ size, hero set size,
  max villain groups
- **Every non-obvious block has a `// why:` comment**
