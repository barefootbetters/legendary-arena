# WP-756 — Slash gesture to fight: swipe across City villains to fight them, with a blade trail (arena-client + ewiki)

**Status:** Draft 2026-09-25 (EC-793; D-24585 reserved) — READY TO EXECUTE (pre-flight READY r6; copilot PASS r5; lint PASS r1-post-fix). WP-755 shipped in #2354 (`0edc27ab`), and this WP extends its `VfxOverlay` slice beat and `play-vfx-slice-layer`.
**Primary Layer:** arena-client (`apps/arena-client/src/lib/**`, `.../composables/**`, `.../components/play/{CityRow,VfxOverlay,AudioControls}.vue`) + ewiki docs
**Dependencies:**
- **WP-755 / D-24584** (the villain slash beat: `useVillainSlashVfx`, the slice layer, the `vfx/villainSlashVfxManifest.ts` streak colours, the slice angle by `seq`) ✅ (#2354).
- WP-556 / D-24365 (the VFX foundation, `effectIntensity`, and the VFX timing exemption) ✅.
- WP-129 / EC-132 (the City row, with `gateForCell` stage→cost precedence) ✅.
- WP-738 / D-24561 (the separate opt-in Excessive Violence fight button) ✅.

**User-Visible Surface:** play.legendary-arena.com (the City row on the play board) and ewiki.legendary-arena.com/visual-effects/
**Baseline:** `origin/main` @ `d3e5be26`
**Naming note:** commit subjects **and PR titles** for this WP must not contain the word "swipe". The squash-merge subject is the PR title, and the commit-hygiene regex is unanchored, so "s**wip**e" matches `wip`. The slug and identifiers use **slash gesture**, and the `SPEC:` close subject must not reuse this heading verbatim.

---

## Goal

Let a player **fight villains by slashing across them** with the mouse — or with a finger or pen when the City row fits on screen — which is the Fruit Ninja feel from the operator-approved "Villain Slash Lab" prototype.

- A glowing blade trail follows the pointer.
- Each fightable villain the stroke fully crosses is fought, in crossing order.
- The WP-755 slash plays along the stroke.
- Tap-to-fight keeps working. The one deliberate change: a mouse press that drags more than 8 px (16 px for touch or pen) becomes a gesture instead of a click.
- A persisted "Slash to fight" toggle lets any player switch the gesture off.

---

## User-Visible Impact

- **Before:** you fight one villain per click. The WP-755 slash plays at a fixed per-event angle.
- **After, with a mouse:**
  - Dragging a stroke across one or more fightable villains fights each of them in turn.
  - A white-and-lavender blade trail follows the pointer and fades within about 170 ms.
  - Each villain's slash follows the stroke's direction.
- **After, with touch or pen:** the same works when all five City spaces fit without horizontal scrolling. Vertical page scroll still works. When the row scrolls, touch and pen keep native scrolling and tap-to-fight.
- **What a stroke never does:**
  - fight a villain the Fight button would not allow;
  - use Excessive Violence;
  - fight a card it did not fully cross.
- **Taps:** a press that moves less than 8 px (mouse) or 16 px (touch or pen, inside the browser's tap slop) is an ordinary click. A mouse press that drags more than 8 px inside one tile no longer clicks, and it fights nothing because it never crossed the tile.
- **Settings:** a "Slash to fight" toggle sits beside Effect Intensity. It defaults on and is remembered per browser.
- **Rules:** none change. The engine validates every fight, and the client submits the same `fightVillain` intent a click does.

---

## Assumes

Verify each before coding. If any is false, STOP and reconcile.

1. **WP-755 has executed and merged** (#2354, `0edc27ab`; verified against the shipped code at draft time). `VfxOverlay.vue` has:
   - the `play-vfx-slice-layer` container;
   - the slice beat driven by `useVillainSlashVfxSignal()` (`VillainSlashVfxEvent { seq, citySpace, playerId, imageUrl }`);
   - the slice angle chosen by `seq % 4` from `vfx/villainSlashVfxManifest.ts`;
   - the `slice` identifier stem;
   - the streak element `play-vfx-slice-streak`, rotated by an inline `rotate(<angleDeg>deg)` (the Scope H `VfxOverlay.test.ts` observable);
   - `vfx/villainSlashVfxManifest.ts` exporting the streak colours as `VILLAIN_SLASH_VFX.streakCoreColor` (`#ffffff`) and `VILLAIN_SLASH_VFX.streakGlowColor` (`#d6c2ff`), which the blade trail imports;
   - `splitCardAlongCut` / `buildHalfKeyframes` accepting any `angleDeg`, including 90° and 180°, without NaN. WP-755 ships only `[-28, 22, -16, 34]`, but a stroke hint can be any angle. The shipped split is a normal-vector half-plane clip with no `tan`, so it is angle-safe;
   - the angle is chosen in `renderSlicePieces` (`VfxOverlay.vue:907`), which `renderVillainSlash` (`:926`) calls only after the particles gate (`:942`) and `locateSliceBox`. This WP makes `const hintAngle = useSliceAngleHints().take(event.citySpace)` the **FIRST line of `renderVillainSlash`**, before any gate, and threads `hintAngle ?? villainSlashAngleForSeq(event.seq)` into `renderSlicePieces` as a new `angleDeg` parameter. Never `take` at the angle-selection site: it runs after the gate, so an `off`/reduced-motion/missing-element beat would leak the hint;
   - `wiki/visual-effects.md` carrying WP-755's "Shipped — the villain slash" section, which Scope G links from.

   If WP-755's shipped names differ from its WP, use the shipped names and note that in the session.
   - WP-755's producer (`useVillainSlashVfx`) watcher and its `VfxOverlay` signal watcher both use the default `pre` flush. That way the slice beat `take`s a hint before this WP's post-flush confirm-drop. If either is `post`/`sync`-ordered after the chain, STOP.
2. **`CityRow.vue` (`components/play/CityRow.vue`) is as follows:**
   - Each occupied space renders as
     `<button data-testid="play-city-villain" :data-city-index :data-card-id="cell.card.extId" :disabled="!gateForCell(cell).allowed" @click="onFight(cell.cityIndex)">`
     inside `<ol class="city-spaces">` (`:147-207`).
   - `gateForCell` is the single stage→cost fight gate (EC-132 §3).
   - `onFight(cityIndex)` calls `props.submitMove('fightVillain', { cityIndex })` (`:102-104`).
   - `.city-spaces` is `overflow-x: auto` (`:290-297`).
   - Villain art is an `<img>` in `CardTile.vue:99`, draggable by default.
   - `gateForCell` (`:87-100`) calls `useTurnActions(currentStage, isViewerTurn)` (`:94`). `PlayDesktop.vue:867` and `PlayMobile.vue:567` pass `isViewerTurn`. **When it is false, every tile is refused**, so a non-active viewer's stroke submits nothing. This WP depends on that, and a test pins it.
   - On mobile, `CityRow` sits inside `.play-mobile__band--scroll-x` (`PlayMobile.vue:559`, `overflow-x: auto` at `:1024-1026`), an **ancestor horizontal scroller**.
   - Disabled `<button>`s: some engines may not deliver `pointerdown`/`pointermove` to ancestors from a disabled form control (historically Firefox/Safari; unverified today). Accepted degradation: a stroke that **starts** on a disabled tile may not begin there, and taps are unaffected. `pointer-events: none` on disabled tiles is forbidden, because it would kill the tooltips.
3. **Engine and submit behaviour:**
   - Every `fightVillain` reject path returns before any mutation (`fightVillain.ts:118-233`, including the block-all pending guards). A rejected fight leaves `city.spaces` unchanged.
   - A successful fight nulls the fought card's space (`:338`).
   - Villain `extId`s are per-copy (`villainDeck.setup.ts:218-248`).
   - So **the in-flight card's departure from `city.spaces` ⇔ that fight succeeded**.
   - Fight effects may also **add** villains and **remove** others. Endless Armies of HYDRA plays more Villain Deck cards (`fightVillain.ts:479-494`). A full-City push escapes space 4 (`city.logic.ts:78-84`). Twists or strikes can change the City.
   - The Pinia `uiState` store replaces the snapshot wholesale on every frame (`stores/uiState.ts:35-36`, `setSnapshot`), so a non-deep `watch(city)` fires once per frame even when the City is unchanged. The rejection detector depends on this.
   - `submitMove` calls `client.moves[name](...)` with an ack watchdog (`bgioClient.ts:648-654`, `MOVE_ACK_TIMEOUT_MS` 4000). **When no frame arrives within 4000 ms, the watchdog calls `resync()`, which delivers a fresh snapshot.** There is no client-side queue, so two unconfirmed submits share a stale `_stateID` (`:82-92`). The client runs with `client: false` (`game.ts:525`), so there are no optimistic frames.
4. **Client cost gating uses printed cost.** `useCardCostGating(...).canFight` gates on printed `display.cost` (`useCardCostGating.ts:80-91`), not the engine's `fightCost`. WP-750 (reserved) corrects that. This WP reuses `gateForCell` unchanged and inherits the correction.
5. **Settings singletons.** `useEffectIntensity()` is a module-level singleton persisted to `localStorage`. It uses corruption-safe reads, a try/catch write, and a test reset helper (`effectIntensity.ts:149`). `AudioControls.vue` hosts its toggle (`data-testid="vfx-intensity-toggle"`, `:156`). `useEffectIntensity().shouldRender(kind)` (`effectIntensity.ts:119`) gates the trail on `'particles'`, as `VfxOverlay.vue:381` already does. `VfxOverlay.vue` has an existing `@media (prefers-reduced-motion: reduce)` block (`:1434`, with the WP-755 slice-layer hide at `:1536`).
6. **jsdom limits (24.1.3).** jsdom has:
   - no `PointerEvent`;
   - no `setPointerCapture`;
   - no `ResizeObserver`;
   - no `requestAnimationFrame` (`jsdom-setup.ts:41` does not set `pretendToBeVisual`);
   - zero rects.

   `mock.timers.enable({ apis: ['setTimeout'] })` has precedent (`bgioClient.test.ts:261`).
   - `MouseEvent` is not an installed global (`testing/jsdom-setup.ts:51-82`), so tests use `new window.MouseEvent(...)` (as `SkinSelector.test.ts:96` does).
   - `scrollWidth` and `clientWidth` are both 0, so without stubs every row "fits". Fit tests stub these properties deliberately.
7. **The D-24365 subsurface is `src/vfx/**` + `components/play/VfxOverlay.vue`** (`docs/ai/REFERENCE/02-CODE-CATEGORIES.md:320-330`).
   - Client code outside it must not call `performance.now()` / `Date.now()` / `Math.random()`.
   - The gesture therefore uses no clock: the hit rule is geometric, and the per-target timeout is a `setTimeout` (scheduling, not a clock read).
   - The gesture's only clock read is the trail fade stamp inside `VfxOverlay.vue`. WP-755 has its own read there.
8. **ewiki anchor.** `wiki/visual-effects.md` has `### Card-interaction & hand feel` (`{#card-interaction-feel}`, `:974`), the parent of the new Scope G subsection.

---

## Context (Read First)

**Authoritative references (P6-53):**
- WP-755 + EC-792 (the slice beat contract).
- `vfx/effectIntensity.ts` (the singleton pattern).
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:320-330` (the D-24365 subsurface).
- `CityRow.vue` `gateForCell` (EC-132 §3).
- `bgioClient.ts` `submitMove` and the ack watchdog.
- `docs/ai/DECISIONS.md`: scan D-24365, D-24584, D-24026, D-24561, D-10008 (`client: false`) and D-6512.
- `.claude/rules/architecture.md` §Import Rules, the `apps/arena-client` row (the Runtime-Safe `.` surface; `import type` only for `UICityState`).

**Why a full-crossing rule, not contact or speed.**
- A contact rule fights a villain the moment the pointer touches it, so any press-and-drag that starts on a tile would spend attack.
- A speed rule needs a clock.
- The rule used here: a tile counts as crossed only when the stroke **began outside it**, entered it, and later left it. That is deliberate by construction, needs no time, and is easy to test.

**Why the chain waits for the engine: it skips on rejection, and abandons only when no frame arrives.**

One stroke can cross several villains, and each fight is its own move. Two unconfirmed submits share a stale `_stateID` (Assumes #3), so fights are sent one at a time:

1. Queue the crossed cards by **`extId`**, never by index.
2. Submit the first.
3. Wait until that `extId` has left `city.spaces`.
4. Re-resolve the next target's current index by `extId`. **Skip** it if it is absent (defeated, escaped by a push, or otherwise gone) or if `gateForCell` now refuses it. Otherwise submit it.

**Detecting a rejection.** The chain reads the first new `city()` snapshot after a submit. The store replaces the snapshot wholesale each frame. If that snapshot still holds the in-flight `extId`, the engine rejected the fight. Guard, Patrol and defeat requirements are all invisible to `gateForCell`, and so is a pending choice opened by the previous fight. The chain then **skips that target immediately and continues**. A rejected move is a no-op, so continuing is safe. Because every rejection resolves within one round-trip, the remaining targets are all tried and rejected long before a human resolves a prompt, so no fight fires after the prompt closes.

**Backstop timeout.** If **no** new snapshot arrives within `TARGET_CONFIRM_TIMEOUT_MS` (**3000 ms**), the chain **abandons** its remaining targets rather than skipping. This covers a dropped move that produces no frame. The timeout must stay **below** the 4000 ms ack window. Otherwise the watchdog's `resync()` frame would arrive first, read as a rejection, and trigger a late submit. Abandoning never submits, so nothing is ever sent late.

**Hint cleanup.** A target's angle hint is dropped when that target is skipped, abandoned, or **confirmed**. On confirm, the drop runs in a `flush: 'post'` step after the slice beat has already `take`n it, so it is a no-op when the beat consumed the hint and a cleanup when it did not (coalesced frames, unmounted overlay). Every hint the chain still holds is also dropped on scope dispose. The client never predicts rejections; the engine owns truth.

**Clicks during a chain.** While a chain submit is in flight, a manual click on a `play-city-villain` tile is ignored, via the same capture-phase click listener. The Excessive Violence button's click always passes through. Two unconfirmed submits would race on `_stateID`. The window is bounded by the confirming snapshot or the 3000 ms backstop.

**Why taps are not broken.** Pointer capture retargets `click`, so:
- The gesture only calls `setPointerCapture` after the pointer has moved the start distance: 8 px for mouse, 16 px for touch or pen (inside the ~15 px browser tap slop, so sloppy taps still click).
- After a completed gesture it arms a one-shot click suppression.
- That suppression is **cleared** on the next `pointerdown` or `keydown`, and by a `setTimeout(0)` after `pointerup`. A mouse `click` dispatches in the same task as its `pointerup`, so it is still caught. A touch stroke fires no `click`, so an armed flag can never eat a later tap.
- A row `dragstart` listener calls `preventDefault()` whenever the setting is on. Otherwise Chrome's native image drag, whose threshold is below 8 px, would cancel the stroke. Preventing `dragstart` does not cancel `click`.

**Why touch and pen work only when the row fits.** `.city-spaces` scrolls horizontally, so a finger stroke across it is a scroll today, and a pen on a touchscreen honours `touch-action` the same way.
- The row gets `city-spaces--gesture-touch` (with `touch-action: pan-y`) **only while all three hold**:
  - the setting is on;
  - the row's own `scrollWidth <= clientWidth + 1`, AND every horizontally scrollable ancestor up to the root has `scrollWidth <= clientWidth + 1`, AND the row's horizontal extent fits within `window.innerWidth` (horizontal-only and position-independent: vertical scroll position never matters).

  The ancestor condition matters on mobile, where `.play-mobile__band--scroll-x` scrolls the whole band. Without it, a row that "fits" its own box could still block the band's horizontal pan.
- The fit is measured once on mount, then re-measured by a `ResizeObserver`, after every `city` change, and on window resize, because `scrollWidth` changes with content while the box does not.
- Separately, `city-spaces--gesture` (with `user-select: none`) is present whenever the setting is on, so mouse strokes never select label text, even on a scrolling row.
- `pan-y` keeps vertical page scroll on mobile.
- Mouse strokes never scroll the row, so the mouse always gets the gesture while the setting is on.

**Stroke lifecycle.**
- Samples are `clientX`/`clientY`, the same space as `getBoundingClientRect` and the fixed overlay.
- Crossings join the chain **as they complete, mid-stroke**, so the first fight fires while the finger is still moving.
- `pointerup` ends the stroke and arms click suppression (mouse only matters).
- `pointercancel` (for example, the browser taking a vertical pan under `pan-y`) ends the stroke: already-completed crossings are kept, `isStrokeEnd` is published, and **no** suppression is armed.
- An appended stroke skips `extId`s that are already queued or in flight.

**Why the trail lives on the overlay.** `CityRow` owns the input, but the trail must draw above everything without intercepting input.
- The gesture publishes points to a module signal.
- `VfxOverlay` (click-through) renders them as one template-owned SVG `<path>` and fades the tail with its exempt clock.
- The confetti canvas is untouched.

**Why the slash follows the stroke.** When the gesture submits a fight, it publishes an **angle hint** `{ citySpace, extId, angleDeg }` into a per-space FIFO. The chain drops a target's hint when it skips or abandons that target.
- The WP-755 slice beat always consumes the oldest hint for its `citySpace` **first**, before any intensity or element gate, so a hint can never go stale and leak into a later click-fight.
- It uses the hint's angle when one exists, and otherwise uses the `seq` angle.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control flow, descriptive names, `// why:` comments, small functions, no nested ternaries, no `import *` / barrel re-exports).
- **Engine owns truth:**
  - The gesture submits only `fightVillain` with `{ cityIndex }` (never `useExcessiveViolence`).
  - Submits are sent one at a time, each gated by the unchanged `gateForCell`.
  - No client-side rule logic, no outcome prediction.
- **Layer boundary:** arena-client only.
  - No `packages/**` change.
  - Engine **types** only.
  - No registry, server, preplan or `pg` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24585) before coding. One WP per session.

**Packet-specific:**
- No `performance.now()` / `Date.now()` / `Math.random()` outside `src/vfx/**` and `VfxOverlay.vue`.
- These behave exactly as before: tap-to-fight, disabled tooltips, the Excessive Violence button, and the captured-card area.
- **With the setting off, `CityRow` is byte-identical to today:**
  - no capture;
  - no `dragstart` prevention;
  - no gesture or touch class;
  - no click suppression.
- The blade trail renders only when `shouldRender('particles')`. The fight never depends on the VFX.
- New `VfxOverlay.vue` identifiers use the `blade` stem (trail) or the WP-755 `slice` stem (hints). WP-746's `slash*` identifiers are never touched.

---

## Locked Values

EC-793 copies these verbatim. The WP wins on conflict.

**Thresholds**
- `GESTURE_START_DISTANCE_PX`: mouse **8**, touch or pen **16**. The movement before a press becomes a gesture.
- `TARGET_CONFIRM_TIMEOUT_MS = 3000`: if **no** new `city()` snapshot arrives by then, abandon the remaining targets. Must be **less than** `MOVE_ACK_TIMEOUT_MS` (4000).

**Hit rule**
- A villain tile is **crossed** when the stroke polyline, which began outside that tile's rect, enters the rect and later has a sample outside it.
- Candidates are the tiles whose `gateForCityIndex(i)` is true at gesture start. Their rects come from the `[data-testid="play-city-villain"][data-city-index="i"]` button, measured once at gesture start.
- Each tile is crossed at most once per stroke.
- At gesture start the crossing state is created from the `pointerdown` point, and the down→current segment is advanced immediately, so an entry during the start distance is not lost.
- Samples are `clientX`/`clientY`. Crossings are queued as they complete, mid-stroke.
- `angleDeg = strokeAngleDeg(entry point, completing sample)`, in screen convention (y down, clockwise positive).

**Pointers**
- `mouse`: primary button only.
- `touch` and `pen`: only while the row has `city-spaces--gesture-touch`.
- The class is present iff the setting is on AND the row fits: the row's own `scrollWidth <= clientWidth + 1`, AND every horizontally scrollable ancestor up to the root has `scrollWidth <= clientWidth + 1`, AND the row's horizontal extent fits within `window.innerWidth` (horizontal-only and position-independent: vertical scroll position never matters). The fit is measured once on mount, then re-measured on `ResizeObserver`, after each `city` change (`flush: 'post'`), and on window `resize`. Without a `ResizeObserver`, the other triggers still apply.
- `city-spaces--gesture-touch` sets `touch-action: pan-y`. `city-spaces--gesture` (present iff the setting is on) sets `user-select: none`.
- A second `pointerId` is ignored while a stroke is active.

**Click and drag**
- One-shot click suppression is armed only after a gesture started.
- It is cleared on the next `pointerdown` or `keydown`, or by `setTimeout(0)` after `pointerup`. `pointercancel` never arms it.
- A row `dragstart` listener calls `preventDefault()` whenever the setting is on.
- While a chain submit is in flight, `play-city-villain` clicks are suppressed. The EV button click passes through.
- The adapter never references the `PointerEvent` global (no `instanceof`). It reads `pointerType`/`pointerId`/`button`/`clientX`/`clientY` off the event object.

**Chain**
- The queue holds `extId`s in crossing order.
- Before each submit, re-resolve the target's `cityIndex` by `extId`. Skip it if it is absent or `gateForCell` refuses it. Otherwise call `submitFight(i)`.
- After a submit, the first new `city()` snapshot decides:
  - the in-flight `extId` is gone → confirmed, advance;
  - it is still present → rejected, skip immediately and advance.
- The chain's `watch(city)` uses `flush: 'post'`.
- If no snapshot arrives within 3000 ms, abandon the rest.
- Skipping, abandoning or confirming a target drops its hint (the confirm drop runs post-flush). Scope dispose drops all of the chain's hints.
- A new stroke during a running chain appends, skipping `extId`s already queued or in flight.

**Blade trail**
- Life: `BLADE_TRAIL_LIFE_MS = 170`.
- Max width: 14 px (10 px when the viewport is narrower than 600 px).
- Max points: 64.
- Core and glow colours are **imported** from `vfx/villainSlashVfxManifest.ts` (the WP-755 streak colours). Do not re-literalise them.
- Each sample is stamped with `performance.now()` in `VfxOverlay.vue`, with the watcher on `flush: 'sync'` so batched samples are all kept.
- `bladeTrailPath` is recomputed inside that sample watcher as well as on rAF ticks, so it is correct without rAF (jsdom).

**Angle hint**
- A per-`citySpace` FIFO of `{ extId, angleDeg }`, pushed on each gesture submit.
- `take(citySpace)` returns and removes the oldest entry's `angleDeg`, or `null`.
- The chain calls the internal `drop(citySpace, extId)` when it confirms (post-flush), skips or abandons that target. Scope dispose drops all of the chain's hints.
- The slice beat calls `take` as its first step, unconditionally.

**Setting:** `localStorage` key `arenaClientSlashGesture`, values `'on' | 'off'`, default `'on'`.

**DOM ids:**
- Test ids: `play-vfx-blade-trail` (the SVG path) and `slash-gesture-toggle` (with `aria-pressed`).
- Classes: `city-spaces--gesture` and `city-spaces--gesture-touch`.

---

## Scope (In)

### A) `apps/arena-client/src/lib/slashGestureGeometry.ts` (**new**)
Pure helpers — no DOM, no Vue, no clock:
- `segmentIntersectsRect(from, to, rect): boolean` (Liang–Barsky)
- `isPointInRect(point, rect): boolean`
- `createCrossingState(tiles: { extId: string; rect: Rect }[], start: Point): CrossingState`. Tiles containing `start` are ineligible.
- `advanceCrossingState(state, from, to): { state: CrossingState; crossed: { extId: string; angleDeg: number }[] }`
  - Returns the crossings that **completed** on this segment, in completion order.
  - A segment that passes fully through a tile completes it.
  - The state records each tile's entry point, and `angleDeg` is measured from entry to completion.
- `strokeAngleDeg(from, to): number`
- `distanceBetween(a, b): number`

### B) `apps/arena-client/src/composables/useSlashGesture.ts` (**new**)

`useSlashGesture({ rowElement, city, gateForCityIndex, submitFight, isEnabled, capturePointer? })` returns a per-instance controller. Here `city: () => UICityState` (a getter) and `rowElement: Ref<HTMLElement | null>`.

```
{
  handlePointerDown(sample),
  handlePointerMove(sample): { hasStartedGesture: boolean },
  handlePointerUp(sample),
  handlePointerCancel(sample),
  handleKeyDown(),
  shouldSuppressClick(): boolean,
  isGestureEnabled: Ref<boolean>,
  isTouchGestureEnabled: Ref<boolean>
}
```

- `sample = { x, y, pointerType, button, pointerId }`, where `x` and `y` are `clientX` and `clientY`.
- Pointer capture happens through an injectable `capturePointer(pointerId)` option. It defaults to `rowElement.setPointerCapture` when that is a function, and does nothing otherwise.
- The thin DOM adapter wires `pointerdown` / `pointermove` / `pointerup` / `pointercancel` / `keydown` / capture-phase `click` / `dragstart` on the row to these methods.
- The chain `watch`es `city()` with `flush: 'post'`. The first new snapshot after a submit confirms or rejects it. A 3000 ms `setTimeout` is the no-frame backstop, and on expiry it abandons.
- The fit is measured on mount, then on `ResizeObserver` (guarded), a `watch(city, …, { flush: 'post' })`, and window `resize`.
- The controller also returns `isGestureEnabled` (bound to the `city-spaces--gesture` class).
- Everything is cleaned up on scope dispose.

Module-level exports:
- `useBladeTrailSignal(): Ref<BladeTrailSample | null>`, where `BladeTrailSample = { seq, x, y, isStrokeEnd }`.
- `useSliceAngleHints(): { take(citySpace: number): number | null }`, backed by the internal push / drop.
- `__resetSlashGestureSignalsForTests()`.

### C) `apps/arena-client/src/composables/useSlashGestureSetting.ts` (**new**)

`useSlashGestureSetting(): { isEnabled: Ref<boolean>; setEnabled(next: boolean): void }`, plus `__resetSlashGestureSettingForTests()`.
- A module-level singleton persisted under `arenaClientSlashGesture`.
- Reads are corruption-safe: anything but `'off'` means on.
- The write sits in try/catch with a `// why:` comment.
- Mirrors `effectIntensity.ts`.

### D) `apps/arena-client/src/components/play/CityRow.vue` (**modified**)
- Add a template ref on `<ol class="city-spaces">`.
- Create the controller with:
  - `gateForCityIndex` → `gateForCell` of that index's cell;
  - `submitFight` → the existing `onFight`;
  - `isEnabled` → the setting.
- Attach the DOM adapter.
- Bind `city-spaces--gesture` to `isGestureEnabled` and `city-spaces--gesture-touch` to `isTouchGestureEnabled`, each with its CSS.
- Tap-to-fight, the EV button, captured cards and tooltips are unchanged.
- D-6512: new bindings go in the `setup()` return.

### E) `apps/arena-client/src/components/play/VfxOverlay.vue` (**modified**)

**Blade trail**
- Add a template-owned `<svg class="vfx-overlay__blade"><path data-testid="play-vfx-blade-trail" :d="bladeTrailPath" /></svg>`.
- A `flush: 'sync'` watcher on `useBladeTrailSignal` stamps each sample with `performance.now()` (a `// why:` comment cites D-24365), keeps at most 64 points, and drops points older than the life.
- `bladeTrailPath` comes from a new pure exported function `buildBladeTrailPath(points, nowMs, lifeMs, maxWidth): string` — a tapered ribbon, widest at the head, `''` when there are fewer than 2 points.
- A `requestAnimationFrame` fade loop runs only while points remain and only when `requestAnimationFrame` exists. It stops when the trail is empty and on unmount.
- Rendered only when `shouldRender('particles')`.
- The glow comes from a CSS `drop-shadow` on the template-owned element.

**Angle hint**
- The first line of the WP-755 slice-beat handler is `const hintAngle = useSliceAngleHints().take(event.citySpace)`, before any gate.
- The angle is `hintAngle` when it is non-null, and the `seq` angle otherwise.

**Reduced motion:** hide `.vfx-overlay__blade` in the existing `@media (prefers-reduced-motion: reduce)` block.

### F) `apps/arena-client/src/components/play/AudioControls.vue` (**modified**)
A "Slash to fight" toggle (`data-testid="slash-gesture-toggle"`, `aria-pressed`) beside the Effect Intensity control.

### G) ewiki — `wiki/visual-effects.md` (**modified**)
Add a "Slash to fight" subsection under §Card-interaction & hand feel covering:
- the full-crossing rule, the start distance (mouse 8 px, touch/pen 16 px), and the touch/pen fit rule;
- the engine-confirmed skip-and-continue chain;
- the blade trail;
- the angle hint;
- the setting.

Link it from the WP-755 section.

### H) Tests (**new/modified**)

**`slashGestureGeometry.test.ts`**
- Segment/rect: passes through, touches an edge, fully outside, zero-length.
- A stroke starting inside a tile never crosses it.
- Enter then exit completes one crossing. Enter without exit completes none.
- A single segment spanning a tile completes it.
- Completion order across two tiles.
- Each tile completes at most once.
- `angleDeg` is measured from entry to completion.
- `strokeAngleDeg`: right = 0, down = 90, up-left = -135.

**`useSlashGesture.test.ts`** — run inside `effectScope()`, drive the handlers directly, inject `capturePointer`, stub rects, use `mock.timers` (`setTimeout` only), and `await nextTick()` after mutating `city`.

Taps and suppression:
- A < 8 px mouse press never captures and leaves `shouldSuppressClick()` false.
- A 12 px touch or pen press on a fitting row never captures and arms no suppression.
- A 12 px touch press inside a tile behaves as a tap: no gesture, no suppression.
- A mouse gesture arms suppression, and the following click is suppressed once.
- A touch gesture with no trailing click does not suppress the next tap (cleared by `setTimeout(0)` or the next `pointerdown`).

Chain:
- A stroke across two enabled tiles submits the first, then submits the second only after the first `extId` leaves `city`.
- After an index shift (a HYDRA insert), the second target is re-resolved by `extId`.
- A queued target that is gone (escaped) is skipped.
- A target gated before its turn is skipped.
- A rejected submit (the next `city` snapshot still holds the `extId`) skips immediately, without waiting for the timer, and drops its hint.
- A pending-choice-style sequence (A confirmed, then B and C rejected on their next snapshots) submits nothing further once the chain ends.
- No snapshot within 3000 ms abandons the remaining targets and drops their hints.
- A new stroke during a running chain appends, and a duplicate `extId` is not re-queued.
- A snapshot that arrives after 3000 ms (the chain already abandoned) submits nothing.
- `pointercancel` after one completed crossing produces one submit and no suppression.
- With the viewer not on turn (`gateForCityIndex` refuses all), a stroke submits nothing.
- A tile click while a chain submit is in flight is suppressed. An EV-button click is not.
- A confirmed gesture fight still gets its hint angle in the slice, which proves the confirm-drop runs after the beat's `take`.
- A confirmed target's leftover hint is dropped post-flush, and scope dispose drops all hints.
- Every submit is `{ cityIndex }` only.

Pointers and setting:
- Touch and pen are ignored unless `isTouchGestureEnabled`.
- A second `pointerId` is ignored.
- With the setting off: no gesture, and both `isGestureEnabled` and `isTouchGestureEnabled` stay false.
- The fit is measured on mount.
- A row with a horizontally scrollable ancestor (stubbed `scrollWidth > clientWidth`) does not get the touch class. The same row with a non-scrolling ancestor does.

Signals:
- Trail samples are published.
- Hints are pushed per submit, and `take` is FIFO per space.

**`useSlashGestureSetting.test.ts`**
- Defaults to on.
- `'off'` persists.
- A corrupt value reads as on.
- A throwing `setItem` still updates the ref.

**`CityRow.test.ts`** (modified)
- A `new window.MouseEvent('pointerdown'/'pointermove'/…)` with `pointerType`, `pointerId`, `clientX` and `clientY` added via `defineProperty` drives a stroke across a stubbed tile and calls `submitMove`. The adapter must guard a missing `setPointerCapture`.
- A plain click still fights.
- With the setting off, neither `city-spaces--gesture` nor `city-spaces--gesture-touch` is present, and there is no `dragstart` prevention.
- Existing tests are unchanged.

**`VfxOverlay.test.ts`** (modified)
- Two published samples (with `performance.now` stubbed) render `play-vfx-blade-trail` with a non-empty `d`.
- At `off`, no trail.
- `buildBladeTrailPath` returns `''` for fewer than 2 points and tapers from head to tail.
- A matching hint overrides the `seq` angle exactly once. The observable is the `play-vfx-slice-streak` inline `rotate(<angle>deg)`; reconcile it with WP-755's shipped streak transform under Assumes #1.
- A vertical (90°) hint renders two halves without NaN.
- At `off`, a hint is still consumed, so the next matching event uses the `seq` angle.
- A non-matching hint is ignored.
- The WP-755 and WP-746 tests are unchanged.

**`AudioControls.test.ts`** (modified)
- The toggle renders.
- Clicking it flips `aria-pressed`.
- The setting persists.

---

## Out of Scope

- **Engine, registry, server:** no change. No new move, no multi-fight move, no new notable event.
- **Mastermind:** fighting the Mastermind by gesture is a follow-up (a different component).
- **Excessive Violence:** strokes never use it. The WP-738 EV button is unchanged.
- **HQ:** recruiting heroes by gesture is out.
- **Keyboard and screen readers:** no gesture equivalent. Click and keyboard activation of Fight remain the accessible path.
- **Scrolling City row:** a long-press-to-slash mode for touch and pen is a named follow-up.
- **Client fight-cost gate:** correcting it is WP-750.

---

## Files Expected to Change

- `apps/arena-client/src/lib/slashGestureGeometry.ts` (new)
- `apps/arena-client/src/lib/slashGestureGeometry.test.ts` (new)
- `apps/arena-client/src/composables/useSlashGesture.ts` (new)
- `apps/arena-client/src/composables/useSlashGesture.test.ts` (new)
- `apps/arena-client/src/composables/useSlashGestureSetting.ts` (new)
- `apps/arena-client/src/composables/useSlashGestureSetting.test.ts` (new)
- `apps/arena-client/src/components/play/CityRow.vue` (modified)
- `apps/arena-client/src/components/play/CityRow.test.ts` (modified)
- `apps/arena-client/src/components/play/VfxOverlay.vue` (modified)
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` (modified)
- `apps/arena-client/src/components/play/AudioControls.vue` (modified)
- `apps/arena-client/src/components/play/AudioControls.test.ts` (modified)
- `wiki/visual-effects.md` (modified)

Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24585), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

> 13 files in one layer (arena-client) plus one ewiki page. That is over the ~8 guideline because an input feature has three independent tested parts (the geometry, the gesture + chain, the setting), and three host components (the input row, the overlay, the settings bar). Not Lightweight-Lane eligible (more than 4 code/test files).

---

## Contract

- `slashGestureGeometry.ts`: the signatures in Scope §A. `Point = { x: number; y: number }`, `Rect = { left: number; top: number; width: number; height: number }`.
- `useSlashGesture(options)`: returns the Scope §B controller. Also exported: `useBladeTrailSignal()`, `useSliceAngleHints()`, `__resetSlashGestureSignalsForTests()`.
- `useSlashGestureSetting(): { isEnabled: Ref<boolean>; setEnabled(next: boolean): void }`, plus `__resetSlashGestureSettingForTests()`.
- `buildBladeTrailPath(points: { x: number; y: number; atMs: number }[], nowMs: number, lifeMs: number, maxWidth: number): string`, exported pure from `VfxOverlay.vue`.
- DOM contract:
  - `play-vfx-blade-trail` and `slash-gesture-toggle`;
  - `city-spaces--gesture` and `city-spaces--gesture-touch`;
  - the `localStorage` key `arenaClientSlashGesture`.
- Move contract, unchanged: `fightVillain({ cityIndex })` only.

---

## Vision Alignment

**Vision clauses touched:**
- §8 / §22 — determinism, replay-faithful behaviour.
- §17 — accessibility & inclusivity: the tap path is unchanged, the gesture can be switched off, and the trail honours reduced motion and effect intensity.
- NG-1 — no pay-to-win.

**Conflict assertion:** No conflict. This WP preserves all touched clauses.

**Non-Goal proximity check:** NG-1..7 are not crossed. The gesture is a faster way to send the fight intent a click sends. It grants no advantage, costs nothing, and cannot fight anything a click could not. The engine validates every move.

**Determinism preservation:**
- The engine is untouched, so `finalStateHash`, `PRE_WP080_HASH` and replays are unaffected.
- Moves are submitted one at a time and confirmed from projected state, so the replay log records ordinary `fightVillain` moves.
- The gesture's only clock read (the trail stamp) lives in the D-24365 subsurface.

**Product note for the operator.** The gesture defaults on, and a completed stroke spends attack just as clicks would. The full-crossing rule makes an accidental stroke unlikely, and the toggle turns the gesture off. Flipping the default to off is a one-line change to the default value in `useSlashGestureSetting.ts`, recorded in D-24585.

## Funding Surface Gate

§20 **N/A**: this is play-board input and presentation. It touches no funding affordance, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface is added, changed or removed.

---

## Acceptance Criteria

1. **Taps.** A press that moves less than 8 px (mouse) or 16 px (touch or pen) fights exactly as a click does today. There is no capture, and no suppression is ever armed. After a touch stroke, the next tap still fights.
2. **Single crossing.** A mouse stroke that fully crosses one enabled villain tile submits exactly one `fightVillain({ cityIndex })` for it.
   - A stroke that starts inside a tile submits nothing for it.
   - So does a stroke that enters a tile without leaving.
   - Tiles disabled at gesture start are never submitted.
3. **Chain.** A stroke crossing two or more enabled villains submits them one at a time, in crossing order.
   - Each next submit waits for the first new `city` snapshot after the previous submit. Departure means confirmed. Still present means rejected, and the target is skipped immediately.
   - With no snapshot in 3000 ms (below the 4000 ms ack window), the rest are abandoned. Nothing is ever submitted after the abandon.
   - Each target is re-resolved by `extId` and re-gated. It is skipped when it is absent or refused.
   - No fight is ever submitted after a rejection has resolved a pending prompt's window.
   - Skipped or abandoned targets leave no hint behind.
4. **Touch and pen.** A touch or pen stroke starts a gesture only while the row has `city-spaces--gesture-touch` (setting on and row fits). The fit re-measures when the City content changes. Otherwise native scroll and taps behave as today. Vertical page scroll works while the class is on.
5. **Setting off.** With "Slash to fight" off, `CityRow` behaves byte-identically to today. The toggle persists and defaults on.
6. **Trail.** At `low`/`full` intensity, the blade trail renders under the pointer and fades out within `BLADE_TRAIL_LIFE_MS` (170 ms) of the last sample. At `off` or under reduced motion, no trail renders, and fights still happen.
7. **Angle.** A gesture-driven fight's WP-755 slice uses the stroke angle, including vertical strokes. No hint outlives its target's confirming frame, skip, abandon, or the controller's disposal. A click-driven fight keeps the `seq` angle.
8. **No regressions.**
   - The EV button, captured cards and tooltips are unchanged.
   - The WP-746 and WP-755 beats are unchanged.
   - All existing tests are unchanged.
   - No `packages/**` file changes.
9. **Checks.** `pnpm --filter @legendary-arena/arena-client typecheck` and `test` pass, and `pnpm -r build && pnpm -r --no-bail test` passes.

---

## Verification Steps

```bash
# 1) arena-client
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; new/modified suites pass; full suite 0 fail

# 2) Client-only diff
git diff --name-only origin/main...HEAD
# Expected: only §Files Expected to Change (+ governance at close); no packages/** path

# 3) Whole repo
pnpm -r build && pnpm -r --no-bail test
# Expected: every package builds; all packages 0 fail

# 4) Preview drive, desktop:
#    - a click fights, with no trail
#    - a stroke across two affordable villains fights both in order, trail visible,
#      slices follow the stroke
#    - a drag starting ON a villain art and released on it does not fight (and does not ghost-drag)
#    - setting off, then repeat the stroke: nothing
#    Mobile viewport:
#    - when the row scrolls, a finger drag scrolls
#    - when it fits, a finger stroke fights and vertical page scroll still works

# 5) Live (operator-manual, post-deploy, D-24026): on play.legendary-arena.com, slash across two affordable villains
#    and observe: both are fought in crossing order, the blade trail follows the stroke, and each slice follows the stroke angle.
```

---

## Definition of Done

- [ ] All Acceptance Criteria are met.
- [ ] No `packages/**` change, and no files outside `## Files Expected to Change` except the governance ledgers.
- [ ] arena-client typecheck reports 0 errors, and `pnpm -r build && pnpm -r --no-bail test` is green.
- [ ] The preview drive (Verification step 4) is recorded with screenshots.
- [ ] The ewiki section is published.
- [ ] Governance is closed out:
  - `docs/ai/STATUS.md` has a dated `### WP-756 (YYYY-MM-DD)` heading.
  - D-24585 is appended to `DECISIONS.md`.
  - The `WORK_INDEX.md` WP-756 row is `[x]`.
  - The `EC_INDEX.md` EC-793 row is Done.
  - The mindmap node is ✅, followed by `pnpm roadmap:counts:write`.
- [ ] Two-commit topology: an `EC-793:` implementation commit plus a `SPEC:` close. **No commit subject or PR title contains "swipe".**
- [ ] D-24026 live-verify is recorded as operator-manual-pending until confirmed.

---

## Reserved Decision (lands at execution)

**D-24585 — slash-gesture-fight.** Locks:
- the full-crossing hit rule (no clock);
- the cleared-on-next-input one-shot click suppression;
- early `dragstart` prevention;
- the engine-confirmed, `extId`-keyed chain: skip immediately on a rejecting snapshot; abandon on a 3000 ms no-frame backstop (below the 4000 ms ack window, so a resync can never trigger a late submit); dedupe on append; clicks suppressed while a submit is in flight; hints dropped on confirm, skip, abandon and dispose;
- an accepted degradation: an Excessive Violence click during an in-flight chain submit can race it on `_stateID`. This is harmless because the rejection check skips a target that is still present, and a departure caused by the EV fight reads as a confirm;
- the per-pointer start distance (mouse 8, touch/pen 16) and the stroke lifecycle (mid-stroke queueing, cancel keeps completed crossings);
- the horizontal-only, position-independent touch fit (row plus every horizontally scrollable ancestor plus `innerWidth`);
- the touch/pen rule: only when the setting is on and the row fits, re-measured on content change, with `pan-y`;
- the template-owned SVG blade trail, whose stamp is the gesture's only clock read (inside the D-24365 subsurface);
- the per-space FIFO angle hint, consumed first and unconditionally;
- the persisted default-on setting, and the operator's option to flip that default.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL on 3 items, fixed in this revision.**
- **§3:** the body relied on things that `## Assumes` did not list:
  - WP-755's `play-vfx-slice-streak` `rotate()` observable;
  - its manifest streak-colour exports;
  - its split geometry being safe at any angle (90°/180°, which previously only the EC checked);
  - its ewiki section, which Scope G links from;
  - `shouldRender('particles')` and the existing reduced-motion block in `VfxOverlay.vue`;
  - the `wiki/visual-effects.md:974` §Card-interaction anchor;
  - the wholesale snapshot replace (`stores/uiState.ts:35-36`) that the rejection detector depends on.

  Three references were also wrong:
  - `gateForCell` is at `:87-100` (not `:82-95`);
  - the click binding is `onFight(cell.cityIndex)`;
  - the timer precedent is `mock.timers.enable(...)`.

  **FIXED** (Assumes #1, #2, #3, #5, #6 and new #8).
- **§13:** Verification step 3 had no expected output, and step 5 named no observable. **FIXED.**
- **§16.3:** `handlePointerMove` returned `{ didStartGesture }`; boolean names must start with
  `is`/`has`/`can`. **FIXED**: renamed to `hasStartedGesture` in the WP and EC-793.

Both advisories were also taken:
- `DECISIONS.md` and the `.claude/rules/architecture.md` arena-client import row are added to
  Context.
- AC-6 now cites `BLADE_TRAIL_LIFE_MS` instead of "about 170 ms".

**Post-fix: PASS.**
- **§1:** all sections present and non-empty; 7 Out-of-Scope exclusions.
- **§2:** engine-wide boilerplate (full files, no diffs, ESM, Node v22+, 00.6), packet-specific
  rules, the session protocol, and a §Locked Values block the EC copies verbatim.
- **§3/§4:** dependencies and context are specific, and every line reference was checked against
  the repo.
- **§5:** 13 files, over the ~8 guideline. Justified in the note under Files: three independently
  tested parts plus three host components.
- **§6:** `fightVillain({ cityIndex })`, the test ids and the classes are consistent. The
  `blade` / `slice` stems avoid WP-746's `slash*` identifiers.
- **§7:** no new dependency.
- **§8:** client-only. The engine is consumed via `import type`. `gateForCell` and
  `submitMove` are reused unchanged. The one `performance.now()` read is inside the D-24365
  subsurface.
- **§9:** pnpm/git only.
- **§10:** no env vars.
- **§11:** N/A (no auth).
- **§12:** `node:test` + jsdom; no boardgame.io, network or DB; `setTimeout`-only mock timers;
  no deck construction.
- **§13:** exact pnpm commands with expected output, plus the preview drive and the D-24026 manual
  live check.
- **§14:** nine binary, observable ACs aligned to Scope A–H.
- **§15:** STATUS, DECISIONS (D-24585), WORK_INDEX, EC_INDEX, mindmap and the scope-boundary check
  are covered. The D-24026 live-verify is recorded, not claimed.
- **§16:** human-style code is referenced, with a pure geometry module and the D-6512 `setup()`
  return; booleans use `is`/`has`/`can`.
- **§17:** satisfied (§8 / §17 / §22 / NG-1, no conflict, NG proximity, determinism line).
- **§18:** N/A (no literal-string grep).
- **§19:** N/A (commit-time rule).
- **§20:** N/A (no funding affordance, copy or channel).
- **§21:** N/A (no HTTP endpoint and no `apps/server/src/**` library surface).

## Gate Record

**Copilot check (01.7), round 1: RISK → HOLD.** Eleven findings, all folded into this revision. None changed the allowlist, the layer or the move contract, so no pre-flight re-run was required.
1. The backstop was above the ack window, so a `resync()` frame could cause a late submit. It is now 3000 ms, locked below 4000.
2. The 8 px start broke sloppy touch taps. Touch and pen now use 16 px, and the mouse-drag behaviour change is stated.
3. The stroke lifecycle was unlocked. Now locked: `clientX`/`clientY`, mid-stroke queueing, and cancel semantics.
4. The mobile ancestor scroller defeated the fit. The fit now checks the nearest scrolling ancestor and the viewport.
5. Appends had no dedupe. Appends now skip queued and in-flight `extId`s.
6. Hints could leak. Drops now run on confirm (post-flush) and on dispose, and AC-7 is reworded.
7. jsdom feasibility: `new window.MouseEvent`, no `PointerEvent` global, the path recomputed without rAF, the streak rotate observable, and the 0/0 width stubs.
8. The non-active-seat protection was only implicit. It is now an Assumes item with a test, and clicks are suppressed during an in-flight submit.
9. The chain watcher's flush was unset. It is now `flush: 'post'`.
10. The disabled-tile start degradation is accepted and documented, and `pointer-events: none` is forbidden on disabled tiles.
11. Governance drift: the WORK_INDEX row is resynced; the EC gains the reduced-motion hide and the ewiki DoD line; `capturePointer?` and `city` getter types are locked; the `dragstart` wording is clarified.

**Copilot check (01.7), round 5: PASS → CONFIRM** against the shipped WP-755 code: the `take` site, the streak observable, the colour imports and the pre-flush order are all verified.

**Pre-flight (01.4), round 6: READY TO EXECUTE** (verified against the shipped WP-755). RS-1 applied: the hint `take` site is locked to the first line of `renderVillainSlash`, not `renderSlicePieces`. The reduced-motion line reference is updated.

**WP-755 landed during drafting (#2354).** The Assumes #1 names were reconciled against the shipped code (`VILLAIN_SLASH_VFX.streak*Color`, angle-safe normal-vector split, pre-flush watchers, `villainSlashAngleForSeq`), and the BLOCKED status was lifted.

**Post-lint re-confirms:** pre-flight round 5 READY; copilot round 4 PASS (session prompt checked, no scope added; one prompt wording fix applied).

**Pre-flight (01.4), round 4: READY TO EXECUTE (once WP-755 lands).** Re-confirmed after the copilot edits. Two nits applied: `isGestureEnabled` added to the §B controller block, and the EV-click race recorded as an accepted degradation in D-24585.

**Copilot check (01.7), round 3: PASS → CONFIRM.** All round-2 items are verified in the WP, EC, D-24585 text and WORK_INDEX row. No new findings.

**Copilot check (01.7), round 2: RISK → HOLD.** Three wording and test items, all folded in:
1. The fit rule depended on scroll position with no re-measure on scroll. It is now horizontal-only and position-independent: the row, every horizontally scrollable ancestor, and `innerWidth`.
2. Stale spots:
   - the 8 px wording now reads 8 px mouse / 16 px touch-pen;
   - the hint `drop` wording now includes confirm and dispose;
   - click suppression is locked to `play-city-villain` only, and the EV button passes through.
3. Tests and assumptions:
   - a 12 px touch-tap test;
   - a test that a confirmed fight keeps its hint angle;
   - a WP-755 pre-flush watcher assumption (Assumes #1 and an EC STOP check).

**Pre-flight (01.4), round 3: READY TO EXECUTE (once WP-755 lands).** Three consistency nits applied: the `city-spaces--gesture` class is added to the DOM lists; the setting-off rule and test now cover both classes; the chain heading is reworded.

**Pre-flight (01.4), round 2: NOT READY.** Two new blocking findings, both from the round-1 skip-and-continue switch, plus two clarifications. All are folded in:
- **PS-A:** a skipped target could fight long after a pending prompt closed. Rejection is now detected on the first new snapshot (skip immediately), and the 4500 ms no-frame backstop abandons.
- **PS-B:** skipping left stale hints. Hints now carry `extId` and are dropped on skip or abandon.
- **RS-A:** the fit is measured on mount.
- **RS-B:** `user-select: none` is applied whenever the setting is on, via `city-spaces--gesture`.

**Pre-flight (01.4), round 1: NOT READY.** Six blocking and ten clarifying findings, all folded into this revision. None changed the file list.

Blocking:
- **PS-1:** the click suppression could swallow the next tap after a touch stroke. It is now cleared on the next input or by `setTimeout(0)`.
- **PS-2:** Assumes #3 was false (fight effects can remove other villains). It is corrected, and absent targets are skipped.
- **PS-3:** the touch class now also requires the setting.
- **PS-4:** stale hints. `take` is now the first, unconditional step.
- **PS-5:** `dragstart` is now prevented from `pointerdown`.
- **PS-6:** the fit now re-measures on `city` change and on window resize.

Clarifying:
- **RS-1:** the controller seam is locked (`capturePointer`, `shouldSuppressClick`, `effectScope`).
- **RS-2:** crossing initialisation and the entry→completion angle are locked.
- **RS-3:** a vertical-hint test was added, plus an EC check of WP-755's geometry.
- **RS-4:** hints use a per-space FIFO.
- **RS-5:** test-reset helpers were added.
- **RS-6:** pen follows the touch rule, `pan-y`, a second `pointerId` is ignored, and `user-select: none`.
- **RS-7:** the clock wording is corrected, and colours are imported from the WP-755 manifest.
- **RS-8:** the trail watcher uses `flush: 'sync'`.
- **RS-9:** the chain skips and continues, with a 4500 ms timeout above the ack window. The default-on product note is recorded.
- **RS-10:** governance: authoritative references are listed, the PR title is also covered by the "swipe" rule, and the ledger wording is aligned (the reservation line says "slice layer", while the trail is a separate template-owned SVG on the same overlay).
