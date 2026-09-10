# EC-717 — Per-count sources for five unmarked core heroes (Execution Checklist)

**Source:** docs/ai/work-packets/WP-680-core-hero-per-count-sources.md
**Layer:** Game Engine + card-data
**Status:** Pending

## Before Starting
- [ ] WP-674 (recruit-per-count family + count-source recipe / D-24489) shipped — read `HERO_COUNT_SOURCES`, a resolver branch, and the drift pin FIRST; this WP mirrors the recipe
- [ ] WP-247 (attack-per-count / D-24016) shipped — the grant family is reused verbatim; no new grant mechanism
- [ ] Read the D-24055 `distinctHeroClassesAtLeast` counting in `hero/heroConditions.evaluate.ts` (incl. `getGrantedClasses`, D-24074) — the distinct-class source REUSES this counting, does not re-derive it
- [ ] Confirm `G.cardTraits[id].heroClass`/`.team` and `G.cardStats[id].cost` are populated at HEAD (baseline assertion) — all four sources read these; NO new `G` field
- [ ] `pnpm -r build` exits 0; engine suite green

## Locked Values (do not re-derive)
- [ ] Four new source slugs: **`distinct-hero-classes-played-this-turn`**, **`avengers-played-this-turn`**, **`shield-heroes-played-this-turn`**, **`odd-cost-heroes-played-this-turn`** (digit-free, hyphenated, marker-safe)
- [ ] `distinct-hero-classes-played-this-turn` = distinct non-null `cardTraits.heroClass` across `inPlay`, **SELF-INCLUSIVE** (ignores `triggeringCardId`, like `shield-levels`); Size-Changing counts as EACH granted class (D-24055/D-24074 helper)
- [ ] `avengers-played-this-turn` / `shield-heroes-played-this-turn` = count of **OTHER** `inPlay` cards with `cardTraits.team === 'avengers'` / `'shield'` (self-exclusive via `triggeringCardId`)
- [ ] `odd-cost-heroes-played-this-turn` = count of **OTHER** `inPlay` cards with `cardStats.cost % 2 === 1`; missing `cardStats` row = cost 0 = even = never counts
- [ ] Markers: Perfect Teamwork attack-per-count:distinct…:1; Avengers Assemble recruit-per-count:distinct…:1; A Day Unlike Any Other (`[team:avengers]:` gate) attack-per-count:avengers-played-this-turn:3; Legendary Commander attack-per-count:shield-heroes-played-this-turn:1; Oddball attack-per-count:odd-cost-heroes-played-this-turn:1
- [ ] Oddball text: correct upstream `[icon:vp]` → odd-numbered **cost** (convert-cards overlay/patch), then regenerate `data/cards/core.json`

## Guardrails
- [ ] `HERO_COUNT_SOURCES` union AND array updated together; drift pin RUNTIME (N→N+4), not `satisfies`
- [ ] Resolvers pure/total: read only `G`, no throw, no registry read, no `.reduce()` in the count loops
- [ ] Distinct-class source SELF-INCLUSIVE and reuses the D-24055 counting — NOT a fresh divergent count
- [ ] Team + odd-cost sources SELF-EXCLUSIVE — thread `triggeringCardId` exactly as `worthy-cards-played-this-turn` does
- [ ] **NO new hashed `G` field → NO setup-state re-pin**; confirm no `cardStats`/`cardTraits` shape diff. EMPIRICAL caveat: a pinned COMPLETE-GAME fixture that plays one of these newly-active cards legitimately shifts THAT fixture's outcome hash — re-pin only such a fixture, only for the play that changed, never to mask an unrelated shift
- [ ] Card markers authored via the generator + full multi-stage regen — NEVER edit `data/cards/*.json` by hand
- [ ] Oddball fidelity: confirm the odd-**cost** ruling before authoring the marker; if VP is genuinely intended, STOP and defer Oddball (no per-hero VP exists to read)

## Required `// why:` Comments
- [ ] Each new `heroCountSource.ts` union + array entry cites WP-680 / D-24497
- [ ] The distinct-class resolver's SELF-INCLUSIVE choice + D-24055 counting reuse
- [ ] The team/odd-cost resolvers' self-exclusion (the "each OTHER" text)
- [ ] The odd-cost resolver's `[icon:vp]`→cost fidelity note (hero cards carry no VP)

## Files to Produce
- [ ] `rules/heroCountSource.ts` — four slugs (union + array, drift N→N+4)
- [ ] `hero/heroCountSource.resolve.ts` — four resolver branches (two team branches; odd-cost branch; the distinct-class branch EXPORTS + calls `countDistinctHeroClassesInPlay` from `hero/heroConditions.evaluate.ts`, or duplicates the ~10-line loop per duplicate-first — it is module-private today)
- [ ] `hero/heroConditions.evaluate.ts` — export `countDistinctHeroClassesInPlay` if reusing it
- [ ] `hero/heroCountSource.resolve.test.ts` — drift pin (RUNTIME) + per-source unit tests (self-inclusive vs self-exclusive, Size-Changing, odd/even cost boundary, absent `cardStats`)
- [ ] `hero/heroEffects.execute.test.ts` (or the card-level suite) — each of the five grants end-to-end (mag 1 + mag 3; A Day gated by a second Avenger)
- [ ] Card-data generator input: hero-ability markers for the 5 cards + Oddball `[icon:vp]`→cost overlay; regenerate `data/cards/core.json`
- [ ] NO `mechanic-provenance.json` row (count-source slugs are not recorded there — WP-674/677 convention)
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed + coverage feeds

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green
- [ ] confirm NO hash re-pin was needed (no state-hash fixture diff)
- [ ] D-24497 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap [d]→[x]
- [ ] PR squash-merged when green

## Common Failure Smells
- Distinct-class count self-excludes → wrong; "each color of Hero **you have**" is self-inclusive (unlike the team sources).
- Team/odd-cost count includes the triggering card → forgot `triggeringCardId` exclusion.
- Size-Changing hero counted once → must count as EACH granted class (D-24074 helper).
- A card-data feed fails `cards:check` → regenerate ALL derived feeds, not just `core.json` (card-data-derived CI gates).
- A state-hash fixture flips → you added a hashed field you shouldn't have; these sources read existing `G` only.
