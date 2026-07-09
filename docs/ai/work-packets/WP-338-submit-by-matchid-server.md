# WP-338 — Submit-by-MatchId Competitive Submission + On-Demand Capture + `GET /api/me/scores` (WP-5a, Server)

**Status:** Draft — Ready to execute (pending operator review)
**Primary Layer:** Server (`apps/server/**`)
**Dependencies:** D-24119 (arc), D-24122 (capture + `bgio.replay_artifacts` + reaper capture-guard), D-24123/24124/24125 (faithful verifier + turns-native scoring), WP-332 (the submission endpoint being changed), WP-335 (`captureMatch` + artifact store), WP-336 (`reduceReplayByHash`), WP-052/053 (ownership + verifier)
**EC:** EC-368
**Baseline:** `origin/main` at `58a979f8` (2026-07-08)
**User-Visible Surface:** none — infrastructure (the arena-client consumer is the co-packet WP-339)
**Reserves:** D-24126
**Co-packet:** WP-339 (WP-5b, arena-client: gameover-submit watcher + `competitionApi` + "my scores" profile UI) — consumes the two HTTP surfaces this packet ships. Not co-release-locked (the surfaces are inert without a caller; safe to land first).

---

## Goal

Make a finished multiplayer match submittable by the arena-client **using only the
`matchId` it already has** (the client never obtains a `replayHash` — it cannot run
`computeStateHash`). This is WP-5a of the D-24119 arc, the server surface WP-5b consumes:

1. **`POST /api/competition/scores` accepts `{ matchId }`** (changed from `{ replayHash }`;
   the endpoint has no client consumer yet, so the contract change is safe). The server
   resolves the `replayHash` itself: it looks up the durable artifact by `match_id`, and
   if the capture harvester's periodic scan (5-min cadence) has not run yet, it
   **captures on-demand** (`captureMatch(matchId)`) — so submission works immediately at
   gameover with no timing gap.
2. **Submitting auto-publishes** (operator decision): submitting a score to the public
   competitive leaderboard promotes the caller's ownership of that replay from `private`
   to `public` as one step (submission is the consent-by-action), so the existing
   visibility gate passes.
3. **`GET /api/me/scores`** returns the authenticated player's submitted competitive
   scores (`listPlayerCompetitiveScores`) — the "my scores" read WP-5b renders.

The existing `submitCompetitiveScoreImpl` verify+score pipeline (WP-053/336) is reused
verbatim; this packet adds a matchId-resolving + on-demand-capture + auto-publish
front-end and the read route.

---

## Assumes

- **D-24122/24124/24125 Active; WP-332/335/336 Done.** `POST /api/competition/scores`
  is wired (`authenticated-session-required`); `captureMatch(matchId, db)` is a callable
  that reduces a finished match, stores `bgio.replay_artifacts` (keyed by `replayHash`,
  with a `match_id` column), `assignReplayOwnership` per authenticated seat, and stamps
  `captured_at`; `submitCompetitiveScoreImpl(identity, replayHash, db, deps)` runs the
  16-step verify+score with `deps = { reduceReplay, checkParPublished }`.
- **The reaper capture-guard (WP-335) keeps un-captured gameover rows alive** — a finished
  match's `bgio.matches` row is not reaped until `captured_at` is set, so on-demand
  capture can always read it. Post-capture (and post-reap), the durable
  `bgio.replay_artifacts` row survives, so `matchId → replayHash` resolves either way.
- **Only authenticated seats can submit.** `captureMatch` assigns ownership only to seats
  with a `legendary.match_seat_accounts` row (WP-333); a caller who was not an
  authenticated seat has no ownership and is rejected `not_owner`.
- `listPlayerCompetitiveScores(accountId, db)` (WP-053) returns the account's
  `CompetitiveScoreRecord[]`, route-less today.
- `pnpm -r build` exits 0 on `main`; the `apps/server` suite passes its baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` D-24119/24122/24123/24124/24125; D-5301/5302/5304 (verifier
  contract); D-5201 (AccountId).
- `apps/server/src/competition/competition.logic.ts` (`submitCompetitiveScoreImpl`,
  `submitCompetitiveScoreForRequest`, `CompetitiveSubmissionProductionDependencies`,
  `listPlayerCompetitiveScores`), `competition.types.ts` (`SUBMISSION_REJECTION_REASONS`,
  `SubmissionResult`, `CompetitiveScoreRecord`), `competition.routes.ts`.
- `apps/server/src/replay/matchCapture.logic.ts` (`captureMatch`),
  `apps/server/src/replay/matchReplay.logic.ts` (`readReplayArtifactByHash`; add
  `readReplayHashByMatchId`).
- `apps/server/src/identity/replayOwnership.logic.ts` (`findReplayOwnership` (LIMIT 1),
  `updateReplayVisibility`; add a by-account lookup).
- `apps/server/src/server.mjs` (route wiring); `docs/ai/REFERENCE/api-endpoints.md`.

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code (00.6). Moves never throw (N/A —
no moves). Test files `.test.ts`; `node:test`; DB-dependent tests use the non-silent skip.
Full-sentence error messages. Server layer imports no `boardgame.io` directly except via
the existing WP-334 replay module (unchanged here).

**Packet-specific:**
- **`POST /api/competition/scores` request body becomes `{ matchId: string }`** (was
  `{ replayHash }`). The response shape (`{ record, wasExisting }`) + status map are
  unchanged except for the added rejection reason below. Update
  `CompetitiveSubmissionRequest` in `competition.types.ts`.
- **New production entry `submitCompetitiveScoreByMatchId(identity, matchId, database,
  deps)`** orchestrates, then delegates to the UNCHANGED `submitCompetitiveScoreImpl`:
  1. guest guard → `guest_not_eligible`;
  2. **gameover gate** — read `bgio.matches` metadata; if the match is not finished (no
     `gameover`), return the new `match_not_finished` reason (do NOT capture/score an
     unfinished match — scoring is end-of-match only, D-4804);
  3. **resolve `replayHash`** — `readReplayHashByMatchId(matchId)`; if `null`, capture
     on-demand via `captureMatch(matchId)` and use its `replayHash` (a `not_replayable`
     capture → `replay_verification_failed`);
  4. **resolve the caller's ownership** for `(accountId, replayHash)` via a by-account
     lookup (NOT `findReplayOwnership`'s LIMIT-1 arbitrary-owner row); none →
     `not_owner`;
  5. **auto-publish** — if the caller's ownership `visibility === 'private'`,
     `updateReplayVisibility(ownershipId, 'public')` (submission is consent-to-publish);
  6. **delegate** to `submitCompetitiveScoreImpl(identity, replayHash, database, deps)`
     (its ownership/visibility(now public)/idempotency/PAR/reduce/verify/score run
     unchanged).
- **`readReplayHashByMatchId(matchId, database)`** added to `matchReplay.logic.ts`:
  `SELECT replay_hash FROM bgio.replay_artifacts WHERE match_id = $1 LIMIT 1` → `string |
  null`. (`match_id` is not unique per se, but capture writes one artifact per finished
  match; `LIMIT 1` + a `// why:` documents the one-row expectation.)
- **A by-account ownership lookup** added to `replayOwnership.logic.ts`
  (`findReplayOwnershipForAccount(accountId, replayHash, database) → ReplayOwnershipRecord
  | null`, `WHERE p.ext_id = $1 AND ro.replay_hash = $2`). This is what steps 4-5 use so a
  legitimate co-owner (2-player match, both authenticated) is not mis-rejected by
  `findReplayOwnership`'s arbitrary LIMIT-1 row.
- **`GET /api/me/scores`** (`authenticated-session-required`) → `{ scores:
  CompetitiveScoreRecord[] }` via `listPlayerCompetitiveScores(account.accountId, db)`.
  Same auth chain as the other `/api/me/*` routes (WP-112 session → WP-107 unsuspended →
  `PlayerAccount`). `Cache-Control: no-store` first.
- **New rejection reason `match_not_finished`** added to `SUBMISSION_REJECTION_REASONS`
  (canonical array) AND the `SubmissionRejectionReason` union — BOTH, per the drift rule
  — with the drift test updated; mapped to HTTP **`409`** (a conflict with match state) in
  the route status map.
- No engine edit; no `computeStateHash`/`reduceMatchToFinalState` change; no migration
  (all tables exist); `pg.Pool` reused; no new npm dep; no `Math.random`.

**Locked contract values:**
- `POST /api/competition/scores` req `{ matchId: string }`, res `{ record, wasExisting }`,
  auth `authenticated-session-required`, status `{200,400,401,403,404,409,422,500}`.
- `GET /api/me/scores` res `{ scores: CompetitiveScoreRecord[] }`, auth
  `authenticated-session-required`, status `{200,401,403,500}`.
- `readReplayHashByMatchId(matchId, db) → string | null`.
- `findReplayOwnershipForAccount(accountId, replayHash, db) → ReplayOwnershipRecord | null`.
- New reason `match_not_finished` → HTTP `409`.

---

## Scope (In)

### A) Resolution helpers
- `matchReplay.logic.ts` — add `readReplayHashByMatchId`.
- `replayOwnership.logic.ts` — add `findReplayOwnershipForAccount`.

### B) Submit-by-matchId orchestration
- `competition.logic.ts` — add `submitCompetitiveScoreByMatchId` (gate → resolve → capture
  on-demand → auto-publish → delegate). `submitCompetitiveScoreImpl` is UNCHANGED.
  `CompetitiveSubmissionProductionDependencies` gains the capture + resolution + ownership
  deps it needs (or a small new production-deps bundle) so tests can inject stubs.
- `competition.types.ts` — `CompetitiveSubmissionRequest` → `{ matchId }`;
  `SUBMISSION_REJECTION_REASONS` + `SubmissionRejectionReason` gain `match_not_finished`.

### C) Routes
- `competition.routes.ts` — the POST handler reads `{ matchId }` and calls
  `submitCompetitiveScoreByMatchId`; add the `match_not_finished → 409` status mapping;
  add `GET /api/me/scores` → `listPlayerCompetitiveScores`.
- `server.mjs` — wire the new capture/resolution deps into `registerCompetitionRoutes`
  (01.5 wiring only).

### D) Tests
- `competition.logic.test.ts` — the by-matchId flow: gameover gate (`match_not_finished`),
  on-demand capture when uncaptured, resolve-when-already-captured, auto-publish of a
  private ownership, `not_owner` for a non-seat caller, happy path scores. DB-gated.
- `competition.routes.test.ts` — `{ matchId }` body; `match_not_finished → 409`;
  `GET /api/me/scores` handler (auth + list shape). Logic-pure with injected fakes.
- `matchReplay.logic.test.ts` — `readReplayHashByMatchId` round-trip (DB-gated).
- `replayOwnership.logic.test.ts` — `findReplayOwnershipForAccount` (DB-gated; the
  co-owner disambiguation).

### E) API catalog (§21)
- `api-endpoints.md` — the `POST /api/competition/scores` row (req `{ matchId }`, +409,
  the resolve/capture/auto-publish behavior); a new `GET /api/me/scores` row; Library-only
  rows for `submitCompetitiveScoreByMatchId`, `readReplayHashByMatchId`,
  `findReplayOwnershipForAccount`.

---

## Out of Scope

- **The arena-client consumer** (gameover-submit watcher, `competitionApi`, "my scores"
  UI) — WP-339 (WP-5b).
- **The pre-existing `findReplayOwnership` LIMIT-1 multi-owner ambiguity in
  `submitCompetitiveScoreImpl` steps 2-3** — this packet routes its OWN flow through the
  by-account lookup; hardening the shared impl is a separate WP-053 follow-up (flagged).
- **The pre-existing WP-054 leaderboard DB-test contract drift** (D-24124 follow-up).
- **Any scoring-formula / capture / reduction change** — all reused verbatim.

---

## Files Expected to Change

- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `readReplayHashByMatchId`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified**
- `apps/server/src/identity/replayOwnership.logic.ts` — **modified** — `findReplayOwnershipForAccount`
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.logic.ts` — **modified** — `submitCompetitiveScoreByMatchId`
- `apps/server/src/competition/competition.logic.test.ts` — **modified**
- `apps/server/src/competition/competition.types.ts` — **modified** — request shape + reason
- `apps/server/src/competition/competition.routes.ts` — **modified** — matchId body, 409, GET /api/me/scores
- `apps/server/src/competition/competition.routes.test.ts` — **modified**
- `apps/server/src/server.mjs` — **modified** — wiring (01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — §21
- `docs/ai/work-packets/WP-338-submit-by-matchid-server.md` — **new** — this file
- `docs/ai/execution-checklists/EC-368-submit-by-matchid-server.checklist.md` — **new**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/ai/STATUS.md` — **modified** (execution)
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24126

No migration. No engine (`packages/**`) change.

---

## Acceptance Criteria

- [ ] `POST /api/competition/scores` accepts `{ matchId }`; `CompetitiveSubmissionRequest` is `{ matchId: string }`.
- [ ] `submitCompetitiveScoreByMatchId`: guest → `guest_not_eligible`; unfinished match → `match_not_finished` (409); uncaptured finished match → captured on-demand then scored; already-captured → resolved without re-capture; non-seat caller → `not_owner`.
- [ ] Auto-publish: a `private` ownership is flipped to `public` before the verify (so a first-time submit is accepted, not `visibility_not_eligible`).
- [ ] `submitCompetitiveScoreImpl` is byte-unchanged (the verify+score contract is reused).
- [ ] `readReplayHashByMatchId` + `findReplayOwnershipForAccount` added and unit-tested (DB-gated).
- [ ] `GET /api/me/scores` returns `{ scores }` for the authenticated account; `Cache-Control: no-store` first; guest/suspended rejected.
- [ ] `SUBMISSION_REJECTION_REASONS` + `SubmissionRejectionReason` both gain `match_not_finished`; the drift test passes; route maps it to 409.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (endpoint row + new GET row + Library-only rows).
- [ ] Engine untouched (`git diff --name-only packages/` empty); no migration.
- [ ] No files outside `## Files Expected to Change`.

---

## Verification Steps

```pwsh
pnpm -r build                                   # exits 0
pnpm --filter @legendary-arena/server test      # green (DB tests skip w/o TEST_DATABASE_URL)

# the endpoint takes matchId, not replayHash
Select-String -Path "apps\server\src\competition\competition.types.ts" -Pattern "matchId"   # >=1
# the impl verify pipeline is untouched
git diff -U0 apps/server/src/competition/competition.logic.ts | Select-String "submitCompetitiveScoreImpl"  # only additive context, no change to the 16-step body
# engine untouched
git diff --name-only packages/                  # no output
git diff --name-only                            # == Files Expected to Change
```

Locally, set `TEST_DATABASE_URL` to the canonical `.env` `DATABASE_URL` to run the
DB-gated flow (seed a finished `bgio.matches` row via the WP-334 manufacture helper + a
`match_seat_accounts` row, then exercise on-demand capture + auto-publish + score).

---

## Vision Alignment

**Vision clauses touched:** §22 (Scoring & Skill Measurement) — completes the server side
of the capture→submit→score loop so a finished match becomes a competitive score from the
`matchId` alone. §24 (competitive integrity): the server still re-reduces + hash-verifies
(D-5301) — submit-by-matchId changes only how the replay is *addressed*, not that the
server independently recomputes the score.

**Conflict assertion:** No conflict. Auto-publish is consistent with a *public* competitive
leaderboard (submitting is opting in); the private default is preserved for un-submitted
replays.

**Non-Goal proximity:** NG-1..7 — none crossed. No pay-to-win; no user-facing surface here.

**Determinism preservation:** No RNG/engine change; scoring still flows through the
faithful reducer + `computeStateHash` verify (unchanged). On-demand `captureMatch` uses the
same deterministic reduction as the harvester.

---

## Funding Surface Gate

**N/A** — server scoring/submission wiring. No global-nav / registry / profile funding
affordance. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Triggered** — the `POST /api/competition/scores` request contract changes (`{ replayHash
}` → `{ matchId }`, +409), a new `GET /api/me/scores` endpoint is added, and Library-only
functions are added. `docs/ai/REFERENCE/api-endpoints.md` is updated in the impl commit:
both endpoint rows (whole-row replace) + Library-only rows for
`submitCompetitiveScoreByMatchId`, `readReplayHashByMatchId`,
`findReplayOwnershipForAccount`. Closed-set `Status` ∈ {Wired, …} and `Auth` ∈
{guest, handle-required, authenticated-session-required} preserved; canonical
`matchId`/`replayHash`/`scenarioKey` names.

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All sections incl. Out of Scope (≥2) |
| §2 Constraints | PASS | Engine-wide + packet-specific + locked values; 00.6 |
| §3 Assumes | PASS | WP-332/335/336 + reaper capture-guard + authenticated-seat-only facts explicit |
| §4 Context | PASS | DECISIONS + competition + capture + ownership + routes cited |
| §5 Output | PASS | 10 code/test/doc + governance; bounded; engine excluded |
| §6 Naming | PASS | `matchId`/`replayHash`/`scenarioKey`/`match_not_finished` canonical |
| §7 Dependencies | PASS | No new npm dep; `pg.Pool` reused; no migration |
| §8 Boundaries | PASS | Server-only; engine untouched; reads bgio.replay_artifacts (D-24095 carve-out) |
| §9 Windows | PASS | `Select-String` / `pnpm` |
| §10 Env | N/A | no new env |
| §11 Auth | PASS | Both endpoints `authenticated-session-required`; WP-112→WP-107 chain; guest guard |
| §12 Tests | PASS | `node:test`; DB-gated flow; drift test for the new reason; route fakes |
| §13 Commands | PASS | Exact `pnpm` + `Select-String` w/ expected output |
| §14 Acceptance | PASS | 10 binary, observable items |
| §15 DoD | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface |
| §16 Code style | PASS | Small functions; `// why:` on the LIMIT-1 lookups + auto-publish + gameover gate |
| §17 Vision | PASS | §22/§24 cited; determinism-preservation line present |
| §18 Prose-vs-grep | PASS | Step greps (`matchId` ≥1; engine diff none) — usage intended |
| §19 Bridge | N/A | no repo-state artifact |
| §20 Funding | N/A | justified |
| §21 API catalog | PASS | Triggered; both endpoint rows + Library-only rows obligated in the impl commit |

**Pre-flight self-verdict:** READY — deps Done/Active; the two operator decisions
(submit-by-matchId + on-demand capture; auto-publish) are locked; the verify+score impl is
reused unchanged; the new rejection reason + drift edit + §21 are enumerated. The one
subtlety (co-owner disambiguation via a by-account lookup) is specified.

**Copilot self-check:** PASS — server-only, engine untouched, the two product decisions
explicit + operator-ratified, catalog obligation captured, User-Visible Surface `none —
infrastructure` (WP-339 is the consumer).

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (new by-matchId + GET-scores tests green; DB-gated verified locally where feasible; baseline preserved)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the impl commit (§21)
- [ ] `docs/ai/STATUS.md` updated — "No user-observable change — infrastructure only"; names the payoff (a finished match is submittable from `matchId` alone; auto-publish; `GET /api/me/scores`)
- [ ] `docs/ai/DECISIONS.md` — D-24126 (submit-by-matchId + on-demand capture at submit; submit auto-publishes; `GET /api/me/scores`; `match_not_finished`→409; by-account ownership lookup) Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-338 checked off with date
- [ ] No files outside `## Files Expected to Change`; engine untouched
