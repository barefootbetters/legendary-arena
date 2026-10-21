# WP-820 — Baron Zemo's rescue on a fight: the City-row "Fight + Rescue" control (Arena Client)

**Status:** Draft 2026-10-21 — **BLOCKED on WP-819** (EC-858; D-24753 reserved (#2942), landed by WP-819). Copilot CONFIRM and 00.3 PASS; pre-flight is re-run at execution, after WP-819 merges (see §Gate Record).
**Primary Layer:** App: arena-client
**Dependencies:** **WP-819** (the `payToRescueBystander` intent and the `economy.rescueOnFightAvailable` cue) must be executed and merged first. Builds on WP-738 / D-24561 (the per-target Excessive Violence control), WP-750 / D-24574 (Fight gating reads the projected `fightCost`), WP-790 / D-24652 (per-target attack).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It is the last half of a cross-layer pair and carries the arc's live-verify.
**Arc:** Cap 75th (ca75) completion arc, audit item 3b.

> Baseline: `origin/main` after WP-819 merges. Re-read line anchors and test totals at execution.

---

## Goal

As a player facing Baron Heinrich Zemo, I want a button on each fightable Villain that fights it and pays 2 Recruit to rescue a Bystander, so that I can use Zemo's printed "you may use 2 Recruit to rescue a Bystander" without guessing when it applies.

After this session, while the engine's cue is on (WP-819: Zemo is the Mastermind, the supply has a Bystander, the active player has 2+ Recruit), each Villain the player can fight also shows a **Fight + Rescue** button beside the normal Fight click. The button submits `fightVillain({ cityIndex, payToRescueBystander: true })`; the engine decides the outcome.

## User-Visible Impact

- In a Zemo match, a fightable Villain shows a **Fight + Rescue · 2 Recruit** button when the player can pay both the fight and the 2 Recruit.
- The normal Fight click is unchanged and still fights without paying.
- In any other match nothing changes.

---

## Assumes

1. **WP-819 is merged.** `UITurnEconomyState.rescueOnFightAvailable?: boolean` exists in the engine build the client imports (`@legendary-arena/game-engine` dist), and `fightVillain` honours `payToRescueBystander`. If not, STOP.
2. **The EV control precedent** (`apps/arena-client/src/components/play/CityRow.vue`):
   - `gateForCell(cell)` (~L110-141) is the Fight enable gate: stage, heal lock, `useCardCostGating(props.economy).canFight(cell.card.fightCost, citySpaceNameForIndex(cell.cityIndex))`;
   - `showEvFight(cell)` (~L183-200) shows the EV button only when `gateForCell` allows and `canFightWithExcessiveViolence` passes;
   - `onFightEV` (~L202-209) submits `props.submitMove('fightVillain', { cityIndex, useExcessiveViolence: true })`;
   - the template button `city-space__ev-fight` (`data-testid="play-city-villain-ev"`, ~L376-393) sits outside the fight button, with its own scoped styles (~L701-740);
   - `setup()` returns the helpers (~L250-262).
3. **The gating composable** (`apps/arena-client/src/composables/useCardCostGating.ts`): `attackForTarget(economy, target)` (L52-54) = `availableAttack` + the target's restricted attack; `canFightWithExcessiveViolence(cost, economy, target)` (L136-149); `useCardCostGating(economy)` (~L156-170) returns `canRecruit` / `canFight` / `canFightWithExcessiveViolence`. `UITurnEconomyState` carries `availableRecruit` and `recruitSpendableAsAttack?` (`packages/game-engine/src/ui/uiState.types.ts` ~L796-810).
4. **Tests.** `components/play/CityRow.test.ts` (`node:test` + `@vue/test-utils` via `vue-sfc-loader`; an `economy({...})` builder; the EV cases ~L155-240) and `composables/useCardCostGating.test.ts` (the EV cases ~L75-140).
5. `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/arena-client test` are green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- WP-819 (`docs/ai/work-packets/WP-819-zemo-rescue-on-fight-engine.md`) holds the mechanic and the D-24753 rationale. This packet is only the control.
- **Why a per-target button and not a "pay on my next fight" toggle.** The EV control already proved per-target. It needs no arm state, and it disappears when the cue drops (EC-775's amendment, auto-memory `project_excessive_violence_arc`).
- **Why the client mirrors affordability.** The engine declines a request it can't pay, logging why, and fights normally. The client shows the button only when the fight plus 2 Recruit is payable. Under the recruit-as-attack conversion the fight itself can spend Recruit, so the mirror then needs `attack + recruit ≥ cost + 2`. For a rescue-only fight the mirror is exact (the cue guarantees 2+ Recruit, and the conversion branch guarantees 2 remain after the debit); the engine stays the authority.
- **No combined EV + Rescue button.** On one fight a player picks the EV button or the Rescue button. The engine accepts both arguments together (WP-819 T10), so a combined control is a later client-only nicety (Out of Scope).
- **Coordination with WP-817** (drafted). It adds a Primus discard chooser to `CityRow.vue`. If WP-817 has executed when this packet runs, `showRescueFight` returns false for a cell whose card carries `fightDiscardCosts`, so this control never bypasses that chooser. If it has not, that clause doesn't exist yet and WP-817 adds it when it executes. Either way the order is recorded in STATUS.
- `docs/ai/ARCHITECTURE.md` §Engine Owns Truth (the client submits intent) and the Layer Boundary, enforced in `.claude/rules/architecture.md` §Layer Boundary (arena-client imports the engine's runtime-safe surface and its types only).
- `docs/ai/DECISIONS.md`: scan D-24561, D-24574, D-24652, D-24753 before coding.

---

## Non-Negotiable Constraints

**App-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no nested ternaries.
- The client submits intent only; it never decides an outcome or mutates game state.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- **Additive only.** `onFight`, `showEvFight`, `onFightEV` and the normal Fight button are unchanged.
- **Gate from the cue.** The button never shows when `economy.rescueOnFightAvailable !== true`, and never for a cell `gateForCell` disallows.
- **No engine edit.**

## Locked Values

**`composables/useCardCostGating.ts`:**
- `export const RESCUE_ON_FIGHT_RECRUIT_COST = 2;` (`// why:` mirrors the engine constant of the same name, WP-819; the client doesn't import engine internals.)
- `export function canFightAndRescue(cost: number | null, economy: UITurnEconomyState, target?: AttackTargetName): boolean`:
  1. `economy.rescueOnFightAvailable !== true` → `false`;
  2. `cost === null` → `false`;
  3. `economy.recruitSpendableAsAttack === true` → `attackForTarget(economy, target) >= cost + RESCUE_ON_FIGHT_RECRUIT_COST`;
  4. else `attackForTarget(economy, target) >= cost && economy.availableRecruit >= RESCUE_ON_FIGHT_RECRUIT_COST`.
- `useCardCostGating(economy)` also returns `canFightAndRescue: (cost, target) => canFightAndRescue(cost, economy, target)`.

**`components/play/CityRow.vue`:**
- `showRescueFight(cell)`: `cell.kind === 'slot' && cell.card !== null && gateForCell(cell).allowed && useCardCostGating(props.economy).canFightAndRescue(cell.card.fightCost, citySpaceNameForIndex(cell.cityIndex))`. If WP-817 has executed: `&& cell.card.fightDiscardCosts === undefined`.
- `onFightRescue(cityIndex)`: `props.submitMove('fightVillain', { cityIndex, payToRescueBystander: true })`.
- The template button, placed after the EV button and built the same way:
  - `v-if="showRescueFight(cell)"`, `type="button"`, `class="city-space__rescue-fight"`, `data-testid="play-city-villain-rescue"`, `:data-city-index="cell.cityIndex"`;
  - `title="Fight this Villain and pay 2 Recruit to rescue a Bystander (Baron Zemo)."`;
  - `@click="onFightRescue(cell.cityIndex)"`;
  - children: label `<span class="city-space__rescue-fight-label">Fight + Rescue</span>` and cost badge `<span class="city-space__rescue-fight-cost">2 Recruit</span>`.
- Scoped styles `.city-space__rescue-fight` / `-label` / `-cost` in the EV button's shape, coloured with the existing brand token `var(--la-color-recruit)` (`apps/arena-client/public/brand-tokens.local.css` ~L216 / ~L299, loaded in `index.html` ~L51); no new token.
- `setup()` returns `showRescueFight` and `onFightRescue`.

## Scope (In)

- **A)** `composables/useCardCostGating.ts` + test: `RESCUE_ON_FIGHT_RECRUIT_COST`, `canFightAndRescue`, the composable entry.
- **B)** `components/play/CityRow.vue` + `CityRow.test.ts`: the button, its gate and its submit.

## Out of Scope

- **Any engine change** (WP-819).
- **A combined EV + Rescue control**, and **Rescue on a Villain with a fight discard cost** (WP-817's Primus): the engine accepts the arguments together, but no control sends them, so in a match with both Zemo and Primus the rescue isn't offered on Primus.
- **The Mastermind tile** ("fight a Villain" only).
- **A bot policy** for paying.
- **Guard and defeat-requirement mirroring.** Like the plain Fight button, the control doesn't mirror them; the engine returns silently before any rescue line.

## Files Expected to Change

**Client (`apps/arena-client/src/`)**
- `composables/useCardCostGating.ts` — modified; `composables/useCardCostGating.test.ts` — modified (additions only)
- `components/play/CityRow.vue` — modified; `components/play/CityRow.test.ts` — modified (additions only)

**Governance:** `docs/ai/STATUS.md` (+ the D-24026 live-verify record for WP-819 and WP-820), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 4 client files, 2 of them tests.

## Contract

- `RESCUE_ON_FIGHT_RECRUIT_COST`, `canFightAndRescue` and its `useCardCostGating` entry, `showRescueFight` / `onFightRescue`, the button's `data-testid`, title, label and cost text, and the submitted intent.

## Test Contract

`CityRow` cases mount the component the way the EV cases do (`economy({...})`, which accepts any `UITurnEconomyState` field, a fightable villain cell with `fightCost`, `currentStage: 'main'`, `isViewerTurn: true`). `useCardCostGating.test.ts`'s `economy({ attack, recruit, available? })` builder has no cue field, so its cases spread it: `{ ...economy({ attack: 3, recruit: 2 }), rescueOnFightAvailable: true }` (the `evEconomy` pattern, ~L71-74). Each file groups its cases under one `describe('WP-820 …')`.

| # | File | Input | Expected | Invariant / must NOT |
|---|---|---|---|---|
| T1 | useCardCostGating | `canFightAndRescue(3, { ...economy({ attack: 3, recruit: 2 }), rescueOnFightAvailable: true })` | true | |
| T2 | useCardCostGating | T1 with `recruit: 1`; with the cue absent; with `cost: null`; with `attack: 2` | false ×4 | |
| T3 | useCardCostGating | `{ ...economy({ attack: 3, recruit: 4, available: { attack: 7 } }), recruitSpendableAsAttack: true, rescueOnFightAvailable: true }`, cost 5; then `available: { attack: 6 }` with recruit 3 | true; false | the fight's Recruit counted |
| T4 | CityRow | cue on, villain cost 3, attack 3, recruit 2 | the `play-city-villain-rescue` button renders with "Fight + Rescue" and "2 Recruit"; clicking it calls `submitMove('fightVillain', { cityIndex, payToRescueBystander: true })` once | intent only |
| T5 | CityRow | cue absent; recruit 1; not the viewer's turn; healed this turn | no rescue button | gated by the cue and `gateForCell` |
| T6 | CityRow | T4 plus `excessiveViolenceAvailable: true` and attack ≥ cost + 1, so all three buttons render | the normal Fight submits `{ cityIndex }` only; the EV button `{ cityIndex, useExcessiveViolence: true }` only; the rescue button `{ cityIndex, payToRescueBystander: true }` only | additive |
| T6b | CityRow | a villain on the Rooftops whose cost is paid only by Rooftops-restricted attack (the `rooftopsEconomy` helper, `CityRow.test.ts` ~L1028) with the cue on and 2 Recruit; and the same villain on another space | the rescue button shows; it is absent on the other space | the target reaches `canFightAndRescue` |
| T7 | CityRow | **only if WP-817 has executed:** a Primus cell (`fightDiscardCosts`) with the cue on and the fight affordable | no `play-city-villain-rescue` | the Primus chooser isn't bypassed |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed. The control exposes a printed card option and costs no money.

**Determinism preservation:** client presentation only. It sends a validated intent; the engine decides.

## Funding Surface Gate

§20 **N/A**: no funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` surface. D-11804 does not apply.

---

## Acceptance Criteria

1. T1 and T2 pass (the `canFightAndRescue` true path and its four false paths).
2. T3 passes (the conversion branch counts the fight's Recruit).
3. T4 and T5 pass (the button renders and submits `{ cityIndex, payToRescueBystander: true }` once; it is absent when the cue or `gateForCell` blocks).
4. T6 and T6b pass (the three buttons submit distinct intents; the restricted-attack target reaches the gate).
5. T7 passes when WP-817 has executed; otherwise STATUS records it as not applicable.
6. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
7. `pnpm --filter @legendary-arena/arena-client test` has 0 failures, and `pnpm -r build` exits 0.

## Verification Steps

1. `pnpm -r build` → exit 0 (the client reads the engine dist).
2. `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
3. `pnpm --filter @legendary-arena/arena-client test` → all pass; record the before / after totals.
4. `git diff --name-only` ⊆ Files Expected to Change.
5. Revert proofs, one at a time, each must fail at least one T-case: drop the cue check; drop the conversion branch; submit without `payToRescueBystander`.

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the three revert proofs were observed.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md`: no new entry (D-24753, landed Active by WP-819, covers this control); append one only if execution makes a new decision.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-858:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED, operator-seated: a bot can't opt in). On `play.legendary-arena.com`, with the deployed gitSha checked, in a `ca75/baron-heinrich-zemo` match (staged through the operator setter pane, WP-806/807):
  - with 2+ Recruit, a fightable Villain shows **Fight + Rescue**;
  - clicking it defeats the Villain, spends 2 Recruit, and logs `paid 2 Recruit to rescue a Bystander on fighting …`;
  - on a Masters of Evil (WWII) Savior Villain fought with 2 rescued Bystanders, the rescue turns the Savior reward on;
  - with 1 Recruit the button is absent;
  - the Play Diagnostics `uiStateSnapshot` shows `economy.rescueOnFightAvailable: true` while the button shows (step 5 of the Board-Visible Field contract, for WP-819's cue).

  This discharges WP-819's live-verify too. Record it as operator-pending until seen.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY on sequencing only — WP-819 has not executed, so the `rescueOnFightAvailable` field is not yet in the engine dist.** The spec itself was verified: `gateForCell` / `showEvFight` / `onFightEV` / the EV button and styles / `attackForTarget` / `canFightWithExcessiveViolence` anchors; `SubmitMove` args are `unknown`; the CityRow `economy(...)` builder carries every economy field; the conversion mirror is exact for a rescue-only fight. Clarifications applied: RS-1 the composable test builder is spread with the cue (T1-T3 rewritten); RS-2 the colour token is `--la-color-recruit`; RS-3 the `@click` binding is locked; RS-4 a coordination line was added to WP-817 and EC-858's Primus smell corrected; RS-5 the `uiStateSnapshot` live-verify bullet added. **Re-run pre-flight at execution once WP-819 has merged and `pnpm -r build` has run** (01.0a §Blocking drafts: merged as a `[ ]` placeholder, BLOCKED on WP-819).

**Copilot (01.7), round 1 (independent subagent, both packets): RISK (HOLD), twelve scope-neutral fixes, all applied; pre-flight stands.** Verified clean: every `fightVillain` caller passes args through untouched (replay, sim runner, PAR aggregator, fixtures, `game.ts` registration, no server arg validation; bots and the slash gesture never pay); the operator view sees the cue (harmless, like EV); spectators get `REDACTED_ECONOMY`; no onFight Victory-Pile write aliases `awardResult.playerVictory`; declined lines can fire only after every silent return; WP-820's mirror is exact.
1. Mode 11: T5's copied fixture carried an attached Bystander → `attachedBystanders = {}` plus a control run; the preceding line is named.
2. Mode 11: no test that a failed fight logs nothing → T17 + revert proof 5.
3. Mode 22: the core paid before checking the supply top → read it first, skip both when undefined.
4. Mode 15: two more stale comments (Step-3 ~L250-258, the core JSDoc) → locked rewrites + `@param options`.
5. Modes 27 / 4: a third copy of the Zemo id → one exported `BARON_ZEMO_MASTERMIND_ID` in `rescueOnFight.logic.ts`; WP-818 / EC-856 import it if WP-819 lands first, WP-819 swaps WP-818's two declarations if it lands second.
6. Mode 26: the "player-optimal" claim → a second trade named (supply-rescuing Fight effects on a near-empty supply).
7. Mode 23: order with WP-817's discard → locked (discard, then the rescue decision, then the core).
8. Mode 21: T16 assigned a `readonly` field → a spread copy.
9. Modes 30 / 12: the coordination wasn't in EC-855 → EC-855 Before Starting and WP-817 Assumes 5 now carry it; WP-820 gains conditional T7.
10. Modes 12 / 26: no rescue on Primus in a Zemo + Primus match → WP-820 Out of Scope.
11. Mode 11: WP-820 T6 was weak and the target untested → T6 renders all three buttons; T6b restricted-attack target; the restricted-attack Out of Scope line reworded.
12. EC-858 omitted `type="button"` → added.

**Copilot (01.7), rounds 2-3 (same independent subagent): round 2 RISK (HOLD) on WP-819, CONFIRM on WP-820; round 3 CONFIRM on all four touched packets.** All twelve round-1 fixes were confirmed: T5 now separates rescue from no-rescue (3 vs 2 Bystanders), the locked strings match the code, and there is no import cycle; either execution order ends with one Zemo-id declaration and no dangling import.
- **A (fixed):** T17 ran on a payable state, which logs nothing even with a misplaced decision → it now runs on declining states (recruit 1; empty supply) × (stage, heal lock, cost), after T16.
- **B (fixed):** WP-818 / EC-856's strike line carries the "WP-819 first" conditional; WP-819 / EC-857 name the strike-branch rename.
- **C (fixed):** WP-817 gains conditional T34 (mirrors WP-820 T7), tied into its AC 8.
EC line counts: EC-855 75, EC-856 73, EC-857 58, EC-858 49.

**Lint (00.3) (independent subagent): FAIL → PASS after text-only fixes, applied** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight NOT READY on sequencing only (BLOCKED on WP-819; re-run at execution) · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. Three FAILs (§1 / §14 Acceptance Criteria count, §15 DECISIONS line, EC-858's restated Locked Values) were fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS after fix — all sections present; Acceptance Criteria now 7 |
| §2 | PASS — full files, ESM, Node v22+ (A3), 00.6, intent-only, session protocol, Locked Values |
| §3 | PASS — the WP-819-merged STOP gate; anchors verified |
| §4 | PASS — ARCHITECTURE §Engine Owns Truth + Layer Boundary and `.claude/rules/architecture.md` §Layer Boundary (A4); DECISIONS scan |
| §5 | PASS — 4 client files + governance |
| §6 | PASS — names consistent with WP-819 and the EV precedent |
| §7 | PASS — no new dependencies |
| §8 | PASS — the affordability mirror in the composable (EV precedent); no game logic; no engine edit |
| §9 | PASS — pnpm only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test + vue-sfc-loader; no boardgame.io / network / DB |
| §13 | PASS — exact commands, diff scope, 3 revert proofs |
| §14 | PASS after fix — 7 binary criteria |
| §15 | PASS after fix — DoD names DECISIONS (no new entry; D-24753 via WP-819) |
| §15.1 | PASS — operator-seated live-verify with gitSha, staging path and the `uiStateSnapshot` check |
| §16 | PASS — JSDoc, `// why:`, no nested ternaries |
| §17 | PASS — §1 / §23 / §24 / NG-1; conflict line; determinism line |
| §18 | N/A — no grep step |
| §19 | N/A at draft — applies to STATUS at close |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

EC-858 vs EC-TEMPLATE: FAIL → PASS after the Locked Values were replaced by a verbatim copy of the WP's and a DECISIONS line was added to After Completing; all seven sections in order, under 100 lines. Advisory A2 (two drifted test-helper anchors) is left for the execution pre-flight re-run.

**Verdict:** PASS.
