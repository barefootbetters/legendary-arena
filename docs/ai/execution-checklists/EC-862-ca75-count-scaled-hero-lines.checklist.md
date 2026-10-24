# EC-862 — Cap 75th Count-Scaled Hero Lines (Execution Checklist)

**Source:** docs/ai/work-packets/WP-824-ca75-count-scaled-hero-lines.md
**Layer:** Game Engine (`rules/` + `hero/` count source) plus card-data markers

## Before Starting
- [ ] `HeroCountSource` / `HERO_COUNT_SOURCES` hold 16 values, the last `extra-cards-drawn-this-turn` (`rules/heroCountSource.ts` ~L36 / ~L68); the drift pin says 16 (`hero/heroCountSource.resolve.test.ts` ~L55-96).
- [ ] `resolveCountSource` (~L381) / `explainCountSourceInputs` (~L745) each have a `'shield-heroes-played-this-turn'` case (`hero/heroCountSource.resolve.ts`).
- [ ] The three target lines in `data/cards/ca75.json` carry no marker; `check-hero-count-markers.mjs` `DEFERRED` (~L155) lists both ca75 Savior lines.
- [ ] `G.cardStats` has `cost: 0` rows for the Agent / Trooper (`setup/buildInitialGameState.ts` ~L542-543).
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0; record the engine test total.

## Locked Values (do not re-derive)
- **Source slug:** `'shield-heroes-cost-one-plus-played-this-turn'`, appended LAST to both the `HeroCountSource` union and `HERO_COUNT_SOURCES` (17 entries).
- **Threshold constant** (`hero/heroCountSource.resolve.ts`): `const SHIELD_HERO_MINIMUM_COST = 1;`.
- **Counter:** `function countShieldHeroesCostOnePlusPlayedThisTurn(G, playerID, triggeringCardId): number`.
  - Iterate `playedCardIdsThisTurn(G, playerZones.inPlay)` with `for…of`; skip `triggeringCardId`.
  - Count a card iff `cardCountsAsTeamMember(G, id, 'shield')` AND `(G.cardStats?.[id]?.cost ?? 0) >= SHIELD_HERO_MINIMUM_COST`.
  - Missing `playerZones` → 0.
- **Collector:** `collectShieldHeroesCostOnePlusPlayedThisTurn(G, playerID, triggeringCardId): CardExtId[]`, the same predicate, returning ids in play order.
- **Dispatch:** `case 'shield-heroes-cost-one-plus-played-this-turn'` in `resolveCountSource` (after `'shield-heroes-played-this-turn'`) and in `explainCountSourceInputs`.
- **Label:** `'other S.H.I.E.L.D. Hero costing 1 or more played this turn'`.
- **Markers** (`hero-ability-markers.json`, `ca75` array, after the International Strike Force ability-0 entry, in this order; each entry is `{ heroSlug, cardSlug, abilityIndex, markupToken }`, the existing shape):
  - `captain-america-falcon` / `star-spangled-hero` / abilityIndex 1 / `[keyword:recruit-per-count:distinct-hero-classes-played-this-turn:2]`
  - `steve-rogers-director-of-shield` / `international-strike-force` / abilityIndex 1 / `[keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]`
  - `agent-x-13` / `paramilitary-ops` / abilityIndex 0 / `[keyword:attack-per-count:shield-heroes-cost-one-plus-played-this-turn:1]`
- **Count-marker gate:** remove the two ca75 entries from `DEFERRED` in `scripts/check-hero-count-markers.mjs` (the three remaining entries stay).
- **Comment accuracy:** `// why:` comments name the Agent / Trooper as `cost: 0` in `G.cardStats` (not "no row"); the `?? 0` fallback is for cards without a row.

## Guardrails
- Card data is generated: edit the marker map, run `node scripts/convert-cards/apply-hero-ability-markers.mjs` (expect 3 lines updated); never hand-edit `ca75.json`.
- No parser change. If a Savior line does not build one hook with the Savior condition and one per-count effect, STOP (scope change).
- Lockstep: union, array, both dispatch cases and the label land together; the drift pin is a RUNTIME keyset assertion (D-24372).
- Pure read: the resolver reads `G` only, never mutates, never throws.
- Regenerate only what a `:check` reports stale; record each delta. In the dashboard test only the `totalObs` literal changes, by the feed's `summary.totalObservations` delta (or a named baseline floor); `resolvedObs` / `percentResolved` stay byte-unchanged, else STOP.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- The union and array entries: WP-824 / D-24757; Paramilitary Ops; the Agent / Trooper starters have `cost: 0` rows in `G.cardStats`; self-exclusive; why "one" is spelled out.
- `SHIELD_HERO_MINIMUM_COST`: the printed "costs 1 or more"; the Officer counts, the starters don't.
- The `resolveCountSource` case: Paramilitary Ops' clause.
- `check-hero-count-markers.mjs`: why the two Savior deferrals are removed.
- The dashboard re-pin: dated, the feed delta and the unchanged resolvedObs / percent.

## Files to Produce
- `packages/game-engine/src/rules/heroCountSource.ts` — **modified** (union + array)
- `packages/game-engine/src/hero/heroCountSource.resolve.ts` + test — **modified**
- `packages/game-engine/src/hero/countSourceLabel.ts` — **modified**
- `packages/game-engine/src/hero/ca75CountScaledHeroLines.test.ts` — **new** (T1-T10)
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/check-hero-count-markers.mjs` — **modified**; `data/cards/ca75.json` — **regenerated**
- If stale: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (totalObs pin)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` — **modified** (governance close)

## After Completing
- [ ] T1-T14 pass (starter fixtures carry `{ cost: 0 }` rows); `countSourceLabel.test.ts` passes; engine delta +13 tests / +4 suites.
- [ ] Revert proof: with the baseline `ca75.json` swapped in (`git show origin/main:data/cards/ca75.json`), T1, T2, T4, T5, T7, T8, T10 fail; restored afterwards.
- [ ] Regen chain, in order: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed` → `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` + totalObs re-pin; each step only if its `:check` reports stale after the prior step.
- [ ] `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0.
- [ ] `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, then `test:coverage` → 0 fail; if `useInPlayCoverage.test.ts` changed, `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24757 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-862:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match on `play.legendary-arena.com` (gitSha checked) shows each Savior line's count-scaled grant with 3 Bystanders and none with 2, and Paramilitary Ops +0 after starters, +2 after an Officer and another costed S.H.I.E.L.D. Hero.

## Common Failure Smells
- A Savior line still logs a flat `+1` / `+2` → the marker didn't land (wrong abilityIndex) or the regen wasn't run.
- A Savior line grants with 2 Bystanders → the Savior condition was dropped from the hook.
- Paramilitary Ops gets +1 after only starters → the cost filter is missing, or the marker names `shield-heroes-played-this-turn`.
- Paramilitary Ops never counts the Officer → the predicate used `cardHasTeamWhenPlayed` (trait-only) instead of `cardCountsAsTeamMember`.
- The marker is silently ignored → the source is missing from `HERO_COUNT_SOURCES` (`isValidHeroCountSource` rejects it).
- Dashboard Gates red on `totalObs` → the feed was regenerated without the paired re-pin, or the dashboard copy wasn't refreshed (`prebuild:coverage`).
