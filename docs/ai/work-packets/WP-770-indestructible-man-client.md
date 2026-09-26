# WP-770 — Indestructible Man client: Elite Assassin chooser + shuffle-fight (Arena Client)

**Status:** Draft 2026-09-26 — **BLOCKED on WP-768** (projects `UIMastermindState.shuffleFight` and accepts `fightMastermind({ shuffleAssassinIds })`)
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:**
- **WP-768 / D-24601**
- WP-750 / D-24574 (MastermindTile gates on the projected `fightCost`)
- WP-738 / D-24561 (the EV fight button)
- WP-129 / EC-132

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session).
**Arc:** 2 of 2 for Indestructible Man. Runs after WP-768.

> Baseline: `origin/main` at `b7efb34a` + #2412. At execution, re-baseline on WP-768's merge.

---

## Goal

When the Mastermind is Indestructible Man (`snapshot.mastermind.shuffleFight` is present), `MastermindTile` replaces its Fight / Fight-with-EV buttons with one **"Shuffle 2 Elite Assassins → Fight"** button. Clicking it opens an in-flow chooser listing the active player's eligible Assassins (art and name from the projected `display`). The player selects exactly **two** and confirms. The chooser then submits `fightMastermind({ shuffleAssassinIds: [a, b] })`.

The button is disabled, with a reason, when any of these hold:
- it's not the viewer's turn, or not `main`;
- the shuffle is already used this turn;
- fewer than 2 Assassins are eligible.

## User-Visible Impact

Players can fight Indestructible Man the way the card says: by choosing which two banked Elite Assassins to shuffle back in, once per turn. No enabled "Fight" button silently does nothing.

---

## Assumes

1. WP-768 is merged, with `UIMastermindState.shuffleFight?: { requiredCount: number; isUsedThisTurn: boolean; eligibleAssassins: { extId: string; display: UICardDisplay }[] }`. It is present only for Indestructible Man, and `eligibleAssassins` is the active player's list. `fightMastermind` accepts `shuffleAssassinIds`.
2. `components/play/MastermindTile.vue` on `origin/main`, after #2413:
   - `gateForFight` is at `:119-149`, `onFight` at `:151-155`, and `showEvFight` at `:187-197`. `isFightCostUnaffordable` is at `:99` and `hasFightCostBadge` at `:109`.
   - **`play-mastermind-button` (`:248-294`) wraps the CardTile art, the Fight N badge, the "Tactics remaining" line and the Final Blow line.** Removing it would remove the Mastermind card itself.
   - Re-verify all of these anchors at execution.
3. `SubmitMove` takes `args: unknown`, so no payload type map needs updating. The move name `fightMastermind` already exists in the client union.
4. PlayDesktop and PlayMobile mount MastermindTile (the same component), passing `snapshot.mastermind`, `economy` and `submitMove`.
5. **Parallel client packets also edit `MastermindTile.vue`:**
   - WP-759 (the Haunt lock in `gateForFight`);
   - WP-771 (the Killmonger "Wound him" button).

   The branches are disjoint by Mastermind. Whichever packet lands second rebases and keeps all branches.
6. `pnpm --filter @legendary-arena/arena-client typecheck` and `test` exit 0 on baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- WP-768 §Contract and D-24601.
- `components/play/MastermindTile.vue` + test.
- `components/play/PendingSeatChoicePrompt.vue`, as the in-flow chooser pattern. (WP-759's chooser does not exist yet.)
- `.claude/rules/architecture.md` §UIState Projection Integrity. The client never re-derives eligibility.
- User memory: `reference_client_fight_gating_ignores_fightcost` (no dead buttons) and `project_playmat_spatial_rebuild_d24502` (1280×720 lock).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Client only; import engine types only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- **Branch only when `shuffleFight` is present.**
  - Keep the tile body, but make it non-fighting. `play-mastermind-button` stays in the DOM, `disabled`, with no `@click`, and the CardTile gets `:interactive="false"`.
  - Hide the fight-cost badge.
  - Omit **only** the EV button (`showEvFight` → false).
  - Render `play-mastermind-shuffle-fight` as a separate **sibling** button.

  The shuffle-fight button is gated as follows:
  1. Stage, then viewer turn.
  2. If `isUsedThisTurn`, the reason is "You've already shuffled Assassins this turn."
  3. If `eligibleAssassins.length < requiredCount`, the reason is `` `Needs ${requiredCount} Elite Assassins in your Victory Pile.` ``
- **When `shuffleFight` is absent**, MastermindTile renders exactly as it does today, and existing tests pass unedited.
- **Chooser.** New `components/play/AssassinShuffleChooser.vue`, using `defineComponent({ setup })` (D-6512).
  - It renders in-flow, never absolute or fixed (the WP-759 precedent).
  - It lists `eligibleAssassins` as toggle buttons.
  - Confirm is enabled only when exactly `requiredCount` cards are selected. It emits `choose(ids)` and `close`.
  - Escape closes it and returns focus to the button.
- **Submission.** `submitMove('fightMastermind', { shuffleAssassinIds: [a, b] })`. The client never submits any other payload for Indestructible Man.
- **Engine authority.** The client never decides eligibility itself. It renders the projected list and flag.

## Locked Values

- Button test id: `play-mastermind-shuffle-fight`. Label: `` `Shuffle ${requiredCount} Elite Assassins → Fight` ``.
- Chooser test ids:
  - `play-assassin-chooser`;
  - `play-assassin-option`, with `data-ext-id` and `aria-pressed`;
  - `play-assassin-confirm`.
- Disabled reasons (exact):
  - "You've already shuffled Assassins this turn."
  - `` `Needs ${requiredCount} Elite Assassins in your Victory Pile.` ``
- Payload: `{ shuffleAssassinIds: [string, string] }`.

---

## Scope (In)

- **A)** `components/play/AssassinShuffleChooser.vue` (new) and its test.
- **B)** `components/play/MastermindTile.vue` and `MastermindTile.test.ts`: the `shuffleFight` branch, gating and chooser mount.

## Out of Scope

- Any engine change (WP-768), the Epic 3-Assassin face, animation or SFX, and Killmonger (WP-771).

## Files Expected to Change

- `apps/arena-client/src/components/play/AssassinShuffleChooser.vue` — **new**
- `apps/arena-client/src/components/play/AssassinShuffleChooser.test.ts` — **new**
- `apps/arena-client/src/components/play/MastermindTile.vue` — modified
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified
- Governance: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Contract

- The Locked Values above.

## Vision Alignment

§1 (the printed mechanic is playable), §17 (a keyboard-operable chooser), NG-1. No conflict. Client only.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. With `shuffleFight` absent, MastermindTile renders as before and its existing tests pass unedited.
2. With `shuffleFight` present:
   - `play-mastermind-button` is disabled, has no click handler, and its CardTile is non-interactive;
   - the fight-cost badge and the EV button are absent;
   - the shuffle-fight button shows, gated with the locked reasons.
3. The chooser lists the eligible Assassins with art and name. Confirm needs exactly 2, and submits `fightMastermind({ shuffleAssassinIds })` with the chosen ids. Escape closes it and returns focus.
4. The layout fits the 1280×720 mat and PlayMobile, verified by preview screenshots.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0 and its tests pass; `pnpm -r --no-bail test` → 0 fail.
6. `play-mastermind-shuffle-fight` is disabled on a non-viewer turn and outside `main`. The tile's card art and "Tactics remaining" line still render in the `shuffleFight` branch.

## Verification Steps

1. Run `pnpm -r build` → 0, then `pnpm --filter @legendary-arena/arena-client typecheck` → 0, then `pnpm --filter @legendary-arena/arena-client test` → 0 fail.
2. In the preview, inject a `shuffleFight` projection via the dev store (not committed), or run a live guest Indestructible Man match. Drive the chooser and screenshot it.
3. `git diff --name-only` ⊆ the allowlist.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] STATUS updated. DECISIONS: none (this packet consumes D-24601).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify** (together with WP-768): in a live Indestructible Man match, choose 2 Assassins, fight, and confirm a tactic is taken. Recorded as a STATUS-flip.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate.
- **§3:** MastermindTile anchors (the WP-759 / WP-750 reviews verified them).
- **§5:** 4 files.
- **§7:** WP-768 hard dependency.
- **§8:** client only.
- **§12:** `node:test` + vue-sfc-loader.
- **§14:** 6 ACs.
- **§15:** covered.
- **§16:** D-6512.
- **§17:** keyboard support.
- **Others:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, static):** DO NOT EXECUTE YET. WP-768 is a dependency, as expected. All five findings are fixed in this revision:
1. **Structural:** the Fight button wraps the card art, so the tile is now kept, made non-fighting, and the new button rendered as a sibling.
2. **Anchors:** stale line references updated to post-#2413 `main`.
3. **Copy:** the `requiredCount` template is locked.
4. **Precedent:** the chooser follows `PendingSeatChoicePrompt`.
5. **ACs:** AC-6 added, bringing the count to 6.

**Scope verdict:** READY TO EXECUTE once WP-768 merges.

**Copilot (01.7): RISK (HOLD).** Resolved.

**Pre-flight / Copilot CONFIRM (independent subagent)**: HOLD. AC-2 contradicted the keep-the-tile constraint, and verification step 1 had no exact commands. Both are fixed. **Verdict after fix: CONFIRM**, ready once WP-768 merges.
