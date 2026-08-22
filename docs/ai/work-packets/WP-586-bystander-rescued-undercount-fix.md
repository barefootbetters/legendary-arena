# WP-586 — Fix the Bystander-Rescued Undercount in Competitive Scoring

**Status:** Draft 2026-08-22 — executing this session. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (endgame competitive score + grade) + `legends.legendary-arena.com` (leaderboard). The competitive score now credits **every** rescued Bystander, so runs that rescued supply-pile Bystanders no longer score too high (fewer bystander rewards) and no longer mis-grade. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) scoring derivation — a single shared predicate; no other layer.
**Dependencies:** WP-585 / D-24394 (the rulebook-faithful RawScore this counts into); WP-422 / D-24242 (the seed PAR surface + artifacts); the WP-017 supply-pile `BYSTANDER_EXT_ID` model. All landed. Baseline `origin/main` at draft: `ae1b677f`.

## Goal

The competitive score **undercounts rescued Bystanders**. A Bystander reaches a victory pile from **two** sources with different ext-ids:

- **villain-deck Bystanders** — `bystander-villain-deck-NN`, registered in `G.villainDeckCardTypes` as `'bystander'`.
- **supply-pile Bystanders** — `BYSTANDER_EXT_ID` (`'pile-bystander'`), attached to Villains/Masterminds and awarded to a player's victory pile on defeat/rescue. These are **never** entered in `villainDeckCardTypes`.

The scoring-input derivations (`deriveScoringInputs` in `scoring/parScoring.logic.ts` and `deriveScoringInputsFromFinalState` in `simulation/par.aggregator.ts`) test **only** `villainDeckCardTypes[id] === 'bystander'`, so they silently drop every supply-pile Bystander from both `bystandersRescued` (a reward) and `bystanderLost` (a penalty). The VP path (`computeFinalScores`) and the HUD path (`countBystandersRescued`) already use the correct **dual** test — so the three surfaces disagree on what a Bystander is.

Observed in three real Red Skull / Midtown Bank Robbery matches: the endgame credited **8–10** Bystanders rescued while the victory pile / HUD showed **18–26**, under-crediting the bystander reward and mis-grading a Legendary run as **C**.

## User-Visible Impact

The endgame "Bystanders rescued" input and the competitive score now match the victory pile and the HUD rescue count. Because more bystanders are credited (each worth a reward that **lowers** RawScore, lower-is-better), affected scores drop and grades improve to reflect the true rescue count. The PAR-calibration path is corrected by the **same** shared predicate, so PAR and the live score stay symmetric. Existing `competitive_scores` rows are **not** retroactively recomputed — they keep their pinned breakdown; new submissions score correctly.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. The scoring derivation counts bystanders by the NARROW (villain-deck-only) test
grep -q "villainDeckCardTypes\[cardExtId\] === 'bystander'" packages/game-engine/src/scoring/parScoring.logic.ts && echo "A_OK"
# Expected: A_OK

# B. computeFinalScores + countBystandersRescued already use the DUAL test (the correct reference)
grep -q "BYSTANDER_EXT_ID" packages/game-engine/src/scoring/scoring.logic.ts && grep -q "BYSTANDER_EXT_ID" packages/game-engine/src/ui/uiState.build.ts && echo "B_OK"
# Expected: B_OK

# C. BYSTANDER_EXT_ID is the supply-pile token
grep -q "BYSTANDER_EXT_ID: CardExtId = 'pile-bystander'" packages/game-engine/src/setup/pilesInit.ts && echo "C_OK"
# Expected: C_OK
```

## Context (Read First)

- **Root cause is a missing second source, not the instance-id gotcha.** The bug is that `deriveScoringInputs` never checks `BYSTANDER_EXT_ID`; it is not about card instance ids (`#N`). `computeFinalScores` (VP) and `countBystandersRescued` (HUD) are the correct references — both already OR the two conditions.
- **Scoring is server-side, end-of-match, and NOT in the game-state hash.** These derivations read terminal `G` but add no `G` field. Fixing them does **not** touch `finalStateHash` / `PRE_WP080_HASH`. No PAR **artifact** regeneration is needed either — the seed baselines carry their own `bystandersPar` numbers; only live/aggregation derivation from a real terminal state was undercounting.
- **Both the live path and the PAR-calibration path had the bug.** `par.aggregator.ts:deriveScoringInputsFromFinalState` is the sim-side mirror of the live `deriveScoringInputs`. They MUST stay symmetric — a narrow predicate on one side but not the other would skew PAR vs the live score. Sharing one predicate guarantees symmetry.
- **DRY is the fix.** Four hand-copied loops (live rescued + live lost + sim rescued + sim lost) plus two correct sites is exactly the drift that let two of them diverge. One exported predicate is the single source of truth.

## Scope (In)

**Game Engine only:**
- `scoring/scoring.logic.ts` — **add** `export function isBystanderCard(gameState, cardExtId): boolean` (`villainDeckCardTypes[id] === 'bystander' || id === BYSTANDER_EXT_ID`); refactor `computeFinalScores`' victory-pile bystander branch to call it.
- `scoring/parScoring.logic.ts` — `deriveScoringInputs`: route the `bystandersRescued` (victory-pile) and `bystanderLost` (escapedPile) loops through `isBystanderCard`.
- `simulation/par.aggregator.ts` — `deriveScoringInputsFromFinalState`: route the `bystandersRescued` and `bystanderLost` loops through `isBystanderCard`; import it.
- `ui/uiState.build.ts` — `countBystandersRescued`: refactor its already-correct dual test to call `isBystanderCard` (single source of truth; drop the now-unused `BYSTANDER_EXT_ID` value import).
- `scoring/parScoring.logic.test.ts` — **add** a regression describe block: a victory pile mixing a villain-deck bystander with supply-pile `BYSTANDER_EXT_ID` bystanders counts BOTH (rescued); an escapedPile with a supply-pile bystander counts it (lost); non-vacuous `notEqual` guards.

## Out of Scope

- Weights, rewards, penalties, the moral hierarchy, PAR baselines — unchanged.
- PAR seed artifact regeneration — **not** required (no formula/weight change; the fix corrects derivation from a real terminal state, not the baseline numbers).
- Any retroactive recompute of `competitive_scores` — none.
- Any `G` / move / fixture change — none; derivation only.
- The `bystander-guardian` badge (still deferred) — untouched.

## Files Expected to Change

- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** (new exported helper + refactor)
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified**
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified (new regression tests)**
- `docs/ai/DECISIONS.md` / `STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

Single layer (game-engine); single-session lane.

## Contract (Locked by D-24395)

- **One exported predicate** `isBystanderCard(gameState, cardExtId)` in `scoring.logic.ts` is the sole definition of "Bystander in a pile," used by `computeFinalScores`, `countBystandersRescued`, `deriveScoringInputs` (rescued + lost), and `deriveScoringInputsFromFinalState` (rescued + lost).
- The **live** and **PAR-calibration** paths share it — symmetric by construction.
- **No game-state-hash re-pin** (server-side derivation, no `G` field); both oracles byte-identical.
- **No retroactive recompute** of existing `competitive_scores` rows (pinned breakdown preserved — the WP-585 precedent).

### Determinism / persistence
No engine `G` / fixture / move touched → `finalStateHash` / `PRE_WP080_HASH` byte-identical (verify via the green replay/sentinel suites). No PAR artifact change. `competitive_scores` rows keep their pinned breakdown.

## Acceptance Criteria

1. `isBystanderCard` exists and is exported from `scoring.logic.ts`; it returns true for a villain-deck bystander AND for `BYSTANDER_EXT_ID`.
2. `deriveScoringInputs` and `deriveScoringInputsFromFinalState` count supply-pile bystanders in `bystandersRescued` (victory piles) and `bystanderLost` (escapedPile) — proven by the regression tests with `notEqual` guards.
3. `computeFinalScores` and `countBystandersRescued` call the shared predicate (no hand-copied dual test remains); their behavior is unchanged.
4. No production `villainDeckCardTypes[...] === 'bystander'` bystander-count loop remains outside `isBystanderCard` (reveal-path/AI keyword checks are a different concern and stay).
5. No game-state-hash re-pin (both oracles byte-unchanged); engine tests green; `pnpm -r --no-bail test` no new failures.

## Verification Steps

```bash
# The only bystander victory/escaped count predicate is the shared helper
grep -rn "=== 'bystander'" packages/game-engine/src --include=*.ts | grep -v ".test.ts" | grep -vE "reveal|ai\.competent|scoring\.logic\.ts:.*isBystanderCard|// "; echo "expect only the isBystanderCard definition line"
pnpm --filter @legendary-arena/game-engine build && pnpm --filter @legendary-arena/game-engine test 2>&1 | tail -5   # replay/sentinel green = no hash re-pin
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -6
# Live (post-deploy; D-24026): finish a ranked match whose victory pile holds supply-pile bystanders; the endgame "Bystanders rescued" and the competitive score reflect ALL rescued bystanders (match the HUD / victory pile).
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–C passed
- [ ] All 5 Acceptance Criteria pass
- [ ] Verification Steps produce expected output (live step post-deploy)
- [ ] One shared predicate; all six count sites route through it; live + PAR symmetric
- [ ] No game-state-hash re-pin (both oracles byte-unchanged); no `G`/move/fixture change
- [ ] engine + `pnpm -r --no-bail` green
- [ ] `docs/ai/STATUS.md` Done entry names WP-586 + D-24026 operator-pending
- [ ] `docs/ai/DECISIONS.md` D-24395 landed Active
- [ ] WORK_INDEX + EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-621:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed (operator-pending)

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-22)
Dependencies verified on `main` @ `ae1b677f`. Root cause confirmed by inspecting all six bystander-count sites: two (VP, HUD) OR the dual condition; four (live rescued/lost, sim rescued/lost) test only `villainDeckCardTypes`. **Mutation boundary:** scoring is server-side, no `G`/hash/fixture; both oracles untouched. No PAR artifact regeneration (no weight/formula change). The reveal-path `cardType === 'bystander'` branch and the AI `keyword === 'bystander'` check are a different concern (villain-deck reveal handling / AI hints) and correctly stay narrow.

### Copilot (`01.7`) — verdict: **PASS** (2026-08-22)
Layer boundary (game-engine scoring derivation only) — clean. Determinism (server-side; no game-state hash; no `G` field) — clean. Contract fidelity (one shared predicate; live + PAR symmetric; matches the already-correct VP/HUD reference) — clean. Scope (derivation only; no weights, no artifacts, no retroactive recompute) — clean. **RISK considered:** asymmetry between live and PAR (mitigated — both call the same helper); accidentally widening a reveal/AI check (avoided — those stay narrow by design); hash drift (impossible — no `G` change, verified by the green replay/sentinel suites). Locked in AC-1..AC-4 + D-24395.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)
§1–§21 pass; closed allowlist across engine scoring/ui/simulation + one test + governance; `node:test`; `// why:` on the new predicate and each refactored loop citing the two-source model + D-24395; §17 N/A; §20 N/A; §21 N/A (no endpoint or `apps/server/src/**` library-function signature change — the derivation is internal to the engine). No ❌ triggers.

## Vision Alignment
**Clauses touched:** §10 (rulebook fidelity — the score now credits every rescued Bystander, as the game does), §20-26 (scoring model — corrects a derivation bug; weights/hierarchy unchanged), §22 (determinism — server-side scoring, no game-state hash change). **Conflict assertion:** `No conflict` — fixes a counting bug without altering determinism, weights, or any game rule. **Non-Goal proximity:** none. **Determinism:** no engine `G`/fixture → both hash oracles byte-identical.

## Funding Surface Gate
**N/A** — a scoring-correctness fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function signature change. The `POST /api/competition/scores` + `GET /api/me/scores` response shapes are unchanged (the same `bystandersRescued`/`bystanderLost` fields, now correctly valued). `docs/ai/REFERENCE/api-endpoints.md` unaffected.
