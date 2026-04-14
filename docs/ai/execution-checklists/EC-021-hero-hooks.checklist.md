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

- **HeroAbilityTiming closed union:**
  ```ts
  type HeroAbilityTiming =
    | 'onPlay'
    | 'onFight'
    | 'onRecruit'
    | 'onKO'
    | 'onReveal'
  ```

- `HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[]` — canonical array, drift-detection required

- **HeroAbilityHook shape:**
  ```ts
  interface HeroAbilityHook {
    cardId: CardExtId
    timing: HeroAbilityTiming
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
- `HeroAbilityTiming` is a closed union — same drift-detection pattern as `HeroKeyword`
- No `.reduce()` in hook construction — use `for...of`
- No `boardgame.io` import in hero ability files
- **Timing derivation:** if ability markup explicitly encodes timing, use it; otherwise **always assign `'onPlay'`**. Do not infer timing from natural-language phrasing.
- **No NL magnitude extraction:** do not extract numeric magnitude from English text (e.g., "Draw two cards" does NOT produce `magnitude: 2`). Only structured markup with explicit values may populate `magnitude`.
- **Registry field constraint:** `buildHeroAbilityHooks` may only rely on `cardId`/`key`, `abilities: string[]`, and deck membership. Richer registry data must be ignored.
- **Keywords vs effects:** `keywords` are labels only. They do not imply that a matching `HeroEffectDescriptor` must exist. A hook may have keywords but no effects, or vice versa.
- **Parsing order:** `[hc:X]` -> `[keyword:X]` -> `[icon:X]` -> normalize -> assign timing. No step may depend on results of a later step.
- **Output determinism:** identical registry + matchConfig inputs produce byte-identical JSON output order

---

## Required `// why:` Comments

- `HeroAbilityHook.cardId`: must be a hero card `CardExtId`
- Timing fields: declarative only — no execution semantics attached
- Timing derivation: defaults to `'onPlay'` — no NL inference
- Effects: descriptors, not functions
- Hooks: immutable after setup
- `HERO_KEYWORDS`: semantic labels only; adding requires DECISIONS.md entry
- `HERO_ABILITY_TIMINGS`: same closed-union pattern as keywords
- `buildHeroAbilityHooks`: setup-time-only pattern
- Drift-detection tests: prevent union/array divergence (keywords AND timings)

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
- `HERO_ABILITY_TIMINGS` array/union mismatch -> drift-detection test missing or wrong
- Function stored in `G.heroAbilityHooks` -> serialization will fail
- Timing inferred from English text ("fight" -> `'onFight'`) -> violates timing derivation rule
- Magnitude extracted from English text ("Draw two" -> `magnitude: 2`) -> violates NL constraint
- Non-deterministic output order -> replay/snapshot divergence
- Keywords assumed to imply matching effects -> coupling violation

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No hero abilities execute effects — packet remains inert
- [ ] No `boardgame.io` import in hero ability files
- [ ] `docs/ai/STATUS.md` updated (hero ability hooks exist as data-only contracts)
- [ ] `docs/ai/DECISIONS.md` updated (hooks data-only; keyword union closed; timing union closed; timing defaults to `'onPlay'`; execution deferred to WP-022+). No speculative language ("enables", "supports", "allows") in entries.
- [ ] `docs/ai/ARCHITECTURE.md` updated (add `G.heroAbilityHooks` to Field Classification Reference)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-021 checked off with date
