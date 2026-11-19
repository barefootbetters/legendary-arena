# EC-807 — Indestructible Man client (Execution Checklist)

**Source:** docs/ai/work-packets/WP-770-indestructible-man-client.md
**Layer:** App (arena-client)
**Reconciled:** 2026-11-18 against WP-768 as shipped (#3419) and MastermindTile after WP-771 / #3440 (`9ff09d0e3`).
**Risk Tier:** MEDIUM — ranked integrity: until this ships a human cannot fight Indestructible Man at all, so a human-only match against him can take no Tactic; client-only, no engine or contract change.

## Before Starting
- [ ] WP-768 is merged: `UIMastermindState.shuffleFight?: UIShuffleFightState` (`requiredCount`, `isUsedThisTurn`, `isAvailable`, `eligibleAssassins: UIDisplayEntry[]`) exists and passes the audience filter. `fightMastermind` accepts `shuffleAssassinIds`. If not, STOP.
- [ ] Re-verify the MastermindTile anchors in WP Assumes 4 (WP-771 / #3440 are the last edits). Keep every Haunt, Fortify, Killmonger, EV and Enigma branch.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` → 2746 pass / 0 fail.
- [ ] Scope lock: only the 4 files in Files to Produce plus the governance close; anything else is a blocker.

## Locked Values (do not re-derive)
- **Branch key:** `mastermind.shuffleFight !== undefined`. Never a Mastermind id, an ext_id prefix or a copy of the lock string.
- **Plain Fight (top arm of `gateForFight`, before the stage gate):**
  - `isVanquished()` → the existing "All tactics defeated — …" reason;
  - else `{ allowed: false, reason: mastermind.fortifiedReason ?? "Indestructible Man can't be fought right now." }`.

  `play-mastermind-button` stays (it wraps the art), disabled, and its CardTile is non-interactive. `showEvFight` inherits the arm. `onFight` returns while `shuffleFight` is present.
- **Badge:** `hasFightCostBadge()` returns false while `shuffleFight` is present.
- **Shuffle button:**
  - test id `play-mastermind-shuffle-fight`, label `` `Shuffle ${requiredCount} Elite Assassins → Fight` ``, `CrossedSwordsIcon` before it;
  - shown iff `shuffleFight` is present, `!isVanquished()` and `!isGameOver`;
  - enabled `title`: `` `Shuffle ${requiredCount} Elite Assassins from your Victory Pile into the Villain Deck to fight Indestructible Man (once per turn).` ``; disabled `title` = the gate reason.
- **`gateForShuffleFight()` order:**
  1. `useTurnActions(props.currentStage, props.isViewerTurn).canFightMastermind()` (not your turn → stage), then `healLockGate(props.hasHealedThisTurn)`, exactly as `gateForFight` `:230-237`;
  2. `isUsedThisTurn` → `You've already shuffled Assassins this turn.`;
  3. `eligibleAssassins.length < requiredCount` → `` `Needs ${requiredCount} Elite Assassins in your Victory Pile.` ``;
  4. `isHaunting === true` → `The Mastermind is haunting a Hero in the HQ. Exorcise that Hero first.`;
  5. `isAvailable === false` → `fortifiedReason ?? "Indestructible Man can't be fought right now."`;
  6. allowed.
- **Placement:** after `<FortifiedVillains>`, before the Wound and EV buttons. Row selector `.mastermind-tile .mastermind-shuffle-fight` (0,2,0): `flex-direction: row; align-items: center; align-self: flex-start; font-size: 0.7rem; max-width: 8.5rem`, wrapping.
- **Chooser:** `components/play/AssassinShuffleChooser.vue`, `defineComponent({ setup })`.
  - It is a modal dialog that MastermindTile teleports to `document.body` (the WP-830 Enigma precedent on this tile). Never draw it inside the tile.
  - Props: `assassins: UIDisplayEntry[]`, `requiredCount: number`. Emits `choose(ids)` and `close`.
  - Test ids:
    - `play-assassin-backdrop`;
    - `play-assassin-chooser` (`role="dialog"`, `aria-modal="true"`, `aria-label="Choose Elite Assassins to shuffle"`);
    - `play-assassin-option` (`data-ext-id`, `aria-pressed`);
    - `play-assassin-confirm`;
    - `play-assassin-cancel`.
  - Text: heading `` `Choose ${requiredCount} Elite Assassins` ``; hint `Shuffle them from your Victory Pile into the Villain Deck, then fight Indestructible Man.`; confirm label `Shuffle and fight`; cancel label `Cancel`.
  - Toggles are unrestricted (more than `requiredCount` is allowed and disables Confirm). Confirm is enabled only at exactly `requiredCount` selections, and `choose` ids are in projected order.
  - Escape (document listener while mounted), Cancel and a backdrop click emit `close`. A click inside the panel does not.
  - Focus moves to the first option on mount.
- **Tile wiring:**
  - On `close`, close the chooser and focus the shuffle button.
  - On `choose(ids)`, close it. If `needsEnigmaGuess()`, set `enigmaGuessFight = { useExcessiveViolence: false, shuffleAssassinIds: ids }` (the ref type widens). `onEnigmaGuess` builds the payload with `if / else if / else`, never a chained ternary: `{ shuffleAssassinIds, enigmaGuess }`, else `{ enigmaGuess, useExcessiveViolence: true }`, else `{ enigmaGuess }`. Otherwise submit `{ shuffleAssassinIds: ids }`.
  - Cancelling that Enigma picker returns focus to the shuffle button.
- **Close watch:** keys on `isFightPossible() && !isGameOver`. `isFightPossible()` is `gateForShuffleFight().allowed` in the branch, else `gateForFight().allowed`. It closes both the Enigma picker and the chooser.
- **Payload:** `fightMastermind` with `{ shuffleAssassinIds }` or `{ shuffleAssassinIds, enigmaGuess }`. Never `useExcessiveViolence`, and never a bare `{}`, for him.

## Guardrails
- The engine owns eligibility (`eligibleAssassins`, `isUsedThisTurn`, `isAvailable`). The button is never enabled while `isAvailable` is false.
- With `shuffleFight` absent, MastermindTile renders as today. Existing tests stay unedited (new `describe` blocks only).
- Engine imports are type-only (`UIMastermindState`, `UIDisplayEntry`). `UIShuffleFightState` is not exported; use `NonNullable<UIMastermindState['shuffleFight']>` where a name is needed. Never edit the engine barrel.
- The chooser is a body-level dialog. The shuffle button is in normal flow, and the tile is no wider than with the EV button. Fit the 1280×720 mat and PlayMobile.
- Keep `mastermind-tile--fortified` keyed on any `fortifiedReason`.
- Pending choices keep Fight parity. Do not add pending props.

## Required `// why:` Comments
- The top `gateForFight` arm: Attack can never fight Indestructible Man (D-24601), so stage and cost reasons would be false advice. It narrows EC-132 §3 for him only. Rewrite all three precedence statements: the header JSDoc `:40-45`, the `gateForFight` comment `:225-229`, the template comment `:503-507`.
- The badge hidden: his `fightCost` is not a price anyone pays.
- `gateForShuffleFight` ends on `isAvailable`: the engine owns eligibility; the earlier arms only name the reason.
- The chooser is a body-level dialog: the WP-830 in-tile picker was unreadable on the scaled, tilted board.
- The Enigma hand-off: the engine requires the guess on the shuffle-fight and settles it after the shuffle.
- The `onFight` guard, replacing the stale "takes no arguments" comment (`:304-305`): Indestructible Man is fought only through the shuffle button.
- The close watch (`:287-289` rewritten): it keys on the shuffle gate in the branch and closes the chooser too.

## Files to Produce
- `apps/arena-client/src/components/play/AssassinShuffleChooser.vue` — **new**: the dialog
- `apps/arena-client/src/components/play/AssassinShuffleChooser.test.ts` — **new**: 6 tests
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified**: the `shuffleFight` branch
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified**: a new `describe` only (11 tests, ACs 1-10)
- Governance close: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`, the WP, `docs/ai/post-mortems/01.6-WP-770-indestructible-man-client.md` — **modified / new**

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` → 0 fail (every package's totals pasted); arena-client 2746 → 2763.
- [ ] Revert proofs (WP Verification 2, a-f) run and restored.
- [ ] DECISIONS: none (consumes D-24601).
- [ ] Preview drive of the chooser, with screenshots at 1280×720 and mobile. The tile is no wider with the shuffle button than with the EV button; its height and the board's fit scale are compared and recorded.
- [ ] STATUS; WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write` (`:check` 0); NUMBER-LEDGER LANDED; pending `live-verify.json` row; 01.6 post-mortem.
- [ ] Allowlist-only diff. Two-commit topology (`EC-807:` then `SPEC:`).
- [ ] Live-verify (D-24026) after merge + deploy, as its own `SPEC:` PR.

## Common Failure Smells
- The Mastermind card art disappeared → `play-mastermind-button` was removed instead of disabled.
- Fight says "Needs N attack" when short, or "It is not your turn." off-turn → the arm sits below the stage / cost gates (the existing `fortifiedReason` arm alone still hides EV, so EV is not the tell).
- The shuffle button stays enabled after a Heal → `healLockGate` is missing (the tile's `useTurnActions` call omits the heal flag).
- A new test passes against an unguarded `onFight` → it used `trigger('click')` on a disabled button; call `wrapper.vm.onFight()`.
- Confirm is enabled with 1 or 3 selections → it isn't gated on exactly `requiredCount`.
- The engine refuses the submission → the payload shape is wrong, the ids are not the projected `extId`s, or the Enigma Code holds a card and no guess was sent.
- The chooser renders tiny and tilted → it was drawn inside the tile, not teleported.
- The shuffle button is enabled while guarded → the `isAvailable` arm is missing.
