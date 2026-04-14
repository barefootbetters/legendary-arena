# Session Execution Prompt — WP-029 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-029 — Spectator & Permissions View Models
**Mode:** Implementation (WP-029 not yet implemented)
**Pre-Flight:** Complete (2026-04-14) — build green (331 tests passing, 88
suites), all dependencies met. Three pre-flight decisions locked: (1) add
`handCards` to `buildUIState` player projection (authorized scope expansion);
(2) economy zeroed for non-active player and spectator audiences;
(3) `handCards?: string[]` optional in type, always populated by buildUIState,
redacted by filter for non-owning audiences.
**EC:** `docs/ai/execution-checklists/EC-029-spectator-views.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-029 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "Layer Boundary (Authoritative)" — "UI consumes read-only projections
     of engine state, never G or ctx directly."
   - D-0302 (Single UIState, Multiple Audiences) — one authoritative UIState,
     audience-specific views are filtered projections.
3. `docs/ai/execution-checklists/EC-029-spectator-views.checklist.md`
4. `docs/ai/work-packets/WP-029-spectator-permissions-view-models.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)
6. `docs/ai/DECISIONS.md` — read D-0301 (UI Consumes Projections Only)
   and D-0302 (Single UIState, Multiple Audiences)

**Implementation anchors (read before coding):**

7. `packages/game-engine/src/ui/uiState.types.ts` — read `UIState`,
   `UIPlayerState`, and all sub-types. This is what the filter operates on.
   Key: `UIPlayerState` currently has zone counts but no `handCards` field —
   WP-029 adds it.
8. `packages/game-engine/src/ui/uiState.build.ts` — read `buildUIState`.
   WP-029 modifies this to populate `handCards: [...zones.hand]` in the
   player projection loop.
9. `packages/game-engine/src/ui/uiState.build.test.ts` — read existing
   tests. Verify no assertions break from adding `handCards` to
   `UIPlayerState`. (Pre-flight confirmed: no existing test asserts the
   exact shape of UIPlayerState — all tests should pass unchanged.)
10. `packages/game-engine/src/index.ts` — read current exports. New
    audience and filter exports go after the UI state contract exports
    (after line 199).

---

## Runtime Wiring Allowance

This WP adds `handCards?: string[]` to `UIPlayerState`. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore type and
assertion correctness:

- `packages/game-engine/src/ui/uiState.build.ts` — add `handCards`
  population to player projection
- `packages/game-engine/src/ui/uiState.build.test.ts` — value-only
  assertion updates if any existing test asserts exact UIPlayerState shape

No new behavior may be introduced. Pre-flight confirmed existing build
tests do not assert exact UIPlayerState shape, so `uiState.build.test.ts`
changes are unlikely but authorized if needed.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **`buildUIState` modified to populate `handCards` for all players.**
   The filter operates on UIState, not G. For the active player to see
   their hand card ext_ids, `buildUIState` must include them. Add
   `handCards: [...zones.hand]` to each player in the projection loop.
   Spread copy prevents aliasing with `G.playerZones[playerId].hand`.
   This is a pre-flight authorized scope expansion (finding #1).

2. **Economy zeroed for non-active player and spectator audiences.**
   `UIState.economy` is the active player's turn economy. For non-active
   players and spectators, the filter replaces it with:
   ```ts
   { attack: 0, recruit: 0, availableAttack: 0, availableRecruit: 0 }
   ```
   This prevents leaking strategic resource information.

3. **`handCards` is optional in type, always populated by buildUIState.**
   `UIPlayerState.handCards?: string[]` is optional in the TypeScript
   interface. `buildUIState` always populates it (spread copy of
   `zones.hand`). The filter removes it (sets to `undefined`) for
   non-owning audiences. The active player's own view retains `handCards`.
   Document approach in DECISIONS.md.

4. **Pre-WP-029 test compatibility.** All 331 existing tests must pass
   unchanged. Adding optional `handCards` to `UIPlayerState` is additive
   and does not break existing assertions.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any audience or filter file
- Any `import ... from '@legendary-arena/registry'` in any file
- Any import of `LegendaryGameState`, `hookRegistry`, or
  `ImplementationMap` in filter files
- Any `.reduce()` in filter logic
- Any `Math.random()` in any new file
- Any `require()` in any file
- Any IO, network, or filesystem access
- Any mutation of the input UIState in `filterUIStateForAudience`
- Any modification to gameplay logic (moves, phases, hooks, rules)
- Any modification to `game.ts`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-029 (no "while I'm here" improvements)
- Any creation of alternate game states — all views derive from one UIState
- Wiring `filterUIStateForAudience` into game.ts, moves, or phase hooks

---

## AI Agent Warning (Strict)

The audience filter is a **pure post-processing function**. It does NOT
participate in gameplay, state mutation, or rule execution.

**Lifecycle prohibition:** `filterUIStateForAudience` is NOT part of the
boardgame.io lifecycle. It MUST NOT be called from:
- `game.ts`
- any move function
- any phase hook (`onBegin`, `onEnd`, `endIf`)

It is consumed exclusively by:
- server adapters (future)
- UI / rendering layers (future)
- replay consumers (future, using spectator audience)
- tests (this WP)

**Do NOT:**
- Touch G or ctx in any way
- Import `LegendaryGameState` in filter files
- Mutate the input UIState — always return a new object
- Create alternate game states or re-derive from G
- Add logic that influences game state
- Import boardgame.io in any new file
- Import the registry in any new file

**Instead:**
- Accept `UIState` (the already-built projection) as input
- Redact or replace fields based on audience
- Return a new `UIState` object
- Use `for...of` for all iteration

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/ui/uiAudience.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
/**
 * Audience type definitions for permission-filtered UI views.
 *
 * UIAudience defines who is viewing the game state. The engine produces
 * filtered views based on audience — it does not enforce access control.
 *
 * // why: audiences are roles, not permissions. The engine produces views;
 * it does not enforce who can call what. Access control is a server concern.
 * Replay viewers use the spectator audience.
 */

/**
 * Discriminated union representing who is viewing the game.
 *
 * - player: an active participant, identified by playerId
 * - spectator: a non-participant observer (also used for replay viewers)
 */
export type UIAudience =
  | { kind: 'player'; playerId: string }
  | { kind: 'spectator' };
```

This is the **locked shape** from EC-029. Copy verbatim.

---

### B) Modify `packages/game-engine/src/ui/uiState.types.ts`

Two changes:

1. **Add `handCards` to `UIPlayerState`:**

   ```ts
   export interface UIPlayerState {
     playerId: string;
     deckCount: number;
     handCount: number;
     discardCount: number;
     inPlayCount: number;
     victoryCount: number;
     woundCount: number;
     /**
      * Hand card ext_ids. Present for the viewing player's own hand;
      * undefined (redacted) for other players and spectators.
      *
      * // why: active player needs to see their own hand cards for gameplay.
      * Other players and spectators see handCount only to prevent information
      * leakage. buildUIState always populates this; filterUIStateForAudience
      * redacts it based on audience.
      */
     handCards?: string[];
   }
   ```

2. **Add UIAudience re-export** at the end of the file:

   ```ts
   export type { UIAudience } from './uiAudience.types.js';
   ```

Do NOT remove or rename any existing fields.

---

### C) Modify `packages/game-engine/src/ui/uiState.build.ts`

**One change only:** In the player projection loop (step 2), add
`handCards` to each player:

```ts
players.push({
  playerId,
  deckCount: zones.deck.length,
  handCount: zones.hand.length,
  discardCount: zones.discard.length,
  inPlayCount: zones.inPlay.length,
  victoryCount: zones.victory.length,
  woundCount: countWounds(zones),
  // why: hand card ext_ids included so filterUIStateForAudience can
  // expose them to the owning player. Spread copy prevents aliasing
  // with G.playerZones[playerId].hand.
  handCards: [...zones.hand],
});
```

No other changes to `buildUIState`. No new imports. No changes to
`countWounds`, `UIBuildContext`, or any other section.

---

### D) Create `packages/game-engine/src/ui/uiState.filter.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`.
No mutation of input. No import of `LegendaryGameState`.**

**Imports:**

```ts
import type { UIState, UIPlayerState, UITurnEconomyState } from './uiState.types.js';
import type { UIAudience } from './uiAudience.types.js';
```

**Constant for redacted economy:**

```ts
// why: non-active players and spectators must not see the active player's
// remaining resources (attack/recruit). Zeroed economy prevents strategic
// information leakage while maintaining type stability.
const REDACTED_ECONOMY: UITurnEconomyState = {
  attack: 0,
  recruit: 0,
  availableAttack: 0,
  availableRecruit: 0,
};
```

**Function:**

```ts
/**
 * Filters a UIState for a specific audience.
 *
 * Pure function: no I/O, no mutation of input UIState, no side effects.
 * Same inputs always produce the same output.
 *
 * One UIState, filtered views — no alternate game states.
 * Implements D-0302 (Single UIState, Multiple Audiences).
 *
 * Forbidden behaviors (do not add later):
 * - mutation of the input uiState
 * - accessing G, ctx, or any engine internals
 * - caching or memoization
 * - any form of side effect
 *
 * @param uiState - The authoritative UIState from buildUIState. Not mutated.
 * @param audience - Who is viewing: player (with playerId) or spectator.
 * @returns A new UIState with audience-appropriate visibility.
 */
export function filterUIStateForAudience(
  uiState: UIState,
  audience: UIAudience,
): UIState
```

**Filter logic (use `for...of` for all iteration):**

1. **If `audience.kind === 'player'`:**
   - Build a new `players` array by iterating `uiState.players` with `for...of`:
     - If `player.playerId === audience.playerId`:
       - Keep `handCards` (the viewing player's own hand) — copy as-is
       - // why: active player sees own hand card ext_ids for gameplay
     - Else (other players):
       - Set `handCards: undefined` (redact hand card ext_ids)
       - // why: other players' hand contents are hidden — count only
   - **Economy:** If `uiState.game.activePlayerId === audience.playerId`,
     keep economy as-is. Otherwise, use `REDACTED_ECONOMY`.
     - // why: only the active player sees their own economy; other
       players do not see remaining attack/recruit resources

2. **If `audience.kind === 'spectator'`:**
   - Build a new `players` array by iterating `uiState.players` with `for...of`:
     - Set `handCards: undefined` for ALL players
     - // why: spectators see hand counts only — no hand card ext_ids
       for any player
   - Use `REDACTED_ECONOMY` for economy
     - // why: spectators do not see economy details

3. **In all cases:**
   - Copy all other fields into a new UIState object:
     - `game: { ...uiState.game }` — new object, not reference
     - `city: { spaces: [...uiState.city.spaces] }` — shallow copy of
       spaces array (UICityCard objects are immutable projections)
     - `hq: { slots: [...uiState.hq.slots] }` — shallow copy
     - `mastermind: { ...uiState.mastermind }` — new object
     - `scheme: { ...uiState.scheme }` — new object
     - `log: [...uiState.log]` — shallow copy of log array
     - `gameOver`: if present, `{ ...uiState.gameOver }` — new object;
       if undefined, omit
   - // why: deck contents/order are already hidden by buildUIState (WP-028)
     — decks are projected as counts only, never as card arrays. The filter
     does not need to redact deck data because it was never included.

**Return** the new UIState.

---

### E) Modify `packages/game-engine/src/index.ts`

Add exports **after** the UI state contract exports (after line 199):

```ts
// Audience & filter (WP-029)
export type { UIAudience } from './ui/uiAudience.types.js';
export { filterUIStateForAudience } from './ui/uiState.filter.js';
```

---

### F) Create `packages/game-engine/src/ui/uiState.filter.test.ts` (new)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.**

**Test infrastructure:**

The test file needs a `UIState` fixture. Construct it by calling
`buildUIState` on a game state from `buildInitialGameState`. Reuse the
same test config and mock pattern from `uiState.build.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterUIStateForAudience } from './uiState.filter.js';
import { buildUIState } from './uiState.build.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { UIState } from './uiState.types.js';
import type { UIAudience } from './uiAudience.types.js';
```

Create a helper to build a test UIState:

```ts
function createTestUIState(): UIState {
  const config: MatchSetupConfig = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const registry: CardRegistryReader = { listCards: () => [] };
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  // why: populate hand with known cards so we can verify filter behavior.
  // After setup, hands are empty — manually add cards for testing.
  gameState.playerZones['0']!.hand.push('hero-card-001', 'hero-card-002');
  gameState.playerZones['1']!.hand.push('hero-card-003');

  const mockCtx = {
    phase: 'play' as string | null,
    turn: 1,
    currentPlayer: '0',
  };

  return buildUIState(gameState, mockCtx);
}
```

Define audience constants:

```ts
const PLAYER_0: UIAudience = { kind: 'player', playerId: '0' };
const PLAYER_1: UIAudience = { kind: 'player', playerId: '1' };
const SPECTATOR: UIAudience = { kind: 'spectator' };
```

**Test intent (strict):**
These tests are **contract enforcement** tests. If tests fail, the
implementation is incorrect by definition. Do NOT weaken assertions to
make tests pass — fix the implementation instead.

**9 tests (required, in this order):**

1. **`active player sees own hand card ext_ids`**
   - `const result = filterUIStateForAudience(uiState, PLAYER_0)`
   - Find player '0' in `result.players`
   - Assert `player0.handCards` is defined
   - Assert `player0.handCards` contains `'hero-card-001'` and
     `'hero-card-002'`
   - Assert `player0.handCount === 2`

2. **`active player does NOT see other player's hand cards`**
   - `const result = filterUIStateForAudience(uiState, PLAYER_0)`
   - Find player '1' in `result.players`
   - Assert `player1.handCards === undefined`
   - Assert `player1.handCount === 1` (count is still visible)

3. **`spectator sees hand counts for all players (no ext_ids)`**
   - `const result = filterUIStateForAudience(uiState, SPECTATOR)`
   - For each player in `result.players`:
     - Assert `player.handCards === undefined`
     - Assert `typeof player.handCount === 'number'`

4. **`spectator does NOT see any player's hand cards`**
   - `const result = filterUIStateForAudience(uiState, SPECTATOR)`
   - Serialize result to JSON
   - Assert JSON does not contain `'hero-card-001'` or `'hero-card-002'`
     or `'hero-card-003'`

5. **`deck order is never present in any audience view`**
   - For each audience (`PLAYER_0`, `PLAYER_1`, `SPECTATOR`):
     - `const result = filterUIStateForAudience(uiState, audience)`
     - For each player in `result.players`:
       - Assert no `deckCards` or `deck` field exists (only `deckCount`)

6. **`city and HQ are visible to all audiences`**
   - For each audience (`PLAYER_0`, `PLAYER_1`, `SPECTATOR`):
     - `const result = filterUIStateForAudience(uiState, audience)`
     - Assert `result.city.spaces` is defined and is an array
     - Assert `result.hq.slots` is defined and is an array

7. **`game log is visible to all audiences`**
   - For each audience (`PLAYER_0`, `PLAYER_1`, `SPECTATOR`):
     - `const result = filterUIStateForAudience(uiState, audience)`
     - Assert `Array.isArray(result.log)`

8. **`filter does not mutate input UIState (deep equality check)`**
   - `const before = JSON.stringify(uiState)`
   - Call `filterUIStateForAudience(uiState, PLAYER_0)`
   - Call `filterUIStateForAudience(uiState, SPECTATOR)`
   - `const after = JSON.stringify(uiState)`
   - Assert `before === after`

9. **`filtered UIState is JSON-serializable`**
   - For each audience (`PLAYER_0`, `SPECTATOR`):
     - `const result = filterUIStateForAudience(uiState, audience)`
     - `const json = JSON.stringify(result)`
     - `const parsed = JSON.parse(json)`
     - Assert `deepStrictEqual(parsed, result)`

---

## Scope Lock (Authoritative)

### WP-029 Is Allowed To

- Create: `packages/game-engine/src/ui/uiAudience.types.ts` — UIAudience type
- Create: `packages/game-engine/src/ui/uiState.filter.ts` — filterUIStateForAudience
- Create: `packages/game-engine/src/ui/uiState.filter.test.ts` — 9 tests
- Modify: `packages/game-engine/src/ui/uiState.types.ts` — add `handCards?` to
  UIPlayerState, add UIAudience re-export
- Modify: `packages/game-engine/src/ui/uiState.build.ts` — add `handCards`
  population to player projection (pre-flight authorized, 01.5 wiring allowance)
- Modify: `packages/game-engine/src/index.ts` — export UIAudience and
  filterUIStateForAudience
- Update: `docs/ai/DECISIONS.md` — filter operates on UIState not G; hand
  visibility approach; handCards optional vs always present; economy zeroing
- Update: `docs/ai/STATUS.md` — spectator views exist; D-0302 implemented;
  replay uses spectator audience
- Update: `docs/ai/work-packets/WORK_INDEX.md` — check off WP-029

### WP-029 Is Explicitly Not Allowed To

- No modification of any prior contract files (except authorized
  `uiState.types.ts` extension and `uiState.build.ts` wiring)
- No boardgame.io imports in any new file
- No imports of `LegendaryGameState`, `hookRegistry`, or
  `ImplementationMap` in filter files
- No `.reduce()` in filter logic
- No `require()` in any file
- No `Math.random()`
- No mutation of input UIState in the filter
- No creation of alternate game states
- No new gameplay systems, moves, phases, hooks, or effects
- No new fields on `LegendaryGameState`
- No persistence, database, or network changes
- No modification to `game.ts`
- No modification to `makeMockCtx` or shared test helpers
- No files outside the allowlist above
- No "while I'm here" improvements
- No wiring `filterUIStateForAudience` into game.ts, moves, or phase hooks

---

## Test Expectations (Locked)

- **9 new tests** in `packages/game-engine/src/ui/uiState.filter.test.ts`
- All **331 existing tests** must continue to pass
- Existing `uiState.build.test.ts` changes: unlikely but authorized under
  01.5 if any assertion breaks from adding `handCards` to UIPlayerState
  (value-only updates, no new logic)
- Tests use inline mock UIState objects constructed via `buildUIState` —
  not raw `makeMockCtx` (filter operates on UIState, not G)
- No boardgame.io imports in test files
- No modifications to `makeMockCtx` or other shared test helpers

---

## Verification Steps (Must Execute Before Completion)

```pwsh
# Step 1 — build after adding audience filter
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in filter files
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts","packages\game-engine\src\ui\uiAudience.types.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm filter does not import G or engine internals
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts" -Pattern "LegendaryGameState|hookRegistry|ImplementationMap"
# Expected: no output

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\ui\uiState.filter.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm no require()
Select-String -Path "packages\game-engine\src\ui" -Pattern "require(" -Recurse
# Expected: no output

# Step 7 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in Scope Lock
```

---

## Post-Execution Documentation (After All Tests Pass)

1. **DECISIONS.md** — add these entries:
   - D-2901: Filter operates on UIState, not G — `filterUIStateForAudience`
     is a pure post-processing function that takes already-built UIState
     as input. It never accesses G, ctx, or engine internals. This ensures
     all audiences see consistent game truth with only visibility differences.
   - D-2902: Hand visibility approach — `handCards?: string[]` is optional
     in UIPlayerState. `buildUIState` always populates it (spread copy
     from zones.hand). `filterUIStateForAudience` redacts it (sets to
     undefined) for non-owning audiences and spectators. Active player
     sees own hand ext_ids; all others see handCount only.
   - D-2903: Economy visibility — turn economy zeroed (all fields set to 0)
     for non-active players and spectators. Only the active player (whose
     turn it is) sees economy values. Prevents strategic resource leakage.

2. **STATUS.md** — update Phase 6 status:
   - Spectator and permission-filtered views exist
   - D-0302 (Single UIState, Multiple Audiences) is implemented
   - Replay viewers use spectator audience

3. **WORK_INDEX.md** — check off WP-029 with today's date

---

## Commit Convention

When work is complete and all verification steps pass:

```
EC-029: implement UIAudience and filterUIStateForAudience pure filter
```

Follow `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`.
