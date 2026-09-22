# EC-775 — Client "Fight using Excessive Violence" affordance (Execution Checklist)

**Source:** docs/ai/work-packets/WP-738-client-fight-using-excessive-violence-affordance.md
**Layer:** App / arena-client

## Before Starting
- [ ] **HARD dep — WP-739 on `main`:** `UIState.economy.excessiveViolenceAvailable?: boolean` is projected (active-player-only, omit-when-absent). If not on `main`, STOP — this WP is BLOCKED; do NOT stub the field.
- [ ] WP-736 shipped: `fightVillain`/`fightMastermind` accept optional `useExcessiveViolence?: boolean`; the engine overspends +1 + fires EV when it's true + affordable + not-yet-used, else silently fights normally (sole authority).
- [ ] Fight seam: `CityRow.vue` `onFight` → `submitMove('fightVillain', { cityIndex })` (~101); `MastermindTile.vue` → `submitMove('fightMastermind', {})` (~114); `useTurnActions` (stage) + `useCardCostGating(props.economy)` (affordability); `props.economy` carries `availableAttack` + `excessiveViolenceAvailable`.
- [ ] `submitMove(name, args)` passes an arbitrary args object; confirm the client move-args typing accepts the optional `useExcessiveViolence` (widen minimally if not).
- [ ] `pnpm --filter arena-client build && … test` green; the play surface renders.
- [ ] Scope lock — target files ⊆ `apps/arena-client/**`; NO engine files. Anything else is a FAIL.

## Locked Values (do not re-derive)
- Field read: `uiState.economy.excessiveViolenceAvailable` — treat absent as false.
- Move arg sent: `useExcessiveViolence: true` (only when armed; never `false`).
- Visibility/enable gate: `excessiveViolenceAvailable === true` AND a fightable target meets `economy.availableAttack >= targetFightCost + 1`. Cost source LOCKED to `useCardCostGating(economy).canFight(display)` on `display.cost` (villain: City card `display.cost`; mastermind: `mastermind.display.cost`, `MastermindTile.vue:95`) — do NOT re-derive the fight cost (no hand-rolled `darkPortalBonus`); reuse `canFight`'s source so the EV gate matches the normal gate and the engine stays authoritative. This mirrors the engine gate `getSpendableAttack(turnEconomy) >= requiredFightCost + 1` exactly (`economy.availableAttack === getSpendableAttack`).
- Move-args typing: NO change — `SubmitMove.args` is `unknown` and both fight moves are already `UiMoveName`. Do NOT touch `uiMoveName.types.ts`.
- Freeze the exact file allowlist at placement-choice time; treat it as locked for the `git diff --name-only` DoD (within `apps/arena-client/**`, no engine files).
- UX (locked BEHAVIOUR; the arm-then-fight toggle is the specified form): shown only when available; while armed the next fight submits `useExcessiveViolence: true`; auto-disarms after a fight submission and whenever the signal clears. Executor MAY substitute a per-target secondary action if the behaviour holds — note any divergence as an EC amendment.

## Guardrails
- **Engine is the sole authority (Architecture — Engine Owns Truth).** The client gate decides only SHOW/ENABLE + whether to send the arg. NO client-side rule execution, NO reconciliation, NO EV logic beyond reading the two projected numbers. A wrong client arm → the engine silently fights normally (never an error, never a client-applied effect).
- **Default fight byte-identical.** An unarmed/normal fight submits with NO `useExcessiveViolence` key — existing CityRow/MastermindTile fight tests pass unmodified.
- **Gated visibility.** Hidden/disabled unless available AND affordable (`cost + 1`). Absent field = false.
- **Once-per-turn is the engine's, reflected by the field.** After a successful EV fight the engine sets `used` → WP-739's field goes absent → the control disappears on the next projection. The client does NOT track "used" itself.
- **No engine change, no new UIState field** — consume WP-739's projection only.
- **NG-safe** — no pay-to-win / cosmetic-for-outcome / monetization surface.
- **Placement** must not collide with the bottom-left fixed-pill stack (`reference_clipboard_verify_and_preview_block`); anchor near the fight target / turn-action area.

## Required `// why:` Comments
- The EV visibility/affordability gate: WP-738 / D-24561 — show only when `excessiveViolenceAvailable` AND affordable `cost + 1`; the engine still validates (client gate is a convenience, not a rule).
- The armed `submitMove(..., { useExcessiveViolence: true })`: WP-738 / D-24561 — client submits INTENT; the engine decides the outcome.
- The auto-disarm: WP-738 — once-per-turn is enforced engine-side; the field flips absent after use.

## Files to Produce
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — arm-aware villain fight submit
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — arm-aware mastermind fight submit
- the EV control component/composable — **new/modified** — the arm-then-fight toggle + its gate (placement per executor, within `apps/arena-client/src/components/play/**` or `composables/**`)
- the affordability composable (`*CardCostGating*` or sibling) — **modified** — the `cost + 1` EV check
- (conditional) the move-args typing (`uiMoveName.types.ts` / submit signature) — **modified** — accept optional `useExcessiveViolence`
- `*.test.ts` — **modified/new** — gating + submit + disarm tests

## After Completing
- [ ] `pnpm --filter arena-client build` 0; `… test` passes (+ gating/submit/disarm tests)
- [ ] `git diff --name-only` ⊆ `apps/arena-client/**` (NO engine files)
- [ ] **D-24026 live-verify (post-deploy, OPERATOR-MANUAL):** on `play.legendary-arena.com`, join a SEATED session (`?match=<id>&player=0&credentials=…`) — a hands-off autoplay bot CANNOT arm EV, so `setupData`/autoplay is loadout-bootstrap ONLY. Manually play an EV card → control appears → arm → fight → the EV ability fires + the extra attack is spent + the control vanishes after. This CLOSES WP-736's deferred fire-payoff — STATUS-flip BOTH WP-738 and WP-736 (`reference_autoplay_setupdata_live_verify`).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24561 (Active)
- [ ] WORK_INDEX WP-738 `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- The control shows on a non-EV turn → not reading `excessiveViolenceAvailable`, or not treating absent as false.
- A normal fight regressed (sends `useExcessiveViolence`) → the arm state leaked into the default path; unarmed must send NO key.
- The control stays after an EV fight → not reacting to the field going absent (don't self-track "used").
- The control is armable when unaffordable → the `cost + 1` affordability gate is missing.
- An engine file in the diff → this WP is arena-client-only; the field + arg already exist.
- Placement overlaps the bottom-left pill stack → re-anchor.
