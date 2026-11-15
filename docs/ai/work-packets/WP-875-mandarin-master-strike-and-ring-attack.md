# WP-875 — The Mandarin: Master Strike sends a Ring back into the City, Rings get +1 Attack, The Mandarin gets -1 Attack per Ring in Victory Piles (Game Engine + coverage data)

**Status:** Draft 2026-11-07 (EC-913; D-24822 reserved, PR #3230)
**Layer:** Game Engine (one Master Strike arm, one owed-entry queue opened from `onMove`, one seat-choice kind, two fight-cost
terms) + coverage data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules (fight costs, City entries and escapes, Wounds, a multi-seat choice) and one new lazily
created hashed `G` queue; no auth, money, persistence or server surface
**Hard-deps:** WP-386 / WP-388 (the `mastermindStrikeHandler` dispatcher) ✅, WP-867 / D-24810 (the hollow-strike `else` arm and
`strike-provenance.json`) ✅, WP-818 / D-24752 (Baron Zemo: the each-player Victory Pile strike, the id-keyed mastermind cost term)
✅, WP-684 (`G.pendingSeatChoice`, `parkSeatChoice`, `applySeatChoiceByKind`) ✅, WP-845 / D-24779 (a strike-owed queue opened
from `onMove`; the D-24743 park rule) ✅, WP-868 / D-24811 (a Victory Pile card re-entering the City without a reveal) ✅,
WP-870 / D-24815 (the WP-828 queue lockstep footprint, the last one landed) ✅, WP-846 / D-24780 (current player first) ✅,
WP-803 / D-24803 (each Mandarin's Rings copy is its own card, `henchman-mandarins-rings-NN`) ✅

## Goal

The Mandarin (rvlt, `rvlt/mandarin`) prints three lines on his base face, and none of them does anything today. Operator match
`sA9BHfHXbB7` (WP-870 live-verify, 2026-11-07) showed Zero's fight cost as 3 (printed 3, +1 from The Mandarin → 4), The Mandarin's
cost unaffected by the Rings in Victory Piles, and his Master Strike as the only hollow effect in the match (`master-strike` /
`no-handler`, the WP-867 arm). After this WP:

- **"All Mandarin's Rings get +1 Attack."** Every Mandarin's Rings card costs 1 more to fight while The Mandarin is the match's
  Mastermind, wherever it is fought.
- **"Mandarin gets -1 Attack for each Mandarin's Ring among all players' Victory Piles. (-3 Attack for each in solo.)"** The
  Mandarin's fight cost drops by 1 per Ring in every player's Victory Pile (3 per Ring in a one-seat match), never below 0.
- **"Master Strike: Each player chooses a Mandarin's Ring from their Victory Pile to enter the city. Any player who didn't have a
  Ring gains a Wound instead."** A player with no Ring gains a Wound. A player with one Ring sends it into the City. A player
  with two or more chooses which one; then the chosen Rings enter the City, current player first.

## User-Visible Impact

`play.legendary-arena.com`, in a Mandarin match created after the deploy:

- A Ring in the City shows Fight 4 (Spin, Zero, …) where it showed 3.
- The Mandarin's Fight number drops as Rings reach Victory Piles (16 → 15 → 14 …; solo 16 → 13 → 10 …).
- On a Master Strike, a player with no Ring sees `[Mandarin Master Strike] Player N had no Mandarin's Ring in their Victory Pile
  and gained a Wound.` A player holding two or more Rings gets a "Your choice" seat-choice prompt listing them by name; one Ring
  enters with no prompt. Each entry logs `[Mandarin Master Strike] Player N's <Ring> entered the City from their Victory Pile.`, the
  Ring appears in the Sewers, and a Villain pushed off the Bridge escapes.
- The strike no longer logs "Unhandled effect observed"; `/debug/effects` lists the strike as executable.

Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `e6ec73b6` (2026-11-07; WP-870 #3222, its live-verify #3225, WP-873's chip fixes #3226/#3227 and #3229 on
  main). `pnpm -r build` 0; game-engine 6643 / 0 at `7c197771` (WP-870 close); re-record at execution.
- **Strike dispatch.** `rules/mastermindHandlers.ts` `mastermindStrikeHandler` (~1458) branches on `gameState.selection.mastermindId`
  in an `if / else if` chain (~1476-1521); the terminal `else` (~1522-1538) records the WP-867 `master-strike` / `no-handler` hollow.
  Shared helpers: `resolveCurrentPlayer(context)` (~233), `seatsInTurnOrderFrom` (D-24780), `gainWoundToDiscard` /
  `describeStrikeWound` (~697-716; `'no-wound'` when the supply is empty). `resolveBaronZemoStrike` (~944-979) is the each-player
  Victory Pile shape. The handler has no `events` (the comment at ~1034-1037), so a strike cannot park a multi-seat choice inline.
  `buildGenericStrikeEffects` (~193) adds the strike count after the arm returns.
- **Strike context.** `villainDeck/villainDeck.reveal.ts` `performVillainReveal` fires `onMastermindStrikeRevealed` for a
  `mastermind-strike` card (~510-526). Every reveal path runs inside a move (`revealVillainCard`, the Scheme Twist resolvers, hero
  reveal effects), so the play-phase `turn.onMove` openers (`game.ts` ~880-980) run after the move that revealed the strike.
- **Owed-queue shape (WP-845 / WP-870).** `moves/revealOrWoundChoice.logic.ts`: `enqueueRevealOrWoundChoice` (~73) appends from an
  events-less site; `openRevealOrWoundSeatChoiceIfNeeded(G, events, currentPlayer?)` (~226-266) waits while `hasAnyPendingChoice(G)`
  (`moves/phaseCard.ts`) or `G.pendingHeroChoice` is set or `evaluateEndgame(G) !== null`, never joins `hasAnyPendingChoice` (it
  would block its own opener), and parks with the D-24743 rule (`parkRevealOrWoundSeatChoice` ~276-292: skip the stage ride only when
  the active seat is the only addressed seat). `moves/nextHandFromPlay.logic.ts` (WP-870) records an apply's answer and consumes it
  elsewhere.
- **Queue lockstep (every `pending*` owed queue).** The `pendingNextHandFromPlayPicks` footprint, at HEAD: `types.ts` ~2643 (field);
  `endgame/mastermindVictory.logic.ts` ~111 (end-of-game drop, D-24518) and `ALL_PENDING_FIELDS` in its test; `moves/operatorSetters.logic.ts`
  ~84 (`isOperatorChoiceOpen`) and its row table in `operatorSetters.test.ts`; the play `onBegin` delete (`game.ts` ~1069-1070) and its
  mirror (`simulation/onBeginParity.ts` ~152-153); the `onMove` opener (`game.ts` ~974) and its mirrors in the rebuilt loops, which
  never run `onMove` (`simulation/simulation.runner.ts` ~714 and ~824, `simulation/par.aggregator.ts` ~789 and ~879,
  `test/fixtures/runFixture.ts` ~431); the kind arm in `moves/seatChoice.resolve.ts` `applySeatChoiceByKind` (~581). The generic bot
  pieces need no change: the `getLegalMoves` seat-choice short-circuit and `simulation/ai.seatChoice.ts` (an unknown kind takes
  `defaultOptionIndex`).
- **Seat choice.** `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (`moves/seatChoice.resolve.ts` ~335);
  `applySeatChoiceByKind(G, choice, { random }, currentPlayer)` (~538-680) applies once every addressed seat has submitted, in
  ascending seat id (D-24501). Types (`types.ts`): `SeatChoiceOption` (~1463, `label`, optional `cardId`), `PendingSeatChoice` (~1532;
  `kind`, `addressedSeats`, `seatPrompts`, `submissions`, `defaultOptionIndex`). The client renders any kind under the generic
  "Your choice" heading with the option labels.
- **Victory Pile → City.** `villainDeck/villainDeck.enterCity.ts` `reenterSewersOnVillainDeckReveal` (~88-121, WP-868 / D-24811):
  `moveCardFromZone(zones.victory, [], cardId)`, `pushVillainIntoCity(G.city, cardId)` (`board/city.logic.ts` ~56, returns `{ city,
  escapedCard }`), a log, then `resolveVillainEscape(G, context, implementationMap, escapedCard)` (`villainDeck.reveal.ts` ~635) for a
  card pushed off the Bridge. No Ambush and no `onCardRevealed` hooks fire. `RevealContext` (`villainDeck.reveal.ts` ~102-107) is `{
  random: { Shuffle }, ctx: { currentPlayer, turn } }` (D-24704: `turn` is required). `moves/fightVillain.ts` ~886-895 builds one from
  a move and passes `DEFAULT_IMPLEMENTATION_MAP` (`rules/ruleRuntime.impl.ts` ~35). The rebuilt loops hold a seeded `Shuffle` and the
  turn number (`simulation.runner.ts` ~176 / ~188, `par.aggregator.ts` ~442, `runFixture.ts` ~74 / ~277).
- **Fight cost.** `economy/economy.resolve.ts`: `resolveFightCost(G, villainCardId, fightingPlayerId?)` (~102-133) is the single
  authority for a Villain or Henchman (base + scheme / keyword / passive terms − `cityFightCostReduction`, floored at 0);
  `resolveMastermindFightCost(G, fightingPlayerId?)` (~467-489) for the Mastermind (base + portal + Abomination +
  `mastermindNonSaviorBonus` − reduction, floored at 0). `mastermindNonSaviorBonus` (~499-519, Baron Zemo) is the id-keyed term
  precedent. Every reader goes through them: `fightVillain` (~228), `fightMastermind` (~174), `fortifyFight` (~88),
  `villainDefeatRequirement.logic.ts` (~487), the bot (`ai.legalMoves.ts` ~1182 / ~1229, `ai.seatChoice.ts` ~291), hero effects
  (`heroEffects.execute.ts` ~5550 / ~5562), and the UIState `fightCost` projections (`ui/uiState.build.ts` ~774, ~1061 through
  `resolveFightPrice`, ~1178 through `resolveMastermindFightPrice`). The client never recomputes a cost. Four sites read a card's
  **printed** Attack on purpose and stay printed: `moves/resolveVictoryPileCardPick.ts` ~177 (Ebony Blade: a Ring grants 3),
  `ui/uiState.build.ts` ~2223, `simulation/ai.legalMoves.ts` ~692-694 and `rules/clashMonsterPit.logic.ts` ~130.
- **Ids.** The Mandarin's id is `rvlt/mandarin` (`G.selection.mastermindId`); base card `rvlt-mastermind-mandarin-mandarin`, printed
  `vAttack` 16 (`data/cards/rvlt.json` ~1154-1233). Ring instances are `henchman-mandarins-rings-00` … `-09` (`villainDeck.setup.ts`
  ~251-256; D-24803 maps one copy per printed Ring), printed `vAttack` 3, 1 VP, no Ambush. A Victory Pile is
  `G.playerZones[id].victory: CardExtId[]`. No player-count field exists on `G`; `Object.keys(G.playerZones).length` is the
  precedent read (`rules/schemeResourceLoss.ts` ~183).
- **Helpers the new code imports** (module paths at HEAD, `packages/game-engine/src/`): `moves/zoneOps.ts` `moveCardFromZone`;
  `board/city.logic.ts` `pushVillainIntoCity`; `endgame/endgame.evaluate.ts` `evaluateEndgame`; `endgame/finalTurn.logic.ts`
  `latchFinalTurnIfDeckExhausted`; `rules/schemeResourceLoss.ts` `applyPileDepletionResourceLoss`; `log/logDisplay.ts`
  `resolveCardName` / `formatCardRef`; `log/logPush.ts` `pushLog`; `turn/seatOrder.logic.ts` `seatsInTurnOrderFrom`;
  `moves/phaseCard.ts` `hasAnyPendingChoice`; `villainDeck/villainEscapeProcedure.ts` `openEscapeProcedureSeatChoiceIfNeeded` /
  `ESCAPE_HQ_KO_KIND` (`'escape-hq-ko'`, ~69); `rules/ruleRuntime.impl.ts` `DEFAULT_IMPLEMENTATION_MAP`. `game.ts` already imports
  the escape opener, the latch, the pile check and the map; the three loop files already import the escape and reveal-or-wound
  openers and newly import `openMandarinRingEntriesIfNeeded` and `DEFAULT_IMPLEMENTATION_MAP`.
- **Epic.** Setup takes the first non-tactic face only (D-24193; `mastermind/mastermind.setup.ts` ~407-424), so Epic Mandarin
  cannot be selected.
- **Coverage.** `scripts/coverage/strike-provenance.json` overlays status / handler / wp / decision onto the one Master Strike row
  per Mastermind that `scripts/build-effect-implementation-index.mjs` enumerates; `rvlt-mastermind-mandarin-master-strike` is
  `unmarked` today. `rules/mastermindStrike.unresolved.test.ts` ~273 pins `checkedCount` at 13 (every executable / deferred overlay
  row reaches an arm). Live-verify keys for strikes are `mastermind:<set>/<slug>|master-strike` (`docs/ai/coverage/live-verify.json`).

## Context (Read First)

- **Why an owed queue.** "Each player chooses" is a real choice: the ten Rings are different cards with different Fight lines, so
  the Ring a player sends back is the one they will fight again. A strike has no `events`, so the choice is queued and opened from
  `onMove`, the WP-845 / WP-870 shape. Auto-picking (the Arnim Zola / Baron Zemo precedent) was the cheaper option and was not
  taken: those strikes pick among cards that are interchangeable for the strike, and Rings are not.
- **Why the City entry happens in the opener, not the seat-choice apply.** An entry can push a Villain out of the City, and the
  escape needs a `RevealContext` with the turn and the implementation map. `applySeatChoiceByKind` has neither, while the `onMove`
  opener (and each rebuilt loop) has both. So the apply only records the answer; the opener moves the cards. That also gives one
  entry site and one order for single-Ring and multi-Ring players.
- **Order.** Choices are simultaneous (one seat choice for every player with two or more Rings); the entries then run in queue order,
  which is turn order from the current player (D-24780). Wounds are gained at strike time, in the same loop that queues the
  entries: a Wound and a City entry never touch the same zone, so splitting them changes nothing a player can see except log order.
- **Why read-time cost terms.** Both passives depend on live state (which Rings are where) and only exist while The Mandarin leads.
  An id-keyed term in each single authority (the `mastermindNonSaviorBonus` shape) changes every reader at once, with no new `G` field
  and no setup table, and a non-Mandarin match is byte-identical.
- **Determinism / hash.** One new lazily created hashed field, `G.pendingMandarinRingEntries` (never seeded, so no fixture creates
  it). No randomness. The cost terms read `G` only. Sentinels are core-only, so none moves. Replays of pre-WP-875 Mandarin matches
  diverge (a Ring's cost, The Mandarin's cost and every strike); stored competitive rows stay frozen (D-24616 §5).
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, §Zone & Pile Structure, Principle #1. Scan D-24752,
  D-24779, D-24743, D-24501, D-24518, D-24704, D-24780, D-24803, D-24810, D-24811, D-24815, D-24193 and D-24616 in
  `docs/ai/DECISIONS.md`. `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — Ring identity and the cost terms (default locked)

New module `mastermind/mandarin.logic.ts`: boardgame.io-free, registry-free, no `villainDeck/` import, no I/O; the readers are pure,
the queue and apply helpers mutate `G` in place. Every removal from the queue (here or in the opener) deletes the queue when it
empties, so an empty array never sits in hashed `G`:

- `MANDARIN_MASTERMIND_ID = 'rvlt/mandarin'`, `MANDARIN_RING_ID_PREFIX = 'henchman-mandarins-rings-'`,
  `MANDARIN_RING_ATTACK_BONUS = 1`, `MANDARIN_RING_VICTORY_REDUCTION = 1`, `MANDARIN_RING_VICTORY_REDUCTION_SOLO = 3`.
- `isMandarinRingCardId(cardId): boolean` → `cardId.startsWith(MANDARIN_RING_ID_PREFIX)`.
- `listMandarinRingsInVictoryPile(victory: readonly CardExtId[]): CardExtId[]` (pile order).
- `countMandarinRingsInAllVictoryPiles(G): number` (every `G.playerZones` seat).
- `isMandarinLeading(G): boolean` → `G.selection?.mastermindId === MANDARIN_MASTERMIND_ID`.
- `mandarinRingAttackBonus(G, cardId): number` → `MANDARIN_RING_ATTACK_BONUS` when `isMandarinLeading(G)` and
  `isMandarinRingCardId(cardId)`, else 0.
- `mandarinVictoryPileAttackReduction(G): number` → 0 unless `isMandarinLeading(G)`; else the count × (`Object.keys(G.playerZones).length
  === 1` ? solo : normal), written as `if / else`. A solo match with a bot ally has two seats, so it is not solo: the bot is a player.
- `MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND = 'mandarin-ring-entry'` (here, not in the opener module, so `seatChoice.resolve.ts` imports
  only this module), `queueMandarinRingEntry(G, playerID)`, `countQueuedMandarinRingEntries(G, playerID): number`,
  `applyMandarinRingEntryResolvedSeatChoice(G, choice)` (RS-2, RS-3).

`economy/economy.resolve.ts`: `resolveFightCost` adds `mandarinRingAttackBonus(G, villainCardId)` to `costBeforeReduction`;
`resolveMastermindFightCost` subtracts `mandarinVictoryPileAttackReduction(G)` inside the existing `Math.max(0, …)`. Nothing else
changes there.

### RS-2 — The strike (default locked)

`rules/mastermindHandlers.ts`: an `else if (mastermindId === MANDARIN_MASTERMIND_ID)` arm before the terminal `else` calls
`resolveMandarinStrike(gameState, currentPlayer: string | null)` with `resolveCurrentPlayer(strikeContext)` (null in stub contexts;
`seatsInTurnOrderFrom` already handles it, as Zemo's does, so no non-null guard). For each seat in
`seatsInTurnOrderFrom(Object.keys(gameState.playerZones), currentPlayer)`:

- **No available Ring** (see below) → `gainWoundToDiscard(gameState, seat)`; log `[Mandarin Master Strike] Player ${seat} had
  no Mandarin's Ring in their Victory Pile and ${describeStrikeWound(outcome)}.`, or with `'no-wound'` `[Mandarin Master Strike]
  Player ${seat} had no Mandarin's Ring in their Victory Pile and the Wound supply is empty — no effect.` (the Zemo lines).
- **At least one available Ring** → `queueMandarinRingEntry(gameState, seat)` (in `mandarin.logic.ts`: lazily creates
  `G.pendingMandarinRingEntries`, appends `{ playerID: seat }`); log `[Mandarin Master Strike] Player ${seat} will send a Mandarin's
  Ring from their Victory Pile into the City.` (`neutral`).

**Available** = the seat's Rings in its Victory Pile minus the entries already queued for that seat
(`countQueuedMandarinRingEntries(G, seat)`). A second strike in the same move (a chained reveal) therefore Wounds a seat whose only
Ring is already owed, as the printed text does when that Ring has gone; its Wound line still reads "had no Mandarin's Ring" (accepted
wording: no Ring was available to choose). The arm never moves a card and never parks a choice.

### RS-3 — The opener and the entry (default locked)

New `moves/mandarinRingEntry.logic.ts` exports `openMandarinRingEntriesIfNeeded(G, events, currentPlayer, revealContext,
implementationMap): void`:

1. No queue → return. Empty queue → delete it, return.
2. Wait (return, queue kept) while `hasAnyPendingChoice(G)` or `G.pendingHeroChoice !== undefined` or `evaluateEndgame(G) !== null`.
3. **Settle pass**, entries in queue order. A seat's **available Rings** for an entry = its Rings in Victory Pile order minus the
   `chosenCardId`s of that seat's earlier entries still in the queue. For the first unchosen entry of each seat (a seat's later
   unchosen entries wait for a later pass): none available → remove the entry from the queue (rebind; delete the queue when it empties) and log `[Mandarin Master
   Strike] Player ${playerID} no longer has a Mandarin's Ring in their Victory Pile, so none enters the City.` (`blocked`); exactly
   one → set `chosenCardId`; two or more → the seat needs a choice. Repeat the pass until it changes nothing.
4. If any seat needs a choice: park **one** seat choice, kind `MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND` (`'mandarin-ring-entry'`,
   defined in `mandarin.logic.ts`), `addressedSeats` = those seats in queue order, **each seat once**, each seat's options = its
   available Rings (`label` = `resolveCardName(G.cardDisplayData, cardId)`, `cardId`), `defaultOptionIndex: 0`; log
   `[Mandarin Master Strike] Player ${seat} chooses which Mandarin's Ring enters the City.` (`neutral`) per addressed seat (the
   seat-choice shape has no prompt field; the client shows the generic "Your choice" heading and the labels); park with the D-24743
   rule; return.
5. Otherwise (every entry chosen), drain from the **front**, one entry at a time: stop (rest stays queued) if `evaluateEndgame(G)
   !== null` or the front entry has no `chosenCardId`; else remove the front entry (rebind; delete the queue when it empties)
   **before** moving its Ring. Then: if `chosenCardId` is no longer in that seat's Victory Pile → log `[Mandarin Master Strike]
   Player ${playerID}'s ${formatCardRef(G.cardDisplayData, chosenCardId)} is no longer in their Victory Pile, so it does not enter
   the City.` (`blocked`); else `moveCardFromZone` out of the Victory Pile (rebind), `pushVillainIntoCity` (rebind `G.city`), log
   `[Mandarin Master Strike] Player ${playerID}'s ${formatCardRef(G.cardDisplayData, chosenCardId)} entered the City from their
   Victory Pile.` (`threat`), and on an `escapedCard` call `resolveVillainEscape(G, revealContext, implementationMap, escapedCard)`.
   An escape can become a Scheme Twist that reveals another Master Strike, which appends new unchosen entries mid-drain; the
   strike's owed count stays exact because finished entries left the queue first. If the drain stops on an unchosen front entry and
   `evaluateEndgame(G) === null`, return to step 2 **in the same call**, so the appended entries are settled (entered, or a parked
   choice) before the opener returns. Accepted lag: a strike chained from the *re-run* escape opener (RS-4) waits one move, like the
   Purge sweep. No log line passes a card-attribution argument.

The apply lives in `mandarin.logic.ts` (mutates `G`; keeps `seatChoice.resolve.ts` off the reveal import graph):
`applyMandarinRingEntryResolvedSeatChoice(G, choice)` sets, for each submission, the **first unchosen** entry of that seat to the
chosen option's `cardId` (an option with no `cardId` or a seat with no unchosen entry is skipped). `applySeatChoiceByKind` gets the
kind arm. The next `onMove` (after `resolveSeatChoice`) runs the opener again: a seat with a second owed entry is asked again (its
first pick excluded), and once every entry is chosen step 5 moves the cards. No Ambush fires: a Ring prints none, and re-entry from
a Victory Pile is not a reveal (the D-24811 precedent).

### RS-4 — Wiring (default locked)

- `game.ts` `onMove`, final order at the reveal-or-wound position: `openRevealOrWoundSeatChoiceIfNeeded` (existing), then
  `openMandarinRingEntriesIfNeeded(G, events, ctx.currentPlayer, { random, ctx: { currentPlayer: ctx.currentPlayer, turn: ctx.turn }
  }, DEFAULT_IMPLEMENTATION_MAP)`, then a **second** `openEscapeProcedureSeatChoiceIfNeeded`, then
  `latchFinalTurnIfDeckExhausted(G); applyPileDepletionResourceLoss(G);`, then a **second** `openRevealOrWoundSeatChoiceIfNeeded`
  (the live order today: the pair at ~935-936 precedes reveal-or-wound at ~945, so `evaluateEndgame` already sees a scheme loss, and
  the loops' mirrors run the pile check before it too). Why the pair (the
  `game.ts` ~935-936 pair: an automatic HQ KO in the re-run escape can empty the Hero Deck, and the latch stays silent for a scheme
  whose loss pile that is because the pile check runs right after it, D-24599 / `finalTurn.logic.ts` ~52-63; without the pair a
  Super Hero Civil War `SCHEME_LOSS` would wait one move, and a Final Blow could win a lost game). Then the existing Diving Block opener. `sweepPurgedHeroesFromHq` is not
  re-run: a Purge sweep after a re-run HQ refill catches up at the next `onMove` (accepted lag). The re-runs open, in the same `onMove`, the escape
  steps of a Villain a Ring entry pushed out (the escape opener otherwise runs earlier, at ~920, and its queue blocks no move) and any
  reveal-or-wound that escape owed; both openers are idempotent and wait on an open choice. Before Diving Block, so a Wave from a
  strike Wound waits until the Ring choices are answered. The new block runs only when `ctx` is present (the unit-test `{ G }` call
  shape). `onBegin`: delete the queue next to `pendingNextHandFromPlayPicks`.
- Mirrors: `simulation.runner.ts` ×2 (~711, ~821), `par.aggregator.ts` ×2 (~786, ~876), `runFixture.ts` ×1 (~427), each right
  after its `openRevealOrWoundSeatChoiceIfNeeded` call and followed by the re-run escape opener, then (runner and PAR only, which
  import it; their existing order ~706-707 / ~815-816) `applyPileDepletionResourceLoss(gameState)`, then the re-run reveal-or-wound
  opener; the loops never mirror the latch; runFixture has no depletion call. Each with `events` undefined, the loop's
  active seat and `DEFAULT_IMPLEMENTATION_MAP`. The `RevealContext` is built from the loop's own locals: in the runner and PAR
  `{ random: { Shuffle: <T>(deck: T[]): T[] => shuffleWithPrng(deck, nextRandom) }, ctx: { currentPlayer, turn } }`; in
  `runFixture.ts` the same with `cursor.currentPlayer` and `cursor.turn` (verify the local names at HEAD). Never reuse
  `seatChoiceContext` (its `ctx.currentPlayer` is the acting seat, so an escape would address the wrong chooser) or
  `dispatchedMoveContext` (undefined on the unknown-move path). `onBeginParity.ts` deletes the queue.
- `mastermindVictory.logic.ts` drops the queue (D-24518); `operatorSetters.logic.ts` `isOperatorChoiceOpen` returns true while it
  has entries.
- `types.ts`: `interface PendingMandarinRingEntry { playerID: string; chosenCardId?: CardExtId }` and
  `pendingMandarinRingEntries?: PendingMandarinRingEntry[] | undefined` on `LegendaryGameState`.

## Scope (In)

- **Cost terms** (RS-1): `mastermind/mandarin.logic.ts` (new) and the two terms in `economy/economy.resolve.ts`.
- **Strike** (RS-2): the arm, `resolveMandarinStrike` and the import in `rules/mastermindHandlers.ts`.
- **Queue, opener, apply** (RS-3, RS-4): `moves/mandarinRingEntry.logic.ts` (new), the kind arm in `moves/seatChoice.resolve.ts`, the
  `types.ts` field, and the lockstep sites (`game.ts`, `onBeginParity.ts`, the five loop mirrors, the end-of-game drop,
  `isOperatorChoiceOpen`).
- **Coverage:** `strike-provenance.json` row `rvlt-mastermind-mandarin-master-strike` `{ status: "executable", handler:
  "packages/game-engine/src/rules/mastermindHandlers.ts#resolveMandarinStrike", wp: "WP-875", decision: "D-24822" }` (the existing
  rows' shape and sorted key order); regenerated `data/metadata/effect-implementation-index.json`; three pending `live-verify.json`
  rows `mastermind:rvlt/mandarin|master-strike`, `mastermind:rvlt/mandarin|ring-attack` and
  `mastermind:rvlt/mandarin|victory-pile-ring-reduction`, each `{ key, kind: "mastermind", card: "Mandarin", ability: <the printed
  line>, wp: "WP-875", state: "pending", date, evidence: "", note }` (the existing pending-row shape).
- **Tests:** new `mastermind/mandarin.test.ts` (T1-T18 below); `rules/mastermindStrike.unresolved.test.ts` `checkedCount` 13 → 14
  (and its comment); `ALL_PENDING_FIELDS` in `endgame/mastermindVictory.logic.test.ts`; one row in `moves/operatorSetters.test.ts`. Each pin
  edit cites WP-875 / D-24822.
  - **Cost:** T1 a Ring's `resolveFightCost` is 4 in a Mandarin match, 3 in a non-Mandarin match; a non-Ring Henchman in a Mandarin
    match is unchanged; `fightVillain` on a City Ring refuses at 3 available Attack and accepts at 4; `getLegalMoves` offers that
    fight only at 4; `resolveVictoryPileCardPick` (Ebony Blade) on a Ring still grants its printed 3. T2 the City card's UIState `fightCost` for a Ring is 4. T3 `resolveMastermindFightCost`: 16 with no Rings;
    two seats with three Rings across two Victory Piles → 13; one seat with two Rings → 10; one seat with six Rings → 0 (floor). T4
    Rings in Victory Piles leave a non-Mandarin Mastermind unchanged. T5 the Mastermind UIState `fightCost` matches T3, and
    `fightMastermind` accepts exactly the reduced cost.
  - **Strike:** T6 the arm is reached (no `master-strike` hollow) and the strike count still increments. T7 a seat with no Ring
    gains a Wound with the locked line; an empty supply logs the no-effect line. T8 seats with Rings are queued in turn order from
    the current player, with no City change and no Wound at strike time.
  - **Opener:** T9 one Ring → it enters the Sewers from the Victory Pile with the locked line, no seat choice. T10 two Rings → one
    seat choice addressing that seat, options in pile order by name, default 0, City unchanged; `resolveSeatChoice` records the pick;
    the next opener call enters the chosen Ring. T11 two seats each with two Rings → one seat choice addressing both; after both
    answer, the entries run current player first (the first entrant ends in the Bank). T12 a full City → the Bridge Villain escapes
    through `resolveVillainEscape` (escaped counter +1, Escape Pile gains it), and through the `game.ts` `onMove` order (T16
    harness) its escape steps are opened in the same `onMove` (the HQ is set up with two or more eligible Heroes, and `G.pendingSeatChoice.kind === ESCAPE_HQ_KO_KIND` after `onMove`, asserted
    against the imported constant). T13 the opener waits while another seat choice is open
    and while `evaluateEndgame` is non-null. T14 a chosen Ring that left the Victory Pile → the blocked line, nothing enters, the
    queue drains. T15 lockstep: the end-of-game drop clears the queue, `isOperatorChoiceOpen` is true while queued, `onBegin` and
    `applyOnBeginParity` delete it. T16 through the real `game.ts` `onMove` (the `boardgame.io/dist/cjs/internal.js` reducer, the
    WP-411 / D-24223 exception WP-870 T17 used): a revealed strike with one Ring per seat ends the move with both Rings in the City
    and no queue. T17 two strikes in one move: a seat with one Ring is queued once and Wounded by the second strike; a seat with
    three Rings is queued twice, asked twice (one seat choice at a time, never listed twice in `addressedSeats`, its first pick
    excluded from the second), and both chosen Rings enter in queue order. T18 drain safety: an entry appended to the queue while
    step 5 runs (simulate a chained strike by queueing from a stub `onEscape`, or call `queueMandarinRingEntry` between drains in a
    harness) is settled before the opener returns (one Ring: entered; two or more: a parked `mandarin-ring-entry` choice); with
    `evaluateEndgame` non-null mid-drain the rest stays queued, unchosen. A step-3 removal of the last entry deletes the queue.
  - Expected unchanged: every `finalStateHash` sentinel, every other mastermind strike test, the WP-870 / WP-818 suites,
    `runtime-observed-hollows.json`.

## Out of Scope

- **The four Mandarin tactics** (Circles Unbroken, Dragon of Heaven Spaceship, Intertwining Powers, Rings Seek Their True Hand), all
  `unmarked`: a tactic follow-up WP (`rules/tacticHandlers.ts`); the Ring helpers here are reusable.
- **Epic Mandarin** (+2 / -2 / -6, a Wound to the top of the deck): Epic faces cannot be selected (D-24193). No top-of-deck Wound
  helper exists either.
- WP-872's Liar, Nightbringer and Remaker Fight lines; a card-specific seat-choice heading in the client.
- Any client, server, UIState-field or registry change; `replay/replay.execute.ts`; `pushVillainIntoCity`; `resolveVillainEscape`.

## Files Expected to Change

- `packages/game-engine/src/mastermind/mandarin.logic.ts`: **new**, RS-1 + the queue append + the apply.
- `packages/game-engine/src/moves/mandarinRingEntry.logic.ts`: **new**, RS-3 opener.
- `packages/game-engine/src/economy/economy.resolve.ts`: **modified**, two terms.
- `packages/game-engine/src/rules/mastermindHandlers.ts`: **modified**, the arm.
- `packages/game-engine/src/types.ts`: **modified**, the interface and field.
- `packages/game-engine/src/moves/seatChoice.resolve.ts`: **modified**, the kind arm.
- `packages/game-engine/src/game.ts`: **modified**, opener + `onBegin` delete (same-layer runtime wiring, `01.5`).
- `packages/game-engine/src/simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`,
  `test/fixtures/runFixture.ts`, `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts`: **modified**, lockstep.
- Tests: `packages/game-engine/src/mastermind/mandarin.test.ts` (**new**), `rules/mastermindStrike.unresolved.test.ts`,
  `endgame/mastermindVictory.logic.test.ts`, `moves/operatorSetters.test.ts`.
- Coverage: `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` (generated),
  `docs/ai/coverage/live-verify.json`; `docs/ai/coverage/runtime-observed-hollows.json` and
  `scripts/coverage/hero-effect-coverage.baseline.json` only if their gates report a move (expected unchanged).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24822), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O. `for` loops; no `.reduce()`, no nested ternaries. Moves, handlers and the opener never
  throw.
- One cost authority each: the two terms live only in `resolveFightCost` / `resolveMastermindFightCost`; no reader adds them again.
- Every City entry goes through `pushVillainIntoCity` and every push-out through `resolveVillainEscape`; zone writes rebind.
- `mastermind/mandarin.logic.ts` imports no boardgame.io, no registry and nothing under `villainDeck/`; `seatChoice.resolve.ts`
  imports only `mandarin.logic.ts` for this WP. No card data changes.

**Session protocol:** STOP and report if any sentinel or golden hash moves; if a non-Mandarin match's fight cost or strike changes
in any test; if an existing strike, seat-choice, escape or WP-870 test changes beyond the sanctioned pins; or if a new module cycle
appears.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `mastermind/mandarin.logic.ts` exports: the five cost / id constants, `MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND`,
  `isMandarinRingCardId`, `listMandarinRingsInVictoryPile`, `countMandarinRingsInAllVictoryPiles`, `isMandarinLeading`,
  `mandarinRingAttackBonus`, `mandarinVictoryPileAttackReduction`, `queueMandarinRingEntry`, `countQueuedMandarinRingEntries`,
  `applyMandarinRingEntryResolvedSeatChoice`.
- `moves/mandarinRingEntry.logic.ts` exports `openMandarinRingEntriesIfNeeded` only.
- `PendingMandarinRingEntry`; `G.pendingMandarinRingEntries?` (lazy, hashed, never seeded).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** three printed Mastermind lines that do nothing today resolve as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; printed card abilities only, nothing bought.
- **Determinism preservation:** no randomness; one lazy hashed queue; the cost terms are pure reads of `G`. Pre-WP-875 Mandarin
  replays diverge; stored competitive rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A: no nav, pricing or funding surface. The output is board state, fight costs and log lines.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. With The Mandarin leading, every Mandarin's Rings card's fight cost is its printed Attack + 1 at every fight-cost reader (move,
   bot, UIState `fightCost`); in any other match it is unchanged. Printed-Attack reads stay printed (Ebony Blade on a Ring grants 3)
   (RS-1).
2. The Mandarin's fight cost is 16 − 1 per Ring in all Victory Piles (− 3 per Ring with one seat), floored at 0, at every reader
   (RS-1).
3. On a Master Strike each seat with no available Ring gains a Wound (or logs the empty-supply line); each seat with one Ring sends
   it into the City; seats with two or more answer one seat choice and send the chosen Ring; entries run current player first; a
   Villain pushed off the Bridge escapes through the full escape procedure, its steps opened in the same `onMove`; two strikes in one
   move never double-count a Ring (RS-2, RS-3, RS-4).
4. The strike records no hollow effect; `/debug/effects` lists it executable; `effect-index:check` exits 0.
5. The queue is dropped at game end and turn start, counts as an open operator choice, and is mirrored in every rebuilt loop (RS-4).
6. Engine and dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged.

## Verification Steps

- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- Add the provenance row and the pending `live-verify.json` rows, then `pnpm effect-index`: only the Mandarin strike row and
  `summary.byStatus` (unmarked −1, executable +1) change.
- `pnpm sim:runtime-observed`, `pnpm sim:coverage --check` (`--update-baseline` only if it reports a move),
  `pnpm --filter @legendary-arena/dashboard prebuild:coverage`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green; record the delta from the re-recorded baseline (expect at least +18).
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm effect-index:check`, `pnpm effect-index:test`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`,
  `pnpm cards:check` (no card file changes).
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` and
  `node scripts/check-number-ledger.mjs --check`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Effect index regenerated; every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a Mandarin match **created after the deploy** (`isMatchOlderThanServer: false`), a Ring's
      Fight 4, The Mandarin's reduced Fight, and a Master Strike that sends a Ring into the City (a seat choice when a player holds
      two), confirmed from the board and the log; or operator-pending in `STATUS.md` with the pending `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated (the tactics and Epic Mandarin named as follow-ups); `docs/ai/DECISIONS.md` D-24822 → Active;
      `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0;
      NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24822: The Mandarin's three base-face lines. **Costs:** two read-time, id-keyed terms in the single cost authorities (the
D-24752 `mastermindNonSaviorBonus` shape): while `rvlt/mandarin` leads, a `henchman-mandarins-rings-` card's `resolveFightCost`
gains +1, and `resolveMastermindFightCost` loses 1 per Ring in every seat's Victory Pile (3 with exactly one seat; a bot ally is a
seat), inside the existing 0 floor; printed-Attack reads stay printed. **Strike:** a `mastermindStrikeHandler` arm: each seat
(current first, D-24780) with no available Ring (Victory Pile Rings minus entries already owed) gains a Wound at strike time; each
other seat is queued on a lazy hashed `G.pendingMandarinRingEntries`. A strike has no `events`, so the `onMove` opener (mirrored in
the rebuilt loops) resolves the queue: one available Ring is sent with no prompt; seats with two or more answer one simultaneous
`mandarin-ring-entry` seat choice, each seat once per round (D-24743 park rule; the apply only records the pick on that seat's first
unchosen entry); then the chosen Rings enter the Sewers in queue order through `pushVillainIntoCity`, without an Ambush (D-24811),
draining from the front so a chained strike's entries survive and are settled in the same call, and a pushed-off Villain escapes
through `resolveVillainEscape`, with the escape and reveal-or-wound openers, the final-turn latch and the pile-depletion check re-run
in the same `onMove`. The choice is interactive, not auto-picked, because Rings are different cards. The queue joins the end-of-game drop,
`isOperatorChoiceOpen` and the turn-start delete. Epic Mandarin and the tactics are deferred. Replays of
pre-WP-875 Mandarin matches diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

Every gate ran as an independent subagent against the code at HEAD `e6ec73b6`.

**Pre-flight**

- **Round 1: NOT READY.** Every Assumes anchor and all ten hard-deps were verified. Five PS items were found and folded:
  1. A Villain pushed out of the City by a Ring entry did not get its escape steps until the next move. Fix: re-run the escape and
     reveal-or-wound openers after the Mandarin opener.
  2. The seat-choice kind constant has to live in `mandarin.logic.ts`, otherwise it forms an import cycle.
  3. Seat choices have no prompt field. Fix: a `neutral` log line per seat.
  4. Two strikes in one move. Fix: Rings already owed are not counted as available, each seat is asked one at a time, and the
     apply fills that seat's first unchosen entry. T17 covers it.
  5. The provenance handler path was wrong.
- **Round 1 RS items, all folded:**
  - The loop `RevealContext` is built from the loop's own locals, never `seatChoiceContext`.
  - A removed entry is deleted from the queue.
  - AC1 is narrowed to fight-cost readers; the four reads of printed Attack keep printed Attack.
  - Three live-verify rows, with their shape.
  - Which helper produces the log names.
  - The final call order.
- **Round 2: NOT READY**, one item. Step 5 must drain from the front and remove each entry before moving its Ring, so that entries
  appended by a chained strike (escape → Scheme Twist → reveal → Master Strike) survive. Also folded: stop when an endgame is
  reached, re-run the final-turn latch, accept a one-move Purge-sweep lag, the `currentPlayer: string | null` signature, the
  "available" wording, and T18.
- **Round 3: READY TO EXECUTE.** One required fold: the latch is always paired with `applyPileDepletionResourceLoss` (D-24599), or a
  Super Hero Civil War loss waits one move. Every queue removal deletes the queue once it is empty.

**Copilot**

- **Round 1: RISK → HOLD**, six fixes folded:
  1. (mode 18) Entries appended by a chained strike are settled in the same opener call.
  2. (mode 11) T1 now covers `fightVillain`, `getLegalMoves` and Ebony Blade.
  3. (mode 11) T12 asserts the parked `ESCAPE_HQ_KO_KIND` choice.
  4. (mode 12) The EC counts the loop mirrors.
  5. (mode 3) The doc says which helpers are pure and which mutate.
  6. (mode 6/26) Empty-queue delete.
- **Round 2: RISK → HOLD**, two fixes folded:
  1. In `game.ts` the latch and pile check run *before* the re-run reveal-or-wound opener, which is the live order and matches the
     loops.
  2. The mirror count is call-scoped, so the import line is not counted: `openMandarinRingEntriesIfNeeded(` gives 2 / 2 / 1.

- **Round 3: RISK**, safe to proceed. Every round-2 fold was verified against `game.ts` ~920-974 and the loop sites, and every
  §3 helper path exists. One hardening was folded in: the mirror count pattern became `openMandarinRingEntriesIfNeeded\(`, which still
  skips the import line and also counts a call wrapped across lines.

**Final:** pre-flight READY TO EXECUTE; copilot RISK, with the concern documented. The residual risk is the WP-872 lockstep overlap:
WP-872, drafted and not yet executed, adds a queue at the same sites (`ALL_PENDING_FIELDS`, `isOperatorChoiceOpen`, the `onMove`
openers, the loop mirrors). Whichever executes second rebases onto those lines.

## Lint Gate Self-Review (00.3)

- **§1 structure: PASS.** All required sections are present. Out of Scope names the four tactics, Epic Mandarin, WP-872's lines, a
  card-specific heading, and no client, server, UIState, registry or replay change. There are six binary ACs.
- **§2 constraints: PASS.** Full files, ESM, Node 22 and 00.6 are cited; so are determinism, one cost authority, the
  rebind / `resolveVillainEscape` rule and the import rule. The session protocol gives four STOP triggers, and the Locked Values are
  in the EC.
- **§3 Assumes: PASS.** Ten hard-deps, each ✅, plus every helper, type, opener, park rule, cost authority, printed-Attack read, id,
  pin and coverage fact, each with its path and line. The imported-helper paths are listed. Three pre-flight rounds verified them.
- **§4 Context: PASS.** Covers why an owed queue, why the entry is in the opener, ordering, why the cost terms are read at fight
  time, and determinism / replay. RS-1 to RS-4 are locked. ARCHITECTURE sections and 13 D-ids are cited. 00.2 is not needed: the
  queue is engine-internal and no card or setup schema changes (the WP-870 precedent).
- **§5 files: PASS.** Two new engine files, five modified source files, six lockstep wiring files, four test files (one new), three
  coverage files and the governance files. The count is above eight because every owed queue needs the WP-828 / WP-845 / WP-870
  lockstep footprint.
- **§6 naming: PASS.** Full words throughout: `mandarinRingAttackBonus`, `countQueuedMandarinRingEntries`,
  `openMandarinRingEntriesIfNeeded`. Booleans use the `is` prefix. `playerID` follows the queue precedent.
- **§7 deps / §8 boundaries: PASS.** No new dependency. Engine only. `mandarin.logic.ts` imports no boardgame.io, registry or
  `villainDeck/`, and `seatChoice.resolve.ts` gains no import of the reveal path.
- **§9 Windows: PASS.** `pnpm` / `node`, and PowerShell for the mirror count. **§10 / §11: N/A**, no env var and no auth.
- **§12 tests: PASS.** `node:test` and `.test.ts`. T1-T18 cover the cost readers (including the move, the bot and the printed-read
  exception), strike, opener, chained strikes, drain safety and lockstep. T16 drives the real reducer through
  `boardgame.io/dist/cjs/internal.js` under the **WP-411 / D-24223 exception**, as WP-870's T17 did.
- **§13 verification: PASS.** The regen order is given, the check commands with expected exits, the call-scoped mirror count
  (2 / 2 / 1), and the engine baseline (6643).
- **§14 / §15: PASS.** Six binary ACs. The DoD names STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the ledger, plus the
  diff allowlist check and the D-24026 live check. §15.1 has an operator-pending fallback. **§15.2:** `**Risk Tier:** MEDIUM`
  appears verbatim in both the WP and the EC; it is not HIGH, so there is no threat model.
- **§16 code style: PASS.** `for` loops and `if / else`, no `.reduce()` and no nested ternaries; the `// why:` sites are listed in
  the EC; nothing throws.
- **§17 Vision: PASS.** §1, §2, §8, §10, §22, NG-1 and a determinism line.
- **§18: N/A**, no forbidden-token grep. **§19: N/A at draft**, a commit-time rule; the baseline `e6ec73b6` is cited.
- **§20 funding / §21 API catalog: N/A**, with reasons stated above.
