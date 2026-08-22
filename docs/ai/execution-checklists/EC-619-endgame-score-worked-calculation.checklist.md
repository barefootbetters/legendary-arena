# EC-619 — Endgame Score Worked Calculation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-584-endgame-score-worked-calculation.md
**Layer:** Arena Client (`apps/arena-client`) — display only

## Before Starting
- [ ] Preconditions A–C in WP-584 pass (WP-583 breakdown+grade present; `CompetitiveScoreBreakdown` client type present; no `buildWorkedScoreCalc` yet)
- [ ] `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` exit 0 (baseline)

## Locked Values (do not re-derive)
- **Formula-first** (operator): symbolic formula → substituted → products → raw; then `Final = Raw − PAR → Grade`.
- **Whole numbers** (operator): centesimal integers as shown today; NO ÷100.
- Formula shape: `Raw = (Rounds × 50) + Penalties − (Bystanders × 200) − (VP × 10)`.
- Per-term weights are **DERIVED** from the breakdown (`product ÷ count`, guard `count > 0`) — NEVER hardcoded client-side. A zero-count term shows its `0` product with no invented weight.
- Values rendered VERBATIM from `record.scoreBreakdown` (WP-578 / D-24387) — never recomputed.
- Use the true minus glyph `−` (U+2212), matching the rest of the panel.

## Guardrails
- Arena-client ONLY. NO engine / server / persistence / migration / hash change. `competitionApi.ts` UNCHANGED (the WP-583 `scoreBreakdown` shape already carries every field).
- Weights MUST be derived, not literal — a grep for `× 50` / `× 200` / `× 10` in the helper source must find nothing (they're computed).
- The worked-calc block is gated on the optional breakdown; guests / pending / no-breakdown records still render the WP-578 headline + WP-583 grade badge unchanged (no crash).
- Accessible: each worked line has an `aria-label`; meaning is in the text, not colour.
- Pure helper `vfx/scoreCalcDisplay.ts` — no Vue import; testable standalone (the `menaceDisplay`/`gradeDisplay` split).
- `for...of` never `.reduce()`; round any displayed number is N/A (values are already integers from the server).

## Required `// why:` Comments
- On the derived-weight rationale (no client-side weight duplication → no drift from engine).
- On the MINUS glyph choice.
- On the worked-calc computed in the component (formula-first; verbatim).

## Files to Produce
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — **new** — `buildWorkedScoreCalc`
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts` — **new**
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — worked-calc block + computed + styles
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified**

## After Completing
- [ ] `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` exit 0 (worked-calc + helper tests green; grade/null-degrade unchanged)
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn reverted
- [ ] No `packages/game-engine` / `apps/server` / migration diff (`git diff --name-only`)
- [ ] Live-on-surface (D-24026): finish a ranked match; the endgame panel shows the worked formula + `Final = Raw − PAR → grade`
- [ ] `docs/ai/STATUS.md` updated (names WP-584; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24393 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-584 node `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- The shown weight is wrong for a game with different weights → a weight was hardcoded instead of derived.
- vue-tsc error on the breakdown shape → tried to change `competitionApi.ts` (it should be untouched — WP-583's shape suffices).
- A hash oracle moved / engine file in the diff → strayed out of the client-only scope.
- The formula vanishes a term some games → a zero-count term isn't degrading gracefully (should show its 0 product).
