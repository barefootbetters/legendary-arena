# EC-021 — Hero Card Text & Keywords Hooks Only (Execution Checklist)

**Source:** docs/ai/work-packets/WP-021-hero-card-text-keywords-hooks-only.md
**Layer:** Game Engine / Rules (Hero Abilities — Contracts Only)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-021.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-021.

---

## Before Starting

- [ ] WP-020 complete: `G.cardStats`, `TurnEconomy`, `CardStatEntry` exist
- [ ] `ruleHooks.types.ts` exports `RuleTriggerName`, `HookDefinition` (WP-009A)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-021.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **HeroAbilityHook shape:**
  ```ts
  interface HeroAbilityHook {
    cardId: CardExtId
    timing: 'onPlay' | 'onFight' | 'onRecruit' | 'onKO' | 'onReveal'
    keywords: HeroKeyword[]
    conditions?: HeroCondition[]
    effects?: HeroEffectDescriptor[]
  }
  ```

- **HeroKeyword closed union:**
  ```ts
  type HeroKeyword =
    | 'draw'
    | 'attack'
    | 'recruit'
    | 'ko'
    | 'rescue'
    | 'wound'
    | 'reveal'
    | 'conditional'
  ```

- `HERO_KEYWORDS: readonly HeroKeyword[]` — canonical array, drift-detection required
- `HeroCondition`: `{ type: string; value: string }` (MVP: type label only)
- `HeroEffectDescriptor`: `{ type: HeroKeyword; magnitude?: number }`
- `G.heroAbilityHooks: HeroAbilityHook[]` — built at setup, immutable during gameplay

---

## Guardrails

- `HeroAbilityHook` is **data-only** — no functions, no closures, fully JSON-serializable
- This packet is **inert by design** — no hero ability executes effects
- `G.heroAbilityHooks` is immutable during gameplay — moves must never modify it
- No registry import in move or type files — registry data provided at setup only
- `HeroKeyword` is a closed union — adding a keyword requires DECISIONS.md entry + both type and array update
- No `.reduce()` in hook construction — use `for...of`
- No `boardgame.io` import in hero ability files

---

## Required `// why:` Comments

- `HeroAbilityHook.cardId`: must be a hero card `CardExtId`
- Timing fields: declarative only — no execution semantics attached
- Effects: descriptors, not functions
- Hooks: immutable after setup
- `HERO_KEYWORDS`: semantic labels only; adding requires DECISIONS.md entry
- `buildHeroAbilityHooks`: setup-time-only pattern
- Drift-detection test: prevents union/array divergence

---

## Files to Produce

- `packages/game-engine/src/rules/heroAbility.types.ts` — **new** — HeroAbilityHook, HeroCondition, HeroEffectDescriptor
- `packages/game-engine/src/rules/heroKeywords.ts` — **new** — HeroKeyword union, HERO_KEYWORDS canonical array
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **new** — buildHeroAbilityHooks
- `packages/game-engine/src/types.ts` — **modified** — adds heroAbilityHooks to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports types and setup
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **new** — tests

---

## Common Failure Smells (Optional)

- Hero hook produces gameplay effects -> packet is no longer inert
- Registry import in type or move file -> layer boundary violation
- `HERO_KEYWORDS` array/union mismatch -> drift-detection test missing or wrong
- Function stored in `G.heroAbilityHooks` -> serialization will fail

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No hero abilities execute effects — packet remains inert
- [ ] No `boardgame.io` import in hero ability files
- [ ] `docs/ai/STATUS.md` updated (hero ability hooks exist as data-only contracts)
- [ ] `docs/ai/DECISIONS.md` updated (hooks data-only; keyword union closed; execution deferred to WP-022+)
- [ ] `docs/ai/ARCHITECTURE.md` updated (add `G.heroAbilityHooks` to Field Classification Reference)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-021 checked off with date
