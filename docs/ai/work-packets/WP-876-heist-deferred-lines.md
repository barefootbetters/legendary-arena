# WP-876 — Heist: The Big Score, Revolutionary Anthem, Putting a Crew Together and X-Con Security Van fire their full printed Heist abilities (Game Engine + UIState + arena-client + curated markers)

**Status:** Draft 2026-11-08 (EC-914; D-24823 reserved)
**Layer:** Game Engine (three hero keywords, one count source, a Heist payload module, a turn-economy field, the move-a-Villain choice variant, one seat-choice kind, UIState projection) + arena-client (the move-a-Villain prompt and one `PendingSeatChoicePrompt.vue` heading) + curated card-data markers. One WP, the WP-865 shape.
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic, new turn-economy state on G, a new seat-choice kind and a pending-choice variant; no auth, money, persistence or server surface
**Hard-deps:** WP-865 / D-24808 (Heist: `attemptHeist`, `fireHeistPlays`, `HEIST_CARDS`) ✅, D-24812 (Attempt Heist in the turn bar) ✅, WP-795 / D-24664 (`PendingMoveVillainChoice`, `resolveMoveVillainChoice`, `MoveVillainChoicePrompt.vue`) ✅, WP-684 / D-24501 (the `PendingSeatChoice` framework) ✅, WP-242 / WP-492 / D-24298 (`PendingKoHeroChoice`, the "KO one of your Heroes" path) ✅, D-24016 (`attack-per-count` + `HeroCountSource`) ✅, WP-216 / EC-248 (curated `hero-ability-markers.json`) ✅

## Goal

WP-865 shipped Heist for six Ant-Man and the Wasp (`amwp`) cards and turned the other four Heist lines into honest
hollows that grant nothing. After this WP all ten Heist lines fire their full printed ability on a successful Heist, in
readying order, and nothing at play:

- **The Big Score** (`scott-lang-cat-burglar`, line 0): "+4 Attack. If the card revealed from the Villain Deck is a
  Master Strike, KO it and put a card from the Bystander Deck on top of the Villain Deck."
- **Revolutionary Anthem** (`ant-army`, line 2): "+2 Attack. If the card revealed from the Villain Deck is a Scheme Twist,
  you get another +2 Attack, and you may shuffle that deck."
- **Putting a Crew Together** (`scott-lang-cat-burglar`, line 0): "+1 Attack for each different cost card you have."
- **X-Con Security Van** (`scott-lang-cat-burglar`, line 0): "You may move a Villain to an empty city space. If you do, KO
  one of your Heroes."

Playing any of the four now readies it for a Heist (it offers the Attempt Heist button like the other six). The `heist`
hollow is gone from live play.

## User-Visible Impact

- Each of the four cards logs "readied … for a Heist" at play and fires on a won Heist.
- The Big Score against a revealed Master Strike KOs that Master Strike and puts a Bystander on top of the Villain Deck.
- Revolutionary Anthem against a revealed Scheme Twist adds another +2 Attack and asks "Shuffle the Villain Deck?".
- Putting a Crew Together adds +1 Attack per different printed cost among the cards you have (hand plus cards played this turn),
  0 included.
- X-Con Security Van opens the move-a-Villain prompt restricted to empty City spaces; moving a Villain then asks which of
  your Heroes to KO (or KOs it automatically when there is only one choice). Declining moves nothing and KOs nothing.
- **Observed today, operator match `bo4ZSQLBuQU`** (files
  `C:\pcloud\matches\chmp\FinFangFoom-MidtownBankRobbery-{LOG,DIAGNOSTICS,GAME}-2p-bishop.*`, written 2026-11-08; they
  replaced the `mjw8byyMwLY` copies):
  - The Big Score was played ten times and logged `heist` / `onPlay` / `parse-unrecognized` every time (6.2.2, 10.2.10,
    12.2.8, 14.2.16, 18.2.17, 20.2.14, 22.2.8, 24.2.9, 26.2.11, 28.2.13). It was never readied, so even its plain
    "+4 Attack" never fired. On turn 6 it was the only Heist card played, and no Attempt Heist button appeared.
  - Two Heists revealed a Master Strike (8.2.4, 28.2.4) and one a Scheme Twist (22.2.4). With The Big Score and
    Revolutionary Anthem readied, those are exactly the cases their extra clauses key on.
  - This WP readies all four cards and fires each card's whole Heist line, The Big Score's +4 included, through the same
    path as the six shipped lines (AC 2–3).
- **Observed earlier, operator match `mjw8byyMwLY`** (the same file names, read before they were replaced):
  - X-Con Security Van logged `Unhandled effect observed: … declared a "heist" mechanic at onPlay … (parse-unrecognized)`
    on turns 11, 17 and 23 (log 11.2.11, 17.2.8, 23.2.2). On turn 23 it was the only Heist card played, so no Heist was
    offered at all.
  - The six shipped Heist lines fired correctly on every won Heist (3.2.6, 5.2.7, 7.2.6, 9.2.6, 11.2.5, 15.2.10, 17.2.6).
  - Turn 17's won Heist revealed a Master Strike (17.2.4) and turn 3's a Scheme Twist (3.2.4): the exact cases The Big Score
    and Revolutionary Anthem key on.
  - Player 1 (a bot) readied Petty Larceny on turns 8, 10 and 14 (8.2.6, 10.2.5, 14.2.3) and never attempted a Heist. See
    §Context, "Bots stay out".

## Assumes

- **Baseline:** `origin/main` at `a84d3041` plus the reserve PR #3236 (WP-876 / EC-914 / D-24823). The scaffold probe below ran
  at `a84d3041`.
- **Rule:** Universal Rulebook v23 p.26–27 (`docs/legendary-universal-rules-v23.md` ~l.1500–1522, ~l.1546–1556): on a
  higher Heist Count "use all Heist effects of Heroes you played … in any order"; "If you succeed in the Heist, do all of
  the Heist effects before moving on to playing more Heroes or recruiting or fighting anything else." "Cards you have" =
  hand plus cards played this turn (~l.2164–2193, the Weapon X Sequence note that 0 is a cost); "Your Heroes / Heroes You
  Have" = hand plus played cards still in play (~l.3436–3460, D-24529, D-24692).
- **The four lines** in `data/cards/amwp.json` (text verified at `a84d3041`):
  - `scott-lang-cat-burglar/the-big-score` 0, `…/putting-a-crew-together` 0, `…/x-con-security-van` 0 (all plain `Heist:`);
  - `ant-army/revolutionary-anthem` 2 (`[keyword:Heist]:`). Its lines 0 (Microscopic Size-Changing) and 1 (the conditional
    +2) are unchanged by this WP.
- **Shipped Heist path (WP-865):**
  - `HEIST_LINE_PATTERN` and `HEIST_CARDS` (`setup/heroAbility.setup.ts` ~l.861–877); `buildHeistFusion` (~l.4519) strips the
    prefix and runs `parseAbilityText` on the rest; `buildHeistHollow` (~l.4543); the per-line call (~l.4787).
  - `heroEffectHeist` (enrol only) and `fireHeistPlays` (`hero/heroEffects.execute.ts` ~l.7332, ~l.7383). `fireHeistPlays`
    runs each readied card's `heistEffects` through `executeSingleEffect(G, ctx, playerID, cardId, effect)` with the
    forwarded move context (it carries `random` and `events`). Neither checks hook `conditions`.
  - `attemptHeist` (`moves/attemptHeist.ts`): the revealed id is a local (`revealedCardId`, ~l.165) and is stored nowhere;
    `markHeistAttempted(economy)` (`economy/economy.logic.ts` ~l.1232) sets the latch; the same-turn carry keys
    (~l.497–498, ~l.602–606).
  - `TurnEconomy.heistCrewCards?` / `hasAttemptedHeistThisTurn?` (`economy/economy.types.ts` ~l.286–303).
- **Scaffold probe (observed, `a84d3041`).** A throwaway `tsx` script (scratchpad, not committed) built hooks through
  `buildHeroAbilityHooks` from the committed `amwp.json` with each Heist prefix stripped and the planned marker appended:
  - The Big Score + `[keyword:heist-master-strike-ko]` → `attack 4` plus an unresolved `heist-master-strike-ko` (the
    keyword does not exist yet).
  - Revolutionary Anthem line 2 + `[keyword:heist-scheme-twist-bonus:2]` → ONE `attack 2` plus an unresolved
    `heist-scheme-twist-bonus`. The second printed +2 icon does not become a second flat `attack`.
  - Putting a Crew Together + `[keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]` (an existing source,
    standing in for the new one) → exactly `{ type: 'attack-per-count', magnitude: 1, countSource }`; the flat `+1` icon is
    suppressed. With the unknown source `distinct-costs-you-have` it falls back to `attack 1`, so the source must exist.
  - X-Con Security Van + `[keyword:heist-move-villain-ko-hero]` → no effect, unresolved `heist-move-villain-ko-hero`.
- **Reused engine pieces:**
  - Villain Deck card types: `G.villainDeckCardTypes[id]` (`'mastermind-strike'`, `'scheme-twist'`, `'bystander'`, …;
    `villainDeck/villainDeck.types.ts` ~l.28–33). An untyped card fails its reveal (`villainDeck/villainDeck.reveal.ts`
    ~l.258–265).
  - KO a Villain Deck card: `G.ko = koCard(G.ko, id)` (`board/ko.logic.ts:24`; the Finding Zemo precedent,
    `rules/tacticHandlers.ts` ~l.1835–1848). Put on top: `G.villainDeck.deck = [id, ...deck]` (inline precedent,
    `rules/schemeTwistResolvers.ts` ~l.978).
  - Bystander Deck: `G.piles.bystanders`, every copy the token `BYSTANDER_EXT_ID = 'pile-bystander'`
    (`setup/pilesInit.ts:22`), taken from the front. `'pile-bystander'` has no `villainDeckCardTypes` entry by default; Change
    the Outcome of WWII types it `'bystander'` when absent (`rules/changeTheOutcomeOfWwii.logic.ts` ~l.78–94).
  - Distinct costs: the Outwit counter `countDistinctHeroCostsInHandOrPlay` (`hero/heroConditions.evaluate.ts` ~l.766,
    private) counts hand plus `playedCardIdsStillInPlay` (the "Heroes you have" pool), 0 included, skipping `pile-wound` /
    `pile-bystander`. It is NOT reused here (see Context). `playedCardIdsThisTurn(G, inPlay)` (`hero/splitCard.logic.ts`
    ~l.227) is the "cards played this turn" view: still-in-play plus returned Sidekicks, Out of Time cards and used Ritual
    Artifacts. Controlled Hero Artifacts live in `G.controlledArtifacts[playerID]`; the distinct-classes collector in
    `hero/heroCountSource.resolve.ts` (~l.831) already adds them.
  - Count sources: `HeroCountSource` union + `HERO_COUNT_SOURCES` (`rules/heroCountSource.ts` ~l.36–87), the two switches in
    `hero/heroCountSource.resolve.ts` (~l.433 `resolveCountSource`, ~l.865 `explainCountSourceInputs`) and `hero/countSourceLabel.ts` (~l.54); drift
    test `hero/heroCountSource.resolve.test.ts`.
  - Attack grant: `heroEffectAttack` (`hero/heroEffects.execute.ts` ~l.1905), reached through `executeSingleEffect`.
  - Seat choice: `PendingSeatChoice` (`types.ts` ~l.1532), `parkSeatChoice(G, events, choice, activePlayerToSkip)`
    (`moves/seatChoice.resolve.ts` ~l.349), `applySeatChoiceByKind(G, choice, shuffleContext, currentPlayer)` (it already
    receives `{ random }`), the bot `chooseByKind` (`simulation/ai.seatChoice.ts` ~l.105), the generic client
    `PendingSeatChoicePrompt.vue`. Two-option precedent: Diving Block (`moves/divingBlock.logic.ts` ~l.255–283).
  - Shuffle: `shuffleDeck(cards, ctx as ShuffleProvider)` (`setup/shuffle.ts:28`) or `shuffleContext.random.Shuffle`.
  - Move a Villain: `PendingMoveVillainChoice { playerID, sourceCardId }` (`types.ts` ~l.1362, `G.pendingMoveVillainChoices`
    ~l.2560); `heroEffectSpinningCyclone` parks it (`hero/heroEffects.execute.ts` ~l.4425); `resolveMoveVillainChoice`
    (`moves/moveVillainChoice.resolve.ts` ~l.139) swaps on an occupied destination and rescues the moved Villain's
    Bystanders, and its decline log names Spinning Cyclone; the bot default `selectDefaultMoveVillainArgs`
    (`simulation/ai.legalMoves.ts` ~l.365); the projection `UIPendingMoveVillainChoice { playerID, villainCityIndices }`
    (`ui/uiState.types.ts` ~l.1811, built `ui/uiState.build.ts` ~l.1994–2013, filtered `ui/uiState.filter.ts` ~l.1406–1412);
    `apps/arena-client/src/components/play/MoveVillainChoicePrompt.vue` (heading hard-codes "Spinning Cyclone", offers
    occupied spaces as "swap with …").
  - KO one of your Heroes: `villainEffectKoHero`'s `target: 'current'` path (`villain/villainEffects.execute.ts` ~l.1263–1312):
    with `buildKoEligibleTargets` / `countKoableHeroes` (exported) it auto-KOs a forced pick through the private
    `koSingleTarget` (~l.5919) and otherwise parks `{ choiceType: 'ko-hero', playerID }` on `G.pendingKoHeroChoices`
    (`types.ts` ~l.579, ~l.2318), resolved by `resolveKoHeroChoice` (`moves/koHeroChoice.resolve.ts`) over
    `YOUR_HEROES_KO_ZONES` = hand + in play. UI, filter and bot for that choice already exist.
- **Bots:** `getLegalMoves` never emits `attemptHeist` (`moves/attemptHeist.ts:15`); the server autoplay
  (`apps/server/src/autoplay/autoplay.mjs`) is `getLegalMoves`-driven. Any pending choice the engine can park still needs a
  bot answer, or the simulation hangs (`simulation/ai.legalMoves.ts` ~l.185–215).
- **No fixture carries these heroes:** no sentinel, PAR or coverage fixture names `scott-lang-cat-burglar` or `ant-army`
  (grep at `a84d3041`). `scripts/runtime-observed-hollows.mjs` sweeps the `amwp` deck set (it includes `amwp/ant-army`), so
  that feed regenerates.

## Context (Read First)

**Why now.** The deferred lines are hollow in live play: X-Con Security Van in `mjw8byyMwLY`, and The Big Score ten
times in `bo4ZSQLBuQU`. A hollow Heist card is never readied, so on a turn where it is the only Heist card the player is
not even offered a Heist. The deferred lines all under-grant: none of the four fires anything, including The Big Score's
plain +4 and Revolutionary Anthem's plain +2.

**What changes from WP-865.** The Honest-Partial allowlist grows to all ten cards. Each of the four gets a curated marker
that parses (after the WP-865 prefix strip) into its full inner effect list, and the remaining work is three new inner
effects that the shipped `fireHeistPlays` dispatches like any other:

| Card | `heistEffects` (locked) | New piece |
|---|---|---|
| The Big Score | `attack 4`, `heist-master-strike-ko` | keyword + handler |
| Revolutionary Anthem | `attack 2`, `heist-scheme-twist-bonus 2` | keyword + handler + one seat-choice kind |
| Putting a Crew Together | `attack-per-count 1` × `distinct-costs-you-have` | one count source |
| X-Con Security Van | `heist-move-villain-ko-hero` | keyword + handler + a `PendingMoveVillainChoice` variant |

**"The card revealed" is recorded, not re-read.** Two lines key on the card the Heist revealed. Reading `villainDeck.deck[0]`
at fire time is wrong once an earlier effect in the same Heist changes the top (The Big Score replaces a Master Strike with
a Bystander; a second Big Score must not then treat the Bystander as "revealed"). So `attemptHeist` records the revealed id
on the turn economy when it latches the attempt (`heistRevealedCardId`), and both handlers read the TYPE of that id. The
Big Score additionally KOs only while that id is still `deck[0]`; it always is on the first Big Score of a Heist.

**Putting a Crew Together's count.** "+1 for each different cost card you have." The rulebook box "'Your Cards' and
'Cards You Have'" (v23 ~l.2164–2167) defines "cards you have" as the cards in your hand plus the cards you played this
turn, and ~l.3443–3447 says a played card that moved elsewhere still counts as "a card you played this turn"; only
"Your Heroes / Heroes you Have" drops it. So this is the wider "cards" pool, NOT the "Heroes you have" pool that the Heist
Count and the Outwit counter use (still in play only, Hero Artifacts added, ~l.930). The Weapon X Sequence note
(~l.2184–2193) counts 0 as a cost. The new `distinct-costs-you-have` source therefore counts distinct printed costs over
`hand` plus `playedCardIdsThisTurn(G, inPlay)` plus the Hero Artifacts you control (rules ~l.930 counts them among "your
Heroes"; the distinct-classes collector precedent), 0 included, Wounds and Bystanders skipped (they print no cost), through
a new local helper `countDistinctCostsOfCardsYouHave` in `hero/heroCountSource.resolve.ts`.
- **Accepted residual:** no ledger records a played card that was later KO'd or discarded this turn (only Out of Time cards,
  returned Sidekicks and used Ritual Artifacts are recorded), so such a card does not count. Building that ledger is out of scope.
- Counted at fire time, so cards an earlier Heist ability drew into hand count (readying order, D-24808 §5). It is not the
  Heist Count, which drops 0.

**Several choices open at once.** One Heist can leave several choices open together: X-Con's move choice plus Anthem's
shuffle seat choice, then the `ko-hero` choice after the move; two X-Cons leave a `ko-hero` choice plus a second queued
move entry. The resolvers do not gate on each other (`moveVillainChoice.resolve.ts` ~l.139–221, `resolveSeatChoice`
~l.417), and the client stacks the prompts. That matches the rule ("in any order"). No seat choice other than Anthem's can
be open during `fireHeistPlays`: `attemptHeist` requires no open choice, and no other Heist line parks one. The
"already offered" skip is therefore an Anthem-only case.

**X-Con Security Van reuses Spinning Cyclone's choice.** The move-a-Villain pick, its block-all guards, its bot default and
its client prompt already exist (WP-795). X-Con differs in three ways, carried by one optional discriminant
`variant: 'x-con-security-van'` on the engine entry and the projection:

1. the destination must be an EMPTY City space (no swap);
2. the moved Villain's Bystanders are NOT rescued (X-Con prints no rescue);
3. "If you do, KO one of your Heroes": after a move (never after a decline) the resolver runs the shipped
   KO-one-of-your-Heroes path (auto-KO when forced, else the `ko-hero` choice over hand + in play).

With no Villain in the City or no empty City space there is nothing to move, so no choice parks and nothing is KO'd.

**Revolutionary Anthem's "you may shuffle".** A genuine yes/no. The cheapest shipped surface is one `PendingSeatChoice` kind
addressed to the active player (generic prompt, no new move, no new component); its apply arm already receives the
shuffle context. Two Anthems in one Heist offer ONE shuffle prompt (a second park while a seat choice is open is skipped
with a log; shuffling twice is the same choice). The bot (never reached, see below) declines.

**Bots stay out (decision for this WP).** Bot Heist attempts remain a named follow-up, not in scope:

- They are a different surface: `getLegalMoves` / the bot policy, the simulation loop mirrors and the server autoplay, none
  of which this WP otherwise touches.
- They need a policy call (when is a Heist worth the Wound risk?) that is Jeff's design decision, with its own D-entry.
- They would move bot-driven simulation results (scores, PAR, sentinel replays) that this WP must hold byte-identical,
  which would mask whether this WP changed anything else. (The hollow and coverage feeds do regenerate here, because the
  four lines leave the hollow set.)
- The gap is an under-grant only: a bot that readies Petty Larceny and never attempts loses +2 Recruit (`mjw8byyMwLY`
  8.2.6 / 10.2.5 / 14.2.3), the same faithful "chose not to Heist" outcome WP-865 accepted.

This WP still gives every new pending surface a bot answer (decline), so no simulation can hang if a later WP lets bots
Heist.

**One WP, not a split.** The four lines share the allowlist, the marker array, the generated `amwp.json` and the
`HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` count pins. Splitting would bump the same pins and regenerate the same feeds two
or three times across rebases, and leave a window where some Heist lines fire and others are still hollow. The file count
past ~10 is lockstep pins, generated feeds and governance, as in WP-865.

**Test-authoring notes:** parse tests read the committed `data/cards/amwp.json` through the `getSet` stub already in
`setup/heistFusion.test.ts`. Handler and move tests build `G` with the minimal test builder plus the turn economy,
`villainDeck`, `villainDeckCardTypes`, `piles.bystanders`, `city` and `cardStats` they need. Use `makeMockCtx`; never import
`boardgame.io/testing`.

**Read first:** `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (UIState projection, D-12803), §Layer Boundary
(Authoritative), §Card Data Flow; `.claude/rules/architecture.md` §UIState Projection Integrity; `docs/ai/REFERENCE/00.2-data-requirements.md`
§5 / §5.1; `docs/03-DATA-PIPELINE.md` §1; `docs/ai/REFERENCE/00.6-code-style.md`; `docs/ai/DECISIONS.md` D-24808, D-24812,
D-24664, D-24501, D-24298, D-24007, D-24016, D-24529, D-24692, D-12803, D-24372, D-24026.

## Scope (In)

1. **Markers** (`scripts/convert-cards/inputs/hero-ability-markers.json`, appended to the `amwp` array), then
   `node scripts/convert-cards/apply-hero-ability-markers.mjs` regenerates `data/cards/amwp.json`:
   - `scott-lang-cat-burglar/the-big-score` 0 `[keyword:heist-master-strike-ko]`
   - `scott-lang-cat-burglar/putting-a-crew-together` 0 `[keyword:attack-per-count:distinct-costs-you-have:1]`
   - `scott-lang-cat-burglar/x-con-security-van` 0 `[keyword:heist-move-villain-ko-hero]`
   - `ant-army/revolutionary-anthem` 2 `[keyword:heist-scheme-twist-bonus:2]`
   - The apply script's `VALID_TOKEN_PATTERN` (`apply-hero-ability-markers.mjs` ~l.147–148; its `// why:` block ~l.53–146)
     gains the two single-segment forms and the two-segment `heist-scheme-twist-bonus:<n>` form (`<n>` `[1-9]\d*`), each with
     a `// why:`, and the valid-forms list in its error message (~l.365–368) names all three. The `attack-per-count` form
     already exists.
2. **Keywords** (`rules/heroKeywords.ts`): `'heist-master-strike-ko'`, `'heist-scheme-twist-bonus'`,
   `'heist-move-villain-ko-hero'` join the `HeroKeyword` union and `HERO_KEYWORDS` (append order). The two magnitude-less
   ones join `NO_MAGNITUDE_KEYWORDS`; all three join `HANDLED_KEYWORDS` and `HERO_EFFECT_HANDLERS`
   (`hero/heroEffects.execute.ts`).
3. **Count source** `'distinct-costs-you-have'`: appended to `HeroCountSource` / `HERO_COUNT_SOURCES`
   (`rules/heroCountSource.ts`), with an arm in both `hero/heroCountSource.resolve.ts` switches and in
   `hero/countSourceLabel.ts`. Both arms use one new local helper in `hero/heroCountSource.resolve.ts`:
   `collectCardsYouHave(G, playerID)` returns `playedCardIdsThisTurn(G, zones.inPlay)`, then `zones.hand`, then
   `G.controlledArtifacts?.[playerID] ?? []` (skipping an id already in the pool), minus `pile-wound` / `pile-bystander`,
   in that order (empty when the player has no zones). The `resolveCountSource` arm
   (~l.433) returns `countDistinctCostsOfCardsYouHave(G, playerID)`: the number of distinct
   `G.cardStats[id]?.cost ?? 0` values over that pool, 0 included. The `explainCountSourceInputs` arm (~l.865, which
   returns the counted card ids) returns the pool itself. `hero/heroConditions.evaluate.ts` is not modified.
4. **Allowlist** (`setup/heroAbility.setup.ts`): `HEIST_CARDS` gains the four canonical keys, so all ten `amwp` Heist lines
   fuse. `buildHeistHollow` and the non-allowlisted branch stay for any future set's Heist line.
5. **Revealed card** (`economy/economy.types.ts`, `economy/economy.logic.ts`, `moves/attemptHeist.ts`):
   - `TurnEconomy.heistRevealedCardId?: CardExtId`, lazy, omitted when unset, carried beside `hasAttemptedHeistThisTurn`
     and reset with the turn economy.
   - `markHeistAttempted(economy, revealedCardId: CardExtId)` (the parameter is required) sets both the latch and the id.
     Its three existing one-argument test calls (`economy/economy.logic.test.ts` ~l.951, ~l.957, ~l.969) are updated to
     pass an id; their omit-when-absent key pins for the other fields (~l.966–975) are unchanged, and that test also
     asserts `heistRevealedCardId` is absent on a fresh economy.
   - `attemptHeist` passes `revealedCardId` (no other change to the move).
6. **Payload module** `hero/heistPayloads.logic.ts` (**new**): G-mutating logic helpers with no `boardgame.io` import, no
   I/O and no randomness of their own, called only from handlers and resolvers inside a move. Three thin handlers in
   `hero/heroEffects.execute.ts` call it:
   - **`heist-master-strike-ko`** (`applyHeistMasterStrikeKo(G, playerID, cardId)`):
     - revealed id absent, or its type is not `'mastermind-strike'` → `neutral` "not a Master Strike" line, nothing else;
     - id no longer `G.villainDeck.deck[0]` → `blocked` "no longer on top" line, nothing else;
     - else remove it from the deck top and `G.ko = koCard(G.ko, id)`; then, if `G.piles.bystanders` is non-empty, take its
       front, put it on top of the Villain Deck and set `G.villainDeckCardTypes[thatId] ??= 'bystander'` (the WWII
       precedent); log `applied` (or the empty-Bystander-Deck variant).
   - **`heist-scheme-twist-bonus`** (magnitude N): the handler in `heroEffects.execute.ts` asks
     `isHeistRevealedSchemeTwist(G)` (payload module):
     - false → `neutral` line, nothing else;
     - true → the handler grants `executeSingleEffect(G, ctx, playerID, cardId, { type: 'attack', magnitude: N })` (the
       shipped attack path, so the payload module never imports `heroEffects.execute`), then calls
       `parkHeistShuffleChoice(G, events, playerID, cardId)`, which parks the shuffle seat choice unless
       `G.pendingSeatChoice` is already set (then a `neutral` "already offered" line).
   - **Import cycle:** the payload module imports `parkSeatChoice` and `seatChoice.resolve.ts` imports its apply function,
     the `divingBlock.logic.ts` precedent; imported bindings are read only inside function bodies.
   - **Seat-choice kind** `HEIST_SHUFFLE_SEAT_CHOICE_KIND = 'heist-shuffle-villain-deck'`: addressed seat = the active
     player; options `['Shuffle the Villain Deck', 'Leave the Villain Deck as it is']`; `defaultOptionIndex` 1 (leave).
     Parked through `parkSeatChoice(G, events, choice, playerID)` with `events` read from the forwarded context
     (`(ctx as { events?: … }).events`, the `heroEffects.execute.ts` ~l.4567 precedent; `undefined` in a unit context).
     The apply is `applyHeistShuffleResolvedSeatChoice(G, choice, shuffleContext)` in the payload module; its arm in
     `moves/seatChoice.resolve.ts` `applySeatChoiceByKind` sits before the generic fall-through (so the generic "Seat N
     resolved … choice" line does not also print): option 0 → `G.villainDeck.deck =
     shuffleContext.random.Shuffle([...G.villainDeck.deck])` + `applied` line; option 1 → `neutral` line; no shuffle
     context → no shuffle, `blocked` line.
   - **Prompt heading:** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` gains one `case` for the kind in
     its title `switch` (~l.88–136): `Revolutionary Anthem: shuffle the Villain Deck?` (otherwise it would fall back to
     "Your choice"). One `case`, not a new component.
   - **`heist-move-villain-ko-hero`** (`applyHeistMoveVillain(G, playerID, cardId)`): when the City holds at least one
     Villain AND at least one empty space, append `{ playerID, sourceCardId: cardId, variant: 'x-con-security-van' }` to
     `G.pendingMoveVillainChoices` and log `neutral`; otherwise log the `blocked` "nothing to move" line and park nothing.
7. **Move-a-Villain variant** (`types.ts`, `moves/moveVillainChoice.resolve.ts`):
   - `PendingMoveVillainChoice.variant?: 'x-con-security-van'` (absent = Spinning Cyclone, byte-identical).
   - "Empty" means `G.city[i] === null` for `i < G.city.length` (a six-space City included, WP-831); the client uses the
     same test on the projected City.
   - Once the front entry and the answer shape are validated, a variant entry is handed to its own named function
     `resolveXConSecurityVanMove` (the resolver is already ~80 lines). With the variant, that path:
     - rejects an occupied destination as an invalid answer (silent return, entry stays open);
     - moves the Villain, rescues nothing, logs the X-Con move line;
     - then KOs one of the player's Heroes through `koOneOfYourHeroes(G, playerID)` (below);
     - a decline logs the X-Con decline line, moves nothing and KOs nothing.
   - Without the variant every path is unchanged (all existing `moveVillainChoice` tests pass unedited).
8. **KO one of your Heroes** (`villain/villainEffects.execute.ts`): a NEW export
   `koOneOfYourHeroes(G, playerID): { outcome: 'none' } | { outcome: 'parked' } | { outcome: 'koed'; koedCardId: CardExtId;
   zone: VillainKoZone }` (a discriminated union),
   built from `buildKoEligibleTargets`, `countKoableHeroes` and the in-module `koSingleTarget` with owed = 1 (the inline
   Red Skull precedent, `rules/mastermindHandlers.ts` ~l.760–766): 0 eligible → `none`; `countKoableHeroes > 1` and ≥ 2
   distinct eligible → push the bare `{ choiceType: 'ko-hero', playerID }` onto `G.pendingKoHeroChoices` → `parked`; else
   KO `eligible[0]` → `koed` with its id and zone. It writes no log; the X-Con resolver logs its own line from the result.
   `villainEffectKoHero` is NOT modified.
9. **UIState** (five-step contract, D-12803): `UIPendingMoveVillainChoice.variant?: 'x-con-security-van'`, declared in
   `ui/uiState.types.ts`, built from the front entry in `ui/uiState.build.ts`, passed through `ui/uiState.filter.ts` with the
   chooser-only disposition and omitted when absent; a filter test (chooser sees it, opponent and spectator see no
   prompt); a built-projection keyset pin in `ui/uiState.types.drift.test.ts` (runtime assertion, D-24372); the executor
   confirms it in the Play Diagnostics `uiStateSnapshot`. `heistRevealedCardId` is NOT projected.
10. **Client** (`MoveVillainChoicePrompt.vue`): with `variant === 'x-con-security-van'` the heading AND the region
    `aria-label` (~l.224–226) read `X-Con Security Van: move a Villain to an empty space`, step 2 lists only empty City
    spaces (never "swap with …"), and a note reads `If you move a Villain, you KO one of your Heroes.`; without it,
    rendering is unchanged. `PendingSeatChoicePrompt.vue` gets the one heading `case` (item 6).
11. **Bot answers** (never reached while bots do not Heist): `selectDefaultMoveVillainArgs` returns `{ decline: true }` for
    the variant. This one is load-bearing: today it answers a possibly occupied space, which the variant rejects, so a
    simulation would hang. `chooseByKind` returns the leave option (1) for the shuffle kind (belt-and-braces; `null`
    already falls back to `defaultOptionIndex`).
12. **Ledger comment:** `scripts/hero-mechanic-ledger.mjs` ~l.174–177 describes the four lines as hollow; refresh that
    comment only (no logic change).
13. **Tests**: the EC Locked list.
14. **Regen + feeds**: `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
    `pnpm sim:coverage --update-baseline`, the dashboard copies, and the `live-verify.json` rows (below).

## Out of Scope

- **Bot Heist attempts** (`getLegalMoves`, bot policy, simulation loop mirrors, server autoplay): a named follow-up WP with
  its own D-entry (see Context).
- Villain Fight-time Heist (Ghost Chasers: Sonny Burch's Goons, Anitolov, Sonny Burch) and the Safeguard Dark Secrets scheme
  ability; "fought any Enemies with Heist abilities" as a Heist trigger.
- Infiltrate line 1 (shipped by WP-866) and Anything for Cassie line 0 (Wound return).
- A notable-event VFX beat for a Heist; any change to the six WP-865 lines, the Heist Count, the VP rule or the move.
- Any `HeroAbilityTiming`, `LOG_OUTCOMES`, `CORE_MOVE_NAMES`, `getLegalMoves` or `MatchSetupConfig` change; a new move; a new
  client component. Hand-editing `data/cards/*.json`.

## Files Expected to Change

- **Engine source:**
  - `packages/game-engine/src/rules/heroKeywords.ts` (three keywords)
  - `packages/game-engine/src/rules/heroCountSource.ts` (one source)
  - `packages/game-engine/src/hero/heroCountSource.resolve.ts`, `hero/countSourceLabel.ts` (source arms)
  - `packages/game-engine/src/setup/heroAbility.setup.ts` (`HEIST_CARDS` +4)
  - `packages/game-engine/src/hero/heistPayloads.logic.ts` (**new**)
  - `packages/game-engine/src/hero/heroEffects.execute.ts` (three handlers + keyword sets)
  - `packages/game-engine/src/economy/{economy.types,economy.logic}.ts` (`heistRevealedCardId`, `markHeistAttempted`)
  - `packages/game-engine/src/moves/attemptHeist.ts` (pass the revealed id)
  - `packages/game-engine/src/types.ts` (`PendingMoveVillainChoice.variant?`)
  - `packages/game-engine/src/moves/moveVillainChoice.resolve.ts` (variant branch)
  - `packages/game-engine/src/villain/villainEffects.execute.ts` (new export `koOneOfYourHeroes`; `villainEffectKoHero`
    untouched)
  - `packages/game-engine/src/moves/seatChoice.resolve.ts` (shuffle apply arm)
  - `packages/game-engine/src/simulation/{ai.legalMoves,ai.seatChoice}.ts` (bot answers)
  - `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts` (`variant`)
  - `packages/game-engine/src/index.ts`: **not modified**.
- **Client:** `apps/arena-client/src/components/play/MoveVillainChoicePrompt.{vue,test.ts}` (the X-Con rendering) and
  `apps/arena-client/src/components/play/PendingSeatChoicePrompt.{vue,test.ts}` (one heading `case`).
- **Data:** `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`
  (token forms), `data/cards/amwp.json` (generated), `scripts/hero-mechanic-ledger.mjs` (comment refresh only, ~l.174–177).
- **Generated:** `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, `scripts/coverage/mechanic-provenance.json` (three hand-added
  `{ "wp": "WP-876", "decision": "D-24823" }` rows for the new keywords, the WP-866 precedent; no regen writes it), `docs/ai/coverage/live-verify.json` (the existing `amwp/scott-lang-cat-burglar|heist` and `amwp/ant-army|heist` rows
  reset to operator-pending naming the four lines; one row per key), the `apps/dashboard/src/data/*` copies the regen
  rewrites, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (only if its pin moves).
- **Engine tests:**
  - **new:** `hero/heistPayloads.test.ts`;
  - **modified:** `setup/heistFusion.test.ts` (four hollows become fusions), `moves/attemptHeist.test.ts`,
    `moves/moveVillainChoice.resolve.test.ts`, `economy/economy.logic.test.ts`, `hero/heroCountSource.resolve.test.ts`,
    `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts`, `simulation/ai.legalMoves.test.ts` (the variant
    decline, through `getLegalMoves`; `selectDefaultMoveVillainArgs` is private) and `simulation/ai.seatChoice.test.ts`;
  - **count pins that move by exactly +3** (three keywords, three handlers): `rules/heroKeywords.test.ts` (~l.70),
    `rules/heroAbility.setup.test.ts` (ordered `HERO_KEYWORDS` list ~l.596–700), `setup/heroAbility.setup.test.ts`
    (~l.1605), `hero/heroEffects.execute.test.ts` (~l.154, ~l.8123). At `a84d3041`: `HERO_KEYWORDS` 95 → 98,
    `HERO_EFFECT_HANDLERS` 74 → 77. `HERO_COUNT_SOURCES` 18 → 19 (`hero/heroCountSource.resolve.test.ts` ~l.83 plus its
    ordered list). Read each value at HEAD. That is an intentional product change, stated in the commit.
- **Governance at close:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24823), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code
  (`docs/ai/REFERENCE/00.6-code-style.md`).
- **Determinism:** the only randomness is the optional Villain Deck shuffle, through the seat-choice apply's
  `shuffleContext.random` (never `Math.random`). No clock, I/O or registry read in a handler, the payload module, the
  resolver or the move. `G` gains only JSON-serializable plain data: `CardExtId` strings, flags, numbers and the string
  literals this WP locks (the `variant` discriminant and the `heist-shuffle-villain-deck` seat choice's kind and option
  labels); no functions, Maps, Sets or class instances.
- **Moves never throw**; handlers never throw; an invalid answer is a silent no-op that leaves the choice open.
- **Gameplay unchanged** outside the four lines: every other card's hooks are byte-identical; Spinning Cyclone and every
  villain `ko-hero` caller behave and log byte-identically; the core sentinel / `finalStateHash` / PAR pins must not move.
  A moved pin is a STOP, never a re-pin.
- **Fire order:** the payloads fire only from `fireHeistPlays` on a won Heist, in readying order; nothing fires at play.
- **Revealed card:** the type checks read `heistRevealedCardId`, never the live `deck[0]`; only The Big Score's KO also
  requires the id to still be `deck[0]`.
- **UIState:** `variant` passes the five-step contract and reaches only the choosing player.
- **Code style:** no `.reduce()`, no nested ternaries, JSDoc on every function, full-sentence log text; boolean names
  `is/has/can`.
- `data/cards/amwp.json` changes only through `apply-hero-ability-markers.mjs`; `pnpm cards:check` stays 0.

**Session protocol:** STOP and report if the HEAD re-probe of the four parses differs from the locked `heistEffects`, if
any core sentinel / `finalStateHash` / PAR pin moves, if a Spinning Cyclone or villain `ko-hero` test needs editing, or if a
test passes only by editing a pin other than the listed count pins.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- **Engine:** the three `HeroKeyword`s; the `distinct-costs-you-have` `HeroCountSource`; `HEIST_CARDS` (ten keys);
  `TurnEconomy.heistRevealedCardId?`; `markHeistAttempted(economy, revealedCardId)`; the seat-choice kind
  `heist-shuffle-villain-deck`; `PendingMoveVillainChoice.variant?`; `UIPendingMoveVillainChoice.variant?`; the exported
  `koOneOfYourHeroes(G, playerID)` (discriminated-union result).
- **Client:** the X-Con rendering of `MoveVillainChoicePrompt.vue`; the shuffle heading `case` in
  `PendingSeatChoicePrompt.vue`.
- Every rule interpretation is locked in D-24823.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic &
Reproducible Evaluation).

- **No conflict:** four printed abilities that fire nothing today resolve as printed under the published Heist rule.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; printed hero abilities, nothing bought.
- **Determinism preservation:** the one shuffle runs through `ctx.random` in a move; the new fields are lazy and absent in
  matches without these cards, so core sentinels are byte-identical; seed-PAR is scheme-keyed and hero-agnostic. Every
  match since WP-865 that attempted any Heist gains `heistRevealedCardId` in `G` on re-execution, so its re-executed state
  hash differs, and matches that played one of the four also diverge in play. Stored `competitive_scores` rows stay
  frozen: the hash is checked only at submission (`competition.logic.ts` ~l.833, D-24616 §5). In-flight matches keep their setup-built hooks; a NEW match is needed to see the change.

## Funding Surface Gate

N/A. No funding, pricing, navigation or account surface.

## API Catalog Update

N/A. No HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. **Parse:** from committed data, each of the four cards yields exactly one `heist` hook whose `heistEffects`
   deep-equal the locked list (§Context table) and contain no `'heist'` descriptor; no `heist` hollow remains in `amwp`;
   Revolutionary Anthem lines 0 and 1 are unchanged; the six WP-865 fusions are unchanged.
2. **Readied, not paid:** playing any of the four through `executeHeroEffects` logs the readied line, changes no resource
   and parks no choice. A turn whose only Heist card is one of the four makes `isHeistAvailable` true, so
   `economy.heistAvailable` is set and the Attempt Heist button shows (the `bo4ZSQLBuQU` turn 6 case).
3. **The Big Score** on a won Heist: +4 Attack; with a revealed Master Strike still on top, that Master Strike is in
   `G.ko`, the Bystander Deck is one shorter and its card is the new `villainDeck.deck[0]` typed `'bystander'`; with an
   empty Bystander Deck the Strike is KO'd and nothing is put on top; any other revealed type changes no zone. A second
   Big Score in the same Heist KOs nothing (the "no longer on top" line).
4. **Revolutionary Anthem** on a won Heist: +2 Attack; with a revealed Scheme Twist, +4 total and one
   `heist-shuffle-villain-deck` seat choice for the active player; choosing Shuffle reorders the deck through
   `random.Shuffle` (same multiset), choosing Leave keeps it identical. Two Anthems give +8 and one prompt.
5. **Putting a Crew Together** on a won Heist: +1 Attack per distinct printed cost over hand plus
   `playedCardIdsThisTurn` plus controlled Hero Artifacts, 0 counted once, Wounds and Bystanders ignored, counted when it fires (a card an earlier Heist
   ability drew counts). A controlled Hero Artifact's cost counts once even if it is also in the played list. A played
   card that went Out of Time this turn still counts (the case the Heist Count excludes);
   a played card that moved elsewhere mid-turn (KO, discard, deck) and is not ledgered does not (the accepted residual).
6. **X-Con Security Van** on a won Heist: with a Villain and an empty space, a `variant: 'x-con-security-van'` move choice
   parks. An occupied destination is rejected with the choice still open. A move to an empty space rescues nothing, then
   KOs one Hero (auto when forced, else the `ko-hero` choice over hand + in play). A decline moves and KOs nothing. With no
   Villain or no empty space, nothing parks and a `blocked` line logs.
7. **Order and open choices** (`moves/attemptHeist.test.ts`): a Heist with several of the ten cards fires them in readying
   order, and the revealed-type checks read `heistRevealedCardId`, not the live top. With a revealed Scheme Twist, Anthem
   and X-Con both park; resolving either leaves the other open and resolvable. An X-Con move while a second X-Con entry is
   still queued parks the `ko-hero` choice and keeps that entry.
8. **Unchanged:** Spinning Cyclone's choice (swap, rescue, logs) and every villain `ko-hero` path pass their existing tests
   unedited.
9. **UIState:** the chooser's `pendingMoveVillainChoice.variant` is `'x-con-security-van'` exactly for the X-Con entry and
   absent otherwise; opponents and spectators get no prompt.
10. **Client:** with the variant, the move prompt shows the X-Con heading (also its `aria-label`) and note and offers only
    empty spaces (on a five- and a six-space City, the offered set equals the engine's empty indices); without it,
    unchanged. The shuffle seat choice renders the heading
    `Revolutionary Anthem: shuffle the Villain Deck?` with the two locked option labels.
11. **Bots:** the bot declines the X-Con variant and leaves the deck unshuffled.
12. **Builds and tests:** `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0;
    no existing test weakened or skipped; no pin literal edited except the listed count pins.

## Verification Steps

1. `pnpm -r build`, then `pnpm -r --no-bail test`, then `pnpm --filter @legendary-arena/arena-client typecheck` (0). Record
   each package's count.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate`, `pnpm cards:check`,
   `pnpm cards:count-markers:check`: 0.
3. In order: `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
   `pnpm sim:coverage --update-baseline`; then `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`,
   `sim:runtime-observed:check`, `sim:coverage --check`: 0.
4. Dashboard: `pnpm --filter dashboard prebuild:coverage`, then `test:coverage`: 0.
5. `pnpm ledger:numbers:check`, `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`: 0.
6. `git diff --name-only origin/main` ⊆ Files Expected to Change.
7. **D-24026** (after deploy, NEW operator match with Scott Lang, Cat Burglar and Ant Army on play.legendary-arena.com, the
   `reference_operator_match_live_verify_recipe` Workshop path):
   - X-Con Security Van alone shows Attempt Heist; a won Heist opens the empty-spaces-only prompt; moving a Villain asks for
     (or auto-KOs) a Hero.
   - The Big Score with a Master Strike staged on the Villain Deck top: the Strike is KO'd and a Bystander is on top.
   - Revolutionary Anthem with a Scheme Twist on top: +4 and the Shuffle prompt.
   - Putting a Crew Together: Attack equals the distinct costs over hand plus the cards played this turn.
   - No `parse-unrecognized` `heist` line in the log.
   - The Play Diagnostics `uiStateSnapshot` shows `pendingMoveVillainChoice.variant: 'x-con-security-van'` for the chooser
     (UIState contract step 5).

## Definition of Done

- All Acceptance Criteria hold, with the Verification Steps' commands and output tails pasted in the PR.
- Two-commit topology: `EC-914:` implementation; a `SPEC:` close with D-24823 Active, a dated STATUS entry, WORK_INDEX
  `[x]`, EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`, NUMBER-LEDGER LANDED.
- Live-on-surface (D-24026): Verification Step 7 confirmed in a match created after the deploy
  (`isMatchOlderThanServer: false`), log lines as evidence; until then recorded operator-pending in `STATUS.md` with the
  two `live-verify.json` rows.
- No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

**D-24823 — The four deferred Heist lines.**

1. **Allowlist.** All ten `amwp` Heist lines fuse (`HEIST_CARDS`); the hollow branch remains for future sets.
2. **Revealed card.** `attemptHeist` records `heistRevealedCardId` when it latches; "the card revealed" checks read that id's
   type, never the live top. The Big Score's KO also needs the id still on top, so only the first Big Score of a Heist KOs.
3. **The Big Score.** A revealed Master Strike is KO'd from the Villain Deck top and the Bystander Deck's front card goes on
   top, typed `'bystander'` when untyped (the WWII precedent). An empty Bystander Deck still KOs the Strike. If that
   empties the Villain Deck, the shipped per-move latch arms the final turn or a Villain-Deck scheme loss (`game.ts`
   ~l.883, `endgame/finalTurn.logic.ts` ~l.37); that is faithful, not a defect.
4. **Revolutionary Anthem.** A revealed Scheme Twist adds +N Attack through the shipped attack path and offers one
   `heist-shuffle-villain-deck` seat choice to the active player (Shuffle / Leave, default Leave); one prompt per Heist.
5. **Putting a Crew Together.** `distinct-costs-you-have` = distinct printed costs over "cards you have" = hand plus
   `playedCardIdsThisTurn` plus controlled Hero Artifacts (rules v23 ~l.2164–2167, ~l.3443–3447, ~l.930), 0 included, Wounds and Bystanders excluded, counted at
   fire time. It is deliberately wider than the "Heroes you have" pool of the Heist Count and Outwit. Accepted residual:
   a played card that moved elsewhere mid-turn (KO, discard, deck) and is not ledgered does not count.
6. **X-Con Security Van.** A `PendingMoveVillainChoice` with `variant: 'x-con-security-van'`: empty destination only, no
   rescue, then KO one of your Heroes via `koOneOfYourHeroes` (auto when forced, else the `ko-hero` choice over hand +
   in play); a decline does nothing; nothing to move parks nothing.
7. **Bots.** Bot Heist attempts stay out of scope (a follow-up with its own D); the new surfaces answer decline / leave.
8. **Choices open together.** Heist choices (X-Con move, `ko-hero`, the Anthem shuffle) may be open at the same time and
   resolve in any order (the rule's "in any order"); no cross-gating, each resolves independently.

## Pre-flight (01.4) and Copilot (01.7)

**Pre-flight (01.4): READY TO EXECUTE** (2026-11-08, one independent subagent, four passes; pass 4 re-confirmed READY
after the copilot and 00.3 lint fold-ins).

- **Pass 1: NOT READY.** Two blocking items, both folded in:
  - PS-1: a byte-identical extraction from `villainEffectKoHero` was impossible, because it runs one owed-loop and returns
    targets for its narration. It became the new export `koOneOfYourHeroes`, and `villainEffectKoHero` is untouched.
  - PS-2: `PendingSeatChoicePrompt.vue` titles each kind, so the shuffle heading `case` and its test joined scope.
  - Ten clarifying items were folded in too: the explain arm; `VALID_TOKEN_PATTERN` line refs; the bot test files;
    `markHeistAttempted` takes a required id; the replay note; the `aria-label`; where the shuffle apply lives; the ledger
    comment; the "Why now" wording; and the empty-deck note in D §3.
- **Pass 2: READY.** Three wording nits were folded in: the three `markHeistAttempted` test calls, the Layer headers and
  the Red Skull model, and "sim pins" reworded so the hollow and coverage feeds regenerate while sentinel / hash / PAR
  pins hold.
- **Pass 3: READY**, re-run after the copilot's pool change. The new pool claims were checked at HEAD. Three wording
  nits were folded in.
- **Verified against code at HEAD:**
  - the magnitude pre-gate and parser magnitude;
  - the forwarded `events`;
  - an active-player seat choice;
  - choices open at once;
  - the count pins (95 → 98, 74 → 77, 18 → 19);
  - every lockstep site and precedent citation.

**Copilot (01.7): PASS** (2026-11-08, one independent subagent, two RISK / HOLD passes, then a PASS confirmation of the
last fold-in).

- **Pass 1: RISK / HOLD.** Eight findings, all folded in:
  - F1: Putting a Crew Together's pool was "Heroes you have". It is now the rulebook's "cards you have": hand plus
    `playedCardIdsThisTurn`. This was a scope change, so pre-flight re-ran.
  - F2: several choices open at once. Added a Context paragraph, AC 7's open-choices half and D §8.
  - F3: the payload module is "G-mutating", not "pure".
  - F4: `koOneOfYourHeroes` returns a discriminated union.
  - F5: an empty space is `G.city[i] === null`, tested on five- and six-space Cities.
  - F6: a Play Diagnostics check is in Verification Step 7.
  - F7: the X-Con path is its own function, `resolveXConSecurityVanMove`.
  - F8: this section.
- **Pass 2: RISK / HOLD on one low item.** Hero Artifacts you control were missing from the pool. They now join it (the
  distinct-classes collector precedent), with an AC 5 case; the Assumes nit about Ritual Artifacts is fixed too.
- **Pass 3 (confirmation): PASS.**
- **Documented, accepted:**
  - Putting a Crew Together's pool is a rules reading recorded in D-24823 §5. A played card that moved elsewhere
    mid-turn and is not ledgered does not count.
  - Bots never attempt a Heist (D §7), so bots never reach the new choices.

**Papercut seen in passing, out of scope:** `apps/arena-client/src/pages/PlayDesktop.vue` ~l.1241 and its `PlayMobile.vue`
twin say the engine guarantees at most one pending-choice type is open. This WP makes that false: several Heist choices can
be open together. The prompts self-gate, so nothing breaks. Fix the comment in its own commit.

## Lint Gate Self-Review (00.3)

Independent subagent, 2026-11-08. The first pass had two FAILs, both now fixed:

- §2: the Determinism constraint said `G` holds only `CardExtId` strings, flags and numbers. The `variant` literal and the
  shuffle seat choice's kind and option labels contradicted it. It now says JSON-serializable plain data and names them.
- §14: there were 13 Acceptance Criteria (1–12 plus 7b). 7 and 7b are merged into one Order-and-open-choices item, and the
  EC Tests line and the copilot F2 note now point to it.

Also folded in: the `mechanic-provenance.json` rows are hand-added (the WP-866 precedent), and the
`endgame/finalTurn.logic.ts` path is corrected.

Result after the fixes:

- **§1 structure:** all template sections present.
  - Out of Scope names bot Heist attempts, Enemy / scheme Heist, Infiltrate line 1 / Cassie line 0, VFX and the six WP-865
    lines.
  - It also names timing / outcome / core-move / legal-move / setup changes, and hand-edited card data.
  - **PASS.**
- **§2 constraints:** full-file output, no diffs or snippets, ESM, Node v22+, `00.6-code-style.md` cited.
  - Packet-specific: the one shuffle goes through `shuffleContext.random`; nothing throws; gameplay is byte-identical
    outside the four lines; fire order; the recorded revealed card; five-step UIState; pipeline-only card data;
    JSON-serializable `G`.
  - Session protocol present; locked values → EC.
  - **PASS.**
- **§3 Assumes:** baseline `a84d3041` + reserve #3236, the rule text, the four lines, the scaffold probe, every reused helper
  and precedent with its location (spot-checked at HEAD), and the bot and fixture state. **PASS.**
- **§4 Context:** why now, what changes from WP-865, the revealed card is recorded rather than re-read, the "cards you have"
  pool, choices open together, the X-Con and Anthem shapes, bots out, one WP not a split, and test-authoring notes.
  - Cites ARCHITECTURE §Principles #2 / §Layer Boundary / §Card Data Flow, rules §UIState, 00.2 §5 / §5.1,
    03-DATA-PIPELINE §1, 00.6 and the DECISIONS scan list.
  - **PASS.**
- **§5 files:** engine, client, data, generated, test, pin and close files, with the one new module marked. The list goes
  past ~8 only through lockstep pins, regen and governance, and Context argues against a split. **PASS.**
- **§6 naming:** no 00.2 or setup field touched; markers use the 00.2 §5.1 `[keyword:X]` form; every cited path exists at
  HEAD. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency.
  - The engine decides: it rejects an occupied X-Con destination.
  - The projection goes through the filter whitelist.
  - The payload module has no `boardgame.io` import, and `index.ts` is unchanged.
  - **PASS.**
- **§9:** `pnpm` / `node` / `git` only. **PASS.**
- **§10 / §11:** no env var, no auth surface. **N/A.**
- **§12 tests:** `.test.ts`, `makeMockCtx`, committed data through the `getSet` stub, no `boardgame.io/testing`, no network
  or DB. Nothing builds a deck, so the golden test is N/A. **PASS.**
- **§13 verification:** every named script exists at HEAD. **PASS.** The commands, each with its expected exit:
  - arena-client `typecheck`;
  - the marker `--validate`;
  - the regen chain and its `:check`s;
  - the dashboard coverage pair;
  - the governance checks;
  - the scope diff;
  - the D-24026 live steps.
- **§14:** 12 binary criteria tied to hooks, zones, counts, fields, prompts and bot answers. **PASS.**
- **§15 / §15.1 / §15.2:** the DoD names STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the ledger, plus the
  scope-boundary diff check and a D-24026 live item on a post-deploy match. `**Risk Tier:** MEDIUM` is mirrored verbatim
  in the EC. **PASS.**
- **§16 code style:** no `.reduce()` or nested ternaries; JSDoc on every function; `is…` booleans; `// why:` sites locked
  in the EC. Each new helper follows the file's `collect*` pattern, is a size split, or is a module-access export.
  **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, a no-conflict line, an NG-1 line and a determinism line. The determinism line
  covers the shuffle through `ctx.random`, the lazy fields, byte-identical core sentinels and the replay-hash note.
  **PASS.**
- **§18:** no literal-grep verification step. **N/A.**
- **§19:** commit-time rule. **N/A.**
- **§20 funding / §21 API catalog:** N/A, with the statements above. **PASS.**
- **EC:** 92 content lines (ceiling 100); arena-client `typecheck` in Before Starting and After Completing; mindmap and
  `roadmap:counts` gated.
