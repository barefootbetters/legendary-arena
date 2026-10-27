# EC-857 — Baron Zemo rescue on a fight, engine (Execution Checklist)

**Source:** docs/ai/work-packets/WP-819-zemo-rescue-on-fight-engine.md
**Layer:** Game Engine

## Before Starting
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `fightVillain` args are `{ cityIndex, useExcessiveViolence? }` (plus WP-817's `discardCardId?` if it executed first: keep it); `defeatCityVillainCore(G, ctx, cityIndex, shuffleContext)` runs Step 3b / 3c then `executeVillainAbilities(…, 'onFight', …)`.
- [ ] `spendFightCostForTarget`, `getAvailableRecruit`, `spendRecruit` are pure (`economy.logic.ts` ~L728 / ~L793 / ~L1117).
- [ ] The EV cue is projected and filtered as WP §Assumes 6 says.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; record the engine test total.

## Locked Values (do not re-derive; verbatim from the WP)
**New file `economy/rescueOnFight.logic.ts`** (pure, no boardgame.io import):
- `export const RESCUE_ON_FIGHT_RECRUIT_COST = 2;`
- `export const BARON_ZEMO_MASTERMIND_ID = 'ca75/baron-heinrich-zemo';` — the single home of the id (`code-style.md`: abstract at the third copy). If WP-818 has executed first, replace its two private declarations (`economy/economy.resolve.ts` `BARON_ZEMO_MASTERMIND_ID`, `rules/mastermindHandlers.ts` `MASTERMIND_BARON_ZEMO`) with imports of this export (the declaration swap in each file, plus renaming the strike branch's `MASTERMIND_BARON_ZEMO` reference to `BARON_ZEMO_MASTERMIND_ID`; conditional allowlist entries). If WP-818 executes second, WP-818 imports it (its EC-856 says so).
- `export function isRescueOnFightOffered(G: LegendaryGameState): boolean` → `G.selection?.mastermindId === BARON_ZEMO_MASTERMIND_ID`.
- `export function canPayRescueOnFight(economy: TurnEconomy, fightDebit: number, fightTarget: AttackTargetName): boolean` → `getAvailableRecruit(spendFightCostForTarget(economy, fightDebit, fightTarget)) >= RESCUE_ON_FIGHT_RECRUIT_COST`.
- `export function isRescueOnFightCueOn(G: LegendaryGameState): boolean` → `isRescueOnFightOffered(G) && G.piles.bystanders.length > 0 && getAvailableRecruit(G.turnEconomy) >= RESCUE_ON_FIGHT_RECRUIT_COST`.

**`fightVillain` (`moves/fightVillain.ts`):**
- `FightVillainArgs.payToRescueBystander?: boolean` (JSDoc: the Baron Zemo opt-in; absent / false is a normal fight; ignored unless Zemo is the Mastermind).
- After the heal lock (`hasHealedThisTurn`) and before `defeatCityVillainCore`. If WP-817 has executed, its fight discard and its discard log line come first, then this decision and any declined-request line, then the core:
  - `isRescueRequested = payToRescueBystander === true && isRescueOnFightOffered(G)`.
  - `isExcessiveViolenceOpen = useExcessiveViolence === true && G.turnEconomy.excessiveViolenceUsedThisTurn !== true`.
  - `fightDebit = requiredFightCost + (isExcessiveViolenceOpen ? 1 : 0)`.
  - `isRescuePaid = isRescueRequested && G.piles.bystanders.length > 0 && canPayRescueOnFight(G.turnEconomy, fightDebit, fightTarget)`.
  - Not paid but requested, logged here in the move before the core (so a declined request's line precedes the fight's lines):
    - supply empty → `` `Player ${ctx.currentPlayer} could not rescue a Bystander — the Bystander supply is empty (Baron Zemo).` `` `'blocked'`;
    - otherwise → `` `Player ${ctx.currentPlayer} could not pay ${RESCUE_ON_FIGHT_RECRUIT_COST} Recruit to rescue a Bystander after the fight cost (Baron Zemo).` `` `'blocked'`.
- The decision and its declined-request lines live in their own JSDoc'd function in `fightVillain.ts`, `decideRescueOnFight(G, currentPlayer, payToRescueBystander, useExcessiveViolence, requiredFightCost, fightTarget): boolean` (returns `isRescuePaid`), so the move stays readable.
- `defeatCityVillainCore(G, ctx, cityIndex, { random }, { payRescueOnFight: isRescuePaid })`. Everything after the core is unchanged.

**`defeatCityVillainCore`:** gains an optional 5th parameter `options?: { payRescueOnFight?: boolean }`. When `options?.payRescueOnFight === true`, after Step 3c (`awardAttachedHeroes`) and **before** `executeVillainAbilities(…, 'onFight', …)`, it calls its own JSDoc'd helper `applyRescueOnFight(G, currentPlayer, cardId)`, which does:
  - read `topBystander = G.piles.bystanders[0]` first; `undefined` → skip both the spend and the move (defensive, the core's empty-space no-op precedent ~L349-353);
  - `G.turnEconomy = spendRecruit(G.turnEconomy, RESCUE_ON_FIGHT_RECRUIT_COST)`;
  - `topBystander` moves to the fighter's Victory Pile through `moveCardFromZone`, writing both arrays back;
  - `` `Player ${currentPlayer} paid ${RESCUE_ON_FIGHT_RECRUIT_COST} Recruit to rescue a Bystander on fighting ${formatCardRef(G.cardDisplayData, cardId)} (Baron Zemo).` `` `'applied'`.
  - The rescue writes a fresh `zones.victory` array from `moveCardFromZone` and never pushes into `awardResult.playerVictory`, so the `fightResolved` event's `bystandersRescued` keeps counting only the fought Villain's attached Bystanders.
- Three stale comments are rewritten: the core's JSDoc (~L313-336) gains `@param options` and names the rescue's Recruit spend; the move's Step-3 comment (~L250-258, "the only turnEconomy writes in villainEffects are to woundsDrawn … byte-identical") names the rescue spend and Hand Ninjas' Recruit grant; and the move's comment at L262-266 ("defeatCityVillainCore does not touch attack/recruit spendable") is rewritten: the core may now spend the rescue's Recruit (and a Fight effect may grant Recruit, Hand Ninjas), and the EV decision that follows reads the post-core economy safely because the rescue was judged against a simulated debit that already included the open EV +1.

**Cue (`ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`):**
- `UITurnEconomyState.rescueOnFightAvailable?: boolean` (JSDoc in the `excessiveViolenceAvailable` style: WP-819 / D-24753, active-player-only, omit-when-absent, surfaces whether the option exists, nothing else).
- Build: `...(isRescueOnFightCueOn(gameState) ? { rescueOnFightAvailable: true as const } : {})` beside the EV cue.
- Filter: the active-player economy passes it through exactly like `excessiveViolenceAvailable`; `REDACTED_ECONOMY` never carries it.

## Guardrails
- Validate before commit; the core executes the move's decision and never re-derives it.
- Never overdraw: the rescue never makes the fight or an open EV unaffordable (T8-T10).
- No Zemo or no argument: byte-identical (T11, T12). Free defeats never pass the option (T13).
- 5-step Board-Visible Field contract for the cue, including the built-projection keyset pin (runtime, D-24372).
- No `G` field, no randomness, nothing throws, no `.reduce()`.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- The rescue placement before `executeVillainAbilities`: rules v23 L772-792 "any order"; player-optimal for the Savior gates (D-24753).
- The simulated debit: under the WP-580 conversion the fight spends Recruit; the rescue must never overdraw the fight or EV.
- `BARON_ZEMO_MASTERMIND_ID`: the single home of the Zemo id; WP-818's cost term and strike import it.
- The core option: only `fightVillain` passes it ("whenever you fight"); free defeats don't.
- The cue: active-player-only, omit-when-absent; the filter whitelist drops a field it doesn't name (EC-206).

## Files to Produce
- `packages/game-engine/src/economy/rescueOnFight.logic.ts` + test — **new**
- `packages/game-engine/src/economy/economy.resolve.ts`, `rules/mastermindHandlers.ts` — **modified only if WP-818 executed first** (id import swap)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified**; `moves/fightVillain.test.ts` — **modified** (additions only)
- `packages/game-engine/src/ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts` — **modified** (additions only)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T17 pass (T5 with no attached Bystander plus its control run). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Revert proofs observed (rescue after onFight; raw recruit instead of the simulated debit; filter pass-through dropped; EV +1 dropped from `fightDebit`, caught by T10b; decision moved above the stage gate, caught by T17 on a declining state).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24753 Active (covers WP-820's control). STATUS updated. WORK_INDEX `[x]` with date. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-857:` then `SPEC:`.
- [ ] Live-verify (D-24026): the cue in a staged Zemo match's `uiStateSnapshot` + a non-Zemo smoke; the fire path is pending on WP-820.

## Common Failure Smells
- A Savior Fight reward ignores the paid rescue → the rescue ran after `executeVillainAbilities`.
- A recruit-as-attack fight fails after a rescue was paid → the decision read raw `getAvailableRecruit`, not the simulated debit.
- The client never sees the cue → the filter did not pass `rescueOnFightAvailable` through.
- A Silent Sniper defeat spends Recruit → the core defaulted the option on.
- A non-Zemo match logs a Zemo line → `isRescueOnFightOffered` was skipped for the declined-request lines.
