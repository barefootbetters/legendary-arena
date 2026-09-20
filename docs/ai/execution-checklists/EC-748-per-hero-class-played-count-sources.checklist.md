# EC-748 — Per-hero-class-played count sources (Execution Checklist)

**Source:** docs/ai/work-packets/WP-711-per-hero-class-played-count-sources.md
**Layer:** Game Engine + card-data
**Status:** Pending

## Before Starting
- [ ] WP-680 (per-team/per-class count-source recipe / D-24497) shipped — read `HERO_COUNT_SOURCES`, the `countTeamCardsPlayedThisTurn` resolver + its `explainCountSourceInputs` collector, and the drift pin FIRST; this WP mirrors that recipe for hero CLASS
- [ ] WP-247 (attack-per-count / D-24016) + WP-674 (recruit-per-count / D-24489) shipped — the grant family AND the Step-4 printed-icon suppression are reused verbatim; NO new grant mechanism, NO new parser suppression
- [ ] Confirm `cardHasClassWhenPlayed(G, id, class)` at `hero/sizeChanging.logic.ts:62` matches hc / hc2 (D-24523) + Size-Changing granted classes (D-24074) — the new sources REUSE this, do not re-derive class membership
- [ ] Confirm `G.cardTraits[id].heroClass`/`.heroClass2` populated at HEAD (baseline assertion) — the sources read these; NO new `G` field
- [ ] `pnpm -r build` exits 0; engine suite green

## Locked Values (do not re-derive)
- [ ] Four new source slugs: **`strength-heroes-played-this-turn`**, **`ranged-heroes-played-this-turn`**, **`tech-heroes-played-this-turn`**, **`covert-heroes-played-this-turn`** (digit-free, hyphenated, marker-safe). NO `instinct-…` (no card needs it)
- [ ] Each = count of **OTHER** `inPlay` cards for which `cardHasClassWhenPlayed(G, id, <class>)` is true — **SELF-EXCLUSIVE** via `triggeringCardId` (the `worthy-cards` / team-source precedent). Play-area "played this turn"; NOT the hand+play `distinct-hero-classes-played-this-turn` reading (D-24529)
- [ ] Drift pin: `HERO_COUNT_SOURCES` bumps **10 → 14** entries (RUNTIME assertion, per D-24372)
- [ ] Markers (6 lines): Marvelous Strength (ssw1) attack-per-count:strength-heroes-played-this-turn:1; Absorb Energies (ssw1) recruit-per-count:ranged-heroes-played-this-turn:1; dkcy ranged-recruit recruit-per-count:ranged-heroes-played-this-turn:1; dkcy ranged-attack attack-per-count:ranged-heroes-played-this-turn:1; bkwd covert attack-per-count:covert-heroes-played-this-turn:2; co2e tech attack-per-count:tech-heroes-played-this-turn:1
- [ ] Confirm each `heroSlug`/`cardSlug`/`abilityIndex` against the set JSONs before authoring markers: ssw1 `absorb-energies` (line 359, ranged/recruit) + `marvelous-strength` (line 390, strength/attack) both under `captain-marvel`; find the dkcy/bkwd/co2e hero+card slugs at grep lines dkcy:1120 (ranged/recruit) + dkcy:1135 (ranged/attack), bkwd:306 (covert/attack), co2e:824 (tech/attack)
- [ ] Scope guard: the raw `grep -rni "for each other \[hc:" data/cards/` returns ~13 lines; only these **six** single-class "[hc:X] Hero … you get +N[icon:…]" resource-grant lines are in scope. The extras (ff04, ssw2 "card"/dual, msis/wwhk multi-class "and/or card", vill "Ally"/"Kidnap a Bystander") are OUT — drive marker authoring off the six anchors above, not the raw grep

## Guardrails
- [ ] `HERO_COUNT_SOURCES` union AND array updated together; drift pin RUNTIME (10→14), not `satisfies`
- [ ] Resolvers pure/total: read only `G`, no throw, no registry read, no `.reduce()` in the count loop; unknown source → 0 (shipped default)
- [ ] All four class sources SELF-EXCLUSIVE — thread `triggeringCardId` exactly as `countTeamCardsPlayedThisTurn` does; reuse `cardHasClassWhenPlayed` (hc2 + granted), NO fresh class loop
- [ ] `explainCountSourceInputs` gets a matching branch per source (`count === length`, self-exclusive) — diagnostics path never alters the gameplay count (WP-706 invariant)
- [ ] **NO new hashed `G` field → NO setup-state re-pin**; confirm no `cardStats`/`cardTraits` shape diff. EMPIRICAL caveat: a pinned COMPLETE-GAME fixture that plays one of these six cards legitimately shifts THAT fixture's outcome hash (now scales + the ssw1 flat +1 disappears) — re-pin only such a fixture, only for the play that changed, never to mask an unrelated shift, and say so
- [ ] NO new parser suppression: the existing D-24016 / D-24489 Step-4 suppression drops the flat `[icon:attack|recruit]`; the inline `[hc:X]` duplicate `heroClassMatch` gate is LEFT as-is (Legendary Commander inline-`[team:shield]` parity)
- [ ] Card markers authored via the generator + full multi-stage regen — NEVER edit `data/cards/*.json` by hand; NO apply-script change (`VALID_TOKEN_PATTERN` already admits the token shape)

## Required `// why:` Comments
- [ ] Each new `heroCountSource.ts` union + array entry cites WP-711 / D-24534
- [ ] The shared `countHeroClassCardsPlayedThisTurn` self-exclusion (the "each OTHER" text) + `cardHasClassWhenPlayed` reuse
- [ ] The `explainCountSourceInputs` class branches' `count === length` self-exclusive mirror

## Files to Produce
- [ ] `rules/heroCountSource.ts` — four slugs (union + array, drift 10→14)
- [ ] `hero/heroCountSource.resolve.ts` — shared `countHeroClassCardsPlayedThisTurn` + four `resolveCountSource` branches + shared `collectHeroClassCardsPlayedThisTurn` + four `explainCountSourceInputs` branches (mirror the team helper/collector)
- [ ] `hero/heroCountSource.resolve.test.ts` — drift pin (RUNTIME, 14) + per-source unit tests (self-exclusive; hc2 dual-class; Size-Changing granted class; absent `cardTraits`) + explain parity (`count === length`)
- [ ] card-level grant test (`hero/heroEffects.execute.test.ts` or the count-scaled suite) — the six grants end-to-end (mag 1 + the bkwd mag 2)
- [ ] Card-data generator input `scripts/convert-cards/inputs/hero-ability-markers.json` — six markers; regenerate `data/cards/{ssw1,dkcy,bkwd,co2e}.json`
- [ ] NO `mechanic-provenance.json` row (count-source slugs are not recorded there — WP-674/680 convention)
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed + coverage feeds

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green
- [ ] confirm re-pin status: no state-hash fixture diff, OR an honest re-record of a complete-game fixture whose play legitimately changed (stated in the PR body)
- [ ] D-24534 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap 📝→✅
- [ ] PR squash-merged when green

## Common Failure Smells
- Class count includes the triggering card → forgot `triggeringCardId` exclusion (unlike `distinct-hero-classes`, these self-EXCLUDE).
- Dual-class (hc2) or Size-Changing card not counted → must go through `cardHasClassWhenPlayed`, not a raw `heroClass ===` check.
- A card-data feed fails `cards:check` → regenerate ALL derived feeds across the four sets, not just one JSON (card-data-derived CI gates).
- A state-hash fixture flips unexpectedly → you added a hashed field you shouldn't have; these sources read existing `G` only. A flip on a fixture that plays one of the six cards is EXPECTED — re-record honestly.
- Double-counted attack/recruit (flat + scaled) → the Step-4 icon suppression didn't fire; confirm the `attack-per-count`/`recruit-per-count` keyword is emitted (source must be in `HERO_COUNT_SOURCES` or the marker is silently ignored).
