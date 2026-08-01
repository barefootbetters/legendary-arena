# EC-520 — Core Villain-Effect Vocabulary, Tier A (Execution Checklist)

**Source:** docs/ai/work-packets/WP-485-villain-effect-vocab-tier-a.md
**Layer:** Game Engine (handlers) + Registry card-data input (markers) — downward edge

## Before Starting
- [ ] On `origin/main` (post-reserve #1157), worktree clean; game-engine +
      card-data build/test green.
- [ ] Confirm the three abilities are still `unmarked-ability` today:
      `enemies-of-asgard/enchantress` "Fight: Draw three cards.",
      `enemies-of-asgard/destroyer` "Fight: KO all your [team:shield] Heroes.",
      `masters-of-evil/baron-zemo` "Fight: For each of your [team:avengers] Heroes,
      rescue a Bystander." (data/cards/core.json).
- [ ] Confirm `playerHasHeroMatchingTrait` (hand+in-play, `G.cardTraits`),
      `drawCardsIntoHand`, and the `capture-bystander` player-award branch exist.
- [ ] **Scaffold:** add the three primitives to the union + array and run
      `pnpm --filter @legendary-arena/game-engine test` — record the
      `villainAbility.types.test.ts` drift-assertion break before implementing (the
      union/array parity test fails until both are extended together, D-24034).
- [ ] **Exact target file set (any outside = FAIL, STOP):**
      `rules/villainAbility.types.ts` (+`.test.ts`), `setup/villainAbility.setup.ts`
      (+`.test.ts`), `villain/villainEffects.execute.ts` (+`.test.ts`),
      `diagnostics/hollowEffect.test.ts`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
      `scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json` (generated),
      `docs/ai/coverage/villain-mechanic-ledger.json` + `.csv` (regenerated, CI-gated),
      `scripts/coverage/mechanic-provenance.json`, `docs/ai/DECISIONS.md`.

## Locked Values (do not re-derive)
- **Three new auto-resolve primitives** (append-only to the union AND
  `VILLAIN_EFFECT_PRIMITIVES` array, D-24034):
  - `draw-cards-current:<N>` — current player draws N via `drawCardsIntoHand`.
  - `ko-heroes-current-by-trait:<team|hero-class>:<value>` — KO **all** current
    player's matching heroes from **hand + in-play** (operator ruling 2026-08-01).
  - `rescue-bystanders-current-by-trait-count:<team|hero-class>:<value>` — rescue N
    Bystanders, N = count of matching heroes (hand+in-play), bounded by supply.
- **Descriptor:** add `drawCount` (draw-cards-current only); REUSE `requireKind` /
  `requireValue` for the two trait predicates. No field removed/re-typed.
- **Markers (card data):** Enchantress `draw-cards-current:3`; Destroyer
  `ko-heroes-current-by-trait:team:shield`; Baron Zemo
  `rescue-bystanders-current-by-trait-count:team:avengers`. All timing `fight`.
- **New helper:** `countPlayerHeroesMatchingTrait` — the count sibling of
  `playerHasHeroMatchingTrait`, SAME hand+in-play scope + `G.cardTraits`.
- All three self-narrate via `pushLog`; keyword-less (no legacy reverse-map entry);
  return `{ targets: [] }` (or the KO/awarded targets). **No pending-choice, no
  block-all guard, no resolve move** (auto-resolve).
- Vocabulary is hand-synced in `apply-effect-markers.mjs`
  (`VILLAIN_EFFECT_PRIMITIVES` copy + `isValidParameterizedEffectToken` grammar).
- **CI ripple (do not skip):** `ledger:villains:check` (`ci.yml`) regenerates
  `docs/ai/coverage/villain-mechanic-ledger.{json,csv}` — the three abilities flip
  `(unmarked)` → their new primitive (Destroyer gains a 2nd executable Fight row).
  Run `pnpm -r build && pnpm ledger:villains` after marking; add the three
  `wp:WP-485 / decision:D-24290` entries to `scripts/coverage/mechanic-provenance.json`
  so the ledger's wp/decision columns populate (keeps the WP-484 index join non-blank).
- **`draw-cards-current` handler:** guard BOTH optional descriptor/context fields
  defensively (mirroring the `reveal-or-wound` precedent): `drawCount === undefined`
  → `return { targets: [] }`, and the OPTIONAL `shuffleContext` absent →
  `return { targets: [] }`. Do NOT loosen `drawCardsIntoHand`'s required
  `ShuffleProvider` / `count` params (`drawCards.logic.ts` is out of the allowlist;
  the Fight fire site already threads `{ random }`, and the parser always sets
  `drawCount`).

## Guardrails
- game-engine imports Node built-ins only; handlers pure/deterministic; `for...of`,
  no `.reduce()`; descriptive names; `00.6`.
- Markers authored in `villain-effect-markers.json`, applied by the generator —
  NEVER hand-edit `data/cards/core.json`. Regenerate; `git diff` must show ONLY the
  three Fight lines. Also drop the now-stale `core` destroyer.fight row from the
  `_unassigned` block (leave `msp1`, still deferred).
- Do NOT touch Tiers B–E surfaces: no city-space state, no `performVillainReveal`
  recursion, no `pending*Choices`, no cleanup-draw override, no new `G` field.
- Do NOT change existing primitives, `capture-bystander` behavior, the KO-hero
  helper, or the hero-effect vocabulary. Do NOT wire `ci.yml`.

## Required `// why:` Comments
- Why each new primitive is keyword-less + self-narrates (like `scry-ko`).
- Why Destroyer KOs from hand + in-play (operator ruling — "your Heroes" includes
  those played this turn).
- Why `rescue-bystanders-current-by-trait-count` reuses the `capture-bystander`
  player-award mechanism (rescue = award to the current player, bounded by supply).

## Files to Produce
- `villainAbility.types.ts` — union + array + descriptor `drawCount` (+ drift test).
- `villainAbility.setup.ts` — three `parseParameterizedEffect` grammar branches (+ parse test).
- `villainEffects.execute.ts` — three handlers + `countPlayerHeroesMatchingTrait` (+ handler tests).
- `hollowEffect.test.ts` — the three abilities no longer emit `unmarked-ability`.
- `villain-effect-markers.json` + `apply-effect-markers.mjs` — tokens + vocabulary sync.
- `data/cards/core.json` — regenerated (markers applied).
- `villain-mechanic-ledger.{json,csv}` — regenerated (`pnpm ledger:villains`);
  `mechanic-provenance.json` — 3 new mechanic → WP-485 / D-24290 entries.
- `DECISIONS.md` — land D-24290.

## After Completing
- [ ] `node scripts/convert-cards/apply-effect-markers.mjs`; `git diff --stat
      data/cards/core.json` shows only the three Fight lines.
- [ ] `pnpm -r build && pnpm ledger:villains` then `pnpm ledger:villains:check`
      exits 0 (villain-mechanic-ledger regenerated; provenance wp/decision set).
- [ ] game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
      `finalStateHash`/sentinel re-pin ONLY if a fixture reaches one of these fights
      (draw-cards-current reshuffle) — confirm empirically, re-pin with note if so.
- [ ] **D-24290 Active.** STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-520 Done.
- [ ] No file outside the allowlist (+ governance). Revert lagn-v1.json EOL churn.

## Common Failure Smells
- core.json shows more than three changed lines → a marker matched the wrong line,
  or the generator's vocabulary copy drifted from the engine union.
- Drift test red → union and array not extended together (D-24034).
- Destroyer misses just-played S.H.I.E.L.D. cards → handler scanned discard/hand
  only, not in-play (the existing KO helper's zones are wrong for this primitive).
- Baron Zemo rescues the wrong count → used has-trait (boolean) not the new count helper.
