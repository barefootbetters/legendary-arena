# EC-812 — Board affordability cues (Execution Checklist)

**Source:** docs/ai/work-packets/WP-775-board-affordability-cues.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] `pnpm -r build` exits 0 (the client typechecks against the engine `dist`)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` 0 errors; `test` exits 0 (record the baseline count)
- [ ] Confirm on `main`: HQRow has no at-rest unaffordable style; CityRow / MastermindTile turn only the Fight N badge red
      (`isFightCostUnaffordable`, PR 2413), shown only when the projected cost differs from the printed one; no fightable rim exists;
      the Mastermind fight button's class is `mastermind__fight-button`; PlayMobile's `isViewerTurn` lacks the game-over guard.
- [ ] Confirm `TurnActionBar.test.ts` locks "End Turn never carries the primary accent" (PR 2044) — leave it untouched.
- [ ] Rebase check: WP-759 / WP-770 / WP-771 may have touched HQRow / MastermindTile — keep every branch.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `CardTile.vue` optional prop `isCostUnaffordable: boolean` (default `false`) → root class `card-tile--cost-unaffordable`;
  every printed-cost element (`card-tile__cost-badge`, `card-tile__label-cost`, `card-tile__cost-text`) renders as a red pill —
  `var(--color-penalty)` fill, white text, white ring; static. Prop absent/false → markup and classes identical to today.
- HQ cue: `cell.display !== null` AND `display.cost !== null` AND `canRecruitHero()` stage gate allowed AND `canRecruit(display).allowed === false`.
- City cue: `isFightCostUnaffordable(cell)` AND NOT `hasFightCostBadge(cell)`.
- Mastermind cue: `isFightCostUnaffordable()` AND its Fight N badge not shown AND `isVictoryAssured()` false.
- Rims: `city-space__villain--fightable` (the `canFightVillain()` stage gate AND `gateForCell(cell).allowed`) and
  `mastermind__fight-button--fightable` (`gateForFight().allowed`), drawn as
  `::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 3px var(--color-par-positive); }`
  (above the tile, below the z-index-1 Fight N badge; no pointer rule).
- `PlayMobile.vue`: `isViewerTurn` returns `false` when `isGameOver.value` (parity with PlayDesktop) — the only change there;
  `PlayMobile.test.ts` adds a game-over test: a `phase: 'play'` frame with `gameOver` set (a phase-`'end'` frame hides the
  board) shows no rim, no red cost and every fight button disabled, and fails with the guard removed.
- No End Turn cue. No `UIState` field. Existing class names and test ids unchanged.

## Guardrails
- Every cue is gated to the viewer's own Main step via the button's own `useTurnActions(stage, isViewerTurn)` gate —
  the zeroed off-turn economy must never paint targets red or rimmed; no cue at game over.
- One cost rule (the button's `useCardCostGating` call); one fight predicate (the button's gate = the slash candidate set).
- The rim never uses the focus ring's property on the button, never changes the button's border / padding / margin,
  never adds a pointer-events rule to the button, the tile or the overlay.
- Tokens only; no hex literal added to CardTile / CityRow / MastermindTile; cite PRs as "PR 2413", never `#` + digits; the
  pill's white is written `white` or `rgba(255, 255, 255, …)`, never `#fff` (Step 4).
- Added lines in CityRow / MastermindTile never contain the words `outline` or `pointer-events`, even in comments (Step 5 is
  a case-insensitive text scan).
- `TurnActionBar.vue`, `useSlashGesture.ts`, the PR 2413 badge rules and the D-24574 cost sources untouched.
- Tests assert classes only (jsdom has no styles); colours, rim geometry and the hit-test rect are checked live.

## Required `// why:` Comments
- `isCostUnaffordable` in CardTile: the red goes on the number that is the real cost, so the reason reads at a glance.
- The which-number rule in CityRow / MastermindTile: the printed cost turns red only when no projected Fight N badge shows.
- The Main-step gate on each cue: the economy is zeroed for non-active viewers.
- The rim: same predicate as the Fight button and the slash stroke; its known blind spots (heal lock, defeat requirements,
  pending choices) are the button's own; drawn inset on an overlay so focus and the hit-test rect are untouched.
- The PlayMobile game-over guard: parity with PlayDesktop; defensive — on origin/main the mobile board hides at game over
  (phase leaves 'play'), but any frame that renders it with `gameOver` set must be read-only.

## Files to Produce
- `apps/arena-client/src/components/play/CardTile.vue` + `CardTile.test.ts` — **modified** — `isCostUnaffordable` prop + pill
- `apps/arena-client/src/components/play/HQRow.vue` + `HQRow.test.ts` — **modified** — HQ cost cue
- `apps/arena-client/src/components/play/CityRow.vue` + `CityRow.test.ts` — **modified** — printed-cost cue + rim
- `apps/arena-client/src/components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified** — same pair + victory-assured negative
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — + `PlayMobile.test.ts` — `isViewerTurn` game-over guard + a game-over test
- `wiki/visual-effects.md` — **modified** — affordability row shipped
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; client typecheck 0; `pnpm -r --no-bail test` 0 failures; ≥ +22 client tests recorded (Mastermind: + which-number badge vs printed, + `fightCost` undefined)
- [ ] `git diff --exit-code $(git merge-base HEAD origin/main)` on `TurnActionBar.vue` and `useSlashGesture.ts`; the slash suite green with no test edits
- [ ] Step 4: no hex literal in the added lines of the three components; Step 5: no focus-ring property and no pointer rule in the added lines (expected: no output)
- [ ] `git status --porcelain` ⊆ Files to Produce (revert line-ending-only `pnpm -r build` churn)
- [ ] Live-on-surface (D-24026): red cost pill on an unaffordable HQ hero and a printed-cost villain; inset rim on fightable targets;
      a slash across rimmed villains fights them; Tab onto a rimmed button still shows the focus ring; nothing red or rimmed on the
      bot's turn; after game over via desktop "View final board"; red on both badge and label cost; phone width checked; matchId in STATUS.md
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24612 → Active; `wiki/visual-effects.md` updated
- [ ] `WORK_INDEX.md` WP-775 checked off with date; `EC_INDEX.md` EC-812 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-775 `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- Every HQ hero red on the bot's turn → the cue skipped the stage gate (the economy is zeroed off-turn).
- Two red numbers on one villain → the printed cost ignored the Fight N badge rule.
- The keyboard focus ring vanished on a rimmed button → the rim was drawn with the focus ring's property.
- The rim cut off at the row's edge → an outer glow inside `overflow-x: auto`; keep it inset on the overlay.
- Red costs still showing on a phone once a game-over board is shown → PlayMobile's game-over guard is missing.
- Commit message: `EC-812:` for code, `SPEC:` for the governance close — never `WP-775:`.
