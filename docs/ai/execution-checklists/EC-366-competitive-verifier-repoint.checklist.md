# EC-366 — Competitive Verifier Repoint onto the Faithful Reducer Path (WP-3b) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-336-competitive-verifier-repoint.md
**Layer:** Server (`apps/server/**`) — engine NOT modified (B1, engine-clean)

## Before Starting
- [ ] D-24119/24121/24122 Active; WP-334/335/332/053 Done
- [ ] WP-335 capture populates `bgio.replay_artifacts` + `legendary.replay_ownership`; WP-334 `reduceMatchToFinalState` works
- [ ] `pnpm install` + `pnpm -r build` exit 0; capture the `apps/server` baseline (which DB tests skip w/o `TEST_DATABASE_URL`)
- [ ] Target file set == the WP `Files Expected to Change` allowlist; anything outside (esp. `packages/**`) is a FAIL

## The Load-Bearing Decision (D-24123 — do not re-open)
- **Rounds = TURN count, fed engine-clean (Option B1).** PAR baselines were calibrated with `rounds = turnCount` (`par.aggregator.ts` `turnsElapsed`). The verifier must feed the reduced match's **turn count** into `deriveScoringInputs`'s rounds slot — NOT move count, NOT the non-automatic entry count (both miscalibrate; entry-count Option A was REJECTED).
- **Engine-clean:** do NOT edit `packages/game-engine/**`. `parScoring.logic.ts` keeps reading `replayResult.moveCount`; the verifier passes `turnCount` into that slot with a `// why:` documenting the overload. The honest engine-proxy rename (retiring `moveCount`, D-4801) is deferred to WP-4.
- **No live competitive score exists** (path inert today), so nothing shifts — but this WP sets the scale of every future score. The turnCount derivation is therefore a SCAFFOLD-VERIFY gate, not a guess.

## Locked Values (do not re-derive)
- `MatchReplayResult` gains `turnCount: number` (additive; existing `{ finalState, stateHash }` destructures unaffected)
- `reduceMatchToFinalState({ initialState, log }) → { finalState, stateHash, turnCount }`
- `readReplayArtifactByHash(replayHash, db) → { initialState, log } | null` — `SELECT initial_state, log FROM bgio.replay_artifacts WHERE replay_hash = $1`
- `reduceReplayByHash(replayHash, db) → { finalState, stateHash, turnCount } | null` — composes read + reduce; `null` when the artifact is absent
- `SubmissionDependencies = { reduceReplay, checkParPublished }` — DROPS `loadReplay`, `replayGame`, `registry`
- `reduceReplay: (replayHash, db) => Promise<{ finalState, stateHash, turnCount } | null>`; production impl = `reduceReplayByHash`
- Endpoint UNCHANGED: `POST /api/competition/scores`, `authenticated-session-required`, req `{ replayHash }`, res `{ record, wasExisting }`, status map unchanged
- Reserves D-24123

## turnCount ↔ turnsElapsed Reconciliation (mandatory scaffold-verify)
- [x] Derive `turnCount` in `reduceMatchToFinalState` reconciled to `par.aggregator.ts` `turnsElapsed`. **Execution result:** derived from the LOG's live-recorded per-entry `turn` (`maxPlayTurn − FIRST_PLAY_TURN`, floored 1), NOT the reduced `ctx.turn` — the scaffold-verify showed reduction did not reproduce `ctx` faithfully for multi-turn games (D-24124).
- [x] Scaffold-verified: drove 0/1/2/5/12 real turns through the reducer; reduced `turnCount` == the sim's `turnsElapsed` floor at every count, AND (post-D-24124 fix) reduced final G hash == live final G hash at every count. Formula + `FIRST_PLAY_TURN = 2` documented in code.

## Guardrails
- Steps 1-6 (guest / ownership / owner / visibility / idempotency fast-path / PAR gate) BYTE-UNCHANGED — they read `legendary.replay_ownership` (WP-335 populates it) + `checkParPublished`
- Step 7-8 collapse to `const reduced = await deps.reduceReplay(replayHash, database)`; `reduced === null` → `replay_verification_failed` (mirrors the old null-`loadReplay` no-throw contract, D-5304)
- Step 9 hash-compare KEPT: `reduced.stateHash !== replayHash` → fail (artifact-integrity + lookup-consistency anti-tamper; D-5301)
- Step 10 feeds `{ finalState: reduced.finalState, stateHash: reduced.stateHash, moveCount: reduced.turnCount }` to `deriveScoringInputs` (turnCount in the moveCount/rounds slot)
- Remove the `loadReplay` / `replayGame` engine imports from `competition.logic.ts`; `replay_blobs`/`storeReplay`/`loadReplay` themselves are NOT deleted (offline replay-producer + own tests keep them)
- `registry` dropped from `SubmissionDependencies` + `CompetitiveSubmissionProductionDependencies` + `competition.routes.ts` + `server.mjs` wiring (reducer needs no `CardRegistryReader`)
- Engine untouched (`git diff --name-only packages/` empty); no `computeStateHash` change; no determinism fixture re-pin; `pg.Pool` reused; no new npm dep; no `Math.random`

## Required `// why:` Comments
- `competition.logic.ts` step 10: why `turnCount` is passed into the `moveCount` slot (rounds = turn count per D-24123; PAR calibrated on turns; engine proxy rename deferred to WP-4)
- `competition.logic.ts` step 9: why the hash-compare is kept after the reduce (anti-tamper + lookup consistency, D-5301)
- `matchReplay.logic.ts` `turnCount`: why it is reconciled to `par.aggregator` `turnsElapsed` (must match the PAR calibration)
- `matchReplay.logic.ts` `reduceReplayByHash` null: why a missing artifact returns `null` (verifier maps it to `replay_verification_failed`, not a throw)

## Files to Produce
- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `turnCount` + `readReplayArtifactByHash` + `reduceReplayByHash`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified** — turnCount assert (scaffold-verified) + DB-gated read round-trip
- `apps/server/src/competition/competition.logic.ts` — **modified** — seam swap + steps 7-10 repoint + import cleanup
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — migrate fixtures + retry spies to `{ reduceReplay, checkParPublished }`; assert rounds == turnCount; + incidental `player_badges` `beforeEach` cleanup fix
- `apps/server/src/competition/competition.routes.test.ts` — **modified** (execution-added) — `makeDeps` drops `registry`
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **modified** — migrate fixture-seed deps
- `apps/server/src/competition/competition.routes.ts` — **modified** — deps (drop `registry`, add `reduceReplay`)
- `apps/server/src/server.mjs` — **modified** — `registerCompetitionRoutes` wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — endpoint row + Library-only rows (§21)
- `docs/ai/DECISIONS.md` — **modified** — D-24123
- `docs/ai/STATUS.md` — **modified** — infrastructure-only entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-336 row

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (repoint + migrated fixtures green; baseline preserved; DB-gated verified locally where feasible)
- [ ] turnCount↔turnsElapsed reconciliation scaffold-verified + documented
- [ ] Grep: `reduceReplay`/`turnCount` present in `competition.logic.ts`; `loadReplay`/`replayGame`/`replay_blobs`/`registry` ABSENT from it
- [ ] `git diff --name-only packages/` empty (engine untouched)
- [ ] `api-endpoints.md` endpoint row + Library-only rows updated (§21)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff: capture→submit→score chain functional end-to-end at the server; scores use the calibration-correct turn count)
- [ ] `docs/ai/DECISIONS.md` D-24123 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Every live competitive score is 5-15× too harsh → the verifier fed move count (or entry count) instead of turnCount into the rounds slot (D-24123 violated)
- A valid submitted replay returns `replay_verification_failed` → `reduceReplayByHash` read `replay_blobs` instead of `bgio.replay_artifacts`, or the hash-compare compares the wrong value
- Build red in `packages/**` → the engine was edited (B1 says engine-clean; the proxy rename is WP-4)
- `competition.logic.test.ts` red on `registry` → a test still injects the dropped `registry` dep
- turnCount off-by-one vs PAR → the lobby-turn offset was not subtracted; re-run the scaffold-verify against a simulated match
