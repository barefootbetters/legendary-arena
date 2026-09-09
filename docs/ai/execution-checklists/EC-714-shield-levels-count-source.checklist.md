# EC-714 — `shield-levels` count source + Victory-Pile membership (Execution Checklist)

**Source:** docs/ai/work-packets/WP-677-shield-levels-count-source.md
**Layer:** Game Engine
**Status:** Pending

## Before Starting
- [ ] WP-675 (icon-presence `CardStatEntry` fields + dual hash re-pin / D-24490) shipped — read its `hasAttackIcon`/`hasRecruitIcon` setup sites, the resolver, and the re-pin FIRST; this WP mirrors the pattern
- [ ] WP-674 (count-source recipe / D-24489) shipped — read `HERO_COUNT_SOURCES`, the drift pin, and a resolver branch
- [ ] Confirm the victory-pile zone field name and that defeated Villains / fought Masterminds / earned Heroes populate it (baseline assertion) — the `victory-bystanders` source is the precedent
- [ ] `pnpm -r build` exits 0; engine suite green

## Locked Values (do not re-derive)
- [ ] New count-source slug = **`shield-levels`** (digit-free, hyphenated, marker-safe — NOT `s.h.i.e.l.d.-levels`, which has dots the token grammar forbids)
- [ ] Membership `isShieldOrHydra` = team ∈ {shield, hydra} **OR** case-insensitive "s.h.i.e.l.d." / "hydra" substring in card name / villain-group name / mastermind name (universal-rules-v23 §S.H.I.E.L.D. Level) — NOT Heroes-only
- [ ] `shield-levels` resolver = count of `G.playerZones[pid].victory` cards (field is `victory`, NOT `victoryPile`) with `isShieldOrHydra === true`; **no** triggering-card self-exclusion (unlike the icon sources)
- [ ] Synthesized basics: the 3 S.H.I.E.L.D. basics (Agent/Trooper/Officer in `buildInitialGameState`) = `isShieldOrHydra: true`; Sidekick/Wound = `false`
- [ ] `perEach` divisor default = **1**; grant = `magnitude × floor(resolveCountSource / perEach)`

## Guardrails
- [ ] `HERO_COUNT_SOURCES` union AND array updated together; drift pin RUNTIME (N=5→6), not `satisfies`
- [ ] `isShieldOrHydra` populated at EVERY `CardStatEntry` build site (real setup, `mastermind.setup.ts`, synthesized basics, fixtures, mocks) — NOT a `hasAttackIcon`-style same-value copy: the reader structural types (`economy.logic.ts` `CardStatsFlatCard`, `VillainCardEntry`) lack `team`/`name` and must be extended to read them, or membership silently narrows to name-only → undercount
- [ ] **Dual hash re-pin** (`PRE_WP080_HASH` + sentinel `finalStateHash`): re-pin ONLY after confirming the sole canonical-JSON delta is the new `isShieldOrHydra` field; one-line rationale in the pin comment + D-24493
- [ ] Resolver pure/total: reads only `G`, no throw, no registry read
- [ ] `perEach` additive — existing per-unit grants (`perEach` absent → 1) byte-identical; add a test asserting so
- [ ] No card wired, no marker authored (source-only); WP-679 composes this
- [ ] Membership counts by name substring AND team icon — add a test for a card qualifying ONLY by name (e.g. a HYDRA Villain-Group card)

## Required `// why:` Comments
- [ ] `CardStatEntry.isShieldOrHydra` cites WP-677 / D-24493 + the §S.H.I.E.L.D. Level membership rule
- [ ] `heroCountSource.ts` `shield-levels` union + array entries cite WP-677 / D-24493
- [ ] The `shield-levels` resolver's "no self-exclusion / never consumes" cite the rulebook
- [ ] The dual re-pin comment states the delta is only the new `cardStats` field
- [ ] `perEach` (`floor` division) rationale cites the "for each N levels" printed shape

## Files to Produce
- [ ] `economy/economy.types.ts` (`CardStatEntry.isShieldOrHydra`) + `economy/economy.logic.ts` (extend `CardStatsFlatCard`/`VillainCardEntry` reader types to read `team`/`name`) + `mastermind.setup.ts` + `buildInitialGameState` (the 3 SHIELD basics = true) + `test/fixtureBuilders.ts` + mock setups
- [ ] `rules/heroCountSource.ts` — `shield-levels` (union + array, N=6)
- [ ] `hero/heroCountSource.resolve.ts` — `shield-levels` resolver branch (`zones.victory` membership count)
- [ ] `hero/heroCountSource.resolve.test.ts` — drift pin N=5→6 (RUNTIME)
- [ ] `hero/heroEffects.execute.ts` — `perEach` on `heroEffectAttackPerCount` / `heroEffectRecruitPerCount` + the count-scaled descriptor (`rules/heroCountSource.ts` `CountScaledChoiceOption` or the effect type)
- [ ] NO `mechanic-provenance.json` row — that file records mechanic keys, not count-source slugs (no existing source appears there); `shield-levels` coverage rides the source registration + `sim:runtime-observed`
- [ ] tests: membership (**team-icon path** + name-substring path + negative), resolver (count, no self-exclusion), `perEach` (`floor(count/2)`, absent = ÷1), the dual re-pin fixtures
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible (no card edits; derived feeds regenerated)
- [ ] `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green (a `shield-levels` new-mechanic warning acceptable — registered, not yet card-observed)
- [ ] dual re-pin landed, delta verified = new `cardStats` field only
- [ ] D-24493 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer (re-pin fixtures); PR squash-merged when green

## Common Failure Smells
- Count drops name-only S.H.I.E.L.D./HYDRA cards → membership used team icon only, not the name substring.
- Count self-excludes → copied the icon-source resolver's `triggeringCardId` exclusion; S.H.I.E.L.D. Level counts the whole pile.
- Every unrelated replay fixture fails → expected (the `cardStats` field re-pins the oracles); confirm the delta is ONLY the new field before re-pinning, never to mask an unrelated shift.
- `perEach` changed an existing per-unit grant → the default must be 1 and division `floor`.
