# WP-852 — Table perspective: the desktop board leans back like a table, and board cards straighten toward the player on hover (Arena Client)

**Status:** Draft 2026-10-28 (EC-890; D-24788 reserved). Gates: 01.4 pre-flight READY TO EXECUTE (rounds 1–2 NOT READY → PS-1..3 fixed; re-confirmed after every later edit); 01.7 copilot RISK → PASS (re-confirmed after the lint fixes); 00.3 FAIL → PASS (independent reviewer; self-review below).
**Primary Layer:** Arena Client (presentation only): single layer, standard two-session lane
**Dependencies:** WP-688 (scale-to-fit desktop board, D-24505) ✅, WP-699 (hand hover lift, the `shouldRender('particles')` + reduced-motion gate) ✅, WP-556 (Effect Intensity, D-24365) ✅, WP-756 / WP-761 (slash to fight, the row-fit measurement) ✅, WP-689 (Playwright play-surface guard, D-24506) ✅. All on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (the desktop play board, viewport ≥ 768 px)

> Baseline: `origin/main` at `9e5b4b3a` (PR #3080, which reserved WP-852 / EC-890 / D-24788).

---

## Goal

As a player on the desktop board, I want the shared board (Mastermind, Scheme, supply, City and
HQ) to lean back like a table seen from my chair, with my hand and the side panel left flat, and
I want a City villain or HQ hero to stand up square to me when I point at it, so that the board
feels like a physical table and I can still read every card.

## User-Visible Impact

On play.legendary-arena.com, desktop layout only:

- **The board tilts.** The adversary band (Mastermind, Scheme, supply decks, KO pile), the City
  row and the HQ row lean away from the player by 14° around their bottom edge, with a 900 px
  perspective. The far edge of the band is drawn about 6% narrower than the near edge. The hand,
  the played-cards row, the economy and piles, the turn bar, any pending-choice prompt, the top
  status bar and the right rail (opponents and game log) stay flat.
- **Cards straighten on hover.** On a pointer device, hovering an occupied City space or HQ slot
  stands that card (and its Fight / discard-cost badges) up: it rotates back by the board's angle
  around its bottom edge so it faces the player square on, and grows to 1.06. The bottom edge
  stays where it was, so the card rises off the table instead of sinking into it, and every point
  of the resting card stays covered by the lifted card (a click anywhere on it still lands on
  the button). Moving away settles it back in 150 ms. Fight and Recruit work exactly as before: a
  click still fights or recruits, and a disabled card still shows its reason. The hover target is
  the whole City space or HQ slot, so pointing at a space's side label, captured cards or its
  Excessive Violence / Fight + Rescue buttons also lifts its card. The lifted card is exactly
  1.06 (the tile's own 1.05 hover scale is switched off while the lift is on). While it is lifted
  it hides the space's Dark Portal marker and overlaps the neighbouring label and the left edge
  of an Excessive Violence or Fight + Rescue button by a few pixels; all come back when the
  pointer leaves.
- **The Primus discard chooser is never covered.** While a space's fight discard chooser
  (WP-817) is open, that space does not lift, so the chooser's buttons stay on top.
- **Effect Intensity `off` flattens the board** (angle 0°) and turns the hover lift off.
  **`low` and `full`** keep both. **An OS reduced-motion setting** keeps the static tilt (it is
  not motion) and turns the hover lift off, the same gate as the WP-699 hand lift.
- **When a row scrolls sideways** (a scheme adds City columns and the row no longer fits), that
  row keeps its scrolling and its plain hover; only the straighten-on-hover is skipped.
- **Mobile (`PlayMobile`, < 768 px) is unchanged.**
- There is a strip of empty table between the top status bar and the tilted band (about 49
  screen px at 1440×900). It is the room the far edge gives up as it leans back; see Context.

## Assumes

Each line was checked against `origin/main` at `9e5b4b3a`.

- `apps/arena-client/src/pages/PlayDesktop.vue` renders, inside `.play-desktop__main` (~L879), the
  `<section class="play-desktop__adversary-band">` (~L884), then `<CityRow …>` (~L927), then
  `<div class="play-desktop__hq-zone">` (~L947, holding `<HQRow>` and `<TransformDeck>`), then the
  viewer-only `<section class="play-desktop__player-zone">` (~L970), then the prompts and the turn
  bar. `.play-desktop__main` is `display: flex; flex-direction: column; gap: 0.25rem` (~L1552).
  `<TopHudBar>` renders above the grid inside `.play-desktop__stage` (~L819).
- No stylesheet selects those three board zones through a direct-child combinator from
  `.play-desktop__main`: `PlayDesktop.vue` uses `.play-desktop__adversary-band > .shared-decks`
  and `.play-desktop__hq-zone > .transform-deck` (zone-internal), and
  `src/styles/playmat-slots.css` uses descendant selectors (`.play-viewport .play-desktop__hq-zone`,
  `.play-viewport .play-desktop__stage .play-desktop__hq-zone`). Wrapping the three zones in two
  new `div`s therefore changes no existing rule's match.
- `PlayDesktop.vue` does not import `useEffectIntensity` today.
- `apps/arena-client/src/vfx/effectIntensity.ts` exports `useEffectIntensity()` returning
  `{ intensity, prefersReducedMotion, setIntensity, shouldRender }` (singleton refs);
  `EffectIntensity = 'off' | 'low' | 'full'`; `shouldRender('particles')` is false at `off` and
  under reduced motion, true otherwise.
- The WP-699 hand lift (`apps/arena-client/src/components/play/CardTile.vue` ~L69–80, CSS
  ~L190–220) is enabled by `handLift && interactive && shouldRender('particles') &&
  !prefersReducedMotion`, lives under `@media (hover: hover)`, and is
  `translateY(-12px) scale(1.06)` with `box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45)` over 150 ms.
  City and HQ tiles leave `handLift` off and keep `.card-tile--interactive:hover { transform:
  scale(1.05) }` (~L186).
- `apps/arena-client/src/components/play/CityRow.vue`: the row root is `.city-row`; the list is
  `<ol class="city-spaces" ref="cityRowEl">` (~L504) with `.city-spaces { overflow-x: auto }`
  (~L745–752); each space is `<li class="city-space">`, and an occupied space's direct child is
  `<button class="city-space__villain" data-testid="play-city-villain">` (~L557–563) containing
  the `CardTile` and the Fight / discard-cost badges. CityRow already takes the layout prop
  `isColumnAligned`.
- `apps/arena-client/src/components/play/HQRow.vue`: root `<section class="hq-row">` (~L144);
  `<ol class="hq-slots">` (~L149) with `.hq-slots { overflow-x: auto }` (~L225–232); each slot is
  `<li class="hq-slot">`, and an occupied hero slot's direct child is an **unclassed**
  `<button data-testid="play-hq-hero">` (~L175–178) containing the `CardTile`.
- `apps/arena-client/src/composables/useSlashGesture.ts` defines a module-private
  `measureRowFits(row: HTMLElement): boolean` (~L232) with its helpers `overflowsHorizontally`
  (~L217), `isHorizontalScroller` (~L221) and `FIT_SLACK_PX = 1` (~L68): the row fits when it
  and every horizontally scrolling ancestor do not overflow and its rect lies inside the
  viewport width. It re-measures on mount, on content change, through a guarded
  `ResizeObserver` and on window `resize` (~L837–856).
- `apps/arena-client/visual/play-surface.visual.mjs` is the WP-689 Playwright guard: it loads
  `/?fixture=mid-turn&play=1` on the **dev** server at 1280×720, 1366×768 and 1920×1080,
  `page.evaluate(measureInvariants)` (~L141), then stages the WP-817 discard chooser and checks
  its buttons are clickable (~L193). It is run on demand (`pnpm --filter
  @legendary-arena/arena-client test:visual`), not in CI (`wiki/testing.md` ~L246–275).
- The `mid-turn` fixture has three City villains, two empty City spaces, four HQ heroes and a
  five-card hand (observed in the 2026-10-28 prototype).
- Tests run under `node:test` with `../../testing/jsdom-setup`; jsdom has no layout engine
  (`getBoundingClientRect` returns zeros, `scrollWidth` / `clientWidth` are 0 unless stubbed) and
  no `ResizeObserver`.

## Context (Read First)

- `.claude/rules/architecture.md` §Engine Owns Truth, §Layer Boundary; `.claude/rules/code-style.md`.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (UI consumes read-only projections).
- `wiki/visual-effects.md` §Table perspective (`#table-perspective`, PRs #3078 / #3079): the
  design this WP builds, including the reference games. §Card-interaction & hand feel, the
  accessibility gate and the library posture (hand-rolled CSS `transform`, no new dependency,
  D-24365) are **authoritative** for the gating.
- `docs/ai/DECISIONS.md`: D-24365 (VFX foundation, Effect Intensity), D-24502 / D-24505 (fixed
  1280×720 authored board, scale-to-fit), D-24506 (the Playwright guard), D-24585 / D-24592
  (slash to fight; the full-crossing rule; the row-fit measurement), D-24026 (live verify).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Prototype (2026-10-28, real board, `mid-turn` fixture at 1440×900, scale 0.81).** The three
zones were wrapped in a perspective scene in the dev server and measured:

| Setting | Far edge narrower | Worst far-corner box slop (City) | Smallest gap between neighbouring City boxes |
|---|---|---|---|
| flat | 0% | 0 px | 22.3 px |
| 8° / 1600 px | ~2% (barely visible) | 2.5 px | 19.3 px |
| 14° / 900 px | ~6% (reads as a table) | 6.6 px | 13.6 px |
| 20° / 900 px | ~9% (band text strains) | 9 px | 10.5 px |

So the locked value is **14° / 900 px**, not the ewiki page's earlier "6–10°" guess: an angle
means nothing without the perspective distance, and 6–10° at a far vanishing point is almost
invisible on this board. "Box slop" is how far `getBoundingClientRect()` (an axis-aligned box)
reaches past the card's visible trapezoid at its far corners, probed with `elementFromPoint`.
Neighbouring boxes never touched at any angle, so the slash gesture's full-crossing rule and the
VFX overlay anchors keep working without code changes. The guard below pins that, on the resting
board and with a card lifted: `collectCandidateTiles` (`useSlashGesture.ts` ~L427) measures each
tile once at stroke start, when the card under the pointer may be lifted, and pointer capture on
the row can then drop the hover mid-stroke while the stroke keeps the lifted rect. The D-24026
live slash check covers the behaviour end to end; the post-mortem names this coupling.

**Why the hover needs the row-fit gate.** `.city-spaces` and `.hq-slots` are `overflow-x: auto`
scroll containers. A non-`visible` overflow forces its subtree flat and clips it, so inside one a
card can neither counter-rotate nor rise out of the row: the prototype showed a
`translateZ(50px) scale(1.1)` hover rule clipped at the row edge with the Z ignored. The
straighten works only with `overflow: visible` and `transform-style: preserve-3d` on every element
from the tilted plane down to the button (verified in the prototype for both City and HQ). Those
rows must keep their sideways scroll when they do not fit (the long-press slash depends on it,
D-24592), so the lift switches on only while the row fits. A cloned card in a separate overlay
layer for the scrolling case was considered and rejected: the desktop board is authored to fit
(D-24502), so the scrolling case is rare, and a clone would duplicate the card's rendering,
badges and click target for no gain.

**Why the hover rule sits on the `li`, and the transform on the button.** A transform that moves
the hovered element can move it out from under the pointer and flicker. The `li` keeps its box,
so `li:hover` holds while the button inside it rises.

**Why no lift into the dead strip.** Leaning back pulls the far edge down, leaving about 60
authored px (49 screen px at 1440×900) of empty table above the band. Translating the plane up
does not remove that space: it moves the hinge too, and the same amount opens between the HQ and
the cockpit. Growing the board's authored height to fill it would reopen the D-24502 geometry
lock. So the strip stays at the top, the hinge stays flush with the cockpit, and
`--board-lift` exists as a one-line tuning knob locked at `0px` here.

**Supersession check (01.0a Step 2):** `git log --all -i --grep="perspective\|board-tilt\|table
tilt"`, `ls` for `*tilt*` / `*perspective*` and `gh pr list --state all --search "table
perspective"` found only the two ewiki PRs this WP builds on (#3078, #3079). WP-849
(card-transfer flight, drafted, not executed) anchors its Wound flight on the supply cell inside
the band this WP tilts; it measures with `getBoundingClientRect`, which the table above covers,
so the two WPs do not depend on each other in either order.

Not Lightweight Lane: 12 code/test files (01.0a eligibility #2), and the surface is not
input-validation or copy (#6). The WP adds new client abstractions (`useBoardTilt`, `useRowFit`),
so a 01.6 post-mortem is mandatory.

## Scope (In)

1. **`src/composables/useBoardTilt.ts` (new).** Exports `BOARD_TILT_ANGLE_DEGREES = 14`,
   `BOARD_TILT_PERSPECTIVE_PX = 900`, `BOARD_LIFT_PX = 0`, and `useBoardTilt()` returning
   `{ isTiltActive, isBoardLiftEnabled, boardTiltStyle }` (`ComputedRef<boolean>`,
   `ComputedRef<boolean>`, `ComputedRef<Record<string, string>>`, the `HandRow.vue` inline
   custom-property precedent), read from `useEffectIntensity()`:
   - `isTiltActive = intensity !== 'off'`
   - `isBoardLiftEnabled = isTiltActive && shouldRender('particles') && !prefersReducedMotion`
   - `boardTiltStyle = { '--board-tilt-angle': '<angle>deg', '--board-tilt-perspective': '900px',
     '--board-lift': '0px' }`, where `<angle>` is `14` when `isTiltActive` and `0` otherwise.
2. **`src/composables/useRowFit.ts` (new).** `useRowFit(rowElement: Ref<HTMLElement | null>,
   contentSource: () => unknown): Readonly<Ref<boolean>>`. The ref is `rowElement.value !== null
   && measureRowFits(rowElement.value)`, re-measured on mount and whenever `rowElement` changes
   (`flush: 'post'`, immediate), when `contentSource()` changes (`flush: 'post'`), through a
   `ResizeObserver` on the row when the constructor exists, and on window `resize`. Observer and
   listener are removed in `onScopeDispose`. Mirrors `useSlashGesture` ~L837–866.
3. **`src/composables/useSlashGesture.ts` (modified).** Add `export` to `measureRowFits`. No other
   change (its helpers stay module-private; its own fit logic is untouched).
4. **`src/pages/PlayDesktop.vue` (modified).**
   - Wrap the adversary band, the `CityRow` and the HQ zone, in that order, in
     `<div class="play-desktop__board-scene" :style="boardTiltStyle"><div
     class="play-desktop__board-plane" :class="{ 'play-desktop__board-plane--lift':
     isBoardLiftEnabled }"> … </div></div>`, placed where the band is now. Nothing else moves
     into or out of the plane; the player zone, prompts and turn bar stay siblings after the
     scene.
   - Call `useBoardTilt()` in `setup` and pass `:is-tilt-lift-enabled="isBoardLiftEnabled"` to `CityRow` and
     `HQRow`.
   - CSS (locked values in §Contract): the scene's `perspective` and `perspective-origin`; the
     plane's flex column, `transform-origin`, `transform`; under `--lift`, `transform-style:
     preserve-3d` on the plane and on `.play-desktop__hq-zone` inside it.
5. **`src/components/play/CityRow.vue` (modified).** New optional prop `isTiltLiftEnabled: Boolean`
   (default `false`). `const isRowFitting = useRowFit(cityRowEl, () => props.city)`; root class
   `city-row--tilt-lift` when `props.isTiltLiftEnabled && isRowFitting.value`. Each `li.city-space`'s
   existing string `:class` (~L518) becomes the array
   `:class="[cell.kind === 'slot' || cell.kind === 'gone' ? 'city-space--space-column' : 'city-space--edge-column', { 'city-space--choosing': cell.kind === 'slot' && isDiscardChooserOpen(cell.cityIndex) }]"`
   (the `kind` guard narrows the `CityCell` union, whose `escaped` / `villainDeck` members have no
   `cityIndex`; `isDiscardChooserOpen` is the existing function, ~L342), so an open WP-817
   chooser's space never lifts. Scoped CSS under
   `@media (hover: hover)` (§Contract).
6. **`src/components/play/HQRow.vue` (modified).** New optional prop `isTiltLiftEnabled: Boolean` (default
   `false`); add `ref` to the `vue` import; new template ref `hqSlotsElement` on
   `<ol class="hq-slots">`; add the static class `hq-slot__hero` to the hero `<button>` on every
   surface (it is styled only under the lift class); `const isRowFitting = useRowFit(hqSlotsElement,
   () => [props.hq, props.extraCitySpaces])` (the extra spacer columns change the row's width);
   root class `hq-row--tilt-lift` when `props.isTiltLiftEnabled && isRowFitting.value`. Scoped CSS as
   CityRow, without the `--choosing` exclusion (the HQ has no chooser).
7. **Unit tests** (counts in §Acceptance Criteria): two new files
   (`useBoardTilt.test.ts`, `useRowFit.test.ts`) and new cases appended to `CityRow.test.ts`,
   `HQRow.test.ts`, `PlayDesktop.test.ts`. No existing test case is edited or removed; any
   import a new case needs (for example `nextTick`) comes in on a **new** import line, so each
   modified test file's diff is additions only.
8. **`visual/play-surface.visual.mjs` (modified).** New geometry invariants, measured on the
   untouched fixture at each of the three widths, a hover check, and one `off` check
   (§Contract). The existing `measureInvariants` and `measureDiscardChooser` checks are
   unchanged. After the discard-chooser check passes (the chooser is left open), a new step moves
   the mouse over the chooser's own City space and re-checks that every chooser button is still
   the topmost element at its centre (the case the `--choosing` exclusion protects).
9. **ewiki (modified).** `wiki/visual-effects.md` §Table perspective: proposal → shipped
   (WP-852 / D-24788) with the locked values and the prototype table; the feel-table "Table
   tilt" row → shipped; `wiki/visual-effects-design-ancestry.md` Hearthstone adoption row and
   cross-walk entry → shipped; `wiki/play-board.md` §Desktop layout pointer "proposed" → shipped;
   `wiki/testing.md` §Play-surface guard "What it asserts" and the pass-output line list the new
   invariants, and its browser-install line becomes `pnpm --filter @legendary-arena/arena-client
   exec playwright install chromium` (a root `npx` can fetch a Playwright that does not match
   arena-client's). `last-reviewed` bumped on each.

## Out of Scope

- Lifting the Mastermind, Scheme, supply or KO tiles in the adversary band, the Escaped pile,
  the Villain / Hero deck cells, or the Transform deck. They tilt with the board and keep their
  current hover.
- Any change to the hand, in-play row, cockpit, prompts, turn bar, HUD, rail or `PlayMobile`.
- Any change to the slash gesture's behaviour, its full-crossing rule, its fit logic or the VFX
  overlay's anchoring code (the guard pins that they still hold).
- A per-player setting for the angle, or a separate on/off toggle (Effect Intensity `off` is the
  off switch).
- Lighting, shadows on the table, card weight, dealing animation, or any other "physical table"
  idea from the ewiki page.
- Reclaiming the dead strip (see Context); any change to `useScaleToFit` or the authored 1280×720
  geometry.
- Wiring the Playwright guard into CI (its own follow-on per `wiki/testing.md`).
- Any engine, server, `UIState`, registry or card-data change.

## Files Expected to Change

1. `apps/arena-client/src/composables/useBoardTilt.ts` — new — locked constants + `useBoardTilt()`
2. `apps/arena-client/src/composables/useBoardTilt.test.ts` — new — 5 tests
3. `apps/arena-client/src/composables/useRowFit.ts` — new — `useRowFit()`
4. `apps/arena-client/src/composables/useRowFit.test.ts` — new — 4 tests
5. `apps/arena-client/src/composables/useSlashGesture.ts` — modified — `export` on `measureRowFits` only
6. `apps/arena-client/src/pages/PlayDesktop.vue` — modified — scene/plane wrapper, `useBoardTilt`, `:is-tilt-lift-enabled`, CSS
7. `apps/arena-client/src/pages/PlayDesktop.test.ts` — modified — +3 tests appended
8. `apps/arena-client/src/components/play/CityRow.vue` — modified — `isTiltLiftEnabled` prop, `useRowFit`, lift class, `city-space--choosing`, CSS
9. `apps/arena-client/src/components/play/CityRow.test.ts` — modified — +4 tests appended
10. `apps/arena-client/src/components/play/HQRow.vue` — modified — `isTiltLiftEnabled` prop, `hqSlotsElement`, `hq-slot__hero`, `useRowFit`, lift class + CSS
11. `apps/arena-client/src/components/play/HQRow.test.ts` — modified — +3 tests appended
12. `apps/arena-client/visual/play-surface.visual.mjs` — modified — tilt invariants, hover check (+ gaps while hovered), chooser-hovered re-check, `off` check
13. `wiki/visual-effects.md` — modified — §Table perspective shipped, feel-table row
14. `wiki/visual-effects-design-ancestry.md` — modified — Hearthstone row + cross-walk → shipped
15. `wiki/play-board.md` — modified — pointer → shipped
16. `wiki/testing.md` — modified — guard invariants + pass output + install line

Post-mortem (mandatory per 01.6, new client abstractions): `docs/ai/post-mortems/01.6-WP-852-board-table-perspective.md` — new.

Governance (execution close, `SPEC:` commit): `docs/ai/DECISIONS.md` (D-24788), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md` (+ `pnpm roadmap:counts:write`), `docs/ai/NUMBER-LEDGER.md` (LANDED marks).

## Contract

**Constants and composables (locked):**

- `BOARD_TILT_ANGLE_DEGREES = 14`, `BOARD_TILT_PERSPECTIVE_PX = 900`, `BOARD_LIFT_PX = 0`.
- `useBoardTilt()` values by state:

  | Intensity | Reduced motion | `isTiltActive` | `isBoardLiftEnabled` | `--board-tilt-angle` |
  |---|---|---|---|---|
  | `full` | no | true | true | `14deg` |
  | `low` | no | true | true | `14deg` |
  | `full` or `low` | yes | true | false | `14deg` |
  | `off` | either | false | false | `0deg` |

  `--board-tilt-perspective` is always `900px` and `--board-lift` always `0px`.
- `useRowFit` returns `false` while the element is `null`, and otherwise exactly what
  `measureRowFits` returns at the latest trigger.

**`PlayDesktop.vue` CSS (locked):**

```css
.play-desktop__board-scene {
  perspective: var(--board-tilt-perspective);
  perspective-origin: 50% 100%;
}
.play-desktop__board-plane {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transform-origin: 50% 100%;
  transform: translateY(var(--board-lift)) rotateX(var(--board-tilt-angle));
}
.play-desktop__board-plane--lift,
.play-desktop__board-plane--lift .play-desktop__hq-zone {
  transform-style: preserve-3d;
}
```

**`CityRow.vue` scoped CSS (locked; HQRow is the same with `.hq-row--tilt-lift`, `.hq-slots`,
`.hq-slot`, `.hq-slot__hero`, and a plain `.hq-slot:hover` with no `:not(…)`):**

```css
@media (hover: hover) {
  .city-row--tilt-lift,
  .city-row--tilt-lift .city-spaces,
  .city-row--tilt-lift .city-space,
  .city-row--tilt-lift .city-space__villain {
    transform-style: preserve-3d;
  }
  .city-row--tilt-lift .city-spaces {
    overflow: visible;
  }
  .city-row--tilt-lift .city-space__villain {
    transform-origin: 50% 100%;
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  .city-row--tilt-lift .city-space:not(.city-space--choosing):hover > .city-space__villain {
    transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .city-row--tilt-lift .card-tile--interactive:hover {
    transform: none;
  }
}
```

**Why no `translateY` (unlike the WP-699 hand lift).** The transform origin is the bottom edge, so
`rotateX` and `scale` both leave that edge in place and the lifted card covers every point of the
resting card. A `translateY(-12px)` would raise the bottom edge too and leave a strip at the
bottom of the space that, while `li:hover` holds the card up, hits the `li` (no handler): a
player who entered from below and clicked at once would miss the fight or recruit. Standing
up from the edge still raises the top: the prototype measured a City card at 84 screen px tall
tilted and ~96 px flat at 1440×900, so straightened and scaled 1.06 its top rises by an estimated
~17 px (the guard requires more than 4). The prototype's hover screenshots used a 12 px
`translateY` as well; the guard's `isHoverLifted` check confirms the lift without it.

The last rule switches off `CardTile`'s own `.card-tile--interactive:hover { transform:
scale(1.05) }` inside a lifting row, so the lifted card is exactly 1.06. It matches because a
child component's root element carries the parent's scope attribute, which also makes it more
specific than CardTile's own rule. Rows without the lift class keep the 1.05 hover.

**Why `:not(.city-space--choosing)`.** The WP-817 discard chooser is an `inset: 0`, `z-index: 3`
overlay inside the same `li` (`CityRow.vue` ~L657, CSS ~L1127). Inside a `preserve-3d` context,
depth order beats `z-index`, so a raised button would paint in front of the flat chooser, and
the pointer is over that `li` right after the click that opened it.

**Playwright guard additions (`visual/play-surface.visual.mjs`, locked names and tolerances):**
a new `measureTilt()` evaluated after `measureInvariants`, returning and failing on:

- `isBoardTilted` — `new DOMMatrix(getComputedStyle(plane).transform).m22 < 0.999` for
  `.play-desktop__board-plane`. Failure: `"<label>: board plane is not tilted"`.
- `hasCityBoxGaps` — the rects of every `[data-testid="play-city-villain"]` and
  `[data-testid="play-city-empty"]`, sorted by `left`, have `next.left - previous.right > 0`
  for every neighbour pair. Failure: `"<label>: neighbouring City boxes touch or overlap under the tilt"`.
- `isPlaneClearOfHud` — plane rect `top >= .top-hud-bar rect bottom - 1`. Failure: `"<label>: tilted board overlaps the top status bar"`.
- `isPlaneClearOfCockpit` — plane rect `bottom <= .play-desktop__player-zone rect top + 1`. Failure: `"<label>: tilted board overlaps the cockpit"`.

Then a hover check: record the first `[data-testid="play-city-villain"]` rect, `page.hover()` its
centre, wait 300 ms, re-measure: `isHoverLifted` = new `top < old top - 4`;
`isHoverVisible` = `document.elementFromPoint(centreX, newTop + 3)` is inside that button; and
`hasCityBoxGapsWhileHovered` = the `hasCityBoxGaps` test re-run with the card lifted
(the slash gesture measures its tiles once, at stroke start, possibly with the card under the
pointer lifted); `isHoverChainIntact` = walking from the hovered button up to
`.play-desktop__board-plane` inclusive, every element's computed `transform-style` is
`preserve-3d`, its `overflow-x` and `overflow-y` are `visible`, its `opacity` is `1` and its
`filter` is `none` (a broken link flattens the card, which then rises but stays tilted and would
pass the two checks above); and `isHoverBottomCovered` = `document.elementFromPoint(centreX,
oldBottom - 3)` is inside that button (no dead strip under a lifted card). Failures:
`"<label>: hovered City card did not lift"`, `"<label>: hovered City card is clipped or covered"`,
`"<label>: neighbouring City boxes touch while a card is lifted"`,
`"<label>: hovered City card lifts but stays tilted (preserve-3d chain broken)"`,
`"<label>: the bottom of a lifted City card does not hit its button"`. Then
`page.mouse.move(0, 0)` to clear the hover.

The same block, minus the gap re-check, then runs on the first `[data-testid="play-hq-hero"]`
as `isHqHoverLifted`, `isHqHoverVisible`, `isHqHoverChainIntact` and `isHqHoverBottomCovered` (the HQ
chain has the extra `.play-desktop__hq-zone` link and its own CSS), with the failure messages
reading "HQ" for "City", followed by `page.mouse.move(0, 0)`.

Then the existing discard-chooser check, unchanged. If it passed, a new step reads the open
chooser's `li.city-space` rect, `page.mouse.move()`s to its centre (a raw mouse move, because
the chooser covers the villain button and `page.hover()` would refuse), waits 300 ms, and
evaluates a new `measureChooserCoveredButtons()` that repeats the existing covered-buttons loop
on `[data-testid="play-city-discard-chooser"]`. Failure:
`"<label>: discard chooser covered while its space is hovered"`.

Finally, once, at 1280×720, on its own fresh page: set
`localStorage.arenaClientEffectIntensity = 'off'` (an init script before load), load the fixture,
and require `m22 >= 0.999` (`"1280x720 off: board still tilted at Effect Intensity off"`).

Preconditions the guard relies on: every other page is a fresh browser context, so Effect
Intensity is the default `full`; headless Chromium reports `(hover: hover)`, so the lift CSS
applies; `new DOMMatrix('none')` is the identity, so the `m22` checks are valid when no transform
is set.

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+. `node:test` only; no `boardgame.io` import in any test.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full-word
  names, functions under ~30 lines, no nested ternaries, `// why:` on non-obvious decisions).

**Packet-specific:**
- Arena Client only (plus the four ewiki pages). No file under `packages/`, `apps/server/` or
  `data/` changes.
- Presentation only: no `UIState` read is added, no move, no store write, no click handler changes.
- Animated and 3D properties are limited to `transform` / `box-shadow`; the only static
  additions are the §Contract rules (the plane's flex column mirrors `.play-desktop__main`); no
  layout property animates; no new dependency, no canvas, no JS animation.
- The tilt reads only `useEffectIntensity()`; it never reads a clock or randomness.
- `useSlashGesture.ts` gains exactly the `export` keyword on `measureRowFits`; `git diff` on that
  file is one line.
- In `CityRow` / `HQRow`, the row-lift styles (`preserve-3d`, `overflow: visible`, the hover
  transform) apply only under `@media (hover: hover)` and the `--tilt-lift` root class, which is
  bound only while `isTiltLiftEnabled && isRowFitting`. In `PlayDesktop`, `preserve-3d` on the
  plane and its HQ zone is gated only by `play-desktop__board-plane--lift`, exactly as in
  §Contract. With `isTiltLiftEnabled` false (every `PlayMobile` use), the rows' root and list
  class lists are byte-identical to today. Two static additions render on
  every surface and are styled only under the lift class: the HQ hero button's `hq-slot__hero`
  class, and the `city-space--choosing` class on a City space whose discard chooser is open.
- No existing test case is edited, skipped or removed; new cases are appended.

**Session protocol:** if any assumption above does not hold on `main` at execution time, or a
change outside the listed files seems needed, stop and ask — do not improvise.

## Vision Alignment

**Vision clauses touched:** §17 (accessibility: the lift honours the reduced-motion and
Effect-Intensity gates, and `off` flattens the board), §8 / §22 (determinism), NG-1 (no
pay-to-win).

**Conflict assertion:** No conflict: this WP preserves all touched clauses.

**Non-Goal proximity check:** display only. It changes no outcome, VP, PAR or standing, and no
purchase or cosmetic touches it. NG-1..8 not crossed. It is product polish on the board every
match uses (Operating Posture: ship a better product).

**Determinism preservation:** no engine file changes, so `finalStateHash`, `PRE_WP080_HASH` and
replays are untouched by construction; the tilt uses no randomness or clock reads.

**Funding Surface Gate (§20):** N/A — presentation only; no funding affordance or copy.

## Acceptance Criteria

1. `useBoardTilt.test.ts` (5 tests): the three constants are 14, 900, 0; at `full` the style
   object is `{ '--board-tilt-angle': '14deg', '--board-tilt-perspective': '900px',
   '--board-lift': '0px' }` and both flags are true; at `low` both flags are true; at `off` the
   angle is `'0deg'` and both flags are false; under reduced motion at `full`
   `isTiltActive` is true and `isBoardLiftEnabled` is false. Each test restores intensity and
   reduced motion afterwards.
2. `useRowFit.test.ts` (4 tests), mounting a minimal component that binds the ref: with the row's
   `scrollWidth` stubbed equal to `clientWidth` and its rect inside `window.innerWidth`, the
   value is `true`; with `scrollWidth = clientWidth + 2`, `false`; a fitting row whose
   `scrollWidth` is then raised re-reads `false` after the content source changes; a `null`
   element reads `false`.
3. `CityRow.test.ts` (+4): with no `isTiltLiftEnabled` prop the root has no `city-row--tilt-lift` class;
   with `isTiltLiftEnabled` true and a fitting `.city-spaces` (stubbed, then `window` `resize`
   dispatched) the class is present; with `isTiltLiftEnabled` true and an overflowing row it is absent;
   with a villain whose `fightDiscardCosts` is set and a payable hand, clicking its Fight opens
   the chooser and that space's `li` gains `city-space--choosing` (no other `li` has it).
4. `HQRow.test.ts` (+3): the same three cases, where the root `.hq-row` gains or lacks
   `hq-row--tilt-lift` with `.hq-slots` stubbed as fitting or overflowing; and every
   rendered `[data-testid="play-hq-hero"]` has the class `hq-slot__hero` (asserted inside the
   first case).
5. `PlayDesktop.test.ts` (+3): `.play-desktop__board-plane` contains the adversary band,
   `[data-testid="play-city-row"]` and `.play-desktop__hq-zone`, and does not contain
   `.play-desktop__player-zone`; at `full` the scene's inline style sets `--board-tilt-angle:
   14deg`; at `off` it sets `--board-tilt-angle: 0deg` and the plane lacks
   `play-desktop__board-plane--lift`. The `off` case calls `setIntensity('full')` in a `finally`
   (the setter persists to localStorage).
6. `pnpm --filter @legendary-arena/arena-client test` passes with 0 failures and exactly **+19**
   tests over the pre-execution count.
7. `pnpm --filter @legendary-arena/arena-client test:visual` exits 0 at all three widths with the
   new invariants (`isBoardTilted`, `hasCityBoxGaps`, `isPlaneClearOfHud`,
   `isPlaneClearOfCockpit`, `isHoverLifted`, `isHoverVisible`, `hasCityBoxGapsWhileHovered`,
   `isHoverChainIntact`, `isHoverBottomCovered`, `isHqHoverLifted`, `isHqHoverVisible`,
   `isHqHoverChainIntact`, `isHqHoverBottomCovered`, and the chooser-hovered re-check) all passing, the existing invariants and the discard-chooser
   check still passing, and the `off` page flat.
8. `git diff $(git merge-base origin/main HEAD) -- apps/arena-client/src/composables/useSlashGesture.ts`
   shows exactly one changed line (`function measureRowFits` → `export function measureRowFits`).
9. No file under `packages/`, `apps/server/` or `data/` changed; no existing test case edited
   (`git diff --numstat $(git merge-base origin/main HEAD) -- '*.test.ts'` shows `0` in the
   deletions column on every row).
10. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Verification Steps

```pwsh
pnpm -r build                                                     # exits 0
pnpm --filter @legendary-arena/arena-client test                  # "fail 0", count +19
pnpm --filter @legendary-arena/arena-client typecheck             # exits 0
pnpm --filter @legendary-arena/arena-client exec playwright install chromium                                   # one-time
pnpm --filter @legendary-arena/arena-client test:visual           # "play-surface visual guard PASSED"
$base = git merge-base origin/main HEAD                           # diff against the branch point, not a moving origin/main
git diff --stat $base -- apps/arena-client/src/composables/useSlashGesture.ts   # 1 insertion, 1 deletion
git diff --numstat $base -- '*.test.ts'                           # deletions column (2nd field) is 0 on every row
git diff --name-only $base -- packages apps/server data           # empty
git status --short                                                # only the allowlisted files (+ post-mortem, governance at close)
pnpm ledger:numbers:check; pnpm workindex:rows:check; pnpm workindex:executed:check   # each exits 0 (at close)
```

Browser preview: start the `arena-client` dev server, open `/?fixture=mid-turn&play=1` at a
desktop viewport, confirm by screenshot that the band, City and HQ lean back and the hand and
rail are flat; hover a City villain and an HQ hero and confirm each rises and squares up; set
Effect Intensity to Off in the sound bar and confirm the board is flat; set it back.

D-24026 after the arena-client deploy: on play.legendary-arena.com, desktop, in a real match,
confirm the tilt, the hover straighten on a City villain and an HQ hero, that clicking still
fights and recruits (including a click near the bottom edge of a lifted card), that a slash
across the City row still fights the crossed villains, that a slash that starts on a hovered
(lifted) villain's space still fights the villains it fully crosses, and that Effect Intensity
Off flattens the board.

## Definition of Done

- [ ] Acceptance Criteria 1–10 pass; command output tails pasted in the execution PR.
- [ ] No files outside `## Files Expected to Change` and the listed governance files were
      modified (`git diff --name-only` checked).
- [ ] 01.6 post-mortem written (before the `EC-890:` commit); it names the overflow-flattening
      constraint, the row-fit coupling, the chooser depth-order exclusion and the slash
      gesture's stroke-start measurement of a possibly lifted tile.
- [ ] The four ewiki pages updated, `last-reviewed` bumped; after the `wiki-viewer.yml` deploy the
      §Table perspective section is checked live (CF Access service-token curl).
- [ ] `docs/ai/DECISIONS.md` — D-24788 landed Active.
- [ ] `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` exit 0.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date; EC_INDEX row `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node 📝 → ✅; `pnpm roadmap:counts:write`, then
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/NUMBER-LEDGER.md` WP-852 / EC-890 / D-24788 marked LANDED.
- [ ] Two-commit topology (`EC-890:` implementation + `SPEC:` governance close); PR squash-merged.
- [ ] Live-on-surface verification (D-24026) on play.legendary-arena.com — or flagged
      operator-pending in WORK_INDEX.

## Reserved Decision (lands at execution)

**D-24788** — The desktop board's table perspective is presentation-only CSS on one wrapper
around the adversary band, City and HQ: `rotateX(14deg)` hinged on its bottom edge under a
`900px` perspective with a bottom-centre vanishing point, set through three CSS variables
(`--board-tilt-angle`, `--board-tilt-perspective`, `--board-lift`, the last locked at `0px`
because translating the plane only moves the dead strip to the cockpit edge). The hand, cockpit,
prompts, HUD and rail stay flat; `PlayMobile` is untouched. Effect Intensity `off` sets the angle
to `0deg`; reduced motion keeps the static tilt. The board-card straighten-on-hover (City and HQ
only) counter-rotates the button by the board angle around its bottom edge and scales it 1.06,
with no `translateY`, so the bottom edge stays put and no click strip opens under a lifted card;
it is gated like the WP-699
hand lift (`shouldRender('particles') && !prefersReducedMotion`, pointer devices only), and is
on only while the row fits without sideways scrolling, because a scroll container forces its
subtree flat; a scrolling row keeps its scroll and plain hover, and no cloned overlay card is
used. The hover target is the whole space; the lifted card is exactly 1.06 (the tile's own 1.05
hover is off inside a lifting row); a space whose WP-817 discard chooser is open never lifts,
because depth order beats `z-index` inside a 3D context; while lifted, a card may hide its Dark
Portal marker and overlap the neighbouring label and the left edge of an Excessive Violence or
Fight + Rescue button by a few pixels (accepted). The slash gesture and the VFX
overlay keep measuring with `getBoundingClientRect`; the WP-689 Playwright guard pins that
neighbouring City boxes stay apart under the tilt, at rest and with a card lifted.

## Lint Gate Self-Review (00.3)

| § | Result |
|---|---|
| §1 Structure | PASS — Goal (user story), Impact, Assumes, Context, Scope In/Out, Files, Contract, Constraints, Vision, AC, Verification, DoD, Reserved Decision present; Out of Scope lists 8 exclusions |
| §2 Constraints | PASS — engine-wide (full files, ESM, Node 22, 00.6), packet-specific, session protocol, locked CSS and constants |
| §3 Assumes | PASS — every DOM hook, CSS rule, composable and test-environment fact the packet relies on, with file and approximate line |
| §4 Context | PASS — rules files, ARCHITECTURE.md, the ewiki contract, D-entries, the prototype data and the three rejected alternatives; 00.2 untouched (no data fields) |
| §5 Files | PASS — 4 new + 8 modified code/test files + 4 ewiki pages + post-mortem, each with a description; over ~8, justified (one feature touching a page, two rows, two composables and their tests, and the layout guard) |
| §6 Naming | PASS — full-word names; the new Boolean prop is `isTiltLiftEnabled` (`is…` per code-style §Naming) and the new ref `hqSlotsElement`; the guard's new booleans start with `is` / `has` (`isBoardTilted`, `hasCityBoxGaps`, …); the guard file's existing WP-689 keys (`pageScrollsY`, `turnBarFound`, `boardFitsContainer`) are left as they are (out of scope); existing names (`cityRowEl`, `isColumnAligned`, `measureRowFits`) reused verbatim |
| §7 Dependencies | PASS — none added |
| §8 Boundaries | PASS — arena-client only; no engine, registry or server import added |
| §9 Windows | PASS — `pwsh` commands, `pnpm` only |
| §10 Env vars | N/A — none used |
| §11 Auth | N/A — no auth surface |
| §12 Tests | PASS — `node:test`, jsdom setup, no boardgame.io, no network/DB; layout-only facts go to the Playwright guard because jsdom has no layout engine |
| §13 Verification | PASS — exact commands with expected output, a browser check, and the D-24026 live check |
| §14 AC | PASS — 10 binary items with exact values, class names and counts (+19 tests) |
| §15 DoD | PASS — STATUS, DECISIONS, WORK_INDEX, scope-boundary check, D-24026 item |
| §16 Code style | PASS — enforced through Constraints and EC-890 |
| §17 Vision | PASS — §17, §8/§22, NG-1 cited; no conflict; determinism line present |
| §18 Prose-vs-grep | PASS — no grep or `Select-String` pattern; the checks are `git diff --stat` / `--numstat` / `--name-only` against the merge base, which match their prose |
| §19 Staleness | Applied at commit (baseline re-checked against `origin/main`) |
| §20 Funding | N/A — presentation only |
| §21 API catalog | N/A — no `apps/server` endpoint or catalog function touched |
