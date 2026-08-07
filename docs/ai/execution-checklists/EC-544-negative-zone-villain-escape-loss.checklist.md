# EC-544 — Negative Zone Villain-Escape Loss + Retire Generic ESCAPE_LIMIT (Execution Checklist)

**Source:** docs/ai/work-packets/WP-509-negative-zone-villain-escape-loss.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-508 / D-24314 + D-24315 merged on `main` (`escaped-pile-count` kind, `applyEscapedPileResourceLoss`, twist-proxy suppression). Baseline `1b5dd42e`.
- [ ] EXACT target file set = the six files in `Files to Produce`. Any edit outside is a FAIL — surface as a blocker.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `... test` exits 0 (record baseline pass count).

## Locked Values (do not re-derive)
- Negative Zone: `core/negative-zone-prison-breakout`, `resourceLossCondition: { kind: 'escaped-pile-count', cardType: 'villain', threshold: 12 }` (reuse the WP-508 kind — NO new kind).
- Villains ONLY: count `'villain'`-typed escaped-pile entries via `countEscapedPileByType(G, 'villain')`. NEVER the `ESCAPED_VILLAINS` counter (it includes henchmen). Rulebook §"Schemes that Count Escaped Villains".
- `ESCAPE_LIMIT` (`= 8`) + its `index.ts` export are **retained**; removed only from `evaluateEndgame`'s loss branch. Kept for `coopOutcome.ts` + `sweep.analyze.ts`.
- Scheme-loss key: `ENDGAME_CONDITIONS.SCHEME_LOSS`; set by the existing escape-path check.

## Guardrails
- `evaluateEndgame` stays counter-only; remove ONLY the `escapedVillains >= ESCAPE_LIMIT` branch (+ its unused local + the `ESCAPE_LIMIT` import). Do not reorder the other four branches.
- `coopOutcome.ts`: KEEP the `escapedVillains >= ESCAPE_LIMIT` branch, the `ESCAPE_LIMIT` import, and the `'loss-villains-escaped'` category. ONLY reword the stale "load-bearing invariant" comment to a loss-cause heuristic. Do NOT touch `COOP_OUTCOME_CATEGORIES` or `CoopGameRecord` (`coopWinRate.ts`).
- No new `resourceLossCondition` kind → `schemeResourceLoss.ts` and `schemeTwistConfig.types.ts` are NOT touched.
- `sweep.analyze.ts` is OUT OF SCOPE (reads the retained counter).
- No `.reduce()`; no new `G` field; no `boardgame.io`/registry import added.
- Hash oracles (`finalStateHash`, `PRE_WP080_HASH`) MUST stay byte-identical (no `G` shape change). Any drift → STOP and diagnose; never blind-re-pin. Outcome changes (matches that previously hit the 8-escape proxy) are expected in outcome/simulation tests, NOT in the state hashes.

## Required `// why:` Comments
- `schemeTwistConfigs.ts` Negative Zone: why `cardType: 'villain'` (villains-only per rulebook §Escaped Villains; henchmen excluded) and why `lossThreshold` is now inert (proxy suppressed).
- `endgame.evaluate.ts`: why the `escapedVillains >= ESCAPE_LIMIT` branch is removed (D-24317 — villain-escape losses are per-scheme via `SCHEME_LOSS`).
- `coopOutcome.ts`: why the check is now a loss-cause heuristic, not tied to a removed `evaluateEndgame` condition.

## Files to Produce
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** — Negative Zone `resourceLossCondition` (escaped-pile-count, villain, 12).
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — remove the `escapedVillains >= ESCAPE_LIMIT` branch + unused local + import.
- `packages/game-engine/src/simulation/coopOutcome.ts` — **modified** — reword the invariant comment (branch/import/category kept).
- `packages/game-engine/src/rules/schemeResourceLoss.test.ts` — **modified** — villain escaped-pile-count threshold + villains-only-mixed-pile tests.
- `packages/game-engine/src/rules/schemeHandlers.test.ts` — **modified** — Negative Zone proxy-suppressed (replaces the 8-twist-stack test).
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — escapes alone no longer end the game; drop the inert `ESCAPED_VILLAINS: ESCAPE_LIMIT` line from the MATCH_ENDED_EARLY test.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; `... test` exits 0 (record delta).
- [ ] **`pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson).**
- [ ] Control check: reverting the Negative Zone config row fails AC-2 (non-vacuous), then restore.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical; `pnpm sim:runtime-observed:check` current.
- [ ] `pnpm -r build` exits 0; `git diff --name-only` = the six-file allowlist + governance only.
- [ ] Live-on-surface verification (D-24026) performed or explicitly operator-pending (Negative Zone continues past 8 escapes, loses at 12).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — D-24316 + D-24317 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]` with date; `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅`; `roadmap:counts:write` + `roadmap:counts:check` exits 0.

## Common Failure Smells
- Negative Zone still ends at twist 8 → `resourceLossCondition` not added (proxy not suppressed).
- Negative Zone ends at 8 escapes → the `evaluateEndgame` branch was not removed.
- A henchman escape drives Negative Zone toward the loss → counting the `ESCAPED_VILLAINS` counter instead of `'villain'`-typed pile entries.
- `coopOutcome.test.ts` fails → the branch/category was removed instead of just the comment being reworded (keep them).
- Whole-workspace test red while engine-only is green → a cross-package consumer (engine-runner / simulation) depended on the 8-escape outcome; investigate before re-pinning.
