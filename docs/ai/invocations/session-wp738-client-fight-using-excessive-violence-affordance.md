# Session Prompt — WP-738 / EC-775: Client "Fight using Excessive Violence" affordance

**WP:** docs/ai/work-packets/WP-738-client-fight-using-excessive-violence-affordance.md
**EC:** docs/ai/execution-checklists/EC-775-client-fight-using-excessive-violence-affordance.checklist.md (authoritative)
**Reserves:** D-24561 (lands Active at govern-close). **Status:** READY TO EXECUTE (pre-flight READY; copilot PASS after the live-verify HOLD) — **but BLOCKED until WP-739's `economy.excessiveViolenceAvailable` is on `main`.**

> Committed via `git add -f` (session-*.md is gitignored). Second half of the paired client-EV arc; CLOSES the WP-736 D-24026 fire-payoff (per D-24557 §A).

## Invocation intent

Give the player a way to actually fight "using Excessive Violence." Add an arm-then-fight control that submits `fightVillain`/`fightMastermind` with `{ useExcessiveViolence: true }` (the WP-736 arg), shown/enabled only when the WP-739 `economy.excessiveViolenceAvailable` signal is true AND the player can afford the target's fight cost + 1. arena-client only; the engine already exists and stays the sole authority.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md §Layer Boundary` + §Engine Owns Truth (clients submit intent; UI consumes read-only projections; NO client-side rule execution)
3. WP-738 (design) → EC-775 (execution contract)
4. Source anchors (verified by pre-flight): `components/play/CityRow.vue:102` (`submitMove('fightVillain', { cityIndex })`), `MastermindTile.vue:121` (`fightMastermind`) + `:95` (`useCardCostGating(props.economy).canFight(props.mastermind.display)`), `composables/useCardCostGating.ts:80-98` (`availableAttack` vs `display.cost`), `uiMoveName.types.ts:148` (`SubmitMove.args: unknown` — no typing change needed), engine `moves/fightVillain.ts:243` / `fightMastermind.ts:238` (the arg + the server-side silent-decline)
5. User memory: `feedback_verify_cross_surface_link_landing`, `reference_autoplay_setupdata_live_verify`, `reference_clipboard_verify_and_preview_block` (bottom-left pill-stack collision)

## Pre-execution checks

- **HARD GATE:** `git show origin/main:packages/game-engine/src/ui/uiState.types.ts | grep excessiveViolenceAvailable` — if absent, STOP (WP-739 not landed; do NOT stub the field).
- `pnpm --filter arena-client build && … test` green; the play surface renders.

## Execution rules (operationalizing WP-738 + EC-775 — no new scope)

- **Control:** arm-then-fight — shown only when `uiState.economy.excessiveViolenceAvailable === true` (absent = false); while armed the next `fightVillain`/`fightMastermind` submits `{ …, useExcessiveViolence: true }`; auto-disarms after a fight submission and whenever the signal clears. (Executor MAY substitute a per-target action if the BEHAVIOUR holds — note divergence as an EC amendment.)
- **Affordability (locked source):** `useCardCostGating(economy).canFight(display)` on `display.cost` (villain City card; mastermind `mastermind.display.cost` `:95`), gate `availableAttack >= display.cost + 1`. Do NOT re-derive the cost (no hand-rolled `darkPortalBonus`) — reuse `canFight`'s source so the client gate mirrors the engine's `getSpendableAttack >= requiredFightCost + 1` exactly.
- **Submit:** wire `useExcessiveViolence: true` into the CityRow + MastermindTile `submitMove` calls when armed; NO `uiMoveName.types.ts` change (`args` is `unknown`). A normal/unarmed fight sends NO such key (byte-identical to today).
- **Engine is sole authority:** the client gate is a UX convenience only — no client-side rule execution/reconciliation; a wrong arm → the engine silently fights normally. Once-per-turn is engine-enforced and reflected by the field going absent — do NOT self-track "used."
- **Placement:** avoid the bottom-left fixed-pill stack; anchor near the fight target / turn-action area.
- **Freeze the file allowlist** the moment placement is chosen; `git diff --name-only` ⊆ `apps/arena-client/**` (NO engine files).
- Tests: control hidden when signal absent/false; shown when true + affordable; hidden/disabled when true but unaffordable; unarmed fight sends no arg; armed EV fight sends the arg; disarms after submit.

## SAFE-KNOBS scope

N/A.

## Session task

Execute WP-738 per EC-775 (only after WP-739 on main). Two-commit topology: `EC-775:` impl, then `SPEC:` govern-close (land D-24561 Active; WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, `roadmap:counts:write`, `ledger:numbers:check`; STATUS.md). One PR. **D-24026 live-verify (REQUIRED, OPERATOR-MANUAL, post-deploy):** join a SEATED session (`?match=<id>&player=0&credentials=…`; a hands-off bot cannot arm EV — `setupData` bootstraps the loadout only), play an EV card, arm, fight — the EV ability fires + the extra attack is spent + the control vanishes after. This closes WP-736's deferred payoff — STATUS-flip BOTH WP-738 and WP-736.

## Post-merge close ritual (REQUIRED)

After merge: `--verify-current` (expect `VERIFY PASS`) → `git branch -D <branch>` + `git push origin --delete <branch>` → `--report` from canonical (silent).

## Scope restriction

Restates/operationalizes WP-738 + EC-775 only. No new scope/files/contract/locked-values/forbidden-patterns.
