# EC-751 — Kidnap-per-count bystander-capture hero effect (Execution Checklist)

**Source:** docs/ai/work-packets/WP-714-kidnap-per-count.md
**Layer:** Game Engine + card-data
**Status:** Pending

## Before Starting
- [ ] WP-711 (`tech-heroes-played-this-turn` count source / D-24534) shipped — read `resolveCountSource` case at `hero/heroCountSource.resolve.ts:426` (self-EXCLUSIVE via `triggeringCardId`); this WP REUSES it, adds NO count source
- [ ] WP-247 / WP-674 (attack/recruit-per-count / D-24016 / D-24489) shipped — copy the count-scaling half from `heroEffectRecruitPerCount` (`hero/heroEffects.execute.ts:1992`) and the parse from Step 2d (`setup/heroAbility.setup.ts`)
- [ ] Read `heroEffectHereHoldThis` (`hero/heroEffects.execute.ts:2715`) + its imports `attachBystanderToCityVillain` / `captureBystanderToMastermind` (`moves/seatChoiceCards.ts`) + `board/bystanders.logic.ts:attachBystanderToVillain` — the per-capture action REUSES these, adds NO capture primitive
- [ ] Confirm the target line: `vill/ultron/genetic-experimentation` abilityIndex 0 = `[hc:tech]: Kidnap a Bystander for each other [hc:tech] Ally you played this turn.` (currently on the `check-hero-count-markers` DEFERRED allowlist)
- [ ] `pnpm -r build` exits 0; engine suite green

## Locked Values (do not re-derive)
- [ ] New keyword: **`kidnap-per-count`** (added to `HeroKeyword` union + `HERO_KEYWORDS` array, lockstep; carries a magnitude — keep OUT of `NO_MAGNITUDE_KEYWORDS`)
- [ ] Executor: **N = (magnitude ?? 0) × ⌊resolveCountSource(...) / (perEach ?? 1)⌋**; count source **`tech-heroes-played-this-turn`** (self-EXCLUSIVE — thread `triggeringCardId`/`cardId`)
- [ ] Target: **first City villain by ascending city index**; when the City holds no villain, **`captureBystanderToMastermind(G)`** fallback. **NON-interactive** (no `PendingSeatChoice`), synchronous loop. (D-24537 operator decision)
- [ ] **Supply-bounded:** `if (G.piles.bystanders.length === 0) break;` each iteration (the `villainEffectCaptureBystander` counted-variant precedent)
- [ ] Marker: **`[keyword:kidnap-per-count:tech-heroes-played-this-turn:1]`** on `vill/ultron/genetic-experimentation` abilityIndex 0
- [ ] Grammar alt: **`^\[keyword:kidnap-per-count:[a-z][a-z-]*:[1-9]\d*\]$`** in `VALID_TOKEN_PATTERN` (three-segment; no `perEach` segment needed for this card)
- [ ] Drift pins: `HERO_KEYWORDS` **58 → 59** in BOTH (a) `rules/heroKeywords.test.ts` (`:65-71`, length + `.includes()` — "58→59" fully describes it) AND (b) `rules/heroAbility.setup.test.ts` — length assert (`:625`) **AND** the ordered `expectedKeywords` `deepStrictEqual` (from `:560`): insert `'kidnap-per-count'` at the array position matching its `HERO_KEYWORDS` insertion (both RUNTIME, per D-24372); `HERO_EFFECT_HANDLERS` keys **42 → 43** (`hero/heroEffects.execute.test.ts:97`); `HANDLED_KEYWORDS` ↔ `HERO_EFFECT_HANDLERS` parity kept
- [ ] `check-hero-count-markers.mjs`: `markerPresentFor` also accepts `[keyword:kidnap-per-count:<class>-heroes-played-this-turn:` AND remove the `vill/ultron/genetic-experimentation` DEFERRED entry (else it becomes a STALE deferral → gate FAIL)

## Guardrails
- [ ] `HeroKeyword` union AND `HERO_KEYWORDS` array updated together; drift RUNTIME (58→59), not `satisfies`; handler-registry parity kept
- [ ] Executor pure-ish/total: reads `G`, mutates only capture zones via the shipped helpers, no throw, no registry read, no `.reduce()` in the capture loop; count 0 → 0 captures (no-op)
- [ ] Count SELF-EXCLUSIVE via the shipped `tech-heroes-played-this-turn` resolver (honours hc2 + Size-Changing granted classes) — do NOT write a fresh class loop
- [ ] Capture deterministic (first City villain by index; Mastermind fallback) + supply-bounded; NO RNG, NO interactive park, NO Victory-Pile banking
- [ ] NO printed-icon suppression (this line has no `[icon:attack|recruit]`); NO new count source; NO new capture primitive; NO new hashed `G` field
- [ ] Marker authored via `hero-ability-markers.json` + full multi-stage regen — NEVER edit `data/cards/*.json` by hand; the apply-script grammar IS changed here (new token form)
- [ ] Determinism re-pin: no new hashed field → no setup-state re-pin; a committed COMPLETE-GAME fixture that plays Genetic Experimentation legitimately shifts THAT fixture's outcome hash (now captures) — re-pin only that fixture, only for the play that changed, and say so

## Required `// why:` Comments
- [ ] The `kidnap-per-count` union + array entry cites WP-714 / D-24537
- [ ] The executor's `N = magnitude × ⌊count/perEach⌋` + self-exclusion (reuse of the resource-per-count scaling for a capture grant)
- [ ] The auto-target choice (first City villain, Mastermind fallback, non-interactive) citing D-24537, and the supply-bounded `break`
- [ ] The `apply-hero-ability-markers.mjs` new token alternative citing WP-714
- [ ] `check-hero-count-markers` accepting `kidnap-per-count` + the removed deferral

## Files to Produce
- [ ] `rules/heroKeywords.ts` — `'kidnap-per-count'` in union + array (drift 58→59)
- [ ] `hero/heroEffects.execute.ts` — `heroEffectKidnapPerCount` + `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` (NOT `NO_MAGNITUDE_KEYWORDS`)
- [ ] `hero/heroEffects.execute.test.ts` — executor unit tests (count-scaled N; auto-target first City villain; Mastermind fallback; supply exhaustion; count 0 no-op; self-exclusive via hc2) + handler-registry drift (**42 → 43**, `:97`)
- [ ] `setup/heroAbility.setup.ts` — extraction step (regex + `isValidHeroCountSource` gate) + effect-descriptor builder branch
- [ ] `setup/heroAbility.setup.test.ts` — the marker→descriptor parse (alongside the existing `tech-heroes-played-this-turn` parse cases ~`:850-868`)
- [ ] `rules/heroAbility.setup.test.ts` — `HERO_KEYWORDS` drift **58 → 59**: the length assert (`:625`) AND the ordered `expectedKeywords` deep-equal (`:560`) — add `'kidnap-per-count'` in array order
- [ ] `rules/heroKeywords.test.ts` — `HERO_KEYWORDS` drift **58 → 59** (`:65-71`)
- [ ] `scripts/convert-cards/apply-hero-ability-markers.mjs` — `kidnap-per-count` grammar alt + valid-forms text
- [ ] `scripts/convert-cards/inputs/hero-ability-markers.json` — one marker; regenerate `data/cards/vill.json`
- [ ] `scripts/check-hero-count-markers.mjs` (+ `.test.ts`) — recognize `kidnap-per-count`; remove the Genetic Experimentation deferral
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed feeds

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `cards:count-markers:check` + `:test` green
- [ ] confirm re-pin status: no state-hash fixture diff, OR an honest re-record of a complete-game fixture whose play legitimately changed (stated in the PR body)
- [ ] D-24537 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap 📝→✅
- [ ] PR squash-merged when green

## Common Failure Smells
- Genetic Experimentation captures nothing → the marker source isn't in `HERO_COUNT_SOURCES` (it is — `tech-heroes-played-this-turn`), OR `kidnap-per-count` wasn't added to `HANDLED_KEYWORDS`/`HERO_EFFECT_HANDLERS` so the descriptor is silently dropped.
- Count includes the triggering card → forgot to thread `cardId` as `triggeringCardId` (this source self-EXCLUDES).
- `cards:count-markers:check` fails with a STALE deferred entry → you marked the card but left it on the `DEFERRED` allowlist; remove it. Or it reports the line unmarked → `markerPresentFor` doesn't recognize `kidnap-per-count`.
- Capture never lands / throws when City is empty → missing the `captureBystanderToMastermind` fallback.
- Infinite/over-capture when the supply runs out → missing the `G.piles.bystanders.length === 0` break.
- `HERO_KEYWORDS` drift fails at 58 → bump the RUNTIME pin to 59 and add the entry to BOTH union and array.
