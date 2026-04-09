# EC-025 — Keywords: Patrol, Ambush, Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-025-keywords-patrol-ambush-guard.md
**Layer:** Game Engine / Board Keywords & Constraints

**Execution Authority:**
This EC is the authoritative execution checklist for WP-025.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-025.

---

## Before Starting

- [ ] WP-024 complete: scheme/mastermind abilities execute
- [ ] `city.types.ts` exports `CityZone` (WP-015); `fightVillain` exists (WP-016)
- [ ] `G.villainDeckCardTypes`, `G.cardStats` exist (WP-014, WP-018)
- [ ] `gainWound` exists (WP-017); `applyRuleEffects` exists (WP-009B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-025.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **BoardKeyword closed union:**
  `'patrol'` | `'ambush'` | `'guard'`

- `BOARD_KEYWORDS: readonly BoardKeyword[]` — canonical array, drift-detection required
- `G.cardKeywords: Record<CardExtId, BoardKeyword[]>` — built at setup time

- **MVP keyword effects:**

  | Keyword | Trigger | MVP Effect |
  |---|---|---|
  | `patrol` | Fight validation | +1 attack required to fight this villain |
  | `ambush` | City entry (reveal) | Each player gains 1 wound |
  | `guard` | Fight validation | Blocks targeting of City cards at lower indices |

---

## Guardrails

- Board keywords are **NOT hero abilities** — separate mechanism, automatic, no player choice
- Board keywords do NOT use the `HeroAbilityHook` system
- Keyword data resolved at setup time — no registry queries at move time
- `fightVillain` validation extended for Guard blocking + Patrol cost — three-step contract preserved
- Ambush fires during City entry (reveal pipeline) — not during fight
- WP-015 contract files (`city.types.ts`) must not be modified
- No `.reduce()` in keyword logic; no `boardgame.io` import in keyword helpers

---

## Required `// why:` Comments

- Board keywords: structural City rules, not hero abilities; fire automatically
- Guard blocking direction: blocks access to lower-index cards
- Patrol cost modifier: additive +1 MVP value
- Ambush timing: fires on City entry, not on fight
- `buildCardKeywords`: same setup-time resolution pattern as `G.cardStats`

---

## Files to Produce

- `packages/game-engine/src/board/boardKeywords.types.ts` — **new** — BoardKeyword union, BOARD_KEYWORDS
- `packages/game-engine/src/board/boardKeywords.logic.ts` — **new** — patrol/guard/ambush helpers
- `packages/game-engine/src/setup/buildCardKeywords.ts` — **new** — setup-time keyword resolution
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — Guard blocking + Patrol cost
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — Ambush on City entry
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — build cardKeywords
- `packages/game-engine/src/types.ts` — **modified** — add cardKeywords to LegendaryGameState
- `packages/game-engine/src/index.ts` — **modified** — exports
- `packages/game-engine/src/board/boardKeywords.logic.test.ts` — **new** — unit tests
- `packages/game-engine/src/board/boardKeywords.integration.test.ts` — **new** — integration tests

---

## Common Failure Smells (Optional)

- Guard blocks the Guard card itself -> self-blocking logic is wrong
- Ambush fires on fight instead of City entry -> timing mismatch
- Board keywords use HeroAbilityHook system -> wrong mechanism

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] WP-015 contracts (`city.types.ts`) not modified (confirmed with `git diff`)
- [ ] `BOARD_KEYWORDS` drift test passes
- [ ] `docs/ai/STATUS.md` updated (Patrol, Ambush, Guard functional)
- [ ] `docs/ai/DECISIONS.md` updated (board keywords separate from hero hooks; MVP values; automatic with no player choice)
- [ ] `docs/ai/ARCHITECTURE.md` updated (add `G.cardKeywords` to Field Classification Reference)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-025 checked off with date
