# EC-727 — Mastermind-Hit + Heroes-Win Victory VFX (Execution Checklist)

**Source:** docs/ai/work-packets/WP-690-mastermind-hit-and-victory-vfx.md
**Layer:** Arena Client only — two new pure-presentation VFX consumers on the WP-556 foundation (no engine change)

## Before Starting
- [x] Baseline: `origin/main` @ `0ff634c1` (the WP-556 VFX foundation, the `useWoundVfx` count-delta consumer, and the `UIState.mastermind.tacticsDefeated` + `UIState.gameOver` projections are present); working tree clean, synced.
- [x] WP-556 / D-24365 on `main`: `VfxOverlay.vue` (`fireBurst(count, colors?)`, `showWord`, `pulseImpact`, `shouldRender` gating, module-signal watches); `effectIntensity.ts` (`VfxKind = 'shake'|'particles'|'word'`); `canvas-confetti` installed + lazy-loaded.
- [x] WP-650 on `main`: `useWoundVfx` — the count-delta consumer (seed-on-first-frame, fire-on-increase) this hit beat mirrors.
- [x] The projections are public + required: `UIMastermindState.tacticsDefeated` / `tacticsRemaining` (required fields, filtered for every audience); `UIState.gameOver?: { outcome: string; endedEarly?: boolean }` with `EndgameOutcome = 'heroes-win' | 'scheme-wins' | 'tie'`.
- [x] `pnpm -r build` 0; arena-client suite + `vue-tsc` green.
- [x] Scope lock — EXACT target files = `Files to Produce` below. Anything else is a FAIL.

## Locked Values (do not re-derive)
- **Hit signal:** `UIState.mastermind.tacticsDefeated`, INCREASE only (a count never decreases in play; the guard keeps a lower-count reconnect frame from a phantom flash). Public — fires for every viewer (shared board), NOT seat-selected.
- **Hit tiers** (`mastermindHitVfxManifest.ts`): `mastermindHitTierForCount(n)` → `n<=0` null, `1..3` → `hit1/hit2/hit3`, `>=4` → `hit4` (bounded — there is no 5th Tactic). `MASTERMIND_HIT_VFX`: `hit1 { 50, word null, shake false }`, `hit2 { 90, 'STAGGERED!', false }`, `hit3 { 130, 'RECKONING!', true }`, `hit4 { 175, word null, true }`. Ascending `particleCount`, all `<= 200`; shake on hit3/hit4 only; hit1 wordless (restraint) and hit4 wordless (the finale banner owns the vanquish moment).
- **Hit palette:** `MASTERMIND_HIT_BURST_COLORS = ['#ff9d2e', '#ffd34e', '#ff5a3c']` (molten ember; lead `#ff9d2e` pinned distinct from Master Strike red / transform green / shield threat colours / wound red).
- **Hit event:** `MastermindHitVfxEvent { tacticsDefeated, seq }`; module-signal `useMastermindHitVfxSignal()` + injectable-render seam (the `useWoundVfx` shape).
- **Finale signal:** `UIState.gameOver.outcome === 'heroes-win' && gameOver.endedEarly !== true`. Fire ONCE on the false→true transition; seed-on-first-frame so a reconnect INTO an already-won match replays nothing. Ignores `scheme-wins` / `tie` / `endedEarly`.
- **Finale spec** (`victoryFinaleVfxManifest.ts`): `VICTORY_WORD = 'VICTORY!'`; `VICTORY_FINALE_VFX { burstCount 3, burstParticleCount 160, burstIntervalMs 260, colors ['#ffd34e','#ffe9a8','#7ec8ff','#ffffff'] }` (gold + hero-blue + white; lead gold `#ffd34e` pinned).
- **Finale event:** `VictoryFinaleVfxEvent { seq }`; module-signal `useVictoryFinaleVfxSignal()` + injectable-render seam.
- **Gating (both):** word/banner `'word'` (shows unless `off`); particles `'particles'` (off under reduced-motion); the full-screen impact / gold bloom `'shake'` (full intensity only, off under reduced-motion — the wound-vignette precedent).
- **Overlay slots:** the hit reuses the combo `currentWord` / burst / impact slots; the finale gets its OWN `currentVictoryWord` banner slot + `isCelebrating` gold bloom + a staggered confetti storm (so a coincident hit-4 and the victory banner never fight for one slot).

## Guardrails
- **No engine change.** No new `NotableGameEventType`, no new `UIState` field, no `G`/`ctx` read. The hit rides the projected `tacticsDefeated` count delta; the finale rides the projected `gameOver.outcome`. A `packages/game-engine/**` edit is a scope FAIL.
- **Pure presentation (client).** Reads `UIState` only; never `G`/`ctx`; absent from the determinism hash (`src/vfx/` D-24365). Fail-soft confetti (reuse `ensureConfetti`); a jsdom mount is a no-op.
- **Fire-once / seed-on-first-frame.** Neither effect replays on a mount / reconnect against an already-advanced snapshot. The hit seeds `lastSeen` on the first valid frame; the finale seeds its latch (`hasFired = isVictory`) on the first valid frame.
- **Accessibility contract (mandatory).** `off` = nothing; `low` / reduced-motion keep the word / banner (plain fade) + (at `low`) the particles, but suppress the full-screen impact / bloom. Never a loss of gameplay.
- **Combo path unchanged** — `fireBurst`'s `colors?` already omits the key when undefined (WP-647); the hit + finale pass their palettes explicitly. Do NOT touch `useComboVfx` / `comboVfxManifest`.
- **Confetti-storm timers cleaned up** — the staggered bursts are `setTimeout`-scheduled; clear any pending in `onUnmounted` so a mid-storm unmount fires nothing after teardown.
- arena-client tests: `node:test` + `@vue/test-utils` + `jsdom` — never `boardgame.io/testing`, never Vitest.
- `PlayViewport` wiring is TWO runtime-wiring lines (`useMastermindHitVfx(audioSnapshot)` + `useVictoryFinaleVfx(audioSnapshot)` beside the other feel consumers, same snapshot).

## Required `// why:` Comments
- `useMastermindHitVfx.ts` seed + increase-only: seed-on-first-frame (no pre-mount flash); fire on increase only (a lower-count reconnect frame must not flash).
- `useVictoryFinaleVfx.ts` seed latch: seed on the first valid frame so a reconnect into an already-won match replays nothing; fire once on the transition, then latch.
- `mastermindHitVfxManifest.ts` `hit4` word null: the finale banner owns the vanquish word when hit 4 is the killing blow (normal rules); the physical beat still lands.
- `VfxOverlay.vue` finale gating: the full-screen gold bloom is `'shake'` (full only, off under reduced-motion — the wound / surge class); the banner survives in its own slot.
- `PlayViewport.vue` mount: runtime wiring — the two feel consumers beside the others, same snapshot.

## Files to Produce
- `apps/arena-client/src/vfx/mastermindHitVfxManifest.ts` — **new** — the tier ladder + `mastermindHitTierForCount` + `MASTERMIND_HIT_VFX` + palette
- `apps/arena-client/src/vfx/mastermindHitVfxManifest.test.ts` — **new** — tier boundaries + ascending/≤200 particles + shake discipline + wordless hit1/hit4 + hex palette
- `apps/arena-client/src/composables/useMastermindHitVfx.ts` — **new** — the count-delta consumer + signal seam
- `apps/arena-client/src/composables/useMastermindHitVfx.test.ts` — **new** — safe-skip / catch-up / fire-on-increase / multi-step / decrease-re-arm
- `apps/arena-client/src/vfx/victoryFinaleVfxManifest.ts` — **new** — `VICTORY_WORD` + `VICTORY_FINALE_VFX`
- `apps/arena-client/src/vfx/victoryFinaleVfxManifest.test.ts` — **new** — word + multi-burst + ≤200 + interval + hex palette + pinned gold lead
- `apps/arena-client/src/composables/useVictoryFinaleVfx.ts` — **new** — the fire-once outcome consumer + signal seam
- `apps/arena-client/src/composables/useVictoryFinaleVfx.test.ts` — **new** — safe-skip / heroes-win-once / no-loss / no-tie / no-early-end / no-reconnect-replay
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — the two new signal consumers + the gold bloom + the VICTORY! banner
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — hit beat (word/impact/off/reduced-motion) + finale (banner/bloom/own-slot/off/low/reduced-motion)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (wiring)** — mount both consumers
- `docs/ai/DECISIONS.md` — **modified** — land D-24507
- `docs/ai/STATUS.md` — **modified** — live-verified entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-690 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-727 row
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-690 node + counts

## Verification
```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
git diff --name-only   # only apps/arena-client/** + docs/** — no packages/game-engine/**
```

## Completion Rule
Not done until: build + typecheck + arena-client tests exit 0; `git diff --name-only` is within scope (no engine change); D-24507 landed; WORK_INDEX / EC_INDEX / STATUS / roadmap updated + `pnpm roadmap:counts:check` exits 0; and the D-24026 live-on-surface evidence (hit beat + victory finale observed on the play surface) is recorded in STATUS.md.
