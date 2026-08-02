# EC-524 — Core Villain-Effect Vocabulary, Tier B (Named City Spaces)

**Source:** docs/ai/work-packets/WP-489-villain-effect-vocab-tier-b-city-spaces.md
**Layer:** Game Engine (constant + threading + handlers + parser) + Registry card-data
markers — downward edge only.

## Before Starting
- [ ] On `origin/main` (post-reserve; **after WP-485/D-24290 has merged** — Tier B
      extends Tier A's files), worktree clean; game-engine + card-data build/test green.
- [ ] Confirm the two abilities are still `unmarked-ability` today:
      `radiation/abomination` "Fight: If you fight Abomination on the Streets or Bridge,
      rescue three Bystanders." and `spider-foes/the-lizard` "Fight: If you fight the
      Lizard in the Sewers, each other player gains a Wound." (`data/cards/core.json`).
- [ ] Confirm `G.city` is a 5-tuple, index 0 = entry / index 4 = escape
      (`board/city.types.ts:21-29`); the fought `cityIndex` is a `fightVillain` arg
      (`moves/fightVillain.ts:51-80`) NOT yet passed to `executeVillainAbilities`
      (`villain/villainEffects.execute.ts:93-105`); `shuffleContext?` is the
      trailing-optional threading precedent (WP-478).
- [ ] **Operator has confirmed the FULL index→name binding against the authoritative
      rulebook** (WP Verification §1) — ENDPOINTS included (which named space is index 0
      = entry, which is index 4 = escape edge) plus the middle order. Proposed:
      `['sewers','bank','rooftops','streets','bridge']` (0-4). `keywords-full.json` is
      corroborating-only (~20% unreliable); do NOT lock the constant on it. A reversed
      endpoint binding fires both cards on the wrong spaces with green tests.
- [ ] **Scaffold:** add the `each-other` target value + `requireCitySpaces` field and run
      `pnpm --filter @legendary-arena/game-engine test`. Expect **NO pre-existing break**
      (no primitive added → the primitives-count drift stays 12; the round-trip is over the
      10 legacy keywords, unchanged; the inline `target` union has no canonical drift array;
      the two out-of-allowlist descriptor tests use `target:'each'`, unaffected by additive
      widening; `cityIndex?` trailing-optional breaks no caller). "Extend the drift/
      round-trip test" therefore means **ADD positive coverage** for the new `target` value
      + the `requireCitySpaces` field — not fix a break. Run it anyway (cheap; empirical, not
      reasoned).
- [ ] **Exact target file set (any outside = FAIL, STOP; governance close-out excepted):**
      `board/citySpaceNames.ts`(+test), `rules/villainAbility.types.ts`(+test),
      `setup/villainAbility.setup.ts`(+test), `villain/villainEffects.execute.ts`(+test),
      `moves/fightVillain.ts`(+test if threading assertion), `villainDeck/villainDeck.reveal.ts`,
      `diagnostics/hollowEffect.test.ts`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
      `scripts/convert-cards/apply-effect-markers.mjs`, `data/cards/core.json`(generated),
      `docs/ai/coverage/villain-mechanic-ledger.json`+`.csv`(regenerated, CI-gated),
      `scripts/coverage/mechanic-provenance.json`, `docs/ai/DECISIONS.md`
      **(+ governance close-out: `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
      `STATUS.md`, `NUMBER-LEDGER.md`).**

## Locked Values (do not re-derive)
- **`CITY_SPACE_NAMES` = `['sewers','bank','rooftops','streets','bridge']`** (index
  0=entry=Sewers … 4=escape=Bridge) — **proposed, pending the Before-Starting
  operator-confirm gate; do not treat as final until confirmed.** Pure engine constant —
  **NOT a `G` field.**
- **NO new `VillainEffectPrimitive`.** Reuse `gain-wound` + `capture-bystander`.
  Additive descriptor changes ONLY: `requireCitySpaces?: readonly CitySpaceName[]`;
  `target` union += `'each-other'`; `capture-bystander` reads existing `magnitude?` as
  a rescue count (default 1). No field removed/re-typed.
- **Marker grammar:** universal gate suffix `@<space>[+<space>…]` (split FIRST, lifted
  to `requireCitySpaces`; unknown space → `unresolvedMarkers`, never silent-accept);
  `gain-wound:each-other[:<N>]`; `capture-bystander:<N>`.
- **Card markers (Fight):** Abomination `capture-bystander:3@streets+bridge`; the Lizard
  `gain-wound:each-other@sewers`.
- **Handler threading:** `cityIndex?: number` trailing-optional through
  `executeVillainAbilities` + `VillainEffectHandler` (mirror `shuffleContext?`);
  `undefined` at the reveal `onAmbush`/`onEscape` fire sites; gate FAILS CLOSED on
  `undefined`.
- **Gate location:** in the effect-application path BEFORE handler dispatch — if
  `requireCitySpaces` set and `citySpaceNameForIndex(cityIndex)` not in the list → skip
  + self-narrate "no effect"; else dispatch normally.
- **`each-other`:** iterate `Object.keys(G.playerZones).sort()` skipping
  `currentPlayer` (mirror WP-202 each-player). Wounds supply-bounded.
- Vocabulary hand-synced in `apply-effect-markers.mjs` (`VILLAIN_EFFECT_PRIMITIVES`
  copy unchanged — no new primitive — but `isValidParameterizedEffectToken` extended
  for the `@space` suffix + the two grammars).
- **CI ripple:** `pnpm -r build && pnpm ledger:villains` then `ledger:villains:check`;
  add the two `wp:WP-489 / decision:D-24295` provenance entries.

## Guardrails
- game-engine Node built-ins only; `citySpaceNames.ts` no `boardgame.io`; handlers
  pure/deterministic; `for...of`, no `.reduce()`; `00.6` names.
- Markers authored in `villain-effect-markers.json`, applied by the generator — NEVER
  hand-edit `core.json`; `git diff` shows ONLY the two Fight lines.
- **No new `G` field**, no city-space state mutation, no `pending*Choices`, no recursion
  into `performVillainReveal`, no cleanup override (Tiers C-E). Do NOT touch fight/
  advance/escape movement logic. Do NOT mark Whirlwind (Tier D). Do NOT wire `ci.yml`.
- Existing `capture-bystander` (un-counted) + `gain-wound` current/each branches stay
  behavior-identical; the 12 pre-existing handlers only widen their signature.

## Required `// why:` Comments
- Why `CITY_SPACE_NAMES` is a pure constant, not a `G` field (static, derivable). NOTE the
  markers still touch hashed `G` via `villainAbilityHooks` — re-pin trigger is fixture
  villain-deck composition, not the constant.
- Why the gate fails closed on `undefined` cityIndex (non-fight fire sites / unknown
  space must not fire a location-gated effect).
- Why `each-other` skips `currentPlayer` (printed "each OTHER player").
- Why each gated effect is keyword-less + self-narrates (like `reveal-or-wound`).
- Why the **counted** `capture-bystander:3` MUST self-narrate: `descriptorKey()` includes
  `magnitude`, so `{capture-bystander, magnitude:3}` has NO `DESCRIPTOR_TO_LEGACY_VILLAIN_KEYWORD`
  entry → `descriptorToLegacyKeyword` returns `undefined` → the generic `fightVillain`
  "Fight effect:" line does NOT fire, AND `fightVillain`'s `bystandersRescued` count is
  snapshotted BEFORE effects run so it won't count these. The handler narrates the actual
  count itself. (The un-counted `capture-bystander` — Green Goblin — keeps its legacy
  reverse-map + generic narration; narrate ONLY the counted variant to avoid double-logging.)

## Files to Produce
- `citySpaceNames.ts` (+test) — constant + `citySpaceNameForIndex` + `CitySpaceName`.
- `villainAbility.types.ts` — `requireCitySpaces` + `each-other` target (+drift test).
- `villainAbility.setup.ts` — `@space` gate split + two grammars (+parse test).
- `villainEffects.execute.ts` — cityIndex threading + universal gate + `each-other` +
  counted `capture-bystander` (+handler tests).
- `fightVillain.ts` — pass `cityIndex` into `executeVillainAbilities`.
- `villainDeck.reveal.ts` — `undefined` at the two fire sites.
- `hollowEffect.test.ts` — Abomination + the Lizard no longer `unmarked-ability`.
- `villain-effect-markers.json` + `apply-effect-markers.mjs` — tokens + grammar sync.
- `core.json` regenerated; `villain-mechanic-ledger.{json,csv}` regenerated;
  `mechanic-provenance.json` — 2 new WP-489/D-24295 entries.
- `DECISIONS.md` — land D-24295.

## After Completing
- [ ] `apply-effect-markers.mjs`; `git diff --stat data/cards/core.json` = two Fight
      lines only.
- [ ] `pnpm -r build && pnpm ledger:villains` then `ledger:villains:check` exit 0.
- [ ] game-engine test + `pnpm -r build` + `pnpm -r --no-bail test` exit 0.
      `finalStateHash`/sentinel re-pin ONLY if a committed fixture's villain deck
      *includes* Abomination or the Lizard (`core/radiation`/`core/spider-foes`) — the
      markers land in the hashed `villainAbilityHooks`, so the fight need not occur; none do
      today (verified: sentinel=`core/brotherhood`, PRE_WP080=`test/*`), so expect no re-pin.
- [ ] Whirlwind still `unmarked-ability` (deferred, not dropped).
- [ ] **D-24295 Active.** STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-524 Done.
- [ ] No file outside the allowlist (+ governance). Revert lagn-v1.json EOL churn.

## Common Failure Smells
- core.json shows >2 changed lines → a marker matched the wrong line or the generator
  vocabulary/grammar drifted from the engine.
- Abomination rescues on the wrong spaces → `CITY_SPACE_NAMES` order wrong (Streets
  must be index 3) — re-check the operator-confirmed binding.
- The Lizard wounds the current player → `each-other` didn't skip `currentPlayer`.
- Gate never fires / always fires → cityIndex not threaded from `fightVillain`, or the
  gate reads a nulled slot instead of the passed index.
- Drift test red → `target` union extended without the drift array/round-trip (or vice
  versa). (No primitives-count change — the count stays 12; a red count means a primitive
  was added by mistake.)
- Abomination's rescue logged twice (generic "Fight effect:" + the handler line) → the
  counted `capture-bystander:3` was left to reverse-map; it must self-narrate ONLY, because
  its magnitude-bearing descriptor has no legacy keyword (see Required `// why:`).
- Sentinel/PRE_WP080 drift on a green build → a committed fixture's villain deck includes
  Abomination or the Lizard; re-pin per the After-Completing note (not expected today).
