# EC-515 — Wire the Reorder-Choice Gate into TurnActionBar (Execution Checklist)

**Source:** docs/ai/work-packets/WP-480-turnactionbar-reorder-gate.md
**Layer:** arena-client (single app; lightweight lane)

## Before Starting
- [ ] On `origin/main` ≥ WP-479 (#1137) merged; EC-515 reserved in the ledger.
- [ ] `pnpm --filter @legendary-arena/arena-client test typecheck` exit 0 (baseline).
- [ ] Re-read the WP-476 discard gate in `useTurnActions.ts` + WP-477 `TurnActionBar` wiring as the template.

## Locked Values (do not re-derive)
- Gate reason (new locked copy): **"Choose the order to put the cards back on top before taking another action."**
- `hasPendingReorderChoice` derives from `UIState.pendingReorderChoice !== undefined`.
- `useTurnActions` param position: **17** (appended LAST, after `hasPendingDiscardChoice` at 16).
- Blocks `canEndTurn` + `canPassPriority` at ANY stage (mirrors `hasPendingDiscardChoice`); NOT in `canHealWounds`'s pending cluster (parity with discard).

## Guardrails
- **No engine change** — the engine block-all guard is authoritative; this is client button state only.
- **Positional-caller safety** — append the param LAST (position 17); do NOT reposition existing params (would churn every caller + the composable test).
- **Thread all three position-16-reaching calls** in `TurnActionBar` (`passPriorityGate`, `endTurnGate`, `healGate`) to position 17, so the arg list is well-formed; `canHealWounds` receives it positionally but does not read it (parity with discard).
- **Reuse the projection** — `pendingReorderChoice` already ships from WP-479; do not touch the engine, the UIState projection, or `PendingReorderChoicePrompt.vue`.
- No new D-entry (UX parity; the mechanic + decision are D-24286).

## Required `// why:` Comments
- The `useTurnActions` param + both gate blocks: cite WP-480 / D-24286; mirror the discard gate's rationale.
- The `TurnActionBar` prop + the position-17 threading: cite WP-480; note the slot.
- The play-page computed: cite WP-480 / D-24286; derived from `UIState.pendingReorderChoice`.

## Files to Produce
- `apps/arena-client/src/composables/useTurnActions.ts` — param (pos 17) + `canEndTurn`/`canPassPriority` gate.
- `apps/arena-client/src/composables/useTurnActions.test.ts` — gate test (both gates, every stage, locked reason).
- `apps/arena-client/src/components/play/TurnActionBar.vue` — prop + thread to the three calls.
- `apps/arena-client/src/pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — computed + prop pass-through.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` exit 0; `pnpm -r build` exit 0.
- [ ] WORK_INDEX `[x]` + date; EC_INDEX EC-515 → Done; MINDMAP node ✅ + `roadmap:counts:write` + `:check` green.
- [ ] Live-on-surface (D-24026, operator-pending): play Amazing Spider-Man with a ≥2 remainder → End-Turn/Pass-Priority disable with the reorder tooltip.

## Common Failure Smells
- The buttons stay enabled while a reorder is pending → the prop isn't threaded to position 17, or the page computed isn't passed.
- typecheck fails on a positional arg count → a `useTurnActions` caller wasn't extended to the new last slot.
- A different pending choice's reason shows for the reorder → the gate block was inserted in the wrong precedence order (must follow the discard block).
