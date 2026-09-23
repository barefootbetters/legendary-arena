# Session Prompt — WP-745 / EC-782: Unmarked "If …, you get +N" conditional grants

**WP:** docs/ai/work-packets/WP-745-unmarked-conditional-icon-grants.md
**EC:** docs/ai/execution-checklists/EC-782-unmarked-conditional-icon-grants.checklist.md (authoritative execution contract)
**Reserves:** D-24568 (lands Active at govern-close). **Status:** READY TO EXECUTE once WP-743 / EC-780 is executed on `main` (01.4 READY, 01.7 PASS, 00.3 PASS — records in the WP).

> Committed via `git add -f` (session-*.md is gitignored) so the brief survives the drafting
> worktree's removal — per `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Seventeen hero ability lines of the form "If <condition>, you get +N[icon:attack|recruit]" carry
no `[keyword:…]` marker. The Step 2b icon read turns each one into an unconditional grant. Gate
each line on its printed condition through marker→condition arms, the WP-743 pattern:

- **Rage** waits for a Hero put into the KO pile this turn.
- **First, eighth and N-other-cards, another-4-cost, 4-and-2-cost, and three distinct non-grey
  Heroes** read a gated per-turn play history, on play.
- **Four draw lines** reuse `cardsDrawnThisTurnAtLeast`.
- **Two Bystander lines** reuse `bystandersInVictoryAtLeast`.

Engine and card data only. The hash oracles stay byte-unchanged.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; the persistence boundary: both new `G` fields are runtime-only and lazy)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-745: the design authority, including D-24568 §1–§6 and the Sweep Ledger
5. EC-782: the execution contract; satisfy every item exactly
6. `docs/ai/DECISIONS.md`:
   - D-24377 (amended by D-24568 §1)
   - D-24467, D-24476, D-24464, D-24498
   - D-24566 (WP-743)
7. WP-743 / EC-780 as executed on `main` (its `matchReadsConditionType`, `onBegin` / `applyOnBeginParity` deletes, and marker arms), and WP-744 / EC-781 (the sim-parity sibling)
8. User memory:
   - `reference_hero_ability_marker_curated_map`
   - `reference_inplay_totalobs_pin_stale_on_feed_regen`
   - `reference_sim_coverage_baseline_gate_distinct`
   - `reference_hashed_g_field_dual_repin`

## Pre-execution checks

- **Hard gate:** WP-743 / EC-780 is executed on `main`, so `matchReadsConditionType` exists. If not, STOP: the WP is BLOCKED.
- If WP-744 landed first, rebase onto its `applyOnBeginParity` edits. Re-measure the feeds after your change.
- Fresh worktree off `origin/main`, then `pnpm install`, then **`pnpm -r build` FIRST** (a stale `dist` fakes results). Record the engine-suite baseline count.
- Re-confirm that all 17 WP §G lines are free grants today: `buildHeroAbilityHooks` gives effects and no `conditions`.

## Execution rules (operationalizing WP-745 + EC-782 — no new scope)

- **State:**
  - `G.cardsPlayedThisTurn?: CardExtId[]` is appended at exactly two sites in `coreMoves.impl.ts`: after the `inPlay` append in `applyCardPlay` (`.push(cardId)`) and in `playCard`'s split branch (`.push(args.cardId)`). Each append is gated on `matchReadsPlayHistory(G)` and uses the locked create-if-undefined form.
  - `G.koPileLengthAtTurnStart?: number` is set in `turn.onBegin` and in `applyOnBeginParity`, gated on the Rage condition type. The play history is deleted there.
  - No other writes. Keep the grep literal out of comments.
- **Conditions:** use the six exported constants, the evaluate and describe text **verbatim** from WP §C, and a named module-local helper per case body.
  - Only `heroPutIntoKoPileThisTurn` joins `WAIT_AND_SEE_CONDITION_TYPES`.
  - The five play-history types stay on-play, per D-24568 §1.
  - Never read `inPlay` for an ordinal or an "other played" count.
- **Parser:** seven marker arms before the unresolved fallback. The six new-condition arms push the exported constants, never literals; `bystanders-threshold` pushes Savior's `'bystandersInVictoryAtLeast'` literal.
- **Card data:** the 18 curated-map entries on 17 lines (WP §G), plus the apply-script allowlist and the ledger map. Then run the ordered regen:
  1. the apply script (expect 14 files, 17 lines; a re-run is zero-diff)
  2. `ledger:heroes`
  3. `effect-index`
  4. `mechanics:metadata`
  5. `sim:runtime-observed`

  Then run every `:check`, plus `sim:coverage --check` (re-baseline only if it exits non-zero). Re-pin the `useInPlayCoverage.test.ts` `totalObs` from your own measurement, with a `Tests-changed:` trailer. Revert any CRLF-only churn in `lagn-v1.json`.
- **Tests:** WP §I cases 1–9 in `hero/unmarkedConditionalGrants.test.ts`.
  - Case 1 reads the committed `data/cards` strings.
  - The Rage cases drive `playCard` + `resolveSplitFaceChoice('b')`.
  - The reset cases invoke the real `turn.onBegin`.
  - Extend `deferredConditionalGrants.test.ts` (keyset + `TRUTHY_FIXTURE`).
  - Add the `PLAY_HISTORY_CONDITION_TYPES` pin in `heroConditions.evaluate.test.ts`.
  - Runtime assertions only (D-24372).
- **Determinism:** the sentinel `finalStateHash` and `PRE_WP080_HASH` must stay byte-unchanged. A move is a gating bug. Never re-pin.

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-745 per EC-782 with a two-commit topology:

1. `EC-782:` implementation (the allowlist only; the counts go in the body).
2. `SPEC:` govern-close:
   - land D-24568 Active (§1–§6)
   - WORK_INDEX `[x]`, EC_INDEX Done
   - mindmap ✅, then `roadmap:counts:write` and `ledger:numbers:check`
   - STATUS.md
   - if WP-744 is still unexecuted, amend its execution-order note to name WP-745

Open one PR.

**D-24026 live-verify is REQUIRED** after deploy, on `play.legendary-arena.com`, against the deployed `/api/version` gitSha. Run a bot-ally or `POST /api/match/autoplay` match with Elektra, Winter Soldier or Wanda & Vision in the pool. The log must show each grant only when its condition held. Record it as a follow-up STATUS flip, not a merge blocker.

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- Run `node scripts/prune-empty-claude-branch.mjs --verify-current` from the worktree (expect `VERIFY PASS`).
- Run `git branch -D <branch>` + `git push origin --delete <branch>`.
- Run `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates and operationalizes WP-745 + EC-782 only. It adds no new scope, files, contract elements, locked values, or forbidden patterns. Any new surface goes back into the WP/EC and re-runs the gates.
