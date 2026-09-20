# EC-747 — Synergy Realization: play-order sequence teacher

**WP:** WP-710 · **Layer:** Server (teacher over the D-24119 replay + coach report) + Game Engine (a pure Runtime-Safe condition predicate) · **Lane:** Standard two-session · **Status:** Pending

Governs execution of WP-710: a server-layer play-order sequence teacher. When a legal
same-turn reorder of a seat's hero plays — moving an **unconditional** same-class/team/keyword
hero **before** a whiffed conditional card — would have assembled that card's clause, the
coach offers ONE forward "opportunity" tip on the `CoachReport`. Reorderability is a
set-satisfiability check over captured real `inPlay` sets (NOT a re-simulation); the engine
change is a pure read predicate only; the rule is **net-gain, never net-zero**.

## Before Starting

- [ ] Baseline `origin/main` @ `1bbe8845`; engine + server suites green pre-change.
- [ ] Confirm the seam on `main`: `reduceMatchToFinalState` + the pure `(state,action)=>state` reducer + `readReplayArtifactByHash` (raw `{initialState, log}`) (`apps/server/src/replay/matchReplay.logic.ts`); the `evaluateAllConditions` chokepoint + `isWaitAndSeeCondition` + `WAIT_AND_SEE_CONDITION_TYPES` (`hero/heroEffects.execute.ts`, `deferredConditionalGrants.ts`); `evaluateCondition` class/team/keyword branches + `cardHasClassWhenPlayed`/`cardCountsAsTeamMember` (and the `cardSizeChangingClasses`/`cardCopiedTeams` runtime maps they read); `evaluateCondition` on the `.` barrel (`packages/game-engine/src/index.ts`).
- [ ] Confirm the coach seam: `CoachReport` is the persisted (`coachReport.persistence.ts` `JSON.stringify(report)`) + served (`coach.routes.ts` returns `result.report`) blob; `CoachMatchSummary` is the discarded model INPUT. `generateOrGetCoachReport` + the injectable `CoachLogic` seam + `coach.logic.test.ts` `makeLogic`.
- [ ] Confirm a real move-log entry shape: `payload.args` is a positional ARRAY (`args[0].cardId`), NOT `args.cardId`.

## Locked Values

- Gate set: `SEQUENCE_GATE_CONDITION_TYPES = ['heroClassMatch','requiresTeam','requiresKeyword']` — closed readonly array in `hero/heroConditions.evaluate.ts`. TWO runtime drift assertions (RS-1): (a) disjoint from `WAIT_AND_SEE_CONDITION_TYPES`; (b) every member has an `evaluateCondition` case. `firstHeroPlayedThisTurn` and `playedThisTurn` are NOT members (PS-4).
- Predicate: `heroConditionHoldsForInPlay(condition, playedCardId, candidateInPlayIds, cardData): 'holds' | 'fails' | 'unsupported'` — pure, reuses `evaluateCondition` for the gate set over a supplied `inPlay` set + setup-static card data, self-excludes `playedCardId`. Returns `unsupported` (teacher skips the whiff AND the enabler check) when the played card OR any card in `candidateInPlayIds` carries a size-changing (`sizeChangingClasses`) or copy-powers hook. No `G` mutation, no `boardgame.io`.
- Capture: `reduceMatchCapturingHeroPlays(artifact): { finalState; heroPlays: readonly CapturedHeroPlay[] }`, each hero play `{ seat, turn, cardId, inPlay: readonly CardExtId[] }` captured AFTER each `playCard` applies, card id via `payload.args[0].cardId`. Returns finalState too (fold once, RS-3). `reduceMatchToFinalState` byte-unchanged.
- Teacher: `computeSequenceTips(heroPlays, finalState, resolveCardName): readonly string[]` — at most ONE tip per seat; empty when none.
- Whiff = a `SEQUENCE_GATE` condition FALSE over the captured pre-play `inPlay` (predicate reproduces the real result), for a non-size-changing/copy-powers card.
- **Net-gain reorder** = there exists, later the same seat/turn, an **UNCONDITIONAL** hero E that satisfies the whiffed condition (`heroConditionHoldsForInPlay(K, C, [E], cardData)` === `'holds'`). ONLY then a tip fires. A conditional class-mate enabler (mutually-enabling pair) → NO tip.
  - "Unconditional E" is PRECISE: E carries no hook `condition` whose `type` is in `SEQUENCE_GATE_CONDITION_TYPES`. (`// why:` note in the teacher: `playedThisTurn` is unproduced by any card parser today, and `firstHeroPlayedThisTurn` is net-safe as an enabler — moving it earlier only helps its own "first Hero" gate — so the SEQUENCE_GATE-only test is correct for the current corpus.)
- **Drift-pin import (RS-1):** the disjointness assertion MUST import the canonical `WAIT_AND_SEE_CONDITION_TYPES` from `deferredConditionalGrants.js` — never re-declare the literal locally (that would recreate the cross-file drift the pin exists to prevent).
- Surface field: `CoachReport.sequenceTips?: readonly string[]` (additive OPTIONAL — keeps the `CoachModelClient` boundary untouched), computed in `coach.logic.ts` and merged `{ ...report, sequenceTips }` before `writeCoachReport` (default `[]`). NOT on `CoachMatchSummary`.
- Tip copy shape: forward/opportunity, e.g. `Next time, play {enabler} before {card} — you'd have landed {payoff}.` NONE of whiff/failed/error/missed/wasted.

## Guardrails

- **Net-gain, never net-zero.** A tip requires an UNCONDITIONAL later enabler. Never suggest a reorder of two mutually-enabling conditional class-mates (it just moves the whiff — the real match's turn-33.2 Absorb/Repulsor + EI/Arc pairs).
- **Server-layer; engine pure (D-20105).** Engine change = read-only predicate + closed array — NO chokepoint edit, NO `G` mutation, NO `G.diagnostics` write, NO `boardgame.io` in the predicate. Server calls the predicate; never re-implements condition semantics.
- **No engine hash/behavior change:** sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical; no fixture / card-data. A re-pin means STOP.
- **On the correct type (PS-1).** `sequenceTips` on the persisted/served `CoachReport`, never on the discarded `CoachMatchSummary`; verify the cache-hit path serves it.
- **Log shape (PS-5).** `payload.args[0].cardId`. The capture-fold test builds entries in the REAL reducer shape (ideally manufacture a real match as `matchReplay.logic.test.ts` does), never hand-crafted to the wrong shape.
- **Fidelity scope-out (PS-3 / PS-B).** The predicate returns `unsupported` — teacher skips the whiff — whenever the played card OR ANY card in its captured `inPlay` is size-changing/copy-powers (uncaptured grant maps could silently satisfy the gate → a false whiff → a wrong tip). Not just C/E identity; the whole in-play set. Conservative, never a wrong tip.
- **Faithful, not re-simulated.** Set-satisfiability over captured real `inPlay`; do NOT re-run a reordered turn.
- **Opportunity voice** copy-lint; one tip per seat; off-ranking (never finalScore/PAR).
- **No `.reduce()`** in the teacher/capture; `for...of` + explicit accumulators.

## Required Comments (`// why:`)

- On `reduceMatchCapturingHeroPlays`: why it re-executes the REAL log order and only captures a per-play projection (D-24119 read; a reordered re-run would diverge on RNG); why `args[0].cardId`.
- On the net-gain rule in the teacher: why the enabler MUST be unconditional (a conditional class-mate reorder is a net-zero whiff swap).
- On the size-changing/copy-powers scope-out: why (runtime grant maps uncaptured — conservative, never wrong).
- On `heroConditionHoldsForInPlay`: why it reuses `evaluateCondition` (engine is the sole authority — D-20105).
- On placing `sequenceTips` on `CoachReport`: why (the served/cached blob; `CoachMatchSummary` is discarded model input).
- On the one-tip-per-seat cap: why (design §3.3 "one forward line").

## Files to Produce

Mirror WP-710 §Files Expected to Change exactly (6 source + 4 test). New modules: engine `heroConditionHoldsForInPlay` + `SEQUENCE_GATE_CONDITION_TYPES` (in `heroConditions.evaluate.ts`), server `coach/sequenceTeacher.logic.ts`. The Runtime-Safe barrel export is the single cross-layer surface. `coach.logic.ts` + `coach.logic.test.ts` are in scope (the `readReplayArtifactByHash` seam addition). `coachSummary.logic.ts` is NOT touched.

## After Completing

- [ ] Engine + server suites green (record deltas); `pnpm -r build` 0.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical; no fixture churn.
- [ ] Predicate-vs-live cross-check green; both gate-array drift assertions green.
- [ ] Net-gain proven: unconditional enabler → tip (turn-36.2 Perfect-Teamwork-before-Marvelous-Strength shape); mutually-enabling conditional pair → NO tip; no enabler → NO tip; size-changing/copy-powers in inPlay → predicate `unsupported` → NO tip.
- [ ] `sequenceTips` present on both the fresh AND cache-hit served `CoachReport`.
- [ ] Copy-lint green; one-tip-per-seat verified.
- [ ] `git diff --name-only` = the allowlist + governance (NO arena-client files — client render is a deferred follow-up, Option B).
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24533 Active; NUMBER-LEDGER landed; STATUS; `api-endpoints.md` iff the coach response row records the `CoachReport` shape.
- [ ] Two-commit topology (`EC-747:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (Option B — payload, post-deploy): `GET /api/me/scores/:replayHash/coach` for the real match returns `CoachReport.sequenceTips` with the turn-36.2 tip and none for the turn-33.2 mutually-enabling pairs. (On-screen render = named follow-up WP.)

## Common Failure Smells

- Putting `sequenceTips` on `CoachMatchSummary` (discarded model input — never served/cached; PS-1).
- Reading the card id as `payload.args.cardId` (undefined on real logs → zero tips in prod; PS-5).
- Suggesting a reorder of a mutually-enabling conditional pair (net-zero whiff swap — the correctness defect the real match caught).
- Including `firstHeroPlayedThisTurn`/`playedThisTurn` in the gate set (inverted monotonicity / count gate — PS-4).
- Teaching a wait-and-see / numeric-threshold clause (the engine already retro-fires it).
- Guessing a size-changing/copy-powers match from stale/uncaptured grant maps → a wrong tip (scope them out instead; PS-3).
- Re-implementing condition semantics in the server instead of calling the engine predicate (drift, D-20105).
- Any `finalStateHash` / `PRE_WP080` re-pin — the engine change must be read-only; STOP.
