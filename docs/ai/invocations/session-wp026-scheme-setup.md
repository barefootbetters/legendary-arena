# Session Execution Prompt — WP-026 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-026 — Scheme Setup Instructions & City Modifiers
**Mode:** Implementation (WP-026 not yet implemented)
**Pre-Flight:** Complete (2026-04-14) — build green (305 tests passing),
all dependencies met. Five WP/EC corrections applied: (1) D-2601 created in
DECISIONS.md (Representation Before Execution & Scheme Setup Separation);
(2) `buildSchemeSetupInstructions` takes `registry: unknown` with local
structural interface (not `CardRegistry`); (3) scheme metadata does not exist
in registry — MVP returns `[]` (safe-skip per D-2504); (4) builder file
placed in `src/setup/` per code category rules (D-2603); (5) `modifyCitySize`
is warn + no-op while `CityZone` is a fixed tuple (D-2602).
**EC:** `docs/ai/execution-checklists/EC-026-scheme-setup.checklist.md`

**Terminology note:**
All references to "Representation Before Execution" (RBE) refer to D-2601 in
`docs/ai/DECISIONS.md`, which formalizes the pattern:
- data-only representation first
- deterministic execution applied by a pure executor
- no execution logic embedded in registry data or runtime wiring

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-026 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "MVP Gameplay Invariants" / "Data Representation Before Execution" — scheme
     setup instructions follow this pattern: data-only contracts, deterministic
     executor.
   - "MVP Gameplay Invariants" / "Registry & Runtime Boundary" — scheme
     instruction data resolved from registry during `Game.setup()`. No registry
     access after setup.
   - §Section 4 "Phase Sequence and Lifecycle Mapping" — setup instructions
     execute during `setup` phase before transitioning to `play`.
   - "Layer Boundary (Authoritative)" — scheme setup is game-engine layer only.
3. `docs/ai/execution-checklists/EC-026-scheme-setup.checklist.md`
4. `docs/ai/work-packets/WP-026-scheme-setup-instructions-city-modifiers.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (read before coding):**

6. `packages/game-engine/src/economy/economy.logic.ts` — read the full file.
   This is the **template** for `buildSchemeSetupInstructions`. Study:
   - `CardStatsRegistryReader` interface (lines 89-96) — local structural
     interface pattern
   - `isCardStatsRegistryReader` type guard (lines 354-365) — runtime
     validation pattern
   - `buildCardStats(registry: unknown, matchConfig)` signature (line 162) —
     the exact convention to follow
7. `packages/game-engine/src/setup/buildInitialGameState.ts` — read the full
   file. This is a modification target. Key integration points:
   - `buildCardStats(registry as unknown, config)` at line 158
   - `buildCardKeywords(registry as unknown, config)` at line 163
   - Return object starts at line 175; `cardKeywords` field at line 212.
     `schemeSetupInstructions` wires in after `cardKeywords`.
8. `packages/game-engine/src/types.ts` — read `LegendaryGameState` (lines
   213-328). `cardKeywords` field at line 317. New field
   `schemeSetupInstructions` goes after `cardKeywords`.
9. `packages/game-engine/src/board/city.types.ts` — read `CityZone`. Fixed
   5-tuple: `[CitySpace, CitySpace, CitySpace, CitySpace, CitySpace]`.
   **Do NOT modify this file.**
10. `packages/game-engine/src/board/boardKeywords.types.ts` — read `BoardKeyword`.
    Union: `'patrol' | 'ambush' | 'guard'`. **Do NOT modify this file.**
11. `packages/game-engine/src/index.ts` — read current exports.
    `buildCardKeywords` export at line 169. New scheme setup exports go nearby.

---

## Runtime Wiring Allowance (01.5)

This WP adds `schemeSetupInstructions: SchemeSetupInstruction[]` to
`LegendaryGameState`. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`,
minimal wiring edits to the following files are permitted solely to restore
type and assertion correctness:

- `buildInitialGameState.ts` — to provide the new `schemeSetupInstructions`
  field in the returned `LegendaryGameState` object
- Existing structural assertions in `game.test.ts` — if any assert on
  `LegendaryGameState` field count or shape

**Constraints:**
- Only value-only assertion updates permitted — no new logic or tests
- Each modification must be documented in the execution summary
- No new behavior may be introduced

If no existing tests break beyond the expected structural change, 01.5 is
not further exercised.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **`buildSchemeSetupInstructions` uses `registry: unknown` with local
   structural interface.** Same pattern as `buildCardStats` in
   `economy.logic.ts`: `SchemeRegistryReader` interface +
   `isSchemeRegistryReader` runtime type guard. Follow the template exactly.
   No import of `@legendary-arena/registry` or `CardRegistry`.

2. **MVP: `buildSchemeSetupInstructions` returns `[]` for all schemes.**
   The card registry does not yet contain structured setup instruction
   metadata. The builder skeleton exists for the interface + type guard
   pattern, but always returns an empty array. All instruction execution is
   tested with synthetic instructions only. No hard-coded scheme mappings.
   (D-2601 MVP data reality, D-2504 safe-skip precedent.)

3. **`modifyCitySize` is a warn + no-op at MVP.** While `CityZone` is a
   fixed 5-tuple, the `modifyCitySize` handler logs a warning to
   `G.messages` and returns `G` unchanged. No mutation. Tests assert the
   warning is logged and City is unchanged. (D-2602.)

4. **Builder file lives in `src/setup/`, types and executor in `src/scheme/`.**
   `buildSchemeSetupInstructions.ts` is a setup-time builder and belongs in
   `packages/game-engine/src/setup/` per code category rules.
   `schemeSetup.types.ts` and `schemeSetup.execute.ts` are engine-layer pure
   code and go in `packages/game-engine/src/scheme/`. (D-2603.)

5. **Scheme setup vs scheme twist are separate mechanisms.**
   Setup (WP-026) runs once before the first turn and configures the board.
   Twist (WP-024) runs reactively when a scheme twist card is revealed.
   These must NOT be mixed. (D-2601.)

6. **Pre-WP-026 test mock compatibility.** Guard `G.schemeSetupInstructions`
   access with `?? []`. If undefined, treat as no instructions. Preserves
   all 305 existing tests.

7. **WP-025 contract locked.** `boardKeywords.types.ts` must NOT be modified.

8. **WP-015 contract locked.** `city.types.ts` must NOT be modified.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any modification to `boardKeywords.types.ts` (WP-025 contract)
- Any modification to `city.types.ts` (WP-015 contract)
- Any new moves, phases, stages, or trigger names
- Any runtime registry access from moves or scheme setup helpers
- Any `boardgame.io` import in `schemeSetup.types.ts`,
  `schemeSetup.execute.ts`, `buildSchemeSetupInstructions.ts`, or test files
- Any `@legendary-arena/registry` import in any new or modified file
- Any `.reduce()` in instruction execution or scheme setup code
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any functions, closures, Maps, Sets, or class instances stored in G
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-026 (no "while I'm here" improvements)
- Scheme twist logic mixed into scheme setup
- Hard-coded scheme-specific logic (all behavior from instruction data)
- Instructions that re-execute during moves (setup-only)

---

## AI Agent Warning (Strict)

**`buildSchemeSetupInstructions` MUST return `[]` at MVP.**

Do NOT:
- Parse scheme ability text strings to extract setup instructions
- Create a hardcoded mapping from scheme IDs to instructions
- Invent structured metadata that doesn't exist in the registry
- Import `@legendary-arena/registry` or `CardRegistry`
- Make `modifyCitySize` actually modify the City tuple

Instead:
- Implement the full `SchemeRegistryReader` interface + type guard (template
  pattern from `buildCardStats`)
- Return `[]` immediately — the registry has no structured setup data yet
- Implement and test `executeSchemeSetup` with synthetic instructions passed
  directly in tests
- `modifyCitySize`: log warning, return `G` unchanged
- All 4 instruction type handlers must be complete and tested via synthetic data

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/scheme/schemeSetup.types.ts` (new)

**No boardgame.io imports. No registry imports.**

```ts
/**
 * Scheme setup instruction types for the Legendary Arena game engine.
 *
 * Scheme setup instructions are declarative, data-only contracts that describe
 * what a scheme changes about the game at setup time. They follow the
 * "Representation Before Execution" decision (D-2601): data-only
 * representation first, deterministic execution via pure helpers.
 */

// why: scheme instructions follow the "Representation Before Execution"
// decision (D-2601) — data-only contracts applied by a deterministic executor
// at setup time. Instructions are JSON-serializable and stored in G for replay
// observability. No functions, closures, or class instances.

/**
 * The set of scheme setup instruction types supported at MVP.
 *
 * This is a closed union — adding a new type requires a DECISIONS.md entry.
 */
export type SchemeSetupType =
  | 'modifyCitySize'
  | 'addCityKeyword'
  | 'addSchemeCounter'
  | 'initialCityState';

/**
 * A single scheme setup instruction — data-only, JSON-serializable.
 *
 * Instructions execute once during the setup phase, after deck construction,
 * before the first turn. They are never re-executed during moves.
 */
export interface SchemeSetupInstruction {
  readonly type: SchemeSetupType;
  readonly value: unknown;
}
```

Also create the canonical array for drift detection:

```ts
/**
 * Canonical array of all scheme setup instruction types. Single source of truth.
 *
 * Used for drift-detection testing — if a type is added to the SchemeSetupType
 * union, it must also appear in this array (and vice versa).
 */
export const SCHEME_SETUP_TYPES: readonly SchemeSetupType[] = [
  'modifyCitySize',
  'addCityKeyword',
  'addSchemeCounter',
  'initialCityState',
] as const;
```

---

### B) Create `packages/game-engine/src/scheme/schemeSetup.execute.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. Pure function
— returns updated `G`, does not mutate in place.**

```ts
import type { LegendaryGameState } from '../types.js';
import type { SchemeSetupInstruction } from './schemeSetup.types.js';
```

**Function:**

```ts
/**
 * Deterministic executor for scheme setup instructions.
 *
 * Iterates the instruction list with for...of and applies each instruction
 * to G. Returns the updated G — pure function.
 *
 * // why: scheme setup runs after base deck construction, before the first
 * turn. Instructions configure the board (counters, keywords, city state).
 * This is separate from scheme twist execution (WP-024), which reacts to
 * events during play.
 */
export function executeSchemeSetup(
  gameState: LegendaryGameState,
  instructions: SchemeSetupInstruction[],
): LegendaryGameState
```

**Implementation details for each instruction type handler:**

1. **`modifyCitySize`** — MVP: log warning to `gameState.messages`, return
   `gameState` unchanged. `// why: CityZone is a fixed 5-tuple (D-2602).
   Functional city resizing deferred until CityZone is converted to a
   dynamic array.`

2. **`addCityKeyword`** — Extract `cardId` and `keyword` from
   `instruction.value`. Add the keyword to `gameState.cardKeywords[cardId]`.
   If the card has no keywords entry yet, create one. `// why: schemes may
   add keywords to City cards at setup time (e.g., adding Guard to a
   specific space).`

3. **`addSchemeCounter`** — Extract counter `name` and optional initial
   `value` (default 0) from `instruction.value`. Set
   `gameState.counters[name] = value`. `// why: schemes may initialize
   named counters for tracking scheme-specific endgame conditions (e.g.,
   "bystanders rescued" threshold).`

4. **`initialCityState`** — Extract `cityIndex` and `cardId` from
   `instruction.value`. Place card in `gameState.city[cityIndex]`. `// why:
   schemes may pre-populate City spaces before the first villain deck
   reveal (e.g., starting villain placement).`

5. **Unknown types** — Log warning to `gameState.messages`:
   `"Unknown scheme setup instruction type: <type> — skipped"`. Continue
   iteration. Never throw.

Use `for...of` to iterate instructions. No `.reduce()`.

---

### C) Create `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts` (new)

**No boardgame.io imports. No `@legendary-arena/registry` imports. No
`.reduce()`.**

Follow the `buildCardStats` template from `economy.logic.ts`:

1. Define a **local structural interface** `SchemeRegistryReader`:
   ```ts
   // why: game-engine must not import @legendary-arena/registry; this interface
   // is satisfied structurally by CardRegistry. It exposes the minimum methods
   // needed for scheme data resolution at setup time.
   interface SchemeRegistryReader {
     getScheme(schemeId: string): unknown | undefined;
   }
   ```

2. Define a **runtime type guard** `isSchemeRegistryReader`:
   ```ts
   function isSchemeRegistryReader(
     registry: unknown,
   ): registry is SchemeRegistryReader {
     if (!registry || typeof registry !== 'object') return false;
     const candidate = registry as Record<string, unknown>;
     return typeof candidate.getScheme === 'function';
   }
   ```

3. **Function signature:**
   ```ts
   /**
    * Builds scheme setup instructions from registry data at setup time.
    *
    * // why: same setup-time resolution pattern as buildCardStats and
    * buildCardKeywords — resolve registry data once during Game.setup(),
    * store results in G, never query registry at runtime.
    *
    * MVP behavior: returns [] (empty array) for all schemes because the
    * card registry does not yet contain structured setup instruction metadata.
    * A future WP will add structured registry metadata or an explicit mapping
    * layer.
    */
   export function buildSchemeSetupInstructions(
     schemeId: CardExtId,
     registry: unknown,
   ): SchemeSetupInstruction[]
   ```

4. **Implementation:** Check `isSchemeRegistryReader(registry)`. If false,
   return `[]`. If true, return `[]` (MVP — no structured metadata exists).
   The structure is ready for a future WP to populate real instructions.

---

### D) Modify `packages/game-engine/src/setup/buildInitialGameState.ts`

Add the following integration after `buildCardKeywords` (line 163):

1. **Import** `buildSchemeSetupInstructions` from
   `'./buildSchemeSetupInstructions.js'` and `executeSchemeSetup` from
   `'../scheme/schemeSetup.execute.js'`.

2. **Call the builder** (after line 163, after `cardKeywords`):
   ```ts
   // why: scheme setup runs after base construction, before first turn.
   // Instructions configure the board (counters, keywords, city state).
   // Separate from scheme twist execution (WP-024).
   const schemeSetupInstructions = buildSchemeSetupInstructions(
     config.schemeId as CardExtId,
     registry as unknown,
   );
   ```

3. **Call the executor** (use a mutable variable for `G` or apply inline):
   Note: `executeSchemeSetup` returns updated state. Since the return object
   is being constructed, the executor results need to be incorporated. The
   simplest approach: call `executeSchemeSetup` with a partial state object
   that contains the fields it needs (`city`, `cardKeywords`, `counters`,
   `messages`), then spread the results into the return object. Or: build
   the return object first, then apply `executeSchemeSetup` to it. Choose
   whichever approach keeps the code simplest and most readable. Document
   the choice with a `// why:` comment.

4. **Add to return object** (after `cardKeywords` at line 212):
   ```ts
   schemeSetupInstructions,
   ```

---

### E) Modify `packages/game-engine/src/types.ts`

1. **Import** `SchemeSetupInstruction` and `SchemeSetupType` from
   `'./scheme/schemeSetup.types.js'`.

2. **Add field** to `LegendaryGameState` (after `cardKeywords` at line 317):
   ```ts
   /**
    * Scheme setup instructions applied during Game.setup().
    *
    * Stores the instruction list (empty at MVP until structured metadata
    * exists) for replay observability. Setup-only — never modified after
    * initial construction.
    *
    * // why: scheme instructions follow the "Representation Before Execution"
    * decision (D-2601). Stored for replay and debugging.
    */
   schemeSetupInstructions: SchemeSetupInstruction[];
   ```

3. **Re-export** `SchemeSetupInstruction`, `SchemeSetupType`, and
   `SCHEME_SETUP_TYPES` alongside existing re-exports.

---

### F) Modify `packages/game-engine/src/index.ts`

Add exports near line 169 (after `buildCardKeywords` export):

```ts
export { buildSchemeSetupInstructions } from './setup/buildSchemeSetupInstructions.js';
export { executeSchemeSetup } from './scheme/schemeSetup.execute.js';
export type { SchemeSetupInstruction, SchemeSetupType } from './scheme/schemeSetup.types.js';
export { SCHEME_SETUP_TYPES } from './scheme/schemeSetup.types.js';
```

---

### G) Create `packages/game-engine/src/scheme/schemeSetup.execute.test.ts` (new)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. No
boardgame.io imports. No `@legendary-arena/registry` imports.**

Eight tests — all use synthetic `SchemeSetupInstruction[]` data passed
directly to `executeSchemeSetup`:

1. **`addSchemeCounter` initializes a new counter in `G.counters`**
   - Input: `[{ type: 'addSchemeCounter', value: { name: 'bystanders-rescued', value: 0 } }]`
   - Assert: `G.counters['bystanders-rescued'] === 0`

2. **`addCityKeyword` adds keyword to `G.cardKeywords`**
   - Input: `[{ type: 'addCityKeyword', value: { cardId: 'test-villain-01', keyword: 'guard' } }]`
   - Assert: `G.cardKeywords['test-villain-01']` includes `'guard'`

3. **`initialCityState` pre-populates City spaces**
   - Input: `[{ type: 'initialCityState', value: { cityIndex: 2, cardId: 'test-villain-02' } }]`
   - Assert: `G.city[2] === 'test-villain-02'`

4. **`modifyCitySize` logs warning and leaves City unchanged (MVP)**
   - Input: `[{ type: 'modifyCitySize', value: { size: 6 } }]`
   - Assert: `G.city` is unchanged (still 5-tuple), `G.messages` contains
     warning about `modifyCitySize`

5. **Unknown instruction type: warning logged, no crash**
   - Input: `[{ type: 'unknownType' as any, value: {} }]`
   - Assert: `G.messages` contains warning about unknown type, no throw

6. **Empty instructions list: `G` returned unchanged**
   - Input: `[]`
   - Assert: returned `G` deep-equals input `G`

7. **Instructions execute in order (deterministic)**
   - Input: two `addSchemeCounter` instructions with different names
   - Assert: both counters exist, proving ordered execution

8. **`JSON.stringify(G)` succeeds after all instructions**
   - Input: one of each instruction type (including unknown)
   - Assert: `JSON.stringify(result)` does not throw

**Test scaffold pattern:** Build a minimal `LegendaryGameState` mock with
the fields `executeSchemeSetup` reads: `city`, `cardKeywords`, `counters`,
`messages`. Use `makeMockCtx` if ctx is needed (it shouldn't be — the
executor is a pure function that doesn't use ctx). Guard
`G.schemeSetupInstructions ?? []` in any test that constructs partial state.

**Drift-detection test (9th test, recommended):**
Assert `SCHEME_SETUP_TYPES` array matches `SchemeSetupType` union exactly.
Follow the pattern from `boardKeywords.types.test.ts` or
`turnPhases.types.test.ts`.

---

## Scope Lock (Authoritative)

### WP-026 Is Allowed To

- **Create:** `packages/game-engine/src/scheme/schemeSetup.types.ts`
- **Create:** `packages/game-engine/src/scheme/schemeSetup.execute.ts`
- **Create:** `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`
- **Create:** `packages/game-engine/src/scheme/schemeSetup.execute.test.ts`
- **Modify:** `packages/game-engine/src/setup/buildInitialGameState.ts`
- **Modify:** `packages/game-engine/src/types.ts`
- **Modify:** `packages/game-engine/src/index.ts`
- **Update:** `docs/ai/STATUS.md`, `docs/ai/ARCHITECTURE.md`,
  `docs/ai/work-packets/WORK_INDEX.md`

### WP-026 Is Explicitly NOT Allowed To

- Modify `boardKeywords.types.ts` (WP-025 contract)
- Modify `city.types.ts` (WP-015 contract)
- Modify `ruleHooks.types.ts` (WP-009A contract)
- Import `@legendary-arena/registry` or `CardRegistry`
- Import `boardgame.io` in any new file
- Use `.reduce()` in instruction execution
- Use `Math.random()`
- Use `require()`
- Store functions in G
- Modify `makeMockCtx` or shared test helpers
- Add new moves, phases, stages, or trigger names
- Parse scheme ability text or hardcode scheme mappings
- Mix scheme setup with scheme twist logic
- Modify any files not listed above

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

# Step 3 — confirm no boardgame.io import in scheme setup files
Select-String -Path "packages\game-engine\src\scheme\schemeSetup.execute.ts","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — confirm no registry import in execution file
Select-String -Path "packages\game-engine\src\scheme\schemeSetup.execute.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\scheme","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm WP-025 contracts not modified
git diff --name-only packages/game-engine/src/board/boardKeywords.types.ts
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\scheme","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "require(" -Recurse
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

- [ ] All acceptance criteria in WP-026 pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in scheme setup files (confirmed with `Select-String`)
- [ ] No registry import in execution file (confirmed with `Select-String`)
- [ ] No `.reduce()` in scheme files (confirmed with `Select-String`)
- [ ] WP-025 contracts not modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside scope were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — scheme setup instructions work; City can
      be modified by schemes before first turn; Phase 5 is complete
- [ ] `docs/ai/ARCHITECTURE.md` updated — add `G.schemeSetupInstructions` to
      the Field Classification Reference table in Section 3 (class: Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-026 checked off with today's date
