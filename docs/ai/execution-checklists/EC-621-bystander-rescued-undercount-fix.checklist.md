# EC-621 — Fix the Bystander-Rescued Undercount in Competitive Scoring (Execution Checklist)

**Source:** docs/ai/work-packets/WP-586-bystander-rescued-undercount-fix.md
**Layer:** Game Engine (scoring derivation) — one shared predicate; no other layer.

## Before Starting
- [ ] Preconditions A–C in WP-586 pass (derivation uses the narrow test; VP+HUD already dual; BYSTANDER_EXT_ID is 'pile-bystander')
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0; note the count (2852/0 at draft) and that replay/sentinel are green (hashes must stay byte-identical)

## Locked Values (do not re-derive)
- The predicate: `isBystanderCard(gameState, cardExtId) = villainDeckCardTypes[cardExtId] === 'bystander' || cardExtId === BYSTANDER_EXT_ID`.
- `BYSTANDER_EXT_ID = 'pile-bystander'` (supply-pile token; never in `villainDeckCardTypes`).
- Six count sites, ALL routed through the helper: `computeFinalScores` (VP), `countBystandersRescued` (HUD), `deriveScoringInputs` rescued + lost, `deriveScoringInputsFromFinalState` rescued + lost.
- NO weight/formula/artifact change. NO `G` field. NO retroactive recompute.

## Guardrails (execution order matters)
1. `scoring/scoring.logic.ts`: add `export function isBystanderCard(...)` (import `BYSTANDER_EXT_ID` already present); refactor the `computeFinalScores` victory-pile bystander `else if` to call it.
2. `scoring/parScoring.logic.ts`: `import { computeFinalScores, isBystanderCard }`; route the `bystandersRescued` (victory) + `bystanderLost` (escapedPile) loops through it.
3. `simulation/par.aggregator.ts`: add `isBystanderCard` to the `scoring.logic.js` import; route the `bystandersRescued` + `bystanderLost` loops through it.
4. `ui/uiState.build.ts`: add `isBystanderCard` to the `scoring.logic.js` import; refactor `countBystandersRescued` to call it; DROP the now-unused `BYSTANDER_EXT_ID` value import (keep `WOUND_EXT_ID`).
5. `scoring/parScoring.logic.test.ts`: import `BYSTANDER_EXT_ID` from `../setup/pilesInit.js`; add a `makeTerminalStateWithVictoryPile` builder + a regression describe block (rescued counts BOTH sources; lost counts a supply-pile bystander in escapedPile; `notEqual` guards for non-vacuity).

- **Determinism:** scoring is server-side; NO `G`/move/fixture change → both hash oracles byte-identical. If a hash oracle moves, STOP — you strayed out of scope.
- **Do NOT widen the reveal path or AI check.** `villainDeck.reveal.ts` `cardType === 'bystander'` (reveal handling) and `ai.competent.ts` `keyword === 'bystander'` (AI hint) are different concerns — leave them narrow.
- **No artifact regeneration.** This is not a weight/formula change; the seed baselines' `bystandersPar` numbers are untouched. Do NOT run `par:seed:generate`.

## Required `// why:` Comments
- On `isBystanderCard`: the two-source Bystander model (villain-deck vs supply-pile) + why one predicate (single source of truth), cite D-24395 / WP-586.
- On each refactored derivation loop: the old narrow test dropped supply-pile bystanders, undercounting the score; live + PAR share the helper to stay symmetric.

## Files to Produce
- `packages/game-engine/src/scoring/scoring.logic.ts` — **modified** (new exported helper + refactor)
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified**
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified (new regression tests)**

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+3 new tests); replay/sentinel green (hash oracles byte-unchanged)
- [ ] `grep -rn "=== 'bystander'"` in `packages/game-engine/src` (non-test) returns only the `isBystanderCard` definition + the reveal/AI lines (which are a different concern)
- [ ] `pnpm -r build`; `pnpm -r --no-bail test` — no new failures; `lagn-v1.json` CRLF churn reverted if it appears
- [ ] Live-on-surface (D-24026): endgame "Bystanders rescued" + competitive score reflect ALL rescued bystanders (match the HUD / victory pile)
- [ ] STATUS names WP-586 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24395 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)
- A hash oracle moved → you touched a game-state field; scoring must not.
- `tsc` error on an unused `BYSTANDER_EXT_ID` in `uiState.build.ts` → you kept the value import after switching to the helper.
- The regression test passes even with the narrow predicate → your fixture used a villain-deck bystander instead of `BYSTANDER_EXT_ID`; it must use the supply-pile token to be non-vacuous.
- A widened reveal/AI check → out of scope; those stay narrow.
