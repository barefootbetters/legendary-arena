# WP-836 — Core 2E grey-Hero and Hero-count effects: Destroyer, Frost Giant Warrior, Ymir, Abomination, Beetle, Savage Land Mutates (Game Engine + card data)

**Status:** Draft 2026-10-25 — READY TO EXECUTE: pre-flight READY, copilot RISK (fixes 1-6 applied), 00.3 PASS (EC-874; **D-24769** reserved, #3010). See §Gate Record.
**Primary Layer:** Game Engine (+ card-data markers and the derived coverage feeds). No client change.
**Dependencies:** none hard beyond `main`. Soft: WP-835 (same marker-map `co2e` blocks and `co2e.json`) and WP-837..840 (they also append villain primitives); either order, rebase the shared blocks (see §Context).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes one contract file (`rules/villainAbility.types.ts`: three primitives, a filter type, two descriptor fields) and two pending-choice shapes (`types.ts`), and extends two existing primitives' grammar.
**Arc:** Core 2E villain fidelity (inventory rows #8, #9, #10, #13, #15, #22, #33, H2), packet 2 of 6 (WP-835..840).

> Baseline: drafted on `origin/main` `5e045fa9` plus the reserve `677c4109` (#3010); `origin/main` is now `e580d801` (WP-830 #2998 merged, anchor shifts only). Re-read line anchors, the primitive count (31 at draft) and test totals at execution.

---

## Goal

As a player using the Core 2nd Edition villain groups, I want eight printed lines that do nothing today to do what they print, so that Enemies of Asgard, Radiation, the Sinister Syndicate and the Savage Land Mutates play like the tabletop game instead of giving free Victory Points.

| Card (`co2e`) | Line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| Destroyer (`enemies-of-asgard`) | `Ambush: Each player KOs a non-grey Hero from their discard pile.` | No marker; nothing happens (ledger `(unmarked)`). | Every player KOs one Hero with a Hero Class from their discard pile. You pick yours when you have a real choice; other players lose their cheapest. |
| Destroyer | `Fight: KO up to two grey Heroes from your discard pile.` | Nothing. | You may KO 0-2 grey Heroes (S.H.I.E.L.D. Agents, Troopers, Officers, Sidekicks, other classless Heroes) from your discard pile. |
| Destroyer | `Escape: Repeat the Ambush effect.` | Nothing. | Same as the Ambush. |
| Frost Giant Warrior | `Fight: You may KO a grey Hero from your discard pile.` | Nothing. | You may KO 0-1 grey Hero from your discard pile. |
| Ymir, Frost Giant King | `Fight: You may KO a grey Hero from your discard pile.` | Nothing. | Same. |
| Abomination (`radiation`) | `Fight: You get +1[icon:recruit] for each of your [hc:strength] Heroes.` | Nothing. | +1 Recruit per Strength Hero in your hand and play area. |
| Beetle (`sinister-syndicate`) | `Fight: Count your [hc:covert] Heroes, then draw that many cards.` | Nothing. | You draw one card per Covert Hero in your hand and play area (counted before drawing). |
| Savage Land Mutates (henchmen) | `Fight: Reveal the top card of your deck. If it's grey, KO it. If it's [hc:strength] or [hc:instinct], draw it.` | Nothing. | The top card is KO'd if grey, drawn if Strength or Instinct, otherwise left on top. |

Core Savage Land Mutates (`core`, `add-next-hand-size:1`) and Core Destroyer / Ymir are not touched.

## User-Visible Impact

- Revealing or escaping a Core 2E Destroyer opens the existing "Choose a Hero to KO" prompt listing only your discard pile's non-grey Heroes (or auto-KOs when there is no real choice). The log names what every player lost.
- Defeating Destroyer, a Frost Giant Warrior or Ymir opens the existing "KO up to N cards from your discard pile" prompt listing only your grey Heroes; picking none is allowed.
- Defeating Abomination logs `+N recruit` and names the Strength Heroes it counted; Beetle logs the cards drawn and the Covert Heroes counted; Savage Land Mutates logs the revealed card and whether it was KO'd, drawn or left.
- Bots and autoplay resolve every new prompt (no frozen turn).

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L1487-1492: "grey Heroes" are "grey-colored cards with no Hero Class, like S.H.I.E.L.D. Agents, Troopers, Officers or Sidekicks"; Grey Hulk and Jean Grey are not grey Heroes.
   - L2906-2911 and L3200-3207: Hero Class and color are the same thing except a sixth color, grey, for cards with no Hero Class; S.H.I.E.L.D. Heroes and Sidekicks count as Heroes and are grey.
   - L3380-3387: special Officers with a Hero Class are not grey.
   - L3404-3407: Wounds aren't Heroes and have no color, "not even grey".
   - L3436-3447: "Your Heroes" / "Heroes you have" = cards in your hand + cards you played this turn still in play; deck and discard don't count.
   - L3201-3207 ("Reveal the Top Card of Your Deck"): with no destination stated, the card stays on top.
2. **Card text and markers on the baseline.** The eight lines in §Goal are verbatim in `co2e.json` (`enemies-of-asgard` id 2, `radiation` id 5, `sinister-syndicate` id 7, henchman `savage-land-mutates` id 3, ability text at group level). On draft `main` (`677c4109`), `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.co2e` holds only `masters-of-evil` and `skulls`, and `henchmen.co2e` holds only `doombot-legion`. If any sibling WP-835..840 merged first, its rows sit beside these. That is expected (EC Before Starting line 2) and does not block. What must hold: none of *this packet's* eight §Goal lines carries an `[effect:]` marker, and `henchmen.core.savage-land-mutates` is `add-next-hand-size:1`. The ledger rows for Destroyer, Abomination and co2e `henchman-savage-land-mutates` are `(unmarked)`. Some rows may already be `executable` from a sibling:
   - Frost Giant Warrior: `(unmarked)`, or `executable` if WP-837 landed (its Ambush).
   - Ymir: `(unmarked)`, or `executable` if WP-839 landed (its Ambush).
   - Beetle: `(unmarked)`, or `reveal-or-wound` / `executable` if WP-835 landed.

   Ledger anchors on draft `main`: `docs/ai/coverage/villain-mechanic-ledger.csv` L123, L126, L128, L132, L143, L159.
3. **No engine grey helper is reachable from the villain path.** `rules/mastermindHandlers.ts` has two private copies (`isNonGreyHero` L141, reading raw `G.cardTraits`; the `'non-grey'` kind of `selectLowestCostHero` ~L551-600, reading `offPlayCardTraits`). WP-830's `enigmaColorsOf` (`rules/enigmaCode.logic.ts`, merged #2998, `e580d801`) reads grey with the same semantics, is not on the villain path, and joins the consolidation follow-up. `isCullableDeckTopCard` (`villain/villainEffects.execute.ts` L2819) is Wound + Agent + Trooper, not grey. `BASIC_SHIELD_EXT_IDS` (L2920) is the Destroyer team-shield widening, not grey.
4. **Trait data.** `G.cardTraits` holds one entry per registry Hero card (`setup/buildCardTraits.ts` L201-231; `heroClass` is `null` when the card prints no class). The synthetic cards `starting-shield-agent`, `starting-shield-trooper`, `pile-shield-officer`, `pile-sidekick`, `pile-wound`, `pile-bystander` (`setup/pilesInit.ts` L22-43) have no entry. `hero/splitCard.logic.ts` `offPlayCardTraits(G, cardId)` (L91) is the off-play view (a split card = both faces' classes); `offPlayCardStats` (~L126) the off-play cost. The module imports types only. `HERO_CLASSES` (`content/content.schemas.ts` L67) = `tech, covert, strength, ranged, instinct`; `normalizeTraitSlug` = `trim().toLowerCase()`.
5. **Each-player discard KO** (`villain/villainEffects.execute.ts`): `villainEffectKoHero` `target: 'each'` (L1193-1275) iterates sorted seats; with `descriptor.zone` it parks the current player via `parkZoneKoChoice` (L1294; `countKoableHeroes(zones, allowed) <= magnitude` or `< 2` distinct → forced) and auto-KOs every other seat via `koHeroesFromZoneForPlayer` (L4146, `selectKoHeroTarget` starter-first then lexical, L4196). `buildKoEligibleTargets` (L4236) and `countKoableHeroes` (L4282) take `(zones, allowedZones?)` and are also called by `moves/koHeroChoice.resolve.ts` L155/L160, `rules/mastermindHandlers.ts` L720-721 and `ui/uiState.build.ts` L1264. `descriptorKey` (`rules/villainAbility.types.ts` L679) excludes `zone`, so `ko-hero:each:1:discard` reverse-maps to `koHeroEachPlayer` and narrates through the generic line (D-24280).
6. **The KO-a-Hero choice.** `PendingKoHeroChoice` (`types.ts` L516-536: `choiceType`, `playerID`, `remaining?`, `zones?`). `resolveKoHeroChoice` (`moves/koHeroChoice.resolve.ts` L79) rejects a Wound and a zone outside `zones` (L104), KOs, and auto-resolves a forced remainder (L150-170). Bot: `simulation/ai.legalMoves.ts` L713-742, the discard-zone branch L728-735 uses `selectKoHeroTarget(zones.discard)`. Projection: `ui/uiState.build.ts` L1256-1284.
7. **The KO-from-discard choice** (WP-693 / D-24510, WP-760 / D-24589): `PendingKoDiscardChoice` (`types.ts` L966-980: `choiceType`, `playerID`, `maxCount`, `sourceCardId?`). `villainEffectKoUpToFromDiscardCurrent` (L2380) logs and no-ops on an empty discard, else parks and logs `Fight effect: KO up to ${N} cards from your discard pile (${name}).` `moves/koDiscardChoice.resolve.ts`: `getEligibleKoDiscardCards(G, playerID)` (L71, whole discard; test-only caller today), the resolve (0..maxCount ids, multiset presence check, front-pop). Bot: `selectDefaultKoDiscardCardIds` (`ai.legalMoves.ts` L280: Wounds first, then Agents / Troopers, capped). Projection: `uiState.build.ts` L1591-1608 loops the raw discard. The client prompt renders whatever `discard` it gets; its heading reads `KO up to N card(s) from your discard pile`.
8. **Count, draw and reveal templates** (`villainEffects.execute.ts`): `listPlayerHeroesMatchingTrait` (L1964, hand via `offPlayCardTraits` + `playedCardIdsStillInPlay` with granted classes, D-24724 / D-24692) and `describeTraitCountedHeroes` (L2034) — the Maestro / Baron Zemo counter. `villainEffectDrawCardsCurrent` (L2252: `drawCardsIntoHand(zones, n, shuffleContext)`, `G.turnEconomy.cardsDrawn += drawn`, no-op without `shuffleContext`). `villainEffectRevealTopDrawIfCostLte` (L2322: empty deck → `reshuffleDiscardIntoDeck`, deck → hand by `moveCardFromZone`, `cardsDrawn += 1`, the empty-deck line `Fight effect: no card to reveal — your deck and discard pile are empty.`). `villainEffectTimingLabel` (L1812), `resolveCardDisplayName` (L372), `cardTraitMatches` (L1844), `koCard`, `pushLog` are in scope. Handler map `VILLAIN_EFFECT_HANDLERS` L3951.
9. **Parser** (`setup/villainAbility.setup.ts`): `parseUngatedEffect` L490; the `ko-hero:each:<N>:<zone>` arm L526-536; the shared `reveal-top-draw-if-cost-lte` / `ko-up-to-from-discard-current` `:<N>` arm L671-688; `parseTraitPredicateTokens` L285 (`<kind>:<value>`, kind `team` | `hc`); `parsePositiveInteger` L225. Henchman hooks are onFight only, keyed `henchman-${slug}-NN` from the set named in `henchmanGroupIds` (L1070-1121), so a `co2e/savage-land-mutates` marker never reaches a `core/savage-land-mutates` match.
10. **Primitive vocabulary.** 31 members on draft `main` (`rules/villainAbility.types.ts` union L335-366, array L434-483, last `discard-hero-each-player-by-cost`), or `main`'s count after any of WP-837..840 that landed first (re-read; either is fine). The primitive tests in `rules/villainAbility.types.test.ts` read that count: the in-order drift test (~L359-406: expected list, length, "appended last" pin) and two length pins (~L618-619, ~L651-652). The marker script `scripts/convert-cards/apply-effect-markers.mjs` keeps a hand-synced copy (L175-206) and `isValidParameterizedEffectToken` (L271; ko-hero arm L288-307, the `:<N>` arm L364-369, the trait arm ~L383-397).
11. **Fire sites.** Ambush: `villainDeck/villainDeck.reveal.ts` L347 (`{ random }` passed). Escape: same file ~L661. Fight: `moves/fightVillain.ts` L608 (`shuffleContext`). All three already carry the Juggernaut / Salomé / Maestro parks; no fire-site change is needed.
12. **No hashed fixture or PAR artifact plays these groups.** `co2e/enemies-of-asgard`, `co2e/radiation`, `co2e/savage-land-mutates` appear only in `packages/registry/src/gauntletLoadouts.generated.ts`, inline test text (`setup/buildCardAbomination.test.ts`) and registry/server gauntlet tests that name `core/…` groups. `co2e/sinister-syndicate` appears nowhere. The hash sentinel is `core/dr-doom`; the runtime-observed sweep uses `core/brotherhood` + `core/savage-land-mutates` (`scripts/runtime-observed-hollows.mjs` L134-135). `pnpm cards:check` excludes `co2e` (`scripts/check-card-data-regen.mjs` L51).
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24769) before coding.

## Context (Read First)

- **What "grey Hero" means here (locked in D-24769).** A grey Hero is a card in a player zone that is a Hero (not `pile-wound`, not `pile-bystander`) and whose off-play traits carry neither `heroClass` nor `heroClass2`. That covers the four synthetic S.H.I.E.L.D. / Sidekick cards (no `G.cardTraits` entry) and any registry Hero printed without a class (rules L1487-1492); a classed special Officer is not grey (L3380-3387); a Wound is neither grey nor non-grey (L3404-3407). A split card off play is its faces' classes, so never grey. One exported predicate in `hero/splitCard.logic.ts` beside `offPlayCardTraits` serves the villain executor, both resolve moves, the bot and the projection.
- **Why extend two primitives and add three.** "KO a non-grey Hero from their discard pile" is `ko-hero:each:1:discard` with a filter, and "KO up to N grey Heroes from your discard pile" is `ko-up-to-from-discard-current:N` with a filter, so both gain one optional trailing token and reuse their existing choices, moves, prompts and bot branches. The per-trait recruit and draw are counts, not fixed magnitudes, so they are new primitives beside `ko-heroes-current-count-by-trait` (the D-24353 precedent: count-sized variants get their own primitive and keep the fixed-magnitude grammar untouched). Savage Land's three-way reveal has no existing primitive.
- **Interactive vs auto (D-24284 / D-24644).** The Destroyer KO parks only for the current player, only with a real choice; other seats auto-pick. The other seats' pick, and the bot's pick for the current player (D-24009 parity), is the **lowest-cost** non-grey Hero (ties → lexically smallest ext_id) — the rational "each player chooses" answer; the D-24644 starter-first rule cannot apply because starters are grey. The two grey KOs are "up to" / "may", so they always park when an eligible card exists (the Salomé shape).
- **"Your Heroes" for Abomination and Beetle** is hand + still in play (rules L3436-3447, D-24529 / D-24692), read through `listPlayerHeroesMatchingTrait`, so they count exactly what Maestro and Baron Zemo count. Beetle counts before it draws.
- **Savage Land's three outcomes are disjoint**: a grey card has no class, so it can never also be Strength or Instinct. A Wound on top matches neither and stays. The draw is a real draw (deck → hand, `cardsDrawn += 1`), the Patriarch precedent, so the hero-effect draw lock does not apply (WP-731 precedent for villain-driven draws).
- **No client change.** Both prompts are eligible-list driven, so filtering the projected list is enough. The KO-from-discard heading keeps reading "cards" (see Operator forks).
- **Soft ordering.** WP-835 (drafted in parallel) adds `co2e` rows to the same marker-map blocks (`villains.co2e`, `henchmen.co2e`) and regenerates `co2e.json`; WP-837 and WP-839 add `ambush` keys to the same Frost Giant Warrior / Ymir objects; WP-837..840 append primitives to the same union, array, handler map, script copy and count pins. Whichever lands second rebases those blocks and renumbers positions; this WP's positions are "the next three after `main`'s last".
- **Split vs one WP.** Eight lines share one predicate, one marker map, the parser / executor pair, and two existing choices. A split would land the grey predicate twice.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain / henchman group shape), §5 (printed markup; `[effect:]` is a pipeline-appended marker).
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract, §Zone & Pile Structure, §The Rule Execution Pipeline, Persistence Boundaries.
- `docs/ai/DECISIONS.md`: scan D-24009, D-24023, D-24034, D-24081, D-24266, D-24280, D-24284, D-24285, D-24290, D-24353, D-24364, D-24372, D-24510, D-24529, D-24589, D-24644, D-24682, D-24687, D-24688, D-24692, D-24724, D-24729 before coding.
- User memory: `reference_villain_effect_vocabulary_extension`, `reference_bot_legalmoves_moveguard_divergence`, `reference_interactive_choice_active_player_only`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`.

### Operator forks (recommended defaults are what this WP locks)

1. **Who loses what on Destroyer's Ambush for a non-current seat (and the bot).** Default: the lowest-cost non-grey Hero in their discard (ties → lexical). Alternative: the D-24644 `selectKoHeroTarget` lexical pick, which can take an expensive Hero while a cheap one sits beside it.
2. **KO-from-discard prompt heading.** Default: unchanged ("KO up to N cards from your discard pile"); the list shows only grey Heroes and the log line says "grey Heroes". Alternative: a `UIPendingKoDiscardChoice.greyFilter` field (five-step UIState contract) and a "grey Heroes" heading — adds `ui/uiState.types.ts`, the filter, its test and the prompt + test.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. Randomness only through the provided shuffle context. No registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24769) before coding. One WP per session.

**Packet-specific:**
- **One grey predicate.** Every grey / non-grey test (executor, both resolves, bot, projection) calls `matchesGreyHeroFilter` / `isGreyHero`. No inline class scan for grey anywhere else. The two `mastermindHandlers.ts` copies are left alone (Out of Scope).
- **Byte-identical when no filter.** Every new parameter and field is optional; absent ⇒ today's code path, today's log strings, today's bot picks (Juggernaut, Salomé, Loki's Maniacal Tyrant, Red Skull, Maestro unchanged).
- **Bot mirrors the resolve.** Every bot pick for a filtered choice passes the same predicate the resolve enforces (D-24364; the legalMoves↔guard divergence).
- **Data, not English.** Behavior comes only from the eight markers in Locked Values. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** The three new primitives and the filtered `ko-up-to` lines log through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen; `greyFilter` and `drawHeroClasses` stay out of `descriptorKey`.
- **No new `G` key, no new move, no new pending queue, no new UIState field.**

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- `export type GreyHeroFilter = 'grey' | 'non-grey';` with JSDoc (rules v23 L1487-1492).
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order: `'gain-recruit-current-count-by-trait'`, `'draw-cards-current-count-by-trait'`, `'reveal-top-ko-grey-or-draw-by-class'` (positions 32-34 on today's `main`; re-read at execution).
- `VillainEffectDescriptor.greyFilter?: GreyHeroFilter` — only on `ko-hero` (`target: 'each'`, `zone: 'discard'`, value `'non-grey'`) and `ko-up-to-from-discard-current` (value `'grey'`). `VillainEffectDescriptor.drawHeroClasses?: readonly HeroClass[]` (type-only import from `content/content.schemas.js`) — only on `reveal-top-ko-grey-or-draw-by-class`. Neither in `descriptorKey`. The two count primitives reuse `requireKind` / `requireValue`.
- The descriptor JSDoc list gains one bullet per new field / primitive.

**State (`types.ts`):** `PendingKoHeroChoice.greyFilter?: GreyHeroFilter` and `PendingKoDiscardChoice.greyFilter?: GreyHeroFilter` — omit-when-absent, set only by the two filtered parks.

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `ko-hero:each:<N>:discard:non-grey` — exactly 5 parts; `<N>` per `parsePositiveInteger`; part 4 exactly `discard`; part 5 exactly `non-grey` → `{ primitive: 'ko-hero', target: 'each', magnitude: N, zone: 'discard', greyFilter: 'non-grey' }`. Any other 5-part form → null.
- `ko-up-to-from-discard-current:<N>:grey` — exactly 3 parts, part 3 exactly `grey` → `{ primitive: 'ko-up-to-from-discard-current', magnitude: N, greyFilter: 'grey' }`. The 2-part form is unchanged; `reveal-top-draw-if-cost-lte` still accepts only 2 parts.
- `gain-recruit-current-count-by-trait:<kind>:<value>` and `draw-cards-current-count-by-trait:<kind>:<value>` — `parseTraitPredicateTokens` (kind `team` | `hc`) → `{ primitive, requireKind, requireValue }`; the script joins them to its trait arm.
- `reveal-top-ko-grey-or-draw-by-class:<class>[+<class>…]` — exactly 2 parts; split on `+`; each token `normalizeTraitSlug`-ed, a member of `HERO_CLASSES`, no duplicates, ≥ 1 → `{ primitive, drawHeroClasses: [...] }` in token order. The script validates with a hand-synced local `HERO_CLASSES = ['tech', 'covert', 'strength', 'ranged', 'instinct']` (the `CITY_SPACE_NAMES` hand-sync precedent). It applies `trim().toLowerCase()` to each `+` token before the membership and duplicate checks, so script and engine accept the same token set.

**Grey predicate (`hero/splitCard.logic.ts`, pure):**
- `isGreyHero(G, cardId): boolean` — `false` for `WOUND_EXT_ID` and `BYSTANDER_EXT_ID` (imported from `setup/pilesInit.js`); else `true` iff `offPlayCardTraits(G, cardId)` is undefined or has no non-empty `heroClass` and no non-empty `heroClass2`.
- `matchesGreyHeroFilter(G, cardId, greyFilter): boolean` — Wound / Bystander → `false`; `'grey'` → `isGreyHero`; `'non-grey'` → `!isGreyHero`.

**Executor (`villain/villainEffects.execute.ts`):**
- `export interface KoHeroGreyFilterRead { gameState: LegendaryGameState; greyFilter: GreyHeroFilter; }`. `buildKoEligibleTargets(zones, allowedZones?, greyFilterRead?)` and `countKoableHeroes(zones, allowedZones?, greyFilterRead?)` additionally skip cards failing `matchesGreyHeroFilter` when the third argument is present.
- `export function selectKoHeroTargetByGreyFilter(G, zoneCards, greyFilter): CardExtId | null` — candidates = cards passing `matchesGreyHeroFilter`; `'grey'` → `selectKoHeroTarget(candidates)`; `'non-grey'` → lowest `offPlayCardStats(G, id)?.cost ?? 0`, ties → lexically smallest id; none → null.
- `villainEffectKoHero` `target: 'each'` passes `descriptor.greyFilter` to `parkZoneKoChoice(G, playerId, zone, magnitude, greyFilter?)` (writes `entry.greyFilter` when present) and `koHeroesFromZoneForPlayer(G, playerId, zone, magnitude, greyFilter?)` (picks with `selectKoHeroTargetByGreyFilter` when present). Return shape and narration unchanged.
- `villainEffectKoUpToFromDiscardCurrent` with `descriptor.greyFilter === 'grey'`: no discard card passes → `` `${label} effect: no grey Heroes in your discard pile (${sourceName}); nothing to KO.` `` `'blocked'`; else park `{ choiceType: 'ko-from-discard', playerID, maxCount, sourceCardId, greyFilter: 'grey' }` and log `` `${label} effect: KO up to ${N} grey Hero(es) from your discard pile (${sourceName}).` `` `'neutral'`. Without the filter: today's body and strings, unchanged.
- `villainEffectGainRecruitCurrentCountByTrait`: `counted = listPlayerHeroesMatchingTrait(G, zones, kind, value)`; `G.turnEconomy.recruit += counted.length` (the `gain-recruit-current` precedent, ~L2550); `> 0` → `` `${label} effect: gained +${n} recruit for your ${n} ${value} Hero(es)${describeTraitCountedHeroes(…)}.` `` `'applied'`; `0` → `` `${label} effect: you have no ${value} Heroes, so no recruit was gained.` `` `'blocked'`. Missing predicate or zones → `{ targets: [] }`.
- `villainEffectDrawCardsCurrentCountByTrait`: count first (names captured before the draw); `0` → `` `${label} effect: you have no ${value} Heroes, so no cards were drawn.` `` `'blocked'`; no `shuffleContext` → `{ targets: [] }` silently (the `draw-cards-current` precedent); else `drawCardsIntoHand(zones, n, shuffleContext)`, `G.turnEconomy.cardsDrawn += drawn`, `` `${label} effect: drew ${drawn} card(s) for your ${n} ${value} Hero(es)${names}.` `` (`'applied'` when `drawn > 0`, else `'blocked'`).
- `villainEffectRevealTopKoGreyOrDrawByClass`: empty deck → `reshuffleDiscardIntoDeck(zones, shuffleContext)`; still empty → `` `${label} effect: no card to reveal — your deck and discard pile are empty.` `` `'blocked'`. Top `isGreyHero` → remove from deck, `koCard`, `` `${label} effect: revealed "${name}" (grey) — KO'd it.` `` `'applied'`. Else first class in `drawHeroClasses` that `cardTraitMatches(offPlayCardTraits(G, top), 'hero-class', class)` → deck → hand, `G.turnEconomy.cardsDrawn += 1`, `` `${label} effect: revealed "${name}" (${class}) — drew it.` `` `'applied'`. Else `` `${label} effect: revealed "${name}" — left on top of your deck.` `` `'blocked'`. Each log passes the top card id as the log ref (the Patriarch precedent). Returns the KO'd / drawn id in `targets`, else `[]`.
- Handler map gains the three entries.

**Resolve moves:**
- `resolveKoHeroChoice`: when `front.greyFilter` is set, return silently (queue intact) unless `matchesGreyHeroFilter(G, args.cardId, front.greyFilter)`; the forced-remainder loop passes `{ gameState: G, greyFilter }` to both helpers.
- `getEligibleKoDiscardCards(G, playerID, greyFilter?)` — with a filter, the discard cards passing `matchesGreyHeroFilter`, discard order (duplicates kept). `resolveKoDiscardChoice`: with `front.greyFilter`, any id failing the predicate → silent return, queue intact. Logs unchanged.

**Bot (`simulation/ai.legalMoves.ts`):** the KO-a-Hero discard branch uses `selectKoHeroTargetByGreyFilter(gameState, zones.discard, front.greyFilter)` when `front.greyFilter` is set (else today's `selectKoHeroTarget`). `selectDefaultKoDiscardCardIds`: with `front.greyFilter`, both passes keep only cards passing `matchesGreyHeroFilter` (so no Wound; Agents / Troopers still first-chosen; Officers / Sidekicks still kept).

**Projection (`ui/uiState.build.ts`):** the KO-a-Hero eligible list passes the front entry's filter to `buildKoEligibleTargets`; the KO-from-discard `discard` list comes from `getEligibleKoDiscardCards(gameState, playerID, frontChoice.greyFilter)`. No UIState type change.

**Data — marker map rows (`scripts/convert-cards/inputs/villain-effect-markers.json`):**
- `villains.co2e.enemies-of-asgard`: `destroyer` `{ "ambush": ["ko-hero:each:1:discard:non-grey"], "fight": ["ko-up-to-from-discard-current:2:grey"], "escape": ["ko-hero:each:1:discard:non-grey"] }`; `frost-giant-warrior` `{ "fight": ["ko-up-to-from-discard-current:1:grey"] }`; `ymir-frost-giant-king` `{ "fight": ["ko-up-to-from-discard-current:1:grey"] }`.
- `villains.co2e.radiation.abomination` `{ "fight": ["gain-recruit-current-count-by-trait:hc:strength"] }`; `villains.co2e.sinister-syndicate.beetle` `{ "fight": ["draw-cards-current-count-by-trait:hc:covert"] }`.
- `henchmen.co2e.savage-land-mutates` `{ "fight": ["reveal-top-ko-grey-or-draw-by-class:strength+instinct"] }`.
- `scripts/coverage/mechanic-provenance.json`: the three new primitives → `{ "wp": "WP-836", "decision": "D-24769" }`. `ko-hero` and `ko-up-to-from-discard-current` keep their rows.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: `GreyHeroFilter`, three primitives, two descriptor fields. In `villainAbility.types.test.ts`, update the five pins (ordered list, length, last-member literal + position, L619, L652) plus the count in the L359 title and the L396 / L401 messages: 31 → 34, or `main` + 3.
- **B)** `setup/villainAbility.setup.ts` + test: the five-part `ko-hero`, three-part `ko-up-to`, two trait-count arms, the by-class arm; the grammar doc list.
- **C)** `hero/splitCard.logic.ts` + test: `isGreyHero`, `matchesGreyHeroFilter`.
- **D)** `villain/villainEffects.execute.ts` + test: the filter plumbing, `selectKoHeroTargetByGreyFilter`, the filtered `ko-up-to` branch, three handlers + map entries.
- **E)** `types.ts`: the two optional `greyFilter` fields.
- **F)** `moves/koHeroChoice.resolve.ts` + test, `moves/koDiscardChoice.resolve.ts` + test: filter validation.
- **G)** `simulation/ai.legalMoves.ts` + test: the two filtered bot picks.
- **H)** `ui/uiState.build.ts` + `ui/uiState.build.test.ts`: the two filtered projections.
- **I)** Card data: the script and map, `co2e.json` regenerated (8 lines), `mechanic-provenance.json`, the regenerated ledger and effect index.

## Out of Scope

- Every other co2e line (WP-835, WP-837..840), including Frost Giant Warrior's and Ymir's Ambushes.
- **The two `mastermindHandlers.ts` grey copies** (Loki, Doctor Octopus). One reads raw `G.cardTraits`, not the off-play view, so routing it through `isGreyHero` would change split-card behaviour in a mastermind strike; a separate fidelity fix, noted for STATUS.
- Any client change, including the KO-from-discard heading (Operator fork 2).
- **Henchman hook ids are slug-only** (`henchman-savage-land-mutates-NN` for both sets). A match selecting both `core/` and `co2e/savage-land-mutates` would share ids; pre-existing, unverified whether setup allows it, not fixed here.
- Variable-Attack passives (inventory "Out of scope"), PAR regeneration, the gauntlet menu (WP-834).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `hero/splitCard.logic.ts`, `hero/splitCard.logic.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `types.ts` — modified (two optional fields)
- `moves/koHeroChoice.resolve.ts`, `moves/koHeroChoice.resolve.test.ts` — modified
- `moves/koDiscardChoice.resolve.ts`, `moves/koDiscardChoice.resolve.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts` — modified
- `ui/uiState.build.ts`, `ui/uiState.build.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (8 lines gain one marker each)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated; `data/metadata/card-mechanics.json` — regenerated only if `mechanics:metadata:check` flags

**Governance:** `docs/ai/post-mortems/01.6-WP-836-co2e-grey-hero-and-trait-count-effects.md` — new (01.6 mandatory: new contract types and extension seams), `docs/ai/DECISIONS.md` (D-24769), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 17 engine files (8 tests), 3 script/input files, 1 card-data file and 3-4 generated feeds. Above the ~10 guideline because eight lines across four groups share one predicate and two existing choices whose resolve, bot and projection must all learn the filter together (a partial landing is a bot freeze). Every file exists on the baseline.

## Contract

- The Locked Values above: `GreyHeroFilter`, the three primitives and five grammars, `greyFilter` / `drawHeroClasses`, the two pending fields, `isGreyHero` / `matchesGreyHeroFilter` / `selectKoHeroTargetByGreyFilter` / `KoHeroGreyFilterRead`, the optional helper parameters, the exact log strings and the marker rows.
- `executeVillainAbilities`, every existing handler's unfiltered path, `resolveKoHeroChoice` / `resolveKoDiscardChoice` signatures and move names, `descriptorKey`, and every UIState type are unchanged.

## Test Contract

Minimal-`G` fixtures in each file's style (`messages: []`, a `cardTraits` and `cardStats` entry per Hero). "Fixture Heroes": `tech-a` (tech, 3), `tech-b` (tech, 5), `covert-c` (covert, 2), `strength-d` (strength, 4), `strength-g` (strength, 6), `covert-h` (covert, 4), `instinct-e` (instinct, 3), `classless-f` (cardTraits entry with `heroClass: null`, 2), `dual-ti` (`heroClass: 'tech'`, `heroClass2: 'instinct'`, 4; T6 / T15), a split pair `split-a#0` / `split-b#0` (tech / covert, with `G.splitFaces: { 'split-a': 'split-b' }`; T6), `starting-shield-agent`, `starting-shield-trooper`, `pile-shield-officer` (3), `pile-sidekick` (2), `pile-wound`. One `describe('WP-836 …')` per file. T1 edits the in-order drift test (~L359-406: append the three names to the expected list, length 31 → 34, the "appended last" pin to `reveal-top-ko-grey-or-draw-by-class` with message "position 34") and the two length pins (~L619, ~L652: 31 → 34). Use `main`'s count + 3 if siblings landed first. These are value changes from an intended product change, and the commit body names each one.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES` | 34 members (or `main` + 3), last three in locked order; parity passes; drift list, "appended last" pin and both length pins updated | |
| T2 | types | `descriptorToLegacyKeyword` of `{ko-hero, each, 1, zone: discard, greyFilter: non-grey}`; of each new primitive; of `{ko-up-to…, 2, greyFilter: grey}` | `koHeroEachPlayer`; `undefined` ×3; `undefined` | filter not in key |
| T3 | setup | the seven accepted tokens (5-part ko-hero, `ko-up-to…:2:grey`, `…:1:grey`, both trait-count tokens, `…by-class:strength+instinct`, plus `…by-class:Strength`) | descriptors as locked; `Strength` → `['strength']` | |
| T4 | setup | `ko-hero:each:1:discard:grey`, `…:hand:non-grey`, `…:discard:nongrey`, `…:discard:non-grey:x`, `ko-up-to…:2:non-grey`, `ko-up-to…:2:`, `ko-up-to…:grey`, `reveal-top-draw-if-cost-lte:3:grey`, `gain-recruit-current-count-by-trait`, `…:hc`, `…:xx:strength`, `draw-cards-current-count-by-trait:hc:`, `reveal-top-ko-grey-or-draw-by-class`, `…:`, `…:strength+`, `…:strength+strength`, `…:strength+psychic` | each in `unresolvedMarkers` | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the 8 lines copied **verbatim** from the regenerated `co2e.json` (villains + the henchman group) | Destroyer onAmbush / onFight / onEscape, FGW + Ymir onFight, Abomination, Beetle onFight, `henchman-savage-land-mutates-00..09` onFight with the locked descriptors; no `unresolvedMarkers` | |
| T6 | splitCard | `isGreyHero` / `matchesGreyHeroFilter` over every fixture Hero, `pile-bystander`, a split card whose faces are tech / covert, and a state with no `cardTraits` | grey: Agent, Trooper, Officer, Sidekick, `classless-f`; not grey: tech-a, split, dual-class; Wound / Bystander false for both filters; no map → Agent grey, Wound false | |
| T7 | executor | onAmbush `ko-hero:each:1:discard:non-grey`, current `0`: discard `[Agent, tech-a, tech-b]`; `1`: `[Agent, tech-b, covert-c]`; `2`: `[Agent, pile-shield-officer]` | `0` parks `{ko-hero, '0', zones: ['discard'], greyFilter: 'non-grey'}` (no `remaining`); `1` loses `covert-c`; `2` loses nothing; `G.ko` `[covert-c]` | others never lose a grey card |
| T8 | executor | same, `0` discard `[Agent, tech-a]` | `tech-a` auto-KO'd, no park | forced |
| T9 | executor | `buildKoEligibleTargets` / `countKoableHeroes` on discard `[Agent, tech-a, tech-a, pile-wound, pile-shield-officer]` with `['discard']` and the non-grey read; and without the read | `[{discard, tech-a}]`, 2; without: today's result (3 deduped targets Agent, tech-a, Officer; count 4) | unfiltered unchanged |
| T10 | executor | `selectKoHeroTargetByGreyFilter` non-grey on `[tech-b, covert-c, tech-a]`; on `[Agent, pile-wound]`; grey on `[pile-shield-officer, starting-shield-trooper]` | `covert-c`; `null`; `starting-shield-trooper` | |
| T11 | executor | onFight `ko-up-to…:2:grey` (Destroyer) with discard `[pile-wound, tech-a, Agent, pile-shield-officer]`; then discard `[pile-wound, tech-a]` | parks `{ko-from-discard, '0', 2, sourceCardId, greyFilter: 'grey'}` + `… KO up to 2 grey Hero(es) …` `neutral`; then no park + the `no grey Heroes` line `blocked` | |
| T12 | executor | Salomé `ko-up-to…:2` (no filter) on a non-empty and an empty discard | today's entry (no `greyFilter` key) and today's two strings | byte-identical |
| T13 | executor | Abomination: hand `[strength-d, tech-a]`, `strength-g` played this turn and still in play, recruit 1; then no Strength Hero | recruit 3, `gained +2 recruit for your 2 strength Hero(es): … (hand), … (played).` `applied`; then unchanged + `you have no strength Heroes …` `blocked` | hand + play |
| T14 | executor | Beetle: hand `[covert-c]`, `covert-h` and `tech-a` played and still in play, deck 3 with a Covert Hero on top; then deck 1 + discard 3; then no Covert Hero; then no `shuffleContext` | +2 hand, `cardsDrawn` +2, `drew 2 card(s) for your 2 covert Hero(es)…`; reshuffle draws 2; `no covert Heroes` `blocked`, no draw; silent no-op | count before draw |
| T15 | executor | Savage Land top: Agent; `classless-f`; `strength-d`; a tech/instinct dual; `pile-wound`; `covert-c`; empty deck + discard `[strength-d]`; empty both | KO'd (`G.ko`); KO'd; drawn (`cardsDrawn` +1); drawn; left; left; reshuffle then drawn; empty line `blocked` | Wound is not grey |
| T16 | koHero resolve | front `{zones: ['discard'], greyFilter: 'non-grey'}`, discard `[Agent, tech-a, tech-b]`; submit `{discard, Agent}`; then `{discard, tech-a}` | first: `G` deep-equal, queue intact; second: `tech-a` KO'd, front-popped | |
| T17 | koDiscard resolve | front `{maxCount 2, greyFilter: 'grey'}`, discard `[pile-wound, tech-a, Agent, Agent, pile-shield-officer]`; `[pile-wound]`, `[tech-a]`, `[Agent, Agent]`, `[]`; `getEligibleKoDiscardCards(G,'0','grey')` | no-op, no-op, both Agents KO'd + popped, popped; eligible `[Agent, Agent, pile-shield-officer]` | unfiltered helper still returns the whole discard |
| T18 | legalMoves | T16's state | exactly `resolveKoHeroChoice {zone: 'discard', cardId: 'tech-a'}` | never the Agent |
| T19 | legalMoves | grey KO-discard front, maxCount 2, discard `[pile-wound, Agent, tech-a, starting-shield-trooper]`; discard `[pile-shield-officer]`; no-filter front on the first discard | `[Agent, starting-shield-trooper]`; `[]`; `[pile-wound, Agent]` (today) | no Wound offered to a grey choice |
| T20 | uiState build | `buildUIState` with T16's front; with T17's front; with an unfiltered KO-discard front | eligible `[tech-a, tech-b]` only; `discard` = `[Agent, Agent, pile-shield-officer]` in order; unfiltered = whole discard | |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §10 (content as data: markers, never English), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** `co2e/enemies-of-asgard`, `co2e/radiation` and `co2e/savage-land-mutates` appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`); those legs change difficulty (Destroyer now punishes discards, the others reward). No committed `data/par` artifact references them, so nothing is re-pinned. WP-834 (draft) removes co2e fallback groups from the ranked menu; if it lands first, fewer legs carry these groups.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- No new `G` key; the two `greyFilter` fields appear only on entries parked by these cards. No randomness beyond the existing reshuffle through `shuffleContext`; sorted seat iteration; deterministic picks (lowest cost, lexical tie-break).
- `getLegalMoves` output is unchanged for every unfiltered choice, so sim, PAR and bot runs on other loadouts are byte-identical.
- Narration goes to hash-excluded `G.messages` (D-24081). `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 12); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks, so pre-WP-836 matches (no hooks for these lines) replay identically. Only a re-setup from config + seed sees the new markers. Recorded in D-24769.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T5 pass. The marker script accepts the eight Locked-Values tokens (Verification 3). Its rejection side is checked by hand (it runs `main()` on import): put `ko-hero:each:1:discard:grey`, `ko-up-to-from-discard-current:2:non-grey` and `reveal-top-ko-grey-or-draw-by-class:strength+psychic` into the marker map one at a time, run the script, observe a loud failure, revert. Record the observed failures in the EC-874 commit body.
2. **Types and predicate.** T1, T2, T6 pass as runtime assertions.
3. **Destroyer each-player KO.** T7-T10, T16, T18, T20 (first case) pass.
4. **Grey KO-up-to.** T11, T12, T17, T19, T20 (second and third cases) pass.
5. **Counts.** T13-T14 pass.
6. **Savage Land.** T15 passes.
7. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 8 new marker(s) this run` and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, and only those 8 lines, each gaining one trailing marker; `core.json` is untouched.
8. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after Verification 4; the last two need no regeneration.
9. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
10. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`:
    - Destroyer gains `ko-hero` (WP-252 / D-24023) and `ko-up-to-from-discard-current` (WP-760 / D-24589) rows.
    - Frost Giant Warrior and Ymir gain `ko-up-to-from-discard-current` (WP-760 / D-24589).
    - Abomination, Beetle and co2e `henchman-savage-land-mutates` gain the three new primitives with WP-836 / D-24769.
    - All of these rows are `executable`. Frost Giant Warrior's and Ymir's card-level rows flip to `executable` although their Ambush stays hollow until WP-837 / WP-839 (the ledger is card × primitive).
    - Core rows are unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index` (and `pnpm mechanics:metadata` only if its check flags).
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last two flags, STOP: Assumes 12 is false.
6. `pnpm -r --no-bail test` → 0 fail.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → each exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: drop the filter check from `resolveKoDiscardChoice` (T17); use `selectKoHeroTarget` in the filtered bot branch (T18); project the raw discard for a filtered KO-discard front (T20); treat a Wound as grey in `isGreyHero` (T6, T15); count the hand only in the Abomination handler (T13).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24769 appended to `DECISIONS.md` as Active. 01.6 post-mortem written. `docs/ai/STATUS.md` updated, including the grey-copy follow-up line (the two `mastermindHandlers.ts` copies, plus WP-830's `enigmaColorsOf`).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-874:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live 2+-player match **created after the deploy** (setup-time hooks: a match created before the deploy keeps its hookless lines; the setter pane only stages zones) on `play.legendary-arena.com` with the deployed gitSha checked, using `co2e/enemies-of-asgard` plus one of `co2e/radiation` / `co2e/sinister-syndicate` and the `co2e/savage-land-mutates` henchmen, driven via the operator setter pane or `/api/match/autoplay` setupData:
  - a Destroyer reveal shows the KO prompt with only non-grey discard Heroes (or auto-KOs), and the log names each player's loss;
  - defeating Destroyer / a Frost Giant Warrior / Ymir opens the KO-from-discard prompt listing only grey Heroes, and picking none works;
  - Abomination logs `+N recruit` for the Strength Heroes it names; Beetle logs its draw for the Covert Heroes it names;
  - Savage Land Mutates logs the revealed card and KO'd / drew / left.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24769 — co2e-grey-hero-and-trait-count-effects.** It locks:
- the grey-Hero definition: a Hero card (not a Wound, not a Bystander) whose off-play traits carry no Hero Class; the synthetic S.H.I.E.L.D. Agent / Trooper / Officer and Sidekick cards and classless registry Heroes are grey; a classed special Officer and a split card are not; a Wound is neither (rules v23 L1487-1492, L2906-2911, L3380-3387, L3404-3407); one exported predicate in `hero/splitCard.logic.ts`;
- the authorized contract-file change: `rules/villainAbility.types.ts` (`GreyHeroFilter`, primitives `gain-recruit-current-count-by-trait`, `draw-cards-current-count-by-trait`, `reveal-top-ko-grey-or-draw-by-class`, descriptor fields `greyFilter` and `drawHeroClasses` outside `descriptorKey`), plus the two optional `greyFilter` fields on `PendingKoHeroChoice` / `PendingKoDiscardChoice`;
- the two grammar extensions (`ko-hero:each:<N>:discard:non-grey`, `ko-up-to-from-discard-current:<N>:grey`) and the three new grammars;
- Destroyer's each-player KO: current player parks on a real choice (D-24644), other seats and the bot take the lowest-cost non-grey Hero, ties lexical (Operator fork 1);
- the grey KO-up-to parks whenever an eligible card exists; the bot KOs Agents / Troopers first and never a Wound;
- Abomination and Beetle count "your Heroes" = hand + still in play through the Maestro / Zemo counter (D-24529 / D-24692 / D-24724); Beetle counts before drawing;
- Savage Land: grey → KO, a listed class → draw (a real draw, no draw lock), else stays; a Wound stays (rules L3201-3207, L3404-3407);
- no client change; the KO-from-discard heading stays "cards" (Operator fork 2);
- the two `mastermindHandlers.ts` grey copies are left as-is (follow-up). WP-830's `enigmaColorsOf` (`rules/enigmaCode.logic.ts`, merged #2998, `e580d801`) reads grey with the same semantics ("no class in `offPlayCardTraits`, undefined → grey"), so it is not a conflict; it joins the same consolidation follow-up;
- the replay-compat note, including that live-verify needs a match created after the deploy.

---

## Gate Record

**01.4 pre-flight (independent):** NOT READY → PS-1 + RS-1..7 applied → READY TO EXECUTE (2026-10-25). Report: `docs/ai/invocations/preflight-wp836-co2e-grey-hero-and-trait-count-effects.md`. The fixes were text-only, so no re-run was needed.
- **PS-1:** Assumes 2 and 10 now hold whether or not WP-835 / WP-837..840 merged first. EC Before Starting line 2 names WP-835's `radiation` group and `beetle` object.
- **RS-1:** AC 10 now lists the ledger rows as card × primitive with their real provenance; the EC mirrors it.
- **RS-2:** T1 and the EC name every drift-test edit.
- **RS-3:** the `G.turnEconomy` field paths are locked.
- **RS-4:** the `dual-ti` and split-pair fixtures are added.
- **RS-5:** the session prompt says "Jeff merges", with no auto-merge.
- **RS-6:** WP-830's `enigmaColorsOf` is added to the D-24769 / STATUS follow-up.
- **RS-7:** nits fixed (Out of Scope count, T3 count, EC Savage Land `'applied'`).

**01.7 copilot (independent):** RISK → fixes 1-6 applied (2026-10-25). Report: `docs/ai/invocations/copilot-wp836-co2e-grey-hero-and-trait-count-effects.md`.
- **#12a:** the 01.6 post-mortem is added to Files Expected to Change, the DoD, the EC and the session prompt.
- **#12b:** `workindex:rows:check` and `workindex:executed:check` are added to Verification 7, the DoD, the EC and the session SPEC close.
- **#28:** the live-verify step needs a match **created after the deploy** (WP DoD, EC, prompt, D-24769 replay bullet).
- **#30:** the pre-flight report now has a `## Pre-session actions — ALL RESOLVED (2026-10-25)` section with verdict READY TO EXECUTE.
- **#26:** the script's `trim().toLowerCase()` rule for by-class tokens is stated.
- **#21:** `drawHeroClasses?: readonly HeroClass[]`.

Pre-flight READY stands; no pre-flight re-run needed.

**00.3 lint (independent):** PASS (2026-10-25). Its improvements are applied: D-24364 in the Context scan list, Vision §10, and the workindex gates in §13 / §15.

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (fixes applied) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

Drafted to the WP-817 structure; the independent 00.3 run returned PASS (see §Gate Record).

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 5 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — Assumes 1-13 cite rules lines, data lines and code anchors for every seam the Locked Values touch |
| §4 | PASS — 00.2 §1.4 / §5, ARCHITECTURE sections, DECISIONS scan list, memory files |
| §5 | PASS — 24-25 files, each marked modified / regenerated; the count is justified |
| §6 | PASS — group / card slugs verbatim from `co2e.json` (`frost-giant-warrior`, `ymir-frost-giant-king`, `savage-land-mutates`); `CardExtId` for card args |
| §7 | PASS — no new dependencies; soft ordering with WP-835 / WP-837..840 stated |
| §8 | PASS — engine decides; projection-only UI effect; `G` stays JSON; no I/O; randomness only via `shuffleContext` |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, diff-scope step, 5 revert proofs |
| §14 | PASS — 10 binary criteria tied to T1-T20 |
| §15 / §15.1 | PASS — STATUS (+ follow-up), DECISIONS, indexes in DoD; D-24026 live-verify on `play.legendary-arena.com` |
| §16 | PASS — 00.6 mandated; the grey predicate is extracted at its third copy (two private copies stay, justified in Out of Scope) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

**Verdict:** PASS (independent 00.3 run, 2026-10-25).
