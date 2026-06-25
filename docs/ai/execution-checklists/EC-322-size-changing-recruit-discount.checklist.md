# EC-322 — Size-Changing: Hero Recruit-Cost Discount
# Execution Checklist

**Source:** docs/ai/work-packets/WP-290-size-changing-recruit-discount.md
**Layer:** Game Engine (`packages/game-engine` — setup/parser, economy, moves, simulation, UIState)
**Decisions:** D-24074 (per-card Size-Changing classes + the effective-recruit-cost rule)

---

## Before Starting

- [ ] `git status` clean; on a `claude/*` branch off `main` (`d1adb7fc`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `test` 0 — record baseline count
- [ ] Confirm the wall-crawl precedent in `hero/heroEffects.execute.ts`: `RECRUIT_TIME_EXECUTED_KEYWORDS` + the MVP-coverage drift test — else STOP
- [ ] Confirm `getPatrolModifier` (`board/boardKeywords.logic.ts`) + its two call sites (`fightVillain.ts`, `ai.legalMoves.ts`) — the cost-modifier pattern to mirror — else STOP
- [ ] Confirm `heroClassMatch` reads `G.playerZones[pid].inPlay` + `G.cardTraits[id].heroClass` (`hero/heroConditions.evaluate.ts`) — else STOP
- [ ] Confirm `data/cards/antm.json` `holographic-image-inducer` line 1 is `[keyword:Size-Changing] [hc:tech]` — else reconcile
- [ ] Read WP-290 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| New keyword | `'size-changing'` | D-24074 |
| HERO_KEYWORDS length after | `23` (was 22 post-WP-286) | D-24030 drift rule |
| New hook field | `sizeChangingClasses?: string[]` (on `HeroAbilityHook`) | D-24074 |
| New G field | `cardSizeChangingClasses?: Record<CardExtId, string[]>` | D-24074 |
| Discount helper | `getSizeChangingRecruitDiscount(G, playerID, cardId): number` in `economy/sizeChanging.logic.ts` | D-24074 |
| Discount value | `2 × (count of listed classes with ≥1 Hero of that class in inPlay)` | D-24074 |
| Effective cost | `Math.max(0, printedCost − discount)` (floors at 0 — regular, never negative) | D-24074 |
| Recruit-cost keyword set | `RECRUIT_COST_KEYWORDS` (new; `'size-changing'`; → MVP_KEYWORDS; NO HERO_EFFECT_HANDLERS entry) | wall-crawl precedent |
| Apply sites | `recruitHero.ts` (affordability + spend) + `ai.legalMoves.ts` (sim recruit) + `ui/uiState.build.ts` (HQ projection) | WP-290 |

---

## Guardrails

1. **Mirror `getPatrolModifier`** — a pure modifier helper; reuse the `inPlay` + `cardTraits` read (the `heroClassMatch` pattern), no new per-turn tracker, no `.reduce()`.
2. **Both authoritative recruit sites + the projection** — `recruitHero` AND `ai.legalMoves` AND the HQ UIState projection must compute the identical effective cost, or the engine/sim/UI disagree on price.
3. **Floor at 0** — regular Size-Changing never yields a negative cost (that is Microscopic, out of scope). `Math.max(0, …)`.
4. **No HERO_EFFECT_HANDLERS entry for `'size-changing'`** — it is a recruit-cost mechanic, not an onPlay action (the wall-crawl/dodge precedent: recognized keyword, executes elsewhere). The handler count stays the same; size-changing reaches `applied`/not-hollow via the new `RECRUIT_COST_KEYWORDS` → MVP_KEYWORDS membership.
5. **Do NOT mutate `G.cardStats[id].cost`** — the printed cost is immutable; the discount is applied at resolution, never by rewriting the stat.
6. **Parser grammar tolerance** — extract the `[hc:...]` class list after the marker for ALL forms: `[keyword:Size-Changing] [hc:X]`, `[keyword:Size-Changing]: [hc:X]`, multi-class `[hc:A], [hc:B]` (with/without spaces), trailing "this turn." Normalize each via `normalizeTraitSlug`.
7. **Update BOTH keyword drift tests** (`heroKeywords.test.ts` 22→23 AND `heroAbility.setup.test.ts` 22→23) + the MVP-coverage test (`heroEffects.execute.test.ts`).
8. **Determinism** — `sim:runtime-observed` removes the `size-changing` hollow; re-pin the sentinel ONLY if the competent bot now affords a previously-unaffordable recruit (an EXPECTED divergence) — record it, do not silently re-baseline an unexplained shift.

---

## Required Implementation Order

1. `rules/heroKeywords.ts` — add `'size-changing'` (union + array; 22 → 23).
2. `rules/heroKeywords.test.ts` — drift 22 → 23.
3. `rules/heroAbility.types.ts` — add `sizeChangingClasses?: string[]` to `HeroAbilityHook`.
4. `types.ts` — add `cardSizeChangingClasses?: Record<CardExtId, string[]>` G field.
5. `setup/heroAbility.setup.ts` — recognize `[keyword:Size-Changing]`, extract + normalize the `[hc:...]` class list, set `hook.sizeChangingClasses`; no onPlay effect/marker.
6. `setup/heroAbility.setup.test.ts` — drift 22 → 23 + parse tests (single/multi-class/punctuation; no unresolved marker).
7. `setup/buildInitialGameState.ts` — build `G.cardSizeChangingClasses` from the hooks.
8. `hero/heroEffects.execute.ts` — `RECRUIT_COST_KEYWORDS` set (`'size-changing'`) → MVP_KEYWORDS; no handler.
9. `hero/heroEffects.execute.test.ts` — MVP-coverage drift for the new category; handler count unchanged.
10. `economy/sizeChanging.logic.ts` (new) + `economy/sizeChanging.logic.test.ts` (new) — the discount helper + tests; run.
11. `moves/recruitHero.ts` — `requiredCost = Math.max(0, printedCost − discount)` (affordability + spend).
12. `simulation/ai.legalMoves.ts` — the same for the sim recruit affordability.
13. `ui/uiState.build.ts` — project the effective HQ recruit cost; `ui/uiState.build.test.ts` — test it.
14. Engine `test` + `tsc --noEmit`; then `ledger:heroes` + `sim:runtime-observed` + `sim:coverage --check`.

**Checkpoint:** run engine `test` after step 10 and again after step 13. Run the coverage regen + `sim:runtime-observed` after step 14. Red → diagnose before continuing.

---

## Required `// why:` Comments

- `economy/sizeChanging.logic.ts`: `// why: D-24074 — recruit discount = 2 per listed class played this turn (inPlay scan, the heroClassMatch read); mirrors getPatrolModifier; floors at 0 at the call site`
- `moves/recruitHero.ts` (the floor): `// why: D-24074 — effective recruit cost = max(0, printed − size-changing discount); regular Size-Changing never goes negative (Microscopic does — out of scope)`
- `ai.legalMoves.ts`: `// why: D-24074 — the sim must price a Size-Changing recruit at the discounted threshold or it never enumerates an affordable discounted recruit`
- `ui/uiState.build.ts`: `// why: D-24074 — project the effective (discounted) HQ recruit cost so the client gate allows it and the player sees the discount`
- `hero/heroEffects.execute.ts`: `// why: D-24074 — size-changing is a recruit-cost mechanic (no onPlay handler); membership marks it executable + keeps the play-time hook visit not-hollow (the wall-crawl pattern)`
- `setup/heroAbility.setup.ts`: `// why: D-24074 — Size-Changing carries a [hc:...] class list (the recruit-discount classes), not an onPlay effect; extract the list, emit no unresolved marker`

---

## Files to Produce

**New:**
- `packages/game-engine/src/economy/sizeChanging.logic.ts`
- `packages/game-engine/src/economy/sizeChanging.logic.test.ts`

**Modified:** `rules/heroKeywords.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.types.ts`, `types.ts`, `setup/heroAbility.setup.ts`, `setup/heroAbility.setup.test.ts`, `setup/buildInitialGameState.ts`, `hero/heroEffects.execute.ts`, `hero/heroEffects.execute.test.ts`, `moves/recruitHero.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.build.ts`, `ui/uiState.build.test.ts`

**Regenerated coverage artifacts:** `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`, and the `sim:coverage` baseline (sentinel re-pin only on an EXPECTED divergence).

**Governance (govern-close):** `docs/ai/DECISIONS.md` (D-24074 Active), `WORK_INDEX.md` (WP-290 Done), `EC_INDEX.md` (EC-322 Done), `STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`.

---

## Required Test Coverage

- [ ] parser: `[keyword:Size-Changing] [hc:tech]` → `sizeChangingClasses: ['tech']`, no unresolved marker, no hollow
- [ ] parser: multi-class + colon + spacing variants → the correct normalized class list
- [ ] discount: 0 when no Size-Changing data; 0 when no listed class in inPlay; `2 × matched` for 1 and 2 matched classes
- [ ] recruit: a player with the discounted-but-not-printed recruit amount CAN recruit; spend deducts the discounted amount
- [ ] sim: `getLegalMoves` enumerates the discounted recruit as affordable at the discounted threshold
- [ ] UIState: HQ slot shows printed cost with no class played; reduced effective cost with one/more played
- [ ] drift: HERO_KEYWORDS length 23 (both drift tests); MVP-coverage recognizes `'size-changing'`; handler count unchanged

---

## After Completing

- [ ] engine `build` 0 + `test` green (≥ baseline + new cases) + `tsc --noEmit` 0 + `pnpm -r build` 0
- [ ] `ledger:heroes` regenerated (size-changing → executable) + `sim:runtime-observed` regenerated (hollow removed) + `sim:coverage --check` no regression
- [ ] Spot-check: `getSizeChangingRecruitDiscount` applied at `recruitHero` + `ai.legalMoves` + the HQ projection (3 sites, identical math)
- [ ] Spot-check: `'size-changing'` in HERO_KEYWORDS, in `RECRUIT_COST_KEYWORDS`, NOT in `HERO_EFFECT_HANDLERS`
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify deferred to post-deploy (recruit a Size-Changing hero cheaper after playing the matching class)

---

## Common Failure Smells

- **Engine and UI disagree on price** — the discount was applied at `recruitHero` but not the HQ projection (or vice versa); the player sees full cost but recruits cheaper, or the client blocks an affordable recruit. All three sites, identical math.
- **`size-changing` still flags a hollow** — the keyword wasn't added to `RECRUIT_COST_KEYWORDS`/MVP_KEYWORDS, or the parser still pushes it to `unresolvedMarkers`.
- **Negative cost** — the floor (`Math.max(0, …)`) is missing; regular Size-Changing must never go below 0 (that's Microscopic).
- **`finalStateHash` drift with no explanation** — STOP; identify whether the bot now affords a new recruit (EXPECTED, re-pin) or something else changed (investigate).
- **One drift test missed** — both `heroKeywords.test.ts` AND `heroAbility.setup.test.ts` assert the count; update both to 23.
