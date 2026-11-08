# WP-868 — Villain Fight hollows: Heroes in the HQ cost less or more, a mandatory KO from your discard pile, and Mr. Immortal reenters the Sewers (Game Engine + UIState + arena-client + card data)

**Status:** Draft 2026-11-06 (EC-906; D-24811 reserved, PR #3189)
**Layer:** Game Engine (three villain primitives, one HQ cost overlay read by the recruit price, a `minCount` on the KO-from-discard
choice, one Fight fire-site bridge) + UIState (one optional projection field) + arena-client (the KO-from-discard prompt) + card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic (recruit price, discard pile, City entry) plus one chooser-only UIState field and one client
prompt; no auth, money, persistence or server surface
**Hard-deps:** WP-252 / D-24023 (parameterized villain primitives) ✅, WP-693 / D-24510 (the KO-from-discard pending choice, prompt
and bot default) ✅, WP-760 / D-24589 (`ko-up-to-from-discard-current`) ✅, WP-542 / D-24351 (the post-defeat Fight fire-site bridge
in `defeatCityVillainCore`) ✅, WP-757 / D-24587 (City entry without Ambush, `enterCityIgnoringAmbush`) ✅, WP-862 / D-24804 (the
HQ overlay read by `resolveRecruitCost`, cleared at Step 8 of end-of-turn cleanup) ✅, D-24266 (the `unmarked-ability` hollow
breadcrumb, Active) ✅

## Goal

In operator match `OZLV05npDB8` (2-player, Fin Fang Foom vs Midtown Bank Robbery, 2026-11-06) the Play Diagnostics hollow-effects
panel listed villain Fight lines from Monsters Unleashed (chmp) and Great Lakes Avengers (cvwr) that log `unmarked-ability` /
`no-handler` and do nothing. After this WP:

- **Tim Boo Ba** (chmp), Fight: "All Heroes currently in the HQ cost 1 less this turn." The Heroes in the HQ at that moment show
  and charge 1 less Recruit until end of turn. A Hero that refills the HQ later in the turn pays full price.
- **Flatman** (cvwr), Fight: "KO a card from your discard pile." The defeating player must KO one card from their discard pile.
  With one distinct card there it is KO'd with no prompt; with more, a prompt ("KO 1 card from your discard pile") asks which and
  cannot be skipped.
- **Mr. Immortal** (cvwr), Fight: "Reveal the top card of the Villain Deck. If it's a Villain or Bystander, Mr. Immortal reenters
  the Sewers." The top card is revealed and named in the log and stays on top. On a Villain (henchmen included) or a Bystander,
  Mr. Immortal leaves the Victory Pile and enters the City at the Sewers, pushing the City as a normal entry does.

The same three effects cover their exact-text siblings across the corpus (Scope (In), RS-4), plus four "You may KO a card from
your discard pile." lines that the shipped `ko-up-to-from-discard-current:1` already runs but nobody marked.

## User-Visible Impact

`play.legendary-arena.com`: after fighting Tim Boo Ba, the HQ prices drop by 1 for that turn. After fighting Flatman, a "KO 1
card from your discard pile" prompt appears with no "KO None" option. After fighting Mr. Immortal, the log names the Villain Deck
top card, and on a Villain or Bystander Mr. Immortal is back in the Sewers. The hollow-effects panel stops listing these lines.
Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `6eb0580c` (2026-11-06, after #3186, #3170 and #3173), with reserve PR #3189 on top; re-record at
  execution. `pnpm -r build` exits 0; game-engine `test` is green at the count recorded in §Verification Steps.
- **Sibling work, not dependencies:** INFRA #3170 (Big Bertha's Fight and Escape, `reveal-or-wound:hc:strength`) and INFRA #3186
  (Monsteroso's Fight `add-next-hand-size:1`, plus 23 reveal-or-wound lines) are **merged**. cvwr now has a
  `great-lakes-avengers` object in the marker map holding Big Bertha; Flatman and Mr. Immortal join that object. WP-864 (drafted)
  owns Trull the Unhuman's Ambush and Zzutak's Escape. It edits the same marker map and feeds, so whichever of WP-864 and WP-868
  executes later rebases and regenerates; no line overlaps. WP-869 (Groot's stack villains, drafted #3199) and WP-871 (Orrgo /
  Squirrel Girl / Doop fight restriction, drafted #3198) also edit `defeatCityVillainCore`; WP-869 puts its stack bridge after this
  WP's reenter bridge. Whichever executes later rebases; no card line overlaps.
- **Primitive positions are not locked.** `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` ~449) ends at position 39,
  `hq-hero-gains-size-changing`, at draft. WP-864 appends `demolish-each-player` and WP-869 `stack-cards-enter-city-as-villains`. This WP appends its three primitives after
  whatever is last at HEAD, in the order of RS-1, RS-2, RS-3. The length pins in `rules/villainAbility.types.test.ts` (~363,
  ~407-413, ~632, ~667, ~692, ~745) and the marker script's hand-synced copy
  (`scripts/convert-cards/apply-effect-markers.mjs` ~189-228) move with them.
- **Parser:** `setup/villainAbility.setup.ts` parses `[effect:<primitive>:<params>]` tokens per primitive (the
  `hq-hero-gains-size-changing` arm ~804 is the template; `parseHeroClassList` ~329). An unparseable token lands in the hook's
  `unresolvedMarkers`, never a partial descriptor. The marker script has its own grammar check, `isValidParameterizedEffectToken`
  (~319), with one arm per parameterized primitive (~440).
- **Executor:** `villain/villainEffects.execute.ts` dispatches through `VILLAIN_EFFECT_HANDLERS` (~4674). A keyword-less primitive
  self-narrates with `pushLog` and `villainEffectTimingLabel(timing)`; `resolveCardDisplayName` (~411, module-private today)
  names cards. The `ko-up-to-from-discard-current` handler (~2624) parks `PendingKoDiscardChoice` lazily, and logs a `blocked`
  no-op on an empty discard. A handler that mutates nothing must be listed in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (~835-840)
  or its trace mislabels as `fired`. Every KO path calls `G.ko = koCard(G.ko, id)` (`board/ko.logic.ts`) and
  `recordOwnedCardKoed(G, playerID, id, 'discard')` (`hero/deferredConditionalGrants.ts` ~196), as
  `resolveKoDiscardChoice` does (~236-238).
- **Recruit price:** `resolveRecruitCost(G, playerID, cardId)` (`hero/sizeChanging.logic.ts` ~152) is the single recruit price.
  `moves/recruitHero.ts` ~113, `simulation/ai.legalMoves.ts` ~1078 and `ui/uiState.build.ts` ~708 (`recruitCosts`) read it. But
  `UIHQState.recruitCosts` is projected only when `matchHasSizeChangingCard(gameState)` (`uiState.build.ts` ~666, ~681) is true
  (printed Size-Changing or `G.hqSizeChangingGrants`); without it the client's `canRecruit` falls back to the printed cost
  (`apps/arena-client/src/composables/useCardCostGating.ts` ~82). So the presence rule must also turn on while
  `G.hqCostChanges` exists; with that, the client needs no change for RS-1. It reads printed `G.cardStats[cardId].cost`, then
  `applySizeChangingDiscount`. `G.hq` is a 5-slot `HqZone` of `CardExtId | null`. Printed classes are
  `G.cardTraits[id].heroClass` / `heroClass2` (`state/cardTraits.types.ts` ~19). End-of-turn cleanup Step 8
  (`moves/endOfTurnCleanup.logic.ts` ~169) clears the WP-862 overlay.
- **KO-from-discard choice:** `PendingKoDiscardChoice` (`types.ts` ~1015: `maxCount`, optional `sourceCardId`, `greyFilter`,
  `eligibleCardIds`, all omit-when-absent). `resolveKoDiscardChoice` (`moves/koDiscardChoice.resolve.ts` ~165) accepts
  `0..maxCount` ids as a multiset of the chooser's eligible discard; `getEligibleKoDiscardCards` (~84) is the shared eligibility.
  `UIPendingKoDiscardChoice` (`ui/uiState.types.ts` ~1575) is built at `uiState.build.ts` ~1687-1720 and rebuilt field by field at
  `uiState.filter.ts` ~1160 (chooser-only). The bot answer is `selectDefaultKoDiscardCardIds` (`ai.legalMoves.ts` ~285: Wounds,
  then starting S.H.I.E.L.D. cards, up to `maxCount`). The prompt is `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue`
  (`canSubmit` is always true; the label reads "KO None" at zero picks).
- **Fight fire site:** `defeatCityVillainCore` (`moves/fightVillain.ts` ~559) pushes the fought card to the defeating player's
  Victory Pile, awards attached Bystanders and Heroes, runs `executeVillainAbilities(..., 'onFight', ...)`, emits
  `fightResolved`, then (~758) runs the Endless Armies of HYDRA bridge, which builds a `RevealContext` and imports
  `DEFAULT_IMPLEMENTATION_MAP` because the executor has no `implementationMap`. Every defeat path (a normal fight, Silent Sniper's
  defeat-with-bystander) runs this core.
- **City entry:** `pushVillainIntoCity(G.city, cardId)` (`board/city.logic.ts` ~56) places at space 0 (the Sewers) and returns the
  escaped card; `resolveVillainEscape(G, context, implementationMap, escapedCardId)` (`villainDeck/villainDeck.reveal.ts` ~598) is
  the full escape procedure. `enterCityIgnoringAmbush` (`villainDeck/villainDeck.enterCity.ts` ~40) chains the two with a fixed
  "exorcised" log line.
- **Villain Deck:** top is `G.villainDeck.deck[0]` (locked convention, `villainDeck.reveal.ts` ~243). `G.villainDeckCardTypes`
  maps each deck card to a `RevealedCardType` (`villain` / `henchman` / `bystander` / `scheme-twist` / `mastermind-strike`);
  converted cards (Skrulls, Brainwashed Officers, Micro-Sized Heroes) carry `villain` (`types.ts` ~2861).
- **Coverage:** `scripts/coverage/mechanic-provenance.json` maps each mechanic to `{ wp, decision }` for the villain ledger and
  effect index. Card data regenerates only through `apply-effect-markers.mjs` (never hand-edited JSON).

## Context (Read First)

- **Read first:** `docs/ai/ARCHITECTURE.md` §The Rule Execution Pipeline, §The Move Validation Contract, Architectural Principle
  #2 (UIState projection); `.claude/rules/architecture.md` §UIState Projection Integrity and §Layer Boundary; in
  `docs/ai/DECISIONS.md` D-24023, D-24266, D-24351, D-24510, D-24587, D-24589, D-24616, D-24801, D-24804;
  `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 Villain Group Shape and §5 Ability Text Markup Language;
  `docs/ai/REFERENCE/00.6-code-style.md`.

Every line here is a printed villain ability that the engine shows and then skips. The hollow breadcrumb (D-24266) made them
visible. Three engine effects are missing:

1. An HQ cost change for "this turn". WP-862 already built the pattern: an overlay keyed by the copy-unique HQ card id, read by
   `resolveRecruitCost` only while the card is in the HQ, cleared at end of turn. This WP adds a parallel overlay for a cost delta
   rather than stretching the Size-Changing grant, which has class semantics the cost change does not have.
2. A **mandatory** KO from your discard pile. The shipped choice is "up to N" (Loki, Salomé), so the prompt offers "KO None" and
   the bot may pick nothing. "KO a card" is not optional. A `minCount` on the same queue keeps the block-all guard, the resolve
   move, the projection and the prompt; only the minimum is new. The hero side's "You may KO a card from your hand or discard pile"
   (D-24480) is a different, optional line and is not touched.
3. Re-entering the City from the Victory Pile. The handler cannot reach the escape procedure (no `implementationMap`), so it is a
   deliberate no-op and a bridge at the Fight fire site does the work: the WP-481 / WP-542 executor-no-op plus fire-site-bridge
   pattern.

**Groot from Planet X is split out.** "Two Bystanders from the Bystander Stack enter the city as 3 Attack 'Splintered Half-Groot'
Villains. When you fight one, rescue it as a Bystander." needs a new `ConvertedVillainOrigin`, a fixed-Attack fight cost, a display
name, and its own defeat and escape routing in `defeatCityVillainCore` and the escape procedure. That is a separate contract surface
(the WP-823 Brainwash the Military / WP-863 Micro-Sized precedent), and it pairs naturally with cvwr Agent Gabe Jones's Fight and
Agent Eric Marshall's Ambush ("A S.H.I.E.L.D. Officer enters the city as a 3 Attack Villain"). It is a follow-up WP, not this one.

**Sibling scope.** Each new primitive takes its exact-text siblings, found by a corpus scan of `data/cards/*.json`: the marginal cost
is one marker line and one test row, and leaving them unmarked would keep known hollows. Lines whose text adds a condition (Gladiator's
Throne's Favor, Doctor Spectrum's Spectrum, Endless Armies of Chitauri's group test, Shang-Chi's discard test, Graviton's Hydra
Levels) stay out.

**Orrgo and Squirrel Girl.** Their fight restrictions ("You can't fight Orrgo unless…", "You can't fight Squirrel Girl if…") and
Squirrel Girl's Escape (Fortify the Sidekick Stack) are not implemented either. The restriction lines have no `Fight:` / `Ambush:` /
`Escape:` prefix, so D-24266 does not flag them, and the match did not list them. They are a follow-up (fight-restriction gating
plus Fortify), not this WP.

### RS-1 — HQ cost change (default locked)

Primitive `hq-heroes-cost-change`, grammar `hq-heroes-cost-change:<less|more>:<N>[:<c>[+<c>…]]` (3 or 4 colon-parts, i.e. 2 or 3
params; N a positive integer; the class list through `parseHeroClassList`). Descriptor: `magnitude` N, new `costChangeDirection: 'less' | 'more'`, new
optional `costChangeClasses`. The handler walks `G.hq` left to right and, for each non-null id whose printed class (heroClass or
heroClass2) is in `costChangeClasses` (or every id when absent), appends `{ cardId, amount }` with `amount = -N` (less) or `+N`
(more) to a new lazy `G.hqCostChanges`. `resolveRecruitCost` adds the summed amount for the card, only while it is in `G.hq`,
floors at 0, and then applies Size-Changing as before. `matchHasSizeChangingCard` also returns true while `G.hqCostChanges` is
defined, so `UIHQState.recruitCosts` carries the changed prices to the client (pre-flight PS-1). Step 8 of end-of-turn cleanup
deletes the field. Only the recruit price
changes; effects that read a Hero's cost ("costs 4 or less") keep the printed cost, as Size-Changing does (D-24801).

### RS-2 — Mandatory KO from your discard pile (default locked)

Primitive `ko-from-discard-current:<N>` (exactly 2 parts, N a positive integer → `magnitude`). The handler: an empty discard
logs `blocked` and parks nothing; a discard of N or fewer cards, or one whose cards share a single id (three Wounds), KOs the
first N directly (any copy is outcome-identical) through the same KO bookkeeping as the resolve move (`koCard` plus
`recordOwnedCardKoed`, so owned-card-KO grants see it) and logs it; otherwise it parks `PendingKoDiscardChoice` with `maxCount: N`,
`minCount: N`, `sourceCardId`. `minCount` is a new optional, omit-when-absent field. The required count everywhere is
`min(minCount, eligible count)` with `getEligibleKoDiscardCards`. The resolve move rejects a shorter selection, queue intact.
`UIPendingKoDiscardChoice` gains `minCount?` (five-step contract). The bot's two existing passes record each discard index they
take; for a mandatory entry the top-up then walks the untaken eligible indices in discard order up to the required count (tracked
by position, since ids repeat). The prompt
disables submit until the required count is picked, reads "KO 1 card from your discard pile", and never shows "KO None" for a
mandatory entry.

### RS-3 — Reenter the Sewers on a Villain Deck reveal (default locked)

Primitive `reenter-sewers-if-villain-deck-top:<kinds>`, kinds `villain`, `bystander` or `villain+bystander` (exactly 2 parts) →
new descriptor field `reenterRevealKinds`. `villain` matches `RevealedCardType` `villain` or `henchman` (Henchmen are Villains).
The handler returns `{ targets: [] }` and logs nothing, and the primitive joins `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` so its trace
is not mislabelled `fired`. A predicate `villainCardReenterSewersKinds(G, cardId, timing)` beside
`villainCardPlaysVillainDeckCards` returns the kinds or `null`. At the end of `defeatCityVillainCore`, after the Endless Armies
block, a bridge `reenterSewersOnVillainDeckReveal` (new, in `villainDeck/villainDeck.enterCity.ts`) runs in this order: (1) an
empty Villain Deck logs `blocked` and stops; (2) it logs the reveal of `G.villainDeck.deck[0]`, which it never moves; (3) a
non-matching type logs and stops; (4) a card no longer in the defeating player's Victory Pile logs `blocked` and stops; (5) it
removes the card from that Victory Pile with `moveCardFromZone`, pushes it into City space 0 with `pushVillainIntoCity`, logs, and
resolves any pushed-out card with `resolveVillainEscape` and `DEFAULT_IMPLEMENTATION_MAP`. Its `RevealContext` is built exactly
as the Endless Armies block builds one: `{ random: shuffleContext.random, ctx: { currentPlayer, turn: readTurnNumber(ctx) } }`.
It names cards with
`resolveCardDisplayName`, now exported from `villainEffects.execute.ts` (no cycle: `villainDeck.reveal.ts` already imports that
module). Reentering is not a reveal: no Ambush and no `onCardRevealed` hooks. The bridge records no secondary-site trace (dropped;
the log lines carry it). Rescued Bystanders and the `fightResolved` event stand: the Villain was defeated, then came back.

### RS-4 — Markers (default locked)

| Primitive token | Set / group / card | Timing |
|---|---|---|
| `hq-heroes-cost-change:less:1` | chmp `monsters-unleashed/tim-boo-ba` | fight |
| `hq-heroes-cost-change:less:1` | asrd `omens-of-ragnarok/jormungand-the-world-serpent` | fight |
| `hq-heroes-cost-change:less:1:instinct+tech` | vnom `life-foundation/dr-carlton-drake` | fight |
| `hq-heroes-cost-change:more:2` | msis `infinity-stones/the-mind-stone` | ambush |
| `ko-from-discard-current:1` | antm `ultrons-legacy/alkhema`, antm `queens-vengeance/star-knight`, cvwr `great-lakes-avengers/flatman`, msmc `clan-yashida/silver-samurai`, ssw2 `monster-metropolis/bug-shiklahs-dragon`, xmen `shiar-imperial-guard/smasher` | fight |
| `ko-from-discard-current:1` | cvwr henchmen `cape-killers` | fight |
| `ko-up-to-from-discard-current:1` (shipped) | cosm `black-order-of-thanos/supergiant`, mdns `lilin/meatmarket`, msis `children-of-thanos/outriders`, rvlt `hoods-gang/the-brothers-grimm` | fight |
| `reenter-sewers-if-villain-deck-top:villain+bystander` | cvwr `great-lakes-avengers/mr-immortal` | fight |

16 lines, 12 set files. Silver Samurai's Ambush stays in `_unassigned` (unrelated). Groot, Orrgo and Squirrel Girl stay unmarked.

## Scope (In)

- **Primitives** (`rules/villainAbility.types.ts`, a contract file, D-24811): three union members and array entries appended last;
  descriptor fields `costChangeDirection`, `costChangeClasses`, `reenterRevealKinds`.
- **Parser** (`setup/villainAbility.setup.ts`): three grammar arms (RS-1..RS-3).
- **Handlers** (`villain/villainEffects.execute.ts`): `villainEffectHqHeroesCostChange`, `villainEffectKoFromDiscardCurrent`,
  `villainEffectReenterSewersIfVillainDeckTop` (no-op, added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`) and their table entries;
  the exported predicate `villainCardReenterSewersKinds`; `resolveCardDisplayName` becomes exported.
- **HQ cost overlay:** `types.ts` `HqCostChange { cardId; amount }` and `G.hqCostChanges?`; new `hero/hqCostChange.logic.ts`
  (`addHqCostChange`, `getHqCostChange`, `clearHqCostChanges`); `resolveRecruitCost` reads it; cleanup Step 8 clears it;
  `matchHasSizeChangingCard` (`uiState.build.ts`) also turns on while it exists, so `recruitCosts` is projected.
- **Mandatory KO:** `types.ts` `PendingKoDiscardChoice.minCount?`; the minimum check in `resolveKoDiscardChoice`; the bot top-up in
  `selectDefaultKoDiscardCardIds`; `UIPendingKoDiscardChoice.minCount?` built, passed through the filter, tested; the prompt.
- **Reenter:** `reenterSewersOnVillainDeckReveal` in `villainDeck/villainDeck.enterCity.ts`; the bridge call in `defeatCityVillainCore`.
- **Data:** the marker script's primitive list and grammar arms; the 16 marker entries; regenerated card files.
- **Coverage:** `mechanic-provenance.json` rows for the three primitives → `{ wp: "WP-868", decision: "D-24811" }`; pending
  `live-verify.json` rows (Tim Boo Ba, Flatman, Mr. Immortal); regenerated `ledger:villains`, `effect-index`, `mechanics:metadata`,
  `sim:runtime-observed`, `sim:coverage` (baseline only if it moves), dashboard copies via `prebuild:coverage`.
- **Tests** (villain hooks built by the real parser from the committed card JSON, the `hero/amwpWaspSizeChanging.test.ts`
  precedent):
  - RS-1 (new `hero/hqCostChange.logic.test.ts`): Tim Boo Ba's Fight lowers every current HQ Hero's `resolveRecruitCost` by 1; a
    Hero placed in the HQ afterwards is unchanged; Dr. Carlton Drake changes only Instinct or Tech Heroes (a dual-class Hero with
    either counts); The Mind Stone's Ambush raises by 2; a 0-cost Hero stays 0; the change stacks with a Size-Changing discount in
    the locked order; a recruited Hero leaves the overlay inert; cleanup deletes `G.hqCostChanges`; an empty HQ logs `blocked`;
    in a match with no Size-Changing card, `buildUIState` carries `hq.recruitCosts` with the changed price while the overlay exists
    and omits it after cleanup.
  - RS-2 (new `villain/koFromDiscardMandatory.test.ts`): empty discard → no park; one card, or one shared id → direct KO, no park,
    `G.ko` gains it and the owned-card-KO record is written; two distinct → park with `minCount: 1`; `resolveKoDiscardChoice`
    rejects `[]` and accepts one id; the bot answer is never empty for a mandatory entry, including a discard of two Wounds plus a
    Hero; the Salomé "up to" entry still accepts `[]`.
  - RS-3 (new `villain/reenterSewers.test.ts`, through `defeatCityVillainCore`): top Villain, Henchman or Bystander → Mr. Immortal
    leaves the Victory Pile and is at City space 0; Scheme Twist or Master Strike → stays defeated; empty deck → stays; the top card
    is unmoved; a full City pushes its last card through the escape procedure; Mr. Immortal's own Bystanders stay rescued; the
    `onFight` trace for the primitive is not `fired` (the no-op set).
  - RS-4: every marked line in the table parses to its descriptor from the committed JSON; malformed tokens
    (`hq-heroes-cost-change:less`, `ko-from-discard-current:0`, `reenter-sewers-if-villain-deck-top:twist`) land in
    `unresolvedMarkers`.
  - Projection: `uiState.filter.test.ts` asserts `minCount` survives for the chooser, and `Object.hasOwn(choice, 'minCount')` is
    false for the Salomé entry (the WP-850 omit-when-absent precedent);
    `PendingKoDiscardChoicePrompt.test.ts` asserts submit is disabled at zero picks and no "KO None" text for a mandatory entry, and
    unchanged for an "up to" entry.
  - Pins: `rules/villainAbility.types.test.ts` list, lengths, last-entry assert and the count strings / `// why:` comments.
  - Expected unchanged: every `finalStateHash` sentinel and golden hash (all new state is lazy and absent from the sentinel games).

## Out of Scope

- **Groot from Planet X** and the cvwr S.H.I.E.L.D. Elite "Officer enters the city as a 3 Attack Villain" lines: a follow-up WP
  (Context).
- Orrgo's and Squirrel Girl's fight restrictions and Squirrel Girl's Fortify Escape: a follow-up.
- Big Bertha (#3170), Monsteroso (#3186), Trull and Zzutak (WP-864).
- Conditional siblings: Gladiator, Doctor Spectrum, Endless Armies of Chitauri, Shang-Chi, Graviton; The Mind Stone's Attack bonus
  and Fight; Jormungand's Conqueror.
- xmen "Ambush: Heroes cost 1 more to recruit this turn." (no "currently in the HQ", so later refills count too: different
  semantics) and the Bystander "When you rescue this Bystander, each [Instinct] and/or [Covert] Hero currently in the HQ costs 1
  less this turn." (a rescue trigger, not a villain line).
- Cost-threshold reads ("a Hero that costs 4 or less") seeing the changed cost; any change to hero-side KO keywords.
- A secondary-site trace for the reenter bridge.
- Any new move, pending queue, server change, or `replay/replay.execute.ts` change.

## Files Expected to Change

- Engine source (modified unless noted): `packages/game-engine/src/rules/villainAbility.types.ts`,
  `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `types.ts`, `hero/hqCostChange.logic.ts` (**new**),
  `hero/sizeChanging.logic.ts`, `moves/endOfTurnCleanup.logic.ts`, `moves/koDiscardChoice.resolve.ts`, `moves/fightVillain.ts`,
  `villainDeck/villainDeck.enterCity.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.types.ts`, `ui/uiState.build.ts`,
  `ui/uiState.filter.ts`.
- Client: `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue`.
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`; generated
  `data/cards/{antm,asrd,chmp,cosm,cvwr,mdns,msis,msmc,rvlt,ssw2,vnom,xmen}.json`.
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`; `apps/dashboard/src/data/in-play-hollow-baseline.json` and
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` only if the in-play pin moves (the other dashboard data copies are
  gitignored).
- Tests (the RS-1 `buildUIState` `recruitCosts` case lives in `hqCostChange.logic.test.ts`, so `uiState.build.test.ts` is not
  touched): new `packages/game-engine/src/hero/hqCostChange.logic.test.ts`, `villain/koFromDiscardMandatory.test.ts`,
  `villain/reenterSewers.test.ts`; modified `rules/villainAbility.types.test.ts`, `ui/uiState.filter.test.ts`,
  `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24811), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O. `for` loops; no `.reduce()`, no nested ternaries. Moves and handlers never throw.
- New `G` state is lazy and omit-when-absent (`G.hqCostChanges`, `minCount`), so a match that never fires these lines keeps a
  byte-identical `finalStateHash`.
- The UIState field follows the five-step Board-Visible Field Rule (`.claude/rules/architecture.md`); it is chooser-only.
- Card data changes only through the marker sources plus a reproducible regen (`cards:check`); never hand-edit generated card JSON.
  No per-card special-casing: every effect runs from its marker.

**Session protocol:** STOP and report if any `finalStateHash` sentinel or golden hash moves; if the regen changes a card file not
in §Files Expected to Change; or if the Salomé / Maniacal Tyrant "up to" tests change behavior.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- Villain primitives `hq-heroes-cost-change`, `ko-from-discard-current`, `reenter-sewers-if-villain-deck-top`, appended last in
  that order; descriptor fields `costChangeDirection`, `costChangeClasses`, `reenterRevealKinds`.
- `G.hqCostChanges?: HqCostChange[]`; `PendingKoDiscardChoice.minCount?: number`; `UIPendingKoDiscardChoice.minCount?: number`.
- `hero/hqCostChange.logic.ts`: `addHqCostChange`, `getHqCostChange`, `clearHqCostChanges`.
- `villainCardReenterSewersKinds(G, cardId, timing)`; `reenterSewersOnVillainDeckReveal(G, context, implementationMap,
  currentPlayer, cardId, kinds)`.
- `resolveRecruitCost`, `resolveKoDiscardChoice` and `defeatCityVillainCore` keep their signatures.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** printed abilities that do nothing today resolve as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; these are printed card abilities and nothing is bought.
- **Determinism preservation:** no randomness; all new state is a pure function of `G` and lazy. Pre-WP-868 replays that hit these
  lines diverge on re-execution; stored competitive rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A: no nav, pricing or funding surface.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. After Tim Boo Ba's or Jormungand's Fight, every Hero in the HQ at that moment costs 1 less to recruit this turn (floored at 0,
   before Size-Changing); a later HQ refill pays full price; Dr. Carlton Drake changes only Instinct and Tech Heroes; The Mind
   Stone's Ambush makes them cost 2 more. Next turn prices are printed again.
2. After Flatman's Fight (and the six siblings) the player KOs exactly one card from their discard pile: directly when the choice
   cannot matter, otherwise through a prompt with no "KO None"; the resolve move and the bot never accept or submit zero. The four
   "You may" lines offer the shipped "up to 1" prompt.
3. After Mr. Immortal's Fight the log names the Villain Deck top card, which stays on top. On a Villain, Henchman or Bystander he
   leaves the Victory Pile and is in the Sewers, and any card pushed out escapes normally; otherwise he stays defeated.
4. `UIPendingKoDiscardChoice.minCount` reaches the chooser only, and appears in Play Diagnostics `uiStateSnapshot`.
5. `cards:check` reproduces the card data; the villain ledger lists the 16 lines as executable; every feed `:check` exits 0.
6. Engine, arena-client and dashboard suites green; `pnpm -r build` exits 0; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate, in this order, after the engine change builds:

- Add the provenance rows and pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs`: exits 0; only the 12 listed card files change.
- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --check`
  (`--update-baseline` only if it reports a move), `pnpm --filter @legendary-arena/dashboard prebuild:coverage`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green. Draft baseline 6387 (below); record the exact delta and expect at
  least +20.
- `pnpm --filter @legendary-arena/arena-client test` and `pnpm --filter @legendary-arena/arena-client typecheck`; `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm cards:count-markers:check`.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check`.

Draft baseline (worktree at `9d668cc6` + #3189, after `pnpm -r build`): game-engine `test` 6387 / 6387 pass, 0 fail; `git status`
clean after the build.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine, arena-client and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Generated feeds regenerated and every `:check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels and golden hashes byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a match with Monsters Unleashed and Great Lakes Avengers **created after the deploy**
      (`isMatchOlderThanServer: false`): Tim Boo Ba's Fight drops the HQ prices by 1 for the turn; Flatman's Fight KOs a discard card
      (a prompt with no "KO None" when it holds two distinct cards); Mr. Immortal's Fight logs the reveal and, on a Villain or
      Bystander, he is in the Sewers; Play Diagnostics `uiStateSnapshot` shows `pendingKoDiscardChoice.minCount` while Flatman's
      prompt is open (Board-Visible Field Rule step 5). Confirmed live, or operator-pending in `STATUS.md` with the pending
      `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24811 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24811: Three villain primitives close the `unmarked-ability` hollows from operator match `OZLV05npDB8` and their exact-text
siblings. (1) `hq-heroes-cost-change:<less|more>:<N>[:<classes>]` snapshots the Heroes in the HQ when it fires into a lazy
`G.hqCostChanges` overlay keyed by the copy-unique card id; `resolveRecruitCost` adds it only while the card is in the HQ, floors
at 0, then applies Size-Changing; end-of-turn cleanup deletes it; while it exists `UIHQState.recruitCosts` is projected. Only the
recruit price changes ("currently in the HQ" excludes later refills; cost-threshold reads keep the printed cost, as with D-24801).
(2) `ko-from-discard-current:<N>` is the mandatory "KO a card from your discard pile": it KOs directly (with the standard `koCard`
and owned-card-KO bookkeeping) when the pick cannot matter, and otherwise parks the D-24510 choice with a new omit-when-absent
`minCount`, which the resolve move, the bot answer, the chooser-only projection and the prompt all enforce against
`min(minCount, eligible count)`. (3) `reenter-sewers-if-villain-deck-top:<kinds>` is a deliberate executor no-op (listed in
`DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`) with a bridge at the end of `defeatCityVillainCore` (the D-24351 pattern): it reveals the Villain Deck top without moving it and, on a matching type (Henchmen count as Villains), moves the
defeated card from the Victory Pile into the Sewers through `pushVillainIntoCity` and `resolveVillainEscape`, with no Ambush.
Groot from Planet X is a separate WP. Replays of pre-WP-868 matches with these lines diverge; stored competitive rows stay frozen
(D-24616 §5).

### Execution amendment (2026-11-07) — the KO-site drift pin and two test shapes

Execution at `origin/main` `ecd7d9af` (WP-864 / WP-869 / WP-871 not yet executed, so the three primitives
sit at positions 40, 41 and 42) surfaced one file beyond `## Files Expected to Change`, added as an inline
allowlist amendment:

- `packages/game-engine/src/hero/ownedCardKoTrigger.test.ts` — **modified** — the WP-853 / D-24789 KO-site
  drift pin scans every `koCard` call by enclosing function and fails until a new site is classified. The
  direct mandatory KO (RS-2, `koFirstDiscardCardsDirectly` in `villainEffects.execute.ts`) is a new owned
  site, so `LOCKED_TABLE` gains `{ koSites: 1, ownedRecords: 1 }` for it. The classification is the one the
  pin's failure message asks for (the card leaves the player's discard pile and `recordOwnedCardKoed` is
  called beside it); no other row or assertion changed.

Two test shapes differ from the Scope (In) wording, with no contract change:

- The required count `min(minCount, eligible count)` lives in one exported helper,
  `getRequiredKoDiscardCount` (`moves/koDiscardChoice.resolve.ts`), which both the resolve move and the bot
  top-up call (the EC's "one implementation" guardrail).
- RS-3's "a full City pushes its last card through the escape procedure" calls
  `reenterSewersOnVillainDeckReveal` directly: a Fight empties its own space, so through
  `defeatCityVillainCore` the push can never reach the escape edge. Every other RS-3 case runs through
  `defeatCityVillainCore`. The malformed-token RS-4 cases for all three primitives live in
  `villain/koFromDiscardMandatory.test.ts`.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY, four PS items, all folded: (PS-1) `UIHQState.recruitCosts` is projected only under
  `matchHasSizeChangingCard`, now widened by `|| gameState.hqCostChanges !== undefined` and tested through `buildUIState` in
  `hqCostChange.logic.test.ts`; (PS-2) `resolveCardDisplayName` is exported for the bridge; (PS-3) the direct mandatory KO uses
  `koCard` + `recordOwnedCardKoed(..., 'discard')` like `resolveKoDiscardChoice`; (PS-4) the reenter no-op joins
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` with a trace assertion. RS 1-6 folded: no secondary-site trace, an index-tracked bot
  top-up, the `Object.hasOwn` omit-when-absent assertion, comma-joined names, locked log strings and reenter order. Empirical
  scaffold not required (not validation-tightening: the minimum applies only to entries that carry `minCount`, which nothing parks
  today).
- **Lint round 1:** FAIL §4 plus nine fixes, all folded (Context list, arena-client typecheck literal, prompt text, one
  `required = min(minCount, eligible count)` basis, empty-discard log, colon-part wording, reenter order, Board-Visible step 5,
  xmen / Bystander lines Out of Scope, EC under 100 content lines).
- **Round 2 (all three gates, after the folds):** pre-flight **READY TO EXECUTE**, copilot **PASS**, lint **PASS**. Every round-1
  item was confirmed against source at HEAD and consistent between WP and EC. Folded wording: Assumes records #3170 / #3186 as
  merged (cvwr `great-lakes-avengers` already holds Big Bertha); the arena-client typecheck literal in both EC checklists; the
  bot's passes record taken indices; the bridge builds its `RevealContext` as the Endless Armies block does; Context cites 00.2
  §1.4 / §5. The other 28 copilot modes were verified clean.

## Lint Gate Self-Review (00.3)

- **§1 structure:** every required section present; Out of Scope names Groot, the S.H.I.E.L.D. Elite lines, Orrgo / Squirrel
  Girl, sibling PRs, conditional siblings, the xmen and Bystander lines and the secondary trace; six binary criteria. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, 00.6; determinism, lazy omit-when-absent state, five-step UIState rule,
  marker-only data; three STOP triggers; locked values → EC. **PASS.**
- **§3 Assumes:** seven hard-deps ✅ plus every helper, type, pin and fire-site fact with file and line, verified by two
  pre-flight rounds. **PASS.**
- **§4 Context:** ARCHITECTURE sections, `.claude/rules` sections, a D-entry list, 00.2 §1.4 / §5 and 00.6; RS-1..RS-4 locked;
  Groot / Orrgo split-outs justified. **PASS.**
- **§5 files:** every file with path, new marked; 14 engine files justified as one cohesive hollow set (WP-862 precedent);
  gitignored dashboard copies called out. **PASS.**
- **§6 naming:** full words (`hqCostChanges`, `reenterSewersOnVillainDeckReveal`, `villainCardReenterSewersKinds`); slugs
  verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency; engine + one chooser-only UIState field + one client prompt; no server,
  registry or boardgame.io import added. **PASS.**
- **§9 Windows:** `pnpm` / `node` only. **PASS.** **§10 / §11:** no env var, no auth. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks from the real parser on committed JSON; runtime pins (D-24372); malformed tokens
  through `unresolvedMarkers`; Salomé "up to" regression. **PASS.**
- **§13 verification:** exact regen and check commands with exits; engine baseline 6387, +20 floor. **PASS.**
- **§14 / §15:** six binary criteria; DoD names governance close, the diff allowlist check, and D-24026 live-verify incl.
  `uiStateSnapshot` (§15.1, operator-pending fallback). **§15.2:** `MEDIUM` verbatim in WP and EC. **PASS.**
- **§16 code-style:** reuses `getEligibleKoDiscardCards`, `pushVillainIntoCity`, `resolveVillainEscape`, the WP-862 overlay
  pattern; `for` loops, no `.reduce()`, no nested ternaries; `// why:` sites listed in the EC. **PASS.**
- **§17 Vision:** §1 / §2 / §8 / §10 / §22, no-conflict, NG-1 and determinism lines. **PASS.**
- **§18:** no literal-grep step. **N/A.** **§19:** baseline re-recorded at execution; merged siblings noted. **PASS.**
  Contract file `villainAbility.types.ts` gains three appended primitives, covered by D-24811.
- **§20 funding / §21 API catalog:** N/A, stated. **PASS.**
