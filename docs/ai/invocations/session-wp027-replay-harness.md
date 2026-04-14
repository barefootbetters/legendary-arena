# Session Execution Prompt — WP-027 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-027 — Determinism & Replay Verification Harness
**Mode:** Implementation (WP-027 not yet implemented)
**Pre-Flight:** Complete (2026-04-14) — build green (314 tests passing, 83
suites), all dependencies met. Six WP corrections applied: (1) `replayGame`
uses `CardRegistryReader` (engine-internal type), not `CardRegistry`;
(2) harness calls `buildInitialGameState` directly, not `Game.setup()`;
(3) MVP uses deterministic mock shuffle, not seed-faithful replay;
(4) local `ReplayMoveContext` interface for move execution without
boardgame.io import; (5) `src/replay/` classified as engine category;
(6) static `MOVE_MAP` for move dispatch by name.
**EC:** `docs/ai/execution-checklists/EC-027-replay-harness.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-027 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "MVP Gameplay Invariants" / "Moves & Determinism" — all moves return
     void, never throw, no I/O, all randomness via `ctx.random.*`. This
     packet verifies these guarantees hold end-to-end.
   - §Section 4 "Why G Must Never Be Persisted" — a match can always be
     reconstructed from setup config and ordered moves. The replay harness
     implements this reconstruction.
   - §Section 3 "The Three Data Classes" — `ReplayInput` is Class 2
     (Configuration), safe to persist. The replayed `G` is Class 1
     (Runtime), never persisted.
   - "Layer Boundary (Authoritative)" — replay harness is game-engine
     layer only. No server, registry imports, or UI.
   - "Debuggability & Diagnostics" — all engine behavior must be fully
     reproducible given identical setup config, seed, and ordered moves.
3. `docs/ai/execution-checklists/EC-027-replay-harness.checklist.md`
4. `docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)
6. `docs/ai/DECISIONS.md` — read D-0002 (Determinism Is Non-Negotiable)
   and D-0201 (Replay as a First-Class Feature)

**Implementation anchors (read before coding):**

7. `packages/game-engine/src/setup/buildInitialGameState.ts` — read the
   full file. This is the function `replayGame` calls to construct initial
   `G`. Key signature:
   ```ts
   buildInitialGameState(
     config: MatchSetupConfig,
     registry: CardRegistryReader,
     context: SetupContext,
   ): LegendaryGameState
   ```
8. `packages/game-engine/src/test/mockCtx.ts` — read the full file.
   `makeMockCtx()` returns a `SetupContext` with `{ ctx: { numPlayers },
   random: { Shuffle: <T>(deck: T[]) => [...deck].reverse() } }`. The
   deterministic reverse-shuffle proves the shuffle path executed.
9. `packages/game-engine/src/matchSetup.validate.ts` — read the
   `CardRegistryReader` interface (line 28):
   ```ts
   export interface CardRegistryReader {
     listCards(): Array<{ key: string }>;
   }
   ```
   This is the type `replayGame` uses for registry — NOT `CardRegistry`
   from the registry package.
10. `packages/game-engine/src/moves/coreMoves.impl.ts` — read move
    function signatures. Moves destructure `{ G, playerID, ...context }:
    MoveContext` where `MoveContext = FnContext<LegendaryGameState> &
    { playerID: PlayerID }`. Move functions come from boardgame.io's
    `FnContext` type.
11. `packages/game-engine/src/game.ts` — read the `moves` map (line 160)
    and the `advanceStage` local function (line 68). `advanceStage` is
    **not exported** — it wraps `advanceTurnStage` from `turnLoop.ts`.
    The replay harness must use `advanceTurnStage` directly.
12. `packages/game-engine/src/turn/turnLoop.ts` — read `advanceTurnStage`
    signature: `advanceTurnStage(gameState: TurnLoopState, context:
    TurnLoopContext): void`.
13. `packages/game-engine/src/types.ts` — read `LegendaryGameState`
    (lines 216-343). Read current re-exports at the top of the file.
14. `packages/game-engine/src/index.ts` — read current exports (lines
    155-179). New replay exports go after the scheme setup exports.

---

## Runtime Wiring Allowance (01.5)

This WP adds `ReplayInput`, `ReplayMove`, and `ReplayResult` types but
does **not** add new fields to `LegendaryGameState` or new moves. The WP
modifies `types.ts` (re-exports only) and `index.ts` (exports only).

Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, these are
**additive re-exports** that do not change the structural shape of any
existing type. No existing tests should break.

If any existing test breaks, investigate the root cause. Do not apply 01.5
wiring fixes unless the failure is traced to a structural contract change
introduced by this WP.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **`replayGame` uses `CardRegistryReader`, not `CardRegistry`.**
   `CardRegistryReader` is already defined in `matchSetup.validate.ts`
   (engine-internal). No cross-package import required. This matches the
   pattern used by `buildInitialGameState`.

2. **Harness calls `buildInitialGameState` directly, not `Game.setup()`.**
   `Game.setup()` is a boardgame.io hook that would require importing
   `game.ts` (which imports boardgame.io). Instead, `replayGame` calls
   `buildInitialGameState(config, registry, context)` with a constructed
   `SetupContext`. This avoids any boardgame.io dependency.

3. **MVP uses deterministic mock shuffle, not seed-faithful replay.**
   `makeMockCtx()` provides a deterministic reverse-shuffle. The `seed`
   field in `ReplayInput` is stored for future use when real seeded
   replay is implemented. MVP proves the mechanism (same input -> same
   hash); seed-fidelity replay is a future WP. Document in DECISIONS.md.

4. **Local `ReplayMoveContext` for move dispatch.**
   Move functions expect `FnContext<LegendaryGameState> & { playerID }`.
   The replay harness constructs a minimal object satisfying this shape
   without importing boardgame.io. Define a local interface in
   `replay.execute.ts` and cast with `as unknown as MoveContext`.
   Moves destructure `{ G, playerID, ctx, events, random }` — provide
   stubs for `events` (no-op `endTurn`/`setPhase`) and `random`
   (deterministic Shuffle).

5. **`advanceStage` is handled by calling `advanceTurnStage` directly.**
   `advanceStage` is a local function in `game.ts` (not exported). It
   wraps `advanceTurnStage(G, { events: { endTurn } })` from
   `turn/turnLoop.ts`. The replay harness imports `advanceTurnStage`
   directly and constructs the equivalent call. The `MOVE_MAP` entry for
   `'advanceStage'` must call `advanceTurnStage` with appropriate context,
   not attempt to import the non-exported wrapper.

6. **Static `MOVE_MAP` for move dispatch by name.**
   Build a `Record<string, Function>` in `replay.execute.ts` mapping
   move name strings to imported move functions. This is a static,
   exhaustive map — no dynamic dispatch. The map includes all moves
   registered in `LegendaryGame.moves` plus lobby moves:
   - `drawCards`, `playCard`, `endTurn` from `coreMoves.impl.ts`
   - `revealVillainCard` from `villainDeck.reveal.ts`
   - `fightVillain` from `fightVillain.ts`
   - `recruitHero` from `recruitHero.ts`
   - `fightMastermind` from `fightMastermind.ts`
   - `advanceStage` — custom wrapper calling `advanceTurnStage`
   - `setPlayerReady`, `startMatchIfReady` from `lobby.moves.ts`

7. **`src/replay/` is engine category.** Pure, deterministic, no IO,
   no boardgame.io imports in replay files themselves. Document in
   DECISIONS.md.

8. **Pre-WP-027 test compatibility.** Replay harness is purely additive
   (new files only). All 314 existing tests must pass unchanged.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any replay file
- Any `import ... from '@legendary-arena/registry'` in any file
- Any `.reduce()` in replay logic
- Any `Math.random()` in replay files
- Any `require()` in any file
- Any IO, network, or filesystem access in replay files
- Any modification to gameplay logic (moves, phases, hooks, rules)
- Any modification to `game.ts`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-027 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

The replay harness is **observation and verification only**. It does NOT
participate in live gameplay.

Do NOT:
- Modify any gameplay logic or move implementations
- Import `boardgame.io` in any replay file (move files import it, but
  replay files must not — the `Select-String` check verifies this)
- Import `Game.setup()` or `LegendaryGame` — use `buildInitialGameState`
- Attempt to implement real seeded shuffle — use `makeMockCtx` pattern
- Add new fields to `LegendaryGameState`
- Use `crypto` or `node:crypto` for hashing — use canonical JSON
  serialization (sorted keys) with a simple string hash

Instead:
- Call `buildInitialGameState` directly with a constructed `SetupContext`
- Build a static `MOVE_MAP` from imported move functions
- Construct minimal mock contexts for move execution
- Use `JSON.stringify` with sorted keys for canonical serialization
- Use a simple deterministic string hash (no crypto dependency needed)

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/replay/replay.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: ReplayInput is everything needed to reconstruct a game
// deterministically. It is Class 2 (Configuration) data — safe to persist.
// The replayed G is Class 1 (Runtime) — never persisted.

/**
 * A single move record in a replay sequence.
 */
export interface ReplayMove {
  readonly playerId: string;
  readonly moveName: string;
  readonly args: unknown;
}

/**
 * Canonical replay input contract. Contains everything needed to reconstruct
 * a game deterministically: seed, setup config, player order, and ordered
 * moves.
 *
 * Implements D-0201 (Replay as a First-Class Feature).
 */
export interface ReplayInput {
  readonly seed: string;
  readonly setupConfig: MatchSetupConfig;
  readonly playerOrder: string[];
  readonly moves: ReplayMove[];
}
```

Import `LegendaryGameState` for the result type:

```ts
import type { LegendaryGameState } from '../types.js';

/**
 * Result of replaying a game from a ReplayInput.
 */
export interface ReplayResult {
  readonly finalState: LegendaryGameState;
  readonly stateHash: string;
  readonly moveCount: number;
}
```

---

### B) Create `packages/game-engine/src/replay/replay.hash.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
import type { LegendaryGameState } from '../types.js';
```

**Function:**

```ts
/**
 * Computes a deterministic hash of the game state using canonical JSON
 * serialization with sorted keys.
 *
 * // why: canonical serialization ensures the same G always produces the
 * same hash regardless of property insertion order. Uses sorted keys via
 * JSON.stringify replacer and a simple string hash (djb2 or similar).
 * No crypto dependency needed — this is for equality comparison, not
 * security.
 */
export function computeStateHash(gameState: LegendaryGameState): string
```

**Implementation details:**

1. Serialize `gameState` with `JSON.stringify(gameState, sortedKeyReplacer)`
   where `sortedKeyReplacer` is a replacer function that sorts object keys:
   ```ts
   function sortedKeyReplacer(_key: string, value: unknown): unknown {
     if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
       const sorted: Record<string, unknown> = {};
       for (const objectKey of Object.keys(value).sort()) {
         sorted[objectKey] = (value as Record<string, unknown>)[objectKey];
       }
       return sorted;
     }
     return value;
   }
   ```
2. Hash the resulting string with a simple deterministic algorithm (e.g.,
   djb2). Return the hash as a hex string.
3. Add a `// why:` comment explaining the canonical serialization approach.

---

### C) Create `packages/game-engine/src/replay/replay.execute.ts` (new)

**No `import ... from 'boardgame.io'` in this file. No registry package
imports. No `.reduce()`.**

This file imports move functions from their source files. Those move files
do import boardgame.io types, but `replay.execute.ts` itself must not
contain any `boardgame.io` import statement.

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayInput, ReplayResult, ReplayMove } from './replay.types.js';
import { computeStateHash } from './replay.hash.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';

// Move function imports
import { drawCards, playCard, endTurn } from '../moves/coreMoves.impl.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { recruitHero } from '../moves/recruitHero.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { setPlayerReady, startMatchIfReady } from '../lobby/lobby.moves.js';
import { advanceTurnStage } from '../turn/turnLoop.js';
```

**Local move context interface:**

```ts
// why: move functions expect FnContext<LegendaryGameState> & { playerID }.
// We cannot import boardgame.io types, so we define a local structural
// interface with the fields moves actually destructure: G, playerID, ctx,
// events, random. Events are no-ops for replay; random uses deterministic
// reverse-shuffle from makeMockCtx.
interface ReplayMoveContext {
  G: LegendaryGameState;
  playerID: string;
  ctx: { currentPlayer: string; numPlayers: number };
  events: { endTurn: () => void; setPhase: (phase: string) => void };
  random: { Shuffle: <T>(deck: T[]) => T[] };
}
```

**Static move map:**

```ts
// why: static exhaustive map from move name to move function. No dynamic
// dispatch. Covers all moves registered in LegendaryGame.moves plus lobby
// moves. advanceStage uses advanceTurnStage directly because the game.ts
// wrapper is not exported.

type MoveFn = (context: ReplayMoveContext, args?: unknown) => void;

/**
 * Creates the advanceStage move handler for replay.
 *
 * // why: advanceStage is a local function in game.ts that wraps
 * advanceTurnStage. Since it is not exported, we reconstruct the
 * equivalent behavior by calling advanceTurnStage directly.
 */
function replayAdvanceStage(context: ReplayMoveContext): void {
  advanceTurnStage(context.G, {
    events: { endTurn: context.events.endTurn },
  });
}

const MOVE_MAP: Record<string, MoveFn> = {
  drawCards: (context, args) => drawCards(context as never, args as never),
  playCard: (context, args) => playCard(context as never, args as never),
  endTurn: (context) => endTurn(context as never),
  advanceStage: (context) => replayAdvanceStage(context),
  revealVillainCard: (context) =>
    revealVillainCard(context as never),
  fightVillain: (context, args) =>
    fightVillain(context as never, args as never),
  recruitHero: (context, args) =>
    recruitHero(context as never, args as never),
  fightMastermind: (context, args) =>
    fightMastermind(context as never, args as never),
  setPlayerReady: (context, args) =>
    setPlayerReady(context as never, args as never),
  startMatchIfReady: (context) =>
    startMatchIfReady(context as never),
};
```

**Function:**

```ts
/**
 * Replays a game from a canonical ReplayInput and returns the final state
 * with a deterministic hash.
 *
 * Pure function — identical input always produces identical output. No I/O,
 * no side effects.
 *
 * // why: reconstruction-from-inputs approach — G is never persisted, so
 * any match can be reconstructed by replaying the setup config and ordered
 * moves. This implements D-0201 (Replay as a First-Class Feature).
 */
export function replayGame(
  input: ReplayInput,
  registry: CardRegistryReader,
): ReplayResult
```

**Implementation:**

1. Construct a `SetupContext` using `makeMockCtx({ numPlayers:
   input.playerOrder.length })`.
2. Call `buildInitialGameState(input.setupConfig, registry, setupContext)`
   to get the initial `G`.
3. Create a mutable reference to `G` (let variable).
4. Iterate `input.moves` with `for...of`:
   - For each `ReplayMove`, look up the move function in `MOVE_MAP`.
   - If not found, log a warning to `G.messages` and continue (never throw).
   - Construct a `ReplayMoveContext` with the current `G`, the move's
     `playerId`, and stub `events`/`random`.
   - Call the move function with the context and `move.args`.
   - Moves mutate `G` in place (Immer-like — but outside boardgame.io,
     they just mutate the object directly). The `G` reference updates.
5. Compute `stateHash` via `computeStateHash(G)`.
6. Return `{ finalState: G, stateHash, moveCount: input.moves.length }`.

**Important note on mutation model:** Outside boardgame.io's Immer wrapper,
move functions that do `G.field = value` will mutate the object directly.
This is correct for replay — we want moves to mutate our state object.
The key insight is that boardgame.io wraps moves in Immer during live
gameplay, but the move functions themselves are written as direct mutators
(Immer intercepts the mutations). In replay context, the direct mutations
are exactly what we want.

---

### D) Create `packages/game-engine/src/replay/replay.verify.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayInput } from './replay.types.js';
import { replayGame } from './replay.execute.js';
```

**Function:**

```ts
/**
 * Verifies determinism by running the same ReplayInput twice and comparing
 * state hashes.
 *
 * // why: two-run comparison proves determinism — if the engine is truly
 * deterministic, identical inputs must produce identical final states.
 * If hashes differ, nondeterminism is present in the engine.
 */
export function verifyDeterminism(
  input: ReplayInput,
  registry: CardRegistryReader,
): { identical: boolean; hash1: string; hash2: string }
```

**Implementation:**

1. Call `replayGame(input, registry)` — store result as `result1`.
2. Call `replayGame(input, registry)` — store result as `result2`.
3. Return `{ identical: result1.stateHash === result2.stateHash,
   hash1: result1.stateHash, hash2: result2.stateHash }`.

---

### E) Modify `packages/game-engine/src/types.ts`

Add re-exports for replay types near the end of the file, after the
scheme setup re-exports:

```ts
// Replay types (WP-027)
export type { ReplayInput, ReplayMove, ReplayResult } from './replay/replay.types.js';
```

Do NOT add any new fields to `LegendaryGameState`.

---

### F) Modify `packages/game-engine/src/index.ts`

Add exports after the scheme setup exports (after line 173):

```ts
// Replay harness (WP-027)
export type { ReplayInput, ReplayMove, ReplayResult } from './replay/replay.types.js';
export { replayGame } from './replay/replay.execute.js';
export { computeStateHash } from './replay/replay.hash.js';
export { verifyDeterminism } from './replay/replay.verify.js';
```

---

### G) Create `packages/game-engine/src/replay/replay.verify.test.ts` (new)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. No
boardgame.io imports. No `@legendary-arena/registry` imports.**

**Test setup:**

Build a minimal `ReplayInput` with:
- `seed: 'test-seed-001'`
- `setupConfig`: a valid `MatchSetupConfig` with all 9 fields. Use the
  same test config pattern from existing test files (e.g., the config
  used in `buildInitialGameState.test.ts` or `game.test.ts`). Read those
  files for the exact field values.
- `playerOrder: ['0', '1']`
- `moves: []` (empty for basic tests — no moves needed to prove
  determinism of setup)

Build a minimal `CardRegistryReader` mock:
```ts
const mockRegistry: CardRegistryReader = { listCards: () => [] };
```

**Eight tests:**

1. **`replayGame` with valid input produces a `ReplayResult`**
   - Call `replayGame(input, mockRegistry)`
   - Assert result has `finalState`, `stateHash`, `moveCount`
   - Assert `moveCount === 0`

2. **`replayGame` with same input twice produces identical `stateHash`**
   - Call `replayGame` twice with identical input
   - Assert `result1.stateHash === result2.stateHash`

3. **`replayGame` with different seed produces different `stateHash`**
   - Create two inputs with different `seed` values
   - Call `replayGame` for each
   - Note: with `makeMockCtx` (reverse-shuffle, not seed-based), different
     seeds may produce the same hash if the seed is not used by the mock.
     If so, use different `setupConfig` values (e.g., different player
     counts) to produce genuinely different states. The test must prove
     that different inputs can produce different hashes. Add a `// why:`
     comment explaining the approach.

4. **`verifyDeterminism` returns `identical: true` for deterministic input**
   - Call `verifyDeterminism(input, mockRegistry)`
   - Assert `result.identical === true`
   - Assert `result.hash1 === result.hash2`

5. **`computeStateHash` is deterministic (same G -> same hash)**
   - Call `replayGame` to get a `finalState`
   - Call `computeStateHash` twice on the same `finalState`
   - Assert hashes are equal

6. **`computeStateHash` differs for different G states**
   - Get two different `finalState` objects (different inputs)
   - Assert hashes are not equal
   - Same caveat as test 3 — use inputs that produce genuinely different
     states

7. **`ReplayInput` is JSON-serializable (roundtrip test)**
   - `JSON.stringify(input)` does not throw
   - `JSON.parse(JSON.stringify(input))` produces equivalent object

8. **`JSON.stringify(replayResult.finalState)` succeeds**
   - Call `replayGame` and `JSON.stringify` the `finalState`
   - Assert no throw (serialization proof)

---

## Scope Lock (Authoritative)

### WP-027 Is Allowed To

- **Create:** `packages/game-engine/src/replay/replay.types.ts`
- **Create:** `packages/game-engine/src/replay/replay.execute.ts`
- **Create:** `packages/game-engine/src/replay/replay.hash.ts`
- **Create:** `packages/game-engine/src/replay/replay.verify.ts`
- **Create:** `packages/game-engine/src/replay/replay.verify.test.ts`
- **Modify:** `packages/game-engine/src/types.ts` — re-export replay types only
- **Modify:** `packages/game-engine/src/index.ts` — export replay API only
- **Update:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`

### WP-027 Is Explicitly NOT Allowed To

- Modify any gameplay logic (moves, phases, hooks, rules, endgame)
- Modify `game.ts`
- Import `boardgame.io` in any replay file
- Import `@legendary-arena/registry` in any file
- Use `.reduce()` in replay logic
- Use `Math.random()` in any replay file
- Use `require()` in any file
- Add new fields to `LegendaryGameState`
- Add new moves, phases, stages, or trigger names
- Modify `makeMockCtx` or other shared test helpers
- Modify any files not listed above
- Use `node:crypto` or external hashing libraries
- Implement seed-faithful replay (future WP)

---

## Verification Steps

Run these commands **after implementation is complete**, before checking
Definition of Done items:

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in replay files
Select-String -Path "packages\game-engine\src\replay" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce() in replay logic
Select-String -Path "packages\game-engine\src\replay" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm no Math.random in replay files
Select-String -Path "packages\game-engine\src\replay" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 6 — confirm ReplayInput is JSON-serializable (test exists)
Select-String -Path "packages\game-engine\src\replay\replay.verify.test.ts" -Pattern "JSON.stringify"
# Expected: at least one match

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\replay" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in Scope Lock
```

---

## Definition of Done

> Execute every verification command above before checking any item below.
> Reading the code is not sufficient — run the commands.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria in WP-027 pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in replay files (confirmed with `Select-String`)
- [ ] No `.reduce()` in replay logic (confirmed with `Select-String`)
- [ ] No `Math.random` in replay files (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No gameplay logic modified (confirmed with `git diff --name-only`)
- [ ] No files outside scope were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — replay verification harness exists;
      determinism is formally provable; D-0201 is implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
      - Canonical state hashing approach (sorted-key JSON + djb2)
      - Why the harness uses `makeMockCtx` not `boardgame.io/testing`
      - `ReplayInput` as Class 2 (Configuration) data
      - MVP replay uses deterministic mock shuffle, not seed-faithful replay
      - `src/replay/` classified as engine code category
      - `advanceStage` replicated via `advanceTurnStage` (not exported from game.ts)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-027 checked off with today's date
