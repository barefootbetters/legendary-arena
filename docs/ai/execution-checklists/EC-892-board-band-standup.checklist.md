# EC-892 — Band stand-up: Mastermind, Officers and Sidekicks straighten on hover (Execution Checklist)

**Source:** docs/ai/work-packets/WP-854-board-band-standup.md
**Layer:** Arena Client (presentation only)
**Status:** Draft

## Before Starting
- [ ] WP-852, WP-648, WP-842, WP-830, WP-689 complete in WORK_INDEX; D-24790 reserved in NUMBER-LEDGER; if WP-759, WP-771 or WP-840 landed: rebase, re-check that nothing on the chain sets `overflow` / `opacity` / `filter`, re-run `test:visual`
- [ ] `PlayDesktop.vue`: plane `--lift` class from `isBoardLiftEnabled`; band holds the mastermind zone (`MastermindTile`) and `SharedDecks` as a direct child; WP-852 `:has()` 3D + `pointer-events` rules present
- [ ] `MastermindTile.vue`: `button.mastermind__fight-button > span.mastermind__card-frame`; picker `v-if="enigmaGuessFight !== null && enigmaCode !== undefined"`
- [ ] `SharedDecks.vue`: `ol.shared-decks__row > li.shared-decks__cell > button.shared-decks__recruit` for Officers and Sidekicks
- [ ] Guard: `measureRestingHits()` fixed selector; `readSlideTargets` / `installClickRecorder` read `data-card-id` only
- [ ] PR #3094 merged (record its merge commit); `wiki/visual-effects.md` has the `#band-standup` section. Not merged → do not start
- [ ] `pnpm -r build` exits 0; arena-client `test` exits 0 (record the count); `typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client exec playwright install chromium`; `test:visual` passes on the baseline
- [ ] Scope lock: only Files to Produce (plus the governance close) change; anything else is a blocker

## Locked Values (do not re-derive)
- Prop `isTiltLiftEnabled: Boolean`, default `false`, on `MastermindTile` and `SharedDecks`; `PlayDesktop` passes `isBoardLiftEnabled`
- Root classes: `mastermind-tile--tilt-lift` = prop; `mastermind-tile--guessing` = `enigmaGuessFight !== null && enigmaCode !== undefined`;
  `shared-decks--tilt-lift` = prop
- Lift (under `@media (hover: hover)` and the `--tilt-lift` class): `transform: rotateX(calc(-1 * var(--board-tilt-angle))) scale(1.06)`,
  `box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45)`, `transform-origin: 50% 100%`, `transition: transform 0.15s ease-out, box-shadow 0.15s ease-out`; NO `translateY`
- Mastermind: hover `.mastermind__fight-button`, lift `.mastermind__card-frame`, `:not(.mastermind-tile--guessing)`;
  3D chain root → button → frame, only under `:has(.mastermind__fight-button:hover)`
- Piles: hover `.shared-decks__cell`, lift its `> .shared-decks__recruit`; 3D chain root → row → cell → button, only under
  `:has(.shared-decks__cell:hover > .shared-decks__recruit)`
- Inner `.card-tile--interactive:hover { transform: none }` inside the frame and the recruit button
- `PlayDesktop` (appended, WP-852 rules untouched): under `--lift:has(<band-hover>)`, `preserve-3d` on plane, band, mastermind zone;
  plane `pointer-events: none`, `> * { pointer-events: auto }`. `<band-hover>` = `.mastermind-tile--tilt-lift:not(.mastermind-tile--guessing)
  .mastermind__fight-button:hover, .shared-decks--tilt-lift .shared-decks__cell:hover > .shared-decks__recruit`
- Guard: `measureRestingHits(selector)` (existing call, same selector); band call → `isBandRestingHitIntact`; `hoverAndMeasure` over a literal list
  `.mastermind__card-frame` / `play-recruit-officer` / `play-recruit-sidekick` as `'Mastermind'` / `'Officers'` / `'Sidekicks'`, logged raw (`<label> <name> hover:`);
  `isBandLiftClearOfHud` (found cards only; `readHudBottom()` `null` = not clear; `liftedTop >= hud bottom - 1`; one boolean, one failure
  per card); `slideAndClick` Officers ↔ Sidekicks → `isBandSlideClickIntact`; resting-hit `cardId`, slide targets and click recorder read
  `data-card-id ?? data-testid`; band resting log remaps to `isBandRestingHitIntact`; `isBandGuessingFlat` (last band step: add `--guessing`, hover,
  expect no lift, remove in `finally`). Band steps in `checkBandStandUp` → `checkBandSlideAndGuessing` (one call in `run()`). Messages per WP §Contract
- Test deltas: MastermindTile +3, SharedDecks +2, PlayDesktop +2 = **+7**
- Commit: `EC-892: band stand-up - the Mastermind, Officers and Sidekicks straighten toward the player on hover (WP-854)`

## Guardrails
- Arena Client + two ewiki pages only; nothing under `packages/`, `apps/server/`, `data/` changes.
- Presentation only: no new `UIState` read, store write, move or click-handler change.
- Do not edit the WP-852 rules, `CityRow.vue`, `HQRow.vue`, `useBoardTilt.ts` or `useRowFit.ts`.
- Never nest `:has()`: the Enigma exclusion is the `mastermind-tile--guessing` class, never `:has(.mastermind-tile__enigma-guess)`.
- With the prop false (every `PlayMobile` use) the roots' class lists are unchanged, except `--guessing` while the picker is open.
- Animated / 3D properties limited to `transform` / `box-shadow`; no JS animation, clock, randomness or dependency.
- Append new test cases in a new `describe` per file; never edit, skip or remove one. New imports on new lines; any
  `setIntensity` call restores `'full'` in `finally`.

## Required `// why:` Comments
- `MastermindTile.vue`: lift the frame, not the button (the status lines stay down; the button is the still hover target);
  `--guessing` (depth order beats `z-index`; `:has()` cannot nest in the plane rule); the inner `transform: none`.
- `SharedDecks.vue`: hover on the cell, transform on the button (no flicker); bottom-edge origin; the inner `transform: none`.
- `PlayDesktop.vue`: the band chain switches on only while hovered and the plane leaves hit testing (EC-890 Amendment A).
- `play-surface.visual.mjs`: the `data-testid` fallback (band buttons carry no `data-card-id`); the band hover calls rely on enabled
  recruit buttons (`measureHover` needs opacity 1); `isBandGuessingFlat` pins the selector the unit test cannot.

## Files to Produce
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — prop, two root classes, CSS
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified** — +3 (no prop; prop; `--guessing` + picker present after Fight)
- `apps/arena-client/src/components/play/SharedDecks.vue` — **modified** — prop, root class, CSS
- `apps/arena-client/src/components/play/SharedDecks.test.ts` — **modified** — +2 (no prop; prop)
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — two bindings, appended plane CSS
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — +2 (classes at full; absent at off)
- `apps/arena-client/visual/play-surface.visual.mjs` — **modified** — band resting hits, hover ×3, clearance, slide-and-click
- `wiki/visual-effects.md`, `wiki/testing.md` — **modified** — `#band-standup` shipped, guard checks, `last-reviewed`
- Governance close (`SPEC:`): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24790), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`

## After Completing
- [ ] `pnpm -r build` exits 0; arena-client `test` `fail 0` and count up by exactly 7; `typecheck` exits 0
- [ ] `test:visual` PASSED at 1280×720 / 1366×768 / 1920×1080 with the band checks and every existing check
- [ ] Against `$base = git merge-base origin/main HEAD`: `git diff --numstat $base -- '*.test.ts'` deletions 0 on every row;
      `git diff -U0 $base` on the three test files: every hunk old-start ≤ last import line or = pre-execution line count;
      `--name-only $base -- packages apps/server data` empty; CityRow / HQRow / composables unchanged
- [ ] Browser preview screenshot: Mastermind, Officers, Sidekicks each stand up; Off: none lifts
- [ ] ewiki deployed (`wiki-viewer.yml`); `#band-standup` checked live with the CF Access service-token curl
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24790 Active
- [ ] WORK_INDEX checked off with date; EC_INDEX `Done`; mindmap 📝 → ✅, `pnpm roadmap:counts:write`, `roadmap:counts:check` 0
- [ ] NUMBER-LEDGER WP-854 / EC-892 / D-24790 LANDED; `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` exit 0
- [ ] Live-on-surface verification (D-24026) after the arena-client deploy, or flagged operator-pending in WORK_INDEX
- [ ] Commits: `EC-892:` implementation, then `SPEC:` governance close

## Common Failure Smells
- Card rises but stays tilted (×1.03, not ×1.22) → a `preserve-3d` link is missing, or a nested `:has()` voided the selector list.
- Clicks on a resting band card go nowhere → the 3D chain is on at rest; it must be gated on the hover `:has()`.
- A click right after sliding from Officers to Sidekicks misses → the plane `pointer-events` rules are missing.
- "Tactics remaining" rises with the Mastermind → the transform is on the button, not the frame.
- Card flickers at its edge → the hover selector is on the lifted element instead of its holder.
- Enigma picker hidden behind the Mastermind → `--guessing` missing or not matching the picker's `v-if`.
- Band slide check passes with nothing recorded → the `data-testid` fallback is missing.
- vue-tsc can't see engine types → stale `dist`; run `pnpm -r build` first.
