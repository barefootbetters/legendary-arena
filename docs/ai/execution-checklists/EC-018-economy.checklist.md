# EC-018 — Attack & Recruit Economy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-018-attack-recruit-economy-minimal-mvp.md
**Layer:** Game Engine / Economy

**Execution Authority:**
This EC is the authoritative execution checklist for WP-018.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-018.

---

## Before Starting

- [ ] WP-017 complete (zones, KO, bystanders exist)
- [ ] `fightVillain` and `recruitHero` moves exist (WP-016)
- [ ] `G.city` and `G.hq` exist (WP-015)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-018.
If formatting, spelling, or ordering differs, the implementation is invalid.

### Card field types (from ARCHITECTURE.md / WP-003)

- `cost: string | number | undefined`
- `attack: string | number | null`
- `recruit: string | number | null`
- `vAttack: string | number`

### Parsing rule

- Strip trailing `+` or `*`
- Parse integer base
- Numeric inputs: `Math.floor`, then clamp at `>= 0`
- Unexpected input returns `0`
- All return values are integers >= 0
- Parser never throws

### Runtime state additions

- `G.turnEconomy` shape:
  `{ attack: number; recruit: number; spentAttack: number; spentRecruit: number }`
- `G.cardStats` shape:
  `Record<CardExtId, { attack: number; recruit: number; cost: number; fightCost: number }>`
  Read-only after setup — no move or hook may write to it.

### Turn reset value

- `resetTurnEconomy()` returns:
  `{ attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 }`

---

## Guardrails

- Economy logic is deterministic and pure
- Moves must not access the registry
  - registry data is resolved at setup time into `G.cardStats`
- No conditional bonuses of any kind
  - no keywords
  - no team/color effects
  - no "2+" semantics beyond base integer
- All economy values are integers >= 0
- Economy resets at **start of each player turn**
- Insufficient resources cause moves to return `void`
  - never throw
- Helpers contain no `boardgame.io` imports
- No `.reduce()` usage in economy calculations
- `buildCardStats` must set hero `fightCost = 0` and villain/henchman
  `attack = 0`, `recruit = 0`, `cost = 0` (no cross-contamination)
- `turnEconomy` must not appear in reveal pipeline or board helpers

---

## Required `// why:` Comments

- `CardStatEntry` definition
  - explain: stats resolved at setup so moves never query registry
- `parseCardStatValue`
  - explain: ARCHITECTURE.md "Card Field Data Quality"
- `buildCardStats`
  - explain: mirrors `G.villainDeckCardTypes` pattern
- `playCard` economy increment
  - explain: MVP applies base values only
- fight/recruit resource validation
  - explain: silent failure preserves deterministic move contract

---

## Files to Produce

- `src/economy/economy.types.ts` — **new**
- `src/economy/economy.logic.ts` — **new**
- `src/moves/coreMoves.impl.ts` (playCard) — **modified**
- `src/moves/fightVillain.ts` — **modified**
- `src/moves/recruitHero.ts` — **modified**
- `src/setup/buildInitialGameState.ts` — **modified**
- `src/game.ts` — **modified**
- `src/types.ts` — **modified**
- `src/index.ts` — **modified**
- `src/economy/economy.logic.test.ts` — **new**
- `src/economy/economy.integration.test.ts` — **new**

---

## Common Failure Smells (Optional)

- Fight succeeds with 0 attack
  → available-attack calculation wrong
- Recruit succeeds with insufficient recruit
  → cost parsing or spend logic broken
- Economy values go negative
  → spent vs available mix-up
- Registry referenced in move
  → setup-time resolution violated
- Economy carries across turns
  → reset not wired into turn start

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `boardgame.io` import in economy helpers
- [ ] No registry import in move files
- [ ] No `.reduce()` in economy logic
- [ ] Economy resets every turn
- [ ] `docs/ai/STATUS.md` updated
      (attack/recruit economy active)
- [ ] `docs/ai/DECISIONS.md` updated
      (registry boundary; base-value parsing)
- [ ] `docs/ai/ARCHITECTURE.md` updated
      (`G.turnEconomy`, `G.cardStats` classified as Runtime)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-018 checked off with date
