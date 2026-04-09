# EC-024 — Scheme & Mastermind Ability Execution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-024-scheme-mastermind-ability-execution.md
**Layer:** Game Engine / Rules Execution (Non-Hero Abilities)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-024.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-024.

---

## Before Starting

- [ ] WP-023 complete: conditional hero effects work
- [ ] `executeRuleHooks` and `applyRuleEffects` exist (WP-009B)
- [ ] `G.hookRegistry: HookDefinition[]` exists (WP-009B)
- [ ] `ENDGAME_CONDITIONS.SCHEME_LOSS` exists (WP-010)
- [ ] Villain reveal pipeline emits `onSchemeTwistRevealed`, `onMastermindStrikeRevealed` (WP-014)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-024.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `ENDGAME_CONDITIONS` key: `SCHEME_LOSS = 'schemeLoss'`
- **Existing RuleTriggerName values:**
  `'onSchemeTwistRevealed'` | `'onMastermindStrikeRevealed'`
- **Existing RuleEffect types:**
  `'queueMessage'` | `'modifyCounter'` | `'drawCards'` | `'discardHand'`
- **HookDefinition.kind values:**
  `'scheme'` | `'mastermind'`
- Handlers return `RuleEffect[]` — never mutate G directly
- `ImplementationMap` lives in memory — **never stored in G**

---

## Guardrails

- Uses the **same** `executeRuleHooks` -> `applyRuleEffects` pipeline — no new execution engine
- Handler functions live in `ImplementationMap` — never in `G` (not serializable)
- Scheme-loss effects use `ENDGAME_CONDITIONS.SCHEME_LOSS` constant — never `'schemeLoss'` literal
- `applyRuleEffects` handles all effect application — no inline effect logic in handlers
- Unknown effect types push warning to `G.messages` and continue (never throw)
- WP-009A contracts (`ruleHooks.types.ts`) must not be modified (unless new effect type with DECISIONS.md)
- WP-014 reveal pipeline must not be modified

---

## Required `// why:` Comments

- Scheme-loss: mediated through counters, not direct endgame calls
- Mastermind strike: MVP simplified; full text abilities are future scope
- `ImplementationMap`: functions cannot be serialized; rebuilt each match from matchData
- `buildImplementationMap`: maps hook ids to handler functions at setup time

---

## Files to Produce

- `packages/game-engine/src/rules/schemeHandlers.ts` — **new** — schemeTwistHandler
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **new** — mastermindStrikeHandler
- `packages/game-engine/src/setup/buildDefaultHookDefinitions.ts` — **modified** — add scheme/mastermind HookDefinition entries
- `packages/game-engine/src/setup/buildImplementationMap.ts` — **new or modified** — map hook ids to handlers
- `packages/game-engine/src/index.ts` — **modified** — export handlers
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **new** — scheme handler tests
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **new** — mastermind handler tests

---

## Common Failure Smells (Optional)

- Handler mutates G directly -> must return RuleEffect[] instead
- String literal `'schemeLoss'` in handler -> must use ENDGAME_CONDITIONS constant
- ImplementationMap stored in G -> serialization will fail
- New execution pipeline created -> must reuse existing executeRuleHooks

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `ENDGAME_CONDITIONS.SCHEME_LOSS` used, not string literal `'schemeLoss'`
- [ ] `ImplementationMap` not stored in G
- [ ] WP-009A and WP-014 contracts not modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated (scheme twists and mastermind strikes produce gameplay effects)
- [ ] `docs/ai/DECISIONS.md` updated (same pipeline as heroes; MVP twist/strike simplifications; new effect types if any)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-024 checked off with date
