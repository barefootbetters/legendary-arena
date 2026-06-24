# EC-315 — Empowered Oracle: Free-Choice + Binary-Choose-One (Execution Checklist)

**Source:** docs/ai/work-packets/WP-283-empowered-oracle-choice-forms.md
**Layer:** Game Engine

## Before Starting

- [ ] WP-282 ✅ on `main` (baseline `70c8ce34`)
- [ ] D-24044 (empowered core) + D-24047 (conditional-prefix) are `Active` in `DECISIONS.md`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — **1555 pass / 0 fail**
- [ ] Read `packages/game-engine/src/rules/effectPrimitive.types.ts` in full (closed-union
  baseline)
- [ ] Read `packages/game-engine/src/setup/heroAbility.setup.ts` in full (empowered
  dispatch chain)
- [ ] Read `packages/game-engine/src/hero/effectPrimitive.interpret.ts` in full
  (value-expression dispatch)

## Locked Values (do not re-derive)

- New `ValueExpressionType` string literal: **`'max-class-count-in-zone'`**
- `VALUE_EXPRESSION_TYPES` drift array grows from **2 → 3** entries
- Free-choice composition shape: `{ type: 'gain-resource', resource: 'attack', amount: { type: 'max-class-count-in-zone', classes: 'all', zone: 'hq' } }`
- Choose-one composition shape: `{ type: 'gain-resource', resource: 'attack', amount: { type: 'max-class-count-in-zone', classes: ['strength', 'covert'], zone: 'hq' } }` (classes list extracted from card text)
- `amulet-of-avalon` triggering ability: `"You get [keyword:Empowered] by the color of your choice."`
- `fight-or-flight` triggering ability: `"Choose one: You get [keyword:Empowered] by [hc:strength], or you get [keyword:Empowered] by [hc:covert]."`
- Baseline engine test count: **1555** (target post-WP: ≥ **1563**)
- `DECISIONS.md` D-entries reserved: **D-24063** (oracle decision) + **D-24064** (`max-class-count-in-zone` type)

## Guardrails

1. **D-24030 closed-union:** All four surfaces updated in the same commit — `ValueExpressionType` union, `VALUE_EXPRESSION_TYPES` array, `MaxClassCountInZoneExpression` interface, evaluator dispatch. Any missing = FAIL.
2. **Existing dispatch unchanged:** `tryResolveEmpoweredCore` and `tryResolveEmpoweredConditionalPrefix` behavior is byte-identical before and after. New paths are ADDITIVE fallbacks only.
3. **Choose-one pre-pass, not per-token:** `tryResolveEmpoweredChooseOneLine` runs BEFORE the `KEYWORD_PATTERN` loop. A boolean flag `processedAsChooseOne` suppresses individual `[keyword:Empowered]` handling when the pre-pass already resolved the line.
4. **Free-choice guard:** `tryResolveEmpoweredFreeChoice` returns `undefined` when `EMPOWERED_PARAM_TAIL_PATTERN` matches the text after the marker. Core path's domain; never double-resolve.
5. **Oracle-max returns 0 on empty HQ:** No `NaN`, no `undefined`. If no candidate classes are present, the grant is `0`.
6. **No `.reduce()`:** HQ iteration uses `for...of` loops.
7. **`heroKeywords.ts` byte-unchanged.** `game.test.ts` NOT in the allowlist.

## Required `// why:` Comments

- `MaxClassCountInZoneExpression` block in `effectPrimitive.types.ts`: cite **D-24063 + D-24064** — oracle-max strategy; `'all'` for free-choice, `string[]` for enumerate-and-max.
- `VALUE_EXPRESSION_TYPES` drift-array addition: cite **D-24030** — four-surface drift rule.
- `tryResolveEmpoweredChooseOneLine` helper: cite **D-24063** — choose-one resolved as oracle-max of the two enumerated classes; one composition for the whole line.
- `tryResolveEmpoweredFreeChoice` helper: cite **D-24063** — free-choice resolved as oracle-max over all classes in HQ; `classes: 'all'` defers to the evaluator.
- `processedAsChooseOne` flag in `parseAbilityText`: cite **D-24063** — suppresses per-token empowered handling when the whole-line pre-pass already resolved it.
- Evaluator for `max-class-count-in-zone`: cite **D-24063** — implementation of the oracle-max strategy.

## Files to Produce

- `packages/game-engine/src/rules/effectPrimitive.types.ts` — **modified**
- `packages/game-engine/src/rules/heroCompositions.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified**
- `packages/game-engine/src/rules/effectPrimitive.test.ts` — **modified** (drift assertion)
- `packages/game-engine/src/hero/effectPrimitive.interpret.test.ts` — **modified** (new evaluator tests)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** (new parser tests)

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — count ≥ **1563**
- [ ] `amulet-of-avalon` ability line produces `primitiveEffect` with `amount.type === 'max-class-count-in-zone'` and `classes === 'all'` (confirm via test or console)
- [ ] `fight-or-flight` line 1 produces `primitiveEffect` with `amount.type === 'max-class-count-in-zone'` and `classes` contains `['strength', 'covert']`
- [ ] Neither card shows `empowered` in `unresolvedMarkers` for these lines
- [ ] `VALUE_EXPRESSION_TYPES` drift test passes at 3 entries
- [ ] `docs/ai/DECISIONS.md` — D-24063 + D-24064 both `Status: Active`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-283 row checked `[x]` with date
- [ ] User-Visible Surface: `play.legendary-arena.com` in-game — D-24026 live-verify
  after deploy (amulet-of-avalon and fight-or-flight no longer appear in `/debug` hollows)

## Common Failure Smells

- **Double-composition on fight-or-flight:** Two `gain-resource` primitiveEffects on the
  same hook means the choose-one pre-pass ran AND the per-token loop also fired. Check
  that the `processedAsChooseOne` flag is set and checked correctly.
- **Free-choice fires on core-form cards:** `tryResolveEmpoweredFreeChoice` returned
  non-undefined when `EMPOWERED_PARAM_TAIL_PATTERN` matched. Add the early-return guard.
- **Drift test count wrong:** Post-WP-283 `VALUE_EXPRESSION_TYPES` has 3 entries. If
  the test still expects 2, the drift array or the test update was skipped.
- **Classes list is mutable:** The `string[]` passed to `buildEmpoweredChooseOneComposition`
  must be a fresh literal `['strength', 'covert']` per-call, never a shared reference.
