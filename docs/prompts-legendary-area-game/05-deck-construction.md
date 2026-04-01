# Prompt 05 — Deck Construction

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. No Math.random() — ctx.random only.
> No database queries — all data from the rules parameter. G must be JSON-serializable.

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

## Deliverables

### 1. Deck builder module (`src/game/deckBuilder.mjs`)

Export one function: `buildGame(ctx, setupData, rules)`

Parameters:
- `ctx` — boardgame.io context (use `ctx.random.Shuffle()` for all randomization)
- `setupData` — `{ mastermindsSlug?: string|null, schemeSlug?: string|null, playerCount: number }`
  (null values = random selection)
- `rules` — the full rules cache from `getRules()`

Returns the complete initial `G` object matching the typedef from Prompt 04.

Break into clearly named sub-functions:
- `selectMastermind(ctx, setupData, rules)` → mastermind object
- `selectScheme(ctx, setupData, rules)` → scheme object
- `selectVillainGroups(ctx, mastermind, rules, playerCount)` → array of villain group objects
- `buildVillainDeck(ctx, villainGroups, scheme, playerCount)` → shuffled slug array
- `selectHeroes(ctx, rules)` → 5 hero set objects
- `buildHeroDeck(ctx, heroSets)` → shuffled slug array
- `dealPlayerHands(heroDeck, playerCount)` → `{ players map, remainingDeck }`
- `dealHQ(heroDeck)` → `{ hq: string[6], remainingDeck }`

### 2. Setup validation

After deck construction, validate before returning:
- Villain deck length matches this formula (document it in a comment):
  `(villainGroups × 4) + scheme.twist_count + playerCount + villainGroups`
- Hero deck length after HQ deal = 70 - 6 = 64 cards
- Each player starts with exactly 8 cards
- HQ contains exactly 6 slugs
- Throw a descriptive error if validation fails

### 3. `setupData` API documentation

JSDoc block documenting the `setupData` object the lobby (Prompt 06) will pass
when creating a game. Include all optional fields and their defaults.

### 4. Unit test scaffolding (`src/game/__tests__/deckBuilder.test.mjs`)

Tests using Node.js built-in `test` module (no Jest):
- `selectVillainGroups` always includes the mastermind's `alwaysLeads` groups
- `buildHeroDeck` always returns exactly 70 slugs
- `buildGame` with a fixed `ctx.random` mock returns a deterministic result
- Starting hand is exactly 8 cards per player for 1–5 players

---

## Hard Constraints

- ESM only
- No randomness outside `ctx.random.*` — never `Math.random()`
- No database queries — all data comes from the `rules` parameter
- The function must be pure: same `ctx` + same `setupData` + same `rules` = same output
- Card slugs are the only identifier in deck arrays (no full card objects)
- S.H.I.E.L.D. Agent and Trooper slugs are constants defined at the top of the file
