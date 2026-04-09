# WP-014 — Villain Deck & Reveal Pipeline (Minimal MVP)

**Status:** Ready
**Primary Layer:** Game Engine / Core Gameplay
**Dependencies:** WP-013

---

## Session Context

WP-013 established the persistence boundary model and created
`docs/ai/ARCHITECTURE.md`. This packet introduces the villain deck — the first
real gameplay mechanic that crosses multiple existing subsystems: it consumes the
registry at setup time via `buildVillainDeck`, stores classification data in `G`
so moves never query the registry, and wires the WP-009B rule pipeline to emit
triggers on card reveal. WP-015 will modify routing for villain/henchman cards to
the City; this packet sends all revealed cards to `discard`.

---

## Goal

Introduce the Villain Deck and a deterministic reveal pipeline that draws cards
from the deck, classifies them by type, emits the correct rule triggers through
the WP-009B runtime, and applies the resulting effects to `G`.

After this session:
- `G.villainDeck` exists with `deck` and `discard` arrays of `CardExtId` strings
- `G.villainDeckCardTypes` maps every card in the villain deck to its
  classification — built at setup time so moves never need to query the registry
- `revealVillainCard` move draws the top card, emits the appropriate triggers,
  applies effects, and places the card in discard
- Tests prove deterministic classification, trigger emission, and reshuffle
  behaviour

WP-015 will later modify where villain and henchman cards are routed after reveal
(into the City). This packet only handles the draw → classify → trigger → discard
path.

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
- `data/metadata/card-types.json` exists; the slugs `villain`, `henchman`,
  `bystander`, `scheme-twist`, `mastermind-strike` are present (confirmed in
  WP-009A)
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
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Card Data Flow: Registry into
  Game Engine". Documents exactly how `G.villainDeckCardTypes` is built at
  setup time and why moves use it instead of the registry. This is the
  authoritative reference for the design this packet implements.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "RevealedCardType Conventions".
  Documents the 5 canonical type strings and the hyphens-not-underscores rule.
  A classification mismatch silently prevents the correct trigger from firing.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7.1` — deck references use
  stable `ext_id` strings. The villain deck is built from `ext_id` strings
  resolved at setup; moves operate on those strings only.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — `G` must be
  JSON-serializable. `G.villainDeckCardTypes` is a plain
  `Record<CardExtId, RevealedCardType>` — no class instances, no functions.
- `packages/game-engine/src/rules/ruleHooks.types.ts` — `RuleTriggerName`.
  The reveal pipeline uses `onCardRevealed`, `onSchemeTwistRevealed`, and
  `onMastermindStrikeRevealed`. Confirm exact trigger name strings before
  writing any trigger emission code — slugs use hyphens not underscores.
- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — `executeRuleHooks`.
  The reveal move calls this to collect `RuleEffect[]` then passes them to
  `applyRuleEffects`. Do not apply effects inline; reuse the existing pipeline.
- `packages/game-engine/src/game.ts` — read it entirely. The `play` phase
  moves must be extended to include `revealVillainCard`. The `setup()` function
  must be extended to build `G.villainDeck` and `G.villainDeckCardTypes`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `villainDeckCardTypes` not `vdct`), Rule 6 (`// why:` on the
  card-type-index design and on any reshuffle logic), Rule 8 (no `.reduce()`
  in deck construction — use `for...of`), Rule 13 (ESM only).

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
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `game-engine` must NOT import `@legendary-arena/registry` at module scope —
  classification data is stored in `G.villainDeckCardTypes` at setup time;
  `buildVillainDeck` receives the registry as a function argument (correct),
  not as a module import into reveal or types files (incorrect)
- Trigger emission uses `executeRuleHooks` from WP-009B — no inline effect
  logic inside `revealVillainCard`
- `revealVillainCard` returns new arrays — never mutates zone arrays directly
- No `.reduce()` in deck construction — use `for...of` loops
- Tests use `makeMockCtx` from `src/test/mockCtx.ts` — do not import from
  `boardgame.io`
- `REVEALED_CARD_TYPES` requires a drift-detection test — failure means a card
  type string was added to the `RevealedCardType` union but not the canonical
  array, or vice versa

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **RevealedCardType values** (this packet defines `RevealedCardType` with
  exactly these 5 strings — slugs use hyphens not underscores, confirmed in
  `data/metadata/card-types.json`; `REVEALED_CARD_TYPES` array must contain
  all 5):
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

- **MatchSetupConfig fields consumed by `buildVillainDeck`** (read from config
  to construct the villain deck — use exact field names from WP-005A):
  `villainGroupIds` | `henchmanGroupIds` | `schemeId` | `mastermindId`

---

## Scope (In)

### A) `src/villainDeck/villainDeck.types.ts` — new
- `type RevealedCardType = 'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`
- `const REVEALED_CARD_TYPES: readonly RevealedCardType[]` — canonical array
  (enables drift-detection test)
- `interface VillainDeckState { deck: CardExtId[]; discard: CardExtId[] }`
- `// why:` comment on `G.villainDeckCardTypes`: classification is stored at
  setup so moves never need to access the registry at runtime

### B) `src/villainDeck/villainDeck.setup.ts` — new
- `buildVillainDeck(config: MatchSetupConfig, registry: CardRegistry, ctx: Ctx): { state: VillainDeckState; cardTypes: Record<CardExtId, RevealedCardType> }`
  — pure function:
  1. Resolves villain cards from `config.villainGroupIds` against the registry
  2. Resolves henchman cards from `config.henchmanGroupIds`
  3. Tags each card with its `RevealedCardType` in the `cardTypes` map
  4. Adds bystander ext_ids from the global pile (from setup counts) tagged as
     `'bystander'`
  5. Adds scheme twist cards (from the selected scheme) tagged as
     `'scheme-twist'`
  6. Adds mastermind strike cards (from the selected mastermind, where
     `tactic === false`) tagged as `'mastermind-strike'`
  7. Shuffles the combined deck using `shuffleDeck(deck, ctx)`
  8. Returns `{ state: { deck: shuffled, discard: [] }, cardTypes }`
- Uses `for...of` loops throughout — no `.reduce()`
- `// why:` comment on the shuffle call

### C) `src/villainDeck/villainDeck.reveal.ts` — new
- `revealVillainCard(G: LegendaryGameState, ctx: Ctx): LegendaryGameState`
  — the move implementation:
  1. If `G.villainDeck.deck` is empty and `G.villainDeck.discard` is also
     empty: return `G` unchanged, log a message to `G.messages`
  2. If deck is empty but discard has cards: shuffle discard back into deck
     using `shuffleDeck`, then proceed. `// why:` comment: reshuffling empty
     deck from discard is the standard Legendary behaviour
  3. Draw the top card: `const cardId = G.villainDeck.deck[0]`
  4. Remove it from deck (new array, not mutation)
  5. Look up type: `const cardType = G.villainDeckCardTypes[cardId]`
  6. Build `onCardRevealed` payload: `{ cardId, cardTypeSlug: cardType }`
  7. Collect `RuleEffect[]` via `executeRuleHooks` for `'onCardRevealed'`
  8. If `cardType === 'scheme-twist'`: additionally collect effects for
     `'onSchemeTwistRevealed'` with payload `{ cardId }`
  9. If `cardType === 'mastermind-strike'`: additionally collect effects for
     `'onMastermindStrikeRevealed'` with payload `{ cardId }`
  10. Apply all collected effects via `applyRuleEffects`
  11. Place card in `G.villainDeck.discard` — `// why:` comment noting WP-015
      will modify this routing for villain and henchman cards to the City

### D) `src/game.ts` — modified
- `Game.setup()`: call `buildVillainDeck(matchData, registry, ctx)` and store
  results as `G.villainDeck` and `G.villainDeckCardTypes`
- `play` phase `moves`: add `revealVillainCard` imported from
  `villainDeck.reveal.ts`

### E) `src/types.ts` — modified
- Add to `LegendaryGameState`:
  - `villainDeck: VillainDeckState`
  - `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`

### F) `src/index.ts` — modified
- Export `VillainDeckState`, `RevealedCardType`, `REVEALED_CARD_TYPES`,
  `revealVillainCard`, `buildVillainDeck` as named public exports

### G) Tests — `src/villainDeck/villainDeck.setup.test.ts` — new
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`; uses mock registry data matching real schema shapes
- Six tests:
  1. `buildVillainDeck` produces a non-empty deck for a valid config
  2. Every card in the deck has an entry in `cardTypes`
  3. Deck is shuffled: given `makeMockCtx` (which reverses), order differs from
     insertion order
  4. `cardTypes` contains no extra keys beyond the deck contents
  5. `JSON.stringify({ state, cardTypes })` succeeds
  6. Drift: `REVEALED_CARD_TYPES` contains exactly
     `['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike']` —
     `// why:` comment: failure here means a card type string was added to the
     `RevealedCardType` union but not the canonical array, or vice versa

### H) Tests — `src/villainDeck/villainDeck.reveal.test.ts` — new
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Nine tests:
  1. Reveal draws the top card from `G.villainDeck.deck`
  2. Revealed card moves to `G.villainDeck.discard`
  3. `onCardRevealed` trigger fires with correct `cardId` and `cardTypeSlug`
  4. `onSchemeTwistRevealed` fires only when card type is `'scheme-twist'`
  5. `onSchemeTwistRevealed` does NOT fire for `'villain'` cards
  6. `onMastermindStrikeRevealed` fires only when card type is
     `'mastermind-strike'`
  7. Empty deck + non-empty discard: discard is reshuffled into deck before
     reveal
  8. Empty deck + empty discard: `G` returned unchanged, message logged to
     `G.messages`
  9. `JSON.stringify(G)` succeeds after reveal

---

## Out of Scope

- No City or HQ placement — revealed villain/henchman cards go to discard for
  now; WP-015 adds City routing
- No bystander capture rules — bystanders are classified and trigger-emitted;
  full bystander mechanics are WP-017
- No Mastermind tactic reveal — tactics are handled by WP-019
- No hero deck reveal
- No persistence or PostgreSQL access
- No server or UI changes
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainDeck.types.ts` — **new** —
  `RevealedCardType`, `VillainDeckState`
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — **new** —
  `buildVillainDeck`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **new** —
  `revealVillainCard`
- `packages/game-engine/src/game.ts` — **modified** — add villain deck to
  setup + play phase moves
- `packages/game-engine/src/types.ts` — **modified** — add `villainDeck` and
  `villainDeckCardTypes` to `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` — **new** —
  setup tests including drift-detection for `REVEALED_CARD_TYPES`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **new** —
  reveal pipeline tests

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
- [ ] `Game.setup()` calls `buildVillainDeck` and stores both fields
- [ ] `JSON.stringify(G)` succeeds after setup (confirmed by setup test)

### No Registry Import in Move or Type Files
- [ ] `src/villainDeck/villainDeck.reveal.ts` contains no import from
      `@legendary-arena/registry`
      (confirmed with `Select-String`)
- [ ] `src/villainDeck/villainDeck.types.ts` contains no import from
      `@legendary-arena/registry`
      (confirmed with `Select-String`)

### Reveal Pipeline
- [ ] `revealVillainCard` draws from `G.villainDeck.deck[0]` and places the
      result in `G.villainDeck.discard`
- [ ] `revealVillainCard` calls `executeRuleHooks` for `'onCardRevealed'`
- [ ] `revealVillainCard` calls `executeRuleHooks` for `'onSchemeTwistRevealed'`
      only when `cardType === 'scheme-twist'`
- [ ] `revealVillainCard` calls `executeRuleHooks` for
      `'onMastermindStrikeRevealed'` only when
      `cardType === 'mastermind-strike'`
- [ ] Empty deck + non-empty discard reshuffles before drawing
- [ ] Empty deck + empty discard returns `G` unchanged

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] `REVEALED_CARD_TYPES` drift test: array contains exactly
      `['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike']`;
      test has a `// why:` comment
- [ ] Setup test confirms every deck card has a `cardTypes` entry
- [ ] Reveal test confirms `onSchemeTwistRevealed` does NOT fire for
      `'villain'` cards
- [ ] Both test files use `makeMockCtx` and do not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Both test files use `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No City or HQ placement logic added
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding villain deck
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

# Step 5 — confirm REVEALED_CARD_TYPES drift-detection test exists with exact values
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.setup.test.ts" -Pattern "REVEALED_CARD_TYPES"
# Expected: at least one match showing the array with all 5 values

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
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No registry import in `villainDeck.reveal.ts` or `villainDeck.types.ts`
      (confirmed with `Select-String`)
- [ ] No `Math.random` in `src/villainDeck/`
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — villain deck exists; reveal emits triggers;
      WP-015 is unblocked
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why classification is stored
      in `G.villainDeckCardTypes` rather than looked up from registry at move
      time; why revealed cards go to discard in this packet (WP-015 will change
      villain/henchman routing to City); how the villain deck is composed
      (villain cards + henchman cards + bystanders + scheme twists +
      mastermind strikes)
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.villainDeckCardTypes` to the
      Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-014 checked off with today's date
