# Work Packet Invocation — WP-010 (Victory & Loss Conditions)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-010`
**Work Packet Title:** Victory & Loss Conditions (Minimal MVP)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-010** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-010 implements deterministic victory and loss conditions so a match can
conclusively end. A pure `evaluateEndgame(G)` function reads `G.counters`
to check three MVP conditions in a fixed priority order (loss before victory).
boardgame.io's `endIf` is wired into the `play` phase and delegates entirely
to `evaluateEndgame`. Canonical `ENDGAME_CONDITIONS` constants establish the
counter key names that every future packet must use when incrementing endgame
counters.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section 4: "The endIf Contract" and "G.counters Key Conventions" (read
     in full — authoritative for every design decision in this packet)
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - G serialization invariants
   - Move Validation Contract (moves never throw)
   - Pure helper rules

4. `.claude/rules/code-style.md`
   - Rule 3 (no nested ternaries — use `if/else if/else`)
   - Rule 4 (no abbreviations — `escapedVillainCount` not `evCount`)
   - Rule 6 (`// why:` comment requirements)
   - Rule 9 (`node:` prefix on all Node built-in imports)
   - Rule 13 (ESM only)

5. `docs/ai/execution-checklists/EC-010-endgame.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-010-victory-loss-conditions-minimal-mvp.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/types.ts` — `LegendaryGameState` with `counters:
   Record<string, number>` (WP-009B); will be modified (re-export endgame types)
8. `packages/game-engine/src/game.ts` — `play` phase structure; will be modified
   (add `endIf`)
9. `packages/game-engine/src/index.ts` — will be modified (export new API)
10. `packages/game-engine/src/rules/ruleRuntime.effects.ts` — reference only for
    understanding how `modifyCounter` increments `G.counters`; do NOT modify
11. `packages/game-engine/src/test/mockCtx.ts` — read-only; do NOT modify
    (tests for `evaluateEndgame` do not need it — pure function, no ctx)
12. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-009B complete (2026-04-11, commit `8f04bb6`) — `G.counters`, `G.messages`,
  `G.hookRegistry` present in `LegendaryGameState`
- `game.ts` has `play` phase with `onTurnStart`/`onTurnEnd` triggers wired
- No existing `endIf` in `game.ts` — clean insertion point
- No existing `src/endgame/` directory — will be created fresh
- `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 108/108 passing, 0 failing

### Risks Identified and Resolved

1. **Test construction of minimal G objects** — `evaluateEndgame` only reads
   `G.counters`. Tests should cast minimal `{ counters: { ... } }` objects as
   `LegendaryGameState` rather than building full state via
   `buildInitialGameState`. This avoids test fragility and unnecessary coupling.

2. **`endIf` return type compatibility** — boardgame.io expects truthy (game
   over) or falsy (continue). `evaluateEndgame` returns `EndgameResult | null`.
   Use `evaluateEndgame(G) ?? undefined` per ARCHITECTURE.md. The `?? undefined`
   converts `null` to `undefined` for boardgame.io convention.

3. **`endIf` placement in `game.ts`** — `endIf` is a `play` phase-level
   property, sibling to `next` and `turn`. Confirmed no existing `endIf` via
   grep. Straightforward addition.

4. **No `endgame/` directory exists** — Will be created with 3 files:
   `endgame.types.ts`, `endgame.evaluate.ts`, `endgame.evaluate.test.ts`.

---

## Critical Context (Post-WP-009B Reality)

- WP-009B is complete. The following are present in `@legendary-arena/game-engine`:
  - `LegendaryGameState.counters: Record<string, number>` — initialized to `{}`
  - `LegendaryGameState.messages: string[]` — initialized to `[]`
  - `LegendaryGameState.hookRegistry: HookDefinition[]` — initialized from
    `buildDefaultHookDefinitions`
  - `applyRuleEffects` handles `modifyCounter` effects:
    `G.counters[effect.counter] = (G.counters[effect.counter] ?? 0) + effect.delta`
  - `game.ts` has `play` phase with `turn.onBegin` (resets `currentStage`,
    fires `onTurnStart`) and `turn.onEnd` (fires `onTurnEnd`)
  - No `endIf` exists yet — this packet adds it
  - 108 tests passing across the game-engine package
- `G.counters` keys are strings. Missing keys evaluate as `0` via `?? 0`.
  This is the pattern WP-010 uses for all counter reads.

---

## Scope Contract (Read Carefully)

### WP-010 DOES:

- Create `src/endgame/endgame.types.ts` — `EndgameOutcome` type (`'heroes-win'
  | 'scheme-wins'`), `EndgameResult` interface (`{ outcome, reason }`),
  `ENDGAME_CONDITIONS` constants (3 canonical counter key strings),
  `ESCAPE_LIMIT = 8`
- Create `src/endgame/endgame.evaluate.ts` — pure `evaluateEndgame(G)` function
  that checks 3 conditions in fixed priority order using `if/else if/else`
- Create `src/endgame/endgame.evaluate.test.ts` — 6 tests using `node:test`
- Modify `src/game.ts` — add `endIf` to `play` phase, delegating to
  `evaluateEndgame`
- Modify `src/types.ts` — re-export `EndgameResult`, `EndgameOutcome`,
  `ENDGAME_CONDITIONS`
- Modify `src/index.ts` — export `evaluateEndgame`, `EndgameResult`,
  `EndgameOutcome`, `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT`
- Add required `// why:` comments on `ESCAPE_LIMIT`, evaluation order,
  `endIf` delegation, and priority test

### WP-010 DOES NOT:

- No scoring UI or VP calculation
- No complex Legendary edge cases (multi-mastermind defeat, divided schemes)
- No city or villain deck logic
- No `onSchemeTwistRevealed` / `onMastermindStrikeRevealed` wiring
- No counter incrementing — this packet only reads `G.counters`
- No new fields added to `LegendaryGameState`
- No modification to `buildInitialGameState.ts`
- No persistence or database access
- No server or UI changes
- No modification of WP-009A/009B outputs (`ruleHooks.*`, `ruleRuntime.*`)
- No `boardgame.io` import in endgame files
- No `throw` in `evaluateEndgame`
- No `.reduce()` or nested ternaries
- No `Math.random()`
- No speculative helpers, convenience abstractions, or "while I'm here" improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/endgame/endgame.types.ts              — new
    packages/game-engine/src/endgame/endgame.evaluate.ts            — new
    packages/game-engine/src/endgame/endgame.evaluate.test.ts       — new
    packages/game-engine/src/game.ts                                 — modified
    packages/game-engine/src/types.ts                                — modified
    packages/game-engine/src/index.ts                                — modified

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/rules/ruleHooks.types.ts               — WP-009A contract
    packages/game-engine/src/rules/ruleHooks.validate.ts            — WP-009A contract
    packages/game-engine/src/rules/ruleHooks.registry.ts            — WP-009A contract
    packages/game-engine/src/rules/ruleRuntime.execute.ts           — WP-009B
    packages/game-engine/src/rules/ruleRuntime.effects.ts           — WP-009B
    packages/game-engine/src/rules/ruleRuntime.impl.ts              — WP-009B
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
    packages/game-engine/src/setup/buildInitialGameState.ts         — WP-005B/009B

These are dependencies, not execution targets.

---

## Runtime Wiring Allowance

This WP does **not** add new fields to `LegendaryGameState`. It reads the
existing `G.counters` field (established in WP-009B). Therefore, no runtime
wiring allowance is needed.

No modifications to `buildInitialGameState.ts` or existing structural tests
are expected or permitted.

If an unexpected structural assertion failure is encountered during execution,
**STOP** and report rather than applying 01.5 edits.

---

## Locked Values (Do Not Re-Derive)

### ENDGAME_CONDITIONS (canonical counter key strings)

```ts
const ENDGAME_CONDITIONS = {
  ESCAPED_VILLAINS:    'escapedVillains',
  SCHEME_LOSS:         'schemeLoss',
  MASTERMIND_DEFEATED: 'mastermindDefeated',
} as const;
```

### ESCAPE_LIMIT

```ts
const ESCAPE_LIMIT: number = 8;
```

### EndgameOutcome (exact union values)

```ts
type EndgameOutcome = 'heroes-win' | 'scheme-wins';
```

### EndgameResult (exact interface shape)

```ts
interface EndgameResult {
  outcome: EndgameOutcome;
  reason: string;
}
```

### Evaluation order (exact — tests assert this priority)

1. `(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0) >= ESCAPE_LIMIT`
   -> `{ outcome: 'scheme-wins', reason: 'Too many villains escaped.' }`
2. `(G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0) >= 1`
   -> `{ outcome: 'scheme-wins', reason: 'The scheme has been completed.' }`
3. `(G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] ?? 0) >= 1`
   -> `{ outcome: 'heroes-win', reason: 'The mastermind has been defeated.' }`
4. Otherwise -> `null` (game continues)

### endIf wiring (exact expression)

```ts
endIf: ({ G }) => evaluateEndgame(G) ?? undefined
```

### Required // why: comments

- `endgame.types.ts` — `ESCAPE_LIMIT`: 8 is the standard Legendary escape
  limit for MVP; becomes part of `MatchSetupConfig` in a later packet when
  scheme-specific limits are implemented
- `endgame.evaluate.ts` — evaluation order: loss conditions checked before
  victory so a simultaneous trigger resolves as a loss — matches Legendary
  rulebook precedence
- `game.ts` — `endIf`: pure delegation — all endgame state is read from
  `G.counters` which the rule pipeline maintains via `applyRuleEffects`
- `endgame.evaluate.test.ts` — priority test: prevents regression on the
  loss-before-victory evaluation order decision

---

## Pre-Flight Risk Resolutions (Locked for Execution)

These decisions were made during pre-flight and must not be revisited.

### Risk 1: Test construction of minimal G objects

`evaluateEndgame` only reads `G.counters`. Tests must cast minimal
`{ counters: { ... } } as LegendaryGameState` objects rather than building
full state via `buildInitialGameState`. This avoids test fragility and
unnecessary coupling. Tests do NOT need `makeMockCtx` — `evaluateEndgame`
is a pure function with no `ctx` parameter.

### Risk 2: `endIf` return type compatibility

boardgame.io expects truthy (game over) or falsy (continue).
`evaluateEndgame` returns `EndgameResult | null`. Use
`evaluateEndgame(G) ?? undefined` per ARCHITECTURE.md. The `?? undefined`
converts `null` to `undefined` for boardgame.io convention.

### Risk 3: `endIf` placement in `game.ts`

`endIf` is a `play` phase-level property, sibling to `next` and `turn`.
No existing `endIf` in `game.ts` — clean insertion. Import
`evaluateEndgame` from `./endgame/endgame.evaluate.js`.

### Risk 4: No `endgame/` directory exists

Create `packages/game-engine/src/endgame/` with the three files specified
in the allowlist. No other files in this directory.

---

## Test Expectations (Locked)

### Evaluate tests — `src/endgame/endgame.evaluate.test.ts` (6 tests)

1. Returns `null` when all endgame counters are absent or `0`
2. Returns `{ outcome: 'scheme-wins' }` when
   `escapedVillains >= ESCAPE_LIMIT`
3. Returns `{ outcome: 'scheme-wins' }` when `schemeLoss >= 1`
4. Returns `{ outcome: 'heroes-win' }` when `mastermindDefeated >= 1`
5. Loss takes priority when both `schemeLoss: 1` and `mastermindDefeated: 1`
   are set — result must be `'scheme-wins'`
6. `JSON.stringify(evaluateEndgame(G))` succeeds for all return values

**Prior test baseline:** 108 tests pass — all must continue to pass. No
existing tests are expected to need value-only updates (no new G fields,
no structural changes).

**Test boundaries:** no `boardgame.io` imports in test file; no `makeMockCtx`
(pure function — no ctx needed); `node:test` + `node:assert` only; `.test.ts`
extension; tests construct minimal `G` objects with only `counters` populated.

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-010`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `evaluateEndgame` is pure — no side effects, no I/O, no `throw`, no mutation
- `endIf` delegates entirely to `evaluateEndgame` — no inline `counters[` logic
- All counter reads use `ENDGAME_CONDITIONS` constants — never string literals
- Loss conditions evaluated before victory — locked order, never swap
- No boolean fields in `G` — numeric counters only (`>= 1` is truthy)
- Control flow uses `if/else if/else` — no nested ternaries
- No `boardgame.io` import in any endgame file
- No new fields added to `LegendaryGameState`
- No modification to `buildInitialGameState.ts`
- `G` must remain JSON-serializable after all mutations
- ESM only, `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension
- Tests use `node:test` and `node:assert` only — no `boardgame.io/testing`
- WP-009A/009B files must not be modified

---

## EC-Mode Execution Rules

- All code changes must map to **EC-010**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-010 execution:

- All EC-010 checklist items must pass
- All tests must pass (108 existing + 6 new endgame tests)
- `EndgameOutcome` is exactly `'heroes-win' | 'scheme-wins'`
- `ENDGAME_CONDITIONS` exports 3 keys with exact string values
- `ESCAPE_LIMIT` is `8` with `// why:` comment
- `evaluateEndgame(G)` returns correct results for all 3 conditions + null
- Loss takes priority when both loss and victory conditions are met
- No `throw` in `endgame.evaluate.ts`
- No inline `counters[` logic in `endIf` in `game.ts`
- No function properties in `endgame.types.ts`
- `endIf` uses `evaluateEndgame(G) ?? undefined`
- No `boardgame.io` imports in endgame files
- No new fields in `LegendaryGameState`
- `buildInitialGameState.ts` untouched
- WP-009A/009B files untouched
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after endgame wiring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm evaluateEndgame does not throw
grep "throw " packages/game-engine/src/endgame/endgame.evaluate.ts
# Expected: no output

# Step 4 — confirm no inline counter logic in endIf
grep "counters\[" packages/game-engine/src/game.ts
# Expected: no output (counters accessed only inside endgame.evaluate.ts)

# Step 5 — confirm no function properties in types file
grep "=>" packages/game-engine/src/endgame/endgame.types.ts
# Expected: no output

# Step 6 — confirm no require() in any generated file
grep -r "require(" packages/game-engine/src/endgame/
# Expected: no output

# Step 7 — confirm no boardgame.io imports in endgame files
grep -r "boardgame.io" packages/game-engine/src/endgame/ | grep -v "// " | grep -v "* "
# Expected: no output (only JSDoc comments may mention it)

# Step 8 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in allowlist

# Step 9 — confirm buildInitialGameState.ts was not modified
git diff --name-only packages/game-engine/src/setup/buildInitialGameState.ts
# Expected: no output

# Step 10 — confirm WP-009B files were not modified
git diff --name-only packages/game-engine/src/rules/
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — a match can now conclusively end; what the three
    MVP conditions are and how to trigger them in a test scenario
  - `docs/ai/DECISIONS.md` — at minimum: the loss-before-victory evaluation
    order; why boolean events use numeric counters (`>= 1`) rather than
    separate boolean fields in `G`; why `ESCAPE_LIMIT` is a hardcoded constant
    for MVP rather than part of `MatchSetupConfig`
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-010 complete with date
- Commit using EC-mode hygiene rules (`EC-010:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-010:

**DO NOT IMPLEMENT IT.**
