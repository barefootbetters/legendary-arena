# EC-859 — Arnim Zola Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-821-arnim-zola-mastermind.md
**Layer:** Game Engine (+ the tactic provenance overlay and the regenerated effect index)

## Before Starting
- [ ] `mastermindStrikeHandler` (`rules/mastermindHandlers.ts` ~L1237) has no `ca75/arnim-zola` branch; `dispatchTacticOnFight` (`rules/tacticHandlers.ts` ~L1458) has no Zola branch.
- [ ] `printedHeroAttack` is still private at `economy/abomination.logic.ts` ~L46; `gainHqHeroFree` (~L947) has one caller, `freeRecruitFromHqByFilter` (~L1008).
- [ ] `SeatChoiceOption` (`types.ts` ~L1338) holds `label`, `cityIndex?`, `cardId?`; the filter projects only `label` (`uiState.filter.ts` ~L1353).
- [ ] `selectDefaultCostDiscardCard` exists at `moves/villainDefeatRequirement.logic.ts` ~L204.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; record the engine test total.

## Locked Values (do not re-derive)
- `ARNIM_ZOLA_MASTERMIND_ID = 'ca75/arnim-zola'`, `ZOLA_PRINTED_ATTACK_LIMIT = 2` (`mastermind/arnimZola.logic.ts`, NEW). `hasLessThanTwoPrintedAttack(G, cardId)` = `printedHeroAttack(G, cardId) < ZOLA_PRINTED_ATTACK_LIMIT` (off play); `listZolaWeakHqSlots` ascending non-null slots; `listCrushEligibleTargets` hand then inPlay, no Wounds, per-`(zone, cardId)` dedupe; an inPlay card qualifies on `(G.cardStats[cardId]?.attack ?? 0) < ZOLA_PRINTED_ATTACK_LIMIT`.
- Strike: snapshot `listZolaWeakHqSlots`; per slot push to `heroDeck` end, `refillHqSlot` + rebind, then per sorted player `selectDefaultCostDiscardCard(gameState, playerId, [cost])` → `discardCardFromHand`. Lines: `` `[Arnim Zola Master Strike] No Hero in the HQ has less than 2 printed Attack — no effect.` `` / `` `[Arnim Zola Master Strike] ${formatCardRef(gameState.cardDisplayData, heroId)} has less than 2 printed Attack and went to the bottom of the Hero Deck.` `` / `` `[Arnim Zola Master Strike] Player ${playerId} has no card that costs ${cost} to discard.` `` / `` `[Arnim Zola Master Strike] Player ${playerId} discarded ${resolveCardName(gameState.cardDisplayData, cardId)} (cost ${cost}).` ``.
- Tactic ids `ZOLA_DOMINATE_THE_WEAK_TACTIC_ID` / `ZOLA_COMPUTER_UPLOADED_GENIUS_TACTIC_ID` / `ZOLA_PET_PROJECTS_TACTIC_ID` / `ZOLA_CRUSH_PACIFIST_RESISTANCE_TACTIC_ID` = `ca75-mastermind-arnim-zola-{dominate-the-weak|computer-uploaded-genius|pet-projects|crush-pacifist-resistance}`; `HERO_CLASS_TECH = 'tech'`; `ZOLAS_CREATIONS_VILLAIN_PREFIX = 'ca75-villain-zolas-creations-'`.
- Kinds: `COMPUTER_UPLOADED_GENIUS_DISCARD_KIND = 'computer-uploaded-genius-discard'`, `DOMINATE_THE_WEAK_GAIN_KIND = 'dominate-the-weak-gain'`, `CRUSH_PACIFIST_RESISTANCE_KO_KIND = 'crush-pacifist-resistance-ko'`, `CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND = 'crush-pacifist-resistance-last-ko'`. `SeatChoiceOption` gains `recipientSeat?: string`, `sourceZone?: 'hand' | 'inPlay'` (never projected).
- Dominate: options for `[current, ...others asc]` × weak Heroes by cost desc (ties slot asc), label `` `Player ${seat} gains ${resolveCardName(G.cardDisplayData, heroId)}` ``, `defaultOptionIndex: 0`; one option → `gainDominateTheWeakHero` inline (guard both optional fields defined; no `!` / `as` on them); else `parkSeatChoice(G, events, choice, currentPlayer)`. Gain line `` `Player ${recipientSeat} gained ${resolveCardName(G.cardDisplayData, heroId)} from the HQ (Dominate the Weak).` `` `applied`.
- Genius: hand Tech (`heroClass` or `heroClass2`) reveals; empty hand narrated; the rest get `buildComputerUploadedGeniusDiscardChoice` → `parkSeatChoice(G, events, choice)`. Discard line (shared `applyHandDiscard`) `` `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (${sourceName}).` `` `applied`, `sourceName` = `'Computer-Uploaded Genius'`.
- Pet Projects: each other seat, `countVictoryPileGroupVillains(zones.victory, ZOLAS_CREATIONS_VILLAIN_PREFIX) > 0` → reveal, else `gainWoundWithOutcome` (three outcome lines).
- Crush: `buildCrushPacifistResistanceChoice` options `` `KO ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(zone)}` `` + `{ label: 'KO nothing' }` (last, default); `parkSeatChoice(G, events, choice, currentPlayer)`; `resolveSeatChoice` chains the `-last-ko` kind only after a first-pick KO; timeout never chains. KO line `` `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(sourceZone)} (Crush Pacifist Resistance).` `` `applied`; decline `` `Player ${seat} chose not to KO a Hero (Crush Pacifist Resistance).` `` `neutral`.
- Every other tactic / chain string: copy verbatim from WP-821 §Locked Values. Crush apply: `cardId` without `sourceZone`, or missing zones → silent return.
- Imports: exactly WP-821 §Locked Values "Import changes"; drop `tacticHandlers.ts`'s now-unused `refillHqSlot` import.
- `buildHandDiscardChoice` / `applyHandDiscard` hold the Fallen Idols bodies; Fallen Idols' exports delegate unchanged. `gainHqHeroFree` → exported `gainHqHeroToDiscard` in `seatChoiceTactics.ts`, verbatim.
- Bot: Genius joins the least-valuable branch; Crush kinds → `indexOfZeroCostKoOption(G, options)`: the first option with a `cardId` whose `G.cardStats[cardId]?.cost ?? 0` is `0`, else `options.length - 1`; Dominate default.
- Provenance rows: 4 × `executable`, `tacticHandlers.ts#resolve<Name>`, WP-821, D-24754.

## Guardrails
- Every "less than 2 printed Attack" read goes through `arnimZola.logic.ts`; no second copy of the predicate.
- Other masterminds' strikes and every other tactic stay byte-identical (S4, T10).
- Refactors change no output: Dark Technology, Bitter Captor, Fallen Idols tests pass unchanged.
- Sorted seats; no `.reduce()`; nothing throws; every no-op logs its locked line. Silent only: a missing player zone, an option missing `cardId` / `recipientSeat` / `sourceZone`, a stale card no longer in its HQ slot or zone.
- No randomness; no `G` field; no UIState field; no client file; no `.types.ts` / `.validate.ts` / `.gating.ts` file.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- `ZOLA_PRINTED_ATTACK_LIMIT` / the predicate: rules v23 L2301-2311 (missing value = 0); inPlay reads the played face (L926).
- The strike snapshot and the inline auto-pick (no `events`; equal-cost candidates; D-24754).
- `recipientSeat` / `sourceZone`: consumer-added, not projected (Assumes 8); `sourceZone` because starter ids repeat across zones.
- Dominate's option order: the default is the D-24343 highest-cost self-gain.
- Crush's chain placement (the Monarch's Decree chain precedent, D-24511) and why the timeout never chains (D-24501).
- Genius: hand-only reveal; a free reveal beats a discard (D-24312).
- The bot's 0-cost KO: thinning a S.H.I.E.L.D. starter (seeded cost 0, `buildInitialGameState.ts` ~L526).
- `ZolaKoTarget`: mirrors `KoHeroTarget` without importing `villainEffects.execute.ts` into the pure chain; the Crush apply's dynamic zone read (`koHeroChoice.resolve.ts` ~L111).

## Files to Produce
- `packages/game-engine/src/mastermind/arnimZola.logic.ts` + test — **new**
- `packages/game-engine/src/economy/abomination.logic.ts` — **modified** (`export` only); `types.ts` — **modified** (two optional fields)
- `packages/game-engine/src/rules/mastermindHandlers.ts` + test, `rules/tacticHandlers.ts` + test — **modified**
- `packages/game-engine/src/moves/seatChoiceTactics.ts` + test, `moves/seatChoice.resolve.ts` + test — **modified**
- `packages/game-engine/src/simulation/ai.seatChoice.ts` + test — **modified**
- `scripts/coverage/tactic-provenance.json` — **modified**; `data/metadata/effect-implementation-index.json` — **regenerated**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] Z1-Z3, S1-S6, T1-T18 and T3b pass (T1 uses current player `1`). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] `pnpm effect-index` changes only the four Zola tactic rows; `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0.
- [ ] Revert proofs observed (`<=` for `<`; live HQ for the snapshot; no Crush chain; Genius addresses a Tech holder; Pet Projects hits the current player; Dominate recipients plain ascending; a raw push for `discardCardFromHand`).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24754 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-859:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- A `2+` Hero leaves the HQ on the strike → `<=` used, or the `+` not dropped (use `printedHeroAttack`).
- The strike moves a Hero that just refilled a slot → it iterates the live HQ, not the snapshot.
- A player discards a card of the wrong cost → the cost was read from the refill, not the moved Hero.
- Crush offers a third KO, or KOs on a timeout → the chain fires on the last-ko kind or on the timeout path.
- A starter in play is KO'd from the hand → the apply ignored `sourceZone`.
- Dominate's Hero lands in the chooser's discard when another player was picked → `recipientSeat` unread.
- Fallen Idols' log now says another name → the shared body's `sourceName` wiring is wrong.
- Pet Projects wounds the defeating player → the loop did not skip the current seat.
- An unrelated tactic now fires → a branch matched a prefix instead of the exact id.
- A final turn or Civil War loss after Dominate the Weak → its refill emptied the Hero Deck; intended (D-24754), do not suppress. The strike never shortens the Hero Deck.
- A Haunted HQ Hero is skipped by Dominate or the strike → an `isHqSlotHaunted` filter was copied from the free-recruit path; gain and put-bottom reach it (T3b, S5).
