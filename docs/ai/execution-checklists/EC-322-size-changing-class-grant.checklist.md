# EC-322 — Size-Changing: Hero Class-Grant on Play
# Execution Checklist

**Source:** docs/ai/work-packets/WP-290-size-changing-class-grant.md
**Layer:** Game Engine (`packages/game-engine` — setup/parser, per-card state, class-condition evaluation, hollow classification)
**Decisions:** D-24074 (per-card Size-Changing granted classes + the effective-class rule)

> **STOP = HARD STOP.** Any "else STOP" / "STOP and investigate" below means: cease editing, do NOT
> partial-fix or continue past the gap. Either resolve the precondition explicitly and re-verify, or
> abort and report. On any ambiguity, abort-and-report — never improvise.

---

## Before Starting

- [ ] `git status` clean; on a `claude/*` branch off `main` (`1dbea8b6`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` 0; `test` 0 — record baseline count
- [ ] **Scope-lock:** the target set is exactly the 13 files in §Files to Produce. Any edit outside it (beyond the regenerated coverage artifacts + governance close) = FAIL — surface as a blocker, do not absorb.
- [ ] Confirm the canonical rule in `data/metadata/keywords-full.json` (`key: "sizechanging"`): class-grant on play + Attack-as-VP — **not** a recruit discount — else STOP (the prior draft's error)
- [ ] Confirm `cardTraits[id].heroClass` is a single nullable string, built from `hc` at `setup/buildCardTraits.ts` and read-only at runtime — else STOP (the grant must not mutate it)
- [ ] Confirm the two inPlay class reads `heroClassMatch` + `distinctHeroClassesAtLeast` in `hero/heroConditions.evaluate.ts` — else STOP
- [ ] Confirm the wall-crawl category pattern in `hero/heroEffects.execute.ts` (`RECRUIT_TIME_EXECUTED_KEYWORDS` → `MVP_KEYWORDS`, no handler) — else STOP
- [ ] Confirm `data/cards/antm.json` `holographic-image-inducer` line 1 is `[keyword:Size-Changing] [hc:tech]` — else reconcile
- [ ] Read WP-290 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| New keyword | `'size-changing'` | D-24074 |
| HERO_KEYWORDS length after | `23` (was 22) | D-24030 drift rule |
| New hook field | `sizeChangingClasses?: string[]` (on `HeroAbilityHook`) | D-24074 |
| New G field | `cardSizeChangingClasses?: Record<CardExtId, string[]>` | D-24074 |
| Helper file | `hero/sizeChanging.logic.ts` | D-24074 |
| Helper API | `getGrantedClasses(G, cardId): readonly string[]` + `cardHasClassWhenPlayed(G, cardId, classSlug): boolean` | D-24074 |
| Effective class | `classSlug === cardTraits[id].heroClass` OR `classSlug ∈ cardSizeChangingClasses[id]` (presence, not count) | D-24074 |
| Not-hollow membership | new `CLASS_GRANT_KEYWORDS` set (`'size-changing'`) → MVP_KEYWORDS; **no** HERO_EFFECT_HANDLERS entry | wall-crawl precedent |
| Consult sites | `heroClassMatch` + `distinctHeroClassesAtLeast` (both via the helper) | WP-290 |

---

## Guardrails

1. **One effective-class helper, no re-implementation** — both `heroClassMatch` and `distinctHeroClassesAtLeast` derive class membership from `cardHasClassWhenPlayed` / `getGrantedClasses`; neither hand-rolls printed-vs-granted matching. Divergence = contract violation.
2. **Never mutate `G.cardTraits`** — the grant is an additive second class source consulted at read time. `cardSizeChangingClasses` is immutable setup data. No per-turn overlay, no end-of-turn cleanup (the grant expires with `inPlay`).
3. **Helper purity** — pure function of exactly `cardTraits[id].heroClass` + `cardSizeChangingClasses[id]`; no mutation, no caching/memoization, recomputed each call; `for...of`, no `.reduce()`.
4. **Parser: granted class, not condition** — on a `[keyword:Size-Changing]` line, extract the same-line `[hc:...]` token(s) as the granted-class list (normalize via `normalizeTraitSlug`); do NOT emit a `heroClassMatch` condition for them; emit NO unresolved marker. Extract ALL `[hc:...]` tokens on that line — a partial extraction or a residual unparsed `[hc:...]` fragment = FAIL. `[hc:X]` on OTHER lines stays an ordinary condition. A Size-Changing line with no `[hc:X]` → empty list (no grant, no hollow, no throw).
5. **No HERO_EFFECT_HANDLERS entry for `'size-changing'`** — it is a class-grant realized at read time, not an onPlay action (wall-crawl pattern). Handler count unchanged; not-hollow via `CLASS_GRANT_KEYWORDS` → MVP_KEYWORDS.
6. **Preserve each evaluator's self-semantics** — `heroClassMatch` self-EXCLUDES the triggering card; `distinctHeroClassesAtLeast` self-INCLUDES. The helper only supplies the class set; do not alter the in/exclusion logic.
7. **Update BOTH keyword drift tests** (`heroKeywords.test.ts` 22→23 AND `heroAbility.setup.test.ts` 22→23) + the MVP-coverage test (`heroEffects.execute.test.ts`).
8. **Determinism (fail-fast)** — `sim:runtime-observed` removes the `size-changing` hollow. The ONLY acceptable cause of a `finalStateHash` shift is a class-condition outcome changed by the new grant; any other cause = STOP and investigate, do NOT re-pin. If grant-attributable, re-pin + record as EXPECTED — never silently re-baseline.

---

## Required Implementation Order

1. `rules/heroKeywords.ts` — add `'size-changing'` (union + array; 22 → 23).
2. `rules/heroKeywords.test.ts` — drift 22 → 23.
3. `rules/heroAbility.types.ts` — add `sizeChangingClasses?: string[]` to `HeroAbilityHook`.
4. `types.ts` — add `cardSizeChangingClasses?: Record<CardExtId, string[]>` G field.
5. `setup/heroAbility.setup.ts` — recognize `[keyword:Size-Changing]`, extract + normalize same-line `[hc:...]` as the granted list onto `hook.sizeChangingClasses`; no condition, no unresolved marker; graceful empty.
6. `setup/heroAbility.setup.test.ts` — drift 22 → 23 + parse tests (granted-class; multi-line condition isolation; no `[hc]`).
7. `setup/buildInitialGameState.ts` — build `G.cardSizeChangingClasses` from the hooks.
8. `hero/sizeChanging.logic.ts` (new) + `hero/sizeChanging.logic.test.ts` (new) — the helper + tests; run.
9. `hero/heroConditions.evaluate.ts` — `heroClassMatch` + `distinctHeroClassesAtLeast` consult the helper.
10. `hero/heroConditions.evaluate.test.ts` — granted-class condition tests (null-printed, dual-class).
11. `hero/heroEffects.execute.ts` — `CLASS_GRANT_KEYWORDS` set (`'size-changing'`) → MVP_KEYWORDS; no handler.
12. `hero/heroEffects.execute.test.ts` — MVP-coverage drift; handler count unchanged.
13. Engine `test` + `tsc --noEmit`; then `ledger:heroes` + `sim:runtime-observed` + `sim:coverage --check`.

**Checkpoint:** run engine `test` after step 8 and again after step 10. Run the coverage regen + sweep after step 13. Red → diagnose before continuing.

---

## Required `// why:` Comments

- `hero/sizeChanging.logic.ts`: `// why: D-24074 — Size-Changing grants the listed class on play; a card in inPlay has class C iff printed heroClass OR granted (cardSizeChangingClasses). The single effective-class source; cardTraits is never mutated`
- `hero/heroConditions.evaluate.ts` (both reads): `// why: D-24074 — an in-play Size-Changing card counts as each of its effective classes (printed plus granted), via the shared cardHasClassWhenPlayed helper`
- `hero/heroEffects.execute.ts`: `// why: D-24074 — size-changing's effect is a class-grant realized at class-read time (no onPlay handler); membership keeps the play-time hook visit not-hollow (the wall-crawl pattern)`
- `setup/heroAbility.setup.ts`: `// why: D-24074 — on a Size-Changing line the [hc:...] tokens are the GRANTED classes (not a play condition); extract them onto the hook, emit no unresolved marker`

---

## Files to Produce

**New:**
- `packages/game-engine/src/hero/sizeChanging.logic.ts`
- `packages/game-engine/src/hero/sizeChanging.logic.test.ts`

**Modified:** `rules/heroKeywords.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.types.ts`, `types.ts`, `setup/heroAbility.setup.ts`, `setup/heroAbility.setup.test.ts`, `setup/buildInitialGameState.ts`, `hero/heroConditions.evaluate.ts`, `hero/heroConditions.evaluate.test.ts`, `hero/heroEffects.execute.ts`, `hero/heroEffects.execute.test.ts`

**Regenerated coverage artifacts:** `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`, and the `sim:coverage` baseline (sentinel re-pin only on a grant-attributable divergence).

**Governance (govern-close):** `docs/ai/DECISIONS.md` (D-24074 Active), `WORK_INDEX.md` (WP-290 Done), `EC_INDEX.md` (EC-322 Done), `STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`.

---

## Required Test Coverage

- [ ] parser: `[keyword:Size-Changing] [hc:tech]` → `sizeChangingClasses: ['tech']`, no heroClassMatch condition for it, no unresolved marker, no hollow
- [ ] parser: `[hc:X]` on a separate ability line stays an ordinary condition; Size-Changing line with no `[hc:X]` → `[]` (no grant, no throw)
- [ ] helper: `getGrantedClasses` `[]` when none; `cardHasClassWhenPlayed` true for printed, true for granted, true for both when printed ≠ granted, false otherwise
- [ ] heroClassMatch: null-printed-class card (granted-only, e.g. instinct) satisfies another card's match; dual-class card matches either class; triggering card still self-excluded
- [ ] distinctHeroClassesAtLeast: a dual-class Size-Changing card contributes both classes to the count
- [ ] drift: HERO_KEYWORDS length 23 (both drift tests); MVP-coverage recognizes `'size-changing'` via `CLASS_GRANT_KEYWORDS`; handler count unchanged

---

## After Completing

- [ ] engine `build` 0 + `test` green (≥ baseline + new cases) + `tsc --noEmit` 0 + `pnpm -r build` 0
- [ ] `ledger:heroes` regenerated (size-changing → executable) + `sim:runtime-observed` regenerated (hollow removed) + `sim:coverage --check` no regression
- [ ] Spot-check: `cardHasClassWhenPlayed` is the sole class-membership source at BOTH `heroClassMatch` and `distinctHeroClassesAtLeast` (no re-implemented matching)
- [ ] Spot-check: `'size-changing'` in HERO_KEYWORDS, in `CLASS_GRANT_KEYWORDS`/MVP_KEYWORDS, NOT in `HERO_EFFECT_HANDLERS`; `G.cardTraits` unmutated
- [ ] Spot-check: `git diff --name-only -- packages/game-engine` lists only the 13 files (+ coverage artifacts)
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify deferred to post-deploy (a Size-Changing Hero's class is seen by another Hero's class-matching ability)

---

## Common Failure Smells

- **Granted class mis-parsed as a condition** — the Size-Changing line's `[hc:X]` became a `heroClassMatch` gate, so the card's hook now requires you played that class. Extract it as the grant, not a condition.
- **Null-printed-class card counts as nothing** — only `cardTraits.heroClass` was read; the helper (granted classes) wasn't consulted at that read site. Both reads, via the one helper.
- **`size-changing` still flags a hollow** — not added to `CLASS_GRANT_KEYWORDS`/MVP_KEYWORDS, or the parser still pushes it to `unresolvedMarkers`.
- **`cardTraits` mutated** — someone wrote the granted class into `cardTraits` (immutable) instead of a separate source. Add `cardSizeChangingClasses`; never rewrite traits.
- **`finalStateHash` drift with no explanation** — STOP; confirm it is a grant-changed class condition (EXPECTED, re-pin) or investigate (do not re-pin blindly).
- **One drift test missed** — both `heroKeywords.test.ts` AND `heroAbility.setup.test.ts` assert 23.
