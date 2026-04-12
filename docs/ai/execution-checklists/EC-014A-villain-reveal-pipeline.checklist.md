# EC-014A — Villain Reveal & Trigger Pipeline (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
**Layer:** Game Engine / Core Gameplay

**Execution Authority:**
This execution checklist is the **authoritative enforcement mechanism** for
WP-014A. All items below are mandatory. Failure to satisfy any item is a
**failed execution** of WP-014A.

---

## Scope Declaration (Critical)

**This EC governs ONLY:**

- Card reveal mechanics
- Card classification usage (lookup from `G.villainDeckCardTypes`)
- Trigger emission (`onCardRevealed`, `onSchemeTwistRevealed`,
  `onMastermindStrikeRevealed`)
- Reshuffle behaviour (empty deck + non-empty discard)
- Deterministic routing to discard
- Type contracts (`RevealedCardType`, `VillainDeckState`)
- Drift-detection for `REVEALED_CARD_TYPES`
- Empty-default wiring in `buildInitialGameState` (01.5 allowance)

**This EC explicitly does NOT govern:**

- Villain deck composition rules
- Henchman copy counts or ext_id conventions
- Scheme twist card instancing
- Bystander-in-villain-deck counts
- Mastermind strike identification from registry data
- Registry schema evolution
- `buildVillainDeck` implementation

Those are addressed **only** by **WP-014B** and must not be inferred or
stubbed here.

This EC must remain valid even if the villain deck is permanently empty.

---

## Before Starting

- [ ] WP-013 complete (persistence boundaries and ARCHITECTURE.md exist)
- [ ] WP-014A approved (deck construction explicitly deferred to WP-014B)
- [ ] `executeRuleHooks` and `applyRuleEffects` exist (WP-009B)
- [ ] `shuffleDeck` exists in `setup/shuffle.ts` (WP-005B)
- [ ] `makeMockCtx` exists and reverses shuffle order (WP-005B)
- [ ] `play` phase wired with `advanceStage`, `endTurn`, `drawCards`,
      `playCard` (WP-007B, WP-008B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Contract Values (Do Not Re-derive)

All values below **must match WP-014A exactly**.

### RevealedCardType

Exactly 5 values, hyphens not underscores:

    'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'

### Canonical Drift Array

    REVEALED_CARD_TYPES = [
      'villain',
      'henchman',
      'bystander',
      'scheme-twist',
      'mastermind-strike',
    ] as const

### Trigger Emission Contract

- Always emit:
  - `'onCardRevealed'` with `{ cardId, cardTypeSlug }`

- Additionally:
  - If `scheme-twist`: additionally `'onSchemeTwistRevealed'` with `{ cardId }`
  - If `mastermind-strike`: additionally `'onMastermindStrikeRevealed'` with `{ cardId }`

### Game State Fields

WP-014A adds these fields to `LegendaryGameState`:

    villainDeck: VillainDeckState  // { deck: CardExtId[]; discard: CardExtId[] }
    villainDeckCardTypes: Record<CardExtId, RevealedCardType>

`buildInitialGameState` provides empty defaults:

    villainDeck: { deck: [], discard: [] }
    villainDeckCardTypes: {}

Population of these fields with real data is **explicitly out of scope** --
deferred to WP-014B.

### Move Signature

    revealVillainCard({ G, ctx }: MoveContext): void

- The move **must mutate G via Immer assignment**
- The move **must return void**
- The move **must never return a new state object**

### Top-of-Deck Convention

The "top" card is always `deck[0]`. Draw removes from the front.
Never use `.pop()` to draw.

### Fail-Closed on Missing cardType

If `G.villainDeckCardTypes[cardId]` is `undefined`: append a message to
`G.messages` and return. No trigger fires. Card remains in deck (no removal
occurs).

---

## Core vs Non-Core Move Model (Authoritative Clarification)

WP-014A establishes two classes of moves in the engine:

### Core Moves

Core moves are lifecycle and turn-control moves. They are:

- Represented in the `CoreMoveName` union type
- Governed by `MOVE_ALLOWED_STAGES` (centralized gating)
- Subject to drift-detection via `CORE_MOVE_NAMES` canonical array

The three core moves are: `drawCards`, `playCard`, `endTurn`.

The `CoreMoveName` union and `MOVE_ALLOWED_STAGES` are intentionally
**closed**. They must not be expanded without an explicit architecture-level
decision recorded in `DECISIONS.md` and referenced from `ARCHITECTURE.md`.

This invariant exists to ensure that:
- move-stage legality remains statically analyzable
- replay determinism is preserved across engine versions
- domain growth does not force repeated edits to core contracts

Example violation: adding `fightVillain` or `revealVillainCard` to
`CORE_MOVE_NAMES` to "simplify gating" would violate this invariant and
silently destabilize core move typing and drift-detection tests.

### Non-Core Moves

Non-core moves are game-specific domain actions. They may be engine-driven
(automatic, not subject to player choice) or player-driven (explicit player
actions). `revealVillainCard` is engine-driven. They are:

- NOT added to `CoreMoveName`
- NOT added to `CORE_MOVE_NAMES`
- NOT added to `MOVE_ALLOWED_STAGES`
- Required to enforce stage gating **internally** within the move body

The first non-core move is `revealVillainCard` (WP-014A). It is registered
in `game.ts` top-level moves but gates itself internally. All subsequent
domain moves must follow this same pattern.

Internal stage gating for non-core moves must be implemented as an early
return with no side effects (no messages, no mutations, no trigger emission)
before any other logic executes. The check occurs at the top of the move
implementation by testing `G.currentStage` against allowed stages and
returning immediately on mismatch. Gating after partial logic execution
violates the validate -> gate -> mutate contract.

Example non-core moves added after WP-014A:
- `fightVillain` (WP-016)
- `recruitHero` (WP-016)

Neither is added to `CoreMoveName` or `MOVE_ALLOWED_STAGES`.

This separation is intentional and required to:
- Keep core lifecycle logic stable across all future packets
- Prevent drift in `CoreMoveName` typing and drift-detection tests
- Allow domain moves to evolve without modifying core contract files

All future execution checklists that introduce new moves must conform to
this model unless explicitly superseded by an architecture decision.

See also `ARCHITECTURE.md` — "Canonical Reveal -> Fight -> Side-Effect
Ordering" for how non-core moves compose across packets.

---

## Guardrails (Hard Stops)

- No registry lookup inside any move
- No module-scope import of `@legendary-arena/registry`
- No `.reduce()` anywhere in reveal logic
- No `.pop()` for card draw -- top of deck is always `deck[0]`
- No trigger emission based on inferred or derived types
- No placeholder or fallback ext_ids
- No assumption of deck composition counts
- No stubbing of `buildVillainDeck` behaviour
- `buildVillainDeck` is intentionally excluded. Villain deck composition
  rules are defined in WP-014B. Any attempt to infer, stub, or implement
  composition rules (ext_id conventions, card counts, registry resolution)
  in this session is invalid.
- Discard routing for villain/henchman cards is intentional and temporary.
  Any change before WP-015 is a contract violation.
- Adding a move to `CoreMoveName`, `CORE_MOVE_NAMES`, or
  `MOVE_ALLOWED_STAGES` without a dedicated architecture decision recorded
  in `DECISIONS.md` and referenced from `ARCHITECTURE.md` is a contract
  violation. Domain moves must gate internally (see "Core vs Non-Core Move
  Model" above).

Violation of any guardrail is a **failed execution**.

---

## Required `// why:` Comments

The following comments are mandatory and enforcement-checked:

- `G.villainDeckCardTypes` declaration or usage:
  `// why: classification stored at setup so moves never access registry at runtime`
- Reshuffle logic in `revealVillainCard`:
  `// why: reshuffling empty deck from discard is standard Legendary behaviour`
- Card placed in discard:
  `// why: WP-015 will modify routing for villain/henchman to City`
- Drift-detection test:
  `// why: failure means union/array mismatch -- silently breaks trigger emission`
- Empty defaults in `buildInitialGameState`:
  `// why: WP-014B will populate from registry`

---

## Files Governed by This EC

### Allowed (and required)

| Action | File | Purpose |
|---|---|---|
| Create | `src/villainDeck/villainDeck.types.ts` | `RevealedCardType`, `REVEALED_CARD_TYPES`, `VillainDeckState` |
| Create | `src/villainDeck/villainDeck.reveal.ts` | `revealVillainCard` move implementation |
| Create | `src/villainDeck/villainDeck.types.test.ts` | Drift-detection + serialization (2 tests, types only) |
| Create | `src/villainDeck/villainDeck.reveal.test.ts` | Reveal pipeline tests (10 tests) |
| Modify | `src/types.ts` | Add `villainDeck` and `villainDeckCardTypes` to `LegendaryGameState` |
| Modify | `src/game.ts` | Add `revealVillainCard` to top-level moves |
| Modify | `src/index.ts` | Export new public API |
| Modify (01.5) | `src/setup/buildInitialGameState.ts` | Add empty-default villain deck fields |
| Modify (01.5) | `src/game.test.ts` | Update move-count assertion (4 -> 5, value-only) |

### Explicitly forbidden in this EC

- `villainDeck.setup.ts` -- deferred to WP-014B
- Registry integration code
- Deck composition logic
- Any file not listed above

---

## Test Requirements

All tests:

- [ ] Use `node:test` and `node:assert` only
- [ ] Use `makeMockCtx` (where ctx is needed)
- [ ] Do NOT import from `boardgame.io`
- [ ] Use mock decks and mock `villainDeckCardTypes`
- [ ] Verify trigger emission via observable test hooks in `G.hookRegistry`
      that produce deterministic effects -- no monkeypatching
- [ ] Trigger emission must be validated by observing effects on G, not by
      spying on `executeRuleHooks` or `applyRuleEffects`

Required tests (types -- `villainDeck.types.test.ts`):

- [ ] `REVEALED_CARD_TYPES` drift: array contains exactly the 5 locked values
- [ ] `JSON.stringify` succeeds for a sample `VillainDeckState`

Required tests (reveal -- `villainDeck.reveal.test.ts`):

- [ ] Draw from `deck[0]`
- [ ] Card moves to discard
- [ ] `onCardRevealed` fires with correct `cardId` and `cardTypeSlug`
- [ ] `onSchemeTwistRevealed` fires only for `'scheme-twist'` cards
- [ ] `onSchemeTwistRevealed` does NOT fire for `'villain'` cards
- [ ] `onMastermindStrikeRevealed` fires only for `'mastermind-strike'` cards
- [ ] Empty deck + non-empty discard: reshuffles before draw
- [ ] Empty deck + empty discard: message appended, no other state changes
- [ ] `JSON.stringify(G)` succeeds after reveal
- [ ] Missing `cardType` fails closed (message + return, card remains in deck)

---

## Common Failure Smells (Automatic Reject)

Any of the following is an instant failure:

- Using `FlatCard.cardType` for reveal classification
- Importing `card-types.json`
- Using registry types in reveal logic
- Guessing henchman or scheme twist ext_ids
- Returning a new state object from the move
- Forgetting undefined-guard on `villainDeckCardTypes[cardId]`
- Using `.reduce()` in reveal or deck manipulation
- Using test monkeypatching instead of observable rule hooks
- Creating `villainDeck.setup.ts` or any `buildVillainDeck` implementation
- Refactoring reveal logic to inline trigger checks instead of using the
  rule pipeline -- violates WP-009B authority and breaks extensibility

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No registry imports in new villainDeck files
- [ ] No `Math.random` in `src/villainDeck/`
- [ ] No `.reduce()` in new files
- [ ] No `require()` in new files
- [ ] No files outside governed list were modified
- [ ] WP-014B explicitly listed as blocker for deck construction
- [ ] `docs/ai/STATUS.md` updated (reveal pipeline exists; WP-014B next)
- [ ] `docs/ai/DECISIONS.md` updated (classification in G; buildVillainDeck
      deferred; discard routing)
- [ ] `docs/ai/ARCHITECTURE.md` updated (`G.villainDeckCardTypes` in Field
      Classification Reference table, Section 3)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated (WP-014A complete;
      WP-014B added)

---

## Definition of Done

WP-014A is complete **only when**:

- All checklist items pass
- No deck composition logic exists
- Reveal logic is deterministic, auditable, and replay-safe
- Deck construction remains explicitly deferred to WP-014B

---

### Final Guardrail

> **If a developer can implement `buildVillainDeck` without WP-014B,
> this EC has failed.**
