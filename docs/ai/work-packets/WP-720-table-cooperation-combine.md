# WP-720 — Synergy Realization: Table Cooperation one-seat-sweep combine (Server)

**Status:** Draft 2026-09-20 (EC-757; no new D — refines D-24540) **Layer:** Server only
(a display refinement to `computeTableCooperation`). **Lane:** Standard two-session (a
modification of existing recognition-composition logic + its tests, not additive).
**Baseline:** `origin/main` @ `0944c720` · **User-Visible Surface:** the coach report
payload / the WP-718 "Table Cooperation" block on the endgame coach panel. **Design of
record:** `docs/ai/DESIGN-SYNERGY-REALIZATION.md` §3.4; refines WP-717/D-24540.

## Goal

Stop the Table Cooperation block from naming the same seat three times when one seat
carries every co-op role. Today `computeTableCooperation` emits an independent line per
role (top combat / top synergy / top rescue), so a seat that sweeps all three reads as
three consecutive "Player 2 …" lines (observed on the real 2p Red Skull match). Group the
role attributions **by winning seat** and emit **one line per distinct winning seat**: a
single-role seat keeps its specific voice ("carried the combat — N enemies defeated"), a
multi-role seat combines into one line ("anchored the table — N enemies defeated, N
conditional clauses landed, and N Bystanders saved"). Nothing else changes — same roles,
same numbers, same outcome line and combined total; only the line grouping.

## Assumes

- **WP-717/D-24540 shipped `computeTableCooperation` (on `main`).**
  `apps/server/src/coach/tableCooperation.logic.ts` computes the outcome line, three
  standout role lines (via `pickTopSeat` first-max-wins, zero-metric omitted), and a
  combined-total line, attached to `CoachReport.tableCooperation`. WP-718 renders it
  verbatim in `EndgameCoachPanel.vue` (one `<li>` per line), so fewer/combined lines flow
  to the client with no client change.
- **`pickTopSeat` is deterministic** (strict `>` over `perPlayer` order), so grouping by
  the returned winners is deterministic too.
- **The recognition is display-only, off-ranking** (D-24540 NG-1) — unchanged here.

## Context (Read First)

The three roles are computed independently and pushed as separate lines. When the same
seat wins ≥ 2 roles the block repeats that seat's label. The fix groups the (up to three)
role winners by seat and renders one line per distinct seat, preserving the exact
achievements. Grouping order follows the role computation order (combat → synergy →
rescue): a seat is placed at its first winning role. So combat=P2, synergy=P2, rescue=P1
→ one P2 line (combat + synergy) then one P1 line (rescue); a full P2 sweep → one P2 line
with all three achievements.

**Copy.** Single-role lines keep the current phrasing verbatim (no change when each seat
wins one role — the common multi-player case). A multi-role line uses a general lead
("anchored the table") followed by a comma-/"and"-joined list of the role achievement
fragments ("N enemies defeated", "N conditional clauses landed", "N Bystanders saved").
The two enforced vocabularies are preserved: celebration (no whiff/failed/error/missed/
wasted) AND cooperative (no player-vs-player — "anchored", "carried", "defeated" are all
clean; word-boundary lint so "defeated" ≠ "beat").

**Determinism / layer.** Pure over the summary; no engine/`G`/hash/replay; server-only;
not model-authored. Modifies existing role-emission logic + its tests (an intended
behavior change — the reward-integrity rule: update the tests because the product output
intentionally changed, and the commit says so).

## Scope (In)

- `apps/server/src/coach/tableCooperation.logic.ts` — replace the three independent role
  pushes with: compute the three winners (unchanged `pickTopSeat` calls), build a
  per-role achievement fragment for each non-null winner, group fragments by winning seat
  **object identity** (the `pickTopSeat`-returned `CoachPlayerLine` reference, not the display
  label — robust against any future label change, zero cost) in first-appearance
  (combat→synergy→rescue) order, and emit one line per seat
  (single-role → current specific phrasing; multi-role → "anchored the table — " +
  joined fragments). Outcome line, zero-metric omission, solo/all-zero degradation, and
  the combined-total line are unchanged.
- `apps/server/src/coach/tableCooperation.logic.test.ts` — update the existing
  "names the standout co-op roles" expectations to the grouped shape; add: one-seat-sweep
  (all three → one line), 2-plus-1 split (two lines), all-distinct (three lines, current
  behavior preserved). Keep the outcome / degradation / copy-lint / singular-grammar tests.

## Out of Scope

- Any engine / `G` / hash / persistence change; any client change (WP-718 renders whatever
  lines the field carries — fewer/combined lines need no client edit).
- The outcome line, the combined-total line, the zero-metric omission, or the tie-break —
  all unchanged.
- The other named follow-ups (cross-seat gift/assist attribution; HQ-courtesy).
- Any score / PAR / grade / VP effect (display-only, NG-1).

## Files Expected to Change

| File | Change |
|---|---|
| `apps/server/src/coach/tableCooperation.logic.ts` | group role attributions by seat; one line per distinct winning seat |
| `apps/server/src/coach/tableCooperation.logic.test.ts` | grouped-shape expectations + sweep / 2+1 / all-distinct cases |

Governance (land at execution): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`NUMBER-LEDGER.md` (landed), `STATUS.md`. No `DECISIONS.md` (refines D-24540, no new
invariant). No `api-endpoints.md` (the `tableCooperation` field shape is unchanged — it is
still `readonly string[]`; only the line composition changes).

## Contract

- **`computeTableCooperation(summary): readonly string[]`** — signature unchanged; still
  returns the outcome line, the role recognition (now **grouped by seat, one line per
  distinct winning seat**), and the combined-total line; empty-degradation unchanged.
  Deterministic; pure over the summary.

## Non-Negotiable Constraints

- **Grouped by seat, deterministic.** One line per distinct winning seat, seats in
  combat→synergy→rescue first-appearance order; no seat named twice.
- **Achievements preserved exactly.** Same role winners, same counts/metrics as WP-717 —
  only the line grouping/phrasing changes.
- **Two vocabularies preserved.** Celebration (no whiff/failed/error/missed/wasted) AND
  cooperative (no player-vs-player); word-boundary copy-lint.
- **Server-only, deterministic, display-only, off-ranking** (D-24540; NG-1). No engine/
  `G`/hash/replay; not model-authored.
- **No `.reduce()`** in the grouping — explicit `for...of` + descriptive accumulators.
- Standing rules: `.claude/rules/code-style.md` + `00.6`; `.test.ts` on `node:test`;
  `// why:` on the grouping-order choice + the multi-role lead phrasing.

## Acceptance Criteria

1. **One-seat sweep:** a summary where one seat wins combat + synergy + rescue emits
   exactly **one** role line for that seat (plus the outcome + combined-total lines), and
   that line names all three achievements. Asserted.
2. **2-plus-1 split:** one seat wins two roles, another wins the third → exactly **two**
   role lines (the two-role seat combined, the one-role seat in its specific voice).
3. **All-distinct:** three different seats each win one role → **three** role lines, each
   in the current specific phrasing (the WP-717 behavior preserved).
4. **Zero-metric omission preserved:** a role whose metric is zero across the table
   contributes no fragment and no line.
5. **Copy-lint (both vocabularies) preserved** on the combined line: none of
   `whiff`/`failed`/`error`/`missed`/`wasted`, and none of
   `opponent`/`beat`/`versus`/`vs`/`winner`/`loser` (word-boundary).
6. Solo / all-zero degradation, the outcome line, and the combined-total line are unchanged.
7. No engine/hash/persistence/client change; server suite green; no fixture/card-data churn.
8. Control / non-vacuity: reverting the grouping (re-emitting per-role lines) fails AC-1/AC-2.

## Verification Steps

1. `pnpm --filter @legendary-arena/server test` → green (grouped shape + sweep/split/distinct).
2. `pnpm -r build` 0; `git diff --name-only` = the allowlist + governance.
3. **Live-verify (operator-pending, post-deploy, D-24026):** the real 2p Red Skull match's
   coach "Table Cooperation" block shows a **single** combined line for the sweeping seat
   ("anchored the table — 8 enemies defeated, 3 conditional clauses landed, and 12
   Bystanders saved") instead of three "Player 2 …" lines. Freshly-generated report.

## Definition of Done

- [ ] All ACs met; server suite green (pass delta recorded).
- [ ] No engine/hash/persistence/client change; no fixture / card-data churn.
- [ ] `git diff --name-only` = the 2 server files + governance.
- [ ] `pnpm -r build` 0.
- [ ] WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `📝`→`✅`; `roadmap:counts:check` 0;
      NUMBER-LEDGER landed; STATUS close-out.
- [ ] Two-commit topology (EC-757 impl + SPEC close).
- [ ] Live-verify (payload/render) performed or explicitly operator-pending.

## Lint Gate Self-Review (00.3)

All applicable sections PASS/N-A: structure; non-negotiable constraints (grouped/
deterministic, achievements preserved, two vocabularies, server-only/display-only, no
`.reduce()`); assumes (WP-717 `computeTableCooperation` + `pickTopSeat` determinism +
WP-718 verbatim render); context (the sweep problem + grouping design); files (2-file
allowlist); naming (`computeTableCooperation`, `pickTopSeat`, `CoachMatchSummary`,
`CoachPlayerLine` — verified); dependency discipline (WP-717/D-24540 ✅ #2197, WP-718 ✅
#2199); architectural boundaries (server-only pure derivation; no engine/client; D-20105);
test quality (`node:test`; non-vacuous control; sweep/split/distinct + preserved cases);
DoD (binary, two-commit); code style (`// why:` on grouping order + lead phrasing, no
`.reduce()`); vision (§1/§3, NG-1). §9/§10/§11 N/A. §20 funding N/A. §21 API N/A (field
shape unchanged). §19 baseline `origin/main` @ `0944c720`.

**Pre-flight verdict:** READY TO EXECUTE (see Gate Verdicts).
**Copilot check verdict:** PASS after 1 wording fold (see Gate Verdicts).

## Gate Verdicts (drafting session, independent subagents)

- **Pre-flight (01.4): READY TO EXECUTE** (independent subagent). No blocking PS-items.
  Verified against real code on `origin/main` @ `0944c720`: `computeTableCooperation`
  structure matches (outcome line + three independent `pickTopSeat` role pushes + combined
  total + solo/all-zero degradation); `pickTopSeat` returns the seat **object reference**
  (deterministic first-max-wins), so grouping by identity is sound; first-appearance
  combat→synergy→rescue order is stable incl. the non-contiguous case. **The flagged
  label-collision risk is NOT real:** `CoachPlayerLine.label` is produced by
  `coachSummary.logic.ts:145` as `Player ${index+1}` from the unique seat id — never the
  game handle — so even Jeff-plays-both-seats yields distinct "Player 1"/"Player 2". Exactly
  ONE existing test ("names the standout co-op roles") needs the intended grouped-shape
  update (Seat 2 wins synergy+rescue → one combined line); all other role tests are
  single-role and unchanged. 2-file allowlist complete (client renders `tableCooperation`
  verbatim one-`<li>`-per-line, field shape `readonly string[]` unchanged → no client/
  coach.logic/coach.types/api-endpoints change). Copy-lint clean (both banned sets,
  word-boundary). Server-only pure derivation. Two RS nits, both folded: (RS-1) group by
  seat **object identity**, not the display label (robust + zero cost) — folded into WP
  Scope + EC Locked Values; (RS-2) add a "no seat label appears in >1 line" assertion —
  folded into EC. No pre-flight re-run warranted (folds are hardening, no scope change).
- **Copilot (01.7): PASS after 1 wording fold** (independent subagent). All load-bearing
  claims re-verified against real code: `computeTableCooperation` structure; `pickTopSeat`
  returns the object reference (identity-grouping sound, deterministic strict-`>`
  first-max-wins); `coachSummary.logic.ts:145` `label` = `Player ${index+1}` (never the
  handle — label-collision confirmed non-real); `EndgameCoachPanel.vue` renders the field
  verbatim one-`<li>`-per-line (no client change); the 2-file allowlist complete + not
  over/under-scoped; the one test change legitimate (intended behavior, not weakening);
  ordering deterministic; copy-lint clean (both banned sets, word-boundary); `.reduce()`
  ban honored; layer/NG-1 clean. One RISK (HOLD): the RS-1 identity-key fold had landed in
  the authoritative EC Locked Values + WP Scope but two subordinate EC sections
  (§Guardrails, §Common Failure Smells) still said "keyed by label" — behaviorally
  identical today (labels unique) but inconsistent. **Folded:** both reconciled to "seat
  identity (the `pickTopSeat` reference)". Per copilot's own note this collapses to CONFIRM
  (the authoritative section was already correct); the fold is wording-only, no scope
  change, no pre-flight re-run.
