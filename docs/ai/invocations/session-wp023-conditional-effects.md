# Session Execution Prompt — WP-023 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-023 — Conditional Hero Effects (Teams, Colors, Keywords)
**Mode:** Implementation (WP-023 not yet implemented)
**Pre-Flight:** Complete (2026-04-13) — build green (266 tests passing),
all dependencies met. Two blocking findings resolved via Option A (narrow
scope): `heroClassMatch` and `requiresTeam` evaluators implemented but
return `false` until team/class data is resolved into G by a follow-up WP.
`requiresKeyword` and `playedThisTurn` fully functional with current G data.
Condition type name locked to `heroClassMatch` (actual code), not
`requiresColor` (WP aspirational name).
**EC:** `docs/ai/execution-checklists/EC-023-conditional-effects.checklist.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- All WP-023 acceptance criteria satisfied (with narrow-scope adjustments)
- Any deviation: **STOP and report failure**

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - §4 "The Rule Execution Pipeline" — condition evaluation is a pre-filter
     step before effect application, following the same deterministic pattern
   - "Layer Boundary (Authoritative)" — condition evaluation is game-engine
     layer only
   - "MVP Gameplay Invariants" — "Data Representation Before Execution" and
     "Registry & Runtime Boundary" (condition evaluation uses data already
     in G — no registry queries at runtime)
3. `docs/ai/execution-checklists/EC-023-conditional-effects.checklist.md`
4. `docs/ai/work-packets/WP-023-conditional-hero-effects-teams-colors-keywords.md`
5. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()` with branching), 13 (ESM only)

**Implementation anchors (read before coding):**

6. `packages/game-engine/src/hero/heroEffects.execute.ts` — read the full
   file. This is the integration point. Lines 146-162 contain the
   conditional-skip logic that WP-023 replaces with actual condition
   evaluation. The `executeHeroEffects` function signature, the
   `executeSingleEffect` dispatch, and the `MVP_KEYWORDS` set are all
   unchanged.
7. `packages/game-engine/src/rules/heroAbility.types.ts` — read
   `HeroCondition`: `{ type: string; value: string }`. This is the WP-021
   contract. Do not modify this file.
8. `packages/game-engine/src/setup/heroAbility.setup.ts` — read
   `parseAbilityText` (lines 107-194). Understand which condition type
   strings are actually produced. Currently only `heroClassMatch` is
   generated (line 123). The other condition types are aspirational.
9. `packages/game-engine/src/types.ts` — read `LegendaryGameState` to
   confirm available G fields. Note that `CardStatEntry` (line 307) has
   only `attack`, `recruit`, `cost`, `fightCost` — no team or heroClass.

---

## Runtime Wiring Allowance (01.5)

This WP does not add new fields to `LegendaryGameState`. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, the allowance
applies only if existing test structural assertions need value-only
updates due to the behavioral change (conditional effects now evaluate
instead of being skipped).

If any existing test file outside the WP allowlist requires a value-only
assertion update (e.g., a structural assertion in `game.test.ts` that
counts exports), the following applies:

- Only value-only assertion updates permitted — no new logic
- Each file modified must be documented in the execution summary
- No new behavior may be introduced

Files that may be touched under 01.5 if needed:

- `packages/game-engine/src/index.ts` — already in WP scope (new exports)
- Existing structural tests if export counts change — value-only updates

If no existing tests break, 01.5 is not exercised.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution:

1. **Condition type name:** Use `heroClassMatch` (the actual condition type
   string produced by `heroAbility.setup.ts` line 123), NOT `requiresColor`
   (the WP's aspirational name). The evaluator must match the strings that
   exist in `G.heroAbilityHooks` at runtime.

2. **Narrow scope (Option A):** Two of four condition types lack runtime
   data in G:
   - `heroClassMatch` — evaluator implemented but returns `false` (no hero
     class data in `G.cardStats` or any other G field). Follows the WP-022
     "unsupported = safe skip" pattern.
   - `requiresTeam` — evaluator implemented but returns `false` (no team
     data in G). Same safe-skip pattern.
   - `requiresKeyword` — fully functional. Evaluates by checking if any
     card in `G.playerZones[player].inPlay` has hooks in
     `G.heroAbilityHooks` that contain the specified keyword.
   - `playedThisTurn` — fully functional. Evaluates by checking
     `G.playerZones[player].inPlay.length >= parseInt(condition.value)`.

3. **`HeroCondition.value` is always `string`:** For `playedThisTurn`,
   the evaluator parses `value` to a number via `parseInt`. Returns `false`
   if parsing fails. This is documented with a `// why:` comment.

4. **AND logic confirmed:** `evaluateAllConditions` returns `true` only
   when ALL conditions pass. Empty/undefined conditions returns `true`
   (unconditional). Uses `for...of`, not `.reduce()`.

5. **WP-022 test compatibility:** The existing WP-022 test (test 5 in
   `heroEffects.execute.test.ts`) uses `conditions: [{ type:
   'heroClassMatch', value: 'strength' }]`. Under the new evaluator,
   `heroClassMatch` returns `false`, so the effect is still skipped.
   **The test's observable behavior is unchanged** — no modification needed.

6. **WP-021 contracts locked:** `heroAbility.types.ts` and `heroKeywords.ts`
   must NOT be modified.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any modification to WP-021 contract files (`heroAbility.types.ts`,
  `heroKeywords.ts`)
- Any modification to `economy.types.ts` (`CardStatEntry`)
- Any modification to `heroAbility.setup.ts`
- Any modification to `types.ts` (`LegendaryGameState`)
- Any new G fields
- Any `boardgame.io` import in condition evaluator
- Any `@legendary-arena/registry` import in any new file
- Any `.reduce()` in condition evaluation — use `for...of`
- Any `Math.random()` in any new file
- Any `require()` in any new file
- Any condition evaluator that mutates G
- Any condition evaluator that reads hidden information (opponent hands,
  deck order, unrevealed cards)
- Any new condition types beyond the 4 listed
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock below)
- Expand scope beyond WP-023 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

The condition evaluators for `heroClassMatch` and `requiresTeam` MUST
return `false` unconditionally. Do NOT attempt to:
- Look up team/class data from any source outside G
- Invent a workaround to make these evaluators "work"
- Add new G fields to store team/class data
- Modify setup code to resolve additional data

These evaluators are **placeholders** that follow the WP-022 "unsupported
= safe skip" pattern. A follow-up WP will resolve team/class data into G
and enable them.

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/hero/heroConditions.evaluate.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. Pure
functions only — no G mutation.**

```ts
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroCondition } from '../rules/heroAbility.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
```

Note: `ctx` is NOT needed by condition evaluators. The WP specifies
`ctx` in the signature but condition evaluation reads only `G`. If you
determine `ctx` is truly unnecessary, omit it from the signature and
document in a `// why:` comment. If the WP's signature is followed for
forward compatibility, accept `ctx: unknown` and do not use it.

**Functions:**

```ts
/**
 * Evaluates a single hero ability condition against current game state.
 *
 * Pure function: reads G, returns boolean, never mutates state.
 * Unsupported condition types return false (safe skip).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param condition - The condition descriptor to evaluate.
 * @returns Whether the condition is met.
 */
function evaluateCondition(
  G: LegendaryGameState,
  playerID: string,
  condition: HeroCondition,
): boolean
```

**Condition dispatch (use if/else or switch — no `.reduce()`):**

| Condition type | Implementation | Status |
|---|---|---|
| `heroClassMatch` | Returns `false` unconditionally. `// why: hero class data is not resolved into G yet — returns false until a follow-up WP adds class data to G.cardStats or a dedicated field.` | Placeholder |
| `requiresTeam` | Returns `false` unconditionally. `// why: team data is not resolved into G yet — returns false until a follow-up WP adds team data to G.cardStats or a dedicated field.` | Placeholder |
| `requiresKeyword` | Checks if any `CardExtId` in `G.playerZones[playerID].inPlay` has a hook in `G.heroAbilityHooks` whose `keywords` array contains the condition's `value`. Uses `getHooksForCard` + iteration. `// why: evaluates keyword synergy — checks if any played card has hooks with the specified keyword.` | Functional |
| `playedThisTurn` | Checks if `G.playerZones[playerID].inPlay.length >= parseInt(condition.value, 10)`. Returns `false` if `parseInt` produces `NaN`. `// why: condition.value is always a string per HeroCondition contract — parse to number for threshold comparison.` | Functional |
| Any other type | Returns `false`. `// why: unsupported condition types are safely skipped — same pattern as WP-022 for unsupported keywords.` | Safe skip |

**Guard:** If `G.playerZones[playerID]` is undefined, return `false`.

```ts
/**
 * Evaluates all conditions on a hero ability hook (AND logic).
 *
 * Returns true only if ALL conditions pass. Empty or undefined conditions
 * array returns true (unconditional effect).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param conditions - Array of conditions to evaluate (may be undefined).
 * @returns Whether all conditions are met.
 */
function evaluateAllConditions(
  G: LegendaryGameState,
  playerID: string,
  conditions: HeroCondition[] | undefined,
): boolean
```

**Implementation:**
- If `conditions` is `undefined` or empty array: return `true`
- Use `for...of` over conditions
- If any single condition returns `false`: return `false` immediately
- If all pass: return `true`

Export both functions.

---

### B) Modify `packages/game-engine/src/hero/heroEffects.execute.ts`

**Replace the conditional-skip logic with actual condition evaluation.**

1. Add import:
   ```ts
   import { evaluateAllConditions } from './heroConditions.evaluate.js';
   ```

2. Replace lines 146-152 (the `if (hook.conditions !== undefined &&
   hook.conditions.length > 0) { continue; }` block) with:
   ```ts
   // why: WP-023 upgrade — WP-022 skipped all conditional effects;
   // WP-023 evaluates them deterministically. Effects execute only when
   // ALL conditions pass (AND logic). Unsupported condition types return
   // false (safe skip), so hooks with unsupported conditions are still
   // effectively skipped.
   if (!evaluateAllConditions(G, playerID, hook.conditions)) {
     continue;
   }
   ```

3. Update the JSDoc on `executeHeroEffects` to reflect that conditional
   effects are now evaluated (remove "Hooks with conditions are skipped").

**No other changes to this file.** The `executeSingleEffect` function,
`MVP_KEYWORDS` set, magnitude validation, and all keyword dispatch logic
remain unchanged.

---

### C) Modify `packages/game-engine/src/index.ts`

Add exports for the condition evaluators:

```ts
export { evaluateCondition, evaluateAllConditions } from './hero/heroConditions.evaluate.js';
```

---

### D) Create `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` (new — 10 tests)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.
No modifications to shared test helpers.**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
```

Import `evaluateCondition`, `evaluateAllConditions` from the new module.

**Test state builder:** Create a minimal `LegendaryGameState`-compatible
object for tests. Follow the pattern from `heroEffects.execute.test.ts`
(`makeTestState`). Include:
- `playerZones['0'].inPlay` — array of `CardExtId` strings
- `heroAbilityHooks` — array of `HeroAbilityHook` objects
- `turnEconomy` — default zero values
- `cardStats` — empty or minimal record

**10 tests:**

1. **`heroClassMatch` returns `false` (placeholder — no class data in G)**
   - Set up inPlay with a hero card
   - Evaluate `{ type: 'heroClassMatch', value: 'tech' }`
   - Assert returns `false`
   - `// why: heroClassMatch is a placeholder until class data is resolved into G`

2. **`requiresTeam` returns `false` (placeholder — no team data in G)**
   - Set up inPlay with a hero card
   - Evaluate `{ type: 'requiresTeam', value: 'avengers' }`
   - Assert returns `false`

3. **`requiresKeyword` passes when matching keyword on played card**
   - Set up inPlay with `'hero-a'`
   - Set up heroAbilityHooks with a hook for `'hero-a'` that has
     `keywords: ['attack']`
   - Evaluate `{ type: 'requiresKeyword', value: 'attack' }`
   - Assert returns `true`

4. **`requiresKeyword` fails when no matching keyword**
   - Set up inPlay with `'hero-a'`
   - Set up heroAbilityHooks with a hook for `'hero-a'` that has
     `keywords: ['recruit']`
   - Evaluate `{ type: 'requiresKeyword', value: 'draw' }`
   - Assert returns `false`

5. **`playedThisTurn` passes when enough cards played**
   - Set up inPlay with 3 cards
   - Evaluate `{ type: 'playedThisTurn', value: '2' }`
   - Assert returns `true`

6. **`playedThisTurn` fails when too few cards played**
   - Set up inPlay with 1 card
   - Evaluate `{ type: 'playedThisTurn', value: '3' }`
   - Assert returns `false`

7. **Unsupported condition type returns `false` (safe skip)**
   - Evaluate `{ type: 'unknownFutureCondition', value: 'anything' }`
   - Assert returns `false`

8. **`evaluateAllConditions` with empty conditions returns `true`**
   - Call with `conditions: []`
   - Assert returns `true`
   - Also test with `conditions: undefined`
   - Assert returns `true`

9. **`evaluateAllConditions` with mixed pass/fail returns `false` (AND logic)**
   - Set up inPlay with 3 cards
   - Conditions: `[{ type: 'playedThisTurn', value: '2' }, { type: 'heroClassMatch', value: 'tech' }]`
   - First condition passes (3 >= 2), second fails (placeholder)
   - Assert returns `false`

10. **Condition evaluation does not mutate G (deep equality check)**
    - `JSON.parse(JSON.stringify(G))` before evaluation
    - Evaluate a condition
    - `assert.deepEqual(G, snapshot)` after evaluation

---

### E) Create `packages/game-engine/src/hero/heroEffects.conditional.test.ts` (new — 5 tests)

**Uses `node:test` and `node:assert` only. No boardgame.io imports.
No modifications to shared test helpers.**

Import `executeHeroEffects` from `heroEffects.execute.js`.

**Test state builder:** Reuse or replicate the `makeTestState` pattern
from `heroEffects.execute.test.ts`.

**Mock ctx:** Create a minimal mock context with `random: { Shuffle: (arr) => [...arr].reverse() }` — same pattern as WP-022 tests.

**5 tests:**

1. **Conditional effect with met conditions: effect executes**
   - Hook with `conditions: [{ type: 'playedThisTurn', value: '1' }]`
     and `effects: [{ type: 'attack', magnitude: 3 }]`
   - Set up inPlay with 2 cards (meets threshold)
   - Execute `executeHeroEffects`
   - Assert `G.turnEconomy.attack` increased by 3

2. **Conditional effect with unmet conditions: effect skipped, no G mutation**
   - Hook with `conditions: [{ type: 'heroClassMatch', value: 'tech' }]`
     and `effects: [{ type: 'attack', magnitude: 5 }]`
   - Execute `executeHeroEffects`
   - Snapshot relevant G subtrees before execution
   - Assert no change to `turnEconomy` or `inPlay`

3. **Multiple effects on one card, some conditional: only met ones execute**
   - Card `'hero-x'` has two hooks:
     - Hook 1: unconditional (no conditions), `effects: [{ type: 'recruit', magnitude: 2 }]`
     - Hook 2: conditional (`heroClassMatch`), `effects: [{ type: 'attack', magnitude: 4 }]`
   - Execute `executeHeroEffects`
   - Assert `recruit` increased by 2
   - Assert `attack` unchanged (condition not met)

4. **Condition evaluation does not mutate G (deep equality check)**
   - `JSON.parse(JSON.stringify(G))` before execution
   - Execute with a conditional hook (condition fails)
   - Assert `G` matches snapshot (no side effects from condition evaluation)

5. **`JSON.stringify(G)` succeeds after conditional execution**
   - Execute `executeHeroEffects` with conditional hooks
   - Assert `JSON.stringify(G)` does not throw and produces a non-empty
     string (serialization proof)

---

## Scope Lock (Critical)

### Files Allowed to Change

| File | Action | Category |
|---|---|---|
| `packages/game-engine/src/hero/heroConditions.evaluate.ts` | **new** | engine |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | **modified** | engine |
| `packages/game-engine/src/index.ts` | **modified** | engine |
| `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` | **new** | test |
| `packages/game-engine/src/hero/heroEffects.conditional.test.ts` | **new** | test |
| `docs/ai/STATUS.md` | **modified** | docs |
| `docs/ai/DECISIONS.md` | **modified** | docs |
| `docs/ai/work-packets/WORK_INDEX.md` | **modified** | docs |

### Files Explicitly NOT Allowed to Change

- `heroAbility.types.ts` (WP-021 contract)
- `heroKeywords.ts` (WP-021 contract)
- `economy.types.ts` (WP-018 contract — `CardStatEntry`)
- `heroAbility.setup.ts` (WP-021 setup code)
- `types.ts` (`LegendaryGameState` — no new fields)
- `game.ts` (no new moves or phase hooks)
- `makeMockCtx.ts` (shared test helper)
- `heroEffects.execute.test.ts` (existing WP-022 tests — must pass as-is)

---

## Verification (Run All Before Completion)

```bash
# Step 1 — build after adding conditional evaluation
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing
# Expected: 266 existing + 15 new = 281 total (approximate)

# Step 3 — confirm no boardgame.io import in condition evaluator
grep -l "boardgame.io" packages/game-engine/src/hero/heroConditions.evaluate.ts
# Expected: no output

# Step 4 — confirm no registry import
grep -rl "@legendary-arena/registry" packages/game-engine/src/hero/
# Expected: no output

# Step 5 — confirm no .reduce() in condition logic
grep -n "\.reduce(" packages/game-engine/src/hero/heroConditions.evaluate.ts
# Expected: no output

# Step 6 — confirm WP-021 contracts not modified
git diff --name-only packages/game-engine/src/rules/heroAbility.types.ts packages/game-engine/src/rules/heroKeywords.ts
# Expected: no output

# Step 7 — confirm no require()
grep -rn "require(" packages/game-engine/src/hero/heroConditions.evaluate.ts packages/game-engine/src/hero/heroConditions.evaluate.test.ts packages/game-engine/src/hero/heroEffects.conditional.test.ts
# Expected: no output

# Step 8 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in Scope Lock + docs/ai/* governance files
# Allowed files:
#   packages/game-engine/src/hero/heroConditions.evaluate.ts (new)
#   packages/game-engine/src/hero/heroEffects.execute.ts (modified)
#   packages/game-engine/src/index.ts (modified)
#   packages/game-engine/src/hero/heroConditions.evaluate.test.ts (new)
#   packages/game-engine/src/hero/heroEffects.conditional.test.ts (new)
#   docs/ai/* (governance updates)
```

All grep checks must return empty. Build and tests must exit 0.

---

## Post-Execution Documentation

1. **`docs/ai/DECISIONS.md`** — add entries:
   - D-2301: Condition evaluation uses AND logic — all conditions on a hook
     must pass for effects to execute. Empty/undefined conditions = unconditional.
   - D-2302: 4 MVP condition types implemented. `requiresKeyword` and
     `playedThisTurn` are fully functional. `heroClassMatch` and
     `requiresTeam` return `false` until team/class data is resolved into G
     by a follow-up WP (data infrastructure gap, not logic gap).
   - D-2303: Condition evaluators are pure functions — they read G and
     return boolean, never mutating state. Deep equality test enforces this.
   - D-2304: Condition type `heroClassMatch` is the actual string produced
     by `heroAbility.setup.ts`. WP-023 originally used `requiresColor` but
     pre-flight discovered the name drift. Code matches the actual data.
   - D-2305: `HeroCondition.value` is always a string. `playedThisTurn`
     evaluator parses to integer. Invalid parse returns `false` (safe skip).

2. **`docs/ai/STATUS.md`** — conditional hero effects now evaluate;
   `requiresKeyword` and `playedThisTurn` synergies work;
   `heroClassMatch` and `requiresTeam` are placeholders pending data
   resolution; WP-024 is unblocked

3. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-023 with
   today's date

---

## 01.5 Reporting Requirement

If any existing file outside the WP-023 allowlist was modified under the
runtime wiring allowance:

Document in the execution summary:
- Which file was modified
- Why the modification was required
- What structural change was applied
- Confirmation that no new gameplay or runtime behavior was introduced

If no existing tests or structural assertions required changes, note:
"01.5 allowance referenced but not exercised — no existing files required
structural updates."
