# Work Packet Invocation — WP-009A (Scheme & Mastermind Rule Hooks Contracts)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-009A`
**Work Packet Title:** Scheme & Mastermind Rule Hooks (Contracts)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-009A** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-009A defines *the data contracts for scheme and mastermind rule hooks* —
not *the execution layer that runs them*. All trigger names, payload shapes,
effect variants, hook definitions, and validators are locked here. The
`ImplementationMap` and `executeRuleHooks`/`applyRuleEffects` functions belong
to WP-009B and are strictly out of scope.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section: The Rule Execution Pipeline
   - Section: Zone & Pile Structure (CardExtId convention)
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - Rule Execution Pipeline section
   - G serialization invariants
   - Pure helper rules (no boardgame.io imports in `src/rules/`)

4. `.claude/rules/code-style.md`
   - `// why:` comment requirements (Rule 6)
   - No `.reduce()` (Rule 8)
   - No abbreviations (Rule 4)
   - Full-sentence error messages (Rule 11)
   - ESM only (Rule 13)
   - Field names match data contract (Rule 14)

5. `docs/ai/execution-checklists/EC-009A-rule-hooks-contracts.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-009A-scheme-mastermind-rule-hooks-contracts.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveError` and
   `MoveResult` types; import `MoveError` for validator return types; do NOT modify
8. `packages/game-engine/src/state/zones.types.ts` — `CardExtId` type; import
   for trigger payload card references; do NOT modify
9. `packages/game-engine/src/types.ts` — will be modified (re-export rule hook contracts)
10. `packages/game-engine/src/index.ts` — will be modified (export new public API)
11. `docs/ai/REFERENCE/00.2-data-requirements.md` section 2.1 — card type taxonomy
    confirming `scheme-twist` and `mastermind-strike` slug strings (hyphens, not underscores)
12. `docs/ai/REFERENCE/00.2-data-requirements.md` section 8.2 — runtime state
    boundaries: G must be JSON-serializable; all hook data must be plain objects
13. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-008B complete (2026-04-10) — core moves implemented, `zoneOps.ts` established
- `MoveError` and `MoveResult` exported from `coreMoves.types.ts` (WP-008A)
- `CardExtId` exported from `zones.types.ts` (WP-006A)
- `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 89/89 passing, 0 failing

### Risks Identified and Mitigations

1. **`src/rules/` directory does not exist** — Must be created. Straightforward;
   no risk.

2. **Import path for `MoveError` from `src/rules/`** — Use relative path
   `../moves/coreMoves.types.js`. Same pattern as existing cross-directory
   imports in the codebase.

3. **`RULE_EFFECT_TYPES` typed as `readonly string[]`** — The WP specifies
   `readonly string[]` for the array type. The drift test validates that the
   values match the `RuleEffect` tagged union. Follow WP exactly.

4. **`createHookRegistry` throwing on invalid hooks** — WP explicitly states
   this is registry construction, not a move, so throwing is appropriate.
   Validators return `MoveResult`; the registry factory throws.

5. **No boardgame.io imports in `src/rules/`** — All three new source files
   are pure contracts/helpers. They must NOT import `boardgame.io`. The EC
   explicitly checks this.

---

## Critical Context (Post-WP-008B Reality)

- WP-008B is complete. The following are present in `@legendary-arena/game-engine`:
  - `MoveError { code: string; message: string; path: string }` — from `coreMoves.types.ts`
  - `MoveResult = { ok: true } | { ok: false; errors: MoveError[] }` — from `coreMoves.types.ts`
  - `CardExtId = string` (named type alias) — from `zones.types.ts`
  - `TurnStage = 'start' | 'main' | 'cleanup'` — from `turnPhases.types.ts`
  - `zoneOps.ts`, `coreMoves.impl.ts`, `coreMoves.gating.ts`, `coreMoves.validate.ts` — all functional
  - 89 tests passing across the game-engine package
- No `src/rules/` directory exists yet — this packet creates it
- `RuleTriggerName`, `RuleEffect`, `HookDefinition` do not exist yet — this
  packet defines them as canonical contracts
- `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES` do not exist yet — this packet
  defines them with drift-detection tests

---

## Scope Contract (Read Carefully)

### WP-009A DOES:

- Create `src/rules/ruleHooks.types.ts` — `RuleTriggerName`, `RULE_TRIGGER_NAMES`,
  5 payload interfaces, `TriggerPayloadMap`, `RuleEffect` tagged union,
  `RULE_EFFECT_TYPES`, `HookDefinition`, `HookRegistry`
- Create `src/rules/ruleHooks.validate.ts` — three validators:
  `validateTriggerPayload`, `validateRuleEffect`, `validateHookDefinition`
  (all return `MoveResult`, never throw)
- Create `src/rules/ruleHooks.registry.ts` — `createHookRegistry` (validates
  then stores; throws on invalid with full-sentence error), `getHooksForTrigger`
  (returns hooks sorted by priority asc, then id lexically)
- Create `src/rules/ruleHooks.contracts.test.ts` — 10 tests including 2
  drift-detection tests
- Modify `src/types.ts` — re-export `RuleTriggerName`, `RuleEffect`,
  `HookDefinition`, `HookRegistry`
- Modify `src/index.ts` — export all new public types and functions
- Add required `// why:` comments on data-only effect design, deterministic
  sort ordering, and drift-detection tests

### WP-009A DOES NOT:

- No rule implementations — `HookDefinition` is data-only; no handler functions
- No effect executor — `executeRuleHooks`, `applyRuleEffects`, `ImplementationMap`
  are WP-009B
- No new move behaviors or move implementations
- No city, HQ, or villain deck logic
- No new error types — `MoveError` from WP-008A is reused exclusively
- No persistence or PostgreSQL access
- No UI or server changes
- No database or network access
- No modification of WP-008A/B contract files
- No modification of WP-006A/B or WP-007A/B files
- No `boardgame.io` imports in any file under `src/rules/`
- No `Math.random()` or `.reduce()` in rule/zone operations
- No `require()` — ESM only
- No handler functions, closures, or class instances in `HookDefinition`
- No speculative helpers, convenience abstractions, or "while I'm here" improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/rules/ruleHooks.types.ts          — new
    packages/game-engine/src/rules/ruleHooks.validate.ts       — new
    packages/game-engine/src/rules/ruleHooks.registry.ts       — new
    packages/game-engine/src/rules/ruleHooks.contracts.test.ts — new
    packages/game-engine/src/types.ts                           — modified
    packages/game-engine/src/index.ts                           — modified

Any modification outside this list must satisfy the Runtime Wiring Allowance
below, or it is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/moves/coreMoves.types.ts          — WP-008A contract
    packages/game-engine/src/moves/coreMoves.gating.ts         — WP-008A contract
    packages/game-engine/src/moves/coreMoves.validate.ts       — WP-008A contract
    packages/game-engine/src/moves/coreMoves.impl.ts           — WP-008B
    packages/game-engine/src/moves/coreMoves.contracts.test.ts — WP-008A tests
    packages/game-engine/src/moves/coreMoves.integration.test.ts — WP-008B tests
    packages/game-engine/src/moves/zoneOps.ts                  — WP-008B
    packages/game-engine/src/turn/turnPhases.types.ts          — WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts          — WP-007A contract
    packages/game-engine/src/turn/turnPhases.validate.ts       — WP-007A contract
    packages/game-engine/src/turn/turnLoop.ts                  — WP-007B
    packages/game-engine/src/test/mockCtx.ts                   — shared test helper
    packages/game-engine/src/state/zones.types.ts              — WP-006A contract
    packages/game-engine/src/state/zones.validate.ts           — WP-006A contract
    packages/game-engine/src/setup/playerInit.ts               — WP-006B
    packages/game-engine/src/setup/pilesInit.ts                — WP-006B
    packages/game-engine/src/game.ts                           — WP-007B (no changes needed)

These are dependencies, not execution targets.

---

## Runtime Wiring Allowance

This WP adds re-exports to `src/types.ts` and new exports to `src/index.ts`.
Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, if adding these
re-exports causes existing structural test assertions to fail (e.g.,
export-count checks), those assertions may be updated to reflect the new
count. No other changes are permitted under this allowance.

Any file modified under this clause must be documented in the execution summary.

---

## Locked Values (Do Not Re-Derive)

### MoveError shape (reused from WP-008A — do not redefine)

`{ code: string; message: string; path: string }`

### RuleTriggerName values (exactly 5, in this order)

`'onTurnStart'` | `'onTurnEnd'` | `'onCardRevealed'` |
`'onSchemeTwistRevealed'` | `'onMastermindStrikeRevealed'`

### RULE_TRIGGER_NAMES array

`readonly RuleTriggerName[]` containing all 5 trigger names in the order above.

### Trigger Payload shapes

- `OnTurnStartPayload { currentPlayerId: string }`
- `OnTurnEndPayload { currentPlayerId: string }`
- `OnCardRevealedPayload { cardId: CardExtId; cardTypeSlug: string }`
- `OnSchemeTwistRevealedPayload { cardId: CardExtId }`
- `OnMastermindStrikeRevealedPayload { cardId: CardExtId }`

`cardId` fields use `CardExtId` (imported from `state/zones.types.ts`) — not
plain `string`.

### RuleEffect tagged union (exactly 4 variants)

- `{ type: 'queueMessage'; message: string }`
- `{ type: 'modifyCounter'; counter: string; delta: number }`
- `{ type: 'drawCards'; playerId: string; count: number }`
- `{ type: 'discardHand'; playerId: string }`

### RULE_EFFECT_TYPES array

`readonly string[]` containing all 4 type strings:
`['queueMessage', 'modifyCounter', 'drawCards', 'discardHand']`

### HookDefinition fields (exactly 5 — no handler functions)

- `id: string` — stable unique identifier
- `kind: 'scheme' | 'mastermind'`
- `sourceId: string` — `ext_id` of the scheme or mastermind from setup
- `triggers: RuleTriggerName[]`
- `priority: number` — lower fires first; ties broken by `id` lexically

### HookRegistry type

`HookDefinition[]`

### getHooksForTrigger sort order

Priority ascending, then `id` lexically for ties. Deterministic ordering
required for replay.

### Required // why: comments

- `ruleHooks.types.ts`: data-only effect design — effects describe what should
  happen; the executor in WP-009B applies them deterministically; this separates
  rule declaration from execution and keeps `HookDefinition` JSON-serializable
- `ruleHooks.registry.ts`: deterministic sort ordering — priority-then-id
  ensures identical effect sequences given the same hooks, required for replay
- Drift test (triggers): failure means a trigger name was added to the
  `RuleTriggerName` union but not the canonical array, or vice versa
- Drift test (effects): failure means an effect type was added to the
  `RuleEffect` tagged union but not the canonical array, or vice versa

---

## Test Expectations (Locked)

10 new tests in `packages/game-engine/src/rules/ruleHooks.contracts.test.ts`:

1. Drift: `RULE_TRIGGER_NAMES` contains exactly the 5 locked trigger names
   (with `// why:` comment)
2. Drift: `RULE_EFFECT_TYPES` contains exactly the 4 locked effect types
   (with `// why:` comment)
3. Valid trigger payload passes `validateTriggerPayload`
4. Missing required field fails `validateTriggerPayload` returning `{ ok: false }`
5. Valid effect passes `validateRuleEffect`
6. Unknown `type` field fails `validateRuleEffect` returning `{ ok: false }`
7. Valid `HookDefinition` passes `validateHookDefinition`
8. Missing `priority` field fails `validateHookDefinition` returning `{ ok: false }`
9. All trigger payload instances pass `JSON.stringify` without throwing
10. All effect variants pass `JSON.stringify` without throwing

**Prior test baseline:** 89 tests pass — all must continue to pass.
**Test boundaries:** no `boardgame.io` imports in test files; no modifications
to `makeMockCtx`; `node:test` + `node:assert` only; `.test.ts` extension.

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-009A`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- `CardExtId` imported from `../state/zones.types.js` for payload card references
- `MoveError` imported from `../moves/coreMoves.types.js` for validator errors
- No new error types defined in this packet
- `HookDefinition` must be JSON-serializable — no functions, Maps, Sets, classes
- All three validators return `{ ok: true } | { ok: false; errors: MoveError[] }`
- No validator contains a `throw` statement
- `createHookRegistry` may throw (registry construction, not a move)
- `MoveError.message` must be a full sentence (code-style Rule 11)
- No `.reduce()` in validation, gating, or registry logic
- No `boardgame.io` import in any file under `src/rules/`
- ESM only, `node:` prefix on all Node built-in imports
- Test file uses `.test.ts` extension
- Test uses `node:test` and `node:assert` only — no `boardgame.io/testing`
- Slugs use hyphens not underscores (`scheme-twist`, `mastermind-strike`)
- `G` must remain JSON-serializable — all new types must satisfy this

---

## EC-Mode Execution Rules

- All code changes must map to **EC-009A**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-009A execution:

- All EC-009A checklist items must pass
- All tests must pass (89 existing + 10 new = 99 minimum)
- No forbidden files modified
- `RuleTriggerName` union has exactly 5 values matching locked list
- `RULE_TRIGGER_NAMES` array has all 5 with drift-detection test
- `RuleEffect` tagged union has exactly 4 variants matching locked list
- `RULE_EFFECT_TYPES` array has all 4 with drift-detection test
- `HookDefinition` has exactly 5 fields, no functions
- All payload and effect instances pass `JSON.stringify`
- Three validators exported, none containing `throw`
- `getHooksForTrigger` sorts by priority asc, then id lexically
- `MoveError` reused — no new error type defined
- No `boardgame.io` import in any `src/rules/` file
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after new types are added
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests including new contract tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no function expressions in type definitions
grep "=>" packages/game-engine/src/rules/ruleHooks.types.ts
# Expected: no output (no arrow functions in type file)

# Step 4 — confirm validators do not throw
grep "throw " packages/game-engine/src/rules/ruleHooks.validate.ts
# Expected: no output

# Step 5 — confirm no boardgame.io import in any rules file
grep -r "boardgame.io" packages/game-engine/src/rules/
# Expected: no output

# Step 6 — confirm no require() in any generated file
grep -r "require(" packages/game-engine/src/rules/
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files under packages/game-engine/src/rules/ plus
#           src/types.ts and src/index.ts

# Step 8 — confirm test file has no boardgame.io import
grep "boardgame.io" packages/game-engine/src/rules/ruleHooks.contracts.test.ts
# Expected: no output

# Step 9 — confirm CardExtId is used in payload types (not plain string)
grep "CardExtId" packages/game-engine/src/rules/ruleHooks.types.ts
# Expected: at least one match

# Step 10 — confirm MoveError imported from coreMoves.types (not redefined)
grep "import.*MoveError" packages/game-engine/src/rules/ruleHooks.validate.ts
# Expected: import from '../moves/coreMoves.types.js'
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — what rule hook contracts are now exported
  - `docs/ai/DECISIONS.md` — at minimum: why `HookDefinition` is data-only
    with no handler functions; why effects are a tagged data union rather than
    callback functions; the priority-then-id ordering decision for deterministic
    hook execution
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-009A complete with date
- Document any files modified under the Runtime Wiring Allowance
- Commit using EC-mode hygiene rules (`EC-009A:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-009A:

**DO NOT IMPLEMENT IT.**
