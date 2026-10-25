# EC-874 — Core 2E grey-Hero and Hero-count effects (Execution Checklist)

**Source:** docs/ai/work-packets/WP-836-co2e-grey-hero-and-trait-count-effects.md
**Layer:** Game Engine (+ card-data markers, derived feeds)

## Before Starting
- [ ] `VILLAIN_EFFECT_PRIMITIVES` length recorded (31 at draft). If WP-837..840 landed first, append after their primitives, and set the five pins in `villainAbility.types.test.ts` to the new total. The five are the ordered list, the length, the last-member literal + position, L619 and L652. The count in the L359 title and the L396 / L401 messages changes too.
- [ ] If WP-835 / WP-837 / WP-839 landed first, their rows are already there: the `villains.co2e` / `henchmen.co2e` blocks, the Frost Giant Warrior / Ymir objects, and WP-835's `villains.co2e.radiation` group and `villains.co2e.sinister-syndicate.beetle` object. Add `abomination` inside `radiation` and a `fight` key inside `beetle`. Add this packet's keys beside the existing rows, never replace them. Either state (siblings present or absent) is fine.
- [ ] `ko-hero:each:<N>:<zone>` still parks via `parkZoneKoChoice` and auto-KOs via `koHeroesFromZoneForPlayer`; `buildKoEligibleTargets` / `countKoableHeroes` still take `(zones, allowedZones?)`.
- [ ] `getEligibleKoDiscardCards` still has only test callers; `uiState.build.ts` still loops the raw discard for the KO-from-discard projection.
- [ ] `co2e.json` still prints the eight lines verbatim (WP §Goal); `henchmen.core.savage-land-mutates` is `add-next-hand-size:1`.
- [ ] `pnpm -r build` → 0; record the engine test total.

## Locked Values (do not re-derive)
- `export type GreyHeroFilter = 'grey' | 'non-grey';` in `rules/villainAbility.types.ts`.
- Primitives appended last, in order: `gain-recruit-current-count-by-trait`, `draw-cards-current-count-by-trait`, `reveal-top-ko-grey-or-draw-by-class`. Descriptor `greyFilter?: GreyHeroFilter`, `drawHeroClasses?: readonly HeroClass[]` (type-only import from `content/content.schemas.js`); neither in `descriptorKey`.
- `PendingKoHeroChoice.greyFilter?` and `PendingKoDiscardChoice.greyFilter?` (`GreyHeroFilter`), omit-when-absent.
- Grammar: `ko-hero:each:<N>:discard:non-grey` (exactly 5 parts) → `{ko-hero, each, N, zone: 'discard', greyFilter: 'non-grey'}`; `ko-up-to-from-discard-current:<N>:grey` (exactly 3) → `{…, magnitude: N, greyFilter: 'grey'}`; `gain-recruit-current-count-by-trait:<kind>:<value>` and `draw-cards-current-count-by-trait:<kind>:<value>` via `parseTraitPredicateTokens`; `reveal-top-ko-grey-or-draw-by-class:<c>[+<c>…]` (exactly 2; each `normalizeTraitSlug`-ed, in `HERO_CLASSES`, no duplicates). Anything else → null. The script mirrors all five (local `HERO_CLASSES = ['tech', 'covert', 'strength', 'ranged', 'instinct']`; it applies `trim().toLowerCase()` to each `+` token before the membership and duplicate checks, so script and engine accept the same token set).
- `hero/splitCard.logic.ts`: `isGreyHero(G, cardId)` — Wound / Bystander false; else no non-empty `heroClass` and no non-empty `heroClass2` in `offPlayCardTraits` (undefined → grey). `matchesGreyHeroFilter(G, cardId, greyFilter)` — Wound / Bystander false; `'grey'` → `isGreyHero`; `'non-grey'` → `!isGreyHero`.
- Executor: `KoHeroGreyFilterRead { gameState; greyFilter }` as optional third arg of `buildKoEligibleTargets` / `countKoableHeroes`; `selectKoHeroTargetByGreyFilter(G, zoneCards, greyFilter)` (`'grey'` → `selectKoHeroTarget(candidates)`; `'non-grey'` → lowest `offPlayCardStats(G, id)?.cost ?? 0`, ties lexical); `parkZoneKoChoice(…, greyFilter?)` writes `entry.greyFilter`; `koHeroesFromZoneForPlayer(…, greyFilter?)` picks with the selector.
- Filtered `ko-up-to`: none eligible → `` `${label} effect: no grey Heroes in your discard pile (${sourceName}); nothing to KO.` `` `'blocked'`; else park `{ko-from-discard, playerID, maxCount, sourceCardId, greyFilter: 'grey'}` + `` `${label} effect: KO up to ${N} grey Hero(es) from your discard pile (${sourceName}).` `` `'neutral'`. Unfiltered body unchanged.
- Abomination: `G.turnEconomy.recruit += n`; `` `${label} effect: gained +${n} recruit for your ${n} ${value} Hero(es)${names}.` `` `'applied'` / `` `${label} effect: you have no ${value} Heroes, so no recruit was gained.` `` `'blocked'`; `names` = `describeTraitCountedHeroes`.
- Beetle: count first; `` `${label} effect: you have no ${value} Heroes, so no cards were drawn.` `` `'blocked'`; no `shuffleContext` → silent `{ targets: [] }`; else `drawCardsIntoHand`, `G.turnEconomy.cardsDrawn += drawn`, `` `${label} effect: drew ${drawn} card(s) for your ${n} ${value} Hero(es)${names}.` `` (`'applied'` if `drawn > 0`, else `'blocked'`).
- Savage Land: empty deck → `reshuffleDiscardIntoDeck`; still empty → `` `${label} effect: no card to reveal — your deck and discard pile are empty.` `` `'blocked'`; grey → `koCard`, `` `${label} effect: revealed "${name}" (grey) — KO'd it.` `` `'applied'`; first matching listed class → deck → hand, `G.turnEconomy.cardsDrawn += 1`, `` `${label} effect: revealed "${name}" (${class}) — drew it.` `` `'applied'`; else `` `${label} effect: revealed "${name}" — left on top of your deck.` `` `'blocked'`. Log ref = top card id.
- Resolves: `resolveKoHeroChoice` rejects (silent, queue intact) a card failing the front's filter and passes the filter to its forced-remainder helpers; `getEligibleKoDiscardCards(G, playerID, greyFilter?)` filters in discard order; `resolveKoDiscardChoice` rejects any id failing the front's filter.
- Bot: filtered KO-a-Hero discard branch → `selectKoHeroTargetByGreyFilter`; `selectDefaultKoDiscardCardIds` with a filter keeps only matching cards in both passes.
- Projection: KO-a-Hero eligible list and KO-from-discard `discard` list both filtered by the front's `greyFilter`.
- Markers: Destroyer ambush + escape `ko-hero:each:1:discard:non-grey`, fight `ko-up-to-from-discard-current:2:grey`; `frost-giant-warrior` + `ymir-frost-giant-king` fight `ko-up-to-from-discard-current:1:grey`; `radiation.abomination` fight `gain-recruit-current-count-by-trait:hc:strength`; `sinister-syndicate.beetle` fight `draw-cards-current-count-by-trait:hc:covert`; `henchmen.co2e.savage-land-mutates` fight `reveal-top-ko-grey-or-draw-by-class:strength+instinct`. Provenance: the three new primitives → WP-836 / D-24769.
- `villainAbility.types.test.ts` changes, all of them named in the commit body as intended:
  - The in-order drift test (~L359-406): the expected list gains the three names, the length goes 31 → 34, and the "appended last" pin becomes `reveal-top-ko-grey-or-draw-by-class` with "position 34".
  - Two length pins (~L619, ~L652) go 31 → 34.
  - If siblings landed first, use `main`'s count + 3 throughout.

## Guardrails
- One grey predicate (`isGreyHero` / `matchesGreyHeroFilter`); no inline grey class scan; `mastermindHandlers.ts` copies untouched.
- Absent filter ⇒ byte-identical (Juggernaut, Salomé, Maniacal Tyrant, Red Skull, Maestro paths, strings and bot picks).
- Every filtered bot pick passes the predicate the resolve enforces (D-24364).
- No new `G` key, move, pending queue or UIState field; hash oracles unchanged (STOP if one moves).
- A Wound is never grey and never non-grey; it stays on top for Savage Land and is never offered to a grey KO.
- Markers only; never run `convert-cards-v15.mjs`; `core.json` untouched.

## Required `// why:` Comments
- `isGreyHero`: rules v23 L1487-1492 / L3404-3407 — classless Heroes are grey, Wounds have no color; off-play view so a split card is its faces' classes.
- `greyFilter` / `drawHeroClasses` on the descriptor: kept out of `descriptorKey` (filtered ko-hero still narrates as `koHeroEachPlayer`).
- `selectKoHeroTargetByGreyFilter` non-grey branch: lowest cost is the rational "each player chooses" pick; starters are grey so D-24644's starter-first cannot apply; same pick for bot and other seats (D-24009).
- The filtered bot branches: mirror the resolve's filter or the block-all guard never lifts.
- Beetle: counted before the draw ("Count …, then draw").
- Savage Land: the three outcomes are disjoint; a Wound is not grey (L3404-3407) and stays on top (L3201-3207); real draw, no draw lock (Patriarch precedent).
- The three appended primitives in the types array AND the script copy.

## Files to Produce
- Engine (`packages/game-engine/src/`): `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `hero/splitCard.logic.ts`, `villain/villainEffects.execute.ts`, `moves/koHeroChoice.resolve.ts`, `moves/koDiscardChoice.resolve.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.build.ts` — each + its `.test.ts` — **modified**; `types.ts` — **modified**
- Scripts: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — **regenerated**; `data/metadata/card-mechanics.json` only if its check flags
- Governance close: `docs/ai/post-mortems/01.6-WP-836-co2e-grey-hero-and-trait-count-effects.md` — **new**, `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] T1-T20 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] Markers: 8 new in `co2e.json` only; re-run 0. Three hand-checked script rejections recorded in the commit body.
- [ ] Rebuild, then `pnpm ledger:villains && pnpm effect-index`; the six check commands (WP Verification 5) → 0.
- [ ] Ledger rows (card × primitive), all `executable`:
  - Destroyer: `ko-hero` (WP-252 / D-24023) and `ko-up-to-from-discard-current` (WP-760 / D-24589).
  - Frost Giant Warrior and Ymir: `ko-up-to-from-discard-current` (WP-760 / D-24589). Their rows flip to `executable` even though their Ambush stays hollow until WP-837 / WP-839.
  - Abomination, Beetle and co2e Savage Land Mutates: the new primitives (WP-836 / D-24769).
  - Core rows unchanged.
- [ ] Five revert proofs observed (WP Verification 8).
- [ ] Hash oracles unchanged. Allowlist-only diff. Two-commit topology `EC-874:` then `SPEC:`.
- [ ] D-24769 Active; 01.6 post-mortem written; STATUS (+ the grey-copy follow-up: `mastermindHandlers.ts` ×2, WP-830 `enigmaColorsOf`); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → each 0.
- [ ] Live-verify (D-24026) post-deploy STATUS flip, per WP §Definition of Done, on a match **created after the deploy** (the setter pane only stages zones; an older match keeps its hookless lines).

## Common Failure Smells
- Bot-ally faults on a Destroyer turn → the bot offered the starter-first discard pick (an Agent) to a non-grey choice.
- Bot faults after a Frost Giant Warrior fight → the bot offered a Wound to a grey KO-from-discard choice.
- The KO prompt lists Agents for Destroyer's Ambush → the projection did not pass the front's filter.
- A Core match's Savage Land reveals the deck top → the marker landed under `henchmen.core`.
- Salomé's park now carries `greyFilter` or a new string → the unfiltered path was touched.
- A sentinel hash moved → an unfiltered park or pick changed.
