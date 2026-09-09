# EC-710 — Divine Lightning Worthy count-scaled attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-673-divine-lightning-worthy-count-scaled-attack.md
**Layer:** Game Engine

## Before Starting
- [x] WP-247 (attack-per-count / D-24016) shipped — `victory-bystanders` is the precedent
- [x] WP-653 (Worthy = Hero costing ≥5 / D-24464) shipped
- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- [x] Worthy cost threshold = **5** (D-24464); mirrors the parser's Worthy gate value
- [x] Per-unit rate = **1** (`[keyword:attack-per-count:worthy-cards-played-this-turn:1]`)
- [x] New count source slug = `worthy-cards-played-this-turn` (lowercase-hyphen)
- [x] Marker target = `asrd` / `thor` / `divine-lightning` / abilityIndex 0
- [x] Base sha: executed off `origin/main` @ `3f56dcf0`

## Guardrails
- [x] `HeroCountSource` union AND `HERO_COUNT_SOURCES` array updated together
- [x] New drift pin is a RUNTIME assertion (N=1→2), not a bare `satisfies` (D-24372)
- [x] Resolver pure/total: reads only `G`, no throw, no registry read
- [x] "OTHER cards" — resolver excludes `triggeringCardId`; executor passes the played card id
- [x] Worthy condition suppressed ONLY on a worthy count-scaled line (a plain Worthy line still gates)
- [x] Card data fixed via marker SOURCE + reproducible regen, never a hand-edit of `asrd.json`
- [x] No hash re-pin unless a real diff appears (asrd-only; core-set pins unaffected)

## Required `// why:` Comments
- [x] `heroCountSource.ts` union + array entries cite WP-673 / D-24488
- [x] Resolver's `WORTHY_HERO_COST_THRESHOLD` cites D-24464 + the duplicate-first rationale
- [x] Executor's `resolveCountSource(..., cardId)` call cites the OTHER-exclusion (D-24488)
- [x] Parser's `lineHasWorthyCountScaledAttack` + the gated Worthy push cite D-24488

## Files to Produce
- [x] `rules/heroCountSource.ts` — union + array
- [x] `hero/heroCountSource.resolve.ts` — resolver branch + `triggeringCardId`
- [x] `hero/heroEffects.execute.ts` — thread the played card id
- [x] `setup/heroAbility.setup.ts` — suppress the Worthy gate on the marked line
- [x] 3 test files — resolver (drift N=2 + 0/1/2 + self-exclusion), executor, parser
- [x] `inputs/hero-ability-markers.json` + regenerated `data/cards/asrd.json`
- [x] Regenerated `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`

## After Completing
- [x] `pnpm --filter @legendary-arena/game-engine test` green (3185/3185)
- [x] `pnpm -r build` 0
- [x] `pnpm cards:check` reproducible
- [x] `pnpm ledger:heroes:check` green (regenerated); `pnpm sim:coverage --check` OK
- [x] Determinism pins unchanged (no re-pin)
- [x] D-24488 Active; WORK_INDEX `[x]` row + EC_INDEX row landed
- [x] `Tests-changed:` trailer on the commit; PR squash-merged when green

## Common Failure Smells
- A flat +1 still granted → the marker never reached `asrd.json` (regen skipped) or the icon-suppression did not fire.
- +N off by one (counts itself) → executor did not pass the card id, or the resolver ignores `triggeringCardId`.
- A plain Worthy line stopped gating → the suppression boolean is too broad (must require the worthy count-scaled marker).
