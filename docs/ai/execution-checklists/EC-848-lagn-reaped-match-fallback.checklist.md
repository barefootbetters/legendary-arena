# EC-848 — Finished matches stay viewable after the reaper (Execution Checklist)

**Source:** docs/ai/work-packets/WP-811-lagn-reaped-match-fallback.md
**Layer:** Server (+ one migration)

## Before Starting
- [ ] Baseline `origin/main` includes the reserve (#2785) and the WP-811 draft. `pnpm install`, `pnpm -r build` → 0; `pnpm --filter @legendary-arena/server test` → 1767 tests, 0 fail, 207 skipped.
- [ ] Re-read the anchors (all `~`):
  - `matchLagn.logic.ts` `:~92-121` (`readMatchConfigurationForLagn`), `:~349-366` (`readMatchGameover`), `:~381-392` (`toLagnResult`)
  - `matchLagn.routes.ts` `:~148-205`, `:~215-313` and `seatIdentities.routes.ts` `:~121-185` (the 404 mappings; comment-only edits)
  - `matchReaper.js` `:~39-43`, `:~83-91`; `captureHarvester.js` `:~33`, `:~44-50`, `:~73-106`
  - `matchCapture.logic.ts` `:~84-134`; `matchReplay.logic.ts` `:~375-398` (`readMatchForReplay` returns `metadata`), `:~506-520`
  - `game.ts` `:~510` (`endIf` = `evaluateEndgame(G)`); `competition.logic.ts` `:~54`
  - migrations `025` (no `gameover`, no `match_id` index) and `045` (latest)
- [ ] Check #2779 (D-24717), #2780 (D-24718) and WP-810 (#2784 drafted; its execution) on `main`. #2779 merged → AC 8 applies. WP-810 executed → rebase the ARCHITECTURE / rules text onto its D-24716 clause.

## Locked Values (do not re-derive)
- **Migration** `data/migrations/046_add_replay_artifact_gameover.sql`:
  - `ALTER TABLE bgio.replay_artifacts ADD COLUMN IF NOT EXISTS gameover jsonb;`
  - `CREATE INDEX IF NOT EXISTS replay_artifacts_match_id_idx ON bgio.replay_artifacts (match_id);`
  - `CREATE INDEX IF NOT EXISTS replay_artifacts_gameover_missing_idx ON bgio.replay_artifacts (replay_hash) WHERE gameover IS NULL;`
- **Reader fallback SQL:** `SELECT initial_state FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1` and `SELECT gameover FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1`, used **only** when the live `bgio.matches` row is absent.
- **`VERDICT_NOT_RECORDED`** = exported `Object.freeze({})` (`StoredGameover`), returned for an artifact whose `gameover` is SQL `NULL`.
- **Capture INSERT:** `(replay_hash, match_id, scenario_key, initial_state, log, gameover)`, `$6 = serializeStoredGameover(artifact.metadata)` (`JSON.stringify(metadata.gameover)`, or `null` when absent / `null` / non-object metadata).
- **Sweep** `fillMissingArtifactGameovers(database, batchSize)`:
  - `SELECT replay_hash, initial_state, log FROM bgio.replay_artifacts WHERE gameover IS NULL LIMIT $1`
  - per row `reduceMatchToFinalState(…)`; `stateHash === replay_hash` → `evaluateEndgame(finalState) ?? {}`; hash mismatch → `{}` + full-sentence `console.error`; a throwing reduction → `{}` + full-sentence `console.error`
  - `UPDATE bgio.replay_artifacts SET gameover = $2 WHERE replay_hash = $1 AND gameover IS NULL`; returns the sum of each UPDATE's `rowCount`
- **`ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE = 5`.** Harvester calls the sweep once per scan, after the capture loop, in its own `try/catch`; logs only when N > 0.
- **Docs:** each `api-endpoints.md` row's Authorizing WP gains `WP-811 / D-24719`. `.claude/rules/architecture.md` D-24119 parenthetical names the artifact `gameover` derivation. ARCHITECTURE D-24119 replacement ("never written back" narrowed to `bgio.matches`; the verdict is a D-24122 artifact-store write) + D-24153 / D-24169 insertions, `.claude/rules/architecture.md` parentheticals, `api-endpoints.md` three rows (`/lagn`, `/result-lagn`, `/seat-identities`) replaced whole + footer — WP Locked Values verbatim.

## Guardrails
- No edit to `packages/**`, any client app, the reaper, or WP-810's files. `matchLagn.routes.ts` / `seatIdentities.routes.ts`: comments only. No route, status, body, auth or `Cache-Control` change.
- The live row always wins. Never fall back for a live row with a null `initial_state` or a live in-progress match.
- The fallback never reads the artifact `log`; only the sweep does, through `reduceMatchToFinalState`, and its sole output is `evaluateEndgame` of the final `G`.
- The sweep never overwrites a stored verdict (`AND gameover IS NULL`), never exceeds the batch size per scan, and never stores a verdict from a re-execution whose hash differs from `replay_hash`.
- Do not change legends-board's "Draw" label here; D-24719 records it and the follow-up.
- No new D-24095 carve-out: amend the D-24153 / D-24169 / D-24119 clauses in place; the carve-out count is unchanged. Writes go only to `bgio.replay_artifacts.gameover`, never `bgio.matches`.
- `captureHarvester.test.ts`: change only the scheduler test's counting (scans, not every pool call); its three assertions keep their values.
- Any server test failure beyond the harvester scheduler test = STOP and diagnose (the scaffold observed none).

## Required `// why:` Comments
- Each reader's fallback branch (D-24719; the reaper deletes the live row ~1h after gameover).
- `projectConfigurationForLagn`: one projection keeps the live and artifact objects identical (the `isDebugMatch` gates depend on it).
- `LIMIT 1` on the artifact reads (one artifact per finished match).
- `VERDICT_NOT_RECORDED` (an artifact means finished; `null` would be a false `match_not_finished`).
- The capture INSERT's `gameover` column; `ARTIFACT_GAMEOVER_SWEEP_BATCH_SIZE` (event-loop cost per row); `AND gameover IS NULL`; the hash-equality check (today's engine may not reproduce an old capture); the `{}` on a throwing (pure, so repeating) reduction; the decisive-artifact precondition in the test.
- The harvester's sweep call and its swallowed catch; the migration's column and both indexes.
- The harvester test's `countScans` helper.

## Files to Produce
- `data/migrations/046_add_replay_artifact_gameover.sql` — **new**
- `apps/server/src/match/matchLagn.logic.ts` + `.test.ts` (+8), `matchLagn.routes.test.ts` (+4), `seatIdentities.routes.test.ts` (+1) — **modified**
- `apps/server/src/match/matchLagn.routes.ts`, `seatIdentities.routes.ts` — **modified (comments only)**
- `apps/server/src/replay/matchCapture.logic.ts` + `.test.ts` (+8, 1 strengthened; the verdict test uses a decisive `SCHEME_LOSS`-latched artifact and asserts the UPDATE text), `captureHarvester.js` + `.test.ts` (+2, 1 counting change) — **modified**
- `docs/ai/ARCHITECTURE.md`, `.claude/rules/architecture.md`, `docs/ai/REFERENCE/api-endpoints.md` — **modified**
- `docs/ai/DECISIONS.md` (D-24719), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **governance close**

## After Completing
- [ ] `pnpm -r build` → 0; server suite → 1790 tests (1791 with AC 8), 0 fail; `pnpm -r --no-bail test` → 0 fail.
- [ ] Local DB with 046 applied: DB-gated `matchCapture.logic.test.ts` → 0 fail, 0 skipped. CI Server DB Tests green.
- [ ] Revert proofs (a)–(e) per WP AC 9, each restored. `git status --porcelain --untracked-files=all` ⊆ allowlist; revert `lagn-v1.json` CRLF churn.
- [ ] Run a read-only prod count of `bgio.replay_artifacts WHERE gameover IS NULL` (or ask Jeff to) and record the legacy backlog in D-24719.
- [ ] D-24719 Active (every WP DoD clause). STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-848:` then `SPEC:`) with a `Tests-changed:` trailer for `captureHarvester.test.ts` and `matchCapture.logic.test.ts`.
- [ ] D-24026 live-verify after deploy (WP DoD steps 1–5): the pre-deploy `gameover IS NULL` count and the post-drain `'{}'` count; `MAYLMfB1PM9` on all three endpoints (`result.outcome` once the backlog clears, unless its hash no longer reproduces) + its legends-board label before and after the sweep; a fresh autoplay match ≥ 80 min after game over on all three endpoints; the legends-board view + download; STATUS flip.

## Common Failure Smells
- **Still 404 after deploy:** migration 046 not applied (check the deploy log), or the fallback keys on `replay_hash` instead of `match_id`.
- **`match_not_finished` for an old match:** the legacy branch returns `null` instead of `VERDICT_NOT_RECORDED`.
- **Live matches slow down / sockets stall every 5 min:** the sweep is unbatched or ran before the capture loop.
- **The Hall of Legends shows the wrong winner for an old match:** the hash check was skipped.
- **The same artifact is re-reduced every scan:** the throwing-reduction branch did not store `{}`, or the UPDATE lost its `replay_hash` key.
- **Harvester scheduler test counts off by one per scan:** it still counts every pool call.
- **An operator match shows on the Hall of Legends after reaping (with #2779 merged):** the fallback built a different object than the live read.
