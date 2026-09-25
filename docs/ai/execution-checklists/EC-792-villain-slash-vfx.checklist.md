# EC-792 — Villain slash VFX: a Fruit Ninja-style defeat beat on the VfxOverlay (Execution Checklist)

**Source:** docs/ai/work-packets/WP-755-villain-slash-vfx.md
**Layer:** arena-client (`.../vfx/**`, `.../composables/**`, `.../components/play/VfxOverlay.vue`, `.../pages/PlayViewport.vue`) + ewiki docs
**Status:** Pending

## Before Starting

- [ ] Read WP-755 in full and confirm every **Assumes** item, especially:
  - #2: the defeated card has already left `city.spaces` in the event frame.
  - #3: the space element is usually the empty placeholder, so only its centre is used.
- [ ] Read the templates:
  - `useExcessiveViolenceVfx.ts` + its test (signal, renderer seam, D-20104 cursor);
  - the WP-746 block in `VfxOverlay.vue` + its test.
- [ ] Read the rules:
  - `vfx/effectIntensity.ts` (`shouldRender`);
  - the `buildBurstOptions` pure-builder pattern;
  - `02-CODE-CATEGORIES.md` §client-app `:294-330` (the D-24365 subsurface).
- [ ] Run `pnpm -r build`, then check `pnpm --filter @legendary-arena/arena-client typecheck` exits 0. Record the arena-client test count.

## Locked Values (verbatim from WP-755 §Locked Values + §Contract; the WP wins on conflict)

**Colours and counts**
- Spray colours: `['#7b1fa2', '#4a0d67', '#b44fd6']` (the lead is `--color-villain`).
- Spray count: full **28**, low **10**.
- Streak colours: core `#ffffff`, glow `#d6c2ff`.

**Geometry**
- Angles: `[-28, 22, -16, 34]` degrees, chosen by `seq % 4`.
- Angle convention: screen (y down, clockwise positive), passed unchanged to the geometry helpers and the streak's `rotate()`.
- Confetti `angle` is **`-angleDeg`**.
- `CARD_ASPECT = 5 / 7`.

**Timing and limits**
- `halfFlightMs 900`, `streakMs 260`, `stainMs 2400`, `stainCount 5`.
- Live-halves cap: **10** (oldest removed first).
- `TAKEDOWN_STREAK_WINDOW_MS = 4000`.

**Takedown words**
- Streak 1 → `null`; 2 → `'DOUBLE TAKEDOWN!'`; 3 → `'TRIPLE TAKEDOWN!'`; ≥ 4 → `'RAMPAGE!'`.
- A takedown word shows when the slot is empty or already holds a takedown word. It never overwrites any other beat's word.

**Naming:** every new overlay identifier uses the `slice` stem (`SLICE_*`, `slice*`, `.vfx-overlay__slice-*`, `vfx-slice-*`). WP-746's `slash*` identifiers are never modified or reused. (The rule covers names declared in `VfxOverlay.vue`; imported `villainSlash*` contract names keep their prefix.)

**Mount:** `useVillainSlashVfx(audioSnapshot)` goes immediately after `useExcessiveViolenceVfx(audioSnapshot)` in `PlayViewport.vue`.

**Producer event:** `{ seq, citySpace, playerId, imageUrl: string | null }`.
- `imageUrl` comes from the prior frame's city cache.
- It is `null` on a cache miss or an empty `display.imageUrl`.
- The cache refreshes on every non-null frame, including the catch-up frame.

**Contract signatures**
- `useVillainSlashVfx(snapshot: Ref<UIState | null>, render?: VillainSlashVfxRenderer): void`
- `useVillainSlashVfxSignal(): Ref<VillainSlashVfxEvent | null>`
- `TakedownStreakState = { playerId: string; atMs: number; streak: number }`
- `nextTakedownStreak(previous, playerId, nowMs)`: +1 when it is the same player and `nowMs - previous.atMs <= 4000`, otherwise 1.
- `resolveCardBox(spaceRect, referenceTileRect)`:
  - the box is centred on the space;
  - it uses the reference size when that is non-zero, otherwise the space height × 5/7;
  - it returns `null` for a zero space rect.
- `buildStainOffsets(seq, count, angleDeg, width, height)`: deterministic, no randomness.
- `buildSliceSprayOptions(colors, particleCount, originX, originY, angleDeg)`: exported pure from `VfxOverlay.vue`, with `angle: -angleDeg` and `disableForReducedMotion: true`.

**Selectors**
- Space: `[data-testid="play-city-villain"][data-city-index="N"], [data-testid="play-city-empty"][data-city-index="N"]`
- Reference tile: `[data-testid="play-city-row"] [data-testid="play-city-villain"] [data-testid="card-tile"]`

**Gates**
- `'word'`: the word.
- `'particles'`: halves, streak, spray.
- `'shake'`: tumble, stains, full spray count, and the impact pulse on streak ≥ 3.

**Test ids:** `play-vfx-slice-layer`, `play-vfx-slice-half`, `play-vfx-slice-streak`, `play-vfx-slice-stain`.

## Guardrails

- **Zero engine change.** No `packages/**` file, no new notable-event type, no UIState field, and no `sfxManifest`, `CHIP_LABELS` or `02-CODE-CATEGORIES.md` edit.
- **One clock.** `performance.now()` is read ONLY in `VfxOverlay.vue`.
- **No randomness outside confetti.** The producer reads no clock and no randomness. Angles and stains derive from `seq`. The only randomness is inside `canvas-confetti` (D-24365).
- **DOM, not canvas.** Halves, streak and stains are imperative DOM nodes in `play-vfx-slice-layer`. Nothing is drawn on the confetti canvas.
- **Animation.** Use `transform`/`opacity` only. Remove nodes with `setTimeout`, never a bare `requestAnimationFrame`. `onUnmounted` clears timers and nodes.
- **Styling.** Scoped CSS never reaches imperative nodes. Style them inline, or with `:deep()` under `.vfx-overlay__slice-layer`.
- **Reduced motion.** Backstop with `.vfx-overlay__slice-layer { display: none }`.
- **Fail soft.** A missing element, a `null` box, no `element.animate`, or a failed confetti load each skip that stage silently. Never throw.
- **Pure helpers.** Geometry and streak helpers are pure and exported.
- **Bindings.** Template bindings stay in the `defineComponent` `setup()` return (D-6512).
- **Tests.** Assert builders, signals and DOM presence only. Never assert rendered confetti or a running animation.

## Required `// why:` Comments

- **Prior-frame city cache:** the event frame no longer holds the card.
- **The one `performance.now()` read:** it is D-24365-exempt in `VfxOverlay.vue`, and not allowed in the composable.
- **DOM halves:** the single canvas is owned and cleared by confetti.
- **`resolveCardBox`:** the empty placeholder is not card-shaped.
- **Word-slot rule:** a takedown word may replace a takedown word, never another beat's word.
- **Confetti `-angleDeg`:** confetti measures counter-clockwise, with 90 = up.
- **`seq`-derived angles and stains:** deterministic, no `Math.random`.
- **`setTimeout` removal:** cancellable on unmount, and mockable in tests.
- **The `PlayViewport.vue` mount and its position:** an unmounted producer never fires, and the EV word must land first.

## Files to Produce

- [ ] `apps/arena-client/src/vfx/villainSlashVfxManifest.ts` + `villainSlashGeometry.ts` (each with `.test.ts`)
- [ ] `apps/arena-client/src/composables/useVillainSlashVfx.ts` (+ `.test.ts`)
- [ ] `apps/arena-client/src/components/play/VfxOverlay.vue` (+ `.test.ts`)
- [ ] `apps/arena-client/src/pages/PlayViewport.vue` (+ `.test.ts`, the mount test)
- [ ] `wiki/visual-effects.md` + `ewiki/visual-effects/villain-slash.{py,svg}`

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0, and `test` reports 0 fail.
- [ ] `pnpm -r build && pnpm -r --no-bail test` is green.
- [ ] `git diff --name-only` shows no `packages/**` path.
- [ ] Drive the preview:
  - one defeat each at full, low and off intensity;
  - the split is card-shaped;
  - DOUBLE → TRIPLE when clicking fast.
- [ ] Two-commit topology: `EC-792:` implementation + `SPEC:` close.
- [ ] The `SPEC:` close updates WORK_INDEX, EC_INDEX, DECISIONS (D-24584), STATUS (`### WP-755`) and the mindmap (✅ + `roadmap:counts:write`).
- [ ] `pnpm roadmap:counts:check` and `pnpm ledger:numbers:check` both exit 0.
- [ ] D-24026 recorded as operator-manual-pending until the beat is seen live.

## Common Failure Smells (Optional)

- **Beat never appears.** The producer isn't mounted, or the art lookup reads the CURRENT frame.
- **Halves squashed or stretched, or at the top-left.** The placeholder rect was used directly, or a zero rect wasn't skipped.
- **Halves flicker or vanish.** They were drawn on the confetti canvas.
- **Nodes unstyled or not animating while tests pass.** Scoped CSS was used on imperative nodes.
- **No "TRIPLE TAKEDOWN!" when clicking fast.** The rule blocks the beat's own word.
- **EV fight shows "DOUBLE TAKEDOWN!" instead of "EXCESSIVE VIOLENCE!".** The other-beat rule or the mount order is wrong.
- **EV slash bloom broken.** A new identifier shadowed WP-746's `slash*`.
- **Spray flies the wrong way.** The confetti angle wasn't negated.
- **Zero halves in tests.** The fake element needs a stubbed `getBoundingClientRect`.
