# EC-444 — Hero-Play Synergy-Effect Count → UIState (Execution Checklist)

**Source:** docs/ai/work-packets/WP-409-hero-play-synergy-effect-count-signal.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] `applyCardPlay` (coreMoves.impl.ts) calls `executeHeroEffects` as its final effect step; both `playCard` + `playFromUndercover` route through it.
- [ ] `executeHeroEffects` currently returns `void`; the villain `VillainEffectResult[]` accumulator is the pattern to mirror.
- [ ] `game.ts` play-phase `onBegin` resets the per-turn transient flags (`hasHealedThisTurn` etc.).
- [ ] `hashGameState.ts` excludes `messages` + `logMeta` via a rest-destructure (D-24081).
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0; `pnpm --filter arena-client typecheck` exits 0.
- [ ] EXACT target file set = `## Files to Produce` below; any file outside it is a FAIL (surface as a blocker, do not improvise).

## Locked Values (do not re-derive)
- Transient field: `G.lastPlayEffectsFired?: number` (optional on `LegendaryGameState`).
- Projected field: `UIState.game.lastPlayEffectsFired: number` (public — NO `uiState.filter.ts` redaction).
- Reset value: `0`, in the play-phase `onBegin` hook.
- Return change: `executeHeroEffects(...) : void → number`.
- Count = effects that FIRED: each `executeSingleEffect` that reached `HERO_EFFECT_HANDLERS` + each top-level `interpretHeroPrimitiveEffect` that ran. Condition-gated skips + safe `MVP_KEYWORDS`/magnitude skips NOT counted. No hooks / all conditions fail ⇒ 0.
- Reserved decision: **D-24221** (land Active at close).

## Guardrails
- Observability-only: NOTHING in any rule/move/phase/endgame reads `G.lastPlayEffectsFired`. If you find yourself reading it for a decision, STOP — that is a gameplay change, out of scope.
- Hash exclusion is mandatory: add `lastPlayEffectsFired` to the `hashGameState.ts` exclusion so every recorded sentinel/golden `finalStateHash` stays byte-unchanged. A shifted sentinel hash = STOP and investigate (do NOT re-baseline to make it pass).
- Dual-oracle hazard: verify the whole-`G` `computeStateHash` / `PRE_WP080_HASH` gate — matched-exclusion or a deliberate reasoned re-pin, never a silent shift.
- No `.reduce()` in the tally — explicit `for`/`for...of` counter.
- No new `NotableGameEvent` variant; no `notableEvents` / `uiState.filter.ts` change; no gameplay/cascade change.
- Required-field add on `UIState.game` breaks arena-client `vue-tsc` — backfill the client UIState fixtures in the SAME session (fixtures only, no runtime/audio).

## Required `// why:` Comments
- `heroEffects.execute.ts` (the count): observability signal for the future combo cue; effects-fired (not a cascade); condition/safe skips excluded.
- `game.ts` (`onBegin` reset): per-turn transient; a fresh turn starts at 0 before any play.
- `hashGameState.ts` (exclusion): observability-only, D-24221; keeps recorded `finalStateHash` byte-unchanged.

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified** — `lastPlayEffectsFired?: number`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — tally + `void → number`
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — **modified** — top-level primitive fired-signal
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — capture return → `G.lastPlayEffectsFired`
- `packages/game-engine/src/game.ts` — **modified** — reset in play-phase `onBegin`
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `game.lastPlayEffectsFired`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — project `G.lastPlayEffectsFired ?? 0`
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — **modified** — hash exclusion (D-24221)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — count assertions (N / gated-0 / no-hook-0 / safe-skip-not-counted)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — pin the new field
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified (if a game-block test exists)** — projection assertion
- `apps/arena-client/**` UIState test fixtures — **modified** — backfill `game.lastPlayEffectsFired` (fixtures only)

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; every recorded sentinel/golden `finalStateHash` unchanged (or the whole-`G` oracle deliberately re-pinned with the reason recorded).
- [ ] `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` passes.
- [ ] `git diff --name-only` = the allowlist only (+ any recorded `01.5` wiring file).
- [ ] `docs/ai/STATUS.md` — "No user-observable change — infrastructure only" (D-24026 inversion; no consumer yet).
- [ ] `docs/ai/DECISIONS.md` — land D-24221 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-409 checked off with today's date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-409 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Sentinel `finalStateHash` shifted ⇒ the field was NOT added to the `hashGameState.ts` exclusion (or the whole-`G` oracle needs handling) — investigate, do not re-baseline.
- `arena-client typecheck` red on a missing `lastPlayEffectsFired` ⇒ a UIState fixture was not backfilled.
- Count higher than expected in a test ⇒ counting condition-gated or safe-skipped effects that did not actually fire.
