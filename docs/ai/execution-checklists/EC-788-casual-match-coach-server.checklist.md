# EC-788 — AI Coach on unscored matches (Server) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-751-casual-match-coach-server.md
**Layer:** Server (`apps/server/src/coach/**`) + API catalog
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (expect exit 0). Record the server suite baseline; the coach suite was 98/6/0 at draft.
- [ ] Read in full:
  - `coach/coach.logic.ts`
  - `coach/coachSummary.logic.ts`
  - `coach/coach.routes.ts`
- [ ] Read these sections:
  - `coach/coach.types.ts`
  - `coach/coachClient.ts` L43–75
  - `coachEval.{types,fixtures,logic.test}.ts`
  - `coach.logic.test.ts` L227–243
  - `competition/competition.logic.ts` L424–470 and L855–868
  - `game-engine/src/scoring/parScoring.logic.ts:54`
  - `api-endpoints.md:301`
- [ ] Scope lock: exactly the 12 files in Files to Produce, plus the govern-close files. Any other edit → STOP.

## Locked Values (do not re-derive)
- **Optional score fields.** `CoachMatchSummary.rawScore?`, `.finalScore?` and `.grade?` are absent exactly for a casual match.
- **Per-player lines.** `buildPerPlayerLines(finalState, inputs: ScoringInputs, resolveCardName, botSeatIds)`. The scored builder passes `breakdown.inputs`, so its output stays byte-identical.
- **Casual summary.** `buildCasualCoachMatchSummary(finalState, inputs, outcome, resolveCardName, botSeatIds)` omits `rawScore`, `finalScore`, `grade` and `adversityExpected`.
- **Seam.** `CoachLogic` gains `captureMatchForCoach(matchId, database): Promise<string | null>` = `isMatchFinished` → `readReplayHashByMatchId` → `captureMatch` fallback.
- **`prepareCasualCoachSummary(reduced, replayHash, deps, logic)`** → `{ summary } | { refusal: 'not_found' }`.
  - `evaluateEndgame` and `deriveScoringInputs({ finalState, stateHash, turnCount }, finalState)` share **one** `try/catch`.
  - A throw, a null evaluation, or `endedEarly === true` → `not_found`.
  - **After** the `try/catch`: the best-effort bot seats (own warn-and-`[]` catch), then `buildCasualCoachMatchSummary`.
- **Casual path.** Runs only when `findCompetitiveScore` returns null: `reduceReplayByHash` (null → `not_found`) → `prepareCasualCoachSummary` → the **shared** model call, tips, Table Cooperation, and cache write.
- **`generateOrGetCoachReportForMatch(accountId, matchId, deps, logic?)`.** Pass gate first (`not_entitled`, no capture) → `captureMatchForCoach` (null → `not_found`) → `generateOrGetCoachReport`.
- **Route.** `GET /api/me/matches/:matchId/coach` uses the same auth, suspension, status and error shapes as the replayHash route. An empty `matchId` returns 400.
  - `CoachRouteLogic` gains `generateOrGetCoachReportForMatch`.
  - `KoaCoachContext.params` gains `matchId?`.
- **Prompt.** Replace "Lower final scores are better." with:
  > Lower final scores are better. If the summary has no rawScore, finalScore or grade, this was a casual (unscored) match: coach the play itself and never invent a score or grade.
- **Eval.** New category `casual-match`; rubric `mustNotMention: ["grade","final score","PAR"]`.

## Guardrails
- **NG-1.** The casual path reads no PAR and computes no score. Its only writes are `coach_reports` and, on the matchId route, idempotent capture rows. It never performs the public flip.
- **Gate order: Pass → (capture) → ownership → cache → numbers.** A caller without the Pass triggers no capture.
- **The scored path is byte-unchanged.** Scored tests get only type-driven updates.
- **Rewrite L227–243, don't delete it.** This is an intentional behavior change under D-24576; say so in the `EC-788:` commit body.
- **Grep-gate prose.** Comments in `coach.logic.ts` never name `checkParPublished`, `computeRawScore`, `computeFinalScore` or `computeParScore`.
- **Keep the prompt constant. Tests make zero paid calls.**

## Required `// why:` Comments
- The optional score fields (D-24576).
- `prepareCasualCoachSummary`: the PAR-free path; NG-1; the single `try/catch` so a malformed state can never 500.
- The ended-early refusal (D-24306).
- `captureMatchForCoach`: mirrors submit's on-demand capture, because the harvester may not have run yet.
- The Pass-first order in `ForMatch`: no writes for callers without the Pass.

## Files to Produce
- `apps/server/src/coach/coach.types.ts` — **modified** — optional score fields
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — casual builder; `buildPerPlayerLines(inputs)`
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified** — casual omits 4 fields; scored unchanged
- `apps/server/src/coach/coach.logic.ts` — **modified** — `prepareCasualCoachSummary`, casual path, `ForMatch`, seam, header
- `apps/server/src/coach/coach.logic.test.ts` — **modified** — L227–243 rewrite + casual / ended-early / gate-order / Pass-before-capture cases
- `apps/server/src/coach/coach.routes.ts` — **modified** — matchId route + `CoachRouteLogic` / `params`
- `apps/server/src/coach/coach.routes.test.ts` — **modified** — 200 / 400 / auth / refusals
- `apps/server/src/coach/coachClient.ts` — **modified** — one prompt sentence
- `apps/server/src/coach/coachEval.types.ts` — **modified** — `casual-match`
- `apps/server/src/coach/coachEval.fixtures.ts` — **modified** — casual scenario
- `apps/server/src/coach/coachEval.logic.test.ts` — **modified** — drift + shape
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — new Wired row + replaced L301 row (WP §H text)
- Govern-close (`SPEC:`): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] `pnpm -r build` exits 0, and the server suite is green. Record baseline → new counts in the commit body.
- [ ] All three Verification greps pass.
- [ ] `git diff --name-only` for `EC-788:` equals the 12 files.
- [ ] Server-side live proof: an authenticated `GET /api/me/matches/<id>/coach` returns 200 for an owned, finished casual match. Record it in STATUS.
- [ ] Governance:
  - STATUS updated
  - DECISIONS D-24576 Active (WP text, including the cache-order and 404/403 notes)
  - WORK_INDEX `[x]`; EC_INDEX Done
  - Mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- **A casual match still returns `not_found`.** The branch still returns early on a null score row.
- **Casual coaching returns 500 on an odd state.** `deriveScoringInputs` is outside the `try/catch`.
- **A caller without the Pass creates replay rows.** Capture ran before the Pass gate.
- **The scored summary changed.** `buildPerPlayerLines` got something other than `breakdown.inputs`.
- **The model invents a grade.** The prompt sentence is missing, or the fields were set to `0` or `''` instead of being omitted.
