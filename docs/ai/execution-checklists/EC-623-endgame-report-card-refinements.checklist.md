# EC-623 — Endgame Report Card: Per-Player Split, PAR Basis, Colour-Coded Grade Scale (Execution Checklist)

**Source:** docs/ai/work-packets/WP-588-endgame-report-card-refinements.md
**Layer:** Game Engine (per-player data) + Arena Client (display). No server change.

## Before Starting
- [ ] Preconditions A–C in WP-588 pass (no perPlayer yet; PAR keyed on scheme::mastermind::villains; grade scale is the WP-587 list)
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0; replay/sentinel green (hashes must stay byte-identical)

## Locked Values (do not re-derive)
- `ScoringInputs.perPlayer?: PlayerScoringContribution[]` = `{ playerId, victoryPoints, bystandersRescued }`, sorted by playerId; deep-copied in buildScoreBreakdown (no alias, D-2801 / D-4806).
- perPlayer is a DISPLAY-ONLY split — it sums to the team `victoryPoints` + `bystandersRescued`; the score stays a TEAM score (D-4803). Optional (synthetic PAR inputs + old rows carry none).
- PAR is set by scheme + mastermind + villain groups (ScenarioKey + composeScenarioDifficulty) — NOT henchmen. The copy states this accurately.
- Grade scale = horizontal colour strip; colour is REINFORCEMENT (current cell also has a text marker + aria-current). Client owns colours + words.
- NO server change (jsonb pass-through). NO scoringConfigVersion bump. NO game-state-hash re-pin.

## Guardrails (execution order matters)
1. `parScoring.types.ts`: add `PlayerScoringContribution` + optional `perPlayer` on `ScoringInputs`.
2. `parScoring.logic.ts`: `import type { PlayerScoringContribution }`; in `deriveScoringInputs` build `perPlayer` (iterate `finalScoreSummary.players`, VP = totalVP, bystanders = isBystanderCard count in that player's victory pile); add `perPlayer` to the return; deep-copy it in `buildScoreBreakdown` (map to new objects; conditional-spread so `perPlayer: undefined` is never set under exactOptionalPropertyTypes).
3. `index.ts`: barrel-export `PlayerScoringContribution`.
4. Rebuild the engine BEFORE the arena-client typecheck.
5. `competitionApi.ts`: `CompetitivePlayerContribution` + optional `perPlayer` on `CompetitiveScoringInputs`.
6. `scoreCalcDisplay.ts`: `buildPerPlayerSplit` (Player-N labels, 1-based; fallback for non-numeric id) + optional `perPlayer` on `WorkedScoreCalc` (type it `| undefined` for exactOptionalPropertyTypes).
7. `EndgameSummary.vue`: (a) "By player" block under the raw-score block (`v-if="workedCalc.perPlayer"`); (b) PAR-basis `<p>` under the PAR derivation (names scheme/mastermind/villain groups); (c) replace the `.grade-scale-list` `<ul>` with a horizontal `.grade-scale-strip` of `.grade-scale-cell`s, per-grade colour classes, current cell emphasised; add the CSS.
8. Tests: engine per-player split (sum-invariant, sorted, copied); arena-client per-player display + component (per-player block, PAR-basis text, grade-scale cells + colour classes + current). UPDATE the WP-587 grade-scale test (`.grade-scale-row` → `.grade-scale-cell`).

- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP.
- **No server edit** (jsonb pass-through). **No score change** — perPlayer must SUM to the team totals; the team aggregates stay authoritative.
- **PAR basis must be accurate** — verify against parScoring.keys.ts + generate-seed-par.mjs before writing the copy; do NOT say henchmen.

## Required `// why:` Comments
- On `perPlayer` (type + derivation + copy): display-only split, sums to team totals, no G field, cite D-24397 / D-4803.
- On the PAR-basis copy: ScenarioKey + composeScenarioDifficulty = scheme/mastermind/villains, not henchmen.
- On the grade-strip: colour is reinforcement, current cell also text + aria-current.

## Files to Produce
- `packages/game-engine/src/scoring/parScoring.types.ts`, `parScoring.logic.ts`, `index.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts`, `components/hud/EndgameSummary.vue` — **modified**
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts`, `components/hud/EndgameSummary.test.ts` — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+ new tests); replay/sentinel green
- [ ] `pnpm -r build`; `(cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test)` green
- [ ] `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn reverted
- [ ] Live-on-surface (D-24026): 2p report card shows per-player VP+bystanders, the coloured grade strip with your cell marked, and the PAR-basis line
- [ ] STATUS names WP-588 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24397 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- per-player VP/bystanders don't sum to the team totals → a derivation bug (double-count or drop); the sum-invariant test catches it.
- `exactOptionalPropertyTypes` error on `perPlayer` → the optional field / return needs the conditional-spread or `| undefined`.
- WP-587 grade-scale test fails on `.grade-scale-row` → update it to `.grade-scale-cell`.
- A hash oracle moved → you touched a game-state field; scoring must not.
