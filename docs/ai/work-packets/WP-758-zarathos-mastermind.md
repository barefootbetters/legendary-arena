# WP-758 — Zarathos Mastermind: Master Strike + four tactic Fight effects on the Haunt substrate (Game Engine)

**Status:** Draft 2026-09-25; **unblocked and re-baselined 2026-11-10** at execution (WP-757 ✅ Done 2026-09-25; WP-749 ✅ Done 2026-10-05, EC-786 / D-24573, merge `d7a8ed3e`). See §Execution Re-baseline.

**Primary Layer:** Game Engine / Implementation

**Dependencies:**
- **WP-757 / D-24587** — the Haunt substrate.
- **WP-749 / D-24573** — the sim/PAR non-active seat-choice branch.
- WP-497 — `dispatchTacticOnFight`.
- WP-684 / D-24501 — `PendingSeatChoice`.
- WP-694 / D-24511 — the multi-seat tactic kinds and the post-resolve chain precedent.
- WP-732 / D-24553 — victory latch promoted at `turn.onEnd`.

**User-Visible Surface:** `play.legendary-arena.com`

**Lane:** Standard (two-session). It adds new seat-choice kinds (multi-seat sync surface), so it is not lightweight-eligible.

**Arc:** 2 of 3 in the Zarathos arc. It follows WP-757 and is parallel-safe with WP-759 (disjoint files). The Fallen fight-side is WP-760.

> Baseline: drafted at `origin/main` `d09d0946` (reserve #2356). **Re-baselined at execution on `fb28b03d` (2026-11-10).**

## Execution Re-baseline (2026-11-10)

The draft predates ~45 days of `main`. Every anchor was re-checked against `fb28b03d`. Anchor-only moves are folded silently into §Assumes. The findings below change behavior or scope; each adopts a decision that landed after the draft, so none re-opens the WP's design.

- **R-1 — Seat order (D-24780).** Every sequential each-player loop now starts with the current player and goes clockwise (`seatsInTurnOrderFrom`, rules v23 L2247); an "each other player" loop rotates first, then drops the defeater. The draft's "ascending" applies only to the simultaneous seat-choice apply (D-24780 §6 / D-24501). So: strike Wounds, Eruption's auto-Wounds and Corrupted Spirit's auto-discards run clockwise; the five applies stay ascending.
- **R-2 — Eruption's Wound option (D-24770, rules v23 L3199-3201).** A player picks only an option they can do. "Gain a Wound" is offered only while the Wound supply still has one, evaluated after the auto-Wound pass (the `prepareVillainEffectTraitDiscardChoice` two-pass shape). A qualifying seat facing an empty supply chooses among its discards only.
- **R-3 — Imprison VP (D-24598).** WP-765 landed the shared scoring-mirroring `victoryPointValueForCard` (`economy/bloodFrenzy.logic.ts:50`), which includes dynamic VP. Imprison reads it instead of re-implementing the `?? VP_VILLAIN` / `?? VP_HENCHMAN` fallback, so the draft's "dynamic VP is a named gap" closes. The Victory-Pile Villain test is `getEligibleVictoryVillains` (`moves/resolveVictoryPileCardPick.ts:74`; Henchmen in per D-24742, defeated Killbots out); the draft's `isVictoryPileVillain` no longer exists.
- **R-4 — Hero class reads (D-24523, D-24801, rules v23 p.49 / L3443).** Hand and HQ cards read `offPlayCardTraits` (a Divided card counts as both classes off play); played cards read `cardHasClassWhenPlayed` over `playedCardIdsStillInPlay` (Copy Powers' copied classes count; a played card that left play does not).
- **R-5 — "Your Heroes" KO (D-24687, D-24754, D-24789).** Demonic Essence's options follow `listCrushEligibleTargets`: one option per (zone, card id), Wounds excluded, carrying `sourceZone` because S.H.I.E.L.D. starter ids repeat across hand and play. A KO goes through `koCard` and `recordOwnedCardKoed`.
- **R-6 — Strike bookkeeping (D-24654, D-24810).** D-24654 removed `captureBystanderOntoMastermind`; nothing generic runs beside the arm. An unimplemented strike now records a `master-strike` hollow; the Zarathos arm ends that. `scripts/coverage/strike-provenance.json` (new since the draft, WP-867) gains a Zarathos row, and `mastermindStrike.unresolved.test.ts` then runs the real arm. Allowlist +1.
- **R-7 — Wound logging and draws (D-24673, D-24732).** Wounds go through `gainWoundWithOutcome`, so a line never says "gained" while Diving Block can still return it. Imprison's draw counts toward the defeater's `turnEconomy.cardsDrawn`, like HYDRA Conspiracy.
- **R-8 — Active-seat parks (D-24648).** Imprison and Demonic pass the defeater to `parkSeatChoice`, so no stage ride runs.

Gate findings folded in at execution (01.4 / 01.7 / 00.3 subagents, 2026-11-10):

- **R-9 — Demonic Essence reads each "if you have" when its sentence resolves (01.7 #1).** The draft evaluated the owed count once. The card prints two sentences that resolve in order, and a played card that has left play no longer counts (rules v23 L3443-3447). So: a Ranged Hero parks `-first` (the Ranged line); the chain re-checks for a Strength Hero before it parks `-last`; with no Ranged Hero, a Strength Hero parks `-last` directly. KOing your only Strength Hero with the first pick ends the effect.
- **R-10 — The strike-row pin (01.4 PS-1).** `rules/mastermindStrike.unresolved.test.ts` pins the checked `strike-provenance.json` rows at 14; the Zarathos row makes it 15. Intentional behavior change, so the pin moves with a why-comment. Allowlist +1.
- **R-12 — The KO-site drift pin (execution, WP-853 / D-24789).** `hero/ownedCardKoTrigger.test.ts` locks every engine KO site per function. Imprison adds a Victory-Pile KO (1 site, 0 owned records, the Vanishing Illusions precedent) and Demonic Essence an owned Hero KO (1 site, 1 record, the Crush precedent). The table gains both rows. Allowlist +1.
- **R-11 — The sim case's file (execution).** `simulation/simulation.runner.test.ts` does not exist. WP-749's sim seat-choice cases live in `simulation/seatChoiceDispatch.test.ts`, so the ≥2-player Zarathos case goes there (allowlist row swapped, not added).

Not drift: WP-749 is in (`simulation.runner.ts:651`), `fightMastermind` refuses while haunting (`:157`), `drainPendingChoices` drains non-active seats (D-24590), and the client prompt still falls back to "Your choice" for an unknown kind.

---

## Goal

After this session, `mdns/zarathos` plays as printed (`data/cards/mdns.json`, base face):

- **Master Strike.** If any non-null HQ slot is haunted (by either haunter kind), each player gains a Wound. Then, if Zarathos is not already haunting, he haunts the highest-cost unhaunted Hero.
- **Tactics.** `dispatchTacticOnFight` gains four arms. Each one first has Zarathos haunt the highest-cost unhaunted Hero of that tactic's class pair, then resolves the tactic's second clause:
  - **Eruption of Hellfire:** each other player discards a covert/ranged Hero or gains a Wound.
  - **Corrupted Spirit of Vengeance:** each other player discards an instinct/covert Hero or discards down to 3.
  - **Imprison in the Soul Crystal:** if you have a strength/instinct Hero, you may KO a Victory-Pile Villain and draw cards equal to its VP.
  - **Demonic Essence of Ghost Rider:** "you may KO one of your Heroes", owed once for a ranged Hero and once for a strength Hero.

The interactive choices use five new `PendingSeatChoice` kinds, which the client's generic prompt already renders.

The gameplay loop this creates: Zarathos repeatedly possesses the priciest Hero in the HQ. While he haunts, he cannot be fought (WP-757 block), so the table must spend Recruit to exorcise before attacking him again.

## User-Visible Impact

- Zarathos's strikes wound every player while any Hero is haunted.
- He possesses the most expensive HQ Hero and cannot be fought until it is exorcised.
- Each tactic defeat re-possesses a Hero and hands opponents a real choice.
- Today, by contrast, his strike does generic bookkeeping only and all four tactics are silent no-ops.

---

## Assumes

Re-baselined on `fb28b03d` (2026-11-10). Paths are under `packages/game-engine/src/`.

1. **WP-757 is merged** (✅). `board/haunt.logic.ts` exports `hauntHqSlot(G, hqIndex, haunter): boolean` (:146), `isMastermindHaunting(G)` (:61), `isHqSlotHaunted(G, hqIndex)` (:41) and `selectUnhauntedHqIndex` (:102). `HqHaunter` is `{ kind: 'villain'; cardId } | { kind: 'mastermind' }` (`types.ts:1946`). `fightMastermind` refuses while the Mastermind haunts (`moves/fightMastermind.ts:157`); D-24587 is Active.
2. **WP-749 is merged** (✅, D-24573). `simulation/simulation.runner.ts:651` and `simulation/par.aggregator.ts` resolve an open `G.pendingSeatChoice` for each outstanding addressed seat at `defaultOptionIndex`, non-active seats included.
3. `mastermindStrikeHandler` (`rules/mastermindHandlers.ts:1521`) is an if/else chain on `selection.mastermindId`; every each-player arm receives `resolveCurrentPlayer(strikeContext)` (:241) and the terminal `else` records the `master-strike` hollow (D-24810). `selectDiscardToLimitCards(G, cards, discardCount)` (:305) is exported and pure, and its **third argument is a count to discard**.
4. Tactic ids are built as `${setAbbr}-mastermind-${slug}-${card.slug}` (`mastermind/mastermind.setup.ts:279`); the four Contract ids match `mdns.json`. `dispatchTacticOnFight(G, ctx, id, shuffleContext, events?)` (`rules/tacticHandlers.ts:1529`) receives `events` from `moves/fightMastermind.ts:516`.
5. `PendingSeatChoice`:
   - Builders set `defaultOptionIndex`; one index is shared by every addressed seat.
   - `applySeatChoiceTimeoutDefault` (`moves/seatChoice.resolve.ts:865`) is kind-agnostic, clamps that index, dispatches `applySeatChoiceByKind` (:569) and does **not** chain.
   - Post-resolve chains run from `resolveSeatChoice` (:423); the active-seat two-pick precedent is Crush Pacifist Resistance (`chainCrushPacifistResistanceLastKo`, called at :522, defined at :824, D-24754).
   - `parkSeatChoice(G, events, choice, activePlayerToSkip?)` skips the stage ride for an active-seat-only choice (D-24648).
   - `exorciseHauntedHero` (`moves/exorciseHauntedHero.ts:127`) releases a haunter for the Haunted Hero's cost; `prepareVillainEffectTraitDiscardChoice` (`villainDeck/villainEscapeProcedure.ts:443`) is the two-pass discard-or-Wound precedent.
   - Wound and discard reactions queue (`pendingDivingBlockWounds`, `pendingReturnOnDiscard`) and open later, so an auto-Wound or auto-discard never overwrites the choice this packet parks.
6. The client `PendingSeatChoicePrompt.vue` renders `options[].label` for any kind, with the heading fallback "Your choice". The UIState seat-choice build (`ui/uiState.build.ts:2160`) and filter are kind-agnostic.
7. Hero class: `offPlayCardTraits` (`hero/splitCard.logic.ts:93`) for hand and HQ cards; `cardHasClassWhenPlayed` (`hero/sizeChanging.logic.ts:122`) over `playedCardIdsStillInPlay` (`hero/splitCard.logic.ts:280`) for played cards (R-4).
8. Victory Pile and draws:
   - `getEligibleVictoryVillains(G, seat)` (`moves/resolveVictoryPileCardPick.ts:74`) and `victoryPointValueForCard(G, seat, id)` (`economy/bloodFrenzy.logic.ts:50`) exist (R-3).
   - `SeatChoiceOption.cardId` / `sourceZone` exist (`types.ts:1484` / `:1498`); their why-comments list their kinds, and this packet adds its kinds to both.
   - `drawCardsIntoHand(playerZones, count, shuffleContext)` is at `moves/drawCards.logic.ts:53`.
   - `discardFromHand` (`moves/discardFromHand.ts:198`), `koCard` (`board/ko.logic.ts:24`), `offPlayCardStats` (`hero/splitCard.logic.ts:132`) and the scoring constants `VP_VILLAIN` / `VP_HENCHMAN` (read through `victoryPointValueForCard`) exist.
   - `listCrushEligibleTargets` (`mastermind/arnimZola.logic.ts:86`), `recordOwnedCardKoed` (`hero/deferredConditionalGrants.ts:196`), `gainWoundWithOutcome` (`board/wounds.logic.ts:125`) and `seatsInTurnOrderFrom` (`turn/seatOrder.logic.ts:33`) exist.
9. Endgame: `G.pendingSeatChoice` is dropped at the winning turn's end (`endgame/mastermindVictory.logic.ts:126`, WP-732), so a choice parked by the final tactic still resolves first (the block-all guard holds `endTurn`).
10. Tactic and strike provenance: `scripts/coverage/tactic-provenance.json` and `scripts/coverage/strike-provenance.json` feed `data/metadata/effect-implementation-index.json`; the five Zarathos rows are `unmarked` today. `rules/mastermindStrike.unresolved.test.ts` runs the real dispatcher for every executable strike row and pins their count (R-10).
11. `pnpm -r build` exits 0 and the engine suite is green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, and `.claude/rules/architecture.md` (moves never throw; `// why:` rules).
- `docs/ai/DECISIONS.md`:
  - D-24587 (Haunt, landed by WP-757)
  - D-24501 (seat choice)
  - D-24511 (Monarch's Decree / Vanishing Illusions)
  - D-24553 (victory latch)
  - D-24529 ("Heroes you have" = hand + in play; corrects D-24497)
  - D-24499 (Diving Block, the Wound chokepoint)
- Rules v23:
  - `docs/legendary-universal-rules-v23.md` ~L1507-1543 (Haunt).
  - ~L3439-3446: "Your Heroes" = hand plus cards played this turn. The deck and discard pile do **not** count.
- The files in Assumes 3-10.
- User memory:
  - `reference_interactive_choice_active_player_only`
  - `reference_sim_nontermination_resolveherochoice_gap`
  - `project_mastermind_tactic_fight_arc`
  - `reference_heroes_you_have_hand_plus_play`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Write human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. Randomness only via the provided shuffle context.
- Layer: engine only. There is no `apps/*` change. The server-autoplay non-active seat gap is a separate follow-up (see Out of Scope).

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24588) before coding. One WP per session.

**Packet-specific:**
- Do **not** modify WP-757's contract. The selector and the class helper are new and private to `mastermind/zarathos.logic.ts`.
- **Master Strike order is load-bearing:**
  1. Run the wound check first: is any non-null slot haunted, by either kind?
  2. If so, give one Wound per player, the current player first and then clockwise (`seatsInTurnOrderFrom`, D-24780), via `gainWoundWithOutcome` (`board/wounds.logic.ts:125`). That is the chokepoint `mastermindHandlers`' private `gainWoundToDiscard` wraps (Diving Block, D-24499; honest log, D-24673). `zarathos.logic.ts` never imports `mastermindHandlers` (no direct dependency on the strike dispatcher; the engine's existing runtime-safe import cycle is reached through `wounds.logic` regardless, and every binding is read inside function bodies). An empty supply is a logged no-op.
  3. Then haunt, skipped when `isMastermindHaunting(G)`.

  Nothing else runs beside the arm (D-24654 removed the generic capture-a-Bystander; R-6).
- **Tactic haunt runs first.** `zarathosHauntHighestCost` returns a logged no-op when `isMastermindHaunting(G)` is true, for both the strike and tactic callers. There is never a second `{ kind: 'mastermind' }` haunter. With WP-757's fight and free-defeat blocks, he is not haunting on a tactic fight anyway; this guard makes that robust.
  - If the defeated tactic was the last one, victory is latched and promoted at `turn.onEnd` (WP-732 / D-24553). Both clauses still resolve.
  - The resulting haunt blocks the Final Blow `fightMastermind` until the table exorcises. This is faithful to the card.
- **"Have a Hero of class X"** is `playerHasHeroOfClasses(G, seat, classes)`. It reads `offPlayCardTraits` (`heroClass` / `heroClass2`) over the hand, and `cardHasClassWhenPlayed` over `playedCardIdsStillInPlay` (R-4).
- **Seat order (R-1, D-24780).** Sequential auto-resolve passes (strike Wounds, Eruption's auto-Wounds, Corrupted Spirit's auto-discards) run clockwise from the current player, the defeater dropped for "each other player". The simultaneous applies stay ascending (D-24780 §6).
- Multi-seat kinds default to option 0. Active-seat "may" kinds default to the last option ("Don't KO"). The timeout path does not chain.

## Locked Values

- Ids:
  - Mastermind `mdns/zarathos`.
  - Tactics `mdns-mastermind-zarathos-{eruption-of-hellfire | corrupted-spirit-of-vengeance | imprison-in-the-soul-crystal | demonic-essence-of-ghost-rider}`.
- Class pairs:
  - Eruption: covert | ranged
  - Corrupted Spirit: instinct | covert
  - Imprison: strength | instinct
  - Demonic Essence: ranged | strength
- **Highest-cost selector:**
  - Candidates are unhaunted, non-null slots.
  - Cost is the off-play printed cost, `offPlayCardStats(G, heroId)?.cost ?? 0` (the Dominate the Weak read, D-24754); class is `offPlayCardTraits` (R-4).
  - "A and/or B" means the Hero has class A **or** class B; dual-class counts once.
  - Ties go to the lowest HQ index.
  - No candidate → a logged no-op, and Zarathos stays in the Mastermind space.
- **Kinds:** `zarathos-eruption`, `zarathos-corrupted-spirit`, `zarathos-imprison`, `zarathos-demonic-essence-first`, `zarathos-demonic-essence-last`.
- **Eruption** (each other seat; two passes, the `prepareVillainEffectTraitDiscardChoice` shape, R-1 / R-2):
  - Pass 1, clockwise from the defeater: a seat with no covert-or-ranged Hero in hand auto-gains a Wound (logged; an empty supply is a logged no-op).
  - Pass 2, ascending: a seat with ≥1 such Hero is addressed. Its options are "Discard <name>" per matching hand card (ascending cost, then hand order), then "Gain a Wound" **only while the Wound supply is non-empty** after pass 1.
  - Park only if at least one seat is addressed. `defaultOptionIndex` 0.
- **Corrupted Spirit** (each other seat; pass 1 clockwise, pass 2 ascending):
  - Hand ≤ 3: auto-resolved to "down to 3", which is free. Logged, not addressed.
  - Hand > 3 with ≥1 instinct-or-covert Hero: addressed. Its options are "Discard <name>" per match (ascending cost, then hand order), then "Discard down to 3 cards".
  - Hand > 3 with none: auto-discard (pass 1, through `discardFromHand`) the ids returned by `selectDiscardToLimitCards(G, hand, hand.length - 3)`.
  - The "down to 3" option resolves the same way.
  - `defaultOptionIndex` 0.
- **Imprison** (active seat):
  - Addressed only if `playerHasHeroOfClasses(strength, instinct)` **and** the Victory Pile holds at least one Villain.
  - "Villain" is `getEligibleVictoryVillains(G, seat)`: the Victory-Pile `villain` and `henchman` cards, a defeated Killbot excluded (D-24742). Henchmen are Villains.
  - Options: "KO <name> — draw <VP>" per Villain, in Victory-Pile order, then "Don't KO".
  - VP is the shared scoring mirror `victoryPointValueForCard(G, seat, id)` (D-24598, dynamic VP included; R-3), read at apply time **before** the card leaves the pile, floored at 0.
  - The apply must be draw-safe with an `undefined` shuffle context. The timeout path passes none, and its default is "Don't KO".
  - On KO: move the card to `G.ko`, then `drawCardsIntoHand(zones, VP, shuffleContext)`, adding the cards actually drawn to `turnEconomy.cardsDrawn` (D-24732). VP 0 means no draw.
  - `defaultOptionIndex` = last.
- **Demonic Essence** (active seat):
  - Each sentence's "if you have" is read when that sentence resolves (R-9).
  - Options: "KO <name> from <zone>" per **Hero** in **hand and in play** (not the discard pile, per rules v23 ~L3439; Wounds excluded), one per (zone, card id) with `sourceZone`, the `listCrushEligibleTargets` shape without its Attack filter (R-5), then "Don't KO". A KO goes through `koCard` + `recordOwnedCardKoed`.
  - Has a Ranged Hero → park `-first` (the Ranged line). Its `resolveSeatChoice` post-resolve chain re-checks "has a Strength Hero" and, when true, builds a fresh `-last` from the current zones, after an accept or a decline. A timed-out `-first` does not chain; it counts as a decline.
  - No Ranged Hero but a Strength Hero → park `-last` directly. Neither → nothing.
  - The option lister is a new private function in `seatChoiceTactics.ts`; `arnimZola.logic.ts` is not modified.
- **Every kind:** a builder whose addressed seat set (or option list, apart from the decline) would be empty returns `undefined`, and nothing parks, so no choice can exist that no seat can answer.
- **Accepted residual:** if more Eruption seats choose "Gain a Wound" than the supply holds at apply time, the later ascending seats gain nothing (a logged no-op, the D-24770 RS-1 precedent).
  - `defaultOptionIndex` = last.

---

## Scope (In)

- **A) `mastermind/zarathos.logic.ts` (new)**
  - `selectHighestCostUnhauntedHqIndex(G, classes?)`
  - `zarathosHauntHighestCost(G, classes?)` — calls WP-757's `hauntHqSlot` with `{ kind: 'mastermind' }`
  - `playerHasHeroOfClasses(G, seat, classes)`
  - `resolveZarathosStrike(G, currentPlayer)`
- **B) `rules/mastermindHandlers.ts`:** the Zarathos branch, keyed on `ZARATHOS_MASTERMIND_ID` exported from `zarathos.logic.ts` (the `ARNIM_ZOLA_MASTERMIND_ID` precedent). `zarathos.logic.ts` also exports the internal helpers `offPlayCardHasAnyClass` and `isAnyHqHeroHaunted`; none reaches `index.ts`.
- **C) `rules/tacticHandlers.ts`:** four tactic-id constants, four arms and four resolvers. Each resolver builds its choice and parks it via `parkSeatChoice(G, events, choice)` (multi-seat, the Fallen Idols pattern) or `parkSeatChoice(G, events, choice, currentPlayer)` (active-seat, the Crush Pacifist Resistance pattern, D-24648).
- **D) `moves/seatChoiceTactics.ts`:** five kind constants, the builders (each setting `defaultOptionIndex`), and the applies.
- **E) `moves/seatChoice.resolve.ts`:**
  - five `applySeatChoiceByKind` arms;
  - the `-first` → `-last` post-resolve chain.
  - No edit to `applySeatChoiceTimeoutDefault`.
- **F) `scripts/coverage/tactic-provenance.json`:** four entries; `scripts/coverage/strike-provenance.json`: one entry (R-6); then regenerate `data/metadata/effect-implementation-index.json`.
- **G) Tests:**
  - `mastermind/zarathos.logic.test.ts` (new).
  - Cases in `rules/mastermindHandlers.test.ts`, `rules/tacticHandlers.test.ts`, `moves/seatChoiceTactics.test.ts` and `moves/seatChoice.resolve.test.ts`.
  - An end-to-end case in `moves/fightMastermind.test.ts`: strike → haunt → fight refused → exorcise → fight → tactic → re-haunt.
  - A ≥2-player sim case in `simulation/seatChoiceDispatch.test.ts` (R-11).
  - The strike-row pin in `rules/mastermindStrike.unresolved.test.ts` (R-10) and the KO-site table in `hero/ownedCardKoTrigger.test.ts` (R-12).

## Out of Scope

- Epic Zarathos. No Epic-face selection exists (D-24193); this is a named follow-up.
- The Fallen fight-side (Blood Frenzy, Atrocity, Patriarch, Salomé), which is WP-760.
- Server autoplay resolving non-active seat choices. No change needed: `drainPendingChoices` already dispatches an outstanding addressed seat's default `resolveSeatChoice` as that seat (D-24590, #2361), and the bot ally answers its own addressed seat (D-24743 / D-24744). The five Zarathos kinds get the absent-seat default there; teaching `simulation/ai.seatChoice.ts` a playing-seat answer for them is a follow-up.
- Letting players choose which cards "discard down to 3" drops.
- Any client change (the generic prompt suffices; WP-759 owns the haunt UI).

## Files Expected to Change

- `packages/game-engine/src/mastermind/zarathos.logic.ts` — **new**
- `packages/game-engine/src/mastermind/zarathos.logic.test.ts` — **new**
- `packages/game-engine/src/types.ts` — modified — comment-only update to the `SeatChoiceOption.cardId` and `sourceZone` why-comments (the Zarathos kinds reuse both)
- `packages/game-engine/src/rules/mastermindHandlers.ts` — modified — Zarathos branch
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — modified
- `packages/game-engine/src/rules/tacticHandlers.ts` — modified — four arms and resolvers
- `packages/game-engine/src/rules/tacticHandlers.test.ts` — modified
- `packages/game-engine/src/moves/seatChoiceTactics.ts` — modified — kinds, builders, applies
- `packages/game-engine/src/moves/seatChoiceTactics.test.ts` — modified
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — modified — arms and chain
- `packages/game-engine/src/moves/seatChoice.resolve.test.ts` — modified
- `packages/game-engine/src/moves/fightMastermind.test.ts` — modified — end-to-end case
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — modified — ≥2-player Zarathos sim case (R-11)
- `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts` — modified — the checked-row pin 14 → 15 (R-10)
- `packages/game-engine/src/hero/ownedCardKoTrigger.test.ts` — modified — two classified KO-site rows (R-12)
- `scripts/coverage/tactic-provenance.json` — modified — four entries
- `scripts/coverage/strike-provenance.json` — modified — one entry (R-6; file new since the draft)
- `data/metadata/effect-implementation-index.json` — regenerated
- Governance:
  - `docs/ai/DECISIONS.md` — modified (D-24588)
  - `docs/ai/STATUS.md` — modified
  - `docs/ai/work-packets/WORK_INDEX.md` — modified
  - `docs/ai/execution-checklists/EC_INDEX.md` — modified
  - `docs/05-ROADMAP-MINDMAP.md` — modified
  - this WP and EC-795 — modified (the execution re-baseline)

That is 18 code/data files, above the ~8 guideline. Half are tests; the rest is the minimum set for one strike and four tactics on the existing seat-choice substrate.

## Contract

- The ids and kinds listed under Locked Values.
- The helpers in `zarathos.logic.ts` are internal: not exported from `index.ts`.
- `defaultOptionIndex` per kind, as listed under Locked Values.

## Vision Alignment

**Vision clauses touched:**
- §8 / §22: determinism and replay faithfulness.
- §1 Rules Authenticity and §2 Content Authenticity: the card plays as printed.
- NG-1: no pay-to-win.

**Conflict assertion:** No conflict.

**Non-Goal proximity:** NG-1..7 are not crossed. This is a pure gameplay rule implementation.

**Determinism preservation:**
- Sequential passes run clockwise from the current player (D-24780); simultaneous applies run in ascending seat order; option order is locked.
- The only randomness is the draw reshuffle, through the provided shuffle context.
- The core sentinel and the PRE_WP080 replay play no Zarathos, so `finalStateHash` is expected unchanged. If a pin moves, dual re-pin honestly.

## Funding Surface Gate

§20 **N/A** — an engine gameplay rule. No nav, profile, funding copy or channel.

## API Catalog

§21 **N/A** — no HTTP endpoint and no `apps/server/src/**` library surface.

---

## Acceptance Criteria

1. **First strike.** With no haunted Hero, there are no Wounds and Zarathos haunts the highest-cost Hero (ties → lowest index).
   - A second strike gives every player a Wound, current player first then clockwise, and does not re-haunt.
   - The strike records no `master-strike` hollow (the `mastermindStrike.unresolved.test.ts` sweep covers the new provenance row).
2. **Strike while only a Villain haunts.** Wounds are dealt, then Zarathos haunts a different, unhaunted Hero.
3. While Zarathos haunts, `fightMastermind` is refused. After `exorciseHauntedHero` on his slot, it succeeds. A second strike or tactic haunt while he is already haunting is a logged no-op, so there is never a second Mastermind haunter.
4. **Tactic haunt.** Each tactic haunts the highest-cost Hero of its class pair (dual-class counts). With no match there is no haunt, and the no-op is logged.
   - Final Blow **on**: after the 4th tactic, a successful haunt blocks the fifth (Final Blow) fight until the table exorcises.
   - Final Blow **off**: the 4th tactic still latches `MASTERMIND_DEFEATED_PENDING` and the win lands at turn end (WP-732), haunt or not.
5. **Eruption / Corrupted Spirit.**
   - Only qualifying *other* seats are addressed; the defeater never is.
   - Non-qualifying seats auto-resolve exactly as locked, clockwise from the defeater (D-24780), including `selectDiscardToLimitCards(G, hand, hand.length - 3)` for hand > 3.
   - Option order and `defaultOptionIndex` 0 are as locked. Eruption's "Gain a Wound" is absent when the supply is empty after the auto-Wound pass.
   - Apply order is ascending seat. When every other seat auto-resolves, nothing parks.
   - Solo: the haunt happens, the second clause is a logged no-op, and nothing parks.
6. **Imprison.**
   - A false condition, or an empty Villain set, means no park.
   - A Henchman in the Victory Pile is offered.
   - Choosing a card moves it to `G.ko` and draws VP cards (counted in `cardsDrawn`). A Villain with no printed VP draws `VP_VILLAIN` (1), mirroring scoring through `victoryPointValueForCard`.
   - "Don't KO" changes nothing.
7. **Demonic Essence.**
   - Neither class / Strength only / Ranged parks nothing / `-last` / `-first`.
   - `-first` chains `-last` after both accept and decline while a Strength Hero remains; KOing the only Strength Hero with the first pick chains nothing (R-9). A timed-out `-first` does not chain.
   - Options never include discard-pile cards or Wounds; a KO from play removes the `inPlay` copy named by `sourceZone`.
8. **Sim.** A seeded 2-player Zarathos simulation-runner game terminates and is not flagged stuck. At least one Eruption or Corrupted Spirit defeat is forced by the test fixture.
9. **Suites.** The engine suite is green and `pnpm -r --no-bail test` has 0 failures.
   - `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` all exit 0.
   - `finalStateHash` is unchanged, or dual-re-pinned honestly.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass, including the new cases.
3. `pnpm -r --no-bail test` → 0 fail.
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all exit 0. The index shows the four Zarathos tactics and the Zarathos Master Strike as implemented.
5. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes, and the diff is allowlist-only.
- [ ] D-24588 appended Active to `DECISIONS.md`.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, and `roadmap:counts:check` 0.
- [ ] Two-commit topology: `EC-795:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED, with WP-757 and WP-759 deployed). In a live **human-driven** (solo or multi-seat) Zarathos match on `play.legendary-arena.com`, with the deployed gitSha checked, observe:
  - a Master Strike haunting a Hero;
  - the Mastermind unfightable until exorcised;
  - a tactic's second clause resolving.

  This is recorded as operator-pending until seen. All-bot autoplay now drains the tactic seat choices (D-24590) and may be used as a supplementary check; the human-driven match is the required observation.

## Reserved Decision (lands at execution)

**D-24588 — zarathos-mastermind.** Locks:
- the highest-cost selector: class OR, ties to the lowest index;
- the strike order: wounds before the haunt, with the haunt skipped while already haunting;
- the five seat-choice kinds, with their option orders and defaults;
- Corrupted Spirit's hand ≤ 3 auto-resolve and its `selectDiscardToLimitCards` pick (a named fidelity gap);
- Henchmen counting as Villains for Imprison; VP read through the shared scoring mirror `victoryPointValueForCard` (dynamic VP included, R-3);
- the D-24780 clockwise order for the sequential passes, ascending for the simultaneous applies, and Eruption's Wound option only while the supply has one (R-1 / R-2);
- the double-haunt guard in `zarathosHauntHighestCost`;
- Demonic Essence: hand + in-play only, each "if you have" read when its sentence resolves (R-9), the `-first` → `-last` chain, and no chain on timeout;
- no builder parks a choice with no addressed seat; the Eruption mid-apply Wound shortfall is an accepted residual;
- the Final Blow blocked by a post-tactic haunt.

---

## Lint Gate Self-Review (00.3)

> The two sections below are the **drafting-time** gate history (2026-09-25). They predate the execution re-baseline; where they differ (file counts, `gainWoundForPlayer`, ascending order, the owed-once Demonic count) R-1..R-11 supersede them. The execution-time gate verdicts are recorded at the end of §Gate Record.

**Round 1: FAIL** on §1, §2, §4, §5, §8, §13, §17, §20 and §21 (gate subagent). All are fixed in this revision:
- sections added;
- engine-wide boilerplate and session protocol added;
- DECISIONS, ARCHITECTURE and rules-v23 citations added;
- the placeholder file row replaced, with per-file notes;
- the layer declaration added (engine only; the autoplay gap excluded);
- exact verification commands added.

**Round 2: PASS.**
- **§1–§5:** present; Assumes verified by the gate subagent; 14 files, with the overage justified.
- **§6:** ids verified against `mastermind.setup.ts:279`.
- **§7:** no new dependencies.
- **§8:** engine only.
- **§9–§11:** N/A.
- **§12:** `node:test`, no network.
- **§13:** exact commands.
- **§14:** nine binary ACs.
- **§15:** STATUS, DECISIONS, indexes and live-verify covered.
- **§16:** human-style code.
- **§17:** satisfied.
- **§18–§21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1: NOT READY**
- PS-1: the WP-757 dependency.
- PS-2: the sim default-dispatch file did not exist. **Resolved:** hard dependency on WP-749, which adds exactly that branch, plus a ≥2-player sim AC.
- PS-3: autoplay acts only as `currentPlayer`. **Resolved:** excluded as a pre-existing, separately tracked gap; the live-verify was re-pointed to human-driven play.
- PS-4: Demonic Essence included the discard pile. **Resolved:** hand + in play only, per rules v23 ~L3439.
- RS-1..8 locked above:
  - the discard-count argument;
  - `defaultOptionIndex` set per builder, with no edit to the timeout function;
  - the timeout path does not chain;
  - the `playerHasHeroOfClasses` helper;
  - Henchmen count as Villains;
  - the Final Blow AC and the victory-latch wording;
  - the Corrupted Spirit option order;
  - the Monarch's Decree precedent.
- Allowlist additions:
  - `tactic-provenance.json`;
  - the effect-index regen (now certain);
  - `simulation.runner.test.ts`;
  - the named test files.
- The D-24588 ledger text was retitled.

**Scope verdict: READY TO EXECUTE once WP-757 and WP-749 are merged.**

**Copilot (01.7), round 1: BLOCK (SUSPEND).** The findings were #12/#30 (allowlist), #23 (ordering), #26 (semantics), #18 (Final Blow timing), #22 (silent sim-stuck), #4 (argument semantics) and #11 (vacuous solo AC). Each maps to a fix above: the allowlist is closed, ordering and defaults are locked, the semantics are locked in D-24588, and there are the Final Blow AC and the ≥2-player sim AC.

**Round 3 CONFIRM (independent subagent).** One defect fixed: D2, where strike wounds used a private `mastermindHandlers` helper that `zarathos.logic.ts` cannot import without a cycle. They now go through `gainWoundForPlayer`. With that fix, the scope verdict stands at READY once WP-757 and WP-749 merge, and copilot is RISK (documented).

**Round 2 (independent subagent).** Every round-1 code-fact fix was confirmed. Two new blockers, both fixed in this revision:
- **B1:** the Imprison VP fallback of 0 contradicted scoring. It now mirrors `?? VP_VILLAIN` / `?? VP_HENCHMAN`, and an AC asserts it.
- **B2:** no double-Mastermind-haunt guard. `zarathosHauntHighestCost` now no-ops while he is haunting, with an AC.

Non-blocking, locked: the `SeatChoiceOption.cardId` comment update (`types.ts` added, comment-only), and the Imprison apply being draw-safe without a shuffle.

Verdicts: pre-flight **READY TO EXECUTE once WP-757 and WP-749 merge**; copilot **RISK (documented)**. Residual risk: the dependency on two unmerged WPs.

**Execution-time gates (2026-11-10, on `fb28b03d`, independent subagents):**
- **00.3 lint: FAIL → fixed.** Text only: the D-24529 label, the stale ascending / `gainWoundForPlayer` lines, the §17 clause numbers, the unlisted Assumes anchors, the file count and governance paths, and the AC8 wording. All folded in above.
- **01.4 pre-flight: NOT READY → READY.** PS-1, the strike-row pin, is R-10. RS-1 (the cycle wording), RS-4 (the :824 anchor) and RS-7 (the extra internal exports) are folded in. RS-6: no gate baseline moves (`sim:runtime-observed` pins `core/dr-doom`).
- **01.7 copilot: RISK.** #1 is R-9. #2 (no empty-seat park) and #4 (the mid-apply Wound shortfall) are locked above. #3 (Final Blow on/off) is split in AC4. #5 (the private lister) and #7 (the solo AC) are folded in. #6 is the stale text fixed with the lint findings.
- Process note: implementation started while the three gates ran. No gate finding needed a design change beyond R-9, which was applied before the tests were written.
