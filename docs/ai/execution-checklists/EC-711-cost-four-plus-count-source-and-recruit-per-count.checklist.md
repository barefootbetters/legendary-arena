# EC-711 — cost-four-plus count source + recruit-per-count effect family (Execution Checklist)

**Source:** docs/ai/work-packets/WP-674-cost-four-plus-count-source-and-recruit-per-count.md
**Layer:** Game Engine

## Before Starting
- [x] WP-247 (attack-per-count / D-24016) shipped — the mechanism precedent
- [x] WP-673 (worthy count source / D-24488) shipped — the `triggeringCardId` + suppression precedent
- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- [x] cost-four-plus threshold = **4** (printed cost >= 4 = "costs 4 or more")
- [x] Per-unit rates: being-big-is-best **1**, follow-big-leads **1**, weight-of-the-world **2**, size-matters **1**
- [x] New count source slug = `cost-four-plus-played-this-turn` (DIGIT-FREE — "four", so it fits the locked `[a-z][a-z-]*` token form; no gate widening)
- [x] New effect family keyword = `recruit-per-count`
- [x] Marker targets: cvwr/goliath/being-big-is-best#1, noir/luke-cage-noir/follow-big-leads#0, noir/luke-cage-noir/weight-of-the-world#0, vill/juggernaut/size-matters#0
- [x] Base sha: executed off `origin/main` @ `f4f1620a`

## Guardrails
- [x] `HERO_COUNT_SOURCES` union AND array updated together; drift pin RUNTIME (N=2→3), not `satisfies`
- [x] `HERO_KEYWORDS` union AND array updated together; both length pins 43→44; `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` + handler-count pin 29→30
- [x] `recruit-per-count` carries a magnitude → NOT in `NO_MAGNITUDE_KEYWORDS`
- [x] Resolver pure/total: reads only `G`, no throw, no registry read
- [x] "OTHER cards" — resolver excludes `triggeringCardId`; both executors pass the played card id
- [x] Recruit-icon suppression fires ONLY on a recruit-per-count line; attack-icon suppression unchanged
- [x] Card data fixed via marker SOURCE + reproducible regen, never a hand-edit
- [x] Count source slug is digit-free → no locked token form widens
- [x] No hash re-pin unless a real diff appears (cvwr/noir/vill only; core-set pins unaffected)

## Required `// why:` Comments
- [x] `heroCountSource.ts` union + array entries cite WP-674 / D-24489
- [x] Resolver's `COST_4_PLUS_THRESHOLD` cites WP-674 / D-24489 + duplicate-first rationale
- [x] `heroKeywords.ts` union + array `recruit-per-count` entries cite WP-674 / D-24489
- [x] Executor `heroEffectRecruitPerCount` cites the OTHER-exclusion + recruit-grant
- [x] Parser Step 2d′, recruit-icon suppression, effect-builder branch cite WP-674 / D-24489
- [x] Marker apply script `VALID_TOKEN_PATTERN` recruit-per-count alternative cites WP-674 / D-24489

## Files to Produce
- [x] `rules/heroCountSource.ts` — union + array (N=3)
- [x] `hero/heroCountSource.resolve.ts` — resolver branch + threshold constant
- [x] `rules/heroKeywords.ts` — `recruit-per-count` union + array
- [x] `hero/heroEffects.execute.ts` — handler + HANDLED_KEYWORDS + dispatch
- [x] `setup/heroAbility.setup.ts` — recruit pattern + Step 2d′ + suppression + effect builder
- [x] test files — resolver (drift N=3 + cost-4 0/2 + self-exclusion), executor (recruit + cost-4 attack), parser (recruit + cost-4 attack), keyword drift/length pins
- [x] `inputs/hero-ability-markers.json` (4 markers) + `apply-hero-ability-markers.mjs` (token form)
- [x] `scripts/coverage/mechanic-provenance.json` — recruit-per-count → WP-674 / D-24489
- [x] Regenerated `data/cards/{cvwr,noir,vill}.json`, metadata feeds, coverage ledger + runtime-observed

## After Completing
- [x] `pnpm --filter @legendary-arena/game-engine test` green (3203/3203)
- [x] `pnpm -r build` 0
- [x] `pnpm cards:check` reproducible
- [x] `pnpm ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` green
- [x] `pnpm sim:coverage --check` OK (3 new-mechanic warnings, no regression)
- [x] Determinism pins unchanged (no re-pin)
- [x] D-24489 Active; WORK_INDEX `[x]` row + EC_INDEX row landed
- [x] `Tests-changed:` trailer on the commit; PR squash-merged when green

## Common Failure Smells
- A flat +N still granted → the marker never reached the card json (regen skipped) or icon-suppression did not fire.
- +N off by one (counts itself) → an executor did not pass the card id, or the resolver ignores `triggeringCardId`.
- Regen validator rejects the marker → the source slug contains a digit (must be `four`, not `4`) or the recruit-per-count token form is missing from `VALID_TOKEN_PATTERN`.
- recruit-per-count grants attack → the handler wrote `addResources(economy, grant, 0)` instead of `(economy, 0, grant)`.
