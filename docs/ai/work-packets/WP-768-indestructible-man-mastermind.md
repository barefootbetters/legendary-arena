# WP-768 — Indestructible Man: the Elite Assassin shuffle-fight, Master Strike and tactics (Game Engine)

**Status:** Draft 2026-09-26; **reconciled and re-gated 2026-11-16** on `main` `b93e6d6ca` (about 120 WPs after the draft, incl. WP-757 Haunt, WP-830 Enigma Code, WP-838 Baron Strucker, WP-846 seat order, WP-867 hollow strikes, WP-873 Fortify, WP-840 The Blob, WP-897 narration). EC-805; **D-24601** reserved (NUMBER-LEDGER, still unconsumed). See §Gate Record.
**Reconciliation (2026-11-16):**
- **Fight lock reuses the Haunt / Fortify / Blob seams.** WP-757, WP-873 and WP-840 settled how a Mastermind fight is refused: a board-state return near the top of `fightMastermind`, one predicate, the same predicate at `getLegalMoves` step 4 (D-24364), and an engine-written reason on `UIMastermindState.fortifiedReason` that the live `MastermindTile` already renders as a disabled Fight button with a tooltip. Indestructible Man is not "guarded" (he can still be fought, by the shuffle), so he does **not** join `isMastermindGuarded`. His attack lock gets its own predicate in the new logic module, sits in the same step-1 block, and **projects its reason through the existing `fortifiedReason` channel** (a guard reason wins when both apply). Effect: the moment WP-768 deploys, the live Fight button is disabled with "You can't use Attack to fight Indestructible Man…" instead of being a dead button. WP-770 is no longer needed to make the board honest; it adds the chooser. **Operator fork (default taken, inform-and-proceed):** the alternative is the draft's "no reason; deploy WP-768 and WP-770 together".
- **The four MOVE_MAPs already forward `args`** to `fightMastermind` (`simulation.runner.ts:359`, `par.aggregator.ts:516`, `test/fixtures/runFixture.ts:242`, `replay/replay.execute.ts:208`; WP-830 needed them for `enigmaGuess`). Draft PS-1 is obsolete and the four files leave scope.
- **Not the first mid-game Villain-Deck shuffle-in.** WP-838 / D-24771 (Baron Strucker) shuffles supply Bystanders in via `shuffleDeck([...deck, ...moved], shuffleContext)` (`villain/villainEffects.execute.ts:7058`). The helper follows that precedent and takes a `ShuffleProvider`, not a bare function.
- **`fightMastermind` grew** the Haunt lock (`:157`), the guard lock (`:167`), the Size-Changing price (`:176-177`, D-24802), the Enigma guess (`:259-262`, WP-830 / D-24763) and the Excessive Violence opt-in (`:305-325`). The shuffle-fight passes through all the structural gates, pays its Assassins as the cost **before** an Enigma guess is settled, and skips every attack read and write.
- **Each-player order is current player first, then clockwise** (WP-846 / D-24780, `seatsInTurnOrderFrom`), not ascending seats. Wounds go through `gainWoundWithOutcome` / the strike's `gainWoundToDiscard` (Diving Block window, D-24673 wording).
- **A Master Strike captures no Bystander** (D-24654), and an unhandled strike now records a hollow (WP-867 / D-24810). Today Indestructible Man's strike takes that hollow arm; his new arm removes it. The draft's "generic Bystander capture stays unchanged" is deleted.
- **`HollowEffectRecord.cardType` now includes `'mastermind'`** (`diagnostics/hollowEffect.types.ts:148`), so Mad Monk records `'mastermind'`, not the draft's `'villain'` workaround. Per the D-24033 reachability rule, the hollow is recorded only when Mad Monk is **not** the last Tactic (his printed Fight does nothing otherwise).
- **Coverage feeds:** the strike needs a `scripts/coverage/strike-provenance.json` row too (the file post-dates the draft).
- **International Arms Dealer gains** through the WP-692 filtered queue, which skips Haunted HQ Heroes (`giveHqHeroChoice.resolve.ts:139`). "Gain" should reach a Haunted Hero (D-24587); this is a named residual (only a Haunt villain group plus Indestructible Man can produce it). `freeRecruitFromHqByFilter` gains an optional trailing verb so its log says "gain" for this tactic and stays byte-identical for Dark Technology and Bitter Captor.
- **D-24854** (keyword-less Ambush narration) does not apply: the strike and tactics are Mastermind handlers, not villain-ability descriptors. Villain cards played by the "play two" clause narrate through the normal reveal. Recorded, no change.
- **D-24737** (a card that defeats ignores fight restrictions): Silent Sniper / Pure Fury free defeats still reach Indestructible Man's tactics through `defeatMastermindTacticCore`. Recorded, no change.
- **Real-data proof** of "no turn-1 win" uses `apps/engine-runner` (`run --scenario … --games … --seed …`), since engine tests run on a mock registry.

**Primary Layer:** Game Engine (fight rules, strike, tactics, UIState projection, bot intents)
**Dependencies:** all merged on `main` `b93e6d6ca`:
- WP-497 / D-24300 (tactic `onFight` dispatch); WP-692 / D-24509 (filtered HQ gain queue); WP-750 / D-24574 (projected fight cost); WP-765 / D-24598 (`victoryPointValueForCard`)
- WP-687 / D-24504 (Final Blow); WP-736 / D-24556 (Excessive Violence); WP-830 / D-24763 (Enigma guess)
- WP-757 / D-24587 (Haunt lock), WP-873 / D-24818 + WP-840 / D-24773 (`isMastermindGuarded`, `fortifiedReason`), D-24364 (move gate ships with its `getLegalMoves` mirror)
- WP-838 / D-24771 (shuffle into the Villain Deck), WP-846 / D-24780 (seat order), D-24654 (no strike capture), WP-867 / D-24810 (hollow strike record)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — ranked integrity: closes a free leaderboard win
**Lane:** Standard (two-session). It adds a move argument, a turn flag, a UIState field and new mechanics.
**Arc:** WP-768 (engine, this packet), then WP-770 (client chooser; its Assumes need a reconcile against this packet's projection). Sibling WP-769 (Killmonger) also edits `fightMastermind`, so it runs **after** this packet, not in parallel.

> Baseline: reconciled on `origin/main` `b93e6d6ca` (#3414). Every line anchor below was read there. `pnpm -r build` exits 0; `pnpm -r --no-bail test` exits 0 with game-engine 7262 / 0 fail, arena-client 2726 / 0, server 1853 (1646 pass, the rest DB-skipped) / 0, registry 313, registry-viewer 354, dashboard 622, legends-board 138, lagn-spec 108, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4.

---

## Goal

`bkwd/indestructible-man` (`data/cards/bkwd.json`, Mastermind id 88) prints:

> "You can't use [icon:attack] to fight Indestructible Man."
> "Once during each of your turns, you may shuffle two Elite Assassins from your Victory Pile into the Villain Deck. If you do, fight Indestructible Man."
> "Master Strike: Shuffle an Elite Assassin from your Victory Pile into the Villain Deck. If you can't, each player gains a Wound."

**Today he is a free win.** His printed attack is 0, `fightMastermind` has no once-per-turn cap, and the bot's `fightMastermind` intent scores highest, so any player or bot defeats all four tactics on turn 1 for 0 attack. He is on every ranked gauntlet leg for bkwd. WP-762/750 accepted this as a residual; this packet closes it.

**After this session:**

1. **Attack no longer fights him.** A plain `fightMastermind` call against Indestructible Man is refused, and the live Fight button is disabled with the engine's reason.
2. **The shuffle-fight.** `fightMastermind` gains an optional `shuffleAssassinIds` argument: the player's **own choice** of exactly 2 Elite Assassins from their Victory Pile (operator decision 2026-09-26). Once per turn, the engine validates the pick, shuffles both into the Villain Deck, and runs the normal tactic defeat (or Final Blow) with no attack spent.
3. **Master Strike.** Shuffles the current player's lowest-VP Elite Assassin into the Villain Deck; if they have none, each player gains a Wound.
4. **Tactics.** Secrets of Indestructibility, International Arms Dealer and Unveil Project Four resolve their Fight text plus "If this is not the last Tactic, play two cards from the Villain Deck". Project Four uses the operator-chosen approximation. Manipulate Murderous Mad Monk is a recorded hollow.
5. **Projection.** `UIMastermindState.shuffleFight` feeds WP-770's chooser; `fortifiedReason` carries the attack lock.

## User-Visible Impact

Indestructible Man stops being a free leaderboard win. Players bank Elite Assassins and spend two, once per turn, to hit him. His strikes and tactics do what they print. With WP-768 alone, the Fight button is disabled with "You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him." Bots shuffle-fight; a human can shuffle-fight once WP-770 ships the chooser.

---

## Operator Decisions

- **2026-09-26 — Assassins are player-chosen.** The ids arrive as move arguments (the WP-757 exorcise argument pattern), not a pending-choice queue. The bot picks the two lowest-VP Assassins, ties by `extId`.
- **2026-09-26 — Unveil Project Four is approximated.** Other players discard each hand card whose printed cost, attack, recruit or VP value, as a string, contains the digit `4`. A 4 only in rules text or art is not caught. The log says "(approximate)".
- **2026-11-16 — Lock reason reuses `fortifiedReason` (default taken, reconcile).** See the Reconciliation header. Alternative: no projected reason, deploy with WP-770.

---

## Assumes

All anchors on `b93e6d6ca`.

1. **`moves/fightMastermind.ts`** (`fightMastermind`, `:126`):
   - Args destructured at `:128` (`useExcessiveViolence`, `enigmaGuess`); `FightMastermindArgs` at `:80-95`.
   - Step 1: empty-tactics / Final Blow return `:149`, `isMastermindHaunting` `:157`, `isMastermindGuarded` `:167`, price `:176-177`, spendable check `:183-189`.
   - Step 2: stage `:194`; block-all guards `:199-249`; `hasHealedThisTurn` `:253`; Enigma well-formed + settle `:259-262`.
   - Step 3: Size-Changing log `:280-291`; `isFinalBlow → awardMastermindOnFinalBlow` else `defeatMastermindTacticCore(G, ctx, { random }, events)` `:292-299`; EV `:305-325`; spend `:315-319`; `G.hasActedThisTurn = true` `:328`; Diamond Form edge `:335-337`.
   - `defeatMastermindTacticCore` `:366` ends with `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext, events)` `:518`.
2. **No Indestructible Man code** exists in `packages/game-engine/src`. His strike reaches the WP-867 hollow `else` arm (`rules/mastermindHandlers.ts` `mastermindStrikeHandler` `:1524`, hollow arm after `:1597`). All 4 tactics and the strike are `unmarked` in `data/metadata/effect-implementation-index.json` (`:5016-5068`).
3. **Elite Assassins** (`bkwd/elite-assassins`): instance ids `bkwd-villain-elite-assassins-<card>-NN` (`villainDeck/villainDeck.setup.ts:512-515`): Blue Talon ×2 (2 VP), Iron Maiden ×2 (2), Snapdragon ×2 (2), Black Lotus ×2 (3). He Always Leads them. Their `G.villainDeckCardTypes` entries (`'villain'`) persist after a defeat, so a shuffled-in Assassin reveals as a Villain again.
4. **Per-turn state.** Guarded per-turn deletes live in `game.ts` onBegin (`:1065-1100`, e.g. `flyingShieldBlockUsedThisTurn`) and are mirrored in `simulation/onBeginParity.ts` `applyOnBeginParity` (`:66`, deletes `:116-163`). The Villain Deck is `G.villainDeck.deck`, top = index 0.
5. **Helpers.**
   - `shuffleDeck(cards, shuffleContext)` (`setup/shuffle.ts:28`); `ShuffleProvider` (`:16`).
   - `playTopVillainDeckCards(G, revealContext, implementationMap, count)` (`villainDeck/villainDeck.reveal.ts:1228`); the move-side `RevealContext` build is `fightVillain.ts:1038-1043` (`{ random, ctx: { currentPlayer, turn } }`); `DEFAULT_IMPLEMENTATION_MAP` is `rules/ruleRuntime.impl.ts:35`.
   - `resolveShuffleFunction` (`mastermindHandlers.ts:175`), `resolveCurrentPlayer` (`:244`), `resolveStrikeTurn` (`:272`), `gainWoundToDiscard` (`:708`), `describeStrikeWound` (`:722`); the Baron Zemo strike (`:955`) is the "do X from your Victory Pile or gain a Wound" shape.
   - `seatsInTurnOrderFrom` (`turn/seatOrder.logic.ts:33`); `otherSeatsClockwiseFrom` (`tacticHandlers.ts:1782`); `gainWoundWithOutcome` (`board/wounds.logic.ts:125`).
   - `freeRecruitFromHqByFilter(G, currentPlayer, filter, optional, tacticName)` (`tacticHandlers.ts:1095`); the hand Tech reveal precedent is `collectGeniusDiscardSeats` (`:2405`); Finding Zemo (`:2097`) uses `shuffleContext.random.Shuffle`.
   - `discardFromHand(G, playerID, cardId)` (`moves/discardFromHand.ts:198`); Wound KO = `koCard` + `recordOwnedCardKoed` (`moves/healWounds.ts:170-175`).
   - `victoryPointValueForCard(G, playerId, cardId)` (`economy/bloodFrenzy.logic.ts:50`).
   - `recordHollowEffect` (`diagnostics/hollowEffect.record.js`); `HollowEffectRecord.cardType` includes `'mastermind'` (`diagnostics/hollowEffect.types.ts:148`).
6. **Bot and sim.** `getLegalMoves` step 4 (`simulation/ai.legalMoves.ts:1257-1285`) emits `fightMastermind` when `stage === 'main'`, tactics remain, not haunting, not guarded, and the price is affordable (with an Enigma guess when the code holds cards). The four MOVE_MAPs already forward `args` (see Reconciliation).
7. **UIState.** `UIMastermindState` (`ui/uiState.types.ts:810-853`) has `fightCost?`, `finalBlowPending?`, `isHaunting?`, `fortifiedReason?`. `buildUIState` writes them at `ui/uiState.build.ts:1214-1241` (`fortifiedReason` from `fortifyProjection.mastermindFortifiedReason`); the filter passes them at `ui/uiState.filter.ts:714-737`. `MastermindTile.vue:234-236` disables Fight with `fortifiedReason` as the tooltip, after the cost gate and before the tactics check.
8. Tactic ids are `${setAbbr}-mastermind-${mastermindSlug}-${tactic.slug}` (`mastermind/mastermind.setup.ts:279`): `bkwd-mastermind-indestructible-man-{manipulate-murderous-mad-monk, secrets-of-indestructibility, international-arms-dealer, unveil-project-four}` (confirmed in the effect index).
9. **Other helpers and fields read** (all pure, no boardgame.io import):
   - `isFinalBlowAvailable` (`mastermind/mastermind.logic.ts`); `isMastermindHaunting` (`board/haunt.logic.ts`); `isMastermindGuarded` (`board/besideMastermind.logic.ts:115`).
   - `isEnigmaGuessWellFormed` (`rules/enigmaCode.logic.ts:318`), `settleEnigmaGuess` (`:384`), `chooseBotEnigmaGuess` (`:421`).
   - `offPlayCardTraits` (`hero/splitCard.logic.ts`); `koCard` (`board/ko.logic.ts:24`); `recordOwnedCardKoed` (`hero/deferredConditionalGrants.ts`).
   - `resolveDisplay` (module-private, `ui/uiState.build.ts:239`).
   - `G.selection.mastermindId` (`types.ts:2225`), `G.cardStats` (`:3233`), `G.cardVictoryPoints?` (`:3309`).
10. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is 0 fail on the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `data/cards/bkwd.json` Indestructible Man, his 4 tactics and Elite Assassins. The card text is the only rules authority; v23 has no ruling.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and §The Move Validation Contract; `.claude/rules/architecture.md` §UIState Projection Integrity.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 (`MatchSetupConfig`, unchanged). 00.2 documents neither G runtime flags nor `UIMastermindState`, so this packet changes no 00.2 section.
- `docs/ai/DECISIONS.md`: D-24504, D-24509, D-24556, D-24574, D-24587, D-24598, D-24654, D-24673, D-24737, D-24763, D-24771, D-24773, D-24780, D-24802, D-24810, D-24818, D-24364, D-24033, D-24119, D-24185 / D-24750 (a validated move argument that names the fight's cost).
- WP-840 §Reconciliation (the reuse precedent) and WP-757 §Contract (the argument-choice pattern).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only; Node v22+; `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves never throw; they follow the validation contract.
- All randomness goes through the move's / reveal's `random.Shuffle` (via `shuffleDeck`), with a `// why:` comment.
- Engine only; the chooser UI is WP-770.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24601) before coding. One WP per session.

**Packet-specific:**

- **Single authority — new `mastermind/indestructibleMan.logic.ts`** (the `zarathos.logic.ts` / `arnimZola.logic.ts` module shape; pure, no boardgame.io import, no `.reduce()`, never throws). Exports:
  - `INDESTRUCTIBLE_MAN_MASTERMIND_ID = 'bkwd/indestructible-man'`, `ELITE_ASSASSIN_EXT_ID_PREFIX = 'bkwd-villain-elite-assassins-'`, `SHUFFLE_FIGHT_ASSASSIN_COUNT = 2`, `INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON` (the tooltip string in §Locked Values).
  - `isIndestructibleMan(G)`: `G.selection.mastermindId === INDESTRUCTIBLE_MAN_MASTERMIND_ID`.
  - `listEligibleAssassins(G, playerId)`: that player's `victory` cards starting with the prefix, in pile order.
  - `canShuffleFight(G, playerId)`: `isIndestructibleMan`, the flag is not set, and ≥ `SHUFFLE_FIGHT_ASSASSIN_COUNT` eligible.
  - `isValidShuffleFightPick(G, playerId, ids: unknown)`: an array of exactly 2 **distinct** strings, each in `listEligibleAssassins(G, playerId)`.
  - `selectLowestVpAssassins(G, playerId, count)`: eligible Assassins sorted by `victoryPointValueForCard` ascending (null → 0), ties by `extId`, first `count`.
  - `shuffleIntoVillainDeck(G, playerId, cardIds, shuffleContext: ShuffleProvider | null)`: remove each card from that player's `victory`, then `G.villainDeck.deck = shuffleDeck([...deck, ...cards], shuffleContext)` **once** (D-24771 shape). A `null` provider is a logged `'blocked'` no-op that moves nothing (the Baron Strucker null-source precedent, `villainEffects.execute.ts:7045`); never throws. Returns whether it moved the cards.
  - `isShuffleFightOpen(G, playerId)`: `canShuffleFight` && (tactics remain || `isFinalBlowAvailable`) && `!isMastermindHaunting(G)` && `!isMastermindGuarded(G)`. Read by the projection only (the move and bot apply the same conditions in their existing order).
- **`fightMastermind` for Indestructible Man.** `FightMastermindArgs` gains `shuffleAssassinIds?: readonly CardExtId[]` (the wire payload is untrusted; the count of 2 is checked at runtime by `isValidShuffleFightPick(…, ids: unknown)`).
  - Step 1 keeps the tactics / Final Blow, Haunt and guard returns for **both** paths. Then, when `isIndestructibleMan(G)`:
    1. `shuffleAssassinIds === undefined` → **return** (attack can't fight him; at any attack value, with or without `useExcessiveViolence`).
    2. `!isValidShuffleFightPick(G, ctx.currentPlayer, shuffleAssassinIds)` → return.
    3. `!canShuffleFight(G, ctx.currentPlayer)` → return.
    4. The price / spendable-attack check is **skipped**.
  - Otherwise (any other Mastermind) the move is byte-identical; `shuffleAssassinIds` is ignored.
  - Step 2 (stage, every block-all guard, `hasHealedThisTurn`) is unchanged for both paths. The existing Enigma block (`:259-262`) is gated `!isIndestructibleMan(G)`; his path checks and settles the guess only in its own Step 3, so the guess is settled exactly once and after the cost is paid.
  - **Indestructible Man Step 3**, in this order:
    1. If the Enigma code holds cards: `isEnigmaGuessWellFormed` false → return (no mutation yet).
    2. Pay the cost: `shuffleIntoVillainDeck(G, ctx.currentPlayer, ids, { random })`; set `G.indestructibleManShuffleUsedThisTurn = true`; log the shuffle.
    3. If the Enigma code holds cards: `settleEnigmaGuess(...)` false → return (the turn ends; the Assassins stay spent: card text pays the cost before "fight", and the Enigma guess comes "when you fight").
    4. `isFinalBlow` → `awardMastermindOnFinalBlow(G, ctx)`, else `defeatMastermindTacticCore(G, ctx, { random }, events)`.
    5. No Size-Changing line, no attack spend, no Excessive Violence.
    6. `G.hasActedThisTurn = true` and the Diamond Form edge exactly as `:328-337`.
  - Step 3 for him lives in a named module-private sub-function (`resolveIndestructibleManShuffleFight`) so `fightMastermind` gains one branch, not a second screen of body (00.6 Rule 2).
- **Turn flag** `G.indestructibleManShuffleUsedThisTurn?: true`: written only when set, never seeded. A guarded `delete` clears it in **both** `game.ts` onBegin (beside the per-turn deletes at `:1065-1100`) and `applyOnBeginParity`.
- **Master Strike** — new arm in `mastermindStrikeHandler`, before the hollow `else`, calling `resolveIndestructibleManStrike(gameState, resolveCurrentPlayer(strikeContext), resolveShuffleFunction(strikeContext))` (a module-private function in `mastermindHandlers.ts`, beside Baron Zemo, so it can use `gainWoundToDiscard` / `describeStrikeWound`):
  - The current player has ≥ 1 eligible Assassin → shuffle in `selectLowestVpAssassins(G, player, 1)` through the strike's shuffle (wrapped as a `ShuffleProvider`; null when absent). Not a player choice (recorded in D-24601).
  - Otherwise (or a null current player, stub contexts only) → each player, current first then clockwise (`seatsInTurnOrderFrom`, D-24780), `gainWoundToDiscard` with the Baron Zemo log shapes; an empty supply is a logged no-op.
  - No Bystander capture (D-24654). Logs are prefixed `[Indestructible Man Master Strike]`.
- **Tactic arms** in `dispatchTacticOnFight` (4 ids, Assumes 8):
  - **Secrets of Indestructibility:** KO up to two Wounds, hand first then discard (`koCard` + `recordOwnedCardKoed`, the `healWounds.ts` pattern). Always beneficial, so no choice. Zero Wounds → `'blocked'` log.
  - **International Arms Dealer:**
    1. `freeRecruitFromHqByFilter(G, currentPlayer, { kind: 'hero-class', values: ['tech'] }, false, 'International Arms Dealer', 'gain')`: 0 eligible → logged no-op; 1 → auto-gain; ≥ 2 → parks the give-hq-hero choice.
    2. Each other player, clockwise from the defeater (`otherSeatsClockwiseFrom`): a Tech Hero in **hand** (`offPlayCardTraits` `heroClass` / `heroClass2`, the `collectGeniusDiscardSeats` rule) → reveal log; otherwise `gainWoundWithOutcome` with the Finding Zemo log shapes (Diving Block wording, D-24673). Solo → one `'neutral'` "no other player" line.
    3. Then the play-two clause.
    - **Locked order:** when the gain parks, steps 2-3 resolve before the parked gain is answered (`// why:` says so).
    - **Stale-gain drop:** the two played cards can empty the HQ's eligible Tech Heroes (an Ambush HQ removal, a hero capture, a Haunt, a Twist). `resolveGiveHqHeroChoice` assumes an eligible Hero exists (`giveHqHeroChoice.resolve.ts:266`) and a mandatory entry can't be declined (`:249`), so the board would freeze. After the play-two clause, if the entry this tactic parked is still queued and now has 0 eligible Heroes, remove it with a `'blocked'` log line (`Fight effect: no Tech Hero is left in the HQ to gain (International Arms Dealer).`). The arm finds its entry because `freeRecruitFromHqByFilter` now returns the entry it parked (or null) and the arm looks it up by identity in `G.pendingGiveHqHeroChoices`; eligibility is `collectEligibleHqIndices` (`tacticHandlers.ts:1057`). Recorded in D-24601.
  - **Unveil Project Four:** each other player, clockwise, discards (via `discardFromHand`) every hand card for which `String(G.cardStats[id]?.cost)`, `String(…attack)`, `String(…recruit)` or, when defined, `String(G.cardVictoryPoints?.[id])` contains `'4'`. No `cardStats` entry → kept. Collect each player's matching ids first, then discard them (`discardFromHand` reassigns the hand, so discarding while iterating would skip cards). Log ends "(approximate)". Then the play-two clause.
  - **The play-two clause** (those three): if `G.mastermind.tacticsDeck.length > 0` at dispatch time, build `RevealContext { random: shuffleContext.random, ctx: { currentPlayer, turn } }` (turn narrowed from `ctx`, 0 when absent) push `Fight effect: <tactic> plays the top 2 card(s) of the Villain Deck.` (the `fightVillain.ts:1034-1037` line shape), then call `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 2)`, the `fightVillain.ts:1038-1058` precedent. The last Tactic → no play and no log line. `tacticHandlers.ts` gains imports of `playTopVillainDeckCards` and `DEFAULT_IMPLEMENTATION_MAP`; this closes an import cycle (`villainDeck.reveal` → `defeatChoice.resolve` → `fightMastermind` → `tacticHandlers`), so the map is read only inside the function body, never at module top level, with a `// why:` naming the cycle and the `fightVillain.ts:85 / :1058` precedent (`ruleRuntime.execute.ts:33-36` explains why the rules layer usually avoids the map).
  - **Manipulate Murderous Mad Monk:** no arm for its effect. When **not** the last Tactic, `recordHollowEffect(G, { cardId: defeatedTacticId, cardType: 'mastermind', timing: 'onFight', mechanic: 'tactic-becomes-villain', reason: 'unsupported-keyword', turn })`. The last Tactic → nothing (its Fight is conditional; D-24033 reachability).
  - Update the module header (`tacticHandlers.ts:21-23`): the shuffle-and-reveal list now includes Indestructible Man's play-two clause.
- **`freeRecruitFromHqByFilter`** gains an optional trailing `verb: 'recruit' | 'gain' = 'recruit'`, used only in its three log lines (0 eligible `:1106`, auto-gain `:1117`, park `:1141`), and returns the parked entry or null (was `void`; no existing caller reads it). Dark Technology and Bitter Captor stay byte-identical.
- **Projection (five-step contract).**
  - `UIMastermindState.shuffleFight?: { requiredCount: number; isUsedThisTurn: boolean; isAvailable: boolean; eligibleAssassins: UIDisplayEntry[] }` (the existing `{ extId; display }` type, D-12805), present **only** when `isIndestructibleMan`. Read for the **active** player: `eligibleAssassins` = `buildDisplayEntries(listEligibleAssassins(...), G)` (`uiState.build.ts:269`), `isUsedThisTurn` from the flag, `isAvailable` from `isShuffleFightOpen`. The JSDoc says `isAvailable` covers the board and flag conditions only (Assassins, once-per-turn, tactics / Final Blow, Haunt, guard); the client still applies its stage, heal and pending-choice gates, as it does for the plain Fight.
  - `fortifiedReason`: the existing guard reason when present; otherwise, when `isIndestructibleMan` and (tactics remain or `isFinalBlowAvailable`), `INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON`. Its JSDoc is widened to name WP-768. The `isMastermindGuarded` JSDoc (`board/besideMastermind.logic.ts:105-109`, "…all read this, so they can never disagree") and the build comment (`uiState.build.ts:808-811`) are updated: `fortifiedReason` is now `isMastermindGuarded` **or** the Indestructible Man lock (JSDoc / comment edits only). WP-770 routes its shuffle button through `shuffleFight.isAvailable`, never `fortifiedReason`.
  - The filter passes `shuffleFight` through with a conditional spread and copies `eligibleAssassins` with `deepCopyDisplayEntries` (`uiState.filter.ts:226`). Public to every audience (Victory Piles are public). Audience-filter test asserts it survives for every audience. It appears in the Play Diagnostics `uiStateSnapshot` (step 5).
  - `fightCost` is still projected unchanged (`resolveMastermindFightPrice`: 0 for him unless a Dark Portal or a modifier raises it; never charged).
- **Bot (`getLegalMoves` step 4, same commit as the move gate — D-24364).** Inside the existing step-4 condition (stage / tactics / Haunt / guard), and **before** the price check (`:1270-1272`): when `isIndestructibleMan`, emit **no** plain intent and skip the price check (the move skips it too; Dark Portal or a scheme can make his price > 0); when `canShuffleFight(G, active)`, emit one `{ name: 'fightMastermind', args: { shuffleAssassinIds: selectLowestVpAssassins(G, active, 2) } }`, adding `enigmaGuess` exactly as the plain branch does (skip the intent when the code holds cards and `chooseBotEnigmaGuess` is null). Any other Mastermind: byte-identical. The step-4 guard keeps `tacticsDeck.length > 0`, so the bot never takes a Final Blow shuffle-fight; this is intended and matches the plain path today.
- **Determinism.** The only new randomness is the shuffle-in. No new `G` key, log line, intent or projection key in any match without Indestructible Man; `finalStateHash`, `PRE_WP080_HASH` and the local-spike `initialStateHash` are unchanged. Pre-WP-768 Indestructible Man replays and ranked scores won't re-execute identically (D-24119); recorded in D-24601.

## Locked Values

- Mastermind id `bkwd/indestructible-man`; Assassin prefix `bkwd-villain-elite-assassins-`; shuffle count 2 (base face; the Epic face's 3 is out of scope).
- Move argument: `fightMastermind({ shuffleAssassinIds?: readonly CardExtId[] })`, exactly 2 distinct ids at runtime.
- Flag: `G.indestructibleManShuffleUsedThisTurn?: true`.
- Lock reason (verbatim): `You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him.`
- Projection: `UIMastermindState.shuffleFight?` as above; `fortifiedReason` precedence: guard reason, then the lock reason.
- Bot and strike pick: lowest VP, ties by `extId` (bot 2, strike 1).
- The Project Four approximation rule, verbatim.
- Hollow record: `{ cardType: 'mastermind', timing: 'onFight', mechanic: 'tactic-becomes-villain', reason: 'unsupported-keyword' }`, not-last-Tactic only.
- Order: each-player / each-other-player passes start with (or after) the current player, then clockwise (D-24780).

---

## Scope (In)

- **A)** `mastermind/indestructibleMan.logic.ts` (new) + test.
- **B)** `moves/fightMastermind.ts` (+ `fightMastermind.test.ts`): the argument and the Indestructible Man path.
- **C)** `types.ts` (flag); `game.ts` and `simulation/onBeginParity.ts` (guarded delete).
- **D)** `rules/mastermindHandlers.ts` (+ test): the strike arm.
- **E)** `rules/tacticHandlers.ts` (+ test): three arms, the play-two clause, the Mad Monk hollow, the `verb` parameter, the header.
- **F)** UIState five-step: `ui/uiState.types.ts`, `ui/uiState.build.ts` (+ `uiState.build.test.ts`), `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`.
- **G)** `simulation/ai.legalMoves.ts` (+ test): the step-4 branch.
- **H)** Feeds: `scripts/coverage/tactic-provenance.json` (Secrets and Arms Dealer `executable`; Project Four `deferred`, because the approximation is a partial resolution), `scripts/coverage/strike-provenance.json` (the strike `executable`); regenerate `data/metadata/effect-implementation-index.json`. `docs/ai/coverage/runtime-observed-hollows.json` and `scripts/coverage/hero-effect-coverage.baseline.json` are regenerated **only if** their `:check` moves (the strike stops being hollow).
- **I)** Tests (Test Contract below).

## Out of Scope

- The chooser UI (WP-770). WP-770's Assumes must be reconciled to this packet's `shuffleFight.isAvailable` and the `fortifiedReason` lock before it executes.
- Epic Indestructible Man (the 3-Assassin face; not selectable, D-24193).
- Mad Monk's "rescue four Bystanders and this Tactic enters the city as a Villain" (needs new substrate; named follow-up).
- Dark Memories on Blue Talon and Iron Maiden.
- A faithful "any printed 4" check for Project Four; the split-card second face in that check.
- Arms Dealer gaining a Haunted HQ Hero (the WP-692 queue skips Haunted slots; named residual).
- A choice parked by the play-two that is resolved first and then empties the HQ's Tech Heroes after the stale-gain drop ran (only the action moves and `ai.legalMoves` check `hasPendingGiveHqHeroChoice`); the fix belongs in `giveHqHeroChoice.resolve.ts`. Named residual, no known bkwd trigger.
- WP-770 orders its lock reason ahead of the client cost gate for Indestructible Man (`MastermindTile.vue` checks cost at `:216-219` before `fortifiedReason` at `:234-236`, so a Dark-Portal-raised price shows the shortfall reason; the button stays disabled).
- Any client or server change.

## Files Expected to Change

- `packages/game-engine/src/mastermind/indestructibleMan.logic.ts` + `indestructibleMan.logic.test.ts` — **new**
- `packages/game-engine/src/moves/fightMastermind.ts` + `fightMastermind.test.ts` — modified
- `packages/game-engine/src/types.ts`, `game.ts`, `simulation/onBeginParity.ts` (+ `simulation/onBeginParity.test.ts`, test-only) — modified
- `packages/game-engine/src/rules/mastermindHandlers.ts` + `rules/mastermindHandlers.test.ts` — modified
- `packages/game-engine/src/rules/tacticHandlers.ts` + `rules/tacticHandlers.test.ts` — modified
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts` (+ test), `uiState.filter.ts`, `uiState.filter.test.ts` — modified
- `packages/game-engine/src/simulation/ai.legalMoves.ts` + `ai.legalMoves.test.ts` — modified
- `packages/game-engine/src/board/besideMastermind.logic.ts` — JSDoc only
- `packages/game-engine/src/hero/ownedCardKoTrigger.test.ts` — one sanctioned `LOCKED_TABLE` row for the new Wound KO site (`rules/tacticHandlers.ts#koWoundsFromZone`, 1 site / 1 owner record; the WP-853 / D-24789 drift pin asks for exactly this)
- `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts` — one sanctioned value edit: the overlay-parity `checkedCount` 15 → 16 (`:274`), its `// why:` appending "+ Indestructible Man (WP-768 / D-24601) = 16"
- `scripts/coverage/tactic-provenance.json`, `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` — modified / regenerated
- `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` — regenerated only if their `:check` moves
- Governance: `docs/ai/DECISIONS.md` (D-24601), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/post-mortems/01.6-WP-768-indestructible-man-mastermind.md` (new)

About 22 code and data files in one packet: it is the two-session lane, half of the files are tests, and the UIState five-step contract alone spans four.

## Contract

- The Locked Values above. WP-770 consumes `shuffleFight`, `fortifiedReason` and the `shuffleAssassinIds` argument.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism and replay: a seeded shuffle-in), §23/§24 (ranked integrity: closes a free leaderboard win).
**Conflict assertion:** none.
**Non-Goal proximity:** none of NG-1..NG-7 crossed.
**Determinism:** the shuffle-in goes through the seeded Shuffle; the flag is omit-when-absent; every other match is byte-identical. The replay / D-24119 note is recorded in D-24601.

## Funding Surface Gate

§20 **N/A**: engine-only rules, a turn flag and a UIState field. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Test Contract

- **T1** Plain `fightMastermind` against Indestructible Man changes nothing at 0, 5 and 99 attack, with and without `useExcessiveViolence` (deep-equal G).
- **T2** A valid shuffle-fight: deck length +2, both ids in the deck and gone from the Victory Pile, one tactic defeated, held Bystanders rescued, the tactic's Fight fired, `turnEconomy` unchanged, flag set, `hasActedThisTurn` true.
- **T3** A second shuffle-fight in the same turn is refused; the real `turn.onBegin` (the `moves/flyingShieldBlock.logic.test.ts:346-360` F12b pattern) and `applyOnBeginParity` each clear the flag, and a new shuffle-fight then succeeds. `simulation/onBeginParity.test.ts` asserts the reset never creates the key.
- **T4** Refused, G unchanged: one id; three ids; a duplicate; another player's Assassin; a non-Assassin Victory-Pile card; fewer than 2 eligible; not `main`; a block-all pending; healed this turn; haunting / guarded.
- **T5** Final Blow on: the shuffle-fight after the 4th Tactic awards the Mastermind card.
- **T6** Enigma: a malformed guess refuses with no shuffle; a wrong guess spends the Assassins and defeats nothing; a right guess logs exactly one Enigma settle and defeats one Tactic.
- **T7** Any other Mastermind: `fightMastermind({ shuffleAssassinIds })` behaves exactly as `fightMastermind({})`.
- **T8** Strike: with Assassins → the lowest-VP one (tie by `extId`) leaves the current player's pile into the deck; without → every player gains a Wound, current first then clockwise; no hollow record in either branch.
- **T9** Tactics: Secrets (0 / 1 / 3 Wounds across hand and discard); Arms Dealer (0 / 1 / 2 Tech in HQ; other player with / without Tech in hand; solo); Project Four (discards exactly the stat-4 cards incl. two adjacent ones, keeps a card without `cardStats`, log says "(approximate)"); Arms Dealer stale gain (park with 2 Tech Heroes, the play-two empties the eligible set → the queue is empty and the turn can end); each plays 2 Villain-Deck cards unless last; Mad Monk records its hollow only when not last.
- **T10** Dark Technology and Bitter Captor log lines unchanged (the `verb` default).
- **T11** Projection: `'fortifiedReason' in mastermind === (isMastermindGuarded(G) || the Indestructible Man lock is open)`; `shuffleFight` present only for Indestructible Man, active player's Assassins with display, `isAvailable` false when used / < 2 / guarded; `fortifiedReason` is the lock reason, a guard reason wins, absent after vanquish; both survive every audience in the filter test; absent for every other Mastermind.
- **T12** Bot: no plain intent for him; one shuffle intent with the lowest-VP pair when `canShuffleFight`, including at fight price 1 with 0 attack; none when used / < 2; other Masterminds unchanged. Every emitted intent commits when dispatched (mirror test).
- **T13** Real data (engine-runner, recorded in the PR, not a committed test): a seeded 1-player Indestructible Man scenario, baseline vs branch; the branch shows no turn-1 win.

## Acceptance Criteria

1. With Indestructible Man, plain `fightMastermind` changes nothing at any attack value, and the bot never emits it (T1, T12).
2. A valid shuffle-fight pays two own Assassins into the deck, defeats a tactic (or strikes the Final Blow), spends no attack and sets the flag; once per turn; the flag clears next turn (T2, T3, T5).
3. Invalid arguments and every existing gate refuse with G unchanged (T4, T6).
4. The strike shuffles the lowest-VP Assassin or wounds every player in turn order (T8).
5. The tactics resolve as locked; Mad Monk records its hollow when reachable (T9, T10).
6. `shuffleFight` and the `fortifiedReason` lock project only for Indestructible Man and survive the audience filter (T11).
7. Bot intents mirror the move gate; a seeded real-data 1-player run shows no turn-1 win (T12, T13).
8. Checks pass: `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check` 0; hash oracles unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm -r --no-bail test` → 0 fail (paste every package's totals).
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm gauntlet:loadouts:check` → 0.
5. `pnpm --filter @legendary-arena/engine-runner start run --scenario <scratchpad>/wp768-scenario.json --games 5 --seed wp768`, where the scenario is a MatchSetupDocument shaped like `apps/engine-runner/src/fixtures/scenario.valid.json` with `mastermindId: bkwd/indestructible-man`, `villainGroupIds: [bkwd/elite-assassins]`, `henchmanGroupIds: [core/doombot-legion]`, scheme `bkwd/corrupt-the-spy-agencies`, 1 player, 30 Bystanders. Expected: the baseline reports `averageTurns` 1 and `winRate` 1 (recorded at reconcile: exactly that, 5 / 5 games); the branch reports `averageTurns` > 1. Exit 0 both times.
6. `git diff --name-only origin/main...HEAD` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24601 Active; STATUS updated (follow-ups: WP-770 reconcile, Mad Monk villain substrate, Haunted-gain residual).
- [ ] WORK_INDEX `[x]` with `[live-verify: pending]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check` 0; 01.6 post-mortem.
- [ ] Two-commit topology (`EC-805:` code + data, then `SPEC:` governance).
- [ ] **D-24026 live-verify** (post-deploy, WP-768 alone): in a live Indestructible Man match created after the deploy, the Fight button is disabled with the lock reason; a bot or autoplay seat shuffle-fights (the log shows two Assassins shuffled in and a tactic defeated, at most once per turn); a Master Strike shuffles in an Assassin or wounds everyone; an exported Play Diagnostics `uiStateSnapshot` shows `mastermind.shuffleFight` and `mastermind.fortifiedReason` (UIState step 5). Allowed drivers: a Workshop paste-loadout operator match, or server autoplay (`POST /api/match/autoplay` with `setupData`). Record the PASS as its own `SPEC:` PR.

## Reserved Decision (lands at execution)

**D-24601 — indestructible-man-mastermind.** It locks: attack never fights him (and the reason rides `fortifiedReason`); the `shuffleAssassinIds` player choice; once per turn via the omit-when-absent flag; the Assassins are paid before an Enigma guess; the shuffle-in follows D-24771; the strike's lowest-VP auto-pick and its D-24780 wound order; the Project Four approximation; the Arms Dealer `verb`, the stale-gain drop, the play-two-parked-choice stale-gain residual and the Haunted-gain residual; the Enigma block gated off for him; `uiState.types.ts` (a contract file) gains `shuffleFight` and `fortifiedReason`'s meaning widens; the not-last-only Mad Monk hollow; Project Four `deferred` provenance; the null-provider no-op; the replay / D-24119 note (restated in the PR for the competitive-score owner).

---

## Lint Gate Self-Review (00.3)

- §1 all sections present; §2 boilerplate + protocol; §3 Assumes re-anchored on `b93e6d6ca`, every helper listed with its path; §4 cited with sections; §5 ~22 files, closed allowlist, justified; §6 canonical names; §7 dependencies all merged; §8 engine only; §9 pnpm; §10–11 N/A; §12 `node:test`; §13 exact commands with expected output; §14 8 binary ACs; §15 DoD + D-24026; §15.2 Risk Tier MEDIUM (WP + EC); §16 00.6; §17 clauses + NG line; §18–19 N/A; §20–21 N/A with reasons.

## Gate Record

**2026-09-26 draft gates (superseded by the reconcile):** 01.4 round 1 DO NOT EXECUTE YET (PS-1..5 fixed: MOVE_MAP args, `onBeginParity` reset, the shuffle source, the play-two call, the hollow contract); 01.7 round 1 BLOCK, resolved by the PS fixes; CONFIRM by an independent subagent.

**2026-11-16 re-gate (on `b93e6d6ca`):** rounds recorded below.

**Round 1 (independent subagents, 2026-11-16):**
- **01.4 pre-flight: READY conditional** on PS-1 (`mastermindStrike.unresolved.test.ts:274` overlay-parity count 15 → 16, now a sanctioned edit on the allowlist) and PS-2 (one argument type in all places). Risks folded: RS-1 `fortifiedReason` widening (JSDoc / comment updates + a T11 parity case), RS-2 the import cycle (map read in-body), RS-3 the bot branch before the price check, RS-4 three `verb` lines, RS-5 `UIDisplayEntry[]`, RS-6 a null provider moves nothing, RS-7 Project Four `deferred`; RS-8 (old ranked replays) is restated in the PR.
- **01.7 copilot: HOLD**, nine fixes applied: (1) the Arms Dealer stale-gain drop after the play-two (a mandatory parked gain with 0 eligible Heroes would freeze the board); (2) the existing Enigma block gated off for him; (3) the bot branch placement; (4) `readonly CardExtId[]`; (5) `verb` on all three lines + a play-two narration line; (6) T3 drives the real `turn.onBegin` + `onBeginParity.test.ts`; (7) `isAvailable` JSDoc scope; (8) the diagnostics snapshot in the live-verify; (9) Project Four collects then discards.
- **00.3 lint: FAIL**, all fixed: §3 helper paths in Assumes 9; §4 00.2 section cited; §5 closed allowlist with exact names and justification; §13 exact step-5 command with expected output, step-6 base ref; §15.2 Risk Tier line in WP + EC; §20 / §21 reasons. Recommendations applied: the named Step-3 sub-function, `currentPlayer`, §8 / §22 clauses, NG line, D-24185 / D-24750, the bot Final Blow note, index dep drift.

**Round 2 (independent subagents, 2026-11-16):**
- **00.3 lint: PASS.** Four nits applied (EC Assumes range 1-10 + scope-lock line; `deepCopyDisplayEntries` anchor `:226`; the F12b live-`onBegin` test anchor; how the stale-gain drop finds its entry: `freeRecruitFromHqByFilter` now returns the parked entry, matched by identity).
- **01.7 copilot: HOLD → CONFIRM** with the round-2 fixes folded (no re-run required by the reviewer): findings 1, 3, 4 were the same three nits above; finding 2 (a play-two-parked choice resolved before the gain) is recorded as a named residual in Out of Scope and D-24601; finding 5 (WP-770 lock-before-cost ordering) is in Out of Scope.
- **01.4 pre-flight: READY TO EXECUTE** (its conditions are findings 1, 3, 4, applied).
