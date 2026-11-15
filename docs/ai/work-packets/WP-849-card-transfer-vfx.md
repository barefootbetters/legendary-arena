# WP-849 — Card-transfer flight: a gained Wound flies from the Wounds supply to the player's pile (Arena Client)

**Status:** Draft 2026-10-28 (EC-887; D-24785 reserved). Gates: 01.4 pre-flight READY TO EXECUTE (round 1 NOT READY → fixed; re-confirmed after every later edit); 01.7 copilot RISK → PASS (round 2); 00.3 self-review below.
**Primary Layer:** Arena Client (presentation only) — single layer, standard two-session lane
**Dependencies:** WP-556 (VFX foundation + Effect-Intensity gate, D-24365) ✅, WP-650 (wound vignette, the `woundCount` count-delta consumer, D-24462) ✅, WP-755 (villain slash, the DOM-anchored positional beat, D-24584) ✅ — all on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (the play board, desktop + mobile)

> Baseline: `origin/main` at `1c629e95` (PR #3069). Numbers reserved by PR #3070.

---

## Goal

When a player gains a Wound, a Wound card visibly lifts off the **Wounds** supply cell, arcs
across the board and lands on that player's pile: your own discard pile (or your hand, for the
rare gain-to-hand effect), or the receiving opponent's panel. A Master Strike that wounds every
player fans one card to each seat, 160 ms apart. Today a gained Wound changes two numbers and,
for your own seat, flashes the WP-650 red vignette; nothing shows where the card went.

The beat is built as a general **card-transfer** flight (supply → pile) with Wound as its only
kind in this WP. Rescuing a Bystander (→ Victory Pile), recruiting a S.H.I.E.L.D. Officer and
recruiting a Sidekick (→ discard) are the named next kinds and plug into the same manifest,
geometry and layer (see Out of Scope).

## User-Visible Impact

On play.legendary-arena.com, desktop and mobile:

- **Full intensity:** the Wound card rises off the Wounds cell (120 ms), arcs toward the
  receiving pile tilting along the way (500 ms), and settles onto it (200 ms) with a red ring and
  a short thud on the destination pile.
- **Low intensity:** a short straight glide (380 ms) and the red ring; no lift, tilt or thud.
- **Off, or a reduced-motion OS setting:** nothing plays. Counts are unchanged in every mode:
  they update when the frame arrives, as today; the flight never holds a number back.
- The WP-650 vignette and wound thud sound are unchanged.
- A flight whose source or destination is off screen is skipped. On mobile the supply band
  scrolls sideways and the page scrolls vertically, so mobile skips often; desktop is the primary
  surface and the D-24026 check runs there.

Design reference (non-normative): the interactive prototype published for Jeff on 2026-10-28,
"Card Transfer VFX" (claude.ai artifact `4yBv9ZTGt1Ap7hfashhDro`), which also shows the three
future kinds.

## Assumes

- `UIState.piles.woundsCount` (`packages/game-engine/src/ui/uiState.types.ts`, `UISharedPilesState`)
  is projected to every audience, and drops by one per Wound taken from the supply.
- `UIPlayerState` carries `playerId`, `woundCount`, `discardCount` and `handCount` for every seat
  and audience; `woundCount` counts Wounds in every zone, so it rises by one per Wound gained
  from any source (WP-650 relies on this) and falls on a heal.
- `UIPlayerState.discardTopCard?: UIDisplayEntry | null` is public to every audience (D-12803,
  `uiState.filter.ts` ~L262), so after a Wound lands on a discard the receiving seat's
  `discardTopCard.extId` is the Wound ext id and `display.imageUrl` is its art.
- The local seat is the one whose `handCards !== undefined` (the `useWoundVfx` self-selection).
- Wound destinations in the engine today: `gainWoundForPlayer` (`board/wounds.logic.ts` ~L79,
  the chokepoint every Master Strike, Scheme Twist, villain effect and `resolveCrushingShockwave`
  routes through) appends the Wound to the **discard**, so it becomes that seat's
  `discardTopCard`; Random Acts of Unkindness (`moves/seatChoiceCards.ts` ~L288) puts it in the
  **hand**, and its pass-left step (`buildPassLeftChoice`, ~L313) can then pass that Wound to the
  left seat without touching the supply. Diving Block / Flying Shield Block return a landed Wound from the discard to the
  supply (`moves/divingBlock.logic.ts` ~L375, `moves/flyingShieldBlock.logic.ts` ~L410).
- The board already exposes every anchor as a `data-testid` (no component change needed):
  `play-shared-deck-wounds` (`SharedDecks.vue`), `play-your-discard` (`YourDeckDiscardZone.vue`),
  `play-hand-row` (`HandRow.vue`), and per opponent `play-opponent-panel[data-player-id]` with
  children `play-opponent-discard` / `play-opponent-hand` (`OpponentPanel.vue`). A live hand or
  City card renders `data-testid="card-tile"`. `PlayDesktop.vue` and `PlayMobile.vue` both mount
  `SharedDecks` and `OpponentPanel`.
- `apps/arena-client/src/components/play/woundIdentity.ts` exports `WOUND_EXT_ID` (drift-tested
  against the engine).
- `apps/arena-client/src/vfx/effectIntensity.ts` exports `useEffectIntensity()` returning
  `{ intensity, prefersReducedMotion, shouldRender }`; `shouldRender('particles')` is false at
  `off` and under reduced motion, `shouldRender('shake')` is true only at `full` without reduced
  motion.
- Every VFX consumer is called once in `apps/arena-client/src/pages/PlayViewport.vue` against
  `audioSnapshot`, and overlays mount once in its template (`<VfxOverlay />` ~L691).
- Tests run under `node:test` with `../../testing/jsdom-setup`; jsdom implements neither canvas
  nor `Element.prototype.animate`.

## Context (Read First)

- `.claude/rules/architecture.md` §Engine Owns Truth, §Layer Boundary (arena-client imports only
  the `.` engine surface), and `.claude/rules/code-style.md`.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2.
- `wiki/visual-effects.md` — the VFX Trigger Contract (Critical Invariants 1–6, Input surface
  authority, accessibility gate, performance budget). **AUTHORITATIVE** for what VFX may read and
  how it is gated.
- `docs/ai/DECISIONS.md`: D-24365 (VFX foundation, the `src/vfx/` determinism exemption and its
  scope), D-24462 (wound vignette), D-24584 (villain slash: DOM nodes, `transform`/`opacity`
  only, prior-frame art cache, silhouette on a miss), D-12803 (public `discardTopCard`), D-20105
  (no effect semantics in the client), D-24026 (live verify).
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §client-app: the determinism exemption covers
  `src/vfx/` and `VfxOverlay.vue` only, so the new layer component must not call `Math.random()`,
  `Date.now()` or `performance.now()`. `setTimeout` is already used by ordinary components.
- `PlayViewport.vue` is an allowlisted wiring file (Files §9), so the 01.5 runtime-wiring
  allowance is not invoked.
- `docs/ai/REFERENCE/00.6-code-style.md`.

Jeff asked for a visual effect of a Wound card moving from the Wound deck to the player's discard
pile, to be reused later for rescuing a Bystander into the Victory Pile and recruiting a
S.H.I.E.L.D. Officer or a Sidekick into the discard.

**Why a count-pair trigger, not a new engine event.** A gain shows up in one frame as two count
changes the client already receives: the supply count drops and the receiving seat's count rises.
Pairing them names both the source and the destination, so the beat needs no engine change, no
`UIState` field and no re-pin, the same posture as the WP-650 vignette and the WP-690
mastermind-hit beat. VFX Critical Invariant 6 (VFX invents no gameplay event) holds. The pairing
is checked per seat, so a supply drop with no matching seat rise (or a rise with no supply drop)
flies nothing.

**Why a confirmed delta, not the move dispatch.** Moves reject silently (Move Validation
Contract), so an effect fired on dispatch plays for a move the engine refused. The flight fires
on the authoritative frame only. This is also why the later Officer / Sidekick kinds should not
use the Surface-3 dispatch hook.

**Why its own component.** `VfxOverlay.vue` is already 1,763 lines. The flight needs no canvas
(the budget's one canvas stays `canvas-confetti`'s): the ghost card is a DOM node animated with
the Web Animations API on `transform` / `opacity`, the WP-755 halves precedent. Keeping it out of
`VfxOverlay.vue` also keeps it outside the D-24365 exemption, which it does not need.

**Supersession check (01.0a Step 2):** `git log --all --grep="card-transfer"`, `ls` for
`*transfer*` and `gh pr list --search "card transfer"` found no prior work. Near-matches, not
overlaps: WP-650 (full-screen vignette on the same `woundCount` rise; kept), the visual-effects
page's Surface 1b "bystander rescued" coin arc and Surface 3 `recruitHero` glow (unbuilt
proposals; the future kinds of this beat cover their destinations).

Not Lightweight Lane: 8 code/test files plus one wiring file (01.0a eligibility #2), and it adds
an extension seam (the `CardTransferKind` union) and runtime wiring, so a 01.6 post-mortem is
mandatory.

## Scope (In)

1. **Manifest — `src/vfx/cardTransferVfxManifest.ts` (new).** The closed
   `CardTransferKind = 'wound'` union; `CARD_TRANSFER_VFX: Record<CardTransferKind, …>` holding,
   for `wound`, the accent token `--color-penalty` and the landing style `'thud'`; the timing
   constants; the flight caps; and two pure selector builders:
   `cardTransferSourceSelector(kind)` and
   `cardTransferDestinationSelector({ isOwnSeat, destination, playerId })`.
2. **Geometry — `src/vfx/cardTransferGeometry.ts` (new).** Pure functions, no DOM, no clock, no
   randomness: `resolveArcControlPoint({ deltaX, deltaY })`, `buildArcKeyframes({ deltaX, deltaY,
   endScale, isFadeOut })` (lift → sampled quadratic arc → settle), `buildGlideKeyframes(...)`
   (the two-frame low-intensity glide) and `resolveEndScale(...)`, all exported. Locked math in Non-Negotiable Constraints.
3. **Producer — `src/composables/useCardTransferVfx.ts` (new).** Watches the snapshot, pairs the
   count changes (algorithm below) and publishes `CardTransferVfxEvent[]` batches to a
   module-level signal (the `useWoundVfx` signal + injectable-renderer seam). Reads `UIState`
   only; DOM-free.
4. **Renderer — `src/components/play/CardTransferLayer.vue` (new).** A fixed, `aria-hidden`
   layer (`z-index: 300`, above the WP-650 vignette at 180 and the `NotableEventOverlay` chip at
   200, below modals at 1000; `pointer-events: none` on the layer and every child) that watches
   the signal, waits out each flight's stagger delay, then resolves the anchors with
   `document.querySelector` and measures them with `getBoundingClientRect` (never `offsetWidth`:
   the desktop stage is scaled),
   creates one ghost card per event (image or silhouette), animates it with
   `Element.prototype.animate`, plays the landing ring as a layer-owned fixed node over the
   destination rect and the thud as a WAAPI `transform` animation on the destination element
   (no node inserted into board DOM, no class change), and removes every node and clears every
   pending timer it created, on finish and on unmount. Exports its pure helpers for tests (the `VfxOverlay`
   precedent).
5. **Wiring — `src/pages/PlayViewport.vue` (modified, allowlisted wiring).** Call `useCardTransferVfx(audioSnapshot)`
   beside `useWoundVfx`, register `CardTransferLayer` and mount `<CardTransferLayer />` once next
   to `<VfxOverlay />`.
6. **Tests (new files, locked counts):**
   `cardTransferVfxManifest.test.ts` 5 (incl. the anchor test-id pin),
   `cardTransferGeometry.test.ts` 6, `useCardTransferVfx.test.ts` 11,
   `CardTransferLayer.test.ts` 8 — arena-client +30. Cases are listed in EC-887.
7. **ewiki — `wiki/visual-effects.md` (modified).** A "Shipped — the card-transfer flight"
   section (trigger, gates, files, the three named next kinds); an Input-surface-authority row for
   `UIState.piles.*Count` and per-seat `discardCount` / `handCount` / `victoryCount` as transfer
   pairing inputs; the Surface 1b wound row notes the flight beside the vignette; and, per
   D-24785, three contract passages amended: "Where the visual-effects layer lives" (the one
   full-bleed overlay gains a sanctioned second DOM host for positional flights), "Performance
   budget" (the flight pool drops the newest, not the oldest), and the Shared Renderer Contract's
   "Fire time" row (a flight starts on the trigger frame; its landing is follow-through, not a
   retimed trigger). `last-reviewed` bumped.

**Pairing algorithm (locked):**

- Keep `lastSeen = { woundsCount, seats: Map<playerId, { woundCount, discardCount, handCount, discardTopExtId }> }`.
  Seed it on the first frame that has `piles` and `players`; emit nothing on that frame. A seat
  first seen later is seeded and flies nothing on that frame. A `null` snapshot clears
  `lastSeen`, so the next valid frame (a new match, play-again, or a resync that passed through
  `null`) re-seeds silently. A resync that never passes through `null` may fly the Wounds gained
  while disconnected, up to the cap; accepted.
- On each later frame: `supplyDrop = lastSeen.woundsCount - next.piles.woundsCount`. If
  `supplyDrop <= 0`, emit nothing (a Diving Block return raises the supply; a heal lowers
  `woundCount`).
- Otherwise walk `next.players` in array order. For each seat with
  `woundDelta = woundCount - lastSeen.woundCount > 0`: `flights = min(woundDelta, remaining)`,
  where `remaining` starts at `supplyDrop` and falls by `flights`. Destination is `'discard'`
  when the seat's `discardCount` changed or its `discardTopCard.extId` became `WOUND_EXT_ID`
  this frame (it was something else before); otherwise `'hand'` when `handCount` rose by at
  least `woundDelta`; otherwise `'discard'`. (A gain to hand never touches the discard, so any
  discard change means the Wound went there, including a same-frame reshuffle-draw that would
  fool a count comparison.)
- Each flight gets `staggerIndex` 0, 1, 2… in emission order, which is `players` array order,
  deliberately, not the engine's clockwise-from-current-player resolution order. Emit at most
  `CARD_TRANSFER_MAX_FLIGHTS_PER_FRAME` (5) per frame; the layer also keeps at most
  `CARD_TRANSFER_MAX_LIVE_FLIGHTS` (5) flights scheduled-or-alive (a staggered flight counts from
  the moment it is scheduled) and drops any new flight beyond that, never queueing it (performance budget: at most 5 simultaneous bursts, never queue a backlog).
- Art: `imageUrl` is the receiving seat's `discardTopCard.display.imageUrl` when its `extId` is
  `WOUND_EXT_ID`; otherwise the last Wound `imageUrl` this composable saw on any seat; otherwise
  `null` (the layer draws a silhouette).
- Always advance `lastSeen` to the new frame, emitting or not. A frame without `piles` / `players`
  is skipped and leaves `lastSeen` as it was.

## Out of Scope

- **Bystander, S.H.I.E.L.D. Officer and Sidekick flights.** Each is a new `CardTransferKind`
  member with its own pairing rule and anchor, in its own WP: Bystander stack → Victory Pile
  (`bystandersCount` ↓ + `victoryCount` ↑), a captured Bystander from its City space → Victory
  Pile (needs the `fightResolved` `citySpace` + `bystandersRescued` fields, after the villain
  slash), Officer and Sidekick supply → discard. A recruited HQ Hero → discard is the same beat
  and can retire the visual-effects page's pending `heroRecruited` event question.
- A reverse flight when Diving Block / Flying Shield Block returns a Wound to the supply.
- Any change to the WP-650 vignette, the wound thud sound, `VfxOverlay.vue` or any count display.
- Holding a displayed count until the card lands.
- Wounds moved between seats without leaving the supply (Random Acts pass-left) fly nothing: the
  receiver's `woundCount` rises with no supply drop.
- Any engine, server, `UIState`, registry or card-data change.
- A new `VfxKind`, a new dependency, a second canvas, or an appendix mock on the ewiki page.

## Files Expected to Change

1. `apps/arena-client/src/vfx/cardTransferVfxManifest.ts` — new — kinds, timings, caps, selectors
2. `apps/arena-client/src/vfx/cardTransferVfxManifest.test.ts` — new — 5 tests
3. `apps/arena-client/src/vfx/cardTransferGeometry.ts` — new — arc / glide keyframes, end scale
4. `apps/arena-client/src/vfx/cardTransferGeometry.test.ts` — new — 6 tests
5. `apps/arena-client/src/composables/useCardTransferVfx.ts` — new — the count-pair producer
6. `apps/arena-client/src/composables/useCardTransferVfx.test.ts` — new — 11 tests
7. `apps/arena-client/src/components/play/CardTransferLayer.vue` — new — the renderer
8. `apps/arena-client/src/components/play/CardTransferLayer.test.ts` — new — 8 tests
9. `apps/arena-client/src/pages/PlayViewport.vue` — modified — allowlisted wiring (call + register + mount)
10. `wiki/visual-effects.md` — modified — shipped section, authority row, Surface 1b note, three D-24785 contract amendments

Post-mortem (mandatory per 01.6, new extension seam + runtime wiring):
`docs/ai/post-mortems/01.6-WP-849-card-transfer-vfx.md` — new.

Governance (execution close, `SPEC:` commit): `docs/ai/DECISIONS.md` (D-24785), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md` (+ `pnpm roadmap:counts:write`), `docs/ai/NUMBER-LEDGER.md` (LANDED marks).

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+. `node:test` only; no `boardgame.io` import in any test.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (JSDoc on every function, full-word
  names, functions under ~30 lines, no nested ternaries, `// why:` on non-obvious decisions).

**Packet-specific:**
- Arena Client only. No file under `packages/`, `apps/server/` or `data/` changes. Imports from the
  engine are type-only from `@legendary-arena/game-engine` (`.` surface).
- Reads projected `UIState` only; never writes it, never reads the game log or `notableEvents`.
- `CardTransferLayer.vue` calls no `Math.random()`, `Date.now()` or `performance.now()` (it is
  outside the D-24365 exemption). `setTimeout` is allowed with a `// why:`.
- Animate `transform` and `opacity` only. No canvas, no new dependency, no new `VfxKind`.
- Fail soft: a missing anchor, a zero-size anchor, an anchor whose rect does not intersect both
  the viewport and its nearest scrollable ancestor's rect (the viewport alone when it has none)
  (an opponent panel scrolled out of the
  desktop rail), or a missing `Element.prototype.animate` skips that flight with no throw and no
  leftover node. Anchors are measured with `getBoundingClientRect` at launch, after the stagger.
- The layer is `z-index: 300` with `pointer-events: none` on itself and every child.
- Every node the layer creates is removed when its flight ends, and on unmount.
- No count, prompt or board element waits on the animation.

**Locked contract values:**
- `CardTransferKind = 'wound'`; `CARD_TRANSFER_VFX.wound = { accentToken: '--color-penalty', landing: 'thud' }`.
- Timings (ms): lift 120, flight 500, land 200 (full total 820); stagger 160; low glide 380;
  landing ring 520; thud 300.
- `CARD_TRANSFER_MAX_FLIGHTS_PER_FRAME = 5`; `CARD_TRANSFER_MAX_LIVE_FLIGHTS = 5`.
- Ghost size: the width of the first `[data-testid="card-tile"]` whose width is > 0, else 72 px;
  height = width × 7 / 5.
- Arc: 12 samples with ease-in-out-quad progress; control point
  `resolveArcControlPoint = (deltaX / 2, min(0, deltaY) - arcHeight)` (above both ends by
  construction) with `arcHeight = clamp(distance × 0.32, 60, 180)`; lift to `translateY(-10px) scale(1.1)` at
  offset 120/820; tilt = `clamp(deltaX / 14, -14, 14) × sin(π t)` degrees; final keyframe at
  `(deltaX, deltaY)`, rotation 0, `scale(endScale)`, opacity 0 when `isFadeOut` else 1.
- `resolveEndScale`: a destination at least as wide as the ghost → 1; narrower → its width / ghost
  width, floored at 0.3; a destination under 0.6 of the ghost's width also sets `isFadeOut`.
- Gates: the flight (and the landing ring) render only when `shouldRender('particles')`; the
  arc + lift + tilt only when `intensity === 'full'`, else the glide; the destination thud only
  when `shouldRender('shake')`.
- Selectors: source `[data-testid="play-shared-deck-wounds"]`; own discard
  `[data-testid="play-your-discard"]`; own hand `[data-testid="play-hand-row"]`; opponent
  `[data-testid="play-opponent-panel"][data-player-id="<id>"] [data-testid="play-opponent-discard"]`
  (or `play-opponent-hand`).
- Event: `CardTransferVfxEvent = { seq, kind, playerId, isOwnSeat, destination: 'discard' | 'hand', staggerIndex, imageUrl: string | null }`.

**Session protocol:** if any assumption above does not hold on `main` at execution time, or a
change outside the ten files (plus post-mortem and governance) seems needed, stop and ask — do not
improvise.

## Vision Alignment

**Vision clauses touched:** §8 / §22 (determinism, replay-faithful behaviour), §17 (accessibility:
the beat honours the reduced-motion and Effect-Intensity gates, §17.1), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict: this WP preserves all touched clauses.

**Non-Goal proximity check:** display only. It changes no outcome, VP, PAR or standing, and no
purchase or cosmetic touches it. NG-1..7 not crossed. It makes a punishing moment legible: the
player sees where the Wound went (Operating Posture: ship a better product).

**Determinism preservation:** no engine file changes, so `finalStateHash`, `PRE_WP080_HASH` and
replays are untouched by construction; the layer uses no randomness or clock reads.

**Funding Surface Gate (§20):** N/A — presentation only; no funding affordance or copy.

## Acceptance Criteria

1. A frame where `piles.woundsCount` drops by 1 and the local seat's `woundCount` and
   `discardCount` each rise by 1 produces exactly one event: `kind 'wound'`, `isOwnSeat true`,
   `destination 'discard'`, `staggerIndex 0`.
2. A frame where the supply drops by 3 and three seats each gain one Wound produces three events
   in `players` order with `staggerIndex` 0, 1, 2.
3. A Wound gained to hand (`handCount` +1, `discardCount` +0, discard top unchanged) produces
   `destination 'hand'`; a Wound gained to discard in the same frame as a reshuffle-draw
   (`discardCount` falls, `handCount` rises, discard top becomes the Wound) produces `'discard'`.
4. The first frame, a heal (`woundCount` down), a Diving Block return (supply up), a pass-left
   (`woundCount` up with no supply drop), and the first frame after a `null` snapshot each
   produce no event.
5. A supply drop of 8 across seats produces exactly 5 events.
6. A spectator frame (no seat with `handCards`) still produces events, all `isOwnSeat false`.
7. With intensity `off` or reduced motion, and with real (stubbed) anchor rects and a stub
   `animate`, the layer creates no node and never calls `animate`.
8. A missing anchor, or a missing `Element.prototype.animate`, creates no leftover node and throws
   nothing; with a stub `animate`, the ghost is appended and removed when the animation finishes.
9. At `low` intensity the ghost's keyframes are the two-frame glide; at `full`, the arc.
9a. Six events against never-finishing stub animations leave exactly 5 ghosts; unmounting the
    layer leaves no layer node and no pending timer (observed with a `setTimeout` /
    `clearTimeout` spy whose scheduled and cleared-or-fired counts balance).
9b. The manifest pin test reads `SharedDecks.vue`, `YourDeckDiscardZone.vue`, `HandRow.vue` and
    `OpponentPanel.vue` with `node:fs` and finds every anchor in its quoted `data-testid="…"` form (a bare substring would survive a
    rename because `play-your-discard-top` etc. remain) and the
    `:data-player-id="player.playerId"` binding, so renaming one fails a test instead of silently
    killing the flight.
10. The geometry: first keyframe at the origin, last at `(deltaX, deltaY)` with rotation 0;
    `resolveArcControlPoint` is above both ends for downward, level and long upward flights
    (including `deltaY = -600`); tilt within ±14°.
11. No engine, server or data file changed; sentinel `finalStateHash` and `PRE_WP080_HASH`
    byte-identical; no existing test file changed.
12. arena-client suite passes with 0 failures and exactly +30 tests; `pnpm -r build` exits 0;
    arena-client `typecheck` exits 0.

## Verification Steps

```pwsh
pnpm -r build                                              # exits 0
pnpm --filter @legendary-arena/arena-client test           # "fail 0", +30
pnpm --filter @legendary-arena/arena-client typecheck      # exits 0
git status --short                                         # only the 10 allowlisted files (+ post-mortem, governance at close)
git diff --name-only origin/main -- '*.test.ts'            # exactly the 4 new test files
git diff --name-only origin/main -- packages apps/server data   # empty
Select-String -Path apps/arena-client/src/components/play/CardTransferLayer.vue -Pattern 'Math\.random\(|Date\.now\(|performance\.now\('   # no matches
pnpm ledger:numbers:check; pnpm workindex:rows:check; pnpm workindex:executed:check   # each exits 0 (at close)
```

Browser preview: start the `arena-client` preview, open `?fixture=mid-turn&play=1`, push a second
snapshot into the UI-state store with `piles.woundsCount` one lower and the viewer's `woundCount`
and `discardCount` one higher, then confirm with `document.getAnimations()` (pause, set
`currentTime`, read the ghost's computed `transform`) that a ghost travels from
`play-shared-deck-wounds` to `play-your-discard` and is removed after it finishes. Mid-flight, also confirm
`getComputedStyle(layer).zIndex === '300'` and that `document.elementsFromPoint` at the ghost's
centre lists the ghost above any `NotableEventOverlay` chip. Repeat with intensity `low` and `off`. The offscreen pane freezes the animation clock, so drive the timeline
rather than wait on it.

D-24026 after the arena-client deploy: in a real match on play.legendary-arena.com, take a Wound
(a Master Strike, or fight a villain whose Fight effect wounds) and see the card fly to your
discard pile; in a 2+ player match the opponents' Wounds fly to their panels. Run it on desktop
(mobile skips off-screen ends by design).

## Definition of Done

- [ ] Acceptance Criteria 1–12 pass; command output tails pasted in the execution PR.
- [ ] No files outside `## Files Expected to Change` and the listed governance files were modified
      (`git diff --name-only` checked).
- [ ] 01.6 post-mortem written (before the `EC-887:` commit); it names the test-id coupling and
      the drop-newest cap.
- [ ] `wiki/visual-effects.md` carries the shipped section, the authority row, the Surface 1b note
      and the three D-24785 amendments, `last-reviewed` bumped; after the `wiki-viewer.yml` deploy
      the page is checked live (CF Access service-token curl) for the new section.
- [ ] `docs/ai/DECISIONS.md` — D-24785 landed Active.
- [ ] `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` exit 0.
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date; EC_INDEX row `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node 📝 → ✅; `pnpm roadmap:counts:write`, then
      `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/NUMBER-LEDGER.md` WP-849 / EC-887 / D-24785 marked LANDED.
- [ ] Two-commit topology (`EC-887:` implementation + `SPEC:` governance close); PR squash-merged.
- [ ] Live-on-surface verification (D-24026): a real match on play.legendary-arena.com shows the
      Wound flight — or flagged operator-pending in WORK_INDEX.

## Reserved Decision (lands at execution)

**D-24785** — The card-transfer flight is a client-only presentation beat triggered by pairing a
supply-count drop with a seat's count rise in the same projected frame (no engine event, no
`UIState` field), fired on the confirmed frame, never on move dispatch. It renders on its own
DOM layer (`CardTransferLayer.vue`, no canvas, outside the D-24365 exemption, no clock or
randomness, at most 5 flights per frame and 5 scheduled-or-alive, overflow dropped), gated `particles` for the flight and ring and `shake` for the destination thud, with
the arc at `full` and a glide at `low`. Counts never wait on it. `CardTransferKind` is a closed
union, `'wound'` first; each further kind (Bystander, Officer, Sidekick, recruited Hero) is added
by its own WP with its own pairing rule. It amends three VFX-contract passages
(`wiki/visual-effects.md`): (1) the single full-bleed `VfxOverlay` gains one sanctioned second
host, a DOM-only layer for positional flights, which adds no canvas; (2) the flight pool drops the
**newest** flight at its cap, not the oldest, so a card already in the air never vanishes
mid-flight; (3) a flight starts on the same frame as its sibling renderers (the WP-650 vignette and
thud sound), and its landing ~620-820 ms later is follow-through, not a retimed trigger; the
stagger is cosmetic and non-authoritative.

## Lint Gate Self-Review (00.3)

| § | Result |
|---|---|
| §1 Structure | PASS — all required sections present and non-empty; Out of Scope lists 7 exclusions |
| §2 Constraints | PASS — engine-wide (full files, ESM, Node 22, 00.6), packet-specific, session protocol, locked values |
| §3 Assumes | PASS — every `UIState` field, engine destination site, anchor test id and client helper the packet reads |
| §4 Context | PASS — rules files, ARCHITECTURE.md, visual-effects contract, D-entries, code-category scope; 00.2 untouched (no data fields) |
| §5 Files | PASS — 8 new code/test files + 1 allowlisted wiring file + 1 ewiki page + post-mortem, each with a description; over ~8, justified (four tested units) |
| §6 Naming | PASS — reuses `woundsCount` / `woundCount` / `discardCount` / `handCount` / `discardTopCard` verbatim; new names are full words |
| §7 Dependencies | PASS — none added |
| §8 Boundaries | PASS — arena-client only, type-only `.` engine imports |
| §9 Windows | PASS — `pwsh` commands, `pnpm` only |
| §10 Env vars | N/A — none used |
| §11 Auth | N/A — no auth surface |
| §12 Tests | PASS — `node:test`, jsdom setup, no boardgame.io, no network/DB |
| §13 Verification | PASS — exact commands with expected output, plus a driven-timeline browser check |
| §14 AC | PASS — 12 binary items naming fields, values and counts |
| §15 DoD | PASS — STATUS, DECISIONS, WORK_INDEX, scope-boundary check, D-24026 item |
| §16 Code style | PASS — enforced through Constraints and EC-887 |
| §17 Vision | PASS — §8/§22, §17, NG-1 cited; no conflict; determinism line present |
| §18 Prose-vs-grep | PASS — the one grep (`Math.random(` / `Date.now(` / `performance.now(` in `CardTransferLayer.vue`) matches the call form; `// why:` comments must not spell those call forms |
| §19 Staleness | Applied at commit (baseline re-checked against `origin/main`) |
| §20 Funding | N/A — presentation only |
| §21 API catalog | N/A — no `apps/server` endpoint or catalog function touched |
