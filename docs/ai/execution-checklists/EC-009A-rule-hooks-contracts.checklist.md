# EC-009A — Scheme & Mastermind Rule Hooks Contracts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-009A-scheme-mastermind-rule-hooks-contracts.md
**Layer:** Game Engine / Contracts

**Execution Authority:**
This EC is the authoritative execution checklist for WP-009A.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-009A.

---

## Before Starting

- [ ] WP-008B complete: core moves implemented, `zoneOps.ts` established
- [ ] `MoveError` exported from `coreMoves.types.ts` (WP-008A) — reuse, do not redefine
- [ ] `CardExtId` exported from `zones.types.ts` (WP-006A)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-009A.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `RuleTriggerName` — exactly 5 values:
  `'onTurnStart'` | `'onTurnEnd'` | `'onCardRevealed'` |
  `'onSchemeTwistRevealed'` | `'onMastermindStrikeRevealed'`

- `RULE_TRIGGER_NAMES: readonly RuleTriggerName[]` — all 5

- `RuleEffect` tagged union — exactly 4 `type` values:
  `'queueMessage'` | `'modifyCounter'` | `'drawCards'` | `'discardHand'`

- `RULE_EFFECT_TYPES: readonly string[]` — all 4

- `HookDefinition` — exactly 5 fields:
  `id: string` | `kind: 'scheme' | 'mastermind'` | `sourceId: string` |
  `triggers: RuleTriggerName[]` | `priority: number`

- `MoveError` reused from WP-008A: `{ code: string; message: string; path: string }`

---

## Guardrails

- `HookDefinition` is data-only — no handler functions, closures, or class instances
- All types must pass `JSON.stringify` without throwing
- Card references in payloads use `CardExtId` — not plain `string`
- `MoveError` reused for validator errors — no new error type in this packet
- No `boardgame.io` import in any file under `src/rules/`
- Drift-detection tests required for both `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES`
- `getHooksForTrigger` sorts by `priority` ascending, then `id` lexically for ties

---

## Required `// why:` Comments

- `ruleHooks.types.ts`: data-only effect design — separates declaration from execution
- `ruleHooks.registry.ts`: deterministic sort ordering required for replay
- Drift tests: failure means a value added to type but not array, or vice versa

---

## Files to Produce

- `packages/game-engine/src/rules/ruleHooks.types.ts` — **new** — triggers, payloads, effects, `HookDefinition`
- `packages/game-engine/src/rules/ruleHooks.validate.ts` — **new** — 3 validators
- `packages/game-engine/src/rules/ruleHooks.registry.ts` — **new** — `createHookRegistry`, `getHooksForTrigger`
- `packages/game-engine/src/types.ts` — **modified** — re-export rule hook contracts
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/rules/ruleHooks.contracts.test.ts` — **new** — 10 tests including 2 drift-detection

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No function expressions in `ruleHooks.types.ts`; no `throw` in validators
- [ ] No `boardgame.io` import in any file under `src/rules/`
- [ ] `JSON.stringify` succeeds on all payload and effect instances
- [ ] `docs/ai/STATUS.md` updated — what rule hook contracts are exported
- [ ] `docs/ai/DECISIONS.md` updated — data-only `HookDefinition`; tagged union effects; priority-then-id ordering
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-009A checked off with date
