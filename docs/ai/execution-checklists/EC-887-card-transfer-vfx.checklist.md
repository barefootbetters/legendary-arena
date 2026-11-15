# EC-887 — Card-transfer flight: Wound supply → player's pile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-849-card-transfer-vfx.md
**Layer:** Arena Client (presentation only)
**Status:** Draft

## Before Starting
- [ ] WP-556, WP-650, WP-755 complete in WORK_INDEX; D-24785 reserved in NUMBER-LEDGER
- [ ] `UISharedPilesState.woundsCount` and `UIPlayerState.{woundCount, discardCount, handCount, discardTopCard}` still projected (public)
- [ ] Test ids still present: `play-shared-deck-wounds`, `play-your-discard`, `play-hand-row`,
      `play-opponent-panel` (with `:data-player-id`), `play-opponent-discard`, `play-opponent-hand`, `card-tile`
- [ ] `useEffectIntensity()` still returns `{ intensity, prefersReducedMotion, shouldRender }`
- [ ] `PlayViewport.vue` still calls `useWoundVfx(audioSnapshot)` and mounts `<VfxOverlay />` once
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client test` exits 0 (record count);
      `pnpm --filter @legendary-arena/arena-client typecheck` exits 0

## Locked Values (do not re-derive)
- `CardTransferKind = 'wound'`; `CARD_TRANSFER_VFX.wound = { accentToken: '--color-penalty', landing: 'thud' }`
- Timings (ms): lift 120, flight 500, land 200 (total 820); stagger 160; glide 380; ring 520; thud 300
- `CARD_TRANSFER_MAX_FLIGHTS_PER_FRAME = 5`; `CARD_TRANSFER_MAX_LIVE_FLIGHTS = 5` scheduled + alive (overflow dropped, never queued)
- Ghost width = first `card-tile` with width > 0, else 72 px; height × 7/5
- Arc: 12 samples, ease-in-out-quad; `resolveArcControlPoint` = `(dx/2, min(0,dy) - clamp(dist*0.32, 60, 180))`;
  lift `translateY(-10px) scale(1.1)` at offset 120/820; tilt `clamp(dx/14, -14, 14) * sin(PI*t)`°
- End scale: dest ≥ ghost width → 1; else dest/ghost floored 0.3; dest < 0.6 × ghost → fade out
- Gates: flight + ring `shouldRender('particles')`; arc only at `intensity === 'full'` else glide;
  thud `shouldRender('shake')`
- Destination: `'discard'` if `discardCount` changed or its top became `WOUND_EXT_ID` this frame; else `'hand'`
  if `handCount` rose ≥ `woundDelta`; else `'discard'`. Stagger in `players` array order (intentional)
- Event: `{ seq, kind, playerId, isOwnSeat, destination, staggerIndex, imageUrl }`
- Commit: `EC-887: card-transfer flight - a gained Wound flies from the supply to the player's pile (WP-849)`

## Guardrails
- Arena Client only; nothing under `packages/`, `apps/server/`, `data/` changes; engine imports type-only.
- Reads projected `UIState` only; no game log, no `notableEvents`, no `G`/`ctx`.
- Seed on the first valid frame; a seat first seen later seeds silently; a `null` snapshot clears
  `lastSeen`; `supplyDrop <= 0` emits nothing.
- Ring = layer-owned fixed node over the destination rect; thud = WAAPI `transform` on the
  destination element; never insert nodes into or change classes on Vue-owned board DOM.
- `CardTransferLayer.vue`: no `Math.random`, `Date.now`, `performance.now`; `transform`/`opacity` only; no canvas.
- Fail soft: missing / zero-size anchor, an anchor not intersecting both the viewport and its nearest
  scrollable ancestor (viewport alone if none), or missing `Element.prototype.animate` → skip, no throw, no leftover node.
- Measure with `getBoundingClientRect` at launch (after the stagger), never `offsetWidth` (scaled stage).
- Layer `z-index: 300` (vignette 180, notable chip 200, modals 1000); `pointer-events: none` on all.
- `// why:` comments never spell `Math.random(`, `Date.now(` or `performance.now(` (the grep gate).
- Remove every created node and clear every pending timer on finish and on unmount. Never hold a
  count or block input.
- Do not touch `VfxOverlay.vue`, `useWoundVfx.ts`, `useWoundCue.ts` or any board component.

## Required `// why:` Comments
- Producer: the seed-on-first-frame and `null` reset; the `supplyDrop <= 0` early return (Diving
  Block return, heal, Random Acts pass-left); the hand-vs-discard rule (Random Acts gains to hand;
  a Wound on top of the discard survives a reshuffle-draw); the 5-flight cap (never queue a backlog).
- Producer: the art fallback order (public `discardTopCard`, then last seen, then silhouette).
- Layer: the off-viewport skip; each `setTimeout` (stagger / cleanup); why the layer sits outside `VfxOverlay`.
- Geometry: each numeric constant (arc clamp, tilt clamp, sample count, end-scale floor).
- `PlayViewport.vue`: the wiring line, beside `useWoundVfx` (the vignette is unchanged and fires on the frame).

## Files to Produce
- `apps/arena-client/src/vfx/cardTransferVfxManifest.ts` — **new**
- `apps/arena-client/src/vfx/cardTransferVfxManifest.test.ts` — **new** — 5: kind keyset is exactly
  `['wound']` (runtime `Object.keys`); timing totals (820); source selector; destination selectors
  (own discard/hand, opponent discard/hand); anchor pin — `node:fs` reads `SharedDecks.vue`,
  `YourDeckDiscardZone.vue`, `HandRow.vue`, `OpponentPanel.vue` and finds each quoted `data-testid="…"` form (a bare substring would survive a rename via `play-your-discard-top`) and
  `:data-player-id="player.playerId"`
- `apps/arena-client/src/vfx/cardTransferGeometry.ts` — **new**
- `apps/arena-client/src/vfx/cardTransferGeometry.test.ts` — **new** — 6: arc starts at origin; ends at
  (dx,dy) rotation 0; `resolveArcControlPoint` above both ends incl. dy = -600; tilt within ±14; glide is two frames; end-scale rules
- `apps/arena-client/src/composables/useCardTransferVfx.ts` — **new**
- `apps/arena-client/src/composables/useCardTransferVfx.test.ts` — **new** — 11: first frame silent; own
  discard; three seats staggered 0..2; hand destination; reshuffle-draw frame → discard; heal silent;
  Diving Block return silent; pass-left rise without supply drop silent; cap 5 of 8; spectator frame
  `isOwnSeat false`; `null` snapshot then frame re-seeds silently
- `apps/arena-client/src/components/play/CardTransferLayer.vue` — **new**
- `apps/arena-client/src/components/play/CardTransferLayer.test.ts` — **new** — 8: off → no node and
  `animate` never called; reduced motion → same; missing anchor → no node, no throw; no `animate` →
  no node; stub `animate` → ghost appended then removed on finish; low → glide keyframes; 6 events
  with never-finishing stubs → exactly 5 ghosts; unmount → no layer node, no pending timer (a `setTimeout`/`clearTimeout` spy whose counts
  balance). EVERY
  test stubs the anchors' `getBoundingClientRect` and the viewport size (jsdom lays nothing out, so
  unstubbed rects are zero and every test would pass through the zero-size skip instead)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — allowlisted wiring (call, register, mount)
- `wiki/visual-effects.md` — **modified** — shipped section, authority row, Surface 1b note, the three
  D-24785 amendments (second DOM host; drop-newest; landing is follow-through), `last-reviewed`
- `docs/ai/post-mortems/01.6-WP-849-card-transfer-vfx.md` — **new** — 01.6 post-mortem

## After Completing
- [ ] `pnpm -r build` exits 0; arena-client test `fail 0` and count up by exactly 30; typecheck exits 0
- [ ] `Select-String` for `Math\.random\(|Date\.now\(|performance\.now\(` in `CardTransferLayer.vue` finds nothing
- [ ] `git diff --name-only origin/main -- '*.test.ts'` = exactly the 4 new test files
- [ ] `git diff --name-only origin/main -- packages apps/server data` is empty
- [ ] Browser preview: driven `document.getAnimations()` timeline shows the ghost travel supply → own
      discard and removal; `low` glides; `off` creates nothing
- [ ] Live-on-surface verification (D-24026) after the arena-client deploy, or flagged operator-pending in WORK_INDEX
- [ ] 01.6 post-mortem written (before the `EC-887:` commit), naming the test-id coupling and drop-newest
- [ ] ewiki deployed (`wiki-viewer.yml`); the new section checked live with the CF Access service-token curl
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24785 Active
- [ ] WORK_INDEX checked off with date; EC_INDEX row `Done`; mindmap 📝 → ✅, `pnpm roadmap:counts:write`, `roadmap:counts:check` 0
- [ ] NUMBER-LEDGER WP-849 / EC-887 / D-24785 LANDED; `pnpm ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` exit 0
- [ ] Commits: `EC-887:` implementation, then `SPEC:` governance close

## Common Failure Smells
- A flight on page load or play-again → the seed frame emitted, or the `null` reset is missing.
  (A resync that never passed through `null` may fly missed Wounds up to the cap; accepted.)
- A flight when Diving Block returns a Wound → the `supplyDrop <= 0` return is missing.
- Card lands on the discard for Random Acts → the hand rule compares the wrong deltas.
- Ghost starts at the top-left corner → the anchor rect was read after the node detached, or the
  fixed layer has a transformed ancestor; mount the layer at the `PlayViewport` root.
- Leftover ghost nodes after a storm → cleanup tied to `finished` only; also remove on cancel / unmount.
- vue-tsc can't see `UIState` fields → engine `dist` stale; run `pnpm -r build` first.
