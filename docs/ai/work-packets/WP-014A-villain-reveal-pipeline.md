# WP-014A — Villain Reveal & Trigger Pipeline (Types + Move + Tests)

**Status:** Ready
**Primary Layer:** Game Engine / Core Gameplay
**Dependencies:** WP-013

---

## Session Context

WP-013 established the persistence boundary model and created
`docs/ai/ARCHITECTURE.md`. This packet introduces the villain deck types and
a deterministic reveal pipeline that wires the WP-009B rule pipeline to emit
triggers on card reveal. WP-015 will modify routing for villain/henchman cards
to the City; this packet sends all revealed cards to `discard`.

**Split note:** `buildVillainDeck` (real deck construction from registry data)
is deferred to WP-014B. The current registry schema does not define henchman
card instances, scheme twist card identifiers, or per-scheme/per-player deck
composition counts. Those are data-model decisions that belong in a dedicated
packet. See DECISIONS.md for the split rationale.

This packet establishes:
- The `VillainDeckState` and `RevealedCardType` contracts
- The `revealVillainCard` move (assuming a deck already exists in `G`)
- Tests that prove the reveal pipeline using mock deck fixtures
- Empty-default villain deck fields in `G` (populated by WP-014B)

---

## Goal

Introduce the villain deck type contracts and a deterministic reveal pipeline
that draws cards from the deck, looks up their classification, emits the
correct rule triggers through the WP-009B runtime, and applies the resulting
effects to `G`.

After this session:
- `G.villainDeck` exists with `deck` and `discard` arrays of `CardExtId`
  strings (empty after setup until WP-014B populates them)
- `G.villainDeckCardTypes` is typed as `Record<CardExtId, RevealedCardType>`
  (empty after setup until WP-014B populates it)
- `revealVillainCard` move draws the top card, emits the appropriate triggers,
  applies effects, and places the card in discard
- Tests prove deterministic classification, trigger emission, fail-closed
  behaviour, and reshuffle behaviour using mock deck fixtures

The reveal pipeline must function correctly even when the villain deck is
empty or unpopulated.

WP-014B will implement `buildVillainDeck` to populate these fields from
registry data at setup time. WP-015 will modify where villain and henchman
cards are routed after reveal (into the City).

---

## Assumes

- WP-013 complete. Specifically:
  - `packages/game-engine/src/rules/ruleHooks.types.ts` exports `RuleTriggerName`,
    `RuleEffect`, `HookRegistry` (WP-009A)
  - `packages/game-engine/src/rules/ruleRuntime.execute.ts` exports
    `executeRuleHooks` (WP-009B)
  - `packages/game-engine/src/rules/ruleRuntime.effects.ts` exports
    `applyRuleEffects` (WP-009B)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/setup/shuffle.ts` exports `shuffleDeck` (WP-005B)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`,
    `MoveError` (WP-008A)
  - `packages/game-engine/src/game.ts` has the `play` phase wired with
    `advanceStage`, `endTurn`, `drawCards`, `playCard` (WP-007B, WP-008B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 1` — package import rules. `game-engine`
  must NOT import `@legendary-arena/registry`. Card type classification for
  moves must use data stored in `G` at setup time, not a live registry lookup
  inside the move.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "RevealedCardType Conventions".
  Documents the 5 canonical type strings and the hyphens-not-underscores rule.
  A classification mismatch silently prevents the correct trigger from firing.
  Note: these 5 strings are a game-engine concept defined by this WP — they
  are NOT looked up from `card-types.json` or `FlatCard.cardType` at runtime.
- `packages/game-engine/src/rules/ruleHooks.types.ts` — `RuleTriggerName`.
  The reveal pipeline uses `onCardRevealed`, `onSchemeTwistRevealed`, and
  `onMastermindStrikeRevealed`. Confirm exact trigger name strings before
  writing any trigger emission code — slugs use hyphens not underscores.
- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — `executeRuleHooks`.
  The reveal move calls this to collect `RuleEffect[]` then passes them to
  `applyRuleEffects`. Do not apply effects inline; reuse the existing pipeline.
- `packages/game-engine/src/game.ts` — read it entirely. The top-level `moves`
  must be extended to include `revealVillainCard`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `villainDeckCardTypes` not `vdct`), Rule 6 (`// why:` on the
  card-type-index design and on any reshuffle logic), Rule 8 (no `.reduce()`),
  Rule 13 (ESM only).

**Critical design note — why classification is stored in `G`:**
boardgame.io move functions receive only `(G, ctx, args)`. The registry is not
available at move time — it is loaded at server startup and passed into
`Game.setup()` via `matchData`. Storing the card-type classification as
`G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` at setup time
means `revealVillainCard` can look up a card's type in O(1) without registry
access. This is the correct pattern per ARCHITECTURE.md §Section 5.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `shuffleDeck` from
  `shuffle.ts` (which uses `ctx.random.Shuffle`)
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- No module-scope import of `@legendary-arena/registry` anywhere in
  `packages/game-engine` — registry is consumed solely via function arguments
  passed during setup
- Trigger emission uses `executeRuleHooks` from WP-009B — no inline effect
  logic inside `revealVillainCard`
- `revealVillainCard` assigns new arrays to G fields (immutability by
  replacement); it must not mutate existing arrays in place
- Discard routing for villain and henchman cards is intentional and temporary.
  Any change to this behaviour before WP-015 is a contract violation.
- No `.reduce()` in any new code — use `for...of` loops
- Tests use `makeMockCtx` from `src/test/mockCtx.ts` — do not import from
  `boardgame.io`
- `REVEALED_CARD_TYPES` requires a drift-detection test — failure means a card
  type string was added to the `RevealedCardType` union but not the canonical
  array, or vice versa

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (do not paraphrase or re-derive from memory):**

- **RevealedCardType values** (this packet defines `RevealedCardType` with
  exactly these 5 strings — slugs use hyphens not underscores;
  `REVEALED_CARD_TYPES` array must contain all 5):
  `'villain'` | `'henchman'` | `'bystander'` |
  `'scheme-twist'` | `'mastermind-strike'`

- **Trigger names fired by `revealVillainCard`** (these are 3 of the 5
  `RuleTriggerName` values from WP-009A — use them exactly; hyphens not
  underscores):
  Always: `'onCardRevealed'` with payload `{ cardId, cardTypeSlug }`
  If `'scheme-twist'`: additionally `'onSchemeTwistRevealed'` with `{ cardId }`
  If `'mastermind-strike'`: additionally `'onMastermindStrikeRevealed'` with `{ cardId }`

- **New LegendaryGameState fields** (this packet adds exactly these 2 fields):
  `villainDeck: VillainDeckState` where `VillainDeckState = { deck: CardExtId[]; discard: CardExtId[] }`
  `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`

- **Top-of-deck convention:** the "top" card is always `deck[0]`. Draw
  removes from the front of the array. Never use `.pop()` to draw.

- **Missing cardType is fail-closed:** if `G.villainDeckCardTypes[cardId]`
  is `undefined`, append a message to `G.messages` and return (no reveal).
  Card remains in deck (no removal or reshuffle occurs). This prevents
  undefined payloads from silently breaking trigger emission.

---

## Scope (In)

### A) `src/villainDeck/villainDeck.types.ts` — new
- `type RevealedCardType = 'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`
- `const REVEALED_CARD_TYPES: readonly RevealedCardType[]` — canonical array
  (enables drift-detection test)
- `interface VillainDeckState { deck: CardExtId[]; discard: CardExtId[] }`
- `// why:` comment on `G.villainDeckCardTypes`: classification is stored at
  setup so moves never need to access the registry at runtime

### B) `src/villainDeck/villainDeck.reveal.ts` — new
- `revealVillainCard({ G, ctx }: MoveContext): void`
  — boardgame.io move (destructured `FnContext`, returns `void`, mutates `G`
  via Immer — consistent with `drawCards`, `playCard`, `endTurn`).
  The move implementation:
  1. If `G.villainDeck.deck` is empty and `G.villainDeck.discard` is also
     empty: append a message to `G.messages` and return (no other state
     changes)
  2. If deck is empty but discard has cards: assign shuffled discard into
     deck via `shuffleDeck`, clear discard, then proceed. `// why:` comment:
     reshuffling empty deck from discard is the standard Legendary behaviour
  3. Draw the top card: `const cardId = G.villainDeck.deck[0]`
  4. Remove it from deck (new array, not mutation)
  5. Look up type: `const cardType = G.villainDeckCardTypes[cardId]`
  5a. If `cardType` is `undefined`: append a message to `G.messages` and
      return — deterministic fail-closed behaviour prevents undefined
      payloads from silently breaking trigger emission
  6. Build `onCardRevealed` payload: `{ cardId, cardTypeSlug: cardType }`
  7. Collect `RuleEffect[]` via `executeRuleHooks` for `'onCardRevealed'`
  8. If `cardType === 'scheme-twist'`: additionally collect effects for
     `'onSchemeTwistRevealed'` with payload `{ cardId }`
  9. If `cardType === 'mastermind-strike'`: additionally collect effects for
     `'onMastermindStrikeRevealed'` with payload `{ cardId }`
  10. Apply all collected effects via `applyRuleEffects`
  11. Place card in `G.villainDeck.discard` — `// why:` comment noting WP-015
      will modify this routing for villain and henchman cards to the City

### C) `src/game.ts` — modified
- `play` phase top-level `moves`: add `revealVillainCard` imported from
  `villainDeck.reveal.ts`
- No setup changes — `buildInitialGameState` provides empty defaults
  (01.5 wiring allowance)

### D) `src/types.ts` — modified
- Add to `LegendaryGameState`:
  - `villainDeck: VillainDeckState`
  - `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`

### E) `src/index.ts` — modified
- Export `VillainDeckState`, `RevealedCardType`, `REVEALED_CARD_TYPES`,
  `revealVillainCard` as named public exports

### F) Tests — `src/villainDeck/villainDeck.types.test.ts` — new
- Uses `node:test` and `node:assert` only
- Two tests:
  1. Drift: `REVEALED_CARD_TYPES` contains exactly
     `['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike']` —
     `// why:` comment: failure here means a card type string was added to the
     `RevealedCardType` union but not the canonical array, or vice versa
  2. `JSON.stringify` succeeds for a sample `VillainDeckState`

### G) Tests — `src/villainDeck/villainDeck.reveal.test.ts` — new
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Trigger emission is verified by installing a test hook in `G.hookRegistry`
  that returns a deterministic effect (e.g., appending to `G.messages` or
  incrementing a counter), then asserting the effect was applied after
  `revealVillainCard` runs. This avoids fragile monkeypatching and keeps
  tests framework-free.
- All tests construct mock `G` states with pre-populated `villainDeck` and
  `villainDeckCardTypes` — they do not depend on `buildVillainDeck`.
- Trigger emission MUST be validated via effects applied to G, not by
  inspecting calls to `executeRuleHooks` or `applyRuleEffects`.
- Ten tests:
  1. Reveal draws the top card from `G.villainDeck.deck`
  2. Revealed card moves to `G.villainDeck.discard`
  3. `onCardRevealed` trigger fires with correct `cardId` and `cardTypeSlug`
  4. `onSchemeTwistRevealed` fires only when card type is `'scheme-twist'`
  5. `onSchemeTwistRevealed` does NOT fire for `'villain'` cards
  6. `onMastermindStrikeRevealed` fires only when card type is
     `'mastermind-strike'`
  7. Empty deck + non-empty discard: discard is reshuffled into deck before
     reveal
  8. Empty deck + empty discard: message appended to `G.messages`, no other
     state changes
  9. `JSON.stringify(G)` succeeds after reveal
  10. Missing `cardType` (card not in `villainDeckCardTypes`): message
      appended to `G.messages`, no trigger fired, card remains in deck

---

## Out of Scope

- No `buildVillainDeck` — deferred to WP-014B pending registry schema
  decisions for henchman card instances, scheme twist identifiers, and
  deck composition counts
- No City or HQ placement — revealed villain/henchman cards go to discard for
  now; WP-015 adds City routing
- No bystander capture rules — WP-017
- No Mastermind tactic reveal — WP-019
- No hero deck reveal
- No persistence or PostgreSQL access
- No server or UI changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Implementation Note — Deck Construction Deferred

`buildVillainDeck` is intentionally deferred to WP-014B.
The current registry schema does not define:
- henchman card instances (only group-level metadata; `SetData.henchmen` is
  `z.array(z.unknown())`)
- scheme twist card identifiers (`Scheme.cards` has `{ abilities }[]` only —
  no slug, key, or ext_id)
- per-scheme or per-player deck composition counts

These are data-model decisions that belong in a dedicated packet that
explicitly defines registry extensions and card instancing rules.

For WP-014A, `buildInitialGameState` provides empty defaults:
```typescript
villainDeck: { deck: [], discard: [] },
villainDeckCardTypes: {},
```

This is correct: the reveal pipeline handles empty deck + empty discard
gracefully (appends message, returns). WP-014B will populate these fields
with real data from registry resolution.

---

## Governance Reference

WP-014A relies on the following decisions, defined in `DECISIONS.md`:

- D-1405 through D-1409 — Reveal pipeline guarantees (classification in G,
  pipeline independence, fail-closed, discard routing, closed type set)
- D-1410 through D-1413 — Deck composition rules (deferred to WP-014B)

WP-014A must remain correct regardless of when WP-014B is implemented.

---

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainDeck.types.ts` — **new** —
  `RevealedCardType`, `REVEALED_CARD_TYPES`, `VillainDeckState`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **new** —
  `revealVillainCard`
- `packages/game-engine/src/villainDeck/villainDeck.types.test.ts` — **new** —
  drift-detection test for `REVEALED_CARD_TYPES`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **new** —
  reveal pipeline tests (10 tests)
- `packages/game-engine/src/game.ts` — **modified** — add `revealVillainCard`
  to top-level moves
- `packages/game-engine/src/types.ts` — **modified** — add `villainDeck` and
  `villainDeckCardTypes` to `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
  (01.5 wiring) — add empty-default villain deck fields to returned state

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Villain Deck Types
- [ ] `src/villainDeck/villainDeck.types.ts` exports `RevealedCardType` as
      exactly:
      `'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`
- [ ] `REVEALED_CARD_TYPES` is a `readonly` array containing all 5 type strings
- [ ] `VillainDeckState` has exactly 2 fields: `deck: CardExtId[]`,
      `discard: CardExtId[]`
- [ ] `villainDeckCardTypes` comment exists explaining the setup-time
      classification design

### Villain Deck State in G
- [ ] `LegendaryGameState` in `src/types.ts` has `villainDeck: VillainDeckState`
- [ ] `LegendaryGameState` has
      `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`
- [ ] `buildInitialGameState` returns empty defaults for both fields
- [ ] `JSON.stringify(G)` succeeds after setup

### No Registry Import in Move or Type Files
- [ ] `src/villainDeck/villainDeck.reveal.ts` contains no import from
      `@legendary-arena/registry`
- [ ] `src/villainDeck/villainDeck.types.ts` contains no import from
      `@legendary-arena/registry`

### Reveal Pipeline
- [ ] `revealVillainCard` uses `{ G, ctx }: MoveContext` signature and returns
      `void` (consistent with all other moves)
- [ ] `revealVillainCard` draws from `G.villainDeck.deck[0]` (top-of-deck
      convention locked) and places the result in `G.villainDeck.discard`
- [ ] `revealVillainCard` calls `executeRuleHooks` for `'onCardRevealed'`
- [ ] `revealVillainCard` calls `executeRuleHooks` for `'onSchemeTwistRevealed'`
      only when `cardType === 'scheme-twist'`
- [ ] `revealVillainCard` calls `executeRuleHooks` for
      `'onMastermindStrikeRevealed'` only when
      `cardType === 'mastermind-strike'`
- [ ] Empty deck + non-empty discard reshuffles before drawing
- [ ] Empty deck + empty discard: message appended, no other state changes
- [ ] Missing `cardType` lookup: message appended, no trigger fired, card
      remains in deck (fail-closed)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] `REVEALED_CARD_TYPES` drift test: array contains exactly
      `['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike']`;
      test has a `// why:` comment
- [ ] Reveal test confirms `onSchemeTwistRevealed` does NOT fire for
      `'villain'` cards
- [ ] Reveal test confirms fail-closed for missing `cardType` lookup
- [ ] Trigger tests use observable hooks (test hooks in `G.hookRegistry` that
      produce deterministic effects) — no monkeypatching of `executeRuleHooks`
- [ ] All test files use `makeMockCtx` (where ctx is needed) and do not import
      from `boardgame.io`
- [ ] All test files use `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `buildVillainDeck` implementation (deferred to WP-014B)
- [ ] No City or HQ placement logic added
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no registry import in reveal or types modules
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts","packages\game-engine\src\villainDeck\villainDeck.types.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 4 — confirm no Math.random in new files
Select-String -Path "packages\game-engine\src\villainDeck" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 5 — confirm REVEALED_CARD_TYPES drift-detection test exists
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.types.test.ts" -Pattern "REVEALED_CARD_TYPES"
# Expected: at least one match

# Step 6 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\villainDeck" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No registry import in new villainDeck files
- [ ] No `Math.random` in `src/villainDeck/`
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — villain deck types and reveal pipeline
      exist; WP-014B will populate deck from registry; WP-015 is unblocked
      for reveal routing changes
- [ ] `docs/ai/DECISIONS.md` updated — why classification is stored in
      `G.villainDeckCardTypes`; why `buildVillainDeck` is deferred (registry
      gaps); why revealed cards go to discard (WP-015 changes routing)
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.villainDeckCardTypes` to the
      Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated — WP-014A checked off;
      WP-014B added as new packet
