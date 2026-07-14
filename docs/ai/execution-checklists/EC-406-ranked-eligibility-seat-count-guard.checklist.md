# EC-406 — Ranked-Eligibility Seat-Count Guard (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation. Renumbered
> EC-405 → EC-406 to clear the EC-403 collision with WP-374.
> **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §5b.
> **Source WP:** [WP-377](../work-packets/WP-377-ranked-eligibility-seat-count-guard.md) (proposed number, pending allocation).
> **Companion to:** EC-404 (bot-ally driver, produces the `botSeats` tag). This
> EC is the **blocking prerequisite** that makes bot-ally safe to expose to the
> client (DESIGN §5b) — bot-ally MUST NOT ship to the client until this lands.

**Layer:** Server (`apps/server/src/competition/`)

## The bug this closes (read first)
`computeRankedEligibility` (`competition.logic.ts:482-507`) is **roster-only**:
it reads the authenticated human roster via `readSeatAccounts` and returns
`areAllMutualFriends(roster)`, where an `n ≤ 1` roster is **vacuously ranked**
(`friendships.logic.ts:646-648`). Any match with a **rowless seat** (a bot from
EC-404, or a guest — both absent from `match_seat_accounts` per D-24120) presents
a **short roster**. A 1-human + 1-bot match → roster length 1 → vacuously ranked
→ the human submits a **ranked** score (`player_count = 2`) via
`submitCompetitiveScoreByMatchIdForRequest` (`:457`), **bypassing the
mutual-friend-clique requirement** a real 2-human ranked match must satisfy. Fix:
require **every** seat to be a mutual-friend account.

> **Today this is a no-op for all-human matches** (every authed seat has a row,
> so `roster.length === numPlayers` already holds). It is not fixing a live
> leak on the current surface; it is the guard that must exist **before** any
> rowless-seat match (bot-ally) can submit a score. Land it independently of
> EC-404 — the seat-count backstop needs no tag; the `botSeats` short-circuit
> activates once EC-404 writes the tag.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] `DESIGN-SOLO-BOT-ALLY.md` RATIFIED; §5b/§5c have D-numbers
- [ ] WP allocated; §Pre-Flight Verdict = READY
- [ ] Confirm the two inputs' shapes: `readSeatAccounts(matchId, db)` → `{playerId, accountId}[]` (only existing rows, `seatAccount.logic.ts:72-87`); `areAllMutualFriends(pool, accountIds)` → `boolean`, `n ≤ 1` vacuously `true` (`friendships.logic.ts:635-648`)
- [ ] Confirm the caller: `submitCompetitiveScoreByMatchIdForRequest` computes the flag ONCE at `:457` and threads it in; on resubmit the impl idempotency fast-path returns the stored flag (FR-7) — so this guard only decides first-submission (`competition.logic.ts:450-467`)
- [ ] Decide the authoritative seat-count source (see Locked Values — the one real design choice here)
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` runs

## Locked Values (do not re-derive)
- New ranked predicate, in order:
  1. **`botSeats` tag non-empty ⇒ `false`** (defence-in-depth; the server itself created the bot seats — most authoritative signal for the bot-ally feature; a no-op read until EC-404 writes the tag)
  2. **`roster.length !== seatCount` ⇒ `false`** (every seat must map to a mutual-friend account; catches bots AND guests generically)
  3. else **`areAllMutualFriends(pool, roster.map(accountId))`** (unchanged existing behavior)
- The check is **`!==`, NOT `< 2`** — a genuine 1-player solo match (`roster.length === 1`, `seatCount === 1`) MUST stay vacuously ranked. Do not regress legit solo.
- **Fail-safe preserved:** any throw (roster read, seat-count read, clique query) ⇒ `false` (Casual), per the existing WP-354 / D-24146 catch (`:492-506`). Extend the SAME try/catch over the new reads.
- **Seat-count source** — the one design decision. Options:
  - **(a) `ctx.numPlayers` from the bgio match state**, read by `matchId` at eligibility time (cheap, pre-reduce; identical to the value that seeded `requiredPlayers` and gated the lobby start, `buildInitialGameState.ts:545`). **RECOMMENDED** — available where the roster already is (by `matchId`), no reduce.
  - (b) The authoritative `playerZones` key count the impl uses for `player_count` (`competition.logic.ts:751-753`, D-24134). Gold-standard and guaranteed-consistent with stored `player_count`, but computed only inside `submitCompetitiveScoreImpl` (keyed by `replayHash`, not `matchId`), so using it here means reordering or a second reduce. **[OPEN — pick (a) or (b); record a D-entry. If (a), add a `// why:` that a started match genuinely seated `numPlayers`, so `numPlayers` is a sound seat count for the account-completeness test.]**
- `computeRankedEligibility` signature may gain the seat-count read internally (still `(matchId, database)`), OR take an injected `seatCount` — keep it `(matchId, database)` if source (a) is read inside (preferred; no caller churn).
- `botSeats` tag accessor: read from the match metadata written by EC-404 (`{ botSeats, decisionSeed, policy }`). **[Depends on EC-404's storage-location decision; until EC-404 lands, this read resolves to empty/absent → rule 1 is inert, rules 2–3 still enforce.]**

## Guardrails
- **Do not regress genuine solo:** `roster.length === seatCount === 1` ⇒ `areAllMutualFriends` ⇒ `true`. The predicate is `!==`, never `< 2` or `<= 1`.
- **Do not regress all-human multiplayer:** 2 mutual-friend humans (roster 2, seatCount 2, clique) ⇒ `true`, exactly as today.
- The guard lives ONLY in `computeRankedEligibility` — do NOT duplicate it into the by-hash path (`submitCompetitiveScoreImpl`), which has no roster and correctly defaults `isRankedEligible` to `true` for its non-matchId flow (`:763`). Changing that default is OUT of scope and would mis-flag legitimate by-hash submissions.
- Fail-safe stays `false` (Casual) on ANY error — never let a friendship/seat-count infra hiccup throw out of score submission (D-24146).
- FR-7 immutability preserved: recomputation on a resubmit still never rewrites a stored flag (idempotency fast-path owns it) — this EC does not touch that path.
- No new external calls in the hot path beyond the one seat-count read + the existing roster + clique queries.

## Required `// why:` Comments
- `computeRankedEligibility` predicate — the three-rule order and WHY `!==` (not `< 2`): genuine solo must stay vacuously ranked; a short roster means a rowless (bot/guest) seat, which is NOT ranked (DESIGN §5b)
- `botSeats` short-circuit — defence-in-depth vs the seat-count backstop; either alone forces Casual (DESIGN §5c)
- seat-count read — WHY the chosen source is authoritative for the account-completeness test (source (a): a started match genuinely seated `numPlayers`)
- fail-safe extension — the new reads join the existing WP-354 Casual-on-throw catch (D-24146)

## Files to Produce
- `apps/server/src/competition/competition.logic.ts` — **modified** — `computeRankedEligibility`: add the `botSeats` short-circuit + `roster.length !== seatCount` backstop + seat-count read, inside the existing try/catch
- `apps/server/src/competition/competition.logic.test.ts` — **modified/new cases** — see After Completing matrix
- (if source (a)) a small match-seat-count reader — **new or reused** — read `ctx.numPlayers` by `matchId` server-side; reuse whatever `isMatchFinished` uses to reach match state rather than a new bgio fetch path
- `docs/ai/DECISIONS.md` — **modified** — D-entry: ranked requires seat-count-complete mutual-friend roster; bot/guest seats force Casual; seat-count source (a)/(b) choice
- `docs/ai/STATUS.md` — **modified** — ranked-guard note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off the WP
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add EC-406 (note it gates bot-ally client exposure)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `competition.logic.test.ts` passes the full eligibility matrix:
  - [ ] **solo** — roster 1, seatCount 1, no botSeats ⇒ `true` (regression guard — must NOT break)
  - [ ] **2 mutual friends** — roster 2, seatCount 2, clique ⇒ `true` (unchanged)
  - [ ] **2 non-friends** — roster 2, seatCount 2, not clique ⇒ `false` (unchanged)
  - [ ] **1 human + 1 bot** — roster 1, seatCount 2 ⇒ `false` (the fix)
  - [ ] **botSeats tag non-empty** ⇒ `false` even if roster length happened to equal seatCount (short-circuit)
  - [ ] **throw** (roster/seat-count/clique) ⇒ `false` (Casual fail-safe preserved)
- [ ] `rg "roster\.length\s*<\s*2|<=\s*1" apps/server/src/competition/competition.logic.ts` → zero (must be `!==`, not a lower-bound)
- [ ] By-hash path default `isRankedEligible ?? true` at `:763` UNCHANGED (`git diff` shows no edit there)
- [ ] D-entry Active; STATUS/WORK_INDEX/EC_INDEX updated
- [ ] Commit prefix `EC-406:` (staged files under `apps/server/` + `docs/`)

## Common Failure Smells
- Legit solo runs stop being ranked → predicate used `< 2` / `<= 1` instead of `!== seatCount`
- All-human 2p ranked matches drop to Casual → seat-count source disagrees with the roster (e.g. read a stale/0 `numPlayers`); confirm source (a)/(b) returns the true seat count
- Bot-ally match still submits ranked → seat-count backstop not reached (short roster not compared to seatCount), or EC-404's `botSeats` tag not written and the backstop silently skipped
- Score submission throws / 500s → new seat-count read left OUTSIDE the WP-354 try/catch (must be Casual-on-throw)
- By-hash submissions mis-flagged → guard wrongly duplicated into `submitCompetitiveScoreImpl` (it has no roster; leave its `?? true` default alone)
- Resubmit changes a stored flag → idempotency fast-path bypassed (this EC must not touch that path; FR-7)
