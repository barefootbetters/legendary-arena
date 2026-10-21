# WP-817 — Captain Zolandia and Primus: a per-Hero-Class Recruit Fight, a discard-to-fight cost, and an every-player cost-filtered Escape discard (Game Engine + Arena Client + card data)

**Status:** Draft 2026-10-20 — READY TO EXECUTE (EC-855; **D-24750** reserved (#2934); pre-flight READY, copilot CONFIRM (RISK), 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ one Arena Client consumer of the new UIState field, card-data markers and the derived coverage feeds)
**Dependencies:** WP-816 ✅ (#2932, same marker map / parser / executor files). Builds on WP-292 / D-24076 (fight precondition table + marker overlay — the structural template for the fight cost), WP-383 / D-24184 + D-24185 (discard-to-play and the card-specific pre-commit precondition), WP-554 / D-24363 + D-24364 (every move precondition ships with its `getLegalMoves` mirror), WP-793 / D-24656 (the escape procedure and its every-player seat-choice discard), WP-684 / D-24501 (multi-seat seat choices), D-24529 / D-24694 (`countDistinctHeroClassesYouHave`, "Heroes you have" = hand + play), WP-750 / D-24574 (the client gates Fight on projected data), WP-541 / D-24350 (`gain-recruit-current`).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes two contract files (`rules/villainAbility.types.ts`, `ui/uiState.types.ts`), adds two villain primitives, a fight-precondition table, a `fightVillain` argument, a seat-choice kind and two UIState fields, and widens one ARCHITECTURE rule (the pre-commit precondition).
**Arc:** Cap 75th (ca75) completion arc, WP 4 (item 6 of the 2026-10-19 audit, auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `df738303` (WP-816 merged at `9dcde5f8`, the reserve at `30e4aa5c`). Re-read line anchors, the primitive count and test totals at execution.

---

## Goal

As a player fighting Arnim Zola's creations, I want Captain Zolandia and Primus to do what they print, so that the Zola's Creations group plays like the tabletop game instead of handing out free Victory Points.

| Card (`ca75/zolas-creations`) | Printed line (verbatim, `data/cards/ca75.json`) | Today | After this session |
|---|---|---|---|
| Captain Zolandia (6+, 2 copies) | `Fight: You get +1[icon:recruit] for each Hero Class you have.` | No marker; the Fight does nothing. Live matches `eyPOi5L-fAU` and `L_V3M3r0dLf` list it under Hollow effects (`villain unmarked-ability onFight no-handler`). | The fighter gains Recruit equal to the distinct Hero Classes among the cards in their hand and play area. |
| Primus (3, 2 copies) | `To fight Primus, you must also discard a card that costs 2, 3, 5, or 7.` | No marker; Primus is fought for 3 Attack with no discard. | Primus can be fought only by also discarding a hand card that costs 2, 3, 5 or 7. The player picks which card. |
| Primus | `Escape: each player discards a Hero that costs 2, 3, 5, or 7.` | No marker; the Escape does nothing. | Every player who holds such a Hero picks one and discards it; a player with none is logged. |

## User-Visible Impact

- Fighting Captain Zolandia logs `+N recruit` for the N Hero Classes you have.
- Primus's Fight button is disabled, with a reason, unless your hand holds a card that costs 2, 3, 5 or 7. Clicking it opens a short list of those cards; picking one fights Primus and discards that card.
- When Primus escapes, each player gets a "choose a Hero to discard" prompt listing only their 2/3/5/7-cost cards (the same prompt the escape procedure already uses). A bot-ally seat picks its cheapest; autoplay, sim and PAR take the first eligible card in hand order (`defaultOptionIndex` 0, `simulation/ai.seatChoice.ts` L1-22).

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L3436-3446: "Your Heroes" / "Heroes you have" include the cards in your hand and the cards you played this turn; deck and discard don't count.
   - L1274-1281: the five Hero Classes; grey cards like S.H.I.E.L.D. Agents have no Hero Class; it doesn't matter how many cards of one class you have.
   - L2910-2911: basic Heroes include the starting S.H.I.E.L.D. Heroes and S.H.I.E.L.D. Officers; "They all count as Heroes".
   - L556-570: an escape runs, in order, (1) HQ KO of a Hero costing 6 or less, (2) every player discards a card if Bystanders were carried away, (3) the Escape effect.
2. **Card text and markers on the baseline.** `data/cards/ca75.json` `zolas-creations` (group id 40, `ledBy: ["arnim-zola"]`) prints the three lines in §Goal verbatim. `scripts/convert-cards/inputs/villain-effect-markers.json` L76-79 marks only Doughboy (`koHeroCurrentPlayer`) and Man-Fish (`gain-wound:each-other@sewers+bridge`, `gainWoundEachPlayer`) in that group. `primus-vand` (L317, wwhk) is a different card and is not touched. The ledger rows `ca75-villain-zolas-creations-captain-zolandia` and `…-primus` are `(unmarked)` (`docs/ai/coverage/villain-mechanic-ledger.csv` L98 / L107).
3. **The villain effect pipeline is marker-only and timing-line-only.** `setup/villainAbility.setup.ts` builds hooks only for `Fight:` / `Ambush:` / `Escape:` / `Overrun:` lines (`extractEffects` L807; `parseParameterizedEffect` L356 splits `!` then `@`; `parseUngatedEffect` L456; the no-param tail L788 returns `{ primitive }` for a 1-part token; `parsePositiveInteger` L225). Primus's "To fight Primus…" line has no timing prefix, so it produces no hook and no hollow record (`detectVillainUnmarkedTimingLine`, `villain/villainEffects.execute.ts` ~L526).
4. **Fight preconditions have their own table and marker overlay.** `setup/villainDefeatRequirement.setup.ts` reads `[require-to-defeat:<kind>:<value>]` from any ability line (L59-60 regex, `buildVillainDefeatRequirements`, fanned out per copy via `villainCardInstanceExtIds`), builds `G.villainDefeatRequirements`, wired omit-when-empty at `setup/buildInitialGameState.ts` ~L870-874. `moves/villainDefeatRequirement.logic.ts` holds the boardgame.io-free gate helpers `fightVillain.ts` (L178-184) and `simulation/ai.legalMoves.ts` (~L1082-1088) both call. The producer is `scripts/convert-cards/apply-defeat-requirement-markers.mjs` reading `scripts/convert-cards/inputs/villain-defeat-requirements.json` (`requirements` array, 3 entries); it locates a line by an inline `[<kind>:<value>]` token, appends idempotently, and is stage 4 of `scripts/check-card-data-regen.mjs` (L61).
5. **`fightVillain` today** (`moves/fightVillain.ts`): args `{ cityIndex, useExcessiveViolence? }` (L89-100; plus `payToRescueBystander?` if WP-819 executed first — keep it, and put this packet's discard before its rescue decision); step 1 validates index, Guard, fight cost, defeat requirement (L122-184); step 2 stage gate + block-all guards (L189-250); step 3 `defeatCityVillainCore` (L261), the Excessive Violence check and the single `spendFightCostForTarget` debit (L267-287). The only client sender is `apps/arena-client/src/components/play/CityRow.vue` `onFight` (L178-180) and `onFightEV` (L202-209). `getLegalMoves` emits `{ name: 'fightVillain', args: { cityIndex } }` (~L1100).
6. **Discards route through one chokepoint.** `moves/discardFromHand.ts` `discardFromHand(G, playerID, cardId): boolean` is the only card-effect hand→discard mutation (drift test `moves/discardFromHand.test.ts`); it fires return-on-discard / teleport-on-discard and the discarded-this-turn counter. A non-active seat's return-on-discard is already handled (WP-793 `RETURN_ON_DISCARD_SEAT_CHOICE_KIND`).
7. **Card cost read.** `hero/splitCard.logic.ts:130` `offPlayCardStats(G, cardId)` returns the off-play stat view (a split card's cost is face a's, both faces print the same cost); `G.cardStats` holds heroes, S.H.I.E.L.D. Agent / Trooper (cost 0), Officer (3) and Sidekick (2) (`setup/buildInitialGameState.ts` L515-531). A Wound has no `cardStats` entry.
8. **Hero Class count.** `hero/heroConditions.evaluate.ts:596` `countDistinctHeroClassesYouHave(G, playerID)` (exported) counts distinct printed classes over hand (off-play view, both split halves) plus `playedCardIdsStillInPlay` (printed `heroClass` / `heroClass2`, granted and copied classes). Its imports (L14-22) do not reach `villain/`, so the executor may import it without a cycle.
9. **`gain-recruit-current`** (D-24350): executor `villainEffectGainRecruitCurrent` (~L2535) adds `descriptor.magnitude ?? 1` to `G.turnEconomy.recruit` and self-narrates `` `${label} effect: gained +${N} recruit.` `` with `label = villainEffectTimingLabel(timing)` (L1808). Handler map `VILLAIN_EFFECT_HANDLERS` L3876 (`Record<VillainEffectPrimitive, VillainEffectHandler>`).
10. **Primitive vocabulary.** `VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` L432-471) hold **29** members, last `ko-bystander-each-victory-pile`; `villainAbility.types.test.ts` L354-391 pins 29 and parity. `descriptorKey` = `primitive|target|magnitude|selector`. `VillainDefeatRequirement` / `VILLAIN_DEFEAT_REQUIREMENT_KINDS` sit at ~L700-745.
11. **Escape fire order** (`villainDeck/villainDeck.reveal.ts`): `enqueueEscapeProcedure` (L646) runs before `executeVillainAbilities(…, 'onEscape', …)` (L661-675), the single onEscape fire site. Steps 1-2 open after the move from `openEscapeProcedureSeatChoiceIfNeeded` (`villainDeck/villainEscapeProcedure.ts` L260), called by `game.ts` `turn.onMove` (L889), `simulation/simulation.runner.ts` (L703, L805), `simulation/par.aggregator.ts` (L778, L861) and the fixture runner. Its loop returns while any choice is open (`hasAnyPendingChoice`, `pendingHeroChoice`) or the match is decided, and on an empty queue does `delete G.pendingEscapeProcedures; return;`.
12. **The every-player discard seat choice exists.** `buildEscapeBystanderDiscardChoice` (L213-240: sorted seats with a card in hand, one option per hand card in hand order, `defaultOptionIndex: 0`), `openEscapeBystanderDiscardStep` (~L340-367, the active-seat-only ride rule, D-24656 point 3), `applyEscapeBystanderDiscard` (L404-423: ascending seats, `discardFromHand`, one log line per seat). `moves/seatChoice.resolve.ts` dispatches by `choice.kind` (~L454); `simulation/ai.seatChoice.ts` L109 picks `indexOfLeastValuableCard` (L276: a Wound first, else the lowest `cardStats` cost, ties keep the earliest) for the two discard kinds; `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` maps `kind` → heading (~L100-118). `PendingSeatChoice` (`types.ts` L1385-1414) `kind` is a free `string`.
13. **Escape queue consumers.** `G.pendingEscapeProcedures` is also read by `endgame/mastermindVictory.logic.ts:99` (end-of-game drop set) and `moves/operatorSetters.logic.ts:78` (board-busy guard). `PendingEscapeProcedure` is `types.ts` L1523.
14. **City and hand projection.** `ui/uiState.build.ts` L860-884 builds each `UICityCard` (`fightCost` from `resolveFightCost`); `ui/uiState.filter.ts` `deepCopyCitySpaces` (L96-121) rebuilds it field by field (the whitelist). `UICityCard` is `ui/uiState.types.ts` L605. The viewer's own `UIPlayerState.handCards` / `handDisplay` (L466 / L479, index-aligned, built at `uiState.build.ts` ~L712-718 / L806, owner-only copy at `uiState.filter.ts` ~L321-327) reach `PlayDesktop.vue` / `PlayMobile.vue` as `viewer` (L424 / L242). Both pages mount `CityRow` (L907 / L599). `UICardDisplay.cost` is the **printed** cost (`number | null`, L388) and is `null` for `pile-shield-officer` and `pile-sidekick` (`setup/buildCardDisplayData.ts` L861-880), whose `G.cardStats` costs are 3 and 2, so the client cannot test eligibility from `display.cost`. `CityRow`'s slash gesture (L242-248) reuses `gateForCityIndex` and submits through `onFight`.
15. **Marker scripts keep hand-synced copies.** `scripts/convert-cards/apply-effect-markers.mjs` `VILLAIN_EFFECT_PRIMITIVES` (L170), `isValidParameterizedEffectToken` (L245-~380, the `gain-recruit-current` arm ~L370). `scripts/villain-mechanic-ledger.mjs` names a mechanic by the token before the first `:` after stripping `!` / `@` (WP-816), reads only `[effect:…]`. `scripts/coverage/mechanic-provenance.json` keys villain primitives (L67, L75).
16. **No hashed fixture or PAR artifact plays `zolas-creations`.** Per WP-816 Assumes 14 it appears only in `setup/buildCardAbomination.test.ts` (inline lines), `packages/registry/src/gauntletLoadouts.generated.ts` and `content/themes/red-skull-classic.json`. The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic.
17. **Log, choice and import seams.** `log/logDisplay.ts` `formatCardRef` (L128) / `resolveCardName` (L29), `log/logPush.ts` `pushLog` (L26), `moves/seatChoice.resolve.ts` `parkSeatChoice` (L256), `endgame/endgame.evaluate.ts` `evaluateEndgame` (L29) — all already imported by `villainEscapeProcedure.ts`; `fightVillain.ts` already imports `formatCardRef` / `pushLog`. New imports: `fightVillain.ts` ← `./discardFromHand.js`; `villainEscapeProcedure.ts` and `villainEffects.execute.ts` ← `moves/villainDefeatRequirement.logic.js`; `villainEffects.execute.ts` ← `hero/heroConditions.evaluate.js`; `uiState.build.ts` ← `hero/splitCard.logic.js` (`offPlayCardStats`). None creates an import cycle (`villainDefeatRequirement.logic.ts` imports only types and `hero/` trait helpers).
18. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24750) before coding.

## Context (Read First)

- **Coordination with WP-820** (drafted 2026-10-21, BLOCKED on WP-819): it adds a **Fight + Rescue** button to `CityRow.vue` that submits `fightVillain({ cityIndex, payToRescueBystander: true })`. If WP-820 has executed when this packet runs, its `showRescueFight(cell)` also returns false for a cell whose card carries `fightDiscardCosts` (add `&& cell.card.fightDiscardCosts === undefined`), so the rescue control never bypasses the Primus discard chooser. This is a coordination line, not a scope change: `CityRow.vue` is already in this packet's allowlist.

- **Why Zolandia is a new no-param primitive.** "+1 Recruit for each Hero Class you have" is a count read, not a fixed magnitude; a separate primitive keeps `gain-recruit-current`'s `:N` grammar and handler untouched and needs no parser arm (Assumes 3). It reuses the one Hero Class counter the hero side uses, so Captain America's Avengers Assemble! and Zolandia can never disagree.
- **Why Primus's cost is a `fightVillain` argument, not a pending choice.** The fight discard is a cost paid to fight, checked before commit (D-24185 already admits card-specific pre-commit preconditions). A post-commit pending discard (the discard-to-play shape) can freeze the turn: an Excessive Violence ability or another queued choice can remove the last eligible card before the discard resolves, and the resolve move then no-ops forever. As an argument the discard and the fight are one atomic move; an invalid choice is a silent return with no mutation, and `getLegalMoves` mirrors the gate exactly (D-24364).
- **Why a fight-precondition table and its own marker.** The "To fight Primus" line has no timing prefix, so the `[effect:]` pipeline never sees it (Assumes 3). The `[require-to-defeat:]` table (Assumes 4) is the precedent for a fight precondition: a setup-built per-instance table read by the move, the bot and the projection. A discard cost is not a "have a Hero" requirement, so it gets a sibling table and marker (`[discard-to-fight:cost:…]`) built in the same setup file and produced by the same overlay script, rather than a third requirement kind.
- **Why the client sends the card.** The engine decides; the client submits intent. With the cost as an argument the client must name the card, so `CityRow` shows the viewer's eligible hand cards and submits the pick. The cost set is public card text, so it is projected on the City card. The viewer's hand costs are projected owner-only as `UIPlayerState.handCosts` from the same `offPlayCardStats` cost the engine gate reads, because the printed display cost is `null` for Officers and Sidekicks (Assumes 14) and would hide eligible cards (D-24574: the client gates on engine-projected data).
- **Why Primus's Escape is an owed seat choice.** "Each player discards a Hero that costs 2, 3, 5, or 7" is the rulebook escape step 2 (every player discards) with a cost filter, and WP-793 already opens step 2 as a multi-seat seat choice after the move. The onEscape handler cannot park a seat choice (the executor has no `events`), so it records the owed discard on a new lazy queue that the same opener drains after the escape procedure. This **amends** D-24656 point 4, which kept step 3 inline so the escaping Villain's Escape resolves before the new Villain's Ambush (rules v23 L573-575): this one Escape effect, because it needs a multi-seat choice, resolves after the move and so after that Ambush. Every other Escape effect stays inline. The cost is one rare ordering deviation (Primus escaping while the revealed Villain's Ambush also touches hands); the alternative is a turn-engine change to park multi-seat choices mid-move.
- **"A card" (fight) and "a Hero" (escape) use one predicate.** The only hand cards that are not Heroes are Wounds (no cost, never eligible) and, transiently, nothing else in a reachable hand; Officers and Sidekicks count as Heroes (Assumes 1). So "its off-play cost is one of the listed costs" is faithful for both lines.
- **Split vs one WP.** The parent brief asked for one packet. The three lines share one card, one marker map, one parser / executor pair and one cost predicate; splitting the Escape out would ship a half-implemented Primus. The file count is above the ~10 guideline (justified in §Files Expected to Change).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape), §5 (printed markup; `[effect:]` and `[require-to-defeat:]` are pipeline-appended engine markers documented in the marker map `_notes` and the requirement map `_doc`).
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract (D-24185), §Zone & Pile Structure, Persistence Boundaries (`G` runtime-only), §The Rule Execution Pipeline, §Architectural Principles #2 (Engine Owns Truth).
- `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step field contract, D-12803) and §Layer Boundary (arena-client imports only the `.` engine surface, so the client keeps its own cost-list formatter).
- `docs/ai/DECISIONS.md`: scan D-24023, D-24034, D-24076, D-24081, D-24184, D-24185, D-24350, D-24363, D-24364, D-24501, D-24529, D-24574, D-24648, D-24656, D-24694, D-24749, D-24372 before coding.
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_villain_effect_vocabulary_extension`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_injected_seam_hides_missing_wiring`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24750) before coding. One WP per session.

**Packet-specific:**
- **One cost predicate.** Every eligibility test (fight gate, bot pick, escape builder) calls `isHandCardCostOneOf`. No inline cost scan anywhere else in the engine.
- **Gate before commit, mirror in the bot.** The fight discard check sits in `fightVillain` step 1, after the defeat-requirement check, before any `G` write. `getLegalMoves` makes the same decision with the same helpers in the same packet (D-24364).
- **Byte-identical for every other villain.** A villain with no discard cost ignores `discardCardId`; `getLegalMoves` emits `{ cityIndex }` only for it; no `G` field appears in a match without Primus. Hash oracles stay unchanged.
- **Data, not English.** No parser reads the printed English. Behavior comes only from the three markers in Locked Values.
- **Markers only.** Regenerate card data with `apply-effect-markers.mjs` and `apply-defeat-requirement-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** Each new keyword-less outcome logs through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen.
- **Five-step UIState contract** for `UICityCard.fightDiscardCosts` and `UIPlayerState.handCosts` (`.claude/rules/architecture.md`).
- **Fight cost only.** Only `fightVillain` pays the discard cost; card-effect defeats that reach `defeatCityVillainCore` directly (`moves/defeatChoice.resolve.ts` ~L230, Silent Sniper) do not ("To fight Primus" is a cost of fighting).

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order: `'gain-recruit-current-per-hero-class'` (position 30), `'discard-hero-each-player-by-cost'` (position 31). 29 → 31, re-read at execution.
- `VillainEffectDescriptor.eligibleCosts?: readonly number[]` — present only on `discard-hero-each-player-by-cost`; strictly ascending non-negative integers; **not** part of `descriptorKey`.
- `export interface VillainFightDiscardCost { eligibleCosts: number[]; }` next to `VillainDefeatRequirement`, with JSDoc: the costs a card discarded to fight this villain may have; built at setup from `[discard-to-fight:cost:<costs>]`; immutable during play.

**State (`types.ts`):**
- `LegendaryGameState.villainFightDiscardCosts?: Record<CardExtId, VillainFightDiscardCost>` — omit-when-empty, built at setup, never written by a move.
- `export interface PendingEscapeEffectDiscard { escapedCardId: CardExtId; eligibleCosts: number[]; }`; `LegendaryGameState.pendingEscapeEffectDiscards?: PendingEscapeEffectDiscard[] | undefined` — lazy FIFO, created at the park site, deleted when empty.

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `gain-recruit-current-per-hero-class` — no params (the existing no-param tail). Any param → null.
- `discard-hero-each-player-by-cost:<c>[+<c>…]` — exactly 2 `:` parts; the second splits on `+` into ≥ 1 tokens, each matching `^(0|[1-9][0-9]*)$`, strictly ascending (a duplicate or a descent → null) → `{ primitive: 'discard-hero-each-player-by-cost', eligibleCosts: [...] }`. No `@` / `!` suffix is used on these markers (none is rejected beyond the existing rules).
- Fight cost marker `[discard-to-fight:cost:<c>[+<c>…]]` — same cost-list grammar. Parsed by a new `parseFightDiscardCostLine` in `setup/villainDefeatRequirement.setup.ts`; malformed → no entry (inert, the require-to-defeat discipline). First valid marker on any line of the card wins.

**Pure helpers (`moves/villainDefeatRequirement.logic.ts`, boardgame.io-free):**
- `getFightDiscardCost(state, cardId): VillainFightDiscardCost | null` — `state.villainFightDiscardCosts?.[cardId] ?? null`.
- `isHandCardCostOneOf(state, cardId, eligibleCosts): boolean` — `offPlayCardStats(state, cardId)?.cost`; `undefined` → false; else `eligibleCosts.includes(cost)`.
- `listEligibleHandCardsByCost(state, playerId, eligibleCosts): CardExtId[]` — the player's hand, hand order, filtered by `isHandCardCostOneOf`; missing zones → `[]`.
- `selectDefaultCostDiscardCard(state, playerId, eligibleCosts): CardExtId | null` — the lowest-cost eligible card, ties keep the earliest in hand order; none → null.
- `formatEligibleCostList(eligibleCosts): string` — `[2]` → `2`; `[2, 3]` → `2 or 3`; `[2, 3, 5, 7]` → `2, 3, 5, or 7` (comma list, Oxford comma, `or` before the last).

**`fightVillain` (`moves/fightVillain.ts`):**
- `FightVillainArgs.discardCardId?: CardExtId` (the card-id move-arg type, `coreMoves.types.ts:51` precedent; the runtime `typeof === 'string'` guard still applies) (JSDoc: required only when the fought villain has a fight discard cost; ignored otherwise).
- Step 1, immediately after the defeat-requirement check: when `getFightDiscardCost(G, cardId)` is non-null, return silently unless `discardCardId` is a non-empty string, is in `G.playerZones[ctx.currentPlayer].hand`, and `isHandCardCostOneOf(G, discardCardId, cost.eligibleCosts)`.
- Step 3, before `defeatCityVillainCore`: `discardFromHand(G, ctx.currentPlayer, discardCardId)`, then `pushLog(G, \`Player ${currentPlayer} discarded ${formatCardRef(G.cardDisplayData, discardCardId)} to fight ${formatCardRef(G.cardDisplayData, cardId)}.\`, 'applied')`.
- With no discard cost, `discardCardId` is never read past the type: no discard, no log line.

**`getLegalMoves` (`simulation/ai.legalMoves.ts`), fight branch:** after the defeat-requirement `continue`, when `getFightDiscardCost` is non-null: `selectDefaultCostDiscardCard(gameState, activePlayer, cost.eligibleCosts)`; null → `continue`; else push `{ name: 'fightVillain', args: { cityIndex, discardCardId } }` when affordable. Otherwise the existing `{ cityIndex }` push, unchanged.

**Zolandia handler (`villainEffectGainRecruitCurrentPerHeroClass`, executor):** `count = countDistinctHeroClassesYouHave(G, currentPlayer)`; `G.turnEconomy.recruit += count`; when `count > 0`: `` `${label} effect: gained +${count} recruit for the ${count} Hero Class(es) you have.` `` `'applied'`; when 0: `` `${label} effect: you have no Hero Classes in hand or play, so no recruit was gained.` `` `'blocked'`. Returns `{ targets: [] }`.

**Primus Escape handler (`villainEffectDiscardHeroEachPlayerByCost`, executor):** `descriptor.eligibleCosts` missing or empty → `` `${label} effect: no discard costs were given; no effect.` `` `'blocked'`, `{ targets: [] }`. Otherwise push `{ escapedCardId: cardId, eligibleCosts: [...descriptor.eligibleCosts] }` onto `G.pendingEscapeEffectDiscards` (lazy-init), log `` `${label} effect: each player must discard a Hero that costs ${formatEligibleCostList(costs)}.` `` `'applied'`, return `{ targets: [] }`.

**Escape opener (`villainDeck/villainEscapeProcedure.ts`):**
- `export const ESCAPE_EFFECT_COST_DISCARD_KIND = 'escape-effect-cost-discard';`
- In `openEscapeProcedureSeatChoiceIfNeeded`, the empty-queue branch becomes `delete G.pendingEscapeProcedures; break;`; after the `while`, call `openEscapeEffectDiscardIfNeeded(G, events, currentPlayer)`. Every other `return` in the loop is unchanged (so the effect queue never opens while escape steps 1-2 are owed or any choice is open).
- `openEscapeEffectDiscardIfNeeded`: loop while `G.pendingEscapeEffectDiscards !== undefined`: empty → `delete`, return; `hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined` → return; `evaluateEndgame(G) !== null` → return; shift the front (delete the field when it empties); open its step; a parked choice → return.
- `buildEscapeEffectCostDiscardChoice(G, entry)`: seats `Object.keys(G.playerZones).sort()`; per seat `listEligibleHandCardsByCost`; none → `pushLog(G, \`Escape effect: Player ${seat} has no Hero that costs ${costList} to discard.\`, 'blocked')`; else addressed, options in hand order labelled `` `${resolveCardName(G.cardDisplayData, id)} (cost ${cost})` `` with `cardId`. No addressed seat → undefined. `kind: ESCAPE_EFFECT_COST_DISCARD_KIND`, `defaultOptionIndex: 0`.
- Opening uses the step-2 ride rule verbatim (active-seat-only → `parkSeatChoice(G, events, choice, currentPlayer)`; else `parkSeatChoice(G, events, choice)`).
- `applyEscapeEffectCostDiscard(G, choice)`: ascending seats, `discardFromHand`, on success `` `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Escape effect).` `` `'applied'`.
- Dispatch: `seatChoice.resolve.ts` `if (choice.kind === ESCAPE_EFFECT_COST_DISCARD_KIND) { applyEscapeEffectCostDiscard(G, choice); return; }` beside the bystander-discard arm. Bot: `ai.seatChoice.ts` adds the kind to the `indexOfLeastValuableCard` branch.
- `endgame/mastermindVictory.logic.ts` sets `gameState.pendingEscapeEffectDiscards = undefined` beside L99, and `endgame/mastermindVictory.logic.test.ts` `ALL_PENDING_FIELDS` (L119-131) gains `'pendingEscapeEffectDiscards'` (the file's own drift rule, L115-118). `moves/operatorSetters.logic.ts` adds `if ((G.pendingEscapeEffectDiscards?.length ?? 0) > 0) return true;` beside L78, and `moves/operatorSetters.test.ts` `GATE_BLOCKERS` gains a `'pendingEscapeEffectDiscards is non-empty'` row (the L208-214 precedent).

**UIState:**
- `UICityCard.fightDiscardCosts?: number[]` — the public printed cost set, set from `G.villainFightDiscardCosts?.[space]?.eligibleCosts` (a fresh copy) only when present; passed through `deepCopyCitySpaces` with a conditional spread (never a literal `undefined`).
- `UIPlayerState.handCosts?: (number | null)[]` — index-aligned with `handCards`, each `offPlayCardStats(gameState, id)?.cost ?? null`, built beside `handDisplay`; owner-only exactly like `handCards` / `handDisplay` (omitted for other players and spectators, copied with the same conditional assignment).

**Client (`apps/arena-client`):**
- `CityRow.vue` props `viewerHandCards: string[]`, `viewerHandDisplay: UICardDisplay[]` and `viewerHandCosts: (number | null)[]` (all default `[]`, index-aligned). Eligible = indices where `viewerHandCosts[i]` is a number in `fightDiscardCosts`; `viewerHandDisplay` supplies names only.
- The slash gesture never fights a discard-cost villain: `gateForCityIndex` returns false when `cell.card.fightDiscardCosts` is present (click only, so the chooser never opens mid-stroke).
- Gate order in `gateForCell`: stage → heal lock → cost → **discard**: card has `fightDiscardCosts` and no eligible card → `{ allowed: false, reason: \`Needs a card that costs ${list} to discard\` }`, `list` formatted like `formatEligibleCostList` (a local copy; the client may not import engine internals).
- Fight / Fight-EV on such a card opens an inline chooser (one button per eligible card, labelled with the card name, plus Cancel); a pick submits `fightVillain` with `{ cityIndex, discardCardId }` (plus `useExcessiveViolence: true` from the EV button). Cards without `fightDiscardCosts` submit exactly as today.
- `PlayDesktop.vue` / `PlayMobile.vue` pass `:viewer-hand-cards="viewer?.handCards ?? []"` , `:viewer-hand-display="viewer?.handDisplay ?? []"` and `:viewer-hand-costs="viewer?.handCosts ?? []"`.
- `PendingSeatChoicePrompt.vue` heading: `case 'escape-effect-cost-discard': return 'A Villain escaped — choose a Hero to discard';`.

**Data:**
- Marker map `villains.ca75.zolas-creations` gains `"captain-zolandia": { "fight": ["gain-recruit-current-per-hero-class"] }` and `"primus": { "escape": ["discard-hero-each-player-by-cost:2+3+5+7"] }` (Doughboy and Man-Fish unchanged).
- `villain-defeat-requirements.json` gains `"fightDiscardCosts": [ { "set": "ca75", "group": "zolas-creations", "card": "primus", "costs": [2, 3, 5, 7] } ]` and a `_doc` sentence for it.
- `apply-defeat-requirement-markers.mjs`: reads the optional `fightDiscardCosts` array (absent = empty); validates `costs` (non-empty, strictly ascending, non-negative integers) and the set / group / card; locates the single ability line whose `trimStart().toLowerCase()` starts with `to fight ` (0 or > 1 → loud-fail, full sentence); appends ` [discard-to-fight:cost:2+3+5+7]` idempotently; `--propose` lists these rows too. Final line: `` `Done. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s) and ${F} new [discard-to-fight:] marker(s) appended.` ``
- `mechanic-provenance.json`: `"gain-recruit-current-per-hero-class"` and `"discard-hero-each-player-by-cost"` → `{ "wp": "WP-817", "decision": "D-24750" }`.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: the two primitives, `eligibleCosts`, `VillainFightDiscardCost`.
- **B)** `setup/villainAbility.setup.ts` + test: the `discard-hero-each-player-by-cost` arm; grammar doc list.
- **C)** `setup/villainDefeatRequirement.setup.ts` + test: `buildVillainFightDiscardCosts` + the marker parser; `setup/buildInitialGameState.ts` omit-when-empty wiring; `types.ts` fields.
- **D)** `moves/villainDefeatRequirement.logic.ts` + test: the five helpers.
- **E)** `moves/fightVillain.ts` + test: the argument, gate, discard and log.
- **F)** `simulation/ai.legalMoves.ts` + test: the mirrored fight branch.
- **G)** `villain/villainEffects.execute.ts` + test: the two handlers + map entries.
- **H)** `villainDeck/villainEscapeProcedure.ts` + test, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts` (+ the `ai.seatChoice`, `mastermindVictory.logic` and `operatorSetters` tests): the owed effect discard.
- **I)** `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + filter test: `fightDiscardCosts`, `handCosts`.
- **J)** Client: `CityRow.vue` + test, `PlayDesktop.vue`, `PlayMobile.vue`, `PendingSeatChoicePrompt.vue` + test.
- **K)** Card data: both marker scripts and maps, `ca75.json` regenerated (3 lines), `mechanic-provenance.json`, regenerated villain ledger + effect index.

## Out of Scope

- **Zero, The Brothers Grimm, Cyclops** ("To fight X, you must also discard…" in other sets). The `[discard-to-fight:]` table is their append point, but their predicates (three 0-cost cards, two identical cards, any card) need new grammar.
- **Iron Fist / Forearm** ("you must also reveal…") and **N'astirh** ("you must also spend 3 Recruit"): different preconditions.
- **The blank Fight button for Blob / Venom** (the client never learned the D-24076 defeat requirement). Same gate seam, separate fix; govern-close records it in STATUS.
- **Arnim Zola** (strike + tactics, arc item 4), **Baron Zemo** (item 3), the hero batch (item 5).
- **Inline step-3 ordering.** Primus's Escape discard opens after the move, after steps 1-2 of every escape in that move and after the new Villain's Ambush; rules v23 L573-575 put it before that Ambush. This is a recorded deviation (D-24750 amends D-24656 point 4 for this one effect), not fixed here.
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `setup/villainDefeatRequirement.setup.ts`, `setup/villainDefeatRequirement.setup.test.ts` — modified
- `setup/buildInitialGameState.ts` — modified (the builder call beside the `buildVillainDefeatRequirements` call ~L419, the conditional spread beside ~L874)
- `types.ts` — modified (two fields, one interface)
- `moves/villainDefeatRequirement.logic.ts`, `moves/villainDefeatRequirement.logic.test.ts` — modified
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `villainDeck/villainEscapeProcedure.ts`, `villainDeck/villainEscapeProcedure.test.ts` — modified
- `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts` — modified (one arm / line each)
- `simulation/ai.seatChoice.test.ts`, `endgame/mastermindVictory.logic.test.ts`, `moves/operatorSetters.test.ts` — modified (T27, T32, T33)
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/CityRow.vue`, `components/play/CityRow.test.ts` — modified
- `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — modified (two props each)
- `components/play/PendingSeatChoicePrompt.vue`, `components/play/PendingSeatChoicePrompt.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs`, `scripts/convert-cards/inputs/villain-defeat-requirements.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/ca75.json` — regenerated (3 lines gain a marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/DECISIONS.md` (D-24750), `docs/ai/ARCHITECTURE.md` and `.claude/rules/architecture.md` (§The Move Validation Contract, ARCHITECTURE ~L896-907 / rules ~L103: one sentence each — "…or the specific villain being fought, whose cost is named by a validated move argument (`fightVillain.discardCardId`, WP-817 / D-24750)"), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 29 engine files (12 tests; 4 production files are one-line edits), 6 client files (2 tests), 5 script/input files, 1 card-data file and 3 generated feeds. Above the ~10 guideline because one card's three lines span the parser, executor, a fight precondition, the escape opener and the one client sender of `fightVillain`; a split would leave Primus half-implemented in a live set. Every test file named above exists on the baseline.

## Contract

- The Locked Values above: the two primitives and their grammar, `eligibleCosts`, `VillainFightDiscardCost`, `[discard-to-fight:cost:…]`, the two `G` fields, the five helpers, `FightVillainArgs.discardCardId` and its gate, the `getLegalMoves` mirror, the `escape-effect-cost-discard` seat-choice kind, `UICityCard.fightDiscardCosts`, `UIPlayerState.handCosts` (owner-only), the exact log strings and the client gate reason.
- `executeVillainAbilities`, every existing handler, `discardFromHand`, `parkSeatChoice` and `resolveSeatChoice` keep their signatures. `descriptorKey` is unchanged.
- Only `fightVillain` pays the fight discard cost; card-effect defeats through `defeatCityVillainCore` do not.

## Test Contract

Minimal-`G` fixtures in each file's existing style (`messages: []`, a `cardStats` entry per costed card). "Costed hand": `hero-cost2` (2), `hero-cost3` (3), `hero-cost4` (4), `hero-cost5` (5), `hero-cost7` (7), `pile-shield-officer` (3), `pile-wound` (no stats). Each T-case is at least one `it`, grouped under one `describe('WP-817 …')` per file. T1 edits both primitive-count pins (`villainAbility.types.test.ts` L356-396 and the WP-816 T2 pin at L612-613) from 29 to 31: a value change from an intended product change, said so in the commit body. T27 lives in `simulation/ai.seatChoice.test.ts`.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES` | 31 members, positions 30-31 as locked; parity test passes | |
| T2 | types | `descriptorToLegacyKeyword` of both new descriptors (with `eligibleCosts`) | `undefined` each | `eligibleCosts` not in the key |
| T3 | setup | parse `gain-recruit-current-per-hero-class`; `discard-hero-each-player-by-cost:2+3+5+7`; `…:0`; `…:3` | `{gain-recruit-current-per-hero-class}`; `{…, eligibleCosts: [2,3,5,7]}`; `[0]`; `[3]` | |
| T4 | setup | `gain-recruit-current-per-hero-class:1`, `discard-hero-each-player-by-cost`, `…:`, `…:2+2`, `…:3+2`, `…:2+x`, `…:02`, `…:2+3:5` | each unresolved (`unresolvedMarkers`) | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the three lines copied **verbatim** from the regenerated `ca75.json` | Zolandia onFight T3[0]; Primus onEscape T3[1]; no hook from the "To fight" line; no `unresolvedMarkers` | |
| T6 | defeat setup | `buildVillainFightDiscardCosts` over a mock group with Primus (`copies: 2`, the regenerated line) + a plain villain | 2 entries (both copy ids) `{ eligibleCosts: [2,3,5,7] }`, fresh objects (not aliased); plain villain absent | |
| T7 | defeat setup | lines `[discard-to-fight:cost:]`, `[discard-to-fight:cost:3+2]`, `[discard-to-fight:2+3]`, `[discard-to-fight:cost:2+x]` | no entry each | inert, never throws |
| T8 | logic | `isHandCardCostOneOf` for every costed-hand id vs `[2,3,5,7]`; a split card in hand whose face a costs 5 | true for 2/3/5/7 and Officer; false for 4 and Wound; split → true | off-play cost |
| T9 | logic | `listEligibleHandCardsByCost` hand `[hero-cost7, hero-cost4, pile-wound, hero-cost2]`; `selectDefaultCostDiscardCard` same; hand `[hero-cost4]` | `[hero-cost7, hero-cost2]`; `hero-cost2`; `[]` / `null` | hand not mutated |
| T10 | logic | `formatEligibleCostList([2])`, `([2,3])`, `([2,3,5,7])` | `2`; `2 or 3`; `2, 3, 5, or 7` | |
| T11 | fightVillain | Primus (fight cost 3, discard cost table) at City 0, attack 3, hand `[hero-cost4, hero-cost5]`; `{ cityIndex: 0, discardCardId: 'hero-cost5' }` | Primus in victory; `hero-cost5` in discard; hand `[hero-cost4]`; attack 0; log `Player 0 discarded … to fight ….` | discard before defeat (log order) |
| T12 | fightVillain | same, args `{ cityIndex: 0 }`; `discardCardId: 'hero-cost4'`; `'not-in-hand'` (cost 5 stats); `''` | each: `G` deep-equal before/after (no mutation) | silent return |
| T13 | fightVillain | a villain with **no** discard cost, `{ cityIndex: 0, discardCardId: 'hero-cost5' }` | fought normally; hand unchanged; no discard log | ignored arg |
| T14 | fightVillain | T11 with `useExcessiveViolence: true`, attack 4, an enrolled EV ability | one discard, debit 4, EV fired once | |
| T15 | fightVillain | T11 where `hero-cost5` carries `return-on-discard` | the discard parks `pendingReturnOnDiscard` for player 0 and the fight still resolves | chokepoint used |
| T16 | legalMoves | T11 state | exactly one fight intent `{ cityIndex: 0, discardCardId: 'hero-cost5' }` (cheapest eligible) | |
| T17 | legalMoves | hand `[hero-cost4]`; and attack 2 with an eligible hand | no `fightVillain` for City 0 | mirrors T12 |
| T18 | legalMoves | a non-discard villain | args `{ cityIndex }` deep-equal (no extra key) | byte-identical |
| T19 | executor | onFight `{gain-recruit-current-per-hero-class}`; hand Tech + Ranged Heroes, inPlay a Strength Hero and a second Tech, recruit 1 | recruit 4; log `Fight effect: gained +3 recruit for the 3 Hero Class(es) you have.` `applied` | hand + play |
| T20 | executor | same with only S.H.I.E.L.D. Agents / Wounds | recruit unchanged; the `no Hero Classes` line `blocked` | never throws |
| T21 | executor | onEscape `{discard-hero-each-player-by-cost, eligibleCosts: [2,3,5,7]}` for `primus-01` | `G.pendingEscapeEffectDiscards` = `[{ escapedCardId: 'primus-01', eligibleCosts: [2,3,5,7] }]`; log `Escape effect: each player must discard a Hero that costs 2, 3, 5, or 7.`; no hand changes | records only |
| T22 | executor | same descriptor with `eligibleCosts` absent | no queue; `no discard costs were given` `blocked` | |
| T23 | escape | queue `[{primus-01, [2,3,5,7]}]`, no escape procedures; players `0` hand `[hero-cost4, hero-cost7, hero-cost3]`, `1` hand `[hero-cost4]`, `2` hand `[hero-cost2]`; opener called | one seat choice parked, kind `escape-effect-cost-discard`, `addressedSeats ['0','2']`, seat 0 options `[hero-cost7 (cost 7), hero-cost3 (cost 3)]`, seat 2 `[hero-cost2 (cost 2)]`; log `Escape effect: Player 1 has no Hero that costs 2, 3, 5, or 7 to discard.`; queue field deleted | |
| T24 | escape | T23's choice with submissions `0 → 1`, `2 → 0`, applied via the resolve dispatch | `hero-cost3` and `hero-cost2` discarded; logs `Player 0 discarded … (Escape effect).` then Player 2 | ascending seats |
| T25 | escape | `pendingEscapeProcedures` holds a bystander-carrying escape with `isHqKoResolved: true` and the effect queue holds Primus | first call opens the step-2 bystander discard only; after it resolves, the next call opens the Primus choice | rule order |
| T26 | escape | no seat holds an eligible card; and `evaluateEndgame` non-null | no choice; queue drained with one `has no Hero` line per seat; endgame → nothing opened, no `has no Hero` line, `pendingEscapeEffectDiscards` still length 1 | |
| T27 | escape (bot) | `ai.seatChoice` pick for T23 seat 0 | option index 1 (`hero-cost3`, lowest cost) | |
| T28 | ui filter | a City card with `fightDiscardCosts [2,3,5,7]` and player 0 with `handCosts [3, null, 5]` through `filterUIStateForAudience` for player 0, player 1 and a spectator | `fightDiscardCosts` survives for all three, deep-equal, not aliased; a card without it has no such key; `handCosts` survives for player 0 only, absent for player 1 and the spectator | five-step step 4 |
| T29 | CityRow | Primus cell (`fightDiscardCosts`), affordable; viewer hand without eligible; then `[hero-cost4, hero-cost5]` (`handCosts [4, 5]`); then an Officer-only hand (display cost `null`, `handCosts [3]`) | disabled + reason `Needs a card that costs 2, 3, 5, or 7 to discard`; then enabled, click opens the chooser with one `hero-cost5` button, picking it calls `submitMove('fightVillain', { cityIndex, discardCardId: 'hero-cost5' })`; Cancel submits nothing; Officer-only → enabled and the chooser lists the Officer | eligibility from `handCosts`, never `display.cost` |
| T30 | CityRow | a cell without `fightDiscardCosts`; and a slash stroke across an affordable Primus cell with an eligible hand, driven through the existing stroke harness (`CityRow.test.ts` ~L854, "the slash gesture fights exactly what the Fight button allows") | Fight submits `{ cityIndex }` exactly; the Primus stroke submits nothing | slash skips Primus (`gateForCityIndex` is a `setup()` closure, so test it through the gesture) |
| T31 | Prompt | seat choice of kind `escape-effect-cost-discard` | heading `A Villain escaped — choose a Hero to discard` | |
| T32 | endgame | the existing `ALL_PENDING_FIELDS` drift test with `'pendingEscapeEffectDiscards'` added | the turn-end promotion clears it | drop set complete |
| T33 | operator | the existing `GATE_BLOCKERS` test with a `pendingEscapeEffectDiscards is non-empty` row | the setter gate reports busy for it | |
| T34 | CityRow | **only if WP-820 executed first:** a Primus cell (`fightDiscardCosts`) with `economy.rescueOnFightAvailable: true` and the fight affordable | no `play-city-villain-rescue` button | the rescue control never bypasses the discard chooser (mirrors WP-820 T7) |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** `zolas-creations` appears in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). Zolandia now pays Recruit and Primus now costs a card and punishes its escape, so those legs change difficulty. No committed `data/par` artifact references the group, so nothing is re-pinned; a future PAR run picks up the new behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- Both new `G` fields are omit-when-empty / lazy; a match without Primus never creates them. `UIPlayerState.handCosts` is projected in every match, but UIState is a projection and is never hashed. No randomness; sorted seat iteration; the bot pick is deterministic.
- `getLegalMoves` output is unchanged for every villain without a discard cost, so sim, PAR and bot runs on other loadouts are byte-identical.
- Narration goes to hash-excluded `G.messages` (D-24081). `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 16); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which already holds the setup-time hooks and tables, so pre-WP-817 matches replay identically. A stored pre-WP-817 match that fought Primus logged `fightVillain { cityIndex }`; it replays from its own `initialState` (no discard table), so it still succeeds. Only a re-setup from config + seed sees the new markers. Recorded in D-24750.

## Funding Surface Gate

§20 **N/A**: engine, card data and a gameplay button only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T7 pass. Both scripts accept the three Locked-Values tokens (Verification 3). The marker script runs `main()` on import, so its rejection side is checked by hand: put each T4 token for the two new primitives into the marker map one at a time, run the script, observe a loud failure, revert; and put `"costs": [3, 2]` and `"costs": []` into the requirement map one at a time. Record the observed failures in the EC-855 commit body.
2. **Types and helpers.** T1-T2 and T8-T10 pass as runtime assertions.
3. **Fight cost.** T11-T15 pass. T12's four refusals leave `G` deep-equal.
4. **Bot mirror.** T16-T18 pass.
5. **Zolandia.** T19-T20 pass.
6. **Primus Escape.** T21-T27 pass.
7. **Projection.** T28 passes, and T28's `describe` also asserts that `buildUIState` gives a Primus City card `fightDiscardCosts` and the current player `handCosts` (Officer → 3, Wound → `null`). T32-T33 pass.
8. **Client.** T29-T31 (and T34 when WP-820 executed first) pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
9. **Data.** `apply-effect-markers.mjs` prints `ca75.json — 2 new marker(s) this run` and re-runs at 0; `apply-defeat-requirement-markers.mjs` prints `… 0 new [require-to-defeat:] marker(s) and 1 new [discard-to-fight:] marker(s) appended.` and re-runs at 0; `git diff data/cards/` touches only `ca75.json`, and only those 3 lines, each gaining one trailing marker.
10. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps; the last three need no regeneration.
11. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
12. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`, Captain Zolandia (`gain-recruit-current-per-hero-class`) and Primus (`discard-hero-each-player-by-cost`) are `executable` with a handler and WP-817 / D-24750 provenance; no other row changes.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs` then `node scripts/convert-cards/apply-defeat-requirement-markers.mjs`; re-run both → 0 new markers. `git diff --stat -- data/cards/` → only `ca75.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last three flags, STOP: Assumes 16 is false.
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: remove the step-1 discard gate in `fightVillain`; drop the discard-cost branch from `getLegalMoves`; make `openEscapeEffectDiscardIfNeeded` run before the escape-procedure loop; make the Zolandia handler count the play area only; drop `fightDiscardCosts` from `deepCopyCitySpaces` (T28 must fail).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24750 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, including the Blob / Venom client Fight-gate follow-up line.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-855:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live 2+-player `ca75/arnim-zola` match (it always leads `zolas-creations`) with the deployed gitSha checked, driven via the operator setter pane or `/api/match/autoplay` setupData:
  - fighting Captain Zolandia logs `+N recruit` where N is the distinct Hero Classes in the fighter's hand + play, and Recruit rises by N;
  - with no 2/3/5/7-cost card in hand, Primus's Fight button is disabled with the reason; with one, the chooser opens, the fight succeeds and the log shows `discarded … to fight Primus`;
  - a Primus escape logs `each player must discard a Hero that costs 2, 3, 5, or 7`, then each player with such a Hero gets the prompt and discards, and a player with none is logged.
  - The Play Diagnostics `uiStateSnapshot` shows `fightDiscardCosts` on the Primus City card and `handCosts` on the viewer's own player entry only (five-step step 5).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24750 — zolandia-primus.** It locks:
- the authorized contract-file changes: `rules/villainAbility.types.ts` (primitives #30 `gain-recruit-current-per-hero-class` and #31 `discard-hero-each-player-by-cost`, the `eligibleCosts` descriptor field outside `descriptorKey`, `VillainFightDiscardCost`) and `ui/uiState.types.ts` (`UICityCard.fightDiscardCosts?`, `UIPlayerState.handCosts?`);
- only `fightVillain` pays the fight discard cost; card-effect defeats through `defeatCityVillainCore` (defeat-choice, Silent Sniper) do not;
- the ARCHITECTURE / rules Move Validation Contract sentence widening D-24185 to a fought villain whose cost is named by a validated move argument;
- Zolandia's count is `countDistinctHeroClassesYouHave` (hand + play, D-24529 / D-24694), the one counter the hero side uses;
- a villain fight discard cost is a setup-built per-instance table (`G.villainFightDiscardCosts`, omit-when-empty) from the `[discard-to-fight:cost:<c>[+<c>…]]` marker, a sibling of D-24076's defeat-requirement table, produced by the same overlay script;
- the cost is paid through a `fightVillain` argument (`discardCardId`) validated in step 1 before any mutation (extends D-24185 from a played card to a fought villain), discarded through `discardFromHand` before the defeat, and mirrored in `getLegalMoves` with the cheapest eligible card (D-24364); a pending post-commit discard was rejected because a later effect could strand it;
- one eligibility predicate for "a card" and "a Hero" that costs one of the listed costs (`offPlayCardStats` cost; Wounds and uncosted cards never qualify);
- Primus's Escape records an owed every-player discard (`G.pendingEscapeEffectDiscards`, lazy) that the escape opener drains after the escape procedure as an `escape-effect-cost-discard` seat choice (WP-793's step-2 shape with a cost filter; seats with no eligible card are logged; bot-ally = cheapest, autoplay / sim / PAR = index 0); this **amends D-24656 point 4** for Escape effects that need a multi-seat choice (only `discard-hero-each-player-by-cost`): they resolve after the move, after the new Villain's Ambush, a known deviation from rules v23 L573-575; every other Escape effect stays inline;
- the client learns the cost from `UICityCard.fightDiscardCosts` (public card text) and tests eligibility against the owner-only `UIPlayerState.handCosts` (the engine's `offPlayCardStats` cost, never the printed display cost); the slash gesture skips discard-cost villains; the engine stays the authority;
- the replay-compat note.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → two blocking text fixes, applied.**
- **PS-1 (fixed):** the client tested eligibility from `UICardDisplay.cost`, which is `null` for `pile-shield-officer` / `pile-sidekick` while the engine reads `G.cardStats` (3 / 2), so an Officer-only hand would see Primus disabled. Added the owner-only `UIPlayerState.handCosts` (the engine's `offPlayCardStats` cost), the `viewerHandCosts` prop, an Officer-only T29 case and a `handCosts` redaction check in T28.
- **PS-2 (fixed):** the two drift-guard tests the new queue triggers were missing: `endgame/mastermindVictory.logic.test.ts` (`ALL_PENDING_FIELDS`) and `moves/operatorSetters.test.ts` (`GATE_BLOCKERS`). Added to the allowlist with T32 / T33.
- **RS-1 (fixed):** the slash gesture reuses `gateForCityIndex` → it now returns false for a discard-cost villain (T30).
- **RS-2 (fixed):** "bots pick their cheapest" holds for bot-ally only; autoplay / sim / PAR answer index 0. Reworded; T27 placed in `simulation/ai.seatChoice.test.ts` (allowlisted).
- **RS-3 (fixed):** both primitive-count pins (L356-396, L612-613) move 29 → 31; the Test Contract says T1.
- **RS-4 (fixed):** T25's escape entry seeds `isHqKoResolved: true`.
- **RS-5 (fixed):** the `buildInitialGameState` wiring is two edits (builder call + spread).
- **RS-6 (declined):** an optional `subsystem-coverage.json` row for Primus; Primus reads `executable` from its Escape marker, so the row would only document and is left out of scope.
- Verified: `fightVillain` anchors and the step-1 seam; every `fightVillain` args builder/sender (only `getLegalMoves` and `CityRow`, incl. the slash gesture; everything else passes args through; `intent.validate` checks only `typeof args`); the opener `break` + tail call is reached by every caller (`game.ts`, both sim runners, `runFixture.ts:419`); no closed seat-choice kind list; `cards:check` runs the overlay on ca75; no consumer breaks on `[discard-to-fight:]`; no import cycle for `countDistinctHeroClassesYouHave`; T8 / T19 / T27 arithmetic; no hashed fixture or PAR file plays the group; dependencies and reservations.

**Pre-flight (01.4), round 2 (same independent subagent): READY TO EXECUTE.** All round-1 fixes confirmed against live code (`handCosts` has one producer and one filter seam; no other field-by-field `UIPlayerState` copy; the diagnostics snapshot is the whole `UIState`; the optional field breaks no literal under `vue-tsc`). Two non-blocking items:
- **RS-7 (fixed):** T30 drives the Primus slash case through the existing stroke harness, since `gateForCityIndex` is a `setup()` closure.
- **RS-8 (declined, recorded):** `ui/uiState.types.drift.test.ts` pins the `UICityCard` / `UIPlayerState` fixture keysets, but optional fields never fail it; T28's built-projection assertion pins both new fields (the code-style rule "pin optional fields with a keyset assertion on a built projection"), so the drift file stays off the allowlist.

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), eight text fixes, all applied; no scope change, pre-flight stands.**
1. Mode 4 / 30 — `ui/uiState.types.ts` is a contract file; the Lane line and D-24750 now authorize both contract files.
2. Mode 20 — ARCHITECTURE.md (~L896-907) and `.claude/rules/architecture.md` (~L103) scope D-24185 to the card being played; both get one sentence at governance close (Files Expected to Change).
3. Mode 18 — the Escape deferral reverses D-24656 point 4's reason for keeping step 3 inline (rules v23 L573-575). Context, Out of Scope, D-24750 and the EC now say "amends D-24656 point 4 for this one effect", not "extended".
4. Mode 26 — card-effect defeats through `defeatCityVillainCore` pay no discard; stated in constraints, Contract and D-24750.
5. Mode 21 — `discardCardId?: CardExtId`.
6. Mode 4 / 11 — the five-step contract and the live-verify step name `handCosts` too; the determinism note says `handCosts` is projected in every match but never hashed.
7. Mode 11 — T26's endgame case asserts the queue is untouched; a fifth revert proof drops `fightDiscardCosts` from `deepCopyCitySpaces`.
8. Mode 27 — the EC copies every locked name.
- Checked clean: determinism / hashes (the tail is `while (undefined !== undefined)` without Primus; `getLegalMoves` unchanged for other villains); no silent-stall sender (bot-ally reads `pending*` keys structurally; replay passes args through); queue guards (drop set, operator guard; no end-turn guard needed); `handCosts` leakage (`redactHandCards` is a whitelist); villain ability text is never projected; parser arm order; WP ↔ EC test IDs and file counts.

**Copilot (01.7), round 2 (same independent subagent): CONFIRM (RISK)** — all eight fixes landed, no new failure mode; three one-line residuals applied (the EC opener `// why:` now says "amends", the EC live-verify names `handCosts`, the Contract lists `UIPlayerState.handCosts`). No re-run needed.

**Lint (00.3) (independent subagent): FAIL → PASS after two text fixes, applied.** §3: Locked Values used `formatCardRef` / `resolveCardName` / `pushLog` / `parkSeatChoice` / `evaluateEndgame` and new imports without an Assumes line → Assumes 17 added (baseline green renumbered to 18). EC-TEMPLATE: an app-package EC must gate `typecheck` in Before Starting and After Completing → both EC lines now run `pnpm --filter @legendary-arena/arena-client typecheck`. Advisories applied: A1 (the UIState Projection Integrity and Layer Boundary citations point at `.claude/rules/architecture.md`), A2 (Verification 6-7 run the client typecheck and the roadmap / ledger checks), A3 (WORK_INDEX / EC_INDEX rows name both UIState fields), A4 (the EC fight log string is copied in full). A5 (EC Before Starting does not list target files) left as-is: Files to Produce carries the allowlist, the EC-854 precedent. These fixes are text-only (one new Assumes line, two EC command lines); no scope, contract or locked value changed, so 01.4 / 01.7 were not re-run (the WP-816 precedent).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM (RISK; concerns documented above and resolved in the text) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. Two FAILs (§3, EC-TEMPLATE typecheck) were fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 6 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS after fix — Assumes 17 enumerates the log / choice / endgame seams and every new import |
| §4 | PASS — 00.2 §1.4 / §5, ARCHITECTURE sections, rules UIState / Layer Boundary, DECISIONS scan list |
| §5 | PASS — 44 files, every one marked modified or regenerated; the count is justified |
| §6 | PASS — card / group / mastermind slugs match `ca75.json`; `discardCardId` is a `CardExtId` |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine decides; the client gates on projected data only (D-24574); `G` stays JSON; no I/O or randomness |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, diff-scope step, 5 revert proofs |
| §14 | PASS — 12 binary criteria tied to T1-T33 |
| §15 / §15.1 | PASS — STATUS (+ Blob / Venom follow-up), DECISIONS, ARCHITECTURE / rules sentence, indexes in DoD; D-24026 live-verify on `play.legendary-arena.com` names both UIState fields |
| §16 | PASS — 00.6 mandated; the client cost-list formatter is a deliberate duplicate (Layer Boundary) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

EC-855 vs EC-TEMPLATE: PASS after fix (within the 100-line ceiling, all sections, typecheck gated in Before Starting and After Completing).

**Verdict:** PASS.
