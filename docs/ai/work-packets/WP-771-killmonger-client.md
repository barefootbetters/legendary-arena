# WP-771 — Killmonger client: "Wound him" button + wounds badge (Arena Client)

**Status:** Draft 2026-09-26. **BLOCKED on WP-769** (the `woundMastermind` move and the `UIMastermindState.wounds` / `woundable` projection).
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:**
- **WP-769 / D-24602**
- WP-750 / D-24574 (the projected Mastermind `fightCost`)
- WP-648 (the `recruitOfficer` client move-name precedent)
- WP-129 / EC-132

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session).
**Arc:** 2 of 2 for Killmonger. Runs after WP-769.

> Baseline: `origin/main` at `b7efb34a` + #2412. Re-baseline on WP-769's merge at execution.

---

## Goal

When the Mastermind is Killmonger (`snapshot.mastermind.woundable === true`), `MastermindTile` changes as follows:

- **Wound button.** It shows a **"Wound him — spend N ⚔ → +1 Recruit"** button, where N = `mastermind.fightCost`. The button submits `woundMastermind` and is gated on stage, viewer turn, and `availableAttack ≥ fightCost > 0`.
- **Wounds badge.** It shows a **Wounds: n** badge when `mastermind.wounds` is present.
- **Fight lock.** It **disables Fight** (and hides the Excessive Violence fight) while `fightCost > 0`, with the reason "Wound Killmonger to 0 first." At `fightCost === 0` Fight works normally.

## User-Visible Impact

- Players can wound Killmonger down with a clear running cost and a wound count.
- They never see an enabled Fight button that the engine would refuse.

---

## Assumes

1. **WP-769 is merged.** It provides:
   - `UIMastermindState.woundable?: true` (Killmonger only; Fight is refused while `fightCost > 0`);
   - `wounds?: number`;
   - `fightCost` that reflects the Wounds;
   - the `woundMastermind()` move with no args.
2. **MastermindTile anchors** (origin/main after #2413; re-verify at execution): `gateForFight` ~`:119-149` checks stage → cost → structural. `showEvFight` ~`:187-197` calls `gateForFight`. `play-mastermind-button` wraps the card art.
2a. **Waterfall heading.** WP-769 adds the seat-choice kind `killmonger-waterfall-discard`. `PendingSeatChoicePrompt.vue` (~`:104`) falls back to "Your choice" for unknown kinds.
3. **Client move-name union.** `uiMoveName.types.ts` is a closed union; `recruitOfficer` is the precedent. `useTurnActions.ts` declares an explicit return type. `moveSfxManifest` is a `Partial<Record>`, so it needs no entry.
4. **Parallel edits to `MastermindTile.vue`.** WP-759 (Haunt lock) and WP-770 (Indestructible Man shuffle-fight) also edit it. The branches are disjoint by Mastermind. Whichever lands second rebases and keeps every branch.
5. **Baseline.** The arena-client typecheck and tests exit 0.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- WP-769 §Contract and D-24602.
- `components/play/MastermindTile.vue` + test; `components/play/SharedDecks.vue` (the `recruitOfficer` button precedent).
- `components/play/CrossedSwordsIcon.vue`: any attack icon must be an inline SVG, never a Unicode glyph (the WP-736 precedent).
- User memory: `reference_client_fight_gating_ignores_fightcost`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Client only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- **Fight lock placement.** It goes inside `gateForFight`, after the stage check and before the cost check.
  - Condition: `woundable && fightCost > 0 && (tacticsRemaining > 0 || finalBlowPending === true)`.
  - When it holds, return `{ allowed: false, reason: 'Wound Killmonger to 0 first.' }`. `showEvFight` inherits it.
  - Once victory is assured, the existing victory message is **not** masked (after the last tactic, returned Wounds put the cost back to 5).
- **Wound gating.**
  - The stage check comes first, via a new `useTurnActions` predicate `canWoundMastermind()` (`play.main`, viewer's turn). Add it to the explicit return type as well.
  - The cost check is `availableAttack ≥ fightCost`. On failure, reuse the `Needs X attack, you have Y.` message.
  - Hide the button when `fightCost === 0`, or when no tactics remain and Final Blow is not pending.
  - The engine remains the authority on Wound availability. The client does not check the Wound Stack; a rare refusal is logged by the engine.
- **Absent `woundable`.** MastermindTile renders exactly as today.
- **Icons.** No Unicode attack glyph. Reuse `CrossedSwordsIcon` or plain text.

## Locked Values

- Client move name: `'woundMastermind'`. Payload: `{}`.
- Test ids: `play-mastermind-wound` (button) and `play-mastermind-wounds` (badge, `data-count`).
- Button label: `` `Wound him — spend ${fightCost} → +1 Recruit` ``, with the icon via `CrossedSwordsIcon`.
- Fight-lock reason: `Wound Killmonger to 0 first.`
- Predicate: `canWoundMastermind()`.

---

## Scope (In)

- **A)** `components/play/MastermindTile.vue` (+ `MastermindTile.test.ts`): the Wound button, the badge and the Fight lock.
- **A2)** `components/play/PendingSeatChoicePrompt.vue` (+ test): a heading case for `'killmonger-waterfall-discard'`, reading "Throw from the Waterfall — discard a card".
- **B)** `components/play/uiMoveName.types.ts`: add `'woundMastermind'`.
- **C)** `composables/useTurnActions.ts` (+ test): `canWoundMastermind`, in both the return type and the returned object.

## Out of Scope

- Any engine change (WP-769).
- League villain wounds.
- SFX and VFX.
- Indestructible Man (WP-770).

## Files Expected to Change

- `apps/arena-client/src/components/play/MastermindTile.vue` — modified
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `PendingSeatChoicePrompt.test.ts` — modified (Waterfall heading)
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified
- `apps/arena-client/src/composables/useTurnActions.ts` — modified
- `apps/arena-client/src/composables/useTurnActions.test.ts` — modified
- Governance: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Contract

- The Locked Values above.

## Vision Alignment

§1, §17, NG-1. No conflict. Client only.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. With `woundable` absent, MastermindTile renders as before and the existing tests pass unedited.
2. With `woundable`, `fightCost > 0` and tactics remaining, Fight is disabled with "Wound Killmonger to 0 first."
3. In the same state, the EV fight button is hidden.
4. The Wound button shows the current cost and submits `woundMastermind` with `{}`.
5. The Wound button is disabled with the stage / viewer-turn reason, and with the resource reason when `availableAttack < fightCost`.
6. At `fightCost === 0` the Wound button is hidden and Fight is enabled.
7. After the last tactic (no tactics remaining, Final Blow not pending), neither the Fight lock nor the Wound button appears, and the existing victory message shows.
8. The Wounds badge shows `mastermind.wounds` when present.
9. The Waterfall seat-choice prompt shows its heading.
10. `pnpm --filter @legendary-arena/arena-client typecheck` → 0, all tests pass, and `pnpm -r --no-bail test` → 0 fail. Preview screenshots at 1280×720 and on mobile.

## Verification Steps

1. Run `pnpm -r build` → 0, then `pnpm --filter @legendary-arena/arena-client typecheck` → 0, then `pnpm --filter @legendary-arena/arena-client test` → 0 fail.
2. In the preview, inject `woundable` / `wounds` / `fightCost` via the dev store (not committed), or use a live guest Killmonger match. Wound him to 0, then fight. Take screenshots.
3. Confirm `git diff --name-only` ⊆ the allowlist.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] STATUS updated. DECISIONS: none (this packet consumes D-24602).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, and `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify** (with WP-769): a live Killmonger match wounds 5 → 0 with +1 Recruit each time, then fights. Recorded as a STATUS-flip.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate.
- **§5:** 7 files.
- **§7:** WP-769 hard-dep.
- **§8:** client only.
- **§12:** `node:test`.
- **§14:** 10 ACs.
- **§15:** covered.
- **§16:** 00.6.
- **§17:** no Unicode glyph.
- **Others:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, static): DO NOT EXECUTE.** WP-769 is a dependency, as expected. All findings are fixed in this revision:
- **PS-6:** stale anchors updated.
- **PS-7:** the Fight lock masked the victory message; it is now gated on tactics remaining or Final Blow pending, and an AC is added.
- **PS-8:** the Waterfall heading added `PendingSeatChoicePrompt.vue` to the allowlist.
- **Lint §14:** ACs split to 10. **Lint §13:** exact commands.

**Scope verdict:** READY TO EXECUTE once WP-769 merges.

**Copilot (01.7): RISK.** Resolved.

**Pre-flight / Copilot CONFIRM (independent subagent)**: **CONFIRM**, ready once WP-769 merges.
