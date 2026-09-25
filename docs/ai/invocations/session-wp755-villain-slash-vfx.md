# Session Prompt — WP-755 / EC-792: Villain slash VFX (a Fruit Ninja-style defeat beat on the VfxOverlay)

**WP:** docs/ai/work-packets/WP-755-villain-slash-vfx.md
**EC:** docs/ai/execution-checklists/EC-792-villain-slash-vfx.checklist.md (authoritative)
**Reserves:** D-24584, which lands Active at govern-close. **Status:** READY TO EXECUTE (pre-flight READY r3, copilot PASS r3, lint PASS r2 — recorded in the WP §Gate Record and §Lint Gate Self-Review).

> Committed via `git add -f` (session-*.md is gitignored), so the prompt survives worktree removal. It is the production version of the operator-approved "Villain Slash Lab" prototype (2026-09-25).

## Invocation intent

Make a villain or henchman defeat feel like one. On every `fightResolved` notable event, the defeated City space plays four things:
- a slash streak;
- the card's own art splitting along the cut into two tumbling halves;
- a villain-purple droplet spray;
- (at full intensity) fading stains.

Same-player defeats within 4 s raise a takedown word: DOUBLE, then TRIPLE, then RAMPAGE.

The work is **client-only**. It rides the already-public `UIState.notableEvents` and makes zero engine, registry or server change. It adds no new notable-event type and touches no SFX or chip labels.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` and `.claude/rules/architecture.md`: layer boundaries; the arena-client imports engine **types** only.
3. `.claude/rules/code-style.md` and `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §client-app `:294-330`. The D-24365 VFX subsurface is `src/vfx/**` + `VfxOverlay.vue` only, and does **not** include `src/composables/`.
4. WP-755 (the design), then EC-792 (the execution contract). EC Locked Values are verbatim from WP §Locked Values, and the WP wins on conflict.
5. Source anchors:
   - `apps/arena-client/src/composables/useExcessiveViolenceVfx.ts` + test: the producer template.
   - `apps/arena-client/src/components/play/VfxOverlay.vue` + test: the WP-746 beat; `buildBurstOptions`; the `slash*` identifiers you must NOT touch.
   - `apps/arena-client/src/vfx/effectIntensity.ts`.
   - `apps/arena-client/src/components/play/CityRow.vue` and `CardTile.vue`: the selectors.
   - `apps/arena-client/src/pages/PlayViewport.vue:233` + test: the mount anchor.
   - `packages/game-engine/src/events/notableEvents.types.ts` (`FightResolvedEvent`).
6. User memory:
   - `reference_confetti_options_unobservable_in_jsdom`
   - `reference_injected_seam_hides_missing_wiring`
   - `project_design_system_feel_layer`
   - `feedback_verify_cross_surface_link_landing`
   - `reference_play_fixture_dev_route`

## Pre-execution checks

- The worktree is off fresh `origin/main`, and the WP-755 draft PR is merged.
- `pnpm install` if the worktree is fresh, then `pnpm -r build`.
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- Record the arena-client test count (the WP-754 row last recorded 1961/0).

## Execution rules (these operationalize WP-755 + EC-792 and add no new scope)

- **Producer** (`useVillainSlashVfx.ts`):
  - It uses a D-20104 cursor that catches up on the first valid frame and replays nothing.
  - For each new `fightResolved` it emits `{ seq, citySpace, playerId, imageUrl }`.
  - `imageUrl` comes from the **prior** frame's `extId → imageUrl` city cache. That cache is refreshed on every non-null frame (catch-up included), after the frame's events are processed. It is `null` on a miss, an empty URL, or a missing `city`.
  - **It reads no clock and no randomness.**
- **Streak:**
  - The pure `nextTakedownStreak` and `takedownWordForStreak` live in `vfx/villainSlashVfxManifest.ts`.
  - The ONE `performance.now()` read is in `VfxOverlay.vue` (D-24365-exempt; add a `// why:`).
- **Geometry** (`vfx/villainSlashGeometry.ts`, all pure and exported): `splitCardAlongCut`, `toClipPathPolygon`, `polygonCentroid`, `buildHalfKeyframes`, `resolveCardBox`, `buildStainOffsets`.
- **Angles:**
  - `[-28, 22, -16, 34]` by `seq % 4`, in screen convention.
  - The confetti `angle` is `-angleDeg`.
- **Overlay** (the eighth beat, in WP §D order):
  1. Update the streak.
  2. Show the word — only when the slot is empty or already holds a takedown word; never overwrite another beat's word.
  3. Gate on `'particles'`.
  4. Resolve the card box. It is centred on the space, sized from the inner `card-tile` reference, with a 5:7 fallback.
  5. Append **imperative DOM nodes** into `play-vfx-slice-layer`: the halves (`element.animate` when present) and the streak. Fire the spray through `buildSliceSprayOptions`.
  6. Under `'shake'`, add the tumble, the stains, the full count, and the impact on streak ≥ 3.
  7. Remove nodes with `setTimeout`. Cap the halves at 10. `onUnmounted` cleans up.
- **Styling:** scoped CSS does not reach imperative nodes. Use inline styles, or `:deep()` under `.vfx-overlay__slice-layer`. The reduced-motion backstop is `display: none` on the layer.
- **Naming:** every identifier declared in `VfxOverlay.vue` uses the `slice` stem. WP-746's `slash*` names (`:126, 251-252, 270, 493, 679-684`) stay untouched.
- **Mount:** `useVillainSlashVfx(audioSnapshot)` goes in `PlayViewport.vue` immediately after `useExcessiveViolenceVfx(audioSnapshot)`, with a `// why:`.
- **Tests** (WP §G, locked harness):
  - Mock only `setTimeout` with `mock.timers`, and stub `performance.now` with `mock.method`.
  - The fake City element and `card-tile` use a stubbed `getBoundingClientRect` and are removed in `afterEach`. Reset the signal in `beforeEach`.
  - The `PlayViewport` test runs: reset signal → seed → mount → snapshot 2 → `nextTick` → assert `citySpace` → unmount.
  - Never assert rendered confetti or a running animation.
- **Forbidden:** any `packages/**` edit, and any edit to `sfxManifest`, `CHIP_LABELS` or `02-CODE-CATEGORIES.md`.

## SAFE-KNOBS scope

N/A: no knob surface.

## Session task

Execute WP-755 per EC-792: the manifest, geometry, producer, overlay beat, mount, and all tests, then the ewiki entry (`wiki/visual-effects.md` + `ewiki/visual-effects/villain-slash.{py,svg}`).

1. **Verify:** `pnpm --filter @legendary-arena/arena-client typecheck && test`, then `pnpm -r build && pnpm -r --no-bail test`.
2. **Drive the preview** (per the verification workflow):
   - defeat a villain at full, low and off intensity;
   - confirm the split is card-shaped and centred;
   - confirm DOUBLE → TRIPLE when clicking fast;
   - screenshot the proof.
3. **Commit** with the two-commit topology:
   - `EC-792:` for the implementation;
   - `SPEC:` for the govern-close. The close lands D-24584 Active, checks the WORK_INDEX box `[x]`, sets EC_INDEX to Done, sets the mindmap node to ✅, runs `roadmap:counts:write`, and adds a STATUS.md dated `### WP-755 (YYYY-MM-DD)` heading. `ledger:numbers:check` and `roadmap:counts:check` must both be green.
4. **Open one PR.**

**D-24026:** the live check is operator-manual — defeat a villain on play.legendary-arena.com and watch the slash. Record it; do not claim it until it is confirmed.

## Post-merge close ritual (REQUIRED)

After the operator merges:
1. `node scripts/prune-empty-claude-branch.mjs --verify-current` — expect `VERIFY PASS`. A FAIL stops the ritual.
2. `git branch -D <branch>` and `git push origin --delete <branch>`.
3. `node scripts/prune-empty-claude-branch.mjs --report` from canonical — expect silent.

## Scope restriction

This prompt restates and operationalizes WP-755 + EC-792 only. It adds no new scope, files, contract, locked values or forbidden patterns.
