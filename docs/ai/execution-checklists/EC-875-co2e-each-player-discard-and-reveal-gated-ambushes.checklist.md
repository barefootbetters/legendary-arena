# EC-875 — co2e each-player discard and reveal-gated Ambushes (Execution Checklist)

**Source:** docs/ai/work-packets/WP-837-co2e-each-player-discard-and-reveal-gated-ambushes.md
**Layer:** Game Engine (+ one Arena Client heading, card-data markers, derived feeds)

## Before Starting
- [ ] WP-817 merged; record `VILLAIN_EFFECT_PRIMITIVES.length` (31 at the `677c4109` baseline) and `VILLAIN_EFFECT_CONDITIONS` (`['savior']`).
- [ ] Sibling co2e packets (WP-835 / 836 / 838 / 839 / 840) present or absent on `main` are both fine: merge this packet's `ambush` keys into any card objects they added (never replace their keys) and append primitives after `main`'s last. WP-829 is merged (`461ed924`): add this packet's arms beside its `timestream-purge` arms in `seatChoice.resolve.ts`, `ai.seatChoice.ts`, `PendingSeatChoicePrompt.vue`. WP-830 (#2998) is merged (`e580d801`, anchor shifts only); if WP-831 / WP-832 (#3001 / #3004) landed first, rebase onto their `seatChoice.resolve.ts`, `ai.seatChoice.ts`, `PendingSeatChoicePrompt.vue`, `fightVillain.ts`, `types.ts` and `villainDeck.reveal.ts` edits; re-read the L388 / L697 call sites.
- [ ] `openEscapeProcedureSeatChoiceIfNeeded` still tails into `openEscapeEffectDiscardIfNeeded`, which still builds `buildEscapeEffectCostDiscardChoice` (`villainEscapeProcedure.ts` ~L307-362); `game.ts` `turn.onMove` still calls the opener after every move.
- [ ] `villainCardPlaysVillainDeckCards` is still called only at `villainDeck.reveal.ts` ~L388 and `fightVillain.ts` ~L697.
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive)
- Primitives appended last, in order: `discard-hero-each-player-by-trait`, `discard-hero-or-wound-each-player-by-trait` (both `:<kind>:<value>`, the shared trait arm), `discard-hand-matching-hq-card-names-each-player`, `hq-heroes-to-hero-deck-bottom` (both no-param). Condition appended: `another-group-villain-in-city`.
- `play-villain-deck-cards:<N>` unchanged; `play-villain-deck-cards:<N>:<kind>:<value>` → `{ magnitude, requireKind, requireValue }`; any other part count → null.
- `PendingEffectDiscardTraitFilter { requireKind: 'team' | 'hero-class'; requireValue: string; requirementLabel: string; effectLabel: string; hasWoundAlternative: boolean; }`; `PendingEscapeEffectDiscard.traitFilter?`; a trait entry has `eligibleCosts: []`. No rename, no new `G` field.
- Names: `villainEffectDiscardHeroEachPlayerByTrait`, `villainEffectDiscardHeroOrWoundEachPlayerByTrait`, `recordOwedTraitDiscard`, `villainEffectDiscardHandMatchingHqCardNamesEachPlayer`, `villainEffectHqHeroesToHeroDeckBottom`, `cardNameKeysOf`, `resolveVillainGroupPrefix`, `cityHoldsOtherGroupVillain`, `currentPlayerRevealsForVillainDeckPlay`, `listEligibleHandCardsByTrait`, `prepareVillainEffectTraitDiscardChoice`, `applyVillainEffectTraitDiscard`, `VILLAIN_EFFECT_TRAIT_DISCARD_KIND = 'villain-effect-trait-discard'`, `VILLAIN_EFFECT_WOUND_OPTION_LABEL = 'Gain a Wound instead'`.
- `isConditionGateSatisfied(G, currentPlayer, cardId, timing, descriptor)`. Group = longest `${set}-villain-${slug}-` (from `G.selection?.villainGroupIds ?? []`, two-part ids only) that the card id starts with; null → `` `${label} effect: the Villain's group is not among this match's Villain Groups; no effect.` ``; no other non-null City occupant with that prefix → `` `${label} effect: no other ${groupSlug} Villain is in the City; no effect.` `` (both `'blocked'`).
- Trait handlers: missing kind/value → `` `${label} effect: no Hero trait was given; no effect.` `` `'blocked'`; else push the entry (labels from `describeRevealRequirement` / `villainEffectTimingLabel`) and log `` `${label} effect: each player must discard ${article} ${requirementLabel} Hero.` `` or `` `… Hero or gain a Wound.` `` `'applied'` (`an` for `/^[AEIOUX]/`).
- `cardNameKeysOf`: base before `#`; split → both faces' bases; three `/` segments → `segments[2]`; else none.
- Juggernaut discard: HQ key union over non-null slots; empty → `` `${label} effect: the HQ is empty, so no player discards.` ``; sorted seats over a hand copy, `discardFromHand` each match; per seat `` `${label} effect: Player ${seat} discarded ${names} (same card name as a Hero in the HQ).` `` `'applied'`; none → `` `${label} effect: no player had a card with the same card name as a Hero in the HQ.` `` `'blocked'`.
- HQ bottom: push every non-null slot 0 → last onto the end of `G.heroDeck` and null it; then refill every null slot 0 → last via the pure `refillHqSlot`, rebinding each time (`const result = refillHqSlot(G.hq, index, G.heroDeck); G.hq = result.hq; G.heroDeck = result.heroDeck;`); never touch `G.hqHaunters`. `` `${label} effect: put ${N} Hero(es) from the HQ on the bottom of the Hero Deck (${names}); the HQ refilled.` `` `'applied'` / `` `${label} effect: the HQ is empty; no Hero was put on the bottom of the Hero Deck.` `` `'blocked'`.
- Leader: `villainCardPlaysVillainDeckCards(G, cardId, timing, currentPlayer?)`; gated + (undefined player or reveal) → 0; ungated unchanged. Handler logs `` `${label} effect: Player ${currentPlayer} revealed ${article} ${requirement} Hero, so no card is played from the Villain Deck.` `` `'blocked'` on reveal only; stays in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`. Both fire sites pass the current player.
- Opener: `entry.traitFilter !== undefined` → `prepareVillainEffectTraitDiscardChoice(G, filter, currentPlayer)`; every other entry routes exactly as on `main` (WP-817's cost builder, plus WP-839's `anyHandCard` builder if it landed first). Prepare runs **two passes** ascending: pass 1 resolves every seat with no eligible Hero, pass 2 builds the holders' options (so the supply check sees every Wound gained at open). No eligible + no alternative → `` `${effectLabel} effect: Player ${seat} has no ${requirementLabel} Hero to discard.` `` `'blocked'`; with alternative → `gainWoundWithOutcome`: `… to discard and gained a Wound.` `'applied'` / `… to discard and would gain a Wound — Diving Block can prevent it.` `'applied'` / `… to discard; the Wound supply is empty.` `'blocked'`. Options: eligible hand cards in hand order (`resolveCardName` label + `cardId`), then `{ label: VILLAIN_EFFECT_WOUND_OPTION_LABEL }` only when the alternative is on and `G.piles.wounds.length > 0`. `defaultOptionIndex: 0`; step-2 ride rule.
- Apply (ascending seats): `cardId` → `discardFromHand`, `` `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Villain effect).` ``; no `cardId` → `gainWoundWithOutcome`: `Player ${seat} gained a Wound instead of discarding (Villain effect).` / `Player ${seat} would gain a Wound instead of discarding — Diving Block can prevent it.` (`'applied'`) / `Player ${seat} chose to gain a Wound, but the Wound supply is empty.` (`'blocked'`). Open and apply add 1 to `G.turnEconomy.woundsDrawn` for a non-`no-wound` outcome of the current player.
- Dispatch arm in `applySeatChoiceByKind` (passes `currentPlayer`); bot: the kind joins the `indexOfLeastValuableCard` branch. Heading `A Villain's effect — choose a Hero to discard`.
- Markers: Juggernaut `ambush: ["discard-hand-matching-hq-card-names-each-player", "hq-heroes-to-hero-deck-bottom"]`; Mystique `["discard-hero-each-player-by-trait:team:x-men"]`; Frost Giant Warrior `["discard-hero-or-wound-each-player-by-trait:hc:ranged"]`; The Leader `["play-villain-deck-cards:1:hc:strength"]`; Scorpion `["gain-wound:each!another-group-villain-in-city"]`. Provenance rows → WP-837 / D-24770.
- Pins (`villainAbility.types.test.ts`): in the L360-405 ordered-list test append the four primitives to `expectedPrimitives`, set the length to main's count + 4 (35 from the baseline) and the last-member assertion to `'hq-heroes-to-hero-deck-bottom'` / "(position N)"; L619 / L652 lengths to the same total (their position asserts stay); the conditions pin (~L590-608) 1 → 2.

## Guardrails
- One trait predicate for hand eligibility (`listEligibleHandCardsByTrait` → `traitMeetsDefeatRequirement` over `offPlayCardTraits`); the Leader reuses `playerHasHeroMatchingTrait`. A split card's team is its Hero's (both faces share it); its Hero Classes are both faces' (`offPlayCardTraits`). Do not edit `offPlayCardTraits`.
- One owed-discard FIFO; an entry without `traitFilter` routes byte-identically to `main` (WP-817's cost builder, plus WP-839's `anyHandCard` builder if it landed first); no drop-set or busy-guard edit.
- Every hand→discard through `discardFromHand`; every Wound through `gainWoundWithOutcome`.
- No new `G` key; `getLegalMoves` untouched; existing markers parse identically; hash oracles unchanged (STOP if one moves).
- Fail closed: no resolvable group → no Wound; gated play with no current player → no play.
- No parser reads English; markers only; never run `convert-cards-v15.mjs`. No game logic reads `G.cardDisplayData`.
- The client renders the heading only; no engine-internal import.
- No-UX-freeze: reuses the projected `G.pendingSeatChoice`, `PendingSeatChoicePrompt`, `resolveSeatChoice` and its End-Turn gate; no new `pending*` queue or move; every addressed seat has at least one option.

## Required `// why:` Comments
- `traitFilter` on the entry: one FIFO keeps rule order and in-flight entries route as before (D-24770 extends D-24750 point 9 to Ambush).
- `prepareVillainEffectTraitDiscardChoice` Wound branch and option: rules v23 L3199-3201 (choose only what you can do).
- `cardNameKeysOf`: card slug identity (reprints match); split = both faces (rules L2773-2778).
- HQ bottom: snapshot then refill (rules L749-753); haunters stay (L1539-1541).
- The condition arm: own group via the selected-group prefix, longest match, fail closed (D-24299 own-set precedent).
- The Leader counter + handler: one predicate, auto-reveal (D-24281); undefined player fails closed.
- The new primitive appends and the condition append, in the types array AND the script copies.

## Files to Produce
- Engine: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts`, `moves/villainDefeatRequirement.logic.ts`, `villainDeck/villainEscapeProcedure.ts`, `simulation/ai.seatChoice.ts` — each + its test — **modified**
- Engine: `moves/fightVillain.ts` (one argument), `types.ts`, `moves/seatChoice.resolve.ts` (one arm) — **modified**
- Client: `components/play/PendingSeatChoicePrompt.vue` + test — **modified**
- Scripts: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — **regenerated**; `wiki/card-effect-system.md` — **modified**
- Governance close: `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`; `docs/ai/post-mortems/01.6-WP-837-co2e-each-player-discard-and-reveal-gated-ambushes.md` — **new** (01.6 L42-51 mandatory)

## After Completing
- [ ] T1-T24 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Markers: 6 `[effect:]` on 5 `co2e.json` lines, nothing else in `data/cards/`; the re-run adds 0. Hand-checked script rejections recorded in the commit body.
- [ ] `pnpm ledger:villains && pnpm effect-index` after a rebuild; the five cards' Ambush mechanics `executable` (new ones with WP-837 provenance); the six feed checks → 0.
- [ ] Six revert proofs observed (condition arm; Leader gate; trait routing; base-id names; interleaved refill; Wound option on empty supply).
- [ ] Hash oracles unchanged. Allowlist-only diff. Two-commit topology `EC-875:` then `SPEC:`; the 01.6 post-mortem lands in the `SPEC:` close.
- [ ] D-24770 Active; STATUS (+ the keyword-less Ambush overlay note); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) post-deploy STATUS flip on a match **created after the deploy** (setup-built hooks live in the bgio `initialState`; an older match keeps the pre-WP-837 no-op hooks): one observed reveal per card, per WP §Definition of Done.

## Common Failure Smells
- The discard prompt never appears after a Mystique reveal → the trait entry was routed to the cost builder (empty `eligibleCosts` lists nothing) or the handler is not in the map.
- Frost Giant Warrior offers **Gain a Wound instead** with an empty Wound supply → the supply check is missing at build time, or prepare built a holder's options before a later non-holder took the last Wound (single pass).
- Juggernaut misses a reprint (core Cyclops vs co2e Cyclops) → names keyed by the full base id, not the slug.
- The HQ refills with the Heroes it just sent away while the Hero Deck had cards → refill interleaved with the push.
- Scorpion wounds with only a Sinister Syndicate Villain beside it → prefix not anchored with the trailing `-`, or the longest-match rule skipped.
- The Leader plays a card for a player holding a Strength Hero they already played → the reveal read the hand only; it must be `playerHasHeroMatchingTrait` (hand + still in play).
- The Leader never plays a card → a fire site still calls the counter without the current player (a gated read then returns 0).
- A sentinel hash moved → a new `G` key or a changed descriptor for a non-co2e card.
