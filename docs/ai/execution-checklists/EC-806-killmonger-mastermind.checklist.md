# EC-806 — Killmonger Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-769-killmonger-mastermind.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` includes #2412. If WP-757 or WP-768 merged first, rebase onto it and keep every `fightMastermind` branch and projection field.
- [ ] Run `pnpm install` and `pnpm -r build` (expect 0). Engine suite green.
- [ ] Anchors unchanged:
  - `MastermindState` (a contract file) has no `wounds` field.
  - `resolveMastermindFightCost`.
  - The `fightMastermind` guards and `defeatMastermindTacticCore`.
  - `gainWoundForPlayer`.
  - `G.piles.wounds` and `G.ko`.
  - Every new-move lockstep site listed in WP Assumes 5.
- [ ] Verify the 4 tactic ids against `mastermind.setup.ts:279`. Re-read the move-list counts.

## Locked Values (do not re-derive)
- **Contract:** `MastermindState.wounds?: CardExtId[]`. It is omit-when-empty (remove the field, never leave `[]`) and holds real Wound card ids.
- **Effective cost:** `max(0, base + portal − wounds.length)`, generic across all Masterminds.
- **Wound return:** at the end of `defeatMastermindTacticCore`, **after** the tactic's `onFight`, move all remaining Wounds to `G.piles.wounds` and remove the field.
- **Killmonger (`bkpt/killmonger`) fight gate:** `fightMastermind` returns silently while the effective cost is `> 0`. Fighting at 0 gives no +1 recruit.
- **`woundMastermind()`:**
  - Validation, in order:
    0. Tactics remain, or `isFinalBlowAvailable(G.mastermind, G.finalBlow)` is true.
    1. The Mastermind is woundable (Killmonger).
    2. The effective cost is `> 0`.
    3. A Wound is available (stack, else KO pile).
    4. Spendable attack ≥ the effective cost.
    5. Stage is `main`.
    6. The full block-all guard list.
  - **Not** heal-locked, and does **not** set `hasActedThisTurn`.
  - Mutation, in order:
    1. Spend the cost.
    2. Move one Wound onto the Mastermind (stack first).
    3. Grant +1 recruit.
    4. Log it.
- **Seat order:** `seatOrder = ctx?.playOrder ?? Object.keys(G.playerZones).sort()`, rotated to start at the current player (index 0 if `resolveCurrentPlayer` returns null; the precedent is `heroEffects.execute.ts:~3514` and `seatChoice.resolve.ts:~414`) (v23 L2247-2248). Rite starts with the seat after the current player.
- **Strike**, per seat in that order:
  - 4 distinct classes in hand (dual-class counts both) → unaffected;
  - else, if Killmonger has a Wound → move it to the player's discard, then call `checkDivingBlock(G, playerId, WOUND_EXT_ID)`;
  - else → discard down to 4. The current player parks `{ choiceType: 'discard-to-limit', playerID, limit: 4 }`. Other players with a hand over 4 auto-discard `selectDiscardToLimitCards(G, hand, hand.length − 4)`; that argument is a **count**.
- **Scar:** +1 recruit per non-Henchman Villain in the defeater's Victory Pile.
- **Rite:** in seat order, starting after the defeater, each player with no Killmonger tactic in their Victory Pile gains one of his Wounds, then `checkDivingBlock` runs. This happens **before** the Wound return.
- **Waterfall:** draw 2, then each other seat with cards discards one via `PendingSeatChoice` kind `killmonger-waterfall-discard` (default index 0).
  - It mirrors `buildMonarchsDiscardChoice` / `applyMonarchsDiscard`.
  - Add a branch in `applySeatChoiceByKind` (which also handles timeouts).
- **EV:** `fightMastermind` captures `preDefeatSpendable` before the core and uses it for the EV check. Fix the stale "no onFight" comments.
- **Altar:** `recordHollowEffect` with `{ cardId, cardType: 'villain', timing: 'onFight', mechanic: 'villain-wound', reason: 'unsupported-keyword', turn: G.logMeta?.turn ?? 0 }`.
- **Projection:** `UIMastermindState.wounds?: number` and `woundable?: true` (Killmonger only). Both use explicit filter pass-through and are public.
- **Bot:** emit `woundMastermind` exactly when the gate passes, and no `fightMastermind` for Killmonger while the cost is `> 0`. `SCORE_WOUND_MASTERMIND_BASE = 110`.

## Guardrails
- All lockstep sites update together:
  - `game.ts`, `game.test.ts` (both lists), `index.ts`;
  - `SIMULATION_MOVE_NAMES` + intent emission, and `ai.competent` scoring;
  - `simulation.runner` / `par.aggregator` MOVE_MAPs + the drift test;
  - `replay.execute`;
  - `runFixture`.
- The move name must not start with `resolve…`, so server autoplay picks it up (D-24591).
- Only the contract field is new in `mastermind.types.ts`, and D-24602 records it.
- The Wound return runs after `onFight` on **every** defeat path.
- Core oracles unchanged. No randomness beyond the Waterfall draw reshuffle.
- Engine only. Moves never throw. No `.reduce()`.

## Required `// why:` Comments
- The generic −1-per-Wound rule (keyword + v23 L2213-2246).
- The return runs after `onFight` so Rite of Challenge sees the Wounds.
- `woundMastermind` is not a fight: no heal lock, no `hasActedThisTurn`, no Bystander rescue.
- Stack before KO pile, and the move is illegal when no Wound exists.
- No +1 recruit on the fight at 0.
- The bot score of 110.
- The strike's dual-class and hand-only reveal locks.
- The Altar / League deferral.

## Files to Produce
- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** (contract)
- `mastermind/killmonger.logic.ts` + test, `moves/woundMastermind.ts` + test — **new**
- `economy/economy.resolve.ts` (+ test), `moves/fightMastermind.ts` (+ test) — **modified**
- `rules/mastermindHandlers.ts` (+ test), `rules/tacticHandlers.ts` (+ test), `moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts` (+ tests) — **modified**
- `game.ts`, `game.test.ts`, `index.ts`, `simulation/ai.legalMoves.ts` (+ test), `simulation/ai.competent.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts` — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — **modified**
- `scripts/coverage/tactic-provenance.json`, `data/metadata/effect-implementation-index.json` — **modified / regenerated**
- `docs/ai/DECISIONS.md` (D-24602), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0.
- [ ] Engine suite passes. `pnpm -r --no-bail test` → 0 fail.
- [ ] A seeded 1p Killmonger sim terminates.
- [ ] `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0.
- [ ] Core oracles unchanged.
- [ ] D-24602 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) together with WP-771.

## Common Failure Smells
- The sim hangs on Killmonger → `woundMastermind` is not emitted, or not scored (unknown moves score 0).
- The bot FAULTs → the intent and the gate disagree, e.g. on Wound availability or cost.
- Rite gives out no Wounds → the return ran before `onFight`.
- The bot keeps wounding after the last tactic → step 0 is missing.
- A player with Diving Block took a Killmonger Wound without reacting → `checkDivingBlock` wasn't called.
- The strike discards exactly 4 cards → the limit was passed instead of the count.
- A core hash moved → `wounds` was seeded as `[]`, or the cost term changed for an unwounded Mastermind.
- The move-list drift test fails → one of the lockstep sites was missed.
- Fight works at 5 → the Killmonger gate is missing.
