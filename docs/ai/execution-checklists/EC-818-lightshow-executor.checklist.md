# EC-818 — Lightshow executor (Execution Checklist)

> **Renumbered 2026-09-27** from WP-777 / EC-814 / D-24616 (and the cited D-24615 → D-24622): those numbers were claimed first by the merged split-face discard fidelity packet (#2443 / #2453 / #2461).

**Source:** docs/ai/work-packets/WP-781-lightshow-executor.md
**Layer:** Game Engine + App arena-client

## Before Starting
- [ ] Baseline `origin/main` includes D-24622 (#2444) and the reserve commit (#2445). If #2444 is not merged, STOP.
- [ ] `pnpm install` and `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail.
- [ ] Anchors re-read (all `~`): `UITurnEconomyState` `uiState.types.ts:~765`; D-24016 / D-24489 flat suppression `setup:~1815-1864`; ledger `sunlightEffects` collection `:~590`; D-24622 `LIGHTSHOW_GATE_PATTERN`; Excessive Violence fusion `setup:~3399-3430` / `:~597` / `:~3607-3636`; `excessiveViolenceEffects?` `heroAbility.types.ts:~207`; `fireExcessiveViolencePlays` `execute.ts:~5620`; `executeSingleEffect` `:~5877`; `healWounds.ts:81-193`; `carryConversionFlag` `economy.logic.ts:505-525`; `HeroCountSource` `heroCountSource.ts:36-66`; `excessiveViolenceAvailable` `uiState.types.ts:~781` / build `:~1027` / filter `:~452`.
- [ ] Re-read `HERO_KEYWORDS` and the handler counts now; each moves by exactly +1.

## Locked Values (do not re-derive)
- Keyword `'lightshow'`: handled, no-magnitude; its on-play handler is a no-op.
- Count source `'lightshow-played-this-turn'`: self-inclusive, duplicates count, resolved at use time.
- `LIGHTSHOW_MIN_CARDS_PLAYED = 2`.
- Move `'useLightshow'`, args `{ cardId }`, registered `{ move, client: false }`. NOT added to `CORE_MOVE_NAMES`. No `resolve…` prefix.
- Flag `TurnEconomy.lightshowUsedThisTurn?: boolean`: lazily created, reset by `resetTurnEconomy()`, listed in `carryConversionFlag`.
- Projection `UITurnEconomyState.lightshowOptions?: CardExtId[]`: present iff non-empty; active player only (copied array); `REDACTED_ECONOMY` for everyone else.
- `hero/lightshow.logic.ts` holds only `LIGHTSHOW_MIN_CARDS_PLAYED` + `countLightshowCardsPlayedThisTurn` (no `moves/` import — cycle). `lightshowOptions` is exported from `moves/useLightshow.ts` and copies the healWounds block-all pending cluster inline.
- Bot score `SCORE_USE_LIGHTSHOW_BASE = 150` minus the option index (below `SCORE_PLAY_CARD_BASE` 200); `getLegalMoves` emits in `inPlay` order.
- Fusion strips the inner `[keyword:Lightshow]` token before `parseAbilityText`; flat-icon suppression on scaled lines is inherited from D-24016 / D-24489 (test-pinned).
- Ledger: `lightshow` executable only when the hook carries it AND `lightshowEffects` is non-empty.
- Test id `play-action-lightshow`; label `Lightshow: <card name>`.
- Card Map (WP §Card Map), verbatim:
  - flat: Blazing Flare `recruit 2`, Twin Blast `attack 3`, Dazzling Glamour `attack 2`, Bend Light `recruit 2`, Northern Lights `draw 1` (marker `[keyword:draw:1]`), Unexpected Explosion = the parse-translated `reveal` descriptor from marker `[keyword:reveal-ko]` (never a hand-built `reveal-ko` type)
  - scaled: Mach 10 `attack-per-count 2`, Light a Spark `recruit-per-count 1`, Blasting Fireworks `attack-per-count 1`, Prismatic Cascade `recruit-per-count 1` + `attack-per-count 1`
- `LIGHTSHOW_UNMODELED_LINES` (4): `xmen/dazzler/convert-sound-to-light`, `xmen/dazzler/citywide-mega-concert`, `xmen/dazzler/inspire-the-world`, `xmen/havok/blinding-burst`. Each emits `keywords: ['lightshow']`, `effects: []` (NO wrapper), `unresolvedMarkers: ['lightshow']`, so it counts, is never an option, and records a runtime hollow.
- Markers on exactly 6 lines: Northern Lights, Unexpected Explosion, Mach 10, Light a Spark, Blasting Fireworks, Prismatic Cascade.
- Log: "Player N used Lightshow from <cardDisplayData name>." No ability text.

## Guardrails
- A Lightshow ability never fires on play. Only `useLightshow` fires one, at most once per turn.
- One legality predicate: `lightshowOptions(G, playerId)` feeds the move, the projection and `getLegalMoves`. No second copy of the Lightshow rule anywhere.
- Pass the full move `context` to `executeSingleEffect` so any reshuffle goes through `ctx.random`.
- Unmodelled cards count toward the threshold but are never options, and keep a `lightshow` unresolved marker.
- A count-scaled line never also grants its flat icon.
- No new top-level `G` field. No new `NotableGameEventType`. No `apps/server` edit.
- Moves never throw; validate, gate, mutate, return void. No `.reduce()` with branching.

## Required `// why:` Comments
- `LIGHTSHOW_MIN_CARDS_PLAYED`: rule citation (v23 ~L1616).
- `buildLightshowFusion`: the Excessive Violence precedent; a Lightshow ability never fires on play.
- `LIGHTSHOW_UNMODELED_LINES`: why each entry is unmodelled, and why they still count.
- The count source: self-inclusive (the card with the ability is itself a Lightshow card played this turn); resolved at use time.
- `carryConversionFlag`: a rebuild must not drop `lightshowUsedThisTurn`.
- `useLightshow`: optional and any-time-in-`main`, so scalers can grow; the once-per-turn lock.
- The projection's owner-only disposition.
- `ai.competent.ts`: the score sits below every card play so scalers grow; index tie-break for determinism.

## Files to Produce
- `packages/game-engine/src/hero/lightshow.logic.ts` + test — **new**
- `packages/game-engine/src/moves/useLightshow.ts` + test — **new**
- `setup/heroAbility.setup.ts`, `hero/lightshowGateIconSuppression.test.ts`, `rules/heroAbility.types.ts` — **modified**
- `rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts`, `hero/heroEffects.execute.ts` (+ test) — **modified**
- `rules/heroCountSource.ts`, `hero/heroCountSource.resolve.ts` (+ test) — **modified**
- `economy/economy.types.ts`, `economy/economy.logic.ts` (+ test) — **modified**
- `game.ts`, `game.test.ts`, `replay/replay.execute.ts`, `index.ts` — **modified** (01.5 wiring)
- `simulation/ai.legalMoves.ts` (+ test), `simulation.runner.ts`, `par.aggregator.ts`, `ai.competent.ts` (+ test), `simulation.moveDispatch.drift.test.ts` — **modified**
- `ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts` — **modified**
- `apps/arena-client/src/components/play/TurnActionBar.vue` (+ test), `uiMoveName.types.ts`, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — **modified**
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/xmen.json` + derived feeds + `sim:coverage` baseline + dashboard `useInPlayCoverage.test.ts` pin — **regenerated / re-pinned**
- `docs/ai/DECISIONS.md` (D-24621), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0; markers idempotent.
- [ ] All six card/feed gates → 0; `lightshow` runtime hollows remain only for the 4 unmodelled cards.
- [ ] Engine suite passes; `pnpm -r --no-bail test` → 0 fail. Oracles unchanged, or an xmen-board oracle re-pinned citing D-24621 (a non-xmen oracle change = STOP).
- [ ] `economy.lightshowOptions` visible in the Play Diagnostics `uiStateSnapshot` for the active seat.
- [ ] D-24621 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology (`EC-818:` then `SPEC:`).
- [ ] Live-verify (D-24026) post-deploy.

## Common Failure Smells
- Lightshow resource appears on play → the fused line's inner effects were also emitted at top level, or the no-op handler grants.
- The button shows but the move does nothing → projection and move use different predicates.
- The second Lightshow in a turn works → the flag was dropped by a TurnEconomy rebuild (`carryConversionFlag`).
- Mach 10 grants a flat +2 plus the scaled amount → the flat icon wasn't suppressed on the scaled line.
- The bot FAULTs on `useLightshow` → `getLegalMoves` emitted an option the move rejects.
- The sim drift test fails → one of the two simulation move maps is missing the entry.
- The dashboard `totalObs` test fails → re-pin after regenerating the feeds.
