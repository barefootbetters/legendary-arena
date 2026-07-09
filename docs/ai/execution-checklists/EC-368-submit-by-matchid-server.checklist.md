# EC-368 — Submit-by-MatchId + On-Demand Capture + `GET /api/me/scores` (WP-5a) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-338-submit-by-matchid-server.md
**Layer:** Server (`apps/server/**`) — engine NOT modified, no migration

## Before Starting
- [ ] D-24122/24124/24125 Active; WP-332/335/336 Done; `pnpm -r build` 0; capture the `apps/server` baseline (which DB tests skip w/o `TEST_DATABASE_URL`)
- [ ] Read `submitCompetitiveScoreImpl` (WP-053/336) — it is REUSED UNCHANGED; you are adding a matchId-resolving front-end, not editing the 16-step body
- [ ] Read `captureMatch` (WP-335, callable standalone), `findReplayOwnership` (LIMIT 1), `updateReplayVisibility`, `listPlayerCompetitiveScores`
- [ ] Target file set == the WP `Files Expected to Change` allowlist

## The Operator Decisions (do not re-open)
- **Submit by matchId + on-demand capture.** The endpoint takes `{ matchId }`; the server resolves the `replayHash` (lookup by `match_id`, else `captureMatch(matchId)` on-demand). The client never sends a `replayHash`.
- **Submitting auto-publishes.** The caller's ownership is promoted `private → public` before the verify (submission = consent-to-publish).

## Locked Values (do not re-derive)
- `POST /api/competition/scores` req `{ matchId: string }` (was `{ replayHash }`); res `{ record, wasExisting }`; auth `authenticated-session-required`; status `{200,400,401,403,404,409,422,500}`
- `GET /api/me/scores` res `{ scores: CompetitiveScoreRecord[] }`; auth `authenticated-session-required`; status `{200,401,403,500}`
- `readReplayHashByMatchId(matchId, db)` → `string | null` — `SELECT replay_hash FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1`
- `findReplayOwnershipForAccount(accountId, replayHash, db)` → `ReplayOwnershipRecord | null` — `WHERE p.ext_id = $1 AND ro.replay_hash = $2`
- New reason `match_not_finished` → HTTP `409`
- Reserves D-24126

## The `submitCompetitiveScoreByMatchId` flow (exact order)
1. guest guard → `guest_not_eligible`
2. **gameover gate** — read `bgio.matches` metadata; not finished (no `gameover`) → `match_not_finished` (409). Do NOT capture/score an unfinished match (scoring is end-of-match only, D-4804)
3. **resolve `replayHash`** — `readReplayHashByMatchId(matchId)`; if `null` → `captureMatch(matchId)` on-demand, use its `replayHash`; a `not_replayable` capture → `replay_verification_failed`
4. **caller's ownership** — `findReplayOwnershipForAccount(accountId, replayHash)` (NOT `findReplayOwnership`'s LIMIT-1 arbitrary row); none → `not_owner`
5. **auto-publish** — if that ownership `visibility === 'private'` → `updateReplayVisibility(ownershipId, 'public')`
6. **delegate** — `submitCompetitiveScoreImpl(identity, replayHash, database, deps)` (unchanged; its ownership/visibility(now public)/idempotency/PAR/reduce/verify/score run)

## Guardrails
- `submitCompetitiveScoreImpl` byte-unchanged — the 16-step verify+score is reused, not edited
- Use `findReplayOwnershipForAccount` (by-account) for steps 4-5 so a legitimate co-owner (2 authenticated seats) is not mis-rejected by `findReplayOwnership`'s LIMIT-1 arbitrary row — do NOT "fix" `findReplayOwnership` here (separate WP-053 follow-up; flag it)
- On-demand `captureMatch` is safe only AFTER the gameover gate (step 2) — never capture an unfinished match
- New reason `match_not_finished` goes in BOTH `SUBMISSION_REJECTION_REASONS` (canonical array) AND the `SubmissionRejectionReason` union; update the drift test; map to 409 in the route status map
- `GET /api/me/scores`: `Cache-Control: no-store` first statement; same WP-112→WP-107 auth chain as the POST; guest/suspended rejected
- Server + persistence reads only; engine untouched; no migration; `pg.Pool` reused; no new npm dep; no `Math.random`

## Required `// why:` Comments
- `matchReplay.logic.ts` `readReplayHashByMatchId` LIMIT 1: why one row per finished match (capture writes one artifact per match)
- `replayOwnership.logic.ts` `findReplayOwnershipForAccount`: why a by-account lookup (co-owner disambiguation vs `findReplayOwnership`'s LIMIT-1)
- `competition.logic.ts` gameover gate: why unfinished → `match_not_finished`, no capture (end-of-match-only scoring, D-4804)
- `competition.logic.ts` on-demand capture: why capture at submit (the harvester's 5-min scan may not have run; the reaper capture-guard keeps the row alive)
- `competition.logic.ts` auto-publish: why submit promotes visibility to public (submission = consent-to-publish, operator decision D-24126)

## Files to Produce
- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `readReplayHashByMatchId`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified**
- `apps/server/src/identity/replayOwnership.logic.ts` — **modified** — `findReplayOwnershipForAccount`
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.logic.ts` — **modified** — `submitCompetitiveScoreByMatchId`
- `apps/server/src/competition/competition.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.types.ts` — **modified** — request shape + `match_not_finished`
- `apps/server/src/competition/competition.routes.ts` — **modified** — matchId body, 409, `GET /api/me/scores`
- `apps/server/src/competition/competition.routes.test.ts` — **modified**
- `apps/server/src/server.mjs` — **modified** — 01.5 wiring
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — both endpoint rows + Library-only rows
- `docs/ai/DECISIONS.md` — **modified** — D-24126
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/server test` 0 (new by-matchId flow + GET-scores + helper tests green; baseline preserved; DB-gated verified locally where feasible)
- [ ] Grep: `matchId` in `competition.types.ts`; `submitCompetitiveScoreImpl` 16-step body unchanged (`git diff` shows only additive context around it)
- [ ] `git diff --name-only packages/` empty (engine untouched); no new file under `data/migrations/`
- [ ] `api-endpoints.md` both endpoint rows + Library-only rows updated (§21)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24126 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Every first-time submit → `visibility_not_eligible` → the auto-publish (step 5) was skipped or ran after the delegate
- A legit 2-player co-owner → `not_owner` → you used `findReplayOwnership` (LIMIT 1) instead of `findReplayOwnershipForAccount`
- Submitting an unfinished match scores garbage → the gameover gate (step 2) is missing; on-demand capture ran on a non-final state
- Submit at gameover → `replay_not_found` → the on-demand `captureMatch` was not called when the artifact was absent (you assumed the 5-min scan had run)
- Drift test red → `match_not_finished` added to the union but not the canonical array (or vice versa)
