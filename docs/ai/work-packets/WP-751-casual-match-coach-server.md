# WP-751 — AI Coach on unscored matches (Server)

**Status:** Draft 2026-09-23 (EC-788; D-24576 reserved)
**Primary Layer:** Server (`apps/server/src/coach/**`)
**Dependencies:** WP-594 / D-24403 (the coach) ✅, WP-737 / D-24559 (eval pack) ✅, WP-742 / D-24564 (`isBotAlly`) ✅, WP-335 / WP-338 (capture harvester + on-demand `captureMatch`) ✅
**User-Visible Surface:** play.legendary-arena.com
**Baseline:** `origin/main` @ `fbdbea57` (+ the #2309 reservation). Coach suite baseline: 98 tests / 6 suites / 0 fail (pre-flight run).

---

## Goal

As a Legendary Pass holder who finishes a casual match (any setup that isn't a
ranked-gauntlet loadout), I want the AI Coach to coach it. Today I get no coaching at
all for those matches.

---

## User-Visible Impact

The coach becomes reachable for every signed-in, normally finished match the player
owns, not only for PAR-scored gauntlet loadouts. This WP adds the server route; WP-752
surfaces it in the client.

Scored matches are unchanged: they keep their full PAR numbers, grade and luck read.
A casual match's coaching covers only what can be known without PAR:
- the outcome and the number of rounds
- adversity counts
- team and per-seat contribution
- hero fit and purchases
- the sequence tips and Table Cooperation lines

It gives **no** score, grade or PAR comparison.

---

## Assumes

All verified at `fbdbea57` by the scoring-pipeline map and the WP-751 pre-flight:

- **Capture and ownership.** Every finished match is captured to
  `bgio.replay_artifacts`, and each authenticated seat gets replay ownership. Two paths
  do this, neither gated on PAR:
  - the 5-minute harvester (`replay/captureHarvester.js:43,91`)
  - `captureMatch` on demand (`replay/matchCapture.logic.ts:75`), which is
    idempotent (`ON CONFLICT DO NOTHING`) and assigns ownership only to the seats that
    played

  Guest and bot seats get no ownership (D-24120).
- **The PAR gate.** `generateOrGetCoachReport` (`coach/coach.logic.ts`) returns
  `not_found` when `findCompetitiveScore` is null (~L151–154). That is the one gate that
  makes the coach depend on PAR. It runs after the Pass, ownership and cache checks.
- **What the scored summary reads.**
  - `deriveScoringInputs(replayResult, gameState)`
    (`game-engine/src/scoring/parScoring.logic.ts:54`, on the runtime-safe surface)
    returns `rounds`, `victoryPoints`, `bystandersRescued`, `escapes`,
    `penaltyEventCounts`, `perPlayer` and `matchLost`, with no PAR input.
  - `ScoreBreakdown.inputs` is a `ScoringInputs` (`parScoring.types.ts:296`).
  - `buildCoachMatchSummary` (`coach/coachSummary.logic.ts:200`) reads only these from
    outside `.inputs`: `rawScore`, `finalScore` (and `grade` from it), and
    `parBaseline`.
  - `buildPerPlayerLines` (~L133) reads only `breakdown.inputs.perPlayer`.
- **Nothing else needs the score fields.** No other code reads
  `CoachMatchSummary.rawScore`, `finalScore` or `grade` as required: `tableCooperation`
  mentions them only in a comment, and the client has no mirror type. `coach_reports`
  stores the model's report, not the summary (`coachReport.persistence.ts:33,81`).
- **Match outcome.** `evaluateEndgame(finalState)` returns `heroes-win`, `scheme-wins`
  or `tie` for a normally finished match. `EndgameResult.endedEarly?: boolean`
  (`endgame.types.ts:40`) marks an early end, which submit refuses as `ended_early`
  (`competition.logic.ts:866`).
- **Reusable helpers.** `isMatchFinished` (`matchReplay.logic.ts:449`),
  `readReplayHashByMatchId` (`:506`) and `captureMatch` are all exported, with no import
  cycle: `competition` and `replay` import nothing from `coach/`.
- **The existing coach route.** `GET /api/me/scores/:replayHash/coach`
  (`coach/coach.routes.ts:155`, catalog `api-endpoints.md:301`). Its test seam is
  `CoachRouteLogic` (`coach.routes.ts:87–89`), and its context type is
  `KoaCoachContext.params` (`:98`).
- **Existing test to rewrite.** `coach.logic.test.ts` L227–243 ("not_found when the
  match is not scored or not replayable") covers behavior this WP intentionally
  changes. Its no-score half is rewritten (Scope E).
- **Build baseline.** `pnpm -r build` exits 0.

If any of these is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`:
  - D-24403: the coach, and the precedent for reducing a replay in order to coach it
  - D-24559: the eval pack
  - D-24564: `isBotAlly`
  - D-24199: "ranked legs require an approved loadout; casual stays free". This WP
    gives casual play nothing ranked; it is a Pass feature on casual matches.
  - D-24306: early ends are never results
  - D-24120: guests own nothing
  - NG-1 in `docs/01-VISION.md`
- `docs/ai/REFERENCE/00.2-data-requirements.md`: the canonical `matchId` and
  `replayHash` field names.
- `docs/ai/ARCHITECTURE.md §Layer Boundary`: `apps/server` may import the engine's
  runtime-safe `.` surface (`evaluateEndgame`, `deriveScoringInputs`).
- Source files:
  - `apps/server/src/coach/{coach.logic,coachSummary.logic,coach.routes,coach.types,coachClient,coachEval.types,coachEval.fixtures}.ts`
    and their tests
  - `apps/server/src/competition/competition.logic.ts` L424–470 (the on-demand capture
    pattern) and L855–868 (the ended-early check)
  - `docs/ai/REFERENCE/api-endpoints.md` L301

**Why one orchestrator.** The casual path shares every gate (Pass, ownership, cache)
and every post-step (sequence tips, Table Cooperation, cache write) with the scored
path. Only the source of the numbers differs. That step is a named helper,
`prepareCasualCoachSummary`, so `generateOrGetCoachReport` stays readable.

**Why a matchId route.** An unscored match never hands the client a `replayHash`; the
client only knows `matchId`. The new route checks the Pass first, then resolves
`matchId` → `replayHash` the same way submit does, then delegates.

**Why there is no casual raw score.** `rawScore` needs the scoring weights from the PAR
artifact. Inventing default weights would put a meaningless score on casual play, so
the casual summary leaves the score fields out rather than faking them.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious choices,
  no branching `.reduce()`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Env:** no new variables. No new npm dependencies.

**Packet-specific:**
- **NG-1 hard rule.** The casual path:
  - reads no PAR artifact and computes no score
  - touches no leaderboard, ranking, badge or gauntlet surface
  - makes only two kinds of new write:
    - the existing `coach_reports` cache
    - on the matchId route only, the same idempotent replay-artifact and ownership
      rows the harvester already writes (submit's capture steps 1–3)

  It **never** performs submit's private→public ownership flip.
- **Gate order.** On both routes, the order is Pass → (capture, matchId route only) →
  ownership → cache → numbers. On the matchId route the Pass check comes **before**
  capture, so a caller without the Pass causes no writes and no replay reduction.
- **Scored path byte-unchanged.** When a score row exists, behavior is exactly today's.
  Existing scored tests get only type-driven updates.
- **Ended-early or unevaluable matches are not coachable.** Wrap `evaluateEndgame` and
  `deriveScoringInputs` in **one** `try/catch`. Any of these returns `not_found`:
  - a throw from either call
  - a null evaluation
  - `endedEarly === true`
- **Constant prompt.** `COACH_SYSTEM_PROMPT` stays free of per-request text.
- **Grep-gate prose.** Comments in `coach.logic.ts` must never name `checkParPublished`,
  `computeRawScore`, `computeFinalScore` or `computeParScore`.
- **Zero paid calls in tests.**

---

## Scope (In)

### A) `coach/coach.types.ts` (**modified**; contract, D-24576)
- `CoachMatchSummary.rawScore`, `.finalScore` and `.grade` become **optional**, with a
  `// why:`. They are absent exactly for a casual (unscored) match.

### B) `coach/coachSummary.logic.ts` (**modified**)
- `buildPerPlayerLines(finalState, inputs: ScoringInputs, resolveCardName,
  botSeatIds)`. The scored builder passes `breakdown.inputs`, a value-identical
  refactor.
- New `buildCasualCoachMatchSummary(finalState, inputs, outcome, resolveCardName,
  botSeatIds): CoachMatchSummary`.
  - It fills every field from `inputs` and the final state, exactly as the scored
    builder does.
  - It omits `rawScore`, `finalScore`, `grade` and `adversityExpected`.
- The scored `buildCoachMatchSummary` output stays byte-identical.

### C) `coach/coach.logic.ts` (**modified**)
- **Seam.** `CoachLogic` gains `captureMatchForCoach: (matchId, database) =>
  Promise<string | null>`. Its production implementation:
  1. `isMatchFinished`; unfinished → `null`
  2. `readReplayHashByMatchId`
  3. `captureMatch` as a fallback
  4. returns the hash, or `null` when the match can't be replayed
- **Casual helper.** New `prepareCasualCoachSummary(reduced, replayHash, deps, logic)`
  returns `{ summary } | { refusal: 'not_found' }`.
  1. Inside **one** `try/catch`: `evaluateEndgame`, `deriveScoringInputs({ finalState,
     stateHash, turnCount }, finalState)`, and the outcome. A throw, a null evaluation, or
     `endedEarly === true` → `not_found`.
  2. **After** the `try/catch`: the best-effort bot-seat lookup, which keeps its own
     warn-and-`[]` catch as on the scored path.
  3. Then `buildCasualCoachMatchSummary`.
- **Orchestrator.** In `generateOrGetCoachReport`, when `findCompetitiveScore` is null:
  1. `reduceReplayByHash`; null → `not_found`
  2. `prepareCasualCoachSummary`
  3. then the shared model call, sequence tips, Table Cooperation and cache write,
     unchanged
- **matchId entry.** New exported `generateOrGetCoachReportForMatch(accountId, matchId,
  deps, logic?)`:
  1. Pass gate (`not_entitled`, no capture)
  2. `captureMatchForCoach`; `null` → `not_found`
  3. `generateOrGetCoachReport(accountId, replayHash, deps, logic)`, which rechecks the
     Pass and then checks ownership
- **Header comment.** Update the file header: engine imports are no longer type-only
  (`evaluateEndgame`, `deriveScoringInputs`).

### D) `coach/coach.routes.ts` (**modified**)
- New `GET /api/me/matches/:matchId/coach`.
  - Auth chain, suspension check, status mapping and error shape are identical to the
    replayHash route.
  - An empty `matchId` → 400.
  - It calls `generateOrGetCoachReportForMatch`.
- `CoachRouteLogic` gains `generateOrGetCoachReportForMatch`, and `KoaCoachContext.params`
  gains `matchId?`.
- The existing route is unchanged. Handed the hash of an unscored owned match, it now
  also serves a casual report.

### E) Tests (**modified**)
- **`coach/coachSummary.logic.test.ts`**
  - The casual builder omits the four PAR fields.
  - Everything else it produces equals the scored builder's output for the same inputs.
  - The scored output is unchanged.
- **`coach/coach.logic.test.ts`**
  - **L227–243 is rewritten.** Its no-score half now asserts `not_found` for an unscored
    match whose reduced state can't be evaluated. The product behavior intentionally
    changed (D-24576), and the commit body says so.
  - New cases:
    - unscored and normally finished → `ok: true`, and the model's summary has no
      `rawScore`, `finalScore` or `grade`. The test state needs `counters.mastermindDefeated`,
      `escapedPile`, `villainDeckCardTypes`, `cardVictoryPoints` and
      `mastermind.{baseCardId,tacticsDefeated}`.
    - ended early → `not_found`, with no model call
    - `not_entitled` and `not_owner` still come before the casual path
    - the casual path writes only through `writeCoachReport`
    - `ForMatch`:
      - without the Pass → `not_entitled`, with `captureMatchForCoach` **not called**
      - an unresolvable match → `not_found`
- **`coach/coach.routes.test.ts`**
  - The matchId route returns 200 with a report, 400 for an empty id, 401/403 per the
    auth deps, and the typed refusal statuses.
  - Existing fakes get only type-driven updates.

### F) `coach/coachClient.ts` (**modified**; prompt constant only)
- Replace "Lower final scores are better." with:
  > Lower final scores are better. If the summary has no rawScore, finalScore or grade,
  > this was a casual (unscored) match: coach the play itself and never invent a score
  > or grade.

### G) Eval pack (**modified**; contract, D-24576)
- `coachEval.types.ts`: `CoachEvalCategory` and `COACH_EVAL_CATEGORIES` gain
  `casual-match`.
- `coachEval.fixtures.ts`: one `casual-match` scenario that has none of `rawScore`,
  `finalScore`, `grade` or `adversityExpected`. Its rubric uses whole-term
  `mustNotMention: ["grade", "final score", "PAR"]`.
- `coachEval.logic.test.ts`: the drift map, plus a shape check that the four fields are
  absent.

### H) `docs/ai/REFERENCE/api-endpoints.md` (**modified**; D-11804, same commit)
- **New row:**
  - `Wired` | `GET` | `/api/me/matches/:matchId/coach` |
    `authenticated-session-required` (+ Legendary Pass)
  - Request: (none — the `:matchId` path param names the match; the account comes from
    the session)
  - Responses: the same `200` and error shapes as `:replayHash/coach`. `404 not_found`
    also covers matches that are unfinished, uncapturable, ended early, or can't be
    evaluated.
  - Owner: WP-751; D-24576
  - Notes: checks the Pass first, then resolves `matchId` → `replayHash` via the finish
    gate → `readReplayHashByMatchId` → `captureMatch` fallback, then delegates.
    Distinguishing an unknown match (404) from a non-owned finished match (403) is
    accepted; it mirrors submit.
- **Row L301, replaced whole:**
  - Request: "(none — the `:replayHash` path param names the owned, normally finished
    match; the account is the session)".
  - Its `404` wording becomes "no replayable, normally finished owned match".
  - Notes: "stored score breakdown, or `deriveScoringInputs` when unscored (no score or
    grade)".
  - Owner: `WP-594 (endpoint); WP-751 (casual path); D-24403; D-24576`.

---

## Out of Scope

- **No client change.** That's WP-752.
- **No casual score, grade, PAR or luck read**, and no default scoring weights.
- **No new table or migration**, and no write to `competitive_scores`.
- **No change to submission, `par_not_published`, or scoring.**
- **The existing public flip on a `par_not_published` submit is not fixed here.** That
  submit flips the caller's ownership to public before the PAR check refuses it
  (`competition.logic.ts:474`). It needs its own follow-up.
- **No coach on guest matches.** Guests own nothing (D-24120).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/coach/coach.types.ts` — **modified** — optional score fields
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — casual builder; `buildPerPlayerLines(inputs)`
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified**
- `apps/server/src/coach/coach.logic.ts` — **modified** — casual path via `prepareCasualCoachSummary`, `ForMatch` entry, `captureMatchForCoach` seam, header
- `apps/server/src/coach/coach.logic.test.ts` — **modified** — incl. the L227–243 rewrite
- `apps/server/src/coach/coach.routes.ts` — **modified** — matchId route + seam
- `apps/server/src/coach/coach.routes.test.ts` — **modified**
- `apps/server/src/coach/coachClient.ts` — **modified** — one prompt sentence
- `apps/server/src/coach/coachEval.types.ts` — **modified** — `casual-match`
- `apps/server/src/coach/coachEval.fixtures.ts` — **modified** — casual scenario
- `apps/server/src/coach/coachEval.logic.test.ts` — **modified** — drift + shape
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — new row + replaced L301 row

These 12 files form the `EC-788:` commit, and nothing else may be modified in it. The
govern-close `SPEC:` commit edits STATUS, DECISIONS (D-24576 Active), WORK_INDEX,
EC_INDEX and `docs/05-ROADMAP-MINDMAP.md`.

---

## Contract

- **`CoachMatchSummary`:** `rawScore?`, `finalScore?` and `grade?` are present for scored
  matches and absent for casual ones.
- **`buildCasualCoachMatchSummary(finalState, inputs, outcome, resolveCardName,
  botSeatIds)`:** omits the four PAR fields.
- **`generateOrGetCoachReport`:** with no score row, it coaches an owned, normally
  finished match from `deriveScoringInputs`. An ended-early or unevaluable match →
  `not_found`.
- **`generateOrGetCoachReportForMatch(accountId, matchId, deps, logic?)`:** Pass, then
  capture, then delegate.
- **`GET /api/me/matches/:matchId/coach`:** response and refusal shapes match the
  replayHash route.

---

## Vision Alignment

- **Vision clauses touched:**
  - §3: trust — the coaching reflects the match actually played
  - §19: AI analysis support
  - §23(b): creates no asynchronous comparison entry
  - NG-1
  - Financial Sustainability: the Pass now delivers on every completed signed-in match
- **Conflict assertion:** No conflict — this WP preserves all touched clauses.
- **Non-Goal proximity:** NG-1..7 are not crossed.
  - NG-1: no score, rank or leaderboard entry
  - NG-2: no randomized purchase
  - NG-3: casual play itself stays free
  - NG-4: no timers
  - NG-5: no ads
  - NG-6 and NG-7: no pressure copy
- **Determinism:** no gameplay, scoring, replay or RNG change. The casual path is a read
  over an existing replay.

## Funding Surface Gate

**N/A.** This extends an existing Legendary-Pass-gated feature. It adds no funding
affordance to global nav, the registry or profiles, no tournament-funding channel, and
no donate/support copy (§20.1). Authority: WP-097 / D-9701 / D-9801.

## API Catalog

**Triggered (§21).** One new `Wired` route, and one existing row whose behavior widens.
Both rows are specified in full in Scope H and land in the same commit.

---

## Acceptance Criteria

All are binary pass/fail.

- [ ] An owned, normally finished, unscored match gets coached (`ok: true`). The model's
  summary has no `rawScore`, `finalScore`, `grade` or `adversityExpected`.
- [ ] An ended-early or unevaluable unscored match returns `not_found`, and the model is
  never called.
- [ ] Scored summaries and flow are unchanged, and the scored tests pass.
- [ ] `not_entitled` and `not_owner` still come before the casual path. On the matchId
  route, a caller without the Pass triggers no capture.
- [ ] The casual path writes only through `writeCoachReport`, plus idempotent capture on
  the matchId route.
- [ ] `GET /api/me/matches/:matchId/coach` returns 200, 400, the auth statuses and the
  typed refusals as specified.
- [ ] The prompt carries the casual sentence.
- [ ] The eval pack has a `casual-match` scenario, and its drift and shape tests pass.
- [ ] Both catalog rows are present.
- [ ] `pnpm -r build` exits 0 and the server suite is green, with counts recorded. The
  `EC-788:` diff is exactly the 12 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
# Expected: exit 0; the new casual-path, route, summary and eval cases pass

Select-String -Path "apps\server\src\coach\coach.routes.ts" -Pattern "/api/me/matches/:matchId/coach"
# Expected: one match

Select-String -Path "apps\server\src\coach\coach.logic.ts" -Pattern "checkParPublished|computeRawScore|computeFinalScore|computeParScore"
# Expected: zero matches (the casual path reads no PAR and computes no score)

Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/me/matches/:matchId/coach"
# Expected: the new Wired row

git diff --name-only
# Expected (implementation commit): exactly the 12 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026) on play.legendary-arena.com.** The full check comes
  after WP-752 ships the client: a Pass holder finishes a casual match and gets coaching
  with no score or grade. Before that, the server-side proof is an authenticated
  `GET /api/me/matches/<matchId>/coach` returning 200 for an owned, finished casual
  match. Record it in STATUS.
- [ ] `docs/ai/STATUS.md` is updated.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are in the `EC-788:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24576 has landed as Active.
- [ ] `WORK_INDEX.md` has WP-751 `[x]`, and `EC_INDEX.md` has EC-788 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md`: the node moves from `📝` to `✅`, then
  `pnpm roadmap:counts:write`, and `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24576 (reserved; drafted 2026-09-23): the AI Coach works on unscored matches.**
  - **Casual coaching.** When there is no score row, `generateOrGetCoachReport` coaches
    an owned, normally finished match.
    - Its summary comes from `deriveScoringInputs` over the replayed final state.
    - `rawScore`, `finalScore`, `grade` and `adversityExpected` are omitted, and the
      three score fields become optional on `CoachMatchSummary`.
  - **New route.** `GET /api/me/matches/:matchId/coach` checks the Pass first, then
    resolves `matchId` → `replayHash` the way submit does (idempotent on-demand
    capture), then delegates.
  - **Exclusions.** Ended-early and unevaluable matches are never coached.
  - **Writes (NG-1).** The casual path reads no PAR and writes only the coach cache,
    plus the harvester-equivalent capture rows. It never flips visibility, and never
    creates a score, rank, badge or leaderboard entry.
  - **Cache.** A casual report cached for a `replayHash` is served even if a score row
    lands later, so the client requests casual coaching only after submit has settled as
    permanently unscored (WP-752's `ineligible` rule).
  - **Existence signal.** Returning 404 for an unknown match and 403 for someone else's
    finished match is accepted; submit already does the same.
  - **Eval pack.** Gains a `casual-match` category.

---

## Lint Gate Self-Review (00.3)

Independent reviewer, two rounds.

**Round 1: FAIL on §2, §17, §20, §21, and the EC.**
- §2: the write rule was misstated. The matchId route's capture also writes replay and
  ownership rows.
- §17: NG coverage stopped at NG-1.
- §20: had no N/A declaration.
- §21: the row content wasn't locked.
- EC: the mindmap line was missing, it said "four greps", and `logic?` was inconsistent.
- All applied. Notes on §4, §5, §8 and §16.4 were also applied: `prepareCasualCoachSummary`
  was extracted, and D-24403 and D-24120 are cited.

**Round 2: all sections PASS or N/A**, after two fixes:
- §4 now cites 00.2 and ARCHITECTURE's Layer Boundary.
- §7 now says there are no new npm dependencies.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-23)**, conditional on PS-1..PS-3. All three are applied, and
each fits inside the 12-file allowlist.
- **PS-1:** the L227–243 test rewrite is authorized, with the behavior change noted in the
  commit body.
- **PS-2:** the Pass check runs **before** capture in `generateOrGetCoachReportForMatch`, so
  a caller without the Pass causes no writes.
- **PS-3:** the `CoachRouteLogic` and `params` seam is locked.

RS-1..RS-4 are applied:
- one `try/catch` around the engine calls
- the cache-order rule is recorded in D-24576
- the redundant seam member is dropped
- the header is updated

**Scaffold:** a clean build; the coach suite ran 98 tests in 6 suites, 0 failures.

**Verified in code:**
- `deriveScoringInputs` covers every `inputs.*` field the summary reads.
- Nothing else reads the score fields as required.
- There is no import cycle.
- Capture is idempotent and assigns ownership only to seats that played.

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on #11, #22, #25, #4 and #26. All were resolved by PS-1..3 and
RS-1..2.

**Round 2: RISK / HOLD** on four text items:
- #26 and #22: the `try/catch` wording differed between the WP and the EC. Only the engine
  calls are inside it; bot seats and the builder come after.
- #4: the three index rows still said "writes only the coach cache".
- #6: the Request cell of catalog row L301 was stale.

All four were applied verbatim as the reviewer supplied them, along with the reviewer's
line-number corrections (L151–154, :200, L227–243, 87–89). The reviewer stated the verdict
is **CONFIRM** once those are applied, without re-running pre-flight.

---

## See Also

- WP-594 / D-24403: the coach
- WP-737 / D-24559: the eval pack
- WP-742 / D-24564: the bot-ally marker
- WP-715 / D-24538: synergy on all matches
- WP-752: the client for this route
- ewiki `scoring.md` "Which end-of-match view you get" (#2310)
