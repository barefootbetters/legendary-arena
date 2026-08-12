# EC-565 — Heal-Wounds Button Pending-Choice Gate Parity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-530-heal-button-pending-choice-gate-parity.md
**Layer:** App (`apps/arena-client`) — one WP, LIGHTWEIGHT LANE (D-24028), two-commit topology

## Before Starting
- [ ] Enumerate the EXACT target file set (= WP §5); any edit outside it is a FAIL
- [ ] Read `packages/game-engine/src/moves/healWounds.ts` — the block-all guard list (11 predicates) this client gate MUST mirror exactly
- [ ] Read `apps/arena-client/src/composables/useTurnActions.ts` `canHealWounds` — note it checked only 6 of the 11 and that all 5 missing params are already declared in the signature
- [ ] Scaffold-first (REQUIRED, gate-tightening): baseline `useTurnActions.test.ts` + `TurnActionBar.test.ts` green BEFORE the change; record the count
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (clean baseline)

## Locked Values (do not re-derive)
- The engine `healWounds` block-all set is **11** predicates: `pendingKoHeroChoice`, `pendingScryKoChoice`, `pendingDiscardChoice`, `pendingReorderChoice`, `pendingDefeatChoice`, `pendingOptionalKoReward`, `pendingVictoryPileCardPick`, `pendingDrawOrEmpowered`, `pendingReturnZeroCostDiscard`, `pendingDiscardToPlay`, `pendingReturnOnDiscard`. `canHealWounds` must OR **all eleven**.
- The five previously-MISSING client guards: `hasPendingDiscardToPlay` (D-24184), `hasPendingDiscardChoice` (D-24284), `hasPendingReorderChoice` (D-24286), `hasPendingDefeatChoice` (D-24291), `hasPendingReturnOnDiscard` (D-24301).
- Blocked reason string is unchanged: `"Resolve the pending choice before you can heal."`
- `useTurnActions` positional map — `hasPendingReturnOnDiscard` is **position 19** (the last param); `healGate()` previously stopped at position 18.
- `healWounds` does NOT guard `pendingOptionalPutBottomHQ` / `pendingPutAnyNumberBottomHQ`; the client mirrors the engine's ACTUAL set — do **not** add those to `canHealWounds`.

## Guardrails
- **The engine `healWounds` move MUST NOT be edited** — client-gate parity fix only.
- **No `useTurnActions` signature change** — all five params already exist; only the `canHealWounds` body (add the OR clauses) and the `healGate()` call site (thread param 19) change.
- No new pending-choice type, no new prop, no contract file, no `DECISIONS.md` entry, no `finalStateHash` / determinism / persistence surface.
- `git diff --name-only` (impl commit) == exactly `useTurnActions.ts` + `TurnActionBar.vue` + `useTurnActions.test.ts` + `TurnActionBar.test.ts`.
- Two-commit topology: `EC-565:` implementation + `SPEC:` govern-close.

## Required `// why:` Comments
- `useTurnActions.ts` at the `canHealWounds` pending cluster: why the set MUST mirror the engine `healWounds` guards exactly (a live-but-dead click otherwise), naming the five restored guards + their D-entries.
- `TurnActionBar.vue` at `healGate()`: why `hasPendingReturnOnDiscard` (position 19) must be threaded — it was a declared-but-unpassed prop, so `canHealWounds` could not see it.

## Files to Produce
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — 5 guards added to `canHealWounds`; stale comment corrected
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — `healGate()` threads `hasPendingReturnOnDiscard` (pos 19)
- `apps/arena-client/src/composables/useTurnActions.test.ts` — **modified** — +5 parity cases (one per newly-guarded pending choice)
- `apps/arena-client/src/components/play/TurnActionBar.test.ts` — **modified** — +1 wiring case (button disabled + no emit while `hasPendingReturnOnDiscard`)
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅` + `roadmap:counts:write`). `NUMBER-LEDGER.md` reserved same SPEC (sole session). No `DECISIONS.md` in the diff.

## After Completing
- [ ] `apps/arena-client` full suite green (incl. the 6 new cases)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm -r build && pnpm -r --no-bail test` green
- [ ] `git diff --name-only` (impl) = the four app files (only)
- [ ] Live-on-surface (D-24026): `play.legendary-arena.com` — Heal button disables with the pending tooltip while a declinable choice is unresolved (was a dead click) — operator-pending until deploy
- [ ] `docs/ai/STATUS.md` updated
- [ ] `WORK_INDEX.md` checked off with date; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- Heal button still a dead click on the deployed page → a pending guard is missing from `canHealWounds`, or `healGate()` still stops at position 18 (never threads `hasPendingReturnOnDiscard`)
- The heal-after-playing-cards path regresses (button greys out after a normal card play) → a guard other than the 11 pending predicates crept in; `hasActedThisTurn` is set only by fight/recruit, not by `playCard`
- `pendingOptionalPutBottomHQ` / `pendingPutAnyNumberBottomHQ` appear in `canHealWounds` → over-mirroring; the engine `healWounds` does not guard them (out of scope)
- Signature edit to `useTurnActions` → unnecessary; all five params already exist
