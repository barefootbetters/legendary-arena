# WP-755 — Villain slash VFX: a Fruit Ninja-style defeat beat on the VfxOverlay (arena-client + ewiki)

**Status:** Draft 2026-09-25 (EC-792; D-24584 reserved) — READY TO EXECUTE (pre-flight READY r3; copilot PASS r3; lint PASS r2)
**Primary Layer:** arena-client (`apps/arena-client/src/vfx/**`, `.../composables/**`, `.../components/play/VfxOverlay.vue`, `.../pages/PlayViewport.vue`) + ewiki docs
**Dependencies:** WP-556 / D-24365 (the VFX foundation, the single overlay canvas, the `effectIntensity` gate, the VFX determinism exemption) ✅, WP-200 / WP-201 / D-20104 (the public `UIState.notableEvents` projection + the append-only cursor re-emission gate) ✅, WP-746 / D-24569 (the notable-event → signal → `VfxOverlay` beat precedent this mirrors) ✅, WP-690 / D-24507 (the shared word / impact slots) ✅
**User-Visible Surface:** play.legendary-arena.com (the in-match play board — every villain or henchman defeat in the City) + ewiki.legendary-arena.com/visual-effects/
**Baseline:** `origin/main` @ `583f8f23`

---

## Goal

When any player defeats a villain or henchman in the City, the defeated card is **sliced**:
a bright slash streak crosses its City space, the card's own art splits along the cut into
two halves that tumble away under gravity, a villain-purple droplet spray flies along the
cut, and brief stains fade from the mat. Defeating several villains in quick succession
raises a takedown-streak word ("DOUBLE TAKEDOWN!", "TRIPLE TAKEDOWN!", "RAMPAGE!"). Today a
defeat has no board-level visual at all: the villain vanishes from its space and the center
chip says "Fought". This is the production version of the operator-approved "Villain Slash
Lab" prototype (2026-09-25).

---

## User-Visible Impact

- **Before:** clicking a fightable villain removes it from the City and raises the standard
  `NotableEventOverlay` "Fought" chip. Nothing happens at the card's position.
- **After:** the same click also plays the slash beat at that City space: streak, split
  halves showing the real card art, droplet spray, and (at full intensity) stains. A second
  defeat by the same player within 4 seconds shows "DOUBLE TAKEDOWN!", a third "TRIPLE
  TAKEDOWN!", a fourth or more "RAMPAGE!" (with the impact pulse from the third on).
- Every viewer sees it, because `fightResolved` is public. It is purely presentational: no
  rule, VP, PAR, standing, replay or determinism change.
- **ewiki:** the visual-effects page documents the beat and moves `fightResolved` from
  "proposal" to "shipped".

---

## Assumes

Verify each before coding. If any is false, STOP and reconcile.

1. `FightResolvedEvent` (`packages/game-engine/src/events/notableEvents.types.ts:209-221`)
   carries `playerId: string`, `cardId: CardExtId` and `citySpace: number` (0..4). It is
   pushed by `defeatCityVillainCore` (`moves/fightVillain.ts:449`) once per villain or
   henchman defeat, including the Silent Sniper free defeat that shares that core. It is
   appended to `G.notableEvents`, which projects UNCONDITIONALLY onto
   `UIState.notableEvents` (D-12803; `uiState.filter.ts:550`). **No engine change is needed
   or allowed.**
2. The same core sets `G.city[cityIndex] = null` (`fightVillain.ts:338`) before the push. So
   the snapshot carrying the new `fightResolved` no longer holds the defeated card in
   `UIState.city.spaces`. Its art is available only from the **previous** snapshot's
   `city.spaces[i].display.imageUrl` (`UICityCard.display: UICardDisplay`, `imageUrl: string`,
   `uiState.types.ts:364-368`). The store replaces the snapshot object wholesale on every
   server frame (`stores/uiState.ts:35-36`), and the client runs no optimistic frames, so the
   previous frame is a distinct object.
3. `CityRow.vue` renders every City space as either `[data-testid="play-city-villain"]` or
   `[data-testid="play-city-empty"]`, each carrying `data-city-index="<0..4>"`
   (`CityRow.vue:184-185, 214-215`). After a defeat the space re-renders with the same index:
   usually as `play-city-empty`, or re-occupied when the same move plays another Villain Deck
   card (Endless Armies of HYDRA, `fightVillain.ts:470+`). The overlay's watcher most likely
   runs after CityRow has re-rendered, so the element it finds is usually the empty
   placeholder. That placeholder's box is not card-shaped (`CityRow.vue:353-360`), so the
   overlay takes only the space's **centre** from it (Scope §B `resolveCardBox`).
   `PlayDesktop.vue:863` and `PlayMobile.vue:563` both mount `CityRow`.
4. `VfxOverlay.vue` is a `position: fixed; inset: 0; pointer-events: none` layer
   (`VfxOverlay.vue:757-763`), so a City element's `getBoundingClientRect()` maps 1:1 onto
   overlay coordinates, with the D-24505 board scale already included. It hosts ONE canvas,
   which `canvas-confetti` owns and clears every animation frame. That is why the halves,
   streak and stains here are DOM elements, and only the droplet spray uses the canvas.
5. `useEffectIntensity().shouldRender(kind)` with `kind ∈ { 'word', 'particles', 'shake' }`
   (`effectIntensity.ts:119-125`) is the accessibility gate:
   - `word` renders unless intensity is `off`.
   - `particles` renders at `low`/`full`, but not under reduced motion.
   - `shake` renders at `full` only, and not under reduced motion.
6. The notable-event VFX producers are mounted in `PlayViewport.vue:179-244` against
   `audioSnapshot` (`storeToRefs(useUiStateStore())`). A producer that is not mounted there
   never fires. WP-746 learned this at execution.
7. `jsdom-setup.ts` stubs `canvas.getContext` to return null, so `canvas-confetti` never
   renders. jsdom has no `element.animate` and does not install `requestAnimationFrame`.
   Tests assert pure builders, emitted signals and DOM presence, never rendered particles or
   running animations.
8. These read-only dependencies exist as named:
   - **Producer template:** `composables/useExcessiveViolenceVfx.ts` (module-level signal,
     renderer seam, D-20104 cursor). Its `useExcessiveViolenceVfx(audioSnapshot)` call at
     `PlayViewport.vue:233` is the anchor that §E mounts the new producer immediately after.
   - **Reference-tile selector:** `CardTile.vue:94` renders `data-testid="card-tile"` inside
     each `play-city-villain` button, and `CityRow.vue:144` carries
     `data-testid="play-city-row"`. If either is missing, `resolveCardBox` silently falls
     back to the 5:7 box, so verify both rather than assume them.
   - **D-24365 exemption:** `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:320-330` holds the
     VFX-subsurface exemption this WP stays inside.
   - **ewiki anchors:** `wiki/visual-effects.md:534` is the Surface-1 `fightResolved`
     proposal row, and `ewiki/visual-effects/excessive-violence-slash.{py,svg}` is the
     generator precedent for the new still.

---

## Context (Read First)

**Why a client-only WP.** `fightResolved` already exists, is public, and carries the city
index and card id. The documented Tier-1 proposal for it in `wiki/visual-effects.md`
(Surface 1: "Impact burst at the card's City space") has never been built. This WP builds a
richer version with zero engine, registry or server change. Unlike WP-746 it adds no new
`NotableGameEventType`, so none of the exhaustive client consumers (`sfxManifest`,
`CHIP_LABELS`) are touched: `fightResolved` already has its SFX row and "Fought" chip.

**Why the art comes from the previous frame.** The event lands in the same snapshot that
removes the card from the City (Assumes #2). The producer keeps a small
`extId → imageUrl` cache built from each frame's `city.spaces`. On a new `fightResolved` it
reads the cache from the **prior** frame, then refreshes it. A miss yields `imageUrl: null`
(for example, a reconnect straight into the defeat frame), and the halves render as a plain
card silhouette. The beat never fails because art is missing.

**Why DOM halves, not canvas.** The overlay budget is one canvas (`wiki/visual-effects.md`
§Performance budget), and `canvas-confetti` clears it every frame. Halves, streaks or stains
drawn there would flicker or be wiped. DOM nodes animated with `transform`/`opacity` only
keep the one-canvas budget, stay GPU-composited, and are observable in jsdom. This matches
how the prototype built its halves: two copies of the card, clipped with complementary
`clip-path` polygons.

**Why the clock lives in the overlay.** The "takedown streak" is presentation timing
(defeats by the same player within a window) and never reaches `G`.
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §client-app (`:294-297`) bans `performance.now()` in client code.
The D-24365 exemption (`:320-330`) covers only `src/vfx/**` and
`components/play/VfxOverlay.vue`, not `src/composables/`. So the producer composable reads no
clock, the streak arithmetic is a pure helper in `src/vfx/`, and the single
`performance.now()` read happens in `VfxOverlay.vue`.

**Why no swipe gesture here.** In the prototype the blade trail follows the pointer during a
swipe, but in the live client a fight is a click on the villain tile. A swipe-to-fight
gesture changes the input model of `CityRow.vue`, so it is its own WP. This WP draws the
slash at a deterministic angle from the manifest, and plays it on every defeat regardless of
what triggered it.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file — no diffs, no snippets,
  no "show only the changed section."
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit
  control flow, descriptive names, `// why:` comments, small functions, no premature
  abstraction, no `import *` / barrel re-exports, no nested ternaries).
- Determinism: no engine file is touched. `canvas-confetti`'s internal randomness and the one
  `performance.now()` read are confined to the D-24365-exempt subsurface (`src/vfx/**` and
  `components/play/VfxOverlay.vue`). **`composables/useVillainSlashVfx.ts` reads no clock and
  no randomness.** Slash angles and stain offsets derive from `seq`, never `Math.random()`.
- Layer boundary: arena-client imports only the Runtime-Safe Engine Surface **types**
  (`UIState`, notable-event types). No registry, server, preplan or `pg` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile
(update this WP + D-24584) before coding. One WP per session.

**Packet-specific:**
- The producer learns of a defeat ONLY from a new `fightResolved` entry on
  `UIState.notableEvents`, via the D-20104 append-only cursor (catch up on the first valid
  frame; replay nothing on mount or reconnect).
- The VFX layer is display-only and off-ranking (NG-1). It never gates input, never delays
  the City re-render, and never throws into the play surface. Each of these degrades
  silently: a missing element, a zero-size rect, a missing `element.animate`, a failed
  confetti load.
- All geometry comes from pure, exported, unit-tested helpers. `VfxOverlay.vue` only wires
  them.
- Budget: the spray stays within the 200-particle ceiling, and live slice halves are capped
  at 10. Animations touch `transform` and `opacity` only.
- The takedown word never displaces another beat's word. It shows when the shared word slot
  is empty (`currentWord === null`) **or** already holds one of the three takedown words
  (membership in the locked takedown strings), so the beat can escalate its own word
  (DOUBLE → TRIPLE) inside the 1300 ms word hold.
- **Naming.** Every new overlay identifier uses the `slice` stem, never `slash`:
  - constants `SLICE_*`;
  - state and timers `slice*`;
  - CSS `.vfx-overlay__slice-*` and keyframes `vfx-slice-*`;
  - the builder `buildSliceSprayOptions`.

  WP-746 already owns `SLASH_MS`, `isSlashing`, `slashKey`, `slashTimer`, `pulseSlash`,
  `.vfx-overlay__slash` and `play-vfx-slash` (`VfxOverlay.vue:126, 251-252, 270, 493, 679-684`).
  Those identifiers are not modified or reused. The stem rule applies to identifiers declared in `VfxOverlay.vue`;
  the imported contract names (`useVillainSlashVfxSignal`, the `villainSlash*` manifest and
  geometry exports) keep their locked prefix.

---

## Locked Values

EC-792 copies these verbatim. If the two ever disagree, this section wins.

**Colours and counts**
- **Spray colours:** `['#7b1fa2', '#4a0d67', '#b44fd6']`. The lead is the `--color-villain`
  accent (`styles/base.css:53`), distinct from every other effect's lead.
- **Spray count:** full **28**, low **10**.
- **Streak colours:** core `#ffffff`, glow `#d6c2ff`.

**Geometry**
- **Slash angles:** `[-28, 22, -16, 34]` degrees, chosen by `seq % 4`.
- **Angle convention:** `angleDeg` uses the screen convention (y down, clockwise positive).
  - It is fed unchanged to `splitCardAlongCut`, `buildHalfKeyframes`, `buildStainOffsets`
    and the streak's CSS `rotate()`.
  - The spray's canvas-confetti `angle` is **`-angleDeg`**, because confetti measures
    counter-clockwise with 90 pointing up.
- **Card aspect:** `CARD_ASPECT = 5 / 7` (width / height, the `CardTile` ratio).

**Timing and limits**
- **Durations:** `halfFlightMs 900`, `streakMs 260`, `stainMs 2400`.
- **Stain count:** 5.
- **Live-halves cap:** 10. The oldest is removed first.
- **Streak window:** `TAKEDOWN_STREAK_WINDOW_MS = 4000`.

**Takedown words**

| Streak | Word |
|---|---|
| 1 | `null` |
| 2 | `'DOUBLE TAKEDOWN!'` |
| 3 | `'TRIPLE TAKEDOWN!'` |
| 4 or more | `'RAMPAGE!'` |

**Selectors**
- **Space:**
  `[data-testid="play-city-villain"][data-city-index="N"], [data-testid="play-city-empty"][data-city-index="N"]`.
- **Reference tile:** `[data-testid="play-city-row"] [data-testid="play-city-villain"] [data-testid="card-tile"]` (the
  first match).

**Gates**

| Gate | Effects |
|---|---|
| `'word'` | the takedown word |
| `'particles'` | halves, streak, spray |
| `'shake'` | tumble, stains, full spray count, impact pulse on streak ≥ 3 |

**Test ids:** `play-vfx-slice-layer` (the container), `play-vfx-slice-half`,
`play-vfx-slice-streak`, `play-vfx-slice-stain`.

---

## Scope (In)

### A) `apps/arena-client/src/vfx/villainSlashVfxManifest.ts` (**new**)
The spec object (every value in §Locked Values), plus two pure helpers:
- `takedownWordForStreak(streak: number): string | null`.
- `nextTakedownStreak(previous: TakedownStreakState | null, playerId: string, nowMs: number): TakedownStreakState`,
  where `TakedownStreakState = { playerId: string; atMs: number; streak: number }`.
  - `streak = previous.streak + 1` when `previous.playerId === playerId` and
    `nowMs - previous.atMs <= TAKEDOWN_STREAK_WINDOW_MS`.
  - `streak = 1` otherwise.
  - It never reads a clock itself.

### B) `apps/arena-client/src/vfx/villainSlashGeometry.ts` (**new**)
Pure helpers, with no DOM and no Vue:
- `splitCardAlongCut(width, height, angleDeg)` returns the two polygons (arrays of
  `{ x, y }` in card-local pixels) made by cutting the rectangle through its centre at
  `angleDeg`. Each polygon has ≥ 3 vertices, and their areas sum to `width × height`.
- `toClipPathPolygon(points)` returns the CSS `polygon(...)` string.
- `polygonCentroid(points)` returns the vertex average, used as the tumble pivot.
- `buildHalfKeyframes(side, angleDeg, isTumbling)` returns the sampled ballistic keyframes
  for one half, using `transform` + `opacity` only:
  - the half is pushed apart along the cut normal (`side` = 1 or −1);
  - it gets an upward kick, then falls under gravity;
  - it rotates only when `isTumbling`;
  - it fades out over the last 40 %.
- `resolveCardBox(spaceRect, referenceTileRect)` returns the card-shaped box
  `{ left, top, width, height }`, centred on `spaceRect`'s centre:
  - If `referenceTileRect` is non-null with non-zero size, use its width and height.
  - Otherwise, `height = spaceRect.height` and `width = height × CARD_ASPECT`.
  - If `spaceRect` has zero width or height, return `null`.
- `buildStainOffsets(seq, count, angleDeg, width, height)` returns `count` deterministic
  `{ x, y, scale }` offsets spread along the cut line, inside the card box. Positions and
  scales derive from `seq` and the index, with no randomness.

### C) `apps/arena-client/src/composables/useVillainSlashVfx.ts` (**new**)
The producer. It mirrors `useExcessiveViolenceVfx`: a module-level signal,
`useVillainSlashVfxSignal()`, and an injectable renderer seam. **It reads no clock and no
randomness.** For each new `fightResolved` it emits
`VillainSlashVfxEvent { seq, citySpace, playerId, imageUrl: string | null }`:
- `imageUrl` comes from the previous frame's `extId → imageUrl` city cache. It is `null` on a
  miss, or when `display.imageUrl` is an empty string.
- The cache is refreshed on **every** non-null frame, **after** that frame's new events are
  processed. This includes the catch-up frame, which otherwise returns early and emits
  nothing.
- If a snapshot's `city` or `city.spaces` is missing, the cache stays empty and the event
  still emits, with `imageUrl: null`.

### D) `apps/arena-client/src/components/play/VfxOverlay.vue` (**modified**)
The consumer, and the overlay's EIGHTH beat. On each signal, in this order:
1. **Streak.** Read `performance.now()` (this file is D-24365-exempt; add a `// why:`), and
   update a closure-local `TakedownStreakState` using `nextTakedownStreak(...)` and the
   event's `playerId`.
2. **Word.** Show `takedownWordForStreak(streak)` when all three hold:
   - it is non-null;
   - `shouldRender('word')` is true;
   - the word slot is empty or holds a takedown word (the §Non-Negotiable rule).

   An EV fight raises `fightResolved` and `excessiveViolenceFired` in the same frame, and
   "EXCESSIVE VIOLENCE!" wins either way. The mount order (§E) makes the EV word land first,
   so the takedown word is skipped.
3. **Gate.** If `!shouldRender('particles')`, stop here. `off` and reduced motion get the word
   only.
4. **Locate.** Find the space element and the reference tile (§Locked Values selectors), and
   compute the card box with `resolveCardBox(...)`. If the element is missing or the box is
   `null`, stop.
5. **Render (the mechanism is locked).** New effects are **imperative DOM nodes** appended to
   one dedicated container in the overlay template,
   `<div ref="sliceLayerEl" data-testid="play-vfx-slice-layer">`, so that `element.animate`
   has a concrete handle. They are not a reactive `v-for` list.
   - **Halves:** spawn two, each showing the card art `<img>` (or a silhouette when
     `imageUrl` is `null`). Clip each with `toClipPathPolygon(splitCardAlongCut(...))`, pivot
     it on `polygonCentroid`, and animate it with `buildHalfKeyframes` through
     `element.animate` when that is a function.
   - **Streak:** spawn it rotated to `angleDeg`. It scales in and fades through
     `element.animate` when available, and is static otherwise.
   - **Styling (locked).** `VfxOverlay.vue` uses `<style scoped>`, and imperative nodes never
     receive the `data-v-*` attribute, so a plain scoped class selector is dead on them.
     Style slice nodes with inline `style` properties, or with `:deep()` rules under
     `.vfx-overlay__slice-layer` (the template-owned container does carry the scoped
     attribute).
   - **Spray:** fire the droplet spray through the exported pure `buildSliceSprayOptions(...)`,
     with its origin at the card-box centre normalised to the viewport and confetti
     `angle = -angleDeg`.
6. **Full intensity.** When `shouldRender('shake')` is true:
   - tumble the halves;
   - spawn `stainCount` stains at `buildStainOffsets(...)`;
   - use the full spray count;
   - pulse the impact on `streak ≥ 3`.

   Otherwise, use the low spray count, with no tumble and no stains.
7. **Removal and cleanup.**
   - Every node is removed by `setTimeout` after its duration, never by a bare
     `requestAnimationFrame`.
   - When more than 10 halves are live, the oldest is removed first.
   - `onUnmounted` clears every new timer and removes every live node.
   - Any new template bindings stay inside the existing `defineComponent` `setup()` return
     (D-6512 / P6-46).
8. **Reduced motion.** The CSS backstop sits on the template-owned layer:
   `.vfx-overlay__slice-layer { display: none }` inside the existing
   `@media (prefers-reduced-motion: reduce)` block.

### E) `apps/arena-client/src/pages/PlayViewport.vue` (**modified — required mount**)
Mount `useVillainSlashVfx(audioSnapshot)` beside the other notable-event VFX producers,
**immediately after `useExcessiveViolenceVfx(audioSnapshot)`**, with a `// why:` comment.
This keeps the within-frame watcher order deterministic, so on an EV fight the EV word fills
the slot first.

### F) ewiki (**modified/new**)
- `wiki/visual-effects.md`:
  - add a "Shipped — the villain slash" section covering the trigger, stages, palette, gates
    and budget;
  - update the Surface-1 `fightResolved` row (`:534`) from proposal to shipped.
- `ewiki/visual-effects/villain-slash.svg` + `villain-slash.py`: an illustrative still,
  generated the same way as `excessive-violence-slash.{py,svg}`.

### G) Tests (**new/modified**)
- **`villainSlashVfxManifest.test.ts`** (new):
  - the palette lead `#7b1fa2` differs from every other effect's lead;
  - spray counts are ≤ 200, and full > low;
  - the angle list is non-empty;
  - the streak-word mapping: 1 → null; 2, 3, 4 and 7 map as locked (7 → "RAMPAGE!");
  - `nextTakedownStreak`: null previous → 1; same player inside the window → increments;
    exactly at the window boundary → increments; past the window → 1; a different player → 1.
- **`villainSlashGeometry.test.ts`** (new):
  - both halves have ≥ 3 vertices inside the bounds, and their areas sum to w×h for several
    angles, including 0°;
  - `toClipPathPolygon` produces the expected format;
  - the keyframes start at identity, end at opacity 0, mirror by side, and have no rotation
    when not tumbling;
  - `resolveCardBox` uses the reference tile's size when given, falls back to a 5:7 box from
    the space height, centres on the space, and returns `null` for a zero rect;
  - `buildStainOffsets` is deterministic for the same `seq`, returns `count` entries, and
    keeps them inside the box.
- **`useVillainSlashVfx.test.ts`** (new):
  - no replay on catch-up;
  - a defeat emits `citySpace`, `playerId` and the prior-frame `imageUrl`, including when
    that prior frame was the catch-up frame;
  - a cache miss, and an empty-string `imageUrl`, both give `null`;
  - non-fight events are ignored;
  - a null snapshot, missing `notableEvents`, or missing `city` / `city.spaces` is safe.
- **`VfxOverlay.test.ts`** (modified).
  - **Harness (locked):**
    - Append the fake City element (plus a reference `card-tile`) to `document.body` with
      a stubbed `getBoundingClientRect`, and remove it in `afterEach`.
    - Stub `performance.now` with `mock.method`.
    - Mock only `setTimeout`: `mock.timers.enable({ apis: ['setTimeout'] })`, advanced with
      `mock.timers.tick(ms)` and reset in `afterEach`. Leave `setImmediate` unmocked so
      the Vue test-utils flush still works.
    - Reset `useVillainSlashVfxSignal().value = null` in `beforeEach` (the pattern at
      `VfxOverlay.test.ts:73-78`).
  - **Cases:**
    - At full, one signal renders two `play-vfx-slice-half`, one `play-vfx-slice-streak`
      and five `play-vfx-slice-stain`.
    - At low: two halves, one streak, zero stains, and no `play-vfx-impact`.
    - Under reduced motion: zero slice nodes, and the word still shows on a double.
    - At off: nothing.
    - Two same-player signals inside the window render "DOUBLE TAKEDOWN!". A third, less
      than 1300 ms later, renders "TRIPLE TAKEDOWN!" (the own-word escalation).
    - At full, streak ≥ 3 renders `play-vfx-impact`.
    - Another beat's word in the slot is not overwritten.
    - A missing element still shows the word.
    - Six rapid signals leave ≤ 10 halves.
    - Nodes are gone after `mock.timers.tick(stainMs)`.
    - `buildSliceSprayOptions` has the expected shape, including `angle === -angleDeg`.
    - Existing beats are unaffected.
- **`PlayViewport.test.ts`** (modified): one test, in this order:
  1. Reset `useVillainSlashVfxSignal().value = null`, then seed snapshot 1.
  2. `mount`.
  3. Set snapshot 2, carrying a `fightResolved`.
  4. `await nextTick()`.
  5. Assert `useVillainSlashVfxSignal().value?.citySpace` equals the event's `citySpace`.
  6. `wrapper.unmount()` (clears the overlay's slice timers).

  This pins the required mount (the WP-746 lesson).

---

## Out of Scope

- **Any engine, registry or server change.** No new notable-event type, no UIState field, no
  audience-filter change (so no Board-Visible Field 5-step).
- **Swipe-to-fight input and the pointer blade trail.** These change how a fight is
  triggered, which is a `CityRow.vue` input-model change. Named follow-up WP.
- **Team-coloured splatter.** Whether `UICardDisplay.team` is populated for villains is
  unverified. v1 uses one villain-ink palette. Named follow-up.
- **Audio.** `fightResolved` already has its `sfxManifest` row, so there is no SFX change.
- **Mastermind fights** (owned by the WP-690 mastermind-hit beat) and **escapes** (blocked on
  the deferred `escapeResolved` event).
- **The `NotableEventOverlay` "Fought" chip.** Unchanged; it keeps firing alongside the
  slash.
- **Several `fightResolved` events appended in ONE frame** play one visible beat. This is the
  accepted v1 limitation shared with `useTransformVfx` / `useExcessiveViolenceVfx`. Each
  fight is its own move, so it does not arise in normal play.
- **`02-CODE-CATEGORIES.md`.** Unchanged. This WP stays inside the existing D-24365
  subsurface instead of widening it.

---

## Files Expected to Change

- `apps/arena-client/src/vfx/villainSlashVfxManifest.ts` (new)
- `apps/arena-client/src/vfx/villainSlashVfxManifest.test.ts` (new)
- `apps/arena-client/src/vfx/villainSlashGeometry.ts` (new)
- `apps/arena-client/src/vfx/villainSlashGeometry.test.ts` (new)
- `apps/arena-client/src/composables/useVillainSlashVfx.ts` (new)
- `apps/arena-client/src/composables/useVillainSlashVfx.test.ts` (new)
- `apps/arena-client/src/components/play/VfxOverlay.vue` (modified)
- `apps/arena-client/src/components/play/VfxOverlay.test.ts` (modified)
- `apps/arena-client/src/pages/PlayViewport.vue` (modified — the required producer mount)
- `apps/arena-client/src/pages/PlayViewport.test.ts` (modified — pins the mount)
- `wiki/visual-effects.md` (modified)
- `ewiki/visual-effects/villain-slash.svg` (new) + `ewiki/visual-effects/villain-slash.py` (new)

Governance at close (not code): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24584),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

> This is 13 files in one layer (arena-client) plus ewiki docs, over the ~8-file guideline
> for three reasons:
> - The geometry is split into its own pure, tested module instead of being buried in
>   `VfxOverlay.vue`, which is already over 1,100 lines.
> - The ewiki carries a generator and an SVG, following the WP-746 precedent.
> - The required mount gets its own test.
>
> It is not Lightweight-Lane eligible (more than 4 code/test files), so it uses the standard
> two-session lane.

---

## Contract

- **Producer event:** `VillainSlashVfxEvent = { readonly seq: number; readonly citySpace: number; readonly playerId: string; readonly imageUrl: string | null }`.
- **Producer API:** `useVillainSlashVfx(snapshot: Ref<UIState | null>, render?: VillainSlashVfxRenderer): void`,
  plus `useVillainSlashVfxSignal(): Ref<VillainSlashVfxEvent | null>`.
- **Manifest helpers:** `takedownWordForStreak(streak)` and
  `nextTakedownStreak(previous, playerId, nowMs): TakedownStreakState`, both pure.
- **Geometry helpers:** the signatures in Scope §B, all pure.
- **Spray options:** `buildSliceSprayOptions(colors, particleCount, originX, originY, angleDeg): Record<string, unknown>`.
  Exported pure from `VfxOverlay.vue` (the `buildBurstOptions` pattern). It sets
  `angle: -angleDeg` and `disableForReducedMotion: true`.
- **New overlay test ids:** `play-vfx-slice-layer`, `play-vfx-slice-half`,
  `play-vfx-slice-streak`, `play-vfx-slice-stain`.
- **Unchanged:** no engine, UIState, SFX manifest or chip-label change.

---

## Vision Alignment

**Vision clauses touched:** §8 / §22 (determinism, replay-faithful behaviour), §17 (accessibility
& inclusivity: the beat honours the reduced-motion and effect-intensity gates, §17.1), and NG-1
(no pay-to-win).

**Conflict assertion:** No conflict. This WP preserves all touched clauses.

**Non-Goal proximity check:** NG-1..7 are not crossed. The beat is display-only and
off-ranking: it never alters an outcome, VP, PAR or standing, and it is not sold, persuasive
or competitive. It makes the most frequent heroic action in the game feel like one
(Operating Posture: ship a better product).

**Determinism preservation:** No engine file changes, so `finalStateHash`, `PRE_WP080_HASH`
and replays are untouched by construction. Client-side randomness (canvas-confetti) and
timing (the one `performance.now()` read) live only in the D-24365-exempt subsurface
(`src/vfx/**` and `VfxOverlay.vue`), and never feed back into `G` or any move.

## Funding Surface Gate

§20 **N/A**: this is a presentation-only VFX change. It touches no global-nav,
registry-viewer or profile funding affordance, no funding copy, and no funding channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface is added, changed
or removed. D-11804 does not apply.

---

## Acceptance Criteria

1. **One emit per new defeat.** A new `fightResolved` on `UIState.notableEvents` makes
   `useVillainSlashVfx` emit exactly one `VillainSlashVfxEvent`, carrying the event's
   `citySpace` and `playerId`. Mounting or reconnecting against an already-populated
   snapshot emits nothing. The producer reads no clock and no randomness.
2. **Card art.** The emitted `imageUrl` equals the defeated card's `display.imageUrl` from the
   snapshot before the defeat, including when that snapshot was the catch-up frame. It is
   `null` when:
   - the card was not in the prior frame's City;
   - `display.imageUrl` is empty;
   - `city` is missing.
3. **Streak.** `nextTakedownStreak` counts consecutive defeats by the same player within
   `TAKEDOWN_STREAK_WINDOW_MS` (4000 ms), and resets to 1 after the window or on a different
   player. `VfxOverlay.vue` is the only reader of `performance.now()`.
4. **Full intensity.** The overlay renders, inside `play-vfx-slice-layer`:
   - two `play-vfx-slice-half` elements on the `resolveCardBox` box (card-shaped, centred on
     the space);
   - one `play-vfx-slice-streak`;
   - `stainCount` `play-vfx-slice-stain` elements.

   It also fires one spray. The halves show the card art when `imageUrl` is non-null and a
   silhouette otherwise. Every node is removed after its duration, and on unmount.
5. **Lower intensities.**
   - `low`: halves (no tumble), streak and the low-count spray; no stains and no impact.
   - `off`: nothing.
   - Reduced motion: the takedown word only.
6. **Word slot.** The takedown word follows `takedownWordForStreak`. It may replace an
   on-screen takedown word (so DOUBLE escalates to TRIPLE inside the word hold), and it never
   overwrites any other beat's word.
7. **Missing target.** A missing City element, or a zero-size space rect, skips the
   positional stages without error. The word still follows AC-6.
8. **Budget.** Live halves never exceed 10, and the spray count stays within the
   200-particle ceiling. Animations touch only `transform` and `opacity`.
9. **Mount.** `useVillainSlashVfx(audioSnapshot)` is mounted in `PlayViewport.vue`, and a
   `PlayViewport.test.ts` case proves the signal fires through the mount. All existing VFX
   beats and their tests are unchanged.
10. **ewiki.** The visual-effects entry documents the beat, and the `fightResolved` row reads
    shipped.
11. **Green checks.** `pnpm --filter @legendary-arena/arena-client typecheck` and `test` pass,
    and `pnpm -r build && pnpm -r --no-bail test` passes, with no engine file in the diff.

---

## Verification Steps

```bash
# 1) arena-client: manifest + geometry + producer + overlay + mount
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; the new/modified suites pass; full suite 0 fail

# 2) Confirm the diff is client + docs only
git diff --name-only origin/main...HEAD
# Expected: only the files in §Files Expected to Change (+ governance at close); no packages/** path

# 3) Whole repo
pnpm -r build && pnpm -r --no-bail test
# Expected: all packages 0 fail

# 4) Local drive (preview):
#    - open a match and fight a villain; at full intensity, confirm a card-shaped split (not squashed)
#      centred on the space, plus the streak and spray
#    - at low intensity: halves + streak
#    - at off: nothing
#    - fight twice within 4 s → "DOUBLE TAKEDOWN!"

# 5) Live (operator-manual, post-deploy, D-24026): defeat a villain on play.legendary-arena.com
#    and observe the slash beat on the defeated City space.
```

---

## Definition of Done

- [ ] All Acceptance Criteria met.
- [ ] No file under `packages/**` changed, and no files outside `## Files Expected to Change`
      (plus the governance ledgers) changed.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` reports 0 errors, and
      `pnpm -r build && pnpm -r --no-bail test` is green.
- [ ] The ewiki visual-effects entry is published.
- [ ] `docs/ai/STATUS.md` updated with a dated `### WP-755 (YYYY-MM-DD)` heading.
- [ ] `docs/ai/DECISIONS.md`: D-24584 appended per the append protocol.
- [ ] Index and roadmap updated:
      - `docs/ai/work-packets/WORK_INDEX.md`: WP-755 row checked;
      - `EC_INDEX.md`: EC-792 → Done;
      - `docs/05-ROADMAP-MINDMAP.md`: node → ✅, then `pnpm roadmap:counts:write`.
- [ ] Two-commit topology: an `EC-792:` implementation commit plus a `SPEC:` governance close.
- [ ] D-24026 live-verify recorded as operator-manual-pending (not claimed) until the beat is
      seen on the deployed surface.

---

## Reserved Decision (lands at execution)

**D-24584 — villain-slash-vfx.** Reserved in `docs/ai/NUMBER-LEDGER.md`; appended to
`DECISIONS.md` at execution. It locks:
- The `fightResolved`-driven slash beat is client-only.
- The producer reads no clock; the streak clock lives in the D-24365-exempt `VfxOverlay.vue`,
  behind the pure `nextTakedownStreak`.
- Halves, streak and stains are imperative DOM nodes in one slice layer, which keeps the
  single-canvas budget.
- The defeated card's art comes from the prior-frame city cache, with a silhouette on a miss.
- The card box is centred on the space and sized from a reference tile, falling back to 5:7.
- The angle convention (screen for geometry and CSS; negated for confetti).
- The intensity-gate mapping.
- The takedown-streak window and words.
- The 10-half cap.
- The word-slot rule: a takedown word may replace another takedown word, and never any
  other beat's word.
- The `slice` naming stem, distinct from WP-746's `slash` identifiers.
- The mount order: immediately after `useExcessiveViolenceVfx`.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL on 1 item, fixed in this revision.**
- **§3:** the body relied on files that `## Assumes` did not list:
  - the `useExcessiveViolenceVfx` template and mount anchor (`PlayViewport.vue:233`);
  - the `card-tile` / `play-city-row` reference-tile selector;
  - the D-24365 exemption in `02-CODE-CATEGORIES.md:320-330`;
  - the `wiki/visual-effects.md:534` row and the `excessive-violence-slash.{py,svg}`
    generator precedent.

  A missing reference tile would make `resolveCardBox` silently fall back to 5:7. **FIXED**
  (Assumes #8). Both advisories were also taken: §17 is added to the Vision clauses, and the
  §Context path is now written in full.

**Round 2: PASS.**
- **§1:** all sections present and non-empty; 8 Out-of-Scope exclusions.
- **§2:** engine-wide boilerplate (full files, no diffs, ESM, Node v22+, 00.6), plus
  packet-specific rules, the session protocol, and a §Locked Values block the EC copies
  verbatim.
- **§3/§4:** dependencies and context are specific, and the line references were checked
  against the repo.
- **§5:** 13 files, over the ~8 guideline. Justified in the note under Files: the split pure
  geometry module, the ewiki generator + SVG per WP-746, and the mount test.
- **§6:** test ids and selectors match `CityRow.vue` / `CardTile.vue`, and the `slice` stem
  avoids WP-746's `slash*` identifiers.
- **§7:** no new dependency (`canvas-confetti` is already present; `node:test` mocks only).
- **§8:** client-only. The engine is consumed via `import type`, and randomness plus the one
  `performance.now()` read stay inside the D-24365 subsurface.
- **§9:** pnpm/git only.
- **§10:** no env vars.
- **§11:** N/A (no auth).
- **§12:** `node:test`, with no boardgame.io, network or DB. No deck is constructed, so there
  is no golden test.
- **§13:** exact pnpm commands with expected output, plus the D-24026 manual drive.
- **§14:** eleven binary, observable ACs aligned to Scope A–G.
- **§15:** STATUS / DECISIONS (D-24584) / WORK_INDEX / EC_INDEX / mindmap, plus the
  scope-boundary check. The D-24026 live-verify is recorded, not claimed.
- **§16:** human-style referenced; pure exported builders (the `buildBurstOptions` pattern);
  D-6512 `setup()` return.
- **§17:** satisfied (§8 / §17 / §22 / NG-1, no conflict, NG proximity, determinism line).
- **§18:** N/A (no literal-string forbidden-token grep in the Verification Steps).
- **§19:** N/A (commit-time rule).
- **§20:** N/A (presentation-only; no funding affordance, copy or channel).
- **§21:** N/A (no HTTP endpoint and no `apps/server/src/**` library surface).

## Gate Record

**Copilot check (01.7), round 3: PASS → CONFIRM** (re-confirm after the lint and pre-flight-r3 edits; session prompt checked: no scope added).

**Copilot check (01.7), round 2: PASS → CONFIRM.** All five round-1 findings are resolved, with no new risk. The
one wording note (the stem rule scope vs imported `villainSlash*` names) is applied.

**Copilot check (01.7), round 1: RISK → HOLD.** Five scope-neutral findings, all folded into
this revision:
1. Scoped CSS is dead on imperative nodes → inline or `:deep()` styling, with the
   reduced-motion backstop on the template-owned layer.
2. The empty-slot rule blocked the beat's own escalation → a takedown word may replace another
   takedown word, never another beat's word; plus a TRIPLE-within-1300 ms test.
3. Coverage and harness gaps:
   - AC tests added for stains, low, reduced motion, impact and the cap;
   - timer mocking locked (`setTimeout` only);
   - the `PlayViewport` test order locked;
   - the mount position locked after the EV producer.
4. Identifier collision with WP-746's `slash*` → the `slice` stem is locked
   (`buildSliceSprayOptions`).
5. The EC now carries the §Contract signatures, plus `// why:` entries for the confetti angle
   negation, the `seq`-derived angles/stains, and `setTimeout` removal.


**Pre-flight (01.4), round 3: READY TO EXECUTE** (re-confirm after the copilot + lint edits; RS-D (line ref 320-330) and RS-E (mount-test signal reset + unmount) applied).

**Pre-flight (01.4), round 2: READY TO EXECUTE** (round 1: NOT READY; the round-2 wording notes RS-A (RS-7 phrasing) and RS-C (reference tile → the inner `card-tile`) are applied; RS-B (#2346 ledger reservation) is resolved: merged.)

**Pre-flight (01.4), round 1: NOT READY.** One blocking finding and eight clarifications, all
folded into this revision. None changed scope.
- **PS-1:** the streak clock was in `composables/`, outside the D-24365 subsurface. Moved to
  `VfxOverlay.vue` behind the pure `nextTakedownStreak`.
- **RS-1:** the space rect is usually the non-card-shaped empty placeholder → `resolveCardBox`,
  with a reference tile and a 5:7 fallback.
- **RS-2:** stain placement needed a helper → deterministic `buildStainOffsets`.
- **RS-3:** the angle convention was unlocked → locked (confetti uses `-angleDeg`).
- **RS-4:** missing producer guards → `city` guards, a refreshed catch-up cache, and empty
  `imageUrl` → `null`.
- **RS-5:** timers and the render mechanism were unspecified → imperative DOM in
  `play-vfx-slice-layer`, `setTimeout` removal, `onUnmounted` cleanup, D-6512.
- **RS-6:** the EC needed template conformance → Locked Values moved into the WP; gate lines
  added to the EC.
- **RS-7:** the lint self-review was a placeholder → open until the 00.3 gate run fills §Lint Gate Self-Review.
- **RS-8:** the required mount had no test → `PlayViewport.test.ts` added.
