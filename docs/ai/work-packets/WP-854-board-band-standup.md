# WP-854 — Band stand-up: the Mastermind, S.H.I.E.L.D. Officers and Sidekicks straighten toward the player on hover (Arena Client)

**Status:** Draft 2026-10-29 (EC-892; D-24790 reserved). Gates: 01.4 pre-flight NOT READY (PS-1: PR #3094 unmerged, now an explicit execution precondition) → READY TO EXECUTE, re-confirmed after every later edit; 01.7 copilot RISK (F1–F6) → PASS, re-confirmed after the lint fixes; 00.3 FAIL (§18, §20) → PASS (independent reviewer; self-review below).
**Primary Layer:** Arena Client (presentation only): single layer, standard two-session lane
**Dependencies:** WP-852 (table perspective, D-24788, incl. EC-890 Amendment A) ✅, WP-648 (Officers recruit button) ✅, WP-842 (Sidekicks recruit button) ✅, WP-830 (Enigma Code guess, D-24763) ✅, WP-689 (Playwright play-surface guard, D-24506) ✅, all on `main`; and PR #3094 (the ewiki `#band-standup` proposal this WP ships), open at drafting, which must merge before execution starts.
**User-Visible Surface:** `play.legendary-arena.com` (the desktop play board, viewport ≥ 768 px)

> Baseline: `origin/main` at `bf7150b8` (PR #3093). WP-854 / EC-892 / D-24790 reserved by PR #3095.

---

## Goal

As a player on the desktop board, I want the Mastermind and the S.H.I.E.L.D. Officers and
Sidekicks piles to stand up square to me when I point at them, the way City villains and HQ
heroes already do, so that the cards I fight and recruit at the far edge of the tilted table are
as easy to read as the ones nearer to me.

## User-Visible Impact

On play.legendary-arena.com, desktop layout only:

- **The Mastermind card stands up on hover.** Pointing anywhere on the Mastermind's fight button
  (the card, its Fight badge, the "Tactics remaining" line or the Final Blow line) stands the card
  and its Fight badge up: it rotates back by the board's angle around its bottom edge and grows to
  1.06, over 150 ms. The "Tactics remaining" and Final Blow lines, the Excessive Violence button,
  the Read card button, captured Bystanders, Hypno-Thralls and the Master Strike pile stay down.
- **The Officers and Sidekicks piles stand up on hover.** Pointing anywhere in either pile's cell
  stands its whole recruit button up the same way: card face, name, count and `Recruit: N`.
- **Unaffordable cards still stand up**, like a City villain you cannot afford, so you can read
  them; their dimmed look, disabled state and tooltip are unchanged. Clicks fight and recruit
  exactly as before, including a click near the bottom edge of a lifted card.
- **Nothing else in the band changes:** the Scheme, Wounds, Horrors, Bystanders, KO pile, Master
  Strike pile and Scheme Twist pile stay flat on the table. You read them; you do not fight or buy
  them.
- **The Enigma Code guess is never covered.** While the WP-830 Enigma guess is open on the
  Mastermind tile, the Mastermind does not stand up.
- **Same gates as City and HQ:** pointer devices only; Effect Intensity `off` (flat board) and an
  OS reduced-motion setting turn the stand-up off. **Mobile (`PlayMobile`, < 768 px) is
  unchanged.**

## Assumes

Each line was checked against `origin/main` at `bf7150b8`.

- `apps/arena-client/src/pages/PlayDesktop.vue` (WP-852): `useBoardTilt()` returns
  `isBoardLiftEnabled` (~L272); the scene `<div class="play-desktop__board-scene"
  :style="boardTiltStyle">` (~L893) sets `--board-tilt-angle`, which the band's descendants
  inherit (the locked lift CSS reads it); the plane `<div class="play-desktop__board-plane" :class="{
  'play-desktop__board-plane--lift': isBoardLiftEnabled }">` (~L895) holds
  `<section class="play-desktop__adversary-band">` (~L902), whose children are
  `<div class="play-desktop__mastermind-zone">` (holding `<MastermindTile>` ~L908 and
  `<MasterStrikePile>`), the scheme zone, `<SharedDecks>` (~L932, a direct child of the band) and
  `<KOPile>`. `CityRow` / `HQRow` already receive `:is-tilt-lift-enabled="isBoardLiftEnabled"`.
  The style block is `<style scoped>` (~L1427). Its WP-852 3D rules (~L1598–1623) gate
  `transform-style: preserve-3d` on the plane and `pointer-events: none` on the plane (with
  `pointer-events: auto` on its direct children) on
  `.play-desktop__board-plane--lift:has(<a hovered liftable City or HQ card>)` (EC-890 Amendment
  A). `.play-desktop__adversary-band` (~L1646) and `.play-desktop__mastermind-zone` (~L1660) set
  no `overflow`, `opacity`, `filter` or `transform-style`.
- `apps/arena-client/src/components/play/MastermindTile.vue`: root `<section class="mastermind-tile">`
  (~L318); `<button class="mastermind__fight-button" data-testid="play-mastermind-button">`
  (~L344) holds `<span class="mastermind__card-frame">` (~L360: the `CardTile` and the
  `mastermind__fight-cost` badge), then the `mastermind-status` and `mastermind-final-blow`
  lines. The Enigma picker renders as `<EnigmaGuessPicker v-if="enigmaGuessFight !== null &&
  enigmaCode !== undefined" class="mastermind-tile__enigma-guess">` (~L413–416), an `position:
  absolute; inset: 0; z-index: 3` overlay inside the tile (CSS ~L477). The style block is
  `<style scoped>` (~L473). No rule on the tile, button or frame sets `overflow`, `opacity` or
  `filter`. Its props are declared in a `props: {}` object in `defineComponent` (Boolean props such
  as `isViewerTurn`, `isGameOver`).
- `apps/arena-client/src/components/play/SharedDecks.vue`: root `<section class="shared-decks">`
  (~L203) → `<ol class="shared-decks__row">` (~L207) → five `<li class="shared-decks__cell">`;
  the Officers cell (`data-testid="play-shared-deck-officers"`, ~L220) and the Sidekicks cell
  (`data-testid="play-shared-deck-sidekicks"`, ~L251) each hold one
  `<button class="shared-decks__recruit">` (`data-testid` `play-recruit-officer` /
  `play-recruit-sidekick`) as their only element child. `.shared-decks__recruit:disabled` sets
  `opacity: 0.55` (~L319); nothing else on the chain sets `overflow`, `opacity` or `filter`. The
  style block is `<style scoped>` (~L281). Props in `defineComponent` (~L49).
- `apps/arena-client/src/pages/PlayMobile.vue` renders `<MastermindTile>` (~L587) and
  `<SharedDecks>` (~L651) without any lift prop.
- `apps/arena-client/visual/play-surface.visual.mjs` (WP-852 state): `measureRestingHits()`
  (~L297) reads the fixed selector `[data-testid="play-city-villain"], [data-testid="play-hq-hero"]`;
  `hoverAndMeasure(page, selector, isCityGapCheck)` (~L390) → `measureHover` (~L328) walks the
  3D chain from the selected element up to the plane and returns `isHoverLifted`,
  `isHoverVisible`, `isHoverChainIntact`, `isHoverBottomCovered`, `restingTop`, `liftedTop`;
  `collectHoverFailures(failures, label, rowName, hover, isCityGapCheck)` (~L402) words its
  failures from `rowName`; `readSlideTargets` (~L421) and `installClickRecorder` (~L432) identify
  a button by `data-card-id` only; `slideAndClick(page, selector)` (~L459) swallows every click
  in the capture phase. The `mid-turn` fixture's Officers and Sidekicks buttons are enabled and
  its Mastermind fight button is disabled (observed 2026-10-29).
- Tests run under `node:test` with `../../testing/jsdom-setup`. `MastermindTile.test.ts` opens
  the Enigma picker by mounting with an `enigmaCode` prop, enough attack, `currentStage: 'main'`,
  and clicking `[data-testid="play-mastermind-button"]` (~L711–719). `PlayDesktop.test.ts` has a
  `describe('PlayDesktop — table perspective (WP-852 / D-24788)')` block (~L690) that mounts the
  board on the shared play snapshot and uses `useEffectIntensity().setIntensity` with a
  `finally` restore.
- Not on `bf7150b8`, and a precondition for execution: once PR #3094 (open at drafting) merges,
  `wiki/visual-effects.md` carries the `##### Next: the Mastermind, Officers and Sidekicks stand
  up too (proposed, not built) {#band-standup}` section under §Table perspective. Execution cites
  #3094's merge commit; if #3094 has not merged, execution does not start.

## Context (Read First)

- `.claude/rules/architecture.md` §Engine Owns Truth, §Layer Boundary; `.claude/rules/code-style.md`.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (UI consumes read-only projections).
- WP-852 and EC-890 (incl. Amendment A) are the precedent this WP extends; D-24788 governs the
  tilt, the lift transform and its gates. `wiki/visual-effects.md` `#table-perspective` and
  `#band-standup` (PR #3094) are the design.
- `docs/ai/DECISIONS.md`: D-24788, D-24763 (Enigma guess overlay), D-24506 (the guard), D-24026
  (live verify).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why these three.** The adversary band sits at the far edge of the tilted plane, where the
14° / 900 px tilt shrinks cards most, yet the Mastermind is fought and the Officers and Sidekicks
are recruited from there. WP-852 left the band out of scope; this WP brings its three actionable
cards in line with the City and HQ. The Scheme and the counter piles are read, not acted on, and
stay flat.

**Prototype (2026-10-29, real board, `mid-turn` fixture, CSS injected on the dev server).** The
lift rules in §Contract were injected and measured:

| | Mastermind | Officers | Sidekicks |
|---|---|---|---|
| Height on hover, ×resting (1440×900) | 1.22 | 1.22 | 1.22 |
| Top rise, px (1280 / 1366 / 1920) | 12 / 13 / 20 | 18 / 20 / 30 | 18 / 20 / 30 |
| Clearance below the top status bar, px (1280 / 1366 / 1920) | 35 / 38 / 57 | 24 / 26 / 38 | 24 / 26 / 38 |

A City card measured ×1.17 for comparison: the band stands up more because it leans furthest.
At all three widths: the resting 3×3 interior hit grid on all three buttons was clean, the hover
lifted with the whole 3D chain intact and its bottom edge still hitting the button, and 6/6
slide-and-clicks between Officers and Sidekicks landed on the target. A disabled recruit button
(`opacity: 0.55`) stood up exactly as an enabled one (×1.222): the opacity flattens only the
button's own contents, which ride on the button.

**What the prototype caught.** A first version put the Enigma exclusion inside the plane's
`:has()` as `:not(:has(.mastermind-tile__enigma-guess))`. `:has()` cannot nest, so the browser
dropped the whole selector list and every band card rose but stayed tilted (×1.03 instead of
×1.22). Hence the static `mastermind-tile--guessing` class, which the plane can test without
nesting.

**Why the Mastermind lifts its card frame, not its button.** The fight button also holds the
"Tactics remaining" and Final Blow lines. Lifting the frame keeps those lines on the table and
gives the hover a target that does not move (the button), the same "hover the holder, lift the
child" rule as the City `li` and its button. The recruit buttons have no such lines, so the whole
button lifts and the `li` is the holder.

**What catches a broken chain.** The +7 unit tests pin the prop and class wiring only; jsdom has
no layout engine and cannot see a broken `preserve-3d` link. The 3D chain, the lift and the hit
testing are pinned only by `test:visual`, which runs locally, not in CI.

**Why no row-fit gate.** `.play-desktop__adversary-band` and `.shared-decks__row` are not scroll
containers (no `overflow` set), so nothing forces the band flat; WP-852's `useRowFit` is not
needed. The guard's chain walk pins that.

**Supersession check (01.0a Step 2):** `git log --all --grep="band-standup\|board-band\|band
stand"`, `ls` for `*band*` and `gh pr list --state all --search "stand up hover Mastermind"`
found only PR #3094, the ewiki proposal this WP builds.

**Parallel work.** WP-759 (Haunting badge), WP-771 (Wound-him button and Wounds badge) and
WP-840 (villains beside the Mastermind), all drafted, also edit `MastermindTile.vue`. Any of them
could add an `overflow` / `opacity` / `filter` link to the chain or an element inside the frame,
and nothing in CI would notice. If any has landed at execution: rebase, re-check the
`MastermindTile.vue` Assumes line, and re-run `test:visual`. The slide-and-click race (EC-890 Amendment A) is timing-dependent; the prototype ran 2
slides × 3 widths, so a flake there is the known plane-steals-the-click mode, not a new defect.

Not Lightweight Lane: 7 code/test files (01.0a eligibility #2). No 01.6 trigger: no new
contract, abstraction, composable or code category (two props and CSS following WP-852's
pattern), so no post-mortem is required.

## Scope (In)

1. **`src/components/play/MastermindTile.vue` (modified).** New optional prop
   `isTiltLiftEnabled: Boolean` (default `false`). Root `:class` adds
   `{ 'mastermind-tile--tilt-lift': isTiltLiftEnabled, 'mastermind-tile--guessing':
   enigmaGuessFight !== null && enigmaCode !== undefined }` (the second is the picker's own
   `v-if` condition, verbatim). Scoped CSS under `@media (hover: hover)` (§Contract).
2. **`src/components/play/SharedDecks.vue` (modified).** New optional prop
   `isTiltLiftEnabled: Boolean` (default `false`). Root `:class` adds
   `{ 'shared-decks--tilt-lift': isTiltLiftEnabled }`. Scoped CSS under `@media (hover: hover)`
   (§Contract).
3. **`src/pages/PlayDesktop.vue` (modified).** Pass `:is-tilt-lift-enabled="isBoardLiftEnabled"`
   to `<MastermindTile>` and `<SharedDecks>`. Append the §Contract plane rules after the WP-852
   rules; the existing WP-852 rules are not edited.
4. **Unit tests** (counts in §Acceptance Criteria): new cases appended to
   `MastermindTile.test.ts`, `SharedDecks.test.ts` and `PlayDesktop.test.ts`, in a new
   `describe` block at the end of each file. No existing case is edited or removed; any import a
   new case needs comes in on a **new** import line.
5. **`visual/play-surface.visual.mjs` (modified).** Band resting hits, band hover checks, the
   status-bar clearance and an Officers ↔ Sidekicks slide-and-click (§Contract). Three existing
   helpers change: `measureRestingHits` takes its selector as an argument (the existing call
   passes today's selector verbatim), and it, `readSlideTargets` and `installClickRecorder`
   identify a button by `data-card-id`, falling back to `data-testid`. City and HQ buttons always
   carry `data-card-id` (`CityRow.vue` ~L586, `HQRow.vue` ~L200), so their results are unchanged.
6. **ewiki (modified).** `wiki/visual-effects.md`: `#band-standup` proposal → shipped (WP-854 /
   D-24790) with the prototype table, and the §Table perspective "Board cards straighten on
   hover" bullet names the band; `wiki/testing.md` §Play-surface guard lists the new band checks.
   `last-reviewed` bumped on each.

## Out of Scope

- Lifting the Scheme, Wounds, Horrors, Bystanders, KO, Master Strike or Scheme Twist piles, the
  Hypno-Thralls, the captured-Bystander badge, the Excessive Violence or Read card buttons, the
  Escaped pile, the Villain / Hero deck cells or the Transform deck.
- Any change to the City / HQ lift, the tilt values, `useBoardTilt`, `useRowFit` or the WP-852
  CSS rules.
- Any change to `PlayMobile`, the hand, cockpit, prompts, turn bar, HUD or rail.
- Staging the Enigma guess in the Playwright guard (the `mid-turn` fixture has no Enigma scheme;
  the exclusion is pinned in the guard by class injection, `isBandGuessingFlat`, and by the
  D-24026 live check).
- A `:focus-visible` lift for keyboard focus (parity with D-24788, which is hover-only; nothing in
  the band lifts today, so this is no regression).
- Wiring the Playwright guard into CI.
- Any engine, server, `UIState`, registry or card-data change.

## Files Expected to Change

1. `apps/arena-client/src/components/play/MastermindTile.vue` — modified — `isTiltLiftEnabled` prop, two root classes, CSS
2. `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified — +3 tests appended
3. `apps/arena-client/src/components/play/SharedDecks.vue` — modified — `isTiltLiftEnabled` prop, root class, CSS
4. `apps/arena-client/src/components/play/SharedDecks.test.ts` — modified — +2 tests appended
5. `apps/arena-client/src/pages/PlayDesktop.vue` — modified — two `:is-tilt-lift-enabled` bindings, appended plane CSS
6. `apps/arena-client/src/pages/PlayDesktop.test.ts` — modified — +2 tests appended
7. `apps/arena-client/visual/play-surface.visual.mjs` — modified — band resting hits, hover, clearance, slide-and-click
8. `wiki/visual-effects.md` — modified — `#band-standup` shipped
9. `wiki/testing.md` — modified — guard checks listed

Governance (execution close, `SPEC:` commit): `docs/ai/DECISIONS.md` (D-24790), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md` (+ `pnpm roadmap:counts:write`), `docs/ai/NUMBER-LEDGER.md` (LANDED marks).

## Contract

**Root classes (locked):** `mastermind-tile--tilt-lift` (= `isTiltLiftEnabled`),
`mastermind-tile--guessing` (= `enigmaGuessFight !== null && enigmaCode !== undefined`, rendered on
every surface, styled only under the lift class), `shared-decks--tilt-lift` (= `isTiltLiftEnabled`).

**`MastermindTile.vue` scoped CSS (locked):**

```css
@media (hover: hover) {
  .mastermind-tile--tilt-lift:not(.mastermind-tile--guessing):has(.mastermind__fight-button:hover),
  .mastermind-tile--tilt-lift:not(.mastermind-tile--guessing):has(.mastermind__fight-button:hover) .mastermind__fight-button,
  .mastermind-tile--tilt-lift:not(.mastermind-tile--guessing):has(.mastermind__fight-button:hover) .mastermind__card-frame {
    transform-style: preserve-3d;
  }
  .mastermind-tile--tilt-lift .mastermind__card-frame {
    transform-origin: 50% 100%;
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  .mastermind-tile--tilt-lift:not(.mastermind-tile--guessing) .mastermind__fight-button:hover .mastermind__card-frame {
    transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .mastermind-tile--tilt-lift .mastermind__card-frame .card-tile--interactive:hover {
    transform: none;
  }
}
```

**`SharedDecks.vue` scoped CSS (locked):**

```css
@media (hover: hover) {
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit),
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__row,
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__cell,
  .shared-decks--tilt-lift:has(.shared-decks__cell:hover > .shared-decks__recruit) .shared-decks__recruit {
    transform-style: preserve-3d;
  }
  .shared-decks--tilt-lift .shared-decks__recruit {
    transform-origin: 50% 100%;
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  .shared-decks--tilt-lift .shared-decks__cell:hover > .shared-decks__recruit {
    transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .shared-decks--tilt-lift .shared-decks__recruit .card-tile--interactive:hover {
    transform: none;
  }
}
```

**`PlayDesktop.vue` scoped CSS, appended after the WP-852 rules (locked).** `<band-hover>` stands
for the selector list
`.mastermind-tile--tilt-lift:not(.mastermind-tile--guessing) .mastermind__fight-button:hover, .shared-decks--tilt-lift .shared-decks__cell:hover > .shared-decks__recruit`,
written out in full in each rule:

```css
.play-desktop__board-plane--lift:has(<band-hover>),
.play-desktop__board-plane--lift:has(<band-hover>) .play-desktop__adversary-band,
.play-desktop__board-plane--lift:has(<band-hover>) .play-desktop__mastermind-zone {
  transform-style: preserve-3d;
}
.play-desktop__board-plane--lift:has(<band-hover>) {
  pointer-events: none;
}
.play-desktop__board-plane--lift:has(<band-hover>) > * {
  pointer-events: auto;
}
```

**Why the chain switches on only while hovered, and the plane steps out of hit testing.** EC-890
Amendment A: at rest, coplanar `preserve-3d` layers z-fight in Chrome's hit test and take a resting
card's clicks; while a card is lifted, the plane can win the hit test in the first frames after
the pointer slides to a neighbour. The same two rules apply to the band.

**Why `mastermind-tile--guessing` and not `:has(.mastermind-tile__enigma-guess)`.** The plane
rule already sits inside `:has()`, which cannot nest (see Context). Inside a `preserve-3d`
context depth order beats `z-index`, so a raised card would paint over the open Enigma picker.

**Why no `translateY`.** As WP-852: the bottom-edge origin keeps that edge put, so every point
of the resting card stays under the lifted one and no dead click strip opens.

**Playwright guard additions (`visual/play-surface.visual.mjs`, locked names and messages),**
per viewport, after the existing HQ slide-and-click and before the discard-chooser check. `run()`
is already ~130 lines, so the band steps live in two new functions and `run()` gains one call:
`checkBandStandUp(page, label, failures)` (resting hits, the three hover blocks and the
clearance) calls `checkBandSlideAndGuessing(page, label, failures)` (the slide-and-click and
`isBandGuessingFlat`); each stays within ~30 lines.

- `measureRestingHits(selector)`: the existing body with the selector as its argument, and each
  `missedCards` entry's `cardId` read as `data-card-id ?? data-testid`. The existing call passes
  `'[data-testid="play-city-villain"], [data-testid="play-hq-hero"]'` and keeps its log line and
  failure message. A new call with
  `'[data-testid="play-mastermind-button"], [data-testid="play-recruit-officer"], [data-testid="play-recruit-sidekick"]'`
  logs as `band resting hits: { isBandRestingHitIntact: <isRestingCardHitIntact>, cardCount, missedCards }`
  (the HQ hover remap pattern) and fails with
  `"<label>: a resting Mastermind, Officers or Sidekicks card does not take its own clicks under the tilt"`.
- `hoverAndMeasure` then `collectHoverFailures(failures, label, <name>, …)` for each entry of a
  literal list in `checkBandStandUp`: `{ name: 'Mastermind', selector: '.mastermind__card-frame' }`,
  `{ name: 'Officers', selector: '[data-testid="play-recruit-officer"]' }`,
  `{ name: 'Sidekicks', selector: '[data-testid="play-recruit-sidekick"]' }`. Each result is logged
  raw, as the City hover line is: `  <label> <name> hover: <JSON of the measureHover result>` (no
  per-name key remap, no computed keys). Failure messages are the existing `collectHoverFailures`
  wording with that name.
- `isBandLiftClearOfHud`: a new `readHudBottom()` returns the `.top-hud-bar` rect bottom, or
  `null` when the bar is missing. For each of the three whose `hover.found` is true, the card is
  clear when the HUD bottom is not `null` and `hover.liftedTop >= hudBottom - 1`; a `null` HUD
  bottom counts as not clear (as `isPlaneClearOfHud` does). One logged boolean,
  `isBandLiftClearOfHud`, true only when all three found cards are clear; one failure per card
  that is not: `"<label>: a lifted <name> card reaches the top status bar"`. A card with
  `found: false` already fails through `collectHoverFailures` and is skipped here.
- `slideAndClick(page, '[data-testid="play-recruit-officer"], [data-testid="play-recruit-sidekick"]')`
  → `isBandSlideClickIntact`. Failure:
  `"<label>: a click right after sliding between the Officers and Sidekicks missed it: <missedSlides>"`.
  For this to identify the two buttons, `readSlideTargets` reads
  `element.getAttribute('data-card-id') ?? element.getAttribute('data-testid')` and the click
  recorder `button.getAttribute('data-card-id') ?? button.getAttribute('data-testid')`; City and
  HQ buttons carry `data-card-id`, so their results do not change.

- `isBandGuessingFlat` (the last band step, after the band slide-and-click): `page.evaluate`
  adds the class `mastermind-tile--guessing` to `.mastermind-tile`, then
  `hoverAndMeasure(page, '.mastermind__card-frame', false)`; the class is removed in a `finally`,
  so a throw cannot leave it on for the discard-chooser check. Logged as
  `band guessing: { isBandGuessingFlat, found, isHoverLifted }`. The check holds when `found` is true and `isHoverLifted` is false (nothing on
  the fixture re-renders the tile on hover, so the added class stays). Failure:
  `"<label>: the Mastermind still stands up while the Enigma guess is open"`. This pins the
  `:not(.mastermind-tile--guessing)` selectors, which the unit test (class toggling) cannot.
- A `// why:` at the band hover calls: `measureHover` requires `opacity: 1` from the lifted
  element up, so the recruit checks rely on the fixture's recruit buttons being enabled; a
  disabled one (`opacity: 0.55`) lifts correctly but would fail the walk, and stays on the
  D-24026 live check.

The header comment's WP-852 item gains one clause naming the band checks.

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+. `node:test` only; no `boardgame.io` import in any test.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full-word
  names, functions under ~30 lines, no nested ternaries, `// why:` on non-obvious decisions).

**Packet-specific:**
- Arena Client only (plus the two ewiki pages). No file under `packages/`, `apps/server/` or
  `data/` changes.
- Presentation only: no new `UIState` read, move, store write or click-handler change.
- Animated and 3D properties are limited to `transform` / `box-shadow`; no layout property
  animates; no new dependency, no canvas, no JS animation, no clock or randomness read.
- The lift styles apply only under `@media (hover: hover)` and the `--tilt-lift` root class. With
  `isTiltLiftEnabled` false (every `PlayMobile` use) the two roots' class lists are identical to
  today, except `mastermind-tile--guessing` while the Enigma picker is open (unstyled there).
- The WP-852 CSS rules, `useBoardTilt`, `useRowFit`, `CityRow.vue` and `HQRow.vue` are not edited.
- No existing test case is edited, skipped or removed: no existing line of a `*.test.ts` file is
  deleted or changed, and every added hunk is in the leading import block or after the file's
  last pre-existing line (new cases are appended).

**Session protocol:** if any assumption above does not hold on `main` at execution time, or a
change outside the listed files seems needed, stop and ask — do not improvise.

## Vision Alignment

**Vision clauses touched:** §17 (accessibility: the lift honours the reduced-motion and
Effect-Intensity gates), §8 / §22 (determinism), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict: this WP preserves all touched clauses.

**Non-Goal proximity check:** display only. It changes no outcome, VP, PAR or standing, and no
purchase or cosmetic touches it. NG-1..8 not crossed.

**Determinism preservation:** no engine file changes, so `finalStateHash`, `PRE_WP080_HASH` and
replays are untouched by construction.

**Funding Surface Gate (§20):** N/A — presentation only; no funding affordance, funding copy or funding channel.

## Acceptance Criteria

1. `MastermindTile.test.ts` (+3, new `describe('MastermindTile — band stand-up (WP-854 / D-24790)')`):
   with no `isTiltLiftEnabled` prop the root lacks `mastermind-tile--tilt-lift`; with it true the
   root has it; with an `enigmaCode`, enough attack and `currentStage: 'main'`, the root lacks
   `mastermind-tile--guessing` before the Fight click and has it after, with
   `.mastermind-tile__enigma-guess` present (the picker is open). The
   new `describe` declares its own `enigmaCode` literal (copied from the WP-830 block, ~L703–709,
   which is local to that block).
2. `SharedDecks.test.ts` (+2, new `describe('SharedDecks — band stand-up (WP-854 / D-24790)')`):
   with no prop the root lacks `shared-decks--tilt-lift`; with it true the root has it.
3. `PlayDesktop.test.ts` (+2, new `describe('PlayDesktop — band stand-up (WP-854 / D-24790)')`,
   its own mount helper): at `full`, `.mastermind-tile` has `mastermind-tile--tilt-lift` and
   `.shared-decks` has `shared-decks--tilt-lift`; at `off`, neither does. Both call
   `setIntensity('full')` in a `finally`.
4. `pnpm --filter @legendary-arena/arena-client test` passes with 0 failures and exactly **+7**
   tests over the pre-execution count.
5. `pnpm --filter @legendary-arena/arena-client test:visual` exits 0 at all three widths with
   `isBandRestingHitIntact`, the three hover blocks, `isBandLiftClearOfHud`,
   `isBandSlideClickIntact` and `isBandGuessingFlat` passing, and every existing check still passing.
6. No file under `packages/`, `apps/server/` or `data/` changed; `CityRow.vue`, `HQRow.vue`,
   `useBoardTilt.ts` and `useRowFit.ts` unchanged; no existing line of a `*.test.ts` file deleted
   or changed (`git diff --numstat $(git merge-base origin/main HEAD) -- '*.test.ts'` shows `0` in
   the deletions column on every row), and in the `git diff -U0` of the three test files every
   hunk's old-start (`@@ -<start>,0`) is at or before that file's last import line, or equals
   its pre-execution line count (appended at the end).
7. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

## Verification Steps

```pwsh
pnpm -r build                                                     # exits 0
pnpm --filter @legendary-arena/arena-client test                  # "fail 0", count +7
pnpm --filter @legendary-arena/arena-client typecheck             # exits 0
pnpm --filter @legendary-arena/arena-client exec playwright install chromium   # one-time
pnpm --filter @legendary-arena/arena-client test:visual           # "play-surface visual guard PASSED"
$base = git merge-base origin/main HEAD                           # diff against the branch point
git diff --numstat $base -- '*.test.ts'                           # deletions column (2nd field) is 0 on every row
git diff -U0 $base -- apps/arena-client/src/components/play/MastermindTile.test.ts apps/arena-client/src/components/play/SharedDecks.test.ts apps/arena-client/src/pages/PlayDesktop.test.ts | Select-String '^@@'   # each old-start <= last import line, or = the file's pre-execution line count
git diff --name-only $base -- packages apps/server data           # empty
git diff --name-only $base -- apps/arena-client/src/components/play/CityRow.vue apps/arena-client/src/components/play/HQRow.vue apps/arena-client/src/composables   # empty
git status --short                                                # only the allowlisted files (+ governance at close)
pnpm ledger:numbers:check; pnpm workindex:rows:check; pnpm workindex:executed:check   # each exits 0 (at close)
```

Browser preview: start the `arena-client` dev server, open `/?fixture=mid-turn&play=1` at a
desktop viewport, hover the Mastermind, the Officers and the Sidekicks and confirm by screenshot
that each stands up (the Mastermind's "Tactics remaining" line stays down); set Effect Intensity
to Off and confirm none lifts; set it back.

D-24026 after the arena-client deploy: on play.legendary-arena.com, desktop, in a real match,
confirm the three stand up on hover, that clicking still fights the Mastermind and recruits an
Officer and a Sidekick (including a click near the bottom edge of a lifted card), that an
unaffordable one still stands up and stays disabled, that an affordable Mastermind showing a
`Fight N` badge stands up with the badge and at exactly 1.06 (the guard's fixture Mastermind is
disabled and has no badge), and, in a match with an Enigma Code scheme, that the open Enigma
guess is never covered by the Mastermind, and, in a Portals match with a Dark Portal over the
Mastermind, how the lifted card sits against the marker (accepted overlap, below).

## Definition of Done

- [ ] Acceptance Criteria 1–7 pass; command output tails pasted in the execution PR.
- [ ] No files outside `## Files Expected to Change` and the listed governance files were
      modified (`git diff --name-only` checked).
- [ ] The two ewiki pages updated, `last-reviewed` bumped; after the `wiki-viewer.yml` deploy the
      `#band-standup` section is checked live (CF Access service-token curl).
- [ ] `docs/ai/DECISIONS.md` — D-24790 landed Active.
- [ ] `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` exit 0.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date; EC_INDEX row `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node 📝 → ✅; `pnpm roadmap:counts:write`, then
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/NUMBER-LEDGER.md` WP-854 / EC-892 / D-24790 marked LANDED.
- [ ] Two-commit topology (`EC-892:` implementation + `SPEC:` governance close); PR squash-merged.
- [ ] Live-on-surface verification (D-24026) on play.legendary-arena.com — or flagged
      operator-pending in WORK_INDEX.

## Reserved Decision (lands at execution)

**D-24790** — Amends D-24788 §3's City-and-HQ-only scope. The WP-852 board-card stand-up extends to the three actionable cards of the
adversary band: the Mastermind (its card frame, inside the fight button) and the S.H.I.E.L.D.
Officers and Sidekicks recruit buttons, with the same transform, origin, timing, gates and
pointer-only media query as the City and HQ (D-24788). The Scheme, the counter piles and the other
band controls stay flat. The hover target is the element that holds the lifted one (the fight
button; the pile's cell), so the target never moves. Unaffordable cards still stand up. The band
needs no row-fit gate (no scroll container). The `preserve-3d` chain through the band switches on
only while one of the three is hovered, and the plane steps out of hit testing meanwhile (EC-890
Amendment A). The Mastermind never stands up while the WP-830 Enigma guess is open, tested through
a static `mastermind-tile--guessing` class because `:has()` cannot nest. The WP-689 guard pins the
band's resting hits, hover lift, status-bar clearance, the Officers ↔ Sidekicks slide-and-click
and the Enigma exclusion; unit tests pin only the prop and class wiring, so the chain, lift and
hit testing are guarded only by `test:visual`, which runs locally. While lifted, the Mastermind
card may paint over the Dark Portal marker or the "victory is assured" banner just above it
(depth beats `z-index` in 3D), as D-24788 accepts for the City's marker.

## Lint Gate Self-Review (00.3)

| § | Result |
|---|---|
| §1 Structure | PASS — Goal (user story), Impact, Assumes, Context, Scope In/Out, Files, Contract, Constraints, Vision, AC, Verification, DoD, Reserved Decision present; Out of Scope lists 7 exclusions |
| §2 Constraints | PASS — engine-wide (full files, ESM, Node 22, 00.6), packet-specific, session protocol, locked CSS |
| §3 Assumes | PASS — every DOM hook, CSS rule, helper and test-environment fact the packet relies on, with file and approximate line, checked at `bf7150b8` |
| §4 Context | PASS — rules files, ARCHITECTURE.md, the ewiki design, D-entries, prototype data, the nested-`:has()` finding and two design rationales; 00.2 untouched (no data fields) |
| §5 Files | PASS — 7 modified code/test files + 2 ewiki pages, each with a description |
| §6 Naming | PASS — the Boolean prop `isTiltLiftEnabled` reuses WP-852's name; new guard booleans start with `is` (`isBandRestingHitIntact`, `isBandLiftClearOfHud`, `isBandSlideClickIntact`); new function `readHudBottom`; existing names reused verbatim |
| §7 Dependencies | PASS — none added |
| §8 Boundaries | PASS — arena-client only; no engine, registry or server import added |
| §9 Windows | PASS — `pwsh` commands, `pnpm` only |
| §10 Env vars | N/A — none used |
| §11 Auth | N/A — no auth surface |
| §12 Tests | PASS — `node:test`, jsdom setup, no boardgame.io, no network/DB; layout facts go to the Playwright guard |
| §13 Verification | PASS — exact commands with expected output, a browser check and the D-24026 live check |
| §14 AC | PASS — 7 binary items with exact class names and counts (+7 tests) |
| §15 DoD | PASS — STATUS, DECISIONS, WORK_INDEX, scope-boundary check, D-24026 item |
| §16 Code style | PASS — enforced through Constraints and EC-892; the guard's band steps go in two named ~30-line functions so `run()` does not grow |
| §17 Vision | PASS — §17, §8/§22, NG-1 cited; no conflict; determinism line present |
| §18 Prose-vs-grep | PASS — no grep pattern; the "no existing test edited" claim is checked by numstat deletions = 0 plus the `-U0` hunk-position check (catches a line inserted into an existing case), both against the merge base |
| §19 Staleness | Applied at commit (baseline re-checked against `origin/main`) |
| §20 Funding | N/A — presentation only; no funding affordance, funding copy or funding channel |
| §21 API catalog | N/A — no `apps/server` endpoint or catalog function touched |
