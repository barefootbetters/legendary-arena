# EC-019 — Mastermind Fight & Tactics (Execution Checklist)

**Source:** docs/ai/work-packets/WP-019-mastermind-tactics-boss-fight-minimal-mvp.md
**Layer:** Game Engine / Boss Fight

**Execution Authority:**
This EC is the authoritative execution checklist for WP-019.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-019.

---

## Before Starting

- [ ] WP-018 complete: `parseCardStatValue`, `getAvailableAttack`, `spendAttack` exist
- [ ] `G.turnEconomy` and `G.cardStats` exist in `LegendaryGameState` (WP-018)
- [ ] `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` exists in `endgame.types.ts` (WP-010)
- [ ] `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage` exist (WP-008A) —
      for reference only; `fightMastermind` must NOT be added to either
- [ ] `shuffleDeck` exists in `setup/shuffle.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-019.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 'mastermindDefeated'`
- `MatchSetupConfig` field: `mastermindId`
- Mastermind card data: `tactic: boolean` (true = tactic, false = base/epic), `vAttack: string | number`
- `MastermindState` shape:
  `{ id: CardExtId; baseCardId: CardExtId; tacticsDeck: CardExtId[]; tacticsDefeated: CardExtId[] }`
- `vAttack` parsed via WP-018's `parseCardStatValue` -- no new parser
- Stats lookup key: `G.cardStats[G.mastermind.baseCardId].fightCost` -- never
  use `.attack` (that is for hero attack generation per D-1805), never use
  `G.mastermind.id` or tactic IDs
- Mastermind base card is NOT in `G.cardStats` from WP-018 --
  `buildMastermindState` must add it during setup

---

## Guardrails

- Registry boundary: engine must NOT import `@legendary-arena/registry` at module scope
- `vAttack` is parsed at setup by `buildMastermindState` using WP-018's
  `parseCardStatValue` and stored as `fightCost` in
  `G.cardStats[baseCardId]` -- runtime reads `.fightCost` only
- Victory counter uses `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` constant -- never string literal
- `fightMastermind` follows three-step validation contract
- MVP: one tactic defeated per successful fight -- no multi-tactic or conditional defeat
- MVP: no tactic text effects -- tactic abilities are WP-024
- WP-018 contract files (`economy.types.ts`, `economy.logic.ts`) must NOT be modified
- No `.reduce()`, `Math.random()`, or `require()` in any new file
- `coreMoves.gating.ts` must NOT be modified -- non-core moves use internal
  stage gating (`if (G.currentStage !== 'main') return;`)
- `buildMastermindState` is the **sole place** the mastermind base card enters
  `G.cardStats` -- WP-018's `buildCardStats` does NOT include masterminds
- `buildMastermindState` must add mastermind base card to `cardStats` param
  with `fightCost` from `vAttack` (attack=0, recruit=0, cost=0 -- same as
  villains per D-1805)
- **Ordering:** `buildMastermindState` must execute **after** `buildCardStats`
  so the `cardStats` record already exists when the mastermind entry is added

---

## Required `// why:` Comments

- `baseCardId`: the ONLY card ID used for stat lookup; tactic IDs never participate
- `fightMastermind` victory counter: triggers endgame evaluator from WP-010
- 1-tactic-per-fight: MVP simplification; multi-tactic defeat and tactic text effects are WP-024
- Shuffle call in `buildMastermindState`
- `fightMastermind` internal stage gating: boss fight during action window
  (non-core move gates internally, same pattern as fightVillain/recruitHero)
- `buildMastermindState` cardStats addition: mastermind fight cost resolved at
  setup so fightMastermind reads G.cardStats[baseCardId].fightCost

---

## Files to Produce

- `src/mastermind/mastermind.types.ts` -- **new** -- `MastermindState`
- `src/mastermind/mastermind.setup.ts` -- **new** -- `buildMastermindState`
- `src/mastermind/mastermind.logic.ts` -- **new** -- `defeatTopTactic`, `areAllTacticsDefeated`
- `src/moves/fightMastermind.ts` -- **new** -- `fightMastermind` move (internal stage gating)
- `src/setup/buildInitialGameState.ts` -- **modified** -- build mastermind state
- `src/game.ts` -- **modified** -- register `fightMastermind` in play phase
- `src/types.ts` -- **modified** -- add `mastermind: MastermindState`
- `src/index.ts` -- **modified** -- export mastermind types and helpers
- `src/mastermind/mastermind.setup.test.ts` -- **new** -- 5 tests
- `src/mastermind/mastermind.logic.test.ts` -- **new** -- 5 tests
- `src/moves/fightMastermind.test.ts` -- **new** -- 6 tests

---

## Common Failure Smells (Optional)

- Stats looked up via `G.mastermind.id` or tactic IDs instead of `baseCardId`
  -> wrong card used for attack requirement; fight validation broken
- String literal `'mastermindDefeated'` used instead of constant
  -> endgame evaluator will not detect victory
- Separate `parseVAttack` function created instead of reusing `parseCardStatValue`
  -> parallel parser drift
- Stats read from `.attack` instead of `.fightCost`
  -> conflates hero attack generation with fight requirement (D-1805)
- `coreMoves.gating.ts` modified to add `fightMastermind`
  -> type error: `MOVE_ALLOWED_STAGES` is `Record<CoreMoveName, ...>`

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` used (not string literal
      `'mastermindDefeated'`)
- [ ] `.fightCost` used in `fightMastermind.ts` (grep verified)
- [ ] `.attack` NOT used for mastermind fight requirement (grep verified)
- [ ] No boardgame.io import in `mastermind.logic.ts` or
      `mastermind.types.ts`
- [ ] `coreMoves.gating.ts` NOT modified (`git diff --name-only`)
- [ ] WP-018 contracts not modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (mastermind fight exists; full MVP
      combat loop functional)
- [ ] `docs/ai/DECISIONS.md` updated (1 tactic per fight simplification;
      fightCost from G.cardStats via buildMastermindState; no tactic text
      effects)
- [ ] `docs/ai/ARCHITECTURE.md` updated (`G.mastermind` in Field
      Classification table)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-019 checked off with date
