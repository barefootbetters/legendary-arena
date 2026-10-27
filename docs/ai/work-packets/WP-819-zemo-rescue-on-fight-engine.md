# WP-819 — Baron Zemo's rescue on a fight: "you may use 2 Recruit to rescue a Bystander" (Game Engine)

**Status:** Draft 2026-10-21 — READY TO EXECUTE (EC-857; **D-24753** reserved (#2942); pre-flight READY, copilot CONFIRM, 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine
**Dependencies:** none open. Builds on WP-736 / D-24556 + D-24557 (the opt-in `fightVillain` argument and its pre-spend gate), WP-739 / D-24560 (an active-player omit-when-absent economy cue), WP-486 / D-24291 (`defeatCityVillainCore`), WP-580 / D-24389 + WP-790 / D-24652 (`spendFightCostForTarget`). Pairs with WP-820 (the client control), which hard-depends on this packet. Sibling of WP-818 (Zemo's cost, strike and tactics); neither depends on the other.
**User-Visible Surface:** `play.legendary-arena.com` (through WP-820; this packet adds the move intent and the cue)
**Lane:** Standard (two-session). It changes a contract file (`ui/uiState.types.ts`), the fight move and the shared defeat core.
**Arc:** Cap 75th (ca75) completion arc, audit item 3b (the passive WP-818 deferred).

> Baseline: `origin/main` at `dfb75ac7` plus the reserve commit (#2942). Re-read line anchors and test totals at execution.

---

## Goal

As a player facing Baron Heinrich Zemo, I want to pay 2 Recruit when I fight a Villain to rescue a Bystander, so that I can buy my way to Savior (and so to Zemo's cheaper fight cost and the Masters of Evil (WWII) Savior rewards), as his card prints.

The printed line (`data/cards/ca75.json`, Zemo's base face): "Whenever you fight a Villain, you may use 2[icon:recruit] to rescue a Bystander." Today nothing offers it. After this session:

- `fightVillain` accepts an opt-in `payToRescueBystander?: boolean`. When Zemo is the Mastermind, the Bystander supply is not empty, and the fighter can still pay 2 Recruit after the fight's cost, the fight spends 2 Recruit and moves one Bystander from the supply to the fighter's Victory Pile. That happens **before** the fought Villain's Fight effects resolve, so a Savior gate on that Villain counts it.
- A request that cannot be honoured fights normally and logs why. The argument is ignored, silently and byte-identically, when Zemo is not the Mastermind.
- `UIState.economy.rescueOnFightAvailable` (active player only, omit-when-absent) tells the WP-820 client when to offer the control.

## User-Visible Impact

None by itself: no client sends the new argument until WP-820. Bots never opt in (the Excessive Violence precedent), so a bot's fight is unchanged.

---

## Assumes

1. **Card and rules text.** The line above is verbatim in `data/cards/ca75.json` (Zemo base face, abilities[0]). Rules v23 L772-792: when you fight a Villain you rescue its Bystanders and do its Fight effect, "Do these Fight and Rescue effects in any order"; L1849-1851: Bystanders reach the Victory Pile before a Savior ability is checked. Henchmen are Villains ("Henchmen Are Villains", D-24603).
2. **`fightVillain` today** (`moves/fightVillain.ts`): args `{ cityIndex, useExcessiveViolence? }` (L89-100); step 1 validates the index, City-space target, Guard, `requiredFightCost = resolveFightCost(G, cardId, ctx.currentPlayer) + patrolModifier` (L160-162), the spendable-attack gate (L168-171) and the defeat requirement; step 2 the stage gate and block-all guards, then the heal lock (L186-254); step 3 `defeatCityVillainCore(G, ctx, cityIndex, { random })` (L261), then the EV decision (L267-270) and the single `spendFightCostForTarget` debit (L277-281). The comment at L262-266 says the core never touches the attack / recruit spendable; it is already false for Hand Ninjas' `gain-recruit-current` (`villain/villainEffects.execute.ts` ~L2523-2546, D-24350) and becomes false for the rescue. The client senders are `CityRow.vue` `onFight` / `onFightEV`; `getLegalMoves` emits `{ cityIndex }` only.
3. **The shared defeat core** `defeatCityVillainCore(G, ctx, cityIndex, shuffleContext)` (`fightVillain.ts` L337): moves the Villain to the Victory Pile, awards its attached Bystanders (Step 3b) and captured Heroes (Step 3c, `awardAttachedHeroes`), then `executeVillainAbilities(…, 'onFight', …)` (~L411), then the fought / rescued log lines and the `fightResolved` event (whose `bystandersRescued` is the attached-Bystander award delta computed from `awardResult.playerVictory`, ~L421; the event push ~L468). Its other caller is `moves/defeatChoice.resolve.ts:230` (Silent Sniper / Cruel Ruler free defeats).
4. **Economy helpers** (`economy/economy.logic.ts`, all pure, returning new objects): `getAvailableRecruit(economy) = recruit - spentRecruit` (L728); `spendRecruit(economy, amount)` (L793); `spendFightCostForTarget(economy, cost, target)` (L1117-1150) pays from eligible restricted grants, then unrestricted attack, then recruit only under the WP-580 conversion (`recruitSpendableAsAttack`), copying the grant array; `getSpendableAttackForTarget` (L693). `G.turnEconomy.excessiveViolenceUsedThisTurn` closes EV once per turn (WP-736).
5. **The supply rescue idiom.** `G.piles.bystanders[0]` moved to the player's Victory Pile with `moveCardFromZone` (`moves/zoneOps.ts:54`, D-21501; the Xavier's Nemesis loop, `rules/tacticHandlers.ts` ~L705-721).
6. **The economy cue precedent** (WP-739, the 5-step Board-Visible Field contract in `.claude/rules/architecture.md`): `UITurnEconomyState.excessiveViolenceAvailable?: boolean` (`ui/uiState.types.ts:821`), built omit-when-absent in `ui/uiState.build.ts` (~L1088-1094), passed through for the active player only in `ui/uiState.filter.ts` (~L483-489; `REDACTED_ECONOMY` L44 never carries it), with filter tests (`uiState.filter.test.ts` ~L2702-2725) and a built-projection keyset drift pin (`ui/uiState.types.drift.test.ts` ~L832-900).
7. **Mastermind identity.** `G.selection.mastermindId` is the qualified `set/slug` (`'ca75/baron-heinrich-zemo'`); `G.selection?.` is safe on partial test states (`economy.resolve.ts` ~L188).
8. **No hashed fixture plays Zemo** (`packages/registry/src/gauntletLoadouts.generated.ts` only). The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic. A match without Zemo never reads the new argument and never projects the cue.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- WP-818 (`docs/ai/work-packets/WP-818-baron-zemo-mastermind.md`, merged as a draft in #2941) deferred this line: it is an opt-in payment made at fight time and needs a client control. The Excessive Violence arc is the template (WP-736 mechanic, WP-739 cue, WP-738 control); this packet folds the mechanic and the cue into one engine WP because both are small. WP-820 is the control.
- **Why a move argument, not a pending yes / no choice.** A post-fight "pay 2?" prompt would freeze the board for every Zemo fight, and it can't run before the Villain's Fight effects without splitting the defeat core around a park. As an argument, the choice and the fight are one atomic move (the WP-736 and WP-817 `discardCardId` reasoning).
- **Why rescue before the Fight effects.** The rules let the player order the Fight and Rescue effects. Rescuing first is the player-optimal order wherever it matters. Zemo always leads Masters of Evil (WWII), whose Black Knight, Executioner and Melter Fight lines are Savior-gated (WP-816), so a rescue paid on that very fight can turn the gate on. No Villain Fight effect is worse for having one more Bystander. A deterministic "before" therefore loses no legal option a player would want.
  - Two known trades. A Fight effect that *grants* Recruit can't fund the rescue paid on the same fight (Hand Ninjas' `gain-recruit-current` today, D-24350; WP-817's Captain Zolandia once it executes). And a Fight effect that rescues from the supply (`villainEffects.execute.ts` ~L1411-1466, ~L3120-3142) runs after the paid rescue, so with a near-empty supply the paid rescue can take the Bystander the free one would have taken. Both are rare and player-visible in the log.
- **Why affordability is judged against a simulated fight debit.** Under the WP-580 recruit-as-attack conversion the fight itself can spend Recruit. The move simulates the fight's debit with the pure `spendFightCostForTarget`, adding the EV +1 when EV is requested and still open, and pays the rescue only if 2 Recruit remain after it. So the rescue can never make the fight, or a requested Excessive Violence, unaffordable. The order of the real debits (2 Recruit inside the core, then the fight debit in the move) spends the same totals as the simulation.
- **Fight move only.** "Whenever you fight" is the `fightVillain` move. Silent Sniper / Cruel Ruler free defeats reach the core through `defeatChoice.resolve.ts` and never pass the option (the WP-656 Diamond Form / WP-817 precedent).
- **Coordination.** WP-817 (drafted) also edits `fightVillain.ts` (a `discardCardId` argument and its step-1 gate) and `CityRow.vue`. The two arguments compose: the rescue check doesn't read hands, and WP-817's discard doesn't touch the economy. Whichever executes second rebases and keeps both.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.3 Mastermind Shape, §5 Ability Text Markup Language (`[icon:recruit]`).
- `docs/ai/ARCHITECTURE.md` §The Move Validation Contract (validate, gate, mutate, never throw), §UIState Projection Integrity (the 5-step contract), Section 3 Persistence Boundaries.
- `docs/ai/DECISIONS.md`: scan D-24291, D-24389, D-24556, D-24557, D-24560, D-24561, D-24603, D-24652, D-24372 before coding.
- User memory: `project_excessive_violence_arc` (cue + control lessons; a bot can't arm an opt-in), `project_arena_client_uistate_backfill_recurrence` (the filter whitelist drop), `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24753) before coding. One WP per session.

**Packet-specific:**
- **Validate before commit.** The rescue decision is made in the move after the heal lock and before `defeatCityVillainCore`. The core only executes a decision the move already made.
- **Never overdraw.** The rescue is paid only when `canPayRescueOnFight` says 2 Recruit remain after the simulated fight debit.
- **Byte-identical otherwise.** No Zemo, or no argument: the move, the core and the projection behave exactly as on the baseline (no log line, no economy change, no cue key).
- **Free defeats are untouched.** Only `fightVillain` passes the core option.
- **5-step contract** for the cue: type, build, filter pass-through, filter tests, built-projection keyset drift pin (runtime assertion, D-24372).

## Locked Values

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

---

## Scope (In)

- **A)** `economy/rescueOnFight.logic.ts` (new) + test: the cost constant, the three helpers.
- **B)** `moves/fightVillain.ts` + test: the argument, the decision, the blocked lines, the core option and the rescue.
- **C)** `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `uiState.build.test.ts`, `uiState.filter.test.ts`, `uiState.types.drift.test.ts`: the cue.

## Out of Scope

- **The client control** (WP-820).
- **Bots opting in.** `getLegalMoves` keeps emitting `{ cityIndex }`; the competent AI never pays (the EV precedent). A bot policy is its own change.
- **Free defeats** (Silent Sniper, Cruel Ruler, Pure Fury) — not "fight".
- **Fighting the Mastermind** — "fight a Villain" only.
- **A Recruit-granting Fight effect funding the same fight's rescue** (WP-817's Captain Zolandia; Context).
- **WP-818's cost, strike and tactics** (their own packet).
- **PAR regeneration** (bots never pay).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `economy/rescueOnFight.logic.ts` — **new**; `economy/rescueOnFight.logic.test.ts` — **new**
- `economy/economy.resolve.ts`, `rules/mastermindHandlers.ts` — modified **only if WP-818 has executed** (the id import swap)
- `moves/fightVillain.ts` — modified; `moves/fightVillain.test.ts` — modified (additions only)
- `ui/uiState.types.ts` — modified (one optional field)
- `ui/uiState.build.ts` — modified; `ui/uiState.build.test.ts` — modified (additions only)
- `ui/uiState.filter.ts` — modified; `ui/uiState.filter.test.ts` — modified (additions only)
- `ui/uiState.types.drift.test.ts` — modified (one pin added)

**Governance:** `docs/ai/DECISIONS.md` (D-24753), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 10 engine files: 2 new, 8 modified, 5 of them tests.

## Contract

- The Locked Values above: `RESCUE_ON_FIGHT_RECRUIT_COST`, `isRescueOnFightOffered`, `canPayRescueOnFight`, `isRescueOnFightCueOn`, `FightVillainArgs.payToRescueBystander`, the optional core `options`, the three log strings, `UITurnEconomyState.rescueOnFightAvailable`.
- `defeatCityVillainCore`'s existing four-argument calls keep compiling and behave identically.

## Test Contract

Minimal `G` fixtures in each file's existing style (`fightVillain.test.ts` builds its fight `G` with a City villain, `cardStats` and a `turnEconomy`), `messages: []`. "Zemo" = `selection.mastermindId: 'ca75/baron-heinrich-zemo'`. Supply Bystanders are `pile-bystander` ids. Each file groups its cases under one `describe('WP-819 …')`.

| # | File | Input | Expected | Invariant / must NOT |
|---|---|---|---|---|
| T1 | rescueOnFight.logic | `isRescueOnFightOffered` with Zemo; `'core/red-skull'`; no `selection` | true; false; false | |
| T2 | rescueOnFight.logic | `canPayRescueOnFight` with debit 5 at `'sewers'`: `{ attack 5, recruit 2 }`; `{ attack 5, recruit 1 }`; conversion on `{ attack 3, recruit 4 }`; conversion on `{ attack 3, recruit 3 }` | true; false; true (the fight takes 2 Recruit, 2 remain); false (1 remains) | the input economy is not mutated |
| T3 | rescueOnFight.logic | `isRescueOnFightCueOn`: Zemo + supply 1 + 2 Recruit; supply empty; 1 Recruit; not Zemo | true; false; false; false | |
| T4 | fightVillain | Zemo; villain V (cost 3) at City 0 with no onFight hook; attack 3, recruit 2; supply `[pile-bystander]`; `{ cityIndex: 0, payToRescueBystander: true }` | V in victory; the Bystander in victory after V; `spentRecruit` +2; attack spent 3; the `paid … on fighting …` line; the `fightResolved` event's `bystandersRescued === 0` | the rescue is not an attached-Bystander award |
| T5 | fightVillain | T4 with V's onFight `{draw-cards-current, drawCount 1, requireCondition savior}` (adapt the WP-816 fixture, `fightVillain.test.ts` ~L1287-1309, with `attachedBystanders = {}` so V carries no Bystander; set Zemo by spreading `selection`, ~L1046-1051), the fighter holding 2 Victory-Pile Bystanders, a deck card, a shuffle context; and a control run of the same state without the argument | with the argument: hand +1, and the paid line precedes the draw's self-narrated `Fight effect: drew 1 card(s).` line; control: hand unchanged and the `Fight effect: Player 0 is not a Savior (2 of 3 Bystanders in their Victory Pile); no effect.` line | rescue before onFight; the rescue alone makes the Savior |
| T6 | fightVillain | T4 with recruit 1 | fought normally; recruit unspent; no Bystander moved; the `could not pay` line | never overdraw |
| T7 | fightVillain | T4 with an empty supply | fought normally; the `supply is empty` line | |
| T8 | fightVillain | conversion on, attack 3, recruit 4, V cost 5, rescue requested | V defeated; Recruit spent 2 (fight) + 2 (rescue); the rescue paid | simulation = real debits |
| T9 | fightVillain | conversion on, attack 3, recruit 3, V cost 5, `payToRescueBystander: true` | V defeated (fight takes 2 Recruit); no rescue; the `could not pay` line, before the fought line | |
| T10 | fightVillain | EV open (one enrolled EV card), both `useExcessiveViolence` and `payToRescueBystander`: (a) attack 4, recruit 2, V cost 3, no conversion; (b) conversion on, attack 3, recruit 2, V cost 3 | (a) EV fires, rescue paid; (b) EV fires, `spentAttack` 3 and `spentRecruit` 1, no rescue, the `could not pay` line | (b) fails if the EV +1 is dropped from `fightDebit`: the rescue would pay and the post-rescue spendable 3 < 4 would cancel EV |
| T11 | fightVillain | not Zemo (`'core/red-skull'`), `payToRescueBystander: true`, recruit 2 | `G` after equals `G` after the same fight without the argument (deep-equal) | arg ignored, byte-identical |
| T12 | fightVillain | Zemo, the argument absent | no rescue, no Zemo line | |
| T13 | fightVillain | `defeatCityVillainCore` called with four arguments (the free-defeat shape) under Zemo | no rescue | free defeats untouched |
| T14 | uiState.build | Zemo, active player recruit 2, supply 1 | `economy.rescueOnFightAvailable === true`; recruit 1 → key absent; supply 0 → absent; not Zemo → absent | omit-when-absent |
| T15 | uiState.filter | the cue set | present for the active player and still present after `JSON.parse(JSON.stringify(filtered))` (the Play Diagnostics `uiStateSnapshot` serialization, the `uiState.filter.test.ts` ~L3357 precedent); absent for a non-active player and a spectator; absent-when-unset keeps the key out | active-player-only; step 5 of the contract |
| T16 | uiState.types.drift | the EV pin's setup (~L839-873, `bystandersCount: 1`), then a spread copy `{ ...gameState, selection: { ...gameState.selection, mastermindId: 'ca75/baron-heinrich-zemo' } }` (`selection` is `readonly`, `types.ts` ~L1806; the `fightVillain.test.ts` ~L1049-1052 precedent, no `@ts-ignore`) with `turnEconomy.recruit = 2` | economy keyset sorted = `['attack', 'availableAttack', 'availableRecruit', 'piercing', 'recruit', 'rescueOnFightAvailable', 'woundsDrawn']`; with `recruit = 1` the key is absent | runtime keyset pin (D-24372) |
| T17 | fightVillain | Zemo, `payToRescueBystander: true`, on a **declining** state — recruit 1 (the `could not pay` path), and separately an empty supply (the `supply is empty` path) — each with (a) `currentStage: 'start'`, (b) healed this turn, (c) attack below the cost | each: `G` deep-equal before and after; no `could not …` line | declined lines fire only on a fight that happens (a payable state would log nothing even if the decision were misplaced) |
## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** Zemo is a gauntlet Mastermind. The rescue is a player choice that turns Recruit into VP and toward Savior, as printed. Bots never take it, so PAR is unchanged.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine-only card fidelity, no paid or persuasive surface).

**Determinism preservation:**
- No new `G` field. The decision reads `G` and the move argument; the rescue is the supply top; no randomness.
- The cue is a read-only `playerView` projection, not hashed.
- Hash oracles are expected unchanged (no fixture plays Zemo, and no fixture sends the argument). If either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay their logged moves; no pre-WP-819 move carries `payToRescueBystander`, so they replay identically.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Helpers.** T1-T3 pass.
2. **Rescue.** T4, T5, T8 and T10 pass; the rescue lands before the Fight effects.
3. **Declines.** T6, T7 and T9 pass.
4. **Isolation.** T11-T13 and T17 pass.
5. **Cue.** T14-T16 pass.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (the client compiles against the widened type).
7. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record the before / after totals. The hash oracles (`game.test.ts`, `replay/replay.execute.test.ts`) pass unchanged.
3. `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
4. `pnpm -r --no-bail test` → 0 fail.
5. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
6. Revert proofs, one at a time, each must fail at least one T-case: move the rescue after `executeVillainAbilities`; drop the simulated fight debit (check raw `getAvailableRecruit`); drop the filter pass-through; drop the EV +1 from `fightDebit` (T10b); move the decision above the stage gate (T17, declining state).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24753 appended to `DECISIONS.md` as Active (it covers WP-820's control too). `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-857:` then `SPEC:`.
- [ ] **D-24026 live-verify (post-merge, partial):** on `play.legendary-arena.com` with the deployed gitSha checked, in a `ca75/baron-heinrich-zemo` match staged through the operator setter pane (WP-806/807), the Play Diagnostics `uiStateSnapshot` shows `economy.rescueOnFightAvailable: true` with 2+ Recruit and omits the key with 1 Recruit; a non-Zemo bot match completes without regression. The rescue's fire path is verified with WP-820 (no client sends the argument before it).

## Reserved Decision (lands at execution)

**D-24753 — zemo-rescue-on-fight.** It locks:
- the authorized contract-file change: `UITurnEconomyState.rescueOnFightAvailable?` (active-player-only, omit-when-absent);
- "Whenever you fight a Villain, you may use 2 Recruit to rescue a Bystander" as the `fightVillain` opt-in `payToRescueBystander`, the fight move only (Villains and Henchmen; never free defeats or the Mastermind);
- the rescue resolves before the fought Villain's Fight effects (rules v23 L772-792 "any order", player-optimal; the two trades noted: Recruit-granting Fight effects (Hand Ninjas, Captain Zolandia) and supply-rescuing Fight effects on a near-empty supply);
- affordability against the simulated fight debit (plus an open EV +1), so the rescue never makes the fight or EV unaffordable; a declined request fights normally and logs why; no Zemo → ignored, byte-identical;
- `BARON_ZEMO_MASTERMIND_ID` lives in `economy/rescueOnFight.logic.ts` and is imported by WP-818's cost term and strike;
- the rescued Bystander is the supply top; `fightResolved.bystandersRescued` keeps meaning the fought Villain's own Bystanders;
- bots never opt in;
- WP-820's control: a separate per-villain button, shown from the cue plus a client affordability mirror, submitting the intent; the engine stays the authority.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → READY TO EXECUTE after two text fixes, applied (the reviewer ruled no re-run is needed).** All Assumes anchors were verified (two line ranges corrected), along with economy-helper purity, `moveCardFromZone` returning fresh arrays, the EV-cue anchors, and the fact that only gauntlet data references Zemo. Arithmetic: T2 / T8 / T9 hold. Paying the rescue before the fight debit spends the same totals as the simulation, and the post-core EV decision can't flip because the simulation included the open +1. T5 is constructible. The hash and `fightResolved` are unchanged, and the bot / sim / PAR paths are unaffected. The four touched test files ran 449 / 0 on the baseline.
- **PS-1 (fixed):** T10's second case could never fail → replaced by T10b (conversion on, attack 3, recruit 2, cost 3, EV open), which fails if the EV +1 is dropped from `fightDebit`; that is now revert proof 4.
- **PS-2 (fixed):** step 5 of the Board-Visible Field contract was missing → T15 asserts the key survives the JSON round-trip, and WP-820's live-verify checks the Play Diagnostics `uiStateSnapshot`.
- **RS-1 (fixed):** the move's "core does not touch spendable" comment (~L262-266) is rewritten (Locked Values); it was already false for Hand Ninjas.
- **RS-2 (fixed):** the Recruit-granting trade names Hand Ninjas (D-24350) and Captain Zolandia.
- **RS-3 (fixed):** file count 10 (2 new, 8 modified, 5 tests).
- **RS-4 (fixed):** T16's construction and exact keyset are spelled out.
- **RS-5 (fixed):** the Zemo-id `// why:` is worded so it holds whether or not WP-818 has landed.
- **RS-6 (fixed):** declined-request lines are logged in the move before the core; T9 requests the rescue.
- **RS-7 (fixed):** the rescue never writes `awardResult.playerVictory`; T4 asserts `bystandersRescued === 0`.

**Copilot (01.7), round 1 (independent subagent, both packets): RISK (HOLD), twelve scope-neutral fixes, all applied; pre-flight stands.** Verified clean: every `fightVillain` caller passes args through untouched (replay, sim runner, PAR aggregator, fixtures, `game.ts` registration, no server arg validation; bots and the slash gesture never pay); the operator view sees the cue (harmless, like EV); spectators get `REDACTED_ECONOMY`; no onFight Victory-Pile write aliases `awardResult.playerVictory`; declined lines can fire only after every silent return; WP-820's mirror is exact.
1. Mode 11: T5's copied fixture carried an attached Bystander → `attachedBystanders = {}` plus a control run; the preceding line is named.
2. Mode 11: no test that a failed fight logs nothing → T17 + revert proof 5.
3. Mode 22: the core paid before checking the supply top → read it first, skip both when undefined.
4. Mode 15: two more stale comments (Step-3 ~L250-258, the core JSDoc) → locked rewrites + `@param options`.
5. Modes 27 / 4: a third copy of the Zemo id → one exported `BARON_ZEMO_MASTERMIND_ID` in `rescueOnFight.logic.ts`; WP-818 / EC-856 import it if WP-819 lands first, WP-819 swaps WP-818's two declarations if it lands second.
6. Mode 26: the "player-optimal" claim → a second trade named (supply-rescuing Fight effects on a near-empty supply).
7. Mode 23: order with WP-817's discard → locked (discard, then the rescue decision, then the core).
8. Mode 21: T16 assigned a `readonly` field → a spread copy.
9. Modes 30 / 12: the coordination wasn't in EC-855 → EC-855 Before Starting and WP-817 Assumes 5 now carry it; WP-820 gains conditional T7.
10. Modes 12 / 26: no rescue on Primus in a Zemo + Primus match → WP-820 Out of Scope.
11. Mode 11: WP-820 T6 was weak and the target untested → T6 renders all three buttons; T6b restricted-attack target; the restricted-attack Out of Scope line reworded.
12. EC-858 omitted `type="button"` → added.

**Copilot (01.7), rounds 2-3 (same independent subagent): round 2 RISK (HOLD) on WP-819, CONFIRM on WP-820; round 3 CONFIRM on all four touched packets.** All twelve round-1 fixes were confirmed: T5 now separates rescue from no-rescue (3 vs 2 Bystanders), the locked strings match the code, and there is no import cycle; either execution order ends with one Zemo-id declaration and no dangling import.
- **A (fixed):** T17 ran on a payable state, which logs nothing even with a misplaced decision → it now runs on declining states (recruit 1; empty supply) × (stage, heal lock, cost), after T16.
- **B (fixed):** WP-818 / EC-856's strike line carries the "WP-819 first" conditional; WP-819 / EC-857 name the strike-branch rename.
- **C (fixed):** WP-817 gains conditional T34 (mirrors WP-820 T7), tied into its AC 8.
EC line counts: EC-855 75, EC-856 73, EC-857 58, EC-858 49.

**Lint (00.3) (independent subagent): FAIL → PASS after text-only fixes, applied** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. Two FAILs (§15.1, and EC-857's restated Locked Values) were fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all sections present; Out of Scope has 7 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — 9 Assumes items, anchors verified, BLOCKED clause |
| §4 | PASS — 00.2 §1.3 / §5, ARCHITECTURE sections, a 9-entry DECISIONS scan, memory refs |
| §5 | PASS — 10 engine files, justified; the conditional WP-818 id swap listed |
| §6 | PASS — `set/slug` mastermind id; names follow the EV precedent |
| §7 | PASS — no new dependencies |
| §8 | PASS — pure `.logic.ts`, no boardgame.io; no `G` field; the cue through the filter whitelist |
| §9 | PASS — pnpm / git only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, pure-`G` fixtures; hash oracles stand in for the golden test |
| §13 | PASS — exact commands, exit codes, diff-scope step, 5 revert proofs |
| §14 | PASS — 7 binary criteria tied to T1-T17 and named gates |
| §15 | PASS — STATUS, DECISIONS (D-24753), indexes, allowlist check |
| §15.1 | PASS after fix — a partial D-24026 live-verify (the cue in a staged Zemo match's `uiStateSnapshot` + a non-Zemo smoke); the fire path with WP-820 |
| §16 | PASS — style mandated; the decision and the rescue are their own helpers (`decideRescueOnFight`, `applyRescueOnFight`, advisory A1) |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 / NG-1; conflict line; determinism + replay-compat |
| §18 | N/A — no grep verification step |
| §19 | N/A at draft — applies to STATUS at close |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

EC-857 vs EC-TEMPLATE: FAIL → PASS after the Locked Values were replaced by a verbatim copy of the WP's; all seven sections in order, under 100 lines; scope lock present; WORK_INDEX "with date" (A5).

**Verdict:** PASS.
