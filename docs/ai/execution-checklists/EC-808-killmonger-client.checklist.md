# EC-808 — Killmonger client (Execution Checklist)

**Source:** docs/ai/work-packets/WP-771-killmonger-client.md
**Layer:** App (arena-client)
**Reconciled:** 2026-11-17 against WP-769 as shipped (`c328925b8`).
**Risk Tier:** MEDIUM — ranked integrity: until this ships a human-only Killmonger match can take no Tactic; client-only, no engine or contract change.

## Before Starting
- [ ] WP-769 is merged: `UIMastermindState.woundCount?` / `woundable?` exist, `woundMastermind`, `KILLMONGER_ATTACK_LOCK_REASON` are exported from `@legendary-arena/game-engine`. If not, STOP.
- [ ] Rebase onto any merged WP-770 `MastermindTile` change. Keep every branch.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail.
- [ ] Scope lock: only the 7 files in Files to Produce plus the governance close change; anything else is a blocker.

## Locked Values (do not re-derive)
- **Client move name:** `'woundMastermind'`, payload `{}`. Add it to `uiMoveName.types.ts`.
- **Stage predicate:** `canWoundMastermind()` in `useTurnActions.ts` (explicit return type + returned object): not your turn → `It is not your turn.`; stage ≠ `main` → the shared stage reason (`Only available during the Main (Play / Recruit / Fight) step (current: <stage>).`); else allowed. **No heal lock.**
- **Fight-lock ordering:** in `gateForFight`, after the stage gate and heal lock, before the cost gate: `if (mastermind.fortifiedReason === KILLMONGER_ATTACK_LOCK_REASON) return { allowed: false, reason: mastermind.fortifiedReason }`. The constant is imported from `@legendary-arena/game-engine`. Every other `fortifiedReason` keeps its existing slot. `showEvFight` inherits it.
- **Fight-cost badge:** `isFightCostUnaffordable()` returns false while `fortifiedReason === KILLMONGER_ATTACK_LOCK_REASON` (after its stage and heal checks).
- **Precedence comments:** rewrite all three — the header JSDoc `MastermindTile.vue:36-42`, `gateForFight` `:201-204`, the template comment `:395-398` — to state the Killmonger exception (authority: D-24602 follow-ups, "the cost-before-lock tile order").
- **Click path:** `onWound()` calls `props.submitMove('woundMastermind', {})` directly — no Enigma picker, no `useExcessiveViolence`.
- **Placement:** badge right after the Haunting badge; Wound button right after `<FortifiedVillains>`, before the EV button; row layout via `.mastermind-tile .mastermind-wound` (0,2,0, strictly outranks `.mastermind-tile button`) with `flex-direction: row; align-items: center; font-size: 0.7rem; max-width: 9rem` (the label wraps; the tile never widens past its EV-button width).
- **Wound button:** test id `play-mastermind-wound`; shown iff `mastermind.woundable === true && !isGameOver`; text `` `Wound him — spend ${cost} → +1 Recruit` `` with `CrossedSwordsIcon` before it (`cost` = `mastermindFightCost()`).
  - `gateForWound()`: `canWoundMastermind()` → `useCardCostGating(economy).canFight(cost, 'mastermind')` ("Needs X attack, you have Y.").
  - Enabled `title`: `Spend Attack equal to Killmonger's Attack to put a Wound on him (−1 Attack) and get +1 Recruit. Wounding is not a fight.`; disabled `title` = the gate reason.
- **Badge:** test id `play-mastermind-wounds`, `data-count` = `woundCount`, text `` `Wounds: ${woundCount}` ``; shown iff `woundCount !== undefined && !isVanquished()`; `isVanquished()` is a new helper independent of `isGameOver` (`tacticsRemaining === 0 && finalBlowPending !== true`) — never reuse `isVictoryAssured()`.
- **Waterfall heading:** `PendingSeatChoicePrompt.vue` shows `Throw from the Waterfall — choose a card to discard` for kind `killmonger-waterfall-discard`.

## Guardrails
- The engine is the authority on Wound availability (`woundable`). The client never tests the Mastermind id, the Wound Stack, the KO pile or the tactics count for availability.
- If `woundable`, `woundCount` and the Killmonger reason are absent, MastermindTile renders as today; existing tests stay unedited (new `describe` blocks only).
- Never a client copy of the Killmonger lock string; never a Unicode attack glyph.
- The Wound button and badge sit in normal flow beside the Fight button; fit the 1280×720 mat and PlayMobile.
- Keep `mastermind-tile--fortified` keyed on any `fortifiedReason`; the stand-up lift must stay off while the Wound button shows.
- Pending choices keep Fight parity: the tile has no pending-choice props; the engine refuses a Wound click while one is open. Do not add pending props (out of scope).
- A guard reason (Colleen Wing / The Blob) winning over Killmonger's lock keeps the existing order (cost first). Do not key the reorder on `woundable`.

## Required `// why:` Comments
- The Killmonger lock ahead of the cost gate: his lock refuses the fight at any attack (D-24602), so "Needs N attack" would be false advice.
- No heal lock on Wound: wounding is not a fight (rules v23 L2240-2244; D-24602).
- Wound cost = `fightCost`: equal to the engine's charge for Killmonger (no Size-Changing on his card).
- The badge never goes loud under the Killmonger lock: the lock, not attack, refuses the fight.
- `onWound` skips the Enigma picker: wounding is not a fight (D-24602).
- Badge hidden once vanquished: `woundCount` persists after the Final Blow award.
- `CrossedSwordsIcon`: font-independent.

## Files to Produce
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified**: Wound button, Wounds badge, Killmonger lock ahead of the cost gate.
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified**: a new `describe` for ACs 1-9 (10 tests; AC 2 is two).
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**: add `'woundMastermind'`.
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — **modified**: the Waterfall heading case.
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts` — **modified**: one heading test (AC 11).
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified**: `canWoundMastermind` in the return type and object, and `canWoundMastermind` → `woundMastermind` at `play.main` (WP-771) in the JSDoc predicate list (`:99-109`).
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified**: a new `describe` for AC 10.
- Governance close: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`, the 01.6 post-mortem, the WP — **modified / new**

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` → 0 fail (every package's totals pasted); arena-client 2732 → 2745 (13 new tests).
- [ ] Revert proofs (WP Verification 2, a-e) run and restored.
- [ ] DECISIONS: none (consumes D-24602).
- [ ] Preview drive with screenshots at 1280×720 and on mobile; confirm the tile is no wider with the Wound button than with the EV button.
- [ ] STATUS; WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write` (`:check` 0); NUMBER-LEDGER LANDED; pending `live-verify.json` row; 01.6 post-mortem.
- [ ] Allowlist-only diff. Two-commit topology (`EC-808:` then `SPEC:`).
- [ ] Live-verify (D-24026) after merge + deploy, as its own `SPEC:` PR.

## Common Failure Smells
- A short player sees "Needs 5 attack" on Killmonger's Fight → the Killmonger arm sits after the cost gate.
- The Wound button submits but nothing happens → wrong move name, or `uiMoveName` is missing the entry.
- The Wound button is disabled after Healing → the heal lock was wrongly applied.
- The badge still shows after the Final Blow win → the vanquished check is missing, or reuses `isVictoryAssured()` (false once the game is over).
- "Fight 4" turns red while Killmonger is locked → `isFightCostUnaffordable` lacks the Killmonger exemption.
- The Wound label stacks under its icon → the row-layout selector is below (0,1,1).
- A Wound click during the Waterfall discard does nothing → expected (Fight parity; the engine refuses while a choice is pending). Not a bug.
- A Colleen Wing test changes its tooltip → the Killmonger arm matched every `fortifiedReason`.
