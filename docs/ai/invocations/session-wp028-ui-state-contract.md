# Session Execution Prompt — WP-028 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-028 — UI State Contract (Authoritative View Model)
**Mode:** Implementation (WP-028 not yet implemented)
**Pre-Flight:** Complete (2026-04-14) — build green (322 tests passing, 87
suites), all dependencies met. Six pre-flight decisions locked: (1) local
`UIBuildContext` structural interface for ctx (no boardgame.io import);
(2) twist count derived from villain deck discard + cardTypes map;
(3) game-over derived by calling `evaluateEndgame(G)` directly;
(4) wound count via `WOUND_EXT_ID` filtering across all player zones;
(5) `src/ui/` classified as engine category; (6) `UICityCard` authorized
as companion type.
**EC:** `docs/ai/execution-checklists/EC-028-ui-state.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-028 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "MVP Gameplay Invariants" / "Zones, State & Serialization" — all
     runtime state is JSON-serializable. UIState is a derived projection
     and must also be JSON-serializable.
   - §Section 4 "What G Is" — G is managed by boardgame.io via Immer.
     The UI must never receive G directly — only the projection.
   - "Layer Boundary (Authoritative)" — "UI consumes read-only projections
     of engine state, never G or ctx directly." This packet implements
     that boundary.
3. `docs/ai/execution-checklists/EC-028-ui-state.checklist.md`
4. `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)
6. `docs/ai/DECISIONS.md` — read D-0301 (UI Consumes Projections Only)
   and D-0302 (Single UIState, Multiple Audiences)

**Implementation anchors (read before coding):**

7. `packages/game-engine/src/types.ts` — read `LegendaryGameState`
   (lines 219-346). This is the input to `buildUIState`. Key fields:
   `playerZones`, `piles`, `city`, `hq`, `mastermind`, `turnEconomy`,
   `counters`, `messages`, `currentStage`, `villainDeckCardTypes`,
   `cardKeywords`, `selection`, `lobby`.
8. `packages/game-engine/src/economy/economy.types.ts` — read
   `TurnEconomy { attack, recruit, spentAttack, spentRecruit }`.
9. `packages/game-engine/src/economy/economy.logic.ts` — read
   `getAvailableAttack(economy)` and `getAvailableRecruit(economy)`.
   These return `attack - spentAttack` and `recruit - spentRecruit`.
10. `packages/game-engine/src/endgame/endgame.types.ts` — read
    `EndgameResult { outcome: EndgameOutcome, reason: string }` and
    `EndgameOutcome = 'heroes-win' | 'scheme-wins'`.
11. `packages/game-engine/src/endgame/endgame.evaluate.ts` — read
    `evaluateEndgame(G): EndgameResult | null`. Pure function. Returns
    null if game continues.
12. `packages/game-engine/src/scoring/scoring.types.ts` — read
    `FinalScoreSummary { players: PlayerScoreBreakdown[], winner: string | null }`.
13. `packages/game-engine/src/scoring/scoring.logic.ts` — read
    `computeFinalScores(G): FinalScoreSummary`. Pure function.
14. `packages/game-engine/src/mastermind/mastermind.types.ts` — read
    `MastermindState { id, baseCardId, tacticsDeck, tacticsDefeated }`.
15. `packages/game-engine/src/board/city.types.ts` — read
    `CityZone` (5-tuple), `CitySpace = CardExtId | null`,
    `HqZone` (5-tuple), `HqSlot = CardExtId | null`.
16. `packages/game-engine/src/state/zones.types.ts` — read
    `PlayerZones { deck, hand, discard, inPlay, victory }`.
    All are `CardExtId[]`.
17. `packages/game-engine/src/villainDeck/villainDeck.types.ts` — read
    `RevealedCardType` and `REVEALED_CARD_TYPES`.
18. `packages/game-engine/src/board/boardKeywords.types.ts` — read
    `BoardKeyword` type.
19. `packages/game-engine/src/setup/buildInitialGameState.ts` — read
    the `WOUND_EXT_ID` constant (exported). Needed for wound count.
20. `packages/game-engine/src/test/mockCtx.ts` — read `makeMockCtx`.
    Returns `SetupContext { ctx: { numPlayers }, random: { Shuffle } }`.
    This is NOT the ctx shape `buildUIState` needs — see Pre-Flight
    Locked Decisions #1.
21. `packages/game-engine/src/index.ts` — read current exports. New
    UI exports go after the replay harness exports (line 185).

---

## Runtime Wiring Allowance (01.5) — Not Applicable

WP-028 is purely additive: new files plus re-export additions to `types.ts`
and `index.ts`. It does not add required fields to `LegendaryGameState`,
change the shape of any return type, add moves, or add phase hooks.

Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`: "If a WP is
purely additive (new files only, no type or shape changes), this clause
does not apply."

No out-of-allowlist file modifications are authorized under 01.5 for this WP.
If any existing test breaks, investigate the root cause — do not apply 01.5
wiring as a fix.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **`buildUIState` uses a local `UIBuildContext` interface, not boardgame.io `Ctx`.**
   The UI state files must not import boardgame.io. Define a local structural
   interface in `uiState.build.ts` with the minimum fields needed from ctx:
   ```ts
   // why: exact structural contract — do not widen or add optional fields.
   // buildUIState MUST NOT depend on any other ctx fields.
   // Structurally compatible with boardgame.io's Ctx at the call site.
   interface UIBuildContext {
     readonly phase: string | null;
     readonly turn: number;
     readonly currentPlayer: string;
   }
   ```
   This is the **exact shape** — no optional fields, no widening.
   Tests create a simple inline mock object matching this interface.

2. **Twist count derived from villain deck discard + cardTypes map.**
   `UISchemeState.twistCount` is derived by iterating `G.villainDeck.discard`
   and counting cards where `G.villainDeckCardTypes[cardId] === 'scheme-twist'`.
   This is a pure projection — no new G fields needed. Use `for...of`, not
   `.reduce()`.

3. **Game-over state derived by calling `evaluateEndgame(G)` directly.**
   `buildUIState` imports and calls `evaluateEndgame(G)` — a pure engine
   function. If it returns non-null, project into `UIGameOverState`. Also
   call `computeFinalScores(G)` for the scores when game is over. Both
   functions are pure and already exported from the engine. No boardgame.io
   access needed — `ctx.gameover` is not used.

4. **Wound count via `WOUND_EXT_ID` filtering.**
   `UIPlayerState.woundCount` is derived by counting occurrences of
   `WOUND_EXT_ID` across all five player zones (deck, hand, discard,
   inPlay, victory). Import `WOUND_EXT_ID` from
   `../setup/buildInitialGameState.js`. Use `for...of`, not `.reduce()`.

5. **`src/ui/` is engine category.** Pure projection code: no boardgame.io
   imports, no registry imports, no IO, no mutation. Document as D-2801
   in DECISIONS.md during post-execution documentation.

6. **`UICityCard` authorized as companion type.** Referenced in WP scope
   section A — contains `extId: string`, `type: string`, `keywords: string[]`
   for display-safe city card projection. Defined in `uiState.types.ts`.

7. **Pre-WP-028 test compatibility.** UI state contract is purely additive
   (new files only). All 322 existing tests must pass unchanged.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any UI state file
- Any `import ... from '@legendary-arena/registry'` in any file
- Any `.reduce()` in projection logic
- Any `Math.random()` in UI state files
- Any `require()` in any file
- Any IO, network, or filesystem access in UI state files
- Any modification to gameplay logic (moves, phases, hooks, rules)
- Any modification to `game.ts`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-028 (no "while I'm here" improvements)
- Any mutation of G or ctx inside `buildUIState`
- Any item from the canonical forbidden internals list (see AI Agent
  Warning section) appearing as keys in UIState types

---

## AI Agent Warning (Strict)

The UI state contract is a **read-only projection layer**. It does NOT
participate in gameplay, state mutation, or rule execution.

**Lifecycle prohibition:** `buildUIState` is NOT part of the boardgame.io
lifecycle. It MUST NOT be called from:
- `game.ts`
- any move function
- any phase hook (`onBegin`, `onEnd`, `endIf`)

It is consumed exclusively by:
- server adapters (future)
- UI / rendering layers (future)
- replay consumers (future)
- tests (this WP)

**Engine Internals Explicitly Forbidden in UIState (Canonical List):**

UIState MUST NOT expose or reference, directly or indirectly:
- `hookRegistry`
- `ImplementationMap`
- `cardStats`
- `heroAbilityHooks`
- `villainDeckCardTypes`
- `schemeSetupInstructions`
- registry objects or types
- setup builder functions

All other references to forbidden internals in this prompt defer to this
canonical list. If a key appears here, it must not appear as a field name,
type reference, or import in any UIState file.

**Do NOT:**
- Mutate G or ctx in any way
- Add logic that influences game state
- Import boardgame.io in any new file
- Import the registry in any new file
- Expose any item from the forbidden internals list through UIState
- Persist UIState to any storage

**Instead:**
- Read G fields to project display-safe data
- Call pure engine functions (`evaluateEndgame`, `computeFinalScores`,
  `getAvailableAttack`, `getAvailableRecruit`) for derived values
- Use `for...of` for all iteration
- Return a plain JSON-serializable object

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/ui/uiState.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
import type { FinalScoreSummary } from '../scoring/scoring.types.js';
```

Define all UI state types. The top-level `UIState` shape is **locked**:

```ts
// why: UIState is the only data the UI sees. All items in the canonical
// forbidden internals list (see AI Agent Warning) are hidden to prevent
// logic leakage and maintain the Layer Boundary. Implements D-0301
// (UI Consumes Projections Only).

/**
 * The authoritative UI state contract.
 *
 * Derived from G and ctx by buildUIState. The UI never reads G directly.
 * JSON-serializable. Contains no engine internals.
 */
export interface UIState {
  game: {
    phase: string
    turn: number
    activePlayerId: string
    currentStage: string
  }
  players: UIPlayerState[]
  city: UICityState
  hq: UIHQState
  mastermind: UIMastermindState
  scheme: UISchemeState
  economy: UITurnEconomyState
  log: string[]
  gameOver?: UIGameOverState
}
```

Sub-types:

```ts
/**
 * Per-player state projection. Zones projected as counts — not card arrays.
 *
 * // why: zone counts prevent the UI from accessing card identities it
 * shouldn't see (other players' hands, decks). Card display resolution
 * is a separate UI concern using the registry.
 */
export interface UIPlayerState {
  playerId: string
  deckCount: number
  handCount: number
  discardCount: number
  inPlayCount: number
  victoryCount: number
  woundCount: number
}

/**
 * Display-safe card info for a card in the City.
 *
 * // why: contains only display-safe data — ext_id for registry lookup,
 * type for visual classification, keywords for gameplay indicators.
 * No engine internals.
 */
export interface UICityCard {
  extId: string
  type: string
  keywords: string[]
}

/**
 * City zone projection with display-safe card info.
 */
export interface UICityState {
  spaces: (UICityCard | null)[]
}

/**
 * HQ zone projection with ext_ids for display lookup.
 */
export interface UIHQState {
  slots: (string | null)[]
}

/**
 * Mastermind projection with identity and tactics counts.
 */
export interface UIMastermindState {
  id: string
  tacticsRemaining: number
  tacticsDefeated: number
}

/**
 * Scheme projection with identity and twist count.
 */
export interface UISchemeState {
  id: string
  twistCount: number
}

/**
 * Economy projection with totals and available amounts.
 */
export interface UITurnEconomyState {
  attack: number
  recruit: number
  availableAttack: number
  availableRecruit: number
}

/**
 * Game-over projection with outcome, reason, and optional scores.
 */
export interface UIGameOverState {
  outcome: string
  reason: string
  scores?: FinalScoreSummary
}
```

---

### B) Create `packages/game-engine/src/ui/uiState.build.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. No mutation.**

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type {
  UIState,
  UIPlayerState,
  UICityCard,
  UIGameOverState,
} from './uiState.types.js';
import { getAvailableAttack, getAvailableRecruit } from '../economy/economy.logic.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { WOUND_EXT_ID } from '../setup/buildInitialGameState.js';
```

**Local ctx interface:**

```ts
// why: exact structural contract — do not widen or add optional fields.
// buildUIState MUST NOT depend on any other ctx fields.
// Structurally compatible with boardgame.io's Ctx at the call site.
interface UIBuildContext {
  readonly phase: string | null;
  readonly turn: number;
  readonly currentPlayer: string;
}
```

**Function:**

```ts
/**
 * Derives the authoritative UIState from engine state.
 *
 * Pure function: no I/O, no mutation of G or ctx, no side effects.
 * Same G + ctx always produces the same UIState.
 *
 * Forbidden behaviors (do not add later):
 * - caching or memoization
 * - closures over G or ctx
 * - mutation via object aliasing
 * - any form of side effect or state retention between calls
 *
 * // why: UIState is the only state the UI consumes. This function
 * implements D-0301 (UI Consumes Projections Only). All items in the
 * canonical forbidden internals list are excluded.
 *
 * @param gameState - The current engine state (G). Not mutated.
 * @param ctx - Minimal context with phase, turn, currentPlayer.
 * @returns The derived UIState projection.
 */
export function buildUIState(
  gameState: LegendaryGameState,
  ctx: UIBuildContext,
): UIState
```

**Projection steps (use `for...of` for all iteration):**

1. **Project game phase/turn/active player** from `ctx`:
   - `phase: ctx.phase ?? 'unknown'`
   - `turn: ctx.turn`
   - `activePlayerId: ctx.currentPlayer`
   - `currentStage: gameState.currentStage`

2. **Project player states** — iterate `Object.keys(gameState.playerZones)`
   with `for...of`:
   - Zone counts: `.deck.length`, `.hand.length`, `.discard.length`,
     `.inPlay.length`, `.victory.length`
   - Wound count: count occurrences of `WOUND_EXT_ID` across all 5 zones.
     Use a helper function `countWounds(zones: PlayerZones): number` that
     iterates each zone array with `for...of`.
   - // why: zone counts hide card identities from the UI; wound count
     uses WOUND_EXT_ID constant to identify wound cards across all zones

3. **Project City** — iterate `gameState.city` (5-tuple) with `for...of`:
   - For each space: if null, push null; if occupied, create `UICityCard`:
     - `extId`: the CardExtId string
     - `type`: `gameState.villainDeckCardTypes[extId] ?? 'unknown'`
     - `keywords`: `gameState.cardKeywords[extId] ?? []`
   - // why: city projection includes type and keywords for display without
     exposing the raw villainDeckCardTypes or cardKeywords maps

4. **Project HQ** — iterate `gameState.hq` (5-tuple) with `for...of`:
   - Direct pass-through of ext_id strings (or null)
   - // why: HQ slots expose ext_ids for registry display lookup; no
     engine internals needed

5. **Project mastermind**:
   - `id: gameState.mastermind.id`
   - `tacticsRemaining: gameState.mastermind.tacticsDeck.length`
   - `tacticsDefeated: gameState.mastermind.tacticsDefeated.length`
   - // why: tactics projected as counts, not card arrays

6. **Project scheme** — derive twist count:
   - `id: gameState.selection.schemeId`
   - `twistCount`: iterate `gameState.villainDeck.discard` with `for...of`,
     count cards where `gameState.villainDeckCardTypes[cardId] === 'scheme-twist'`
   - // why: twist count derived from already-revealed cards in villain
     deck discard; no new G fields needed

7. **Project economy** — use pure helpers:
   - `attack: gameState.turnEconomy.attack`
   - `recruit: gameState.turnEconomy.recruit`
   - `availableAttack: getAvailableAttack(gameState.turnEconomy)`
   - `availableRecruit: getAvailableRecruit(gameState.turnEconomy)`
   - // why: available amounts computed via engine helpers, not raw
     subtraction, to stay consistent with move validation logic

8. **Project log** — direct pass-through:
   - `log: [...gameState.messages]`
   - // why: shallow copy prevents mutation of G.messages through UIState

9. **Project game over** — call pure engine functions:
   - Call `evaluateEndgame(gameState)`. If non-null:
     ```ts
     const endgameResult = evaluateEndgame(gameState);
     if (endgameResult !== null) {
       gameOver = {
         outcome: endgameResult.outcome,
         reason: endgameResult.reason,
         scores: computeFinalScores(gameState),
       };
     }
     ```
   - // why: endgame state derived from G counters via evaluateEndgame
     (pure); scores computed via computeFinalScores (pure). No ctx.gameover
     access needed.

---

### C) Modify `packages/game-engine/src/types.ts`

Add re-exports for UI types **after** the existing replay type re-exports
(around line 139):

```ts
// why: UI state types defined canonically in src/ui/uiState.types.ts
// (WP-028). Re-exported here so that consumers importing from './types.js'
// have access.
export type {
  UIState,
  UIPlayerState,
  UICityCard,
  UICityState,
  UIHQState,
  UIMastermindState,
  UISchemeState,
  UITurnEconomyState,
  UIGameOverState,
} from './ui/uiState.types.js';
```

---

### D) Modify `packages/game-engine/src/index.ts`

Add exports **after** the replay harness exports (after line 185):

```ts
// UI state contract (WP-028)
export type {
  UIState,
  UIPlayerState,
  UICityCard,
  UICityState,
  UIHQState,
  UIMastermindState,
  UISchemeState,
  UITurnEconomyState,
  UIGameOverState,
} from './ui/uiState.types.js';
export { buildUIState } from './ui/uiState.build.js';
```

---

### E) Create `packages/game-engine/src/ui/uiState.build.test.ts` (new)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.**

**Test infrastructure:**

The test file needs a `LegendaryGameState` object and a `UIBuildContext`
object. Since `buildUIState` takes `LegendaryGameState` (not a mock),
construct a minimal valid game state. Use `buildInitialGameState` from
`../setup/buildInitialGameState.js` with `makeMockCtx()` and a valid
`MatchSetupConfig` to get a realistic state.

For the `UIBuildContext` mock, create a simple inline object:
```ts
const mockCtx = {
  phase: 'play',
  turn: 1,
  currentPlayer: '0',
};
```

**Test intent (strict):**
These tests are **contract enforcement** tests. They are not examples, not
smoke tests, and not illustrative. If tests fail, the implementation is
incorrect by definition. Do NOT weaken assertions to make tests pass —
fix the implementation instead.

**9 tests (required, in this order):**

1. **`buildUIState returns a valid UIState for a standard game state`**
   - Call `buildUIState(G, mockCtx)`
   - Assert result has all top-level keys: `game`, `players`, `city`,
     `hq`, `mastermind`, `scheme`, `economy`, `log`
   - Assert `result.game.phase === 'play'`
   - Assert `result.game.turn === 1`
   - Assert `result.game.activePlayerId === '0'`

2. **`UIState is JSON-serializable (roundtrip)`**
   - `const json = JSON.stringify(result)`
   - `const parsed = JSON.parse(json)`
   - Assert `deepStrictEqual(parsed, result)`

3. **`UIState does NOT contain hookRegistry`**
   - Assert `!('hookRegistry' in result)`
   - Assert the JSON string does not contain `"hookRegistry"`

4. **`UIState does NOT contain villainDeckCardTypes`**
   - Assert `!('villainDeckCardTypes' in result)`

5. **`UIState does NOT contain cardStats`**
   - Assert `!('cardStats' in result)`

6. **`Player zones are projected as counts (not card arrays)`**
   - Assert `typeof result.players[0].deckCount === 'number'`
   - Assert `typeof result.players[0].handCount === 'number'`
   - Assert `!Array.isArray(result.players[0].deckCount)`

7. **`buildUIState does not mutate input G (deep equality check)`**
   - `const gBefore = JSON.stringify(G)`
   - Call `buildUIState(G, mockCtx)`
   - `const gAfter = JSON.stringify(G)`
   - Assert `gBefore === gAfter`

8. **`Same G + ctx produces identical UIState (deterministic)`**
   - `const result1 = buildUIState(G, mockCtx)`
   - `const result2 = buildUIState(G, mockCtx)`
   - Assert `deepStrictEqual(result1, result2)`

9. **`Game-over state is projected when endgame result exists`**
   - Set `G.counters['mastermindDefeated'] = 1` (triggers heroes-win)
   - Call `buildUIState(G, mockCtx)`
   - Assert `result.gameOver !== undefined`
   - Assert `result.gameOver.outcome === 'heroes-win'`
   - Assert `result.gameOver.scores !== undefined`

---

## Scope Lock (Authoritative)

### WP-028 Is Allowed To

- Create: `packages/game-engine/src/ui/uiState.types.ts` — UI state types
- Create: `packages/game-engine/src/ui/uiState.build.ts` — buildUIState
- Create: `packages/game-engine/src/ui/uiState.build.test.ts` — 9 tests
- Modify: `packages/game-engine/src/types.ts` — re-export UI types
- Modify: `packages/game-engine/src/index.ts` — export UI API
- Update: `docs/ai/DECISIONS.md` — D-2801 (src/ui/ category), zone
  projection strategy, why UIState hides internals, why card display
  resolution is separate
- Update: `docs/ai/STATUS.md` — UIState contract exists
- Update: `docs/ai/work-packets/WORK_INDEX.md` — check off WP-028

### WP-028 Is Explicitly Not Allowed To

- No modification of any prior contract files
- No boardgame.io imports in any new file
- No registry imports in any new file
- No `.reduce()` in projection logic
- No `require()` in any new file
- No mutation of G or ctx
- No new gameplay systems, moves, phases, hooks, or effects
- No new fields on `LegendaryGameState`
- No persistence, database, or network changes
- No modifications to `makeMockCtx` or shared test helpers
- No modifications to `game.ts`
- No files outside the allowlist above
- No "while I'm here" improvements

---

## Test Expectations (Locked)

- **9 new tests** in `packages/game-engine/src/ui/uiState.build.test.ts`
- All **322 existing tests** must continue to pass
- Tests use a **local inline mock** for the ctx parameter (not `makeMockCtx`)
- Tests use `buildInitialGameState` + `makeMockCtx` for constructing a
  realistic `LegendaryGameState` fixture
- No boardgame.io imports in test files
- No modifications to `makeMockCtx` or other shared test helpers

---

## Verification Steps (Must Execute Before Completion)

```pwsh
# Step 1 — build after adding UI state contract
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in UI state files
Select-String -Path "packages\game-engine\src\ui" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no registry import in buildUIState
Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce() in projection
Select-String -Path "packages\game-engine\src\ui" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm engine internals excluded from UIState type
Select-String -Path "packages\game-engine\src\ui\uiState.types.ts" -Pattern "hookRegistry|ImplementationMap|villainDeckCardTypes|cardStats|heroAbilityHooks"
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\ui" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in Scope Lock
```

---

## Post-Execution Documentation (After All Tests Pass)

1. **DECISIONS.md** — add these entries:
   - D-2801: `src/ui/` classified as engine code category (pure projection,
     no framework imports, no IO)
   - D-2802: Zone projection strategy — player zones projected as counts
     (not CardExtId arrays) to hide card identities from UI
   - D-2803: UIState hides engine internals — hookRegistry, cardStats,
     heroAbilityHooks, villainDeckCardTypes, ImplementationMap,
     schemeSetupInstructions excluded to prevent logic leakage
   - D-2804: Card display resolution is a separate UI concern — buildUIState
     exposes ext_ids only; the UI calls the registry independently for
     display names, images, ability text

2. **STATUS.md** — update Phase 6 status:
   - UIState contract exists
   - UI never reads G directly
   - D-0301 is implemented by WP-028

3. **WORK_INDEX.md** — check off WP-028 with today's date

---

## Commit Convention

When work is complete and all verification steps pass:

```
EC-028: implement UIState contract and buildUIState pure projection
```

Follow `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`.
