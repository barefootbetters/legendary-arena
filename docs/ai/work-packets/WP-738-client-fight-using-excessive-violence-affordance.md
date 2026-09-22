# WP-738 — Client "Fight using Excessive Violence" affordance (arena-client)

**Status:** Ready
**Primary Layer:** App / arena-client
**User-Visible Surface:** `play.legendary-arena.com`
**Dependencies:** WP-739 / D-24560 (the `economy.excessiveViolenceAvailable` UIState signal this consumes — HARD dep, must land first), WP-736 / D-24557 (the `useExcessiveViolence?` fight-move arg this submits), WP-128 (the `economy` projection + `submitMove` plumbing), WP-581 / D-24390 (the `recruitSpendableAsAttack` client cue — the "render an economy flag as a UI cue" precedent)
**Lane:** Standard (two-session). Not lightweight-eligible: touches multiple client components + a shared fight-submission path, and closes a D-24026 live-verify obligation.

> Baseline: `origin/main` after WP-739 has merged (this WP is BLOCKED until the `economy.excessiveViolenceAvailable` field is on `main`).

---

## Goal

After this session, a player on `play.legendary-arena.com` can choose to fight a Villain or the Mastermind **using Excessive Violence** — spending 1 extra attack to fire every Excessive Violence ability on the cards they played this turn. The control appears only when it would do something: the engine reports `economy.excessiveViolenceAvailable` (WP-739) AND the player can afford the target's fight cost + 1. Choosing it submits the existing `fightVillain` / `fightMastermind` move with `{ useExcessiveViolence: true }` (the WP-736 arg); a normal fight is unchanged. This closes the WP-736 D-24026 fire-payoff live-verify (per D-24557 §A) — the payoff finally has a live trigger.

---

## User-Visible Impact

Today a Venom/Carnage/Venompool player who has played an Excessive Violence card this turn has **no way** to actually use it — the engine accepts the opt-in but nothing on the play surface sends it. After this WP, when EV is available they see a clear "Fight using Excessive Violence" control (armed-then-fight), and taking a fight with it on draws the card / gains +2 Recruit / opens the KO-from-hand choice / rescues a Bystander per the EV cards in play — the mechanic as printed, finally reachable by a human.

---

## Assumes

- **WP-739 shipped** — `UIState.economy.excessiveViolenceAvailable?: boolean` is projected (active-player-only, present only when the player has ≥1 enrolled EV card this turn AND has not used EV). This WP READS it; if it is absent the affordance is hidden.
- **WP-736 shipped** — `fightVillain` / `fightMastermind` accept an optional `useExcessiveViolence?: boolean`; when true + affordable + not-yet-used the engine overspends +1 and fires the enrolled EV abilities; otherwise it silently fights normally. The engine is the sole authority — the client gate is a UX convenience, never a rule.
- **The client fight seam** — `apps/arena-client/src/components/play/CityRow.vue` fights a villain via `submitMove('fightVillain', { cityIndex })` (`onFight`, ~line 101); `MastermindTile.vue` fights via `submitMove('fightMastermind', {})` (~line 114). `useTurnActions` gates stage; `useCardCostGating(props.economy)` gates affordability. `props.economy` is the `UITurnEconomyState` (carries `availableAttack` + now `excessiveViolenceAvailable`).
- **`submitMove(name, args)`** passes an arbitrary args object to the engine move; the fight moves already destructure `useExcessiveViolence`. Confirm the client's move-name/args typing (`uiMoveName.types.ts` + the submit signature) accepts the extra field, and widen it minimally if needed.
- `pnpm --filter arena-client build && … test` green on baseline; the play surface renders.

If WP-739 is not on `main`, this packet is **BLOCKED** — do not stub the field.

---

## Context (Read First)

- `apps/arena-client/src/components/play/CityRow.vue` (~90-115) — `gateForCell` (stage + cost gating), `onFight(cityIndex)`; the villain fight seam.
- `apps/arena-client/src/components/play/MastermindTile.vue` (~100-115) — the mastermind fight seam.
- `apps/arena-client/src/composables/useTurnActions.ts` (~304 `canFightVillain`, ~326 `canFightMastermind`) — stage gating; kept free of economy inputs (economy gating is separate).
- `apps/arena-client/src/composables/*CardCostGating*` — the affordability-gating precedent (reuse its shape for the `cost + 1` EV check).
- The `recruitSpendableAsAttack` client cue (grep arena-client) — the "read an omit-when-absent economy flag and render a cue" precedent.
- `.claude/rules/architecture.md §Layer Boundary` + §Engine Owns Truth — clients submit intent, never outcomes; UI consumes read-only projections; no client-side rule execution.
- User memory: `feedback_verify_cross_surface_link_landing` (unit → 200 → renders → DRIVE the surface), `reference_clipboard_verify_and_preview_block` (the bottom-left fixed-pill stack collides silently — mind placement), `project_arena_client_uistate_backfill_recurrence`.

---

## Non-Negotiable Constraints

- Full file contents for every changed file; the arena-client conventions (Vue SFC, TypeScript, the existing composable/component patterns); `// why:` on the EV gate + the submit.
- **Engine stays the sole authority (Architecture — Engine Owns Truth).** The client gate (`excessiveViolenceAvailable` + affordability) decides only whether to SHOW/ENABLE the control and whether to send `useExcessiveViolence: true`. It performs NO rule execution and NO reconciliation — if the client were wrong, the engine still validates and silently declines. No client-side EV logic beyond reading the two projected numbers.
- **Default fight is byte-identical.** A normal fight click still calls `submitMove('fightVillain', { cityIndex })` / `submitMove('fightMastermind', {})` with NO `useExcessiveViolence` key. Existing fight tests + behavior are unchanged.
- **Gated visibility.** The EV control is hidden/disabled unless `economy.excessiveViolenceAvailable === true` AND the player can afford the target's fight cost + 1 (`availableAttack >= requiredCost + 1`, using the same cost source the normal fight gate uses). When `excessiveViolenceAvailable` is absent (the omit-when-absent field), treat as false.
- **Once-per-turn is the engine's job, reflected by the field.** After a successful EV fight the engine sets `excessiveViolenceUsedThisTurn`, so WP-739's field flips to absent and the control disappears on the next projection — the client does not track "used" itself.
- **No new UIState field, no engine change.** This WP consumes WP-739's projection only.
- **NG-safe.** No pay-to-win, no cosmetic-for-outcome, no monetization surface — the control is a pure gameplay affordance available to any player who played an EV card.
- Placement must not collide with the known bottom-left fixed-pill stack (`reference_clipboard_verify_and_preview_block`); choose a non-overlapping anchor near the fight target or the turn-action area.

---

## Scope (In)

- A "Fight using Excessive Violence" control in the fight UI. **Locked design:** an **arm-then-fight** affordance — a toggle/cue shown only when `economy.excessiveViolenceAvailable === true`; while armed, the next `fightVillain` / `fightMastermind` submits `{ …, useExcessiveViolence: true }`; it auto-disarms after a fight submission and whenever the signal clears. A per-target affordability hint (disabled/greyed when no fightable enemy meets `cost + 1`). The executor MAY refine the exact affordance (a per-target secondary action instead of a turn toggle) provided the locked BEHAVIOUR above holds; if they diverge, note it as an EC amendment.
- The gating helper: extend/reuse the affordability gate for the `cost + 1` EV check, reading `economy.availableAttack` + the target's fight cost (the same source `canFight` uses).
- Wire `useExcessiveViolence: true` into the `submitMove` call for both fight seams (CityRow + MastermindTile) when the EV control is armed; widen the move-args typing minimally if the client types reject the extra field.
- Component/composable unit tests: control hidden when `excessiveViolenceAvailable` absent/false; shown when true + affordable; hidden when true but unaffordable; a normal fight sends no `useExcessiveViolence`; an armed EV fight sends `useExcessiveViolence: true`; disarms after submit.

## Out of Scope

- Any engine change (the field + the move arg already exist).
- A bot heuristic to auto-use EV (bots keep fighting normally).
- Surfacing WHICH EV cards will fire, or a preview of the effects (a possible later polish; this WP ships the trigger).
- Animations / SFX for the EV fire beyond what the existing fight/notable-event pipeline already emits.
- Scoring / identity / monetization surface.

---

## Files Expected to Change

- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — arm-aware `onFight` submits `useExcessiveViolence` when armed
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — same for the mastermind fight
- the EV control component/composable — **new or modified** — the arm-then-fight toggle + its `excessiveViolenceAvailable`/affordability gate (exact file per the executor's placement, inside `apps/arena-client/src/components/play/**` or `composables/**`)
- the affordability gating composable (`*CardCostGating*` or a sibling) — **modified** — the `cost + 1` EV check
- the corresponding `*.test.ts` files — **modified/new** — the gating + submit tests
- (NOT needed — noted so it isn't attempted) the move-args typing: `SubmitMove`'s `args` is already `unknown` (`uiMoveName.types.ts`), and `fightVillain`/`fightMastermind` are already in `UiMoveName`, so submitting the extra `useExcessiveViolence` key needs NO typing change. Do not touch `uiMoveName.types.ts`.

(**Freeze the allowlist at placement-choice time** — the moment the executor picks where the control lives, record the exact file list and treat it as locked for the `git diff --name-only` DoD. It stays within `apps/arena-client/**`; NO engine files.)
- **Affordability cost source (locked):** the `cost + 1` gate reads the SAME source the normal fight gate uses — `useCardCostGating(economy).canFight(display)` on `display.cost` (villain: the City card's `display.cost`; mastermind: `mastermind.display.cost`, `MastermindTile.vue:95`). Do NOT re-derive the fight cost (e.g. hand-rolling `darkPortalBonus`) — reuse `canFight`'s source so the EV gate matches the normal gate exactly and the engine stays authoritative.

---

## Contract

- The EV control is visible/enabled iff `uiState.economy.excessiveViolenceAvailable === true` AND at least one fightable target satisfies `economy.availableAttack >= targetFightCost + 1`.
- Armed + fighting a target → `submitMove('fightVillain', { cityIndex, useExcessiveViolence: true })` or `submitMove('fightMastermind', { useExcessiveViolence: true })`. Disarmed/normal → the existing calls with no such key.
- The control auto-disarms after any fight submission and whenever `excessiveViolenceAvailable` becomes absent/false.
- The engine remains authoritative: a stale/incorrect client arm results in the engine silently fighting normally (never an error, never a client-applied effect).

---

## Acceptance Criteria

1. When `economy.excessiveViolenceAvailable` is absent or false, the EV control is not shown/enabled and every fight submits with NO `useExcessiveViolence` key (byte-identical to today).
2. When `excessiveViolenceAvailable === true` AND a fightable target meets `cost + 1`, the EV control is shown/enabled.
3. When `excessiveViolenceAvailable === true` but no target meets `cost + 1`, the control is present-but-disabled (or hidden) with an affordability hint — never armable into a fight the engine would decline.
4. Arming the control and fighting a City villain submits `fightVillain` with `useExcessiveViolence: true` and the correct `cityIndex`; arming + fighting the Mastermind submits `fightMastermind` with `useExcessiveViolence: true`.
5. The control auto-disarms after a fight submission; after a successful EV fight the next projection has `excessiveViolenceAvailable` absent (engine set `used`), so the control disappears.
6. A normal (unarmed) fight is unchanged — existing CityRow/MastermindTile fight tests pass unmodified.
7. `pnpm --filter arena-client build && … test` green (+ the new gating/submit tests); no engine files in `git diff`.

---

## Verification Steps

1. `pnpm --filter arena-client build` → 0; `… test` → all pass (+ new tests).
2. **Drive the play surface AS A SEATED HUMAN — not a hands-off bot** (`feedback_verify_cross_surface_link_landing`, `reference_autoplay_setupdata_live_verify`). `setupData` / autoplay is used ONLY to bootstrap a match with a vnom loadout; a hands-off autoplay bot **cannot arm Excessive Violence** (that is exactly why WP-736 deferred this payoff), so the verification is an OPERATOR-MANUAL action: join a seat (`?match=<id>&player=0&credentials=…`), play an EV card, confirm the control appears, arm it, fight, and confirm the EV ability fires (log via `component.setupState.snapshot.log` / the notable-event overlay) and the extra attack was spent; confirm the control vanishes afterward (once-per-turn). This is the **WP-736 D-24026 fire-payoff live-verify** — record it against the deployed `/api/version` gitSha.
3. Confirm a non-EV turn shows no control and normal fights are unchanged; confirm placement doesn't collide with the bottom-left pill stack.

---

## Vision Alignment

**Clauses touched:** §1/§2 (client submits intent; UI consumes read-only projections; engine owns truth), §10 (faithful card behavior reachable).
**Conflict assertion:** none — this exposes an already-shipped, already-authoritative mechanic to the player; it adds no rule and moves no authority to the client.
**Non-Goal check:** NG-safe — no pay-to-win (the overspend is an in-game attack cost available to anyone who played an EV card), no cosmetic-for-outcome, no monetization/persuasion surface.
**Determinism:** client-only; the engine remains the deterministic authority; the client sends intent (`useExcessiveViolence`), never an outcome.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved. §1 structure present; §2 constraints (full files, engine-authority, default-fight-unchanged); §3 assumes (WP-739 field, WP-736 arg, the fight seam, submitMove); §4 context (exact components/composables, the layer rules, memories); §5 files (arena-client allowlist, no engine files); §6 naming (`excessiveViolenceAvailable`, `useExcessiveViolence` — match the engine); §7 no new deps; §8 boundaries (App layer only; no engine change; no client-side rule execution — the load-bearing Engine-Owns-Truth check); §9 pnpm; §10/§11 N/A; §12 arena-client test runner; §13 verification incl. the live-verify; §14 seven binary AC; §15 DoD (STATUS/DECISIONS/indices + surface + D-24026 live-verify — the one it CLOSES); §16 client code style; §17 triggered (UI-surface + authority boundary) — Vision Alignment present; §18 no forbidden-token prose; §19 baseline cited (post-WP-739); §20 N/A funding; §21 N/A (no server endpoint). **Verdict: PASS/justified-N/A.**

## Pre-flight (01.4)

Independent gate subagent, verified against live source (execute only after WP-739 lands). All twelve facts TRUE: both fight seams + `submitMove` calls are as claimed (`CityRow.vue:102`, `MastermindTile.vue:121`); both engine moves accept `useExcessiveViolence` on main (`fightVillain.ts:95/109/243`, `fightMastermind.ts:82/116/238`); `props.economy` + `useCardCostGating(economy).canFight(display)` give the client `availableAttack`/`display.cost` for the `cost + 1` gate on BOTH seams; `SubmitMove.args` is `unknown` (`uiMoveName.types.ts:148`) so the extra field needs NO typing change; the hard-dep no-stub ordering is correct; and the D-24026 live-verify is honest that arming + fighting is operator-manual (not a hands-off autoplay). **RS folded in:** Verification Step 2 + DoD now state the seated-operator drive explicitly; the `cost + 1` gate is pinned to `canFight`'s `display.cost` source (the mastermind `darkPortalBonus` nuance). **Verdict: READY TO EXECUTE** (after WP-739 on main).

## Copilot (01.7)

Independent gate subagent (30-mode). Load-bearing architecture sound and locked: Engine-Owns-Truth with a real server-side silent-decline (`fightVillain.ts:242`), default-fight byte-identical, once-per-turn reflected by the field (not self-tracked), the `cost + 1` gate an exact mirror of the engine's `getSpendableAttack >= requiredFightCost + 1`, a hard no-stub dep on WP-739, NG-safe, no type-widening. **HOLDs (folded in):** (1) the CRUX — the D-24026 live-verify was framed around the autoplay path (bots can't arm EV, repeating WP-736's over-claim); now rewritten to require a seated operator, autoplay = loadout bootstrap only. (2) freeze the deferred file allowlist at placement time (now an explicit §Files gate). **Verdict: RISK → PASS after the HOLDs (applied).**

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the arena-client allowlist only (no engine files).
- [ ] `docs/ai/STATUS.md` updated; D-24561 Active in `DECISIONS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] No files outside `apps/arena-client/**` modified.
- [ ] **D-24026 live-verify (post-merge, REQUIRED — this is the one that closes WP-736's deferred payoff):** OPERATOR-MANUAL on `play.legendary-arena.com` — join a seat (a hands-off autoplay bot cannot arm EV; `setupData` only bootstraps the loadout), play an EV card, arm the control, and fight — the EV ability fires and the extra attack is spent, verified against the deployed `/api/version` gitSha. Recorded as a follow-up STATUS-flip on BOTH WP-738 and WP-736 (this is the box WP-736's disposition deferred here).
