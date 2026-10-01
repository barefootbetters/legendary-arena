# WP-775 — Board affordability cues: a red cost when you can't afford it, and a rim where the Fight button is enabled

**Status:** Draft 2026-09-26 · **EC:** EC-812 · **Reserves:** D-24612
**Primary Layer:** App — `apps/arena-client` only (no engine, server or registry change)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (the file count exceeds the lightweight lane's four code/test files)
**Baseline:** `origin/main` @ `32fd8ba2` (2026-09-26; no arena-client code changed since `6d6953a6`).

## Goal

A player should see what they can afford without hovering.
- **HQ heroes.** The recruit gate works (the button is disabled and has a tooltip), but an
  unaffordable HQ hero's card and cost look the same as an affordable one's. Only the native
  button frame fades, and on a phone there is no tooltip at all.
- **City villains and the Mastermind.** Their "Fight N" badge turns red when you can't afford
  them (#2413), but that badge exists **only when the projected fight cost differs from the
  printed one**. So a villain at its printed cost that you can't afford gets no cue either.

This packet turns the printed cost a player reads into a red pill whenever, on their own Main
step, they can't afford that card. It also puts a quiet inset rim on each villain, and on the
Mastermind, whose Fight button is enabled right now. That is exactly the set a slash stroke
would fight.

## User-Visible Impact

- On your Main step, the printed cost of a card you can't afford becomes a red pill with white
  text and a white ring. It applies to both places the cost shows (the corner badge and the
  label), for an HQ hero you can't recruit, a City villain you can't fight at its printed cost,
  and the Mastermind likewise.
- Where the projected "Fight N" badge shows, it keeps its existing red state and the printed
  cost stays neutral (the printed number is not the real cost there).
- On your Main step, every villain and the Mastermind whose Fight button is enabled carries an
  inset green rim. With slash to fight on, the rimmed villains are exactly the ones a stroke
  will try.
- Off your Main step (another seat's turn, your start or cleanup step, or a finished game)
  nothing is red and nothing is rimmed.
- The End Turn button is **unchanged**.

## Assumes

- **WP-128 / WP-129 ✅** — `useCardCostGating(economy)` (`apps/arena-client/src/composables/useCardCostGating.ts`):
  - `canRecruit(hero)` gives "This card is not recruitable." for a null cost, or "Needs N recruit, you have M.";
  - `canFight(cost)` gives "Needs N attack, you have M.";
  - it reads only `economy.availableAttack` / `availableRecruit` / `excessiveViolenceAvailable`.

  The stage gates live in `apps/arena-client/src/composables/useTurnActions.ts`
  (`canRecruitHero()`, `canFightVillain()`, `canFightMastermind()`).
- **WP-750 / D-24574 ✅** — one cost source per fight target: City `UICityCard.fightCost`, and the
  Mastermind's `fightCost ?? display.cost`. The Fight N badge shows only when the projected cost
  differs from the printed one:
  - City: `hasFightCostBadge(cell)`;
  - Mastermind: also only when `fightCost !== undefined`.

  `display.cost` is the printed cost (`vAttack` for villains and the Mastermind).
- **#2413 (INFRA, Jeff feedback) ✅** — the Fight N badge's loud `--unaffordable` state
  (`isFightCostUnaffordable`): a raw `#b91c1c` fill, a white ring and a one-shot 700 ms pulse
  (with `animation: none` under reduced motion). No DECISIONS entry records it; D-24612 does.
- **WP-756 / D-24585 ✅, WP-761 / D-24592 ✅** — slash to fight.
  - The gesture's candidate predicate is `gateForCityIndex` (`CityRow.vue`), which is the Fight
    button's own `gateForCell(cell).allowed`.
  - The gesture hit-tests the villain **button's bounding rect** (`useSlashGesture.ts`
    `collectCandidateTiles`), so border, padding or margin changes on that button would move it.
  - `.city-spaces` is `overflow-x: auto`; the long-press "armed" cue is an inset glow for this reason.
  - D-24585 §3: the client cannot see Guard, Patrol, defeat requirements or open pending choices.
  - D-24585 §4: `pointer-events: none` on disabled tiles is forbidden.
- **`MastermindTile.vue`** — `gateForFight()` (stage → cost → the `tacticsRemaining === 0`
  lock unless `finalBlowPending`); `isVictoryAssured()`; the fight button's class is
  `mastermind__fight-button`.
- **`CardTile.vue`** — with `showCost`, the printed cost shows in two places in image mode: the
  corner `card-tile__cost-badge` and the label's `card-tile__label-cost`. Fallback mode shows
  `card-tile__cost-text`. All three rows pass `show-label="true"`.
- **Tokens / focus** — `apps/arena-client/src/styles/base.css` defines `--color-penalty`
  (→ `--la-color-error`) and `--color-par-positive` (→ `--la-color-success`). It draws keyboard
  focus as a `:focus-visible` **outline**, which a later, more specific `outline` rule would override.
- **The economy is redacted to zeros** for every viewer except the active player
  (`REDACTED_ECONOMY`, `packages/game-engine/src/ui/uiState.filter.ts`). So every cue must be
  gated to the viewer's own Main step, as `isFightCostUnaffordable` already is.
- **PlayMobile's `isViewerTurn`** lacks the `isGameOver` guard that PlayDesktop's has
  (`pages/PlayMobile.vue` ~L268 vs `pages/PlayDesktop.vue` ~L471). On `origin/main`, the mobile
  board (`<main v-if="isPlayPhase && viewer !== null">`) and the TurnActionBar footer
  (`v-if="isPlayPhase"`) are not rendered at a real game-over frame (phase `'end'` / `'unknown'`,
  as in the `endgame-*` fixtures). So the guard is defensive parity for any frame that renders the
  board with `gameOver` set, including Jeff's in-flight mobile endgame-board work.
- `pnpm -r build` exits 0 and the arena-client suite is green on `origin/main`.

## Context (Read First)

**Read these first (AUTHORITATIVE for the surfaces this packet touches):**
- `.claude/rules/architecture.md` §Engine Owns Truth (the client never re-derives a cost or rule).
- `docs/ai/DECISIONS.md`:
  - D-24574 (fight-cost source);
  - D-24585 §1/§3/§4 and D-24592 (slash to fight);
  - D-24180 (the heal lock);
  - D-2504 (Guard / Patrol unset).
- EC-132 §3 (disabled-state tooltip precedence).
- The shipped `useCardCostGating.ts`, `useTurnActions.ts`, `CardTile.vue`, `HQRow.vue`,
  `CityRow.vue`, `MastermindTile.vue`, and the `base.css` tokens.

**Why the cue goes on the printed cost, not a dimmed card.** The hand grey-out was dropped
(playing from hand is free). The HQ and fights do cost something, and dimming the whole card
would also hide its art and name. Turning the number into a red pill says "this is the reason",
in the spirit of #2413's Fight N badge. It uses the `--color-penalty` token rather than
#2413's raw hex, so the two reds may differ slightly by theme; that is accepted. Colour is not
the only signal: the pill has a white ring, and the button stays disabled.

**Which number turns red.** The one showing the true cost. When a target has a projected Fight
N badge (its cost was modified), that badge already turns red and the printed cost stays
neutral. When there is no Fight N badge, the printed cost *is* the true cost, and it turns red.

**What the rim means — and its known false positives.** The rim marks "your Fight button is
enabled", which is the same predicate as the button and the slash stroke. It does not promise
the engine will accept the fight. The button has the same blind spots today:
- **after a Heal:** the heal lock (D-24180) is not applied to the board rows;
- **defeat requirements** and **open pending choices** are not projected (D-24585 §3);
- **a haunting Mastermind** (once one exists).

The rim adds no false positive the button does not already have. Fixing the button gates is a
separate, named follow-up.

**Why there is no End Turn cue.** It is recorded in D-24612 for two reasons.
1. #2044 (Jeff feedback, 2026-09-13) removed the End Turn accent so that "the active Step box is
   the only guide". `TurnActionBar.test.ts` locks that End Turn never carries the primary accent.
2. The client cannot honestly compute "no affordable action remains". `dodgeCard` and
   `exorciseHauntedHero` have no client surface. The heal lock and haunting are not applied to
   the board rows. Defeat requirements, several pending choices and discard-to-play costs are not
   projected. A recruit-as-attack conversion counts the same points twice. A "you're done" cue
   that is sometimes wrong is worse than none.

**Shared files with other open drafts.**
- WP-759 (haunt client) rewrites HQRow gating and adds a haunting lock to MastermindTile.
- WP-770 and WP-771 edit MastermindTile.
- WP-774 and WP-776 edit `wiki/visual-effects.md`.

The Mastermind rim reads `gateForFight().allowed`, so any lock those packets add to that gate
composes with it. Rebase and keep every branch.

**What unit tests can and cannot prove.** `vue-sfc-loader` strips `<style>`, the tests run in
jsdom, and the slash tests stub `getBoundingClientRect`. So tests assert **classes**. The
colours, the rim geometry and the unchanged hit-test rect are checked in review and in the
live verify, not by the suite.

## Non-Negotiable Constraints

**App-wide (do not remove):**
- ESM only, Node v22+. Tests use `node:test` + `@vue/test-utils`, with `.test.ts`.
- Presentation only: the client reads projected `UIState`. It never re-derives a cost
  (D-24574 §1) and never evaluates a rule.
- No new npm dependency. No motion is added.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- Human-style code per `00.6-code-style.md`: JSDoc on every function, boolean names start with
  `is` / `has` / `can`, `// why:` on non-obvious rules.
- SFC authoring per D-6512.

**Packet-specific:**
- Every new cue is gated to **the viewer's own Main step** through the button's own
  `useTurnActions(currentStage, isViewerTurn)` stage gate. It never shows on another seat's
  turn, off the Main step, or at game over.
- The cost comparison uses the **same** `useCardCostGating` call the button uses. There is no
  second cost rule.
- The rim uses the **same** predicate as the button: `gateForCell(cell).allowed` for a City
  space, `gateForFight().allowed` for the Mastermind.
- **The rim is an inset `box-shadow` on a `::after` overlay:**
  `content: ''; position: absolute; inset: 0; border-radius: inherit;`. It sits above the tile,
  below the z-index-1 Fight N badge. A click on a pseudo-element already targets the button, so
  no pointer rule is needed.
  - Never the focus ring's property (it would override the `:focus-visible` ring).
  - Never a change to the button's `border`, `padding` or `margin` (each would move the slash
    hit-test rect).
  - Never a pointer-events rule on the button, the tile or the overlay.
- New colours use tokens (`var(--color-penalty)`, `var(--color-par-positive)`); no hex literal is
  added to the three components. PRs are cited in comments as "PR 2413", never `#` + digits (the
  Step 4 scan).
- `TurnActionBar.vue`, the End Turn button, `useSlashGesture.ts`, the #2413 `--unaffordable`
  badge rules and the D-24574 cost sources are unchanged.

**Session protocol:** if a target's cost source or gate disagrees with this WP, STOP and ask.
Never add a cost term on the client.

## Locked Contract Values

- `CardTile.vue` gains one optional prop, `isCostUnaffordable: boolean` (default `false`).
  - When true, the root gains the class `card-tile--cost-unaffordable`.
  - Every printed-cost element (`card-tile__cost-badge`, `card-tile__label-cost`,
    `card-tile__cost-text`) then renders as a red pill: a `var(--color-penalty)` fill, white
    text, and a white ring. It is static, with no animation.
  - With the prop absent or false, the tile's markup and classes are identical to today.
- **HQ** (`HQRow.vue`) — a hero cell is cost-unaffordable when all of these hold:
  - `cell.display !== null`;
  - `display.cost !== null`;
  - the `canRecruitHero()` stage gate is allowed;
  - `canRecruit(display).allowed === false`.

  It is passed as `:is-cost-unaffordable`.
- **City** (`CityRow.vue`) — the printed cost is cost-unaffordable when
  `isFightCostUnaffordable(cell)` is true **and** `hasFightCostBadge(cell)` is false.
- **Mastermind** (`MastermindTile.vue`) — the printed cost is cost-unaffordable when
  `isFightCostUnaffordable()` is true, **and** its Fight N badge is not shown, **and**
  `isVictoryAssured()` is false. So no red shows under the "victory assured" banner.
- **Rims:**
  - City: the villain button gains `city-space__villain--fightable` when the `canFightVillain()`
    stage gate and `gateForCell(cell).allowed` both pass.
  - Mastermind: the fight button gains `mastermind__fight-button--fightable` when
    `gateForFight().allowed` is true.
  - Both are drawn per the rim constraint above:
    `::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 3px var(--color-par-positive); }`.
- **`PlayMobile.vue`** — `isViewerTurn` returns `false` when `isGameOver.value` is true (parity
  with PlayDesktop). This is the only change there.
- Existing class names and test ids are unchanged. No `UIState` field is added.

## Scope (In)

### A) `CardTile.vue` + `CardTile.test.ts`
- The prop and class. Tests:
  - The root class is present when the prop is true.
  - It is absent when the prop is false or absent.
  - The existing class set is unchanged otherwise.

### B) HQ — `HQRow.vue` + `HQRow.test.ts`
- Test the root class for each case:
  - unaffordable in Main → present;
  - affordable → absent;
  - another seat's turn (zeroed economy) → absent;
  - start step → absent;
  - a `null`-cost hero → absent;
  - a `display === null` cell → absent.

### C) City — `CityRow.vue` + `CityRow.test.ts`
- Tests:
  - A printed-cost villain you can't afford in Main has the CardTile class.
  - A projected-cost villain you can't afford: the Fight N badge is red (unchanged) and the
    CardTile class is absent.
  - An affordable villain has `city-space__villain--fightable`.
  - An unaffordable villain has no rim.
  - On another seat's turn there is no rim and no red.
  - The existing slash suite is green with no edits (a regression guard for the gates; the rect
    itself is verified live).

### D) Mastermind — `MastermindTile.vue` + `MastermindTile.test.ts`
- The same pair of cues and the same off-turn / start-step negatives. Plus:
  - no red and no rim while `isVictoryAssured()`;
  - the rim is present under a pending Final Blow when affordable;
  - `fightCost` differs from printed and is unaffordable → `mastermind__fight-cost--unaffordable`
    is present and the CardTile's `card-tile--cost-unaffordable` is absent;
  - `fightCost` undefined and unaffordable → the CardTile class is present.

### E) Game-over parity — `PlayMobile.vue` + `PlayMobile.test.ts`
- `isViewerTurn` is false at game over.
- Test (mandatory):
  - Mount PlayMobile with `game.phase = 'play'`, `gameOver` set, the viewer as the active seat on
    `main`, one unaffordable printed-cost villain and one affordable villain.
  - Assert there is no `city-space__villain--fightable` and no `card-tile--cost-unaffordable`, and
    that every `play-city-villain` button is `disabled`.
  - The test must fail with the guard removed; state in the PR that this was checked.
  - A phase-`'end'` frame hides the board and cannot exercise the guard.
- Jeff's in-flight endgame read-only-board work also touches `PlayMobile.vue`. Expect a rebase,
  and keep one guard.

## Out of Scope

- **Any End Turn cue** (see Context; recorded in D-24612).
- Applying the heal lock, haunting or defeat requirements to the board buttons. That is a
  named follow-up: the rim mirrors the buttons and inherits their gaps.
- Dimming whole cards, or a hand grey-out (dropped; playing from hand is free).
- The HQ tooltip nesting: CardTile's `title` (the card name) sits inside the disabled button
  whose `title` is the reason, and likely masks the reason on hover. It needs a browser check;
  named follow-up.
- The S.H.I.E.L.D. Officer button (it already dims when disabled; its "Recruit: 3" does not turn
  red — accepted, recorded in D-24612) and the Sidekick stack (no recruit move exists).
- The superpower rim on hand cards (WP-776), the turn banner (WP-774), bot pacing (WP-773).
- Any `UIState`, engine, server or registry change.

## Files Expected to Change

App (`apps/arena-client/src/`):
- `components/play/CardTile.vue` + `CardTile.test.ts` — **modified** — `isCostUnaffordable` prop + red pill
- `components/play/HQRow.vue` + `HQRow.test.ts` — **modified** — HQ cost cue
- `components/play/CityRow.vue` + `CityRow.test.ts` — **modified** — printed-cost cue + fightable rim
- `components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified** — printed-cost cue + rim
- `pages/PlayMobile.vue` + `PlayMobile.test.ts` — **modified** — `isViewerTurn` game-over parity + a game-over test

Docs: `wiki/visual-effects.md` (the at-a-glance affordability row: shipped).

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24612 → Active),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- `CardTile`'s optional `isCostUnaffordable` prop and the `card-tile--cost-unaffordable` class.
- The two rim classes (`city-space__villain--fightable`, `mastermind__fight-button--fightable`)
  and their gates.
- PlayMobile's `isViewerTurn` is false at game over.
- No change to any other class, test id, gate, cost source or move.

## Acceptance Criteria

1. On the viewer's Main step, every HQ hero, City villain and Mastermind they cannot afford
   has exactly one source turn red: the Fight N badge when that badge is shown, or else the
   printed cost (every place it appears on the tile).
2. On the viewer's Main step, every villain and the Mastermind whose Fight button is enabled
   carries the rim. With slash to fight on, the rimmed City villains equal the gesture's
   candidate set.
3. There are no red cues and no rims in any of these states:
   - another seat's turn;
   - the start or cleanup step;
   - game over (on both layouts);
   - on the Mastermind tile while its victory is assured: no printed-cost pill and no rim (the PR
     2413 Fight N badge keeps its existing behaviour, and City and HQ cues still apply).
4. The keyboard focus ring still shows on a rimmed, focused button, and the slash hit-test rect
   is unchanged. Both are checked in review and the live verify; the slash suite is green with
   no edits.
5. `TurnActionBar` and the End Turn button are unchanged.
6. A tile with `isCostUnaffordable` absent or false renders exactly as before.

## Verification Steps

```pwsh
# Step 1 — build (the client typechecks against the engine dist)
pnpm -r build
# Expected: exits 0

# Step 2 — typecheck + client suite (record before/after counts)
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: typecheck 0 errors; 0 failures; at least +22 tests (A 3, B 6, C 5, D 7, E 1)

# Step 3 — TurnActionBar and the gesture are untouched
git diff --exit-code $(git merge-base HEAD origin/main) -- apps/arena-client/src/components/play/TurnActionBar.vue apps/arena-client/src/composables/useSlashGesture.ts
# Expected: exits 0

# Step 4 — no hex literal added to the three components
git diff -U0 $(git merge-base HEAD origin/main) -- apps/arena-client/src/components/play/CardTile.vue apps/arena-client/src/components/play/CityRow.vue apps/arena-client/src/components/play/MastermindTile.vue | Select-String -Pattern "^\+.*#[0-9a-fA-F]{3,8}\b"
# Expected: no output

# Step 5 — the rim adds neither the focus ring's property nor a pointer rule
git diff -U0 $(git merge-base HEAD origin/main) -- apps/arena-client/src/components/play/CityRow.vue apps/arena-client/src/components/play/MastermindTile.vue | Select-String -Pattern "^\+.*(outline|pointer-events)"
# Expected: no output

# Step 6 — whole repo
pnpm -r --no-bail test
# Expected: 0 failures

# Step 7 — scope
git status --porcelain
# Expected: only the Files Expected to Change (plus governance); revert line-ending-only build churn.
```

## Definition of Done

- [ ] All acceptance criteria pass; arena-client counts recorded; typecheck 0.
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** on play.legendary-arena.com, on your Main step:
  - an HQ hero you can't afford shows a red cost pill;
  - a villain at its printed cost that you can't afford shows a red cost pill;
  - the fightable villains carry the inset rim;
  - a slash across rimmed villains fights them;
  - Tab onto a rimmed button: the focus ring still shows;
  - the red shows on both the corner cost badge and the label cost;
  - on the bot's turn nothing is red or rimmed; after the game ends, check via desktop "View final
    board" (the phone board is not shown at game over).

  Check a phone-width layout too. Record the matchId in `docs/ai/STATUS.md`. A merged PR alone
  is not done.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24612 flipped to Active.
- [ ] `wiki/visual-effects.md` affordability row updated (shipped).
- [ ] `WORK_INDEX.md` WP-775 checked off with date; `EC_INDEX.md` EC-812 → Done;
      `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §3 Player Trust & Fairness: why an action is unavailable is visible, not only in a tooltip.
  - §17 Accessibility: a phone has no hover. The cue is on the number with a white ring, the
    button stays disabled, and the focus ring is preserved.
  - §4: the table stays readable.
- **Conflict assertion:** No conflict. It shows the gate the client already enforces, makes no
  decision for the player, and documents the button's own blind spots rather than hiding them.
  NG-1..NG-8 untouched.
- **Determinism preservation:** client presentation only; no `UIState`, engine or replay change.

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1 structure:** every required section is present; the baseline SHA is cited.
- **§2 constraints:** app-wide (ESM, Node v22+, full file contents, no new dependency, D-6512),
  packet-specific (the Main-step gate, one cost rule, the rim construction), session protocol,
  locked values.
- **§3 Assumes:** WP-128/129 + `useTurnActions.ts`, WP-750 / D-24574, #2413, WP-756/761 /
  D-24585 / D-24592, the MastermindTile gates, the CardTile cost elements, the tokens and focus
  rule, the redacted economy, and the PlayMobile guard gap.
- **§4 Context:** an AUTHORITATIVE read-first list, the rationale, the documented false
  positives, the End Turn reasons, the shared files and the test limits.
- **§5 files / §7 deps:** a closed allowlist with one-line purposes (4 components + 4 tests + PlayMobile
  + `PlayMobile.test.ts` (mandatory game-over test) + 1 wiki + governance). No new npm dependency.
- **§6 naming:** `isCostUnaffordable` (boolean `is` prefix), `card-tile--cost-unaffordable`,
  `city-space__villain--fightable`, `mastermind__fight-button--fightable` (BEM modifiers on real
  elements). Existing names reused verbatim.
- **§8 layer boundary:** arena-client only; no engine runtime import added.
- **§9 Windows:** `pwsh` verification (`git diff`, `Select-String`).
- **§10 env:** N/A — no environment variable is read or added.
- **§11 auth:** N/A — no auth or session surface is touched.
- **§12 tests:** `node:test` + `@vue/test-utils`. Class assertions for every positive and
  negative case (including the zeroed off-turn economy, a null display, victory assured and game
  over). Stated limits: CSS is not observable in jsdom.
- **§13 verification:** exact commands with expected output (a locked test floor, diffs against
  `origin/main`).
- **§14 AC / §15 DoD:** binary ACs. The DoD carries STATUS, DECISIONS, the wiki, WORK_INDEX and
  the D-24026 live verify (including focus and phone width).
- **§16 code style:** `// why:` on the which-number rule, the Main-step gate, the rim
  construction and the mobile game-over guard; boolean prefixes; no `.reduce()`.
- **§17 Vision Alignment:** present.
- **§18 prose-vs-grep:** Step 4 scans the added lines of three components for a hex literal, so
  comments cite "PR 2413", never `#` + digits. Step 5 expects no `outline` and no pointer rule in the added lines, so comments describe
  it as "the focus ring's property", never the bare word.
- **§19 bridge:** N/A — commit-time rule; baseline `32fd8ba2` recorded.
- **§20 Funding Surface:** N/A — in-match cost and rim cues only; no funding UI, copy or channel.
- **§21 API Catalog:** N/A — arena-client only; no HTTP endpoint and no `apps/server/src/**` surface.

## Gate Verdicts

Drafted 2026-09-26 on base `32fd8ba2`. Each gate ran as an independent subagent.

- **01.4 pre-flight:** READY TO EXECUTE, after one fix round:
  - the outline rim became an inset `::after` overlay, so it keeps the focus ring and hit-test rect;
  - the End Turn cue was dropped (PR 2044 locks End Turn off the primary accent);
  - the PlayMobile game-over guard was added.
- **01.7 copilot:** CONFIRM, after the EC-812 PlayMobile `// why:` comment fix.
- **00.3 lint:** PASS.
- **01.5 runtime wiring:** not invoked; no new wiring.
