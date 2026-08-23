# WP-588 — Endgame Report Card: Per-Player Split, PAR Basis, Colour-Coded Grade Scale

**Status:** Draft 2026-08-22 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame report card). Three operator-requested refinements: (a) a line naming what sets PAR, (b) a wider colour-coded grade scale, (c) the raw-score reward terms broken down per player. D-24026 live-verification applies.
**Primary Layer:** Game Engine (per-player data) + Arena Client (display). No server change (jsonb pass-through).
**Dependencies:** WP-583/584/585/586/587 (the endgame score surface these refine); WP-020 `computeFinalScores` (per-player VP). All landed. Baseline `origin/main` at draft: `bc4b4277`.

## Goal

Three operator-requested refinements to the endgame report card (the WP-587 surface):

1. **PAR basis.** State what sets PAR. Verified against the code: PAR is keyed on the `ScenarioKey` (`scheme::mastermind::sorted-villain-groups`, `parScoring.keys.ts`) and calibrated by `composeScenarioDifficulty` (`0.40×mastermind + 0.40×scheme + 0.20×avg(villains)`, `generate-seed-par.mjs`) — i.e. the **scheme, mastermind, and villain groups**, **not** henchmen (the operator asked "…and henchmen, right?"; the honest answer is no).
2. **Grade scale styling.** Make it wider, not longer, and add colour — a horizontal, colour-coded strip instead of the WP-587 vertical list.
3. **Per-player split.** Break the raw-score reward terms (Bystanders, VP) down by player, so each seat sees its own contribution.

## User-Visible Impact

Under the raw-score block, a "By player" row shows each player's own VP and rescued bystanders (they sum to the team totals in the calc). Under the PAR derivation, a quiet line reads "Set by this scenario — its scheme, mastermind, and villain groups." The grade scale becomes a horizontal strip of six colour-coded cells (Legendary→F), with the earned cell emphasised (thicker border, heavier tint, "your score" marker). Records persisted before WP-588 have no per-player data, so the "By player" block is simply omitted for them.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. ScoringInputs has no per-player field yet; computeFinalScores gives per-player totalVP
grep -q "readonly perPlayer" packages/game-engine/src/scoring/parScoring.types.ts && echo "A_FAIL: already present" || echo "A_OK"
grep -q "playerBreakdown.totalVP" packages/game-engine/src/scoring/parScoring.logic.ts && echo "A2_OK"
# Expected: A_OK, A2_OK

# B. PAR is keyed on scheme::mastermind::villain-groups (no henchmen)
grep -q "schemeSlug}::\${mastermindSlug}::" packages/game-engine/src/scoring/parScoring.keys.ts && echo "B_OK"
# Expected: B_OK

# C. The grade scale is the WP-587 vertical list today
grep -q "grade-scale-list" apps/arena-client/src/components/hud/EndgameSummary.vue && echo "C_OK"
# Expected: C_OK
```

## Context (Read First)

- **The competitive score is a shared-team score (D-4803).** VP and bystanders are summed across players. The per-player split is a **display-only reconciliation** — it must sum to the team totals; it never changes the score.
- **Per-player data is already computed.** `computeFinalScores(G)` returns `FinalScoreSummary.players[]` (sorted by playerId) with each player's `totalVP`. Per-player bystanders re-count from that player's own victory pile via the shared `isBystanderCard` predicate (WP-586).
- **Scoring is server-side, end-of-match, and NOT in the game-state hash.** `perPlayer` is derived from terminal `G` and adds no `G` field, so `finalStateHash` / `PRE_WP080_HASH` are untouched. No `scoringConfigVersion` bump (additive display data).
- **The server is a jsonb pass-through** for the breakdown (`scoreBreakdown: row.score_breakdown`), so a new `ScoringInputs` field rides along with **no server change**; old rows lack it (client type optional).
- **PAR keying — verified, not assumed.** `buildScenarioKey` = `scheme::mastermind::villain-groups`; `composeScenarioDifficulty` weights mastermind/scheme/villains only. Henchmen are not a factor — the copy says so accurately.

## Scope (In)

**Game Engine:**
- `scoring/parScoring.types.ts` — add `PlayerScoringContribution` (`playerId` / `victoryPoints` / `bystandersRescued`) and an optional `perPlayer?` on `ScoringInputs`.
- `scoring/parScoring.logic.ts` — `deriveScoringInputs` populates `perPlayer` (VP = each player's `totalVP`; bystanders via `isBystanderCard` on that player's victory pile); `buildScoreBreakdown` deep-copies it (no alias, D-2801 / D-4806).
- `index.ts` — barrel-export `PlayerScoringContribution`.

**Arena Client:**
- `lib/api/competitionApi.ts` — `CompetitivePlayerContribution` + optional `perPlayer?` on `CompetitiveScoringInputs`.
- `vfx/scoreCalcDisplay.ts` — `buildPerPlayerSplit` (labels 0-based ids as "Player N"); optional `perPlayer` on `WorkedScoreCalc`.
- `components/hud/EndgameSummary.vue` — a "By player" block under the raw score; a PAR-basis line under the PAR derivation; the grade scale re-rendered as a horizontal colour-coded strip.

**Tests:** engine per-player split (sums to team totals, sorted, copied); arena-client per-player display + component render (per-player block, PAR-basis copy, grade-scale cells + colour classes + current marking).

## Out of Scope

- Any change to the score itself (it stays a team score, D-4803); weights, PAR, grade bands — unchanged.
- Any server route/library/persistence change (jsonb pass-through); any `scoringConfigVersion` bump.
- Any `G` / move / fixture change.
- Per-player penalty attribution (only the reward terms — VP, bystanders — split; penalties stay team-level).

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.types.ts`, `parScoring.logic.ts`, `index.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified (new tests)**
- `apps/arena-client/src/lib/api/competitionApi.ts`, `vfx/scoreCalcDisplay.ts`, `components/hud/EndgameSummary.vue` — **modified**
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts`, `components/hud/EndgameSummary.test.ts` — **modified (new tests)**
- `docs/ai/DECISIONS.md` / `STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

Cross-layer (engine + arena-client); single-session lane.

## Contract (Locked by D-24397)

- `perPlayer` is a **display-only split** that sums to the team `victoryPoints` + `bystandersRescued`; the score stays a team score (D-4803). Deep-copied through `buildScoreBreakdown` (no alias). Optional — synthetic PAR inputs and pre-WP-588 rows carry none.
- The PAR-basis copy names **scheme + mastermind + villain groups** (code-verified), never henchmen.
- The grade scale's colour is **reinforcement**: the current cell also carries a text marker + `aria-current` (D-24392 not-colour-alone rule preserved).
- **No server change** (jsonb pass-through); **no game-state-hash re-pin** (no `G` field); **no `scoringConfigVersion` bump**.

### Determinism / persistence
No engine `G` / fixture / move touched → `finalStateHash` / `PRE_WP080_HASH` byte-identical (verify via the green replay/sentinel suites). No PAR artifact change. New rows carry `perPlayer` in their jsonb; old rows do not.

## Acceptance Criteria

1. `deriveScoringInputs` returns `perPlayer`, sorted by playerId, whose VP and bystanders each sum to the team aggregate; `buildScoreBreakdown` carries a deep-copied (non-aliased) `perPlayer`.
2. The client renders a "By player" block from `breakdown.inputs.perPlayer` with "Player N" (1-based) labels and each player's VP + bystanders; omitted when absent.
3. The PAR-basis line names the scheme, mastermind, and villain groups.
4. The grade scale renders as a horizontal strip of six colour-coded cells; the earned cell is marked by text + `aria-current` (not colour alone).
5. No game-state-hash re-pin (both oracles byte-unchanged); engine + arena-client (`vue-tsc`) + `pnpm -r --no-bail test` green.

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -4   # replay/sentinel green = no hash re-pin
pnpm -r build && (cd apps/arena-client && pnpm vue-tsc --noEmit && pnpm test 2>&1 | tail -3)
pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a 2p ranked match; the report card shows per-player VP + bystanders, the colour-coded grade strip with your cell marked, and the PAR-basis line.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed
- [ ] All 5 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] perPlayer sums to team totals; score stays team-level; PAR-basis copy accurate; grade colour is reinforcement
- [ ] No game-state-hash re-pin (both oracles byte-unchanged); no `G`/move/fixture change; no scoringConfigVersion bump; no server change
- [ ] engine + arena-client `vue-tsc` + `pnpm -r --no-bail` green; `lagn-v1.json` CRLF churn reverted
- [ ] `docs/ai/STATUS.md` Done entry names WP-588 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24397 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-623:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)
Dependencies verified on `main` @ `bc4b4277`. PAR keying verified against the code (ScenarioKey + composeScenarioDifficulty) — the operator's "henchmen" premise is corrected, and the copy states the accurate basis. Per-player data source confirmed (`computeFinalScores` per-player `totalVP` + `isBystanderCard` per victory pile). **Mutation boundary:** scoring is server-side, no `G`/hash/fixture; no scoringConfigVersion bump; server jsonb pass-through so no server change. Old-row degradation handled (optional field).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)
Layer boundary (engine data + client display; no server) — clean. Determinism (server-side; no `G` field; no hash re-pin) — clean. Contract fidelity (per-player split sums to team totals, score stays team-level; PAR-basis copy code-verified; grade colour reinforced by text) — clean. Scope (display refinements; no score/weight/PAR change) — clean. **RISK considered:** a per-player split diverging from the team totals (pinned by a sum-invariant test); asserting a false PAR basis (avoided — verified against keys.ts + generate-seed-par.mjs); colour-only signalling (avoided — text marker + aria-current). Locked in AC-1..AC-4 + D-24397.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across engine scoring/index + arena-client api/vfx/hud + tests + governance; `node:test`; `// why:` on the new field, the per-player derivation, the PAR-basis copy, and the grade-strip styling; §17 N/A; §20 N/A; §21 N/A (no endpoint or `apps/server/src/**` library-function signature change — the returned breakdown widens by one optional jsonb field via pass-through). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §20-26 (scoring legibility — shows each player's contribution and what sets PAR; no scoring change), §22 (determinism — server-side, no game-state hash change), §24 (competitive integrity — display only, team score unchanged). **Conflict assertion:** `No conflict` — adds legibility without altering determinism, weights, the team-score model, or any game rule. **Non-Goal proximity:** none. **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — an endgame-legibility display change; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function signature change. The `POST /api/competition/scores` + `GET /api/me/scores` response shapes gain one optional nested jsonb field (`scoreBreakdown.inputs.perPlayer`) via pass-through; no server route/library contract changes. `docs/ai/REFERENCE/api-endpoints.md` unaffected.
