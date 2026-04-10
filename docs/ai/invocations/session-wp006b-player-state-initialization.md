# Session Prompt — Execute WP-006B (Player State Initialization)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute **WP-006B** to align `buildInitialGameState` with the canonical zone
contracts from WP-006A by extracting **player and pile initialization**
into dedicated, typed helpers.

This Work Packet is strictly about **setup-time construction and type alignment**.
It must not introduce gameplay logic, rules enforcement, or validation semantics.

---

## Scope & Intent (Read Carefully)

WP-006B **does**:

- Extract existing setup logic into smaller, typed helpers
- Improve debuggability and testability of setup code
- Align setup helpers with WP-006A zone contracts
- Preserve all WP-005B determinism guarantees exactly

WP-006B **does NOT**:

- Add or change gameplay rules
- Enforce counts, balances, or invariants
- Modify zone contracts or validators
- Change randomness sequencing
- Expand the public API

If a change feels like **enforcement, validation, or gameplay**, it does
**not** belong here.

---

## Authority Chain (Read in This Order)

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules
2. `docs/ai/ARCHITECTURE.md`
   - Section 2: Zone & Pile Structure
   - Section 4: Move Validation Contract
3. `.claude/rules/game-engine.md`
4. `.claude/rules/code-style.md`
5. `docs/ai/work-packets/WP-006B-player-state-initialization.md`
6. `docs/ai/execution-checklists/EC-006B-zones-initialization.checklist.md`

Then reference:

7. `packages/game-engine/src/setup/buildInitialGameState.ts` — **will be modified**
8. `packages/game-engine/src/state/zones.types.ts` — reference only
9. `packages/game-engine/src/state/zones.validate.ts` — reference only
10. `packages/game-engine/src/setup/shuffle.ts` — reference only
11. `packages/game-engine/src/test/mockCtx.ts` — reference only
12. `packages/game-engine/src/types.ts` — reference only
13. `packages/game-engine/src/index.ts` — reference only

---

## Critical Context (Post-WP-005B / WP-006A Reality)

- All zone and player state types are canonical in `zones.types.ts`
- `shuffleDeck` accepts **`ShuffleProvider` only**
- RNG consumption order is already deterministic and **must not change**
- Game state uses `G.piles`, not flat pile keys
- Validators from WP-006A are **diagnostic only** and must not be modified

---

## What WP-006B Must Do

### 1. Player State Helper

Create `src/setup/playerInit.ts`:

```ts
buildPlayerState(
  playerId: string,
  startingDeck: CardExtId[],
  context: ShuffleProvider
): PlayerState
```

Requirements:

- Shuffles `startingDeck` using `shuffleDeck`
- Initializes zones exactly per WP-006A contracts
- Constructs state only (no validation, no rules)

### 2. Global Piles Helper

Create `src/setup/pilesInit.ts`:

- Move `buildGlobalPiles` and `createPileCards` from `buildInitialGameState.ts`
- Preserve behavior and RNG usage exactly
- Do not enforce counts beyond construction from config fields

### 3. Refactor buildInitialGameState

Modify `src/setup/buildInitialGameState.ts` to:

- Delegate player creation to `buildPlayerState`
- Delegate pile creation to `buildGlobalPiles`
- Retain:
  - `buildStartingDeckCards`
  - `buildMatchSelection`
  - All well-known ext_id constants
- Preserve orchestration order and RNG consumption order

### 4. Tests

Add:

- `src/setup/playerInit.shape.test.ts`
  - Structural tests for PlayerState (zones exist, are arrays, correct keys)
- `src/setup/validators.integration.test.ts`
  - Confirms a full setup output passes:
    - `validateGameStateShape(G)`
    - `validatePlayerStateShape(player)` for every player
  - Validators are invoked for assurance only (no gating or mutation)

### 5. Regression Guarantee

Ensure **all existing tests still pass**, including:

- WP-005B determinism tests
- WP-006A zone shape tests

---

## Execution Rules (Strict)

1. One Work Packet only — **WP-006B**
2. No gameplay logic
3. No rule enforcement
4. No new randomness
5. No changes to RNG consumption order
6. No `.reduce()` in setup helpers
7. Context parameter type is **`ShuffleProvider` only**
8. No boardgame.io imports in new helpers or tests
9. Do NOT modify WP-006A files
10. Do NOT modify WP-005B helpers except via delegation
11. New helpers are **internal only** — do NOT export from `index.ts`
12. Init helpers **construct state only** — no validation, no enforcement

---

## Locked Values (Do Not Change)

### PlayerZones Initialization

- `deck` — shuffled starting deck
- `hand` — `[]`
- `discard` — `[]`
- `inPlay` — `[]`
- `victory` — `[]`

### GlobalPiles Mapping

- `bystandersCount` -> `bystanders`
- `woundsCount` -> `wounds`
- `officersCount` -> `officers`
- `sidekicksCount` -> `sidekicks`

### Well-Known ext_id Constants (unchanged)

- `starting-shield-agent`
- `starting-shield-trooper`
- `pile-bystander`
- `pile-wound`
- `pile-shield-officer`
- `pile-sidekick`

---

## Files Expected to Change

- `packages/game-engine/src/setup/playerInit.ts` — **new**
- `packages/game-engine/src/setup/pilesInit.ts` — **new**
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
- `packages/game-engine/src/setup/playerInit.shape.test.ts` — **new**
- `packages/game-engine/src/setup/validators.integration.test.ts` — **new**

No other files may be modified.

---

## Verification After Execution

```pwsh
# Build
pnpm --filter @legendary-arena/game-engine build

# Tests
pnpm --filter @legendary-arena/game-engine test

# No Math.random in new helpers
Select-String `
  -Path packages\game-engine\src\setup\playerInit.ts,
        packages\game-engine\src\setup\pilesInit.ts `
  -Pattern "Math.random"

# No boardgame.io imports in new helpers
Select-String `
  -Path packages\game-engine\src\setup\playerInit.ts,
        packages\game-engine\src\setup\pilesInit.ts `
  -Pattern "boardgame.io"

# WP-006A contract files unchanged
git diff --name-only packages/game-engine/src/state/zones.*
```

Expected: **no errors, no unexpected file changes**.

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-006B section
- [ ] `docs/ai/DECISIONS.md`
  1. Why player and pile init were extracted (function size, testability)
  2. Why generic piles use token ext_ids
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-006B complete

---

### Intent Summary (For Claude)

WP-006B refactors **how setup state is built**, not **what setup means**.

Construction — yes.
Delegation — yes.
Type alignment — yes.

Rules — no.
Validation — no.
Gameplay — no.
Semantics — no.

If you hesitate whether something belongs here, it almost certainly doesn't.
