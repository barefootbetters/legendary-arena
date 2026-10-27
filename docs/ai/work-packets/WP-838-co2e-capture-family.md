# WP-838 — co2e capture family: Enchantress, HYDRA Kidnappers, Venom and Baron Strucker (Game Engine + card data + one Arena Client helper)

**Status:** Draft 2026-10-25 — pre-flight READY TO EXECUTE (01.4, after PS-1 + RS-1..7); copilot (01.7) RISK → RISK 1 + RISK 2 applied; lint (00.3) PASS (EC-876; **D-24771** reserved, #3010). See §Gate Record. Amended 2026-10-27 (pre-execution): one D-24780 seat-order `// why:` note on the Enchantress loop; no behavior change.
**Primary Layer:** Game Engine (+ card-data markers and their derived feeds, + one Arena Client display helper)
**Dependencies:** none hard (everything this packet builds on is on `main`). Soft ordering: WP-835 / WP-836 / WP-837 / WP-839 / WP-840 (drafted in parallel) add rows to the same `co2e` blocks of the marker map, and WP-836 / 837 / 839 / 840 append primitives to the same union, array, handler map and script copy. Whichever lands second rebases its appends; nothing here reads their behavior. WP-839 also adds entries to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (keep them); WP-840 splits `defeatCityVillainCore` into `defeatVillainCardCore`: whichever lands second carries the other's block (this packet's Step 3c branch moves with the split). Each sibling may be present on or absent from `main` at execution; both cases are fine. WP-841 (drafted 2026-10-25) appends a sibling table to the same overlay, requirement map, setup builder file, `types.ts`, `buildInitialGameState.ts` and `resolveBaseFightCost` dynamic branch. If WP-841 executed first: keep its `variableAttack` list, `buildVillainVariableAttack`, the `villainVariableAttack?` field and spread, and its dynamic-branch early return (merge the two early returns as one `||`); keep its `[variable-attack:]` count and name in the overlay's final line and start banner (four markers) and its header doc-comment paragraph; keep its `+ villainVariableAttackBonus(G, villainCardId)` term in `costBeforeReduction` (both packets' terms sit before the reduction; their order is irrelevant); in the console text `[attack-per-captured:]` comes before `[variable-attack:]`, and the final line keeps the leading `\n` the live script prints (L500); drop Strucker's passive from the STATUS follow-ups, Out of Scope and the D-24771 residuals (WP-841 / D-24774 owns it). The open #2998 / #3001 / #3004 stack (WP-830 / 831 / 832) also edits `fightVillain.ts`, `types.ts` and `villainDeck.reveal.ts`, outside `defeatCityVillainCore` Step 3c and `performVillainReveal` step 3: a line-shift rebase, not a dependency.
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes one contract file (`rules/villainAbility.types.ts`: five primitives, one descriptor field, one table type), adds one omit-when-empty `G` field, a fight-cost term, a fight-site branch and a reveal classification fallback.
**Arc:** co2e villain fidelity epic (WP-835..840), packet 4 of 6 — the capture family (inventory rows #11, #16, #18, #19, #31, #32).

> Baseline: drafted at the #3010 reserve `677c4109` (engine code identical to `f260d148`). `origin/main` was `461ed924` (EC-867 / WP-829) at the pre-flight, which changes no allowlisted file except `types.ts` (+25 lines above `villainAttachedHeroes`, now ~L2585), and is now `e580d801` (WP-830 merged, from the #2998 / #3001 / #3004 stack: line shifts only in `fightVillain.ts`, `types.ts` and `villainDeck.reveal.ts`). Re-read anchors at execution. `VILLAIN_EFFECT_PRIMITIVES` has **31** members at draft. Re-read line anchors, the primitive count and test totals at execution.

---

## Goal

As a player facing the Core 2nd-edition villains, I want Enchantress, HYDRA Kidnappers, Venom and Baron Strucker to do what they print, so that their Ambush and Fight lines stop being silent no-ops and their fight costs stay right once they hold captured cards.

| Card (`co2e`) | Printed line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| Enchantress (`enemies-of-asgard`, 5+, 2 copies) | `Ambush: Enchantress captures a Bystander from the Bystander Deck and from each player's Victory Pile (of that player's choice).` | No marker; logged as a Hollow effect (`unmarked-ability`). | She captures the Bystander Deck's top card, then the first Bystander in each player's Victory Pile. |
| Enchantress | `Enchantress gets +1[icon:attack] for each Bystander she has.` | Not modelled: `5+` is "dynamic", which adds captured **Hero costs**; she holds none, so she fights for 5. | She fights for 5 + 1 per Bystander she holds. |
| HYDRA Kidnappers (`hydra`, 4, 2 copies) | `Ambush: HYDRA Kidnappers capture a card from the S.H.I.E.L.D. Officer Deck or Sidekick Deck.` | No marker; Hollow. | They capture the Officer Deck's top card (the Sidekick Deck's when no Officer is left). Fight cost stays 4. |
| HYDRA Kidnappers | `Fight: Choose a player to gain that Hero.` | No marker; Hollow (the generic fight-site award has nothing to award). | The fighter gains the captured card. |
| Venom (`sinister-spider-foes`, 5+, 2 copies) | `Ambush: Venom captures a Hero from the Sidekick Deck and each Hero that costs 2 or less from the HQ.` | No marker; Hollow. | Venom captures the Sidekick Deck's top card, then every HQ Hero that costs 2 or less (the HQ refills behind each one). |
| Venom | `Venom gets +1[icon:attack] for each Hero he has.` | `5+` would add the captured cards' **costs** (a 2-cost Sidekick + two 2-cost Heroes = 11). | He fights for 5 + 1 per captured card (that example = 8). |
| Venom | `Fight: You may gain a Hero captured by Venom. Put the rest on the bottom of the Hero Deck and/or Sidekick Deck as appropriate.` | No marker; the generic award would hand the fighter **every** captured card. | The fighter gains one (the highest-cost real Hero; the Sidekick only when it is the only card); the rest go to the bottom of their own deck. |
| Baron Strucker, Supreme Hydra (`hydra`, 6+, 2 copies) | `Fight: Shuffle four cards from the Bystander Deck into the Villain Deck. Then play two cards from the Villain Deck.` | No marker; Hollow. | Up to four supply Bystanders are shuffled into the Villain Deck, then its top two cards are played. |
| Baron Zemo (`masters-of-evil`, 4+, 2 copies) | `Baron Zemo gets +1[icon:attack] for each Bystander he has.` | Not modelled: his Ambush already captures Bystanders (WP-521, D-24334), but he fights for 4. | He fights for 4 + 1 per Bystander he holds (one data row in this packet's table, no code; Operator fork F6). |

## User-Visible Impact

- The Ambush and Fight log lines above appear, and the Hollow-effect breadcrumbs for these four villains disappear.
- The City card's fight cost for Venom, Enchantress and co2e Baron Zemo shows base + 1 per captured card / Bystander (the projection already reads `resolveFightCost`).
- A Bystander that Baron Strucker shuffled into the Villain Deck reveals as a Bystander (captured by the Villain closest to the Villain Deck), and the deck-odds panel counts it as a Bystander, not a Villain.
- No new prompt, button or move. Every choice in this packet auto-resolves (§Operator forks).

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L606-608: a captured Bystander goes under the Villain closest to the Villain Deck; L1582-1584: "captures 2 Human Shields" means "the top 2 cards of the Bystander Stack" (a capture from a deck takes its top card).
   - L749-755: "Whenever there is an empty space in the HQ for any reason, you refill that space immediately with the top card of the Hero Deck."
   - L3199-3201: "if a card says 'do A or do B,' you can choose either option that you can actually do. You can't choose an option that you can't do."
   - L3202-3208: S.H.I.E.L.D. Heroes and Sidekicks count as Heroes and are grey; L1952: "Sidekicks don't have classes".
   - L3443-3449: a Villain that escapes with captured Heroes leaves them in the Escape Pile.
2. **Card text on the baseline.** The seven lines in §Goal are verbatim in `data/cards/co2e.json` and carry no marker. On draft `main`, `scripts/convert-cards/inputs/villain-effect-markers.json` L91-101 has `co2e` blocks only for `masters-of-evil` and `skulls`. If any sibling WP-835..840 merged first, its rows sit beside these (expected; EC Before Starting). What must hold: none of *this packet's* lines (§Goal) carries an `[effect:]` or `[attack-per-captured:]` marker. The villain ledger rows `co2e-villain-enemies-of-asgard-enchantress`, `-hydra-hydra-kidnappers`, `-hydra-baron-strucker-supreme-hydra`, `-sinister-spider-foes-venom` are `(unmarked)` (`docs/ai/coverage/villain-mechanic-ledger.csv` L130 / L134 / L124 / L155). The `core` Venom / HYDRA Kidnappers / Enchantress are different cards and are not touched.
3. **Pipeline.** `setup/villainAbility.setup.ts` reads only `[effect:…]` on `Fight:` / `Ambush:` / `Escape:` lines; `parseUngatedEffect` (L490) holds the magnitude arms (`play-villain-deck-cards` L689, `reveal-top-draw-if-cost-lte` L671-687), the `discard-hero-each-player-by-cost` arm (L819) and the no-param tail (L833, `parts.length === 1`); `parsePositiveInteger` L225. The passive "+1[icon:attack]" lines have no timing prefix, so they build no hook and no Hollow record.
4. **Primitive vocabulary.** `VillainEffectPrimitive` (`rules/villainAbility.types.ts` L336-366) and `VILLAIN_EFFECT_PRIMITIVES` (L434-483) hold 31 members, last `discard-hero-each-player-by-cost`. Three tests pin the count: `villainAbility.types.test.ts` L394-401 (parity + last member), L619 (WP-816 T2), L652 (WP-817 T1). `VillainEffectDescriptor` L505-649 (`eligibleCosts` L648 is the latest field); `descriptorKey` L679 = `primitive|target|magnitude|selector`. `VillainFightDiscardCost` L779 sits beside `VillainDefeatRequirement` L761.
5. **Executor.** `villain/villainEffects.execute.ts`: `executeVillainAbilities` (L134) passes `shuffleContext` and `cityIndex` through `applyVillainEffect` (L4008) to every handler; `VillainEffectHandler` L864; handler map L3951 (`Record<VillainEffectPrimitive, VillainEffectHandler>`, so a missing entry is a type error); `resolveCardDisplayName` L372; `villainEffectTimingLabel` L1812; `villainEffectKoBystanderEachVictoryPile` L1079 (sorted players, `findFirstVictoryPileBystander`, `moveCardFromZone`); the legacy `captureBystander` path L1402-1440 (attach at Ambush, reverse-maps to a keyword, so it narrates through the generic line); `villainEffectGainAttachedHero` L1620 and `villainEffectPlayVillainDeckCards` L1746 are deliberate no-ops, listed in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L720-725) so the WP-488 / D-24294 effect trace labels their dispatch `no-op`, not `fired` (its comment: a new deliberate no-op must be added there); `villainCardPlaysVillainDeckCards` L1774 is the exported hook-scan predicate the fire sites read. A keyword-less descriptor records no result and must self-narrate (auto-memory `reference_villain_effect_vocabulary_extension`).
6. **Captured Heroes.** `G.villainAttachedHeroes: Record<CardExtId, CardExtId[]>` (`types.ts` ~L2585 on `461ed924`, L2560 at `677c4109`; required; an entry exists only while non-empty, D-21401). `board/heroCapture.logic.ts`: `captureHeroFromHq` L54 (select by selector, null the slot, push onto the entry, `refillHqSlot`), `awardAttachedHeroes` L142 (all to the fighter's discard), `moveAttachedHeroesToEscapedPile` (D-24657).
7. **Fight site.** `moves/fightVillain.ts` `defeatCityVillainCore` (or `defeatVillainCardCore`, if WP-840 landed; L509, also reached by card-effect defeats): Step 3b awards attached Bystanders (L568-577); Step 3c copies the attached-hero list (L584) and calls `awardAttachedHeroes` (L585); `executeVillainAbilities(…, 'onFight', shuffleContext, cityIndex)` L608; one `gained … into their discard pile` line per hero (L629-633); the `play-villain-deck-cards` play fires last (L697-715) through `playTopVillainDeckCards`.
8. **Fight cost.** `economy/economy.resolve.ts` `resolveFightCost` (L94) sums `resolveBaseFightCost` + scheme / keyword terms (L109-114). `resolveBaseFightCost` (L281) returns `fightCostBase + Σ captured-Hero cost` for a `dynamic` villain (L326-340; apart from WP-841's early return and `villainVariableAttackBonus` term, if it landed first) and `fightCost` for a static one. `vAttack` `"N+"` and `"*"` are `dynamic` (`economy/economy.logic.ts` L369-377). `bystanderVillainAttackBonus` (L259) adds +1 per attached Bystander only under the Midtown Bank Robbery family. The fight move, `getLegalMoves` and the City projection (`ui/uiState.build.ts` L893) all call `resolveFightCost`, so a term added there reaches all three.
9. **Per-villain setup tables.** `setup/villainDefeatRequirement.setup.ts` builds `G.villainDefeatRequirements` (L262) and `G.villainFightDiscardCosts` (L332, WP-817) from inline markers, per copy via the registry walk; `setup/buildInitialGameState.ts` calls the builders (~L435-447) and spreads them omit-when-empty (~L897-905). The overlay `scripts/convert-cards/apply-defeat-requirement-markers.mjs` (550 lines; `FIGHT_DISCARD_LINE_PREFIX` L78, `runApply` L459, final line L500, `runPropose` L509) reads `scripts/convert-cards/inputs/villain-defeat-requirements.json` (`requirements`, `fightDiscardCosts`) and is stage 4 of `scripts/check-card-data-regen.mjs` (L58-61).
10. **Supply piles.** `setup/pilesInit.ts`: `BYSTANDER_EXT_ID = 'pile-bystander'`, `SHIELD_OFFICER_EXT_ID = 'pile-shield-officer'` (L28), `SIDEKICK_EXT_ID = 'pile-sidekick'` (L43); every pile holds that one fungible id; index 0 is the top (`attachBystanderToVillain`, `recruitOfficer`). `G.cardStats` gives the Officer cost 3 and the Sidekick cost 2 (`buildInitialGameState.ts` L557-558). `sidekicksCount` may be 0 (its floor is 0, `matchSetup.validate.ts` L118-134, "a match may legitimately use no sidekicks"), so the Sidekick Deck is often empty; no move takes a Sidekick out of its pile today. The six fungible ids are exempt from the cross-zone duplicate invariant (`invariants/gameRules.checks.ts` L41-48).
11. **Villain Deck.** `G.villainDeck.deck[0]` is the top; the deck never reshuffles from its discard (D-24160). `performVillainReveal` (`villainDeck/villainDeck.reveal.ts` L219) classifies the top card by `G.villainDeckCardTypes[cardId]` (L250) and **fails closed** on a missing entry ("has no entry in villainDeckCardTypes", card left on top). Supply Bystanders carry no entry; only `bystander-villain-deck-NN` ids do. The bystander branch (L492-552) attaches whatever id it was given. Nothing on the baseline puts `pile-bystander` into the Villain Deck. The deck-exhaustion final-turn latch is sticky (`endgame/finalTurn.logic.ts`, D-24159).
12. **Other readers of a Villain-Deck card's type.** `rules/tacticHandlers.ts` `resolveFindingZemo` (L1695; ca75 Baron Heinrich Zemo) KOs top-5 cards typed `'bystander'` (L1715) and already imports `BYSTANDER_EXT_ID` (L50). `apps/arena-client/src/components/play/deckProbability.ts` `categorizeVillainCard` (L51-65, type-only engine import) buckets by id prefix and sends `pile-bystander` to `'villain'`. `schemeResourceLoss.ts` (L45-58) and `scoring.logic.ts` `isBystanderCard` (L44-52) already treat `BYSTANDER_EXT_ID` as a Bystander. `moves/operatorSetters.ts` `findFirstVillainDeckCard` (L190-199, the operator debug pane) classifies by the map only.
13. **Shuffle.** `setup/shuffle.ts` `ShuffleProvider` / `shuffleDeck(cards, context)` (copies, then `context.random.Shuffle`). Engine tests use a reversing mock shuffle (`makeMockCtx`).
14. **Marker script copies.** `scripts/convert-cards/apply-effect-markers.mjs` keeps its own `VILLAIN_EFFECT_PRIMITIVES` (L175) and `isValidParameterizedEffectToken` (L271; magnitude arms ~L370, cost-list arm L404, no-param tail L410). `scripts/villain-mechanic-ledger.mjs` names a mechanic by the token before the first `:`; `scripts/coverage/mechanic-provenance.json` keys villain primitives (L55-81).
15. **Hash and fixtures.** No committed fixture, golden or PAR artifact plays `co2e/hydra`, `co2e/enemies-of-asgard`, `co2e/sinister-spider-foes` or `co2e/masters-of-evil` (D-24333 / D-24334 record the last); they appear only as id strings in `parScoring.keys.test.ts`, `par.storage.test.ts`, the gauntlet tests and `packages/registry/src/gauntletLoadouts.generated.ts`. The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic. `pnpm cards:check` seeds `co2e.json` but excludes it from the comparison (D-24443), so it does not verify co2e markers.
16. **Precedent wording.** D-24749: Executioner KOs "the first Bystander in pile order … every Victory-Pile Bystander is worth the same", no prompt. D-24335 Fork A (Ultron's KO-or-gift): "consistent with the WP-516 Ymir / WP-519 Melter 'choose a player → current player' collapses" (D-24329). D-24350: HYDRA Kidnappers' (core) "may gain" auto-takes. D-24333: co2e Baron Zemo's "+1 per Bystander he has" shipped unmodelled as a separate passive class.
17. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24771) before coding.

## Context (Read First)

- **Why the fight-cost rule is in scope.** Today's `N+` "dynamic" mode adds each captured Hero's **cost**. That is right for the Skrulls ("+Attack equal to its cost") and wrong for Venom ("+1 for each Hero he has"): once this packet makes Venom capture, a Sidekick plus two 2-cost Heroes would fight for 11 instead of 8. Enchantress's dynamic mode ignores Bystanders, so she would hold 1 + N Bystanders and still fight for 5. Both errors are caused by this packet's captures, so it carries the smallest fix: one setup-built table `G.villainAttackPerCaptured` (per copy, omit-when-empty) from a `[attack-per-captured:<hero|bystander>:<N>]` marker on the printed passive line, read by one term in `resolveFightCost`. Any entry **replaces** the dynamic captured-cost sum (the card's printed per-card rule is the whole variable part), and the term adds `count × N` of its kind: captured Heroes for Venom, captured Bystanders for Enchantress. The same table fixes co2e Baron Zemo, whose identical passive D-24333 parked while his Ambush already captures: one data row, no code (Operator fork F6). This is the WP-817 sibling-table shape (D-24750, `villainFightDiscardCosts`), produced by the same overlay script. Baron Strucker's own passive ("+1 for each other HYDRA Villain in the city and/or Escape Pile") is not caused by this packet and stays out (Operator fork F1).
- **Why Venom's Fight is a fight-site branch.** The generic `awardAttachedHeroes` (Step 3c) runs before the executor and gives the fighter every captured card. Venom must keep one and return the rest, so the fight site asks a hook-scan predicate (`villainCardGainsOneCapturedHero`, the `villainCardPlaysVillainDeckCards` shape) and takes a split-award path instead. The primitive's handler is a deliberate no-op that only marks the line handled (the D-24270 `gain-attached-hero` and D-24351 `play-villain-deck-cards` precedent).
- **Why Strucker's shuffle is an executor handler.** The handler already receives `shuffleContext` at the Fight site (WP-478 / D-24285). The two markers on the line fire in order: the handler shuffles during `executeVillainAbilities`, then the existing `play-villain-deck-cards:2` bridge plays two cards after the defeat settles (Assumes 7). So the printed order holds without a new fire site.
- **Why the reveal learns `pile-bystander`.** Supply Bystanders share one id that has no `villainDeckCardTypes` entry (Assumes 11). Without a fallback, the first shuffled-in Bystander to reach the top would fail closed and block the Villain Deck for the rest of the match. A local classifier (`villainDeckCardTypes` first, then `BYSTANDER_EXT_ID` → `'bystander'`) mirrors `resolveEscapedPileEntryType` and `isBystanderCard`, and writes nothing to `G.villainDeckCardTypes`. Finding Zemo and the client's deck-odds bucket get the same one-line rule, so every gameplay and display reader of a Villain-Deck card's type agrees (the operator setter's `findFirstVillainDeckCard` is a recorded residual).
- **Two capture primitives for three capture clauses.** `capture-pile-hero:<pile>[+<pile>]` takes the top card of the first non-empty listed pile (Kidnappers `officer+sidekick`, Venom `sidekick`); `capture-hq-heroes-cost-lte:<N>` captures every HQ Hero costing N or less. Both are reusable as written.
- **Choices auto-resolve.** No non-active prompt can open mid-Ambush (the multi-seat seat choice opens after the move, WP-793 / D-24656; an Ambush-timed opener is WP-837's work), and every pick here is deterministic and near-dominant. Each is a recorded Operator fork with a default.
- **One session, with a named split seam.** About 32 files and 31 T-cases is the upper edge for one session, but each change is small and anchored. If context runs short mid-execution, the clean seam is "Strucker + classifier" (handler 5, T16-T17 / T24 / T28 / T30 / T31, `villainDeck.reveal.ts`, `tacticHandlers.ts`, `deckProbability.ts`, the Strucker marker row) as a follow-up packet. The Strucker marker never ships without the classifier.
- **Split vs one WP.** The epic brief gives these six lines one packet. They share one marker map block per group, one parser / executor pair, the captured-card store and the fight-cost authority. The file count is above the ~10 guideline (justified in §Files Expected to Change).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape) and §5 (printed markup; `[effect:]`, `[require-to-defeat:]`, `[discard-to-fight:]` and now `[attack-per-captured:]` are pipeline-appended engine markers, documented in the marker map `_notes` and the requirement map `_doc`).
- `docs/ai/ARCHITECTURE.md`: §Zone & Pile Structure, Persistence Boundaries (`G` runtime-only), §The Rule Execution Pipeline, §The Move Validation Contract (unchanged: no new move argument).
- `docs/ai/DECISIONS.md`: scan D-18506, D-21401, D-24023, D-24034, D-24076, D-24081, D-24159, D-24160, D-24266, D-24270, D-24285, D-24324, D-24329, D-24333, D-24335, D-24350, D-24351, D-24372, D-24443, D-24571, D-24657, D-24749, D-24750 before coding.
- User memory: `reference_villain_effect_vocabulary_extension`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_injected_seam_hides_missing_wiring`, `reference_bot_legalmoves_moveguard_divergence` (no new move here; the fight branch already reads `resolveFightCost`).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. Randomness only through the `ShuffleProvider` the fire site passes. No I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24771) before coding. One WP per session.

**Packet-specific:**
- **Data, not English.** No parser reads printed English. Behavior comes only from the markers in Locked Values.
- **Markers only.** Regenerate with `apply-effect-markers.mjs` and `apply-defeat-requirement-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** Each new keyword-less outcome logs through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen.
- **One fight-cost authority.** The per-captured term lives only in `resolveFightCost` / `resolveBaseFightCost`. No other site computes Venom's or Enchantress's cost.
- **Byte-identical elsewhere.** Every villain without one of the new markers or table entries resolves, fights, captures and awards exactly as today; no new `G` key appears in a match without co2e Enchantress, Venom or Baron Zemo; `G.villainDeckCardTypes` is never written; hash oracles stay unchanged.
- **Captured cards stay `CardExtId` strings** in `G.villainAttachedHeroes` / `G.attachedBystanders`, and keep the "entry exists only while non-empty" rule (D-21401).
- **One classifier rule** for a Villain-Deck card's type: `villainDeckCardTypes[id]`, else `'bystander'` for `BYSTANDER_EXT_ID`, else unknown. Used by the reveal, Finding Zemo and the client bucket.

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order (positions 32-36 at draft; append after whatever is last at execution): `'capture-bystander-each-victory-pile'`, `'capture-pile-hero'`, `'capture-hq-heroes-cost-lte'`, `'gain-one-attached-hero-rest-to-bottom'`, `'shuffle-bystanders-into-villain-deck'`. The five pins in `villainAbility.types.test.ts` (ordered list, length, last-member literal + position, L619, L652), plus the count in the L359 title and the L396 / L401 messages, move 31 → 36 (or by +5 from the count at execution).
- `export type VillainCapturePile = 'officer' | 'sidekick';` and `export const VILLAIN_CAPTURE_PILES: readonly VillainCapturePile[] = ['officer', 'sidekick'];` (runtime drift pin).
- `VillainEffectDescriptor.capturePiles?: readonly VillainCapturePile[]` — present only on `capture-pile-hero`; non-empty, no duplicates, preference order; **not** part of `descriptorKey`. `capture-hq-heroes-cost-lte` and `shuffle-bystanders-into-villain-deck` carry their number on the existing `magnitude`.
- `export type VillainCapturedKind = 'hero' | 'bystander';`, `export const VILLAIN_CAPTURED_KINDS: readonly VillainCapturedKind[] = ['hero', 'bystander'];`, and `export interface VillainAttackPerCaptured { kind: VillainCapturedKind; attackPerCard: number; }` next to `VillainFightDiscardCost`, with JSDoc: the Attack a villain gains per captured card of `kind`; built at setup from `[attack-per-captured:<kind>:<N>]`; immutable during play.

**State (`types.ts`):** `LegendaryGameState.villainAttackPerCaptured?: Record<CardExtId, VillainAttackPerCaptured>` — omit-when-empty, built at setup, never written by a move.

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `capture-bystander-each-victory-pile`, `gain-one-attached-hero-rest-to-bottom` — no params (the existing tail). Any param → null.
- `capture-pile-hero:<pile>[+<pile>]` — exactly 2 `:` parts; the second splits on `+` into 1-2 tokens, each in `VILLAIN_CAPTURE_PILES`, no duplicate → `{ primitive, capturePiles }`; anything else → null.
- `capture-hq-heroes-cost-lte:<N>`, `shuffle-bystanders-into-villain-deck:<N>` — exactly 2 parts, `N` by `parsePositiveInteger` → `{ primitive, magnitude }`; anything else → null.
- Attack marker `[attack-per-captured:<kind>:<N>]` — exactly 2 `:` parts after the name; `kind` in `VILLAIN_CAPTURED_KINDS`; `N` matching `^[1-9][0-9]*$`. Parsed by `parseAttackPerCapturedLine` in `setup/villainDefeatRequirement.setup.ts`; malformed → no entry (inert, never throws). First valid marker on any line of the card wins. `buildVillainAttackPerCaptured` copies the two existing builders' registry walk; the existing builders are not refactored (a shared walk would put two shipped tables at risk for no behavior gain).

**Handlers (`villain/villainEffects.execute.ts`; each returns `{ targets: [] }`, `label = villainEffectTimingLabel(timing)`):**
- `villainEffectCaptureBystanderEachVictoryPile`: for each player in `Object.keys(G.playerZones).sort()` (stays sorted under D-24780 §13, amended 2026-10-27: no Wound, discard or reaction runs, and the order only sets the append order of `G.attachedBystanders[cardId]` and the log names — the D-24780 §6 append-order class; a `// why:` on the loop says so), take `findFirstVictoryPileBystander(zones.victory)`; remove it from the Victory Pile (`moveCardFromZone`) and append it to `G.attachedBystanders[cardId]` (a fresh array; no entry when nothing moved). Log `` `${label} effect: captured a Bystander from the Victory Pile of ${names}.` `` `'applied'` (`names` = `Player 0, Player 2`), or `` `${label} effect: no player had a Bystander in their Victory Pile to capture.` `` `'blocked'`.
- `villainEffectCapturePileHero`: the first pile in `descriptor.capturePiles` with a card (`officer` → `G.piles.officers`, `sidekick` → `G.piles.sidekicks`); shift its top (`[0]`) onto `G.villainAttachedHeroes[cardId]` through `attachCapturedHero`. Log `` `${label} effect: captured ${resolveCardDisplayName(G, capturedId)} from the ${pileLabel}.` `` `'applied'`, `pileLabel` = `S.H.I.E.L.D. Officer Deck` / `Sidekick Deck`. All listed piles empty (or `capturePiles` missing) → `` `${label} effect: nothing was captured because ${emptyClause}.` `` `'blocked'`, `emptyClause` = `the Sidekick Deck is empty` / `the S.H.I.E.L.D. Officer Deck and the Sidekick Deck are empty` (listed order).
- `villainEffectCaptureHqHeroesCostLte`: `limit = descriptor.magnitude`; snapshot the HQ slot indices (ascending) whose Hero has a `G.cardStats` entry with `cost <= limit` (no entry → not eligible; never `?? 0`); then `captureHeroFromHqSlot` each index in order (each refills at once; a refilled Hero is never re-checked). Log `` `${label} effect: captured ${names} from the HQ (cost ${limit} or less).` `` `'applied'`, or `` `${label} effect: no Hero in the HQ costs ${limit} or less, so none was captured.` `` `'blocked'`. Missing `magnitude` → the blocked line with no capture.
- `villainEffectGainOneAttachedHeroRestToBottom`: deliberate no-op (no mutation, no log; the fight site does the work).
- Add `'gain-one-attached-hero-rest-to-bottom'` to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (`villainEffects.execute.ts` ~L720) with a `// why:` (the split happens at the fight site), so its effect trace reads `no-op`.
- `villainEffectShuffleBystandersIntoVillainDeck`: `shuffleContext` undefined → `` `${label} effect: no shuffle source was available, so no Bystander was shuffled into the Villain Deck.` `` `'blocked'`, no mutation. Else move `min(magnitude, G.piles.bystanders.length)` cards from the top of `G.piles.bystanders`; none → `` `${label} effect: the Bystander Deck is empty, so no Bystander was shuffled into the Villain Deck.` `` `'blocked'`, no shuffle call. Else `G.villainDeck.deck = shuffleDeck([...G.villainDeck.deck, ...moved], shuffleContext)` and log `` `${label} effect: shuffled ${moved.length} Bystander(s) from the Bystander Deck into the Villain Deck.` `` `'applied'`.
- `export function villainCardGainsOneCapturedHero(G, cardId): boolean` — true when an `onFight` hook for the card carries `gain-one-attached-hero-rest-to-bottom`; guards `!G.villainAbilityHooks` and `hook.effects ?? []` (the `villainCardPlaysVillainDeckCards` shape).

**Capture helpers (`board/heroCapture.logic.ts`, boardgame.io-free):**
- `export function attachCapturedHero(G, villainCardId, heroId): void` — create or push the entry; `captureHeroFromHq`'s step 2 calls it (behavior unchanged).
- `export function captureHeroFromHqSlot(G, villainCardId, hqIndex): CaptureHeroResult | null` — null for an empty or out-of-range slot; else null the slot, `attachCapturedHero`, `refillHqSlot`. `captureHeroFromHq` keeps its selection and calls it (its tests stay green unchanged).
- `export function selectCapturedHeroToGain(G, heroIds): number` — index of the highest `G.cardStats[id]?.cost ?? 0` among the ids that are not `SIDEKICK_EXT_ID`, the earliest on a tie; when every id is `SIDEKICK_EXT_ID`, the earliest one; `-1` for an empty list.
- `export interface ReturnedCapturedHero { heroId: CardExtId; deck: 'hero-deck' | 'sidekick-deck' | 'officer-deck'; }`, `export interface AttachedHeroSplitOutcome { gainedHeroId: CardExtId | null; returnedToBottom: ReturnedCapturedHero[]; }`.
- `export function awardOneAttachedHeroRestToBottom(G, villainCardId, playerId): AttachedHeroSplitOutcome` — the selected card goes to the player's discard; every other card, in capture order, is appended to the bottom of its home deck (`SIDEKICK_EXT_ID` → `G.piles.sidekicks`, `SHIELD_OFFICER_EXT_ID` → `G.piles.officers`, any other id → `G.heroDeck`); the entry is deleted. No entry or missing player zones → `{ gainedHeroId: null, returnedToBottom: [] }`, nothing written.

**Fight site (`moves/fightVillain.ts` `defeatCityVillainCore`, Step 3c):** when `villainCardGainsOneCapturedHero(G, cardId)`, call `awardOneAttachedHeroRestToBottom` instead of `awardAttachedHeroes`, and set the logged list to `[gainedHeroId]` (or `[]`). After the existing `gained … into their discard pile` loop, one line per returned card: `` `Fight effect: ${formatCardRef(G.cardDisplayData, heroId)} went to the bottom of the ${deckLabel}.` `` (`Hero Deck` / `Sidekick Deck` / `S.H.I.E.L.D. Officer Deck`); with nothing captured, `` `Fight effect: ${formatCardRef(G.cardDisplayData, cardId)} had no captured Hero to gain.` `` `'blocked'`. Every other villain takes the unchanged `awardAttachedHeroes` path.

**Fight cost (`economy/economy.resolve.ts`):**
- In `resolveBaseFightCost`'s dynamic branch, before the cost sum: `G.villainAttackPerCaptured?.[villainCardId] !== undefined` → `return base;` (either kind).
- `function villainCapturedCountBonus(G, villainCardId): number` — no entry → 0; `hero` → `(G.villainAttachedHeroes?.[id]?.length ?? 0) * attackPerCard`; `bystander` → `(G.attachedBystanders?.[id]?.length ?? 0) * attackPerCard`. Added to `costBeforeReduction` beside the other terms (so the reduction and the 0 floor still apply after it).

**Villain-Deck classification:**
- `villainDeck/villainDeck.reveal.ts`: `function resolveRevealedCardType(G, cardId): RevealedCardType | undefined` — the map entry, else `'bystander'` when `cardId === BYSTANDER_EXT_ID`, else `undefined`. `performVillainReveal` step 3 uses it; an unknown id still fails closed with the existing message.
- `rules/tacticHandlers.ts` `resolveFindingZemo`: the KO test becomes `G.villainDeckCardTypes[cardExtId] === 'bystander' || cardExtId === BYSTANDER_EXT_ID`.
- `apps/arena-client/src/components/play/deckProbability.ts` `categorizeVillainCard`: the Bystander branch also matches `extId === 'pile-bystander'` (a literal with a `// why:`; the file is type-only toward the engine).

**Data:**
- Marker map `villains.co2e` gains `"enemies-of-asgard": { "enchantress": { "ambush": ["captureBystander", "capture-bystander-each-victory-pile"] } }`, `"hydra": { "baron-strucker-supreme-hydra": { "fight": ["shuffle-bystanders-into-villain-deck:4", "play-villain-deck-cards:2"] }, "hydra-kidnappers": { "ambush": ["capture-pile-hero:officer+sidekick"], "fight": ["gain-attached-hero"] } }`, `"sinister-spider-foes": { "venom": { "ambush": ["capture-pile-hero:sidekick", "capture-hq-heroes-cost-lte:2"], "fight": ["gain-one-attached-hero-rest-to-bottom"] } }` (merge into the group objects if WP-835 / 836 / 837 / 839 created them first; never replace a sibling's key).
- `villain-defeat-requirements.json` gains `"attackPerCaptured": [ { "set": "co2e", "group": "enemies-of-asgard", "card": "enchantress", "kind": "bystander", "attackPerCard": 1 }, { "set": "co2e", "group": "sinister-spider-foes", "card": "venom", "kind": "hero", "attackPerCard": 1 }, { "set": "co2e", "group": "masters-of-evil", "card": "baron-zemo", "kind": "bystander", "attackPerCard": 1 } ]` and a `_doc` sentence for it.
- `apply-effect-markers.mjs`: the five tokens appended to its `VILLAIN_EFFECT_PRIMITIVES` copy; a hand-synced `VILLAIN_CAPTURE_PILES = ['officer', 'sidekick']` beside `CITY_SPACE_NAMES`, with the same loud-fail-on-drift `// why:`; explicit arms for the three parameterized primitives (without them the no-param tail would accept their bare tokens).
- `apply-defeat-requirement-markers.mjs`: reads the optional `attackPerCaptured` array (absent = empty); validates set / group / card strings, `kind` (hand-synced `['hero', 'bystander']`) and `attackPerCard` (positive integer), full-sentence loud-fail otherwise; locates the single ability line whose lower-cased text contains `[icon:attack] for each ` (0 or > 1 → loud-fail); appends ` [attack-per-captured:<kind>:<N>]` idempotently; `--propose` lists these rows; the L467 console banner names all three markers. Final line: `` `Done. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s), ${F} new [discard-to-fight:] marker(s) and ${A} new [attack-per-captured:] marker(s) appended.` ``
- `mechanic-provenance.json`: the five new primitives → `{ "wp": "WP-838", "decision": "D-24771" }`.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: five primitives, `VillainCapturePile` + array, `capturePiles`, `VillainCapturedKind` + array, `VillainAttackPerCaptured`.
- **B)** `setup/villainAbility.setup.ts` + test: three parser arms; the grammar doc list.
- **C)** `setup/villainDefeatRequirement.setup.ts` + test: `parseAttackPerCapturedLine` + `buildVillainAttackPerCaptured`; `setup/buildInitialGameState.ts` wiring; `types.ts` field; `setup/buildInitialGameState.shape.test.ts` omit-when-empty case.
- **D)** `villain/villainEffects.execute.ts` + test: five handlers, map entries, `villainCardGainsOneCapturedHero`.
- **E)** `board/heroCapture.logic.ts` + test: the four helpers and two interfaces.
- **F)** `moves/fightVillain.ts` + test: the Step 3c branch and its log lines.
- **G)** `economy/economy.resolve.ts` + test: the table-entry early return (either kind) and `villainCapturedCountBonus`.
- **H)** `villainDeck/villainDeck.reveal.ts` + test, `rules/tacticHandlers.ts` + `rules/tacticHandlers.test.ts`: the classifier rule.
- **I)** Client: `apps/arena-client/src/components/play/deckProbability.ts` + test.
- **J)** Card data: both marker scripts and maps, `co2e.json` regenerated, `mechanic-provenance.json`, regenerated villain ledger + effect index.

## Out of Scope

- **Baron Strucker's passive** ("+1 for each other HYDRA Villain in the city and/or Escape Pile"): today he fights for 6, unchanged by this packet. Variable-Attack class, a follow-up (Operator fork F1).
- **Other "+N for each Bystander he has" villains** (2099 Jigsaw 2099, msp1 Raza, dkcy Mr. Sinister / Blockbuster (+2) / Chimera (+3) / Scalphunter): each becomes one `attackPerCaptured` row later. Not marked here.
- **Interactive versions** of the four auto-resolved choices (Operator forks F2-F4).
- **Killbots interplay:** under Replace Earth's Leaders with Killbots, a supply Bystander Strucker shuffles in reveals as a Bystander, not a Killbot (D-24324 types only villain-deck Bystanders). Recorded residual.
- **The operator setter's `findFirstVillainDeckCard`** (`moves/operatorSetters.ts` L190-199, the debug pane) classifies by `villainDeckCardTypes` only, so it cannot bring a shuffled-in `pile-bystander` to the top. Debug-only, no gameplay effect; recorded residual.
- **Sidekick fidelity:** the engine's `pile-sidekick` is a 0 / 0 token with no play ability and no recruit move (co2e's Daring Sidekick prints +1 Attack and "Draw a card. Return this Sidekick to the bottom of the Sidekick Deck."). A Sidekick gained here is that token. Pre-existing gap; STATUS follow-up line.
- **The center-screen Ambush overlay** for keyword-less Ambush effects still reads "entered the city with no Ambush effect" (`composeAmbushNarrative`; Kidnappers and Venom here, already true for co2e Zemo / Whirlwind). Descriptor-keyed narration is WP-253. The log lines are correct.
- **Special Bystander rescue abilities** (co2e Police Officer, Kindly Caretaker, …): the engine treats every Bystander as identical, which is what makes the Enchantress auto-pick faithful today.
- **The final-turn latch** stays sticky when Strucker refills an exhausted Villain Deck (D-24159).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `setup/villainDefeatRequirement.setup.ts`, `setup/villainDefeatRequirement.setup.test.ts` — modified
- `setup/buildInitialGameState.ts` — modified (the builder call beside `buildVillainFightDiscardCosts` ~L443, the conditional spread beside ~L905)
- `setup/buildInitialGameState.shape.test.ts` — modified (T29)
- `types.ts` — modified (one field)
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `board/heroCapture.logic.ts`, `board/heroCapture.logic.test.ts` — modified
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified
- `economy/economy.resolve.ts`, `economy/economy.resolve.test.ts` — modified
- `villainDeck/villainDeck.reveal.ts`, `villainDeck/villainDeck.reveal.test.ts` — modified
- `rules/tacticHandlers.ts`, `rules/tacticHandlers.test.ts` — modified (one condition, one case)

**Client (`apps/arena-client/src/`)**
- `components/play/deckProbability.ts`, `components/play/deckProbability.test.ts` — modified (one condition, one case)

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs`, `scripts/convert-cards/inputs/villain-defeat-requirements.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (9 lines gain markers: 9 `[effect:]` + 3 `[attack-per-captured:]`)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/post-mortems/01.6-WP-838-co2e-capture-family.md` — new (mandatory per `01.6-post-mortem-checklist.md` L42-51: new primitives + a new setup-built `G` field), `docs/ai/DECISIONS.md` (D-24771), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 21 engine files (10 tests), 2 client files, 5 script / input files, 1 card-data file and 3 generated feeds. Above the ~10 guideline because four cards' seven lines span the parser, the executor, the captured-card store, the fight site, the fight-cost authority and the Villain-Deck classifier; splitting would ship Venom with a wrong cost or Strucker with a deck that can jam. Every file named above exists on the baseline.

## Contract

- The Locked Values above: the five primitives and their grammar, `capturePiles`, the two closed unions and their arrays, `VillainAttackPerCaptured`, `[attack-per-captured:<kind>:<N>]`, `G.villainAttackPerCaptured`, the four capture helpers, `villainCardGainsOneCapturedHero`, the fight-site branch, the fight-cost term, the classifier rule, and every log string.
- `executeVillainAbilities`, every existing handler, `captureHeroFromHq`, `awardAttachedHeroes`, `defeatCityVillainCore`, `resolveFightCost` and `performVillainReveal` keep their signatures. `descriptorKey` is unchanged. No move, move argument, pending choice, seat-choice kind or UIState field is added.

## Test Contract

Minimal-`G` fixtures in each file's existing style (`messages: []`, a `cardStats` entry per costed card, the reversing mock shuffle). Costed ids: `h-cost1` (1), `h-cost2a` / `h-cost2b` (2), `h-cost3` (3), `h-cost4` (4), `h-cost5` (5), `pile-sidekick` (2), `pile-shield-officer` (3). Each T-case is at least one `it`, grouped under one `describe('WP-838 …')` per file. T1 edits the five pins in `villainAbility.types.test.ts` (ordered list, length, last-member literal + position, L619, L652), plus the count in the L359 title and the L396 / L401 messages: a value change from an intended product change, said so in the commit body.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES`; `VILLAIN_CAPTURE_PILES`; `VILLAIN_CAPTURED_KINDS` | 36 members, the five last in locked order, parity passes; `['officer','sidekick']`; `['hero','bystander']` | runtime asserts (D-24372) |
| T2 | types | `descriptorToLegacyKeyword` of each new descriptor (one with `capturePiles`) | `undefined` each | `capturePiles` not in the key |
| T3 | setup | `capture-bystander-each-victory-pile`; `capture-pile-hero:officer+sidekick`; `capture-pile-hero:sidekick`; `capture-hq-heroes-cost-lte:2`; `gain-one-attached-hero-rest-to-bottom`; `shuffle-bystanders-into-villain-deck:4` | the matching descriptors (`capturePiles` `['officer','sidekick']` / `['sidekick']`; `magnitude` 2 / 4) | |
| T4 | setup | `capture-bystander-each-victory-pile:1`, `capture-pile-hero`, `capture-pile-hero:`, `capture-pile-hero:officer+officer`, `capture-pile-hero:wound`, `capture-pile-hero:officer:sidekick`, `capture-hq-heroes-cost-lte`, `…:0`, `…:x`, `gain-one-attached-hero-rest-to-bottom:1`, `shuffle-bystanders-into-villain-deck`, `…:0` | each unresolved (`unresolvedMarkers`) | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the four cards' lines copied **verbatim** from the regenerated `co2e.json` | Enchantress onAmbush `[captureBystander's descriptor, capture-bystander-each-victory-pile]`; Kidnappers onAmbush `capture-pile-hero ['officer','sidekick']`, onFight `gain-attached-hero`; Venom onAmbush `[capture-pile-hero ['sidekick'], capture-hq-heroes-cost-lte 2]`, onFight `gain-one-attached-hero-rest-to-bottom`; Strucker onFight `[shuffle 4, play-villain-deck-cards 2]`; no hook from either passive line; no `unresolvedMarkers` | |
| T6 | defeat setup | `buildVillainAttackPerCaptured` over mock groups with Enchantress, Venom and co2e Baron Zemo (`copies: 2`, the regenerated passive lines) + a plain villain | 6 entries (both copy ids each): Enchantress and Zemo `{ kind: 'bystander', attackPerCard: 1 }`, Venom `{ kind: 'hero', attackPerCard: 1 }`, fresh objects; plain villain absent | |
| T7 | defeat setup | lines `[attack-per-captured:hero]`, `…:hero:0`, `…:wound:1`, `…:hero:1:2`, `…:hero:x` | no entry each | inert, never throws |
| T8 | executor | `capture-bystander-each-victory-pile` onAmbush for `ench-01`; victory `0: [villain-a, pile-bystander]`, `1: [bystander-villain-deck-03, pile-bystander]`, `2: [villain-b]` | `attachedBystanders['ench-01']` = `['pile-bystander', 'bystander-villain-deck-03']`; victory `0: [villain-a]`, `1: [pile-bystander]`, `2` unchanged; log `Ambush effect: captured a Bystander from the Victory Pile of Player 0, Player 1.` `applied` | sorted seats, pile order |
| T9 | executor | same with no Bystander in any Victory Pile | the `no player had a Bystander` line `blocked`; no `attachedBystanders['ench-01']` key | |
| T10 | executor | Enchantress's full onAmbush via `executeVillainAbilities` (both descriptors), supply `[pile-bystander ×3]`, victory as T8 | attached `['pile-bystander', 'pile-bystander', 'bystander-villain-deck-03']` (supply first); supply length 2; one result (`captureBystander`) | marker order |
| T11 | executor | `capture-pile-hero ['officer','sidekick']` for `kid-01`; officers `[pile-shield-officer ×2]`, sidekicks `[pile-sidekick]` | `villainAttachedHeroes['kid-01']` = `['pile-shield-officer']`; officers length 1; sidekicks unchanged; the `captured … from the S.H.I.E.L.D. Officer Deck.` line | |
| T12 | executor | officers `[]`; then both empty | the Sidekick captured from the `Sidekick Deck`; then the `nothing was captured because the S.H.I.E.L.D. Officer Deck and the Sidekick Deck are empty.` line `blocked`, no entry key | |
| T13 | executor | `capture-hq-heroes-cost-lte` 2 for `venom-01`; hq `[h-cost1, h-cost3, h-cost2a, h-cost4, h-cost2b]`, heroDeck `[d-cost1, d-cost2, h-cost5]` (stats given) | attached `[h-cost1, h-cost2a, h-cost2b]`; hq `[d-cost1, h-cost3, d-cost2, h-cost4, h-cost5]`; heroDeck `[]`; log `Ambush effect: captured h-cost1, h-cost2a, h-cost2b from the HQ (cost 2 or less).` | refilled `d-cost1` / `d-cost2` not captured (snapshot) |
| T14 | executor | an HQ with no Hero costing ≤ 2 (one id with no `cardStats`) | HQ unchanged; the `no Hero in the HQ costs 2 or less` line `blocked` | no `?? 0` capture |
| T15 | executor | Venom's full onAmbush via `executeVillainAbilities`, sidekicks `[pile-sidekick]`, hq as T13; then sidekicks `[]` | attached `['pile-sidekick', h-cost1, h-cost2a, h-cost2b]`; then the HQ three plus the `the Sidekick Deck is empty` line | |
| T16 | executor | `shuffle-bystanders-into-villain-deck` 4 onFight with the reversing shuffle; supply `[pile-bystander ×6]`, deck `[v1, v2]` | supply length 2; deck = reverse of `[v1, v2, pile-bystander ×4]`; the `shuffled 4 Bystander(s)` line `applied` | |
| T17 | executor | supply 2 → 2 shuffled; supply 0 (shuffle spy) → blocked, deck unchanged, Shuffle not called; no `shuffleContext` → blocked, piles unchanged | the three locked lines | |
| T18 | executor | the `gain-one-attached-hero-rest-to-bottom` handler; `villainCardGainsOneCapturedHero` for Venom hooks, a `gain-attached-hero` villain, a `G` without hooks | `G` deep-equal; `true` / `false` / `false`; an `executeVillainAbilities` onFight run on a Venom hook records an effect trace with `status: 'no-op'` (precedent `villainDeck.reveal.test.ts` L1164) | |
| T19 | capture | `captureHeroFromHqSlot` on an occupied slot, an empty slot, index 9; the existing `captureHeroFromHq` tests | result + refill; `null`; `null`; existing tests pass unchanged | |
| T20 | capture | `selectCapturedHeroToGain` on `[pile-sidekick, h-cost2a, h-cost1]`, `[pile-sidekick, h-cost1]`, `[h-cost2a, h-cost2b]`, `[pile-sidekick]`, `[]` | 1; 1; 0; 0; -1 | |
| T21 | capture | `awardOneAttachedHeroRestToBottom` with attached `[pile-sidekick, h-cost2a, h-cost1]`; and with no entry | discard gains `h-cost2a`; `heroDeck` ends `…, h-cost1`; `sidekicks` ends `…, pile-sidekick`; entry deleted; outcome `{ gainedHeroId: 'h-cost2a', returnedToBottom: [{pile-sidekick, sidekick-deck}, {h-cost1, hero-deck}] }`; no-entry → `{ null, [] }`, `G` unchanged | capture order |
| T22 | fightVillain | Venom (onFight `gain-one-…`, attached as T21) fought | Venom in victory; only `h-cost2a` in the discard; logs `gained h-cost2a from …` then `… went to the bottom of the Sidekick Deck.` / `… Hero Deck.`; with nothing attached, the `had no captured Hero to gain` line | |
| T23 | fightVillain | Kidnappers (onFight `gain-attached-hero`, attached `[pile-shield-officer]`) fought | the Officer in the discard through the unchanged generic path and line | byte-identical generic path |
| T24 | fightVillain | Strucker alone in the City (onFight `[shuffle 4, play 2]`), deck `[v1]`, supply `[pile-bystander ×4]`, reversing shuffle | the shuffled deck is `[pile-bystander ×4, v1]`; the shuffle line precedes `plays the top 2 card(s)`; both played `pile-bystander`s are captured by the Mastermind (the City is empty after the defeat) with two `revealed and captured by` lines; deck after = `[pile-bystander ×2, v1]`; supply `[]` | shuffle before play; no fail-closed line |
| T25 | economy | dynamic base 5 flagged `{hero,1}` with attached `[pile-sidekick, h-cost2a, h-cost2b]`; the same unflagged | 8; 11 | cost sum replaced only when flagged |
| T26 | economy | dynamic base 5 flagged `{bystander,1}` with 3 attached Bystanders; same under `core/midtown-bank-robbery`; with none; flagged `{bystander,1}` with 1 Bystander and an attached `h-cost3` | 8; 11; 5; 6 | the cost sum is replaced for either kind |
| T27 | economy | static 4 (Kidnappers) with attached `[pile-shield-officer]` | 4 | static never moves |
| T28 | reveal | deck top `pile-bystander` (no map entry), City `[villain-x, …]`; and an unknown id `mystery-01` | `pile-bystander` attached to the lowest-index City villain, removed from the deck, `bystanderRevealed` pushed; `mystery-01` still fails closed (stays on top, existing line) | no write to `villainDeckCardTypes` |
| T29 | shape | `buildInitialGameState` with the existing mock registry (no marked villain) | no `villainAttackPerCaptured` key | omit-when-empty |
| T30 | tactic | Finding Zemo with `pile-bystander` in the top 5 | it is KO'd and counted in the KO line | |
| T31 | client | `categorizeVillainCard('pile-bystander')`; `summarizeVillainDeck` over `['pile-bystander', 'bystander-villain-deck-01', 'co2e-villain-hydra-viper-01']` | `'bystander'`; bystander 2, villain 1 | |

## Operator forks

| # | Fork | Default (drafted) | Alternative |
|---|---|---|---|
| F1 | Fight cost for this packet's capturers | **In scope for Venom and Enchantress** through one table (Context). Strucker's HYDRA-count passive stays out. | Venom only (Enchantress keeps today's 5 — the D-24333 Zemo posture), or ship captures with a documented interim cost (not recommended: Venom would fight for the cost sum). |
| F2 | Enchantress "(of that player's choice)" | **Auto: the first Bystander in pile order** (D-24749). Every Bystander is 1 VP and the engine implements no rescue abilities, so the pick cannot change the outcome today. | An Ambush-timed multi-seat seat choice once WP-837 lands that opener (worth it only when special-Bystander rescue abilities ship). |
| F3 | Kidnappers "Officer Deck or Sidekick Deck" | **Officer first, Sidekick when no Officer is left** (L3199-3201: only a doable option). The fighter later gains the card; the Officer (cost 3, +2 Recruit) dominates the engine's 0 / 0 Sidekick token. The fight cost is static, so the pick never changes it. | A current-player pick (a pending choice: block-all guards, a resolve move, a prompt). |
| F4 | Venom "You may gain a Hero" | **Auto-take** (D-24350: a beneficial "may" auto-takes) **the highest-cost non-Sidekick card, the earliest on a tie; the Sidekick only when it is the only card.** The engine's Sidekick is a 0 / 0 token with no play ability (Out of Scope), so ranking it at its printed cost 2 would gain a dead card and bury a playable Hero (the F3 argument). | Card-faithful cost ranking with a non-Sidekick tie-break (right once the Sidekick's play ability ships), or a current-player pick (same cost as F3). |
| F5 | Kidnappers "Choose a player to gain that Hero" | **The fighter** (the D-24329 / D-24335 "choose a player → current player" collapse) through the generic award, marked `gain-attached-hero`. | none proposed |
| F6 | co2e Baron Zemo's identical "+1 per Bystander he has" | **In scope: one `attackPerCaptured` data row**, no code. His Ambush already captures Bystanders (WP-521) and he fights at 4 today; D-24333 parked the passive until a mechanism existed. | Drop the Zemo row (he stays at 4, the D-24333 posture). |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the three co2e groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). These villains now capture, cost more as they hold cards, and Strucker grows the Villain Deck, so those legs change difficulty. No committed `data/par` artifact references the groups (Assumes 15), so nothing is re-pinned; a future PAR run picks up the new behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- `G.villainAttackPerCaptured` is omit-when-empty; a match without co2e Enchantress, Venom or Baron Zemo never creates it. No `villainDeckCardTypes` write.
- Strucker's shuffle is the only new randomness, through the fight site's `ShuffleProvider`, and only when a Bystander actually moves. Every other selection is positional or cost-ordered.
- `getLegalMoves` reads `resolveFightCost` already; its output changes only for the two flagged villains. Narration goes to hash-excluded `G.messages` (D-24081). `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 15); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks and tables, so a pre-WP-838 match (no new markers, no table) replays identically; the reveal fallback is reached only by a `pile-bystander` in the Villain Deck, which no pre-WP-838 match can contain. This packet's runtime changes reached by pre-deploy state are byte-identical there:
  - `captureHeroFromHq`'s delegation to `captureHeroFromHqSlot` (existing tests unchanged, T19);
  - the `resolveFightCost` term and early return (both inert without `G.villainAttackPerCaptured`);
  - the Step 3c predicate (false without the new primitive);
  - the Finding Zemo / reveal fallback (no pre-WP-838 code path puts `pile-bystander` into the Villain Deck).

  Matches created before the deploy, including ones in progress, keep the old behavior; live-verify on a match created after the deploy. Recorded in D-24771.

## Funding Surface Gate

§20 **N/A**: engine, card data and one client display helper. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T7 pass. Both scripts accept the Locked-Values tokens (Verification 3). The marker script runs `main()` on import, so its rejection side is checked by hand: put each T4 token into the marker map one at a time, run the script, observe a loud failure, revert; and put `"kind": "wound"` and `"attackPerCard": 0` into the requirement map one at a time. Record the observed failures in the EC-876 commit body.
2. **Types.** T1-T2 pass as runtime assertions.
3. **Enchantress.** T8-T10 and T26 pass.
4. **Kidnappers.** T11-T12, T23 and T27 pass.
5. **Venom.** T13-T15, T18-T22 and T25 pass.
6. **Strucker.** T16-T17, T24, T28 and T30 pass.
7. **Setup.** T6, T7 and T29 pass; the wiring in `buildInitialGameState` is verified live (Definition of Done).
8. **Client.** T31 passes; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
9. **Data.** `apply-effect-markers.mjs` reports the 9 new `[effect:]` markers for `co2e.json` (record the printed line) and re-runs at 0; `apply-defeat-requirement-markers.mjs` prints `… 0 new [require-to-defeat:] marker(s), 0 new [discard-to-fight:] marker(s) and 3 new [attack-per-captured:] marker(s) appended.` and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, and only the 9 lines in §Goal, each gaining trailing markers.
10. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps; the last three need no regeneration.
11. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
12. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json` the four `(unmarked)` rows are replaced by nine `executable` rows: Enchantress `captureBystander` + `capture-bystander-each-victory-pile`; Kidnappers `capture-pile-hero` + `gain-attached-hero`; Venom `capture-pile-hero` + `capture-hq-heroes-cost-lte` + `gain-one-attached-hero-rest-to-bottom`; Strucker `shuffle-bystanders-into-villain-deck` + `play-villain-deck-cards`. The five new mechanics carry WP-838 / D-24771 provenance; no other row changes.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs` then `node scripts/convert-cards/apply-defeat-requirement-markers.mjs`; re-run both → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json` (`cards:check` excludes co2e, D-24443, so this re-run is the co2e idempotency proof).
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last three flags, STOP: Assumes 15 is false.
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: drop the table-entry early return in `resolveBaseFightCost` (T25; T26 case 4); route Venom through `awardAttachedHeroes` (T22); remove the `BYSTANDER_EXT_ID` fallback in `resolveRevealedCardType` (T24 or T28); make `capture-hq-heroes-cost-lte` re-scan the HQ after each refill (T13); drop `villainCapturedCountBonus` from `costBeforeReduction` (T25 / T26).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24771 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, with follow-up lines for the Sidekick token gap, the keyword-less Ambush overlay and Strucker's passive.
- [ ] `docs/ai/post-mortems/01.6-WP-838-co2e-capture-family.md` written per `01.6-post-mortem-checklist.md` (mandatory: new primitives + a new setup-built `G` field).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-876:` then `SPEC:`.
- [ ] **Hash oracles** (`finalStateHash`, `PRE_WP080_HASH`) byte-unchanged; no fixture plays the co2e groups (Assumes 15).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, with `/api/version` showing a gitSha that contains the merge, in a match created after the deploy with `co2e/hydra`, `co2e/enemies-of-asgard` and `co2e/sinister-spider-foes` as Villain Groups (and `co2e/masters-of-evil` in the same or a second match) driven via the operator setter pane or `/api/match/autoplay` setupData:
  - Enchantress's Ambush logs the deck capture and `captured a Bystander from the Victory Pile of …` (or the blocked line), and her City fight cost reads 5 + her Bystanders;
  - Kidnappers' Ambush logs `captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.`, the City cost stays 4, and fighting them logs the Officer gained;
  - Venom's Ambush logs the captures, his City cost reads 5 + the captured count, and fighting him logs one card gained and the rest `went to the bottom of …`;
  - co2e Baron Zemo's City fight cost reads 4 + the Bystanders he captured;
  - fighting Baron Strucker logs `shuffled N Bystander(s) …` then `plays the top 2 card(s) …`, and a later revealed supply Bystander is captured, not stuck;
  - the Play Diagnostics snapshot shows no Hollow `unmarked-ability` record for these four villains.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24771 — co2e-capture-family.** It locks:
- the authorized contract-file change: `rules/villainAbility.types.ts` (five primitives appended, `capturePiles` outside `descriptorKey`, `VillainCapturePile` / `VILLAIN_CAPTURE_PILES`, `VillainCapturedKind` / `VILLAIN_CAPTURED_KINDS`, `VillainAttackPerCaptured`);
- `G.villainAttackPerCaptured` (setup-built, per copy, omit-when-empty) from `[attack-per-captured:<kind>:<N>]` on the printed passive line, produced by the defeat-requirement overlay; any entry replaces the dynamic captured-cost sum and adds `count × N` of its kind (captured Heroes or Bystanders); read only by `resolveFightCost`; rows for Enchantress, Venom and co2e Baron Zemo (the passive D-24333 parked, Operator fork F6);
- Enchantress's per-player choice auto-resolves to the first Bystander in pile order (D-24749); Kidnappers capture Officer-first (rules v23 L3199-3201); Venom's "may gain" auto-takes the highest-cost non-Sidekick card (earliest on a tie) and the Sidekick only when it is the only card, because the engine's Sidekick is a 0 / 0 token and ranking it at printed cost 2 would gain a dead card over a playable Hero (Operator fork F4; revisit when the Sidekick's play ability ships); the rest go to the bottom of their home deck in capture order; `gain-one-attached-hero-rest-to-bottom` joins `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` so its trace reads `no-op`; Kidnappers' "choose a player" is the fighter (D-24329 / D-24335);
- Venom's HQ capture is a snapshot taken before any refill (rules v23 L749-755 refills each slot immediately; a refilled Hero is not re-checked);
- Strucker shuffles first (executor, the fight site's `ShuffleProvider`), then the D-24351 bridge plays two; fewer than four Bystanders shuffles what there is; none spends no randomness;
- a Villain-Deck card's type is `villainDeckCardTypes[id]`, else `'bystander'` for `BYSTANDER_EXT_ID`; `G.villainDeckCardTypes` is never written at runtime for it; the reveal, Finding Zemo and the client's deck-odds bucket share the rule;
- the replay-compat note (pre-deploy state reaches only byte-identical paths: the `captureHeroFromHq` delegation, the inert cost term and early return, the false Step 3c predicate, the unreachable reveal / Finding Zemo fallback; matches created before the deploy, including ones in progress, keep the old behavior, so live-verify uses a match created after the deploy) and the recorded residuals (Killbots, Sidekick token, keyword-less Ambush overlay, Strucker's passive, the sticky final-turn latch, the operator setter's map-only classifier).

---

## Gate Record

**01.4 pre-flight (independent): NOT READY → PS-1 + RS-1..7 applied → READY TO EXECUTE (2026-10-25).** Report: `docs/ai/invocations/preflight-wp838-co2e-capture-family.md` (scratchpad). No re-run needed (scope-neutral).
- **PS-1:** `gain-one-attached-hero-rest-to-bottom` joins `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (Locked Values, T18 trace assertion, EC Locked Values + Required comments).
- **RS-1:** the dynamic-branch early return is kind-agnostic (any table entry); T26 gains a bystander-kind-with-a-Hero case.
- **RS-2 (adopted as the locked default, Operator fork F4):** Venom auto-takes the highest-cost non-Sidekick card; the Sidekick only when it is the only card. T20 case 2 → 1, plus a Sidekick-only case. Reason in D-24771.
- **RS-3:** the operator setter's `findFirstVillainDeckCard` is a recorded residual (Assumes 12, Context, Out of Scope, D-24771); allowlist unchanged.
- **RS-4:** one session; the "Strucker + classifier" split seam is named in Context.
- **RS-5:** baseline note for `461ed924` (`types.ts` +25 lines).
- **RS-6 (adopted as the locked default, Operator fork F6):** co2e Baron Zemo's `attackPerCaptured` row; AC 9 → 3 markers on 9 lines; T6 and live-verify extended.
- **RS-7:** the script's hand-synced `VILLAIN_CAPTURE_PILES`; the "31" in the L359 title and L396 / L401 messages; the third registry walk is copied, not refactored. The L467 overlay banner is updated in-allowlist.

**01.7 copilot (independent): RISK → RISK 1 + RISK 2 applied (2026-10-25).** Report: `docs/ai/invocations/copilot-wp838-co2e-capture-family.md` (scratchpad). Pre-flight READY stands; no re-run.
- **RISK 1 (#28, upgrade story):** the Replay-compat bullet and D-24771 list the runtime changes pre-deploy state reaches (all byte-identical there); the DoD and EC live-verify require a match created after the deploy, with `/api/version` showing the merge.
- **RISK 2 (#26, stale semantics after RS-1):** Scope (In) G, Verification 8, EC After Completing and EC Common Failure Smells now say "table-entry early return".
- Optional items applied: EC Before Starting names `expectedPrimitives` and the last-member assertion; the pre-flight report carries the "Pre-session actions — ALL RESOLVED" block; Dependencies names the #2998 / #3001 / #3004 stack as a line-shift rebase.
- Also added: the mandatory 01.6 post-mortem (`docs/ai/post-mortems/01.6-WP-838-co2e-capture-family.md`, new) in Files / DoD / EC / session prompt, and `workindex:rows:check` + `workindex:executed:check` in the close gates.

**00.3 lint (independent): PASS (2026-10-25).** It replaces the author self-review below.

## Lint Gate Self-Review (00.3)

Author self-review at draft; the independent 00.3 run replaces it.

| § | Result |
|---|---|
| §1 | PASS — every 01.0a Step 4 section present, plus User-Visible Surface / Impact, Constraints, Vision Alignment, Operator forks; Out of Scope has 10 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — Assumes 1-17 cite file + line for every seam the Locked Values touch (parser, executor, capture store, fight site, cost authority, reveal, Finding Zemo, client bucket, scripts, fixtures) |
| §4 | PASS — 00.2 §1.4 / §5, ARCHITECTURE sections, DECISIONS scan list, memory files |
| §5 | PASS — 32 files (+ governance), each marked modified or regenerated; count justified |
| §6 | PASS — group / card slugs match `co2e.json`; pile ids match `pilesInit.ts`; new names are full words |
| §7 | PASS — no new dependencies; soft ordering with WP-835..840 stated |
| §8 | PASS — engine decides; the client change is display-only, type-only toward the engine; `G` stays JSON; randomness only via `ShuffleProvider` |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures, reversing mock shuffle; hash oracles stand in for a golden |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, a diff-scope step, 5 revert proofs |
| §14 | PASS — 12 binary criteria tied to T1-T31 |
| §15 / §15.1 | PASS — STATUS (+ three follow-ups), DECISIONS, indexes, hash check and D-24026 live-verify on `play.legendary-arena.com` in DoD |
| §16 | PASS — 00.6 mandated; `attachCapturedHero` is extracted at its third use; the third registry walk in `villainDefeatRequirement.setup.ts` is a deliberate copy (pre-flight RS-7c); no premature abstraction |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

EC-876 vs EC-TEMPLATE: all sections present, within the 100-line ceiling, client typecheck gated in Before Starting and After Completing.
