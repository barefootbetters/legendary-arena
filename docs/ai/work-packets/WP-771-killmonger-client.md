# WP-771 — Killmonger client: "Wound him" button + wounds badge (Arena Client)

**Status:** Draft 2026-09-26; **reconciled + re-gated 2026-11-17** against WP-769 as shipped (#3434, merge `c328925b8`; live-verify PASS #3435, match `9QywYy_nmSv`). Ready to execute once this re-gate lands.
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:**
- **WP-769 / D-24602** ✅ (Done 2026-11-16, live-verified 2026-11-17)
- WP-750 / D-24574 ✅ (the projected Mastermind `fightCost`)
- WP-648 ✅ (the `recruitOfficer` client move-name precedent)
- WP-873 / D-24818 ✅ (the `fortifiedReason` Fight-lock arm in `gateForFight`)
- WP-129 / EC-132 ✅

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session).
**Risk Tier:** MEDIUM — ranked integrity: until this ships a human-only Killmonger match can take no Tactic; client-only, no engine or contract change.
**Arc:** 2 of 2 for Killmonger. Runs after WP-769.
**Decisions:** none of its own. Consumes D-24602 (no new D-number; `NUMBER-LEDGER.md` reserves only WP-771 / EC-808).

> Baseline: `origin/main` at `e3091635f` (WP-769 merged at `c328925b8`, live-verify at `ae7e3a542`).

---

## Goal

Until this ships, a human cannot Wound Killmonger, so a human-only Killmonger match can take no Tactic (WP-769 merged alone; bots and server autoplay wound him). When `snapshot.mastermind.woundable === true`, `MastermindTile` gains:

- **Wound button.** "Wound him — spend N → +1 Recruit" (N = `mastermind.fightCost`, with the `CrossedSwordsIcon`). It submits `woundMastermind` with `{}`, gated on viewer turn + `main` stage, then on spendable attack ≥ N.
- **Wounds badge.** "Wounds: n" while `mastermind.woundCount` is present and the Mastermind is not vanquished.
- **Lock reason first.** While Killmonger's attack lock holds, the disabled Fight button says the engine's lock reason, not "Needs N attack, you have M." (today the cost gate runs first and masks it).
- **Waterfall heading.** The `killmonger-waterfall-discard` seat choice gets its own heading instead of "Your choice".

## User-Visible Impact

- Humans can wound Killmonger down: each Wound costs his current Attack (5, 4, 3, 2, 1) and gives +1 Recruit, with a running Wound count. At 0 Attack the Fight button enables and he is fought for a Tactic.
- A short player sees why Fight is disabled (Killmonger's lock) instead of a misleading attack shortfall.

---

## Assumes

Verified on `e3091635f`. If any item is false, this packet is **BLOCKED**.

1. **WP-769 projection** (`packages/game-engine/src/ui/uiState.types.ts:843-869`, built at `ui/uiState.build.ts:1305-1326`, passed through `ui/uiState.filter.ts`):
   - `UIMastermindState.woundCount?: number` — present only while the Mastermind holds ≥ 1 Wound (any Mastermind). Wounds return to the Wound Stack after every Tactic, so the count resets per Tactic. It **persists after a Final Blow award** (the game is won), so this packet hides the badge once vanquished.
   - `UIMastermindState.woundable?: true` — present iff `canWoundMastermind(G, ctx.currentPlayer)` (`mastermind/killmonger.logic.ts`) passes: Killmonger leads, a Tactic or the Final Blow is left, his Attack (`resolveMastermindFightCost`) is > 0, and a Wound is in the KO pile or the Wound Stack. These are **board gates only**; it is not "is Killmonger" and it carries no attack / stage / pending-choice gate.
   - `UIMastermindState.fightCost` = `resolveMastermindFightPrice(G, ctx.currentPlayer)` (`:1305`).
   - Killmonger's lock rides `UIMastermindState.fortifiedReason` = `KILLMONGER_ATTACK_LOCK_REASON` ("Killmonger can't be fought while he has more than 0 Attack. Spend Attack equal to his Attack to Wound him and get +1 Recruit."), present while `isKillmongerLockShown` holds (locked and a Tactic or the Final Blow left) and no Villain guard reason wins (a guard reason wins when both apply, D-24818 / D-24773). Absent once he is vanquished, so it never masks the victory message.
2. **The move.** `woundMastermind()` takes no args (`moves/woundMastermind.ts`). It gates, in order: `canWoundMastermind`; `getSpendableAttackForTarget(G.turnEconomy, 'mastermind') ≥ resolveMastermindFightCost(G, currentPlayer)`; `G.currentStage === 'main'`; `!hasAnyPendingChoice(G)`. It does **not** check the Heal lock, Haunt, guard or Enigma locks: wounding "does not count as a Fight" (rules v23 L2240-2244).
3. **Engine exports** (`packages/game-engine/src/index.ts:172-173`): `woundMastermind`, `KILLMONGER_MASTERMIND_ID`, `KILLMONGER_ATTACK_LOCK_REASON` from the `.` runtime-safe surface, which `apps/arena-client` may import (architecture.md import table).
4. **Cost parity.** The engine charges `resolveMastermindFightCost`; the client shows and gates on `fightCost` (`resolveMastermindFightPrice` = the same value less a Size-Changing fight discount). The discount applies only when `G.fightSizeChanging[G.mastermind.baseCardId]` exists; Killmonger's card has no Size-Changing, so the two are equal for him. Using `fightCost` (the WP-750 single client cost source) is exact for Killmonger.
5. **MastermindTile anchors** (`apps/arena-client/src/components/play/MastermindTile.vue`): `mastermindFightCost()` `:166-172`; `gateForFight()` `:200-254` checks stage `:205` → heal lock `:209` → cost `:216` → Haunt `:224` → `fortifiedReason` `:234` → tactics / Final Blow `:237`; `isVictoryAssured()` `:298-306`; `showEvFight()` `:308-318` calls `gateForFight`; the EV button `:469-481` is the sibling-button precedent; `CrossedSwordsIcon` already imported (`:13`). The tile takes `isGameOver` (`:104-108`) from both `apps/arena-client/src/pages/PlayDesktop.vue:908-921` and `apps/arena-client/src/pages/PlayMobile.vue:587-599`. The tile has **no pending-choice props**; its Fight button relies on the engine's `hasAnyPendingChoice` refusal and the modal prompts, and the Wound button keeps the same posture.
6. **Client move-name union.** `components/play/uiMoveName.types.ts` is a closed union; `'recruitOfficer'` (`:53-56`) is the precedent. `moveSfxManifest` is a `Partial<Record>`, so it needs no entry.
7. **`useTurnActions`** (`composables/useTurnActions.ts`) declares an explicit return type (`:326-339`) and returns predicates (`:340-`); `canExorciseHauntedHero` (`:402-408`, turn + stage, no heal lock) is the shape precedent for `canWoundMastermind`.
8. **Seat-choice heading.** `PendingSeatChoicePrompt.vue` `heading()` (`:88-181`, fallback `:178`) switches on `kind` and falls back to "Your choice". WP-769 adds `KILLMONGER_WATERFALL_DISCARD_KIND = 'killmonger-waterfall-discard'` (`moves/seatChoiceTactics.ts:87`); Throw from the Waterfall reads "Fight: Draw two cards. Then each other player discards a card." (`data/cards/bkpt.json`).
9. **Parallel edits to `MastermindTile.vue`.** WP-770 (Indestructible Man chooser) is still a draft and edits the same tile. Branches are disjoint by Mastermind; whichever lands second rebases and keeps every branch. WP-759 (Haunt badge) has merged.
10. **Cost gate helper** (`apps/arena-client/src/composables/useCardCostGating.ts`): `canFight(cost: number | null, economy, target?: AttackTargetName)` (`:105`, composable `useCardCostGating` `:198-214`) returns `Needs ${cost} attack, you have ${n}.` when short; with target `'mastermind'` it adds the restricted attack whose grant names the Mastermind (`attackForTarget`, `:52-54`, via the engine's `sumRestrictedAttackForTarget`), matching the engine's `getSpendableAttackForTarget(…, 'mastermind')`.
11. **Prior packets complete:** WP-769, WP-750, WP-648, WP-873 and WP-129 are `[x]` in WORK_INDEX.
12. **Baseline.** On `e3091635f`: arena-client typecheck exits 0; `pnpm -r --no-bail test` 0 fail (game-engine 7422 and server 1864 after WP-769; arena-client 2732, observed by the 01.4 round-1 run after WP-901).

## Context (Read First)

- WP-769 §Contract; `packages/game-engine/src/mastermind/killmonger.logic.ts`; `packages/game-engine/src/moves/woundMastermind.ts`; `packages/game-engine/src/ui/uiState.types.ts` (`UIMastermindState`).
- `docs/ai/DECISIONS.md`: D-24602 (Killmonger), D-24574 (projected `fightCost`), D-24818 (`fortifiedReason`), D-24026 (live-verify).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and `.claude/rules/architecture.md` (the `apps/arena-client` import row: the `.` Runtime-Safe Engine Surface only) — this packet adds a runtime import of `KILLMONGER_ATTACK_LOCK_REASON`.
- `apps/arena-client/src/components/play/MastermindTile.vue` + test; `apps/arena-client/src/components/play/SharedDecks.vue` (the `recruitOfficer` button precedent).
- `apps/arena-client/src/components/play/CrossedSwordsIcon.vue`: any attack icon is an inline SVG, never a Unicode glyph (the WP-736 precedent).
- User memory: `reference_client_fight_gating_ignores_fightcost`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Client only: no engine, server or registry change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific** (exact strings are in §Locked Values below):
- **No client-side rule logic.** Whether Killmonger can be wounded is the engine's `woundable`; the client never re-derives it (no Mastermind-id test, no Wound Stack / KO pile read, no tactics count for availability). The client adds only the turn / stage gate and the attack-cost gate, exactly as for Fight.
- **Fight-lock ordering.** In `gateForFight`, after the stage gate and the heal lock and **before** the cost gate: when `mastermind.fortifiedReason === KILLMONGER_ATTACK_LOCK_REASON`, return `{ allowed: false, reason: mastermind.fortifiedReason }`. Every other `fortifiedReason` (Colleen Wing, The Blob, Indestructible Man) keeps its existing slot after the cost gate. Rationale: Killmonger's lock refuses the fight at any attack, so "Needs N attack" is false advice; WP-770 decides its own ordering. Authority: D-24602's follow-ups assign WP-771 "the cost-before-lock tile order"; this narrows the EC-132 §3 stage → resource → structural precedence for this one reason only, so the executor rewrites all three statements of that precedence to say so — the header JSDoc `MastermindTile.vue:36-42`, the `gateForFight` comment `:201-204`, and the template comment `:395-398` (no new D-entry). `showEvFight` and the Enigma picker inherit it through `gateForFight`. The engine drops the reason once he is vanquished, so the victory message is never masked. When a guard reason (Colleen Wing, The Blob) wins over Killmonger's lock in `fortifiedReason`, the existing order applies and a short player sees the cost reason first; that is expected, not a bug.
- **Fight-cost badge under the lock.** `isFightCostUnaffordable()` returns false while `fortifiedReason === KILLMONGER_ATTACK_LOCK_REASON` (after its stage and heal checks), so the "Fight N" badge (shown once a Wound makes `fightCost` differ from the printed 5) is never red-loud blaming attack while the lock, not attack, refuses the fight. The badge itself still shows his current Attack.
- **Wound click path.** `onWound()` calls `props.submitMove('woundMastermind', {})` directly; it never opens the Enigma guess picker (wounding is not a fight, D-24602) and never sends `useExcessiveViolence`.
- **Pending choices: Fight parity, accepted.** The tile has no pending-choice props. While any pending choice is open (e.g. the Throw from the Waterfall multi-seat discard right after the 0-Attack fight, when his returned Wounds put him back to 5), the Wound button can render enabled and the engine's `hasAnyPendingChoice` silently ignores a click, exactly as the Fight button does today. Wiring pending flags into the tile is out of scope.
- **Wound gating** (`gateForWound()`): (1) `useTurnActions(...).canWoundMastermind()` — not your turn / wrong stage reasons; (2) `useCardCostGating(economy).canFight(mastermindFightCost(), 'mastermind')` — reuses "Needs X attack, you have Y."; the `'mastermind'` target counts Mastermind-restricted attack exactly as the engine's `getSpendableAttackForTarget(…, 'mastermind')`. **No heal lock** (wounding is not a fight).
- **Wound button visibility:** `mastermind.woundable === true && !isGameOver`. Absent `woundable` → no button.
- **Badge visibility:** `mastermind.woundCount !== undefined && !isVanquished()`, where `isVanquished()` is a **new helper independent of `isGameOver`**: `tacticsRemaining === 0 && finalBlowPending !== true`. Do not reuse `isVictoryAssured()`: it returns false once the game is over, which would bring the badge back after a Final Blow win.
- **Stand-up lift stays off.** Keep `mastermind-tile--fortified` keyed on any `fortifiedReason`: under Killmonger's lock it turns the WP-854 lift off, which keeps the lifted card from rising over the Wound button.
- **Absent `woundable`, `woundCount` and the Killmonger reason** → MastermindTile renders exactly as today; existing tests pass unedited.
- **Icons.** No Unicode attack glyph. Reuse `CrossedSwordsIcon`.
- **Layout.** The Wound button and the badge are siblings of the Fight button in normal flow, never over the card. Insertion point: the badge right after the Haunting badge, the Wound button right after `<FortifiedVillains>` and before the EV button. The button lays out as a row with a selector that strictly outranks `.mastermind-tile button` (0,1,1, column flex, `align-items: flex-start`): `.mastermind-tile .mastermind-wound` (0,2,0) with `flex-direction: row; align-items: center`, `font-size: 0.7rem` (the EV precedent) and `max-width: 9rem` with normal wrapping, so the label wraps to two lines instead of widening the tile (the desktop adversary band is `flex-wrap: nowrap`). The tile is no wider with the Wound button showing than with the EV button showing, on the 1280×720 mat and PlayMobile.

## Locked Values

- Client move name: `'woundMastermind'`. Payload: `{}`.
- Stage predicate: `canWoundMastermind()` in `useTurnActions` (explicit return type + returned object): `!isViewerTurn` → `It is not your turn.`; `currentStage !== 'main'` → the shared stage reason `Only available during the Main (Play / Recruit / Fight) step (current: <stage>).`; else allowed. No heal lock.
- Test ids: `play-mastermind-wound` (button) and `play-mastermind-wounds` (badge, `data-count` = `woundCount`).
- Button text: `` `Wound him — spend ${cost} → +1 Recruit` `` (`cost` = `mastermindFightCost()`), with `CrossedSwordsIcon` before it. Enabled-state `title`: `Spend Attack equal to Killmonger's Attack to put a Wound on him (−1 Attack) and get +1 Recruit. Wounding is not a fight.`; disabled-state `title` = the gate reason.
- Badge text: `` `Wounds: ${woundCount}` ``.
- Fight-lock reason: the engine's `KILLMONGER_ATTACK_LOCK_REASON`, imported from `@legendary-arena/game-engine` (never a client copy of the string).
- Waterfall heading: `Throw from the Waterfall — choose a card to discard`.

---

## Scope (In)

- **A)** `components/play/MastermindTile.vue` (+ `MastermindTile.test.ts`): the Wound button, the badge and the Killmonger lock-first ordering.
- **A2)** `components/play/PendingSeatChoicePrompt.vue` (+ `PendingSeatChoicePrompt.test.ts`): the `'killmonger-waterfall-discard'` heading.
- **B)** `components/play/uiMoveName.types.ts`: add `'woundMastermind'`.
- **C)** `composables/useTurnActions.ts` (+ `useTurnActions.test.ts`): `canWoundMastermind`, and the JSDoc predicate list (`:99-109`) gains `canWoundMastermind` → `woundMastermind` at `play.main` (WP-771).

## Out of Scope

- Any engine change (WP-769 shipped the move, projection and lock).
- League Villain wounds, Altar of Resurrection, the bkpt "Wound the Mastermind" heroes.
- SFX and VFX (`moveSfxManifest` is partial).
- Indestructible Man (WP-770) and its Fight-lock ordering.
- A locked Killmonger with no Wound in the KO pile or the Wound Stack: `woundable` is absent while the lock reason still says to Wound him, so no affordance shows. Engine-side (`canWoundMastermind`, D-24602); a possible engine follow-up, not a client fix.
- The stale WP-770 WORK_INDEX row ("BLOCKED on WP-768") — a separate governance fix.

## Files Expected to Change

- `apps/arena-client/src/components/play/MastermindTile.vue` — modified: Wound button, Wounds badge, Killmonger lock ahead of the cost gate, the badge exemption, the three precedence comments
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified: a new `describe` only (10 tests, ACs 1-9)
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` — modified (one heading case)
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.test.ts` — modified (one test)
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — modified: add `'woundMastermind'`
- `apps/arena-client/src/composables/useTurnActions.ts` — modified: `canWoundMastermind` in the return type, the object and the JSDoc predicate list
- `apps/arena-client/src/composables/useTurnActions.test.ts` — modified: a new `describe` only (2 tests, AC 10)
- Governance (close commit): `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/coverage/live-verify.json` (pending row), this WP — modified; `docs/ai/post-mortems/01.6-WP-771-killmonger-client.md` (01.6 post-mortem) — new.

## Contract

- The Locked Values above. No engine, `UIState` or move contract changes.

## Vision Alignment

§1, §17, NG-1. Restores a playable human Killmonger match; no outcome is bought. Client only.

**No conflict:** this WP preserves all touched clauses.
**Non-Goal proximity:** none of NG-1..NG-7 crossed.

## Funding Surface Gate

§20 N/A: client-only Mastermind tile controls and a seat-choice heading; no funding UI, copy or channel.

## API Catalog

§21 N/A: no `apps/server` endpoint or catalog function is added, changed or removed.

---

## Acceptance Criteria

1. With `woundable`, `woundCount` and the Killmonger reason absent, MastermindTile renders as before and the existing tests pass unedited.
2. With `fortifiedReason === KILLMONGER_ATTACK_LOCK_REASON` at `main` on the viewer's turn, Fight is disabled with that reason **whatever the attack** (0, short, or ≥ `fightCost`), clicking it submits nothing, and the Excessive Violence button is hidden.
3. A non-Killmonger `fortifiedReason` (Colleen Wing) with attack short of the cost still shows "Needs X attack, you have Y." (existing ordering kept; this also covers a guard reason winning over Killmonger's lock).
4. With the Killmonger reason, a `fightCost` that differs from the printed cost and attack short of it, the "Fight N" badge shows but is not `--unaffordable`.
5. With `woundable`, the Wound button shows "Wound him — spend N → +1 Recruit" for N = `fightCost`, and a click submits `woundMastermind` with `{}`.
6. The Wound button is disabled with the not-your-turn reason off-turn, the stage reason outside `main`, and "Needs X attack, you have Y." when spendable attack < `fightCost`; disabled clicks submit nothing. Mastermind-restricted attack counts toward the cost.
7. The Wound button is not blocked by the heal lock (`hasHealedThisTurn` true → still enabled when affordable), and with `enigmaCode` holding cards a click submits `woundMastermind` `{}` without opening the guess picker.
8. Without `woundable` (including Killmonger at 0 Attack) there is no Wound button, and at `fightCost === 0` with no reason Fight is enabled. With `isGameOver` there is no Wound button.
9. The Wounds badge shows "Wounds: n" with `data-count` = `woundCount` when present; it shows under a pending Final Blow; it is hidden once vanquished (`tacticsRemaining === 0`, no pending Final Blow), both with `isGameOver` false and with `isGameOver` true (the post-Final-Blow board).
10. `canWoundMastermind()` returns not-your-turn off-turn, the stage reason at `start` / `cleanup`, allowed at `main` on the viewer's turn, and stays allowed with `hasHealedThisTurn`.
11. The Waterfall seat-choice prompt shows "Throw from the Waterfall — choose a card to discard".
12. `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` → 0 fail.

## Test Expectations

- 13 new tests: `MastermindTile.test.ts` 10 (ACs 1-9; AC 2 is two tests, Fight and EV; AC 1 is the unedited existing suite plus one absent-fields case), `useTurnActions.test.ts` 2 (AC 10), `PendingSeatChoicePrompt.test.ts` 1 (AC 11). arena-client 2732 → 2745, 0 fail; every other package unchanged.

## Verification Steps

1. `pnpm -r build` → 0, then `pnpm --filter @legendary-arena/arena-client typecheck` → 0, then `pnpm -r --no-bail test` → 0 fail (paste every package's totals).
2. Revert proofs: (a) move the Killmonger arm after the cost gate → AC 2's short-attack case fails; (b) remove the Wound cost gate → AC 6's short case fails; (c) remove the vanquished check → AC 9's hide case fails; (d) drop the Killmonger exemption in `isFightCostUnaffordable` → AC 4 fails; (e) gate the badge on `!isVictoryAssured()` instead of `!isVanquished()` → AC 9's `isGameOver` case fails. Restore after each.
3. Preview: drive the tile with a `woundable` / `woundCount` / Killmonger-reason fixture (dev store, not committed) at 1280×720 and on mobile; screenshot the Wound button and badge; confirm the tile is no wider with the Wound button showing than with the EV button showing.
4. Confirm `git diff --name-only` ⊆ the allowlist.
5. Live-verify (D-24026) after merge + deploy: a human Killmonger match wounds him 5 → 0 (+1 Recruit and −1 Attack each time, badge counting), Fight enables only at 0 and takes a Tactic.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] STATUS updated. DECISIONS: none (consumes D-24602).
- [ ] WORK_INDEX `[x]` + `[live-verify: pending]`, EC_INDEX Done, mindmap `✅` + `pnpm roadmap:counts:write` (then `:check` 0), NUMBER-LEDGER LANDED, a pending `live-verify.json` row, 01.6 post-mortem.
- [ ] Two-commit topology (`EC-808:` code, `SPEC:` close).
- [ ] **D-24026 live-verify** recorded as its own `SPEC:` PR, the WORK_INDEX row citing the date and match.

---

## Lint Gate Self-Review (00.3)

- §1 all sections present; §2 boilerplate + protocol, Locked Values pointed to from Constraints; §3 Assumes re-anchored on `e3091635f` with paths and lines; §4 Context cites WP-769, D-24602 / D-24574 / D-24818 / D-24026, ARCHITECTURE §Layer Boundary + the arena-client import row; §5 7 code files + governance, closed allowlist with per-line purpose; §6 canonical names (`woundCount`, `woundable`, `fortifiedReason`, `fightCost`); §7 dependencies all merged; §8 client only, `.` engine surface; §9 pnpm; §10–11 N/A; §12 `node:test`, `.test.ts`; §13 exact commands; §14 12 binary ACs; §15 DoD + D-24026; §15.2 Risk Tier MEDIUM (WP + EC); §16 00.6, no contract change; §17 clauses + NG line; §18–19 N/A; §20–21 N/A with reasons.

## Gate Record

**2026-09-26 draft gates (superseded by the reconcile):** 01.4 round 1 DO NOT EXECUTE (WP-769 pending; PS-6..8 fixed); 01.7 RISK, resolved; CONFIRM by an independent subagent, ready once WP-769 merged.

**2026-11-17 reconcile (on `e3091635f`):** `wounds` → `woundCount`; `woundable` is the engine's board-gate affordance (not "is Killmonger") and drives button visibility, replacing the client-side `fightCost === 0` / tactics checks; the client's own "Wound Killmonger to 0 first." lock dropped for the engine's `fortifiedReason`, now ordered ahead of the cost gate for Killmonger only; no heal lock on Wound; badge hides once vanquished; anchors refreshed.

**2026-11-17 re-gate:** rounds recorded below.

**Round 1 (independent subagents, 2026-11-17):**
- **01.4 pre-flight: READY TO EXECUTE.** Every Assumes anchor, the engine contract, cost and attack parity, layer rules and "existing tests unedited" verified; observed baseline `pnpm --filter @legendary-arena/arena-client test` 2732 pass / 0 fail, typecheck 0. **Empirical Scaffold not required:** no previously accepted input becomes rejected (the reorder only changes which reason a Fight already refused shows; the Wound button is a new path). Nits applied: baseline 2726 → 2732; the NUMBER-LEDGER WP-771 note no longer says BLOCKED; the pending-choice window, the "Fight N" badge and the guard-over-lock edge locked (as copilot 1, 3, 4); the no-Wound-available lock named an engine follow-up in Out of Scope; a Test Expectations count (13). Nit 8 (null cost in the label) left: `woundable` implies a projected `fightCost`.
- **01.7 copilot: HOLD (RISK).** Six fixes applied: (1) `isFightCostUnaffordable` exempts the Killmonger lock (AC 4a, revert proof d); (2) the reorder cites D-24602's follow-up ("the cost-before-lock tile order") and the executor rewrites the EC-132 §3 precedence comment; (3) pending choices keep Fight parity, stated as an accepted posture plus a failure smell; (4) a guarded Killmonger keeps the cost-first order, pinned by AC 4; (5) placement locked (badge after Haunting, button after `FortifiedVillains` before EV) with a ≥ (0,1,1) row selector; (6) `onWound` submits directly, never the Enigma picker (AC 7).
- **00.3 lint: FAIL.** Four fixes applied: §20 / §21 N/A with reasons; §17.2 conflict assertion + Non-Goal line; §4 Context cites DECISIONS entries, ARCHITECTURE §Layer Boundary and the arena-client import row, full engine paths; EC literal not-your-turn / stage strings, the exact typecheck command, a scope-lock line, per-file purposes. Recommendations applied: Risk Tier MEDIUM (WP + EC verbatim), self-review one line per section, WORK_INDEX hard deps aligned, AC 12 command-only (screenshots stay in Verification 3), the guard-reason sentence, a Locked Values pointer from Constraints.

**Round 2 (independent subagents, 2026-11-17; round-1 AC numbers above predate the renumber):**
- **00.3 lint: FAIL.** Three fixes applied: §14 13 ACs → 12 (EV folded into AC 2; 4a renumbered 4); §3 Assumes 10 names `useCardCostGating.canFight` with its signature and the `'mastermind'` target; §5 per-file purposes in Files Expected to Change. Recommendations applied: the stage-reason literal in the WP's Locked Values, Assumes 11 lists prior packets, EC "DECISIONS: none", full client paths in Context.
- **01.7 copilot: HOLD (RISK, LOW).** Five fixes applied: (1) `isVanquished()` is a new helper independent of `isGameOver` (never `isVictoryAssured()`), AC 9 adds the `isGameOver: true` post-Final-Blow case, revert proof (e); (2) all three EC-132 §3 precedence statements named (`:36-42`, `:201-204`, `:395-398`); (3) EC test set = 10 tile tests; (4) the row selector is `.mastermind-tile .mastermind-wound` (0,2,0) with `align-items: center`; (5) a guardrail keeps `--fortified` on any `fortifiedReason` so the stand-up lift stays off over the Wound button. Side issue noted, out of scope: the live EV button's `.mastermind-ev-fight` (0,1,0) loses to `.mastermind-tile button`, so it lays out as a column.
- **01.4 pre-flight:** round 1 READY stands; round-2 edits are wording, an AC renumber and test cases, no scope change.

**Round 3 (independent subagents, 2026-11-17):**
- **00.3 lint: PASS.** Every prior-round fix verified present. Recommendations applied: full `pages/` paths in Assumes 5, the post-mortem named with a `— new` marker, the EC Guardrails blank line removed. Not applied: re-ordering the EC Locked Values to WP order (the strings are already verbatim).
- **01.7 copilot: HOLD (RISK, LOW).** Every round-1 / round-2 fix verified against the code (the selector still wins after Vue scoping: (0,3,0) over (0,2,1)). Two fixes applied: (1) the Wound button is `font-size: 0.7rem; max-width: 9rem` and wraps, so it never widens the tile past its EV-button width (the desktop adversary band is `nowrap`), checked in Verification 3; (2) the `useTurnActions` JSDoc predicate list gains `canWoundMastermind` (Scope C, EC Files to Produce).

**Round 4 (independent subagent, 2026-11-17):**
- **01.7 copilot: CONFIRM.** All rounds' fixes re-verified against the code (engine refuses on the lock before cost, `fightMastermind.ts:214` then `:230`; cost and attack parity; the selector wins after scoping; the 9rem Wound button cannot widen a tile whose Fight button already sets it; Wound and EV never show together; `--fortified` is always on with the Wound button). Nits applied: `gateForFight` ends `:254`; `useCardCostGating` `:198-214`; the EC preview line repeats the tile-width check.

**Re-gate result:** 01.4 READY TO EXECUTE (round 1; Empirical Scaffold not required, observed baseline 2732 / 0 fail) · 01.7 CONFIRM (round 4) · 00.3 PASS (round 3; round-4 edits changed two anchors and one EC line only).
