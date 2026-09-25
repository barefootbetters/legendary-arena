# EC-793 — Slash gesture to fight: swipe across City villains to fight them, with a blade trail (Execution Checklist)

**Source:** docs/ai/work-packets/WP-756-slash-gesture-fight.md
**Layer:** arena-client (`.../lib/**`, `.../composables/**`, `.../components/play/{CityRow,VfxOverlay,AudioControls}.vue`) + ewiki docs
**Status:** Pending (WP-755 shipped in #2354)

## Before Starting

- [ ] WP-755 is merged (WORK_INDEX `[x]`).
  - Read its shipped `VfxOverlay.vue` slice beat and reconcile any name drift against WP-756 Assumes #1.
  - Confirm its `splitCardAlongCut` / `buildHalfKeyframes` handle a vertical cut (90°) and 180° without NaN. Confirm its producer and overlay signal watchers use the default `pre` flush. If either check fails, STOP and reconcile.
- [ ] Read WP-756 in full and confirm every Assumes item, especially:
  - #3: departure ⇔ success; others may be added or removed; there is no client move queue.
  - #7: no clock outside the D-24365 subsurface.
- [ ] Read `CityRow.vue` + `AudioControls.vue` (with tests) and `vfx/effectIntensity.ts`. Then run `pnpm -r build` and `pnpm --filter @legendary-arena/arena-client typecheck` (must exit 0); record the test count.

## Locked Values (verbatim from WP-756 §Locked Values; the WP wins on conflict)

**Thresholds and hit rule**
- `GESTURE_START_DISTANCE_PX`: mouse 8, touch or pen 16.
- `TARGET_CONFIRM_TIMEOUT_MS = 3000` (must be less than `MOVE_ACK_TIMEOUT_MS` 4000). It is a no-frame backstop: on expiry, abandon the rest.
- **Crossed** means the stroke began OUTSIDE the tile's rect, entered it, and later had a sample outside it.
- Candidates are the tiles with `gateForCityIndex(i)` true at gesture start. Take their rects from `[data-testid="play-city-villain"][data-city-index="i"]`, measured once.
- A tile counts at most once per stroke.
- Create the state from the `pointerdown` point, then advance the down→current segment right away. Samples are `clientX`/`clientY`. Queue crossings as they complete, mid-stroke.
- `angleDeg` is measured from the entry point to the completing sample, in screen convention.

**Pointers**
- `mouse`: primary button only.
- `touch` and `pen`: only while `city-spaces--gesture-touch` is on the row.
  - The class is present iff the setting is on AND the row fits. Fit means: the row `scrollWidth <= clientWidth + 1`, every horizontally scrollable ancestor fits the same way, and the row's horizontal extent is within `innerWidth`. The rule is horizontal-only and position-independent.
  - Measure once on mount, then re-measure on ResizeObserver (guarded), on `watch(city, …, { flush: 'post' })`, and on window `resize`.
  - The class sets `touch-action: pan-y`.
- `city-spaces--gesture` (present iff the setting is on) sets `user-select: none`.
- Ignore a second `pointerId` while a stroke is active.

**Click and drag**
- Arm one-shot click suppression only after a gesture has started.
- Clear it on the next `pointerdown` or `keydown`, or by `setTimeout(0)` after `pointerup`. `pointercancel` ends the stroke, keeps completed crossings, and arms nothing.
- A row `dragstart` listener calls `preventDefault()` whenever the setting is on.
- Suppress `play-city-villain` clicks while a chain submit is in flight. The EV button click passes through.

**Chain**
- Queue `extId`s in crossing order.
- Before each submit, re-resolve `cityIndex` by `extId`. Skip if absent or refused. Otherwise call `submitFight(i)`, which sends `fightVillain({ cityIndex })` only.
- The first new `city()` snapshot after a submit decides: `extId` gone means confirmed; still present means rejected, so skip immediately.
- No snapshot within 3000 ms means abandon the rest. The chain watcher uses `flush: 'post'`.
- A confirm (post-flush), skip or abandon drops that target's hint, and dispose drops all hints.
- On append, skip `extId`s already queued or in flight.
- A new stroke appends to the running chain.

**Blade trail**
- 170 ms life, max width 14 px (10 px below a 600 px viewport), 64 points max.
- Colours are imported from `vfx/villainSlashVfxManifest.ts`.
- `flush: 'sync'` watcher; each sample stamped with `performance.now()`. Recompute the path inside that watcher as well (no rAF in jsdom).
- Hide `.vfx-overlay__blade` under reduced motion.
- Rendered only when `shouldRender('particles')`.

**Angle hint**
- Per-`citySpace` FIFO of `{ extId, angleDeg }`. `take()` returns the oldest entry's angle, or `null`.
- The internal `drop(citySpace, extId)` runs on confirm (post-flush), skip or abandon, and for all hints on dispose.
- `take(event.citySpace)` is the FIRST line of `renderVillainSlash` (`VfxOverlay.vue:926`), before the particles gate, never in `renderSlicePieces`. Thread `hintAngle ?? villainSlashAngleForSeq(event.seq)` into `renderSlicePieces` as `angleDeg`.

**Setting and test ids**
- Setting: `arenaClientSlashGesture`, `'on' | 'off'`, default `'on'`. Anything but `'off'` reads as on.
- Test ids: `play-vfx-blade-trail`, `slash-gesture-toggle` (with `aria-pressed`). Classes: `city-spaces--gesture`, `city-spaces--gesture-touch`.

**Contract signatures**
- Geometry (pure, in `lib/slashGestureGeometry.ts`):
  - `segmentIntersectsRect`, `isPointInRect`, `createCrossingState`
  - `advanceCrossingState(state, from, to)`, which returns `{ state, crossed: { extId, angleDeg }[] }`
  - `strokeAngleDeg`, `distanceBetween`
- `useSlashGesture({ rowElement, city: () => UICityState, gateForCityIndex, submitFight, isEnabled, capturePointer? })` returns:
  - `handlePointerDown` / `handlePointerMove` (returns `{ hasStartedGesture }`) / `handlePointerUp` / `handlePointerCancel` / `handleKeyDown`
  - `shouldSuppressClick()`
  - `isGestureEnabled` and `isTouchGestureEnabled`
- Also exported: `useBladeTrailSignal()`, `useSliceAngleHints()`, `__resetSlashGestureSignalsForTests()`.
- `useSlashGestureSetting()` → `{ isEnabled, setEnabled }`, plus `__resetSlashGestureSettingForTests()`.
- `buildBladeTrailPath(points, nowMs, lifeMs, maxWidth)`: exported pure from `VfxOverlay.vue`; returns `''` for fewer than 2 points.

## Guardrails

- **Zero engine change.** No `packages/**` change and no new move. Submit only `fightVillain({ cityIndex })`, one at a time, gated by the unchanged `gateForCell`.
- **No clock outside the VFX subsurface.** No `performance.now()`, `Date.now()` or `Math.random()` outside `src/vfx/**` and `VfxOverlay.vue`.
- **Setting off = byte-identical.** No capture, no `dragstart` prevention, no gesture or touch class, no click suppression.
- **Taps stay taps.** A press under 8 px (mouse) or 16 px (touch/pen) never captures and never arms suppression. The EV button, captured cards and tooltips are unchanged.
- **Engine owns truth.** Never predict a rejection. Read it from the first new snapshot and skip immediately. Abandon on the no-frame timeout. Never submit late.
- **Naming.** New `VfxOverlay` identifiers use the `blade` or `slice` stem. Never touch WP-746's `slash*` identifiers.
- **Blade trail.** It is a template-owned SVG. The rAF loop runs only while points remain, is guarded when rAF is missing, and is cancelled on unmount.
- **Testing.** Drive tests through the controller seam (`effectScope`, injected `capturePointer`, stubbed rects and widths, `mock.timers` with `setTimeout` only). Use `new window.MouseEvent`. Never reference `PointerEvent` (no `instanceof`), in tests or in code.
- **Disabled tiles.** Never set `pointer-events: none` on them, because it kills the tooltips.
- **Commit subjects and PR titles never contain "swipe".** The hook's unanchored regex matches `wip` inside it.

## Required `// why:` Comments

- **Full-crossing rule:** a press-drag that starts on a tile must not spend attack, and a speed rule would need a banned clock.
- **Per-pointer start distance and cleared one-shot suppression:** capture retargets `click`, and touch strokes fire no `click`.
- **Early `dragstart` prevention:** the native image drag threshold is below 8 px.
- **`extId`-keyed chain:** indices shift and other villains can escape. A rejection is detected on the next snapshot, so the chain never fires after a prompt closes. The 3000 ms backstop stays below the 4000 ms ack window, so a resync never triggers a late submit.
- **Touch/pen fit rule, re-measured on content change:** the row scrolls horizontally on narrow screens.
- **`performance.now()` trail stamp:** permitted by D-24365.
- **Hint `take` runs first:** a gated beat would otherwise leave a stale angle.

## Files to Produce

- [ ] `apps/arena-client/src/lib/slashGestureGeometry.ts` (+ `.test.ts`)
- [ ] `apps/arena-client/src/composables/useSlashGesture.ts` + `useSlashGestureSetting.ts` (each + `.test.ts`)
- [ ] `apps/arena-client/src/components/play/CityRow.vue`, `VfxOverlay.vue`, `AudioControls.vue` (each + `.test.ts`)
- [ ] `wiki/visual-effects.md`

## After Completing

- [ ] arena-client typecheck exits 0 and tests report 0 fail. `pnpm -r build && pnpm -r --no-bail test` is green. No `packages/**` in the diff.
- [ ] Preview drive (WP Verification step 4), with screenshots:
  - a click fights normally;
  - a two-villain stroke chains in order;
  - a drag starting on art neither fights nor ghost-drags;
  - with the setting off, strokes do nothing;
  - the mobile fit rule holds.
- [ ] Two-commit topology: `EC-793:` implementation + `SPEC:` close. The close updates WORK_INDEX, EC_INDEX, DECISIONS (D-24585), STATUS (`### WP-756`) and the mindmap (✅, then `roadmap:counts:write`).
- [ ] `pnpm roadmap:counts:check` and `pnpm ledger:numbers:check` both exit 0.
- [ ] The ewiki section is published. D-24026 is recorded as operator-manual-pending.

## Common Failure Smells (Optional)

- **The next tap after a phone stroke does nothing.** Suppression was never cleared (touch fires no `click`).
- **Clicking a villain no longer fights.** Capture was taken before the start distance, or the fit rule depended on scroll position.
- **The second villain in a stroke is the wrong card.** The queue held indices.
- **A stroke starting on card art does nothing.** `dragstart` was prevented too late, so a native drag cancelled the stroke.
- **Mobile can't scroll the City after a villain enters.** The fit was measured only on resize.
- **Clicked fights slash at a stroke's angle.** A hint went unconsumed at `off` intensity, or a skipped target's hint was never dropped.
- **A villain gets fought seconds after a KO prompt was answered.** Rejections were detected by the timer, not by the next snapshot.
- **The commit is rejected as a "forbidden pattern".** The subject contains "swipe".
