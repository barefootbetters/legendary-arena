# WP-761 — Long-press slash: touch / pen slash-to-fight on a scrolling City row (arena-client + ewiki)

**Status:** Draft 2026-09-25 (EC-798; D-24592 reserved).
**Primary Layer:** arena-client (`apps/arena-client/src/composables/useSlashGesture.ts`, `.../components/play/CityRow.vue`) + ewiki docs
**Dependencies:**
- **WP-756 / D-24585** (the slash gesture: `useSlashGesture`, its DOM adapter, the full-crossing rule, the engine-confirmed chain, the touch fit rule) ✅ (#2357, `c031a59d`).
- #2362 (`afeb5ca9`, INFRA) — the mobile play page no longer overflows the viewport, so the City row's own band is the only horizontal scroller on a phone ✅.
- WP-129 / EC-132 (the City row, `gateForCell`) ✅.

**User-Visible Surface:** play.legendary-arena.com (the City row on a phone) and ewiki.legendary-arena.com/visual-effects/
**Baseline:** `origin/main` @ `244fbd9d` (the WP-761 / EC-798 / D-24592 reservation, #2370)
**Naming note:** commit subjects and PR titles must not contain the word "swipe" (the commit-hygiene regex is unanchored; "s**wip**e" matches `wip`).

---

## Goal

Let a phone or tablet player **slash to fight even when the City row scrolls sideways** — which, at 375 px, is always (five spaces are ~800 px wide).

- **Press and hold** on the City row, without moving, for 350 ms. The row **arms**: it glows, and (where supported) the phone gives a short buzz.
- **Then drag.** The row no longer scrolls under the finger. The stroke works exactly like a WP-756 mouse stroke: every fightable villain it fully crosses is fought, in crossing order, with the blade trail and stroke-angled slices.
- **A normal drag still scrolls** the row, and **a quick tap still fights**, exactly as today. One deliberate change: on a scrolling row a press held **350 ms or longer** is a slash arm, not a tap — releasing it without a stroke fights nothing.

---

## User-Visible Impact

- **Before:** on a phone the City row scrolls, so WP-756 hands every finger drag to native scrolling and the slash gesture is unavailable. Only taps fight.
- **After:** a finger that holds still on the row for 350 ms arms a slash; the next drag is a stroke, not a scroll. Releasing ends it.
- **Unchanged:**
  - taps fight (a press released before 350 ms, or one that moves first, is not a long press). **Changed:** on a scrolling row a press held ≥ 350 ms on a villain used to fight it on release; it now arms, and releasing it without a stroke fights nothing (a deliberate trade, D-24592);
  - a drag that starts moving before 350 ms scrolls the row natively;
  - mouse behaviour (WP-756);
  - touch on a row that fits (WP-756's immediate 16 px gesture, `pan-y`);
  - the "Slash to fight" toggle turns this off too (no new setting).
- **Rules:** none change. The same `fightVillain({ cityIndex })` intents, one at a time, engine-confirmed (D-24585 §3).

---

## Assumes

Verify each before coding. If any is false, STOP and reconcile.

1. **WP-756 shipped as designed** (#2357). `useSlashGesture.ts` has:
   - `TOUCH_START_DISTANCE_PX = 16` (`:43`) and the `SlashGestureController` interface (`:93`);
   - `isTouchGestureEnabled = computed(() => isEnabled.value && isRowFitting.value)` (`:294`);
   - `canPointerStartStroke` (`:443`) — touch / pen may start a stroke only while `isTouchGestureEnabled`;
   - `handlePointerDown` (`:448`) and `startGesture` (`:474`), which creates the crossing state from the `pointerdown` point, captures the pointer, and publishes the first trail samples;
   - the DOM adapter `attachAdapter` (`:546`) with `pointerdown/move/up/cancel`, `keydown`, capture-phase `click` and `dragstart` listeners, attached only while the setting is on;
   - the chain, hints, click suppression and trail signal, all reused unchanged.
2. **Browser touch model — a platform premise, not a pre-coding STOP gate.** Per the Pointer Events spec (`touch-action` + `pointercancel`) and the Touch Events spec (cancelability): with `touch-action: auto` (the scrolling-row case) the browser starts a native pan only once the finger passes its touch slop; until then a `touchmove` delivered to a **non-passive** listener registered before `touchstart` is cancelable, and `preventDefault()` on it stops the pan while pointer events keep flowing. Once a pan starts, the browser sends `pointercancel` and later `touchmove`s are not cancelable. A long press on an image or text may raise `contextmenu` (Android, cancelable) or the callout / selection menu (iOS, suppressed by `-webkit-touch-callout: none`). **This premise cannot be checked in jsdom or in the preview** (neither produces real touch scrolling). It is verified on real devices at D-24026 (Verification step 5) with explicit pass criteria. Known risk: on iOS a finger held "still" jitters a few px, and WebKit dispatches those sub-slop `touchmove`s un-prevented while the arm is pending; whether later `touchmove`s in that touch stay cancelable is the real iOS question. **Fallback if iOS fails step 5:** a follow-up WP prevents sub-tolerance `touchmove`s while the arm is pending on WebKit; until then the documented degradation is that an armed iOS stroke may receive `pointercancel`, which ends it and keeps its completed crossings (D-24585 §2). No fight is ever sent wrongly either way.
3. **The row is the only horizontal scroller on a phone.** After #2362 the page no longer overflows at 375 px; `.play-mobile__band--scroll-x` (the row's band, `PlayMobile.vue:1039-1041`) scrolls, and the row `ol` is itself `overflow-x: auto` (`CityRow.vue:344`). The long press does not depend on which ancestor scrolls, but this is why `isTouchGestureEnabled` is false on phones today.
4. **`setTimeout` is allowed outside the D-24365 subsurface** — scheduling, not a clock read; precedent: D-24585 §3 (the 3000 ms backstop) and `useSlashGesture.ts:18-20`. `navigator.vibrate` may be absent (iOS Safari); it is feature-detected and never load-bearing. jsdom's `navigator` is installed configurable (`jsdom-setup.ts:65`), so tests can stub `vibrate`.
5. **jsdom:** no `PointerEvent`, no `TouchEvent` constructor needed — tests drive the controller seam and dispatch `new window.Event('touchmove' | 'contextmenu' | 'lostpointercapture', { bubbles: true, cancelable: true })` to read `defaultPrevented` (`bubbles: true` so an event dispatched on a child reaches the row listener; `pointerId` set explicitly with `Object.defineProperty`, since a plain `Event` has none and `sampleFromEvent` would default it to 1). The setting / row watch is `flush: 'post'`, so tests `await nextTick()` after toggling the setting before asserting. `mock.timers.enable({ apis: ['setTimeout'] })` drives the 350 ms timer (and mocks `clearTimeout`); the default `capturePointer` already guards a missing `setPointerCapture` (`useSlashGesture.ts:272`).

---

## Context (Read First)

**Authoritative references:** WP-756 + EC-793 + D-24585 (the gesture this extends); `useSlashGesture.ts` as shipped; `CityRow.vue`; `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:320-330` (D-24365 subsurface); `.claude/rules/architecture.md` §Import Rules (the `apps/arena-client` row).

**Why a long press, not a different gesture.** On a scrolling row a finger drag *must* stay a scroll — that is D-24585 §5, and it is what players expect. The only intent signal that does not collide with scrolling or tapping is *holding still first*: a scroll starts moving at once, a tap releases at once. This is the standard mobile "press-and-hold to drag" idiom.

**Why the arm is decided before any movement.** `touch-action` is fixed when the touch starts, so the row cannot switch to `pan-y` mid-touch. Instead, while armed, the adapter calls `preventDefault()` on each `touchmove` (non-passive listener on the row). That only works while the browser has not started panning — which is exactly the long-press condition (the finger held still). If the finger moves more than `LONG_PRESS_MOVE_TOLERANCE_PX` before the timer fires, or the browser pans and sends `pointercancel`, the arm is abandoned and native scrolling proceeds untouched.

**Why the stroke starts at the arm.** Once armed, the start-distance threshold is waived: the crossing state is created at the arm from the `pointerdown` point (the finger has not moved) and the next `pointermove` advances it. Candidate tiles and their rects are measured at the arm, because the row cannot scroll during an armed stroke. The full-crossing rule is unchanged: a hold that starts *on* a villain never fights that villain (hold on a gap, a slot label or an empty space, then slash); crossing *other* villains still fights them.

**Why taps survive.** A tap releases before 350 ms, so the arm never fires and nothing is armed or suppressed. An armed hold released without movement is a completed gesture: it arms the one-shot click suppression, because once `contextmenu` is prevented a browser may still fire `click` after the long touch. On touch that `click` comes from the tap gesture and can land in a *later* task than `pointerup`, so for the **armed path only** the suppression is cleared on the next `pointerdown` / `keydown` — not by WP-756's `setTimeout(0)`. Every later tap begins with a `pointerdown`, so this can never eat a later tap. The mouse and fitting-row paths keep WP-756's clearing unchanged.

**One source of truth for "armed".** A long press is a `stroke` carrying `isLongPress: true`. It is *pending* while `hasStarted` is false and the arm timer runs, and *armed* once `armStroke()` sets `hasStarted`. `stroke` stays WP-756's plain `let` (mutated in place), so a `computed` over it would never update. Instead one `ref`, `isLongPressArmed`, is written **only** by a single helper `syncLongPressState()`, whose value is always `stroke !== null && stroke.isLongPress && stroke.hasStarted`, and which runs at every point that changes the stroke: `pointerdown`, `armStroke()`, `pointerup`, `pointercancel`, `lostpointercapture`, the > 10 px pre-arm cancel, the second-finger cancel, the setting / row watch, and scope dispose. `shouldPreventTouchScroll()` is a plain function reading `stroke` directly. So the row can never be left unscrollable, and the ref can never disagree with the stroke.

**Eligibility is decided at `pointerdown`.** Chain fights during an armed stroke change the row's `scrollWidth`, and the fit re-measures on every `city()` change, so `isTouchGestureEnabled` can flip mid-stroke. A pending or armed long press continues regardless (`touch-action` is fixed at touch start anyway), and so do its listeners and callout CSS: they are gated on "the row does not fit **or** a long press is live", so a chain fight that makes the row fit mid-stroke cannot detach them and let the browser pan.

**Feedback.** Arming turns on the row class `city-spaces--gesture-armed` (an **inset** glow via `box-shadow` / negative-offset `outline` — the row and its band are `overflow-x: auto`, so an outer glow would be clipped), calls `navigator.vibrate(12)` when it exists, and publishes one blade-trail sample at the press point so the trail grows from the finger.

**Accepted degradations (recorded in D-24592).** If the hold starts on an empty slot and a mid-stroke fight puts a villain into that space, Vue replaces the touched `div` with a `button`; later `touchmove`s then target a detached node and no longer reach the row's listener, the pan resumes, `pointercancel` ends the stroke, and its completed crossings are kept. The existing `dragstart` prevention (WP-756) is now also what stops Android / iOS touch drag-and-drop after a long press on card art.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control flow, descriptive names, `// why:` comments, small functions, no nested ternaries, no `import *` / barrel re-exports).
- **Engine owns truth:** only `fightVillain({ cityIndex })` through the existing chain; no client rule logic; no outcome prediction.
- **Layer boundary:** arena-client only; no `packages/**` change; engine **types** only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24592) before coding. One WP per session.

**Packet-specific:**
- No `performance.now()` / `Date.now()` / `Math.random()` outside `src/vfx/**` and `VfxOverlay.vue`. The 350 ms arm is a `setTimeout`.
- **WP-756 behaviour is byte-identical** for: mouse strokes; touch / pen on a fitting row (`city-spaces--gesture-touch`); taps; setting off. The new `touchmove` / `contextmenu` / `lostpointercapture` listeners and the callout CSS are attached **only while `isLongPressHoldEnabled`** — setting on AND (the row does not fit OR a long press is live) — (class `city-spaces--gesture-hold`), so a fitting row carries neither and the setting-off row carries nothing. On a non-fitting row the listeners are inert for mouse (they act only on a pending / armed long press).
- **Never `preventDefault()` a `touchmove` unless armed.** An unarmed touch must scroll natively. Never `preventDefault()` `touchstart` / `pointerdown`.
- The chain, hints, trail signal, fit rule and `VfxOverlay.vue` are reused **unchanged**; click suppression is unchanged except the armed-path clearing (Locked Values).
- Never reference the `PointerEvent` or `TouchEvent` globals (no `instanceof`, no constructors); read fields off the event object.

---

## Locked Values

EC-798 copies these verbatim. The WP wins on conflict.

- `LONG_PRESS_ARM_MS = 350` — hold duration before the row arms.
- `LONG_PRESS_MOVE_TOLERANCE_PX = 10` — movement from the `pointerdown` point that abandons a pending arm (a scroll or a sloppy tap).
- `LONG_PRESS_VIBRATE_MS = 12` — the arm buzz, only when `typeof navigator.vibrate === 'function'`.
- **Eligibility (decided at `pointerdown` only):** the setting is on, the pointer is `touch` or `pen`, no stroke is pending or active, and `isTouchGestureEnabled` is **false** (the row scrolls). When it is true, WP-756's immediate path applies and no long press runs. Mouse never long-presses. A later fit change does not affect a pending or armed long press.
- **Representation:** a long press is a `stroke` with `isLongPress: true`; *pending* = `hasStarted` false + the arm timer running; *armed* = `hasStarted` true. `stroke` stays a plain `let`. `isLongPressArmed` is a `ref` written **only** by `syncLongPressState()`, whose value is always `stroke !== null && stroke.isLongPress && stroke.hasStarted`; it runs at every stroke change (`pointerdown`, `armStroke()`, `pointerup`, `pointercancel`, `lostpointercapture`, the > 10 px cancel, the second-finger cancel, the setting / row watch, dispose). `shouldPreventTouchScroll()` is a plain function reading `stroke`. A pending long press never runs WP-756's 16 px `startGesture` path.
- **Pending arm:** starts at `pointerdown`; cancelled (stroke nulled, timer cleared, `syncLongPressState()`) by `pointerup`, `pointercancel`, movement > 10 px from the `pointerdown` point, a **second `pointerId`** (a pinch or two-finger pan), the setting turning off, or scope dispose. **The `pointerdown` that cancels a pending arm does not itself start one.** Cancelling never arms suppression.
- **Arm (`armStroke()`, at 350 ms):** `hasStarted = true`; capture the pointer; `createCrossingState(collectCandidateTiles(), downPoint)` (candidates measured now); publish **one** trail sample at `downPoint`; buzz if supported. Do not reuse `startGesture` (it publishes two samples and advances a segment).
- **Armed stroke:** the adapter's non-passive `touchmove` listener calls `preventDefault()` iff `shouldPreventTouchScroll()`; `pointermove` advances as in WP-756; a **second `pointerId` is ignored** (WP-756 rule); `pointerup` completes it (arms click suppression, publishes `isStrokeEnd`); `pointercancel` keeps completed crossings and arms nothing. **`lostpointercapture` ends the stroke the same way only when `event.target` is the row itself and its `pointerId` matches an armed long-press stroke** — capture moving from the touched child to the row (at `armStroke()`) fires a bubbling `lostpointercapture` on the child, which must be ignored; mouse and fitting-row strokes ignore it entirely. Every path that nulls the stroke (including the setting / row watch and dispose) ends the arm.
- **Click suppression (armed path only):** cleared on the next `pointerdown` / `keydown`, not by `setTimeout(0)`. Mouse and fitting-row paths keep WP-756's clearing.
- **Context menu:** the row's `contextmenu` listener (events bubbling to the row) calls `preventDefault()` while a long press is pending or armed.
- **Hold gate:** `isLongPressHoldEnabled` = setting on AND (`!isRowFitting` OR `isLongPressLive`), where `isLongPressLive` (a long press is pending or armed) is a second ref written only by `syncLongPressState()` alongside `isLongPressArmed`. So the hold listeners and class outlive a mid-stroke fit change and detach on the first sync after the long press ends if the row now fits; setting off detaches at once (it cancels the stroke anyway).
- **CSS:** `city-spaces--gesture-hold` iff `isLongPressHoldEnabled` — it carries `-webkit-touch-callout: none` and marks when the long-press listeners are attached. `city-spaces--gesture-armed` iff `isLongPressArmed` — an **inset** glow (`box-shadow: inset …` or `outline` with a negative `outline-offset`), no animation under `prefers-reduced-motion`. `city-spaces--gesture` is unchanged from WP-756.
- **Controller additions:** `isLongPressArmed: Readonly<Ref<boolean>>` (returned as `readonly(...)`; only `syncLongPressState()` writes the underlying ref), `isLongPressHoldEnabled: Readonly<Ref<boolean>>` (the Hold gate above — binds `city-spaces--gesture-hold` and gates the long-press listeners), and `shouldPreventTouchScroll(): boolean`. `handlePointerDown/Move/Up/Cancel` keep their WP-756 signatures.

---

## Scope (In)

### A) `apps/arena-client/src/composables/useSlashGesture.ts` (**modified**)
- The locked constants above.
- In `handlePointerDown`, a touch / pen press on a non-fitting row starts a **pending arm** (a `setTimeout(LONG_PRESS_ARM_MS)`), instead of returning.
- `handlePointerMove`: before the arm, movement > tolerance cancels the pending arm (and the move is otherwise ignored — native scroll). After the arm, the move advances the stroke exactly as a started WP-756 stroke.
- `handlePointerUp` / `handlePointerCancel`: cancel a pending arm; end an armed stroke per the Locked Values.
- `isLongPressArmed` and `isLongPressLive` (refs written only by `syncLongPressState()`), `isLongPressHoldEnabled` (the Hold gate) and `shouldPreventTouchScroll()` on the controller; a dedicated `armStroke()`.
- Adapter: a non-passive `touchmove` listener (`{ passive: false }`) calling `preventDefault()` when `shouldPreventTouchScroll()`; a `contextmenu` listener; a `lostpointercapture` listener that ends an armed long-press stroke like `pointercancel` only when `event.target` is the row and the `pointerId` matches. These three are attached **only while `isLongPressHoldEnabled`** (the Hold gate: re-evaluated when the fit, the setting or the live long-press state changes — never detached while a long press is live); the WP-756 listeners keep their existing setting gate.
- Every stroke-reset path (including the setting / row watch and scope dispose) clears the arm timer and ends the arm.
- `// why:` comments per EC-798.

### B) `apps/arena-client/src/components/play/CityRow.vue` (**modified**)
- Bind `city-spaces--gesture-armed` to `isLongPressArmed` (returned from `setup()`, D-6512).
- Bind `city-spaces--gesture-hold` to `isLongPressHoldEnabled`. CSS: the armed inset glow; `-webkit-touch-callout: none` on `city-spaces--gesture-hold` only; the reduced-motion override.

### C) ewiki — `wiki/visual-effects.md` (**modified**)
Add a "Long-press slash on a scrolling row" paragraph to §Slash to fight (`{#slash-to-fight}`): hold 350 ms without moving to arm, the glow / buzz, the full-crossing rule still applies (hold off a card), normal drags scroll, quick taps fight, a press held ≥ 350 ms is an arm rather than a tap, the toggle covers it. **Also amend** the existing "Touch and pen only when the row fits" bullet in that section, which would otherwise say a finger drag on a scrolling row must stay a scroll with no alternative.

### D) Tests (**modified**)

**`useSlashGesture.test.ts`** (controller seam; `effectScope`, `mock.timers` setTimeout only, overflowing row stub so `isTouchGestureEnabled` is false):
- A touch hold of 350 ms arms (`isLongPressArmed` true, one capture) and the following drag across two tiles submits the first, then the second after the first leaves the City.
- A hold of 349 ms then release: never armed, no submit, no suppression (a tap).
- Movement of 11 px before 350 ms cancels the arm: advancing timers arms nothing, and a later drag submits nothing.
- `pointercancel` before 350 ms cancels the arm.
- `shouldPreventTouchScroll()` is false while pending and true only while armed; false again after `pointerup`.
- An armed hold released without movement arms the one-shot click suppression; it survives `mock.timers.tick(0)` and is cleared by the next `pointerdown` (and by `keydown`).
- A hold that starts on a villain tile never fights that tile, but a stroke from it across another tile fights the other.
- Pen follows the same path; mouse never long-presses (a still mouse press for 350 ms arms nothing).
- On a **fitting** row a touch press does not start a pending arm (WP-756's immediate path; its existing tests stay green).
- A fit change mid-hold (the row starts fitting) does not cancel a pending or armed long press.
- Setting off: no pending arm; the setting turning off mid-hold cancels it; the setting turning off **while armed** makes `isLongPressArmed` false and, after re-enabling, `shouldPreventTouchScroll()` is false for a fresh unarmed touch.
- A second `pointerId` during a pending arm **cancels** it, and does not start one of its own: advancing 350 ms after the second finger lands arms nothing for either pointer, with no capture. A second `pointerId` during an armed stroke is **ignored**.
- After every transition above (pending, armed, each cancel path, `pointerup`, setting off, dispose), `isLongPressArmed.value === shouldPreventTouchScroll()`.
- Scope dispose clears the pending timer (advancing 350 ms after dispose arms nothing).
- The buzz: with `navigator.vibrate` stubbed, the arm calls it once with `12`; no call for a mouse press or on a fitting row; with `vibrate` absent the arm does not throw.
- An armed `pointercancel` keeps completed crossings (their submits happen), publishes `isStrokeEnd`, arms no suppression, and `isLongPressArmed` becomes false.
- The arm publishes exactly **one** trail sample, at the `pointerdown` point.
- Candidates are measured at the arm: a villain that becomes fightable between `pointerdown` and the arm (the gate flips) is fought by the armed stroke.
- A touch hold of 350 ms on a villain tile released without moving: no submit, click suppression armed (the documented slow-tap trade).
- `navigator.vibrate` stubs are removed in `afterEach` (`navigator` is a shared global, `jsdom-setup.ts:65`).

**`CityRow.test.ts`** (DOM adapter; `mock.timers` `setTimeout` enabled in the `describe`, reset in `afterEach`). To make the row overflow: after mount, stub `scrollWidth` > `clientWidth` on `ol.city-spaces`, dispatch `window.dispatchEvent(new window.Event('resize'))`, `await nextTick()`, and assert `city-spaces--gesture-touch` is absent. Then:
- A touch `pointerdown` + 350 ms → `city-spaces--gesture-armed`; a cancelable `touchmove` on the row is `defaultPrevented`; a cancelable `contextmenu` is `defaultPrevented`.
- Without arming, a cancelable `touchmove` is **not** `defaultPrevented`.
- A cancelable `contextmenu` while the long press is still **pending** (before 350 ms) is `defaultPrevented`.
- **Fit flips mid-stroke:** arm on an overflowing row; stub the widths so the row fits, dispatch `resize`, `await nextTick()` → the armed class and `city-spaces--gesture-hold` are still present and a cancelable `touchmove` is still `defaultPrevented`; the same flip while **pending** leaves a cancelable `contextmenu` prevented. After `pointerup` + `await nextTick()` the hold class is gone and a `touchmove` is not prevented.
- On a **fitting** row (setting on) the row lacks `city-spaces--gesture-hold`, and `touchmove` / `contextmenu` are not prevented (the long-press listeners are not attached).
- A `lostpointercapture` dispatched on the **row** while armed (matching `pointerId`) removes the armed class; a bubbling `lostpointercapture` dispatched on a **child tile** while armed does **not**.
- Setting off while armed → the armed class is gone; after re-enabling, an unarmed cancelable `touchmove` is not `defaultPrevented`.
- Setting off: no armed class after a 350 ms hold, and `touchmove` / `contextmenu` are not prevented.
- Existing tests unchanged.

---

## Out of Scope

- **Engine, registry, server:** no change; no new move.
- **Fit rule, mouse gesture, chain, hints, trail rendering, `VfxOverlay.vue`:** unchanged (D-24585).
- **A new setting** or a separate long-press toggle: the existing "Slash to fight" toggle governs both.
- **Mastermind / HQ by gesture**, keyboard equivalents: as WP-756.
- **Tuning by device** (per-OS thresholds): one locked value set.

---

## Files Expected to Change

- `apps/arena-client/src/composables/useSlashGesture.ts` (modified)
- `apps/arena-client/src/composables/useSlashGesture.test.ts` (modified)
- `apps/arena-client/src/components/play/CityRow.vue` (modified)
- `apps/arena-client/src/components/play/CityRow.test.ts` (modified)
- `wiki/visual-effects.md` (modified)

Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24592), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

> 4 code/test files in one app plus one ewiki page. Not Lightweight-Lane: the change reworks input semantics (touch-scroll interplay, a browser-behaviour assumption verified only at execution), so scope classification is not unambiguous (01.0a §Lightweight Lane: ambiguity resolves against eligibility).

---

## Contract

- `useSlashGesture(options)` — options unchanged; the returned controller adds `isLongPressArmed: Readonly<Ref<boolean>>`, `isLongPressHoldEnabled: Readonly<Ref<boolean>>` and `shouldPreventTouchScroll(): boolean`. All WP-756 members keep their signatures.
- DOM: classes `city-spaces--gesture-hold` and `city-spaces--gesture-armed`; the adapter adds non-passive `touchmove`, `contextmenu` and `lostpointercapture` listeners only while `isLongPressHoldEnabled`.
- Move contract unchanged: `fightVillain({ cityIndex })` only.

---

## Vision Alignment

**Vision clauses touched:** §8 / §22 (determinism, replay-faithful — no engine change); §17 (accessibility & inclusivity — quick taps and native scrolling are unchanged, a press held ≥ 350 ms on a scrolling row becomes a slash arm instead of a tap (recorded in D-24592), the gesture is opt-out via the existing toggle, and the arm glow honours reduced motion); NG-1 (no pay-to-win).

**Conflict assertion:** No conflict. This WP preserves all touched clauses.

**Non-Goal proximity check:** NG-1..7 not crossed — a faster way to send the fight intent a tap sends; it grants no advantage and costs nothing.

**Determinism preservation:** no engine file changes; `finalStateHash` / `PRE_WP080_HASH` / replays untouched; the only new timing is a `setTimeout` (no clock read).

## Funding Surface Gate

§20 **N/A**: play-board input only; no funding affordance, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface.

---

## Acceptance Criteria

1. **Arm.** On a scrolling row, a touch or pen press held still (≤ 10 px) for 350 ms arms: the row shows `city-spaces--gesture-armed`, the pointer is captured, and the buzz fires where supported.
2. **Armed stroke.** In session: after arming, a cancelable `touchmove` on the row is `defaultPrevented`, and every fightable villain the stroke fully crosses is fought in crossing order through the WP-756 chain, with the trail and stroke-angled slices. On a real device (operator-manual, D-24026): the row does not scroll while armed.
3. **Scrolling survives.** In session: a touch that moves more than 10 px before 350 ms arms nothing, fights nothing, and no `touchmove` is `defaultPrevented`. On a real device (operator-manual, D-24026): that drag scrolls the row natively, with no perceptible start lag while VFX runs.
4. **Taps survive.** A touch released before 350 ms fights exactly as a tap does today; nothing is armed or suppressed. A touch held ≥ 350 ms on a scrolling row and released without moving arms, fights nothing, and arms the click suppression (the documented trade).
5. **No regressions.** Mouse strokes, touch on a fitting row, the setting-off row, the chain, hints, trail and all existing tests are unchanged. No `packages/**` change.
6. **Context menu.** In session: on a scrolling row, a cancelable `contextmenu` bubbling to the row is `defaultPrevented` while a long press is pending or armed, and the row carries `city-spaces--gesture-hold` (`-webkit-touch-callout: none`). On a real device (operator-manual, D-24026): a long press on a scrolling row opens no context menu or iOS callout.
7. **Checks.** `pnpm --filter @legendary-arena/arena-client typecheck` and `test` pass; `pnpm -r build && pnpm -r --no-bail test` passes.

---

## Verification Steps

```bash
# 1) arena-client
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; full suite 0 fail (new long-press cases pass)

# 2) Client-only diff
git diff --name-only origin/main...HEAD
# Expected: only §Files Expected to Change (+ governance at close); no packages/** path

# 3) Whole repo
pnpm -r build && pnpm -r --no-bail test
# Expected: every package builds; all packages 0 fail

# 4) Preview drive, mobile viewport (375 px), local server + paused guest autoplay match.
#    The preview cannot produce real touch scrolling, so it drives SYNTHETIC touch-typed
#    PointerEvents plus cancelable touchmove events on the row and reads the results:
#    - a touch press that moves 20 px within 350 ms: no armed class, touchmove NOT prevented,
#      no fight
#    - a tap on an affordable villain fights it
#    - hold 350 ms on a gap / slot label -> armed class; touchmove IS prevented; a drag across
#      two affordable villains -> both fought in crossing order, trail + slices follow the stroke
#    - setting off -> a 350 ms hold arms nothing
#    Real scroll suppression and the context menu / callout are the real-device check in step 5.

# 5) Live (operator-manual, post-deploy, D-24026) on a real iOS phone AND a real Android phone.
#    This is where Assumes #2 is verified. Pass criteria on each:
#    - hold 350 ms on a gap, then slash across two affordable villains: the row does NOT
#      scroll while armed, no pointercancel ends the stroke mid-way (both villains fought,
#      in order), and no context menu / image callout / text selection appears
#    - a deliberately jittery hold on iOS still arms, and the armed drag still does not scroll
#    - a quick drag scrolls the row with no perceptible start lag while VFX runs; a tap fights
#    If iOS fails the scroll criterion: record it, ship the documented degradation
#    (pointercancel ends the stroke, completed crossings kept), and open the WebKit
#    pending-arm touchmove follow-up named in Assumes #2.
```

---

## Definition of Done

- [ ] All Acceptance Criteria are met, except the real-device clauses of AC2 / AC3 / AC6, which are recorded operator-manual-pending (D-24026).
- [ ] No `packages/**` change, and no files outside `## Files Expected to Change` except the governance ledgers.
- [ ] arena-client typecheck 0; `pnpm -r build && pnpm -r --no-bail test` green.
- [ ] The preview drive (Verification step 4) is recorded with screenshots.
- [ ] The ewiki paragraph is published.
- [ ] Governance closed: STATUS `### WP-761 (YYYY-MM-DD)`; D-24592 appended Active; WORK_INDEX `[x]`; EC_INDEX EC-798 Done; mindmap ✅ + `pnpm roadmap:counts:write`.
- [ ] Two-commit topology: `EC-798:` implementation + `SPEC:` close. No subject or PR title contains "swipe".
- [ ] D-24026 real-device live-verify recorded as operator-manual-pending until confirmed.

---

## Reserved Decision (lands at execution)

**D-24592 — long-press-slash.** Locks:
- the 350 ms / 10 px arm on a scrolling row (touch / pen only, never mouse, never when the row fits; eligibility decided at `pointerdown`);
- "armed" = `stroke.isLongPress && stroke.hasStarted`, mirrored into the `isLongPressArmed` ref only by `syncLongPressState()` at every stroke change, so every stroke-reset path ends it; a second finger cancels a pending arm (without starting its own) and is ignored once armed; `lostpointercapture` ends an armed long-press stroke only when targeted at the row with a matching `pointerId`;
- the armed-stroke contract: `armStroke()` seeds the stroke at the press point with the start distance waived and candidates measured at the arm; `touchmove` prevented only while armed; `contextmenu` prevented while pending or armed; armed-path click suppression cleared on the next `pointerdown` / `keydown`;
- feedback: inset armed glow, optional 12 ms buzz, one trail sample at the press point;
- accepted degradations: a detached `touchmove` target after a mid-stroke empty-slot fill resumes the pan (`pointercancel`, completed crossings kept); on iOS, if sub-slop jitter makes the armed `touchmove` uncancelable, the same degradation applies pending a WebKit follow-up; if an armed stroke is released and the browser fires no `click`, the armed-path suppression waits for the next `pointerdown` / `keydown`, so a screen-reader activation (VoiceOver / TalkBack double-tap, which sends a `click` without either) in the row is swallowed once — no timer is used, because a timer reintroduces the touch-`click` task race;
- WP-756's `dragstart` prevention also blocks touch drag-and-drop after a long press on card art;
- composition with D-24585: full-crossing rule, chain, hints, trail, fit rule and setting reused unchanged; this **lifts** the D-24585 Consequences out-of-scope line "a long-press slash mode for scrolling rows";
- the long-press listeners and callout CSS attach only while the setting is on and (the row does not fit or a long press is live) (`city-spaces--gesture-hold`), so they outlive a mid-stroke fit change; the accepted cost is that the non-passive `touchmove` listener makes the compositor consult the main thread before panning a touch that starts on a scrolling row (verified for perceptible lag on devices at D-24026);
- the slow-tap trade: on a scrolling row a press held ≥ 350 ms and released without a stroke arms and fights nothing, where WP-756 would have fought it as a tap.

---

## Lint Gate Self-Review (00.3)

_Pending — completed in Step 5 after pre-flight and copilot._

## Gate Record

_Pending — pre-flight (01.4) and copilot (01.7) verdicts recorded in Step 5._
