# Session Execution Prompt — WP-014A: Villain Reveal & Trigger Pipeline

**Pre-flight:** `docs/ai/invocations/preflight-wp014a-villain-reveal-pipeline.md`
**Pre-flight verdict:** READY TO EXECUTE (2026-04-11)
**Execution checklist:** `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`

---

## Instruction to Claude Code

You are executing **WP-014A — Villain Reveal & Trigger Pipeline**.

This session implements villain deck type contracts and a deterministic reveal
pipeline inside `packages/game-engine`. After this session:

- `G.villainDeck` exists with `deck` and `discard` arrays of `CardExtId`
  strings (empty defaults — WP-014B populates them)
- `G.villainDeckCardTypes` is typed as `Record<CardExtId, RevealedCardType>`
  (empty defaults — WP-014B populates it)
- `revealVillainCard` move draws the top card, emits the appropriate rule
  triggers, applies effects, and places the card in discard
- 12 new tests prove deterministic classification, trigger emission,
  fail-closed behaviour, and reshuffle behaviour using mock deck fixtures

The reveal pipeline must function correctly even when the villain deck is
empty or unpopulated.

**You are implementing. You are not planning, researching, or exploring.**

**`buildVillainDeck` does NOT exist in this session.** Deck construction is
deferred to WP-014B. Do not create `villainDeck.setup.ts`. Do not infer,
stub, or implement any deck composition logic.

---

## Authority Chain (Read Before Writing Code)

Read these documents **in this exact order** before writing any code.
If conflicts exist, higher-authority documents win.

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
   - Section 1: Package import rules
   - Section 4: RevealedCardType Conventions
   - Section 4: Villain Deck Authority Boundary (new)
3. `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
4. `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` (key rules: 4, 6, 8, 13)

---

## Read Before Implementing (Mandatory)

Read each of these files in full before writing any code:

- `packages/game-engine/src/game.ts` — current setup and phase wiring
- `packages/game-engine/src/setup/buildInitialGameState.ts` — add empty defaults
- `packages/game-engine/src/types.ts` — current `LegendaryGameState`
- `packages/game-engine/src/index.ts` — current exports
- `packages/game-engine/src/rules/ruleHooks.types.ts` — `RuleTriggerName`
  values and payload interfaces
- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — `executeRuleHooks`
  signature
- `packages/game-engine/src/rules/ruleRuntime.effects.ts` — `applyRuleEffects`
  signature
- `packages/game-engine/src/rules/ruleRuntime.impl.ts` — `DEFAULT_IMPLEMENTATION_MAP`
  and `buildDefaultHookDefinitions` (test hook patterns)
- `packages/game-engine/src/setup/shuffle.ts` — `shuffleDeck` and
  `ShuffleProvider` interface
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` (reverses arrays)
- `packages/game-engine/src/state/zones.types.ts` — `CardExtId` type
- `packages/game-engine/src/moves/coreMoves.impl.ts` — existing move patterns
  (`{ G, ctx }: MoveContext` destructured, returns `void`)

Also read the existing rule pipeline tests for the established testing pattern:
- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts`

---

## Locked Values (Do Not Re-Derive)

### RevealedCardType (exactly 5 — hyphens not underscores)

```typescript
type RevealedCardType =
  | 'villain'
  | 'henchman'
  | 'bystander'
  | 'scheme-twist'
  | 'mastermind-strike';
```

### REVEALED_CARD_TYPES canonical array

```typescript
const REVEALED_CARD_TYPES: readonly RevealedCardType[] = [
  'villain',
  'henchman',
  'bystander',
  'scheme-twist',
  'mastermind-strike',
] as const;
```

### Trigger names fired by `revealVillainCard`

- Always: `'onCardRevealed'` with payload `{ cardId, cardTypeSlug }`
- If `'scheme-twist'`: additionally `'onSchemeTwistRevealed'` with `{ cardId }`
- If `'mastermind-strike'`: additionally `'onMastermindStrikeRevealed'` with `{ cardId }`

### New LegendaryGameState fields (exactly 2)

```typescript
villainDeck: VillainDeckState
villainDeckCardTypes: Record<CardExtId, RevealedCardType>
```

Where `VillainDeckState = { deck: CardExtId[]; discard: CardExtId[] }`

### Default state after setup

```typescript
villainDeck: { deck: [], discard: [] },
villainDeckCardTypes: {},
```

WP-014B will replace these with real data.

### Move signature

```typescript
revealVillainCard({ G, ctx }: MoveContext): void
```

Destructured `FnContext`, returns `void`, mutates `G` via Immer. Consistent
with `drawCards`, `playCard`, `endTurn`, `advanceStage`.

### Top-of-deck convention

The "top" card is always `deck[0]`. Draw removes from the front. Never `.pop()`.

### Fail-closed on missing cardType

If `G.villainDeckCardTypes[cardId]` is `undefined`: append a message to
`G.messages` and return. No trigger fires. Card remains in deck (no removal
or reshuffle occurs).

---

## Non-Negotiable Constraints

### Engine-Wide (Always Apply)

- Never use `Math.random()` — all randomness via `shuffleDeck`
- Never throw inside move functions — return void on invalid input
- `G` must be JSON-serializable at all times
- ESM only, Node v22+ — `import`/`export` only, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension
- No database or network access
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

### Packet-Specific

- No module-scope import of `@legendary-arena/registry` anywhere in
  `packages/game-engine`
- Trigger emission uses `executeRuleHooks` + `applyRuleEffects` — no inline
  effect logic inside `revealVillainCard`
- `revealVillainCard` assigns new arrays to G fields (immutability by
  replacement); must not mutate existing arrays in place
- Discard routing for villain/henchman cards is intentional and temporary.
  Any change before WP-015 is a contract violation.
- No `.reduce()` in any new code — use `for...of`
- Tests use `makeMockCtx` — do not import from `boardgame.io`
- `REVEALED_CARD_TYPES` requires a drift-detection test
- Slugs use hyphens not underscores throughout
- Trigger emission MUST be validated via effects applied to G, not by
  spying on `executeRuleHooks` or `applyRuleEffects`

### Absolute Exclusions

- **No `buildVillainDeck`** — deferred to WP-014B
- **No `villainDeck.setup.ts`** — deferred to WP-014B
- **No deck composition logic** — ext_id conventions, card counts, registry
  resolution are all WP-014B scope
- No City or HQ placement (WP-015)
- No modification of `makeMockCtx` or shared test helpers
- No refactors, cleanups, or "while I'm here" improvements

---

## Runtime Wiring Allowance

This WP adds `villainDeck: VillainDeckState` and
`villainDeckCardTypes: Record<CardExtId, RevealedCardType>` to
`LegendaryGameState`, and adds `revealVillainCard` to the top-level moves.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `src/setup/buildInitialGameState.ts` — add empty-default `villainDeck`
  and `villainDeckCardTypes` to the returned `LegendaryGameState` object.
  `// why: WP-014B will populate from registry`
- `src/game.test.ts` (lines 99-106) — update move-count structural assertion
  from 4 moves to 5 moves, adding `'revealVillainCard'` to the expected
  sorted array. **Value-only change. No new test logic.**

No new behaviour may be introduced in these files.

---

## Scope Lock

### Allowed Files (Exhaustive)

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

All paths are relative to `packages/game-engine/`.

**Rule:** Any file not listed above is out of scope. Do not modify it.

---

## Implementation Order

Execute in this exact sequence. Do not skip ahead.

### Step 1: Types (`villainDeck.types.ts`)

Create `packages/game-engine/src/villainDeck/villainDeck.types.ts`:

- `type RevealedCardType` — exactly the 5 locked values
- `const REVEALED_CARD_TYPES: readonly RevealedCardType[]` — canonical array
- `interface VillainDeckState { deck: CardExtId[]; discard: CardExtId[] }`
- `// why:` comment on the `villainDeckCardTypes` design: classification is
  stored at setup so moves never need to access the registry at runtime

Import `CardExtId` from `../state/zones.types.js`.

### Step 2: Update LegendaryGameState (`types.ts`)

Add to `LegendaryGameState` in `packages/game-engine/src/types.ts`:

```typescript
villainDeck: VillainDeckState;
villainDeckCardTypes: Record<CardExtId, RevealedCardType>;
```

Import `VillainDeckState` and `RevealedCardType` from
`./villainDeck/villainDeck.types.js`. Add re-exports for these types.

### Step 3: Reveal Move (`villainDeck.reveal.ts`)

Create `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`:

Define `MoveContext` locally (same pattern as `coreMoves.impl.ts`):
```typescript
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };
```

`revealVillainCard({ G, ctx }: MoveContext): void` — the move:

1. If `G.villainDeck.deck` is empty AND `G.villainDeck.discard` is also empty:
   append a message to `G.messages` and return (no other state changes)
2. If deck is empty but discard has cards: assign shuffled discard into deck
   via `shuffleDeck`, clear discard — `// why: reshuffling empty deck from
   discard is standard Legendary behaviour`
3. Draw top card: `const cardId = G.villainDeck.deck[0]`
4. Remove from deck (new array assignment)
5. Look up type: `const cardType = G.villainDeckCardTypes[cardId]`
5a. If `cardType` is `undefined`: append message to `G.messages` and return
    (fail-closed — no removal, no trigger)
6. Build `onCardRevealed` payload: `{ cardId, cardTypeSlug: cardType }`
7. Collect `RuleEffect[]` via `executeRuleHooks` for `'onCardRevealed'`
   passing `G.hookRegistry` and `DEFAULT_IMPLEMENTATION_MAP`
8. If `cardType === 'scheme-twist'`: additionally collect effects for
   `'onSchemeTwistRevealed'` with payload `{ cardId }`
9. If `cardType === 'mastermind-strike'`: additionally collect effects for
   `'onMastermindStrikeRevealed'` with payload `{ cardId }`
10. Apply all collected effects via `applyRuleEffects`
11. Place card in `G.villainDeck.discard` — `// why: WP-015 will modify this
    routing for villain and henchman cards to the City`

**Important:** Steps 5a ensures the fail-closed check happens BEFORE step 4's
deck removal is committed. Structure the code so that if cardType is undefined,
the card is never removed from the deck.

### Step 4: Wire `game.ts`

- Import `revealVillainCard` from `./villainDeck/villainDeck.reveal.js`
- Add `revealVillainCard` to the top-level `moves` object (alongside
  `drawCards`, `playCard`, `endTurn`, `advanceStage`)

### Step 5: Wire `buildInitialGameState.ts` (01.5 Wiring)

Import `VillainDeckState` and `RevealedCardType` from
`../villainDeck/villainDeck.types.js`.

Add empty defaults to the returned state object:

```typescript
// why: WP-014B will populate from registry
villainDeck: { deck: [], discard: [] } satisfies VillainDeckState,
villainDeckCardTypes: {} as Record<CardExtId, RevealedCardType>,
```

No other changes to this file.

### Step 6: Exports (`index.ts`)

Add to `packages/game-engine/src/index.ts`:

```typescript
export type { VillainDeckState, RevealedCardType } from './villainDeck/villainDeck.types.js';
export { REVEALED_CARD_TYPES } from './villainDeck/villainDeck.types.js';
export { revealVillainCard } from './villainDeck/villainDeck.reveal.js';
```

### Step 7: Types Tests (`villainDeck.types.test.ts`)

Create `packages/game-engine/src/villainDeck/villainDeck.types.test.ts`:

Uses `node:test` and `node:assert` only.

**2 tests:**

1. Drift: `REVEALED_CARD_TYPES` contains exactly
   `['villain', 'henchman', 'bystander', 'scheme-twist', 'mastermind-strike']`
   — `// why: failure means union/array mismatch -- silently breaks trigger emission`
2. `JSON.stringify` succeeds for a sample `VillainDeckState`

### Step 8: Reveal Tests (`villainDeck.reveal.test.ts`)

Create `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts`:

Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. Does NOT import
from `boardgame.io`.

All tests construct mock `G` states with pre-populated `villainDeck` and
`villainDeckCardTypes`. They do not depend on `buildVillainDeck`.

Trigger emission is verified by installing a test hook in `G.hookRegistry`
that returns a deterministic effect (e.g., `queueMessage`), then asserting
the effect was applied to `G.messages` after `revealVillainCard` runs.
The `DEFAULT_IMPLEMENTATION_MAP` must include the test hook's handler.

**10 tests:**

1. Reveal draws the top card from `G.villainDeck.deck`
2. Revealed card moves to `G.villainDeck.discard`
3. `onCardRevealed` trigger fires with correct `cardId` and `cardTypeSlug`
4. `onSchemeTwistRevealed` fires only when card type is `'scheme-twist'`
5. `onSchemeTwistRevealed` does NOT fire for `'villain'` cards
6. `onMastermindStrikeRevealed` fires only when card type is
   `'mastermind-strike'`
7. Empty deck + non-empty discard: discard is reshuffled into deck before reveal
8. Empty deck + empty discard: message appended to `G.messages`, no other changes
9. `JSON.stringify(G)` succeeds after reveal
10. Missing `cardType` (card not in `villainDeckCardTypes`): message appended,
    no trigger fired, card remains in deck (fail-closed)

**Testing trigger emission pattern:** For tests 3-6, create a test
`ImplementationMap` with a handler that returns
`[{ type: 'queueMessage', message: 'trigger:{triggerName}:cardId:{cardId}' }]`.
Install a matching `HookDefinition` in `G.hookRegistry` that subscribes to
the relevant trigger. After calling `revealVillainCard`, assert
`G.messages` contains the expected message string.

### Step 9: Update `game.test.ts` (01.5 Wiring)

Update the structural assertion to expect 5 moves:

```typescript
['advanceStage', 'drawCards', 'endTurn', 'playCard', 'revealVillainCard']
```

Update the assertion message to say "exactly 5 moves" (value-only change).

**No new test logic. No new test cases. No reformatting.**

### Step 10: Build & Test

```bash
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
```

All 130 existing tests + 12 new tests must pass.

### Step 11: Verification Commands

```bash
# No registry import in new villainDeck files
grep -r "@legendary-arena/registry" packages/game-engine/src/villainDeck/

# No Math.random in new files
grep -r "Math.random" packages/game-engine/src/villainDeck/

# REVEALED_CARD_TYPES drift-detection test exists
grep "REVEALED_CARD_TYPES" packages/game-engine/src/villainDeck/villainDeck.types.test.ts

# No require() in generated files
grep -r "require(" packages/game-engine/src/villainDeck/

# No .reduce() in new files
grep -r "\.reduce(" packages/game-engine/src/villainDeck/

# No files outside scope changed
git diff --name-only
```

### Step 12: Governance Updates

- **`docs/ai/STATUS.md`** — villain deck types and reveal pipeline exist;
  WP-014B will populate deck from registry; WP-015 is unblocked for reveal
  routing changes
- **`docs/ai/ARCHITECTURE.md`** — add `G.villainDeckCardTypes` to the Field
  Classification Reference table in Section 3 (class: Runtime). **Note:**
  this entry may already exist from earlier governance work — verify before
  adding a duplicate.
- **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-014A with today's
  date; add WP-014B as a new packet entry if not already present

**Note:** DECISIONS.md entries D-1405 through D-1409 were already recorded
in a prior session. Do not re-add them. Verify they exist and move on.

---

## Required `// why:` Comments

These comments are mandatory per EC-014A. Missing any is an execution failure.

- `G.villainDeckCardTypes` declaration or usage:
  `// why: classification stored at setup so moves never access registry at runtime`
- Reshuffle in `revealVillainCard`:
  `// why: reshuffling empty deck from discard is standard Legendary behaviour`
- Card placed in discard:
  `// why: WP-015 will modify routing for villain/henchman to City`
- Drift-detection test:
  `// why: failure means union/array mismatch -- silently breaks trigger emission`
- Empty defaults in `buildInitialGameState`:
  `// why: WP-014B will populate from registry`

---

## Established Patterns (Do Not Deviate)

- Inline mock contexts for tests requiring `ctx.random` — do NOT modify
  `makeMockCtx`
- Pure helpers return new values; moves assign into `G` under Immer
- `for...of` loops for iteration — no `.reduce()`
- Drift-detection tests for canonical arrays (same pattern as `TURN_STAGES`,
  `MATCH_PHASES`)
- Trigger emission reuses `executeRuleHooks` + `applyRuleEffects` pipeline
- Move signature: `{ G, ctx }: MoveContext` destructured, returns `void`

---

## Stop Conditions

**STOP and ask the human if:**

- Any contract, field name, or reference is unclear
- A required type or export from a dependency WP is missing
- Any test requires modifying `makeMockCtx` or other shared helpers
- A file outside the allowlist needs modification beyond the 01.5 allowance
- Build or tests fail and the cause is not immediately traceable to this WP
- You feel the need to create `villainDeck.setup.ts` or implement any
  deck composition logic

Never guess. Never invent field names, type shapes, or file paths.

---

## Execution Summary (Complete After Implementation)

After all implementation is done, provide an execution summary that includes:

1. Files created and modified (with line counts)
2. Test results (total pass/fail counts)
3. Any files modified under 01.5 runtime wiring allowance, with justification
4. Any deviations from the locked scope, with justification
5. Verification command results
6. Confirmation that all EC-014A checklist items are satisfied
