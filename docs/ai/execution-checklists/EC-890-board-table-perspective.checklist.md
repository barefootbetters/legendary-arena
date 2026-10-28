# EC-890 — Table perspective: desktop board tilt + board-card straighten on hover (Execution Checklist)

**Source:** docs/ai/work-packets/WP-852-board-table-perspective.md
**Layer:** Arena Client (presentation only)
**Status:** Draft

## Before Starting
- [ ] WP-688, WP-699, WP-556, WP-756, WP-761, WP-689 complete in WORK_INDEX; D-24788 reserved in NUMBER-LEDGER
- [ ] `PlayDesktop.vue` still renders adversary band → `CityRow` → `.play-desktop__hq-zone` → player zone inside `.play-desktop__main`
- [ ] `CityRow.vue`: `ref="cityRowEl"` on `.city-spaces` (`overflow-x: auto`); occupied `li.city-space > button.city-space__villain`
- [ ] `HQRow.vue`: `ol.hq-slots` (`overflow-x: auto`); occupied `li.hq-slot > button[data-testid="play-hq-hero"]` (unclassed)
- [ ] `useSlashGesture.ts` still has module-private `function measureRowFits(row: HTMLElement): boolean`
- [ ] `useEffectIntensity()` still returns `{ intensity, prefersReducedMotion, setIntensity, shouldRender }`
- [ ] `pnpm -r build` exits 0; arena-client `test` exits 0 (record the count); `typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client exec playwright install chromium`; `pnpm --filter @legendary-arena/arena-client test:visual` passes on the baseline
- [ ] Scope lock: only Files to Produce (plus the governance close) change; anything else is a blocker

## Locked Values (do not re-derive)
- `BOARD_TILT_ANGLE_DEGREES = 14`; `BOARD_TILT_PERSPECTIVE_PX = 900`; `BOARD_LIFT_PX = 0`
- `isTiltActive = intensity !== 'off'`; `isBoardLiftEnabled = isTiltActive && shouldRender('particles') && !prefersReducedMotion`
- `boardTiltStyle = { '--board-tilt-angle': '14deg' | '0deg', '--board-tilt-perspective': '900px', '--board-lift': '0px' }`
- Scene: `perspective: var(--board-tilt-perspective); perspective-origin: 50% 100%`
- Plane: flex column, `gap: 0.25rem`, `transform-origin: 50% 100%`, `transform: translateY(var(--board-lift)) rotateX(var(--board-tilt-angle))`;
  `--lift` adds `transform-style: preserve-3d` to the plane and its `.play-desktop__hq-zone`
- Row lift (under `@media (hover: hover)`, only with the `--tilt-lift` root class): `preserve-3d` on root, list, `li`, button;
  list `overflow: visible`; button `transform-origin: 50% 100%`, `transition: transform 0.15s ease-out, box-shadow 0.15s ease-out`;
  City: `.city-space:not(.city-space--choosing):hover > .city-space__villain`; HQ: `.hq-slot:hover > .hq-slot__hero`
  → `rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06)` (NO `translateY`: the bottom edge stays put, no dead click strip),
  `box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45)`;
  plus `--tilt-lift .card-tile--interactive:hover { transform: none }` (lifted card is exactly 1.06)
- Root classes: `city-row--tilt-lift`, `hq-row--tilt-lift` = `isTiltLiftEnabled && isRowFitting`; HQ button class `hq-slot__hero` (static);
  `li` `:class` becomes `[<existing column ternary>, { 'city-space--choosing': cell.kind === 'slot' && isDiscardChooserOpen(cell.cityIndex) }]`
  (one binding; the `kind` guard narrows `CityCell` for vue-tsc); HQ list ref `hqSlotsElement`
- `useRowFit` sources: City `() => props.city`; HQ `() => [props.hq, props.extraCitySpaces]`; `boardTiltStyle: ComputedRef<Record<string, string>>`
- Guard names/tolerances: `isBoardTilted` (m22 < 0.999), `hasCityBoxGaps` (> 0), `isPlaneClearOfHud` (±1), `isPlaneClearOfCockpit` (±1),
  `isHoverLifted` (> 4 px), `isHoverVisible` (`elementFromPoint` at new top + 3), `hasCityBoxGapsWhileHovered`,
  `isHoverChainIntact` (button → plane: `preserve-3d`, overflow visible, opacity 1, filter none), `isHoverBottomCovered`
  (`elementFromPoint` at old bottom − 3 is the button); the same four (no gap re-check) as `isHqHover*` on the first HQ hero;
  chooser re-check after `page.mouse.move` over its `li` (`measureChooserCoveredButtons`); `off` on its own fresh page at 1280×720, m22 ≥ 0.999
- Test deltas: useBoardTilt 5, useRowFit 4, CityRow +4, HQRow +3, PlayDesktop +3 = **+19**
- Commit: `EC-890: table perspective - the desktop board leans back and board cards straighten on hover (WP-852)`

## Guardrails
- Arena Client + the four ewiki pages only; nothing under `packages/`, `apps/server/`, `data/` changes.
- Presentation only: no new `UIState` read, store write, move, or click-handler change.
- `useSlashGesture.ts`: exactly one changed line (`export`). Do not touch its fit logic, its helpers or its return.
- Only the band, `CityRow` and the HQ zone move into the plane; player zone, prompts, turn bar, HUD, rail stay outside.
- `isTiltLiftEnabled` defaults `false`; with it false the rows' root and list class lists are byte-identical to today (every `PlayMobile`
  use). Only `hq-slot__hero` and `city-space--choosing` render everywhere, unstyled outside the lift class.
- Rows: `preserve-3d`, `overflow: visible` and the hover transform apply only under `@media (hover: hover)` and the `--tilt-lift`
  class. `PlayDesktop`: plane + HQ-zone `preserve-3d` is gated only by `play-desktop__board-plane--lift`.
- Animated / 3D properties limited to `transform` / `box-shadow`; static additions only as locked above; no JS animation, clock,
  randomness or dependency.
- Append new test cases; never edit, skip or remove an existing one. New imports go on new lines (diffs additions-only);
  any test calling `setIntensity` restores `'full'` in `finally`.

## Required `// why:` Comments
- `useBoardTilt.ts`: each constant (14° / 900 px from the prototype table; lift 0 because translating only moves the dead strip);
  why reduced motion keeps the tilt but drops the lift.
- `useRowFit.ts`: the guarded `ResizeObserver` (jsdom / old browsers); `flush: 'post'` (measure after the DOM updates).
- `PlayDesktop.vue`: the wrapper (what is inside and why the cockpit is not); bottom hinge (nothing grows past the fit frame).
- `CityRow.vue` / `HQRow.vue`: the fit gate (a scroll container forces its subtree flat and clips); hover on `li`, transform
  on the button (no flicker); bottom-edge origin (rises off the table, not into it); the `transform: none` on the inner tile.
- `CityRow.vue`: `:not(.city-space--choosing)` (depth order beats `z-index` in 3D; the chooser would hide behind the card).
- `play-surface.visual.mjs`: why gaps, not a pixel tolerance, protect the slash full-crossing rule.

## Files to Produce
- `apps/arena-client/src/composables/useBoardTilt.ts` — **new**
- `apps/arena-client/src/composables/useBoardTilt.test.ts` — **new** — 5 (constants; full; low; off; reduced motion; restore state)
- `apps/arena-client/src/composables/useRowFit.ts` — **new**
- `apps/arena-client/src/composables/useRowFit.test.ts` — **new** — 4 (fits; overflows; re-measure on content change; null)
- `apps/arena-client/src/composables/useSlashGesture.ts` — **modified** — `export` only
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — scene/plane, `useBoardTilt`, `:is-tilt-lift-enabled`, CSS
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — +3 (plane contents; 14deg at full; 0deg + no `--lift` at off)
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — prop, `useRowFit`, root class, `city-space--choosing`, CSS
- `apps/arena-client/src/components/play/CityRow.test.ts` — **modified** — +4 (no prop; fits; overflows; open chooser → `--choosing` on that `li` only)
- `apps/arena-client/src/components/play/HQRow.vue` — **modified** — prop, `ref` import, `hqSlotsElement`, `hq-slot__hero`, `useRowFit`, class, CSS
- `apps/arena-client/src/components/play/HQRow.test.ts` — **modified** — +3 (no prop + `hq-slot__hero`; fits; overflows)
- `apps/arena-client/visual/play-surface.visual.mjs` — **modified** — `measureTilt`, hover check + gaps while hovered, chooser re-check, `off` page
- `wiki/visual-effects.md`, `wiki/visual-effects-design-ancestry.md`, `wiki/play-board.md`, `wiki/testing.md` — **modified** — shipped, `last-reviewed`
- `docs/ai/post-mortems/01.6-WP-852-board-table-perspective.md` — **new** — 01.6 post-mortem
- Governance close (`SPEC:`): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24788), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`

## After Completing
- [ ] `pnpm -r build` exits 0; arena-client `test` `fail 0` and count up by exactly 19; `typecheck` exits 0
- [ ] `test:visual` PASSED at 1280×720 / 1366×768 / 1920×1080 with all new invariants, the chooser re-check and the `off` page
- [ ] Against `$base = git merge-base origin/main HEAD`: `git diff --stat $base -- …/useSlashGesture.ts` = 1 insertion, 1 deletion;
      `git diff --numstat $base -- '*.test.ts'` deletions 0 on every row; `--name-only $base -- packages apps/server data` empty
- [ ] Browser preview screenshot: board tilted, hand and rail flat, City + HQ hover straighten, Off flattens
- [ ] 01.6 post-mortem written before the `EC-890:` commit
- [ ] ewiki deployed (`wiki-viewer.yml`); §Table perspective checked live with the CF Access service-token curl
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24788 Active
- [ ] WORK_INDEX checked off with date; EC_INDEX `Done`; mindmap 📝 → ✅, `pnpm roadmap:counts:write`, `roadmap:counts:check` 0
- [ ] NUMBER-LEDGER WP-852 / EC-890 / D-24788 LANDED; `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` exit 0
- [ ] Live-on-surface verification (D-24026) after the arena-client deploy, or flagged operator-pending in WORK_INDEX
- [ ] Commits: `EC-890:` implementation, then `SPEC:` governance close

## Common Failure Smells
- Hovered card is cut off at the row edge → `overflow: visible` missing, or the row-fit gate is false.
- Card rises but stays tilted → a link in the `preserve-3d` chain is missing (plane, hq-zone, root, list, `li`, button).
- Card sinks into the table or its bottom half vanishes → `transform-origin` is not `50% 100%`.
- Card flickers at its bottom edge → the hover selector is on the button instead of the `li`.
- A click at the bottom of a lifted card does nothing → a `translateY` crept into the lift; the bottom edge must stay put.
- Board grows past the fit frame or the page scrolls → the plane's origin is not the bottom edge, or `--board-lift` is non-zero.
- `PlayMobile` rows changed → `isTiltLiftEnabled` default is not `false`, or the class is not gated on it.
- Primus discard options hidden behind the villain → the `:not(.city-space--choosing)` exclusion is missing.
- Lifted card bigger than 1.06 → the inner `.card-tile--interactive:hover` scale still compounds.
- vue-tsc can't see engine types → stale `dist`; run `pnpm -r build` first.

## Amendments (execution)

**Amendment A (2026-10-28, execution: the `EC-890:` commit).** The locked `preserve-3d` chain,
on at rest, eats clicks; the 3D links now switch on only while a liftable card is hovered.

1. **Defect.** With the §Locked Values chain active whenever the lift gate and row fit hold, the
   coplanar 3D layers (plane, HQ zone, row, list, space, button) z-fight in Chrome's hit test. On
   the untouched `mid-turn` fixture a 5×5 hit grid on each resting card missed 15–16 of 25 points
   on every HQ hero at 1280×720 (10 at 1366×768, 5 at 1920×1080) and 5 of 25 on every City
   villain at 1280×720 and 1920×1080. The miss went to `.play-desktop__board-plane` (once an
   `li.hq-slot`), so a Fight or Recruit click there did nothing. The guard caught it indirectly
   (`page.hover()` hit the plane, so `isHoverLifted` failed at 1280 HQ and 1920; the at-rest
   discard-chooser check failed at 1920, `coveredBy` the plane). With the chain flat, misses fall
   to the untilted baseline (1/25 on one HQ card corner).
2. **Change (CSS only; values unchanged).** Every `transform-style: preserve-3d` rule in §Locked
   Values is additionally gated on a liftable card being hovered: `PlayDesktop.vue`
   `.play-desktop__board-plane--lift:has(.city-row--tilt-lift .city-space:not(.city-space--choosing):hover > .city-space__villain)`
   and `…:has(.hq-row--tilt-lift .hq-slot:hover > .hq-slot__hero)` (the HQ one also on its
   `.play-desktop__hq-zone`); `CityRow.vue` / `HQRow.vue` `.<row>--tilt-lift:has(<space>:hover > <button>)`
   on the root, list, space and button. While that `:has` matches, the plane also takes
   `pointer-events: none` and its direct children `pointer-events: auto`: without that, sliding
   from a lifted card onto a neighbour and clicking at once missed 2 of 15 slides at 1366×768
   (the chain is 3D before the new card rises, and the plane wins). `overflow: visible`, origin,
   transition, the hover transform, the `--choosing` exclusion and the inner `transform: none`
   are as locked. The Guardrail line "plane + HQ-zone `preserve-3d` is gated only by
   `play-desktop__board-plane--lift`" now reads: gated by `--lift` AND the hovered-card `:has`.
3. **Guard.** `play-surface.visual.mjs` gains `measureRestingHits()` → `isRestingCardHitIntact`
   (a 3×3 interior grid on every City villain and HQ hero hits its own button; failure
   `"<label>: a resting City or HQ card does not take its own clicks under the tilt"`), measured
   after `measureTilt`. Its header comment lists the WP-852 invariants and the arena-client
   install line.
4. **Verified after the change.** Resting misses at baseline on all three widths; hover lifts
   and holds at all three; 15/15 slide-and-click on neighbours across two runs; full
   `test:visual` PASSED. No locked value, file or test count changes (+19 stands).
