# EC-695 — `[keyword:Transform]` Runtime (Consume the Transform Side Deck) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-658-transform-keyword-runtime.md
**Layer:** Game Engine (`packages/game-engine/src/rules` + `src/hero` + `src/setup`) + card-data marker + coverage-ledger by-hook classifier

## Before Starting
- [ ] Baseline `origin/main` @ `b86a9e46` (WP-657 landed — `G.transformDeck` + the `isTransform` partition are on `main`).
- [ ] Resolve the OPEN RULES QUESTIONS from `wiki/transform.md` (the in-repo Transform ewiki page, PR #1855) + Jeff before writing the effect body. Record the answers in D-24469. (Resolved: swap = second-form replaces base in play; base → back to side deck; permanent deck upgrade; once-per-turn multi-copy deferred; exhaustion = soft no-op.)
- [ ] Confirm what `main` already added: `recruitMadeThisTurnAtLeast` (D-24354) is SHIPPED and marker-wired (`[keyword:recruit-threshold:N]`, #1865) — REUSE it, do not re-build the condition.
- [ ] `pnpm -r build` exits 0 (the ledger/effect-index scripts import `packages/*/dist`).

## Locked Values (do not re-derive)
- New keyword: `'transform'` → `HeroKeyword` union + `HERO_KEYWORDS` array + the drift tests (39 entries total; 25 `HERO_EFFECT_HANDLERS` handlers).
- New state field: `G.transformTargets: Record<CardExtId, CardExtId>` — copy-agnostic `{setAbbr}/{heroSlug}/{baseSlug}` → `{setAbbr}/{heroSlug}/{targetSlug}`; ALWAYS present (mirrors `transformDeck`); built by `buildTransformTargets` off the SAME `effectiveHeroDeckIds` as `buildTransformSideDeck`.
- Handler: `heroEffectTransform` — strip `#copy` → base key → `transformTargets` → first `{targetKey}#*` in `G.transformDeck`; move base `inPlay → transformDeck`; move target `transformDeck → inPlay`; apply target printed attack/recruit; log `applied`. Exhaustion (no matching copy) = log `blocked`, no throw. `transform` ∈ `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
- Support allowlist (Honest-Partial): `SUPPORTED_TRANSFORM_BASES = { 'wwhk/she-hulk/hurl-legal-objections' }` in `heroAbility.setup.ts`. The parser resolves `[keyword:Transform]` to a keyword+effect ONLY for allowlisted cards; all others keep an unresolved marker.
- Card marker: `[keyword:recruit-threshold:6]` appended to `wwhk/she-hulk/hurl-legal-objections` via `hero-ability-markers.json` (regen through `apply-hero-ability-markers.mjs`).
- Ledger by-hook: `transform` ∈ `BY_HOOK_KEYWORDS` (`hero-mechanic-ledger.mjs`) — executable only when THIS card's hook resolved it; else `unsupported`.
- Determinism re-pins (sanctioned, new-`G`-field cause): `PRE_WP080_HASH` `d5d807a9 → 36a82b21`; sentinel `finalStateHash` `e237a0e792…e28ac3 → e43da6ec58…dba2bd`.
- Reserved decision: **D-24469** (land Active at close). EC **EC-695**. WP **WP-658**.

## Guardrails
- **No unconditional swaps.** A held-back transform card (its condition unmodeled) must keep an honest `parse-unrecognized` marker — never fire. Turning ALL 15 transform heroes executable is a FAIL (a silent gameplay bug). Only She-Hulk ships.
- **Moves never throw.** Exhaustion + a missing target key are soft no-ops. Only `Game.setup()` may throw.
- **No registry in the handler** — the base→target link lives in `G.transformTargets` (built at setup).
- Coverage stays honest: the ledger flip is She-Hulk's `transform` row ONLY (`unsupported → executable`) + a new `recruit-threshold` `condition` row; the other 14 stay `unsupported`. `effect-index` + `card-mechanics` follow (they derive from the ledger / by-hook).
- Re-pin, don't mask: each hash re-pin carries a `// why:` naming the single cause (new `G.transformTargets` field). Any other hash move ⇒ STOP.
- `G` stays JSON-serializable (CardExtId strings only); no `.reduce()`.

## Required `// why:` Comments
- `heroKeywords.ts` (union + array `transform`): the swap mechanic; resolved only for `SUPPORTED_TRANSFORM_BASES`. D-24469.
- `types.ts` (`transformTargets`): what it maps, always-present, hash re-pin cause. D-24469.
- `buildHeroDeck.ts` (`buildTransformTargets`): base→target from the `transform` field; complete map; gate is at the parser. D-24469.
- `heroAbility.setup.ts` (`SUPPORTED_TRANSFORM_BASES` + the transform branch + the caller): Honest-Partial — resolve only allowlisted, mirror the investigate resolver. D-24469.
- `heroEffects.execute.ts` (`heroEffectTransform`): swap = permanent upgrade; apply printed icons; defer the second-form's own hooks; exhaustion soft-no-op. D-24469.
- `hero-mechanic-ledger.mjs` (`BY_HOOK_KEYWORDS` + `statusForMechanic` branch + `cardResolvedKeywords`): by-hook honesty vs the by-name over-claim. D-24469.
- `replay.execute.test.ts` (`PRE_WP080_HASH` re-pin): new `G` field; no behaviour change; `d5d807a9 → 36a82b21`.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `transform` keyword (union + array)
- `packages/game-engine/src/types.ts` — **modified** — `transformTargets` field
- `packages/game-engine/src/setup/buildHeroDeck.ts` — **modified** — `transform?` on `HeroCardEntry`; `buildTransformTargets`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — call + seed `transformTargets`; import
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `SUPPORTED_TRANSFORM_BASES`; `parseAbilityText` option + transform branch; caller passes `transformSupported`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectTransform` + registration; `transform` in `HANDLED_KEYWORDS`/`NO_MAGNITUDE_KEYWORDS`
- tests — **modified** — `heroKeywords.test.ts` (39), `heroAbility.setup.test.ts` (39 + resolution tests), `heroEffects.execute.test.ts` (25 handlers + transform behaviour), `buildHeroDeck.test.ts` (`buildTransformTargets`), `buildInitialGameState.shape.test.ts` (`transformTargets`), `replay.execute.test.ts` + `sentinel-core-doom-2p.replay.json` (re-pins)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — She-Hulk `[keyword:recruit-threshold:6]`
- `data/cards/wwhk.json` — **regenerated** — the applied marker (via `apply-hero-ability-markers.mjs`)
- `scripts/hero-mechanic-ledger.mjs` — **modified** — `BY_HOOK_KEYWORDS` (transform by-hook)
- `docs/ai/coverage/hero-mechanic-ledger.{csv,json}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **regenerated**
- Governance: `DECISIONS.md` (D-24469) + `WORK_INDEX.md` (WP-658) + `EC_INDEX.md` (this row) + `docs/ai/STATUS.md`

## After Completing
- [ ] `pnpm -r build` → 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` → 3083/3083 (the two re-pins land; +13 tests; no other hash moves)
- [ ] `pnpm cards:check` + `pnpm ledger:heroes:check` + `pnpm effect-index:check` + `pnpm mechanics:metadata:check` + `pnpm effect-index:test` all green
- [ ] `pnpm -r --no-bail test` whole-repo green
- [ ] Ledger: `wwhk/she-hulk,transform` = `executable` + a `recruit-threshold` `condition` row; the other 14 transform heroes = `unsupported`
- [ ] `git diff --name-only` = the file set above (+ regenerated artifacts) and nothing else (no `lagn-v1.json` line-ending churn — revert it)
- [ ] D-24469 landed Active; WORK_INDEX (WP-658) + STATUS updated
- [ ] **D-24026 operator-pending**: a live `play.legendary-arena.com` She-Hulk match — Hurl Legal Objections after ≥6 Recruit transforms into Hurl Trucks; under 6 it does not. Green tests + merge do NOT satisfy this.

## Execution Result (2026-09-07)
Executed off `origin/main` @ `b86a9e46`. `pnpm -r build` 0; engine suite **3083/3083** after the two sanctioned re-pins (+13 tests: transform handler behaviour, setup-parser resolution gating, `buildTransformTargets`, drift/count bumps); whole-repo green (server 1504, arena-client 1612, engine-runner 20, all 0-fail). `cards:check` / `ledger:heroes:check` / `effect-index:check` / `mechanics:metadata:check` / `effect-index:test` all green. Ledger net change = She-Hulk `transform` `unsupported → executable` + a new `recruit-threshold` `condition` row; the other 14 transform heroes stayed `unsupported` (the by-hook gate held). `lagn-v1.json` LF/CRLF build churn reverted. **D-24026 operator-pending** (post-deploy live verify). Pending commit/PR.
