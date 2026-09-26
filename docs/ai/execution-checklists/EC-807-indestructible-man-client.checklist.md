# EC-807 — Indestructible Man client (Execution Checklist)

**Source:** docs/ai/work-packets/WP-770-indestructible-man-client.md
**Layer:** App (arena-client)

## Before Starting
- [ ] WP-768 is merged: `UIMastermindState.shuffleFight?` exists, and `fightMastermind` accepts `shuffleAssassinIds`. If not, STOP.
- [ ] Rebase onto any merged WP-759 / WP-771 `MastermindTile` changes and keep every branch.
- [ ] `pnpm -r build` → 0. arena-client typecheck and test → 0.

## Locked Values (do not re-derive)
- The branch applies only when `snapshot.mastermind.shuffleFight` is present. In that branch:
  - Keep `play-mastermind-button` (it wraps the card art), with `disabled`, no `@click`, and CardTile `:interactive="false"`.
  - Hide the fight-cost badge.
  - Omit only the EV button.
  - Render `play-mastermind-shuffle-fight` as a sibling.
- Button: `play-mastermind-shuffle-fight`, label `` `Shuffle ${requiredCount} Elite Assassins → Fight` ``.
- Gating runs in this order:
  1. stage and viewer turn;
  2. if `isUsedThisTurn` → "You've already shuffled Assassins this turn.";
  3. if eligible count < `requiredCount` → `` `Needs ${requiredCount} Elite Assassins in your Victory Pile.` ``
- Chooser: `components/play/AssassinShuffleChooser.vue`, built with `defineComponent({ setup })`.
  - Render it in-flow.
  - Test ids: `play-assassin-chooser`, `play-assassin-option` (`data-ext-id`, `aria-pressed`), `play-assassin-confirm`.
  - Confirm is enabled only at exactly `requiredCount` selections.
  - Escape closes the chooser and returns focus.
- Submit `fightMastermind` with `{ shuffleAssassinIds: [a, b] }` and no other payload.

## Guardrails
- The client never decides eligibility; it renders the projected list and flag.
- With `shuffleFight` absent, MastermindTile renders as today and existing tests stay unedited.
- The chooser renders in-flow, never absolute or fixed.
- It must fit the 1280×720 mat and PlayMobile.

## Required `// why:` Comments
- The Fight/EV buttons are replaced because attack can never fight Indestructible Man (D-24601).
- The engine owns eligibility.
- The chooser is in-flow (the WP-759 precedent).

## Files to Produce
- `apps/arena-client/src/components/play/AssassinShuffleChooser.vue` + `.test.ts` — **new**
- `apps/arena-client/src/components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified**
- `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. arena-client typecheck → 0 and tests pass. `pnpm -r --no-bail test` → 0 fail.
- [ ] Preview drive of the chooser, with screenshots at 1280×720 and mobile.
- [ ] STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) together with WP-768.

## Common Failure Smells
- The plain Fight button is still clickable for Indestructible Man → the `shuffleFight` branch is missing.
- The Mastermind card art disappeared → `play-mastermind-button` was removed instead of disabled.
- Confirm is enabled with 1 or 3 selections → it isn't gated on `requiredCount`.
- The engine refuses the submission → the payload shape is wrong, or the ids are not the projected `extId`s.
