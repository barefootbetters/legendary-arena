# EC-798 — Long-press slash: touch / pen slash-to-fight on a scrolling City row (Execution Checklist)

**Source:** docs/ai/work-packets/WP-761-long-press-slash.md
**Layer:** arena-client (`composables/useSlashGesture.ts`, `components/play/CityRow.vue`) + ewiki docs
**Status:** Pending

## Before Starting

- [ ] WP-756 is merged (WORK_INDEX `[x]`) and `useSlashGesture.ts` matches WP-761 Assumes #1 (anchors `:43`, `:93`, `:294`, `:443`, `:448`, `:474`, `:546`). Reconcile any drift against the shipped names; STOP if the chain / hints / suppression shape changed.
- [ ] #2362 is merged: at 375 px the play page does not overflow; only the City row's band scrolls.
- [ ] Read WP-761 in full, then `useSlashGesture.ts` + test and `CityRow.vue` + test. Run `pnpm -r build` and `pnpm --filter @legendary-arena/arena-client typecheck` (exit 0). Baseline: arena-client **2084 / 0** (D-24585 Gates); record the observed count and reconcile any drift before coding.

## Locked Values (verbatim from WP-761 §Locked Values; the WP wins on conflict)

- `LONG_PRESS_ARM_MS = 350`; `LONG_PRESS_MOVE_TOLERANCE_PX = 10`; `LONG_PRESS_VIBRATE_MS = 12` (only when `typeof navigator.vibrate === 'function'`).
- **Eligibility (at `pointerdown` only):** setting on, pointer `touch` or `pen`, no stroke pending or active, `isTouchGestureEnabled` **false**. When true, WP-756's immediate path applies. Mouse never long-presses. A later fit change does not affect a pending or armed long press.
- **Representation:** a `stroke` with `isLongPress: true`; pending = `hasStarted` false + timer; armed = `hasStarted` true. `stroke` stays a plain `let`; `isLongPressArmed` is a `ref` written **only** by `syncLongPressState()` (value always `stroke !== null && stroke.isLongPress && stroke.hasStarted`), called at every stroke change (down, arm, up, cancel, lostpointercapture, >10 px cancel, second-finger cancel, setting / row watch, dispose). `shouldPreventTouchScroll()` reads `stroke` directly. A pending long press never runs `startGesture`.
- **Pending arm:** starts at `pointerdown`; cancelled (stroke nulled, timer cleared, synced) by `pointerup`, `pointercancel`, > 10 px from the down point, a **second `pointerId`**, the setting turning off, or dispose. The cancelling `pointerdown` never starts its own arm. Cancelling never arms suppression.
- **Arm (`armStroke()`, 350 ms):** `hasStarted = true`; capture; `createCrossingState(collectCandidateTiles(), downPoint)`; **one** trail sample at `downPoint`; buzz if supported. Not `startGesture`.
- **Armed stroke:** non-passive row `touchmove` → `preventDefault()` iff `shouldPreventTouchScroll()`; `pointermove` advances as WP-756; a second `pointerId` is **ignored**; `pointerup` completes (arms suppression, publishes `isStrokeEnd`); `pointercancel` keeps completed crossings, arms nothing; `lostpointercapture` does the same **only when `event.target` is the row and the `pointerId` matches an armed long-press stroke** (the child→row capture move bubbles one that must be ignored). Every stroke-nulling path ends the arm.
- **Click suppression (armed path only):** cleared on the next `pointerdown` / `keydown`, not `setTimeout(0)`.
- **Context menu:** the row `contextmenu` listener → `preventDefault()` while a long press is pending or armed.
- **CSS:** `city-spaces--gesture-hold` iff setting on AND the row does not fit — carries `-webkit-touch-callout: none` and gates the long-press listeners. `city-spaces--gesture-armed` iff armed — **inset** glow (`box-shadow: inset` or negative `outline-offset`), no animation under `prefers-reduced-motion`. `city-spaces--gesture` unchanged.
- **Controller additions:** `isLongPressArmed: Readonly<Ref<boolean>>` (`readonly(...)`), `isLongPressHoldEnabled: Readonly<Ref<boolean>>`, `shouldPreventTouchScroll(): boolean`. WP-756 members keep their signatures.

## Guardrails

- **Zero engine change.** No `packages/**`; only `fightVillain({ cityIndex })` via the unchanged chain.
- **Never prevent an unarmed `touchmove`,** and never prevent `touchstart` / `pointerdown` — an unarmed touch must scroll natively. The row must never be left armed without a live stroke.
- **Assumes #2 is a platform premise** verified only on real iOS + Android devices (WP Verification step 5); do not claim it from jsdom or the preview.
- **WP-756 byte-identical** for mouse, touch on a fitting row, taps, and setting off: the `touchmove` / `contextmenu` / `lostpointercapture` listeners and the callout CSS exist only while `isLongPressHoldEnabled`. **One recorded trade:** on a scrolling row a press held ≥ 350 ms is an arm, not a tap.
- **Reuse, don't fork:** chain, hints, trail signal, fit rule and `VfxOverlay.vue` unchanged; click suppression unchanged except the armed-path clearing.
- **No clock** outside `src/vfx/**` + `VfxOverlay.vue`; the arm is a `setTimeout`.
- **No `PointerEvent` / `TouchEvent` globals** (no `instanceof`, no constructors) in code or tests.
- **Commit subjects and PR titles never contain "swipe".**

## Required `// why:` Comments

- The long press as the scroll-safe intent signal (a scroll moves at once, a tap releases at once).
- `touchmove` `preventDefault()` only while armed: `touch-action` is fixed at touch start, and a pan can only be stopped before it begins.
- The non-passive listener option.
- `contextmenu` / `-webkit-touch-callout` suppression during a hold.
- The start-distance waiver at the arm, and measuring candidates at the arm.
- The `navigator.vibrate` feature check.
- `syncLongPressState()` as the only writer of `isLongPressArmed` (a `computed` over the plain `let stroke` would never update), and the row-targeted, `pointerId`-matched `lostpointercapture` check.
- Armed-path click suppression cleared on the next input, not `setTimeout(0)` (the touch `click` can land a task later).
- The `dragstart` prevention now also blocking touch drag-and-drop after a long press.

## Files to Produce

- [ ] `apps/arena-client/src/composables/useSlashGesture.ts` (+ `.test.ts`)
- [ ] `apps/arena-client/src/components/play/CityRow.vue` (+ `.test.ts`)
- [ ] `wiki/visual-effects.md` (new long-press paragraph + amend the "Touch and pen only when the row fits" bullet)

## After Completing

- [ ] arena-client typecheck 0 and tests 0 fail (from the 2084 baseline); `pnpm -r build && pnpm -r --no-bail test` green; no `packages/**` in the diff.
- [ ] All ACs met except the real-device clauses of AC2 / AC3 / AC6 (no scroll while armed, native scroll without start lag, no context menu / callout), recorded operator-manual-pending (D-24026).
- [ ] Preview drive (WP Verification step 4, synthetic touch events) recorded with screenshots.
- [ ] Two-commit topology: `EC-798:` + `SPEC:` close (WORK_INDEX, EC_INDEX, DECISIONS D-24592, STATUS `### WP-761`, mindmap ✅ + `roadmap:counts:write`).
- [ ] `pnpm roadmap:counts:check` and `pnpm ledger:numbers:check` exit 0.
- [ ] D-24026 real-device (iOS + Android) live-verify recorded as operator-manual-pending.

## Common Failure Smells (Optional)

- **The City row won't scroll on a phone.** A `touchmove` was prevented while not armed, or `touch-action` was changed.
- **Taps stopped fighting.** A pending arm armed suppression on cancel, or the arm fired on release.
- **A held finger opens the image menu.** `contextmenu` was not prevented, or the iOS callout CSS is missing.
- **The first villain in the stroke is skipped.** Candidates were measured at `pointerdown` instead of at the arm, or the crossing state was not seeded at the press point.
- **Mouse users see a glow after holding still.** Eligibility did not exclude `mouse`.
- **The row stops scrolling after toggling the setting.** A reset path skipped `syncLongPressState()`, leaving `isLongPressArmed` true with no stroke.
- **An armed stroke dies on the first move.** `lostpointercapture` from the child→row capture move was not filtered to `event.target === row`.
- **The armed glow never appears.** `isLongPressArmed` was a `computed` over the non-reactive `stroke`.
- **The armed glow is invisible.** An outer glow was clipped by the row's `overflow-x: auto`; use inset.
