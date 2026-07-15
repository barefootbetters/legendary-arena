# EC-409 — Wound "Healing" Client Affordance (Execution Checklist)

**Source:** docs/ai/work-packets/WP-380-wound-healing-client-affordance.md
**Layer:** Cross-cutting — Game Engine (UIState projection) + arena-client

## Before Starting
- [ ] Baseline: `origin/main` @ `4edd95a1` (or later); working tree clean, synced.
- [ ] WP-379 landed: `game.ts` registers `healWounds` (no args); `types.ts` has `hasActedThisTurn?` / `hasHealedThisTurn?`; `pilesInit.ts` exports `WOUND_EXT_ID = 'pile-wound'`.
- [ ] `UIState.game` has `activePlayerId` + `currentStage`; `UIPlayerState.handCards?` carries the viewer hand; `useTurnActions.ts` owns the `GatingResult` predicates; `TurnActionBar.vue` renders the 3-step panel; `uiMoveName.types.ts` defines `UiMoveName`.
- [ ] `pnpm -r build` exits 0; `game-engine` test + `arena-client` test + `arena-client` typecheck all pass.
- [ ] Scope lock — EXACT target files = the `Files to Produce` list below (`uiState.filter.ts` and `PlayMobile.vue` only if genuinely needed). Anything outside is a FAIL; surface it as a blocker.
- [ ] **Engine-first order:** land the engine projection commit and `pnpm --filter @legendary-arena/game-engine build` BEFORE the client typechecks against the new `dist` (arena-client reads engine built dist, not src).

## Locked Values (do not re-derive)
- Move name: `'healWounds'`; dispatch `submitMove('healWounds', {})` (empty payload — the move takes no args).
- Client Wound ext_id (drift-tested vs engine): `'pile-wound'`.
- Stage gate value: `'main'`.
- New `UIState.game` fields: `hasActedThisTurn: boolean`, `hasHealedThisTurn: boolean` (public, `?? false` coercion).
- `GatingResult` shape: `{ allowed: boolean; reason: string | null }`.
- `canHealWounds` precedence: turn → `main` stage → block-all pending → wound-in-hand → not-acted → not-healed → allowed.

## Guardrails
- Projection is READ-ONLY: no `G`/`ctx` mutation, no `G.messages` append; byte-identical output for identical inputs.
- `UIState.game.hasActedThisTurn`/`hasHealedThisTurn` are PUBLIC — do NOT redact per-player in `uiState.filter.ts`.
- NO new runtime `@legendary-arena/game-engine` import in any component/page — only the `*.test.ts` drift test may import the engine (for `WOUND_EXT_ID`). The Wound literal lives in exactly one client file (`woundIdentity.ts`).
- NO competitive-hash impact: UIState is not part of `computeStateHash` — the sentinel fixture + `PRE_WP080_HASH` must stay UNCHANGED. If either shifts, STOP and investigate (something touched `G`, not just the projection).
- `canHealWounds()` returns a full-sentence `reason` on every disabled rung — never a bare boolean; reuse the existing tooltip-precedence idiom.
- Do NOT touch the `healWounds` move body, the AI/sim surface, or emit a `notableEvent`.
- arena-client tests use `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.

## Required `// why:` Comments
- `uiState.build.ts` flag population: coerce optional G flags to a definite boolean projection.
- `uiState.types.drift.test.ts` pin: type-vs-builder divergence is drift.
- `uiMoveName.types.ts` `'healWounds'`: WP-380 / D-24181 surfaces the WP-379 move.
- `TurnActionBar.vue` `onHealWounds`: empty payload — the move takes no args.
- `woundIdentity.ts` / its drift test: components may not import engine runtime code; the literal is mirrored + drift-guarded.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — 2 `UIState.game` booleans
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate (`?? false`)
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified (conditional)** — only if `game` is reconstructed
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — pin the 2 fields
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — projection mirror assertion
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — add `'healWounds'`
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — `canHealWounds()` + 3 params
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified** — `canHealWounds` cases
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — props + button + handler
- `apps/arena-client/src/components/play/TurnActionBar.test.ts` — **modified** — render/disabled/click
- `apps/arena-client/src/components/play/woundIdentity.ts` — **new** — client Wound constant + `handHasWound`
- `apps/arena-client/src/components/play/woundIdentity.test.ts` — **new** — drift test vs engine `WOUND_EXT_ID`
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — derive + drill the 3 values
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — derive + drill the 3 values

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes — sentinel + `PRE_WP080_HASH` UNCHANGED (no re-pin)
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0
- [ ] `pnpm --filter arena-client test` passes
- [ ] `Select-String` gate: no runtime engine import in components/pages (only the drift `*.test.ts`)
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): a real match, Heal Wounds enabled → click → Wounds KO'd → button + fight/recruit disable with tooltips
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24181 (Active, post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-380 checked off with date
- [ ] `git diff --name-only` shows only the allowlist

## Common Failure Smells
- Sentinel / `PRE_WP080_HASH` shifted → something mutated `G` (not just the projection) — the projection must be read-only.
- `vue-tsc` red but `test` green → SFC type error not caught by tsx/esbuild; the `typecheck` gate is the only one that catches it.
- Button clickable after acting/healing → `canHealWounds` reads the wrong projected flag, or the pages didn't drill `hasActedThisTurn`/`hasHealedThisTurn`.
- Wound never detected in hand → the client literal drifted from `WOUND_EXT_ID` (the drift test should have caught it) or the scan reads the wrong zone (must be `handCards`, not `woundCount` which is all-zones).
