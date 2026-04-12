# Work Packet Invocation — WP-009B (Scheme & Mastermind Rule Execution)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-009B`
**Work Packet Title:** Scheme & Mastermind Rule Execution (Minimal MVP)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-009B** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-009B implements the *two-step rule execution pipeline* — `executeRuleHooks`
collects `RuleEffect[]` without modifying `G`, then `applyRuleEffects` applies
them deterministically with `for...of`. It also establishes the
`ImplementationMap` pattern (handler functions keyed by hook `id`, living
outside `G`) and adds `messages`, `counters`, and `hookRegistry` to
`LegendaryGameState`. Default stub implementations produce observable
`G.messages` entries on `onTurnStart` and `onTurnEnd`.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section 4: The Rule Execution Pipeline (read in full — authoritative for
     every design decision in this packet)
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - Rule Execution Pipeline section
   - G serialization invariants
   - Move Validation Contract (moves never throw)
   - Pure helper rules (no boardgame.io imports in `src/rules/`)

4. `.claude/rules/code-style.md`
   - Rule 5 (30-line function limit — extract named helpers if needed)
   - Rule 6 (`// why:` comment requirements)
   - Rule 8 (no `.reduce()` — use `for...of`)
   - Rule 11 (full-sentence error messages)
   - Rule 13 (ESM only)

5. `docs/ai/execution-checklists/EC-009B-rule-execution.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-009B-rule-execution-minimal-mvp.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/rules/ruleHooks.types.ts` — `RuleTriggerName`,
   `RuleEffect`, `HookDefinition`, `HookRegistry`; do NOT modify (WP-009A contract)
8. `packages/game-engine/src/rules/ruleHooks.registry.ts` — `getHooksForTrigger`,
   `createHookRegistry`; do NOT modify (WP-009A contract)
9. `packages/game-engine/src/rules/ruleHooks.validate.ts` — `validateRuleEffect`;
   do NOT modify (WP-009A contract)
10. `packages/game-engine/src/moves/zoneOps.ts` — `moveCardFromZone`,
    `moveAllCards`; use for `discardHand` and `drawCards` effects; do NOT modify
11. `packages/game-engine/src/moves/coreMoves.impl.ts` — reference only for
    understanding the draw pattern; do NOT call its `drawCards` move function
    from the effect applicator (see Risk Resolution below)
12. `packages/game-engine/src/setup/shuffle.ts` — `shuffleDeck`; use for deck
    reshuffle in `drawCards` effect; do NOT modify
13. `packages/game-engine/src/game.ts` — will be modified (wire triggers,
    initialize new G fields)
14. `packages/game-engine/src/types.ts` — will be modified (add 3 fields to
    `LegendaryGameState`)
15. `packages/game-engine/src/index.ts` — will be modified (export new API)
16. `packages/game-engine/src/setup/buildInitialGameState.ts` — will be modified
    under 01.5 allowance (add 3 fields to return object)
17. `packages/game-engine/src/test/mockCtx.ts` — read-only; do NOT modify
18. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-009A complete (2026-04-11, commit `082ddb5`) — all rule hook contracts exported
- `RuleTriggerName`, `RuleEffect`, `HookDefinition`, `HookRegistry` exported
- `createHookRegistry`, `getHooksForTrigger` exported from `ruleHooks.registry.ts`
- `moveAllCards`, `moveCardFromZone` exported from `zoneOps.ts` (WP-008B)
- `shuffleDeck` exported from `src/setup/shuffle.ts`
- `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 99/99 passing, 0 failing

### Risks Identified and Resolved

1. **`drawCards` effect cannot call the move function from `coreMoves.impl.ts`** —
   The existing `drawCards` in `coreMoves.impl.ts` is a full boardgame.io move
   that validates args and checks stage gates. The effect applicator must NOT call
   it. Instead, implement draw logic directly using `moveCardFromZone` /
   `moveAllCards` / `shuffleDeck` from `zoneOps.ts` and `shuffle.ts`. This
   follows the `zoneOps.ts` helper pattern. The `shuffleDeck` call for reshuffle
   requires a `ShuffleProvider`-compatible context.

2. **`ImplementationMap` typing references `Ctx`** — The WP shows `Ctx` in the
   handler signature, but `src/rules/` files must NOT import `boardgame.io`.
   Use a narrow local interface or `unknown` for the ctx parameter to avoid the
   import. The handler functions in `ruleRuntime.impl.ts` do not use `ctx`
   (the default stubs only return static effects).

3. **`buildInitialGameState.ts` not in WP allowlist** — Must add 3 new fields
   to the return object. Covered by 01.5 runtime wiring allowance. Minimal
   structural addition only.

4. **Existing structural tests may need value-only updates** — Adding 3 fields
   to `LegendaryGameState` may change key counts in shape tests. Update
   assertion values only under 01.5 allowance.

5. **`makeMockCtx` returns `SetupContext`** but `executeRuleHooks` and
   `applyRuleEffects` need a ctx-like object — Create inline mock contexts in
   test files per WP-008B precedent. Do NOT modify `makeMockCtx`.

6. **`game.ts` lifecycle hooks need `ImplementationMap`** — Import
   `DEFAULT_IMPLEMENTATION_MAP` from `ruleRuntime.impl.ts` and use in lifecycle
   hooks. Never assign it to `G`.

---

## Critical Context (Post-WP-009A Reality)

- WP-009A is complete. The following are present in `@legendary-arena/game-engine`:
  - `RuleTriggerName` — 5-value union
  - `RULE_TRIGGER_NAMES` — canonical readonly array
  - `RuleEffect` — 4-variant tagged union (`queueMessage`, `modifyCounter`,
    `drawCards`, `discardHand`)
  - `RULE_EFFECT_TYPES` — canonical readonly array
  - `HookDefinition` — data-only, 5 fields (`id`, `kind`, `sourceId`,
    `triggers`, `priority`)
  - `HookRegistry = HookDefinition[]`
  - `getHooksForTrigger(registry, triggerName)` — returns hooks sorted by
    priority asc, then id lexically
  - `createHookRegistry(hooks)` — validates and returns; throws on invalid
  - `validateRuleEffect(effect)` — returns `{ ok: true } | { ok: false; errors }`
  - `moveAllCards(from, to)` — returns `{ from: [], to: [...to, ...from] }`
  - `moveCardFromZone(from, to, cardId)` — returns `{ from, to, found }`
  - `shuffleDeck(deck, context)` — deterministic shuffle via `context.random.Shuffle`
  - 99 tests passing across the game-engine package
- `LegendaryGameState` currently has: `matchConfiguration`, `selection`,
  `currentStage`, `playerZones`, `piles`
- `game.ts` has `play` phase with `turn.onBegin` that resets `G.currentStage`
- No `turn.onEnd` hook exists yet — this packet adds it
- `buildInitialGameState` returns a `LegendaryGameState` — must add 3 new fields

---

## Scope Contract (Read Carefully)

### WP-009B DOES:

- Create `src/rules/ruleRuntime.execute.ts` — `ImplementationMap` type (handler
  functions keyed by hook `id`, no `boardgame.io` import), `executeRuleHooks`
  (reads `G`, calls `getHooksForTrigger`, accumulates `RuleEffect[]`, returns
  without modifying `G`)
- Create `src/rules/ruleRuntime.effects.ts` — `applyRuleEffects` (applies
  effects using `for...of`: `queueMessage` pushes to `G.messages`,
  `modifyCounter` updates `G.counters`, `drawCards` draws using zoneOps helpers,
  `discardHand` uses `moveAllCards`, unknown types push warning — never throw)
- Create `src/rules/ruleRuntime.impl.ts` — `DEFAULT_SCHEME_HOOK_ID`,
  `DEFAULT_MASTERMIND_HOOK_ID`, `defaultSchemeImplementation`,
  `defaultMastermindImplementation`, `DEFAULT_IMPLEMENTATION_MAP`,
  `buildDefaultHookDefinitions`
- Create `src/rules/ruleRuntime.ordering.test.ts` — 3 ordering tests
- Create `src/rules/ruleRuntime.integration.test.ts` — end-to-end integration
  tests
- Modify `src/types.ts` — add `messages: string[]`, `counters: Record<string, number>`,
  `hookRegistry: HookDefinition[]` to `LegendaryGameState`
- Modify `src/game.ts` — `Game.setup()` initializes new fields; `turn.onBegin`
  wires `onTurnStart` trigger; `turn.onEnd` (new) wires `onTurnEnd` trigger
- Modify `src/index.ts` — export `ImplementationMap`, `executeRuleHooks`,
  `applyRuleEffects`, `buildDefaultHookDefinitions`
- Add required `// why:` comments on `ImplementationMap` pattern, execute/apply
  separation, unknown-type handler, and trigger wiring points

### WP-009B DOES NOT:

- No specific printed scheme twist or mastermind strike card text
- No villain deck, city, HQ, or KO logic
- No `onSchemeTwistRevealed` / `onMastermindStrikeRevealed` trigger wiring
- No rules glossary lookups from PostgreSQL
- No persistence or database access
- No server or UI changes
- No modification of WP-009A contract files (`ruleHooks.types.ts`,
  `ruleHooks.validate.ts`, `ruleHooks.registry.ts`)
- No `boardgame.io` import in any file under `src/rules/`
- No `.reduce()` in effect application
- No `throw` in `applyRuleEffects`
- No `Math.random()`
- No `ImplementationMap` or handler functions stored in any field of `G`
- No calling the `drawCards` move function from `coreMoves.impl.ts` in the
  effect applicator — use `zoneOps.ts` helpers directly
- No speculative helpers, convenience abstractions, or "while I'm here" improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/rules/ruleRuntime.execute.ts              — new
    packages/game-engine/src/rules/ruleRuntime.effects.ts              — new
    packages/game-engine/src/rules/ruleRuntime.impl.ts                 — new
    packages/game-engine/src/rules/ruleRuntime.ordering.test.ts        — new
    packages/game-engine/src/rules/ruleRuntime.integration.test.ts     — new
    packages/game-engine/src/types.ts                                   — modified
    packages/game-engine/src/game.ts                                    — modified
    packages/game-engine/src/index.ts                                   — modified

Any modification outside this list must satisfy the Runtime Wiring Allowance
below, or it is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/rules/ruleHooks.types.ts               — WP-009A contract
    packages/game-engine/src/rules/ruleHooks.validate.ts            — WP-009A contract
    packages/game-engine/src/rules/ruleHooks.registry.ts            — WP-009A contract
    packages/game-engine/src/rules/ruleHooks.contracts.test.ts      — WP-009A tests
    packages/game-engine/src/moves/coreMoves.types.ts               — WP-008A contract
    packages/game-engine/src/moves/coreMoves.gating.ts              — WP-008A contract
    packages/game-engine/src/moves/coreMoves.validate.ts            — WP-008A contract
    packages/game-engine/src/moves/coreMoves.impl.ts                — WP-008B
    packages/game-engine/src/moves/zoneOps.ts                       — WP-008B
    packages/game-engine/src/turn/turnPhases.types.ts               — WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts               — WP-007A contract
    packages/game-engine/src/turn/turnLoop.ts                       — WP-007B
    packages/game-engine/src/test/mockCtx.ts                        — shared test helper
    packages/game-engine/src/state/zones.types.ts                   — WP-006A contract
    packages/game-engine/src/setup/shuffle.ts                       — WP-005B
    packages/game-engine/src/setup/playerInit.ts                    — WP-006B
    packages/game-engine/src/setup/pilesInit.ts                     — WP-006B

These are dependencies, not execution targets.

---

## Runtime Wiring Allowance

This WP adds `messages`, `counters`, and `hookRegistry` to
`LegendaryGameState`. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`,
minimal wiring edits to the following files are permitted solely to restore
type and assertion correctness:

- `packages/game-engine/src/setup/buildInitialGameState.ts` — add `messages: []`,
  `counters: {}`, and `hookRegistry` (from `buildDefaultHookDefinitions`) to the
  return object
- Existing structural tests affected by the new required fields (e.g.,
  `buildInitialGameState.shape.test.ts` key-count assertions,
  `game.test.ts` structural assertions)

No new behavior may be introduced under this allowance. Changes are limited to:
- Adding the 3 new field initializations to `buildInitialGameState`'s return object
- Updating assertion literal values in existing tests (key counts, field presence)
- Importing `buildDefaultHookDefinitions` in `buildInitialGameState.ts` if needed
  for the `hookRegistry` initialization
- Importing `HookDefinition` type if needed for the import chain

Any file modified under this clause must be documented in the execution summary.

---

## Locked Values (Do Not Re-Derive)

### New LegendaryGameState fields (exactly 3)

- `messages: string[]` — initialized to `[]` in `Game.setup()`
- `counters: Record<string, number>` — initialized to `{}` in `Game.setup()`
- `hookRegistry: HookDefinition[]` — initialized from `buildDefaultHookDefinitions(matchData)` in `Game.setup()`

### Default hook IDs

- `DEFAULT_SCHEME_HOOK_ID = 'default-scheme-hook'`
- `DEFAULT_MASTERMIND_HOOK_ID = 'default-mastermind-hook'`

### Default implementation message strings (exact — integration tests assert equality)

- Scheme `onTurnStart`: `'Scheme: turn started.'`
- Mastermind `onTurnEnd`: `'Mastermind: turn ended.'`

### Default scheme implementation return value

```
[
  { type: 'queueMessage', message: 'Scheme: turn started.' },
  { type: 'modifyCounter', counter: 'schemeTwistCount', delta: 0 }
]
```

### Default mastermind implementation return value

```
[
  { type: 'queueMessage', message: 'Mastermind: turn ended.' },
  { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 0 }
]
```

### `discardHand` effect zone mapping

`hand` -> `discard` (uses `moveAllCards` from `zoneOps.ts`)

### `modifyCounter` formula

`G.counters[effect.counter] = (G.counters[effect.counter] ?? 0) + effect.delta`

### PlayerZones keys (from WP-006A — use exact names)

`deck`, `hand`, `discard`, `inPlay`, `victory`

### Required // why: comments

- `ruleRuntime.execute.ts` — `ImplementationMap` pattern: handler functions are
  separate from `HookDefinition` because `G` must be JSON-serializable; functions
  cannot live in `G`
- `ruleRuntime.execute.ts` — `executeRuleHooks` returns effects without applying:
  lets tests assert what would happen without modifying `G`; allows callers to
  inspect, filter, or replay the effect list before application
- `ruleRuntime.effects.ts` — unknown-type handler: new effect types added in
  later packets should fail gracefully rather than crashing
- `game.ts` — both trigger wiring points (`turn.onBegin`, `turn.onEnd`):
  trigger -> collect effects -> apply effects pipeline

---

## Pre-Flight Risk Resolutions (Locked for Execution)

These decisions were made during pre-flight and must not be revisited.

### Risk 1: `drawCards` effect implementation

The `drawCards` move in `coreMoves.impl.ts` is a full boardgame.io move with
validation and stage gating. The effect applicator must NOT call it. Instead,
implement draw logic directly using `moveCardFromZone` and `moveAllCards` from
`zoneOps.ts`, and `shuffleDeck` from `shuffle.ts` for deck reshuffle. This
follows the established `zoneOps.ts` helper pattern. The `shuffleDeck` call
requires a `ShuffleProvider`-compatible context — `applyRuleEffects` must
receive a context argument that provides `random.Shuffle`.

### Risk 2: `ImplementationMap` typing and boardgame.io imports

`src/rules/` files must NOT import `boardgame.io`. The `ImplementationMap`
handler signature must use a narrow local interface or `unknown` for the ctx
parameter instead of importing `Ctx` from `boardgame.io`. The default stub
implementations in `ruleRuntime.impl.ts` do not use `ctx` (they return
static effects), so this is safe.

### Risk 3: `buildInitialGameState.ts` modification

Covered by 01.5 runtime wiring allowance. Add `messages: []`, `counters: {}`,
`hookRegistry` from `buildDefaultHookDefinitions(config)` to the return object.
This requires importing `buildDefaultHookDefinitions` from
`ruleRuntime.impl.ts`. No new behavior introduced.

### Risk 4: Inline mock contexts for tests

`makeMockCtx` returns `SetupContext` but `executeRuleHooks` and
`applyRuleEffects` need a ctx-like object. Create inline mock contexts in test
files per WP-008B precedent. Do NOT modify `makeMockCtx`.

### Risk 5: `ImplementationMap` access in `game.ts`

Import `DEFAULT_IMPLEMENTATION_MAP` from `ruleRuntime.impl.ts` and use in
lifecycle hooks via closure or direct reference. Never assign it to `G`.

---

## Test Expectations (Locked)

### Ordering tests — `src/rules/ruleRuntime.ordering.test.ts` (3 tests)

1. Two hooks with different priorities — lower priority hook's effects appear
   first in the result
2. Two hooks with equal priority — tie broken by `id` lexically
3. Hook with no matching handler in `implementationMap` is skipped gracefully —
   no throw, remaining hooks still fire

### Integration tests — `src/rules/ruleRuntime.integration.test.ts`

- Build a `G` with `messages: []`, `counters: {}`, `hookRegistry` from
  `buildDefaultHookDefinitions`
- Call `executeRuleHooks` for `onTurnStart` with `DEFAULT_IMPLEMENTATION_MAP`
- Call `applyRuleEffects` with the returned effects
- Assert `G.messages` contains `'Scheme: turn started.'`
- Repeat for `onTurnEnd` — assert `'Mastermind: turn ended.'` appears
- Assert `JSON.stringify(G)` succeeds after all effects applied

**Prior test baseline:** 99 tests pass — all must continue to pass (some
existing structural tests may need value-only updates under 01.5 allowance).

**Test boundaries:** no `boardgame.io` imports in test files; no modifications
to `makeMockCtx`; `node:test` + `node:assert` only; `.test.ts` extension.

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-009B`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `executeRuleHooks` reads `G` only — never modifies it
- `applyRuleEffects` uses `for...of` — never `.reduce()`
- Unknown effect types push a warning to `G.messages` — never throw
- `ImplementationMap` lives outside `G` — never stored in any `G` field
- No `boardgame.io` import in any file under `src/rules/`
- No calling `drawCards` move from `coreMoves.impl.ts` in effect applicator
- `executeRuleHooks` calls `getHooksForTrigger` — no duplicate `.sort()` logic
- `G` must remain JSON-serializable after all mutations
- Moves never throw; only `Game.setup()` may throw
- ESM only, `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension
- Tests use `node:test` and `node:assert` only — no `boardgame.io/testing`
- WP-009A contract files must not be modified

---

## EC-Mode Execution Rules

- All code changes must map to **EC-009B**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-009B execution:

- All EC-009B checklist items must pass
- All tests must pass (99 existing + new ordering/integration tests)
- `LegendaryGameState` has `messages`, `counters`, `hookRegistry`
- `Game.setup()` initializes all three fields correctly
- `JSON.stringify(G)` succeeds — no functions in `G`
- `executeRuleHooks` returns `RuleEffect[]` without modifying `G`
- No `.sort()` in `ruleRuntime.execute.ts`
- `applyRuleEffects` handles all 4 effect types + unknown gracefully
- No `throw` in `ruleRuntime.effects.ts`
- No `.reduce()` in `ruleRuntime.effects.ts`
- After `onTurnStart`: `G.messages` contains `'Scheme: turn started.'`
- After `onTurnEnd`: `G.messages` contains `'Mastermind: turn ended.'`
- `ImplementationMap` not stored in any field of `G`
- WP-009A contract files untouched
- No `boardgame.io` import in any `src/rules/` file
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after wiring changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no throw in effect applicator
grep "throw " packages/game-engine/src/rules/ruleRuntime.effects.ts
# Expected: no output

# Step 4 — confirm no .reduce() in effect applicator
grep "\.reduce(" packages/game-engine/src/rules/ruleRuntime.effects.ts
# Expected: no output

# Step 5 — confirm executeRuleHooks has no duplicate sort logic
grep "\.sort(" packages/game-engine/src/rules/ruleRuntime.execute.ts
# Expected: no output (sorting happens in getHooksForTrigger from WP-009A)

# Step 6 — confirm WP-009A contract files were not modified
git diff --name-only packages/game-engine/src/rules/ruleHooks.types.ts packages/game-engine/src/rules/ruleHooks.validate.ts packages/game-engine/src/rules/ruleHooks.registry.ts
# Expected: no output (all three files untouched)

# Step 7 — confirm no IO access in implementations
grep -E "fetch|readFile|pg\." packages/game-engine/src/rules/ruleRuntime.impl.ts
# Expected: no output

# Step 8 — confirm no require() in any rules file
grep -r "require(" packages/game-engine/src/rules/
# Expected: no output

# Step 9 — confirm no boardgame.io import in rules files
grep -r "boardgame.io" packages/game-engine/src/rules/ | grep -v "// " | grep -v "* "
# Expected: no output (only JSDoc comments may mention it)

# Step 10 — confirm ImplementationMap not stored in G
grep "G\.\(implementationMap\|implementations\)" packages/game-engine/src/game.ts
# Expected: no output

# Step 11 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in allowlist + any 01.5 allowance files
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — what the rules pipeline can do; what a match produces
    on each turn start/end
  - `docs/ai/DECISIONS.md` — at minimum: the `ImplementationMap` pattern (why
    handler functions are separate from `HookDefinition`); why `executeRuleHooks`
    and `applyRuleEffects` are two separate functions rather than one; why unknown
    effect types are handled gracefully rather than thrown
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-009B complete with date
- Document any files modified under the Runtime Wiring Allowance
- Commit using EC-mode hygiene rules (`EC-009B:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-009B:

**DO NOT IMPLEMENT IT.**
