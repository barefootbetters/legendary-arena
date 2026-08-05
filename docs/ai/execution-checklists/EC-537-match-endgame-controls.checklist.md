# EC-537 — Match End-of-Life Controls: Play Again + End Game (Execution Checklist)

**Source:** docs/ai/work-packets/WP-502-match-endgame-controls.md
**Layer:** Cross-cutting (Game Engine + Server + Arena Client). Standard two-session lane — NOT lightweight-lane eligible.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (apps import built `dist`; stale dist fakes failures)
- [ ] Precond A: `grep -Eq "endIf.*evaluateEndgame" packages/game-engine/src/game.ts` (endIf is evaluateEndgame-derived)
- [ ] Precond B: `grep -q "evaluateEndgame(gameState)" packages/game-engine/src/ui/uiState.build.ts` (gameOver counter-derived, not ctx.gameover)
- [ ] Precond C: `grep -q "result.gameOver = { ...uiState.gameOver }" packages/game-engine/src/ui/uiState.filter.ts` (filter spreads gameOver)
- [ ] Precond D: `grep -q "snapshot?.gameOver" apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` (sole submitter reads gameOver)
- [ ] Precond E: `grep -q "evaluateEndgame(reduced.finalState" apps/server/src/competition/competition.logic.ts` (server reject point)
- [ ] Precond F: `grep -q "SUBMISSION_REJECTION_REASONS" apps/server/src/competition/competition.types.ts` (paired drift array — BOTH change together)
- [ ] Baseline green: `pnpm -r build` + `pnpm -r test` + `pnpm --filter @legendary-arena/arena-client typecheck` exit 0 BEFORE any edit
- [ ] Scope lock: the target file set is EXACTLY §Files to Produce; any file outside it is a FAIL, not a judgment call. Confirm the client wiring file at the D-16501 match root (`PlayViewport.vue`) before touching it.

## Locked Values (do not re-derive)
- `ENDGAME_CONDITIONS.MATCH_ENDED_EARLY = 'matchEndedEarly'` (new key in `endgame.types.ts`).
- Early-end `EndgameResult`: `{ outcome: 'tie', reason: 'The players ended the match early.', endedEarly: true }`. `outcome` STAYS `'tie'` — the `EndgameOutcome` union is UNCHANGED. `endedEarly?: boolean` is additive-optional on `EndgameResult` AND `UIGameOverState`.
- `evaluateEndgame` checks `MATCH_ENDED_EARLY` **FIRST** (highest priority), before escapes/scheme/mastermind/finalTurnTie.
- Move name `endMatchEarly` (`moves/endMatchEarly.ts`); registered in `game.ts` as `endMatchEarly: { move: endMatchEarly, client: false }` (D-10008). NOT in `CORE_MOVE_NAMES`.
- `endMatchEarly` body: no-op `return` if `evaluateEndgame(G) !== null` (already over); else set `gameState.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY] = 1`; `return void`. Never throws.
- Server rejection reason `'ended_early'` — add to the `SubmissionRejectionReason` union AND the `SUBMISSION_REJECTION_REASONS` canonical array (lockstep; drift test in `competition.logic.test.ts`). Reject in `submitCompetitiveScoreImpl` when `endgameResult?.endedEarly === true`, BEFORE any INSERT: `return { ok: false, reason: 'ended_early' }`.
- Client skip status `'ineligible'` (permanent, non-error, non-retriable — mirrors the existing `par_not_published` disposition) when `snapshot.gameOver.endedEarly === true`; do NOT POST.

## Guardrails
- Use the COUNTER, not `events.endGame`. `events.endGame` sets `ctx.gameover` but leaves `evaluateEndgame` null → the endgame panel never appears (hard-freeze). The counter drives BOTH `endIf` and the panel.
- `endMatchEarly` never throws and is a no-op when the game is already over (only `Game.setup()` may throw; moves return void).
- `outcome` stays `'tie'` — do NOT add an `EndgameOutcome` union member (avoids the CompetitiveOutcome/migration-026/dashboard/coop/campaign/sim blast radius).
- `endedEarly` is additive-OPTIONAL everywhere; a genuine win/loss/deck-tie leaves it absent.
- No new top-level `G` field; the counter is written only at runtime → no `finalStateHash`/`PRE_WP080` re-pin (N/A). If a sentinel moves, STOP: something wrote to initial G.
- Server rejection is AUTHORITATIVE; the client skip is advisory/UX only. Both must land.
- End Game is confirm-gated ("End the match for everyone?"). It is fired by the active player only (bgio gates top-level moves) — accepted; the gameover broadcast still closes it for everyone.
- `SUBMISSION_REJECTION_REASONS` union+array and the `game.test.ts` move-set+count are drift pairs — update both halves or the drift/registration tests fail.
- If {an `EndgameOutcome` change, a schema migration, a new HTTP endpoint, or scope ambiguity} turns out necessary → STOP and re-scope.

## Required `// why:` Comments
- `evaluateEndgame` `MATCH_ENDED_EARLY`-first branch (why: an operator-ended match outranks every natural condition; it is a non-scored tie via the `endedEarly` marker — D-24306).
- `endMatchEarly` counter write (why: End Game is modeled as the endgame counter, not `events.endGame`, because the UIState panel is `evaluateEndgame`-derived not `ctx.gameover`-derived — D-24306).
- Server `ended_early` rejection (why: an early-ended match is never scored; server-enforced defense-in-depth over the client skip — D-24306).
- Client skip-on-`endedEarly` (why: an early end is permanently non-scored, not a retriable failure; mirrors the `par_not_published` `'ineligible'` disposition).

## Files to Produce
- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — `MATCH_ENDED_EARLY` const + `EndgameResult.endedEarly?`
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — `MATCH_ENDED_EARLY` checked first → early-end `tie`
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — early-end result; other outcomes omit `endedEarly`
- `packages/game-engine/src/moves/endMatchEarly.ts` — **new** — sets the counter; never throws; no-op when over
- `packages/game-engine/src/moves/endMatchEarly.test.ts` — **new** — sets counter / no-op-when-over / never-throws
- `packages/game-engine/src/game.ts` — **modified** — register `{ move: endMatchEarly, client: false }`
- `packages/game-engine/src/game.test.ts` — **modified** — move-set + move-count drift
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIGameOverState.endedEarly?`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — spread `endedEarly` into projected `gameOver`
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — `endedEarly` projected after the move
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified if needed** + its filter test — `endedEarly` survives for player + spectator (confirming test REQUIRED)
- `apps/server/src/competition/competition.types.ts` — **modified** — `'ended_early'` in union + canonical array
- `apps/server/src/competition/competition.logic.ts` — **modified** — reject `ended_early` before INSERT
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — early-ended rejected / no row / drift test
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` (+ test) — **modified** — skip POST → `'ineligible'`
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — add `'endMatchEarly'` to the `UiMoveName` union (submitMove name gate)
- `apps/arena-client/src/components/play/TurnActionBar.vue` (+ test) — **modified** — End Game confirm-gated button
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — Play Again wiring at the match root (the D-16501 submit-hook host)
- `apps/arena-client/src/components/play/EndgameActions.vue` (+ test) — **new** — pure Play Again / Back-to-Lobby panel (`EndgameSummary.vue` stays pure props)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — add `ended_early` to the `POST /api/competition/scores` `422` error set (D-11804 §21.1: the reason surfaces at the wired endpoint's boundary)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` — **modified** — governance close

## After Completing
- [ ] Engine early-end + projection + move tests green; server reject + drift tests green; client skip + control tests green
- [ ] `pnpm -r build` + `pnpm -r test` + `pnpm --filter @legendary-arena/arena-client typecheck` exit 0
- [ ] Sentinel hashes byte-unchanged (no initial-G write) — no `finalStateHash`/`PRE_WP080` re-pin
- [ ] `git diff --name-only | grep -vE '^(packages/game-engine/src/(endgame|moves|ui)/|apps/server/src/competition/|apps/arena-client/src/|docs/|game\.ts)'` → NO MATCH
- [ ] D-24026 live-verify on play.legendary-arena.com: End Game closes the match for all seats; Play Again relaunches the same loadout at seat 0; early-ended match records NO leaderboard score
- [ ] STATUS Done (states "no re-pin — no initial-G shape change"); WORK_INDEX `[x]`; EC_INDEX Done; NUMBER-LEDGER RESERVED→LANDED; D-24306 Active; ROADMAP node `✅` + `pnpm roadmap:counts:write` / `roadmap:counts:check` 0
- [ ] Commit prefix: `EC-537:` (code) + `SPEC:` (governance close)

## Common Failure Smells
- Endgame panel never appears after End Game → you used `events.endGame` instead of the counter, OR you forgot that `buildUIState` reads `evaluateEndgame` (counters) not `ctx.gameover`.
- An early-ended match posts a leaderboard score → the client skip OR the server `ended_early` reject is missing (the server reject is the authoritative one).
- `endedEarly` missing on the client after the move → not spread into `gameOver` in `buildUIState`, or dropped because a confirming filter pass-through/test was skipped.
- Drift test red in `competition.logic.test.ts` → `'ended_early'` added to the union but not the `SUBMISSION_REJECTION_REASONS` array (or vice-versa) — lockstep both.
- `game.test.ts` move-count/set assertion red → registered `endMatchEarly` but didn't update the expected move set + count.
- A sentinel `finalStateHash`/`PRE_WP080` moved → something wrote to initial `G`; the counter must be written ONLY at runtime by the move.
