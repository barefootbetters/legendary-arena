# Session Execution Prompt — WP-030 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-030 — Campaign / Scenario Framework
**Mode:** Implementation (WP-030 not yet implemented)
**Pre-Flight:** Complete (2026-04-14) — build green (340 tests, 89 suites,
0 fail), all dependencies met. PS-1 resolved: D-3001 created classifying
`src/campaign/` as engine code category. Type-tightening applied:
`ScenarioOutcome` union introduced so `advanceCampaignState(outcome)` and
`evaluateScenarioOutcome` return type share a named literal union.
**EC:** `docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md`
**Pre-flight:** `docs/ai/invocations/preflight-wp030-campaign-framework.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- Test count: 340 → **348** (8 new campaign tests, 0 existing test changes)
- All WP-030 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — NOT INVOKED

**`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` is NOT invoked by
this session prompt.**

Pre-flight verified WP-030 is **purely additive**:

- No new fields on `LegendaryGameState`
- No changes to `buildInitialGameState` return shape
- No new moves in `LegendaryGame.moves`
- No new phases or phase hooks
- The only structural assertions in `game.test.ts` are
  [`game.test.ts:91`](packages/game-engine/src/game.test.ts:91) (4 phases)
  and [`game.test.ts:100`](packages/game-engine/src/game.test.ts:100) (8
  moves). Neither is affected by campaign code.

Per 01.5 §When to Include: *"If a WP is purely additive (new files only,
no type or shape changes), this clause does not apply."*

**Consequence:** the 01.5 allowance **may not be cited** during execution
or pre-commit review to justify edits outside the Scope Lock below. If
execution discovers an unanticipated structural break in an existing
test, **STOP and escalate** — do not force-fit the change. Per 01.5
§Escalation: *"It may not be cited retroactively in execution summaries
or pre-commit reviews to justify undeclared changes."*

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "Layer Boundary (Authoritative)" — campaigns are meta-orchestration
     external to the engine
   - §Section 3 "The Three Data Classes" — `CampaignState` is Class 2
     (Configuration); individual game `G` remains Class 1 (Runtime)
   - §Section 4 "Why G Must Never Be Persisted" — campaign state is
     explicitly NOT `G`
3. `docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md`
4. `docs/ai/work-packets/WP-030-campaign-scenario-framework.md`
5. `docs/ai/invocations/preflight-wp030-campaign-framework.md` — read the
   §Risk & Ambiguity Review (risks 1-11 are locked for execution) and the
   §External Review — Disposition Log §Merging Rule (Locked)
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 13 (ESM only)
7. `docs/ai/DECISIONS.md` — read D-0501 (Campaigns Are Meta-Orchestration
   Only), D-0502 (Campaign State Lives Outside the Engine), D-0603
   (Representation Before Execution), D-3001 (Campaign Directory
   Classified as Engine Code Category)

**Implementation anchors (read before coding):**

8. `packages/game-engine/src/matchSetup.types.ts` — read `MatchSetupConfig`
   (9 readonly locked fields). Campaign overrides must produce a valid
   `MatchSetupConfig`.
9. `packages/game-engine/src/endgame/endgame.types.ts` — read `EndgameResult`
   shape `{ outcome: 'heroes-win' | 'scheme-wins', reason: string }`.
   `evaluateScenarioOutcome` reads `result.outcome`, not any `.winner`.
10. `packages/game-engine/src/scoring/scoring.types.ts` — read
    `FinalScoreSummary`. Accepted as a parameter; MVP evaluators may read
    `players[*].totalVP` only if condition type is `counterReached`.
11. `packages/game-engine/src/replay/replay.types.ts` — read `ReplayInput`.
    Campaign replay is an ordered array of these (data-only; the session
    prompt does not ask you to build the array now).
12. `packages/game-engine/src/index.ts` — read current exports. Campaign
    exports will be added at the end of the file (after line 203, after
    the WP-029 audience/filter block).
13. `packages/game-engine/src/types.ts` — read the re-export section
    (lines 1-230). Campaign types will be re-exported after the existing
    re-export blocks. **Do not** add any campaign field to
    `interface LegendaryGameState`.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for execution.
Do **not** revisit them or propose alternatives.

### 1. Named `ScenarioOutcome` union (type tightening)

```ts
export type ScenarioOutcome = 'victory' | 'defeat' | 'incomplete';
```

Used by **both**:
- `evaluateScenarioOutcome(...): ScenarioOutcome` — return type (not an
  inline literal)
- `advanceCampaignState(..., outcome: ScenarioOutcome, ...)` — parameter
  type (not `string`)

Rationale: callers cannot accidentally pass `'Victory'` or `'win'` —
compile-time safety prevents outcome-string drift.

### 2. Merging Rule (Locked — `applyScenarioOverrides` semantics)

`applyScenarioOverrides(baseConfig, scenario)` has **locked** semantics:

1. **Replace-on-override.** Any field present in
   `scenario.setupOverrides` replaces the corresponding base field
   wholesale. No field-level append, no deep merge, no union. Matches
   `Partial<MatchSetupConfig>` semantics.
2. **No aliasing.** Every array field sourced from
   `scenario.setupOverrides` must be spread-copied into the result:
   ```ts
   villainGroupIds: overrides.villainGroupIds
     ? [...overrides.villainGroupIds]
     : baseConfig.villainGroupIds,
   ```
   Apply to `villainGroupIds`, `henchmanGroupIds`, and `heroDeckIds`.
3. **Undefined or empty overrides return a copy of the base config.**
   `applyScenarioOverrides(base, scenarioWithNoOverrides)` returns a new
   object structurally equal to `base` but not reference-equal.
4. **Post-mortem aliasing trace required.** Every returned array must be
   traceable to either a spread copy of `baseConfig`'s field or a spread
   copy of `overrides`' field. No direct references.

### 3. `exactOptionalPropertyTypes` discipline

The TypeScript project uses `exactOptionalPropertyTypes: true`. For
optional fields (`description?`, `setupOverrides?`, `victoryConditions?`,
`failureConditions?`, `rewards?`, `unlockRules?`), use **conditional
assignment** when constructing test fixtures or when assembling result
objects in `applyScenarioOverrides`. Do **not** use inline ternaries
that return `T[] | undefined` for a `field?: T[]` — they fail type
checking.

Pattern:

```ts
const scenario: ScenarioDefinition = {
  id: 'test-1',
  name: 'Test Scenario',
};
if (hasDescription) {
  scenario.description = 'some description';
}
```

### 4. `advanceCampaignState` purity

- Return a **new** object: `{ ...state, ... }`
- `completedScenarios` must be a **new array**:
  `[...state.completedScenarios, scenarioId]`
- `rewards` must be a **new array**:
  `[...state.rewards, ...newRewards]`
- `currentScenarioId` advances to `null` in MVP (no branching logic)
- Do **not** mutate `state` in place. Test 6 asserts this with a
  deep-equality pre/post check.

### 5. `evaluateScenarioOutcome` MVP condition vocabulary

At MVP, the evaluator only needs to handle the locked condition types
from EC-030:

- `{ type: 'heroesWin' }` — satisfied when
  `result.outcome === 'heroes-win'`
- `{ type: 'counterReached'; key: string; threshold: number }` — MVP
  behavior: return `true` when `key === 'heroesTotalVP'` and the sum of
  `scores.players[*].totalVP` reaches `threshold`. For any other
  `key`, return `false` (safe-skip — future WPs extend).

Evaluation order (locked):
1. If any `failureConditions` entry is satisfied → return `'defeat'`
   (loss-before-victory, per D-1235 precedent)
2. Else if any `victoryConditions` entry is satisfied → return `'victory'`
3. Else → return `'incomplete'`

Use exhaustive `switch` on `condition.type` with a `never` branch for
future extensibility.

### 6. Test 7 (JSON roundtrip) precision

Use:
```ts
assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value);
```
Not `JSON.stringify(value)` alone — that doesn't prove round-trip
equality.

### 7. Test 8 (no G in CampaignState) precision

Assert the exact key set at runtime:
```ts
assert.deepStrictEqual(
  Object.keys(campaignState).sort(),
  ['campaignId', 'completedScenarios', 'currentScenarioId', 'rewards'],
);
```

### 8. Lifecycle prohibition

Campaign functions are **not** part of the boardgame.io lifecycle. They
must never be called from `game.ts`, any move, any phase hook
(`onBegin` / `onEnd` / `endIf`), or any setup-time builder. They are
consumed only by future application-layer code (not this WP) and by the
8 tests in this WP.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any campaign file or campaign
  test file
- Any `import ... from '@legendary-arena/registry'` in any campaign file
- Any import of `LegendaryGameState`, `hookRegistry`, or
  `ImplementationMap` in campaign files
- Any `.reduce()` in campaign logic or tests
- Any `Math.random()` in any new file
- Any `require()` in any file
- Any IO, network, filesystem, or environment access
- Any mutation of the input `state` in `advanceCampaignState`
- Any mutation of the input `baseConfig` or `scenario` in
  `applyScenarioOverrides`
- Any modification to `game.ts`, any file under `src/moves/`, any file
  under `src/rules/`, or any file under `src/setup/`
- Any new field added to `LegendaryGameState`
- Any new phase, stage, move, trigger name, effect type, or G counter
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock)
- Any wiring of campaign functions into `game.ts`, moves, or phase hooks
- Expanding scope beyond WP-030 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

Campaign code is **pure meta-orchestration**. It does NOT participate in
gameplay, state mutation, or rule execution. The engine does not know
campaigns exist.

**Lifecycle prohibition:** `applyScenarioOverrides`,
`evaluateScenarioOutcome`, and `advanceCampaignState` are NOT part of the
boardgame.io lifecycle. They MUST NOT be called from:
- `game.ts`
- any move function
- any phase hook (`onBegin`, `onEnd`, `endIf`)
- any setup-time builder under `src/setup/`

They are consumed exclusively by:
- the 8 tests in this WP
- future application-layer code (not in this WP)

**Do NOT:**
- Touch `G`, `ctx`, or any engine runtime state
- Import `LegendaryGameState` in any campaign file
- Mutate any input object — always return new objects
- Add `CampaignState` (or any campaign field) to `LegendaryGameState`
- Create alternate game states or shadow setup pipelines
- Add logic that runs during a game
- Import `boardgame.io` or the registry
- Invent new condition types, reward types, or unlock rules beyond those
  listed in EC-030 locked values and §5 of Pre-Flight Locked Decisions

**Instead:**
- Accept input objects, return new output objects
- Use `for...of` for all iteration
- Spread-copy every array before returning it
- Use `// why:` comments on the required points (see §Required `// why:`
  Comments below)

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/campaign/campaign.types.ts` (new)

**No boardgame.io imports. No registry imports. Type-only imports from
engine types.**

**Imports:**

```ts
import type { MatchSetupConfig } from '../matchSetup.types.js';
```

**Type definitions (data-only, JSON-serializable):**

```ts
/**
 * Campaign and scenario contract types for Legendary Arena.
 *
 * These types define data-only, JSON-serializable contracts for the
 * meta-orchestration layer that sequences individual games into
 * campaigns. The engine does not know about campaigns — it receives a
 * normal MatchSetupConfig and plays a normal deterministic game.
 *
 * // why: CampaignState is Class 2 (Configuration) — external to the
 * engine, never part of LegendaryGameState (D-0502). Individual game G
 * remains Class 1 (Runtime), never persisted.
 *
 * // why: campaign/engine separation per D-0501. Scenario overrides
 * produce a valid MatchSetupConfig before Game.setup() runs; campaign
 * progression is computed after the game ends from EndgameResult and
 * FinalScoreSummary. The engine is never aware of campaigns.
 */

/**
 * Named union for scenario outcomes. Used by both
 * evaluateScenarioOutcome (return type) and advanceCampaignState
 * (outcome parameter) so callers cannot pass arbitrary strings.
 */
export type ScenarioOutcome = 'victory' | 'defeat' | 'incomplete';

/**
 * Declarative outcome condition. Evaluated after game ends.
 */
export type ScenarioOutcomeCondition =
  | { type: 'heroesWin' }
  | { type: 'counterReached'; key: string; threshold: number };

/**
 * Declarative reward descriptor. Applied after scenario completion.
 */
export type ScenarioReward =
  | { type: 'unlockScenario'; scenarioId: string };

/**
 * A single scenario within a campaign. Data-only wrapper around one
 * game with setup overrides and outcome conditions.
 */
export interface ScenarioDefinition {
  id: string;
  name: string;
  description?: string;
  setupOverrides?: Partial<MatchSetupConfig>;
  victoryConditions?: ScenarioOutcomeCondition[];
  failureConditions?: ScenarioOutcomeCondition[];
  rewards?: ScenarioReward[];
}

/**
 * Declarative unlock rule — gates scenarios behind completion of others.
 */
export interface CampaignUnlockRule {
  scenarioId: string;
  requires: string[];
}

/**
 * Ordered campaign definition with scenarios and unlock rules.
 */
export interface CampaignDefinition {
  id: string;
  name: string;
  scenarios: ScenarioDefinition[];
  unlockRules?: CampaignUnlockRule[];
}

/**
 * Mutable campaign progression state. External to the engine.
 *
 * // why: CampaignState is Class 2 data, external to engine (D-0502).
 * This type must never appear as a field of LegendaryGameState.
 */
export interface CampaignState {
  campaignId: string;
  completedScenarios: string[];
  currentScenarioId: string | null;
  rewards: ScenarioReward[];
}
```

All types are JSON-serializable — no functions, no closures, no classes.

---

### B) Create `packages/game-engine/src/campaign/campaign.logic.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`.
Type-only imports from engine types.**

**Imports:**

```ts
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { EndgameResult } from '../endgame/endgame.types.js';
import type { FinalScoreSummary } from '../scoring/scoring.types.js';
import type {
  ScenarioDefinition,
  ScenarioOutcome,
  ScenarioOutcomeCondition,
  ScenarioReward,
  CampaignState,
} from './campaign.types.js';
```

**Function 1: `applyScenarioOverrides`**

```ts
/**
 * Merges scenario setup overrides into a base MatchSetupConfig.
 *
 * Replace-on-override semantics: any field present in
 * scenario.setupOverrides replaces the corresponding base field
 * wholesale. Array fields are spread-copied to prevent aliasing with
 * the source scenario object.
 *
 * // why: the engine receives a normal MatchSetupConfig — it never knows
 * about campaigns (D-0501). Scenario overrides are applied before
 * Game.setup() runs.
 *
 * @param baseConfig - The base match setup. Not mutated.
 * @param scenario - The scenario whose setupOverrides are applied.
 * @returns A new MatchSetupConfig with overrides applied.
 */
export function applyScenarioOverrides(
  baseConfig: MatchSetupConfig,
  scenario: ScenarioDefinition,
): MatchSetupConfig
```

Implementation requirements:
- Build a new object; do not mutate `baseConfig` or `scenario`.
- For each of the 9 `MatchSetupConfig` fields, use replace semantics:
  - Scalar fields (`schemeId`, `mastermindId`, `bystandersCount`,
    `woundsCount`, `officersCount`, `sidekicksCount`): use the override
    if defined, else the base value.
  - Array fields (`villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`):
    **spread-copy** from whichever source is used, so the returned
    arrays are new arrays. Never return a direct reference to an array
    owned by `scenario.setupOverrides`.
- If `scenario.setupOverrides` is `undefined`, return a shallow copy of
  `baseConfig` (array fields spread-copied).
- Use `for...of` if you iterate; no `.reduce()`.

**Function 2: `evaluateScenarioOutcome`**

```ts
/**
 * Evaluates scenario outcome conditions against a completed game's
 * results. Pure function — reads inputs only.
 *
 * Evaluation order:
 *   1. If any failureCondition is satisfied → 'defeat'
 *   2. Else if any victoryCondition is satisfied → 'victory'
 *   3. Else → 'incomplete'
 *
 * MVP condition vocabulary:
 *   - { type: 'heroesWin' }: satisfied when result.outcome === 'heroes-win'
 *   - { type: 'counterReached'; key; threshold }: satisfied when
 *     key === 'heroesTotalVP' and sum of scores.players[*].totalVP >= threshold
 *     (other keys return false — safe-skip for future WPs)
 *
 * // why: evaluated after game ends, not during. The engine never calls
 * this — it is called by the application layer after endgame is reached.
 *
 * // why: loss-before-victory evaluation order resolves simultaneous
 * condition ambiguity deterministically (D-1235 precedent).
 *
 * @param result - The completed game's endgame result.
 * @param scores - The completed game's final score summary.
 * @param victoryConditions - Conditions satisfying victory.
 * @param failureConditions - Conditions satisfying failure.
 * @returns The scenario outcome: 'victory', 'defeat', or 'incomplete'.
 */
export function evaluateScenarioOutcome(
  result: EndgameResult,
  scores: FinalScoreSummary,
  victoryConditions: ScenarioOutcomeCondition[] | undefined,
  failureConditions: ScenarioOutcomeCondition[] | undefined,
): ScenarioOutcome
```

**Implementation note:** the WP-030 Scope originally specified a single
`conditions` parameter. For clarity and to exercise the locked loss-
before-victory order, the session prompt accepts victory and failure
conditions as two separate parameters. This is a minor parameter
shaping; both call sites and tests must use the two-parameter form.

Implementation requirements:
- Use a private helper `isConditionSatisfied(condition, result, scores)`
  with an exhaustive `switch` on `condition.type`.
- Iterate with `for...of`. No `.reduce()`.
- Treat `undefined` victory/failure condition arrays as empty — do not
  throw.
- Never read `G` or any engine runtime state.

**Function 3: `advanceCampaignState`**

```ts
/**
 * Returns an updated CampaignState after a scenario completes.
 * Pure function — does not mutate the input state.
 *
 * Appends the completed scenario to completedScenarios, appends any
 * new rewards to rewards, and advances currentScenarioId to null
 * (MVP — no branching logic).
 *
 * // why: CampaignState is Class 2 (Configuration) data, external to
 * the engine (D-0502). Campaign progression is computed after the game
 * ends from the EndgameResult — the engine is never involved.
 *
 * @param state - The current campaign state. Not mutated.
 * @param scenarioId - The ID of the scenario that just completed.
 * @param outcome - The outcome returned by evaluateScenarioOutcome.
 * @param rewards - Rewards granted by this scenario.
 * @returns A new CampaignState with the scenario appended.
 */
export function advanceCampaignState(
  state: CampaignState,
  scenarioId: string,
  outcome: ScenarioOutcome,
  rewards: ScenarioReward[],
): CampaignState
```

Implementation requirements:
- Return `{ ...state, completedScenarios: [...], rewards: [...], currentScenarioId: null }`
- `completedScenarios` is a new array: `[...state.completedScenarios, scenarioId]`
- `rewards` is a new array: `[...state.rewards, ...rewards]`
- `currentScenarioId` is set to `null` in MVP (branching logic is deferred)
- The `outcome` parameter is accepted for API completeness but may be
  unused in MVP — if unused, prefix with `_` (TypeScript-conventional)
  or reference it in a `// why:` comment explaining it is reserved for
  future branching logic. Do **not** delete the parameter.
- Do not mutate `state`, `state.completedScenarios`, or `state.rewards`.

---

### C) Modify `packages/game-engine/src/types.ts`

Add a re-export block **after** the last existing re-export block (look
for the section near the end of the file where other types.ts re-exports
live — after the villain deck / city / mastermind re-export block).

```ts
// why: campaign types (ScenarioDefinition, CampaignDefinition,
// CampaignState, ScenarioOutcome, and sub-types) are defined canonically
// in src/campaign/campaign.types.ts (WP-030). Re-exported here so that
// consumers importing from './types.js' have access. CampaignState is
// NOT a field of LegendaryGameState — campaign state is Class 2 data,
// external to the engine per D-0502.
export type {
  ScenarioOutcome,
  ScenarioOutcomeCondition,
  ScenarioReward,
  ScenarioDefinition,
  CampaignUnlockRule,
  CampaignDefinition,
  CampaignState,
} from './campaign/campaign.types.js';
```

**Do NOT** modify `interface LegendaryGameState`. Do NOT add any
campaign field to it. The re-export is purely additive.

---

### D) Modify `packages/game-engine/src/index.ts`

Add exports at the **end** of the file (after the WP-029 audience & filter
block, after line 203):

```ts
// Campaign / scenario framework (WP-030)
export type {
  ScenarioOutcome,
  ScenarioOutcomeCondition,
  ScenarioReward,
  ScenarioDefinition,
  CampaignUnlockRule,
  CampaignDefinition,
  CampaignState,
} from './campaign/campaign.types.js';
export {
  applyScenarioOverrides,
  evaluateScenarioOutcome,
  advanceCampaignState,
} from './campaign/campaign.logic.js';
```

---

### E) Create `packages/game-engine/src/campaign/campaign.logic.test.ts` (new)

**Uses `node:test` and `node:assert` only. No boardgame.io imports. No
registry imports.**

**Imports:**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenarioOverrides,
  evaluateScenarioOutcome,
  advanceCampaignState,
} from './campaign.logic.js';
import type {
  CampaignState,
  ScenarioDefinition,
  ScenarioOutcomeCondition,
  ScenarioReward,
} from './campaign.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { EndgameResult } from '../endgame/endgame.types.js';
import type { FinalScoreSummary } from '../scoring/scoring.types.js';
```

**Shared fixtures:**

```ts
const BASE_CONFIG: MatchSetupConfig = {
  schemeId: 'scheme-base',
  mastermindId: 'mastermind-base',
  villainGroupIds: ['villain-base-a', 'villain-base-b'],
  henchmanGroupIds: ['henchman-base'],
  heroDeckIds: ['hero-deck-base-1', 'hero-deck-base-2'],
  bystandersCount: 10,
  woundsCount: 15,
  officersCount: 20,
  sidekicksCount: 5,
};

const BASE_STATE: CampaignState = {
  campaignId: 'campaign-test',
  completedScenarios: [],
  currentScenarioId: 'scenario-1',
  rewards: [],
};

const BASE_ENDGAME_HEROES: EndgameResult = {
  outcome: 'heroes-win',
  reason: 'Mastermind defeated',
};

const BASE_ENDGAME_SCHEME: EndgameResult = {
  outcome: 'scheme-wins',
  reason: 'Scheme triggered loss',
};

const BASE_SCORES: FinalScoreSummary = {
  players: [
    {
      playerId: '0',
      villainVP: 3,
      henchmanVP: 2,
      bystanderVP: 1,
      tacticVP: 5,
      woundVP: 0,
      totalVP: 11,
    },
  ],
  winner: '0',
};
```

**Test intent (strict):**
These tests are **contract enforcement** tests. If tests fail, the
implementation is incorrect by definition. Do NOT weaken assertions to
make tests pass — fix the implementation instead.

**8 tests (required, in this order):**

1. **`applyScenarioOverrides produces a valid MatchSetupConfig`**
   - Build a `ScenarioDefinition` with `setupOverrides` containing
     `schemeId: 'scheme-override'` and
     `villainGroupIds: ['villain-override-only']`.
   - Call `applyScenarioOverrides(BASE_CONFIG, scenario)`.
   - Assert result has all 9 required `MatchSetupConfig` fields.
   - Assert `result.schemeId === 'scheme-override'` (replaced).
   - Assert `result.villainGroupIds.length === 1` and
     `result.villainGroupIds[0] === 'villain-override-only'` (replaced,
     not appended).
   - Assert `result.mastermindId === 'mastermind-base'` (unchanged).
   - Assert `result.bystandersCount === 10` (unchanged).

2. **`applyScenarioOverrides with no overrides returns the base config`**
   - Build a `ScenarioDefinition` with no `setupOverrides` field.
   - Call `applyScenarioOverrides(BASE_CONFIG, scenario)`.
   - Assert `assert.deepStrictEqual(result, BASE_CONFIG)`.
   - Assert `result !== BASE_CONFIG` (new object, not the same reference).
   - Assert `result.villainGroupIds !== BASE_CONFIG.villainGroupIds`
     (array is also a copy — proves no aliasing).

3. **`evaluateScenarioOutcome returns 'victory' when conditions met`**
   - Build a scenario with
     `victoryConditions: [{ type: 'heroesWin' }]` and no failure
     conditions.
   - Call `evaluateScenarioOutcome(BASE_ENDGAME_HEROES, BASE_SCORES, victoryConditions, undefined)`.
   - Assert result is `'victory'`.

4. **`evaluateScenarioOutcome returns 'defeat' when failure conditions met`**
   - Build a scenario with
     `failureConditions: [{ type: 'heroesWin' }]` (unusual but valid —
     this tests loss-before-victory order).
   - Also pass
     `victoryConditions: [{ type: 'heroesWin' }]`.
   - Call `evaluateScenarioOutcome(BASE_ENDGAME_HEROES, BASE_SCORES, victoryConditions, failureConditions)`.
   - Assert result is `'defeat'` (failure beats victory by evaluation order).

5. **`advanceCampaignState appends completed scenario`**
   - Call `advanceCampaignState(BASE_STATE, 'scenario-1', 'victory', [])`.
   - Assert `result.completedScenarios.length === 1` and
     `result.completedScenarios[0] === 'scenario-1'`.
   - Assert `result.currentScenarioId === null`.
   - Assert `result.campaignId === 'campaign-test'`.

6. **`advanceCampaignState returns new object (input not mutated)`**
   - Capture `const before = JSON.stringify(BASE_STATE)`.
   - Call `advanceCampaignState(BASE_STATE, 'scenario-1', 'victory', [{ type: 'unlockScenario', scenarioId: 'scenario-2' }])`.
   - Capture `const after = JSON.stringify(BASE_STATE)`.
   - Assert `before === after` (original state unchanged).
   - Assert `result !== BASE_STATE`.
   - Assert `result.completedScenarios !== BASE_STATE.completedScenarios`
     (new array).
   - Assert `result.rewards !== BASE_STATE.rewards` (new array).

7. **`all types are JSON-serializable (stringify roundtrip)`**
   - Build one example of each public type: `ScenarioDefinition`,
     `CampaignDefinition`, `CampaignState`, a `ScenarioOutcomeCondition`,
     a `ScenarioReward`.
   - For each, assert
     `assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value)`.
   - This proves the value contains no functions, Maps, Sets, Dates, or
     Symbols.

8. **`campaign state does NOT contain G or engine internals`**
   - Construct a sample `CampaignState` with non-empty values in all four
     fields.
   - Assert the exact key set:
     ```ts
     assert.deepStrictEqual(
       Object.keys(campaignState).sort(),
       ['campaignId', 'completedScenarios', 'currentScenarioId', 'rewards'],
     );
     ```
   - This forbids accidental leakage of `G`, `piles`, `messages`,
     `counters`, or any other engine-internal field into `CampaignState`.

---

## Required `// why:` Comments

Per EC-030 §Required `// why:` Comments and the code-style rules, the
following `// why:` comments are mandatory:

- `campaign.types.ts`: on `CampaignState` — "Class 2 data, external to
  engine (D-0502)"
- `campaign.types.ts`: near the top — campaign/engine separation (D-0501)
- `campaign.logic.ts` / `applyScenarioOverrides`: "engine receives a
  normal MatchSetupConfig — never knows about campaigns"
- `campaign.logic.ts` / `evaluateScenarioOutcome`: "evaluated after game
  ends, not during" AND "loss-before-victory evaluation order (D-1235
  precedent)"
- `campaign.logic.ts` / `advanceCampaignState`: "Class 2 data, external
  to engine (D-0502)" if not already present at the type level
- `types.ts` re-export block: reason for re-export + explicit statement
  that `CampaignState` is NOT a field of `LegendaryGameState`

No `// why:` comment is required on `ctx.events.setPhase` or
`ctx.events.endTurn` — WP-030 does not touch either.

---

## Scope Lock (Authoritative)

### WP-030 Is Allowed To

- Create: `packages/game-engine/src/campaign/campaign.types.ts` — type
  contracts
- Create: `packages/game-engine/src/campaign/campaign.logic.ts` —
  three pure functions
- Create: `packages/game-engine/src/campaign/campaign.logic.test.ts` —
  8 tests
- Modify: `packages/game-engine/src/types.ts` — re-export campaign types
  (purely additive; no modification to `LegendaryGameState`)
- Modify: `packages/game-engine/src/index.ts` — export campaign types
  and logic functions (purely additive, at the end of the file)
- Update: `docs/ai/STATUS.md` — campaign and scenario contracts exist;
  D-0501 and D-0502 implemented; campaigns orchestrate games without
  modifying the engine
- Update: `docs/ai/DECISIONS.md` — add WP-030 decision entries (at
  minimum: why campaign state is external to G; why scenarios produce
  MatchSetupConfig not modified G; how campaign replay works as a
  sequence of ReplayInputs)
- Update: `docs/ai/work-packets/WORK_INDEX.md` — check off WP-030 with
  today's date

### WP-030 Is Explicitly Not Allowed To

- No modification to any engine file (`game.ts`, `src/moves/`,
  `src/rules/`, `src/setup/`, `src/state/`, `src/turn/`, `src/board/`,
  `src/hero/`, `src/economy/`, `src/villainDeck/`, `src/scheme/`,
  `src/mastermind/`, `src/ui/`, `src/replay/`, `src/scoring/`,
  `src/endgame/`, `src/persistence/`, `src/lobby/`)
- No modification to `interface LegendaryGameState`
- No new field, move, phase, stage, trigger, effect, or counter
- No `boardgame.io` imports in any new file
- No `@legendary-arena/registry` imports in any new file
- No imports of `LegendaryGameState`, `hookRegistry`, or
  `ImplementationMap` in campaign files
- No `.reduce()` in campaign logic or tests
- No `Math.random()` or any other nondeterministic source
- No `require()` in any file
- No IO, network, filesystem, or environment access
- No mutation of input objects in any campaign function
- No modification to `makeMockCtx` or other shared test helpers
- No modification to any existing test file
- No files outside the allowlist above
- No "while I'm here" improvements, refactors, or cleanups
- No wiring of campaign functions into `game.ts`, moves, phase hooks,
  or setup builders
- No invocation of 01.5 runtime-wiring allowance (see §Runtime Wiring
  Allowance — NOT INVOKED above)

---

## Test Expectations (Locked)

- **8 new tests** in
  `packages/game-engine/src/campaign/campaign.logic.test.ts`, in the
  order specified in §E above
- All **340 existing tests** must continue to pass **unchanged**
- Expected final test count: **348 tests, 90 suites, 0 fail**
- No existing test file may be modified
- No `boardgame.io` imports in test files
- No `boardgame.io/testing` imports
- No modifications to `makeMockCtx` or other shared test helpers
- Tests construct synthetic `CampaignState`, `ScenarioDefinition`,
  `MatchSetupConfig`, `EndgameResult`, and `FinalScoreSummary` fixtures
  inline — no registry data, no mock `G`, no `buildInitialGameState` call

---

## Verification Steps (Must Execute Before Completion)

```pwsh
# Step 1 — build after adding campaign framework
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — 348 tests passing, 0 failing, 90 suites

# Step 3 — confirm no boardgame.io import in campaign files
Select-String -Path "packages\game-engine\src\campaign" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no registry import in campaign files
Select-String -Path "packages\game-engine\src\campaign" -Pattern "@legendary-arena/registry" -Recurse
# Expected: no output

# Step 5 — confirm CampaignState not part of LegendaryGameState
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "CampaignState"
# Expected: only re-export lines — NOT inside `interface LegendaryGameState`

# Step 6 — confirm no .reduce() in campaign
Select-String -Path "packages\game-engine\src\campaign" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 7 — confirm no Math.random() in campaign
Select-String -Path "packages\game-engine\src\campaign" -Pattern "Math\.random" -Recurse
# Expected: no output

# Step 8 — confirm no require() in campaign
Select-String -Path "packages\game-engine\src\campaign" -Pattern "require\(" -Recurse
# Expected: no output

# Step 9 — confirm no engine files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/ packages/game-engine/src/turn/ packages/game-engine/src/board/ packages/game-engine/src/hero/ packages/game-engine/src/economy/ packages/game-engine/src/villainDeck/ packages/game-engine/src/scheme/ packages/game-engine/src/mastermind/ packages/game-engine/src/ui/ packages/game-engine/src/replay/ packages/game-engine/src/scoring/ packages/game-engine/src/endgame/ packages/game-engine/src/persistence/ packages/game-engine/src/lobby/
# Expected: no output

# Step 10 — confirm only allowlisted files in diff
git diff --name-only
# Expected: only the files listed in Scope Lock
```

Every step must pass before marking the WP complete.

---

## Post-Mortem Checks (Run Before Marking Complete)

Mandatory post-mortem for WP-030 (per pre-flight risk #10):

1. **Aliasing trace for `applyScenarioOverrides`:** for each array field
   in the returned `MatchSetupConfig` (`villainGroupIds`,
   `henchmanGroupIds`, `heroDeckIds`), trace the returned value to its
   source. Confirm it is a spread copy, not a direct reference. Tests
   2 already asserts this for the no-overrides case; manually verify
   the overrides case by inspecting the source.
2. **`CampaignState` key set:** confirm `CampaignState` has exactly the
   four documented keys (`campaignId`, `completedScenarios`,
   `currentScenarioId`, `rewards`). Test 8 enforces this at runtime.
3. **No engine modification:** run
   `git diff --name-only packages/game-engine/src/` and confirm only
   `types.ts`, `index.ts`, and the three new `campaign/` files appear.
4. **`LegendaryGameState` unchanged:** confirm
   `interface LegendaryGameState` in `types.ts` has no new field.

If any check fails, the implementation is incorrect. Fix and re-verify
before marking complete.

---

## Post-Execution Documentation (After All Tests Pass)

1. **`docs/ai/DECISIONS.md`** — add at least these WP-030 entries:
   - **D-3002 (proposed):** *Campaign State External to G — Rationale.*
     Campaign state is Class 2 data, external to the engine, persisted
     by the application layer. Individual game `G` remains Class 1,
     never persisted. This separation means campaign replay is simply
     a sequence of independently-replayable `ReplayInput` objects —
     no special campaign replay format is needed.
   - **D-3003 (proposed):** *Scenarios Produce MatchSetupConfig, Not
     Modified G.* `applyScenarioOverrides` produces a valid
     `MatchSetupConfig` that the engine treats as any other match
     configuration. The engine never knows it is part of a campaign.
     This preserves D-0501 (meta-orchestration only) and keeps the
     engine unaware of campaigns.
   - **D-3004 (proposed):** *Campaign Replay as Sequence of ReplayInputs.*
     Campaign-level replay is the concatenation of each scenario's
     `ReplayInput`. There is no campaign-level replay format. Each
     scenario's game is independently replayable and produces the same
     `EndgameResult` deterministically.

   Decision IDs are placeholder — use the next available IDs in
   DECISIONS.md following the house-style `### D-NNNN` heading and
   `Status: Immutable` footer (matching D-2901, D-2902, D-2903, D-3001).

2. **`docs/ai/STATUS.md`** — update Phase 6 status:
   - Campaign / scenario contracts exist
   - D-0501 and D-0502 implemented
   - Campaigns orchestrate games without modifying the engine
   - Campaign replay works as a sequence of `ReplayInput` objects

3. **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-030:
   ```
   - [x] WP-030 — Campaign / Scenario Framework ✅ Reviewed
   ```
   Add completion date in the Notes block.

---

## Execution Summary Requirements

At the end of the session, produce a brief execution summary that states:

1. Test count: should be `348 tests, 90 suites, 0 fail`
2. Files created (should match the allowlist exactly)
3. Files modified (should be exactly `types.ts` and `index.ts`)
4. Confirmation that 01.5 was NOT invoked
5. Confirmation that no `LegendaryGameState` field was added
6. Confirmation that no engine file (as defined in Scope Lock) was modified
7. Post-mortem checks 1-4 explicitly passed

Any deviation from the above must be documented and justified in the
execution summary. Do not silently proceed if any verification step
fails — stop and escalate.

---

## Commit Convention

When work is complete and all verification steps pass:

```
EC-030: implement campaign and scenario framework contracts
```

Body should note: contract-only WP; no engine modification; D-0501 and
D-0502 implemented; 8 new tests; `ScenarioOutcome` named union; campaign
state external to `LegendaryGameState`.

---

## Final Instruction

WP-030 is a pure contract + pure helpers work packet. The temptation to
"helpfully" wire campaign functions into the game lifecycle or add a
`campaignState` field to `LegendaryGameState` must be resisted. The
engine does not know campaigns exist, and WP-030 exists to keep it that
way.

When in doubt, STOP and consult the pre-flight document or escalate to
the user. Do not force-fit changes. Do not invoke 01.5 retroactively.
Do not modify any file outside the Scope Lock.
