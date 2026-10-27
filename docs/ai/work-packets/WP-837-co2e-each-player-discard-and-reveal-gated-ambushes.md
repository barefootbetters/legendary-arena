# WP-837 — Core 2E Ambushes: Mystique and Frost Giant Warrior make every player discard, Juggernaut purges hand cards named like the HQ, Scorpion's Wounds need another Spider-Foe, The Leader's play can be stopped by a Strength Hero (Game Engine + Arena Client heading + card data)

**Status:** Draft 2026-10-25. 01.4 pre-flight READY TO EXECUTE (fixes applied); 01.7 copilot RISK → F-1 + F-2 applied; 00.3 PASS — see §Gate Record. **D-24770** reserved (#3010). **Amended 2026-10-27 (pre-execution)** for D-24780 seat order — see §Amendment.
**Primary Layer:** Game Engine (+ one Arena Client seat-choice heading, card-data markers and the derived coverage feeds)
**Dependencies:** WP-817 ✅ (#2943, the owed-discard queue, the escape opener and the cost-filtered seat choice this packet widens). WP-846 ✅ (#3046, `turn/seatOrder.logic.ts` `seatsInTurnOrderFrom` and the D-24780 forward rule this packet's two order-sensitive loops follow). Soft: WP-835 / WP-836 / WP-838 / WP-839 / WP-840 (sibling co2e packets: same marker-map objects, primitive array and count pins; present or absent on `main`, either is fine), WP-829 (#2995, **merged** `461ed924`: `timestream-purge` arms beside this packet's in `seatChoice.resolve.ts` / `ai.seatChoice.ts` / `PendingSeatChoicePrompt.vue`), WP-830 (#2998, **merged**; `origin/main` = `e580d801`: same seat-choice arms, `fightVillain.ts`, `types.ts`, drop set and busy guard — anchor shifts only), WP-831 / WP-832 (#3001 **merged** `6482b05d`; #3004 **merged** `fe24c19a`: same seat-choice arms, `fightVillain.ts`, `types.ts`, `villainDeck.reveal.ts`; WP-831's variable City is fine because this packet only reads `G.city` by length).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes a contract file (`rules/villainAbility.types.ts`: four primitives, one condition), widens a `types.ts` state interface, adds a seat-choice kind, and extends one existing primitive's grammar.
**Arc:** co2e villain fidelity epic (WP-835..840), inventory rows #1, #3, #12, #24, #28.

> Baseline: `origin/main` at `677c4109` (the reserve squash, #3010). `main` has since moved to `461ed924` (WP-829 merged), `e580d801` (WP-830 #2998 merged), and past WP-831 (#3001, `6482b05d`) and WP-832 (#3004, `fe24c19a`), both merged (amendment 2026-10-27; `517077cb` at amendment); line anchors below are from `677c4109` unless marked "main". Sibling co2e packets (WP-835 / 836 / 838 / 839 / 840) may or may not have landed when this executes; both states are valid (EC Before Starting gives the rebase rule). Re-read anchors, the primitive count and test totals at execution.

---

## Goal

As a player facing the Core 2nd Edition Villains, I want five Ambush lines that do nothing today to do what they print, so that Brotherhood of Mutants, Enemies of Asgard, Radiation and Sinister Spider-Foes play like the tabletop game.

| Card (`co2e/<group>`) | Printed Ambush (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| Mystique (`brotherhood-of-mutants`) | `Ambush: Each player discards an [team:x-men] Hero.` | No marker; nothing happens (ledger `(unmarked)`). | Every player who holds an X-Men Hero picks one and discards it; a player with none is logged. |
| Frost Giant Warrior (`enemies-of-asgard`) | `Ambush: Each player discards a [hc:ranged] Hero or gains a Wound.` | Nothing. | A player holding a Ranged Hero discards one or chooses to gain a Wound; a player with none gains a Wound. |
| Juggernaut (`brotherhood-of-mutants`) | `Ambush: Each player reveals their hand and discards all cards that have the same card names as any Heroes in the HQ. Then put all Heroes from the HQ on the bottom of the Hero Deck.` | Nothing. | Every player discards each hand card named like an HQ Hero; then the five HQ Heroes go to the bottom of the Hero Deck and the HQ refills. |
| Scorpion (`sinister-spider-foes`) | `Ambush: If there is another Spider-Foes Villain in the city, each player gains a Wound.` | Nothing. | Each player gains a Wound only when another Sinister Spider-Foes Villain is in the City. |
| The Leader (`radiation`) | `Ambush: Reveal a [hc:strength] Hero or play a card from the Villain Deck.` | Nothing. | If the player whose turn it is has a Strength Hero, nothing is played; otherwise the top Villain Deck card is played. |

## User-Visible Impact

- When Mystique or a Frost Giant Warrior ambushes, each player who can discard gets a "choose a Hero to discard" prompt listing only their X-Men (or Ranged) hand Heroes; for Frost Giant Warrior the list ends with **Gain a Wound instead**. The prompt opens right after the reveal, behind any escape the reveal caused. A bot ally discards its cheapest listed Hero; autoplay, sim and PAR take the first listed card.
- Juggernaut's Ambush logs, per player, the cards discarded for sharing a card name with an HQ Hero, then names the Heroes sent to the bottom of the Hero Deck. The HQ shows five new Heroes (or the same five back, when the Hero Deck was empty).
- Scorpion's Ambush wounds everyone, or logs `no other sinister-spider-foes Villain is in the City; no effect.`
- The Leader's Ambush logs either the Strength reveal (no card played) or the usual `plays the top card of the Villain Deck` line.

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L556-575: an escape runs (1) HQ KO, (2) every-player Bystander discard, (3) the Escape effect; then the new Villain's Ambush ("handle all the Escape effects for the escaping Villain … before handling any" Ambush).
   - L566 and L2143: a discard is from the hand ("discard a card from their hand"; "Discard a non-grey Hero from your hand").
   - L3186-3201: "Reveal a card" = show one from hand or played this turn; "if a card says 'do A or do B,' you can choose either option that you can actually do. You can't choose an option that you can't do."
   - L2773-2778: a Divided (split) card anywhere but in play "counts as all its Hero Classes, Teams, card names, and Hero Names".
   - L749-753: "Whenever there is an empty space in the HQ … for any reason, you refill that space immediately with the top card of the Hero … Deck".
   - L1539-1541: "If something causes a Haunted Hero to leave the HQ, then the Haunting Villain stays in that HQ space and Haunts the new Hero that arrives".
   - L1170: "Gain" means put it into your discard pile.
2. **Card text and markers on the baseline.** `data/cards/co2e.json` prints the five lines in §Goal verbatim (groups `brotherhood-of-mutants` id 1, `enemies-of-asgard` 2, `radiation` 5, `sinister-spider-foes` 6). On draft `main`, `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.co2e` (L91-101) holds only `masters-of-evil` and `skulls` rows, and the ledger rows `co2e-villain-brotherhood-of-mutants-juggernaut` (L137), `…-mystique` (L140), `co2e-villain-enemies-of-asgard-frost-giant-warrior` (L132), `co2e-villain-sinister-spider-foes-scorpion` (L144), `co2e-villain-radiation-the-leader` (L151) are `(unmarked)` (`docs/ai/coverage/villain-mechanic-ledger.csv`). If any sibling WP-835..840 merged first, its groups and rows sit beside these (expected; EC Before Starting): Juggernaut / Mystique / Scorpion may already carry WP-835's Fight / Escape markers and Frost Giant Warrior WP-836's Fight marker, with those ledger rows already `executable`. What must hold: none of **this packet's five Ambush lines** carries an `[effect:]` marker. Villain instance ids are `${setAbbr}-villain-${groupSlug}-${cardSlug}-NN` (`setup/buildCardDisplayData.ts` L516). Hero instance ids are `{set}/{hero}/{card}#{n}`.
3. **Vocabulary.** `VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` L335-366 / L434-483) hold **31** members at the baseline, last `discard-hero-each-player-by-cost` (more if WP-836 / 838-840 landed first; either is fine — this packet appends after whatever is last); `VillainEffectCondition` / `VILLAIN_EFFECT_CONDITIONS` (L492 / L501) hold `'savior'` only. Pins: the five pins in `rules/villainAbility.types.test.ts` (ordered list, length, last-member literal + position, L619, L652; length 31 at the baseline), plus the count in the L359 title and the L396 / L401 messages, and L590-608 (conditions = `['savior']`). `descriptorKey` = `primitive|target|magnitude|selector`; `requireKind` / `requireValue` / `requireCondition` stay out of it.
4. **Parser** (`setup/villainAbility.setup.ts`): `parseParameterizedEffect` (L388) splits `!` first (membership via `isVillainEffectCondition`, L362), then `@`, then `parseUngatedEffect` (L490). `parseTraitPredicateTokens` (L285) parses `<primitive>:<kind>:<value>` (kind `team` | `hc` → `hero-class`, value normalized). The `play-villain-deck-cards` arm (L689-704) accepts exactly 2 parts. The no-param tail (L836) returns `{ primitive }` for a 1-part token. `parsePositiveInteger` (L225) parses `:<N>`.
5. **Executor** (`villain/villainEffects.execute.ts`): the loop (L184-260) runs the location gate, then the condition gate `isConditionGateSatisfied(G, currentPlayer, timing, descriptor)` (L644-679, a `switch` over the closed union with a `never` default), then dispatch. `VILLAIN_EFFECT_HANDLERS` (L3951) is a full `Record<VillainEffectPrimitive, …>`. `villainEffectPlayVillainDeckCards` (L1746) is a no-op; `villainCardPlaysVillainDeckCards(G, cardId, timing)` (L1774) returns the play count; `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L720) lists it. `playerHasHeroMatchingTrait` (L1917, hand off-play + still-in-play), `describeRevealRequirement` (L2227), `villainEffectTimingLabel` (L1812), `resolveCardDisplayName` (L372), `gainWoundWithOutcome` and `refillHqSlot` (already imported, L50 / L64), the `gain-wound` `target: 'each'` branch (L960-989, the legacy `gainWoundEachPlayer` keyword, narrated by the fire site) and `victoryPileHasOtherGroupVillain` (L3779, the anchored group-prefix precedent, D-24299) exist. Keyword-less primitives self-narrate (`pushLog`, hash-excluded `G.messages`, D-24081).
6. **Fire sites.** `villainDeck/villainDeck.reveal.ts` runs the onAmbush executor (L347) after the card is pushed into the City, then reads `villainCardPlaysVillainDeckCards(G, cardId, 'onAmbush')` (L388) and plays via `playTopVillainDeckCards` (L414). `moves/fightVillain.ts` L697 reads the same helper for onFight. Every villain-deck reveal runs inside a move (`performVillainReveal` callers are moves, rule effects and resolvers reached from moves; none from `turn.onBegin`).
7. **The owed-discard queue and opener (WP-817).** `PendingEscapeEffectDiscard { escapedCardId; eligibleCosts }` (`types.ts` L1601) sits on lazy `G.pendingEscapeEffectDiscards`. `openEscapeProcedureSeatChoiceIfNeeded` (`villainDeck/villainEscapeProcedure.ts` L272) drains the escape procedures, then calls `openEscapeEffectDiscardIfNeeded` (L326-362; the module already imports `resolveCardName` / `formatCardRef` from `log/logDisplay.ts` and `pushLog`; waits on `hasAnyPendingChoice` / `pendingHeroChoice` / `evaluateEndgame`, shifts the front, builds `buildEscapeEffectCostDiscardChoice` (L374), parks with the step-2 ride rule). `applyEscapeEffectCostDiscard` (L545). It runs from `game.ts` `turn.onMove` L891 after every move (before the Diving Block opener L913), and from both sim runners, `par.aggregator.ts` and the fixture runner. The queue is already in the end-of-game drop set (`endgame/mastermindVictory.logic.ts`) and the operator board-busy guard (`moves/operatorSetters.logic.ts`). On main (WP-829), `turn.onMove` runs `sweepPurgedHeroesFromHq` before the escape opener (~L896) and `openTimestreamPurgeSeatChoiceIfNeeded` after it; neither interacts with this queue. `PendingEscapeEffectDiscard` is at `types.ts` ~L1616 on main.
8. **Seat-choice seams.** `moves/seatChoice.resolve.ts` `applySeatChoiceByKind(G, choice, shuffleContext, currentPlayer?)` dispatches by `kind` (the WP-817 arm L533-536; ~L543 on main, beside WP-829's `timestream-purge` arm). `simulation/ai.seatChoice.ts` L133-142 sends the discard kinds to `indexOfLeastValuableCard` (L317), which skips an option with no `cardId`. `SeatChoiceOption.cardId` is optional (`types.ts` L1360). `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` `heading()` (L88-129) maps `kind` → heading. No closed kind list exists.
9. **Trait and split helpers.** `moves/villainDefeatRequirement.logic.ts` holds `traitMeetsDefeatRequirement` (L108, private) and `listEligibleHandCardsByCost` (L177); `VillainDefeatRequirement { kind; value }` (`villainAbility.types.ts` L761). `hero/splitCard.logic.ts` exports `offPlayCardTraits` (L91) and `resolveSplitFacePair` (L48, both face instance ids or null).
10. **Discard and Wound chokepoints.** `moves/discardFromHand.ts` `discardFromHand(G, playerID, cardId): boolean` (G-only; fires return-on-discard / teleport-on-discard; the drift test allows callers anywhere). `board/wounds.logic.ts` `gainWoundWithOutcome(G, playerID)` → `'no-wound' | 'gained' | 'diving-block-pending'` (the Diving Block / Flying Shield Block interception parks a G queue the onMove openers drain). The supply is `G.piles.wounds` (top = `[0]`); `G.turnEconomy.woundsDrawn` counts the current player's villain Wounds (`gain-wound:each` L976, reveal-or-wound L2161).
11. **HQ.** `G.hq` holds `CardExtId | null` per slot; `refillHqSlot(hq, index, heroDeck)` (`board/city.logic.ts` L204) pops `heroDeck[0]` (top) and leaves the slot null on an empty deck; the bottom is the end of `G.heroDeck` (`moves/resolveOptionalPutBottomHQ.ts` L139-145). `G.hqHaunters` is index-aligned with `G.hq` (`board/haunt.logic.ts` L11).
12. **Group lookup.** `G.selection.villainGroupIds` holds the match's set-qualified Villain Group ids (`set/slug`, `setup/buildInitialGameState.ts` L186-194). Scheme-added groups (Monsters Unleashed, D-24736) are not in it.
13. **Marker script.** `scripts/convert-cards/apply-effect-markers.mjs` keeps hand-synced copies of the primitives (L175-207) and conditions (L215); `isValidParameterizedEffectToken` (L271) has the `play-villain-deck-cards` arm (L370) and the shared trait arm (L379-392). It appends multiple markers per line in list order. `scripts/coverage/mechanic-provenance.json` keys villain primitives (L60-81).
14. **No hashed fixture or PAR artifact plays these groups.** They appear in `packages/registry/src/gauntletLoadouts.generated.ts`, `setup/buildCardAbomination.test.ts` (inline lines), `docs/ai/rulings/effect-rulings.json` (co2e Maestro only). `docs/ai/coverage/runtime-observed-hollows.json` has no co2e entry. The hash sentinel is `core/dr-doom`.
15. **Imports.** `villainEffects.execute.ts` gains `discardFromHand` (`moves/discardFromHand.js`) and `resolveSplitFacePair` (already-imported module); `villainEscapeProcedure.ts` gains `gainWoundWithOutcome` (`board/wounds.logic.js`) and `listEligibleHandCardsByTrait` (from an already-imported module). The first (`gainWoundWithOutcome`) closes a function-body-only cycle (wounds.logic → divingBlock.logic → seatChoice.resolve → this module), the shape of the existing cycles documented at `villainEscapeProcedure.ts` L31-41. `villainEscapeProcedure.ts` also gains `seatsInTurnOrderFrom` (`turn/seatOrder.logic.js`, pure, no cycle); `villainEffects.execute.ts` already imports it on `main` (WP-846), and its handlers already receive `currentPlayer`.
16. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24770) before coding.

## Context (Read First)

- **Why Mystique and Frost Giant Warrior reuse WP-817's queue.** "Each player discards …" is a multi-seat choice. The executor has no `events`, so, like Primus's Escape, the handler records the owed discard and the `turn.onMove` opener parks it after the move. The reveal move is a move, so the opener already runs after every Ambush. One FIFO keeps rule order: an escape in the same reveal records first (step 3 runs inline before the Ambush), and escape steps 1-2 drain before any owed discard. The entry gains one optional `traitFilter`; old entries (Primus) and in-flight bgio states without it route exactly as today, so no field is renamed and no drop-set or busy-guard line changes. WP-839 (Speed Demon, its fork F3) adds a sibling optional `anyHandCard` field to the same entry; the route tests `traitFilter` first and leaves every other entry (cost or `anyHandCard`) on its `main` builder, so either landing order works.
- **Ambush deviation (extends D-24750 point 9).** The discard resolves after the move rather than mid-move. It is observable only when the same move continues past the Ambush (a chained reveal). Recorded in D-24770.
- **Frost Giant Warrior's choice is real.** Rules L3199-3201: a player holding a Ranged Hero may discard it or take the Wound; a player without one must take the Wound; a player cannot pick the Wound when the Wound supply is empty. So the prompt lists the Ranged Heroes plus **Gain a Wound instead** (only while the supply has a Wound), and seats with no Ranged Hero are wounded when the choice opens.
- **Juggernaut is two auto-resolving primitives on one line.** No player chooses anything ("discards all"). Both halves recur in the data (`mgtg` Ambush "Put all Heroes from the HQ on the bottom of the Hero Deck"; `wwhk` and `co2e` Loki "discards each card with the same card name …"), so they are separate no-param primitives that run left to right: the name scan reads the HQ before it moves.
- **Card name identity.** A card's name key is its card slug, the third `/` segment of `{set}/{hero}/{card}` (copy suffix stripped). 65 printed card names occur under more than one id (reprints such as `3dtc` / `dims`, and `co2e` reprints of `core` Heroes); the slug matches them, an exact base id would not. No printed name maps to more than one slug; three slugs carry punctuation or case variants of one name (`hulk-smash`, `high-stakes-jackpot`, `hey-can-i-get-a-do-over`). A split card counts as both faces' slugs (rules L2773-2778).
- **Split cards and the trait predicate.** A split card's team is its Hero's (both faces share it; 0 of 39 split physical cards differ); its Hero Classes are both faces' (`offPlayCardTraits` unions the classes and returns face a's team). The trait discard reuses that view unchanged; `offPlayCardTraits` is not edited. Game logic does not read `G.cardDisplayData` (the WP-111 presentation / gameplay split).
- **Scorpion is an existing primitive behind a new condition.** `gain-wound:each` keeps the legacy `gainWoundEachPlayer` narration and `ambushResolved` badge. The new condition `another-group-villain-in-city` is a board test, a sibling of `savior` (D-24749, the closed `!<condition>` set). The marker grammar has no slot for a group slug on a condition, so the gate finds the triggering Villain's own group from `G.selection.villainGroupIds` (the longest `${set}-villain-${group}-` prefix of its id) and fails closed when none matches. "Spider-Foes Villain" = a Villain of Scorpion's own group (`co2e/sinister-spider-foes`); a core `spider-foes` Villain does not count (D-24299 matches a group by the card's own set prefix; Operator fork 1).
- **The Leader extends `play-villain-deck-cards`.** "Reveal X or play a card" is the existing play with an "unless you reveal" gate, so the primitive gains an optional `:<kind>:<value>` tail. Revealing costs nothing and playing a Villain Deck card only hurts, so the reveal auto-resolves when possible (D-24281; rules L3192-3197 allow declining, which no rational player does). The handler stays a no-op apart from one log line; the fire sites ask the same predicate whether to play. "You" is the player whose turn it is (`ctx.currentPlayer`).
- **Seat order (D-24780, amended 2026-10-27).** Rules v23 L2247: an each-player effect starts with the current player, then goes clockwise. D-24780 §13's forward rule: a new each-player loop whose order changes a Wound-stack, Flying Shield Block or discard-reaction outcome iterates `seatsInTurnOrderFrom`; one that does not stays sorted with a `// why:`. Two loops here change an outcome. Juggernaut's discards fire return-on-discard / teleport reactions through `discardFromHand`, and those queues fill in loop order. Frost Giant Warrior's open-time Wounds (prepare pass 1) decide who misses the last Wound and the order Flying Shield Block is asked in. Both walk `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`. Prepare pass 2 (the holders' options of a simultaneous prompt) and `applyVillainEffectTraitDiscard` (a simultaneous seat-choice apply) stay ascending (D-24780 §6, D-24501), as WP-817's cost builder / apply and WP-845's apply do. Scorpion's `gain-wound:each` is V2, which WP-846 already rotated.
- **Split vs one WP.** Five Ambush lines share one marker map, the parser / executor pair and the WP-817 opener. The Juggernaut, Scorpion and Leader halves are small and touch no seat-choice code; splitting them out would not shrink the contract surface. The file count is above the ~10 guideline (justified in §Files Expected to Change).
- **Soft ordering.** WP-835 / WP-836 add rows to the same `villains.co2e` marker blocks (other timings of Juggernaut, Mystique, Scorpion, Frost Giant Warrior) and WP-836 / WP-838..840 append primitives to the same union, array, handler map, script copy and count pins. Whichever lands later rebases those blocks; this packet's positions are "the next four after `main`'s last", whether or not the siblings have landed. WP-829 (merged) added `timestream-purge` arms to `seatChoice.resolve.ts`, `ai.seatChoice.ts` and `PendingSeatChoicePrompt.vue`; this packet's arms go beside them. WP-830 (#2998) has merged (`e580d801`; anchor shifts only). WP-831 / WP-832 (#3001 / #3004) have merged: work on top of their `seatChoice.resolve.ts`, `ai.seatChoice.ts`, `PendingSeatChoicePrompt.vue`, `fightVillain.ts`, `types.ts` and `villainDeck.reveal.ts` edits and re-read the L388 / L697 call sites.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape), §5 (printed markup; `[effect:]` is a pipeline-appended marker).
- `docs/ai/ARCHITECTURE.md`: §Zone & Pile Structure, Persistence Boundaries (`G` runtime-only), §The Rule Execution Pipeline. `.claude/rules/architecture.md` §Layer Boundary (the client gets only the heading; options arrive projected).
- `docs/ai/DECISIONS.md`: scan D-24023, D-24081, D-24266, D-24281, D-24284, D-24294, D-24299, D-24351, D-24372, D-24499, D-24501, D-24587, D-24604, D-24656, D-24673, D-24686, D-24703, D-24749, D-24750, D-24780 before coding.
- User memory: `reference_villain_effect_vocabulary_extension`, `reference_pending_choice_wp_full_file_set`, `reference_interactive_choice_active_player_only`, `reference_bot_legalmoves_moveguard_divergence`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`.

### Operator forks (recommended default first; the draft is written to the default)

1. **Which Villains are "Spider-Foes"?** Default: Scorpion's own group only (`co2e/sinister-spider-foes`). Alternative: also core `spider-foes` (a name match), which needs a second prefix and breaks the own-group rule Viper uses.
2. **Frost Giant Warrior: may a player holding a Ranged Hero take the Wound?** Default: yes, the prompt offers it (rules L3199-3201). Alternative: force the discard (no Wound option), simpler but drops a printed choice.
3. **The Leader: auto-reveal?** Default: yes (D-24281). Alternative: a prompt to decline the reveal; no reason to ever pick it.
4. **Juggernaut: bottom order of the HQ Heroes.** Default: HQ slot order 0 → 4 (slot 4 ends last). Alternative: player-chosen or random; the card prints neither (contrast `cvwr` "in random order").
5. **Card-name identity.** Default: card slug (reprints match). Alternative: exact `{set}/{hero}/{card}` base (only the same Hero deck matches).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24770) before coding. One WP per session.

**Packet-specific:**
- **One trait predicate.** Hand eligibility for both discard primitives goes through `listEligibleHandCardsByTrait` (which reuses `traitMeetsDefeatRequirement` over `offPlayCardTraits`). The Leader's reveal reuses `playerHasHeroMatchingTrait`. No other inline trait scan.
- **One owed-discard queue.** Mystique and Frost Giant Warrior push onto `G.pendingEscapeEffectDiscards` with a `traitFilter`; no new `G` field, no rename. An entry without `traitFilter` routes exactly as on `main` (WP-817's cost builder, plus WP-839's `anyHandCard` builder if it landed first).
- **Chokepoints.** Every hand→discard goes through `discardFromHand`; every Wound through `gainWoundWithOutcome`.
- **Byte-identical elsewhere.** No new `G` key in any match; every existing marker parses to the same descriptor; `play-villain-deck-cards:<N>` (2 parts) is unchanged; `getLegalMoves` is untouched. Hash oracles stay unchanged (STOP if one moves).
- **Data, not English.** Behavior comes only from the six markers (five lines) in Locked Values. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** The four new primitives and the Leader's reveal log through `pushLog`. `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen.
- **Fail closed.** The new condition with no resolvable group, and a gated play with no `currentPlayer`, do nothing.

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order: `'discard-hero-each-player-by-trait'`, `'discard-hero-or-wound-each-player-by-trait'`, `'discard-hand-matching-hq-card-names-each-player'`, `'hq-heroes-to-hero-deck-bottom'` (positions 32-35 at draft; re-read at execution).
- `VillainEffectCondition = 'savior' | 'another-group-villain-in-city'`; `VILLAIN_EFFECT_CONDITIONS = ['savior', 'another-group-villain-in-city']`.
- Descriptor JSDoc lists the four primitives and the gated `play-villain-deck-cards` form; `requireKind` / `requireValue` JSDoc names the three new carriers. `descriptorKey` unchanged.

**State (`types.ts`):**
- `export interface PendingEffectDiscardTraitFilter { requireKind: 'team' | 'hero-class'; requireValue: string; requirementLabel: string; effectLabel: string; hasWoundAlternative: boolean; }` (JSDoc: the Hero-trait filter of an owed every-player discard; `requireValue` normalized; the two labels are log text set by the handler).
- `PendingEscapeEffectDiscard.traitFilter?: PendingEffectDiscardTraitFilter`. A trait entry carries `eligibleCosts: []`. `escapedCardId` JSDoc widens to "the Villain whose Escape or Ambush effect owes the discard".

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `discard-hero-each-player-by-trait:<kind>:<value>` and `discard-hero-or-wound-each-player-by-trait:<kind>:<value>` — the shared trait arm (`parseTraitPredicateTokens`) → `{ primitive, requireKind, requireValue }`.
- `discard-hand-matching-hq-card-names-each-player`, `hq-heroes-to-hero-deck-bottom` — no params (the existing tail). Any param → null.
- `play-villain-deck-cards:<N>` (unchanged) **or** `play-villain-deck-cards:<N>:<kind>:<value>` → `{ primitive, magnitude: N, requireKind, requireValue }` (N via `parsePositiveInteger`; the tail via `parseTraitPredicateTokens([parts[0], parts[2], parts[3]])`). Any other part count → null.
- Condition suffix `!another-group-villain-in-city` (case-sensitive membership, as `savior`).

**Executor (`villain/villainEffects.execute.ts`):**
- `isConditionGateSatisfied(G, currentPlayer, cardId, timing, descriptor)` (gains `cardId`). Arm `'another-group-villain-in-city'`: `resolveVillainGroupPrefix(G, cardId)` → `{ groupSlug, groupPrefix } | null` (scan `G.selection?.villainGroupIds ?? []`; each `set/slug` id with exactly two parts gives `${set}-villain-${slug}-`; keep the longest that `cardId` starts with). Null → `` `${label} effect: the Villain's group is not among this match's Villain Groups; no effect.` `` `'blocked'`, false. Else `cityHoldsOtherGroupVillain(G, groupPrefix, cardId)` (any `G.city[i]` non-null, `!== cardId`, `startsWith(groupPrefix)`; loop by `G.city.length`) → true; otherwise `` `${label} effect: no other ${groupSlug} Villain is in the City; no effect.` `` `'blocked'`, false.
- `discard-hero-each-player-by-trait` / `discard-hero-or-wound-each-player-by-trait` handlers (`villainEffectDiscardHeroEachPlayerByTrait`, `villainEffectDiscardHeroOrWoundEachPlayerByTrait`, sharing `recordOwedTraitDiscard(G, cardId, timing, descriptor, hasWoundAlternative)`): missing `requireKind` / `requireValue` → `` `${label} effect: no Hero trait was given; no effect.` `` `'blocked'`. Else push `{ escapedCardId: cardId, eligibleCosts: [], traitFilter: { requireKind, requireValue, requirementLabel: describeRevealRequirement(kind, value), effectLabel: label, hasWoundAlternative } }` (lazy-init the queue) and log `` `${label} effect: each player must discard ${article} ${requirementLabel} Hero.` `` or, with the Wound alternative, `` `${label} effect: each player must discard ${article} ${requirementLabel} Hero or gain a Wound.` `` `'applied'` (`article` = `an` when the label matches `/^[AEIOUX]/`, else `a`). Returns `{ targets: [] }`.
- `cardNameKeysOf(G, cardId): string[]` — base = text before `#`; a split card (`resolveSplitFacePair` non-null) contributes both faces' bases; each base with exactly three `/` segments contributes `segments[2]`; others contribute nothing.
- `discard-hand-matching-hq-card-names-each-player` (`villainEffectDiscardHandMatchingHqCardNamesEachPlayer`): HQ keys = union of `cardNameKeysOf` over non-null `G.hq` slots. Empty → `` `${label} effect: the HQ is empty, so no player discards.` `` `'blocked'`. Else, seats `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (D-24780: current player first, then clockwise; sorted when `currentPlayer` is absent — its discards fire return-on-discard / teleport reactions in loop order), each over a **copy** of its hand in hand order: a card whose keys meet the HQ keys is discarded via `discardFromHand`; a seat that discarded logs `` `${label} effect: Player ${seat} discarded ${names} (same card name as a Hero in the HQ).` `` `'applied'` (`names` = `resolveCardDisplayName` joined `, `). No seat discarded → `` `${label} effect: no player had a card with the same card name as a Hero in the HQ.` `` `'blocked'`.
- `hq-heroes-to-hero-deck-bottom` (`villainEffectHqHeroesToHeroDeckBottom`): for each slot 0 → last, a non-null Hero is pushed onto the end of `G.heroDeck` and its slot set to null; then every null slot 0 → last is refilled through the pure `refillHqSlot`, rebinding its result each time: `const result = refillHqSlot(G.hq, index, G.heroDeck); G.hq = result.hq; G.heroDeck = result.heroDeck;` (the `villainEffects.execute.ts` L3453 pattern). `G.hqHaunters` is never touched. Moved ≥ 1 → `` `${label} effect: put ${N} Hero(es) from the HQ on the bottom of the Hero Deck (${names}); the HQ refilled.` `` `'applied'`; none → `` `${label} effect: the HQ is empty; no Hero was put on the bottom of the Hero Deck.` `` `'blocked'`.
- The Leader gate: private `currentPlayerRevealsForVillainDeckPlay(G, descriptor, currentPlayer): boolean` = descriptor has `requireKind` + `requireValue` and the player's zones exist and `playerHasHeroMatchingTrait(...)`. `villainCardPlaysVillainDeckCards(G, cardId, timing, currentPlayer?: string)`: an ungated descriptor returns `magnitude ?? 1` as today; a gated one returns 0 when `currentPlayer` is undefined or the predicate is true, else `magnitude ?? 1`. The handler `villainEffectPlayVillainDeckCards`, when the predicate is true, logs `` `${label} effect: Player ${currentPlayer} revealed ${article} ${requirement} Hero, so no card is played from the Villain Deck.` `` `'blocked'`; otherwise it does nothing. It stays in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (it mutates only the hash-excluded log).
- Handler map: the four new entries.

**Fire sites:** `villainDeck.reveal.ts` L388 passes `ctx.currentPlayer`; `fightVillain.ts` L697 passes `currentPlayer`. No other change.

**Escape opener (`villainDeck/villainEscapeProcedure.ts`):**
- `export const VILLAIN_EFFECT_TRAIT_DISCARD_KIND = 'villain-effect-trait-discard';` `export const VILLAIN_EFFECT_WOUND_OPTION_LABEL = 'Gain a Wound instead';` (if WP-845 landed first, import `VILLAIN_EFFECT_WOUND_OPTION_LABEL` from `moves/revealOrWoundChoice.logic.ts` instead of declaring it — one constant, not two literals)
- `openEscapeEffectDiscardIfNeeded`: after the shift, `entry.traitFilter !== undefined` → `prepareVillainEffectTraitDiscardChoice(G, entry.traitFilter, currentPlayer)`; every other entry routes exactly as on `main` (WP-817's `buildEscapeEffectCostDiscardChoice`, plus WP-839's `anyHandCard` builder if it landed first). Park unchanged (step-2 ride rule).
- `prepareVillainEffectTraitDiscardChoice(G, filter, currentPlayer?)` runs **two passes**. Pass 1 walks `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (D-24780: its Wounds decide who misses the last one and the order Flying Shield Block is asked in; sorted when `currentPlayer` is absent) and resolves every seat with no eligible Hero (the blocked / Wound lines below); pass 2 then walks the seats ascending (`Object.keys(G.playerZones).sort()`; the builder of a simultaneous prompt, D-24780 §6 / D-24501) and builds the options of every seat that holds one, so the `G.piles.wounds.length > 0` check sees every Wound gained at open and a holder is never offered a Wound the supply no longer has. Eligible = `listEligibleHandCardsByTrait(G, seat, { kind: filter.requireKind, value: filter.requireValue })`. None and no Wound alternative → `` `${effectLabel} effect: Player ${seat} has no ${requirementLabel} Hero to discard.` `` `'blocked'`. None with the alternative → `gainWoundWithOutcome(G, seat)`: `'gained'` → `` `${effectLabel} effect: Player ${seat} has no ${requirementLabel} Hero to discard and gained a Wound.` `` `'applied'`; `'diving-block-pending'` → `` `${effectLabel} effect: Player ${seat} has no ${requirementLabel} Hero to discard and would gain a Wound — Diving Block can prevent it.` `` `'applied'`; `'no-wound'` → `` `${effectLabel} effect: Player ${seat} has no ${requirementLabel} Hero to discard; the Wound supply is empty.` `` `'blocked'`; a non-`no-wound` outcome for `seat === currentPlayer` adds 1 to `G.turnEconomy.woundsDrawn`. Pass 2, for each holding seat: options = eligible cards in hand order, label `resolveCardName(G.cardDisplayData, id)` + `cardId`, then — only when `hasWoundAlternative` and `G.piles.wounds.length > 0` — `{ label: VILLAIN_EFFECT_WOUND_OPTION_LABEL }` (no `cardId`). No addressed seat → undefined. `kind: VILLAIN_EFFECT_TRAIT_DISCARD_KIND`, `defaultOptionIndex: 0`.
- `applyVillainEffectTraitDiscard(G, choice, currentPlayer?)`: ascending seats (`[...choice.addressedSeats].sort()`, as `applyEscapeEffectCostDiscard`; a simultaneous seat-choice apply stays sorted, D-24780 §6 / D-24501); option with `cardId` → `discardFromHand`, on success `` `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Villain effect).` `` `'applied'`; option without `cardId` → `gainWoundWithOutcome`: `'gained'` → `` `Player ${seat} gained a Wound instead of discarding (Villain effect).` `` `'applied'`; `'diving-block-pending'` → `` `Player ${seat} would gain a Wound instead of discarding — Diving Block can prevent it.` `` `'applied'`; `'no-wound'` → `` `Player ${seat} chose to gain a Wound, but the Wound supply is empty.` `` `'blocked'`; the same `woundsDrawn` rule.
- **Helper (`moves/villainDefeatRequirement.logic.ts`):** `export function listEligibleHandCardsByTrait(state, playerId, requirement: VillainDefeatRequirement): CardExtId[]` — the hand in hand order filtered by `traitMeetsDefeatRequirement(offPlayCardTraits(state, id), requirement)`; missing zones → `[]`.
- Dispatch: `seatChoice.resolve.ts` `if (choice.kind === VILLAIN_EFFECT_TRAIT_DISCARD_KIND) { applyVillainEffectTraitDiscard(G, choice, currentPlayer); return; }` beside the WP-817 arm. Bot: `ai.seatChoice.ts` adds the kind to the `indexOfLeastValuableCard` branch (the Wound option has no `cardId`, so the bot discards its cheapest listed Hero).
- Client: `PendingSeatChoicePrompt.vue` `case 'villain-effect-trait-discard': return 'A Villain\'s effect — choose a Hero to discard';`.

**Data:**
- Marker map `villains.co2e` gains (alphabetical group keys; merged into any card objects WP-835 / 836 / 838 / 839 / 840 already added, never replacing their keys):
  `"brotherhood-of-mutants": { "juggernaut": { "ambush": ["discard-hand-matching-hq-card-names-each-player", "hq-heroes-to-hero-deck-bottom"] }, "mystique": { "ambush": ["discard-hero-each-player-by-trait:team:x-men"] } }`,
  `"enemies-of-asgard": { "frost-giant-warrior": { "ambush": ["discard-hero-or-wound-each-player-by-trait:hc:ranged"] } }`,
  `"radiation": { "the-leader": { "ambush": ["play-villain-deck-cards:1:hc:strength"] } }`,
  `"sinister-spider-foes": { "scorpion": { "ambush": ["gain-wound:each!another-group-villain-in-city"] } }`.
- `apply-effect-markers.mjs`: the four primitives appended to its copy in the same order, `'another-group-villain-in-city'` appended to its conditions copy, the two trait primitives added to the shared trait arm, and the 4-part `play-villain-deck-cards` form (`parts.length === 4 && /^[1-9][0-9]*$/.test(parts[1]) && (parts[2] === 'team' || parts[2] === 'hc') && parts[3].length > 0`).
- `mechanic-provenance.json`: the four primitives → `{ "wp": "WP-837", "decision": "D-24770" }`.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: four primitives, one condition, JSDoc.
- **B)** `setup/villainAbility.setup.ts` + test: two trait arms, the gated `play-villain-deck-cards` form, grammar doc list.
- **C)** `villain/villainEffects.execute.ts` + test: four handlers, the condition arm and its two helpers, `cardNameKeysOf`, the Leader gate in the counter and the handler.
- **D)** `villainDeck/villainDeck.reveal.ts` + test, `moves/fightVillain.ts`: pass the current player to the counter.
- **E)** `types.ts`: the filter interface and the optional entry field.
- **F)** `moves/villainDefeatRequirement.logic.ts` + test: `listEligibleHandCardsByTrait`.
- **G)** `villainDeck/villainEscapeProcedure.ts` + test, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` + test: the trait-discard route, prepare, apply, dispatch, bot.
- **H)** Client: `PendingSeatChoicePrompt.vue` + test (one heading).
- **I)** Card data: script + map, `co2e.json` regenerated (5 lines), provenance, regenerated ledger + effect index; `wiki/card-effect-system.md` (one history bullet).

## Out of Scope

- **The other co2e lines** on these cards (Juggernaut / Scorpion Fight, Mystique Escape → WP-835; Frost Giant Warrior Fight → WP-836) and every other inventory row (WP-835, 836, 838-840).
- **The same shapes in other sets** (`xmen` / `nmut` "discards an X-Men Hero or gains a Wound", `mgtg` HQ-to-bottom, `wwhk` / co2e Loki same-name discards, the Master Strike variants). The primitives are their append point; marking them is separate work.
- **The `ambushResolved` overlay for keyword-less Ambushes.** Every keyword-less Ambush (these four, co2e Baron Zemo and Whirlwind, core Ymir's reveal-or-wound) composes "entered the city with no Ambush effect"; The Leader's revealed case does too. Descriptor-keyed narration is deferred to WP-253; the log carries the outcome.
- **A strikeBlocked event for The Leader's reveal** (reveal-or-wound pushes one; adding it here would touch the hashed `notableEvents` surface for a cosmetic overlay).
- **Inline Ambush resolution order** (the after-the-move deviation in §Context) and a prompt for declining The Leader's reveal (Operator fork 3).
- **Scheme-added Villain Groups** in the Scorpion group lookup (Monsters Unleashed has no such line).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `villainDeck/villainDeck.reveal.ts`, `villainDeck/villainDeck.reveal.test.ts` — modified (one argument; T16)
- `moves/fightVillain.ts` — modified (one argument)
- `types.ts` — modified (one interface, one optional field)
- `moves/villainDefeatRequirement.logic.ts`, `moves/villainDefeatRequirement.logic.test.ts` — modified
- `villainDeck/villainEscapeProcedure.ts`, `villainDeck/villainEscapeProcedure.test.ts` — modified
- `moves/seatChoice.resolve.ts` — modified (one arm)
- `simulation/ai.seatChoice.ts`, `simulation/ai.seatChoice.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/PendingSeatChoicePrompt.vue`, `components/play/PendingSeatChoicePrompt.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (5 lines gain a marker; Juggernaut's gains two)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated

**ewiki:** `wiki/card-effect-system.md` — modified (one WP-837 bullet in the history list).

**Governance:** `docs/ai/DECISIONS.md` (D-24770), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-837-co2e-each-player-discard-and-reveal-gated-ambushes.md` — new (mandatory per `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` L42-51: a new contract, a new seat-choice kind and extension seam).

That is 17 engine files (7 tests; 3 production files are one-line edits), 2 client files, 3 script/input files, 1 card-data file, 3 generated feeds and 1 ewiki page. Above the ~10 guideline because five lines span the parser, executor, two fire sites and the WP-817 opener; each file is a small append. Every test file named above exists on the baseline.

## Contract

- The Locked Values above: the four primitives and their grammar, the gated `play-villain-deck-cards` form, the `another-group-villain-in-city` condition and its group lookup, `PendingEffectDiscardTraitFilter` and `PendingEscapeEffectDiscard.traitFilter?`, `listEligibleHandCardsByTrait`, the `villain-effect-trait-discard` kind and Wound option label, the card-name key rule, the HQ bottom order, and the exact log strings.
- `executeVillainAbilities`, every existing handler's behaviour, `discardFromHand`, `gainWoundWithOutcome`, `parkSeatChoice`, `resolveSeatChoice`, `buildEscapeEffectCostDiscardChoice` and `applyEscapeEffectCostDiscard` keep their signatures and behaviour. `villainCardPlaysVillainDeckCards` gains one trailing optional parameter. `descriptorKey` is unchanged.

## Test Contract

Minimal-`G` fixtures in each file's existing style (`messages: []`, `cardTraits` / `cardStats` entries per card, `selection.villainGroupIds` where the condition runs). Each T-case is at least one `it`, grouped under one `describe('WP-837 …')` per file. T1 moves the five pins in `villainAbility.types.test.ts` (ordered list, length, last-member literal + position, L619, L652), plus the count in the L359 title and the L396 / L401 messages, to `main`'s count + 4 (31 → 35 from the baseline), and T2 the condition pin 1 → 2: value changes from an intended product change, said so in the commit body.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES` | main's count + 4 (35 from the baseline), the four last in the locked order; the L385-405 ordered list gains them and its last-member assertion names `hq-heroes-to-hero-deck-bottom`; parity passes | |
| T2 | types | `VILLAIN_EFFECT_CONDITIONS`; `descriptorToLegacyKeyword({gain-wound, each, requireCondition: 'another-group-villain-in-city'})`; the four new descriptors; `{play-villain-deck-cards, magnitude 1, requireKind, requireValue}` | `['savior','another-group-villain-in-city']`; `'gainWoundEachPlayer'`; `undefined` × 5 | condition not in the key |
| T3 | setup | each Locked-Values marker, plus `play-villain-deck-cards:2` | the locked descriptors; `:2` → `{ magnitude: 2 }` with no `requireKind` | byte-identical old form |
| T4 | setup | `discard-hero-each-player-by-trait`, `…:team`, `…:xx:x-men`, `…:team:`, `discard-hand-matching-hq-card-names-each-player:1`, `hq-heroes-to-hero-deck-bottom:x`, `play-villain-deck-cards:1:hc`, `…:0:hc:strength`, `…:1:xx:strength`, `…:1:hc:strength:x`, `gain-wound:each!another-group-villain-in-City` | each unresolved | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the five lines copied **verbatim** from the regenerated `co2e.json` | five onAmbush hooks with the T3 descriptors (Juggernaut's two in order); no `unresolvedMarkers` | |
| T6 | logic | `listEligibleHandCardsByTrait` hand `[x-men A, pile-wound, avengers B, split card of an X-Men Hero (team on face a)]` vs team `x-men`; a split card whose **face b** is Ranged vs `hero-class` `ranged`; a dual-class Ranged card vs `ranged`; missing zones | `[A, split]`; the split card (face-b class union); the dual-class card; `[]` | hand not mutated; `offPlayCardTraits` unedited |
| T7 | executor | onAmbush `{discard-hero-each-player-by-trait, team, x-men}` for `mystique-01` | queue `[{ escapedCardId: 'mystique-01', eligibleCosts: [], traitFilter: { 'team','x-men','X-Men','Ambush', false } }]`; log `Ambush effect: each player must discard an X-Men Hero.` | no hand change |
| T8 | executor | the `-or-wound` primitive `hc` `ranged`; and a descriptor without `requireKind` | `hasWoundAlternative: true`, log `… a Ranged Hero or gain a Wound.`; then `no Hero trait was given` `blocked`, no queue | |
| T9 | executor | Juggernaut discard: HQ `[core/cyclops/optic-blast#0, split S#0, null, …]`; P0 hand `[core/cyclops/optic-blast#3, co2e/cyclops/optic-blast#1, starting-shield-agent, pile-wound]`; P1 hand `[co2e/storm/x#0]`; P2 hand `[a card matching S's face b]` | P0 discards both Optic Blasts, P2 the match, P1 nothing; per-seat lines; a discarded card carrying `return-on-discard` parks `pendingReturnOnDiscard` | slug match across sets; split both faces |
| T10 | executor | the same with no match; and an empty HQ | `no player had a card …` / `the HQ is empty, so no player discards.` `blocked`; hands unchanged | |
| T11 | executor | HQ `[a, b, null, c, d]`, heroDeck `[x, y]`, `hqHaunters [h, null, null, null, null]` | heroDeck after `[d]`; HQ `[x, y, a, b, c]`; log names a, b, c, d; `hqHaunters` deep-equal | snapshot then refill |
| T12 | executor | empty HQ and empty heroDeck | `the HQ is empty; no Hero …` `blocked`; nothing changes | |
| T13 | executor | The Leader `{play-villain-deck-cards, 1, hero-class, strength}`: `villainCardPlaysVillainDeckCards(G, id, 'onAmbush', '0')` with a Strength Hero in hand; only in play; none; `currentPlayer` undefined; an ungated `magnitude 2` with undefined | 0; 0; 1; 0; 2; the handler logs `Player 0 revealed a Strength Hero, so no card is played from the Villain Deck.` only in the reveal cases | |
| T14 | executor | Scorpion `{gain-wound, each, requireCondition}` on `co2e-villain-sinister-spider-foes-scorpion-01`, `selection.villainGroupIds ['co2e/sinister-spider-foes', 'co2e/sinister-syndicate']`: City also holds `…-green-goblin-01`; a second Scorpion copy; only `co2e-villain-sinister-syndicate-beetle-01` and `core-villain-spider-foes-venom-01`; selection without the group | wounds for every player + a `gainWoundEachPlayer` result; wounds; no wounds + `no other sinister-spider-foes Villain is in the City; no effect.`; `the Villain's group is not among …` | own group only; longest prefix |
| T15 | executor | synthetic selection `['test/foes', 'test/foes-elite']`, card `test-villain-foes-elite-x-01`, City holds `test-villain-foes-y-01` only | condition false (group `foes-elite`) | longest-prefix pin |
| T16 | reveal | co2e The Leader revealed with `villainDeck.deck [leader-01, villain-x]`: current player holds a Strength Hero; then holds none | `villain-x` stays on the deck + the reveal line; then `villain-x` enters the City after the `plays the top card` line | |
| T17 | escape | queue `[{mystique-01, [], traitFilter x-men, no Wound}]`; P0 hand `[xmen-A, other]`, P1 `[other]`, P2 `[xmen-B, xmen-C]`; opener called | one choice, kind `villain-effect-trait-discard`, seats `['0','2']`, P0 `[xmen-A]`, P2 `[xmen-B, xmen-C]`, default 0; `Ambush effect: Player 1 has no X-Men Hero to discard.`; queue deleted | |
| T18 | escape | T17's choice, submissions `0 → 0`, `2 → 1`, via the resolve dispatch | `xmen-A`, `xmen-C` discarded, `(Villain effect)` lines in seat order | |
| T19 | escape | Frost Giant entry: P0 hand `[ranged-R]`, P1 none; wound supply 3; then supply 1; then supply 0 | supply 3: P1 gains a Wound at open (`… and gained a Wound.`), P0 options `[ranged-R, Gain a Wound instead]`; supply 1: P1 gains the last Wound, P0 options `[ranged-R]` only (two-pass); supply 0: P1 `… the Wound supply is empty.`, P0 options `[ranged-R]` | can't pick the impossible option |
| T20 | escape | P0 submits the Wound option (P0 current; then P0 holding Diving Block) | P0 discard pile gains the Wound, hand unchanged, `woundsDrawn` +1, `gained a Wound instead of discarding`; Diving Block → `would gain …` and a pending Diving Block entry | chokepoint |
| T21 | escape | queue `[Primus cost entry, Mystique trait entry]`; and a `pendingEscapeProcedures` entry owed before them | first call opens the cost kind; after it resolves the next opens the trait kind; with the escape procedure owed, its step opens first | FIFO + rule order |
| T22 | escape | Mystique entry with no eligible seat; and `evaluateEndgame` non-null | no choice, queue drained, one line per seat; endgame → nothing opened, queue length 1 | |
| T23 | bot | `ai.seatChoice` pick for options `[hero cost 5, hero cost 3, Gain a Wound instead]` | index 1 | never the Wound option |
| T24 | Prompt | seat choice of kind `villain-effect-trait-discard` | heading `A Villain's effect — choose a Hero to discard` | |
| T25 | executor | T9's Juggernaut board (P0 and P2 hold matches; one match each carries `return-on-discard`), each on a fresh fixture, with `currentPlayer` `'2'`; `'1'`; undefined | per-seat discard lines and `pendingReturnOnDiscard` entries in seat order Player 2 then Player 0; Player 2 then Player 0 (P1 has no match); Player 0 then Player 2 | D-24780 turn order (the reaction queue is the outcome); sorted without a current player |
| T26 | escape | Frost Giant entry, wound supply 1: P0 and P2 hold no Ranged Hero, P1 holds `ranged-R`; each on a fresh fixture, opener with `currentPlayer` `'2'`; with `currentPlayer` undefined | `'2'`: P2 gains the last Wound and `woundsDrawn` +1, P0 logs `… the Wound supply is empty.`, P1 options `[ranged-R]`, choice seats `['1']`; undefined: P0 gains it, P2 logs the empty supply, `woundsDrawn` unchanged | pass 1 in turn order; pass 2 / seats ascending |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the four groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`); these Ambushes now punish, so those legs get harder. No committed `data/par` artifact references co2e, so nothing is re-pinned; a future PAR run picks up the behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- No new `G` key; the optional `traitFilter` exists only on entries a co2e Ambush creates. No randomness; turn-order seats (`seatsInTurnOrderFrom`, D-24780) for the Juggernaut discards and prepare pass 1, sorted seats for prepare pass 2 and the apply, hand order and HQ slot order; the bot pick is deterministic.
- `getLegalMoves` is untouched; the seat choice is answered by the existing generic branch.
- Narration goes to hash-excluded `G.messages` (D-24081). `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 14); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks, so pre-WP-837 matches replay identically; only a re-setup from config + seed sees the new markers. An in-flight queue entry without `traitFilter` routes as WP-817. Recorded in D-24770.

## Funding Surface Gate

§20 **N/A**: engine, card data and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T5 pass. The marker script runs `main()` on import, so its rejection side is checked by hand: put each T4 token for the new grammar into the marker map one at a time, run the script, observe a loud failure, revert. Record the observed failures in the EC-875 commit body.
2. **Types.** T1-T2 pass as runtime assertions.
3. **Trait discards.** T6-T8, T17-T23 and T26 pass.
4. **Juggernaut.** T9-T12 and T25 pass.
5. **The Leader.** T13 and T16 pass; the existing Endless Armies and core The Leader tests pass unchanged.
6. **Scorpion.** T14-T15 pass.
7. **Client.** T24 passes; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
8. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 6 new marker(s) this run` and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, only those five lines, each gaining its trailing marker(s).
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps; the last three need no regeneration.
10. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
11. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`, co2e Mystique (`discard-hero-each-player-by-trait`), Frost Giant Warrior (`discard-hero-or-wound-each-player-by-trait`) and Juggernaut (both new primitives) are `executable` with WP-837 / D-24770 provenance; Scorpion (`gain-wound`) and The Leader (`play-villain-deck-cards`) are `executable`; no other row changes except lines WP-835 / WP-836 marked, if they landed first.
12. **Revert proofs** (Verification 8) each fail at least one named T-case.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last three flags, STOP: Assumes 14 is false.
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time: make the `another-group-villain-in-city` arm return true (T14 fails); drop the gate check from `villainCardPlaysVillainDeckCards` (T13 / T16 fail); route a trait entry to `buildEscapeEffectCostDiscardChoice` (T17 fails); key card names by the full base id (T9 fails); refill each slot right after pushing it (T11 fails); offer the Wound option with an empty supply (T19 fails); iterate the Juggernaut seats with `.sort()` (T25 fails); walk prepare pass 1 with `.sort()` (T26 fails).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the eight revert proofs were observed.
- [ ] D-24770 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated (including the keyword-less Ambush overlay note from Out of Scope).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-875:` then `SPEC:`.
- [ ] 01.6 post-mortem written at `docs/ai/post-mortems/01.6-WP-837-co2e-each-player-discard-and-reveal-gated-ambushes.md` (in the `SPEC:` close).
- [ ] **Hash oracles:** `finalStateHash` / `PRE_WP080_HASH` unchanged (no fixture plays these groups).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live 2+-player co2e match **created after the deploy** (setup-built hooks live in the bgio `initialState`; an older match keeps the pre-WP-837 no-op hooks), with the deployed gitSha checked, staged through the operator setter pane or `/api/match/autoplay` setupData:
  - a Mystique reveal opens the discard prompt for each player holding an X-Men Hero (only those listed) and logs the others;
  - a Frost Giant Warrior reveal wounds a player with no Ranged Hero and offers the others their Ranged Heroes plus **Gain a Wound instead**; both answers resolve;
  - a Juggernaut reveal discards same-named hand cards and refills the HQ with new Heroes;
  - a Scorpion reveal wounds everyone with another Sinister Spider-Foes Villain in the City and logs the no-effect line without one;
  - a The Leader reveal plays the next card when the active player has no Strength Hero and logs the reveal when they have one.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24770 — co2e each-player discard and reveal-gated Ambushes.** It locks:
- the authorized contract changes: `rules/villainAbility.types.ts` primitives `discard-hero-each-player-by-trait`, `discard-hero-or-wound-each-player-by-trait`, `discard-hand-matching-hq-card-names-each-player`, `hq-heroes-to-hero-deck-bottom` and condition `another-group-villain-in-city`; `types.ts` `PendingEffectDiscardTraitFilter` and `PendingEscapeEffectDiscard.traitFilter?`;
- Ambush-timed every-player discards ride WP-817's owed-discard FIFO and opener (one queue, rule order kept; no rename, so in-flight entries route as before); this **extends D-24750 point 9** to Ambush effects that need a multi-seat choice: they resolve after the move;
- Frost Giant Warrior's choice per rules L3199-3201: a holder may take the Wound (offered only while the supply has one); a player with no matching Hero gains it when the choice opens; the bot-ally discards its cheapest Hero, autoplay / sim / PAR take index 0 (a discard). The open-time drain is excluded by construction: prepare wounds every non-holding seat first (pass 1, current player first then clockwise per D-24780, so a short supply's last Wound goes to the seat the rules reach first), then builds the holders' options (pass 2, ascending — a simultaneous prompt, D-24780 §6), so a holder is offered **Gain a Wound instead** only if a Wound is left after every forced Wound. **Accepted residual (RS-1):** the options are built while the supply has a Wound; if it runs out before a later seat's (ascending apply) **Gain a Wound instead** is applied, that seat gets neither a Wound nor a discard (logged `chose to gain a Wound, but the Wound supply is empty.`). Tabletop turn order would make that player discard; this simultaneous-choice edge needs a supply no larger than the seats choosing the Wound and is kept as drafted;
- **Juggernaut × an escape in the same reveal (RS-2):** under D-24656 point 4 the escape's steps 1-2 run after the move, so its HQ KO picks from the post-Juggernaut HQ and its Bystander discard sees post-purge hands, the reverse of rules L573-575; a consequence of the existing deviation, no code change;
- Juggernaut: a card name key is the card slug (third `/` segment; split = both faces, rules L2773-2778); every matching hand card is discarded through `discardFromHand`, seats in turn order from the current player (D-24780 forward rule: the discards fire reactions); the HQ is moved to the Hero Deck bottom in slot order 0 → last as a snapshot, then every empty slot refills (rules L749-753); haunters stay (rules L1539-1541);
- Scorpion: "Spider-Foes Villain" = a Villain of the triggering Villain's own group, found as the longest selected-group prefix of its id; no resolvable group fails closed;
- The Leader: `play-villain-deck-cards` takes an optional `:<kind>:<value>` reveal gate; the current player reveals automatically when able (D-24281); a gated read without a current player plays nothing;
- replay-compat: stored matches replay from bgio `initialState`, which holds the setup-time hooks, so pre-WP-837 matches replay and play identically (co2e Ambushes stay no-ops there); an in-flight `pendingEscapeEffectDiscards` entry without `traitFilter` routes as WP-817; live-verify on a match created after the deploy.

---

## Amendment 2026-10-27 (pre-execution)

WP-846 (#3046) shipped D-24780 after this packet was drafted: order-sensitive each-player loops start with the current player and go clockwise (rules v23 L2247), through `turn/seatOrder.logic.ts` `seatsInTurnOrderFrom`, and §13's forward rule binds new loops. Two of this packet's loops were locked to `Object.keys(G.playerZones).sort()` and change an outcome, so a literal execution would have reintroduced the bug WP-846 fixed on non-seat-0 turns. Changes (WP and EC-875 together):

- **Juggernaut's discard loop** (`villainEffectDiscardHandMatchingHqCardNamesEachPlayer`) walks `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`: its discards fire return-on-discard / teleport reactions in loop order (D-24780 §2b).
- **Prepare pass 1** (`prepareVillainEffectTraitDiscardChoice`, Frost Giant Warrior's open-time Wounds) walks the same order: who misses the last Wound, and the Flying Shield Block asking order (D-24780 §2a).
- **Unchanged, now with a stated reason:** prepare pass 2 and `applyVillainEffectTraitDiscard` stay ascending (simultaneous prompt builder and apply, D-24780 §6 / D-24501), each with a `// why:`.
- Dependencies gain WP-846 ✅; Assumes 15 names the import; §Context gains the seat-order bullet; the DECISIONS scan list gains D-24780; D-24770's Frost Giant and Juggernaut clauses name the order.
- **Tests:** T25 (Juggernaut line and `pendingReturnOnDiscard` order on seats 2 / 1 / none) and T26 (pass-1 last-Wound recipient and `woundsDrawn` on seat 2 / none). Two revert proofs (eight total). AC 3 / 4 cite them.

No new primitive, type, `G` field, marker, file or log string; the contract surface and file list are unchanged. With current player `'0'` or none (unit stubs), the rotation is the identity, so T9 / T17-T22 stand as written.

## Gate Record

- **01.4 pre-flight (independent):** READY TO EXECUTE after PS-1..3 + RS-1/2/4/5/8 applied (2026-10-25). PS-1: T6 now uses a split card whose team is on face a and adds a face-b Hero Class case (the `offPlayCardTraits` view). PS-2: WP-829 recorded as merged (`461ed924`) with its onMove / anchor shifts. PS-3: the WP-830 / 831 / 832 rebase rule added to the EC and §Context. RS-1 / RS-2 recorded in D-24770; RS-4 `refillHqSlot` rebind locked; RS-5 pin wording in the EC; RS-8 prose (65 names / three slug variants, Assumes 15, baseline `677c4109`, no auto-merge).
- **01.7 copilot (independent):** RISK → F-1 + F-2 applied (2026-10-25). F-1: `prepareVillainEffectTraitDiscardChoice` is two-pass (non-holders wounded first, then holders' options), with a T19 supply-1 case, the EC mirror and a D-24770 clause. F-2: the D-24026 live-verify needs a match created after the deploy, and the D-24770 replay-compat bullet is spelled out. The optional nits are applied too: §2 "six markers (five lines)", §3 Assumes names, §13 `workindex:*:check`, and the EC no-UX-freeze guardrail. Pre-flight READY stands.
- **00.3 lint (independent):** PASS (2026-10-25).
- **00.3 re-lint after Amendment 2026-10-27 (independent):** PASS with nits; nits applied (fresh-fixture wording and reaction-queue / `woundsDrawn` assertions in T25 / T26, WP-831 / 832 marked merged). D-24780 scope of all four loops confirmed against `main` `517077cb`.

## Lint Gate Self-Review (00.3)

Drafting self-check; the independent 00.3 run replaces this table.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 7 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — Assumes 1-16 cite rules lines, data rows, code anchors, imports and the baseline gate |
| §4 | PASS — 00.2 §1.4 / §5, ARCHITECTURE sections, rules Layer Boundary, DECISIONS scan list, memory |
| §5 | PASS — 27 files, each marked modified or regenerated; the count is justified |
| §6 | PASS — card / group slugs match `co2e.json`; kind, condition and primitive names are used identically in the WP, EC and session prompt |
| §7 | PASS — no new dependencies; hard dependency WP-817 is merged; soft orderings named |
| §8 | PASS — engine decides; the client renders a heading only; `G` stays JSON; no I/O or randomness |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, diff-scope step, 8 revert proofs |
| §14 | PASS — 12 binary criteria tied to T1-T26 |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes in DoD; D-24026 live-verify on `play.legendary-arena.com`, one check per card |
| §16 | PASS — 00.6 mandated; small named helpers; no premature abstraction (the shared `recordOwedTraitDiscard` serves exactly two handlers) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |
