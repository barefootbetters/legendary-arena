# WP-769 — Killmonger: Mastermind Wounds, the "Wound him" move, Master Strike and tactics (Game Engine)

**Status:** Draft 2026-09-26; **reconciled and re-gated 2026-11-16** on `main` `4de2e5301` (after WP-768 / D-24601 Indestructible Man, WP-745 / D-24568, and about 120 other WPs since the draft, incl. WP-757 Haunt, WP-794 Mastermind reduction, WP-818 Zemo, WP-827 Flying Shield Block, WP-830 Enigma Code, WP-846 seat order, WP-867 hollow strikes, WP-873 Fortify, WP-840 The Blob, WP-875 Mandarin). EC-806; **D-24602** reserved (NUMBER-LEDGER, still unconsumed; no open reserve PR). See §Gate Record.
**Reconciliation (2026-11-16):**
- **The fight lock reuses the WP-768 seam.** WP-768 settled how "attack can't fight this Mastermind" is refused: a step-1 return in `fightMastermind` beside the Haunt / guard returns, one predicate in a per-Mastermind logic module, the same predicate in `getLegalMoves` step 4 (D-24364), and the engine-written reason on `UIMastermindState.fortifiedReason`, which the live `MastermindTile` already renders as a disabled Fight button with a tooltip (`MastermindTile.vue:234-235`). Killmonger follows it: `isKillmongerAttackLocked` in the new `mastermind/killmonger.logic.ts`, a step-1 return placed after the Indestructible Man block, and a lock reason on `fortifiedReason` (a guard reason wins). **Operator fork (default taken, inform-and-proceed, the WP-768 precedent):** WP-769 deploys alone. The live Fight button is disabled with the reason; bots and server autoplay wound him; humans wound him once WP-771 ships the button. The alternative is the draft's "WP-769 and WP-771 deploy together".
- **`woundable` now carries availability, and the count is `woundCount`.** The draft's `woundable?: true` meant "is Killmonger". It now means "the wound move's board gates pass" (Killmonger, his Attack > 0, a Tactic or the Final Blow left, a Wound in the KO pile or Wound Stack), the `shuffleFight.isAvailable` lesson from the WP-768 copilot. WP-771 shows the button when it is present and gates it on attack against `fightCost`. The draft's `UIMastermindState.wounds?: number` is renamed `woundCount?: number`: it must not share a name with `MastermindState.wounds: CardExtId[]`, and UIState counts are `…Count` (`woundCount` `uiState.types.ts:458`, `woundsCount` `:1078`, `attachedBystanderCount` `:663`).
- **The Wound source is the KO pile first, then the Wound Stack** (operator default, see §Operator Decisions). Rules v23 L2217-2219 give no order ("from the Wound Stack or from the KO pile"); the draft's stack-first lock was not a rule. Stack-first decides games: Legacy Virus loses when `G.piles.wounds` runs out (`rules/schemeTwistConfigs.ts`, `resourceLossCondition: pile-depleted wounds`, D-24320; the stack is 6 × players, D-24321), checked after every move. KO-first is player-optimal and the returned Wounds refill the stack anyway. **It is the first removal from `G.ko`**, which D-24568 (WP-745) assumes is append-only: `wasHeroPutIntoKoPileThisTurn` (`hero/heroConditions.evaluate.ts:1136-1152`) reads `G.ko[koPileLengthAtTurnStart..]`. So `takeWoundForMastermind` decrements `G.koPileLengthAtTurnStart` (only when present) whenever the removed index is below it, keeping "KO'd this turn" exact; the three "append-only" comments (`types.ts:3229-3232`, `heroConditions.evaluate.ts:1136`, `game.ts:1088`) are amended (comment-only) and D-24602 records the amended premise.
- **The generic Wound helpers live in `mastermind/mastermind.logic.ts`, not a Killmonger file.** `countMastermindWounds`, `hasAvailableWound`, `takeWoundForMastermind`, `takeWoundFromMastermind` and `returnMastermindWounds` are Mastermind-generic (the bkpt "Wound the Mastermind" heroes reuse them). `mastermind.logic.ts` gains only leaf runtime imports (`setup/pilesInit` for `WOUND_EXT_ID`, `moves/zoneOps` for `moveCardFromZone`), so `economy.resolve.ts` reads the count from it with no new cycle. `killmonger.logic.ts` imports `economy.resolve`, which already reaches `fightMastermind` / `tacticHandlers` / `mastermindHandlers` transitively (through `bloodFrenzy.logic` → `scoring.logic` → `buildInitialGameState` → … → `defeatChoice.resolve`), so importing `killmonger.logic` from those files closes a runtime cycle of the D-24601 item-13 class: safe only while every imported binding is read inside a function body. Rule: no top-level read of a `killmonger.logic` binding anywhere; `tacticHandlers.ts` declares the four tactic ids as string literals (the Indestructible Man shape, `:145-154`), never from `KILLMONGER_TACTIC_ID_PREFIX`.
- **Seat order uses the D-24780 helper.** `seatsInTurnOrderFrom` (`turn/seatOrder.logic.ts:33`) replaces the draft's ad-hoc `ctx.playOrder ?? sorted` fallback for the order-sensitive strike and Rite passes. Rite of Challenge needs no "start after" special case: the defeater holds Rite by then, so the filter drops them. The Waterfall's simultaneous discard is order-free (the apply re-sorts), so its seats are passed ascending, as `buildHandDiscardChoice` documents (`seatChoiceTactics.ts:461`).
- **"Reveal 4 different Hero Classes" uses the reveal pool, not the hand alone.** Rules v23 "Revealing a Card" (L3185-3195): "You can reveal a card from your hand or you can reveal a card in front of you that you have already played this turn" (D-24651 applied the same rule to Diving Block). The strike reads `countDistinctHeroClassesYouHave` (`hero/heroConditions.evaluate.ts:875`; hand with split / dual classes, cards still in play, controlled Artifacts; D-24529 / D-24694 / D-24604 / D-24692). Controlled Artifacts count under the D-24794 reading (rules v23 L930-932: Hero Artifacts you control are Heroes you have and sit in front of you); this is accepted and recorded in D-24602. The draft's "only cards in hand count" is replaced. In practice only the current player has cards in play.
- **Killmonger's Wounds are gained through the shared interception.** `gainWoundForPlayer` (`board/wounds.logic.ts:71`) now offers Flying Shield Block (WP-827 / D-24760) whenever Diving Block is not offered; the draft's bare `checkDivingBlock` would skip it. A new `gainHeldWoundWithOutcome(G, playerID, woundCardId)` in `board/wounds.logic.ts` puts a Wound the caller already took off Killmonger into the player's discard and runs the **same** private interception helper as `gainWoundForPlayer` (refactored, byte-identical), returning a `WoundGainOutcome` so strike lines use `describeStrikeWound` (D-24673). The outcome mirrors `gainWoundWithOutcome` exactly: only a pending Diving Block reports `'diving-block-pending'`; a pending Flying Shield Block logs "gained" as it does for every other Wound today. Named residual: a Diving Block / Flying Shield Block reveal returns that Wound to the Wound Stack (`divingBlock.logic.ts:436`, `flyingShieldBlock.logic.ts:447`), not back onto Killmonger, so he ends up at +1 Attack per block where the printed rule leaves the Wound on him.
- **A Master Strike captures nothing** (D-24654). Killmonger's strike today takes the WP-867 / D-24810 hollow `else` arm; his new arm sits before it and removes that hollow. The draft's "generic Bystander capture is unchanged" is deleted. The strike needs a `scripts/coverage/strike-provenance.json` row, so the overlay-parity pin in `rules/mastermindStrike.unresolved.test.ts:275` goes 16 → 17 (a sanctioned, designed drift pin).
- **`HollowEffectRecord.cardType` includes `'mastermind'`** (`diagnostics/hollowEffect.types.ts:148`), so Altar of Resurrection records `'mastermind'`, not the draft's `'villain'` workaround. Per D-24033 reachability, it records only when the effect could do something (see §Rule locks).
- **Throw from the Waterfall's discard uses the WP-821 extraction.** `buildHandDiscardChoice` / `applyHandDiscard` (`moves/seatChoiceTactics.ts:467`, `:511`) back Fallen Idols and Computer-Uploaded Genius. The new kind `killmonger-waterfall-discard` gets exported build / apply wrappers, one branch in `applySeatChoiceByKind` (`moves/seatChoice.resolve.ts:670`, which also serves the timeout path), and one entry in the bot's least-valuable-card list (`simulation/ai.seatChoice.ts:216-226`). The client needs no change: the seat-choice prompt falls back to a generic heading.
- **His Attack is the single cost authority.** `resolveMastermindFightCost` (`economy/economy.resolve.ts:508`) now carries the Dark Portal, Storm's −2 (WP-794), Abomination (WP-815), Zemo (WP-818) and Mandarin (WP-875) terms. The Wound term is subtracted inside its 0 floor. The wound cost is that value (his printed "spend [attack] equal to his [attack]"), not the Size-Changing **fight** price `resolveMastermindFightPrice` (D-24802; Killmonger has no Size-Changing entry, so the two agree for him today). The fight at 0 pays the price, which is 0.
- **Wounding is not a fight** (rules v23 L2240-2244). The Haunt lock (WP-757), the guard lock (WP-873 / WP-840) and the Enigma guess (WP-830 / D-24763) all key on fighting the Mastermind, so none applies to `woundMastermind`. Neither does the Healing lock (D-24180), `hasActedThisTurn`, the Diamond Form edge (D-24467) or Excessive Violence (D-24556). The draft's "full `fightMastermind` block-all guard list" stays: those are the pending-choice freezes, which every action respects.
- **Excessive Violence reads the pre-defeat figure.** `fightMastermind` re-reads `getSpendableAttackForTarget` after `defeatMastermindTacticCore` (`fightMastermind.ts:350-353`), and the comments at `:318-322` and `:345-349` still say a tactic defeat fires no `onFight`, which is stale since WP-497. The EV check now uses `spendableAttack` from step 1 (`:218`), so a tactic's Fight grant (Scar's recruit under a recruit-as-attack turn, or any attack-granting tactic) can't pay the EV extra. This changes behaviour only for an EV fight whose extra 1 was affordable solely through the defeated tactic's grant; the concrete core case is Red Skull's Negablast Grenades (+3 Attack, `tacticHandlers.ts:659`).
- **The new-move lockstep is re-anchored** (`game.ts:585-615`, move count 56 → 57 at `game.test.ts:240` / `:279-281`, `SIMULATION_MOVE_NAMES` `ai.legalMoves.ts:133-275`, step 4 `:1264-1307`, `ai.competent.ts:385-400`, `simulation.runner.ts:352-357`, `par.aggregator.ts:509-514`, `replay/replay.execute.ts:200-221`, `test/fixtures/runFixture.ts:262-268`, the drift test `:204-315`, `index.ts:168` / `:291`). Server autoplay's spend filter is a deny-list (`apps/server/src/autoplay/botLoopProgress.mjs:105-126`, D-24591), so `woundMastermind` reaches the competent policy with no server change.
- **The bot never wounds under a pending Final Blow** (step 4d requires `tacticsDeck.length > 0`): step 4 never emits the Final Blow fight, so wounding then would sink Attack for nothing. A bot stricter than the move gate is FAULT-safe (D-24364 forbids only emitting what the move refuses). It also never takes the last Wound-Stack Wound under a `pile-depleted: wounds` scheme (`isSchemeLossPile`, `rules/schemeResourceLoss.ts:442`).
- **Throw from the Waterfall counts its draws** (`G.turnEconomy.cardsDrawn += drawn`, the D-24732 HYDRA Conspiracy precedent, `tacticHandlers.ts:729-732`) and logs the number actually drawn.
- **D-24737** (a card that defeats ignores fight restrictions): Silent Sniper / Pure Fury free defeats still reach Killmonger's tactics at any Attack, and the Wound return runs because it lives in `defeatMastermindTacticCore`. Recorded, no change. **D-24854** (keyword-less Ambush narration) does not apply: these are Mastermind handlers. Recorded, no change.
- **Real-data proof** uses `apps/engine-runner` (`run --scenario … --games … --seed …`), since engine tests run on a mock registry.

**Primary Layer:** Game Engine (a Mastermind state field, a new move, fight rules, strike, tactics, UIState projection, bot intents)
**Dependencies:** all merged on `main` `4de2e5301`:
- WP-497 / D-24300 (tactic `onFight` dispatch); WP-750 / D-24574 (projected fight cost); WP-684 / D-24501 (`PendingSeatChoice`); WP-476 / D-24284 (Magneto discard-to-limit); WP-821 / D-24754 (the shared hand-discard seat choice); WP-648 (new-move lockstep template); D-24591 (autoplay deny-list)
- WP-768 / D-24601 (the attack-lock seam this packet reuses); WP-757 / D-24587, WP-873 / D-24818, WP-840 / D-24773 (Haunt / guard locks and `fortifiedReason`); D-24364 (move gate ships with its `getLegalMoves` mirror)
- WP-687 / D-24504 (Final Blow); WP-736 / D-24556 (Excessive Violence); WP-830 / D-24763 (Enigma); D-24802 (Size-Changing price)
- WP-846 / D-24780 (seat order); D-24654 (no strike capture); WP-867 / D-24810 (hollow strike record); WP-682 / D-24499, D-24651, D-24673, WP-827 / D-24760 (Wound interception)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — ranked integrity: Killmonger is fought for about a third of his printed cost
**Lane:** Standard (two-session). It adds a contract field on `mastermind.types.ts`, a new move, a contract widen on `uiState.types.ts`, and new mechanics.
**Arc:** WP-769 (engine, this packet), then WP-771 (client "Wound him" button and wounds badge; its Assumes need a reconcile against this packet's projection). The sibling WP-768 shipped first.

> Baseline: reconciled on `origin/main` `4de2e5301` (#3421). Every line anchor below was read there and re-checked on `293255f4b` (WP-899 / D-24856, #3429): only the three `economy/economy.logic.ts` anchors in Assumes 4 moved; every other anchored file is byte-identical. Expected baseline (WP-768 + WP-745 merged): game-engine 7343 / 0 fail, arena-client 2726 / 0; every other package 0 fail.

---

## Goal

`bkpt/killmonger` (`data/cards/bkpt.json:575-645`, Mastermind id 85, printed Attack 5) prints:

> "While Killmonger has more than 0[icon:attack], you cannot fight him. Instead, you may spend [icon:attack] equal to his [icon:attack] to [keyword:Wound him] and get +1[icon:recruit]."
> "Master Strike: Each player must reveal 4 different Hero Classes or gain one of the [keyword:Wounds on Killmonger]. Any player who can't do either must discard down to 4 cards."

**The keyword** (`data/metadata/keywords-full.json:714`): a Wound comes from the Wound Stack or the KO pile, gives −1 Attack per Wound, and returns to the Wound Stack; "Some cards can Wound the Mastermind the same way."

**Rulebook v23 L2213-2248:**
- A Mastermind's Wounds return to the Wound Stack after a Mastermind Tactic is fought, wherever the Tactic goes; returned Wounds go on the **bottom** of the stack.
- Killmonger (5) is wounded at 5, then 4, 3, 2 and 1, getting 5 Recruit along the way. At 0 he is fought for 0, you take a Tactic, and his Wounds are removed; you get no +1 Recruit for that fight.
- Wounding can be repeated any number of times per turn. It does **not** count as a Fight: it rescues no Bystanders, and Healing is still allowed that turn.
- "Each player" effects start with the current player, then go clockwise.

**Today he is fought at a flat 5 per Tactic,** about 20 Attack in total where the printed rule needs about 60 (plus 20 Recruit back). There is no Mastermind Wound state anywhere; his strike takes the hollow arm and his tactics are inert. He is on every bkpt ranked gauntlet leg.

**After this session:**

1. **Generic Mastermind Wounds.** `G.mastermind.wounds?: CardExtId[]` (omit-when-empty). `resolveMastermindFightCost` subtracts their count inside its 0 floor for **any** Mastermind (the rule is general). The Wounds go to the bottom of `G.piles.wounds` after **every** Tactic defeat, after the Tactic's Fight text.
2. **The `woundMastermind` move** (Killmonger only): spend Attack equal to his current Attack; he takes a Wound (KO pile first, then the Wound Stack); +1 Recruit. Repeatable; not a fight.
3. **The fight lock.** A plain `fightMastermind` returns for Killmonger while his Attack is above 0, and the reason rides `fortifiedReason`. At 0 he is fought normally (no +1 Recruit).
4. **Master Strike** and three tactics (A Scar for Every Kill, Rite of Challenge, Throw from the Waterfall) resolve their text. Altar of Resurrection is a recorded hollow.
5. **Projection.** `UIMastermindState.woundCount?: number` and `woundable?: true` feed WP-771; `fortifiedReason` carries the lock.

## User-Visible Impact

Players must Wound Killmonger down to 0, gaining +1 Recruit each time, before they can take a Tactic; at 0 he is fought for free. That is roughly three times today's fight. His strikes push players to field four Hero Classes, and his tactics do what they print. With WP-769 alone, the Fight button is disabled with "Killmonger can't be fought while he has more than 0 Attack. Spend Attack equal to his Attack to Wound him and get +1 Recruit." Bots and server autoplay wound him; a human can once WP-771 ships the button.

---

## Operator Decisions

- **2026-11-16 — Lock reason reuses `fortifiedReason`; WP-769 merges alone (default taken, reconcile).** The WP-768 precedent. **Consequence, stated:** from WP-769's deploy until WP-771's, a human cannot Wound Killmonger, so a human-only Killmonger match can take no Tactic and ends only in a scheme loss; bot seats and server autoplay wound him normally. bkpt ranked gauntlet results in that window are not comparable to either side. WP-771 runs next (STATUS follow-up); Jeff can also hold the deploy until WP-771 merges. Alternative: no projected reason, deploy with WP-771.
- **2026-11-16 — Wound source: KO pile first, then the Wound Stack (default taken, reconcile; asked Jeff with this recommendation).** Rules v23 give the player the choice. KO-first never hastens a Wound-Stack loss (Legacy Virus) and returned Wounds refill the stack. Alternative: a `source` argument on `woundMastermind` (a picker in WP-771).

## Rule locks (from the rulebook and card text; no operator choice needed)

- **Wound source** (operator default). A Wound comes from the KO pile (the first `WOUND_EXT_ID`, `setup/pilesInit.ts:25`, in `G.ko`, moved with `moveCardFromZone`, `moves/zoneOps.ts:54`), else from the Wound Stack (`G.piles.wounds`, index 0, the top). If neither holds a Wound, `woundMastermind` is **not legal**.
- **Wound return.** At the end of `defeatMastermindTacticCore`, after `dispatchTacticOnFight`, every Wound still on the Mastermind is appended to `G.piles.wounds` (the bottom, rules v23 L2246) and the field is deleted. The Final Blow award (`awardMastermindOnFinalBlow`) defeats the Mastermind itself and latches the win (the turn then finishes, WP-732), so Wounds left on him are not returned; no Tactic is left and `canWoundMastermind` is false from then on.
- **Seat order** (rules v23 L2247-2248, D-24780): the strike and Rite use `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`. A null current player (stub contexts) keeps the sorted order. The Waterfall's simultaneous seat choice addresses the other seats ascending.
- **Master Strike.** For each seat in turn order:
  - `countDistinctHeroClassesYouHave(G, seat) >= 4` → unaffected (log + a `strikeBlocked` notable event, the Magneto shape);
  - else, if Killmonger holds a Wound → the first Wound leaves `G.mastermind.wounds` (delete the field when empty) and goes through `gainHeldWoundWithOutcome`; the log uses `describeStrikeWound`;
  - else → discard down to 4 (`MAGNETO_HAND_SIZE_LIMIT`): the current player parks `{ choiceType: 'discard-to-limit', playerID, limit: 4 }` when over 4; every other player over 4 auto-discards `selectDiscardToLimitCards(G, hand, hand.length − 4)` (the third argument is a **count**) through `discardCardFromHand`. A player at 4 or fewer discards nothing.
- **A Scar for Every Kill.** The defeating player gets +1 Recruit per card in their Victory Pile whose `G.villainDeckCardTypes[id] === 'villain'` (non-Henchman Villains; tactics, Bystanders and Henchmen are excluded by type), as `G.turnEconomy = addResources(G.turnEconomy, 0, count)`. 0 → a `'neutral'` log line.
- **Rite of Challenge.** For each seat in turn order whose Victory Pile holds no Killmonger tactic (`bkpt-mastermind-killmonger-` prefix), while Killmonger holds a Wound: move one to that player through `gainHeldWoundWithOutcome`. The defeater holds Rite, so they are skipped. The prefix also matches Killmonger's base card id, which reaches a Victory Pile only on the Final Blow award, after which Rite can't fire (a `// why:` line says so). Runs **before** the Wound return; whatever remains then returns.
- **Throw from the Waterfall.** The defeater draws 2 (`drawCardsIntoHand(zones, 2, shuffleContext)`; `drawn` = the hand growth; `G.turnEconomy.cardsDrawn += drawn`, D-24732; log `Fight effect: Player P drew N card(s) (Throw from the Waterfall).`). Under Venompool's draw lock (`G.turnEconomy.drawsLocked === true`, WP-731 / D-24552: "you can't draw any more cards this turn") the draw is skipped with the `'blocked'` line `Fight effect: Player P can't draw 2 card(s) — no more draws this turn (Throw from the Waterfall).`, the hero-draw precedent (`hero/heroEffects.execute.ts:1989`); the discard still happens. Then each other seat (ascending) with ≥ 1 hand card discards one card through a `PendingSeatChoice` of kind `killmonger-waterfall-discard` (`defaultOptionIndex` 0, bot = least valuable card). Solo → one `'neutral'` line.
- **Altar of Resurrection** (hollow). `recordHollowEffect(G, { cardId, cardType: 'mastermind', timing: 'onFight', mechanic: 'villain-wound', reason: 'unsupported-keyword', turn: readTacticTurn(ctx) })`, recorded only when the effect is reachable: the player on the defeater's left (the next seat clockwise) or right (the previous seat), or the defeater in solo, holds a non-Henchman Villain in their Victory Pile.
- **The fight at 0** grants no +1 Recruit (nothing in the fight path grants it).

---

## Assumes

All anchors on `4de2e5301`.

1. **`mastermind/mastermind.types.ts`** — `MastermindState` (`:17-114`) is a contract file with `strikePile`, `attachedBystanders`, optional `hypnoThralls?`, `gameText?`, `alternateFaceId?`, `faceGameText?`, `finalBlowPending?`, and **no** wound field.
2. **`moves/fightMastermind.ts`** (`fightMastermind`, `:144`):
   - Args `:146` (`useExcessiveViolence`, `enigmaGuess`, `shuffleAssassinIds`); `FightMastermindArgs` `:91-113`.
   - Step 1: Final Blow `:160` (`isFinalBlowAvailable(G.mastermind, G.finalBlow)`, `mastermind/mastermind.logic.ts:86`; that module imports only types, `:8`), empty-tactics return `:167`, Haunt `:175`, guard `:185`, Indestructible Man block `:193-204`, `mastermindAttack` / `requiredFightCost` `:211-212`, `spendableAttack` `:218`, price check `:222`.
   - Step 2: stage `:229`; block-all guards `:234-284`; `hasHealedThisTurn` `:288`; Enigma `:296-299` (gated `!isShuffleFight`); Indestructible Man resolve `:301-307`.
   - Step 3: Size-Changing log `:325-336`; Final Blow / core `:337-344`; EV `:350-353` (re-reads spendable **after** the core); spend `:360-364`; EV fire `:365-370`; `hasActedThisTurn` `:373`; Diamond Form edge `:380-382`. Stale comments `:318-322`, `:345-349`.
   - `defeatMastermindTacticCore` `:473`; `dispatchTacticOnFight` `:625`; the all-tactics log `:627-629`. `awardMastermindOnFinalBlow` `:664`.
3. **`economy/economy.resolve.ts`** — `resolveMastermindFightCost` `:508-534` (base + portal + Abomination + Zemo − Storm reduction − Mandarin, floored at 0); `resolveMastermindFightPrice` `:188-191` (the Size-Changing price over it). Other reader: `hero/heroEffects.execute.ts:5687`.
4. **Economy helpers** (`economy/economy.logic.ts`): `getSpendableAttackForTarget` `:753`, `addResources` `:801`, `spendFightCostForTarget` `:1415` (re-measured on `293255f4b`; WP-899 shifted them).
5. **No Killmonger code** exists in `packages/game-engine/src`. His strike reaches the hollow `else` (`rules/mastermindHandlers.ts` `mastermindStrikeHandler` `:1580`, the Indestructible Man arm `:1654`, hollow `else` after it). The strike and all 4 tactics are `unmarked` in `data/metadata/effect-implementation-index.json` (`:4325-4379`). Tactic ids follow `${setAbbr}-mastermind-${mastermindSlug}-${tactic.slug}` (`mastermind/mastermind.setup.ts:279`): `bkpt-mastermind-killmonger-{a-scar-for-every-kill, rite-of-challenge, throw-from-the-waterfall, altar-of-resurrection}`. The Mastermind is identified by `G.selection.mastermindId === 'bkpt/killmonger'` (the `isIndestructibleMan` shape, `mastermind/indestructibleMan.logic.ts:51`). Epic Masterminds are not selectable (D-24193).
6. **Wound supply and interception.** `G.piles.wounds` (all `WOUND_EXT_ID`, top = index 0) and `G.ko`. `gainWoundForPlayer` (`board/wounds.logic.ts:71`) lands a Wound, then `if (!checkDivingBlock(...)) checkFlyingShieldBlock(...)` (`:95-97`); `gainWoundWithOutcome` (`:125`) and `WoundGainOutcome`; `countPendingDivingBlockWounds` and `checkDivingBlock` (`moves/divingBlock.logic.ts:189`); `checkFlyingShieldBlock` (`moves/flyingShieldBlock.logic.ts:157`); a reveal returns the Wound to the stack (`divingBlock.logic.ts:436`, `flyingShieldBlock.logic.ts:447`). `moveCardFromZone` (`moves/zoneOps.ts:54`). `isSchemeLossPile(G, 'wounds')` (`rules/schemeResourceLoss.ts:442`) reports a Wound-Stack loss scheme (Legacy Virus).
7. **Strike helpers** (`rules/mastermindHandlers.ts`): `MAGNETO_HAND_SIZE_LIMIT` `:95`, `resolveCurrentPlayer` `:252`, `resolveStrikeTurn` `:280`, `selectDiscardToLimitCards` `:316` (count), `resolveMagnetoStrike` `:377` (the park / auto-discard / `strikeBlocked` shape), `discardCardFromHand` `:692`, `describeStrikeWound` `:730`; the `strikeBlocked` notable event (`events/notableEvents.types.ts:56`, `:391`). `seatsInTurnOrderFrom` (`turn/seatOrder.logic.ts:33`). `countDistinctHeroClassesYouHave` (`hero/heroConditions.evaluate.ts:875`).
8. **Tactic helpers** (`rules/tacticHandlers.ts`): `dispatchTacticOnFight` `:1606` (Indestructible Man arms `:1811-1829`); `otherSeatsClockwiseFrom` `:1843`; `resolveFallenIdols` `:2095` (park shape); `readTacticTurn` `:2598`; `recordMadMonkHollow` `:2914` (hollow shape); `addResources` import `:48`; HYDRA Conspiracy's draw counter `:722-736` (D-24732). `resolveCardName` (`log/logDisplay.ts:29`); `discardFromHand(G, playerID, cardId)` (`moves/discardFromHand.ts:198`). `drawCardsIntoHand(zones, count, shuffleContext)` (`moves/drawCards.logic.ts:53`). `recordHollowEffect` (`diagnostics/hollowEffect.record.ts:48`); `cardType` includes `'mastermind'` (`diagnostics/hollowEffect.types.ts:148`). `G.villainDeckCardTypes` (`types.ts:2977`).
9. **Seat choice.** Kinds `moves/seatChoiceTactics.ts:77-91`; `buildHandDiscardChoice` `:467` and `applyHandDiscard` `:511` (module-private, shared by Fallen Idols `:404` and Computer-Uploaded Genius); `applySeatChoiceByKind` (`moves/seatChoice.resolve.ts:670`, branches `:735-900`); `parkSeatChoice` (`:405`); bot least-valuable list (`simulation/ai.seatChoice.ts:216-226`).
10. **Lockstep sites:** `game.ts` move map `:585-615` (`client: false`); `game.test.ts` move list `:240` title + `:279-281` (56 moves); `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts:133-275`); `getLegalMoves` step 4 (`:1264-1307`, `isMastermindFightable` `:1270`, Indestructible Man branch `:1275`, plain `:1290`), 4b `:1309`, 4c `:1329`; `ai.competent.ts` scores `:87-171`, `scoreOneMove` `:385-400`; `simulation.runner.ts:352-357`; `par.aggregator.ts:509-514`; `replay/replay.execute.ts:200-221`; `test/fixtures/runFixture.ts:262-268`; `simulation/simulation.moveDispatch.drift.test.ts:204-315`; `index.ts:168-169`, `:291`.
11. **UIState.** `UIMastermindState` (`ui/uiState.types.ts:~800-859`) has `fightCost?`, `isHaunting?`, `fortifiedReason?` (WP-768 meaning: "the engine-written reason a plain Fight is refused"), `shuffleFight?`. Build: the fortify projection sets `fortifiedReason` (`ui/uiState.build.ts:836-846`; guard reason, then the Indestructible Man lock), the Mastermind object `:1259-1280`. Filter: `ui/uiState.filter.ts:715-750`. `MastermindTile.vue:234-235` disables Fight with `fortifiedReason` as the tooltip.
12. **KO pile.** Nothing removes from `G.ko` today; D-24568's `koPileLengthAtTurnStart` (`types.ts:3229-3237`, set gated at `game.ts:1088-1093` and `simulation/onBeginParity.ts:144`) and its one reader `wasHeroPutIntoKoPileThisTurn` (`hero/heroConditions.evaluate.ts:1136-1152`) rely on that.
    **Coverage feeds.** `scripts/coverage/tactic-provenance.json`, `scripts/coverage/strike-provenance.json` (overlay-parity pin `rules/mastermindStrike.unresolved.test.ts:275`, `checkedCount` 16). The WP-853 KO-site pin (`hero/ownedCardKoTrigger.test.ts:373`) counts sites that KO a card; taking a Wound **out of** `G.ko` is not one.
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is 0 fail on the baseline (measured at reconcile: game-engine 7343, arena-client 2726, server 1853 (1646 pass, 207 DB-skipped), registry 313, registry-viewer 354, dashboard 622, legends-board 138, lagn-spec 108, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4; all 0 fail).
14. **Server autoplay** offers every non-lifecycle, non-`resolve…` legal move to the competent policy (`apps/server/src/autoplay/botLoopProgress.mjs:105-126` `LOOP_DRIVEN_MOVE_NAMES` deny-list, D-24591; `autoplay.mjs` builds `createCompetentHeuristicPolicy`).
15. **engine-runner** `run --scenario <file> --games <n> --seed <s>` (`apps/engine-runner/src/cli.ts:47`) reads a MatchSetupDocument shaped like `apps/engine-runner/src/fixtures/scenario.valid.json`.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `data/cards/bkpt.json` Killmonger and tactics (`:575-645`); `data/metadata/keywords-full.json:714`; `docs/legendary-universal-rules-v23.md` L2213-2248 (Wound, Killmonger, seat order) and L3185-3195 (Revealing a Card).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and §The Move Validation Contract; `.claude/rules/architecture.md` §UIState Projection Integrity; `.claude/rules/code-style.md` (contract files need a DECISIONS entry).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 (Match Configuration, `MatchSetupConfig`, unchanged). 00.2 documents neither `MastermindState` nor `UIMastermindState`, so no 00.2 section changes.
- `docs/ai/DECISIONS.md`: D-24601 (the seam), D-24574, D-24501, D-24284, D-24754, D-24591, D-24364, D-24587, D-24818, D-24773, D-24802, D-24763, D-24504, D-24556, D-24180, D-24467, D-24780, D-24654, D-24810, D-24033, D-24499, D-24651, D-24673, D-24760, D-24529, D-24694, D-24737, D-24854, D-24119.
- WP-768 §Reconciliation (the precedent this follows).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only; Node v22+; `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves never throw; they follow the validation contract.
- No new randomness: the Waterfall draw's reshuffle uses the move's `random` through the existing `ShuffleProvider`.
- Engine only; the button is WP-771.
- Tests use `node:test` / `node:assert` only, with `makeMockCtx` / `makeMockMoveContext`; no `boardgame.io` or `boardgame.io/testing` import in tests or pure helpers.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24602) before coding. One WP per session.

**Packet-specific:**

- **`G.mastermind.wounds?: CardExtId[]`** — an append-only contract widen (D-24602). Omit-when-empty: deleted, never `[]`. Holds real Wound ids moved from the stack or KO pile.
- **Generic Mastermind Wound helpers** in `mastermind/mastermind.logic.ts` (imports types plus `WOUND_EXT_ID` and `moveCardFromZone` from leaf modules with leaf-only runtime imports; never throws). `countMastermindWounds` and `hasAvailableWound` are pure reads; the other three **mutate G in place** (the `board/wounds.logic.ts` wording), so the module header gains that note. Copy discipline (no aliasing between the old and new `MastermindState`, which share arrays through spreads): always reassign `G.mastermind = { ...G.mastermind, wounds: [...] }` (or a copy without the key), and `G.ko` / `G.piles.wounds` from the new arrays `moveCardFromZone` returns; never `.push` / `.splice` a held array.
  - `countMastermindWounds(mastermind)` (0 when absent);
  - `hasAvailableWound(G)` (KO pile or stack);
  - `takeWoundForMastermind(G)` (KO pile first, else the stack top; appends to `G.mastermind.wounds`; returns the id or null). When it removes `G.ko[index]` and `G.koPileLengthAtTurnStart !== undefined && index < G.koPileLengthAtTurnStart`, it decrements `G.koPileLengthAtTurnStart` (`// why:` D-24568's KO'd-this-turn window); the field is never created;
  - `takeWoundFromMastermind(G)` (removes the first held Wound, deletes the field when empty; returns the id or null);
  - `returnMastermindWounds(G)` (appends all to the bottom of `G.piles.wounds`, deletes the field; returns the count; a no-op when absent).
- **`mastermind/killmonger.logic.ts`** (new; pure; no boardgame.io, no registry, no `.reduce()`, never throws) holds his rules. It imports `economy.resolve` and `mastermind.logic` (neither imports it; the transitive cycle back through `economy.resolve` is safe because no importer reads its bindings at module top level). Exports:
  - `KILLMONGER_MASTERMIND_ID = 'bkpt/killmonger'`, `KILLMONGER_TACTIC_ID_PREFIX = 'bkpt-mastermind-killmonger-'`, `KILLMONGER_ATTACK_LOCK_REASON`;
  - `isKillmonger(G)`;
  - `isKillmongerAttackLocked(G, playerId)` = `isKillmonger(G) && resolveMastermindFightCost(G, playerId) > 0`;
  - `canWoundMastermind(G, playerId)` = Killmonger, (`tacticsDeck.length > 0` or `isFinalBlowAvailable`), locked (Attack > 0), `hasAvailableWound` — the board gates only.
- **Effective cost.** `resolveMastermindFightCost` subtracts `countMastermindWounds(G.mastermind)` (imported from `mastermind.logic.ts`, no cycle) inside the existing 0 floor, with a `// why:` citing the keyword and rules v23 L2213-2246. An unwounded Mastermind is byte-identical. The WP-750 projection carries it automatically.
- **Wound return.** `returnMastermindWounds(G)` runs as the last step of `defeatMastermindTacticCore`, after `dispatchTacticOnFight` and the all-tactics log, with a `// why:` (after `onFight` so Rite sees the Wounds; every defeat path, including Silent Sniper). When it returns > 0, log `Killmonger's N Wound(s) returned to the Wound Stack.` (display name via `resolveCardName`).
- **Killmonger fight lock.** In `fightMastermind` step 1, after the Indestructible Man block and before the price read: `if (isKillmongerAttackLocked(G, ctx.currentPlayer)) return;` with a `// why:`. The existing spendable check alone does **not** cover it (5 Attack would pay 5). Every other Mastermind and every Indestructible Man branch is byte-identical.
- **Excessive Violence.** The EV affordability check uses the step-1 `spendableAttack`, not a post-core re-read; the stale comments at `:318-322` and `:345-349` are corrected (tactic `onFight` runs since WP-497; Scar may grant Recruit before the spend).
- **`woundMastermind()`** (new, `moves/woundMastermind.ts`; no args; `client: false`; an `export function` declaration, hoisted, because the MOVE_MAPs read it at module top level and its import chain reaches the transitive `economy.resolve` cycle). Validation, in order, each a silent return:
  1. `canWoundMastermind(G, ctx.currentPlayer)` (Killmonger, a Tactic or the Final Blow left, Attack > 0, a Wound available).
  2. `getSpendableAttackForTarget(G.turnEconomy, 'mastermind') >= resolveMastermindFightCost(G, ctx.currentPlayer)`.
  3. `G.currentStage === 'main'`.
  4. `hasAnyPendingChoice(G)` (`moves/phaseCard.ts:82`, the shared block-all list `attemptHeist.ts:115` uses; it covers every `fightMastermind` guard `:234-284` plus the two put-bottom-HQ choices, on which `getLegalMoves` already early-returns, `ai.legalMoves.ts:1074`, `:1094`).

  It does **not** check Haunt, guard, Enigma or the Healing lock, does not set `hasActedThisTurn`, fires no Diamond Form edge and no EV (rules: "not a Fight").

  Mutation, in order: `G.turnEconomy = spendFightCostForTarget(G.turnEconomy, cost, 'mastermind')`; `takeWoundForMastermind(G)` (KO pile first); `G.turnEconomy = addResources(G.turnEconomy, 0, 1)`; log `Player P spent N Attack to Wound Killmonger and got +1 Recruit; he has W Wound(s) and A Attack now.` It rescues no Bystanders and fires no Fight text.
- **`board/wounds.logic.ts`.** Extract `gainWoundForPlayer`'s interception lines (`:95-97`) into one module-private `offerWoundInterception(G, playerID, woundCardId)`; `gainWoundForPlayer` calls it (byte-identical). Its `// why:` names the drift it prevents: the draft's bare `checkDivingBlock` would have skipped Flying Shield Block (two callers, extracted early on purpose). Add exported `gainHeldWoundWithOutcome(G, playerID, woundCardId): WoundGainOutcome` — no zones → `'no-wound'` (the caller's Wound is not dropped: it returns to the bottom of `G.piles.wounds`); else append to discard, `offerWoundInterception`, and report `'gained'` / `'diving-block-pending'` exactly as `gainWoundWithOutcome` does.
- **Strike arm** (`mastermindHandlers.ts`, module-private `resolveKillmongerStrike(G, currentPlayer)`, an `else if` before the hollow `else`; log prefix `[Killmonger Master Strike]`) per §Rule locks.
- **Tactic arms** (`tacticHandlers.ts`, four ids + dispatch branches after the Indestructible Man arms; module-private `resolveAScarForEveryKill`, `resolveRiteOfChallenge`, `resolveThrowFromTheWaterfall`, `recordAltarOfResurrectionHollow`) per §Rule locks. Log lines start `Fight effect:`.
- **Waterfall seat choice.** `KILLMONGER_WATERFALL_DISCARD_KIND = 'killmonger-waterfall-discard'`; exported `buildKillmongerWaterfallDiscardChoice(G, seats)` / `applyKillmongerWaterfallDiscard(G, choice)` wrap the shared hand-discard body (label `Throw from the Waterfall`); one `applySeatChoiceByKind` branch; one entry in the `ai.seatChoice.ts` least-valuable list.
- **Projection** (five-step):
  - `UIMastermindState.woundCount?: number` — present iff the Mastermind holds ≥ 1 Wound (any Mastermind). After the Final Blow award the Wounds stay on him (the game is won), so `woundCount` stays projected on the victory board; WP-771 hides its badge once the Mastermind is vanquished.
  - `UIMastermindState.woundable?: true` — present iff `canWoundMastermind(G, ctx.currentPlayer)` (board gates only; the client applies attack, stage and pending gates).
  - `fortifiedReason`: guard reason first, then the Indestructible Man lock, then `KILLMONGER_ATTACK_LOCK_REASON` while `isKillmongerAttackLocked` and a Tactic or the Final Blow is left.
  - Both new fields pass through the filter explicitly with a conditional spread, public to every audience, and appear in the Play Diagnostics `uiStateSnapshot`.
- **Bot.**
  - Step 4: a Killmonger branch after the Indestructible Man branch: while `isKillmongerAttackLocked`, no `fightMastermind` intent. At Attack 0 the plain branch fights him.
  - New step 4d (after 4c, so the locked order of earlier steps is unchanged): `stage === 'main' && tacticsDeck.length > 0 && canWoundMastermind(G, activePlayer) && spendable >= cost && !isLastLossPileWound(G)`, evaluated left to right (`isSchemeLossPile` reads `selection.schemeId` without `?.`, so it runs only after `canWoundMastermind`'s `?.`-guarded Killmonger check) → one `{ name: 'woundMastermind', args: {} }`, where `isLastLossPileWound(G)` (module-private in `ai.legalMoves.ts`) = `isSchemeLossPile(G, 'wounds')`, no Wound in `G.ko`, and `G.piles.wounds.length <= 1`. Every emitted intent commits (D-24364); the bot is deliberately stricter than the move (no Final Blow wounding, no self-inflicted Wound-Stack loss).
  - `ai.competent`: `SCORE_WOUND_MASTERMIND_BASE = 110` (above a plain fight-villain 100, below every bonus fight and fightMastermind 1500; each Wound progresses toward a Tactic and returns 1 Recruit). D-24602 records the trade-off: plain villains may go unfought while the bot wounds, and T14 records `winRate` beside `averageTurns`.
  - The sim and PAR terminate on a Killmonger board.
- **Determinism.** No new randomness. `wounds` is omit-when-empty; every non-Killmonger match is byte-identical except an Excessive Violence fight whose extra 1 was affordable only through the defeated tactic's grant (Negablast Grenades). Pre-WP-769 Killmonger logs won't re-execute identically on the new engine (D-24119): a `fightMastermind` at Attack 5 becomes a silent no-op, so a re-verified score diverges. D-24602 records it, and the PR restates it for the competitive-score owner (the WP-768 precedent); a fail-closed ranked policy for such matches is a server follow-up, not this packet.

## Locked Values

- Mastermind id `bkpt/killmonger`; tactic prefix `bkpt-mastermind-killmonger-`.
- Wound source: KO pile first, then the Wound Stack top; returns to the stack bottom.
- Contract field `MastermindState.wounds?: CardExtId[]`.
- Move `woundMastermind()`; bot score `SCORE_WOUND_MASTERMIND_BASE = 110`; step 4d (Tactics left, no Wound-Stack self-loss).
- Lock reason (verbatim): `Killmonger can't be fought while he has more than 0 Attack. Spend Attack equal to his Attack to Wound him and get +1 Recruit.`
- Seat-choice kind `killmonger-waterfall-discard`.
- Projection `UIMastermindState.woundCount?: number`, `UIMastermindState.woundable?: true`; `fortifiedReason` precedence: guard, Indestructible Man lock, Killmonger lock.
- Hollow `{ cardType: 'mastermind', timing: 'onFight', mechanic: 'villain-wound', reason: 'unsupported-keyword' }`, reachable-only.
- `gainHeldWoundWithOutcome(G, playerID, woundCardId): WoundGainOutcome`.
- The §Rule locks, verbatim.

---

## Scope (In)

- **A) Contract.** `mastermind/mastermind.types.ts`: `wounds?`.
- **B) Logic.** `mastermind/mastermind.logic.ts` (+ test): the generic Wound helpers. `mastermind/killmonger.logic.ts` (new) + test.
- **C) Cost.** `economy/economy.resolve.ts` (+ test): the Wound term.
- **D) Moves.** `moves/fightMastermind.ts` (+ test): the lock, the Wound return in the core, the EV read + comments. `moves/woundMastermind.ts` + test (new).
- **E) Wounds.** `board/wounds.logic.ts` (+ test): the shared interception helper and `gainHeldWoundWithOutcome`.
- **F) Strike and tactics.** `rules/mastermindHandlers.ts` (+ test); `rules/tacticHandlers.ts` (+ test); `moves/seatChoiceTactics.ts` (+ test), `moves/seatChoice.resolve.ts` (+ test), `simulation/ai.seatChoice.ts` (+ test).
- **G) Move lockstep.** `game.ts`, `game.test.ts`, `index.ts`, `simulation/ai.legalMoves.ts` (+ test), `simulation/ai.competent.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts`.
- **H) UIState five-step.** `ui/uiState.types.ts`, `ui/uiState.build.ts` (+ test), `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`.
- **I) Feeds.** `scripts/coverage/tactic-provenance.json` (Scar, Rite, Waterfall `executable`), `scripts/coverage/strike-provenance.json` (the strike `executable`); regenerate `data/metadata/effect-implementation-index.json`. `docs/ai/coverage/runtime-observed-hollows.json` and `scripts/coverage/hero-effect-coverage.baseline.json` are regenerated **only if** their `:check` moves.
- **J) Tests** (Test Contract below). Homes: the move-level T2-T4 in `moves/woundMastermind.test.ts`; T1, T5, T7, T8, T9's strike / tactic arms and T12's intent cases in `mastermind/killmonger.logic.test.ts` (the WP-768 single-file shape); generic helpers in `mastermind/mastermind.logic.test.ts` (including: snapshot, a Hero KO'd this turn, a Wound taken from before the snapshot → `wasHeroPutIntoKoPileThisTurn` still true, and an absent snapshot stays absent; each mutating helper asserts the previous `G.mastermind.wounds` / `G.ko` / `G.piles.wounds` arrays are unchanged — no aliasing); T6 in `economy/economy.resolve.test.ts`; T9's Waterfall build / apply / timeout beside Fallen Idols in `moves/seatChoiceTactics.test.ts` and `moves/seatChoice.resolve.test.ts`; T10 in `moves/fightMastermind.test.ts`; T11 in `ui/uiState.build.test.ts` + `ui/uiState.filter.test.ts`; T12's score and seeded-sim case in `simulation/ai.competent.test.ts`; T13 in `game.test.ts`, `moves/recruitSidekick.test.ts` + the drift test; the interception in `board/wounds.logic.test.ts`. A listed `+ test` file with nothing to add stays untouched.

## Out of Scope

- The client button and badge (WP-771). WP-771's Assumes must be reconciled to the `woundCount` name (the draft said `wounds`; its badge is hidden once the Mastermind is vanquished, since `woundCount` persists after the Final Blow award), `woundable`'s availability meaning, the `fortifiedReason` lock, and the WP-770 note that `MastermindTile.vue` checks cost (`:216-219`) before `fortifiedReason` (`:234-235`), so a short-Attack player sees the shortfall reason (the button stays disabled). WP-771 may add a heading for `killmonger-waterfall-discard`.
- Altar of Resurrection, and the Killmonger's League villain Wounds (Preyy, Malice, Baron Macabre, Venomm): they need a per-City-Villain Wound map, a −Attack term in `resolveFightCost`, a `woundVillain` move and a Victory-Pile-Villain re-entry. Named follow-up WP.
- The bkpt heroes that "Wound the Mastermind" (`bkpt.json:180, 482, 531`); they can reuse `takeWoundForMastermind`. Named follow-up.
- A Diving Block / Flying Shield Block reveal against a Killmonger Wound returns it to the Wound Stack rather than leaving it on him. Named residual.
- Bots never strike the Final Blow (step 4 requires `tacticsDeck.length > 0`; pre-existing, unchanged).
- Epic Killmonger (not selectable, D-24193). Server changes.

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.types.ts` — modified (contract; D-24602)
- `packages/game-engine/src/mastermind/mastermind.logic.ts` + `mastermind.logic.test.ts` — modified (generic Mastermind Wound helpers)
- `packages/game-engine/src/mastermind/killmonger.logic.ts` + `killmonger.logic.test.ts` — **new** (his rules; most of the Test Contract)
- `packages/game-engine/src/moves/woundMastermind.ts` + `woundMastermind.test.ts` — **new** (the move)
- `packages/game-engine/src/economy/economy.resolve.ts` + `economy.resolve.test.ts` — modified (the Wound term)
- `packages/game-engine/src/moves/fightMastermind.ts` + `fightMastermind.test.ts` — modified (lock, Wound return, EV read)
- `packages/game-engine/src/board/wounds.logic.ts` + `wounds.logic.test.ts` — modified (shared interception, held-Wound gain)
- `packages/game-engine/src/types.ts` (`:3229-3232`) and `hero/heroConditions.evaluate.ts` (`:1136`) — comment-only: the KO pile is append-only except Mastermind Wounds taken from it, which keep the snapshot exact (D-24602); `game.ts` `:1088` gets the same comment edit
- `packages/game-engine/src/rules/mastermindHandlers.ts` + `mastermindHandlers.test.ts` — modified (strike arm)
- `packages/game-engine/src/rules/tacticHandlers.ts` + `tacticHandlers.test.ts` — modified (three arms + Altar hollow)
- `packages/game-engine/src/moves/seatChoiceTactics.ts` + `seatChoiceTactics.test.ts`, `moves/seatChoice.resolve.ts` + `seatChoice.resolve.test.ts` — modified (the Waterfall kind)
- `packages/game-engine/src/simulation/ai.seatChoice.ts` + `ai.seatChoice.test.ts` — modified (bot discard pick)
- `packages/game-engine/src/game.ts` (move map), `game.test.ts` (list 56 → 57 + registration), `index.ts` (export) — modified
- `packages/game-engine/src/moves/recruitSidekick.test.ts` — one sanctioned value edit: the T15 move-count pin 56 → 57 (`:359`), its `// why:` appending "WP-769 / D-24602 added woundMastermind (56 → 57)"
- `packages/game-engine/src/simulation/ai.legalMoves.ts` + `ai.legalMoves.test.ts` (names list, step 4 branch, step 4d), `simulation/ai.competent.ts` + `ai.competent.test.ts` (score, seeded sim), `simulation/simulation.runner.ts` and `simulation/par.aggregator.ts` (MOVE_MAP entries), `simulation/simulation.moveDispatch.drift.test.ts` (drift pin), `replay/replay.execute.ts` (replay MOVE_MAP), `test/fixtures/runFixture.ts` (fixture MOVE_MAP) — modified
- `packages/game-engine/src/ui/uiState.types.ts` (contract; D-24602), `ui/uiState.build.ts` + `uiState.build.test.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified (`woundCount`, `woundable`, the lock reason)
- `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts` — one sanctioned value edit: the overlay-parity `checkedCount` 16 → 17 (`:275`), its `// why:` appending "+ Killmonger (WP-769 / D-24602) = 17"
- `packages/game-engine/src/hero/ownedCardKoTrigger.test.ts` — **only if** a KO site is added (none is planned); a sanctioned `LOCKED_TABLE` row, the WP-768 shape
- `scripts/coverage/tactic-provenance.json`, `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` — modified / regenerated
- `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` — regenerated only if their `:check` moves
- `docs/ai/coverage/live-verify.json` — one `pending` row (added at execution)
- Governance: `docs/ai/DECISIONS.md` (D-24602), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/post-mortems/01.6-WP-769-killmonger-mastermind.md` (new)

About 42 code and data files: a new move carries its full lockstep set (~10 files), the UIState five-step spans four, and half of all files are tests.

## Contract

- The Locked Values above. WP-771 consumes `woundCount`, `woundable`, the `fortifiedReason` lock and `woundMastermind`.
- `countMastermindWounds`, `hasAvailableWound`, `takeWoundForMastermind`, `takeWoundFromMastermind`, `returnMastermindWounds` (`mastermind.logic.ts`) and `gainHeldWoundWithOutcome` are reusable by the named follow-ups.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism and replay), §23 / §24 (ranked integrity: roughly three times today's effort), §26 (simulation-calibrated PAR: bot step 4d and a new score change bkpt PAR).
**Conflict assertion:** none.
**Non-Goal proximity:** none of NG-1..NG-7 crossed.
**Determinism:** no new randomness; the new field is omit-when-empty; core oracles unchanged. Non-Killmonger behaviour changes only for the Excessive Violence pre-defeat read (Negablast Grenades). The replay / D-24119 note is in D-24602.

## Funding Surface Gate

§20 **N/A**: engine-only rules, a state field, a move and UIState fields. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Test Contract

- **T1** Lock: Killmonger at Attack 5, 4 and 1 with 99 attack, with and without `useExcessiveViolence` → plain `fightMastermind` changes nothing (deep-equal G). At Attack 0 (5 Wounds) it defeats a tactic, spends 0, grants no Recruit.
- **T2** Wound: each call spends exactly his Attack, moves one Wound onto him and grants +1 Recruit; five calls go 5 → 4 → 3 → 2 → 1 → 0 with 15 Attack spent and +5 Recruit; a sixth is refused.
- **T3** Wound source: a `pile-wound` in `G.ko` is used first (the KO pile shrinks, the stack does not); with none in `G.ko` the stack top moves; with neither the move is refused (G unchanged).
- **T4** Refused, G unchanged: not Killmonger; Attack already 0; short attack; not `main`; a block-all pending; no Tactic and no Final Blow left. Allowed: after `healWounds` this turn; while haunting or guarded; with an Enigma code. `hasActedThisTurn` is not set.
- **T5** Wound return: a fight at 0 returns every Wound to the bottom of the stack after the tactic's Fight; Silent Sniper's free defeat returns them too; the field is deleted, never `[]`; an unwounded Mastermind's defeat is byte-identical (no log line).
- **T6** Cost: `resolveMastermindFightCost` minus the Wound count, floored at 0, combined with a Dark Portal and Storm's −2; an unwounded Mastermind unchanged; `fightCost` projection follows.
- **T7** Final Blow: the 4th tactic returns the Wounds and latches the Final Blow; wounding is legal again; at 0 the Final Blow fight awards the card.
- **T8** Strike: a seat with 4 classes across hand + play + controlled Artifacts (dual-class counts both; a split card in hand counts both halves) is unaffected with a `strikeBlocked` event; else gains one of his Wounds in turn order (current player first) until they run out; else discards to 4 (current parks `discard-to-limit` limit 4; others auto-discard `hand.length − 4`; a hand ≤ 4 discards nothing); a Diving Block holder gets the interception and the log says "would gain"; a Flying Shield Block holder gets its interception and the log says "gained" (pinned as-is, the `gainWoundWithOutcome` parity); no hollow record; no Bystander capture.
- **T9** Tactics: Scar counts only `villainDeckCardTypes === 'villain'` cards (0, 1, 3; a Henchman and a Bystander excluded); Rite gives Wounds in turn order to seats with no Killmonger tactic, before the return, and the rest return; Waterfall draws 2 (reshuffling an empty deck; `turnEconomy.cardsDrawn` grows by the number drawn; a 1-card deck with an empty discard logs 1; under `drawsLocked` it draws 0, logs `'blocked'` and still parks the discard) and parks `killmonger-waterfall-discard` for the other seats with cards, ascending (solo: neutral line); applying it discards each chosen card through `discardFromHand`; the timeout default discards index 0; Altar records its hollow only when reachable.
- **T10** EV: Red Skull with Negablast Grenades on top, exactly the fight cost in Attack and `useExcessiveViolence` → the fight succeeds, EV declines (no extra spend, `excessiveViolenceUsedThisTurn` unset); with cost + 1 before the fight, EV fires as before.
- **T11** Projection: `woundCount` present iff ≥ 1 Wound (including after the Final Blow award); `woundable` present iff `canWoundMastermind`; `fortifiedReason` is the Killmonger reason while locked, a guard reason wins, absent at 0 and after the vanquish; both new fields survive every audience; absent for every other Mastermind.
- **T12** Bot: no `fightMastermind` for him while locked; one `woundMastermind` when Tactics are left and the move gate passes; none under a pending Final Blow; none when it would take the last Wound-Stack Wound under Legacy Virus with no KO-pile Wound (but one when a KO-pile Wound exists); every emitted intent commits when dispatched (mirror test); `ai.competent` scores it 110; a seeded 1p Killmonger sim terminates.
- **T13** Lockstep: move list 56 → 57 (`game.test.ts` and the `recruitSidekick.test.ts` T15 count); `SIMULATION_MOVE_NAMES` and both sim MOVE_MAPs, the replay map and `runFixture` include `woundMastermind` (drift test); `client: false`.
- **T14** Real data (engine-runner, recorded in the PR and post-mortem, not a committed test): the seeded 1-player Killmonger scenario exits 0 (all games terminate) on baseline and branch, and the branch's summary line differs from the baseline's (Killmonger's rules are live on real card data); `winRate` and `averageTurns` recorded side by side with no threshold (a harder Killmonger can shorten games through scheme losses).

## Acceptance Criteria

1. While Killmonger's Attack is above 0, plain `fightMastermind` changes nothing and the bot never emits it; at 0 it defeats a tactic with no Recruit (T1, T12).
2. `woundMastermind` spends exactly his Attack, takes a Wound (KO pile, then stack), grants +1 Recruit, is repeatable 5 → 0, is refused per T4 and allowed after Healing (T2, T3, T4).
3. Every tactic defeat returns his Wounds to the bottom of the Wound Stack after the tactic's Fight text (T5, T7).
4. The strike falls back from 4 classes, to one of his Wounds, to a discard down to 4; Scar grants +1 Recruit per non-Henchman Villain; Rite hands out his Wounds before the return; the Waterfall draws 2 (0 under the draw lock) and parks its discard; Altar records its hollow only when reachable (T8, T9).
5. The EV check reads the pre-defeat figure (T10).
6. `woundCount`, `woundable` and the `fortifiedReason` lock project per rule and survive the audience filter; `fightCost` reflects the Wounds (T6, T11).
7. Every lockstep pin is green; bot intents mirror the gate; a seeded 1p sim terminates; the engine-runner branch run exits 0 with a summary different from the baseline's (T12, T13, T14).
8. Checks: `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check`, `cards:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `spike:local-bundle --check` 0; hash oracles unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm -r --no-bail test` → 0 fail (paste every package's totals).
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm gauntlet:loadouts:check && pnpm cards:check && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm spike:local-bundle --check` → 0.
5. From the repo root: `node --import ./apps/engine-runner/node_modules/tsx/dist/loader.mjs apps/engine-runner/src/index.mjs run --scenario <scratchpad>/wp769-scenario.json --games 5 --seed wp769`, where the scenario is a MatchSetupDocument shaped like `apps/engine-runner/src/fixtures/scenario.valid.json` with `expansions: [core, bkpt]`, `mastermindId: bkpt/killmonger`, `villainGroupIds: [bkpt/killmongers-league]`, `henchmanGroupIds: [core/doombot-legion]`, scheme `core/midtown-bank-robbery`, heroes `core/spider-man, core/hulk, core/wolverine, core/black-widow`, 1 player, 30 Bystanders / Wounds / Officers, 12 Sidekicks. Run on the baseline and on the branch; exit 0 both times; record `winRate` and `averageTurns` side by side. Recorded at reconcile on `4de2e5301`: `{"gamesPlayed":5,"winRate":1,"averageTurns":10.8,"averageScore":24.4,"escapedVillainsAverage":0,"woundsAverage":0.2,"seed":"wp769"}`. Expected on the branch: exit 0 and a different summary; `winRate` and `averageTurns` recorded (no threshold).
6. `git diff --name-only origin/main...HEAD` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24602 Active; STATUS updated (follow-ups: WP-771 next, since humans can't Wound him until it ships; Altar + League villain Wounds; the bkpt "Wound the Mastermind" heroes; the Diving Block / Flying Shield Block +1 Attack residual; a fail-closed ranked policy for pre-deploy Killmonger matches).
- [ ] WORK_INDEX `[x]` with `[live-verify: pending]`; EC_INDEX Done; mindmap `✅` + `roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check` 0; 01.6 post-mortem.
- [ ] Two-commit topology (`EC-806:` code + data, then `SPEC:` governance).
- [ ] **D-24026 live-verify** (post-deploy, WP-769 alone): in a live Killmonger match created after the deploy, the Fight button is disabled with the lock reason while his Attack is above 0; a bot or autoplay seat wounds him (the log shows Attack spent, +1 Recruit, his Attack falling) down to 0 and then takes a Tactic, after which the Wounds return; a Master Strike resolves his branch (classes, a Wound off him, or a discard); an exported `uiStateSnapshot` shows `mastermind.woundCount`, `mastermind.woundable` and `mastermind.fortifiedReason` (UIState step 5). Allowed drivers: server autoplay (`POST /api/match/autoplay` with `setupData`) or a Workshop operator match. Record the PASS as its own `SPEC:` PR.

## Reserved Decision (lands at execution)

**D-24602 — killmonger-mastermind.** It locks: the generic `MastermindState.wounds` contract field (omit-when-empty), the generic helpers in `mastermind.logic.ts` (three mutate G in place, copy discipline; the KO-pile removal amends D-24568's append-only premise and keeps `koPileLengthAtTurnStart` exact), and the −1-per-Wound term in `resolveMastermindFightCost`; the Wound return to the bottom of the stack after every tactic, after `onFight`, on every defeat path, but not on the Final Blow award; `woundMastermind` (not a fight: no Haunt / guard / Enigma / Healing lock, no `hasActedThisTurn`, no Diamond Form edge, no EV; KO pile before the Wound Stack (operator default; the rules give the player the choice); illegal without a Wound; cost = his Attack, not the Size-Changing price); the Killmonger fight lock and its reason on `fortifiedReason` (WP-769 merges alone, and humans can't take a Killmonger Tactic until WP-771 deploys); `woundCount` and `woundable`'s availability meaning; the strike and tactic rule locks, including the reveal pool (rules v23 "Revealing a Card", D-24651; controlled Artifacts per D-24794) and D-24780 order; the Waterfall draw counter (D-24732) and its draw-lock skip (D-24552); `gainHeldWoundWithOutcome` and the shared interception (Diving Block and Flying Shield Block), with the return-to-stack residual (Killmonger ends +1 Attack per block); the Waterfall kind; the EV pre-defeat read and its scope (Negablast Grenades); `uiState.types.ts` and `mastermind.types.ts` contract widens; the reachable-only Altar hollow; the League / hero deferrals; the bot score 110 (it may leave plain villains unfought; T14 records `winRate`) and step 4d's two deliberate restrictions; the discontinuity in bkpt ranked gauntlet results and PAR before vs after; the replay / D-24119 note (a pre-deploy Killmonger log re-executes its fights as no-ops; restated in the PR for the competitive-score owner; fail-closed ranked handling is a server follow-up).

---

## Lint Gate Self-Review (00.3)

- §1 all sections present; §2 boilerplate + protocol; §3 Assumes re-anchored on `4de2e5301` with paths and lines; §4 cited with sections and rulebook lines; §5 ~42 files, closed allowlist with per-line purpose, justified; §6 canonical names; §7 dependencies all merged; §8 engine only; §9 pnpm; §10–11 N/A; §12 `node:test`; §13 exact commands with expected output; §14 8 binary ACs; §15 DoD + D-24026; §15.2 Risk Tier MEDIUM (WP + EC); §16 00.6, contract fields have a DECISIONS entry; §17 clauses (incl. §26) + NG line; §18–19 N/A; §20–21 N/A with reasons.

## Gate Record

**2026-09-26 draft gates (superseded by the reconcile):** 01.4 round 1 DO NOT EXECUTE YET (PS-1..5, RS-1..4 fixed: seat order, the step-0 victory gate, Diving Block, the hollow `cardType`, the discard count, the Waterfall mirror, the EV re-read, D-24602 scope, step 5); 01.7 round 1 RISK, resolved; CONFIRM by an independent subagent after the `playOrder` fallback fix.

**2026-11-16 re-gate (on `4de2e5301`):** rounds recorded below.

**Round 1 (independent subagents, 2026-11-16):**
- **01.4 pre-flight: READY TO EXECUTE, conditional.** All 13 Assumes anchors held except step 4's start (`:1264`, fixed). Conditions applied: (1) the deploy-alone consequence stated in §Operator Decisions and D-24602; (2) `seatChoiceTactics.test.ts` / `seatChoice.resolve.test.ts` added to the allowlist and test homes named; (3) the Waterfall draw counter (D-24732); (4) no import cycle (generic helpers moved to `mastermind.logic.ts`); (5) `winRate` recorded in T14 and the score-110 trade-off in D-24602. Nits applied: Wound-source note, Artifacts via D-24794, ascending Waterfall seats, the Final Blow wording, Negablast Grenades as T10. WP-770's stale WORK_INDEX row is out of scope (separate fix).
- **01.7 copilot: HOLD (RISK).** Seven fixes applied: (1) the Wound source is KO pile first (operator default, asked Jeff) plus a bot guard against a self-inflicted Legacy Virus loss, T3 / T12 updated; (2) the import cycle (as pre-flight 4); (3) `UIMastermindState.wounds` renamed `woundCount`; (4) the pre-deploy Killmonger replay divergence stated in D-24602 and the PR, fail-closed ranked handling named as a server follow-up; (5) the human-only consequence stated; (6) step 4d requires Tactics left (no Final Blow sink); (7) the block residual names +1 Attack, and T8 pins the Flying Shield Block "gained" wording.
- **00.3 lint: FAIL.** Four fixes applied: §13 / §14 T14 and AC 7 reworded to what engine-runner prints; §5 the two seat-choice test files added; §3 anchors for `isFinalBlowAvailable`, `resolveCardName`, `discardFromHand`, `checkFlyingShieldBlock`, `strikeBlocked`, and Assumes 14 (the autoplay deny-list); EC exact script names and `roadmap:counts:check`, with the extra checks added to AC 8 and Verification 4. Recommendations applied: §26, the Determinism line, the `offerWoundInterception` `// why:`, the test-import line, per-line allowlist purposes.

**Round 2 (independent subagents, 2026-11-16):**
- **00.3 lint: PASS.** Five consistency fixes applied: EC Assumes range 1-15; the conditional `ownedCardKoTrigger.test.ts` in EC Files to Produce; T2-T4 homed in `moves/woundMastermind.test.ts`; the boolean helper named `isLastLossPileWound`; `G.turnEconomy = …` assignments for both economy calls (and Scar). Recommendations applied: 00.2 §7, engine-runner as Assumes 15, AC 4 names one observable per arm.
- **01.7 copilot: HOLD (RISK).** Three fixes applied: (1) `moves/recruitSidekick.test.ts:359` T15 move-count pin 56 → 57 added to the allowlist, the sanctioned pin edits and T13; (2) the three Wound helpers that move cards are labelled "mutate G in place" with a copy discipline (reassign, never `.push` a held array) and a non-aliasing test; (3) assignments locked, and the Waterfall honours Venompool's draw lock (D-24552: `'blocked'` line, draw 0, the discard still parks; T9 case).
- **01.4 pre-flight: READY TO EXECUTE** on PS-1 (the same `recruitSidekick.test.ts` pin, applied). Risks / nits applied: (2) the transitive `economy.resolve` cycle recorded as the D-24601 item-13 class, tactic ids as literals, no top-level reads; (3) `mastermind.logic.ts` gains leaf runtime imports and a mutation note; (4) `woundMastermind` gates on `hasAnyPendingChoice`; (5) step 4d's evaluation order; (6) T14 / AC 7 no longer predict a direction; (7) the Rite prefix `// why:`.
- **01.4 Empirical Scaffold (observed run, 2026-11-16).** Prototype on this worktree (reverted after): the Killmonger lock in `fightMastermind`, the Wound term in `resolveMastermindFightCost`, and a stub `woundMastermind` registration. `pnpm --filter @legendary-arena/game-engine test`: 7343 tests, 7340 pass, **3 fail**, all expected registration pins already in scope: `game.test.ts` "defines moves" (56), `moves/recruitSidekick.test.ts` T15 (56), and the replay-map equality guard in `simulation/simulation.moveDispatch.drift.test.ts` (fixed by `replay/replay.execute.ts`). No fixture fights Killmonger; the lock and cost term broke nothing else.

**Round 3 (independent subagent, 2026-11-16; the first run stalled with no output and was relaunched):**
- **01.7 copilot: HOLD (RISK).** One finding: the KO-pile-first Wound source is the first removal from `G.ko`, which would shift D-24568's "Hero KO'd this turn" window (`wasHeroPutIntoKoPileThisTurn`) and drop a Rage bonus. Fixed: `takeWoundForMastermind` decrements `koPileLengthAtTurnStart` (when present) for a removed index below it; a `mastermind.logic.test.ts` case; the three "append-only" comments amended (comment-only, allowlisted); D-24602 records it. Nit applied: "leaf-only runtime imports" wording. Everything else re-verified PASS (lock order, Final Blow, EV, bot / autoplay termination, pins, interception, every WP-768 branch).

**Round 4 (independent subagent, 2026-11-16):**
- **01.7 copilot: CONFIRM.** Re-verified against the code: the only index reader of `G.ko` stays exact with the decrement; every `G.piles.wounds` reader is length-only; every `G.mastermind` rebuild spreads; every Tactic defeat path runs the return after `onFight`; `hasAnyPendingChoice` covers the fight guards and `getLegalMoves` returns early on each; Healing stays legal; autoplay and the deny-list need no change; leaf imports; every WP-768 branch intact; WP and EC agree. Two nits applied as wording: `woundMastermind` is an `export function` declaration (hoisted; TDZ-safe in the MOVE_MAPs), and `woundCount` persists after the Final Blow award (WP-771 hides the badge when vanquished; T11).

**Re-gate result:** 01.4 READY TO EXECUTE (round 2, with the observed Empirical Scaffold run) · 01.7 CONFIRM (round 4) · 00.3 PASS (round 2; later rounds changed wording only inside already-linted sections).
