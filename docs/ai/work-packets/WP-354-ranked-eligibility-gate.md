# WP-354 — Ranked Eligibility Gate: Friendship-Clique Check at Score Submission (Server)

**Status:** Draft 2026-07-11 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (D-24028 — NOT lightweight: migration + a `competitive_scores` contract field + a scoring-path behavior change + a leaderboard read filter). Pairs with **EC-384** (authored at execution-prep). Reserves **D-24146** (lands at execution).
**Primary Layer:** Server + Persistence (`apps/server`, `data/migrations`)
**User-Visible Surface:** `legends.legendary-arena.com` / the public leaderboard (a multiplayer run with a non-clique roster is recorded but **excluded** from the ranked board) + the owner My-Scores view (an ineligible run shows as **Casual**). **D-24026 live-verify APPLIES.**
**Dependencies:** WP-350 (`areAllMutualFriends` clique helper) ✅ **Done (PR #672)**; WP-333 (`readSeatAccounts(matchId)` — the match's authenticated human roster) ✅; WP-338 (`submitCompetitiveScoreByMatchIdForRequest` — the submission path) ✅; WP-344/migration 027 (`player_count` on `competitive_scores`) ✅. **No unmerged dependency — this packet is executable now.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution). Highest migration on disk is `028`; next free is `029`.

---

## Goal

Make a multiplayer competitive run count for the leaderboard **only if its human players are a mutual-friend clique** — the trust boundary the whole Friends & Ranked Trust subsystem exists to protect (charter FR-6/FR-7/FR-8). At score submission (`submitCompetitiveScoreByMatchIdForRequest`), read the match's authenticated roster (`readSeatAccounts`), run `areAllMutualFriends` over it, and record the result as `is_ranked_eligible` on the `competitive_scores` row (evaluated **once**, at the terminal submission — immutable thereafter, FR-7). The public leaderboard read filters to eligible rows; an ineligible multiplayer run is still recorded and visible on the player's own My-Scores as **Casual**. Solo / single-account runs are vacuously eligible (`n ≤ 1`), so nothing about the existing single-player ranked experience changes.

---

## User-Visible Impact

A group of strangers who queue a multiplayer match and submit a score no longer lands on the public ranked leaderboard — the run is recorded but marked Casual. A crew of mutual friends is ranked normally. Solo runs are unaffected (always eligible). On the owner My-Scores view, an ineligible run reads "Casual (players were not all mutual friends)" instead of a rank.

---

## Assumes

- **`readSeatAccounts(matchId, db)` returns the authenticated human roster.** `apps/server/src/match/seatAccount.logic.ts:72` — `(playerId, accountId)` pairs; bots/guests have no row (absent, D-24120). This is exactly the human-player set the clique check evaluates. (Verified.)
- **`areAllMutualFriends(pool, accountIds)` is the pure clique predicate (WP-350).** `n ≤ 1` → `true` (vacuous); accepted-pair count `== C(n,2)`; order/dup-independent. Solo runs pass automatically. (Verified: `apps/server/src/friendships/friendships.logic.ts`.)
- **`submitCompetitiveScoreByMatchIdForRequest` owns the by-matchId submission + auto-publish (WP-338/D-24126).** `apps/server/src/competition/competition.logic.ts:371`; the `INSERT INTO legendary.competitive_scores (... outcome, player_count)` is at ~708. The eligibility computation slots in before that INSERT; `is_ranked_eligible` becomes a new insert column. (Verified.)
- **The leaderboard ranked read is a single locked SELECT + parallel COUNT.** `apps/server/src/leaderboards/leaderboard.logic.ts:184/199` — `... FROM legendary.competitive_scores cs ... WHERE cs.scenario_key = $1 ...`. The eligibility filter (`AND cs.is_ranked_eligible = true`) is added to both the SELECT and the COUNT (identical WHERE, per the module's stated invariant). (Verified.)
- **`competitive_scores` has `player_id`, `outcome`, `player_count`.** Migration `029` adds `is_ranked_eligible boolean NOT NULL DEFAULT true`. (Verified: migrations 007/026/027.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the charter. **This packet implements the Ranked eligibility contract** (full-clique, snapshot). It is the ranked-gate half of the charter's "packet #5"; the **lobby-invite-flow half is split out** (see Out of Scope / the split note) because it depends on multiplayer-lobby UX that this packet does not touch.
- `apps/server/src/competition/competition.logic.ts` — the submission path (`submitCompetitiveScoreByMatchIdForRequest` → `submitCompetitiveScoreImpl`) + the `competitive_scores` INSERT.
- `apps/server/src/match/seatAccount.logic.ts` — `readSeatAccounts` (the roster source).
- `apps/server/src/friendships/friendships.logic.ts` — `areAllMutualFriends` (the predicate).
- `apps/server/src/leaderboards/leaderboard.logic.ts` — the ranked SELECT + COUNT to filter.
- `docs/01-VISION.md §23/§24/§25` — the co-op competition model; §25(a) forbids cumulative-count ranking inputs (friendship is binary, not a count). The gate is a trust boundary, not a scoring input.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the `GET /api/me/scores` row gains an `isRankedEligible` response field (same-commit at execution).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `node:` built-ins; `.test.ts`; human-style code per `00.6`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- No cross-layer import beyond the server set; no `boardgame.io`/engine/registry import in the new code.

**Packet-specific:**
- **Evaluate once, immutable (FR-7).** Eligibility is computed exactly once, at submission, and stored on the row. A later unfriend/block never rewrites a submitted row's `is_ranked_eligible` (no back-fill, no re-evaluation job).
- **Full clique over the human roster (FR-6).** Eligibility = `areAllMutualFriends(pool, readSeatAccounts(matchId).map(s => s.accountId))`. Bots/guests are absent from the roster (never counted). `n ≤ 1` → eligible (solo unaffected).
- **Fail-safe direction = Casual, never a crash.** If the roster read or the clique query throws, the submission does **not** fail; the run is recorded as **not** ranked-eligible (`is_ranked_eligible = false`) with a `// why:` — a friendship-infra hiccup must never break score submission, and defaulting to Casual is the conservative (leaderboard-integrity-preserving) direction.
- **Leaderboard filter is additive + symmetric.** The `AND cs.is_ranked_eligible = true` clause is added to **both** the ranked SELECT and its parallel COUNT (the module's same-WHERE invariant); no other leaderboard behavior changes. The owner My-Scores read is **not** filtered (the player sees their own Casual runs).
- **No scoring-math change.** `raw_score` / `final_score` / PAR normalization are byte-identical; eligibility is an orthogonal flag, never a score input (§25(a)).
- Migration `029` is additive + idempotent (`ADD COLUMN IF NOT EXISTS`), default `true` so every existing row stays ranked (back-compat: pre-gate history is unaffected).

**Session protocol:**
- If the exact INSERT column list or the leaderboard WHERE is unclear, stop and read `competition.logic.ts` / `leaderboard.logic.ts` — do not guess the SQL.

---

## Scope (In)

### A) Migration `029_add_ranked_eligibility_to_competitive_scores.sql`
- `ALTER TABLE legendary.competitive_scores ADD COLUMN IF NOT EXISTS is_ranked_eligible boolean NOT NULL DEFAULT true;` (default `true` = existing rows + solo runs stay ranked). Idempotent.

### B) `competition.logic.ts` (submission gate)
- In `submitCompetitiveScoreByMatchIdForRequest` (or the shared `submitCompetitiveScoreImpl` it delegates to), before the `competitive_scores` INSERT: `const roster = await readSeatAccounts(matchId, pool); const isRankedEligible = await areAllMutualFriends(pool, roster.map(s => s.accountId));` wrapped so a throw ⇒ `isRankedEligible = false` (fail-safe to Casual). Add `is_ranked_eligible` to the INSERT column list + `RETURNING`.
- Thread `isRankedEligible` onto the mapped `CompetitiveScore` record.

### C) `competition.types.ts` (additive field — D-24146)
- `CompetitiveScoreView` (the `GET /api/me/scores` item + `findCompetitiveScore` shape) gains `isRankedEligible: boolean`. Additive; existing fields byte-identical.

### D) `leaderboard.logic.ts` (ranked read filter)
- Add `AND cs.is_ranked_eligible = true` to the ranked-leaderboard SELECT **and** its parallel COUNT (identical WHERE). No change to the owner My-Scores read.

### E) `api-endpoints.md` (D-11804, at execution)
- Update the `GET /api/me/scores` row (response gains `isRankedEligible`); whole-row replace.

### F) Tests
- `competition.logic.test.ts` (extend): a 2-account clique roster → `is_ranked_eligible = true`; a 2-account non-clique roster → `false`; a solo roster (`n = 1`) → `true`; an empty/guest roster → `true` (vacuous); a thrown roster/clique query → `false` (fail-safe), submission still succeeds; the stored value round-trips to the `CompetitiveScoreView`.
- `leaderboard.logic.test.ts` (extend): an ineligible row is excluded from the ranked board + COUNT; an eligible row appears; the owner My-Scores read still returns the ineligible row.

---

## Out of Scope

- **Lobby invite flow (the other half of the charter's packet #5) — SPLIT OUT.** "Invite a friend into my game" is a multiplayer-lobby UX that depends on lobby/matchmaking surfaces this packet does not touch; it becomes its **own future WP** once the lobby architecture for human N-seat invites is confirmed (charter's "lobby dependency" caveat). This packet delivers only the **ranked-eligibility gate**, which is the load-bearing, vision-critical half and is fully buildable today.
- **No match-start snapshot machinery** — eligibility is computed at submission (terminal + immutable). A true match-*start* snapshot (so a mid-match unfriend can't flip a run to Casual) is a heavier future refinement; see **Design note**.
- **No scoring-math / PAR / replay-hash change** — eligibility is orthogonal to the score value.
- **No client change** — the My-Scores "Casual" badge rendering is a small follow-up on `apps/arena-client` (the field is exposed here; the UI reads it later). No `arena-client` edit in this packet.
- **No engine / `G` / RNG touch.**

---

## Design note (surfaced)

The charter says "snapshot at **match start**." There is no existing match-start scoring hook, and "start" is fuzzy for a co-op match that fills seats over time. This packet evaluates at **submission** over `readSeatAccounts` (the roster that actually played) — a single, terminal, immutable decision that satisfies FR-7's core intent ("evaluate once; social-graph changes never *retroactively* alter a completed run"). The one behavioral difference from a true start-snapshot: if a player unfriends a co-player *mid-match*, the run evaluates as Casual at submission. That edge is rare and arguably correct (you broke the crew mid-run); a start-snapshot is a deliberate future refinement, not a silent gap.

---

## Files Expected to Change

- `data/migrations/029_add_ranked_eligibility_to_competitive_scores.sql` — **new**
- `apps/server/src/competition/competition.logic.ts` — **modified** (eligibility computation + INSERT column)
- `apps/server/src/competition/competition.types.ts` — **modified** (additive `isRankedEligible` — D-24146)
- `apps/server/src/leaderboards/leaderboard.logic.ts` — **modified** (ranked SELECT + COUNT filter)
- `apps/server/src/competition/competition.logic.test.ts` — **modified** (eligibility cases)
- `apps/server/src/leaderboards/leaderboard.logic.test.ts` — **modified** (filter cases)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (`GET /api/me/scores` row)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24146**) + `STATUS.md` + `wiki/profile-login.md`. `EC_INDEX.md` + EC-384 at execution-prep.

**1 migration + 3 modified logic/types + 2 tests + catalog. Standard two-session lane.**

---

## Contract

- **New column:** `competitive_scores.is_ranked_eligible boolean NOT NULL DEFAULT true`.
- **New view field:** `CompetitiveScoreView.isRankedEligible: boolean` (additive).
- **Locked Values:**

| Key | Value |
|---|---|
| Eligibility formula | `areAllMutualFriends(pool, readSeatAccounts(matchId).map(accountId))`; `n ≤ 1` ⇒ `true` (solo/guest vacuous) |
| Evaluation timing | **once**, at submission; stored; never re-evaluated / back-filled (FR-7) |
| Fail-safe | a roster/clique query throw ⇒ `is_ranked_eligible = false` (Casual), submission still succeeds |
| Leaderboard filter | `AND cs.is_ranked_eligible = true` on the ranked SELECT **and** its COUNT; owner My-Scores read **unfiltered** |
| Back-compat | default `true` ⇒ all pre-gate rows + all solo rows remain ranked |
| Scoring math | unchanged; eligibility is never a score input (§25(a)) |

---

## Acceptance Criteria

1. Migration `029` adds `is_ranked_eligible boolean NOT NULL DEFAULT true` (idempotent) (**AC-1**).
2. At `submitCompetitiveScoreByMatchIdForRequest`, a clique roster stores `true`, a non-clique multiplayer roster stores `false`, and a solo/empty roster stores `true`; the value is written on the INSERT and returned (**AC-2**).
3. A thrown roster read or clique query yields `is_ranked_eligible = false` and the submission **still succeeds** (fail-safe to Casual, not a crash) (**AC-3**).
4. The ranked leaderboard SELECT + COUNT exclude `is_ranked_eligible = false` rows; the owner My-Scores read still returns them; scoring math (`final_score`/PAR) is byte-identical (**AC-4**).
5. `CompetitiveScoreView` gains `isRankedEligible` (additive); `GET /api/me/scores` returns it; the `api-endpoints.md` row is updated same-commit (D-11804); `00.3 §21` passes (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (extended suites pass; DB-less skip parity; baseline otherwise unchanged) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server test   # competition + leaderboard suites green
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "areAllMutualFriends|readSeatAccounts|is_ranked_eligible"
Select-String -Path "apps\server\src\leaderboards\leaderboard.logic.ts" -Pattern "is_ranked_eligible = true"
Select-String -Path "data\migrations\029_add_ranked_eligibility_to_competitive_scores.sql" -Pattern "is_ranked_eligible boolean NOT NULL DEFAULT true"
git diff --name-only   # only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `029` additive + idempotent; default `true`
- [ ] Submission computes eligibility via `areAllMutualFriends(readSeatAccounts(...))`, fail-safe to Casual, stored + returned
- [ ] Leaderboard ranked SELECT **and** COUNT filter `is_ranked_eligible`; My-Scores unfiltered; scoring math byte-identical
- [ ] `CompetitiveScoreView.isRankedEligible` additive; `api-endpoints.md` `GET /api/me/scores` row updated (D-11804)
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24146** landed (Active); `WORK_INDEX` (WP-354) + `STATUS.md` + `wiki` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On a real DB: submit a non-clique multiplayer match → confirm it is absent from the ranked board and present (Casual) on the owner's My-Scores; submit a clique match → confirm it ranks. Operator-pending on deploy; proof is the suite + the DB smoke, not tests alone.

---

## Vision Alignment

**Vision clauses touched:** §23 (co-op competition — the gate is a trust boundary, not a PvP ladder), §24 (replay-verified integrity — the clique adds an anti-collusion signal), §25(a) (friendship is a **binary** flag, never a cumulative-count ranking input). **Conflict assertion:** No conflict — implements the charter's ranked-eligibility contract; scoring math untouched. **Non-Goal check:** NG-1 (not pay-to-win — eligibility is earned by real friendship, not purchased). **Determinism:** N/A — persistence + read-filter; the score value + replay hash are unchanged.

## Lint Gate Self-Review (00.3)

- §1–§21: PASS or N/A-with-reason. Highlights — §5 standard lane (contract field + migration → not lightweight); §8 server boundary (no engine import; `readSeatAccounts`/`areAllMutualFriends` same layer); §11 N/A (no new endpoint; existing submit/read auth unchanged); §15.1 APPLIES (leaderboard/My-Scores live check); §17 §23/§24/§25 addressed, determinism N/A; §21 APPLIES (`GET /api/me/scores` row). §18 greps target identifiers + the filter clause, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-350 clique helper, WP-333 roster, WP-338 submission, migration 027). No blocker. Scope locked to migration + 3 logic/types + 2 tests + catalog. Contract field addition → standard lane. Not a validation-tightening of an existing input path (eligibility is a new derived flag), so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS.** Failure modes pinned: (a) a friendship-infra hiccup breaking score submission → **fail-safe to Casual, submission never fails**; (b) solo runs suddenly un-ranked → **`n ≤ 1` vacuous + default `true` + test**; (c) bots counted in the roster → **`readSeatAccounts` excludes them (D-24120)**; (d) COUNT/SELECT filter drift → **same-WHERE invariant, both filtered, tested**; (e) retroactive eligibility flips → **evaluate-once-store, no back-fill**; (f) eligibility leaking into the score value → **orthogonal flag, scoring math byte-identical**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24146**: the ranked-eligibility gate. Locks: (1) eligibility = `areAllMutualFriends` over `readSeatAccounts(matchId)`, evaluated **once at submission** and stored on `competitive_scores.is_ranked_eligible` (migration 029, default `true`); (2) `n ≤ 1` vacuously eligible (solo unaffected); (3) **fail-safe to Casual** on any friendship-infra throw (submission never fails); (4) the public ranked leaderboard SELECT + COUNT filter `is_ranked_eligible = true` while the owner My-Scores read stays unfiltered; (5) `CompetitiveScoreView.isRankedEligible` additive; (6) scoring math untouched (§25(a) — binary flag, not a count). The **lobby-invite-flow half of the charter's packet #5 is split into a separate future WP** (depends on multiplayer-lobby UX). Drafted 2026-07-11; not yet landed.
