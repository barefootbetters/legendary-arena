# Session Prompt — WP-756 / EC-793: Slash gesture to fight (swipe across City villains, with a blade trail)

**WP:** docs/ai/work-packets/WP-756-slash-gesture-fight.md
**EC:** docs/ai/execution-checklists/EC-793-slash-gesture-fight.checklist.md (authoritative)
**Reserves:** D-24585 (lands Active at govern-close).
**Status:** READY TO EXECUTE (WP-755 shipped in #2354). Gate verdicts are recorded in the WP §Gate Record and §Lint Gate Self-Review.

> This file is committed via `git add -f` because `session-*.md` is gitignored.
>
> **Commit subjects and PR titles must never contain "swipe".** The hook's unanchored regex matches `wip` inside it. Write "slash gesture" instead.

## Invocation intent

This is the input half of the Villain Slash Lab prototype. A mouse stroke fights each enabled City villain it **fully crosses**: the stroke starts outside the tile, enters it, and leaves it. Touch and pen get the same gesture only while the setting is on and the City row has no horizontal scroller.

The fights chain one `fightVillain({ cityIndex })` at a time, keyed by `extId`:
- The next City snapshot decides each fight. If the card is gone, the fight is confirmed. If it is still present, the fight was rejected and the chain skips it at once.
- If no snapshot arrives within 3000 ms, the rest of the chain is abandoned.

Taps stay ordinary clicks below the start distance: 8 px for mouse, 16 px for touch or pen.

A template-owned SVG blade trail on the VfxOverlay follows the stroke, and the WP-755 slice follows the stroke's angle. A persisted "Slash to fight" toggle defaults to on. The change is client-only.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (arena-client imports engine **types** only; engine owns truth)
3. `.claude/rules/code-style.md` + `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §client-app `:320-330` (the D-24365 subsurface is only `src/vfx/**` + `VfxOverlay.vue`)
4. WP-756 → EC-793 (the EC Locked Values are verbatim from the WP; the WP wins on any conflict)
5. WP-755 as shipped: its `VfxOverlay.vue` slice beat, `useVillainSlashVfx`, and `vfx/villainSlashVfxManifest.ts`
6. Source anchors:
   - `components/play/CityRow.vue` + test (`gateForCell`, `onFight`, `.city-spaces`)
   - `AudioControls.vue` + test
   - `vfx/effectIntensity.ts` (the singleton + reset pattern)
   - `pages/PlayMobile.vue:559, 1024-1026` (the band scroller)
   - `bgioClient.ts:82-92, 648-654` (no move queue; the 4000 ms ack watchdog calls `resync()`)
   - `testing/jsdom-setup.ts`
7. User memory:
   - `reference_commit_subject_forbidden_tokens`
   - `reference_client_fight_gating_ignores_fightcost`
   - `reference_injected_seam_hides_missing_wiring`
   - `feedback_verify_cross_surface_link_landing`
   - `reference_play_fixture_dev_route`

## Pre-execution checks

- Work in a fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build`.
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0. Record the test count.
- The EC Before Starting reconcile has been done:
  - WP-755's shipped names;
  - its geometry handles vertical cuts (90°) and 180° without NaN;
  - its producer and overlay signal watchers are `pre`-flush.

  If any of these fails, STOP.

## Execution rules (these operationalize WP-756 + EC-793; they add no new scope)

**Geometry** (`lib/slashGestureGeometry.ts`, pure)
- `segmentIntersectsRect`, `isPointInRect`, `createCrossingState` (tiles containing the start point are ineligible), `advanceCrossingState` (returns completed `{ extId, angleDeg }` in order; `angleDeg` is measured from entry to completion), `strokeAngleDeg`, `distanceBetween`.

**Controller** (`useSlashGesture`, per instance)
- The handlers take samples with `clientX`/`clientY`. Pointer capture is injected via `capturePointer`.
- Start distance is 8 px for mouse and 16 px for touch or pen. When the stroke starts, create the crossing state from the `pointerdown` point and advance the down→current segment immediately.
- Queue each crossing as it completes, mid-stroke.
- `pointerup` after a started gesture arms the one-shot click suppression (a sub-threshold press never arms it). `pointercancel` keeps completed crossings and arms nothing.
- The suppression is cleared on the next `pointerdown` or `keydown`, or by `setTimeout(0)`.
- A row `dragstart` listener calls `preventDefault()` whenever the setting is on.
- While a chain submit is in flight, suppress clicks on `play-city-villain` only. The EV button passes through.
- Never reference the `PointerEvent` global.

**Chain**
- Queue `extId`s. Before each submit, re-resolve the index and re-gate with `gateForCell`; skip the target if it is absent or refused.
- `watch(city, { flush: 'post' })`. The first new snapshot decides: if the `extId` is gone, the fight is confirmed; if it is still present, skip immediately.
- The 3000 ms `setTimeout` is a backstop only (below 4000). When it fires, abandon the rest.
- When a new stroke appends, dedupe `extId`s that are already queued or in flight.

**Hints**
- A per-space FIFO of `{ extId, angleDeg }`, pushed on each submit.
- `drop` runs on confirm (post-flush), skip, abandon, and dispose.
- In `VfxOverlay.vue`, `take(event.citySpace)` is the FIRST line of `renderVillainSlash` (`:926`), before the particles gate (`:942`). It is never placed in `renderSlicePieces` (`:907`, which runs after the gate). Thread `hintAngle ?? villainSlashAngleForSeq(event.seq)` into `renderSlicePieces`.

**Touch fit**
- The `city-spaces--gesture-touch` class (`touch-action: pan-y`) is present iff all of these hold:
  - the setting is on;
  - the row's `scrollWidth <= clientWidth + 1`;
  - every horizontally scrollable ancestor fits the same way;
  - the row is within `innerWidth`.
- Measure on mount, on a guarded `ResizeObserver`, on `watch(city, post)`, and on window `resize`.
- `city-spaces--gesture` (`user-select: none`) is present whenever the setting is on.

**Trail** (`VfxOverlay.vue`)
- A template-owned `<svg class="vfx-overlay__blade"><path data-testid="play-vfx-blade-trail">`.
- A `flush: 'sync'` sample watcher stamps each sample with `performance.now()` (add a `// why:` citing D-24365) and recomputes the path. A guarded rAF fade loop runs while points remain.
- Use `buildBladeTrailPath` (pure, exported).
- Limits: 170 ms life, 64 points, width 14 px (10 px on narrow screens). Import the colours from the WP-755 manifest.
- Render only when `shouldRender('particles')`. Hide it under reduced motion.

**Setting**
- `useSlashGestureSetting`, localStorage key `arenaClientSlashGesture`, default `'on'`.
- A toggle in `AudioControls.vue` with `data-testid="slash-gesture-toggle"` and `aria-pressed`.

**Forbidden**
- Any `packages/**` edit.
- Any `useExcessiveViolence` submit.
- `performance.now()` / `Date.now()` / `Math.random()` outside the D-24365 subsurface.
- Touching WP-746's `slash*` identifiers.
- `pointer-events: none` on disabled tiles.

**Tests:** WP §H in full, using the locked harness (`effectScope`, `mock.timers` for `setTimeout` only, `new window.MouseEvent`, stubbed rects and widths).

## SAFE-KNOBS scope

N/A. The "Slash to fight" default is a code constant recorded in D-24585, not a SAFE-KNOBS entry.

## Session task

Execute WP-756 per EC-793:
1. Implement the geometry, controller, setting, CityRow wiring, overlay trail and hint, and toggle, each with its tests. Add the ewiki subsection.
2. Run `pnpm --filter @legendary-arena/arena-client typecheck && test`, then `pnpm -r build && pnpm -r --no-bail test`.
3. Drive the preview per WP Verification step 4, with screenshots:
   - click;
   - a two-villain stroke;
   - a drag that starts on the art;
   - setting off;
   - the mobile scroller vs fits cases.
4. Use the two-commit topology:
   - an `EC-793:` implementation commit;
   - a `SPEC:` close: D-24585 Active, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ + `roadmap:counts:write`, a dated STATUS `### WP-756 (YYYY-MM-DD)` entry, and `ledger:numbers:check` + `roadmap:counts:check` green.

   **No "swipe" in any subject or PR title.**
5. Open one PR with auto-merge.

**D-24026:** the live slash on play.legendary-arena.com is operator-manual. Record it; do not claim it.

## Post-merge close ritual (REQUIRED)

1. `node scripts/prune-empty-claude-branch.mjs --verify-current` — expect `VERIFY PASS`.
2. `git branch -D <branch>` and `git push origin --delete <branch>`.
3. `--report` from canonical — expect silent.

## Scope restriction

This prompt only restates and operationalizes WP-756 + EC-793. It adds no new scope, files, contract, locked values or forbidden patterns.
