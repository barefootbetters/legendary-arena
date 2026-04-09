# EC-009B — Rule Execution Minimal MVP (Execution Checklist)

**Source:** docs/ai/work-packets/WP-009B-rule-execution-minimal-mvp.md
**Layer:** Game Engine / Rules Runtime

**Execution Authority:**
This EC is the authoritative execution checklist for WP-009B.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-009B.

---

## Before Starting

- [ ] WP-009A complete: `RuleTriggerName`, `RuleEffect`, `HookDefinition`, `HookRegistry` exported
- [ ] `createHookRegistry`, `getHooksForTrigger` exported from `ruleHooks.registry.ts` (WP-009A)
- [ ] `moveAllCards` exported from `zoneOps.ts` (WP-008B)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-009B.
If formatting, spelling, or ordering differs, the implementation is invalid.

- New `LegendaryGameState` fields (exact names, initialized in `Game.setup()`):
  `messages: string[]` (init: `[]`) |
  `counters: Record<string, number>` (init: `{}`) |
  `hookRegistry: HookDefinition[]` (init: from `buildDefaultHookDefinitions`)

- `discardHand` effect zone mapping: `hand -> discard` (uses `moveAllCards`)

- Default implementation messages (integration test asserts exact strings):
  Scheme `onTurnStart`: `'Scheme: turn started.'`
  Mastermind `onTurnEnd`: `'Mastermind: turn ended.'`

---

## Guardrails

- `executeRuleHooks` returns `RuleEffect[]` without modifying `G` — read-only
- `applyRuleEffects` uses `for...of` — never `.reduce()`
- Unknown effect types push warning to `G.messages` — never throw
- `ImplementationMap` handler functions live outside `G` — never assigned to any `G` field
- No `boardgame.io` import in any file under `src/rules/`
- WP-009A files (`ruleHooks.types.ts`, `ruleHooks.validate.ts`, `ruleHooks.registry.ts`) must NOT be modified
- `executeRuleHooks` calls `getHooksForTrigger` — no duplicate sort logic
- Tests use `makeMockCtx` — no `boardgame.io` or `boardgame.io/testing`

---

## Required `// why:` Comments

- `executeRuleHooks`: returning effects without applying lets tests assert and callers inspect
- `applyRuleEffects` unknown-type handler: graceful failure for forward compatibility
- `game.ts` trigger wiring: trigger -> collect effects -> apply effects pipeline
- `ImplementationMap`: why handler functions are separate from `HookDefinition`

---

## Files to Produce

- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — **new** — `ImplementationMap`, `executeRuleHooks`
- `packages/game-engine/src/rules/ruleRuntime.effects.ts` — **new** — `applyRuleEffects`
- `packages/game-engine/src/rules/ruleRuntime.impl.ts` — **new** — default stub implementations
- `packages/game-engine/src/types.ts` — **modified** — add `messages`, `counters`, `hookRegistry`
- `packages/game-engine/src/game.ts` — **modified** — wire triggers and initialize new `G` fields
- `packages/game-engine/src/index.ts` — **modified** — export runtime types and functions
- `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts` — **new** — 3 ordering tests
- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` — **new** — end-to-end tests

---

## Common Failure Smells (Optional)

- `G.messages` empty after trigger fires — `applyRuleEffects` not called after `executeRuleHooks`
- Effects appear in wrong order — `getHooksForTrigger` not used or sort duplicated
- `JSON.stringify(G)` throws — `ImplementationMap` functions stored in `G`
- Unknown effect crashes runtime — `throw` used instead of warning push

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (including WP-009A tests)
- [ ] No `throw` in `ruleRuntime.effects.ts`; no `.reduce()` in it
- [ ] No `.sort(` in `ruleRuntime.execute.ts`
- [ ] WP-009A contract files untouched (`git diff --name-only`)
- [ ] `ImplementationMap` not assigned to any field of `G`
- [ ] `docs/ai/STATUS.md` updated — rules pipeline functional; messages on turn start/end
- [ ] `docs/ai/DECISIONS.md` updated — `ImplementationMap` pattern; two-step execute/apply; graceful unknown effects
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-009B checked off with date
