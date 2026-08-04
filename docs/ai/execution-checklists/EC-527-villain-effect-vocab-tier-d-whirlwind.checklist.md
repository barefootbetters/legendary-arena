# EC-527 — Core Villain-Effect Vocabulary, Tier D (Whirlwind — Interactive Location-Gated KO)

**Source:** docs/ai/work-packets/WP-492-villain-effect-vocab-tier-d-whirlwind.md
**Layer:** Game Engine (pending-type field + parser + handler + resolve move + UIState
projection) + Registry card-data markers — downward edge only.

## Before Starting
- [ ] On `origin/main` (post-reserve; **after WP-489/D-24295 + WP-242/D-24007 are on
      main** — Tier D extends both), worktree clean; game-engine + card-data build/test green.
- [ ] Confirm Whirlwind is still `unmarked-ability` today: `core/masters-of-evil/whirlwind`
      "Fight: If you fight Whirlwind on the Rooftops or Bridge, KO two of your Heroes."
      (`data/cards/core.json`); it is the sole `masters-of-evil` `_unassigned` row.
- [ ] Confirm the pipeline reused UNCHANGED: `PendingKoHeroChoice` in `types.ts` is
      `{ choiceType, playerID }`; `resolveKoHeroChoice` front-pops one; the UIState
      projects `remaining = queue.length`; `PendingKoHeroChoicePrompt.vue` already
      renders `remaining > 1` (NO arena-client edit). `CITY_SPACE_NAMES` Rooftops=2,
      Bridge=4 (WP-489). `ko-hero:each:<N>` is the magnitude-grammar precedent.
- [ ] **Scaffold:** add the `remaining?` field + the `ko-hero:current:<N>` grammar and
      run `pnpm --filter @legendary-arena/game-engine test`. Expect **NO pre-existing
      break** (additive optional field; no primitive added → primitives-count stays 12;
      the WP-243 `remaining` test must still read 2 after the `Σ` change; M=1 paths
      byte-identical). "Extend the drift/round-trip test" = ADD positive coverage.
- [ ] **Exact target file set (any outside = FAIL, STOP; governance close-out excepted):**
      `types.ts`, `setup/villainAbility.setup.ts`(+test), `villain/villainEffects.execute.ts`(+test),
      `moves/koHeroChoice.resolve.ts`(+test), `ui/uiState.build.ts`(+test),
      `diagnostics/hollowEffect.test.ts`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
      `scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json`(generated),
      `docs/ai/coverage/villain-mechanic-ledger.json`+`.csv`(regenerated, CI-gated),
      `docs/ai/DECISIONS.md`
      **(+ governance close-out: `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
      `STATUS.md`, `NUMBER-LEDGER.md`).**

## Locked Values (do not re-derive)
- **`PendingKoHeroChoice.remaining?: number`** — additive optional; absent ≡ 1
  (append-only per D-24034). NOT a new choice type, NOT a descriptor field.
- **NO new `VillainEffectPrimitive`** (reuse `ko-hero` + the existing `magnitude?`);
  primitives-count stays **12**. NO new `G` field. NO arena-client change.
- **Marker grammar:** `ko-hero:current:<N>` (N ≥ 2) →
  `{ primitive:'ko-hero', target:'current', magnitude:N }`; bare `ko-hero:current`
  unchanged (magnitude-less → legacy `koHeroCurrentPlayer`); `ko-hero:current:1`
  REJECTED (→ `unresolvedMarkers`). The `@space` gate suffix is WP-489's (unchanged).
- **Card marker (Fight):** Whirlwind `ko-hero:current:2@rooftops+bridge`.
- **Magnitude-M KO rule (physical-count form — landed):** `M = descriptor.magnitude
  ?? 1`. Loop KO up to M of the current player's heroes using the PHYSICAL KO-able
  count `P` (`countKoableHeroes`, non-deduped) and the distinct options `O`
  (`buildKoEligibleTargets`), both recomputed fresh: **park** ONE
  `PendingKoHeroChoice{…, remaining: owed}` only when `P > owed && O ≥ 2` (a genuine
  choice of which to spare); otherwise the KO is **forced** (`P ≤ owed` → all die, or
  `O ≤ 1` → identical copies) → auto-KO the deterministic single target, decrement;
  `O === 0` → stop. **OMIT `remaining` when owed === 1** (absent ≡ 1) so the M=1 park
  is the exact `{ choiceType, playerID }` object the two `deepStrictEqual` shape tests
  pin. (Refined at execution from the drafted deduped-`O`-only rule so exactly-2-distinct
  auto-KOs both per AC-3; identical to the `O`-rule for M=1.)
- **Resolve move:** KO the pick, decrement front `remaining ?? 1`; auto-KO any now-forced
  remainder (`P ≤ owed || O ≤ 1`); `shift()` when it hits 0, else keep the decremented
  entry. Imports `buildKoEligibleTargets` + `countKoableHeroes` (exported from
  `villainEffects.execute.ts`); the forced-remainder KO uses this move's OWN
  `moveCardFromZone`+`koCard` (NOT the module-private `koSingleTarget`).
- **UIState:** `pendingKoHeroChoice.remaining` = Σ `entry.remaining ?? 1` over the queue.
- **CI ripple:** `pnpm -r build && pnpm ledger:villains` then `ledger:villains:check`.
  Provenance map UNCHANGED (`ko-hero` already WP-252/D-24023 — populates the new row).

## Guardrails
- game-engine Node built-ins only; handlers pure/deterministic (NO `ctx.random`);
  `for...of`, no `.reduce()`; `00.6` names. Markers authored in JSON, applied by the
  generator — NEVER hand-edit `core.json`; `git diff` shows ONLY the one Fight line.
- **M = 1 byte-identical** to WP-242 — the bare `ko-hero:current` / `koHeroCurrentPlayer`
  path (auto-1 / park-one; keyword reverse-map; narration) MUST be unchanged; only
  M ≥ 2 self-narrates (keyword-less). Do NOT double-log M=1.
- No new choice type, no new `G` field, no recursion into `performVillainReveal`, no
  cleanup override, no each-player `ko-hero` change, no fight/advance/escape change.
  Do NOT touch the WP-489 gate engine. Do NOT wire `ci.yml`. Do NOT edit arena-client.
- The block-all guards already freeze the board across the multi-pick — do NOT add new
  guards; the parked entry with `remaining` uses the existing `hasPendingKoHeroChoice`.

## Required `// why:` Comments
- Why `PendingKoHeroChoice.remaining?` is additive-optional (absent ≡ 1 → old entries
  byte-identical; append-only D-24034).
- Why the parker auto-KOs when distinct options `O ≤ 1` and parks only when `O ≥ 2`
  (a single distinct option is no choice; parking it would be a no-decision freeze).
- Why M ≥ 2 self-narrates: `descriptorKey` includes `magnitude`, so
  `{ ko-hero, current, ≥2 }` has NO `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR` entry →
  reverse-maps to `undefined` → the generic "Fight effect:" line does NOT fire; M=1
  keeps the keyword and MUST NOT self-narrate (avoid double-log).
- Why the resolve move auto-resolves the now-forced remainder (so a collapsed later
  step never leaves the player a single-option pick).
- Why the UIState `remaining` is a Σ over `entry.remaining ?? 1` (total KOs owed;
  keeps the WP-243 multi-entry projection while surfacing a single magnitude-N park).

## Files to Produce
- `types.ts` — `PendingKoHeroChoice.remaining?`.
- `villainAbility.setup.ts` — `ko-hero:current:<N>` grammar (+parse test).
- `villainEffects.execute.ts` — magnitude-M current KO loop + self-narration (+tests).
- `koHeroChoice.resolve.ts` — remaining decrement + forced-remainder auto-resolve (+test).
- `uiState.build.ts` — `remaining = Σ` (+test).
- `hollowEffect.test.ts` — Whirlwind no longer `unmarked-ability`.
- `villain-effect-markers.json` + `apply-effect-markers.mjs` — Whirlwind marker + grammar sync.
- `core.json` regenerated; `villain-mechanic-ledger.{json,csv}` regenerated.
- `DECISIONS.md` — land D-24298.

## After Completing
- [ ] `apply-effect-markers.mjs`; `git diff --stat data/cards/core.json` = one Fight line only.
- [ ] `pnpm -r build && pnpm ledger:villains` then `ledger:villains:check` exit 0.
- [ ] game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
      `finalStateHash`/sentinel re-pin ONLY if a committed fixture's villain deck
      *includes* `core/masters-of-evil` (verify: sentinel=`core/brotherhood`,
      PRE_WP080=`test/*`), so expect no re-pin.
- [ ] WP-242 / WP-243 suites green (M=1 identity + `remaining` projection).
- [ ] **D-24298 Active.** STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-527 Done.
- [ ] No file outside the allowlist (+ governance). Revert `lagn-v1.json` EOL churn.

## Common Failure Smells
- core.json shows > 1 changed line → a marker matched the wrong line or the generator
  grammar drifted from the engine parser.
- Whirlwind KOs on the wrong spaces → the `@rooftops+bridge` suffix or `CITY_SPACE_NAMES`
  (Rooftops must be index 2, Bridge index 4) is wrong — re-check WP-489's binding.
- M=1 KO logged twice (generic "Fight effect:" + a self-narrated line) → the magnitude-1
  path self-narrated; only M ≥ 2 may.
- A player with exactly 2 Heroes gets a 1-option prompt → the parker parked instead of
  auto-KOing when `O ≤ owed`; auto-KO the forced heroes, park only the free choice.
- WP-243 `remaining` test red → the projection was switched to a single entry's
  `remaining` instead of the Σ over the queue.
- Drift/primitives-count red → a primitive was added by mistake; the count stays 12
  (this WP adds a pending-type field + a grammar, no primitive).
