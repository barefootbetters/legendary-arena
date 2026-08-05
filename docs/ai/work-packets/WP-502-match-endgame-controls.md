# WP-502 — Match End-of-Life Controls: Play Again + End Game

**Status:** Done 2026-08-05 — standard two-session class (NOT lightweight-lane eligible: crosses three layers, touches scoring/leaderboard integrity, adds a projected contract field, and rides the multiplayer gameover broadcast), drafted + executed in a single collapsed arc by operator direction. **Gates: governance/lint audit SATISFIED (1 gap → FIXED: api-catalog row) · adversarial correctness audit 1 CONFIRMED ISSUE → FIXED (stale End Game confirm state)** — both run as independent audit subagents; see Gate Verdicts.
**User-Visible Surface:** direct — two new play-surface controls: **Play Again** on the endgame panel (relaunch a fresh match with the same loadout to improve your score) and **End Game** during a live match (confirm-gated; ends the match early for everyone). D-24026 live-verify applies (both controls exercised in a real match on play.legendary-arena.com).
**Primary Layer:** Cross-cutting (Game Engine + Server + Arena Client).
**Dependencies:** WP-367 / D-24159 (the deck-exhaustion `tie` outcome + the `evaluateEndgame` endgame-counter model this rides); WP-342 / D-24131 (the server outcome-derivation via `evaluateEndgame` in `submitCompetitiveScoreImpl`); WP-339 / D-24126 (the client submit-on-gameover hook that is the sole competitive submitter); the D-16501 match-root mount for the arena-client play surface.

---

## Goal

Give players a graceful way to end and restart a match. Today a match only ends
on an authoritative endgame condition (mastermind defeated, scheme completed, too
many escapes, or a deck-exhaustion tie), and there is no way to relaunch. This WP
adds two controls:

1. **Play Again** — on match end (gameover), a button that relaunches a fresh
   match with the **same loadout** (arcade "insert another quarter" to beat your
   score). Solo relaunch: the clicking browser creates + joins a new match at seat
   0 with the identical composition and the same player count.
2. **End Game** — during a live match, a confirm-gated control that ends the match
   early for **everyone** (the group ran out of time). Because the engine owns
   truth and broadcasts state to every seat, one player ending it flips every
   connected client's screen to the endgame panel.

An early-ended match is **never scored** on the competitive/gauntlet leaderboard.
This is enforced by a distinct `endedEarly` marker on the gameover so scoring can
tell it apart from a genuine deck-exhaustion tie — a server-enforced rejection
(defense in depth) plus a client skip. See D-24306.

## Assumes (Hard-Gate Preconditions)

```bash
# A. The top-level endIf delegates to evaluateEndgame(G) — so a counter written by a
#    move ends the match for all seats, no events.endGame needed.
grep -Eq "endIf.*evaluateEndgame|evaluateEndgame\(.*\) \?\? undefined" packages/game-engine/src/game.ts && echo "A_OK endIf is evaluateEndgame-derived"
# B. buildUIState derives gameOver from evaluateEndgame, NOT ctx.gameover — so the
#    endgame PANEL appears only when evaluateEndgame returns non-null.
grep -q "evaluateEndgame(gameState)" packages/game-engine/src/ui/uiState.build.ts && echo "B_OK gameOver is counter-derived"
# C. The audience filter passes gameOver through by spread — so an additive field on it survives.
grep -q "result.gameOver = { ...uiState.gameOver }" packages/game-engine/src/ui/uiState.filter.ts && echo "C_OK filter spreads gameOver"
# D. The competitive submit hook is the sole client submitter and already reads snapshot.gameOver.
grep -q "snapshot?.gameOver" apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts && echo "D_OK sole submitter reads gameOver"
# E. The server derives outcome from evaluateEndgame on the reduced final G (the reject point).
grep -q "evaluateEndgame(reduced.finalState" apps/server/src/competition/competition.logic.ts && echo "E_OK server evaluates reduced endgame"
# F. The rejection union has a paired canonical drift array (BOTH must change together).
grep -q "SUBMISSION_REJECTION_REASONS" apps/server/src/competition/competition.types.ts && echo "F_OK rejection-reason drift array present"
```

## Context (Read First)

- **End Game is an endgame COUNTER, not `events.endGame`.** The client-visible
  `gameOver` is derived by `buildUIState` from `evaluateEndgame(G)` (which reads
  `G.counters`) — it does **not** read `ctx.gameover`. A raw `events.endGame()`
  call would set `ctx.gameover` and stop the match, but `evaluateEndgame` would
  still return `null`, so **the endgame panel would never appear** — the classic
  "screen freezes with no endgame screen" failure. So End Game sets a new endgame
  counter `MATCH_ENDED_EARLY`; `evaluateEndgame` reads it (highest priority) and
  returns a `tie`; the already-existing top-level `endIf` (`evaluateEndgame(G) ??
  undefined`) then sets `ctx.gameover` for all seats, and `buildUIState` surfaces
  the panel to every client. One counter, both effects.
- **Outcome stays `'tie'`; `endedEarly` is an additive marker.** The
  `EndgameOutcome` union (`'heroes-win' | 'scheme-wins' | 'tie'`) is **UNCHANGED**.
  Adding a fourth member would blast across competition (`CompetitiveOutcome`
  mirror + migration `026_add_outcome_to_competitive_scores.sql`), the dashboard,
  co-op, campaign, and simulation. Instead, `EndgameResult` gains an optional
  `endedEarly?: boolean`; an early end is `{ outcome: 'tie', reason: '…', endedEarly:
  true }`. A genuine tie / win / loss leaves `endedEarly` absent. The projected
  `UIGameOverState` gains the same optional field.
- **Never-score-early-end is server-enforced, not just a client courtesy.**
  `submitCompetitiveScoreImpl` already reconstructs the finished match's final G
  and calls `evaluateEndgame`. This WP rejects the submission with a new
  `SubmissionRejectionReason` value `ended_early` when `endgameResult.endedEarly`
  is true — **before** any row is written. The client also skips the POST, but the
  server is the adjudicator (a tampered / replayed client cannot force a score).
- **`SubmissionRejectionReason` has a paired canonical array (drift lockstep).**
  `competition.types.ts` mirrors the union in `SUBMISSION_REJECTION_REASONS` with a
  drift-detection test (`competition.logic.test.ts`, `never`-branch exhaustiveness).
  Adding `ended_early` requires updating the union **and** the array in the same
  change — updating only one fails the drift test (code-style §Drift Detection).
- **No new top-level `G` field; no hash re-pin.** The counter is written only at
  runtime when `endMatchEarly` fires; the initial `G` shape is unchanged, so no
  `finalStateHash` / `PRE_WP080` sentinel moves (N/A). The `ENDGAME_CONDITIONS`
  const object gains a key — a data-only additive change, no union/canonical-array
  drift pair (it is a plain constant map, unlike `EndgameOutcome`).
- **Play Again is a solo relaunch, client-side.** The endgame surface reads the
  stashed loadout via `readMatchSetup(matchId)` (`diagnostics/matchSetupSession.ts`),
  derives the player count from the live snapshot's seat count, reads player name +
  auth token from the stores, and calls `launchMatchFromComposition(...)`
  (`lobby/useCreateMatchFromComposition.ts`) to create + join + navigate.
  `EndgameSummary.vue` stays a pure props component; the wiring lives in the play
  surface (the D-16501 match root — `PlayViewport.vue`, the same mount point as the
  submit hook) or a small new container.

## Scope (In)

- **Engine — `endMatchEarly` move + `MATCH_ENDED_EARLY` counter.** New endgame
  condition constant; new server-only move that sets it (no-op if already over);
  `evaluateEndgame` checks it first and returns the early-end `tie`.
- **Engine — `endedEarly` projection.** `EndgameResult` and `UIGameOverState` gain
  optional `endedEarly?: boolean`; `buildUIState` spreads it into the projected
  `gameOver`; a confirming audience-filter test asserts it survives for player +
  spectator.
- **Server — leaderboard integrity.** `submitCompetitiveScoreImpl` rejects an
  early-ended match with `ended_early`; the union + canonical array gain the value.
- **Arena Client — controls + submit skip.** End Game control (confirm-gated,
  fires `submitMove('endMatchEarly', {})`); Play Again control (relaunch via
  `launchMatchFromComposition`); the submit hook skips the POST and sets
  `'ineligible'` when `gameOver.endedEarly === true`.

## Out of Scope

- **Multiplayer "vote to end" / any per-seat consent flow.** End Game is fired by
  the current active player (boardgame.io gates top-level moves to the active
  player — accepted limitation); the effect still closes the match for everyone via
  the gameover broadcast. No voting UI, no host-only permission model.
- **Play Again as a multiplayer re-invite / rematch lobby.** Play Again is a solo
  relaunch of the clicking browser only; re-gathering the same friends into a new
  match is a separate future WP.
- **Scoring an early end as any competitive result** (a "resignation" score, a
  partial-credit leg, etc.). An early end is simply non-scored; whether it should
  earn anything is a separate ranked-design decision.
- **Any `EndgameOutcome` union change, any new HTTP endpoint, any schema migration**
  (the `outcome` column stays a two-value decisive set; `endedEarly` never persists
  to `competitive_scores`).

## Files Expected to Change

Engine (`packages/game-engine/src/`):
- `endgame/endgame.types.ts` — **modified** (`ENDGAME_CONDITIONS.MATCH_ENDED_EARLY`; `EndgameResult.endedEarly?`)
- `endgame/endgame.evaluate.ts` — **modified** (check `MATCH_ENDED_EARLY` first → early-end `tie`)
- `endgame/endgame.evaluate.test.ts` — **modified** (early-end result; genuine tie/win/loss omit `endedEarly`)
- `moves/endMatchEarly.ts` — **new** (sets the counter; never throws; no-op when over)
- `moves/endMatchEarly.test.ts` — **new** (sets counter; no-op-when-over; never-throws)
- `game.ts` — **modified** (register `endMatchEarly: { move: endMatchEarly, client: false }`)
- `game.test.ts` — **modified** (move-registration drift: move set + count)
- `ui/uiState.types.ts` — **modified** (`UIGameOverState.endedEarly?`)
- `ui/uiState.build.ts` — **modified** (spread `endedEarly` into projected `gameOver`)
- `ui/uiState.build.test.ts` — **modified** (`endedEarly` projected after the move)
- `ui/uiState.filter.ts` — **modified only if needed** (spread already passes `gameOver`; a confirming test is required)
- the audience-filter test file (`ui/uiState.filter.test.ts` or equivalent) — **modified** (`endedEarly` survives for player + spectator)

Server (`apps/server/src/competition/`):
- `competition.types.ts` — **modified** (`'ended_early'` in the union **and** `SUBMISSION_REJECTION_REASONS`)
- `competition.logic.ts` — **modified** (reject `ended_early` before any INSERT)
- `competition.logic.test.ts` — **modified** (early-ended submission rejected; no row; drift test updated)

Client (`apps/arena-client/src/`):
- `composables/useCompetitiveSubmitOnGameover.ts` — **modified** (skip POST → `'ineligible'` when `gameOver.endedEarly`)
- `components/play/uiMoveName.types.ts` — **modified** (add `'endMatchEarly'` to the `UiMoveName` submitMove-name union)
- `components/play/TurnActionBar.vue` — **modified** (End Game confirm-gated button)
- `pages/PlayViewport.vue` — **modified** (Play Again wiring at the D-16501 match root, the submit-hook host)
- `components/play/EndgameActions.vue` — **new** (pure Play Again / Back-to-Lobby panel; `EndgameSummary.vue` stays pure props)
- the matching `.test.ts` for each changed/added client file (`useCompetitiveSubmitOnGameover.test.ts`, `TurnActionBar.test.ts`, `EndgameActions.test.ts`)

Governance: `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/DECISIONS.md` (D-24306), `docs/ai/REFERENCE/api-endpoints.md` (**required** — add `ended_early` to the `POST /api/competition/scores` `422` error set per D-11804 §21.1).

## Contract

`endMatchEarly` (server-only move, `client: false`, NOT in `CORE_MOVE_NAMES`) sets
`gameState.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY] = 1`; it never throws and
is a no-op when the game is already over. `evaluateEndgame` checks
`MATCH_ENDED_EARLY` **first** and returns `{ outcome: 'tie', reason: 'The players
ended the match early.', endedEarly: true }`; every other outcome (win / loss /
deck-exhaustion tie) leaves `endedEarly` absent. The top-level `endIf` sets
`ctx.gameover`; `buildUIState` projects `gameOver.endedEarly` and the audience
filter passes it through to player + spectator. The server rejects a competitive
submission for an early-ended match with `ended_early` (union + canonical array,
lockstep) before writing any row; the client submit hook skips the POST and sets
`'ineligible'`. `EndgameOutcome` is unchanged; no top-level `G` field is added; no
`finalStateHash` / `PRE_WP080` re-pin (N/A).

## Acceptance Criteria

1. After `endMatchEarly`, `MATCH_ENDED_EARLY` is set and `evaluateEndgame(G)`
   returns `{ outcome: 'tie', reason: 'The players ended the match early.',
   endedEarly: true }`; the top-level `endIf` sets `ctx.gameover`.
2. `endMatchEarly` never throws; is a no-op when the game is already over;
   registered `{ move: endMatchEarly, client: false }`; `game.test.ts` move set +
   count updated; NOT in `CORE_MOVE_NAMES`.
3. `UIState.gameOver.endedEarly === true` after the move, and it survives the
   audience filter for **both** the player and the spectator audiences.
4. A genuine tie / win / loss has `endedEarly` absent (the marker is early-end-only).
5. `submitCompetitiveScoreImpl` rejects an early-ended match with `ended_early`; no
   `competitive_scores` row is written; the union **and** `SUBMISSION_REJECTION_REASONS`
   both carry the value (drift test green).
6. `useCompetitiveSubmitOnGameover` does **not** POST when `gameOver.endedEarly ===
   true`; status → `'ineligible'` (permanent, non-error, non-retriable).
7. The End Game control fires `submitMove('endMatchEarly', {})` behind a confirm
   ("End the match for everyone?"); Play Again relaunches via
   `launchMatchFromComposition` with the stashed loadout + the snapshot's seat count.
8. `pnpm -r build` + `pnpm -r test` + `pnpm --filter @legendary-arena/arena-client
   typecheck` exit 0. No `finalStateHash` / `PRE_WP080` re-pin (N/A — no initial-G
   shape change; state this explicitly in STATUS).

## Verification Steps

```bash
pnpm -r build
pnpm -r --no-bail test 2>&1 | tail -12          # whole-repo totals (engine + server + client)
pnpm --filter @legendary-arena/arena-client typecheck   # vue-tsc — build+test do NOT typecheck
# Sentinel hashes must be byte-unchanged (nothing wrote to initial G):
git diff --exit-code -- packages/game-engine/src/simulation 2>/dev/null; echo "sentinel drift above (expect none)"
# Scope lock — no stray files outside the allowlist:
git diff --name-only | grep -vE '^(packages/game-engine/src/(endgame|moves|ui)/|apps/server/src/competition/|apps/arena-client/src/|docs/|game\.ts)' ; echo "out-of-scope hits above (expect none)"
```

Live-verify (D-24026, post-deploy on play.legendary-arena.com): in a real match,
click **End Game** → confirm → every seat flips to the endgame panel; click **Play
Again** → a fresh match with the same loadout launches at seat 0; confirm no
leaderboard score was recorded for the early-ended match.

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–F passed
- [ ] All 8 Acceptance Criteria pass
- [ ] `endMatchEarly` sets `MATCH_ENDED_EARLY`, never throws, no-ops when over, `client: false`, NOT in `CORE_MOVE_NAMES`; `game.test.ts` move set + count updated
- [ ] `evaluateEndgame` checks `MATCH_ENDED_EARLY` first; `endedEarly` additive-optional on `EndgameResult` + `UIGameOverState`; `EndgameOutcome` unchanged
- [ ] `endedEarly` projected by `buildUIState` and survives the audience filter (player + spectator) — confirming test present
- [ ] Server rejects `ended_early` before any INSERT; union + `SUBMISSION_REJECTION_REASONS` updated in lockstep; drift test green
- [ ] Client submit hook skips the POST and sets `'ineligible'` on `endedEarly`
- [ ] `pnpm -r build` + `pnpm -r test` + arena-client `typecheck` exit 0; no re-pin (N/A)
- [ ] Only the allowlisted files + governance changed; client wiring file set confirmed at the match root
- [ ] `docs/ai/STATUS.md` Done entry (states "no re-pin — no initial-G shape change"); WORK_INDEX `[x]` + EC_INDEX Done; NUMBER-LEDGER `RESERVED`→`LANDED`; D-24306 flipped Active; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` 0
- [ ] Commit prefix `EC-537:` (code) + `SPEC:` (governance close)
- [ ] D-24026 live-verify: End Game closes the match for all seats + Play Again relaunches the same loadout + early-ended match is unscored (operator-pending, post-deploy)

## Gate Verdicts (drafting session)

This WP was drafted **and** executed in a single collapsed arc (operator drives
process per the standing "process is mine to drive" directive); the two-session
*split* collapses but every load-bearing gate is kept, and the procedural
independence the split provides was preserved by running the gates as **independent
audit subagents** against the finished diff + WP/EC (the `feedback_gate_subagents`
precedent).

- **Correctness (adversarial subagent):** **1 CONFIRMED ISSUE, now fixed.** The
  auditor traced the move contract, endgame priority, the five-step UIState field,
  the move-registration + `SUBMISSION_REJECTION_REASONS` drift pairs, the
  before-INSERT server reject, and the client wiring — all sound, and confirmed **no
  initial-G shape change / no hash re-pin**. It caught one real UX-safety defect:
  `TurnActionBar`'s `isConfirmingEndGame` survived a turn change (the `v-if`-hidden
  control was never unmounted), so the viewer's next turn could render a pre-armed
  "Yes, end it" — a single stray click could end the match. **Fixed:** a `watch` on
  `isViewerTurn` re-arms to the safe state when it stops being the viewer's turn, +
  a regression test.
- **Governance / lint (independent subagent):** **LINT SATISFIED after one fix.**
  Diff↔allowlist clean; both drift pairs present; §4 naming consistent; DoD complete.
  One real gap caught: the new `ended_early` reason surfaces as `422 { error:
  'ended_early' }` at the wired `POST /api/competition/scores` boundary, a D-11804
  §21.1 response-shape trigger. **Fixed:** `api-endpoints.md` row updated (whole-row
  per D-11804) + WP/EC API-catalog sections reconciled. (A second flag — the compact
  WP template omits a `## Non-Negotiable Constraints` block — is the sanctioned
  house-form shipped by WP-500/501; no change.)
- **Lane:** standard two-session class — three-layer crossing + leaderboard integrity
  + a projected contract field + multiplayer gameover broadcast. Explicitly NOT
  lightweight-lane eligible; the session *split* was collapsed by operator direction,
  not by lightweight eligibility.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** canonical names used verbatim — `counters`, `outcome`, `reason`;
  the new marker `endedEarly` is additive-optional, matching the `finalTurn`
  present-only-when-active precedent; no rename of any locked field.
- **§5:** Files Expected to Change is a closed set (engine + server + client + governance) matching the EC; the client wiring file set is declared approximate with an executor-confirms clause and a scope-lock FAIL rule.
- **§10 (env):** N/A — no new env var. **§11 (auth):** N/A — no new auth surface; End Game rides the existing move channel; Play Again reuses the existing create-match auth token. **§12 (tests):** `.test.ts` only; engine + server (incl. drift) + client (vue-tsc-gated) suites extended.
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** the only verification greps run over `git diff --name-only` and the sentinel path; STATUS authored at close against live HEAD.
- **§Drift Detection:** `SUBMISSION_REJECTION_REASONS` union+array lockstep and the `game.test.ts` move-set+count drift are both called out as DoD gates.
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism). **Conflict:** `No conflict.` The
`endMatchEarly` move mutates only `G.counters` (no `ctx.random.*`, no clock, no I/O),
so the game still replays identically; the counter is written only at runtime and is
never persisted (`G` shape unchanged, no snapshot/hash surface). End Game and Play
Again lower friction to finish and re-play — no card semantics, scoring weights, or
persistence-of-`G` change. **Non-Goal check:** none of NG-1..8 crossed — an early
end is explicitly **non-scored** (no competitive advantage, no pay-to-win, no
persuasion/monetization surface). Ranked integrity is *strengthened*: the server now
refuses to score an operator-terminated match.

## Funding Surface Gate

**N/A — no funding surface touched** (no nav / registry / profile-funding /
tournament affordance or copy; the two controls are pure gameplay lifecycle).
Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**No new HTTP endpoint.** End Game rides the existing boardgame.io move transport
(`submitMove`); Play Again reuses the existing create-match flow
(`launchMatchFromComposition`). **One existing wired endpoint's response shape
changes (D-11804 §21.1):** the new `ended_early` `SubmissionRejectionReason` surfaces
at the boundary of `POST /api/competition/scores` as `422 { error: 'ended_early' }`
(via the default branch of `statusForRejectionReason`). The `api-endpoints.md` row for
that endpoint is updated to add `ended_early` to its `422` error set (whole-row replace
per D-11804). The `Library-only` rows (`submitCompetitiveScoreByMatchIdForRequest`,
`reduceReplayByHash`) return typed `SubmissionResult` unions and need no change. No new
endpoint, no request-schema change.
