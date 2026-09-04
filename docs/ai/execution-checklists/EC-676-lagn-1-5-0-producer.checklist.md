# EC-676 — Result-LAGN 1.5.0 Producer: Battle Plan + Report Card (Execution Checklist)

**Source:** docs/ai/work-packets/WP-641-lagn-1-5-0-producer.md
**Layer:** Server (`apps/server`) + LAGN contract (`packages/lagn-spec`, writer flip)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] Read the producer template: `apps/server/src/match/matchLagn.logic.ts` (`buildResultMatchLagn` ~L497, the pure helpers) + `matchLagn.routes.ts` (the `result-lagn` handler + the `MatchLagnLogic` seam) — the WP-406 shape.
- [ ] Confirm the read helpers on `main`: `readBattlePlan` (`battlePlan.persistence.ts:119`), `readReplayHashByMatchId` (`matchReplay.logic.ts`), `findCompetitiveScore` (`competition.logic.ts:631`), `gradeForFinalScore` (exported from `@legendary-arena/game-engine`, `index.ts:244`).
- [ ] `pnpm --filter @legendary-arena/lagn test` + `pnpm --filter @legendary-arena/server test` + `pnpm -r build` exit 0 (baseline; record counts).

## Locked Values (do not re-derive)

- Writer flip: `validator.ts` `LAGN_VERSION = LAGN_VERSION_1_5_0`; `package.json` `"version": "1.5.0"` — **same commit** (EC-422 manifest lockstep). No `migrate.ts` change.
- `result.score` field sourcing: `raw_score` ← `record.rawScore`; `par_score` ← `record.scoreBreakdown.parScore` (jsonb — there is NO `par_score` column); `final_score` ← `record.finalScore`; `grade` ← `gradeForFinalScore(record.finalScore)` (COMPUTED at write time, never stored); `scoring_config_version` ← `record.scoringConfigVersion`; `par_version` ← `record.parVersion` (the column).
- Score is MATCH-LEVEL — read ANY one row: `matchId → readReplayHashByMatchId → findCompetitiveScore(replayHash)` (LIMIT 1). Do NOT pick a seat / iterate players.
- `result.score` is emitted ONLY when `result` (with its required `outcome`) is emitted, and ONLY when a `competitive_scores` row exists (unscored/casual → omit).
- `battle_plan` ← `readBattlePlan(matchId)` → `{ pre_battle: preBattle, battle_adjustments: battleAdjustments, post_battle: postBattle }`; OMIT the whole block when the row is `null` OR all three phases are null/empty.
- `gradeForFinalScore` imported from `@legendary-arena/game-engine` (the `.` runtime-safe surface — NOT a deep import).

## Guardrails

- `buildResultMatchLagn` stays PURE construction — grows two optional params (`battlePlan`, `score`), does no reads. The route does the reads and injects them (via the `MatchLagnLogic` seam) — the WP-406 separation.
- Both new reads are DOMAIN-TABLE reads (`legendary.battle_plan`, `legendary.competitive_scores`); the `replay_hash` lookup is the blessed D-24187 `bgio.replay_artifacts` surface. **NO new bgio blob carve-out.** Do NOT read the `state`/`log`/`G`/`ctx` blob; the existing composition (D-24153) + gameover (D-24169) reads are UNCHANGED.
- `competitive_scores` is READ ONLY — never written; no submission-flow / credit change. Nothing in the emitted blocks is an authority (D-24214/24215/D-5301 posture).
- The endpoint stays guest-readable; `404 match_not_finished` gate unchanged.
- Scaffold-first for the flip (measure the exact re-pinned validator.test.ts set — don't reason it).
- `result.score` never rides without `result.outcome` (schema nests it; outcome is required).
- **Session ordering:** flip `LAGN_VERSION` → 1.5.0 and `pnpm -r build` the `lagn-spec` dist BEFORE running the server emit tests — the 1.5.0 gate rejects `battle_plan`/`result.score` on a pre-1.5.0 doc, so `apps/server` importing a stale 1.4.0 `dist` would fail every emit test at `validate()`.

## Required `// why:` Comments

- The writer flip (`validator.ts`): why `package.json` bumps in the same commit (EC-422 manifest lockstep); the 1.0.0→1.5.0 chain becomes reachable with no `migrate.ts` change.
- `toResultScore`: why `par_score` comes from `score_breakdown.parScore` (no column) and `grade` is computed via `gradeForFinalScore` (a frozen snapshot, not stored); why any-one-row (match-level score).
- The score omission: why an unscored/casual match omits `result.score` (honest-partial; no fabricated zero).
- `toBattlePlanBlock` omit rule: why an absent/all-empty plan omits the whole block.
- The two new reads: why they need NO blob carve-out (domain tables; `replay_hash` is D-24187), contrast the composition/gameover blob reads.

## Files to Produce

- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` → `LAGN_VERSION_1_5_0` + doc comment
- `packages/lagn-spec/package.json` — **modified** — `"version": "1.5.0"` (same commit)
- `packages/lagn-spec/src/validator.test.ts` — **modified** — re-pin the writer-version + migration-target assertions (measured via scaffold)
- `apps/server/src/match/matchLagn.logic.ts` — **modified** — `buildResultMatchLagn` +2 params; `toResultScore` + `toBattlePlanBlock`; `gradeForFinalScore` import
- `apps/server/src/match/matchLagn.routes.ts` — **modified** — result-lagn handler reads battle_plan + score; extend the `MatchLagnLogic` seam; refresh the `buildResultMatchLagn` JSDoc "1.4.0 as of WP-406" stamp note to 1.5.0 (goes stale on the flip)
- `apps/server/src/match/matchLagn.logic.test.ts` — **modified** — mapper + emit tests (scored / unscored / no-plan; assert `Number.isInteger` on the three emitted score fields — the schema's `.int()` is load-bearing), DB-gated serialized
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified** — the `logicSeam` mock literal (~L107) grows the three new `MatchLagnLogic` members (`readBattlePlan`/`readReplayHashByMatchId`/`findCompetitiveScore`), defaulting to `null` so existing result-lagn cases still emit no `battle_plan`/`result.score` (forced companion of the seam interface change — it won't compile against the old mock)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — THREE rows replaced WHOLE (D-11804): result-lagn (1.5.0 + `battle_plan` + `result.score`), `/lagn` (1.5.0 stamp), `POST /api/me/loadouts` (stale "stays 1.4.0" → 1.5.0)

## After Completing

- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/lagn test` + `@legendary-arena/server test` 0 fail (counts recorded); DB-gated emit test passes locally
- [ ] `Select-String` confirms: `gradeForFinalScore`/`readBattlePlan`/`findCompetitiveScore` present in the producer; no `competitive_scores` INSERT/UPDATE; no new blob read
- [ ] `package.json` version = `1.5.0` in the SAME commit as the flip
- [ ] `docs/ai/DECISIONS.md` — create D-24453 Active (post-execution)
- [ ] `docs/ai/STATUS.md`; `WORK_INDEX.md` WP-641 checked off; `EC_INDEX.md` EC-676 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝 → ✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells

- The flip breaks more validator.test.ts than expected → you reasoned the blast radius instead of scaffolding; run the flip and read the failures.
- `result.score` rides on an unscored match → the null `findCompetitiveScore` wasn't omit-guarded.
- `par_score` is `undefined` → you looked for a `par_score` column; it's `score_breakdown.parScore` in the jsonb.
- Grade drifts from the client's render → both use `gradeForFinalScore`; the producer must not band differently.
- A new blob read appears → you read `competitive_scores` off the blob instead of the domain table, or added a `state`/`log` read — forbidden.
- `package.json` bumped in a separate commit → the EC-422 lockstep is same-commit; a split briefly advertises the wrong version.
- The `/lagn` setup row or the loadouts note left stale → the flip moves BOTH emitters to 1.5.0; all three api-endpoints rows move.
