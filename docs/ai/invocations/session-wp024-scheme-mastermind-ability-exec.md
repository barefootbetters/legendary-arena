# Session Execution Prompt — WP-024 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-024 — Scheme & Mastermind Ability Execution
**Mode:** Implementation (WP-024 not yet implemented)
**Pre-Flight:** Complete (2026-04-13) — build green (281 tests passing),
all dependencies met. File path corrections applied: `buildDefaultHookDefinitions`
and `DEFAULT_IMPLEMENTATION_MAP` live in `src/rules/ruleRuntime.impl.ts`,
not in `src/setup/` files (WP-024 and EC-024 corrected). Mastermind strike
wound-gain limited to `modifyCounter` + `queueMessage` (no new effect type).
Scheme twist threshold is an MVP constant. Integration test assertion updates
authorized for stub replacement (value-only, no new logic).
**EC:** `docs/ai/execution-checklists/EC-024-scheme-ability-exec.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-024 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §4 "The Rule Execution Pipeline" — scheme and mastermind handlers are
     `ImplementationMap` entries using the same `executeRuleHooks` ->
     `applyRuleEffects` two-step pipeline as hero effects. No new execution
     engine.
   - "MVP Gameplay Invariants" — "Endgame & Counters" subsection: scheme-loss
     is mediated through `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]` using
     the constant, never the string literal.
   - "Registry & Runtime Boundary" — scheme/mastermind ability data resolved
     at setup time. No runtime registry access.
   - "Layer Boundary (Authoritative)" — scheme/mastermind execution is
     game-engine layer only.
3. `docs/ai/execution-checklists/EC-024-scheme-ability-exec.checklist.md`
4. `docs/ai/work-packets/WP-024-scheme-mastermind-ability-execution.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (read before coding):**

6. `packages/game-engine/src/rules/ruleRuntime.impl.ts` — read the full file.
   This is the primary modification target. Contains:
   - `defaultSchemeImplementation` (stub, line 34) — fires on `onTurnStart`,
     returns zero-delta counter + message. **To be replaced.**
   - `defaultMastermindImplementation` (stub, line 56) — fires on `onTurnEnd`,
     returns zero-delta counter + message. **To be replaced.**
   - `DEFAULT_IMPLEMENTATION_MAP` (line 74) — maps hook IDs to handler functions.
     **Must be updated** to reference the new real handlers.
   - `buildDefaultHookDefinitions` (line 89) — creates `HookDefinition` entries.
     Scheme hook uses `triggers: ['onTurnStart']` (stub), mastermind uses
     `triggers: ['onTurnEnd']` (stub). **Must be updated** to use
     `['onSchemeTwistRevealed']` and `['onMastermindStrikeRevealed']`.
7. `packages/game-engine/src/rules/ruleRuntime.execute.ts` — read
   `executeRuleHooks` signature. Handlers are called as
   `handler(gameState, ctx, payload) => RuleEffect[]`.
8. `packages/game-engine/src/rules/ruleRuntime.effects.ts` — read
   `applyRuleEffects`. Handles `queueMessage`, `modifyCounter`, `drawCards`,
   `discardHand`. Unknown types warn via `G.messages`.
9. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the
   trigger emission. Scheme twist fires:
   `executeRuleHooks(G, ctx, 'onSchemeTwistRevealed', { cardId }, G.hookRegistry, DEFAULT_IMPLEMENTATION_MAP)`.
   Mastermind strike fires similarly with `'onMastermindStrikeRevealed'`.
   Payload is `{ cardId }`.
10. `packages/game-engine/src/endgame/endgame.types.ts` — read
    `ENDGAME_CONDITIONS`. Confirm `SCHEME_LOSS = 'schemeLoss'`.
11. `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` — read
    the full file. Tests assert stub messages (`'Scheme: turn started.'`,
    `'Mastermind: turn ended.'`) and triggers (`onTurnStart`, `onTurnEnd`).
    These will need updating after stub replacement.
12. `packages/game-engine/src/types.ts` — read `LegendaryGameState` to confirm
    `hookRegistry: HookDefinition[]`, `counters: Record<string, number>`,
    `messages: string[]`.

---

## Runtime Wiring Allowance (01.5)

This WP does not add new fields to `LegendaryGameState`. However, it replaces
the WP-009B stub handlers with real implementations and changes the trigger
arrays in `buildDefaultHookDefinitions`. This changes the behavior of existing
integration tests that assert specific stub messages and trigger-response
patterns.

Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted solely to restore assertion
correctness after stub replacement:

- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` —
  value-only assertion updates. Stub messages (`'Scheme: turn started.'`,
  `'Mastermind: turn ended.'`) will change. Trigger names in test invocations
  (`'onTurnStart'`, `'onTurnEnd'`) must be updated to match the new trigger
  assignments (`'onSchemeTwistRevealed'`, `'onMastermindStrikeRevealed'`).

**Constraints:**
- Only value-only assertion updates permitted — no new logic or tests
- Each modification must be documented in the execution summary
- No new behavior may be introduced
- The `modifyCounter` assertion (test 5, line 186) must be updated to
  reflect the new counter name and delta from the real scheme handler

If no existing tests break beyond the expected stub replacement, 01.5 is
not further exercised.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **File paths corrected:** `buildDefaultHookDefinitions` and
   `DEFAULT_IMPLEMENTATION_MAP` live in `src/rules/ruleRuntime.impl.ts`.
   The WP's original references to `src/setup/buildDefaultHookDefinitions.ts`
   and `src/setup/buildImplementationMap.ts` were pre-flight errors — those
   files do not exist. All modifications go to `ruleRuntime.impl.ts`.

2. **Trigger array replacement:** `buildDefaultHookDefinitions` currently
   assigns `['onTurnStart']` to the scheme hook and `['onTurnEnd']` to the
   mastermind hook (WP-009B stubs). These must be changed to
   `['onSchemeTwistRevealed']` and `['onMastermindStrikeRevealed']`
   respectively. These are the triggers emitted by `villainDeck.reveal.ts`.

3. **Mastermind strike MVP simplification:** Existing effect types do not
   support actual card-movement wound-gain. MVP strike handler produces
   `modifyCounter` + `queueMessage` effects only (counter tracking, no
   wound card movement). This follows the WP-023 safe-skip pattern:
   implement the handler structure, defer full card-movement wound effects
   to a future WP that adds a `'gainWound'` effect type. Document in
   DECISIONS.md.

4. **Scheme twist threshold:** Use a clearly named MVP constant
   (e.g., `MVP_SCHEME_TWIST_THRESHOLD = 7`) with a `// why:` comment.
   Standard Legendary rules: most schemes lose at 7 twists. Future WP
   parameterizes per-scheme thresholds from registry data.

5. **Integration test updates authorized:** Replacing stubs changes the
   messages and trigger-response patterns that `ruleRuntime.integration.test.ts`
   asserts. Value-only assertion updates are authorized under 01.5.
   No new test logic.

6. **WP-009A contract locked:** `ruleHooks.types.ts` must NOT be modified.
   All 4 existing effect types (`queueMessage`, `modifyCounter`, `drawCards`,
   `discardHand`) are sufficient for WP-024 MVP.

7. **WP-014 reveal pipeline locked:** `villainDeck.reveal.ts` must NOT be
   modified. Handlers fire via existing trigger emission.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any modification to `ruleHooks.types.ts` (WP-009A contract)
- Any modification to `villainDeck.reveal.ts` (WP-014 reveal pipeline)
- Any new moves, phases, stages, or trigger names
- Any new effect types without DECISIONS.md entry
- Any runtime registry access from handlers
- Any `boardgame.io` import in handler files
- Any `@legendary-arena/registry` import in any new file
- Any `.reduce()` in handlers or effect application
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any handler that mutates G directly (must return `RuleEffect[]`)
- Any functions stored in G
- Any modification to `makeMockCtx` or other shared test helpers
- Any modification to `types.ts` (`LegendaryGameState` — no new fields)
- Any files modified outside the allowlist (see Scope Lock below)
- Expanding scope beyond WP-024 (no "while I'm here" improvements)
- Using string literal `'schemeLoss'` instead of `ENDGAME_CONDITIONS.SCHEME_LOSS`
- Storing `ImplementationMap` in G

---

## AI Agent Warning (Strict)

The mastermind strike handler MUST NOT attempt actual wound card movement.
Do NOT:
- Move cards from `G.piles.wounds` to player discard piles
- Create a new `'gainWound'` effect type
- Implement card-movement logic inside the handler
- Add new G fields for wound tracking

The MVP strike handler produces `modifyCounter` (tracking) + `queueMessage`
(observability) effects only. Actual wound card effects require a new effect
type in a future WP. This is the same safe-skip pattern as WP-023.

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/rules/schemeHandlers.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. Pure
functions only — no G mutation.**

```ts
import type { RuleEffect } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
```

**Constants:**

```ts
/**
 * MVP scheme twist threshold — most standard Legendary schemes trigger
 * loss at 7 twists.
 *
 * // why: MVP uses a fixed threshold. Future WP will parameterize
 * per-scheme thresholds resolved from registry data at setup time.
 */
const MVP_SCHEME_TWIST_THRESHOLD = 7;
```

**Function:**

```ts
/**
 * Scheme twist handler for the ImplementationMap.
 *
 * Produces effects when a scheme twist card is revealed from the villain
 * deck. Increments the scheme twist counter and checks whether the twist
 * count has reached the loss threshold.
 *
 * // why: scheme-loss is mediated through counters, not direct endgame
 * calls. The endgame evaluator reads G.counters to determine loss.
 *
 * @param gameState - Current game state (read-only — do not mutate).
 * @param _ctx - Context (unused — handlers produce effects, not mutations).
 * @param _payload - Trigger payload ({ cardId } from villain reveal).
 * @returns Array of RuleEffect descriptions to apply.
 */
export function schemeTwistHandler(
  gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[]
```

**Implementation logic (use if/else, not ternary chains):**

1. Create `effects: RuleEffect[]` array
2. Push `{ type: 'modifyCounter', counter: 'schemeTwistCount', delta: 1 }`
3. Push `{ type: 'queueMessage', message: 'Scheme twist revealed — twist count incremented.' }`
4. Calculate current twist count: `(gameState.counters.schemeTwistCount ?? 0) + 1`
   (the +1 accounts for the increment that will be applied by `applyRuleEffects`)
5. If current twist count >= `MVP_SCHEME_TWIST_THRESHOLD`:
   - Push `{ type: 'modifyCounter', counter: ENDGAME_CONDITIONS.SCHEME_LOSS, delta: 1 }`
     (uses constant, NOT string literal `'schemeLoss'`)
   - Push `{ type: 'queueMessage', message: 'Scheme loss triggered — twist threshold reached.' }`
6. Return `effects`

**Key constraint:** The handler reads `gameState.counters.schemeTwistCount`
to determine the current count, then adds 1 to predict the post-effect count.
The handler does NOT mutate `gameState` — it returns effects that
`applyRuleEffects` will apply.

---

### B) Create `packages/game-engine/src/rules/mastermindHandlers.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. Pure
functions only — no G mutation.**

```ts
import type { RuleEffect } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';
```

**Function:**

```ts
/**
 * Mastermind strike handler for the ImplementationMap.
 *
 * Produces effects when a mastermind strike card is revealed from the
 * villain deck. MVP: increments a strike counter and queues a message.
 *
 * // why: MVP strike effect is simplified. Full mastermind text abilities
 * (each player gains a wound, discard cards, etc.) require a 'gainWound'
 * effect type that does not exist yet. Counter tracking + message provides
 * observability for the MVP. A future WP will add card-movement wound
 * effects.
 *
 * @param _gameState - Current game state (unused in MVP handler).
 * @param _ctx - Context (unused — handlers produce effects, not mutations).
 * @param _payload - Trigger payload ({ cardId } from villain reveal).
 * @returns Array of RuleEffect descriptions to apply.
 */
export function mastermindStrikeHandler(
  _gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[]
```

**Implementation:**

1. Create `effects: RuleEffect[]` array
2. Push `{ type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 }`
3. Push `{ type: 'queueMessage', message: 'Mastermind strike revealed — strike count incremented.' }`
4. Return `effects`

---

### C) Modify `packages/game-engine/src/rules/ruleRuntime.impl.ts`

**Three changes to this file:**

1. **Replace stub handlers with imports of real handlers:**

   Remove `defaultSchemeImplementation` and `defaultMastermindImplementation`
   function definitions. Add imports:
   ```ts
   import { schemeTwistHandler } from './schemeHandlers.js';
   import { mastermindStrikeHandler } from './mastermindHandlers.js';
   ```

2. **Update `DEFAULT_IMPLEMENTATION_MAP`:**
   ```ts
   export const DEFAULT_IMPLEMENTATION_MAP: ImplementationMap = {
     [DEFAULT_SCHEME_HOOK_ID]: schemeTwistHandler,
     [DEFAULT_MASTERMIND_HOOK_ID]: mastermindStrikeHandler,
   };
   ```
   Update the JSDoc to reflect that these are real handlers, not stubs.

3. **Update `buildDefaultHookDefinitions` trigger arrays:**
   ```ts
   // Scheme hook:
   triggers: ['onSchemeTwistRevealed'],  // was: ['onTurnStart'] (stub)
   // Mastermind hook:
   triggers: ['onMastermindStrikeRevealed'],  // was: ['onTurnEnd'] (stub)
   ```
   Update the JSDoc to reflect the real trigger assignments.

**Keep unchanged:** `DEFAULT_SCHEME_HOOK_ID`, `DEFAULT_MASTERMIND_HOOK_ID`
constants, `buildDefaultHookDefinitions` signature, priorities (10, 20).

Add `// why:` comment on `buildImplementationMap` / `DEFAULT_IMPLEMENTATION_MAP`:
```ts
// why: functions cannot be serialized; ImplementationMap is rebuilt each
// match from matchData. Handler functions live outside G.
```

---

### D) Modify `packages/game-engine/src/index.ts`

Add exports for the new handlers:

```ts
export { schemeTwistHandler } from './rules/schemeHandlers.js';
export { mastermindStrikeHandler } from './rules/mastermindHandlers.js';
```

---

### E) Create `packages/game-engine/src/rules/schemeHandlers.test.ts` (new — 6 tests)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.
No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { schemeTwistHandler } from './schemeHandlers.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
```

**Test state builder:** Create a minimal `LegendaryGameState`-compatible
object with `counters: {}`, `messages: []`, and any other required fields
(use empty defaults). Follow the `makeTestState` pattern from existing
test files.

**6 tests:**

1. **Scheme twist handler returns non-empty `RuleEffect[]`**
   - Call `schemeTwistHandler(gameState, {}, { cardId: 'test-twist' })`
   - Assert result is an array with length > 0

2. **Produces `modifyCounter` effect for twist count**
   - Assert result contains `{ type: 'modifyCounter', counter: 'schemeTwistCount', delta: 1 }`

3. **At threshold: produces `modifyCounter` on `ENDGAME_CONDITIONS.SCHEME_LOSS`**
   - Set `gameState.counters.schemeTwistCount = 6` (one below threshold of 7)
   - Call handler
   - Assert result contains an effect with
     `{ type: 'modifyCounter', counter: ENDGAME_CONDITIONS.SCHEME_LOSS, delta: 1 }`
   - **Verify using the constant, not the string literal**

4. **Handler does not mutate G**
   - `JSON.parse(JSON.stringify(gameState))` before calling handler
   - Call handler
   - `assert.deepStrictEqual(gameState, snapshot)` after

5. **Uses `ENDGAME_CONDITIONS.SCHEME_LOSS` constant (not string literal)**
   - At threshold, find the scheme-loss effect in the result
   - Assert `effect.counter === ENDGAME_CONDITIONS.SCHEME_LOSS`
   - This is a semantic check: the constant is the source of truth

6. **`JSON.stringify(effects)` succeeds (serialization proof)**
   - Call handler, stringify the result
   - Assert result is a non-empty string

---

### F) Create `packages/game-engine/src/rules/mastermindHandlers.test.ts` (new — 4 tests)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.
No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mastermindStrikeHandler } from './mastermindHandlers.js';
```

**4 tests:**

1. **Mastermind strike handler returns `RuleEffect[]`**
   - Call `mastermindStrikeHandler(gameState, {}, { cardId: 'test-strike' })`
   - Assert result is an array with length > 0

2. **Produces wound-related effects (counter increment)**
   - Assert result contains `{ type: 'modifyCounter', counter: 'masterStrikeCount', delta: 1 }`

3. **Handler does not mutate G**
   - Snapshot before, call, deep-equal after

4. **`JSON.stringify(effects)` succeeds (serialization proof)**
   - Call handler, stringify result, assert non-empty string

---

### G) Update `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` (01.5)

**Value-only assertion updates. No new tests. No new logic.**

The existing integration tests fire `onTurnStart` and `onTurnEnd` triggers
and assert stub messages. After WP-024, the scheme hook listens to
`'onSchemeTwistRevealed'` (not `'onTurnStart'`) and the mastermind hook
listens to `'onMastermindStrikeRevealed'` (not `'onTurnEnd'`).

**Required updates:**

1. **Test 1 (line 48):** Change trigger from `'onTurnStart'` to
   `'onSchemeTwistRevealed'`. Update expected message from
   `'Scheme: turn started.'` to the new scheme twist message. Update test
   description.

2. **Test 2 (line 77):** Change trigger from `'onTurnEnd'` to
   `'onMastermindStrikeRevealed'`. Update expected message from
   `'Mastermind: turn ended.'` to the new mastermind strike message. Update
   test description.

3. **Test 3 (line 100, serialization):** Update trigger names to match.

4. **Test 4 (line 142, executeRuleHooks read-only):** Update trigger name
   to `'onSchemeTwistRevealed'`.

5. **Test 5 (line 168, modifyCounter):** Update trigger name to
   `'onSchemeTwistRevealed'`. Update expected counter name and delta to match
   the real scheme handler (counter: `'schemeTwistCount'`, delta: `1` instead
   of `0`).

6. **Update file-level JSDoc** to reflect real scheme/mastermind hooks
   instead of "default stubs".

**No new tests, no new logic, no new imports, no structural changes.**

---

## Scope Lock (Critical)

### Files Allowed to Change

| File | Action | Category |
|---|---|---|
| `packages/game-engine/src/rules/schemeHandlers.ts` | **new** | engine |
| `packages/game-engine/src/rules/mastermindHandlers.ts` | **new** | engine |
| `packages/game-engine/src/rules/ruleRuntime.impl.ts` | **modified** | engine |
| `packages/game-engine/src/index.ts` | **modified** | engine |
| `packages/game-engine/src/rules/schemeHandlers.test.ts` | **new** | test |
| `packages/game-engine/src/rules/mastermindHandlers.test.ts` | **new** | test |
| `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` | **modified (01.5)** | test |
| `docs/ai/STATUS.md` | **modified** | docs |
| `docs/ai/DECISIONS.md` | **modified** | docs |
| `docs/ai/work-packets/WORK_INDEX.md` | **modified** | docs |

### Files Explicitly NOT Allowed to Change

- `ruleHooks.types.ts` (WP-009A contract)
- `villainDeck.reveal.ts` (WP-014 reveal pipeline)
- `ruleRuntime.execute.ts` (WP-009B execution engine)
- `ruleRuntime.effects.ts` (WP-009B effect application)
- `endgame.types.ts` (WP-010 contract)
- `types.ts` (`LegendaryGameState` — no new fields)
- `game.ts` (no new moves or phase hooks)
- `buildInitialGameState.ts` (no structural changes)
- `makeMockCtx.ts` (shared test helper)
- `heroEffects.execute.ts` (WP-022 — no changes)
- `heroConditions.evaluate.ts` (WP-023 — no changes)

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build after adding scheme/mastermind handlers
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing
# Expected: 281 existing + 10 new = 291 total (approximate)

# Step 3 — confirm ENDGAME_CONDITIONS constant usage
grep -n "ENDGAME_CONDITIONS" packages/game-engine/src/rules/schemeHandlers.ts
# Expected: at least one match (import + usage)

grep -n "'schemeLoss'" packages/game-engine/src/rules/schemeHandlers.ts
# Expected: no output (string literal forbidden)

# Step 4 — confirm ImplementationMap not stored in G
grep -n "ImplementationMap" packages/game-engine/src/types.ts
# Expected: no output (ImplementationMap lives outside G)

# Step 5 — confirm no boardgame.io import in handler files
grep -l "boardgame.io" packages/game-engine/src/rules/schemeHandlers.ts packages/game-engine/src/rules/mastermindHandlers.ts
# Expected: no output

# Step 6 — confirm no .reduce() in handlers
grep -n "\.reduce(" packages/game-engine/src/rules/schemeHandlers.ts packages/game-engine/src/rules/mastermindHandlers.ts
# Expected: no output

# Step 7 — confirm WP-009A and WP-014 contracts not modified
git diff --name-only packages/game-engine/src/rules/ruleHooks.types.ts packages/game-engine/src/villainDeck/villainDeck.reveal.ts
# Expected: no output

# Step 8 — confirm no require()
grep -rn "require(" packages/game-engine/src/rules/schemeHandlers.ts packages/game-engine/src/rules/mastermindHandlers.ts
# Expected: no output

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in Scope Lock + docs/ai/* governance files
# Allowed files:
#   packages/game-engine/src/rules/schemeHandlers.ts (new)
#   packages/game-engine/src/rules/mastermindHandlers.ts (new)
#   packages/game-engine/src/rules/ruleRuntime.impl.ts (modified)
#   packages/game-engine/src/index.ts (modified)
#   packages/game-engine/src/rules/schemeHandlers.test.ts (new)
#   packages/game-engine/src/rules/mastermindHandlers.test.ts (new)
#   packages/game-engine/src/rules/ruleRuntime.integration.test.ts (modified - 01.5)
#   docs/ai/* (governance updates)
```

All grep checks must return empty (where expected). Build and tests must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-2401: Scheme and mastermind handlers use the same `executeRuleHooks` ->
     `applyRuleEffects` pipeline as hero effects. No new execution engine
     created. Extension seam: new scheme/mastermind types add handler functions
     to `ImplementationMap` by hook id.
   - D-2402: MVP scheme twist threshold is a fixed constant (7). Standard
     Legendary rules trigger scheme loss at 7 twists for most schemes. Future
     WP will parameterize per-scheme thresholds from registry data.
   - D-2403: MVP mastermind strike effect uses `modifyCounter` + `queueMessage`
     only. Actual wound card movement requires a `'gainWound'` effect type that
     does not exist yet. Counter tracking provides observability. Future WP
     will add card-movement wound effects.
   - D-2404: WP-009B stub handlers (`defaultSchemeImplementation`,
     `defaultMastermindImplementation`) replaced with real handlers. Stub
     triggers (`onTurnStart`, `onTurnEnd`) replaced with real triggers
     (`onSchemeTwistRevealed`, `onMastermindStrikeRevealed`). Integration
     test assertions updated under 01.5 allowance (value-only).
   - D-2405: File path correction — WP-024 originally referenced
     `src/setup/buildDefaultHookDefinitions.ts` and
     `src/setup/buildImplementationMap.ts` but both live in
     `src/rules/ruleRuntime.impl.ts`. Corrected during pre-flight.

2. **`docs/ai/STATUS.md`** — scheme twists now produce gameplay effects
   (twist counter increment, scheme-loss condition at threshold). Mastermind
   strikes produce counter tracking and messages (MVP — card-movement wound
   effects deferred). Scheme-loss condition is functional via
   `ENDGAME_CONDITIONS.SCHEME_LOSS`. WP-025 is unblocked.

3. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-024 with
   today's date.

---

## 01.5 Reporting Requirement

The following existing file is expected to be modified under the runtime
wiring allowance:

- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts`
  - **Why:** WP-009B stub handlers replaced with real handlers; trigger
    names and message strings changed
  - **What changed:** Trigger names in test invocations updated from
    `'onTurnStart'`/`'onTurnEnd'` to `'onSchemeTwistRevealed'`/
    `'onMastermindStrikeRevealed'`. Expected message strings updated to
    match real handler output. Counter assertion delta updated from 0 to 1.
  - **Confirmation:** No new gameplay or runtime behavior introduced.
    Value-only assertion updates.

If additional existing files require changes not listed above, STOP and
report in the execution summary. Do not modify without justification.
