# WP-821 — Arnim Zola: the Master Strike and the four Tactics (Game Engine)

**Status:** Draft 2026-10-22 — READY TO EXECUTE (EC-859; **D-24754** reserved (#2954); pre-flight READY, copilot CONFIRM, 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ the tactic provenance overlay and the regenerated effect index)
**Dependencies:** none open. Builds on WP-815 / D-24747 (Ultimate Abomination and the off-play printed-Attack read), WP-818 / D-24752 (the Fallen Idols multi-seat discard, the Zemo strike and tactic shapes), WP-817 / D-24750 (the cost-filtered discard pick), WP-694 / D-24511 (multi-seat tactic seat choices and the resolve-time chain), WP-692 / D-24509 (gain a Hero from the HQ for free), WP-684 / D-24501 + D-24648 (`parkSeatChoice`, the active-seat-only ride skip), WP-682 / D-24499 + D-24673 (`gainWoundWithOutcome`), WP-494 / D-24299 (the Victory-Pile villain-group prefix test), WP-497 / D-24300 (per-tactic resolvers keyed by ext_id).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It adds two optional fields to `SeatChoiceOption` in `types.ts`, four seat-choice kinds, a resolve-time chain and bot branches.
**Arc:** Cap 75th (ca75) completion arc, audit item 4 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `cc67442d`, plus the reserve commit #2954. Re-read line anchors and test totals at execution.

---

## Goal

As a player facing Arnim Zola, I want his Master Strike and his four Tactics to do what the cards print, so that Zola punishes and rewards Heroes with less than 2 printed Attack the way the tabletop game intends.

Today his Ultimate Abomination fight cost works (WP-815), but his Master Strike does nothing and his four Tactics are inert (`mastermindStrikeHandler` and `dispatchTacticOnFight` have no Zola branch). After this session:

| Card (`ca75/arnim-zola`) | Printed | Behavior |
|---|---|---|
| Arnim Zola (base) | "Master Strike: For each Hero in the HQ that has less than 2 printed [icon:attack], put that Hero on the bottom of the Hero Deck, and each player discards a card of that Hero's cost." | The HQ Heroes with printed Attack 0 or 1 (no Attack icon counts as 0) are found first. In HQ slot order, each goes to the bottom of the Hero Deck, its slot refills from the top, and every player discards a hand card of that Hero's cost if they have one. |
| Dominate the Weak | "Fight: The player of your choice gains a Hero from the HQ that has less than 2 printed [icon:attack]." | You pick one "Player N gains <Hero>" option from a seat-choice prompt. The Hero goes to that player's discard pile and its HQ slot refills. One possible option resolves at once. |
| Computer-Uploaded Genius | "Fight: Each other player reveals a [hc:tech] Hero or discards a card." | Each other player with a Tech Hero in hand reveals it. Every other player with cards in hand picks one to discard (a multi-seat seat choice, the Fallen Idols discard). |
| Pet Projects | "Fight: Each other player reveals a Zola's Creations Villain from their Victory Pile or gains a Wound." | Each other player with a Zola's Creations Villain in their Victory Pile reveals it; each other player gains a Wound. |
| Crush Pacifist Resistance | "Fight: KO up to two of your Heroes that have less than 2 printed [icon:attack]." | You get a prompt to KO one eligible Hero from your hand or the cards you played this turn, or KO nothing. After a KO, a second prompt offers one more. |

**Less than 2 printed Attack** follows rules v23 L2301-2311: "If you need to check a card for a value, and the card doesn't have that value, then it counts as 0." So a Hero with no Attack icon qualifies, as does a S.H.I.E.L.D. Agent. A Hero printed `2+` has printed Attack 2 and does not qualify.

## User-Visible Impact

- A Zola Master Strike reshapes the HQ: weak Heroes drop to the bottom of the Hero Deck and fresh Heroes refill their slots. Because his Ultimate Abomination cost reads the HQ at fight time (WP-815), the projected cost can rise. Each player loses a hand card of each removed Hero's cost if they hold one.
- Defeating each Tactic does what it prints, and the log says why when it does nothing.
- Dominate the Weak, Computer-Uploaded Genius and Crush Pacifist Resistance open the existing seat-choice prompt (`PendingSeatChoicePrompt.vue`). Every option label says what it does ("Player 1 gains <Hero>", "Discard <card>", "KO <card> from their hand", "KO nothing"), so the generic "Your choice" heading is enough and no client file changes.

---

## Assumes

1. **Card text** (verbatim, `data/cards/ca75.json`, mastermind `arnim-zola`; the table in §Goal). The base face is `vAttack: "6+"` with `[keyword:Ultimate Abomination]`; the four tactics are `vAttack: 6`, `tactic: true`. Tactic ext ids follow `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` (`mastermind/mastermind.setup.ts:253,279`): `ca75-mastermind-arnim-zola-dominate-the-weak`, `-computer-uploaded-genius`, `-pet-projects`, `-crush-pacifist-resistance`. The mastermind id is `ca75/arnim-zola` (`data/sweep-fixtures/mastermind-ids.full.json:17`). Other sets' Zolas (`shld-mastermind-hydra-high-council-arnim-zola`, `msp1-villain-hydra-arnim-zola`, `wtif-villain-rival-overlords-arnim-zola-hydra-scientist`) have different ids and are untouched.
2. **Rules text** (`docs/legendary-universal-rules-v23.md`): L2301-2311 (a missing printed value counts as 0, so no Attack icon is "less than 2"); L926-930 (a Divided card's off-play printed value adds both halves); L1170 ("Gain" means put it into your discard pile); L3439 ("your Heroes" = hand + the cards you played this turn; memory `reference_heroes_you_have_hand_plus_play`); L772-792 (Tactic Fight effects).
3. **Printed Attack read** (`economy/abomination.logic.ts`, WP-815): the private `printedHeroAttack(G, heroId)` (L46) returns `offPlayCardStats(G, heroId)?.attack ?? 0` (off-play, Divided halves summed, `+` dropped; a card with no stats entry reads 0). The S.H.I.E.L.D. cards do have entries (`setup/buildInitialGameState.ts:526-542`): Agent attack 0 / cost 0, Trooper attack 1 / cost 0, Officer cost 3, Sidekick cost 2, so all four read as less than 2 printed Attack. `offPlayCardStats` is `hero/splitCard.logic.ts:130`; its `cost` is face a's cost. The file imports only types, `hqSlotIndexUnderCitySpace` and `offPlayCardStats`, so exporting the function adds no cycle.
4. **Master Strike dispatch** (`rules/mastermindHandlers.ts`): `mastermindStrikeHandler` (L1237) is an if / else-if chain on `gameState.selection.mastermindId` (L1250-1284; the last branch is Zemo's, L1280). No `ca75/arnim-zola` branch exists. The handler has no `events`; its `strikeContext` is a `RevealContext` (`villainDeck/villainDeck.reveal.ts:94`: `random`, `ctx` only), so a strike can't park a multi-seat choice. Already imported: `pushLog`, `discardFromHand` (via `discardCardFromHand`, L634, the return-on-discard chokepoint), `formatCardRef`, `resolveCardName`, `offPlayCardTraits`.
5. **Put-bottom + refill idiom** (`moves/resolveOptionalPutBottomHQ.ts:141-148`): `G.heroDeck.push(cardId)` (the bottom is the array end; `heroDeck[0]` is the top), then `refillHqSlot(G.hq, index, G.heroDeck)` (`board/city.logic.ts:204`, pure; pops `heroDeck[0]`, leaves `null` when the deck is empty), rebinding `G.hq` / `G.heroDeck`.
6. **Cost-filtered pick** (`moves/villainDefeatRequirement.logic.ts`, WP-817): `listEligibleHandCardsByCost(state, playerId, costs)` (L177) and `selectDefaultCostDiscardCard(state, playerId, costs)` (L204), the lowest-cost eligible hand card, earliest in hand order on a tie. A card without a stats entry is never eligible. The file imports only types and `hero/` helpers.
7. **Tactic dispatch** (`rules/tacticHandlers.ts`): `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext, events?)` (L1458-1600) is an if-chain on the exact tactic ext id; the last branches are WP-818's (L1576-1600). Precedents in the file: `countVictoryPileGroupVillains(victory, groupPrefix)` (L487, private, anchored `${setAbbr}-villain-${group}-` prefix, D-24299); `resolveFallenIdols` (L1606, per-seat narration then `parkSeatChoice`); `dealFindingZemoWounds` (L1724, the three `gainWoundWithOutcome` outcome lines); `gainHqHeroFree(G, playerId, hqIndex)` (L947, private; vacates the slot, `refillHqSlot`, pushes to the recipient's discard, never spends Recruit; its only caller is `freeRecruitFromHqByFilter`, L1008). Already imported: `pushLog`, `formatCardRef`, `gainWoundWithOutcome`, `offPlayCardTraits`, `parkSeatChoice`, `buildFallenIdolsDiscardChoice`, `refillHqSlot`.
8. **Seat choice** (`types.ts`): `SeatChoiceOption` (L1338-1352) holds `label` plus the optional, consumer-added `cityIndex?` / `cardId?`, each "NOT projected to the client". `PendingSeatChoice.kind` is a plain `string` (L1394). The audience filter rebuilds each option as `{ label }` only (`ui/uiState.filter.ts:1353`), so new option fields never reach the client. `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (`moves/seatChoice.resolve.ts:260`): pass the active player when it is the only addressed seat, so no stage ride runs (D-24648, `buildSeatChoiceActivePlayersValue` L174). A parked choice blocks every other move (the block-all guard), so the HQ and hands can't change while it is open.
9. **Seat-choice dispatch and chain** (`moves/seatChoice.resolve.ts`): `resolveSeatChoice` (L328) applies by kind through `applySeatChoiceByKind` (L424) once every addressed seat has submitted. It captures Monarch's Decree's mode before the apply and chains `chainMonarchsDiscard` after `delete G.pendingSeatChoice` (L366-403, L536). `applySeatChoiceTimeoutDefault` (L571) applies by kind but never chains. `moves/seatChoiceTactics.ts`: `buildFallenIdolsDiscardChoice` (L367) / `applyFallenIdolsDiscard` (L409), "Discard <card>" labels; `buildMonarchsDiscardChoice` (L185) uses bare card names (not the same shape). Imports: `discardFromHand`, `moveCardFromZone`, `koCard`, `pushLog`, `resolveCardName`. `log/logDisplay.ts` exports `describeKoSourceZone(zone)` (L208).
10. **Bot** (`simulation/ai.seatChoice.ts`): `choosePlayingSeatChoiceOption` → `chooseByKind` (L94); `null` falls back to `clampDefault` (L352, the choice's `defaultOptionIndex`). The least-valuable-card branch (L116-123) lists `MONARCHS_DISCARD_KIND`, `ESCAPE_BYSTANDER_DISCARD_KIND`, `ESCAPE_EFFECT_COST_DISCARD_KIND`, `FALLEN_IDOLS_DISCARD_KIND`. `indexOfLeastValuableCard` (L288) returns a Wound first, else the lowest `G.cardStats[cardId]?.cost ?? 0`, skipping options with no `cardId`. Autoplay, the sim and PAR take `defaultOptionIndex`.
11. **"Your Heroes" for a KO** (`villain/villainEffects.execute.ts:4236`, `buildKoEligibleTargets`): hand + inPlay (D-24687), never the discard pile, Wounds excluded, deduped per `(zone, cardId)` because S.H.I.E.L.D. starter ids repeat (`starting-shield-agent`). `moves/koHeroChoice.resolve.ts:110-131` KOs by `moveCardFromZone(zone, [], cardId)`, `G.ko = koCard(G.ko, cardId)` and logs the source zone through `describeKoSourceZone` (D-24693).
12. **Zola's Creations ids.** Villain copies are `${setAbbr}-villain-${groupSlug}-${cardSlug}-NN` (`setup/buildCardDisplayData.ts:516`); the ca75 group slug is `zolas-creations` (Captain Zolandia, Doughboy, Man-Fish, Primus), so the prefix is `ca75-villain-zolas-creations-`.
13. **Feeds.** The four tactics are `status: "unmarked"` in `data/metadata/effect-implementation-index.json` (~L4297-4339), generated by `scripts/build-effect-implementation-index.mjs` with the `scripts/coverage/tactic-provenance.json` overlay (WP-818 rows, ~L107-130, are the format). A provenance row flips a tactic to `executable` with no generator change. No hero / villain ledger covers mastermind strikes, and no `[effect:]` marker is added.
14. **No hashed fixture plays Zola.** `arnim-zola` appears in `packages/**` / `apps/**` only in `packages/registry/src/gauntletLoadouts.generated.ts` (L253-262), `setup/buildCardAbomination.test.ts` and the untracked dashboard copy of the effect index; no `data/par` artifact names him. The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- The 2026-10-19 ca75 audit found every Zola line inert except the fight cost WP-815 later shipped (auto-memory `project_cap75_completion_arc`; side-session note `ca75-audit-2026-10-19.md`, outside the repo: background only, not required reading). The note's guess that Pet Projects is "close to `gain-wound-unless-victory-villain-group`" holds only for the predicate: that villain primitive wounds **each** player lacking **another** group villain and is fired by data markers. Pet Projects hits **each other** player, any one Zola's Creations Villain suffices, and tactics are id-keyed (D-24300), so it is a tactic resolver that reuses `countVictoryPileGroupVillains`.
- **Why the strike's discard is auto-picked.** A Master Strike has no `events` (Assumes 4), so it can't park a multi-seat choice inline. Interactive would mean an owed queue drained after the move, which is the WP-817 Primus deviation from rules timing (D-24750). Every candidate card shares the removed Hero's cost, so the pick only chooses among equal-cost cards. The engine discards the earliest such card in hand order, the same card WP-817's seat-choice default picks. It does this inline at the strike, which matches rules timing. This is recorded in D-24754. Equal cost doesn't make the pick meaningless (two cost-3 cards can differ in value), and the Magneto strike shows a current-player-parks / others-auto split is possible (D-24284). It is not used here because one strike can owe up to five discards per player, so the current player would face up to five sequential parked picks while every other player is auto-picked anyway. An interactive upgrade through the WP-817 owed queue is Out of Scope.
- **Why "for each Hero" is a snapshot.** The Heroes are identified when the strike resolves; a Hero that refills a vacated slot is not re-checked, even if it is weak. Iterating the live HQ would let a refill chain through the Hero Deck. With an empty Hero Deck the put-bottom + refill returns the same Hero to its slot (the `resolveOptionalPutBottomHQ` behavior); the discard still happens.
- **Why Dominate the Weak is one combined prompt.** "The player of your choice gains a Hero" is two choices. One active-seat seat choice whose options pair a recipient with a Hero ("Player 1 gains <Hero>") resolves both through the existing generic prompt, with no client change and at most 5 × 5 options. The recipient rides on a new optional `SeatChoiceOption.recipientSeat` (the consumer-added field pattern of `cityIndex` / `cardId`). Options list you first, then the other seats ascending, and within a seat the eligible Heroes by descending cost (ties: HQ slot order). That makes `defaultOptionIndex: 0` = "you gain the highest-cost eligible Hero", the D-24343 Paibok auto-gain rule, for the bot, the sim and a timeout. "Gain" reaches a Haunted Hero (only the free-recruit path skips one, D-24587).
- **Why Crush Pacifist Resistance is a two-step chain.** "Up to two" is optional (0, 1 or 2), and the Heroes come from two zones, so the pick needs a zone per option (a new optional `SeatChoiceOption.sourceZone`, because starter ids repeat across zones) and a decline. A seat choice records one option, so the first pick (kind `crush-pacifist-resistance-ko`) chains a second (kind `crush-pacifist-resistance-last-ko`) from `resolveSeatChoice` after a KO, exactly where Monarch's Decree chains its discard (D-24511). Each step offers "KO nothing" as its last option and its `defaultOptionIndex`, so a timeout or the sim KOs nothing (the safe "up to" floor). The timeout path never chains, as for Random Acts (D-24501). The playing-seat bot KOs a 0-cost Hero (a S.H.I.E.L.D. starter: deck thinning) when one is offered, else declines.
- **Why Computer-Uploaded Genius reuses the Fallen Idols discard.** It is the same "each other player picks any hand card to discard" choice with "Discard <card>" labels and a different log suffix. With it, that builder / applier body has a second consumer (Monarch's discard is the third copy of the loop), so this packet extracts the shared body as `buildHandDiscardChoice` / `applyHandDiscard`. Fallen Idols' two exported functions delegate, unchanged; their WP-818 tests are the oracle. Tech is read from the hand only, `heroClass` or `heroClass2` (D-24523), because during your turn another player's Heroes are in their hand (the Crushing Shockwave / Prisoners of War hand-reveal precedent). A free reveal always beats a discard (D-24312), so a player with a Tech Hero is never asked.
- **Why `gainHqHeroFree` moves.** Dominate the Weak's apply runs in `seatChoiceTactics.ts`, which `tacticHandlers.ts` imports, so it can't import back. The body moves verbatim to `seatChoiceTactics.ts` as the exported `gainHqHeroToDiscard`. `freeRecruitFromHqByFilter` imports it (Dark Technology / Bitter Captor byte-identical; their tests are the oracle), and Dominate the Weak uses it. The inline copy in `giveHqHeroChoice.resolve.ts` is left as is (Out of Scope).
- **Shared predicates.** A new `mastermind/arnimZola.logic.ts` holds the Zola id, the threshold and the three eligibility reads: weak HQ slots, the off-play read and the Crush targets. The strike (`rules/`), the tactics (`rules/`), the builders and the chain (`moves/`) then share one predicate. It imports only `printedHeroAttack` (exported from `abomination.logic.ts`, no body change) and `WOUND_EXT_ID`, so `seatChoiceTactics.ts` can import it without a cycle. Hand cards read off-play (Assumes 3); an inPlay card reads `G.cardStats[cardId]?.attack ?? 0`, the face being played (rules v23 L926).
- **Intended follow-on effects.** The strike and Dominate the Weak change the HQ, so Zola's Ultimate Abomination cost moves with them (WP-815 reads it at fight time). Dominate the Weak's refill can empty the Hero Deck, which latches the final turn (D-24159) or a Hero-Deck scheme loss (D-24319) at the end-of-move check (`game.ts` ~L855-862), exactly as Bitter Captor can today. The strike pushes before it pops, so it never changes the Hero Deck's length and can't trigger either. Each Wound Pet Projects deals goes through the Diving Block chokepoint. Neither is suppressed.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.3 Mastermind Shape (`slug`, `tactic`, `vAttack`), §5 Ability Text Markup Language (`[icon:attack]`, `[hc:tech]`).
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (zones hold `CardExtId` only), Section 3 Persistence Boundaries (`G` runtime-only), §The Move Validation Contract (moves never throw).
- `docs/ai/DECISIONS.md`: scan D-24299, D-24300, D-24312, D-24343, D-24499, D-24501, D-24509, D-24511, D-24523, D-24587, D-24648, D-24673, D-24687, D-24693, D-24747, D-24750, D-24752, D-24372 before coding.
- User memory: `reference_interactive_choice_active_player_only` (non-active seats choose only through `pendingSeatChoice`), `reference_heroes_you_have_hand_plus_play`, `reference_engine_tests_never_typechecked`, `reference_bot_legalmoves_moveguard_divergence`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24754) before coding. One WP per session.

**Packet-specific:**
- **One predicate.** Every "less than 2 printed Attack" read goes through `mastermind/arnimZola.logic.ts`; the off-play read is `printedHeroAttack`. No second copy.
- **Id-keyed dispatch.** The strike is a new `else if` in `mastermindStrikeHandler`; each tactic is a new `if` at the end of `dispatchTacticOnFight` on the exact ext id. Other masterminds and tactics behave byte-identically.
- **Self-narrate** every outcome through `pushLog` (hash-excluded `G.messages`, D-24081), including every no-op, with the exact strings in Locked Values. Exemption: defensive returns that the block-all guard makes unreachable are silent: a missing player zone, an option missing its payload field (`cardId` / `recipientSeat` / `sourceZone`), and a stale option whose card left its HQ slot or zone. Every other no-op logs its locked line.
- **Sorted seats.** Every per-player loop iterates `Object.keys(G.playerZones).sort()`.
- **Refactors are behavior-identical.** `gainHqHeroFree` → `gainHqHeroToDiscard` and the Fallen Idols delegation change no output; the existing Dark Technology, Bitter Captor and Fallen Idols tests pass unchanged.

## Locked Values

**Shared reads (`mastermind/arnimZola.logic.ts`, NEW):**
- `export const ARNIM_ZOLA_MASTERMIND_ID = 'ca75/arnim-zola';` `export const ZOLA_PRINTED_ATTACK_LIMIT = 2;`
- `export function hasLessThanTwoPrintedAttack(G, cardId): boolean` = `printedHeroAttack(G, cardId) < ZOLA_PRINTED_ATTACK_LIMIT` (off play).
- `export function listZolaWeakHqSlots(G): number[]` — ascending HQ slot indices whose occupant is non-null and `hasLessThanTwoPrintedAttack`. `G.hq` missing → `[]`.
- `export interface ZolaKoTarget { zone: 'hand' | 'inPlay'; cardId: CardExtId }` (a `// why:` says it mirrors `KoHeroTarget`, `villain/villainEffects.execute.ts:89`, without importing that large module into the pure `seatChoiceTactics` chain); `export function listCrushEligibleTargets(G, playerId): ZolaKoTarget[]` — zones missing → `[]`; the hand (in order) then inPlay (in order); skip `WOUND_EXT_ID`; dedupe per `(zone, cardId)` keeping the first; a hand card qualifies on `hasLessThanTwoPrintedAttack`, an inPlay card on `(G.cardStats[cardId]?.attack ?? 0) < ZOLA_PRINTED_ATTACK_LIMIT`.
- `economy/abomination.logic.ts`: `printedHeroAttack` gains `export`; nothing else changes.

**Master Strike (`rules/mastermindHandlers.ts`):**
- New branch `else if (mastermindId === ARNIM_ZOLA_MASTERMIND_ID) { resolveArnimZolaStrike(gameState); }` after Zemo's.
- `resolveArnimZolaStrike(gameState)`: `weakSlots = listZolaWeakHqSlots(gameState)` (snapshot).
  - empty → `` `[Arnim Zola Master Strike] No Hero in the HQ has less than 2 printed Attack — no effect.` ``; return.
  - per slot in order: `heroId = gameState.hq[slot]`; `cost = offPlayCardStats(gameState, heroId)?.cost ?? 0`; `gameState.heroDeck.push(heroId)`; `refillHqSlot` + rebind; `` `[Arnim Zola Master Strike] ${formatCardRef(gameState.cardDisplayData, heroId)} has less than 2 printed Attack and went to the bottom of the Hero Deck.` ``; then `discardCardOfCostForEachPlayer(gameState, cost)`.
- `discardCardOfCostForEachPlayer(gameState, cost)` (its own JSDoc'd function): per sorted player, `cardId = selectDefaultCostDiscardCard(gameState, playerId, [cost])`; `null` → `` `[Arnim Zola Master Strike] Player ${playerId} has no card that costs ${cost} to discard.` ``; else `discardCardFromHand(gameState, playerId, cardId)` and `` `[Arnim Zola Master Strike] Player ${playerId} discarded ${resolveCardName(gameState.cardDisplayData, cardId)} (cost ${cost}).` `` (default outcome, the Zemo / Loki line style).

**Tactics (`rules/tacticHandlers.ts`):**
- Constants: `ZOLA_DOMINATE_THE_WEAK_TACTIC_ID = 'ca75-mastermind-arnim-zola-dominate-the-weak'`, `ZOLA_COMPUTER_UPLOADED_GENIUS_TACTIC_ID = 'ca75-mastermind-arnim-zola-computer-uploaded-genius'`, `ZOLA_PET_PROJECTS_TACTIC_ID = 'ca75-mastermind-arnim-zola-pet-projects'`, `ZOLA_CRUSH_PACIFIST_RESISTANCE_TACTIC_ID = 'ca75-mastermind-arnim-zola-crush-pacifist-resistance'`; `const HERO_CLASS_TECH = 'tech';`; `const ZOLAS_CREATIONS_VILLAIN_PREFIX = 'ca75-villain-zolas-creations-';`.
- Four new `if` branches at the end of `dispatchTacticOnFight`: `resolveDominateTheWeak(G, events, currentPlayer)`, `resolveComputerUploadedGenius(G, events, currentPlayer)`, `resolvePetProjects(G, currentPlayer)`, `resolveCrushPacifistResistance(G, events, currentPlayer)`.
- `gainHqHeroFree` is deleted; `freeRecruitFromHqByFilter` calls the imported `gainHqHeroToDiscard` with the same arguments. The `refillHqSlot` import (used only by `gainHqHeroFree`) is removed.
- **Import changes** (none of these is imported today): `tacticHandlers.ts` adds `gainHqHeroToDiscard`, `buildComputerUploadedGeniusDiscardChoice`, `buildDominateTheWeakChoice`, `gainDominateTheWeakHero`, `buildCrushPacifistResistanceChoice`, `CRUSH_PACIFIST_RESISTANCE_KO_KIND` (from `seatChoiceTactics.ts`) and `listZolaWeakHqSlots`. `mastermindHandlers.ts` adds `offPlayCardStats` (beside `offPlayCardTraits`), `refillHqSlot`, `selectDefaultCostDiscardCard`, `ARNIM_ZOLA_MASTERMIND_ID` and `listZolaWeakHqSlots`. `seatChoiceTactics.ts` adds the `CardExtId` type, `refillHqSlot`, `offPlayCardStats`, `describeKoSourceZone` and `listCrushEligibleTargets`. `seatChoice.resolve.ts` adds the four kinds, the three appliers, `didCrushChooseKo` and `buildCrushPacifistResistanceChoice`. `ai.seatChoice.ts` adds the Genius and Crush kinds.
- **Dominate the Weak**: `slots = listZolaWeakHqSlots(G)`; empty → `` `Fight effect: no Hero in the HQ has less than 2 printed Attack, so no one gains a Hero (Dominate the Weak).` `` `'blocked'`; else `choice = buildDominateTheWeakChoice(G, currentPlayer, slots)`; exactly one option → read `onlyOption = choice.seatPrompts[currentPlayer]!.options[0]!`; when `onlyOption.cardId` and `onlyOption.recipientSeat` are both defined (always, by construction) call `gainDominateTheWeakHero(G, onlyOption.cardId, onlyOption.recipientSeat)` (forced; no park; no non-null assertion or `as` cast on those two fields — the engine builds with `exactOptionalPropertyTypes`); else `parkSeatChoice(G, events, choice, currentPlayer)` and `` `Fight effect: Player ${currentPlayer} chooses a player to gain a Hero with less than 2 printed Attack from the HQ (Dominate the Weak).` `` `'neutral'`.
- **Computer-Uploaded Genius**: `otherSeats` = sorted seats ≠ current; none → `` `Fight effect: there is no other player to reveal a Tech Hero or discard a card (Computer-Uploaded Genius).` `` `'neutral'`; return. Per other seat (missing zones skipped):
  - first hand card whose `offPlayCardTraits(G, id)` has `heroClass` or `heroClass2` `=== HERO_CLASS_TECH` → `` `Fight effect: Player ${seat} revealed ${formatCardRef(G.cardDisplayData, id)} — no discard (Computer-Uploaded Genius).` `` `'neutral'`;
  - else empty hand → `` `Fight effect: Player ${seat} has no card to discard (Computer-Uploaded Genius).` `` `'neutral'`;
  - else the seat joins `discardSeats`.
  - `choice = buildComputerUploadedGeniusDiscardChoice(G, discardSeats)`; `undefined` → `` `Fight effect: no other player must discard a card (Computer-Uploaded Genius).` `` `'neutral'`; else `parkSeatChoice(G, events, choice)` and `` `Fight effect: each other player without a Tech Hero must discard a card (Computer-Uploaded Genius).` `` `'neutral'`.
- **Pet Projects**: no other seat → `` `Fight effect: there is no other player to reveal a Zola's Creations Villain or gain a Wound (Pet Projects).` `` `'neutral'`. Per sorted other seat (missing zones skipped): `countVictoryPileGroupVillains(zones.victory, ZOLAS_CREATIONS_VILLAIN_PREFIX) > 0` → `` `Fight effect: Player ${seat} revealed a Zola's Creations Villain from their Victory Pile — no Wound (Pet Projects).` `` `'neutral'`; else `gainWoundWithOutcome(G, seat)`: `'gained'` → `` `Fight effect: Player ${seat} gained a Wound (Pet Projects).` `` `'applied'`; `'diving-block-pending'` → `` `Fight effect: Player ${seat} would gain a Wound — Diving Block can prevent it (Pet Projects).` `` `'neutral'`; `'no-wound'` → `` `Fight effect: Player ${seat} gained no Wound — the Wound supply is empty (Pet Projects).` `` `'blocked'`.
- **Crush Pacifist Resistance**: `choice = buildCrushPacifistResistanceChoice(G, currentPlayer, CRUSH_PACIFIST_RESISTANCE_KO_KIND)`; `undefined` → `` `Fight effect: Player ${currentPlayer} has no Hero with less than 2 printed Attack to KO (Crush Pacifist Resistance).` `` `'blocked'`; else `parkSeatChoice(G, events, choice, currentPlayer)` and `` `Fight effect: Player ${currentPlayer} may KO up to two Heroes with less than 2 printed Attack (Crush Pacifist Resistance).` `` `'neutral'`.

**Seat choice (`types.ts`, `moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts`):**
- `SeatChoiceOption` gains `recipientSeat?: string` and `sourceZone?: 'hand' | 'inPlay'`, each with a `// why:` naming its kind and "NOT projected to the client".
- Kinds: `export const COMPUTER_UPLOADED_GENIUS_DISCARD_KIND = 'computer-uploaded-genius-discard';` `DOMINATE_THE_WEAK_GAIN_KIND = 'dominate-the-weak-gain';` `CRUSH_PACIFIST_RESISTANCE_KO_KIND = 'crush-pacifist-resistance-ko';` `CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND = 'crush-pacifist-resistance-last-ko';`
- `buildHandDiscardChoice(G, seats, kind)` / `applyHandDiscard(G, choice, sourceName)` (private) hold `buildFallenIdolsDiscardChoice` / `applyFallenIdolsDiscard`'s current bodies, with `kind` and `(${sourceName})` substituted. `buildFallenIdolsDiscardChoice(G, seats)` = `buildHandDiscardChoice(G, seats, FALLEN_IDOLS_DISCARD_KIND)`; `applyFallenIdolsDiscard(G, choice)` = `applyHandDiscard(G, choice, 'Fallen Idols')`; the Genius pair delegates the same way with `'Computer-Uploaded Genius'`. The apply line is `` `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (${sourceName}).` `` `'applied'`.
- `export function gainHqHeroToDiscard(G, playerId, hqIndex): CardExtId | null` — `gainHqHeroFree`'s body and comments verbatim.
- `export function buildDominateTheWeakChoice(G, currentPlayer, slots): PendingSeatChoice` — recipients `[currentPlayer, ...other seats ascending]`; per recipient, the slots' Heroes by descending `offPlayCardStats(G, id)?.cost ?? 0`, ties ascending slot; option `` { label: `Player ${seat} gains ${resolveCardName(G.cardDisplayData, heroId)}`, cardId: heroId, recipientSeat: seat } ``; `addressedSeats: [currentPlayer]`, `submissions: {}`, `defaultOptionIndex: 0`.
- `export function gainDominateTheWeakHero(G, heroId, recipientSeat): void` — `hqIndex = G.hq.indexOf(heroId)`; `-1` → silent return (the block-all guard froze the HQ); `gainHqHeroToDiscard(G, recipientSeat, hqIndex)`; non-null → `` `Player ${recipientSeat} gained ${resolveCardName(G.cardDisplayData, heroId)} from the HQ (Dominate the Weak).` `` `'applied'`.
- `export function applyDominateTheWeakGain(G, choice): void` — the addressed seat's submitted option; missing `cardId` / `recipientSeat` → return; else `gainDominateTheWeakHero`.
- `export function buildCrushPacifistResistanceChoice(G, seat, kind): PendingSeatChoice | undefined` — `targets = listCrushEligibleTargets(G, seat)`; none → `undefined`; options per target `` { label: `KO ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(zone)}`, cardId, sourceZone: zone } ``, then `{ label: 'KO nothing' }`; `addressedSeats: [seat]`, `submissions: {}`, `defaultOptionIndex` = the "KO nothing" index.
- `export function didCrushChooseKo(choice): boolean` — the addressed seat's submitted option has a `cardId`.
- `export function applyCrushPacifistResistanceKo(G, choice): void` — the addressed seat's option; no `cardId` → `` `Player ${seat} chose not to KO a Hero (Crush Pacifist Resistance).` `` `'neutral'`; `cardId` set but `sourceZone` absent, or the seat's zones missing → silent return; else `moveCardFromZone(zones[sourceZone], [], cardId)` (the dynamic zone read follows `moves/koHeroChoice.resolve.ts:111`, cited in a `// why:`); not found → return; write the zone back, `G.ko = koCard(G.ko, cardId)`, `` `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(sourceZone)} (Crush Pacifist Resistance).` `` `'applied'`.
- `applySeatChoiceByKind`: Genius → `applyComputerUploadedGeniusDiscard`; Dominate → `applyDominateTheWeakGain`; both Crush kinds → `applyCrushPacifistResistanceKo`.
- `resolveSeatChoice`: before the apply, when `appliedKind === CRUSH_PACIFIST_RESISTANCE_KO_KIND`, capture `crushActiveSeat = choice.addressedSeats[0]` and `crushChoseKo = didCrushChooseKo(choice)`. After `delete G.pendingSeatChoice`, if both hold, `chainCrushPacifistResistanceLastKo(G, crushActiveSeat, events)`.
- `chainCrushPacifistResistanceLastKo(G, activeSeat, events)`: `choice = buildCrushPacifistResistanceChoice(G, activeSeat, CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND)`; `undefined` → `` `Fight effect: Player ${activeSeat} has no other Hero with less than 2 printed Attack to KO (Crush Pacifist Resistance).` `` `'neutral'`; else `parkSeatChoice(G, events, choice, activeSeat)` and `` `Fight effect: Player ${activeSeat} may KO one more Hero with less than 2 printed Attack (Crush Pacifist Resistance).` `` `'neutral'`.

**Function size (00.6, pre-named splits):** `resolveComputerUploadedGenius` moves its per-seat reveal / empty-hand narration into `collectGeniusDiscardSeats(G, otherSeats): string[]` (JSDoc'd); `listCrushEligibleTargets` scans each zone through `appendZoneKoTargets(G, zone, cardIds, targets)`; the Crush capture-before-apply in `resolveSeatChoice` is two `const`s beside the Monarch's capture, and everything after `delete G.pendingSeatChoice` lives in `chainCrushPacifistResistanceLastKo`.

**Bot (`simulation/ai.seatChoice.ts`):** the least-valuable branch also matches `COMPUTER_UPLOADED_GENIUS_DISCARD_KIND`. Both Crush kinds → `indexOfZeroCostKoOption(G, options)` (new, JSDoc'd): the first option with a `cardId` whose `G.cardStats[cardId]?.cost ?? 0` is `0`, else `options.length - 1` ("KO nothing"). Dominate → no branch (`defaultOptionIndex` 0).

**Provenance (`scripts/coverage/tactic-provenance.json`):** four rows, `status: "executable"`, handler `packages/game-engine/src/rules/tacticHandlers.ts#resolve<Name>`, `wp: "WP-821"`, `decision: "D-24754"`.

---

## Scope (In)

- **A)** `mastermind/arnimZola.logic.ts` + test (NEW); `economy/abomination.logic.ts` (`export` only).
- **B)** `rules/mastermindHandlers.ts` + test: the Master Strike.
- **C)** `rules/tacticHandlers.ts` + test: the four resolvers and their dispatch branches; `gainHqHeroFree` replaced by the import.
- **D)** `types.ts`: the two optional `SeatChoiceOption` fields.
- **E)** `moves/seatChoiceTactics.ts` + test, `moves/seatChoice.resolve.ts` + test: the four kinds, builders, appliers, the shared discard body, `gainHqHeroToDiscard`, the Crush chain.
- **F)** `simulation/ai.seatChoice.ts` + test: the Genius and Crush branches.
- **G)** `tactic-provenance.json` and the regenerated `effect-implementation-index.json`.

## Out of Scope

- **An interactive pick for the strike's discard** (the WP-817 owed queue; Context). Revisit if playtest asks.
- **Ultimate Abomination** — shipped (WP-815).
- **"Always Leads: Zola's Creations"** — setup composition, unchanged.
- **The inline gain copy in `moves/giveHqHeroChoice.resolve.ts`** (Paibok) and Monarch's bare-name discard builder. Not touched; consolidating them is a separate hygiene change.
- **Haunted-Hero cleanup** on a gained or bottomed Hero beyond what `gainHqHeroFree` / `resolveOptionalPutBottomHQ` already do.
- **Client changes.** The generic seat-choice prompt renders every new kind.
- **`data/metadata/mastermind-pattern-assignments.json`** (`strike-discard`, read only by the registry viewer).
- **Other sets' Arnim Zola cards** (shld, msp1, wtif) and the other ca75 items (hero fidelity batch, schemes).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `mastermind/arnimZola.logic.ts`, `mastermind/arnimZola.logic.test.ts` — **new**
- `economy/abomination.logic.ts` — modified (`export` keyword only)
- `types.ts` — modified (two optional `SeatChoiceOption` fields)
- `rules/mastermindHandlers.ts`, `rules/mastermindHandlers.test.ts` — modified
- `rules/tacticHandlers.ts`, `rules/tacticHandlers.test.ts` — modified
- `moves/seatChoiceTactics.ts`, `moves/seatChoiceTactics.test.ts` — modified
- `moves/seatChoice.resolve.ts`, `moves/seatChoice.resolve.test.ts` — modified
- `simulation/ai.seatChoice.ts`, `simulation/ai.seatChoice.test.ts` — modified

**Scripts and data**
- `scripts/coverage/tactic-provenance.json` — modified
- `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/DECISIONS.md` (D-24754), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 14 engine files (2 new, 6 tests) plus 2 data files. It is above the ~8 guideline because one Mastermind spans the strike, the tactic dispatcher, three seat-choice shapes and the bot. Splitting would ship a Mastermind that is half-faithful in the same match.

## Contract

- The Locked Values above: the `arnimZola.logic.ts` exports, the strike and four tactic resolvers with their exact strings, the four seat-choice kinds with their builders and appliers, `gainHqHeroToDiscard`, `didCrushChooseKo`, the two `SeatChoiceOption` fields, the bot branches.
- `SeatChoiceOption`'s new fields are optional and never projected (Assumes 8). No `G` field, UIState field or `.types.ts` / `.validate.ts` / `.gating.ts` file changes.

## Test Contract

Minimal `G` fixtures in each file's existing style, `messages: []` so `pushLog` records. Hero fixtures set `G.cardStats[id] = { attack, cost, … }` in the file's style; "weak" = attack 0 or 1. S.H.I.E.L.D. starter fixtures seed the real setup stats (Agent attack 0 / cost 0, Trooper attack 1 / cost 0; Assumes 3). Zola strike fixtures set `selection.mastermindId: 'ca75/arnim-zola'`. Tactic cases call `dispatchTacticOnFight` with the real tactic ext id, `{ currentPlayer: '0' }` and `makeMockCtx()`. Labels compare against `resolveCardName(G.cardDisplayData, id)`. Each file groups its cases under one `describe('WP-821 …')`.

| # | File | Input | Expected | Invariant / must NOT |
|---|---|---|---|---|
| Z1 | arnimZola.logic | `hasLessThanTwoPrintedAttack` on cards with attack 0, 1, 2, 3 and one with no stats entry | true, true, false, false, true | missing = 0 |
| Z2 | arnimZola.logic | `listZolaWeakHqSlots` with HQ `[atk2, atk1, null, atk0, atk3]` | `[1, 3]` | null slots skipped |
| Z3 | arnimZola.logic | `listCrushEligibleTargets` with hand `['pile-wound', 'starting-shield-agent', 'starting-shield-agent', atk2, atk1]`, inPlay `['starting-shield-trooper', atk3]`; then an unknown player | `[{hand, starting-shield-agent}, {hand, atk1}, {inPlay, starting-shield-trooper}]`; `[]` | Wounds excluded; per-zone dedupe |
| S1 | mastermindHandlers | Zola; HQ `[h3a (cost 3, atk 1), h4 (cost 4, atk 2), h5 (cost 5, atk 0), h6 (cost 6, atk 3), h3b (cost 3, atk 0)]`; heroDeck `[d1 (atk 0), d2, d3, d4]`; player `0` hand `[x (cost 3), y (cost 5), z (cost 3)]`, player `1` hand `[q (cost 4)]` | HQ `[d1, h4, d2, h6, d3]`; heroDeck `[d4, h3a, h5, h3b]`; `0` discards `x`, `y`, `z` in that order; `1` discards nothing; lines in order: h3a moved, `0` discarded x, `1` no cost-3 card; h5 moved, `0` y, `1` no cost-5; h3b moved, `0` z, `1` no cost-3 | snapshot: refilled `d1` (weak) is never moved; heroDeck length 4 before and after |
| S2 | mastermindHandlers | Zola; no weak HQ Hero | the single no-effect line; HQ, heroDeck and hands unchanged | |
| S3 | mastermindHandlers | Zola; HQ slot 0 weak cost 4, the rest strong; heroDeck `[]`; player `0` hand `[c4]` | slot 0 holds the same Hero again; heroDeck `[]`; `0` discards `c4` | empty-deck edge never throws |
| S4 | mastermindHandlers | strike with `selection.mastermindId: 'core/loki'` and S1's board | HQ and heroDeck unchanged; no `[Arnim Zola Master Strike]` line | dispatch isolation |
| S5 | mastermindHandlers | Zola; heroDeck `[d1]`; a weak Hero in HQ slot 2 with `G.hqHaunters = [null, null, { kind: 'villain', cardId: 'villain-ghost#0' }, null, null]` | the Hero is bottomed and the slot refilled; `hqHaunters[2]` unchanged | haunters stay on the slot |
| S6 | mastermindHandlers | Zola; HQ slot 0 weak cost 3; player `0` holds a cost-3 card `x` with `heroAbilityHooks` seeded `[{ cardId: x, timing, keywords: ['return-on-discard'] }]` in the `mastermindHandlers.test.ts` ~L1211 style (`checkReturnOnDiscard` keys on the keyword, `moves/discardFromHand.ts` ~L98-112) | `x` discarded and `G.pendingReturnOnDiscard` = `[{ playerID: '0', cardId: x }]` | through `discardCardFromHand` |
| T1 | tacticHandlers | Dominate with `{ currentPlayer: '1' }`; HQ `[hA (atk 1, cost 3), hB (atk 0, cost 5), hC (atk 2), null, hD (atk 3)]`; seats 0-2 | `pendingSeatChoice` = `{ kind: 'dominate-the-weak-gain', addressedSeats: ['1'], seatPrompts: { '1': { options: [P1 gains hB, P1 gains hA, P0 gains hB, P0 gains hA, P2 gains hB, P2 gains hA] } }, submissions: {}, defaultOptionIndex: 0 }`, each option with `cardId` + `recipientSeat`; the park line | current seat first; cost-desc |
| T2 | tacticHandlers | Dominate solo with one weak Hero `hA` in slot 0; heroDeck `[d1]` | no `pendingSeatChoice`; `hA` in `0`'s discard; slot 0 = `d1`; the gain line | forced pick auto-resolves |
| T3 | tacticHandlers | Dominate with no weak HQ Hero; and solo with two weak Heroes | the `blocked` line, nothing parked; a 2-option park (both `Player 0 gains …`) | |
| T3b | tacticHandlers | T1's board plus heroDeck `[d1]` and `G.hqHaunters = [{ kind: 'villain', cardId: 'villain-ghost#0' }, null, null, null, null]` (slot 0 holds `hA`); then seat `1` submits index 3 (`P0 gains hA`) through `applyDominateTheWeakGain` | the option list equals T1's; `hA` in `0`'s discard and `hqHaunters[0]` still set on the refilled slot | gain reaches a Haunted Hero |
| T4 | tacticHandlers | Genius; seats `0` (current), `1` hand `[techHero, other]`, `2` hand `[a, b]` (no tech), `3` empty hand, `4` hand `[dualClassTech]` (tech as `heroClass2`) | `pendingSeatChoice` = `{ kind: 'computer-uploaded-genius-discard', addressedSeats: ['2'], seatPrompts: { '2': { options: [{ label: 'Discard <a>', cardId: a }, { label: 'Discard <b>', cardId: b }] } }, submissions: {}, defaultOptionIndex: 0 }`; reveal line for `1`, no-card line for `3`, reveal line for `4`, then the park line | hand-only; heroClass2 counts |
| T5 | tacticHandlers | Genius solo; and with every other seat holding a Tech Hero | the solo line; the "no other player must discard" line after the reveal lines; nothing parked | |
| T6 | tacticHandlers | Pet Projects; seats `0` (current), `1` VP `['ca75-villain-zolas-creations-doughboy-01']`, `2` VP `['ca75-villain-masters-of-evil-wwii-black-knight-01', 'bystander-villain-deck-01']`, `3` VP `[]`; wounds 5 | `1` reveal line, no Wound; `2` and `3` gain one Wound each; `0` none; lines in seat order | each OTHER player; anchored prefix |
| T7 | tacticHandlers | Pet Projects with an empty wound pile; and solo | `2` / `3` `blocked` "supply is empty" lines; the solo `neutral` line | never throws |
| T8 | tacticHandlers | Crush; current `0` hand `['starting-shield-agent', atk2Hero, atk1Hero]`, inPlay `['starting-shield-trooper', atk3Hero]` | `pendingSeatChoice` = `{ kind: 'crush-pacifist-resistance-ko', addressedSeats: ['0'], seatPrompts: { '0': { options: [KO agent from their hand (sourceZone hand), KO atk1Hero from their hand (sourceZone hand), KO trooper from the cards they played this turn (sourceZone inPlay), { label: 'KO nothing' }] } }, submissions: {}, defaultOptionIndex: 3 }`; the park line | decline last and default |
| T9 | tacticHandlers | Crush with no eligible Hero (hand `[atk2Hero, 'pile-wound']`, inPlay `[]`) | the `blocked` line; nothing parked | |
| T10 | tacticHandlers | the existing Dark Technology, Bitter Captor and Fallen Idols tests | unchanged and passing | refactor oracle |
| T11 | seatChoiceTactics | `applyDominateTheWeakGain` with T1's choice, seat `1` submitting index 1 (`Player 1 gains hA`); heroDeck `[d1]`; `turnEconomy.recruit` 4 | `hA` leaves slot 0, slot 0 = `d1`, `hA` appended to `1`'s discard, recruit still 4, `Player 1 gained <hA> from the HQ (Dominate the Weak).` | no Recruit spent |
| T12 | seatChoiceTactics | `applyComputerUploadedGeniusDiscard` with seats `2` and `4` submitted | each chosen card leaves the hand for the discard, ascending seats, `(Computer-Uploaded Genius)` lines | through `discardFromHand` |
| T13 | seatChoiceTactics | `applyCrushPacifistResistanceKo`: option with `sourceZone: 'inPlay'` for a starter id that is also in the hand; then the "KO nothing" option | the inPlay copy KO'd to `G.ko`, the hand copy kept, the KO line names "the cards they played this turn"; then the decline line, nothing moves | zone-exact |
| T14 | seatChoice.resolve | `resolveSeatChoice` on T8's choice with option 0 | the agent KO'd from the hand; then `pendingSeatChoice.kind === 'crush-pacifist-resistance-last-ko'` with options `[KO atk1Hero, KO trooper, KO nothing]` and the chain line | chains after a KO |
| T15 | seatChoice.resolve | resolving that last-ko choice with option 0; then a fresh first pick resolved with "KO nothing"; then a first pick whose only target is KO'd | a second KO, no third choice; the decline line, no chain; the "no other Hero" line, no chain | at most two KOs |
| T16 | seatChoice.resolve | `applySeatChoiceTimeoutDefault` on T8's choice | the decline applied; no chain; `pendingSeatChoice` cleared | timeout never KOs |
| T17 | seatChoice.resolve | `resolveSeatChoice` on T1's choice (seat `1`, index 2) and on T4's choice | `0` gains `hB`; seat `2` discards its pick | dispatch wired |
| T18 | ai.seatChoice | a Genius discard whose options include a Wound and a cost-5 Hero; a Crush choice `[atk1Hero (cost 3), starter (cost 0), KO nothing]`; the same without the starter (`[atk1Hero, KO nothing]`); a Dominate choice | the Wound's index; 1; 1; 0 | bot picks |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** Arnim Zola is a gauntlet Mastermind (`packages/registry/src/gauntletLoadouts.generated.ts` L253-262). His strike and tactics now bite (and Dominate the Weak / Crush help), so those legs change difficulty. No committed `data/par` artifact references him, so nothing is re-pinned; future PAR runs pick up the change, the fidelity shift every card WP carries.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine-only card fidelity, no paid or persuasive surface).

**Determinism preservation:**
- No new `G` field and no randomness: the strike, the tactics and the chain read only `G`, iterate sorted seats and HQ slot order, and the option order is fixed (Locked Values).
- Narration goes to hash-excluded `G.messages` (D-24081). The new `SeatChoiceOption` fields live only inside a parked `G.pendingSeatChoice`, which an untriggered match never has.
- No hashed fixture plays Zola (Assumes 14), so `finalStateHash` and `PRE_WP080_HASH` are expected unchanged. If either moves, STOP and explain before any re-pin.
- **Replay-compat:** a stored pre-WP-821 match that hit Zola's strike or defeated a Zola tactic replays differently on the new code. No Zola match is a hashed fixture. The weekly full-mastermind sweep (`.github/workflows/sweep-weekly.yml`, `data/sweep-fixtures/mastermind-ids.full.json:17`) is not a hash gate, but its Zola results shift. Recorded in D-24754.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Shared reads.** Z1-Z3 pass.
2. **Strike.** S1-S6 pass.
3. **Dominate the Weak.** T1-T3, T3b, T11 and T17 pass.
4. **Computer-Uploaded Genius.** T4, T5, T12 and T17 pass.
5. **Pet Projects.** T6 and T7 pass.
6. **Crush Pacifist Resistance.** T8, T9, T13-T16 pass.
7. **Refactors and bot.** T10 and T18 pass.
8. **Feeds.** After `pnpm effect-index`, the four Zola tactics read `executable` with WP-821 / D-24754 provenance and no other row changes (the derived `summary.byStatus` counts excepted); `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0, and only the effect index needed regeneration.
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
10. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record the before / after totals. The hash oracles (`game.test.ts` `finalStateHash`, `replay/replay.execute.test.ts` `PRE_WP080_HASH`) pass unchanged.
3. `pnpm effect-index` → `git diff --stat -- data/metadata/` shows only `effect-implementation-index.json`, and its diff touches only the four Zola tactic rows (and the summary counts the generator derives from them).
4. `pnpm effect-index:check && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm cards:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If any but `effect-index:check` flags, STOP: Assumes 13 is false.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
7. Revert proofs, one at a time, each must fail at least one T-case: make the predicate `<=` instead of `<`; iterate the live HQ instead of the snapshot; drop the Crush chain; let Genius address a seat with a Tech Hero; make Pet Projects hit the current player; list Dominate recipients in plain ascending order (fails T1); replace `discardCardFromHand` with a raw push (fails S6).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24754 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-859:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live `ca75/arnim-zola` match on `play.legendary-arena.com`, with the deployed gitSha checked, staged through the operator setter pane (WP-806/807) or `/api/match/autoplay` setupData:
  - a Master Strike moves each HQ Hero with less than 2 printed Attack to the bottom of the Hero Deck, refills its slot, and each player discards a card of that cost (or logs that they have none);
  - each of the four Tactics, when defeated, logs its locked line. Dominate the Weak shows "Player N gains <Hero>" options and the Hero lands in that player's discard; Crush Pacifist Resistance offers a second KO after the first; Computer-Uploaded Genius opens the discard prompt for a non-Tech other seat in a 2+-player match.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24754 — arnim-zola-mastermind.** It locks:
- "less than 2 printed Attack" as `printedHeroAttack < 2` off play (a missing value is 0, rules v23 L2301-2311) and the played face's `cardStats.attack` in play, through one module (`mastermind/arnimZola.logic.ts`);
- the strike: the weak HQ Heroes snapshotted, then per HQ slot, put on the Hero Deck bottom + refill, and each player discards the earliest hand card of that Hero's cost, auto-picked inline (no `events`; interactive would need the WP-817 owed-queue timing deviation). The Magneto current-player-parks split (D-24284) is declined on purpose: up to five sequential parked picks per strike for one player while the others are auto-picked;
- Dominate the Weak as one active-seat seat choice pairing a recipient with a Hero (the new optional `SeatChoiceOption.recipientSeat`), current seat first and cost-descending so the default is "you gain the highest-cost eligible Hero" (D-24343); a single option auto-resolves; "gain" reaches Haunted Heroes;
- Computer-Uploaded Genius as a hand-only Tech reveal (either class slot) then the Fallen Idols-shape multi-seat discard, with the shared `buildHandDiscardChoice` / `applyHandDiscard` body extracted;
- Pet Projects: each OTHER player, any Victory-Pile card with the `ca75-villain-zolas-creations-` prefix reveals, else a Wound through the Diving Block chokepoint;
- Crush Pacifist Resistance as a two-step active-seat chain (hand + played cards, per-zone options via the new optional `SeatChoiceOption.sourceZone`, "KO nothing" last and default, the second step only after a KO, never on the timeout path), and the bot KOs a 0-cost Hero or declines;
- `gainHqHeroFree` moved verbatim to `seatChoiceTactics.ts` as `gainHqHeroToDiscard`;
- the intended follow-on effects: the strike and Dominate the Weak move Zola's Ultimate Abomination cost; Dominate the Weak's refill can empty the Hero Deck (final-turn latch D-24159 / Hero-Deck scheme loss D-24319); the strike never changes the Hero Deck's length;
- the replay-compat note, including the weekly full-mastermind sweep shift for Zola.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → READY TO EXECUTE after two Test Contract fixes, applied (the reviewer ruled no re-run is needed).**
- Verified against live code and data: all 15 Assumes items and anchors; card text and ids; the rules lines; cycle-free imports for the new module and the new strike imports; `gainHqHeroFree` has one caller; both option projections (`uiState.build.ts:1912`, `uiState.filter.ts:1353`) map to `{ label }`, no test pins an option keyset and no drift test enumerates seat-choice kinds; an active-seat-only park needs no `events`; `getLegalMoves` answers an outstanding active-seat choice at its default (`ai.legalMoves.ts:432-437`), and the bot-ally driver uses `choosePlayingSeatChoiceOption`; S1 / S3 / T1 / T11 / T14 / T15 arithmetic; no hashed fixture or PAR artifact; a played split card carries its played face id, so the inPlay read is right. The six touched test files ran 240 / 0 on the baseline.
- **PS-1 (fixed):** T18 third case expected 1, not 2.
- **PS-2 (fixed):** T8 now uses the `seatPrompts` shape.
- **RS-1 (fixed):** S.H.I.E.L.D. cards have seeded stats (Agent 0/0, Trooper 1/0); Assumes 3, T18 and the fixture note corrected.
- **RS-2 (fixed):** an explicit Import changes list, including dropping `tacticHandlers.ts`'s dead `refillHqSlot` import.
- **RS-3 (fixed):** Context and D-24754 record why the Magneto current-player-parks split is declined.
- **RS-4 (fixed):** the Crush apply's silent guards and the dynamic-zone precedent.
- **RS-5 (fixed):** a `// why:` on `ZolaKoTarget`.

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), six scope-neutral fixes, all applied; pre-flight stands.** Clean: cycle-free imports; both option projections strip to `{ label }`, the operator view never reads `pendingSeatChoice`, nothing enumerates seat-choice kinds; the Crush chain can't collide with the Monarch / Random Acts chains or fire on the timeout path, and Diving Block / return-on-discard openers wait while any seat choice is open; both `dispatchTacticOnFight` callers pass `events`; haunters live on the HQ slot (`haunt.logic.ts`); Hero copies have unique ids, so `G.hq.indexOf` is exact.
1. FM 11: T1 couldn't prove "current seat first" → T1 runs with current player `1`; T11 / T17 indices updated; a recipient-order revert proof.
2. FM 5: the single-option call passed optional fields under `exactOptionalPropertyTypes` → read `onlyOption` and guard both fields, no `!` / `as`.
3. FM 22 / 26: the silent-return exemption contradicted the Locked Values → one exemption listing the block-all-unreachable returns (WP and EC).
4. FM 18: Dominate's refill can empty the Hero Deck (final turn D-24159 / Civil War D-24319) → Context, D-24754, an EC smell; S1 asserts the strike keeps the Hero Deck length.
5. FM 11: the Haunted-Hero claim was untested → T3b and S5.
6. FM 11: nothing proved the strike discards through the chokepoint → S6 (return-on-discard) and a raw-push revert proof.

**Copilot (01.7), round 2 (same independent subagent): PASS → CONFIRM.** All six fixes verified against the files and the code (T1 order unreachable by a plain sort; `exactOptionalPropertyTypes`-safe single option; one consistent exemption; the Hero Deck length holds in S1; `HqHaunter` shape and the seeding precedent at `tacticHandlers.test.ts:1111-1133`; the S6 hook seeding at `mastermindHandlers.test.ts:1211`). WP ↔ EC agree on tests, seven revert proofs, strings and files. Three optional wording tightenings applied (T3b submitter and Hero Deck, the haunter shapes, the S6 fixture); no round 3, no pre-flight re-run.

**Lint (00.3) (independent subagent): FAIL → PASS after two EC string fixes, applied and re-checked** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. Two EC FAILs (restated strings) were fixed in place and confirmed by a second read-only pass; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 required sections present; Out of Scope has 9 items |
| §2 | PASS — engine-wide block (full files, no diffs, ESM, Node v22+, 00.6), session protocol, packet-specific constraints, separate Locked Values |
| §3 | PASS — 15 Assumes items, anchors verified against the code, baseline, BLOCKED clause |
| §4 | PASS — 00.2 §1.3 / §5, ARCHITECTURE sections, 18-entry DECISIONS scan, memory refs; audit note marked background |
| §5 | PASS — 14 engine + 2 data files + governance, size justified against ~8; every deliverable listed |
| §6 | PASS — ext ids and `ca75/arnim-zola` match `mastermind.setup.ts:253,279` and the fixtures; `mastermindSlug` per 00.2 |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine, scripts and data only; no randomness, no registry access after setup; no import cycle |
| §9 | PASS — only pnpm, node and git commands |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, `makeMockCtx`, pure-`G` fixtures; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 expectations, diff-scope step, seven revert proofs, hash oracles named |
| §14 | PASS — 10 binary criteria tied to T-cases or named checks |
| §15 / §15.1 | PASS — DoD has STATUS, DECISIONS, WORK_INDEX, EC_INDEX, allowlist-only diff; D-24026 live-verify on `play.legendary-arena.com` with gitSha check |
| §16 | PASS — style rules mandated; pre-named splits (`collectGeniusDiscardSeats`, `appendZoneKoTargets`, Crush chain placement); third-copy extraction justified |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 and NG-1 cited; conflict line; determinism and replay-compat |
| §18 | N/A — no grep verification step |
| §19 | N/A at draft — applies to the STATUS entry when the WP closes |
| §20 | PASS — N/A with reason (engine only, no funding UI, copy or channel) |
| §21 | PASS — N/A with reason (no HTTP endpoint, no `apps/server/src/**` surface) |

EC-859 vs EC-TEMPLATE: FAIL → PASS after two fixes: the predicate's bare `2` and Crush's `${name}` are now copied verbatim from the WP. All seven sections are in template order; 58 content lines against the 100 ceiling; scope lock + green baseline in Before Starting.

Advisories applied: A1 (file count, ~8 guideline), A3 (pre-named splits), A4 (constant names in the EC), A5 (the shared `(${sourceName})` template, the exact bot rule), A6 (the audit note marked background only), the Pet Projects call copied verbatim. A2 filled here and in the Status line. Edits after the copilot CONFIRM are string copies and naming-only splits within listed files (the WP-818 precedent: lint fixes applied without a copilot re-run).

**Verdict:** PASS.
