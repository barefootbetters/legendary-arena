# EC-384 — Ranked Eligibility Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-354-ranked-eligibility-gate.md
**Layer:** Server + Persistence (`apps/server/src/{competition,leaderboards}`, `data/migrations`). **Lane:** Standard two-session (migration + `competitive_scores` contract field + scoring-path behavior + leaderboard read filter).

## Before Starting
- [ ] Fresh worktree off `origin/main`. Highest migration on disk is `028`; next free is `029`.
- [ ] Confirm hard-deps on `main`: WP-350 `areAllMutualFriends`, WP-333 `readSeatAccounts`, WP-338 `submitCompetitiveScoreByMatchIdForRequest`, migration 027 `player_count`. All ✅.
- [ ] Read: `competition.logic.ts` (submission path + INSERT ~703 + the 3 row-mapping SELECTs at 264/454/481), `competition.types.ts` (`CompetitiveScoreRecord`), `match/seatAccount.logic.ts` (`readSeatAccounts`), `friendships/friendships.logic.ts` (`areAllMutualFriends`), `leaderboards/leaderboard.logic.ts` (ranked SELECT ~184 + COUNT ~199).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- **Migration `029`:** `ALTER TABLE legendary.competitive_scores ADD COLUMN IF NOT EXISTS is_ranked_eligible boolean NOT NULL DEFAULT true;` — additive + idempotent; default `true` keeps all existing rows + solo runs ranked.
- **Eligibility formula:** `areAllMutualFriends(pool, readSeatAccounts(matchId).map(s => s.accountId))`. `n ≤ 1` ⇒ `true` (solo/guest/empty roster vacuous). Bots/guests are absent from `readSeatAccounts` (D-24120).
- **Evaluation timing:** ONCE, at submission (`submitCompetitiveScoreByMatchIdForRequest`); stored on the row; never re-evaluated / back-filled (FR-7). A resubmit returns the original row's flag (idempotency fast-path).
- **Fail-safe:** any throw in the roster read or clique query ⇒ `is_ranked_eligible = false` (Casual), and the submission **still succeeds** (never a crash).
- **Threading:** compute in `byMatchId` (has `matchId`) via a private `computeRankedEligibility(matchId, pool)` (try/catch → false); thread through `submitCompetitiveScoreForRequest` (new defaulted param `isRankedEligible = true`) into `submitCompetitiveScoreImpl`'s `SubmissionDependencies` (`isRankedEligible?: boolean`); the INSERT writes `dependencies.isRankedEligible ?? true`. Default `true` keeps the by-hash path (no matchId) vacuously ranked.
- **Row plumbing:** add `is_ranked_eligible` to `CompetitiveScoreRow` + `mapCompetitiveScoreRow` (→ `isRankedEligible`), and `cs.is_ranked_eligible` to ALL three row-mapping SELECTs (`findExistingByAccountAndHash`, `findCompetitiveScore`, `listPlayerCompetitiveScores`) + the INSERT column list + `RETURNING` + outer SELECT. `CompetitiveScoreRecord` gains `readonly isRankedEligible: boolean` (additive; key count 13 → 14 — update the JSDoc key list).
- **Leaderboard filter:** add `AND cs.is_ranked_eligible = true` to the ranked page SELECT **and** its parallel COUNT (identical WHERE). The owner My-Scores read (`listPlayerCompetitiveScores`) is **NOT** filtered — column selected, no WHERE change.
- **Scoring math untouched:** `raw_score` / `final_score` / PAR byte-identical (§25(a) — eligibility is a binary flag, never a score input).
- Reserved decision: **D-24146** (flips to Active at execution close).

## Guardrails
- No cross-layer import beyond the server set (`readSeatAccounts`, `areAllMutualFriends` are same-layer). No `boardgame.io`/engine/registry import in new code.
- No change to the score value, PAR normalization, replay hash, or the submission's request/response envelope (only the additive `isRankedEligible` view field).
- Same-WHERE invariant: the leaderboard SELECT and COUNT get the **identical** eligibility clause.

## Required `// why:` Comments
- On the fail-safe-to-Casual try/catch in `computeRankedEligibility`.
- On the evaluate-once / no-back-fill timing.
- On the `?? true` default (by-hash path / vacuous solo).
- On the leaderboard filter being added to both SELECT and COUNT (same-WHERE invariant).

## Files to Produce
- `data/migrations/029_add_ranked_eligibility_to_competitive_scores.sql` — new.
- `apps/server/src/competition/competition.logic.ts` — eligibility compute + threading + INSERT column + row plumbing.
- `apps/server/src/competition/competition.types.ts` — additive `isRankedEligible` (D-24146).
- `apps/server/src/leaderboards/leaderboard.logic.ts` — ranked SELECT + COUNT filter.
- `apps/server/src/competition/competition.logic.test.ts` — eligibility cases.
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — filter cases.
- `docs/ai/REFERENCE/api-endpoints.md` — `GET /api/me/scores` row (whole-row replace, +`isRankedEligible`).
- Governance: `DECISIONS.md` (D-24146 → Active), `STATUS.md`, `WORK_INDEX.md` (WP-354 `[x]`), `EC_INDEX.md` (EC-384 Done), `05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md`.

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (extended competition + leaderboard suites; DB-less skip parity; baseline otherwise unchanged).
- [ ] Migration `029` applied to a real Postgres; a `psql`/suite smoke of the clique vs non-clique paths.
- [ ] `Select-String competition.logic.ts -Pattern "areAllMutualFriends|readSeatAccounts|is_ranked_eligible"` present; `leaderboard.logic.ts -Pattern "is_ranked_eligible = true"` present (×2); migration grep present.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24146 Active) / WORK_INDEX (WP-354 `[x]`) / EC_INDEX (EC-384 Done) / mindmap ✅ / wiki; `api-endpoints.md` `GET /api/me/scores` row updated same-commit (D-11804 / §21); `roadmap:counts:check` green.
- [ ] `User-Visible Surface = legends leaderboard + My-Scores` → **D-24026 operator-pending on deploy** (non-clique multiplayer run absent from ranked board, present Casual on My-Scores; clique run ranks).

## Common Failure Smells
- A friendship-infra throw breaking score submission (must fail-safe to Casual, never crash).
- Solo runs going un-ranked (must be `n ≤ 1` vacuous + default `true`).
- Bots counted in the roster (`readSeatAccounts` already excludes them).
- The COUNT filter drifting from the SELECT filter (both must get the clause).
- Retroactive eligibility flips (evaluate-once-store; no back-fill).
- Missing `cs.is_ranked_eligible` in one of the row-mapping SELECTs → `undefined` on that read surface.
- Filtering the My-Scores read (it must stay unfiltered — the player sees their own Casual runs).
