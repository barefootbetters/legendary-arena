# EC-760 — X-Gene discard-pile class-presence condition (Execution Checklist)

**Source:** docs/ai/work-packets/WP-723-x-gene-instinct-discard-condition.md
**Layer:** Game Engine (setup parser + condition) + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `df9291f0` (or later); working tree clean, synced. Reserve line WP-723/EC-760/D-24544 already on `main` (PR #2207).
- [ ] WP-659 / D-24470 landed: `reveal-from-hand` `lineHas*` suppression of a co-located `[hc:X]`/`[team:X]` at Step 1a/1b (`setup/heroAbility.setup.ts` ~660–706 flags, ~762 consult).
- [ ] WP-667 / D-24480 landed: `optional-ko-hand-discard` keyword + `heroEffectOptionalKoHandDiscard` (parks `PendingOptionalKoReward`, `koZones ['hand','discard']`, no reward) + `[keyword:optional-ko-hand-discard]` in `VALID_TOKEN_PATTERN`.
- [ ] WP-179 / D-24074 landed: printed class on `G.cardTraits[id].heroClass`/`.heroClass2`; `cardHasClassWhenPlayed` (`hero/sizeChanging.logic.ts`); hand-half printed-class read in `countDistinctHeroClassesYouHave` (`hero/heroConditions.evaluate.ts`).
- [ ] Substrate: `parseAbilityText` options + per-card allowlist plumbing (`SUPPORTED_TRANSFORM_BASES`/`TELEPORT_ON_DISCARD_CARDS`, threaded ~2809–2824); hook-level gate `evaluateAllConditions` at `executeHeroEffects` ~687; `HeroCondition = { type: string; value: string }` (bare string — no union/array).
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/xmen.json` and derived feeds). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New condition type string: `'heroClassInDiscardPile'` (bare-string `HeroCondition` — **NO** union/array/drift edit).
- Condition value = the normalized class from the co-located `[hc:X]` token (`normalizeTraitSlug`) — **never** a hardcoded `'instinct'`.
- Discard scan reads **printed** class only: `G.cardTraits[id].heroClass` / `.heroClass2` over `G.playerZones[playerID].discard` (no Size-Changing grants — in-play-only).
- Allowlist `X_GENE_CARDS` (canonical `{setAbbr}/{heroSlug}/{cardSlug}`): `xmen/x-23/adamantium-foot-claws`, `xmen/x-23/bioengineered-assassin`. **heir-to-wolverine is NOT in it.**
- Apply rows: `adamantium-foot-claws` idx **0** → `[keyword:draw:1]`; `bioengineered-assassin` idx **1** → `[keyword:optional-ko-hand-discard]`.
- Deferred: `heir-to-wolverine` idx **1** (count-scaled "Berserk that many times").
- Drift counts UNCHANGED: `HERO_KEYWORDS` **61**, `HERO_EFFECT_HANDLERS`/`HANDLED_KEYWORDS` **45**. X-Gene is NOT a keyword.

## Guardrails
- X-Gene is a parser directive + a new `HeroCondition` — **NOT** a `HeroKeyword`. Do not touch `heroKeywords.ts`, `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`, `MVP_KEYWORDS`, or their drift counts.
- Recognition is **per-card allowlisted** via `xGeneSupported` (threaded from `buildHeroAbilityHooks` like transform/teleport). For a non-allowlisted card, `[keyword:X-Gene]` MUST remain `unresolvedMarkers` and `[hc:X]` stays a `heroClassMatch` gate. Global recognition (e.g. adding `x-gene` to `RECOGNIZED_NON_KEYWORD_MARKERS`) is a FAIL — it silences heir-to-wolverine's honest hollow.
- Step 1a suppression fires only when `lineHasXGene` (an `X_GENE_MARKER_PATTERN` hit AND `xGeneSupported`); it drops the leading `[hc:X]` `heroClassMatch` and pushes `{ type:'heroClassInDiscardPile', value:<class> }` instead. Do not suppress `[hc:X]` on any other line.
- The condition **reads** `G` and never mutates it. No `.reduce()` — explicit `for...of` over discard. Effects/parser never throw.
- Marker edits touch only `abilities[i]` text of the two resolved cards. `VALID_TOKEN_PATTERN` is NOT edited (draw:N + optional-ko-hand-discard already admitted; `[keyword:X-Gene]` is printed in source, not apply-written).
- After the card-data change, REGEN + commit all four derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF build churn before commit.
- **Sim-outcome cascade:** marking the two cards changes what the balance sweep does, so `runtime-observed-hollows.json` regenerates; the two cards' X-Gene hollow entries clear, heir-to-wolverine's stays. Sentinel replay is core-only, X-23 non-core → `finalStateHash` unchanged; if it moves, investigate WHY — never hand-edit.

## Required `// why:` Comments
- `heroClassInDiscardPile` evaluator case: D-24544 — X-Gene glossary = "a [class] card in your discard pile"; printed class only (Size-Changing is in-play-only).
- Step 1a suppression branch: D-24544 — X-Gene reinterprets the co-located `[hc:X]` as the discard-condition class, NOT a play-this-turn `heroClassMatch` (the reveal-from-hand / D-24470 precedent).
- `X_GENE_CARDS` allowlist: D-24544 — per-card recognition; heir-to-wolverine stays an honest hollow (count-scaled Berserk unmodeled).

## Files to Produce
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — `heroClassInDiscardPile` case + discard-scan helper + `describeFailedCondition` wording
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — new-condition tests
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `X_GENE_CARDS`, `xGeneSupported`, `X_GENE_MARKER_PATTERN`, `lineHasXGene`, Step 1a suppression + injection, Step 2 consume branch, `buildHeroAbilityHooks` threading
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — parser tests (suppression / injection / allowlist gating / heir-to-wolverine hollow); NO drift-count change
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — end-to-end behavior tests for the two cards; NO handler-count change
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 2 apply rows + 1 `_deferred` row
- `data/cards/xmen.json` — **modified (regenerated)** — 2 appended trailing markers
- derived feeds `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (new condition + parser + behavior tests; drift counts unchanged 61 / 45)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); all five card/feed `:check` gates 0
- [ ] `grep -n "heir-to-wolverine" docs/ai/coverage/runtime-observed-hollows.json` → still present (honest hollow); the two resolved cards `draw`/`optional-ko-hand-discard` `executable` in `hero-mechanic-ledger.csv`
- [ ] Live-on-surface verification — REQUIRED post-merge (surface = `play.legendary-arena.com`, D-24026): Adamantium Foot Claws / Bioengineered Assassin with an Instinct card in discard fires the effect
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24544 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-723 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- Foot Claws fires on "another Instinct Hero this turn" → the suppression didn't fire; the parser still emitted `heroClassMatch` instead of `heroClassInDiscardPile`.
- heir-to-wolverine's X-Gene stopped hollowing → recognition leaked global (must be `X_GENE_CARDS`-gated); it now silently does the wrong thing.
- Drift test red on `HERO_KEYWORDS`/`HERO_EFFECT_HANDLERS` → X-Gene was wrongly added as a keyword; it is a condition + parser directive only.
- Size-Changing card in discard counted → the scan must read printed `heroClass`/`heroClass2` only, not in-play grants.
- `:check` gate red → a derived feed wasn't regenerated after the marker edit (regen ALL four).
