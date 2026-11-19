# WP-770 — Indestructible Man client: Elite Assassin chooser + shuffle-fight (Arena Client)

**Status:** Draft 2026-09-26; **reconciled 2026-11-18** against WP-768 as shipped (#3419, live-verified 2026-11-16) and the MastermindTile that WP-759, WP-771 (#3438) and #3440 left, on `origin/main` `9ff09d0e3`. Re-gate recorded below.
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:**
- **WP-768 / D-24601** ✅ (Done 2026-11-16, live-verified 2026-11-16)
- WP-750 / D-24574 ✅ (MastermindTile gates on the projected `fightCost`)
- WP-738 / D-24561 ✅ (the EV fight button)
- WP-830 / D-24763 ✅ (the Enigma Code guess picker, body-level dialog)
- WP-771 / D-24602 ✅ (the Killmonger Wound button; the last packet to edit MastermindTile)
- WP-129 / EC-132 ✅

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session).
**Risk Tier:** MEDIUM — ranked integrity: until this ships a human cannot fight Indestructible Man at all, so a human-only match against him can take no Tactic; client-only, no engine or contract change.
**Arc:** 2 of 2 for Indestructible Man. Runs after WP-768.
**Decisions:** none of its own. Consumes D-24601 (no new D-number; `NUMBER-LEDGER.md` reserves only WP-770 / EC-807).

> Baseline: `origin/main` at `9ff09d0e3` (WP-768 merged at #3419, WP-771 at `c66d04c9a`, #3440 EV row layout at `09259e97e`).

---

## Goal

Today a human cannot fight Indestructible Man. WP-768 made Attack unable to fight him and added `fightMastermind({ shuffleAssassinIds })`, but nothing in the client sends that argument. Checked on 2026-11-18 against the live client (`play.legendary-arena.com`, `version.json` `9ff09d0`): its only `fightMastermind` submits are `{}`, `{ useExcessiveViolence: true }` and `{ enigmaGuess }`, and `shuffleAssassinIds` appears only inside the bundled engine move. WP-768's own live-verify confirms the Fight button is disabled with the lock reason, while bots and server autoplay shuffle-fight him.

When `snapshot.mastermind.shuffleFight` is present (only for Indestructible Man), `MastermindTile`:

- keeps the Mastermind card but makes it non-fighting: the plain Fight button is disabled and says the engine's lock reason, whatever the Attack;
- drops the "Fight N" badge and the Excessive Violence button;
- adds a **"Shuffle 2 Elite Assassins → Fight"** button, gated on turn, stage, the heal lock, once per turn, the eligible count and the engine's `isAvailable`;
- opens an **Assassin chooser dialog** listing the active player's eligible Elite Assassins (art and name). The player picks exactly two and confirms. The tile submits `fightMastermind({ shuffleAssassinIds })`, or opens the Enigma Code guess first when the code holds a card.

## User-Visible Impact

- Players can fight Indestructible Man the way the card says: by choosing which two banked Elite Assassins to shuffle back in, once per turn.
- The disabled Fight button never says "Needs N attack". It says why Attack can't fight him.
- An Indestructible Man match under The Unbreakable Enigma Code stays winnable: the guess comes after the Assassins are chosen.

---

## Assumes

Verified on `9ff09d0e3`. If any item is false, this packet is **BLOCKED**.

1. **WP-768 projection** (`packages/game-engine/src/ui/uiState.types.ts:856-859` and `:872-889`; built at `ui/uiState.build.ts:1314-1319` via `buildShuffleFightProjection` `:802-809`; passed through `ui/uiState.filter.ts:756-765`, pinned by `uiState.filter.test.ts:4375-`). All five Board-Visible Field Rule steps are done:
   - `UIMastermindState.shuffleFight?: UIShuffleFightState`, present iff `isIndestructibleMan(G)`, read for `ctx.currentPlayer` (the active player).
   - `UIShuffleFightState = { requiredCount: number; isUsedThisTurn: boolean; isAvailable: boolean; eligibleAssassins: UIDisplayEntry[] }`. `UIDisplayEntry = { extId: string; display: UICardDisplay }` (`:424-427`). The list is the active player's Elite Assassins in Victory Pile order.
   - `requiredCount` = `SHUFFLE_FIGHT_ASSASSIN_COUNT` (2).
   - `isAvailable` = `isShuffleFightOpen` (`mastermind/indestructibleMan.logic.ts:236-247`): unused this turn, ≥ 2 Assassins, a Tactic or the Final Blow left, not haunting, not guarded. It does **not** cover the stage, heal or pending-choice gates.
2. **The lock reason** rides `UIMastermindState.fortifiedReason` (`ui/uiState.build.ts:877-879`): `INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON` ("You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him."), present while a fight target remains and no guard reason wins. A guard reason (Colleen Wing, The Blob) wins when both apply, and the lock drops once he is vanquished. The constant is **not** exported from `@legendary-arena/game-engine` (`src/index.ts`), so this packet branches on `shuffleFight` presence and shows `fortifiedReason` as projected. It never copies the string.
3. **The move** (`packages/game-engine/src/moves/fightMastermind.ts`):
   - For Indestructible Man a call without `shuffleAssassinIds` returns at any Attack (`:192-208`).
   - `isValidShuffleFightPick` (`mastermind/indestructibleMan.logic.ts:104-122`) needs exactly 2 distinct ids from the player's eligible list; order does not matter.
   - It then checks `canShuffleFight`, Killmonger (n/a), the stage, pending choices and the heal lock (`:300`).
   - With an Enigma Code holding a card, `resolveIndestructibleManShuffleFight` (`:415-466`) requires a well-formed `enigmaGuess` (else it returns before paying), shuffles the Assassins, **then** settles the guess. A wrong guess leaves them spent.
   - It never reads `useExcessiveViolence`.
4. **MastermindTile** (`apps/arena-client/src/components/play/MastermindTile.vue`, 1011 lines after WP-771 and #3440):
   - Script anchors:
     - `enigmaGuessFight` ref `:135`, typed `null | { useExcessiveViolence: boolean }`;
     - `needsEnigmaGuess` `:142-144`;
     - `onEnigmaGuess` `:166-171`;
     - `isFightCostUnaffordable` `:182-200`;
     - `isKillmongerLocked` `:207-212`;
     - `hasFightCostBadge` `:214-222`;
     - `CrossedSwordsIcon` is already imported (`:14`).
   - `gateForFight` `:224-285` runs: stage (`useTurnActions(props.currentStage, props.isViewerTurn).canFightMastermind()` `:230`; its own heal arm, `composables/useTurnActions.ts:411-417`, needs the 15th positional `hasHealedThisTurn`, which the tile does not pass) → heal lock (`healLockGate(props.hasHealedThisTurn)` `:234-237`) → Killmonger lock → cost → Haunt `:255-260` → `fortifiedReason` `:265-267` → tactics / Final Blow (the vanquished reason `All tactics defeated — the Mastermind is vanquished and victory is assured. Finish your turn, then End Turn to win.` `:279-282`).
   - More script anchors:
     - the Enigma close watch `:290-297` keys on `gateForFight().allowed` (its why-comment `:287-289`);
     - `onFight` `:299-307` (its "takes no arguments" comment `:304-305` is already stale: the move takes `useExcessiveViolence`, `enigmaGuess` and `shuffleAssassinIds`);
     - `isVictoryAssured` `:329-337`;
     - `showEvFight` `:339-349` returns false whenever `gateForFight` is not allowed;
     - `isVanquished` `:373-375`.
   - Template anchors:
     - `play-mastermind-button` `:493-547` wraps the CardTile art (`:interactive` and `:tooltip` from `gateForFight`), the Fight N badge `:524-529`, "Tactics remaining" and the Final Blow line. Removing it removes the card.
     - the Haunting badge `:553-560`, Wounds badge `:563-571`, `<FortifiedVillains>` `:575-583`, Wound button `:588-600`, EV button `:606-617`;
     - the Enigma picker, a `<Teleport to="body">` dialog `:624-631`.
   - Styles: the row-button rules `.mastermind-tile .mastermind-wound` / `.mastermind-ev-fight` (0,2,0, `max-width: 8.5rem`, from #3440 / WP-771) are the layout precedent.
   - `mastermind-tile--fortified` is on whenever `fortifiedReason` is defined, which is always while Indestructible Man is locked, so the WP-854 stand-up lift is already off.
5. **The chooser precedent is the body-level dialog, not an in-flow panel.** The same tile moved its in-tile Enigma picker to a `<Teleport to="body">` modal after Jeff's feedback (Loki / Enigma Code 2p, 2026-10-31): drawn inside the tile it was ~125×112 px on the scaled, tilted board (`MastermindTile.vue:618-623`; `EnigmaGuessPicker.vue` with backdrop, `role="dialog"`, document-level Escape). WP-759's in-flow `HauntedExorciseChooser.vue` lives under HQRow, not in the adversary band. An Assassin chooser with card art inside the tile would repeat the Enigma defect.
6. **Mounts.** `apps/arena-client/src/pages/PlayDesktop.vue:908-921` and `apps/arena-client/src/pages/PlayMobile.vue:587-599` both pass `mastermind`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy`, `enigmaCode`, `isGameOver` and `submitMove`. No page change is needed.
7. **Client types.** `SubmitMove` takes `args: unknown`. `'fightMastermind'` is already in the closed union (`components/play/uiMoveName.types.ts:65`). `UIDisplayEntry` and `UIMastermindState` are type-only imports from the `.` surface (`packages/game-engine/src/index.ts:409`, `:422`). `UIShuffleFightState` is **not** exported, so the client reads `props.mastermind.shuffleFight` through `UIMastermindState` and, where a name is needed, types it `NonNullable<UIMastermindState['shuffleFight']>` (no engine change).
8. **Parallel packets.** WP-759 (Haunt badge) and WP-771 (Wound button) are merged; no other open packet edits MastermindTile. Their branches are disjoint by Mastermind and are kept.
9. **Prior packets complete:** WP-768, WP-750, WP-738, WP-830, WP-771 and WP-129 are `[x]` in WORK_INDEX.
10. **Baseline.** On `9ff09d0e3`: `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` → 2746 pass / 0 fail.

## Context (Read First)

- WP-768 §Contract and `docs/ai/DECISIONS.md` D-24601. Also D-24574 (projected `fightCost`), D-24818 (`fortifiedReason`), D-24763 (Enigma Code) and D-24026 (live-verify).
- `packages/game-engine/src/mastermind/indestructibleMan.logic.ts`, `packages/game-engine/src/moves/fightMastermind.ts`, `packages/game-engine/src/ui/uiState.types.ts` (`UIMastermindState`, `UIShuffleFightState`).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary, and the `apps/arena-client` import row of `.claude/rules/architecture.md` (the `.` Runtime-Safe Engine Surface only). This packet adds type-only engine imports.
- `.claude/rules/architecture.md` §UIState Projection Integrity: the client never re-derives eligibility.
- `apps/arena-client/src/components/play/MastermindTile.vue` + test; `EnigmaGuessPicker.vue` (the dialog precedent); `HauntedExorciseChooser.vue` (the focus-return precedent); `CrossedSwordsIcon.vue`; `CardTile.vue`.
- User memory: `reference_client_fight_gating_ignores_fightcost` (no dead buttons) and `project_playmat_spatial_rebuild_d24502` (1280×720 lock).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Client only: no engine, server or registry change. Engine imports are type-only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific** (exact strings are in §Locked Values below):
- **Branch only when `mastermind.shuffleFight` is present.** Absent it, MastermindTile renders exactly as today, and existing tests pass unedited (new `describe` blocks only).
- **Plain Fight in the branch.** At the **top** of `gateForFight`, before the stage gate, return the branch result whenever `shuffleFight` is present:
  - vanquished (`isVanquished()`) → the existing "All tactics defeated — …" reason;
  - otherwise → `{ allowed: false, reason: mastermind.fortifiedReason ?? <fallback> }`.

  This keeps `play-mastermind-button` in the DOM (it wraps the card art), disabled, with the CardTile non-interactive. It also hides the EV button through `showEvFight`. `onFight` returns before submitting while `shuffleFight` is present, so even a direct `onFight()` call submits nothing. Its stale "takes no arguments" comment (`:304-305`) is rewritten.

  Rationale: Attack can never fight him (D-24601), so a stage or "Needs N attack" reason is false advice. This narrows the EC-132 §3 stage → resource → structural precedence for this one Mastermind. The executor rewrites the header JSDoc (`:40-45`), the `gateForFight` comment (`:225-229`) and the template comment (`:503-507`) to say so (no new D-entry, as WP-771 did for Killmonger).
- **Fight-cost badge** is hidden while `shuffleFight` is present: his projected `fightCost` is not a price anyone pays.
- **Shuffle-fight button** (`play-mastermind-shuffle-fight`) is a sibling of the Fight button in normal flow: after `<FortifiedVillains>`, before the Wound and EV buttons.
  - It shows iff `shuffleFight` is present, `!isVanquished()` and `!isGameOver`.
  - Its gate, `gateForShuffleFight()`, runs in order:
    1. `useTurnActions(props.currentStage, props.isViewerTurn).canFightMastermind()` (not your turn → stage), then `healLockGate(props.hasHealedThisTurn)`, exactly as `gateForFight` `:230-237` (the move refuses after a heal);
    2. `isUsedThisTurn`;
    3. `eligibleAssassins.length < requiredCount`;
    4. `isHaunting === true` → the existing haunt reason;
    5. `isAvailable === false` → `fortifiedReason ?? <fallback>` (by here the only cause left is a guard, whose reason the projection puts in `fortifiedReason`);
    6. allowed.
  - Arms 2-4 only pick a specific reason. The engine's `isAvailable` is the final word, and the client never enables the button while it is false.
  - The label wraps (a `.mastermind-tile .mastermind-shuffle-fight` (0,2,0) row selector with `flex-direction: row; align-items: center; align-self: flex-start; font-size: 0.7rem; max-width: 8.5rem`, `CrossedSwordsIcon` before the label), so the tile never widens past its EV-button width. Unlike EV, it shows on every turn, so Verification 3 also compares the tile's height and the board's fit scale.
- **Chooser.** New `components/play/AssassinShuffleChooser.vue`, `defineComponent({ setup })` (D-6512). It is a **modal dialog that MastermindTile teleports to `document.body`** (Assumes 5; the WP-830 precedent on this tile), never drawn inside the tile.
  - Props: `assassins: UIDisplayEntry[]` and `requiredCount: number`.
  - One toggle button per entry, in projected order, each with the card's art (`CardTile`, size `sm`, label shown) and name.
  - Toggles are unrestricted: picking more than `requiredCount` is allowed and disables Confirm.
  - Confirm is enabled only at exactly `requiredCount` selections. It emits `choose(ids)`, with the ids in projected order.
  - Cancel, Escape (document listener while mounted) and a backdrop click emit `close`. Clicks inside the panel never close it.
  - Focus moves to the first option on open.
  - The chooser decides nothing: it lists what the engine projected.
- **Tile wiring.**
  - Clicking the shuffle button opens the chooser.
  - On `close`, the tile closes it and returns focus to the shuffle button.
  - On `choose(ids)`, the tile closes it. With the Enigma Code holding a card (`needsEnigmaGuess()`), it opens the existing Enigma picker with the pick held: `enigmaGuessFight` widens to `null | { useExcessiveViolence: boolean; shuffleAssassinIds?: string[] }`. `onEnigmaGuess` builds its payload with `if / else if / else` (never a chained ternary): `{ shuffleAssassinIds, enigmaGuess }`, else `{ enigmaGuess, useExcessiveViolence: true }`, else `{ enigmaGuess }`. Otherwise it submits `{ shuffleAssassinIds }` directly.
  - Cancelling the Enigma picker in the shuffle path also returns focus to the shuffle button (the plain-Fight path keeps today's behaviour).
  - The Enigma close watch and a chooser close both key on `isFightPossible()`. That is `gateForShuffleFight().allowed` in the branch and `gateForFight().allowed` otherwise, each `&& !isGameOver`. A turn change, a stage change or the game ending closes either dialog.
- **Submission.** `submitMove('fightMastermind', { shuffleAssassinIds })`, or `{ shuffleAssassinIds, enigmaGuess }` when a guess was made. Never `useExcessiveViolence`, and never a bare `{}`, for Indestructible Man.
- **Engine authority.** Eligibility, the once-per-turn flag and every board gate come from `shuffleFight`. The client never reads the Victory Pile, never tests a Mastermind id or ext_id prefix, and never copies the lock string.
- **Pending choices: Fight parity, accepted.** The tile has no pending-choice props. While one is open the shuffle button can render enabled, and the engine silently refuses, exactly as the Fight and Wound buttons do today. Out of scope.

## Locked Values

- Shuffle button test id `play-mastermind-shuffle-fight`; label `` `Shuffle ${requiredCount} Elite Assassins → Fight` ``; enabled-state `title`: `` `Shuffle ${requiredCount} Elite Assassins from your Victory Pile into the Villain Deck to fight Indestructible Man (once per turn).` ``; disabled-state `title` = the gate reason.
- Disabled reasons (exact):
  - the shared not-your-turn / stage reasons from `canFightMastermind()` and the heal-lock reason from `healLockGate()`;
  - `You've already shuffled Assassins this turn.`;
  - `` `Needs ${requiredCount} Elite Assassins in your Victory Pile.` ``;
  - the existing haunt reason `The Mastermind is haunting a Hero in the HQ. Exorcise that Hero first.`;
  - `fortifiedReason`.
- Fallback reason (for the plain Fight button or the shuffle gate when `fortifiedReason` is absent): `Indestructible Man can't be fought right now.`
- Chooser test ids:
  - `play-assassin-chooser` (the dialog, `role="dialog"`, `aria-modal="true"`, `aria-label="Choose Elite Assassins to shuffle"`);
  - `play-assassin-backdrop`;
  - `play-assassin-option` (with `data-ext-id` and `aria-pressed`);
  - `play-assassin-confirm`;
  - `play-assassin-cancel`.
- Chooser heading `` `Choose ${requiredCount} Elite Assassins` ``; hint `Shuffle them from your Victory Pile into the Villain Deck, then fight Indestructible Man.`; confirm label `Shuffle and fight`; cancel label `Cancel`.
- Payload: `{ shuffleAssassinIds: string[] }` (length `requiredCount`, projected order), plus `enigmaGuess: string[]` only after an Enigma guess.

---

## Scope (In)

- **A)** `components/play/AssassinShuffleChooser.vue` (new) and `AssassinShuffleChooser.test.ts` (new).
- **B)** `components/play/MastermindTile.vue` and `MastermindTile.test.ts`: the `shuffleFight` branch in `gateForFight`, the badge hide, `onFight` guard, the shuffle button and gate, the teleported chooser, the Enigma hand-off, the widened close watch, and the three precedence comments.

## Out of Scope

- Any engine change. WP-768 shipped the move, the projection and the lock. Exporting `INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON` is not needed.
- The Epic Indestructible Man 3-Assassin face, animation or SFX, Mad Monk's tactic-becomes-a-Villain substrate.
- Pending-choice props on the tile.
- Killmonger (WP-771) and the Haunt / Fortify locks, beyond keeping their branches.

## Files Expected to Change

- `apps/arena-client/src/components/play/AssassinShuffleChooser.vue` — **new**: the dialog
- `apps/arena-client/src/components/play/AssassinShuffleChooser.test.ts` — **new**: 6 tests
- `apps/arena-client/src/components/play/MastermindTile.vue` — modified: the `shuffleFight` branch
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified: a new `describe` only (11 tests)
- Governance (close commit): `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json` (pending row), this WP — modified; `docs/ai/post-mortems/01.6-WP-770-indestructible-man-client.md` — new.

## Contract

- The Locked Values above. No engine, `UIState` or move contract changes.

## Vision Alignment

§1 (the printed mechanic is playable), §17 (a keyboard-operable chooser), NG-1 (no outcome is bought). Client only.

**No conflict:** this WP preserves all touched clauses.
**Non-Goal proximity:** none of NG-1..NG-7 crossed.

## Funding Surface Gate

§20 N/A: client-only Mastermind tile controls and a chooser dialog; no funding UI, copy or channel.

## API Catalog

§21 N/A: no `apps/server` endpoint or catalog function is added, changed or removed.

---

## Acceptance Criteria

1. With `shuffleFight` absent, MastermindTile renders as before, the existing tests pass unedited, and no shuffle button renders.
2. With `shuffleFight` present at `main` on the viewer's turn with Attack ≥ the projected `fightCost` and Excessive Violence available:
   - `play-mastermind-button` is disabled with `title` = `fortifiedReason`;
   - its CardTile is non-interactive;
   - a direct `onFight()` call (`wrapper.vm`) submits nothing;
   - the card art and "Tactics remaining" still render;
   - there is no `play-mastermind-fight-cost` badge and no `play-mastermind-ev` button.
3. In the branch, the plain Fight `title` is `fortifiedReason`, never the turn, stage or cost reason: off-turn, and at `main` with Attack short of `fightCost`. With `fortifiedReason` absent and tactics left, it is the fallback.
4. The shuffle button shows the locked label. It is hidden once vanquished (`tacticsRemaining === 0`, no Final Blow pending) and with `isGameOver`, and it shows under a pending Final Blow.
5. The shuffle button is disabled, in order, with:
   - the not-your-turn reason off-turn;
   - the stage reason outside `main`;
   - the heal-lock reason after a heal;
   - "You've already shuffled Assassins this turn." when `isUsedThisTurn`;
   - "Needs 2 Elite Assassins in your Victory Pile." with one eligible;
   - the haunt reason while haunting;
   - `fortifiedReason` when `isAvailable` is false for a guard.

   It is enabled only when every arm passes and `isAvailable` is true. Disabled clicks open nothing.
6. Clicking the enabled button opens `play-assassin-chooser` under `document.body` (not inside the tile), listing every eligible Assassin in projected order with its art and name.
7. In the chooser, toggles are unrestricted. Confirm is disabled at 0, 1 and 3 selections and enabled at exactly 2. Toggling sets `aria-pressed`. Confirm submits `fightMastermind` with `{ shuffleAssassinIds: [a, b] }` (projected order), and the chooser closes.
8. Escape, Cancel and a backdrop click close the chooser without submitting, and focus returns to the shuffle button. A click inside the panel does not close it.
9. With `enigmaCode` holding a card, Confirm opens the Enigma guess picker instead of submitting. Its submit sends `{ shuffleAssassinIds, enigmaGuess }` with no `useExcessiveViolence`; its cancel submits nothing and returns focus to the shuffle button.
10. An open chooser, and an Enigma picker opened by the hand-off, each close when the shuffle gate turns false: the turn passes, or the game ends.
11. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` → 0 fail.

## Test Expectations

- 17 new `node:test` tests (`.test.ts`, vue-sfc-loader):
  - `MastermindTile.test.ts`: 11, one `test` per AC with several asserts where an AC has several cases (ACs 1-10; AC 5 is two, one for the stage/heal arms and one for the engine arms). Dialogs are reached with `findComponent(AssassinShuffleChooser)` / `findComponent(EnigmaGuessPicker)`, never `document.querySelector`; focus tests mount with `attachTo: document.body` and `unmount()` after;
  - `AssassinShuffleChooser.test.ts`: 6 (option list, toggle + `aria-pressed`, the exact-count Confirm, the `choose` payload order, Escape / Cancel / backdrop `close`, first-option focus).
- arena-client 2746 → 2763, 0 fail; every other package unchanged.

## Verification Steps

1. Run `pnpm -r build` → 0, then `pnpm --filter @legendary-arena/arena-client typecheck` → 0, then `pnpm -r --no-bail test` → 0 fail. Paste every package's totals.
2. Revert proofs, restoring after each:
   - (a) drop the branch arm at the top of `gateForFight` → AC 3 fails (the off-turn title becomes `It is not your turn.`, the short-attack title `Needs N attack, you have M.`);
   - (b) drop the `isAvailable` arm → AC 5's guard case fails;
   - (c) submit on Confirm without the Enigma check → AC 9 fails;
   - (d) gate Confirm on `>= requiredCount` → AC 7's 3-selection case fails;
   - (e) drop the `onFight` guard → AC 2's direct-call case fails;
   - (f) key the close watch on `gateForFight().allowed` alone → AC 10's Enigma case fails.
3. Preview: drive the tile with a `shuffleFight` fixture (dev store, not committed) at 1280×720 and on mobile. Screenshot the tile and the open chooser. Confirm the tile is no wider with the shuffle button than with the EV button, and compare the tile's height and the board's fit scale (shuffle button vs EV button); if the shuffle button makes the board shrink, record it and the measured numbers in the post-mortem.
4. Confirm `git diff --name-only` ⊆ the allowlist.
5. Live-verify (D-24026) after merge + deploy: in a NEW human Indestructible Man match (Workshop operator match with Elite Assassins staged in the Victory Pile), choose 2 Assassins and confirm. The log shows "shuffled <A> and <B> … to fight Indestructible Man." and a Tactic is defeated. The button then says "You've already shuffled Assassins this turn."

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] STATUS updated. DECISIONS: none (consumes D-24601).
- [ ] WORK_INDEX `[x]` + `[live-verify: pending]`, EC_INDEX Done, mindmap `✅` + `pnpm roadmap:counts:write` (`:check` 0), NUMBER-LEDGER LANDED, a pending `live-verify.json` row, 01.6 post-mortem.
- [ ] Two-commit topology (`EC-807:` code, `SPEC:` close).
- [ ] **D-24026 live-verify** recorded as its own `SPEC:` PR, the WORK_INDEX row citing the date and match.

---

## Lint Gate Self-Review (00.3)

- §1 all sections present.
- §2 boilerplate + protocol; Locked Values pointed to from Constraints.
- §3 Assumes re-anchored on `9ff09d0e3` with paths and lines.
- §4 Context cites WP-768, D-24601 / D-24574 / D-24818 / D-24763 / D-24026, ARCHITECTURE §Layer Boundary and the arena-client import row.
- §5 4 code files + governance, closed allowlist with per-line purpose.
- §6 canonical names (`shuffleFight`, `isAvailable`, `eligibleAssassins`, `fortifiedReason`).
- §7 dependencies all merged.
- §8 client only, type-only engine imports.
- §9 pnpm.
- §10–11 N/A.
- §12 `node:test`, `.test.ts`, vue-sfc-loader.
- §13 exact commands.
- §14 11 binary ACs.
- §15 DoD + D-24026.
- §15.2 Risk Tier MEDIUM (WP + EC).
- §16 00.6, D-6512, no contract change.
- §17 clauses + NG line.
- §18–19 N/A.
- §20–21 N/A with reasons.

## Gate Record

**2026-09-26 draft gates (superseded by the reconcile):** 01.4 round 1 DO NOT EXECUTE (WP-768 pending; five findings fixed); 01.7 RISK (HOLD), resolved; CONFIRM by an independent subagent, ready once WP-768 merged.

**2026-11-18 reconcile (on `9ff09d0e3`):**
- Dependency met. WP-768 is done and live-verified; the WP no longer reads "BLOCKED". The live client was checked: no `shuffleAssassinIds` submit exists, so a human cannot fight Indestructible Man today.
- `UIShuffleFightState` gains `isAvailable` (the engine's board-gate verdict) and `eligibleAssassins: UIDisplayEntry[]`. The shuffle gate ends on `isAvailable` and adds the heal-lock and haunt arms.
- The plain Fight button's lock reason comes ahead of the stage and cost gates for this Mastermind (STATUS WP-768 follow-up, "put the lock reason ahead of the client cost gate"). It is implemented as a top arm in `gateForFight`, which also hides EV and the Enigma path.
- "No `@click`" becomes "`onFight` returns while `shuffleFight` is present": a direct `onFight()` call submits nothing, which is testable.
- The chooser moves from in-flow to a body-level dialog, the WP-830 precedent on this same tile (Assumes 5).
- An Enigma Code hand-off is added: the engine requires `enigmaGuess` on the shuffle-fight, and without it IM + Enigma Code is unwinnable.
- Anchors are refreshed after WP-771 and #3440, and a Risk Tier is added.

**2026-11-18 re-gate:** rounds recorded below.

**Round 1 (independent subagents, 2026-11-18):**
- **01.4 pre-flight: DO NOT EXECUTE.**
  - The blocker: Assumes 7 named `UIShuffleFightState` as an importable type, but it is not exported. It is now typed through `UIMastermindState`.
  - Revert proof (a) retargeted to AC 3.
  - Toggles beyond `requiredCount` made explicit.
  - Two anchors refreshed (`:192-208`, `:300`).
  - Every other Assumes item, all dependencies and the button↔engine parity were verified. **Empirical Scaffold not required:** no engine input gets stricter, and no existing fixture carries `shuffleFight`. Per 01.4 §Verdict the scope-neutral fixes need no second pre-flight.
- **01.7 copilot: HOLD (RISK).** Seven fixes applied:
  1. The unexported type (as 01.4).
  2. The heal-lock arm: the tile calls `useTurnActions` without the heal flag, so the gate adds `healLockGate` exactly as `gateForFight` `:234-237`.
  3. Revert proof (a) → AC 3, and AC 3 gains the short-attack case (the headline claim).
  4. AC 2 calls `onFight()` directly (VTU `trigger` is a no-op on a disabled button), plus revert proof (e).
  5. `onEnigmaGuess` locked to `if / else if / else`; the stale `onFight` and close-watch comments are added to the required why-comments.
  6. `align-self: flex-start` on the row rule, and Verification 3 compares height and fit scale (the button shows every turn).
  7. Enigma-cancel focus return in the shuffle path.

  Test hygiene: `findComponent` for dialogs, `attachTo` + `unmount` for focus.
- **00.3 lint: FAIL.** Fixes applied:
  - §3: the unexported type, and the heal-lock wording in Assumes 4.
  - §13: revert proof (a) → AC 3.
  - The index rows' "re-gated" wording is backed by this record before commit.

  Recommendations applied:
  - AC 10 covers the hand-off Enigma picker, with revert proof (f).
  - The vanquished string is cited by line.
  - `CrossedSwordsIcon` is noted as imported.
  - `node:test` is stated in Test Expectations.

  Noted for the post-mortem: `gateForFight` is already 62 lines (pre-existing); the new arm is a one-line call to a helper.

**Round 2 (same independent subagents, 2026-11-18):**
- **01.4 pre-flight: READY TO EXECUTE.** All three round-1 findings are fixed and nothing new is false. The reviewer withdrew its own round-1 claim that `canFightMastermind` covers the heal lock.
- **01.7 copilot: CONFIRM.** All seven fixes were re-verified against the code; revert proofs (a), (e) and (f) each fail their AC. Nits applied:
  - the heal-lock reason is attributed to `healLockGate()`;
  - one `test` per AC is pinned, so 2746 → 2763 holds;
  - the duplicate failure smell is removed.
- **00.3 lint: PASS.** §3, §13, §14 and WP↔EC consistency all PASS. Nits applied: the duplicate failure smell, and the reconcile bullet's "dispatched click" → "direct `onFight()` call".

**Re-gate result:** 01.4 READY TO EXECUTE (round 2; Empirical Scaffold not required; observed baseline arena-client 2746 / 0 fail) · 01.7 CONFIRM (round 2) · 00.3 PASS (round 2).
