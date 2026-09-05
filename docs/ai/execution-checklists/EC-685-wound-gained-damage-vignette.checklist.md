# EC-685 — Wound-Gained Damage Vignette + Thud (Execution Checklist)

**Source:** docs/ai/work-packets/WP-650-wound-gained-damage-vignette.md
**Layer:** arena-client (two new feel-layer consumers + one VfxOverlay render + a synthesized clip) + ewiki (Surface-1b flip on `visual-effects` + `sound-effects`)

## Before Starting
- [ ] Baseline: `origin/main` @ `089a71de` (the `/version` alias) or later; working tree clean, synced.
- [ ] WP-556 / D-24365 on `main`: `VfxOverlay.vue`, the module-signal consumer seam, `effectIntensity.shouldRender`, `canvas-confetti`, the `src/vfx/` determinism exemption. WP-647 added the second consumer (`useStrikeBlockedVfx`) — the exact pattern this mirrors.
- [ ] `UIState.players[i].woundCount` is projected (`uiState.types.ts` + `.build.ts`) and survives the audience filter for every seat (`uiState.filter.ts`). The local seat is the one whose `handCards !== undefined` (the `PlayDesktop.vue` `viewer` self-selection).
- [ ] `pnpm -r build` 0; arena-client `vue-tsc` + suite green.
- [ ] Scope lock — EXACT target files = `Files to Produce` below. NO `packages/game-engine/**` change. Anything else is a FAIL.

## Locked Values (reuse — do not re-derive)
- Signal: the LOCAL seat's `UIState.players[own].woundCount`, `own = players.find(p => p.handCards !== undefined)`. Fire ONLY on `count > lastSeen`; a decrease (heal) advances `lastSeen` silently. Seed `lastSeen` on the first valid own-seat frame (no pre-mount fire).
- Vignette gate: `shouldRender('shake')` (full intensity only; off under reduced-motion / low / off) — the impact-pulse precedent.
- Thud: `getAudioEngine().play(WOUND_GAINED_CLIP)` where `WOUND_GAINED_CLIP = 'https://images.legendary-arena.com/audio/sound-effects/wound-gained.mp3'` (hyphenated, R2-hosted, never committed).

## Guardrails
- **Increase-only:** a heal decrements `woundCount`; it MUST NOT flash / thud. Still advance `lastSeen` on a decrease so a re-wound re-arms.
- **Local seat only:** self-select via `handCards !== undefined`; a spectator / autoplay frame (no own hand) is a safe-skip, NOT a reset of `lastSeen`.
- **PURE presentation:** reads `UIState` only, writes no `G`/`ctx`, `src/vfx/` hash-excluded (D-24365). NO engine change. NO determinism re-pin (arena-client-only) — do NOT touch `finalStateHash` / `PRE_WP080` / sim artifacts.
- **No sfxManifest entry:** a Wound is not a `NotableGameEvent`; the thud carries a single-URL `woundCueManifest.ts` constant, not a manifest Record. Do NOT add `woundGained` to `sfxManifest` (its Record is exhaustive over the 9 notable-event types — a tenth key breaks `vue-tsc`).
- **Accessibility contract (WP-556):** `off` kills both halves; reduced-motion drops the flash (CSS backstop + the `shake` gate) but the thud still plays.
- `VfxOverlay.vue` MUST stay `defineComponent({ setup(){ return {...} } })` (EC-132 §2 / D-6512) — expose new template bindings in the `return`.

## Required `// why:` Comments
- The increase-only + self-seat logic in both consumers (why a heal must not fire; why `handCards` selects the local seat).
- The `shouldRender('shake')` gate on the vignette (why a full-screen colour flash is photosensitivity-class).

## Files to Produce
- `apps/arena-client/src/composables/useWoundVfx.ts` — **new** — the vignette consumer (self-seat woundCount delta → module signal)
- `apps/arena-client/src/composables/useWoundCue.ts` — **new** — the thud consumer (same signal → `engine.play`)
- `apps/arena-client/src/audio/woundCueManifest.ts` — **new** — `WOUND_GAINED_CLIP` single URL
- `apps/arena-client/src/composables/useWoundVfx.test.ts` — **new** — safe-skip / seed / increase-only / heal-no-fire / re-arm / opponent-ignored
- `apps/arena-client/src/composables/useWoundCue.test.ts` — **new** — the same, recording-engine + mute
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — the red vignette element + `pulseWound` + `watch` + CSS + reduced-motion backstop + the doc note
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **modified** — `emitWound` + full / off / reduced-motion / low render tests
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount `useWoundVfx` + `useWoundCue` (two 01.5 lines)
- `ewiki/sound-effects/wound-gained.py` — **new** — the deterministic synth generator (byte committed to R2, not git)
- `wiki/visual-effects.md` — **modified** — Surface-1b "Wound gained" → shipped
- `wiki/sound-effects.md` — **modified** — Surface-1b "Wound gained" → shipped

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (`vue-tsc`) 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (the new consumer + render tests; no regression)
- [ ] wound-gained.mp3 uploaded + GET-verified on R2 (`200` / `audio/mpeg`); the generator reproduces the byte
- [ ] `wiki-viewer:project` + `check-links` pass
- [ ] Live-on-surface verification — REQUIRED (surface = `play.legendary-arena.com`, D-24026): take a Wound → red vignette + thud; ewiki entries live
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — land D-24462 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-650 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅` + `pnpm roadmap:counts:write`
- [ ] `git diff --name-only` shows only the allowlist

## Common Failure Smells
- A heal flashed / thudded → the fire guard is not `count > lastSeen` (or `lastSeen` was not advanced on a decrease).
- An opponent's wound flashed for me → the self-seat `handCards` selection is missing (watching all players).
- You edited `packages/game-engine/**` or `sfxManifest.ts` → scope creep; this is arena-client-only, and a Wound is not a notable event.
- A `finalStateHash` / sim re-pin appeared → impossible (no engine change); investigate a stray edit.
- `VfxOverlay.vue` switched to `<script setup>` → EC-132 §2 violation.
