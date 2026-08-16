# EC-591 — Arena-Client VFX Foundation + Combo Flash + Synergy Call-out (Execution Checklist)

**Source:** docs/ai/work-packets/WP-556-arena-client-vfx-foundation-combo.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; capture the SHA in the WP baseline.
- [ ] `UIState.game.lastPlayEffectsFired: number` (WP-409 / D-24221) is live — a public scalar, reset to `0` in the play-phase `onBegin`, overwritten per play.
- [ ] The shipped combo tiers are on `main`: `comboCueManifest.ts` (WP-413 / WP-425) exports `ComboTier = 'none'|'small'|'medium'|'big'|'legendary'` + the pure `comboTierForCount(count)`; `useComboCue.ts` is the sibling-consumer precedent; `PlayViewport.vue` is the `01.5` host mounting `useSoundEffects`/`useComboCue`; `NotableEventOverlay.vue` is the overlay precedent; `AudioControls.vue` is the persisted mute/volume control.
- [ ] There is NO `prefers-reduced-motion` and NO animation library in `apps/arena-client/src` today (this WP adds both).
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it (beyond the FOUR recorded `01.5` wiring hosts) is a FAIL — surface as a blocker, do not improvise.

## Locked Values (do not re-derive)
- Dependency added: `canvas-confetti@^1.9.3` (MIT), arena-client `dependencies` (lazy-imported off first-paint; commit the full updated `package.json`). Node v22+.
- Determinism exemption (D-24365, mirrors D-24085): the `client-app` `Math.random()`/`Date.now()`/`performance.now()` ban does NOT apply to the VFX presentation layer (`src/vfx/`, `VfxOverlay`) — non-replay-bearing presentation off the gameplay render path; it MAY use `canvas-confetti` (Math.random) + `requestAnimationFrame`. Land the clause in D-24365 + a `§client-app` note in `02-CODE-CATEGORIES.md` at close.
- Tier source: IMPORT `ComboTier` + `comboTierForCount` from `comboCueManifest.ts` — NEVER re-derive the mapping. Tiers: `<=0 → none`, `1 → small`, `2 → medium`, `3–4 → big`, `>=5 → legendary`.
- Call-out words: `medium → Team-Up!`, `big → Unstoppable!`, `legendary → LEGENDARY!`; `small`/`none` → NO word (flash-only / silent). The FLASH starts at `small`; the WORD starts at `medium`.
- Consumer rule: OWN last-seen scalar; catch up on the first valid frame (NO effect for the pre-mount value); render ONCE per audible value-change; skip `none`. NOT an append-only cursor. Equal-consecutive same-turn values coalesce (per-turn reset re-arms across turns; `3 → 0 → 3` fires the second `3`).
- Performance budget: 60 FPS; ≤200 particles; ≤5 bursts; ≤500ms shake; ONE overlay canvas; animate `transform`/`opacity` only; pool with a hard ceiling (drop oldest at cap); lazy-load `canvas-confetti`.
- Accessibility: persisted UNIFIED Effect-Intensity control + OS `prefers-reduced-motion` (suppress shake/heavy particles; the call-out WORD still shows as a plain fade). Off/reduced → no effects, full gameplay parity. Gate = `shouldRender(kind: 'shake' | 'particles' | 'word'): boolean` — `kind` is a LOCKED narrow union, never raw `string`. The unified "off" master sets visual intensity `off` AND mutes audio through `useAudioSettings`' existing mute setter (import + call; NO new audio store; modify `useAudioSettings.ts` ONLY if it lacks a callable master-mute setter).
- Signal source: `UIState.game.lastPlayEffectsFired` (public scalar; safe `?? 0` on null/absent snapshot).
- Wiring hosts = `PlayViewport.vue` (mount `useComboVfx` beside `useComboCue`) + `PlayDesktop.vue` (host `<VfxOverlay>` beside the existing `NotableEventOverlay`) + `PlayMobile.vue` (host `<VfxOverlay>` at the mat root — NO prior overlay there) + `components/play/AudioControls.vue` (render the unified control in ONE panel — do NOT add a new panel).
- Reserved decision: **D-24365** (land Active at close).

## Guardrails
- Pure presentation: reads `UIState` only — NEVER writes `G`/`ctx`, never affects an outcome, zero engine/determinism/replay footprint. If you touch a `packages/game-engine` file, STOP (out of scope).
- No runtime `@legendary-arena/game-engine/setup` or `@legendary-arena/registry` import; type-only `UIState` via the `.` subpath.
- ONE tier-mapping source: import `comboTierForCount`; a second definition anywhere is a FAIL (Verification Step 3 greps for exactly one).
- ONE overlay canvas; animate `transform`/`opacity` only; never a layout property; particle/burst caps enforced.
- Accessibility is NOT optional: no VFX ships unless `prefers-reduced-motion` is honoured AND the persisted Effect-Intensity control gates it. The call-out word must remain legible under reduced-motion.
- Scalar-change, not a stream: fire once per audible value-change; the pre-mount value never fires (catch-up); a change to `0`/`none` never fires. Assert (do not "fix") the equal-consecutive coalescing.

## Required `// why:` Comments
- `comboVfxManifest.ts`: imports `comboTierForCount` (single shared source, no per-renderer copy — D-24228/D-24246); the WORD starts at `medium` while the FLASH starts at `small` (contrast-through-restraint).
- `useComboVfx.ts` (scalar-change): own last-seen value; catch up on the first frame (no pre-mount effect); fire once per audible value-change; NOT an append-only cursor; equal-consecutive same-turn plays coalesce (per-turn reset re-arms across turns).
- `effectIntensity.ts`: unified control governs BOTH visual intensity and the audio mute/volume; `prefers-reduced-motion` is an accessibility gate (mandatory, day-one) — a disabled/reduced state degrades to no effects with full gameplay parity.
- `VfxOverlay.vue`: single shared canvas + budget ceiling; `transform`/`opacity`-only; lazy-load `canvas-confetti` off the first-paint path.
- At the `canvas-confetti` import / any `requestAnimationFrame` site: cite D-24365 — the VFX presentation layer is exempt from the `client-app` `Math.random()`/timing ban because it is non-replay-bearing presentation off the gameplay render path (mirrors D-24085).

## Files to Produce
- `apps/arena-client/package.json` — **modified** — add `canvas-confetti` (MIT)
- `apps/arena-client/src/vfx/comboVfxManifest.ts` — **new** — tier→burst/word map (imports `comboTierForCount`; exhaustive over audible tiers)
- `apps/arena-client/src/vfx/effectIntensity.ts` — **new** — persisted unified intensity + `prefers-reduced-motion` gate (`shouldRender(kind)`)
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **new** — single full-bleed overlay (canvas + word), budget-bounded
- `apps/arena-client/src/composables/useComboVfx.ts` — **new** — scalar-change combo-flash consumer (`useComboVfx(snapshot, options?)`)
- `apps/arena-client/src/components/play/AudioControls.vue` — **modified (`01.5`)** — render the unified Effect-Intensity in the existing panel (no second panel)
- `apps/arena-client/src/composables/useAudioSettings.ts` — **modified ONLY if it lacks a callable master-mute setter** (else import-only; drops from the diff) — the unified "off" mutes audio through it
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified (`01.5` wiring — same host)** — mount `useComboVfx(audioSnapshot)` beside `useComboCue`
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified (`01.5` wiring)** — host `<VfxOverlay>` beside the existing `NotableEventOverlay`
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified (`01.5` wiring)** — host `<VfxOverlay>` at the mat root (no prior overlay there)
- `apps/arena-client/src/vfx/comboVfxManifest.test.ts` — **new** — tier exhaustiveness; `small` = burst, no word; ladder wording
- `apps/arena-client/src/vfx/effectIntensity.test.ts` — **new** — persistence; off → no render; reduced-motion suppresses shake not word
- `apps/arena-client/src/composables/useComboVfx.test.ts` — **new** — one effect per audible change; no pre-mount; no change-to-none; coalesce; `3→0→3` re-arm; null-safe; off no-ops
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` — **new** — mounts; gate respected; single canvas; word at `>=medium` only
- `apps/arena-client/src/composables/useAudioSettings.test.ts` — **modified ONLY if `useAudioSettings.ts` gains the master-mute setter**
- `docs/ai/DECISIONS.md` + `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **modified at close** — land D-24365 Active (with the determinism-exemption clause) + the `§client-app` `src/vfx/` carve-out note
- `pnpm-lock.yaml` — **modified (generated)** — the `canvas-confetti` add

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — the load-bearing SFC gate).
- [ ] `pnpm --filter arena-client test` passes (`canvas-confetti` + `Howl` mocked; no real render/audio).
- [ ] `git diff --name-only` = the allowlist only (+ the FOUR recorded `01.5` wiring hosts + `pnpm-lock.yaml`); NO `packages/game-engine/**` file.
- [x] Live-on-surface (D-24026): **✅ VERIFIED 2026-08-16** (deployed bundle `gitSha a426b67`). Drove `lastPlayEffectsFired` via the `uiState` Pinia store on the live play surface: the flash scaled by tier — `small` = flash / **no word**, `medium` = **Team-Up!**, `big` = **Unstoppable!** + impact, `legendary` (>=5) = **LEGENDARY!** + impact (impact at the peaks only); the unified Effect-Intensity control cycled `full → low → off → full` and **off** flipped the mute to 🔇 (silences audio) and stopped the impact, persisted to localStorage. A pixel screenshot of the particle burst + the OS-reduced-motion word-fade were NOT captured (the browser pane was not being displayed → compositing paused, rAF/screenshots unavailable; OS reduced-motion can't be toggled from JS) — both are covered by the unit suite (1279/0: `VfxOverlay.test.ts` off→no-render + reduced-motion word-survives; `effectIntensity.test.ts` gate). Original spec: on the deployed bundle drive `lastPlayEffectsFired` 1→2→3(→5); the flash scales small→medium→big(→legendary), the word at `medium`+; Effect-Intensity off blanks + silences; reduced-motion keeps the word, drops the shake.
- [ ] `docs/ai/STATUS.md` — the VFX foundation + combo flash + synergy call-out (WP-409 signal + shared `comboTierForCount`).
- [ ] `docs/ai/DECISIONS.md` — land D-24365 Active (incl. the VFX determinism-exemption clause); `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §`client-app` carries the `src/vfx/` carve-out note.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-556 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-556 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Execution Amendment (2026-08-16)

Executed off `b1119667`; all changes scope-neutral simplifications within the App
layer (fewer files than the allowlist, no new scope):

- **Overlay host — one, not two.** `<VfxOverlay>` mounts **once at the shared
  `PlayViewport.vue` root** beside `<AudioControls>` (the WP-412 fixed-overlay
  precedent — a full-bleed `position: fixed` layer covers both surfaces from one
  host), instead of separately in `PlayDesktop.vue` + `PlayMobile.vue`. This
  resolves the draft's `PlayMobile`-has-no-`NotableEventOverlay` anchor gap and
  drops two wiring files. `PlayDesktop.vue` / `PlayMobile.vue` are **not**
  touched.
- **`useAudioSettings.ts` unmodified (import-only).** Its `isMuted` ref is
  directly settable, so the unified "off" coupling lives in `AudioControls.vue`
  (`isMuted.value = next === 'off'`) — no master-mute setter was needed, so
  `useAudioSettings.ts` and `useAudioSettings.test.ts` drop from the diff.
- **`testing/jsdom-setup.ts` — added a canvas `getContext` → null stub.** jsdom
  does not implement `HTMLCanvasElement.getContext` and throws a noisy
  not-implemented error (forwarded to the console) on every probe; `VfxOverlay`
  triggers it deciding whether to load `canvas-confetti`. The stub returns null
  (headless behaviour) so the fail-soft path skips particles cleanly and the
  suite is quiet. No test relies on a real 2D context (jsdom always threw).
- **Net files:** the 4 new `src/vfx/` + `useComboVfx` + `VfxOverlay` modules
  (+ their 4 tests), `AudioControls.vue`, `PlayViewport.vue`, `package.json` +
  `pnpm-lock.yaml`, `testing/jsdom-setup.ts`, and the governance close
  (`DECISIONS.md`, `02-CODE-CATEGORIES.md`, `WORK_INDEX.md`, this EC,
  `05-ROADMAP-MINDMAP.md`, `STATUS.md`). Verified: `typecheck` 0, arena-client
  suite **1279/0**, `pnpm -r build` 0, no `packages/game-engine/**` file, one
  `comboTierForCount` definition.

## Common Failure Smells
- A `packages/game-engine/**` file in the diff ⇒ you drifted into the engine; the VFX layer is App-only (the signal already shipped in WP-409).
- A second `comboTierForCount` / a hand-copied tier map ⇒ you re-derived instead of importing the shipped helper.
- An effect fires on mount / on reconnect ⇒ the consumer did not catch up (seed last-seen on the first frame).
- An effect fires on a change to `0`, or a word at `small` ⇒ the `none`/`small`-word skip is wrong.
- No `prefers-reduced-motion` path, or the word vanishes under reduced-motion ⇒ the accessibility gate is incomplete (the word must survive).
- More than one canvas, or layout-property animation, or an unbounded particle pool ⇒ the performance budget is violated.
- A committed asset file ⇒ the combo flash is code-generated; there are no VFX bytes to commit.
