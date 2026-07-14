# WP-377 — Ranked Eligibility: Seat-Count-Complete Roster Guard (Server)

**Status:** Draft 2026-07-14 · **PROPOSED (number pending allocation; highest live WP is 374)** · **Standard lane** (a scoring-path behavior change on the ranked gate — no migration; the column already exists from WP-354/migration 029). Pairs with **EC-406** (authored). Reserves **D-24172** (an amendment to **D-24146**; lands at execution). **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §5b.
**Primary Layer:** Server (`apps/server/src/competition/`)
**User-Visible Surface:** the public ranked leaderboard — a match with any non-account (bot/guest) seat is recorded but **excluded from ranked** (shows Casual on the owner My-Scores). **D-24026 live-verify APPLIES** once a rowless-seat match (bot-ally) can be produced.
**Dependencies:** **WP-354 / D-24146** (the ranked-eligibility gate + `is_ranked_eligible` column + `computeRankedEligibility`) ✅ — this packet **amends** that gate. WP-350 (`areAllMutualFriends`) ✅; WP-333 (`readSeatAccounts`) ✅.
**Relationship to WP-375:** WP-375 *produces* the `botSeats` tag this guard reads; but this packet is **landable independently** — the seat-count backstop needs no tag and is a no-op for all-human matches. The `botSeats` short-circuit activates once WP-375 writes the tag.
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution).

---

## Goal

Close the DESIGN §5b leak: `computeRankedEligibility` (`competition.logic.ts:482-507`)
is **roster-only** and an `n ≤ 1` roster is vacuously ranked, so a match with a
**rowless seat** (a bot from WP-375, or a guest — both absent from
`match_seat_accounts`, D-24120) presents a short roster and a 1-human+1-bot match
would submit a **ranked** score, bypassing the mutual-friend-clique requirement a
real multi-human ranked match must satisfy. Harden the gate to require **every
seat** to map to a mutual-friend account: ranked ⇔ `roster.length === seatCount`
**and** `areAllMutualFriends(roster)`, plus a `botSeats`-tag short-circuit
(defence-in-depth). Genuine solo (roster 1, seatCount 1) stays vacuously ranked.

---

## User-Visible Impact

None for the current all-human surface (every authed seat already has a row, so
`roster.length === seatCount` holds — the guard is a no-op there). Once bot-ally
(WP-375) ships, a human's bot-assisted match is recorded but shows **Casual**,
never on the ranked board. Legitimate solo and all-human ranked runs are
unchanged.

---

## Assumes

- **`computeRankedEligibility(matchId, database)` is the single eligibility helper**, called once at `submitCompetitiveScoreByMatchIdForRequest:457` and threaded into the INSERT; on resubmit the impl idempotency fast-path returns the stored flag (FR-7), so this guard decides first-submission only. `competition.logic.ts:394-467, 482-507`. (Verified.)
- **`readSeatAccounts(matchId, db)` returns only existing rows** (bots/guests absent, D-24120). `seatAccount.logic.ts:72-87`. (Verified.)
- **`areAllMutualFriends(pool, accountIds)` returns `true` for `n ≤ 1`** (vacuous). `friendships.logic.ts:635-648`. This is the exact vacuity the leak rides. (Verified.)
- **The by-hash path correctly defaults `isRankedEligible ?? true`** (`:763`) because it has no roster; that default must NOT change. (Verified.)
- **The authoritative seat count exists two ways:** `ctx.numPlayers` on the bgio match state (the value that seeded `requiredPlayers`, `buildInitialGameState.ts:545`), and the reduced final state's `playerZones` key count the impl already computes for `player_count` (`competition.logic.ts:751-753`, D-24134). One must be the guard's seat-count source (see Design note). (Verified.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §5b — the leak + the required guard; §5c — Casual-never-ranked (DECIDED 2026-07-14).
- `WP-354-ranked-eligibility-gate.md` / **D-24146** — the gate this amends.
- `apps/server/src/competition/competition.logic.ts` — `computeRankedEligibility` (`:482`), its caller (`:457`), the by-hash default (`:763`), the authoritative `playerZones` seat count (`:751`).
- `apps/server/src/friendships/friendships.logic.ts:635` — `areAllMutualFriends`.
- `docs/01-VISION.md §24/§25(a)` — replay-verified integrity; friendship is a binary trust flag, never a count. The guard extends that trust boundary to "every seat is a real, friended human."

---

## Non-Negotiable Constraints

**Always apply:**
- ESM/TS; `.test.ts`; full-sentence errors; `// why:`; JSDoc; no branching `.reduce()`.
- Server layer; no engine/registry import beyond what `competition.logic.ts` already uses.

**Packet-specific:**
- **Predicate is `roster.length !== seatCount`, NOT `< 2` / `<= 1`.** A genuine 1-player solo match (roster 1, seatCount 1) MUST stay vacuously ranked. This is the top regression guard.
- **Three-rule order:** (1) `botSeats` tag non-empty ⇒ `false`; (2) `roster.length !== seatCount` ⇒ `false`; (3) else `areAllMutualFriends(roster)`.
- **Fail-safe stays Casual on any throw** — the new seat-count read joins the existing WP-354 try/catch (`:492-506`); a friendship/seat-count infra hiccup never fails submission (D-24146).
- **FR-7 immutability preserved** — recomputation on resubmit still never rewrites a stored flag (idempotency fast-path owns it); this packet does not touch that path.
- **Do NOT touch the by-hash default `?? true` (`:763`)** — that path has no roster and correctly defaults ranked.
- **The guard lives only in `computeRankedEligibility`** — not duplicated into `submitCompetitiveScoreImpl`.

**Session protocol:**
- Resolve the seat-count source (Design note) before coding; do not read a stale/0 `numPlayers` that would drop legitimate all-human ranked matches to Casual.

---

## Scope (In)

### A) `computeRankedEligibility` (`competition.logic.ts`, modified)
- Inside the existing try: read the match seat count (source per Design note), read the `botSeats` tag; apply the three-rule predicate. Keep the signature `(matchId, database)` if the seat-count is read internally (preferred — no caller churn). Catch still returns `false`.

### B) Seat-count source (Design note decision)
- (a) `ctx.numPlayers` read by `matchId` (reuse whatever `isMatchFinished` uses to reach match state; no new bgio fetch path), or (b) thread the authoritative `playerZones` count. **Recommend (a)** — cheap, available by `matchId`, and a started match genuinely seated `numPlayers`.

### C) `botSeats` tag read
- Read the match's `botSeats` (written by WP-375). Until WP-375 lands, this resolves empty/absent → rule (1) inert, rules (2)/(3) still enforce.

### D) Tests (`competition.logic.test.ts`, extend)
- solo (roster 1, seatCount 1, no botSeats) ⇒ `true` (**regression guard**); 2 mutual friends (2, 2, clique) ⇒ `true`; 2 non-friends (2, 2) ⇒ `false`; 1-human+1-bot (roster 1, seatCount 2) ⇒ `false` (the fix); `botSeats` non-empty ⇒ `false` (short-circuit); a thrown read ⇒ `false` (fail-safe).

---

## Out of Scope

- **No migration** — `is_ranked_eligible` already exists (WP-354/029).
- **No leaderboard read change** — the `AND cs.is_ranked_eligible = true` filter (WP-354) already excludes Casual rows; this packet only changes how the flag is computed.
- **No scoring-math / PAR / replay-hash change** — the flag is orthogonal.
- **No by-hash path change** (`?? true` default untouched).
- **The `botSeats` producer** — WP-375.

---

## Design note (surfaced)

The one real choice is the **seat-count source**. (a) `ctx.numPlayers` (bgio match
state) is cheap, available by `matchId` where the roster already is, and equals
the seat count that had to ready to start the match — sound for the
account-completeness test. (b) The `playerZones` key count (D-24134) is the
gold-standard the impl already uses for stored `player_count`, so using it keeps
the ranked guard and `player_count` provably consistent — but it lives in
`submitCompetitiveScoreImpl` (keyed by `replayHash`, post-reduce), so using it
here means a reorder or a second lightweight seat-count read. **Recommend (a)**;
if consistency-with-`player_count` is judged more important than avoiding a
match-state read, choose (b) and record it. Either way, add a `// why:` naming the
source and asserting it is authoritative for the completeness test.

---

## Files Expected to Change

- `apps/server/src/competition/competition.logic.ts` — **modified** (`computeRankedEligibility`: `botSeats` short-circuit + `!== seatCount` backstop + seat-count read, inside the existing try/catch)
- `apps/server/src/competition/competition.logic.test.ts` — **modified** (eligibility matrix)
- (if source (a)) a small `matchId → seatCount` reader — **new or reused** (prefer reusing the `isMatchFinished` match-state access)
- Governance: `WORK_INDEX.md` (WP-377) + `DECISIONS.md` (**D-24172**, amends D-24146) + `STATUS.md` + `EC_INDEX.md`/EC-406 at execution-prep.

---

## Contract

| Key | Value |
|---|---|
| Predicate | `botSeats non-empty ⇒ false`; else `roster.length !== seatCount ⇒ false`; else `areAllMutualFriends(roster)` |
| Solo | roster 1 == seatCount 1 ⇒ vacuously `true` (MUST NOT regress; `!==`, never `< 2`) |
| Fail-safe | any throw ⇒ `false` (Casual); submission still succeeds |
| Timing / immutability | computed once at submission; never re-written on resubmit (FR-7) |
| By-hash default | `?? true` at `:763` UNCHANGED |
| Seat-count source | (a) `ctx.numPlayers` recommended / (b) `playerZones` — D-locked |

---

## Acceptance Criteria

1. `computeRankedEligibility` returns `false` when `roster.length !== seatCount` OR the match has a non-empty `botSeats` tag; returns `areAllMutualFriends(roster)` otherwise (**AC-1**).
2. Genuine solo (roster 1, seatCount 1) returns `true`; 2 mutual friends return `true`; 2 non-friends return `false` — no regression to the WP-354 behavior (**AC-2**).
3. A 1-human+1-bot match (roster 1, seatCount 2) returns `false` (**AC-3**).
4. Any thrown seat-count/roster/clique read returns `false` and submission still succeeds (fail-safe preserved) (**AC-4**).
5. The by-hash default `isRankedEligible ?? true` (`:763`) is unchanged (`git diff` shows no edit there); scoring math byte-identical (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green; on a real DB a bot-ally match records Casual (D-24026, operator-pending) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "roster\.length\s*(<\s*2|<=\s*1)"  # ZERO — must be !== seatCount
Select-String -Path "apps\server\src\competition\competition.logic.ts" -Pattern "botSeats|!==\s*seatCount|numPlayers"
git diff apps/server/src/competition/competition.logic.ts  # confirm :763 `?? true` untouched
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Predicate uses `!== seatCount` (not `< 2`); solo + all-human ranked behavior preserved
- [ ] `botSeats` short-circuit + seat-count backstop both present; fail-safe Casual on throw
- [ ] By-hash `?? true` default untouched; scoring math byte-identical
- [ ] `pnpm -r build` 0; server test green (eligibility matrix incl. solo regression + bot case)
- [ ] `DECISIONS.md` **D-24172** landed (amends D-24146); `WORK_INDEX` (WP-377) + `STATUS.md` updated
- [ ] Seat-count source ((a)/(b)) recorded in D-24172

---

## Vision Alignment

**Vision clauses touched:** §24 (replay-verified integrity — extends the anti-collusion trust boundary to "every seat is a real friended human"), §25(a) (friendship stays a binary flag, never a count — the guard adds a completeness condition, not a scoring input). **Conflict assertion:** No conflict — hardens D-24146; scoring math untouched. **Non-Goal check:** NG-1 (not pay-to-win — ranked stays earned by real friendship, now also seat-complete). **Determinism:** N/A (a read-time flag; score value + replay hash unchanged).

## Lint Gate Self-Review (00.3)

- §1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (scoring-path behavior change, no migration); §8 server boundary; §11 N/A (no new endpoint); §15.1 APPLIES (D-24026 Casual-on-bot-ally live check, operator-pending); §17 §24/§25(a) addressed, determinism N/A; §18 greps target the predicate + the `< 2` anti-pattern, not a count-echo.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY** — amends an existing, Done gate (WP-354); no migration; scope is one helper + tests. Landable independently of WP-375 (backstop is a no-op for all-human matches). The seat-count source is the only open choice, surfaced with a recommendation.

**Copilot: PASS.** Failure modes pinned: (a) legit solo un-ranked → **`!== seatCount`, solo regression test first**; (b) all-human ranked dropped to Casual → **authoritative seat-count source, `rg` for `< 2`**; (c) bot-ally still ranks → **seat-count backstop + `botSeats` short-circuit, tested**; (d) submission throws on the new read → **inside the WP-354 Casual-on-throw catch**; (e) by-hash mis-flagged → **`:763` default untouched, `git diff` guard**; (f) resubmit rewrites a flag → **idempotency fast-path owns it; not touched (FR-7)**.

## Decision (reserved, lands at execution)

Reserves **D-24172** (amends **D-24146**): ranked eligibility now requires the human roster to be **seat-count-complete** — ranked ⇔ `readSeatAccounts(matchId).length === <authoritative seatCount>` AND `areAllMutualFriends(roster)`, with a `botSeats`-tag non-empty short-circuit to Casual (defence-in-depth). Genuine solo (roster 1 == seatCount 1) stays vacuously ranked (`!==`, never `< 2`); fail-safe to Casual on any throw is preserved; the by-hash default and scoring math are untouched. Locks the seat-count source ((a) `ctx.numPlayers` recommended / (b) `playerZones`) at execution. Implements DESIGN §5b and the §5c "Casual history yes, ranked never" decision (2026-07-14). Drafted 2026-07-14; not yet landed.
