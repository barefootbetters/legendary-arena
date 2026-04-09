# EC-022 — Execute Hero Keywords Minimal MVP (Execution Checklist)

**Source:** docs/ai/work-packets/WP-022-execute-hero-keywords-minimal-mvp.md
**Layer:** Game Engine / Rules Execution (Hero Abilities)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-022.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-022.

---

## Before Starting

- [ ] WP-021 complete: `HeroAbilityHook`, `HeroKeyword`, `G.heroAbilityHooks` exist
- [ ] `economy.logic.ts` exports `addResources` (WP-018)
- [ ] `ko.logic.ts` exports `koCard` (WP-017)
- [ ] `coreMoves.impl.ts` contains `drawCards` logic (WP-008B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-022.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **Executed keywords (MVP):**

  | Keyword | Effect | Helper |
  |---|---|---|
  | `draw` | Draw N cards | `drawCards` logic |
  | `gainAttack` | Add N to `turnEconomy.attack` | `addResources` |
  | `gainRecruit` | Add N to `turnEconomy.recruit` | `addResources` |
  | `koCard` | KO the played card | `koCard` helper |

- **Skipped keywords (deferred):**
  `rescue`, `wound`, `reveal`, `conditional` — safely ignored in MVP

- `HeroEffectResult`: `{ executed: boolean; keyword: string; message: string }` — not stored in G
- Execution order: hooks fire in registration order (same as `G.heroAbilityHooks`)
- Effects execute immediately after hero card is played, before fight/recruit actions

---

## Guardrails

- Only **unconditional** effects execute — effects with conditions safely skipped
- Unsupported keywords safely ignored — no mutation, no error
- Execution uses **existing helpers only** — no ad-hoc state writes
- `koCard` MVP targets the played card itself (no player choice)
- WP-021 contract files (`heroAbility.types.ts`, `heroKeywords.ts`) must NOT be modified
- No `.reduce()` in effect execution — use `for...of`
- No `boardgame.io` import in hero execution files
- No registry import — hooks already resolved in `G.heroAbilityHooks`

---

## Required `// why:` Comments

- Which 4 keywords are executed and why others are skipped
- `koCard` targets the played card — MVP simplification, no player choice
- Execution timing: effects fire immediately after play
- Conditional skip: WP-022 skips all conditional effects; WP-023 evaluates them

---

## Files to Produce

- `packages/game-engine/src/hero/heroEffects.types.ts` — **new** — HeroEffectResult internal type
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **new** — executeHeroEffects
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — playCard calls executeHeroEffects
- `packages/game-engine/src/types.ts` — **modified** — re-export if needed
- `packages/game-engine/src/index.ts` — **modified** — export executeHeroEffects
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **new** — execution tests

---

## Common Failure Smells (Optional)

- Conditional effects execute -> WP-022 should skip all conditional effects
- WP-021 contract files show up in `git diff` -> contract violation
- Effects fire during fight instead of on play -> timing is wrong
- Ad-hoc G mutation instead of using helpers -> bypasses existing logic

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] WP-021 contracts not modified (confirmed with `git diff --name-only`)
- [ ] No conditional logic executed
- [ ] `docs/ai/STATUS.md` updated (hero abilities execute for 4 keywords)
- [ ] `docs/ai/DECISIONS.md` updated (why only 4 keywords; koCard targets played card; hero effect vs WP-018 economy)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-022 checked off with date
