# Session Prompt — WP-761 / EC-798: Long-press slash on a scrolling City row

**WP:** docs/ai/work-packets/WP-761-long-press-slash.md
**EC:** docs/ai/execution-checklists/EC-798-long-press-slash.checklist.md (authoritative execution contract)
**Reserves:** D-24592 (lands Active at govern-close).
**Status:** READY TO EXECUTE. Gate verdicts are in the WP §Gate Record and §Lint Gate Self-Review.

> This file is committed via `git add -f` because `session-*.md` is gitignored.
>
> **Commit subjects and PR titles must never contain "swipe"** (the hook's unanchored regex matches `wip`). Say "slash" / "long-press slash".

## Invocation intent

WP-756 gave the City row a slash-to-fight gesture, but on a phone the row scrolls sideways, so every finger drag stays a native scroll and the gesture is off. WP-761 adds a **long press**: a touch / pen press held still (≤ 10 px) for 350 ms on a scrolling row arms a slash; while armed, the row's non-passive `touchmove` listener prevents the pan and the stroke runs through the unchanged WP-756 full-crossing rule, engine-confirmed chain, trail and stroke-angled slices. Moving first still scrolls; a quick tap still fights; a press held ≥ 350 ms is an arm, not a tap (the recorded trade). Client-only.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (arena-client: engine **types** only; engine owns truth)
3. `.claude/rules/code-style.md` + `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:320-330` (no clock outside `src/vfx/**` + `VfxOverlay.vue`)
4. WP-761 → EC-798 (the EC Locked Values are verbatim from the WP; the WP wins on conflict)
5. WP-756 + D-24585 (the gesture this extends)
6. Source: `composables/useSlashGesture.ts` + test (anchors `:43`, `:93`, `:272`, `:294`, `:443`, `:448`, `:474`, `:546`, `:591-603`); `components/play/CityRow.vue` + test; `testing/jsdom-setup.ts`; `pages/PlayMobile.vue:1039-1041`
7. User memory: `reference_commit_subject_forbidden_tokens`, `reference_play_fixture_dev_route`, `reference_autoplay_setupdata_live_verify`, `reference_injected_seam_hides_missing_wiring`

## Pre-execution checks

- Fresh worktree off `origin/main`; `pnpm install`; `pnpm -r build`.
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; tests at the **2084 / 0** baseline (reconcile any drift first).
- EC Before Starting: WP-756 anchors match; #2362 merged (the page does not overflow at 375 px).

## Execution rules (operationalizing WP-761 + EC-798; no new scope)

**Controller (`useSlashGesture.ts`)**
- Constants: `LONG_PRESS_ARM_MS = 350`, `LONG_PRESS_MOVE_TOLERANCE_PX = 10`, `LONG_PRESS_VIBRATE_MS = 12`.
- Eligibility decided at `pointerdown` only: setting on, `touch` / `pen`, no stroke pending or active, `isTouchGestureEnabled` false. Mouse never long-presses.
- A long press is a `stroke` with `isLongPress: true` (pending = `hasStarted` false + timer; armed = `hasStarted` true). `stroke` stays a plain `let`.
- `syncLongPressState()` is the ONLY writer of the `isLongPressArmed` ref (`stroke !== null && stroke.isLongPress && stroke.hasStarted`) and the internal `isLongPressLive` ref (`stroke !== null && stroke.isLongPress`). Call it at every stroke change: down, arm, up, cancel, `lostpointercapture`, > 10 px cancel, second-finger cancel, the setting / row watch, dispose.
- Cancel a pending arm on `pointerup`, `pointercancel`, > 10 px, a second `pointerId` (which never starts its own arm), setting off, dispose. Cancelling never arms suppression.
- `armStroke()` at 350 ms: `hasStarted = true`; capture; `createCrossingState(collectCandidateTiles(), downPoint)`; ONE trail sample at `downPoint`; `navigator.vibrate(12)` if it is a function. Never `startGesture`.
- Armed: second `pointerId` ignored; `pointerup` completes (suppression armed, cleared only on the next `pointerdown` / `keydown` on this path); `pointercancel` keeps completed crossings.
- Expose `isLongPressArmed` and `isLongPressHoldEnabled` as `readonly(...)`; `isLongPressHoldEnabled` = setting on AND (`!isRowFitting` OR `isLongPressLive`). `shouldPreventTouchScroll()` reads `stroke`.

**Adapter**
- A separate `watch([rowElement, isLongPressHoldEnabled], …, { immediate: true, flush: 'post' })` attaches non-passive `touchmove` (prevent iff `shouldPreventTouchScroll()`), `contextmenu` (prevent while pending or armed) and `lostpointercapture` (ends an armed long press only when `event.target` is the row and the `pointerId` matches) and detaches them in `onCleanup`. The WP-756 listeners keep their own setting gate.

**CityRow.vue**
- Bind `city-spaces--gesture-hold` (→ `-webkit-touch-callout: none`) and `city-spaces--gesture-armed` (inset glow, no animation under reduced motion). `city-spaces--gesture` unchanged.

**Forbidden**
- Any `packages/**` edit; any clock read outside the VFX subsurface; preventing an unarmed `touchmove`, or `touchstart` / `pointerdown`; referencing the `PointerEvent` / `TouchEvent` globals; changing the chain, hints, trail, fit rule or `VfxOverlay.vue`.

**Tests:** WP §D in full — controller seam (`effectScope`, `mock.timers` setTimeout only, overflowing-row stubs) and the CityRow DOM cases (resize-driven overflow, `bubbles: true` events with explicit `pointerId`, `await nextTick()` after toggling the setting, the fit-flips-mid-stroke case, `vibrate` stub removed in `afterEach`).

## SAFE-KNOBS scope

N/A — the thresholds are code constants recorded in D-24592, not SAFE-KNOBS entries.

## Session task

1. Implement per EC-798 Files to Produce (4 code/test files + `wiki/visual-effects.md`, including amending the "Touch and pen only when the row fits" bullet).
2. `pnpm --filter @legendary-arena/arena-client typecheck && test`, then `pnpm -r build && pnpm -r --no-bail test`; `git diff --name-only origin/main...HEAD` has no `packages/**`.
3. Preview drive (WP Verification step 4) with synthetic touch-typed PointerEvents + cancelable `touchmove`, screenshots. Do not claim real scroll suppression from it.
4. Two commits: `EC-798:` implementation; `SPEC:` close (D-24592 Active, STATUS `### WP-761 (YYYY-MM-DD)`, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ + `pnpm roadmap:counts:write`; `ledger:numbers:check` + `roadmap:counts:check` green). No "swipe".
5. One PR, `gh pr merge --squash --auto`, bind with the ccd_pr tools.

**D-24026:** the real-device iOS + Android check (WP Verification step 5) and the device clauses of AC2 / AC3 / AC6 are operator-manual-pending. Record them; do not claim them.

## Post-merge close ritual (REQUIRED)

1. From inside the worktree: `node scripts/prune-empty-claude-branch.mjs --verify-current` — expect `VERIFY PASS` (a FAIL stops the ritual).
2. `git branch -D <branch>` and `git push origin --delete <branch>`.
3. From canonical: `node scripts/prune-empty-claude-branch.mjs --report` — expect silent (other sessions' branches are theirs; do not prune them).

## Scope restriction

This prompt only restates and operationalizes WP-761 + EC-798. It adds no scope, files, contract, locked values or forbidden patterns.
